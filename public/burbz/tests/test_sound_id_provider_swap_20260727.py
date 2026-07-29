"""Swapping the sound recogniser between BirdNET V3, Perch 2.0 and legacy V2.4.

BirdNET V2.4's weights are CC BY-NC-SA 4.0 (non-commercial); BirdNET V3's are
CC BY-SA 4.0 and Perch 2.0's are Apache 2.0, so either can ship commercially.
V3 is the default. The choice is made at runtime, so switching engine is one
environment variable and no code change.

These tests run without onnxruntime, numpy or the production backend — the
model sessions are faked — so they pass in a source worktree.
"""
import sys
import types
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import sound_id  # noqa: E402
from sound_id import birdnet_provider  # noqa: E402

HTML = ROOT / "index.html"

pytest_numpy = pytest.importorskip


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    monkeypatch.delenv("BURBZ_SOUND_MODEL", raising=False)
    monkeypatch.delenv("BURBZ_SOUND_MODEL_FALLBACK", raising=False)
    sound_id.configure(
        birdnet_analyse=lambda path, **kw: [{"raw": path}],
        birdnet_aggregate=lambda detections, allow: [{
            "common_name": "House Sparrow",
            "scientific_name": "Passer domesticus",
            "max": 0.9, "mean": 0.9, "n": 1, "is_local": True,
        }],
        common_name_for=lambda scientific: None,
    )


# ---------------------------------------------------------------- selection

def test_birdnet_v3_is_the_default_so_a_fresh_deploy_is_commercially_clean():
    assert sound_id.active_provider() == "birdnetv3"
    assert sound_id.DEFAULT_PROVIDER == "birdnetv3"
    assert sound_id.is_commercial_safe()


def test_each_engine_is_selected_by_its_own_name(monkeypatch):
    for value, expected in [("perch", "perch"), ("birdnetv3", "birdnetv3"),
                            ("birdnetv2", "birdnetv2"), ("v3", "birdnetv3")]:
        monkeypatch.setenv("BURBZ_SOUND_MODEL", value)
        assert sound_id.active_provider() == expected


def test_a_bare_birdnet_means_v3_so_a_vague_value_never_picks_non_commercial(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "birdnet")
    assert sound_id.active_provider() == "birdnetv3"
    assert sound_id.is_commercial_safe()


def test_the_legacy_v2_path_is_flagged_as_non_commercial(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "birdnetv2")
    assert not sound_id.is_commercial_safe()
    assert "birdnetv2" in sound_id.NON_COMMERCIAL_PROVIDERS


def test_a_typo_in_the_env_var_does_not_take_sound_scanning_down(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "prech")
    assert sound_id.active_provider() == "birdnetv3"


def test_provider_labels_match_the_client_engine_names():
    # Both BirdNET generations read as plain "BirdNET" to a player.
    assert sound_id.provider_label("birdnetv3") == "BirdNET"
    assert sound_id.provider_label("birdnetv2") == "BirdNET"
    assert sound_id.provider_label("perch") == "Perch"
    assert sound_id.provider_label("nonsense") == "BirdNET"


# ------------------------------------------------------------------ birdnet

def test_birdnet_path_delegates_to_the_servers_own_helpers(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "birdnetv2")
    seen = {}

    def analyse_recording(path, **kwargs):
        seen["path"] = path
        seen["kwargs"] = kwargs
        return ["raw-detection"]

    def aggregate(detections, allow):
        seen["detections"] = detections
        seen["allow"] = allow
        return [{"common_name": "Robin", "scientific_name": "Erithacus rubecula",
                 "max": 0.8, "mean": 0.8, "n": 1, "is_local": True}]

    sound_id.configure(birdnet_analyse=analyse_recording, birdnet_aggregate=aggregate)
    out = sound_id.analyse("/tmp/clip.wav", allow={"robin"}, lat=51.5, lon=-0.1, week=30)

    assert seen["path"] == "/tmp/clip.wav"
    assert seen["kwargs"] == {"lat": 51.5, "lon": -0.1, "week": 30}
    assert seen["detections"] == ["raw-detection"]
    assert seen["allow"] == {"robin"}
    assert out[0]["scientific_name"] == "Erithacus rubecula"


