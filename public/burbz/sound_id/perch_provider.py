"""Perch 2.0 bird-sound recognition via ONNX Runtime.

Perch 2.0 is Google's bioacoustics model: ~14,795 classes (birds plus frogs,
insects and mammals), an EfficientNet-B3 backbone at ~12M parameters, and —
the reason it is here — Apache 2.0 licensed *including the weights*, so it can
ship in a commercial build. See ../LICENSING.md.

Google's own model card pins its SavedModel to TensorFlow 2.20.rc0 and a GPU.
That is a packaging constraint, not a property of the model. This module uses
the ONNX export instead, so the VPS needs neither TensorFlow nor a GPU:

    pip install onnxruntime numpy huggingface_hub

Checkpoints are the ones the Kitzes Lab bioacoustics-model-zoo (MIT) uses:

    weights  justinchuby/Perch-onnx        perch_v2_no_dft.onnx
    labels   sammlapp/Perch_v2_headless    labels.csv

Both are downloaded once and cached by huggingface_hub, or pointed at local
files with BURBZ_PERCH_ONNX_PATH / BURBZ_PERCH_LABELS_PATH for an air-gapped
deploy.

Perch predicts scientific binomials only ("Passer domesticus"), where BirdNET
returned a common name too. The ``common_name_for`` resolver supplied by
server.py maps binomial to the Burbz catalogue name; without it the scientific
name is used for both, which ``_catalog_lookup`` still resolves.
"""

from __future__ import annotations

import csv
import logging
import os
import threading
from typing import Callable, Iterable, List, Optional, Sequence

from . import _audio

logger = logging.getLogger(__name__)

SAMPLE_RATE = 32000
WINDOW_SECONDS = 5.0
WINDOW_SAMPLES = int(SAMPLE_RATE * WINDOW_SECONDS)
PEAK_LEVEL = 0.25  # matches the model zoo's Audio.normalize(peak_level=0.25)

ONNX_REPO = "justinchuby/Perch-onnx"
ONNX_FILE = "perch_v2_no_dft.onnx"  # DFT flattened — widest ONNX Runtime support
LABELS_REPO = "sammlapp/Perch_v2_headless"
LABELS_FILE = "labels.csv"

# Perch is a multi-label classifier over ~15k classes; scores are sigmoid over
# logits. This threshold is the first thing to tune against real Burbz
# recordings — see README.md. BirdNET's equivalent default was much lower
# because its score scale differs; do not copy one across to the other.
DEFAULT_MIN_CONFIDENCE = 0.5
DEFAULT_MAX_RESULTS = 8

_session = None
_labels: Optional[List[str]] = None
_input_name: Optional[str] = None
_output_name: Optional[str] = None
_load_lock = threading.Lock()


class PerchUnavailable(RuntimeError):
    """Raised when Perch cannot be loaded; the caller falls back to BirdNET."""


def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ[name])
    except (KeyError, TypeError, ValueError):
        return default


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, TypeError, ValueError):
        return default


# --------------------------------------------------------------------------
# Model loading
# --------------------------------------------------------------------------

def _resolve_asset(env_var: str, repo: str, filename: str) -> str:
    local = (os.environ.get(env_var) or "").strip()
    if local:
        if not os.path.exists(local):
            raise PerchUnavailable(f"{env_var}={local!r} does not exist")
        return local
    try:
        from huggingface_hub import hf_hub_download
    except ImportError as exc:  # pragma: no cover - depends on deploy env
        raise PerchUnavailable(
            "huggingface_hub is not installed and "
            f"{env_var} is unset, so {filename} cannot be located"
        ) from exc
    return hf_hub_download(repo_id=repo, filename=filename)


def _load_labels(path: str) -> List[str]:
    """Read the class list. The file is CRLF with a single header row."""
    with open(path, newline="", encoding="utf-8-sig") as handle:
        rows = [row[0].strip() for row in csv.reader(handle) if row and row[0].strip()]
    if not rows:
        raise PerchUnavailable(f"no labels found in {path}")
    # First row is the column header ("inat2024_fsd50k"), not a species.
    return rows[1:]


