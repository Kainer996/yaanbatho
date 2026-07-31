"""RED tests for the source-backed diet and hunger mission.

These tests are intentionally written before the production implementation.
They describe public behavior needed by the VAL-* contracts and should fail
until the source-backed diet data, hunger state, and shared feeding/activity
transaction APIs are implemented.
"""

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
MERLIN_CORE = ROOT / "merlin_companion_core.js"
PROFILES = ROOT / "data" / "national-bird-completion" / "profiles.json"
BIRDFUNCDAT_SHA256 = "97216eb1797da077169ebb1ebea275db293b09fc62f8bb8911f9beb98c50d321"
# Resolve the EltonTraits oracle the same way check_bird_diets.py does: prefer a
# local /tmp download for fast iteration, otherwise fall back to the committed
# source cache so a fresh clone still verifies offline.
_TMP_BIRDFUNCDAT = Path("/tmp/BirdFuncDat.txt")
_CACHED_BIRDFUNCDAT = ROOT / "data" / "national-bird-completion" / "source-cache" / "BirdFuncDat.txt"
BIRDFUNCDAT = _TMP_BIRDFUNCDAT if _TMP_BIRDFUNCDAT.exists() else _CACHED_BIRDFUNCDAT

DIET_ARTIFACT_CANDIDATES = [
    ROOT / "data" / "bird-diet-records.json",
    ROOT / "data" / "bird_diet_records.json",
    ROOT / "data" / "diet-provenance.json",
    ROOT / "data" / "national-bird-completion" / "bird-diet-records.json",
    ROOT / "data" / "national-bird-completion" / "diet-provenance.json",
]

DIET_CHECK_SCRIPT_CANDIDATES = [
    ROOT / "scripts" / "check_bird_diets.py",
    ROOT / "scripts" / "build_burbz_diet_data.py",
    ROOT / "scripts" / "build_bird_diet_records.py",
]

MISSION_FOOD_FAMILIES = {
    "small_birds",
    "small_mammals",
    "fish",
    "flying_insects",
    "invertebrates",
    "worms",
    "molluscs_crustaceans",
    "seeds",
    "fruit_berries",
    "nectar",
    "aquatic_plants",
    "carrion",
}


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


def load_diet_payload():
    path = next((candidate for candidate in DIET_ARTIFACT_CANDIDATES if candidate.exists()), None)
    assert path is not None, (
        "No source-backed diet artifact found. Expected one of: "
        + ", ".join(str(candidate.relative_to(ROOT)) for candidate in DIET_ARTIFACT_CANDIDATES)
    )
    payload = json.loads(path.read_text(encoding="utf-8"))
    records = payload.get("records") if isinstance(payload, dict) else payload
    assert isinstance(records, list) and records, f"{path.relative_to(ROOT)} must contain a non-empty records list"
    return path, payload, records


def record_keys(record: dict) -> set[str]:
    keys = {
        record.get("id"),
        record.get("name"),
        record.get("commonName"),
        record.get("scientific"),
        record.get("scientificName"),
    }
    keys.update(record.get("aliases") or [])
    return {norm(str(key)) for key in keys if key}


def find_record(records: list[dict], value: str) -> dict | None:
    wanted = norm(value)
    for record in records:
        if wanted in record_keys(record):
            return record
    return None


def diet_percent(record: dict, key: str):
    for container_name in ("percentages", "birdFuncDat", "sourceDiet", "dietPercentages"):
        container = record.get(container_name)
        if isinstance(container, dict) and key in container:
            return container[key]
    return record.get(key)


def family_ids(value) -> set[str]:
    if isinstance(value, dict):
        return {str(key) for key, enabled in value.items() if enabled}
    if isinstance(value, list):
        out = set()
        for item in value:
            if isinstance(item, dict):
                out.add(str(item.get("id") or item.get("family") or item.get("name") or ""))
            else:
                out.add(str(item))
        return {item for item in out if item}
    if value:
        return {str(value)}
    return set()


