"""Every building opens. `step-inside-buildings-v341`.

Yaan's asks (2026-09-01): make the town-building side really playable —
tap a building and it takes you to that building; every building has an
interior; you manage the building in there, only with what the game already
has; and the convoluted menu under the town gets cleaned up.

What shipped:

1. A new pure core, `building_interior_core.js`, draws a hand-made SVG
   interior for all fifteen governor buildings — honest rooms that show the
   real level, the posted villagers (and the empty stools), the granary and
   cistern actually filling, dust sheets while an upgrade rises, and a
   staked plot before the first build.
2. One overlay, `#buildingInteriorOverlay`, in the shop-interior family:
   the room on top, the one card that runs the building below. A lone
   village gets `villageBuildingSheetHTML` (the desk's tested button, gates
   and shortfall prompts, moved indoors); a town ward keeps the tested
   `townBuildingSheetHTML` card.
3. Tap-to-enter everywhere: village 3D yards carry their building id now
   (cottages, chapel, market stalls, the storehouse and the Alehouse were
   not even tappable before), town yard taps route into the interior, desk
   and town grids became small door tiles, and the 2D fallback offers a
   door chip per built building.
4. The declutter: the desk's wall of build cards and the town's fifteen
   verbose network cards are tiles; the Entertainment and Metal Works
   sections retired into their own buildings' interiors.
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "building_interior_core.js"
DEPLOY = ROOT.parents[1] / "scripts" / "update-live-burbz.sh"
OWN_RELEASE_PIN = "step-inside-buildings-v341-20260901"
CURRENT_BUILD = "empire-three-pages-v343-20260901"
PREVIOUS_RELEASE_PIN = "no-arms-card-art-v340-20260901"


def html_text():
    return HTML.read_text(encoding="utf-8")


def function_source(html, name):
    start = html.index("function " + name + "(")
    end = html.index("\nfunction ", start + 40)
    return html[start:end]


# ---------------------------------------------------------------------------
# 1. The core: fifteen honest rooms
# ---------------------------------------------------------------------------

def test_the_core_draws_a_room_for_every_building():
    script = """
const core = require(%s);
const ids = ['cabin','hut','farm','well','lumberhut','minehut','cottages','tavern',
  'chapel','lumber','quarry','market','storehouse','foundry','entertainment'];
if (JSON.stringify(core.INTERIOR_IDS) !== JSON.stringify(ids)) throw new Error('id roster drifted');
for (const id of ids) {
  for (const level of [0, 1, 2, 3]) {
    const view = core.interiorView(id, { level, maxLevel: 3, workersNeeded: 3, workersPosted: 2, storeFill: 0.5 });
    const svg = core.sceneSVG(view, id);
    if (!svg.startsWith('<svg') || !svg.endsWith('</svg>')) throw new Error(id + ' bad svg');
    if (svg.length < 900) throw new Error(id + ' level ' + level + ' too thin');
  }
}
console.log('ok');
""" % json.dumps(str(CORE))
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr
    assert "ok" in out.stdout


def test_the_room_tells_the_truth():
    script = """
