# -*- coding: utf-8 -*-
"""The Empire screen is a box of boxes now (empire-grid-v322-20260825).

Yaan's ask, from a screenshot of the Empire screen:

    "instead of the villages tab the way it is there, where you press the 5
     and it does a dropdown menu, can you have it so that each village will
     have a little square? In that square I want the icon of the bird that
     is assigned as the project manager and the player can click on either
     one of those squares to open the village straight away below it, below
     that box of boxes. Move the Collect Taxes and Produce button above the
     box that I've drawn on. The little boxes have them in different colours
     depending on what is needed in the village and then apply that to the
     towns tab as well... the birds who are the Lord Mayor of the town and
     then it'll be the same for the counties."

So, pinned here:

- one square per holding, in three tiers — 🛡️ COUNTIES, 🏘️ TOWNS,
  🏡 VILLAGES — with no drop-down left to press,
- the bird holding that holding's civic post is painted inside its square,
  and an empty desk is visibly empty,
- the square's colour is the one thing that holding wants most, chosen by a
  pure ladder in empire_grid_core.js,
- one tap opens the holding; the village opens directly below the boxes,
- COLLECT TAXES & PRODUCE sits ABOVE the boxes,
- a town's desk is the LORD MAYOR's, the village's stays Project Manager,
  and both are still one role and one save slot.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
SW = ROOT / "sw.js"
CORE = ROOT / "empire_grid_core.js"

OWN_RELEASE_PIN = "empire-grid-v322-20260825"
# Later releases ship over the top. This one edited bird_roles_core.js, so its
# own tag stays on that core while the head build moves on without it.
CURRENT_BUILD = "trail-mode-v329-20260825"
PREVIOUS_RELEASE_PIN = "free-birds-v318-20260824"


def html_text() -> str:
    return HTML_PATH.read_text(encoding="utf-8")


def function_source(html: str, name: str) -> str:
    start = html.index("function %s(" % name)
    end = html.find("\nfunction ", start + 10)
    assert end > start, name
    return html[start:end]


def empire_panel() -> str:
    return function_source(html_text(), "renderEmpirePanel")


def run_core(source: str):
    """Run the grid core in bare Node — it must never need a browser."""
    script = "const grid = require(%s);\n%s" % (json.dumps(str(CORE)), source)
    proc = subprocess.run(["node", "-e", script], cwd=ROOT, text=True,
                          encoding="utf-8", capture_output=True, timeout=60)
    assert proc.returncode == 0, proc.stderr
    return json.loads(proc.stdout)


# ---------------------------------------------------------------------------
# 1. The ladder — one holding says one thing
# ---------------------------------------------------------------------------

HEALTHY = "{ pop:20, happiness:0.8, posted:true, postTitle:'Project Manager' }"


def test_the_ladder_answers_with_the_most_urgent_thing_first():
    out = run_core("""
      const at = extra => grid.holdingNeed(Object.assign(
        { pop:20, happiness:0.8, posted:true, postTitle:'Project Manager' }, extra));
      console.log(JSON.stringify({
        empty:   at({ pop:0, happiness:0.1, mergeReady:true, posted:false, freeCrews:3 }).id,
        unhappy: at({ happiness:0.2, posted:false, freeCrews:3 }).id,
        star:    at({ mergeReady:true, posted:false, freeCrews:3 }).id,
        vacant:  at({ posted:false, freeCrews:3 }).id,
        idle:    at({ freeCrews:1 }).id,
        busy:    at({ freeCrews:0, building:true }).id,
        well:    at({}).id
      }));
    """)
    assert out == {
        "empty": "empty", "unhappy": "unhappy", "star": "star", "vacant": "vacant",
        "idle": "idle", "busy": "busy", "well": "well",
    }


def test_an_empty_village_reads_empty_before_it_reads_unhappy():
    """A hamlet with nobody in it is not 'sad' — it needs homes."""
    out = run_core("""
      console.log(JSON.stringify({
        none: grid.holdingNeed({ pop:0, happiness:0, posted:true }).id,
        few:  grid.holdingNeed({ pop:1, happiness:0, posted:true }).id
      }));
    """)
    assert out == {"none": "empty", "few": "unhappy"}


def test_the_unhappy_line_is_drawn_at_half():
    out = run_core("""
      const at = h => grid.holdingNeed({ pop:20, happiness:h, posted:true }).id;
      console.log(JSON.stringify({
        threshold: grid.UNHAPPY_BELOW, just_under: at(0.49), exactly: at(0.5), over: at(0.51)
      }));
    """)
    assert out["threshold"] == 0.5
    assert out["just_under"] == "unhappy"
    assert out["exactly"] == "well"
    assert out["over"] == "well"


def test_a_signal_a_tier_cannot_report_never_trips_its_rung():
    """A county has no crews and no merge star. Passing neither must not read
    as 'a crew is free' or as a vacant desk."""
    out = run_core("""
      console.log(JSON.stringify({
        county: grid.holdingNeed({ pop:300, happiness:0.9, posted:true }).id,
        // `posted` absent entirely is not the same as `posted:false`.
        silent: grid.holdingNeed({ pop:300, happiness:0.9 }).id,
        empty_input: grid.holdingNeed().id,
        junk_input: grid.holdingNeed('nonsense').id
      }));
    """)
    assert out == {"county": "well", "silent": "well",
                   "empty_input": "empty", "junk_input": "empty"}


def test_a_vacant_desk_names_the_post_it_is_missing():
    out = run_core("""
      const vacant = t => grid.holdingNeed({ pop:20, happiness:0.9, posted:false, postTitle:t }).label;
      console.log(JSON.stringify({
        village: vacant('Project Manager'),
        town:    vacant('Lord Mayor'),
        county:  vacant('Warden'),
        unnamed: vacant('')
      }));
    """)
    assert out["village"] == "No Project Manager"
    assert out["town"] == "No Lord Mayor"
    assert out["county"] == "No Warden"
    assert out["unnamed"] == "Nobody in charge"


def test_a_full_strongbox_rides_beside_the_colour_and_never_becomes_one():
    """The chest is collected in one press above the boxes, so 'taxes are
    waiting' must never outrank 'these folk are starving'."""
    out = run_core("""
      const paid = grid.holdingNeed({ pop:20, happiness:0.2, posted:true, tributeReady:true });
      const quiet = grid.holdingNeed({ pop:20, happiness:0.9, posted:true, tributeReady:false });
      console.log(JSON.stringify({
        still_unhappy: paid.id, carries_coin: paid.tributeReady, no_coin: quiet.tributeReady
      }));
    """)
    assert out == {"still_unhappy": "unhappy", "carries_coin": True, "no_coin": False}


