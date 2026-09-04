"""No bird holds a sword in a hand it shouldn't have. `no-arms-card-art-v340`.

A full visual audit of every painting the game can show (1,757 images) found
37 birds from the early manga batches (20260624-20260706) drawn with human
arms or hands. Yaan's rule: those birds — and only those — swap their card
art for the armless warrior remake's transparent cutout, standing on the
habitat backdrop every card already paints behind its art. Every other bird
keeps its original painting.

The same 37 audit also caught the moving-sprite route: MAP_BIRD_CUTOUT_ART
pinned nine of the armed paintings (or their cutouts) for map and room
sprites, and a village shop patron flew with armed blue-tit art. All now
point at the warrior cutouts.
"""
import json
import re
import subprocess
from pathlib import Path

BURBZ = Path(__file__).resolve().parents[1]
INDEX = BURBZ / "index.html"
SW = BURBZ / "sw.js"
RELEASE_JS = BURBZ / "bird_art_release_20260901.js"
WARRIOR_JS = BURBZ / "bird_art_release_20260803.js"
CUTOUTS = BURBZ / "bird-art-cache" / "cutouts"
DEPLOY = BURBZ.parents[1] / "scripts" / "update-live-burbz.sh"

CURRENT_BUILD = "alderwing-living-settlements-v348-20260904"

ARMED_FILES = [
    "australian_pelican_burbz_manga_20260701.png",
    "barn_owl_burbz_manga_20260624_v2.png",
    "blackcap_burbz_manga_20260624.png",
    "blue_tit_burbz_manga_20260624_v2.png",
    "common_linnet_burbz_manga_20260701.png",
    "common_myna_burbz_manga_20260630.png",
    "cormorant_burbz_manga_20260624_v2.png",
    "crimson_rosella_burbz_manga_20260630.png",
    "eastern_spinebill_burbz_manga_20260701.png",
    "european_robin_burbz_manga_20260624_v2.png",
    "firecrest_burbz_manga_20260624_v2.png",
    "gannet_burbz_manga_20260624_v2.png",
    "goldcrest_burbz_manga_20260624_v2.png",
    "goldfinch_burbz_manga_20260624_v2.png",
    "great_crested_grebe_burbz_manga_20260706T0200.png",
    "great_tit_burbz_manga_20260624_v2.png",
    "greenfinch_burbz_manga_20260624_v2.png",
    "grey_wagtail_burbz_manga_20260624_v2.png",
    "heron_burbz_manga_20260624_v2.png",
    "jay_burbz_manga_20260624.png",
    "little_corella_burbz_manga_20260701.png",
    "little_raven_burbz_manga_20260630.png",
    "long_tailed_tit_burbz_manga_20260624_v2.png",
    "new_holland_honeyeater_burbz_manga_20260701.png",
    "noisy_miner_burbz_manga_20260630.png",
    "oystercatcher_burbz_manga_20260624_v2.png",
    "peregrine_falcon_burbz_manga_20260624_v2.png",
    "rainbow_lorikeet_burbz_manga_20260630.png",
    "raven_burbz_manga_20260624_v2.png",
    "reed_bunting_burbz_manga_20260624_v2.png",
    "royal_spoonbill_burbz_manga_20260701.png",
    "song_thrush_burbz_manga_20260624_v2.png",
    "starling_burbz_manga_20260624_v2.png",
    "superb_fairywren_burbz_manga_20260630.png",
    "swift_burbz_manga_20260624.png",
    "white_plumed_honeyeater_burbz_manga_20260701.png",
    "woodpigeon_burbz_manga_20260624.png",
]


def armed_slug(file_name):
    return re.sub(r"_burbz_manga_\d{8}(?:T\d{4})?(?:_v\d+)?\.png$", "", file_name)


def test_release_js_lists_exactly_the_audited_armed_paintings():
    source = RELEASE_JS.read_text(encoding="utf-8")
    listed = re.findall(r"^([a-z0-9_]+(?:T\d{4})?[a-z0-9_]*\.png)$", source, flags=re.M)
    assert sorted(listed) == sorted(ARMED_FILES)
    assert len(ARMED_FILES) == 37


def test_every_armed_bird_has_an_armless_warrior_remake():
    # The stand-in only exists because the 20260802 warrior batch redrew these
    # birds without arms. Each must be in that release's slug set, and its
    # transparent cutout must be in the repo (a real raster or its LFS pointer).
    warrior_source = WARRIOR_JS.read_text(encoding="utf-8")
    block = warrior_source.split("new Set(`")[1].split("`.trim()")[0]
    warrior_slugs = set(block.split())
    for file_name in ARMED_FILES:
        slug = armed_slug(file_name)
        assert slug in warrior_slugs, f"{slug} has no warrior remake"
        cutout = CUTOUTS / f"{slug}_burbz_manga_warrior_20260802_cutout.png"
        assert cutout.exists(), f"missing {cutout.name}"


