"""BirdNET+ V3.0 — the recogniser Burbz ships.

V3's weights are CC BY-SA 4.0, so unlike V2.4 they can be used commercially.
These tests cover the handling details that make V3 behave correctly on real
Burbz recordings, each of which was found by running the published weights
rather than reading about them:

* near-silent audio makes the FP16 weights emit NaN for every class, and the
  listener rotates 12-second windows continuously, so silence is routine;
* zero-padding a short clip to the old fixed 3-second window corrupts the
  result badly enough to name a bird from the wrong continent;
* the range filter is a separate model with its own 12,012-species label space.

Everything here runs without the weights installed — the ONNX session is faked.
The tests at the bottom exercise the real model and skip when it is absent.
"""
import os
import sys
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

np = pytest.importorskip("numpy")

from sound_id import birdnet_v3_provider as v3  # noqa: E402

LABEL_HEADER = "idx;id;sci_name;com_name;class;order\n"


# These say where the weights are, not how to behave, so a test run against a
# real install must keep them.
_ASSET_LOCATION_VARS = frozenset({
    "BURBZ_BIRDNET_V3_MODEL_DIR",
    "BURBZ_BIRDNET_V3_ONNX_PATH",
    "BURBZ_BIRDNET_V3_LABELS_PATH",
    "BURBZ_BIRDNET_V3_GEO_ONNX_PATH",
    "BURBZ_BIRDNET_V3_GEO_LABELS_PATH",
})


@pytest.fixture(autouse=True)
def _clean_env(monkeypatch):
    for name in list(os.environ):
        if name.startswith("BURBZ_BIRDNET_V3") and name not in _ASSET_LOCATION_VARS:
            monkeypatch.delenv(name, raising=False)
    v3._geo_cache.clear()


def _labels(*rows):
    """rows are (sci, com, class) triples."""
    return [{"scientific_name": s, "common_name": c, "class": k} for s, c, k in rows]


def _install(monkeypatch, labels, scores, geo=None):
    """Wire a fake model returning `scores` (one row per chunk)."""
    monkeypatch.setattr(v3, "load", lambda force=False: object())
    monkeypatch.setattr(v3, "_labels", labels)
    monkeypatch.setattr(v3, "_bird_mask",
                        np.array([row["class"] == "Aves" for row in labels], dtype=bool))
    monkeypatch.setattr(v3._audio, "read_mono",
                        lambda path: (np.ones(v3.SAMPLE_RATE, dtype=np.float32), 32000))
    monkeypatch.setattr(v3, "_chunks",
                        lambda samples, **kw: [np.ones(4, dtype=np.float32)] * len(scores))
    monkeypatch.setattr(v3, "_infer",
                        lambda session, chunks: np.asarray(scores, dtype=np.float32))
    monkeypatch.setattr(v3, "_load_geo", lambda: geo)


# ------------------------------------------------------------------- labels

def test_labels_are_read_from_the_semicolon_bom_encoded_v3_table(tmp_path):
    path = tmp_path / "labels.csv"
    path.write_bytes(
        "﻿".encode("utf-8")
        + (LABEL_HEADER
           + "0;3;Passer domesticus;House Sparrow;Aves;Passeriformes\n"
           + "1;5;Acheta domesticus;House cricket;Insecta;Orthoptera\n").encode("utf-8")
    )
    rows = v3._load_labels(str(path))
    assert rows == [
        {"scientific_name": "Passer domesticus", "common_name": "House Sparrow", "class": "Aves"},
        {"scientific_name": "Acheta domesticus", "common_name": "House cricket", "class": "Insecta"},
    ]


def test_out_of_order_labels_are_rejected_rather_than_mislabelling_every_bird(tmp_path):
    path = tmp_path / "labels.csv"
    path.write_text(
        LABEL_HEADER
        + "0;3;Passer domesticus;House Sparrow;Aves;Passeriformes\n"
        + "7;5;Turdus merula;Common Blackbird;Aves;Passeriformes\n",
        encoding="utf-8",
    )
    with pytest.raises(v3.BirdNETV3Unavailable) as excinfo:
        v3._load_labels(str(path))
    assert "class order" in str(excinfo.value)


def test_a_label_file_from_the_wrong_model_is_rejected(tmp_path):
    path = tmp_path / "labels.csv"
    path.write_text("inat2024_fsd50k\nPasser domesticus\n", encoding="utf-8")
    with pytest.raises(v3.BirdNETV3Unavailable):
        v3._load_labels(str(path))


def test_an_empty_label_file_is_rejected(tmp_path):
    path = tmp_path / "labels.csv"
    path.write_text(LABEL_HEADER, encoding="utf-8")
    with pytest.raises(v3.BirdNETV3Unavailable):
        v3._load_labels(str(path))