const core = require(%s);
// A half-manned yard shows the gap: two posted hands draw differently from none.
const manned = core.sceneSVG(core.interiorView('lumberhut', { level: 1, maxLevel: 3, workersNeeded: 3, workersPosted: 2 }), 'x');
const idle = core.sceneSVG(core.interiorView('lumberhut', { level: 1, maxLevel: 3, workersNeeded: 3, workersPosted: 0 }), 'x');
if (manned === idle) throw new Error('crew ignored');
// A dry cistern and a full one read differently.
const dry = core.sceneSVG(core.interiorView('well', { level: 1, maxLevel: 3, storeFill: 0 }), 'x');
const full = core.sceneSVG(core.interiorView('well', { level: 1, maxLevel: 3, storeFill: 1 }), 'x');
if (dry === full) throw new Error('stores ignored');
// An upgrade under way drapes the room; the plot never does.
const rising = core.sceneSVG(core.interiorView('farm', { level: 1, maxLevel: 3, rising: true }), 'x');
const still = core.sceneSVG(core.interiorView('farm', { level: 1, maxLevel: 3, rising: false }), 'x');
if (rising === still) throw new Error('scaffold missing');
const plot = core.sceneSVG(core.interiorView('farm', { level: 0, maxLevel: 3 }), 'x');
if (!plot.includes('stroke-dasharray')) throw new Error('no staked plot');
// The view clamps hostile shapes instead of throwing.
const v = core.interiorView('well', { level: 99, maxLevel: 3, workersPosted: 9, workersNeeded: 1, storeFill: 7 });
if (v.level !== 3 || v.workers.posted !== 1 || v.storeFill !== 1) throw new Error('clamps failed');
console.log('ok');
""" % json.dumps(str(CORE))
    out = subprocess.run(["node", "-e", script], capture_output=True, text=True, timeout=60)
    assert out.returncode == 0, out.stderr
    assert "ok" in out.stdout


# ---------------------------------------------------------------------------
# 2. The door: tap a building, step inside
# ---------------------------------------------------------------------------

def test_every_village_yard_knows_which_building_it_is():
    html = html_text()
    # econLabel carries the building id onto the mesh the raycast walks to.
    assert "const econLabel = (group, text, _height, buildingId) => {" in html
    assert "if (buildingId) group.userData.buildingId = buildingId;" in html
    for call in (
        "2.3, 'cabin');", "2.3, 'hut');", "2.4, 'farm');", "3.1, 'well');",
        "2.2, 'lumber');", "2.1, 'quarry');", "2.2, 'lumberhut');",
        "2.3, 'minehut');", "2.5, 'chapel');", "2.9, b.id);",
    ):
        assert call in html, call
    # The yards that never answered a tap before answer now.
    assert "cottage.userData.buildingId = 'cottages';" in html
    assert "stall.userData.buildingId = 'market';" in html
    assert "shed.userData.buildingId = 'storehouse';" in html
    assert "tavern.userData.buildingId = 'tavern';" in html


def test_a_village_tap_opens_the_interior():
    html = html_text()
    # The raycast parent-walk recognises a building id...
    assert "obj.userData.buildingId === undefined) obj = obj.parent;" in html
    # ...and the tap opens the door before the shop path can claim it.
    assert "if (obj && obj.userData.buildingId) openBuildingInterior(currentVillage().seed, obj.userData.buildingId);" in html
    # The inspector chip offers the same door.
    info = function_source(html, "villageSceneContextInfo")
    assert "actionLabel: 'ENTER'" in info
    assert "openBuildingInterior(v.seed, building.id)" in info


def test_a_town_tap_opens_the_same_interior():
    html = html_text()
    # The tested raycast call stays; the sheet function now opens the door.
    assert "openTownBuildingSheet(obj.userData.wardSeed, obj.userData.buildingId)" in html
    sheet = function_source(html, "openTownBuildingSheet")
    assert "openBuildingInterior(seed, buildingId, 'town')" in sheet
    # The ledger rows walk through the same door.
    ledger = function_source(html, "townLedgerSheetHTML")
    assert 'data-action="sheet-building"' in ledger


def test_the_overlay_is_the_shop_pattern_with_the_room_on_top():
    html = html_text()
    assert 'id="buildingInteriorOverlay"' in html
    render = function_source(html, "renderBuildingInterior")
    # Settle the clocks before reading the room.
    assert "empireCompleteConstructions();" in render
    assert "simulateVillageEconomy(rec, Date.now());" in render
    # The core draws the room from the building's real state.
    assert "core.sceneSVG(core.interiorView(building.id, facts)" in render
    # A ward folded into a Town gets the tested town card; a lone village
    # gets the desk's card moved indoors.
    assert "townBuildingSheetHTML(settle, rec, building.id)" in render
    assert "villageBuildingSheetHTML(rec, building.id)" in render
    assert 'class="shop-panel building-interior-panel"' in render
    # All three doors are exported for inline handlers.
    assert "openBuildingInterior, closeBuildingInterior, buildingInteriorBuild," in html


def test_the_interior_build_button_keeps_every_gate():
    html = html_text()
    card = function_source(html, "villageBuildingSheetHTML")
    assert "★ FULLY BUILT" in card
    assert "🏗️ BUILDING" in card
    assert "🔒 UNLOCKS AT TRAINER LV" in card
    assert "buildingInteriorBuild(" in card
    assert "buildCostChipsHTML(cost, villageBuildDurationMs(rec.seed, b, level))" in card
    build = function_source(html, "buildingInteriorBuild")
    # The same function and gates the desk always used.
    assert "empireBuildStructure(seed, buildingId);" in build
    facts = function_source(html, "buildingInteriorFacts")
    # The scene reads real stores, not decoration.
    assert "villageStoreCapacity(rec, 'water')" in facts
    assert "villageCrewShare(building, crew)" in facts


def test_the_alehouse_pours_from_inside():
    html = html_text()
    card = function_source(html, "villageBuildingSheetHTML")
    assert "STEP UP TO THE BAR" in card
    render = function_source(html, "renderBuildingInterior")
    assert "villageOpenShop('tavern')" in render


def test_the_fallback_village_still_opens_every_built_door():
    fallback = function_source(html_text(), "renderVillageFallback")
    assert "openBuildingInterior(" in fallback
    assert "Step inside and run it" in fallback


# ---------------------------------------------------------------------------
# 3. The declutter: tiles for cards, rooms for essays
# ---------------------------------------------------------------------------

def test_the_desk_grid_is_door_tiles_now():
    html = html_text()
    desk = function_source(html, "renderVillageManagePanel")
    assert 'class="province-build-grid is-tiles"' in desk
    assert 'data-action="enter-building"' in desk
    assert "Tap a building to step inside and run it." in desk
    # The old card wall is gone from the desk.
    assert "province-building-head" not in desk
    assert "empireBuildStructure(' + (rec.seed" not in desk
    # The dead settlement line and the vestigial drawer binding went too.
    assert "Village centre of " not in desk
    assert "data-empire-drawer" not in desk


def test_the_town_networks_are_door_tiles_now():
    html = html_text()
    screen = function_source(html, "renderTownScreen")
    assert 'class="province-desk-hint">🚪 Tap a building to step inside and run it.</div><div class="town-network-grid is-tiles"' in screen
    assert 'data-action="town-enter"' in screen
    # A tile enters at the ward the town's builders would pick.
    assert "townNetworkUpgradeTarget(settle, building.id) || townMemberRecords(settle)[0]" in screen
    assert "openBuildingInterior(tile.dataset.seed, tile.dataset.building, 'town')" in screen
    # The verbose network cards are gone.
    assert "RAISE NETWORK" not in screen
    assert "' Network</span>" not in screen


def test_the_absorbed_town_sections_are_really_gone():
    html = html_text()
    assert "INVEST IN FUN" not in html
    assert "townEntertainmentSection" not in html
    assert "townMetalSection" not in html
    assert "function entertainmentSectionHtml(" not in html
    assert "function metalWorksSectionHtml(" not in html
    # The mechanics they fronted still stand: the entertainment yard builds
    # through the same tiles, and the foundry keeps pouring for the Forge.
    assert "'entertainment'" in html
    assert "iron_ingot" in html


def test_the_retired_desk_css_left_no_dead_rules():
    html = html_text()
    assert ".province-settlement {" not in html
    assert ".province-crew {" not in html
    assert ".province-building {" not in html
    # The pips style survives — tiles and the interior head both wear it.
    assert ".province-building-pips {" in html
    assert ".province-tile {" in html


# ---------------------------------------------------------------------------
# 4. Release plumbing — what actually reaches a refreshed phone
# ---------------------------------------------------------------------------

def test_release_is_versioned_and_the_new_core_is_precached_everywhere():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    assert f'<script src="building_interior_core.js?v={OWN_RELEASE_PIN}"></script>' in html
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert OWN_RELEASE_PIN in cache_line
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    # The core rides all three precache arrays, install-required included.
    assert sw.count(f"./building_interior_core.js?v={OWN_RELEASE_PIN}") == 3
    assert DEPLOY.exists()
    assert '"building_interior_core.js"' in DEPLOY.read_text(encoding="utf-8")
