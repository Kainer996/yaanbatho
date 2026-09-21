import subprocess
from pathlib import Path


def test_destination_state_core_contract():
    root = Path(__file__).resolve().parents[1]
    result = subprocess.run(
        ["node", "--test-reporter=tap", "tests/test_destination_state_core_20260921.cjs"],
        cwd=root,
        text=True,
        capture_output=True,
        check=False,
    )
    assert result.returncode == 0, result.stdout + result.stderr
