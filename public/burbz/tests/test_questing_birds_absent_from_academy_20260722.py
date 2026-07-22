"""A bird that is away on a quest is physically absent from the Academy.

Regression for the Buzzard bug: a bird out on an expedition still appeared in
the Aviary Gardens, perched on the campus map, and was offered with an ADD
button in every room's "Add a bird to this room" panel. Away birds must not
stand in rooms, count toward room totals, or be movable until they return.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def test_campus_map_and_room_counts_skip_birds_away_on_expeditions():
    html = HTML_PATH.read_text(encoding="utf-8")
    render = function_source(html, "renderAcademy")
    assert "if (birdHasActiveExpedition(b.id)) return;" in render


def test_room_interior_hides_away_birds_and_disables_their_add_button():
    html = HTML_PATH.read_text(encoding="utf-8")
    render = function_source(html, "renderAcademyRoomInterior")
    # Away birds neither stand in the room stage...
    assert "b.academy.room === room && !birdHasActiveExpedition(b.id)" in render
    # ...nor hide from the add panel entirely — they show as away, un-addable.
    assert "b.academy.room !== room || birdHasActiveExpedition(b.id)" in render
    assert "Away on a quest" in render
    assert "Mid-training in " in render
    assert '<button class="room-bird-add-btn" disabled>' in render
    assert ".room-bird-add-btn:disabled" in html


def test_academy_move_bird_refuses_birds_that_are_away_or_training():
    html = HTML_PATH.read_text(encoding="utf-8")
    move = function_source(html, "academyMoveBird")
    script = (
        "const toasts=[];\n"
        "const bird={id:'b1',commonName:'Buzzard',academy:{room:'outdoors'}};\n"
        "const academyBirdById=()=>bird;\n"
        "const ACADEMY_ROOMS={roost:{label:'The Roost'},outdoors:{label:'Aviary Gardens'}};\n"
        "const ACADEMY_BUILDINGS={};\n"
        "let questing=true, training=false;\n"
        "const birdHasActiveExpedition=()=>questing;\n"
        "const birdHasActiveTraining=()=>training;\n"
        "const ensureBirdAcademy=()=>{};\n"
        "const isAcademyRoomBuilt=()=>true;\n"
        "const showToast=m=>toasts.push(m);\n"
        "const saveState=()=>{}; const SFX={tap:()=>{}};\n"
        "const renderAcademy=()=>{}; const renderAcademyBuildPanel=()=>{};\n"
        "let academySelectedRoom='outdoors';\n"
        + move +
        "\nacademyMoveBird('b1','roost');\n"
        "const roomWhileQuesting=bird.academy.room;\n"
        "questing=false; training=true;\n"
        "academyMoveBird('b1','roost');\n"
        "const roomWhileTraining=bird.academy.room;\n"
        "training=false;\n"
        "academyMoveBird('b1','roost');\n"
        "console.log(JSON.stringify({roomWhileQuesting,roomWhileTraining,roomWhenFree:bird.academy.room,toasts}));"
    )
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["roomWhileQuesting"] == "outdoors"
    assert out["roomWhileTraining"] == "outdoors"
    assert out["roomWhenFree"] == "roost"
    assert "quest" in out["toasts"][0]
    assert "training" in out["toasts"][1].lower()


def test_fix_ships_with_a_fresh_offline_cache_version():
    sw = SW_PATH.read_text(encoding="utf-8")
    assert "burbz-questing-birds-away-v98-20260722" in sw
