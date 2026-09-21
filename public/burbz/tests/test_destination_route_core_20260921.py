"""Destination route/elevation/reward Node suite in pytest release checks."""
import subprocess
from pathlib import Path


def test_destination_route_core_behavior():
    suite = Path(__file__).with_suffix(".cjs")
    result = subprocess.run(
        ["node", "--test-reporter=tap", str(suite)],
        capture_output=True,
        text=True,
        timeout=45,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "# fail 0" in result.stdout, result.stdout + result.stderr
