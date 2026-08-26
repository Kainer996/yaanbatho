import json
import subprocess
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
OWN_RELEASE_PIN = "empire-clarity-v205-20260803"
CURRENT_BUILD = "quiet-arena-v331-20260826"


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def function_slice(html: str, name: str, next_name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.index(f"\nfunction {next_name}(", start)
    return html[start:end]


def test_tap_cards_escape_content_and_both_village_hit_targets_share_them():
    html = html_text()
    card = function_slice(html, "showEmpireMapCard", "showEmpireVillageMapCard")
    assert "escapeHtml(f)" in card
    assert "escapeHtml(info.crest" in card
    assert "escapeHtml(a.label" in card
    assert html.count("showEmpireVillageMapCard(village);") == 2


def test_the_strongbox_shows_what_is_banked_instead_of_a_countdown():
    """empire-declutter-v317 retired the whole countdown.

    Tribute has accrued continuously since village-work-huts-v311, so the
    chest is never "not ready yet" — it holds whatever has built up, and the
    player takes it whenever they like. The clock, the timer that drove it and
    the two helpers that fed it are all gone.
    """
    html = html_text()
    # The clock, its timer and both helpers that fed it are gone for good.
    for retired in ("empireCycleCountdownMs", "empireNextTributeCountdownMs",
                    "empireTributeCountdownTimer", "ensureEmpireTributeCountdownTicker",
                    "data-empire-tribute-countdown", "FULL CYCLE IN"):
        assert retired not in html, retired
    render = function_slice(html, "renderEmpirePanel", "openEmpireRegion")
    assert "empireTakingsSoFar(due)" in render
    assert "COLLECT TAXES &amp; PRODUCE" in render
    # The Empire chest never lectures the player about waiting. (The County
    # Hall and the Royal Stores keep their own chests and their own wording.)
    assert "NOTHING BANKED YET" not in render


def test_takings_read_zero_rather_than_blank_on_a_fresh_cycle():
    """A just-emptied chest is worth nothing yet, and says so as a number."""
    html = html_text()
    helper = function_slice(html, "empireTakingsSoFar", "tributeHasAnything")
    summary = function_slice(html, "empireResourceSummary", "notePaidTribute")
    script = f"""
function lootCore() {{ throw new Error('no core'); }}
function kitchenIngredientById() {{ return null; }}
{summary}
{helper}
console.log(JSON.stringify([
  empireTakingsSoFar({{coins:0, branches:0, stone:0, materials:{{}}, larder:{{}}}}),
  empireTakingsSoFar({{coins:8, branches:2, stone:0, materials:{{}}, larder:{{}}}}),
  empireTakingsSoFar(null)
]));
"""
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == ["+0 \U0001fa99", "+8 \U0001fa99 +2 \U0001fab5", "+0 \U0001fa99"]


def test_programmatic_map_focus_dismisses_stale_cards_and_the_key():
    html = html_text()
    pairs = [
        ("frameEmpirePlayer", "frameEmpireTerritory"),
        ("frameEmpireTerritory", "showEmpireWorld"),
        ("showEmpireWorld", "focusEmpireVillage"),
        ("focusEmpireVillage", "frameEmpireRegion"),
        ("frameEmpireRegion", "frameEmpireSettlement"),
        ("frameEmpireSettlement", "refreshEmpireMap"),
    ]
    for name, next_name in pairs:
        body = function_slice(html, name, next_name)
        assert "hideEmpireMapCard();" in body, name
        assert "hideEmpireMapKey();" in body, name


def test_final_release_pin_is_consistent_and_the_provisional_pin_is_gone():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}'" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = "))
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    provisional_pin = "empire-clarity-v" + "204-20260803"
    assert provisional_pin not in html
    assert provisional_pin not in sw
