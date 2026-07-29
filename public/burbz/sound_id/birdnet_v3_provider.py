"""BirdNET+ V3.0 bird-sound recognition via ONNX Runtime.

This is the recogniser Burbz ships. It replaces BirdNET V2.4 — which sounds
like a version bump but is the whole commercial story, because the licence
changed with it:

    BirdNET V2.4 weights   CC BY-NC-SA 4.0   NonCommercial — unusable here
    BirdNET+ V3.0 weights  CC BY-SA 4.0      commercial use permitted

See ../LICENSING.md. The ShareAlike term still applies to *adaptations* of the
model, so do not fine-tune these weights or train a classifier head on the
embeddings without accepting CC BY-SA on the result. Plain inference — what
this module does — carries an attribution obligation only, discharged by the
"Powered by BirdNET" credit on audio-credits.html.

V3 is the licence-clean recogniser Burbz must use, but the preview network is
only the first layer of reliable identification. Its class scores are not
calibrated presence probabilities, so this module adds the conservative
decision layers used by the official BirdNET Live app: overlapping windows,
Log-Mean-Exp temporal pooling, two-window support, a 0.35 decision threshold,
the pinned class-score blacklist, and geographic exclusion at 0.03.

The underlying model has these useful properties:

    classes        6,000 -> 11,560 (9,834 birds plus other calling taxa)
    sample rate    48 kHz -> 32 kHz
    input          fixed 3 s -> variable length
    outputs        predictions + a 1,280-d embedding
    range filter   built-in V2.4 filter -> BirdNET Geomodel V3.0.2 (12,012 species)

Install:

    pip install onnxruntime numpy soundfile soxr

``soundfile`` and ``soxr`` are mandatory in production: browser recordings
need reliable decoding and band-limited resampling to match model input.

Weights are not bundled — ``scripts/install-birdnet-v3.sh`` fetches them from
their pinned upstream releases onto the VPS. No TensorFlow, no PyTorch, no GPU.

Important traps, all handled below:

1. **The FP16 weights can return NaN on near-silence.** Such windows bypass
   inference but retain zero-valued positions in the temporal history. Ordinary
   recordings retain their natural level:
   the upstream V3 analyser supplies raw float waveforms, and a real Burbz
   regression proved peak normalisation can strengthen a false Mistle Thrush.

2. **V3 scores are not V2 scores.** They are already sigmoid-activated
   values in [0, 1], so nothing is applied on top, but they are not a statement
   such as "90% chance this bird is present".

3. **The preview has repeatable class confusers.** The published weights rank
   Mistle Thrush above Burbz's attributed Common Blackbird fixture. A reviewed,
   precision-first two-high-window evidence rule makes that known ambiguity
   abstain instead of automatically unlocking the wrong bird.
"""

from __future__ import annotations

import csv
import datetime as _datetime
import hashlib
import json
import logging
import os
import threading
import time
from typing import Callable, Iterable, List, Optional, Sequence, Tuple

from . import _audio

logger = logging.getLogger(__name__)

SAMPLE_RATE = 32000
CHUNK_SECONDS = 3.0
CHUNK_SAMPLES = int(SAMPLE_RATE * CHUNK_SECONDS)

# Below this peak amplitude a window is digital silence — a muted mic, dropped
# buffer, or padding. A separate RMS floor also rejects near-silence that can
# underflow inside the FP16 spectrogram.
SILENCE_FLOOR = 1e-6
DEFAULT_MIN_RMS = 1e-4

# BirdNET+ V3.0 developer preview 3.1 — https://zenodo.org/records/20703646
ONNX_FILENAME = "BirdNET+_V3.0-preview3.1_Global_11K_FP16_pruned.onnx"
LABELS_FILENAME = "BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv"
ZENODO_BASE = "https://zenodo.org/records/20703646/files"
ONNX_SHA256 = "69cfc8db3ebec163feb6329e546eb56e1aadac2a309f1ee99aecfabd1aa9bd24"
LABELS_SHA256 = "8124b0ea2d187104c5e2cd95a0f937165647e20349c8fd34d4d5ef991821f8f0"

# BirdNET Geomodel V3.0.2 — the successor to V2.4's built-in range filter.
GEO_ONNX_FILENAME = "BirdNET+_Geomodel_V3.0.2_Global_12K_FP16.onnx"
GEO_LABELS_FILENAME = "BirdNET+_Geomodel_V3.0.2_Global_12K_Labels.txt"
GEO_BASE = "https://huggingface.co/tphakala/BirdNET-Geomodel/resolve/main"
GEO_ONNX_SHA256 = "2bc5a9b1e7c24115730015a97dbb688e9e8cd49c02c34a011439182c65ef0017"
GEO_LABELS_SHA256 = "c15818db07e55978d909a9bcd916cd0615b0183f789227d9516059151787c784"

# Upstream's own default (analyze.py --min-conf). Tune against real Burbz
# recordings before judging accuracy; a bad threshold looks like a bad model.
DEFAULT_MIN_CONFIDENCE = 0.35
DEFAULT_NO_GEO_MIN_CONFIDENCE = 0.60
DEFAULT_SINGLE_WINDOW_CONFIDENCE = 0.98
DEFAULT_VERY_HIGH_CONFIDENCE = 0.98
DEFAULT_TEMPORAL_ALPHA = 5.0
DEFAULT_TEMPORAL_MAX_WINDOWS = 5
DEFAULT_MIN_SUPPORT_WINDOWS = 2
DEFAULT_SUPPORT_THRESHOLD_FRACTION = 0.60
DEFAULT_SUPPORT_THRESHOLD_FLOOR = 0.25
DEFAULT_OVERLAP = 0.50
DEFAULT_MAX_RESULTS = 8

