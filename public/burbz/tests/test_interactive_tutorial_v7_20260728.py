"""Merlin tutorial v7 — the hands-on apprenticeship.

Twelve slides in a row is not a tutorial, it is a wall of text. v7 caps Merlin
at three beats of dialogue before the player must DO the thing he just
described: tap him on his branch, feed him a real prey ration, send him on his
first errand, raise The Roost. The mechanic is learned by using it.

Two interaction modes back this. SPOTLIGHT dims the screen, cuts one tappable
hole with four shields and lifts the real control out of the dim, for a single
precise tap. FREE drops the dim entirely for multi-tap jobs (build a roost,
send a quest) and shrinks Merlin to a task chip. Every armed step also has a
rescue: if the control never appears, the Next button comes back rather than
trapping the player.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "merlin-interactive-flow-v7-20260728"


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


def steps_of(chapter_id):
    return [s for s in tutorial_data()["steps"] if s["chapterId"] == chapter_id]


def chapter_copy(chapter_id):
    return " ".join((s["title"] + " " + s["text"]).lower() for s in steps_of(chapter_id))


def test_v7_is_live():
    assert f"const BURBZ_TUTORIAL_VERSION = '{VERSION}';" in HTML.read_text(encoding="utf-8")


def test_merlin_never_talks_for_more_than_three_beats():
    """The headline rule: at most three dialogue steps before the player acts."""
    data = tutorial_data()
    steps = data["steps"]
    # Chapters that hand the player a job must never stack four reads in a row.
    for chapter in ("story", "quests", "errand", "academy", "academy_tour"):
        run = 0
        for step in [s for s in steps if s["chapterId"] == chapter]:
            run = 0 if step.get("action") else run + 1
            assert run <= 3, (chapter, step["title"], run)
    # Reference chapters (opened on demand, nothing to do yet) stay short too.
    for chapter in ("explore", "scan", "birdex", "battle", "village", "forge"):
        assert len([s for s in steps if s["chapterId"] == chapter]) <= 3, chapter


def test_the_guided_flow_is_mostly_doing_not_reading():
    steps = tutorial_data()["steps"]
    actions = [s for s in steps if s.get("action")]
    # Seven things the player performs with their own hands.
    assert len(actions) >= 7, len(actions)
    events = [s["action"]["event"] for s in actions]
    for needed in (
        "merlin-care-opened",   # tap Merlin on his branch
        "merlin-fed",           # feed him a real ration
        "tab:quests",           # walk to the quest board
        "expedition-sent",      # send him on his first errand
        "tab:academy",          # walk to the Academy
        "roost-built",          # raise a building
        "tab:map",              # out to the real world
    ):
        assert needed in events, needed
    # Every action tells the player exactly what to do, and what to tap.
    for step in actions:
        assert step["action"].get("hint"), step["title"]
        assert step["action"].get("mode") in (None, "free"), step["title"]
        if step["action"].get("mode") != "free":
            assert step.get("target"), step["title"]


def test_feeding_is_taught_by_feeding_him():
    """The lesson the player asked for: tap Merlin, see his food, feed him."""
    story = steps_of("story")
    by_event = {s["action"]["event"]: s for s in story if s.get("action")}
    # 1. Merlin says he needs looking after…
    assert "feeding and looking after" in chapter_copy("story")
    # 2. …then the player taps him and his care menu opens.
    tap = by_event["merlin-care-opened"]
    assert tap["target"] == "#petSprite"
    assert tap["action"]["lift"] == "#merlinPerchAssembly"
    # 3. His needs and his real diet are read off the open menu.
    order = [s["title"] for s in story]
    needs = next(s for s in story if s["target"] == ".merlin-care-status")
    diet = next(s for s in story if s["target"] == "#merlinDietGuidance")
    assert "hungry" in needs["text"].lower()
    assert "primary meal" in diet["text"].lower() and "small-bird prey" in diet["text"].lower()
    assert "secondary meal" in diet["text"].lower() and "not ideal" in diet["text"].lower()
    # 4. The player presses Feed themselves.
    feed = by_event["merlin-fed"]
    assert feed["target"] == "#merlinFeedBtn"
    assert feed["action"]["lift"] == "#merlinCareMenu"
    # 5. Merlin closes the lesson on accurate diets and teases the Kitchen.
    after = story[order.index(feed["title"]) + 1]
    assert "diet must be accurate" in after["text"].lower()
    assert "kitchen" in after["text"].lower()
    # The whole lesson runs in the order above.
    assert order.index(tap["title"]) < order.index(needs["title"]) < order.index(diet["title"])
    assert order.index(diet["title"]) < order.index(feed["title"])


def test_feeding_never_dead_ends_on_an_empty_larder():
    html = HTML.read_text(encoding="utf-8")
    assert "function maybeGrantTutorialFalconRation()" in html
    assert "if (action.event === 'merlin-fed') maybeGrantTutorialFalconRation();" in html
    assert "larder.small_bird_prey_ration = 2;" in html


def test_the_game_reports_the_players_deeds_to_merlin():
    html = HTML.read_text(encoding="utf-8")
    assert "function burbzTutorialAction(name)" in html
    assert "window.burbzTutorialAction = burbzTutorialAction;" in html
    for hook in (
        "burbzTutorialAction('merlin-care-opened')",   # care menu opened
        "burbzTutorialAction('merlin-fed')",           # a real feed landed
        "burbzTutorialAction('tab:' + item.dataset.screen)",  # a tab the PLAYER tapped
        "burbzTutorialAction('expedition-sent')",      # errand dispatched
        "burbzTutorialAction('roost-built')",          # building raised
    ):
        assert hook in html, hook
    # Only a real feed counts — a refused meal must not advance the lesson.
    assert "if (tx.ok && typeof burbzTutorialAction === 'function') burbzTutorialAction('merlin-fed');" in html


def test_screen_changes_the_tutorial_makes_itself_never_count_as_the_player():
    html = HTML.read_text(encoding="utf-8")
    # The tab event is fired from the nav click handler, not from switchScreen,
    # so a step that moves the player to a screen cannot satisfy its own gate.
    nav = html[html.index("const item = e.target.closest('.nav-item');"):]
    assert "burbzTutorialAction('tab:' + item.dataset.screen)" in nav[:400]
    switch = html[html.index("function switchScreen(name)"):]
    assert "burbzTutorialAction('tab:" not in switch[:2000]


def test_interactive_steps_hand_the_app_back_and_shield_the_rest():
    html = HTML.read_text(encoding="utf-8")
    # The app is live again while Merlin waits — never inert.
    assert "setMerlinTutorialBackgroundInert(false);" in html
    assert "if (step.action && merlinTutMode !== 'full' && merlinTutActionIsAvailable(step.action)) merlinTutArmAction(step);" in html
    assert "else setMerlinTutorialBackgroundInert(true);" in html
    # Four shields cut a single tappable hole around the lit control.
    assert "function merlinTutPositionShields(rect)" in html
    for shield in ("Top", "Bottom", "Left", "Right"):
        assert f'id="merlinTutorialShield{shield}"' in html
    assert ".merlin-tutorial-overlay.interactive { pointer-events:none; }" in html
    # The real control is lifted out of the dim so it is bright and tappable.
    assert ".tutorial-lift { z-index:1520 !important; }" in html
    # A missing target dims everything rather than leaving a hole anywhere.
    assert "merlinTutPositionShields(null);" in html


def test_free_mode_exists_for_multi_tap_jobs():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="merlinTutorialTask"' in html
    assert ".merlin-tutorial-overlay.free .merlin-tutorial-stage" in html
    # Building a roost and sending a quest both need the whole screen.
    modes = {s["action"]["event"]: s["action"].get("mode") for s in tutorial_data()["steps"] if s.get("action")}
    assert modes["roost-built"] == "free"
    assert modes["expedition-sent"] == "free"
    # A single precise tap keeps the dim.
    assert modes["merlin-fed"] is None


def test_an_armed_step_can_never_trap_the_player():
    html = HTML.read_text(encoding="utf-8")
    # Next is hidden while waiting…
    assert "$('merlinTutorialNext').style.display = 'none';" in html
    # …but comes back as a skip if the deed never happens.
    assert "merlinTutActionRescueTimer = setTimeout(" in html
    assert "button.textContent = 'Skip step';" in html
    # Arrow keys and Enter cannot jump an armed gate.
    assert "if (merlinTutAwaitingAction && $('merlinTutorialNext')?.style.display === 'none') return;" in html
    # Back and Skip tour still work: leaving a step always disarms it.
    assert html.count("merlinTutClearAction()") >= 5


def test_the_tutorial_owns_the_care_menu_for_the_whole_feeding_lesson():
    """Regression: "Feed me!" pointed at a closed menu with nothing to tap.

    Pressing Next on Merlin's own bubble bubbled out to the close-on-outside-tap
    handler, so the menu was shut by the time the feed step arrived. The whole
    lesson now holds the menu open, not just the armed step.
    """
    html = HTML.read_text(encoding="utf-8")
    assert "function merlinTutHoldsCareMenu()" in html
    assert "const MERLIN_CARE_STEP_TARGETS = ['.merlin-care-status', '#merlinDietGuidance', '#merlinFeedBtn', '#merlinCareMenu'];" in html
    # Both ways the menu can be closed are gated on the lesson, not on an
    # armed action (which is null while Merlin is merely talking).
    assert "if (merlinTutHoldsCareMenu()) return;" in html
    assert "if (!options.force && merlinTutHoldsCareMenu()) return;" in html
    # Merlin flying off on a quest still wins.
    assert "closeMerlinCareMenu({ force:true })" in html
    # And any step of the lesson reopens the menu if something closed it.
    assert "function merlinTutEnsureCareMenuOpen()" in html
    assert "if (merlinTutCareMenuStep(step)) merlinTutEnsureCareMenuOpen();" in html
    # Reopening for the player must not count as the player tapping Merlin.
    ensure = html[html.index("function merlinTutEnsureCareMenuOpen()"):]
    assert "burbzTutorialAction" not in ensure[:ensure.index("\n}")]
    # Every care-lesson step targets something inside the menu.
    care_targets = {"#petSprite", ".merlin-care-status", "#merlinDietGuidance", "#merlinFeedBtn", "#merlinCareMenu"}
    story = steps_of("story")
    tap = next(i for i, s in enumerate(story) if s["target"] == "#petSprite")
    feed = next(i for i, s in enumerate(story) if s["target"] == "#merlinFeedBtn")
    for step in story[tap:feed + 1]:
        assert step["target"] in care_targets, step["title"]


def test_the_diet_panel_keeps_its_id_across_renders():
    """Regression: renderMerlinCareMenu replaced #merlinDietGuidance with an
    id-less div, so the diet step spotlighted nothing after the first render."""
    html = HTML.read_text(encoding="utf-8")
    render = html[html.index("function renderMerlinCareMenu()"):]
    render = render[:render.index("\n}")]
    assert "menu.querySelector('.merlin-diet-guidance')" in render
    assert "guidance.id = 'merlinDietGuidance'" in render
    # The disclosure itself still emits no id, which is why the re-stamp exists.
    disclosure = html[html.index("function renderDietDisclosureHTML(subject, surface, options = {})"):]
    assert "id=\"merlinDietGuidance\"" not in disclosure[:2000]


def test_a_chapter_ended_by_a_tab_tap_hands_over_to_the_next_chapter():
    html = HTML.read_text(encoding="utf-8")
    # The chapter for the new screen was suppressed while Merlin was talking,
    # so it is asked for again once he falls quiet.
    assert "if (completed && typeof maybeStartMerlinChapterForScreen === 'function') {" in html
    assert "maybeStartMerlinChapterForScreen(handOffScreen)" in html


def test_the_flow_still_covers_every_beat_the_design_asks_for():
    assert "never be stuck for something to do" in chapter_copy("story")
    assert "crafting gear" in chapter_copy("errand")
    assert "instantly this time round" in chapter_copy("academy")
    tour = chapter_copy("academy_tour")
    for term in ("barracks", "kitchen", "hospital", "training", "crowbar", "player quests"):
        assert term in tour, term
    explore = chapter_copy("explore")
    assert "walking quests" in explore
    assert "villages" in explore and "comes later" in explore
    assert "send me out on quests or get out and look for a bird" in explore


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "care-lesson-fix-v150-20260728" in sw
    assert "const BURBZ_BUILD = 'care-lesson-fix-v150-20260728';" in HTML.read_text(encoding="utf-8")
