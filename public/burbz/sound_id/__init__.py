"""Pluggable sound-recognition providers for the Burbz backend.

Burbz identified birds with BirdNET V2.4 until July 2026. That model's weights
are CC BY-NC-SA 4.0 — NonCommercial — so a monetised release could not ship on
them, and this package originally existed to swap in Perch 2.0 (Apache 2.0).

**BirdNET+ V3.0 resolved that.** Its weights are CC BY-SA 4.0: commercial use
is permitted with attribution. V3 is now the default, and it is both the
licence-clean option and the better model — 11,560 classes against 6,000, a
variable-length input, and a 12,012-species range filter replacing V2.4's
built-in one. See ../LICENSING.md.

    BURBZ_SOUND_MODEL=birdnetv3   (default — BirdNET V3, CC BY-SA 4.0)
    BURBZ_SOUND_MODEL=perch       (Perch 2.0 via ONNX Runtime, Apache 2.0)
    BURBZ_SOUND_MODEL=birdnetv2   (legacy BirdNET V2.4 — NON-COMMERCIAL)

Note that a bare ``birdnet`` means V3. Selecting the non-commercial V2.4 path
takes the explicit ``birdnetv2``, and nothing selects it automatically: if V3
fails mid-request the call falls back to Perch, never to V2.4. Falling back to
a NonCommercial model in a monetised build would be a licensing incident that
looked, from the outside, exactly like everything working.

Every provider returns the same shape — the one
``_aggregate_sound_detections`` already produces, so everything downstream in
server.py is untouched::

    [{"common_name": str, "scientific_name": str,
      "max": float, "mean": float, "n": int, "is_local": bool}, ...]

See README.md in this directory for the server.py hook.
"""

from __future__ import annotations

import logging
import os
from typing import Any, Callable, Iterable, Optional, Sequence

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "birdnetv3"

# Legacy BirdNET V2.4. Kept so a rollback is possible and so research builds
# can still use it, but it is never selected by default or by fallback.
NON_COMMERCIAL_PROVIDERS = frozenset({"birdnetv2"})

_ALIASES = {
    "birdnet": "birdnetv3",
    "birdnetv3": "birdnetv3",
    "birdnet-v3": "birdnetv3",
    "birdnet_v3": "birdnetv3",
    "birdnet3": "birdnetv3",
    "v3": "birdnetv3",
    "birdnetv2": "birdnetv2",
    "birdnet-v2": "birdnetv2",
    "birdnet_v2": "birdnetv2",
    "birdnet2": "birdnetv2",
    "v2": "birdnetv2",
    "perch": "perch",
    "perch2": "perch",
}

# Where each provider turns when it fails mid-request. Only licence-clean
# engines appear as fallback targets.
_FALLBACK_CHAIN = {
    "birdnetv3": ("perch",),
    "perch": ("birdnetv3",),
    "birdnetv2": (),
}

_LABELS = {"birdnetv3": "BirdNET", "birdnetv2": "BirdNET", "perch": "Perch"}

# Set once a scan has actually been served, so the announcement below is made
# from a request that really happened rather than from start-up.
_announced = False

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
        birdnet_analyse: server's ``_analyse_recording`` — the legacy V2.4 path.
        birdnet_aggregate: server's ``_aggregate_sound_detections``.
        common_name_for: maps a scientific name to the catalogue's common name.
            V3 predicts a common name itself, but the catalogue's own wording
            is preferred where it has one, so the match toast reads the same as
            the rest of the game ("Common Blackbird", not "Eurasian Blackbird").
    """
    global _birdnet_analyse, _birdnet_aggregate, _common_name_for
    if birdnet_analyse is not None:
        _birdnet_analyse = birdnet_analyse
    if birdnet_aggregate is not None:
        _birdnet_aggregate = birdnet_aggregate
    if common_name_for is not None:
        _common_name_for = common_name_for


def resolve_provider(raw: Optional[str]) -> str:
    """Canonical provider key for a BURBZ_SOUND_MODEL value.

    An unrecognised value is logged and treated as the default rather than
    raising — a typo in a systemd unit should not take sound scanning down.
    """
    key = (raw or "").strip().lower()
    if not key:
        return DEFAULT_PROVIDER
    resolved = _ALIASES.get(key)
    if resolved is None:
        logger.warning(
            "BURBZ_SOUND_MODEL=%r is not recognised — falling back to %s. "
            "Valid values: %s",
            raw, DEFAULT_PROVIDER, ", ".join(sorted(set(_ALIASES.values()))),
        )
        return DEFAULT_PROVIDER
    return resolved


def active_provider() -> str:
    """The provider named by BURBZ_SOUND_MODEL, defaulting to BirdNET V3."""
    return resolve_provider(os.environ.get("BURBZ_SOUND_MODEL"))


def fallback_enabled() -> bool:
    raw = (os.environ.get("BURBZ_SOUND_MODEL_FALLBACK") or "").strip().lower()
    return raw not in {"0", "false", "no", "off"}


def is_commercial_safe(provider: Optional[str] = None) -> bool:
    """Whether the active engine's weights may be used in a monetised build."""
    return resolve_provider(provider or active_provider()) not in NON_COMMERCIAL_PROVIDERS


