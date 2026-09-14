from pathlib import Path
import re
ROOT=Path(__file__).resolve().parents[1]
PIN='wilderness-discoveries-v406-20260914'
BUILD='photo-recognition-v407-20260914'
ROOM_PIN='wayside-room-title-v406b-20260914'
def test_complete_wayside_runtime_installs_atomically():
    worker=(ROOT/'sw.js').read_text(); loader=(ROOT/'village_walk.js').read_text(); html=(ROOT/'index.html').read_text(); updater=(ROOT.parents[1]/'scripts/update-live-burbz.sh').read_text()
    for module in ['wilderness_places_core.js','wilderness_places.js','wilderness_places.css','village_walk.js','village_world.js','village_walk_scene.js','building_rooms.js','interior_life.js']:
        pin=ROOM_PIN if module in {'building_rooms.js','village_walk.js'} else PIN
        assert (ROOT/module).is_file()
        assert '"'+module+'"' in updater
        for group in ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']:
            entries=re.search(r'const '+group+r' = \[(.*?)\];',worker,re.S)[1]
            assert entries.count("'./"+module+'?v='+pin+"'")==1,(group,module)
        assert module+'?v='+pin in html or "'"+module+"':'"+pin+"'" in loader
    assert "const BURBZ_BUILD = '"+BUILD+"'" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)'",worker)[1].endswith(BUILD)
