"""Run the pure walking UI behavior contracts in the main pytest suite."""
from pathlib import Path
import subprocess


def test_walking_quest_ui_behavior_contracts():
    script = Path(__file__).with_suffix(".cjs")
    result = subprocess.run(
        ["node", str(script)], capture_output=True, text=True, timeout=30
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "PASS: 26 walking quest UI behavior contracts" in result.stdout
