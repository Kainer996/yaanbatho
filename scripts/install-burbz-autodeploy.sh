#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com — install Burbz auto-deploy (run ONCE on the server)
# ---------------------------------------------------------------
# After this, the server checks GitHub main every 5 minutes and,
# whenever there's a new commit, syncs public/burbz/* into the web
# root on its own. New Burbz builds go live without any manual step.
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/install-burbz-autodeploy.sh \
#     | sudo bash
#
# Notes:
#  - Only ADDS/UPDATES files. Never deletes, so live-only assets
#    (bird art, cutscenes...) are untouched.
#  - Keeps a rolling backup of the previous index.html/sw.js.
#  - Logs to syslog as "burbz-sync" (journalctl -t burbz-sync).
#  - To stop it: sudo systemctl disable --now burbz-sync.timer
# ===============================================================

set -euo pipefail

REPO="Kainer996/yaanbatho"
SYNC_BIN=/usr/local/bin/burbz-sync
ROOT_FILE=/etc/burbz-webroot

log()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mxx \033[0m %s\n" "$*" >&2; exit 1; }

[[ $EUID -eq 0 ]] || die "Please run as root (use sudo)."
command -v systemctl >/dev/null 2>&1 || die "systemd not found — install manually with a cron job calling $SYNC_BIN"

# ----------------------------------------------------------------
# 1. Find and remember the Burbz folder
# ----------------------------------------------------------------
find_burbz_root() {
  if [[ -n "${WEBROOT:-}" ]]; then echo "$WEBROOT/burbz"; return; fi
  local candidates=()
  if command -v nginx >/dev/null 2>&1; then
    while IFS= read -r r; do candidates+=("$r"); done \
      < <(nginx -T 2>/dev/null | sed -n 's/^[[:space:]]*root[[:space:]]\+\([^;]*\);.*/\1/p' | sort -u)
  fi
  candidates+=(
    "/var/www/yaanbatho.com" "/var/www/yaanbatho" "/var/www/html"
    "/usr/share/nginx/html" "/srv/yaanbatho" "/opt/yaanbatho" "/opt/yaanbatho/public"
  )
  local c
  for c in "${candidates[@]}"; do
    if [[ -f "$c/burbz/index.html" && -f "$c/burbz/manifest.json" ]]; then echo "$c/burbz"; return; fi
  done
  echo ""
}

ROOT="$(find_burbz_root)"
[[ -n "$ROOT" ]] || die "Couldn't find the burbz folder. Re-run with: WEBROOT=/path/to/site sudo -E bash $0"
echo "$ROOT" > "$ROOT_FILE"
log "Burbz root: $ROOT (remembered in $ROOT_FILE)"

# ----------------------------------------------------------------
# 2. The sync script the timer will run
# ----------------------------------------------------------------
log "Writing $SYNC_BIN"
cat > "$SYNC_BIN" <<'SYNC'
#!/usr/bin/env bash
set -euo pipefail
REPO="Kainer996/yaanbatho"
ROOT="$(cat /etc/burbz-webroot)"
[[ -d "$ROOT" ]] || exit 0

SHA=$(curl -fsSL -m 20 "https://api.github.com/repos/$REPO/commits/main" 2>/dev/null | grep -m1 '"sha"' | cut -d'"' -f4 || true)
[[ -n "$SHA" ]] || exit 0
CUR=$(cat "$ROOT/.burbz-deployed-sha" 2>/dev/null || echo none)
[[ "$SHA" == "$CUR" ]] && exit 0

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
curl -fsSL -m 300 "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" -o "$TMP/repo.tgz"
tar -xzf "$TMP/repo.tgz" -C "$TMP"
SRC="$TMP/yaanbatho-main/public/burbz"

# sanity: never install something that doesn't look like the game
[[ -f "$SRC/index.html" && -f "$SRC/manifest.json" ]] || { logger -t burbz-sync "abort: tarball missing burbz files"; exit 1; }
grep -qi 'burbz' "$SRC/index.html" || { logger -t burbz-sync "abort: index.html failed sanity check"; exit 1; }

OWNER=$(stat -c '%U:%G' "$ROOT/index.html")
cp -f "$ROOT/index.html" "$ROOT/index.html.prev" 2>/dev/null || true
cp -f "$ROOT/sw.js" "$ROOT/sw.js.prev" 2>/dev/null || true

BACKEND_CHANGED=0
for f in \
  sound_id/__init__.py \
  sound_id/_audio.py \
  sound_id/birdnet_v3_provider.py \
  sound_id/birdnet_provider.py \
  sound_id/perch_provider.py \
  sound_id/server_integration.py; do
  if [[ ! -f "$ROOT/$f" ]] || ! cmp -s "$SRC/$f" "$ROOT/$f"; then
    BACKEND_CHANGED=1
    break
  fi
done

# add/update only — never delete live-only assets
cp -a "$SRC/." "$ROOT/"
chown -R "$OWNER" "$ROOT"

# Python modules stay resident, and an older server.py may carry the
# unreachable pre-v4 hook. Run the same transactional installer/live proof as
# a manual release; do not record the commit SHA unless exact V3 provenance,
# model hash, policy, positive fixture and confuser regression all pass.
if [[ $BACKEND_CHANGED -eq 1 ]]; then
  if ! bash "$TMP/yaanbatho-main/scripts/install-birdnet-v3.sh"; then
    logger -t burbz-sync "abort: exact BirdNET V3 live proof failed"
    exit 1
  fi
  logger -t burbz-sync "BirdNET V3 live proof passed"
fi

echo "$SHA" > "$ROOT/.burbz-deployed-sha"
logger -t burbz-sync "deployed $SHA to $ROOT"
SYNC
chmod +x "$SYNC_BIN"

# ----------------------------------------------------------------
# 3. systemd service + 5-minute timer
# ----------------------------------------------------------------
log "Writing systemd units"
cat > /etc/systemd/system/burbz-sync.service <<EOF
[Unit]
Description=Sync Burbz build from GitHub main
After=network-online.target
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$SYNC_BIN
EOF

cat > /etc/systemd/system/burbz-sync.timer <<EOF
[Unit]
Description=Check for new Burbz builds every 5 minutes

[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
RandomizedDelaySec=45

[Install]
WantedBy=timers.target
EOF

systemctl daemon-reload
systemctl enable --now burbz-sync.timer

# ----------------------------------------------------------------
# 4. First sync right now
# ----------------------------------------------------------------
log "Running the first sync..."
"$SYNC_BIN"

if grep -q 'burbz-village-marker' "$ROOT/index.html"; then
  printf "\n\033[1;32m  ✔ Done! Burbz is up to date AND will now update itself\033[0m\n"
  printf "    within ~5 minutes of every new build on GitHub main.\n"
  printf "    Watch it:   journalctl -t burbz-sync -f\n"
  printf "    Stop it:    sudo systemctl disable --now burbz-sync.timer\n\n"
else
  die "First sync ran but verification failed — check journalctl -t burbz-sync"
fi
