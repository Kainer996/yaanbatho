#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com — pull the latest Burbz build onto the live server
# ---------------------------------------------------------------
# Downloads ONLY the Burbz files that changed (medieval 3D village
# with RPG shops, shop-button fix, self-hosted Three.js, hardened
# offline service worker) from GitHub main into the web root.
# Backs up the current files first. Touches nothing else.
#
# Run on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/update-live-burbz.sh \
#     | sudo bash
#
# Optional: WEBROOT=/path/to/site sudo -E bash update-live-burbz.sh
# ===============================================================

set -euo pipefail

BASE="https://raw.githubusercontent.com/Kainer996/yaanbatho/main/public/burbz"

FILES=(
  "index.html"
  "sw.js"
  "lib/three.min.js"
)

log()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mxx \033[0m %s\n" "$*" >&2; exit 1; }

# ----------------------------------------------------------------
# 1. Find the Burbz folder (the one serving yaanbatho.com/burbz)
# ----------------------------------------------------------------
find_burbz_root() {
  if [[ -n "${WEBROOT:-}" ]]; then
    echo "$WEBROOT/burbz"
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
    "/opt/yaanbatho/public"
  )

  local c
  for c in "${candidates[@]}"; do
    if [[ -f "$c/burbz/index.html" && -f "$c/burbz/manifest.json" ]]; then
      echo "$c/burbz"
      return
    fi
  done
  echo ""
}

ROOT="$(find_burbz_root)"
[[ -n "$ROOT" ]] || die "Couldn't find the burbz folder. Re-run with: WEBROOT=/path/to/site sudo -E bash $0"
log "Burbz root: $ROOT"

# ----------------------------------------------------------------
# 2. Back up the files we're about to replace
# ----------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
for f in index.html sw.js; do
  if [[ -f "$ROOT/$f" ]]; then
    cp "$ROOT/$f" "$ROOT/$f.bak-$STAMP"
    log "Backed up $f to $f.bak-$STAMP"
  fi
done

# ----------------------------------------------------------------
# 3. Download the new files (to temp first, then move)
# ----------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "${FILES[@]}"; do
  mkdir -p "$TMP/$(dirname "$f")"
  curl -fsSL "$BASE/$f" -o "$TMP/$f" || die "Download failed: $f"
done
log "Downloaded ${#FILES[@]} files from GitHub"

# sanity-check before touching the live site
grep -q 'screen-village' "$TMP/index.html"  || die "index.html doesn't contain the village — aborting, live site untouched"
grep -q 'BURBZ_CORE'     "$TMP/sw.js"       || die "sw.js doesn't look right — aborting, live site untouched"
[[ "$(wc -c < "$TMP/lib/three.min.js")" -gt 500000 ]] || die "three.min.js looks truncated — aborting, live site untouched"

OWNER="$(stat -c '%U:%G' "$ROOT/index.html")"

for f in "${FILES[@]}"; do
  mkdir -p "$ROOT/$(dirname "$f")"
  mv "$TMP/$f" "$ROOT/$f"
  chown "$OWNER" "$ROOT/$f"
done
log "Installed new Burbz files (owner $OWNER)"

# ----------------------------------------------------------------
# 4. Verify
# ----------------------------------------------------------------
if grep -q 'screen-village' "$ROOT/index.html" && [[ -f "$ROOT/lib/three.min.js" ]]; then
  printf "\n\033[1;32m  ✔ Done! yaanbatho.com/burbz now has the medieval village + shops.\033[0m\n"
  printf "    On your phone: close the app fully and reopen (or hard-refresh)\n"
  printf "    so the new service worker takes over. Look for the VILLAGE tab.\n"
  printf "    To roll back: cp %s/index.html.bak-%s %s/index.html\n\n" "$ROOT" "$STAMP" "$ROOT"
else
  die "Verification failed. Old files are untouched in *.bak-$STAMP"
fi
