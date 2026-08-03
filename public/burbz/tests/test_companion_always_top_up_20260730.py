"""Regression for player-chosen companion top-ups at every fullness level."""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
CORE = ROOT / "bird_diet_hunger_core.js"
SW = ROOT / "sw.js"
MARKER = "intro-hardening-v177-20260730-companion-always-top-up-v178-20260730"


def run_node(source: str):
    result = subprocess.run(
        ["node", "-e", source], cwd=ROOT, text=True, capture_output=True, timeout=30
    )
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def test_partial_nearly_full_and_completely_full_companions_accept_a_whole_primary_ingredient():
    out = run_node(
        r"""
const D = require('./bird_diet_hunger_core.js');
const now = 1000;
let state = {
  flock: [59, 1, 0].map((hunger, index) => ({
    id:'finch-' + index,
    species:'European Goldfinch',
    commonName:'European Goldfinch',
    scientificName:'Carduelis carduelis',
    care:{ hunger, happiness:70, lastHungerAt:now, hungerTransactions:[], hungerTransactionLog:[] }
  })),
  merlinCare:{ hunger:0, happiness:80, lastHungerAt:now, hungerTransactions:[], hungerTransactionLog:[] },
  inventory:{ larder:{ sunflower_seeds:3 } },
  pantry:{}
};
const results = [];
for (let index = 0; index < 3; index++) {
  const tx = D.applyFeedingTransaction(
    state,
    { target:'bird', birdId:'finch-' + index, scientificName:'Carduelis carduelis', commonName:'European Goldfinch' },
    { ingredientId:'sunflower_seeds', prep:'husked' },
    { transactionId:'top-up-' + index, now }
  );
  state = tx.state;
  results.push({ ok:tx.ok, duplicate:tx.duplicate, before:tx.before, after:tx.after, consumed:tx.consumed, remaining:state.inventory.larder.sunflower_seeds });
}
console.log(JSON.stringify({ results, state }));
"""
    )
    assert [row["ok"] for row in out["results"]] == [True, True, True]
    assert [row["duplicate"] for row in out["results"]] == [False, False, False]
    assert [row["before"] for row in out["results"]] == [59, 1, 0]
    assert [row["after"] for row in out["results"]] == [0, 0, 0]
    assert [row["remaining"] for row in out["results"]] == [2, 1, 0]
    assert all(row["consumed"] == {"inventory.larder.sunflower_seeds": 1} for row in out["results"])


def test_feeding_core_has_no_fullness_threshold_and_never_makes_a_top_up_hungrier():
    core = CORE.read_text(encoding="utf-8")
    transaction = core[core.index("function applyFeedingTransaction"):core.index("function applyActivityHungerTransaction")]
    assert "subject.care.hunger < FEEDING_HUNGER_MIN" not in transaction
    # Side snacks now add 50 percentage points instead of merely filling up to
    # the halfway mark. Clamping the subtraction keeps a nearly-full bird from
    # becoming hungrier while still allowing an optional whole-ingredient top-up.
    assert "Math.max(0, currentHunger - 50)" in transaction


def test_every_companion_stays_visible_and_feed_controls_stay_actionable_when_full():
    html = HTML.read_text(encoding="utf-8")
    assert "function kitchenRosterEntriesForFeeding()" in html
    assert "const entries = kitchenRosterEntriesForFeeding();" in html
    assert "data-feed-sheet-full" not in html
    assert "(full ? fullNote : (foodRows || empty))" not in html
    assert "disabled>🍽️ Full" not in html
    assert "birdIsFull(bird) ? 'disabled'" not in html
    assert "is completely full — nothing to feed right now" not in html
    assert "Feed at any Fullness" in html
    assert "every accepted serving uses one complete ingredient" in html


def test_v177_application_and_service_worker_markers_match():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    # This release must stay in the service worker's cache lineage...
    assert MARKER in sw
    # ...but BURBZ_BUILD names the NEWEST release, and later ones move it on,
    # so pin only that the build tag is itself a real marker in that lineage.
    # Hardcoding this release's tag here goes red on the very next release.
    build = html.split("const BURBZ_BUILD = '", 1)[1].split("';", 1)[0]
    assert build in sw
