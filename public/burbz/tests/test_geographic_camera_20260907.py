"""Pure screen-space camera checks, including pitched terrain projections."""
from pathlib import Path
import subprocess


def test_geographic_camera_behavior():
    result = subprocess.run(
        ["node", "--test-reporter=tap", str(Path(__file__).with_suffix(".cjs"))],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "# fail 0" in result.stdout, result.stdout + result.stderr
