import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def tutorial_steps():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("const MERLIN_TUTORIAL_STEPS = [")
    end = html.index("\n];", start) + 3
    source = html[start:end] + "\nconsole.log(JSON.stringify(MERLIN_TUTORIAL_STEPS));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_tutorial_is_versioned_complete_concise_and_covers_current_systems():
    html = HTML.read_text(encoding="utf-8")
    assert "merlin-gradual-chapters-v4-20260720" in html
    steps = tutorial_steps()
    assert 20 <= len(steps) <= 40
    assert all(step.get("chapter") and step.get("title") and step.get("text") for step in steps)
    assert all(len(step["title"]) <= 42 and len(step["text"]) <= 240 for step in steps)
    copy = " ".join((step["title"] + " " + step["text"]).lower() for step in steps)
    required = [
        "live map", "likely birds", "walking quest", "sound", "birdnet", "microphone",
        "camera", "birdex", "recruit", "companion", "empire", "liberation battle",
        "sanctuary", "perch league", "academy", "hospital", "training",
        "pantry", "expedition", "bag", "rank", "settings",
    ]
    assert all(term in copy for term in required), [term for term in required if term not in copy]
    assert "uploaded" in copy and "location" in copy and "optional" in copy
    assert "maybeStartMerlinChapterForScreen(name)" in html
    assert "chapterId:'academy'" in html and "chapterId:'quests'" in html
    assert "startMerlinTutorial({ full:true, resume:false })" in html


def test_tutorial_has_explicit_navigation_progress_replay_and_mobile_positioning():
    html = HTML.read_text(encoding="utf-8")
    for marker in (
        'id="merlinTutorialChapter"',
        'id="merlinTutorialTitle"',
        'id="merlinTutorialCounter"',
        'id="merlinTutorialBack"',
        'id="merlinTutorialNext"',
        "function positionMerlinTutorialStage(",
        "aria-live=\"polite\"",
        "keydown",
        "Replay Complete Tutorial",
    ):
        assert marker in html
    assert "merlinTutShowStep(merlinTutStep - 1)" in html
    assert "merlinTutAdvance()" in html
    assert "setMerlinTutorialBackgroundInert(true)" in html
    assert "refreshMerlinTutorialPosition" in html


def test_tutorial_progress_distinguishes_in_progress_completed_and_skipped():
    html = HTML.read_text(encoding="utf-8")
    assert "burbzTutorialState:" in html
    assert "saveMerlinTutorialState('in_progress'" in html
    assert "completed ? 'completed' : 'skipped'" in html
    assert "updatedAt:new Date().toISOString()" in html


def test_persistent_screens_do_not_repeat_tutorial_essays():
    html = HTML.read_text(encoding="utf-8")
    removed = [
        'class="empire-story-callout"',
        "Each real town you free breaks the usurper's hold",
        "Drag, pinch and zoom across the whole atlas",
        "Liberate the world map: travel to a real town",
        "Manga tree home base. Pick a building below",
        "A medieval market square for bird trainers. Drag to look around",
        "Tap Likely birds for a habitat overlay",
        "the tilted field map keeps real places",
        "Useful for recruiting, feeding, gifting",
        "Google sign-in needs a client ID",
        "moon_branch_trial",
        "Teases Arena Trial:",
        "all real bird behaviour",
        "Merlin is listening continuously",
    ]
    assert all(text not in html for text in removed), [text for text in removed if text in html]
    # Operational information stays in context.
    for text in ("Microphone active only while", "Tribute", "START BATTLE", "Privacy Policy"):
        assert text in html


def test_tutorial_release_is_offline_and_cache_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-skyrim-settlements-v96-20260720" in sw
