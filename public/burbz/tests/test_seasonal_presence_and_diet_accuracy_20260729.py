"""Season, place, and what a bird will actually eat.

Two complaints, one job.

1. The Kingdom of Burbz is drawn on the player's real map, but it had no idea
   what month it was. Every one of the 152 British area species was eligible to
   spawn in all twelve months, so a Swift could hawk over a January street while
   the real ones were over the Congo, and a Fieldfare could turn up in July.
   Season and range now gate every spawn, using the device clock and the
   geolocation fix the live map already holds.

2. A Carrion Crow refused an earthworm. BirdFuncDat files every invertebrate on
   earth in one Diet-Inv column, and the game split that column by guessing from
   the bird's name — corvids matched no rule, so they got "general invertebrates"
   and nothing else. The split now comes from the source's own ForStrat columns
   (where a bird forages decides which invertebrates reach it), Diet-Vend is no
   longer narrowed to mammals for anything that is not a raptor, and a curated
   correction layer fixes the species BirdFuncDat is plainly wrong about.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SEASON_CORE = ROOT / "seasonal_presence_core.js"
SW = ROOT / "sw.js"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=120
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


# ---------------------------------------------------------------------------
# 1. The season core knows when a bird is in the country
# ---------------------------------------------------------------------------

SEASON_HARNESS = r"""
const S = require('./seasonal_presence_core.js');
const uk = { region:'uk', lat:53.19, lon:-2.89 };       // Chester
const highlands = { region:'uk', lat:57.2, lon:-4.5 };
const melbourne = { region:'au', lat:-37.81, lon:144.96 };
const report = (name, month, where) => S.presenceReport(name, { ...(where || uk), month });
console.log(JSON.stringify({
  swiftJanuary: report('Swift', 1),
  swiftJune: report('Swift', 6),
  cuckooNovember: report('Cuckoo', 11),
  fieldfareJuly: report('Fieldfare', 7),
  fieldfareDecember: report('Fieldfare', 12),
  waxwingJune: report('Bohemian Waxwing', 6),
  puffinDecember: report('Puffin', 12),
  puffinMay: report('Puffin', 5),
  blackbirdJanuary: report('Blackbird', 1),
  robinJuly: report('European Robin', 7),
  goldenEagleCheshire: report('Golden Eagle', 6),
  goldenEagleHighlands: report('Golden Eagle', 6, highlands),
  koelJuly: report('Asian Koel', 7, melbourne),
  koelDecember: report('Asian Koel', 12, melbourne),
  unknownBird: report('Gondor Rock Thrush', 1),
  northernSeason: S.nowContext(new Date(2026, 0, 15), 53.19),
  southernSeason: S.nowContext(new Date(2026, 0, 15), -37.81),
  birdnetWeekJan1: S.birdnetWeek(new Date(2026, 0, 1)),
  birdnetWeekDec31: S.birdnetWeek(new Date(2026, 11, 31)),
  ukSpeciesCovered: S.knownSpecies('uk').length,
  auSpeciesCovered: S.knownSpecies('au').length
}));
"""


def test_a_summer_migrant_is_absent_in_winter_and_present_in_summer():
    out = run_node(SEASON_HARNESS)
    assert out["swiftJanuary"]["present"] is False
    assert out["swiftJanuary"]["reason"] == "out-of-season"
    assert out["swiftJanuary"]["statusLabel"] == "Summer visitor"
    assert out["swiftJune"]["present"] is True
    assert out["cuckooNovember"]["present"] is False


def test_a_winter_visitor_is_absent_in_summer():
    out = run_node(SEASON_HARNESS)
    assert out["fieldfareJuly"]["present"] is False
    assert out["fieldfareDecember"]["present"] is True
    assert out["waxwingJune"]["present"] is False
    assert out["waxwingJune"]["statusLabel"] == "Irruptive visitor"


def test_a_seabird_ashore_only_to_breed_is_absent_the_rest_of_the_year():
    out = run_node(SEASON_HARNESS)
    assert out["puffinDecember"]["present"] is False
    assert out["puffinMay"]["present"] is True
    assert "Atlantic" in out["puffinDecember"]["note"]


def test_residents_are_never_gated_by_season():
    out = run_node(SEASON_HARNESS)
    assert out["blackbirdJanuary"]["present"] is True
    assert out["robinJuly"]["present"] is True


def test_range_is_checked_as_well_as_season():
    out = run_node(SEASON_HARNESS)
    assert out["goldenEagleCheshire"]["present"] is False
    assert out["goldenEagleCheshire"]["reason"] == "out-of-range"
    assert out["goldenEagleHighlands"]["present"] is True


def test_the_southern_hemisphere_gets_its_own_seasons():
    out = run_node(SEASON_HARNESS)
    assert out["northernSeason"]["seasonLabel"] == "Winter"
    assert out["southernSeason"]["seasonLabel"] == "Summer"
    # A trans-equatorial migrant to south-east Australia, absent in July.
    assert out["koelJuly"]["present"] is False
    assert out["koelDecember"]["present"] is True


def test_an_unknown_bird_fails_open_so_the_expansions_still_own_their_species():
    out = run_node(SEASON_HARNESS)
    assert out["unknownBird"]["present"] is True
    assert out["unknownBird"]["known"] is False


def test_the_core_actually_covers_the_legacy_roster():
    out = run_node(SEASON_HARNESS)
    assert out["ukSpeciesCovered"] >= 45
    assert out["auSpeciesCovered"] >= 4


def test_the_week_sent_to_birdnet_is_on_birdnets_own_1_to_48_scale():
    out = run_node(SEASON_HARNESS)
    assert out["birdnetWeekJan1"] == 1
    assert out["birdnetWeekDec31"] == 48


# ---------------------------------------------------------------------------
# 2. The gate is actually wired into the spawn picker
# ---------------------------------------------------------------------------

SPAWN_HARNESS = r"""
const fs = require('fs');
const html = fs.readFileSync('index.html', 'utf8');
global.window = global;
['uk_bird_expansion_50.js','uk_bird_expansion_2.js','au_bird_expansion.js','uk_bird_expansion_3.js',
 'au_bird_expansion_2.js','national_bird_completion_20260715.js','uk_bird_expansion_4.js',
 'spain_boundary_20260715.js','seasonal_presence_core.js'].forEach(f => require('./' + f));

