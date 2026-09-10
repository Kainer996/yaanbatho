from pathlib import Path
import subprocess


def test_actual_tree_felling_geometry_and_daily_restoration():
    result = subprocess.run(["node", str(Path(__file__).with_suffix(".cjs"))], capture_output=True, text=True, timeout=45)
    assert result.returncode == 0, result.stdout + result.stderr
