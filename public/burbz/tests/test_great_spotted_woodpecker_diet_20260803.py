"""Great Spotted Woodpecker diet must teach its real British field-guide diet."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def node_json(source: str):
    out = subprocess.check_output(["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8")
    return json.loads(out)


def woodpecker_record():
    return node_json("""
const payload=require('./data/bird-diet-records.js');
const row=payload.sourceRecords.find(r=>r.s==='Dendrocopos major');
console.log(JSON.stringify(row));
""")


def test_woodpecker_menu_matches_bto_and_woodland_trust_guidance():
    row = woodpecker_record()
    assert row["primary"] == ["invertebrates"]
    assert row["secondary"] == ["seeds", "small_birds"]
    assert "small_mammals" not in row["g"]
    assert "carrion" not in row["g"]
    assert row["g"]["small_birds"] == 10
    assert "BTO" in row["e"] and "Woodland Trust" in row["e"]
    assert row["x"] == "BTO + Woodland Trust"


def test_runtime_card_discloses_refined_source_and_correct_labels():
    disclosure = node_json("""
const core=require('./bird_diet_hunger_core.js');
console.log(JSON.stringify(core.dietDisclosureForSpecies({name:'Great Spotted Woodpecker'})));
""")
    assert disclosure["primaryLabels"] == ["General invertebrates"]
    assert disclosure["secondaryLabels"] == ["Seeds", "Small-bird prey rations"]
    assert "Small mammals" not in disclosure["compatibleLabels"]
    assert "Carrion" not in disclosure["compatibleLabels"]
    assert disclosure["provenance"] == "BirdFuncDat + BTO + Woodland Trust refinement · certainty A"


def test_release_cache_pins_the_corrected_diet_assets():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    release = "real-walk-nearby-quests-v215-20260803"
    assert f'data/bird-diet-records.js?v={release}' in html
    assert f'bird_diet_hunger_core.js?v={release}' in html
    assert release in html
    assert release in sw
