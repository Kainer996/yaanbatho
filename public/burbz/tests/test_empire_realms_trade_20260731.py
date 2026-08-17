"""The Crusader-Kings endgame: Towns found Counties, Counties trade.

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
REALM_CORE_PIN = "town-strategy-v273-20260816"


def town(seed: int, name: str, lat: float, lon: float, day: int, hour: int):
    """One exact Town: three claims within roughly a kilometre."""
    return [
        {
            "seed": seed + i,
            "name": name if i == 0 else f"{name} {i + 1}",
            "lat": lat + i * 0.006,
            "lon": lon + i * 0.004,
            "claimedAt": f"2026-07-{day:02d}T{hour + i:02d}:00:00Z",
        }
        for i in range(3)
    ]


def county(seed: int, name: str, lat: float, lon: float, day: int):
    """Three Towns within 150 km, but far enough apart not to become a City."""
    return (
        town(seed, name, lat, lon, day, 0)
        + town(seed + 1000, name + " North", lat + 0.20, lon, day, 3)
        + town(seed + 2000, name + " East", lat, lon + 0.25, day, 6)
    )


# Two real-feeling Counties: Delamere Forest country and southern France.
CHESHIRE = county(1, "Delamere", 53.228, -2.684, 1)
PROVENCE = county(9, "Gordes", 43.911, 5.200, 10)


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    # Place-name fixtures legitimately contain characters outside the Windows
    # ANSI code page, so decode Node's JSON with its actual UTF-8 encoding.
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# Region formation
# ---------------------------------------------------------------------------

def test_three_nearby_towns_found_a_county():
    result = run_core(f"core.deriveRegions({json.dumps(CHESHIRE)})")
    assert len(result["regions"]) == 1
    region = result["regions"][0]
    # The capital remains the earliest-liberated sanctuary, while the county
    # has its own globally unique proper name.
    assert region["capitalName"] == "Delamere"
    assert region["name"] == run_core("core.placeLabel('county', 1)")
    assert region["tier"] == "county"
    assert region["townCount"] == 3
    assert region["villageCount"] == 9
    assert region["id"] == "1"


def test_two_towns_are_not_yet_a_county_but_progress_is_reported():
    result = run_core(f"core.deriveRegions({json.dumps(CHESHIRE[:6])})")
    assert result["regions"] == []
    assert len(result["unassigned"]) == 6
    assert len(result["unassignedTowns"]) == 2
    assert result["largestCluster"] == 2


def test_distant_clusters_form_separate_regions_delamere_and_south_of_france():
    villages = CHESHIRE + PROVENCE
    result = run_core(f"core.deriveRegions({json.dumps(villages)})")
    names = sorted(r["name"] for r in result["regions"])
    expected = sorted([
        run_core("core.placeLabel('county', 1)"),
        run_core("core.placeLabel('county', 9)"),
    ])
    assert names == expected


def test_counties_never_relabel_themselves_and_crowns_come_from_nesting():
    # Simplified Crusader Kings: a county is founded by 3 Towns and always stays
    # a county — higher tiers are made of the tier below (2 counties →
    # duchy, 2 duchies → kingdom, 2 kingdoms → empire), never of headcounts.
    assert run_core("core.regionTier(3)")["rank"] == "county"
    assert run_core("core.regionTier(5)")["rank"] == "county"
    assert run_core("core.regionTier(8)")["rank"] == "county"
    # Delamere and the Luberon are ~1200 km apart — two counties too far to
    # unite into a duchy (600 km), so the crown stays a Count's.
    both = CHESHIRE + PROVENCE
    crown = run_core(f"core.crownTitle(core.deriveRegions({json.dumps(both)}).regions)")
    expected_crown = "Count of " + run_core("core.placeName('county', 1)")
    assert crown == expected_crown
    assert run_core(f"core.crownTitle(core.deriveRegions({json.dumps(CHESHIRE)}).regions)") == expected_crown


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
    assert f'empire_realm_core.js?v={REALM_CORE_PIN}' in html
    assert f'./empire_realm_core.js?v={REALM_CORE_PIN}' in sw


def test_realm_layer_stays_hidden_until_the_first_region_exists():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    # The panel only builds realm UI when Counties exist; before that progress
    # is measured in founded Towns rather than absorbed village rows.
    assert "if (regions.length && rc) {" in logic
    assert "settlements.townCount" in logic
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
    # The realm lives in the 🛡️ COUNTIES navigation tab under the Empire map
    # (empire-nav-tabs-v275-20260817 — before that, the YOUR REALM dropdown).
    assert "'nav-counties', '🛡️', 'COUNTIES'" in html
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
    assert "Math.min(0.3, empireSettlementsInfo().townCount * 0.05 + empireRegionsInfo().regions.length * 0.1)" in cost
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
        "three Towns",
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
