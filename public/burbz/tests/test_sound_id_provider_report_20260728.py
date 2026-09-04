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
from sound_id import birdnet_v3_provider  # noqa: E402
from sound_id import server_integration  # noqa: E402
from sound_id import server_patcher  # noqa: E402

INSTALLER = ROOT.parents[1] / "scripts" / "install-birdnet-v3.sh"


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("BURBZ_SOUND_MODEL", raising=False)
    monkeypatch.delenv("BURBZ_SOUND_MODEL_FALLBACK", raising=False)
    sound_id.clear_served_provider()
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
    monkeypatch.setattr(
        birdnet_v3_provider,
        "model_meta",
        lambda: {
            "name": birdnet_v3_provider.MODEL_NAME,
            "version": "3.0-preview3.1",
            "modelSha256": birdnet_v3_provider.ONNX_SHA256,
            "labelsSha256": birdnet_v3_provider.LABELS_SHA256,
            "scoreBlacklistSha256": birdnet_v3_provider.SCORE_BLACKLIST_SHA256,
            "policyVersion": birdnet_v3_provider.DECISION_POLICY_VERSION,
        },
    )
    monkeypatch.setattr(
        birdnet_v3_provider,
        "geo_model_meta",
        lambda: {
            "name": birdnet_v3_provider.GEO_MODEL_NAME,
            "version": "3.0.2",
            "modelSha256": birdnet_v3_provider.GEO_ONNX_SHA256,
            "labelsSha256": birdnet_v3_provider.GEO_LABELS_SHA256,
        },
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

    monkeypatch.setenv("BURBZ_SOUND_MODEL_FALLBACK", "1")

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

    monkeypatch.setenv("BURBZ_SOUND_MODEL_FALLBACK", "1")

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
    monkeypatch.setenv("BURBZ_SOUND_MODEL_FALLBACK", "1")

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
    assert meta == {
        "provider": "birdnetv3",
        "providerLabel": "BirdNET",
        "configuredProvider": "birdnetv3",
        "fallbackUsed": False,
        "commercial": True,
        "providerVerified": True,
        "providerVersion": "3.0-preview3.1",
        "modelName": birdnet_v3_provider.MODEL_NAME,
        "modelSha256": birdnet_v3_provider.ONNX_SHA256,
        "labelsSha256": birdnet_v3_provider.LABELS_SHA256,
        "scoreBlacklistSha256": birdnet_v3_provider.SCORE_BLACKLIST_SHA256,
        "geoModelName": birdnet_v3_provider.GEO_MODEL_NAME,
        "geoModelVersion": "3.0.2",
        "geoModelSha256": birdnet_v3_provider.GEO_ONNX_SHA256,
        "geoLabelsSha256": birdnet_v3_provider.GEO_LABELS_SHA256,
        "policyVersion": birdnet_v3_provider.DECISION_POLICY_VERSION,
    }


def test_served_meta_flags_the_legacy_v2_path_as_non_commercial():
    meta = sound_id.served_meta("birdnetv2")
    assert meta["provider"] == "birdnetv2"
    assert meta["providerLabel"] == "BirdNET"  # a player never sees the version
    assert meta["commercial"] is False
    assert meta["providerVerified"] is True
    assert meta["modelName"] == "BirdNET V2.4"


def test_served_meta_never_fabricates_the_configured_engine_before_any_scan():
    assert sound_id.last_served_provider() is None
    meta = sound_id.served_meta()
    assert meta["configuredProvider"] == "birdnetv3"
    assert meta["provider"] is None
    assert meta["providerLabel"] is None
    assert meta["commercial"] is None
    assert meta["providerVerified"] is False
    assert meta["modelSha256"] is None
    assert meta["geoModelSha256"] is None


# ---------------------- canonical AST patcher + integration-v4 installer path

def test_the_installer_uses_the_reviewed_ast_patcher_and_integration_v4():
    text = INSTALLER.read_text(encoding="utf-8")
    assert 'PATCH_VERSION="v4"' in text
    assert '"$PY" -m sound_id.server_patcher "$TARGET"' in text
    assert "from sound_id.server_integration import INTEGRATION_VERSION" in text
    assert "assert INTEGRATION_VERSION == 4" in text
    assert server_integration.INTEGRATION_VERSION == 4
    # The old append-only heredoc remains inert rollback archaeology only.
    assert "if false; then" in text
    assert text.index('"$PY" -m sound_id.server_patcher "$TARGET"') < text.index(
        "if false; then"
    )


def test_ast_patcher_places_the_v4_bootstrap_before_blocking_app_run():
    source = """\
from flask import Flask
app = Flask(__name__)
def _analyse_recording(path, **kwargs):
    return []
@app.post('/api/identify/sound')
def identify_sound():
    return {'found': bool(_analyse_recording('/tmp/a.wav'))}
if __name__ == '__main__':
    app.run()
"""
    rendered, mode = server_patcher.patched_source(source)
    assert mode == "direct"
    assert "BURBZ-BIRDNET-V3-BEGIN v4 mode=direct" in rendered
    assert "from sound_id.server_integration import install" in rendered
    assert rendered.index(server_patcher.BEGIN) < rendered.index("if __name__")
    compile(rendered, "server.py", "exec")


def test_integration_v4_tags_exact_metadata_and_clears_request_state():
    text = Path(server_integration.__file__).read_text(encoding="utf-8")
    assert "app.before_request(clear_sound_provider)" in text
    assert "app.after_request(tag_sound_provider)" in text
    assert "payload.update(served_meta())" in text
    assert 'payload["serverIntegrationVersion"] = INTEGRATION_VERSION' in text


def test_installer_still_prefers_systemd_server_path_over_process_guessing():
    text = INSTALLER.read_text(encoding="utf-8")
    assert text.index('found="$(server_py_from_systemd)"') < text.index('found="$(server_py_from_process)"')
    assert 'printf \'%s\\n\' burbz.service' in text
    assert 'WorkingDirectory' in text


def test_installer_waits_for_the_cold_model_server_to_accept_requests():
    text = INSTALLER.read_text(encoding="utf-8")
    assert "LIVE_READY_ATTEMPTS=30" in text
    assert "attempt<=LIVE_READY_ATTEMPTS" in text
    assert "break 2" in text
    assert "[[ $attempt -lt $LIVE_READY_ATTEMPTS ]] && sleep 1" in text
