"""The night veil comes down; the 3D sky keeps its days and nights.

night-veil-removed-v266-20260813: the UI night mode from v257 is removed at
Yaan's request — no more dark veil over the game, no owl-dark Sound scan, no
night boot straight onto the scan screen. The app opens and plays the same at
any hour. The real-sky daylight cycle for the 3D villages and towns
(daylight_core.js, v243) stays exactly as it was.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

CURRENT_BUILD = "mercy-streak-attack-preview-v287-20260819"
OWN_RELEASE_PIN = "night-owl-dark-mode-v257-20260813"  # the removed release's cache segment
PREVIOUS_RELEASE_PIN = "completion-notices-v265-20260813"


def test_every_trace_of_the_ui_night_mode_is_gone():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    for marker in (
        "burbz-night",            # the body class and every CSS rule under it
        "nightVeil",              # the full-screen dimming veil
        "owlNightNote",           # the owl-dark scan note
        "owl-night-note",
        "night_sky_core",         # the sunrise/sunset core and its script tag
        "BurbzNightSkyCore",
        "applyBurbzNightMode",    # the minute-by-minute night watch
        "maybeOpenNightListening" # the night boot onto the Sound scan
    ):
        assert marker not in html, marker
        assert marker not in sw, marker
    assert not (ROOT / "night_sky_core.js").exists()


def test_the_3d_sky_still_lives_its_days_and_nights():
    html = HTML.read_text(encoding="utf-8")
    # The village and town scenes keep lighting themselves from the clock.
    assert 'src="daylight_core.js?v=real-sky-daylight-v243-20260810"' in html
    assert "function burbzDaylightGradeNow()" in html
    assert "burbzDaylightPalette(basePal, daylight)" in html
    assert (ROOT / "daylight_core.js").exists()
    assert "'./daylight_core.js?v=real-sky-daylight-v243-20260810'" in SW.read_text(encoding="utf-8")


def test_release_is_versioned_and_cache_lineage_kept():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # history keeps the removed release's marker
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)  # this removal reaches players
