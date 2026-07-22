import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
DATA_PATH = ROOT / "uk_bird_expansion_4.js"
SW_PATH = ROOT / "sw.js"
ART_DIR = ROOT / "bird-art-cache" / "uk-vagrant-completion"

VERSION = "uk-british-list-completion-20260722"
EXPECTED_ORDER = ["Cabot's Tern", "Fea's Petrel", "Stejneger's Stonechat", "Arctic Redpoll"]
RARITIES = {"common", "uncommon", "rare", "epic", "legendary"}
HABITATS = {"water", "wetland", "woodland", "heath", "park", "farmland", "grassland", "urban", "coast", "hills", "default"}
ZONES = {"nationwide", "scotland", "northern_uk", "southern_uk", "western_uk", "eastern_uk", "uk_coast", "uk_wetlands", "uk_uplands"}
STATS = {"hp", "stamina", "strength", "def", "spd", "int"}
REQUIRED = {
    "id", "name", "scientific", "scientificName", "ukStatus", "rarity", "commonness", "aliases", "stats", "traits",
    "rationale", "sources", "origin", "habitat", "range", "diet", "conservation", "habitats", "months", "zones", "bounds", "art",
}


def load_expansion():
    result = subprocess.run(
        ["node", "-e", "const x=require('./uk_bird_expansion_4.js'); console.log(JSON.stringify(x));"],
        cwd=ROOT, text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower().replace("’", "'"))


def test_expansion_holds_exactly_the_four_missing_species_in_order():
    data = load_expansion()
    assert data["version"] == VERSION
    assert [bird["name"] for bird in data["species"]] == EXPECTED_ORDER
    assert len(data["species"]) == 4


def test_every_profile_has_complete_schema():
    for bird in load_expansion()["species"]:
        assert REQUIRED <= set(bird), bird["name"]
        for field in ("id", "name", "scientific", "scientificName", "rationale", "origin", "range", "diet", "conservation"):
            assert isinstance(bird[field], str) and bird[field].strip(), (bird["name"], field)
        assert re.fullmatch(r"[A-Z][a-z-]+ [a-z-]+", bird["scientific"]), bird["scientific"]
        assert bird["scientificName"] == bird["scientific"]
        assert bird["scientific"] in bird["aliases"], bird["name"]
        assert len(bird["traits"]) >= 3 and all(isinstance(x, str) and x for x in bird["traits"])
        assert bird["sources"] and all(url.startswith("https://") for url in bird["sources"])


def test_stats_are_six_integers_one_to_ten():
    for bird in load_expansion()["species"]:
        assert set(bird["stats"]) == STATS, bird["name"]
        assert all(type(v) is int and 1 <= v <= 10 for v in bird["stats"].values()), bird["name"]


def test_rarity_habitat_month_zone_and_bounds_are_valid():
    for bird in load_expansion()["species"]:
        assert bird["rarity"] in RARITIES, bird["name"]
        assert type(bird["commonness"]) is int and 1 <= bird["commonness"] <= 100 and bird["commonness"] != 34, bird["name"]
        assert bird["habitats"] and set(bird["habitats"]) <= HABITATS, bird["name"]
        assert bird["months"] and len(bird["months"]) == len(set(bird["months"])), bird["name"]
        assert all(type(m) is int and 1 <= m <= 12 for m in bird["months"]), bird["name"]
        assert bird["zones"] and set(bird["zones"]) <= ZONES, bird["name"]
        b = bird["bounds"]
        assert set(b) == {"latMin", "latMax", "lonMin", "lonMax"}, bird["name"]
        assert 49 <= b["latMin"] <= b["latMax"] <= 61
        assert -9 <= b["lonMin"] <= b["lonMax"] <= 3


def test_diets_are_species_specific_and_nonempty():
    diets = {bird["name"]: bird["diet"].lower() for bird in load_expansion()["species"]}
    assert "fish" in diets["Cabot's Tern"]
    assert "squid" in diets["Fea's Petrel"]
    assert "insect" in diets["Stejneger's Stonechat"]
    assert "seed" in diets["Arctic Redpoll"]


