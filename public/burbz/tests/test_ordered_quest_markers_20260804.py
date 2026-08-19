import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "quest_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE = "ordered-quest-markers-v224-20260804"
CURRENT_BUILD = "tavern-flock-rounds-v286-20260819"


def run_core(expression: str):
    source = (
        "global.window=global; require('./quest_core.js'); "
        "const q=global.BurbzQuestCore; console.log(JSON.stringify(" + expression + "));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def quest(checkpoints):
    return {
        "startedAt": 1,
        "distanceWalkedM": 200,
        "lastFix": None,
        "birdsCaptured": [],
        "chestsOpened": 0,
        "checkpoints": checkpoints,
    }


def test_one_fix_can_reach_only_the_next_required_marker():
    overlapping = quest([
        {"kind": "npc", "lat": 53.0, "lon": -2.0, "reached": True},
        {"kind": "flag", "lat": 53.0010, "lon": -2.0, "reached": False},
        {"kind": "flag", "lat": 53.0011, "lon": -2.0, "reached": False},
        {"kind": "finish", "lat": 53.0, "lon": -2.0, "reached": False},
    ])
    result = run_core(
        "(() => { const quest=" + json.dumps(overlapping) + ";"
        "const events=q.questProcessFix(quest,53.00105,-2,8,1000);"
        "return {types:events.map(e=>e.type), reached:quest.checkpoints.map(c=>c.reached)}; })()"
    )
    assert result == {"types": ["flag"], "reached": [True, True, False, False]}


def test_a_later_marker_cannot_complete_before_an_earlier_one_on_a_nearby_loop_leg():
    loop = quest([
        {"kind": "npc", "lat": 53.0, "lon": -2.0, "reached": True},
        {"kind": "flag", "lat": 53.0040, "lon": -2.0, "reached": False},
        {"kind": "flag", "lat": 53.0001, "lon": -2.0, "reached": False},
        {"kind": "finish", "lat": 53.0, "lon": -2.0, "reached": False},
    ])
    result = run_core(
        "(() => { const quest=" + json.dumps(loop) + ";"
        "const events=q.questProcessFix(quest,53.0001,-2,8,1000);"
        "return {types:events.map(e=>e.type), reached:quest.checkpoints.map(c=>c.reached)}; })()"
    )
    # Being near the finish may still show the existing "waymarker left" hint,
    # but the nearby future flag must never complete or turn green.
    assert result == {"types": ["finish-blocked"], "reached": [True, False, False, False]}


def test_map_removes_completed_waymarkers_and_prioritises_only_the_next_marker():
    html = HTML.read_text(encoding="utf-8")
    assert "const nextRequiredIdx = window.BurbzQuestCore.questNextCheckpointIndex(quest);" in html
    assert "if (cp.reached && cp.kind !== 'finish') return;" in html
    assert "face.classList.toggle('active', idx === nextRequiredIdx);" in html
    assert "el.style.zIndex = idx === nextRequiredIdx ? '20' : '1';" in html
    assert "const checkpointProgressed = events.some(ev => ev.checkpoint && ev.checkpoint.kind !== 'chest') ||" in html
    assert "chestClaimHandled && !chestClaimFailed" in html
    assert "checkpointProgressed || finishJustUnlocked" in html


def test_release_reaches_the_live_pwa_instead_of_an_old_cached_core():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"quest_core.js?v={RELEASE}" in html
    assert f"./quest_core.js?v={RELEASE}" in sw
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert RELEASE in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
