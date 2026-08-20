"""Building discovery: a settlement's shops hide until found on a real walk.

building_discovery_core.js keeps the ledger. Every village still rolls its
trades from its seed, but none of them stands in the village square, on a
town square, or behind a tappable door until the player uncovers it on a
real-life walking quest through that settlement's land. Each waymarker
reached within a village's reach opens one more of its doors — the general
store first. Player-raised builds (the farm, the well, the Alehouse) are
never gated: what you build yourself needs no finding.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
STORY_PATH = ROOT / "STORY.md"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "building-discovery-v284-20260819"
PREVIOUS_RELEASE_PIN = "offroad-side-quests-v283-20260818"
CURRENT_BUILD = "generated-ui-art-v298-20260820"


def run_node(script: str):
    run = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert run.returncode == 0, run.stderr
    return json.loads(run.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def test_core_heals_state_and_reveals_trades_in_settlement_order():
    out = run_node("""
const B = require('./building_discovery_core.js');
const dirty = {
  '7': ['tavern', 'tavern', 'moneylender', 'general'],
  'not-a-seed': ['general'],
  '9': 'tavern',
  '11': []
};
const clean = B.sanitizeShopDiscoveries(dirty);
const all = ['general', 'smith', 'tavern', 'guild'];
console.log(JSON.stringify({
  constants: [B.SHOP_TRADE_KEYS, B.SHOP_DISCOVERY_RANGE_M],
  clean,
  none: B.discoveredShopKeys({}, 7, all),
  someInOrder: B.discoveredShopKeys(clean, 7, all),
  next: B.nextShopDiscovery(clean, 7, all),
  nextFresh: B.nextShopDiscovery({}, 21, all),
  progress: B.shopDiscoveryProgress(clean, 7, all)
}));
""")
    assert out["constants"] == [["general", "potion", "smith", "tavern", "guild"], 1200]
    # Junk seeds, junk keys, junk shapes and duplicates all wash out.
    assert out["clean"] == {"7": ["tavern", "general"]}
    assert out["none"] == []
    # Found trades come back in the SETTLEMENT'S order, not discovery order.
    assert out["someInOrder"] == ["general", "tavern"]
    # The next find is the first undiscovered door; a fresh village starts
    # with the guaranteed general store.
    assert out["next"] == "smith"
    assert out["nextFresh"] == "general"
    assert out["progress"] == {"found": 2, "total": 4}


def test_core_records_once_and_deals_the_town_shopfront_from_found_trades():
    out = run_node("""
