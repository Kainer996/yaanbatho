"""The game follows the real night sky, and a night open lands on a dark ear.

night-owl-dark-mode-v257-20260813: night_sky_core.js computes true sunrise and
sunset from the calendar date and the player's last known position. While the
sun is down, the whole game dims under the night veil and the Sound scan turns
owl-dark. Opening the game at night lands straight on that dark Sound scan —
sound only, no bright screens, so no owl is ever startled. With no location
fix the local clock decides, on the same fixed hours the daylight core uses.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "night_sky_core.js"

OWN_RELEASE_PIN = "night-owl-dark-mode-v257-20260813"
CURRENT_BUILD = "feedback-inbox-v258-20260813"
PREVIOUS_RELEASE_PIN = "raven-weight-and-wit-v255-20260812"


def run_core(driver: str):
    script = "const core = require('./night_sky_core.js');\n" + driver
    proc = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_real_sunrise_and_sunset_land_close_to_the_published_times():
    out = run_core("""
const t = core.sunTimesUTC(new Date('2026-08-13T12:00:00Z'), 51.5074, -0.1278);
console.log(JSON.stringify(t));
""")
    # London, 13 Aug: published sunrise ~04:47 UTC, sunset ~19:21 UTC.
    # The approximation must land within ten minutes of each.
    assert out["polar"] is None
    assert abs(out["sunriseMin"] - (4 * 60 + 47)) < 10
    assert abs(out["sunsetMin"] - (19 * 60 + 21)) < 10


def test_night_follows_the_sun_not_the_utc_clock():
    out = run_core("""
console.log(JSON.stringify({
  londonMidnight: core.isNightAt(new Date('2026-08-13T23:30:00Z'), 51.5, -0.13),
  londonNoon: core.isNightAt(new Date('2026-08-13T12:00:00Z'), 51.5, -0.13),
  sydneyLocalEvening: core.isNightAt(new Date('2026-08-13T12:00:00Z'), -33.87, 151.21),
  sydneyLocalNoon: core.isNightAt(new Date('2026-08-13T02:00:00Z'), -33.87, 151.21)
}));
""")
    assert out["londonMidnight"] is True
    assert out["londonNoon"] is False
    # Sydney's daylight window straddles UTC midnight — the wrap must hold.
    assert out["sydneyLocalEvening"] is True
    assert out["sydneyLocalNoon"] is False


def test_the_polar_edges_never_crash_and_answer_sensibly():
    out = run_core("""
console.log(JSON.stringify({
  midnightSun: core.isNightAt(new Date('2026-06-21T00:00:00Z'), 69.65, 18.96),
  polarNoon: core.isNightAt(new Date('2026-12-21T12:00:00Z'), 69.65, 18.96)
}));
""")
    assert out["midnightSun"] is False  # Tromsø in June: the sun never sets
    assert out["polarNoon"] is True     # Tromsø in December: it never rises


def test_without_a_location_the_clock_decides_on_the_daylight_core_hours():
    out = run_core("""
console.log(JSON.stringify({
  night23: core.nightDecision({ now: Date.UTC(2026, 7, 13), localHour: 23 }),
  day12: core.nightDecision({ now: Date.UTC(2026, 7, 13), localHour: 12 }),
  night4: core.nightDecision({ now: Date.UTC(2026, 7, 13), localHour: 4 }),
  withFix: core.nightDecision({ now: new Date('2026-08-13T22:30:00Z'), lat: 51.5, lon: -0.13 })
}));
""")
    assert out["night23"] == {"night": True, "source": "clock"}
    assert out["day12"] == {"night": False, "source": "clock"}
    assert out["night4"] == {"night": True, "source": "clock"}
    assert out["withFix"] == {"night": True, "source": "sun"}
    # The fallback hours mirror the daylight core's fixed window.
    assert run_core("""
console.log(JSON.stringify([core.FALLBACK_NIGHT_END_HOUR, core.FALLBACK_NIGHT_START_HOUR]));
""") == [5, 19]


def test_a_night_open_is_only_for_players_who_have_met_the_game():
    out = run_core("""
console.log(JSON.stringify({
  nightVeteran: core.shouldOpenNightListening({ night: true, introSeen: true }),
  nightNewcomer: core.shouldOpenNightListening({ night: true, introSeen: false }),
  nightMidTutorial: core.shouldOpenNightListening({ night: true, introSeen: true, tutorialBusy: true }),
  dayVeteran: core.shouldOpenNightListening({ night: false, introSeen: true })
}));
""")
    assert out["nightVeteran"] is True
    assert out["nightNewcomer"] is False  # a first open still gets the intro
    assert out["nightMidTutorial"] is False  # Merlin's tutorial keeps the floor
    assert out["dayVeteran"] is False


def test_the_game_wires_the_night_watch_and_the_owl_dark_open():
    html = HTML.read_text(encoding="utf-8")
    # The core loads with the release's own version marker.
    assert 'src="night_sky_core.js?v=night-owl-dark-mode-v257-20260813"' in html
    # The player's saved home fix feeds the decision, live position second.
    lat_lon = html[html.index("function burbzNightLatLon"):html.index("function burbzNightDecisionNow")]
    assert "gameState.lastKnownHome" in lat_lon
    assert "liveMapLastPosition" in lat_lon
    # The night class follows the decision, re-checked every minute and on
    # every return to the foreground.
    assert "document.body.classList.toggle('burbz-night', night)" in html
    assert "setInterval(applyBurbzNightMode, BURBZ_NIGHT_CHECK_MS)" in html
    assert "const BURBZ_NIGHT_CHECK_MS = 60000;" in html
    assert "if (!document.hidden) applyBurbzNightMode();" in html
    # A night open lands straight on the dark Sound scan for returning players.
    night_open = html[html.index("function maybeOpenNightListening"):html.index("function startBurbzNightWatch")]
    assert "switchScreen('scan')" in night_open
    assert "showSoundScanMode()" in night_open
    assert "BURBZ_INTRO_SEEN_KEY" in night_open
    assert "merlinChaptersSeen().includes('story')" in night_open
    assert "maybeOpenNightListening(startBurbzNightWatch());" in html  # runs at init


def test_the_night_veil_and_owl_dark_scan_are_styled_in():
    html = HTML.read_text(encoding="utf-8")
    assert '<div id="nightVeil" aria-hidden="true"></div>' in html
    assert "body.burbz-night #nightVeil { opacity:.45; }" in html
    # Sound mode is the scan screen without .camera-mode — that is the owl-dark
    # target, so Camera mode keeps its normal viewfinder brightness.
    assert "body.burbz-night #screen-scan:not(.camera-mode) { background:#020204; }" in html
    assert 'id="owlNightNote"' in html
    assert "never startle an owl" in html


def test_release_is_versioned_and_cache_lineage_kept():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert CORE.exists()
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert CURRENT_BUILD in cache_line  # head build reaches players
    assert "./night_sky_core.js?v=night-owl-dark-mode-v257-20260813" in sw  # precached
