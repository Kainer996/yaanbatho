"""Pocket lifecycle and actual quest adapter transaction regression."""
from pathlib import Path
import subprocess


def test_quest_pocket_runtime():
    runner = Path(__file__).with_suffix('.cjs')
    result = subprocess.run(['node', str(runner)], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
    assert '# fail 0' in result.stdout
