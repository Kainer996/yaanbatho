"""Shared ownership behavior and offline dependency registration."""
from pathlib import Path
import subprocess

BASE = Path(__file__).resolve().parent.parent
PIN = 'continuous-world-v391-20260910'
HUD_PIN = 'landscape-atlas-v394-20260913'

def test_equipment_transactions():
    subprocess.run(['node', str(Path(__file__).with_suffix('.cjs'))], check=True)

def test_offline_dependencies_are_registered_in_every_worker_list_and_updater():
    html = (BASE / 'index.html').read_text()
    worker = (BASE / 'sw.js').read_text()
    updater = (BASE.parent.parent / 'scripts/update-live-burbz.sh').read_text()
    walk = (BASE / 'village_walk.js').read_text()
    for name in ['player_equipment_core.js', 'player_equipment.js', 'player_equipment.css']:
        assert (BASE / name).is_file()
        pin = PIN if name == 'player_equipment_core.js' else 'wilderness-birds-v395-20260913'
        assert f'{name}?v={pin}' in html
        assert worker.count(f"'./{name}?v={pin}'") == 3
        assert f'"{name}"' in updater
    for name in ['first_person_map.js', 'first_person_hud.js', 'first_person_hud.css']:
        pin = 'landscape-atlas-v394b-20260913' if name == 'first_person_hud.css' else 'builder-actions-v404b-20260914' if name=='first_person_hud.js' else HUD_PIN
        assert f"'{name}':'{pin}'" in walk
        assert worker.count(f"'./{name}?v={pin}'") == 3
    for name in ['village_walk.js', 'geographic_world.js']:
        pin = 'wilderness-discoveries-v406-20260914' if name == 'village_walk.js' else PIN
        assert f'{name}?v={pin}' in html
        assert worker.count(f"'./{name}?v={pin}'") == 3
