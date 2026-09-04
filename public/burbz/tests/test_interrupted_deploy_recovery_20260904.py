"""Fail-closed recovery for a promotion interrupted after public-file copy."""

import hashlib
import os
import subprocess
from pathlib import Path


REPO = Path(__file__).resolve().parents[3]
SCRIPT = REPO / "scripts" / "reconcile-interrupted-burbz-deploy.sh"
TARGET_SHA = "f" * 40
FINAL_SHA = "e" * 40


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def build_fixture(tmp_path: Path):
    live = tmp_path / "live"
    source = tmp_path / "source"
    live.mkdir()
    source.mkdir()
    target_files = {
        "index.html": b"<title>Burbz v347</title>\n",
        "manifest.json": b'{"name":"Burbz"}\n',
        "sound_id/server_integration.py": b"ROOK_GUARD = True\n",
    }
    old_files = {
        name: data.replace(b"v347", b"v346").replace(b"True", b"False")
        for name, data in target_files.items()
    }
    for name, data in target_files.items():
        for base in (live, source):
            path = base / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
    manifest = "".join(
        f"{digest(data)}  ./{name}\n" for name, data in old_files.items()
    )
    (live / ".burbz-managed-hashes.sha256").write_text(manifest, encoding="utf-8")
    (live / ".burbz-deployed-sha").write_text("0" * 40 + "\n", encoding="utf-8")
    return live, source, target_files


def run_recovery(live: Path, source: Path, *extra: str):
    env = dict(os.environ, BURBZ_RECOVERY_TESTING="1")
    return subprocess.run(
        [
            "bash", str(SCRIPT), "--root", str(live), "--source", str(source),
            "--expected-sha", TARGET_SHA, "--target-sha", FINAL_SHA, *extra,
        ],
        text=True,
        capture_output=True,
        env=env,
        check=False,
    )


def test_dry_run_proves_exact_partial_copy_without_changing_manifest(tmp_path):
    live, source, _ = build_fixture(tmp_path)
    before = (live / ".burbz-managed-hashes.sha256").read_bytes()
    result = run_recovery(live, source, "--dry-run")
    assert result.returncode == 0, result.stderr
    assert "Verified all 3 managed files; 2 interrupted-copy changes are byte-identical" in result.stdout
    assert "live state was not changed" in result.stdout
    assert (live / ".burbz-managed-hashes.sha256").read_bytes() == before


def test_unknown_live_edit_is_refused_and_original_manifest_survives(tmp_path):
    live, source, _ = build_fixture(tmp_path)
    (live / "index.html").write_text("unknown live edit\n", encoding="utf-8")
    before = (live / ".burbz-managed-hashes.sha256").read_bytes()
    result = run_recovery(live, source, "--no-sync")
    assert result.returncode == 1
    assert "Refusing reconciliation" in result.stdout
    assert "./index.html" in result.stdout
    assert (live / ".burbz-managed-hashes.sha256").read_bytes() == before


def test_verified_reanchor_runs_normal_updater_at_pinned_sha(tmp_path):
    live, source, target_files = build_fixture(tmp_path)
    sync = tmp_path / "fake-sync"
    sync.write_text(
        "#!/usr/bin/env bash\n"
        "set -euo pipefail\n"
        f"[[ \"$BURBZ_DEPLOY_SHA\" == \"{FINAL_SHA}\" ]]\n"
        f"cd {str(live)!r}\n"
        "find index.html manifest.json sound_id/server_integration.py -type f -print0 "
        "| sort -z | xargs -0 sha256sum > .burbz-managed-hashes.sha256.new\n"
        "mv .burbz-managed-hashes.sha256.new .burbz-managed-hashes.sha256\n"
        f"printf '%s\\n' \"$BURBZ_DEPLOY_SHA\" > {str(live / '.burbz-deployed-sha')!r}\n",
        encoding="utf-8",
    )
    sync.chmod(0o755)
    result = run_recovery(live, source, "--sync-bin", str(sync))
    assert result.returncode == 0, result.stderr
    assert "deployment reconciled and verified" in result.stdout
    assert (live / ".burbz-deployed-sha").read_text().strip() == FINAL_SHA
    for name, data in target_files.items():
        assert (live / name).read_bytes() == data
    backups = list((live / ".deploy-recovery-backups").glob("*/managed-hashes.sha256.before"))
    assert len(backups) == 1


def test_recovery_release_forces_the_normal_backend_proof():
    package = (REPO / "public/burbz/sound_id/__init__.py").read_text(encoding="utf-8")
    assert 'INTERRUPTED_DEPLOY_RECOVERY_REVISION = "v347.1"' in package
    installer = (REPO / "scripts/install-burbz-autodeploy.sh").read_text(encoding="utf-8")
    assert "sound_id/__init__.py" in installer.split("BACKEND_CHANGED=0", 1)[1]
