"""Birdex is the field guide; feeding controls belong only to Companions."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def function_source(html: str, name: str, next_name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.index(f"\nfunction {next_name}(", start)
    return html[start:end]


def test_owned_bird_cards_render_feed_controls_only_in_companions_mode():
    html = HTML.read_text(encoding="utf-8")
    source = function_source(html, "createBirdCardHTML", "createKnownSpeciesCardHTML")
    assert "const showCareActions = currentBurbzMode === 'companions';" in source
    assert "const frontFeedButton = showCareActions" in source
    assert "const backFeedButton = showCareActions" in source
    assert "${frontFeedButton}" in source
    assert "${backFeedButton}" in source


def test_discovered_only_birdex_cards_have_no_feeder_button():
    html = HTML.read_text(encoding="utf-8")
    source = function_source(html, "createKnownSpeciesCardHTML", "createLockedBirdexCardHTML")
    assert 'data-action="feed-bird"' not in source
    assert "Feed at the feeder" not in source
    assert 'data-action="goto-tavern"' in source


def test_birdex_feed_removal_remains_in_the_service_worker_cache_history():
    marker = "birdex-no-feed-v164-20260729"
    sw = SW.read_text(encoding="utf-8")
    assert marker in sw
