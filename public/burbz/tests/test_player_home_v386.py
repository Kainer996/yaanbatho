from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_connected_home_anchor_and_geographic_yard():
    subprocess.run(['node', str(ROOT / 'tests/test_player_home_v386.cjs')], check=True, cwd=ROOT)
