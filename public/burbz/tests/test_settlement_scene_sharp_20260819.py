"""Settlement scenes sharp again: the v281 quality caps read every phone as a
weak device — 1.25x render resolution, 512px shadows and a 30fps frame skip on
hardware that runs the scenes at 60fps easily. v285 reverts that regression and
replaces guesswork with measurement:

- a small screen never softens the render; only a weak chip opens below full
  sharpness, and even then barely;
- every tier runs at the display's native frame rate;
- a live governor (`adaptDetail`) watches real frame times and steps the
  render resolution down only on a device that proves slow — and back up the
  moment it recovers;
- the per-frame label updater no longer walks mesh trees, allocates vectors or
  raycasts the whole scene, and the render loop no longer forces a page
  reflow with getBoundingClientRect sixty times a second;
- the game viewport pins page zoom again: pinch belongs to the 3D camera.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "settlement_scene_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
OWN_RELEASE_PIN = "settlement-scene-sharp-v285-20260819"
PREVIOUS_RELEASE_PIN = "building-discovery-v284-20260819"
CURRENT_BUILD = "quiet-arena-v331-20260826"
VERSIONED_CORE = "settlement_scene_core.js?v=settlement-scene-sharp-v285-20260819"


def run_node(source: str):
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def run_core(expression: str):
    return run_node(
        f"""
