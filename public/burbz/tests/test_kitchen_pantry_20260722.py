"""Kitchen & Pantry: the Prep Counter cooking mini-game, and Bag → Stores.

The Kitchen & Pantry Academy room gains a real mechanic: raw bird food
(ingredients tagged with the game's diet families) flows into the Stores
larder from a new Fishing Trip expedition, map forage, quest claims and the
Seed & Sundry shop. At the Prep Counter the player composes a plate — up to
three slots of ingredient × preparation — for ANY Birdex species (recruited
companion or still-wild), and deterministic scoring teaches what the species
really eats and HOW it takes it in the wild: an Osprey only strikes LIVE
fish, finches husk dry seed, ducks dabble food floated on water, swifts feed
only on the wing, and gizzard grit pays a bonus alongside seed meals because
birds have no teeth. Field-Perfect meals earn Diet Badges shown in the
Birdex, feed companions properly, and build feeder trust that discounts a
wild species' recruit cost. The player-facing "Bag" is renamed "Stores".
"""
import json
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "kitchen_pantry_core.js"
ACADEMY_CORE = ROOT / "academy_treehouse_core.js"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def run_node(script: str) -> dict:
    # Windows limits the command line to roughly 32 KiB; some extracted
    # end-to-end harnesses are larger than that. A real temporary script is
    # portable and also avoids shell/argument quoting differences.
    with tempfile.NamedTemporaryFile(
        mode="w", suffix=".js", prefix="burbz-kitchen-test-",
        dir=ROOT, encoding="utf-8", delete=False,
    ) as handle:
        handle.write(script)
        script_path = Path(handle.name)
    try:
        result = subprocess.run(
            ["node", str(script_path)], cwd=ROOT, text=True, encoding="utf-8",
            capture_output=True, timeout=60,
        )
        assert result.returncode == 0, result.stderr
        return json.loads(result.stdout)
    finally:
        script_path.unlink(missing_ok=True)


def diet_rules_source() -> str:
    html = HTML.read_text(encoding="utf-8")
    return html[html.index("const BIRD_DIET_RULES = ["):html.index("// Player's pantry")]


# ---------------------------------------------------------------------------
# Bag → Stores rename
# ---------------------------------------------------------------------------

def test_bag_is_renamed_stores_everywhere_the_player_reads_it():
    html = HTML.read_text(encoding="utf-8")
    assert 'aria-label="Stores"' in html
    assert '<div class="nav-label">Stores</div>' in html
    assert "title:'Your Stores'" in html
    assert 'Stores empty ·' in html
    assert 'aria-label="Bag"' not in html
    assert '<div class="nav-label">Bag</div>' not in html
    assert "title:'Your Bag'" not in html
    assert "your Bag" not in html
    assert "Bag item:" not in html
    assert "Bag empty" not in html


# ---------------------------------------------------------------------------
# The cooking mini-game core
# ---------------------------------------------------------------------------

def test_osprey_style_specialist_only_scores_perfect_on_live_fish():
    out = run_node(
        "const K = require('./kitchen_pantry_core.js');"
        "const osprey = { pref:['fish'], ok:[], avoid:['seeds','berries','fruit','aquatic','suet','acorns'], prep:{fish:'live'}, fact:'live fish only' };"
        "const live = K.scoreMeal(osprey, [{ingredientId:'live_minnow', prep:'live'}, {ingredientId:'river_trout', prep:'live'}]);"
        "const still = K.scoreMeal(osprey, [{ingredientId:'live_minnow', prep:'fresh'}]);"
        "const seeds = K.scoreMeal(osprey, [{ingredientId:'sunflower_seeds', prep:'husked'}]);"
        "console.log(JSON.stringify({live, still, seeds}));"
    )
    assert out["live"]["tier"] == "field_perfect"
    assert all(s["verdict"] == "perfect" for s in out["live"]["slots"])
    assert out["still"]["slots"][0]["verdict"] == "close"
    assert "living fish" in out["still"]["slots"][0]["note"]
    assert out["seeds"]["tier"] == "refused"
    assert out["seeds"]["slots"][0]["verdict"] == "refused"
    assert out["seeds"]["slots"][0]["note"] == "live fish only"


