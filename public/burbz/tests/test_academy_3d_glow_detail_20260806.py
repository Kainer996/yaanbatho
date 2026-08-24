"""Detailed, varied, phone-safe 3D Academy and player-controlled night glow."""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CORE = (ROOT / "academy_3d_core.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


# magpie-market-v314 edited this core, so it ships under that tag now.
MAGPIE_CORE_PIN = "magpie-market-v314-20260824"


def _node(source: str):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, check=True, capture_output=True, text=True
    )
    return json.loads(result.stdout.strip().splitlines()[-1])


def test_buildings_have_distinct_body_profiles_and_signature_details():
    out = _node(r"""
const A = require('./academy_3d_core.js');
const styles = Object.values(A.STYLES);
console.log(JSON.stringify({
  rooms: styles.length,
  bodies: [...new Set(styles.map(s => s.body))],
  signatures: styles.map(s => s.signature),
  allDetailed: styles.every(s => Array.isArray(s.details) && s.details.length >= 2)
}));
""")
    assert out["rooms"] == 12
    assert len(out["bodies"]) >= 6
    assert len(set(out["signatures"])) == 12
    assert out["allDetailed"] is True
    for body in ("birdhouse", "pavilion", "longhall", "cross-gable", "cottage", "tower"):
        assert f"st.body === '{body}'" in CORE, f"{body} must alter rendered geometry"
    for detail in (
        "dormer", "perch-brace", "shields", "pennants", "banners", "targets",
        "greenhouse", "ward-lantern", "pub-sign", "barrels", "herb-box", "copper-pans",
        "pulley", "tool-wheel", "cradle-mobile", "woven-ribs", "lens-rings", "star-band",
        "book-balcony", "reading-lamp", "map-board", "quest-banners",
    ):
        assert f"hasDetail('{detail}')" in CORE, f"{detail} must have a renderer path"
    declared_details = {
        token
        for block in re.findall(r"details:\s*\[([^]]*)\]", CORE)
        for token in re.findall(r"'([^']+)'", block)
    }
    runtime_handlers = set(re.findall(r"hasDetail\('([^']+)'\)", CORE))
    assert declared_details <= runtime_handlers


def test_night_tree_glow_is_explicit_and_never_runs_by_day():
    out = _node(r"""
const A = require('./academy_3d_core.js');
console.log(JSON.stringify({
  nightOn: A.treeLightsActiveFor(21, true),
  nightOff: A.treeLightsActiveFor(21, false),
  noonForced: A.treeLightsActiveFor(12, true),
  dawnForced: A.treeLightsActiveFor(6.5, true)
}));
""")
    assert out == {"nightOn": True, "nightOff": False, "noonForced": False, "dawnForced": False}


def test_mobile_quality_profile_caps_expensive_effects():
    out = _node(r"""
const A = require('./academy_3d_core.js');
console.log(JSON.stringify({
  low: A.qualityProfileFor(360, 3, 4, 2),
  phone: A.qualityProfileFor(390, 3, 8, 8),
  landscape: A.qualityProfileFor(824, 3, 8, 8, 390, false),
  desktop: A.qualityProfileFor(1280, 2, 12, 16)
}));
""")
    assert out["low"]["pixelRatio"] <= 1.25
    assert out["low"]["frameMs"] >= 30
    assert out["low"]["lightCount"] <= 2
    assert out["phone"]["pixelRatio"] <= 1.5
    assert out["phone"]["frameMs"] >= 20
    assert out["phone"]["lightCount"] <= 3
    assert out["landscape"]["pixelRatio"] <= 1.5
    assert out["landscape"]["frameMs"] >= 20
    assert out["landscape"]["canopyHalos"] <= 18
    assert out["desktop"]["pixelRatio"] <= 2
    assert out["desktop"]["frameMs"] <= 17
    resize_match = re.search(r"function resize\(\) \{(.*?)\n    \}", CORE, re.S)
    assert resize_match
    resize = resize_match.group(1)
    assert "qualityForSize(" in resize
    assert "setPixelRatio" in resize
    quality_helper = CORE[CORE.index("function qualityForSize("):CORE.index("function requestedTreeLights(")]
    assert "qualityProfileFor(" in quality_helper


def test_three_engine_uses_bounded_real_lights_and_fake_bounce_glow():
    for marker in [
        "new T.PointLight(",
        "T.AdditiveBlending",
        "tree.tips",
        "function setTreeLights(",
        "st.quality.lightCount",
        "st.treeLightActive",
        "st.treeLeafMaterials = [mats.leaf, mats.leafCard]",
        "if (!mat || !mat.emissive) return",
    ]:
        assert marker in CORE
    assert "castShadow = false" in CORE, "interior glow lights must not allocate mobile shadow maps"


def test_reduced_motion_toggle_updates_room_windows_without_an_animation_frame():
    setter_match = re.search(r"function setTreeLights\(on\) \{(.*?)\n    \}", CORE, re.S)
    assert setter_match
    setter = setter_match.group(1)
    assert "applyStaticRoomGlows" in setter
    static_glows = CORE[CORE.index("function applyStaticRoomGlows("):CORE.index("function setTreeLights(")]
    assert "target *= 0.68" in static_glows
    assert "if (active) target = Math.max" in static_glows
    reduced = CORE[CORE.index("if (reduced()) {"):CORE.index("st.running = true", CORE.index("if (reduced()) {"))]
    assert "applyStaticRoomGlows" in reduced


def test_scene_rebuild_releases_tracked_gpu_textures_once():
    dispose = CORE[CORE.index("function disposeScene() {"):CORE.index("function stop() {", CORE.index("function disposeScene() {"))]
    for texture in ("st.smokeTex", "st.ffTex", "st.groundTex", "st.mats && st.mats.leafTex", "st.mats && st.mats.barkTex"):
        assert texture in dispose
    assert "if (tex && tex.dispose && all.indexOf(tex) === idx) tex.dispose()" in dispose
    assert "st.mats = null" in dispose


def test_night_button_is_accessible_persistent_and_exported():
    assert 'id="academyTreeLightBtn"' in HTML
    assert 'aria-pressed="false"' in HTML
    assert "function toggleAcademyTreeLights()" in HTML
    assert "ACADEMY_TREE_LIGHT_KEY = 'burbzAcademyTreeLights'" in HTML
    assert "localStorage.setItem(ACADEMY_TREE_LIGHT_KEY" in HTML
    assert "academyTreeLightsAvailable()" in HTML
    assert "isNightHour(academyLocalHour())" in HTML
    assert "toggleAcademyView, toggleAcademyTreeLights" in HTML
    assert "window.addEventListener('resize', scheduleAcademy3DResize" in HTML


def test_button_is_only_shown_in_3d_at_night_and_updates_engine():
    fn = re.search(r"function refreshAcademyTreeLightControl\(\) \{.*?\n\}", HTML, re.S)
    assert fn
    body = fn.group(0)
    assert "academyViewMode() === '3d'" in body
    assert "academyTreeLightsAvailable()" in body
    assert "btn.hidden = !available" in body
    assert "ACADEMY_3D.setTreeLights" in body


def test_release_and_academy_core_pin_advance_for_installed_pwa():
    marker = "hold-to-steer-v251-20260811"
    assert marker in HTML and marker in SW
    pin = f"academy_3d_core.js?v={MAGPIE_CORE_PIN}"
    assert pin in HTML
    assert f"'./{pin}'" in SW
