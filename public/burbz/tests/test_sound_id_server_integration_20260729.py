"""Executable proof that the live server is actually routed through V3.

The production snapshot consumes ``_analyse_recording`` dictionaries directly;
another server generation used a separate aggregation helper. Both contracts
must work, and response provenance must describe the provider that answered
rather than the one configured in an environment file.
"""

import sys
from pathlib import Path

import pytest

flask = pytest.importorskip("flask")

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import sound_id  # noqa: E402
from sound_id import birdnet_v3_provider  # noqa: E402
from sound_id import server_integration as integration  # noqa: E402


def candidate(name="Great Tit", scientific="Parus major", score=0.82):
    return {
        "common_name": name,
        "scientific_name": scientific,
        "max": score,
        "mean": score,
        "n": 2,
        "is_local": True,
    }


@pytest.fixture(autouse=True)
def clean(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "birdnetv3")
    monkeypatch.setenv("BURBZ_SOUND_MODEL_FALLBACK", "0")
    sound_id.clear_served_provider()
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


def direct_server():
    app = flask.Flask(__name__ + ".direct")
    calls = {"legacy": 0}

    def legacy(path, min_conf=0.25, lat=None, lon=None, **kwargs):
        calls["legacy"] += 1
        return [{
            "common_name": "Legacy Robin",
            "scientific_name": "Erithacus rubecula",
            "confidence": 0.2,
        }]

    namespace = {"app": app, "_analyse_recording": legacy}

    @app.post("/api/identify/sound")
    def identify_sound():
        if flask.request.args.get("malformed"):
            return flask.jsonify({"found": False, "error": "no audio"}), 400
        detections = namespace["_analyse_recording"](
            "/tmp/window.wav",
            min_conf=0.18,
            lat=flask.request.form.get("lat", type=float),
            lon=flask.request.form.get("lon", type=float),
            sensitivity=1.25,
            overlap=0.25,
        )
        # Mirrors the real snapshot's second, dangerously low-threshold pass.
        if not detections:
            detections = namespace["_analyse_recording"](
                "/tmp/window.wav",
                min_conf=0.08,
                lat=flask.request.form.get("lat", type=float),
                lon=flask.request.form.get("lon", type=float),
                sensitivity=1.35,
                overlap=0.5,
            )
        if not detections:
            return flask.jsonify({"found": False, "allDetections": []})
        top = max(detections, key=lambda row: row["confidence"])
        return flask.jsonify({
            "found": True,
            "bird": {
                "name": top["common_name"],
                "scientificName": top["scientific_name"],
                "confidence": top["confidence"],
            },
            "allDetections": detections,
        })

    return app, namespace, calls


def aggregate_server():
    app = flask.Flask(__name__ + ".aggregate")
    calls = {"legacy_analyse": 0, "legacy_aggregate": 0}

    def legacy_analyse(path, lat=None, lon=None, **kwargs):
        calls["legacy_analyse"] += 1
        return ["legacy"]

    def legacy_aggregate(detections, allow=None):
        calls["legacy_aggregate"] += 1
        return [candidate("Legacy Robin", "Erithacus rubecula", 0.2)]

    namespace = {
        "app": app,
        "_analyse_recording": legacy_analyse,
        "_aggregate_sound_detections": legacy_aggregate,
    }

    @app.post("/api/identify/sound")
    def identify_sound():
        raw = namespace["_analyse_recording"]("/tmp/window.wav")
        if not raw:
            raw = namespace["_analyse_recording"]("/tmp/window.wav")
        detections = namespace["_aggregate_sound_detections"](
            raw, allow={"parus major", "fringilla coelebs"}
        )
        return flask.jsonify({"found": bool(detections), "allDetections": detections})

    return app, namespace, calls