def test_every_rung_carries_a_tone_an_icon_and_a_line_of_words():
    out = run_core("""
      console.log(JSON.stringify({
        needs: grid.NEEDS.map(n => [n.id, n.tone, !!n.icon, !!n.label]),
        tones: grid.TONES,
        legend: grid.TONE_LEGEND.map(r => r.tone),
        unknown: grid.needById('nonsense')
      }));
    """)
    ids = [row[0] for row in out["needs"]]
    assert ids == ["empty", "unhappy", "star", "vacant", "idle", "busy", "well"]
    assert all(row[2] and row[3] for row in out["needs"]), out["needs"]
    # Five colours, no more: a key nobody can hold in their head is no key.
    assert out["tones"] == ["red", "violet", "gold", "blue", "green"]
    assert set(row[1] for row in out["needs"]) == set(out["tones"])
    assert out["legend"] == out["tones"]
    assert out["unknown"] is None


def test_the_tier_line_counts_the_holdings_that_want_you():
    out = run_core("""
      const needs = [
        grid.holdingNeed({ pop:0 }),                                         // red
        grid.holdingNeed({ pop:9, happiness:0.9, posted:false }),            // amber
        grid.holdingNeed({ pop:9, happiness:0.9, posted:true, building:true, tributeReady:true }),
        grid.holdingNeed({ pop:9, happiness:0.9, posted:true })              // green
      ];
      console.log(JSON.stringify({
        summary: grid.tierSummary(needs),
        wants: grid.NEEDS.map(n => [n.id, grid.needWantsYou(n.id)]),
        junk: grid.tierSummary('nonsense')
      }));
    """)
    assert out["summary"] == {"total": 4, "wanting": 2, "paying": 1}
    # Green is the only "nothing wanted" colour, on either of its two rungs.
    assert dict(out["wants"]) == {
        "empty": True, "unhappy": True, "star": True, "vacant": True,
        "idle": True, "busy": False, "well": False,
    }
    assert out["junk"] == {"total": 0, "wanting": 0, "paying": 0}


