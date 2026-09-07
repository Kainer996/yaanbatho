"""Actual inline walk-detail navigation and camera functions with DOM/Map doubles."""
from pathlib import Path
import subprocess


def test_walking_map_navigation_and_inspection_contracts():
    result = subprocess.run(
        ["node", str(Path(__file__).with_suffix(".cjs"))],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS: 8 walking map navigation and inspection contracts" in result.stdout
