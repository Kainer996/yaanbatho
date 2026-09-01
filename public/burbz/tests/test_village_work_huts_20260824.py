"""Villages work their own timber and stone, and collect whenever they like.

Yaan's asks (2026-08-24), pinned as `village-work-huts-v311-20260824`:

1. A 🪚 Lumberjack Hut and a 🪨 Miners' Hut in every village, each holding up to
   THREE villagers. Output scales with the hands actually posted: two of three
   miners dig two thirds of the stone. Towns keep the Quarry and Lumber Camp as
   the efficient industry — one villager in a Quarry out-digs three in a hut.
2. Taxes and produce can be collected AT ANY TIME. Accrual is continuous and
   prorated; leave it longer and you get more, still capped at 24 hours.
3. The 'well' is a 🪣 Timber Well, not a Stone Well — it costs no stone.
4. A village cannot pass 75% happiness before the Alehouse is built. It used to
   sit at exactly 0.75 for ever: (1+1+1+0)/4, with joy a flat zero.
5. The village merge star wants 16 folk, not 40.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
MERGE_CORE = ROOT / "settlement_merge_core.js"
CURRENT_BUILD = "polished-ui-notifications-v339-20260901"
# The release immediately before this one. Ava's walking-villagers work took
# v310 on main while this branch was open, so this became v311.
PREVIOUS_RELEASE_PIN = "walking-villagers-cottage-variety-v310-20260823"


def function_source(html: str, name: str) -> str:
    start = html.index("function %s" % name)
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def buildings_block(html: str) -> str:
    return html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]


def building_line(html: str, bid: str) -> str:
    return next(l for l in buildings_block(html).splitlines() if l.startswith("  { id: '%s'," % bid))


def run_node(source: str) -> dict:
    r = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8",
                       capture_output=True, check=False, timeout=60)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


def economy_harness(driver: str) -> str:
    """The real workforce + production maths, in a bare Node context."""
    html = HTML.read_text(encoding="utf-8")
    buildings = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(function_source(html, n) for n in (
        "ensureVillageEconomy", "villageBuildingLevel", "villageNeedCapacity",
        "villageStoreCapacity", "villageProvisionRates", "villageWorkforce",
        "villageCrewShare", "villageProductionSnapshot", "villageBuildingOutputForLedger",
    ))
    stubs = """
global.window = global;
const gameState = { player: { level: 99, coins: 5000, branches: 5000, stone: 5000 } };
const rec = { seed: 7777, name: 'Hollowmere', claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
const empire = { villages: { '7777': rec } };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const villageRoleMultiplier = () => 1;
const villageRuinDefsFor = () => [];
const villageRngFrom = () => () => 0.5;
const VILLAGE_RUIN_KINDS = { house: {} };
const VILLAGE_BASE_POPULATION = 0, VILLAGE_MAX_POPULATION = 200;
const villageConstructionOf = () => null;
const empireSettlementOfSeed = () => null;
"""
    return stubs + buildings + "\n" + functions + "\n" + driver


# ---------------------------------------------------------------------------
# 1. Two work huts, three hands each
# ---------------------------------------------------------------------------

def test_both_huts_are_village_tier_three_hand_yards_bought_with_timber():
    html = HTML.read_text(encoding="utf-8")
    lumber, mine = building_line(html, "lumberhut"), building_line(html, "minehut")
    for line in (lumber, mine):
        assert "tier: 'town'" not in line          # a village raises them itself
        assert "stone: 0 }" in line                # ...and never pays stone to do it
        assert "workers: 3" in line                # Yaan's "up to three villagers"
        assert "unlockLevel" not in line           # ungated: this is how a village bootstraps
        assert "maxLevel: 3" in line
    assert "name: 'Lumberjack Hut'" in lumber and "branchesPerLevel: 5" in lumber
    assert "workPriority: 6" in lumber             # AFTER the town Lumber Camp, never before
    assert "name: 'Miners’ Hut'" in mine and "stonePerLevel: 6" in mine
    assert "workPriority: 7" in mine               # AFTER the town Quarry, never before


def test_the_town_industry_is_still_the_better_deal_per_villager():
    """The merge has to stay worth it: a Quarry beats a hut hand for hand."""
    html = HTML.read_text(encoding="utf-8")
    quarry_stone = int(re.search(r"stonePerLevel: (\d+)", building_line(html, "quarry")).group(1))
    hut_stone = int(re.search(r"stonePerLevel: (\d+)", building_line(html, "minehut")).group(1))
    assert quarry_stone / 1 > hut_stone / 3        # 10 per hand vs 2
    camp_timber = int(re.search(r"branchesPerLevel: (\d+)", building_line(html, "lumber")).group(1))
    hut_timber = int(re.search(r"branchesPerLevel: (\d+)", building_line(html, "lumberhut")).group(1))
    assert camp_timber / 1 > hut_timber / 3        # 3 per hand vs 1.67


def test_output_scales_with_the_hands_actually_posted():
    out = run_node(economy_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.minehut = 1; eco.buildings.lumberhut = 1;
const read = pop => {
  eco.population = pop;
  const crew = villageWorkforce(rec);
  return { assigned: crew.assigned, working: crew.working, stone: villageProductionSnapshot(rec).stone };
};
// Timber outranks stone, so the lumberjacks fill up first.
console.log(JSON.stringify({ none: read(0), one: read(1), three: read(3), four: read(4), six: read(6) }));
"""))
    assert out["none"]["stone"] == 0 and out["none"]["assigned"] == {}
    # Three hands fill the lumber hut (priority 2) before any miner is posted.
    assert out["three"]["assigned"] == {"lumberhut": 3}
    assert out["three"]["stone"] == 0
    # A fourth hand opens the mine at one third of a crew: 6 stone becomes 2.
    assert out["four"]["assigned"] == {"lumberhut": 3, "minehut": 1}
    assert out["four"]["stone"] == 2
    # A full crew of six digs the lot.
    assert out["six"]["assigned"] == {"lumberhut": 3, "minehut": 3}
    assert out["six"]["stone"] == 6


