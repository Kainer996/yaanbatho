#!/usr/bin/env bash
# ===============================================================
# Burbz — prove which recogniser answers a real scan
# ---------------------------------------------------------------
# BirdNET V3's weights are CC BY-SA 4.0 and may be used commercially. V2.4's
# are CC BY-NC-SA 4.0 and may not. Both can be installed at once, so "V3 is
# installed" is not the question that matters — "V3 answered this scan" is.
#
# This runs a differential test the installed engine cannot fake: it raises V3's
# confidence threshold above the reference recording's score and asks the live
# endpoint again. Only a server running V3 changes its answer.
#
# Everything it changes is restored before it exits, including on failure.
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/prove-birdnet-v3.sh \
#     | sudo bash
# ===============================================================

set -uo pipefail

ENV_FILE="${BURBZ_ENV_FILE:-/etc/burbz-sound.env}"
PUBLIC_URL="${BURBZ_PUBLIC_URL:-https://yaanbatho.com/burbz/api/identify/sound}"
SERVICE="${BURBZ_SERVICE:-burbz}"
CLIP="${BURBZ_CLIP:-/home/ubuntu/yaanbatho/burbz/assets/audio/bird-tawny-owl.ogg}"
BACKUP="/tmp/burbz-sound.env.prove-$$"

log()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m  ✔\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  !\033[0m %s\n" "$*"; }
bad()  { printf "\033[1;31m  ✘\033[0m %s\n" "$*"; }

restore() {
  if [[ -f "$BACKUP" ]]; then
    cp "$BACKUP" "$ENV_FILE"
    rm -f "$BACKUP"
    systemctl restart "$SERVICE" >/dev/null 2>&1
    printf "\033[2m  (settings restored, %s restarted)\033[0m\n" "$SERVICE"
  fi
}
trap restore EXIT INT TERM

[[ $EUID -eq 0 ]] || { bad "Run with sudo."; exit 1; }
[[ -f "$ENV_FILE" ]] || { bad "$ENV_FILE not found — run install-birdnet-v3.sh first."; exit 1; }
[[ -f "$CLIP" ]] || { bad "Reference clip not found: $CLIP"; exit 1; }

scan() { curl -sS -m 90 -F "audio=@$CLIP" -F "lat=51.5" -F "lon=-0.13" "$PUBLIC_URL" 2>/dev/null; }
found_owl() { echo "${1:-}" | grep -qi "Strix aluco\|Tawny Owl"; }

# ----------------------------------------------------------------
log "1/4  Baseline — the reference tawny owl at the normal threshold"
# ----------------------------------------------------------------
BASE="$(scan)"
echo "  $(echo "$BASE" | head -c 170)"
if [[ -z "$BASE" ]]; then
  bad "The endpoint did not answer. Is the site up?"; exit 1
fi
if ! found_owl "$BASE"; then
  warn "The reference clip was not identified even at the normal threshold."
  warn "Fix that first — this test needs a working baseline."
  exit 1
fi
ok "identified, so there is something to compare against"

# ----------------------------------------------------------------
log "2/4  Raising V3's confidence threshold above the owl's score"
# ----------------------------------------------------------------
cp "$ENV_FILE" "$BACKUP"
if grep -q "^BURBZ_BIRDNET_V3_MIN_CONFIDENCE=" "$ENV_FILE"; then
  sed -i 's/^BURBZ_BIRDNET_V3_MIN_CONFIDENCE=.*/BURBZ_BIRDNET_V3_MIN_CONFIDENCE=0.99/' "$ENV_FILE"
else
  echo "BURBZ_BIRDNET_V3_MIN_CONFIDENCE=0.99" >> "$ENV_FILE"
fi
systemctl restart "$SERVICE" || { bad "restart failed"; exit 1; }
sleep 6
ok "threshold set to 0.99 and $SERVICE restarted"

# ----------------------------------------------------------------
log "3/4  Asking the live endpoint the same question again"
# ----------------------------------------------------------------
RAISED="$(scan)"
echo "  $(echo "$RAISED" | head -c 170)"

# ----------------------------------------------------------------
log "4/4  Verdict"
# ----------------------------------------------------------------
if [[ -z "$RAISED" ]]; then
  warn "no answer on the second scan — inconclusive, try again"
  VERDICT="unknown"
elif found_owl "$RAISED"; then
  VERDICT="v2"
else
  VERDICT="v3"
fi

# The engine also announces itself the first time it serves a scan.
ANNOUNCE="$(journalctl -u "$SERVICE" --no-pager --since "-10 min" 2>/dev/null \
             | grep -i "Burbz sound scan served by" | tail -2)"
[[ -n "$ANNOUNCE" ]] && { echo; echo "  From the service log:"; echo "$ANNOUNCE" | sed 's/^/    /'; }

echo
case "$VERDICT" in
  v3)
    printf "\033[1;32m=================================================================\033[0m\n"
    printf "\033[1;32m  BirdNET V3 IS SERVING YOUR SCANS\033[0m\n"
    printf "\033[1;32m=================================================================\033[0m\n"
    cat <<'EOF'

  Raising V3's threshold changed the answer, which only a server running V3
  can do. Your live sound identification runs on CC BY-SA 4.0 weights.

  You may charge for this game. Keep the "Powered by BirdNET" credit on
  /burbz/audio-credits.html, and do not fine-tune the weights or train a
  classifier on their embeddings without accepting CC BY-SA on the result.
EOF
    ;;
  v2)
    printf "\033[1;31m=================================================================\033[0m\n"
    printf "\033[1;31m  V2.4 IS STILL SERVING — DO NOT MONETISE YET\033[0m\n"
    printf "\033[1;31m=================================================================\033[0m\n"
    cat <<'EOF'

  The answer did not change when V3's threshold was raised, so V3 is installed
  but not answering. Those weights are NonCommercial.

  This is a wiring problem, not a licensing one, and it is fixable. Send this
  output back along with:

    sed -n '1440,1470p' /home/ubuntu/yaanbatho/burbz/server.py
EOF
    ;;
  *)
    printf "\033[1;33m  Inconclusive — please run it once more.\033[0m\n"
    ;;
esac
echo
