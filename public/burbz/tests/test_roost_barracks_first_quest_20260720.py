"""Fresh-player Academy onboarding: Roost + Barracks, recruit, first quest."""
import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
CORE_PATH = ROOT / "academy_treehouse_core.js"
ECONOMY_PATH = ROOT / "scan_economy_core.js"
SW_PATH = ROOT / "sw.js"


def _node_json(source: str):
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def _required_int(pattern: str, text: str) -> int:
    match = re.search(pattern, text)
    assert match, pattern
    return int(match.group(1))


def test_roost_and_barracks_unlock_together_at_level_one():
    rooms = _node_json(
        "const core=require('./academy_treehouse_core.js');"
        "console.log(JSON.stringify(core.getAcademyRooms()));"
    )
    by_id = {room["id"]: room for room in rooms}
    assert by_id["dorm"]["unlockLevel"] == 1
    assert by_id["tavern"]["unlockLevel"] == 1


def test_fresh_resources_cover_both_buildings_and_one_common_recruit():
    html = HTML_PATH.read_text(encoding="utf-8")
    rooms = _node_json(
        "const core=require('./academy_treehouse_core.js');"
        "console.log(JSON.stringify(core.getAcademyRooms()));"
    )
    by_id = {room["id"]: room for room in rooms}
    common_base = _node_json(
        "const economy=require('./scan_economy_core.js');"
        "console.log(JSON.stringify(economy.RARITY_BASE.common));"
    )
    starting_coins = _required_int(r"player: \{ name: 'Bird Trainer'.*?coins: (\d+)", html)
    # Keep a real recruitment reserve, not merely the theoretical common base:
    # generated bird power/stats can make an ordinary Robin cost about 70 coins.
    required_coins = by_id["dorm"]["cost"] + by_id["tavern"]["cost"] + max(common_base, 100)
    assert starting_coins >= required_coins, (starting_coins, required_coins)

    bundles = _required_int(r"const STARTER_TIMBER_BUNDLES = (\d+);", html)
    per_bundle = _required_int(r"const STARTER_TIMBER_PER_BUNDLE = (\d+);", html)
    required_timber = by_id["dorm"]["branches"] + by_id["tavern"]["branches"]
    assert bundles * per_bundle >= required_timber, (bundles * per_bundle, required_timber)


def test_starter_timber_stays_until_roost_and_barracks_are_built():
    html = HTML_PATH.read_text(encoding="utf-8")
    start = html.index("function starterTimberDone()")
    body = html[start:html.index("\nfunction starterTimberPickupsNear", start)]
    assert "isAcademyBuildingBuilt('dorm') && isAcademyBuildingBuilt('tavern')" in body


def test_tutorial_states_the_recruit_then_send_one_bird_sequence():
    html = HTML_PATH.read_text(encoding="utf-8")
    start = html.index("const MERLIN_TUTORIAL_STEPS = [")
    end = html.index("\n];", start)
    tutorial = html[start:end].lower()
    required = (
        "the roost and barracks unlock together",
        "recruit one",
        "send one bird on one starter quest",
        "quest roost",
        "longer journeys",
    )
    assert all(marker in tutorial for marker in required), [m for m in required if m not in tutorial]


def test_existing_tutorial_progress_replays_only_academy_and_quests():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "const BURBZ_TUTORIAL_VERSION = 'merlin-gradual-chapters-v4-20260720'" in html
    assert "const BURBZ_PREVIOUS_TUTORIAL_VERSION = 'merlin-gradual-chapters-v3-20260720'" in html
    migration = html[
        html.index("function migratePreviousMerlinTutorialProgress()") :
        html.index("function merlinChaptersSeen()")
    ]
    assert "id !== 'academy' && id !== 'quests'" in migration
    assert "previousGiftKey" in migration and "BURBZ_TUTORIAL_GIFT_KEY" in migration


def test_existing_v4_saves_receive_the_missing_opening_budget_once():
    html = HTML_PATH.read_text(encoding="utf-8")
    assert "academyBuilderVersion: 5" in html

    load = html[html.index("function loadState()") : html.index("function saveState()")]
    assert "const academyBuilderVersionBeforeDefaults = Number(gameState.academyBuilderVersion) || 0" in load
    assert "academyBuilderVersionBeforeDefaults < 5" in load
    assert "gameState.academyBuilderVersion = academyBuilderVersionBeforeDefaults" in load

    migration = html[
        html.index("function ensureAcademyBuildings(") :
        html.index("function academyBuildBuilding(")
    ]
    assert "const openingBuildingIds = ['dorm', 'tavern']" in migration
    assert "const recruitmentReserve = isAcademyBuildingBuilt('tavern') ? 0 : 100" in migration
    assert "constructionCoins + recruitmentReserve" in migration
    assert "gameState.academyBuilderVersion = 5" in migration


def test_onboarding_release_is_query_busted_and_offline():
    html = HTML_PATH.read_text(encoding="utf-8")
    sw = SW_PATH.read_text(encoding="utf-8")
    version = "roost-barracks-onboarding-20260720"
    assert f'academy_treehouse_core.js?v={version}' in html
    assert f"./academy_treehouse_core.js?v={version}" in sw
    assert "burbz-skyrim-settlements-v96-20260720" in sw
