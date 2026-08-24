"""Citizens work the yards, and homes start in timber.

citizen-workers-timber-homes-v253-20260812: every producing yard — farm,
lumber camp, quarry, market, chapel — needs one villager to run it, and an
unstaffed yard produces nothing at all. The stone-free Timber Cabin is the new
first home (coins and timber only), so homes and residents — not the Quarry —
open a fresh province.

timber-village-builds-20260823: the home climbs in three steps and a village
pays for two of them in timber — Timber Cabin, Timber Longhouse, then the Stone
Cottage, which carries `townFromLevel: 3` and waits for a Town with a quarry.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "citizen-workers-timber-homes-v253-20260812"
CURRENT_BUILD = "village-work-huts-v311-20260824"
PREVIOUS_RELEASE_PIN = "academy-training-dock-v252-20260812"


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
            "villageNeedCapacity",
            "villageWorkforce",
            "villageCrewShare",
            "villageProductionSnapshot",
            "empireHasQuarryInvestment",
            "villageBuildingCost",
            "empireBuildStructure",
        )
    )
    stubs = """
global.window = global;
const toasts = [];
const gameState = { player: { coins: 500, branches: 500, stone: 50 } };
const rec = { seed: 2222, name: 'Timberholt', claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
const empire = { villages: { '2222': rec } };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireCompleteConstructions = () => false;
const settlementBuildFactorForSeed = () => 1;
const villageRoleMultiplier = () => 1;
const villageRuinDefsFor = () => [];
const VILLAGE_RUIN_KINDS = { house: {} };
const VILLAGE_BASE_POPULATION = 0, VILLAGE_MAX_POPULATION = 200;
const VILLAGE_BASE_NEED_CAPACITY = { food: 0, water: 0, shelter: 0, joy: 0 };
const playerBranches = () => gameState.player.branches;
const playerStone = () => gameState.player.stone;
const addCoins = n => { gameState.player.coins += n; };
const addBranches = n => { gameState.player.branches += n; };
const addStone = n => { gameState.player.stone += n; };
const snapshotGameState = () => JSON.parse(JSON.stringify(gameState));
const restoreGameStateSnapshot = () => {};
const durableSaveState = () => ({ ok:true });
const saveState = () => {}; const updateHeader = () => {}; const renderVillage = () => {};
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


def test_the_home_climbs_two_timber_steps_before_it_asks_for_stone():
    out = run_harness("""
const cabin = EMPIRE_BUILDING_INDEX.cabin;
console.log(JSON.stringify({
  first: villageBuildingCost(cabin, 0),
  longhouse: villageBuildingCost(cabin, 1),
  stone: villageBuildingCost(cabin, 2),
  tier1: villageBuildingTier(cabin, 1),
  tier2: villageBuildingTier(cabin, 2),
  tier3: villageBuildingTier(cabin, 3),
  maxLevel: cabin.maxLevel
}));
""")
    # The first home asks for no stone at all, so the Quarry no longer has to
    # be a fresh province's first build.
    assert out["first"] == {"coins": 25, "branches": 14, "stone": 0}
    # ...and neither does the step that doubles it: a village pays in timber.
    assert out["longhouse"] == {"coins": 45, "branches": 20, "stone": 0}
    # Only the stone rebuild spends stone; v310 lets the village mine it.
    assert out["stone"]["stone"] > 0
    assert out["maxLevel"] == 3
    assert out["tier1"]["name"] == "Timber Cabin"
    assert out["tier2"]["name"] == "Timber Longhouse"
    assert out["tier3"]["name"] == "Stone Cottage"


def test_the_cabin_is_ungated_shelter_from_level_one():
    html = HTML.read_text(encoding="utf-8")
    block = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    cabin = next(line for line in block.splitlines() if "id: 'cabin'" in line)
    assert "need: 'shelter'" in cabin
    assert "unlockLevel" not in cabin  # buildable in a brand-new empire
    assert "costLevels" in cabin
    assert "Timber Longhouse" in cabin
    assert "Stone Cottage" in cabin


def test_every_producing_yard_declares_its_crew_and_no_home_does():
    html = HTML.read_text(encoding="utf-8")
    block = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    lines = {bid: next(line for line in block.splitlines() if f"id: '{bid}'" in line)
             for bid in ("cabin", "farm", "well", "cottages", "tavern", "chapel", "lumber", "quarry", "market")}
    for worked in ("farm", "chapel", "lumber", "quarry", "market"):
        assert "workers: 1" in lines[worked], worked
    for passive in ("cabin", "well", "cottages", "tavern"):
        assert "workers" not in lines[passive], passive


def test_unstaffed_yards_produce_nothing_and_scarce_hands_feed_the_farm_first():
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.farm = 1; eco.buildings.lumber = 1; eco.buildings.quarry = 1;
eco.population = 0;
const deserted = { production: villageProductionSnapshot(rec), crew: villageWorkforce(rec) };
eco.population = 2;
const short = { production: villageProductionSnapshot(rec), crew: villageWorkforce(rec) };
eco.population = 3;
const full = { production: villageProductionSnapshot(rec), crew: villageWorkforce(rec) };
console.log(JSON.stringify({ deserted, short, full }));
""")
    # Nobody home: every yard is idle, nothing ships — not even quarry stone.
    assert out["deserted"]["production"] == {"stone": 0, "materials": {}, "larder": {}}
    assert out["deserted"]["crew"] == {"available": 0, "required": 3, "working": 0, "staffed": {}, "assigned": {}}
    # Two villagers: the farm (food first) and lumber camp staff, the quarry waits.
    assert out["short"]["crew"]["staffed"] == {"farm": True, "lumber": True}
    assert out["short"]["production"]["stone"] == 0
    assert out["short"]["production"]["larder"] == {"sunflower_seeds": 2, "acorn_handful": 1}
    assert out["short"]["production"]["materials"] == {"oak_twig": 2, "down_tuft": 1}
    # A third pair of hands and the quarry digs again.
    assert out["full"]["crew"]["working"] == 3
    assert out["full"]["production"]["stone"] == 10


def test_flat_income_and_tax_boosts_also_wait_for_a_crew():
    html = HTML.read_text(encoding="utf-8")
    snap = function_source(html, "villageEconomySnapshot")
    assert "const crew = villageWorkforce(rec);" in snap
    assert "if (b.workers && !crew.staffed[b.id]) return;" in snap
    ledger_output = function_source(html, "villageBuildingOutputForLedger")
    assert "building.workers && !crew.staffed[building.id]" in ledger_output


def test_finished_homes_still_move_families_in_and_tier_names_reach_the_notices():
    html = HTML.read_text(encoding="utf-8")
    done = function_source(html, "empireCompleteConstructions")
    assert "building.need === 'shelter'" in done  # the cabin inherits move-in
    assert "const doneTier = villageBuildingTier(building, level);" in done
    build = function_source(html, "empireBuildStructure")
    assert "villageBuildingTier(building, level + 1)" in build


def test_the_copy_teaches_homes_first_and_villager_crews():
    html = HTML.read_text(encoding="utf-8")
    assert "Timber Cabin</b> (just coins and timber) and residents will move in" in html
    claim = function_source(html, "claimCurrentVillage")
    # A loose liberation still teaches the survival build order. If the claim
    # completes a Town, the same toast must send the player to its Hall instead
    # of advertising the now-retired village screen.
    assert "build homes and residents will move in" in claim
    assert "Add a farm and well before supplies run out" in claim
    # Since v290 a claim never merges anything — it teaches the merge star.
    assert "merge star" in claim
    assert "settlementWardNames" not in claim  # merging is the player's act now
    assert "Villagers work the yards.</b>" in html  # empire help drawer
    assert "yards crewed" in html  # governor's desk headline
    # v310: the work huts hold three hands, so crew lines count and pluralise
    # through villagerCount() instead of hardcoding the singular.
    assert "function villagerCount(n)" in html
    assert "villagerCount(posted) + ' at work" in html
    assert "posted + ' of ' + b.workers + ' posted" in html
    assert "needs ' + villagerCount(b.workers) + ' to run" in html


def test_the_settler_home_rises_in_the_3d_village():
    html = HTML.read_text(encoding="utf-8")
    assert "function villageMakeSettlerHome(" in html
    assert "b.id === 'cabin'" in html
    assert "level >= 3 ? '🏠 Stone Cottage' : (level === 2 ? '🏡 Timber Longhouse' : '🛖 Timber Cabin')" in html
    assert "villageMakeSettlerHome(er, pal, level >= 3)" in html


def test_release_is_versioned_and_cache_lineage_kept():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert CURRENT_BUILD in cache_line  # head build reaches players
