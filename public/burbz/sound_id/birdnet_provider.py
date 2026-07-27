"""The original BirdNET path, preserved verbatim behind the provider interface.

This module deliberately contains no recognition logic. BirdNET inference still
lives in server.py exactly as it always has; this only forwards to it, so
BURBZ_SOUND_MODEL=birdnet is byte-for-byte the behaviour Burbz shipped before
the Perch work, and rolling back cannot regress it.

BirdNET's models are CC BY-NC-SA 4.0. This path is fine for development,
research and a non-commercial build, but must not be the active provider in a
monetised release without written permission from Cornell / TU Chemnitz.
See ../LICENSING.md.
"""

from __future__ import annotations

from typing import Any, Callable, Iterable, Optional, Sequence


class BirdNETUnavailable(RuntimeError):
    """Raised when the host server never wired its BirdNET helpers in."""


def analyse(
    audio_path: str,
    *,
    allow: Optional[Iterable[str]] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    week: Optional[int] = None,
    analyse_recording: Optional[Callable[..., Any]] = None,
    aggregate_detections: Optional[Callable[..., Any]] = None,
) -> Sequence[dict]:
    """Run BirdNET via the server's own helpers and aggregate as before.

    ``analyse_recording`` and ``aggregate_detections`` are server.py's
    ``_analyse_recording`` and ``_aggregate_sound_detections``, injected through
    ``sound_id.configure()``. Their signatures are the server's own, so this
    passes location context positionally-free via keywords it is known to
    accept and falls back to the bare call if it does not.
    """
    if analyse_recording is None or aggregate_detections is None:
        raise BirdNETUnavailable(
            "BirdNET helpers were not configured. Call sound_id.configure("
            "birdnet_analyse=_analyse_recording, "
            "birdnet_aggregate=_aggregate_sound_detections) during server start-up."
        )

    try:
        detections = analyse_recording(audio_path, lat=lat, lon=lon, week=week)
    except TypeError:
        # Older signature that takes the path alone.
        detections = analyse_recording(audio_path)

    return aggregate_detections(detections, allow)
