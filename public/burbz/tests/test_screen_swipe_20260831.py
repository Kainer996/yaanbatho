"""Swiping between the game's screens.

Yaan's ask (2026-08-31): where possible, swipe left and right to get to
different pages of the game, with a really nice smooth swiping motion.

Pinned as `screen-swipe-v336`:

- The road is the dock in reading order — Stores, Forge, Ranks, then Map,
  Quests, Empire, Scan, Academy, Battle, Burbz — wrapping at the ends.
  Kitchen, Training and Hospital open pop-ups, not screens, so the road
  passes them by; rooms, halls and the diary are off the road entirely.
- The motion is a true two-panel slide: the open screen follows the finger
  while the neighbouring screen rides in beside it, and both glide home.
- The page turns on a 70px drag, or a short sharp flick (32px inside 250ms).
- A committed swipe lands through switchScreen, so the dock lights up, the
  back trail records, and the new screen re-renders — same as a dock tap.
- The gesture is axis-locked: a vertical drag still scrolls. It never starts
  on the maps, the 3D stages, the village carousel, a sideways-scrolling
  shelf, or a form control, and an open sheet closes the road.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "screen-swipe-v336-20260831"
CURRENT_BUILD = "polished-ui-notifications-v339-20260901"
PREVIOUS_RELEASE_PIN = "every-bird-carries-its-weight-v335-20260827"


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


# The real constants and the real functions, sliced straight from the page,
# running in a small stubbed world with synchronous clocks.
def swipe_harness(probe: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    consts = "\n".join(line for line in html.splitlines() if line.startswith("const SCREEN_SWIPE_"))
    stubs = """
global.window = global;
let currentScreen = 'map';
let screenSwipeAnimating = false;
const switched = [];
const vibrations = [];
function switchScreen(name) { switched.push(name); currentScreen = name; }
function vibrate(ms) { vibrations.push(ms); }
function fakeEl(id) {
  const classes = new Set();
  return { id, style: {}, classes,
    classList: { add: c => classes.add(c), remove: c => classes.delete(c), contains: c => classes.has(c) } };
}
const els = {};
function $(id) { if (!els[id]) els[id] = fakeEl(id); return els[id]; }
const setTimeout = fn => fn();
const requestAnimationFrame = fn => fn();
"""
    return "\n".join([
        stubs,
        consts,
        function_source(html, "screenSwipeNeighbour"),
        function_source(html, "screenSwipeShouldCommit"),
        function_source(html, "screenSwipePeek"),
        function_source(html, "screenSwipeUnpeek"),
        function_source(html, "screenSwipeGlide"),
        function_source(html, "screenSwipeSpringBack"),
        probe,
    ])


# ---------------------------------------------------------------------------
# 1. The road: the dock in reading order, wrapping, pop-ups passed by
# ---------------------------------------------------------------------------

def test_the_road_walks_the_dock_and_wraps():
    probe = """
const out = {};
currentScreen = 'map';
out.mapNext = screenSwipeNeighbour(1);
out.mapPrev = screenSwipeNeighbour(-1);
currentScreen = 'scan';
out.scanNext = screenSwipeNeighbour(1);
out.scanPrev = screenSwipeNeighbour(-1);
currentScreen = 'birdex';
out.lastNext = screenSwipeNeighbour(1);
currentScreen = 'inventory';
out.firstPrev = screenSwipeNeighbour(-1);
console.log(JSON.stringify(out));
"""
    out = run_node(swipe_harness(probe))
    assert out["mapNext"] == "quests"  # Quests stands right of Map on the dock
    assert out["mapPrev"] == "leaderboards"  # back off the row onto the top deck
    assert out["scanNext"] == "academy"  # the island reads Empire · Scan · Academy
    assert out["scanPrev"] == "village"
    assert out["lastNext"] == "inventory"  # the road wraps
    assert out["firstPrev"] == "birdex"  # both ways


def test_rooms_halls_and_the_diary_are_off_the_road():
    probe = """
