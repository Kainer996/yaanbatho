"""The Royal Ledger opens as ONE dropdown: "your realm", top-down.

Yaan's report: the ledger met the player with a list of villages spilling from
the top of the screen — the feudal ladder read upside down. This release turns
the whole ledger body into a single closed drawer, 👑 YOUR REALM, which the
player clicks to open. Inside, everything unfolds in the order the ladder runs:

    the crown and its counties (THE REALM)
      → 🏘️ TOWNS & CITIES        (nested, folded)
        → 🏡 YOUR VILLAGES       (nested, folded)

Nothing about the maths changes — this is layout and defaults only, pinned as
text contracts in the same style as the other index.html tests.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "realm-dropdown-v223-20260804"
PREVIOUS_RELEASE_PIN = "feudal-hierarchy-v222-20260804"
CURRENT_BUILD = "mallard-true-diet-v237-20260809"


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


def ledger(html: str) -> str:
    start = html.index("function renderEmpirePanel(")
    end = html.index("\n// ====", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# One dropdown, closed, at the top
# ---------------------------------------------------------------------------

def test_the_ledger_body_is_a_single_closed_your_realm_dropdown():
    body = ledger(HTML.read_text(encoding="utf-8"))
    assert "empireDrawerHTML('realm-root', false, '👑', 'YOUR REALM'" in body
    # Closed by default: the player is met by the prompt, not by a wall of rows.
    assert "'Click to open your realm — counties, then towns, then villages'" in body


def test_towns_and_villages_are_nested_inside_the_realm_dropdown():
    body = ledger(HTML.read_text(encoding="utf-8"))
    assert "empireSubDrawerHTML('settlements', false, '🏘️', 'TOWNS &amp; CITIES'" in body
    assert "empireSubDrawerHTML('villages', false, '🏡', 'YOUR VILLAGES'" in body
    # Both are built into the realm drawer's body, not appended after it.
    realm_root = body.index("empireDrawerHTML('realm-root'")
    assert body.index("empireSubDrawerHTML('villages'", realm_root) > realm_root
    assert "realmDropdownHtml" in body
    # ... and the old sibling layout is gone for good.
    assert "settlementHtml +\n    realmHtml +" not in body


def test_the_order_inside_runs_top_down_realm_then_towns_then_villages():
    body = ledger(HTML.read_text(encoding="utf-8"))
    start = body.index("const realmDropdownHtml")
    block = body[start:body.index("// ---- 📍 Locator strip", start)]
    assert block.index("realmHtml") < block.index("settlementHtml")
    assert block.index("settlementHtml") < block.index("'YOUR VILLAGES'")


def test_a_sub_drawer_helper_marks_the_nesting():
    logic = HTML.read_text(encoding="utf-8")
    assert "function empireSubDrawerHTML(" in logic
    assert "'class=\"empire-drawer is-sub\"'" in logic
    assert ".empire-drawer.is-sub" in logic


# ---------------------------------------------------------------------------
# The realm head keeps its content
# ---------------------------------------------------------------------------

def test_the_realm_head_still_lists_the_pyramid_counties_and_trade():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert '<div class="realm-sub-title">🏰 THE REALM</div>' in logic
    assert "Your counties — tap one to run it from its County Hall" in logic
    assert 'class="realm-lead"' in logic
    assert ".realm-lead {" in html
    # The realm layer still only builds when a county actually exists.
    assert "if (regions.length && rc) {" in logic
    assert '<div class="realm-section">' in logic
    assert 'data-action="empire-region"' in logic
    assert 'data-action="empire-liege"' in logic


def test_a_lone_village_still_opens_on_something_that_explains_the_ladder():
    logic = empire_logic(HTML.read_text(encoding="utf-8"))
    assert "🕊️ Your realm starts here." in logic
    assert "unite into counties, duchies and kingdoms" in logic


def test_onboarding_still_greets_a_player_with_no_villages():
    body = ledger(HTML.read_text(encoding="utf-8"))
    assert "🕊️ FREE YOUR FIRST VILLAGE" in body
    assert "const realmDropdownHtml = count" in body


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
    assert "cacheFreshCopy(cache, asset).catch(err =>" in sw
    assert "BURBZ_CORE.map(asset" in sw  # shell list still drives the install
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
