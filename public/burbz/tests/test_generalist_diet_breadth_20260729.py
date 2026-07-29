import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "bird_diet_hunger_core.js"
MERLIN = ROOT / "merlin_companion_core.js"


def _node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_carrion_crow_gets_its_source_backed_generalist_menu():
    out = _node(
        """
const D = require('./bird_diet_hunger_core.js');
const bird = { commonName:'Carrion Crow', scientificName:'Corvus corone' };
const meals = {
  earthworm: ['garden_worms','fresh'],
  invertebrate: ['mealworm_scoop','fresh'],
  grain: ['sunflower_seeds','husked'],
  fruit: ['hedgerow_berries','fresh'],
  carrion: ['carrion_scraps','fresh'],
  smallPrey: ['common_frog','live'],
  birdPrey: ['small_bird_prey_ration','whole'],
  fish: ['live_minnow','live'],
  nectar: ['nectar_cup','fresh']
};
const verdicts = Object.fromEntries(Object.entries(meals).map(([key,[id,prep]]) => [key,D.scoreFoodCompatibility(bird,id,prep).verdict]));
const disclosure = D.dietDisclosureForSpecies(bird);
console.log(JSON.stringify({ verdicts, disclosure }));
"""
    )
    accepted = {"primary", "secondary"}
    for food in ("earthworm", "invertebrate", "grain", "fruit", "carrion", "smallPrey", "birdPrey", "fish"):
        assert out["verdicts"][food] in accepted, food
    assert out["verdicts"]["nectar"] == "refused"
    assert "earthworm" in out["disclosure"]["education"].lower()
    assert "opportunistic" in out["disclosure"]["education"].lower()


def test_real_generalist_gulls_accept_earthworms_without_making_every_bird_a_generalist():
    out = _node(
        """
const D = require('./bird_diet_hunger_core.js');
function verdict(scientificName, commonName, ingredientId, prep) {
  return D.scoreFoodCompatibility({scientificName,commonName},ingredientId,prep).verdict;
}
console.log(JSON.stringify({
  herringWorm: verdict('Larus argentatus','Herring Gull','garden_worms','fresh'),
  lesserWorm: verdict('Larus fuscus','Lesser Black-backed Gull','garden_worms','fresh'),
  commonWorm: verdict('Larus canus','Common Gull','garden_worms','fresh'),
  commonFruit: verdict('Larus canus','Common Gull','hedgerow_berries','fresh'),
  goldfinchWorm: verdict('Carduelis carduelis','European Goldfinch','garden_worms','fresh')
}));
"""
    )
    assert out["herringWorm"] in {"primary", "secondary"}
    assert out["lesserWorm"] in {"primary", "secondary"}
    assert out["commonWorm"] in {"primary", "secondary"}
    assert out["commonFruit"] == "secondary"
    assert out["goldfinchWorm"] == "refused"


def test_merlin_teaches_diet_breadth_without_claiming_wild_birds_are_simple_pets():
    text = MERLIN.read_text(encoding="utf-8")
    assert "Omnivorous generalists such as Carrion Crows have broader Kitchen menus" in text
    assert "specialists need more exact food" in text
    assert "easy pets" not in text.lower()
    out = _node(
        """
const M=require('./merlin_companion_core.js');
console.log(JSON.stringify({tips:M.GAMEPLAY_TIPS.length,total:M.ALL_MERLIN_LINES.length}));
"""
    )
    assert out == {"tips": 20, "total": 130}
