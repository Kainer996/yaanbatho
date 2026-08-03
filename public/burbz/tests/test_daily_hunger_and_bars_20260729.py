"""Daily feeding, deterministic meal fullness, hunger bars, and visible card names."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"


def run_node(source: str) -> dict:
    result = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def function_source(html: str, name: str, next_name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.index(f"\nfunction {next_name}(", start)
    return html[start:end]


def test_two_side_snacks_fill_completely_and_every_accepted_feed_spends_one_ration():
    out = run_node(
        """
const D = require('./bird_diet_hunger_core.js');
const target = { birdId:'goldie', commonName:'European Goldfinch', scientificName:'Carduelis carduelis' };
function state(food, hunger=100, count=2) { return { flock:[{ id:'goldie', commonName:target.commonName, scientificName:target.scientificName, care:{ hunger, lastHungerAt:2000 } }], inventory:{ larder:{ [food]:count } }, pantry:{} }; }
const primary = D.applyFeedingTransaction(state('sunflower_seeds'), target, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'primary', now:2000 });
const firstSide = D.applyFeedingTransaction(state('mealworm_scoop'), target, { ingredientId:'mealworm_scoop', prep:'fresh' }, { transactionId:'side-1', now:2000 });
const secondSide = D.applyFeedingTransaction(firstSide.state, target, { ingredientId:'mealworm_scoop', prep:'fresh' }, { transactionId:'side-2', now:2001 });
const sideFromMostlyFull = D.applyFeedingTransaction(state('mealworm_scoop', 25, 1), target, { ingredientId:'mealworm_scoop', prep:'fresh' }, { transactionId:'side-mostly-full', now:2000 });
const primaryFromHalf = D.applyFeedingTransaction(state('sunflower_seeds', 50, 1), target, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'primary-half', now:2000 });
const primaryFromFull = D.applyFeedingTransaction(state('sunflower_seeds', 0, 1), target, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'primary-full', now:2000 });
console.log(JSON.stringify({
  primary:{ ok:primary.ok, after:primary.after, left:primary.state.inventory.larder.sunflower_seeds },
  firstSide:{ ok:firstSide.ok, after:firstSide.after, left:firstSide.state.inventory.larder.mealworm_scoop },
  secondSide:{ ok:secondSide.ok, after:secondSide.after, left:secondSide.state.inventory.larder.mealworm_scoop },
  sideFromMostlyFull:{ ok:sideFromMostlyFull.ok, after:sideFromMostlyFull.after, left:sideFromMostlyFull.state.inventory.larder.mealworm_scoop },
  primaryFromHalf:{ ok:primaryFromHalf.ok, after:primaryFromHalf.after, left:primaryFromHalf.state.inventory.larder.sunflower_seeds },
  primaryFromFull:{ ok:primaryFromFull.ok, after:primaryFromFull.after, left:primaryFromFull.state.inventory.larder.sunflower_seeds }
}));
"""
    )
    assert out["primary"] == {"ok": True, "after": 0, "left": 1}
    assert out["firstSide"] == {"ok": True, "after": 50, "left": 1}
    assert out["secondSide"] == {"ok": True, "after": 0, "left": 0}
    assert out["sideFromMostlyFull"] == {"ok": True, "after": 0, "left": 0}
    assert out["primaryFromHalf"] == {"ok": True, "after": 0, "left": 0}
    assert out["primaryFromFull"] == {"ok": True, "after": 0, "left": 0}


def test_feed_sheet_explains_stackable_side_snacks_and_full_ration_spend():
    html = INDEX.read_text(encoding="utf-8")
    sheet = function_source(html, "renderFeedSheet", "feedFlyBirdToFood")
    explainer = function_source(html, "feedSideSnackExplainer", "feedEntryForKey")
    assert "adds 50 percentage points of Fullness" in sheet
    assert "two side snacks fill an empty bar" in sheet
    assert "every accepted serving uses one complete ingredient" in sheet
    assert "adds 50 percentage points to the Fullness bar" in explainer
    assert "fills up to halfway" not in sheet


def test_fullness_drains_evenly_over_one_day_and_activity_does_not_create_extra_meals():
    out = run_node(
        """
