from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_town_ground_targets_and_real_building_collision():
    subprocess.run(
        ['node', str(ROOT / 'tests/test_town_walk_v385.cjs')],
        check=True,
        cwd=ROOT,
    )
