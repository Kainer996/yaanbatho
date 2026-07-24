#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com — put the private video call app onto the live server
# ---------------------------------------------------------------
# Downloads the /call app (page + vendored PeerJS) from GitHub main
# into the web root, so it serves at https://yaanbatho.com/call/.
# Add/update only — touches nothing else on the site.
#
# Run on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/update-live-call.sh \
#     | sudo bash
#
# Optional overrides:
#   WEBROOT=/path/to/site sudo -E bash update-live-call.sh
#   BRANCH=some-branch    sudo -E bash update-live-call.sh
# ===============================================================

set -euo pipefail

BRANCH="${BRANCH:-main}"
BASE="https://raw.githubusercontent.com/Kainer996/yaanbatho/${BRANCH}/call"

FILES=(
  "index.html"
  "peerjs.min.js"
)

log()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mxx \033[0m %s\n" "$*" >&2; exit 1; }

# ----------------------------------------------------------------
# 1. Find the web root (the folder serving yaanbatho.com)
# ----------------------------------------------------------------
find_webroot() {
  if [[ -n "${WEBROOT:-}" ]]; then
    echo "$WEBROOT"
    return
  fi

  local candidates=()

  if command -v nginx >/dev/null 2>&1; then
    while IFS= read -r r; do
      candidates+=("$r")
    done < <(nginx -T 2>/dev/null | sed -n 's/^[[:space:]]*root[[:space:]]\+\([^;]*\);.*/\1/p' | sort -u)
  fi

  candidates+=(
    "/var/www/yaanbatho.com" "/var/www/yaanbatho" "/var/www/html"
    "/usr/share/nginx/html" "/srv/yaanbatho" "/opt/yaanbatho"
  )

  local c
  for c in "${candidates[@]}"; do
    # the real site root is the one with the homepage in it
    if [[ -f "$c/index.html" && -f "$c/images/hero-banner.jpg" ]]; then
      echo "$c"
      return
    fi
  done
  echo ""
}

ROOT="$(find_webroot)"
[[ -n "$ROOT" ]] || die "Couldn't find the site folder. Re-run with: WEBROOT=/path/to/site sudo -E bash $0"
log "Web root: $ROOT"

# ----------------------------------------------------------------
# 2. Back up any existing call app
# ----------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -f "$ROOT/call/index.html" ]]; then
  cp "$ROOT/call/index.html" "$ROOT/call/index.html.bak-$STAMP"
  log "Backed up existing call/index.html to index.html.bak-$STAMP"
fi

# ----------------------------------------------------------------
# 3. Download to temp first, sanity-check, then install
# ----------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "${FILES[@]}"; do
  mkdir -p "$TMP/$(dirname "$f")"
  curl -fsSL "$BASE/$f" -o "$TMP/$f" || die "Download failed: $f"
done
log "Downloaded ${#FILES[@]} files from GitHub ($BRANCH)"

grep -q 'PRIVATE CALL' "$TMP/index.html" || die "index.html doesn't look like the call app — aborting, live site untouched"
[[ "$(wc -c < "$TMP/peerjs.min.js")" -gt 50000 ]] || die "peerjs.min.js looks truncated — aborting, live site untouched"

OWNER="$(stat -c '%U:%G' "$ROOT/index.html")"

mkdir -p "$ROOT/call"
for f in "${FILES[@]}"; do
  mv "$TMP/$f" "$ROOT/call/$f"
  chown "$OWNER" "$ROOT/call/$f"
done
log "Installed call app (owner $OWNER)"

# ----------------------------------------------------------------
# 4. Verify
# ----------------------------------------------------------------
if grep -q 'PRIVATE CALL' "$ROOT/call/index.html" && [[ -f "$ROOT/call/peerjs.min.js" ]]; then
  printf "\n\033[1;32m  ✔ Done! The private call app is live at https://yaanbatho.com/call/\033[0m\n"
  printf "    Open it on both phones, type the same secret code, tap CONNECT.\n\n"
else
  die "Verification failed. Any previous version is in call/index.html.bak-$STAMP"
fi
