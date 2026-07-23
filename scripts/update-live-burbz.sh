#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com — pull the latest Burbz build onto the live server
# ---------------------------------------------------------------
# Syncs the WHOLE public/burbz tree from GitHub main into the web
# root (add/update only — live-only assets are never deleted).
#
# The old version of this script shipped only index.html, sw.js and
# three.min.js, so a new index.html could reference companion files
# (like kitchen_pantry_core.js) that were never installed — the
# Kitchen's Prep Counter then showed "still warming up" forever.
# Syncing the full tree makes that class of bug impossible.
#
# Backs up index.html and sw.js first. Touches nothing else.
#
# Run on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/update-live-burbz.sh \
#     | sudo bash
#
# Optional: WEBROOT=/path/to/site sudo -E bash update-live-burbz.sh
# ===============================================================

set -euo pipefail

REPO="Kainer996/yaanbatho"

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
# 3. Download the full Burbz build from GitHub main
# ----------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

curl -fsSL -m 300 "https://codeload.github.com/$REPO/tar.gz/refs/heads/main" -o "$TMP/repo.tgz" \
  || die "Download failed: main branch tarball"
tar -xzf "$TMP/repo.tgz" -C "$TMP"
SRC="$TMP/yaanbatho-main/public/burbz"
[[ -d "$SRC" ]] || die "Tarball doesn't contain public/burbz — aborting, live site untouched"
log "Downloaded the full Burbz tree from GitHub main"

# sanity-check before touching the live site
grep -q 'screen-village'    "$SRC/index.html" || die "index.html doesn't contain the village — aborting, live site untouched"
grep -q 'BURBZ_CORE'        "$SRC/sw.js"      || die "sw.js doesn't look right — aborting, live site untouched"
[[ -f "$SRC/kitchen_pantry_core.js" ]]        || die "kitchen_pantry_core.js missing from the build — aborting, live site untouched"
[[ "$(wc -c < "$SRC/lib/three.min.js")" -gt 500000 ]] || die "three.min.js looks truncated — aborting, live site untouched"

OWNER="$(stat -c '%U:%G' "$ROOT/index.html")"

# add/update only — never delete live-only assets (bird art, cutscenes...)
cp -a "$SRC/." "$ROOT/"
chown -R "$OWNER" "$ROOT"
log "Installed the full Burbz build (owner $OWNER)"

# ----------------------------------------------------------------
# 4. Verify — every core script index.html references must exist
# ----------------------------------------------------------------
MISSING=0
while IFS= read -r script; do
  if [[ ! -f "$ROOT/$script" ]]; then
    printf "\033[1;31mxx \033[0m missing after sync: %s\n" "$script" >&2
    MISSING=1
  fi
done < <(sed -n 's/.*<script src="\([^"?]*\.js\)[^"]*".*/\1/p' "$ROOT/index.html" | grep -v '^http')

if [[ "$MISSING" -eq 0 ]] && grep -q 'screen-village' "$ROOT/index.html"; then
  printf "\n\033[1;32m  ✔ Done! yaanbatho.com/burbz is fully in sync with GitHub main.\033[0m\n"
  printf "    On your phone: close the app fully and reopen (or hard-refresh)\n"
  printf "    so the new service worker takes over.\n"
  printf "    To roll back: cp %s/index.html.bak-%s %s/index.html\n\n" "$ROOT" "$STAMP" "$ROOT"
else
  die "Verification failed. Old index.html/sw.js are in *.bak-$STAMP"
fi
