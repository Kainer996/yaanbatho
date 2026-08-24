"""One cohesive town, seen from a still city-builder view.

Yaan's ask (2026-08-17, from a screenshot of the 3D town): "I don't think the
town should be split up into three separate quarters. Just have it as one
town, cohesively. Also don't have the map screen revolve around a point in
the middle — have it not moving until the player moves it, in a nice view
typical of city-builder games."

This release (one-town-fixed-view-v277-20260817) pins:

- the quarter pads, geographic district layout and 'Quarter N' signs are
  gone: a shared golden-angle plot ring knits every ward's homes, trades
  and yards around the ONE market square (homes near, yards behind,
  wreckage at the edge),
- each ward still builds in its own palette and mirrors its own recovery,
  so the streets keep the founders' variety without the seams,
- the camera never drifts on its own — no idle orbit — and it opens on a
  fixed three-quarter city-builder view,
- the per-quarter ward sheet became one town-wide ledger: tap any yard
  for its card, or anywhere else (ground included) for the ledger.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "one-town-fixed-view-v277-20260817"
PREVIOUS_RELEASE_PIN = "town-square-city-builder-v276-20260817"
CURRENT_BUILD = "project-manager-desk-v315-20260824"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


# ---------------------------------------------------------------------------
# One town: the shared plot ring replaces the quarter pads
# ---------------------------------------------------------------------------

def test_the_quarters_are_gone_and_one_plot_ring_knits_the_town():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    # The shared planner: homes near the square, yards behind, wrecks at the edge.
    assert "const takePlot = (kind, radiusBase, jitter, clearance)" in scene
    assert "planted.every(existing =>" in scene
    assert "GOLDEN_ANGLE" in scene
    assert "const HOME_RING" in scene and "const YARD_RING" in scene and "const EDGE_RING" in scene
    # No quarter furniture: no pads, no signs, no geographic spread.
    assert "Quarter " not in scene
    assert "townDistrictLayout" not in html
    assert "const padR" not in scene
    # Ward groups survive as invisible bookkeeping for taps and palettes.
    assert "district.userData.districtSeed = seed" in scene
    # The ground itself is tappable — anywhere that isn't a yard opens the ledger.
    assert "ground.userData.townGround = true" in scene
    assert "townEconBuildings.push(ground)" in scene


def test_each_ward_still_wears_its_own_dna_and_recovery():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    assert "villageVariedPalette(VILLAGE_PALETTES[plan.paletteIndex], seed)" in scene
    assert "const dState = villageDistrictState(seed);" in scene
    assert "if (dRuin < 2) {" in scene       # wreckage until rebuilt
    assert "if (dRuin >= 2) {" in scene      # trades wait for the flourish
    assert "if (dRuin === 2) {" in scene     # homes wait for the flourish
    assert "if (i < 8 && dRuin >= 1) {" in scene  # wrecked wards stay dark


# ---------------------------------------------------------------------------
# The still camera
# ---------------------------------------------------------------------------

def test_the_view_holds_still_until_the_player_moves_it():
    html = HTML.read_text(encoding="utf-8")
    frame = function_source(html, "townAnimateFrame")
    assert "townCam.azimuth +=" not in frame  # no idle orbit
    assert "no idle orbit" in frame


def test_the_view_opens_on_a_fixed_city_builder_angle():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    assert "townCam.polar = 0.82;" in scene
    assert "townCam.dist = isCity ? 30 : 26;" in scene
    # The ground hugs the streets so the town fills the frame.
    assert "const groundR = isCity ? 36 : 32;" in scene


# ---------------------------------------------------------------------------
# One ledger for one town
# ---------------------------------------------------------------------------

def test_the_town_ledger_replaces_the_per_quarter_ward_sheet():
    html = HTML.read_text(encoding="utf-8")
    assert "function townLedgerSheetHTML(" in html
    assert "townWardSheetHTML" not in html
    assert "function openTownLedgerSheet()" in html
    assert "openTownWardSheet" not in html
    ledger = function_source(html, "townLedgerSheetHTML")
    # Town-wide numbers, then one row per real yard — built or not.
    assert "townEconomySnapshot(settle)" in ledger
    assert "townMemberRecords(settle)" in ledger
    assert "townNetworkUpgradeTarget(settle, building.id)" in ledger
    assert "TOWN LEDGER" in ledger
    assert "Quarter" not in ledger
    # The building sheet leads back to the ledger, not to a quarter.
    building_sheet = function_source(html, "townBuildingSheetHTML")
    assert 'data-action="sheet-ledger"' in building_sheet
    assert "quarterName" not in html


def test_ground_and_ward_taps_open_the_ledger():
    html = HTML.read_text(encoding="utf-8")
    controls = function_source(html, "ensureTownRenderer")
    assert "obj.userData.districtSeed !== undefined || obj.userData.townGround" in controls
    assert "openTownLedgerSheet()" in controls


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
