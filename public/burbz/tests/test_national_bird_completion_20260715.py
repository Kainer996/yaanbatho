import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
MODULE = ROOT / "national_bird_completion_20260715.js"
DATA = ROOT / "data" / "national-bird-completion"
ART = ROOT / "bird-art-cache" / "national-completion"
SOURCE_DIR = DATA / "source-cache"
STATS = {"hp", "stamina", "strength", "def", "spd", "int"}
HABITATS = {"water", "wetland", "woodland", "heath", "park", "farmland", "grassland", "urban", "coast", "hills", "default"}


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower().replace("’", "'").replace("\u00a0", " "))


def load_module():
    result = subprocess.run(
        ["node", "-e", "const x=require('./national_bird_completion_20260715.js'); console.log(JSON.stringify({version:x.version,profiles:x.profiles,names:x.names,regions:x.regions,commonness:x.commonness}));"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_contract_arithmetic_and_raw_source_provenance():
    manifest = json.loads((DATA / "manifest.json").read_text())
    assert manifest["contracts"]["uk"] == {"accepted": 636, "membership_added": 354, "missing": 354, "pre_existing": 282, "unresolved": 0}
    assert manifest["contracts"]["au"]["accepted"] == 968
    assert manifest["contracts"]["au"]["pre_existing"] == 306
    assert manifest["contracts"]["au"]["missing"] == manifest["contracts"]["au"]["membership_added"] == 662
    assert manifest["contracts"]["au"]["unresolved"] == 0
    assert manifest["contracts"]["au"]["supplementary_excluded"] == 19
    assert manifest["contracts"]["au"]["no_confirmed_record_excluded"] == ["Ducula bicolor"]
    assert manifest["contracts"]["es"]["accepted_selection"] == manifest["contracts"]["es"]["membership_added"] == 50
    assert manifest["contracts"]["taxonomy"]["regional_memberships"] == 1066
    assert manifest["contracts"]["taxonomy"]["unique_profiles"] == 951
    assert manifest["contracts"]["taxonomy"]["unresolved"] == 0
    assert manifest["contracts"]["nirbc"] == {"accepted_abc": 353, "covered_by_bou": 353, "northern_ireland_only_unresolved": 0}
    assert manifest["wikipediaFieldGuide"]["entries"] == 951
    assert manifest["wikipediaFieldGuide"]["license"].startswith("Mixed: CC BY-SA 4.0")
    for name, row in manifest["sourceFiles"].items():
        expected_retrieved = "2026-07-16" if name == "spain-gbif-locality-grid-20260716.json" else "2026-07-15"
        assert row["retrieved"] == expected_retrieved
        assert row["url"]
        assert row["sha256"] == hashlib.sha256((SOURCE_DIR / name).read_bytes()).hexdigest()
    checked_in_wiki = DATA / "wikipedia-field-guide-fixture.json"
    assert checked_in_wiki.exists()
    assert hashlib.sha256(checked_in_wiki.read_bytes()).hexdigest() == manifest["sourceFiles"]["wikipedia-field-guide-fixture.json"]["sha256"]
    assert {"au-wlab-v4.3-species.json", "missing-summary.json", "nirbc-abc-2020.json", "nirbc-list-2020.html"} <= set(manifest["sourceFiles"])


def test_au_wlab_raw_parser_scope_and_exclusions():
    accepted = json.loads((DATA / "au-accepted-fixture.json").read_text())
    assert accepted["count"] == 968
    species = accepted["species"]
    assert len(species) == 968
    assert {row["scientific"] for row in species} >= {"Entomyzon albipennis", "Petrophassa albipennis"}
    assert "Ducula bicolor" not in {row["scientific"] for row in species}
    assert all(str(row.get("taxonLevel", "")).lower() == "sp" for row in species)
    assert all(not row.get("supplementary") for row in species)
    assert all(row.get("population") != "No confirmed record" for row in species)


def test_unified_module_schema_regions_and_duplicate_guards():
    data = load_module()
    assert data["version"] == "national-bird-completion-20260715"
    profiles = data["profiles"]
    assert len(profiles) == 951
    assert len(data["names"]) == 951
    assert len({norm(p["scientificName"]) for p in profiles}) == 951
    assert len({norm(p["name"]) for p in profiles}) == 951
    assert len(data["regions"]["uk"]["names"]) == 354
    assert len(data["regions"]["au"]["names"]) == 662
    assert len(data["regions"]["es"]["names"]) == 50
    required = {"id", "name", "scientific", "scientificName", "family", "order", "countries", "regionData", "spawnable", "rarity", "commonness", "aliases", "stats", "traits", "rationale", "sources", "origin", "habitat", "habitats", "months", "bounds", "range", "diet", "conservation", "art", "artProvenance", "statProvenance", "wikipedia"}
    for profile in profiles:
        assert required <= set(profile), profile["name"]
        assert set(profile["stats"]) == STATS
        assert all(type(v) is int and 1 <= v <= 10 for v in profile["stats"].values())
        assert profile["habitats"] and set(profile["habitats"]) <= HABITATS
        assert profile["countries"] and profile["regionData"]
        assert len(profile["sources"]) >= 2
        if profile["scientificName"] == "Entomyzon albipennis":
            assert profile["wikipedia"]["url"].startswith("https://absa.asn.au/")
            assert "Australian Bird Study Association" in profile["wikipedia"]["license"]
        else:
            assert profile["wikipedia"]["url"] in profile["sources"]
            assert "CC BY-SA" in profile["wikipedia"]["license"]
        assert profile["artProvenance"]["kind"] == "generated_placeholder"
        assert profile["statProvenance"]["formulaVersion"] == "national-completion-stats-v2-20260715"
        assert "national-completion-stats-v2-20260715" not in profile["rationale"]
        assert "AVONET exact_scientific" not in profile["rationale"]
        assert "_" not in profile["rationale"]


def test_taxonomy_synonym_and_split_decisions_are_explicit():
    decisions = json.loads((DATA / "taxonomy-decisions.json").read_text())
    merges = {(row["from"], row["to"]) for row in decisions["synonymDecisions"]}
    assert merges == {
        ("Charadrius asiaticus", "Anarhynchus asiaticus"),
        ("Charadrius leschenaultii", "Anarhynchus leschenaultii"),
        ("Charadrius alexandrinus", "Anarhynchus alexandrinus"),
        ("Steganopus tricolor", "Phalaropus tricolor"),
        ("Glareola\u00a0pratincola", "Glareola pratincola"),
        ("Catharacta maccormicki", "Stercorarius maccormicki"),
        ("Larus atricilla", "Leucophaeus atricilla"),
        ("Larus pipixcan", "Leucophaeus pipixcan"),
    }
    split = decisions["splitDecisions"][0]
    assert split["decision"] == "do_not_merge"
    assert {split["left"], split["right"]} == {"Cecropis rufula", "Cecropis daurica"}
    profiles = {p["scientificName"]: p for p in json.loads((DATA / "profiles.json").read_text())}
    assert "Cecropis rufula" in profiles and "Cecropis daurica" in profiles
    assert "Red-rumped Swallow" in profiles["Cecropis rufula"]["aliases"]
    assert "Red-rumped Swallow" not in profiles["Cecropis daurica"]["aliases"]
    owners = {}
    for profile in profiles.values():
        for alias in profile["aliases"]:
            key = norm(alias.replace("-", " "))
            assert key not in owners or owners[key] == profile["scientificName"], (key, owners[key], profile["scientificName"])
            owners[key] = profile["scientificName"]


def test_spain_first50_ranking_fixture_and_absence_from_prerelease():
    selected = json.loads((DATA / "spain-selected-50-fixture.json").read_text())["species"]
    manifest = json.loads((DATA / "manifest.json").read_text())
    assert [row["scientific"] for row in selected] == manifest["spainRanking"]["selectedFirst50Scientific"]
    assert len(selected) == 50
    assert all((selected[i]["observations"], selected[i]["scientific"]) >= (selected[i + 1]["observations"], selected[i + 1]["scientific"]) for i in range(len(selected) - 1) if selected[i]["observations"] != selected[i + 1]["observations"])
    excluded = set(manifest["spainRanking"]["exclusions"])
    assert not excluded & {row["scientific"] for row in selected}
    effective = json.loads((SOURCE_DIR / "effective-catalogue.json").read_text())["profiles"]
    pre = {norm(p.get("scientific") or "") for p in effective} | {norm(p.get("name") or "") for p in effective}
    assert not ({norm(row["scientific"]) for row in selected} & pre)


def test_stat_provenance_and_cross_species_invariants():
    generated = {p["name"]: p for p in json.loads((DATA / "profiles.json").read_text())}
    effective = {p["name"]: p for p in json.loads((SOURCE_DIR / "effective-catalogue.json").read_text())["profiles"]}
    combined = {**effective, **generated}
    robin = combined.get("European Robin") or combined["Robin"]
    assert robin["stats"]["strength"] < combined["Golden Eagle"]["stats"]["strength"]
    gull_ints = [
        p["stats"]["int"]
        for p in generated.values()
        if p["family"] == "Laridae" or p["name"].lower().endswith("gull")
    ]
    assert combined["Carrion Crow"]["stats"]["int"] > max(gull_ints)
    assert combined["Peregrine Falcon"]["stats"]["spd"] >= 9
    assert max(p["stats"]["spd"] for p in generated.values() if "Swift" in p["name"]) >= 9
    assert min(p["stats"]["stamina"] for p in generated.values() if "Albatross" in p["name"]) >= 9
    assert combined["Emu"]["stats"]["strength"] >= 8 and combined["Emu"]["stats"]["stamina"] >= 8
    assert generated["Little Bustard"]["stats"]["spd"] <= 7
    assert generated["Little Bustard"]["stats"]["strength"] <= 7
    assert generated["Little Bustard"]["stats"]["strength"] < combined["Golden Eagle"]["stats"]["strength"]
    shorebirds = [
        p
        for p in generated.values()
        if any(word in p["name"] for word in ["Sandpiper", "Plover", "Stint", "Godwit", "Curlew", "Snipe"])
    ]
    assert shorebirds
    assert sum(1 for p in shorebirds if p["stats"]["spd"] == 10) == 0
    stat_rows = json.loads((DATA / "stat-provenance.json").read_text())
    assert len(stat_rows) == 951
    assert all(row["formula"] and row["rawTraits"] and row["fallback"] in {"exact_scientific", "trait_proxy_scientific", "family_median", "global_default"} for row in stat_rows)
    white_quilled_stats = next(row for row in stat_rows if row["scientific"] == "Entomyzon albipennis")
    assert white_quilled_stats["scientificMatch"] is False
    assert white_quilled_stats["traitProxyScientific"] == "Entomyzon cyanotis"
    exact_spatial = [row for row in stat_rows if row["fallback"] == "exact_scientific" and row.get("spatial")]
    assert exact_spatial
    assert all({"rangeSize", "centroidLatitude", "centroidLongitude"} <= set(row["spatial"]) for row in exact_spatial)


def test_region_eligibility_spawnability_and_leakage():
    cases = [
        ["es", "Monk Parakeet", 37.3, -1.9, 5, "urban", True],
        ["es", "Monk Parakeet", 41.3874, 2.1686, 5, "urban", True],
        ["es", "Great Bustard", 40.4168, -3.7038, 5, "grassland", True],
        ["es", "Great Bustard", 41.3874, 2.1686, 5, "grassland", False],
        ["es", "Great Bustard", 39.5696, 2.6502, 5, "grassland", False],
        ["uk", "Monk Parakeet", 51.5, -0.1, 5, "urban", False],
        ["au", "Monk Parakeet", -33.8, 151.2, 5, "urban", False],
        ["au", "Scrubtit", -42.9, 147.3, 7, "woodland", True],
        ["au", "White-quilled Honeyeater", -12.46, 130.84, 7, "woodland", True],
        ["au", "White-quilled Honeyeater", -33.8, 151.2, 7, "woodland", False],
        ["au", "Red Bishop", -33.8, 151.2, 7, "grassland", False],
        ["uk", "Red-breasted Goose", 52.0, 0.1, 9, "wetland", False],
        ["ie", "Monk Parakeet", 53.3, -6.2, 5, "urban", False],
        ["fr", "Monk Parakeet", 43.0, 2.0, 5, "urban", False],
        ["es", "Monk Parakeet", None, -1.9, 5, "urban", False],
    ]
    source = "const x=require('./national_bird_completion_20260715.js'); const cases=" + json.dumps(cases) + "; console.log(JSON.stringify(cases.map(c=>x.isEligible(...c.slice(0,6)))));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == [row[-1] for row in cases]
    profiles = {p["name"]: p for p in json.loads((DATA / "profiles.json").read_text())}
    assert profiles["Red-breasted Goose"]["regionData"]["uk"]["spawnable"] is False
    assert profiles["White-chested White-eye"]["spawnable"] is False
    assert profiles["White-chested White-eye"]["regionData"]["au"]["spawnable"] is False
    assert profiles["Tasman Starling"]["spawnable"] is False
    assert profiles["White-quilled Honeyeater"]["regionData"]["au"]["population"] == "Endemic"
    assert profiles["White-quilled Honeyeater"]["regionData"]["au"]["rangeEvidence"]["spawnableEvidence"] is True
    assert profiles["White-quilled Honeyeater"]["regionData"]["au"]["rangeEvidence"]["method"] == "authoritative_kimberley_top_end_northwest_queensland_bounds"
    assert all(p["regionData"]["uk"]["spawnable"] is False for p in profiles.values() if "uk" in p["regionData"])
    assert all(p["regionData"]["uk"]["statusClass"] in {"national_checklist_only", "rare_or_historical", "exceptional_vagrant"} for p in profiles.values() if "uk" in p["regionData"])
    assert all(p["regionData"]["au"]["spawnable"] is False for p in profiles.values() if p["regionData"].get("au", {}).get("statusClass") == "exceptional_vagrant")
    assert all(
        p["regionData"]["au"]["rangeEvidence"]["method"] in {"centroid_plus_circular_equivalent_radius_intersected_with_region_bounds", "authoritative_kimberley_top_end_northwest_queensland_bounds"}
        and p["regionData"]["au"]["rangeEvidence"]["spawnableEvidence"] is True
        for p in profiles.values()
        if p["regionData"].get("au", {}).get("spawnable")
    )
    scrubtit = profiles["Scrubtit"]["regionData"]["au"]["bounds"]
    assert scrubtit["latMin"] <= -42.9 <= scrubtit["latMax"] and scrubtit["lonMin"] <= 147.3 <= scrubtit["lonMax"]
    assert not (scrubtit["latMin"] <= -33.8 <= scrubtit["latMax"] and scrubtit["lonMin"] <= 151.2 <= scrubtit["lonMax"])
    spanish = [p for p in profiles.values() if "es" in p["regionData"]]
    assert len(spanish) == 50
    assert all(p["regionData"]["es"]["spatialCells"] for p in spanish)
    assert all(p["regionData"]["es"]["rangeEvidence"]["method"] == "gbif_observed_locality_grid" for p in spanish)
    assert all(p["regionData"]["es"]["bounds"] != {"latMin": 35.8, "latMax": 43.9, "lonMin": -9.5, "lonMax": 4.5} for p in spanish)
    assert max(p["commonness"] for p in profiles.values() if any(rd["statusClass"] == "exceptional_vagrant" for rd in p["regionData"].values())) <= 4


def test_regional_pool_helper_adds_only_spawnable_species_without_fallback_corruption():
    source = """
const x=require('./national_bird_completion_20260715.js');
const pools={uk:{default:[]},au:{default:[]},es:{default:[]}};
x.addToRegionalPools(pools);
console.log(JSON.stringify({
  uk:pools.uk.default.length,
  au:pools.au.default.length,
  es:pools.es.default.length,
  top:Object.keys(pools).sort(),
  badAu:pools.au.default.filter(name=>{
    const p=x.profiles.find(row=>row.name===name);
    return !p || p.regionData.au?.spawnable !== true;
  })
}));
"""
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["uk"] == 0
    assert payload["au"] > 0 and payload["es"] > 0
    assert payload["top"] == ["au", "es", "uk"]
    assert payload["badAu"] == []


def test_education_entries_and_honest_svg_art_manifest():
    education = json.loads((DATA / "education.json").read_text())
    art_manifest = json.loads((DATA / "art-manifest.json").read_text())
    wiki = json.loads((DATA / "wikipedia-field-guide-fixture.json").read_text())
    profiles = {p["name"]: p for p in json.loads((DATA / "profiles.json").read_text())}
    assert len(education) == len(art_manifest) == 951
    assert len(wiki["entries"]) == 951
    for name, entry in education.items():
        profile = profiles[name]
        fixture_entry = wiki["entries"][profile["scientificName"]]
        assert entry["title"] == name
        assert entry["summary"] == fixture_entry["extract"]
        assert entry["wikipediaExtract"] == fixture_entry["extract"]
        assert entry["wikipediaAttribution"]["url"] == fixture_entry["url"]
        if profile["scientificName"] == "Entomyzon albipennis":
            assert "Australian Bird Study Association" in entry["wikipediaAttribution"]["license"]
        else:
            assert entry["wikipediaAttribution"]["license"].startswith("CC BY-SA")
        assert entry["wikipediaAttribution"]["revisionId"] == fixture_entry["revisionId"]
        assert fixture_entry["url"] in {source["url"] for source in entry["sources"]}
        assert profile["scientificName"] in entry["identification"]
        assert "national-completion-stats-v2-20260715" not in entry["behaviour"]
        assert "AVONET exact_scientific" not in entry["behaviour"]
        assert "_" not in entry["behaviour"]
        assert "not a claim of local abundance" in " ".join(entry["learningNotes"])
        assert len(entry["sources"]) >= 2
    white_quilled = education["White-quilled Honeyeater"]
    assert white_quilled["wikipediaAttribution"]["url"].startswith("https://absa.asn.au/")
    assert "white-quilled honeyeater" in white_quilled["summary"].lower()
    for scientific, row in art_manifest.items():
        path = ROOT / row["path"].removeprefix("/burbz/")
        assert path.exists()
        text = path.read_text()
        assert "FIELD GUIDE ART" in text and "PENDING" in text and "No bird or plumage depiction" in text
        assert row["kind"] == "generated_placeholder"
        assert row["license"].startswith("generated placeholder")
        assert row["hash"] == hashlib.sha256(path.read_bytes()).hexdigest()
        ET.fromstring(text)
    assert len(list(ART.glob("*.svg"))) == 951


def test_module_syntax_and_generator_check_are_deterministic():
    syntax = subprocess.run(["node", "--check", str(MODULE.name)], cwd=ROOT, text=True, capture_output=True)
    assert syntax.returncode == 0, syntax.stderr
    check = subprocess.run(
        [sys.executable, "scripts/build_national_bird_completion.py", "--source-dir", str(SOURCE_DIR), "--check"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert check.returncode == 0, check.stderr
    assert "artifacts are current" in check.stdout
