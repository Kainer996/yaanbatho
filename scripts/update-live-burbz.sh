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
# Art is NEVER downloaded. GitHub's free Git LFS allowance is 1 GB of storage
# and 1 GB of download a month, and this repo holds ~1.6 GB of paintings — a
# single deploy that pulled them all used the whole month's quota and blocked
# every other LFS download, including the Pages build. Art is copied from a
# local source instead: the live directory as it stands, or the repo checkout
# this script is running from. Full backup: /var/backups/burbz-art/.
LFS_FILES=(
  "assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4"
  "bird-art-cache/cutouts/merlin_burbz_manga_20260624_v2_cutout.png"
)
BIRDNET_INSTALLER_URL="https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/install-birdnet-v3.sh"
PHOTO_SCRIPTS_URL="https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts"

FILES=(
  "index.html"
  "sw.js"
  "manifest.json"
  "quest_core.js"
  "walking_story_core.js"
  "side_trail_core.js"
  "trail_mode_core.js"
  "building_discovery_core.js"
  "village_variation_core.js"
  "settlement_scene_core.js"
  "peep_needs_core.js"
  "photo_id.py"
  "tests/fixtures/photo-v350/robin-clear.jpg"
  "tests/fixtures/photo-v350/great-tit-clear.jpg"
  "tests/fixtures/photo-v350/distant-blob.jpg"
  "tests/fixtures/photo-v350/blurred-bird.jpg"
  "tests/fixtures/photo-v350/empty-scene.jpg"
  "tests/fixtures/photo-v350/nonbird-shapes.jpg"
  "tests/fixtures/photo-v350/README.md"
  "assets/forge/anvil-v351.webp"
  "assets/bird-card/weapon.webp"
  "assets/bird-card/armour.webp"
  "assets/bird-card/trinket.webp"
  "assets/bird-card/spell.webp"
  "assets/bird-card/potion.webp"
  "assets/bird-card/preen.webp"
  "assets/ui/empire-tab.webp"
  "assets/ui/towns-tab.webp"
  "assets/ui/villages-tab.webp"
  "assets/ui/merlin-listening-wand-v354.webp"
  "assets/quest-categories/food.webp"
  "assets/quest-categories/materials.webp"
  "assets/quest-categories/timber.webp"
  "assets/quest-categories/treasure.webp"
  "assets/quest-categories/diplomacy.webp"
  "settlement_life_core.js"
  "settlement_models.js"
  "settlement_lighting.js"
  "empire_map_core.js"
  "empire_realm_core.js"
  "settlement_merge_core.js"
  "town_strategy_core.js"
  "empire_grid_core.js"
  "village_manager_core.js"
  "building_interior_core.js"
  "daylight_core.js"
  "academy_treehouse_core.js"
  "academy_alive_core.js"
  "academy_3d_core.js"
  "touch_steer_core.js"
  "kitchen_pantry_core.js"
  "data/bird-diet-records.js"
  "bird_diet_hunger_core.js"
  "bird_sleep_core.js"
  "diet_hunger_core.js"
  "bird_family_core.js"
  "bird_size_core.js"
  "bird_roles_core.js"
  "bird_bond_core.js"
  "scan_economy_core.js"
  "sound_listener_core.js"
  "battle_core.js"
  "battle_aim_core.js"
  "loot_crafting_core.js"
  "world_level_core.js"
  "diary_core.js"
  "audio_core.js"
  "assets/academy-tree-manga-20260806.webp"
  "assets/academy-branches/branch-a.webp"
  "assets/academy-branches/branch-b.webp"
  "assets/academy-branches/branch-c.webp"
  "assets/academy-branches/branch-d.webp"
  "assets/academy-buildings-manga/aviary-gardens.png"
  "assets/academy-buildings-manga/crowbar.png"
  "assets/academy-buildings-manga/hospital.png"
  "assets/academy-buildings-manga/kitchen.png"
  "assets/academy-buildings-manga/market.png"
  "assets/academy-buildings-manga/nursery.png"
  "assets/academy-buildings-manga/observatory.png"
  "assets/academy-buildings-manga/quest-roost.png"
  "assets/academy-buildings-manga/roost.png"
  "assets/academy-buildings-manga/training-hall.png"
  "assets/academy-buildings-manga/workshop.png"
  "assets/academy-buildings/aviary-gardens.svg"
  "assets/academy-buildings/crowbar.svg"
  "assets/academy-buildings/hospital.svg"
  "assets/academy-buildings/kitchen.svg"
  "assets/academy-buildings/market.svg"
  "assets/academy-buildings/nursery.svg"
  "assets/academy-buildings/observatory.svg"
  "assets/academy-buildings/roost.svg"
  "assets/academy-buildings/training-hall.svg"
  "assets/academy-buildings/workshop.svg"
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
  "assets/audio/little-folk/mumble-01.mp3"
  "assets/audio/little-folk/mumble-02.mp3"
  "assets/audio/little-folk/mumble-03.mp3"
  "assets/audio/little-folk/mumble-04.mp3"
  "assets/audio/little-folk/mumble-05.mp3"
  "assets/audio/little-folk/mumble-06.mp3"
  "assets/audio/little-folk/mumble-07.mp3"
  "assets/audio/little-folk/mumble-08.mp3"
  "assets/audio/little-folk/mumble-09.mp3"
  "assets/audio/little-folk/mumble-10.mp3"
  "assets/audio/little-folk/mumble-11.mp3"
  "assets/audio/little-folk/mumble-12.mp3"
  "assets/audio/little-folk/mumble-13.mp3"
  "assets/audio/little-folk/mumble-14.mp3"
  "assets/audio/little-folk/mumble-15.mp3"
  "assets/audio/little-folk/mumble-16.mp3"
  "assets/audio/ATTRIBUTION.md"
  "audio-credits.html"
  "privacy.html"
  "inbox.html"
  "action_badge_core.js"
  "onboarding_gate_core.js"
  "merlin_companion_core.js"
  "uk_bird_expansion_50.js"
  "uk_bird_expansion_2.js"
  "uk_bird_expansion_3.js"
  "uk_bird_expansion_4.js"
  "uk_bird_alias_completion_20260803.js"
  "au_bird_expansion.js"
  "au_bird_expansion_2.js"
  "national_bird_completion_20260715.js"
  "bird_art_release_20260727.js"
  "bird_art_release_20260803.js"
  "bird_art_release_20260901.js"
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
  "assets/ui/burbz-icon-set/stone.svg"
  "assets/ui/burbz-icon-set/profile.webp"
  "assets/ui/burbz-icon-set/settings.webp"
  "assets/ui/burbz-icon-set/camera.webp"
  "assets/ui/burbz-icon-set/sound.webp"
  "assets/ui/burbz-icon-set/inventory.webp"
  "assets/ui/burbz-icon-set/forge.webp"
  "assets/ui/burbz-icon-set/quests.webp"
  "assets/ui/burbz-icon-set/map.webp"
  "assets/ui/burbz-icon-set/empire.webp"
  "assets/ui/burbz-icon-set/birdex.webp"
  "assets/ui/burbz-icon-set/scan.webp"
  "assets/ui/burbz-icon-set/battle.webp"
  "assets/ui/burbz-icon-set/academy.webp"
  "assets/ui/burbz-icon-set/leaderboards.webp"
  "assets/ui/burbz-icon-set/hospital.webp"
  "assets/gear/thorn_talons.webp"
  "assets/gear/bronze_spurs.webp"
  "assets/gear/stormcut_beak.webp"
  "assets/gear/kings_gaff.webp"
  "assets/gear/sunlance_talons.webp"
  "assets/gear/willow_wand.webp"
  "assets/gear/moonlit_charm.webp"
  "assets/gear/runed_crest.webp"
  "assets/gear/merlins_focus.webp"
  "assets/gear/dawnsong_orb.webp"
  "assets/gear/reed_vest.webp"
  "assets/gear/oak_breastplate.webp"
  "assets/gear/feather_mail.webp"
  "assets/gear/warden_plumage.webp"
  "assets/gear/aegis_of_dawn.webp"
  "assets/gear/swift_band.webp"
  "assets/gear/keen_eye_bead.webp"
  "assets/gear/stormglass_anklet.webp"
  "assets/gear/gale_pendant.webp"
  "assets/gear/heart_of_sky.webp"
  "assets/gear/reed_satchel.webp"
  "assets/gear/oakframe_satchel.webp"
  "assets/gear/stormweave_satchel.webp"
  "assets/gear/gilded_satchel.webp"
  "assets/gear/royal_satchel.webp"
  "assets/gear/ember_wisp.webp"
  "assets/gear/mending_light.webp"
  "assets/gear/frost_sigil.webp"
  "assets/gear/tempest_scroll.webp"
  "assets/gear/phoenix_chorus.webp"
  "assets/gear/tonic_of_vigour.webp"
  "assets/gear/nettle_brew.webp"
  "assets/gear/barrier_draught.webp"
  "assets/gear/stormwing_philtre.webp"
  "assets/gear/phoenix_elixir.webp"
  "assets/academy-buildings/library.svg"
  "assets/academy-interiors-manga/aviary-gardens.png"
  "assets/academy-interiors-manga/barracks.png"
  "assets/academy-interiors-manga/crowbar.png"
  "assets/academy-interiors-manga/hospital.png"
  "assets/academy-interiors-manga/kitchen.png"
  "assets/academy-interiors-manga/crowbar-v2-animated-20260819.webp"
  "assets/academy-interiors-manga/kitchen-v2-animated-20260819.webp"
  "assets/academy-interiors-manga/nursery.png"
  "assets/academy-interiors-manga/observatory.png"
  "assets/academy-interiors-manga/quest-roost.png"
  "assets/academy-interiors-manga/roost.png"
  "assets/academy-interiors-manga/training-hall.png"
  "assets/academy-interiors-manga/workshop.png"
  "assets/village-interiors-manga/birders-guild.png"
  "assets/village-interiors-manga/gilded-beak.png"
  "assets/village-interiors-manga/puffins-rest.png"
  "assets/village-interiors-manga/seed-and-sundry.png"
  "assets/village-interiors-manga/talon-and-anvil.png"
  "assets/building-interiors-manga/cabin.webp"
  "assets/building-interiors-manga/hut.webp"
  "assets/building-interiors-manga/farm.webp"
  "assets/building-interiors-manga/well.webp"
  "assets/building-interiors-manga/lumberhut.webp"
  "assets/building-interiors-manga/minehut.webp"
  "assets/building-interiors-manga/cottages.webp"
  "assets/building-interiors-manga/tavern.webp"
  "assets/building-interiors-manga/chapel.webp"
  "assets/building-interiors-manga/lumber.webp"
  "assets/building-interiors-manga/quarry.webp"
  "assets/building-interiors-manga/market.webp"
  "assets/building-interiors-manga/storehouse.webp"
  "assets/building-interiors-manga/foundry.webp"
  "assets/building-interiors-manga/entertainment.webp"
  "assets/building-interiors-manga/plot.webp"
  "assets/audio/reward-level-up.mp3"
  "assets/audio/ui-book.mp3"
  "assets/audio/ui-coins.mp3"
  "assets/audio/ui-lock.mp3"
  "assets/audio/ui-metal.mp3"
  "assets/audio/ui-spell.mp3"
  "assets/audio/ui-wood.mp3"
  "assets/burbz-logo-yaan-transparent-20260608.png"
  "assets/evil-burbz/evil-burb-1.png"
  "assets/evil-burbz/evil-burb-2.png"
  "assets/evil-burbz/evil-burb-3.png"
  "assets/evil-burbz/evil-burb-4.png"
  "assets/merlin-tutorial.png"
  "assets/settlements/settlement-loading-v281.webp"
  "assets/tex/cobble_c.jpg"
  "assets/tex/cobble_n.jpg"
  "assets/tex/grass_c.jpg"
  "assets/tex/grass_n.jpg"
  "assets/ui/merlin-wand-listener.webp"
  "icons/icon-48.png"
  "icons/icon-72.png"
  "icons/icon-96.png"
  "icons/icon-128.png"
  "icons/icon-144.png"
  "icons/icon-152.png"
  "icons/icon-192.png"
  "icons/icon-384.png"
  "icons/icon-512.png"
  "icons/maskable-192.png"
  "icons/maskable-512.png"
  # Backend, not referenced by index.html: server.py imports this package to
  # choose its recogniser. BirdNET V3 (CC BY-SA 4.0) is the default; Perch 2.0
  # and the legacy non-commercial V2.4 path remain selectable. Ship every file
  # or a synced box loses the switch and errors on import.
  "sound_id/__init__.py"
  "sound_id/_audio.py"
  "sound_id/birdnet_v3_provider.py"
  "sound_id/birdnet_provider.py"
  "sound_id/perch_provider.py"
  "sound_id/server_integration.py"
  "sound_id/server_patcher.py"
  "sound_id/selftest.py"
  "sound_id/README.md"
  # The self-test identifies the owl and makes sure the known blackbird
  # confuser never becomes Mistle Thrush, so both fixtures must reach the box.
  "assets/audio/bird-tawny-owl.ogg"
  "assets/audio/bird-blackbird.ogg"
  "data/uk-bird-education-50.json"
  "data/bird-education.json"
  "data/regional-bird-education-20260715.json"
  "data/national-bird-completion/manifest.json"
)

