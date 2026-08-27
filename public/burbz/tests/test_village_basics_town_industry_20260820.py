"""The settlement law: village basics, town industry.

Yaan's design (2026-08-20), pinned as `village-basics-town-industry-v299`:

- A lone village keeps only the basics: Timber Cabin, Hunter-Gatherer Hut,
  Stone Well, Cottage Row, Alehouse, Storehouse — all bought with coins and
  timber alone, because the stone economy itself is town work.
- The industry — Grain Farm, Lumber Camp, Quarry, Chapel, Market Hall —
  carries `tier: 'town'` and opens when three starred villages merge into a
  Town. The village desk hides those cards and says what the merge opens.
- The NEW food source for villages is the 🏹 Hunter-Gatherer Hut: feeds 8
  villagers per level, brings home berries and mast, needs one villager,
  and rises in 15 minutes.
- Grandfathering: anything an older save already built keeps working and
  may upgrade — only NEW town-tier builds gate on the merge, exactly like
  the trainer-level gate before it.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "trail-mode-v329-20260825"
CURRENT_BUILD = "walk-detection-removed-v334-20260827"

# The Iron Foundry and the Entertainment House are town industry too — they
# arrived with the towns-3D release and the pin had not been told.
TOWN_TIER = {"farm", "lumber", "quarry", "chapel", "market", "foundry", "entertainment"}
VILLAGE_TIER = {"cabin", "hut", "lumberhut", "minehut", "well", "cottages", "tavern", "storehouse"}


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def buildings_block(html: str) -> str:
    return html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]


# ---------------------------------------------------------------------------
# 1. The roster: who belongs to which tier
# ---------------------------------------------------------------------------

def test_exactly_the_industry_buildings_carry_the_town_tier():
    tiers = {}
    for line in buildings_block(HTML.read_text(encoding="utf-8")).splitlines():
        m = re.search(r"\{ id: '(\w+)',", line)
        if m:
            tiers[m.group(1)] = "tier: 'town'" in line
    assert {bid for bid, town in tiers.items() if town} == TOWN_TIER
    assert {bid for bid, town in tiers.items() if not town} == VILLAGE_TIER


def test_village_basics_cost_no_stone_and_the_hut_feeds_the_village():
    block = buildings_block(HTML.read_text(encoding="utf-8"))
    lines = {re.search(r"\{ id: '(\w+)',", l).group(1): l
             for l in block.splitlines() if re.search(r"\{ id: '(\w+)',", l)}
    # Coins and timber alone for the basics. The cabin's stepped costLevels
    # are checked level by level in test_timber_village_builds_20260823.
    for bid in VILLAGE_TIER - {"cabin"}:
        assert "stone: 0 }" in lines[bid], bid
    hut = lines["hut"]
    assert "name: 'Hunter-Gatherer Hut'" in hut
    assert "need: 'food'" in hut and "perLevel: 8" in hut
    assert "workers: 1" in hut and "workPriority: 1" in hut
    assert "buildMinutes: 15," in hut
    assert "hedgerow_berries" in hut and "acorn_handful" in hut
    assert "unlockLevel" not in hut  # food is survival — never trainer-gated
    # The industry keeps its stone bills: stone is what towns are for.
    assert "stone: 5 }" in lines["farm"] and "stone: 12 }" in lines["market"]


# ---------------------------------------------------------------------------
# 2. The gate: new town-tier builds need a merged settlement
# ---------------------------------------------------------------------------

def test_the_gate_reads_the_tier_and_the_build_flow_enforces_it_for_new_builds_only():
    html = HTML.read_text(encoding="utf-8")
    gate = function_source(html, "settlementAllowsBuilding")
    assert "building.tier !== 'town'" in gate
    assert "empireSettlementOfSeed(rec && rec.seed)" in gate
    build = function_source(html, "empireBuildStructure")
    assert "level === 0 && !settlementAllowsBuilding(rec, building)" in build
    assert "is town work — merge three starred villages" in build
    # Wholesale orders obey the same law per ward.
    plan = function_source(html, "wholesaleUpgradePlan")
    assert "level === 0 && !settlementAllowsBuilding(rec, b)" in plan


def test_the_village_desk_lists_basics_and_teases_the_town_works():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderVillageManagePanel")
    assert "EMPIRE_BUILDINGS.filter(b => settlementAllowsBuilding(rec, b) || villageBuildingLevel(rec, b.id) > 0)" in panel
    assert "Town works — open when three starred villages merge" in panel
    # The village guidance points at the hut now, not the farm.
    assert "'🌾 Grain Farm' : '🏹 Hunter-Gatherer Hut'" in panel
    assert "EMPIRE_BUILDING_INDEX.hut" in panel
    # And the hunters' camp stands in the 3D village itself.
    assert "b.id === 'hut'" in html
    assert "'🏹 Hunter-Gatherer Hut'" in html


def build_harness(driver: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    buildings = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "villageBuildTimeMs",
            "ensureVillageEconomy",
            "villageBuildingLevel",
            "villageBuildingTier",
            "empireHasQuarryInvestment",
            "villageBuildingCost",
            "settlementAllowsBuilding",
            "villageBuildDurationMs",
            "villageConstructions",
            "villageConstructionOf",
            "villageBuildSlots",
            "villageBuildSlotsFree",
            "empireBuildStructure",
        )
    )
    stubs = """
