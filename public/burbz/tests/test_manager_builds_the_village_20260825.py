"""The Project Manager builds the village.

Yaan's ask (2026-08-25), pinned as `manager-builds-the-village-v324-20260825`:

> When a player assigns a bird as a project manager to a village, that bird
> builds the village autonomously, building all the buildings. Depending on the
> bird's intelligence and charisma, that is how quickly the bird can build the
> village. A non-charismatic bird of prey that is not very intelligent would
> take several real-life days; a fully intelligent songbird with high charisma
> (that has spent a lot of time in the library and a lot of time in the crowbar)
> will build a full village in 6 hours. Make sure all the buildings in the
> village, if they were to be built by a player who was playing it there and
> then with all materials, the player could achieve building it in 4 hours.
> When a bird is not assigned to a village as a project manager, the player must
> build them themselves.

So there are four numbers and one rule:

* **4 hours** — the player, standing in the village, materials in hand, one
  crew, raising every building the village has. That is the sum of the
  village-tier `buildMinutes` ladder, and it is the yardstick for everything
  else.
* **6 hours** — a grandmaster songbird: maxed INT and CHA on a robin-sized
  frame, which is exactly the bird the Library and the Crowbar produce.
* **3 days** — a dull, graceless heavyweight.
* **1 crew** — the manager keeps one of the village's two build slots. The
  other stays the player's, so appointing a manager never takes the hammer out
  of your hand.
* **No manager, no building.** An empty desk means the village waits for you.

These run the REAL build flow out of `index.html` in bare Node, the same
harness style as test_manager_two_crews_20260821.
"""
import json
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
HTML_PATH = BURBZ / "index.html"
HTML = HTML_PATH.read_text(encoding="utf-8")
SW = (BURBZ / "sw.js").read_text(encoding="utf-8")
ROLES_CORE_PATH = BURBZ / "bird_roles_core.js"
ROLES_CORE = ROLES_CORE_PATH.read_text(encoding="utf-8")
MANAGER_CORE_PATH = BURBZ / "village_manager_core.js"
UPDATER = (BURBZ.parents[1] / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")

RELEASE_PIN = "generated-building-interiors-v344-20260902"  # the head build, whatever it is now
# This release's OWN tag. The two cores it edited still ship under it — a later
# release that touches neither must not move their ?v= busters.
OWN_RELEASE_PIN = "manager-builds-the-village-v324-20260825"
HOUR_MS = 3600000

# The village's own works, in the order the manager raises them.
VILLAGE_TIER = ["cabin", "hut", "well", "lumberhut", "minehut", "cottages", "tavern", "storehouse"]


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start, name
    return HTML[start:end]


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=BURBZ, text=True, encoding="utf-8", capture_output=True, timeout=120
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def run_core(expression: str):
    return run_node(
        f"const core=require({json.dumps(str(MANAGER_CORE_PATH))});"
        f" console.log(JSON.stringify({expression}));"
    )


# ---------------------------------------------------------------------------
# The real build flow, lifted into bare Node
# ---------------------------------------------------------------------------

FLOW_FUNCTIONS = (
    "villageBuildTimeMs", "ensureVillageEconomy", "villageBuildingLevel",
    "villageBuildingTier", "empireHasQuarryInvestment", "villageBuildingCost",
    "settlementAllowsBuilding", "villageBuildDurationMs", "villageConstructions",
    "villageConstructionFor", "villageConstructionOf", "villageBuildSlots",
    "villageBuildSlotsFree", "empireBuildStructure", "empireCompleteConstructions",
    "villageManagerCore", "villageTierBuildings", "villagePlayerBudgetMs",
    "villageManagerFactor", "villageManagerVillageMs", "villageManagerBuildDurationMs",
    "villageManagerRows", "villageManagerNextStep", "villageManagerOutlook",
    "empireManagerTakeSite", "villageManagerLineHTML", "formatBuildDuration",
    "villageIdleCrews",
)

STUBS = """
global.window = global;
global.BurbzVillageManager = require(%s);
const ROLES = require(%s);
const toasts = [], notices = [];
const gameState = { player: { level: 12, coins: 100000, branches: 100000, stone: 100000, xp: 0 } };
const empire = { villages: {} };
let mergedInto = null;                       // a merged ward is run from its Town
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireSettlementOfSeed = () => mergedInto;
const empireSettlementById = () => mergedInto;
const canonicalEmpireSettlement = s => s;
const townDisplayName = s => s && s.name;
const townBuildNetwork = () => { throw new Error('standalone build delegated to Town'); };
const settlementBuildFactorForSeed = () => 1;
const villageRuinDefsFor = () => [];
const villageRngFrom = () => () => 0.5;
const VILLAGE_RUIN_KINDS = { house: {} };
const VILLAGE_BASE_POPULATION = 0, VILLAGE_MAX_POPULATION = 200;
const QUARRY_FIRST_CUT_STONE = 10;
const villageNeedCapacity = () => 999;
const maybeAwardMergeStar = () => {};
const applyPlayerXpState = () => false;
const queueCompletionNotice = n => notices.push(n);
const renderCompletionNotices = () => {};
const updateQuestProgress = () => {};
const playerBranches = () => gameState.player.branches;
const playerStone = () => gameState.player.stone;
const addCoins = n => { gameState.player.coins += n; };
const addBranches = n => { gameState.player.branches += n; };
const addStone = n => { gameState.player.stone += n; };
const snapshotGameState = () => JSON.parse(JSON.stringify(gameState));
const restoreGameStateSnapshot = () => {};
const durableSaveState = () => true;
const saveState = () => {}; const updateHeader = () => {};
const renderVillage = () => {}; const renderTownScreen = () => {};
const SFX = { questComplete: () => {}, levelUp: () => {} }; const vibrate = () => {};
const showToast = t => toasts.push(t);
const escapeHtml = s => String(s);
const goalWithThe = n => n;
const showResourceQuestPrompt = kind => toasts.push('SHORT ' + kind);
const birdDisplayName = b => b && b.name;
let villageActive = null, villageBuiltSeed = null, currentScreen = 'empire';
const HOUR = 3600000;
let NOW = 1000000000000;
Date.now = () => NOW;
const at = t => { NOW = t; return t; };
const copy = v => JSON.parse(JSON.stringify(v));
// The dial under test: a posted Project Manager of a given civic aptitude.
let manager = { staffed:false, bird:null, aptitude:0, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 };
const villageStewardProject = () => manager;
function postManager(aptitude, name) {
  manager = { staffed:true, bird:{ id:'b1', name:name || 'Pip the Robin' }, aptitude,
              ...ROLES.stewardProjectFactors(aptitude) };
}
// What index.html's startVillageManagerClock does when the post is filled: the
// contract starts the moment it is signed.
function postManagerAt(aptitude, t, name) {
  postManager(aptitude, name);
  Object.values(empire.villages).forEach(rec => {
    const eco = ensureVillageEconomy(rec);
    eco.managerFrom = t; delete eco.managerFreeAt; delete eco.managerShort;
  });
}
function standDown() {
  manager = { staffed:false, bird:null, aptitude:0, buildFactor:1, costFactor:1, speedPct:0, discountPct:0 };
}
function village(seed, name) {
  empire.villages[String(seed)] = { seed, name: name || 'Wrenford',
    claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: 0 };
  return empire.villages[String(seed)];
}
"""


def run_flow(driver: str) -> dict:
    buildings = HTML[HTML.index("const EMPIRE_BUILDINGS = ["):HTML.index("// ---- Ruins & rubble")]
    header = STUBS % (json.dumps(str(MANAGER_CORE_PATH)), json.dumps(str(ROLES_CORE_PATH)))
    return run_node(header + buildings + "\n" + "\n".join(function_source(n) for n in FLOW_FUNCTIONS) + "\n" + driver)


# ---------------------------------------------------------------------------
# 1. Four hours: the player's own village
# ---------------------------------------------------------------------------

def test_the_whole_village_is_four_hours_of_the_players_own_time():
    out = run_flow("""
      console.log(JSON.stringify({
        budgetMs: villagePlayerBudgetMs(),
        tier: villageTierBuildings().map(b => b.id),
        minutes: villageTierBuildings().map(b => b.buildMinutes)
      }));
    """)
    assert out["tier"] == VILLAGE_TIER
    assert sum(out["minutes"]) == 240
    assert out["budgetMs"] == 4 * HOUR_MS


def test_a_player_with_the_materials_really_raises_the_lot_in_four_hours():
    # No manager anywhere: the player taps BUILD, waits, taps the next one. The
    # clocks added together are the four hours Yaan asked for.
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      let spentMs = 0;
      for (const id of %s) {
        empireBuildStructure(1111, id);
        const site = rec.economy.constructions[0];
        spentMs += site.endMs - site.startMs;
        at(site.endMs);
        empireCompleteConstructions(site.endMs);
      }
      console.log(JSON.stringify({ spentMs, built: copy(rec.economy.buildings), byManager: notices.filter(n => n.icon === '📋').length }));
    """ % json.dumps(VILLAGE_TIER))
    assert out["spentMs"] == 4 * HOUR_MS
    assert all(out["built"][bid] == 1 for bid in VILLAGE_TIER)
    assert out["byManager"] == 0


# ---------------------------------------------------------------------------
# 2. The bird's own clock — six hours to three days
# ---------------------------------------------------------------------------

def test_the_core_names_yaans_three_numbers():
    out = run_core("[core.PLAYER_VILLAGE_HOURS, core.MANAGER_BEST_HOURS, core.MANAGER_WORST_HOURS]")
    assert out == [4, 6, 72]


def test_aptitude_runs_straight_from_three_days_down_to_six_hours():
    out = run_core(
        "[0, 25, 50, 75, 100].map(a => core.managerVillageHours(a))"
    )
    assert out == [72, 55.5, 39, 22.5, 6]
    # Garbage and out-of-range aptitudes clamp to the ends of the same line.
    edges = run_core("[core.managerVillageHours(-40), core.managerVillageHours(400), core.managerVillageHours('robin')]")
    assert edges == [72, 6, 72]


def test_the_factor_is_the_birds_clock_over_the_players_four_hours():
    out = run_core(
        "{ best: core.managerBuildFactor(100, %d), worst: core.managerBuildFactor(0, %d),"
        "  fallback: core.managerBuildFactor(100) }" % (4 * HOUR_MS, 4 * HOUR_MS)
    )
    assert out["best"] == 1.5      # six hours is one and a half of the player's four
    assert out["worst"] == 18      # three days is eighteen
    # With no budget handed in it falls back on the four-hour law itself, so the
    # promise stays true rather than silently going wrong.
    assert out["fallback"] == 1.5


def test_the_library_and_the_crowbar_bird_builds_a_village_in_six_hours():
    # Yaan named the bird: fully intelligent, high charisma, songbird-sized —
    # exactly what INT drilled in the Library and CHA drilled in the Crowbar
    # make of a robin. The dull heavyweight bird of prey is the other end.
    out = run_node(
        "const roles=require(%s), core=require(%s);"
        " const role = roles.villageRole();"
        " const hours = bird => core.managerVillageHours(roles.roleAptitude(bird, role));"
        " console.log(JSON.stringify({"
        "   songbird: hours({ int:250, cha:250, sizeScore:12 }),"
        "   buzzard: hours({ int:60, cha:40, sizeScore:70 }),"
        "   sameStatsSmall: hours({ int:150, cha:150, sizeScore:12 }),"
        "   sameStatsHeavy: hours({ int:150, cha:150, sizeScore:78 })"
        " }));" % (json.dumps(str(ROLES_CORE_PATH)), json.dumps(str(MANAGER_CORE_PATH)))
    )
    assert out["songbird"] == 6
    # "Several real-life days" for the dull bird of prey.
    assert 48 <= out["buzzard"] <= 72
    # Weight and wit still pull opposite ways: same INT and CHA, and the little
    # bird finishes the village sooner.
    assert out["sameStatsSmall"] < out["sameStatsHeavy"]


def test_the_real_village_really_stands_after_six_hours_and_after_three_days():
    out = run_flow("""
      function hoursToBuild(aptitude) {
        Object.keys(empire.villages).forEach(k => delete empire.villages[k]);
        gameState.player.coins = 100000; gameState.player.branches = 100000; gameState.player.stone = 100000;
        const t0 = at(1000000000000);
        const rec = village(1111);
        postManagerAt(aptitude, t0);
        const wanted = %s;
        for (let step = 0; step <= 4 * 24 * 12; step += 1) {
          const t = at(t0 + step * 5 * 60000);
          empireCompleteConstructions(t);
          if (wanted.every(id => (rec.economy.buildings[id] || 0) > 0)) return (t - t0) / 3600000;
        }
        return null;
      }
      console.log(JSON.stringify({ best: hoursToBuild(100), mid: hoursToBuild(50), worst: hoursToBuild(0) }));
    """ % json.dumps(VILLAGE_TIER))
    assert out["best"] == 6
    assert out["mid"] == 39
    assert out["worst"] == 72


# ---------------------------------------------------------------------------
# 3. The programme: every building once, then the upgrades
# ---------------------------------------------------------------------------

def test_the_manager_raises_every_building_once_before_it_upgrades_any():
    rows = [
        {"id": "cabin", "level": 1, "maxLevel": 3, "buildable": True},
        {"id": "hut", "level": 0, "maxLevel": 3, "buildable": True},
        {"id": "well", "level": 0, "maxLevel": 3, "buildable": True},
    ]
    assert run_core("core.nextManagerStep(%s)" % json.dumps(rows)) == {"id": "hut", "level": 0}
    # Once everything stands, round two starts at the top of the list again.
    raised = [dict(row, level=1) for row in rows]
    assert run_core("core.nextManagerStep(%s)" % json.dumps(raised)) == {"id": "cabin", "level": 1}


def test_the_programme_looks_past_a_site_already_rising_and_past_gated_work():
    rows = [
        {"id": "cabin", "level": 0, "maxLevel": 3, "buildable": True, "rising": True},
        {"id": "farm", "level": 0, "maxLevel": 3, "buildable": False},
        {"id": "hut", "level": 0, "maxLevel": 3, "buildable": True},
    ]
    assert run_core("core.nextManagerStep(%s)" % json.dumps(rows)) == {"id": "hut", "level": 0}
    # Nothing left to do is a clean null, not a loop.
    done = [{"id": "cabin", "level": 3, "maxLevel": 3, "buildable": True}]
    assert run_core("core.nextManagerStep(%s)" % json.dumps(done)) is None
    assert run_core("core.nextManagerStep(null)") is None


def test_the_outlook_counts_only_what_actually_stands():
    # A cabin under scaffolding is not a cabin yet, and the time left must
    # include what is left of it — not its whole clock again, and not nothing.
    rows = [
        {"id": "cabin", "minutes": 4, "level": 0, "maxLevel": 3, "buildable": True, "rising": True, "risingMsLeft": 60000},
        {"id": "hut", "minutes": 15, "level": 0, "maxLevel": 3, "buildable": True},
        {"id": "well", "minutes": 4, "level": 1, "maxLevel": 3, "buildable": True},
        {"id": "farm", "minutes": 30, "level": 0, "maxLevel": 3, "buildable": False},
    ]
    out = run_core("core.villageRaiseOutlook(%s, 1.5)" % json.dumps(rows))
    assert out["total"] == 3 and out["raised"] == 1 and out["left"] == 2
    assert out["built"] is False
    assert out["remainingMs"] == 60000 + 15 * 60000 * 1.5


def test_the_manager_builds_the_village_in_the_villages_own_order():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      const order = [];
      for (let step = 0; step <= 8 * 12; step += 1) {
        const t = at(t0 + step * 5 * 60000);
        empireCompleteConstructions(t);
        const site = rec.economy.constructions.find(c => c.by === 'manager');
        if (site && order[order.length - 1] !== site.id) order.push(site.id);
      }
      console.log(JSON.stringify({ order: order.slice(0, 8), built: copy(rec.economy.buildings) }));
    """)
    # A roof first so folk move in, then the larder, then the well, then the yards.
    assert out["order"] == VILLAGE_TIER
    assert all(out["built"][bid] >= 1 for bid in VILLAGE_TIER)
    # And it never touches town-tier industry in a lone village.
    assert all(out["built"][bid] == 0 for bid in ("farm", "chapel", "lumber", "quarry", "market", "foundry", "entertainment"))


