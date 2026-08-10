"""Villages grow into towns, towns into cities — the settlement merge layer.

Liberate 3 neighbouring villages (chained within 5 km) and they merge into
one TOWN; raise 3 neighbouring towns (squares within 15 km) and they merge
into one CITY. Covers empire_realm_core.js deriveSettlements (pure maths,
driven through Node), an end-to-end harness running the REAL economy and
construction code (merged districts pay bonus taxes and build faster), and
the index.html gameplay/graphics contracts: ledger section, founding toasts,
fused daylight pools on the atlas, tier markers on the walking map and the
charter-stone standard in the 3D village.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "empire_realm_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
STORY = ROOT / "STORY.md"

REALM_CORE_PIN = "accurate-diets-full-catalogue-v226-20260805"
CURRENT_BUILD = "battle-faint-auto-hospital-v241-20260810"
OWN_RELEASE_PIN = "settlement-tiers-v203-20260803"

# Three villages a couple of kilometres apart — the classic neighbouring trio.
TRIO = [
    {"seed": 1, "name": "Wrenford", "lat": 53.200, "lon": -2.700, "claimedAt": "2026-07-01T00:00:00Z"},
    {"seed": 2, "name": "Larkbrook", "lat": 53.218, "lon": -2.700, "claimedAt": "2026-07-02T00:00:00Z"},
    {"seed": 3, "name": "Finchley", "lat": 53.209, "lon": -2.672, "claimedAt": "2026-07-03T00:00:00Z"},
]


def cluster(base_seed: int, name: str, lat: float, lon: float, day: int):
    """A tight trio of villages that will merge into one town."""
    return [
        {"seed": base_seed + i, "name": f"{name}{i}", "lat": lat + i * 0.018, "lon": lon,
         "claimedAt": f"2026-07-{day + i:02d}T00:00:00Z"}
        for i in range(3)
    ]


# Three towns whose squares sit ~8-10 km apart: together, one city of nine.
TRI_CITY = cluster(10, "Alph", 53.20, -2.70, 1) + cluster(20, "Beth", 53.20, -2.58, 4) + cluster(30, "Gimel", 53.28, -2.64, 7)


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# Core maths: 3 neighbouring villages → 1 town
# ---------------------------------------------------------------------------

def test_three_neighbouring_liberated_villages_merge_into_one_town():
    result = run_core(f"core.deriveSettlements({json.dumps(TRIO)})")
    assert result["townCount"] == 1 and result["cityCount"] == 0
    town = result["towns"][0]
    # The earliest village still anchors the stable ID, but the town has its
    # own proper name instead of stealing the village's identity.
    expected_name = run_core("core.placeName('town', 1)")
    expected_label = run_core("core.placeLabel('town', 1)")
    assert town["name"] == expected_name
    assert town["label"] == expected_label
    assert town["villageCount"] == 3
    assert town["id"] == "town-1"
    # Every district knows what it merged into; the heart knows it leads.
    assert result["tierBySeed"]["1"] == {
        "tier": "town", "role": "heart", "id": "town-1",
        "name": expected_name, "label": expected_label, "icon": "🏘️",
    }
    assert result["tierBySeed"]["2"]["role"] == "district"


def test_two_villages_are_not_yet_a_town_but_progress_is_reported():
    result = run_core(f"core.deriveSettlements({json.dumps(TRIO[:2])})")
    assert result["townCount"] == 0
    assert result["largestVillageCluster"] == 2


def test_distant_villages_do_not_merge():
    spread = [dict(v, lon=v["lon"] + i * 0.15) for i, v in enumerate(TRIO)]  # ~10 km gaps
    result = run_core(f"core.deriveSettlements({json.dumps(spread)})")
    assert result["townCount"] == 0
    assert result["largestVillageCluster"] == 1


# ---------------------------------------------------------------------------
# Core maths: 3 neighbouring towns → 1 city
# ---------------------------------------------------------------------------

def test_three_neighbouring_towns_merge_into_one_city():
    result = run_core(f"core.deriveSettlements({json.dumps(TRI_CITY)})")
    assert result["townCount"] == 3 and result["cityCount"] == 1
    city = result["cities"][0]
    # The earliest town still anchors the stable ID, but the city gets a
    # separate rank-specific proper name.
    expected_label = run_core("core.placeLabel('city', 10)")
    assert city["label"] == expected_label
    assert city["townCount"] == 3
    assert city["villageCount"] == 9
    # Member towns keep existing as its boroughs, and every village maps
    # straight to the city tier now.
    assert all(t["cityId"] == city["id"] for t in result["towns"])
    assert result["tierBySeed"]["21"]["tier"] == "city"
    assert result["tierBySeed"]["21"]["label"] == expected_label


def test_two_towns_are_not_yet_a_city_but_progress_is_reported():
    two = cluster(10, "Alph", 53.20, -2.70, 1) + cluster(20, "Beth", 53.20, -2.58, 4)
    result = run_core(f"core.deriveSettlements({json.dumps(two)})")
    assert result["townCount"] == 2 and result["cityCount"] == 0
    assert result["largestTownCluster"] == 2


def test_settlement_tiers_carry_the_gameplay_bonuses():
    town = run_core("core.settlementTierInfo('town')")
    city = run_core("core.settlementTierInfo('city')")
    village = run_core("core.settlementTierInfo('village')")
    # Towns: +10% taxes, guilds 15% faster, wider daylight. Cities: +25%, 30%.
    assert town["taxBonus"] == 0.10 and town["buildTimeFactor"] == 0.85
    assert city["taxBonus"] == 0.25 and city["buildTimeFactor"] == 0.70
    assert village["taxBonus"] == 0 and village["buildTimeFactor"] == 1
    assert village["territoryRadiusM"] < town["territoryRadiusM"] < city["territoryRadiusM"]
    # Unknown ranks fall back to the plain village tier.
    assert run_core("core.settlementTierInfo('nonsense')") == village


def test_settlements_are_deterministic_and_ids_survive_growth():
    first = run_core(f"core.deriveSettlements({json.dumps(TRIO)})")
    again = run_core(f"core.deriveSettlements({json.dumps(TRIO)})")
    assert first == again
    grown = TRIO + [{"seed": 4, "name": "Owlstead", "lat": 53.191, "lon": -2.688, "claimedAt": "2026-07-09T00:00:00Z"}]
    result = run_core(f"core.deriveSettlements({json.dumps(grown)})")
    assert result["towns"][0]["id"] == "town-1"  # the heart still anchors it
    assert result["towns"][0]["villageCount"] == 4


# ---------------------------------------------------------------------------
# End-to-end: the REAL economy + construction code, run in Node
# ---------------------------------------------------------------------------

def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def build_harness(villages_js: str, probe_js: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    consts = html[html.index("const EMPIRE_TRIBUTE_INTERVAL_MS"):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "empireSettlementsInfo",
            "empireSettlementOfSeed",
            "empireSettlementById",
            "empireVillageTerritoryRadiusM",
            "settlementBuildFactorForSeed",
            "ensureVillageEconomy",
            "villageBuildingLevel",
            "villageNeedCapacity",
            "villageProductionSnapshot",
            "villageEconomySnapshot",
            "villageBuildTimeMs",
            "empireHasQuarryInvestment",
            "villageBuildingCost",
            "empireBuildStructure",
        )
    )
    stubs = f"""