# A species the geomodel puts below this probability for the player's location
# and week is treated as not present. Deliberately permissive: it is there to
# drop a Sulphur-crested Cockatoo heard in London (0.001), not to second-guess
# a plausible local bird.
DEFAULT_GEO_THRESHOLD = 0.03

# Reviewed precision override: the exact shipped V3 weights repeatedly rank
# Mistle Thrush above Burbz's attributed Common Blackbird reference recording.
# Ground-truth Mistle recordings show that thresholding the pooled score at
# 0.90 rejects real positives; the discriminating evidence shape is at least
# two raw windows >= 0.90 in the same rolling history. A single window needs
# the normal near-certain 0.98 exception.
DEFAULT_MISTLE_THRUSH_MIN_CONFIDENCE = 0.90
DEFAULT_MISTLE_THRUSH_MIN_HIGH_WINDOWS = 2

# Exact score blacklist bundled by BirdNET Live for preview3.1. Multipliers
# reduce repeatable over-confident classes after temporal pooling; support is
# still measured from the unmodified raw per-window scores.
SCORE_MULTIPLIERS_BY_COMMON_NAME = {
    "Common Hoopoe": 0.50,
    "Eurasian Golden Oriole": 0.50,
    "Great Cormorant": 0.50,
    "Mute Swan": 0.50,
    "Red Fox": 0.50,
    "Little Bittern": 0.50,
    "Eurasian Bittern": 0.50,
    "Eurasian Eagle-Owl": 0.80,
    "Long-eared Owl": 0.80,
    "Red Crossbill": 0.80,
    "Northern Raven": 0.75,
    "Common Moorhen": 0.66,
    "Common Pheasant": 0.10,
    "Rock Dove": 0.66,
    "Tawny Owl": 0.75,
    "Barred Owl": 0.85,
    "Great Horned Owl": 0.85,
}
SCORE_BLACKLIST_SHA256 = "a7237606eca3e0a215d0a11c01c2a7654348916609dffc830ec9fc96e0c81366"
# A scientific-name alias keeps the multiplier stable if a future label file
# changes the English Hoopoe name.
SCORE_MULTIPLIER_SCIENTIFIC_ALIASES = {"Upupa epops": 0.50}

# The broad 11K acoustic labels contain both names for this one taxon, while
# Geo3.0.2 and Burbz's catalogue each use one side of the genus move. Map geo
# lookup to its label and API output to the catalogue name, then deduplicate.
GEO_SCIENTIFIC_ALIASES = {
    "microptilotis imitatrix": "meliphaga imitatrix",
}
CANONICAL_SCIENTIFIC_ALIASES = {
    "meliphaga imitatrix": "Microptilotis imitatrix",
}

MODEL_NAME = "BirdNET+ V3.0-preview3.1 Global 11K FP16 pruned"
GEO_MODEL_NAME = "BirdNET+ Geomodel V3.0.2 Global 12K FP16"
DECISION_POLICY_VERSION = "burbz-v3-temporal-20260729.2"

_MODEL_DIR_CANDIDATES = (
    "/opt/burbz/models",
    "/var/lib/burbz/models",
    os.path.join(os.path.expanduser("~"), ".cache", "burbz", "models"),
)

_session = None
_labels: Optional[List[dict]] = None
_bird_mask = None
_input_name: Optional[str] = None
_model_meta: dict = {}
_load_lock = threading.Lock()

_geo_session = None
_geo_index: Optional[dict] = None
_geo_output_size: Optional[int] = None
_geo_model_meta: dict = {}
_geo_load_lock = threading.Lock()
_geo_cache: dict = {}
_GEO_CACHE_LIMIT = 256


class BirdNETV3Unavailable(RuntimeError):
    """Raised when V3 cannot be loaded or run."""


# --------------------------------------------------------------------------
# Environment helpers
# --------------------------------------------------------------------------

def _env_float(name: str, default: float) -> float:
    try:
        return float(os.environ[name])
    except (KeyError, TypeError, ValueError):
        return default


def _env_bounded_float(name: str, default: float, low: float, high: float) -> float:
    value = _env_float(name, default)
    if not low <= value <= high:
        logger.warning("%s=%r is outside [%s, %s]; using %s", name, value, low, high, default)
        return default
    return value


def _env_int(name: str, default: int) -> int:
    try:
        return int(os.environ[name])
    except (KeyError, TypeError, ValueError):
        return default


def _env_flag(name: str, default: bool) -> bool:
    raw = (os.environ.get(name) or "").strip().lower()
    if not raw:
        return default
    return raw not in {"0", "false", "no", "off"}


def _sha256(path: str) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _verify_asset(path: str, expected: str, description: str) -> str:
    """Verify the exact model/label asset and return its digest.

    A same-length but differently ordered label file produces plausible-looking
    wrong bird names, so production verifies assets again at model load rather
    than trusting that an installer ran at some point in the past.
    """
    actual = _sha256(path)
    if _env_flag("BURBZ_BIRDNET_V3_VERIFY_HASHES", True) and actual != expected:
        raise BirdNETV3Unavailable(
            f"{description} checksum mismatch for {path}: expected {expected}, got {actual}"
        )
    return actual


def _search_dirs() -> List[str]:
    explicit = (os.environ.get("BURBZ_BIRDNET_V3_MODEL_DIR") or "").strip()
    if explicit:
        # An explicit directory is authoritative. Falling back to some other
        # installed copy would hide a broken deployment and defeat fail-closed
        # locality checks.
        return [explicit]
    dirs = []
    # Alongside the deployed Burbz tree, i.e. <webroot>/burbz/models.
    dirs.append(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "models"))
    dirs.extend(_MODEL_DIR_CANDIDATES)
    return dirs


