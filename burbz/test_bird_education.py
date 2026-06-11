import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "burbz" / "index.html").read_text(encoding="utf-8")
EDUCATION_PATH = ROOT / "burbz" / "data" / "bird-education.json"


def _wild_birds():
    match = re.search(r"const WILD_BIRDS = \[(.*?)\];", HTML, re.S)
    assert match, "WILD_BIRDS list should be present"
    return re.findall(r"'([^']+)'", match.group(1))


def test_education_dataset_covers_every_burbz_species():
    data = json.loads(EDUCATION_PATH.read_text(encoding="utf-8"))
    missing = [species for species in _wild_birds() if species not in data]
    assert not missing


def test_each_bird_has_deep_field_guide_sections():
    data = json.loads(EDUCATION_PATH.read_text(encoding="utf-8"))
    required = {
        "title",
        "summary",
        "scientificName",
        "taxonomy",
        "identification",
        "behaviour",
        "habitat",
        "diet",
        "breeding",
        "range",
        "conservation",
        "learningNotes",
        "sources",
    }
    for species in _wild_birds():
        entry = data[species]
        missing = required - set(entry)
        assert not missing, f"{species} missing {sorted(missing)}"
        assert len(entry["summary"]) >= 120, species
        assert len(entry["learningNotes"]) >= 3, species
        assert any("wikipedia.org" in source.get("url", "") for source in entry["sources"]), species


def test_bird_info_modal_loads_and_renders_education_dataset():
    assert "bird-education.json" in HTML
    assert "loadBirdEducation" in HTML
    assert "renderEducationSections" in HTML
    assert "Wikipedia" in HTML
