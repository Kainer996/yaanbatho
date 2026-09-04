"""Pluggable sound-recognition providers for the Burbz backend.

Burbz identified birds with BirdNET V2.4 until July 2026. That model's weights
are CC BY-NC-SA 4.0 — NonCommercial — so a monetised release could not ship on
them, and this package originally existed to swap in Perch 2.0 (Apache 2.0).

**BirdNET+ V3.0 resolved that.** Its weights are CC BY-SA 4.0: commercial use
is permitted with attribution. V3 is now the default, and it is both the
licence-clean option and the broader model — 11,560 classes, variable-length
input, and a 12,012-class range model replacing V2.4's built-in filter. Classes
without an exact geo mapping get a stricter acoustic floor. See
../LICENSING.md.

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
from contextvars import ContextVar
from typing import Any, Callable, Iterable, Optional, Sequence

logger = logging.getLogger(__name__)

DEFAULT_PROVIDER = "birdnetv3"

# v347's first promotion copied the package but rolled server.py back after a
# premature cold-start probe. This managed-file revision makes the repaired
# autodeployer run its transactional adapter install/proof once more.
INTERRUPTED_DEPLOY_RECOVERY_REVISION = "v347.1"

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

# Request/task-local provenance. It is cleared both by analyse() and by the
# Flask integration's before_request hook, so malformed uploads and concurrent
# scans can never inherit a previous request's provider.
_served_provider: ContextVar[Optional[str]] = ContextVar(
    "burbz_sound_served_provider", default=None
)
_REQUEST_PROVIDER_KEY = "_burbz_sound_served_provider"

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

    # A few installed servers still carry the embedded v4 adapter. Their
    # root-owned server.py cannot be replaced by the package-only autodeploy,
    # but it does call configure() directly at import time. Recognise only that
    # exact adapter's private globals and give it the current request-local
    # provenance hooks. The canonical server_integration.install() caller has
    # none of these sentinels and therefore remains the sole adapter installer.
    frame = None
    try:
        import inspect

        frame = inspect.currentframe()
        caller_globals = frame.f_back.f_globals if frame and frame.f_back else None
        _maybe_install_legacy_v4_provenance(caller_globals)
    except Exception:
        logger.exception("could not install legacy v4 provenance compatibility")
    finally:
        del frame


def _maybe_install_legacy_v4_provenance(namespace) -> None:
    """Bridge the exact old embedded-v4 bootstrap to current response metadata."""
    if not isinstance(namespace, dict):
        return
    try:
        import sys

        if namespace.get("_burbz_sound_id") is not sys.modules.get(__name__):
            return
        if not callable(namespace.get("_burbz_v2_analyse")):
            return
        if not callable(namespace.get("_burbz_v2_aggregate")):
            return
        app = namespace.get("app")
        if app is None or not callable(getattr(app, "before_request", None)):
            return

        from . import server_integration

        server_integration._install_legacy_v4_provenance(app)
    except Exception:
        # Compatibility metadata must never make an otherwise healthy legacy
        # server fail to import. The canonical installer remains the repair path.
        logger.exception("legacy v4 server provenance hook registration failed")


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
    return raw in {"1", "true", "yes", "on"}


def is_commercial_safe(provider: Optional[str] = None) -> bool:
    """Whether the active engine's weights may be used in a monetised build."""
    return resolve_provider(provider or active_provider()) not in NON_COMMERCIAL_PROVIDERS


def _location_from_request(lat, lon):
    """Fill in a missing location from the upload itself.

    The range filter is only as good as the location it is given, and without
    one an African Thrush is a perfectly good answer for a garden in London.
    Not every server hands lat/lon down to the recogniser — some read them
    later, in the response builder — so when the call did not carry them, take
    them from the form fields the client posts.

    Lives here rather than in the server hook so it ships with the package: a
    box only has to redeploy ``sound_id`` to get it, with no code surgery.
    Anything unexpected (no Flask, no request in flight, junk values) leaves
    the location as it was.
    """
    if lat is not None and lon is not None:
        return lat, lon
    try:
        from flask import request

        source = request.values
        if lat is None:
            raw = source.get("lat")
            lat = float(raw) if raw not in (None, "") else None
        if lon is None:
            raw = source.get("lon")
            lon = float(raw) if raw not in (None, "") else None
    except Exception:
        pass
    return lat, lon


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


def clear_served_provider() -> None:
    """Clear request-local provider provenance before a sound request."""
    _served_provider.set(None)
    try:
        from flask import g, has_request_context

        if has_request_context():
            setattr(g, _REQUEST_PROVIDER_KEY, None)
    except Exception:
        pass


