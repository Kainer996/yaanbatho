"""Every official BOU British-list label must unlock its existing Burbz taxon."""
import importlib.util
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOU = ROOT / "data/national-bird-completion/source-cache/uk-bou-abc-2025.json"
ALIAS_MODULE = ROOT / "uk_bird_alias_completion_20260803.js"
SOUND_TEST = ROOT / "tests/test_sound_catalogue_unlock_20260722.py"


def load_sound_test():
    spec = importlib.util.spec_from_file_location("sound_catalogue_test", SOUND_TEST)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def test_official_bou_fixture_is_the_complete_636_species_list():
    data = json.loads(BOU.read_text(encoding="utf-8"))
    assert data["count"] == 636
    assert len(data["species"]) == 636


def test_alias_completion_module_is_loaded_and_cached():
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    pin = "uk-bird-alias-completion-v216-20260803"
    assert ALIAS_MODULE.exists()
    assert f"uk_bird_alias_completion_20260803.js?v={pin}" in source
    assert f"./uk_bird_alias_completion_20260803.js?v={pin}" in sw
    assert pin in source and pin in sw


def test_all_british_international_and_scientific_labels_resolve():
    sound_test = load_sound_test()
    assert "uk_bird_alias_completion_20260803.js" in sound_test.EXPANSION_MODULES
    script = sound_test.build_harness_script().split("const nameFails = [];", 1)[0]
    rows = json.loads(BOU.read_text(encoding="utf-8"))["species"]
    script += f"""
const bouRows = {json.dumps(rows)};
const unresolved = [];
for (const bird of bouRows) {{
  for (const [kind, label] of [['british', bird.name], ['international', bird.internationalName], ['scientific', bird.scientific]]) {{
    if (label && !findSpeciesProfile(label)) unresolved.push({{kind, label, bird: bird.name}});
  }}
}}
const western = findSpeciesProfile('Western House Martin');
const entry = createBirdEntry('Western House Martin', 'Delichon urbicum', 0.9);
console.log(JSON.stringify({{
  aliasResult: UK_BIRD_ALIAS_RESULT,
  unresolved,
  western: western && {{name: western.name, scientificName: western.scientificName, aliases: western.aliases}},
  entry: {{species: entry.species, scientificName: entry.scientificName, artUrl: entry.artUrl}}
}}));
"""
    harness = ROOT / "tests/_uk_alias_completion_harness.js"
    harness.write_text(script, encoding="utf-8")
    try:
        result = subprocess.run(["node", harness.name], cwd=harness.parent, text=True, capture_output=True, timeout=180)
    finally:
        harness.unlink(missing_ok=True)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["aliasResult"] == {"species": 636, "aliasesAdded": 182, "unresolved": [], "collisions": []}
    assert out["unresolved"] == []
    assert out["western"]["name"] == "House Martin"
    assert out["western"]["scientificName"] == "Delichon urbicum"
    assert "Western House Martin" in out["western"]["aliases"]
    assert out["entry"]["species"] == "House Martin"
    assert out["entry"]["scientificName"] == "Delichon urbicum"
    source = (ROOT / "index.html").read_text(encoding="utf-8")
    assert "'House Martin': '/burbz/bird-art-cache/house_martin_burbz_manga" in source
