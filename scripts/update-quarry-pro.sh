#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com — pull the overhauled QuarryPro onto the live server
# ---------------------------------------------------------------
# Downloads the overhauled QuarryPro game (physics, economy and
# graphics overhaul) from GitHub main into the web root's
# quarry-pro/ folder. Backs up the current game first. Touches
# nothing else.
#
# Run on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/update-quarry-pro.sh \
#     | sudo bash
#
# Optional: WEBROOT=/path/to/site sudo -E bash update-quarry-pro.sh
# ===============================================================

set -euo pipefail

BASE="https://raw.githubusercontent.com/Kainer996/yaanbatho/main/quarry-pro"

FILES=(
  "index.html"
  "manifest.webmanifest"
  "OVERHAUL.md"
  "assets/logo.png"
  "css/main.css"
  "css/premium.css"
  "js/analytics.js"
  "js/blasts.js"
  "js/fleet.js"
  "js/handover.js"
  "js/kpi.js"
  "js/main.js"
  "js/maintenance.js"
  "js/map3d.js"
  "js/prestart.js"
  "js/production.js"
  "js/quarry-equipment-core.mjs"
  "js/quarry-game-core.mjs"
  "js/quarry-map.js"
  "js/quarry-physics-core.mjs"
  "js/quarry-staff-core.mjs"
  "js/quarry-terrain-core.mjs"
  "js/quarry3d.js"
  "js/reports.js"
  "js/roster.js"
  "js/safety.js"
  "js/settings.js"
  "js/stockpile.js"
  "api/alerts"
  "api/analytics"
  "api/blasts"
  "api/fleet/upcoming-service"
  "api/fuel-log"
  "api/handovers"
  "api/incidents"
  "api/kpis/today"
  "api/maintenance"
  "api/pre-start"
  "api/production"
  "api/settings"
  "api/stockpiles"
  "api/vehicles"
  "api/workers"
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
    if [[ -f "$c/index.html" && -d "$c/quarry-pro" ]]; then
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
# 2. Back up the current game
# ----------------------------------------------------------------
STAMP="$(date +%Y%m%d-%H%M%S)"
if [[ -d "$ROOT/quarry-pro" ]]; then
  cp -r "$ROOT/quarry-pro" "$ROOT/quarry-pro.bak-$STAMP"
  log "Backed up old game to quarry-pro.bak-$STAMP"
fi

# ----------------------------------------------------------------
# 3. Download the overhauled game (to temp first, then move)
# ----------------------------------------------------------------
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

for f in "${FILES[@]}"; do
  mkdir -p "$TMP/$(dirname "$f")"
  curl -fsSL "$BASE/$f" -o "$TMP/$f" || die "Download failed: $f"
done
log "Downloaded ${#FILES[@]} files from GitHub"

OWNER="$(stat -c '%U:%G' "$ROOT/index.html")"

mkdir -p "$ROOT/quarry-pro"
for f in "${FILES[@]}"; do
  mkdir -p "$ROOT/quarry-pro/$(dirname "$f")"
  mv "$TMP/$f" "$ROOT/quarry-pro/$f"
  chown "$OWNER" "$ROOT/quarry-pro/$f"
done
log "Installed overhauled QuarryPro (owner $OWNER)"

# ----------------------------------------------------------------
# 4. Verify
# ----------------------------------------------------------------
if grep -q "20260611-overhaul" "$ROOT/quarry-pro/index.html"; then
  printf "\n\033[1;32m  ✔ Done! yaanbatho.com/quarry-pro/ is now serving the overhauled game.\033[0m\n"
  printf "    Hard-refresh your browser (Ctrl/Cmd+Shift+R) to load the new version.\n"
  printf "    To roll back: rm -rf %s/quarry-pro && mv %s/quarry-pro.bak-%s %s/quarry-pro\n\n" "$ROOT" "$ROOT" "$STAMP" "$ROOT"
else
  die "Verification failed — old game restored from quarry-pro.bak-$STAMP if needed"
fi
