"""The Empire screen navigates by tabs: COUNTIES · TOWNS · VILLAGES.

Yaan's ask (2026-08-17, from a screenshot of the Empire screen): under the
map sat the locator chips, the Royal Ledger stats, the tax chest and the
YOUR REALM dropdown — a wall of fluff before any navigation. Move all of
that to the bottom. Directly under the map, give the player three clean
tabs — counties above towns, villages below towns — so they walk their
whole empire by pressing the tab buttons.

This release (empire-nav-tabs-v275-20260817) pins:

- three nav tabs directly under the map, in ladder order: 🛡️ COUNTIES,
  🏘️ TOWNS, 🏡 VILLAGES — each a closed drawer that unfolds its list,
- the tabs share one `name`, so opening one folds the others (exclusive,
  accordion-style — only ever one list on screen),
- every tab always stands: an empty tier explains how to fill it instead
  of disappearing,
- the reference bits (locator strip, ledger stats, tribute
  button, help scroll) renders AFTER the tabs, at the bottom,
- the old YOUR REALM dropdown and its sub-drawer helper are gone.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "empire-nav-tabs-v275-20260817"
PREVIOUS_RELEASE_PIN = "mobile-fresh-update-v274-20260816"
CURRENT_BUILD = "magpie-market-v316-20260824"


def ledger(html: str) -> str:
    start = html.index("function renderEmpirePanel(")
    end = html.index("\n// ====", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# The three tabs, in ladder order, directly under the map
# ---------------------------------------------------------------------------

def test_three_nav_tabs_stand_in_ladder_order():
    body = ledger(HTML.read_text(encoding="utf-8"))
    start = body.index("const navTabsHtml")
    block = body[start:body.index("// Order on screen", start)]
    assert "'nav-counties', '🛡️', 'COUNTIES'" in block
    assert "'nav-towns', '🏘️', 'TOWNS'" in block
    assert "'nav-villages', '🏡', 'VILLAGES'" in block
    # Counties above towns, villages below towns — Yaan's exact order.
    assert block.index("'nav-counties'") < block.index("'nav-towns'")
    assert block.index("'nav-towns'") < block.index("'nav-villages'")
    assert '<div class="empire-nav-tabs">' in block


def test_the_tabs_render_first_and_the_reference_bits_wait_at_the_bottom():
    # Since empire-declutter (2026-08-20) the ledger lives in the 👑 pill's
    # pop-down, and the locator + guide fold into footer pop-downs at the
    # very bottom. In the panel itself: tabs, then the tax chest, then footer.
    body = ledger(HTML.read_text(encoding="utf-8"))
    start = body.index("panel.innerHTML = navTabsHtml")
    block = body[start:body.index("panel.querySelectorAll", start)]
    assert block.index("navTabsHtml") < block.index("empire-tribute-btn")
    assert block.index("empire-tribute-btn") < block.index("footerHtml")
    assert "ROYAL LEDGER" not in block
    assert "empire-stats-row" not in block


def test_the_tabs_are_exclusive_one_open_folds_the_others():
    html = HTML.read_text(encoding="utf-8")
    assert "function empireNavTabHTML(" in html
    # The shared details `name` is what makes the accordion exclusive.
    assert "'class=\"empire-drawer is-nav-tab\" name=\"empire-nav\"'" in html
    # Closed by default — the false openDefault keeps the screen clean.
    assert "empireDrawerHTML(id, false, icon, label, copy, count, bodyHtml)" in html
    assert ".empire-nav-tabs {" in html
    assert ".empire-drawer.is-nav-tab" in html


# ---------------------------------------------------------------------------
# Every tab always stands — empty tiers teach, they do not vanish
# ---------------------------------------------------------------------------

def test_each_tier_has_a_body_even_when_empty():
    body = ledger(HTML.read_text(encoding="utf-8"))
    # Towns tab: rows when settlements exist, a forming hint otherwise.
    assert "let townsBody;" in body
    assert "🏘️ No towns yet. Grow a village to 16 folk" in body  # v290: merge-when-ready
    # Counties tab: the realm desk, or the next-rung explainer.
    assert "let countiesBody = '';" in body
    assert "🕊️ Your realm starts here." in body
    # Villages tab: the standalone list, or where they all went.
    assert "const villagesBody = villages.length" in body
    assert "Every free village has merged into a Town" in body


def test_the_old_realm_dropdown_is_gone_for_good():
    html = HTML.read_text(encoding="utf-8")
    assert "realm-root" not in html
    assert "'YOUR REALM'" not in html
    assert "empireSubDrawerHTML" not in html
    assert "realmDropdownHtml" not in html


def test_copy_now_points_at_the_counties_tab_not_the_royal_ledger():
    html = HTML.read_text(encoding="utf-8")
    assert "Merge three starred towns within 150 km" in html  # v290: the Counties tab teaches the merge road
    assert "open trade routes from the Counties tab once a second county stands" in html
    assert "tap it in the Royal Ledger" not in html


# ---------------------------------------------------------------------------
# Release plumbing — this is what actually reaches a refreshed phone
# ---------------------------------------------------------------------------

def test_release_is_versioned_so_a_refresh_actually_lands_the_new_layout():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