def test_birdnet_helper_with_the_older_single_argument_signature(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "birdnetv2")

    def analyse_recording(path):
        return ["legacy"]

    sound_id.configure(
        birdnet_analyse=analyse_recording,
        birdnet_aggregate=lambda detections, allow: list(detections),
    )
    assert sound_id.analyse("/tmp/clip.wav") == ["legacy"]


def test_unconfigured_birdnet_raises_a_pointed_error():
    with pytest.raises(birdnet_provider.BirdNETUnavailable) as excinfo:
        birdnet_provider.analyse("/tmp/clip.wav")
    assert "sound_id.configure" in str(excinfo.value)


# -------------------------------------------------------------------- perch

def _v3_returning(common_name):
    return lambda *args, **kwargs: [{
        "common_name": common_name, "scientific_name": "Erithacus rubecula",
        "max": 0.8, "mean": 0.8, "n": 1, "is_local": True,
    }]


def test_perch_failure_falls_back_to_v3_rather_than_failing_the_scan(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "perch")

    from sound_id import birdnet_v3_provider, perch_provider

    def explode(*args, **kwargs):
        raise perch_provider.PerchUnavailable("onnxruntime is not installed")

    monkeypatch.setattr(perch_provider, "analyse", explode)
    monkeypatch.setattr(birdnet_v3_provider, "analyse", _v3_returning("Robin"))

    # "House Sparrow" is what the faked V2.4 helpers return, so seeing "Robin"
    # proves the fallback went to V3 and not to the non-commercial path.
    assert sound_id.analyse("/tmp/clip.wav")[0]["common_name"] == "Robin"


def test_v3_failure_falls_back_to_perch_and_never_to_non_commercial_v2(monkeypatch):
    from sound_id import birdnet_v3_provider, perch_provider

    def explode(*args, **kwargs):
        raise birdnet_v3_provider.BirdNETV3Unavailable("weights not installed")

    monkeypatch.setattr(birdnet_v3_provider, "analyse", explode)
    monkeypatch.setattr(perch_provider, "analyse", lambda *a, **k: [{
        "common_name": "Wren", "scientific_name": "Troglodytes troglodytes",
        "max": 0.7, "mean": 0.7, "n": 1, "is_local": True,
    }])

    out = sound_id.analyse("/tmp/clip.wav")
    assert out[0]["common_name"] == "Wren"
    assert out[0]["common_name"] != "House Sparrow"  # i.e. never the V2.4 helpers


def test_when_every_commercial_engine_fails_the_scan_returns_nothing(monkeypatch):
    """A failed scan must not be served by the non-commercial model instead."""
    from sound_id import birdnet_v3_provider, perch_provider

    def explode(*args, **kwargs):
        raise RuntimeError("no model")

    monkeypatch.setattr(birdnet_v3_provider, "analyse", explode)
    monkeypatch.setattr(perch_provider, "analyse", explode)
    assert sound_id.analyse("/tmp/clip.wav") == []


def test_fallback_can_be_disabled_so_failures_are_loud_while_testing(monkeypatch):
    monkeypatch.setenv("BURBZ_SOUND_MODEL", "perch")
    monkeypatch.setenv("BURBZ_SOUND_MODEL_FALLBACK", "0")

    from sound_id import perch_provider

    def explode(*args, **kwargs):
        raise perch_provider.PerchUnavailable("no model")

    monkeypatch.setattr(perch_provider, "analyse", explode)
    with pytest.raises(perch_provider.PerchUnavailable):
        sound_id.analyse("/tmp/clip.wav")


def test_perch_labels_are_scientific_binomials_with_the_header_row_dropped(tmp_path):
    from sound_id import perch_provider

    # The published labels.csv is CRLF with a header row that is not a species.
    path = tmp_path / "labels.csv"
    path.write_bytes(b"inat2024_fsd50k\r\nPasser domesticus\r\nTurdus merula\r\n")
    assert perch_provider._load_labels(str(path)) == ["Passer domesticus", "Turdus merula"]


def test_empty_label_file_is_rejected(tmp_path):
    from sound_id import perch_provider

    path = tmp_path / "labels.csv"
    path.write_text("", encoding="utf-8")
    with pytest.raises(perch_provider.PerchUnavailable):
        perch_provider._load_labels(str(path))


