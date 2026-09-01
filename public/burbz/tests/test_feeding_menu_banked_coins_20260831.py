"""The feed sheet's menu columns, banked expedition coins, and quieter dots.

Yaan's asks (2026-08-31), from two phone screenshots:

1. Feed sheet: drop the explainer paragraph and the "Eats:" line. In their
   place, two columns — Primary meals and Secondary meals — each food as its
   icon and its name. And stop highlighting the matching rows in the food
   list: finding the match is the player's own job now.
2. "The money isn't being banked" — he sent four birds after coins and the
   total never moved. Rewards only landed on a manual CLAIM tap, and a board
   that shows ten rows could even hide the button. Now a returned bird banks
   its own rewards on the next heartbeat.
3. The Stores dot is gone (it meant "you could browse here", not "something
   is waiting").
4. The Empire dot also lights when the player can afford a build and nothing
   anywhere is being built.
5. The bottom-right tab loses its dot and is renamed Birds — Burbz names the
   enemy zombie flock, never the player's own companions.

Pinned as `feeding-menu-banked-coins-v337`.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
OWN_RELEASE_PIN = "feeding-menu-banked-coins-v337-20260831"
CURRENT_BUILD = "release-polish-v342-20260901"
PREVIOUS_RELEASE_PIN = "screen-swipe-v336-20260831"


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8",
        capture_output=True, check=False, timeout=60
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def const_source(html: str, name: str) -> str:
    start = html.index(f"const {name} = {{")
    end = html.index("\n};", start)
    return html[start:end + 3]


# ---------------------------------------------------------------------------
# 1. The feed sheet: a menu of columns, not a paragraph of rules
# ---------------------------------------------------------------------------

def test_the_sheet_swaps_its_words_for_the_menu():
    html = html_text()
    sheet = function_source(html, "renderFeedSheet")
    assert "feedDietMenuHTML(entry)" in sheet
    # The circled paragraph and the Eats line are gone from the sheet.
    assert "Tap one food to serve it" not in html
    assert "feed-sheet-eats" not in html
    assert "feed-sheet-hint" not in html
    # Two named columns, primary and secondary.
    menu = function_source(html, "feedDietMenuHTML")
    assert "data-feed-menu-col=\"' + kind + '\"" in menu
    assert "'primary', 'Primary meals'" in menu
    assert "'secondary', 'Secondary meals'" in menu


def test_no_food_row_is_highlighted_or_tagged_any_more():
    html = html_text()
    row = function_source(html, "feedFoodRowHTML")
    assert "known-pref" not in row
    assert "feed-food-tag" not in row
    assert "Side snack" not in row
    # The dead styles left with their markup.
    assert ".feed-food.known-pref" not in html
    assert ".feed-food-tag" not in html
    # The Academy tray keeps its own teaching glow — only the sheet changed.
    assert ".academy-food.known-pref" in html


def test_the_menu_reads_real_diets_and_agrees_with_the_food_list():
    """The menu is scored by the same scorer as the tappable rows, against
    every food in the game, in stock or not. Robin's mainstay is worms;
    Merlin's is small-bird prey, which no pantry food covers, so a larder
    ration stands in for the family."""
    html = html_text()
    src = "\n".join([
        "global.window = global;",
        "const D = require('./bird_diet_hunger_core.js');",
        "const kitchenDietCore = () => D;",
        "const kitchenIngredientById = () => null;",
        "const escapeHtml = s => String(s);",
        const_source(html, "FOODS"),
        function_source(html, "feedOptionVerdict"),
        function_source(html, "kitchenRosterWantedPrep"),
        function_source(html, "feedDietMenuHTML"),
        "const menuFor = target => feedDietMenuHTML({ target });",
        "const cols = htmlStr => htmlStr.split('data-feed-menu-col=\"secondary\"');",
        "const robin = cols(menuFor({ commonName:'European Robin', name:'European Robin' }));",
        "const merlin = cols(menuFor({ target:'merlin', scientificName:'Falco columbarius', commonName:'Merlin', name:'Merlin' }));",
        "console.log(JSON.stringify({",
        "  robinPrimaryWorms: robin[0].includes('Worms'),",
        "  robinInsectsAreSecondary: !robin[0].includes('>Insects<') && robin[1].includes('Insects'),",
        "  merlinPrimaryIsBirdPrey: merlin[0].includes('Small-Bird Prey Ration'),",
        "  merlinNeverOfferedSeeds: !merlin.join('').includes('Seeds'),",
        "}));",
    ])
    out = run_node(src)
    assert out == {
        "robinPrimaryWorms": True,
        "robinInsectsAreSecondary": True,
        "merlinPrimaryIsBirdPrey": True,
        "merlinNeverOfferedSeeds": True,
    }


# ---------------------------------------------------------------------------
# 2. A returned bird banks its own rewards
# ---------------------------------------------------------------------------

def test_the_banker_sweeps_landed_expeditions_only():
    html = html_text()
    src = "\n".join([
        "let gameState = { birdExpeditions: [] };",
        "let bankingReturnedExpeditions = false;",
        "const claimed = [];",
        "function claimBirdExpedition(id, opts) { claimed.push({ id, auto: !!(opts && opts.auto) }); }",
        "function ensureBirdExpeditions() { return gameState.birdExpeditions; }",
        function_source(html, "bankReturnedExpeditions"),
        "gameState.birdExpeditions = [",
        "  { id:'landed', templateId:'find_coins', status:'active', endMs: 500 },",
        "  { id:'still-out', templateId:'find_coins', status:'active', endMs: 5000 },",
        "  { id:'already-claimed', templateId:'find_coins', status:'claimed', endMs: 400 },",
        "  { id:'tutorial', templateId:'merlin_first_flight', status:'active', endMs: 300 },",
        "];",
        "const banked = bankReturnedExpeditions(1000);",
        "console.log(JSON.stringify({ banked, claimed }));",
    ])
    out = run_node(src)
    # One quest landed and was banked as an auto claim; the flying one waits,
    # the claimed one stays claimed, and Merlin's scripted first flight keeps
    # its hand-claimed tutorial moment.
    assert out == {"banked": 1, "claimed": [{"id": "landed", "auto": True}]}


def test_the_banker_rides_the_badge_heartbeat():
    html = html_text()
    beat = function_source(html, "updateActionBadges")
    assert "bankReturnedExpeditions()" in beat
    # The heartbeat already runs on every save, screen switch and 30 s tick,
    # and the moment a short errand's own timer fires.
    assert "setInterval(queueActionBadgeUpdate, 30000)" in html


def test_the_quiet_claim_banks_without_taking_the_screen_over():
    claim = function_source(html_text(), "claimBirdExpedition")
    # Same durable commit for both paths — the auto flag changes ceremony only.
    assert "const auto = !!(opts && opts.auto)" in claim
    assert "addCoins(coins)" in claim
    assert "durableSaveState({ throwOnFailure:true, queueCloud:false })" in claim
    # Watching the quest board? The full landing celebration plays. Anywhere
    # else: one toast, no overlay closed, no quiz popped.
    assert "if (currentScreen === 'quests')" in claim
    assert "— banked.'" in claim
    assert "if (!auto && q.templateId !== 'merlin_first_flight') maybeOpenQuestKnowledgeQuiz(advanced, coins)" in claim
    # The hand-tapped CLAIM keeps its ceremony.
    assert claim.count("playQuestClaimCelebration(") == 2


# ---------------------------------------------------------------------------
# 3 + 4. The dots: Stores dark, Empire lit when money could be building
# ---------------------------------------------------------------------------

def test_the_stores_dot_is_gone():
    html = html_text()
    assert "storesGearWaitingToEquip" not in html
    state = function_source(html, "normalizeActionBadgeState")
    assert "inventory:" not in state.split("return {")[1]


def test_the_empire_dot_lights_for_affordable_builds():
    # polished-ui-notifications-v339 retargeted this suite: the dot no longer
    # waits for the whole realm to stand idle. If a village has a free crew
    # and the chest covers an unlocked build, the dot says so — a scaffold
    # rising elsewhere is no reason to hide work waiting here.
    html = html_text()
    state = function_source(html, "normalizeActionBadgeState")
    assert "affordableBuildsCount = empireAffordableBuilds()" in state
    assert "village: empireCollectCount + affordableBuildsCount + liberationsReadyCount" in state
    src = "\n".join([
        "let villages = [];",
        "let wallet = { coins: 200, branches: 50, stone: 0 };",
        "let gameState = { player: { get coins() { return wallet.coins; }, level: 9 } };",
        "const playerBranches = () => wallet.branches;",
        "const playerStone = () => wallet.stone;",
        "const empireVillages = () => villages;",
        "const villageBuildSlotsFree = rec => rec.slotsFree == null ? 1 : rec.slotsFree;",
        "const EMPIRE_BUILDINGS = [",
        "  { id:'cabin', maxLevel: 3, unlockLevel: 1, cost: { coins: 60, branches: 20, stone: 0 } },",
        "  { id:'keep', maxLevel: 1, unlockLevel: 20, cost: { coins: 10, branches: 0, stone: 0 } },",
        "  { id:'quarry', tier:'town', maxLevel: 3, unlockLevel: 1, cost: { coins: 10, branches: 0, stone: 0 } },",
        "];",
        "const villageBuildingLevel = (rec, id) => (rec.levels && rec.levels[id]) || 0;",
        "const settlementAllowsBuilding = (rec, b) => b.tier !== 'town';",
        "const villageBuildingCost = (b, level) => ({ coins: b.cost.coins * (level + 1), branches: b.cost.branches * (level + 1), stone: (b.cost.stone || 0) * (level + 1) });",
        function_source(html, "empireAffordableBuilds"),
        "const out = {};",
        "villages = [{ seed: 1 }, { seed: 2 }];",
        "out.twoVillagesTwoDots = empireAffordableBuilds();",
        "villages = [{ seed: 1 }, { seed: 2, slotsFree: 0 }];",
        "out.aRisingBuildElsewhereNoLongerHidesIt = empireAffordableBuilds();",
        "wallet = { coins: 10, branches: 0, stone: 0 };",
        "out.tooPoorStaysDark = empireAffordableBuilds();",
        "wallet = { coins: 200, branches: 50, stone: 0 };",
        "villages = [{ seed: 1, levels: { cabin: 3 } }];",
        "out.onlyLockedOrTownWorksLeftStaysDark = empireAffordableBuilds();",
        "villages = [{ seed: 1, slotsFree: 0 }];",
        "out.noFreeCrewStaysDark = empireAffordableBuilds();",
        "villages = [];",
        "out.noVillagesNoDot = empireAffordableBuilds();",
        "console.log(JSON.stringify(out));",
    ])
    out = run_node(src)
    assert out == {
        "twoVillagesTwoDots": 2,
        "aRisingBuildElsewhereNoLongerHidesIt": 1,
        "tooPoorStaysDark": 0,
        "onlyLockedOrTownWorksLeftStaysDark": 0,
        "noFreeCrewStaysDark": 0,
        "noVillagesNoDot": 0,
    }


def test_the_empire_dot_lights_for_a_captured_village_awaiting_its_birdhouse():
    # polished-ui-notifications-v339: a won Liberation Battle records a
    # victory, but the village only joins the empire once its birdhouse is
    # built. While the player can pay for that birdhouse, every captured
    # village still waiting lights the Empire dot.
    html = html_text()
    state = function_source(html, "normalizeActionBadgeState")
    assert "liberationsReadyCount = empireLiberationsReady()" in state
    src = "\n".join([
        "let empire = { liberationVictories: {}, villages: {} };",
        "let wallet = { coins: 100, branches: 30 };",
        "let gameState = { player: { get coins() { return wallet.coins; } } };",
        "const ensureEmpireState = () => empire;",
        "const playerBranches = () => wallet.branches;",
        "const birdhouseCostForNextVillage = () => ({ coins: 60, branches: 15 });",
        function_source(html, "empireLiberationsReady"),
        "const out = {};",
        "out.nothingCapturedNoDot = empireLiberationsReady();",
        "empire.liberationVictories = { '7': { seed: 7 }, '9': { seed: 9 } };",
        "out.twoCapturedVillagesTwoDots = empireLiberationsReady();",
        "empire.villages['7'] = { seed: 7 };",
        "out.aBuiltBirdhouseClearsItsDot = empireLiberationsReady();",
        "wallet = { coins: 59, branches: 30 };",
        "out.coinsShortStaysDark = empireLiberationsReady();",
        "wallet = { coins: 100, branches: 14 };",
        "out.timberShortStaysDark = empireLiberationsReady();",
        "console.log(JSON.stringify(out));",
    ])
    out = run_node(src)
    assert out == {
        "nothingCapturedNoDot": 0,
        "twoCapturedVillagesTwoDots": 2,
        "aBuiltBirdhouseClearsItsDot": 1,
        "coinsShortStaysDark": 0,
        "timberShortStaysDark": 0,
    }


# ---------------------------------------------------------------------------
# 5. The bottom-right tab: no dot, and it is the player's Birds, not Burbz
# ---------------------------------------------------------------------------

def test_the_birds_tab_is_named_for_the_players_own_birds():
    html = html_text()
    assert 'data-game-route data-screen="birdex" aria-label="Birds codex"' in html
    assert '<div class="nav-label">Birds</div>' in html
    # Burbz names the enemy zombie flock; no dock tab wears that name.
    assert '<div class="nav-label">Burbz</div>' not in html
    state = function_source(html, "normalizeActionBadgeState")
    assert "birdex" not in state


# ---------------------------------------------------------------------------
# Release plumbing
# ---------------------------------------------------------------------------

def test_release_pins():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if "const BURBZ_CACHE" in line)
    assert OWN_RELEASE_PIN in cache_line
    assert PREVIOUS_RELEASE_PIN in cache_line  # the lineage is append-only
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
