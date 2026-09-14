"""Saved village homes and slope-aware scenery behavior."""
from pathlib import Path
import subprocess
import re
ROOT=Path(__file__).resolve().parents[1]
PIN='houses-terrain-v408-20260914'
def test_houses_and_terrain_behavior():
    subprocess.run(['node','--test',str(ROOT/'tests/test_houses_terrain_v408.cjs')],check=True)
def test_home_and_landscape_install_atomically():
    html=(ROOT/'index.html').read_text();worker=(ROOT/'sw.js').read_text();loader=(ROOT/'village_walk.js').read_text()
    updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    for name in ['player_home_scene.js','village_world_core.js','village_world.js','village_walk.js']:
        pin=PIN if name=='village_world_core.js' else 'home-farming-v409-20260914'
        assert name+'?v='+pin in html or "'"+name+"':'"+pin+"'" in loader
        assert '"'+name+'"' in updater
        for group in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
            entries=re.search(r'const '+group+r' = \[(.*?)\];',worker,re.S)[1]
            assert entries.count("'./"+name+'?v='+pin+"'")==1
    current=re.search(r"const BURBZ_BUILD = '([^']+)'",html)[1]
    assert re.search(r"const BURBZ_CACHE = '([^']+)'",worker)[1].endswith(current)
