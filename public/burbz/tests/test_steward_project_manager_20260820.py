"""Steward project management and the 4-minutes-to-4-hours build ladder.

Yaan's two asks on 2026-08-20, pinned as `steward-project-manager-v294`:

1. **The build ladder.** The two survival starters — the Timber Cabin (the
   first wooden home) and the Stone Well — rise in 4 minutes. Then the clock
   climbs the building list: the Grain Farm takes half an hour, and every
   later building takes longer, up to a full 4 hours for the Storehouse at
   the bottom of the list.
2. **The Steward is the project manager.** Appoint a bird as a village
   Steward and it runs the building sites too: the same wit-and-charm civic
   aptitude (INT + CHA, weighed down by size) cuts up to 30% off every build
   clock and up to 15% off the bill. That is exactly where the small
   charmers earn their keep — a robin or a songbird, no use in a battle
   line, out-manages a raven behind the site ledger. A vacant post changes
   nothing: both factors sit at exactly 1.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "bird_roles_core.js"
RELEASE = "roost-retired-v302-20260820"
CURRENT_BUILD = "empire-grid-v320-20260825"
# bird_roles_core.js last changed in free-birds-v318, which retired the Head
# Gardener. A core ships under the tag of the release that last touched it.
ROLES_CORE_PIN = "empire-grid-v320-20260825"
# magpie-market-v316 edited this core, so it ships under that tag now.


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def run_core(expression: str) -> dict:
    return run_node(f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));")


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def building_line(html: str, building_id: str) -> str:
    block = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    return next(line for line in block.splitlines() if f"id: '{building_id}'" in line)


# ---------------------------------------------------------------------------
# 1. The build ladder: 4 minutes for the starters, 4 hours at the bottom
# ---------------------------------------------------------------------------

LADDER = {
    "cabin": 4,
    "well": 4,
    "hut": 15,
    "farm": 30,
    "cottages": 45,
    "tavern": 60,
    "chapel": 90,
    "lumber": 120,
    "quarry": 150,
    "market": 180,
    "storehouse": 240,
}


def test_every_building_carries_its_ladder_clock():
    html = HTML.read_text(encoding="utf-8")
    for building_id, minutes in LADDER.items():
        assert f"buildMinutes: {minutes}," in building_line(html, building_id), building_id


def test_the_ladder_starts_at_4_minutes_and_climbs_the_list_to_4_hours():
    html = HTML.read_text(encoding="utf-8")
    block = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    listed = [line for line in block.splitlines() if "buildMinutes:" in line]
    minutes = [int(line.split("buildMinutes:")[1].split(",")[0]) for line in listed]
    # The two 4-minute starters, then a strictly climbing clock ending at 4h.
    ramp = [m for m in minutes if m != 4]
    assert minutes.count(4) == 2  # Timber Cabin and Stone Well
    assert ramp[0] == 15  # the Hunter-Gatherer Hut (v298), then farm at 30
    assert ramp[1] == 30
    assert ramp == sorted(ramp) and len(set(ramp)) == len(ramp)
    assert ramp[-1] == 240  # the last and longest: 4 hours
    assert minutes[-1] == 240  # ...and it sits at the bottom of the list


# ---------------------------------------------------------------------------
# 2. Core maths: aptitude → faster and cheaper builds
# ---------------------------------------------------------------------------

def test_vacant_post_changes_nothing_and_mastery_earns_the_full_bonus():
    out = run_core(
        "{ idle: core.stewardProjectFactors(0), best: core.stewardProjectFactors(100),"
        " mid: core.stewardProjectFactors(50), caps: [core.STEWARD_MAX_BUILD_SPEEDUP, core.STEWARD_MAX_COST_DISCOUNT] }"
    )
    assert out["idle"] == {"buildFactor": 1, "costFactor": 1, "speedPct": 0, "discountPct": 0}
    assert out["best"] == {"buildFactor": 0.70, "costFactor": 0.85, "speedPct": 30, "discountPct": 15}
    # 0.925 leaves 7.4999… of discount in float maths, so the label says 7%.
    assert out["mid"] == {"buildFactor": 0.85, "costFactor": 0.925, "speedPct": 15, "discountPct": 7}
    assert out["caps"] == [0.30, 0.15]


def test_factors_clamp_garbage_and_never_reward_beyond_the_caps():
    out = run_core(
        "{ over: core.stewardProjectFactors(400), under: core.stewardProjectFactors(-50),"
        " junk: core.stewardProjectFactors('robin') }"
    )
    assert out["over"] == {"buildFactor": 0.70, "costFactor": 0.85, "speedPct": 30, "discountPct": 15}
    assert out["under"]["buildFactor"] == 1 and out["under"]["costFactor"] == 1
    assert out["junk"]["buildFactor"] == 1 and out["junk"]["costFactor"] == 1


def test_the_small_charmer_out_manages_the_heavyweight():
    # Same INT and CHA; only the scales differ. The robin-weight bird governs
    # (and therefore project-manages) better than the raven-weight one.
    out = run_core(
        "(() => { const role = core.villageRole();"
        " const robin = { int: 150, cha: 150, sizeScore: 12 };"
        " const raven = { int: 150, cha: 150, sizeScore: 78 };"
        " return { robin: core.stewardProjectFactors(core.roleAptitude(robin, role)),"
        "          raven: core.stewardProjectFactors(core.roleAptitude(raven, role)) }; })()"
    )
    assert out["robin"]["buildFactor"] < out["raven"]["buildFactor"]
    assert out["robin"]["costFactor"] < out["raven"]["costFactor"]


def test_the_steward_role_copy_names_the_project_manager_job():
    # v295 renamed the post outright: the village bird IS the Project Manager
    # (grander civic titles — Lord Mayors, Councillors — come later).
    core = CORE.read_text(encoding="utf-8")
    assert "title:'Project Manager'" in core
    assert "Two builds can rise at once here." in core
    assert "Every build is faster and costs a little less" in core


# ---------------------------------------------------------------------------
# 3. index.html wiring: the factors reach the real cost and the real clock
# ---------------------------------------------------------------------------

def test_build_cost_and_clock_read_the_stewards_factors():
    html = HTML.read_text(encoding="utf-8")
    cost = function_source(html, "villageBuildingCost")
    assert "villageStewardProject(seed)" in cost
    assert "Math.round(base.coins * project.costFactor)" in cost
    clock = function_source(html, "villageBuildDurationMs")
    assert "settlementBuildFactorForSeed(seed) * villageStewardProject(seed).buildFactor" in clock
    assert "Math.max(30000," in clock
    build = function_source(html, "empireBuildStructure")
    assert "villageBuildingCost(building, level, rec.seed)" in build
    assert "villageBuildDurationMs(rec.seed, building, level)" in build
    # The wholesale Upgrade order pays and clocks per-ward through the same rules.
    plan = function_source(html, "wholesaleUpgradePlan")
    assert "villageBuildingCost(b, level, rec.seed)" in plan
    assert "villageStewardProject(rec.seed).buildFactor" in plan


def test_helper_resolves_the_post_at_the_settlement_heart():
    html = HTML.read_text(encoding="utf-8")
    helper = function_source(html, "villageStewardProject")
    assert "stewardProjectFactors" in helper
    assert "settlement ? settlement.heartSeed : seed" in helper
    assert "if (!post.staffed || !post.bird) return idle;" in helper


def test_the_real_build_flow_charges_less_and_finishes_sooner_with_a_steward():
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
const rec = { seed: 1111, name: 'Wrenford', claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
const empire = { villages: { '1111': rec } };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireCompleteConstructions = () => false;
const empireSettlementOfSeed = () => null;
const empireSettlementById = () => null;
const canonicalEmpireSettlement = settlement => settlement;
const townDisplayName = settlement => settlement && settlement.name;
const townBuildNetwork = () => { throw new Error('loose village must not delegate to a Town'); };
const settlementBuildFactorForSeed = () => 1;
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
const showToast = message => toasts.push(message);
const showResourceQuestPrompt = (kind, amount, goal) => toasts.push('SHORT ' + kind);
const goalWithThe = name => name;
const SFX = { questComplete: () => {} };
const vibrate = () => {};
const updateHeader = () => {};
const renderVillage = () => {};
const renderTownScreen = () => {};
const birdDisplayName = bird => bird && bird.name;
let villageActive = null, villageBuiltSeed = null, currentScreen = 'empire';
// The dial under test: a posted Steward at aptitude 100 vs a vacant post.
let steward = { staffed:false, bird:null, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 };
const villageStewardProject = () => steward;
"""
    probe = """
const vacantCost = villageBuildingCost(EMPIRE_BUILDING_INDEX.hut, 0, 1111);
empireBuildStructure(1111, 'hut');
const vacant = { cost: vacantCost, spent: 5000 - gameState.player.coins, construction: { ...rec.economy.constructions[0] } };
rec.economy.constructions.length = 0;
gameState.player.coins = 5000; gameState.player.branches = 5000; gameState.player.stone = 5000;
steward = { staffed:true, bird:{ name:'Pip the Robin' }, buildFactor:0.70, costFactor:0.85, speedPct:30, discountPct:15 };
const managedCost = villageBuildingCost(EMPIRE_BUILDING_INDEX.hut, 0, 1111);
empireBuildStructure(1111, 'hut');
const managed = { cost: managedCost, spent: 5000 - gameState.player.coins, construction: { ...rec.economy.constructions[0] }, toast: toasts.at(-1) };
console.log(JSON.stringify({ vacant, managed }));
"""
    out = run_node(buildings + "\n" + functions + "\n" + stubs + probe)
    # Vacant post: the hut (a lone village's food source since v298) costs its
    # full 30/10/0 and takes 15 minutes.
    assert out["vacant"]["cost"] == {"coins": 30, "branches": 10, "stone": 0}
    assert out["vacant"]["spent"] == 30
    vacant_ms = out["vacant"]["construction"]["endMs"] - out["vacant"]["construction"]["startMs"]
    assert vacant_ms == 15 * 60000
    # A grandmaster project manager: 15% off the bill, 30% off the clock.
    assert out["managed"]["cost"] == {"coins": 26, "branches": 9, "stone": 0}
    assert out["managed"]["spent"] == 26
    managed_ms = out["managed"]["construction"]["endMs"] - out["managed"]["construction"]["startMs"]
    assert managed_ms == round(15 * 60000 * 0.70)
    assert "Pip the Robin runs the project" in out["managed"]["toast"]
    assert "30% faster, 15% cheaper" in out["managed"]["toast"]


def test_the_steward_cards_tell_the_player_about_the_building_sites():
    html = HTML.read_text(encoding="utf-8")
    assert "runs the building sites and the ledger" in html
    assert "Vacant — appoint a bird: builds go faster and cheaper, taxes rise" in html
    # project-manager-desk-v315: the card behind that line is a picker now, not
    # a pamphlet — the prose was Yaan's to cut. The drawer line above still says
    # what the post does, and the town desk reads bare like every village desk.
    assert "const bare = scope === 'village';" in html
    assert "Every build rises faster and costs a little less" not in html


# ---------------------------------------------------------------------------
# 4. Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert RELEASE in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    # The edited roles core ships under the new tag everywhere it is loaded.
    assert f"'./bird_roles_core.js?v={ROLES_CORE_PIN}'" in sw
    assert f'src="bird_roles_core.js?v={ROLES_CORE_PIN}"' in html
