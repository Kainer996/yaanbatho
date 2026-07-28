import json
import re
import subprocess
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
SERVER = ROOT / "server.py"
NATIONAL = ROOT / "national_bird_completion_20260715.js"
DATA = ROOT / "data" / "national-bird-completion"


def html():
    return INDEX.read_text(encoding="utf-8")


def test_national_script_loads_before_main_and_runtime_roster_grows_exactly_951():
    source = html()
    national_tag = '<script src="national_bird_completion_20260715.js?v=national-completion-20260715"></script>'
    assert national_tag in source
    assert source.index(national_tag) < source.index("<script>\n/* ============================================================================")
    assert "const NATIONAL = window.BURBZ_NATIONAL_BIRD_COMPLETION_20260715 ||" in source
    assert "addUniqueWildBird(name)" in source
    assert "NATIONAL.names.forEach(addUniqueWildBird);" in source
    assert "addNationalSpeciesProfiles(BURBZ_SPECIES_PROFILES, NATIONAL.profiles);" in source

    module = subprocess.run(
        ["node", "-e", "const x=require('./national_bird_completion_20260715.js'); console.log(JSON.stringify({names:x.names.length, unique:new Set(x.names.map(n=>n.toLowerCase())).size, profiles:x.profiles.length}));"],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert module.returncode == 0, module.stderr
    assert json.loads(module.stdout) == {"names": 951, "unique": 951, "profiles": 951}


def test_runtime_region_wiring_has_spain_no_unsupported_fallback_and_no_uk_completion_spawns():
    source = html()
    assert "es: makeNationalRegionalHabitatPools()" in source
    assert "NATIONAL.addToRegionalPools(REGIONAL_HABITAT_BIRD_POOLS);" in source
    assert "NATIONAL.profiles.forEach(addNationalSpawnableAreaSpecies);" in source
    assert "REGION_AREA_SPECIES_SETS[region]" in source
    assert "|| REGION_AREA_SPECIES_SETS.uk" not in source
    assert "if (!region || region === 'unsupported') return null;" in source
    assert "if (!pool.length) return null;" in source
    assert "return 'es';" in source
    assert "SPAIN_BOUNDARY.contains(lat, lon)" in source
    assert "mainland Spain and the Balearics" in source
    assert "NATIONAL.isEligible(region, species, lat, lon, month, habitat)" in source

    profiles = json.loads((DATA / "profiles.json").read_text(encoding="utf-8"))
    uk_names = {p["name"] for p in profiles if p.get("regionData", {}).get("uk")}
    spawnable_uk = {p["name"] for p in profiles if p.get("regionData", {}).get("uk", {}).get("spawnable") is True}
    assert len(uk_names) == 354
    assert spawnable_uk == set()


def test_national_education_and_pending_art_are_loaded_on_demand():
    source = html()
    assert "/burbz/data/national-bird-completion/education.json?v=national-completion-20260715" in source
    assert "regional20260715, national20260715" in source
    scrubtit = json.loads((DATA / "education.json").read_text(encoding="utf-8"))["Scrubtit"]
    assert scrubtit["summary"] == scrubtit["wikipediaExtract"]
    assert "wikipedia.org" in scrubtit["wikipediaAttribution"]["url"]
    assert "field_guide_art_pending" in json.loads((DATA / "profiles.json").read_text(encoding="utf-8"))[0]["artProvenance"]["path"]


@pytest.mark.skipif(not SERVER.exists(), reason="production server module is not present in source worktrees")
def test_server_catalog_loads_national_profiles_and_keeps_public_report_closed():
    assert "national-bird-completion" in SERVER.read_text(encoding="utf-8")
    script = """
import json
import server
print(json.dumps({
  'scrubCommon': server._catalog_lookup('Scrubtit')['common_name'],
  'scrubScientific': server._catalog_lookup('Acanthornis magna')['common_name'],
  'kentishCommon': server._catalog_lookup('Kentish Plover')['latin_name'],
  'kentishAlias': server._catalog_lookup('Charadrius alexandrinus')['common_name'],
  'unknown': server._catalog_lookup('Totally Fake Bird') is None,
  'photo': server.species_to_game_bird('Acanthornis magna', 'Scrubtit', 0.88)['catalogMatched'],
  'routes': sorted(str(r) for r in server.app.url_map.iter_rules() if 'report' in str(r) and 'admin' not in str(r)),
}))
"""
    result = subprocess.run([str(ROOT / "venv" / "bin" / "python"), "-c", script], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout.strip().splitlines()[-1])
    assert payload == {
        "scrubCommon": "Scrubtit",
        "scrubScientific": "Scrubtit",
        "kentishCommon": "Anarhynchus alexandrinus",
        "kentishAlias": "Kentish Plover",
        "unknown": True,
        "photo": True,
        "routes": [],
    }


def test_birdex_windowing_cache_and_anti_cheat_release_text():
    source = html()
    assert "const BIRDEX_PAGE_SIZE = 80;" in source
    assert "birdexVisibleLimit" in source
    assert "Load more Birdex species" in source
    assert "No locked species names in markup" not in source
    assert "manual correction" not in source.lower()
    assert "simulateScan(" not in source
    assert "window.simulateScan" not in source
    tutorial_count = len(re.findall(r"title:'", source[source.index("const MERLIN_TUTORIAL_STEPS = ["):source.index("\n];", source.index("const MERLIN_TUTORIAL_STEPS = ["))]))
    assert 20 <= tutorial_count <= 60

    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_CACHE = 'burbz-" in sw
    assert "./national_bird_completion_20260715.js?v=national-completion-20260715" in sw
    assert "./data/national-bird-completion/manifest.json?v=national-completion-20260715" in sw
    assert "BURBZ_CORE.map(asset" in sw
    assert "./data/national-bird-completion/profiles.json?v=national-completion-20260715" not in sw
    assert "./data/national-bird-completion/education.json?v=national-completion-20260715" not in sw
    assert "cache.put(request, copy)" in sw  # on-demand field guides become offline after first use
    assert not re.search(r"national-completion/[^'\"\\n]+\\.svg", sw)