def test_perch_results_match_the_birdnet_aggregation_shape(monkeypatch, tmp_path):
    np = pytest.importorskip("numpy")
    from sound_id import perch_provider

    labels = ["Passer domesticus", "Turdus merula", "Erithacus rubecula"]
    # Two windows: sparrow strong in both, blackbird strong in one, robin never.
    scores = np.array([[4.0, -6.0, -6.0], [3.0, 4.0, -6.0]], dtype=np.float32)

    monkeypatch.setattr(perch_provider, "load", lambda force=False: object())
    monkeypatch.setattr(perch_provider, "_labels", labels)
    monkeypatch.setattr(perch_provider, "_read_wav", lambda path: (np.zeros(32000, dtype=np.float32), 32000))
    monkeypatch.setattr(perch_provider, "_windows", lambda samples, **kw: np.zeros((2, 4), dtype=np.float32))
    monkeypatch.setattr(perch_provider, "_infer", lambda session, batch: scores)

    out = perch_provider.analyse(str(tmp_path / "clip.wav"))

    assert [item["scientific_name"] for item in out] == ["Passer domesticus", "Turdus merula"]
    for item in out:
        assert set(item) == {"common_name", "scientific_name", "max", "mean", "n", "is_local"}
        assert 0.0 <= item["max"] <= 1.0
    sparrow = out[0]
    assert sparrow["n"] == 2                      # over threshold in both windows
    assert sparrow["common_name"] == "Passer domesticus"  # no resolver supplied


def test_perch_uses_the_catalogue_resolver_for_common_names(monkeypatch, tmp_path):
    np = pytest.importorskip("numpy")
    from sound_id import perch_provider

    monkeypatch.setattr(perch_provider, "load", lambda force=False: object())
    monkeypatch.setattr(perch_provider, "_labels", ["Passer domesticus"])
    monkeypatch.setattr(perch_provider, "_read_wav", lambda path: (np.zeros(10, dtype=np.float32), 32000))
    monkeypatch.setattr(perch_provider, "_windows", lambda samples, **kw: np.zeros((1, 4), dtype=np.float32))
    monkeypatch.setattr(perch_provider, "_infer", lambda session, batch: np.array([[5.0]], dtype=np.float32))

    out = perch_provider.analyse(
        str(tmp_path / "clip.wav"),
        common_name_for=lambda scientific: "House Sparrow",
    )
    assert out[0]["common_name"] == "House Sparrow"
    assert out[0]["scientific_name"] == "Passer domesticus"


def test_allowlist_marks_locality_since_perch_has_no_geographic_prior(monkeypatch, tmp_path):
    np = pytest.importorskip("numpy")
    from sound_id import perch_provider

    labels = ["Passer domesticus", "Turdus merula"]
    monkeypatch.setattr(perch_provider, "load", lambda force=False: object())
    monkeypatch.setattr(perch_provider, "_labels", labels)
    monkeypatch.setattr(perch_provider, "_read_wav", lambda path: (np.zeros(10, dtype=np.float32), 32000))
    monkeypatch.setattr(perch_provider, "_windows", lambda samples, **kw: np.zeros((1, 4), dtype=np.float32))
    monkeypatch.setattr(perch_provider, "_infer", lambda s, b: np.array([[5.0, 5.0]], dtype=np.float32))

    out = perch_provider.analyse(str(tmp_path / "clip.wav"), allow={"passer domesticus"})
    locality = {item["scientific_name"]: item["is_local"] for item in out}
    assert locality == {"Passer domesticus": True, "Turdus merula": False}
    # Local birds sort ahead of non-local ones, as BirdNET's aggregation did.
    assert out[0]["scientific_name"] == "Passer domesticus"


