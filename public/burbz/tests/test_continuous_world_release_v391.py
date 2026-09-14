"""All runtime pieces of continuous walking must arrive in one offline install."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PIN = "continuous-world-v391-20260910"
CURRENT_BUILD = "builder-help-v404-20260914"
CAMERA_PIN = "map-camera-v403-20260914"
SKY_PIN = "distant-sky-v401-20260913"
ARRIVAL_PIN = "unified-alderwing-v400-20260913"


def test_continuous_runtime_installation_is_complete():
    html = (ROOT / "index.html").read_text()
    walk = (ROOT / "village_walk.js").read_text()
    worker = (ROOT / "sw.js").read_text()
    updater = (ROOT.parents[1] / "scripts/update-live-burbz.sh").read_text()
    modules = ["world_sky.js", "village_walk.js", "village_walk_core.js", "village_walk_scene.js",
               "village_world_core.js", "village_world.js", "building_rooms.js", "interior_life.js",
               "village_harvest.js", "village_discoveries.js", "manga_render_core.js",
               "geographic_forest_core.js", "geographic_forest_worker.js", "geographic_map_3d.js"]
    for module in modules:
        pin = CURRENT_BUILD if module == "village_walk.js" else CAMERA_PIN if module in {"geographic_map_3d.js", "building_rooms.js", "interior_life.js"} else SKY_PIN if module in {"world_sky.js", "village_world.js"} else ARRIVAL_PIN if module in {"village_walk_scene.js", "building_rooms.js", "interior_life.js", "village_discoveries.js"} else PIN
        assert (ROOT / module).is_file()
        assert f'"{module}"' in updater
        for name in ["BURBZ_ASSETS", "BURBZ_CORE", "BURBZ_INSTALL_REQUIRED"]:
            entries = re.search(rf"const {name} = \[(.*?)\];", worker, re.S)[1]
            assert entries.count(f"'./{module}?v={pin}'") == 1, (name, module)
        if module != "geographic_forest_worker.js":
            assert f"{module}?v={pin}" in html or f"'{module}':'{pin}'" in walk, module
    assert f"geographic_forest_core.js?v={PIN}" in (ROOT / "geographic_forest_worker.js").read_text()
    assert f"const FOREST_PIN = '{PIN}';" in (ROOT / "geographic_map_3d.js").read_text()
    assert "geographic_forest_worker.js?v='+FOREST_PIN" in (ROOT / "geographic_map_3d.js").read_text()
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}'" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)'", worker)[1].endswith(CURRENT_BUILD)


def test_physical_quest_buildings_install_with_their_actual_consuming_urls():
    html = (ROOT / "index.html").read_text()
    worker = (ROOT / "sw.js").read_text()
    updater = (ROOT.parents[1] / "scripts/update-live-burbz.sh").read_text()
    for module in ["geographic_details_scene.js", "geographic_places.js", "geographic_places.css"]:
        url = f"{module}?v=quest-buildings-v402-20260913"
        assert html.count(url) == 1
        assert f'"{module}"' in updater
        for name in ["BURBZ_ASSETS", "BURBZ_CORE", "BURBZ_INSTALL_REQUIRED"]:
            entries = re.search(rf"const {name} = \[(.*?)\];", worker, re.S)[1]
            assert entries.count(f"'./{url}'") == 1, (name, module)
