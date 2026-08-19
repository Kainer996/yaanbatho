"""Pure scene-policy contracts for the upgraded village and Town views."""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "settlement_scene_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
UPDATER = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
LOADING_ART = ROOT / "assets" / "settlements" / "settlement-loading-v281.webp"
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


def javascript_array_source(source: str, name: str) -> str:
    """Return a named, top-level JavaScript array without parsing all JS."""
    match = re.search(
        rf"(?m)^\s*(?:const|let|var)\s+{re.escape(name)}\s*=\s*\[",
        source,
    )
    assert match, f"missing JavaScript array {name}"
    end = source.find("\n];", match.end())
    assert end >= 0, f"unterminated JavaScript array {name}"
    return source[match.start() : end + 3]


def shell_array_source(source: str, name: str) -> str:
    match = re.search(rf"(?m)^{re.escape(name)}=\(\s*$", source)
    assert match, f"missing shell array {name}"
    end = source.find("\n)", match.end())
    assert end >= 0, f"unterminated shell array {name}"
    return source[match.start() : end + 2]


def start_tag_with_id(source: str, element_id: str) -> str:
    match = re.search(
        rf"<[a-z][^>]*\bid=[\"']{re.escape(element_id)}[\"'][^>]*>",
        source,
        re.IGNORECASE,
    )
    assert match, f"missing element #{element_id}"
    return match.group(0)


def top_level_function_source(source: str, name: str) -> str:
    match = re.search(rf"(?m)^function\s+{re.escape(name)}\s*\(", source)
    assert match, f"missing function {name}"
    next_function = re.search(r"(?m)^function\s+", source[match.end() :])
    end = (
        match.end() + next_function.start()
        if next_function
        else len(source)
    )
    return source[match.start() : end]


def test_core_has_commonjs_and_browser_umd_exports():
    result = run_node(
        f"""
const fs = require('fs');
const vm = require('vm');
const source = fs.readFileSync({json.dumps(str(CORE))}, 'utf8');
const browser = {{}};
vm.createContext(browser);
vm.runInContext(source, browser);
const common = require({json.dumps(str(CORE))});
process.stdout.write(JSON.stringify({{
  browser: Object.keys(browser.BurbzSettlementSceneCore).sort(),
  common: Object.keys(common).sort(),
  sameFunctions: Object.keys(common).every(key => typeof common[key] === 'function')
}}));
"""
    )
    expected = sorted(
        ["qualityProfile", "adaptDetail", "selectSceneLabels", "shouldRunScene", "motionScale"]
    )
    assert result == {"browser": expected, "common": expected, "sameFunctions": True}


def test_quality_profiles_are_deterministic_and_device_appropriate():
    profiles = run_core(
        """({
  low: core.qualityProfile({width:390,height:844,dpr:3,hardwareConcurrency:2,reducedMotion:false}),
  medium: core.qualityProfile({width:768,height:600,dpr:2,hardwareConcurrency:6,reducedMotion:false}),
  high: core.qualityProfile({width:1440,height:900,dpr:2,hardwareConcurrency:12,reducedMotion:false}),
  highAgain: core.qualityProfile({width:1440,height:900,dpr:2,hardwareConcurrency:12,reducedMotion:false})
})"""
    )
    # v285: only a genuinely weak chip lands in "low" — and even low keeps
    # near-full sharpness and native-rate frames. A phone-sized screen alone
    # must never soften the render (that was the v281 regression).
    assert profiles["low"] == {
        "tier": "low",
        "maxDpr": 1.75,
        "shadowSize": 1024,
        "frameInterval": 0,
        "maxAmbientActors": 8,
        "maxLabels": 3,
    }
    assert profiles["medium"] == {
        "tier": "medium",
        "maxDpr": 2,
        "shadowSize": 2048,
        "frameInterval": 0,
        "maxAmbientActors": 18,
        "maxLabels": 5,
    }
    assert profiles["high"] == profiles["highAgain"] == {
        "tier": "high",
        "maxDpr": 2,
        "shadowSize": 2048,
        "frameInterval": 0,
        "maxAmbientActors": 32,
        "maxLabels": 8,
    }


