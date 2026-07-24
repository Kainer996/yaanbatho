"""Kitchen Prep Counter simplification: baby-simple by default.

The default view is just: bird picker, bird name, an emoji "Eats" chip row,
three plate slots and the Serve button. Everything wordier — companion
status, habitat clue, the sourced Pantry diet card, the how-it-works help
and the pantry bridge — folds behind collapsed <details> sections, so the
disclosure contract survives in the DOM without burying the player in text.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def function_source(html: str, name: str) -> str:
    start = html.index("function " + name + "(")
    end = html.index("\nfunction ", start + 10)
    return html[start:end]


def test_default_species_card_is_name_plus_eats_chips_only():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderKitchenPanelHTML")
    assert "kitchenEatsChipsHTML(chosen)" in panel
    # Status line, habitat clue and the sourced diet card all live INSIDE
    # the collapsed Bird facts details, after its summary.
    details_at = panel.index('<details class="kitchen-more"><summary>ℹ️ Bird facts</summary>')
    assert panel.index("kitchen-guest-status") > details_at
    assert panel.index("kitchen-guest-clue") > details_at
    assert panel.index("kitchenDietGuidanceHTML(chosen, rule)") > details_at
    # The empty-notes filler is gone — notes render only when they exist.
    assert "No field notes yet" not in html
    notes = function_source(html, "kitchenNotesLine")
    assert "return '';" in notes


def test_help_copy_and_pantry_bridge_fold_behind_details():
    html = HTML.read_text(encoding="utf-8")
    panel = function_source(html, "renderKitchenPanelHTML")
    how_at = panel.index("How the Kitchen works")
    # The starter-stores documentation and the pantry bridge stay in the DOM
    # (contract) but render inside the collapsed section.
    assert panel.index("Starter Stores include falcon rations") > how_at
    assert panel.index("kitchenPantryBridgeHTML()") > how_at
    # The roster intro is one short line now.
    roster = function_source(html, "renderKitchenRosterHTML")
    assert "Give each companion food it really eats" in roster
    assert "Stock the kitchen from liberated village markets" not in roster


def test_eats_chips_cover_every_source_diet_family():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("const KITCHEN_EATS_META = {")
    end = html.index("\n};", start) + 3
    core = (ROOT / "bird_diet_hunger_core.js").read_text(encoding="utf-8")
    script = (
        core
        + "\n" + html[start:end]
        + "\nconsole.log(JSON.stringify({ meta: Object.keys(KITCHEN_EATS_META), families: Object.keys(module.exports.FOOD_FAMILIES) }));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert set(out["families"]) <= set(out["meta"]), set(out["families"]) - set(out["meta"])


def test_slot_sheet_copy_is_short():
    html = HTML.read_text(encoding="utf-8")
    assert "Pick a food, then how to serve it." in html
    assert "the preparation matters as much as the food" not in html
