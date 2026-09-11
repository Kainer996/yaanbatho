"""Offline photo worker. No API keys, remote inference, or runtime downloads.

Run separately from BirdNET so PyTorch dependencies and CPU limits cannot change
the sound service. Weights and taxonomy are provisioned and verified at install.
"""
from __future__ import annotations

import argparse
import hashlib
import io
import json
import math
from pathlib import Path
import socketserver
import threading
import time
from http.server import BaseHTTPRequestHandler

POLICY = "photo-local-v393"
MODEL = "bioclip2-birder-local"
SOURCE_HASH = hashlib.sha256(Path(__file__).read_bytes()).hexdigest()
MAX_BYTES = 10 * 1024 * 1024
MAX_PIXELS = 24_000_000
MIN_SCORE = .90
MIN_MARGIN = .20


def abstain(reason, message=None):
    return {"found": False, "accepted": False, "verified": False,
            "policy": POLICY, "model": MODEL, "reason": reason,
            "message": message or "Bird not found. We couldn’t confirm the species. Try a closer, clearer view of the bird."}


def valid_score(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1


def accept_consensus(bio, secondary=None):
    """One model must score >=.90 on both views; the other must agree.

    Scores are classifier outputs, not calibrated correctness probabilities.
    The .60 agreement floor and .20 margin apply independently to each reading.
    Never swap the winning model between views to manufacture a passing score.
    """
    groups = [bio] if secondary is None else [bio, secondary]
    for group in groups:
        if len(group) != 2 or group[0][0] != group[1][0]:
            return None
        for _, score, margin in group:
            if not valid_score(score) or not valid_score(margin) or score < .60 or margin < MIN_MARGIN:
                return None
    if secondary is not None and bio[0][0] != secondary[0][0]:
        return None
    primary_score = max(min(reading[1] for reading in group) for group in groups)
    return primary_score if primary_score >= MIN_SCORE else None


def clear_pixels(image, box):
    """Check original pixels; enlargement cannot rescue a tiny or blurred bird."""
    from PIL import ImageFilter, ImageStat
    if len(box) != 4 or not all(isinstance(v, (int, float)) and math.isfinite(v) for v in box):
        return False
    x0, y0, x1, y1 = box
    w, h = x1-x0, y1-y0
    if not (0 <= x0 < x1 <= image.width and 0 <= y0 < y1 <= image.height):
        return False
    if min(w, h) < 32 or max(w, h) < 80 or w*h/(image.width*image.height) < .004:
        return False
    roi = image.crop(box).convert("L")
    if ImageStat.Stat(roi).stddev[0] < 10:
        return False
    edges = roi.filter(ImageFilter.FIND_EDGES).crop((1, 1, roi.width-1, roi.height-1))
    return ImageStat.Stat(edges).mean[0] >= .8


def padded_crop(image, box, fraction):
    x0, y0, x1, y1 = box
    pad = max(x1-x0, y1-y0) * fraction
    return image.crop((max(0, math.floor(x0-pad)), max(0, math.floor(y0-pad)),
                       min(image.width, math.ceil(x1+pad)), min(image.height, math.ceil(y1+pad))))


def check_manifest(root):
    manifest = json.loads((root / "manifest.json").read_text())
    required = {"birder.json", "birder.pt", "bioclip2.safetensors", "detector.pth", "bird-names.json", "bird-embeddings.npy"}
    if not required.issubset(manifest.get("sha256", {})):
        raise ValueError("Incomplete photo model checksum manifest")
    for name, expected in manifest["sha256"].items():
        if Path(name).name != name:
            raise ValueError("Invalid model filename")
        digest = hashlib.sha256()
        with (root/name).open("rb") as stream:
            for chunk in iter(lambda: stream.read(1024*1024), b""):
                digest.update(chunk)
        if digest.hexdigest() != expected:
            raise ValueError("Photo model checksum mismatch: " + name)
    return manifest


class Recognizer:
    def __init__(self, root):
        import numpy as np
        import torch
        import birder
        import open_clip
        from torchvision.models.detection import fasterrcnn_resnet50_fpn_v2
        self.manifest = check_manifest(root)
        torch.set_num_threads(2)
        torch.set_num_interop_threads(1)
        self.torch = torch
        self.detector = fasterrcnn_resnet50_fpn_v2(weights=None, weights_backbone=None).eval()
        self.detector.load_state_dict(torch.load(root/"detector.pth", map_location="cpu", weights_only=True))
        self.birder, cfg = birder.load_model_with_cfg(root/"birder.json", root/"birder.pt")
        self.birder.eval()
        checkpoint = torch.load(root/"birder.pt", map_location="cpu", weights_only=True)
        self.birder_labels = {i: name for name, i in checkpoint["class_to_idx"].items()}
        self.birder_transform = birder.classification_transform((336, 336), cfg["rgb_stats"])
        self.bio, _, self.bio_transform = open_clip.create_model_and_transforms("ViT-L-14", pretrained=str(root/"bioclip2.safetensors"))
        self.bio.eval()
        self.names = json.loads((root/"bird-names.json").read_text())
        self.common_names = {n[0][5]+" "+n[0][6]: n[1] for n in self.names}
        self.vectors = torch.from_numpy(np.load(root/"bird-embeddings.npy", allow_pickle=False))

    def identify(self, payload):
        from PIL import Image, ImageOps
        from torchvision.transforms.functional import to_tensor
        start = time.monotonic()
        with Image.open(io.BytesIO(payload)) as source:
            if source.width*source.height > MAX_PIXELS:
                raise ValueError("Image too large")
            image = ImageOps.exif_transpose(source).convert("RGB")
        image.thumbnail((2560, 2560))
        with self.torch.inference_mode():
            detection = self.detector([to_tensor(image)])[0]
            birds = [(float(s), b.tolist()) for b, s, label in zip(detection["boxes"], detection["scores"], detection["labels"])
                     if int(label) == 16 and float(s) >= .90]
            if not birds:
                return abstain("no-clear-bird")
            if len(birds) != 1:
                return abstain("multiple-birds", "Bird not found. Frame just one bird so we can confirm its species.")
            score, box = birds[0]
            if not clear_pixels(image, box):
                return abstain("subject-too-small-or-indistinct")
            # Both views contain the detected subject, preserving background context
            # without demanding that a distant subject dominate the full photograph.
            views = [padded_crop(image, box, .12), padded_crop(image, box, .30)]
            readings = []
            for view in views:
                features = self.bio.encode_image(self.bio_transform(view).unsqueeze(0), normalize=True)
                scores = (self.bio.logit_scale.exp()*features@self.vectors).softmax(-1)[0]
                values, ids = scores.topk(2)
                taxon = self.names[int(ids[0])][0]
                readings.append((taxon[5]+" "+taxon[6], float(values[0]), float(values[0]-values[1])))
            if readings[0][0] != readings[1][0]:
                return abstain("views-disagree")
            scientific = readings[0][0]
            common = self.common_names[scientific]
            if not common or len(scientific.split()) != 2:
                return abstain("unresolved-taxonomy")
            # Cross-model verification is filled from the tested taxonomy mapping.
            birder_ids = self.manifest.get("birder_species", {}).get(scientific)
            secondary = None
            if birder_ids:
                secondary = []
                for view in views:
                    p = self.birder(self.birder_transform(view).unsqueeze(0)).softmax(-1)[0]
                    values, ids = p.topk(2)
                    winner = int(ids[0])
                    if winner not in birder_ids:
                        return abstain("models-disagree")
                    secondary.append((scientific, float(values[0]), float(values[0]-values[1])))
            confidence = accept_consensus(readings, secondary)
            if confidence is None:
                return abstain("uncertain-species")
            if time.monotonic()-start > 30:
                return abstain("photo-timeout", "Photo checking took too long. Please try again.")
            return {"found": True, "accepted": True, "verified": True,
                    "policy": POLICY, "model": MODEL, "species": common,
                    "scientificName": scientific, "confidence": confidence,
                    "verification": "detector+two-views" + ("+birder" if birder_ids else ""),
                    "seconds": round(time.monotonic()-start, 3)}


def serve(recognizer, path):
    # Bound both active inference and waiting requests. No unbounded CPU queue.
    slots = threading.BoundedSemaphore(3)
    inference = threading.Lock()

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *_args):
            pass  # Never log photos or capture coordinates.

        def reply(self, status, result):
            body = json.dumps(result, allow_nan=False).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            self.reply(200 if self.path == "/health" else 404, {"ready": self.path == "/health", "policy": POLICY,
                       "sourceHash": SOURCE_HASH, "bundle": recognizer.manifest["id"]})

        def do_POST(self):
            if self.path != "/identify":
                self.reply(404, abstain("unknown-route")); return
            self.connection.settimeout(5)
            try:
                size = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                self.reply(400, abstain("invalid-size")); return
            if not 0 < size <= MAX_BYTES:
                self.reply(413, abstain("invalid-size")); return
            if not slots.acquire(blocking=False):
                # Drain the bounded upload before replying. Closing mid-upload
                # turns an honest busy response into a client connection reset.
                remaining = size
                while remaining:
                    chunk = self.rfile.read(min(65536, remaining))
                    if not chunk:
                        return
                    remaining -= len(chunk)
                self.reply(503, abstain("photo-busy", "Photo checking is busy. Please try again shortly.")); return
            try:
                payload = self.rfile.read(size)
                if len(payload) != size:
                    self.reply(400, abstain("incomplete-image")); return
                if not inference.acquire(timeout=3):
                    self.reply(503, abstain("photo-busy", "Photo checking is busy. Please try again shortly.")); return
                try:
                    result = recognizer.identify(payload)
                finally:
                    inference.release()
                self.reply(200, result)
            except (ValueError, OSError):
                self.reply(422, abstain("invalid-image"))
            except Exception:
                self.reply(503, abstain("photo-unavailable", "Photo checking is temporarily unavailable. Please try again shortly."))
            finally:
                slots.release()

    class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
        daemon_threads = True
        request_queue_size = 4

    # A systemd RuntimeDirectory owns and clears this socket on stop.
    with Server(str(path), Handler) as server:
        path.chmod(0o660)
        server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--models", required=True, type=Path)
    parser.add_argument("--socket", required=True, type=Path)
    args = parser.parse_args()
    serve(Recognizer(args.models), args.socket)