def _resolve_asset(env_var: str, filename: str, url: str) -> str:
    """Find a model file on disk, or fetch it if auto-download is enabled."""
    local = (os.environ.get(env_var) or "").strip()
    if local:
        if not os.path.exists(local):
            raise BirdNETV3Unavailable(f"{env_var}={local!r} does not exist")
        return local

    for directory in _search_dirs():
        candidate = os.path.join(directory, filename)
        if os.path.exists(candidate):
            return candidate

    if not _env_flag("BURBZ_BIRDNET_V3_AUTO_DOWNLOAD", False):
        raise BirdNETV3Unavailable(
            f"{filename} was not found in any of {_search_dirs()}. Run "
            "scripts/install-birdnet-v3.sh on the server to fetch the models, "
            f"or set {env_var} to their location. (Set "
            "BURBZ_BIRDNET_V3_AUTO_DOWNLOAD=1 to download on first use instead "
            "— not recommended in production, since the first scan then waits "
            "on a ~70 MB download.)"
        )

    target_dir = _search_dirs()[0]
    os.makedirs(target_dir, exist_ok=True)
    target = os.path.join(target_dir, filename)
    logger.warning("Downloading %s -> %s (first-use download)", url, target)
    _download(url, target)
    return target


def _download(url: str, target: str) -> None:
    import shutil
    import urllib.request

    partial = target + ".partial"
    try:
        with urllib.request.urlopen(url, timeout=600) as response, open(partial, "wb") as handle:
            shutil.copyfileobj(response, handle)
        os.replace(partial, target)
    except Exception as exc:
        if os.path.exists(partial):
            os.unlink(partial)
        raise BirdNETV3Unavailable(f"could not download {url}: {exc}") from exc


# --------------------------------------------------------------------------
# Labels
# --------------------------------------------------------------------------

def _load_labels(path: str) -> List[dict]:
    """Read the V3 label table.

    Semicolon-delimited, UTF-8 with a BOM, one header row:

        idx;id;sci_name;com_name;class;order
        0;3;Abeillia abeillei;Emerald-chinned Hummingbird;Aves;Apodiformes

    Row order is the model's class order; ``idx`` restates it and is checked,
    because silently mislabelling every bird is worse than refusing to start.
    """
    with open(path, newline="", encoding="utf-8-sig") as handle:
        rows = list(csv.DictReader(handle, delimiter=";"))

    if not rows:
        raise BirdNETV3Unavailable(f"no labels found in {path}")

    required = {"idx", "sci_name", "com_name", "class"}
    missing = required - set(rows[0] or {})
    if missing:
        raise BirdNETV3Unavailable(
            f"{path} is missing the {sorted(missing)} column(s) — this does not "
            "look like a BirdNET V3 label file"
        )

    labels = []
    for position, row in enumerate(rows):
        try:
            declared = int(row["idx"])
        except (TypeError, ValueError, OverflowError):
            raise BirdNETV3Unavailable(f"{path} row {position} has a non-numeric idx")
        if declared != position:
            raise BirdNETV3Unavailable(
                f"{path} is not in class order (row {position} declares idx {declared})"
            )
        labels.append({
            "scientific_name": (row.get("sci_name") or "").strip(),
            "common_name": (row.get("com_name") or "").strip(),
            "class": (row.get("class") or "").strip(),
        })
    return labels


# --------------------------------------------------------------------------
# Model loading
# --------------------------------------------------------------------------

def _make_session(path: str):
    try:
        import onnxruntime
    except ImportError as exc:
        raise BirdNETV3Unavailable(
            "onnxruntime is not installed — `pip install onnxruntime`"
        ) from exc

    options = onnxruntime.SessionOptions()
    threads = _env_int("BURBZ_BIRDNET_V3_THREADS", 0)
    if threads > 0:
        # Worth capping on a shared VPS: inference is the only CPU-hungry thing
        # the box does, and an uncapped session will happily take every core.
        options.intra_op_num_threads = threads
    return onnxruntime.InferenceSession(
        path, sess_options=options, providers=["CPUExecutionProvider"]
    )


def load(force: bool = False):
    """Load the acoustic model and labels once, thread-safely."""
    global _session, _labels, _bird_mask, _input_name, _model_meta
    if _session is not None and not force:
        return _session

    with _load_lock:
        if _session is not None and not force:
            return _session

        import numpy as np

        weights = _resolve_asset(
            "BURBZ_BIRDNET_V3_ONNX_PATH", ONNX_FILENAME,
            f"{ZENODO_BASE}/{ONNX_FILENAME.replace('+', '%2B')}?download=1",
        )
        labels_path = _resolve_asset(
            "BURBZ_BIRDNET_V3_LABELS_PATH", LABELS_FILENAME,
            f"{ZENODO_BASE}/{LABELS_FILENAME.replace('+', '%2B')}?download=1",
        )

        weights_sha = _verify_asset(weights, ONNX_SHA256, "BirdNET V3 acoustic model")
        labels_sha = _verify_asset(labels_path, LABELS_SHA256, "BirdNET V3 labels")
        session = _make_session(weights)
        labels = _load_labels(labels_path)

        inputs = session.get_inputs()
        if not inputs:
            raise BirdNETV3Unavailable("the V3 ONNX model exposes no inputs")
        input_name = inputs[0].name
        if getattr(inputs[0], "type", "tensor(float)") != "tensor(float)":
            raise BirdNETV3Unavailable(
                f"unexpected V3 input type {getattr(inputs[0], 'type', None)!r}"
            )

        outputs = {output.name: output for output in session.get_outputs()}
        prediction_output = outputs.get("predictions")
        if prediction_output is None:
            raise BirdNETV3Unavailable(
                f"the V3 model has no 'predictions' output (found {sorted(outputs)})"
            )
        shape = getattr(prediction_output, "shape", None) or ()
        if shape and isinstance(shape[-1], int) and shape[-1] != len(labels):
            raise BirdNETV3Unavailable(
                f"model declares {shape[-1]} prediction classes but labels contain "
                f"{len(labels)} rows"
            )

        scientific_names = {row["scientific_name"] for row in labels}
        sentinels = {"Parus major", "Fringilla coelebs", "Turdus viscivorus", "Strix aluco"}
        missing = sentinels - scientific_names
        if missing:
            raise BirdNETV3Unavailable(
                f"the V3 label file is missing expected sentinel species {sorted(missing)}"
            )

        bird_mask = np.array([row["class"] == "Aves" for row in labels], dtype=bool)
        meta = {
            "name": MODEL_NAME,
            "version": "3.0-preview3.1",
            "modelSha256": weights_sha,
            "labelsSha256": labels_sha,
            "classes": len(labels),
            "birdClasses": int(bird_mask.sum()),
            "scoreBlacklistSha256": SCORE_BLACKLIST_SHA256,
            "policyVersion": DECISION_POLICY_VERSION,
        }

        # Publish all mutually dependent state together. A concurrent request
        # must never see a new session with old labels or a missing input name.
        _labels = labels
        _bird_mask = bird_mask
        _input_name = input_name
        _model_meta = meta
        _session = session
        logger.info(
            "BirdNET V3 loaded: %d classes (%d birds), input=%r, weights=%s sha256=%s policy=%s",
            len(labels), int(bird_mask.sum()), input_name, os.path.basename(weights),
            weights_sha[:12], DECISION_POLICY_VERSION,
        )
        return session