def test_the_core_reads_no_game_globals():
    """It runs in bare Node, so it must not reach for the page."""
    src = CORE.read_text(encoding="utf-8")
    body = src.split("function (root, factory)", 1)[1]
    for forbidden in ("gameState", "document.", "window.", "$(", "escapeHtml"):
        assert forbidden not in body, forbidden


# ---------------------------------------------------------------------------
# 2. Three tiers of squares, and no drop-down left
# ---------------------------------------------------------------------------

def test_the_three_tiers_are_grids_of_squares_in_ladder_order():
    panel = empire_panel()
    block = panel[panel.index("const tiersHtml"):panel.index("// Order on screen")]
    assert '<div class="empire-tiers">' in block
    for tier in ("'tier-villages', '🏡', 'VILLAGES'",
                 "'tier-towns', '🏘️', 'TOWNS'",
                 "'tier-counties', '🛡️', 'COUNTIES'"):
        assert tier in block, tier
    # # Yaan asked for villages first (2026-08-24): they are the whole empire
    # until a Town rises, and still the rung you visit most after one does.
    assert block.index("'tier-villages'") < block.index("'tier-towns'") < block.index("'tier-counties'")
    # Every tier is built from tiles, never from rows.
    for tiles in ("countyTiles", "townTiles", "villageTiles"):
        assert tiles in block, tiles
    html = html_text()
    assert '<div class="empire-grid">' in html
    assert "rows.map(empireTileHTML).join('')" in html


def test_nothing_under_the_map_unfolds_any_more():
    html = html_text()
    for gone in ("empireNavTabHTML", "empire-nav-tabs", "is-nav-tab", 'name="empire-nav"'):
        assert gone not in html, gone
    # And the row markup the squares replaced left no dead CSS behind.
    for gone in (".settlement-row", ".settlement-section", ".empire-group-title",
                 ".evr-badge", ".region-ready-chip", ".realm-lead"):
        assert gone not in html, gone


def test_the_tax_chest_is_above_the_boxes():
    """Yaan's ask: you empty the chest, then you go somewhere."""
    panel = empire_panel()
    block = panel[panel.index("  panel.innerHTML =\n"):panel.index("panel.querySelectorAll")]
    assert block.index("empire-tribute-btn") < block.index("tiersHtml")
    assert "COLLECT TAXES &amp; PRODUCE" in block
    assert block.count("empire-tribute-btn") == 1


# ---------------------------------------------------------------------------
# 3. The bird in the square
# ---------------------------------------------------------------------------

def test_the_square_holds_the_bird_that_runs_the_place():
    art = function_source(html_text(), "empireTileArtHTML")
    # A staffed post is the bird itself, drawn by the shared cutout helper.
    assert "birdOnlyImgHTML(post.bird, 'empire-tile-bird')" in art
    # An empty desk is visibly empty: the holding's own banner, greyed out.
    assert "is-vacant" in art
    rule = "span.empire-tile-bird.is-vacant {"
    html = html_text()
    assert rule in html
    greyed = html[html.index(rule):html.index("}", html.index(rule))]
    assert "grayscale(1)" in greyed and "opacity:" in greyed, greyed


