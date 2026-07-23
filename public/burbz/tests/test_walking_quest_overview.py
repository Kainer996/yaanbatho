import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "quest_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def run_core(expression):
    source = "global.window=global; require('./quest_core.js'); const q=global.BurbzQuestCore; console.log(JSON.stringify(" + expression + "));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_nearby_natural_loop_keeps_the_full_loop_when_rotated_to_player():
    points = [
        {"lat": 53.0000, "lon": -2.0000},
        {"lat": 53.0000, "lon": -1.9900},
        {"lat": 53.0100, "lon": -1.9900},
        {"lat": 53.0100, "lon": -2.0000},
        {"lat": 53.0000, "lon": -2.0000},
    ]
    expr = "(() => { const pts=" + json.dumps(points) + "; const original=q.routeLengthM(pts); const out=q.normaliseTrailForPlayer(pts,53.0100,-1.9900,6000); return {out,original,length:q.routeLengthM(out),style:q.offerLoopStyle(out)}; })()"
    result = run_core(expr)
    assert result["style"] == "loop"
    assert result["length"] >= result["original"] * 0.95
    assert len(result["out"]) >= 5
    assert abs(result["out"][0]["lat"] - 53.0100) < 0.0001
    assert abs(result["out"][0]["lon"] + 1.9900) < 0.0001
    assert result["out"][0] == result["out"][-1]


def test_nearby_quest_routes_use_distinct_palette_and_dark_casing():
    html = HTML.read_text(encoding="utf-8")
    assert "const QUEST_OVERVIEW_COLORS =" in html
    assert "color: questOverviewColor(i)" in html
    assert "offset: questOverviewOffset(i)" not in html
    assert "'line-color':['get','color']" in html
    assert "'line-offset'" not in html
    assert "--quest-route-color" in html
    assert "quest trails revealed in green" not in html


def test_quest_route_clarity_release_is_cached_offline():
    sw = SW.read_text(encoding="utf-8")
    assert "./quest_core.js?v=quest-path-alignment-r3-20260723" in sw


def test_nearby_quests_are_sorted_by_distance_to_their_start():
    offers = [
        {"name": "Far trail", "kind": "trail", "startDistM": 900},
        {"name": "Nearest path", "kind": "path", "startDistM": 80},
        {"name": "Middle footpath", "kind": "footpath", "startDistM": 320},
    ]
    result = run_core("q.sortOffersByStartDistance(" + json.dumps(offers) + ").map(o => o.name)")
    assert result == ["Nearest path", "Middle footpath", "Far trail"]


def test_missing_start_distance_never_outranks_a_real_nearby_trail():
    offers = [
        {"name": "Unknown start", "kind": "trail", "startDistM": None},
        {"name": "Known start", "kind": "path", "startDistM": 140},
    ]
    result = run_core("q.sortOffersByStartDistance(" + json.dumps(offers) + ").map(o => o.name)")
    assert result == ["Known start", "Unknown start"]


def test_quest_chain_links_endpoints_to_nearby_next_starts_only():
    offers = [
        {"name": "One", "points": [{"lat": 53, "lon": -2}, {"lat": 53.001, "lon": -2}]},
        {"name": "Two", "points": [{"lat": 53.0012, "lon": -2}, {"lat": 53.003, "lon": -2}]},
        {"name": "Far", "points": [{"lat": 53.02, "lon": -2}, {"lat": 53.03, "lon": -2}]},
    ]
    result = run_core("q.questChainTargetIndices(" + json.dumps(offers) + ", 80)")
    assert result == [1, None, None]


def test_area_birds_has_a_persistent_accessible_toggle():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="mapAreaBirdsToggle"' in html
    assert 'aria-controls="mapAreaBirdsList"' in html
    assert 'aria-expanded="true"' in html
    assert "BURBZ_AREA_BIRDS_OPEN_KEY" in html
    assert "setAreaBirdsOpen" in html
    assert ".map-area-birds-panel.collapsed" in html


def test_map_has_one_premium_quest_control_not_two_competing_buttons():
    html = HTML.read_text(encoding="utf-8")
    assert html.count('id="mapQuestBtn"') == 1
    assert 'id="mapQuestOverviewBtn"' not in html
    assert 'assets/ui/quest-compass-emblem.webp' in html
    assert 'id="mapQuestBtnLabel">Explore Quests<' in html
    assert "openQuestBoard" in html


