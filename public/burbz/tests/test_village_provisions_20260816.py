"""Villages live off what they grow — the honest provisions economy.

village-provisions-v272-20260816: nothing in a freed village is free any more.
Yaan's field report showed Kestrelby claiming food and water with no farm and
no well built — the old base capacity fed the bars from thin air. Now every
need starts at zero: staffed fields bank their harvest in the granary, wells
refill the cistern, and every villager eats one food and drinks one water per
tax cycle. Liberation leaves relief supplies so the first settlers survive the
first days; when the stores run dry the village goes hungry, pays a trickle
and empties out fast. A coin-priced supply cart is the emergency relief valve,
and the new Storehouse deepens both cellars.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "village-provisions-v272-20260816"
CURRENT_BUILD = "field-guide-menus-v287-20260819"
PREVIOUS_RELEASE_PIN = "fish-in-the-water-v271-20260815"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def provisions_harness(driver: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    consts = html[html.index("const EMPIRE_TRIBUTE_INTERVAL_MS"):html.index("// ---- Ruins & rubble")]
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "ensureVillageEconomy",
            "villageBuildingLevel",
            "villageBuildingTier",
            "villageNeedCapacity",
            "villageStoreCapacity",
            "villageProvisionRates",
            "villageWorkforce",
            "villageProductionSnapshot",
            "villageEconomySnapshot",
            "simulateVillageEconomy",
            "empireSendSupplyCart",
        )
    )
    stubs = """
global.window = global;
const toasts = [];
const notices = [];
const gameState = { player: { coins: 500, branches: 500, stone: 50 } };
const rec = { seed: 3333, name: 'Kestrelby', claimedAt: '2026-08-01T00:00:00Z', lastTributeAt: Date.now() };
const empire = { villages: { '3333': rec } };
const ensureEmpireState = () => empire;
const empireVillages = () => Object.values(empire.villages);
const empireRegionOfSeed = () => null;
const empireSettlementOfSeed = () => null;
const realmCore = () => null;
const villageRoleMultiplier = () => 1;
const regionRoleMultiplier = () => 1;
const villageRuinDefsFor = () => [];
const VILLAGE_RUIN_KINDS = { house: {} };
const queueCompletionNotice = n => notices.push(n);
const addCoins = n => { gameState.player.coins += n; };
const saveState = () => {}; const updateHeader = () => {};
const renderVillageManagePanel = () => {}; const renderEmpirePanel = () => {};
const SFX = { questComplete: () => {} }; const vibrate = () => {};
const showToast = t => toasts.push(t);
const HOUR8 = 8 * 60 * 60 * 1000;
"""
    return stubs + consts + "\n" + functions + "\n" + driver


def run_harness(driver: str):
    proc = subprocess.run(["node", "-e", provisions_harness(driver)], cwd=ROOT, text=True, capture_output=True)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


# ---------------------------------------------------------------------------
# Nothing is free: the bug Yaan photographed
# ---------------------------------------------------------------------------

def test_a_raw_village_supports_no_need_at_all():
    html = HTML.read_text(encoding="utf-8")
    # The phantom spring and cellar are gone — this exact line was the bug.
    assert "const VILLAGE_BASE_NEED_CAPACITY = { food: 0, water: 0, shelter: 0, joy: 0 };" in html
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
console.log(JSON.stringify({
  food: villageNeedCapacity(rec, 'food'),
  water: villageNeedCapacity(rec, 'water'),
  shelter: villageNeedCapacity(rec, 'shelter'),
  joy: villageNeedCapacity(rec, 'joy'),
  stores: eco.stores
}));
""")
    assert out["food"] == 0 and out["water"] == 0 and out["shelter"] == 0 and out["joy"] == 0
    # But the liberation caravan leaves real, depletable relief supplies.
    assert out["stores"] == {"food": 30, "water": 30}


