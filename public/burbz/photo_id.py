"""Existing Flask route adapter for the capped Gemini Unix worker.

v486 identifies birds the way Merlin does. The worker asks Gemini for a ranked
list of species. This adapter adds where and when: the BirdNET Geomodel that
already runs in this Flask process for sound says which birds live near the
player this week. Gemini sees that local list, and its ranking is re-weighed by
the same range prior, so an Anhinga cannot win in Lancashire. Names are mapped
onto one taxonomy, so Corvus monedula and Coloeus monedula are one jackdaw.
The player then picks the bird ("This is my bird"); a strong, local, clear
match is also marked found for the server route and the release proof.
"""
from __future__ import annotations
import base64
import ipaddress
import http.client
import json
import math
import os
import re
import socket
import threading
import unicodedata

MAX_IMAGE_PIXELS = 24_000_000
ANALYSIS_MAX_SIDE = 2560
PHOTO_POLICY = "photo-gemini-v486"
PHOTO_CONTRACT = "merlin-v486"
MODEL_NAME = "gemini-3.8-flash"
MIN_CONFIDENCE = .80
MIN_MARGIN = .20
MODEL_FLOOR = .50
# BirdNET Geomodel occurrence for the place and week. At or above LIKELY the
# bird is expected there (Merlin's "likely" list); below it the weight falls
# away linearly to a floor, so a vagrant stays pickable but cannot win on a
# model's guess alone.
LIKELY = .05
RARE = .005
FLOOR = .02
UNKNOWN_RANGE_WEIGHT = .5
OTHER_WEIGHT = .5
CHECKLIST_MIN = .03
CHECKLIST_SIZE = 300
MIN_SHOWN = .02
MAX_SHOWN = 5
INCONCLUSIVE = "Bird not found. We couldn’t confirm the species. Try a closer, clearer view of the bird."
PICK = "Bird detected. Pick your bird from the matches, or try another angle showing its head, wings and tail."
SCIENTIFIC = re.compile(r"[A-Z][a-z]+ [a-z][a-z-]+")
MONTHS = ("January", "February", "March", "April", "May", "June", "July",
          "August", "September", "October", "November", "December")


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
            "model": "gemini-vision", "modelName": MODEL_NAME, "retryable": True, "reason": reason,
            "message": message or INCONCLUSIVE}


class _LocalConnection(http.client.HTTPConnection):
    def __init__(self):
        super().__init__("localhost", timeout=45)

    def connect(self):
        self.sock = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
        self.sock.settimeout(self.timeout)
        self.sock.connect(os.environ.get("BURBZ_PHOTO_SOCKET", "/run/burbz-photo/recognizer.sock"))


# --------------------------------------------------------------------------
# One taxonomy: the BirdNET Geomodel's Clements/eBird labels
# --------------------------------------------------------------------------

def _common_key(name):
    text = unicodedata.normalize("NFKD", name).encode("ascii", "ignore").decode().lower()
    text = text.replace("grey", "gray").replace("'", "").replace("-", " ")
    return " ".join(re.findall(r"[a-z]+", text))


def _head(name):
    words = _common_key(name).split()
    return words[-1] if words else ""


def _stem(epithet):
    # Latin gender endings move with the genus: urbica/urbicum, torquata/torquatus.
    word = epithet.lower()
    for ending in ("us", "um", "a", "is", "e", "i"):
        if len(word) > 4 and word.endswith(ending):
            return word[:-len(ending)]
    return word


