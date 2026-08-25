"""A live quest holds the camera where the trail still fits on screen.

Yaan's ask (2026-08-18, from a screenshot mid-walk on "Mapped Footpath I"):
zoomed right in, the player marker drifts clear of the drawn footpath and the
golden line runs off the edge, so a good walk starts to look inaccurate. While
a walking quest is live the map now holds a zoom ceiling that keeps the player
and the next waymarker in one frame.

This release (quest-zoom-lock-v282-20260818) pins:

- a walking band, QUEST_WALK_ZOOM_FLOOR to QUEST_WALK_ZOOM_CEILING, well under
  the free map's BURBZ_MAX_ZOOM,
- a ceiling fitted to the marker ahead: far marker holds the camera wide, near
  marker lets the player lean in,
- the lock following the walk — applied on every quest redraw and every
  position fix, lifted when the quest leaves the map,
- the + button and pinch stopping at the ceiling, with one warm toast saying
  why.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW = ROOT / "sw.js"
HTML = HTML_PATH.read_text(encoding="utf-8")

OWN_RELEASE_PIN = "quest-zoom-lock-v282-20260818"
PREVIOUS_RELEASE_PIN = "living-settlements-v281-20260817"
CURRENT_BUILD = "art-same-origin-v325-20260825"

CONSTANTS = ("QUEST_WALK_ZOOM_FLOOR", "QUEST_WALK_ZOOM_CEILING", "QUEST_WALK_FRAME_MIN_M")


def constant(name: str) -> float:
    match = re.search(rf"^const {name} = ([\d.]+);", HTML, re.M)
    assert match, f"{name} is not declared as a top-level constant"
    return float(match.group(1))


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start
    return HTML[start:end]


def ceiling_for(dist_m, lat=51.5, viewport_px=576):
    """Run the shipped ceiling maths in node, with its own constants."""
    preamble = "".join(f"const {name} = {constant(name)};\n" for name in CONSTANTS)
    script = (
        preamble
        + function_source("questWalkZoomCeiling")
        + f"\nconsole.log(JSON.stringify(questWalkZoomCeiling({json.dumps(dist_m)}, {lat}, {viewport_px})));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# The walking band
# ---------------------------------------------------------------------------

def test_walking_band_sits_under_the_free_map_ceiling():
    free_max = float(re.search(r"^const BURBZ_MAX_ZOOM = ([\d.]+);", HTML, re.M).group(1))
    resting = float(re.search(r"^const BURBZ_START_ZOOM = ([\d.]+);", HTML, re.M).group(1))
    floor, ceiling = constant("QUEST_WALK_ZOOM_FLOOR"), constant("QUEST_WALK_ZOOM_CEILING")
    assert ceiling < free_max  # a quest never zooms as far in as the free map
    assert floor > resting  # there is always room to lean in from the resting camera
    assert floor < ceiling


def test_a_far_marker_holds_the_camera_at_the_floor():
    # 400 m of trail ahead: the tightest allowed view is the floor of the band.
    assert ceiling_for(400) == constant("QUEST_WALK_ZOOM_FLOOR")
    assert ceiling_for(200) == constant("QUEST_WALK_ZOOM_FLOOR")


def test_a_near_marker_lets_the_player_lean_in():
    near, mid, far = ceiling_for(30), ceiling_for(100), ceiling_for(250)
    assert near > mid > far  # the closer the marker, the more zoom the lock allows
    assert near <= constant("QUEST_WALK_ZOOM_CEILING")
    assert mid > constant("QUEST_WALK_ZOOM_FLOOR")


def test_the_ceiling_never_leaves_the_band():
    for dist in (1, 5, 40, 120, 900, 5000):
        value = ceiling_for(dist)
        assert constant("QUEST_WALK_ZOOM_FLOOR") <= value <= constant("QUEST_WALK_ZOOM_CEILING"), dist


def test_no_marker_and_no_fix_still_lock_the_zoom():
    # Without a position fix the game still refuses the free map's tightest zoom.
    for missing in (None, 0, -5, "nonsense"):
        assert ceiling_for(missing) == constant("QUEST_WALK_ZOOM_CEILING")


def test_a_small_screen_frames_the_same_ground_by_zooming_out():
    assert ceiling_for(120, viewport_px=320) < ceiling_for(120, viewport_px=900)


# ---------------------------------------------------------------------------
# The lock follows the walk
# ---------------------------------------------------------------------------

def test_the_lock_applies_on_every_quest_redraw():
    body = function_source("drawWalkingQuestOnMap")
    assert "applyQuestZoomLock();" in body


def test_the_lock_retunes_on_every_position_fix():
    fix = HTML[HTML.index("const checkpointProgressed ="):]
    assert "applyQuestZoomLock();" in fix[:900]


def test_the_lock_lifts_when_the_quest_leaves_the_map():
    body = function_source("clearWalkingQuestFromMap")
    assert "releaseQuestZoomLock();" in body
    release = function_source("releaseQuestZoomLock")
    assert "setLiveMapMaxZoom(BURBZ_MAX_ZOOM);" in release  # the free map is handed back whole
    assert "told:false" in release  # the next quest may explain itself again


def test_no_quest_means_no_lock():
    apply_src = function_source("applyQuestZoomLock")
    assert "if (!activeWalkingQuest()) { releaseQuestZoomLock(); return; }" in apply_src
    assert "liveMap.setMaxZoom" in function_source("setLiveMapMaxZoom")


def test_a_too_tight_camera_eases_out_instead_of_snapping():
    apply_src = function_source("applyQuestZoomLock")
    assert "liveMap.easeTo({ zoom:ceiling" in apply_src
    assert "liveMap.once('moveend', closeCeiling);" in apply_src  # the ceiling closes after the ease


def test_the_ceiling_closes_even_when_the_ease_never_lands():
    # A map that reports no moveend (no style, no render loop) must not be left
    # with the lock open — a short timer closes the ceiling either way.
    apply_src = function_source("applyQuestZoomLock")
    assert "setTimeout(closeCeiling, 520);" in apply_src


# ---------------------------------------------------------------------------
# Controls stop at the ceiling, and say so once
# ---------------------------------------------------------------------------

def test_the_zoom_button_stops_at_the_quest_ceiling():
    button = HTML[HTML.index("function zoomLiveMapBy("):]
    button = button[:button.index("\n")]
    assert "Math.min(liveMapZoomCeiling(), from + delta)" in button
    assert "BURBZ_MAX_ZOOM" not in button  # the free ceiling no longer decides during a quest
    assert "tellQuestZoomLockOnce();" in button
    ceiling_fn = function_source("liveMapZoomCeiling")
    assert "questZoomLock.on" in ceiling_fn and "BURBZ_MAX_ZOOM" in ceiling_fn


def test_a_pinch_that_lands_on_the_ceiling_is_explained():
    assert "tellQuestZoomLockIfHeld();" in HTML
    held = function_source("tellQuestZoomLockIfHeld")
    assert "questZoomLock.ceiling - 0.02" in held


def test_the_explanation_is_short_warm_and_said_once():
    told = function_source("tellQuestZoomLockOnce")
    assert "🔒 Zoom held here so your trail stays on screen" in told
    assert "if (!questZoomLock.on || questZoomLock.told) return;" in told
    assert "questZoomLock.told = true;" in told


def test_the_lock_is_readable_from_the_map_debug_surface():
    assert "get questZoomLock() { return questZoomLock; }" in HTML
    assert "questZoomCeiling() { return liveMapZoomCeiling(); }" in HTML


# ---------------------------------------------------------------------------
# Release stamps
# ---------------------------------------------------------------------------

def test_release_is_stamped_and_cached_offline():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.read_text(encoding="utf-8").splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
