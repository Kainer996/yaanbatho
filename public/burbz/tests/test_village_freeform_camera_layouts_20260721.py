from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def renderer_controls(html: str) -> str:
    start = html.index("function ensureVillageRenderer(")
    end = html.index("function disposeVillageScene(", start)
    return html[start:end]


def scene_builder(html: str) -> str:
    start = html.index("function buildVillageScene(")
    end = html.index("function onVillageResize(", start)
    return html[start:end]


def test_player_can_pinch_zoom_and_pan_around_the_village():
    html = HTML.read_text(encoding="utf-8")
    controls = renderer_controls(html)
    # Two-pointer gestures: pinch to zoom, drag together to stroll around.
    assert "camPointers" in controls
    assert "pinchState" in controls
    assert "villageCamZoom(villageCam.dist * (pinchLast.d" in controls
    assert "villageCamPan(now.mx - pinchLast.mx, now.my - pinchLast.my)" in controls
    # Desktop parity: wheel zoom, shift/right-drag pan, right-click suppressed.
    assert "e.shiftKey || e.button === 2" in controls
    assert "contextmenu" in controls
    # Zoom reaches street level and the pan target stays on the meadow.
    assert "VILLAGE_CAM_MIN_DIST = 6" in controls
    assert "VILLAGE_CAM_MAX_DIST = 30" in controls
    assert "VILLAGE_CAM_PAN_REACH = 16" in controls
    # A double-tap walks the camera back to the square.
    assert "dblclick" in controls
    # Fingers sliding off the canvas still release their gesture.
    assert "setPointerCapture" in controls
    assert "pointercancel" in controls


def test_camera_orbits_the_pan_target_and_drift_yields_to_the_player():
    html = HTML.read_text(encoding="utf-8")
    frame_start = html.index("function villageAnimateFrame(")
    frame = html[frame_start:html.index("// Local-only debug hook", frame_start)]
    assert "villageCamera.lookAt(tx, 1.4, tz)" in frame
    assert "tx + Math.sin(azimuth)" in frame
    assert "tz + Math.cos(azimuth)" in frame
    # The view now stays where the player leaves it, and opens on paid roofs.
    assert "villageCam.azimuth +=" not in frame
    builder = scene_builder(html)
    assert "villageCam.tx = builtCenter.x" in builder


def test_villages_are_not_all_rings_around_a_point():
    html = HTML.read_text(encoding="utf-8")
    builder = scene_builder(html)
    # Five plans, two of them non-radial: a high street and a scattered hamlet.
    assert "'lane'" in builder
    assert "'hamlet'" in builder
    for marker in ["'green'", "'crossroads'", "'riverside'", "'lane'", "'hamlet'"]:
        assert marker in builder.split("const layout =", 1)[1].split(";", 1)[0]
    # The high street stays clear of buildings and carves a pass in the hills.
    assert "the high street runs straight through" in builder
    assert "the high street leaves through a single pass" in builder
    # Paid buildings get clear plots; landscape plans no longer seed shops.
    assert "const econScatter" in builder and "spotFree(x, z, rad)" in builder
    assert "villageMakeTradeShop(" not in builder


def test_each_village_still_varies_from_its_neighbours():
    html = HTML.read_text(encoding="utf-8")
    builder = scene_builder(html)
    # Layout, size tier, palette and plaza are all grown from the seed's rng.
    assert "const layoutRoll = r();" in builder
    assert "const sizeRoll = r();" in builder
    assert "VILLAGE_PALETTES[Math.floor(r() * VILLAGE_PALETTES.length)]" in builder
    # The cobbled centre now varies with the plan too.
    assert "layout === 'hamlet' ? 2.4 + r() * 0.9" in builder
