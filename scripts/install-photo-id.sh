#!/usr/bin/env bash
# Promote the photo adapter before the app shell. A failed HTTP proof restores
# the exact prior module and restarts the prior backend; no frontend is copied.
set -euo pipefail
ROOT=${1:?game webroot required}
SOURCE=${2:?staged photo_id.py required}
FIXTURES=${3:?staged fixture directory required}
PROOF=${4:?verification script required}
SOUND_PROOF=${5:?sound runtime verification required}
# Older installed sync scripts pass five arguments. The staged worker sits
# beside the adapter in that same immutable checkout; never use a live copy.
SOURCE_DIR=$(dirname -- "$SOURCE")
WORKER_SOURCE=${6:-$SOURCE_DIR/photo_local.py}
LOCAL_RUNTIME=${BURBZ_LOCAL_PHOTO_RUNTIME:-/opt/burbz-photo}
WORKER_UNIT=/etc/systemd/system/burbz-photo.service
SERVICE=${BURBZ_SERVICE:-burbz}
ORIGIN=${BURBZ_BACKEND_ORIGIN:-http://127.0.0.1:5055}
PYTHON="$ROOT/venv/bin/python3"
[[ -f "$ROOT/server.py" && -x "$PYTHON" && -f "$SOURCE" && -f "$PROOF" && -f "$SOUND_PROOF" && -f "$WORKER_SOURCE" ]] || { echo 'Photo promotion inputs missing' >&2; exit 1; }
[[ -x "$LOCAL_RUNTIME/venv/bin/python" && -f "$LOCAL_RUNTIME/models/manifest.json" ]] || { echo 'Provision the isolated free photo runtime first; see LOCAL_PHOTO_V393.md' >&2; exit 1; }
[[ "$LOCAL_RUNTIME" =~ ^/[a-zA-Z0-9/_-]+$ ]] || { echo 'Invalid local runtime path' >&2; exit 1; }
[[ "$(systemctl show "$SERVICE" -p WorkingDirectory --value)" == "$ROOT" ]] || { echo 'Photo service webroot mismatch' >&2; exit 1; }
SOURCE_HASH=$(sha256sum "$SOURCE" | cut -d' ' -f1)
WORKER_HASH=$(sha256sum "$WORKER_SOURCE" | cut -d' ' -f1)
if [[ -f "$ROOT/photo_id.py" ]] && cmp -s "$SOURCE" "$ROOT/photo_id.py" && [[ "$(cat "$ROOT/.photo-deployed-sha256" 2>/dev/null || true)" == "$SOURCE_HASH:$WORKER_HASH" ]] && systemctl is-active --quiet burbz-photo; then exit 0; fi
"$PYTHON" - "$SOURCE" <<'PY'
import pathlib,sys
compile(pathlib.Path(sys.argv[1]).read_text(),sys.argv[1],'exec')
PY
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$ROOT/.photo-deploy-backups"
BACKUP=$(mktemp -d "$ROOT/.photo-deploy-backups/$STAMP.XXXXXX")
HAD_OLD=0
HAD_WORKER=0
WORKER_WAS_ACTIVE=0
WORKER_WAS_ENABLED=0
systemctl is-active --quiet burbz-photo && WORKER_WAS_ACTIVE=1
systemctl is-enabled --quiet burbz-photo && WORKER_WAS_ENABLED=1
if [[ -f "$WORKER_UNIT" ]]; then cp -p "$WORKER_UNIT" "$BACKUP/burbz-photo.service"; HAD_WORKER=1; fi
if [[ -f "$ROOT/photo_id.py" ]]; then cp -p "$ROOT/photo_id.py" "$BACKUP/photo_id.py"; HAD_OLD=1; fi
rollback(){
  local status=$?
  if [[ $status -ne 0 ]]; then
    systemctl stop burbz-photo || true
    if [[ $WORKER_WAS_ENABLED -eq 0 ]]; then systemctl disable burbz-photo || true; fi
    if [[ $HAD_WORKER -eq 1 ]]; then
      cp -p "$BACKUP/burbz-photo.service" "$WORKER_UNIT"
    else
      systemctl disable burbz-photo || true
      # Keep failed unit reviewable, rather than deleting it.
      if [[ -f "$WORKER_UNIT" ]]; then mv "$WORKER_UNIT" "$BACKUP/failed-burbz-photo.service"; fi
    fi
    systemctl daemon-reload || true
    if [[ $WORKER_WAS_ACTIVE -eq 1 ]]; then systemctl start burbz-photo || true; fi
    if [[ $HAD_OLD -eq 1 ]]; then cp -p "$BACKUP/photo_id.py" "$ROOT/photo_id.py"; else rm -f "$ROOT/photo_id.py"; fi
    systemctl restart "$SERVICE" || true
    echo "Photo proof failed; prior module restored from $BACKUP" >&2
  fi
}
trap rollback EXIT
WORKER_RELEASE="$LOCAL_RUNTIME/releases/$WORKER_HASH"
mkdir -p "$WORKER_RELEASE"
cp "$WORKER_SOURCE" "$WORKER_RELEASE/photo_local.py"
chmod 755 "$LOCAL_RUNTIME" "$LOCAL_RUNTIME/releases" "$WORKER_RELEASE"
chmod 644 "$WORKER_RELEASE/photo_local.py"
SERVICE_USER=$(systemctl show "$SERVICE" -p User --value)
SERVICE_USER=${SERVICE_USER:-root}
SERVICE_GROUP=$(id -gn "$SERVICE_USER")
cat > "$WORKER_UNIT" <<UNIT
[Unit]
Description=Burbz offline bird photo recognition
After=local-fs.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
ExecStart=$LOCAL_RUNTIME/venv/bin/python $WORKER_RELEASE/photo_local.py --models $LOCAL_RUNTIME/models --socket /run/burbz-photo/recognizer.sock
RuntimeDirectory=burbz-photo
RuntimeDirectoryMode=0750
Environment=HF_HUB_OFFLINE=1
Environment=PYTHONDONTWRITEBYTECODE=1
Environment=MPLCONFIGDIR=/run/burbz-photo/mpl
Restart=on-failure
RestartSec=5
CPUQuota=200%
MemoryMax=6G
TasksMax=64
NoNewPrivileges=true
PrivateNetwork=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
RestrictAddressFamilies=AF_UNIX
ReadWritePaths=/run/burbz-photo

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl restart burbz-photo
worker_ready=0
for attempt in $(seq 1 90); do
  if "$PYTHON" - "$WORKER_HASH" <<'PY'
import http.client,json,socket,sys
class Local(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(2);self.sock.connect('/run/burbz-photo/recognizer.sock')
try:
    c=Local('localhost');c.request('GET','/health');r=c.getresponse();p=json.loads(r.read(4096));c.close()
    sys.exit(0 if r.status==200 and p.get('ready') is True and p.get('policy')=='photo-local-v393' and p.get('sourceHash')==sys.argv[1] else 1)
except (OSError,ValueError,http.client.HTTPException):sys.exit(1)
PY
  then worker_ready=1; break; fi
  sleep 1
done
[[ $worker_ready -eq 1 ]] || { echo 'Local photo worker failed readiness' >&2; exit 1; }
cp "$SOURCE" "$ROOT/photo_id.py"
chown --reference="$ROOT/server.py" "$ROOT/photo_id.py"
systemctl restart "$SERVICE"
ready=0
for attempt in $(seq 1 30); do
  # This backend has no /api/health. A camera POST without an image is a
  # cheap, non-inference probe of the actual route we will verify next.
  if PROBE=$(curl -sS --max-time 2 -X POST -d captureSource=camera -w '\n%{http_code}' "$ORIGIN/api/identify/image" 2>/dev/null) && \
    printf '%s' "$PROBE" | "$PYTHON" -c 'import json,sys; body,status=sys.stdin.read().rsplit("\n",1); p=json.loads(body); sys.exit(0 if status=="400" and p.get("found") is False and p.get("message")=="No camera image received." else 1)' >/dev/null 2>&1; then ready=1; break; fi
  sleep 1
done
[[ $ready -eq 1 ]] || { echo 'Photo backend did not become healthy' >&2; exit 1; }
"$PYTHON" "$PROOF" --origin "$ORIGIN" --fixtures "$FIXTURES" --output "$BACKUP/proof.json"
"$PYTHON" "$SOUND_PROOF" --origin "$ORIGIN" --root "$ROOT" --output "$BACKUP/sound-proof.json"
systemctl enable burbz-photo
sha256sum "$ROOT/photo_id.py" > "$BACKUP/installed.sha256"
printf '%s\n' "$SOURCE_HASH:$WORKER_HASH" > "$ROOT/.photo-deployed-sha256.new"
mv -f "$ROOT/.photo-deployed-sha256.new" "$ROOT/.photo-deployed-sha256"
trap - EXIT
echo "Photo adapter restarted and HTTP proof passed; rollback copy: $BACKUP"
