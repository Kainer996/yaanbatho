"""The Royal Ledger's realm layout — and what survived the v275 nav tabs.

History: realm-dropdown-v223 folded the whole ledger body into a single
👑 YOUR REALM dropdown. empire-nav-tabs-v275-20260817 replaced that dropdown
with three navigation tabs directly under the map (COUNTIES · TOWNS ·
VILLAGES — see test_empire_nav_tabs_20260817.py). What this file still pins
are the contracts that outlived the dropdown:

- only STANDALONE villages get rows; villages consumed by a Town never
  return as rows or visitable destinations,
- the ladder reads top-down: counties above towns above villages,
- a player with no villages is met by onboarding, not an empty ledger.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "realm-dropdown-v223-20260804"
PREVIOUS_RELEASE_PIN = "feudal-hierarchy-v222-20260804"
CURRENT_BUILD = "gentle-start-v338-20260831"


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


def ledger(html: str) -> str:
    start = html.index("function renderEmpirePanel(")
    end = html.index("\n// ====", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# Only standalone villages surface, top-down
# ---------------------------------------------------------------------------

def test_only_standalone_villages_get_rows():
    body = ledger(HTML.read_text(encoding="utf-8"))
    assert "const villages = empireStandaloneVillages(sourceVillages)" in body
    assert "'Grow each village to its ⭐ merge star: 16 folk, 75% happy'" in body  # v290 tab caption
    assert "'YOUR VILLAGES'" not in body


def test_the_order_runs_bottom_up_villages_then_towns_then_counties():
    # empire-grid-v322-20260825 replaced the drop-down tabs with a box of
    # boxes: one square per holding under a plain tier heading. The ladder
    # reads upward now — Yaan asked for villages at the top (2026-08-24),
    # because they are the whole empire until a Town rises.
    body = ledger(HTML.read_text(encoding="utf-8"))
    start = body.index("const tiersHtml")
    block = body[start:body.index("// Order on screen", start)]
    assert block.index("'tier-villages'") < block.index("'tier-towns'")
    assert block.index("'tier-towns'") < block.index("'tier-counties'")


def test_consumed_villages_cannot_be_reopened_from_the_ledger_or_direct_route():
    html = HTML.read_text(encoding="utf-8")
    body = ledger(html)
    assert "const villages = empireStandaloneVillages(sourceVillages)" in body
    assert "sourceVillages.map(villageRow)" not in body

    start = html.index("function openEmpireVillage(")
    opener = html[start:html.index("\nfunction ", start)]
    assert "const merged = empireSettlementOfSeed(village.seed);" in opener
    assert "if (merged) { openEmpireTown(merged.id); return; }" in opener


# ---------------------------------------------------------------------------
# The realm content keeps its shape
# ---------------------------------------------------------------------------

def test_the_counties_body_still_lists_the_pyramid_counties_and_trade():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    # The county squares caption themselves now, so the old lead line and its
    # .realm-lead rule went with the drop-down (empire-grid-v322-20260825).
    assert "Your counties — tap one to run it from its County Hall" not in logic
    assert ".realm-lead" not in html
    assert "'COUNTIES', 'Merge 3 starred Towns into a County" in logic
    # The realm layer still only builds when a county actually exists.
    assert "if (regions.length && rc) {" in logic
    assert '<div class="realm-section">' in logic
    assert 'data-action="empire-region"' in logic
    assert 'data-action="empire-liege"' in logic


def test_a_lone_village_still_opens_on_something_that_explains_the_ladder():
    logic = empire_logic(HTML.read_text(encoding="utf-8"))
    # gentle-start-v338 compressed the one-village counties hint.
    assert "🕊️ Free villages, grow them to their ⭐" in logic
    assert "merge three at a time" in logic  # v290: the player merges (v338 compressed the line)
    assert "up through Towns, Counties and Kingdoms" in logic


def test_onboarding_still_greets_a_player_with_no_villages():
    body = ledger(HTML.read_text(encoding="utf-8"))
    assert "🕊️ FREE YOUR FIRST VILLAGE" in body
    assert "const tiersHtml = count" in body


# ---------------------------------------------------------------------------
# Release plumbing — this is what actually reaches a refreshed phone
# ---------------------------------------------------------------------------

def test_the_app_shell_is_reinstalled_past_the_browser_http_cache():
    """Yaan refreshed several times and still saw the old ledger.

    cache.add() reuses the browser's HTTP cache, so a Pages response still
    inside its max-age reinstalls the OLD index.html into the NEW worker cache
    and the refresh changes nothing. The install now fetches the shell with
    cache:'reload'.
    """
    sw = SW.read_text(encoding="utf-8")
    assert "function cacheFreshCopy(cache, asset)" in sw
    assert "fetch(asset, { cache: 'reload' })" in sw
    assert "const cacheOptionalAsset = asset => cacheFreshCopy(cache, asset)" in sw
    assert "const optionalAssets = BURBZ_FALLBACK_REQUIRED;" in sw  # shell list still drives the warm-up
    assert "BURBZ_INSTALL_REQUIRED.map(asset" in sw  # only the atomic update shell blocks takeover
    assert "cache.add(asset)" not in sw
    assert "./index.html" in sw.split("const BURBZ_CORE = [", 1)[1].split("];", 1)[0]


def test_release_is_versioned_so_a_refresh_actually_lands_the_new_layout():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
