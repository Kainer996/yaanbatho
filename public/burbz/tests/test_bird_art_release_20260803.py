import re
from pathlib import Path

from PIL import Image


BURBZ = Path(__file__).resolve().parents[1]
CACHE = BURBZ / "bird-art-cache"
RELEASE = BURBZ / "bird_art_release_20260803.js"
INDEX = BURBZ / "index.html"
SW = BURBZ / "sw.js"


def release_slugs():
    text = RELEASE.read_text(encoding="utf-8")
    block = re.search(r"const warriorSlugs = new Set\(`(.*?)`\.trim", text, re.S)
    assert block
    return block.group(1).split()


def test_warrior_release_has_matching_transparent_main_and_icon_assets():
    slugs = release_slugs()
    assert len(slugs) == 143
    assert len(set(slugs)) == len(slugs)
    assert "herring_gull" in slugs

    for slug in slugs:
        main = CACHE / f"{slug}_burbz_manga_warrior_20260802.png"
        cutout = CACHE / "cutouts" / f"{slug}_burbz_manga_warrior_20260802_cutout.png"
        assert main.is_file(), main
        assert cutout.is_file(), cutout
        with Image.open(main) as image:
            assert image.mode == "RGBA"
            alpha = image.getchannel("A")
            lo, hi = alpha.getextrema()
            assert lo == 0 and hi == 255


def test_habitat_background_library_is_complete_and_opaque():
    names = {
        "woodland", "wetland", "coast", "grassland",
        "garden", "heath", "eucalypt", "mountain",
    }
    for name in names:
        path = CACHE / "habitat-backgrounds" / f"{name}_manga_20260803.png"
        assert path.is_file(), path
        with Image.open(path) as image:
            assert image.width >= 1024 and image.height >= 1024
            assert image.mode in {"RGB", "RGBA"}


def test_runtime_layers_completion_warriors_cutouts_and_habitats():
    index = INDEX.read_text(encoding="utf-8")
    release = RELEASE.read_text(encoding="utf-8")

    assert 'src="bird_art_release_20260727.js' in index
    assert 'src="bird_art_release_20260803.js' in index
    assert "BURBZ_GENERATED_ART_COMPLETION_20260726" in index
    assert "applyBurbzMangaWarriorArt20260803(BUILT_IN_BIRD_ART)" in index
    assert "const cutout = birdCutoutUrlFor(art);" in index
    assert index.count("birdHabitatBackgroundStyle(bird, rarityColor)") >= 4
    assert "herring_gull_burbz_manga_warrior_20260802.png" not in index
    assert "legacySlugAliases" in release
    assert "rock_pigeon: 'feral_pigeon'" in release
    assert "robin: 'european_robin'" in release


def test_art_release_remains_in_service_worker_cache_lineage():
    cache_line = next(
        line for line in SW.read_text(encoding="utf-8").splitlines()
        if line.startswith("const BURBZ_CACHE = ")
    )
    assert "manga-warrior-habitats-v204-20260803" in cache_line