const SEASON = global.BurbzSeasonalPresenceCore;
const UK50 = global.BURBZ_UK_BIRD_EXPANSION_50, UK26 = global.BURBZ_UK_BIRD_EXPANSION_26;
const UK_FINAL = global.BURBZ_UK_BIRD_EXPANSION_FINAL, UK4 = global.BURBZ_UK_BIRD_EXPANSION_4;
const AU50 = global.BURBZ_AU_BIRD_EXPANSION_50;
const NATIONAL = global.BURBZ_NATIONAL_BIRD_COMPLETION_20260715;

// Take the name helpers from the page rather than retyping them — a copy that
// drifts would green-light a predicate that is not the one shipping.
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
// canonicalSpeciesName consults the roster; this harness works from names
// alone, so the lookup returns nothing and its plain-name branch is the one
// under test — which is also the branch every roster name already takes.
global.findSpeciesProfile = () => null;
new Function(['canonicalSpeciesName', 'normaliseSpeciesKey'].map(fnSrc).join('\n')
  + '\nglobal.canonicalSpeciesName = canonicalSpeciesName;'
  + '\nglobal.normaliseSpeciesKey = normaliseSpeciesKey;')();

const at = html.indexOf('const REGION_AREA_SPECIES = {');
const REGION_AREA_SPECIES = eval('(' + html.slice(at, html.indexOf('\n};', at) + 2)
  .replace('const REGION_AREA_SPECIES = ', '') + ')');