def test_a_gated_hall_waits_for_the_trainer_and_the_desk_says_so():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      gameState.player.level = 3;             // storehouse 4, cottages 5, tavern 6 all shut
      postManagerAt(100, t0);
      at(t0 + 72 * HOUR); empireCompleteConstructions(t0 + 72 * HOUR);
      const gated = { built: copy(rec.economy.buildings), line: villageManagerLineHTML(rec) };
      gameState.player.level = 12;
      at(t0 + 200 * HOUR); empireCompleteConstructions(t0 + 200 * HOUR);
      console.log(JSON.stringify({ gated, opened: copy(rec.economy.buildings), line: villageManagerLineHTML(rec) }));
    """)
    assert out["gated"]["built"]["cabin"] == 3 and out["gated"]["built"]["minehut"] == 3
    assert out["gated"]["built"]["cottages"] == 0
    assert out["gated"]["built"]["tavern"] == 0
    assert out["gated"]["built"]["storehouse"] == 0
    assert "raised everything open to you here" in out["gated"]["line"]
    assert "reach trainer level 4" in out["gated"]["line"]
    # Level up and the same bird carries on, without being asked twice.
    assert out["opened"]["cottages"] == 3 and out["opened"]["tavern"] == 3
    assert "stands complete" in out["line"]


# ---------------------------------------------------------------------------
# 4. No manager, no building
# ---------------------------------------------------------------------------

def test_an_empty_desk_builds_nothing_and_spends_nothing():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111, 'Quietford');
      empireCompleteConstructions(t0);
      at(t0 + 96 * HOUR); empireCompleteConstructions(t0 + 96 * HOUR);
      console.log(JSON.stringify({
        rising: rec.economy.constructions.length,
        levels: Object.values(rec.economy.buildings).reduce((s, v) => s + v, 0),
        spent: 100000 - gameState.player.coins,
        line: villageManagerLineHTML(rec)
      }));
    """)
    assert out["rising"] == 0
    assert out["levels"] == 0
    assert out["spent"] == 0
    assert "No Project Manager — you raise every building here yourself" in out["line"]


