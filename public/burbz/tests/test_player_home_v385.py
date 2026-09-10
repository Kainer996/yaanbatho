from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]

def test_homestead_state_geometry_and_transactions():
    subprocess.run(['node', str(ROOT / 'tests/test_player_home_v385.cjs')], check=True, cwd=ROOT)
