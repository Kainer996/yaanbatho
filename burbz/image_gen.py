"""
image_gen.py — Burbz Bird Art Generator
Generates manga-style bird character art via Google Gemini API.
Register the blueprint in your main server.py:

    from image_gen import image_gen_bp
    app.register_blueprint(image_gen_bp)
"""

import base64
import hashlib
import os
import re
import traceback

from flask import Blueprint, jsonify, request
import google.generativeai as genai

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
GEMINI_API_KEY = os.environ.get("GEMINI_API_KEY", "")
GEMINI_MODEL = "gemini-2.5-flash-image"
CACHE_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "bird-art-cache")

# Ensure the cache directory exists at import time.
os.makedirs(CACHE_DIR, exist_ok=True)

# Configure the SDK once.
genai.configure(api_key=GEMINI_API_KEY)
model = genai.GenerativeModel(GEMINI_MODEL)

# ---------------------------------------------------------------------------
# Blueprint
# ---------------------------------------------------------------------------
image_gen_bp = Blueprint("image_gen", __name__)


def _cache_key(species_name: str, rarity: str) -> str:
    """Return a filesystem-safe, deterministic filename for a given species + rarity."""
    raw = f"{species_name.strip().lower()}|{rarity.strip().lower()}"
    digest = hashlib.sha256(raw.encode()).hexdigest()[:16]
    # Also create a human-readable slug for easier debugging.
    slug = re.sub(r"[^a-z0-9]+", "_", species_name.strip().lower()).strip("_")
    return f"{slug}_{rarity.strip().lower()}_{digest}.png"


def _build_prompt(species_name: str, rarity: str) -> str:
    """Build the image-generation prompt."""
    return (
        f"Generate a manga/anime style character portrait of a {species_name} bird "
        f"as a fierce battle warrior. Dynamic pose, bold colors, dramatic lighting, "
        f"clean lines. The style should be like a collectible card game character — "
        f"powerful and cool. {rarity}-tier character. Square format, white background."
    )


def _extract_image_bytes(response) -> bytes | None:
    """Walk through Gemini response parts and return the first image's raw bytes."""
    try:
        for part in response.candidates[0].content.parts:
            if hasattr(part, "inline_data") and part.inline_data is not None:
                mime = getattr(part.inline_data, "mime_type", "") or ""
                if mime.startswith("image/"):
                    return part.inline_data.data
    except (IndexError, AttributeError):
        pass
    return None


def _placeholder_response(species_name: str, rarity: str, error_msg: str):
    """Return a JSON placeholder when image generation fails."""
    return jsonify({
        "image": None,
        "placeholder": True,
        "species_name": species_name,
        "rarity": rarity,
        "error": error_msg,
    }), 200  # 200 so the client can handle gracefully


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------
@image_gen_bp.route("/api/generate-bird-art", methods=["POST"])
def generate_bird_art():
    """Generate (or serve cached) manga-style bird character art."""

    # ------------------------------------------------------------------
    # 1. Parse & validate input
    # ------------------------------------------------------------------
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body must be JSON"}), 400

    species_name = (data.get("species_name") or "").strip()
    rarity = (data.get("rarity") or "common").strip().lower()

    if not species_name:
        return jsonify({"error": "species_name is required"}), 400

    valid_rarities = {"common", "uncommon", "rare", "epic", "legendary", "mythic"}
    if rarity not in valid_rarities:
        rarity = "common"  # default silently

    # ------------------------------------------------------------------
    # 2. Check cache
    # ------------------------------------------------------------------
    filename = _cache_key(species_name, rarity)
    cache_path = os.path.join(CACHE_DIR, filename)

    if os.path.isfile(cache_path):
        with open(cache_path, "rb") as f:
            img_bytes = f.read()
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        return jsonify({
            "image": f"data:image/png;base64,{b64}",
            "cached": True,
            "species_name": species_name,
            "rarity": rarity,
        })

    # ------------------------------------------------------------------
    # 3. Generate via Gemini
    # ------------------------------------------------------------------
    prompt = _build_prompt(species_name, rarity)

    try:
        response = model.generate_content(
            prompt,
            generation_config={"response_modalities": ["TEXT", "IMAGE"]},
        )
    except Exception as exc:
        traceback.print_exc()
        return _placeholder_response(
            species_name, rarity, f"Gemini API call failed: {exc}"
        )

    # ------------------------------------------------------------------
    # 4. Extract image bytes from the response
    # ------------------------------------------------------------------
    img_bytes = _extract_image_bytes(response)
    if img_bytes is None:
        return _placeholder_response(
            species_name, rarity, "Gemini returned no image data in the response."
        )

    # If the data came back as raw bytes that aren't already PNG-encoded,
    # the SDK typically returns the binary payload directly.  We trust the
    # mime_type from the response.  Save as-is.
    # ------------------------------------------------------------------
    # 5. Save to cache
    # ------------------------------------------------------------------
    try:
        with open(cache_path, "wb") as f:
            f.write(img_bytes if isinstance(img_bytes, bytes) else bytes(img_bytes))
    except Exception as exc:
        # Non-fatal — we can still return the image even if caching fails.
        print(f"[image_gen] Warning: failed to cache image: {exc}")

    # ------------------------------------------------------------------
    # 6. Return base64 JSON
    # ------------------------------------------------------------------
    b64 = base64.b64encode(
        img_bytes if isinstance(img_bytes, bytes) else bytes(img_bytes)
    ).decode("utf-8")

    return jsonify({
        "image": f"data:image/png;base64,{b64}",
        "cached": False,
        "species_name": species_name,
        "rarity": rarity,
    })
