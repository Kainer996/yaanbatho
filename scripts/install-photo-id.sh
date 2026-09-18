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
if [[ -f "$SOURCE_DIR/photo_gemini.py" ]]; then DEFAULT_WORKER="$SOURCE_DIR/photo_gemini.py"; else DEFAULT_WORKER="$SOURCE_DIR/photo_local.py"; fi
WORKER_SOURCE=${6:-$DEFAULT_WORKER}
# Installed sync revisions explicitly pass the retired local worker. A staged
# Gemini sibling is authoritative, including on that old six-argument path.
if [[ -f "$(dirname -- "$WORKER_SOURCE")/photo_gemini.py" ]]; then WORKER_SOURCE="$(dirname -- "$WORKER_SOURCE")/photo_gemini.py"; fi
LOCAL_RUNTIME=${BURBZ_LOCAL_PHOTO_RUNTIME:-/opt/burbz-photo}
WORKER_UNIT=${BURBZ_PHOTO_UNIT_PATH:-/etc/systemd/system/burbz-photo.service}
WORKER_SOCKET=${BURBZ_PHOTO_SOCKET:-/run/burbz-photo/recognizer.sock}
SERVICE=${BURBZ_SERVICE:-burbz}
ORIGIN=${BURBZ_BACKEND_ORIGIN:-http://127.0.0.1:5055}
LEDGER=${BURBZ_PHOTO_LEDGER:-/var/lib/burbz-photo/budget.sqlite}
ENV_FILE=${BURBZ_PHOTO_ENV_FILE:-/etc/burbz/env}
UPLOAD_PATCHER="$(dirname -- "${BASH_SOURCE[0]}")/patch-photo-upload-lifecycle.py"
UPLOAD_DROPIN=${BURBZ_PHOTO_UPLOAD_DROPIN:-/etc/systemd/system/$SERVICE.service.d/photo-uploads.conf}
PYTHON="$ROOT/venv/bin/python3"
[[ -f "$ROOT/server.py" && -x "$PYTHON" && -f "$SOURCE" && -f "$PROOF" && -f "$SOUND_PROOF" && -f "$WORKER_SOURCE" ]] || { echo 'Photo promotion inputs missing' >&2; exit 1; }
[[ -x "$LOCAL_RUNTIME/venv/bin/python" ]] || { echo 'Provision the isolated photo Python runtime first' >&2; exit 1; }
[[ "$LOCAL_RUNTIME" =~ ^/[a-zA-Z0-9/_-]+$ ]] || { echo 'Invalid local runtime path' >&2; exit 1; }
[[ "$WORKER_UNIT" =~ ^/[a-zA-Z0-9/_.-]+$ && "$WORKER_SOCKET" =~ ^/[a-zA-Z0-9/_.-]+$ ]] || { echo 'Invalid photo service path' >&2; exit 1; }
[[ "$(systemctl show "$SERVICE" -p WorkingDirectory --value)" == "$ROOT" ]] || { echo 'Photo service webroot mismatch' >&2; exit 1; }
SOURCE_HASH=$(sha256sum "$SOURCE" | cut -d' ' -f1)
WORKER_HASH=$(sha256sum "$WORKER_SOURCE" | cut -d' ' -f1)
# Read the staged worker's declared contract without importing ML dependencies.
# Bundles live side by side: promotion must never replace the old models folder.
CONTRACT=$("$PYTHON" - "$WORKER_SOURCE" "$SOURCE" "$PROOF" "$SOUND_PROOF" <<'PY'
import ast,pathlib,re,sys
for filename in sys.argv[1:]:
    compile(pathlib.Path(filename).read_text(), filename, 'exec')
tree = ast.parse(pathlib.Path(sys.argv[1]).read_text())
constants = {}
for node in tree.body:
    if isinstance(node, ast.Assign) and isinstance(node.value, ast.Constant):
        for target in node.targets:
            if isinstance(target, ast.Name): constants[target.id] = node.value.value
policy, model, bundle = (constants.get(key) for key in ('POLICY', 'MODEL', 'BUNDLE'))
if policy == 'photo-gemini-v425' and model == 'gemini-3.8-flash':
    print(policy, model, 'gemini');sys.exit(0)
if policy != 'photo-local-v393' or not isinstance(model, str) or not re.fullmatch(r'[a-z0-9-]+', model):
    raise ValueError('Unsupported staged photo worker contract')
if not isinstance(bundle, str) or not re.fullmatch(r'photo-models-v[0-9]+', bundle):
    raise ValueError('Staged photo worker must declare its immutable BUNDLE')
print(policy, model, bundle)
PY
)
read -r POLICY MODEL BUNDLE <<< "$CONTRACT"
GEMINI=0
WORKER_FILE=photo_local.py
SERVICE_USER=$(systemctl show "$SERVICE" -p User --value)
SERVICE_USER=${SERVICE_USER:-root}
SERVICE_GROUP=$(id -gn "$SERVICE_USER")
if [[ "$BUNDLE" == gemini ]]; then
  GEMINI=1
  [[ -f "$UPLOAD_PATCHER" && ! -L "$UPLOAD_DROPIN" && "$UPLOAD_DROPIN" =~ ^/[a-zA-Z0-9/_.-]+$ ]] || { echo 'Photo lifecycle patcher or drop-in path is invalid' >&2; exit 1; }
  WORKER_FILE=photo_gemini.py
  BUDGET_SOURCE="$(dirname -- "$WORKER_SOURCE")/photo_budget.py"
  [[ -f "$BUDGET_SOURCE" && -f "$LEDGER" && ! -L "$LEDGER" && -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || { echo 'Gemini requires the staged budget module, existing persistent ledger, and private server environment' >&2; exit 1; }
  [[ "$LEDGER" =~ ^/[a-zA-Z0-9/_.-]+$ && "$ENV_FILE" =~ ^/[a-zA-Z0-9/_.-]+$ ]] || { echo 'Invalid Gemini state/configuration path' >&2; exit 1; }
  # Never initialise, truncate, copy, or replace the paid ledger on promotion or rollback.
  "$PYTHON" - "$BUDGET_SOURCE" "$LEDGER" "$ENV_FILE" "$SERVICE_USER" <<'PY'
import os,pathlib,pwd,stat,sys
compile(pathlib.Path(sys.argv[1]).read_text(),sys.argv[1],'exec')
ledger,env=map(pathlib.Path,sys.argv[2:4]);uid=pwd.getpwnam(sys.argv[4]).pw_uid
for path in (ledger,env):
    info=path.stat()
    if not stat.S_ISREG(info.st_mode) or info.st_mode & 0o077:
        raise ValueError('Photo ledger and environment must be private regular files')
if ledger.stat().st_uid != uid or ledger.parent.stat().st_uid != uid:
    raise ValueError('Persistent photo ledger and parent must belong to the worker user')
if ledger.parent.stat().st_mode & 0o077:
    raise ValueError('Persistent photo ledger directory must be private')
if env.stat().st_uid not in (0,uid):
    raise ValueError('Photo environment must belong to root or the worker user')
PY
  BUNDLE_HASH=$(sha256sum "$BUDGET_SOURCE" | cut -d' ' -f1)
  RELEASE_HASH=$(printf '%s:%s' "$WORKER_HASH" "$BUNDLE_HASH" | sha256sum | cut -d' ' -f1)
  WORKER_RELEASE="$LOCAL_RUNTIME/releases/gemini-$RELEASE_HASH"
  EXEC_START="$LOCAL_RUNTIME/venv/bin/python $WORKER_RELEASE/$WORKER_FILE --ledger $LEDGER --socket $WORKER_SOCKET"
else
MODEL_ROOT="$LOCAL_RUNTIME/${BUNDLE#photo-}"
[[ -d "$MODEL_ROOT" && ! -L "$MODEL_ROOT" && -f "$MODEL_ROOT/manifest.json" ]] || { echo "Provision the immutable $BUNDLE bundle at $MODEL_ROOT first" >&2; exit 1; }
BUNDLE_HASH=$("$PYTHON" - "$MODEL_ROOT/manifest.json" "$BUNDLE" <<'PY'
import hashlib,json,pathlib,sys
raw = pathlib.Path(sys.argv[1]).read_bytes()
manifest = json.loads(raw)
if manifest.get('id') != sys.argv[2] or not manifest.get('sha256'):
    raise ValueError('Photo model bundle identity/checksums missing or mismatched')
print(hashlib.sha256(raw).hexdigest())
PY
)
  WORKER_RELEASE="$LOCAL_RUNTIME/releases/$WORKER_HASH"
  EXEC_START="$LOCAL_RUNTIME/venv/bin/python $WORKER_RELEASE/$WORKER_FILE --models $MODEL_ROOT --socket $WORKER_SOCKET"
fi
DEPLOY_ID="$SOURCE_HASH:$WORKER_HASH:$BUNDLE:$BUNDLE_HASH"
worker_ready(){
  "$PYTHON" - "$WORKER_SOCKET" "$POLICY" "$MODEL" "$WORKER_HASH" "$BUNDLE" "$BUNDLE_HASH" <<'PY'
import http.client,json,socket,sys
class Local(http.client.HTTPConnection):
    def connect(self):
        self.sock=socket.socket(socket.AF_UNIX,socket.SOCK_STREAM)
        self.sock.settimeout(2);self.sock.connect(sys.argv[1])
try:
    c=Local('localhost');c.request('GET','/health');r=c.getresponse();p=json.loads(r.read(4096));c.close()
    expected=dict(zip(('policy','model','sourceHash','bundle','bundleHash'),sys.argv[2:]))
    if sys.argv[5]=='gemini':
        expected.pop('bundle');expected['budgetHash']=expected.pop('bundleHash')
    sys.exit(0 if r.status==200 and isinstance(p,dict) and p.get('ready') is True and all(p.get(k)==v for k,v in expected.items()) else 1)
except (OSError,ValueError,http.client.HTTPException):sys.exit(1)
PY
}
upload_lifecycle_ready(){
  [[ $GEMINI -eq 0 ]] && return 0
  [[ -f "$UPLOAD_DROPIN" ]] &&
    "$PYTHON" "$UPLOAD_PATCHER" "$ROOT/server.py" --check &&
    grep -Fxq 'RuntimeDirectory=burbz-photo-uploads' "$UPLOAD_DROPIN" &&
    grep -Fxq 'RuntimeDirectoryMode=0750' "$UPLOAD_DROPIN" &&
    grep -Fxq 'RuntimeDirectoryPreserve=no' "$UPLOAD_DROPIN" &&
    [[ " $(systemctl show "$SERVICE" -p RuntimeDirectory --value) " == *' burbz-photo-uploads '* ]] &&
    [[ "$(systemctl show "$SERVICE" -p RuntimeDirectoryMode --value)" == 0750 ]] &&
    [[ "$(systemctl show "$SERVICE" -p RuntimeDirectoryPreserve --value)" == no ]]
}
# A matching source marker alone does not prove the running process loaded the
# new taxonomy/weights. Even the no-op path checks the exact loaded manifest.
if [[ -f "$ROOT/photo_id.py" && -f "$WORKER_RELEASE/$WORKER_FILE" && -f "$WORKER_UNIT" ]] && \
   cmp -s "$SOURCE" "$ROOT/photo_id.py" && cmp -s "$WORKER_SOURCE" "$WORKER_RELEASE/$WORKER_FILE" && \
   { [[ $GEMINI -eq 0 ]] || cmp -s "$BUDGET_SOURCE" "$WORKER_RELEASE/photo_budget.py"; } && \
   [[ "$(cat "$ROOT/.photo-deployed-sha256" 2>/dev/null || true)" == "$DEPLOY_ID" ]] && \
   grep -Fxq "ExecStart=$EXEC_START" "$WORKER_UNIT" && \
   systemctl is-active --quiet burbz-photo && worker_ready && upload_lifecycle_ready; then exit 0; fi
if [[ -e "$WORKER_RELEASE/$WORKER_FILE" ]] && ! cmp -s "$WORKER_SOURCE" "$WORKER_RELEASE/$WORKER_FILE"; then
  echo 'Immutable photo worker release has changed; refusing to overwrite it' >&2; exit 1
fi
if [[ $GEMINI -eq 1 && -e "$WORKER_RELEASE/photo_budget.py" ]] && ! cmp -s "$BUDGET_SOURCE" "$WORKER_RELEASE/photo_budget.py"; then
  echo 'Immutable photo budget release has changed; refusing to overwrite it' >&2; exit 1
fi
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
mkdir -p "$ROOT/.photo-deploy-backups"
BACKUP=$(mktemp -d "$ROOT/.photo-deploy-backups/$STAMP.XXXXXX")
HAD_OLD=0
HAD_WORKER=0
HAD_UPLOAD_DROPIN=0
WORKER_WAS_ACTIVE=0
WORKER_WAS_ENABLED=0
systemctl is-active --quiet burbz-photo && WORKER_WAS_ACTIVE=1
systemctl is-enabled --quiet burbz-photo && WORKER_WAS_ENABLED=1
if [[ -f "$WORKER_UNIT" ]]; then cp -p "$WORKER_UNIT" "$BACKUP/burbz-photo.service"; HAD_WORKER=1; fi
if [[ -f "$ROOT/photo_id.py" ]]; then cp -p "$ROOT/photo_id.py" "$BACKUP/photo_id.py"; HAD_OLD=1; fi
if [[ $GEMINI -eq 1 ]]; then
  cp -p "$ROOT/server.py" "$BACKUP/server.py"
  if [[ -f "$UPLOAD_DROPIN" ]]; then cp -p "$UPLOAD_DROPIN" "$BACKUP/photo-uploads.conf"; HAD_UPLOAD_DROPIN=1; fi
  # Compile a candidate before replacing either the backend or any unit file.
  "$PYTHON" "$UPLOAD_PATCHER" "$ROOT/server.py" "$BACKUP/server.py.candidate"
fi
rollback(){
  local status=$?
  if [[ $status -ne 0 ]]; then
    systemctl stop burbz-photo || true
    # Stop while the upload runtime configuration is still loaded, so systemd
    # removes any interrupted capture before restoring the previous drop-in.
    if [[ $GEMINI -eq 1 ]]; then systemctl stop "$SERVICE" || true; fi
    if [[ $WORKER_WAS_ENABLED -eq 0 ]]; then systemctl disable burbz-photo || true; fi
    if [[ $HAD_WORKER -eq 1 ]]; then
      cp -p "$BACKUP/burbz-photo.service" "$WORKER_UNIT"
    else
      systemctl disable burbz-photo || true
      # Keep failed unit reviewable, rather than deleting it.
      if [[ -f "$WORKER_UNIT" ]]; then mv "$WORKER_UNIT" "$BACKUP/failed-burbz-photo.service"; fi
    fi
    if [[ $GEMINI -eq 1 ]]; then
      cp -p "$BACKUP/server.py" "$ROOT/server.py"
      if [[ $HAD_UPLOAD_DROPIN -eq 1 ]]; then
        cp -p "$BACKUP/photo-uploads.conf" "$UPLOAD_DROPIN"
      elif [[ -f "$UPLOAD_DROPIN" ]]; then
        mv "$UPLOAD_DROPIN" "$BACKUP/failed-photo-uploads.conf"
      fi
    fi
    systemctl daemon-reload || true
    if [[ $WORKER_WAS_ACTIVE -eq 1 ]]; then systemctl start burbz-photo || true; fi
    if [[ $HAD_OLD -eq 1 ]]; then cp -p "$BACKUP/photo_id.py" "$ROOT/photo_id.py"; elif [[ -f "$ROOT/photo_id.py" ]]; then mv "$ROOT/photo_id.py" "$BACKUP/failed-photo_id.py"; fi
    systemctl restart "$SERVICE" || true
    echo "Photo proof failed; prior module restored from $BACKUP" >&2
  fi
}
trap rollback EXIT
mkdir -p "$WORKER_RELEASE"
if [[ ! -f "$WORKER_RELEASE/$WORKER_FILE" ]]; then cp "$WORKER_SOURCE" "$WORKER_RELEASE/$WORKER_FILE"; fi
if [[ $GEMINI -eq 1 && ! -f "$WORKER_RELEASE/photo_budget.py" ]]; then cp "$BUDGET_SOURCE" "$WORKER_RELEASE/photo_budget.py"; fi
chmod 755 "$LOCAL_RUNTIME" "$LOCAL_RUNTIME/releases" "$WORKER_RELEASE"
chmod 644 "$WORKER_RELEASE/$WORKER_FILE"
if [[ $GEMINI -eq 1 ]]; then
chmod 644 "$WORKER_RELEASE/photo_budget.py"
mkdir -p "$(dirname -- "$UPLOAD_DROPIN")"
cat > "$UPLOAD_DROPIN" <<'UNIT'
[Service]
RuntimeDirectory=burbz-photo-uploads
RuntimeDirectoryMode=0750
RuntimeDirectoryPreserve=no
UNIT
cat > "$WORKER_UNIT" <<UNIT
[Unit]
Description=Burbz Gemini photo recognition with shared monthly allowance
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
ExecStart=$EXEC_START
EnvironmentFile=$ENV_FILE
Environment=PYTHONDONTWRITEBYTECODE=1
RuntimeDirectory=burbz-photo
RuntimeDirectoryMode=0750
Restart=on-failure
RestartSec=5
CPUQuota=100%
MemoryMax=512M
TasksMax=32
NoNewPrivileges=true
PrivateNetwork=false
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
RestrictAddressFamilies=AF_UNIX AF_INET AF_INET6
ReadWritePaths=$(dirname -- "$WORKER_SOCKET") $(dirname -- "$LEDGER")
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT
else
cat > "$WORKER_UNIT" <<UNIT
[Unit]
Description=Burbz offline bird photo recognition
After=local-fs.target

[Service]
Type=simple
User=$SERVICE_USER
Group=$SERVICE_GROUP
ExecStart=$EXEC_START
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
ReadWritePaths=$(dirname -- "$WORKER_SOCKET")

[Install]
WantedBy=multi-user.target
UNIT
fi
systemctl daemon-reload
if [[ $GEMINI -eq 1 ]]; then
  [[ "$(systemctl show burbz-photo -p PrivateNetwork --value)" == no ]] || { echo 'Photo service has an overriding private-network sandbox; refusing paid proof' >&2; exit 1; }
  EFFECTIVE_AF=$(systemctl show burbz-photo -p RestrictAddressFamilies --value)
  [[ " $EFFECTIVE_AF " == *' AF_UNIX '* && " $EFFECTIVE_AF " == *' AF_INET '* && " $EFFECTIVE_AF " == *' AF_INET6 '* ]] || { echo 'Photo service address families prevent Gemini access' >&2; exit 1; }
fi
systemctl restart burbz-photo
WORKER_READY=0
for attempt in $(seq 1 90); do
  if worker_ready; then WORKER_READY=1; break; fi
  sleep 1
done
[[ $WORKER_READY -eq 1 ]] || { echo 'Local photo worker failed readiness' >&2; exit 1; }
cp "$SOURCE" "$ROOT/photo_id.py"
chown --reference="$ROOT/server.py" "$ROOT/photo_id.py"
if [[ $GEMINI -eq 1 ]]; then
  cp "$BACKUP/server.py.candidate" "$ROOT/server.py"
  chown --reference="$BACKUP/server.py" "$ROOT/server.py"
  chmod --reference="$BACKUP/server.py" "$ROOT/server.py"
fi
systemctl restart "$SERVICE"
upload_lifecycle_ready || { echo 'Photo upload runtime cleanup configuration did not take effect' >&2; exit 1; }
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
printf '%s\n' "$DEPLOY_ID" > "$ROOT/.photo-deployed-sha256.new"
mv -f "$ROOT/.photo-deployed-sha256.new" "$ROOT/.photo-deployed-sha256"
trap - EXIT
echo "Photo adapter restarted and HTTP proof passed; rollback copy: $BACKUP"
