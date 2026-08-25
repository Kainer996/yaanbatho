"""The Empire screen and the village desk, stripped back to what you act on.

Yaan's asks (2026-08-24), pinned as `empire-village-declutter-v317-20260824`,
from two screenshots.

On the Empire screen:

1. The tax chest said "NOTHING BANKED YET — FULL CYCLE IN 7h 56m". Show what
   is accumulated at that point, for the player to collect.
2. Don't show the COUNTIES or TOWNS tabs until the player has one.
3. Remove FIND YOURSELF and HOW YOUR EMPIRE WORKS.

On the village desk:

4. Drop the "MANAGE VILLAGE · SALTMERE" wording — keep the three readings.
5. Remove the merge-star section.
6. Remove the "No trades found yet" line.
7. Remove the SEND A SUPPLY CART button.
8. Remove the Construction Yard heading.
9. Remove the explanation text from every building card.

The rule running through all nine: a line that only describes is a line the
player scrolls past. Every mechanic here is untouched — merge stars are still
earned, trades still hide until walked, supply carts still exist, crews still
gate builds. Only the narration went.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "empire-village-declutter-v317-20260824"
# The head of the line, which later releases move.
CURRENT_BUILD = "art-same-origin-v325-20260825"
PREVIOUS_RELEASE_PIN = "magpie-market-v316-20260824"


def html_text() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


def function_source(html: str, name: str) -> str:
    start = html.index("function %s(" % name)
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def empire_panel() -> str:
    return function_source(html_text(), "renderEmpirePanel")


def village_desk() -> str:
    return function_source(html_text(), "renderVillageManagePanel")


def run_node(source: str):
    r = subprocess.run(["node", "-e", source], cwd=ROOT, text=True, encoding="utf-8",
                       capture_output=True, check=False, timeout=60)
    assert r.returncode == 0, r.stderr
    return json.loads(r.stdout)


# ---------------------------------------------------------------------------
# 1. The tax chest holds a number, not a countdown
# ---------------------------------------------------------------------------

def test_the_chest_always_reads_what_is_banked_right_now():
    panel = empire_panel()
    assert "empireTakingsSoFar(due)" in panel
    assert "COLLECT TAXES &amp; PRODUCE" in panel
    # No branch on hasTribute for the WORDING any more: the label is the same
    # sentence whatever the amount. hasTribute only decides `disabled`.
    assert "NOTHING BANKED YET" not in panel
    assert "FULL CYCLE IN" not in panel
    assert panel.count("empire-tribute-btn") == 1


def test_a_chest_with_nothing_in_it_is_still_honest_and_still_disabled():
    html = html_text()
    helper = function_source(html, "empireTakingsSoFar")
    summary = function_source(html, "empireResourceSummary")
    out = run_node("""
