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
    assert "./quest_core.js?v=premium-quest-board-v4-20260714" in sw


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
    assert "burbz-premium-quest-board-v68-20260714" in sw
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
