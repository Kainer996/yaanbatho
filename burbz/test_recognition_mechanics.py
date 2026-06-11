import os

os.environ.setdefault("BURBZ_PHOTO_MODEL", "off")

import server  # noqa: E402
from server import _analyse_recording, _catalog_lookup, species_to_game_bird  # noqa: E402
from photo_id import _bird_matches  # noqa: E402


def test_crow_aliases_map_to_carrion_crow():
    assert _catalog_lookup("American Crow")["common_name"] == "Carrion Crow"
    assert _catalog_lookup("Corvus brachyrhynchos")["common_name"] == "Carrion Crow"
    bird = species_to_game_bird("Corvus brachyrhynchos", "American Crow", 0.42)
    assert bird["id"] == "crow_carrion"
    assert bird["name"] == "Carrion Crow"
    assert bird["catalogMatched"] is True


def test_common_local_aliases_match_catalogue():
    assert _catalog_lookup("Raven")["common_name"] == "Common Raven"
    assert _catalog_lookup("Jackdaw")["common_name"] == "Eurasian Jackdaw"
    assert _catalog_lookup("Corvus monedula")["common_name"] == "Eurasian Jackdaw"
    assert _catalog_lookup("Kingfisher")["common_name"] == "Common Kingfisher"
    assert _catalog_lookup("Wood Pigeon")["common_name"] == "Common Wood Pigeon"
    assert _catalog_lookup("Pied Wagtail")["common_name"] == "White Wagtail"


def test_mobilenet_crow_label_is_a_bird_match():
    matches = _bird_matches([
        ("n01580077", "American_crow", 0.61),
        ("n02084071", "dog", 0.22),
    ])
    assert matches[0]["species"] == "Carrion Crow"
    assert matches[0]["scientificName"] == "Corvus corone"


def test_sound_analysis_uses_current_birdnet_location_keyword(monkeypatch):
    calls = {}

    class FakeRecording:
        def __init__(self, **kwargs):
            calls.update(kwargs)
            self.detections = [{"common_name": "Wren", "confidence": 0.2}]

        def analyze(self):
            return None

    monkeypatch.setattr(server, "Recording", FakeRecording)

    detections = _analyse_recording("/tmp/clip.wav", min_conf=0.15, lat=53.9, lon=-2.4, sensitivity=1.25, overlap=0.25)

    assert detections == [{"common_name": "Wren", "confidence": 0.2}]
    assert calls["lat"] == 53.9
    assert calls["lon"] == -2.4
    assert calls["week_48"] == -1
    assert calls["sensitivity"] == 1.25
    assert calls["overlap"] == 0.25
    assert "week" not in calls
