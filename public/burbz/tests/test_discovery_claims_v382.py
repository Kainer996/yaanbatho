"""Actual claim handlers: storage failure, retry and reload must not duplicate gifts."""
import subprocess
from pathlib import Path


def test_discovery_claim_transactions():
    result = subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