def test_release_js_swaps_armed_urls_and_leaves_the_rest_alone():
    script = """
    // In CommonJS the release file's top-level `this` is its module.exports,
    // so require() hands back the same functions the browser gets on window.
    const release = require('./bird_art_release_20260901.js');
    const fn = release.burbzNoArmsCardArt20260901;
    if (typeof fn !== 'function') throw new Error('release did not export the swap');
    const out = {
      robin: fn('/burbz/bird-art-cache/european_robin_burbz_manga_20260624_v2.png'),
      robinQuery: fn('/burbz/bird-art-cache/european_robin_burbz_manga_20260624_v2.png?v=x'),
      grebe: fn('/burbz/bird-art-cache/great_crested_grebe_burbz_manga_20260706T0200.png'),
      wren: fn('/burbz/bird-art-cache/wren_burbz_manga_20260624_v2.png'),
      warrior: fn('/burbz/bird-art-cache/european_robin_burbz_manga_warrior_20260802.png'),
      webp: fn('/burbz/bird-art-cache/completion-20260726/apostlebird_burbz_manga_rpg_20260726.webp'),
      nothing: fn(null),
    };
    console.log(JSON.stringify(out));
    """
    result = subprocess.run(["node", "-e", script], cwd=BURBZ, text=True, capture_output=True, timeout=60)
    assert result.returncode == 0, result.stderr
    out = json.loads(result.stdout)
    assert out["robin"] == "/burbz/bird-art-cache/cutouts/european_robin_burbz_manga_warrior_20260802_cutout.png"
    assert out["robinQuery"] == out["robin"]
    assert out["grebe"] == "/burbz/bird-art-cache/cutouts/great_crested_grebe_burbz_manga_warrior_20260802_cutout.png"
    # An armless painting, the warrior remake itself, a completion webp and a
    # missing URL all pass through untouched — Yaan keeps that artwork.
    assert out["wren"] is None
    assert out["warrior"] is None
    assert out["webp"] is None
    assert out["nothing"] is None


def test_card_route_serves_the_cutout_on_the_habitat_backdrop():
    index = INDEX.read_text(encoding="utf-8")
    start = index.index("function birdCardImgAttrs(")
    card = index[start:index.index("const MAP_BIRD_CUTOUT_ART = {", start)]
    # The carve-out asks the release first; only a hit changes anything.
    assert "window.burbzNoArmsCardArt20260901" in card
    assert "isCutout: true" in card
    assert 'class="card-art-cutout"' in card
    # A failed cutout falls to the emoji glyph, never back to the armed
    # painting — so the cutout branch carries no data-fallback-art.
    cutout_branch = card.split("if (noArms) {")[1].split("}")[0] + "}"
    assert "data-fallback-art" not in cutout_branch
    assert "data-fallback-emoji" in cutout_branch
    # The wash is a blurred copy of the art; over a transparent cutout it
    # would smear across the habitat backdrop, so cutouts get none.
    wash = index[index.index("function cardArtWashHTML("):]
    wash = wash[:wash.index("\n}")]
    assert "cardArt.isCutout" in wash


def test_cutout_css_exists_for_cards_and_the_info_sheet():
    index = INDEX.read_text(encoding="utf-8")
    assert ".card-art img.card-art-cutout {" in index
    assert ".bird-info-art img.card-art-cutout { object-fit: contain;" in index


def test_no_surface_references_an_armed_painting_or_its_cutout_directly():
    # MAP_BIRD_CUTOUT_ART and the village shop patrons used to fly armed art
    # around the map and rooms. Every armed cutout is gone from the runtime.
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    for file_name in ARMED_FILES:
        cutout_name = file_name.replace(".png", "_cutout.png")
        assert cutout_name not in index, f"{cutout_name} still referenced in index.html"
        assert cutout_name not in sw, f"{cutout_name} still referenced in sw.js"
    # The armed originals stay in BUILT_IN_BIRD_ART on purpose: the runtime
    # swap keys off those URLs, and nothing on disk was deleted.
    assert "'/burbz/bird-art-cache/european_robin_burbz_manga_20260624_v2.png'" in index


def test_release_reaches_page_service_worker_and_deploy():
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    deploy = DEPLOY.read_text(encoding="utf-8")
    tag = "bird_art_release_20260901.js?v=no-arms-card-art-v340-20260901"
    assert f'<script src="{tag}"></script>' in index
    assert sw.count(f"'./{tag}'") == 2
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in index
    # Membership in the cache lineage, never the tail — the tail belongs to
    # whoever ships next (the v338 suite broke on exactly this).
    cache_line = next(line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert f"-{CURRENT_BUILD}'" in cache_line or f"-{CURRENT_BUILD}-" in cache_line
    assert '"bird_art_release_20260901.js"' in deploy
