#!/usr/bin/env bash
# ===============================================================
# yaanbatho.com — pull the latest Burbz build onto the live server
# ---------------------------------------------------------------
# Downloads the COMPLETE Burbz app shell (page, service worker and
# every companion .js/data file the page loads) from GitHub main
# into the web root. A hardcoded 3-file list here once shipped
# index.html without its companion core files, 404-ing new features
# on live — this list must contain every file index.html references.
# Backs up the current index.html/sw.js first. Add/update only —
# never deletes, so live-only assets (bird art, cutscenes) survive.
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
# LFS-tracked files MUST come from this endpoint instead: raw.githubusercontent
# answers 200 with the ~130-byte pointer text for LFS blobs in this repo, while
# github.com/raw redirects to media.githubusercontent and serves the real bytes
# (same endpoint index.html's BIRD_ART_GITHUB_RAW_BASE relies on).
LFS_BASE="https://github.com/Kainer996/yaanbatho/raw/refs/heads/main/public/burbz"
LFS_FILES=(
  "assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4"
)

FILES=(
  "index.html"
  "sw.js"
  "manifest.json"
  "quest_core.js"
  "empire_map_core.js"
  "academy_treehouse_core.js"
  "kitchen_pantry_core.js"
  "data/bird-diet-records.js"
  "bird_diet_hunger_core.js"
  "diet_hunger_core.js"
  "scan_economy_core.js"
  "sound_listener_core.js"
  "battle_core.js"
  "loot_crafting_core.js"
  "audio_core.js"
  "assets/ui/quest-compass-emblem.webp"
  "assets/ui/map-landmark-field.webp"
  "assets/ui/map-landmark-grove.webp"
  "assets/ui/map-landmark-water.webp"
  "assets/audio/bgm-birbs-quest.mp3"
  "assets/audio/bgm-burbz-quest-v2.mp3"
  "assets/audio/ambience-empire-treetops.mp3"
  "assets/audio/sfx-ui-tap.mp3"
  "assets/audio/sfx-page-wing.mp3"
  "assets/audio/sfx-capture.mp3"
  "assets/audio/sfx-resource.mp3"
  "assets/audio/sfx-battle-hit.mp3"
  "assets/audio/sfx-battle-magic.mp3"
  "assets/audio/sfx-battle-defend.mp3"
  "assets/audio/sfx-build.mp3"
  "assets/audio/sfx-level-up.mp3"
  "assets/audio/sfx-quest-complete.mp3"
  "assets/audio/sfx-victory.mp3"
  "assets/audio/sfx-defeat-error.mp3"
  "assets/audio/ATTRIBUTION.md"
  "audio-credits.html"
  "action_badge_core.js"
  "merlin_companion_core.js"
  "uk_bird_expansion_50.js"
  "uk_bird_expansion_2.js"
  "uk_bird_expansion_3.js"
  "uk_bird_expansion_4.js"
  "au_bird_expansion.js"
  "au_bird_expansion_2.js"
  "national_bird_completion_20260715.js"
  "bird_art_release_20260727.js"
  "spain_boundary_20260715.js"
  "lib/three.min.js"
  "lib/maplibre-gl.js"
  "lib/maplibre-gl.css"
  # Merlin's perched companion is a four-piece puppet; ship every piece or the
  # top-right corner renders four broken images.
  "assets/merlin/merlin-back.webp"
  "assets/merlin/merlin-body.webp"
  "assets/merlin/merlin-wing.webp"
  "assets/merlin/merlin-head.webp"
  "assets/ui/burbz-icon-set/coin.webp"
  "assets/ui/burbz-icon-set/timber.webp"
  "assets/ui/burbz-icon-set/profile.webp"
  "assets/ui/burbz-icon-set/settings.webp"
  "assets/ui/burbz-icon-set/camera.webp"
  "assets/ui/burbz-icon-set/sound.webp"
  "assets/ui/burbz-icon-set/inventory.webp"
  "assets/ui/burbz-icon-set/forge.webp"
  "assets/ui/burbz-icon-set/quests.webp"
  # Backend, not referenced by index.html: server.py imports this package to
  # choose its recogniser. BirdNET V3 (CC BY-SA 4.0) is the default; Perch 2.0
  # and the legacy non-commercial V2.4 path remain selectable. Ship every file
  # or a synced box loses the switch and errors on import.
  "sound_id/__init__.py"
  "sound_id/_audio.py"
  "sound_id/birdnet_v3_provider.py"
  "sound_id/birdnet_provider.py"
  "sound_id/perch_provider.py"
  "sound_id/selftest.py"
  "sound_id/README.md"
  # The self-test identifies this clip and checks it gets Strix aluco back, so
  # it has to be on the box for `python3 -m sound_id.selftest` to mean anything.
  "assets/audio/bird-tawny-owl.ogg"
  "data/uk-bird-education-50.json"
  "data/regional-bird-education-20260715.json"
  "data/national-bird-completion/manifest.json"
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
for f in "${LFS_FILES[@]}"; do
  mkdir -p "$TMP/$(dirname "$f")"
  curl -fsSL "$LFS_BASE/$f" -o "$TMP/$f" || die "Download failed (LFS): $f"
  FILES+=("$f")
done
# The generated-art mapping is the release manifest for its card paintings.
# Pull each referenced local painting without hardcoding the release filenames.
while IFS= read -r art_url; do
  f="${art_url#/burbz/}"
  FILES+=("$f")
  mkdir -p "$TMP/$(dirname "$f")"
  curl -fsSL "$BASE/$f" -o "$TMP/$f" || die "Download failed: $f"
done < <(grep -o '/burbz/bird-art-cache/completion-20260726/[^"]*' "$TMP/bird_art_release_20260727.js" | sort -u)
log "Downloaded ${#FILES[@]} files from GitHub"

# sanity-check before touching the live site
grep -q 'screen-village' "$TMP/index.html"  || die "index.html doesn't contain the village — aborting, live site untouched"
grep -q 'BURBZ_CORE'     "$TMP/sw.js"       || die "sw.js doesn't look right — aborting, live site untouched"
[[ "$(wc -c < "$TMP/lib/three.min.js")" -gt 500000 ]] || die "three.min.js looks truncated — aborting, live site untouched"
for piece in back body wing head; do
  [[ "$(head -c 4 "$TMP/assets/merlin/merlin-$piece.webp")" == "RIFF" ]] \
    || die "Merlin's $piece layer is not a WebP — aborting, live site untouched"
done
# LFS downloads can silently yield the ~130-byte pointer text with HTTP 200 if
# the endpoint or quota misbehaves — a black intro for every player. Real MP4s
# are megabytes and carry 'ftyp' at byte offset 4.
INTRO_MP4="$TMP/assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4"
[[ "$(wc -c < "$INTRO_MP4")" -gt 1000000 ]] \
  || die "Intro cutscene is tiny (LFS pointer, not video?) — aborting, live site untouched"
[[ "$(dd if="$INTRO_MP4" bs=1 skip=4 count=4 2>/dev/null)" == "ftyp" ]] \
  || die "Intro cutscene is not an MP4 — aborting, live site untouched"
# The feedback screen with screenshot attachments once lived only on the server,
# outside git, and a deploy from main would have deleted it. It is in main now;
# this check makes sure it never silently leaves again.
grep -q 'id="feedbackScreenshots"' "$TMP/index.html" \
  || die "index.html has no feedback screenshots — that build would delete a live feature. Aborting, live site untouched"

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
if grep -q 'screen-village' "$ROOT/index.html" && [[ -f "$ROOT/lib/three.min.js" && -f "$ROOT/quest_core.js" ]]; then
  NEW_CACHE="$(grep -o "BURBZ_CACHE = '[^']*'" "$ROOT/sw.js" | head -1 || true)"
  printf "\n\033[1;32m  ✔ Done! yaanbatho.com/burbz now serves the latest GitHub main build.\033[0m\n"
  printf "    Live build: %s\n" "${NEW_CACHE:-unknown}"
  printf "    On your phone: close the app fully and reopen TWICE (or hard-refresh)\n"
  printf "    so the new service worker takes over.\n"
  printf "    To roll back: cp %s/index.html.bak-%s %s/index.html\n\n" "$ROOT" "$STAMP" "$ROOT"
else
  die "Verification failed. Old files are untouched in *.bak-$STAMP"
fi
