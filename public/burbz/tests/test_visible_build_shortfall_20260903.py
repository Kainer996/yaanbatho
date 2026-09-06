"""A village build shortfall must be visible above its building interior."""

import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CURRENT_BUILD = "concise-onboarding-v353-20260906"


def function_source(source: str, name: str) -> str:
    start = source.index(f"function {name}(")
    end = source.find("\nfunction ", start + 10)
    return source[start : end if end != -1 else len(source)]


def test_the_shortfall_prompt_replaces_the_room_instead_of_hiding_behind_it():
    source = function_source(HTML.read_text(encoding="utf-8"), "buildingInteriorBuild")
    script = f"""
const calls = [];
let promptOpen = true;
global.empireBuildStructure = () => calls.push('build');
global.document = {{ getElementById: id => id === 'resourceQuestOverlay' ? {{ classList: {{ contains: name => name === 'open' && promptOpen }} }} : null }};
global.closeBuildingInterior = () => calls.push('close');
global.renderBuildingInterior = () => calls.push('render');
global.currentScreen = 'village';
eval({json.dumps(source)});
buildingInteriorBuild(101, 'well');
if (calls.join(',') !== 'build,close') throw new Error('prompt stayed behind the room: ' + calls);
calls.length = 0;
promptOpen = false;
buildingInteriorBuild(101, 'well');
if (calls.join(',') !== 'build,render') throw new Error('normal build did not redraw: ' + calls);
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr


def test_the_fix_is_the_live_pwa_build():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert cache_line.rstrip().endswith(f"-{CURRENT_BUILD}';")
