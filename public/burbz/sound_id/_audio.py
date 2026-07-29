"""Audio loading and resampling shared by the sound-recognition providers.

Both recognisers want the same thing from a recording: mono float32 in
[-1, 1] at their own sample rate. server.py hands us whatever
``prepare_audio_for_birdnet`` wrote — a PCM WAV — so the stdlib ``wave``
module is enough, with soundfile preferred when it is installed because it
also copes with the float-encoded WAVs some tools emit.
"""

from __future__ import annotations

import logging
import math
import wave

logger = logging.getLogger(__name__)


class AudioUnavailable(RuntimeError):
    """Raised when a recording cannot be decoded into samples."""


def read_mono(path: str):
    """Read an audio file to (mono float32 samples in [-1, 1], sample rate)."""
    import numpy as np

    try:
        import soundfile  # type: ignore

        data, rate = soundfile.read(path, dtype="float32", always_2d=True)
        return np.asarray(data, dtype=np.float32).mean(axis=1), int(rate)
    except ImportError:
        pass

    with wave.open(path, "rb") as handle:
        channels = handle.getnchannels()
        width = handle.getsampwidth()
        rate = handle.getframerate()
        raw = handle.readframes(handle.getnframes())

    dtypes = {1: np.uint8, 2: np.int16, 4: np.int32}
    if width not in dtypes:
        raise AudioUnavailable(f"unsupported WAV sample width: {width * 8} bit")

    samples = np.frombuffer(raw, dtype=dtypes[width]).astype(np.float32)
    if width == 1:
        samples = (samples - 128.0) / 128.0
    else:
        samples /= float(1 << (width * 8 - 1))
    if channels > 1:
        samples = samples.reshape(-1, channels).mean(axis=1)
    return samples, int(rate)


def resample(samples, source_rate: int, target_rate: int):
    """Resample mono audio, preferring quality implementations when installed."""
    import numpy as np

    if source_rate == target_rate or samples.size == 0:
        return samples

    try:
        import soxr  # type: ignore

        return np.asarray(soxr.resample(samples, source_rate, target_rate), dtype=np.float32)
    except ImportError:
        pass

    try:
        from scipy.signal import resample_poly  # type: ignore

        divisor = math.gcd(int(source_rate), int(target_rate))
        return np.asarray(
            resample_poly(samples, target_rate // divisor, source_rate // divisor),
            dtype=np.float32,
        )
    except ImportError:
        pass

    # Last resort: linear interpolation. Audible aliasing is possible, so warn
    # once rather than silently degrading identification quality.
    logger.warning(
        "Resampling %d Hz -> %d Hz by linear interpolation; install soxr or scipy "
        "for a better-quality resampler.", source_rate, target_rate,
    )
    duration = samples.size / float(source_rate)
    target_count = int(round(duration * target_rate))
    if target_count <= 0:
        return np.zeros(0, dtype=np.float32)
    source_x = np.linspace(0.0, duration, num=samples.size, endpoint=False)
    target_x = np.linspace(0.0, duration, num=target_count, endpoint=False)
    return np.interp(target_x, source_x, samples).astype(np.float32)


__all__ = ["AudioUnavailable", "read_mono", "resample"]
