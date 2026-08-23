"""A village builds in timber, all the way up.

Yaan's ask (2026-08-23): "I can't build anything because it needs stone and we
don't have quarries until the town level. Make sure all the buildings in the
villages at first can be built with timber."

`timber-village-builds-v309-20260823`:

- No village-tier build spends stone at ANY level. The one hole in the old law
  was the Timber Cabin's level-2 rebuild, which asked for 10 quarried stone in
  a settlement that has no quarry — a dead end for the shelter chain.
- The home now climbs in three steps: 🛖 Timber Cabin (6), 🏡 Timber Longhouse
  (12) — both coins and timber — then 🏠 Stone Cottage (18), which carries
  `townFromLevel: 3` and waits for a Town.
- `settlementAllowsStep` gates that one STEP, not the whole card, so a
  grandfathered town yard keeps its right to upgrade (that contract lives in
  test_village_basics_town_industry_20260820.py and must stay green).
- The desk's shortfall line names the right source: birds fetch coins and
  timber, a Town quarry cuts stone. It used to say "Quarry Stone arrives every
  8h" under every shortage, which is what made a timber shortfall look like a
  stone wall.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CURRENT_BUILD = "timber-village-builds-v309-20260823"
PREVIOUS_RELEASE_PIN = "two-crews-v308-20260821"

VILLAGE_TIER = {"cabin", "hut", "well", "cottages", "tavern", "storehouse"}


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def buildings_block(html: str) -> str:
    return html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def build_harness(driver: str) -> str:
    """The build flow with a dial (`merged`) that moves the holding into a Town."""
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
            "settlementAllowsStep",
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


# ---------------------------------------------------------------------------
# 1. The bill: what a village is ever asked to pay
# ---------------------------------------------------------------------------

def test_no_village_build_asks_for_stone_at_any_level():
    """Yaan's ask, as one assertion: walk every level of every village card."""
    out = run_node(build_harness("""
const bills = {};
EMPIRE_BUILDINGS.forEach(b => {
  if (b.tier === 'town') return;
  bills[b.id] = [];
  for (let level = 0; level < b.maxLevel; level++) {
    const cost = villageBuildingCost(b, level, rec.seed);
    // A step the village cannot start yet is not a village bill.
    if (!settlementAllowsStep(rec, b, level + 1)) continue;
    bills[b.id].push(cost);
  }
});
console.log(JSON.stringify(bills));
"""))
    assert set(out) == VILLAGE_TIER
    for bid, steps in out.items():
        assert steps, bid
        for i, cost in enumerate(steps):
            assert cost["stone"] == 0, f"{bid} level {i + 1} asks for {cost['stone']} stone"
            assert cost["coins"] > 0 and cost["branches"] > 0, bid


def test_the_home_climbs_two_timber_steps_then_one_stone_one():
    out = run_node(build_harness("""
const cabin = EMPIRE_BUILDING_INDEX.cabin;
console.log(JSON.stringify({
  costs: [0, 1, 2].map(level => villageBuildingCost(cabin, level, rec.seed)),
  names: [1, 2, 3].map(level => villageBuildingTier(cabin, level).name),
  icons: [1, 2, 3].map(level => villageBuildingTier(cabin, level).icon),
  shelter: [1, 2, 3].map(level => cabin.perLevel * level),
  maxLevel: cabin.maxLevel,
  townFromLevel: cabin.townFromLevel
}));
"""))
    assert out["names"] == ["Timber Cabin", "Timber Longhouse", "Stone Cottage"]
    assert out["icons"] == ["🛖", "🏡", "🏠"]
    assert out["shelter"] == [6, 12, 18]
    assert out["maxLevel"] == 3 and out["townFromLevel"] == 3
    assert out["costs"][0] == {"coins": 25, "branches": 14, "stone": 0}
    assert out["costs"][1] == {"coins": 45, "branches": 20, "stone": 0}
    assert out["costs"][2]["stone"] > 0  # the stone rebuild, and only that


# ---------------------------------------------------------------------------
# 2. The step gate: one rung waits for a Town, the card does not
# ---------------------------------------------------------------------------

