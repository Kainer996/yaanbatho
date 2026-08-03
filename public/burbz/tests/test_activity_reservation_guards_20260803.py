"""A companion can only occupy one job, journey, drill, or battle at a time."""
import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def function_source(name: str) -> str:
    start = HTML.index(f"function {name}(")
    depth = 0
    for index in range(start, len(HTML)):
        if HTML[index] == "{":
            depth += 1
        elif HTML[index] == "}":
            depth -= 1
            if depth == 0:
                return HTML[start:index + 1]
    raise AssertionError(f"unterminated function: {name}")


def node_json(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=60,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_posted_bird_cannot_move_or_spend_resources_building_a_destination():
    move = function_source("academyMoveBird")
    build_and_move = function_source("academyBuildAndMoveBird")
    assert move.index("birdAssignedPost(birdId)") < move.index("bird.academy.room = room")
    assert build_and_move.index("birdAssignedPost(birdId)") < build_and_move.index("academyBuildBuilding(")

    out = node_json(
        move
        + "\n"
        + build_and_move
        + r"""
const bird = {id:'posted', commonName:'Robin', academy:{room:'outdoors'}, care:{}};
const ACADEMY_ROOMS = {outdoors:{label:'Gardens'}, dorm:{label:'Roost', buildingId:'dorm'}};
let buildCalls = 0;
let saves = 0;
let toast = '';
function academyBirdById() { return bird; }
function birdAssignedPost() { return {role:{title:'Head Chef'}}; }
function academyBuildBuilding() { buildCalls += 1; return true; }
function showToast(value) { toast = value; }
function saveState() { saves += 1; }
academyMoveBird('posted', 'dorm');
academyBuildAndMoveBird('posted', 'dorm');
console.log(JSON.stringify({room:bird.academy.room, buildCalls, saves, toast}));
"""
    )
    assert out["room"] == "outdoors"
    assert out["buildCalls"] == 0
    assert out["saves"] == 0
    assert "stand them down" in out["toast"]


def test_training_and_questing_birds_are_absent_from_every_battle_picker():
    required_filter = (
        "!birdAssignedPost(b.id) && !birdHasActiveTraining(b.id) && "
        "!birdHasActiveExpedition(b.id) && !sleepReadinessForBird(b, Date.now()).sleeping"
    )
    assert required_filter in function_source("renderBattleSelect")
    assert required_filter in function_source("battlePickToggle")


def test_start_battle_rejects_a_stale_busy_selection_before_creating_battle():
    start = function_source("startPerchBattle")
    assert start.index("const busy = team.find") < start.index("core.createBattle(")
    out = node_json(
        start
        + r"""
const busyBird = {id:'busy', commonName:'Wren'};
let battleCreates = 0;
let rendered = 0;
let toast = '';
const battleSelectedIds = ['busy'];
function battleCore() { return {createBattle(){ battleCreates += 1; }}; }
function ensureLeagueState() { return {}; }
function getBattleFlock() { return [busyBird]; }
function birdAssignedPost() { return null; }
function birdHasActiveTraining(id) { return id === 'busy'; }
function birdHasActiveExpedition() { return false; }
function birdDisplayName(bird) { return bird.commonName; }
function showToast(value) { toast = value; }
function renderBattleSelect() { rendered += 1; }
startPerchBattle();
console.log(JSON.stringify({battleCreates, rendered, toast}));
"""
    )
    assert out["battleCreates"] == 0
    assert out["rendered"] == 1
    assert "already busy with training" in out["toast"]
