"""The nested feudal ladder — a simplified Crusader Kings, done right.

Yaan spotted the inconsistency in the old empire structure: three villages
formed a "County" that then relabelled itself a Duchy at 5 villages and a
Kingdom at 8. That is not how a feudal ladder works — in Crusader Kings every
tier is made OF the tier below. This release fixes the whole system:

    3 exact Towns within 150 km → found a COUNTY (and it stays a county)
    2 counties within 600 km   → unite into a DUCHY
    2 duchies within 2000 km   → proclaim a KINGDOM
    2 kingdoms anywhere        → proclaim the EMPIRE of the Liberated Skies

Crowns follow the highest title actually held (Count → Duke → Monarch →
Emperor), unity taxes rise with the county's liege chain (15/20/25/30%), and
the pre-county rank ladder tops out at Baron — the rung below Count.

Core maths run through Node; index.html contracts pinned as text, in the same
style as test_empire_realms_trade_20260731.py.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CORE = ROOT / "empire_realm_core.js"
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
STORY = ROOT / "STORY.md"

OWN_RELEASE_PIN = "feudal-hierarchy-v222-20260804"
CURRENT_BUILD = "battle-progression-fixes-v286-20260819"
REALM_CORE_PIN = "town-strategy-v273-20260816"


def town(seed, name, lat, lon, day, hour):
    """Three neighbouring villages permanently forming one exact Town."""
    return [
        {
            "seed": seed + i,
            "name": f"{name}{i or ''}".strip(),
            "lat": lat + i * 0.006,
            "lon": lon + i * 0.004,
            "claimedAt": f"2026-07-{day:02d}T{hour + i:02d}:00:00Z",
        }
        for i in range(3)
    ]


def county(seed, name, lat, lon, day):
    """Three nearby Towns (nine villages) founding one County."""
    return (
        town(seed, name, lat, lon, day, 0)
        + town(seed + 1000, name + "North", lat + 0.20, lon, day, 3)
        + town(seed + 2000, name + "East", lat, lon + 0.25, day, 6)
    )


# Two counties ~300 km apart (their Town clusters must sit >150 km apart or
# they become one County) — together, the Duchy of Delamere.
CHESHIRE = county(1, "Delamere", 53.228, -2.684, 1)
LOTHIAN = county(20, "Currie", 55.90, -3.30, 4)
# A second duchy ~1200 km away: Provence + the Auvergne (~300 km apart).
PROVENCE = county(9, "Gordes", 43.911, 5.200, 7)
AUVERGNE = county(30, "Murol", 45.58, 2.94, 10)
# A second kingdom across the Atlantic: two US-east duchies.
STOWE = county(40, "Stowe", 44.47, -72.68, 13)
CATSKILLS = county(50, "Phoenicia", 42.08, -74.31, 16)
ASHEVILLE = county(60, "Asheville", 35.60, -82.55, 19)
ROANOKE = county(70, "Roanoke", 37.27, -79.94, 22)

EU_KINGDOM = CHESHIRE + LOTHIAN + PROVENCE + AUVERGNE
NA_KINGDOM = STOWE + CATSKILLS + ASHEVILLE + ROANOKE


def run_core(expression: str):
    script = f"const core=require({json.dumps(str(CORE))}); console.log(JSON.stringify({expression}));"
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def realm_of(villages):
    return run_core(f"core.deriveRealm({json.dumps(villages)})")


def empire_logic(html: str) -> str:
    start = html.index("// EMPIRE —")
    end = html.index("// ---- Scene state", start)
    return html[start:end]


# ---------------------------------------------------------------------------
# Core maths: every tier is made of the tier below
# ---------------------------------------------------------------------------

def test_a_county_with_more_than_three_towns_is_still_just_a_county():
    # A fourth nearby Town grows the County but never relabels it a Duchy;
    # structural titles only come from the tier below.
    blob = county(100, "V", 53.2, -2.7, 1) + town(3100, "Fourth", 53.42, -2.70, 2, 10)
    realm = realm_of(blob)
    assert len(realm["regions"]) == 1
    county_row = realm["regions"][0]
    assert county_row["tier"] == "county"
    assert county_row["name"] == run_core("core.placeLabel('county', 100)")
    assert county_row["townCount"] == 4
    assert county_row["villageCount"] == 12
    assert realm["duchies"] == [] and realm["kingdoms"] == [] and realm["empire"] is None
    assert run_core(f"core.crownTitle(core.deriveRegions({json.dumps(blob)}).regions)") == "Count of " + run_core("core.placeName('county', 100)")


def test_two_neighbouring_counties_unite_into_a_duchy():
    realm = realm_of(CHESHIRE + LOTHIAN)
    assert [r["name"] for r in realm["regions"]] == [run_core("core.placeLabel('county', 1)"), run_core("core.placeLabel('county', 20)")]
    assert len(realm["duchies"]) == 1
    duchy = realm["duchies"][0]
    # The earliest county still anchors the stable ID, but the duchy receives
    # an independent proper name.
    assert duchy["name"] == run_core("core.placeLabel('duchy', 1)")
    assert duchy["countyCount"] == 2 and duchy["villageCount"] == 18
    assert duchy["id"] == "duchy-1"
    # Both counties are annotated with their liege.
    assert all(r["duchyId"] == "duchy-1" and r["liegeTier"] == "duchy" for r in realm["regions"])
    assert run_core(f"core.crownTitle(core.deriveRegions({json.dumps(CHESHIRE + LOTHIAN)}).regions)") == "Duke of " + run_core("core.placeName('duchy', 1)")


def test_far_apart_counties_do_not_make_a_duchy():
    # Delamere → Gordes is ~1200 km, far beyond the 600 km duchy chain.
    realm = realm_of(CHESHIRE + PROVENCE)
    assert len(realm["regions"]) == 2
    assert realm["duchies"] == []
    assert all(r["duchyId"] is None and r["liegeTier"] == "county" for r in realm["regions"])


def test_two_duchies_proclaim_a_kingdom_and_two_kingdoms_the_empire():
    eu = realm_of(EU_KINGDOM)
    assert [d["name"] for d in eu["duchies"]] == [run_core("core.placeLabel('duchy', 1)"), run_core("core.placeLabel('duchy', 9)")]
    assert len(eu["kingdoms"]) == 1
    kingdom = eu["kingdoms"][0]
    assert kingdom["name"] == run_core("core.placeLabel('kingdom', 1)")
    assert kingdom["duchyCount"] == 2 and kingdom["countyCount"] == 4 and kingdom["villageCount"] == 36
    assert eu["empire"] is None
    assert run_core(f"core.crownTitle(core.deriveRegions({json.dumps(EU_KINGDOM)}).regions)") == "Monarch of " + run_core("core.placeName('kingdom', 1)")
    # A second kingdom across the ocean proclaims the Empire.
    both = realm_of(EU_KINGDOM + NA_KINGDOM)
    assert [k["name"] for k in both["kingdoms"]] == [run_core("core.placeLabel('kingdom', 1)"), run_core("core.placeLabel('kingdom', 40)")]
    assert both["empire"] is not None
    assert both["empire"]["name"] == "Empire of the Liberated Skies"
    assert both["empire"]["kingdomCount"] == 2
    assert run_core(f"core.crownTitle(core.deriveRegions({json.dumps(EU_KINGDOM + NA_KINGDOM)}).regions)") == "Emperor of the Liberated Skies"


def test_unity_taxes_rise_with_the_liege_chain():
    assert run_core("core.LIEGE_TAX_BONUS") == {"county": 0.15, "duchy": 0.20, "kingdom": 0.25, "empire": 0.30}
    lone = realm_of(CHESHIRE)["regions"][0]
    in_duchy = realm_of(CHESHIRE + LOTHIAN)["regions"][0]
    in_kingdom = realm_of(EU_KINGDOM)["regions"][0]
    in_empire = realm_of(EU_KINGDOM + NA_KINGDOM)["regions"][0]
    bonuses = [
        run_core(f"core.regionUnityBonus({json.dumps(region)})")
        for region in (lone, in_duchy, in_kingdom, in_empire)
    ]
    assert bonuses == [0.15, 0.20, 0.25, 0.30]
    # And the base bonus survives for regions with no annotation at all.
    assert run_core("core.regionUnityBonus(null)") == 0.15


def test_the_pyramid_is_deterministic_and_ids_survive_growth():
    first = realm_of(CHESHIRE + LOTHIAN)
    again = realm_of(CHESHIRE + LOTHIAN)
    assert first == again
    grown = realm_of(CHESHIRE + LOTHIAN + town(90, "Tarvin", 53.19, -2.79, 30, 0))
    assert grown["duchies"][0]["id"] == "duchy-1"  # the seat still anchors it
    assert grown["regions"][0]["townCount"] == 4
    assert grown["duchies"][0]["villageCount"] == 21


# ---------------------------------------------------------------------------
# index.html wiring
# ---------------------------------------------------------------------------

def test_realm_info_carries_the_pyramid_and_unity_reads_the_liege_chain():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert "core.deriveRealm ? core.deriveRealm(villages)" in logic
    assert "function empireLiegeById(" in logic
    snap_start = logic.index("function villageEconomySnapshot(")
    snap_end = logic.index("\n// Population drifts", snap_start)
    snap = logic[snap_start:snap_end]
    assert "unityCore.regionUnityBonus ? unityCore.regionUnityBonus(region)" in snap
    # The old contracts survive: base constant fallback and the multiplier.
    assert "REGION_TAX_BONUS" in snap
    assert "* merged * unity * governance)" in snap


def test_the_royal_ledger_lists_the_pyramid_above_the_counties():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    assert 'data-action="empire-liege"' in logic
    assert "realm-liege-row is-" in logic
    assert "realm-empire-banner" in logic
    assert "function frameEmpireLiege(" in logic
    assert "Your counties — tap one to run it from its County Hall" in logic
    # The plain-words help teaches the nested ladder, not the old size ladder.
    assert "3 nearby Towns" in logic and "County" in logic
    assert "Titles nest, Crusader-Kings style:" in logic
    assert "Count → Duke → Monarch → Emperor" in logic
    assert "a County, then a Duchy, then a Kingdom as it grows" not in html
    # Styling for the new rows exists.
    assert ".realm-liege-row.is-duchy" in html
    assert ".realm-empire-banner" in html


def test_liberation_announces_duchy_kingdom_and_empire_proclamations():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    claim_start = logic.index("function claimCurrentVillage(")
    claim_end = logic.index("\nfunction renderVillageClaimBar", claim_start)
    claim = logic[claim_start:claim_end]
    assert "duchiesBefore" in claim and "kingdomsBefore" in claim and "empireBefore" in claim
    assert "is founded!" in claim  # the county founding toast survives
    assert claim.count("is proclaimed!") == 3  # duchy, kingdom, empire


def test_county_hall_shows_the_liege_chain_instead_of_a_headcount_ladder():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    hall = logic[logic.index("function renderRegionScreen()"):]
    assert "region-hall-liege" in hall
    assert "region.duchyId" in hall and "region.kingdomId" in hall
    assert "unite into a Duchy" in hall
    assert "a Kingdom is proclaimed" in hall
    assert "the Empire of the Liberated Skies rises" in hall
    assert "nextRegionTier" not in html  # the size ladder is gone for good
    assert 'id="regionScreenTitle">COUNTY HALL' in html


def test_pre_county_ranks_stop_below_count():
    html = HTML.read_text(encoding="utf-8")
    logic = empire_logic(html)
    ranks_start = logic.index("const EMPIRE_RANKS")
    ranks = logic[ranks_start:logic.index("\n", ranks_start)]
    # Count, Duke, Monarch and Emperor are structural titles now — the ladder
    # a player climbs by loose village count tops out at Baron.
    for banned in ("Count", "Duke", "Monarch", "Emperor"):
        assert banned not in ranks
    assert "Baron" in ranks


def test_story_canon_teaches_the_nested_ladder():
    story = STORY.read_text(encoding="utf-8")
    assert "## Counties, crowns and the trade of free realms" in story
    assert "County → Duchy → Kingdom → Empire" in story
    assert "every tier is made of the tier below" in story
    assert "three Towns" in story
    assert "two Kingdoms** anywhere on Earth proclaim the **Empire of the Liberated Skies" in story


def test_release_is_versioned_and_the_realm_core_cache_buster_moved():
    html = HTML.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    # BURBZ_BUILD tracks the NEWEST release marker; later releases move it on,
    # but this release's own segment stays in the cache lineage forever.
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
    # Exact Town grouping moved empire_realm_core.js again; installed players
    # must receive the new derivation while the old feudal marker stays.
    assert f'src="empire_realm_core.js?v={REALM_CORE_PIN}"' in html
    assert f"'./empire_realm_core.js?v={REALM_CORE_PIN}'" in sw
