import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "irl_world_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def run_core(expression):
    source = (
        "global.window=global; require('./irl_world_core.js'); "
        "const w=global.BurbzIrlWorld; console.log(JSON.stringify(" + expression + "));"
    )
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_settlement_is_deterministic_per_grid_cell():
    expr = (
        "(() => { const a=w.buildSettlement(54.4501,-2.6502); const b=w.buildSettlement(54.4503,-2.6497);"
        " return {aName:a.name,bName:b.name,aCell:a.cellId,bCell:b.cellId,"
        " aFirst:[a.landmarks[0].lat,a.landmarks[0].lon]}; })()"
    )
    result = run_core(expr)
    # Same ~1 km cell -> same hold name; layout is anchored to the player's fix.
    assert result["aCell"] == result["bCell"] == "54.45,-2.65"
    assert result["aName"] == result["bName"]
    assert len(result["aName"]) > 4


def test_settlement_places_all_six_landmarks_and_npcs_within_walking_range():
    expr = (
        "(() => { const s=w.buildSettlement(54.45,-2.65);"
        " const d=p=>w.distMeters(s.anchor,p);"
        " return {types:s.landmarks.map(l=>l.type).sort(), npcIds:s.npcs.map(n=>n.id).sort(),"
        " lmDists:s.landmarks.map(d), npcDists:s.npcs.map(d)}; })()"
    )
    result = run_core(expr)
    assert result["types"] == sorted(["meadHall", "smithy", "stall", "tower", "tavern", "stones"])
    assert result["npcIds"] == sorted(["jarl", "smith", "alchemist", "mage", "innkeep", "bard"])
    for dist in result["lmDists"] + result["npcDists"]:
        assert 40 <= dist <= 320, dist


def test_daily_quests_are_seeded_by_cell_npc_and_day():
    expr = (
        "(() => { const s=w.buildSettlement(54.45,-2.65); const npc=s.npcs.find(n=>n.id==='alchemist');"
        " const q1=w.buildQuestForNpc(npc,s,'2026-07-20'); const q2=w.buildQuestForNpc(npc,s,'2026-07-20');"
        " const q3=w.buildQuestForNpc(npc,s,'2026-07-21');"
        " return {same:JSON.stringify(q1)===JSON.stringify(q2), diff:JSON.stringify(q1)!==JSON.stringify(q3),"
        " count:q1.targets.length, xp:q1.reward.xp, coins:q1.reward.coins,"
        " dists:q1.targets.map(t=>w.distMeters(s.anchor,t))}; })()"
    )
    result = run_core(expr)
    assert result["same"] is True
    assert result["diff"] is True
    assert result["count"] == 3
    assert result["xp"] > 0 and result["coins"] > 0
    for dist in result["dists"]:
        assert 60 <= dist <= 400, dist


def test_delivery_and_visit_quests_target_real_landmarks():
    expr = (
        "(() => { const s=w.buildSettlement(51.5,-0.12);"
        " const smith=w.buildQuestForNpc(s.npcs.find(n=>n.id==='smith'),s,'2026-07-20');"
        " const mage=w.buildQuestForNpc(s.npcs.find(n=>n.id==='mage'),s,'2026-07-20');"
        " const tower=s.landmarks.find(l=>l.type==='tower'); const stones=s.landmarks.find(l=>l.type==='stones');"
        " return {smithAtTower:w.distMeters(smith.targets[0],tower)<1,"
        " mageAtStones:w.distMeters(mage.targets[0],stones)<1}; })()"
    )
    result = run_core(expr)
    assert result["smithAtTower"] is True
    assert result["mageAtStones"] is True


def test_process_fix_walks_targets_then_requires_return_to_questgiver():
    expr = (
        "(() => { const s=w.buildSettlement(54.45,-2.65); const npc=s.npcs.find(n=>n.id==='jarl');"
        " const q=w.buildQuestForNpc(npc,s,'2026-07-20'); const log=[];"
        " const atGiverEarly=w.processFix(q,npc.lat,npc.lon,npc,45); log.push(q.state);"
        " q.targets.forEach(t=>w.processFix(q,t.lat,t.lon,npc,45)); log.push(q.state);"
        " const finish=w.processFix(q,npc.lat,npc.lon,npc,45); log.push(q.state);"
        " return {log, earlyComplete:atGiverEarly.some(e=>e.type==='complete'),"
        " finishTypes:finish.map(e=>e.type), doneFlags:q.targets.map(t=>t.done)}; })()"
    )
    result = run_core(expr)
    # Standing next to the Jarl before doing the work must not complete anything.
    assert result["earlyComplete"] is False
    assert result["log"] == ["active", "return", "done"]
    assert result["finishTypes"] == ["complete"]
    assert all(result["doneFlags"])


def test_extrusion_paint_is_skyrim_timber_and_stone_not_modern_grey():
    result = run_core("w.extrusionPaint()")
    assert "fill-extrusion-color" in result
    assert result["fill-extrusion-vertical-gradient"] is True
    colors = json.dumps(result["fill-extrusion-color"])
    assert "#8b7454" in colors and "#7c6749" in colors
    # Extrusions fade in near street level rather than blanketing the parchment map.
    opacity = result["fill-extrusion-opacity"]
    assert opacity[0] == "interpolate" and opacity[3] == 14.7 and opacity[4] == 0


def test_index_html_wires_the_irl_world_module_in():
    html = HTML.read_text(encoding="utf-8")
    assert "irl_world_core.js?v=skyrim-settlements-v1-20260720" in html
    assert "window.BurbzIrlWorld.styleExtrusionLayer(liveMap, id)" in html
    assert "initIrlWorld();" in html
    assert "window.BurbzIrlWorld.onPositionFix(lat, lon)" in html
    for css_class in [".quest-marker.qm-villager", ".quest-marker.qm-irl-target", ".irl-town-banner", ".qm-npc-nameplate"]:
        assert css_class in html, css_class


def test_service_worker_ships_and_versions_the_new_module():
    sw = SW.read_text(encoding="utf-8")
    assert sw.count("./irl_world_core.js?v=skyrim-settlements-v1-20260720") == 2
    assert "burbz-skyrim-settlements-v96-20260720" in sw
    assert "burbz-roost-barracks-v95-20260720" not in sw
