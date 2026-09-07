"""Swiping through the flock on the back of the bird's card.

Yaan's ask (2026-08-20): on the Equipment screen — the back of one bird's
card — a swipe left or right should flip to the next or previous companion
in the collection, with the card sliding away and the new one sliding in.
Pinned as `equip-card-swipe-v297`:

- The order is the flock's collection order, wrapping at both ends.
- The gesture follows the finger (axis-locked, so vertical drags still
  scroll), commits past 70px, and springs back otherwise — including when
  the flock holds only one bird.
- A pager line above the card says where you are and teaches the gesture.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "equip-card-swipe-v297-20260820"
CURRENT_BUILD = "companion-life-v363-20260907"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def swipe_harness(probe: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    functions = "\n".join(
        function_source(html, name)
        for name in ("birdEquipRoster", "birdEquipNeighbour", "birdEquipSwipeTo")
    )
    stubs = """
global.window = global;
const gameState = { flock: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] };
let birdEquipState = { birdId: 'b', slotPicker: 'weapon' };
let birdEquipSwipeAnimating = false;
const birdEquipSwipe = { gesture:{} };
const settlements = [];
const birdEquipSwipeSettle = delta => { settlements.push(delta); return true; };
"""
    return stubs + functions + "\n" + probe


# ---------------------------------------------------------------------------
# 1. The deck: flock order, wrapping at both ends
# ---------------------------------------------------------------------------

def test_neighbours_step_through_the_flock_and_wrap():
    out = run_node(swipe_harness("""
const fromLast = (() => { birdEquipState.birdId = 'c'; return birdEquipNeighbour(1).id; })();
const fromFirst = (() => { birdEquipState.birdId = 'a'; return birdEquipNeighbour(-1).id; })();
birdEquipState.birdId = 'b';
const lonely = (() => { gameState.flock = [{ id: 'only' }]; const n = birdEquipNeighbour(1); gameState.flock = [{id:'a'},{id:'b'},{id:'c'}]; return n; })();
console.log(JSON.stringify({ next: (birdEquipState.birdId = 'b', birdEquipNeighbour(1).id), prev: birdEquipNeighbour(-1).id, fromLast, fromFirst, lonely }));
"""))
    assert out["next"] == "c" and out["prev"] == "a"
    assert out["fromLast"] == "a" and out["fromFirst"] == "c"  # the deck wraps
    assert out["lonely"] is None  # one bird: nothing to swipe to


def test_navigation_dispatches_to_the_track_and_blocks_duplicate_button_commits():
    # Actual animation, DOM identity and commit effects are exercised in
    # run_continuous_card_swipe_20260907.cjs with real touch + intermediate frames.
    out = run_node(swipe_harness("""
const forward = birdEquipSwipeTo(1);
const clearedGesture = birdEquipSwipe.gesture === null;
birdEquipSwipeAnimating = true;
const duplicate = birdEquipSwipeTo(-1);
birdEquipSwipeAnimating = false;
const backward = birdEquipSwipeTo(-1);
gameState.flock = [{ id:'b' }];
const lonely = birdEquipSwipeTo(1);
console.log(JSON.stringify({forward,backward,duplicate,lonely,clearedGesture,settlements}));
"""))
    assert out == {"forward": True, "backward": True, "duplicate": False,
                   "lonely": False, "clearedGesture": True, "settlements": [1, -1]}


# ---------------------------------------------------------------------------
# 2. The gesture wiring on the real screen
# ---------------------------------------------------------------------------

def test_the_gesture_is_axis_locked_and_bound_once():
    html = HTML.read_text(encoding="utf-8")
    bind = function_source(html, "bindBirdEquipSwipe")
    assert "'touchstart'" in bind and "'touchmove'" in bind
    assert "'touchend'" in bind and "'touchcancel'" in bind
    # The horizontal drag must own the gesture (non-passive + preventDefault),
    # while a vertical drag stays an ordinary scroll.
    assert "{ passive: false }" in bind
    assert "e.preventDefault();" in bind
    assert "Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'" in bind
    assert "if (birdEquipSwipeBound) return;" in bind
    opener = function_source(html, "openBirdEquip")
    assert "bindBirdEquipSwipe();" in opener
    # Commit distance and axis-lock drift are named constants.
    assert "BIRD_EQUIP_SWIPE_COMMIT_PX = 70" in html
    assert "BIRD_EQUIP_SWIPE_AXIS_PX = 14" in html


def test_the_pager_names_the_gesture_and_the_place_in_the_deck():
    html = HTML.read_text(encoding="utf-8")
    render = function_source(html, "renderBirdEquip")
    assert "bird-equip-pager" in render
    assert "swipe for the next" in render
    assert "roster.length > 1" in render  # one bird: no pager, nothing to swipe
    assert ".bird-equip-pager {" in html  # styled
    assert "#birdEquipTrack { position:relative; will-change:transform; }" in html
    assert "overflow-x:hidden" in html  # the sliding card never widens the page


# ---------------------------------------------------------------------------
# 3. Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert RELEASE in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
