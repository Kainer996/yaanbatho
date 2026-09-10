"""The enchanted field desk reports saved facts and respects feature gates."""
import subprocess
from pathlib import Path


def test_field_desk_state_projection():
    script = Path(__file__).with_suffix('.cjs')
    result = subprocess.run(['node', str(script)], text=True, capture_output=True)
    assert result.returncode == 0, result.stdout + result.stderr
