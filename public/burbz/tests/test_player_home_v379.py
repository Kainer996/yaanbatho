from pathlib import Path
import subprocess
ROOT = Path(__file__).resolve().parents[1]

def test_personal_home_transactions_and_walkable_placement():
    subprocess.run(['node',str(ROOT/'tests/test_player_home_v379.cjs')],check=True,cwd=ROOT)

def test_personal_home_assets_install_atomically():
    html=(ROOT/'index.html').read_text();sw=(ROOT/'sw.js').read_text();updater=(ROOT.parent.parent/'scripts/update-live-burbz.sh').read_text()
    for name in ['player_home.css','player_home_core.js','player_home_scene.js','player_home.js']:
        assert name+'?v=player-home-v380-20260909' in html
        assert sw.count("'./"+name+'?v=player-home-v380-20260909'+"'")==3
        assert '"'+name+'"' in updater
    assert 'initializePlayerHome();' in html
    assert 'if (window.BurbzPlayerHome?.back()) return true;' in html