def test_the_step_gate_only_bites_on_town_from_level():
    html = HTML.read_text(encoding="utf-8")
    step = function_source(html, "settlementAllowsStep")
    assert "Number(building.townFromLevel)" in step
    assert "empireSettlementOfSeed(rec && rec.seed)" in step
    # A card without townFromLevel is waved straight through — that is what
    # keeps a grandfathered town yard upgradeable in a lone village.
    out = run_node(build_harness("""
const waved = EMPIRE_BUILDINGS
  .filter(b => !b.townFromLevel)
  .every(b => [1, 2, 3].every(level => settlementAllowsStep(rec, b, level)));
const cabin = EMPIRE_BUILDING_INDEX.cabin;
const lone = [1, 2, 3].map(level => settlementAllowsStep(rec, cabin, level));
merged = { id: 'town-1', tier: 'town', role: 'heart', heartSeed: 1111 };
const town = [1, 2, 3].map(level => settlementAllowsStep(rec, cabin, level));
console.log(JSON.stringify({ waved, lone, town }));
"""))
    assert out["waved"] is True
    assert out["lone"] == [True, True, False]  # only the stone rung waits
    assert out["town"] == [True, True, True]


def test_a_lone_village_raises_the_longhouse_but_the_stone_rebuild_waits():
    out = run_node(build_harness("""
const steps = [];
const take = label => {
  steps.push({ label, rising: rec.economy?.constructions[0]?.toLevel || null, toast: toasts.at(-1) || null });
  if (rec.economy) rec.economy.constructions.length = 0;
};
empireBuildStructure(1111, 'cabin');                 // the first home
take('cabin');
rec.economy.buildings.cabin = 1;
empireBuildStructure(1111, 'cabin');                 // the longhouse: timber
take('longhouse');
rec.economy.buildings.cabin = 2;
const timberSpent = 5000 - gameState.player.branches, stoneSpent = 5000 - gameState.player.stone;
empireBuildStructure(1111, 'cabin');                 // the stone rebuild: refused
take('stoneInVillage');
merged = { id: 'town-1', tier: 'town', role: 'heart', heartSeed: 1111 };
empireBuildStructure(1111, 'cabin', { townMode: true });
take('stoneInTown');
console.log(JSON.stringify({ steps, timberSpent, stoneSpent }));
"""))
    cabin, longhouse, refused, town = out["steps"]
    assert cabin["rising"] == 1
    assert longhouse["rising"] == 2
    # Two homes raised, and not one flake of stone spent for them.
    assert out["timberSpent"] == 14 + 20
    assert out["stoneSpent"] == 0
    # The stone rung says where it lives instead of quoting a bill nobody can pay.
    assert refused["rising"] is None
    assert "quarries are town works" in refused["toast"]
    assert town["rising"] == 3


def test_wholesale_orders_obey_the_step_gate_too():
    plan = function_source(HTML.read_text(encoding="utf-8"), "wholesaleUpgradePlan")
    assert "settlementAllowsStep(rec, b, level + 1)" in plan


# ---------------------------------------------------------------------------
# 3. The desk: honest buttons, honest shortfalls
# ---------------------------------------------------------------------------

def test_the_desk_shows_the_stone_rung_as_town_work():
    panel = function_source(HTML.read_text(encoding="utf-8"), "renderVillageManagePanel")
    assert "const townStep = !maxed && !settlementAllowsStep(rec, b, level + 1);" in panel
    assert "STONE REBUILD · TOWN WORK" in panel


def test_the_shortfall_line_names_the_source_of_what_is_missing():
    """The bug behind Yaan's screenshot: a timber shortfall read as a stone wall."""
    panel = function_source(HTML.read_text(encoding="utf-8"), "renderVillageManagePanel")
    assert "Quarry Stone arrives every 8h" not in panel
    assert "cost && stone < cost.stone ? '⛏️ stone is cut by a Town quarry'" in panel
    assert "'🕊️ tap to send birds after it'" in panel
    # A town-work rung shows no bill, so it shows no shortfall either.
    assert "shortages.length && !locked && !townStep && slotsFree > 0" in panel


def test_the_3d_village_reads_the_three_steps():
    html = HTML.read_text(encoding="utf-8")
    assert "villageMakeSettlerHome(er, pal, level >= 3)" in html
    assert "if (level === 2) home.scale.set(1, 1.12, 1.55);" in html
    assert "level >= 3 ? '🏠 Stone Cottage' : (level === 2 ? '🏡 Timber Longhouse' : '🛖 Timber Cabin')" in html


def test_the_copy_stops_promising_stone_to_villages():
    html = HTML.read_text(encoding="utf-8")
    assert "Every village build is bought with coins and timber alone — no stone, ever." in html
    assert "Villages never do." in html
    # The quarry's first cut bankrolls town yards now, not a village build.
    assert "enough for the first Grain Farm and Lumber Camp" in html
    assert "enough stone for Cottage Row" not in html


# ---------------------------------------------------------------------------
# 4. Release plumbing
# ---------------------------------------------------------------------------

def test_release_stamp_reaches_runtime_and_service_worker():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept, never rewritten