def test_finch_seed_husking_duck_floating_and_swift_wing_feeding_rules():
    out = run_node(
        "const K = require('./kitchen_pantry_core.js');"
        "const finch = { pref:['seeds'], ok:['berries','insects'], avoid:['fish'], prep:{seeds:'husked'}, fact:'husk seeds' };"
        "const duck = { pref:['aquatic'], ok:['seeds'], avoid:['meat','fish','suet'], prep:{aquatic:'floating'}, fact:'no bread' };"
        "const swift = { pref:['flying'], ok:['insects'], avoid:['seeds','suet','fish','meat','berries','aquatic'], prep:{flying:'tossed'}, fact:'on the wing' };"
        "const husked = K.scoreMeal(finch, [{ingredientId:'sunflower_seeds', prep:'husked'}, {ingredientId:'hedgerow_berries', prep:'fresh'}]);"
        "const wrongPrep = K.scoreMeal(finch, [{ingredientId:'sunflower_seeds', prep:'fresh'}]);"
        "const pond = K.scoreMeal(duck, [{ingredientId:'pondweed_tangle', prep:'floating'}, {ingredientId:'pondweed_tangle', prep:'floating'}]);"
        "const midges = K.scoreMeal(swift, [{ingredientId:'aerial_midges', prep:'tossed'}, {ingredientId:'aerial_midges', prep:'tossed'}]);"
        "const table = K.scoreMeal(swift, [{ingredientId:'sunflower_seeds', prep:'husked'}]);"
        "console.log(JSON.stringify({husked, wrongPrep, pond, midges, table}));"
    )
    assert out["husked"]["slots"][0]["verdict"] == "perfect"
    assert out["husked"]["slots"][1]["verdict"] == "nibbled"
    assert out["husked"]["tier"] == "hearty"
    assert out["wrongPrep"]["slots"][0]["verdict"] == "close"
    assert out["pond"]["tier"] == "field_perfect"
    assert out["midges"]["tier"] == "field_perfect"
    assert out["table"]["tier"] == "refused"


def test_gizzard_grit_only_pays_alongside_seed_type_meals():
    out = run_node(
        "const K = require('./kitchen_pantry_core.js');"
        "const finch = { pref:['seeds'], ok:[], avoid:[], prep:{seeds:'husked'}, fact:'' };"
        "const owl = { pref:['meat'], ok:[], avoid:['seeds'], prep:{meat:'live'}, fact:'live prey' };"
        "const withSeeds = K.scoreMeal(finch, [{ingredientId:'sunflower_seeds', prep:'husked'}, {ingredientId:'gizzard_grit', prep:'fresh'}]);"
        "const withMeat = K.scoreMeal(owl, [{ingredientId:'field_vole', prep:'live'}, {ingredientId:'gizzard_grit', prep:'fresh'}]);"
        "console.log(JSON.stringify({withSeeds, withMeat}));"
    )
    grit_rows = [s for s in out["withSeeds"]["slots"] if s["family"] == "grit"]
    assert grit_rows[0]["verdict"] == "gizzard" and grit_rows[0]["points"] == 1
    assert "no teeth" in grit_rows[0]["note"]
    wasted = [s for s in out["withMeat"]["slots"] if s["family"] == "grit"]
    assert wasted[0]["verdict"] == "wasted" and wasted[0]["points"] == 0


def test_feeder_trust_discount_compounds_to_a_floor():
    out = run_node(
        "const K = require('./kitchen_pantry_core.js');"
        "console.log(JSON.stringify({one:K.discountedRecruitCost(1000,1), many:K.discountedRecruitCost(1000,50), zero:K.discountedRecruitCost(1000,0)}));"
    )
    assert out["one"] == 850
    assert out["many"] == 400  # 40% floor
    assert out["zero"] == 1000


