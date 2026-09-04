"""Install BirdNET V3 into the live Flask server without editing its handler.

Two Burbz backend contracts have existed:

``direct``
    ``identify_sound`` consumes the raw dictionaries returned by
    ``_analyse_recording`` directly.

``aggregate``
    The handler passes ``_analyse_recording`` output through
    ``_aggregate_sound_detections``.

The old installer assumed only the second form. The versioned production
snapshot is the first, so that hook could silently disable itself while the
legacy recogniser kept serving. This module implements both contracts and is
unit-testable independently of the deployment script.
"""

from __future__ import annotations

import functools
import inspect
import json
import logging
import os
from dataclasses import dataclass
from typing import Any, MutableMapping, Optional, Tuple

from . import (
    active_provider,
    analyse,
    clear_served_provider,
    configure,
    record_served_provider,
    served_meta,
)

INTEGRATION_VERSION = 4
_STATE_KEY = "_burbz_sound_id_integration"
_PROVENANCE_STATE_ATTR = "_burbz_sound_id_provenance_v4"

logger = logging.getLogger(__name__)


class ServerIntegrationError(RuntimeError):
    """The live server does not expose a supported sound-handler contract."""


def _legacy_v2_allowed() -> bool:
    return (os.environ.get("BURBZ_ALLOW_NONCOMMERCIAL_V2") or "").strip().lower() in {
        "1", "true", "yes", "on",
    }


def _require_legacy_v2_opt_in() -> None:
    if active_provider() == "birdnetv2" and not _legacy_v2_allowed():
        raise ServerIntegrationError(
            "BirdNET V2.4 is NonCommercial and disabled in production; "
            "research-only use requires BURBZ_ALLOW_NONCOMMERCIAL_V2=1"
        )


def _location_from_request(lat, lon) -> Tuple[Optional[float], Optional[float]]:
    if lat is not None and lon is not None:
        return lat, lon
    try:
        from flask import request

        if lat is None:
            raw = request.values.get("lat")
            lat = float(raw) if raw not in (None, "") else None
        if lon is None:
            raw = request.values.get("lon")
            lon = float(raw) if raw not in (None, "") else None
    except Exception:
        pass
    return lat, lon


def _call_context(original, audio_path, args, kwargs):
    """Extract coordinates without assuming a particular helper signature."""
    values = {}
    try:
        bound = inspect.signature(original).bind_partial(audio_path, *args, **kwargs)
        values = bound.arguments
    except (TypeError, ValueError):
        values = dict(kwargs)
    lat = values.get("lat", kwargs.get("lat"))
    lon = values.get("lon", kwargs.get("lon"))
    week = values.get("week", values.get("week_48", kwargs.get("week")))
    lat, lon = _location_from_request(lat, lon)
    return lat, lon, week


def _common_name_resolver(namespace):
    lookup = namespace.get("_catalog_lookup")
    if not callable(lookup):
        return None

    def resolve(scientific):
        try:
            entry = lookup(scientific)
        except Exception:
            logger.exception("Burbz catalogue lookup failed for %r", scientific)
            return None
        if not entry:
            return None
        if isinstance(entry, dict):
            return entry.get("common_name") or entry.get("name")
        return getattr(entry, "common_name", None) or getattr(entry, "name", None)

    return resolve


def _direct_cache():
    """A request-local cache for the legacy handler's low-threshold retry."""
    try:
        from flask import g, has_request_context

        if not has_request_context():
            return None
        cache = getattr(g, "_burbz_sound_id_direct_cache", None)
        if cache is None:
            cache = {}
            g._burbz_sound_id_direct_cache = cache
        return cache
    except Exception:
        return None


def _as_direct_detection(result: dict) -> dict:
    return {
        "scientific_name": result["scientific_name"],
        "common_name": result["common_name"],
        "confidence": float(result.get("max", 0.0)),
        "mean": float(result.get("mean", result.get("max", 0.0))),
        "n": int(result.get("n", 1)),
        "is_local": bool(result.get("is_local", True)),
    }