def test_val_diet_001_source_backed_records_cover_all_profiles_and_merlin():
    assert BIRDFUNCDAT.exists(), "BirdFuncDat oracle is missing at /tmp/BirdFuncDat.txt"
    profiles = json.loads(PROFILES.read_text(encoding="utf-8"))
    assert len(profiles) == 951
    path, payload, records = load_diet_payload()
    blob = json.dumps(payload, sort_keys=True)

    assert BIRDFUNCDAT_SHA256 in blob
    assert "10.1890/13-1917.1" in blob
    assert "CC BY 4.0" in blob

    missing = [
        f"{profile['name']} ({profile['scientificName']})"
        for profile in profiles
        if not (find_record(records, profile["scientificName"]) or find_record(records, profile["id"]))
    ]
    assert not missing, f"{path.relative_to(ROOT)} lacks diet records for: {missing[:12]}"
    assert find_record(records, "Falco columbarius"), "Permanent Merlin must be covered outside the 951 profile catalogue"


def test_val_diet_001_generated_diet_check_command_passes_and_guards_drift():
    script = next((candidate for candidate in DIET_CHECK_SCRIPT_CANDIDATES if candidate.exists()), None)
    assert script is not None, (
        "No generated-data diet check script found. Expected one of: "
        + ", ".join(str(candidate.relative_to(ROOT)) for candidate in DIET_CHECK_SCRIPT_CANDIDATES)
    )
    result = subprocess.run(
        ["python", str(script.relative_to(ROOT)), "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=120,
    )
    assert result.returncode == 0, result.stdout + "\n" + result.stderr
    output = result.stdout + result.stderr
    for marker in ("951", "Falco columbarius", BIRDFUNCDAT_SHA256, "match"):
        assert marker in output


def test_val_diet_002_merlin_data_and_copy_are_small_falcon_prey_not_mealworm_primary():
    _, _, records = load_diet_payload()
    merlin = find_record(records, "Falco columbarius")
    assert merlin, "Merlin diet record for Falco columbarius is missing"
    assert diet_percent(merlin, "Diet-Vend") == 80
    assert diet_percent(merlin, "Diet-Inv") == 20
    primary = family_ids(merlin.get("primaryCompatibleFamilies") or merlin.get("primaryFamilies") or merlin.get("primary"))
    secondary = family_ids(merlin.get("secondaryCompatibleFamilies") or merlin.get("secondaryFamilies") or merlin.get("secondary"))
    assert "small_birds" in primary
    assert "invertebrates" in secondary or "flying_insects" in secondary

    text = (INDEX.read_text(encoding="utf-8") + "\n" + MERLIN_CORE.read_text(encoding="utf-8")).lower()
    for marker in ("falco columbarius", "small bird", "meadow pipit", "skylark"):
        assert marker in text
    for stale in ("feed merlin insects from your pantry", "no mealworms left", "mealworm magic"):
        assert stale not in text


def test_val_diet_003_compatibility_matrix_uses_source_families_and_refuses_wrong_food():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
const familyList = Array.isArray(D.FOOD_FAMILIES)
  ? D.FOOD_FAMILIES.map(f => f.id || f)
  : Object.keys(D.FOOD_FAMILIES || {});
const required = %s;
function verdict(species, ingredientId, prep) {
  return D.scoreFoodCompatibility(species, { ingredientId, prep });
}
console.log(JSON.stringify({
  missingFamilies: required.filter(f => !familyList.includes(f)),
  merlinBird: verdict({ scientificName:'Falco columbarius', commonName:'Merlin' }, 'small_bird_prey_ration', 'whole'),
  merlinMealworm: verdict({ scientificName:'Falco columbarius', commonName:'Merlin' }, 'mealworm_scoop', 'fresh'),
  finchSeed: verdict({ scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, 'sunflower_seeds', 'husked'),
  finchFish: verdict({ scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, 'live_minnow', 'live'),
  swiftMidges: verdict({ commonName:'Common Swift' }, 'aerial_midges', 'tossed'),
  duckWrongPrep: verdict({ commonName:'Mallard' }, 'pondweed_tangle', 'fresh')
}));
"""
        % json.dumps(sorted(MISSION_FOOD_FAMILIES))
    )
    assert out["missingFamilies"] == []
    assert out["merlinBird"]["verdict"] == "primary"
    assert out["merlinMealworm"]["verdict"] in {"secondary", "insufficient", "refused"}
    assert out["merlinMealworm"]["nourishment"] < out["merlinBird"]["nourishment"]
    assert out["finchSeed"]["verdict"] == "primary"
    assert out["finchFish"]["verdict"] == "refused"
    assert out["swiftMidges"]["verdict"] == "primary"
    assert out["duckWrongPrep"]["verdict"] == "wrong_prep"


def test_val_hunger_001_migration_bounds_state_and_preserves_existing_bird_data():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
const state = {
  flock: [
    { id:'b1', species:'European Robin', hp:12, maxHp:20, training:{ atkBonus:2 }, academy:{ room:'roost' }, care:{ happiness:77 } },
    { id:'b2', species:'Mallard', hp:19, maxHp:30, care:{ hunger:175, happiness:10, hungerTransactions:['old_tx'] } }
  ],
  merlinCare: { hunger:-20, happiness:88, bondLevel:4, bondXp:30 },
  inventory: { larder:{} },
  pantry: {}
};
const migrated = D.migrateHungerState(state, 1800000000000);
console.log(JSON.stringify(migrated));
"""
    )
    birds = out["flock"]
    assert [bird["id"] for bird in birds] == ["b1", "b2"]
    assert birds[0]["training"] == {"atkBonus": 2}
    assert birds[0]["academy"] == {"room": "roost"}
    assert 0 <= birds[0]["care"]["hunger"] <= 100
    assert 0 <= birds[1]["care"]["hunger"] <= 100
    assert birds[1]["care"]["hungerTransactions"] == ["old_tx"]
    assert "lastHungerAt" in birds[0]["care"]
    assert 0 <= out["merlinCare"]["hunger"] <= 100
    assert "hungerTransactions" in out["merlinCare"]


def test_val_hunger_002_visible_hunger_markers_cover_health_and_readiness_surfaces():
    html = INDEX.read_text(encoding="utf-8")
    expected_markers = [
        'data-hunger-surface="companion-card"',
        'data-hunger-surface="academy-room"',
        'data-hunger-surface="expedition-dispatch"',
        'data-hunger-surface="training-dispatch"',
        'data-hunger-surface="battle-readiness"',
        'data-hunger-surface="merlin-care"',
    ]
    missing = [marker for marker in expected_markers if marker not in html]
    assert not missing, "Missing player-visible hunger meter/status markers: " + ", ".join(missing)
    for label in ("fed", "peckish", "hungry", "urgent care"):
        assert label in html.lower()


def test_val_hunger_004_activity_hunger_is_idempotent_for_repeated_activity_completion():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
let state = {
  flock: [{ id:'b1', species:'Mallard', care:{ hunger:20, hungerTransactions:[] } }],
  birdExpeditions: [{ id:'exp1', birdId:'b1', status:'complete' }],
  birdTrainingSessions: [{ id:'train1', birdId:'b1', status:'complete' }]
};
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'expedition', activityId:'exp1', delta:12, now:10 }).state;
const afterExpeditionOnce = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'expedition', activityId:'exp1', delta:12, now:11 }).state;
const afterExpeditionTwice = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'training', activityId:'train1', delta:8, now:12 }).state;
const afterTrainingOnce = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'battle', activityId:'battle42', delta:10, now:13 }).state;
const afterBattleOnce = state.flock[0].care.hunger;
state = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'battle', activityId:'battle42', delta:10, now:14 }).state;
console.log(JSON.stringify({
  afterExpeditionOnce,
  afterExpeditionTwice,
  afterTrainingOnce,
  afterBattleOnce,
  afterBattleTwice: state.flock[0].care.hunger,
  tx: state.flock[0].care.hungerTransactions,
  reserved: D.isBirdReservedForActivity(state, 'b1')
}));
"""
    )
    assert out["afterExpeditionOnce"] == 20
    assert out["afterExpeditionTwice"] == 20
    assert 20 <= out["afterTrainingOnce"] < 20.01
    assert 20 <= out["afterBattleOnce"] < 20.01
    assert 20 <= out["afterBattleTwice"] < 20.01
    assert len(out["tx"]) == 3
    assert out["reserved"] is True


def test_val_pantry_002_feeding_transactions_are_atomic_species_compatible_and_idempotent():
    out = run_node(
        """
