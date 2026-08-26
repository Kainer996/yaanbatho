"""The Empire screen navigates by tabs: COUNTIES · TOWNS · VILLAGES.

Yaan's ask (2026-08-17, from a screenshot of the Empire screen): under the
map sat the locator chips, the Royal Ledger stats, the tax chest and the
YOUR REALM dropdown — a wall of fluff before any navigation. Move all of
that to the bottom. Directly under the map, give the player three clean
tabs — counties above towns, villages below towns — so they walk their
whole empire by pressing the tab buttons.

This release (empire-nav-tabs-v275-20260817) pinned three drop-down tabs in
ladder order under the map. empire-grid-v322-20260825 kept the ladder and
threw the drop-down away — Yaan's ask, from a screenshot: "each village will
have a little square", one tap straight into it. So what this file pins now is
what SURVIVED that change:

- three tiers directly under the map, in ladder order: 🛡️ COUNTIES,
  🏘️ TOWNS, 🏡 VILLAGES, each one a heading over a grid of squares,
- each tier keeps the caption the tab carried, so nothing stopped teaching,
- a tier the player has not reached does not appear at all,
- the old YOUR REALM dropdown and its sub-drawer helper are gone,
- and no drawer bones are left behind: no accordion, no chevron, no
  empireNavTabHTML.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "empire-nav-tabs-v275-20260817"
PREVIOUS_RELEASE_PIN = "mobile-fresh-update-v274-20260816"
CURRENT_BUILD = "quiet-arena-v331-20260826"


def ledger(html: str) -> str:
    start = html.index("function renderEmpirePanel(")
    end = html.index("\n// ====", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# The three tabs, in ladder order, directly under the map
# ---------------------------------------------------------------------------

def test_the_three_nav_tabs_stand_villages_first():
    body = ledger(HTML.read_text(encoding="utf-8"))
    start = body.index("const tiersHtml")
    block = body[start:body.index("// Order on screen", start)]
    assert "'tier-villages', '🏡', 'VILLAGES'" in block
    assert "'tier-towns', '🏘️', 'TOWNS'" in block
    assert "'tier-counties', '🛡️', 'COUNTIES'" in block
    # v275 ran counties → towns → villages. Yaan asked for villages at the top
    # (2026-08-24): "hide it when empty" only LOOKS like "put it first", until
    # a Town rises and villages drop to the bottom again.
    assert block.index("'tier-villages'") < block.index("'tier-towns'")
    assert block.index("'tier-towns'") < block.index("'tier-counties'")
    assert '<div class="empire-tiers">' in block
    # Every tab caption survived the change into a tier subtitle.
    assert "'Merge 3 starred Towns into a County — titles and trade live here'" in block
    assert "'Merge 3 starred villages into a Town — you choose when'" in block
    assert "'Grow each village to its ⭐ merge star: 16 folk, 75% happy'" in block


def test_the_tax_chest_opens_the_panel_and_the_boxes_follow():
    # v275 put the chest under the tabs. Yaan's ask (2026-08-25) turned that
    # round: you empty the chest, THEN you go somewhere, so the chest is the
    # first thing in the panel and the boxes come after it.
    body = ledger(HTML.read_text(encoding="utf-8"))
    start = body.index("  panel.innerHTML =\n")
    block = body[start:body.index("panel.querySelectorAll", start)]
    assert block.index("empire-tribute-btn") < block.index("tiersHtml")
    assert block.index("tiersHtml") < block.index("footerHtml")
    assert "ROYAL LEDGER" not in block
    assert "empire-stats-row" not in block


def test_no_tab_is_left_to_unfold_and_no_drawer_bones_remain():
    """Deleting a control is half the job — the markup it needed goes too."""
    html = HTML.read_text(encoding="utf-8")
    assert "function empireTierHTML(" in html
    assert ".empire-tiers {" in html and ".empire-tier-head {" in html
    # Nothing under the map opens, closes, or folds anything else away.
    for gone in ("empireNavTabHTML", "empire-nav-tabs", "is-nav-tab",
                 'name="empire-nav"'):
        assert gone not in html, gone
    # The sub-drawers on the village, town and county desks are untouched.
    assert "function empireDrawerHTML(" in html
    assert ".empire-drawer.is-sub {" in html


# ---------------------------------------------------------------------------
# Every tab always stands — empty tiers teach, they do not vanish
# ---------------------------------------------------------------------------

def test_each_tier_still_says_something_under_its_squares():
    body = ledger(HTML.read_text(encoding="utf-8"))
    # Towns: the county road, once a town exists to walk it.
    assert "const townsExtra = townTiles.length && rcTiers" in body
    assert "A town earns its merge star at 120 folk" in body
    # Counties: the realm desk, or the next-rung explainer.
    assert "let countiesBody = '';" in body
    assert "🕊️ Your realm starts here." in body
    # Villages: the star road, or where every village went.
    assert "const villagesExtra = villages.length" in body
    assert "Every free village has merged into a Town" in body


def test_the_counties_tier_stands_whenever_a_merge_is_ready_to_sign():
    """The MERGE INTO ONE COUNTY banner renders inside the Counties tier.

    Hide the tier on `regions.length` alone and the button goes with it, so
    the first county could never be founded. The gate reads BOTH.
    """
    body = ledger(HTML.read_text(encoding="utf-8"))
    assert "const showCounties = !!(regions.length || regionCandidates.length);" in body
    assert "lead:regionMergeBanners" in body
    assert "🛡️ MERGE INTO ONE COUNTY" in body


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
