import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")


def _function_source(name: str) -> str:
    match = re.search(rf"function\s+{re.escape(name)}\s*\([^)]*\)\s*\{{", HTML)
    assert match, f"missing function {name}"
    start = match.start()
    brace = HTML.index("{", match.start())
    depth = 0
    quote = None
    escaped = False
    for index in range(brace, len(HTML)):
        char = HTML[index]
        if quote:
            if escaped:
                escaped = False
            elif char == "\\":
                escaped = True
            elif char == quote:
                quote = None
            continue
        if char in ("'", '"', "`"):
            quote = char
        elif char == "{":
            depth += 1
        elif char == "}":
            depth -= 1
            if depth == 0:
                return HTML[start:index + 1]
    raise AssertionError(f"unterminated function {name}")


def _run_node(source: str) -> dict:
    proc = subprocess.run(["node", "-e", source], text=True, capture_output=True, check=True)
    return json.loads(proc.stdout)


def test_treehouse_uses_real_species_cutouts_when_available():
    assert "function treehouseBirdIconHTML" in HTML
    fn = _function_source("treehouseBirdIconHTML")
    result = _run_node(
        "const MAP_BIRD_CUTOUT_ART={'Blue Tit':'https://example.test/blue-tit-cutout.png'};"
        "const getBirdArtUrl=()=>null;"
        "const birdCutoutUrlFor=()=>null;"
        "const canonicalSpeciesName=s=>s;"
        "const escapeHtml=s=>String(s);"
        "const miniBirdSVG=s=>'<svg data-fallback=\"'+s+'\"></svg>';"
        + fn
        + "\nconsole.log(JSON.stringify({html:treehouseBirdIconHTML({commonName:'Blue Tit'})}));"
    )["html"]
    assert 'class="treehouse-bird-cutout"' in result
    assert 'src="https://example.test/blue-tit-cutout.png"' in result
    assert 'data-fallback-mini-bird="Blue Tit"' in result


def test_treehouse_fallback_is_a_front_facing_spread_wing_bird_not_a_fish_shape():
    svg = _function_source("miniBirdSVG")
    assert 'viewBox="0 0 32 30"' in svg
    assert 'class="mini-bird-body"' in svg
    assert 'class="mini-bird-head"' in HTML
    assert 'class="mini-bird-tail"' in HTML
    assert 'class="mini-bird-leg"' in HTML
    assert 'class="mini-bird-wing-left"' in svg
    assert 'class="mini-bird-wing-right"' in svg
    assert 'cx="16" cy="16" rx="5.2" ry="7.6"' in svg
    assert 'cx="12.7" cy="14.1" rx="7.2" ry="5.7"' not in svg


def test_fallback_plumage_uses_the_species_palette():
    tint_start = HTML.index("const BIRD_TINTS = [")
    tint_end = HTML.index("];", tint_start) + 2
    source = (
        "const burbzHash32=()=>1;"
        + HTML[tint_start:tint_end]
        + _function_source("birdTintFor")
        + _function_source("miniBirdSVG")
        + "\nconsole.log(JSON.stringify({blue:miniBirdSVG('Blue Tit'),robin:miniBirdSVG('European Robin')}));"
    )
    result = _run_node(source)
    assert "#4f8fd0" in result["blue"] and "#e8d44d" in result["blue"]
    assert "#d95f3b" in result["robin"] and "#8a6f52" in result["robin"]


def test_treehouse_renderer_calls_the_new_icon_helper():
    renderer = _function_source("renderAcademyTreehouse")
    assert "treehouseBirdIconHTML(b)" in renderer
    assert "miniBirdSVG(b.commonName || b.species)" not in renderer


def test_treehouse_icons_are_large_enough_to_read_on_mobile():
    assert ".treehouse-bird { position:absolute; width:30px; height:30px; margin:-15px 0 0 -15px;" in HTML
    assert ".treehouse-bird-cutout { width:100%; height:100%; object-fit:contain; display:block;" in HTML


def test_treehouse_bird_icon_release_bumps_the_pwa_cache():
    assert "burbz-tutorial-overhaul-v78-20260715" in SW
