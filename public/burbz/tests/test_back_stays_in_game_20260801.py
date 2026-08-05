"""Pressing back never quits Burbz — leaving is a deliberate act in Settings.

The hardware/browser back button is trapped behind a history guard entry:
each press closes the topmost open sheet, or walks one step back through the
visited screens, or (at the map with nothing open) simply stays put. The only
way out is ⚙️ Settings → 🚪 Exit Burbz, which saves, stands the guard down and
closes the window where the platform allows it.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE_PIN = "midgame-progression-v227-20260805"
PREVIOUS_RELEASE_PIN = "back-guard-gesture-v195-20260802"


def back_section(html: str) -> str:
    start = html.index("// ANDROID BACK —")
    end = html.index("// Merlin care controls", start)
    return html[start:end]


def test_history_guard_is_armed_at_boot_and_rearmed_on_every_back_press():
    html = HTML.read_text(encoding="utf-8")
    section = back_section(html)
    assert "function armBurbzBackGuard(fromGesture)" in section
    assert "history.pushState({ [BURBZ_BACK_GUARD]: true }" in section
    # Armed once at startup...
    init_start = html.index("function init() {")
    init_end = html.index("init();", init_start)
    assert "armBurbzBackGuard();" in html[init_start:init_end]
    # ...and re-armed FIRST inside the popstate handler, before any navigation,
    # so the trap can never be exhausted by mashing back.
    pop_start = section.index("window.addEventListener('popstate'")
    handler = section[pop_start:section.index("});", pop_start)]
    assert handler.index("armBurbzBackGuard()") < handler.index("handleBurbzBackPress()")


def test_guard_survives_chromes_back_button_intervention():
    """Chrome skips history entries pushed without a user gesture — the exact
    shape of a boot-time guard — so the guard must be re-armed from inside
    real taps, and modern engines get the Navigation API cancel instead."""
    section = back_section(HTML.read_text(encoding="utf-8"))
    # One live gesture-armed guard at a time, re-armed on any tap...
    assert "burbzGuardGestureArmed" in section
    assert "document.addEventListener('pointerdown'" in section
    assert "armBurbzBackGuard(true);" in section
    # ...consumed flag cleared when a back press pops it, so the next tap re-arms.
    pop_start = section.index("window.addEventListener('popstate'")
    handler = section[pop_start:section.index("});", pop_start)]
    assert "burbzGuardGestureArmed = false;" in handler
    # Navigation API: cancel the traversal outright where the engine allows it,
    # and stand down once the player chose Exit.
    nav_start = section.index("window.navigation.addEventListener('navigate'")
    nav = section[nav_start:]
    assert "event.navigationType === 'traverse' && event.cancelable" in nav
    assert "event.preventDefault();" in nav
    assert "if (burbzExitArmed) return;" in nav


def test_back_closes_the_topmost_layer_before_changing_screens():
    section = back_section(HTML.read_text(encoding="utf-8"))
    assert "function closeTopBurbzLayer()" in section
    # One press, one layer: equipment, village shop, quest sheet, any modal.
    assert "closeBirdEquip(); return true;" in section
    assert "villageCloseShop(); return true;" in section
    assert "closeWalkQuestSheet(); return true;" in section
    assert "document.querySelector('.modal-overlay.show')" in section
    # And the press handler consults layers before touching the screen trail.
    handle = section[section.index("function handleBurbzBackPress()"):]
    assert handle.index("closeTopBurbzLayer()") < handle.index("burbzScreenTrail.pop()")


def test_back_walks_the_visited_screen_trail_then_rests_at_the_map():
    html = HTML.read_text(encoding="utf-8")
    section = back_section(html)
    assert "function recordScreenTrail(" in section
    # switchScreen feeds the trail with the screen being left...
    switch_start = html.index("function switchScreen(name) {")
    switch = html[switch_start:html.index("\n}", switch_start)]
    assert "recordScreenTrail(currentScreen);" in switch
    # ...back pops it, falls back to the map, and back-navigation itself is
    # never re-recorded (no infinite ping-pong between two screens).
    assert "burbzScreenTrail.pop()" in section
    assert "currentScreen !== 'map' ? 'map' : null" in section
    assert "if (burbzBackNavigating || !from) return;" in section
    # At rest, the game stays open and points at the real door — throttled on
    # elapsed time so mashing back doesn't spam toasts.
    assert "Settings" in section and "Exit Burbz" in section
    assert "now - burbzBackHintAt > 12000" in section


def test_exit_lives_in_settings_and_is_the_only_way_out():
    html = HTML.read_text(encoding="utf-8")
    # The Settings sheet has the exit row.
    assert 'id="exitGameBtn"' in html
    assert "Exit Burbz" in html
    section = back_section(html)
    assert "function exitBurbzGame()" in section
    # Deliberate (confirmed), saved, guard stood down, window closed if allowed.
    assert "confirm(" in section
    assert "saveState()" in section
    assert "burbzExitArmed = true;" in section
    assert "history.back()" in section
    assert "window.close()" in section
    # The popstate trap yields once (and only once) the player chose Exit.
    assert "if (burbzExitArmed) return;" in section


def test_release_is_versioned_for_the_service_worker():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in html
    cache_line = sw.split("const BURBZ_CACHE = ", 1)[1].split("\n", 1)[0]
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(RELEASE_PIN)
