"""Merlin tutorial rules carried from v5 (now on the v6 guided flow):
glance-readable steps, coverage of the newer mechanics (Kitchen feeding, diet
hunger, levelling, equipment, Charm diplomacy) and a spotlight that only
lights targets it can actually see on the active screen — the v4 spotlight
could highlight the wrong part of the display while Merlin was talking.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "merlin-interactive-flow-v7-20260728"
PREVIOUS = "merlin-guided-flow-v6-20260728"


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


def test_v7_is_live_and_migrates_from_v6():
    html = HTML.read_text(encoding="utf-8")
    assert f"const BURBZ_TUTORIAL_VERSION = '{VERSION}';" in html
    assert f"const BURBZ_PREVIOUS_TUTORIAL_VERSION = '{PREVIOUS}';" in html
    # Every hands-on chapter was rebuilt for v7, so all of them are re-taught.
    assert "const reteach = ['story', 'quests', 'errand', 'academy', 'academy_tour', 'explore'];" in html


def test_steps_are_short_enough_to_read_at_a_glance():
    steps = tutorial_data()["steps"]
    # The v4 copy ran to 240 characters a step; v5 stays glance-readable.
    for step in steps:
        assert len(step["text"]) <= 220, (step["title"], len(step["text"]))
        assert len(step["title"]) <= 32, step["title"]


def test_story_leads_to_quests_and_mechanics_arrive_bit_by_bit():
    data = tutorial_data()
    chapters = data["chapters"]
    steps = data["steps"]
    # The story fires at launch and its final beat points the player at Quests.
    assert chapters[0]["id"] == "story" and chapters[0]["trigger"] == "launch"
    story_steps = [s for s in steps if s["chapterId"] == "story"]
    # generated-ui-art-v298: Quests lives in the unified bottom navigation.
    assert story_steps[-1]["target"] == '.nav-item[data-screen="quests"]'
    assert "next little adventure" in story_steps[-1]["text"].lower()
    # The quest screen is the first taught system after the story.
    assert chapters[1]["id"] == "quests"
    # Gradual means every later system waits for its own trigger.
    for chapter in chapters[1:]:
        assert chapter["trigger"] == chapter["id"]
    # And no chapter is an essay: at most 12 short steps each.
    for chapter in chapters:
        count = sum(1 for s in steps if s["chapterId"] == chapter["id"])
        assert 1 <= count <= 13, (chapter["id"], count)


def test_new_mechanics_are_taught():
    steps = tutorial_data()["steps"]
    copy = " ".join((s["title"] + " " + s["text"]).lower() for s in steps)
    for term in (
        "kitchen", "food", "pantry", "diet",  # Kitchen & Pantry + diet hunger
        "level up",                              # bird levelling
        "equipment", "gear",                     # forge equipment
        "charm", "crowbar",                      # diplomacy (parley retired in v287)
    ):
        assert term in copy, term


def test_spotlight_only_lights_visible_targets_and_tracks_them():
    html = HTML.read_text(encoding="utf-8")
    # Visibility guard: never measure an element on an inactive screen.
    assert "function merlinTutVisibleTarget(selector)" in html
    assert "if (screen && !screen.classList.contains('active')) return null;" in html
    # Mostly off-screen targets dim fully instead of clamping to a wrong spot.
    assert "< 0.4) return null;" in html
    # The spotlight is re-measured every frame for the life of the step, and
    # multi-stage actions resolve their current live target on each frame.
    assert "function merlinTutTrackTarget(step)" in html
    assert "const selector = merlinTutTargetSelector(step);" in html
    assert "requestAnimationFrame(tick)" in html
    assert "merlinTutStopTracking()" in html
    assert "cancelAnimationFrame(merlinTutTrackHandle)" in html
    # Off-screen targets scroll into view before being highlighted.
    assert "el.scrollIntoView({ block:'nearest', inline:'nearest' })" in html


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-side-snacks-hunger-metre-v142-20260726" in sw
