"""Birds of prey can actually be fed, from the first minute of a new game.

A hawk, an owl or a kite cannot eat seed, suet or berries, and before this
change the only meat in the game was a field vole and a falcon ration that
turned up rarely on walks and in chests. There was no quest that hunted for
meat at all, so a player who recruited a raptor early simply watched it
starve.

This pins the fix:

* a real prey catalogue spanning every carnivore diet family — small mammals,
  amphibians and reptiles, bird-prey rations, fish and carrion — with each
  prey item naming the birds that genuinely take it;
* five hunting errands plus the fishing trip, all STARTER quests at level 1,
  so meat is reachable before the Quest Roost is ever built;
* prey in the day-one larder, on map forage, in walking-quest and wander
  chests, and on a village butcher counter;
* the prey each raptor is fed still scores against the source-backed diet
  records — accuracy is not loosened to make feeding easier.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
KITCHEN_CORE = ROOT / "kitchen_pantry_core.js"
DIET_CORE = ROOT / "bird_diet_hunger_core.js"
QUEST_CORE = ROOT / "quest_core.js"

# The prey added so every carnivore family has more than one animal in it.
NEW_PREY = {
    "wood_mouse": "small_mammals",
    "common_shrew": "small_mammals",
    "young_rabbit": "small_mammals",
    "common_frog": "reptiles_amphibians",
    "common_lizard": "reptiles_amphibians",
    "starling_prey_ration": "small_birds",
    "pigeon_prey_ration": "small_birds",
    "sand_eel": "fish",
    "deer_carrion": "carrion",
    "marrow_bone": "carrion",
}

HUNTING_QUESTS = ["meadow_hunt", "warren_watch", "ration_run", "carrion_round", "marsh_hunt"]


def run_node(script: str) -> dict:
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# The prey catalogue
# ---------------------------------------------------------------------------

def test_both_ingredient_catalogues_carry_the_same_prey_in_the_same_families():
    out = run_node(
        "global.window = global;"
        "const K = require('./kitchen_pantry_core.js');"
        "const D = require('./bird_diet_hunger_core.js');"
        "const ids = Object.keys(D.INGREDIENTS);"
        "console.log(JSON.stringify({"
        "  diet: ids.reduce((a, id) => (a[id] = D.INGREDIENTS[id].family, a), {}),"
        "  kitchen: Object.keys(K.INGREDIENTS).reduce((a, id) => (a[id] = K.INGREDIENTS[id].dietFamily, a), {}),"
        "  takenBy: ids.reduce((a, id) => (a[id] = !!D.INGREDIENTS[id].takenBy, a), {}),"
        "  preyIds: D.preyIngredientIds(),"
        "  kitchenPreyIds: K.listPreyIngredients().map(i => i.id)"
        "}));"
    )
    for ingredient_id, family in NEW_PREY.items():
        assert out["diet"].get(ingredient_id) == family, ingredient_id
        assert out["kitchen"].get(ingredient_id) == family, ingredient_id
        # Every prey item teaches which birds really hunt it.
        assert out["takenBy"].get(ingredient_id) is True, ingredient_id
        assert ingredient_id in out["preyIds"], ingredient_id
        assert ingredient_id in out["kitchenPreyIds"], ingredient_id
    # Each carnivore family now holds a real choice of animals, not just one.
    for family in ("small_mammals", "small_birds", "fish", "carrion"):
        count = sum(1 for f in out["diet"].values() if f == family)
        assert count >= 3, f"{family} only has {count} ingredient(s)"
    # Cold-blooded prey is its own family (so a Mallard's frogs never imply
    # voles), and it still holds both marsh animals.
    herptiles = sum(1 for f in out["diet"].values() if f == "reptiles_amphibians")
    assert herptiles >= 2, f"reptiles_amphibians only has {herptiles} ingredient(s)"


def test_prey_still_scores_against_the_source_backed_diet_records():
    out = run_node(
        "global.window = global;"
        "const D = require('./bird_diet_hunger_core.js');"
        "const v = (sci, id, prep) => D.scoreFoodCompatibility({ scientificName:sci }, { ingredientId:id, prep }).verdict;"
        "console.log(JSON.stringify({"
        "  barnOwlMouse: v('Tyto alba', 'wood_mouse', 'live'),"
        "  barnOwlShrew: v('Tyto alba', 'common_shrew', 'live'),"
        "  buzzardRabbit: v('Buteo buteo', 'young_rabbit', 'live'),"
        "  kiteCarrion: v('Milvus milvus', 'deer_carrion', 'fresh'),"
        "  lammergeierBone: v('Gypaetus barbatus', 'marrow_bone', 'fresh'),"
        "  peregrinePigeon: v('Falco peregrinus', 'pigeon_prey_ration', 'whole'),"
        "  sparrowhawkStarling: v('Accipiter nisus', 'starling_prey_ration', 'whole'),"
        "  kestrelLizard: v('Falco tinnunculus', 'common_lizard', 'live'),"
        "  puffinSandEel: v('Fratercula arctica', 'sand_eel', 'live'),"
        "  goldfinchVole: v('Carduelis carduelis', 'field_vole', 'live'),"
        "  goldfinchRabbit: v('Carduelis carduelis', 'young_rabbit', 'live')"
        "}));"
    )
    for key in (
        "barnOwlMouse", "barnOwlShrew", "buzzardRabbit", "kiteCarrion", "lammergeierBone",
        "peregrinePigeon", "sparrowhawkStarling", "puffinSandEel",
    ):
        assert out[key] == "primary", f"{key} should be a primary meal, got {out[key]}"
    # A Kestrel hunts voles; a lizard is real side prey, not the mainstay.
    assert out["kestrelLizard"] == "secondary"
    # Accuracy is not loosened: a seed-eating finch still refuses meat.
    assert out["goldfinchVole"] == "refused"
    assert out["goldfinchRabbit"] == "refused"


# ---------------------------------------------------------------------------
# Hunting errands, available from the start of the game
# ---------------------------------------------------------------------------

def test_hunting_quests_are_starter_quests_and_only_pay_out_real_prey():
    out = run_node(
        "global.window = global;"
        "const A = require('./academy_treehouse_core.js');"
        "const K = require('./kitchen_pantry_core.js');"
        "const D = require('./bird_diet_hunger_core.js');"
        "const rows = {};"
        "A.getQuestTemplates().forEach(t => { rows[t.id] = {"
        "  starter: t.starter === true, minLevel: t.minLevel, minutes: t.minutes, items: t.items,"
        "  allLarder: t.items.every(id => !!K.ingredientById(id)),"
        "  preyOnly: t.items.every(id => D.preyIngredientIds().includes(id))"
        "}; });"
        "console.log(JSON.stringify(rows));"
    )
    for quest_id in HUNTING_QUESTS:
        row = out.get(quest_id)
        assert row, f"{quest_id} hunting quest is missing"
        assert row["starter"] is True, f"{quest_id} must be available before the Quest Roost"
        assert row["minLevel"] == 1, f"{quest_id} must not be level gated"
        assert row["minutes"] <= 10, f"{quest_id} should be a short repeatable errand"
        assert row["allLarder"] is True, f"{quest_id} pays out something the Kitchen cannot store"
    # Fish is prey too — ospreys, herons and kingfishers need the fishing trip
    # unlocked from the start alongside the other hunts.
    assert out["fishing_trip"]["starter"] is True
    assert out["fishing_trip"]["minLevel"] == 1
    # The mammal, bird-ration and carrion rounds bring back meat and nothing else.
    for quest_id in ("meadow_hunt", "warren_watch", "ration_run", "carrion_round"):
        assert out[quest_id]["preyOnly"] is True, quest_id
    # Between them the hunts cover every carnivore family.
    hunted = {item for quest_id in HUNTING_QUESTS for item in out[quest_id]["items"]}
    assert {"field_vole", "wood_mouse", "common_shrew"} <= hunted
    assert {"young_rabbit"} <= hunted
    assert {"small_bird_prey_ration", "starling_prey_ration", "pigeon_prey_ration"} <= hunted
    assert {"carrion_scraps", "deer_carrion", "marrow_bone"} <= hunted
    assert {"common_frog", "common_lizard"} <= hunted


def test_the_quest_board_explains_each_hunt_and_shows_the_food_it_brings_home():
    html = HTML.read_text(encoding="utf-8")
    for quest_id in HUNTING_QUESTS:
        assert quest_id + ":" in html, f"{quest_id} has no quest-board blurb"
    # The board card shows the larder icons an errand pays out.
    assert "const foodIcons = [...new Set((t.items || []).map(id => kitchenIngredientById(id))" in html
    assert "foodHint" in html


# ---------------------------------------------------------------------------
# Every other route meat can arrive by
# ---------------------------------------------------------------------------

def test_new_games_and_old_saves_both_start_with_prey_in_the_larder():
    html = HTML.read_text(encoding="utf-8")
    assert "const STARTER_PREY_LARDER = {" in html
    assert "...STARTER_PREY_LARDER" in html
    # Saves made before the hunts existed are topped up once, so an existing
    # player's starving owl gets fed too.
    assert "kitchenPreyLarderVersion" in html
    assert "needsKitchenPreyLarderGrant" in html
    starter = html[html.index("const STARTER_PREY_LARDER = {"):]
    starter = starter[:starter.index("}")]
    for ingredient_id in ("field_vole", "wood_mouse", "carrion_scraps"):
        assert ingredient_id in starter, ingredient_id


def test_walks_and_shops_restock_the_meat_shelf():
    html = HTML.read_text(encoding="utf-8")
    forage = html[html.index("const MAP_PICKUP_TYPES = ["):html.index("const MAP_PICKUP_CELL_DEG")]
    for ingredient_id in ("wood_mouse", "young_rabbit", "common_frog", "carrion_scraps", "small_bird_prey_ration"):
        assert f"addLarderIngredient('{ingredient_id}', 1)" in forage, ingredient_id
    shop = html[html.index("const VILLAGE_SHOPS = {"):html.index("  potion: {")]
    for ingredient_id in ("field_vole", "wood_mouse", "young_rabbit", "carrion_scraps", "marrow_bone"):
        assert f"larder: '{ingredient_id}'" in shop, ingredient_id


def test_every_walking_and_wander_chest_carries_prey_a_raptor_can_eat():
    out = run_node(
        "global.window = global; global.self = global;"
        "const K = require('./kitchen_pantry_core.js');"
        "require('./quest_core.js');"
        "const Q = global.BurbzQuestCore;"
        "const known = id => !!K.ingredientById(id);"
        "const item = id => ['xp_scroll_minor','xp_scroll_greater'].includes(id);"
        "const bundles = Q.CHEST_LOOT.map(loot => {"
        "  const clean = Q.validateChestRewardBundle(loot, known, item);"
        "  return { ids: Object.keys(clean.larder),"
        "           prey: Object.keys(clean.larder).filter(id => Q.CHEST_PREY_IDS.includes(id)) };"
        "});"
        "const repaired = [];"
        "for (let i = 0; i < 8; i++) repaired.push(Q.normaliseChestLoot({ coins: 5 }, 'legacy-' + i).larder);"
        "console.log(JSON.stringify({ bundles, repaired, preyIds: Q.CHEST_PREY_IDS,"
        "  allKnown: repaired.every(l => Object.keys(l).every(known)) }));"
    )
    assert len(out["bundles"]) >= 10, "the chest table should offer a real spread of prey"
    for bundle in out["bundles"]:
        assert bundle["prey"], f"chest bundle {bundle['ids']} has no meat in it"
    # Legacy chests saved before prey existed are repaired into usable bundles.
    assert out["allKnown"] is True
    assert all(any(i in out["preyIds"] for i in larder) for larder in out["repaired"])
    # The repair rotates prey instead of always handing out the same vole.
    assert len({tuple(sorted(l)) for l in out["repaired"]}) >= 6

    side = HTML.read_text(encoding="utf-8")
    side = side[side.index("function sideQuestChestLoot("):]
    side = side[:side.index("\nfunction ")]
    for ingredient_id in ("wood_mouse", "young_rabbit", "deer_carrion", "common_frog"):
        assert ingredient_id in side, ingredient_id


def test_a_hungry_bird_is_told_which_hunt_to_send_for():
    html = HTML.read_text(encoding="utf-8")
    roster = html[html.index("function kitchenRosterRowHTML("):html.index("function renderKitchenRosterHTML(")]
    assert "Vole Meadow Hunt" in roster
    assert "Falconry Ration Run" in roster
    assert "Carrion Round" in roster
    assert "Send a bird on the " in roster


# ---------------------------------------------------------------------------
# The Kitchen screen reads as a job, not a wall of reference text
# ---------------------------------------------------------------------------

def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def test_companion_table_leads_with_diet_and_supply_guidance():
    html = HTML.read_text(encoding="utf-8")
    row = function_source(html, "kitchenRosterRowHTML")
    assert "kitchen-roster-eats" in row
    assert "kitchenRosterEatsLabels(entry)" in row
    assert "kitchen-roster-supply" in row
    assert "kitchenRosterTrayHTML(entry, options)" in row
    roster = function_source(html, "renderKitchenRosterHTML")
    assert "Every bird eats something different" in roster
    assert roster.index("kitchen-fold") < roster.index("Every bird eats something different")


def test_the_food_list_shows_every_food_with_the_prey_blurb_that_names_its_hunters():
    html = HTML.read_text(encoding="utf-8")
    # Each food is its own one-tap meal button, and every button carries the
    # description — including the "Taken by:" line prey items add for the
    # birds that really hunt them.
    options = function_source(html, "kitchenRosterFoodOptions")
    assert "Taken by: " in options
    tray = function_source(html, "kitchenRosterTrayHTML")
    assert "options.map(option" in tray
    assert "option.desc" in tray
    assert "burbzFeedTap(" in tray
    row = function_source(html, "kitchenRosterRowHTML")
    assert row.index("kitchenRosterEatsLabels") < row.index("kitchenRosterTrayHTML")


def test_the_diet_chip_line_names_what_each_bird_really_eats():
    out = run_node(
        "global.window = global;"
        "const fs = require('fs');"
        "const html = fs.readFileSync('index.html', 'utf8');"
        "function fnSrc(name) {"
        "  const start = html.indexOf('function ' + name + '(');"
        "  let i = html.indexOf('{', start), depth = 0;"
        "  for (; i < html.length; i++) { if (html[i] === '{') depth++; else if (html[i] === '}') { depth--; if (!depth) break; } }"
        "  return html.slice(start, i + 1);"
        "}"
        "require('./bird_diet_hunger_core.js');"
        "global.escapeHtml = s => String(s == null ? '' : s);"
        "global.kitchenDietCore = () => global.BurbzDietHungerCore;"
        "let code = fnSrc('kitchenDietSubject') + '\\n' + fnSrc('kitchenEatsChipsHTML') + '\\n';"
        "code += 'module.exports = { kitchenEatsChipsHTML };';"
        "const mod = { exports:{} };"
        "new Function('module','exports','require', code)(mod, mod.exports, require);"
        "const chips = c => mod.exports.kitchenEatsChipsHTML(c);"
        "console.log(JSON.stringify({"
        "  owl: chips({ key:'barn_owl', name:'Barn Owl', commonName:'Barn Owl', scientificName:'Tyto alba' }),"
        "  merlin: chips({ key:'merlin', name:'Merlin', merlin:true }),"
        "  finch: chips({ key:'goldfinch', name:'European Goldfinch', commonName:'European Goldfinch', scientificName:'Carduelis carduelis' }),"
        "  none: chips(null)"
        "}));"
    )
    assert "Small mammals" in out["owl"], out["owl"]
    assert "kitchen-eat-chip" in out["owl"]
    assert "Small-bird prey rations" in out["merlin"]
    assert "Seeds" in out["finch"]
    # A finch's chips must not advertise meat.
    assert "Carrion" not in out["finch"]
    # No bird selected still renders something harmless.
    assert "kitchen-eat-chip" in out["none"]
