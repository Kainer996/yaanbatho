#!/usr/bin/env bash
# ===============================================================
# Burbz — install BirdNET+ V3.0 as the sound recogniser
# ---------------------------------------------------------------
# BirdNET V2.4's weights are CC BY-NC-SA 4.0 (NonCommercial) and cannot ship
# in a monetised build. BirdNET+ V3.0's are CC BY-SA 4.0 — commercial use is
# permitted with attribution. This script moves the live server onto V3.
#
# It is idempotent and self-verifying: it installs the runtime, fetches and
# checksums the models, wires sound_id into server.py (backing it up first),
# restarts the service, and then proves the live endpoint identifies a known
# bird and rejects a known confuser. If proof fails it restores server.py,
# the environment file, and the systemd drop-in exactly as they were.
#
# Run on the server:
#
#   curl -fsSL https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/install-birdnet-v3.sh \
#     | sudo bash
#
# Useful flags (when running the file directly):
#   --dry-run       show what would change, touch nothing
#   --no-patch      install models and deps only, leave server.py alone
#   --models-only   just (re)download the model files
#   --rollback      restore the most recent server.py backup
# ===============================================================

set -Eeuo pipefail

MODEL_DIR="${BURBZ_MODEL_DIR:-/opt/burbz/models}"
SERVER_PY="${BURBZ_SERVER_PY:-}"
SERVICE="${BURBZ_SERVICE:-}"
# The Burbz service listens on 5055. The port-80 default virtual host can
# return 404 even while that service is healthy; prove the adapter directly.
# Operators with another backend/proxy origin can still override this value.
HEALTH_URL="${BURBZ_HEALTH_URL:-http://127.0.0.1:5055}"
ENV_FILE="${BURBZ_ENV_FILE:-/etc/burbz-sound.env}"
DRY_RUN=0; NO_PATCH=0; MODELS_ONLY=0; ROLLBACK=0
PROOF_CLIP=""

cleanup_proof_clip() {
  if [[ -n "${PROOF_CLIP:-}" && -f "$PROOF_CLIP" ]]; then
    rm -f -- "$PROOF_CLIP"
  fi
}
trap cleanup_proof_clip EXIT

ZENODO="https://zenodo.org/records/20703646/files"
GEO_BASE="https://huggingface.co/tphakala/BirdNET-Geomodel/resolve/main"

ACOUSTIC_ONNX="BirdNET+_V3.0-preview3.1_Global_11K_FP16_pruned.onnx"
ACOUSTIC_LABELS="BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv"
GEO_ONNX="BirdNET+_Geomodel_V3.0.2_Global_12K_FP16.onnx"
GEO_LABELS="BirdNET+_Geomodel_V3.0.2_Global_12K_Labels.txt"

SHA_ACOUSTIC_ONNX="69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24"
SHA_ACOUSTIC_LABELS="8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0"
SHA_GEO_ONNX="2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017"
SHA_GEO_LABELS="c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784"
SHA_SCORE_BLACKLIST="a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366"
EXPECTED_POLICY_VERSION="burbz-v3-temporal-20260729.2"
EXPECTED_INTEGRATION_VERSION=4

SCRIPT_VERSION="2026-07-29.accuracy-v5"
STAMP="$(date +%Y%m%d-%H%M%S)"

# $0 is just "bash" when this is piped from curl, so a printed "$0 --rollback"
# is not a command anyone can run. Name the real one.
SELF_URL="https://raw.githubusercontent.com/Kainer996/yaanbatho/main/scripts/install-birdnet-v3.sh"
if [[ -f "$0" && "$0" != "bash" && "$0" != "-bash" ]]; then
  ROLLBACK_CMD="sudo bash $0 --rollback"
else
  ROLLBACK_CMD="curl -fsSL $SELF_URL | sudo bash -s -- --rollback"
fi

log()  { printf "\033[1;36m==>\033[0m %s\n" "$*"; }
ok()   { printf "\033[1;32m  ✔\033[0m %s\n" "$*"; }
warn() { printf "\033[1;33m  !\033[0m %s\n" "$*"; }
die()  { printf "\033[1;31mxx \033[0m %s\n" "$*" >&2; exit 1; }
run()  { if [[ $DRY_RUN -eq 1 ]]; then printf "   \033[2m[dry-run] %s\033[0m\n" "$*"; else eval "$@"; fi; }

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1 ;;
    --no-patch) NO_PATCH=1 ;;
    --models-only) MODELS_ONLY=1 ;;
    --rollback) ROLLBACK=1 ;;
    --model-dir) MODEL_DIR="$2"; shift ;;
    --server-py) SERVER_PY="$2"; shift ;;
    -h|--help) sed -n '2,25p' "$0"; exit 0 ;;
    *) die "Unknown flag: $1" ;;
  esac
  shift
done

[[ $EUID -eq 0 || $DRY_RUN -eq 1 ]] || die "Please run as root (use sudo)."

