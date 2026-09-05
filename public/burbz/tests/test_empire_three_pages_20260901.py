"""empire-three-pages-v343-20260901 — the Empire tab is three pages.

Yaan's ask, from a screenshot of the Empire tab: people cannot work out how
to do things there. Make it three very clear screens they can swipe through
— the whole empire (regions), the towns, the villages — with no writing
that does not need to be there, and take no feature away. The game teaches
bit by bit through tutorials, not through paragraphs on the screen.

What this suite pins:
- The Empire screen holds a tab strip (EMPIRE · TOWNS · VILLAGES) and a
  page track with exactly those three pages, map first, then towns, then
  the villages with the village hub inside the villages page.
- The tax chest stands above the pages, on screen whichever page is open.
- A sideways drag turns the page; the village carousel, the page track and
  the dock road nest through one claim flag, innermost first, edges outward.
- Every caption waits behind an eye; a rung not yet reached is one faded
  square with a count, and an empty empire is one gold button.
- Merlin's Realm chapter walks the pages; two new page lessons fire when a
  page first has something to teach.
- The release is versioned for the service worker.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
OWN = "empire-three-pages-v343-20260901"
CURRENT_BUILD = "little-folk-residents-v350-20260905"


def function_source(name: str) -> str:
    start = HTML.index("function " + name + "(")
    return HTML[start:HTML.index("\nfunction ", start + 10)]


# ---- release plumbing -------------------------------------------------------

def test_build_id_and_cache_segment():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    # Membership, never the tail — the next release appends after us.
    assert OWN in SW


# ---- the three pages --------------------------------------------------------

def test_the_screen_is_a_tab_strip_and_three_pages():
    screen = HTML[HTML.index('<div class="screen" id="screen-village">'):HTML.index('<div class="screen" id="screen-region">')]
    assert 'id="empirePagesNav" role="tablist"' in screen
    tabs = re.findall(r'<button type="button" class="empire-page-tab" data-empire-page="(\w+)"', screen)
    assert tabs == ["realm", "towns", "villages"]
    labels = re.findall(r'<span class="ept-label">([A-Z]+)</span>', screen)
    assert labels == ["EMPIRE", "TOWNS", "VILLAGES"]
    pages = re.findall(r'<section class="empire-page" id="(\w+)" data-empire-page="(\w+)">', screen)
    assert pages == [("empirePageRealm", "realm"), ("empirePageTowns", "towns"), ("empirePageVillages", "villages")]
    # The map leads the realm page; the village hub lives inside the villages page.
    assert screen.index('id="empirePageRealm"') < screen.index('id="empireMapCard"') < screen.index('id="empireRealmPanel"')
    assert screen.index('id="empirePageTowns"') < screen.index('id="empireTownsPanel"') < screen.index('id="empirePageVillages"')
    assert screen.index('id="empirePageVillages"') < screen.index('<div id="empirePanel"></div>') < screen.index('id="empireVillageHub"')
    # The dock's own </nav> is still the first one on the page.
    assert "<nav" not in screen


def test_the_tax_chest_stands_above_the_pages():
    screen = HTML[HTML.index('<div class="screen" id="screen-village">'):HTML.index('<div class="screen" id="screen-region">')]
    assert screen.index('id="empireCollectBar"') < screen.index('id="empirePagesNav"') < screen.index('id="empirePages"')
    render = function_source("renderEmpirePanel")
    assert "COLLECT TAXES &amp; PRODUCE" in render
    assert "collectBar.appendChild(chest)" in render


def test_the_panel_writes_all_three_pages():
    render = function_source("renderEmpirePanel")
    assert "townsPanel.innerHTML = townsHtml" in render
    assert "realmPanel.innerHTML = countiesHtml" in render
    # Merge banners sit with the things they merge: villages on the villages
    # page, towns on the towns page.
    assert "villageTiles, { lead:townMergeBanners" in render
    assert "townTiles, { lead:regionMergeBanners" in render
    # A rung not reached is one faded square with a count.
    assert "ghostHTML('🏘️', starredVillages, 3" in render
    assert "ghostHTML('🛡️', readyTownsForGhost, 3" in render
    # An empty empire is one gold button, no numbered steps.
    assert 'data-action="empire-first-village"' in render
    assert "empire-onboarding-step" not in render
    # The listeners are bound across every page's panel.
    assert "const bind = (selector, handler) => panels.forEach" in render


def test_only_the_open_page_takes_height_and_the_peek_is_visible():
    assert ".empire-page:not(.is-active) { position:absolute; top:0; left:0; width:100%; visibility:hidden; pointer-events:none; }" in HTML
    assert ".empire-page.is-peek { visibility:visible; }" in HTML
    assert ".empire-pages-nav { display:grid; grid-template-columns:repeat(3,1fr);" in HTML


# ---- the page track and the nested swipes -----------------------------------

def test_the_pager_turns_pages_and_lands_where_the_player_is_going():
    assert "const EMPIRE_PAGES = ['realm', 'towns', 'villages'];" in HTML
    show = function_source("showEmpirePage")
    assert "empireMap.resize()" in show          # the map learns its size when its page returns
    assert "setTimeout(onVillageResize, 60)" in show
    assert "maybeStartMerlinEmpirePageChapter(name)" in show
    default = function_source("empireDefaultPage")
    assert "empireVillages().length ? 'villages' : 'realm'" in default
    switch = function_source("switchScreen")
    assert "bindEmpirePager(); showEmpirePage(empireLedgerOnlyMode ? 'realm' : empireDefaultPage(), { silent:true }); renderVillage();" in switch
    assert "showEmpirePage('villages', { silent:true, keepScroll:true });" in function_source("openEmpireVillage")
    assert "showEmpirePage('villages', { silent:true, keepScroll:true });" in function_source("visitEmpireWard")
    assert "showEmpirePage('realm', { silent:true });" in function_source("showTownOnAtlas")
    assert "window.showEmpirePage = showEmpirePage;" in HTML


def test_three_sideways_gestures_nest_through_one_claim_flag():
    assert "let sideSwipeClaimed = false;" in HTML
    pager = function_source("bindEmpirePager")
    assert "if (sideSwipeClaimed) { drop(); return; }" in pager      # the carousel took it
    assert "if (!name) { drop(); return; }" in pager                 # the edge hands it to the road
    assert "sideSwipeClaimed = true;" in pager
    assert "closest('#empireMapCard, .village-stage, input, textarea, select')" in pager
    hub = function_source("bindVillageSwipe")
    assert "villageSwipeCanMove(dx < 0 ? 1 : -1)" in hub
    assert "if (villageSwipeYielded) return;" in hub
    can_move = function_source("villageSwipeCanMove")
    assert "return delta > 0 ? at < roster.length - 1 : at > 0;" in can_move
    road = function_source("bindScreenSwipe")
    assert "if (axis === 'x' && sideSwipeClaimed) { drop(); return; }" in road
    # Every new touch on the road starts unclaimed — a stale claim from the
    # village carousel must never eat a flick on another screen.
    assert road.index("sideSwipeClaimed = false;") < road.index("if (tracking) { abandon(); return; }")


def test_a_hidden_page_does_not_render_its_3d_stage():
    view = function_source("settlementSceneStageInViewport")
    assert "stage.closest('.empire-page:not(.is-active)')" in view


# ---- the writing goes behind the eye ----------------------------------------

def test_captions_wait_behind_eyes():
    tier = function_source("empireTierHTML")
    assert "infoDotHTML(noteId, 'About ' + label.toLowerCase())" in tier
    assert "empireGridKeyHTML()" in tier
    assert "<span class=\"empire-tier-copy\">" not in tier
    render = function_source("renderEmpirePanel")
    for note in ("infoNoteVillageStar", "infoNoteTownStar", "infoNoteTradeNudge", "infoNoteLadderNudge", "infoNoteFirstVillage"):
        assert render.count(note) >= 2, note
    # The merge banner keeps its button and its title; its sentence waits behind an eye.
    assert "infoNoteHTML('infoNoteMerge-' + action" in render


def test_the_village_desk_and_hub_lost_their_captions():
    desk = function_source("renderVillageManagePanel")
    assert "infoNoteHTML('infoNoteVillageDesk', 'Tap a building to step inside and run it.')" in desk
    assert "'<div class=\"province-desk-hint\">🚪 Tap a building" not in desk
    assert desk.count("infoNoteTownWorks") >= 2
    village = function_source("renderVillage")
    assert "bep-dot" in village                      # dots, not "1 of 3 villages — swipe for the next"
    assert "pager.setAttribute('aria-label'" in village
    assert "Walk the shared square of" not in village
    assert "infoNoteVillageStage" in village
    assert "open trade routes from the Empire page once a second county stands" in HTML
    assert "from the Counties tab" not in HTML


# ---- Merlin teaches the pages -----------------------------------------------

def test_merlin_walks_the_pages_and_two_lessons_wait_for_their_rung():
    assert "{ id:'empire_villages', trigger:'empire_villages' }," in HTML
    assert "{ id:'empire_towns', trigger:'empire_towns' }," in HTML
    steps = re.findall(r"\{ chapterId:'(village|empire_villages|empire_towns)', chapter:'Realm', title:'([^']+)', screen:'village', pane:'(\w+)', target:'([^']+)'", HTML)
    assert [(s[0], s[2]) for s in steps] == [
        ("village", "realm"), ("village", "realm"), ("village", "villages"),
        ("empire_villages", "villages"), ("empire_villages", "villages"),
        ("empire_towns", "towns"), ("empire_towns", "realm"),
    ]
    assert "if (step.pane && typeof showEmpirePage === 'function') showEmpirePage(step.pane, { silent:true });" in function_source("merlinTutShowStep")
    chapter = function_source("maybeStartMerlinEmpirePageChapter")
    assert "!seen.includes('empire_villages') && empireVillages().length" in chapter
    assert "!seen.includes('empire_towns') && (empireSettlementsInfo().townCount || empireTownMergeCandidates().length)" in chapter
    # The Settings replay skips the page lessons a save cannot show.
    assert "!['empire_villages', 'empire_towns'].includes(MERLIN_TUTORIAL_STEPS[index].chapterId)" in function_source("startMerlinTutorial")
