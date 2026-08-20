"""No bird's menu lists prey a field guide would laugh at.

Yaan's report, from the Head Chef service board: "River Trout · eaten by
Robin". EltonTraits carries handbook trivia — 10% fish, herptile and carrion
shares on the Robin's row — and family-fallback records inherit trace dust
(a warbler at 0.03% fish). Both read as absurd menu lines once the game turns
a percentage into a serving.

The field-guide-menus rules this file pins:

* a food family needs at least MIN_FAMILY_SHARE (5) of the mapped diet to
  make the menu — fallback dust is noise, not diet. Deliberate side prey
  (score 5) and curated refinement side foods (score 1) survive;
* a songbird's unknown-vertebrate share reads as lizards and frogs, never
  voles (corvids, shrikes and butcherbirds excepted — they truly take
  mammals). Ducks follow the Mallard rule: tadpoles and newts, not voles;
* curated BTO/BWP refinements: the Robin eats no fish, reptiles or carrion;
  the Wren no fish or reptiles; the Greenshank no mammals. The Rock Pipit
  KEEPS its fish — it genuinely forages small fish from tidal wrack.
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


def test_the_robin_and_its_neighbours_eat_what_the_field_guide_says():
    out = run_node(
        """
global.window = global;
require('./data/bird-diet-records.js');
const D = require('./bird_diet_hunger_core.js');
const v = (sci, id, prep) => D.scoreFoodCompatibility({ scientificName:sci }, { ingredientId:id, prep }).verdict;
console.log(JSON.stringify({
  robinTrout: v('Erithacus rubecula', 'river_trout', 'live'),
  robinMinnow: v('Erithacus rubecula', 'live_minnow', 'live'),
  robinSandEel: v('Erithacus rubecula', 'sand_eel', 'live'),
  robinLizard: v('Erithacus rubecula', 'common_lizard', 'live'),
  robinCarrion: v('Erithacus rubecula', 'carrion_scraps', 'fresh'),
  robinWorm: v('Erithacus rubecula', 'garden_worms', 'fresh'),
  robinBerries: v('Erithacus rubecula', 'hedgerow_berries', 'fresh'),
  wrenMinnow: v('Troglodytes troglodytes', 'live_minnow', 'live'),
  greenshankRabbit: v('Tringa nebularia', 'young_rabbit', 'live'),
  greenshankVole: v('Tringa nebularia', 'field_vole', 'live'),
  greenshankSandEel: v('Tringa nebularia', 'sand_eel', 'live'),
  greenshankFrog: v('Tringa nebularia', 'common_frog', 'live'),
  blackbirdVole: v('Turdus merula', 'field_vole', 'live'),
  blackbirdFrog: v('Turdus merula', 'common_frog', 'live'),
  rockPipitMinnow: v('Anthus petrosus', 'live_minnow', 'live'),
  pintailVole: v('Anas acuta', 'field_vole', 'live')
}));
"""
    )
    # The reported bug, dead: no fish of any size for a Robin.
    for key in ("robinTrout", "robinMinnow", "robinSandEel", "robinLizard", "robinCarrion"):
        assert out[key] == "refused", f"{key} must be refused, got {out[key]}"
    # Its real diet is untouched.
    assert out["robinWorm"] == "primary"
    assert out["robinBerries"] == "secondary"
    assert out["wrenMinnow"] == "refused"
    # The Greenshank hunts the shallows, not the warren.
    assert out["greenshankRabbit"] == "refused"
    assert out["greenshankVole"] == "refused"
    assert out["greenshankSandEel"] == "secondary"
    assert out["greenshankFrog"] == "secondary"
    # A songbird's or a duck's unknown vertebrates are herptiles, not voles.
    assert out["blackbirdVole"] == "refused"
    assert out["blackbirdFrog"] == "secondary"
    assert out["pintailVole"] == "refused"
    # Documented exceptions survive: Rock Pipits truly take small fish.
    assert out["rockPipitMinnow"] == "secondary"


def test_fallback_dust_never_reaches_a_menu():
    payload = json.loads((ROOT / "data" / "bird-diet-records.json").read_text(encoding="utf-8"))
    records = payload["records"] + payload["catalogueRecords"]
    checked = 0
    for record in records:
        if record.get("matchMethod") == "unmatched":
            continue  # the conservative fallback menu uses nominal scores by design
        for family, value in (record.get("gameFamilyScores") or {}).items():
            # Every score is a real share (>= 5) or a curated refinement's
            # nominal side food (exactly 1). Nothing in between: that band is
            # family-average dust and must be filtered by MIN_FAMILY_SHARE.
            assert float(value) >= 5 or float(value) == 1, (
                f"{record.get('name')} carries dust score {family}={value}"
            )
            checked += 1
    assert checked > 3000, "expected the full generated population"