// The same composed predicate pickHabitatBird() uses, season gate first.
function eligibleIn(region, lat, lon) {
  return (species, month, habitat = '') => {
    if (!SEASON.presenceReport(canonicalSpeciesName(species), { region, lat, lon, habitat, month }).present) return false;
    if (NATIONAL.isEligible(region, species, lat, lon, month, habitat)) return true;
    if (NATIONAL.names.some(n => normaliseSpeciesKey(n) === normaliseSpeciesKey(species))) return false;
    if (region === 'uk') return UK50.isEligible(species, lat, lon, month, habitat) && UK26.isEligible(species, lat, lon, month, habitat) && UK_FINAL.isEligible(species, lat, lon, month, habitat) && UK4.isEligible(species, lat, lon, month, habitat);
    if (region === 'au') return AU50.isEligible(species, lat, lon, month, habitat);
    return false;
  };
}
const uk = eligibleIn('uk', 53.19, -2.89);
const au = eligibleIn('au', -37.81, 144.96);
const poolSize = (names, fn, month) => names.filter(s => fn(s, month)).length;
console.log(JSON.stringify({
  januaryImpossible: ['Swift','Swallow','House Martin','Sand Martin','Cuckoo','Common Redstart',
                      'Turtle Dove','Osprey','Common Nightingale','Puffin','Spotted Flycatcher']
    .filter(s => uk(s, 1)),
  julyImpossible: ['Fieldfare','Redwing','Brambling','Bohemian Waxwing','Whooper Swan',
                   'Brent Goose','Pink-footed Goose']
    .filter(s => uk(s, 7)),
  residentsBlocked: ['Blackbird','Blue Tit','Carrion Crow','Wood Pigeon','Magpie','House Sparrow','Robin']
    .filter(s => REGION_AREA_SPECIES.uk.includes(s) && [1, 4, 7, 10].some(m => !uk(s, m))),
  ukPoolByMonth: [1, 4, 7, 10].map(m => poolSize(REGION_AREA_SPECIES.uk, uk, m)),
  ukRosterSize: REGION_AREA_SPECIES.uk.length,
  auPoolByMonth: [1, 7].map(m => poolSize(REGION_AREA_SPECIES.au, au, m)),
  auRosterSize: REGION_AREA_SPECIES.au.length
}));
"""


def test_impossible_birds_never_reach_the_map():
    out = run_node(SPAWN_HARNESS)
    assert out["januaryImpossible"] == [], "these are in Africa in January"
    assert out["julyImpossible"] == [], "these are in the Arctic in July"


def test_residents_still_spawn_in_every_month():
    out = run_node(SPAWN_HARNESS)
    assert out["residentsBlocked"] == []


def test_the_gate_narrows_the_roster_without_emptying_it():
    out = run_node(SPAWN_HARNESS)
    # Something must be filtered in every month, or the gate is not running...
    assert all(size < out["ukRosterSize"] for size in out["ukPoolByMonth"])
    # ...and most of the country's birds are residents, so most must remain.
    assert all(size > out["ukRosterSize"] * 0.6 for size in out["ukPoolByMonth"])
    assert all(size > out["auRosterSize"] * 0.6 for size in out["auPoolByMonth"])
    # The southern-hemisphere migrants leave in the southern winter.
    assert out["auPoolByMonth"][1] < out["auPoolByMonth"][0]


def test_the_page_loads_the_season_core_and_gates_spawns_with_it():
    html = INDEX.read_text(encoding="utf-8")
    assert 'src="seasonal_presence_core.js' in html
    assert "SEASON.isPresent(species, seasonContext)" in html
    picker = html[html.index("function pickHabitatBird("):]
    picker = picker[: picker.index("\nfunction ")]
    assert "SEASON.isPresent(species, seasonContext)" in picker
    # And the service worker ships it, or an offline player gets the old rules.
    sw = SW.read_text(encoding="utf-8")
    assert sw.count("./seasonal_presence_core.js") == 2


def test_the_field_guide_answers_where_is_it_right_now():
    """A separate question from "when does it breed", and the one a player asks
    when a bird they caught last summer stops appearing on their map."""
    html = INDEX.read_text(encoding="utf-8")
    block = html[html.index("function renderSeasonHereBlock("):]
    block = block[: block.index("\nfunction renderEducationSections(")]
    assert "speciesPresenceHere" in block
    assert "In your area now" in block
    assert "out-of-range" in block
    assert "${renderSeasonHereBlock(bird)}" in html


def test_the_area_birds_panel_says_what_season_it_is():
    html = INDEX.read_text(encoding="utf-8")
    assert 'id="mapAreaBirdsSeason"' in html
    line = html[html.index("function renderAreaBirdsSeasonLine("):]
    line = line[: line.index("\nfunction renderAreaBirdColumns(")]
    assert "seasonSummary" in line
    assert "monthLabel" in line and "seasonLabel" in line
    # And it is refreshed whenever the list is.
    assert "renderAreaBirdsSeasonLine();" in html[html.index("function renderAreaBirdColumns("):][:900]


def test_the_date_comes_from_the_device_clock_not_a_server():
    core = SEASON_CORE.read_text(encoding="utf-8")
    assert "new Date()" in core
    html = INDEX.read_text(encoding="utf-8")
    # And the same clock is what the sound scan tells BirdNET.
    upload = html[html.index("async function uploadRecording("):]
    upload = upload[: upload.index("\nasync function ")]
    assert "formData.append('week'" in upload
    assert "birdnetWeek" in upload


# ---------------------------------------------------------------------------
# 3. Diets: the Carrion Crow complaint and everything behind it
# ---------------------------------------------------------------------------

DIET_HARNESS = r"""
const D = require('./bird_diet_hunger_core.js');
const feed = (species, ingredientId) => {
  const spec = D.normalizeFeedingSpec(ingredientId);
  const r = D.scoreFoodCompatibility(species, spec);
  return { verdict:r.verdict, nourishment:r.nourishment };
};
const families = species => {
  const rec = D.getDietRecord(species) || {};
  return {
    primary: rec.primaryCompatibleFamilies || [],
    secondary: rec.secondaryCompatibleFamilies || [],
    scientificName: rec.scientificName || rec.scientific || null
  };
};
console.log(JSON.stringify({
  crowWorms: feed('Carrion Crow', 'garden_worms'),
  crowCarrion: feed('Carrion Crow', 'carrion_scraps'),
  crowMealworms: feed('Carrion Crow', 'mealworm_scoop'),
  crowNectar: feed('Carrion Crow', 'nectar_cup'),
  crowFamilies: families('Carrion Crow'),
  magpieFamilies: families('Magpie'),
  blackbirdWorms: feed('Blackbird', 'garden_worms'),
  robinWorms: feed('European Robin', 'garden_worms'),
  starlingWorms: feed('Starling', 'garden_worms'),
  buzzardWorms: feed('Buzzard', 'garden_worms'),
  // Aerial hawkers must never be handed something that lives in soil.
  swiftWorms: feed('Swift', 'garden_worms'),
  swallowWorms: feed('Swallow', 'garden_worms'),
  swiftMidges: feed('Swift', 'aerial_midges'),
  // Canopy gleaners are not worm-pullers either.
  blueTitWorms: feed('Blue Tit', 'garden_worms'),
  goldfinchWorms: feed('Goldfinch', 'garden_worms'),
  // The omnivores the player is most likely to meet.
  herringGullSeeds: feed('Herring Gull', 'sunflower_seeds'),
  herringGullBerries: feed('Herring Gull', 'hedgerow_berries'),
  herringGullFish: feed('Herring Gull', 'live_minnow'),
  // ...and the counterweight: a gull that genuinely is a fish specialist.
  kittiwakeFamilies: families('Kittiwake'),
  kittiwakeSeeds: feed('Kittiwake', 'sunflower_seeds'),
  // Specialists stay specialists.
  ospreyFish: feed('Osprey', 'river_trout'),
  ospreySeeds: feed('Osprey', 'sunflower_seeds'),
  goldcrestSeeds: feed('Goldcrest', 'sunflower_seeds'),
  // Diet-PlantO ("leaves, buds, shoots") outscored Diet-Seed for several seed
  // specialists, so the game asked the player to feed them pondweed.
  crossbillSeeds: feed('Red Crossbill', 'sunflower_seeds'),
  cardinalSeeds: feed('Northern Cardinal', 'sunflower_seeds'),
  partridgeSeeds: feed('Grey Partridge', 'sunflower_seeds'),
  lorikeetNectar: feed('Musk Lorikeet', 'nectar_cup'),
  snipeWorms: feed('Common Snipe', 'garden_worms'),
  fieldfareBerries: feed('Fieldfare', 'hedgerow_berries'),
  mistleThrushBerries: feed('Mistle Thrush', 'hedgerow_berries'),
  littleGrebeFish: feed('Little Grebe', 'live_minnow'),
  // Heather shoots really are a Red Grouse's staple, so leafy plants stay put.
  redGrouseFamilies: families('Red Grouse'),
  feeding: ['Carrion Crow','Herring Gull','Raven','Blue Tit','Osprey','Goldcrest','Swift','Kingfisher']
    .reduce((acc, n) => { acc[n] = D.feedingProfileForSpecies(n); return acc; }, {}),
  disclosure: D.dietDisclosureForSpecies('Carrion Crow')
}));
"""


def test_a_carrion_crow_eats_the_worm():
    out = run_node(DIET_HARNESS)
    assert out["crowWorms"]["verdict"] == "primary", "the original bug: crows pull worms out of pasture"
    assert out["crowWorms"]["nourishment"] > 0
    assert "worms" in out["crowFamilies"]["primary"]


def test_a_carrion_crow_eats_the_other_things_a_carrion_crow_eats():
    out = run_node(DIET_HARNESS)
    assert out["crowCarrion"]["verdict"] == "primary", "it is called a Carrion Crow"
    assert out["crowMealworms"]["verdict"] == "primary"
    compatible = out["crowFamilies"]["primary"] + out["crowFamilies"]["secondary"]
    for family in ("carrion", "worms", "invertebrates", "seeds", "fruit_berries", "small_birds"):
        assert family in compatible, family
    # But it is still not a hummingbird.
    assert out["crowNectar"]["verdict"] == "refused"


def test_the_uk_magpie_is_not_fed_an_australian_magpies_diet():
    out = run_node(DIET_HARNESS)
    # "Magpie" used to resolve to Gymnorhina tibicen, because the source calls
    # Pica pica a "Black-billed Magpie" and the generic "Australian <name>"
    # candidate won the race.
    assert out["magpieFamilies"]["scientificName"] == "Pica pica"


def test_ground_feeders_take_worms_and_canopy_feeders_do_not():
    out = run_node(DIET_HARNESS)
    for key in ("blackbirdWorms", "robinWorms", "starlingWorms"):
        assert out[key]["verdict"] == "primary", key
    assert out["buzzardWorms"]["verdict"] == "secondary", "buzzards walk fields for worms in the wet"
    assert out["blueTitWorms"]["verdict"] == "refused"
    assert out["goldfinchWorms"]["verdict"] == "refused"


def test_birds_that_feed_on_the_wing_are_never_offered_soil_food():
    out = run_node(DIET_HARNESS)
    assert out["swiftWorms"]["verdict"] == "refused"
    assert out["swallowWorms"]["verdict"] == "refused"
    assert out["swiftMidges"]["verdict"] == "primary"


def test_a_herring_gull_eats_almost_anything():
    out = run_node(DIET_HARNESS)
    for key in ("herringGullSeeds", "herringGullBerries", "herringGullFish"):
        assert out[key]["verdict"] in ("primary", "secondary"), key
    assert out["feeding"]["Herring Gull"]["tier"] == "omnivore"


def test_a_kittiwake_is_the_gull_that_does_not():
    out = run_node(DIET_HARNESS)
    # The one British gull that lives at sea; the source's seed and vertebrate
    # columns for it are family-level noise.
    assert out["kittiwakeSeeds"]["verdict"] == "refused"
    compatible = out["kittiwakeFamilies"]["primary"] + out["kittiwakeFamilies"]["secondary"]
    assert "fish" in compatible
    assert "small_birds" not in compatible


def test_specialists_stay_hard():
    out = run_node(DIET_HARNESS)
    assert out["ospreyFish"]["verdict"] == "primary"
    assert out["ospreySeeds"]["verdict"] == "refused"
    assert out["goldcrestSeeds"]["verdict"] == "refused"
    assert out["feeding"]["Osprey"]["tier"] == "specialist"
    assert out["feeding"]["Goldcrest"]["tier"] == "specialist"
    assert out["feeding"]["Swift"]["tier"] == "specialist"


def test_an_easy_bird_to_feed_is_labelled_as_one():
    out = run_node(DIET_HARNESS)
    for omnivore in ("Carrion Crow", "Herring Gull", "Raven"):
        profile = out["feeding"][omnivore]
        assert profile["tier"] == "omnivore", omnivore
        assert profile["omnivore"] is True
        assert profile["difficulty"] == 1, omnivore
        assert "easiest" in profile["summary"]
    # And a hard one is ranked as harder, so the two are comparable.
    assert out["feeding"]["Osprey"]["difficulty"] > out["feeding"]["Carrion Crow"]["difficulty"]
    assert out["feeding"]["Carrion Crow"]["breadth"] > out["feeding"]["Kingfisher"]["breadth"]


def test_seed_specialists_are_fed_seed_and_not_pondweed():
    out = run_node(DIET_HARNESS)
    for key in ("crossbillSeeds", "cardinalSeeds", "partridgeSeeds"):
        assert out[key]["verdict"] == "primary", key
    assert out["lorikeetNectar"]["verdict"] == "primary", "a brush tongue is for blossom"
    # But a bird whose staple really is leafy growth keeps it.
    assert out["redGrouseFamilies"]["primary"] == ["foliage_buds"]


def test_no_land_bird_is_offered_pondweed_as_a_main_meal():
    """Diet-PlantO is "other plant material" — pondweed, clover, heather shoots,
    buds and mast in one column — and it all used to land on the aquatic-plant
    family, whose only ingredient is a Pondweed Tangle. Right for a Mallard,
    absurd for a Wild Turkey. The split now follows the same ForStrat evidence
    the invertebrate split does."""
    out = run_node(
        r"""
