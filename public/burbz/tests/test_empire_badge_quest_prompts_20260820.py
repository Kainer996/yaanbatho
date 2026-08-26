"""Two asks from Yaan, one release (empire-badge-quest-prompts-v289):

1. **The Empire tab tells you when taxes wait.** The bottom nav's Empire
   button now carries the shared red action badge whenever any strongbox in
   the realm holds a full 8-hour cycle — settlements, lone villages or
   caravan routes. New `empireCollectiblesWaiting` feeds the action-badge
   heartbeat through `normalizeActionBadgeState`'s `village` count, so the
   badge appears when a collection would pay and leaves when it is taken.

2. **A build you can't afford offers the fix.** Failing a build on coins or
   timber no longer ends in a toast: a small card says what is missing and
   offers "SEND BIRDS OUT ON A QUEST". Taking it opens the quest board with
   the right drawer — Coin & Treasure for coins, Timber & Building for
   timber — open, scrolled to and glowing. Unaffordable build buttons in
   the province panel and Town networks stay tappable so the prompt can
   actually appear.
"""

from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
ACADEMY_CORE = ROOT / "academy_treehouse_core.js"
BADGE_CORE = ROOT / "action_badge_core.js"
OWN_RELEASE_PIN = "empire-badge-quest-prompts-v289-20260820"
CURRENT_BUILD = "field-any-bird-v330-20260826"


def run_node(source: str):
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        encoding="utf-8",
        capture_output=True,
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(source: str, name: str) -> str:
    start = source.index(f"function {name}(")
    end = source.find("\nfunction ", start + 10)
    if end == -1:
        end = len(source)
    return source[start:end]


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


# ---------------------------------------------------------------------------
# Release wiring
# ---------------------------------------------------------------------------

def test_release_is_wired():
    html = html_text()
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}'" in html
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(line for line in sw.splitlines() if "BURBZ_CACHE" in line and "=" in line)
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment


# ---------------------------------------------------------------------------
# 1. Empire collect badge on the bottom nav
# ---------------------------------------------------------------------------

def test_bottom_nav_has_an_empire_tab_the_badge_walker_reaches():
    html = html_text()
    dock = html[html.index('<div class="bottom-dock"'):html.index("</nav>")] + html[html.index('bottom-dock-anchor'):html.index('tutorialNavPointer')]
    assert 'data-game-route data-screen="village"' in dock  # the Empire tab, islanded beside Scan
    # The shared badge core walks every [data-game-route][data-screen] item
    # and knows the village screen, so the Empire tab can carry a count.
    assert "'village'" in BADGE_CORE.read_text(encoding="utf-8")


def test_collectibles_counter_covers_every_strongbox():
    src = function_source(html_text(), "empireCollectiblesWaiting")
    assert "townHasAccruedTribute(settlement, now)" in src  # merged settlements
    assert "Math.floor(empireVillageTributePeriods(v, now)) > 0" in src  # lone villages, WHOLE cycles only
    assert "Math.floor(empireTradeRoutePeriods(rec, now)) > 0" in src  # caravans, WHOLE cycles


def test_badge_heartbeat_carries_the_empire_count():
    src = function_source(html_text(), "normalizeActionBadgeState")
    assert "empireCollectiblesWaiting" in src
    assert "village: empireCollectCount" in src


def test_badge_core_passes_the_village_count_through():
    counts = run_node(
        f"""
const core = require({json.dumps(str(BADGE_CORE))});
process.stdout.write(JSON.stringify([
  core.computeActionBadgeCounts({{ village: 3 }}).village,
  core.computeActionBadgeCounts({{}}).village,
  core.computeActionBadgeCounts({{ village: -2 }}).village,
]));
"""
    )
    assert counts == [3, 0, 0]


# ---------------------------------------------------------------------------
# 2. The shortfall prompt: "Send birds out on a quest"
# ---------------------------------------------------------------------------

