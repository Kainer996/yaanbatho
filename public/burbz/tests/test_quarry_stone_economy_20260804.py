"""Quarry-produced Stone is a real settlement-construction economy.

These regressions pin the player-visible economy rather than a decorative quarry label:
Stone is persisted, produced, collected, shown, and spent atomically by village/town
construction, with a deliberate first-quarry bootstrap path.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
STONE_ICON = ROOT / "assets/ui/burbz-icon-set/stone.svg"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def economy_harness(driver: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    buildings = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "villageBuildTimeMs",
            "ensureVillageEconomy",
            "villageBuildingLevel",
            "villageBuildingTier",
            "villageWorkforce",
            "villageProductionSnapshot",
            "empireHasQuarryInvestment",
            "villageBuildingCost",
            "villageBuildDurationMs",
            "empireBuildStructure",
        )
    )
    stubs = """
global.window = global;
const toasts = [];
const gameState = { player: { coins: 500, branches: 500, stone: 0 } };
const rec = { seed: 1111, name: 'Stonewick', claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
const empire = { villages: { '1111': rec } };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireCompleteConstructions = () => false;
// This fixture is deliberately one loose village. Supply the Town adapters
// used by the real build function while keeping the tested economy unmerged.
const empireSettlementOfSeed = () => null;
const empireSettlementById = () => null;
const canonicalEmpireSettlement = settlement => settlement;
const townDisplayName = settlement => settlement && settlement.name;
const townBuildNetwork = () => { throw new Error('loose village must not delegate to a Town'); };
const settlementBuildFactorForSeed = () => 1;
const villageRoleMultiplier = () => 1;
const villageStewardProject = () => ({ staffed:false, bird:null, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 }); // vacant post: v294 project management is upside only
const villageRuinDefsFor = () => [];
const VILLAGE_RUIN_KINDS = { house: {} };
const VILLAGE_BASE_POPULATION = 0, VILLAGE_MAX_POPULATION = 200;
const playerBranches = () => gameState.player.branches;
const playerStone = () => gameState.player.stone;
const addCoins = n => { gameState.player.coins += n; };
const addBranches = n => { gameState.player.branches += n; };
const addStone = n => { gameState.player.stone += n; };
let failDurableSave = false;
const snapshotGameState = () => ({ player: JSON.parse(JSON.stringify(gameState.player)), economy: JSON.parse(JSON.stringify(rec.economy || null)) });
const restoreGameStateSnapshot = snapshot => { gameState.player = snapshot.player; if (snapshot.economy) rec.economy = snapshot.economy; else delete rec.economy; };
const durableSaveState = () => { if (failDurableSave) throw new Error('storage full'); return { ok:true }; };
const saveState = () => {}; const updateHeader = () => {}; const renderVillage = () => {}; const renderTownScreen = () => {};
const SFX = { questComplete: () => {} }; const vibrate = () => {};
const showToast = t => toasts.push(t);
const formatBuildDuration = () => 'soon';
let villageActive = null, villageBuiltSeed = null;
"""
    return stubs + buildings + "\n" + functions + "\n" + driver


def run_harness(driver: str):
    proc = subprocess.run(
        ["node", "-e", economy_harness(driver)],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


def test_stone_is_a_canonical_persisted_player_resource_with_legacy_normalisation():
    html = HTML.read_text(encoding="utf-8")
    default_state = html[html.index("const DEFAULT_STATE = {"):html.index("function loadState(")]
    load = function_source(html, "loadState")
    helpers = html[html.index("function addCoins("):html.index("// ============================================================================", html.index("function addCoins("))]
    assert re.search(r"player:\s*\{[^}]*stone:\s*0", default_state)
    assert "gameState.player.stone = normaliseStoneAmount(gameState.player.stone)" in load
    assert "needsStoneEconomyGrant" in load
    assert "economy.buildings.quarry" in load
    assert "Math.max(gameState.player.stone, QUARRY_FIRST_CUT_STONE)" in load
    assert "gameState.stoneEconomyVersion = 1" in load
    assert "function addStone(amount)" in helpers
    assert "function playerStone()" in helpers
    assert "Number.isFinite(n)" in helpers
    assert "Number.isFinite(delta)" in helpers


def test_every_settlement_structure_has_a_balanced_stone_cost_and_quarry_produces_stone():
    html = HTML.read_text(encoding="utf-8")
    block = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    # The first Quarry waives its own stone input in villageBuildingCost; every
    # configured structure still has a stone cost for upgrades and balancing.
    for building_id in ("farm", "well", "cottages", "tavern", "chapel", "lumber", "quarry", "market"):
        line = next(line for line in block.splitlines() if f"id: '{building_id}'" in line)
        assert "stone:" in line, building_id
    quarry = next(line for line in block.splitlines() if "id: 'quarry'" in line)
    assert "stonePerLevel: 10" in quarry
    assert "stone every 8 hours" in quarry


def test_insufficient_stone_refuses_atomically_and_sufficient_stone_spends_exactly():
    out = run_harness("""
const before = { ...gameState.player };
empireBuildStructure(1111, 'farm');
const refused = { player: { ...gameState.player }, construction: rec.economy.construction || null, toast: toasts.at(-1) };
gameState.player.stone = 20;
empireBuildStructure(1111, 'farm');
console.log(JSON.stringify({ before, refused, accepted: { player: gameState.player, construction: rec.economy.construction } }));
""")
    assert out["refused"]["player"] == out["before"]
    assert out["refused"]["construction"] is None
    assert "stone" in out["refused"]["toast"].lower()
    assert out["accepted"]["player"] == {"coins": 460, "branches": 490, "stone": 15}
    assert out["accepted"]["construction"]["id"] == "farm"


def test_failed_durable_save_rolls_back_every_construction_cost_and_job():
    out = run_harness("""
gameState.player.stone = 20;
const before = { ...gameState.player };
failDurableSave = true;
empireBuildStructure(1111, 'farm');
console.log(JSON.stringify({ before, after: gameState.player, construction: rec.economy.construction || null, toast: toasts.at(-1) }));
""")
    assert out["after"] == out["before"]
    assert out["construction"] is None
    assert "no resources were spent" in out["toast"].lower()


def test_first_quarry_has_a_deliberate_bootstrap_waiver_but_its_upgrade_costs_stone():
    out = run_harness("""
const firstCost = villageBuildingCost(EMPIRE_BUILDING_INDEX.quarry, 0);
empireBuildStructure(1111, 'quarry');
const first = { cost: firstCost, player: { ...gameState.player }, id: rec.economy.construction?.id || null };
delete rec.economy.construction;
rec.economy.buildings.quarry = 1;
gameState.player.stone = 11;
const beforeUpgrade = { ...gameState.player };
empireBuildStructure(1111, 'quarry');
console.log(JSON.stringify({ first, upgradeCost: villageBuildingCost(EMPIRE_BUILDING_INDEX.quarry, 1), beforeUpgrade, afterUpgrade: gameState.player, construction: rec.economy.construction || null }));
""")
    assert out["first"]["cost"] == {"coins": 70, "branches": 20, "stone": 0}
    assert out["first"]["id"] == "quarry"
    assert out["upgradeCost"]["stone"] == 12
    assert out["afterUpgrade"] == out["beforeUpgrade"]
    assert out["construction"] is None


def test_quarry_production_scales_with_level_and_needs_a_villager_to_dig():
    # Superseded by raven-weight-and-wit-v255-20260812: the founding
    # crew is gone. A quarry digs only while a villager works it — an empty
    # town's yards stand idle, and the stone-free Timber Cabin is the way back.
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.quarry = 2;
eco.population = 20;
const working = villageProductionSnapshot(rec);
eco.population = 0;
const empty = villageProductionSnapshot(rec);
console.log(JSON.stringify({ working, empty }));
""")
    assert out["working"]["stone"] == 20
    assert out["empty"]["stone"] == 0