log()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  !\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mxx \033[0m %s\n" "$*" >&2; exit 1; }

BACKEND_FILES=(
  "sound_id/__init__.py"
  "sound_id/_audio.py"
  "sound_id/birdnet_v3_provider.py"
  "sound_id/birdnet_provider.py"
  "sound_id/perch_provider.py"
  "sound_id/server_integration.py"
  "sound_id/server_patcher.py"
  "sound_id/selftest.py"
)

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
# ----------------------------------------------------------------
# 3a. Art comes from a local source, never from GitHub
# ----------------------------------------------------------------
# Preference order: the repo checkout this script sits in (if there is one and
# git-lfs has hydrated it), then the art already on the live server. A file
# found only on the live server needs no staging — it is already in place.
REPO_SRC=""
if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
  candidate="$(cd "$(dirname "${BASH_SOURCE[0]}")/../public/burbz" 2>/dev/null && pwd || true)"
  [[ -n "$candidate" && -f "$candidate/index.html" ]] && REPO_SRC="$candidate"
fi
if [[ -n "$REPO_SRC" ]]; then
  log "Local art source: $REPO_SRC (repo checkout)"
else
  log "Local art source: $ROOT (live directory) — not running from a checkout"
fi

is_lfs_pointer() {
  # A hydrated image is megabytes; a pointer is ~132 bytes of text starting
  # with the spec line. Never let one reach the live site.
  [[ "$(wc -c < "$1")" -le 300 ]] && return 0
  head -c 45 "$1" | grep -q '^version https://git-lfs.github.com/spec/v1' && return 0
  return 1
}

pointer_die() {
  die "$1 is a Git LFS pointer, not an image. git-lfs is not hydrated here.
     Fix it one of these ways, then re-run:
       git lfs install --local && git lfs pull       (in the repo checkout)
       restore from the backup: /var/backups/burbz-art/burbz-art-<date>/
     Refusing to deploy a pointer — the live site is untouched."
}

# Stage one art file from a local source. Files already correct on the live
# server are left alone (nothing to copy). Never downloads.
stage_art_file() {
  local f="$1"
  [[ -n "$f" && -z "${SEEN_ART[$f]:-}" ]] || return 0
  SEEN_ART["$f"]=1
  if [[ -n "$REPO_SRC" && -f "$REPO_SRC/$f" ]]; then
    ! is_lfs_pointer "$REPO_SRC/$f" || pointer_die "$REPO_SRC/$f"
    mkdir -p "$TMP/$(dirname "$f")"
    cp "$REPO_SRC/$f" "$TMP/$f"
    FILES+=("$f")
    ART_STAGED=$((ART_STAGED + 1))
    return 0
  fi
  if [[ -f "$ROOT/$f" ]]; then
    ! is_lfs_pointer "$ROOT/$f" || pointer_die "$ROOT/$f"
    ART_KEPT=$((ART_KEPT + 1))
    return 0
  fi
  die "Art file missing from every local source: $f
     It is in neither the repo checkout nor $ROOT. Restore it from
     /var/backups/burbz-art/burbz-art-<date>/ (or hydrate git-lfs in a
     checkout and re-run). Aborting, live site untouched."
}

declare -A SEEN_ART=()
for managed_file in "${FILES[@]}"; do
  SEEN_ART["$managed_file"]=1
done
ART_STAGED=0
ART_KEPT=0

for f in "${LFS_FILES[@]}"; do
  stage_art_file "$f"
done
curl -fsSL "$BIRDNET_INSTALLER_URL" -o "$TMP/install-birdnet-v3.sh" \
  || die "Download failed: scripts/install-birdnet-v3.sh"
bash -n "$TMP/install-birdnet-v3.sh" \
  || die "Downloaded BirdNET installer failed its shell syntax check"
for script in install-photo-id.sh verify-photo-id.py verify-sound-runtime.py; do
  curl -fsSL "$PHOTO_SCRIPTS_URL/$script" -o "$TMP/$script" || die "Photo proof script download failed: $script"
done
bash -n "$TMP/install-photo-id.sh" || die "Photo installer syntax check failed"
# The two art modules are manifests for the paintings. Enumerate exactly the
# same set the game can request — v204's portrait + transparent-cutout pairs and
# its habitat backgrounds included — and source every one of them locally.
while IFS= read -r art_url; do
  stage_art_file "${art_url#/burbz/}"
done < <(grep -o '/burbz/bird-art-cache/completion-20260726/[^"]*' "$TMP/bird_art_release_20260727.js" | sort -u)

# Index and the service worker also own hundreds of older literal PNG paths.
# Discover them from the staged release so a clean server gets the same art as
# an existing one instead of depending on files left behind by an old deploy.
while IFS= read -r art_url; do
  stage_art_file "${art_url#/burbz/}"
done < <(grep -hoE '/burbz/bird-art-cache/[a-zA-Z0-9_./-]+\.(png|webp)' "$TMP/index.html" "$TMP/sw.js" | sort -u)

while IFS= read -r slug; do
  [[ "$slug" =~ ^[a-z0-9_]+$ ]] || continue
  stage_art_file "bird-art-cache/${slug}_burbz_manga_warrior_20260802.png"
  stage_art_file "bird-art-cache/cutouts/${slug}_burbz_manga_warrior_20260802_cutout.png"
done < <(awk '/const warriorSlugs = new Set\(`/ { capture=1; next } /`\.trim\(\)\.split/ { capture=0 } capture { print }' "$TMP/bird_art_release_20260803.js" | tr '[:space:]' '\n' | sed '/^$/d')

while IFS= read -r art_url; do
  stage_art_file "${art_url#/burbz/}"
done < <(grep -oE '/burbz/bird-art-cache/habitat-backgrounds/[a-z0-9_./-]+' "$TMP/bird_art_release_20260803.js" | sort -u)
log "Staged ${#FILES[@]} files ($ART_STAGED art files copied locally, $ART_KEPT already correct on the server, 0 art downloads)"

# sanity-check before touching the live site
grep -q 'screen-village' "$TMP/index.html"  || die "index.html doesn't contain the village — aborting, live site untouched"
grep -q 'BURBZ_CORE'     "$TMP/sw.js"       || die "sw.js doesn't look right — aborting, live site untouched"
[[ "$(wc -c < "$TMP/lib/three.min.js")" -gt 500000 ]] || die "three.min.js looks truncated — aborting, live site untouched"
for piece in back body wing head; do
  [[ "$(head -c 4 "$TMP/assets/merlin/merlin-$piece.webp")" == "RIFF" ]] \
    || die "Merlin's $piece layer is not a WebP — aborting, live site untouched"
done
# An unhydrated checkout yields the ~130-byte pointer text where the video
# should be — a black intro for every player. Real MP4s are megabytes and carry
# 'ftyp' at byte offset 4. The file is verified wherever it is coming from:
# freshly staged, or already correct on the server.
INTRO_REL="assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4"
INTRO_MP4="$TMP/$INTRO_REL"
[[ -f "$INTRO_MP4" ]] || INTRO_MP4="$ROOT/$INTRO_REL"
[[ -f "$INTRO_MP4" ]] || die "Intro cutscene is in neither the staging area nor $ROOT — aborting, live site untouched"
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
BACKEND_CHANGED=0
for f in "${BACKEND_FILES[@]}"; do
  if [[ ! -f "$ROOT/$f" ]] || ! cmp -s "$TMP/$f" "$ROOT/$f"; then
    BACKEND_CHANGED=1
    break
  fi
done

bash "$TMP/install-photo-id.sh" "$ROOT" "$TMP/photo_id.py" "$TMP/tests/fixtures/photo-v350" "$TMP/verify-photo-id.py" "$TMP/verify-sound-runtime.py" \
  || die "Photo HTTP proof failed; prior adapter restored before publishing the app shell"

for f in "${FILES[@]}"; do
  mkdir -p "$ROOT/$(dirname "$f")"
  mv "$TMP/$f" "$ROOT/$f"
  chown "$OWNER" "$ROOT/$f"
done
log "Installed new Burbz files (owner $OWNER)"

# Python imports are process-cached, and the first V4 rollout may still have an
# unreachable legacy hook in server.py. The transactional installer identifies
# the exact backend/service, patches before app.run, restarts it, and proves
# exact live V3 provenance before this updater may claim success.
if [[ $BACKEND_CHANGED -eq 1 ]]; then
  log "Sound-recognition code changed; installing and proving exact BirdNET V3"
  bash "$TMP/install-birdnet-v3.sh" \
    || die "BirdNET V3 live proof failed; the updater will not report success"
fi

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
