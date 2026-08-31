"""The Stores market, and the Project Manager's nameplate.

Yaan's two asks on 2026-08-20, pinned as `stores-market-project-manager-v295`:

1. **Selling.** Anything on the Royal Stores shelves can be turned into
   coins. Crafted gear is the real money — priced by rarity, a legendary
   piece beats its own forge bill. Raw materials fetch a modest price by
   rarity, and the small found things — a pile of berries, a heap of
   sticks, a keepsake — go for pocket change. Every stockroom card carries
   SELL buttons; equipped gear left the bag when it was worn, so only
   spare stock is ever on sale.
2. **The nameplate.** The village post is the PROJECT MANAGER now, not the
   Steward — the drawer, the Town section and the income line all say so.
   Grander civic titles (Lord Mayors for towns, Councillors for counties)
   come later; the role id stays `steward` so old saves keep their bird.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
LOOT_CORE = ROOT / "loot_crafting_core.js"
ROLES_CORE = ROOT / "bird_roles_core.js"
RELEASE = "stores-market-project-manager-v295-20260820"
# roost-retired-v302 moved the roles core on; the loot core stays with v295.
CURRENT_BUILD = "feeding-menu-banked-coins-v337-20260831"
# magpie-market-v316 edited both cores, so both ship under that tag now.
MAGPIE_CORE_PIN = "magpie-market-v316-20260824"
# bird_roles_core.js last changed in free-birds-v318, which retired the Head
# Gardener. A core ships under the tag of the release that last touched it.
ROLES_CORE_PIN = "manager-builds-the-village-v324-20260825"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def run_core(expression: str) -> dict:
    return run_node(f"const core=require({json.dumps(str(LOOT_CORE))}); console.log(JSON.stringify({expression}));")


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


# ---------------------------------------------------------------------------
# 1. Core maths: what the traders pay
# ---------------------------------------------------------------------------

def test_prices_climb_with_rarity_and_gear_always_beats_raw_materials():
    out = run_core("{ prices: core.SELL_PRICES, order: core.RARITY_ORDER }")
    prices, order = out["prices"], out["order"]
    for kind in ("material", "gear"):
        ladder = [prices[kind][r] for r in order]
        assert ladder == sorted(ladder) and len(set(ladder)) == len(ladder), kind
    for rarity in order:
        assert prices["gear"][rarity] > prices["material"][rarity]
    # The small stuff is pocket change: berries and sticks money.
    assert prices["food"] <= 3 and prices["keepsake"] <= 5
    # A legendary craft beats its own forge bill — selling the best is worth it.
    craft = run_core("core.CRAFT_COST_BY_RARITY")
    assert prices["gear"]["legendary"] > craft["legendary"]["coins"]


def test_sell_quote_clamps_to_stock_and_prices_unknown_kinds_at_zero():
    out = run_core(
        "{ clamp: core.sellQuote('material','common', 3, 99),"
        " none: core.sellQuote('material','common', 0, 1),"
        " junkKind: core.sellQuote('mystery','common', 5, 5),"
        " junkRarity: core.sellQuote('gear','mythic', 5, 5),"
        " food: core.sellQuote('food', null, 4, 4) }"
    )
    assert out["clamp"] == {"each": 2, "qty": 3, "total": 6}
    assert out["none"]["qty"] == 0 and out["none"]["total"] == 0
    assert out["junkKind"]["each"] == 0 and out["junkRarity"]["each"] == 0
    assert out["food"] == {"each": 2, "qty": 4, "total": 8}


# ---------------------------------------------------------------------------
# 2. index.html wiring: the SELL buttons reach the real shelves
# ---------------------------------------------------------------------------

def test_every_stockroom_card_carries_the_sell_row():
    html = HTML.read_text(encoding="utf-8")
    assert "storesSellRowHTML('material', m.id)" in function_source(html, "renderStoresMaterials")
    assert "storesSellRowHTML('food', ing.id)" in function_source(html, "renderStoresFood")
    assert "storesSellRowHTML('gear', item.id)" in function_source(html, "renderStoresArmoury")
    assert "storesSellRowHTML('keepsake', id)" in function_source(html, "renderStoresCurios")


def test_the_sell_handler_is_reachable_from_generated_onclick_html():
    html = HTML.read_text(encoding="utf-8")
    # The app is one IIFE: onclick handlers only work via the window bridge.
    exposed = next(line for line in html.splitlines() if "Object.assign(window, { academyBuildBuilding" in line)
    assert "storesSellItem" in exposed
    assert "sellItem: storesSellItem" in html  # …and the console/test hook


def sell_harness(probe: str) -> str:
    html = HTML.read_text(encoding="utf-8")
    functions = "\n".join(
        function_source(html, name)
        for name in ("storesSellRarity", "storesSellBag", "storesSellLabel", "storesSellQuote", "storesSellItem")
    )
    stubs = f"""