def record_served_provider(provider: str) -> str:
    """Record the recogniser that successfully answered this request."""
    resolved = resolve_provider(provider)
    _served_provider.set(resolved)
    try:
        from flask import g, has_request_context

        if has_request_context():
            setattr(g, _REQUEST_PROVIDER_KEY, resolved)
    except Exception:
        pass
    return resolved


def last_served_provider() -> Optional[str]:
    """Provider that actually answered in this request/task, never configured fallback."""
    # Flask's ``g`` is newly allocated for every request, so an auth/rate-limit
    # before_request hook that short-circuits before our clear hook can never
    # inherit the ContextVar value left by an earlier request on the same
    # worker thread.
    try:
        from flask import g, has_request_context

        if has_request_context():
            return getattr(g, _REQUEST_PROVIDER_KEY, None)
    except Exception:
        pass
    return _served_provider.get()


def served_meta(provider: Optional[str] = None) -> dict:
    """JSON-ready, non-fabricating identity for the engine that served.

    When no recogniser ran successfully, ``provider`` is null and
    ``providerVerified`` is false. In particular, this never substitutes the
    configured provider merely because it was supposed to run.
    """
    configured = active_provider()
    actual = resolve_provider(provider) if provider is not None else last_served_provider()
    meta = {
        "provider": actual,
        "providerLabel": provider_label(actual) if actual is not None else None,
        "configuredProvider": configured,
        "fallbackUsed": bool(actual is not None and actual != configured),
        "commercial": is_commercial_safe(actual) if actual is not None else None,
        "providerVerified": actual is not None,
        "providerVersion": None,
        "modelName": None,
        "modelSha256": None,
        "labelsSha256": None,
        "scoreBlacklistSha256": None,
        "geoModelName": None,
        "geoModelVersion": None,
        "geoModelSha256": None,
        "geoLabelsSha256": None,
        "policyVersion": None,
    }
    if actual == "birdnetv3":
        try:
            from . import birdnet_v3_provider

            model = birdnet_v3_provider.model_meta()
            geo = birdnet_v3_provider.geo_model_meta()
            meta.update({
                "providerVersion": model.get("version"),
                "modelName": model.get("name"),
                "modelSha256": model.get("modelSha256"),
                "labelsSha256": model.get("labelsSha256"),
                "scoreBlacklistSha256": model.get("scoreBlacklistSha256"),
                "geoModelName": geo.get("name"),
                "geoModelVersion": geo.get("version"),
                "geoModelSha256": geo.get("modelSha256"),
                "geoLabelsSha256": geo.get("labelsSha256"),
                "policyVersion": model.get("policyVersion"),
            })
            meta["providerVerified"] = all((
                model.get("modelSha256") == birdnet_v3_provider.ONNX_SHA256,
                model.get("labelsSha256") == birdnet_v3_provider.LABELS_SHA256,
                model.get("scoreBlacklistSha256")
                == birdnet_v3_provider.SCORE_BLACKLIST_SHA256,
                model.get("policyVersion")
                == birdnet_v3_provider.DECISION_POLICY_VERSION,
                geo.get("modelSha256") == birdnet_v3_provider.GEO_ONNX_SHA256,
                geo.get("labelsSha256") == birdnet_v3_provider.GEO_LABELS_SHA256,
            ))
        except Exception:
            logger.exception("could not attach BirdNET V3 model provenance")
            meta["providerVerified"] = False
    elif actual == "perch":
        meta["providerVersion"] = "2.0"
        meta["modelName"] = "Perch 2.0"
    elif actual == "birdnetv2":
        meta["providerVersion"] = "2.4"
        meta["modelName"] = "BirdNET V2.4"
    return meta


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

    Failures are surfaced by default so a missing model cannot silently change
    the recogniser that serves production. Set
    ``BURBZ_SOUND_MODEL_FALLBACK=1`` only when an explicit licence-clean
    fallback is wanted.
    """
    clear_served_provider()
    lat, lon = _location_from_request(lat, lon)
    provider = active_provider()
    chain = (provider, *_FALLBACK_CHAIN.get(provider, ()))

    for position, candidate in enumerate(chain):
        try:
            results = _run(candidate, audio_path, allow, lat, lon, week)
            record_served_provider(candidate)
            _announce(candidate)
            return results
        except Exception:
            if not fallback_enabled():
                raise
            remaining = chain[position + 1:]
            logger.exception(
                "%s analysis failed%s. BURBZ_SOUND_MODEL_FALLBACK must be "
                "explicitly enabled to use another recogniser.",
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
    "clear_served_provider",
    "configure",
    "fallback_enabled",
    "is_commercial_safe",
    "last_served_provider",
    "provider_label",
    "record_served_provider",
    "resolve_provider",
    "served_meta",
]
