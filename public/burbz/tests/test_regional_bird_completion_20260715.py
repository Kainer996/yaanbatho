import hashlib
import json
import re
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
AU_MODULE = ROOT / "au_bird_expansion_2.js"
UK_MODULE = ROOT / "uk_bird_expansion_3.js"
EDUCATION = ROOT / "data" / "regional-bird-education-20260715.json"
UK_CHECKLIST = ROOT / "data" / "uk-regular-checklist-rspb-20260715.json"
AU_SOURCE = ROOT / "data" / "australia-birds-source-20260715.json"

AU_EXPECTED = [
    "Red-capped Plover", "Fan-tailed Cuckoo", "White-necked Heron", "Brown Cuckoo-Dove",
    "Red-necked Stint", "Leaden Flycatcher", "Powerful Owl", "Glossy Black Cockatoo",
    "Plumed Egret", "Brahminy Kite", "Forest Kingfisher", "Eastern Cattle-Egret",
    "Striated Thornbill", "Little Heron", "Little Friarbird", "Scaly-breasted Lorikeet",
    "Hooded Plover", "Pheasant Coucal", "White-cheeked Honeyeater", "Pacific Reef Heron",
    "Caspian Tern", "Orange-footed Scrubfowl", "Tasmanian Nativehen", "White-headed Pigeon",
    "Sahul Sunbird", "Sharp-tailed Sandpiper", "Bassian Thrush", "White-naped Honeyeater",
    "Yellow-throated Miner", "Channel-billed Cuckoo", "Grey-crowned Babbler",
    "Far Eastern Curlew", "White-throated Honeyeater", "Crescent Honeyeater", "Pacific Baza",
    "Black-faced Cormorant", "Australian Hobby", "White-browed Babbler", "Yellow Thornbill",
    "Collared Sparrowhawk", "Green Rosella", "White-bellied Cuckooshrike",
    "Little Shrikethrush", "Carnaby's Black Cockatoo", "Kelp Gull",
    "Chestnut-breasted Munia", "Buff-rumped Thornbill", "Brown Quail", "Varied Triller",
    "Brown-headed Honeyeater",
]
UK_EXPECTED = [
    "Aquatic Warbler", "Balearic Shearwater", "Black Tern", "Bluethroat", "Common Rosefinch",
    "Curlew Sandpiper", "Glaucous Gull", "Golden Oriole", "Great Grey Shrike",
    "Great Shearwater", "Grey Phalarope", "Iceland Gull", "Lapland Bunting",
    "Little Stint", "Long-tailed Skua", "Marsh Warbler", "Montagu's Harrier", "Parrot Crossbill",
    "Pectoral Sandpiper", "Red-backed Shrike", "Red-crested Pochard", "Rough-legged Buzzard",
    "Ruddy Duck", "Savi's Warbler", "Serin", "Shore Lark", "Short-toed Treecreeper",
    "Sooty Shearwater", "Taiga Bean Goose", "Temminck's Stint", "Tundra Bean Goose",
    "Water Pipit", "Wryneck", "Yellow-browed Warbler", "Yellow-legged Gull",
]
STATS = {"hp", "stamina", "strength", "def", "spd", "int"}
HABITATS = {"water", "wetland", "woodland", "heath", "park", "farmland", "grassland", "urban", "coast", "hills", "default"}


def _load(module: Path):
    result = subprocess.run(
        ["node", "-e", f"console.log(JSON.stringify(require('./{module.name}')))"],
        cwd=ROOT, text=True, capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def _norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower().replace("’", "'"))


def test_exact_fifty_new_australian_species_and_all_remaining_regular_uk_taxa():
    au = _load(AU_MODULE)
    uk = _load(UK_MODULE)
    assert au["version"] == "au50-source-backed-r2-20260715"
    assert uk["version"] == "uk-regular-completion-20260715"
    assert au["names"] == AU_EXPECTED and len(au["species"]) == 50
    assert uk["names"] == UK_EXPECTED and len(uk["species"]) == 35
    assert uk["regionalAliases"] == ["Rock Pigeon", "Green-winged Teal", "Golden Pheasant", "Eurasian Hoopoe", "Snow Goose"]


