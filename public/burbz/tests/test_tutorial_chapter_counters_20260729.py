import json
import subprocess
from pathlib import Path

HTML = Path(__file__).resolve().parents[1] / "index.html"


def _function_source(source: str, name: str) -> str:
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
    raise AssertionError(f"unterminated function {name}")


def _tutorial_counter_probe() -> dict:
    html = HTML.read_text(encoding="utf-8")
    array_start = html.index("const MERLIN_TUTORIAL_STEPS = [")
    array_end = html.index("\n];", array_start) + 3
    source = "\n".join(
        (
            html[array_start:array_end],
            _function_source(html, "merlinTutorialProgressGroup"),
            _function_source(html, "merlinTutorialProgressFor"),
            "const merlinTutSequence = MERLIN_TUTORIAL_STEPS.map((_, index) => index);",
            "const firstTen = Array.from({length:10}, (_, i) => merlinTutorialProgressFor(i));",
            "const all = MERLIN_TUTORIAL_STEPS.map((_, i) => merlinTutorialProgressFor(i));",
            "console.log(JSON.stringify({firstTen, all}));",
        )
    )
    result = subprocess.run(["node", "-e", source], text=True, capture_output=True, timeout=30)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_opening_is_four_steps_with_local_chapter_counters():
    probe = _tutorial_counter_probe()
    assert [item["label"] for item in probe["firstTen"]] == [
        "1 / 4", "2 / 4", "3 / 4", "4 / 4",
        "1 / 2", "2 / 2", "1 / 1", "1 / 2", "2 / 2", "1 / 2",
    ]


def test_no_tutorial_counter_block_exceeds_five_steps():
    probe = _tutorial_counter_probe()
    assert max(item["total"] for item in probe["all"]) <= 5


def test_counter_renderer_uses_local_block_not_whole_sequence_length():
    html = HTML.read_text(encoding="utf-8")
    show_step = html[html.index("function merlinTutShowStep(") : html.index("function merlinTutAdvance(")]
    assert "merlinTutorialProgressFor(i)" in show_step
    assert "progress.label" in show_step
    assert "(i + 1) + ' / ' + merlinTutSequence.length" not in show_step