const out = {};
for (const name of ['academy-room', 'town', 'region', 'county', 'profile', 'diary']) {
  currentScreen = name;
  out[name] = screenSwipeNeighbour(1);
}
console.log(JSON.stringify(out));
"""
    out = run_node(swipe_harness(probe))
    for name, neighbour in out.items():
        assert neighbour is None, name  # a drill-in keeps its back button instead


def test_every_stop_has_a_dock_button():
    html = HTML.read_text(encoding="utf-8")
    road = re.search(r"const SCREEN_SWIPE_ROAD = \[([^\]]+)\];", html)
    assert road
    stops = [s.strip().strip("'") for s in road.group(1).split(",")]
    # The dock's reading order, not its DOM order — the centre island is
    # absolutely positioned mid-row, so it reads between the two low pairs.
    assert stops == ["inventory", "forge", "leaderboards", "map", "quests", "village", "scan", "academy", "battle", "birdex"]
    for stop in stops:
        assert f'data-screen="{stop}"' in html, stop  # every stop is a real dock destination


# ---------------------------------------------------------------------------
# 2. The page turn: a long drag or a quick flick
# ---------------------------------------------------------------------------

def test_a_long_drag_or_a_quick_flick_turns_the_page():
    probe = """
const out = {};
out.longDrag = screenSwipeShouldCommit(70, 900);
out.longDragLeft = screenSwipeShouldCommit(-70, 900);
out.shortDrag = screenSwipeShouldCommit(69, 400);
out.flick = screenSwipeShouldCommit(-40, 200);
out.slowForty = screenSwipeShouldCommit(40, 300);
out.tinyFlick = screenSwipeShouldCommit(-31, 100);
out.edgeFlick = screenSwipeShouldCommit(32, 250);
console.log(JSON.stringify(out));
"""
    out = run_node(swipe_harness(probe))
    assert out["longDrag"] and out["longDragLeft"]  # 70px commits either way
    assert not out["shortDrag"]  # 69px alone is not enough
    assert out["flick"]  # a quick 40px flick turns the page
    assert not out["slowForty"]  # the same 40px, dawdled, does not
    assert not out["tinyFlick"]  # a flick still needs real distance
    assert out["edgeFlick"]  # right on both thresholds counts


def test_the_thresholds_are_the_pinned_numbers():
    html = HTML.read_text(encoding="utf-8")
    assert "const SCREEN_SWIPE_COMMIT_PX = 70;" in html
    assert "const SCREEN_SWIPE_AXIS_PX = 14;" in html
    assert "const SCREEN_SWIPE_FLICK_PX = 32;" in html
    assert "const SCREEN_SWIPE_FLICK_MS = 250;" in html


# ---------------------------------------------------------------------------
# 3. The commit: a real switch under a settled page
# ---------------------------------------------------------------------------

def test_a_committed_glide_switches_screens_and_cleans_up():
    probe = """
currentScreen = 'quests';
const active = $('screen-quests');
const peek = screenSwipePeek(1);
const peeked = { name: peek.name, hasClass: peek.el.classList.contains('swipe-peek'),
  transition: peek.el.style.transition, willChange: peek.el.style.willChange };
screenSwipeGlide(peek, active);
console.log(JSON.stringify({
  peeked,
  switched, vibrations,
  now: currentScreen,
  activeTransform: active.style.transform,
  activeWillChange: active.style.willChange,
  peekClassAfter: peek.el.classList.contains('swipe-peek'),
  peekTransformAfter: peek.el.style.transform,
  animating: screenSwipeAnimating,
}));
"""
    out = run_node(swipe_harness(probe))
    assert out["peeked"]["name"] == "village"  # swiping left from Quests reveals the Empire
    assert out["peeked"]["hasClass"] and out["peeked"]["transition"] == "none"
    assert out["peeked"]["willChange"] == "transform"  # the slide rides the compositor
    assert out["switched"] == ["village"]  # the real switch, with its sound, trail and render
    assert out["vibrations"] == [12]
    assert out["now"] == "village"
    assert out["activeTransform"] == "" and out["activeWillChange"] == ""  # not a trace left
    assert not out["peekClassAfter"] and out["peekTransformAfter"] == ""
    assert out["animating"] is False  # the latch lifts once the page has settled


def test_a_throwing_render_still_lifts_the_latch_and_clears_the_styles():
    # A destination screen's own render can throw (a bad save, a missing
    # element). Before, that stranded screenSwipeAnimating forever — every
    # later swipe silently refused — and left the old screen's inline
    # translateX(±100%) in place, so the next visit sat one viewport off.
    probe = """