def test_each_tier_reads_its_own_civic_desk():
    html = html_text()
    village = function_source(html, "empireVillageTile")
    town = function_source(html, "empireTownTile")
    county = function_source(html, "empireCountyTile")
    assert "rolePostState('village', String(v.seed >>> 0))" in village
    # A merged holding keeps ONE desk, at its heart — see ensureTownSteward.
    assert "rolePostState('village', String(Number(s.heartSeed) >>> 0))" in town
    assert "rolePostState('region', String(region.id))" in county
    for src, title in ((village, "EMPIRE_POST_TITLES.village"),
                       (town, "EMPIRE_POST_TITLES.town"),
                       (county, "EMPIRE_POST_TITLES.county")):
        assert "postTitle = %s" % title in src, title


def test_the_square_says_who_runs_it_out_loud_for_a_screen_reader():
    tile = function_source(html_text(), "empireTileHTML")
    assert "birdDisplayName(tile.post.bird) : 'nobody yet'" in tile
    assert "tile.name + ' · ' + need.label + ' · ' + tile.postTitle + ': ' + who" in tile
    assert 'aria-label="' in tile and 'title="' in tile
    assert "escapeHtml(label)" in tile


# ---------------------------------------------------------------------------
# 4. What each tier feeds the ladder
# ---------------------------------------------------------------------------

def test_a_village_square_reads_folk_crews_stars_and_a_full_cycle():
    tile = function_source(html_text(), "empireVillageTile")
    assert "pop:snap.pop, happiness:snap.happiness" in tile
    # Idle crews, not free ones (manager-builds-the-village-v324): a Project
    # Manager's own crew is never idle, so a village that is quietly building
    # itself reads "Building" rather than "a crew is free".
    assert "freeCrews: villageIdleCrews(v)" in tile
    assert "villageBuildSlotsFree(rec)" in function_source(html_text(), "villageIdleCrews")
    assert "building: !!villageConstructionFor(v)" in tile
    assert "mergeReady: !!(ready && ready.ready)" in tile
    # A WHOLE cycle banked, the same test the nav badge uses. "Something has
    # accrued" is true every second and would pin the coin on for ever.
    assert "Math.floor(empireVillageTributePeriods(v, Date.now())) > 0" in tile


def test_a_town_square_reads_the_settlement_not_one_of_its_wards():
    tile = function_source(html_text(), "empireTownTile")
    assert "canonicalEmpireSettlement(settlement)" in tile
    assert "townEconomySnapshot(s)" in tile
    assert "const busy = townActiveProjectCount(s);" in tile
    assert "freeCrews: Math.max(0, townBuilderSlots(s) - busy)" in tile
    assert "townMergeReady(s)" in tile
    assert "townHasAccruedTribute(s, Date.now())" in tile


def test_a_county_square_weighs_its_holdings_by_how_many_folk_live_there():
    """One thriving town must not paper over a starving hamlet beside it."""
    tile = function_source(html_text(), "empireCountyTile")
    assert "empireRegionHoldings(region)" in tile
    assert "holding.kind === 'settlement' ? townEconomySnapshot(holding.settlement) : villageEconomySnapshot(holding.village)" in tile
    assert "const w = Math.max(1, snap.pop);" in tile
    assert "happiness: weight ? cheer / weight : 1" in tile
    # A county has no crews and no yards, so it passes neither.
    assert "freeCrews" not in tile and "building:" not in tile
    assert "(regionTributeReady(region).wholeCycleHoldings || 0) > 0" in tile


# ---------------------------------------------------------------------------
# 5. One tap opens it
# ---------------------------------------------------------------------------