def model_meta() -> dict:
    """JSON-ready identity for the model and decision policy actually loaded."""
    if _session is None:
        load()
    return dict(_model_meta)


def _load_geo():
    """Load the geographic range model. Returns None if it is not installed.

    The range filter is an enhancement, not a dependency: a box without the
    geomodel still identifies birds, it just does not narrow by location.
    """
    global _geo_session, _geo_index, _geo_output_size, _geo_model_meta
    if _geo_session is not None:
        return _geo_session

    with _geo_load_lock:
        if _geo_session is not None:
            return _geo_session
        _geo_model_meta = {}
        try:
            weights = _resolve_asset(
                "BURBZ_BIRDNET_V3_GEO_ONNX_PATH", GEO_ONNX_FILENAME,
                f"{GEO_BASE}/{GEO_ONNX_FILENAME.replace('+', '%2B')}",
            )
            labels_path = _resolve_asset(
                "BURBZ_BIRDNET_V3_GEO_LABELS_PATH", GEO_LABELS_FILENAME,
                f"{GEO_BASE}/{GEO_LABELS_FILENAME.replace('+', '%2B')}",
            )
            weights_sha = _verify_asset(weights, GEO_ONNX_SHA256, "BirdNET V3 geomodel")
            labels_sha = _verify_asset(
                labels_path, GEO_LABELS_SHA256, "BirdNET V3 geomodel labels"
            )
            session = _make_session(weights)
        except BirdNETV3Unavailable as exc:
            logger.info("Range filter disabled — %s", exc)
            return None

        # Tab-separated: gbif_id, scientific name, common name.
        index = {}
        with open(labels_path, encoding="utf-8") as handle:
            for position, line in enumerate(handle):
                parts = line.rstrip("\n").split("\t")
                if len(parts) >= 2 and parts[1].strip():
                    index.setdefault(parts[1].strip().lower(), position)

        outputs = {output.name: output for output in session.get_outputs()}
        probability_output = outputs.get("probabilities")
        if probability_output is None:
            logger.error("Range filter disabled: geomodel has no probabilities output")
            return None
        shape = getattr(probability_output, "shape", None) or ()
        output_size = shape[-1] if shape and isinstance(shape[-1], int) else None
        if output_size is not None and index and max(index.values()) >= output_size:
            logger.error(
                "Range filter disabled: labels address %d species but model returns %d",
                max(index.values()) + 1, output_size,
            )
            return None

        _geo_index = index
        _geo_output_size = output_size
        _geo_model_meta = {
            "name": GEO_MODEL_NAME,
            "version": "3.0.2",
            "modelSha256": weights_sha,
            "labelsSha256": labels_sha,
            "species": len(index),
        }
        _geo_session = session
        logger.info(
            "BirdNET Geomodel loaded: %d species, weights_sha256=%s labels_sha256=%s",
            len(index), weights_sha[:12], labels_sha[:12],
        )
        return session


def geo_model_meta() -> dict:
    """JSON-ready identity for the geographic model actually loaded."""
    if _geo_session is None and _load_geo() is None:
        return {}
    return dict(_geo_model_meta)


# --------------------------------------------------------------------------
# Audio preparation
# --------------------------------------------------------------------------

def _normalise(chunk):
    """Prepare natural-level float audio, or report the chunk as too quiet.

    The function name remains for compatibility, but ordinary audio is
    deliberately not peak-normalised. The official V3 analyser feeds the raw
    waveform, and Burbz's real-model regression proved that artificial gain can
    promote Mistle Thrush over an attributed Common Blackbird recording.
    """
    import numpy as np

    prepared = np.asarray(chunk, dtype=np.float32)
    if prepared.size == 0:
        return prepared, True
    if not np.isfinite(prepared).all():
        logger.warning("non-finite input samples: replacing them with silence")
        prepared = np.nan_to_num(prepared, nan=0.0, posinf=0.0, neginf=0.0)
    peak = float(np.max(np.abs(prepared)))
    rms = float(np.sqrt(np.mean(np.square(prepared, dtype=np.float64))))
    minimum_rms = _env_bounded_float(
        "BURBZ_BIRDNET_V3_MIN_RMS", DEFAULT_MIN_RMS, 0.0, 0.1
    )
    return prepared, bool(peak < SILENCE_FLOOR or rms < minimum_rms)