def test_every_ingredient_maps_to_a_real_diet_family_and_valid_preps():
    out = run_node(
        "const K = require('./kitchen_pantry_core.js');"
        "const families = ['seeds','suet','insects','worms','berries','fruit','fish','flying','meat','carrion','acorns','aquatic','grit'];"
        "const bad = K.listIngredients().filter(i => !families.includes(i.family) || !i.preps.length || i.preps.some(p => !K.prepById(p)));"
        "console.log(JSON.stringify({bad: bad.map(b => b.id), count: K.listIngredients().length}));"
    )
    assert out["bad"] == []
    assert out["count"] >= 14


# ---------------------------------------------------------------------------
# Real diet rules carry the wild serving behaviour
# ---------------------------------------------------------------------------

def test_real_diet_rules_teach_prep_behaviour_for_specialists():
    script = (
        diet_rules_source()
        + "function inferBirdDiet(n){ for (const r of BIRD_DIET_RULES) if (r.match.test(n)) return r; return null; }\n"
        "const osprey = inferBirdDiet('Osprey');"
        "const mallard = inferBirdDiet('Mallard');"
        "const chaffinch = inferBirdDiet('Chaffinch');"
        "const swift = inferBirdDiet('Swift');"
        "const kingfisher = inferBirdDiet('Kingfisher');"
        "const kestrel = inferBirdDiet('Kestrel');"
        "console.log(JSON.stringify({"
        "ospreyPref: osprey.pref, ospreyPrep: osprey.prep, "
        "mallardPrep: mallard.prep, chaffinchPrep: chaffinch.prep, "
        "swiftPrep: swift.prep, kingfisherPrep: kingfisher.prep, kestrelPrep: kestrel.prep}));"
    )
    out = run_node(script)
    assert out["ospreyPref"] == ["fish"]
    assert out["ospreyPrep"] == {"fish": "live"}
    assert out["mallardPrep"]["aquatic"] == "floating"
    assert out["chaffinchPrep"]["seeds"] == "husked"
    assert out["swiftPrep"]["flying"] == "tossed"
    assert out["kingfisherPrep"]["fish"] == "live"
    assert out["kestrelPrep"]["meat"] == "live"


# ---------------------------------------------------------------------------
# End-to-end serve flow with the real game functions
# ---------------------------------------------------------------------------

