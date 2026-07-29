"""Reporting which recogniser actually answered a scan.

Installing BirdNET V3 and having V3 *answer a request* are different things, and
only the second decides whether Burbz can be sold — V2.4's weights are
CC BY-NC-SA 4.0 (NonCommercial). The service log has always recorded the serving
engine; these tests cover naming it in the ``/api/identify/sound`` response too,
so the engine can be read from any live scan rather than only from the box.

``last_served_provider`` must report the engine that *answered*, which is not
always the configured one: if V3 fails mid-request the call falls back to Perch,
and a monetised build has to be able to see that. Everything here runs without
onnxruntime, numpy or the production backend — the providers are faked — so it
passes in a source worktree.
"""
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import sound_id  # noqa: E402

INSTALLER = ROOT.parents[1] / "scripts" / "install-birdnet-v3.sh"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("BURBZ_SOUND_MODEL", raising=False)
    monkeypatch.delenv("BURBZ_SOUND_MODEL_FALLBACK", raising=False)
    # Faked V2.4 helpers, so the legacy path never needs the real backend.
    sound_id.configure(
        birdnet_analyse=lambda path, **kw: [{"raw": path}],
        birdnet_aggregate=lambda detections, allow: [{
            "common_name": "House Sparrow",
            "scientific_name": "Passer domesticus",
            "max": 0.9, "mean": 0.9, "n": 1, "is_local": True,
        }],
        common_name_for=lambda scientific: None,
    )


def _v3_returning(common_name):
    return lambda *args, **kwargs: [{
        "common_name": common_name, "scientific_name": "Erithacus rubecula",
        "max": 0.8, "mean": 0.8, "n": 1, "is_local": True,
    }]


# ------------------------------------------------------ last_served_provider

def test_a_default_scan_reports_v3_as_the_serving_engine(monkeypatch):
    from sound_id import birdnet_v3_provider

    monkeypatch.setattr(birdnet_v3_provider, "analyse", _v3_returning("Robin"))
    sound_id.analyse("/tmp/clip.wav")
    assert sound_id.last_served_provider() == "birdnetv3"


def test_the_report_names_the_fallback_engine_not_the_configured_one(monkeypatch):
    """The whole point of the field is to catch a silent fallback."""
    from sound_id import birdnet_v3_provider, perch_provider

    def explode(*args, **kwargs):
        raise birdnet_v3_provider.BirdNETV3Unavailable("weights not installed")

    monkeypatch.setattr(birdnet_v3_provider, "analyse", explode)
    monkeypatch.setattr(perch_provider, "analyse", _v3_returning("Wren"))

    # Configured engine is V3, but Perch answered — the report must say Perch.
    sound_id.analyse("/tmp/clip.wav")
    assert sound_id.active_provider() == "birdnetv3"
    assert sound_id.last_served_provider() == "perch"


def test_a_scan_where_every_engine_fails_reports_no_serving_engine(monkeypatch):
    from sound_id import birdnet_v3_provider, perch_provider

    def explode(*args, **kwargs):
        raise RuntimeError("no model")

    monkeypatch.setattr(birdnet_v3_provider, "analyse", explode)
    monkeypatch.setattr(perch_provider, "analyse", explode)

    assert sound_id.analyse("/tmp/clip.wav") == []
    assert sound_id.last_served_provider() is None


def test_a_stale_provider_does_not_leak_from_an_earlier_scan(monkeypatch):
    """A run that serves nothing must not report the previous run's engine."""
    from sound_id import birdnet_v3_provider, perch_provider

    monkeypatch.setattr(birdnet_v3_provider, "analyse", _v3_returning("Robin"))
    sound_id.analyse("/tmp/clip.wav")
    assert sound_id.last_served_provider() == "birdnetv3"

    def explode(*args, **kwargs):
        raise RuntimeError("no model")

    monkeypatch.setattr(birdnet_v3_provider, "analyse", explode)
    monkeypatch.setattr(perch_provider, "analyse", explode)
    sound_id.analyse("/tmp/clip.wav")
    assert sound_id.last_served_provider() is None


# ---------------------------------------------------------------- served_meta

def test_served_meta_is_json_ready_and_flags_commercial_use(monkeypatch):
    from sound_id import birdnet_v3_provider

    monkeypatch.setattr(birdnet_v3_provider, "analyse", _v3_returning("Robin"))
    sound_id.analyse("/tmp/clip.wav")

    meta = sound_id.served_meta()
    assert meta == {"provider": "birdnetv3", "label": "BirdNET", "commercial": True}


def test_served_meta_flags_the_legacy_v2_path_as_non_commercial():
    meta = sound_id.served_meta("birdnetv2")
    assert meta["provider"] == "birdnetv2"
    assert meta["label"] == "BirdNET"      # a player never sees the version
    assert meta["commercial"] is False


def test_served_meta_falls_back_to_the_configured_engine_before_any_scan():
    # No scan has run on this thread's clean state, so it reports the default.
    assert sound_id.last_served_provider() in (None, "birdnetv3", "perch")
    meta = sound_id.served_meta()
    assert meta["provider"] in {"birdnetv3", "perch"}
    assert meta["commercial"] is True


# ------------------------- the installer tags the live response with all this

def test_the_installer_block_is_bumped_so_boxes_receive_the_change():
    text = INSTALLER.read_text(encoding="utf-8")
    assert 'PATCH_VERSION="v3"' in text
    assert "# BURBZ-BIRDNET-V3-BEGIN v3" in text


def test_the_installer_tags_the_scan_response_with_the_serving_engine():
    text = INSTALLER.read_text(encoding="utf-8")
    # An after_request hook that injects the provider onto identify/sound JSON.
    assert "after_request" in text
    assert "served_meta()" in text
    assert 'payload["provider"]' in text
    assert 'payload["commercial"]' in text
    assert 'endswith("/identify/sound")' in text