def load(force: bool = False):
    """Load the ONNX session and labels once, thread-safely."""
    global _session, _labels, _input_name, _output_name
    if _session is not None and not force:
        return _session

    with _load_lock:
        if _session is not None and not force:
            return _session
        try:
            import onnxruntime
        except ImportError as exc:
            raise PerchUnavailable(
                "onnxruntime is not installed — `pip install onnxruntime`"
            ) from exc

        weights = _resolve_asset("BURBZ_PERCH_ONNX_PATH", ONNX_REPO, ONNX_FILE)
        labels_path = _resolve_asset("BURBZ_PERCH_LABELS_PATH", LABELS_REPO, LABELS_FILE)

        options = onnxruntime.SessionOptions()
        threads = _env_int("BURBZ_PERCH_THREADS", 0)
        if threads > 0:
            options.intra_op_num_threads = threads

        session = onnxruntime.InferenceSession(
            weights, sess_options=options, providers=["CPUExecutionProvider"]
        )

        labels = _load_labels(labels_path)
        inputs = session.get_inputs()
        if not inputs:
            raise PerchUnavailable("Perch ONNX model exposes no inputs")

        outputs = session.get_outputs()
        names = [o.name for o in outputs]
        # The classifier logits are published as "label"; fall back to the
        # first non-embedding output if the export is renamed.
        output_name = "label" if "label" in names else None
        if output_name is None:
            candidates = [n for n in names if n != "embedding"]
            if not candidates:
                raise PerchUnavailable(f"no classifier output among {names}")
            output_name = candidates[0]

        _session = session
        _labels = labels
        _input_name = inputs[0].name
        _output_name = output_name
        logger.info(
            "Perch 2.0 loaded: %d classes, input=%r output=%r",
            len(labels), _input_name, _output_name,
        )
        return _session


# --------------------------------------------------------------------------
# Audio
# --------------------------------------------------------------------------

def _read_wav(path: str):
    """Read a WAV to mono float32 in [-1, 1] with its sample rate."""
    try:
        return _audio.read_mono(path)
    except _audio.AudioUnavailable as exc:
        raise PerchUnavailable(str(exc)) from exc


def _resample(samples, source_rate: int, target_rate: int):
    """Resample mono audio, preferring quality implementations when installed."""
    return _audio.resample(samples, source_rate, target_rate)


def _windows(samples, min_tail_seconds: float = 1.0):
    """Split into 5 s windows, zero-padding a tail worth keeping."""
    import numpy as np

    if samples.size == 0:
        return np.zeros((0, WINDOW_SAMPLES), dtype=np.float32)

    hop = max(1, int(WINDOW_SAMPLES * (1.0 - _env_float("BURBZ_PERCH_OVERLAP", 0.0))))
    chunks = []
    for start in range(0, max(samples.size, 1), hop):
        chunk = samples[start:start + WINDOW_SAMPLES]
        if chunk.size < WINDOW_SAMPLES:
            if chunk.size < int(min_tail_seconds * SAMPLE_RATE) and chunks:
                break
            chunk = np.pad(chunk, (0, WINDOW_SAMPLES - chunk.size))
        chunks.append(_normalise(chunk))
        if start + WINDOW_SAMPLES >= samples.size:
            break
    return np.stack(chunks).astype(np.float32) if chunks else np.zeros(
        (0, WINDOW_SAMPLES), dtype=np.float32
    )


def _normalise(chunk):
    """Peak-normalise to PEAK_LEVEL, matching the model zoo's preprocessing."""
    import numpy as np

    peak = float(np.max(np.abs(chunk))) if chunk.size else 0.0
    if peak <= 1e-9:
        return chunk.astype(np.float32)
    return (chunk * (PEAK_LEVEL / peak)).astype(np.float32)


