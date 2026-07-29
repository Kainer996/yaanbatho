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

V3 is also a better model than V2.4 on every axis Burbz cares about:

    classes        6,000 -> 11,560 (9,834 birds plus other calling taxa)
    sample rate    48 kHz -> 32 kHz
    input          fixed 3 s -> variable length
    outputs        predictions + a 1,280-d embedding
    range filter   built-in V2.4 filter -> BirdNET Geomodel V3.0 (12,012 species)

Install:

    pip install onnxruntime numpy
    pip install soxr soundfile     # optional, better resampling

Weights are not bundled — ``scripts/install-birdnet-v3.sh`` fetches them from
Zenodo onto the VPS. No TensorFlow, no PyTorch, no GPU.

Two traps worth knowing about, both handled below:

1. **The FP16 weights return NaN on quiet audio.** The model normalises
   internally, and on a near-silent window the spectrogram underflows FP16 to
   zero and the log of it becomes NaN. Burbz's listener rotates 12-second
   windows continuously, so near-silent windows are guaranteed, not rare. Every
   chunk is peak-normalised before inference and digital silence is skipped
   outright. This is also an accuracy win: peak-normalising lifted a quiet
   tawny-owl clip from 0.81 to 0.95.

2. **V3 scores are not V2 scores.** They are already sigmoid-activated
   probabilities in [0, 1], so nothing is applied on top; but the scale differs
   from V2.4's, so the old confidence threshold must not be carried across.