def test_the_stores_ledger_never_advertises_more_than_the_strongbox_pays():
    """The easiest bug to ship: two copies of the same sum, only one scaled."""
    out = run_node(economy_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.minehut = 1; eco.population = 4; // 3 lumberjacks, 1 miner
const mine = EMPIRE_BUILDING_INDEX.minehut;
console.log(JSON.stringify({
  snapshot: villageProductionSnapshot(rec).stone,
  ledger: villageBuildingOutputForLedger(rec, mine).stone
}));
""".replace("EMPIRE_BUILDING_INDEX", "Object.fromEntries(EMPIRE_BUILDINGS.map(b => [b.id, b]))")))
    assert out["ledger"] == out["snapshot"]


def test_one_hand_yards_are_untouched_by_the_new_maths():
    """Every pre-existing yard has workers: 1, so its share is still 0 or 1."""
    out = run_node(economy_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.quarry = 2; eco.population = 1;
const crew = villageWorkforce(rec);
console.log(JSON.stringify({ staffed: crew.staffed, stone: villageProductionSnapshot(rec).stone }));
"""))
    assert out["staffed"] == {"quarry": True}
    assert out["stone"] == 20  # stonePerLevel 10 x level 2, undiminished


# ---------------------------------------------------------------------------
# 2. Collect whenever you like
# ---------------------------------------------------------------------------

def test_tribute_periods_are_fractional_and_still_capped_at_a_day():
    html = HTML.read_text(encoding="utf-8")
    src = function_source(html, "empireVillageTributePeriods")
    assert "Math.floor" not in src                       # the whole point
    assert "EMPIRE_TRIBUTE_MAX_PERIODS" in src           # ...but still capped
    out = run_node("""
const EMPIRE_TRIBUTE_INTERVAL_MS = 8 * 60 * 60 * 1000, EMPIRE_TRIBUTE_MAX_PERIODS = 3;
%s
%s
const now = 1000000000000;
const at = hoursAgo => ({ lastTributeAt: now - hoursAgo * 3600000 });
const clock = { lastTributeAt: now - 2 * 3600000 };
empireAdvanceTributeClock(clock, empireVillageTributePeriods(clock, now), now);
console.log(JSON.stringify({
  fresh: empireVillageTributePeriods(at(0), now),
  quarter: empireVillageTributePeriods(at(2), now),
  one: empireVillageTributePeriods(at(8), now),
  capped: empireVillageTributePeriods(at(200), now),
  clearedTo: clock.lastTributeAt - now
}));
""" % (function_source(html, "empireVillageTributeBase"),
       "\n".join([function_source(html, "empireVillageTributePeriods"),
                  function_source(html, "empireAdvanceTributeClock")])))
    assert out["fresh"] == 0
    assert out["quarter"] == 0.25          # two hours of an eight-hour cycle
    assert out["one"] == 1
    assert out["capped"] == 3              # still a day's worth, never more
    assert out["clearedTo"] == 0           # paid in full, clock carried to now