# Old names that now cover more than one species. The place decides which one
# the player saw, as Merlin's range data would: a "Saxicola torquatus" in
# Lancashire is a European Stonechat, a "Larus argentatus" in Maine an American
# Herring Gull. Without a place the model's own name stands.
SPLITS = {
    "saxicola torquatus": ("Saxicola rubicola", "Saxicola torquatus", "Saxicola maurus"),
    "saxicola torquata": ("Saxicola rubicola", "Saxicola torquatus", "Saxicola maurus"),
    "circus cyaneus": ("Circus cyaneus", "Circus hudsonius"),
    "melanitta nigra": ("Melanitta nigra", "Melanitta americana"),
    "melanitta fusca": ("Melanitta fusca", "Melanitta deglandi", "Melanitta stejnegeri"),
    "calonectris diomedea": ("Calonectris diomedea", "Calonectris borealis"),
    "hirundo daurica": ("Cecropis rufula", "Cecropis daurica"),
    "cecropis daurica": ("Cecropis rufula", "Cecropis daurica"),
    "larus argentatus": ("Larus argentatus", "Larus smithsonianus"),
    "anser fabalis": ("Anser fabalis", "Anser serrirostris"),
    "gallinago gallinago": ("Gallinago gallinago", "Gallinago delicata"),
    "pica pica": ("Pica pica", "Pica hudsonia"),
    "troglodytes troglodytes": ("Troglodytes troglodytes", "Troglodytes hiemalis", "Troglodytes pacificus"),
    "certhia familiaris": ("Certhia familiaris", "Certhia americana"),
    "lanius excubitor": ("Lanius excubitor", "Lanius borealis"),
    "tyto alba": ("Tyto alba", "Tyto furcata", "Tyto javanica"),
}
# Species the range model folds into another. They keep their own name (Burbz
# lists Lesser Redpoll) but borrow the parent's range.
LUMPS = {
    "acanthis cabaret": "Acanthis flammea",
    "acanthis hornemanni": "Acanthis flammea",
    "ardea modesta": "Ardea alba",
    "thalasseus acuflavida": "Thalasseus sandvicensis",
}
# Five birds carry numeric GBIF ids in the label file, like its non-birds.
NUMERIC_BIRDS = {"Leucocarbo atriceps", "Tyto furcata", "Chalcites minutillus",
                 "Tyto javanica", "Poospizopsis hypochondria"}
# The pinned label file calls Tyto alba "American Barn Owl".
LABEL_FIXES = {"Tyto alba": "Western Barn Owl"}


class Taxonomy:
    """Map any model name onto one label, never by fuzzy guessing.

    Order: a known split (the place picks the daughter), exact scientific
    name, exact common name (Grey = Gray, hyphens and apostrophes ignored),
    then a genus move: the same species epithet plus the same bird word
    (Corvus monedula "Western Jackdaw" -> Coloeus monedula "Eurasian Jackdaw").
    A lumped species borrows its parent's range but keeps its own name.
    Anything else keeps its own name. Returns (position, scientific, common).
    """

    def __init__(self, rows):
        self.rows = []
        self.by_scientific, self.by_common, self.by_stem = {}, {}, {}
        for position, (code, scientific, common) in enumerate(rows):
            common = LABEL_FIXES.get(scientific, common)
            bird = bool(code) and (not code.isdigit() or scientific in NUMERIC_BIRDS)
            self.rows.append((scientific, common, bird))
            if not bird or len(scientific.split()) != 2:
                continue  # Numeric GBIF ids are otherwise the geomodel's non-bird classes.
            entry = (position, scientific, common)
            self.by_scientific.setdefault(scientific.lower(), entry)
            self.by_common.setdefault(_common_key(common), entry)
            self.by_stem.setdefault(_stem(scientific.split()[1]), []).append(entry)

    def match(self, scientific, common, place=None):
        key = (scientific or "").lower()
        options = [self.by_scientific[n.lower()] for n in SPLITS.get(key, ()) if n.lower() in self.by_scientific]
        if options:
            if place is None:
                return self.by_scientific.get(key) or options[0]
            return max(options, key=lambda e: place.occurrence(e[0]) or 0.0)
        found = self.by_scientific.get(key)
        if found:
            return found
        found = self.by_common.get(_common_key(common or ""))
        if found:
            return found
        words = (scientific or "").split()
        if len(words) == 2 and common:
            same = [e for e in self.by_stem.get(_stem(words[1]), []) if _head(e[2]) == _head(common)]
            if len(same) == 1:
                return same[0]
        parent = self.by_scientific.get(LUMPS.get(key, "").lower())
        if parent:
            return (parent[0], scientific, common)
        return None