def test_one_tap_on_a_square_opens_that_holding():
    html = html_text()
    panel = empire_panel()
    for action, opener in (('empire-village', 'openEmpireVillage(row.dataset.seed)'),
                           ('empire-settlement', 'openEmpireTown(btn.dataset.settlement)'),
                           ('empire-region', 'openEmpireRegion(btn.dataset.region)')):
        assert 'data-action="%s"' % action in panel, action
        assert opener in panel, opener
    # The squares carry exactly those actions — the wiring cannot drift.
    assert "action:'empire-village'" in function_source(html, "empireVillageTile")
    assert "action:'empire-settlement'" in function_source(html, "empireTownTile")
    assert "action:'empire-region'" in function_source(html, "empireCountyTile")


def test_the_village_opens_directly_below_the_boxes():
    """#empirePanel holds the boxes; #empireVillageHub is the very next node,
    so 'open the village below the box of boxes' is the screen's own order."""
    html = html_text()
    screen = html[html.index('<div class="screen" id="screen-village">'):html.index('id="villageStage"')]
    assert screen.index('<div id="empirePanel"></div>') < screen.index('id="empireVillageHub"')
    # And opening one redraws the panel, so the square lights up as active.
    assert "renderEmpirePanel();" in function_source(html, "renderVillage")


def test_the_holding_you_are_standing_in_is_marked():
    html = html_text()
    assert "(tile.active ? ' is-active' : '')" in function_source(html, "empireTileHTML")
    assert "villageActive && String(villageActive.seed >>> 0)" in function_source(html, "empireVillageTile")
    assert "String(townActiveId || '') === String(s.id)" in function_source(html, "empireTownTile")
    assert "String(regionHallActiveId || '') === String(region.id)" in function_source(html, "empireCountyTile")
    assert ".empire-tile.is-active {" in html


def test_the_counties_tier_stands_whenever_a_merge_is_ready_to_sign():
    """The MERGE INTO ONE COUNTY button renders inside the Counties tier, so
    gating the tier on regions.length alone hides the only way to found one."""
    panel = empire_panel()
    assert "const showCounties = !!(regions.length || regionCandidates.length);" in panel
    assert "lead:regionMergeBanners" in panel
    assert "lead:townMergeBanners" in panel


# ---------------------------------------------------------------------------
# 6. Colours the player can actually read
# ---------------------------------------------------------------------------

def test_every_tone_has_a_border_a_wash_and_a_dot_in_the_key():
    html = html_text()
    for tone in ("red", "violet", "gold", "blue", "green"):
        rule = ".empire-tile.is-%s {" % tone
        assert rule in html, rule
        body = html[html.index(rule):html.index("}", html.index(rule))]
        assert "--tile-line:" in body and "--tile-wash:" in body, tone
        assert ".egk-dot.is-%s {" % tone in html, tone
    assert "function empireGridKeyHTML(" in html
    assert "gc.TONE_LEGEND.map" in html
    assert ".empire-grid-key {" in html


def test_the_squares_really_are_squares_and_wrap_on_a_phone():
    html = html_text()
    grid = html[html.index(".empire-grid {"):html.index("}", html.index(".empire-grid {"))]
    assert "repeat(auto-fill,minmax(64px,1fr))" in grid
    tile = html[html.index(".empire-tile {"):html.index("}", html.index(".empire-tile {"))]
    assert "aspect-ratio:1" in tile


def test_the_caption_each_tab_carried_survived_as_a_tier_subtitle():
    """The boxes replaced the drop-down; they did not unteach the ladder."""
    panel = empire_panel()
    for copy in ("'Merge 3 starred Towns into a County — titles and trade live here'",
                 "'Merge 3 starred villages into a Town — you choose when'",
                 "'Grow each village to its ⭐ merge star: 16 folk, 75% happy'"):
        assert copy in panel, copy
    assert ".empire-tier-copy {" in html_text()


# ---------------------------------------------------------------------------
# 7. The Lord Mayor's chain
# ---------------------------------------------------------------------------