def test_direct_contract_surfaces_two_accepted_species_and_exact_v3_provenance(monkeypatch):
    app, namespace, calls = direct_server()
    seen = {}

    def run(provider, path, allow, lat, lon, week):
        seen.update(provider=provider, lat=lat, lon=lon)
        return [
            candidate(),
            candidate("Common Chaffinch", "Fringilla coelebs", 0.76),
        ]

    monkeypatch.setattr(sound_id, "_run", run)
    integration.install(namespace, mode="direct")

    response = app.test_client().post(
        "/api/identify/sound", data={"lat": "53.228", "lon": "-2.598"}
    )
    body = response.get_json()

    assert [row["scientific_name"] for row in body["allDetections"]] == [
        "Parus major", "Fringilla coelebs",
    ]
    assert seen == {"provider": "birdnetv3", "lat": 53.228, "lon": -2.598}
    assert calls["legacy"] == 0
    assert body["provider"] == "birdnetv3"
    assert body["configuredProvider"] == "birdnetv3"
    assert body["fallbackUsed"] is False
    assert body["providerVerified"] is True
    assert body["modelSha256"] == birdnet_v3_provider.ONNX_SHA256
    assert body["labelsSha256"] == birdnet_v3_provider.LABELS_SHA256
    assert (
        body["scoreBlacklistSha256"]
        == birdnet_v3_provider.SCORE_BLACKLIST_SHA256
    )
    assert body["geoModelSha256"] == birdnet_v3_provider.GEO_ONNX_SHA256
    assert body["geoLabelsSha256"] == birdnet_v3_provider.GEO_LABELS_SHA256
    assert body["policyVersion"] == birdnet_v3_provider.DECISION_POLICY_VERSION
    assert body["serverIntegrationVersion"] == integration.INTEGRATION_VERSION


@pytest.mark.parametrize(
    ("metadata_source", "field"),
    [
        ("model", "modelSha256"),
        ("model", "labelsSha256"),
        ("model", "scoreBlacklistSha256"),
        ("model", "policyVersion"),
        ("geo", "modelSha256"),
        ("geo", "labelsSha256"),
    ],
)
def test_exact_v3_provenance_rejects_each_mismatched_component(
    monkeypatch, metadata_source, field
):
    app, namespace, _ = direct_server()
    model = {
        "name": birdnet_v3_provider.MODEL_NAME,
        "version": "3.0-preview3.1",
        "modelSha256": birdnet_v3_provider.ONNX_SHA256,
        "labelsSha256": birdnet_v3_provider.LABELS_SHA256,
        "scoreBlacklistSha256": birdnet_v3_provider.SCORE_BLACKLIST_SHA256,
        "policyVersion": birdnet_v3_provider.DECISION_POLICY_VERSION,
    }
    geo = {
        "name": birdnet_v3_provider.GEO_MODEL_NAME,
        "version": "3.0.2",
        "modelSha256": birdnet_v3_provider.GEO_ONNX_SHA256,
        "labelsSha256": birdnet_v3_provider.GEO_LABELS_SHA256,
    }
    (model if metadata_source == "model" else geo)[field] = "wrong"
    monkeypatch.setattr(birdnet_v3_provider, "model_meta", lambda: model)
    monkeypatch.setattr(birdnet_v3_provider, "geo_model_meta", lambda: geo)
    monkeypatch.setattr(
        sound_id,
        "_run",
        lambda provider, path, allow, lat, lon, week: [candidate()],
    )
    integration.install(namespace, mode="direct")

    body = app.test_client().post("/api/identify/sound").get_json()

    assert body["provider"] == "birdnetv3"
    assert body["providerVerified"] is False


def test_direct_contract_caches_an_abstention_instead_of_running_old_retry_twice(monkeypatch):
    app, namespace, _ = direct_server()
    runs = []
    monkeypatch.setattr(
        sound_id,
        "_run",
        lambda provider, path, allow, lat, lon, week: runs.append(provider) or [],
    )
    integration.install(namespace, mode="direct")

    body = app.test_client().post("/api/identify/sound").get_json()
    assert body["found"] is False
    assert runs == ["birdnetv3"]
    assert body["provider"] == "birdnetv3"
    assert body["providerVerified"] is True


