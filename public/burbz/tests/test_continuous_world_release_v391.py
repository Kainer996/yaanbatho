"""All runtime pieces of continuous walking must arrive in one offline install."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
PIN = "continuous-world-v391-20260910"
CURRENT_BUILD = "photo-recovery-v392-20260911"


def test_continuous_runtime_installation_is_complete():
    html = (ROOT / "index.html").read_text()
    walk = (ROOT / "village_walk.js").read_text()
    worker = (ROOT / "sw.js").read_text()
    updater = (ROOT.parents[1] / "scripts/update-live-burbz.sh").read_text()
    modules = ["village_walk.js", "village_walk_core.js", "village_walk_scene.js",
               "village_world_core.js", "village_world.js", "building_rooms.js",
               "village_harvest.js", "village_discoveries.js", "manga_render_core.js",
               "geographic_forest_core.js", "geographic_forest_worker.js", "geographic_map_3d.js"]
    for module in modules:
        assert (ROOT / module).is_file()
        assert f'"{module}"' in updater
        for name in ["BURBZ_ASSETS", "BURBZ_CORE", "BURBZ_INSTALL_REQUIRED"]:
            entries = re.search(rf"const {name} = \[(.*?)\];", worker, re.S)[1]
            assert entries.count(f"'./{module}?v={PIN}'") == 1, (name, module)
        if module != "geographic_forest_worker.js":
            assert f"{module}?v={PIN}" in html or f"'{module}':'{PIN}'" in walk, module
    assert f"geographic_forest_core.js?v={PIN}" in (ROOT / "geographic_forest_worker.js").read_text()
    assert f"const FOREST_PIN = '{PIN}';" in (ROOT / "geographic_map_3d.js").read_text()
    assert "geographic_forest_worker.js?v='+FOREST_PIN" in (ROOT / "geographic_map_3d.js").read_text()
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}'" in html
    assert re.search(r"const BURBZ_CACHE = '([^']+)'", worker)[1].endswith(CURRENT_BUILD)
