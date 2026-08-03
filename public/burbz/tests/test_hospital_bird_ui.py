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


def test_hospital_birds_keep_accessible_health_inside_the_static_grid():
    html = HTML_PATH.read_text(encoding="utf-8")
    grid = function_source(html, "roomBirdGridHTML")
    assert "room === 'hospital'" in grid
    assert 'role="progressbar"' in grid
    assert 'aria-label="Health ' in grid
    assert 'aria-valuemin="0"' in grid
    assert 'aria-valuemax="' in grid
    assert 'aria-valuenow="' in grid
    assert "const hp = clamp" in grid
    assert ".room-bird-grid-hp" in html


def test_hospital_health_grid_clamps_hp_and_renders_exact_aria_values():
    html = HTML_PATH.read_text(encoding="utf-8")
    grid = function_source(html, "roomBirdGridHTML")
    script = """
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const rolePostState = () => null;
const normalizeBirdCare = bird => { bird.care ||= {}; };
const escapeHtml = value => String(value);
const birdDisplayName = bird => bird.name;
const birdOnlyImgHTML = () => '<img>';
const ACADEMY_ROOMS = { hospital:{ label:'Hospital' }, library:{ label:'Library' } };
""" + grid + """
const zero = roomBirdGridHTML([{ id:'zero', name:'Zero', hp:0, maxHp:80, care:{ tiredness:0 } }], 'hospital');
const overflow = roomBirdGridHTML([{ id:'overflow', name:'Overflow', hp:120, maxHp:80, care:{ tiredness:0 } }], 'hospital');
const outsideHospital = roomBirdGridHTML([{ id:'library', name:'Library', hp:40, maxHp:80, care:{ tiredness:0 } }], 'library');
console.log(JSON.stringify({ zero, overflow, outsideHospital }));
"""
    result = subprocess.run(
        ["node", "-e", script],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
        timeout=30,
    )
    assert result.returncode == 0, result.stderr
    rendered = json.loads(result.stdout)
    assert 'aria-label="Health 0 of 80"' in rendered["zero"]
    assert 'aria-valuemin="0"' in rendered["zero"]
    assert 'aria-valuemax="80"' in rendered["zero"]
    assert 'aria-valuenow="0"' in rendered["zero"]
    assert '♥ 0/80' in rendered["zero"]
    assert 'aria-label="Health 80 of 80"' in rendered["overflow"]
    assert 'aria-valuenow="80"' in rendered["overflow"]
    assert '♥ 80/80' in rendered["overflow"]
    assert "room-bird-grid-hp" not in rendered["outsideHospital"]
    assert 'aria-label="Health ' not in rendered["outsideHospital"]


def test_room_birds_are_calm_grid_portraits_not_walking_actors():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "@keyframes roomBirdTravel" not in html
    assert "@keyframes roomBirdFacing" not in html
    assert "@keyframes roomBirdBounce" not in html
    render = function_source(html, "renderAcademyRoomInterior")
    assert "roomBirdGridHTML(birds, room)" in render
    assert "roomBirdSpriteHTML" not in render
    assert "room-bird-actor" not in render


def test_room_grid_keeps_room_context_and_tiredness_visible():
    html = HTML_PATH.read_text(encoding="utf-8")
    grid = function_source(html, "roomBirdGridHTML")
    assert "rolePostState('academy', room)" in grid
    assert "Tiredness " in grid
    assert "Sleeping" in grid
    assert ".room-bird-grid { position:absolute;" in html


def test_hospital_bird_ui_is_part_of_the_offline_app_shell():
    sw = SW_PATH.read_text(encoding="utf-8")
    assert "'./index.html'" in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
