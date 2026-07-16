import ast
import hashlib
import json
import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
DATA_PATH = ROOT / "uk_bird_expansion_50.js"
SW_PATH = ROOT / "sw.js"
EDUCATION_PATH = ROOT / "data" / "uk-bird-education-50.json"
EXPECTED_ORDER = [
    "Capercaillie", "Black Grouse", "Ptarmigan", "White-fronted Goose", "Bewick's Swan",
    "Garganey", "Scaup", "Common Scoter", "Long-tailed Duck", "Smew", "Red-breasted Merganser",
    "Nightjar", "Corncrake", "Spotted Crake", "Coot", "Red-necked Grebe", "Slavonian Grebe",
    "Black-necked Grebe", "Stone-curlew", "Golden Plover", "Dotterel", "Whimbrel", "Knot", "Ruff",
    "Woodcock", "Jack Snipe", "Green Sandpiper", "Greenshank", "Arctic Tern", "Guillemot",
    "Black Guillemot", "Red-throated Diver", "Manx Shearwater", "Storm Petrel", "Bittern",
    "Hen Harrier", "Long-eared Owl", "Short-eared Owl", "Lesser Spotted Woodpecker", "Hobby",
    "Chough", "Crested Tit", "Bearded Tit", "Woodlark", "Cetti’s Warbler", "Wood Warbler",
    "Grasshopper Warbler", "Lesser Whitethroat", "Dartford Warbler", "Ring Ouzel",
]
RARITIES = {"common", "uncommon", "rare", "epic", "legendary"}
HABITATS = {"water", "wetland", "woodland", "heath", "park", "farmland", "grassland", "urban", "coast", "hills", "default"}
ZONES = {"nationwide", "scotland", "northern_uk", "southern_uk", "western_uk", "eastern_uk", "uk_coast", "uk_wetlands", "uk_uplands"}
STATS = {"hp", "stamina", "strength", "def", "spd", "int"}
REQUIRED = {
    "id", "name", "scientific", "scientificName", "ukStatus", "rarity", "commonness", "aliases", "stats", "traits", "rationale", "sources",
    "origin", "habitat", "range", "diet", "conservation", "habitats", "months", "zones", "bounds", "art",
}


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower().replace("’", "'").replace("&", "and"))


