"""Different holdings build at the same time; Towns enforce builder slots.

Ward-compatible construction timers live on each village economy record
(`eco.constructions`), so starting a project in one standalone holding must
never block another. Unified Towns add a public builder-slot admission rule
above those timers. These tests run the REAL low-level build flow and pin both
parts of that contract.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def build_harness() -> str:
    html = HTML.read_text(encoding="utf-8")
    buildings = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "villageBuildTimeMs",
            "villageConstructionFor",
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
// Level 6 trainer: past the Cottage Row gate (unlockLevel 5), so this test
// stays about the per-village construction lock, not the mid-game level gate.
const gameState = { player: { level: 6, coins: 5000, branches: 5000, stone: 5000 } };
const empire = { villages: {} };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireCompleteConstructions = () => false;
// The two fixtures are deliberately far-apart standalone villages. Stub the
// canonical Town adapter and fail loudly if either is accidentally delegated.
const empireSettlementOfSeed = () => null;
const empireSettlementById = () => null;
const canonicalEmpireSettlement = settlement => settlement;
const townDisplayName = settlement => settlement && settlement.name;
const townBuildNetwork = () => { throw new Error('standalone build delegated to Town'); };
const settlementBuildFactorForSeed = () => 1;  // lone-village baseline: no merged-guild speed-up
const villageStewardProject = () => ({ staffed:false, bird:null, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 }); // vacant post: v294 project management is upside only
const villageRuinDefsFor = () => [];
const villageRngFrom = () => () => 0.5;
const VILLAGE_RUIN_KINDS = { house: {} };
const VILLAGE_BASE_POPULATION = 0, VILLAGE_MAX_POPULATION = 60;
const EMPIRE_NEEDS = [];
const playerBranches = () => gameState.player.branches;
const playerStone = () => gameState.player.stone;
const addCoins = n => { gameState.player.coins += n; };
const addBranches = n => { gameState.player.branches += n; };
const addStone = n => { gameState.player.stone += n; };
const snapshotGameState = () => JSON.parse(JSON.stringify(gameState));
const restoreGameStateSnapshot = () => {};
const durableSaveState = () => ({ ok:true });
const saveState = () => {}; const updateHeader = () => {}; const renderVillage = () => {}; const renderTownScreen = () => {};
const SFX = { questComplete: () => {} }; const vibrate = () => {};
const showToast = t => toasts.push(t);
const formatBuildDuration = () => 'soon';
let villageActive = null, villageBuiltSeed = null;
"""
    driver = """
empire.villages['1111'] = { seed: 1111, name: 'Testham A', lat: 53.2, lon: -2.5, claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
empire.villages['2222'] = { seed: 2222, name: 'Testham B', lat: 53.3, lon: -2.6, claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
empireBuildStructure(1111, 'hut');        // holding A starts a project (v298: village-tier work)
empireBuildStructure(2222, 'cottages');   // town B must start CONCURRENTLY
empireBuildStructure(1111, 'well');       // same town again must be refused
console.log(JSON.stringify({
  townA: empire.villages['1111'].economy.constructions[0]?.id || null,
  townB: empire.villages['2222'].economy.constructions[0]?.id || null,
  toasts
}));
"""
    return stubs + buildings + "\n" + functions + "\n" + driver


def run_harness():
    result = subprocess.run(
        ["node", "-e", build_harness()],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_two_standalone_holdings_build_concurrently_but_one_ward_holds_one_project():
    out = run_harness()
    # Both standalone holdings hold live constructions at the same time...
    assert out["townA"] == "hut"
    assert out["townB"] == "cottages"
    # ...and the refusal was for the SAME ward's second project only.
    refusals = [t for t in out["toasts"] if "still raising" in t]
    assert len(refusals) == 1
    assert "Testham A" in refusals[0]


def test_construction_lock_is_stored_per_village_record():
    html = HTML.read_text(encoding="utf-8")
    build = function_source(html, "empireBuildStructure")
    # The busy check reads the TARGET village's own economy — no global flag.
    assert "const eco = ensureVillageEconomy(rec);" in build
    assert "if (villageBuildSlotsFree(rec) <= 0) {" in build
    assert "eco.constructions.push(started)" in build


def test_player_facing_copy_explains_loose_village_independence_and_town_slots():
    html = HTML.read_text(encoding="utf-8")
    # A still-loose village explains that its private timer does not block a
    # different loose holding.
    assert "builders busy here — other villages can still build" in html
    # Once villages unite, the Town screen owns admission through explicit Hall
    # builder slots and tells the player how to unlock simultaneous projects.
    town_build = function_source(html, "townBuildNetwork")
    town_screen = function_source(html, "renderTownScreen")
    assert "townActiveProjectCount(settlement) >= townBuilderSlots(settlement)" in town_build
    assert "All Town builder crews are busy. Raise the Hall for more simultaneous projects." in town_build
    assert "BUILDERS ' + activeProjects + '/' + slots" in town_screen
    assert "Hall investment unlocks policy and builder crews." in town_screen