const B = require('./building_discovery_core.js');
const state = {};
console.log(JSON.stringify({
  first: B.recordShopDiscovery(state, 7, 'general'),
  repeat: B.recordShopDiscovery(state, 7, 'general'),
  junkKey: B.recordShopDiscovery(state, 7, 'moneylender'),
  state,
  noneFound: B.townShopfrontKey([], 0.5),
  oneFound: B.townShopfrontKey(['tavern'], 0.99),
  dealt: B.townShopfrontKey(['general', 'smith', 'tavern'], 0.5),
  junkRoll: B.townShopfrontKey(['general'], NaN)
}));
""")
    assert out["first"] is True
    # A found door stays found — a second walk past writes nothing.
    assert out["repeat"] is False
    assert out["junkKey"] is False
    assert out["state"] == {"7": ["general"]}
    # A ward with nothing found keeps no shopfront on the town square.
    assert out["noneFound"] is None
    assert out["oneFound"] == "tavern"
    assert out["dealt"] == "smith"
    assert out["junkRoll"] == "general"


def test_walking_a_quest_uncovers_the_local_settlements_trades():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert f'<script src="building_discovery_core.js?v={OWN_RELEASE_PIN}"></script>' in html
    # The ledger lives on the empire state and is healed through the core.
    ensure = function_source(html, "ensureEmpireState")
    assert "gameState.empire.shopDiscoveries = {}" in ensure
    assert "sanitizeShopDiscoveries(empire.shopDiscoveries)" in function_source(html, "shopDiscoveryState")
    # Every ordered checkpoint reach on a real walk can uncover one trade.
    fix = function_source(html, "questOnPositionFix")
    assert "maybeDiscoverSettlementShop(lat, lon)" in fix
    assert "['npc', 'flag', 'chest', 'finish'].includes(ev.type)" in fix
    # The find binds to the settlement whose land the player stands in.
    discover = function_source(html, "maybeDiscoverSettlementShop")
    assert "nearestVillageTo(lat, lon)" in discover
    assert "mapDistanceMeters({ lat, lon }, near) > core.SHOP_DISCOVERY_RANGE_M" in discover
    assert "recordShopDiscovery(state, near.seed, next)" in discover
    assert "addPlayerXp(15)" in discover
    assert "saveState()" in discover


def test_village_scene_only_raises_found_trades_and_burns_every_draw():
    html = HTML_PATH.read_text(encoding="utf-8")
    scene = function_source(html, "buildVillageScene")
    # The full trade list still rolls from the seed; the found set gates it.
    assert "const shopKeys = villageShopKeysFor(v.seed);" in scene
    assert "const openShopKeys = new Set(discoveredVillageShopKeys(v.seed));" in scene
    # The flourish gate survives untouched.
    assert "if (ruinStage >= 2) shopKeys.forEach((k, i) => {" in scene
    # An undiscovered trade burns its rng draws and keeps its plot, so a new
    # find pops in without moving a single other building.
    assert "const discovered = openShopKeys.has(k);" in scene
    assert scene.count("if (discovered)") >= 3
    # A fresh discovery rebuilds the cached scene.
    assert "villageBuiltShopsKey = discoveredVillageShopKeys(v.seed).join('.')" in scene
    assert "villageBuiltShopsKey !== discoveredVillageShopKeys(v.seed).join('.')" in html
    # The 2D fallback square honours the same ledger, with an honest hint.
    fallback = function_source(html, "renderVillageFallback")
    assert "discoveredVillageShopKeys(currentVillage().seed)" in fallback
    assert "No trades found here yet" in fallback


def test_town_square_deals_its_shopfront_from_found_trades_only():
    html = HTML_PATH.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    # The trade die still burns while every shop waits to be found.
    assert "const tradeRoll = dr();" in scene
    assert "townShopfrontKey(discoveredVillageShopKeys(seed), tradeRoll)" in scene
    assert "if (tradeKey) {" in scene
    # A ward's new find rebuilds the cached square.
    assert "'#s' + discoveredVillageShopKeys(v.seed).join('.')" in function_source(html, "townSceneKey")


def test_doors_stay_shut_until_found_except_the_players_own_alehouse():
    html = HTML_PATH.read_text(encoding="utf-8")
    open_shop = function_source(html, "villageOpenShop")
    assert "villageShopIsOpenTo(shopVillage.seed, shopKey)" in open_shop
    assert "walk a quest in this land to discover it" in open_shop
    gate = function_source(html, "villageShopIsOpenTo")
    # What the player raises themselves needs no finding.
    assert "shopKey === 'tavern'" in gate
    assert "villageBuildingLevel(rec, 'tavern') > 0" in gate
    # The governor's desk says plainly what's found and what's still out.
    panel = function_source(html, "renderVillageManagePanel")
    assert "discoveredVillageShopKeys(rec.seed)" in panel
    assert "province-trades-line" in panel
    assert "No trades found yet" in panel


def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert sw.count(f"'./building_discovery_core.js?v={OWN_RELEASE_PIN}'") == 2
    updater = UPDATER_PATH.read_text(encoding="utf-8")
    assert '"building_discovery_core.js"' in updater
    story = STORY_PATH.read_text(encoding="utf-8")
    assert "trades hide" in story
