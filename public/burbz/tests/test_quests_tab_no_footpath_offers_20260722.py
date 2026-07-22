"""The Quests tab no longer lists nearby Footpath offers.

The 'Nearby Quests' section raced the map's location fix: on first open the
tab showed nothing, then the footpath list popped in after leaving and
returning. Footpath offers now live only on the map's Explore Quests board;
the Quests tab keeps the player's active adventure and completed history.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    end = HTML.find("\nfunction ", start + 10)
    assert end > start
    return HTML[start:end]


def test_quest_tab_walking_section_has_no_nearby_footpath_list():
    section = function_source("renderWalkingQuestSection")
    assert "Nearby Quests" not in section
    assert "walkingQuestNearbyList" not in section
    # active adventure and history survive the removal
    assert "Active Adventure" in section
    assert "Completed Adventures" in section


def test_nearby_offer_renderer_is_gone_from_the_quest_tab_entirely():
    assert "renderQuestScreenNearbyOffers" not in HTML
    assert "walkingQuestNearbyList" not in HTML


def test_footpath_offers_still_ship_on_the_map_explore_board():
    assert 'id="mapQuestBtn"' in HTML
    assert "function discoverNearbyQuestOffers(" in HTML
    assert "renderQuestOfferCards(" in HTML


def test_change_ships_with_a_fresh_offline_cache_version():
    assert "burbz-bird-levelling-v104-20260722" in SW
