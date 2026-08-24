"""Hold to steer, scroll to pass (hold-to-steer-v251-20260811).

Every 3D stage — the Academy tree, the villages, the town squares — used to
swallow every touch, so a player scrolling the page yanked the camera
instead. Now the page scrolls over the canvas as normal; only a finger held
still for a beat grabs the camera (touch_steer_core.js). A mouse or pen
steers at once, and a pinch always steers. The old quick icons have since
joined the unified bottom navigation, where they cannot cover stage controls.
Town quarters are now scenery only: a tap may explain the Hall, but cannot
reopen a consumed village.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
CORE = (ROOT / "touch_steer_core.js").read_text(encoding="utf-8")
ACADEMY = (ROOT / "academy_3d_core.js").read_text(encoding="utf-8")
UPDATER = (ROOT.parents[1] / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")
OWN_RELEASE_PIN = "hold-to-steer-v251-20260811"
PREVIOUS_RELEASE_PIN = "academy-2d-default-v250-20260811"
CURRENT_BUILD = "battle-pick-your-bird-v314-20260824"


def run_node(script: str):
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    return json.loads(run.stdout)


def test_the_gate_gives_the_page_first_claim_on_a_touch():
    out = run_node("""
const S = require('./touch_steer_core.js');
function fakeGate(opts) {
  const timers = [];
  const gate = S.createHoldGate(Object.assign({
    setTimer: (fn, ms) => { timers.push(fn); return timers.length - 1; },
    clearTimer: id => { timers[id] = null; }
  }, opts));
  gate.fire = () => { timers.forEach((fn, i) => { if (fn) { timers[i] = null; fn(); } }); };
  return gate;
}

// A swipe is a scroll: it moves past the slop, never steers, and the timer
// firing later must not grab the camera mid-scroll.
const swipe = fakeGate({});
const downSteers = swipe.down({ pointerType: 'touch', x: 100, y: 100 });
const early = swipe.move({ x: 102, y: 103 });   // within slop: still waiting
const far = swipe.move({ x: 100, y: 140 });     // a real swipe
swipe.fire();
const afterTimer = swipe.engaged;
swipe.up();

// A held finger grabs the camera, then steers.
let engagedVia = null;
const hold = fakeGate({ onEngage: at => { engagedVia = at.via; } });
hold.down({ pointerType: 'touch', x: 50, y: 50 });
hold.fire();
const holdSteers = hold.move({ x: 60, y: 60 });
hold.up();
const resetAfterUp = hold.engaged;

// A mouse steers at once; a second finger (pinch) always steers.
const mouse = fakeGate({});
const mouseSteers = mouse.down({ pointerType: 'mouse', x: 0, y: 0 });
const pinch = fakeGate({});
pinch.down({ pointerType: 'touch', x: 0, y: 0 });
pinch.down({ pointerType: 'touch', x: 40, y: 0 });
const pinchSteers = pinch.engaged;

console.log(JSON.stringify({ downSteers, early, far, afterTimer, engagedVia, holdSteers, resetAfterUp, mouseSteers, pinchSteers }));
""")
    assert out["downSteers"] is False, "a touch never steers on contact"
    assert out["early"] is False and out["far"] is False
    assert out["afterTimer"] is False, "a swipe must never turn into a grab"
    assert out["engagedVia"] == "hold"
    assert out["holdSteers"] is True
    assert out["resetAfterUp"] is False
    assert out["mouseSteers"] is True
    assert out["pinchSteers"] is True


def test_every_3d_stage_is_wired_through_the_gate():
    # The stages let vertical swipes scroll the page…
    assert "touch-action: pan-y" in HTML.split(".village-stage {")[1].split("}")[0]
    assert "touch-action:pan-y" in HTML.split(".academy-stage-3d {")[1].split("}")[0]
    assert "st.renderer.domElement.style.touchAction = 'pan-y'" in ACADEMY
    # …and each engine consults the gate before moving the camera.
    assert HTML.count("BurbzTouchSteer.createHoldGate") == 2, "village and town"
    assert "BurbzTouchSteer.createHoldGate" in ACADEMY
    assert HTML.count("if (!maySteer) return;") == 2
    assert "if (!maySteer) return;" in ACADEMY
    # Once grabbed, the page must not scroll out from under the drag.
    assert HTML.count("if (steer.engaged && e.cancelable) e.preventDefault()") == 2
    assert "if (steer.engaged && e.cancelable) e.preventDefault()" in ACADEMY
    # A grab is never a tap, and the grip is visible.
    assert HTML.count("dragged = true;\n      stage.classList.add('steering')") == 2
    assert ".village-stage.steering, .academy-stage-3d.steering" in HTML


def test_the_copy_teaches_the_hold_and_town_taps_open_management():
    for hint in [
        "Hold, then drag to look around · pinch to zoom · tap a building",
        # The governed-village lecture shrank to one line in the empire
        # declutter (2026-08-20); the gesture teaching lives on in the
        # unliberated variant below.
        "Tap a building to step inside.",
        "Hold, then drag to look around; pinch to zoom, two-finger drag to wander — then free the village",
        "Hold and drag to look around; pinch to zoom. Tap a building to run it, or anywhere else for the town ledger.",
        "🌳 The Academy in 3D — hold, then drag to look around.",
    ]:
        assert hint in HTML, hint

    # A tap outside the yards opens the town ledger (v277), but the handler
    # still contains no route back to a member village after it has joined
    # a Town.
    start = HTML.index("function ensureTownRenderer(")
    town_controls = HTML[start:HTML.index("\nfunction disposeTownScene", start)]
    assert "openTownLedgerSheet()" in town_controls
    assert "openTownBuildingSheet(obj.userData.wardSeed, obj.userData.buildingId)" in town_controls
    assert "openEmpireVillage(" not in town_controls
    assert "focusEmpireVillage(" not in town_controls
    assert "tap a district to walk its streets" not in HTML


def test_quick_icons_are_part_of_the_unified_bottom_dock():
    nav = HTML.split('id="bottomNav"')[1].split("</nav>")[0]
    assert 'data-quick-destination="kitchen"' in nav
    assert 'data-quick-destination="training"' in nav
    assert 'data-screen="inventory"' in nav
    assert '<img src="assets/ui/burbz-icon-set/quests.webp"' in nav
    assert 'id="gameSideActions"' not in HTML
    assert "navItem.scrollIntoView({ block:'nearest', inline:'center' })" in HTML
    assert "el.style.left = pointerX + 'px';" in HTML


def test_release_is_versioned_and_the_new_core_is_precached():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert f'<script src="touch_steer_core.js?v={OWN_RELEASE_PIN}"></script>' in HTML
    assert f"'./touch_steer_core.js?v={OWN_RELEASE_PIN}'" in SW
    assert f'<script src="academy_3d_core.js?v={OWN_RELEASE_PIN}"></script>' in HTML
    assert f"'./academy_3d_core.js?v={OWN_RELEASE_PIN}'" in SW
    assert '"touch_steer_core.js"' in UPDATER
