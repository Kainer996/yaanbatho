"""Player Quests: the guided chain that starts where the tutorial ends.

Classic mobile-game progression — one clear goal at a time, pinned to the
top of the Quests tab, so a new player never wonders what to do next. The
chain opens with "Find your first bird", then unlocks The Roost and the
Barracks, and walks on through recruiting, questing, feeding, battling and
liberation. Player quests are the PLAYER'S goals — different from bird
expeditions and daily/weekly boards.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def player_quests():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("const PLAYER_QUESTS = [")
    end = html.index("\n];", start) + 3
    source = html[start:end] + "\nconsole.log(JSON.stringify(PLAYER_QUESTS));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_chain_starts_with_first_bird_then_roost_then_barracks():
    quests = player_quests()
    ids = [q["id"] for q in quests]
    assert len(ids) == len(set(ids))
    # The exact opening the player asked for: find a bird, then the two
    # first buildings, then the rest of the loop bit by bit.
    assert ids[:4] == ["pq_first_bird", "pq_build_roost", "pq_build_barracks", "pq_recruit"]
    assert quests[0]["name"] == "Find your first bird"
    assert quests[0]["type"] == "discover"
    # Every link is a complete, navigable goal.
    for q in quests:
        assert q["name"] and q["desc"] and q["icon"] and q["go"], q["id"]
        assert isinstance(q["target"], int) and q["target"] >= 1
        assert isinstance(q["reward"], int) and q["reward"] > 0
        assert len(q["desc"]) <= 60, q["id"]


def test_chain_covers_the_whole_core_loop():
    quests = player_quests()
    types = [q["type"] for q in quests]
    for needed in (
        "discover", "build_dorm", "build_tavern", "recruit",
        "expedition_sent", "meal_served", "win", "town_liberated",
    ):
        assert needed in types, needed


def test_player_quests_are_pinned_to_the_top_of_the_quests_tab():
    html = HTML.read_text(encoding="utf-8")
    screen = html[html.index('id="screen-quests"'):html.index('id="screen-profile"')]
    # The Player Quests container renders above walking quests and expeditions.
    assert screen.index('id="playerQuestsList"') < screen.index('id="walkingQuestsList"')
    assert screen.index('id="walkingQuestsList"') < screen.index('id="expeditionQuestList"')
    assert "renderPlayerQuests();" in html
    assert '<div class="quest-section-title">Player Quests' in html


def test_only_the_active_link_moves_and_claims_pay_out():
    html = HTML.read_text(encoding="utf-8")
    # Strict chain gating: progress and badges only for the active quest.
    assert "function activePlayerQuest()" in html
    assert "function syncActivePlayerQuest()" in html
    assert "Player quests: only the active link in the chain moves." in html
    # Goals already met by real state complete when their turn comes.
    assert "Math.max(state.progress || 0, q.measure())" in html
    # Claiming pays XP plus coins/branches and arms the next link.
    assert "function claimPlayerQuest(id)" in html
    assert "if (q.coins) addCoins(q.coins);" in html
    assert "if (q.branches) addBranches(q.branches);" in html
    assert "Next player quest: " in html
    # Completion is announced wherever it happens.
    assert "Player quest complete: " in html


def test_gameplay_hooks_feed_the_chain():
    html = HTML.read_text(encoding="utf-8")
    for hook in (
        "updateQuestProgress('discover', 1)",         # scan discovery
        "updateQuestProgress('build_' + id, 1)",      # roost + barracks builds
        "updateQuestProgress('recruit', 1)",          # barracks recruitment
        "updateQuestProgress('expedition_sent', 1)",  # bird departs on errand
        "updateQuestProgress('meal_served', 1)",      # kitchen tray served
        "updateQuestProgress('town_liberated', 1)",   # liberation victory
    ):
        assert hook in html, hook
    # The Quests nav badge counts claimable player quests too.
    assert "questDefinitions: [...PLAYER_QUESTS, ...DAILY_QUESTS" in html


def test_tutorial_introduces_player_quests():
    html = HTML.read_text(encoding="utf-8")
    assert "title:'Player Quests'" in html
    assert "target:'#playerQuestsList'" in html
    assert "never wonder what to do next" in html


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-merlin-animated-rig-v119-20260725" in sw
