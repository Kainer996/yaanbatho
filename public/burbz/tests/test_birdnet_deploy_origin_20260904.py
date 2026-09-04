"""The default live proof must reach Burbz, not nginx's unrelated default host."""
from pathlib import Path
import os
import shutil
import subprocess

INSTALLER = Path(__file__).resolve().parents[3] / 'scripts' / 'install-birdnet-v3.sh'


def test_live_proof_origin_defaults_to_the_service_and_preserves_explicit_override():
    text = INSTALLER.read_text(encoding='utf-8')
    assignment = next(line for line in text.splitlines() if line.startswith('HEALTH_URL='))
    script = '\n'.join([
        'unset BURBZ_HEALTH_URL', assignment, 'printf "%s\\n" "$HEALTH_URL"',
        'BURBZ_HEALTH_URL=https://example.invalid', assignment,
        'printf "%s\\n" "$HEALTH_URL"',
    ])
    bash = 'bash'
    if os.name == 'nt' and shutil.which('git'):
        git_bash = Path(shutil.which('git')).parent.parent / 'bin' / 'bash.exe'
        if git_bash.exists():
            bash = str(git_bash)
    result = subprocess.run([bash, '-c', script], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stderr
    assert result.stdout.splitlines() == ['http://127.0.0.1:5055', 'https://example.invalid']


def test_reachable_endpoint_still_requires_the_model_and_negative_proofs():
    text = INSTALLER.read_text(encoding='utf-8')
    proof = text.split('# 8. Prove the live endpoint', 1)[1]
    for check in ('LIVE_READY_ATTEMPTS=30', 'providerVerified', 'modelSha256',
                  'BLACKBIRD_RESPONSE', 'MALFORMED_RESPONSE', 'restore_failed_install'):
        assert check in proof