def test_a_merged_ward_is_run_from_its_town_not_by_a_village_manager():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      mergedInto = { id: 's1', name: 'Wrenmarket', heartSeed: 1111 };
      postManagerAt(100, t0);
      at(t0 + 48 * HOUR); empireCompleteConstructions(t0 + 48 * HOUR);
      console.log(JSON.stringify({ rising: rec.economy.constructions.length, levels: Object.values(rec.economy.buildings).reduce((s, v) => s + v, 0) }));
    """)
    assert out["rising"] == 0 and out["levels"] == 0


# ---------------------------------------------------------------------------
# 5. One crew is the manager's, one stays yours
# ---------------------------------------------------------------------------

def test_the_manager_takes_one_crew_and_leaves_the_other_to_the_player():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      empireCompleteConstructions(t0);
      const managersOwn = rec.economy.constructions.map(c => ({ id: c.id, by: c.by || null }));
      empireBuildStructure(1111, 'tavern');          // the player's own hammer
      const bothCrews = rec.economy.constructions.map(c => ({ id: c.id, by: c.by || null }));
      empireBuildStructure(1111, 'well');            // a third order has nowhere to go
      at(t0 + 1); empireCompleteConstructions(t0 + 1);
      console.log(JSON.stringify({
        managersOwn, bothCrews,
        stillTwo: rec.economy.constructions.length,
        refusals: toasts.filter(t => t.includes('still raising'))
      }));
    """)
    assert out["managersOwn"] == [{"id": "cabin", "by": "manager"}]
    assert out["bothCrews"] == [{"id": "cabin", "by": "manager"}, {"id": "tavern", "by": None}]
    # And with both slots full the manager does not elbow the player out.
    assert out["stillTwo"] == 2
    assert len(out["refusals"]) == 1


