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
SOURCE_CLIP="${BURBZ_CLIP:-/home/ubuntu/yaanbatho/burbz/assets/audio/bird-tawny-owl.ogg}"
CLIP="$SOURCE_CLIP"
PROOF_CLIP=""
BACKUP="/tmp/burbz-sound.env.prove-$$"
EXPECTED_MODEL_SHA256="69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24"
EXPECTED_LABELS_SHA256="8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0"
EXPECTED_GEO_MODEL_SHA256="2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017"
EXPECTED_GEO_LABELS_SHA256="c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784"
EXPECTED_SCORE_BLACKLIST_SHA256="a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366"
EXPECTED_POLICY_VERSION="burbz-v3-temporal-20260729.2"
EXPECTED_INTEGRATION_VERSION=4

log()  { printf "\n\033[1;36m==> %s\033[0m\n" "$*"; }
ok()   { printf "\033[1;32m  ✔\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  !\033[0m %s\n" "$*"; }
bad()  { printf "\033[1;31m  ✘\033[0m %s\n" "$*"; }

restore() {
  if [[ -n "$PROOF_CLIP" && -f "$PROOF_CLIP" ]]; then
    rm -f -- "$PROOF_CLIP"
  fi
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
[[ -f "$SOURCE_CLIP" ]] || { bad "Reference clip not found: $SOURCE_CLIP"; exit 1; }

# The default owl file is only 2.2 seconds. Current V3 policy deliberately
# refuses an ordinary single-window score, so test the same repeated 12-second
# shape that the continuous browser listener uploads.
if [[ -z "${BURBZ_CLIP:-}" ]]; then
  PROOF_CLIP="$(mktemp /tmp/burbz-tawny-proof.XXXXXX.wav)"
  python3 - "$SOURCE_CLIP" "$PROOF_CLIP" <<'PY'
import sys
import numpy as np
import soundfile

source, destination = sys.argv[1:3]
data, rate = soundfile.read(source, dtype="float32", always_2d=True)
mono = data.mean(axis=1)
gap = np.zeros(int(rate * 0.8), dtype=np.float32)
blocks = []
while sum(block.size for block in blocks) < int(rate * 12):
    blocks.extend((mono, gap))
soundfile.write(
    destination,
    np.concatenate(blocks)[:int(rate * 12)],
    rate,
    subtype="PCM_16",
)
PY
  CLIP="$PROOF_CLIP"
fi

scan() { curl -sS -m 90 -F "audio=@$CLIP" -F "lat=51.5" -F "lon=-0.13" "$PUBLIC_URL" 2>/dev/null; }
found_owl() { echo "${1:-}" | grep -qi "Strix aluco\|Tawny Owl"; }
require_exact_provenance() {
  printf "%s" "${1:-}" | python3 -c '
import json
import sys

try:
    payload = json.load(sys.stdin)
except Exception as exc:
    print(f"invalid JSON response: {exc}", file=sys.stderr)
    raise SystemExit(1)

expected = {
    "provider": "birdnetv3",
    "configuredProvider": "birdnetv3",
    "fallbackUsed": False,
    "providerVerified": True,
    "modelSha256": sys.argv[1],
    "labelsSha256": sys.argv[2],
    "geoModelSha256": sys.argv[3],
    "geoLabelsSha256": sys.argv[4],
    "scoreBlacklistSha256": sys.argv[5],
    "policyVersion": sys.argv[6],
    "serverIntegrationVersion": int(sys.argv[7]),
}
wrong = {
    key: {"actual": payload.get(key), "expected": value}
    for key, value in expected.items()
    if payload.get(key) != value
}
if wrong:
    print("exact provenance mismatch: " + json.dumps(wrong, sort_keys=True), file=sys.stderr)
    raise SystemExit(1)
' "$EXPECTED_MODEL_SHA256" "$EXPECTED_LABELS_SHA256" \
    "$EXPECTED_GEO_MODEL_SHA256" "$EXPECTED_GEO_LABELS_SHA256" \
    "$EXPECTED_SCORE_BLACKLIST_SHA256" "$EXPECTED_POLICY_VERSION" \
    "$EXPECTED_INTEGRATION_VERSION"
}

# ----------------------------------------------------------------
log "1/4  Baseline — the reference tawny owl at the normal threshold"
# ----------------------------------------------------------------
BASE="$(scan)"
echo "  $(echo "$BASE" | head -c 170)"
if [[ -z "$BASE" ]]; then
  bad "The endpoint did not answer. Is the site up?"; exit 1
fi
if ! require_exact_provenance "$BASE"; then
  bad "The endpoint did not prove the exact reviewed V3 build."
  exit 1
fi
ok "exact acoustic, labels, geo, blacklist, policy and integration provenance verified"
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
if [[ -n "$RAISED" ]] && ! require_exact_provenance "$RAISED"; then
  bad "The second response lost or changed exact V3 provenance."
  exit 1
fi

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
