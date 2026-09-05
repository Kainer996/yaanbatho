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

command -v flock >/dev/null 2>&1 || { logger -t burbz-sync "abort: flock is required"; exit 1; }
exec 9>/run/lock/burbz-sync.lock
flock -n 9 || exit 0

# Normal timer runs follow main. A release operator can pin one immutable SHA
# with BURBZ_DEPLOY_SHA so a verified commit cannot be overtaken mid-promotion.
SHA="${BURBZ_DEPLOY_SHA:-}"
if [[ -z "$SHA" ]]; then
  SHA=$(curl -fsSL -m 20 "https://api.github.com/repos/$REPO/commits/main" 2>/dev/null | grep -m1 '"sha"' | cut -d'"' -f4 || true)
fi
[[ $SHA =~ ^[0-9a-f]{40}$ ]] || { logger -t burbz-sync "abort: invalid deployment SHA"; exit 1; }
CUR=$(cat "$ROOT/.burbz-deployed-sha" 2>/dev/null || echo none)
[[ "$SHA" == "$CUR" ]] && exit 0

# Never overwrite live edits that have not yet been promoted to GitHub. The
# previous deploy records hashes only for files managed by GitHub, so live-only
# assets remain allowed while changed managed files make the deploy fail closed.
MANAGED_HASHES="$ROOT/.burbz-managed-hashes.sha256"
if [[ -f "$MANAGED_HASHES" ]]; then
  DRIFT=$(mktemp)
  if ! (cd "$ROOT" && sha256sum --quiet -c "$MANAGED_HASHES") >"$DRIFT" 2>&1; then
    logger -t burbz-sync "abort: live managed files differ from last deployment; promote or back them up before deploying $SHA"
    sed -n '1,20p' "$DRIFT" | logger -t burbz-sync
    rm -f "$DRIFT"
    exit 1
  fi
  rm -f "$DRIFT"
fi

TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT
mkdir "$TMP/repo"
curl -fsSL -m 300 "https://codeload.github.com/$REPO/tar.gz/$SHA" -o "$TMP/repo.tgz"
tar -xzf "$TMP/repo.tgz" -C "$TMP/repo" --strip-components=1
SRC="$TMP/repo/public/burbz"

# GitHub source archives contain pointer text for Git LFS files. Hydrate every
# such file at the same immutable commit before it can reach production.
while IFS= read -r -d '' candidate; do
  [[ $(stat -c '%s' "$candidate") -le 300 ]] || continue
  grep -q '^version https://git-lfs.github.com/spec/v1$' "$candidate" || continue
  rel=${candidate#"$SRC/"}
  hydrated="$candidate.hydrated"
  pointer_oid=$(sed -n 's/^oid sha256://p' "$candidate")
  pointer_size=$(sed -n 's/^size //p' "$candidate")
  [[ $pointer_oid =~ ^[0-9a-f]{64}$ && $pointer_size =~ ^[0-9]+$ ]] || {
    logger -t burbz-sync "abort: invalid LFS pointer for $rel"
    exit 1
  }

  # Code-only releases should not re-download gigabytes of unchanged art. A
  # live file is reusable only when both its LFS size and SHA-256 match the
  # immutable pointer in this exact commit; otherwise fetch the pinned blob.
  existing="$ROOT/$rel"
  if [[ -f "$existing" && $(stat -c '%s' "$existing") == "$pointer_size" ]]; then
    existing_oid=$(sha256sum "$existing" | cut -d' ' -f1)
    if [[ $existing_oid == "$pointer_oid" ]]; then
      cp --reflink=auto --preserve=mode,timestamps "$existing" "$hydrated"
    fi
  fi
  if [[ ! -f "$hydrated" ]]; then
    curl -fsSL -m 300 "https://media.githubusercontent.com/media/$REPO/$SHA/public/burbz/$rel" -o "$hydrated"
  fi
  hydrated_size=$(stat -c '%s' "$hydrated")
  hydrated_oid=$(sha256sum "$hydrated" | cut -d' ' -f1)
  [[ $hydrated_size == "$pointer_size" && $hydrated_oid == "$pointer_oid" ]] || {
    logger -t burbz-sync "abort: LFS hydration verification failed for $rel"
    exit 1
  }
  mv -f "$hydrated" "$candidate"
done < <(find "$SRC" -type f -print0)

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

# Prove a changed photo adapter in the running backend before publishing the
# app shell. Its installer backs up/rolls back the adapter on proof failure.
if [[ -f "$SRC/photo_id.py" ]]; then
  bash "$TMP/repo/scripts/install-photo-id.sh" "$ROOT" "$SRC/photo_id.py" \
    "$SRC/tests/fixtures/photo-v350" "$TMP/repo/scripts/verify-photo-id.py" "$TMP/repo/scripts/verify-sound-runtime.py" \
    || { logger -t burbz-sync "abort: photo HTTP proof failed; prior adapter restored"; exit 1; }
fi

# add/update only — never delete live-only assets
cp -a "$SRC/." "$ROOT/"
chown -R "$OWNER" "$ROOT"

# Python modules stay resident, and an older server.py may carry the
# unreachable pre-v4 hook. Run the same transactional installer/live proof as
# a manual release; do not record the commit SHA unless exact V3 provenance,
# model hash, policy, positive fixture and confuser regression all pass.
if [[ $BACKEND_CHANGED -eq 1 ]]; then
  if ! bash "$TMP/repo/scripts/install-birdnet-v3.sh"; then
    logger -t burbz-sync "abort: exact BirdNET V3 live proof failed"
    exit 1
  fi
  logger -t burbz-sync "BirdNET V3 live proof passed"
fi

# Publish the managed manifest first and the commit marker last. Atomic renames
# ensure an interrupted sync never advertises a deployment it did not finish.
(cd "$SRC" && find . -type f -print0 | sort -z | xargs -0 sha256sum) > "$ROOT/.burbz-managed-hashes.sha256.new"
printf '%s\n' "$SHA" > "$ROOT/.burbz-deployed-sha.new"
chown "$OWNER" "$ROOT/.burbz-managed-hashes.sha256.new" "$ROOT/.burbz-deployed-sha.new"
mv -f "$ROOT/.burbz-managed-hashes.sha256.new" "$ROOT/.burbz-managed-hashes.sha256"
mv -f "$ROOT/.burbz-deployed-sha.new" "$ROOT/.burbz-deployed-sha"
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
TimeoutStartSec=30min
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