def test_prompt_routes_map_each_resource_to_its_drawer():
    html = html_text()
    routes = html[html.index("const RESOURCE_QUEST_ROUTES"):html.index("};", html.index("const RESOURCE_QUEST_ROUTES"))]
    assert "category:'treasure'" in routes  # coins → Coin & Treasure
    assert "category:'timber'" in routes  # branches → Timber & Building


def test_both_target_drawers_exist_and_hold_a_starter_errand():
    result = run_node(
        f"""
const core = require({json.dumps(str(ACADEMY_CORE))});
const categories = core.getQuestCategories().map(c => c.id);
const templates = core.getQuestTemplates().filter(t => t.tutorial !== true);
const starter = id => templates.some(t => (t.category || 'treasure') === id && t.starter === true);
process.stdout.write(JSON.stringify({{
  categories,
  treasureStarter: starter('treasure'),
  timberStarter: starter('timber'),
}}));
"""
    )
    # A fresh player without the Quest Roost can always take the offered quest.
    assert "treasure" in result["categories"]
    assert "timber" in result["categories"]
    assert result["treasureStarter"] is True
    assert result["timberStarter"] is True


def test_prompt_card_offers_the_quest_and_a_way_out():
    src = function_source(html_text(), "showResourceQuestPrompt")
    assert "SEND BIRDS OUT ON A QUEST" in src
    assert "NOT NOW" in src
    assert "openQuestBoardCategory(route.category)" in src
    assert "escapeHtml(goal)" in src  # settlement names are player-adjacent text


def test_taking_the_prompt_opens_and_spotlights_the_drawer():
    src = function_source(html_text(), "openQuestBoardCategory")
    assert "setQuestCategoryOpen(categoryId, true)" in src
    assert "switchScreen('quests')" in src
    assert "drawer.open = true" in src
    assert "classList.add('spotlit')" in src
    assert "scrollIntoView" in src


def test_prompt_and_spotlight_styles_exist():
    html = html_text()
    assert ".resource-quest-overlay {" in html
    assert ".resource-quest-go {" in html
    assert ".quest-category.spotlit {" in html
    assert "@keyframes questCategorySpotlight" in html
    # Reduced motion keeps the pointer without the pulse.
    assert re.search(r"prefers-reduced-motion:reduce.*\.quest-category\.spotlit", html)
    assert re.search(r"prefers-reduced-motion:reduce.*\.resource-quest-card", html)


def test_every_coin_and_timber_build_gate_offers_the_prompt():
    html = html_text()
    for fn, kinds in {
        "academyBuildBuilding": ("coins", "branches"),
        "academyStartPlaceBuilding": ("coins", "branches"),
        "empireOpenTradeRoute": ("coins", "branches"),
        "empireBuildStructure": ("coins", "branches"),
        "empireSendSupplyCart": ("coins",),
        "claimCurrentVillage": ("coins", "branches"),
    }.items():
        src = function_source(html, fn)
        for kind in kinds:
            assert f"showResourceQuestPrompt('{kind}'" in src, (fn, kind)
    # Stone has no errand — quarries make it — so that gate keeps its toast
    # (v299 reworded it: quarries are town works now).
    build = function_source(html, "empireBuildStructure")
    assert "Miners" in build and "Quarry once your villages merge" in build


def test_short_build_buttons_stay_tappable():
    html = html_text()
    # Province construction yard: shortfall dims the button, never disables it.
    province = function_source(html, "renderVillageManagePanel")
    assert "province-build-btn' + (busyElsewhere ? ' busy' : '') + (affordable ? '' : ' short')" in province
    assert "(affordable ? '' : ' disabled')" not in province
    # Town networks: only a missing target or busy builders disable the button.
    town = function_source(html, "renderTownScreen")
    assert "(tappable ? '' : ' disabled')" in town
    assert ".town-action.short {" in html
    assert ".province-build-btn.short {" in html