def test_serving_a_wild_osprey_live_fish_earns_badge_coins_and_recruit_trust():
    html = HTML.read_text(encoding="utf-8")
    stubs = """
global.window = global;
require('./kitchen_pantry_core.js');
require('./bird_diet_hunger_core.js');
const gameState = {
  inventory: { larder: { live_minnow: 3, sunflower_seeds: 2 } },
  dietBadges: {}, kitchenNotes: {}, flock: [],
  discoveredSpecies: { osprey: { key:'osprey', species:'Osprey', commonName:'Osprey', rarity:'rare', recruitCost:1000 } },
  player: { coins: 0, xp: 0, level: 1 }
};
const RARITY_RECRUIT_COST = { common:150, uncommon:400, rare:1000, epic:2500, legendary:6000 };
const FOODS = { seeds:{emoji:'x',label:'Seeds'}, fish:{emoji:'x',label:'Fish'} };
const coinsLog = []; const toasts = [];
const addCoins = n => { gameState.player.coins += n; coinsLog.push(n); };
const addPlayerXp = () => {};
const showToast = m => toasts.push(m);
const escapeHtml = s => String(s);
const saveState = () => {}; const updateHeader = () => {};
const renderAcademyRoomInterior = () => {}; const renderBirdex = () => {}; const renderPetCompanion = () => {};
const SFX = { tap(){}, victory(){} };
const clamp = (v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const levelUpBird = () => {}; const recalcBirdPower = () => {}; const updateQuestProgress = () => {};
const ensureBirdAcademy = b => { b.academy = b.academy || {}; b.care = b.care || {}; };
const academyCdLeft = () => 0;
const speciesKey = n => String(n||'').trim().toLowerCase().replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'');
const findSpeciesProfile = () => null;
const canonicalSpeciesName = n => String(n||'').split('(')[0].trim();
const companionForSpecies = () => null;
const discoveredSpeciesRecords = () => Object.values(gameState.discoveredSpecies || {}).filter(Boolean);
const kitchenShowResult = (chosen, rule, result) => { global.__lastResult = result; };
const hashStr = str => Array.from(String(str)).reduce((h, ch) => Math.abs(((h << 5) - h + ch.charCodeAt(0)) | 0), 0);
const $ = () => null;
const applyPlayerXpState = () => {};
const refillPantry = () => {};
// Unstaffed Kitchen: no Head Chef bonus in this harness.
const academyRoleMultiplier = () => 1;
const kitchenDietCore = () => global.BurbzDietHungerCore;
const dietHungerCore = () => global.BurbzDietHungerCore;
const kitchenRosterEntryByKey = () => null;
const kitchenRosterEatsLabels = () => ['Fish'];
const createBirdFromDiscovery = () => null;
const birdOnlyImgHTML = () => '<span class="art">B</span>';
const playFeedDopamineBurst = () => {};
const recordFeedReceipt = () => {};
const showFeedNotePopup = () => {};
const refreshFeedSurfaces = () => {};
const vibrate = () => {};
"""
    functions = "\n".join(function_source(html, name) for name in (
        "kitchenCore", "kitchenIngredientById", "legacyKitchenSupplyIngredient", "ensureLarder", "addLarderIngredient",
        "kitchenSpeciesChoices", "kitchenPrepCounterChoices", "kitchenPrepCounterSelectedChoice", "kitchenRecordFieldNote",
        "kitchenDietSubject", "kitchenDietRuleForChoice", "kitchenRosterWantedPrep",
        "feedOptionVerdict", "feedRewardsForVerdict", "feedSideSnackExplainer",
        "kitchenRosterFoodOptions", "kitchenRosterRefusalToast", "feedEntryForKey",
        "feedWildEntryForSpeciesKey", "feedFoodOptions", "feedWildSpecies", "burbzFeedFood",
    ))
    rules = diet_rules_source() + "\nfunction inferBirdDiet(n){ const name = typeof n === 'object' ? String(n.commonName || n.name || n.species || n.scientificName || '') : String(n || ''); for (const r of BIRD_DIET_RULES) if (r.match.test(name)) return r; return null; }\n"
    driver = """
// One food, one tap, one meal — no tray to assemble first.
burbzFeedFood('species:osprey', 'larder', 'live_minnow');
const first = { badges: {...gameState.dietBadges}, coins: gameState.player.coins,
  recruitCost: gameState.discoveredSpecies.osprey.recruitCost, larder: {...gameState.inventory.larder},
  notes: JSON.parse(JSON.stringify(gameState.kitchenNotes)) };
burbzFeedFood('species:osprey', 'larder', 'sunflower_seeds');
const second = { coins: gameState.player.coins, larder: {...gameState.inventory.larder},
  toast: toasts[toasts.length - 1] || '',
  notes: JSON.parse(JSON.stringify(gameState.kitchenNotes)) };
console.log(JSON.stringify({first, second}));
"""
    out = run_node(stubs + rules + functions + driver)
    assert out["first"]["badges"] == {"osprey": 1}
    assert out["first"]["coins"] == 32  # 12 meal coins + 20 first-badge bonus
    assert out["first"]["recruitCost"] == 850  # 15% feeder-trust discount
    assert out["first"]["larder"]["live_minnow"] == 2  # exactly one fish spent
    assert "fish" in out["first"]["notes"]["osprey"]["perfect"]
    # A wrong food is refused: no coins, and — the whole point — no stock spent.
    assert out["second"]["coins"] == 32
    assert out["second"]["larder"]["sunflower_seeds"] == 2
    assert "turns its beak up" in out["second"]["toast"]
    assert "seeds" in out["second"]["notes"]["osprey"]["refused"]


# ---------------------------------------------------------------------------
# Fishing quest and ingredient flow into the Stores larder
# ---------------------------------------------------------------------------