@dataclass(frozen=True)
class _Recording:
    path: str
    lat: Optional[float]
    lon: Optional[float]
    week: Optional[int]


def _install_direct(namespace, original_analyse):
    @functools.wraps(original_analyse)
    def wrapped(audio_path, *args, **kwargs):
        # The non-commercial legacy path is explicit only. Preserve its exact
        # helper arguments and two-pass behaviour for research/rollback builds.
        if active_provider() == "birdnetv2":
            _require_legacy_v2_opt_in()
            result = original_analyse(audio_path, *args, **kwargs)
            record_served_provider("birdnetv2")
            return result

        lat, lon, week = _call_context(original_analyse, audio_path, args, kwargs)
        key = (str(audio_path), lat, lon, week, active_provider())
        cache = _direct_cache()
        if cache is not None and key in cache:
            return list(cache[key])

        accepted = analyse(str(audio_path), lat=lat, lon=lon, week=week)
        converted = [_as_direct_detection(item) for item in accepted]
        if cache is not None:
            cache[key] = tuple(converted)
        return list(converted)

    namespace["_analyse_recording"] = wrapped
    return wrapped


def _install_aggregate(namespace, original_analyse, original_aggregate):
    @functools.wraps(original_analyse)
    def wrapped_analyse(audio_path, *args, **kwargs):
        if active_provider() == "birdnetv2":
            _require_legacy_v2_opt_in()
            result = original_analyse(audio_path, *args, **kwargs)
            record_served_provider("birdnetv2")
            return result
        lat, lon, week = _call_context(original_analyse, audio_path, args, kwargs)
        return _Recording(str(audio_path), lat, lon, week)

    @functools.wraps(original_aggregate)
    def wrapped_aggregate(detections, allow=None, *args, **kwargs):
        if isinstance(detections, _Recording):
            return analyse(
                detections.path,
                allow=allow,
                lat=detections.lat,
                lon=detections.lon,
                week=detections.week,
            )
        return original_aggregate(detections, allow, *args, **kwargs)

    namespace["_analyse_recording"] = wrapped_analyse
    namespace["_aggregate_sound_detections"] = wrapped_aggregate
    return wrapped_analyse, wrapped_aggregate


def _install_species_mapping_guard(namespace):
    """Keep incomplete game-catalogue rows from discarding valid model names.

    Some national-completion profiles have a common name but no scientific
    name. The legacy response mapper preferred that blank catalogue field over
    BirdNET's valid scientific name and then hashed ``None``, turning an
    accepted detection into HTTP 500. Supply only the missing catalogue fields
    from the detection; complete catalogue rows retain their existing values.
    """
    original = namespace.get("_species_to_game_bird")
    if not callable(original):
        return None

    @functools.wraps(original)
    def wrapped(scientific_name, common_name, confidence, catalog_entry):
        detected_scientific = str(scientific_name or "").strip()
        detected_common = str(common_name or "").strip()
        safe_scientific = detected_scientific or detected_common or "Unknown bird"
        safe_common = detected_common or detected_scientific or "Unknown bird"
        safe_entry = catalog_entry
        if isinstance(catalog_entry, dict):
            catalogue_scientific = str(catalog_entry.get("latin_name") or "").strip()
            catalogue_common = str(catalog_entry.get("common_name") or "").strip()
            if not catalogue_scientific or not catalogue_common:
                safe_entry = dict(catalog_entry)
                safe_entry["latin_name"] = catalogue_scientific or safe_scientific
                safe_entry["common_name"] = catalogue_common or safe_common
        return original(
            safe_scientific, safe_common, confidence, safe_entry
        )

    namespace["_species_to_game_bird"] = wrapped
    return wrapped


