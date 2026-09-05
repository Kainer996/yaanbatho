"""Conservative still-photo identification. Inconclusive evidence never awards a species.

Promoted from the previously live-only adapter in v350. The camera endpoint's
normalisation interface is preserved; forced guesses, geographic relabelling
and the weak ImageNet fallback are removed. No sound recognition is changed.
"""
from __future__ import annotations
import json
import math
import os
import re
from typing import Optional

MAX_IMAGE_PIXELS = 24_000_000
ANALYSIS_MAX_SIDE = 2560
MIN_CONFIDENCE = 0.90
MIN_MARGIN = 0.20
PHOTO_POLICY = "photo-evidence-v350"
INCONCLUSIVE = "Bird not found. Try a closer, clearer photo—we couldn’t identify a bird confidently."

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

def _extract_json_object(text: str) -> dict:
    """Pull the first JSON object out of a model response."""
    if not text:
        raise ValueError("empty model response")
    text = text.strip()
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
    text = re.sub(r"\s*```$", "", text)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        match = re.search(r"\{[\s\S]*\}", text)
        if not match:
            raise
        return json.loads(match.group(0))

def _season_note(lat: Optional[float]) -> str:
    """A short season phrase from the current month + hemisphere.

    Merlin leans heavily on date as well as place; a July capture in the UK
    should be weighted toward summer visitors (and away from winter-only birds).
    """
    try:
        import datetime
        month = datetime.date.today().month
        month_name = datetime.date(2000, month, 1).strftime("%B")
    except Exception:
        return ""
    northern = lat is None or lat >= 0
    base = {12: "winter", 1: "winter", 2: "winter", 3: "spring", 4: "spring",
            5: "spring", 6: "summer", 7: "summer", 8: "summer", 9: "autumn",
            10: "autumn", 11: "autumn"}[month]
    if not northern:
        base = {"winter": "summer", "summer": "winter", "spring": "autumn", "autumn": "spring"}[base]
    return f"It is {month_name} ({base} in the {'northern' if northern else 'southern'} hemisphere). "


def _abstain(reason="insufficient-evidence", model_name=""):
    return {"found": False, "accepted": False, "message": INCONCLUSIVE,
            "policy": PHOTO_POLICY, "reason": reason, "model": "gemini-vision", "modelName": model_name}


def _score(value):
    if isinstance(value, bool):
        return None
    try:
        n = float(value)
        return n if math.isfinite(n) and 0 <= n <= 1 else None
    except (ValueError, TypeError):
        return None


def _subject_quality(path, box):
    """Check the original analysis pixels, never an enlarged rescue crop."""
    from PIL import Image, ImageFilter, ImageStat
    if not isinstance(box, list) or len(box) != 4:
        return False
    if any(isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v) or not 0 <= v <= 1000 for v in box):
        return False
    y0,x0,y1,x1 = box
    if y1 <= y0 or x1 <= x0:
        return False
    with Image.open(path) as image:
        w,h=image.size
        bw,bh=(x1-x0)*w/1000,(y1-y0)*h/1000
        if max(bw,bh) < 80 or min(bw,bh) < 32 or bw*bh/(w*h) < .004:
            return False
        roi=image.crop((int(x0*w/1000),int(y0*h/1000),int(x1*w/1000),int(y1*h/1000))).convert("L")
        if min(roi.size) < 3 or ImageStat.Stat(roi).stddev[0] < 10:
            return False
        # Ignore the artificial outside border introduced by FIND_EDGES.
        edges=roi.filter(ImageFilter.FIND_EDGES).crop((1,1,roi.width-1,roi.height-1))
        return ImageStat.Stat(edges).mean[0] >= .8


