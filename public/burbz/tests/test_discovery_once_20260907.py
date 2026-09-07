"""Execute the accepted-detection regression against the shipped JS functions."""
import subprocess
from pathlib import Path


def test_discovery_rewards_are_once_per_saved_species():
    result = subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
