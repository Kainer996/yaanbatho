"""Regression: Kitchen Feed must open the food sheet without leaving the room."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def function_source(html: str, name: str, next_name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.index(f"\nfunction {next_name}(", start)
    return html[start:end]


def test_kitchen_roster_feed_is_a_non_navigating_button_that_opens_the_feed_sheet():
    html = HTML.read_text(encoding="utf-8")
    row = function_source(html, "kitchenRosterRowHTML", "kitchenRosterEntriesForFeeding")
    assert 'type="button"' in row
    assert "event.preventDefault();event.stopPropagation();openFeedSheet(" in row
    assert "kitchenRosterToggleTray(" not in row


def test_open_feed_sheet_can_consume_the_originating_click_without_changing_screen():
    html = HTML.read_text(encoding="utf-8")
    source = function_source(html, "openFeedSheet", "closeFeedSheet")
    assert "function openFeedSheet(key, event)" in source
    assert "event.preventDefault()" in source
    assert "event.stopPropagation()" in source
    assert "switchScreen(" not in source
    assert "renderAcademyRoomInterior(" not in source


def test_kitchen_feed_navigation_fix_remains_in_the_service_worker_cache_history():
    marker = "kitchen-feed-sheet-v158-20260729"
    assert marker in SW.read_text(encoding="utf-8")
