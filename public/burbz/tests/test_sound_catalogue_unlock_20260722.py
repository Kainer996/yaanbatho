"""Recognised birds must unlock from the game catalogue, not the server flag.

The live listening (Merlin-style) screen correctly recognised birds — first a
Buzzard, then a Mallard — but told the player the bird "is not in the Burbz
catalogue yet" instead of unlocking it. The server's catalogMatched flag only
reports whether the *server's own* species list matched, and that list can lag
behind the shipped game catalogue. The fix makes the game catalogue the
authority: a recognised bird is only rejected when findSpeciesProfile knows no
profile for it under any name, alias or scientific name, and recognition names
with a leading qualifier the catalogue omits ("Eurasian Blue Tit", "Common
Kingfisher") fall back to the unqualified catalogue name.

These tests run the real catalogue plus the real createBirdEntry /
handleBirdCandidates code in node and sweep every catalogue species through a
sound detection whose server flag wrongly claims "unmatched".
"""
import json
import subprocess
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
CATALOG_ADDITIONS = ROOT / "data" / "catalog-additions.json"

EXPANSION_MODULES = [
    "uk_bird_expansion_50.js",
    "uk_bird_expansion_2.js",
    "au_bird_expansion.js",
    "uk_bird_expansion_3.js",
    "uk_bird_expansion_4.js",
    "uk_bird_alias_completion_20260803.js",
    "au_bird_expansion_2.js",
    "national_bird_completion_20260715.js",
]


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def build_harness_script() -> str:
    html = HTML.read_text(encoding="utf-8")
    catalogue = html[html.index("const BURBZ_SPECIES_PROFILES = ["):html.index("function getBirdInfo(")]
    requires = "\n".join(f"require('../{name}');" for name in EXPANSION_MODULES)
    prelude = (
        "global.window = global;\n"
        + requires + "\n"
        "const UK50 = window.BURBZ_UK_BIRD_EXPANSION_50;\n"
        "const UK26 = window.BURBZ_UK_BIRD_EXPANSION_26;\n"
        "const AU_EXP = window.BURBZ_AU_BIRD_EXPANSION;\n"
        "const UK_FINAL = window.BURBZ_UK_BIRD_EXPANSION_FINAL;\n"
        "const UK4 = window.BURBZ_UK_BIRD_EXPANSION_4;\n"
        "const AU50 = window.BURBZ_AU_BIRD_EXPANSION_50;\n"
        "const NATIONAL = window.BURBZ_NATIONAL_BIRD_COMPLETION_20260715;\n"
        "const UK_BIRD_ALIASES = window.BURBZ_UK_BIRD_ALIAS_COMPLETION_20260803;\n"
        "console.warn = () => {};\n"
    )
    stubs = """
const determineBirdRarity = () => 'common';
const generateBirdStats = () => ({ hp: 80, maxHp: 80, atk: 50, def: 50, spd: 50 });
const hashStr = () => 1;
const resolveBuiltInBirdArt = () => null;
const BIRD_BIOLOGY_STATS_VERSION = 1;
const SOUND_SESSION_MAX_PER_WINDOW = 4;
const calls = { unmatched: [], remembered: [], session: [], quest: [] };
const showCatalogUnmatchedRecognition = b => calls.unmatched.push(b.commonName || b.species);
const rememberDiscoveredBird = b => { calls.remembered.push(b.species); return true; };
const fetchBirdArt = () => {};
let continuousSoundScanWanted = false;
const recordSoundSessionDiscovery = b => calls.session.push(b.species);
const $ = () => ({ classList: { add(){}, remove(){}, toggle(){} }, style: {}, textContent: '' });
const RARITY_COLORS = { common: '#fff', uncommon: '#fff', rare: '#fff', epic: '#fff', legendary: '#fff' };
const showScanEncounterCard = () => {};
const questRegisterBirdEncounter = b => calls.quest.push(b.species);
const addPlayerXp = () => {}; const saveState = () => {}; const updateHeader = () => {};
const renderBirdex = () => {}; const renderProfile = () => {};
const showRecruitChoiceOverlay = () => {}; const showToast = () => {};
const companionForSpecies = () => null; const levelUpBird = () => {}; const checkBadges = () => {};
function detect(name, scientificName, catalogMatched) {
  calls.unmatched.length = 0; calls.remembered.length = 0;
  handleBirdCandidates({ species: name, scientificName: scientificName || '', confidence: 0.9 }, [], { source: 'sound', catalogMatched });
  return { unmatched: [...calls.unmatched], remembered: [...calls.remembered] };
}
function detectMany() {
  calls.unmatched.length = 0; calls.remembered.length = 0; calls.session.length = 0; calls.quest.length = 0;
  continuousSoundScanWanted = true;
  const surfaced = handleBirdCandidates(
    { species:'Great Tit', scientificName:'Parus major', confidence:0.71 },
    [
      { common_name:'Great Tit', scientific_name:'Parus major', confidence:0.88 },
      { common_name:'Common Chaffinch', scientific_name:'Fringilla coelebs', confidence:0.76 },
      { common_name:'Common Chaffinch', scientific_name:'Fringilla coelebs', confidence:0.74 },
      { common_name:'European Robin', scientific_name:'Erithacus rubecula', confidence:0.72 },
      { common_name:'Mallard', scientific_name:'Anas platyrhynchos', confidence:0.70 },
      { common_name:'Common Blackbird', scientific_name:'Turdus merula', confidence:0.69 }
    ],
    { source:'sound', catalogMatched:true }
  );
  continuousSoundScanWanted = false;
  return {
    surfaced: surfaced.map(b => ({ name:b.species, confidence:b.confidence })),
    remembered:[...calls.remembered],
    session:[...calls.session],
    quest:[...calls.quest],
    unmatched:[...calls.unmatched]
  };
}
function detectOneShotWithSecondary() {
  calls.remembered.length = 0; calls.quest.length = 0;
  continuousSoundScanWanted = false;
  const surfaced = handleBirdCandidates(
    { species:'Great Tit', scientificName:'Parus major', confidence:0.88 },
    [{ common_name:'Common Chaffinch', scientific_name:'Fringilla coelebs', confidence:0.86 }],
    { source:'sound', catalogMatched:true }
  );
  return {
    surfaced: surfaced.map(b => b.species),
    remembered:[...calls.remembered],
    quest:[...calls.quest]
  };
}
"""
    functions = "\n".join(
        function_source(html, name)
        for name in (
            "dietHungerCore",
            "birdSleepCore",
            "defaultBirdCare",
            "speciesKey",
            "canonicalSpeciesName",
            "createBirdEntry",
            "normaliseAcceptedBirdCandidates",
            "handleBirdCandidates",
        )
    )
    driver = """
const nameFails = [];
const aliasFails = [];
for (const p of BURBZ_SPECIES_PROFILES) {
  if (!findSpeciesProfile(p.name)) nameFails.push(p.name);
  for (const a of (p.aliases || [])) if (!findSpeciesProfile(a)) aliasFails.push(p.name + ' / ' + a);
}
const blocked = [];
for (const p of BURBZ_SPECIES_PROFILES) {
  const result = detect(p.name, p.scientificName || p.scientific || '', false);
  if (result.unmatched.length || !result.remembered.length) blocked.push(p.name);
}
const birdnetLabels = {};
for (const n of ['Eurasian Blue Tit','Eurasian Magpie','Common Kingfisher','Eurasian Bullfinch','Eurasian Nuthatch','Eurasian Jackdaw','Eurasian Sparrowhawk','Common Wood-Pigeon','Northern Raven','European Green Woodpecker','Common Blackbird','European Robin']) {
  birdnetLabels[n] = (findSpeciesProfile(n) || {}).name || null;
}
console.log(JSON.stringify({
  total: BURBZ_SPECIES_PROFILES.length,
  nameFails, aliasFails, blocked, birdnetLabels,
  mallardProfileId: (findSpeciesProfile('Mallard') || {}).id || null,
  mallard: detect('Mallard', 'Anas platyrhynchos', false),
  mallardServerMatched: detect('Mallard', 'Anas platyrhynchos', true),
  unknown: detect('Console Gull', 'Larus consolensis', false),
  multi: detectMany(),
  oneShot: detectOneShotWithSecondary(),
}));
"""
    return prelude + catalogue + stubs + functions + driver


