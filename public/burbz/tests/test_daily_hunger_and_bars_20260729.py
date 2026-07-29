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


def test_primary_meal_fills_completely_and_secondary_meal_fills_halfway():
    out = run_node(
        """
const D = require('./bird_diet_hunger_core.js');
const target = { birdId:'goldie', commonName:'European Goldfinch', scientificName:'Carduelis carduelis' };
function state(food) { return { flock:[{ id:'goldie', commonName:target.commonName, scientificName:target.scientificName, care:{ hunger:95, lastHungerAt:1000 } }], inventory:{ larder:{ [food]:1 } }, pantry:{} }; }
const primary = D.applyFeedingTransaction(state('sunflower_seeds'), target, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'primary', now:2000 });
const secondary = D.applyFeedingTransaction(state('mealworm_scoop'), target, { ingredientId:'mealworm_scoop', prep:'fresh' }, { transactionId:'secondary', now:2000 });
primary.state.inventory.larder.sunflower_seeds = 1;
const earlyTopUp = D.applyFeedingTransaction(primary.state, target, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'primary-too-soon', now:2000 + 12 * 60 * 60 * 1000 });
earlyTopUp.state.inventory.larder.sunflower_seeds = 1;
const nextDay = D.applyFeedingTransaction(earlyTopUp.state, target, { ingredientId:'sunflower_seeds', prep:'husked' }, { transactionId:'primary-next-day', now:2000 + 24 * 60 * 60 * 1000 + 1 });
console.log(JSON.stringify({ primary:{ ok:primary.ok, verdict:primary.compatibility.verdict, after:primary.after }, secondary:{ ok:secondary.ok, verdict:secondary.compatibility.verdict, after:secondary.after }, earlyTopUp:{ ok:earlyTopUp.ok, stock:earlyTopUp.state.inventory.larder.sunflower_seeds }, nextDay:{ ok:nextDay.ok, after:nextDay.after } }));
"""
    )
    assert out["primary"] == {"ok": True, "verdict": "primary", "after": 0}
    assert out["secondary"] == {"ok": True, "verdict": "secondary", "after": 50}
    assert out["earlyTopUp"] == {"ok": False, "stock": 1}
    assert out["nextDay"] == {"ok": True, "after": 0}


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


def test_current_diet_and_hunger_release_is_query_busted_and_precached():
    marker = "reconciled-release-v170-20260729"
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert marker in sw
    for asset in ("bird_diet_hunger_core.js", "merlin_companion_core.js"):
        versioned = f"{asset}?v={marker}"
        assert versioned in html
        assert f"'./{versioned}'" in sw