# -------------------------------------------------------------------- audio

def test_quiet_audio_is_normalised_because_the_fp16_weights_nan_on_it():
    quiet = (np.random.RandomState(0).randn(1000) * 1e-4).astype(np.float32)
    normalised, silent = v3._normalise(quiet)
    assert not silent
    assert np.isclose(np.max(np.abs(normalised)), 1.0, atol=1e-5)


def test_digital_silence_is_reported_rather_than_amplified():
    normalised, silent = v3._normalise(np.zeros(1000, dtype=np.float32))
    assert silent
    assert np.max(np.abs(normalised)) == 0.0


def test_silent_windows_are_dropped_so_a_rotating_listener_never_sees_nan():
    # 12 s of digital silence — what the listener records with a muted mic.
    assert v3._chunks(np.zeros(v3.SAMPLE_RATE * 12, dtype=np.float32)) == []


def test_short_clips_keep_their_true_length_because_padding_corrupts_v3():
    # Padding this repo's 2.2 s blackbird clip to 3 s drops Common Blackbird
    # from 0.46 to 0.04 and promotes American Robin. V3 takes variable-length
    # input, so a short chunk must reach the model unpadded.
    samples = np.ones(int(v3.SAMPLE_RATE * 2.2), dtype=np.float32)
    chunks = v3._chunks(samples)
    assert len(chunks) == 1
    assert chunks[0].size == samples.size
    assert chunks[0].size != v3.CHUNK_SAMPLES


def test_a_twelve_second_window_splits_into_four_full_chunks():
    chunks = v3._chunks(np.ones(v3.SAMPLE_RATE * 12, dtype=np.float32))
    assert [chunk.size for chunk in chunks] == [v3.CHUNK_SAMPLES] * 4


def test_a_tail_too_short_to_identify_is_dropped_not_padded():
    # 12.2 s: four full chunks and a 0.2 s remainder, below the 0.5 s floor.
    chunks = v3._chunks(np.ones(int(v3.SAMPLE_RATE * 12.2), dtype=np.float32))
    assert [chunk.size for chunk in chunks] == [v3.CHUNK_SAMPLES] * 4


def test_an_odd_tail_worth_keeping_survives_at_its_own_length():
    chunks = v3._chunks(np.ones(int(v3.SAMPLE_RATE * 13.5), dtype=np.float32))
    assert [chunk.size for chunk in chunks] == [v3.CHUNK_SAMPLES] * 4 + [v3.SAMPLE_RATE * 3 // 2]


def test_chunks_of_different_lengths_are_batched_separately_not_padded(monkeypatch):
    """A batch tensor is rectangular, so equal lengths must be grouped."""
    monkeypatch.setattr(v3, "_input_name", "input")
    seen = []

    class Session:
        def run(self, outputs, feed):
            block = feed["input"]
            seen.append(block.shape)
            return [np.full((block.shape[0], 3), 0.5, dtype=np.float32)]

    chunks = [np.ones(96000, np.float32), np.ones(96000, np.float32), np.ones(4000, np.float32)]
    scores = v3._infer(Session(), chunks)

    assert scores.shape == (3, 3)
    assert sorted(seen) == [(1, 4000), (2, 96000)]


# ---------------------------------------------------------------- filtering

def test_results_match_the_shape_server_py_already_consumes(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9, 0.02], [0.7, 0.6]])

    out = v3.analyse("/tmp/clip.wav")
    assert [item["scientific_name"] for item in out] == ["Passer domesticus", "Turdus merula"]
    for item in out:
        assert set(item) == {"common_name", "scientific_name", "max", "mean", "n", "is_local"}
        assert 0.0 <= item["max"] <= 1.0
    sparrow = out[0]
    assert sparrow["n"] == 2                # over threshold in both chunks
    assert sparrow["max"] == pytest.approx(0.9)


def test_scores_are_used_as_probabilities_without_a_second_sigmoid(monkeypatch):
    """V3 output is already activated — applying sigmoid again would break it."""
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"))
    _install(monkeypatch, labels, [[0.9]])
    assert v3.analyse("/tmp/clip.wav")[0]["max"] == pytest.approx(0.9)


def test_non_birds_are_kept_out_of_a_bird_game_by_default(monkeypatch):
    labels = _labels(("Acheta domesticus", "House cricket", "Insecta"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.99, 0.30]])

    assert [i["scientific_name"] for i in v3.analyse("/tmp/c.wav")] == ["Turdus merula"]


