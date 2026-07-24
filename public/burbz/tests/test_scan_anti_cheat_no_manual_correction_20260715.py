import io
import importlib
import json
import os
from pathlib import Path
from typing import Any

import pytest

os.environ.setdefault("BURBZ_PHOTO_MODEL", "off")

server: Any
try:
    server = importlib.import_module("server")
except ModuleNotFoundError:  # Source worktrees do not carry the production backend.
    server = None

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def test_player_has_no_manual_species_entry_or_correction_path():
    html = HTML.read_text(encoding="utf-8")
    forbidden = [
        "speciesPickerOverlay",
        "speciesPickerSearch",
        "speciesPickerList",
        "speciesPickerClose",
        "species-picker-row",
        "species-picker-search",
        "recruitCorrectBtn",
        "recruit-correct-btn",
        "scanCorrectContext",
        "removeDiscoveredSpecies(",
        "allSpeciesForPicker(",
        "openSpeciesPicker(",
        "correctScanDiscovery(",
        "Not the right bird?",
        "manual correction",
        "Manual correction",
        "Pick the bird you actually saw or heard",
        "correctable: true",
        "simulateScan(",
        "handleBirdIdentified(",
        "reportNewBird(",
        "api/report/new-bird",
        "PIONEER_DISCOVERY_REWARD",
        "handlePioneerDiscovery(",
        "pioneerFinds",
    ]
    present = [marker for marker in forbidden if marker in html]
    assert not present, present


def test_tutorial_teaches_only_camera_and_sound_identification():
    html = HTML.read_text(encoding="utf-8")
    assert "title:'Two ways to capture'" in html
    assert "Capture birds with Camera or Sound" in html
    assert "Sound" in html and "BirdNET" in html
    assert "manual species picker" not in html
    assert "chapterId:'scan'" in html
    assert "maybeStartMerlinChapterForScreen(name)" in html


def test_recognition_backed_discovery_and_recruitment_remain_available():
    html = HTML.read_text(encoding="utf-8")
    for marker in (
        'id="scanImageBtn"',
        'id="scanSoundBtn"',
        "handleBirdCandidates(",
        "uploadRecording(",
        "discoveredSpecies",
        "Academy Barracks",
        "catalogMatched",
        "showCatalogUnmatchedRecognition(",
    ):
        assert marker in html


@pytest.mark.skipif(server is None, reason="production server module is not present in source worktrees")
def test_public_new_bird_report_endpoint_is_gone_and_writes_no_report(tmp_path, monkeypatch):
    reports_path = tmp_path / "reports.json"
    monkeypatch.setattr(server, "REPORTS_PATH", reports_path)
    monkeypatch.setattr(server, "REPORTS_MEDIA_DIR", tmp_path / "report-media")

    response = server.app.test_client().post(
        "/api/report/new-bird",
        data={"species": "Arbitrary Console Gull", "confidence": "1"},
    )

    assert response.status_code in {404, 405}
    assert not reports_path.exists()


