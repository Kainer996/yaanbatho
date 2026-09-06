"""The dots tell the truth and the chrome grows up. `polished-ui-notifications-v339`.

Yaan's asks (2026-09-01):

1. The red notifications weren't right. The Empire dot now lights whenever a
   village with a free crew can afford an unlocked build — a scaffold rising
   elsewhere no longer silences it — and it also lights when a captured
   village (Liberation Battle won, birdhouse unbuilt) is payable. The Forge
   dot's two halves (craftable now + ready to collect) are pinned by the
   v312 suite and re-proven in browser evidence.

2. Make the game look beautiful and professional. This release is a polish
   pass over the whole UI: legible dock labels and badges that pop once and
   stand still, toasts above every sheet and dressed in the house gold, the
   off-palette blue GO and orange CLAIM buttons brought onto the gold ramp,
   quest cards on one shared edge, the Empire micro-type raised past the
   legibility floor, disabled buttons that dim their chrome but not their
   information, and one focus ring for every control.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
OWN_RELEASE_PIN = "polished-ui-notifications-v339-20260901"
CURRENT_BUILD = "woodland-ui-polish-v352-20260906"
PREVIOUS_RELEASE_PIN = "gentle-start-v338-20260831"


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


# ---------------------------------------------------------------------------
# 1. The Empire dot: builds you can start, captures you can finish
# ---------------------------------------------------------------------------

def test_a_build_rising_elsewhere_no_longer_hides_waiting_work():
    """The v337 rule went dark the moment ANYTHING was rising anywhere in the
    realm. The rule now is Yaan's: if you can build, the dot says so."""
    src = function_source(html_text(), "empireAffordableBuilds")
    assert "villageConstructions" not in src   # the global gate is gone
    assert "hallConstruction" not in src
    assert "villageBuildSlotsFree(rec) <= 0" in src  # a busy village still skips


def test_the_captured_village_count_feeds_the_empire_dot():
    html = html_text()
    state = function_source(html, "normalizeActionBadgeState")
    assert "liberationsReadyCount = empireLiberationsReady()" in state
    assert "affordableBuildsCount = empireAffordableBuilds()" in state
    assert "village: empireCollectCount + affordableBuildsCount + liberationsReadyCount" in state
    lib = function_source(html, "empireLiberationsReady")
    # A victory without a birdhouse is a capture still waiting; owned villages
    # never count, and an unpayable birdhouse keeps the dot honest.
    assert "liberationVictories" in lib
    assert "!empire.villages[key]" in lib
    assert "birdhouseCostForNextVillage()" in lib


# ---------------------------------------------------------------------------
# 2. The dots themselves: one pop, then stillness
# ---------------------------------------------------------------------------

def test_the_badge_pops_once_and_stands_still():
    html = html_text()
    badge = next(line for line in html.splitlines() if line.startswith(".nav-action-badge {"))
    assert "navBadgeIn" in badge                  # one-shot entrance
    assert "infinite" not in badge                # no perpetual pulse
    assert "font-variant-numeric:tabular-nums" in badge
    # The plain tutorial dot yields to the numbered badge on the same tab.
    assert ".nav-item.has-action.tutorial-alert::after { display:none; }" in html


def test_the_tutorial_dot_still_pulses_alone():
    html = html_text()
    alert = next(line for line in html.splitlines() if line.startswith(".nav-item.tutorial-alert::after"))
    assert "navActionPulse" in alert


# ---------------------------------------------------------------------------
# 3. The chrome: what the polish pass pinned down
# ---------------------------------------------------------------------------

def test_toasts_stand_above_every_gameplay_sheet():
    html = html_text()
    container = next(line for line in html.splitlines() if line.startswith(".toast-container {"))
    assert "z-index: 1600" in container


def test_every_screen_has_a_real_background():
    """`--bg0` was never defined, so every screen was transparent and content
    could bleed through mid-swipe."""
    html = html_text()
    assert "background: var(--bg0)" not in html


def test_dock_labels_cleared_the_legibility_floor():
    html = html_text()
    label = html[html.index(".nav-label {"):]
    label = label[:label.index("}")]
    assert "font-size: 9px" in label


def test_the_gold_ramp_replaced_the_foreign_colours():
    html = html_text()
    # The blue GO, the orange CLAIM and the silver-grey CTA fades are gone.
    assert "#4dabf7" not in html
    assert "#f59f00" not in html
    assert "var(--accent),var(--accent2))" not in html
    assert "var(--accent), var(--accent2))" not in html
    # A plain quest-claim-btn stands still; only a real claim (.pulse) throbs.
    claim = html[html.index(".quest-claim-btn {"):]
    claim = claim[:claim.index("}")]
    assert "animation" not in claim
    assert ".quest-claim-btn.pulse { animation:claimPulse" in html


def test_one_focus_ring_serves_every_control():
    html = html_text()
    assert ":where(button, a, [tabindex], summary, input, select):focus-visible" in html
    # The two rules the empire map suite pins stay verbatim.
    assert ".empire-map-btn:focus-visible, .empire-map-marker:focus-visible" in html


def test_finished_walks_sit_quietly_under_the_live_board():
    html = html_text()
    assert "wq.history.slice(0, 6)" in html
    assert "quest-card is-history" in html
    assert ".quest-card.is-history" in html


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