"""

from __future__ import annotations

import csv
import datetime as _datetime
import logging
import os
import threading
from typing import Callable, Iterable, List, Optional, Sequence, Tuple

from . import _audio

logger = logging.getLogger(__name__)

SAMPLE_RATE = 32000
CHUNK_SECONDS = 3.0
CHUNK_SAMPLES = int(SAMPLE_RATE * CHUNK_SECONDS)

# Below this peak amplitude a window is digital silence — a muted mic, a
# dropped buffer, or the zero padding on a short tail. Feeding it to the FP16
# model returns NaN, so these windows are skipped rather than normalised (there
# is nothing in them to normalise).
SILENCE_FLOOR = 1e-6

# BirdNET+ V3.0 developer preview 3.1 — https://zenodo.org/records/20703646
ONNX_FILENAME = "BirdNET+_V3.0-preview3.1_Global_11K_FP16_pruned.onnx"
LABELS_FILENAME = "BirdNET+_V3.0-preview3.1_Global_11K_Labels.csv"
ZENODO_BASE = "https://zenodo.org/records/20703646/files"

# BirdNET Geomodel V3.0.2 — the successor to V2.4's built-in range filter.
GEO_ONNX_FILENAME = "BirdNET+_Geomodel_V3.0.2_Global_12K_FP16.onnx"
GEO_LABELS_FILENAME = "BirdNET+_Geomodel_V3.0.2_Global_12K_Labels.txt"
GEO_BASE = "https://huggingface.co/tphakala/BirdNET-Geomodel/resolve/main"

# Upstream's own default (analyze.py --min-conf). Tune against real Burbz
# recordings before judging accuracy; a bad threshold looks like a bad model.
DEFAULT_MIN_CONFIDENCE = 0.15
DEFAULT_MAX_RESULTS = 8

# A species the geomodel puts below this probability for the player's location
# and week is treated as not present. Deliberately permissive: it is there to
# drop a Sulphur-crested Cockatoo heard in London (0.001), not to second-guess
# a plausible local bird.
DEFAULT_GEO_THRESHOLD = 0.01

_MODEL_DIR_CANDIDATES = (
    "/opt/burbz/models",
    "/var/lib/burbz/models",
    os.path.join(os.path.expanduser("~"), ".cache", "burbz", "models"),
)

_session = None
_labels: Optional[List[dict]] = None
_bird_mask = None
_input_name: Optional[str] = None
_load_lock = threading.Lock()

_geo_session = None
_geo_index: Optional[dict] = None
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


def _search_dirs() -> List[str]:
    dirs = []
    explicit = (os.environ.get("BURBZ_BIRDNET_V3_MODEL_DIR") or "").strip()
    if explicit:
        dirs.append(explicit)
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
        except (TypeError, ValueError):
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
    global _session, _labels, _bird_mask, _input_name
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

        session = _make_session(weights)
        labels = _load_labels(labels_path)

        inputs = session.get_inputs()
        if not inputs:
            raise BirdNETV3Unavailable("the V3 ONNX model exposes no inputs")

        _session = session
        _labels = labels
        _input_name = inputs[0].name
        _bird_mask = np.array([row["class"] == "Aves" for row in labels], dtype=bool)
        logger.info(
            "BirdNET V3 loaded: %d classes (%d birds), input=%r, weights=%s",
            len(labels), int(_bird_mask.sum()), _input_name, os.path.basename(weights),
        )
        return _session


def _load_geo():
    """Load the geographic range model. Returns None if it is not installed.

    The range filter is an enhancement, not a dependency: a box without the
    geomodel still identifies birds, it just does not narrow by location.
    """
    global _geo_session, _geo_index
    if _geo_session is not None:
        return _geo_session

    with _geo_load_lock:
        if _geo_session is not None:
            return _geo_session
        try:
            weights = _resolve_asset(
                "BURBZ_BIRDNET_V3_GEO_ONNX_PATH", GEO_ONNX_FILENAME,
                f"{GEO_BASE}/{GEO_ONNX_FILENAME.replace('+', '%2B')}",
            )
            labels_path = _resolve_asset(
                "BURBZ_BIRDNET_V3_GEO_LABELS_PATH", GEO_LABELS_FILENAME,
                f"{GEO_BASE}/{GEO_LABELS_FILENAME.replace('+', '%2B')}",
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

        _geo_session = session
        _geo_index = index
        logger.info("BirdNET Geomodel loaded: %d species", len(index))
        return _geo_session


# --------------------------------------------------------------------------
# Audio preparation
# --------------------------------------------------------------------------

def _normalise(chunk):
    """Peak-normalise to full scale, or report the chunk as silent.

    Returns (chunk, is_silent). The model is amplitude-invariant over about
    three orders of magnitude, so this does not change what a normal recording
    is identified as — it keeps a quiet one out of the FP16 underflow that
    otherwise returns NaN for every class.
    """
    import numpy as np

    peak = float(np.max(np.abs(chunk))) if chunk.size else 0.0
    if peak < SILENCE_FLOOR:
        return chunk.astype(np.float32), True
    return (chunk / peak).astype(np.float32), False


def _chunks(samples, min_tail_seconds: float = 0.5) -> List:
    """Split into 3 s chunks, dropping silent ones. Never pads.

    V2.4 took a fixed 3-second input, so a short clip had to be zero-padded.
    V3 takes a variable-length one, and padding actively harms it: padding this
    repo's 2.2 s blackbird recording out to 3 s collapses Common Blackbird from
    0.46 to 0.04 and promotes American Robin — a species from the wrong
    continent — to the top. So a short final chunk is run at its true length,
    and a tail below ``min_tail_seconds`` is dropped as too short to identify.

    Returns a list of 1-D arrays, which may differ in length.
    """
    if samples.size == 0:
        return []

    overlap = min(max(_env_float("BURBZ_BIRDNET_V3_OVERLAP", 0.0), 0.0), 0.95)
    hop = max(1, int(CHUNK_SAMPLES * (1.0 - overlap)))
    minimum = max(1, int(min_tail_seconds * SAMPLE_RATE))

    kept, silent = [], 0
    for start in range(0, max(samples.size, 1), hop):
        chunk = samples[start:start + CHUNK_SAMPLES]
        if chunk.size < minimum:
            break
        chunk, is_silent = _normalise(chunk)
        if is_silent:
            silent += 1
        else:
            kept.append(chunk)
        if start + CHUNK_SAMPLES >= samples.size:
            break

    if silent:
        logger.debug("skipped %d silent chunk(s)", silent)
    return kept


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

    groups: dict = {}
    for position, chunk in enumerate(chunks):
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

    return np.stack(scores)


def _birdnet_week(week: Optional[int]) -> int:
    """BirdNET's week-of-year: 4 per month, 1-48.

    The client posts this alongside latitude and longitude, read from the
    device clock in the player's hand. Absent one — an older client, or a
    caller that does not pass it through — we fall back to the server's own
    date, which is the same thing whenever the two agree.
    """
    if week is not None:
        try:
            return max(1, min(48, int(week)))
        except (TypeError, ValueError):
            pass
    today = _datetime.date.today()
    return (today.month - 1) * 4 + min(3, (today.day - 1) // 7) + 1


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

    if len(_geo_cache) >= _GEO_CACHE_LIMIT:
        _geo_cache.clear()
    _geo_cache[key] = probabilities
    return probabilities


def _range_mask(lat, lon, week, count):
    """Boolean mask of species plausible at this location, or None.

    Species the geomodel does not know are always kept — an unknown range is
    not evidence of absence.
    """
    import numpy as np

    if lat is None or lon is None or not _env_flag("BURBZ_BIRDNET_V3_GEO", True):
        return None
    try:
        probabilities = _geo_probabilities(lat, lon, week)
    except Exception:
        logger.exception("range filter failed — identifying without it")
        return None
    if probabilities is None or _geo_index is None or _labels is None:
        return None

    threshold = _env_float("BURBZ_BIRDNET_V3_GEO_THRESHOLD", DEFAULT_GEO_THRESHOLD)
    mask = np.ones(count, dtype=bool)
    for position, row in enumerate(_labels):
        geo_position = _geo_index.get(row["scientific_name"].lower())
        if geo_position is not None and geo_position < probabilities.size:
            mask[position] = probabilities[geo_position] >= threshold
    return mask


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

    session = load()
    assert _labels is not None

    samples, rate = _audio.read_mono(audio_path)
    samples = _audio.resample(samples, rate, SAMPLE_RATE)
    chunks = _chunks(samples)
    if not chunks:
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
        scores = np.nan_to_num(scores, nan=0.0, posinf=1.0, neginf=0.0)

    peaks = scores.max(axis=0)

    # Burbz is a bird game and its catalogue is birds, so the ~1,700 frog,
    # insect and mammal classes can only crowd out a real bird in the result
    # list. Keep them out unless someone deliberately wants them.
    if _env_flag("BURBZ_BIRDNET_V3_BIRDS_ONLY", True) and _bird_mask is not None:
        peaks = np.where(_bird_mask, peaks, 0.0)

    range_mask = _range_mask(lat, lon, _birdnet_week(week), peaks.size)
    if range_mask is not None:
        peaks = np.where(range_mask, peaks, 0.0)

    threshold = _env_float("BURBZ_BIRDNET_V3_MIN_CONFIDENCE", DEFAULT_MIN_CONFIDENCE)
    max_results = _env_int("BURBZ_BIRDNET_V3_MAX_RESULTS", DEFAULT_MAX_RESULTS)

    hits = np.nonzero(peaks >= threshold)[0]
    if hits.size == 0:
        return []
    # Only the strongest candidates need per-chunk statistics.
    hits = hits[np.argsort(peaks[hits])[::-1][:max_results]]

    allow_set = {str(name).strip().lower() for name in (allow or ()) if str(name).strip()}

    results = []
    for index in hits:
        row = _labels[int(index)]
        scientific = row["scientific_name"]
        column = scores[:, index]
        above = column[column >= threshold]

        # Prefer the Burbz catalogue's own name so the match toast matches the
        # rest of the game, then the model's common name, then the binomial.
        common = None
        if common_name_for is not None:
            try:
                common = common_name_for(scientific)
            except Exception:
                logger.exception("common-name lookup failed for %r", scientific)
        common = common or row["common_name"] or scientific

        is_local = True
        if allow_set:
            is_local = (
                scientific.strip().lower() in allow_set
                or str(common).strip().lower() in allow_set
                or row["common_name"].strip().lower() in allow_set
            )

        results.append({
            "common_name": common,
            "scientific_name": scientific,
            "max": float(peaks[index]),
            "mean": float(above.mean()) if above.size else float(column.max()),
            "n": int(above.size),
            "is_local": bool(is_local),
        })

    # Local birds first, then confidence — the ordering BirdNET's aggregation
    # produced, so the server's "pick the top candidate" logic is unchanged.
    results.sort(key=lambda item: (item["is_local"], item["max"]), reverse=True)
    return results