def test_the_players_own_taps_keep_their_own_fast_clock():
    # The post's 30% site-planning discount is the player's perk; the bird's own
    # crew works to the bird's own, much longer clock. Never both on one site.
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      empireCompleteConstructions(t0);
      const managerSite = rec.economy.constructions.find(c => c.by === 'manager');
      empireBuildStructure(1111, 'tavern');
      const playerSite = rec.economy.constructions.find(c => !c.by);
      console.log(JSON.stringify({
        managerMs: managerSite.endMs - managerSite.startMs,
        playerMs: playerSite.endMs - playerSite.startMs
      }));
    """)
    # The manager's cabin: 4 minutes of player time × 1.5.
    assert out["managerMs"] == round(4 * 60000 * 1.5)
    # The player's alehouse: 50 minutes, cut 30% by the manager's planning.
    assert out["playerMs"] == round(50 * 60000 * 0.70)


def test_standing_the_manager_down_leaves_the_site_up_and_starts_no_more():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      empireCompleteConstructions(t0);
      standDown();
      at(t0 + 60000); empireCompleteConstructions(t0 + 60000);
      const midway = { rising: rec.economy.constructions.map(c => c.id), from: rec.economy.managerFrom || null };
      at(t0 + 48 * HOUR); empireCompleteConstructions(t0 + 48 * HOUR);
      console.log(JSON.stringify({
        midway,
        finished: copy(rec.economy.buildings),
        rising: rec.economy.constructions.length,
        line: villageManagerLineHTML(rec)
      }));
    """)
    # Nobody loses a build by moving their manager.
    assert out["midway"]["rising"] == ["cabin"]
    assert out["midway"]["from"] is None
    assert out["finished"]["cabin"] == 1
    # …and nothing else rises, for two days.
    assert out["finished"]["hut"] == 0
    assert out["rising"] == 0
    assert "No Project Manager" in out["line"]


