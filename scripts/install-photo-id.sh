#!/usr/bin/env bash
# Promote the photo adapter before the app shell. A failed HTTP proof restores
# the exact prior module and restarts the prior backend; no frontend is copied.
set -euo pipefail
ROOT=${1:?game webroot required}
SOURCE=${2:?staged photo_id.py required}
FIXTURES=${3:?staged fixture directory required}
PROOF=${4:?verification script required}
SOUND_PROOF=${5:?sound runtime verification required}
SERVICE=${BURBZ_SERVICE:-burbz}
ORIGIN=${BURBZ_BACKEND_ORIGIN:-http://127.0.0.1:5055}
PYTHON="$ROOT/venv/bin/python3"
[[ -f "$ROOT/server.py" && -x "$PYTHON" && -f "$SOURCE" && -f "$PROOF" && -f "$SOUND_PROOF" ]] || { echo 'Photo promotion inputs missing' >&2; exit 1; }
[[ "$(systemctl show "$SERVICE" -p WorkingDirectory --value)" == "$ROOT" ]] || { echo 'Photo service webroot mismatch' >&2; exit 1; }
SOURCE_HASH=$(sha256sum "$SOURCE" | cut -d' ' -f1)
if [[ -f "$ROOT/photo_id.py" ]] && cmp -s "$SOURCE" "$ROOT/photo_id.py" && [[ "$(cat "$ROOT/.photo-deployed-sha256" 2>/dev/null || true)" == "$SOURCE_HASH" ]]; then exit 0; fi
"$PYTHON" - "$SOURCE" <<'PY'
import pathlib,sys
compile(pathlib.Path(sys.argv[1]).read_text(),sys.argv[1],'exec')
PY
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$ROOT/.photo-deploy-backups"
BACKUP=$(mktemp -d "$ROOT/.photo-deploy-backups/$STAMP.XXXXXX")
HAD_OLD=0
if [[ -f "$ROOT/photo_id.py" ]]; then cp -p "$ROOT/photo_id.py" "$BACKUP/photo_id.py"; HAD_OLD=1; fi
rollback(){
  local status=$?
  if [[ $status -ne 0 ]]; then
    if [[ $HAD_OLD -eq 1 ]]; then cp -p "$BACKUP/photo_id.py" "$ROOT/photo_id.py"; else rm -f "$ROOT/photo_id.py"; fi
    systemctl restart "$SERVICE" || true
    echo "Photo proof failed; prior module restored from $BACKUP" >&2
  fi
}
trap rollback EXIT
cp "$SOURCE" "$ROOT/photo_id.py"
chown --reference="$ROOT/server.py" "$ROOT/photo_id.py"
systemctl restart "$SERVICE"
ready=0
for attempt in $(seq 1 30); do
  if curl -fsS --max-time 2 "$ORIGIN/api/health" >/dev/null; then ready=1; break; fi
  sleep 1
done
[[ $ready -eq 1 ]] || { echo 'Photo backend did not become healthy' >&2; exit 1; }
"$PYTHON" "$PROOF" --origin "$ORIGIN" --fixtures "$FIXTURES" --output "$BACKUP/proof.json"
"$PYTHON" "$SOUND_PROOF" --origin "$ORIGIN" --root "$ROOT" --output "$BACKUP/sound-proof.json"
sha256sum "$ROOT/photo_id.py" > "$BACKUP/installed.sha256"
printf '%s\n' "$SOURCE_HASH" > "$ROOT/.photo-deployed-sha256.new"
mv -f "$ROOT/.photo-deployed-sha256.new" "$ROOT/.photo-deployed-sha256"
trap - EXIT
echo "Photo adapter restarted and HTTP proof passed; rollback copy: $BACKUP"
