"""Player quest GO guidance for the Kitchen & Pantry."""
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


def test_true_diet_go_targets_the_kitchen_room():
    quest = next(q for q in player_quests() if q["id"] == "pq_true_diet")
    assert quest["go"] == "academy"
    assert quest["focusRoom"] == "kitchen"


def test_quest_guidance_renders_a_clear_kitchen_highlight_and_clears_on_tap():
    html = HTML.read_text(encoding="utf-8")
    assert "let academyQuestGuidanceRoom = null;" in html
    assert "academyQuestGuidanceRoom = q.focusRoom || null;" in html
    assert "treehouse-room-node quest-guided" in html
    assert "Tap Kitchen & Pantry" in html
    assert "if (room === academyQuestGuidanceRoom) academyQuestGuidanceRoom = null;" in html
    assert ".treehouse-room-node.quest-guided" in html
    assert "@keyframes academyQuestGuidePulse" in html


def test_kitchen_guidance_release_remains_in_the_service_worker_cache_history():
    marker = "kitchen-quest-guide-v156-20260729"
    # BURBZ_BUILD names only the newest release, while BURBZ_CACHE intentionally
    # retains older feature markers so this regression survives later cache bumps.
    assert marker in SW.read_text(encoding="utf-8")