def _pre_release_names_and_aliases():
    html = HTML_PATH.read_text(encoding="utf-8")
    names = set()
    roster = html[html.index("const WILD_BIRDS = ["):html.index("const HABITAT_BIRD_POOLS = {")]
    names.update(re.findall(r"['\"]([^'\"]+)['\"]", roster))
    profiles = html[html.index("const BURBZ_SPECIES_PROFILES = ["):html.index("const BIRD_INFO = {}")]
    names.update(re.findall(r"\bname\s*:\s*['\"]([^'\"]+)['\"]", profiles))
    for aliases in re.findall(r"\baliases\s*:\s*\[([^]]*)\]", profiles):
        names.update(re.findall(r"['\"]([^'\"]+)['\"]", aliases))
    return {norm(n) for n in names if n and "uk4" not in n.lower()}


def test_new_species_do_not_collide_with_existing_roster():
    baseline = _pre_release_names_and_aliases()
    for bird in load_expansion()["species"]:
        assert norm(bird["name"]) not in baseline, bird["name"]


def test_art_uses_pending_svg_placeholders_that_exist_on_disk():
    for bird in load_expansion()["species"]:
        slug = re.sub(r"[^a-z0-9]+", "_", re.sub("[’']", "_", bird["name"].lower())).strip("_")
        expected = f"/burbz/bird-art-cache/uk-vagrant-completion/{slug}_art_pending_20260722.svg"
        assert bird["art"] == expected, bird["name"]
        assert (ART_DIR / f"{slug}_art_pending_20260722.svg").exists(), bird["name"]


def test_index_has_integration_markers_and_load_order():
    html = HTML_PATH.read_text(encoding="utf-8")
    script_marker = '<script src="uk_bird_expansion_4.js?v=uk-british-list-completion-20260722"></script>'
    assert script_marker in html
    assert html.index(script_marker) < html.index("(function() {")
    for marker in (
        "const UK4 = window.BURBZ_UK_BIRD_EXPANSION_4",
        "WILD_BIRDS.push(...UK4.names);",
        "UK4.addToHabitatPools(HABITAT_BIRD_POOLS);",
        "REGION_AREA_SPECIES.uk.push(...UK4.names);",
        "BURBZ_SPECIES_PROFILES.push(...UK4.profiles);",
        "Object.assign(BUILT_IN_BIRD_ART, UK4.art);",
        "Object.assign(REAL_WORLD_COMMONNESS, UK4.commonness);",
        "UK4.isEligible(species, lat, lon, month, habitat)",
    ):
        assert marker in html, marker


def test_expansion_script_is_a_versioned_offline_core_asset():
    sw = SW_PATH.read_text(encoding="utf-8")
    asset = "./uk_bird_expansion_4.js?v=uk-british-list-completion-20260722"
    assert asset in sw
    core = sw[sw.index("const BURBZ_CORE = ["):sw.index("self.addEventListener('install'")]
    assert asset in core


def _eligibility(cases):
    source = "const x=require('./uk_bird_expansion_4.js'); const cases=" + json.dumps(cases) + "; console.log(JSON.stringify(cases.map(c=>x.isEligible(...c))));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_eligibility_respects_season_and_range():
    results = _eligibility([
        ["Arctic Redpoll", 53.5, 1.0, 1, "woodland"],   # winter east coast -> yes
        ["Arctic Redpoll", 53.5, 1.0, 7, "woodland"],   # summer -> no (winter visitor)
        ["Cabot's Tern", 50.5, 0.0, 7, "coast"],        # summer south coast -> yes
        ["Fea's Petrel", 50.0, -6.0, 9, "coast"],       # autumn south-west -> yes
        ["Stejneger's Stonechat", 59.0, -1.5, 10, "grassland"],  # autumn north -> yes
        ["Robin", 52.0, 0.0, 6, "woodland"],            # other roster species untouched -> yes
    ])
    assert results == [True, False, True, True, True, True]
