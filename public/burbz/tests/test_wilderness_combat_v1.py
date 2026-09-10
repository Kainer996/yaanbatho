"""Live walking combat core and offline dependency contract."""
from pathlib import Path
import subprocess
BASE = Path(__file__).resolve().parent.parent
PIN = 'continuous-world-v391-20260910'

def test_walking_combat_behavior():
    for name in ['test_wilderness_combat_v1.cjs', 'test_wilderness_boundaries_v1.cjs']:
        subprocess.run(['node', str(BASE / 'tests' / name)], check=True)

def test_offline_combat_dependencies_match_index_and_three_worker_lists():
    html = (BASE / 'index.html').read_text()
    worker = (BASE / 'sw.js').read_text()
    updater = (BASE.parent.parent / 'scripts/update-live-burbz.sh').read_text()
    for name in ['battle_core.js', 'first_person_spell_core.js', 'first_person_cast_controls.js', 'first_person_cast_controls.css', 'wilderness_combat_core.js', 'wilderness_combat.js', 'wilderness_combat.css']:
        assert (BASE / name).is_file()
        assert f'{name}?v={PIN}' in html
        assert worker.count(f"'./{name}?v={PIN}'") == 3
        assert f'"{name}"' in updater
