"""New-dawn release: fresh-start reset + Merlin's gradual chapter tutorial.

The old one-shot grand tour is gone. The tutorial now opens with Merlin
telling the story of the Kingdom of Burbz (the Earth of another universe
where birds are the dominant species, taken by the dark force of the evil
Burbz), then teaches each system in a short chapter the first time the
player opens that part of the game.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

VERSION = "merlin-gradual-chapters-v4-20260720"


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


def test_old_tutorial_is_gone_and_new_version_is_live():
    html = HTML.read_text(encoding="utf-8")
    assert "merlin-complete-tour-v2-20260715" not in html
    assert "MERLIN_TUTORIAL_ESSENTIAL_INDICES" not in html
    assert VERSION in html
    assert "burbzTutorialChapters:" in html


def test_every_chapter_has_steps_and_a_first_open_trigger():
    data = tutorial_data()
    chapters = data["chapters"]
    steps = data["steps"]
    chapter_ids = [c["id"] for c in chapters]
    assert len(chapter_ids) == len(set(chapter_ids))
    # The story fires at launch; every other chapter fires when its screen opens.
    triggers = {c["id"]: c["trigger"] for c in chapters}
    assert triggers["story"] == "launch"
    for cid, trigger in triggers.items():
        if cid != "story":
            assert trigger == cid
    # Every chapter owns at least one step, and every step belongs to a chapter.
    step_chapters = {s["chapterId"] for s in steps}
    assert step_chapters == set(chapter_ids)
    assert all(s.get("chapter") and s.get("title") and s.get("text") for s in steps)
    assert all(len(s["title"]) <= 42 and len(s["text"]) <= 240 for s in steps)
    # Gradual means short chapters, not one giant essay.
    for cid in chapter_ids:
        count = sum(1 for s in steps if s["chapterId"] == cid)
        assert 1 <= count <= 7, (cid, count)


def test_story_chapter_tells_the_multiverse_tale_of_the_evil_burbz():
    data = tutorial_data()
    story = " ".join(
        (s["title"] + " " + s["text"]).lower()
        for s in data["steps"]
        if s["chapterId"] == "story"
    )
    for marker in (
        "another universe",
        "dominant species",
        "dark force",
        "evil burbz",
        "tablet",
        "multiverse",
        "only you can unlock the darkness",
        "real birdwatching restores burbz",
        "11,000 known bird species",
        "absolutely epic prize",
    ):
        assert marker in story, marker


def test_chapters_cover_every_major_system():
    data = tutorial_data()
    copy = " ".join((s["title"] + " " + s["text"]).lower() for s in data["steps"])
    required = [
        "live map", "likely birds", "walking quest", "sound", "birdnet", "microphone",
        "camera", "birdex", "recruit", "companion", "empire", "liberation battle",
        "sanctuary", "evil burbz", "academy", "hospital", "training",
        "pantry", "expedition", "stores", "rank", "settings", "forge",
    ]
    assert all(term in copy for term in required), [t for t in required if t not in copy]
    assert "uploaded" in copy and "location" in copy and "optional" in copy


def test_gradual_triggers_are_wired_and_replay_survives():
    html = HTML.read_text(encoding="utf-8")
    assert "maybeStartMerlinChapterForScreen(name)" in html
    assert "markMerlinChaptersSeen" in html
    assert "allMerlinChaptersSeen" in html
    # The story always comes first; screen chapters wait for it.
    assert "!merlinChaptersSeen().includes('story')" in html
    # Skip or finish both count as seen — Merlin never nags twice.
    assert "merlinTutMode === 'full' ? MERLIN_TUTORIAL_CHAPTERS.map(c => c.id) : [merlinTutMode]" in html
    # Settings replay runs the complete apprenticeship.
    assert "startMerlinTutorial({ full:true, resume:false })" in html
    assert "Replay Complete Tutorial" in html
    # Progress state still distinguishes outcomes.
    assert "saveMerlinTutorialState('in_progress'" in html
    assert "completed ? 'completed' : 'skipped'" in html


def test_fresh_start_epoch_resets_the_whole_game_once():
    html = HTML.read_text(encoding="utf-8")
    assert "const BURBZ_FRESH_START_EPOCH = 'new-dawn-evil-burbz-20260720';" in html
    assert "applyFreshStartEpochIfNeeded();" in html
    # The wipe covers save, cloud token AND intro/tutorial seen-flags.
    assert "/^burbz/i.test(key)" in html
    # loadState applies the epoch before touching the saved state.
    load_start = html.index("function loadState()")
    load_head = html[load_start:load_start + 200]
    assert "applyFreshStartEpochIfNeeded" in load_head


def test_release_is_offline_and_cache_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-kitchen-core-delivery-v110-20260723" in sw
    assert "./assets/evil-burbz/evil-burb-1.png" in sw
