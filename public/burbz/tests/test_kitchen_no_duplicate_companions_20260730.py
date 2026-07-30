"""Regression for the duplicated companion cards in Kitchen & Pantry.

The companion feeding table is the only care surface for Merlin and recruited
companions. Codex-only birds are never rendered as feeding targets.
"""
from pathlib import Path

HTML = Path(__file__).resolve().parents[1] / "index.html"


def function_source(text: str, name: str) -> str:
    start = text.index(f"function {name}(")
    next_function = text.find("\nfunction ", start + 1)
    return text[start:] if next_function < 0 else text[start:next_function]


def test_codex_only_birds_cannot_become_feed_entries():
    html = HTML.read_text(encoding="utf-8")
    entry = function_source(html, "kitchenCounterFeedEntry")
    assert "!chosen.merlin && !chosen.companion" in entry
    assert "feedWildEntryForSpeciesKey" not in entry


def test_kitchen_uses_only_the_companion_roster():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderKitchenPanelHTML")
    assert "return renderKitchenRosterHTML();" in panel
    assert "kitchenPrepCounterChoices" not in panel
    assert "data-kitchen-pantry-root" not in panel


def test_no_secondary_hunger_surface_is_rendered():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderKitchenPanelHTML")
    assert "kitchenGuestHungerHTML" not in panel
    assert 'data-hunger-surface="prep-counter"' not in panel


def test_release_markers_force_the_companion_only_kitchen_to_replace_v175():
    html = HTML.read_text(encoding="utf-8")
    sw = (HTML.parent / "sw.js").read_text(encoding="utf-8")
    marker = "companion-feeding-only-v176-20260730"
    assert "Wild Bird Feeder" not in html
    assert marker in sw
