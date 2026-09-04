#!/usr/bin/env bash
# Reconcile an interrupted Burbz promotion without blessing unknown live edits.
#
# The autodeployer copies public files before it runs the backend proof. If that
# proof fails, the old deployment marker and hash manifest intentionally stay
# in place. A later retry then sees the already-copied release files as drift.
# This tool opens that lock only when every previously managed live file is
# byte-identical to one explicitly pinned Git commit, then runs the normal
# updater at that same immutable commit. It never deletes live-only files.

set -Eeuo pipefail

ROOT=""
SOURCE=""
EXPECTED_SHA=""
TARGET_SHA=""
SYNC_BIN="${BURBZ_SYNC_BIN:-/usr/local/bin/burbz-sync}"
DRY_RUN=0
NO_SYNC=0

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }
log() { printf '%s\n' "$*"; }

usage() {
  cat <<'EOF'
Usage:
  reconcile-interrupted-burbz-deploy.sh \
    --root /live/burbz \
    --source /checkout/public/burbz \
    --expected-sha 40_HEX_COPIED_COMMIT \
    --target-sha 40_HEX_FINAL_COMMIT [--dry-run] [--no-sync]

The source must be a clean public/burbz tree at the exact copied commit. The
normal updater is then pinned to the final target commit; that release must
change a managed sound_id module so its transactional backend proof runs.
--dry-run proves whether reconciliation is safe without changing anything.
--no-sync re-anchors the manifest but does not run the normal updater.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --root) ROOT="${2:-}"; shift ;;
    --source) SOURCE="${2:-}"; shift ;;
    --expected-sha) EXPECTED_SHA="${2:-}"; shift ;;
    --target-sha) TARGET_SHA="${2:-}"; shift ;;
    --sync-bin) SYNC_BIN="${2:-}"; shift ;;
    --dry-run) DRY_RUN=1 ;;
    --no-sync) NO_SYNC=1 ;;
    -h|--help) usage; exit 0 ;;
    *) die "unknown argument: $1" ;;
  esac
  shift
done

[[ -n "$ROOT" && -d "$ROOT" ]] || die "--root must name the live Burbz directory"
[[ -n "$SOURCE" && -d "$SOURCE" ]] || die "--source must name a release public/burbz directory"
[[ "$EXPECTED_SHA" =~ ^[0-9a-f]{40}$ ]] || die "--expected-sha must be a 40-character lowercase Git SHA"
[[ "$TARGET_SHA" =~ ^[0-9a-f]{40}$ ]] || die "--target-sha must be a 40-character lowercase Git SHA"
[[ -f "$SOURCE/index.html" && -f "$SOURCE/manifest.json" ]] || die "source is not a Burbz release tree"

ROOT="$(readlink -f "$ROOT")"
SOURCE="$(readlink -f "$SOURCE")"
MANIFEST="$ROOT/.burbz-managed-hashes.sha256"
MARKER="$ROOT/.burbz-deployed-sha"
[[ -f "$MANIFEST" ]] || die "live managed-hash manifest is missing"

# Production recovery requires a real, clean Git checkout at the pinned SHA.
# The private testing switch exists only so the regression suite can build
# isolated fixtures without creating throwaway repositories.
if [[ "${BURBZ_RECOVERY_TESTING:-0}" != "1" ]]; then
  REPO_ROOT="$(git -C "$SOURCE" rev-parse --show-toplevel 2>/dev/null || true)"
  [[ -n "$REPO_ROOT" ]] || die "source is not inside a Git checkout"
  HEAD_SHA="$(git -C "$REPO_ROOT" rev-parse HEAD)"
  [[ "$HEAD_SHA" == "$EXPECTED_SHA" ]] || die "source HEAD $HEAD_SHA is not expected commit $EXPECTED_SHA"
  SOURCE_REL="${SOURCE#"$REPO_ROOT"/}"
  [[ "$SOURCE_REL" != "$SOURCE" ]] || die "could not resolve source path inside checkout"
  [[ -z "$(git -C "$REPO_ROOT" status --porcelain --untracked-files=no -- "$SOURCE_REL")" ]] \
    || die "source release tree has uncommitted changes"