# ---------------------------------------------------------------------------
# 6. The bill, and the crew that downs tools
# ---------------------------------------------------------------------------

def test_the_manager_pays_out_of_your_purse_at_its_haggled_price():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      const before = gameState.player.coins;
      empireCompleteConstructions(t0);
      console.log(JSON.stringify({
        spent: before - gameState.player.coins,
        fullPrice: EMPIRE_BUILDING_INDEX.cabin.cost.coins
      }));
    """)
    # The Timber Cabin lists at 25 coins; a grandmaster haggles 15% off it.
    assert out["fullPrice"] == 25
    assert out["spent"] == round(25 * 0.85)


def test_an_empty_purse_stops_the_crew_and_the_desk_says_what_it_wants():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      gameState.player.coins = 20; gameState.player.branches = 5; gameState.player.stone = 0;
      empireCompleteConstructions(t0);
      const stalled = { rising: rec.economy.constructions.length, short: copy(rec.economy.managerShort), line: villageManagerLineHTML(rec) };
      gameState.player.coins = 5000; gameState.player.branches = 5000;
      at(t0 + 60000); empireCompleteConstructions(t0 + 60000);
      console.log(JSON.stringify({
        stalled,
        resumed: rec.economy.constructions.map(c => c.id),
        shortNow: rec.economy.managerShort || null
      }));
    """)
    assert out["stalled"]["rising"] == 0
    assert out["stalled"]["short"] == {"id": "cabin", "coins": 1, "branches": 7, "stone": 0}
    assert "downed tools on the Timber Cabin" in out["stalled"]["line"]
    assert "short 1 🪙 + 7 🪵" in out["stalled"]["line"]
    # Pay up and it picks the hammer straight back up.
    assert out["resumed"] == ["cabin"]
    assert out["shortNow"] is None