# ----------------------------------------------------------------
# 1. Locate server.py — the Flask backend that serves /api/identify/sound
# ----------------------------------------------------------------
# Anything under a path like this is a snapshot, not the live backend.
# Patching one of these silently does nothing and looks like success.
is_archived_path() {
  case "$1" in
    *backup*|*backups*|*.bak*|*/tmp/*|*old/*|*-snapshot*|*/.git/*) return 0 ;;
    *) return 1 ;;
  esac
}

# The process that is actually serving requests is the only unambiguous
# answer to "which server.py is live", so ask it first.
server_py_from_process() {
  local pid args argument cwd
  for pid in $(pgrep -f "server\.py" 2>/dev/null || true); do
    [[ -r "/proc/$pid/cmdline" ]] || continue
    cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    args="$(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null || true)"
    while IFS= read -r argument; do
      case "$argument" in
        *server.py)
          if [[ "$argument" == /* && -f "$argument" ]]; then
            echo "$argument"; return
          fi
          if [[ -n "$cwd" && -f "$cwd/${argument#./}" ]]; then
            readlink -f "$cwd/${argument#./}"; return
          fi
          ;;
      esac
    done <<< "$args"
  done
}

server_py_from_systemd() {
  local unit exec_start workdir candidate
  # Prefer the actual Burbz unit before considering any unrelated Python API.
  while IFS= read -r unit; do
    [[ -n "$unit" ]] || continue
    exec_start="$(systemctl show -p ExecStart --value "$unit" 2>/dev/null || true)"
    if [[ "$exec_start" =~ ([^[:space:]\"]*server\.py) ]]; then
      candidate="${BASH_REMATCH[1]}"
      if [[ "$candidate" != /* ]]; then
        workdir="$(systemctl show -p WorkingDirectory --value "$unit" 2>/dev/null || true)"
        [[ -n "$workdir" ]] && candidate="$workdir/$candidate"
      fi
      [[ -f "$candidate" ]] && ! is_archived_path "$candidate" \
        && { readlink -f "$candidate"; return; }
    fi
  done < <(
    printf '%s\n' burbz.service
    systemctl list-units --type=service --state=running --no-legend --plain 2>/dev/null \
      | awk '{print $1}' | grep -v '^burbz\.service$'
  )
}

# Last resort: search the disk and rank, because a box that has been running a
# while is full of dated backup copies of server.py and the first match found
# is very often one of them.
server_py_from_disk() {
  local candidate best="" best_score=-1 score
  while IFS= read -r candidate; do
    grep -q "identify/sound" "$candidate" 2>/dev/null || continue
    is_archived_path "$candidate" && continue
    score=0
    # The live backend is the one sitting next to the package we just deployed.
    [[ -d "$(dirname "$candidate")/sound_id" ]] && score=$((score + 100))
    [[ -f "$(dirname "$candidate")/index.html" ]] && score=$((score + 20))
    [[ "$candidate" == *"/burbz/"* ]] && score=$((score + 10))
    if [[ $score -gt $best_score ]]; then best_score=$score; best="$candidate"; fi
  done < <(find /opt /srv /var/www /home /root -maxdepth 6 -name "server.py" \
             -not -path "*/node_modules/*" 2>/dev/null | head -200)
  echo "$best"
}

find_server_py() {
  [[ -n "$SERVER_PY" ]] && { echo "$SERVER_PY"; return; }
  local found
  found="$(server_py_from_systemd)"; [[ -n "$found" ]] && { echo "$found"; return; }
  found="$(server_py_from_process)"; [[ -n "$found" ]] && { echo "$found"; return; }
  server_py_from_disk
}

# The package normally sits beside server.py. If the backend lives outside the
# web root it will not, so find where update-live-burbz.sh actually put it and
# put that on PYTHONPATH rather than giving up.
find_sound_id_dir() {
  local server_dir="$1" candidate
  [[ -d "$server_dir/sound_id" ]] && { echo "$server_dir"; return; }
  while IFS= read -r candidate; do
    is_archived_path "$candidate" && continue
    [[ -f "$candidate/__init__.py" ]] || continue
    dirname "$candidate"; return
  done < <(find /home /opt /srv /var/www -maxdepth 6 -type d -name "sound_id" 2>/dev/null | head -40)
}

find_service() {
  [[ -n "$SERVICE" ]] && { echo "$SERVICE"; return; }
  local target="${1:-${TARGET:-}}" target_real="" pid cwd argument candidate cgroup unit
  [[ -n "$target" ]] && target_real="$(readlink -f "$target" 2>/dev/null || true)"

  # First bind the exact running server.py process to its systemd cgroup.
  if [[ -n "$target_real" ]]; then
    for pid in $(pgrep -f "server\.py" 2>/dev/null || true); do
      [[ -r "/proc/$pid/cmdline" ]] || continue
      cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
      while IFS= read -r argument; do
        candidate=""
        case "$argument" in
          *server.py)
            if [[ "$argument" == /* ]]; then
              candidate="$(readlink -f "$argument" 2>/dev/null || true)"
            elif [[ -n "$cwd" ]]; then
              candidate="$(readlink -f "$cwd/${argument#./}" 2>/dev/null || true)"
            fi
            ;;
        esac
        [[ "$candidate" == "$target_real" ]] || continue
        cgroup="$(cat "/proc/$pid/cgroup" 2>/dev/null || true)"
        unit="$(printf "%s\n" "$cgroup" | sed -n 's#.*system\.slice/\([^/]*\.service\).*#\1#p' | head -1)"
        if [[ -n "$unit" ]] && systemctl is-active --quiet "$unit" 2>/dev/null; then
          echo "${unit%.service}"
          return
        fi
      done < <(tr '\0' '\n' < "/proc/$pid/cmdline" 2>/dev/null || true)
    done
  fi

  # Fall back only to a running unit whose ExecStart/WorkingDirectory matches
  # the selected backend. Never guess from a generic service name.
  while IFS= read -r unit; do
    local exec_start working
    exec_start="$(systemctl show -p ExecStart --value "$unit" 2>/dev/null || true)"
    working="$(systemctl show -p WorkingDirectory --value "$unit" 2>/dev/null || true)"
    if [[ -n "$target_real" ]]; then
      if [[ "$exec_start" == *"$target_real"* ]] \
          || { [[ "$(readlink -f "$working" 2>/dev/null || true)" == "$(dirname "$target_real")" ]] \
               && [[ "$exec_start" == *"server.py"* ]]; }; then
        echo "${unit%.service}"
        return
      fi
    fi
  done < <(systemctl list-units --type=service --state=running --no-legend --plain 2>/dev/null \
             | awk '{print $1}')
  echo ""
}

# ----------------------------------------------------------------
# 2. Rollback mode
# ----------------------------------------------------------------
if [[ $ROLLBACK -eq 1 ]]; then
  TARGET="$(find_server_py)"
  [[ -n "$TARGET" ]] || die "Couldn't find server.py. Pass --server-py /path/to/server.py"
  BACKUP="$(ls -1t "$TARGET".birdnet-v3-bak-* 2>/dev/null | head -1 || true)"
  [[ -n "$BACKUP" ]] || die "No backup found next to $TARGET"
  TX_STAMP="${BACKUP##*.birdnet-v3-bak-}"
  log "Restoring $BACKUP -> $TARGET"
  run "cp -a '$BACKUP' '$TARGET'"
  if [[ -f "$ENV_FILE.birdnet-v3-bak-$TX_STAMP" ]]; then
    run "cp -a '$ENV_FILE.birdnet-v3-bak-$TX_STAMP' '$ENV_FILE'"
  elif [[ -f "$ENV_FILE.birdnet-v3-absent-$TX_STAMP" ]]; then
    run "rm -f '$ENV_FILE'"
  fi
  SVC="$(find_service "$TARGET")"
  if [[ -n "$SVC" ]]; then
    DROPIN="/etc/systemd/system/$SVC.service.d/birdnet-v3.conf"
    if [[ -f "$DROPIN.birdnet-v3-bak-$TX_STAMP" ]]; then
      run "cp -a '$DROPIN.birdnet-v3-bak-$TX_STAMP' '$DROPIN'"
    elif [[ -f "$DROPIN.birdnet-v3-absent-$TX_STAMP" ]]; then
      run "rm -f '$DROPIN'"
    fi
    run "systemctl daemon-reload"
  fi
  [[ -n "$SVC" ]] && run "systemctl restart '$SVC'"
  ok "Rolled back the server, sound environment and systemd drop-in."
  exit 0
fi

# ----------------------------------------------------------------
# 3. Python runtime
# ----------------------------------------------------------------
# raw.githubusercontent caches per URL for a few minutes, and its edges expire
# independently, so a box can fetch a stale copy of this script minutes after a
# fix lands and silently do the old thing. Print the version so which one ran is
# never in doubt.
log "install-birdnet-v3.sh $SCRIPT_VERSION"

log "Checking the Python runtime"
PY="$(command -v python3 || true)"
[[ -n "$PY" ]] || die "python3 not found"
ok "$($PY -V 2>&1)"

PIP_FLAGS=""
if $PY -m pip install --help 2>/dev/null | grep -q -- "--break-system-packages"; then
  PIP_FLAGS="--break-system-packages"
fi

# Install only what is actually missing, and never --upgrade: on Debian and
# Ubuntu, numpy comes from apt without the RECORD file pip needs to uninstall
# it, so an upgrade fails with "Cannot uninstall numpy, RECORD not found" and
# takes the whole install down with it. The distro's numpy is fine for us.
ensure_module() {  # ensure_module <import name> <pip spec> [optional]
  local module="$1" spec="$2" optional="${3:-}"
  if [[ $DRY_RUN -eq 1 ]]; then
    printf "   \033[2m[dry-run] ensure %s\033[0m\n" "$module"; return 0
  fi
  if $PY -c "import $module" >/dev/null 2>&1; then
    ok "$module already installed ($($PY -c "import $module; print(getattr($module,'__version__','?'))" 2>/dev/null))"
    return 0
  fi
  log "Installing $spec"
  if $PY -m pip install --quiet $PIP_FLAGS "$spec"; then
    ok "$spec"
    return 0
  fi
  [[ -n "$optional" ]] && { warn "$spec unavailable — continuing without it"; return 0; }
  return 1
}

log "Checking the inference runtime"
ensure_module numpy numpy \
  || die "numpy is missing and could not be installed. Try: apt-get install -y python3-numpy"
ensure_module onnxruntime onnxruntime \
  || die "Could not install onnxruntime. On a very old distro try: pip install 'onnxruntime<1.17'"
# These are accuracy dependencies, not cosmetics. The linear-interpolation
# fallback aliases high bird frequencies and makes phone recordings diverge
# from the waveform the model was trained on.
ensure_module soundfile soundfile \
  || die "soundfile is required for reliable BirdNET V3 audio decoding"
ensure_module soxr soxr \
  || die "soxr is required for band-limited BirdNET V3 resampling"
ok "runtime ready (no TensorFlow, no PyTorch, no GPU)"

# ----------------------------------------------------------------
# 4. Models
# ----------------------------------------------------------------
fetch() {  # fetch <url> <target> <sha256>
  local url="$1" target="$2" want="$3" have=""
  if [[ -f "$target" ]]; then
    have="$(sha256sum "$target" | cut -d' ' -f1)"
    if [[ "$have" == "$want" ]]; then
      ok "$(basename "$target") already present and verified"
      return
    fi
    warn "$(basename "$target") checksum mismatch — re-downloading"
  fi
  log "Downloading $(basename "$target")"
  run "curl -fSL --retry 3 --retry-delay 2 -o '$target.partial' '$url'"
  if [[ $DRY_RUN -eq 0 ]]; then
    have="$(sha256sum "$target.partial" | cut -d' ' -f1)"
    if [[ "$have" != "$want" ]]; then
      rm -f "$target.partial"
      die "Checksum mismatch for $(basename "$target"). Expected $want, got $have"
    fi
    mv "$target.partial" "$target"
  fi
  ok "$(basename "$target")"
}

log "Installing models into $MODEL_DIR"
run "mkdir -p '$MODEL_DIR'"
fetch "$ZENODO/${ACOUSTIC_ONNX//+/%2B}?download=1"   "$MODEL_DIR/$ACOUSTIC_ONNX"   "$SHA_ACOUSTIC_ONNX"
fetch "$ZENODO/${ACOUSTIC_LABELS//+/%2B}?download=1" "$MODEL_DIR/$ACOUSTIC_LABELS" "$SHA_ACOUSTIC_LABELS"
# Production accuracy depends on place/date filtering. The recogniser can
# still abstain safely when a player denies location permission, but a server
# install without the geomodel must fail rather than silently losing this layer.
fetch "$GEO_BASE/${GEO_ONNX//+/%2B}"   "$MODEL_DIR/$GEO_ONNX"   "$SHA_GEO_ONNX"
fetch "$GEO_BASE/${GEO_LABELS//+/%2B}" "$MODEL_DIR/$GEO_LABELS" "$SHA_GEO_LABELS"

[[ $MODELS_ONLY -eq 1 ]] && { ok "Models installed. Nothing else changed."; exit 0; }

# ----------------------------------------------------------------
# 5. Find the deployed sound_id package and prove the model works
# ----------------------------------------------------------------
TARGET="$(find_server_py)"
[[ -n "$TARGET" ]] || die "Couldn't find server.py. Re-run with: --server-py /path/to/server.py"
SERVER_DIR="$(dirname "$TARGET")"
log "Backend: $TARGET"

if is_archived_path "$TARGET"; then
  die "$TARGET looks like a backup copy, not the live backend. Re-run with --server-py pointing at the real one."
fi

SOUND_ID_DIR="$(find_sound_id_dir "$SERVER_DIR")"
[[ -n "$SOUND_ID_DIR" ]] \
  || die "The sound_id package is nowhere on this box. Run update-live-burbz.sh first — it ships the package."

if [[ "$SOUND_ID_DIR" != "$SERVER_DIR" ]]; then
  warn "sound_id lives in $SOUND_ID_DIR, not beside server.py — adding it to PYTHONPATH"
fi
ok "sound_id: $SOUND_ID_DIR/sound_id"

log "Self-test: identifying a known recording with V3"
if [[ $DRY_RUN -eq 0 ]]; then
  ( cd "$SOUND_ID_DIR" && BURBZ_BIRDNET_V3_MODEL_DIR="$MODEL_DIR" \
      BURBZ_SOUND_MODEL=birdnetv3 BURBZ_SOUND_MODEL_FALLBACK=0 \
      PYTHONPATH="$SOUND_ID_DIR${PYTHONPATH:+:$PYTHONPATH}" \
      "$PY" -m sound_id.selftest ) \
    || die "The model did not pass its self-test. server.py has not been touched."
else
  printf "   \033[2m[dry-run] python3 -m sound_id.selftest\033[0m\n"
fi

# --no-patch is an offline model/runtime check only. It must not write a V3
# service environment, restart an untouched legacy server, or claim V3 served.
if [[ $NO_PATCH -eq 1 ]]; then
  ok "V3 models and runtime passed the offline self-test; server.py was not changed."
  warn "Serving-engine provenance is unverified because --no-patch was requested."
  exit 0
fi

# Arm a single transaction before changing server.py or service settings.
# Any ordinary shell error after this point restores every file captured here;
# explicit live-proof failures call the same restoration path.
SVC="$(find_service "$TARGET")"
ENV_EXISTED=0
ENV_BACKUP="$ENV_FILE.birdnet-v3-bak-$STAMP"
DROPIN=""
DROPIN_EXISTED=0
DROPIN_BACKUP=""
if [[ -f "$ENV_FILE" ]]; then
  ENV_EXISTED=1
  [[ $DRY_RUN -eq 1 ]] || cp -a "$ENV_FILE" "$ENV_BACKUP"
elif [[ $DRY_RUN -eq 0 ]]; then
  touch "$ENV_FILE.birdnet-v3-absent-$STAMP"
fi
if [[ -n "$SVC" ]]; then
  DROPIN="/etc/systemd/system/$SVC.service.d/birdnet-v3.conf"
  DROPIN_BACKUP="$DROPIN.birdnet-v3-bak-$STAMP"
  if [[ -f "$DROPIN" ]]; then
    DROPIN_EXISTED=1
    [[ $DRY_RUN -eq 1 ]] || cp -a "$DROPIN" "$DROPIN_BACKUP"
  elif [[ $DRY_RUN -eq 0 ]]; then
    mkdir -p "$(dirname "$DROPIN")"
    touch "$DROPIN.birdnet-v3-absent-$STAMP"
  fi
fi

restore_install_files() {
  if [[ -f "$TARGET.birdnet-v3-bak-$STAMP" ]]; then
    cp -a "$TARGET.birdnet-v3-bak-$STAMP" "$TARGET"
  fi
  if [[ $ENV_EXISTED -eq 1 && -f "$ENV_BACKUP" ]]; then
    cp -a "$ENV_BACKUP" "$ENV_FILE"
  elif [[ $ENV_EXISTED -eq 0 ]]; then
    rm -f "$ENV_FILE"
  fi
  if [[ -n "$DROPIN" ]]; then
    if [[ $DROPIN_EXISTED -eq 1 && -f "$DROPIN_BACKUP" ]]; then
      cp -a "$DROPIN_BACKUP" "$DROPIN"
    elif [[ $DROPIN_EXISTED -eq 0 ]]; then
      rm -f "$DROPIN"
    fi
  fi
  systemctl daemon-reload >/dev/null 2>&1 || true
}

TRANSACTION_ARMED=0
transaction_failed() {
  local status="${1:-1}"
  trap - ERR INT TERM
  set +e
  if [[ $TRANSACTION_ARMED -eq 1 ]]; then
    warn "Install interrupted or failed — restoring the pre-install server and settings"
    restore_install_files
    if [[ -n "$SVC" ]]; then
      systemctl restart "$SVC" >/dev/null 2>&1 || true
    fi
  fi
  exit "$status"
}
if [[ $DRY_RUN -eq 0 ]]; then
  TRANSACTION_ARMED=1
  trap 'transaction_failed $?' ERR
  trap 'transaction_failed 130' INT
  trap 'transaction_failed 143' TERM
fi

# ----------------------------------------------------------------
# 6. Wire sound_id into server.py
# ----------------------------------------------------------------
PATCH_VERSION="v4"
[[ -f "$SOUND_ID_DIR/sound_id/server_integration.py" ]] \
  || die "sound_id/server_integration.py is missing. Deploy the current sound_id package first."
[[ -f "$SOUND_ID_DIR/sound_id/server_patcher.py" ]] \
  || die "sound_id/server_patcher.py is missing. Deploy the current sound_id package first."
if [[ $DRY_RUN -eq 0 ]]; then
  PYTHONPATH="$SOUND_ID_DIR${PYTHONPATH:+:$PYTHONPATH}" "$PY" -c '
from sound_id.birdnet_v3_provider import DECISION_POLICY_VERSION
from sound_id.birdnet_v3_provider import (
    GEO_LABELS_SHA256,
    GEO_ONNX_SHA256,
    LABELS_SHA256,
    ONNX_SHA256,
    SCORE_BLACKLIST_SHA256,
)
from sound_id.server_integration import INTEGRATION_VERSION
assert ONNX_SHA256 == "69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24", ONNX_SHA256
assert LABELS_SHA256 == "8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0", LABELS_SHA256
assert GEO_ONNX_SHA256 == "2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017", GEO_ONNX_SHA256
assert GEO_LABELS_SHA256 == "c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784", GEO_LABELS_SHA256
assert SCORE_BLACKLIST_SHA256 == "a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366", SCORE_BLACKLIST_SHA256
assert INTEGRATION_VERSION == 4, INTEGRATION_VERSION
assert DECISION_POLICY_VERSION == "burbz-v3-temporal-20260729.2", DECISION_POLICY_VERSION
' || die "Deployed sound_id code is not the reviewed integration/policy version."
fi

log "Installing the tested BirdNET server adapter before the Flask main guard"
run "cp -a '$TARGET' '$TARGET.birdnet-v3-bak-$STAMP'"
if [[ $DRY_RUN -eq 0 ]]; then
  if ! PYTHONPATH="$SOUND_ID_DIR${PYTHONPATH:+:$PYTHONPATH}" \
      "$PY" -m sound_id.server_patcher "$TARGET"; then
    cp -a "$TARGET.birdnet-v3-bak-$STAMP" "$TARGET"
    die "The live server contract is unsupported. Restored server.py unchanged."
  fi
  "$PY" -m py_compile "$TARGET" || {
    cp -a "$TARGET.birdnet-v3-bak-$STAMP" "$TARGET"
    die "The patched server.py did not compile. Restored the backup."
  }
fi
ok "server.py carries BirdNET integration $PATCH_VERSION before app.run"

# Main's earlier inline v4 patcher is retained inert for readable rollback
# archaeology. The tested server_patcher v4 above is the only executable path.
if false; then
  PATCH_VERSION="v4"
  NEEDS_PATCH=1
  HAS_OLD_BLOCK=0
  # The first block shipped had no version marker, so detect it by the private
  # name only this block ever defines. Missing that is how a box that installed
  # once gets frozen on its first block and never receives a fix.
  if grep -q "BURBZ-BIRDNET-V3-BEGIN\|_burbz_sound_id" "$TARGET" 2>/dev/null; then
    HAS_OLD_BLOCK=1
  fi
  printf "   \033[2mwiring signatures: marker=%s v1-block=%s bare-call=%s\033[0m\n" \
    "$(grep -c 'BURBZ-BIRDNET-V3-BEGIN' "$TARGET" 2>/dev/null || echo 0)" \
    "$(grep -c '_burbz_sound_id' "$TARGET" 2>/dev/null || echo 0)" \
    "$(grep -c 'sound_id.analyse' "$TARGET" 2>/dev/null || echo 0)"

  if grep -q "BURBZ-BIRDNET-V3-BEGIN $PATCH_VERSION" "$TARGET" 2>/dev/null; then
    ok "server.py already carries the current wiring ($PATCH_VERSION) — no code change needed"
    NEEDS_PATCH=0
  elif [[ $HAS_OLD_BLOCK -eq 1 ]]; then
    # Replace an earlier block. v4 has an explicit END marker because the block
    # must sit before app.run; v1-v3 ran to end-of-file and are trimmed there.
    log "Replacing the older wiring block with $PATCH_VERSION"
    run "cp '$TARGET' '$TARGET.birdnet-v3-bak-$STAMP'"
    if [[ $DRY_RUN -eq 0 ]]; then
      "$PY" - "$TARGET" <<'TRIM' || die "Could not remove the previous wiring block — server.py is untouched."
import sys

path = sys.argv[1]
with open(path, encoding="utf-8") as handle:
    lines = handle.readlines()

start = None
end = None
for index, line in enumerate(lines):
    if line.startswith("# BURBZ-BIRDNET-V3-BEGIN"):
        start = index
        for end_index in range(index + 1, len(lines)):
            if lines[end_index].startswith("# BURBZ-BIRDNET-V3-END"):
                end = end_index + 1
                break
        # v1-v3 had no END marker and were appended at end-of-file.
        if end is None:
            end = len(lines)
        break

if start is None:
    # Unmarked first-generation block: anchor on its opening import, then walk
    # back over the "try:" and the comment banner that introduces it. Matching
    # the banner text directly is not safe — it contains an em dash.
    for index, line in enumerate(lines):
        if "import sound_id as _burbz_sound_id" in line:
            start = index
            if start and lines[start - 1].strip() == "try:":
                start -= 1
            while start and lines[start - 1].lstrip().startswith("#"):
                start -= 1
            # The unmarked block shipped immediately before the direct-run
            # guard. Preserve that guard; deleting it makes systemd's process
            # exit cleanly without ever opening the API port.
            end = next(
                (
                    guard_index
                    for guard_index in range(index + 1, len(lines))
                    if lines[guard_index].startswith("if __name__")
                    and "__main__" in lines[guard_index]
                ),
                len(lines),
            )
            break

if start is None or end is None:
    sys.exit("no previous block found")

while start and not lines[start - 1].strip():
    start -= 1
while end < len(lines) and not lines[end].strip():
    end += 1

remainder = "".join(lines[:start] + lines[end:])
if "_burbz_sound_id" in remainder:
    sys.exit("block boundary looks wrong - refusing to trim")

with open(path, "w", encoding="utf-8") as handle:
    handle.write(remainder)
TRIM
      "$PY" -m py_compile "$TARGET" || {
        cp "$TARGET.birdnet-v3-bak-$STAMP" "$TARGET"
        die "server.py did not compile after removing the old block — restored the backup."
      }
    fi
  elif grep -q "sound_id.analyse" "$TARGET" 2>/dev/null; then
    ok "server.py already calls sound_id.analyse directly — leaving it alone"
    NEEDS_PATCH=0
  fi

  if [[ $NEEDS_PATCH -eq 1 ]]; then
    log "Wiring sound_id into server.py (backup: $(basename "$TARGET").birdnet-v3-bak-$STAMP)"
    [[ -f "$TARGET.birdnet-v3-bak-$STAMP" ]] || run "cp '$TARGET' '$TARGET.birdnet-v3-bak-$STAMP'"

    # Write the block to a temporary file, then insert it before the main guard.
    # Appending after `app.run()` makes the wiring unreachable when server.py is
    # executed directly, because Flask blocks before the appended code can run.
    if [[ $DRY_RUN -eq 0 ]]; then
      PATCH_FILE="$(mktemp)"
      cat > "$PATCH_FILE" <<'PATCH'


# BURBZ-BIRDNET-V3-BEGIN v4
# ---------------------------------------------------------------------------
# BirdNET V3 — appended by scripts/install-birdnet-v3.sh
#
# BirdNET V2.4's weights are CC BY-NC-SA 4.0 (NonCommercial); V3's are
# CC BY-SA 4.0, so a monetised build can ship on them. Rather than edit the
# /api/identify/sound handler, this re-binds the two helpers it already calls:
# _analyse_recording now returns a token carrying the request, and
# _aggregate_sound_detections turns that token into a V3 identification. The
# original functions stay available, so BURBZ_SOUND_MODEL=birdnetv2 still
# reaches the old path unchanged.
#
# v4 also tags the /api/identify/sound JSON with the engine that actually
# answered, via a Flask after_request hook, so which recogniser is serving can
# be read straight off a live scan instead of only from the service log.
#
# The BEGIN/END markers let the installer replace this block without touching
# the server's app.run guard below it.
#
# Remove this block (or run install-birdnet-v3.sh --rollback) to undo.
# ---------------------------------------------------------------------------
try:
    import sound_id as _burbz_sound_id
except ImportError:
    # The package usually sits beside server.py. When the backend lives outside
    # the web root it does not, so try the directory the installer recorded
    # before giving up and leaving the V2.4 path alone.
    _burbz_sound_id = None
    try:
        import os as _burbz_os
        import sys as _burbz_sys

        for _burbz_dir in (
            _burbz_os.environ.get("BURBZ_SOUND_ID_DIR"),
            _burbz_os.path.dirname(_burbz_os.path.abspath(__file__)),
        ):
            if _burbz_dir and _burbz_os.path.isdir(
                _burbz_os.path.join(_burbz_dir, "sound_id")
            ):
                if _burbz_dir not in _burbz_sys.path:
                    _burbz_sys.path.insert(0, _burbz_dir)
                import sound_id as _burbz_sound_id
                break
    except Exception:
        _burbz_sound_id = None

try:
    # Captured before the re-bind below, so the V2.4 path stays reachable.
    _burbz_v2_analyse = _analyse_recording
    _burbz_v2_aggregate = _aggregate_sound_detections
except NameError:
    # This server does not have the helpers this block hooks. Do nothing at
    # all rather than raise: a failed import here would stop the API booting,
    # which is far worse than not upgrading the recogniser.
    _burbz_sound_id = None

if _burbz_sound_id is not None:

    def _burbz_common_name(scientific):
        """Prefer the Burbz catalogue's own wording for a species."""
        try:
            entry = _catalog_lookup(scientific)
        except Exception:
            return None
        if not entry:
            return None
        if isinstance(entry, dict):
            return entry.get("common_name") or entry.get("name")
        return getattr(entry, "common_name", None)

    _burbz_sound_id.configure(
        birdnet_analyse=_burbz_v2_analyse,
        birdnet_aggregate=_burbz_v2_aggregate,
        common_name_for=_burbz_common_name,
    )

    class _BurbzRecording(object):
        """Carries a request from _analyse_recording to the aggregation step."""

        __slots__ = ("path", "lat", "lon", "week")

        def __init__(self, path, lat=None, lon=None, week=None):
            self.path, self.lat, self.lon, self.week = path, lat, lon, week

    def _burbz_location_from_request():
        """Read lat/lon straight off the upload.

        The range filter is only as good as the location it gets, and not every
        server hands lat/lon to _analyse_recording — some read them later, in
        the response builder. Without a location an African Thrush is a
        perfectly good answer for a garden in London. The client posts lat and
        lon as form fields, so take them from there when the call did not carry
        them.
        """
        try:
            from flask import request as _burbz_request

            source = _burbz_request.values
            values = []
            for field in ("lat", "lon"):
                raw = source.get(field)
                values.append(float(raw) if raw not in (None, "") else None)
            return values[0], values[1]
        except Exception:
            return None, None

    def _analyse_recording(audio_path, lat=None, lon=None, week=None, *args, **kwargs):
        if lat is None or lon is None:
            fallback_lat, fallback_lon = _burbz_location_from_request()
            lat = lat if lat is not None else fallback_lat
            lon = lon if lon is not None else fallback_lon
        return _BurbzRecording(audio_path, lat, lon, week)

    def _aggregate_sound_detections(detections, allow=None, *args, **kwargs):
        if isinstance(detections, _BurbzRecording):
            return _burbz_sound_id.analyse(
                detections.path, allow=allow,
                lat=detections.lat, lon=detections.lon, week=detections.week,
            )
        # Anything else is a real V2.4 detection list — aggregate as before.
        return _burbz_v2_aggregate(detections, allow, *args, **kwargs)

    try:
        _burbz_log = app.logger
    except Exception:
        import logging as _logging
        _burbz_log = _logging.getLogger(__name__)
    _burbz_log.info(
        "Burbz sound recogniser: %s", _burbz_sound_id.active_provider()
    )

    # Name the engine in the scan response itself. Which model is installed and
    # which model answered a request are different questions, and only the
    # second decides whether the game can be sold — V2.4's weights are
    # NonCommercial. The service log already records it, but a log line is not
    # something you can read from a phone; adding it to the JSON lets the engine
    # be checked from any live scan. The client already reads `provider`
    # (sound_id/README.md) and ignores it when absent, so an un-updated client
    # is unaffected. Registered as an after_request hook rather than edited into
    # the handler, keeping this block append-only and trivial to revert.
    try:
        import json as _burbz_json

        from flask import request as _burbz_request

        @app.after_request
        def _burbz_tag_provider(response):
            try:
                if not _burbz_request.path.endswith("/identify/sound"):
                    return response
                if response.mimetype != "application/json":
                    return response
                payload = response.get_json(silent=True)
                if not isinstance(payload, dict) or "provider" in payload:
                    return response
                meta = _burbz_sound_id.served_meta()
                payload["provider"] = meta["provider"]
                payload["providerLabel"] = meta["label"]
                payload["commercial"] = meta["commercial"]
                response.set_data(_burbz_json.dumps(payload))
            except Exception:
                # Tagging the response must never be able to fail a scan.
                pass
            return response
    except Exception:
        # No Flask, or no app to hook — leave the response untagged rather than
        # letting this stop the server booting.
        pass
# BURBZ-BIRDNET-V3-END v4
PATCH
      "$PY" - "$TARGET" "$PATCH_FILE" <<'INSERT' || {
import re
import sys
from pathlib import Path

path = Path(sys.argv[1])
patch_path = Path(sys.argv[2])
original = path.read_text(encoding="utf-8")
block = patch_path.read_text(encoding="utf-8").strip("\n")
main_guard = re.search(r"(?m)^if __name__\s*==\s*['\"]__main__['\"]\s*:\s*$", original)
if main_guard:
    # The wiring must execute before a direct app.run blocks forever.
    patched = original[:main_guard.start()].rstrip() + "\n\n" + block + "\n\n" + original[main_guard.start():]
else:
    # Import-based WSGI servers have no app.run guard; append in that case.
    patched = original.rstrip() + "\n\n" + block + "\n"
path.write_text(patched, encoding="utf-8")
INSERT
        rm -f "$PATCH_FILE"
        cp "$TARGET.birdnet-v3-bak-$STAMP" "$TARGET"
        die "Could not insert the wiring block before app.run — restored the backup."
      }
      rm -f "$PATCH_FILE"
      "$PY" -m py_compile "$TARGET" || {
        cp "$TARGET.birdnet-v3-bak-$STAMP" "$TARGET"
        die "The patched server.py does not compile — restored the backup, nothing changed."
      }
      ok "server.py wired and compiles"
    fi
  fi
fi

# ----------------------------------------------------------------
# 7. Environment — point the service at the models and pick V3
# ----------------------------------------------------------------
log "Writing $ENV_FILE"
if [[ $DRY_RUN -eq 0 ]]; then
  cat > "$ENV_FILE" <<EOF
# Burbz sound recognition — written by install-birdnet-v3.sh on $STAMP
BURBZ_SOUND_MODEL=birdnetv3
BURBZ_BIRDNET_V3_MODEL_DIR=$MODEL_DIR
# Where the sound_id package was deployed, so server.py can import it even when
# the backend lives outside the web root.
PYTHONPATH=$SOUND_ID_DIR
BURBZ_SOUND_ID_DIR=$SOUND_ID_DIR
# Precision-first BirdNET Live policy. 0.15 is only the developer export floor;
# it is not safe for automatic game unlocks.
BURBZ_BIRDNET_V3_MIN_CONFIDENCE=0.35
BURBZ_BIRDNET_V3_NO_GEO_MIN_CONFIDENCE=0.60
BURBZ_BIRDNET_V3_SINGLE_WINDOW_CONFIDENCE=0.98
BURBZ_BIRDNET_V3_MISTLE_THRUSH_MIN_CONFIDENCE=0.90
BURBZ_BIRDNET_V3_MISTLE_THRUSH_MIN_HIGH_WINDOWS=2
BURBZ_BIRDNET_V3_OVERLAP=0.50
BURBZ_BIRDNET_V3_MIN_SUPPORT_WINDOWS=2
BURBZ_BIRDNET_V3_GEO_THRESHOLD=0.03
BURBZ_BIRDNET_V3_MIN_RMS=0.0001
BURBZ_BIRDNET_V3_VERIFY_HASHES=1
BURBZ_BIRDNET_V3_DIAGNOSTICS=1
# Burbz must use V3. A broken V3 install abstains loudly; it must not silently
# switch engines and make the live recogniser impossible to verify.
BURBZ_SOUND_MODEL_FALLBACK=0
# Cap inference threads on a shared box; 0/unset uses every core.
#BURBZ_BIRDNET_V3_THREADS=2
EOF
  chmod 0644 "$ENV_FILE"
fi
ok "$ENV_FILE"

if [[ -n "$SVC" ]]; then
  log "Attaching $ENV_FILE to $SVC and restarting"
  if [[ $DRY_RUN -eq 0 ]]; then
    mkdir -p "/etc/systemd/system/$SVC.service.d"
    cat > "/etc/systemd/system/$SVC.service.d/birdnet-v3.conf" <<EOF
[Service]
EnvironmentFile=$ENV_FILE
EOF
    systemctl daemon-reload
    systemctl restart "$SVC"
    sleep 3
    systemctl is-active --quiet "$SVC" || {
      warn "$SVC did not come back up — showing the last log lines"
      journalctl -u "$SVC" --no-pager --lines=25 || true
      restore_install_files
      systemctl restart "$SVC" >/dev/null 2>&1 || true
      die "Service failed to restart. The pre-install server and settings were restored."
    }
  fi
  ok "$SVC restarted"
else
  warn "No systemd unit found. Export these yourself and restart the backend:"
  warn "  BURBZ_SOUND_MODEL=birdnetv3 BURBZ_BIRDNET_V3_MODEL_DIR=$MODEL_DIR"
fi

# ----------------------------------------------------------------
# 8. Prove the live endpoint identifies a bird, or roll back
# ----------------------------------------------------------------
if [[ $DRY_RUN -eq 0 && $NO_PATCH -eq 0 ]]; then
  log "Verifying the live endpoint, serving engine, model hash and abstention policy"
  SOURCE_CLIP="$SOUND_ID_DIR/assets/audio/bird-tawny-owl.ogg"
  BLACKBIRD_CLIP="$SOUND_ID_DIR/assets/audio/bird-blackbird.ogg"
  LIVE_ENDPOINT=""
  restore_failed_install() {
    warn "Live V3 proof failed — restoring the pre-install server and settings"
    restore_install_files
    if [[ -n "$SVC" ]]; then
      systemctl restart "$SVC" || true
    fi
    die "BirdNET V3 was NOT installed. Inspect the proof response and service log."
  }
  if [[ ! -f "$SOURCE_CLIP" ]]; then
    warn "Tawny Owl proof clip is missing: $SOURCE_CLIP"
    restore_failed_install
  elif [[ ! -f "$BLACKBIRD_CLIP" ]]; then
    warn "Common Blackbird confuser clip is missing: $BLACKBIRD_CLIP"
    restore_failed_install
  else
    # A 2.2-second file is a single inference window. The precision policy
    # deliberately requires 0.98 when temporal confirmation is impossible, so
    # prove the live listener with the same 12-second, repeated-window shape
    # that the browser uploads.
    PROOF_CLIP="$(mktemp /tmp/burbz-tawny-proof.XXXXXX.wav)"
    "$PY" - "$SOURCE_CLIP" "$PROOF_CLIP" <<'PY'
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
    RESPONSE=""
    # Loading the V3 acoustic and geographic models can keep the socket closed
    # for several seconds after systemd reports the process as active. Poll for
    # up to 30 seconds so a healthy cold start cannot trigger a false rollback.
    LIVE_READY_ATTEMPTS=30
    for (( attempt=1; attempt<=LIVE_READY_ATTEMPTS; attempt+=1 )); do
      for base in "$HEALTH_URL/burbz/api/identify/sound" "$HEALTH_URL/api/identify/sound"; do
        RESPONSE="$(curl -fsS -m 90 -F "audio=@$CLIP" -F "lat=53.228" -F "lon=-2.598" "$base" 2>/dev/null || true)"
        if [[ -n "$RESPONSE" ]] && printf "%s" "$RESPONSE" | "$PY" -c \
            'import json,sys; raise SystemExit(0 if isinstance(json.load(sys.stdin), dict) else 1)' \
            >/dev/null 2>&1; then
          LIVE_ENDPOINT="$base"
          break 2
        fi
      done
      [[ $attempt -lt $LIVE_READY_ATTEMPTS ]] && sleep 1
    done

    if [[ -z "$RESPONSE" ]]; then
      warn "Could not reach either local sound endpoint. Set BURBZ_HEALTH_URL to the reachable proxy origin."
      restore_failed_install
    fi

    if ! printf "%s" "$RESPONSE" | "$PY" -c '
import json, sys
p = json.load(sys.stdin)
bird = p.get("bird") or {}
name = " ".join(str(x or "") for x in (
    bird.get("name"), bird.get("scientificName"),
    p.get("birdnetName"), p.get("scientificName"),
)).lower()
checks = [
    p.get("found") is True,
    p.get("provider") == "birdnetv3",
    p.get("configuredProvider") == "birdnetv3",
    p.get("fallbackUsed") is False,
    p.get("providerVerified") is True,
    p.get("modelSha256") == "69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24",
    p.get("labelsSha256") == "8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0",
    p.get("geoModelSha256") == "2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017",
    p.get("geoLabelsSha256") == "c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784",
    p.get("scoreBlacklistSha256") == "a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366",
    p.get("policyVersion") == "burbz-v3-temporal-20260729.2",
    p.get("serverIntegrationVersion") == 4,
    ("tawny owl" in name or "strix aluco" in name),
]
raise SystemExit(0 if all(checks) else 1)
'; then
      warn "The endpoint answered, but exact V3 provenance/Tawny Owl proof failed:"
      printf "%s\n" "${RESPONSE:0:1200}"
      restore_failed_install
    fi
    ok "Live response proves the exact acoustic, geo, blacklist, policy and integration build"

    BLACKBIRD_RESPONSE="$(curl -sS -m 90 -F "audio=@$BLACKBIRD_CLIP" -F "lat=53.228" -F "lon=-2.598" "$LIVE_ENDPOINT" 2>/dev/null || true)"
    if ! printf "%s" "$BLACKBIRD_RESPONSE" | "$PY" -c '
import json, sys
p = json.load(sys.stdin)
bird = p.get("bird") or {}
all_text = " ".join(
    [str(bird.get("name") or ""), str(bird.get("scientificName") or "")]
    + [str(row) for row in (p.get("allDetections") or [])]
).lower()
checks = [
    p.get("provider") == "birdnetv3",
    p.get("configuredProvider") == "birdnetv3",
    p.get("fallbackUsed") is False,
    p.get("providerVerified") is True,
    p.get("modelSha256") == "69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24",
    p.get("labelsSha256") == "8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0",
    p.get("geoModelSha256") == "2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017",
    p.get("geoLabelsSha256") == "c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784",
    p.get("scoreBlacklistSha256") == "a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366",
    p.get("policyVersion") == "burbz-v3-temporal-20260729.2",
    p.get("serverIntegrationVersion") == 4,
    "mistle thrush" not in all_text,
    "turdus viscivorus" not in all_text,
    "american robin" not in all_text,
    "turdus migratorius" not in all_text,
    (p.get("found") is False or "turdus merula" in all_text or "common blackbird" in all_text),
]
raise SystemExit(0 if all(checks) else 1)
'; then
      warn "The known Common Blackbird confuser regression failed:"
      printf "%s\n" "${BLACKBIRD_RESPONSE:0:1200}"
      restore_failed_install
    fi
    ok "Known Common Blackbird audio no longer unlocks Mistle Thrush/American Robin"

    MALFORMED_RESPONSE="$(curl -sS -m 30 -X POST "$LIVE_ENDPOINT" 2>/dev/null || true)"
    if ! printf "%s" "$MALFORMED_RESPONSE" | "$PY" -c '
import json, sys
p = json.load(sys.stdin)
checks = [
    p.get("provider") is None,
    p.get("providerVerified") is False,
    p.get("serverIntegrationVersion") == 4,
]
raise SystemExit(0 if all(checks) else 1)
'; then
      warn "Malformed-request provenance retained or fabricated a provider:"
      printf "%s\n" "${MALFORMED_RESPONSE:0:1200}"
      restore_failed_install
    fi
    ok "Request-local provenance cannot leak from a previous successful scan"
  fi
fi

TRANSACTION_ARMED=0
trap - ERR INT TERM

# ----------------------------------------------------------------
# 9. Summary
# ----------------------------------------------------------------
cat <<EOF

$(printf "\033[1;32m=================================================================\033[0m")
$(printf "\033[1;32m  BirdNET V3 is installed\033[0m")
$(printf "\033[1;32m=================================================================\033[0m")

  Models        : $MODEL_DIR
  Engine        : birdnetv3  (CC BY-SA 4.0 — commercial use permitted)
  Backend       : $TARGET
  Env file      : $ENV_FILE
  Backup        : $TARGET.birdnet-v3-bak-$STAMP

  Re-run the self-test any time:
    cd $SOUND_ID_DIR && sudo -E python3 -m sound_id.selftest -v

  Roll back everything this script changed:
    $ROLLBACK_CMD

  On your phone: close Burbz fully and reopen it TWICE so the service
  worker picks up the new build.

  Attribution is required by CC BY-SA 4.0 and is already on
  /burbz/audio-credits.html — keep it there.

EOF
