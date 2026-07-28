"""Merlin tutorial v6 — the guided flow.

The redesigned tutorial teaches, in order and BEFORE any real-life questing:
the premise and Merlin himself (the player's new friend, who needs feeding
and care, with a falcon's accurate diet — primary vs secondary meals — and
the Kitchen teased for later), scanning real birds, the Birdex, and the
kingdom quest system. It ends with "you'll never be stuck for something to
do", an arrow and a red mark on the Quests tab. From there the flow is
hands-on: a seconds-long one-off errand for Merlin ("you can send me out for
this one") that returns a crafting-material tease, a guided Roost build at
the Academy paid for by Merlin's gift (instant, with an XP celebration), a
short tour of a few Academy buildings, and a real-world finale that teases
capturing/building villages and closes with "first, either send me out on
quests or get out and look for a bird".
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
CORE = ROOT / "academy_treehouse_core.js"
SW = ROOT / "sw.js"

VERSION = "merlin-guided-flow-v6-20260728"


def _extract_array(html: str, marker: str):
    start = html.index(marker)
    end = html.index("\n];", start) + 3
    return html[start:end]


def tutorial_data():
    html = HTML.read_text(encoding="utf-8")
    source = (
        _extract_array(html, "const MERLIN_TUTORIAL_CHAPTERS = [")
        + "\n"
        + _extract_array(html, "const MERLIN_TUTORIAL_STEPS = [")
        + "\nconsole.log(JSON.stringify({ chapters: MERLIN_TUTORIAL_CHAPTERS, steps: MERLIN_TUTORIAL_STEPS }));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def chapter_copy(chapter_id):
    return " ".join(
        (s["title"] + " " + s["text"]).lower()
        for s in tutorial_data()["steps"]
        if s["chapterId"] == chapter_id
    )


def test_v6_is_live():
    html = HTML.read_text(encoding="utf-8")
    assert f"const BURBZ_TUTORIAL_VERSION = '{VERSION}';" in html


def test_story_introduces_premise_merlin_care_and_diet():
    story = chapter_copy("story")
    # Premise first, then Merlin introduces himself as the player's new friend.
    assert "kingdom of burbz" in story
    assert "i am merlin" in story
    assert "your new friend" in story
    # He needs feeding and looking after to be at his best.
    assert "at my best" in story and "feed me and look after me" in story
    # As a falcon he names his own primary meal — the best meal for a falcon.
    assert "falcon" in story and "primary meal" in story
    assert "small-bird prey" in story
    # Secondary meals exist but are not ideal; diets must be accurate.
    assert "secondary meals" in story and "not ideal" in story
    assert "diet must be accurate" in story
    # The Kitchen is teased for later.
    assert "we will go into food later" in story and "kitchen" in story


def test_story_covers_scan_birdex_and_errands_but_not_walking_or_empire():
    data = tutorial_data()
    story_steps = [s for s in data["steps"] if s["chapterId"] == "story"]
    story = chapter_copy("story")
    # The pillars the player must know before any real-life quest appears.
    assert "scan" in story and "birdex" in story
    assert "errands" in story and "expeditions" in story
    # Real-life questing and the Empire tab are NOT introduced in the intro.
    assert "walking quest" not in story
    assert "explore quests" not in story
    assert "empire" not in story
    # The finale: never stuck for something to do + red mark + Quests tab.
    last = story_steps[-1]
    assert "never be stuck for something to do" in last["text"].lower()
    assert "red mark" in last["text"].lower()
    assert last["target"] == '.nav-item[data-screen="quests"]'
    assert last.get("alertNav") == "quests"


def test_guided_flow_chapters_exist_in_order():
    chapters = [c["id"] for c in tutorial_data()["chapters"]]
    for needed in ("story", "quests", "errand", "academy", "academy_tour", "explore"):
        assert needed in chapters, needed
    assert chapters.index("story") < chapters.index("quests") < chapters.index("errand")
    assert chapters.index("errand") < chapters.index("academy") < chapters.index("academy_tour")
    assert chapters.index("academy_tour") < chapters.index("explore")


def test_quests_chapter_sends_merlin_on_his_first_flight():
    quests = chapter_copy("quests")
    assert "player quests" in quests
    assert "send me out" in quests
    steps = [s for s in tutorial_data()["steps"] if s["chapterId"] == "quests"]
    assert steps[-1]["target"] == '[data-expedition-template="merlin_first_flight"]'


def test_tutorial_errand_is_seconds_long_and_pays_a_crafting_material():
    source = (
        "const core = require('./academy_treehouse_core.js');"
        "const t = core.getQuestTemplates().find(x => x.id === 'merlin_first_flight');"
        "const exp = core.createBirdExpedition({ id:'merlin-guide', commonName:'Merlin', power:80 }, 'merlin_first_flight', 1000000);"
        "console.log(JSON.stringify({ t, durationMs: exp.endMs - exp.startMs, items: exp.rewards.items }));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    data = json.loads(result.stdout)
    template = data["t"]
    assert template["starter"] is True and template["tutorial"] is True
    # Five seconds, so the player never waits.
    assert data["durationMs"] <= 10000
    # Every possible reward is a crafting material for the Forge tease.
    assert set(template["items"]) <= {"oak_twig", "river_reed", "iron_grit", "down_tuft"}
    assert data["items"]


def test_tutorial_errand_is_one_off_merlin_only_and_wired_into_the_board():
    html = HTML.read_text(encoding="utf-8")
    # Rendered as its own card above the drawers, hidden once claimed.
    assert 'data-expedition-template="merlin_first_flight"' in html
    assert "tutorialFlowState().errandClaimed" in html
    # Only Merlin may fly it, and only once.
    assert "This first flight is Merlin's own" in html
    assert "Merlin has already flown his first flight." in html
    # Claiming retires it durably and triggers Merlin's return speech.
    assert "if (q.templateId === 'merlin_first_flight') tutorialFlowState().errandClaimed = true;" in html
    assert "startMerlinTutorial({ chapterId:'errand', resume:false })" in html
    # Seconds-long errands redraw the board the moment the bird lands.
    assert "if (msLeft < 60000) setTimeout(() => {" in html


def test_errand_return_teases_crafting_gear():
    errand = chapter_copy("errand")
    assert "come in handy later" in errand
    assert "crafting gear" in errand
    assert "academy" in errand


def test_academy_chapter_gifts_the_roost_and_builds_instantly():
    academy = chapter_copy("academy")
    assert "50 coins" in academy and "10 timber" in academy
    assert "instantly this time round" in academy
    html = HTML.read_text(encoding="utf-8")
    # The gift is granted once, at the start of the Academy lesson.
    assert "function maybeGrantMerlinRoostGift()" in html
    assert "if (merlinTutMode === 'academy') maybeGrantMerlinRoostGift();" in html
    # The first Roost pays XP with a proper celebration, then the tour fires.
    assert "function onFirstRoostBuilt()" in html
    assert "addPlayerXp(60);" in html
    assert "THE ROOST IS BUILT!" in html
    assert "startMerlinTutorial({ chapterId:'academy_tour', resume:true })" in html
    # The build cards are addressable for the spotlight.
    assert 'data-building="' in html


def test_academy_tour_highlights_a_few_buildings_and_defers_to_player_quests():
    tour = chapter_copy("academy_tour")
    for term in ("barracks", "kitchen", "hospital", "crowbar", "player quests"):
        assert term in tour, term
    # A few buildings, not all ten.
    steps = [s for s in tutorial_data()["steps"] if s["chapterId"] == "academy_tour"]
    assert len(steps) <= 7


def test_explore_finale_teases_villages_and_hands_over_to_gameplay():
    explore = chapter_copy("explore")
    assert "walking quests" in explore
    assert "villages" in explore and "get to that later" in explore
    assert "send me out on quests or get out and look for a bird" in explore
    # Stuck players are pointed back at the Quests section.
    assert "stuck" in explore and "quests" in explore


def test_guided_flow_pointer_and_red_mark_are_wired():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="tutorialNavPointer"' in html
    assert "function updateMerlinFlowPointer()" in html
    assert "function merlinFlowPointerTarget()" in html
    assert "tutorial-alert" in html
    assert ".nav-item.tutorial-alert::after" in html
    # Screen switches, claims and builds all refresh the pointer.
    assert html.count("updateMerlinFlowPointer()") >= 4


def test_progress_handoffs_survive_reloads():
    html = HTML.read_text(encoding="utf-8")
    # Merlin's return speech re-fires on the quests screen after a reload.
    assert "tutorialFlowState().errandClaimed && !seen.includes('errand')" in html
    # A standing Roost skips the build lesson and runs the tour instead.
    assert "if (screenName === 'academy' && isAcademyBuildingBuilt('dorm'))" in html
    # The finale fires on the Map once the tour is done.
    assert "seen.includes('academy_tour') && !seen.includes('explore')" in html


def test_player_quest_chain_matches_the_guided_flow():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("const PLAYER_QUESTS = [")
    end = html.index("\n];", start) + 3
    source = html[start:end] + "\nconsole.log(JSON.stringify(PLAYER_QUESTS.map(q => q.id)));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    ids = json.loads(result.stdout)
    assert ids[:4] == ["pq_expedition", "pq_claim_errand", "pq_build_roost", "pq_first_bird"]


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "merlin-guided-tutorial-v147-20260728" in sw