# ---------------------------------------------------------------------------
# 7. Coming home to a village that built itself
# ---------------------------------------------------------------------------

def test_a_night_away_lands_exactly_where_the_clock_says_and_tells_you_once():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      // The player closes the game and opens it eight hours later. Nothing ran
      // in between: one pass has to catch the whole night up.
      at(t0 + 8 * HOUR); empireCompleteConstructions(t0 + 8 * HOUR);
      console.log(JSON.stringify({
        built: copy(rec.economy.buildings),
        toasts,
        notices,
        line: villageManagerLineHTML(rec)
      }));
    """)
    assert all(out["built"][bid] >= 1 for bid in VILLAGE_TIER)
    # One line, not twenty. A player who has been away does not want a stack.
    manager_toasts = [t for t in out["toasts"] if t.startswith("📋")]
    assert len(manager_toasts) == 1
    # Eight buildings raised, and by the eighth hour it is already upgrading.
    assert "Pip the Robin raised 11 buildings in Wrenford." in manager_toasts[0]
    assert "new residents move in!" in manager_toasts[0]
    assert len(out["notices"]) == 1
    assert out["notices"][0] == {
        "kind": "empire-building",
        "icon": "📋",
        "title": "11 buildings raised",
        "sub": "Wrenford — tap to manage",
        "target": {"seed": 1111},
    }
    # By then it is on to the upgrades.
    assert "working through the upgrades" in out["line"]


def test_a_single_finished_build_still_names_the_building():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      empireCompleteConstructions(t0);
      at(t0 + 7 * 60000); empireCompleteConstructions(t0 + 7 * 60000);
      console.log(JSON.stringify({ toasts: toasts.filter(t => t.startsWith('📋')), notices }));
    """)
    assert out["toasts"] == ["📋 Pip the Robin raised 🛖 Timber Cabin in Wrenford. 👥 3 new residents move in!"]
    assert out["notices"][0]["title"] == "Timber Cabin finished"


