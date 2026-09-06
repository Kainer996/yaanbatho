"""One banner per patch of land — v268, 2026-08-14.

Yaan's ask: the Empire map was confusing. Every banner flew at once — village,
town, county — all stacked over the same few streets. Now the atlas reads like
a real map:

1. Zoomed out, a place is spoken for by the BIGGEST title that holds it:
   kingdom or duchy first, then county, then town, then the village itself.
2. Zooming in opens that title into the tier below. Nothing is drawn twice.
3. A village that stands alone — no town, no county — flies at every zoom,
   because it IS the biggest land the player holds there.
4. Once three villages become a Town, their individual banners retire. The
   united Town is the only map destination; only standalone villages keep a
   village banner that can still be visited.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"

CURRENT_BUILD = "concise-onboarding-v353-20260906"
PREVIOUS_RELEASE_PIN = "player-built-village-v267-20260814"

LIEGE, COUNTY, SETTLEMENT, VILLAGE = 0, 1, 2, 3


def html_text() -> str:
    return HTML.read_text(encoding="utf-8")


def function_source(html: str, name: str) -> str:
    start = html.index("function " + name + "(")
    return html[start:html.index("\nfunction ", start)]


def run_node(script: str):
    result = subprocess.run(["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8", capture_output=True)
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)


def zoom_helpers(html: str) -> str:
    ranks = html[html.index("const EMPIRE_TIER_RANK ="):html.index("function updateEmpireMarkerDetail(")]
    return ranks


# ---------------------------------------------------------------------------
# The ladder itself
# ---------------------------------------------------------------------------

def test_each_zoom_band_speaks_one_tier():
    html = html_text()
    bands = run_node(
        zoom_helpers(html)
        + "console.log(JSON.stringify([1.45, 4, 6.39, 6.4, 9.19, 9.2, 12.19, 12.2, 16].map(empireMapBandRank)));"
    )
    assert bands == [LIEGE, LIEGE, LIEGE, COUNTY, COUNTY, SETTLEMENT, SETTLEMENT, VILLAGE, VILLAGE]


def test_only_the_biggest_title_flies_and_zooming_in_opens_it():
    html = html_text()
    # A village inside a town, inside a county, inside a duchy — the full ladder.
    cases = (
        "const banners = {"
        "  duchy:      [0, -1],"
        "  county:     [1, 0],"
        "  town:       [2, 1],"
        "  village:    [3, 2]"
        "};"
        "const out = {};"
        "Object.keys(banners).forEach(k => {"
        "  out[k] = [0,1,2,3].map(band => empireBannerVisible(banners[k][0], banners[k][1], band));"
        "});"
        "console.log(JSON.stringify(out));"
    )
    seen = run_node(zoom_helpers(html) + cases)
    # Exactly one banner flies in every band, and it is the tier that band names.
    assert seen["duchy"] == [True, False, False, False]
    assert seen["county"] == [False, True, False, False]
    assert seen["town"] == [False, False, True, False]
    assert seen["village"] == [False, False, False, True]
    for band in range(4):
        assert sum(1 for tier in seen.values() if tier[band]) == 1


def test_a_place_never_vanishes_when_it_has_no_bigger_title():
    html = html_text()
    seen = run_node(
        zoom_helpers(html)
        + "console.log(JSON.stringify({"
        # A village standing alone: no town, no county. It is the biggest land here.
        "  lone:        [0,1,2,3].map(b => empireBannerVisible(3, -1, b)),"
        # A village in a county but in no town — the county folds, then it shows.
        "  inCountyOnly:[0,1,2,3].map(b => empireBannerVisible(3, 1, b)),"
        # A county sworn to nobody — it stands at world zoom too.
        "  freeCounty:  [0,1,2,3].map(b => empireBannerVisible(1, -1, b))"
        "}));"
    )
    assert seen["lone"] == [True, True, True, True]
    assert seen["inCountyOnly"] == [False, False, True, True]
    assert seen["freeCounty"] == [True, True, False, False]


# ---------------------------------------------------------------------------
# Wiring: every banner is stamped with its rung on the ladder
# ---------------------------------------------------------------------------

def test_every_banner_is_stamped_with_its_place_in_the_ladder():
    html = html_text()
    refresh = function_source(html, "refreshEmpireMap")
    # Member villages have already been consumed by their Town, so the atlas
    # receives only standalone villages plus one claim/banner per Town or City.
    assert "const standaloneVillages = empireStandaloneVillages(villages);" in refresh
    assert "const visibleClaims = starredVillages.concat(visibleSettlements.map(settlement => ({" in refresh  # v290: ready villages wear a star
    assert "standaloneVillages.forEach(village => {" in refresh
    assert "markEmpireBannerTier(el, 'village', countyOfSeed(village.seed) ? 'county' : null)" in refresh
    assert "\n  villages.forEach(village => {" not in refresh
    assert "visibleSettlements.forEach(settlement => {" in refresh
    assert "markEmpireBannerTier(el, 'settlement', countyOfSeed(settlement.villages[0]?.seed) ? 'county' : null)" in refresh
    assert "markEmpireBannerTier(el, 'county', liegeAbove(region))" in refresh
    assert "markEmpireBannerTier(el, 'liege', null)" in refresh
    # No banner forces itself visible any more — the zoom band decides.
    assert "is-settlement is-' + settlement.tier + ' is-visible" not in refresh
    assert "is-region is-visible" not in refresh


def test_duchies_and_kingdoms_finally_get_a_banner_of_their_own():
    html = html_text()
    refresh = function_source(html, "refreshEmpireMap")
    # Kingdoms, plus any duchy that answers to no kingdom: the biggest lands held.
    assert "(realmInfo.kingdoms || []).concat((realmInfo.duchies || []).filter(d => !d.kingdomId))" in refresh
    assert "empire-map-marker is-liege is-' + liege.tier" in refresh
    assert "zoomEmpireIntoLiege(liege.id)" in refresh
    assert ".empire-map-marker.is-liege .empire-map-marker-icon" in html
    # Tapping through drops to county zoom, so the title opens into its counties.
    opener = function_source(html, "zoomEmpireIntoLiege")
    assert "zoom:EMPIRE_BAND_MAX_ZOOM[0] + 0.4" in opener


def test_county_lookup_is_one_pass_not_one_scan_per_banner():
    refresh = function_source(html_text(), "refreshEmpireMap")
    assert "const regionBySeed = new Map();" in refresh
    assert "regions.forEach(region => region.villages.forEach(v => regionBySeed.set(" in refresh
    assert "empireRegionOfSeed(" not in refresh


def test_a_banner_names_its_kind_once_so_the_name_is_not_clipped_away():
    html = html_text()
    # The label already leads with the type; the duplicate suffix is gone.
    assert ".empire-map-marker.is-region .empire-map-marker-label::after" not in html
    assert ".empire-map-marker.is-village .empire-map-marker-label::after" not in html
    assert "content:' · COUNTY'" not in html
    assert "content:' · VILLAGE'" not in html


def test_the_map_key_teaches_the_zoom_ladder():
    html = html_text()
    key = html[html.index('id="empireMapKey"'):html.index('id="empireMapTapCard"')]
    assert "kingdoms &amp; duchies → counties → towns → villages" in key
    assert "Duchy / Kingdom banner" in key


def test_release_marker_advances_for_offline_clients():
    html = html_text()
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in html
    cache_line = next(line for line in SW.read_text(encoding="utf-8").splitlines() if "const BURBZ_CACHE" in line)
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)  # this fix reaches players
