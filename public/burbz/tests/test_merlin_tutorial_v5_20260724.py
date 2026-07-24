"""Merlin tutorial v5: shorter glance-readable steps, capture-first teaching,
coverage of the newer mechanics (Kitchen feeding, diet hunger, levelling,
equipment, Charm diplomacy) and a spotlight that only lights targets it can
actually see on the active screen — the v4 spotlight could highlight the
wrong part of the display while Merlin was talking.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "merlin-gradual-chapters-v5-20260724"
PREVIOUS = "merlin-gradual-chapters-v4-20260720"


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


def test_v5_is_live_and_migrates_from_v4():
    html = HTML.read_text(encoding="utf-8")
    assert f"const BURBZ_TUTORIAL_VERSION = '{VERSION}';" in html
    assert f"const BURBZ_PREVIOUS_TUTORIAL_VERSION = '{PREVIOUS}';" in html
    # Chapters whose systems gained new mechanics since v4 are re-taught.
    assert "const reteach = ['academy', 'inventory', 'forge'];" in html


def test_steps_are_short_enough_to_read_at_a_glance():
    steps = tutorial_data()["steps"]
    # The v4 copy ran to 240 characters a step; v5 stays glance-readable.
    for step in steps:
        assert len(step["text"]) <= 150, (step["title"], len(step["text"]))
        assert len(step["title"]) <= 32, step["title"]


def test_capture_comes_first_and_mechanics_arrive_bit_by_bit():
    data = tutorial_data()
    chapters = data["chapters"]
    steps = data["steps"]
    # The story fires at launch and its final beat points the player at Scan.
    assert chapters[0]["id"] == "story" and chapters[0]["trigger"] == "launch"
    story_steps = [s for s in steps if s["chapterId"] == "story"]
    assert story_steps[-1]["target"] == '.nav-item[data-screen="scan"]'
    assert "captur" in story_steps[-1]["text"].lower()
    # Capturing birds is the first taught system after the story.
    assert chapters[1]["id"] == "scan"
    # Gradual means every later system waits for its own screen to open.
    for chapter in chapters[1:]:
        assert chapter["trigger"] == chapter["id"]
    # And no chapter is an essay: at most 7 short steps each.
    for chapter in chapters:
        count = sum(1 for s in steps if s["chapterId"] == chapter["id"])
        assert 1 <= count <= 7, (chapter["id"], count)


def test_new_mechanics_are_taught():
    steps = tutorial_data()["steps"]
    copy = " ".join((s["title"] + " " + s["text"]).lower() for s in steps)
    for term in (
        "kitchen", "hungry", "larder", "diet",  # Kitchen & Pantry + diet hunger
        "level up",                              # bird levelling
        "equipment", "gear",                     # forge equipment
        "charm", "parley", "crowbar",            # diplomacy
    ):
        assert term in copy, term


def test_spotlight_only_lights_visible_targets_and_tracks_them():
    html = HTML.read_text(encoding="utf-8")
    # Visibility guard: never measure an element on an inactive screen.
    assert "function merlinTutVisibleTarget(selector)" in html
    assert "if (screen && !screen.classList.contains('active')) return null;" in html
    # Mostly off-screen targets dim fully instead of clamping to a wrong spot.
    assert "< 0.4) return null;" in html
    # The spotlight is re-measured every frame for the life of the step.
    assert "function merlinTutTrackTarget(selector)" in html
    assert "requestAnimationFrame(tick)" in html
    assert "merlinTutStopTracking()" in html
    assert "cancelAnimationFrame(merlinTutTrackHandle)" in html
    # Off-screen targets scroll into view before being highlighted.
    assert "el.scrollIntoView({ block:'nearest', inline:'nearest' })" in html


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-merlin-branch-perch-v118-20260724" in sw