def _install_response_provenance(app) -> dict:
    """Attach the provider that actually served, including failed/empty scans."""
    from flask import request

    previous = getattr(app, _PROVENANCE_STATE_ATTR, None)
    if isinstance(previous, dict) and previous.get("version") == INTEGRATION_VERSION:
        return previous

    def is_sound_request():
        return request.path.rstrip("/").endswith("/identify/sound")

    def clear_sound_provider():
        if is_sound_request():
            clear_served_provider()

    def tag_sound_provider(response):
        if not is_sound_request() or response.mimetype != "application/json":
            return response
        try:
            payload = response.get_json(silent=True)
            if not isinstance(payload, dict):
                return response
            payload.update(served_meta())
            payload["serverIntegrationVersion"] = INTEGRATION_VERSION
            response.set_data(json.dumps(payload, separators=(",", ":"), sort_keys=True))
        except Exception:
            logger.exception("could not attach sound provider provenance")
        return response

    # Flask accepts callables directly; fixed endpoint names are not involved.
    app.before_request(clear_sound_provider)
    hooks = getattr(app, "before_request_funcs", {}).get(None, [])
    if hooks and hooks[-1] is clear_sound_provider:
        hooks.insert(0, hooks.pop())
    app.after_request(tag_sound_provider)
    state = {
        "version": INTEGRATION_VERSION,
        "before": clear_sound_provider,
        "after": tag_sound_provider,
    }
    setattr(app, _PROVENANCE_STATE_ATTR, state)
    return state


def _install_legacy_v4_provenance(app) -> dict:
    """Upgrade response metadata for the old embedded-v4 adapter in place.

    This intentionally installs no analysis wrappers. The embedded adapter
    already routes through :func:`sound_id.analyse`; package-only deployments
    merely need the current request-local clear/tag hooks until the canonical
    AST patcher can replace that root-owned block.
    """
    if app is None or not callable(getattr(app, "before_request", None)):
        raise ServerIntegrationError("legacy v4 namespace has no Flask app")
    return _install_response_provenance(app)


def install(namespace: MutableMapping[str, Any], *, mode: str) -> dict:
    """Install the selected server adapter and response provenance hooks.

    Args:
        namespace: normally ``globals()`` from the live ``server.py``.
        mode: ``"direct"`` or ``"aggregate"``. The installer derives this by
            inspecting the actual ``identify/sound`` handler and writes it into
            the small bootstrap, so a dead helper cannot select the wrong mode.
    """
    previous = namespace.get(_STATE_KEY)
    if isinstance(previous, dict) and previous.get("version") == INTEGRATION_VERSION:
        if previous.get("mode") != mode:
            raise ServerIntegrationError(
                f"integration already installed in {previous.get('mode')!r} "
                f"mode, not requested {mode!r}"
            )
        return previous
    if mode not in {"direct", "aggregate"}:
        raise ServerIntegrationError(f"unsupported sound integration mode {mode!r}")
    _require_legacy_v2_opt_in()

    app = namespace.get("app")
    original_analyse = namespace.get("_analyse_recording")
    original_aggregate = namespace.get("_aggregate_sound_detections")
    if app is None or not callable(getattr(app, "before_request", None)):
        raise ServerIntegrationError("server namespace has no Flask app")
    if not callable(original_analyse):
        raise ServerIntegrationError("server namespace has no _analyse_recording helper")
    if mode == "aggregate" and not callable(original_aggregate):
        raise ServerIntegrationError(
            "aggregate mode requires _aggregate_sound_detections"
        )

    configure(
        birdnet_analyse=original_analyse,
        birdnet_aggregate=original_aggregate if callable(original_aggregate) else None,
        common_name_for=_common_name_resolver(namespace),
    )
    if mode == "direct":
        wrappers = (_install_direct(namespace, original_analyse),)
    else:
        wrappers = _install_aggregate(namespace, original_analyse, original_aggregate)
    species_mapping_guard = _install_species_mapping_guard(namespace)
    if species_mapping_guard is not None:
        wrappers = (*wrappers, species_mapping_guard)
    _install_response_provenance(app)

    state = {
        "version": INTEGRATION_VERSION,
        "mode": mode,
        "wrappers": wrappers,
    }
    namespace[_STATE_KEY] = state
    logger.warning(
        "Burbz BirdNET V3 server integration v%d installed (%s mode)",
        INTEGRATION_VERSION,
        mode,
    )
    return state


__all__ = [
    "INTEGRATION_VERSION",
    "ServerIntegrationError",
    "install",
]
