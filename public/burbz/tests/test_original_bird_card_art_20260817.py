from pathlib import Path

from PIL import Image

from conftest import require_materialised_art


BURBZ = Path(__file__).resolve().parents[1]
INDEX = BURBZ / "index.html"
CACHE = BURBZ / "bird-art-cache"
SW = BURBZ / "sw.js"
BUILD = "anchored-dock-v301-20260820"


def source_block(source: str, start_marker: str, end_marker: str) -> str:
    start = source.index(start_marker)
    end = source.index(end_marker, start)
    return source[start:end]


def test_card_art_snapshot_precedes_transparent_warrior_override():
    index = INDEX.read_text(encoding="utf-8")
    completion = index.index("Object.assign(BUILT_IN_BIRD_ART, GENERATED_ART_COMPLETION);")
    snapshot = index.index("const BUILT_IN_BIRD_CARD_ART = Object.freeze({ ...BUILT_IN_BIRD_ART });")
    warrior_override = index.index("applyBurbzMangaWarriorArt20260803(BUILT_IN_BIRD_ART)")

    assert completion < snapshot < warrior_override
    assert "'Eastern Rosella': '/burbz/bird-art-cache/eastern_rosella_burbz_manga_20260630.png'" in index


def test_framed_views_use_original_paintings_and_icons_keep_cutouts():
    index = INDEX.read_text(encoding="utf-8")
    card = source_block(index, "function birdCardImgAttrs(", "const MAP_BIRD_CUTOUT_ART = {")
    icon = source_block(index, "function birdOnlyImgHTML(", "function birdCardImgAttrs(")

    assert "const art = getBirdCardArtUrl(bird);" in card
    assert "src: art" in card
    assert 'class="card-art-painting"' in card
    assert "birdCutoutUrlFor(art)" not in card
    assert "const cutout = known || birdCutoutUrlFor(art);" in icon
    assert index.count("const cardArt = birdCardImgAttrs(bird);") == 3
    assert "const infoArt = birdCardImgAttrs(bird);" in index
    assert ".card-art img.card-art-painting { object-fit: cover; filter: none; }" in index


def test_eastern_rosella_original_is_an_opaque_complete_painting():
    original = CACHE / "eastern_rosella_burbz_manga_20260630.png"
    warrior = CACHE / "eastern_rosella_burbz_manga_warrior_20260802.png"
    require_materialised_art(original, warrior)

    with Image.open(original) as image:
        assert image.width >= 1024 and image.height >= 1024
        assert "A" not in image.getbands() or image.getchannel("A").getextrema() == (255, 255)
    with Image.open(warrior) as image:
        assert image.mode == "RGBA"
        assert image.getchannel("A").getextrema() == (0, 255)


def test_release_stamp_reaches_runtime_and_service_worker():
    index = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")
    assert f"const BURBZ_BUILD = '{BUILD}';" in index
    assert BUILD in sw
