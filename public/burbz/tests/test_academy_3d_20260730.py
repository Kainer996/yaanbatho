"""The Academy in 3D (2026-07-30).

The Academy screen gained a second, modelled view: a procedural three.js tree
carrying all ten treehouses, which the player can orbit and tap to step inside.
It is built entirely in code — no downloaded meshes — so nothing extra travels
over mobile data.

The rule these tests defend: the painted 2D Academy is still there, still
whole, and the player can always get back to it. 3D is a toggle, never a
one-way door, and it falls back by itself on a device that cannot run it.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CORE3D = (ROOT / "academy_3d_core.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
UPDATE_SH = (REPO / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")


def _run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], capture_output=True, text=True, cwd=str(ROOT), timeout=60
    )
    assert result.returncode == 0, f"node failed: {result.stderr}"
    return json.loads(result.stdout.strip().splitlines()[-1])


# ---- wiring -----------------------------------------------------------------

def test_core_module_exists_and_exports():
    assert "BurbzAcademy3D" in CORE3D
    for name in ["createAcademy3D", "ANCHORS", "STYLES", "mergeStatic",
                 "isNightHour", "lightBoostFor", "anchorPosition"]:
        assert name in CORE3D, f"the 3D engine must define {name}"


def test_index_loads_the_3d_engine_and_ships_it_everywhere():
    assert re.search(r'<script src="academy_3d_core\.js\?v=[^"]+"></script>', HTML)
    assert re.search(r"\./academy_3d_core\.js\?v=[^']+", SW), "sw.js must precache the 3D core"
    assert '"academy_3d_core.js"' in UPDATE_SH, "the live-update script must ship the 3D core"
    build = re.search(r"const BURBZ_BUILD = '([^']+)';", HTML)
    assert build and build.group(1) in SW, "build tag must match a cache marker"


def test_three_js_is_vendored_locally():
    # The 3D Academy must not depend on a CDN at runtime: the app is a PWA that
    # has to work offline once installed.
    assert (ROOT / "lib" / "three.min.js").exists()
    assert "./lib/three.min.js" in SW


# ---- the 2D Academy survives intact -----------------------------------------

def test_the_painted_2d_academy_is_still_whole():
    for marker in [
        'id="academyTreehouse"',
        'class="academy-tree-swaybg"',
        'id="treehouseRoomLayer"',
        'id="treehouseBirdLayer"',
        "academy_alive_core.js",
        "function renderAcademyTreehouse(",
    ]:
        assert marker in HTML, f"the 2D Academy lost {marker}"


def test_the_player_can_always_get_back_to_2d():
    assert 'id="academyViewToggle"' in HTML
    assert "function toggleAcademyView()" in HTML
    assert "toggleAcademyView," in HTML, "the toggle must be window-exported for its inline onclick"
    # The choice is remembered between sessions.
    assert "ACADEMY_VIEW_KEY = 'burbzAcademyView'" in HTML
    assert "localStorage.setItem(ACADEMY_VIEW_KEY" in HTML


def test_3d_failure_falls_back_to_the_painting():
    fn = re.search(r"function applyAcademyView\(\) \{.*?\n\}", HTML, re.S)
    assert fn, "missing applyAcademyView"
    body = fn.group(0)
    assert "catch (err)" in body and "academy3dBroken = true" in body, (
        "a 3D failure must be caught and remembered, never left on a black canvas"
    )
    assert "academyAliveStart()" in body, "the fallback path must start the 2D ambience"
    assert "function academySupports3D()" in HTML
    assert "webgl" in HTML, "3D must be gated on a real WebGL context"


def test_only_one_academy_runs_at_a_time():
    body = re.search(r"function applyAcademyView\(\) \{.*?\n\}", HTML, re.S).group(0)
    assert "academyAlivePause()" in body, "starting 3D must pause the 2D engine"
    assert "ACADEMY_3D.pause()" in body, "falling back to 2D must pause the 3D engine"
    assert "function academyViewPause()" in HTML
    assert "else academyViewPause();" in HTML, "leaving the Academy must pause both engines"


def test_tapping_a_building_opens_that_room():
    assert "onRoomTap: id => { SFX.tap(); openAcademyRoom(id); }" in HTML
    assert "adapter.onRoomTap" in CORE3D
    assert "Raycaster" in CORE3D, "taps are resolved against the real 3D buildings"


def test_engine_idles_when_it_is_not_on_screen():
    assert "document.hidden" in CORE3D
    assert "adapter.isScreenActive" in CORE3D
    assert "isScreenActive: () => currentScreen === 'academy'" in HTML
    assert "now - st.lastT < 14" in CORE3D, "the loop is capped at 60fps"


def test_reduced_motion_gets_a_still_scene():
    start = CORE3D[CORE3D.index("function start()"):CORE3D.index("function pause()")]
    assert "reduced()" in start and "st.running = false" in start, (
        "prefers-reduced-motion must render one still frame instead of animating"
    )


def test_the_3d_stage_never_steals_2d_taps():
    # Both stages live in one wrapper; only the visible one may take input.
    assert 'id="academyStage3D"' in HTML and "hidden>" in HTML
    rule = re.search(r"\.academy-stage-3d[^{]*\{([^}]*)\}", HTML)
    assert rule and "touch-action:none" in rule.group(1).replace(" ", "")


# ---- the world itself --------------------------------------------------------

def test_every_academy_room_has_a_place_on_the_tree():
    out = _run_node(
        """
        const c = require('./academy_3d_core.js');
        const a = Object.keys(c.ANCHORS), s = Object.keys(c.STYLES);
        const pos = a.map(id => c.anchorPosition(id));
        console.log(JSON.stringify({
          anchors: a.sort(), styles: s.sort(),
          spread: pos.map(p => Math.round(Math.hypot(p.x, p.z) * 10) / 10),
          heights: pos.map(p => p.y).sort((x, y) => x - y),
          finite: pos.every(p => isFinite(p.x) && isFinite(p.y) && isFinite(p.z)),
          labelled: s.every(k => !!c.STYLES[k].label),
          roofs: [...new Set(s.map(k => c.STYLES[k].roof))].sort()
        }));
        """
    )
    # Every buildable Academy room (all but the ground-level gardens) is placed.
    expected = ["crowbar", "dorm", "hospital", "kitchen", "nursery",
                "observatory", "quest_roost", "tavern", "training", "workshop"]
    assert out["anchors"] == expected
    assert out["styles"] == expected, "every anchored room needs a modelled building"
    assert out["finite"] and out["labelled"]
    assert min(out["spread"]) >= 3.0, "buildings must stand clear of the trunk"
    assert out["heights"][0] < 3.5 and out["heights"][-1] > 8.5, (
        "the Academy should climb the tree, not ring one storey"
    )
    assert len(out["roofs"]) >= 5, "the buildings must not all wear the same roof"


def test_no_birds_in_the_3d_academy_either():
    """Birds were pulled from both Academies, so neither may grow them back."""
    for gone in ("buildBird", "spawnBird", "BIRDS", "userData.wings"):
        assert gone not in CORE3D, f"the 3D engine still carries {gone}"


def test_day_and_night_curves_match_the_2d_engine():
    out = _run_node(
        """
        const a = require('./academy_alive_core.js');
        const b = require('./academy_3d_core.js');
        const hs = [0, 3, 5.5, 7, 12, 17.5, 19, 20, 21, 23.5];
        console.log(JSON.stringify({
          sameBoost: hs.every(h => Math.abs(a.lightBoostFor(h) - b.lightBoostFor(h)) < 1e-9),
          sameNight: hs.every(h => a.isNightHour(h) === b.isNightHour(h))
        }));
        """
    )
    assert out["sameBoost"] and out["sameNight"], (
        "both Academies must agree on when it is night — they are the same place"
    )


def test_geometry_is_merged_for_phones():
    # A treehouse is ~40 primitives and the tree ~45 limbs. Without the merge
    # pass the scene cost 780 draw calls; merged it is ~130.
    assert "function mergeStatic(" in CORE3D
    for site in ["'tree-bark'", "id + '-shell'", "'lantern-string'", "'gardens'", "'forest-floor'"]:
        assert site in CORE3D, f"merge pass missing for {site}"
    assert "vertexColors: true" in CORE3D, "merged parts keep their colours as vertex colours"


def test_the_scene_is_disposed_and_never_leaks():
    stop = CORE3D[CORE3D.index("function stop()"):]
    for freed in ["disposeScene()", "st.renderer.dispose()", "clearSharedTex()"]:
        assert freed in stop, f"stop() must release {freed}"
    disp = CORE3D[CORE3D.index("function disposeScene()"):CORE3D.index("function stop()")]
    assert "o.geometry.dispose()" in disp and "m.dispose()" in disp
    assert "shadow.map.dispose()" in disp, "shadow maps are the big GPU allocation"


def test_the_engine_never_touches_game_state():
    # It is handed what it needs through an adapter; it must not reach into the
    # save on its own.
    for forbidden in ["gameState", "localStorage", "saveState"]:
        assert forbidden not in CORE3D, f"the 3D engine must not reference {forbidden}"
