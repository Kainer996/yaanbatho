"""Roost sleep, tiredness and calm room-assignment grids (2026-08-03)."""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
CORE_PATH = ROOT / "bird_sleep_core.js"
SW_PATH = ROOT / "sw.js"


def run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout.strip().splitlines()[-1])


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def test_sleep_core_models_tiredness_and_nocturnal_hours():
    assert CORE_PATH.exists(), "bird_sleep_core.js must own the deterministic sleep rules"
    out = run_node("""
      const core = require('./bird_sleep_core.js');
      const owl = { commonName:'Tawny Owl', traits:['nocturnal','silent flyer'] };
      const robin = { commonName:'European Robin', traits:['songbird'] };
      const base = core.sanitizeSleepCare({tiredness:20,lastTirednessAt:0}, 0);
      const tired = core.advanceTiredness(base, 13 * 3600000, false);
      const rested = core.advanceTiredness({...tired, sleeping:true, lastTirednessAt:13*3600000}, 17 * 3600000, true);
      console.log(JSON.stringify({
        owlNocturnal: core.isNocturnalBird(owl),
        robinNocturnal: core.isNocturnalBird(robin),
        owlSleepsNoon: core.isScheduledSleepTime(owl, 12),
        owlAwakeEarlyEvening: !core.isScheduledSleepTime(owl, 18),
        robinNotForcedAsleepNoon: !core.isScheduledSleepTime(robin, 12),
        tirednessAfterDay: tired.tiredness,
        tirednessAfterFourHoursSleep: rested.tiredness,
        tiredPlan: core.sleepPlan(tired, robin, {now:13*3600000, localHour:19, roostBuilt:true, busy:false}),
        daytimeOwlPlan: core.sleepPlan(base, owl, {now:0, localHour:12, roostBuilt:true, busy:false}),
        eveningOwlPlan: core.sleepPlan({...base,tiredness:10,sleeping:true}, owl, {now:0, localHour:18, roostBuilt:true, busy:false})
      }));
    """)
    assert out["owlNocturnal"] and not out["robinNocturnal"]
    assert out["owlSleepsNoon"] and out["owlAwakeEarlyEvening"] and out["robinNotForcedAsleepNoon"]
    assert 84 <= out["tirednessAfterDay"] <= 86
    assert 4 <= out["tirednessAfterFourHoursSleep"] <= 6
    assert out["tiredPlan"]["shouldSleep"]
    assert out["daytimeOwlPlan"]["shouldSleep"] and out["daytimeOwlPlan"]["scheduled"]
    assert out["eveningOwlPlan"]["shouldWake"]


def test_app_migrates_sleep_state_auto_roosts_and_blocks_sleeping_work():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert re.search(r'<script src="bird_sleep_core\.js\?v=[^"]+"></script>', html)
    assert "tiredness: 20" in function_source(html, "defaultBirdCare")
    reconcile = function_source(html, "reconcileBirdSleep")
    assert "sleepPlan" in reconcile and "sleepReturnRoom" in reconcile
    assert "bird.academy.room = 'dorm'" in reconcile
    assert "bird.academy.room = returnRoom" in reconcile
    readiness = function_source(html, "birdWorkReadiness")
    assert "sleepReadinessForBird" in readiness
    move = function_source(html, "academyMoveBird")
    assert "room === 'dorm'" in move and "manual" in move
    render = function_source(html, "renderAcademy")
    assert "reconcileAllBirdSleep" in render
    quest = function_source(html, "renderQuestSendSheet")
    training = function_source(html, "renderTrainingHallPanel")
    battle = function_source(html, "renderBattleSelect")
    assert "sleepReadinessForBird" in quest
    assert "sleepReadinessForBird" in training
    assert "sleepReadinessForBird" in battle


def test_room_interior_uses_static_top_right_grid_not_roaming_birds():
    html = HTML_PATH.read_text(encoding="utf-8")
    render = function_source(html, "renderAcademyRoomInterior")
    assert "room-bird-grid" in html
    assert "roomBirdGridHTML" in render
    assert "room-bird-actor" not in render
    assert "roomBirdSpriteHTML" not in render
    assert "kitchenChefSpriteHTML" not in render
    assert "@keyframes roomBirdTravel" not in html
    assert "@keyframes roomBirdBounce" not in html
    assert "@keyframes academyHop" not in html
    academy = function_source(html, "renderAcademy")
    assert "if (markers) markers.innerHTML = '';" in academy
    assert re.search(r"\.room-bird-grid\s*\{[^}]*position:absolute;[^}]*top:", html, re.S)
    assert ".room-bird-grid-item" in html


def test_tiredness_metre_is_distinct_from_hp_and_fullness():
    html = HTML_PATH.read_text(encoding="utf-8")
    panel = function_source(html, "renderAcademyRoomPanel")
    assert "academyMeter('TIREDNESS'" in panel
    assert "academySleepStatusHTML" in panel
    grid = function_source(html, "roomBirdGridHTML")
    assert "tiredness" in grid and "Sleeping" in grid


def test_sleep_release_is_cached():
    sw = SW_PATH.read_text(encoding="utf-8")
    assert "bird_sleep_core.js?v=roost-sleep-v208-20260803" in sw
    assert "roost-sleep-v208-20260803" in sw