global.window = global;
const toasts = [];
const L = require({json.dumps(str(LOOT_CORE))});
const lootCore = () => L;
const gameState = {{ player: {{ coins: 100 }}, inventory: {{
  items: {{ oak_twig: 3, phoenix_ember: 1, lucky_pebble: 2 }},
  larder: {{ hedgerow_berries: 5 }},
  gear: {{}}
}} }};
const addCoins = n => {{ gameState.player.coins += n; }};
const saveState = () => {{}};
const updateHeader = () => {{}};
const renderInventory = () => {{}};
const showToast = t => toasts.push(t);
const SFX = {{ questComplete: () => {{}} }};
const vibrate = () => {{}};
const kitchenIngredientById = id => ({{ id, label: id }});
const inventoryLabel = id => id;
// Give the fixture one legendary spare in the gear bag, whatever its id.
const legendary = Object.values(L.GEAR).find(g => g.rarity === 'legendary').id;
gameState.inventory.gear[legendary] = 2;
"""
    return stubs + functions + "\n" + probe


def test_selling_moves_stock_into_coins_at_the_quoted_price():
    out = run_node(sell_harness("""
storesSellItem('material', 'oak_twig', 1);            // a stick from the pile: +2
storesSellItem('food', 'hedgerow_berries', 'all');    // the berry pile: 5 × 2 = +10
storesSellItem('keepsake', 'lucky_pebble', 1);        // an oddment: +5
const afterSmall = gameState.player.coins;
storesSellItem('gear', legendary, 'all');             // the big sale: 2 × 450 = +900
storesSellItem('gear', legendary, 1);                 // bag now empty — refused
console.log(JSON.stringify({
  afterSmall,
  coins: gameState.player.coins,
  items: gameState.inventory.items,
  larder: gameState.inventory.larder,
  gear: gameState.inventory.gear,
  toasts
}));
"""))
    assert out["afterSmall"] == 100 + 2 + 10 + 5
    assert out["coins"] == 117 + 900
    assert out["items"] == {"oak_twig": 2, "phoenix_ember": 1, "lucky_pebble": 1}
    assert out["larder"] == {}  # the berry pile went to market whole
    assert out["gear"] == {}    # both legendaries sold, stack removed cleanly
    assert any("for 900" in t for t in out["toasts"])
    assert any("nothing here to sell" in t for t in out["toasts"])  # the empty-bag refusal


# ---------------------------------------------------------------------------
# 3. The Project Manager's nameplate
# ---------------------------------------------------------------------------

def test_the_village_post_is_titled_project_manager_with_the_old_save_key():
    core = ROLES_CORE.read_text(encoding="utf-8")
    assert "title:'Project Manager'" in core
    assert "id:'steward', title:'Project Manager'" in core  # save-compat id kept
    assert "Councillors for counties come later" in core


def test_every_surface_wears_the_new_nameplate():
    html = HTML.read_text(encoding="utf-8")
    # The province drawer went with v319 and the card's head with v320, so the
    # nameplate is derived now rather than written: rolePostTitle asks
    # empirePostTitleFor, and every surface — badge, desk row, sheet head,
    # holder line — reads the same answer. empire-grid-v322's Lord Mayor
    # arrives through that one door instead of a per-caller override.
    assert "'PROJECT MANAGER'" not in html                   # the retired drawer
    assert "EMPIRE_POST_TITLES = { village:'Project Manager', town:'Lord Mayor'" in html
    assert "function rolePostTitle(scope, key, role)" in html
    assert "escapeHtml(prefix + title)" in html              # the desk row
    assert "title:EMPIRE_POST_TITLES.town" not in html       # no caller passes it
    assert "your Project Manager is raising it by" in html  # the income line
    assert "'STEWARD'" not in html                          # the old tab is gone


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
    # Each edited core ships under the tag of the release that last touched it.
    for core, pin in (("bird_roles_core.js", ROLES_CORE_PIN), ("loot_crafting_core.js", MAGPIE_CORE_PIN)):
        assert f"'./{core}?v={pin}'" in sw, core
        assert f'src="{core}?v={pin}"' in html, core
