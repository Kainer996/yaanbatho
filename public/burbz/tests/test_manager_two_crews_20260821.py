"""A Project Manager foremans a second crew.

Yaan's ask: appoint a Project Manager to a village and it can build two things
at once. A village yard used to hold exactly one project — `eco.construction`,
a single object — so the second tap was always refused. The yard now holds a
list, and the post is what opens the second slot.

The slots gate STARTING a build only. A project already under way always
finishes, even if the post falls vacant beneath it, so nobody loses a build by
moving their manager.

These tests run the REAL low-level build flow, the same harness style as
test_concurrent_town_builds_20260802.
"""
import json
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
HTML_PATH = BURBZ / "index.html"
HTML = HTML_PATH.read_text(encoding="utf-8")
SW = (BURBZ / "sw.js").read_text(encoding="utf-8")
ROLES_CORE = (BURBZ / "bird_roles_core.js").read_text(encoding="utf-8")

RELEASE_PIN = "villages-first-county-merge-v318-20260824"


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start, name
    return HTML[start:end]


def run_flow(staffed: bool, driver: str):
    buildings = HTML[HTML.index("const EMPIRE_BUILDINGS = ["):HTML.index("// ---- Ruins & rubble")]
    functions = "\n".join(function_source(name) for name in (
        "villageBuildTimeMs", "villageConstructionFor", "ensureVillageEconomy",
        "villageBuildingLevel", "villageBuildingTier", "empireHasQuarryInvestment",
        "villageBuildingCost", "settlementAllowsBuilding", "villageBuildDurationMs",
        "villageConstructions", "villageConstructionOf", "villageBuildSlots",
        "villageBuildSlotsFree", "empireBuildStructure",
    ))
    stubs = """
global.window = global;
const toasts = [];
const gameState = { player: { level: 6, coins: 9000, branches: 9000, stone: 9000 } };
const empire = { villages: {} };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireCompleteConstructions = () => false;
const empireSettlementOfSeed = () => null;
const empireSettlementById = () => null;
const canonicalEmpireSettlement = settlement => settlement;
const townDisplayName = settlement => settlement && settlement.name;
const townBuildNetwork = () => { throw new Error('standalone build delegated to Town'); };
const settlementBuildFactorForSeed = () => 1;
const villageStewardProject = () => (%s
  ? { staffed:true, bird:{ id:'b1', commonName:'Robin' }, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 }
  : { staffed:false, bird:null, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 });
const birdDisplayName = bird => bird && bird.commonName;
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
empire.villages['1111'] = { seed: 1111, name: 'Testham', lat: 53.2, lon: -2.5, claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
""" % ("true" if staffed else "false")
    source = stubs + buildings + "\n" + functions + "\n" + driver
    result = subprocess.run(["node", "-e", source], cwd=BURBZ, text=True,
                            encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


THREE_BUILDS = """
empireBuildStructure(1111, 'hut');
empireBuildStructure(1111, 'well');
empireBuildStructure(1111, 'cabin');
console.log(JSON.stringify({
  rising: empire.villages['1111'].economy.constructions.map(c => c.id),
  toasts
}));
"""


def test_a_vacant_post_still_holds_the_yard_to_one_crew():
    out = run_flow(False, THREE_BUILDS)
    assert out["rising"] == ["hut"]
    refusals = [t for t in out["toasts"] if "still raising" in t]
    assert len(refusals) == 2
    # The refusal teaches the way out.
    assert "Appoint a Project Manager" in refusals[0]


def test_a_project_manager_runs_two_builds_at_once():
    out = run_flow(True, THREE_BUILDS)
    assert out["rising"] == ["hut", "well"]
    # Two crews, so only the third order waits — and it does not re-offer the
    # post to a village that already has one.
    refusals = [t for t in out["toasts"] if "still raising" in t]
    assert len(refusals) == 1
    assert "Hut" in refusals[0] and "Well" in refusals[0]
    assert "Appoint a Project Manager" not in refusals[0]


def test_the_same_building_is_never_started_twice():
    out = run_flow(True, """
empireBuildStructure(1111, 'hut');
empireBuildStructure(1111, 'hut');
console.log(JSON.stringify({
  rising: empire.villages['1111'].economy.constructions.map(c => c.id),
  toasts
}));
""")
    assert out["rising"] == ["hut"]
    assert any("already rising" in t for t in out["toasts"])


def test_the_slots_gate_starting_a_build_not_finishing_one():
    # Two projects survive the post falling vacant: the sanitiser's hard cap is
    # the most crews a village can EVER field, not its current slot count.
    sanitiser = HTML[HTML.index("if (eco.construction && !Array.isArray(eco.constructions))"):]
    sanitiser = sanitiser[:sanitiser.index("if (!Number.isFinite(Number(eco.population))")]
    assert ".slice(0, 2)" in sanitiser
    assert "villageBuildSlots" not in sanitiser
    # Only the start path consults the slots.
    build = function_source("empireBuildStructure")
    assert "if (villageBuildSlotsFree(rec) <= 0) {" in build
    complete = function_source("empireCompleteConstructions")
    assert "villageBuildSlots" not in complete


def test_old_saves_migrate_their_single_project_into_the_list():
    sanitiser = HTML[HTML.index("// Old saves carry a single `construction`"):]
    sanitiser = sanitiser[:sanitiser.index("if (!Number.isFinite(Number(eco.population))")]
    assert "if (eco.construction && !Array.isArray(eco.constructions)) eco.constructions = [eco.construction];" in sanitiser
    assert "delete eco.construction;" in sanitiser
    # Nothing else in the page reads the retired single field.
    assert HTML.count("eco.construction\n") == 0
    assert "eco.construction.id" not in HTML


# ---------------------------------------------------------------------------
# What the player sees
# ---------------------------------------------------------------------------

def test_the_yard_shows_its_crews_and_names_the_way_to_a_second():
    panel = HTML[HTML.index("function renderVillageManagePanel("):]
    panel = panel[:panel.index("\nfunction ", 40)]
    assert "const buildSlots = villageBuildSlots(rec);" in panel
    assert "const slotsFree = villageBuildSlotsFree(rec);" in panel
    # v317 removed the yard heading that printed the crew tally and named the
    # Project Manager. Both slot helpers above, and the gating below, still
    # prove a second crew is real.
    # A free slot keeps the other build buttons live.
    assert "const busyElsewhere = !inProgress && slotsFree <= 0;" in panel
    # One progress card per crew at work.
    assert "const constructionHtml = constructions.map(con => {" in panel


def test_both_scenes_raise_one_scaffold_per_crew():
    village = HTML[HTML.index("const pendingCon = villageConstructionOf(econRec, b.id);"):]
    assert "const rising = !!pendingCon;" in village[:200]
    town = HTML[HTML.index("// A build rising in the ward rises in the town too"):]
    assert "(dState.constructions || []).forEach(con => {" in town[:400]


def test_the_post_card_promises_the_second_crew():
    assert "Two builds can rise at once here." in ROLES_CORE
    assert "a second crew can work in parallel, so two builds rise at once" in ROLES_CORE


def test_release_stamp_reaches_runtime_and_service_worker():
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML
    assert RELEASE_PIN in SW
