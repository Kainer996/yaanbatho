"""The Magpie Market — the Academy's trading post.

Yaan's ask (2026-08-24), pinned as `magpie-market-v316-20260824`:

> "Can you add a building that can be built to the Academy, not much later on
> in the levels, that is a trade building so that the player can buy and sell
> materials? Make it the fifth building that the player can build."

So the Market is the FIFTH gate on the Academy ladder — Barracks 1, Training
Hall 2, Quest Roost 3, Kitchen 4, Magpie Market 5 — and the Bird Hospital and
The Crowbar each slipped one level to make room. Nothing got dearer: the
Market costs 135 coins, between the Kitchen's 130 and the Hospital's 140, so
the coin ladder still rises with every gate.

Buying is the new half. Selling reuses the Royal Stores' shelf prices; buying
pays a rarity-scaled markup on top, so a round trip through the counter always
loses coins and quests stay the cheap way to anything precious.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
ACADEMY_CORE = ROOT / "academy_treehouse_core.js"
LOOT_CORE = ROOT / "loot_crafting_core.js"
ROLES_CORE = ROOT / "bird_roles_core.js"
CORE_3D = ROOT / "academy_3d_core.js"
ALIVE_CORE = ROOT / "academy_alive_core.js"

OWN_RELEASE_PIN = "magpie-market-v316-20260824"
# The head of the line, which later releases move. This release changed the
# cores below, so OWN_RELEASE_PIN stays their `?v=` tag for good.
CURRENT_BUILD = "free-your-first-village-v327-20260825"
PREVIOUS_RELEASE_PIN = "bird-card-carry-charm-v313-20260824"
ROOM_ID = "magpie_market"

# Every core this release edited, and therefore re-pinned.
EDITED_CORES = (
    "academy_alive_core.js",
    "academy_3d_core.js",
    "loot_crafting_core.js",
)
# bird_roles_core.js was edited by this release too, but free-birds-v318 then
# retired the Head Gardener and re-pinned it. A core carries the tag of the
# release that last touched it, so it is checked separately below.
ROLES_CORE_PIN = "manager-builds-the-village-v324-20260825"
# academy_treehouse_core.js the same story: iron-ingot-errand-v326 added the
# Foundry Ingot Pour errand to it, so it now carries that tag instead.
ACADEMY_CORE_PIN = "iron-ingot-errand-v326-20260825"


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def run_node(source: str) -> dict:
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8",
                            capture_output=True, check=False, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index("function %s(" % name)
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def academy_rooms() -> list:
    return run_node(
        "const c = require(%s); console.log(JSON.stringify(c.getAcademyRooms()));"
        % json.dumps(str(ACADEMY_CORE))
    )


# ---------------------------------------------------------------------------
# 1. The ladder: the Market is the fifth thing the player builds
# ---------------------------------------------------------------------------

def test_the_market_is_the_fifth_gate_on_the_academy_ladder():
    rooms = academy_rooms()
    # The Aviary Gardens are the tree itself, free and never built.
    buildable = [r for r in rooms if r["id"] != "outdoors"]
    ladder = sorted(buildable, key=lambda r: (r["unlockLevel"], r["cost"]))
    assert [r["id"] for r in ladder][:5] == [
        "tavern", "training", "quest_roost", "kitchen", ROOM_ID
    ], "trade must be the fifth room the player can build"


def test_trade_arrives_early_and_pushes_nothing_out_of_the_early_game():
    by_id = {r["id"]: r for r in academy_rooms()}
    assert by_id[ROOM_ID]["unlockLevel"] == 5, "'not much later on in the levels'"
    # The two rooms it displaced each slipped exactly one level, filling the
    # gap that used to sit at level 7. Nothing jumped further than that.
    assert by_id["hospital"]["unlockLevel"] == 6
    assert by_id["crowbar"]["unlockLevel"] == 7
    gates = sorted(r["unlockLevel"] for r in academy_rooms() if r["id"] != "outdoors")
    assert gates[:7] == [1, 2, 3, 4, 5, 6, 7], "the early ladder has no holes"


def test_the_coin_ladder_still_rises_with_every_gate_and_nothing_got_dearer():
    rooms = [r for r in academy_rooms() if r["id"] != "outdoors"]
    by_gate = sorted(rooms, key=lambda r: r["unlockLevel"])
    costs = [r["cost"] for r in by_gate]
    assert costs == sorted(costs), "a later room must never be cheaper"
    assert len(set(costs)) == len(costs), "no two rooms share a price"
    by_id = {r["id"]: r for r in rooms}
    # The Market slots between the Kitchen and the Hospital, so the rooms it
    # displaced kept their old bills exactly.
    assert by_id["kitchen"]["cost"] < by_id[ROOM_ID]["cost"] < by_id["hospital"]["cost"]
    assert by_id["hospital"]["cost"] == 140 and by_id["hospital"]["branches"] == 30
    assert by_id["crowbar"]["cost"] == 190 and by_id["crowbar"]["branches"] == 40


def test_the_room_is_a_real_catalogue_entry_with_a_home_on_the_tree():
    room = {r["id"]: r for r in academy_rooms()}[ROOM_ID]
    assert room["label"] == "Magpie Market" and room["role"] == "trade"
    assert 10 <= room["x"] <= 90 and 8 <= room["y"] <= 92, "it must sit on the painted tree"
    # It hangs on the one bough the second floor had spare.
    assert room["floor"] == 2 and room["branch"] == "left"
    others = [(r["x"], r["y"]) for r in academy_rooms() if r["id"] != ROOM_ID]
    assert (room["x"], room["y"]) not in others, "no two rooms share a default plot"


# ---------------------------------------------------------------------------
# 2. The counter: what a deal costs
# ---------------------------------------------------------------------------

def loot(expression: str) -> dict:
    return run_node("const core = require(%s); console.log(JSON.stringify(%s));"
                    % (json.dumps(str(LOOT_CORE)), expression))


def test_buying_costs_more_than_selling_pays_for_every_rarity():
    out = loot("{ order: core.RARITY_ORDER, sell: core.SELL_PRICES.material,"
               "  buy: Object.fromEntries(core.RARITY_ORDER.map(r => [r, core.buyValue('material', r)])) }")
    for rarity in out["order"]:
        sell, buy = out["sell"][rarity], out["buy"][rarity]
        assert buy > sell, "%s must never be an arbitrage" % rarity


def test_the_markup_widens_with_rarity_so_quests_stay_the_cheap_road():
    out = loot("{ order: core.RARITY_ORDER, markup: core.BUY_MARKUP,"
               "  buy: Object.fromEntries(core.RARITY_ORDER.map(r => [r, core.buyValue('material', r)])) }")
    ladder = [out["markup"][r] for r in out["order"]]
    assert ladder == sorted(ladder), "a rarer material must carry a wider spread"
    assert ladder[0] < ladder[-1], "the top and bottom of the shelf differ"
    prices = [out["buy"][r] for r in out["order"]]
    assert prices == sorted(prices) and len(set(prices)) == len(prices)


def test_a_quote_never_outruns_the_purse():
    out = loot("{"
               "  rich: core.buyQuote('material', 'rare', 200, 3),"
               "  poor: core.buyQuote('material', 'rare', 100, 3),"
               "  broke: core.buyQuote('material', 'rare', 4, 3),"
               "  unknown: core.buyQuote('material', 'mythic', 9999, 3)"
               "}")
    assert out["rich"]["qty"] == 3 and out["rich"]["total"] == out["rich"]["each"] * 3
    # 100 coins at 45 each buys two, not the three the button asked for.
    assert out["poor"]["qty"] == 2 and out["poor"]["total"] <= 100
    assert out["broke"]["qty"] == 0 and out["broke"]["total"] == 0
    # A rarity the traders do not price is unbuyable, never free.
    assert out["unknown"] == {"each": 0, "qty": 0, "total": 0, "afford": 0}


def test_the_traders_discount_is_applied_before_the_sums_not_after():
    out = loot("{"
               "  full: core.buyQuote('material', 'rare', 500, 4),"
               "  haggled: core.buyQuote('material', 'rare', 500, 4, 0.8),"
               "  floored: core.buyQuote('material', 'common', 500, 1, 0.01)"
               "}")
    haggled = out["haggled"]
    assert haggled["each"] < out["full"]["each"], "a posted trader must move the price"
    # Rounding each unit first is what stops a discount leaking a free one.
    assert haggled["total"] == haggled["each"] * haggled["qty"]
    # A discount can never take a price below half, nor to nothing.
    assert out["floored"]["each"] >= 1


# ---------------------------------------------------------------------------
# 3. The market in the game: real coins, real stock
# ---------------------------------------------------------------------------

def market_harness(probe: str) -> str:
    html = html_text()
    functions = "\n".join(function_source(html, name) for name in (
        "storesSellRarity", "storesSellBag", "storesSellLabel", "storesSellQuote", "storesSellItem",
        "magpieMarketOwned", "magpieMarketDiscount", "magpieMarketBuyQuote",
        "magpieMarketSell", "magpieMarketRecordTrade", "magpieMarketBuy",
    ))
    stubs = """
