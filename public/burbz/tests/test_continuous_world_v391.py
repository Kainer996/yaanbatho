"""Real-metre terrain seams, stable scenery and bounded authored corridors."""
from pathlib import Path
import subprocess


def test_continuous_world_geometry_and_motion():
    subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], check=True)
