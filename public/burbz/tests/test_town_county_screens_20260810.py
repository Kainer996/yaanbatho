"""The town has a square and the realm has its colours — v242, 2026-08-10.

Yaan's ask, in three layers:

1. **Town Square** — capture three villages and those exact three retire into a
   Town. Their geometry still supplies distinct 3D wards around the real market
   square, but their old names and visit routes disappear; strategy lives at
   Town Hall.
2. **County Map** — once a county stands, a separate zoomed-out screen shows
   that region of the map Crusader-Kings style: a painted chart with the
   county border, its settlements, and the wild lands sketched around them.
3. **Painted realm** — capture several counties (a duchy or better) and the
   main royal atlas colours their lands, one hue per liege, like a Crusader
   Kings map. Lone counties stay unpainted.

The colour/border maths lives in empire_realm_core.js (realmSeatTint,
territoryHullRing, realmTerritoryFeatureCollection) so it runs under Node.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "empire_realm_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
STORY = ROOT / "STORY.md"

OWN_RELEASE_PIN = "town-county-screens-v242-20260810"
PREVIOUS_RELEASE_PIN = "battle-squad-board-v241-20260810"
CURRENT_BUILD = "one-town-fixed-view-v277-20260817"
# empire_realm_core.js gained the realm-painting helpers in this release, so
# its cache-buster moves with it.
REALM_CORE_PIN = "town-strategy-v273-20260816"


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def village(seed, lat, lon, order):
    day, hour = 1 + order // 24, order % 24
    return {
        "seed": seed,
        "name": "V" + str(seed),
        "lat": lat,
        "lon": lon,
        "claimedAt": f"2026-08-{day:02d}T{hour:02d}:00:00.000Z",
    }


def town(seed, lat, lon, order):
    return [village(seed + i, lat + i * 0.006, lon + i * 0.004, order + i) for i in range(3)]


def county(seed, lat, lon, order):
    return (
        town(seed, lat, lon, order)
        + town(seed + 1000, lat + 0.20, lon, order + 3)
        + town(seed + 2000, lat, lon + 0.25, order + 6)
    )


# Two Counties (three Towns/nine villages each) within 600 km — one Duchy.
FIRST_COUNTY = county(1, 53.0, -2.0, 0)
SECOND_COUNTY = county(4, 51.5, -0.1, 9)
DUCHY_VILLAGES = FIRST_COUNTY + SECOND_COUNTY

# Two duchies whose seats sit within 2000 km — a kingdom of four counties.
# The Iberian pair is more than 600 km from the English pair (two separate
# duchies), while Manchester and Madrid are close enough to crown a kingdom.
KINGDOM_VILLAGES = (
    DUCHY_VILLAGES
    + county(7, 40.4, -3.7, 18)
    + county(10, 38.7, -9.1, 27)
)


def empire_logic(html):
    start = html.index("// EMPIRE —")
    return html[start:html.index("// ---- Scene state", start)]


def function_source(html, name):
    start = html.index("function " + name + "(")
    return html[start:html.index("\nfunction ", start)]


# ---------------------------------------------------------------------------
# Core maths: heraldic tints
# ---------------------------------------------------------------------------

def test_realm_seat_tint_is_deterministic_and_distinct():
    tints = run_core("[core.realmSeatTint(1), core.realmSeatTint(1), core.realmSeatTint(2)]")
    assert tints[0] == tints[1]
    assert tints[0]["fill"] != tints[2]["fill"]
    assert tints[0]["fill"].startswith("hsl(")
    assert tints[0]["border"].startswith("hsl(")


# ---------------------------------------------------------------------------
# Core maths: the county border hull
# ---------------------------------------------------------------------------

def test_territory_hull_ring_wraps_every_village_and_closes():
    ring = run_core(f"core.territoryHullRing({json.dumps(FIRST_COUNTY)}, 2.5)")
    assert ring is not None and len(ring) >= 4
    assert ring[0] == ring[-1]  # a closed ring
    lons = [p[0] for p in ring]
    lats = [p[1] for p in ring]
    for v in FIRST_COUNTY:
        assert min(lons) < v["lon"] < max(lons)
        assert min(lats) < v["lat"] < max(lats)


def test_territory_hull_ring_survives_the_dateline():
    straddlers = [
        village(21, -17.6, 179.9, 0),
        village(22, -17.7, -179.8, 1),
        village(23, -17.5, 179.7, 2),
    ]
    ring = run_core(f"core.territoryHullRing({json.dumps(straddlers)}, 2.5)")
    assert ring is not None
    lons = [p[0] for p in ring]
    # One 360° branch, not a world-spanning zigzag.
    assert max(lons) - min(lons) < 5


def test_territory_hull_ring_handles_empty_input():
    assert run_core("core.territoryHullRing([], 2.5)") is None


# ---------------------------------------------------------------------------
# Core maths: the painted realm feature collection
# ---------------------------------------------------------------------------

def test_lone_county_stays_unpainted():
    fc = run_core(
        f"core.realmTerritoryFeatureCollection(core.deriveRealm({json.dumps(FIRST_COUNTY)}))"
    )
    assert fc["features"] == []


def test_duchy_paints_both_counties_in_one_colour():
    fc = run_core(
        f"core.realmTerritoryFeatureCollection(core.deriveRealm({json.dumps(DUCHY_VILLAGES)}))"
    )
    assert len(fc["features"]) == 2
    colours = {f["properties"]["color"] for f in fc["features"]}
    assert len(colours) == 1
    tiers = {f["properties"]["liegeTier"] for f in fc["features"]}
    assert tiers == {"duchy"}
    for feature in fc["features"]:
        ring = feature["geometry"]["coordinates"][0]
        assert ring[0] == ring[-1]
        assert feature["properties"]["border"] != feature["properties"]["color"]


def test_kingdom_colour_overrides_the_duchy_colour():
    result = run_core(
        "(() => {"
        f"const realm = core.deriveRealm({json.dumps(KINGDOM_VILLAGES)});"
        "const fc = core.realmTerritoryFeatureCollection(realm);"
        "return { kingdoms: realm.kingdoms.length, duchies: realm.duchies.length,"
        "  features: fc.features.map(f => ({ tier: f.properties.liegeTier, color: f.properties.color })),"
        "  kingTint: realm.kingdoms.length ? core.realmSeatTint(realm.kingdoms[0].seatSeed).fill : null };"
        "})()"
    )
    assert result["kingdoms"] == 1 and result["duchies"] == 2
    assert len(result["features"]) == 4
    assert {f["tier"] for f in result["features"]} == {"kingdom"}
    assert {f["color"] for f in result["features"]} == {result["kingTint"]}


def test_realm_painting_is_deterministic():
    expr = f"core.realmTerritoryFeatureCollection(core.deriveRealm({json.dumps(KINGDOM_VILLAGES)}))"
    assert run_core(expr) == run_core(expr)


# ---------------------------------------------------------------------------
# index.html wiring: the Town Square screen
# ---------------------------------------------------------------------------

def test_town_screen_exists_and_switchscreen_dispatches_to_it():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="screen-town"' in html
    assert 'id="townStage"' in html
    assert 'id="townScreenTitle"' in html
    assert "if (name === 'town')" in html
    assert "renderTownScreen()" in html
    assert "onTownResize" in html


def test_town_scene_is_built_from_the_member_villages():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    # The charter stone flies one pennant per founder; the wards' buildings
    # knit around one square via the shared plot ring (v277 — one town, no
    # geographic district pads).
    assert "villageMakeSettlementStandard(r, pal, { tier: settle.tier, memberCount: settle.villageCount })" in scene
    assert "const takePlot = (kind, radiusBase, jitter)" in scene
    assert "GOLDEN_ANGLE" in scene
    # Every ward retains an internal seed so its real palette/recovery state can
    # be rebuilt, but absorbed village names are not exposed in Town UI.
    assert "district.userData.districtSeed = seed" in scene
    assert "villagePlan(seed" in scene
    assert "villageDistrictState(seed)" in scene
    assert "villageMakeSign(v.name" not in scene
    assert "v.name" not in scene
    # A rebuilt membership rebuilds the scene.
    assert "function townSceneKey(" in html
    # The 3D square now renders on every Hall render — it sits at the top of
    # the screen (v276) — and the square renderer owns cache invalidation.
    render = function_source(html, "renderTownScreen")
    square = function_source(html, "renderTownSquare")
    assert "renderTownSquare(settle)" in render
    assert "townBuiltKey !== townSceneKey(settle)" in square
    assert "townEconomySnapshot(" in render


def test_town_3d_and_management_never_reopen_absorbed_villages():
    html = HTML.read_text(encoding="utf-8")
    renderer = function_source(html, "ensureTownRenderer")
    assert "townCamZoom" in renderer and "townCamPan" in renderer
    assert "openEmpireVillage(" not in renderer
    screen = function_source(html, "renderTownScreen")
    assert "openEmpireVillage(" not in screen
    assert 'data-action="town-network"' in screen
    assert 'data-action="town-policy"' in screen


def test_town_screen_is_reachable_from_ledger_map_and_stale_village_routes():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    # Royal Ledger settlement rows walk into the town.
    assert "openEmpireTown(btn.dataset.settlement)" in logic
    # The atlas settlement card manages the Town; framing survives as a
    # separate map action.
    refresh = html[html.index("function refreshEmpireMap("):html.index("function initialiseEmpireMap(")]
    assert "openEmpireTown(settlement.id)" in refresh
    assert "frameEmpireSettlement(settlement.id)" in refresh
    for name in ("enterVillage", "openEmpireVillage"):
        route = function_source(html, name)
        assert "empireSettlementOfSeed" in route
        assert "openEmpireTown(" in route
        assert route.index("openEmpireTown(") < route.index("villageActive =")


def test_town_fallback_does_not_restore_retired_village_buttons():
    html = HTML.read_text(encoding="utf-8")
    fallback = function_source(html, "renderTownFallback")
    assert "openEmpireVillage(" not in fallback
    assert "data-town-district" not in fallback
    assert "v.name" not in fallback


# ---------------------------------------------------------------------------
# index.html wiring: the County Map screen
# ---------------------------------------------------------------------------

def test_county_map_screen_exists_and_switchscreen_dispatches_to_it():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="screen-county"' in html
    assert 'id="countyMapCanvas"' in html
    assert "if (name === 'county') renderCountyMapScreen();" in html
    assert "function openEmpireCountyMap(" in html


def test_county_map_paints_the_hull_settlements_and_cartouche():
    html = HTML.read_text(encoding="utf-8")
    draw = function_source(html, "drawCountyMap")
    assert "territoryHullRing(county.villages, 2.5)" in draw
    assert "realmSeatTint(liege.seatSeed)" in draw
    assert "empireRegionHoldings(region)" in draw
    assert "empireVillageCrest(v.seed)" not in draw
    assert "townDisplayName" in draw
    assert "v.name" not in draw
    assert "county-map-hotspot" in draw
    # Neighbouring counties of the realm show at the map's edge.
    assert "paintCounty(county, false)" in draw
    assert "paintCounty(region, true)" in draw


def test_county_map_hotspots_only_open_unified_towns():
    html = HTML.read_text(encoding="utf-8")
    draw = function_source(html, "drawCountyMap")
    assert "openEmpireTown(spot.id)" in draw
    assert "openEmpireVillage(" not in draw
    assert "kind: 'village'" not in draw and "kind:'village'" not in draw


def test_county_map_opens_from_the_county_hall_and_the_atlas():
    html = HTML.read_text(encoding="utf-8")
    hall = function_source(html, "renderRegionScreen")
    assert 'data-action="region-map"' in hall
    assert "COUNTY MAP" in hall
    logic = empire_logic(html)
    assert "openEmpireCountyMap(region.id)" in logic


# ---------------------------------------------------------------------------
# index.html wiring: the painted realm on the royal atlas
# ---------------------------------------------------------------------------

def test_atlas_carries_the_painted_realm_layers():
    html = HTML.read_text(encoding="utf-8")
    init = html[html.index("function initialiseEmpireMap("):html.index("function renderEmpireWorldMap(")]
    assert "map.addSource('empire-realm'" in init
    assert "id:'empire-realm-fill'" in init
    assert "'fill-color':['get','color']" in init
    assert "id:'empire-realm-border'" in init
    # Painted lands sit BELOW the liberation-green territory layer.
    assert init.index("map.addSource('empire-realm'") < init.index("map.addSource('empire-territory'")


def test_atlas_refresh_feeds_the_painted_realm_from_the_cached_pyramid():
    html = HTML.read_text(encoding="utf-8")
    refresh = html[html.index("function refreshEmpireMap("):html.index("function initialiseEmpireMap(")]
    assert "rc.realmTerritoryFeatureCollection(empireRegionsInfo())" in refresh


def test_tapping_painted_land_explains_the_county():
    html = HTML.read_text(encoding="utf-8")
    assert "function empireRealmCountyAtPoint(" in html
    assert "showEmpirePaintedCountyCard(paintedCounty)" in html
    card = function_source(html, "showEmpirePaintedCountyCard")
    assert "Painted in the colour of the " in card
    assert "openEmpireCountyMap(region.id)" in card
    # The map key teaches the colours.
    assert "Painted lands — counties sworn to one duchy or kingdom share its colour" in html


# ---------------------------------------------------------------------------
# Story canon
# ---------------------------------------------------------------------------

def test_story_canon_documents_the_three_layers():
    story = STORY.read_text(encoding="utf-8")
    assert "Town Square" in story
    assert "County Map" in story
    assert "paints their lands" in story


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_pinned_and_realm_core_cache_buster_moved():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f'src="empire_realm_core.js?v={REALM_CORE_PIN}"' in html
    assert f"'./empire_realm_core.js?v={REALM_CORE_PIN}'" in sw
