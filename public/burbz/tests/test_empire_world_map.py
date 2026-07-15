import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "empire_map_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_liberated_villages_become_closed_light_green_territory_polygons():
    villages = [
        {"seed": 1, "name": "Delamere", "lat": 53.228, "lon": -2.684},
        {"seed": 2, "name": "Kelsall", "lat": 53.207, "lon": -2.712},
    ]
    result = run_core(f"core.territoryFeatureCollection({json.dumps(villages)}, 2200, 48)")
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 2
    for feature in result["features"]:
        ring = feature["geometry"]["coordinates"][0]
        assert feature["properties"]["color"] == "#8ee39a"
        assert len(ring) == 49
        assert ring[0] == ring[-1]
        assert feature["properties"]["radiusM"] == 2200


def test_empire_points_keep_town_identity_and_ignore_missing_coordinates():
    villages = [
        {"seed": 10, "name": "Delamere", "lat": 53.228, "lon": -2.684, "claimedAt": "2026-07-14T00:00:00Z"},
        {"seed": 11, "name": "Legacy save", "lat": None, "lon": None},
    ]
    result = run_core(f"core.claimFeatureCollection({json.dumps(villages)})")
    assert len(result["features"]) == 1
    feature = result["features"][0]
    assert feature["geometry"]["coordinates"] == [-2.684, 53.228]
    assert feature["properties"]["seed"] == 10
    assert feature["properties"]["name"] == "Delamere"


def test_empire_bounds_span_all_valid_claims():
    villages = [
        {"lat": 53.228, "lon": -2.684},
        {"lat": 53.207, "lon": -2.712},
        {"lat": None, "lon": None},
    ]
    assert run_core(f"core.claimBounds({json.dumps(villages)})") == [[-2.712, 53.207], [-2.684, 53.228]]


def test_dateline_claims_do_not_create_world_spanning_geometry_or_bounds():
    expression = (
        "(()=>{const ring=core.territoryCircle({seed:1,name:'Dateline',lat:0,lon:179.99},2200,56).geometry.coordinates[0];"
        "const bounds=core.claimBounds([{seed:1,name:'East',lat:0,lon:179.9},{seed:2,name:'West',lat:0,lon:-179.9}]);"
        "return {ringSpan:Math.max(...ring.map(p=>p[0]))-Math.min(...ring.map(p=>p[0])),boundsSpan:bounds[1][0]-bounds[0][0]};})()"
    )
    result = run_core(expression)
    assert result["ringSpan"] < 1
    assert result["boundsSpan"] < 1


def test_empire_tab_contains_an_interactive_world_map_and_controls():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="empireWorldMap"' in html
    assert 'id="empireMapWorldBtn"' in html
    assert 'id="empireMapRealmBtn"' in html
    assert 'aria-label="Interactive map of your liberated territories"' in html
    assert "new maplibregl.Map" in html
    assert "dragPan:true" in html
    assert "scrollZoom:true" in html
    assert "touchZoomRotate:true" in html
    assert "new maplibregl.NavigationControl" in html
    assert "EMPIRE_MAP_LOAD_TIMEOUT_MS" in html
    assert "resetEmpireMapAfterFailure" in html
    assert "attributionControl:false" in html
    assert 'class="empire-map-attribution"' in html
    assert "empire-liberated-wash" in html
    assert "empire-territory-line" in html
    assert "padding:{ top:122, right:58, bottom:112, left:58 }" in html
    assert "refreshEmpireMap" in html
    assert "showMarker = zoom >= 1" in html
    assert "is-visible" in html


def test_unexplored_world_is_dark_green_with_liberated_map_windows():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="empireFogOverlay"' in html
    assert 'id="empireFogHoles"' in html
    assert 'id="empireLiberatedHoles"' in html
    assert 'id="empireLiberatedMask"' in html
    assert 'class="empire-liberated-wash"' in html
    assert "#1f2a24" in html
    assert "function updateEmpireFogMask(" in html
    assert "map.on('move', updateEmpireFogMask)" in html
    assert "map.on('resize', updateEmpireFogMask)" in html
    assert "core.destination" in html
    assert "wrappedLongitudeNear" in html
    assert "empireMap.getCenter().lng" in html