def _chunks(samples, min_tail_seconds: float = 0.5) -> List:
    """Split into 3 s chunks, preserving silent positions. Never pads.

    V2.4 took a fixed 3-second input, so a short clip had to be zero-padded.
    V3 takes a variable-length one, and padding actively harms it: padding this
    repo's 2.2 s blackbird recording out to 3 s collapses Common Blackbird from
    0.46 to 0.04 and promotes American Robin — a species from the wrong
    continent — to the top. So a short final chunk is run at its true length,
    and a tail below ``min_tail_seconds`` is dropped as too short to identify.

    Quiet chunks are represented by same-length zero arrays and bypass model
    inference. Keeping their timeline positions is essential: deleting them can
    compress a mostly quiet 12-second recording into one apparent window and
    incorrectly apply the single-window acceptance rule to an isolated spike.
    If every chunk is quiet, the function returns an empty list.

    Returns a list of 1-D arrays, which may differ in length.
    """
    import numpy as np

    if samples.size == 0:
        return []

    overlap = _env_bounded_float(
        "BURBZ_BIRDNET_V3_OVERLAP", DEFAULT_OVERLAP, 0.0, 0.95
    )
    hop = max(1, int(CHUNK_SAMPLES * (1.0 - overlap)))
    minimum = max(1, int(min_tail_seconds * SAMPLE_RATE))

    timeline, silent, has_signal = [], 0, False
    for start in range(0, max(samples.size, 1), hop):
        chunk = samples[start:start + CHUNK_SAMPLES]
        if chunk.size < minimum:
            break
        chunk, is_silent = _normalise(chunk)
        if is_silent:
            silent += 1
            timeline.append(np.zeros_like(chunk))
        else:
            has_signal = True
            timeline.append(chunk)
        if start + CHUNK_SAMPLES >= samples.size:
            break

    if silent:
        logger.debug("preserved %d silent timeline chunk(s) without inference", silent)
    return timeline if has_signal else []


# --------------------------------------------------------------------------
# Inference
# --------------------------------------------------------------------------

def _infer(session, chunks) -> "object":
    """Run the model over chunks that may differ in length.

    A batch tensor is rectangular, so only equal-length chunks can share one.
    In practice that is the whole clip in a single batch plus, at most, one
    odd-length tail — grouping by length keeps the batching win without
    padding anything back to a common size.
    """
    import numpy as np

    if not chunks:
        return np.zeros((0, 0), dtype=np.float32)

    batch_size = max(1, _env_int("BURBZ_BIRDNET_V3_BATCH", 8))
    scores = [None] * len(chunks)
    silent_positions = {
        position for position, chunk in enumerate(chunks)
        if not np.any(np.asarray(chunk))
    }

    groups: dict = {}
    for position, chunk in enumerate(chunks):
        if position in silent_positions:
            continue
        groups.setdefault(int(chunk.size), []).append(position)

    for positions in groups.values():
        for start in range(0, len(positions), batch_size):
            block_positions = positions[start:start + batch_size]
            block = np.stack([chunks[p] for p in block_positions]).astype(np.float32)
            try:
                out = session.run(["predictions"], {_input_name: block})[0]
            except Exception:
                out = np.stack([
                    session.run(["predictions"], {_input_name: row[None, :]})[0][0]
                    for row in block
                ])
            out = np.asarray(out, dtype=np.float32).reshape(len(block_positions), -1)
            for offset, position in enumerate(block_positions):
                scores[position] = out[offset]

    exemplar = next((row for row in scores if row is not None), None)
    if exemplar is None:
        width = len(_labels or ())
        return np.zeros((len(chunks), width), dtype=np.float32)
    for position in silent_positions:
        scores[position] = np.zeros_like(exemplar, dtype=np.float32)
    return np.stack(scores)


