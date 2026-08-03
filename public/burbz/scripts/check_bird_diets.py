#!/usr/bin/env python3
"""Generate and verify source-backed Burbz diet records.

The oracle is EltonTraits 1.0 BirdFuncDat (Wilman et al. 2014, Ecology 95:2027,
doi:10.1890/13-1917.1, CC BY 4.0). The script produces deterministic JSON plus a
browser-friendly JS wrapper, and --check fails if the source hash, catalogue
count, match counts, or generated files drift.

Source resolution order (first that exists wins):
  1. --source PATH, if given
  2. /tmp/BirdFuncDat.txt (legacy download location; kept for muscle memory)
  3. data/national-bird-completion/source-cache/BirdFuncDat.txt (committed, so
     this script and its tests run offline on a fresh clone — do not delete it)

NOTE FOR FUTURE AGENTS: the committed cache is the source of truth for offline
reproducibility. Its bytes are pinned by EXPECTED_SHA256 below; if you ever
refresh the oracle, update that constant, BIRDFUNCDAT_SHA256 in the diet tests,
and re-run this script with --check.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CACHED_SOURCE = ROOT / "data" / "national-bird-completion" / "source-cache" / "BirdFuncDat.txt"
TMP_SOURCE = Path("/tmp/BirdFuncDat.txt")
# Prefer the ephemeral /tmp copy if present (fast local iteration), otherwise
# fall back to the committed cache so a fresh clone still verifies offline.
DEFAULT_SOURCE = TMP_SOURCE if TMP_SOURCE.exists() else CACHED_SOURCE
PROFILES_PATH = ROOT / "data" / "national-bird-completion" / "profiles.json"
INDEX_PATH = ROOT / "index.html"
JSON_OUT = ROOT / "data" / "bird-diet-records.json"
JS_OUT = ROOT / "data" / "bird-diet-records.js"
SUMMARY_OUT = ROOT / "data" / "bird-diet-provenance-summary.json"

EXPECTED_SHA256 = "97216eb1797da077169ebb1ebea275db293b09fc62f8bb8911f9beb98c50d321"
EXPECTED_PROFILE_COUNT = 951
DIET_VERSION = "diet-generalists-20260729"

# Species-level refinements for well-documented opportunistic generalists.
# These are deliberately narrow: an omnivorous label does not make every
# ingredient safe for every bird, and specialists keep their exact menu.
SPECIES_DIET_REFINEMENTS = {
    "Dendrocopos major": {
        # BirdFuncDat's broad Diet-Vend bucket means warm-blooded vertebrate prey;
        # for this species BTO and Woodland Trust identify eggs and young birds,
        # not small mammals. Carrion is omitted from the playable menu because
        # neither British field guide treats it as a meaningful feeding category.
        "remove": ["small_mammals", "carrion"],
        "secondary": ["small_birds"],
        "scores": {"small_birds": 10},
        "source": "BTO + Woodland Trust",
        "education": (
            " BTO and Woodland Trust identify insects and larvae as the main food, "
            "with tree seeds plus the eggs and young of smaller birds also eaten."
        ),
    },
    "Corvus corone": {
        "secondary": ["worms", "fruit_berries", "fish", "small_birds"],
        "education": (
            " Carrion Crows are opportunistic generalists; their source-backed "
            "Kitchen menu also includes earthworms, fruit, fish and small-bird prey."
        ),
    },
    "Larus argentatus": {"secondary": ["worms"]},
    "Larus fuscus": {"secondary": ["worms"]},
    "Larus canus": {"secondary": ["worms", "fruit_berries"]},
}

SOURCE_METADATA = {
    "name": "EltonTraits 1.0 BirdFuncDat",
    "license": "CC BY 4.0",
    "doi": "10.1890/13-1917.1",
    "sourceUrl": "https://ndownloader.figshare.com/files/5631081",
    "expectedSha256": EXPECTED_SHA256,
}

# Display-name aliases used by the original in-page WILD_BIRDS catalogue. These
# point to BirdFuncDat common names; they do not alter the source diet values.
GAME_BIRD_SOURCE_COMMON_NAMES = {
    "swift": "Common Swift",
    "swallow": "Barn Swallow",
    "wren": "Winter Wren",
    "blackbird": "Common Blackbird",
    "buzzard": "Common Buzzard",
    "cuckoo": "Common Cuckoo",
    "heron": "Grey Heron",
    "kestrel": "Common Kestrel",
    "kingfisher": "Common Kingfisher",
    "puffin": "Atlantic Puffin",
    "oystercatcher": "Eurasian Oystercatcher",
    "sparrowhawk": "Eurasian Sparrowhawk",
    "magpie": "Eurasian Magpie",
    "jay": "Eurasian Jay",
    "nuthatch": "Wood Nuthatch",
    "treecreeper": "Eurasian Treecreeper",
    "dipper": "White-throated Dipper",
    "goosander": "Common Merganser",
    "pheasant": "Common Pheasant",
    "green woodpecker": "European Green Woodpecker",
    "dunnock": "Hedge Accentor",
    "house martin": "Northern House-martin",
    "pied wagtail": "White Wagtail",
    "lapwing": "Northern Lapwing",
    "cormorant": "Great Cormorant",
    "gannet": "Northern Gannet",
    "eurasian coot": "Common Coot",
    "australasian swamphen": "Purple Swamphen",
    "australian white ibis": "Australian Sacred Ibis",
    "common linnet": "Eurasian Linnet",
    "ring-necked parakeet": "Rose-ringed Parakeet",
    "greater whitethroat": "Common Whitethroat",
    "common gull": "Mew Gull",
    "red grouse": "Willow Ptarmigan",
    "green-winged teal": "Common Teal",
    "australasian darter": "Australian Darter",
    "gray shrikethrush": "Grey Shrike-thrush",
    "pied stilt": "White-headed Stilt",
    "nankeen night heron": "Rufous Night-heron",
    "western cattle egret": "Cattle Egret",
    "adélie penguin": "Adelie Penguin",
    "common ostrich": "Ostrich",
    "north island brown kiwi": "Northern Brown Kiwi",
    "african grey parrot": "Grey Parrot",
    "steller sea-eagle": "Steller's Sea-eagle",
    "bearded vulture": "Lammergeier",
    "eurasian griffon vulture": "Griffon Vulture",
    "great frigatebird": "Greater Frigatebird",
}

DIET_COLUMNS = [
    "Diet-Inv",
    "Diet-Vend",
    "Diet-Vect",
    "Diet-Vfish",
    "Diet-Vunk",
    "Diet-Scav",
    "Diet-Fruit",
    "Diet-Nect",
    "Diet-Seed",
    "Diet-PlantO",
]

MATCH_METHODS = [
    "exact",
    "scientific-alias",
    "common-name",
    "family-fallback",
    "override",
    "unmatched",
]

FOOD_FAMILIES = {
    "small_birds": {
        "label": "Small-bird prey rations",
        "sourceColumns": ["Diet-Vend"],
        "defaultPrep": "whole",
    },
    "small_mammals": {
        "label": "Small mammals",
        "sourceColumns": ["Diet-Vend", "Diet-Vect", "Diet-Vunk"],
        "defaultPrep": "live",
    },
    "fish": {
        "label": "Fish",
        "sourceColumns": ["Diet-Vfish"],
        "defaultPrep": "live",
    },
    "flying_insects": {
        "label": "Flying insects",
        "sourceColumns": ["Diet-Inv"],
        "defaultPrep": "tossed",
    },
    "invertebrates": {
        "label": "General invertebrates",
        "sourceColumns": ["Diet-Inv"],
        "defaultPrep": "fresh",
    },
    "worms": {
        "label": "Worms",
        "sourceColumns": ["Diet-Inv"],
        "defaultPrep": "fresh",
    },
    "molluscs_crustaceans": {
        "label": "Molluscs and crustaceans",
        "sourceColumns": ["Diet-Inv"],
        "defaultPrep": "cracked",
    },
    "seeds": {
        "label": "Seeds",
        "sourceColumns": ["Diet-Seed"],
        "defaultPrep": "husked",
    },
    "fruit_berries": {
        "label": "Fruit and berries",
        "sourceColumns": ["Diet-Fruit"],
        "defaultPrep": "fresh",
    },
    "nectar": {
        "label": "Nectar",
        "sourceColumns": ["Diet-Nect"],
        "defaultPrep": "fresh",
    },
    "aquatic_plants": {
        "label": "Aquatic or leafy plants",
        "sourceColumns": ["Diet-PlantO"],
        "defaultPrep": "floating",
    },
    "carrion": {
        "label": "Carrion",
        "sourceColumns": ["Diet-Scav"],
        "defaultPrep": "fresh",
    },
}

FAMILY_HINTS = {
    "aerial_insectivore": {
        "Apodidae",
        "Hemiprocnidae",
        "Hirundinidae",
        "Caprimulgidae",
        "Aegothelidae",
    },
    "shore_invertebrate": {
        "Scolopacidae",
        "Charadriidae",
        "Haematopodidae",
        "Recurvirostridae",
        "Burhinidae",
        "Glareolidae",
        "Thinocoridae",
    },
    "aquatic_invertebrate": {
        "Anatidae",
        "Rallidae",
        "Laridae",
        "Ardeidae",
        "Threskiornithidae",
        "Podicipedidae",
        "Phoenicopteridae",
    },
    "raptor_bird": {
        "Falconidae",
        "Accipitridae",
    },
    "raptor_mammal": {
        "Strigidae",
        "Tytonidae",
        "Accipitridae",
    },
}

MERLIN_CONTEXT = (
    "Merlin is Falco columbarius, a small falcon. BirdFuncDat records 80% "
    "endotherm vertebrate prey and 20% invertebrates; mission context teaches "
    "small birds such as Meadow Pipits, Skylarks, and other small passerines "
    "as the main prey, with insects secondary."
)


def norm(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def compact(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower())


def is_scientific_alias(value: str | None) -> bool:
    return bool(re.match(r"^[A-Z][a-z]+ [a-z][a-z-]+(?:$| )", value or ""))


def profile_id_for_scientific(value: str) -> str:
    return compact(value).strip("_") or "unknown"


def read_source(path: Path) -> tuple[str, list[dict[str, str]], int]:
    raw = path.read_bytes()
    sha = hashlib.sha256(raw).hexdigest()
    text = raw.decode("latin-1")
    parsed_rows = list(csv.DictReader(io.StringIO(text, newline=""), delimiter="\t"))
    rows = [row for row in parsed_rows if row.get("Scientific")]
    return sha, rows, len(parsed_rows)


def read_profiles(path: Path) -> list[dict[str, Any]]:
    return json.loads(path.read_text(encoding="utf-8"))


def percent(row: dict[str, Any], key: str) -> float:
    try:
        return float(row.get(key) or 0)
    except (TypeError, ValueError):
        return 0.0


def clean_percent(value: float) -> int | float:
    rounded = round(float(value), 2)
    if rounded == int(rounded):
        return int(rounded)
    return rounded


def diet_percentages(row: dict[str, Any] | None) -> dict[str, int | float] | None:
    if not row:
        return None
    return {key: clean_percent(percent(row, key)) for key in DIET_COLUMNS}


def aggregate_percentages(rows: list[dict[str, str]]) -> dict[str, int | float]:
    if not rows:
        return {key: 0 for key in DIET_COLUMNS}
    return {
        key: clean_percent(sum(percent(row, key) for row in rows) / len(rows))
        for key in DIET_COLUMNS
    }


def row_context(row: dict[str, Any] | None, profile: dict[str, Any] | None) -> dict[str, str]:
    return {
        "scientific": str((row or {}).get("Scientific") or (profile or {}).get("scientificName") or ""),
        "common": str((row or {}).get("English") or (profile or {}).get("commonName") or (profile or {}).get("name") or ""),
        "family": str((row or {}).get("BLFamilyLatin") or (profile or {}).get("family") or ""),
        "order": str((row or {}).get("IOCOrder") or (profile or {}).get("order") or ""),
    }


def has_name_hint(ctx: dict[str, str], pattern: str) -> bool:
    return bool(re.search(pattern, " ".join(ctx.values()), re.I))


def add_score(scores: dict[str, float], family: str, value: float) -> None:
    if value <= 0:
        return
    scores[family] = max(scores.get(family, 0.0), value)


def invertebrate_families(ctx: dict[str, str], inv: float) -> list[str]:
    family = ctx["family"]
    if family in FAMILY_HINTS["aerial_insectivore"] or has_name_hint(ctx, r"\b(swift|swallow|martin|nightjar)\b"):
        return ["flying_insects", "invertebrates"]
    if family in FAMILY_HINTS["shore_invertebrate"] or has_name_hint(ctx, r"\b(oystercatcher|curlew|sandpiper|plover|godwit|turnstone|knot|snipe)\b"):
        return ["worms", "molluscs_crustaceans", "invertebrates"]
    if family in FAMILY_HINTS["aquatic_invertebrate"] or has_name_hint(ctx, r"\b(duck|teal|wigeon|goose|swan|gull|tern|heron|egret|coot|moorhen|rail)\b"):
        return ["invertebrates", "molluscs_crustaceans"]
    if has_name_hint(ctx, r"\b(thrush|blackbird|robin|wren|pipit|warbler|wagtail)\b"):
        return ["worms", "invertebrates"]
    return ["invertebrates"]


def endotherm_families(ctx: dict[str, str], vend: float) -> list[str]:
    sci = ctx["scientific"].lower()
    if sci == "falco columbarius":
        return ["small_birds"]
    family = ctx["family"]
    if family in FAMILY_HINTS["raptor_bird"] or has_name_hint(ctx, r"\b(falcon|hawk|goshawk|sparrowhawk|kite|harrier|eagle|merlin)\b"):
        return ["small_birds", "small_mammals"]
    if family in FAMILY_HINTS["raptor_mammal"] or has_name_hint(ctx, r"\b(owl)\b"):
        return ["small_mammals", "small_birds"]
    return ["small_mammals"]


def game_family_scores(
    source_percentages: dict[str, int | float] | None,
    ctx: dict[str, str],
) -> dict[str, int | float]:
    scores: dict[str, float] = {}
    if not source_percentages:
        return scores

    inv = float(source_percentages.get("Diet-Inv") or 0)
    inv_families = invertebrate_families(ctx, inv)
    for family in inv_families:
        score = inv
        if family == "invertebrates" and inv_families[0] != "invertebrates":
            score = min(inv, 20)
        add_score(scores, family, score)

    vend = float(source_percentages.get("Diet-Vend") or 0)
    for family in endotherm_families(ctx, vend):
        add_score(scores, family, vend)

    ect = float(source_percentages.get("Diet-Vect") or 0)
    vunk = float(source_percentages.get("Diet-Vunk") or 0)
    add_score(scores, "small_mammals", max(ect, vunk))
    add_score(scores, "fish", float(source_percentages.get("Diet-Vfish") or 0))
    add_score(scores, "carrion", float(source_percentages.get("Diet-Scav") or 0))
    add_score(scores, "fruit_berries", float(source_percentages.get("Diet-Fruit") or 0))
    add_score(scores, "nectar", float(source_percentages.get("Diet-Nect") or 0))
    add_score(scores, "seeds", float(source_percentages.get("Diet-Seed") or 0))
    add_score(scores, "aquatic_plants", float(source_percentages.get("Diet-PlantO") or 0))
    return {key: clean_percent(value) for key, value in sorted(scores.items()) if value > 0}


def primary_secondary(scores: dict[str, int | float]) -> tuple[list[str], list[str]]:
    if not scores:
        return [], ["invertebrates", "seeds", "fruit_berries"]
    max_score = max(float(value) for value in scores.values())
    primary = sorted(
        family
        for family, value in scores.items()
        if float(value) == max_score and float(value) > 0
    )
    secondary = sorted(
        family
        for family, value in scores.items()
        if family not in primary and float(value) > 0
    )
    return primary, secondary


def apply_species_refinement(
    scientific: str,
    scores: dict[str, int | float],
    primary: list[str],
    secondary: list[str],
) -> tuple[list[str], list[str], dict[str, int | float], str]:
    refinement = SPECIES_DIET_REFINEMENTS.get(scientific, {})
    for removed_family in refinement.get("remove", []):
        scores.pop(removed_family, None)
        primary = [family for family in primary if family != removed_family]
        secondary = [family for family in secondary if family != removed_family]
    for refined_family, refined_score in refinement.get("scores", {}).items():
        scores[refined_family] = clean_percent(refined_score)
    for refined_family in refinement.get("secondary", []):
        if refined_family not in primary and refined_family not in secondary:
            secondary.append(refined_family)
        if refined_family not in scores:
            scores[refined_family] = 1
    return primary, sorted(secondary), scores, refinement.get("education", "")


def prep_by_family(primary: list[str], secondary: list[str]) -> dict[str, str]:
    families = primary + [family for family in secondary if family not in primary]
    return {
        family: FOOD_FAMILIES[family]["defaultPrep"]
        for family in families
        if family in FOOD_FAMILIES
    }


def education_text(
    profile: dict[str, Any] | None,
    row: dict[str, str] | None,
    method: str,
    primary: list[str],
    secondary: list[str],
    fallback_reason: str | None,
) -> str:
    common = (profile or {}).get("name") or (row or {}).get("English") or "This bird"
    scientific = (profile or {}).get("scientificName") or (row or {}).get("Scientific") or ""
    if scientific == "Falco columbarius":
        return MERLIN_CONTEXT
    primary_text = ", ".join(primary) if primary else "no precise primary family"
    secondary_text = ", ".join(secondary) if secondary else "no secondary families"
    if method == "family-fallback":
        return (
            f"Family-level fallback for {common}: {fallback_reason}. "
            f"No species-level prey claim is made; use primary pattern {primary_text} "
            f"and secondary pattern {secondary_text}."
        )
    if method == "unmatched":
        return (
            f"Conservative unmatched fallback for {common}. No BirdFuncDat species or "
            "family row matched, so no species-level prey claim is made."
        )
    row_id = (row or {}).get("SpecID") or "unknown"
    return (
        f"Source-backed diet for {common} ({scientific}) from BirdFuncDat row {row_id}: "
        f"primary {primary_text}; secondary {secondary_text}."
    )


def source_ref(row: dict[str, str] | None) -> dict[str, Any] | None:
    if not row:
        return None
    return {
        "specId": row.get("SpecID"),
        "scientificName": row.get("Scientific"),
        "commonName": row.get("English"),
        "family": row.get("BLFamilyLatin"),
        "familyEnglish": row.get("BLFamilyEnglish"),
        "diet5Cat": row.get("Diet-5Cat"),
        "dietSource": row.get("Diet-Source"),
        "dietCertainty": row.get("Diet-Certainty"),
    }


def record_from_parts(
    *,
    record_id: str,
    profile: dict[str, Any] | None,
    row: dict[str, str] | None,
    method: str,
    source_percentages: dict[str, int | float] | None,
    fallback_reason: str | None = None,
    source_rows: int | None = None,
) -> dict[str, Any]:
    ctx = row_context(row, profile)
    scores = game_family_scores(source_percentages, ctx)
    primary, secondary = primary_secondary(scores)
    if method == "unmatched":
        primary = []
        secondary = ["invertebrates", "seeds", "fruit_berries"]
        scores = {family: 1 for family in secondary}
    scientific = (profile or {}).get("scientificName") or (row or {}).get("Scientific") or ctx["scientific"]
    score_values: dict[str, int | float] = dict(scores)
    primary, secondary, scores, refinement_education = apply_species_refinement(
        scientific, score_values, primary, secondary
    )
    refused = sorted(family for family in FOOD_FAMILIES if family not in set(primary + secondary))
    certainty = (row or {}).get("Diet-Certainty") or ("F" if method == "family-fallback" else "U")
    aliases = list(dict.fromkeys([str(a) for a in ((profile or {}).get("aliases") or []) if a]))
    name = (profile or {}).get("name") or (row or {}).get("English") or ctx["common"]
    family = (profile or {}).get("family") or (row or {}).get("BLFamilyLatin") or ctx["family"]
    return {
        "id": record_id,
        "name": name,
        "commonName": (profile or {}).get("commonName") or name,
        "scientificName": scientific,
        "scientific": scientific,
        "family": family,
        "aliases": aliases,
        "matchMethod": method,
        "certainty": certainty,
        "source": "EltonTraits 1.0 BirdFuncDat" if row or method == "family-fallback" else "conservative unmatched fallback",
        "sourceScientificName": (row or {}).get("Scientific"),
        "sourceCommonName": (row or {}).get("English"),
        "sourceRow": source_ref(row),
        "sourceRowsUsed": source_rows if source_rows is not None else (1 if row else 0),
        "fallbackReason": fallback_reason,
        "sourceDiet": source_percentages,
        "dietPercentages": source_percentages,
        "birdFuncDat": source_percentages,
        "gameFamilyScores": scores,
        "primaryDietCategories": primary,
        "secondaryDietCategories": secondary,
        "primaryCompatibleFamilies": primary,
        "secondaryCompatibleFamilies": secondary,
        "refusedCompatibleFamilies": refused,
        "compatibleIngredientFamilies": primary + [family for family in secondary if family not in primary],
        "prepByFamily": prep_by_family(primary, secondary),
        "education": education_text(profile, row, method, primary, secondary, fallback_reason) + refinement_education,
        "provenance": {
            "matchMethod": method,
            "sourceScientificName": (row or {}).get("Scientific"),
            "sourceCommonName": (row or {}).get("English"),
            "sourceRow": source_ref(row),
            "fallbackReason": fallback_reason,
            "sourceRowsUsed": source_rows if source_rows is not None else (1 if row else 0),
            "sourceSha256": EXPECTED_SHA256,
            "sourceLicense": SOURCE_METADATA["license"],
            "sourceDoi": SOURCE_METADATA["doi"],
        },
    }


def build_indices(rows: list[dict[str, str]]) -> dict[str, Any]:
    by_scientific: dict[str, dict[str, str]] = {}
    by_common: dict[str, dict[str, str]] = {}
    by_family: dict[str, list[dict[str, str]]] = defaultdict(list)
    for row in rows:
        by_scientific[norm(row.get("Scientific"))] = row
        by_common[norm(row.get("English"))] = row
        by_family[norm(row.get("BLFamilyLatin"))].append(row)
    return {
        "by_scientific": by_scientific,
        "by_common": by_common,
        "by_family": by_family,
    }


def match_profile(
    profile: dict[str, Any],
    indices: dict[str, Any],
) -> tuple[str, dict[str, str] | None, str | None, int | None, dict[str, int | float] | None]:
    scientific = norm(profile.get("scientificName") or profile.get("scientific"))
    if scientific in indices["by_scientific"]:
        row = indices["by_scientific"][scientific]
        return "exact", row, None, 1, diet_percentages(row)

    for alias in profile.get("aliases") or []:
        if is_scientific_alias(alias) and norm(alias) in indices["by_scientific"]:
            row = indices["by_scientific"][norm(alias)]
            return "scientific-alias", row, f"profile scientific alias {alias}", 1, diet_percentages(row)

    common_candidates = [
        profile.get("name"),
        profile.get("commonName"),
        *(alias for alias in (profile.get("aliases") or []) if not is_scientific_alias(alias)),
    ]
    for candidate in common_candidates:
        if norm(candidate) in indices["by_common"]:
            row = indices["by_common"][norm(candidate)]
            return "common-name", row, f"profile common-name token {candidate}", 1, diet_percentages(row)

    family_key = norm(profile.get("family"))
    family_rows = indices["by_family"].get(family_key) or []
    if family_rows:
        percentages = aggregate_percentages(family_rows)
        reason = f"matched {len(family_rows)} BirdFuncDat rows for family {profile.get('family')}"
        return "family-fallback", None, reason, len(family_rows), percentages

    return "unmatched", None, "no species, alias, common-name, or BirdFuncDat family match", 0, None


def source_record(row: dict[str, str]) -> dict[str, Any]:
    percentages = diet_percentages(row)
    ctx = row_context(row, None)
    scores = game_family_scores(percentages, ctx)
    primary, secondary = primary_secondary(scores)
    primary, secondary, scores, refinement_education = apply_species_refinement(
        str(row.get("Scientific") or ""), scores, primary, secondary
    )
    refinement = SPECIES_DIET_REFINEMENTS.get(str(row.get("Scientific") or ""), {})
    return {
        "i": "birdfuncdat-" + str(row.get("SpecID") or profile_id_for_scientific(row.get("Scientific") or "")),
        "n": row.get("English"),
        "s": row.get("Scientific"),
        "f": row.get("BLFamilyLatin"),
        "c": row.get("Diet-Certainty") or "U",
        "r": row.get("SpecID"),
        "p": percentages,
        "g": scores,
        "primary": primary,
        "secondary": secondary,
        "prep": prep_by_family(primary, secondary),
        "e": refinement_education,
        "x": refinement.get("source"),
    }


def build_payload(source_path: Path) -> tuple[dict[str, Any], dict[str, Any]]:
    sha, rows, raw_row_count = read_source(source_path)
    if sha != EXPECTED_SHA256:
        raise SystemExit(f"BirdFuncDat SHA mismatch: expected {EXPECTED_SHA256}, got {sha}")
    profiles = read_profiles(PROFILES_PATH)
    profile_ids = [profile.get("id") for profile in profiles]
    profile_scientific = [profile.get("scientificName") for profile in profiles]
    if len(profiles) != EXPECTED_PROFILE_COUNT:
        raise SystemExit(f"Expected {EXPECTED_PROFILE_COUNT} profiles, found {len(profiles)}")
    if len(set(profile_ids)) != len(profile_ids):
        raise SystemExit("profiles.json contains duplicate ids")
    if len(set(profile_scientific)) != len(profile_scientific):
        raise SystemExit("profiles.json contains duplicate scientific names")

    indices = build_indices(rows)
    records: list[dict[str, Any]] = []
    counts = Counter({method: 0 for method in MATCH_METHODS})
    fallback_list: list[dict[str, str]] = []
    unmatched_list: list[dict[str, str]] = []

    for profile in profiles:
        method, row, reason, source_rows, percentages = match_profile(profile, indices)
        counts[method] += 1
        record = record_from_parts(
            record_id=profile["id"],
            profile=profile,
            row=row,
            method=method,
            source_percentages=percentages,
            fallback_reason=reason,
            source_rows=source_rows,
        )
        records.append(record)
        if method == "family-fallback":
            fallback_list.append({
                "id": profile["id"],
                "name": profile.get("name") or "",
                "scientificName": profile.get("scientificName") or "",
                "family": profile.get("family") or "",
                "reason": reason or "",
            })
        if method == "unmatched":
            unmatched_list.append({
                "id": profile["id"],
                "name": profile.get("name") or "",
                "scientificName": profile.get("scientificName") or "",
                "family": profile.get("family") or "",
                "reason": reason or "",
            })

    merlin_row = indices["by_scientific"].get(norm("Falco columbarius"))
    if not merlin_row:
        raise SystemExit("BirdFuncDat is missing required Falco columbarius row")
    merlin_record = record_from_parts(
        record_id="merlin_falco_columbarius",
        profile={
            "id": "merlin_falco_columbarius",
            "name": "Merlin",
            "commonName": "Merlin",
            "scientificName": "Falco columbarius",
            "family": "Falconidae",
            "aliases": ["Falco columbarius", "Merlin"],
        },
        row=merlin_row,
        method="override",
        source_percentages=diet_percentages(merlin_row),
        fallback_reason="Permanent Merlin guide is not part of the 951 national catalogue profiles.",
        source_rows=1,
    )
    records.append(merlin_record)
    counts["override"] += 1

    source_records = [source_record(row) for row in rows]
    source_records.sort(key=lambda record: (record["s"] or "", record["n"] or ""))

    match_counts = {method: int(counts[method]) for method in MATCH_METHODS}
    metadata = {
        "version": DIET_VERSION,
        "generatedBy": "public/burbz/scripts/check_bird_diets.py",
        "source": {
            **SOURCE_METADATA,
            # Record a stable, repo-relative path so the artifact is byte-identical
            # no matter where the oracle was read from (/tmp vs committed cache).
            # The bytes are pinned by sha256 below, so the location is cosmetic.
            "path": CACHED_SOURCE.relative_to(ROOT).as_posix(),
            "sha256": sha,
            "rowCount": len(rows),
            "rawParsedRowCount": raw_row_count,
            "usableScientificRowCount": len(rows),
        },
        "profiles": {
            "path": PROFILES_PATH.relative_to(ROOT).as_posix(),
            "count": len(profiles),
            "uniqueIds": len(set(profile_ids)),
            "uniqueScientificNames": len(set(profile_scientific)),
        },
        "records": {
            "catalogueProfileCount": len(profiles),
            "permanentMerlinCount": 1,
            "totalGeneratedRecords": len(records),
            "sourceLookupRecords": len(source_records),
        },
        "matchCounts": match_counts,
        "foodFamilies": FOOD_FAMILIES,
        "mappingRules": {
            "primary": "highest nonzero mapped game-family percentage",
            "secondary": "all other nonzero mapped game-family percentages",
            "familyFallback": "mean BirdFuncDat diet percentages for the matched BLFamilyLatin",
            "unmatched": "low-certainty conservative gameplay fallback with no species-level claim",
        },
    }

    payload = {
        "metadata": metadata,
        "records": records,
        "sourceRecords": source_records,
        "fallbacks": {
            "family": fallback_list,
            "unmatched": unmatched_list,
        },
    }
    summary = {
        "metadata": metadata,
        "fallbacks": payload["fallbacks"],
        "merlin": merlin_record,
    }
    return payload, summary


def dumps_json(data: dict[str, Any]) -> str:
    # The 9,993-row global source table is reproducible from the pinned
    # BirdFuncDat artifact and is only needed while generating browser aliases.
    # Do not ship or commit that redundant table in the canonical record file.
    serializable = {key: value for key, value in data.items() if key != "sourceRecords"}
    return json.dumps(serializable, ensure_ascii=False, indent=2, sort_keys=True) + "\n"


RUNTIME_RECORD_FIELDS = (
    "id",
    "name",
    "commonName",
    "scientificName",
    "scientific",
    "sourceScientificName",
    "sourceCommonName",
    "aliases",
    "family",
    "matchMethod",
    "certainty",
    "primaryCompatibleFamilies",
    "secondaryCompatibleFamilies",
    "prepByFamily",
    "education",
    "sourceRowsUsed",
)


def game_wild_bird_names() -> list[str]:
    text = INDEX_PATH.read_text(encoding="utf-8")
    match = re.search(r"const WILD_BIRDS\s*=\s*\[(.*?)\n\];", text, flags=re.S)
    if not match:
        raise SystemExit("Could not parse WILD_BIRDS from index.html")
    return re.findall(r"'([^']+)'", match.group(1))


def runtime_source_records(payload: dict[str, Any], runtime_records: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Keep only BirdFuncDat rows needed by legacy in-page catalogue names."""
    indexed = set()
    for record in runtime_records:
        for key in (
            "id", "name", "commonName", "scientificName", "scientific",
            "sourceScientificName", "sourceCommonName",
        ):
            if record.get(key):
                indexed.add(norm(str(record[key])))
        indexed.update(norm(str(alias)) for alias in record.get("aliases", []))

    source_by_common = {norm(row.get("n")): row for row in payload.get("sourceRecords", [])}
    manual_common = {norm(key): value for key, value in GAME_BIRD_SOURCE_COMMON_NAMES.items()}
    supplements: list[dict[str, Any]] = []
    unresolved: list[str] = []
    for game_name in game_wild_bird_names():
        game_key = norm(game_name)
        if game_key in indexed:
            continue
        candidates = [
            manual_common.get(game_key),
            game_name,
            f"Common {game_name}",
            f"Eurasian {game_name}",
            f"European {game_name}",
            f"Australian {game_name}",
        ]
        source = next((source_by_common.get(norm(candidate)) for candidate in candidates if candidate and source_by_common.get(norm(candidate))), None)
        if not source:
            unresolved.append(game_name)
            continue
        supplement = dict(source)
        supplement["a"] = [game_name]
        supplements.append(supplement)
        indexed.add(game_key)
    if unresolved:
        raise SystemExit("No compact BirdFuncDat runtime mapping for WILD_BIRDS: " + ", ".join(unresolved))
    return supplements