def test_fishing_trip_expedition_exists_and_yields_only_larder_ingredients():
    out = run_node(
        "global.window = global;"
        "const A = require('./academy_treehouse_core.js');"
        "const K = require('./kitchen_pantry_core.js');"
        "const t = A.getQuestTemplates().find(q => q.id === 'fishing_trip');"
        "const exp = A.createBirdExpedition({ id:'b1', commonName:'Heron', power:100, int:50, spd:50, stamina:50 }, 'fishing_trip', 1700000000000);"
        "console.log(JSON.stringify({template: t, rewardItems: Object.keys(exp.rewards.items), allLarder: Object.keys(exp.rewards.items).every(id => !!K.ingredientById(id))}));"
    )
    assert out["template"], "fishing_trip quest template is missing"
    assert out["template"]["icon"] == "🎣"
    assert set(out["template"]["items"]) == {"live_minnow", "river_trout", "pondweed_tangle"}
    assert out["allLarder"] is True


def test_claimed_expedition_ingredients_route_to_larder_not_misc_items():
    html = HTML.read_text(encoding="utf-8")
    claim = function_source(html, "claimBirdExpedition")
    assert "legacyKitchenSupplyIngredient(key) || key" in claim
    assert "kitchenIngredientById(larderKey)" in claim
    assert "addLarderIngredient(larderKey, count)" in claim
    assert "fishing_trip:" in html  # quest board blurb


def test_map_forage_and_shop_stock_feed_the_larder():
    html = HTML.read_text(encoding="utf-8")
    for marker in (
        "addLarderIngredient('garden_worms', 1)",
        "addLarderIngredient('acorn_handful', 1)",
        "addLarderIngredient('gizzard_grit', 1)",
        "addLarderIngredient('aerial_midges', 1)",
        "larder: 'live_minnow'",
        "larder: 'mealworm_scoop'",
        "if (item.larder) {",
    ):
        assert marker in html, marker


# ---------------------------------------------------------------------------
# UI wiring, migration, badges and the service worker
# ---------------------------------------------------------------------------

def test_companion_feeding_table_is_wired_into_the_kitchen_room():
    html = HTML.read_text(encoding="utf-8")
    for marker in (
        '<script src="kitchen_pantry_core.js?v=diet-hunger-release-20260723"></script>',
        "room === 'kitchen' ? renderKitchenPanelHTML()",
        "function renderKitchenPanelHTML(",
        "function renderKitchenRosterHTML(",
        "function burbzFeedTap(",
        'data-kitchen-roster-root="academy-kitchen"',
        'data-action="kitchen-roster-feed"',
        ".feed-food-list {",
        ".feed-food {",
    ):
        assert marker in html, marker
    panel = function_source(html, "renderKitchenPanelHTML")
    assert "Wild Bird Feeder" not in panel
    assert "data-kitchen-pantry-root" not in panel


def test_the_add_ingredient_tray_mechanic_is_gone():
    """Feeding is one food, one tap. No plate, no slots, no "Serve the tray"."""
    html = HTML.read_text(encoding="utf-8")
    for gone in (
        "function kitchenServeMeal(",
        "function kitchenOpenSlot(",
        "function kitchenAssignSlot(",
        "function kitchenClearSlot(",
        "Add ingredient",
        "Serve the tray",
        "kitchen-plate",
        "kitchen-slot",
    ):
        assert gone not in html, gone


def test_saves_migrate_larder_badges_and_notes_and_birdex_shows_diet_badges():
    html = HTML.read_text(encoding="utf-8")
    for marker in (
        "gameState.inventory.larder = (gameState.inventory.larder",
        "gameState.dietBadges = (gameState.dietBadges",
        "gameState.kitchenNotes = (gameState.kitchenNotes",
        "birdex-diet-badge",
        "Object.entries(gameState.dietBadges || {}).forEach(([key, count]) => { if (count > 0) seen.add(key); });",
    ):
        assert marker in html, marker
    # Feeder-trust discounts must survive re-sightings and reach the recruit price.
    assert "Math.min(recruitCostForBird(bird), Number(existing && existing.recruitCost) || Infinity)" in html
    assert "if (record && Number(record.recruitCost) > 0) trusted = Math.min(fullCost, Number(record.recruitCost));" in html


def test_service_worker_caches_the_kitchen_core():
    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_CACHE = 'burbz-" in sw
    assert sw.count("./kitchen_pantry_core.js?v=diet-hunger-release-20260723") == 2
