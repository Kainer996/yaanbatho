"""Quest category drawers start closed until the player opens one."""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def function_source(html: str, name: str, next_name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.index(f"\nfunction {next_name}(", start)
    return html[start:end]


def test_every_quest_category_defaults_closed():
    html = HTML.read_text(encoding="utf-8")
    source = function_source(html, "questCategoryOpenMap", "questCategoryIsOpen")
    assert "questCategoryOpenState[c.id] = false;" in source
    assert "i === 0" not in source


def test_quest_category_closed_default_is_cache_busted():
    feature_marker = "quest-drawers-closed-v165-20260729"
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    build = html.split("const BURBZ_BUILD = '", 1)[1].split("';", 1)[0]
    assert feature_marker in sw
    assert build in sw
