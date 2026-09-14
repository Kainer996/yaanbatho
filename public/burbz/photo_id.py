"""Existing Flask route adapter for the capped Gemini Unix worker."""
from __future__ import annotations
import base64
import ipaddress
import http.client
import json
import math
import os
import re
import socket

MAX_IMAGE_PIXELS = 24_000_000
ANALYSIS_MAX_SIDE = 2560
PHOTO_POLICY = "photo-gemini-v410"
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
            "model": "gemini-vision", "modelName":"gemini-2.5-flash", "retryable":True, "reason": reason,
            "message": message or INCONCLUSIVE}


class _LocalConnection(http.client.HTTPConnection):
    def __init__(self):
        super().__init__("localhost", timeout=45)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(os.environ.get("BURBZ_PHOTO_SOCKET", "/run/burbz-photo/recognizer.sock"))


def _validate_result(result):
    if not isinstance(result, dict) or result.get("policy") != PHOTO_POLICY or result.get("model") != "gemini-vision" or result.get("modelName") != "gemini-2.5-flash":
        return _abstain("invalid-worker-result")
    if result.get("found") is not True:
        # Never pass a species through on any failure, even from the local worker.
        clean=_abstain(str(result.get("reason", "uncertain-species")), result.get("message") if isinstance(result.get("message"), str) else None)
        clean.update(retryable=result.get('retryable') is True,retryAt=result.get('retryAt',0))
        if isinstance(result.get('receiptId'),str) and re.fullmatch(r'[a-f0-9]{64}',result['receiptId']): clean['receiptId']=result['receiptId']
        return clean
    score = result.get("confidence")
    if (result.get("accepted") is not True or result.get("verified") is not True
            or isinstance(score, bool) or not isinstance(score, (int, float))
            or not math.isfinite(score) or not MIN_CONFIDENCE <= score <= 1
            or not isinstance(result.get("receiptId"),str) or not re.fullmatch(r"[a-f0-9]{64}",result["receiptId"])
            or not isinstance(result.get("species"), str) or not result["species"].strip()
            or not isinstance(result.get("scientificName"), str)
            or not re.fullmatch(r"[A-Z][a-z]+ [a-z][a-z-]+", result["scientificName"])):
        return _abstain("invalid-worker-result")
    return {key: result[key] for key in ("found", "accepted", "verified", "policy", "model", "species", "scientificName", "confidence", "modelName", "receiptId")}


def _request_identity():
    # Nginx replaces X-Real-IP on the actual /burbz/api/ route. Direct
    # connections never get to choose their own caller via forwarded headers.
    from flask import request, has_request_context
    if not has_request_context(): raise ValueError('Request context required')
    peer=ipaddress.ip_address(request.remote_addr or '0.0.0.0')
    caller=str(peer)
    if peer.is_loopback:
        try: caller=str(ipaddress.ip_address(request.headers.get('X-Real-IP',caller)))
        except ValueError: pass
    owner=request.form.get('photoOwner',''); request_id=request.form.get('photoRequestId','')
    if not all(re.fullmatch(r'[a-zA-Z0-9_-]{16,96}',v) for v in (owner,request_id)):
        raise ValueError('Photo app update required')
    return owner,request_id,caller


def identify_bird_from_image(path, lat=None, lon=None):
    # Retain the route interface; the worker alone owns billing and egress.
    try: owner,request_id,caller=_request_identity()
    except (ValueError,ImportError):
        return _abstain('photo-update-required','Close and reopen Burbz to update photo identification. Your saved photos will wait.')
    connection = _LocalConnection()
    try:
        with open(path, "rb") as stream:
            data = stream.read(10*1024*1024+1)
        if len(data) > 10*1024*1024:
            return _abstain("invalid-size")
        connection.request("POST", "/identify", body=json.dumps({"image":base64.b64encode(data).decode(),"owner":owner,"requestId":request_id,"caller":caller}), headers={"Content-Type": "application/json"})
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
