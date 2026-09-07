"""Behavioral Node suite is also part of the game's pytest release checks."""
import subprocess
from pathlib import Path


def test_walking_route_network_behavior():
    suite = Path(__file__).with_suffix('.cjs')
    result = subprocess.run(['node', '--test-reporter=tap', str(suite)], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert '# fail 0' in result.stdout, result.stdout + result.stderr
