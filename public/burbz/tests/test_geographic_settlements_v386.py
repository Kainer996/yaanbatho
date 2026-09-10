from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]


def test_geographic_settlement_models_preserve_saved_truth_and_entry():
    subprocess.run(['node', str(ROOT / 'tests/test_geographic_settlements_v386.cjs')], cwd=ROOT, check=True)