def test_finishing_the_first_quarry_grants_enough_first_cut_stone_for_cottages():
    html = HTML.read_text(encoding="utf-8")
    complete = function_source(html, "empireCompleteConstructions")
    assert "const isFirstRealmQuarry = building.id === 'quarry'" in complete
    assert "if (isFirstRealmQuarry && level === 1)" in complete
    assert "addStone(QUARRY_FIRST_CUT_STONE)" in complete
    assert "QUARRY_FIRST_CUT_STONE = 10" in html
    cottages = next(line for line in html.splitlines() if "id: 'cottages'" in line)
    assert "stone: 8" in cottages


def test_stone_flows_through_tribute_collection_ledger_and_summary():
    html = HTML.read_text(encoding="utf-8")
    ready = function_source(html, "empireTributeReady")
    ledger = function_source(html, "empireLedger")
    has_any = function_source(html, "tributeHasAnything")
    summary = function_source(html, "empireResourceSummary")
    collect = function_source(html, "collectEmpireTribute")
    assert "stone += periods * snap.production.stone" in ready
    assert "return { coins, branches, stone, materials, larder" in ready
    assert "stone: 0" in ledger and "ledger.stone += snap.production.stone" in ledger
    assert "due.stone > 0" in has_any
    assert "bundle.stone > 0" in summary
    assert "addStone(due.stone)" in collect


def test_stone_is_visible_and_actionable_across_hud_stores_yard_and_offline_cache():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert 'id="hudStoneChip"' in html and 'id="hudStone"' in html
    assert "assets/ui/burbz-icon-set/stone.svg" in html
    assert "setHudChipValue('hudStoneChip', 'hudStone', playerStone())" in html
    treasury = function_source(html, "renderStoresTreasury")
    assert "playerStone()" in treasury and "'Stone'" in treasury
    manage = function_source(html, "renderVillageManagePanel")
    assert "const stone = playerStone()" in manage
    assert "stone < cost.stone" in manage
    assert "cost.stone + ' stone ·" in manage
    assert "its first cut gives enough stone for Cottage Row" in html
    assert "every village and town construction — including Quarry upgrades — spends stone, coins and timber" in html
    assert "· ' + stone + '" in manage
    ledger_output = function_source(html, "villageBuildingOutputForLedger")
    realm_output = function_source(html, "empireBuildingOutputForLedger")
    assert "out.stone = Math.round((building.stonePerLevel || 0) * level * steward)" in ledger_output
    assert "townApplySeatPolicyBundle(seat, raw)" in realm_output
    empire = function_source(html, "renderEmpirePanel")
    realm_ledger = function_source(html, "empireLedger")
    # The public Ledger now has one row per Town, so its totals must come from
    # the canonical aggregate rather than summing only visible village rows.
    assert "const ledger = empireLedger()" in empire
    assert "stonePerCycle = ledger.stone" in empire
    assert "settlements.forEach(settlement" in realm_ledger
    assert "ledger.stone += snap.production.stone" in realm_ledger
    assert "standalone.forEach" in realm_ledger
    assert "Stone / 8h" in empire
    # BURBZ_BUILD tracks the NEWEST release marker; later releases move it
    # on, but this release's own segment stays in the cache lineage forever.
    assert "quarry-stone-economy-v221-20260804" in sw
    assert "./assets/ui/burbz-icon-set/stone.svg" in sw
    assert STONE_ICON.exists()
