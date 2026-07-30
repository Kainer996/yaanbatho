"""Regression: Kitchen feeding is for Merlin and recruited companions only."""

from pathlib import Path

HTML = Path(__file__).parents[1] / "index.html"


def function_source(source: str, name: str) -> str:
    marker = f"function {name}("
    start = source.index(marker)
    brace = source.index("{", start)
    depth = 0
    quote = None
    escape = False
    for index in range(brace, len(source)):
        char = source[index]
        if quote:
            if escape:
                escape = False
            elif char == "\\":
                escape = True
            elif char == quote:
                quote = None
            continue
        if char in ("'", '"', "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return source[start:index + 1]
    raise AssertionError(f"unterminated function {name}")


def test_kitchen_panel_renders_only_the_companion_feeding_table():
    source = HTML.read_text()
    panel = function_source(source, "renderKitchenPanelHTML")

    assert panel.count("renderKitchenRosterHTML()") == 1
    assert "kitchenPrepCounterChoices" not in panel
    assert "data-kitchen-pantry-root" not in panel
    assert "Wild Bird Feeder" not in panel


def test_feeding_transaction_rejects_codex_only_birds():
    source = HTML.read_text()
    transaction = function_source(source, "kitchenCounterFeedEntry")

    guard = "if (!chosen || (!chosen.merlin && !chosen.companion)) return null;"
    assert guard in transaction
    assert "feedWildEntryForSpeciesKey" not in transaction


def test_release_marker_moves_beyond_the_temporary_wild_feeder_build():
    source = HTML.read_text()
    sw = (HTML.parent / "sw.js").read_text()
    # BURBZ_BUILD tracks the NEWEST release marker and later releases move it
    # on, so pin only that this release stayed in the cache lineage and the
    # current build tag is a real marker in that lineage.
    assert "kitchen-no-duplicate-companions-v175-20260730-companion-feeding-only-v176-20260730" in sw
    build = source.split("const BURBZ_BUILD = '", 1)[1].split("';", 1)[0]
    assert build in sw
