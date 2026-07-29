import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
BIRDFUNCDAT_SHA256 = "97216eb1797da077169ebb1ebea275db293b09fc62f8bb8911f9beb98c50d321"
DIET_JSON = ROOT / "data" / "bird-diet-records.json"
INDEX = ROOT / "index.html"
MERLIN_CORE = ROOT / "merlin_companion_core.js"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=90,
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


def test_val_diet_001_generated_artifact_check_and_counts():
    result = subprocess.run(
        ["python", "scripts/check_bird_diets.py", "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + result.stderr
    output = result.stdout + result.stderr
    for marker in (
        BIRDFUNCDAT_SHA256,
        "BirdFuncDat source rows: 9993 usable scientific rows (9995 raw parsed rows)",
        "National profile count: 951",
        "Generated diet records: 952",
        "exact: 708",
        "scientific-alias: 7",
        "common-name: 156",
        "family-fallback: 67",
        "override: 1",
        "unmatched: 13",
        "Falco columbarius Diet-Vend=80 Diet-Inv=20 certainty=A",
    ):
        assert marker in output

    payload = json.loads(DIET_JSON.read_text(encoding="utf-8"))
    assert payload["metadata"]["source"]["sha256"] == BIRDFUNCDAT_SHA256
    assert payload["metadata"]["source"]["license"] == "CC BY 4.0"
    assert payload["metadata"]["source"]["doi"] == "10.1890/13-1917.1"
    assert payload["metadata"]["profiles"]["count"] == 951
    assert len(payload["records"]) == 952
    assert not [
        record for record in payload["records"]
        if not record.get("primaryCompatibleFamilies") and record["matchMethod"] != "unmatched"
    ]


def test_val_diet_002_merlin_source_truth_and_non_mealworm_primary_copy():
    payload = json.loads(DIET_JSON.read_text(encoding="utf-8"))
    merlin = next(record for record in payload["records"] if record["scientificName"] == "Falco columbarius")
    assert merlin["sourceDiet"]["Diet-Vend"] == 80
    assert merlin["sourceDiet"]["Diet-Inv"] == 20
    assert merlin["certainty"] == "A"
    assert merlin["primaryCompatibleFamilies"] == ["small_birds"]
    assert "invertebrates" in merlin["secondaryCompatibleFamilies"]
    assert "Meadow Pipits" in merlin["education"]
    assert "Skylarks" in merlin["education"]

    text = (INDEX.read_text(encoding="utf-8") + "\n" + MERLIN_CORE.read_text(encoding="utf-8")).lower()
    for marker in ("falco columbarius", "small-bird prey", "meadow pipits", "skylarks"):
        assert marker in text
    for stale in ("feed merlin insects from your pantry", "no mealworms left", "mealworm magic", "hungry for mealworms"):
        assert stale not in text


def test_val_diet_003_runtime_core_scores_representative_families():
    out = run_node(
        """
const D = require('./bird_diet_hunger_core.js');
const required = ['small_birds','small_mammals','fish','flying_insects','invertebrates','worms','molluscs_crustaceans','seeds','fruit_berries','nectar','aquatic_plants','foliage_buds','carrion'];
function verdict(species, ingredientId, prep) {
  const r = D.scoreFoodCompatibility(species, { ingredientId, prep });
  return { verdict:r.verdict, nourishment:r.nourishment, family:r.family, method:r.record && r.record.matchMethod };
}
console.log(JSON.stringify({
  missingFamilies: required.filter(id => !D.FOOD_FAMILIES[id]),
  merlinBird: verdict({ scientificName:'Falco columbarius', commonName:'Merlin' }, 'small_bird_prey_ration', 'whole'),
  merlinMammal: verdict({ scientificName:'Falco columbarius', commonName:'Merlin' }, 'field_vole', 'live'),
  merlinMealworm: verdict({ scientificName:'Falco columbarius', commonName:'Merlin' }, 'mealworm_scoop', 'fresh'),
  goldfinchSeed: verdict({ scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, 'sunflower_seeds', 'husked'),
  goldfinchFish: verdict({ scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, 'live_minnow', 'live'),
  swiftMidges: verdict({ commonName:'Common Swift' }, 'aerial_midges', 'tossed'),
  swiftMealworm: verdict({ commonName:'Common Swift' }, 'mealworm_scoop', 'fresh'),
  kingfisherFish: verdict({ scientificName:'Alcedo atthis' }, 'live_minnow', 'live'),
  spinebillNectar: verdict({ scientificName:'Acanthorhynchus superciliosus' }, 'nectar_cup', 'fresh'),
  mallardPlantWrongPrep: verdict({ scientificName:'Anas platyrhynchos' }, 'pondweed_tangle', 'fresh'),
  vultureCarrion: verdict({ scientificName:'Gypaetus barbatus' }, 'carrion_scraps', 'fresh'),
  familyPrimaryCases: {
    small_birds: verdict({ scientificName:'Accipiter gularis' }, 'small_bird_prey_ration', 'whole'),
    small_mammals: verdict({ scientificName:'Accipiter gularis' }, 'field_vole', 'live'),
    fish: verdict({ scientificName:'Alcedo atthis' }, 'live_minnow', 'live'),
    flying_insects: verdict({ scientificName:'Aerodramus terraereginae' }, 'aerial_midges', 'tossed'),
    invertebrates: verdict({ scientificName:'Acanthiza apicalis' }, 'mealworm_scoop', 'fresh'),
    worms: verdict({ scientificName:'Acrocephalus agricola' }, 'garden_worms', 'fresh'),
    molluscs_crustaceans: verdict({ scientificName:'Actitis macularius' }, 'shore_snail_mix', 'cracked'),
    seeds: verdict({ scientificName:'Acanthis flammea' }, 'sunflower_seeds', 'husked'),
    fruit_berries: verdict({ scientificName:'Agropsar philippensis' }, 'hedgerow_berries', 'fresh'),
    nectar: verdict({ scientificName:'Acanthorhynchus superciliosus' }, 'nectar_cup', 'fresh'),
    aquatic_plants: verdict({ scientificName:'Cygnus olor' }, 'pondweed_tangle', 'floating'),
    foliage_buds: verdict({ scientificName:'Amytornis woodwardi' }, 'leaf_bud_browse', 'fresh'),
    carrion: verdict({ scientificName:'Aegypius monachus' }, 'carrion_scraps', 'fresh')
  },
  redpollMethod: D.getDietRecord({ scientificName:'Acanthis flammea', commonName:'Redpoll' }).matchMethod,
  fallbackMethod: D.getDietRecord({ commonName:'Tasman Starling' }).matchMethod
}));
"""
    )
    assert out["missingFamilies"] == []
    assert out["merlinBird"]["verdict"] == "primary"
    assert out["merlinMammal"]["verdict"] == "refused"
    assert out["merlinMealworm"]["verdict"] == "secondary"
    assert out["merlinMealworm"]["nourishment"] < out["merlinBird"]["nourishment"]
    assert out["goldfinchSeed"]["verdict"] == "primary"
    assert out["goldfinchFish"]["verdict"] == "refused"
    assert out["swiftMidges"]["verdict"] == "primary"
    assert out["swiftMealworm"]["verdict"] == "secondary"
    assert out["kingfisherFish"]["verdict"] == "primary"
    assert out["spinebillNectar"]["verdict"] == "primary"
    assert out["mallardPlantWrongPrep"]["verdict"] == "wrong_prep"
    assert out["vultureCarrion"]["verdict"] == "primary"
    assert set(out["familyPrimaryCases"]) == {
        "small_birds", "small_mammals", "fish", "flying_insects",
        "invertebrates", "worms", "molluscs_crustaceans", "seeds",
        "fruit_berries", "nectar", "aquatic_plants", "foliage_buds", "carrion",
    }
    assert all(case["verdict"] == "primary" for case in out["familyPrimaryCases"].values())
    assert out["redpollMethod"] == "common-name"
    assert out["fallbackMethod"] == "family-fallback"


def test_val_diet_003_kitchen_scoring_uses_source_rule_and_no_universal_food():
    out = run_node(
        """
global.window = global;
require('./kitchen_pantry_core.js');
require('./data/bird-diet-records.js');
require('./bird_diet_hunger_core.js');
const D = global.BurbzDietHungerCore;
const K = global.BurbzKitchenCore;
function tier(species, slots) {
  return K.scoreMeal(D.createKitchenDietRule(species), slots);
}
const merlinMealworm = tier({ scientificName:'Falco columbarius', commonName:'Merlin' }, [{ ingredientId:'mealworm_scoop', prep:'fresh' }]);
const merlinBird = tier({ scientificName:'Falco columbarius', commonName:'Merlin' }, [
  { ingredientId:'small_bird_prey_ration', prep:'whole' },
  { ingredientId:'small_bird_prey_ration', prep:'whole' }
]);
const finchFish = tier({ scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, [{ ingredientId:'live_minnow', prep:'live' }]);
const swiftMidges = tier({ commonName:'Common Swift' }, [
  { ingredientId:'aerial_midges', prep:'tossed' },
  { ingredientId:'aerial_midges', prep:'tossed' }
]);
const families = K.listIngredients().map(i => [i.id, i.family, i.dietFamily || i.family]);
const species = [
  { scientificName:'Falco columbarius', commonName:'Merlin' },
  { scientificName:'Carduelis carduelis', commonName:'European Goldfinch' },
  { scientificName:'Gypaetus barbatus', commonName:'Lammergeier' }
];
const universal = K.listIngredients()
  .filter(i => i.family !== 'grit')
  .filter(i => species.every(s => D.scoreFoodCompatibility(s, { ingredientId:i.id, prep:(i.preps || ['fresh'])[0] }).verdict !== 'refused'))
  .map(i => i.id);
console.log(JSON.stringify({ merlinMealworm, merlinBird, finchFish, swiftMidges, families, universal }));
"""
    )
    assert out["merlinBird"]["tier"] == "field_perfect"
    assert out["merlinMealworm"]["tier"] == "scrappy"
    assert out["merlinMealworm"]["slots"][0]["verdict"] == "nibbled"
    assert out["finchFish"]["tier"] == "refused"
    assert out["swiftMidges"]["tier"] == "field_perfect"
    family_ids = {row[2] for row in out["families"]}
    assert {"small_birds", "molluscs_crustaceans", "nectar"}.issubset(family_ids)
    assert out["universal"] == []
