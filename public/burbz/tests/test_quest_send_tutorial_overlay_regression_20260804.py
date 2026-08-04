"""Regressions for the mobile quest-send sheet's inert controls.

The Quests tutorial starts on a 480 ms timer. A player can open a quest before
that timer fires; the tutorial must defer instead of placing its modal overlay
above the already-open sheet. Duration is an inline action and must also be
exported to ``window`` like the other quest handlers.
"""
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}")
    brace = html.index("{", start)
    depth = 0
    for pos in range(brace, len(html)):
        if html[pos] == "{":
            depth += 1
        elif html[pos] == "}":
            depth -= 1
            if depth == 0:
                return html[start : pos + 1]
    raise AssertionError(f"unterminated function {name}")


def test_quests_tutorial_defers_while_a_quest_sheet_is_open():
    html = HTML.read_text(encoding="utf-8")
    source = function_source(html, "maybeStartMerlinChapterForScreen")
    assert "questOverlay" in source
    assert "classList.contains('open')" in source
    assert "screenName === 'quests'" in source
    assert source.index("classList.contains('open')") < source.index("startMerlinTutorial")


def test_closing_the_sheet_retries_the_deferred_quests_tutorial():
    html = HTML.read_text(encoding="utf-8")
    source = function_source(html, "closeQuestOverlay")
    assert "maybeStartMerlinChapterForScreen('quests')" in source
    assert source.index("classList.remove('open')") < source.index("maybeStartMerlinChapterForScreen('quests')")


def test_quest_sheet_does_not_hide_or_disable_merlins_reading_steps():
    html = HTML.read_text(encoding="utf-8")
    assert "quest-sheet-suspended" not in html
    assert "setQuestTutorialSuspended" not in html


def test_dynamic_quest_controls_are_explicit_non_submit_buttons():
    html = HTML.read_text(encoding="utf-8")
    sheet = function_source(html, "renderQuestSendSheet")
    for marker in (
        'type="button" class="quest-duration-choice',
        'type="button" class="quest-bird-chip',
        'type="button" class="quest-send-btn',
    ):
        assert marker in sheet


def test_duration_handler_is_exported_and_runtime_hardened_like_every_other_inline_action():
    html = HTML.read_text(encoding="utf-8")
    export = html[html.index("Object.assign(window, { academyBuildBuilding"):]
    export = export[:export.index("\n\n", 1)]
    assert "selectQuestDuration" in export

    hardened = html[html.index("['openQuestSend', 'openQuestLog'"):]
    hardened = hardened[:hardened.index("].forEach")]
    assert "'selectQuestDuration'" in hardened
