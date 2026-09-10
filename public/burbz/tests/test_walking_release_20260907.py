"""Walking route, builder, UI and artwork must arrive as one offline release."""
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
RELEASE = "walking-quests-v361-20260907"
CURRENT_BUILD = "landscape-v388-20260910"
RUNTIMES = (
    "walking_route_core.js",
    "walking_encounter_core.js",
    "walking_quest_ui.js",
    "quest_core.js",
)
def pin(path):
    return "map-trails-v381-20260909" if path == "quest_core.js" else RELEASE

STYLE = "walking_quest_ui.css"
ART = tuple(
    f"assets/walking-quests/{name}.webp"
    for name in ("warden", "lantern-post", "wayfarer-rest")
)


def shell_list(source, name):
    match = re.search(rf"const {name} = \[(.*?)\];", source, re.S)
    assert match, f"Missing service-worker list: {name}"
    return re.findall(r"['\"]([^'\"]+)['\"]", match.group(1))


def test_changed_quest_builder_and_entire_feature_are_required_offline():
    # In particular, merely mentioning quest_core in BURBZ_ASSETS is not
    # enough: installation uses INSTALL_REQUIRED and fallback checks CORE.
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    dependencies = tuple(f"./{path}?v={pin(path)}" for path in (*RUNTIMES, STYLE))
    dependencies += tuple(f"./{path}" for path in ART)
    for name in ("BURBZ_ASSETS", "BURBZ_CORE", "BURBZ_INSTALL_REQUIRED"):
        entries = shell_list(sw, name)
        for dependency in dependencies:
            assert entries.count(dependency) == 1, f"{name}: {dependency} missing or duplicated"


def test_entry_page_and_worker_use_matching_walking_release():
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    sw = (ROOT / "sw.js").read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in index
    cache = re.search(r"const BURBZ_CACHE = '([^']+)';", sw)
    assert cache and cache.group(1).endswith("-" + CURRENT_BUILD)
    for runtime in RUNTIMES:
        assert f'<script src="{runtime}?v={pin(runtime)}"></script>' in index
    assert f'<link rel="stylesheet" href="{STYLE}?v={RELEASE}">' in index
    # Dependencies must be available when the monolith first calls them.
    assert index.index(f'<script src="walking_route_core.js?v={RELEASE}') < index.index(
        f'<script src="quest_core.js?v={pin("quest_core.js")}'
    )


def test_legacy_updater_and_local_art_have_every_walking_dependency():
    updater = (REPO / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")
    entries = re.search(r"^FILES=\((.*?)^\)", updater, re.M | re.S)
    assert entries
    for dependency in (*RUNTIMES, STYLE, *ART):
        assert f'"{dependency}"' in entries.group(1)
        assert (ROOT / dependency).is_file()
    for art in ART:
        data = (ROOT / art).read_bytes()
        assert len(data) > 300, f"Empty or pointer artwork: {art}"
        assert data[:4] == b"RIFF" and data[8:12] == b"WEBP", f"Invalid WebP: {art}"
