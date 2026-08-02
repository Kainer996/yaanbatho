"""One-tap feeding, the food quests behind it, and Merlin's hungry flight.

Three things changed together.

1. A starving bird could be told it was "still full". Fullness was a one-hour
   wall-clock cooldown, so a Mistle Thrush sitting on 100/100 hunger was
   refused the berries it was starving for. Fullness is now the hunger bar and
   nothing else.
2. The add-ingredient tray is gone. There is no plate to assemble and no
   "Serve the tray" button: the player picks ONE food and it is served the
   moment it is tapped, the bird crosses to it, and a little XP and a dopamine
   burst land when it eats. Every feed surface — the Kitchen roster, the Prep
   Counter, a Birdex card, a Companions card — runs the same transaction.
3. Every food in the game has an expedition quest that brings it home, and
   Merlin alone keeps questing while hungry — at half speed — so the Kingdom
   can never deadlock on an empty larder.
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
# 1. The glitch: a starving bird is never "still full"
# ---------------------------------------------------------------------------

FEED_HARNESS = r"""
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
const bursts = [];
const notes = [];
global.showToast = m => toasts.push(m);
global.SFX = { tap(){}, capture(){}, victory(){} };
global.vibrate = () => {};
global.saveState = () => {};
global.escapeHtml = s => String(s == null ? '' : s);
global.clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
global.speciesKey = n => String(n || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
global.canonicalSpeciesName = n => String(n || '').split('(')[0].trim();
global.birdOnlyImgHTML = () => '<span class="art">B</span>';
global.birdDisplayName = b => (b && (b.commonName || b.species)) || 'Bird';
global.kitchenIngredientById = id => global.BurbzKitchenCore.ingredientById(id);
global.kitchenCore = () => global.BurbzKitchenCore;
global.kitchenDietCore = () => global.BurbzDietHungerCore;
global.dietHungerCore = () => global.BurbzDietHungerCore;
global.hungerStatusForBird = b => global.BurbzDietHungerCore.hungerStatusForCare(b && b.care, Date.now());
global.inferBirdDiet = () => ({ pref:['fruit_berries'], ok:[], avoid:[], fact:'Mistle Thrushes defend a berry tree all winter.' });
global.academyBirdById = id => gameState.flock.find(b => b.id === id) || null;
global.ensureBirdAcademy = b => {
  b.academy = b.academy || { room:'outdoors' };
  b.training = b.training || { feedCount:0, trainCount:0 };
};
global.getMerlinCare = () => gameState.merlinCare;
global.MERLIN_CORE = { grantMerlinBondXp: c => c, sanitizeMerlinCare: c => c };
global.birdHasActiveExpedition = () => false;
global.birdHasActiveTraining = () => false;
// No bird is posted as Head Chef in this harness, so the Kitchen runs at its
// unstaffed baseline of 1.0.
global.academyRoleMultiplier = () => 1;
global.refillPantry = () => {};
global.updateQuestProgress = () => {};
global.applyPlayerXpState = n => { gameState.player.xp += n; };
global.levelUpBird = (b, xp) => { b.xp = (b.xp || 0) + xp; };
global.recalcBirdPower = () => {};
global.addCoins = n => { gameState.player.coins += n; };
global.discoveredSpeciesRecords = () => Object.values(gameState.discoveredSpecies || {}).filter(Boolean);
global.createBirdFromDiscovery = () => null;
global.RARITY_RECRUIT_COST = { common:150, uncommon:400, rare:1000, epic:2500, legendary:6000 };
global.playFeedDopamineBurst = d => bursts.push(d);
global.refreshFeedSurfaces = () => {};
global.showFeedNotePopup = (t, b) => notes.push({ title:t, body:b });
global.feedSheetKey = null;
global.FOODS = { berries:{label:'Berries',emoji:'🫐',desc:''}, seeds:{label:'Seeds',emoji:'🌾',desc:''} };
global.gameState = {
  player: { coins:0, xp:0, mealsServed:0 },
  flock: [{
    id:'thrush', species:'Mistle Thrush', commonName:'Mistle Thrush', scientificName:'Turdus viscivorus',
    level:1, xp:0, maxHp:100, hp:100,
    academy:{ room:'outdoors', dietKnown:true }, training:{ feedCount:0, hpBonus:0 },
    // Starving, and fed only a minute ago — the exact state that used to be
    // reported as "still full".
    care:{ hunger:100, happiness:40, lastFed:new Date(Date.now() - 60 * 1000).toISOString(),
           hungerTransactions:[], hungerTransactionLog:[] }
  }],
  merlinCare:{ hunger:50, happiness:80, hungerTransactions:[], hungerTransactionLog:[] },
  pantry: {},
  dietBadges: {}, kitchenNotes: {},
  discoveredSpecies: { osprey:{ key:'osprey', species:'Osprey', commonName:'Osprey', rarity:'rare', recruitCost:1000 } },
  kitchenLegacySupplyMigrationVersion: 1,
  inventory:{ larder:{ hedgerow_berries:2, sunflower_seeds:1, live_minnow:2 } }
};
let code = 'let kitchenRosterTrayKey = null;\n';
const rewardsAt = html.indexOf('const FEED_MEAL_REWARDS = Object.freeze({');
code += html.slice(rewardsAt, html.indexOf('});', rewardsAt) + 3) + '\n';
for (const n of ['legacyKitchenSupplyIngredient','ensureLarder','addLarderIngredient','feedOptionVerdict',
                 'feedRewardsForVerdict','feedSideSnackExplainer','kitchenRosterEntries',
                 'kitchenRosterEntryByKey','kitchenRosterWantedPrep','kitchenRosterFoodOptions',
                 'kitchenRosterEatsLabels','kitchenRosterHungerStatus','kitchenRosterRefusalToast',
                 'feedEntryForKey','feedWildEntryForSpeciesKey','feedFoodOptions','kitchenRecordFieldNote',
                 'recordFeedReceipt','burbzFeedFood','feedWildSpecies','birdIsFull']) code += fnSrc(n) + '\n';
code += 'module.exports = { burbzFeedFood, feedFoodOptions, feedEntryForKey, birdIsFull };';
const mod = { exports: {} };
new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
const F = mod.exports;
const out = {};
// The feeding transaction clones state, so always re-read the live bird.
const thrush = () => gameState.flock.find(b => b.id === 'thrush');
out.starvingIsNotFull = F.birdIsFull(thrush()) === false;
F.burbzFeedFood('thrush', 'larder', 'hedgerow_berries');
out.toastAfterFeeding = toasts[toasts.length - 1] || '';
out.hungerAfterFeeding = thrush().care.hunger;
out.berriesSpent = gameState.inventory.larder.hedgerow_berries;
out.birdXpGained = thrush().xp;
out.trainerXpGained = gameState.player.xp;
out.burstCount = bursts.length;
out.burstHasTransactionId = !!(bursts[0] && bursts[0].transactionId);
out.burstRewardLine = (bursts[0] || {}).rewardLine || '';
out.receipt = gameState.lastFeedReceipt || null;
// A wrong food is refused, and nothing is spent for it.
F.burbzFeedFood('thrush', 'larder', 'live_minnow');
out.refusalToast = toasts[toasts.length - 1] || '';
out.minnowsUnspent = gameState.inventory.larder.live_minnow;
// Fill the bird right up, and only then is it actually full.
thrush().care.hunger = 0;
out.fullBirdIsFull = F.birdIsFull(thrush()) === true;
console.log(JSON.stringify(out));
"""


def test_a_starving_bird_is_fed_not_told_it_is_still_full():
    out = run_node(FEED_HARNESS)
    assert out["starvingIsNotFull"] is True
    assert "still full" not in out["toastAfterFeeding"].lower()
    assert "tucks into" in out["toastAfterFeeding"]
    assert out["hungerAfterFeeding"] < 100
    assert out["berriesSpent"] == 1
    assert out["fullBirdIsFull"] is True


def test_one_food_one_tap_pays_a_little_xp_and_flashes_the_dopamine_burst():
    out = run_node(FEED_HARNESS)
    assert out["birdXpGained"] > 0
    assert out["trainerXpGained"] > 0
    assert out["burstCount"] == 1
    assert out["burstHasTransactionId"] is True
    assert "XP" in out["burstRewardLine"]
    # The burst is gone in a second; the receipt is what the player reads back.
    assert out["receipt"]["transactionId"]
    assert out["receipt"]["foodLabel"] == "Hedgerow Berries"
    assert "XP" in out["receipt"]["rewardLine"]


def test_a_refused_food_is_never_wasted():
    out = run_node(FEED_HARNESS)
    assert "turns its beak up" in out["refusalToast"]
    assert out["minnowsUnspent"] == 2


def test_no_wall_clock_cooldown_gates_feeding_anywhere():
    html = HTML.read_text(encoding="utf-8")
    for name in ("academyFeedFood", "burbzFeedFood", "feedWildSpecies"):
        src = function_source(html, name)
        assert "academyCdLeft" not in src, name
    # Fullness is information, never a gate on a player-chosen meal.
    assert "disabled>🍽️ Full" not in html
    assert "const full = birdIsFull(b);" not in html
    assert "function birdIsFull(" in html


# ---------------------------------------------------------------------------
# 2. The tray is gone; Feed lives on the cards
# ---------------------------------------------------------------------------

def test_the_add_ingredient_tray_mechanic_is_gone_everywhere():
    html = HTML.read_text(encoding="utf-8")
    for gone in ("Add ingredient", "Serve the tray", "kitchenServeMeal", "kitchenAssignSlot", "kitchen-plate"):
        assert gone not in html, gone


def test_birdex_and_companion_cards_can_feed_the_bird():
    html = HTML.read_text(encoding="utf-8")
    companion_card = function_source(html, "createBirdCardHTML")
    known_card = function_source(html, "createKnownSpeciesCardHTML")
    # A recruited companion is fed straight off its card, front and back.
    assert companion_card.count('data-action="feed-bird"') == 2
    assert 'data-feed-key="${bird.id}"' in companion_card
    # A still-wild Birdex entry cannot be fed like a recruited companion.
    assert 'data-action="feed-bird"' not in known_card

    # The grid delegates the tap to the shared feed sheet.
    grid = function_source(html, "renderBirdex")
    assert 'e.target.closest(\'[data-action="feed-bird"]\')' in grid
    assert "openFeedSheet(feedBtn.dataset.feedKey)" in grid


def test_the_feed_sheet_serves_one_food_per_tap_and_flies_the_bird_to_it():
    html = HTML.read_text(encoding="utf-8")
    sheet = function_source(html, "renderFeedSheet")
    assert "feedFoodRowHTML(entry, option, reveal)" in sheet
    assert "burbzFeedTap(" in function_source(html, "feedFoodRowHTML")
    assert "Tap one food to serve it" in sheet
    fly = function_source(html, "feedFlyBirdToFood")
    assert "getBoundingClientRect" in fly
    assert "prefers-reduced-motion" in fly
    tap = function_source(html, "burbzFeedTap")
    # The bird arrives first; the meal and its reward land on arrival.
    assert tap.index("feedFlyBirdToFood") < tap.index("burbzFeedFood")


# ---------------------------------------------------------------------------
# 3. A quest for every food, and Merlin's hungry flight
# ---------------------------------------------------------------------------

def test_every_food_in_the_game_has_a_quest_that_brings_it_home():
    out = run_node(
        "global.window = global;"
        "const A = require('./academy_treehouse_core.js');"
        "const K = require('./kitchen_pantry_core.js');"
        "const legacy = { seed_satchel:'sunflower_seeds', worm_tin:'garden_worms', berry_bundle:'hedgerow_berries' };"
        "const covered = new Set();"
        "A.getQuestTemplates().forEach(t => t.items.forEach(id => { covered.add(id); if (legacy[id]) covered.add(legacy[id]); }));"
        "const missing = Object.keys(K.INGREDIENTS).filter(id => !covered.has(id));"
        "const starterOnly = A.getQuestTemplates().filter(t => t.items.some(id => K.ingredientById(id)) && t.starter !== true).map(t => t.id);"
        "console.log(JSON.stringify({ missing, starterOnly }));"
    )
    assert out["missing"] == [], out["missing"]
    # Food quests are all starter errands: food is never gated behind a build.
    assert set(out["starterOnly"]) <= {"short_forage", "supply_run", "timber_haul", "moon_scout", "envoy_parley"}


def test_the_new_food_quests_are_named_on_the_quest_board():
    html = HTML.read_text(encoding="utf-8")
    for quest_id in (
        "berry_run", "orchard_round", "worm_dig", "mast_gather", "midge_chase",
        "bark_grub_round", "shore_scavenge", "sandeel_run", "nectar_round", "pond_graze",
    ):
        assert quest_id + ":" in html, quest_id


def test_merlin_keeps_questing_while_hungry_at_double_the_time():
    out = run_node(
        "global.window = global;"
        "const A = require('./academy_treehouse_core.js');"
        "const bird = { id:'merlin-guide', commonName:'Merlin', power:80, int:55, spd:85, stamina:48, cha:72 };"
        "const fed = A.createBirdExpedition(bird, 'berry_run', 1000);"
        "const hungry = A.createBirdExpedition(bird, 'berry_run', 1000, { slowFactor:2 });"
        "console.log(JSON.stringify({"
        "  fedMs: fed.endMs - fed.startMs, hungryMs: hungry.endMs - hungry.startMs,"
        "  fedFlag: !!fed.hungryFlight, hungryFlag: !!hungry.hungryFlight,"
        "  sameRewards: JSON.stringify(fed.rewards) === JSON.stringify(hungry.rewards) }));"
    )
    assert out["hungryMs"] == out["fedMs"] * 2
    assert out["fedFlag"] is False
    assert out["hungryFlag"] is True
    # Flying hungry costs him time, not payout.
    assert out["sameRewards"] is True


def test_only_merlin_is_allowed_to_fly_hungry():
    html = HTML.read_text(encoding="utf-8")
    readiness = function_source(html, "birdWorkReadiness")
    assert "isMerlinCompanion(bird)" in readiness
    assert "'expedition'" in readiness
    assert "slowFactor:2" in readiness
    # Training stays locked for everyone, Merlin included: only errands run on.
    assert "String(activityType || '') === 'expedition'" in readiness
    start = function_source(html, "startBirdExpedition")
    assert "merlinExpeditionSlowFactor()" in start
    assert "twice as long" in start


# ---------------------------------------------------------------------------
# 4. Side foods are served at half, fed birds leave the counter, and the
#    counter shows the hunger it is there to fill
# ---------------------------------------------------------------------------

SIDE_SNACK_HARNESS = FEED_HARNESS.replace(
    "out.fullBirdIsFull = F.birdIsFull(thrush()) === true;",
    """out.fullBirdIsFull = F.birdIsFull(thrush()) === true;
// A Woodpigeon eats leafy plants; seeds are a real but secondary food for it.
gameState.flock.push({ id:'pigeon', species:'Woodpigeon', commonName:'Woodpigeon', scientificName:'Columba palumbus',
  level:1, xp:0, maxHp:100, hp:100, academy:{ room:'outdoors', dietKnown:true }, training:{ feedCount:0, hpBonus:0 },
  care:{ hunger:80, happiness:50, hungerTransactions:[], hungerTransactionLog:[] } });
gameState.inventory.larder.sunflower_seeds = 4;
const pigeon = () => gameState.flock.find(b => b.id === 'pigeon');
const seedOption = F.feedFoodOptions(F.feedEntryForKey('pigeon')).find(o => o.id === 'sunflower_seeds');
out.seedsAccepted = !!(seedOption && seedOption.accepted);
out.seedsAreSideSnack = !!(seedOption && seedOption.sideSnack);
out.seedsAreNotMain = !(seedOption && seedOption.main);
const pigeonBefore = pigeon().care.hunger;
F.burbzFeedFood('pigeon', 'larder', 'sunflower_seeds');
out.pigeonFed = pigeonBefore - pigeon().care.hunger;
out.pigeonXp = pigeon().xp;
out.seedsSpent = 4 - gameState.inventory.larder.sunflower_seeds;
out.sideSnackNote = notes[notes.length - 1] || null;
out.sideSnackBurst = bursts[bursts.length - 1] || null;
"""
)


def test_a_secondary_food_is_served_at_half_instead_of_refused():
    out = run_node(SIDE_SNACK_HARNESS)
    assert out["seedsAccepted"] is True, "seeds must be servable to a Woodpigeon"
    assert out["seedsAreSideSnack"] is True
    assert out["seedsAreNotMain"] is True
    assert out["seedsSpent"] == 1
    # A secondary meal moves an 80-hunger bird to the halfway point.
    assert out["pigeonFed"] == 30
    # And half the bird XP a main meal pays.
    assert out["pigeonXp"] == round(6 / 2)


def test_the_player_is_told_why_a_side_food_only_counted_half():
    out = run_node(SIDE_SNACK_HARNESS)
    note = out["sideSnackNote"]
    assert note, "a side food must explain itself"
    assert "side" in note["title"].lower()
    body = note["body"].lower()
    assert "fills the fullness bar halfway" in body and "half the xp" in body
    assert "woodpigeon" in body
    # The burst says it too, at a glance.
    assert "SIDE SNACK" in out["sideSnackBurst"]["badge"]


def test_half_is_derived_from_the_main_meal_not_typed_out_twice():
    html = HTML.read_text(encoding="utf-8")
    rewards = function_source(html, "feedRewardsForVerdict")
    # Half is still computed from the main-meal table (the Head Chef multiplier
    # rides on top of both the whole and the half, so it cannot make them drift).
    assert "Number(value) / 2" in rewards
    assert "FEED_MEAL_REWARDS.primary" in rewards
    # The hunger half lives in the diet core, as one number.
    core = (ROOT / "bird_diet_hunger_core.js").read_text(encoding="utf-8")
    assert "const SECONDARY_MEAL_FRACTION = 0.5;" in core
    assert "SECONDARY_MEAL_FRACTION" in core.split("verdict: record.matchMethod")[1][:400]


def test_only_companions_use_the_feeding_surface():
    html = HTML.read_text(encoding="utf-8")
    # Full companions remain in the upper feeding table for optional top-ups.
    assert "kitchenRosterEntriesForFeeding()" in function_source(html, "renderKitchenRosterHTML")
    panel = function_source(html, "renderKitchenPanelHTML")
    assert "return renderKitchenRosterHTML();" in panel
    assert "kitchenPrepCounterChoices" not in panel
    assert 'data-kitchen-pantry-root="academy-kitchen"' not in panel
    # The companion table still explains the genuinely empty-roster state.
    assert 'data-kitchen-all-fed="1"' in html


def test_the_companion_table_shows_fullness_it_is_there_to_fill():
    html = HTML.read_text(encoding="utf-8")
    row = function_source(html, "kitchenRosterRowHTML")
    assert "hungerBarHTML(status, 'kitchen-roster')" in row
    metre = function_source(html, "hungerBarHTML")
    assert 'data-hunger-surface="' in metre
    assert "Fullness" in metre
    assert "data-fullness" in metre
