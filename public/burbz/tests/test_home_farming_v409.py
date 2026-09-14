from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parents[1]
PIN = 'home-farming-v409-20260914'


def test_farming_transactions_and_regressions():
    subprocess.run(['node', str(ROOT / 'tests/test_home_farming_v409.cjs')], check=True)


def test_complete_farm_installs_as_one_version():
    html = (ROOT / 'index.html').read_text()
    sw = (ROOT / 'sw.js').read_text()
    loader = (ROOT / 'village_walk.js').read_text()
    updater = (ROOT.parents[1] / 'scripts/update-live-burbz.sh').read_text()
    for name in ['player_home_core.js', 'player_home_scene.js', 'player_home.js',
                 'player_home.css', 'village_walk.js', 'village_world.js', 'geographic_world.js']:
        assert f'{name}?v={PIN}' in html or f"'{name}':'{PIN}'" in loader
        assert sw.count(f'./{name}?v={PIN}') == 3
        assert f'"{name}"' in updater
    assert "const BURBZ_BUILD = 'gemini-photos-v410-20260914'" in html
    assert "gemini-photos-v410-20260914';" in sw
