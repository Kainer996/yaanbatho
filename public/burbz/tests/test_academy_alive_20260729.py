"""Academy Alive — the living treehouse ambience layer (2026-07-29).

The Academy screen has a presentation-only ambience engine
(academy_alive_core.js): the Kitchen chimney smokes, windows and lanterns
flicker on and off, The Crowbar hums with music notes, leaves drift down and
fireflies come out at night, all on one shared breeze.

Birds were deliberately taken off this screen — see
test_no_birds_anywhere_on_the_academy_tree, which is the rule the rest of the
ambience has to live within.

These tests pin the wiring (script tag, service worker, live-update script),
the safety rails (reduced motion, taps passing through), and the pure
timing helpers.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CORE = (ROOT / "academy_alive_core.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
UPDATE_SH = (REPO / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")


def _run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
        timeout=60,
    )
    assert result.returncode == 0, f"node failed: {result.stderr}"
    return json.loads(result.stdout.strip().splitlines()[-1])


# ---- wiring -----------------------------------------------------------------

def test_core_module_exists_and_exports():
    assert "BurbzAcademyAlive" in CORE
    for name in [
        "createAcademyAlive", "ANCHORS", "isNightHour", "lightBoostFor",
        "windAt", "mulberry32",
    ]:
        assert name in CORE, f"engine must export {name}"


def test_index_loads_engine_with_cache_buster():
    assert re.search(r'<script src="academy_alive_core\.js\?v=[^"]+"></script>', HTML)


def test_switch_screen_starts_and_pauses_ambience():
    # Since the 3D Academy landed, switchScreen hands the Academy to a view
    # router that runs whichever of the two Academies the player chose; leaving
    # the screen must still stop every engine.
    match = re.search(r"if \(name === 'academy'\) \{[^\n]*\}\n\s*else academyViewPause\(\);", HTML)
    assert match, "switchScreen must open the Academy view and pause it on every other screen"
    assert "applyAcademyView()" in match.group(0)
    router = re.search(r"function applyAcademyView\(\) \{.*?\n\}", HTML, re.S)
    assert router and "academyAliveStart()" in router.group(0), (
        "the 2D ambience must still be started whenever the painted Academy is shown"
    )
    pauser = re.search(r"function academyViewPause\(\) \{.*?\n\}", HTML, re.S)
    assert pauser and "academyAlivePause()" in pauser.group(0)


def test_treehouse_render_refreshes_anchors():
    assert "ACADEMY_ALIVE.refresh()" in HTML, (
        "renderAcademyTreehouse rebuilds the room nodes, so it must re-anchor the glows"
    )


def test_service_worker_and_live_update_ship_the_engine():
    assert re.search(r"\./academy_alive_core\.js\?v=[^']+", SW)
    assert "academy-alive" in SW.split("\n")[8], "BURBZ_CACHE name must be bumped for the new asset"
    assert '"academy_alive_core.js"' in UPDATE_SH


# ---- safety rails ------------------------------------------------------------

def test_no_birds_anywhere_on_the_academy_tree():
    """The Academy reads as a place, not a bird cage.

    Every bird was pulled off this screen at the player's request: the
    procedural flyers, the distant flocks, the companion sprites perched on
    the tree, and the feathers they shed. Nothing may quietly reintroduce one.
    """
    for gone in ("spawnBirdActor", "updateBirdActors", "drawBirdActors",
                 "BIRD_ARCHETYPES", "drawBirdWing", "flockRuns",
                 "spawnFeather", "'feather'"):
        assert gone not in CORE, f"the 2D engine still carries {gone}"
    assert "alive-flyer" not in HTML, "the DOM flyer layer must be gone"
    assert "academyAliveBirds" not in HTML, "the flyer roster adapter must be gone"
    assert 'class="treehouse-bird"' not in HTML, "companion sprites must not perch on the tree"


def test_the_tree_is_still_alive_without_them():
    # What must survive: smoke, window and lantern light, drifting leaves,
    # fireflies, and the swaying canopy.
    for kept in ("spawnSmoke", "updateGlows", "spawnLeaf", "drawFireflies", "drawFoliage"):
        assert kept in CORE, f"removing the birds must not cost us {kept}"


def test_reduced_motion_keeps_windows_but_skips_motion():
    assert "reducedMotion" in CORE
    start = CORE[CORE.index("function start()"):CORE.index("function pause()")]
    assert "st.reduced" in start and "return" in start, (
        "start() must bail out of the animation loop under prefers-reduced-motion"
    )
    assert "prefers-reduced-motion" in HTML


def test_tree_and_branches_sway():
    # The tree painting rides a dedicated child div with a slow wind-sway, and
    # the engine draws swaying foreground branch tufts on the front canvas.
    assert 'class="academy-tree-swaybg"' in HTML, "the sway div must exist in the treehouse markup"
    rule = re.search(r"\.academy-tree-swaybg[^{]*\{([^}]*)\}", HTML)
    assert rule and "treeSway" in rule.group(1) and "academy-tree-manga" in rule.group(1)
    assert "@keyframes treeSway" in HTML
    assert ".academy-tree-swaybg { animation:none; }" in HTML, "sway must respect reduced motion"
    assert "buildFoliage" in CORE and "drawFoliage" in CORE


def test_ambience_layers_never_eat_taps():
    for cls in [".academy-alive-canvas", ".th-alive-glow", ".academy-alive-light", ".academy-alive-shade", ".academy-tree-swaybg"]:
        rule = re.search(re.escape(cls) + r"[^{]*\{([^}]*)\}", HTML)
        assert rule, f"missing CSS for {cls}"
        assert "pointer-events:none" in rule.group(1).replace(" ", ""), (
            f"{cls} must not intercept treehouse taps (build placement relies on them)"
        )


# ---- anchors: effects sit on the real paintings -------------------------------

def test_anchor_sheets_cover_the_promised_effects():
    helpers = _run_node(
        """
        const core = require('./academy_alive_core.js');
        const kitchen = core.ANCHORS.kitchen || [];
        const crowbar = core.ANCHORS.crowbar || [];
        console.log(JSON.stringify({
          kitchenSmoke: kitchen.some(a => a.type === 'smoke'),
          crowbarNotes: crowbar.some(a => a.type === 'notes'),
          crowbarLanterns: crowbar.filter(a => a.glow === 'lantern').length,
          rooms: Object.keys(core.ANCHORS).length,
          glowKindsValid: Object.values(core.ANCHORS).flat()
            .filter(a => a.type === 'glow')
            .every(a => Object.prototype.hasOwnProperty.call(core.GLOW_STYLES, a.glow)),
          fractionsValid: Object.values(core.ANCHORS).flat()
            .every(a => a.fx >= 0 && a.fx <= 1 && a.fy >= 0 && a.fy <= 1)
        }));
        """
    )
    assert helpers["kitchenSmoke"], "the Kitchen chimney must smoke"
    assert helpers["crowbarNotes"], "The Crowbar must sing"
    assert helpers["crowbarLanterns"] >= 2, "both painted Crowbar lanterns must glow"
    assert helpers["rooms"] >= 8
    assert helpers["glowKindsValid"], "every glow anchor must reference a defined glow style"
    assert helpers["fractionsValid"], "anchors are fractions of the 112px sprite box"


# ---- pure helpers --------------------------------------------------------------

def test_night_and_light_curves():
    out = _run_node(
        """
        const core = require('./academy_alive_core.js');
        console.log(JSON.stringify({
          nightAtMidnight: core.isNightHour(0),
          nightAtNoon: core.isNightHour(12),
          duskIsNight: core.isNightHour(20),
          boostNoon: core.lightBoostFor(12),
          boostMidnight: core.lightBoostFor(0),
          duskRampMid: core.lightBoostFor(19.25),
          boostsBounded: [0, 3, 5.5, 6.5, 12, 17.5, 18, 19, 20.9, 21, 23.9]
            .every(h => core.lightBoostFor(h) >= 0 && core.lightBoostFor(h) <= 1)
        }));
        """
    )
    assert out["nightAtMidnight"] and not out["nightAtNoon"] and out["duskIsNight"]
    assert out["boostNoon"] == 0 and out["boostMidnight"] == 1
    assert 0 < out["duskRampMid"] < 1, "dusk must ramp, not snap"
    assert out["boostsBounded"]


def test_wind_is_gentle():
    out = _run_node(
        """
        const core = require('./academy_alive_core.js');
        let max = 0;
        for (let t = 0; t < 120000; t += 250) max = Math.max(max, Math.abs(core.windAt(t)));
        console.log(JSON.stringify({ max }));
        """
    )
    assert out["max"] <= 14.001, "the shared breeze must sway, not blast"
