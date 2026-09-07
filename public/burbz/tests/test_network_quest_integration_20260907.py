"""Runtime integration using actual modules and extracted production handlers."""
from pathlib import Path
import subprocess


def test_network_walking_quest_integration():
    result = subprocess.run(
        ["node", "--test-reporter=tap", str(Path(__file__).with_suffix(".cjs"))],
        capture_output=True, text=True, timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    assert "# fail 0" in result.stdout
