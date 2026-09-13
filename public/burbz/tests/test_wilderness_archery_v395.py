"""Walking archery, durable crafting and bounded crow art."""
from pathlib import Path
import subprocess

BASE = Path(__file__).resolve().parent

def test_archery_and_crow_behavior():
    for name in ["test_wilderness_archery_v395.cjs", "test_wilderness_birds_v395.cjs"]:
        subprocess.run(["node", str(BASE / name)], check=True)


def test_crafting_catalogue_and_bird_renderer_load_before_their_consumers():
    root = BASE.parent
    html = (root / "index.html").read_text()
    worker = (root / "sw.js").read_text()
    dependency = "loot_crafting_core.js?v=wilderness-birds-v395-20260913"
    assert dependency in html
    assert worker.count("'./" + dependency + "'") == 3
    assert html.index("wilderness_birds.js?v=") < html.index("wilderness_combat.js?v=")
