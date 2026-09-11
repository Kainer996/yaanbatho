"""Camera adapter for the local photo worker. Never calls a paid provider.

The model runs separately so its dependencies and CPU use cannot disturb BirdNET.
"""
from __future__ import annotations
import http.client
import json
import math
import os
import re
import socket

MAX_IMAGE_PIXELS = 24_000_000
ANALYSIS_MAX_SIDE = 2560
PHOTO_POLICY = "photo-local-v393"
MIN_CONFIDENCE = .90
INCONCLUSIVE = "Bird not found. We couldn’t confirm the species. Try a closer, clearer view of the bird."

def normalise_image_file(source_path: str, dest_path: str) -> None:
    """Validate an uploaded image, strip EXIF, and save a bounded RGB JPEG."""
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:  # pragma: no cover - environment guard
        raise ValueError("Photo recognition needs Pillow installed to read images safely.") from exc

    try:
        with Image.open(source_path) as img:
            img.verify()
        with Image.open(source_path) as img:
            width, height = img.size
            if width <= 0 or height <= 0:
                raise ValueError("That image could not be read — try another camera capture.")
            if width * height > MAX_IMAGE_PIXELS:
                raise ValueError("That image is too large — try another live capture.")
            img = ImageOps.exif_transpose(img).convert("RGB")
            img.thumbnail((ANALYSIS_MAX_SIDE, ANALYSIS_MAX_SIDE))
            img.save(dest_path, format="JPEG", quality=90, optimize=True)
    except ValueError:
        raise
    except Exception as exc:
        raise ValueError("That image could not be read — try another camera capture.") from exc

def _abstain(reason, message=None):
    return {"found": False, "accepted": False, "verified": False, "policy": PHOTO_POLICY,
            "model": "bioclip2-birder-local", "reason": reason,
            "message": message or INCONCLUSIVE}


class _LocalConnection(http.client.HTTPConnection):
    def __init__(self):
        super().__init__("localhost", timeout=35)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(os.environ.get("BURBZ_PHOTO_SOCKET", "/run/burbz-photo/recognizer.sock"))


def _validate_result(result):
    if not isinstance(result, dict) or result.get("policy") != PHOTO_POLICY or result.get("model") != "bioclip2-birder-local":
        return _abstain("invalid-worker-result")
    if result.get("found") is not True:
        # Never pass a species through on any failure, even from the local worker.
        return _abstain(str(result.get("reason", "uncertain-species")), result.get("message") if isinstance(result.get("message"), str) else None)
    score = result.get("confidence")
    if (result.get("accepted") is not True or result.get("verified") is not True
            or isinstance(score, bool) or not isinstance(score, (int, float))
            or not math.isfinite(score) or not MIN_CONFIDENCE <= score <= 1
            or not isinstance(result.get("species"), str) or not result["species"].strip()
            or not isinstance(result.get("scientificName"), str)
            or not re.fullmatch(r"[A-Z][a-z]+ [a-z][a-z-]+", result["scientificName"])):
        return _abstain("invalid-worker-result")
    return {key: result[key] for key in ("found", "accepted", "verified", "policy", "model", "species", "scientificName", "confidence")}


def identify_bird_from_image(path, lat=None, lon=None):
    # Retain the server interface; geography never changes an uncertain identity.
    # Old BURBZ_PHOTO_MODEL/GEMINI_API_KEY settings cannot activate a paid fallback.
    connection = _LocalConnection()
    try:
        with open(path, "rb") as stream:
            data = stream.read(10*1024*1024+1)
        if len(data) > 10*1024*1024:
            return _abstain("invalid-size")
        connection.request("POST", "/identify", body=data, headers={"Content-Type": "image/jpeg"})
        response = connection.getresponse()
        body = response.read(16385)
        if len(body) > 16384:
            return _abstain("invalid-worker-result")
        if response.status != 200:
            return _abstain("photo-busy" if response.status == 503 else "photo-unavailable",
                            "Photo checking is busy. Please try again shortly." if response.status == 503 else "Photo checking is unavailable. Please try again shortly.")
        return _validate_result(json.loads(body))
    except (OSError, ValueError, http.client.HTTPException):
        return _abstain("photo-unavailable", "Photo checking is temporarily unavailable. Please try again shortly. Your photo has not been rejected.")
    finally:
        connection.close()
