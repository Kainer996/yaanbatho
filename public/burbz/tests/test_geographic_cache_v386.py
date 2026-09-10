from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_geographic_cache_bounds_authority_and_failures():
    subprocess.run(['node', str(ROOT / 'tests/test_geographic_cache_v386.cjs')], check=True, cwd=ROOT)
