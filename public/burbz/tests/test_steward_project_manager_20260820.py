"""Steward project management and the village build ladder.

Yaan's two asks on 2026-08-20, pinned as `steward-project-manager-v294`:

1. **The build ladder.** The two survival starters — the Timber Cabin and the
   Timber Well — rise in 4 minutes. Then the clock climbs the building list.
2. **The Steward is the project manager.** Appoint a bird as a village
   Steward and it runs the building sites too: the same wit-and-charm civic
   aptitude (INT + CHA, weighed down by size) cuts up to 30% off every build
   clock and up to 15% off the bill. That is exactly where the small
   charmers earn their keep — a robin or a songbird, no use in a battle
   line, out-manages a raven behind the site ledger. A vacant post changes
   nothing: both factors sit at exactly 1.

**Re-tuned by `manager-builds-the-village-v324-20260825`.** Yaan moved the four
hours: it is no longer the Storehouse alone, it is the WHOLE village. Every
village-tier clock added together comes to exactly 240 minutes, so a player
standing in the village with the materials raises the lot in four hours. The
ladder still starts at 4 minutes and still climbs; only the numbers moved. The
whole-village law, and the bird that builds it for you, are pinned by
`test_manager_builds_the_village_20260825.py`. Point 2 above is unchanged: those
two factors are the PLAYER's perk on the player's own taps.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "bird_roles_core.js"
RELEASE = "roost-retired-v302-20260820"
CURRENT_BUILD = "rook-recognition-special-characters-v347-20260904"
# bird_roles_core.js last changed in free-birds-v318, which retired the Head
# Gardener. A core ships under the tag of the release that last touched it.
ROLES_CORE_PIN = "rook-recognition-special-characters-v347-20260904"
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
# 1. The build ladder: 4 minutes for the starters, four hours for the village
# ---------------------------------------------------------------------------

# The clock every building carries, in minutes, for its first level.
LADDER = {
    # The village's own works. These eight add up to exactly 240 minutes.
    "cabin": 4,
    "well": 4,
    "hut": 15,
    "lumberhut": 25,
    "minehut": 32,
    "cottages": 40,
    "tavern": 50,
    "storehouse": 70,
    # The town works, which are bigger jobs and sit outside the village's four
    # hours.
    "farm": 30,
    "chapel": 90,
    "lumber": 120,
    "quarry": 150,
    "market": 180,
    "foundry": 200,
    "entertainment": 210,
}


def building_rows(html: str):
    block = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    rows = []
    for line in block.splitlines():
        if "buildMinutes:" not in line:
            continue
        bid = line.split("{ id: '", 1)[1].split("'", 1)[0]
        rows.append((bid, int(line.split("buildMinutes:")[1].split(",")[0]), "tier: 'town'" in line))
    return rows


def test_every_building_carries_its_ladder_clock():
    html = HTML.read_text(encoding="utf-8")
    for building_id, minutes in LADDER.items():
        assert f"buildMinutes: {minutes}," in building_line(html, building_id), building_id
    # And nothing else has crept in unpinned.
    assert {bid for bid, _, _ in building_rows(html)} == set(LADDER)


def test_the_village_ladder_starts_at_4_minutes_and_adds_up_to_four_hours():
    rows = building_rows(HTML.read_text(encoding="utf-8"))
    village = [(bid, mins) for bid, mins, town in rows if not town]
    # Yaan's law: the whole village, raised by a player with the materials in
    # hand, one crew, back to back — four hours.
    assert sum(mins for _, mins in village) == 240
    # The two survival starters are still the quick ones.
    assert [bid for bid, mins in village if mins == 4] == ["cabin", "well"]
    # Everything after them climbs the list, no two the same, ending on the
    # Storehouse.
    ramp = [mins for bid, mins in village if mins != 4]
    assert ramp == sorted(ramp) and len(set(ramp)) == len(ramp)
    assert ramp[0] == 15  # the Hunter-Gatherer Hut (v298)
    assert village[-1] == ("storehouse", 70)


def test_the_town_works_climb_their_own_ladder_above_the_village():
    rows = building_rows(HTML.read_text(encoding="utf-8"))
    town = [mins for _, mins, is_town in rows if is_town]
    assert town == sorted(town) and len(set(town)) == len(town)
    assert town[0] == 30 and town[-1] == 210


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
    assert "Two builds can rise at once here: the manager’s site and yours." in core
    assert "Your own builds are faster and cost a little less" in core


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


def test_the_steward_row_tells_the_player_who_runs_the_building_sites():
    html = HTML.read_text(encoding="utf-8")
    # v319 replaced the drawer with one row, and moved the words into the
    # sheet it opens. The row names the holder and the bonus; the sheet says
    # what the job is for. Nothing about the post became unknowable.
    row = HTML.read_text(encoding="utf-8")
    assert "Vacant — tap to appoint a bird" in row
    assert "role.effect.label + ' +' + post.bonusPct + '%'" in row
    assert "'<div class=\"role-picker-copy\">' + escapeHtml(role.effect.copy) + '</div>'" in html
    # The Project Manager's own words are still the roles core's to own.
    assert "runs the building sites and the ledger" not in html
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
