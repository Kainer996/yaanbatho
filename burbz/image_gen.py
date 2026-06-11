"""
image_gen.py — Burbz Bird Art Generator (local Stable Diffusion 1.5)

Uses a separate Python venv (/home/ubuntu/image-gen/venv) for torch+diffusers,
invoked via subprocess so we don't pollute burbz's TensorFlow/birdnetlib env.

POST /api/generate-bird-art {species, rarity}
  - if cached → 200 {imageUrl: "/bird-art-cache/<file>.png", cached: true}
  - else      → 202 {imageUrl: null, queued: true, pending: true}
                (background worker generates; client polls again later)

Generated PNGs land in burbz/bird-art-cache/, served as static by Flask.
"""
import hashlib
import os
import re
import subprocess
import threading
import time
import traceback
from queue import Queue

from flask import Blueprint, jsonify, request

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE_DIR = os.path.join(HERE, "bird-art-cache")
GEN_PYTHON = "/home/ubuntu/image-gen/venv/bin/python"
GEN_SCRIPT = "/home/ubuntu/image-gen/burbz_render.py"
os.makedirs(CACHE_DIR, exist_ok=True)

image_gen_bp = Blueprint("image_gen", __name__)


def _slug(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.strip().lower()).strip("_") or "bird"


def _cache_filename(species: str, rarity: str) -> str:
    # Cache keyed by species only — same bird looks the same regardless of rarity
    # roll. Avoids re-rendering on every roll (4 min/render on CPU is precious).
    digest = hashlib.sha256(species.strip().lower().encode()).hexdigest()[:12]
    return f"{_slug(species)}_{digest}.png"


def _public_url(filename: str) -> str:
    # Use a relative URL so it works whether the app is served at the
    # site root (Flask dev) or under a subpath (e.g. /burbz/ via nginx).
    return f"bird-art-cache/{filename}"


# Background worker — one job at a time (CPU is the bottleneck)
_job_queue: "Queue[tuple[str,str]]" = Queue()
_in_flight: set = set()
_in_flight_lock = threading.Lock()


def _run_gen(species: str, rarity: str, out_path: str):
    cmd = [GEN_PYTHON, GEN_SCRIPT, species, rarity, out_path]
    print(f"[image_gen] start: {species} ({rarity})")
    t0 = time.time()
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900)
    if proc.returncode != 0:
        print(f"[image_gen] FAIL {species}: {proc.stderr[-500:]}")
        return False
    print(f"[image_gen] done {os.path.basename(out_path)} in {time.time()-t0:.0f}s")
    return True


def _worker():
    while True:
        species, rarity = _job_queue.get()
        out = os.path.join(CACHE_DIR, _cache_filename(species, rarity))
        try:
            if not os.path.exists(out):
                _run_gen(species, rarity, out)
        except Exception:
            print(f"[image_gen] worker error: {traceback.format_exc()}")
        finally:
            with _in_flight_lock:
                _in_flight.discard((species, rarity))
            _job_queue.task_done()


threading.Thread(target=_worker, daemon=True, name="bird-art-worker").start()


def _enqueue(species: str, rarity: str) -> bool:
    key = (species, rarity)
    with _in_flight_lock:
        if key in _in_flight:
            return False
        _in_flight.add(key)
    _job_queue.put(key)
    return True


@image_gen_bp.route("/api/generate-bird-art", methods=["POST"])
def generate_bird_art():
    data = request.get_json(silent=True) or {}
    species = (data.get("species") or data.get("species_name") or "").strip()
    rarity = (data.get("rarity") or "common").strip().lower() or "common"
    if not species:
        return jsonify({"error": "species is required"}), 400

    fname = _cache_filename(species, rarity)
    fpath = os.path.join(CACHE_DIR, fname)

    if os.path.exists(fpath):
        return jsonify({
            "imageUrl": _public_url(fname),
            "cached": True,
            "species": species,
            "rarity": rarity,
        })

    newly = _enqueue(species, rarity)
    return jsonify({
        "imageUrl": None,
        "queued": newly,
        "pending": True,
        "species": species,
        "rarity": rarity,
        "message": "Generating manga bird art (CPU ~4 min). Poll again shortly.",
    }), 202
