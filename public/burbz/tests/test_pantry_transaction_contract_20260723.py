import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def run_node(script: str) -> dict:
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def test_starter_kitchen_is_reachable_and_documents_real_inventory():
    html = INDEX.read_text(encoding="utf-8")
    for marker in (
        "academyBuildings: { outdoors: { built: true, builtAt: 'starter' }, kitchen: { built: true",
        "academyBuilderVersion: 7",
        "starter-kitchen",
        "kitchenStarterLarderVersion: 1",
        "small_bird_prey_ration: 2",
        "mealworm_scoop: 2",
        "sunflower_seeds: 2",
        "live_minnow: 1",
        "Starter Stores include falcon rations, mealworms, sunflower seeds and a live minnow",
        "localStorage.setItem(BURBZ_EPOCH_KEY, BURBZ_FRESH_START_EPOCH)",
        "data-kitchen-pantry-root",
        "data-kitchen-species-choice",
        "data-diet-guidance",
        "data-diet-provenance",
        "data-compatible-foods",
        "data-larder-count",
        "data-pantry-count",
        "data-feed-transaction-id",
        "data-feed-result-sheet",
    ):
        assert marker in html, marker


def test_core_bridge_transactions_cover_explicit_pairs_reload_and_no_double_spend():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
let state = {
  merlinCare: { hunger:70, happiness:60, energy:80, hungerTransactions:[] },
  flock: [
    { id:'tit1', species:'Blue Tit', scientificName:'Parus caeruleus', commonName:'Blue Tit', care:{ hunger:66, happiness:70, hungerTransactions:[] } },
    { id:'finch1', species:'European Goldfinch', scientificName:'Carduelis carduelis', commonName:'European Goldfinch', care:{ hunger:65, happiness:70, hungerTransactions:[] } },
    { id:'reed1', species:'Oriental Reed-Warbler', scientificName:'Acrocephalus orientalis', commonName:'Oriental Reed-Warbler', care:{ hunger:80, happiness:70, hungerTransactions:[] } }
  ],
  inventory: { larder:{ small_bird_prey_ration:2, mealworm_scoop:2, sunflower_seeds:1, live_minnow:1 } },
  pantry: { insects:2, seeds:1, fish:1, meat:1 }
};
const before = D.inventorySnapshot(state);
const merlinGood = D.applyFeedingTransaction(state, { target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin' }, { ingredientId:'small_bird_prey_ration', prep:'whole' }, { transactionId:'tx-merlin-good', now:100 });
state = merlinGood.state;
const duplicateCrossStore = D.applyFeedingTransaction(state, { target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin' }, { pantryKey:'meat', source:'pantry' }, { transactionId:'tx-merlin-good', now:101 });
state = duplicateCrossStore.state;
const merlinMealworm = D.applyFeedingTransaction(state, { target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin' }, { ingredientId:'mealworm_scoop', prep:'fresh' }, { transactionId:'tx-merlin-mealworm', now:102 });
const titMealworm = D.applyFeedingTransaction(state, { target:'bird', birdId:'tit1', scientificName:'Parus caeruleus', commonName:'Blue Tit' }, { pantryKey:'insects', source:'pantry' }, { transactionId:'tx-tit-mealworm', now:103 });
state = titMealworm.state;
const finchFish = D.applyFeedingTransaction(state, { target:'bird', birdId:'finch1', scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, { pantryKey:'fish', source:'pantry' }, { transactionId:'tx-finch-fish', now:104 });
state = finchFish.state;
const finchSeed = D.applyFeedingTransaction(state, { target:'bird', birdId:'finch1', scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, { pantryKey:'seeds', source:'pantry' }, { transactionId:'tx-finch-seed', now:105 });
state = finchSeed.state;
const unmatchedConservativeFood = D.applyFeedingTransaction(state, { target:'bird', birdId:'reed1', scientificName:'Acrocephalus orientalis', commonName:'Oriental Reed-Warbler' }, { pantryKey:'insects', source:'pantry' }, { transactionId:'tx-reed-conservative', now:106 });
state = unmatchedConservativeFood.state;
const reloaded = D.migrateHungerState(JSON.parse(JSON.stringify(state)), 999);
console.log(JSON.stringify({ before, merlinGood, duplicateCrossStore, merlinMealworm, titMealworm, finchFish, finchSeed, unmatchedConservativeFood, reloaded }));
"""
    )
    assert out["before"]["larder"]["small_bird_prey_ration"] == 2
    assert out["merlinGood"]["ok"] is True
    assert out["merlinGood"]["consumed"] == {"inventory.larder.small_bird_prey_ration": 1}
    assert out["merlinGood"]["state"]["inventory"]["larder"]["small_bird_prey_ration"] == 1
    assert out["merlinGood"]["state"]["merlinCare"]["hunger"] < 70
    assert out["duplicateCrossStore"]["duplicate"] is True
    assert out["duplicateCrossStore"]["consumed"] == {}
    assert out["duplicateCrossStore"]["state"]["pantry"]["meat"] == 1
    assert out["merlinMealworm"]["ok"] is False
    assert out["merlinMealworm"]["state"]["inventory"]["larder"]["mealworm_scoop"] == 2
    assert out["merlinMealworm"]["state"]["merlinCare"]["hunger"] == out["duplicateCrossStore"]["state"]["merlinCare"]["hunger"]
    assert out["titMealworm"]["ok"] is True
    assert out["titMealworm"]["consumed"] == {"pantry.insects": 1}
    assert out["titMealworm"]["state"]["pantry"]["insects"] == 1
    assert out["titMealworm"]["state"]["inventory"]["larder"]["mealworm_scoop"] == 2
    assert out["finchFish"]["ok"] is False
    assert out["finchFish"]["state"]["pantry"]["fish"] == 1
    assert out["finchFish"]["state"]["flock"][1]["care"]["hunger"] == 65
    assert out["finchSeed"]["ok"] is True
    assert out["finchSeed"]["consumed"] == {"pantry.seeds": 1}
    assert out["unmatchedConservativeFood"]["ok"] is True
    assert out["unmatchedConservativeFood"]["compatibility"]["verdict"] == "insufficient"
    assert out["unmatchedConservativeFood"]["consumed"] == {"pantry.insects": 1}
    assert out["unmatchedConservativeFood"]["state"]["flock"][2]["care"]["hunger"] < 80
    assert "conservative care ration" in out["unmatchedConservativeFood"]["message"].lower()
    assert "primary meal" not in out["unmatchedConservativeFood"]["message"].lower()
    assert out["reloaded"]["pantry"]["seeds"] == 0
    assert out["reloaded"]["pantry"]["fish"] == 1
    assert out["reloaded"]["inventory"]["larder"]["small_bird_prey_ration"] == 1
    assert out["reloaded"]["flock"][1]["care"]["hunger"] == out["finchSeed"]["state"]["flock"][1]["care"]["hunger"]


def test_fully_fed_birds_and_merlin_do_not_waste_inventory():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
let state = {
  merlinCare:{ hunger:0, happiness:80, energy:80, hungerTransactions:[] },
  flock:[{ id:'finch', scientificName:'Carduelis carduelis', commonName:'European Goldfinch', care:{ hunger:0, happiness:70, hungerTransactions:[] } }],
  inventory:{ larder:{ small_bird_prey_ration:1, sunflower_seeds:1 } },
  pantry:{}
};
const merlin = D.applyFeedingTransaction(state, { target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin' }, { ingredientId:'small_bird_prey_ration', prep:'whole' }, { transactionId:'full-merlin', now:100 });
const finch = D.applyFeedingTransaction(merlin.state, { target:'bird', birdId:'finch', scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'full-finch', now:101 });
console.log(JSON.stringify({ merlin, finch }));
"""
    )
    assert out["merlin"]["ok"] is False
    assert out["merlin"]["consumed"] == {}
    assert out["merlin"]["state"]["inventory"]["larder"]["small_bird_prey_ration"] == 1
    assert out["finch"]["ok"] is False
    assert out["finch"]["consumed"] == {}
    assert out["finch"]["state"]["inventory"]["larder"]["sunflower_seeds"] == 1


def test_legacy_expedition_food_rewards_migrate_to_larder_once():
    html = INDEX.read_text(encoding="utf-8")
    helper = function_source(html, "legacyKitchenSupplyIngredient")
    ensure = function_source(html, "ensureLarder")
    out = run_node(
        """
const gameState = {
  inventory: {
    items: { seed_satchel:2, worm_tin:1, berry_bundle:3, shiny_pebble:4 },
    larder: { sunflower_seeds:5 }
  }
};
""" + helper + "\n" + ensure + """
const first = JSON.parse(JSON.stringify(ensureLarder()));
const afterFirstItems = JSON.parse(JSON.stringify(gameState.inventory.items));
const second = JSON.parse(JSON.stringify(ensureLarder()));
console.log(JSON.stringify({ first, second, afterFirstItems, version:gameState.kitchenLegacySupplyMigrationVersion }));
"""
    )
    assert out["first"]["sunflower_seeds"] == 7
    assert out["first"]["garden_worms"] == 1
    assert out["first"]["hedgerow_berries"] == 3
    assert out["second"] == out["first"]
    assert out["afterFirstItems"] == {"shiny_pebble": 4}
    assert out["version"] == 1


def test_academy_and_merlin_ui_paths_use_shared_bridge_transactions():
    html = INDEX.read_text(encoding="utf-8")
    academy_feed = function_source(html, "academyFeedFood")
    merlin_care = function_source(html, "careForMerlin")
    kitchen_serve = function_source(html, "kitchenServeMeal")
    claim_expedition = function_source(html, "claimBirdExpedition")
    ensure_larder = function_source(html, "ensureLarder")
    for marker in (
        "core.applyFeedingTransaction",
        "{ pantryKey:foodKey, source:'pantry' }",
        "no pantry spent",
    ):
        assert marker in academy_feed, marker
    for marker in (
        "core.applyFeedingTransaction",
        "small_bird_prey_ration",
        "Falco columbarius",
        "Merlin refuses mealworms as a main meal",
    ):
        assert marker in merlin_care, marker
    for marker in (
        "const acceptedMeal = result.refusedCount === 0 && result.perfectCount > 0",
        "No stock spent",
        "Object.entries(need).forEach(([id, n]) => { larder[id] -= n; });",
        "result.transactionId = txId",
        "Merlin is still full — no food was spent.",
        "gameState.merlinCare.hunger <= 0",
        "Number(companion.care.hunger) <= 0",
    ):
        assert marker in kitchen_serve, marker
    for marker in (
        "legacyKitchenSupplyIngredient(key)",
        "addLarderIngredient(larderKey, count)",
    ):
        assert marker in claim_expedition, marker
    for marker in (
        "kitchenLegacySupplyMigrationVersion",
        "delete items[legacyId]",
    ):
        assert marker in ensure_larder, marker
    for marker in ("seed_satchel", "worm_tin", "berry_bundle"):
        assert marker in html, marker