def _sigmoid(values):
    import numpy as np

    return 1.0 / (1.0 + np.exp(-np.clip(values, -60.0, 60.0)))


# --------------------------------------------------------------------------
# Inference
# --------------------------------------------------------------------------

def _infer(session, batch):
    """Run the session, batching but degrading to per-window on shape errors."""
    import numpy as np

    batch_size = max(1, _env_int("BURBZ_PERCH_BATCH", 8))
    scores = []
    for start in range(0, batch.shape[0], batch_size):
        block = batch[start:start + batch_size]
        try:
            out = session.run([_output_name], {_input_name: block})[0]
        except Exception:
            out = np.stack([
                session.run([_output_name], {_input_name: row[None, :]})[0][0]
                for row in block
            ])
        scores.append(np.asarray(out, dtype=np.float32).reshape(block.shape[0], -1))
    if not scores:
        return np.zeros((0, 0), dtype=np.float32)
    return np.concatenate(scores, axis=0)


def analyse(
    audio_path: str,
    *,
    allow: Optional[Iterable[str]] = None,
    lat: Optional[float] = None,   # noqa: ARG001 - Perch has no geographic prior
    lon: Optional[float] = None,   # noqa: ARG001
    week: Optional[int] = None,    # noqa: ARG001
    common_name_for: Optional[Callable[[str], Optional[str]]] = None,
) -> Sequence[dict]:
    """Identify species and aggregate to the BirdNET result shape.

    Perch has no equivalent of BirdNET's location/week prior, so lat/lon/week
    are accepted and ignored here. Locality is still applied downstream through
    the ``allow`` set, exactly as before — which makes that allowlist more
    load-bearing under Perch than it was under BirdNET.
    """
    import numpy as np

    session = load()
    assert _labels is not None

    samples, rate = _read_wav(audio_path)
    samples = _resample(samples, rate, SAMPLE_RATE)
    batch = _windows(samples)
    if batch.shape[0] == 0:
        return []

    scores = _infer(session, batch)
    if scores.size == 0:
        return []
    if scores.shape[1] != len(_labels):
        raise PerchUnavailable(
            f"model returned {scores.shape[1]} classes but {len(_labels)} labels "
            "were loaded — weights and labels.csv are out of step"
        )

    if (os.environ.get("BURBZ_PERCH_RAW_LOGITS") or "").strip().lower() not in {
        "1", "true", "yes", "on"
    }:
        scores = _sigmoid(scores)

    threshold = _env_float("BURBZ_PERCH_MIN_CONFIDENCE", DEFAULT_MIN_CONFIDENCE)
    max_results = _env_int("BURBZ_PERCH_MAX_RESULTS", DEFAULT_MAX_RESULTS)

    peaks = scores.max(axis=0)
    hits = np.nonzero(peaks >= threshold)[0]
    if hits.size == 0:
        return []

    allow_set = {str(name).strip().lower() for name in (allow or ()) if str(name).strip()}

    results = []
    for index in hits:
        scientific = _labels[int(index)]
        column = scores[:, index]
        above = column[column >= threshold]
        common = None
        if common_name_for is not None:
            try:
                common = common_name_for(scientific)
            except Exception:
                logger.exception("common-name lookup failed for %r", scientific)
        common = common or scientific

        is_local = True
        if allow_set:
            is_local = (
                scientific.strip().lower() in allow_set
                or str(common).strip().lower() in allow_set
            )

        results.append({
            "common_name": common,
            "scientific_name": scientific,
            "max": float(column.max()),
            "mean": float(above.mean()) if above.size else float(column.max()),
            "n": int(above.size),
            "is_local": bool(is_local),
        })

    # Local birds first, then confidence — the ordering BirdNET's aggregation
    # produced, so the server's "pick the top candidate" logic is unchanged.
    results.sort(key=lambda item: (item["is_local"], item["max"]), reverse=True)
    return results[:max_results]