def _from_request(field, cast):
    """Read one form field the client posted, or None.

    Not every server hands the range filter's inputs down to the recogniser —
    some read them later, in the response builder — so when the call did not
    carry one, take it from the upload itself.

    Lives here rather than in the server hook so it ships with the package: a
    box only has to redeploy ``sound_id`` to get it, with no code surgery.
    Anything unexpected (no Flask, no request in flight, junk values) reads as
    absent, which every caller already handles.
    """
    try:
        from flask import request

        raw = request.values.get(field)
        return cast(raw) if raw not in (None, "") else None
    except Exception:
        return None


def _location_from_request(lat, lon):
    """Fill in a missing location from the upload.

    The range filter is only as good as the location it is given, and without
    one an African Thrush is a perfectly good answer for a garden in London.
    """
    if lat is None:
        lat = _from_request("lat", float)
    if lon is None:
        lon = _from_request("lon", float)
    return lat, lon


def _week_from_request(week):
    """Fill in a missing week of the year from the upload.

    Half the range filter's job is seasonal: a Swift is a fine answer for a
    London garden in June and an impossible one in January. The client posts the
    week its own device clock says it is, which beats the server's clock — the
    box may be in another timezone, or another day.
    """
    return week if week is not None else _from_request("week", lambda raw: int(float(raw)))


def _announce(provider: str) -> None:
    """Record, once per process, which engine actually served a scan.

    Which model is *installed* and which model *answers a request* are
    different questions, and only the second one decides whether the game can
    be sold — V2.4's weights are NonCommercial. Logged at WARNING so it
    survives a default production log level, because a line nobody can see is
    no use as evidence.
    """
    global _announced
    if _announced:
        return
    _announced = True
    logger.warning(
        "Burbz sound scan served by %s — weights %s for commercial use",
        provider,
        "ARE licensed" if is_commercial_safe(provider) else "are NOT licensed",
    )


def _run(provider: str, audio_path: str, allow, lat, lon, week) -> Sequence[dict]:
    if provider == "birdnetv3":
        from . import birdnet_v3_provider

        return birdnet_v3_provider.analyse(
            audio_path, allow=allow, lat=lat, lon=lon, week=week,
            common_name_for=_common_name_for,
        )

    if provider == "perch":
        from . import perch_provider

        return perch_provider.analyse(
            audio_path, allow=allow, lat=lat, lon=lon, week=week,
            common_name_for=_common_name_for,
        )

    from . import birdnet_provider

    return birdnet_provider.analyse(
        audio_path, allow=allow, lat=lat, lon=lon, week=week,
        analyse_recording=_birdnet_analyse,
        aggregate_detections=_birdnet_aggregate,
    )


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
    WAV on disk. The providers resample it themselves, so the existing audio
    preparation stays as it is.

    If the chosen engine fails, the call falls back to the next licence-clean
    engine rather than failing the player's scan. Set
    ``BURBZ_SOUND_MODEL_FALLBACK=0`` to surface the error instead — worth doing
    while testing, so a broken install is loud rather than quietly served by
    the other model.
    """
    lat, lon = _location_from_request(lat, lon)
    week = _week_from_request(week)
    provider = active_provider()
    chain = (provider, *_FALLBACK_CHAIN.get(provider, ()))

    for position, candidate in enumerate(chain):
        try:
            results = _run(candidate, audio_path, allow, lat, lon, week)
            _announce(candidate)
            return results
        except Exception:
            if not fallback_enabled():
                raise
            remaining = chain[position + 1:]
            logger.exception(
                "%s analysis failed%s. Set BURBZ_SOUND_MODEL_FALLBACK=0 to "
                "surface the error instead.",
                candidate,
                f" — falling back to {remaining[0]} for this request"
                if remaining else ", and no fallback engine is left",
            )

    return []


def provider_label(provider: Optional[str] = None) -> str:
    """Human-readable engine name for the client's "<engine> match: …" copy.

    Both BirdNET generations are just "BirdNET" to a player — the version is an
    operational detail, and the ``provider`` field carries it for the logs.
    """
    return _LABELS.get(resolve_provider(provider or active_provider()), "BirdNET")


__all__ = [
    "DEFAULT_PROVIDER",
    "NON_COMMERCIAL_PROVIDERS",
    "active_provider",
    "analyse",
    "configure",
    "fallback_enabled",
    "is_commercial_safe",
    "provider_label",
    "resolve_provider",
]
