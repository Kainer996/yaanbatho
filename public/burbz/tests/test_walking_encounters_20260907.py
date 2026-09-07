"""Ordered GPS arrival, durable chest gating and saved fictional encounters."""
from pathlib import Path
import subprocess


def test_walking_encounter_behavior():
    result = subprocess.run(
        ["node", "--test-reporter=tap", str(Path(__file__).with_suffix(".cjs"))],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "# tests 16" in result.stdout
    assert "# fail 0" in result.stdout