def test_reduced_motion_removes_ambient_actors_without_blurring_static_scene():
    result = run_core(
        """({
  normal: core.qualityProfile({width:1440,height:900,dpr:2,hardwareConcurrency:12,reducedMotion:false}),
  reduced: core.qualityProfile({width:1440,height:900,dpr:2,hardwareConcurrency:12,reducedMotion:true})
})"""
    )
    assert result["reduced"]["tier"] == result["normal"]["tier"] == "high"
    assert result["reduced"]["maxDpr"] == result["normal"]["maxDpr"]
    assert result["reduced"]["shadowSize"] == result["normal"]["shadowSize"]
    assert result["reduced"]["maxLabels"] == result["normal"]["maxLabels"]
    assert result["reduced"]["maxAmbientActors"] == 0
    assert result["reduced"]["frameInterval"] == 33


def test_label_selection_filters_hidden_and_offscreen_candidates():
    result = run_core(
        """core.selectSceneLabels([
  {id:'ok',x:10,y:10,width:30,height:20},
  {id:'hidden',x:50,y:10,width:30,height:20,hidden:true},
  {id:'invisible',x:90,y:10,width:30,height:20,visible:false},
  {id:'behind',x:130,y:10,width:30,height:20,behindCamera:true},
  {id:'explicit-offscreen',x:170,y:10,width:20,height:20,offscreen:true},
  {id:'clipped-left',x:-1,y:50,width:30,height:20},
  {id:'outside-padding',x:186,y:50,width:10,height:20},
  {id:'rect-shape',rect:{left:60,top:60,right:100,bottom:82}}
], {width:200,height:100,maxLabels:10,padding:5,gap:0}).map(x => x.id)"""
    )
    assert result == ["ok", "rect-shape"]


def test_selected_then_priority_then_distance_win_collisions():
    result = run_core(
        """core.selectSceneLabels([
  {id:'near-low',x:20,y:20,width:50,height:24,priority:1,distance:2},
  {id:'far-high',x:25,y:22,width:50,height:24,priority:9,distance:90},
  {id:'selected',x:28,y:24,width:50,height:24,priority:-10,distance:999},
  {id:'priority-winner',x:110,y:20,width:42,height:22,priority:4,distance:40},
  {id:'near-loser',x:112,y:21,width:42,height:22,priority:4,distance:3},
  {id:'clear',x:170,y:65,width:40,height:20,priority:0,distance:1}
], {width:240,height:110,maxLabels:3,padding:4,gap:4,selectedId:'selected'}).map(x => x.id)"""
    )
    # Selected wins its collision group. Equal-priority labels use distance,
    # while a non-colliding third label remains available.
    assert result == ["selected", "near-loser", "clear"]


def test_label_selection_has_stable_ties_gap_and_limit_without_mutation():
    result = run_core(
        """(() => {
  const rows = [
    {id:'first',x:10,y:10,width:20,height:20,priority:2,distance:5},
    {id:'second',x:35,y:10,width:20,height:20,priority:2,distance:5},
    {id:'third',x:80,y:10,width:20,height:20,priority:2,distance:5}
  ];
  const before = JSON.stringify(rows);
  const picked = core.selectSceneLabels(rows,{width:140,height:60,maxLabels:2,padding:0,gap:6});
  return {ids:picked.map(x => x.id), unchanged:before === JSON.stringify(rows)};
})()"""
    )
    # first and second have only five pixels between them, so the requested
    # six-pixel gap culls second; equal ranked survivors keep input order.
    assert result == {"ids": ["first", "third"], "unchanged": True}