def test_a_long_idle_holding_cannot_bank_its_cap_twice():
    """Regression: the clock must never land ON the cap, which re-banks it.

    The first cut of this release cleared to max(base + paidMs, now - cap).
    For a holding idle 48h+ those two are EQUAL, so a second tap in the same
    second paid another full 24 hours -- 6 cycles for a day's accrual.
    """
    html = HTML.read_text(encoding="utf-8")
    out = run_node("""
const EMPIRE_TRIBUTE_INTERVAL_MS = 8 * 60 * 60 * 1000, EMPIRE_TRIBUTE_MAX_PERIODS = 3;
%s
const now = 1e12;
const v = { lastTributeAt: now - 72 * 3600000 };   // three days, never collected
let total = 0;
for (let i = 0; i < 5; i++) {                      // five taps, same instant
  const p = empireVillageTributePeriods(v, now);
  total += p;
  empireAdvanceTributeClock(v, p, now);
}
console.log(JSON.stringify({ total }));
""" % "\n".join([function_source(html, "empireVillageTributeBase"),
                 function_source(html, "empireVillageTributePeriods"),
                 function_source(html, "empireAdvanceTributeClock")]))
    assert out["total"] == 3   # the cap, once, however many times you tap


def test_the_strongbox_keeps_the_change_so_frequent_collection_loses_nothing():
    """A one-per-cycle material must survive being collected six times a day.

    One clock cannot serve resources with different rates: advance it by what
    the fastest earned and the slow ones are destroyed; advance it by the
    slowest and the fast ones pay twice. So the holding banks the fraction.
    """
    html = HTML.read_text(encoding="utf-8")
    out = run_node("""
const ensureVillageEconomy = r => r.economy;
%s
%s
const snap = { taxes: 10, branches: 7, production: { stone: 6, materials: { oak_twig: 1 }, larder: {} } };
const mk = () => ({ economy: { tributeCarry: {} } });
const sum = (a, b) => ({ coins: a.coins + b.coins, branches: a.branches + b.branches, stone: a.stone + b.stone,
                         twig: a.twig + (b.materials.oak_twig || 0) });
let often = { coins: 0, branches: 0, stone: 0, twig: 0 };
const rec = mk();
for (let i = 0; i < 6; i++) often = sum(often, villageTributeTake(rec, 0.5, snap, true));   // every 4h for a day
const once = villageTributeTake(mk(), 3, snap, true);                                       // one collection at the cap
console.log(JSON.stringify({ often, once: { coins: once.coins, branches: once.branches, stone: once.stone, twig: once.materials.oak_twig || 0 } }));
""" % (function_source(html, "villageTributeCarry"), function_source(html, "villageTributeTake")))
    # Six part-cycle collections earn exactly what one full collection earns.
    assert out["often"] == out["once"]
    assert out["once"] == {"coins": 30, "branches": 21, "stone": 18, "twig": 3}
    # And a display pass must never bank anything.
    take = function_source(html, "villageTributeTake")
    assert "if (commit) { const eco = ensureVillageEconomy(rec); if (eco) eco.tributeCarry = next; }" in take


def test_collecting_often_never_loses_time():
    """Collect twice in a cycle and the clock advances by exactly what it paid."""
    html = HTML.read_text(encoding="utf-8")
    out = run_node("""
const EMPIRE_TRIBUTE_INTERVAL_MS = 8 * 60 * 60 * 1000, EMPIRE_TRIBUTE_MAX_PERIODS = 3;
%s
%s
%s
let t = 1000000000000;
const v = { lastTributeAt: t };
let paid = 0;
for (let i = 0; i < 8; i++) {           // eight collections over eight hours
  t += 3600000;
  const p = empireVillageTributePeriods(v, t);
  paid += p;
  empireAdvanceTributeClock(v, p, t);
}
console.log(JSON.stringify({ paid }));
""" % (function_source(html, "empireVillageTributeBase"),
       function_source(html, "empireVillageTributePeriods"),
       function_source(html, "empireAdvanceTributeClock")))
    # Eight hourly collections total exactly one cycle — no worse than waiting.
    assert abs(out["paid"] - 1.0) < 1e-9


