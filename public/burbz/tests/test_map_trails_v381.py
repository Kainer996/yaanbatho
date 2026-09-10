import subprocess
from pathlib import Path

def test_map_trails_behavior():
    result = subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