const core = require({json.dumps(str(CORE))});
const result = ({expression});
process.stdout.write(JSON.stringify(result));
"""
    )


def function_source(source: str, name: str) -> str:
    start = source.index(f"function {name}(")
    end = source.find("\nfunction ", start + 10)
    if end < 0:
        end = source.find("\nconst ", start + 10)
    assert end > start, name
    return source[start:end]


# ---- The regression itself: a phone is not a weak device ---------------------

def test_phone_sized_screens_render_at_full_sharpness_and_native_rate():
    profiles = run_core(
        """({
  iphone: core.qualityProfile({width:390,height:844,dpr:3,hardwareConcurrency:6,reducedMotion:false}),
  android: core.qualityProfile({width:412,height:915,dpr:2.625,hardwareConcurrency:8,reducedMotion:false}),
  smallAndroid: core.qualityProfile({width:360,height:780,dpr:2,hardwareConcurrency:4,reducedMotion:false})
})"""
    )
    for name, profile in profiles.items():
        assert profile["tier"] != "low", f"{name} must not be softened by screen size"
        assert profile["maxDpr"] == 2, name
        assert profile["shadowSize"] == 2048, name
        assert profile["frameInterval"] == 0, f"{name} runs at native rate"


def test_only_a_genuinely_weak_chip_opens_below_full_sharpness():
    profiles = run_core(
        """({
  twoCores: core.qualityProfile({width:390,height:844,dpr:2,hardwareConcurrency:2,reducedMotion:false}),
  tinyMemory: core.qualityProfile({width:390,height:844,dpr:2,hardwareConcurrency:6,deviceMemory:2,reducedMotion:false}),
  privateMemory: core.qualityProfile({width:390,height:844,dpr:2,hardwareConcurrency:6,deviceMemory:0,reducedMotion:false})
})"""
    )
    assert profiles["twoCores"]["tier"] == "low"
    assert profiles["tinyMemory"]["tier"] == "low"
    # A browser keeping deviceMemory private must not read as a weak device.
    assert profiles["privateMemory"]["tier"] == "medium"
    # Even the low tier stays close to sharp and never frame-skips.
    assert profiles["twoCores"]["maxDpr"] == 1.75
    assert profiles["twoCores"]["shadowSize"] == 1024
    assert profiles["twoCores"]["frameInterval"] == 0


# ---- The live governor -------------------------------------------------------

def test_adapt_detail_steps_down_only_on_proven_slow_stretches():
    result = run_core(
        """({
  slow: core.adaptDetail({dpr:2, minDpr:1.25, maxDpr:2}, {frames:48, avgFrameMs:38}),
  fine: core.adaptDetail({dpr:2, minDpr:1.25, maxDpr:2}, {frames:48, avgFrameMs:24}),
  tooFewFrames: core.adaptDetail({dpr:2, minDpr:1.25, maxDpr:2}, {frames:6, avgFrameMs:80}),
  noSample: core.adaptDetail({dpr:2, minDpr:1.25, maxDpr:2}, {})
})"""
    )
    assert result["slow"] == {"dpr": 1.75, "changed": True}
    assert result["fine"] == {"dpr": 2, "changed": False}
    # A single stutter (or no data at all) never blurs the scene.
    assert result["tooFewFrames"]["changed"] is False
    assert result["noSample"]["changed"] is False


def test_adapt_detail_recovers_sharpness_and_respects_both_bounds():
    result = run_core(
        """({
  recover: core.adaptDetail({dpr:1.5, minDpr:1.25, maxDpr:2}, {frames:60, avgFrameMs:14}),
  atCeiling: core.adaptDetail({dpr:2, minDpr:1.25, maxDpr:2}, {frames:60, avgFrameMs:14}),
  atFloor: core.adaptDetail({dpr:1.25, minDpr:1.25, maxDpr:2}, {frames:60, avgFrameMs:80}),
  walkDown: (() => {
    let dpr = 2; const steps = [];
    for (let i = 0; i < 6; i++) {
      const next = core.adaptDetail({dpr, minDpr:1.25, maxDpr:2}, {frames:48, avgFrameMs:40});
      dpr = next.dpr; steps.push(next.dpr);
    }
    return steps;
  })()
})"""
    )
    assert result["recover"] == {"dpr": 1.75, "changed": True}
    assert result["atCeiling"] == {"dpr": 2, "changed": False}
    assert result["atFloor"] == {"dpr": 1.25, "changed": False}
    # A persistently slow device walks down in steps and stops at the floor.
    assert result["walkDown"] == [1.75, 1.5, 1.25, 1.25, 1.25, 1.25]


def test_renderers_open_sharp_and_report_frames_to_the_governor():
    html = HTML.read_text(encoding="utf-8")
    apply_dpr = function_source(html, "settlementSceneApplyDpr")
    assert "setPixelRatio" in apply_dpr
    # Both renderers route their pixel ratio through the governor...
    assert html.count("settlementSceneApplyDpr('village', villageRenderer") == 2
    assert html.count("settlementSceneApplyDpr('town', townRenderer") == 2
    # ...and both animate loops feed it real frame timings.
    assert "settlementSceneSampleFrame('village', ts)" in function_source(html, "villageAnimate")
    assert "settlementSceneSampleFrame('town', ts)" in function_source(html, "townAnimate")
    sampler = function_source(html, "settlementSceneSampleFrame")
    assert "adaptDetail" in sampler


# ---- The frame path carries no dead weight -----------------------------------

def test_animate_loops_no_longer_skip_frames_by_default():
    html = HTML.read_text(encoding="utf-8")
    for name in ("villageAnimate", "townAnimate"):
        loop = function_source(html, name)
        # The throttle only engages when a profile explicitly asks for one
        # (reduced motion); the old unconditional `|| 16` fallback is gone.
        assert "|| 0;" in loop, name
        assert "|| 16" not in loop, name
        assert re.search(r"if \(interval &&", loop), name


def test_label_updater_does_not_measure_meshes_or_raycast_the_world_per_frame():
    html = HTML.read_text(encoding="utf-8")
    updater = function_source(html, "settlementSceneUpdateContext")
    assert "setFromObject" not in updater, "Box3 walks belong at selection time"
    assert "new THREE.Raycaster" not in updater, "the ray is cached at selection"
    assert "scene.children" not in updater, "occlusion casts against buildings only"
    setter = function_source(html, "settlementSceneSetContext")
    assert "setFromObject" in setter
    assert "anchorLocal" in setter


def test_viewport_probe_is_cached_off_the_frame_path():
    html = HTML.read_text(encoding="utf-8")
    probe = function_source(html, "settlementSceneStageInViewport")
    assert "settlementSceneViewportCache" in probe
    assert re.search(r"<\s*250", probe), "layout reads at most a few times a second"


def test_game_viewport_pins_page_zoom():
    html = HTML.read_text(encoding="utf-8")
    viewport = re.search(
        r"<meta\b(?=[^>]*\bname=[\"']viewport[\"'])[^>]*>", html, re.IGNORECASE
    )
    assert viewport, "missing viewport meta tag"
    assert re.search(r"user-scalable\s*=\s*(?:no|0)", viewport.group(0), re.IGNORECASE)


# ---- Release plumbing --------------------------------------------------------

def test_release_pins_are_aligned():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if "const BURBZ_CACHE" in line)
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert OWN_RELEASE_PIN in cache_line, "this release's own segment is kept"
    assert PREVIOUS_RELEASE_PIN in cache_line, "the release lineage is unbroken"
    assert re.search(
        rf"<script\b[^>]*\bsrc=[\"']{re.escape(VERSIONED_CORE)}[\"'][^>]*>",
        html,
        re.IGNORECASE,
    )
    assert sw.count(f"./{VERSIONED_CORE}") >= 2, "both precache lists carry the new core pin"
    assert "settlement_scene_core.js?v=living-settlements-v281" not in html
    assert "settlement_scene_core.js?v=living-settlements-v281" not in sw