def test_threshold_is_configurable_and_filters_weak_detections(monkeypatch, tmp_path):
    np = pytest.importorskip("numpy")
    from sound_id import perch_provider

    monkeypatch.setattr(perch_provider, "load", lambda force=False: object())
    monkeypatch.setattr(perch_provider, "_labels", ["Passer domesticus"])
    monkeypatch.setattr(perch_provider, "_read_wav", lambda path: (np.zeros(10, dtype=np.float32), 32000))
    monkeypatch.setattr(perch_provider, "_windows", lambda samples, **kw: np.zeros((1, 4), dtype=np.float32))
    monkeypatch.setattr(perch_provider, "_infer", lambda s, b: np.array([[0.0]], dtype=np.float32))

    # sigmoid(0) == 0.5, so the default threshold keeps it and a higher one drops it.
    assert len(perch_provider.analyse(str(tmp_path / "c.wav"))) == 1
    monkeypatch.setenv("BURBZ_PERCH_MIN_CONFIDENCE", "0.8")
    assert perch_provider.analyse(str(tmp_path / "c.wav")) == []


def test_label_count_mismatch_is_reported_rather_than_mislabelling_birds(monkeypatch, tmp_path):
    np = pytest.importorskip("numpy")
    from sound_id import perch_provider

    monkeypatch.setattr(perch_provider, "load", lambda force=False: object())
    monkeypatch.setattr(perch_provider, "_labels", ["Passer domesticus", "Turdus merula"])
    monkeypatch.setattr(perch_provider, "_read_wav", lambda path: (np.zeros(10, dtype=np.float32), 32000))
    monkeypatch.setattr(perch_provider, "_windows", lambda samples, **kw: np.zeros((1, 4), dtype=np.float32))
    monkeypatch.setattr(perch_provider, "_infer", lambda s, b: np.array([[1.0, 2.0, 3.0]], dtype=np.float32))

    with pytest.raises(perch_provider.PerchUnavailable) as excinfo:
        perch_provider.analyse(str(tmp_path / "clip.wav"))
    assert "out of step" in str(excinfo.value)


def test_windows_are_five_seconds_at_32k_and_peak_normalised():
    np = pytest.importorskip("numpy")
    from sound_id import perch_provider

    assert perch_provider.SAMPLE_RATE == 32000
    assert perch_provider.WINDOW_SAMPLES == 160000

    loud = np.ones(perch_provider.WINDOW_SAMPLES, dtype=np.float32)
    normalised = perch_provider._normalise(loud)
    assert np.isclose(np.max(np.abs(normalised)), perch_provider.PEAK_LEVEL, atol=1e-6)
    # Silence must not divide by zero.
    assert np.max(np.abs(perch_provider._normalise(np.zeros(16, dtype=np.float32)))) == 0.0


def test_short_clips_are_padded_into_one_window():
    np = pytest.importorskip("numpy")
    from sound_id import perch_provider

    batch = perch_provider._windows(np.ones(perch_provider.SAMPLE_RATE * 2, dtype=np.float32))
    assert batch.shape == (1, perch_provider.WINDOW_SAMPLES)
    assert perch_provider._windows(np.zeros(0, dtype=np.float32)).shape[0] == 0


# ------------------------------------------------------------------- client

def test_client_keeps_birdnet_as_the_fallback_engine_label():
    html = HTML.read_text(encoding="utf-8")
    assert "birdnet:'BirdNET'" in html and "perch:'Perch'" in html
    assert "SOUND_ENGINE_LABELS.birdnet" in html


def test_player_facing_disclosure_is_engine_neutral():
    html = HTML.read_text(encoding="utf-8")
    # The privacy disclosure and tutorial must read correctly under either
    # engine, so a rollback needs no copy change.
    assert "sent to the Burbz server for bird-sound analysis" in html
    assert "uploaded for bird-sound analysis only" in html
    assert "for BirdNET analysis" not in html


def test_merlin_never_says_a_brand_name_but_perch_league_survives():
    html = HTML.read_text(encoding="utf-8")
    compact = html.split("function compactMerlinSpeech(msg)", 1)[1].split("function petSay", 1)[0]
    assert "/\\bBirdNET\\b/gi" in compact
    # Bare "Perch" must not be stripped — the game has a Perch League.
    assert "match:|identified" in compact


# ------------------------------------------------------- location from upload