def test_an_unstaffed_farm_feeds_nobody():
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.farm = 2; eco.population = 0;
const idle = { cap: villageNeedCapacity(rec, 'food'), rates: villageProvisionRates(rec) };
eco.population = 3;
const worked = { cap: villageNeedCapacity(rec, 'food'), rates: villageProvisionRates(rec) };
console.log(JSON.stringify({ idle, worked }));
""")
    assert out["idle"] == {"cap": 0, "rates": {"food": 0, "water": 0}}
    assert out["worked"] == {"cap": 28, "rates": {"food": 28, "water": 0}}


# ---------------------------------------------------------------------------
# The provisions loop: harvest, eat, drain, starve, recover
# ---------------------------------------------------------------------------

def test_relief_supplies_feed_the_first_settlers_then_drain_away():
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.cabin = 1; eco.population = 3;
const snap = villageEconomySnapshot(rec);
eco.lastSimAt = Date.now() - 4 * HOUR8;
simulateVillageEconomy(rec, Date.now());
console.log(JSON.stringify({
  fedSat: snap.needs[0].sat, waterSat: snap.needs[1].sat,
  provisions: snap.provisions, after: { stores: eco.stores, pop: eco.population, notices: notices.length }
}));
""")
    # No farm, no well — yet the settlers are honestly fed from the stores.
    assert out["fedSat"] == 1 and out["waterSat"] == 1
    assert out["provisions"]["food"] == {"rate": 0, "store": 30, "cap": 40, "eats": 3}
    # Four cycles later the village has grown to its cabin and eaten 18 meals.
    assert out["after"] == {"stores": {"food": 12, "water": 12}, "pop": 6, "notices": 0}


def test_empty_stores_mean_famine_flight_and_a_hunger_notice():
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.cabin = 1; eco.population = 6;
eco.stores.food = 0; eco.stores.water = 0;
eco.lastSimAt = Date.now() - 3 * HOUR8;
simulateVillageEconomy(rec, Date.now());
const snap = villageEconomySnapshot(rec);
console.log(JSON.stringify({
  pop: eco.population, foodSat: snap.needs[0].sat, happiness: snap.happiness,
  taxes: snap.taxes, notices
}));
""")
    # Starvation empties a village twice as fast as mere gloom (6 -> 4 floor).
    assert out["pop"] == 4
    assert out["foodSat"] == 0
    assert out["happiness"] == 0.25
    # The stubborn few still pay only a miserable trickle.
    assert out["taxes"] <= 4
    # And exactly one corner card points the governor at the hungry village.
    assert len(out["notices"]) == 1
    notice = out["notices"][0]
    assert notice["kind"] == "village-hunger"
    assert notice["target"] == {"seed": 3333}


def test_a_staffed_farm_and_well_bring_growth_back():
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
eco.buildings.cabin = 1; eco.buildings.farm = 1; eco.buildings.well = 1;
eco.population = 4; eco.stores.food = 0; eco.stores.water = 0;
const snap = villageEconomySnapshot(rec);
eco.lastSimAt = Date.now() - 3 * HOUR8;
simulateVillageEconomy(rec, Date.now());
console.log(JSON.stringify({
  rates: villageProvisionRates(rec), foodSat: snap.needs[0].sat, waterSat: snap.needs[1].sat,
  after: { pop: eco.population, stores: eco.stores, notices: notices.length }
}));
""")
    # This cycle's harvest feeds the table even with the cellar bare.
    assert out["rates"] == {"food": 14, "water": 16}
    assert out["foodSat"] == 1 and out["waterSat"] == 1
    # Fully provisioned again: the village grows and the surplus is banked.
    assert out["after"]["pop"] == 6
    assert out["after"]["stores"]["food"] > 0 and out["after"]["stores"]["water"] > 0
    assert out["after"]["notices"] == 0