def _normalise_species_result(raw, path, model_name=""):
    if not isinstance(raw, dict) or raw.get("found") is not True:
        return _abstain(model_name=model_name)
    species=raw.get("species");scientific=raw.get("scientificName")
    if not isinstance(species,str) or not species.strip() or not isinstance(scientific,str) or not re.fullmatch(r"[A-Z][a-z]+ [a-z][a-z-]+",scientific.strip()):
        return _abstain("invalid-species",model_name)
    confidence=_score(raw.get("confidence"))
    alternatives=raw.get("alternatives")
    if confidence is None or confidence < MIN_CONFIDENCE or not isinstance(alternatives,list):
        return _abstain("low-confidence",model_name)
    for alternative in alternatives:
        if not isinstance(alternative,dict) or _score(alternative.get("confidence")) is None:
            return _abstain("invalid-alternatives",model_name)
        if str(alternative.get("species","")).strip().lower()!=species.strip().lower() and confidence-_score(alternative["confidence"]) < MIN_MARGIN:
            return _abstain("ambiguous-species",model_name)
    evidence=raw.get("evidence")
    if not isinstance(evidence,dict) or evidence.get("liveBird") is not True or evidence.get("quality")!="clear" or evidence.get("diagnosticDetailsVisible") is not True:
        return _abstain("unclear-subject",model_name)
    features=evidence.get("diagnosticFeatures")
    if not isinstance(features,list) or len([f for f in features if isinstance(f,str) and len(f.strip())>=8]) < 2:
        return _abstain("missing-diagnostic-details",model_name)
    if not _subject_quality(path,evidence.get("subjectBox")):
        return _abstain("subject-too-small-or-indistinct",model_name)
    return {"found":True,"accepted":True,"species":species.strip(),"scientificName":scientific.strip(),
            "confidence":round(confidence,3),"policy":PHOTO_POLICY,"model":"gemini-vision","modelName":model_name}


def _photo_id_prompt(location_note=""):
    return (
        "Identify a living bird from this STILL CAMERA PHOTO only. Abstaining is a successful outcome. "
        "Return found:false whenever species cannot be distinguished confidently. A distant dark blob, generic silhouette, blurred/obscured bird, ambiguous lookalike or insufficient pixels MUST be inconclusive. "
        "Never guess, force a top choice, infer flight behavior from a still, or invent plumage. Location may rule out a species but cannot supply missing visual evidence or turn one species into another. "
        "People, empty scenes, pets, toys, statues, drawings and screens are not living birds. "
        "Only accept a clear bird with at least two genuinely visible diagnostic features, confidence >=0.90 and a >=0.20 lead over every alternative. "
        + location_note +
        'Return ONLY JSON: {"found":true|false,"species":"common name","scientificName":"Genus species","confidence":0.0,"alternatives":[{"species":"different plausible species","confidence":0.0}],"evidence":{"liveBird":true|false,"quality":"clear|blurred|silhouette|too-small|obscured|nonbird","diagnosticDetailsVisible":true|false,"diagnosticFeatures":["visible feature","visible feature"],"subjectBox":[top,left,bottom,right]}}. '
        "The box tightly encloses the bird in the ORIGINAL photo, coordinates 0–1000, not a crop or the whole scene. Give honest low confidence rather than matching the acceptance threshold."
    )


def identify_bird_from_image(path, lat=None, lon=None):
    mode=os.environ.get("BURBZ_PHOTO_MODEL","").strip().lower()
    if mode in {"off","none","disabled","stub","mobilenet","mobilenetv2","local"}:
        return _abstain("safe-photo-model-unavailable")
    api_key=os.environ.get("GEMINI_API_KEY")
    if not api_key:
        return _abstain("photo-model-not-configured")
    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)
        model_name=os.environ.get("BURBZ_GEMINI_MODEL","gemini-2.5-flash").strip() or "gemini-2.5-flash"
        location_note=""
        try:
            latitude,longitude=float(lat),float(lon)
            if math.isfinite(latitude) and math.isfinite(longitude) and -90<=latitude<=90 and -180<=longitude<=180:
                location_note=f"Approximate capture location: {latitude:.2f}, {longitude:.2f}. "+_season_note(latitude)
        except (ValueError,TypeError):
            pass
        with open(path,"rb") as stream:
            image={"mime_type":"image/jpeg","data":stream.read()}
        response=genai.GenerativeModel(model_name).generate_content([_photo_id_prompt(location_note),image],request_options={"timeout":35})
        return _normalise_species_result(_extract_json_object(getattr(response,"text","") or ""),path,model_name)
    except Exception as exc:
        result=_abstain("photo-model-unavailable")
        result["message"]="Photo identification is unavailable right now. Please try again shortly."
        result["errorType"]=type(exc).__name__
        return result