def test_location_is_taken_from_the_upload_when_the_call_omits_it(monkeypatch):
    """Without a location the range filter cannot exclude the wrong continent."""
    flask = pytest.importorskip("flask")
    from sound_id import birdnet_v3_provider

    seen = {}

    def capture(path, **kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(birdnet_v3_provider, "analyse", capture)
    app = flask.Flask(__name__)
    with app.test_request_context("/api/identify/sound", method="POST",
                                  data={"lat": "51.5", "lon": "-0.13"}):
        sound_id.analyse("/tmp/clip.wav")

    assert (seen["lat"], seen["lon"]) == (51.5, -0.13)


def test_an_explicit_location_is_not_overridden_by_the_upload(monkeypatch):
    flask = pytest.importorskip("flask")
    from sound_id import birdnet_v3_provider

    seen = {}
    monkeypatch.setattr(birdnet_v3_provider, "analyse",
                        lambda path, **kw: seen.update(kw) or [])
    app = flask.Flask(__name__)
    with app.test_request_context("/api/identify/sound", method="POST",
                                  data={"lat": "1.0", "lon": "2.0"}):
        sound_id.analyse("/tmp/clip.wav", lat=51.5, lon=-0.13)

    assert (seen["lat"], seen["lon"]) == (51.5, -0.13)


@pytest.mark.parametrize("posted", [{}, {"lat": "abc", "lon": "xyz"}])
def test_missing_or_malformed_coordinates_do_not_fail_the_scan(monkeypatch, posted):
    flask = pytest.importorskip("flask")
    from sound_id import birdnet_v3_provider

    seen = {}
    monkeypatch.setattr(birdnet_v3_provider, "analyse",
                        lambda path, **kw: seen.update(kw) or [])
    app = flask.Flask(__name__)
    with app.test_request_context("/api/identify/sound", method="POST", data=posted):
        assert sound_id.analyse("/tmp/clip.wav") == []
    assert seen["lat"] is None and seen["lon"] is None


def test_outside_a_request_the_location_is_simply_absent(monkeypatch):
    """The self-test and any offline batch run have no request in flight."""
    from sound_id import birdnet_v3_provider

    seen = {}
    monkeypatch.setattr(birdnet_v3_provider, "analyse",
                        lambda path, **kw: seen.update(kw) or [])
    sound_id.analyse("/tmp/clip.wav")
    assert seen["lat"] is None and seen["lon"] is None


# ----------------------------------------------------------- week from upload

def test_the_week_is_taken_from_the_upload_when_the_call_omits_it(monkeypatch):
    """Half the range filter is seasonal, and the client's clock beats ours.

    A Swift is a fine answer for a London garden in June and an impossible one
    in January. Falling back to the server date works only while the server and
    the player are on the same day, in the same timezone.
    """
    flask = pytest.importorskip("flask")
    from sound_id import birdnet_v3_provider

    seen = {}
    monkeypatch.setattr(birdnet_v3_provider, "analyse",
                        lambda path, **kw: seen.update(kw) or [])
    app = flask.Flask(__name__)
    with app.test_request_context("/api/identify/sound", method="POST",
                                  data={"lat": "51.5", "lon": "-0.13", "week": "23"}):
        sound_id.analyse("/tmp/clip.wav")

    assert seen["week"] == 23


def test_an_explicit_week_is_not_overridden_by_the_upload(monkeypatch):
    flask = pytest.importorskip("flask")
    from sound_id import birdnet_v3_provider

    seen = {}
    monkeypatch.setattr(birdnet_v3_provider, "analyse",
                        lambda path, **kw: seen.update(kw) or [])
    app = flask.Flask(__name__)
    with app.test_request_context("/api/identify/sound", method="POST", data={"week": "4"}):
        sound_id.analyse("/tmp/clip.wav", week=41)

    assert seen["week"] == 41


@pytest.mark.parametrize("posted", [{}, {"week": ""}, {"week": "not-a-week"}])
def test_a_missing_or_malformed_week_falls_back_to_the_server_date(monkeypatch, posted):
    flask = pytest.importorskip("flask")
    from sound_id import birdnet_v3_provider

    seen = {}
    monkeypatch.setattr(birdnet_v3_provider, "analyse",
                        lambda path, **kw: seen.update(kw) or [])
    app = flask.Flask(__name__)
    with app.test_request_context("/api/identify/sound", method="POST", data=posted):
        assert sound_id.analyse("/tmp/clip.wav") == []
    # None is the provider's "use today" signal, not an error.
    assert seen["week"] is None
