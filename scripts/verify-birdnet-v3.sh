#!/usr/bin/env bash
# ===============================================================
# Burbz — which recogniser is actually answering a live scan?
# ---------------------------------------------------------------
# Installing V3 and having V3 serve requests are two different things. The
# installer wires server.py by re-binding two module-level helpers, which does
# nothing if the handler calls an analyzer object instead — it compiles, it
# reports success, and V2.4 keeps answering. V2.4's weights are CC BY-NC-SA 4.0
# (NonCommercial), so that difference decides whether the game can be sold.
#
# This script only reads and reports. It changes nothing, restarts nothing.
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/verify-birdnet-v3.sh \
#     | sudo bash
# ===============================================================

set -uo pipefail

SERVER_PY="${BURBZ_SERVER_PY:-}"
PUBLIC_URL="${BURBZ_PUBLIC_URL:-https://yaanbatho.com/burbz/api/identify/sound}"

log()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m  ✔\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  !\033[0m %s\n" "$*"; }
bad()  { printf "\033[1;31m  ✘\033[0m %s\n" "$*"; }

is_archived_path() {
  case "$1" in *backup*|*backups*|*.bak*|*/tmp/*|*old/*|*-snapshot*|*/.git/*) return 0 ;; *) return 1 ;; esac
}

find_server_py() {
  [[ -n "$SERVER_PY" ]] && { echo "$SERVER_PY"; return; }
  local pid cwd argument
  for pid in $(pgrep -f "server\.py" 2>/dev/null || true); do
    [[ -r "/proc/$pid/cmdline" ]] || continue
    cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    while IFS= read -r argument; do
      case "$argument" in
        *server.py)
          [[ "$argument" == /* && -f "$argument" ]] && { echo "$argument"; return; }
          [[ -n "$cwd" && -f "$cwd/${argument#./}" ]] && { readlink -f "$cwd/${argument#./}"; return; }
          ;;
      esac
    done < <(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null || true)
  done
  local candidate
  while IFS= read -r candidate; do
    is_archived_path "$candidate" && continue
    grep -q "identify/sound" "$candidate" 2>/dev/null && { echo "$candidate"; return; }
  done < <(find /home /opt /srv /var/www -maxdepth 6 -name server.py 2>/dev/null | head -100)
}

TARGET="$(find_server_py)"
[[ -n "$TARGET" ]] || { bad "Could not find server.py"; exit 1; }

log "Backend"
echo "  $TARGET"

# ----------------------------------------------------------------
log "How the sound handler is wired"
# ----------------------------------------------------------------
printf "  \033[2m(these lines are what decides whether the V3 wiring engages)\033[0m\n"
grep -n "sound_id\|_analyse_recording\|_aggregate_sound_detections\|[Aa]nalyzer\|[Aa]nalyser\|identify/sound" \
  "$TARGET" 2>/dev/null | head -40 | sed 's/^/  /'

# ----------------------------------------------------------------
log "Wiring signatures"
# ----------------------------------------------------------------
for pattern in "BURBZ-BIRDNET-V3-BEGIN:installer block marker" \
               "_burbz_sound_id:installer block body" \
               "sound_id.analyse:any call into the V3 package" \
               "tflite\|TFLite\|BirdNET_GLOBAL\|MData\|labels.txt:V2.4 model artefacts"; do
  needle="${pattern%%:*}"; label="${pattern##*:}"
  # grep -c prints 0 *and* exits non-zero when there is no match, so a
  # "|| echo 0" fallback would print the count twice.
  count="$(grep -c "$needle" "$TARGET" 2>/dev/null | head -1)"
  printf "  %-34s %s\n" "$label" "${count:-0}"
done

# ----------------------------------------------------------------
log "Is a V2.4 model still on the box?"
# ----------------------------------------------------------------
found_v2=0
while IFS= read -r hit; do
  found_v2=1; echo "  $hit"
done < <(find /home /opt /srv /var/www -maxdepth 7 \
           \( -iname "*BirdNET*MODEL*.tflite" -o -iname "*BirdNET_GLOBAL*" -o -iname "*.tflite" \) \
           2>/dev/null | grep -iv geomodel | head -10)
[[ $found_v2 -eq 0 ]] && ok "no V2.4 .tflite model found" \
  || warn "V2.4 model files are present — if these are being served, the build is NonCommercial"

# ----------------------------------------------------------------
log "Does the live endpoint respond to location?"
# ----------------------------------------------------------------
# The V3 range filter puts a tawny owl at 0.976 in London and 0.000 in Sydney.
# If the same clip returns the same answer for both, either the filter is off
# or V3 is not the engine answering.
CLIP="$(dirname "$TARGET")/assets/audio/bird-tawny-owl.ogg"
if [[ ! -f "$CLIP" ]]; then
  warn "reference clip not found at $CLIP — skipping"
else
  london="$(curl -sS -m 90 -F "audio=@$CLIP" -F "lat=51.5"   -F "lon=-0.13"  "$PUBLIC_URL" 2>/dev/null)"
  sydney="$(curl -sS -m 90 -F "audio=@$CLIP" -F "lat=-33.87" -F "lon=151.21" "$PUBLIC_URL" 2>/dev/null)"
  echo "  London : $(echo "$london" | head -c 160)"
  echo "  Sydney : $(echo "$sydney" | head -c 160)"
  if [[ -z "$london" ]]; then
    warn "endpoint unreachable from the box"
  elif [[ "$london" == "$sydney" ]]; then
    bad "identical for both locations — the range filter is NOT active"
  else
    ok "results differ by location — the range filter IS active, so V3 is serving"
  fi
fi

# ----------------------------------------------------------------
log "Can the box run V3 at all?"
# ----------------------------------------------------------------
SOUND_DIR="$(dirname "$TARGET")"
[[ -d "$SOUND_DIR/sound_id" ]] || SOUND_DIR="$(dirname "$(find /home /opt /srv /var/www -maxdepth 6 -type d -name sound_id 2>/dev/null | head -1)")"
if [[ -d "$SOUND_DIR/sound_id" ]]; then
  ( cd "$SOUND_DIR" && BURBZ_SOUND_MODEL=birdnetv3 python3 -m sound_id.selftest 2>&1 | tail -12 | sed 's/^/  /' )
else
  warn "sound_id package not found"
fi

log "What to send back"
cat <<'EOF'
  Copy everything above. It says which engine is answering a live scan, which
  is what decides whether the game can be sold — V2.4's weights are
  NonCommercial, V3's are not.
EOF