const D = require('./bird_diet_hunger_core.js');
const dry = ['Wild Turkey','Red Junglefowl','California Quail','Golden Pheasant','Two-barred Crossbill',
             'Pine Grosbeak','Monk Parakeet','Red Grouse','Northern Cardinal','Great Bustard'];
const wet = ['Mallard','Mute Swan','Canada Goose','Eurasian Coot'];
const primary = n => ((D.getDietRecord(n) || {}).primaryCompatibleFamilies) || [];
console.log(JSON.stringify({
  dryBirdsOnPondweed: dry.filter(n => primary(n).includes('aquatic_plants')),
  dryBirdsMissingRecord: dry.filter(n => !D.getDietRecord(n)),
  waterBirdsKeepingPondweed: wet.filter(n => primary(n).includes('aquatic_plants')),
  turkeyBrowse: D.scoreFoodCompatibility('Wild Turkey', { ingredientId:'leaf_bud_browse', prep:'fresh' }).verdict,
  turkeyPondweed: D.scoreFoodCompatibility('Wild Turkey', { ingredientId:'pondweed_tangle', prep:'floating' }).verdict,
  swanPondweed: D.scoreFoodCompatibility('Mute Swan', { ingredientId:'pondweed_tangle', prep:'floating' }).verdict
}));
"""
    )
    assert out["dryBirdsMissingRecord"] == []
    assert out["dryBirdsOnPondweed"] == [], "these birds never forage in or on water"
    assert out["waterBirdsKeepingPondweed"] == ["Mallard", "Mute Swan", "Canada Goose", "Eurasian Coot"]
    assert out["turkeyBrowse"] == "primary"
    assert out["turkeyPondweed"] == "refused"
    assert out["swanPondweed"] == "primary"


def test_a_staple_is_a_full_meal_even_when_something_else_scores_higher():
    """Only the exact top-scoring family used to count as a main meal, so a food
    on 30% of a bird's diet became a half portion next to one on 40%. That is
    what made a Blackbird's berries and a Jay's acorns side dishes."""
    out = run_node(
        r"""
