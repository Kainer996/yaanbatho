"""The real sky over the village — v243, 2026-08-10.

Yaan: "I want the lighting to reflect the time of day in the player's
real-life world please."

The 3D village and town scenes now light themselves from the player's local
clock. Night reproduces the game's original moonlit look exactly; midday
brings a full sun; dawn and dusk pass through a golden transition. The maths
lives in daylight_core.js (pure, Node-testable); index.html reads one grade
per scene build, rebuilds when the real sky changes phase, and falls back to
the original night if the core is missing.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "daylight_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "real-sky-daylight-v243-20260810"
PREVIOUS_RELEASE_PIN = "town-county-screens-v242-20260810"
CURRENT_BUILD = "quiet-wand-whole-art-v304-20260821"
DAYLIGHT_CORE_PIN = "real-sky-daylight-v243-20260810"


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html, name):
    start = html.index("function " + name + "(")
    return html[start:html.index("\nfunction ", start)]


# ---------------------------------------------------------------------------
# Core maths: the sun's day
# ---------------------------------------------------------------------------

def test_sun_is_down_at_night_and_up_all_day():
    factors = run_core("[0, 3, 4.9, 7, 12, 16.9, 19, 23].map(h => core.sunFactorForHour(h))")
    assert factors[0] == 0 and factors[1] == 0 and factors[2] == 0  # night
    assert factors[3] == 1 and factors[4] == 1 and factors[5] == 1  # day
    assert factors[6] == 0 and factors[7] == 0                      # night again


def test_dawn_and_dusk_ramp_smoothly():
    ramp = run_core("[5, 5.5, 6, 6.5, 7].map(h => core.sunFactorForHour(h))")
    assert ramp[0] == 0 and ramp[2] == 0.5 and ramp[4] == 1
    assert ramp == sorted(ramp)  # monotonic sunrise
    dusk = run_core("[17, 18, 19].map(h => core.sunFactorForHour(h))")
    assert dusk[0] == 1 and dusk[1] == 0.5 and dusk[2] == 0


def test_golden_hour_warmth_peaks_mid_transition_only():
    warm = run_core("[0, 6, 12, 18].map(h => core.warmFactorForHour(h))")
    assert warm[0] == 0 and warm[2] == 0    # no blush at midnight or noon
    assert warm[1] == 1 and warm[3] == 1    # full blush mid-dawn and mid-dusk


def test_phases_cover_the_clock():
    phases = run_core("[0, 5.5, 12, 18, 23].map(h => core.phaseForHour(h))")
    assert phases == ["night", "dawn", "day", "dusk", "night"]
    assert run_core("core.phaseForHour(24.5)") == "night"  # hours wrap
    assert run_core("core.phaseForHour(-1)") == "night"


def test_night_grade_is_the_original_moonlit_look():
    grade = run_core("core.daylightGradeForHour(0)")
    # These are the game's original values — a player at midnight must see
    # exactly the village the game has always drawn.
    assert grade["phase"] == "night"
    assert grade["sun"] == 0 and grade["stars"] == 1 and grade["moon"] is True
    assert grade["torch"] == 1
    assert grade["hemi"] == 2 and grade["keyIntensity"] == 1.95
    assert grade["keyColor"] == run_core("core.MOON_LIGHT")
    assert grade["exposure"] == 1.25


def test_day_grade_brings_the_sun():
    grade = run_core("core.daylightGradeForHour(12)")
    assert grade["phase"] == "day"
    assert grade["sun"] == 1 and grade["stars"] == 0 and grade["moon"] is False
    assert grade["torch"] < 0.2            # lanterns banked down
    assert grade["hemi"] > 3 and grade["keyIntensity"] > 2.5
    assert grade["keyColor"] == run_core("core.SUN_LIGHT")
    assert grade["exposure"] > 1.35


def test_palette_grading_lightens_by_day_and_rests_at_night():
    result = run_core(
        "(() => {"
        "const pal = { sky: 0x181430, ground: 0x24331a, hemiSky: 0x6a7ab0, hemiGround: 0x2a2112, plaster: 0xd9cbb0 };"
        "const night = core.gradePalette(pal, core.daylightGradeForHour(0));"
        "const noon = core.gradePalette(pal, core.daylightGradeForHour(12));"
        "return { nightSame: night === pal, noonSky: noon.sky, noonPlaster: noon.plaster, palSky: pal.sky };"
        "})()"
    )
    assert result["nightSame"] is True          # night = the authored palette, untouched
    assert result["noonSky"] != result["palSky"]  # noon re-skies the scene
    assert result["noonSky"] == run_core("core.DAY_SKY")
    assert result["noonPlaster"] == 0xD9CBB0    # materials keep their colours


def test_mix_hex_is_a_true_lerp():
    assert run_core("core.mixHex(0x000000, 0xffffff, 0)") == 0
    assert run_core("core.mixHex(0x000000, 0xffffff, 1)") == 0xFFFFFF
    assert run_core("core.mixHex(0x000000, 0xffffff, 0.5)") == 0x808080


# ---------------------------------------------------------------------------
# index.html wiring
# ---------------------------------------------------------------------------

def test_daylight_core_is_loaded_and_has_a_night_fallback():
    html = HTML.read_text(encoding="utf-8")
    assert f'<script src="daylight_core.js?v={DAYLIGHT_CORE_PIN}"></script>' in html
    grade = function_source(html, "burbzDaylightGradeNow")
    # Missing core = the original moonlit night, unchanged.
    assert "phase: 'night', sun: 0" in grade
    assert "now.getHours() + now.getMinutes() / 60" in grade


def test_village_scene_lights_itself_from_the_grade():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildVillageScene")
    assert "const daylight = burbzDaylightGradeNow();" in scene
    # The seeded palette roll survives; daylight only re-grades it.
    assert "VILLAGE_PALETTES[Math.floor(r() * VILLAGE_PALETTES.length)]" in scene
    assert "burbzDaylightPalette(basePal, daylight)" in scene
    # Stars fade, the moon yields to a sun, lanterns bank down, and the key
    # light and hemisphere take their intensities from the grade.
    assert "tierCfg.op * daylight.stars" in scene
    assert "if (daylight.moon) {" in scene
    assert "2.5 * daylight.torch" in scene
    assert "new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, daylight.hemi)" in scene
    assert "new THREE.DirectionalLight(daylight.keyColor, daylight.keyIntensity)" in scene
    assert "villageFireflies.visible = daylight.stars > 0.4" in scene
    assert "toneMappingExposure = daylight.exposure" in scene
    assert "villageBuiltPhase = daylight.phase;" in scene


def test_town_scene_lights_itself_from_the_grade():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    assert "const daylight = burbzDaylightGradeNow();" in scene
    assert "burbzDaylightPalette(basePal, daylight)" in scene
    assert "0.85 * daylight.stars" in scene
    assert "if (daylight.moon) {" in scene
    assert "1.6 * daylight.torch" in scene
    assert "new THREE.HemisphereLight(pal.hemiSky, pal.hemiGround, daylight.hemi)" in scene
    assert "new THREE.DirectionalLight(daylight.keyColor, daylight.keyIntensity)" in scene
    assert "townBuiltPhase = daylight.phase;" in scene


def test_scenes_rebuild_when_the_real_sky_changes_phase():
    html = HTML.read_text(encoding="utf-8")
    render_village = function_source(html, "renderVillage")
    assert "villageBuiltPhase !== burbzDaylightPhaseNow()" in render_village
    render_town_square = function_source(html, "renderTownSquare")
    assert "townBuiltPhase !== burbzDaylightPhaseNow()" in render_town_square
    # An open screen notices dawn on its own, without a navigation.
    village_frame = function_source(html, "villageAnimateFrame")
    assert "villageBuiltPhase !== burbzDaylightPhaseNow()" in village_frame
    town_frame = function_source(html, "townAnimateFrame")
    assert "townBuiltPhase !== burbzDaylightPhaseNow()" in town_frame


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_pinned_and_daylight_core_is_precached():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"'./daylight_core.js?v={DAYLIGHT_CORE_PIN}'" in sw
