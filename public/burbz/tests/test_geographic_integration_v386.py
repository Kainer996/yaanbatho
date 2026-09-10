"""Actual index integration functions: navigation, replacement and onboarding."""
from pathlib import Path
import subprocess


def test_geographic_integration_v386():
    runner = Path(__file__).with_suffix('.cjs')
    result = subprocess.run(['node', str(runner)], capture_output=True, text=True, timeout=30)
    assert result.returncode == 0, result.stdout + result.stderr
