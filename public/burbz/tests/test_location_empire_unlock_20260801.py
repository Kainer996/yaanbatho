"""Wherever the player goes, the empire follows.

Three contracts from the Snowdonia report ("I'm literally in Snowdonia and the
empire view doesn't show it"):

1. WAYSTEADS — the procedural village grid guarantees a settlement to liberate
   in walking reach of ANY point on Earth: a 3x3 cell block that rolls no
   village deterministically hosts one waystead instead.
2. THE ATLAS KNOWS WHERE YOU ARE — the Empire map shows the sovereign's own
   banner at their live position, a scout's-lantern half-light in the darkness
   around them, and dark frontier banners on the nearest unclaimed settlements.
3. REGION HALL — founding a region unlocks that whole region of the map (one
   daylight window over the county, gold-rimmed) and opens a dedicated screen
   where the player runs the region as one realm instead of village by village.

Core maths run through Node; index.html contracts are pinned as text, in the
same style as test_empire_realms_trade_20260731.py.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "empire_realm_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

CHESHIRE = [
    {"seed": 1, "name": "Delamere", "lat": 53.228, "lon": -2.684, "claimedAt": "2026-07-01T00:00:00Z"},
    {"seed": 2, "name": "Kelsall", "lat": 53.207, "lon": -2.712, "claimedAt": "2026-07-02T00:00:00Z"},
    {"seed": 3, "name": "Tarporley", "lat": 53.156, "lon": -2.667, "claimedAt": "2026-07-03T00:00:00Z"},
]


def run_node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def run_core(expression: str):
    return run_node(f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));")


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


def village_generation_source(html: str) -> str:
    """The pure, DOM-free seeded-village pipeline, extracted for Node."""
    start = html.index("// ---- Seeded randomness")
    end = html.index("function nearestVillageTo")
    return html[start:end]


# ---------------------------------------------------------------------------
# 1. Waysteads: an unlockable settlement wherever the player stands
# ---------------------------------------------------------------------------

def run_villages(expression: str):
    html = HTML.read_text(encoding="utf-8")
    src = village_generation_source(html)
    script = "eval(" + json.dumps(src) + "); console.log(JSON.stringify(" + expression + "));"
    return run_node(script)


def test_snowdonia_always_has_a_settlement_in_reach():
    villages = run_villages("villagesNearLatLng(53.068, -4.076, 4)")
    assert villages, "the mountains must not be empty"
    def km(v):
        import math
        return math.hypot((v["lat"] - 53.068) * 111, (v["lon"] - -4.076) * 111 * 0.6)
    assert min(km(v) for v in villages) < 7


def test_every_point_on_earth_has_a_village_within_a_short_walkable_ride():
    # Sample the globe deterministically; the 3x3-block waystead guarantee
    # bounds the worst case to roughly one block diagonal (~7 km).
    worst = run_node(
        "eval(" + json.dumps(village_generation_source(HTML.read_text(encoding='utf-8'))) + ");"
        "const rng = villageRngFrom(20260801);"
        "let worst = 0;"
        "for (let k = 0; k < 2000; k++) {"
        "  const lat = rng() * 160 - 80, lon = rng() * 360 - 180;"
        "  const vs = villagesNearLatLng(lat, lon, 4);"
        "  if (!vs.length) { worst = Infinity; break; }"
        "  const d = Math.min(...vs.map(v => Math.hypot((v.lat - lat) * 111, (v.lon - lon) * 111 * Math.cos(lat * Math.PI / 180))));"
        "  if (d > worst) worst = d;"
        "}"
        "console.log(JSON.stringify(worst));"
    )
    assert worst < 8


def test_waysteads_are_deterministic_and_only_fill_truly_empty_blocks():
    result = run_node(
        "eval(" + json.dumps(village_generation_source(HTML.read_text(encoding='utf-8'))) + ");"
        "let found = null;"
        "for (let bi = 1000; bi < 9000 && !found; bi++) {"
        "  const w = waysteadInBlock(bi, 77);"
        "  if (w) found = { first: w, second: waysteadInBlock(bi, 77), bi };"
        "}"
        "const occupied = [];"
        "for (let bi = 0; bi < 200; bi++) {"
        "  if (waysteadInBlock(bi, 0) && [0,1,2].some(di => [0,1,2].some(dj => villageInCell(bi*3+di, dj)))) occupied.push(bi);"
        "}"
        "console.log(JSON.stringify({ found, occupied }));"
    )
    assert result["found"], "some empty block must exist in a 8000-block strip"
    assert result["found"]["first"] == result["found"]["second"]
    assert result["found"]["first"]["seed"] >= 0 and result["found"]["first"]["name"]
    assert result["occupied"] == []  # never a waystead where a village already rolled


def test_procedural_villages_keep_their_original_seeds_and_coordinates():
    # Existing liberated claims must keep pointing at the same towns: the
    # refactor to villageInCell must reproduce the legacy per-cell formula.
    # The comparison runs inside the same eval scope as the extracted source,
    # since its const declarations are scoped to that eval.
    compare = (
        "\nfunction legacy(i, j) {"
        "  const cs = VILLAGE_CELL_DEG;"
        "  const h = burbzHash32('burbz-village:' + i + ':' + j);"
        "  if (h % 100 >= 34) return null;"
        "  const r = villageRngFrom(h);"
        "  return { seed: h, name: villageNameFromSeed(h), lat: (i + 0.18 + r() * 0.64) * cs, lon: (j + 0.18 + r() * 0.64) * cs };"
        "}"
        "let same = true;"
        "for (let i = -300; i < 300; i += 7) for (let j = -300; j < 300; j += 11) {"
        "  if (JSON.stringify(villageInCell(i, j)) !== JSON.stringify(legacy(i, j))) same = false;"
        "}"
        "console.log(JSON.stringify(same));"
    )
    src = village_generation_source(HTML.read_text(encoding="utf-8")) + compare
    ok = run_node("eval(" + json.dumps(src) + ");")
    assert ok is True


def test_waystead_guarantee_is_wired_into_the_live_map_grid():
    html = HTML.read_text(encoding="utf-8")
    assert "const VILLAGE_BLOCK_CELLS = 3;" in html
    assert "function villageInCell(" in html
    assert "function waysteadInBlock(" in html
    assert "burbz-waystead:" in html
    # Both the cell villages and the block waysteads feed the same list that
    # the live map, nearest-village lookup and empire frontier all read.
    assert "const w = waysteadInBlock(bi, bj);" in html


# ---------------------------------------------------------------------------
# 2. The atlas shows where the player actually is
# ---------------------------------------------------------------------------

def test_empire_map_places_the_sovereigns_banner_at_the_live_position():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "function empirePlayerPosition()" in logic
    assert "liveMapHasPrecisePosition && liveMapLastPosition" in logic
    assert "gameState.lastKnownHome" in logic  # falls back to the remembered fix
    assert "is-player" in html
    assert "YOU ARE HERE" in html
    assert ".empire-map-marker.is-player" in html


def test_a_real_move_refreshes_the_atlas_banner_and_frontier():
    html = HTML.read_text(encoding="utf-8")
    assert "function scheduleEmpireHereRefresh()" in html
    # rememberHomeFix fires the refresh only on real moves, not every GPS tick.
    fix_start = html.index("function rememberHomeFix(")
    fix_end = html.index("function handleLivePosition(", fix_start)
    assert "scheduleEmpireHereRefresh" in html[fix_start:fix_end]
    assert "movedFar &&" in html[fix_start:fix_end]


def test_nearest_unclaimed_settlements_fly_dark_frontier_banners():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "function openEmpireFrontier(" in logic
    assert "empireFrontierVillages = villagesNearLatLng(here.lat, here.lon, 2)" in logic
    assert ".filter(v => !empireOwnsVillage(v.seed))" in logic
    assert ".slice(0, VILLAGE_VISITABLE_COUNT)" in logic
    assert "is-frontier" in html
    assert ".empire-map-marker.is-frontier" in html
    # The status line points at the nearest target, before and after the
    # first liberation.
    assert "awaits liberation where you stand" in html
    assert "tap its dark banner to free your first town" in html
    # Tapping a frontier banner travels into the village where the claim bar
    # leads straight into its Liberation Battle.
    assert "enterVillage(village)" in logic
    assert "villageClaimBar" in logic


def test_the_scouts_lantern_half_lights_the_darkness_around_the_player():
    html = HTML.read_text(encoding="utf-8")
    fog_start = html.index("function updateEmpireFogMask()")
    fog_end = html.index("// The veil is static", fog_start)
    fog = html[fog_start:fog_end]
    assert "The scout's lantern" in fog
    assert "empirePlayerPosition()" in fog
    # Half-light, not daylight: the lantern never fully lifts the veil.
    assert "rgba(0,0,0,.72)" in fog


# ---------------------------------------------------------------------------
# 3. Regions unlock their whole map area and are run from the Region Hall
# ---------------------------------------------------------------------------

def test_core_annotates_each_county_with_its_liege_chain():
    # The nested ladder replaced the per-region size ladder: a county's next
    # rung is a NEIGHBOURING county (→ duchy), never more of its own villages.
    realm = run_core(f"core.deriveRealm({json.dumps(CHESHIRE)})")
    county = realm["regions"][0]
    assert county["tier"] == "county"
    assert county["duchyId"] is None and county["kingdomId"] is None
    assert county["liegeTier"] == "county"
    assert realm["duchies"] == [] and realm["kingdoms"] == [] and realm["empire"] is None
    assert run_core(f"core.regionUnityBonus(core.deriveRealm({json.dumps(CHESHIRE)}).regions[0])") == 0.15


def test_core_region_coverage_radius_spans_the_whole_region():
    radius = run_core(
        f"core.regionCoverageRadiusKm(core.deriveRegions({json.dumps(CHESHIRE)}).regions[0], 2.2)"
    )
    # Delamere-Kelsall-Tarporley spread ~4-5 km from their centroid; plus padding.
    assert 4 < radius < 12
    assert run_core("core.regionCoverageRadiusKm({villages: []}, 2.2)") == 0
    assert run_core("core.regionCoverageRadiusKm(null, 5)") == 0


def test_founding_a_region_lifts_the_darkness_over_its_whole_lands():
    html = HTML.read_text(encoding="utf-8")
    fog_start = html.index("function updateEmpireFogMask()")
    fog_end = html.index("// The veil is static", fog_start)
    fog = html[fog_start:fog_end]
    assert "regionCoverageRadiusKm" in fog
    assert "unlocks that whole region of the map" in fog
    # Region daylight is punched together with the village windows, and its
    # rim is struck in the realm's gold.
    assert "regionHoles.concat(holes).forEach" in fog
    assert "rgba(240,199,103,.85)" in fog


def test_region_hall_screen_exists_and_is_reachable():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="screen-region"' in html
    assert 'id="regionHallPanel"' in html
    assert "if (name === 'region') renderRegionScreen();" in html
    logic = empire_logic(html)
    assert "function openEmpireRegion(" in logic
    assert "function renderRegionScreen()" in logic
    # Both the Royal Ledger's region rows and the atlas region banners open
    # the hall (the atlas framing survives as the hall's own button).
    assert "openEmpireRegion(btn.dataset.region)" in logic
    assert "openEmpireRegion(region.id)" in logic
    assert "function showRegionOnAtlas(" in logic
    assert "frameEmpireRegion" in html


def test_region_hall_runs_the_region_as_one_realm():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    hall_start = logic.index("function renderRegionScreen()")
    hall = logic[hall_start:]
    # The liege chain up the nested feudal ladder, with the next rung hinted.
    assert "region.duchyId" in hall
    assert "region-hall-liege" in hall
    assert "region-hall-ladder" in hall
    # Region-scoped taxes: its own strongbox, collected without touching the
    # rest of the realm.
    assert "function regionTributeReady(" in logic
    assert "function collectRegionTribute(" in logic
    assert 'data-action="region-collect"' in hall
    # Unity bonus surfaced, sanctuaries listed and governable, caravan roads shown.
    assert "REGION_TAX_BONUS" in hall
    assert 'data-action="region-village"' in hall
    assert "empireTradeRouteRecords().filter" in hall
    # A stale or merged-away region falls back gracefully to the Empire desk.
    assert "switchScreen('village'); return;" in hall.replace("  ", " ") or "switchScreen('village')" in hall


def test_region_collection_resets_only_that_regions_clocks():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    collect_start = logic.index("function collectRegionTribute(")
    collect_end = logic.index("function renderRegionScreen()", collect_start)
    collect = logic[collect_start:collect_end]
    assert "region.villages.forEach" in collect
    assert "v.lastTributeAt = now" in collect
    assert "empireVillages().forEach" not in collect  # never the whole realm


def test_release_is_versioned_for_the_service_worker():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    # empire_realm_core.js ships new maths per release; its cache-buster moves
    # with whichever release last touched it (settlement tiers, 2026-08-02).
    core_pin = "feudal-hierarchy-v221-20260804"
    assert f"empire_realm_core.js?v={core_pin}" in html
    assert f"./empire_realm_core.js?v={core_pin}" in sw
    # This release's own segment stays in the cache lineage forever.
    assert "empire-here-regions-v193-20260801" in sw.split("const BURBZ_CACHE = ", 1)[1].split("\n", 1)[0]
