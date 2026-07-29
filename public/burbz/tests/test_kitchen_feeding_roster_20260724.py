"""Kitchen companion feeding roster: assign the right food to the right bird.

The Kitchen stops being a room birds lodge or wander in and becomes the
feeding table: a scrollable roster of Merlin plus every recruited companion,
each showing its hunger level, what it really eats, and a per-bird food tray
drawn from the Academy pantry and the Stores larder. Feeding goes through the
idempotent source-backed feeding transaction — the right food fills the bird,
the wrong food is refused without wasting stock, and that refusal is the
lesson. A bird with no suitable food in the kitchen goes hungry, and a hungry
bird turns less active: quests and training lock at urgent hunger. Food is
bought in liberated village markets or brought back from quests and forage.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def run_node(script: str) -> dict:
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# The Kitchen is a feeding table, not a roost: no birds walk the room
# ---------------------------------------------------------------------------

def test_no_birds_are_stationed_or_walking_in_the_kitchen():
    html = HTML.read_text(encoding="utf-8")
    # One-time migration moves any kitchen-stationed companions back outdoors.
    assert "kitchenFeedingTableVersion" in html
    assert "if (bird && bird.academy && bird.academy.room === 'kitchen') bird.academy.room = 'outdoors';" in html
    # Birds can never be moved into the Kitchen again.
    move = function_source(html, "academyMoveBird")
    assert "room === 'kitchen'" in move
    buttons = function_source(html, "academyRoomButtonsHTML")
    assert "room !== 'tavern' && room !== 'kitchen'" in buttons
    # Kitchen drills (Pantry Gauntlet) train FROM the Gardens.
    training = function_source(html, "startBirdTrainingSession")
    assert "tplRoom === 'kitchen' ? 'outdoors' : tplRoom" in training
    # The passive stationing perk is gone: no kitchen stat-room entry.
    effects = html[html.index("const ACADEMY_ROOM_STAT_EFFECTS = {"):html.index("const ACADEMY_STAT_MINUTES")]
    assert "kitchen:" not in effects.replace("// No kitchen entry", "")
    # The room interior shows no "Add a bird to this room" panel for the Kitchen.
    render = function_source(html, "renderAcademyRoomInterior")
    assert "const roomAddPanel = room === 'kitchen' ? ''" in render
    # The shared sprite stage expression survives for every other room.
    assert "birds.map((bird, index) => roomBirdSpriteHTML(bird, index, room)).join('')" in render


# ---------------------------------------------------------------------------
# The scrollable companion roster is wired into the Kitchen screen
# ---------------------------------------------------------------------------

def test_feeding_roster_is_wired_into_the_kitchen_panel():
    html = HTML.read_text(encoding="utf-8")
    for marker in (
        "function kitchenRosterEntries(",
        "function kitchenRosterFoodOptions(",
        "function kitchenRosterFeed(",
        "function burbzFeedFood(",
        "function burbzFeedTap(",
        "function renderKitchenRosterHTML(",
        'data-kitchen-roster-root="academy-kitchen"',
        'data-kitchen-supply="stocked"',
        'data-kitchen-supply="empty"',
        'data-kitchen-activity="blocked"',
        "kitchenRosterToggleTray,",
        "kitchenRosterFeed,",
        ".kitchen-roster-list {",
        ".kitchen-roster-row {",
    ):
        assert marker in html, marker
    # The roster leads the Kitchen panel, above the Prep Counter mini-game.
    panel = function_source(html, "renderKitchenPanelHTML")
    assert "renderKitchenRosterHTML()" in panel
    # The scrollable list scrolls inside its own container.
    assert "overflow-y:auto" in html[html.index(".kitchen-roster-list {"):html.index(".kitchen-roster-row {")]
    # No-food copy teaches where food comes from.
    roster_src = html[html.index("function kitchenRosterEntries("):html.index("function kitchenRosterFeed(")]
    assert "No food in the kitchen for this bird" in roster_src
    assert "village market" in roster_src
    # Hunger consequence copy ties food to activity.
    assert "quests and training are locked until this bird is fed" in roster_src


# ---------------------------------------------------------------------------
# Behaviour: right food feeds, wrong food teaches, empty kitchen warns
# ---------------------------------------------------------------------------

NODE_HARNESS = r"""
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
function fnSrc(name) {
  const start = html.indexOf('function ' + name + '(');
  if (start < 0) throw new Error('missing ' + name);
  let i = html.indexOf('{', start), depth = 0;
  for (; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) break; }
  }
  return html.slice(start, i + 1);
}
global.window = global;
require('./kitchen_pantry_core.js');
require('./bird_diet_hunger_core.js');
const toasts = [];
global.showToast = m => toasts.push(m);
global.SFX = { tap(){}, capture(){}, victory(){} };
global.vibrate = () => {};
global.saveState = () => {};
global.renderAcademyRoomInterior = () => {};
global.renderPetCompanion = () => {};
global.renderAcademy = () => {};
global.updateQuestProgress = () => {};
global.escapeHtml = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
global.birdOnlyImgHTML = () => '<span class="kitchen-roster-art">🐦</span>';
global.birdDisplayName = b => (b && (b.customName || b.commonName || b.species)) || 'Bird';
global.canonicalSpeciesName = n => String(n || '');
global.hungerBarHTML = status => '<div data-fullness="' + Math.round(100 - status.hunger) + '"></div>';
global.birdHasActiveExpedition = () => false;
global.birdHasActiveTraining = () => false;
global.academyBirdById = id => gameState.flock.find(b => b.id === id) || null;
global.ensureBirdAcademy = b => {
  b.academy = b.academy || { room:'outdoors' };
  b.training = b.training || { feedCount:0, trainCount:0 };
  b.care = b.care || { hunger:20, happiness:80 };
};
global.getMerlinCare = () => gameState.merlinCare;
global.MERLIN_CORE = { grantMerlinBondXp: c => c, sanitizeMerlinCare: c => c };
global.inferBirdDiet = () => ({ pref:['fish'], ok:[], avoid:[], fact:'Ospreys eat almost nothing but live fish.' });
global.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
global.dietHungerCore = () => global.BurbzDietHungerCore;
global.kitchenCore = () => global.BurbzKitchenCore;
global.levelUpBird = () => 0;
global.recalcBirdPower = () => {};
global.applyPlayerXpState = () => {};
global.addCoins = () => {};
global.speciesKey = n => String(n || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
global.discoveredSpeciesRecords = () => [];
global.createBirdFromDiscovery = () => null;
global.RARITY_RECRUIT_COST = { common:150 };
global.renderBirdex = () => {};
global.updateHeader = () => {};
global.playFeedDopamineBurst = () => {};
global.recordFeedReceipt = () => {};
global.showFeedNotePopup = () => {};
global.refreshFeedSurfaces = () => {};
global.feedSheetKey = null;
global.hungerStatusForBird = b => global.BurbzDietHungerCore.hungerStatusForCare(b.care, Date.now());
global.FOODS = { seeds:{label:'Seeds',emoji:'🌾',desc:''}, fish:{label:'Fish',emoji:'🐟',desc:''} };
global.DEFAULT_PANTRY = { seeds:6, fish:3 };
global.PANTRY_CAP = { seeds:10, fish:6 };
global.kitchenIngredientById = id => global.BurbzKitchenCore.ingredientById(id);
global.kitchenDietCore = () => global.BurbzDietHungerCore;
global.gameState = {
  flock: [{ id:'b1', species:'Osprey', commonName:'Osprey', scientificName:'Pandion haliaetus',
            academy:{ room:'outdoors' },
            care:{ hunger:80, happiness:60, hungerTransactions:[], hungerTransactionLog:[] } }],
  merlinCare: { hunger:50, happiness:80, hungerTransactions:[], hungerTransactionLog:[] },
  player: { mealsServed:0, coins:0 },
  pantry: { seeds:4, fish:2 },
  pantryLastRefill: new Date().toISOString(),
  kitchenLegacySupplyMigrationVersion: 1,
  inventory: { larder: { live_minnow:1, sunflower_seeds:2, gizzard_grit:3 } }
};
let code = 'let kitchenRosterTrayKey = null;\n';
code += html.slice(html.indexOf('const FEED_MEAL_REWARDS = Object.freeze({'),
                   html.indexOf('});', html.indexOf('const FEED_MEAL_REWARDS = Object.freeze({')) + 3) + '\n';
for (const n of ['legacyKitchenSupplyIngredient','refillPantry','ensureLarder','feedOptionVerdict','feedRewardsForVerdict','kitchenRosterEntries',
                 'kitchenRosterEntryByKey','kitchenRosterWantedPrep','kitchenRosterFoodOptions',
                 'kitchenRosterEatsLabels','kitchenRosterHungerStatus','kitchenRosterTrayHTML',
                 'kitchenRosterRowHTML','birdIsFull','kitchenRosterHungryEntries','renderKitchenRosterHTML','kitchenRosterToggleTray',
                 'kitchenRosterRefusalToast','feedEntryForKey','feedWildEntryForSpeciesKey',
                 'feedFoodOptions','feedArtHTML','kitchenRecordFieldNote','burbzFeedFood','feedWildSpecies',
                 'kitchenRosterFeed']) code += fnSrc(n) + '\n';
code += 'module.exports = { kitchenRosterEntries, kitchenRosterFoodOptions, kitchenRosterEntryByKey, kitchenRosterFeed, renderKitchenRosterHTML };';
const mod = { exports: {} };
new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
const R = mod.exports;
const out = {};
const entries = R.kitchenRosterEntries();
out.rosterKeys = entries.map(e => e.key);
const opts = R.kitchenRosterFoodOptions(R.kitchenRosterEntryByKey('b1'));
out.fishAccepted = !!opts.find(o => o.kind === 'pantry' && o.id === 'fish' && o.accepted);
out.seedsListedNotAccepted = !!opts.find(o => o.kind === 'pantry' && o.id === 'seeds' && !o.accepted);
out.minnowPrep = (opts.find(o => o.id === 'live_minnow') || {}).prep || null;
out.gritHidden = !opts.some(o => o.id === 'gizzard_grit');
const seedsBefore = gameState.pantry.seeds;
R.kitchenRosterFeed('b1', 'pantry', 'seeds');
out.refusedSpendsNothing = gameState.pantry.seeds === seedsBefore && gameState.flock[0].care.hunger === 80;
out.refusalToast = toasts[toasts.length - 1] || '';
R.kitchenRosterFeed('b1', 'larder', 'live_minnow');
out.fedConsumesStock = gameState.inventory.larder.live_minnow === 0;
out.hungerAfterMeal = gameState.flock[0].care.hunger;
gameState.flock[0].care.hunger = 90;
out.stockedHtmlHasBlock = R.renderKitchenRosterHTML().includes('data-kitchen-activity="blocked"');
gameState.pantry = { seeds:4, fish:0 };
gameState.inventory.larder = { sunflower_seeds:2 };
const emptyHtml = R.renderKitchenRosterHTML();
out.emptySupplyFlagged = emptyHtml.includes('data-kitchen-supply="empty"');
out.emptyCopyPresent = emptyHtml.includes('No food in the kitchen for this bird');
console.log(JSON.stringify(out));
"""


def test_roster_feeds_right_food_refuses_wrong_food_and_flags_empty_kitchen():
    out = run_node(NODE_HARNESS)
    assert out["rosterKeys"] == ["merlin", "b1"]
    assert out["fishAccepted"] is True
    assert out["seedsListedNotAccepted"] is True
    assert out["minnowPrep"] == "live"
    assert out["gritHidden"] is True
    assert out["refusedSpendsNothing"] is True
    assert "turns its beak up" in out["refusalToast"]
    assert out["fedConsumesStock"] is True
    assert out["hungerAfterMeal"] < 80
    assert out["stockedHtmlHasBlock"] is True
    assert out["emptySupplyFlagged"] is True
    assert out["emptyCopyPresent"] is True