def test_the_harvest_is_eaten_fresh_before_the_cellar_cap_bites():
    html = HTML.read_text(encoding="utf-8")
    sim = function_source(html, "simulateVillageEconomy")
    assert "The day's harvest is eaten fresh before the rest must fit the cellar." in sim
    assert "eco.population -= starving ? 2 : 1" not in sim  # split branches, kept explicit
    assert "else if (starving) eco.population -= 2;" in sim
    assert "else if (snap.happiness < 0.45) eco.population -= 1;" in sim
    # Growth now demands a fully fed and watered table, not just cheer.
    assert "snap.happiness >= 0.9 && provisioned" in sim
    assert "snap.happiness >= 0.65 && provisioned" in sim
    # The stubborn-few floor survives untouched.
    assert "const floor = Math.min(eco.population, VILLAGE_MIN_POPULATION);" in sim


# ---------------------------------------------------------------------------
# The supply cart and the Storehouse
# ---------------------------------------------------------------------------

def test_the_supply_cart_fills_the_stores_for_coins():
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
eco.stores.food = 0; eco.stores.water = 35;
gameState.player.coins = 100;
empireSendSupplyCart(3333);
const afterFirst = { stores: { ...eco.stores }, coins: gameState.player.coins };
eco.stores.food = 40; eco.stores.water = 40; // both cellars full
empireSendSupplyCart(3333);
console.log(JSON.stringify({ afterFirst, coins: gameState.player.coins, toasts }));
""")
    # +12 food, water capped at the 40-point cellar, 20 coins spent.
    assert out["afterFirst"] == {"stores": {"food": 12, "water": 40}, "coins": 80}
    assert any("supply cart rolls into" in t for t in out["toasts"])
    # Full stores refuse the cart — no coins wasted.
    assert out["coins"] == 80
    assert any("already full" in t for t in out["toasts"])


def test_the_storehouse_deepens_both_cellars():
    html = HTML.read_text(encoding="utf-8")
    block = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    store = next(line for line in block.splitlines() if "id: 'storehouse'" in line)
    assert "storagePerLevel: 40" in store
    assert "workers" not in store  # cellars need no keeper
    out = run_harness("""
const eco = ensureVillageEconomy(rec);
const bare = villageStoreCapacity(rec, 'food');
eco.buildings.farm = 3; eco.buildings.well = 1; eco.buildings.storehouse = 2;
console.log(JSON.stringify({ bare, food: villageStoreCapacity(rec, 'food'), water: villageStoreCapacity(rec, 'water') }));
""")
    assert out["bare"] == 40
    assert out["food"] == 40 + 20 * 3 + 40 * 2
    assert out["water"] == 40 + 20 * 1 + 40 * 2


# ---------------------------------------------------------------------------
# The governor's desk tells the truth
# ---------------------------------------------------------------------------

def test_the_desk_shows_granary_cistern_and_the_cart():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderVillageManagePanel")
    assert "province-need-sub" in panel
    assert "'granary'" in panel and "'cistern'" in panel
    assert "villagers go hungry" in panel and "villagers go thirsty" in panel
    assert "empireSendSupplyCart(" in panel
    assert "SEND A SUPPLY CART" in panel
    assert "the stores run short</b>" in panel
    # The bars read who is actually served, never a phantom capacity.
    assert "Math.min(snap.pop, n.served)" in panel
    # And the styles for the new lines exist.
    assert ".province-need-sub" in html
    assert ".province-cart-btn" in html


def test_the_hunger_notice_navigates_to_its_village():
    html = HTML.read_text(encoding="utf-8")
    go = function_source(html, "completionNoticeGo")
    assert "notice.kind === 'village-hunger'" in go
    assert "empireSendSupplyCart," in html  # exposed for the inline onclick


def test_the_copy_teaches_the_provisions_loop():
    html = HTML.read_text(encoding="utf-8")
    assert "Villages live off what they grow.</b>" in html  # empire help drawer
    assert "your caravan leaves relief supplies" in html    # liberation toast
    assert "function villageMakeCrates(" in html
    assert "b.id === 'storehouse'" in html                  # the shed rises in 3D


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_is_versioned_and_cache_lineage_kept():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line       # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)  # head build reaches players
