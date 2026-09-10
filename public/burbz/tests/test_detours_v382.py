"""Continuous off-route timing and durable two-quest suspension lifecycle."""
from pathlib import Path
import subprocess


def test_saved_detour_lifecycle():
    result = subprocess.run(["node", str(Path(__file__).with_suffix(".cjs"))], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "# fail 0" in result.stdout
