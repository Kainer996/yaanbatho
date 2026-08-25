"""Villages lead the Empire tabs, and the county merge stays reachable.

Two follow-ups to `empire-village-declutter-v317-20260824`, pinned as
`villages-first-county-merge-v319-20260824`.

**Villages at the top.** Yaan's words were "on that screen have villages at
the top". v317 hid the empty COUNTIES and TOWNS tabs, which looks right on a
one-village empire — but the moment a Town rises, VILLAGES drops to the
bottom again. The order is villages → towns → counties now, so the tab the
player uses every day always leads and the ladder climbs above it.

**The county merge must stay reachable.** This is the real bug. `countiesBody`
is built as `regionMergeBanners || …`, so the gold 🛡️ MERGE INTO ONE COUNTY
banner is rendered INTO the Counties tab. Gating that tab on `regions.length`
alone means a player with three starred towns and no county has nowhere to
press it — the first county can never be founded, and the ladder dead-ends at
Town for good. `showCounties` therefore also opens on `regionCandidates`.

The village → town merge never had this problem: `townMergeBanners` rides in
`villagesBody`, and the Villages tab always stands. That asymmetry is easy to
miss, which is why both halves are pinned here.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")

OWN_RELEASE_PIN = "villages-first-county-merge-v319-20260824"
# A later release ships over the top; this one changed no core either, so only
# the head build moves on.
CURRENT_BUILD = "one-tap-appointments-v320-20260824"
PREVIOUS_RELEASE_PIN = "empire-village-declutter-v317-20260824"


def empire_panel() -> str:
    start = HTML.index("function renderEmpirePanel(")
    return HTML[start:HTML.index("\nfunction ", start + 40)]


def nav_tabs() -> str:
    panel = empire_panel()
    return panel[panel.index("const navTabsHtml"):panel.index("panel.innerHTML")]


# ---------------------------------------------------------------------------
# 1. Villages lead
# ---------------------------------------------------------------------------

def test_villages_lead_then_towns_then_counties():
    tabs = nav_tabs()
    assert tabs.index("'nav-villages'") < tabs.index("'nav-towns'") < tabs.index("'nav-counties'")


def test_villages_is_still_the_one_tab_that_always_stands():
    tabs = nav_tabs()
    # No ternary between the grid opening and the Villages tab.
    opening = tabs[tabs.index('<div class="empire-nav-tabs">'):tabs.index("'nav-villages'")]
    assert "?" not in opening
    # Both tiers above it are gated.
    assert "(townCount ? empireNavTabHTML('nav-towns'" in tabs
    assert "(showCounties ? empireNavTabHTML('nav-counties'" in tabs


# ---------------------------------------------------------------------------
# 2. The merge a hidden tab would have swallowed
# ---------------------------------------------------------------------------

def test_the_counties_tab_stands_whenever_a_county_merge_is_ready():
    panel = empire_panel()
    assert "const showCounties = regions.length > 0 || regionCandidates.length > 0;" in panel
    # The reason it must: the banner lives inside that tab's body.
    assert "countiesBody = regionMergeBanners" in panel
    assert "MERGE INTO ONE COUNTY" in panel


def test_the_village_to_town_merge_rides_in_the_tab_that_always_stands():
    panel = empire_panel()
    assert "const villagesBody = villages.length\n    ? townMergeBanners" in panel
    assert "MERGE INTO ONE TOWN" in panel


def test_both_merge_banners_come_from_the_same_candidate_lists():
    """If either list is computed after the tabs, the gate reads undefined."""
    panel = empire_panel()
    for name in ("townCandidates", "regionCandidates"):
        assert panel.index("const " + name) < panel.index("const navTabsHtml"), name


# ---------------------------------------------------------------------------
# 3. Shipping
# ---------------------------------------------------------------------------

def test_release_is_versioned_so_a_refresh_lands_the_new_order():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(l for l in SW.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert OWN_RELEASE_PIN in cache_line, "this release stays in the lineage"
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD), "the newest release goes on the end"


def test_this_release_edited_no_core_so_it_pins_none():
    assert f"?v={OWN_RELEASE_PIN}" not in HTML
    assert f"?v={OWN_RELEASE_PIN}" not in SW