fi

TMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TMP_DIR"' EXIT
NEW_MANIFEST="$TMP_DIR/managed-hashes.sha256"
MISMATCHES="$TMP_DIR/mismatches"
: > "$NEW_MANIFEST"
: > "$MISMATCHES"

count=0
drifted=0
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ "$line" =~ ^([0-9a-f]{64})[[:space:]][[:space:]](\./.+)$ ]] \
    || die "managed manifest contains an unsupported line"
  old_hash="${BASH_REMATCH[1]}"
  rel="${BASH_REMATCH[2]}"
  case "$rel" in
    ./*/../*|./../*|*/..|/*) die "unsafe managed path: $rel" ;;
  esac
  [[ -f "$ROOT/${rel#./}" ]] || { printf '%s\n' "$rel" >> "$MISMATCHES"; continue; }
  live_hash="$(sha256sum -- "$ROOT/${rel#./}" | cut -d' ' -f1)"
  if [[ "$live_hash" != "$old_hash" ]]; then
    drifted=$((drifted + 1))
    if [[ ! -f "$SOURCE/${rel#./}" ]] \
        || ! cmp -s -- "$SOURCE/${rel#./}" "$ROOT/${rel#./}"; then
      printf '%s\n' "$rel" >> "$MISMATCHES"
      continue
    fi
  fi
  (cd "$ROOT" && sha256sum -- "$rel") >> "$NEW_MANIFEST"
  count=$((count + 1))
done < "$MANIFEST"

if [[ -s "$MISMATCHES" ]]; then
  log "Refusing reconciliation: live files do not match $EXPECTED_SHA:"
  sed -n '1,20p' "$MISMATCHES"
  exit 1
fi
[[ $count -gt 0 ]] || die "managed manifest is empty"

log "Verified all $count managed files; $drifted interrupted-copy changes are byte-identical to $EXPECTED_SHA."
if [[ $DRY_RUN -eq 1 ]]; then
  log "Dry run complete; live state was not changed."
  exit 0
fi

BACKUP_DIR="$ROOT/.deploy-recovery-backups/$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$BACKUP_DIR"
cp -a -- "$MANIFEST" "$BACKUP_DIR/managed-hashes.sha256.before"
if [[ -f "$MARKER" ]]; then
  cp -a -- "$MARKER" "$BACKUP_DIR/deployed-sha.before"
fi

STAGED_MANIFEST="$ROOT/.burbz-managed-hashes.sha256.reconcile.$$"
cp --preserve=mode,ownership,timestamps -- "$NEW_MANIFEST" "$STAGED_MANIFEST"
mv -f -- "$STAGED_MANIFEST" "$MANIFEST"
(cd "$ROOT" && sha256sum --quiet -c "$MANIFEST") \
  || die "re-anchored manifest did not verify; backup is in $BACKUP_DIR"
log "Re-anchored the interrupted deployment manifest; backup: $BACKUP_DIR"

if [[ $NO_SYNC -eq 1 ]]; then
  log "Normal updater was not started (--no-sync)."
  exit 0
fi

[[ -x "$SYNC_BIN" ]] || die "normal updater is not executable: $SYNC_BIN"
BURBZ_DEPLOY_SHA="$TARGET_SHA" "$SYNC_BIN"
[[ -f "$MARKER" && "$(tr -d '\r\n' < "$MARKER")" == "$TARGET_SHA" ]] \
  || die "normal updater did not publish expected marker $TARGET_SHA"
(cd "$ROOT" && sha256sum --quiet -c "$MANIFEST") \
  || die "normal updater completed but its final managed manifest does not verify"
log "Burbz deployment reconciled and verified at $TARGET_SHA."