def load_expansion():
    result = subprocess.run(
        ["node", "-e", "const x=require('./uk_bird_expansion_50.js'); console.log(JSON.stringify(x));"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_expansion_has_exactly_the_source_selected_fifty_in_order():
    data = load_expansion()
    assert data["version"] == "uk50-source-backed-20260713"
    assert [bird["name"] for bird in data["species"]] == EXPECTED_ORDER
    assert len(data["species"]) == 50
    assert len({norm(name) for name in EXPECTED_ORDER}) == 50


def _pre_release_names_and_aliases():
    html = HTML_PATH.read_text(encoding="utf-8")
    names = set()
    roster = html[html.index("const WILD_BIRDS = ["):html.index("const HABITAT_BIRD_POOLS = {")]
    names.update(re.findall(r"['\"]([^'\"]+)['\"]", roster))
    area = html[html.index("const REGION_AREA_SPECIES = {"):html.index("const REGION_AREA_SPECIES_SETS")]
    names.update(re.findall(r"['\"]([^'\"]+)['\"]", area))
    profiles = html[html.index("const BURBZ_SPECIES_PROFILES = ["):html.index("const BIRD_INFO = {}")]
    names.update(re.findall(r"\bname\s*:\s*['\"]([^'\"]+)['\"]", profiles))
    for aliases in re.findall(r"\baliases\s*:\s*\[([^]]*)\]", profiles):
        names.update(re.findall(r"['\"]([^'\"]+)['\"]", aliases))
    return {norm(name) for name in names if name and "uk50" not in name.lower()}


def test_no_canonical_or_alias_normalises_to_a_pre_release_collision():
    baseline = _pre_release_names_and_aliases()
    data = load_expansion()
    for bird in data["species"]:
        assert norm(bird["name"]) not in baseline, bird["name"]
        for alias in bird["aliases"]:
            assert norm(alias) not in baseline, (bird["name"], alias)


def test_every_profile_has_complete_source_backed_schema():
    for bird in load_expansion()["species"]:
        assert REQUIRED == set(bird), bird["name"]
        for field in REQUIRED - {"commonness", "stats", "aliases", "traits", "sources", "habitats", "months", "zones", "bounds"}:
            assert isinstance(bird[field], str) and bird[field].strip(), (bird["name"], field)
        assert re.fullmatch(r"[A-Z][a-z-]+ [a-z-]+", bird["scientific"]), bird["scientific"]
        assert bird["scientificName"] == bird["scientific"]
        assert isinstance(bird["aliases"], list)
        assert bird["scientific"] in bird["aliases"], bird["name"]
        assert len(bird["traits"]) >= 3 and all(isinstance(x, str) and x for x in bird["traits"])
        assert bird["sources"] and all(url.startswith("https://www.bto.org/") for url in bird["sources"])
        assert "BTO" in bird["rationale"]


def test_stats_are_fixed_six_integer_values_from_one_to_ten():
    for bird in load_expansion()["species"]:
        assert set(bird["stats"]) == STATS, bird["name"]
        assert all(type(value) is int and 1 <= value <= 10 for value in bird["stats"].values()), bird["name"]
        assert any(word in bird["rationale"].lower() for word in ("size", "endurance", "weapon", "agility", "cognition", "speed", "strength")), bird["name"]


def test_rarity_habitat_month_zone_and_bounds_values_are_closed_and_valid():
    for bird in load_expansion()["species"]:
        assert bird["rarity"] in RARITIES, bird["name"]
        assert type(bird["commonness"]) is int and 1 <= bird["commonness"] <= 100 and bird["commonness"] != 34, bird["name"]
        assert bird["habitats"] and set(bird["habitats"]) <= HABITATS, bird["name"]
        assert bird["months"] and len(bird["months"]) == len(set(bird["months"])), bird["name"]
        assert all(type(month) is int and 1 <= month <= 12 for month in bird["months"]), bird["name"]
        assert bird["zones"] and set(bird["zones"]) <= ZONES, bird["name"]
        bounds = bird["bounds"]
        assert set(bounds) == {"latMin", "latMax", "lonMin", "lonMax"}, bird["name"]
        assert 49 <= bounds["latMin"] <= bounds["latMax"] <= 61
        assert -9 <= bounds["lonMin"] <= bounds["lonMax"] <= 3


def test_art_mapping_uses_expected_generated_names_and_existing_coot_art():
    data = load_expansion()
    for bird in data["species"]:
        if bird["name"] == "Coot":
            assert bird["art"] == "/burbz/bird-art-cache/eurasian_coot_burbz_manga_20260630.png"
        else:
            slug = re.sub(r"[^a-z0-9]+", "_", re.sub("[’']", "_", bird["name"].lower())).strip("_")
            assert bird["art"] == f"/burbz/bird-art-cache/{slug}_burbz_manga_rpg_20260713.png"


def test_index_has_exact_integration_markers_and_load_order():
    html = HTML_PATH.read_text(encoding="utf-8")
    script_marker = '<script src="uk_bird_expansion_50.js?v=uk50-source-backed-20260713"></script>'
    assert script_marker in html
    assert html.index(script_marker) < html.index("(function() {")
    for marker in (
        "const UK50 = window.BURBZ_UK_BIRD_EXPANSION_50;",
        "WILD_BIRDS.push(...UK50.names);",
        "UK50.addToHabitatPools(HABITAT_BIRD_POOLS);",
        "REGION_AREA_SPECIES.uk.push(...UK50.names);",
        "BURBZ_SPECIES_PROFILES.push(...UK50.profiles);",
        "Object.assign(BUILT_IN_BIRD_ART, UK50.art);",
        "Object.assign(REAL_WORLD_COMMONNESS, UK50.commonness);",
        "function pickWeightedHabitatSpecies(pool, seed)",
        "UK50.isEligible(species, lat, lon, month, habitat)",
    ):
        assert marker in html


def test_expansion_script_is_a_versioned_offline_core_asset():
    sw = SW_PATH.read_text(encoding="utf-8")
    asset = "./uk_bird_expansion_50.js?v=uk50-source-backed-20260713"
    assert asset in sw
    core = sw[sw.index("const BURBZ_CORE = ["):sw.index("self.addEventListener('install'")]
    assert asset in core


def test_all_fifty_have_complete_deep_field_guide_entries():
    birds = {bird["name"]: bird for bird in load_expansion()["species"]}
    education = json.loads(EDUCATION_PATH.read_text(encoding="utf-8"))
    # Later regional waves intentionally share this field-guide payload; the
    # original UK50 contract is that all fifty survive, not that no future bird
    # may be added to the same source-backed dataset.
    assert set(EXPECTED_ORDER) <= set(education)
    required = {"title", "scientificName", "summary", "taxonomy", "identification", "behaviour", "habitat", "diet", "breeding", "range", "conservation", "wikipediaDeepDive", "learningNotes", "sources"}
    for name in EXPECTED_ORDER:
        entry = education[name]
        assert required <= set(entry), name
        assert entry["title"] == name
        assert entry["scientificName"] == birds[name]["scientificName"], name
        assert len(entry["summary"]) >= 100, name
        assert len(entry["wikipediaDeepDive"]) >= 200, name
        assert len(entry["learningNotes"]) >= 4, name
        assert any(source.get("url", "").startswith("https://www.bto.org/") for source in entry["sources"]), name


def test_existing_field_guides_survive_a_uk50_dataset_failure():
    html = HTML_PATH.read_text(encoding="utf-8")
    start = html.index("let birdEducationCache = null;")
    end = html.index("function getCachedBirdEducation", start)
    loader = html[start:end]
    source = """
    global.fetch = async url => {
      if (url.includes('uk-bird-education-50')) throw new Error('temporary UK50 failure');
      return { ok:true, status:200, json:async () => ({'European Robin':{title:'European Robin'}}) };
    };
    """ + loader + "\nloadBirdEducation().then(data => console.log(JSON.stringify(data))).catch(err => { console.error(err); process.exit(1); });"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"European Robin": {"title": "European Robin"}}


def test_uk50_field_guide_is_loaded_and_cached_as_a_core_asset():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    marker = "/burbz/data/uk-bird-education-50.json?v=au-source-backed-20260713"
    assert marker in html
    assert "fetchBirdEducationDataset(BIRD_EDUCATION_UK50_URL, false)" in html
    assert "{ ...(base || {}), ...(uk50 || {}) }" in html
    assert "./data/uk-bird-education-50.json?v=au-source-backed-20260713" in sw


def _eligibility(cases):
    source = "const x=require('./uk_bird_expansion_50.js'); const cases=" + json.dumps(cases) + "; console.log(JSON.stringify(cases.map(c=>x.isEligible(...c))));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_representative_coordinate_and_month_eligibility():
    cases = [
        ["Capercaillie", 57.1, -3.7, 7], ["Capercaillie", 51.5, -0.1, 7],
        ["Dartford Warbler", 50.7, -1.9, 1], ["Dartford Warbler", 57.5, -4.2, 1],
        ["Nightjar", 51.2, -1.7, 7], ["Nightjar", 51.2, -1.7, 1],
        ["Smew", 51.6, -0.2, 1], ["Smew", 51.6, -0.2, 7],
        ["Coot", 55.9, -3.2, 1], ["Coot", 50.8, -1.1, 7],
    ]
    assert _eligibility(cases) == [True, False, True, False, True, False, True, False, True, True]


def test_unknown_and_non_uk_species_fail_open_for_save_compatibility():
    assert _eligibility([["European Robin", 51.5, -0.1, 1], ["Australian Magpie", -37.8, 145.0, 7]]) == [True, True]


def test_supported_regions_do_not_treat_the_rest_of_the_world_as_uk():
    cases = [[53.87, -2.39], [51.507, -0.128], [59.0, -3.0], [54.60, -5.93], [53.35, -6.26], [48.856, 2.352], [40.71, -74.0], [-37.81, 144.96], [None, 0]]
    source = "const x=require('./uk_bird_expansion_50.js'); const cases=" + json.dumps(cases) + "; console.log(JSON.stringify(cases.map(c=>x.supportedRegionForCoords(...c))));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == ["uk", "uk", "uk", "uk", "unsupported", "unsupported", "unsupported", "au", "unsupported"]


def test_player_fix_and_spawn_path_use_the_same_validated_coordinates():
    html = HTML_PATH.read_text(encoding="utf-8")
    for marker in (
        "function validLivePosition(pos)",
        "accuracy > 500",
        "liveMapUserMarker.setLngLat([lon, lat])",
        "const region = mapRegionForCoords(lat, lon);",
        "if (region === 'unsupported') return [];",
        "const legacyRegion = UK50.supportedRegionForCoords(lat, lon);",
        "if (legacyRegion === 'uk') return 'uk';",
        "if (SPAIN_BOUNDARY.contains(lat, lon)) return 'es';",
        "if (legacyRegion === 'au' && supportedAustraliaCoords(lat, lon)) return 'au';",
    ):
        assert marker in html


def test_multi_season_species_follow_breeding_passage_and_winter_ranges():
    cases = [
        ["Scaup", 51.0, 0.4, 1, "coast"], ["Scaup", 51.0, 0.4, 7, "water"], ["Scaup", 57.0, -4.0, 7, "water"],
        ["Long-tailed Duck", 51.0, 0.4, 1, "coast"], ["Long-tailed Duck", 57.0, -4.0, 7, "coast"],
        ["Golden Plover", 51.5, -1.0, 1, "farmland"], ["Golden Plover", 51.5, -1.0, 7, "farmland"], ["Golden Plover", 56.0, -3.0, 7, "hills"],
        ["Greenshank", 51.0, 0.4, 9, "coast"], ["Greenshank", 51.0, 0.4, 6, "coast"], ["Greenshank", 57.0, -4.0, 6, "hills"],
        ["Red-throated Diver", 51.0, 0.4, 1, "coast"], ["Red-throated Diver", 51.0, 0.4, 7, "coast"], ["Red-throated Diver", 57.0, -4.0, 7, "water"],
        ["Hen Harrier", 51.5, -1.0, 1, "wetland"], ["Hen Harrier", 51.5, -1.0, 7, "wetland"], ["Hen Harrier", 56.0, -3.0, 7, "hills"],
        ["Arctic Tern", 51.0, 0.4, 5, "coast"], ["Arctic Tern", 51.0, 0.4, 7, "coast"], ["Arctic Tern", 56.0, -3.0, 7, "coast"],
    ]
    assert _eligibility(cases) == [
        True, False, True, True, False, True, False, True, True, False, True,
        True, False, True, True, False, True, True, False, True,
    ]


def test_heath_specialists_use_a_real_heath_pool_instead_of_generic_woodland():
    data = load_expansion()
    by_name = {bird["name"]: bird for bird in data["species"]}
    assert "heath" in by_name["Nightjar"]["habitats"]
    assert "heath" in by_name["Woodlark"]["habitats"]
    assert by_name["Dartford Warbler"]["habitats"] == ["heath"]
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "if (/heath/.test(natural)) return 'heath';" in html
    assert "heath:'heathland'" in html


def test_all_50_cards_and_cutouts_are_real_unique_usable_rasters():
    birds = load_expansion()["species"]
    card_hashes, cutout_hashes = set(), set()
    for bird in birds:
        card = ROOT / bird["art"].removeprefix("/burbz/")
        assert card.read_bytes().startswith(b"\x89PNG\r\n\x1a\n"), bird["name"]
        assert not card.read_text(encoding="utf-8", errors="ignore").startswith("version https://git-lfs"), bird["name"]
        with Image.open(card) as image:
            assert image.format == "PNG" and image.width == image.height and image.width >= 512, (bird["name"], image.size)
        card_hashes.add(hashlib.sha256(card.read_bytes()).hexdigest())

        cutout = card.parent / "cutouts" / f"{card.stem}_cutout.png"
        with Image.open(cutout) as image:
            rgba = image.convert("RGBA")
            assert min(rgba.size) >= 64, (bird["name"], rgba.size)
            alpha = rgba.getchannel("A")
            hist = alpha.histogram()
            pixels = rgba.width * rgba.height
            assert sum(hist[:16]) / pixels >= 0.10, bird["name"]
            assert sum(hist[240:]) / pixels >= 0.05, bird["name"]
            corners = (alpha.getpixel((0, 0)), alpha.getpixel((rgba.width - 1, 0)), alpha.getpixel((0, rgba.height - 1)), alpha.getpixel((rgba.width - 1, rgba.height - 1)))
            assert sum(int(value or 0) < 16 for value in corners) >= 3, bird["name"]
        cutout_hashes.add(hashlib.sha256(cutout.read_bytes()).hexdigest())
    assert len(card_hashes) == len(cutout_hashes) == 50


def test_art_provenance_is_complete_and_matches_the_final_cards():
    birds = load_expansion()["species"]
    manifest = json.loads((ROOT / "bird-art-cache" / "uk50_source_attributions.json").read_text(encoding="utf-8"))
    assert manifest["count"] == 50
    sources = {row["species"]: row for row in manifest["sources"]}
    assert set(sources) == set(EXPECTED_ORDER)
    for bird in birds:
        source = sources[bird["name"]]
        card = ROOT / bird["art"].removeprefix("/burbz/")
        assert source["generatedCard"] == card.name
        assert source["sha256"] == hashlib.sha256(card.read_bytes()).hexdigest()
        for field in ("identitySource", "imageSource", "license", "artist", "credit", "method"):
            assert str(source[field]).strip(), (bird["name"], field)


def test_service_worker_precaches_remote_lfs_resolved_cards_and_cutouts():
    sw = SW_PATH.read_text(encoding="utf-8")
    for marker in (
        "importScripts('./uk_bird_expansion_50.js?v=uk50-source-backed-20260713');",
        "UK50_REMOTE_ART",
        "UK50_REMOTE_CUTOUTS",
        "BURBZ_ASSETS.push(...UK50_REMOTE_ART, ...UK50_REMOTE_CUTOUTS, ...NEW_LOCAL_ART, ...NEW_LOCAL_CUTOUTS);",
        "url.hostname === 'github.com'",
    ):
        assert marker in sw