switchScreen = () => { throw new Error('a renderer blew up'); };
currentScreen = 'quests';
const active = $('screen-quests');
const peek = screenSwipePeek(1);
let threw = false;
try { screenSwipeGlide(peek, active); } catch (e) { threw = true; }
console.log(JSON.stringify({
  threw,
  activeTransform: active.style.transform,
  activeTransition: active.style.transition,
  activeWillChange: active.style.willChange,
  peekClassAfter: peek.el.classList.contains('swipe-peek'),
  animating: screenSwipeAnimating,
}));
"""
    out = run_node(swipe_harness(probe))
    assert out["threw"] is True  # the failure is real, not swallowed
    assert out["activeTransform"] == "" and out["activeTransition"] == "" and out["activeWillChange"] == ""
    assert not out["peekClassAfter"]
    assert out["animating"] is False  # the latch lifts regardless — swiping still works next time


def test_a_spring_back_switches_nothing():
    probe = """
currentScreen = 'quests';
const active = $('screen-quests');
const peek = screenSwipePeek(-1);
screenSwipeSpringBack(peek, active);
console.log(JSON.stringify({
  peekName: peek.name,
  switched,
  activeTransform: active.style.transform,
  peekClassAfter: peek.el.classList.contains('swipe-peek'),
  animating: screenSwipeAnimating,
}));
"""
    out = run_node(swipe_harness(probe))
    assert out["peekName"] == "map"  # swiping right from Quests had peeked the Map
    assert out["switched"] == []  # the page stayed where it was
    assert out["activeTransform"] == ""
    assert not out["peekClassAfter"]
    assert out["animating"] is False


# ---------------------------------------------------------------------------
# 4. The gesture, wired into the page and staying off other surfaces
# ---------------------------------------------------------------------------

def test_the_gesture_is_axis_locked_and_bound_once():
    html = HTML.read_text(encoding="utf-8")
    bind = function_source(html, "bindScreenSwipe")
    assert "if (screenSwipeBound) return;" in bind  # never stacks handlers
    assert "document.querySelector('.screens')" in bind  # the dock and sheets live outside
    for listener in ("touchstart", "touchmove", "touchend", "touchcancel"):
        assert listener in bind
    assert "{ passive: false }" in bind and "e.preventDefault();" in bind
    assert "if (e.cancelable) e.preventDefault();" in bind  # never fights a scroll the browser already claimed
    assert "Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'" in bind  # one axis per gesture
    assert "e.touches.length > 1" in bind  # a pinch is never a page turn
    assert "\nbindScreenSwipe();" in html  # wired at boot with the dock


def test_only_touchstart_stays_on_the_screens_the_rest_ride_on_the_document():
    # A screen can be rewritten wholesale mid-gesture by its own live ticker
    # (the quest board's refresh, the Academy's tick, a finished build) — the
    # element the touch began on can vanish. Touch events keep targeting that
    # original element and stop bubbling once it is gone, so only listeners
    # that do not depend on it surviving can still see the rest of the touch.
    html = HTML.read_text(encoding="utf-8")
    bind = function_source(html, "bindScreenSwipe")
    assert "stage.addEventListener('touchstart'" in bind
    assert "document.addEventListener('touchmove'" in bind
    assert "document.addEventListener('touchend'" in bind
    assert "document.addEventListener('touchcancel'" in bind
    assert "stage.addEventListener('touchmove'" not in bind
    assert "stage.addEventListener('touchend'" not in bind
    assert "stage.addEventListener('touchcancel'" not in bind


def test_a_cancelled_touch_only_ever_springs_back():
    # The system taking a gesture away mid-air (a notification shade, an
    # edge-back gesture, an incoming call) must never be read as a finished
    # page turn, however far the finger had already travelled.
    html = HTML.read_text(encoding="utf-8")
    bind = function_source(html, "bindScreenSwipe")
    assert "settle(e, false)" in bind  # touchend: a real release, may commit
    assert "settle(e, true)" in bind   # touchcancel: never commits
    assert "!cancelled && screenSwipeShouldCommit" in bind


def test_a_detached_touch_origin_is_caught_by_a_watchdog_not_by_an_event():
    # Confirmed in real Chromium: once the exact element a touch began on
    # leaves the document (a live re-render replacing it), the browser stops
    # delivering that touch's later events anywhere — not to the removed
    # node, not to any ancestor, not to document. Binding listeners higher up
    # does not help; only polling the node's own presence catches it.
    html = HTML.read_text(encoding="utf-8")
    bind = function_source(html, "bindScreenSwipe")
    assert "touchOrigin" in bind
    assert "!touchOrigin.isConnected" in bind
    assert "requestAnimationFrame(watchOrigin);" in bind


def test_a_live_battle_keeps_its_own_screen():
    html = HTML.read_text(encoding="utf-8")
    can_start = function_source(html, "screenSwipeCanStart")
    assert "currentScreen === 'battle' && battleState" in can_start  # a fight in progress owns the arena


def test_surfaces_with_their_own_sideways_business_keep_it():
    html = HTML.read_text(encoding="utf-8")
    can_start = function_source(html, "screenSwipeCanStart")
    assert "closest('.screen.active')" in can_start  # only the open screen swipes
    assert "SCREEN_SWIPE_KEEP_CLEAR" in can_start
    assert "SCREEN_SWIPE_LAYERS" in can_start  # an open sheet closes the road
    assert "scrollWidth > el.clientWidth" in can_start  # a real shelf keeps its scroll
    keep_clear = re.search(r"const SCREEN_SWIPE_KEEP_CLEAR = '([^']+)';", html)
    assert keep_clear
    for surface in ("#liveMapShell", "#empireMapCard", "#empireVillageHub",
                    ".village-stage", ".academy-stage-3d", ".bird-crop-stage",
                    ".camera-viewfinder", "input"):
        assert surface in keep_clear.group(1), surface


def test_the_peek_screen_is_visible_but_takes_no_touches():
    html = HTML.read_text(encoding="utf-8")
    assert ".screen.swipe-peek { opacity: 1; transform: none; transition: none; z-index: 1; }" in html
    # pointer-events stays none from the base .screen rule — the peeked
    # neighbour is scenery until the switch makes it real.
    assert "pointer-events: none" in re.search(r"\.screen \{[^}]+\}", html).group(0)


def test_the_screen_only_claims_the_horizontal_from_the_browser():
    # touch-action:pan-y hands vertical panning to the browser outright and
    # keeps every horizontal delta app-owned — without it, a slow real-finger
    # drag can cross the browser's own scroll threshold inside the 14px axis
    # dead zone, the native scroll claims the touch, and the later
    # preventDefault() (once JS locks to 'x') arrives too late to matter.
    html = HTML.read_text(encoding="utf-8")
    screen_rule = re.search(r"\.screen \{[^}]+\}", html).group(0)
    assert "touch-action: pan-y;" in screen_rule


def test_the_unpeek_restores_transitions_two_frames_late():
    # A single requestAnimationFrame can run before the browser ever paints
    # the 'none' it just set, which turns the reset itself into a live,
    # invisible-today-but-not-forever transition. The commit and spring-back
    # paths already wait two frames; unpeek must match them.
    html = HTML.read_text(encoding="utf-8")
    unpeek = function_source(html, "screenSwipeUnpeek")
    assert "requestAnimationFrame(() => requestAnimationFrame(() => { el.style.transition = ''; }));" in unpeek


# ---------------------------------------------------------------------------
# 5. The release pins
# ---------------------------------------------------------------------------

def test_release_pins():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if "const BURBZ_CACHE" in line)
    assert RELEASE in cache_line  # this release's own segment
    assert PREVIOUS_RELEASE_PIN in cache_line  # the lineage is append-only
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
