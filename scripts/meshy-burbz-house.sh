#!/usr/bin/env bash
# Make a 3D house for Burbz with Meshy.
#
# Needs MESHY_API_KEY. Meshy only issues API keys on a Pro plan:
#   https://www.meshy.ai/settings/api
#
#   export MESHY_API_KEY="msy_..."
#   scripts/meshy-burbz-house.sh
#
# Cost: 20 credits for the mesh, 10 to texture it. 30 in total.
# Output lands in meshy_output/ at the repo root.
#
# Read MESHY-3D-HOUSE-TEST.md before you spend anything. A .glb cannot
# load in Burbz today — the game ships three.js with no GLTFLoader, and the
# 3D it already has is procedural by design.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILL_DIR="$REPO_ROOT/.agents/skills/meshy-3d-generation"
MESHY="$SKILL_DIR/scripts/meshy_task.py"

# A cottage that matches the villages Burbz already draws: warm ochre walls,
# dark timber, a steep thatched roof, a crooked chimney.
PROMPT="${1:-A cosy storybook village cottage, hand-painted fantasy game art. Warm ochre plaster walls with dark timber framing, a steep thatched roof, a crooked stone chimney, small shuttered windows, a round wooden door, a hanging lantern by the porch. Clean low-poly shapes, soft painted textures, no ground plane.}"

if [ ! -f "$MESHY" ]; then
  echo "Meshy skill missing. Run: npx skills add meshy-dev/meshy-3d-agent" >&2
  exit 1
fi

cd "$REPO_ROOT"

echo "== Checking the key =="
if ! python3 "$MESHY" check-env; then
  cat >&2 <<'MSG'

No Meshy API key. Meshy only issues keys on a Pro plan.

  1. Subscribe:  https://www.meshy.ai/pricing
  2. Make a key: https://www.meshy.ai/settings/api
  3. Then run:

       export MESHY_API_KEY="msy_..."
       scripts/meshy-burbz-house.sh

MSG
  exit 1
fi

echo
echo "== Balance =="
python3 "$MESHY" balance

cat <<EOF

== Plan ==
  1. Preview  — build the mesh          20 credits
  2. Refine   — texture it with PBR     10 credits
  3. Download the .glb                   0 credits
                                        --
                                        30 credits

Prompt:
$PROMPT

EOF

if [ "${1:-}" != "--yes" ] && [ "${2:-}" != "--yes" ]; then
  read -r -p "Spend 30 credits? [y/N] " reply
  case "$reply" in [yY]*) ;; *) echo "Stopped. Nothing spent."; exit 0 ;; esac
fi

echo "== Preview =="
PREVIEW_ID=$(python3 "$MESHY" create --endpoint /openapi/v2/text-to-3d --payload "$(
  python3 - "$PROMPT" <<'PY'
import json, sys
print(json.dumps({
    "mode": "preview",
    "prompt": sys.argv[1],
    "ai_model": "latest",
    "topology": "triangle",
    "target_polycount": 8000,
    "should_remesh": True,
}))
PY
)")
echo "Preview task: $PREVIEW_ID"

PROJECT_DIR=$(python3 "$MESHY" project-dir --task-id "$PREVIEW_ID" --prompt "burbz-house")
python3 "$MESHY" poll --endpoint /openapi/v2/text-to-3d --task-id "$PREVIEW_ID" --project-dir "$PROJECT_DIR" --timeout 600
python3 "$MESHY" download --task-json "$PROJECT_DIR/task_$PREVIEW_ID.json" --format glb --output "$PROJECT_DIR/preview.glb"
python3 "$MESHY" record --project-dir "$PROJECT_DIR" --task-id "$PREVIEW_ID" --task-type text-to-3d --stage preview --files preview.glb
python3 "$MESHY" thumbnail --project-dir "$PROJECT_DIR" --task-json "$PROJECT_DIR/task_$PREVIEW_ID.json"

echo "== Refine =="
REFINE_ID=$(python3 "$MESHY" create --endpoint /openapi/v2/text-to-3d --payload "$(
  python3 - "$PREVIEW_ID" <<'PY'
import json, sys
print(json.dumps({
    "mode": "refine",
    "preview_task_id": sys.argv[1],
    "ai_model": "latest",
    "enable_pbr": True,
    "texture_resolution": "2k",
    "texture_prompt": "hand-painted storybook cottage, warm ochre plaster, dark timber beams, golden thatch",
}))
PY
)")
echo "Refine task: $REFINE_ID"

python3 "$MESHY" poll --endpoint /openapi/v2/text-to-3d --task-id "$REFINE_ID" --project-dir "$PROJECT_DIR" --timeout 600
python3 "$MESHY" download --task-json "$PROJECT_DIR/task_$REFINE_ID.json" --format glb --output "$PROJECT_DIR/house.glb"
python3 "$MESHY" record --project-dir "$PROJECT_DIR" --task-id "$REFINE_ID" --task-type text-to-3d --stage refined --files house.glb

echo
echo "== Done =="
ls -lh "$PROJECT_DIR"
python3 "$MESHY" balance