def runtime_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return compact browser data; the full global source table stays build-only."""
    records = [
        {key: record[key] for key in RUNTIME_RECORD_FIELDS if key in record}
        for record in payload["records"]
    ]
    return {
        "metadata": payload["metadata"],
        "records": records,
        "sourceRecords": runtime_source_records(payload, records),
    }


def dumps_js(payload: dict[str, Any]) -> str:
    body = json.dumps(runtime_payload(payload), ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return (
        "/* Generated by scripts/check_bird_diets.py. Do not edit by hand. */\n"
        "(function(root){\n"
        f"  const payload = {body};\n"
        "  if (typeof module === 'object' && module.exports) module.exports = payload;\n"
        "  if (root) root.BURBZ_BIRD_DIET_RECORDS = payload;\n"
        "})(typeof globalThis !== 'undefined' ? globalThis : this);\n"
    )


def compare_or_write(path: Path, content: str, check: bool) -> bool:
    if check:
        if not path.exists():
            print(f"DRIFT missing {path.relative_to(ROOT)}")
            return False
        current = path.read_text(encoding="utf-8")
        if current != content:
            print(f"DRIFT changed {path.relative_to(ROOT)}")
            return False
        return True
    path.write_text(content, encoding="utf-8")
    return True


def print_report(payload: dict[str, Any], check: bool) -> None:
    meta = payload["metadata"]
    merlin = next(record for record in payload["records"] if record["scientificName"] == "Falco columbarius")
    print(f"BirdFuncDat SHA-256: {meta['source']['sha256']}")
    print(f"BirdFuncDat source rows: {meta['source']['rowCount']} usable scientific rows ({meta['source']['rawParsedRowCount']} raw parsed rows)")
    print(f"National profile count: {meta['profiles']['count']}")
    print(f"Generated diet records: {meta['records']['totalGeneratedRecords']}")
    print("Match counts:")
    for method in MATCH_METHODS:
        print(f"  {method}: {meta['matchCounts'][method]}")
    print(f"Family fallback list count: {len(payload['fallbacks']['family'])}")
    print(f"Unmatched fallback list count: {len(payload['fallbacks']['unmatched'])}")
    print("Merlin record:")
    print(
        "  Falco columbarius "
        f"Diet-Vend={merlin['sourceDiet']['Diet-Vend']} "
        f"Diet-Inv={merlin['sourceDiet']['Diet-Inv']} "
        f"certainty={merlin['certainty']} "
        f"primary={','.join(merlin['primaryCompatibleFamilies'])} "
        f"secondary={','.join(merlin['secondaryCompatibleFamilies'])}"
    )
    print("Check mode: " + ("enabled" if check else "disabled"))


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--check", action="store_true", help="verify generated artifacts instead of writing them")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="BirdFuncDat source path")
    args = parser.parse_args(argv)

    payload, summary = build_payload(args.source)
    json_content = dumps_json(payload)
    js_content = dumps_js(payload)
    summary_content = dumps_json(summary)

    ok = True
    ok = compare_or_write(JSON_OUT, json_content, args.check) and ok
    ok = compare_or_write(JS_OUT, js_content, args.check) and ok
    ok = compare_or_write(SUMMARY_OUT, summary_content, args.check) and ok
    print_report(payload, args.check)
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
