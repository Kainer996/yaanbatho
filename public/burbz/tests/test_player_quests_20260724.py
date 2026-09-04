"""Player Quests: the guided chain that starts where the tutorial ends.

Classic mobile-game progression — one clear goal at a time, pinned to the
top of the Quests tab, so a new player never wonders what to do next.

The chain opens on the game's biggest promise (free-your-first-village-v327):
open the Empire map, take the nearest village back from the darkness with
Merlin, then go outside and find a real bird. Merlin's errands, the Barracks,
recruiting, feeding and battling follow. Player quests are the PLAYER'S goals —
different from bird expeditions and daily/weekly boards.
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
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8", capture_output=True
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_chain_mirrors_the_guided_tutorial_flow():
    quests = player_quests()
    ids = [q["id"] for q in quests]
    assert len(ids) == len(set(ids))
    # Straight out of the tutorial: the Empire map, the first liberation, the
    # first real bird — then Merlin's errands and the Barracks.
    assert ids[:6] == [
        "pq_open_empire", "pq_liberate", "pq_first_bird",
        "pq_expedition", "pq_claim_errand", "pq_build_barracks",
    ]
    assert quests[0]["type"] == "empire_opened"
    assert quests[1]["type"] == "town_liberated"
    assert quests[2]["type"] == "discover"
    assert quests[2]["name"] == "Find your first bird"
    assert quests[3]["type"] == "expedition_sent"
    assert quests[4]["type"] == "expedition_claimed"
    assert quests[5]["type"] == "build_tavern"
    # Every link is a complete, navigable goal.
    for q in quests:
        assert q["name"] and q["desc"] and q["icon"] and q["go"], q["id"]
        assert isinstance(q["target"], int) and q["target"] >= 1
        assert isinstance(q["reward"], int) and q["reward"] > 0
        assert len(q["desc"]) <= 60, q["id"]


def test_chain_covers_the_whole_core_loop():
    quests = player_quests()
    # remove-merlin-first-clue-v242 (live line) retired pq_merlin_clue;
    # village-chain-v307 added six village links to the late chain,
    # magpie-market-v316 added the build-and-trade pair, v346 moved it early
    # and added the complete-village / manager-office pair, and
    # free-your-first-village-v327 opened the chain with the Empire map.
    assert len(quests) == 37
    types = [q["type"] for q in quests]
    for needed in (
        # The original loop…
        "discover", "build_tavern", "recruit",
        "expedition_sent", "meal_served", "win", "town_liberated",
        # …plus the mechanics the extended chain teaches, one by one.
        "expedition_claimed", "feed_correct", "build_training",
        "training_claimed", "build_quest_roost", "gear_equipped",
        "build_kitchen", "proper_meal_fed", "build_hospital", "station_hospital",
        "walk_completed", "bird_quiz_correct", "gear_crafted",
        "build_crowbar", "build_workshop", "build_magpie_market",
        "village_completed", "build_manager_office",
        # …and the village arc, once a settlement is yours to run.
        "village_built", "village_provisioned", "village_role_filled",
        "tribute_collected", "merge_star", "town_founded",
    ):
        assert needed in types, needed


def test_extended_chain_paces_buildings_with_their_unlock_levels():
    # Rooms unlock by player level (Training L2 … Workshop L5), so the build
    # quests must appear in unlock order and never before the early loop.
    quests = player_quests()
    ids = [q["id"] for q in quests]
    order = [
        "pq_build_barracks", "pq_build_training",
        "pq_build_quest_roost", "pq_build_market", "pq_build_kitchen",
        "pq_build_hospital", "pq_build_manager_office", "pq_build_crowbar",
        "pq_build_workshop",
    ]
    positions = [ids.index(i) for i in order]
    assert positions == sorted(positions), positions
    # The chain ends on the empire endgame: three villages freed, then merged.
    assert ids[-3:] == ["pq_liberate_3", "pq_merge_star", "pq_found_town"]


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
        "updateQuestProgress('discover', 1)",           # scan discovery
        "updateQuestProgress('build_' + id, 1)",        # academy builds
        "updateQuestProgress('recruit', 1)",            # barracks recruitment
        "updateQuestProgress('expedition_sent', 1)",    # bird departs on errand
        "updateQuestProgress('expedition_claimed', 1)", # errand rewards claimed
        "updateQuestProgress('training_claimed', 1)",   # training drill claimed
        "updateQuestProgress('gear_equipped', 1)",      # forge equips a piece
        "updateQuestProgress('station_' + room, 1)",    # bird stationed in a room
        "updateQuestProgress('walk_completed', 1)",     # walking adventure done
        "updateQuestProgress('meal_served', 1)",        # kitchen tray served
        "updateQuestProgress('town_liberated', 1)",     # liberation victory
    ):
        assert hook in html, hook
    # The Quests nav badge counts claimable player quests too.
    # gentle-start-v338: boards the gate still holds closed stay out of
    # the badge count, so the dot never lights for a card the player
    # cannot see. The chain itself always counts.
    assert "...PLAYER_QUESTS,\n      ...(featureGateOpen('quests_daily') ? DAILY_QUESTS : [])" in html


def test_tutorial_introduces_player_quests():
    html = HTML.read_text(encoding="utf-8")
    assert "title:'Player Quests'" in html
    assert "target:'#playerQuestsList'" in html
    assert "next little adventure" in html


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-side-snacks-hunger-metre-v142-20260726" in sw
    assert "player-quest-chain-v146-20260728" in sw