@pytest.mark.skipif(server is None, reason="production server module is not present in source worktrees")
def test_private_sound_recognition_report_is_created_only_when_catalog_unmatched(tmp_path, monkeypatch):
    reports_path = tmp_path / "reports.json"
    monkeypatch.setattr(server, "REPORTS_PATH", reports_path)
    monkeypatch.setattr(server, "REPORTS_MEDIA_DIR", tmp_path / "report-media")
    monkeypatch.setattr(server, "_local_species_allowlist", lambda lat, lon, week: set())

    tmp_audio = tmp_path / "birdnet.wav"
    tmp_audio.write_bytes(b"RIFF....WAVE")
    monkeypatch.setattr(server, "prepare_audio_for_birdnet", lambda path: str(tmp_audio))
    monkeypatch.setattr(server, "_analyse_recording", lambda *args, **kwargs: [{"ok": True}])
    monkeypatch.setattr(server, "_aggregate_sound_detections", lambda detections, allow: [{
        "common_name": "Console Gull",
        "scientific_name": "Larus consolensis",
        "max": 0.93,
        "mean": 0.93,
        "n": 1,
        "is_local": True,
    }])
    monkeypatch.setattr(server, "_catalog_lookup", lambda *names: None)

    response = server.app.test_client().post(
        "/api/identify/sound",
        data={"audio": (io.BytesIO(b"audio"), "clip.webm"), "lat": "51.5", "lon": "-0.1"},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["found"] is True
    assert body["catalogMatched"] is False
    reports = json.loads(reports_path.read_text(encoding="utf-8"))["reports"]
    assert len(reports) == 1
    assert reports[0]["species"] == "Console Gull"
    assert reports[0]["source"] == "sound"
    assert reports[0]["note"] == "server-side recognition; catalogue unmatched"


@pytest.mark.skipif(server is None, reason="production server module is not present in source worktrees")
def test_private_camera_recognition_report_is_created_when_catalog_unmatched(tmp_path, monkeypatch):
    reports_path = tmp_path / "reports.json"
    monkeypatch.setattr(server, "REPORTS_PATH", reports_path)
    monkeypatch.setattr(server, "REPORTS_MEDIA_DIR", tmp_path / "report-media")
    monkeypatch.setattr(server, "normalise_image_file", lambda raw, out: Path(out).write_bytes(b"jpg"))
    monkeypatch.setattr(server, "identify_bird_from_image", lambda path, lat=None, lon=None: {
        "found": True,
        "species": "Camera Finch",
        "scientificName": "Fringilla camera",
        "confidence": 0.88,
    })
    monkeypatch.setattr(server, "_catalog_lookup", lambda *names: None)

    response = server.app.test_client().post(
        "/api/identify/image",
        data={
            "captureSource": "camera",
            "image": (io.BytesIO(b"fake image"), "capture.jpg"),
            "lat": "40.4",
            "lon": "-3.7",
        },
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["found"] is True
    assert body["catalogMatched"] is False
    reports = json.loads(reports_path.read_text(encoding="utf-8"))["reports"]
    assert len(reports) == 1
    assert reports[0]["species"] == "Camera Finch"
    assert reports[0]["source"] == "photo"


@pytest.mark.skipif(server is None, reason="production server module is not present in source worktrees")
def test_known_catalogue_sound_recognition_does_not_create_private_report(tmp_path, monkeypatch):
    reports_path = tmp_path / "reports.json"
    monkeypatch.setattr(server, "REPORTS_PATH", reports_path)
    monkeypatch.setattr(server, "REPORTS_MEDIA_DIR", tmp_path / "report-media")
    monkeypatch.setattr(server, "_local_species_allowlist", lambda lat, lon, week: set())

    tmp_audio = tmp_path / "birdnet-known.wav"
    tmp_audio.write_bytes(b"RIFF....WAVE")
    monkeypatch.setattr(server, "prepare_audio_for_birdnet", lambda path: str(tmp_audio))
    monkeypatch.setattr(server, "_analyse_recording", lambda *args, **kwargs: [{"ok": True}])
    monkeypatch.setattr(server, "_aggregate_sound_detections", lambda detections, allow: [{
        "common_name": "House Sparrow",
        "scientific_name": "Passer domesticus",
        "max": 0.93,
        "mean": 0.93,
        "n": 1,
        "is_local": True,
    }])
    monkeypatch.setattr(server, "_catalog_lookup", lambda *names: {
        "species_id": "house_sparrow",
        "common_name": "House Sparrow",
        "latin_name": "Passer domesticus",
        "rarity_tier": "common",
        "base_stats": {"hp": 45, "atk": 30, "def": 30, "spd": 55, "spl": 25},
    })

    response = server.app.test_client().post(
        "/api/identify/sound",
        data={"audio": (io.BytesIO(b"audio"), "clip.webm")},
        content_type="multipart/form-data",
    )

    assert response.status_code == 200
    body = response.get_json()
    assert body["found"] is True
    assert body["catalogMatched"] is True
    assert not reports_path.exists()
