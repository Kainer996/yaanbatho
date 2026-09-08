from pathlib import Path
import subprocess

def test_walkable_building_rooms():
    subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], check=True)
