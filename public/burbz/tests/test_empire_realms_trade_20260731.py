"""The Crusader-Kings endgame: villages found regions, regions trade.

Covers empire_realm_core.js (pure maths, driven through Node) and the
index.html wiring contracts: the realm layer stays invisible until the first
region exists, regions grant unity taxes, trade routes cost/earn sensibly,
and the liberation map shows regions and gold caravan roads.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "empire_realm_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
STORY = ROOT / "STORY.md"

# Two real-feeling clusters: Delamere Forest country and the south of France.
CHESHIRE = [
    {"seed": 1, "name": "Delamere", "lat": 53.228, "lon": -2.684, "claimedAt": "2026-07-01T00:00:00Z"},
    {"seed": 2, "name": "Kelsall", "lat": 53.207, "lon": -2.712, "claimedAt": "2026-07-02T00:00:00Z"},
    {"seed": 3, "name": "Tarporley", "lat": 53.156, "lon": -2.667, "claimedAt": "2026-07-03T00:00:00Z"},
]
PROVENCE = [
    {"seed": 9, "name": "Gordes", "lat": 43.911, "lon": 5.200, "claimedAt": "2026-07-10T00:00:00Z"},
    {"seed": 10, "name": "Roussillon", "lat": 43.902, "lon": 5.293, "claimedAt": "2026-07-11T00:00:00Z"},
    {"seed": 11, "name": "Bonnieux", "lat": 43.823, "lon": 5.307, "claimedAt": "2026-07-12T00:00:00Z"},
]


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# Region formation
# ---------------------------------------------------------------------------

def test_three_nearby_liberated_villages_found_a_region():
    result = run_core(f"core.deriveRegions({json.dumps(CHESHIRE)})")
    assert len(result["regions"]) == 1
    region = result["regions"][0]
    # The capital is the earliest-liberated sanctuary, and names are feudal.
    assert region["capitalName"] == "Delamere"
    assert region["name"] == "County of Delamere"
    assert region["tier"] == "county"
    assert region["villageCount"] == 3
    assert region["id"] == "1"


def test_two_villages_are_not_yet_a_region_but_progress_is_reported():
    result = run_core(f"core.deriveRegions({json.dumps(CHESHIRE[:2])})")
    assert result["regions"] == []
    assert len(result["unassigned"]) == 2
    assert result["largestCluster"] == 2


def test_distant_clusters_form_separate_regions_delamere_and_south_of_france():
    villages = CHESHIRE + PROVENCE
    result = run_core(f"core.deriveRegions({json.dumps(villages)})")
    names = sorted(r["name"] for r in result["regions"])
    assert names == ["County of Delamere", "County of Gordes"]


def test_counties_never_relabel_themselves_and_crowns_come_from_nesting():
    # Simplified Crusader Kings: a county is a county at 3 villages and STILL
    # a county at 8 — higher tiers are made of the tier below (2 counties →
    # duchy, 2 duchies → kingdom, 2 kingdoms → empire), never of headcounts.
    assert run_core("core.regionTier(3)")["rank"] == "county"
    assert run_core("core.regionTier(5)")["rank"] == "county"
    assert run_core("core.regionTier(8)")["rank"] == "county"
    # Delamere and the Luberon are ~1200 km apart — two counties too far to
    # unite into a duchy (600 km), so the crown stays a Count's.
    both = CHESHIRE + PROVENCE
    crown = run_core(f"core.crownTitle(core.deriveRegions({json.dumps(both)}).regions)")
    assert crown == "Count of Delamere"
    assert run_core(f"core.crownTitle(core.deriveRegions({json.dumps(CHESHIRE)}).regions)") == "Count of Delamere"


# ---------------------------------------------------------------------------
# Trade routes
# ---------------------------------------------------------------------------

def test_trade_route_candidates_link_region_capitals_with_real_distance():
    both = CHESHIRE + PROVENCE
    cands = run_core(f"core.tradeRouteCandidates(core.deriveRegions({json.dumps(both)}).regions)")
    assert len(cands) == 1
    # Delamere Forest to the Luberon is roughly 1150-1250 km as the bird flies.
    assert 1100 < cands[0]["distanceKm"] < 1300
    assert cands[0]["key"] == "1~9"


def test_trade_income_rewards_population_and_distance_but_stays_bounded():
    near = run_core("core.tradeRouteIncome(40, 40, 100)")
    far = run_core("core.tradeRouteIncome(40, 40, 1200)")
    very_far = run_core("core.tradeRouteIncome(40, 40, 12000)")
    empty = run_core("core.tradeRouteIncome(0, 0, 1200)")
    assert far["coins"] > near["coins"]  # distance pays
    assert very_far["distanceFactor"] == 2.25  # ... but the bonus is capped
    assert empty["coins"] < 15  # ghost regions barely trade
    # A mature long route earns like ~2 healthy provinces, not an economy.
    assert 60 < far["coins"] < 130


def test_trade_route_costs_escalate_and_goods_are_seeded_and_distinct():
    c0 = run_core("core.tradeRouteCost(0)")
    c2 = run_core("core.tradeRouteCost(2)")
    assert c0 == {"coins": 140, "branches": 35}
    assert c2["coins"] > c0["coins"] and c2["branches"] > c0["branches"]
    goods = run_core("core.tradeRouteGoods(1, 9)")
    assert len(goods) == 2 and goods[0] != goods[1]
    # Deterministic: same capitals, same goods, forever.
    assert goods == run_core("core.tradeRouteGoods(1, 9)")


def test_trade_arcs_are_short_great_circles_even_across_the_dateline():
    fc = run_core(
        "core.tradeRouteFeatureCollection([{key:'a~b',"
        "from:{seed:1,name:'East',lat:10,lon:179.5},to:{seed:2,name:'West',lat:12,lon:-179.5}}], 32)"
    )
    coords = fc["features"][0]["geometry"]["coordinates"]
    lons = [p[0] for p in coords]
    assert max(lons) - min(lons) < 5  # unwrapped, no world-spanning zigzag
    assert fc["features"][0]["properties"]["color"] == "#f0c767"
    ends = run_core(
        "core.greatCircleArc({lat:53.228,lon:-2.684},{lat:43.911,lon:5.2},24)"
    )
    assert abs(ends[0][0] - -2.684) < 1e-6 and abs(ends[-1][1] - 43.911) < 1e-6


# ---------------------------------------------------------------------------
# index.html wiring
# ---------------------------------------------------------------------------

def test_realm_core_is_loaded_by_page_and_service_worker():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert "empire_realm_core.js?v=" in html
    assert "./empire_realm_core.js?v=" in sw


def test_realm_layer_stays_hidden_until_the_first_region_exists():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    # The panel only builds realm UI when regions exist; before that, at most
    # a single progress hint (and only from the second village).
    assert "if (regions.length && rc) {" in logic
    assert "} else if (count >= 2 && rc) {" in logic
    assert "none of this appears before the first region exists" in logic.lower() or "None of this appears before the first region exists" in logic


def test_unity_taxes_and_crown_titles_are_wired_into_the_economy():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    snap_start = logic.index("function villageEconomySnapshot(")
    snap_end = logic.index("\n// Population drifts", snap_start)
    snap = logic[snap_start:snap_end]
    assert "REGION_TAX_BONUS" in snap
    # Unity still multiplies the tax take — alongside the governance multiplier
    # a posted Steward (and the region's Warden) contribute.
    assert "* unity * governance)" in snap
    # The empty-province rule survives: both taxes and branches still gate.
    assert snap.count("pop <= 0 ? 0") == 2
    assert "function empireCrownTitle()" in logic
    assert "empireCrownTitle()" in logic.split("function empireCrownTitle()")[1]


def test_trade_routes_are_stored_healed_and_collected_with_tribute():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "gameState.empire.tradeRoutes = {}" in html
    assert "function empireTradeRouteRecords()" in logic
    assert "function empireOpenTradeRoute(" in logic
    assert "empireTradeDue(now)" in logic  # folded into empireTributeReady
    assert "lastTradeAt = now" in logic  # collecting resets the caravan clock
    # Routes between regions that merged into one are pruned, not left rotting.
    assert "a.id === b.id" in logic


def test_royal_ledger_renders_realm_and_trade_sections():
    html = HTML.read_text(encoding="utf-8")
    assert 'class="realm-section"' in html
    # The realm is no longer a drawer of its own: it is the head of the single
    # YOUR REALM dropdown the ledger opens with (realm-dropdown-v223-20260804).
    assert "THE REALM" in html
    assert "'YOUR REALM'" in html
    assert "TRADE ROUTES" in html
    assert 'data-action="open-trade"' in html
    assert 'data-action="empire-region"' in html
    assert "sky-caravans between free counties" in html
    assert 'class="realm-hint"' in html


def test_liberation_map_shows_regions_and_gold_caravan_roads():
    html = HTML.read_text(encoding="utf-8")
    assert "map.addSource('empire-trade'" in html
    assert "id:'empire-trade-route'" in html
    assert "is-region" in html
    assert "frameEmpireRegion" in html
    # The caravan roads are re-struck onto the darkness veil so they glow
    # across still-shadowed lands.
    assert "empireTradeArcs.forEach(arc =>" in html
    assert "' united'" in html  # status line counts regions
    assert "' flying'" in html  # ... and open trade routes


def test_endgame_balance_regions_discount_new_birdhouses():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    cost_start = logic.index("function birdhouseCostForNextVillage(")
    cost_end = logic.index("\n// ===", cost_start)
    cost = logic[cost_start:cost_end]
    assert "Math.min(0.3, empireRegionsInfo().regions.length * 0.1)" in cost
    assert "Math.max(30," in cost and "Math.max(8," in cost


def test_founding_a_region_is_announced_in_liberation_flow():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    claim_start = logic.index("function claimCurrentVillage(")
    claim_end = logic.index("\nfunction renderVillageClaimBar", claim_start)
    claim = logic[claim_start:claim_end]
    assert "regionsBefore" in claim
    assert "is founded!" in claim
    assert "empireCrownTitle()" in claim


def test_story_canon_covers_regions_crowns_and_trade():
    story = STORY.read_text(encoding="utf-8")
    for marker in [
        "found a County",
        "County → Duchy → Kingdom → Empire",
        "unity taxes",
        "Emperor of the Liberated Skies",
        "trade routes",
        "Sky-caravans",
        "evil Burbz",
    ]:
        assert marker in story
    # Liberation framing survives the endgame: stewardship, never conquest.
    assert "never of conquest" in story
