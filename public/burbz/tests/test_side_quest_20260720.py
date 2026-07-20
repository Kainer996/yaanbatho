"""Side Quest: free exploration replaces Chart-My-Own-Adventure.

Start it and just go — the game charts wherever the player walks, buzzes and
chirps from the pocket (screen off) when they stumble across a chest, weapon
or quest-giver bird, reveals discoveries on the map, and offers to turn the
wander into a real quest for others at the end.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def test_chart_my_own_adventure_is_gone():
    assert "Chart My Own Adventure" not in HTML
    assert "Chart your own route" not in HTML
    assert "startAdventureWalkQuest" not in HTML


def test_quest_board_offers_a_side_quest_instead():
    assert "Side Quest — just explore" in HTML
    assert "charts wherever you go" in HTML
    assert "openSideQuestIntroSheet" in HTML


def test_intro_promises_pocket_mode_discoveries_and_future_sharing():
    start = HTML.index("function openSideQuestIntroSheet()")
    intro = HTML[start:HTML.index("\nfunction startSideQuest", start)]
    assert "No markers, no route" in intro
    assert "Pocket the phone" in intro and "screen off" in intro
    assert "buzzes and chirps" in intro
    assert "treasure chest" in intro and "weapon" in intro and "quest-giver bird" in intro
    # The promise is made AT THE START, as requested.
    assert "At the end" in intro and "turn your wander into a real quest for other players" in intro


def test_position_stream_charts_the_trail_and_rolls_discoveries():
    assert "sideQuestOnPositionFix(lat, lon, accuracy)" in HTML
    start = HTML.index("function sideQuestOnPositionFix(")
    body = HTML[start:HTML.index("\nfunction spawnSideQuestDiscovery", start)]
    assert "active.path.push" in body
    assert "spawnSideQuestDiscovery" in body
    # GPS teleports don't count as wandering distance.
    assert "step < 400" in body
    spawn = HTML[HTML.index("function spawnSideQuestDiscovery("):HTML.index("\n// --- Map drawing")]
    for kind in ("'chest'", "'weapon'", "'questgiver'"):
        assert kind in spawn
    assert "sideQuestPocketAlert()" in spawn


def test_pocket_mode_keeps_working_with_the_screen_off():
    start = HTML.index("// --- Pocket mode")
    body = HTML[start:HTML.index("function openSideQuestIntroSheet")]
    # Looped media session keeps the page alive when the screen is dark...
    assert "loop = true" in body
    assert "mediaSession" in body
    # ...and the alert is buzz + audible chirp.
    assert "vibrate(QUEST_BUZZ.discovery)" in body
    assert "sideQuestChimeEl" in body
    assert "QUEST_BUZZ" in HTML and "discovery: [120, 70, 120, 70, 500]" in HTML
    # Wake lock stays as the on-screen fallback.
    assert "acquireQuestWakeLock()" in body


def test_ending_offers_to_turn_the_wander_into_a_quest_for_others():
    end = HTML[HTML.index("function endSideQuest()"):HTML.index("function shareSideQuestDraft")]
    assert "TURN INTO A QUEST FOR OTHERS" in end
    assert "sideQuestClaimDiscovery" in end        # nothing found is ever lost
    share = HTML[HTML.index("function shareSideQuestDraft"):HTML.index("function resumeSideQuestIfAny")]
    assert "sharedDraft = true" in share
    assert "coming soon" in share


def test_side_quest_is_wired_into_state_map_and_hud():
    assert "sideQuest: { active: null, history: [] }" in HTML
    assert "burbz-side-quest-trail" in HTML
    assert "resumeSideQuestIfAny();" in HTML
    assert "sideQuestActive()) { openSideQuestLogSheet(); return; }" in HTML
    # One outdoor quest at a time, in both directions.
    assert "End your Side Quest first" in HTML
    assert "Finish or abandon your current quest first'); return; }\n  if (sideQuestActive())" in HTML