_taxonomy = None
_taxonomy_lock = threading.Lock()


def _geo_provider():
    from sound_id import birdnet_v3_provider as provider
    if not provider._env_flag("BURBZ_BIRDNET_V3_GEO", True) or provider._load_geo() is None:
        return None
    return provider


def _load_taxonomy():
    """Read the exact, checksummed geomodel labels once."""
    global _taxonomy
    if _taxonomy is not None:
        return _taxonomy
    with _taxonomy_lock:
        if _taxonomy is None:
            provider = _geo_provider()
            if provider is None:
                return None
            path = provider._resolve_asset("BURBZ_BIRDNET_V3_GEO_LABELS_PATH", provider.GEO_LABELS_FILENAME, "")
            provider._verify_asset(path, provider.GEO_LABELS_SHA256, "BirdNET V3 geomodel labels")
            rows = []
            with open(path, encoding="utf-8") as handle:
                for line in handle:
                    parts = line.rstrip("\n").split("\t")
                    rows.append((parts[0].strip(), parts[1].strip() if len(parts) > 1 else "",
                                 parts[2].strip() if len(parts) > 2 else ""))
            _taxonomy = Taxonomy(rows)
    return _taxonomy


def _taxonomy_or_none():
    try:
        return _load_taxonomy()
    except Exception:
        return None  # The range model is an enhancement; photos still work.