def test_a_part_cycle_cannot_conjure_goods_or_free_loot_rolls():
    html = HTML.read_text(encoding="utf-8")
    merge = function_source(html, "mergeResourceTotals")
    assert "Math.max(1," not in merge          # used to floor to a FULL cycle
    assert "Math.floor(qty * n)" in merge      # now it rounds down honestly
    # COLLECT opens on real value, never on "a holding exists".
    has = function_source(html, "tributeHasAnything")
    assert "payingHoldings" not in has and "payingWards" not in has
    # Forge chests ride WHOLE banked cycles in all three collectors.
    assert "Math.floor(empireVillageTributePeriods(v, now)) > 0) tributeChests += 1" in function_source(html, "collectEmpireTribute")
    assert "due.wholeCycleHoldings" in function_source(html, "regionTributeReady")
    assert "townHasAccruedTribute(settlement, now) ? grantLootDrops" in function_source(html, "collectTownTribute")


def test_the_badge_and_the_policy_lock_still_mean_a_whole_cycle():
    """Continuous accrual would pin both on for ever."""
    html = HTML.read_text(encoding="utf-8")
    assert "Math.floor(empireVillageTributePeriods(v, now)) > 0) waiting += 1" in function_source(html, "empireCollectiblesWaiting")
    assert "Math.floor(empireVillageTributePeriods(rec, Number(nowValue) || Date.now())) > 0" in function_source(html, "townHasAccruedTribute")


def test_one_timestamp_threads_through_ready_and_collect():
    """Fractional periods make even a few milliseconds of drift a real loss."""
    collect = function_source(HTML.read_text(encoding="utf-8"), "collectEmpireTribute")
    assert "empireTributeReady(now, true)" in collect  # the paying pass banks the change


# ---------------------------------------------------------------------------
# 3. The Timber Well
# ---------------------------------------------------------------------------

def test_the_well_is_timber_in_name_icon_and_mesh():
    html = HTML.read_text(encoding="utf-8")
    line = building_line(html, "well")
    assert "name: 'Timber Well'" in line and "icon: '🪣'" in line
    assert "id: 'well'" in line          # the save key never moves
    assert "Stone Well" not in html
    assert "🪣 Timber Well" in html      # the 3D sign agrees with the card
    # The collar is staved wood now, not dressed stone.
    assert "// A staved timber collar, not dressed stone" in html


# ---------------------------------------------------------------------------
# 4. Happiness has to be earned
# ---------------------------------------------------------------------------

def test_a_tavernless_village_cannot_reach_the_merge_bar():
    html = HTML.read_text(encoding="utf-8")
    needs = html[html.index("const EMPIRE_NEEDS = ["):html.index("// `produces` is what")]
    assert "label: 'Joy',     weight: 1.25" in needs
    for plain in ("label: 'Food',    weight: 1", "label: 'Water',   weight: 1", "label: 'Shelter', weight: 1"):
        assert plain in needs
    # (1 + 1 + 1 + 0) / 4.25 = 0.7059 — under the 0.75 star bar, over the
    # 0.65 band where villages stop growing.
    tavernless = 3 / 4.25
    assert tavernless < 0.75
    assert tavernless > 0.65
    # A served Alehouse takes it to a full 100%.
    assert (3 + 1.25) / 4.25 == 1.0


def test_the_happiness_mean_is_weighted():
    snap = function_source(HTML.read_text(encoding="utf-8"), "villageEconomySnapshot")
    assert "const needWeight = needs.reduce((sum, n) => sum + (n.weight || 1), 0) || 1;" in snap
    assert "needs.reduce((sum, n) => sum + n.sat * (n.weight || 1), 0) / needWeight;" in snap


# ---------------------------------------------------------------------------
# 5. Sixteen folk earn the star
# ---------------------------------------------------------------------------

def test_the_village_star_wants_sixteen_and_the_county_still_wants_a_hundred_and_twenty():
    core = MERGE_CORE.read_text(encoding="utf-8")
    assert "const TOWN_MERGE_MIN_POPULATION = 16;" in core
    assert "const REGION_MERGE_MIN_POPULATION = 120;" in core   # deliberately unchanged
    assert "const TOWN_MERGE_MIN_HAPPINESS = 0.75;" in core
    html = HTML.read_text(encoding="utf-8")
    assert "40 folk" not in html and "40 folk" not in core


# ---------------------------------------------------------------------------
# 6. Release plumbing
# ---------------------------------------------------------------------------

def test_release_stamp_reaches_runtime_and_service_worker():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_BUILD = '%s';" % CURRENT_BUILD in html
    cache_line = next(l for l in sw.splitlines() if l.startswith("const BURBZ_CACHE = "))
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert PREVIOUS_RELEASE_PIN in cache_line
