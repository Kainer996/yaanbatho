"""Regression for the Player Quest 'Take a real walk' Go button."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def html() -> str:
    return (ROOT / "index.html").read_text(encoding="utf-8")


def player_quest_go_body(source: str) -> str:
    start = source.index("function playerQuestGo(q) {")
    end = source.index("\n}\n\nfunction claimPlayerQuest", start)
    return source[start:end]


def test_real_walk_go_opens_the_live_map_not_the_quest_board():
    body = player_quest_go_body(html())
    assert "q.id === 'pq_walk_adventure'" in body
    assert "showAllLocalQuests()" in body
    assert "switchScreen('quests')" not in body
    assert "openQuestBoard()" not in body


def test_real_walk_go_reopens_an_active_walk_sheet():
    body = player_quest_go_body(html())
    assert "activeWalkingQuest()" in body
    assert "switchScreen('map')" in body
    assert "openActiveWalkQuestSheet()" in body


def test_real_walk_go_does_not_use_the_same_screen_scroll_fallback():
    body = player_quest_go_body(html())
    special = body[body.index("q.id === 'pq_walk_adventure'"):]
    assert "return;" in special
    assert special.index("return;") < special.index("scrollIntoView")


def test_release_marker_is_pinned_for_mobile_pwa_refresh():
    marker = "living-canopy-v236-20260806"
    # The marker is kept for ever by the append-only BURBZ_CACHE lineage, which
    # is what actually refreshes an installed PWA. It is no longer in
    # index.html: it was only ever there as the alive core's `?v=` pin, and
    # magpie-market-v314 re-pinned that core.
    assert marker in (ROOT / "sw.js").read_text(encoding="utf-8")
    assert "academy_alive_core.js?v=magpie-market-v314-20260824" in html()
