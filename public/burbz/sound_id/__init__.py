"""Pluggable sound-recognition providers for the Burbz backend.

Burbz identified birds with BirdNET until July 2026. BirdNET's *model weights*
are CC BY-NC-SA 4.0 — non-commercial — so a monetised release cannot ship on
them. Perch 2.0 (Google) is Apache 2.0 including the weights, so it can.

This package does not remove BirdNET. It puts both recognisers behind one
interface and picks between them at runtime:

    BURBZ_SOUND_MODEL=birdnet   (default — unchanged behaviour)
    BURBZ_SOUND_MODEL=perch     (Perch 2.0 via ONNX Runtime, no TensorFlow)

Rolling back is unsetting one environment variable and restarting. If Perch
fails to load or throws mid-request, the call falls back to BirdNET rather
than failing the scan (disable with BURBZ_SOUND_MODEL_FALLBACK=0).

Both providers return the same shape — the one ``_aggregate_sound_detections``
already produces, so everything downstream in server.py is untouched:

    [{"common_name": str, "scientific_name": str,
      "max": float, "mean": float, "n": int, "is_local": bool}, ...]

See README.md in this directory for the server.py hook.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable, Iterable, Optional, Sequence

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "birdnet"
_VALID_PROVIDERS = ("birdnet", "perch")

# Callables injected by server.py so this package never has to import it
# (which would be circular) and so the tests can run without the backend.
_birdnet_analyse: Optional[Callable[..., Any]] = None
_birdnet_aggregate: Optional[Callable[..., Any]] = None
_common_name_for: Optional[Callable[[str], Optional[str]]] = None


def configure(
    *,
    birdnet_analyse: Optional[Callable[..., Any]] = None,
    birdnet_aggregate: Optional[Callable[..., Any]] = None,
    common_name_for: Optional[Callable[[str], Optional[str]]] = None,
) -> None:
    """Wire the package to the host server's existing helpers.

    Args:
        birdnet_analyse: server's ``_analyse_recording`` — unchanged BirdNET path.
        birdnet_aggregate: server's ``_aggregate_sound_detections``.
        common_name_for: maps a scientific name to the catalogue's common name.
            Perch only predicts binomials, so without this the common name
            falls back to the scientific name (``_catalog_lookup`` accepts
            either, so lookups still resolve).
    """
    global _birdnet_analyse, _birdnet_aggregate, _common_name_for
    if birdnet_analyse is not None:
        _birdnet_analyse = birdnet_analyse
    if birdnet_aggregate is not None:
        _birdnet_aggregate = birdnet_aggregate
    if common_name_for is not None:
        _common_name_for = common_name_for


def active_provider() -> str:
    """The provider named by BURBZ_SOUND_MODEL, defaulting to BirdNET.

    An unrecognised value is logged and treated as the default rather than
    raising — a typo in a systemd unit should not take sound scanning down.
    """
    raw = (os.environ.get("BURBZ_SOUND_MODEL") or "").strip().lower()
    if not raw:
        return DEFAULT_PROVIDER
    if raw not in _VALID_PROVIDERS:
        logger.warning(
            "BURBZ_SOUND_MODEL=%r is not one of %s — falling back to %s",
            raw, ", ".join(_VALID_PROVIDERS), DEFAULT_PROVIDER,
        )
        return DEFAULT_PROVIDER
    return raw


def fallback_enabled() -> bool:
    raw = (os.environ.get("BURBZ_SOUND_MODEL_FALLBACK") or "").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def analyse(
    audio_path: str,
    *,
    allow: Optional[Iterable[str]] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    week: Optional[int] = None,
) -> Sequence[dict]:
    """Identify species in a prepared recording using the active provider.

    ``audio_path`` is whatever ``prepare_audio_for_birdnet`` returned — a mono
    WAV on disk. Perch resamples it to 32 kHz itself, so the existing audio
    preparation stays as it is.
    """
    provider = active_provider()

    if provider == "perch":
        try:
            from . import perch_provider

            return perch_provider.analyse(
                audio_path, allow=allow, lat=lat, lon=lon, week=week,
                common_name_for=_common_name_for,
            )
        except Exception:
            if not fallback_enabled():
                raise
            logger.exception(
                "Perch analysis failed — falling back to BirdNET for this request. "
                "Set BURBZ_SOUND_MODEL_FALLBACK=0 to surface the error instead."
            )

    return _analyse_with_birdnet(audio_path, allow=allow, lat=lat, lon=lon, week=week)


def _analyse_with_birdnet(
    audio_path: str,
    *,
    allow: Optional[Iterable[str]] = None,
    lat: Optional[float] = None,
    lon: Optional[float] = None,
    week: Optional[int] = None,
) -> Sequence[dict]:
    """The original BirdNET path, delegated back to server.py untouched."""
    from . import birdnet_provider

    return birdnet_provider.analyse(
        audio_path,
        allow=allow,
        lat=lat,
        lon=lon,
        week=week,
        analyse_recording=_birdnet_analyse,
        aggregate_detections=_birdnet_aggregate,
    )


def provider_label(provider: Optional[str] = None) -> str:
    """Human-readable engine name for the client's "<engine> match: …" copy."""
    key = (provider or active_provider()).strip().lower()
    return {"birdnet": "BirdNET", "perch": "Perch"}.get(key, "BirdNET")


__all__ = [
    "DEFAULT_PROVIDER",
    "active_provider",
    "analyse",
    "configure",
    "fallback_enabled",
    "provider_label",
]
