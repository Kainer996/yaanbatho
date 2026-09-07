"""CHA stays the sole personality stat across saved birds, previews and roles."""
import subprocess
from pathlib import Path


def test_goldcrest_personality_and_saved_card_contract():
    result = subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], capture_output=True, text=True)
    assert result.returncode == 0, result.stdout + result.stderr