def test_non_birds_can_be_let_back_in(monkeypatch):
    labels = _labels(("Acheta domesticus", "House cricket", "Insecta"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.99, 0.30]])
    monkeypatch.setenv("BURBZ_BIRDNET_V3_BIRDS_ONLY", "0")

    assert [i["scientific_name"] for i in v3.analyse("/tmp/c.wav")][0] == "Acheta domesticus"


def test_the_threshold_is_configurable_and_filters_weak_detections(monkeypatch):
    labels = _labels(("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.2]])

    assert len(v3.analyse("/tmp/c.wav")) == 1        # 0.2 clears the 0.15 default
    monkeypatch.setenv("BURBZ_BIRDNET_V3_MIN_CONFIDENCE", "0.5")
    assert v3.analyse("/tmp/c.wav") == []


def test_nan_scores_are_never_served_to_a_player(monkeypatch):
    labels = _labels(("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[float("nan")]])
    assert v3.analyse("/tmp/c.wav") == []


def test_label_count_mismatch_is_reported_rather_than_mislabelling_birds(monkeypatch):
    labels = _labels(("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9, 0.8, 0.7]])
    with pytest.raises(v3.BirdNETV3Unavailable) as excinfo:
        v3.analyse("/tmp/c.wav")
    assert "out of step" in str(excinfo.value)


# ------------------------------------------------------------- common names

def test_the_catalogue_name_wins_over_the_models_own_wording(monkeypatch):
    # V3 says "Eurasian Blackbird"; the game says "Common Blackbird".
    labels = _labels(("Turdus merula", "Eurasian Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9]])

    out = v3.analyse("/tmp/c.wav", common_name_for=lambda sci: "Common Blackbird")
    assert out[0]["common_name"] == "Common Blackbird"


def test_the_models_common_name_is_used_when_the_catalogue_has_none(monkeypatch):
    labels = _labels(("Turdus merula", "Eurasian Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9]])

    out = v3.analyse("/tmp/c.wav", common_name_for=lambda sci: None)
    assert out[0]["common_name"] == "Eurasian Blackbird"


def test_a_broken_resolver_does_not_fail_the_scan(monkeypatch):
    labels = _labels(("Turdus merula", "Eurasian Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9]])

    def explode(scientific):
        raise KeyError("catalogue offline")

    assert v3.analyse("/tmp/c.wav", common_name_for=explode)[0]["common_name"] == "Eurasian Blackbird"


# ------------------------------------------------------------------locality

def test_the_allowlist_still_marks_locality_and_sorts_local_birds_first(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.8, 0.9]])

    out = v3.analyse("/tmp/c.wav", allow={"passer domesticus"})
    assert {i["scientific_name"]: i["is_local"] for i in out} == {
        "Passer domesticus": True, "Turdus merula": False,
    }
    # Local first, even though the blackbird scored higher.
    assert out[0]["scientific_name"] == "Passer domesticus"


def test_the_allowlist_also_matches_the_models_own_common_name(monkeypatch):
    labels = _labels(("Turdus merula", "Eurasian Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9]])
    assert v3.analyse("/tmp/c.wav", allow={"eurasian blackbird"})[0]["is_local"]


# --------------------------------------------------------------range filter

class _Geo:
    """A fake geomodel: the sparrow is present, the cockatoo is not."""

    def run(self, outputs, feed):
        return [np.array([[0.99, 0.0005]], dtype=np.float32)]


def _install_geo(monkeypatch):
    monkeypatch.setattr(v3, "_geo_index",
                        {"passer domesticus": 0, "cacatua galerita": 1})


def test_a_species_outside_its_range_is_filtered_out(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Cacatua galerita", "Sulphur-crested Cockatoo", "Aves"))
    _install(monkeypatch, labels, [[0.5, 0.95]], geo=_Geo())
    _install_geo(monkeypatch)

    # The cockatoo scores higher, but not in London.
    out = v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13, week=29)
    assert [i["scientific_name"] for i in out] == ["Passer domesticus"]


def test_without_a_location_nothing_is_range_filtered(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Cacatua galerita", "Sulphur-crested Cockatoo", "Aves"))
    _install(monkeypatch, labels, [[0.5, 0.95]], geo=_Geo())
    _install_geo(monkeypatch)

    assert len(v3.analyse("/tmp/c.wav")) == 2


def test_the_range_filter_can_be_switched_off(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Cacatua galerita", "Sulphur-crested Cockatoo", "Aves"))
    _install(monkeypatch, labels, [[0.5, 0.95]], geo=_Geo())
    _install_geo(monkeypatch)
    monkeypatch.setenv("BURBZ_BIRDNET_V3_GEO", "0")

    assert len(v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13)) == 2


def test_a_species_the_geomodel_does_not_know_is_kept(monkeypatch):
    """An unknown range is not evidence of absence."""
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Gallus gallus", "Red Junglefowl", "Aves"))
    _install(monkeypatch, labels, [[0.5, 0.95]], geo=_Geo())
    _install_geo(monkeypatch)  # junglefowl is absent from the geomodel index

    assert "Gallus gallus" in [i["scientific_name"] for i in v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13)]


def test_a_missing_range_filter_does_not_stop_identification(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"))
    _install(monkeypatch, labels, [[0.9]], geo=None)
    assert len(v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13)) == 1


def test_range_predictions_are_cached_per_location_and_week(monkeypatch):
    calls = []

    class Counting(_Geo):
        def run(self, outputs, feed):
            calls.append(tuple(feed["input"][0]))
            return super().run(outputs, feed)

    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Cacatua galerita", "Sulphur-crested Cockatoo", "Aves"))
    _install(monkeypatch, labels, [[0.9, 0.1]], geo=Counting())
    _install_geo(monkeypatch)

    for _ in range(3):
        v3.analyse("/tmp/c.wav", lat=51.5001, lon=-0.1299, week=29)
    assert len(calls) == 1  # rounded to 2dp, so all three share one prediction


# ---------------------------------------------------------------------- week

def test_the_week_is_birdnets_four_per_month_1_to_48():
    assert v3._birdnet_week(22) == 22
    assert v3._birdnet_week(0) == 1        # clamped
    assert v3._birdnet_week(99) == 48      # clamped
    assert 1 <= v3._birdnet_week(None) <= 48   # derived from today


def test_a_nonsense_week_falls_back_to_today_rather_than_raising():
    assert 1 <= v3._birdnet_week("later") <= 48


# --------------------------------------------------- missing weights message

def test_a_missing_model_says_how_to_install_it(monkeypatch, tmp_path):
    for name in _ASSET_LOCATION_VARS:
        monkeypatch.delenv(name, raising=False)
    monkeypatch.setenv("BURBZ_BIRDNET_V3_MODEL_DIR", str(tmp_path))
    with pytest.raises(v3.BirdNETV3Unavailable) as excinfo:
        v3._resolve_asset("BURBZ_BIRDNET_V3_ONNX_PATH", v3.ONNX_FILENAME, "https://example/x")
    assert "install-birdnet-v3.sh" in str(excinfo.value)


# ------------------------------------------------ the real weights, if present

def _models_installed():
    directory = os.environ.get("BURBZ_BIRDNET_V3_MODEL_DIR", "/opt/burbz/models")
    return os.path.exists(os.path.join(directory, v3.ONNX_FILENAME))


needs_weights = pytest.mark.skipif(
    not _models_installed(),
    reason="BirdNET V3 weights not installed (run scripts/install-birdnet-v3.sh)",
)


@needs_weights
def test_the_real_model_identifies_a_real_tawny_owl(tmp_path):
    soundfile = pytest.importorskip("soundfile")
    source = ROOT / "assets" / "audio" / "bird-tawny-owl.ogg"
    if not source.exists():
        pytest.skip("reference recording not deployed")

    data, rate = soundfile.read(str(source), dtype="float32", always_2d=True)
    wav = tmp_path / "owl.wav"
    soundfile.write(str(wav), data.mean(axis=1), rate, subtype="PCM_16")

    out = v3.analyse(str(wav))
    assert out and out[0]["scientific_name"] == "Strix aluco"
    assert out[0]["max"] > 0.5


@needs_weights
def test_the_real_model_returns_nothing_for_silence(tmp_path):
    soundfile = pytest.importorskip("soundfile")
    wav = tmp_path / "silence.wav"
    soundfile.write(str(wav), np.zeros(48000 * 12, dtype=np.float32), 48000, subtype="PCM_16")
    assert v3.analyse(str(wav)) == []


@needs_weights
def test_the_real_range_filter_places_a_tawny_owl_in_london_not_sydney(tmp_path):
    soundfile = pytest.importorskip("soundfile")
    if v3._load_geo() is None:
        pytest.skip("range filter not installed")

    source = ROOT / "assets" / "audio" / "bird-tawny-owl.ogg"
    if not source.exists():
        pytest.skip("reference recording not deployed")
    data, rate = soundfile.read(str(source), dtype="float32", always_2d=True)
    wav = tmp_path / "owl.wav"
    soundfile.write(str(wav), data.mean(axis=1), rate, subtype="PCM_16")

    london = [i["scientific_name"] for i in v3.analyse(str(wav), lat=51.5, lon=-0.13, week=29)]
    sydney = [i["scientific_name"] for i in v3.analyse(str(wav), lat=-33.87, lon=151.21, week=29)]
    assert "Strix aluco" in london
    assert "Strix aluco" not in sydney