def _birdnet_week(week: Optional[int]) -> int:
    """BirdNET's week-of-year: 4 per month, 1-48.

    The client sends latitude and longitude but no week, so absent one we use
    today's — which is what the player means by "here, now".
    """
    if week is not None:
        try:
            return max(1, min(48, int(week)))
        except (TypeError, ValueError, OverflowError):
            pass
    today = _datetime.date.today()
    return (today.month - 1) * 4 + min(3, (today.day - 1) // 7) + 1


def _valid_location(lat, lon) -> Optional[Tuple[float, float]]:
    try:
        latitude, longitude = float(lat), float(lon)
    except (TypeError, ValueError):
        return None
    if not (-90.0 <= latitude <= 90.0 and -180.0 <= longitude <= 180.0):
        return None
    if not (latitude == latitude and longitude == longitude):
        return None
    return latitude, longitude


def _geo_probabilities(lat: float, lon: float, week: int):
    """Occurrence probability per geomodel class, cached per location and week."""
    import numpy as np

    session = _load_geo()
    if session is None:
        return None

    key = (round(float(lat), 2), round(float(lon), 2), int(week))
    cached = _geo_cache.get(key)
    if cached is not None:
        return cached

    probabilities = session.run(
        ["probabilities"],
        {"input": np.array([[float(lat), float(lon), float(week)]], dtype=np.float32)},
    )[0][0]
    probabilities = np.asarray(probabilities, dtype=np.float32).reshape(-1)
    if _geo_output_size is not None and probabilities.size != _geo_output_size:
        raise BirdNETV3Unavailable(
            f"geomodel returned {probabilities.size} values, expected {_geo_output_size}"
        )
    if not np.isfinite(probabilities).all():
        raise BirdNETV3Unavailable("geomodel returned non-finite occurrence scores")

    if len(_geo_cache) >= _GEO_CACHE_LIMIT:
        _geo_cache.clear()
    _geo_cache[key] = probabilities
    return probabilities


def _range_masks(lat, lon, week, count):
    """Return geographic eligibility and model-coverage masks.

    Species the geomodel does not know remain eligible because an unknown
    range is not evidence of absence. The separate coverage mask lets the
    decision layer apply the stricter no-geo confidence floor to those classes
    instead of treating them as positively covered by the range model.
    """
    import numpy as np

    if not _env_flag("BURBZ_BIRDNET_V3_GEO", True):
        return None, None
    location = _valid_location(lat, lon)
    if location is None:
        if lat is not None or lon is not None:
            logger.warning("range filter skipped: invalid coordinates lat=%r lon=%r", lat, lon)
        return None, None
    try:
        probabilities = _geo_probabilities(location[0], location[1], week)
    except Exception:
        logger.exception("range filter failed — identifying without it")
        return None, None
    if probabilities is None or _geo_index is None or _labels is None:
        return None, None

    threshold = _env_bounded_float(
        "BURBZ_BIRDNET_V3_GEO_THRESHOLD", DEFAULT_GEO_THRESHOLD, 0.0, 1.0
    )
    mask = np.ones(count, dtype=bool)
    covered = np.zeros(count, dtype=bool)
    for position, row in enumerate(_labels[:count]):
        scientific_key = row["scientific_name"].strip().lower()
        geo_key = GEO_SCIENTIFIC_ALIASES.get(scientific_key, scientific_key)
        geo_position = _geo_index.get(geo_key)
        if geo_position is not None and geo_position < probabilities.size:
            covered[position] = True
            mask[position] = probabilities[geo_position] >= threshold
    return mask, covered


def _range_mask(lat, lon, week, count):
    """Compatibility wrapper returning only geographic eligibility."""
    return _range_masks(lat, lon, week, count)[0]


def _log_mean_exp(window_scores, alpha: float):
    """Per-class Log-Mean-Exp pooling used by BirdNET Live."""
    import numpy as np

    values = np.asarray(window_scores, dtype=np.float64)
    if values.shape[0] == 1:
        return values[0].astype(np.float32)
    scaled = values * float(alpha)
    maxima = scaled.max(axis=0)
    pooled = (maxima + np.log(np.exp(scaled - maxima).mean(axis=0))) / float(alpha)
    return pooled.astype(np.float32)


def _species_thresholds(count: int, base_threshold: float):
    """Per-class pooled decision thresholds."""
    import numpy as np

    return np.full(count, base_threshold, dtype=np.float32)


def _score_multipliers(count: int):
    """Per-class BirdNET Live score-blacklist multipliers."""
    import numpy as np

    multipliers = np.ones(count, dtype=np.float32)
    if _labels is None:
        return multipliers
    for position, row in enumerate(_labels[:count]):
        multipliers[position] = SCORE_MULTIPLIERS_BY_COMMON_NAME.get(
            row["common_name"].strip(),
            SCORE_MULTIPLIER_SCIENTIFIC_ALIASES.get(
                row["scientific_name"].strip(), 1.0
            ),
        )
    return multipliers


def _mistle_index(count: int) -> Optional[int]:
    if _labels is None:
        return None
    for position, row in enumerate(_labels[:count]):
        if row["scientific_name"].strip().lower() == "turdus viscivorus":
            return position
    return None


def _temporal_decision_scores(
    scores,
    *,
    threshold_floor: float = 0.0,
    threshold_floors=None,
):
    """Apply conservative streaming-style temporal confirmation.

    Returns ``(decision_scores, raw_peaks, support_counts, support_thresholds)``.
    A normal multi-window clip needs evidence in at least two recent windows;
    one unsupported spike is accepted only at the official 0.98 immediate
    threshold. A genuinely short, one-window recording uses that same
    precision-first floor rather than weakening the production policy for
    incomplete evidence.
    """
    import numpy as np

    values = np.asarray(scores, dtype=np.float32)
    if values.ndim != 2 or not values.shape[0] or not values.shape[1]:
        count = values.shape[1] if values.ndim == 2 else 0
        return (
            np.zeros(count, dtype=np.float32),
            np.zeros(count, dtype=np.float32),
            np.zeros(count, dtype=np.int32),
            np.full(count, DEFAULT_SUPPORT_THRESHOLD_FLOOR, dtype=np.float32),
        )

    configured_threshold = _env_bounded_float(
        "BURBZ_BIRDNET_V3_MIN_CONFIDENCE", DEFAULT_MIN_CONFIDENCE, 0.01, 0.99
    )
    # An older VPS environment used 0.15.  Treat the environment setting as a
    # way to make production *stricter*, never as a way for stale configuration
    # to silently weaken the reviewed accuracy policy.
    threshold = max(
        configured_threshold,
        DEFAULT_MIN_CONFIDENCE,
        float(threshold_floor),
    )
    single_threshold = _env_bounded_float(
        "BURBZ_BIRDNET_V3_SINGLE_WINDOW_CONFIDENCE",
        DEFAULT_SINGLE_WINDOW_CONFIDENCE,
        0.01,
        0.99,
    )
    immediate_threshold = _env_bounded_float(
        "BURBZ_BIRDNET_V3_VERY_HIGH_CONFIDENCE",
        DEFAULT_VERY_HIGH_CONFIDENCE,
        0.01,
        1.0,
    )
    alpha = _env_bounded_float(
        "BURBZ_BIRDNET_V3_TEMPORAL_ALPHA", DEFAULT_TEMPORAL_ALPHA, 0.1, 50.0
    )
    support_fraction = _env_bounded_float(
        "BURBZ_BIRDNET_V3_SUPPORT_THRESHOLD_FRACTION",
        DEFAULT_SUPPORT_THRESHOLD_FRACTION,
        0.0,
        1.0,
    )
    support_floor = _env_bounded_float(
        "BURBZ_BIRDNET_V3_SUPPORT_THRESHOLD_FLOOR",
        DEFAULT_SUPPORT_THRESHOLD_FLOOR,
        0.0,
        1.0,
    )
    min_support = max(
        1, min(20, _env_int("BURBZ_BIRDNET_V3_MIN_SUPPORT_WINDOWS", DEFAULT_MIN_SUPPORT_WINDOWS))
    )
    max_windows = max(
        1, min(20, _env_int("BURBZ_BIRDNET_V3_TEMPORAL_MAX_WINDOWS", DEFAULT_TEMPORAL_MAX_WINDOWS))
    )

    peaks = values.max(axis=0)
    species_thresholds = _species_thresholds(values.shape[1], threshold)
    if threshold_floors is not None:
        per_class_floors = np.asarray(threshold_floors, dtype=np.float32).reshape(-1)
        if per_class_floors.size != values.shape[1]:
            raise ValueError(
                f"threshold_floors has {per_class_floors.size} classes, "
                f"expected {values.shape[1]}"
            )
        species_thresholds = np.maximum(species_thresholds, per_class_floors)
    support_thresholds = np.maximum(
        species_thresholds * support_fraction, support_floor
    ).astype(np.float32)
    support_counts = (values >= support_thresholds).sum(axis=0).astype(np.int32)
    score_multipliers = _score_multipliers(values.shape[1])
    mistle_index = _mistle_index(values.shape[1])
    mistle_high_threshold = _env_bounded_float(
        "BURBZ_BIRDNET_V3_MISTLE_THRUSH_MIN_CONFIDENCE",
        DEFAULT_MISTLE_THRUSH_MIN_CONFIDENCE,
        0.0,
        1.0,
    )
    mistle_min_high = max(
        1,
        min(
            20,
            _env_int(
                "BURBZ_BIRDNET_V3_MISTLE_THRUSH_MIN_HIGH_WINDOWS",
                DEFAULT_MISTLE_THRUSH_MIN_HIGH_WINDOWS,
            ),
        ),
    )
    decisions = np.zeros(values.shape[1], dtype=np.float32)

    if values.shape[0] == 1:
        adjusted = values[0] * score_multipliers
        required = np.maximum(species_thresholds, single_threshold)
        if mistle_index is not None:
            required[mistle_index] = max(required[mistle_index], immediate_threshold)
        accepted = adjusted >= required
        decisions[accepted] = adjusted[accepted]
        return decisions, peaks, support_counts, support_thresholds

    # Emulate the official streaming history at every point in this uploaded
    # clip. This catches a bird heard near the start without diluting it across
    # all 12 seconds, while still requiring temporal support.
    for end in range(values.shape[0]):
        history = values[max(0, end + 1 - max_windows):end + 1]
        pooled = _log_mean_exp(history, alpha)
        adjusted_pooled = pooled * score_multipliers
        supported = (history >= support_thresholds).sum(axis=0) >= min_support
        immediate = history[-1] >= immediate_threshold
        accepted = (supported | immediate) & (adjusted_pooled >= species_thresholds)
        if mistle_index is not None:
            mistle_confirmed = (
                int((history[:, mistle_index] >= mistle_high_threshold).sum())
                >= mistle_min_high
                or bool(immediate[mistle_index])
            )
            accepted[mistle_index] &= mistle_confirmed
        decisions[accepted] = np.maximum(
            decisions[accepted], adjusted_pooled[accepted]
        )

    return decisions, peaks, support_counts, support_thresholds


def _log_diagnostics(
    audio_path,
    scores,
    decisions,
    raw_peaks,
    support_counts,
    results,
    sample_seconds,
    sample_rms,
    sample_peak,
    chunk_count,
    range_mask,
    lat,
    lon,
    started,
) -> None:
    """Emit privacy-safe decision metadata when explicitly enabled.

    Audio is never retained. The trace is enough to distinguish model
    confusion, a one-window spike, missing location, and a fallback/deploy
    problem when a player reports another wrong identification.
    """
    if not _env_flag("BURBZ_BIRDNET_V3_DIAGNOSTICS", False) or _labels is None:
        return
    import numpy as np

    all_scores = np.asarray(scores)
    raw = all_scores.max(axis=0) if all_scores.ndim == 2 and all_scores.size else np.asarray(raw_peaks)
    top = np.argsort(raw)[::-1][:8] if raw.size else []
    payload = {
        "policy": DECISION_POLICY_VERSION,
        "fileType": os.path.splitext(str(audio_path))[1].lower(),
        "audioSeconds": round(float(sample_seconds), 3),
        "chunks": int(chunk_count),
        "rms": round(float(sample_rms), 7),
        "peak": round(float(sample_peak), 7),
        "locationProvided": _valid_location(lat, lon) is not None,
        "rangeFilter": "applied" if range_mask is not None else "unavailable_or_disabled",
        "accepted": [item["scientific_name"] for item in results],
        "top": [
            {
                "species": _labels[int(index)]["scientific_name"],
                "peak": round(float(raw[index]), 4),
                "decision": round(float(decisions[index]), 4),
                "support": int(support_counts[index]),
            }
            for index in top
        ],
        "latencyMs": round((time.monotonic() - started) * 1000),
    }
    logger.info("BirdNET V3 decision %s", json.dumps(payload, sort_keys=True))


def analyse(
    audio_path: str,
    *,
    allow: Optional[Iterable[str]] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    week: Optional[int] = None,
    common_name_for: Optional[Callable[[str], Optional[str]]] = None,
) -> Sequence[dict]:
    """Identify species in a prepared recording.

    Returns the shape ``_aggregate_sound_detections`` already produced, so
    everything downstream in server.py is untouched::

        [{"common_name", "scientific_name", "max", "mean", "n", "is_local"}, ...]
    """
    import numpy as np

    started = time.monotonic()
    session = load()
    assert _labels is not None

    samples, rate = _audio.read_mono(audio_path)
    samples = _audio.resample(samples, rate, SAMPLE_RATE)
    sample_peak = float(np.max(np.abs(samples))) if samples.size else 0.0
    sample_rms = (
        float(np.sqrt(np.mean(np.square(samples, dtype=np.float64))))
        if samples.size else 0.0
    )
    chunks = _chunks(samples)
    if not chunks:
        if _env_flag("BURBZ_BIRDNET_V3_DIAGNOSTICS", False):
            logger.info(
                "BirdNET V3 abstained %s",
                json.dumps({
                    "policy": DECISION_POLICY_VERSION,
                    "reason": "empty_or_too_quiet",
                    "audioSeconds": round(samples.size / SAMPLE_RATE, 3),
                    "rms": round(sample_rms, 7),
                    "peak": round(sample_peak, 7),
                }, sort_keys=True),
            )
        return []

    scores = _infer(session, chunks)
    if scores.size == 0:
        return []
    if scores.shape[1] != len(_labels):
        raise BirdNETV3Unavailable(
            f"model returned {scores.shape[1]} classes but {len(_labels)} labels "
            "were loaded — the weights and the label file are out of step"
        )

    # Belt and braces behind the silence guard: a NaN must never reach a
    # player as a confident detection.
    if not np.isfinite(scores).all():
        logger.warning("non-finite scores from the model — treating them as zero")
        scores = np.nan_to_num(scores, nan=0.0, posinf=0.0, neginf=0.0)

    eligible_scores = scores.copy()

    # Burbz is a bird game and its catalogue is birds, so the ~1,700 frog,
    # insect and mammal classes can only crowd out a real bird in the result
    # list. Keep them out unless someone deliberately wants them.
    if _env_flag("BURBZ_BIRDNET_V3_BIRDS_ONLY", True) and _bird_mask is not None:
        eligible_scores[:, ~_bird_mask] = 0.0

    range_mask, geo_coverage = _range_masks(
        lat, lon, _birdnet_week(week), eligible_scores.shape[1]
    )
    if range_mask is not None:
        eligible_scores[:, ~range_mask] = 0.0

    no_geo_floor = _env_bounded_float(
        "BURBZ_BIRDNET_V3_NO_GEO_MIN_CONFIDENCE",
        DEFAULT_NO_GEO_MIN_CONFIDENCE,
        0.01,
        0.99,
    )
    threshold_floor = 0.0
    threshold_floors = None
    if range_mask is None:
        threshold_floor = no_geo_floor
    elif geo_coverage is not None:
        threshold_floors = np.where(
            geo_coverage, 0.0, no_geo_floor
        ).astype(np.float32)
    decisions, raw_peaks, support_counts, support_thresholds = _temporal_decision_scores(
        eligible_scores,
        threshold_floor=threshold_floor,
        threshold_floors=threshold_floors,
    )
    max_results = _env_int("BURBZ_BIRDNET_V3_MAX_RESULTS", DEFAULT_MAX_RESULTS)

    hits = np.nonzero(decisions > 0.0)[0]
    if hits.size == 0:
        _log_diagnostics(
            audio_path, scores, decisions, raw_peaks, support_counts, [],
            samples.size / SAMPLE_RATE, sample_rms, sample_peak, len(chunks),
            range_mask, lat, lon, started,
        )
        return []
    # Sort all accepted candidates before taxonomy deduplication. Pre-capping
    # here could let two historical names for one taxon crowd out a real
    # second species.
    hits = hits[np.argsort(decisions[hits])[::-1]]

    allow_set = {str(name).strip().lower() for name in (allow or ()) if str(name).strip()}

    results_by_taxon = {}
    for index in hits:
        row = _labels[int(index)]
        model_scientific = row["scientific_name"]
        scientific = CANONICAL_SCIENTIFIC_ALIASES.get(
            model_scientific.strip().lower(),
            model_scientific,
        )
        column = eligible_scores[:, index]
        above = column[column >= support_thresholds[index]]

        # Prefer the Burbz catalogue's own name so the match toast matches the
        # rest of the game, then the model's common name, then the binomial.
        common = None
        if common_name_for is not None:
            try:
                common = common_name_for(scientific)
                if not common and scientific != model_scientific:
                    common = common_name_for(model_scientific)
            except Exception:
                logger.exception("common-name lookup failed for %r", scientific)
        common = common or row["common_name"] or scientific

        is_local = True
        if allow_set:
            is_local = (
                scientific.strip().lower() in allow_set
                or model_scientific.strip().lower() in allow_set
                or str(common).strip().lower() in allow_set
                or row["common_name"].strip().lower() in allow_set
            )

        item = {
            "common_name": common,
            "scientific_name": scientific,
            # `max` is the legacy response field name. It now carries the
            # conservative pooled decision score, not a one-window maximum.
            "max": float(decisions[index]),
            "mean": float(above.mean()) if above.size else float(column.max()),
            "n": int(support_counts[index]),
            "is_local": bool(is_local),
        }
        taxon_key = scientific.strip().lower()
        existing = results_by_taxon.get(taxon_key)
        if existing is None:
            results_by_taxon[taxon_key] = item
        else:
            # Hits are score-sorted, so keep the strongest score/statistics
            # but merge independent support and allow-list locality.
            existing["n"] = max(existing["n"], item["n"])
            existing["is_local"] = existing["is_local"] or item["is_local"]

    # Evidence is primary. Locality is only a tie-breaker; a weak allow-list
    # member must never outrank a substantially stronger acoustic match.
    results = list(results_by_taxon.values())
    results.sort(key=lambda item: (item["max"], item["is_local"]), reverse=True)
    results = results[:max(1, max_results)]
    _log_diagnostics(
        audio_path, scores, decisions, raw_peaks, support_counts, results,
        samples.size / SAMPLE_RATE, sample_rms, sample_peak, len(chunks),
        range_mask, lat, lon, started,
    )
    return results
