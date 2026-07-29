"""BirdNET+ V3.0 — the recogniser Burbz ships.

V3's weights are CC BY-SA 4.0, so unlike V2.4 they can be used commercially.
These tests cover the handling details that make V3 behave correctly on real
Burbz recordings, each of which was found by running the published weights
rather than reading about them:

* near-silent audio can make the FP16 weights emit NaN, while peak-normalising
  it materially strengthens a known Mistle Thrush false positive;
* zero-padding a short clip to the old fixed 3-second window corrupts the
  result badly enough to name a bird from the wrong continent;
* the range filter is a separate model whose labels must be mapped by
  scientific name rather than assumed to share acoustic tensor order.
* one-window maxima are not safe game decisions: temporal agreement and
  explicit abstention are required before a species can unlock.

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

def test_ordinary_audio_keeps_its_natural_level_instead_of_being_peak_normalised():
    quiet = (np.random.RandomState(0).randn(1000) * 3e-4).astype(np.float32)
    prepared, silent = v3._normalise(quiet)
    assert not silent
    assert np.array_equal(prepared, quiet)
    assert np.max(np.abs(prepared)) < 0.01


def test_near_silence_is_rejected_before_the_fp16_model_can_emit_nan():
    near_silence = (np.random.RandomState(1).randn(1000) * 1e-6).astype(np.float32)
    prepared, silent = v3._normalise(near_silence)
    assert silent
    assert np.array_equal(prepared, near_silence)


def test_digital_silence_is_reported_rather_than_amplified():
    normalised, silent = v3._normalise(np.zeros(1000, dtype=np.float32))
    assert silent
    assert np.max(np.abs(normalised)) == 0.0


def test_an_entirely_silent_listener_window_never_reaches_the_model():
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


def test_a_twelve_second_window_uses_seven_half_overlapping_chunks():
    chunks = v3._chunks(np.ones(v3.SAMPLE_RATE * 12, dtype=np.float32))
    assert [chunk.size for chunk in chunks] == [v3.CHUNK_SAMPLES] * 7


def test_a_tail_too_short_to_identify_is_dropped_not_padded():
    # With 50% overlap, the final useful view starts at 10.5 s and is 1.7 s.
    chunks = v3._chunks(np.ones(int(v3.SAMPLE_RATE * 12.2), dtype=np.float32))
    assert [chunk.size for chunk in chunks] == [v3.CHUNK_SAMPLES] * 7 + [
        int(v3.SAMPLE_RATE * 1.7)
    ]


def test_an_odd_tail_worth_keeping_survives_at_its_own_length():
    chunks = v3._chunks(np.ones(int(v3.SAMPLE_RATE * 13.5), dtype=np.float32))
    assert [chunk.size for chunk in chunks] == [v3.CHUNK_SAMPLES] * 8


def test_overlap_can_be_disabled_for_offline_throughput(monkeypatch):
    monkeypatch.setenv("BURBZ_BIRDNET_V3_OVERLAP", "0")
    chunks = v3._chunks(np.ones(v3.SAMPLE_RATE * 12, dtype=np.float32))
    assert [chunk.size for chunk in chunks] == [v3.CHUNK_SAMPLES] * 4


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


def test_quiet_timeline_positions_are_zero_scored_not_deleted(monkeypatch):
    monkeypatch.setenv("BURBZ_BIRDNET_V3_OVERLAP", "0")
    monkeypatch.setattr(v3, "_input_name", "input")
    samples = np.zeros(v3.SAMPLE_RATE * 9, dtype=np.float32)
    samples[v3.CHUNK_SAMPLES:2 * v3.CHUNK_SAMPLES] = 0.02
    chunks = v3._chunks(samples)
    assert len(chunks) == 3
    assert not np.any(chunks[0])
    assert np.any(chunks[1])
    assert not np.any(chunks[2])

    calls = []

    class Session:
        def run(self, outputs, feed):
            calls.append(feed["input"].shape)
            return [np.array([[0.75]], dtype=np.float32)]

    scores = v3._infer(Session(), chunks)
    assert calls == [(1, v3.CHUNK_SAMPLES)]
    assert scores[:, 0].tolist() == pytest.approx([0.0, 0.75, 0.0])
    decisions, *_ = v3._temporal_decision_scores(scores)
    assert decisions[0] == 0.0


# ---------------------------------------------------------- temporal policy

def test_one_window_spike_is_rejected_but_two_real_birds_with_support_survive(monkeypatch):
    labels = _labels(
        ("Turdus viscivorus", "Mistle Thrush", "Aves"),
        ("Parus major", "Great Tit", "Aves"),
        ("Fringilla coelebs", "Common Chaffinch", "Aves"),
    )
    _install(monkeypatch, labels, [
        [0.89, 0.62, 0.58],
        [0.02, 0.67, 0.61],
        [0.01, 0.71, 0.65],
    ])

    out = v3.analyse("/tmp/garden-mix.wav")
    assert [item["scientific_name"] for item in out] == [
        "Parus major", "Fringilla coelebs",
    ]
    assert all(item["n"] >= 2 for item in out)


def test_even_a_high_single_spike_needs_support_unless_it_is_near_certain(monkeypatch):
    labels = _labels(("Parus major", "Great Tit", "Aves"))
    _install(monkeypatch, labels, [[0.92], [0.02], [0.01]])
    assert v3.analyse("/tmp/spike.wav") == []

    _install(monkeypatch, labels, [[0.99], [0.02], [0.01]])
    assert v3.analyse("/tmp/spike.wav")[0]["scientific_name"] == "Parus major"


def test_a_genuinely_short_clip_needs_the_near_certain_floor(monkeypatch):
    labels = _labels(("Parus major", "Great Tit", "Aves"))
    _install(monkeypatch, labels, [[0.979]])
    assert v3.analyse("/tmp/short.wav") == []

    _install(monkeypatch, labels, [[0.981]])
    assert v3.analyse("/tmp/short.wav")[0]["scientific_name"] == "Parus major"


def test_reviewed_mistle_thrush_requires_two_high_raw_windows(monkeypatch):
    labels = _labels(("Turdus viscivorus", "Mistle Thrush", "Aves"))
    _install(monkeypatch, labels, [[0.86], [0.86], [0.86]])
    assert v3.analyse("/tmp/blackbird-like.wav") == []

    # A real call can have silence between overlapping high windows; its pooled
    # score need not itself reach 0.90.
    _install(monkeypatch, labels, [[0.95], [0.01], [0.95]])
    out = v3.analyse("/tmp/clear-mistle.wav")
    assert out and out[0]["scientific_name"] == "Turdus viscivorus"


def test_single_window_mistle_needs_the_near_certain_exception(monkeypatch):
    labels = _labels(("Turdus viscivorus", "Mistle Thrush", "Aves"))
    _install(monkeypatch, labels, [[0.95]])
    assert v3.analyse("/tmp/ambiguous-short.wav") == []

    _install(monkeypatch, labels, [[0.99]])
    assert v3.analyse("/tmp/clear-short.wav")[0]["scientific_name"] == "Turdus viscivorus"


@pytest.mark.parametrize(
    "scores",
    [
        [0.9486, 0.0097, 0.9507, 0.9534, 0.0811, 0.9214, 0.8266],
        [0.6158, 0.9402, 0.8531, 0.0095, 0.0035, 0.9431],
    ],
)
def test_calibrated_mistle_gate_keeps_ground_truth_recordings(monkeypatch, scores):
    # Raw real-model windows from two public ground-truth Mistle Thrush
    # recordings. Their best pooled scores are below 0.90, but each has the two
    # high raw windows that distinguish them from the reviewed blackbird
    # confuser.
    labels = _labels(("Turdus viscivorus", "Mistle Thrush", "Aves"))
    _install(monkeypatch, labels, [[score] for score in scores])
    monkeypatch.setenv("BURBZ_BIRDNET_V3_NO_GEO_MIN_CONFIDENCE", "0.35")
    assert v3.analyse("/tmp/ground-truth-mistle.wav")


def test_exact_blackbird_mistle_score_shape_fails_high_window_gate(monkeypatch):
    labels = _labels(("Turdus viscivorus", "Mistle Thrush", "Aves"))
    scores = [0.0499, 0.6877, 0.0499, 0.6880, 0.0499, 0.6879, 0.0499]
    _install(monkeypatch, labels, [[score] for score in scores])
    # With a UK geomodel the ordinary pooled .35 rule accepts this shape. The
    # reviewed species gate must be the thing that rejects it.
    monkeypatch.setenv("BURBZ_BIRDNET_V3_NO_GEO_MIN_CONFIDENCE", "0.35")
    assert v3.analyse("/tmp/known-blackbird-confuser.wav") == []


def test_temporal_pooling_is_log_mean_exp_not_a_maximum():
    pooled = v3._log_mean_exp(np.array([[0.9], [0.3]], dtype=np.float32), 5.0)
    expected = np.log((np.exp(5 * 0.9) + np.exp(5 * 0.3)) / 2) / 5
    assert pooled[0] == pytest.approx(expected)
    assert 0.3 < pooled[0] < 0.9


def test_exact_birdnet_live_score_blacklist_is_applied_after_pooling(monkeypatch):
    labels = _labels(
        ("Phasianus colchicus", "Common Pheasant", "Aves"),
        ("Strix aluco", "Tawny Owl", "Aves"),
        ("Turdus viscivorus", "Mistle Thrush", "Aves"),
    )
    _install(monkeypatch, labels, [[0.99, 0.90, 0.95], [0.99, 0.90, 0.95]])

    out = {
        item["scientific_name"]: item
        for item in v3.analyse("/tmp/blacklist.wav")
    }
    assert "Phasianus colchicus" not in out  # 0.99 * 0.10 is below 0.35
    assert out["Strix aluco"]["max"] == pytest.approx(0.90 * 0.75)
    assert out["Turdus viscivorus"]["max"] == pytest.approx(0.95)


def test_score_blacklist_matches_the_pinned_live_map_and_leaves_mistle_at_one(monkeypatch):
    labels = _labels(
        ("Upupa epops", "Eurasian Hoopoe", "Aves"),
        ("Corvus corax", "Northern Raven", "Aves"),
        ("Turdus viscivorus", "Mistle Thrush", "Aves"),
    )
    monkeypatch.setattr(v3, "_labels", labels)
    assert v3._score_multipliers(3).tolist() == pytest.approx([0.50, 0.75, 1.0])
    assert len(v3.SCORE_MULTIPLIERS_BY_COMMON_NAME) == 17


# ---------------------------------------------------------------- filtering

def test_results_match_the_shape_server_py_already_consumes(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9, 0.6], [0.7, 0.6]])

    out = v3.analyse("/tmp/clip.wav")
    assert [item["scientific_name"] for item in out] == ["Passer domesticus", "Turdus merula"]
    for item in out:
        assert set(item) == {"common_name", "scientific_name", "max", "mean", "n", "is_local"}
        assert 0.0 <= item["max"] <= 1.0
    sparrow = out[0]
    assert sparrow["n"] == 2                # over threshold in both chunks
    assert 0.7 < sparrow["max"] < 0.9      # conservative pooled decision score


def test_scores_are_used_as_probabilities_without_a_second_sigmoid(monkeypatch):
    """V3 output is already activated — applying sigmoid again would break it."""
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"))
    _install(monkeypatch, labels, [[0.9], [0.9]])
    assert v3.analyse("/tmp/clip.wav")[0]["max"] == pytest.approx(0.9)


def test_non_birds_are_kept_out_of_a_bird_game_by_default(monkeypatch):
    labels = _labels(("Acheta domesticus", "House cricket", "Insecta"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.99, 0.80], [0.99, 0.80]])

    assert [i["scientific_name"] for i in v3.analyse("/tmp/c.wav")] == ["Turdus merula"]


def test_non_birds_can_be_let_back_in(monkeypatch):
    labels = _labels(("Acheta domesticus", "House cricket", "Insecta"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.99, 0.80], [0.99, 0.80]])
    monkeypatch.setenv("BURBZ_BIRDNET_V3_BIRDS_ONLY", "0")

    assert [i["scientific_name"] for i in v3.analyse("/tmp/c.wav")][0] == "Acheta domesticus"


def test_the_threshold_is_configurable_and_filters_weak_detections(monkeypatch):
    labels = _labels(("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.4], [0.4]])
    monkeypatch.setenv("BURBZ_BIRDNET_V3_NO_GEO_MIN_CONFIDENCE", "0.35")

    assert len(v3.analyse("/tmp/c.wav")) == 1        # 0.4 clears the 0.35 default
    monkeypatch.setenv("BURBZ_BIRDNET_V3_MIN_CONFIDENCE", "0.5")
    assert v3.analyse("/tmp/c.wav") == []


def test_missing_geo_uses_a_stricter_precision_floor(monkeypatch):
    labels = _labels(("Turdus migratorius", "American Robin", "Aves"))
    _install(monkeypatch, labels, [[0.55], [0.55]], geo=None)
    assert v3.analyse("/tmp/c.wav") == []

    class PresentGeo:
        def run(self, outputs, feed):
            return [np.array([[0.9]], dtype=np.float32)]

    _install(monkeypatch, labels, [[0.55], [0.55]], geo=PresentGeo())
    monkeypatch.setattr(v3, "_geo_index", {"turdus migratorius": 0})
    assert v3.analyse("/tmp/c.wav", lat=53.228, lon=-2.598)


def test_nan_scores_are_never_served_to_a_player(monkeypatch):
    labels = _labels(("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[float("nan")]])
    assert v3.analyse("/tmp/c.wav") == []


@pytest.mark.parametrize("bad", [float("nan"), float("inf"), float("-inf")])
def test_every_nonfinite_model_score_is_zeroed_never_promoted(monkeypatch, bad):
    labels = _labels(("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[bad]])
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
    _install(monkeypatch, labels, [[0.9], [0.9]])

    out = v3.analyse("/tmp/c.wav", common_name_for=lambda sci: "Common Blackbird")
    assert out[0]["common_name"] == "Common Blackbird"


def test_the_models_common_name_is_used_when_the_catalogue_has_none(monkeypatch):
    labels = _labels(("Turdus merula", "Eurasian Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9], [0.9]])

    out = v3.analyse("/tmp/c.wav", common_name_for=lambda sci: None)
    assert out[0]["common_name"] == "Eurasian Blackbird"


def test_a_broken_resolver_does_not_fail_the_scan(monkeypatch):
    labels = _labels(("Turdus merula", "Eurasian Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9], [0.9]])

    def explode(scientific):
        raise KeyError("catalogue offline")

    assert v3.analyse("/tmp/c.wav", common_name_for=explode)[0]["common_name"] == "Eurasian Blackbird"


# ------------------------------------------------------------------locality

def test_the_allowlist_marks_locality_but_cannot_outrank_stronger_evidence(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Turdus merula", "Common Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.8, 0.9], [0.8, 0.9]])

    out = v3.analyse("/tmp/c.wav", allow={"passer domesticus"})
    assert {i["scientific_name"]: i["is_local"] for i in out} == {
        "Passer domesticus": True, "Turdus merula": False,
    }
    assert out[0]["scientific_name"] == "Turdus merula"


def test_the_allowlist_also_matches_the_models_own_common_name(monkeypatch):
    labels = _labels(("Turdus merula", "Eurasian Blackbird", "Aves"))
    _install(monkeypatch, labels, [[0.9], [0.9]])
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
    _install(monkeypatch, labels, [[0.8, 0.95], [0.8, 0.95]], geo=_Geo())
    _install_geo(monkeypatch)

    # The cockatoo scores higher, but not in London.
    out = v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13, week=29)
    assert [i["scientific_name"] for i in out] == ["Passer domesticus"]


def test_geo_threshold_matches_birdnet_live_003_boundary(monkeypatch):
    class BoundaryGeo:
        def run(self, outputs, feed):
            return [np.array([[0.03, 0.0299]], dtype=np.float32)]

    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Cacatua galerita", "Sulphur-crested Cockatoo", "Aves"))
    _install(
        monkeypatch,
        labels,
        [[0.8, 0.95], [0.8, 0.95]],
        geo=BoundaryGeo(),
    )
    _install_geo(monkeypatch)

    out = v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13, week=29)
    assert [i["scientific_name"] for i in out] == ["Passer domesticus"]


@pytest.mark.parametrize("lat,lon", [(91, 0), (-91, 0), (0, 181), (float("nan"), 0)])
def test_invalid_coordinates_fail_open_without_calling_the_geomodel(monkeypatch, lat, lon):
    class MustNotRun:
        def run(self, outputs, feed):
            raise AssertionError("invalid coordinates reached geomodel")

    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"))
    _install(monkeypatch, labels, [[0.8], [0.8]], geo=MustNotRun())
    _install_geo(monkeypatch)
    assert v3.analyse("/tmp/c.wav", lat=lat, lon=lon)


def test_without_a_location_nothing_is_range_filtered(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Cacatua galerita", "Sulphur-crested Cockatoo", "Aves"))
    _install(monkeypatch, labels, [[0.8, 0.95], [0.8, 0.95]], geo=_Geo())
    _install_geo(monkeypatch)

    assert len(v3.analyse("/tmp/c.wav")) == 2


def test_the_range_filter_can_be_switched_off(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Cacatua galerita", "Sulphur-crested Cockatoo", "Aves"))
    _install(monkeypatch, labels, [[0.8, 0.95], [0.8, 0.95]], geo=_Geo())
    _install_geo(monkeypatch)
    monkeypatch.setenv("BURBZ_BIRDNET_V3_GEO", "0")

    assert len(v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13)) == 2


def test_a_species_the_geomodel_does_not_know_is_kept(monkeypatch):
    """An unknown range is not absence once acoustic evidence clears 0.60."""
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"),
                     ("Gallus gallus", "Red Junglefowl", "Aves"))
    _install(monkeypatch, labels, [[0.65, 0.65], [0.65, 0.65]], geo=_Geo())
    _install_geo(monkeypatch)  # junglefowl is absent from the geomodel index

    assert "Gallus gallus" in [i["scientific_name"] for i in v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13)]


def test_an_unmapped_geo_class_uses_the_no_geo_floor_not_the_mapped_floor(monkeypatch):
    labels = _labels(
        ("Passer domesticus", "House Sparrow", "Aves"),
        ("Gallus gallus", "Red Junglefowl", "Aves"),
    )
    _install(monkeypatch, labels, [[0.55, 0.55], [0.55, 0.55]], geo=_Geo())
    _install_geo(monkeypatch)

    out = v3.analyse("/tmp/c.wav", lat=51.5, lon=-0.13, week=29)
    assert [item["scientific_name"] for item in out] == ["Passer domesticus"]


def test_a_missing_range_filter_does_not_stop_identification(monkeypatch):
    labels = _labels(("Passer domesticus", "House Sparrow", "Aves"))
    _install(monkeypatch, labels, [[0.9], [0.9]], geo=None)
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


def test_cryptic_honeyeater_genus_alias_uses_geo_coverage_for_both_labels(monkeypatch):
    monkeypatch.setattr(
        v3,
        "_labels",
        _labels(
            ("Microptilotis imitatrix", "Cryptic Honeyeater", "Aves"),
            ("Meliphaga imitatrix", "Cryptic Honeyeater", "Aves"),
        ),
    )
    monkeypatch.setattr(v3, "_geo_index", {"meliphaga imitatrix": 0})
    monkeypatch.setattr(
        v3,
        "_geo_probabilities",
        lambda lat, lon, week: np.asarray([0.9], dtype=np.float32),
    )

    eligible, covered = v3._range_masks(-20.2, 145.8, 29, 2)
    assert eligible.tolist() == [True, True]
    assert covered.tolist() == [True, True]


def test_cryptic_honeyeater_historical_model_labels_are_one_taxon(monkeypatch):
    labels = _labels(
        ("Microptilotis imitatrix", "Cryptic Honeyeater", "Aves"),
        ("Meliphaga imitatrix", "Cryptic Honeyeater", "Aves"),
    )
    _install(monkeypatch, labels, [[0.82, 0.88], [0.82, 0.88]], geo=None)

    out = v3.analyse(
        "/tmp/cryptic.wav",
        common_name_for=lambda scientific: (
            "Cryptic Honeyeater"
            if scientific == "Microptilotis imitatrix"
            else None
        ),
    )

    assert len(out) == 1
    assert out[0]["scientific_name"] == "Microptilotis imitatrix"
    assert out[0]["common_name"] == "Cryptic Honeyeater"
    assert out[0]["max"] == pytest.approx(
        v3._temporal_decision_scores(np.asarray([[0.88], [0.88]]))[0][0]
    )


def test_taxonomy_dedupe_happens_before_ranking_and_max_results(monkeypatch):
    labels = _labels(
        ("Microptilotis imitatrix", "Cryptic Honeyeater", "Aves"),
        ("Meliphaga imitatrix", "Cryptic Honeyeater", "Aves"),
        ("Parus major", "Great Tit", "Aves"),
        ("Fringilla coelebs", "Common Chaffinch", "Aves"),
    )
    _install(
        monkeypatch,
        labels,
        [[0.88, 0.94, 0.90, 0.86], [0.88, 0.94, 0.90, 0.86]],
        geo=None,
    )
    monkeypatch.setenv("BURBZ_BIRDNET_V3_MAX_RESULTS", "2")

    out = v3.analyse("/tmp/cryptic-and-two-others.wav")

    assert [item["scientific_name"] for item in out] == [
        "Microptilotis imitatrix",
        "Parus major",
    ]
    assert out[0]["max"] == pytest.approx(
        v3._temporal_decision_scores(np.asarray([[0.94], [0.94]]))[0][0]
    )


def test_model_meta_pins_the_exact_official_score_blacklist_hash(
    monkeypatch, tmp_path
):
    weights = tmp_path / v3.ONNX_FILENAME
    labels = tmp_path / v3.LABELS_FILENAME
    weights.write_bytes(b"pinned-acoustic-model")
    labels.write_text(
        LABEL_HEADER
        + "0;1;Parus major;Great Tit;Aves;Passeriformes\n"
        + "1;2;Fringilla coelebs;Common Chaffinch;Aves;Passeriformes\n"
        + "2;3;Turdus viscivorus;Mistle Thrush;Aves;Passeriformes\n"
        + "3;4;Strix aluco;Tawny Owl;Aves;Strigiformes\n",
        encoding="utf-8",
    )

    class Input:
        name = "input"
        type = "tensor(float)"

    class Output:
        name = "predictions"
        shape = [None, 4]

    class Session:
        def get_inputs(self):
            return [Input()]

        def get_outputs(self):
            return [Output()]

    monkeypatch.setattr(v3, "_session", None)
    monkeypatch.setattr(v3, "_labels", None)
    monkeypatch.setattr(v3, "_bird_mask", None)
    monkeypatch.setattr(v3, "_input_name", None)
    monkeypatch.setattr(v3, "_model_meta", {})
    monkeypatch.setattr(
        v3,
        "_resolve_asset",
        lambda env_name, filename, url: (
            str(labels) if "LABELS" in env_name else str(weights)
        ),
    )
    monkeypatch.setattr(v3, "_make_session", lambda path: Session())
    monkeypatch.setattr(
        v3,
        "_verify_asset",
        lambda path, expected, description: expected,
    )

    v3.load(force=True)
    expected = "a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366"
    assert v3.SCORE_BLACKLIST_SHA256 == expected
    assert v3.model_meta()["scoreBlacklistSha256"] == expected


def test_geo_model_meta_exposes_the_actual_verified_hashes(monkeypatch, tmp_path):
    weights = tmp_path / v3.GEO_ONNX_FILENAME
    labels = tmp_path / v3.GEO_LABELS_FILENAME
    weights.write_bytes(b"pinned-geo-model")
    labels.write_text(
        "1\tPasser domesticus\tHouse Sparrow\n"
        "2\tCacatua galerita\tSulphur-crested Cockatoo\n",
        encoding="utf-8",
    )

    class Output:
        name = "probabilities"
        shape = [None, 2]

    class Session:
        def get_outputs(self):
            return [Output()]

    monkeypatch.setattr(v3, "_geo_session", None)
    monkeypatch.setattr(v3, "_geo_index", None)
    monkeypatch.setattr(v3, "_geo_output_size", None)
    monkeypatch.setattr(v3, "_geo_model_meta", {})
    monkeypatch.setattr(
        v3,
        "_resolve_asset",
        lambda env_name, filename, url: str(labels)
        if "LABELS" in env_name
        else str(weights),
    )
    monkeypatch.setattr(v3, "_make_session", lambda path: Session())
    monkeypatch.setattr(
        v3,
        "_verify_asset",
        lambda path, expected, description: (
            v3.GEO_LABELS_SHA256
            if "labels" in description.lower()
            else v3.GEO_ONNX_SHA256
        ),
    )

    assert v3._load_geo() is not None
    meta = v3.geo_model_meta()
    assert meta["modelSha256"] == v3.GEO_ONNX_SHA256
    assert meta["labelsSha256"] == v3.GEO_LABELS_SHA256
    assert meta["version"] == "3.0.2"
    assert meta["species"] == 2


# ---------------------------------------------------------------------- week

def test_the_week_is_birdnets_four_per_month_1_to_48():
    assert v3._birdnet_week(22) == 22
    assert v3._birdnet_week(0) == 1        # clamped
    assert v3._birdnet_week(99) == 48      # clamped
    assert 1 <= v3._birdnet_week(None) <= 48   # derived from today


@pytest.mark.parametrize(
    "bad_week",
    ["later", float("nan"), float("inf"), float("-inf")],
)
def test_a_nonsense_or_nonfinite_week_falls_back_to_today_rather_than_raising(bad_week):
    assert v3._birdnet_week(bad_week) == v3._birdnet_week(None)


def test_policy_version_tracks_the_single_window_and_geo_coverage_hardening():
    assert v3.DECISION_POLICY_VERSION == "burbz-v3-temporal-20260729.2"


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


def _listener_shaped_audio(mono, rate, seconds=12.0, gap_seconds=0.8):
    gap = np.zeros(int(rate * gap_seconds), dtype=np.float32)
    blocks = []
    target = int(rate * seconds)
    while sum(block.size for block in blocks) < target:
        blocks.extend((mono, gap))
    return np.concatenate(blocks)[:target]


@needs_weights
def test_the_real_model_identifies_a_real_tawny_owl_listener_window(tmp_path):
    soundfile = pytest.importorskip("soundfile")
    source = ROOT / "assets" / "audio" / "bird-tawny-owl.ogg"
    if not source.exists():
        pytest.skip("reference recording not deployed")

    data, rate = soundfile.read(str(source), dtype="float32", always_2d=True)
    wav = tmp_path / "owl-listener-window.wav"
    repeated = _listener_shaped_audio(data.mean(axis=1), rate)
    soundfile.write(str(wav), repeated, rate, subtype="PCM_16")

    out = v3.analyse(str(wav))
    assert out and out[0]["scientific_name"] == "Strix aluco"
    assert out[0]["max"] > 0.5


@needs_weights
def test_the_real_known_blackbird_never_unlocks_as_mistle_thrush(tmp_path):
    """Ground-truth confuser regression: correct or abstain, never the known FP."""
    soundfile = pytest.importorskip("soundfile")
    source = ROOT / "assets" / "audio" / "bird-blackbird.ogg"
    if not source.exists():
        pytest.skip("reference recording not deployed")

    data, rate = soundfile.read(str(source), dtype="float32", always_2d=True)
    wav = tmp_path / "blackbird.wav"
    soundfile.write(str(wav), data.mean(axis=1), rate, subtype="PCM_16")

    out = v3.analyse(str(wav), lat=53.228, lon=-2.598, week=29)
    names = [item["scientific_name"] for item in out]
    assert "Turdus viscivorus" not in names
    assert not names or names[0] == "Turdus merula"


@needs_weights
def test_repeated_real_blackbird_confuser_abstains_in_a_twelve_second_window(tmp_path):
    soundfile = pytest.importorskip("soundfile")
    source = ROOT / "assets" / "audio" / "bird-blackbird.ogg"
    if not source.exists():
        pytest.skip("reference recording not deployed")

    data, rate = soundfile.read(str(source), dtype="float32", always_2d=True)
    mono = data.mean(axis=1)
    gap = np.zeros(int(rate * 0.8), dtype=np.float32)
    repeated = np.concatenate([mono, gap, mono, gap, mono, gap, mono])
    repeated = np.pad(repeated, (0, max(0, int(rate * 12) - repeated.size)))[:int(rate * 12)]
    wav = tmp_path / "blackbird-12s.wav"
    soundfile.write(str(wav), repeated, rate, subtype="PCM_16")

    out = v3.analyse(str(wav), lat=53.228, lon=-2.598, week=29)
    names = [item["scientific_name"] for item in out]
    assert "Turdus viscivorus" not in names
    assert "Turdus migratorius" not in names
    assert not names or names[0] == "Turdus merula"


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
    wav = tmp_path / "owl-listener-window.wav"
    repeated = _listener_shaped_audio(data.mean(axis=1), rate)
    soundfile.write(str(wav), repeated, rate, subtype="PCM_16")

    london = [i["scientific_name"] for i in v3.analyse(str(wav), lat=51.5, lon=-0.13, week=29)]
    sydney = [i["scientific_name"] for i in v3.analyse(str(wav), lat=-33.87, lon=151.21, week=29)]
    assert "Strix aluco" in london
    assert "Strix aluco" not in sydney