global.window = global;
const toasts = [];
const gameState = { player: { level: 99, coins: 5000, branches: 5000, stone: 5000 } };
const rec = { seed: 1111, name: 'Wrenholt', claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
const empire = { villages: { '1111': rec } };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireCompleteConstructions = () => false;
// The dial under test: flip `merged` to move this holding into a Town.
let merged = null;
const empireSettlementOfSeed = () => merged;
const empireSettlementById = () => merged;
const canonicalEmpireSettlement = settlement => settlement;
const townDisplayName = settlement => settlement && 'Testford';
const townBuildNetwork = () => { toasts.push('DELEGATED'); };
const settlementBuildFactorForSeed = () => 1;
const villageStewardProject = () => ({ staffed:false, bird:null, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 });
const villageRuinDefsFor = () => [];
const villageRngFrom = () => () => 0.5;
const VILLAGE_RUIN_KINDS = { house: {} };
const VILLAGE_BASE_POPULATION = 0, VILLAGE_MAX_POPULATION = 200;
const formatBuildDuration = () => 'soon';
const playerBranches = () => gameState.player.branches;
const playerStone = () => gameState.player.stone;
const addCoins = n => { gameState.player.coins += n; };
const addBranches = n => { gameState.player.branches += n; };
const addStone = n => { gameState.player.stone += n; };
const snapshotGameState = () => JSON.parse(JSON.stringify(gameState));
const restoreGameStateSnapshot = () => {};
const durableSaveState = () => true;
const saveState = () => {};
const showToast = t => toasts.push(t);
const showResourceQuestPrompt = () => toasts.push('SHORT');
const goalWithThe = name => name;
const SFX = { questComplete: () => {} };
const vibrate = () => {};
const updateHeader = () => {};
const renderVillage = () => {};
const renderTownScreen = () => {};
const birdDisplayName = bird => bird && bird.name;
let villageActive = null, villageBuiltSeed = null, currentScreen = 'empire';
"""
    return stubs + buildings + "\n" + functions + "\n" + driver


def test_a_lone_village_builds_the_hut_but_not_the_quarry_until_it_merges():
    out = run_node(build_harness("""
empireBuildStructure(1111, 'quarry');                       // refused: town work
const refusedQuarry = { construction: rec.economy.constructions[0] || null, toast: toasts.at(-1) };
empireBuildStructure(1111, 'hut');                          // the village way to eat
const hut = { construction: { ...rec.economy.constructions[0] }, coins: gameState.player.coins };
rec.economy.constructions.length = 0;
// A grandfathered farm from an old save keeps its right to upgrade...
rec.economy.buildings.farm = 1;
empireBuildStructure(1111, 'farm');
const grandfathered = { id: rec.economy.constructions[0]?.id || null, toLevel: rec.economy.constructions[0]?.toLevel || null };
rec.economy.constructions.length = 0;
// ...and once the village sits inside a Town, new industry opens (townMode
// builds land on the ward without delegating).
merged = { id: 'town-1', tier: 'town', role: 'heart', heartSeed: 1111 };
empireBuildStructure(1111, 'quarry', { townMode: true });
const townQuarry = rec.economy.constructions[0]?.id || null;
console.log(JSON.stringify({ refusedQuarry, hut, grandfathered, townQuarry }));
"""))
    assert out["refusedQuarry"]["construction"] is None
    assert "town work" in out["refusedQuarry"]["toast"]
    assert out["hut"]["construction"]["id"] == "hut"
    assert out["hut"]["coins"] == 5000 - 30  # coins and timber alone
    assert out["grandfathered"] == {"id": "farm", "toLevel": 2}
    assert out["townQuarry"] == "quarry"


# ---------------------------------------------------------------------------
# 3. Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert RELEASE in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