def test_a_town_desk_is_the_lord_mayors_and_a_village_desk_is_not():
    html = html_text()
    assert "const EMPIRE_POST_TITLES = { village:'Project Manager', town:'Lord Mayor', county:'Warden' };" in html
    # one-tap-appointments-v320 took the head off the card and put it in the
    # shared sheet, so the title is DERIVED now rather than passed by each
    # caller: rolePostTitle asks empirePostTitleFor, and the badge, the desk
    # row, the sheet head and the holder line all read the one answer. The
    # chain is unchanged — a Town's heart is still the Lord Mayor's desk.
    assert "function rolePostTitle(scope, key, role)" in html
    assert "empirePostTitleFor(scope, key)" in function_source(html, "rolePostTitle")
    assert "title:EMPIRE_POST_TITLES.town" not in html       # no caller passes it
    for surface in ("rolePostBadgeHTML", "rolePostRowHTML", "rolePickerSheetHTML"):
        assert "rolePostTitle(scope, key, role)" in function_source(html, surface), surface


def test_one_role_and_one_save_slot_still_serve_both_desks():
    """The chain is a name. Nothing about the save moved."""
    core = (ROOT / "bird_roles_core.js").read_text(encoding="utf-8")
    assert "id:'steward', title:'Project Manager'" in core
    assert "scope:'village'" in core
    assert "'Lord Mayor'" not in core.split("const ROLES", 1)[1].split("]", 1)[0]
    html = html_text()
    # Both desks still address the same bucket, keyed by seed — through the
    # one-tap row since v320, which opens the shared sheet.
    assert "rolePostRowHTML('village', String(rec.seed >>> 0)" in html
    assert "rolePostRowHTML('village', String(Number(settle.heartSeed) >>> 0)" in html


def test_every_line_that_names_the_post_says_the_same_thing():
    html = html_text()
    namer = function_source(html, "empirePostTitleFor")
    assert "empireSettlementOfSeed(Number(key) >>> 0)) return EMPIRE_POST_TITLES.town" in namer
    # The toasts and the bird card all read through it...
    for site in ("birdPostLabel", "assignBirdRole", "clearBirdRole"):
        assert "empirePostTitleFor" in function_source(html, site), site


def test_naming_the_post_never_breaks_a_bare_node_harness():
    """Several suites lift these functions out of index.html one at a time.
    Shared code must not force every harness to grow a new dependency."""
    html = html_text()
    for site in ("birdPostLabel", "assignBirdRole", "clearBirdRole"):
        src = function_source(html, site)
        assert "typeof empirePostTitleFor === 'function'" in src, site


# ---------------------------------------------------------------------------
# 8. Release plumbing
# ---------------------------------------------------------------------------

def test_the_new_core_is_loaded_by_the_page_and_precached_by_the_worker():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert 'src="empire_grid_core.js?v=%s"' % OWN_RELEASE_PIN in html
    # Every list the worker installs from carries it, or an offline game
    # opens the Empire screen on a blank panel.
    assert sw.count("'./empire_grid_core.js?v=%s'" % OWN_RELEASE_PIN) == 3
    for block in ("BURBZ_ASSETS", "BURBZ_CORE", "BURBZ_INSTALL_REQUIRED"):
        body = sw.split("const %s = [" % block, 1)[1].split("];", 1)[0]
        assert "empire_grid_core.js" in body, block
    stale = [m for m in re.findall(r"empire_grid_core\.js\?v=([A-Za-z0-9.-]+)", html + sw)
             if m != OWN_RELEASE_PIN]
    assert not stale, stale
    # And the manual VPS updater ships it too.
    assert '"empire_grid_core.js"' in (ROOT.parents[1] / "scripts" / "update-live-burbz.sh").read_text(encoding="utf-8")


def test_release_is_versioned_so_a_refresh_actually_lands_the_boxes():
    html = html_text()
    sw = SW.read_text(encoding="utf-8")
    assert "const BURBZ_BUILD = '%s';" % CURRENT_BUILD in html
    cache_line = next(l for l in sw.splitlines() if l.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line, "the lineage is append-only"
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