const D = require('./bird_diet_hunger_core.js');
const feed = (s, i) => D.scoreFoodCompatibility(s, D.normalizeFeedingSpec(i)).verdict;
console.log(JSON.stringify({
  blackbirdBerries: feed('Blackbird', 'hedgerow_berries'),
  // Acorns are the seed family, and a Jay husks them like any other seed.
  jayAcorns: D.scoreFoodCompatibility('Jay', { ingredientId:'acorn_handful', prep:'husked' }).verdict,
  woodpigeonSeeds: feed('Wood Pigeon', 'sunflower_seeds'),
  // The band widens the primary set; it must not make everything a main meal.
  goldfinchFish: feed('Goldfinch', 'live_minnow'),
  swiftWorms: feed('Swift', 'garden_worms'),
  kingfisherSeeds: feed('Kingfisher', 'sunflower_seeds'),
  mallardBrowse: feed('Mallard', 'leaf_bud_browse')
}));
"""
    )
    assert out["blackbirdBerries"] == "primary"
    assert out["jayAcorns"] == "primary"
    assert out["woodpigeonSeeds"] == "primary"
    assert out["goldfinchFish"] == "refused"
    assert out["swiftWorms"] == "refused"
    assert out["kingfisherSeeds"] == "refused"
    assert out["mallardBrowse"] == "secondary", "a real but secondary food stays a half portion"


def test_every_expansion_species_has_a_diet_too():
    """The expansions push 235 more names into the spawn roster at load, and none
    of them had a diet record — so a Nightjar refused flying insects and a
    Guillemot refused fish, both falling through to the seed-and-berry
    fallback."""
    out = run_node(
        r"""