global.window = global;
const toasts = [];
const prompts = [];
const questTicks = [];
const L = require(%s);
const lootCore = () => L;
let roleMultiplier = 1;
const academyRoleMultiplier = () => roleMultiplier;
let currentScreen = 'academy-room';
const gameState = { player: { coins: 300 }, inventory: {
  items: { oak_twig: 4 }, larder: {}, gear: {}
} };
const addCoins = n => { gameState.player.coins += n; };
const saveState = () => {};
const updateHeader = () => {};
const renderInventory = () => {};
const renderAcademyRoomInterior = () => {};
const showToast = t => toasts.push(t);
const showResourceQuestPrompt = (kind, need) => prompts.push({ kind, need });
const updateQuestProgress = (type, n) => questTicks.push([type, n]);
const SFX = { questComplete: () => {} };
const vibrate = () => {};
const kitchenIngredientById = id => ({ id, label: id });
const inventoryLabel = id => id;
""" % json.dumps(str(LOOT_CORE))
    return stubs + functions + "\n" + probe


def test_buying_moves_coins_into_stock_at_the_quoted_price():
    out = run_node(market_harness("""
const quote = magpieMarketBuyQuote('oak_twig', 5);
magpieMarketBuy('oak_twig', 5);
console.log(JSON.stringify({
  each: quote.each,
  coins: gameState.player.coins,
  owned: gameState.inventory.items.oak_twig,
  toasts, questTicks
}));
"""))
    # A common material at 2 to sell is 5 to buy: five of them cost 25.
    assert out["each"] == 5
    assert out["coins"] == 300 - 25
    assert out["owned"] == 4 + 5, "the stack grows by exactly what was paid for"
    assert out["questTicks"] == [["market_traded", 1]], "one deal, one tick"
    assert any("Bought 5" in t for t in out["toasts"])


def test_a_save_with_no_item_bag_is_never_charged_for_goods_it_cannot_hold():
    """The bag is made before the coins are taken, never after."""
    out = run_node(market_harness("""