const D = require('./bird_diet_hunger_core.js');
const start = 1_000_000;
const halfDay = 12 * 60 * 60 * 1000;
const fullDay = 24 * 60 * 60 * 1000;
const care = { hunger:0, lastHungerAt:start };
const half = D.hungerStatusForCare(care, start + halfDay);
const empty = D.hungerStatusForCare(care, start + fullDay);
let state = { flock:[{ id:'b1', commonName:'Robin', care }], inventory:{larder:{}}, pantry:{} };
const active = D.applyActivityHungerTransaction(state, { birdId:'b1', activityType:'expedition', activityId:'q1', delta:12, now:start + halfDay });
const browserAdapter = D.applyHungerDeltaToCare(care, { activityType:'expedition', activityId:'q2', delta:12, now:start + halfDay });
console.log(JSON.stringify({ half:half.hunger, empty:empty.hunger, afterActivity:active.after, browserActivity:browserAdapter.after, dailyMs:D.DAILY_HUNGER_MS }));
"""
    )
    assert out == {"half": 50, "empty": 100, "afterActivity": 50, "browserActivity": 50, "dailyMs": 86400000}


def test_merlin_primary_ration_also_fills_him_for_a_day():
    out = run_node(
        """
const M = require('./merlin_companion_core.js');
const start = 2_000_000;
const fed = M.applyMerlinCareAction({ hunger:95, lastHungerAt:start }, { small_bird_prey_ration:1 }, 'feed', start + 1000);
const halfDay = M.tickMerlinCare(fed.state, 720, start + 1000 + 12 * 60 * 60 * 1000);
const earlyTopUp = M.applyMerlinCareAction(halfDay, { small_bird_prey_ration:1 }, 'feed', start + 1000 + 12 * 60 * 60 * 1000);
console.log(JSON.stringify({ ok:fed.ok, fed:fed.state.hunger, halfDay:halfDay.hunger, earlyTopUp:earlyTopUp.ok, stock:earlyTopUp.pantry.small_bird_prey_ration }));
"""
    )
    assert out == {"ok": True, "fed": 0, "halfDay": 50, "earlyTopUp": False, "stock": 1}


def test_birdex_companion_cards_keep_names_visible_and_show_a_fullness_bar():
    html = INDEX.read_text(encoding="utf-8")
    card = function_source(html, "createBirdCardHTML", "createKnownSpeciesCardHTML")
    assert ".companions-grid .card-name,\n.companions-grid .card-species { flex:0 0 auto; line-height:1.2; }" in html
    assert ".bird-grid.companions-grid .bird-card,\n.bird-grid.companions-grid .bird-card-inner { min-height:540px; }" in html
    assert "hungerBarHTML(hungerStatus, 'companion-card')" in card
    assert "Hunger: ${escapeHtml(hungerStatus.label)}" not in card


def test_hunger_bar_is_green_when_full_and_red_when_empty():
    html = INDEX.read_text(encoding="utf-8")
    source = function_source(html, "hungerBarHTML", "birdIsFull")
    assert "const fullness = clamp(100 - hunger" in source
    assert "hsl(' + Math.round(fullness * 1.2) + ' 72% 44%)" in source
    assert 'aria-label="Fullness ' in source
    assert 'data-fullness="' in source
    assert ".bird-hunger-fill { height:100%; min-width:4px;" in html


def test_battle_cards_show_fullness_separately_from_health():
    html = INDEX.read_text(encoding="utf-8")
    battle = function_source(html, "renderBattleSelect", "battlePickToggle")
    assert "const fullnessPct = Math.round(clamp(100 - readiness.status.hunger" in battle
    assert 'data-fullness="' in battle
    assert "<span>HP</span>" in battle
    assert "<span>Full</span>" in battle
    assert "width:' + fullnessPct + '%" in battle
    assert ".pick-card .pk-meter-row" in html


def test_current_diet_and_hunger_release_is_query_busted_and_precached():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    versions = {
        "bird_diet_hunger_core.js": "real-walk-nearby-quests-v215-20260803",
        "merlin_companion_core.js": "reconciled-release-v170-20260729",
    }
    assert "two-side-snacks-v205-20260803" in sw
    for asset, marker in versions.items():
        versioned = f"{asset}?v={marker}"
        assert versioned in html
        assert f"'./{versioned}'" in sw
