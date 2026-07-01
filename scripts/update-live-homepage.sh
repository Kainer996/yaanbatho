#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com — pull the redesigned homepage onto the live server
# ---------------------------------------------------------------
# Downloads ONLY the homepage redesign files from GitHub main into
# the web root. Backs up the current index.html first. Touches
# nothing else (projects, music, burbz, nomad all stay as they are).
#
# Run on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/update-live-homepage.sh \
#     | sudo bash
#
# Optional: WEBROOT=/path/to/site sudo -E bash update-live-homepage.sh
# ===============================================================

set -euo pipefail

BASE="https://raw.githubusercontent.com/Kainer996/yaanbatho/main"

FILES=(
  "index.html"
  "css/lumenform.css"
  "css/lumenform-world.css"
  "js/lumenform.js"
  "js/lumenform-world.js"
  "images/lumenform/mark.svg"
  "images/lumenform/flywheel.svg"
  "images/lumenform/flywheel-red.svg"
  "images/lumenform/girder.svg"
  "images/logo-cyborg.png"
  "images/yaan_face_v2.jpg"
)

log()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mxx \033[0m %s\n" "$*" >&2; exit 1; }

# ----------------------------------------------------------------
# 1. Find the web root (the folder serving yaanbatho.com)
# ----------------------------------------------------------------
find_webroot() {
  # explicit override wins
  if [[ -n "${WEBROOT:-}" ]]; then
    echo "$WEBROOT"
    return
  fi

  local candidates=()

  # roots declared in the running nginx config
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
    # the real site root is the one that has the hero banner in it
    if [[ -f "$c/images/hero-banner.jpg" && -f "$c/index.html" ]]; then
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
# 2. Back up the current homepage
# ----------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
cp "$ROOT/index.html" "$ROOT/index.html.bak-$STAMP"
log "Backed up old homepage to index.html.bak-$STAMP"

# ----------------------------------------------------------------
# 3. Download the redesign files (to temp first, then move)
# ----------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "${FILES[@]}"; do
  mkdir -p "$TMP/$(dirname "$f")"
  curl -fsSL "$BASE/$f" -o "$TMP/$f" || die "Download failed: $f"
done
log "Downloaded ${#FILES[@]} files from GitHub"

# match ownership of the existing site files
OWNER="$(stat -c '%U:%G' "$ROOT/index.html")"

for f in "${FILES[@]}"; do
  mkdir -p "$ROOT/$(dirname "$f")"
  mv "$TMP/$f" "$ROOT/$f"
  chown "$OWNER" "$ROOT/$f"
done
log "Installed new homepage files (owner $OWNER)"

# ----------------------------------------------------------------
# 4. Verify
# ----------------------------------------------------------------
if grep -q "lf-wallworks" "$ROOT/index.html"; then
  printf "\n\033[1;32m  ✔ Done! yaanbatho.com is now serving the new studio homepage.\033[0m\n"
  printf "    Hard-refresh your browser (Ctrl/Cmd+Shift+R) to see it.\n"
  printf "    To roll back: cp %s/index.html.bak-%s %s/index.html\n\n" "$ROOT" "$STAMP" "$ROOT"
else
  die "Verification failed — restored files don't look right. Old site is untouched in index.html.bak-$STAMP"
fi
