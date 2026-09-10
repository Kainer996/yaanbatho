"""Run the actual geographic mesh/movement height contract under Node."""
from pathlib import Path
import subprocess

def test_geographic_world_scene_v386():
    subprocess.run(["node", str(Path(__file__).with_suffix(".cjs"))], check=True)
