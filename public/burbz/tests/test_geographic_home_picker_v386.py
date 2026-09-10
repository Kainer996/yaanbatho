from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_home_picker_ownership_and_save_lifecycle():
    subprocess.run(['node', str(ROOT / 'tests/test_geographic_home_picker_v386.cjs')], check=True, cwd=ROOT)
