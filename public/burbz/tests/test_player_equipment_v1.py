"""Shared ownership behavior and offline dependency registration."""
from pathlib import Path
import subprocess

BASE = Path(__file__).resolve().parent.parent
PIN = 'first-person-kit-v1-20260910'

def test_equipment_transactions():
    subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], check=True)

def test_offline_dependencies_are_registered_in_every_worker_list_and_updater():
    html = (BASE / 'index.html').read_text()
    worker = (BASE / 'sw.js').read_text()
    updater = (BASE.parent.parent / 'scripts/update-live-burbz.sh').read_text()
    walk = (BASE / 'village_walk.js').read_text()
    for name in ['player_equipment_core.js', 'player_equipment.js', 'player_equipment.css']:
        assert (BASE / name).is_file()
        assert f'{name}?v={PIN}' in html
        assert worker.count(f"'./{name}?v={PIN}'") == 3
        assert f'"{name}"' in updater
    for name in ['first_person_hud.js', 'first_person_hud.css']:
        assert f"'{name}':'{PIN}'" in walk
        assert worker.count(f"'./{name}?v={PIN}'") == 3
    for name in ['village_walk.js', 'geographic_world.js']:
        assert f'{name}?v={PIN}' in html
        assert worker.count(f"'./{name}?v={PIN}'") == 3