def test_malformed_request_after_success_cannot_inherit_v3_provenance(monkeypatch):
    app, namespace, _ = direct_server()
    monkeypatch.setattr(
        sound_id, "_run",
        lambda provider, path, allow, lat, lon, week: [candidate()],
    )
    integration.install(namespace, mode="direct")
    client = app.test_client()

    assert client.post("/api/identify/sound").get_json()["provider"] == "birdnetv3"
    malformed = client.post("/api/identify/sound?malformed=1").get_json()
    assert malformed["provider"] is None
    assert malformed["providerVerified"] is False


def test_earlier_short_circuit_hook_cannot_inherit_previous_provider(monkeypatch):
    app, namespace, _ = direct_server()

    @app.before_request
    def maintenance_gate():
        if flask.request.headers.get("X-Maintenance") == "1":
            return flask.jsonify({"found": False, "error": "maintenance"}), 503

    monkeypatch.setattr(
        sound_id, "_run",
        lambda provider, path, allow, lat, lon, week: [candidate()],
    )
    integration.install(namespace, mode="direct")
    client = app.test_client()

    assert client.post("/api/identify/sound").get_json()["provider"] == "birdnetv3"
    blocked = client.post(
        "/api/identify/sound", headers={"X-Maintenance": "1"}
    ).get_json()
    assert blocked["provider"] is None
    assert blocked["providerVerified"] is False


def test_response_names_perch_when_v3_really_fell_back(monkeypatch):
    app, namespace, _ = direct_server()
    monkeypatch.setenv("BURBZ_SOUND_MODEL_FALLBACK", "1")

    def run(provider, path, allow, lat, lon, week):
        if provider == "birdnetv3":
            raise RuntimeError("V3 unavailable")
        return [candidate("Eurasian Wren", "Troglodytes troglodytes", 0.8)]

    monkeypatch.setattr(sound_id, "_run", run)
    integration.install(namespace, mode="direct")
    body = app.test_client().post("/api/identify/sound").get_json()
    assert body["provider"] == "perch"
    assert body["configuredProvider"] == "birdnetv3"
    assert body["fallbackUsed"] is True
    assert body["modelName"] == "Perch 2.0"


def test_aggregate_contract_uses_truthy_token_and_preserves_allowlist(monkeypatch):
    app, namespace, calls = aggregate_server()
    seen = {}

    def run(provider, path, allow, lat, lon, week):
        seen["allow"] = allow
        return [candidate(), candidate("Common Chaffinch", "Fringilla coelebs", 0.75)]

    monkeypatch.setattr(sound_id, "_run", run)
    integration.install(namespace, mode="aggregate")
    body = app.test_client().post("/api/identify/sound").get_json()

    assert body["provider"] == "birdnetv3"
    assert len(body["allDetections"]) == 2
    assert seen["allow"] == {"parus major", "fringilla coelebs"}
    assert calls == {"legacy_analyse": 0, "legacy_aggregate": 0}


def test_integration_is_idempotent_and_rejects_unsupported_contract():
    app, namespace, _ = direct_server()
    first = integration.install(namespace, mode="direct")
    second = integration.install(namespace, mode="direct")
    assert first is second
    assert first["version"] == integration.INTEGRATION_VERSION

    with pytest.raises(integration.ServerIntegrationError):
        integration.install(namespace, mode="aggregate")

    with pytest.raises(integration.ServerIntegrationError):
        integration.install({"app": app}, mode="direct")
    with pytest.raises(integration.ServerIntegrationError):
        integration.install({"app": app, "_analyse_recording": lambda p: []}, mode="mystery")


def test_noncommercial_v2_requires_a_second_research_only_opt_in(monkeypatch):
    app, namespace, calls = direct_server()
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "birdnetv2")
    monkeypatch.delenv("BURBZ_ALLOW_NONCOMMERCIAL_V2", raising=False)
    with pytest.raises(integration.ServerIntegrationError, match="NonCommercial"):
        integration.install(namespace, mode="direct")

    monkeypatch.setenv("BURBZ_ALLOW_NONCOMMERCIAL_V2", "1")
    integration.install(namespace, mode="direct")
    body = app.test_client().post("/api/identify/sound").get_json()
    assert calls["legacy"] == 1
    assert body["provider"] == "birdnetv2"
