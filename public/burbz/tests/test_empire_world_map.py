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


def test_claimed_villages_become_closed_gold_territory_polygons():
    villages = [
        {"seed": 1, "name": "Delamere", "lat": 53.228, "lon": -2.684},
        {"seed": 2, "name": "Kelsall", "lat": 53.207, "lon": -2.712},
    ]
    result = run_core(f"core.territoryFeatureCollection({json.dumps(villages)}, 2200, 48)")
    assert result["type"] == "FeatureCollection"
    assert len(result["features"]) == 2
    for feature in result["features"]:
        ring = feature["geometry"]["coordinates"][0]
        assert feature["properties"]["color"] == "#f0c767"
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


def test_empire_tab_contains_an_interactive_world_map_and_controls():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="empireWorldMap"' in html
    assert 'id="empireMapWorldBtn"' in html
    assert 'id="empireMapRealmBtn"' in html
    assert 'aria-label="Interactive map of your captured territories"' in html
    assert "new maplibregl.Map" in html
    assert "dragPan:true" in html
    assert "scrollZoom:true" in html
    assert "touchZoomRotate:true" in html
    assert "new maplibregl.NavigationControl" in html
    assert "attributionControl:false" in html
    assert 'class="empire-map-attribution"' in html
    assert "empire-territory-fill" in html
    assert "empire-territory-line" in html
    assert "padding:{ top:70, right:58, bottom:112, left:58 }" in html
    assert "refreshEmpireMap" in html


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
    assert "Number.isFinite(Number(v.lat))" in html[enter_start:enter_end]
    assert "Number.isFinite(Number(v.lon))" in html[enter_start:enter_end]
    assert "Number.isFinite(Number(v.lat))" in html[claim_start:claim_end]
    assert "Number.isFinite(Number(v.lon))" in html[claim_start:claim_end]


def test_empire_map_assets_are_versioned_offline_and_cache_bumped():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    marker = "empire_map_core.js?v=territory-map-20260714"
    assert marker in html
    assert "./" + marker in sw
    assert "burbz-empire-world-map-v64-20260714" in sw
