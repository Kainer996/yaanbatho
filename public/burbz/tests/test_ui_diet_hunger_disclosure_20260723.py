import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        capture_output=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr + "\nSTDOUT:\n" + result.stdout
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def test_diet_disclosure_core_covers_representative_match_and_fallback_cases():
    out = run_node(
        """
const D = require('./bird_diet_hunger_core.js');
const cases = {
  exact: D.dietDisclosureForSpecies({ scientificName:'Acanthiza apicalis', commonName:'Inland Thornbill' }),
  commonName: D.dietDisclosureForSpecies({ scientificName:'Acanthis flammea', commonName:'Redpoll' }),
  familyFallback: D.dietDisclosureForSpecies({ commonName:'Tasman Starling' }),
  unmatched: D.dietDisclosureForSpecies({ scientificName:'Imaginaryus absentus', commonName:'Imaginary Wisp' }),
  merlin: D.dietDisclosureForSpecies({ scientificName:'Falco columbarius', commonName:'Merlin' })
};
console.log(JSON.stringify(cases));
"""
    )

    assert out["exact"]["matchMethod"] == "exact"
    assert out["exact"]["primaryLabels"]
    assert "BirdFuncDat exact match" in out["exact"]["provenance"]

    assert out["commonName"]["matchMethod"] == "common-name"
    assert out["commonName"]["fallbackType"] == "common-name-match"
    assert "BirdFuncDat common-name match" in out["commonName"]["provenance"]

    assert out["familyFallback"]["matchMethod"] == "family-fallback"
    assert out["familyFallback"]["fallbackType"] == "family-fallback"
    assert out["familyFallback"]["noSpeciesClaim"] is True
    assert "family fallback" in out["familyFallback"]["provenance"].lower()
    assert "no species-level prey claim" in out["familyFallback"]["education"].lower()

    assert out["unmatched"]["matchMethod"] == "unmatched"
    assert out["unmatched"]["fallbackType"] == "unmatched-conservative"
    assert out["unmatched"]["primaryLabels"] == []
    assert out["unmatched"]["secondaryLabels"]
    assert out["unmatched"]["noSpeciesClaim"] is True
    assert "conservative unmatched fallback" in out["unmatched"]["provenance"].lower()
    assert "no species-level diet claim" in out["unmatched"]["education"].lower()

    assert out["merlin"]["matchMethod"] == "override"
    assert out["merlin"]["fallbackType"] == "merlin-override"
    assert out["merlin"]["primaryFamilies"] == ["small_birds"]
    assert "invertebrates" in out["merlin"]["secondaryFamilies"]
    merlin_copy = out["merlin"]["education"].lower()
    for marker in ("falco columbarius", "small falcon", "meadow pipits", "skylarks"):
      assert marker in merlin_copy


def test_named_hunger_surfaces_show_humane_status_in_render_paths():
    html = INDEX.read_text(encoding="utf-8")
    for marker in (
        'data-hunger-surface="companion-card"',
        'data-hunger-surface="academy-room"',
        'data-hunger-surface="expedition-dispatch"',
        'data-hunger-surface="training-dispatch"',
        'data-hunger-surface="battle-readiness"',
        'data-hunger-surface="merlin-care"',
    ):
        assert marker in html, marker

    for label in ("Fed", "Peckish", "Hungry", "Urgent care"):
        assert label.lower() in html.lower()

    quest = function_source(html, "renderQuestSendSheet")
    training = function_source(html, "renderTrainingHallPanel")
    battle = function_source(html, "renderBattleSelect")
    merlin = function_source(html, "renderMerlinCareMenu")
    assert "readiness.status.label" in quest
    assert "baseNote + ' · ' + hungerNote" in quest
    # training-your-way-v288: the board sheds its '· fed' suffix, but every
    # bird button still wears the hunger state and a blocked bird says why.
    assert 'data-hunger-state="' in training
    assert "Feed ' + birdDisplayName(b) + ' first'" in training
    assert "hungerMeta = ' · ' + readiness.status.label" in battle
    assert "merlinHungerStatus" in merlin


def test_named_diet_surfaces_render_primary_secondary_provenance_hooks():
    html = INDEX.read_text(encoding="utf-8")
    helper = function_source(html, "renderDietDisclosureHTML")
    for marker in (
        "data-diet-surface",
        "data-diet-primary",
        "data-diet-secondary",
        "data-compatible-foods",
        "data-diet-provenance",
        "data-diet-fallback",
        "<b>Primary:</b>",
        "<b>Secondary:</b>",
    ):
        assert marker in helper, marker

    expectations = {
        "field-guide-profile": function_source(html, "renderBirdDietPanel"),
        "companion-card": function_source(html, "createBirdCardHTML"),
        "care-panel": function_source(html, "academyDietLine"),
        "pantry-card": function_source(html, "kitchenDietGuidanceHTML"),
        "merlin-care": html[html.index("function renderMerlinCareMenu("):html.index("function renderPetCompanion(", html.index("function renderMerlinCareMenu("))],
    }
    for surface, source in expectations.items():
        assert f"'{surface}'" in source or f'data-diet-surface="{surface}"' in source, surface

    assert "Diet not yet discovered" not in function_source(html, "renderBirdDietPanel")
    assert "Capture this species in the wild to unlock the feeding panel" not in html


def test_fallback_and_merlin_ui_copy_is_specific_where_safe():
    html = INDEX.read_text(encoding="utf-8")
    required_copy = (
        "BirdFuncDat family fallback",
        "Conservative unmatched fallback",
        "no species-level diet claim",
        "no species-level prey claim",
        "BirdFuncDat Merlin override",
        "Falco columbarius",
        "small-bird prey",
        "Meadow Pipits",
        "Skylarks",
    )
    for marker in required_copy:
        assert marker in html or marker in (ROOT / "bird_diet_hunger_core.js").read_text(encoding="utf-8"), marker

    stale_merlin = re.compile(r"Merlin[^\\n]{0,120}(mealworm primary|mealworms as (?:the )?main|hungry for mealworms)", re.I)
    assert not stale_merlin.search(html)