function lootCore() { throw new Error('no core'); }
function kitchenIngredientById() { return null; }
%s
%s
console.log(JSON.stringify({
  empty: empireTakingsSoFar({coins:0, branches:0, stone:0, materials:{}, larder:{}}),
  earning: empireTakingsSoFar({coins:8, branches:2, stone:0, materials:{}, larder:{}}),
  missing: empireTakingsSoFar(null)
}));
""" % (summary, helper))
    # A just-emptied chest reads as a number, not as a lecture with a clock.
    assert out["empty"] == "+0 🪙"
    assert out["missing"] == "+0 🪙"
    assert out["earning"] == "+8 🪙 +2 🪵"
    # The button is still disabled while there is nothing to take.
    assert "(hasTribute ? '' : ' disabled')" in empire_panel()


def test_the_whole_countdown_apparatus_is_gone():
    """Tribute accrues continuously (v311), so nothing waits for a cycle."""
    html = html_text()
    for retired in ("empireCycleCountdownMs", "empireNextTributeCountdownMs",
                    "empireTributeCountdownTimer", "ensureEmpireTributeCountdownTicker",
                    "stopEmpireTributeCountdownTicker", "data-empire-tribute-countdown"):
        assert retired not in html, retired


# ---------------------------------------------------------------------------
# 2. Tabs you have not earned do not appear
# ---------------------------------------------------------------------------

def test_counties_and_towns_wait_until_the_player_has_one():
    # empire-grid-v322-20260825 turned the tabs into tiers of squares; the
    # gate Yaan asked for here is unchanged, and counties gained one honest
    # exception — a ready merge brings the tier back, because the MERGE INTO
    # ONE COUNTY banner lives inside it.
    panel = empire_panel()
    tabs = panel[panel.index("const tiersHtml"):panel.index("panel.innerHTML")]
    assert "(showCounties ? empireTierHTML('tier-counties'" in tabs
    assert "(townCount ? empireTierHTML('tier-towns'" in tabs
    assert "const showCounties = !!(regions.length || regionCandidates.length);" in panel
    # Villages is unconditional — it is where every empire starts.
    village_tier = tabs[tabs.index("'tier-villages'") - 40:tabs.index("'tier-villages'")]
    assert "?" not in village_tier
    # Order on screen reads upward: villages, towns, counties (Yaan, 2026-08-24).
    assert tabs.index("'tier-villages'") < tabs.index("'tier-towns'") < tabs.index("'tier-counties'")


def test_the_town_count_still_covers_cities_and_uncityed_towns():
    tabs = empire_panel()
    assert "const townCount = settlements.cityCount + settlements.towns.filter(t => !t.cityId).length;" in tabs
    # The squares themselves are now the count, and they are built from the
    # same two lists the gate reads — so the gate and the number cannot
    # disagree: no towns to draw means no tier at all.
    assert "const townTiles = settlements.cities.concat(settlements.towns.filter(t => !t.cityId)).map(empireTownTile);" in tabs
    assert "empireTierHTML('tier-towns', '🏘️', 'TOWNS', 'Merge 3 starred villages into a Town — you choose when', townTiles" in tabs


# ---------------------------------------------------------------------------
# 3. The screen ends at the chest
# ---------------------------------------------------------------------------

def test_find_yourself_and_the_guide_are_gone_along_with_their_styles():
    html = html_text()
    assert "const footerHtml = '';" in html
    for gone in ("'FIND YOURSELF'", "'HOW YOUR EMPIRE WORKS'", "locatorChipsHtml", "helpHtml",
                 'data-action="locator-me"', 'data-action="locator-home"',
                 'data-action="locator-settlement"', 'data-action="locator-region"'):
        assert gone not in html, gone
    # Dead CSS is still clutter, just clutter the player cannot see.
    for rule in (".empire-locator", ".empire-help-row", ".ehr-icon",
                 ".empire-footer", ".empire-drawer.is-footer"):
        assert rule not in html, rule


# ---------------------------------------------------------------------------
# 4-8. The village desk
# ---------------------------------------------------------------------------

def test_the_desk_opens_on_its_three_readings_and_nothing_else():
    desk = village_desk()
    assert "MANAGE VILLAGE" not in desk
    assert "province-title" not in desk
    # Folk, happiness and crews all survive, in that order, on one line.
    head = desk[desk.index("'<div class=\"province-head\">"):]
    head = head[:head.index("</div></div>'")]
    assert "👥 ' + snap.pop + '/' + snap.housingCap" in head
    assert "happinessFace(snap.happiness)" in head
    assert "👷 ' + (workedYards - idleYards) + '/' + workedYards" in head
    # The words that used to trail the numbers are gone.
    assert "yards crewed" not in head


def test_the_merge_star_the_trades_line_and_the_cart_left_the_desk():
    desk = village_desk()
    for gone in ("merge-progress", "villageMergeReady", "Merge star",
                 "province-trades-line", "No trades found yet", "discoveredVillageShopKeys",
                 "province-cart-btn", "SEND A SUPPLY CART", "empireSendSupplyCart"):
        assert gone not in desk, gone


def test_every_removed_mechanic_is_still_alive_elsewhere():
    """Nine lines of copy went. Not one rule did."""
    html = html_text()
    # The star is still earned, and still shown where the player acts on it.
    assert "function villageMergeReady(" in html
    assert 'data-action="merge-villages"' in html
    # Trades still hide until walked.
    assert "function discoveredVillageShopKeys(" in html
    # Supply carts are still a real relief valve.
    assert "function empireSendSupplyCart(" in html
    assert "empireSendSupplyCart," in html, "still exported for inline handlers"
    # Crews still gate what a village can build at once.
    desk = village_desk()
    assert "const buildSlots = villageBuildSlots(rec);" in desk
    assert "const busyElsewhere = !inProgress && slotsFree <= 0;" in desk


def test_the_construction_yard_heading_is_gone_but_the_grid_is_not():
    desk = village_desk()
    assert "👷 CREWS" not in desk
    assert "a Project Manager foremans a second crew" not in desk
    assert "province-build-grid" in desk
    # The Storm Wreckage heading is a different line and stays put.
    assert "Storm Wreckage" in desk
    assert ".province-build-title" in html_text(), "wreckage heading keeps its style"


# ---------------------------------------------------------------------------
# 9. The building cards
# ---------------------------------------------------------------------------

def test_a_building_card_shows_name_crew_and_cost_but_no_essay():
    desk = village_desk()
    start = desk.index("const buildingsHtml = deskBuildings.map")
    card = desk[start:desk.index("}).join('');", start)]
    assert "province-building-desc" not in card
    assert "tier.desc" not in card
    # What a card is actually for: which building, how far up, who works it,
    # and what the next step costs.
    assert "province-building-name" in card
    assert "province-building-pips" in card
    assert "crewHtml + btn" in card
    assert "province-build-shortage" in card
    assert ".province-building-desc" not in html_text(), "no dead rule left behind"


def test_the_desc_field_is_untouched_in_the_data():
    """Only the card stopped printing it — the catalogue still carries it."""
    html = html_text()
    buildings = html[html.index("const EMPIRE_BUILDINGS = ["):html.index("const EMPIRE_BUILDING_INDEX")]
    assert buildings.count("desc:") >= 10, "every building keeps its description"


# ---------------------------------------------------------------------------
# Shipping
# ---------------------------------------------------------------------------

def test_release_is_versioned_for_service_worker_self_update():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_BUILD = '%s';" % CURRENT_BUILD in html
    cache_line = next(l for l in sw.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert OWN_RELEASE_PIN in cache_line, "and this release keeps its place in it"
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD), "the newest marker goes last"


def test_no_core_pin_moved_because_no_core_changed():
    """This release is index.html only — every `?v=` stays where it was."""
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert "?v=%s" % OWN_RELEASE_PIN not in html
    assert "?v=%s" % OWN_RELEASE_PIN not in sw
    # The Magpie Market's cores are still on the release that changed them.
    # (bird_roles_core.js has since moved to free-birds-v318, which retired the
    # Head Gardener — a later release re-pinning a core is expected.)
    for core in ("academy_treehouse_core.js", "loot_crafting_core.js"):
        assert "%s?v=%s" % (core, PREVIOUS_RELEASE_PIN) in html, core
