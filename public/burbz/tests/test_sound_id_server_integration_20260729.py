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


def catalogue_mapping_server():
    """Mirror the live response mapper, including an incomplete catalogue row."""
    app = flask.Flask(__name__ + ".catalogue_mapping")

    def legacy_analyse(path, **kwargs):
        return []

    def catalogue_lookup(scientific_name, common_name=None):
        assert common_name == "Rook"
        return {
            "common_name": "Rook",
            "latin_name": None,
            "species_id": "rook",
        }

    def fragile_species_mapper(scientific_name, common_name, confidence, catalog_entry):
        display_scientific = catalog_entry.get("latin_name")
        # This is the exact operation that crashed in production.
        display_scientific.encode()
        return {
            "name": catalog_entry.get("common_name") or common_name,
            "scientificName": display_scientific,
            "confidence": confidence,
        }

    namespace = {
        "app": app,
        "_analyse_recording": legacy_analyse,
        "_catalog_lookup": catalogue_lookup,
        "_species_to_game_bird": fragile_species_mapper,
    }

    def species_to_game_bird(scientific_name, common_name, confidence):
        entry = namespace["_catalog_lookup"](scientific_name, common_name)
        return namespace["_species_to_game_bird"](
            scientific_name, common_name, confidence, entry
        )

    namespace["species_to_game_bird"] = species_to_game_bird

    @app.post("/api/identify/sound")
    def identify_sound():
        detections = namespace["_analyse_recording"]("/tmp/window.wav")
        winner = detections[0]
        bird = namespace["species_to_game_bird"](
            winner["scientific_name"],
            winner["common_name"],
            winner["confidence"],
        )
        return flask.jsonify({"found": True, "bird": bird})

    return app, namespace


def configure_like_embedded_v4(app):
    """Call configure() from the exact private namespace shipped by v4."""
    namespace = {
        "__name__": "installed_legacy_v4_server",
        "app": app,
        "_burbz_sound_id": sound_id,
        "_burbz_v2_analyse": lambda path, **kwargs: [],
        "_burbz_v2_aggregate": lambda detections, allow=None: [],
    }
    exec(
        "_burbz_sound_id.configure("
        "birdnet_analyse=_burbz_v2_analyse,"
        "birdnet_aggregate=_burbz_v2_aggregate"
        ")",
        namespace,
        namespace,
    )
    return namespace


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


def test_incomplete_rook_catalogue_row_cannot_crash_a_valid_v3_detection(monkeypatch):
    app, namespace = catalogue_mapping_server()
    monkeypatch.setattr(
        sound_id,
        "_run",
        lambda provider, path, allow, lat, lon, week: [
            candidate("Rook", "Corvus frugilegus", 0.81)
        ],
    )
    integration.install(namespace, mode="direct")

    response = app.test_client().post("/api/identify/sound")
    body = response.get_json()

    assert response.status_code == 200
    assert body["bird"]["name"] == "Rook"
    assert body["bird"]["scientificName"] == "Corvus frugilegus"
    assert body["provider"] == "birdnetv3"


def test_embedded_v4_configure_gets_exact_package_only_provenance(monkeypatch):
    app = flask.Flask(__name__ + ".embedded_v4")

    @app.post("/api/identify/sound")
    def identify_sound():
        detections = sound_id.analyse("/tmp/window.wav")
        return flask.jsonify({"found": bool(detections), "allDetections": detections})

    monkeypatch.setattr(
        sound_id,
        "_run",
        lambda provider, path, allow, lat, lon, week: [candidate()],
    )
    configure_like_embedded_v4(app)
    first_state = getattr(app, integration._PROVENANCE_STATE_ATTR)
    before_count = len(app.before_request_funcs.get(None, []))
    after_count = len(app.after_request_funcs.get(None, []))

    # The embedded block may call configure again during a reload. Hook
    # registration is app-idempotent and must not duplicate response mutation.
    configure_like_embedded_v4(app)
    assert getattr(app, integration._PROVENANCE_STATE_ATTR) is first_state
    assert len(app.before_request_funcs.get(None, [])) == before_count
    assert len(app.after_request_funcs.get(None, [])) == after_count

    # The installed v4 block registers this old three-field hook *after*
    # configure(). Flask runs after-request hooks in reverse order, so the
    # package hook must still write the final exact schema even though the old
    # hook does not understand it.
    @app.after_request
    def embedded_v4_tag(response):
        try:
            payload = response.get_json(silent=True)
            meta = sound_id.served_meta()
            payload["provider"] = meta["provider"]
            payload["providerLabel"] = meta["label"]
            payload["commercial"] = meta["commercial"]
            response.set_data(flask.json.dumps(payload))
        except Exception:
            pass
        return response

    body = app.test_client().post("/api/identify/sound").get_json()
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


def test_embedded_v4_hooks_clear_stale_provenance_on_an_early_error(monkeypatch):
    app = flask.Flask(__name__ + ".embedded_v4_clear")

    @app.post("/api/identify/sound")
    def identify_sound():
        if flask.request.args.get("malformed"):
            return flask.jsonify({"found": False, "error": "no audio"}), 400
        return flask.jsonify(
            {"found": bool(sound_id.analyse("/tmp/window.wav"))}
        )

    monkeypatch.setattr(
        sound_id,
        "_run",
        lambda provider, path, allow, lat, lon, week: [candidate()],
    )
    configure_like_embedded_v4(app)
    client = app.test_client()

    assert client.post("/api/identify/sound").get_json()["provider"] == "birdnetv3"
    malformed = client.post("/api/identify/sound?malformed=1").get_json()
    assert malformed["provider"] is None
    assert malformed["providerVerified"] is False
    assert malformed["serverIntegrationVersion"] == integration.INTEGRATION_VERSION


def test_integration_is_idempotent_and_rejects_unsupported_contract():
    app, namespace, _ = direct_server()
    first = integration.install(namespace, mode="direct")
    second = integration.install(namespace, mode="direct")
    assert first is second
    assert first["version"] == integration.INTEGRATION_VERSION
    assert len(app.before_request_funcs.get(None, [])) == 1
    assert len(app.after_request_funcs.get(None, [])) == 1

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
