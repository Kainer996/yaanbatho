import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "quest_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def run_core(expression):
    source = "global.window=global; require('./quest_core.js'); const q=global.BurbzQuestCore; console.log(JSON.stringify(" + expression + "));"
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_nearby_natural_loop_keeps_the_full_loop_when_rotated_to_player():
    points = [
        {"lat": 53.0000, "lon": -2.0000},
        {"lat": 53.0000, "lon": -1.9900},
        {"lat": 53.0100, "lon": -1.9900},
        {"lat": 53.0100, "lon": -2.0000},
        {"lat": 53.0000, "lon": -2.0000},
    ]
    expr = "(() => { const pts=" + json.dumps(points) + "; const original=q.routeLengthM(pts); const out=q.normaliseTrailForPlayer(pts,53.0100,-1.9900,6000); return {out,original,length:q.routeLengthM(out),style:q.offerLoopStyle(out)}; })()"
    result = run_core(expr)
    assert result["style"] == "loop"
    assert result["length"] >= result["original"] * 0.95
    assert len(result["out"]) >= 5
    assert abs(result["out"][0]["lat"] - 53.0100) < 0.0001
    assert abs(result["out"][0]["lon"] + 1.9900) < 0.0001
    assert result["out"][0] == result["out"][-1]


def test_nearby_quest_routes_use_distinct_palette_and_dark_casing():
    html = HTML.read_text(encoding="utf-8")
    assert "const QUEST_OVERVIEW_COLORS =" in html
    assert "color: questOverviewColor(i)" in html
    assert "offset: questOverviewOffset(i)" not in html
    assert "'line-color':['get','color']" in html
    assert "'line-offset'" not in html
    assert "--quest-route-color" in html
    assert "quest trails revealed in green" not in html


def test_quest_route_clarity_release_is_cached_offline():
    sw = SW.read_text(encoding="utf-8")
    assert "./quest_core.js?v=loop-clarity-20260713" in sw
