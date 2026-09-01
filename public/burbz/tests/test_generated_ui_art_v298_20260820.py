"""Generated UI art release contracts (two-crews-v308-20260821).

The release unifies every player destination in one image-led bottom dock,
adds a Hospital shortcut, replaces visible gear emoji with transparent
generated art, and refreshes The Crowbar and Kitchen interiors. These tests
pin both the UI wiring and the offline/live-deploy asset manifests.
"""

import hashlib
import json
import re
import subprocess
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW_PATH = ROOT / "sw.js"
LOOT_CORE = ROOT / "loot_crafting_core.js"
UPDATER_PATH = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"

HTML = HTML_PATH.read_text(encoding="utf-8")
SW = SW_PATH.read_text(encoding="utf-8")
UPDATER = UPDATER_PATH.read_text(encoding="utf-8")

RELEASE = "generated-ui-art-v298-20260820"
# Later releases move BURBZ_BUILD on; v298's own segment stays in the lineage.
CURRENT_BUILD = "release-polish-v342-20260901"
SETTLEMENT_CORE_RELEASE = "settlement-scene-sharp-v285-20260819"

# Since the anchored dock (2026-08-20) the thirteen destinations split:
# ten scroll on the strip, and Empire · Scan · Academy stand solid in a
# centred island. nav_markup() returns strip + island in that order.
EXPECTED_NAV_LABELS = (
    # fixed-dock-v303: six management rooms on the top deck, the adventure
    # row below, then the anchored island — all thirteen fixed on screen.
    "Kitchen",
    "Stores",
    "Training",
    "Hospital",
    "Forge",
    "Ranks",
    "Map",
    "Quests",
    "Battle",
    "Birds",
    "Empire",
    "Scan",
    "Academy",
)

NEW_NAV_ART = (
    "map",
    "empire",
    "birdex",
    "scan",
    "battle",
    "academy",
    "leaderboards",
    "hospital",
)

INTERIOR_ART = {
    "crowbar": "assets/academy-interiors-manga/crowbar-v2-animated-20260819.webp",
    "kitchen": "assets/academy-interiors-manga/kitchen-v2-animated-20260819.webp",
}


def nav_markup() -> str:
    nav = re.search(r'<nav\b[^>]*\bid="bottomNav"[^>]*>(.*?)</nav>', HTML, re.DOTALL)
    assert nav, "#bottomNav markup is missing"
    anchor = re.search(r'<div class="bottom-dock-anchor"[^>]*>(.*?)</div>\n  </div>', HTML, re.DOTALL)
    assert anchor, "#bottomDockAnchor markup is missing"
    return nav.group(1) + anchor.group(1)


def css_rule(selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{([^}]*)\}", HTML, re.DOTALL)
    assert match, f"CSS rule missing: {selector}"
    return match.group(1)


def js_array_body(source: str, declaration: str) -> str:
    start = source.index(declaration)
    return source[start : source.index("\n];", start) + 3]