# ---------------------------------------------------------------------------
# 8. What the player sees before they choose
# ---------------------------------------------------------------------------

def test_the_desk_line_counts_the_village_up_and_names_the_time_left():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      empireCompleteConstructions(t0);
      const fresh = villageManagerLineHTML(rec);
      at(t0 + 3 * HOUR); empireCompleteConstructions(t0 + 3 * HOUR);
      console.log(JSON.stringify({ fresh, halfway: villageManagerLineHTML(rec) }));
    """)
    assert "Pip the Robin is building Wrenford — 0 of 8 up, about 6h to go" in out["fresh"]
    assert "of 8 up," in out["halfway"]


def test_every_candidate_in_the_sheet_says_how_long_it_would_take():
    html = HTML
    card = function_source("rolePostCardHTML")
    assert "roleCandidateClockHTML(scope, c.aptitude)" in card
    clock = function_source("roleCandidateClockHTML")
    assert "scope === 'village' ? villageManagerSpan(aptitude) : ''" in clock
    assert "builds the village in" in clock
    # The holder's own card carries the same number.
    assert "roleCandidateClockHTML(scope, post.aptitude)" in html
    # …and it is guarded, because the sheet is shared code that several suites
    # lift into a bare context with no empire around it.
    span = function_source("villageManagerSpan")
    assert "typeof villageManagerVillageMs !== 'function'" in span
    # Hours up to a couple of days, then days.
    out = run_node(
        "%s\n%s\nconsole.log(JSON.stringify([6, 24, 47, 48, 61.44, 72].map(h => formatManagerSpan(h * 3600000))));"
        % (function_source("formatManagerSpan"), "")
    )
    assert out == ["6h", "24h", "47h", "2 days", "2.6 days", "3 days"]


def test_appointing_a_bird_to_a_village_promises_the_village():
    assign = function_source("assignBirdRole")
    assert "villageManagerSpan(fx.aptitude)" in assign
    assert "it builds the whole village on its own, in about" in assign
    # And the contract starts the moment it is signed, not the next time the
    # player happens to open the village.
    assert "if (scope === 'village' && typeof startVillageManagerClock === 'function') startVillageManagerClock(key);" in assign
    starter = function_source("startVillageManagerClock")
    assert "eco.managerFrom = Date.now();" in starter
    assert "delete eco.managerFreeAt;" in starter


def test_a_managed_village_reads_as_building_not_as_idle_on_the_empire_grid():
    # The manager's crew is never idle, so the square must not shout "a crew is
    # free" at a village that is quietly building itself. A yard that has run
    # out of materials really has stopped, and that one does.
    tile = function_source("empireVillageTile")
    assert "freeCrews: villageIdleCrews(v)," in tile
    idle = function_source("villageIdleCrews")
    assert "if (!project.staffed) return free;" in idle
    assert "return eco && eco.managerShort ? free : 0;" in idle
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      const empty = villageIdleCrews(rec);
      postManagerAt(100, t0);
      empireCompleteConstructions(t0);
      const working = villageIdleCrews(rec);
      gameState.player.coins = 0; gameState.player.branches = 0;
      // finish the site it is on, and it cannot afford the next one
      const site = rec.economy.constructions.find(c => c.by === 'manager');
      at(site.endMs); empireCompleteConstructions(site.endMs);
      console.log(JSON.stringify({ empty, working, stalled: villageIdleCrews(rec), short: !!rec.economy.managerShort }));
    """)
    assert out["empty"] == 1        # no manager: the player's one crew, idle
    assert out["working"] == 0      # a manager at work: nothing idle here
    assert out["short"] is True
    assert out["stalled"] == 2      # tools down: send the player over


def test_the_yard_says_whose_crew_is_on_which_site():
    panel = HTML[HTML.index("function renderVillageManagePanel("):]
    panel = panel[:panel.index("\nfunction ", 40)]
    assert "const managerBird = villageStewardProject(rec.seed).bird;" in panel
    assert "con.by === 'manager' && managerBird" in panel
    assert "province-construction-crew" in panel
    assert "villageManagerLineHTML(rec)" in panel
    assert ".province-construction-crew {" in HTML
    assert ".role-candidate-clock {" in HTML