const D = require('./diet_hunger_core.js');
let state = {
  merlinCare: { hunger:70, happiness:60, energy:80, hungerTransactions:[] },
  flock: [{ id:'finch1', species:'European Goldfinch', scientificName:'Carduelis carduelis', care:{ hunger:65, happiness:70, hungerTransactions:[] } }],
  inventory: { larder:{ small_bird_prey_ration:2, mealworm_scoop:2, sunflower_seeds:1, live_minnow:1 } },
  pantry: { insects:2, seeds:1 }
};
const merlinGood = D.applyFeedingTransaction(state, { target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin' }, { ingredientId:'small_bird_prey_ration', prep:'whole' }, { transactionId:'feed-merlin-good', now:100 });
state = merlinGood.state;
const merlinDuplicate = D.applyFeedingTransaction(state, { target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin' }, { ingredientId:'small_bird_prey_ration', prep:'whole' }, { transactionId:'feed-merlin-good', now:101 });
state = merlinDuplicate.state;
const merlinMealworm = D.applyFeedingTransaction(state, { target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin' }, { ingredientId:'mealworm_scoop', prep:'fresh' }, { transactionId:'feed-merlin-bad', now:102 });
const finchFish = D.applyFeedingTransaction(state, { target:'bird', birdId:'finch1', scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, { ingredientId:'live_minnow', prep:'live' }, { transactionId:'feed-finch-bad', now:103 });
const finchSeed = D.applyFeedingTransaction(state, { target:'bird', birdId:'finch1', scientificName:'Carduelis carduelis', commonName:'European Goldfinch' }, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'feed-finch-good', now:104 });
console.log(JSON.stringify({ merlinGood, merlinDuplicate, merlinMealworm, finchFish, finchSeed }));
"""
    )
    assert out["merlinGood"]["ok"] is True
    assert out["merlinGood"]["consumed"] == {"inventory.larder.small_bird_prey_ration": 1}
    assert out["merlinGood"]["state"]["merlinCare"]["hunger"] < 70
    assert out["merlinDuplicate"]["consumed"] == {}
    assert out["merlinDuplicate"]["state"]["inventory"]["larder"]["small_bird_prey_ration"] == 1
    # A player-chosen side snack may top Merlin up and spends one whole scoop.
    assert out["merlinMealworm"]["ok"] is True
    assert out["merlinMealworm"]["compatibility"]["verdict"] == "secondary"
    assert out["merlinMealworm"]["consumed"] == {"inventory.larder.mealworm_scoop": 1}
    assert out["merlinMealworm"]["state"]["inventory"]["larder"]["mealworm_scoop"] == 1
    assert out["merlinMealworm"]["state"]["merlinCare"]["hunger"] < 0.001
    # Food outside the diet entirely is still refused, and still costs nothing.
    assert out["finchFish"]["ok"] is False
    assert out["finchFish"]["state"]["inventory"]["larder"]["live_minnow"] == 1
    assert out["finchSeed"]["ok"] is True


def test_val_pantry_001_and_003_reachable_kitchen_flow_exposes_diet_guidance_and_inventory_bridge():
    html = INDEX.read_text(encoding="utf-8")
    required = [
        'data-kitchen-roster-root',
        'data-diet-guidance',
        'data-diet-provenance',
        'data-compatible-foods',
        'data-kitchen-roster-food',
        'data-pantry-count',
        'data-feed-transaction-id',
        'data-feed-result-sheet',
        '__burbzDietHungerDebug',
    ]
    missing = [marker for marker in required if marker not in html]
    assert not missing, "Kitchen/Pantry flow is missing contract-visible hooks: " + ", ".join(missing)
    assert "small_bird_prey_ration" in html
    assert "source-backed" in html.lower()


def test_val_regression_001_cache_pins_new_diet_hunger_assets_and_keeps_protected_features():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    runtime_assets = [
        "diet_hunger_core.js?v=diet-hunger-release-20260723",
        "data/bird-diet-records.js?v=reconciled-release-v170-20260729",
    ]
    for asset in runtime_assets:
        assert asset in html, f"{asset} is not loaded by index.html"
        assert "./" + asset in sw, f"{asset} is not cached by sw.js"
    assert "burbz-side-snacks-hunger-metre-v142-20260726" in sw
    for protected in (
        "const MERLIN_GUIDE",
        "BirdNET",
        "camera-only",
        "pair_of_tits",
        "national_bird_completion_20260715.js",
    ):
        assert protected in html + "\n" + sw