global.window = global;
const D = require('./bird_diet_hunger_core.js');
const names = new Set();
for (const f of ['uk_bird_expansion_50.js','uk_bird_expansion_2.js','uk_bird_expansion_3.js',
                 'uk_bird_expansion_4.js','au_bird_expansion.js','au_bird_expansion_2.js']) {
  for (const n of (require('./' + f).names || [])) names.add(n);
}
const feed = (s, i) => D.scoreFoodCompatibility(s, D.normalizeFeedingSpec(i)).verdict;
console.log(JSON.stringify({
  total: names.size,
  missing: [...names].filter(n => !D.getDietRecord(n)),
  nightjarMidges: feed('Nightjar', 'aerial_midges'),
  guillemotFish: feed('Guillemot', 'sand_eel'),
  henHarrierVole: feed('Hen Harrier', 'field_vole'),
  woodcockWorms: feed('Woodcock', 'garden_worms')
}));
"""
    )
    assert out["total"] > 200
    assert out["missing"] == []
    assert out["nightjarMidges"] == "primary"
    assert out["guillemotFish"] == "primary"
    assert out["henHarrierVole"] == "primary"
    assert out["woodcockWorms"] == "primary"


def test_the_bird_whose_bill_is_a_worm_probe_gets_worms_as_a_main_meal():
    out = run_node(DIET_HARNESS)
    assert out["snipeWorms"]["verdict"] == "primary"


def test_winter_berry_thrushes_treat_berries_as_a_main_meal():
    out = run_node(DIET_HARNESS)
    assert out["fieldfareBerries"]["verdict"] == "primary"
    assert out["mistleThrushBerries"]["verdict"] == "primary"


def test_a_diving_fish_eater_is_allowed_fish():
    out = run_node(DIET_HARNESS)
    assert out["littleGrebeFish"]["verdict"] in ("primary", "secondary")


def test_a_curated_correction_says_so_rather_than_posing_as_raw_source_data():
    out = run_node(DIET_HARNESS)
    disclosure = out["disclosure"]
    assert disclosure["corrected"] is True, "a corrected record must admit it"
    assert "curated field-guide correction" in disclosure["provenance"]
    assert "worm" in disclosure["education"].lower()


def test_the_feeding_rating_reaches_the_players_diet_card():
    html = INDEX.read_text(encoding="utf-8")
    renderer = html[html.index("function renderDietDisclosureHTML("):]
    renderer = renderer[: renderer.index("\n// Player's pantry")]
    assert "data-feeding-tier" in renderer
    assert "data-feeding-difficulty" in renderer
    assert "<b>Feeding:</b>" in renderer


def test_every_playable_bird_has_a_real_diet_record():
    """A roster name with no record falls through to the conservative fallback,
    which would let a Kittiwake refuse fish while happily taking berries."""
    out = run_node(
        r"""
const fs = require('fs');
const D = require('./bird_diet_hunger_core.js');
const html = fs.readFileSync('index.html', 'utf8');
const names = new Set();
for (const marker of ['const WILD_BIRDS = [', 'const REGION_AREA_SPECIES = {']) {
  const at = html.indexOf(marker);
  const body = html.slice(at, html.indexOf(marker.endsWith('[') ? '\n];' : '\n};', at));
  for (const m of body.matchAll(/'((?:[^'\\]|\\.)*)'/g)) names.add(m[1].replace(/\\'/g, "'").split('(')[0].trim());
}
const missing = [...names].filter(n => n && !D.getDietRecord(n));
console.log(JSON.stringify({ total:names.size, missing }));
"""
    )
    assert out["total"] > 250
    assert out["missing"] == []