def test_scene_visibility_requires_every_runtime_gate():
    result = run_core(
        """({
  running: core.shouldRunScene({screenActive:true,detailsOpen:true,inViewport:true,documentHidden:false}),
  screen: core.shouldRunScene({screenActive:false,detailsOpen:true,inViewport:true,documentHidden:false}),
  details: core.shouldRunScene({screenActive:true,detailsOpen:false,inViewport:true,documentHidden:false}),
  viewport: core.shouldRunScene({screenActive:true,detailsOpen:true,inViewport:false,documentHidden:false}),
  hidden: core.shouldRunScene({screenActive:true,detailsOpen:true,inViewport:true,documentHidden:true}),
  empty: core.shouldRunScene({})
})"""
    )
    assert result == {
        "running": True,
        "screen": False,
        "details": False,
        "viewport": False,
        "hidden": False,
        "empty": False,
    }


def test_motion_scale_is_binary_and_predictable():
    assert run_core(
        "[core.motionScale(false),core.motionScale(true),core.motionScale(0),core.motionScale(1)]"
    ) == [1, 0, 1, 0]


def test_release_loads_and_precaches_the_versioned_scene_core_and_loading_art():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    updater = UPDATER.read_text(encoding="utf-8")

    assert re.search(
        rf"<script\b[^>]*\bsrc=[\"']{re.escape(VERSIONED_CORE)}[\"'][^>]*>",
        html,
        re.IGNORECASE,
    )

    cached_core = f"./{VERSIONED_CORE}"
    for array_name in ("BURBZ_ASSETS", "BURBZ_CORE", "BURBZ_INSTALL_REQUIRED"):
        assert cached_core in javascript_array_source(sw, array_name)

    assets = javascript_array_source(sw, "BURBZ_ASSETS")
    assert "./assets/settlements/settlement-loading-v281.webp" in assets
    assert LOADING_ART.is_file()
    loading_bytes = LOADING_ART.read_bytes()
    assert len(loading_bytes) > 1_000
    assert loading_bytes[:4] == b"RIFF" and loading_bytes[8:12] == b"WEBP"

    release_files = shell_array_source(updater, "FILES")
    assert '"settlement_scene_core.js"' in release_files
    assert '"assets/settlements/settlement-loading-v281.webp"' in release_files


def test_mobile_viewport_pins_page_zoom_because_pinch_is_a_game_gesture():
    # v285 restores the long-standing game viewport: pinch belongs to the 3D
    # camera and the map, so the page itself must not zoom underneath them.
    html = HTML.read_text(encoding="utf-8")
    viewport = re.search(
        r"<meta\b(?=[^>]*\bname=[\"']viewport[\"'])[^>]*>",
        html,
        re.IGNORECASE,
    )
    assert viewport, "missing viewport meta tag"
    viewport_source = viewport.group(0)
    assert re.search(
        r"user-scalable\s*=\s*(?:no|0)", viewport_source, re.IGNORECASE
    )


def test_both_settlement_stages_have_accessible_hud_and_camera_reset_controls():
    html = HTML.read_text(encoding="utf-8")

    for context in ("village", "town"):
        stage = start_tag_with_id(html, f"{context}Stage")
        assert re.search(r"\brole=[\"']application[\"']", stage, re.IGNORECASE)
        assert re.search(r"\btabindex=[\"']0[\"']", stage, re.IGNORECASE)
        assert start_tag_with_id(html, f"{context}StageHud")
        assert start_tag_with_id(html, f"{context}SceneLabels")
        assert start_tag_with_id(html, f"{context}SceneInspector")
        assert re.search(
            rf"<button\b[^>]*\bdata-scene-camera=[\"']{context}-reset[\"'][^>]*>",
            html,
            re.IGNORECASE,
        )

    # The controls are not decorative: runtime either binds the data selector
    # directly or handles the equivalent dataset field through delegation.
    assert re.search(
        r"querySelector(?:All)?\s*\([^)]*data-scene-camera",
        html,
        re.IGNORECASE,
    ) or re.search(r"dataset\.sceneCamera", html)