def test_quest_board_prioritises_start_distance_and_focuses_a_selection_on_the_map():
    html = HTML.read_text(encoding="utf-8")
    assert 'class="wqo-distance"' in html
    assert "STARTS " in html
    assert "sortOffersByStartDistance" in html
    assert "function focusQuestOnMap" in html
    assert "liveMap.fitBounds" in html
    assert "questOfferDisplayPoints" in html
    assert 'id="mapQuestFocusCard"' in html
    assert 'id="mapQuestFocusBrief"' in html
    assert "questOverview.selectedIndex" in html
    assert "quest-chain-link" in html


def test_premium_quest_asset_and_release_are_cached_offline():
    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_CACHE = 'burbz-" in sw
    assert "./assets/ui/quest-compass-emblem.webp" in sw


def test_stale_nearby_quest_requests_cannot_replace_newer_location_results():
    html = HTML.read_text(encoding="utf-8")
    assert "questOfferRequestSeq" in html
    assert "const requestId = ++questOfferRequestSeq" in html
    assert "requestId !== questOfferRequestSeq" in html
    assert "return discoverNearbyQuestOffers(true)" in html


def test_map_quest_focus_moves_keyboard_focus_and_restores_it_on_close():
    html = HTML.read_text(encoding="utf-8")
    assert "focusQuestMapPrimaryAction" in html
    assert "mapQuestFocusBegin.focus" in html
    assert "restoreQuestMapFocus" in html
    assert "mapQuestBtn.focus" in html


def test_map_quest_focus_card_clears_fixed_navigation_and_keeps_attribution_above_it():
    html = HTML.read_text(encoding="utf-8")
    card_css = html.split(".map-quest-focus-card {", 1)[1].split("}", 1)[0]
    attribution_css = html.split(".live-map-shell.quest-focused .maplibregl-ctrl-bottom-right {", 1)[1].split("}", 1)[0]
    assert "var(--quest-focus-lift" in card_css
    assert "var(--safe-bottom)" in card_css
    assert "var(--quest-focus-attribution-bottom" in attribution_css
    assert "function syncQuestMapFocusLayout" in html
    layout = html.split("function syncQuestMapFocusLayout", 1)[1].split("function closeQuestMapFocus", 1)[0]
    assert "document.querySelector('.bottom-nav')" in layout
    assert "--quest-focus-card-height" in layout
    assert "--quest-focus-lift" in layout
    assert "const BURBZ_CACHE = 'burbz-" in SW.read_text(encoding="utf-8")


def test_show_quests_button_sits_below_the_field_board_as_a_separate_map_action():
    html = HTML.read_text(encoding="utf-8")
    assert html.count('id="mapQuestShowBtn"') == 1
    assert 'class="map-quest-show-btn"' in html
    assert 'aria-pressed="false"' in html
    assert '>Show Quests<' in html
    assert html.index('id="mapQuestBtn"') < html.index('id="mapQuestShowBtn"')
    show_button_css = html.split(".map-quest-show-btn {", 1)[1].split("}", 1)[0]
    assert "height:44px" in show_button_css


def test_show_quests_reveals_and_frames_every_local_offer():
    html = HTML.read_text(encoding="utf-8")
    assert "function showAllLocalQuests()" in html
    assert "discoverNearbyQuestOffers()" in html
    assert "function fitAllLocalQuestRoutes" in html
    assert "liveMap.fitBounds" in html
    assert "showBtn.addEventListener('click', showAllLocalQuests)" in html
    assert "updateShowQuestsButton" in html


def test_overview_markers_are_distance_labelled_circles_that_open_the_full_brief():
    html = HTML.read_text(encoding="utf-8")
    assert "function questMarkerDistanceText" in html
    assert 'class="wq-offer-distance"' in html
    assert 'class="wq-offer-badge"' in html
    assert "questMarkerDistanceText(o)" in html
    assert "focusQuestOnMap(i)" in html


def test_distance_markers_use_inner_visual_offsets_without_moving_maplibre_anchors():
    html = HTML.read_text(encoding="utf-8")
    assert "function questPinDisplayOffset" in html
    assert 'class="wq-offer-stack"' in html
    assert "--quest-pin-x" in html
    assert "--quest-pin-y" in html
    assert ".wq-offer-stack { transform:translate" in html


def test_show_quests_release_is_query_busted_and_cached_offline():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    marker = "quest_core.js?v=quest-path-alignment-r3-20260723"
    assert marker in html
    assert "./" + marker in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