@lru_cache(maxsize=1)
def harness_results() -> dict:
    script = build_harness_script()
    script_path = ROOT / "tests" / "_sound_catalogue_unlock_harness.js"
    script_path.write_text(script, encoding="utf-8")
    try:
        result = subprocess.run(
            ["node", script_path.name], cwd=ROOT / "tests", text=True, capture_output=True, timeout=120,
        )
    finally:
        script_path.unlink(missing_ok=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def run_node_harness() -> dict:
    return harness_results()


def test_client_trusts_its_own_catalogue_over_the_server_flag():
    html = HTML.read_text(encoding="utf-8")
    src = function_source(html, "handleBirdCandidates")
    normalise = function_source(html, "normaliseAcceptedBirdCandidates")
    assert "const inGameCatalogue = bird =>" in src
    assert "eligibleCandidates.filter(inGameCatalogue)" in src
    assert "raw.common_name" in normalise
    assert "raw.scientific_name" in normalise
    # The old behaviour rejected purely on the server flag.
    assert "if (top && !catalogMatched)" not in src
    assert "opts.catalogMatched" not in src


def test_every_catalogue_bird_resolves_by_name_and_alias():
    out = run_node_harness()
    assert out["total"] > 1000
    assert out["nameFails"] == []
    assert out["aliasFails"] == []


def test_every_catalogue_bird_unlocks_even_when_server_flag_is_wrong():
    out = run_node_harness()
    assert out["blocked"] == []


def test_mallard_detection_unlocks_despite_wrong_server_flag():
    out = run_node_harness()
    assert out["mallardProfileId"] == "mallard"
    assert out["mallard"] == {"unmatched": [], "remembered": ["Mallard"]}
    assert out["mallardServerMatched"] == {"unmatched": [], "remembered": ["Mallard"]}


def test_unknown_species_still_shows_the_catalogue_notice():
    out = run_node_harness()
    assert out["unknown"] == {"unmatched": ["Console Gull"], "remembered": []}


def test_simultaneous_sound_species_are_deduplicated_and_capped_at_four():
    multi = run_node_harness()["multi"]
    assert multi["unmatched"] == []
    assert [row["name"] for row in multi["surfaced"]] == [
        "Great Tit", "Chaffinch", "Robin", "Mallard",
    ]
    assert multi["surfaced"][0]["confidence"] == 0.88
    assert multi["remembered"] == [
        "Great Tit", "Chaffinch", "Robin", "Mallard",
    ]
    assert multi["session"] == multi["remembered"]
    assert multi["quest"] == multi["remembered"]


def test_one_shot_sound_scan_preserves_primary_only_compatibility():
    one_shot = run_node_harness()["oneShot"]
    assert one_shot == {
        "surfaced": ["Great Tit"],
        "remembered": ["Great Tit"],
        "quest": ["Great Tit"],
    }


def test_birdnet_style_qualified_labels_resolve_to_catalogue_profiles():
    out = run_node_harness()
    missing = [label for label, resolved in out["birdnetLabels"].items() if not resolved]
    assert missing == [], missing


def test_mallard_is_in_the_server_catalogue_additions():
    additions = json.loads(CATALOG_ADDITIONS.read_text(encoding="utf-8"))["species"]
    mallard = next(row for row in additions if row["species_id"] == "mallard")
    assert mallard["common_name"] == "Mallard"
    assert mallard["latin_name"] == "Anas platyrhynchos"
    assert "Anas platyrhynchos" in mallard["aliases"]
    assert mallard["rarity_tier"] == "common"
