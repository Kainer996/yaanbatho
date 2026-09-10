"""Run the footsteps and Home/countryside contracts in the normal test suite."""
from pathlib import Path
import subprocess
import pytest

@pytest.mark.parametrize('script', ['test_footsteps_20260910.cjs', 'test_home_countryside_v387.cjs'])
def test_home_countryside_contract(script):
    subprocess.run(['node', str(Path(__file__).with_name(script))], check=True)
