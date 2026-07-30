"""Regression for the duplicated companion cards in Kitchen & Pantry.

The companion feeding table is the only care surface for Merlin and recruited
companions.  The lower feeder is reserved for still-wild Birdex visitors, so a
bird cannot appear twice with opposite-looking Fullness/Hunger bars.
"""
from pathlib import Path

HTML = Path(__file__).resolve().parents[1] / "index.html"


def function_source(text: str, name: str) -> str:
    start = text.index(f"function {name}(")
    next_function = text.find("\nfunction ", start + 1)
    return text[start:] if next_function < 0 else text[start:next_function]


def test_prep_counter_excludes_merlin_and_recruited_companions():
    html = HTML.read_text(encoding="utf-8")
    choices = function_source(html, "kitchenPrepCounterChoices")
    assert "kitchenSpeciesChoices()" in choices
    assert "!row.merlin" in choices
    assert "!row.companion" in choices


def test_kitchen_uses_companion_roster_then_wild_feeder_without_duplicate_hunger_bar():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderKitchenPanelHTML")
    assert "const rosterHtml = renderKitchenRosterHTML();" in panel
    assert "const choices = kitchenPrepCounterChoices();" in panel
    assert "if (!choices.length) return rosterHtml;" in panel
    assert "kitchenPrepCounterSelectedChoice(choices)" in panel
    assert "Wild Bird Feeder" in panel
    assert "kitchenGuestHungerHTML(chosen)" in panel


def test_wild_feeder_has_no_companion_hunger_meter():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderKitchenPanelHTML")
    choices = function_source(html, "kitchenPrepCounterChoices")
    assert "kitchenHungryChoices()" not in panel
    assert "kitchenSelectedChoice()" not in panel
    assert "row.merlin" in choices and "row.companion" in choices


def test_release_markers_force_the_fixed_kitchen_shell_to_replace_v174():
    html = HTML.read_text(encoding="utf-8")
    sw = (HTML.parent / "sw.js").read_text(encoding="utf-8")
    marker = "kitchen-no-duplicate-companions-v175-20260730"
    assert f"const BURBZ_BUILD = '{marker}';" in html
    assert marker in sw
