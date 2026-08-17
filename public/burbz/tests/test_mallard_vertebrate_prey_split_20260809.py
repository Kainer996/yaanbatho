"""The Mallard does not eat voles: cold-blooded prey is its own diet family.

The reported bug: the Head Chef service board listed the Mallard as an eater
of Field Voles and Common Shrews. EltonTraits folds all non-bird vertebrate
prey into neighbouring columns, and the game used to merge Diet-Vend
(warm-blooded: mammals) and Diet-Vect (cold-blooded: frogs, lizards, newts)
into one `small_mammals` family — so the Mallard's 10% of frogs and tadpoles
(Diet-Vect) wrongly put voles on its menu (its Diet-Vend is 0).

This pins the split:

* `reptiles_amphibians` is a real diet family in the generator and both
  runtime cores, and the Common Frog / Common Lizard ingredients live in it;
* `small_mammals` now means warm-blooded prey only, so the Mallard refuses
  every mammal ingredient while keeping frogs as a genuine side food;
* nothing correct was lost: every mammal-hunter (Kestrel, owls, Buzzard)
  still takes herptiles — voles imply frogs, the reverse is not true. Since
  the true-primary-prey release, borrowed prey ranks as a side food: a
  lizard is a real meal for a Kestrel, but never its mainstay;
* the Head Chef service board explains itself: a stock/hunger subtitle per
  food, an "Eaten by" label, and a legend for the hungry/full chip states.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=90
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


def test_mallard_refuses_mammals_but_keeps_its_real_cold_blooded_side_prey():
    out = run_node(
        """
global.window = global;
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const mallard = { commonName:'Mallard', scientificName:'Anas platyrhynchos' };
const v = (s, id, prep) => D.scoreFoodCompatibility(s, { ingredientId:id, prep }).verdict;
console.log(JSON.stringify({
  vole: v(mallard, 'field_vole', 'live'),
  shrew: v(mallard, 'common_shrew', 'live'),
  mouse: v(mallard, 'wood_mouse', 'live'),
  rabbit: v(mallard, 'young_rabbit', 'live'),
  frog: v(mallard, 'common_frog', 'live'),
  fish: v(mallard, 'live_minnow', 'live'),
  pondweed: v(mallard, 'pondweed_tangle', 'floating'),
  disclosure: D.dietDisclosureForSpecies(mallard).secondaryLabels
}));
"""
    )
    # No warm-blooded prey: the exact claim the bug report was about.
    for mammal in ("vole", "shrew", "mouse", "rabbit"):
        assert out[mammal] == "refused", f"Mallard must refuse {mammal}, got {out[mammal]}"
    # Its real wild diet keeps its minor prey: frogs (Diet-Vect) and small fish.
    assert out["frog"] == "secondary"
    assert out["fish"] == "secondary"
    assert out["pondweed"] == "secondary"
    # And the disclosure card teaches the corrected family by name.
    assert "Reptiles and amphibians" in out["disclosure"]
    assert "Small mammals" not in out["disclosure"]


def test_the_split_loses_nothing_every_mammal_hunter_still_takes_herptiles():
    out = run_node(
        """
global.window = global;
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const v = (sci, id) => D.scoreFoodCompatibility({ scientificName:sci }, { ingredientId:id, prep:'live' }).verdict;
console.log(JSON.stringify({
  kestrelLizard: v('Falco tinnunculus', 'common_lizard'),
  kestrelVole: v('Falco tinnunculus', 'field_vole'),
  barnOwlVole: v('Tyto alba', 'field_vole'),
  buzzardFrog: v('Buteo buteo', 'common_frog'),
  heronFrog: v('Ardea cinerea', 'common_frog'),
  crowFrog: v('Corvus corone', 'common_frog'),
  goldfinchLizard: v('Carduelis carduelis', 'common_lizard')
}));
"""
    )
    # Herptiles stay on every mammal-hunter's menu as genuine side prey. They
    # are no longer inflated to primary rank: EltonTraits gives the Kestrel no
    # measured cold-blooded share and the Buzzard only 10%, so a lizard or
    # frog is a real meal for them, not the mainstay voles are.
    assert out["kestrelLizard"] == "secondary"
    assert out["kestrelVole"] == "primary"
    assert out["barnOwlVole"] == "primary"
    assert out["buzzardFrog"] == "secondary"
    assert out["heronFrog"] == "secondary"
    assert out["crowFrog"] == "secondary"
    # Accuracy is not loosened: a seed-eating finch still refuses all prey.
    assert out["goldfinchLizard"] == "refused"


def test_both_cores_and_the_prey_lists_carry_the_new_family():
    out = run_node(
        """