def test_world_palette_keeps_blue_water_and_readable_dark_land_beneath_the_veil():
    html = HTML.read_text(encoding="utf-8")
    assert "function applyEmpireAtlasPalette(" in html
    assert "natural_earth" in html
    assert "setLayoutProperty(layer.id, 'visibility', 'none')" in html
    assert "#2f79a8" in html  # sea and lakes remain visibly blue
    assert "#1f2a24" in html  # unexplored land stays dark, not black
    assert 'class="empire-unexplored-shade"' in html
    shade = html.split('class="empire-unexplored-shade"', 1)[1].split('></rect>', 1)[0]
    assert 'fill="#07100d"' in shade
    assert 'fill-opacity="0.2"' in shade
    assert "Sea stays blue" in html
    assert "dark but readable" in html
    assert ".empire-map-card.is-empty .empire-map-empty { display:none; }" in html
    assert "Dark land remains visible beneath the veil" in html
    assert "burbz-realm-atlas-v74-20260714" in SW.read_text(encoding="utf-8")


def test_liberated_icons_remain_visible_at_world_zoom():
    html = HTML.read_text(encoding="utf-8")
    assert "const showMarker = zoom >= 1" in html
    assert "const worldPin = zoom < 5" in html
    assert "is-world-pin" in html
    assert ".empire-map-marker.is-world-pin" in html
    world_pin_css = html.split(".empire-map-marker.is-world-pin {", 1)[1].split("}", 1)[0]
    assert "min-width:44px" in world_pin_css
    assert "min-height:44px" in world_pin_css


def test_map_keyboard_controls_and_markers_have_visible_focus():
    html = HTML.read_text(encoding="utf-8")
    assert ".empire-map-btn:focus-visible" in html
    assert ".empire-map-marker:focus-visible" in html


def test_liberated_green_wash_is_unioned_not_alpha_stacked_per_polygon():
    html = HTML.read_text(encoding="utf-8")
    assert "empire-liberated-wash" in html
    assert "map.addLayer({ id:'empire-territory-fill'" not in html


def test_empire_copy_describes_liberation_not_conquest_or_gold_capture():
    html = HTML.read_text(encoding="utf-8")
    screen_start = html.index('id="screen-village"')
    screen_end = html.index('id="screen-quests"', screen_start)
    empire_logic_start = html.index("// EMPIRE —")
    empire_logic_end = html.index("// ---- Scene state", empire_logic_start)
    copy = (html[screen_start:screen_end] + html[empire_logic_start:empire_logic_end]).lower()
    assert "liberat" in copy
    assert "captured territor" not in copy
    assert "glowing gold" not in copy
    assert "conquer" not in copy


def test_claiming_or_opening_a_village_refreshes_and_focuses_the_empire_map():
    html = HTML.read_text(encoding="utf-8")
    claim_start = html.index("function claimCurrentVillage(")
    claim_end = html.index("\nfunction renderVillageClaimBar", claim_start)
    claim = html[claim_start:claim_end]
    assert "refreshEmpireMap" in claim
    assert "function focusEmpireVillage(" in html
    focus_start = html.index("function focusEmpireVillage(")
    focus_end = html.index("\nfunction openEmpireVillage", focus_start)
    assert "BurbzEmpireMapCore.validClaim(village)" in html[focus_start:focus_end]
    assert "function openEmpireVillage(" in html
    assert "data-action=\"empire-village\"" in html


def test_claim_coordinates_preserve_valid_equator_and_prime_meridian_locations():
    html = HTML.read_text(encoding="utf-8")
    enter_start = html.index("function enterVillage(")
    enter_end = html.index("\nfunction currentVillage", enter_start)
    claim_start = html.index("function claimCurrentVillage(")
    claim_end = html.index("\nfunction renderVillageClaimBar", claim_start)
    assert "normaliseVillageCoordinate(v.lat, -90, 90)" in html[enter_start:enter_end]
    assert "normaliseVillageCoordinate(v.lon, -180, 180)" in html[enter_start:enter_end]
    assert "normaliseVillageCoordinate(v.lat, -90, 90)" in html[claim_start:claim_end]
    assert "normaliseVillageCoordinate(v.lon, -180, 180)" in html[claim_start:claim_end]


def test_legacy_null_coordinates_stay_missing_instead_of_becoming_zero():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("function normaliseVillageCoordinate(")
    end = html.index("\nfunction enterVillage", start)
    helper = html[start:end]
    assert "value === null" in helper
    assert "value === undefined" in helper


def test_empire_map_assets_are_versioned_offline_and_cache_bumped():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    marker = "empire_map_core.js?v=liberation-map-v3-20260714"
    assert marker in html
    assert "./" + marker in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