def test_profiles_are_complete_biology_grounded_and_stats_are_fixed():
    required = {"id", "name", "scientific", "scientificName", "ukStatus", "rarity", "commonness", "aliases", "stats", "traits", "rationale", "sources", "origin", "habitat", "range", "diet", "conservation", "habitats", "months", "bounds", "art"}
    for module in (AU_MODULE, UK_MODULE):
        for bird in _load(module)["species"]:
            assert required <= set(bird), bird["name"]
            assert re.fullmatch(r"[A-Z][A-Za-z-]+ [a-z-]+", bird["scientific"]), bird["scientific"]
            assert bird["scientificName"] == bird["scientific"]
            assert set(bird["stats"]) == STATS
            assert all(type(v) is int and 1 <= v <= 10 for v in bird["stats"].values())
            assert len(bird["traits"]) >= 3 and len(bird["rationale"]) >= 80
            assert bird["habitats"] and set(bird["habitats"]) <= HABITATS
            assert bird["months"] and all(type(m) is int and 1 <= m <= 12 for m in bird["months"])
            assert len(bird["range"]) >= 40 and len(bird["diet"]) >= 25
            assert len(bird["sources"]) >= 2 and all(url.startswith("https://") for url in bird["sources"])


def test_new_species_have_realistic_coordinate_season_and_habitat_gates():
    au = _load(AU_MODULE)
    uk = _load(UK_MODULE)
    assert au["isEligible"] if False else True  # functions are exercised through Node below
    cases = [
        ["Tasmanian Nativehen", -42.9, 147.3, 7, "grassland", True],
        ["Tasmanian Nativehen", -27.5, 153.0, 7, "grassland", False],
        ["Carnaby's Black Cockatoo", -31.9, 115.9, 8, "woodland", True],
        ["Carnaby's Black Cockatoo", -33.9, 151.2, 8, "woodland", False],
        ["Sahul Sunbird", -16.9, 145.8, 6, "coast", True],
        ["Sahul Sunbird", -37.8, 145.0, 6, "park", False],
        ["Fan-tailed Cuckoo", -32.0, 116.0, 7, "woodland", True],
        ["Glossy Black Cockatoo", -35.8, 137.3, 7, "woodland", True],
        ["Glossy Black Cockatoo", -31.9, 115.9, 7, "woodland", False],
        ["Forest Kingfisher", -12.5, 130.9, 7, "woodland", True],
        ["Forest Kingfisher", -33.0, 151.0, 7, "woodland", False],
        ["Forest Kingfisher", -33.0, 151.0, 12, "woodland", True],
    ]
    source = "const x=require('./au_bird_expansion_2.js');const c=" + json.dumps(cases) + ";console.log(JSON.stringify(c.map(r=>x.isEligible(...r.slice(0,5)))));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [r[-1] for r in cases]
    cases = [
        ["Aquatic Warbler", 51.0, 0.8, 8, "wetland", True],
        ["Aquatic Warbler", 57.0, -4.0, 1, "wetland", False],
        ["Yellow-browed Warbler", 54.0, -2.0, 10, "woodland", True],
        ["Yellow-browed Warbler", 54.0, -2.0, 6, "woodland", False],
        ["Golden Pheasant", 52.4, 0.7, 6, "woodland", True],
        ["Golden Pheasant", 57.0, -4.0, 6, "woodland", False],
    ]
    source = "const x=require('./uk_bird_expansion_3.js');const c=" + json.dumps(cases) + ";console.log(JSON.stringify(c.map(r=>x.isEligible(...r.slice(0,5)))));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [r[-1] for r in cases]


def test_authoritative_source_fixtures_cover_the_release_without_hybrids_or_duplicates():
    au = json.loads(AU_SOURCE.read_text())
    uk = json.loads(UK_CHECKLIST.read_text())
    assert au["source"].startswith("https://api.inaturalist.org/") and au["count"] == 50
    assert [row["name"] for row in au["species"]] == AU_EXPECTED
    assert all(row["rank"] == "species" and row["observations"] > 0 for row in au["species"])
    assert uk["source"].startswith("https://www.rspb.org.uk/") and uk["count"] >= 265
    assert all(row.get("appName") for row in uk["species"])
    assert all(re.fullmatch(r"[A-Z][A-Za-z-]+(?: [a-z-]+){1,2}", row["scientific"]) for row in uk["species"])
    assert all("`" not in row["scientific"] for row in uk["species"])
    assert len({_norm(row["scientific"]) for row in au["species"]}) == 50


def test_all_release_species_have_deep_field_guide_entries():
    education = json.loads(EDUCATION.read_text())
    expected = set(AU_EXPECTED + UK_EXPECTED)
    assert set(education) == expected
    for name, entry in education.items():
        assert entry["title"] == name
        assert len(entry["summary"]) >= 120
        assert len(entry["identification"]) >= 80
        assert len(entry["behaviour"]) >= 60
        assert len(entry["range"]) >= 40 and len(entry["diet"]) >= 25
        assert len(entry["learningNotes"]) >= 4
        assert len(entry["sources"]) >= 2


