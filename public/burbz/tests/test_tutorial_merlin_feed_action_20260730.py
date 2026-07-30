import json
import subprocess
from pathlib import Path

HTML = Path(__file__).resolve().parents[1] / "index.html"


def function_source(source: str, name: str) -> str:
    start = source.index(f"function {name}(")
    brace = source.index("{", start)
    depth = 0
    for index in range(brace, len(source)):
        if source[index] == "{":
            depth += 1
        elif source[index] == "}":
            depth -= 1
            if depth == 0:
                return source[start : index + 1]
    raise AssertionError(f"unterminated {name}")


def test_tutorial_prepares_merlin_to_accept_the_promised_meal():
    html = HTML.read_text(encoding="utf-8")
    fn = function_source(html, "maybeGrantTutorialFalconRation")
    script = f"""
let care = {{ hunger:20, lastHungerAt:1 }};
let larder = {{ small_bird_prey_ration:2, mealworm_scoop:2 }};
let saved = 0, rendered = 0;
function ensureLarder() {{ return larder; }}
function getMerlinCare() {{ return care; }}
function dietHungerCore() {{ return {{ FEEDING_HUNGER_MIN:60 }}; }}
function saveState() {{ saved += 1; }}
function renderMerlinCareMenu() {{ rendered += 1; }}
function showToast() {{}}
{fn}
maybeGrantTutorialFalconRation();
console.log(JSON.stringify({{care,larder,saved,rendered}}));
"""
    result = subprocess.run(["node", "-e", script], text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    output = json.loads(result.stdout)
    assert output["care"]["hunger"] >= 60
    assert output["larder"]["small_bird_prey_ration"] == 2
    assert output["saved"] == 1
    assert output["rendered"] == 1


def test_feed_is_prepared_before_the_tutorial_decides_if_action_is_available():
    html = HTML.read_text(encoding="utf-8")
    show_step = function_source(html, "merlinTutShowStep")
    prepare = "maybeGrantTutorialFalconRation();"
    availability = "merlinTutActionIsAvailable(step.action)"
    assert prepare in show_step
    assert show_step.index(prepare) < show_step.index(availability)


def test_feed_refusal_message_does_not_blame_mealworms_when_rations_exist():
    html = HTML.read_text(encoding="utf-8")
    care = function_source(html, "careForMerlin")
    assert "Number(ensureLarder().small_bird_prey_ration) || 0) < 1" in care
