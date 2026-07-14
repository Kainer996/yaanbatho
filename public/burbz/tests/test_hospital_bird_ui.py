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


def keyframes_source(html: str, name: str) -> str:
    start = html.index(f"@keyframes {name}")
    end = html.index("\n}", start) + 2
    return html[start:end]


def test_hospital_birds_render_accessible_health_bars_above_the_actor():
    html = HTML_PATH.read_text(encoding="utf-8")
    health = function_source(html, "roomBirdHealthHTML")
    sprite = function_source(html, "roomBirdSpriteHTML")
    assert "role=\"progressbar\"" in health
    assert "aria-valuemin=\"0\"" in health
    assert "aria-valuemax=\"" in health
    assert "aria-valuenow=\"" in health
    assert "room-bird-health-fill" in health
    assert "room === 'hospital'" in sprite
    assert "room-bird-actor" in sprite
    assert ".room-bird-health {" in html
    assert "bottom:calc(100%" in html


def test_hospital_health_bar_math_keeps_zero_hp_and_clamps_width():
    html = HTML_PATH.read_text(encoding="utf-8")
    health = function_source(html, "roomBirdHealthHTML")
    script = "const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));\n" + health + "\nconsole.log(JSON.stringify([roomBirdHealthHTML({hp:0,maxHp:80}),roomBirdHealthHTML({hp:120,maxHp:80})]));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    zero, overflow = json.loads(result.stdout)
    assert 'aria-valuenow="0"' in zero
    assert 'style="width:0%"' in zero
    assert 'data-hp-state="low"' in zero
    assert 'aria-valuenow="80"' in overflow
    assert 'style="width:100%"' in overflow


def test_room_birds_face_the_direction_they_are_walking():
    html = HTML_PATH.read_text(encoding="utf-8")
    travel = keyframes_source(html, "roomBirdTravel")
    facing = keyframes_source(html, "roomBirdFacing")
    assert "46%{translate:min(64vw,520px) 0}" in travel
    assert "96%{translate:2vw 0}" in travel
    assert "scale:" not in travel
    assert "0%{scale:1 1}" in facing
    assert "46%{scale:1 1}" in facing
    assert "50%{scale:-1 1}" in facing
    assert "96%{scale:-1 1}" in facing
    assert "animation:roomBirdFacing" in html


def test_room_renderer_passes_room_context_to_each_bird_actor():
    html = HTML_PATH.read_text(encoding="utf-8")
    render = function_source(html, "renderAcademyRoomInterior")
    assert "birds.map((bird, index) => roomBirdSpriteHTML(bird, index, room)).join('')" in render


def test_hospital_bird_ui_is_part_of_the_offline_app_shell():
    sw = SW_PATH.read_text(encoding="utf-8")
    assert "'./index.html'" in sw
    assert "const BURBZ_CACHE = 'burbz-" in sw