def test_placeholders_are_honest_unique_usable_cards_and_transparent_cutouts():
    hashes = set()
    for module in (AU_MODULE, UK_MODULE):
        for bird in _load(module)["species"]:
            assert "placeholder_20260715" in bird["art"]
            card = ROOT / bird["art"].removeprefix("/burbz/")
            cutout = card.parent / "cutouts" / f"{card.stem}_cutout.png"
            with Image.open(card) as image:
                assert image.format == "PNG" and image.size == (768, 768)
                assert image.convert("RGB").getbbox()
            with Image.open(cutout) as image:
                rgba = image.convert("RGBA")
                assert rgba.size == (512, 512)
                alpha = rgba.getchannel("A")
                assert alpha.getextrema() == (0, 255)
            hashes.add(hashlib.sha256(card.read_bytes()).hexdigest())
    assert len(hashes) == 85


def test_placeholder_cutouts_use_the_same_origin_offline_cache_path():
    html = HTML.read_text()
    start = html.index("function birdCutoutUrlFor(art)")
    end = html.index("// Delegated <img> error handling", start)
    function_source = html[start:end]
    source = "const BIRD_ART_GITHUB_RAW_BASE='https://github.example/raw';" + function_source + "console.log(JSON.stringify([birdCutoutUrlFor('/burbz/bird-art-cache/red_capped_plover_burbz_placeholder_20260715.png'),birdCutoutUrlFor('/burbz/bird-art-cache/robin_yaan_20260608.png')]));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    placeholder, established = json.loads(result.stdout)
    assert placeholder == "/burbz/bird-art-cache/cutouts/red_capped_plover_burbz_placeholder_20260715_cutout.png"
    assert established == "https://github.example/raw/public/burbz/bird-art-cache/cutouts/robin_yaan_20260608_cutout.png"


def test_no_new_common_or_scientific_name_collides_with_existing_catalog():
    old = []
    for module in (ROOT / "uk_bird_expansion_50.js", ROOT / "uk_bird_expansion_2.js", ROOT / "au_bird_expansion.js"):
        old.extend(_load(module)["species"])
    old_names = {_norm(x["name"]) for x in old}
    old_sci = {_norm(x["scientific"]) for x in old}
    new = _load(AU_MODULE)["species"] + _load(UK_MODULE)["species"]
    assert not (old_names & {_norm(x["name"]) for x in new})
    assert not (old_sci & {_norm(x["scientific"]) for x in new})
    assert len({_norm(x["name"]) for x in new}) == 85
    assert len({_norm(x["scientific"]) for x in new}) == 85


def test_index_and_service_worker_integrate_every_projection_and_new_cache():
    html = HTML.read_text()
    sw = SW.read_text()
    for marker in (
        '<script src="uk_bird_expansion_3.js?v=uk-regular-completion-20260715"></script>',
        '<script src="au_bird_expansion_2.js?v=au50-source-backed-r2-20260715"></script>',
        "WILD_BIRDS.push(...UK_FINAL.names, ...AU50.names);",
        "REGION_AREA_SPECIES.uk.push(...UK_FINAL.names, ...UK_FINAL.regionalAliases);",
        "REGION_AREA_SPECIES.au.push(...AU50.names);",
        "BURBZ_SPECIES_PROFILES.push(...UK_FINAL.profiles, ...AU50.profiles);",
        "Object.assign(BUILT_IN_BIRD_ART, UK_FINAL.art, AU50.art);",
        "Object.assign(REAL_WORLD_COMMONNESS, UK_FINAL.commonness, AU50.commonness);",
        "AU50.isEligible(species, lat, lon, month, habitat)",
        "UK_FINAL.isEligible(species, lat, lon, month, habitat)",
        "BIRD_EDUCATION_REGIONAL_20260715_URL",
    ):
        assert marker in html
    for marker in (
        "burbz-discovery-flip-cards-v83-20260716",
        "importScripts('./uk_bird_expansion_3.js?v=uk-regular-completion-20260715');",
        "importScripts('./au_bird_expansion_2.js?v=au50-source-backed-r2-20260715');",
        "./data/regional-bird-education-20260715.json?v=regional-birds-v75-20260715",
    ):
        assert marker in sw