delete gameState.inventory;
magpieMarketBuy('oak_twig', 2);
console.log(JSON.stringify({
  coins: gameState.player.coins,
  owned: gameState.inventory.items.oak_twig,
}));
"""))
    assert out["owned"] == 2, "the goods arrive"
    assert out["coins"] == 300 - 10, "and cost exactly what they should"


def test_a_purchase_the_purse_cannot_cover_changes_nothing():
    out = run_node(market_harness("""
gameState.player.coins = 3;                 // an Oak Twig costs 5
magpieMarketBuy('oak_twig', 1);
magpieMarketBuy('not_a_material', 1);       // nothing the magpies deal in
console.log(JSON.stringify({
  coins: gameState.player.coins,
  owned: gameState.inventory.items.oak_twig,
  prompts, questTicks, toasts
}));
"""))
    assert out["coins"] == 3 and out["owned"] == 4, "a refused deal must cost nothing"
    assert out["questTicks"] == [], "a refused deal is not a deal"
    assert out["prompts"] == [{"kind": "coins", "need": 5}], "the player is told what it costs"


def test_selling_at_the_counter_is_the_shelf_price_and_counts_as_a_deal():
    out = run_node(market_harness("""
magpieMarketSell('oak_twig', 'all');    // 4 sticks at 2 each
const afterSale = gameState.player.coins;
magpieMarketSell('oak_twig', 1);        // pile is empty now — refused
console.log(JSON.stringify({
  afterSale,
  coins: gameState.player.coins,
  owned: gameState.inventory.items.oak_twig || 0,
  questTicks
}));
"""))
    assert out["afterSale"] == 300 + 8 and out["owned"] == 0
    assert out["coins"] == out["afterSale"], "an empty shelf pays nothing"
    assert out["questTicks"] == [["market_traded", 1]], "only a real sale counts"


def test_a_posted_market_trader_makes_every_purchase_cheaper():
    out = run_node(market_harness("""
