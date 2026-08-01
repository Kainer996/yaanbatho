from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE_PIN = "remove-dead-map-icons-v192-20260801"


def test_decorative_map_landmarks_are_not_rendered_or_cached():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")

    for dead_marker in (
        "burbz-prop-marker",
        "burbz-prop",
        "liveMapPropMarkers",
        "MAP_LANDMARK_ICONS",
        "drawMedievalProps",
        "map-landmark-field.webp",
        "map-landmark-grove.webp",
        "map-landmark-water.webp",
    ):
        assert dead_marker not in html

    for dead_asset in (
        "./assets/ui/map-landmark-field.webp",
        "./assets/ui/map-landmark-grove.webp",
        "./assets/ui/map-landmark-water.webp",
    ):
        assert dead_asset not in sw


def test_real_interactive_map_markers_remain_and_release_is_bumped():
    html = INDEX.read_text(encoding="utf-8")
    sw = SW.read_text(encoding="utf-8")

    assert "drawVillageMarkers(liveMapLastPosition.lat, liveMapLastPosition.lon)" in html
    assert "drawMapPickups(liveMapLastPosition.lat, liveMapLastPosition.lon)" in html
    assert "id=\"mapQuestShowBtn\"" in html
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in html
    assert RELEASE_PIN in sw