global.window = global;
const K = require('./kitchen_pantry_core.js');
const D = require('./bird_diet_hunger_core.js');
console.log(JSON.stringify({
  dietFamily: D.FOOD_FAMILIES.reptiles_amphibians || null,
  kitchenLabel: K.DIET_FAMILIES.reptiles_amphibians || null,
  smallMammalsLabel: D.FOOD_FAMILIES.small_mammals.label,
  frogFamily: D.INGREDIENTS.common_frog.family,
  lizardFamily: D.INGREDIENTS.common_lizard.family,
  kitchenFrogFamily: K.INGREDIENTS.common_frog.dietFamily,
  kitchenLizardFamily: K.INGREDIENTS.common_lizard.dietFamily,
  preyIds: D.preyIngredientIds(),
  kitchenPreyIds: K.listPreyIngredients().map(i => i.id)
}));
"""
    )
    assert out["dietFamily"] and out["dietFamily"]["label"] == "Reptiles and amphibians"
    assert out["dietFamily"]["defaultPrep"] == "live"
    assert out["kitchenLabel"] == "Reptiles and amphibians"
    # The mammal family no longer claims to cover "other small prey".
    assert out["smallMammalsLabel"] == "Small mammals"
    for key in ("frogFamily", "lizardFamily", "kitchenFrogFamily", "kitchenLizardFamily"):
        assert out[key] == "reptiles_amphibians", key
    # Frogs and lizards are still prey a bird of prey can be fed, so hunting
    # quests, chests and shops keep stocking them.
    for prey_list in ("preyIds", "kitchenPreyIds"):
        assert "common_frog" in out[prey_list], prey_list
        assert "common_lizard" in out[prey_list], prey_list


def test_generated_records_never_pair_ect_only_diets_with_mammal_prey():
    payload = json.loads((ROOT / "data" / "bird-diet-records.json").read_text(encoding="utf-8"))
    checked = 0
    for record in payload["records"] + payload["catalogueRecords"]:
        percentages = record.get("dietPercentages")
        if not percentages:
            continue
        families = set(
            (record.get("primaryCompatibleFamilies") or [])
            + (record.get("secondaryCompatibleFamilies") or [])
        )
        vend = float(percentages.get("Diet-Vend") or 0)
        vunk = float(percentages.get("Diet-Vunk") or 0)
        if "small_mammals" in families and record.get("scientificName") not in (None, ""):
            assert vend > 0 or vunk > 0, (
                f"{record.get('name')} lists small_mammals with no warm-blooded prey evidence"
            )
            checked += 1
    assert checked > 50, "expected a real population of mammal-hunting records"


def test_the_chef_board_explains_its_chips_stock_and_serve_button():
    html = HTML.read_text(encoding="utf-8")
    board_start = html.index("function kitchenHeadChefBoardHTML(")
    board = html[board_start:html.index("\nfunction ", board_start + 10)]
    for marker in (
        "chef-board-legend",
        "chef-board-food-sub",
        "chef-board-eaters-label",
        "in stock",
        "hungry",
        'title="Feed every hungry bird that eats this',
    ):
        assert marker in board, marker
    # The chip styling separates hungry (lit) from full (dimmed) states.
    assert ".chef-board-eater.hungry" in html
    assert ".chef-board-eaters-label" in html
    # The quest hint for the new family points at the hunt that stocks it.
    assert "reptiles_amphibians: 'Marsh & Ditch Hunt'" in html
