"""Real THREE geometry and full-wave wing regression, included in the main suite."""
from pathlib import Path
import subprocess
import pytest


@pytest.mark.parametrize("script", ["test_academy_geometry_v358.cjs", "test_flock_shoulders_v358.cjs"])
def test_crafted_models_and_connected_animation(script):
    result = subprocess.run(["node", str(Path(__file__).with_name(script))], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS:" in result.stdout
