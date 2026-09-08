from pathlib import Path
import subprocess

def test_village_discoveries_runtime():
    subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], check=True)