def test_town_stage_precedes_hall_without_reintroducing_a_collapsible_square():
    html = HTML.read_text(encoding="utf-8")

    assert html.index('id="townStage"') < html.index('id="townHallPanel"')
    assert not re.search(
        r"\bid=[\"']townSquareDetails[\"']", html, re.IGNORECASE
    )

    copy = html.casefold()
    assert "flavour only" not in copy
    assert "flavor only" not in copy

def test_runtime_wires_context_labels_and_scene_policy_hooks():
    html = HTML.read_text(encoding="utf-8")

    # The UMD global must be consumed by runtime, not merely loaded by a tag.
    assert "BurbzSettlementSceneCore" in html
    for api_name in (
        "selectSceneLabels",
        "qualityProfile",
        "shouldRunScene",
        "motionScale",
    ):
        assert re.search(rf"\.\s*{api_name}\s*\(", html), (
            f"runtime never calls settlement core {api_name}()"
        )

    # Both label surfaces exist, while the policy receives the environmental
    # signals that make it responsive, battery-aware and reduced-motion safe.
    assert 'id="villageSceneLabels"' in html
    assert 'id="townSceneLabels"' in html
    assert "prefers-reduced-motion: reduce" in html
    assert "hardwareConcurrency" in html
    assert "devicePixelRatio" in html
    assert re.search(r"\binViewport\b", html)
    assert re.search(r"\bdocumentHidden\b", html)
    assert "document.hidden" in html


def test_paused_scene_loops_release_their_running_flag_when_the_player_leaves():
    html = HTML.read_text(encoding="utf-8")
    village_loop = top_level_function_source(html, "villageAnimate")
    town_loop = top_level_function_source(html, "townAnimate")

    # An off-screen loop wakes through a short timer. If the player changes
    # screen (or closes the Town Square) before that timer fires, the running
    # flag must be released so the renderer can start again on their return.
    assert "else villageRunning = false" in village_loop
    assert "else townRunning = false" in town_loop


def test_starting_village_and_hall_builds_focuses_the_live_scaffold():
    html = HTML.read_text(encoding="utf-8")
    focus = top_level_function_source(html, "settlementSceneFocusConstruction")
    village_build = top_level_function_source(html, "empireBuildStructure")
    hall_build = top_level_function_source(html, "beginTownHallUpgrade")

    assert "getWorldPosition" in focus
    assert "scrollIntoView" in focus
    assert "constructionProgress" in focus
    assert "settlementSceneSetContext" in focus
    assert "settlementSceneFocusConstruction(sceneKind" in village_build
    assert "settlementSceneFocusConstruction('town'" in hall_build


def test_settlement_signs_do_not_render_through_buildings():
    html = HTML.read_text(encoding="utf-8")
    sign_renderer = top_level_function_source(html, "villageMakeSign")

    assert not re.search(
        r"\bdepthTest\s*:\s*false\b", sign_renderer, re.IGNORECASE
    )
    assert not re.search(
        r"\brenderOrder\s*=\s*999\b", sign_renderer, re.IGNORECASE
    )


def test_town_remains_one_cohesive_settlement_without_quarter_billboards():
    html = HTML.read_text(encoding="utf-8")
    town_scene = top_level_function_source(html, "buildTownScene")

    # v277 deliberately removed separate Quarter pads and billboards: wards
    # contribute buildings to one shared street plan around one market square.
    assert re.search(r"no quarter borders, no separate pads", town_scene, re.IGNORECASE)
    assert not re.search(
        r"villageMakeSign\s*\(\s*[\"']Quarter(?:\s|[\"'])",
        town_scene,
        re.IGNORECASE,
    )
    assert not re.search(
        r"villageMakeSign\s*\(\s*v\.name\b", town_scene, re.IGNORECASE
    )
    assert not re.search(
        r"(?:label|text)\s*:\s*v\.name\b", town_scene, re.IGNORECASE
    )
    assert not re.search(r"openEmpireVillage\s*\(", town_scene)