def loot_gear_ids() -> list[str]:
    result = subprocess.run(
        [
            "node",
            "-e",
            "const L=require('./loot_crafting_core.js');"
            "console.log(JSON.stringify(Object.keys(L.GEAR).sort()));",
        ],
        cwd=ROOT,
        text=True,
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def assert_transparent_webp(path: Path, size=(256, 256)) -> None:
    assert path.is_file(), path
    with Image.open(path) as image:
        image.load()
        assert image.format == "WEBP", path
        assert image.size == size, path
        assert image.mode == "RGBA", (path, image.mode)
        alpha_min, alpha_max = image.getchannel("A").getextrema()
        assert alpha_min == 0, f"{path} has no fully transparent pixels"
        assert alpha_max == 255, f"{path} has no fully opaque pixels"
        alpha = image.getchannel("A")
        assert all(alpha.getpixel(point) == 0 for point in ((0, 0), (255, 0), (0, 255), (255, 255))), path


def test_dock_is_thirteen_image_led_buttons_strip_then_anchored_island():
    nav = nav_markup()
    buttons = re.findall(r"<button\b.*?</button>", nav, re.DOTALL)
    labels = [
        re.search(r'<div class="nav-label">([^<]+)</div>', button).group(1)
        for button in buttons
    ]

    assert len(buttons) == 13
    assert tuple(labels) == EXPECTED_NAV_LABELS
    assert all('class="nav-item' in button for button in buttons)
    assert all(button.count("<img ") == 1 for button in buttons)
    assert "<svg" not in nav.lower()
    assert 'id="gameSideActions"' not in HTML
    assert ".game-side-action" not in HTML


def test_bottom_nav_is_fixed_with_full_touch_targets():
    dock = css_rule(".bottom-nav")
    item = css_rule(".nav-item")
    # fixed-dock-v303: the decks never scroll.
    assert "overflow" not in dock
    assert re.search(r"flex-direction:\s*column", dock)

    basis = re.search(r"flex:\s*0\s+0\s+(\d+)px", item)
    minimum_width = re.search(r"min-width:\s*(\d+)px", item)
    assert basis and int(basis.group(1)) >= 44
    assert minimum_width and int(minimum_width.group(1)) >= 44
    # Item height follows the deck row height, itself a full touch target.
    assert "min-height: var(--dock-row)" in item
    row = re.search(r"--dock-row:\s*(\d+)px", HTML.read_text(encoding="utf-8") if hasattr(HTML, "read_text") else HTML)
    assert row and int(row.group(1)) >= 44


def test_all_eight_new_nav_icons_are_transparent_generated_webps():
    nav = nav_markup()
    for name in NEW_NAV_ART:
        relative = f"assets/ui/burbz-icon-set/{name}.webp"
        assert f'src="{relative}"' in nav, name
        assert_transparent_webp(ROOT / relative)


def test_hospital_shortcut_uses_the_existing_academy_room_for_built_and_unbuilt_states():
    assert "hospital: { label:'BIRD HOSPITAL'" in HTML
    assert 'data-quick-destination="hospital"' in nav_markup()
    shortcut = HTML.split("function openAcademyRoomHudShortcut(room, label)", 1)[1].split(
        "\nfunction openKitchenHudShortcut", 1
    )[0]
    assert "if (!isAcademyRoomBuilt(room))" in shortcut
    assert "academySelectedRoom = room" in shortcut
    assert "academyQuestGuidanceRoom = room" in shortcut
    assert "activateGameHudDestination('academy')" in shortcut
    assert "openAcademyRoom(room)" in shortcut
    assert "activateQuickDockItem(room)" in shortcut
    assert "function openHospitalHudShortcut() { openAcademyRoomHudShortcut('hospital', 'Bird Hospital'); }" in HTML
    assert "document.querySelector('[data-quick-destination=\"hospital\"]')?.addEventListener('click', openHospitalHudShortcut);" in HTML


def test_every_catalogue_gear_item_has_unique_transparent_generated_art():
    gear_ids = loot_gear_ids()
    assert len(gear_ids) == 35
    assert len(set(gear_ids)) == 35

    hashes = {}
    for gear_id in gear_ids:
        path = ROOT / "assets" / "gear" / f"{gear_id}.webp"
        assert_transparent_webp(path)
        digest = hashlib.sha256(path.read_bytes()).hexdigest()
        hashes.setdefault(digest, []).append(gear_id)

    duplicates = [ids for ids in hashes.values() if len(ids) > 1]
    assert not duplicates, f"gear art must be visually authored as unique files: {duplicates}"


def test_generated_gear_art_reaches_stores_forge_equipment_and_battle_with_emoji_fallback():
    helper = HTML.split("function gearIconHTML(item)", 1)[1].split("\n}", 1)[0]
    assert "item && item.icon" in helper
    assert "gear-icon-fallback" in helper
    assert "assets/gear/" in HTML
    assert 'onerror="this.remove()"' in helper

    # Stores ledger and armoury.
    assert '<span class="slr-icon">\' + gearIconHTML(item)' in HTML
    assert '<div class="src-icon">\' + gearIconHTML(item)' in HTML
    # Forge loadout, picker, queue and recipes.
    assert '<div class="fs-icon">\' + (item ? gearIconHTML(item)' in HTML
    assert '<div class="forge-job-icon">\' + gearIconHTML(item)' in HTML
    assert '<div class="fr-icon">\' + gearIconHTML(item)' in HTML
    # Bird equipment and battle spell/potion actions.
    assert '<div class="beq-icon">\' + (item ? gearIconHTML(item)' in HTML
    assert "gearIconHTML(potion)" in HTML
    assert "m.gearId ? gearIconHTML({ id:m.gearId, icon:m.icon })" in HTML
    # Newly won gear must use art in reward sheets too, not flash the old emoji.
    assert "gearId:d.id" in HTML
    assert "l.gearId ? gearIconHTML({ id:l.gearId, icon:l.icon })" in HTML
    assert "walkingStoryRewardEntries(reward)" in HTML
    assert "walkingStoryRewardHTML(summary.story)" in HTML


def test_scroll_dock_keeps_tutorial_and_training_state_visible_and_consistent():
    pointer = HTML.split("function updateMerlinFlowPointer()", 1)[1].split("\n}", 1)[0]
    assert "navItem.scrollIntoView({ block:'nearest', inline:'center' })" in pointer
    assert "Math.max(54, Math.min(window.innerWidth - 54" in pointer

    training = HTML.split("function openTrainingHub()", 1)[1].split(
        "\nfunction trainingHubOpenRoom", 1
    )[0]
    assert "trainingHubPreviousDockItem" in training
    assert "function closeTrainingHub(restoreDock = true)" in training
    assert "document.contains(trainingHubPreviousDockItem)" in training
    assert "closeTrainingHub(false)" in HTML
    assert "if (trainingHub && trainingHub.classList.contains('show')) { closeTrainingHub(); return true; }" in HTML


def test_refreshed_crowbar_tavern_and_kitchen_interiors_are_versioned_and_wired():
    for room, relative in INTERIOR_ART.items():
        path = ROOT / relative
        assert path.is_file(), relative
        with Image.open(path) as image:
            image.load()
            assert image.format == "WEBP", relative
            assert image.size == (1448, 1086), relative
        assert f"{room}: '{relative}'" in HTML


def test_all_new_art_is_offline_cached_and_shipped_by_the_live_updater():
    gear_paths = tuple(f"assets/gear/{gear_id}.webp" for gear_id in loot_gear_ids())
    nav_paths = tuple(f"assets/ui/burbz-icon-set/{name}.webp" for name in NEW_NAV_ART)
    dock_paths = tuple(re.findall(r'<img\b[^>]*\bsrc="([^"]+)"', nav_markup()))
    all_new_paths = nav_paths + gear_paths + tuple(INTERIOR_ART.values())

    for relative in all_new_paths:
        assert f"'./{relative}'" in SW, relative
        assert f'"{relative}"' in UPDATER, relative

    core = js_array_body(SW, "const BURBZ_CORE = [")
    assert len(dock_paths) == len(EXPECTED_NAV_LABELS)
    for relative in dock_paths:
        assert f"'./{relative}'" in core, relative
    for relative in nav_paths:
        assert f"'./{relative}'" in core, relative

    assert "const BURBZ_GENERATED_ART_WARM = BURBZ_ASSETS.filter" in SW
    assert "asset.startsWith('.' + '/assets/gear/')" in SW
    for relative in INTERIOR_ART.values():
        assert f"asset === './{relative}'" in SW
    assert "...BURBZ_GENERATED_ART_WARM" in SW


def test_v298_build_and_cache_are_current_without_reversioning_the_v285_settlement_core():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert RELEASE in cache_line  # this release's own segment stays in the lineage
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    assert f'<script src="settlement_scene_core.js?v={SETTLEMENT_CORE_RELEASE}"></script>' in HTML
    assert f"'./settlement_scene_core.js?v={SETTLEMENT_CORE_RELEASE}'" in SW
