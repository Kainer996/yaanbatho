from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_geographic_avatar_coordinates_saved_pose_and_existing_flight():
    subprocess.run(
        ['node', str(ROOT / 'tests/test_geographic_world_v386.cjs')],
        check=True,
        cwd=ROOT,
    )
