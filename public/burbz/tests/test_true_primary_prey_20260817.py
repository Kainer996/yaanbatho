"""A bird's primary foods are what it primarily eats.

The reported bug, from a Peregrine Falcon card: "Primary: Reptiles and
amphibians · Small-bird prey rations · Small mammals". EltonTraits gives the
Peregrine 80% warm-blooded prey and 10% cold-blooded — yet the old mapping
copied the full warm-blooded share onto reptiles ("voles imply frogs") and
onto both small_birds AND small_mammals, so three families tied at 80 and the
alphabet put reptiles first on the card.

The true-primary-prey rules this file pins:

* reptiles_amphibians scores only its real source evidence (Diet-Vect and,
  for ground-prey birds, Diet-Vunk). Mammal-hunters keep frogs and lizards
  as side prey at a nominal score that can never reach primary rank;
* Diet-Vend splits by hunting style: bird-chasers (accipiters, Peregrine,
  Hobby) put the share on small_birds, vole-hunters (kestrels, Buteo hawks,
  owls) on small_mammals, and the other one becomes side prey;
* Diet-Vunk (vertebrates of unknown type) reads as seabird chicks, eggs and
  carcasses for pelagic scavenger-hunters — a Giant-Petrel's menu has no
  reptiles and no voles;
* structurally: no record anywhere ranks a family as primary on a nominal
  side-prey score, and no reptile primary exists without source evidence.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=90
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


def test_the_peregrine_card_leads_with_birds_not_reptiles():
    out = run_node(
        """
global.window = global;
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const peregrine = { commonName:'Peregrine Falcon', scientificName:'Falco peregrinus' };
const d = D.dietDisclosureForSpecies(peregrine);
const v = (id, prep) => D.scoreFoodCompatibility(peregrine, { ingredientId:id, prep }).verdict;
console.log(JSON.stringify({
  primaryLabels: d.primaryLabels,
  secondaryLabels: d.secondaryLabels,
  pigeon: v('pigeon_prey_ration', 'whole'),
  vole: v('field_vole', 'live'),
  lizard: v('common_lizard', 'live')
}));
"""
    )
    # The exact card from the bug report: birds lead, nothing else shares top billing.
    assert out["primaryLabels"] == ["Small-bird prey rations"]
    assert "Reptiles and amphibians" not in out["primaryLabels"]
    assert out["pigeon"] == "primary"
    # Real but minor prey stays on the menu as side food.
    assert out["vole"] == "secondary"
    assert out["lizard"] == "secondary"


def test_hunting_styles_split_the_warm_blooded_share():
    out = run_node(
        """
global.window = global;
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const v = (sci, id, prep) => D.scoreFoodCompatibility({ scientificName:sci }, { ingredientId:id, prep }).verdict;
console.log(JSON.stringify({
  sparrowhawkStarling: v('Accipiter nisus', 'starling_prey_ration', 'whole'),
  sparrowhawkVole: v('Accipiter nisus', 'field_vole', 'live'),
  kestrelVole: v('Falco tinnunculus', 'field_vole', 'live'),
  kestrelBird: v('Falco tinnunculus', 'small_bird_prey_ration', 'whole'),
  barnOwlVole: v('Tyto alba', 'field_vole', 'live'),
  barnOwlBird: v('Tyto alba', 'small_bird_prey_ration', 'whole'),
  buzzardRabbit: v('Buteo buteo', 'young_rabbit', 'live'),
  buzzardBird: v('Buteo buteo', 'small_bird_prey_ration', 'whole'),
  goldfinchBird: v('Carduelis carduelis', 'small_bird_prey_ration', 'whole')
}));
"""
    )
    # Bird-chasers: birds are the hunt, mammals the side catch.
    assert out["sparrowhawkStarling"] == "primary"
    assert out["sparrowhawkVole"] == "secondary"
    # Vole-hunters: mammals are the hunt, birds the side catch.
    assert out["kestrelVole"] == "primary"
    assert out["kestrelBird"] == "secondary"
    assert out["barnOwlVole"] == "primary"
    assert out["barnOwlBird"] == "secondary"
    assert out["buzzardRabbit"] == "primary"
    assert out["buzzardBird"] == "secondary"
    # A seed-eater still refuses prey outright.
    assert out["goldfinchBird"] == "refused"


def _all_records():
    payload = json.loads((ROOT / "data" / "bird-diet-records.json").read_text(encoding="utf-8"))
    return payload, payload["records"] + payload["catalogueRecords"]


def test_pelagic_scavengers_read_unknown_vertebrates_as_chicks_and_carrion():
    _, records = _all_records()
    by_name = {record["name"]: record for record in records}
    for name in ("Southern Giant-Petrel", "Black-faced Sheathbill"):
        record = by_name[name]
        primary = set(record["primaryCompatibleFamilies"])
        assert primary == {"carrion", "small_birds"}, f"{name} primary is {sorted(primary)}"
        families = set(primary) | set(record["secondaryCompatibleFamilies"])
        assert "reptiles_amphibians" not in families, f"{name} has no reptiles to eat"
        assert "small_mammals" not in families, f"{name} has no voles to eat"


def test_no_record_crowns_a_primary_without_real_source_evidence():
    payload, records = _all_records()
    assert payload["metadata"]["version"] == "diet-true-primary-prey-20260817"
    checked = 0
    for record in records:
        percentages = record.get("dietPercentages")
        scores = record.get("gameFamilyScores") or {}
        if not percentages:
            continue
        ect = float(percentages.get("Diet-Vect") or 0)
        vunk = float(percentages.get("Diet-Vunk") or 0)
        for family in record.get("primaryCompatibleFamilies") or []:
            # A nominal side-prey score (see SIDE_PREY_SCORE in the generator)
            # must never rank primary.
            assert float(scores.get(family, 0)) > 5, (
                f"{record.get('name')} ranks {family} primary on a nominal score"
            )
        if "reptiles_amphibians" in (record.get("primaryCompatibleFamilies") or []):
            assert max(ect, vunk) >= 10, (
                f"{record.get('name')} ranks reptiles primary without source evidence"
            )
        checked += 1
    assert checked > 1000, "expected the full generated population"
