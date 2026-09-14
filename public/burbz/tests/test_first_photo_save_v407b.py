"""Exercise discovery creation and photo persistence through the shipped JS funnel."""
import subprocess
from pathlib import Path


def test_first_accepted_photo_is_saved_on_the_current_discovery_record():
    result = subprocess.run(
        ["node", str(Path(__file__).with_suffix(".cjs"))],
        capture_output=True,
        text=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stdout + result.stderr