const vacant = magpieMarketBuyQuote('phoenix_ember', 1).each;
roleMultiplier = 1.75;                  // a perfect bird in the post
const staffed = magpieMarketBuyQuote('phoenix_ember', 1).each;
console.log(JSON.stringify({ vacant, staffed, discount: magpieMarketDiscount() }));
"""))
    assert out["vacant"] == 500, "a legendary is five times what a magpie pays for one"
    assert out["staffed"] < out["vacant"], "haggling must show up in the price"
    # The same shape as the Barracks' recruiting discount: about a quarter off
    # at best, never a giveaway.
    assert 0.70 <= out["discount"] <= 0.76
    assert out["staffed"] > out["vacant"] // 2


# ---------------------------------------------------------------------------
# 4. The room in the Academy
# ---------------------------------------------------------------------------

def test_the_market_is_a_counter_not_a_dormitory():
    html = html_text()
    move = function_source(html, "academyMoveBird")
    assert "if (room === '%s')" % ROOM_ID in move, "birds must not lodge at a market"
    buttons = function_source(html, "academyRoomButtonsHTML")
    assert "room !== '%s'" % ROOM_ID in buttons, "no 'send to the market' button"
    # Like the Kitchen, it offers no "add a bird to this room" roster.
    render = function_source(html, "renderAcademyRoomInterior")
    assert "const counterRoom = room === 'kitchen' || room === '%s';" % ROOM_ID in render
    assert "const roomAddPanel = counterRoom ? ''" in render
    room = {r["id"]: r for r in academy_rooms()}[ROOM_ID]
    assert "ACADEMY_ROOMS" in html
    assert "perches:[] }" in html[html.index("  %s: { label:'MAGPIE MARKET'" % ROOM_ID):][:600]
    assert room["label"] == "Magpie Market"


def test_the_stores_sell_path_stays_free_of_the_academy():
    """storesSellItem is shared code: it must not know a market exists."""
    sell = function_source(html_text(), "storesSellItem")
    for leak in ("academy", "magpie", "currentScreen"):
        assert leak not in sell, "the Royal Stores must not reach into the Academy"


def test_the_counter_offers_both_halves_of_the_trade_for_every_material():
    html = html_text()
    row = function_source(html, "magpieMarketRowHTML")
    assert "magpieMarketBuy(" in row and "magpieMarketSell(" in row
    assert "BUY 1" in row and "BUY 5" in row and "SELL 1" in row
    # Every crafting material is on the counter, cheapest first.
    stock = function_source(html, "magpieMarketStock")
    assert "lootCore().MATERIALS" in stock and "MAGPIE_RARITY_ORDER" in stock
    count = run_node("const c = require(%s); console.log(JSON.stringify(Object.keys(c.MATERIALS).length));"
                     % json.dumps(str(LOOT_CORE)))
    assert count >= 10, "the whole material shelf is tradeable"


def test_inline_handlers_are_reachable_from_the_generated_markup():
    """The app is an IIFE; a button's onclick resolves in global scope only."""
    html = html_text()
    exports = html[html.index("Object.assign(window, { academyBuildBuilding"):]
    exports = exports[:exports.index("});")]
    for name in ("magpieMarketBuy", "magpieMarketSell"):
        assert name in exports, name