global.window = global;
window.BurbzEmpireRealmCore = require({json.dumps(str(CORE))});
const realmCore = () => window.BurbzEmpireRealmCore;
let empireSettlementsCache = null, empireSettlementsCacheKey = '';
const EMPIRE_TERRITORY_RADIUS_M = 2200;
const toasts = [];
const gameState = {{ player: {{ coins: 5000, branches: 5000, stone: 5000 }} }};
const villages = {villages_js};
const empire = {{ villages: Object.fromEntries(villages.map(v => [String(v.seed >>> 0), v])) }};
const ensureEmpireState = () => empire;
const empireVillages = () => villages;
const empireCompleteConstructions = () => false;
const empireRegionOfSeed = () => null;
const villageRoleMultiplier = () => 1;
const regionRoleMultiplier = () => 1;
const villageRuinDefsFor = () => [];
const VILLAGE_RUIN_KINDS = {{ house: {{}} }};
const playerBranches = () => gameState.player.branches;
const playerStone = () => gameState.player.stone;
const addCoins = n => {{ gameState.player.coins += n; }};
const addBranches = n => {{ gameState.player.branches += n; }};
const addStone = n => {{ gameState.player.stone += n; }};
const snapshotGameState = () => JSON.parse(JSON.stringify(gameState));
const restoreGameStateSnapshot = () => {{}};
const durableSaveState = () => ({{ ok:true }});
const saveState = () => {{}}; const updateHeader = () => {{}}; const renderVillage = () => {{}};
const SFX = {{ questComplete: () => {{}} }}; const vibrate = () => {{}};
const showToast = t => toasts.push(t);
const formatBuildDuration = () => 'soon';
let villageActive = null, villageBuiltSeed = null;
"""
    return stubs + consts + "\n" + functions + "\n" + probe_js


def run_harness(villages_js: str, probe_js: str):
    result = subprocess.run(["node", "-e", build_harness(villages_js, probe_js)], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


ECON_PROBE = """
// Identical economies everywhere: only the settlement tier may differ.
villages.forEach(v => {
  const eco = ensureVillageEconomy(v);
  eco.buildings = { farm: 1, well: 1, cottages: 2, tavern: 1 };
  eco.population = 20;
});
const snapOf = seed => villageEconomySnapshot(empire.villages[String(seed)]);
empireBuildStructure(PROBE_SEED, 'farm');
const built = empire.villages[String(PROBE_SEED)].economy.construction;
console.log(JSON.stringify({
  probe: { taxes: snapOf(PROBE_SEED).taxes, merged: snapOf(PROBE_SEED).merged,
           tier: snapOf(PROBE_SEED).settlement ? snapOf(PROBE_SEED).settlement.tier : null,
           buildMs: built.endMs - built.startMs,
           territoryM: empireVillageTerritoryRadiusM(PROBE_SEED) },
  lone: { taxes: snapOf(LONE_SEED).taxes, merged: snapOf(LONE_SEED).merged,
          territoryM: empireVillageTerritoryRadiusM(LONE_SEED) }
}));
"""


def test_town_districts_pay_ten_percent_more_and_build_15_percent_faster():
    # The trio merges; a fourth village far away stays a lone village.
    fixture = TRIO + [{"seed": 99, "name": "Farholm", "lat": 55.0, "lon": -3.9, "claimedAt": "2026-07-08T00:00:00Z"}]
    out = run_harness(json.dumps(fixture), ECON_PROBE.replace("PROBE_SEED", "2").replace("LONE_SEED", "99"))
    assert out["probe"]["tier"] == "town"
    assert out["probe"]["merged"] == 1.10
    assert out["lone"]["merged"] == 1
    # Same population, same buildings, same happiness — the district's taxes
    # only beat the lone village's because the merged town raises them.
    assert out["probe"]["taxes"] > out["lone"]["taxes"]
    # Grain Farm level 1→2 is a 10-minute build; town guilds shave 15% off.
    assert out["probe"]["buildMs"] == round(10 * 60000 * 0.85)
    # And its daylight pool on the atlas grows from 2200 m to 3200 m.
    assert out["lone"]["territoryM"] == 2200
    assert out["probe"]["territoryM"] == 3200


def test_city_boroughs_pay_25_percent_more_and_build_30_percent_faster():
    fixture = TRI_CITY + [{"seed": 99, "name": "Farholm", "lat": 55.0, "lon": -3.9, "claimedAt": "2026-07-20T00:00:00Z"}]
    out = run_harness(json.dumps(fixture), ECON_PROBE.replace("PROBE_SEED", "21").replace("LONE_SEED", "99"))
    assert out["probe"]["tier"] == "city"
    assert out["probe"]["merged"] == 1.25
    assert out["probe"]["taxes"] > out["lone"]["taxes"]
    assert out["probe"]["buildMs"] == round(10 * 60000 * 0.70)
    assert out["probe"]["territoryM"] == 4200


# ---------------------------------------------------------------------------
# index.html wiring: gameplay
# ---------------------------------------------------------------------------

def test_settlement_layer_is_derived_cached_and_never_stored():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "function empireSettlementsInfo()" in logic
    assert "core.deriveSettlements(villages)" in logic
    assert "function empireSettlementOfSeed(" in logic
    assert "function empireSettlementById(" in logic
    # Derived from the same claims as regions — no settlement state is saved.
    assert "gameState.empire.settlements" not in html


def test_merged_tax_bonus_multiplies_into_the_economy_beside_region_unity():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    snap_start = logic.index("function villageEconomySnapshot(")
    snap_end = logic.index("\n// Population drifts", snap_start)
    snap = logic[snap_start:snap_end]
    assert "empireSettlementOfSeed(rec.seed)" in snap
    assert "settlementTierInfo(settlement.tier).taxBonus" in snap
    # The merged multiplier composes with (not replaces) unity and governance,
    # and the empty-province rule survives untouched.
    assert "* merged * unity * governance)" in snap
    assert snap.count("pop <= 0 ? 0") == 2


def test_merged_guilds_shorten_construction_in_the_real_build_flow():
    html = HTML.read_text(encoding="utf-8")
    build = function_source(html, "empireBuildStructure")
    assert "settlementBuildFactorForSeed(rec.seed)" in build
    assert "* guildFactor" in build
    # The per-town construction lock is untouched by the speed-up.
    assert "const eco = ensureVillageEconomy(rec);" in build
    assert "eco.construction = { id: building.id" in build


def test_liberation_announces_town_and_city_foundings_when_they_happen():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    claim_start = logic.index("function claimCurrentVillage(")
    claim_end = logic.index("\nfunction renderVillageClaimBar", claim_start)
    claim = logic[claim_start:claim_end]
    assert "empireSettlementsInfo()" in claim
    assert "grow together" in claim  # the town toast
    assert "neighbouring towns merge into one" in claim  # the city toast
    assert "+10% taxes" in claim and "+25% taxes" in claim


def test_royal_ledger_gains_a_towns_and_cities_section():
    html = HTML.read_text(encoding="utf-8")
    assert 'class="settlement-section"' in html
    assert "TOWNS &amp; CITIES" in html
    assert "3 neighbouring villages make a town · 3 neighbouring towns make a city" in html
    assert 'data-action="empire-settlement"' in html
    assert "function frameEmpireSettlement(" in html
    # A nudge appears once two villages (or two towns) stand side by side.
    assert "liberate a third within" in html
    assert "raise a third within" in html


def test_governor_desk_and_village_screen_name_the_settlement():
    html = HTML.read_text(encoding="utf-8")
    assert 'class="province-settlement' in html
    assert "Village district of " in html and "Village centre of " in html
    assert "part of the " in html  # the claim-bar banner
    # The village identity stays in the title; its larger settlement is a
    # separate plain-language line beneath it.
    assert "v.name.toUpperCase() + ' · VILLAGE'" in html
    assert "This village is the " in html and "settleTitle.label" in html


# ---------------------------------------------------------------------------
# index.html wiring: graphics
# ---------------------------------------------------------------------------

def test_atlas_daylight_pools_widen_per_tier_so_merges_fuse_into_one_glow():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "function empireVillageTerritoryRadiusM(" in logic
    # Both the green territory circles and the darkness-veil windows use the
    # tier radius, so a merged town reads as one continuous patch of daylight.
    refresh = html[html.index("function refreshEmpireMap("):html.index("function initialiseEmpireMap(")]
    assert "core.territoryCircle(v, empireVillageTerritoryRadiusM(v.seed))" in refresh
    fog = html[html.index("function updateEmpireFogMask()"):html.index("// The veil is static")]
    assert "empireVillageTerritoryRadiusM(village.seed)" in fog


def test_atlas_flies_town_and_city_standards_and_counts_them_in_the_status():
    html = HTML.read_text(encoding="utf-8")
    refresh = html[html.index("function refreshEmpireMap("):html.index("function initialiseEmpireMap(")]
    assert "is-settlement is-' + settlement.tier" in refresh
    assert "frameEmpireSettlement(settlement.id)" in refresh
    assert "town' + (settlementsOnMap.townCount === 1 ? '' : 's') + ' grown from merged villages'" in refresh
    assert "' crowned'" in refresh
    # Distinct heraldry: green town standards, glowing gold city standards.
    assert ".empire-map-marker.is-settlement.is-town .empire-map-marker-icon" in html
    assert ".empire-map-marker.is-settlement.is-city .empire-map-marker-icon" in html
    assert "empire-city-glow" in html


def test_walking_map_markers_wear_the_settlement_tier():
    html = HTML.read_text(encoding="utf-8")
    draw = function_source(html, "drawVillageMarkers")
    assert "settle ? settle.icon : '🏰'" in draw
    assert "burbz-village-settlement is-' + settle.tier" in draw
    assert "in-' + settle.tier" in draw
    assert ".burbz-village-marker .burbz-village-settlement" in html
    assert ".burbz-village-marker.in-city .burbz-village-icon" in html


def test_3d_village_raises_the_charter_stone_standard_once_merged():
    html = HTML.read_text(encoding="utf-8")
    assert "function villageMakeSettlementStandard(" in html
    maker = function_source(html, "villageMakeSettlementStandard")
    # Gold for a city (with its glowing crown), liberation green for a town,
    # and one district pennant per member ringing the charter stone.
    assert "0xf0c767 : 0x8ee39a" in maker
    assert "TorusGeometry" in maker
    assert "settle.memberCount" in maker
    scene = html[html.index("function buildVillageScene("):html.index("function onVillageResize(")]
    assert "villageMakeSettlementStandard(r, pal, { ...settleHere" in scene
    assert "empireSettlementOfSeed(v.seed)" in scene


def test_story_canon_documents_the_merge_layer():
    story = STORY.read_text(encoding="utf-8")
    assert "## Villages grow into towns, towns into cities" in story
    assert "three neighbouring villages" in story.lower()
    assert "one city" in story.lower()


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_pinned_and_realm_core_cache_buster_moved():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # deriveSettlements ships in empire_realm_core.js — its cache-buster moves
    # whenever that shared core changes so installed players receive the names.
    assert f'src="empire_realm_core.js?v={REALM_CORE_PIN}"' in html
    assert f"'./empire_realm_core.js?v={REALM_CORE_PIN}'" in sw
