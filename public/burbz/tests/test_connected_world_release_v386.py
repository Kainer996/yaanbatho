"""The installed shell must contain the whole geographic handoff, not half a build."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
BUILD = 'home-countryside-v387-20260910'
CURRENT_BUILD = 'photo-recovery-v392-20260911'
WORLD_PIN = 'connected-world-v386-20260910'
CONTINUOUS_PIN = 'continuous-world-v391-20260910'
CHANGED = {'player_home_core.js','player_home.js','village_walk.js','geographic_world.js','geographic_world.css'}


def test_connected_world_installation_and_live_copy_are_atomic():
    html = (ROOT / 'index.html').read_text()
    worker = (ROOT / 'sw.js').read_text()
    updater = (ROOT.parents[1] / 'scripts/update-live-burbz.sh').read_text()
    modules = [
        'player_home_core.js', 'player_home_scene.js', 'player_home.js',
        'academy_flight_core.js', 'village_walk.js', 'geographic_cache.js',
        'geographic_home_picker.js', 'geographic_settlement_scene.js',
        'geographic_world_core.js', 'geographic_world.js', 'geographic_world.css',
    ]
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)'", worker)[1].endswith(CURRENT_BUILD)
    for name in ['BURBZ_ASSETS', 'BURBZ_CORE', 'BURBZ_INSTALL_REQUIRED']:
        section = re.search(rf'const {name} = \[(.*?)\];', worker, re.S)[1]
        entries = re.findall(r"^\s*['\"](\./[^'\"]+)['\"]", section, re.M)
        for renderer in ['lib/maplibre-gl.js?v=5.24.0', 'lib/maplibre-gl.css?v=5.24.0']:
            assert entries.count('./' + renderer) == 1, (name, renderer)
        for module in modules:
            assert entries.count(f'./{module}?v={CONTINUOUS_PIN if module in {'village_walk.js','geographic_world.js'} else BUILD if module in CHANGED else WORLD_PIN}') == 1, (name, module)
    for module in modules:
        assert (ROOT / module).is_file()
        assert f'"{module}"' in updater, module
        if module != 'geographic_cache.js':
            assert f'{module}?v={CONTINUOUS_PIN if module in {'village_walk.js','geographic_world.js'} else BUILD if module in CHANGED else WORLD_PIN}' in html, module
    assert f"importScripts('./geographic_cache.js?v={WORLD_PIN}');" in worker
    assert f"'academy_flight_core.js':'{WORLD_PIN}'" in (ROOT / 'village_walk.js').read_text()
    assert 'player_home.css?v=homestead-v385-20260910' in html


def test_landscape_layout_cannot_be_installed_without_its_controller_or_styles():
    html = (ROOT / 'index.html').read_text()
    worker = (ROOT / 'sw.js').read_text()
    updater = (ROOT.parents[1] / 'scripts/update-live-burbz.sh').read_text()
    for module in ['landscape_ui.js', 'landscape_ui.css']:
        assert (ROOT / module).is_file()
        assert f'{module}?v=landscape-v388-20260910' in html
        assert f'"{module}"' in updater
        for name in ['BURBZ_ASSETS', 'BURBZ_CORE', 'BURBZ_INSTALL_REQUIRED']:
            entries = re.search(rf'const {name} = \[(.*?)\];', worker, re.S)[1]
            assert entries.count(f'./{module}?v=landscape-v388-20260910') == 1