def test_the_market_has_a_bird_who_runs_it():
    roles = run_node("const c = require(%s); console.log(JSON.stringify("
                     "(c.getRoles ? c.getRoles() : c.ROLES).filter(r => r.scope === 'academy')));"
                     % json.dumps(str(ROLES_CORE)))
    post = next((r for r in roles if r["key"] == ROOM_ID), None)
    assert post, "every Academy room carries a post"
    assert post["title"] == "Market Trader"
    # Charm drives the haggle, the way it drives diplomacy quests.
    assert post["stats"]["cha"] > post["stats"].get("int", 0)


def test_the_room_is_built_into_the_tree_the_3d_scene_and_the_ambience():
    html = html_text()
    # It reuses the market painting that has sat unused in the repo (and in the
    # service worker's precache) since the Recruitment Roost retired.
    assert "%s:'assets/academy-buildings-manga/market.png'" % ROOM_ID in html
    assert "./assets/academy-buildings-manga/market.png" in SW.read_text(encoding="utf-8")
    assert '.treehouse-room-node[data-room="%s"]' % ROOM_ID in html, "its own lean on its own bough"
    # It has no painted interior, so it draws its own scene like the Library.
    assert "magpie_market() {" in html
    assert "ACADEMY_ROOM_INTERIOR_ASSETS" in html
    interiors = html[html.index("const ACADEMY_ROOM_INTERIOR_ASSETS = {"):]
    assert ROOM_ID not in interiors[:interiors.index("};")]

    three_d = CORE_3D.read_text(encoding="utf-8")
    assert re.search(r"%s:\s*\{ angle:" % ROOM_ID, three_d), "it needs a bough in 3D"
    assert "%s: {" % ROOM_ID in three_d and "Magpie Market" in three_d
    alive = ALIVE_CORE.read_text(encoding="utf-8")
    assert "%s: [" % ROOM_ID in alive, "its lanterns must light at night"


def test_the_chain_asks_the_player_to_build_it_then_use_it():
    html = html_text()
    chain = html[html.index("const PLAYER_QUESTS = ["):html.index("function activePlayerQuest()")]
    ids = re.findall(r"id:'(pq_[a-z_0-9]+)'", chain)
    assert "pq_build_market" in ids and "pq_market_trade" in ids
    assert ids.index("pq_market_trade") == ids.index("pq_build_market") + 1
    # Fifth gate, so it sits after the Kitchen's links and before the Hospital's.
    assert ids.index("pq_build_kitchen") < ids.index("pq_build_market") < ids.index("pq_build_hospital")
    # academyBuildBuilding fires build_<id>, so the type must match the room id.
    assert "type:'build_%s'" % ROOM_ID in chain


# ---------------------------------------------------------------------------
# 5. Shipping
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_BUILD = '%s';" % CURRENT_BUILD in html
    cache_line = next(l for l in sw.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert OWN_RELEASE_PIN in cache_line, "and this release keeps its place in it"
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD), "the newest marker goes on the end"


def test_every_core_this_release_edited_ships_under_its_new_tag():
    """A stale `?v=` would serve an installed PWA the old core against the new
    page — the Market would be missing from the catalogue and buyQuote gone."""
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert "bird_roles_core.js?v=%s" % ROLES_CORE_PIN in html
    assert "academy_treehouse_core.js?v=%s" % ACADEMY_CORE_PIN in html
    for core in EDITED_CORES:
        pin = "%s?v=%s" % (core, OWN_RELEASE_PIN)
        assert pin in html, core
        assert "'./%s'" % pin in sw, core
        # No copy of the core is left behind on an older pin.
        stale = [m for m in re.findall(re.escape(core) + r"\?v=([A-Za-z0-9.-]+)", html + sw)
                 if m != OWN_RELEASE_PIN]
        assert not stale, (core, stale)
