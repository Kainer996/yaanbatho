"""Swiping between your villages on the village screen.

Yaan's ask (2026-08-26): swipe left or right on a village to glide to the
next of your villages, in a nice smooth motion. Pinned as
`village-swipe-v332`:

- The order is the Empire boxes' order — your standalone villages, wrapping
  at both ends. Wards folded into a Town are not on the road.
- Only a village you own swipes: visiting a darkened village goes nowhere.
- A commit travels for real — villageActive moves, the save remembers it,
  the village re-renders and the Empire map follows.
- The gesture follows the finger (axis-locked so vertical drags still
  scroll), commits past 70px, springs back otherwise, and never starts on
  the 3D stage — the camera keeps its own drags.
- A pager line under the title says where you are and teaches the gesture.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "village-swipe-v332-20260826"
CURRENT_BUILD = "feeding-menu-banked-coins-v337-20260831"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def swipe_harness(probe: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    functions = "\n".join(
        function_source(html, name)
        for name in ("villageSwipeRoster", "villageSwipeNeighbour", "villageSwipeTo")
    )
    stubs = """
global.window = global;
const owned = [
  { seed: 11, name: 'Cobbleton', lat: 51.5, lon: -2.6 },
  { seed: 22, name: 'Ferndale', lat: 51.6, lon: -2.7 },
  { seed: 33, name: 'Wrenholt', lat: 51.7, lon: -2.8 },
];
let merged = new Set();
const empireStandaloneVillages = () => owned.filter(v => !merged.has(v.seed));
let villageActive = { seed: 22, name: 'Ferndale' };
let villageVisitingWard = true;
let empireLedgerOnlyMode = true;
let villageSwipeAnimating = false;
const gameState = {};
const saves = [];
const saveState = () => saves.push(gameState.lastVillage && gameState.lastVillage.seed);
const hub = { style: {} };
const $ = () => hub;
const renders = [];
const renderVillage = () => renders.push(villageActive.seed);
const focused = [];
const focusEmpireVillage = seed => focused.push(seed);
const normaliseVillageCoordinate = (value, min, max) => {
  const n = Number(value);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
};
const setTimeout = fn => fn();
const requestAnimationFrame = fn => fn();
const SFX = { tap: () => {} };
const vibrate = () => {};
"""
    return stubs + functions + "\n" + probe


# ---------------------------------------------------------------------------
# 1. The road: Empire-box order, wrapping, owned villages only
# ---------------------------------------------------------------------------

def test_neighbours_walk_your_villages_and_wrap():
    out = run_node(swipe_harness("""
const next = villageSwipeNeighbour(1).seed;
const prev = villageSwipeNeighbour(-1).seed;
const fromLast = (() => { villageActive = { seed: 33 }; return villageSwipeNeighbour(1).seed; })();
const fromFirst = (() => { villageActive = { seed: 11 }; return villageSwipeNeighbour(-1).seed; })();
console.log(JSON.stringify({ next, prev, fromLast, fromFirst }));
"""))
    assert out["next"] == 33 and out["prev"] == 11
    assert out["fromLast"] == 11 and out["fromFirst"] == 33  # the road wraps


def test_darkened_lonely_and_merged_villages_swipe_nowhere():
    out = run_node(swipe_harness("""
const visiting = (() => { villageActive = { seed: 999 }; return villageSwipeNeighbour(1); })();
const lonely = (() => { villageActive = { seed: 11 }; merged = new Set([22, 33]); const n = villageSwipeNeighbour(1); merged = new Set(); return n; })();
const pastMerged = (() => { villageActive = { seed: 11 }; merged = new Set([22]); const n = villageSwipeNeighbour(1).seed; merged = new Set(); return n; })();
console.log(JSON.stringify({ visiting, lonely, pastMerged }));
"""))
    assert out["visiting"] is None  # a village you don't own is not on the road
    assert out["lonely"] is None    # one village: nothing to swipe to
    assert out["pastMerged"] == 33  # a Town's ward is skipped, not visited


# ---------------------------------------------------------------------------
# 2. The commit: a real journey, smoothly drawn
# ---------------------------------------------------------------------------

def test_commit_travels_saves_and_rerenders():
    out = run_node(swipe_harness("""
const went = villageSwipeTo(1);
console.log(JSON.stringify({
  went,
  at: villageActive.seed,
  lat: villageActive.lat,
  saved: saves,
  renders,
  focused,
  wardCleared: villageVisitingWard === false && empireLedgerOnlyMode === false,
  settled: hub.style.transform,
}));
"""))
    assert out["went"] is True
    assert out["at"] == 33 and out["lat"] == 51.7
    assert out["saved"] == [33]        # the save remembers where you stand
    assert out["renders"] == [33]      # the next village is drawn
    assert out["focused"] == [33]      # the Empire map follows
    assert out["wardCleared"] is True
    assert out["settled"] == "translateX(0)"  # the glide ends at rest


def test_commit_refuses_mid_animation_and_off_the_road():
    out = run_node(swipe_harness("""
villageSwipeAnimating = true;
const busy = villageSwipeTo(1);
villageSwipeAnimating = false;
villageActive = { seed: 999 };
const visiting = villageSwipeTo(1);
console.log(JSON.stringify({ busy, visiting, renders }));
"""))
    assert out["busy"] is False
    assert out["visiting"] is False
    assert out["renders"] == []


# ---------------------------------------------------------------------------
# 3. The gesture and the pager, wired into the page
# ---------------------------------------------------------------------------

def test_gesture_is_axis_locked_and_spares_the_stage():
    html = HTML.read_text(encoding="utf-8")
    bind = function_source(html, "bindVillageSwipe")
    assert "closest('#villageStage')" in bind  # the camera keeps its drags
    assert "VILLAGE_SWIPE_AXIS_PX" in bind and "VILLAGE_SWIPE_COMMIT_PX" in bind
    assert "touchcancel" in bind  # an interrupted drag still springs back
    assert "const VILLAGE_SWIPE_COMMIT_PX = 70;" in html
    render = function_source(html, "renderVillage")
    assert "bindVillageSwipe()" in render


def test_pager_stands_only_with_somewhere_to_go():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="villagePager"' in html
    render = function_source(html, "renderVillage")
    assert "villages — swipe for the next" in render
    assert "owned && at >= 0 && roster.length >= 2" in render


# ---------------------------------------------------------------------------
# 4. The release pins
# ---------------------------------------------------------------------------

def test_release_pins():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if "const BURBZ_CACHE" in line)
    assert RELEASE in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
