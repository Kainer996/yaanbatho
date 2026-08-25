#!/usr/bin/env bash
# ===============================================================
# check-burbz-art-on-vps.sh — verify every bird-art URL the game
# can request is served by the VPS as real image bytes.
# ---------------------------------------------------------------
# Enumerates the complete referenced art set:
#   - literal /burbz/bird-art-cache/... paths in index.html and sw.js
#     (BUILT_IN_BIRD_ART, the RPG map, MAP_BIRD_CUTOUT_ART, placeholders)
#   - the art maps in every expansion/completion/art-release module
#   - the manga-warrior paintings + cutouts derived from the slug list
#     in bird_art_release_20260803.js
#   - the habitat backgrounds
#   - every derived cutout name (file.png -> cutouts/file_cutout.png,
#     the birdCutoutUrlFor rule) — these are best-effort in the game
#     (fallbacks exist) and are reported separately.
#
# Each URL is HEAD-requested against $BASE (default https://yaanbatho.com).
# A file is OK when it answers 200 with Content-Length > 300 bytes
# (a Git LFS pointer is ~132 bytes, so a pointer can never pass).
#
# Usage:
#   bash scripts/check-burbz-art-on-vps.sh
#   BASE=https://yaanbatho.com REPORT=/tmp/report.tsv bash scripts/check-burbz-art-on-vps.sh
#
# Exit status: 0 when every REQUIRED file is present; 1 otherwise.
# Missing best-effort cutouts are reported but do not fail the check.
# ===============================================================
set -euo pipefail

BASE="${BASE:-https://yaanbatho.com}"
SRC="${SRC:-$(cd "$(dirname "$0")/../public/burbz" && pwd)}"
STAMP="$(date +%Y%m%d-%H%M%S)"
REPORT="${REPORT:-/tmp/burbz-art-check-$STAMP.tsv}"
JOBS="${JOBS:-12}"

cd "$SRC"

ART_SOURCES=(
  index.html
  sw.js
  uk_bird_expansion_50.js
  uk_bird_expansion_2.js
  uk_bird_expansion_3.js
  uk_bird_expansion_4.js
  au_bird_expansion.js
  au_bird_expansion_2.js
  national_bird_completion_20260715.js
  uk_bird_alias_completion_20260803.js
  bird_art_release_20260727.js
  bird_art_release_20260803.js
)

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# 1. Every literal art path in the page, the service worker and the modules.
grep -hoE '/burbz/bird-art-cache/[A-Za-z0-9_./-]+\.(png|webp|jpg|jpeg)' \
  "${ART_SOURCES[@]}" | sort -u > "$TMP/literal.txt"

# 2. Manga-warrior paintings are built from a slug list, not literal paths.
awk '/const warriorSlugs = new Set\(`/ { capture=1; next } /`\.trim\(\)\.split/ { capture=0 } capture { print }' \
    bird_art_release_20260803.js | tr '[:space:]' '\n' | sed '/^$/d' | \
  while IFS= read -r slug; do
    [[ "$slug" =~ ^[a-z0-9_]+$ ]] || continue
    echo "/burbz/bird-art-cache/${slug}_burbz_manga_warrior_20260802.png"
  done | sort -u > "$TMP/warrior.txt"

sort -u "$TMP/literal.txt" "$TMP/warrior.txt" > "$TMP/required.txt"

# 3. Derived cutouts (birdCutoutUrlFor: any bird painting file.png ->
#    /burbz/bird-art-cache/cutouts/file_cutout.png). Best-effort: the game
#    falls back to the painting or an emoji when a cutout 404s.
grep -E '\.png$' "$TMP/required.txt" | \
  grep -v '/cutouts/' | grep -v '/habitat-backgrounds/' | \
  sed -E 's#^.*/([^/]+)\.png$#/burbz/bird-art-cache/cutouts/\1_cutout.png#' | \
  sort -u > "$TMP/derived.txt"
# Drop derived names that are already literally referenced.
comm -23 "$TMP/derived.txt" "$TMP/required.txt" > "$TMP/cutouts.txt"

req_n="$(wc -l < "$TMP/required.txt")"
cut_n="$(wc -l < "$TMP/cutouts.txt")"
echo "==> Checking $req_n required art files + $cut_n derived cutouts against $BASE"

check_urls() {
  # stdin: one path per line; stdout: status<TAB>bytes<TAB>path
  xargs -P "$JOBS" -I{} bash -c '
    path="$1"; base="$2"
    head="$(curl -sI --max-time 30 "$base$path" 2>/dev/null || true)"
    status="$(printf "%s" "$head" | awk "NR==1{print \$2}")"
    length="$(printf "%s" "$head" | tr -d "\r" | awk "tolower(\$1)==\"content-length:\"{print \$2}" | tail -1)"
    printf "%s\t%s\t%s\n" "${status:-000}" "${length:-0}" "$path"
  ' _ {} "$BASE"
}

check_urls < "$TMP/required.txt" > "$TMP/required.out"
check_urls < "$TMP/cutouts.txt"  > "$TMP/cutouts.out"

{
  echo -e "kind\tstatus\tbytes\tpath"
  awk -F'\t' '{print "required\t"$0}' "$TMP/required.out"
  awk -F'\t' '{print "cutout\t"$0}' "$TMP/cutouts.out"
} > "$REPORT"

# 200 with more than 300 bytes = real image; anything else is a gap.
awk -F'\t' '$1 != 200 || $2 <= 300 {print $3}' "$TMP/required.out" | sort > "$TMP/required.missing"
awk -F'\t' '$1 != 200 || $2 <= 300 {print $3}' "$TMP/cutouts.out"  | sort > "$TMP/cutouts.missing"

miss_req="$(wc -l < "$TMP/required.missing")"
miss_cut="$(wc -l < "$TMP/cutouts.missing")"

echo "==> Report: $REPORT"
echo "==> Required art:    $((req_n - miss_req))/$req_n present"
echo "==> Derived cutouts: $((cut_n - miss_cut))/$cut_n present (best-effort)"

if [[ "$miss_cut" -gt 0 ]]; then
  echo "  ! Missing derived cutouts (game falls back to painting/emoji):"
  sed 's/^/      /' "$TMP/cutouts.missing"
fi
if [[ "$miss_req" -gt 0 ]]; then
  echo "xx MISSING required art files:"
  sed 's/^/      /' "$TMP/required.missing"
  cp "$TMP/required.missing" "${REPORT%.tsv}.missing.txt"
  echo "xx Written to ${REPORT%.tsv}.missing.txt"
  exit 1
fi
echo "==> All required art is served by $BASE with real image bytes."
