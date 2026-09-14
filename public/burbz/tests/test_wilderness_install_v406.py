from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
PIN='wilderness-discoveries-v406-20260914'
def test_complete_wayside_runtime_installs_atomically():
    worker=(ROOT/'sw.js').read_text(); loader=(ROOT/'village_walk.js').read_text(); html=(ROOT/'index.html').read_text(); updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    for module in ['wilderness_places_core.js','wilderness_places.js','wilderness_places.css','village_walk.js','village_world.js','village_walk_scene.js','building_rooms.js','interior_life.js']:
        assert (ROOT/module).is_file()
        assert '"'+module+'"' in updater
        for group in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
            entries=re.search(r'const '+group+r' = \[(.*?)\];',worker,re.S)[1]
            assert entries.count("'./"+module+'?v='+PIN+"'")==1,(group,module)
        assert module+'?v='+PIN in html or "'"+module+"':'"+PIN+"'" in loader
    assert "const BURBZ_BUILD = '"+PIN+"'" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)'",worker)[1].endswith(PIN)
