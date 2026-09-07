"""Exercise pedestrian collision and input maths in the normal pytest suite."""
from pathlib import Path
import subprocess


def test_village_walk_motion_and_collision():
    result = subprocess.run(
        ["node", str(Path(__file__).with_suffix(".cjs"))],
        capture_output=True,
        text=True,
        timeout=20,
    )
    assert result.returncode == 0, result.stdout + result.stderr
