"""Sleep is retired (2026-08-09) — birds never sleep, never block — plus the
calm room-assignment grids that shipped with the original Roost release.

The original Roost sleep loop (roost-sleep-v208) put tired and nocturnal
companions to bed in The Roost and blocked sleeping birds from battle, quests
and training. In practice a whole flock could be asleep at once, leaving the
player with nothing to fight with — so the mechanic was removed on Yaan's
call. bird_sleep_core.js keeps its API (and still owns nocturnal detection
and the Night Hunter bonus), but no bird ever tires, sleeps or is blocked
any more, and old saves wake their sleepers on load.
"""
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


def test_sleep_core_never_tires_sleeps_or_blocks_any_bird():
    assert CORE_PATH.exists(), "bird_sleep_core.js still owns nocturnal detection + the retired-sleep contract"
    out = run_node("""
      const core = require('./bird_sleep_core.js');
      const owl = { commonName:'Tawny Owl', traits:['nocturnal','silent flyer'] };
      const robin = { commonName:'European Robin', traits:['songbird'] };
      const stale = { tiredness: 95, sleeping: true, sleepingSince: 0, sleepReason: 'tired', sleepReturnRoom: 'training', lastTirednessAt: 0 };
      const care = core.sanitizeSleepCare(stale, 1000);
      const later = core.advanceTiredness({ tiredness: 0, lastTirednessAt: 0 }, 13 * 3600000);
      console.log(JSON.stringify({
        owlNocturnal: core.isNocturnalBird(owl),
        robinNocturnal: core.isNocturnalBird(robin),
        nobodyScheduled: !core.isScheduledSleepTime(owl, 12) && !core.isScheduledSleepTime(robin, 3),
        staleSleeperWoken: care.sleeping === false && care.tiredness === 0 && care.sleepReason === null,
        returnRoomKeptForMigration: care.sleepReturnRoom === 'training',
        neverTires: later.tiredness === 0,
        plan: core.sleepPlan({ tiredness: 100 }, robin, { now: 0, localHour: 12, roostBuilt: true, busy: false }),
        wakePlan: core.sleepPlan(stale, owl, { now: 0, localHour: 12, roostBuilt: true, busy: false }),
        readiness: core.sleepReadiness(stale, owl, { now: 0, localHour: 12 })
      }));
    """)
    assert out["owlNocturnal"] and not out["robinNocturnal"]
    assert out["nobodyScheduled"]
    assert out["staleSleeperWoken"] and out["returnRoomKeptForMigration"]
    assert out["neverTires"]
    assert out["plan"]["shouldSleep"] is False and out["plan"]["scheduled"] is False and out["plan"]["sleeping"] is False
    assert out["wakePlan"]["shouldWake"] is True
    assert out["readiness"] == {"ok": True, "sleeping": False, "tiredness": 0, "warning": False, "message": ""}


def test_app_wakes_old_saves_and_never_blocks_or_hides_sleep_ui():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert re.search(r'<script src="bird_sleep_core\.js\?v=[^"]+"></script>', html)
    assert "tiredness: 0" in function_source(html, "defaultBirdCare")
    # The reconcile pass is now a save migration: sleepers wake and walk home.
    reconcile = function_source(html, "reconcileBirdSleep")
    assert "sleepReturnRoom" in reconcile
    assert "shouldSleep" not in reconcile and "sleeping = true" not in reconcile
    # Moving a bird to the Roost is only ever a move — no manual sleep.
    move = function_source(html, "academyMoveBird")
    assert "sleeping = true" not in move and "sleepReason" not in move
    # No dead tiredness metre, no Sleeping states left in the care UI.
    panel = function_source(html, "renderAcademyRoomPanel")
    assert "academyMeter('TIREDNESS'" not in panel
    assert "academySleepStatusHTML" in panel
    grid = function_source(html, "roomBirdGridHTML")
    assert "Sleeping" not in grid and "room-bird-grid-tired" not in grid
    # The Roost sells rest, not sleep.
    assert "Rest: restores HP" in html
    assert "Sleep: restores Tiredness and HP" not in html


def test_battle_quests_and_training_filters_stay_wired_and_never_exclude():
    # The pinned availability filters survive (other suites assert the exact
    # strings), but sleepReadinessForBird now always reports awake — proven by
    # the core readiness contract above. Here: the plumbing still exists so a
    # future revert has a single switch to flip.
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "sleepReadinessForBird" in function_source(html, "renderQuestSendSheet")
    assert "sleepReadinessForBird" in function_source(html, "renderTrainingHallPanel")
    assert "sleepReadinessForBird" in function_source(html, "renderBattleSelect")
    assert "reconcileAllBirdSleep" in function_source(html, "renderAcademy")


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


def test_sleep_retirement_release_is_cached():
    sw = SW_PATH.read_text(encoding="utf-8")
    assert "bird_sleep_core.js?v=night-hunter-ascendant-v258-20260813" in sw
    assert "roost-sleep-v208-20260803" in sw
    assert "sleep-retired-v238-20260809" in sw