class Place:
    """Occurrence per geomodel label for one rounded place and week."""

    def __init__(self, lat, lon, week, probabilities, taxonomy):
        self.lat, self.lon, self.week = lat, lon, week
        self.probabilities, self.taxonomy = probabilities, taxonomy

    def occurrence(self, position):
        if position is None or position >= len(self.probabilities):
            return None
        return float(self.probabilities[position])

    def checklist(self):
        rows = [(p, float(self.probabilities[p])) for p, (_, _, bird) in enumerate(self.taxonomy.rows)
                if bird and p < len(self.probabilities) and float(self.probabilities[p]) >= CHECKLIST_MIN]
        rows.sort(key=lambda item: -item[1])
        return [[self.taxonomy.rows[p][1], self.taxonomy.rows[p][0]] for p, _ in rows[:CHECKLIST_SIZE]
                if self.taxonomy.rows[p][1] and SCIENTIFIC.fullmatch(self.taxonomy.rows[p][0])]

    def context(self):
        # Gemini gets the place to half a degree (about 50 km) and the week.
        lat, lon = round(self.lat * 2) / 2, round(self.lon * 2) / 2
        region = "near %.1f°%s, %.1f°%s" % (abs(lat), "N" if lat >= 0 else "S", abs(lon), "E" if lon >= 0 else "W")
        part = ("early", "mid", "mid", "late")[(self.week - 1) % 4]
        return {"region": region, "season": part + " " + MONTHS[(self.week - 1) // 4],
                "checklist": self.checklist()}


def _form_number(form, key, low, high):
    try:
        value = float(form.get(key, ""))
    except (TypeError, ValueError):
        return None
    return value if math.isfinite(value) and low <= value <= high else None


def _place(form, taxonomy):
    """The player's place from this request only. Nothing is stored."""
    if taxonomy is None:
        return None
    lat, lon = _form_number(form, "lat", -90, 90), _form_number(form, "lon", -180, 180)
    if lat is None or lon is None:
        return None
    week = _form_number(form, "photoWeek", 1, 48)
    try:
        provider = _geo_provider()
        if provider is None:
            return None
        week = int(week) if week is not None else provider._birdnet_week(None)
        lat, lon = round(lat, 1), round(lon, 1)
        probabilities = provider._geo_probabilities(lat, lon, week)
    except Exception:
        return None
    if probabilities is None:
        return None
    return Place(lat, lon, week, probabilities, taxonomy)


# --------------------------------------------------------------------------
# Ranking: the model's reading times the range prior
# --------------------------------------------------------------------------

def _weight(occurrence):
    if occurrence is None:
        return UNKNOWN_RANGE_WEIGHT
    return 1.0 if occurrence >= LIKELY else max(FLOOR, occurrence / LIKELY)


def _local(occurrence):
    if occurrence is None:
        return "unknown"
    return "likely" if occurrence >= LIKELY else "rare" if occurrence >= RARE else "unexpected"


def rank(reading, place=None, taxonomy=None):
    """Merge synonyms, apply the range prior and renormalise.

    Returns ranked candidates [{species, scientificName, score, local?, plumage?,
    _model}], where _model is the model's own merged probability.
    """
    merged, order = {}, []
    for c in reading.get("candidates", []):
        match = taxonomy.match(c["scientificName"], c["species"], place) if taxonomy else None
        scientific = match[1] if match else c["scientificName"]
        key = scientific.lower()
        if key not in merged:
            entry = {"species": c["species"], "scientificName": scientific, "p": 0.0,
                     "position": match[0] if match else None}
            if c.get("plumage"):
                entry["plumage"] = c["plumage"]
            merged[key] = entry
            order.append(key)
        merged[key]["p"] += c["probability"]
    other = reading.get("otherProbability", 0.0)
    ranked = []
    for key in order:
        entry = merged[key]
        occurrence = place.occurrence(entry["position"]) if place else None
        weight = _weight(occurrence) if place else 1.0
        ranked.append((entry, entry["p"] * weight, occurrence))
    other_mass = other * (OTHER_WEIGHT if place else 1.0)
    total = sum(mass for _, mass, _ in ranked) + other_mass
    out = []
    for entry, mass, occurrence in sorted(ranked, key=lambda item: -item[1]):
        candidate = {"species": entry["species"], "scientificName": entry["scientificName"],
                     "score": round(mass / total, 3) if total > 0 else 0.0, "_model": entry["p"]}
        if place:
            candidate["local"] = _local(occurrence)
        if entry.get("plumage"):
            candidate["plumage"] = entry["plumage"]
        out.append(candidate)
    return out


def decide(reading, place=None, taxonomy=None):
    """Final client result from one validated worker reading."""
    base = {"policy": PHOTO_POLICY, "model": "gemini-vision", "modelName": MODEL_NAME,
            "retryable": False, "receiptId": reading["receiptId"], "placeUsed": place is not None}
    if reading.get("found") is not True:
        result = dict(base, found=False, accepted=False, verified=False,
                      reason=reading.get("reason", "no-species"), message=reading.get("message") or INCONCLUSIVE)
        return result
    ranked = rank(reading, place, taxonomy)
    model_top = ranked[0].get("_model", 0.0)
    for candidate in ranked:
        candidate.pop("_model", None)
    shown = [c for i, c in enumerate(ranked) if i == 0 or c["score"] >= MIN_SHOWN][:MAX_SHOWN]
    top = shown[0]
    second = ranked[1]["score"] if len(ranked) > 1 else 0.0
    # The range prior may reorder the model's list, but "found" also needs the
    # model's own conviction: ruling out two impossible birds is not seeing a third.
    strong = (top["score"] >= MIN_CONFIDENCE and top["score"] - second >= MIN_MARGIN - 1e-9
              and model_top >= MODEL_FLOOR
              and reading.get("subjectClear") is True and len(reading.get("fieldMarks", [])) >= 2
              and top.get("local", "likely") in ("likely", "unknown"))
    if strong:
        return dict(base, found=True, accepted=True, verified=True, species=top["species"],
                    scientificName=top["scientificName"], confidence=top["score"], candidates=shown)
    return dict(base, found=False, accepted=False, verified=False, reason="pick-your-bird",
                message=PICK, candidates=shown)


def _validate_reading(result):
    """Strictly check the worker's reading before any ranking."""
    if (not isinstance(result, dict) or result.get("policy") != PHOTO_POLICY or result.get("model") != "gemini-vision"
            or result.get("modelName") != MODEL_NAME):
        return None, _abstain("invalid-worker-result")
    if result.get("retryable") is not False or not isinstance(result.get("receiptId"), str) \
            or not re.fullmatch(r"[a-f0-9]{64}", result["receiptId"]):
        clean = _abstain(str(result.get("reason", "photo-unavailable"))[:60],
                         result.get("message") if isinstance(result.get("message"), str) else None)
        clean.update(retryable=True, retryAt=result.get("retryAt", 0) if isinstance(result.get("retryAt"), (int, float)) else 0)
        return None, clean
    reading = {"receiptId": result["receiptId"], "found": False,
               "reason": str(result.get("reason", "no-species"))[:60],
               "message": result.get("message") if isinstance(result.get("message"), str) else INCONCLUSIVE}
    if result.get("found") is not True:
        return reading, None
    candidates = []
    for c in result.get("candidates", [])[:5] if isinstance(result.get("candidates"), list) else []:
        if not isinstance(c, dict):
            continue
        name, scientific, p = c.get("species"), c.get("scientificName"), c.get("probability")
        if (isinstance(name, str) and 1 <= len(name.strip()) <= 100 and isinstance(scientific, str)
                and SCIENTIFIC.fullmatch(scientific) and isinstance(p, (int, float)) and not isinstance(p, bool)
                and math.isfinite(p) and 0 <= p <= 1):
            entry = {"species": name.strip(), "scientificName": scientific, "probability": float(p)}
            if isinstance(c.get("plumage"), str) and re.fullmatch(r"[a-z ]{3,30}", c["plumage"]):
                entry["plumage"] = c["plumage"]
            candidates.append(entry)
    other = result.get("otherProbability")
    if not candidates or sum(c["probability"] for c in candidates) > 1 + 1e-6:
        return None, _abstain("invalid-worker-result")
    marks = [m for m in result.get("fieldMarks", []) if isinstance(m, str)][:6] \
        if isinstance(result.get("fieldMarks"), list) else []
    reading.update(found=True, candidates=candidates, fieldMarks=marks,
                   subjectClear=result.get("subjectClear") is True,
                   otherProbability=float(other) if isinstance(other, (int, float)) and not isinstance(other, bool)
                   and math.isfinite(other) and 0 <= other <= 1 else 0.0)
    return reading, None


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
    if request.form.get('photoContract') != PHOTO_CONTRACT:
        raise ValueError('Photo app update required')
    return owner,request_id,caller,request.form


def identify_bird_from_image(path, lat=None, lon=None):
    # Retain the route interface; the worker alone owns billing and egress.
    # The form carries this request's place and week; nothing is kept.
    try: owner,request_id,caller,form=_request_identity()
    except (ValueError,ImportError):
        return _abstain('photo-update-required','Close and reopen Burbz to update photo identification. Then choose your photo again.')
    taxonomy = _taxonomy_or_none()
    place = _place(form, taxonomy)
    connection = _LocalConnection()
    try:
        with open(path, "rb") as stream:
            data = stream.read(10*1024*1024+1)
        if len(data) > 10*1024*1024:
            return _abstain("invalid-size")
        body = {"image":base64.b64encode(data).decode(),"owner":owner,"requestId":request_id,"caller":caller}
        if place is not None:
            body["context"] = place.context()
        connection.request("POST", "/identify", body=json.dumps(body), headers={"Content-Type": "application/json"})
        response = connection.getresponse()
        raw = response.read(16385)
        if len(raw) > 16384:
            return _abstain("invalid-worker-result")
        if response.status != 200:
            return _abstain("photo-busy" if response.status == 503 else "photo-unavailable",
                            "Photo checking is busy. Please try again shortly." if response.status == 503 else "Photo checking is unavailable. Please try again shortly.")
        reading, problem = _validate_reading(json.loads(raw))
        if problem:
            return problem
        return decide(reading, place, taxonomy)
    except (OSError, ValueError, http.client.HTTPException):
        return _abstain("photo-unavailable", "Photo checking is temporarily unavailable. Please try again shortly. Your photo has not been rejected.")
    finally:
        connection.close()