def test_the_roles_core_tells_the_player_what_the_post_now_does():
    assert "This bird builds the whole village on its own" in ROLES_CORE
    assert "you never have to tap BUILD again" in ROLES_CORE
    assert "A grandmaster songbird raises a village in six hours; a dull heavyweight takes days." in ROLES_CORE
    # The words stay in the core, not in the page.
    assert "This bird builds the whole village on its own" not in HTML


# ---------------------------------------------------------------------------
# 9. Wiring and shipping
# ---------------------------------------------------------------------------

def test_the_managers_clock_reads_the_posts_raw_aptitude():
    helper = function_source("villageStewardProject")
    assert "aptitude:post.aptitude" in helper
    factor = function_source("villageManagerFactor")
    assert "core.managerBuildFactor(project.aptitude, villagePlayerBudgetMs())" in factor
    assert "if (!core || !project.staffed) return 0;" in factor
    clock = function_source("villageManagerBuildDurationMs")
    assert "settlementBuildFactorForSeed(seed) * villageManagerFactor(seed)" in clock
    # The player's own clock is the other one, and it is untouched.
    player_clock = function_source("villageBuildDurationMs")
    assert "settlementBuildFactorForSeed(seed) * villageStewardProject(seed).buildFactor" in player_clock
    assert "villageManagerFactor" not in player_clock


def test_the_catch_up_is_bounded_and_the_crew_is_freed_at_its_own_end_time():
    complete = function_source("empireCompleteConstructions")
    assert "for (let pass = 0; pass < MANAGER_CATCHUP_PASSES; pass += 1) {" in complete
    assert "empireManagerTakeSite(rec, t, { snapshot: takeSnapshot })" in complete
    assert "eco.managerFreeAt = Math.max(Number(eco.managerFreeAt) || 0, Number(con.endMs) || t)" in complete
    assert "const MANAGER_CATCHUP_PASSES = 200;" in HTML
    site = function_source("empireManagerTakeSite")
    assert "const startMs = Math.min(t, freeAt || t);" in site
    # One crew is the manager's; the other is the player's.
    assert "villageConstructions(rec).some(con => con && con.by === 'manager')" in site
    assert "if (villageBuildSlotsFree(rec) <= 0) return false;" in site
    # Everything is spent inside the same commit the completion rolls back.
    assert site.index("ctx.snapshot()") < site.index("addCoins(-cost.coins)")


def test_the_construction_marker_survives_a_save_round_trip():
    out = run_flow("""
      const t0 = at(1000000000000);
      const rec = village(1111);
      postManagerAt(100, t0);
      empireCompleteConstructions(t0);
      // A save and a reload: the sanitiser must not lose whose crew this is.
      const reloaded = JSON.parse(JSON.stringify(rec));
      empire.villages['1111'] = reloaded;
      ensureVillageEconomy(reloaded);
      console.log(JSON.stringify({ by: reloaded.economy.constructions.map(c => c.by || null) }));
    """)
    assert out["by"] == ["manager"]


def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE = "))
    # This release is no longer the head; it is a segment of an append-only
    # lineage, and its own marker must survive every release that follows.
    assert OWN_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert "forge-opens-on-the-anvil-v323-20260825" in cache_line, "the lineage is append-only"
    assert cache_line.rstrip("';").endswith(RELEASE_PIN), "the newest marker goes last"
    # The new core ships from the page and from every service-worker list, still
    # under THIS release's tag — nothing since has edited it.
    assert f'src="village_manager_core.js?v={OWN_RELEASE_PIN}"' in HTML
    assert SW.count(f"'./village_manager_core.js?v={OWN_RELEASE_PIN}'") == 3
    # bird_roles_core.js was edited this release, so it re-pins here.
    assert f'src="bird_roles_core.js?v={OWN_RELEASE_PIN}"' in HTML
    assert f"'./bird_roles_core.js?v={OWN_RELEASE_PIN}'" in SW
    # And the VPS updater ships the file at all.
    assert '"village_manager_core.js"' in UPDATER
    assert MANAGER_CORE_PATH.exists()
