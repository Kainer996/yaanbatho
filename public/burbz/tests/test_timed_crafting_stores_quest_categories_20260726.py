"""Timed crafting, the Royal Stores overhaul, province production and a
categorised quest board.

Four things ship together here, and each one is pinned below:

* **Crafting takes time.** Placing a commission at the Fletcher's Forge spends
  the materials and coins up front and puts the piece on the anvil; it is
  collected later. The wait scales with the item's rarity band *and*, inside a
  band, with the item's own power score — so a Sunlance always takes longer to
  hammer out than a Willow Wand.
* **The Stores screen is a city-builder warehouse.** The forge button sits at
  the very top, a treasury banner reads like a grand-strategy resource bar, and
  the stock is split into Ledger / Materials / Food / Armoury / Curios.
* **Provinces actually produce.** Grain farms, lumber camps, quarries and
  market halls ship real goods into the Stores every tax cycle, and the whole
  realm's output is collected from one ledger.
* **The quest board has categories.** Kingdom Errands are sorted into
  collapsible drawers, and the Materials drawer holds one errand per crafting
  material in the game — every single one.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
LOOT_CORE_PATH = ROOT / "loot_crafting_core.js"
ACADEMY_CORE_PATH = ROOT / "academy_treehouse_core.js"


def node_json(script):
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(name):
    start = HTML.index(f"function {name}(")
    depth = 0
    for i in range(start, len(HTML)):
        if HTML[i] == "{":
            depth += 1
        elif HTML[i] == "}":
            depth -= 1
            if depth == 0:
                return HTML[start : i + 1]
    raise AssertionError(f"unterminated function {name}")


# ---------------------------------------------------------------------------
# Crafting timers
# ---------------------------------------------------------------------------

def test_craft_times_rise_with_rarity_and_with_power_inside_a_band():
    data = node_json(
        """
        const L = require('./loot_crafting_core.js');
        const rows = Object.values(L.GEAR).map(g => ({
          id: g.id, rarity: g.rarity, power: L.gearPowerScore(g), ms: L.craftTimeMs(g.id)
        }));
        console.log(JSON.stringify({ rows, order: L.RARITY_ORDER, maxJobs: L.FORGE_MAX_JOBS }));
        """
    )
    rows = data["rows"]
    assert rows, "every gear item must have a craft time"
    assert all(r["ms"] > 0 for r in rows)

    # Bands never overlap: the slowest common piece is quicker than the
    # quickest uncommon, and so on all the way to legendary.
    bands = {r: [x["ms"] for x in rows if x["rarity"] == r] for r in data["order"]}
    for lower, upper in zip(data["order"], data["order"][1:]):
        assert bands[lower] and bands[upper]
        assert max(bands[lower]) < min(bands[upper]), (lower, upper)

    # Inside a band, more powerful means longer on the anvil.
    for rarity in data["order"]:
        band = sorted(
            (x for x in rows if x["rarity"] == rarity), key=lambda x: x["power"]
        )
        times = [x["ms"] for x in band]
        assert times == sorted(times), rarity

    # A commission queue, not an unbounded backlog.
    assert data["maxJobs"] >= 1


def test_craft_time_is_exported_and_the_forge_starts_a_job_instead_of_granting_gear():
    core = LOOT_CORE_PATH.read_text(encoding="utf-8")
    assert "craftTimeMs" in core and "CRAFT_TIME_BY_RARITY" in core
    assert "FORGE_MAX_JOBS" in core

    craft = function_source("craftGear")
    # Costs are still paid up front...
    assert "addCoins(-recipe.coins)" in craft
    # ...but the piece itself goes on the anvil with a real clock.
    assert "craftTimeMs" in craft and "endMs" in craft
    # The old instant grant is gone from the craft path.
    assert "gameState.inventory.gear[gearId] = (gameState.inventory.gear[gearId] || 0) + 1" not in craft

    collect = function_source("collectForgeJob")
    assert "gameState.inventory.gear[job.gearId]" in collect
    assert "updateQuestProgress('gear_crafted', 1)" in collect
    # Nothing is collectable before its clock runs out.
    assert "Date.now() < Number(job.endMs)" in collect

    # Pulling a commission refunds everything, since no piece was finished.
    cancel = function_source("cancelForgeJob")
    assert "addCoins(recipe.coins)" in cancel
    assert "gameState.inventory.items[matId]" in cancel


def test_forge_jobs_survive_a_reload_and_are_healed_when_malformed():
    assert "forgeJobs: []" in HTML  # persisted in DEFAULT_STATE
    assert "ensureForgeJobs()" in HTML  # run on every state load
    heal = function_source("ensureForgeJobs")
    assert "Array.isArray(gameState.forgeJobs)" in heal
    assert "Number.isFinite" in heal


# ---------------------------------------------------------------------------
# The Royal Stores screen
# ---------------------------------------------------------------------------

def test_forge_button_sits_at_the_top_of_the_stores_screen():
    screen = HTML[HTML.index('<div class="screen" id="screen-inventory">'):]
    screen = screen[: screen.index('<!-- FLETCHER\'S FORGE')]
    forge_at = screen.index('id="storesForgeBtn"')
    for later in ('id="storesTreasury"', 'id="storesTabs"', 'id="storesBody"'):
        assert forge_at < screen.index(later), f"{later} must come after the forge button"
    assert "switchScreen('forge')" in screen


def test_stores_screen_has_material_food_and_gear_categories():
    tabs = re.search(r"const STORES_TABS = \[(.*?)\];", HTML, re.S)
    assert tabs, "the Stores screen must declare its category tabs"
    for tab in ("'ledger'", "'materials'", "'food'", "'armoury'", "'curios'"):
        assert tab in tabs.group(1)
    for renderer in (
        "renderStoresLedger",
        "renderStoresMaterials",
        "renderStoresFood",
        "renderStoresArmoury",
        "renderStoresCurios",
        "renderStoresTreasury",
    ):
        assert f"function {renderer}(" in HTML

    # Materials list every material in the game, not only the owned ones, so
    # the player can see what is still missing.
    materials = function_source("renderStoresMaterials")
    assert "L.MATERIALS" in materials and "RARITY_ORDER" in materials
    # Food is grouped by the diet family it feeds.
    food = function_source("renderStoresFood")
    assert "DIET_FAMILIES" in food and "dietFamily" in food

    # A grand-strategy resource banner, not a four-number inventory card.
    treasury = function_source("renderStoresTreasury")
    for label in ("'Treasury'", "'Timber'", "'Materials'", "'Food'", "'Provinces'", "'Subjects'"):
        assert label in treasury

    for css in (".stores-treasury", ".stores-tab", ".stores-panel", ".stores-res-card", ".stores-ledger-row"):
        assert css in HTML, f"{css} styling must ship"


def test_stores_screen_shows_the_collective_output_of_every_town():
    ledger = function_source("empireLedger")
    for field in ("provinces", "population", "materials", "larder", "buildings"):
        assert field in ledger
    screen = function_source("renderStoresLedger")
    assert "empireLedger()" in screen
    assert "collectEmpireTribute()" in screen
    assert "EMPIRE_BUILDINGS.filter(b => b.produces" in screen


# ---------------------------------------------------------------------------
# Provinces that actually produce
# ---------------------------------------------------------------------------

PRODUCING_BUILDINGS = {
    "farm": ("larder", ("sunflower_seeds", "acorn_handful")),
    "lumber": ("materials", ("oak_twig", "down_tuft")),
    "quarry": ("materials", ("iron_grit", "storm_glass")),
    "market": ("materials", ("river_reed",)),
}


def test_farms_lumber_camps_quarries_and_markets_all_produce_goods():
    block = re.search(r"const EMPIRE_BUILDINGS = \[(.*?)\n\];", HTML, re.S).group(1)
    for building_id, (bucket, goods) in PRODUCING_BUILDINGS.items():
        line = next(l for l in block.splitlines() if f"id: '{building_id}'" in l)
        assert "produces:" in line, f"{building_id} must produce something"
        assert f"{bucket}:" in line, f"{building_id} must fill the {bucket}"
        for good in goods:
            assert good in line, f"{building_id} must produce {good}"

    # A deserted province produces nothing: an empty quarry is a hole in a hill.
    snapshot = function_source("villageProductionSnapshot")
    assert "eco.population <= 0" in snapshot

    # Everything produced is a real material or a real larder ingredient.
    materials = set(node_json(
        "console.log(JSON.stringify(Object.keys(require('./loot_crafting_core.js').MATERIALS)))"
    ))
    ingredients = set(node_json(
        "console.log(JSON.stringify(Object.keys(require('./kitchen_pantry_core.js').INGREDIENTS)))"
    ))
    for building_id, (bucket, goods) in PRODUCING_BUILDINGS.items():
        pool = materials if bucket == "materials" else ingredients
        for good in goods:
            assert good in pool, f"{building_id} produces unknown {bucket} {good}"


def test_collecting_taxes_also_banks_what_the_provinces_produced():
    ready = function_source("empireTributeReady")
    assert "snap.production.materials" in ready and "snap.production.larder" in ready
    collect = function_source("collectEmpireTribute")
    assert "due.materials" in collect and "due.larder" in collect
    assert "addLarderIngredient(id, qty)" in collect
    assert "gameState.inventory.items[id]" in collect


# ---------------------------------------------------------------------------
# The categorised quest board
# ---------------------------------------------------------------------------

def test_every_kingdom_errand_belongs_to_a_category():
    data = node_json(
        """
        const A = require('./academy_treehouse_core.js');
        console.log(JSON.stringify({
          categories: A.getQuestCategories(),
          templates: A.getQuestTemplates().map(t => ({ id: t.id, category: t.category, minutes: t.minutes, items: t.items }))
        }));
        """
    )
    category_ids = [c["id"] for c in data["categories"]]
    assert {"food", "materials"}.issubset(set(category_ids))
    for cat in data["categories"]:
        assert cat["icon"] and cat["label"] and cat["copy"]
    for template in data["templates"]:
        assert template["category"] in category_ids, template["id"]
    # Every category actually has errands in it.
    for cat_id in category_ids:
        assert any(t["category"] == cat_id for t in data["templates"]), cat_id


def test_every_crafting_material_in_the_game_has_a_quest_that_fetches_it():
    data = node_json(
        """
        const A = require('./academy_treehouse_core.js');
        const L = require('./loot_crafting_core.js');
        const templates = A.getQuestTemplates();
        const rows = Object.values(L.MATERIALS).map(m => {
          const quests = templates.filter(t => (t.items || []).includes(m.id));
          return {
            id: m.id, rarity: m.rarity,
            quests: quests.map(q => ({ id: q.id, category: q.category, minutes: q.minutes, minLevel: q.minLevel, starter: !!q.starter }))
          };
        });
        console.log(JSON.stringify({ rows, order: L.RARITY_ORDER }));
        """
    )
    for row in data["rows"]:
        assert row["quests"], f"no quest fetches {row['id']}"
        assert any(q["category"] == "materials" for q in row["quests"]), row["id"]

    # The four common materials are reachable on day one, before the Quest
    # Roost exists — nothing about basic crafting is gated behind a building.
    commons = [r for r in data["rows"] if r["rarity"] == "common"]
    assert commons
    for row in commons:
        assert any(q["starter"] for q in row["quests"]), row["id"]

    # Rarer materials take longer to fetch.
    def shortest(row):
        return min(q["minutes"] for q in row["quests"] if q["category"] == "materials")

    by_rarity = {}
    for row in data["rows"]:
        by_rarity.setdefault(row["rarity"], []).append(shortest(row))
    ordered = [r for r in data["order"] if r in by_rarity]
    for lower, upper in zip(ordered, ordered[1:]):
        assert max(by_rarity[lower]) < min(by_rarity[upper]), (lower, upper)


def test_the_quest_board_renders_collapsible_category_drawers():
    board = function_source("renderBirdExpeditions")
    assert "quest-category" in board
    assert "<details" in board and "<summary" in board
    assert "questCategoriesList()" in board
    assert "Kingdom Errands" in board
    # Materials errands name the material they bring home on the card itself.
    assert "materialById" in board
    # The drawer body scrolls on its own so a long food list never buries the board.
    assert ".quest-category-body" in HTML and "overflow-y:auto" in HTML
    # Inline handlers only work if the functions are exposed off the IIFE.
    for fn in ("setQuestCategoryOpen", "storesSetTab", "collectForgeJob", "cancelForgeJob"):
        assert re.search(rf"Object\.assign\(window, \{{[^}}]*\b{fn}\b", HTML, re.S), fn


def test_academy_core_and_loot_core_ship_fresh_pins_and_a_bumped_cache():
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    for pin in ("academy_treehouse_core.js?v=quest-duration-tiers-v211-20260803",):
        assert pin in HTML, pin
        assert f"./{pin}" in sw, pin
    loot_match = re.search(r'loot_crafting_core\.js\?v=[^"\']+', HTML)
    assert loot_match is not None
    loot_pin = loot_match.group(0)
    assert f"'./{loot_pin}'" in sw
    assert "timed-crafting-stores-v144-20260726" in sw
