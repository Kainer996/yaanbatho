"""The 3D town sits at the top of the Town Hall screen, and its yards run.

Yaan's ask (2026-08-17, from a screenshot of the Town Hall): "on the town tab
I can't see the town itself, the 3D view of the town. Make that be at the top
so the player can see it. Also have them be able to click on different
buildings and have the stats of that building — allow them to run that
building and tie it in together, a little separate city building thing."

This release (town-square-city-builder-v276-20260817) pins:

- the 3D stage renders FIRST on the town screen, above #townHallPanel,
  always on — the old collapsible "WALK THE 3D TOWN SQUARE" details is gone,
- each ward's REAL empire buildings (farm, well, camp, quarry…) stand in its
  district as tappable yards tagged with wardSeed + buildingId,
- tapping a yard opens its sheet: stats at its level, crew, town network
  standing, and one BUILD/UPGRADE button that uses the same crews, gates,
  costs and timers as the Hall's network buttons — only the targeting
  differs (the tapped ward, not the least-developed one),
- tapping anywhere else opens the town ledger (one-town-fixed-view-v277
  replaced the per-quarter ward sheet); tapping the charter stone scrolls
  to the Hall desk,
- yard levels key the scene, so a finished upgrade rises on screen,
- the no-WebGL fallback keeps the feature: it opens the town ledger.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

OWN_RELEASE_PIN = "town-square-city-builder-v276-20260817"
PREVIOUS_RELEASE_PIN = "empire-nav-tabs-v275-20260817"
CURRENT_BUILD = "free-birds-v318-20260824"


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


# ---------------------------------------------------------------------------
# The 3D town stands at the top, always on
# ---------------------------------------------------------------------------

def test_the_stage_sits_above_the_hall_panel_with_no_details_wrapper():
    html = HTML.read_text(encoding="utf-8")
    screen = html[html.index('id="screen-town"'):html.index('id="screen-county"')]
    assert screen.index('id="townStage"') < screen.index('id="townHallPanel"')
    assert screen.index('id="townScreenTitle"') < screen.index('id="townStage"')
    assert "townSquareDetails" not in html
    assert "WALK THE 3D TOWN SQUARE" not in html
    assert "town-square-flavour" not in html


def test_the_square_renders_on_every_hall_render_and_animates_by_screen_alone():
    html = HTML.read_text(encoding="utf-8")
    render = function_source(html, "renderTownScreen")
    assert "renderTownSquare(settle)" in render
    assert "renderTownSheet()" in render
    square = function_source(html, "renderTownSquare")
    assert "townBuiltKey !== townSceneKey(settle)" in square
    assert "townBuiltPhase !== burbzDaylightPhaseNow()" in square
    animate = function_source(html, "townAnimate")
    assert "if (currentScreen !== 'town') { townRunning = false; return; }" in animate
    assert "townSquareDetails" not in animate


# ---------------------------------------------------------------------------
# Real yards in the scene, tagged and tappable
# ---------------------------------------------------------------------------

def test_each_wards_real_buildings_stand_in_its_district_as_tagged_yards():
    html = HTML.read_text(encoding="utf-8")
    scene = function_source(html, "buildTownScene")
    assert "townMakeEconBuilding(b.id, yardLevel, dr, dpal)" in scene
    assert "yard.userData.wardSeed = seed" in scene
    assert "yard.userData.buildingId = b.id" in scene
    assert "townEconBuildings.push(yard)" in scene
    # Yards return with recovery, like everything else in a healing district.
    assert "if (dRuin >= 1) {" in scene
    # The charter stone is the Town Hall's own tap target.
    assert "standard.userData.townHallStone = true" in scene
    maker = function_source(html, "townMakeEconBuilding")
    # Homes are not repeated — the quarter's cottages already show them.
    for building_id in ("farm", "well", "tavern", "chapel", "lumber", "quarry", "market", "storehouse"):
        assert f"'{building_id}'" in maker, building_id
    assert "'cabin'" not in maker and "'cottages'" not in maker


def test_taps_route_to_the_sheets_yard_first_then_town():
    html = HTML.read_text(encoding="utf-8")
    controls = function_source(html, "ensureTownRenderer")
    assert "townEconBuildings.concat(townDistrictGroups, townNpcs)" in controls
    # A working yard wins over the town ledger.
    yard = controls.index("openTownBuildingSheet(obj.userData.wardSeed, obj.userData.buildingId)")
    ledger = controls.index("openTownLedgerSheet()")
    assert yard < ledger
    assert "townHallSection" in controls  # charter stone → the Hall desk
    assert "openEmpireVillage(" not in controls
    # The scene key rebuilds the square when a yard finishes rising.
    key_fn = function_source(html, "townSceneKey")
    assert "EMPIRE_BUILDINGS.map(b => villageBuildingLevel(rec, b.id)).join('')" in key_fn


# ---------------------------------------------------------------------------
# The sheets: stats, crew, network — and one button that runs the yard
# ---------------------------------------------------------------------------

def test_the_building_sheet_shows_stats_crew_and_network_standing():
    html = HTML.read_text(encoding="utf-8")
    sheet = function_source(html, "townBuildingSheetHTML")
    assert "villageBuildingLevel(rec, building.id)" in sheet
    assert "villageBuildingTier(building, level)" in sheet
    assert "townBuildingOutputText(building, level, villageCrewShare(building, crew))" in sheet
    assert "crew.assigned && crew.assigned[building.id]" in sheet
    assert "townNetworkLevel(settle, building.id)" in sheet
    assert "townBuilderSlots(settle)" in sheet
    assert 'data-action="sheet-build"' in sheet
    output = function_source(html, "townBuildingOutputText")
    for field in ("perLevel", "coinsPerLevel", "branchesPerLevel", "stonePerLevel", "taxBoost", "storagePerLevel"):
        assert field in output, field


def test_the_town_ledger_lists_every_yard_built_or_not():
    html = HTML.read_text(encoding="utf-8")
    sheet = function_source(html, "townLedgerSheetHTML")
    assert "EMPIRE_BUILDINGS.map(building =>" in sheet
    assert "townEconomySnapshot(settle)" in sheet
    assert "villageWorkforce(rec)" in sheet
    assert 'data-action="sheet-building"' in sheet
    assert "🔒 Unlocks at trainer level" in sheet


def test_building_from_the_sheet_uses_the_same_crews_gates_and_timers():
    html = HTML.read_text(encoding="utf-8")
    build = function_source(html, "townBuildAtWard")
    # The same builder-slot cap as the Hall's network buttons…
    assert "townActiveProjectCount(settlement) >= townBuilderSlots(settlement)" in build
    assert "All Town builder crews are busy. Raise the Hall for more simultaneous projects." in build
    # …one project per quarter…
    assert "villageConstructionFor(rec)" in build
    # …and the one construction path everything else uses.
    assert "empireBuildStructure(rec.seed, buildingId, { townMode:true" in build


def test_the_fallback_list_keeps_the_feature_without_webgl():
    html = HTML.read_text(encoding="utf-8")
    fallback = function_source(html, "renderTownFallback")
    assert 'data-action="fallback-ledger"' in fallback
    assert "openTownLedgerSheet()" in fallback
    assert "v.name" not in fallback


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
