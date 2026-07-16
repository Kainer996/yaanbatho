#!/usr/bin/env python3
"""Build the 2026-07-15 national bird completion artifacts.

The generator is intentionally stdlib-only, including the XLSX reader used for
AVONET traits. Normalized checklist JSONs in the source directory are treated as
parser fixtures for the raw XLSX/PDF/TXT sources and are covered by raw-file
SHA-256 provenance in the emitted manifest.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import math
import re
import shutil
import statistics
import sys
import tempfile
from collections import Counter, defaultdict
from pathlib import Path
from xml.etree import ElementTree as ET
from zipfile import ZipFile


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = ROOT / "data" / "national-bird-completion" / "source-cache"
OUT_DIR = ROOT / "data" / "national-bird-completion"
ART_DIR = ROOT / "bird-art-cache" / "national-completion"
MODULE = ROOT / "national_bird_completion_20260715.js"
FORMULA_VERSION = "national-completion-stats-v2-20260715"
PARSER_VERSION = "national-completion-parser-v2-20260715"

HABITATS = {
    "water",
    "wetland",
    "woodland",
    "heath",
    "park",
    "farmland",
    "grassland",
    "urban",
    "coast",
    "hills",
    "default",
}
ALL_MONTHS = list(range(1, 13))
WINTER = [10, 11, 12, 1, 2, 3]
SUMMER = [3, 4, 5, 6, 7, 8, 9]
PASSAGE = [3, 4, 5, 8, 9, 10]
REGION_BOUNDS = {
    "uk": {"latMin": 49.0, "latMax": 61.0, "lonMin": -9.0, "lonMax": 3.0},
    "au": {"latMin": -44.0, "latMax": -10.0, "lonMin": 112.0, "lonMax": 154.5},
    "es": {"latMin": 35.8, "latMax": 43.9, "lonMin": -9.5, "lonMax": 4.5},
}
REGION_NAMES = {"uk": "United Kingdom", "au": "Australia", "es": "Spain"}

SYNONYM_DECISIONS = {
    "Charadrius asiaticus": "Anarhynchus asiaticus",
    "Charadrius leschenaultii": "Anarhynchus leschenaultii",
    "Charadrius alexandrinus": "Anarhynchus alexandrinus",
    "Steganopus tricolor": "Phalaropus tricolor",
    "Glareola\u00a0pratincola": "Glareola pratincola",
    "Catharacta maccormicki": "Stercorarius maccormicki",
    "Larus atricilla": "Leucophaeus atricilla",
    "Larus pipixcan": "Leucophaeus pipixcan",
}
SPLIT_DECISIONS = [
    {
        "left": "Cecropis rufula",
        "right": "Cecropis daurica",
        "decision": "do_not_merge",
        "reason": "AviList/eBird split is accepted here: European Red-rumped Swallow and Eastern Red-rumped Swallow remain separate even when broad common-name aliases collide.",
    }
]
AMBIGUOUS_ALIAS_OWNERS = {
    # The unqualified name is the canonical WLAB name of C. rufula. The eastern
    # split keeps only its qualified common name and scientific aliases.
    "Red-rumped Swallow": "Cecropis rufula",
}
EXCLUDED_AU_POPULATIONS = {"Failed introduction", "Domestic"}
SPAIN_EXCLUSIONS = {
    "Cairina moschata": "feral/domestic Muscovy Duck exclusion",
    "Fringilla teydea": "island endemic exclusion",
    "Regulus teneriffae": "island endemic exclusion",
    "Columba bollii": "island endemic exclusion",
    "Columba junoniae": "island endemic exclusion",
}
SOURCE_META = {
    "uk.xlsx": {
        "url": "https://bou.org.uk/british-list/",
        "retrieved": "2026-07-15",
        "description": "BOU British List 10th edition plus 58th report, categories A/B/C fixture.",
    },
    "au.xlsx": {
        "url": "https://birdlife.org.au/conservation/science/taxonomy/",
        "retrieved": "2026-07-15",
        "description": "BirdLife Australia Working List v4.3 fixture.",
    },
    "au-wlab-v4.3-species.json": {
        "url": "derived locally from au.xlsx WLAB sheet",
        "retrieved": "2026-07-15",
        "description": "Deterministic normalized BirdLife Australia WLAB v4.3 accepted species fixture.",
    },
    "missing-summary.json": {
        "url": "derived locally from normalized national checklist fixtures and pre-release effective taxonomy",
        "retrieved": "2026-07-15",
        "description": "Deterministic national missing-set summary used as a generated contract fixture.",
    },
    "nirbc-list-2020.html": {
        "url": "https://nirbc.blogspot.com/p/the-ni-list-test.html",
        "retrieved": "2026-07-15",
        "description": "Northern Ireland Birdwatchers' Association official Northern Ireland list HTML.",
    },
    "nirbc-abc-2020.json": {
        "url": "https://nirbc.blogspot.com/p/the-ni-list-test.html",
        "retrieved": "2026-07-15",
        "description": "Normalized NIRBC Category A/B/C identity fixture.",
    },
    "es.pdf": {
        "url": "https://seo.org/wp-content/uploads/2023/07/Lista-aves-10032023-OK.pdf",
        "retrieved": "2026-07-15",
        "description": "SEO/BirdLife official Spain checklist PDF.",
    },
    "es.txt": {
        "url": "https://seo.org/wp-content/uploads/2023/07/Lista-aves-10032023-OK.pdf",
        "retrieved": "2026-07-15",
        "description": "Text extraction of SEO/BirdLife official Spain checklist.",
    },
    "spain-adm0-geoboundaries-20260715.geojson": {
        "url": "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/ESP/ADM0/geoBoundaries-ESP-ADM0_simplified.geojson",
        "retrieved": "2026-07-15",
        "description": "geoBoundaries gbOpen Spain ADM0 simplified geometry sourced from Instituto Geografico Nacional; runtime module intentionally selects mainland and Balearic polygons only.",
    },
    "avonet.xlsx": {
        "url": "https://figshare.com/articles/dataset/AVONET_morphological_ecological_and_geographical_data_for_all_birds/16586228",
        "retrieved": "2026-07-15",
        "description": "AVONET Supplementary Dataset 1, eBird taxonomy sheet.",
    },
    "effective-catalogue.json": {
        "url": "local pre-release effective Burbz taxonomy export",
        "retrieved": "2026-07-15",
        "description": "Pre-release profile/name/alias snapshot.",
    },
    "spain-inat-species-counts.json": {
        "url": "https://api.inaturalist.org/v1/observations/species_counts?place_id=6774&taxon_id=3&quality_grade=research",
        "retrieved": "2026-07-15",
        "description": "Research-grade iNaturalist Spain species counts.",
    },
    "spain-selected-50.json": {
        "url": "https://api.inaturalist.org/v1/observations/species_counts?place_id=6774&taxon_id=3&quality_grade=research",
        "retrieved": "2026-07-15",
        "description": "Deterministic top-50 Spain additions fixture after official-list and exclusion filters.",
    },
    "spain-gbif-locality-grid-20260716.json": {
        "url": "https://api.gbif.org/v1/occurrence/search?country=ES&has_coordinate=true&occurrence_status=present",
        "retrieved": "2026-07-16",
        "description": "GBIF georeferenced Spanish occurrence samples aggregated into one-degree occupied cells for the selected 50 taxa.",
    },
    "wikipedia-field-guide-fixture.json": {
        "url": "https://en.wikipedia.org/w/api.php",
        "retrieved": "2026-07-15",
        "description": "Current English Wikipedia intro extracts/page URLs/revisions for all generated national completion profiles, CC BY-SA.",
    },
}
NIRBC_BOU_REPRESENTED_ALIASES = {
    "Balearic Shearwater": "Mediterranean Shearwater",
    "Bald Eagle": "White-tailed Eagle",
    "Hooded Crow": "Carrion Crow",
    "Subalpine Warbler": "Western Subalpine Warbler",
    "Lesser Redpoll": "Redpoll",
    "Red Fox Sparrow": "Fox Sparrow",
}
FAMILY_COGNITION = {
    "Corvidae": 10,
    "Psittacidae": 9,
    "Cacatuidae": 9,
    "Psittaculidae": 9,
    "Strigopidae": 9,
    "Ptilonorhynchidae": 8,
    "Accipitridae": 7,
    "Falconidae": 7,
    "Strigidae": 7,
    "Tytonidae": 7,
    "Laridae": 5,
}


def norm(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", (value or "").lower().replace("’", "'").replace("\u00a0", " "))


def slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", value.lower().replace("’", "_").replace("'", "_")).strip("_")


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def canonical_json_bytes(data: object) -> bytes:
    return (json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + "\n").encode("utf-8")


def load_json(source_dir: Path, name: str):
    return json.loads((source_dir / name).read_text(encoding="utf-8"))


def xlsx_rows(path: Path, sheet_name: str) -> list[dict[str, str]]:
    ns = {"a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    rns = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
    with ZipFile(path) as zf:
        strings: list[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for item in root.findall("a:si", ns):
                strings.append("".join(t.text or "" for t in item.findall(".//a:t", ns)))
        wb = ET.fromstring(zf.read("xl/workbook.xml"))
        rels = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        relmap = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels}
        sheet = next(s for s in wb.findall("a:sheets/a:sheet", ns) if s.attrib["name"] == sheet_name)
        target = "xl/" + relmap[sheet.attrib[f"{{{rns}}}id"]].lstrip("/")
        root = ET.fromstring(zf.read(target))
        rows: list[list[str]] = []
        for row in root.findall(".//a:sheetData/a:row", ns):
            cells = {}
            for cell in row.findall("a:c", ns):
                ref = cell.attrib.get("r", "")
                col = 0
                for ch in re.match(r"[A-Z]+", ref).group(0):
                    col = col * 26 + ord(ch) - 64
                v = cell.find("a:v", ns)
                value = "" if v is None else (v.text or "")
                if cell.attrib.get("t") == "s" and value:
                    value = strings[int(value)]
                cells[col - 1] = value
            if cells:
                rows.append([cells.get(i, "") for i in range(max(cells) + 1)])
        headers = [h.strip() for h in rows[0]]
        return [{headers[i]: row[i].strip() if i < len(row) else "" for i in range(len(headers))} for row in rows[1:]]


def fnum(row: dict[str, str], key: str, default: float | None = None) -> float | None:
    try:
        value = row.get(key, "")
        return float(value) if value != "" else default
    except ValueError:
        return default


def family_medians(avonet: dict[str, dict[str, object]]) -> dict[str, dict[str, float]]:
    grouped: dict[str, dict[str, list[float]]] = defaultdict(lambda: defaultdict(list))
    keys = ["Mass", "Beak.Length_Culmen", "Beak.Width", "Beak.Depth", "Tarsus.Length", "Wing.Length", "Hand-Wing.Index"]
    for row in avonet.values():
        family = row["family"]
        for key in keys:
            val = row["raw"].get(key)
            if isinstance(val, (int, float)):
                grouped[family][key].append(float(val))
    med = {}
    for family, cols in grouped.items():
        med[family] = {key: statistics.median(values) for key, values in cols.items() if values}
    return med


def load_avonet(source_dir: Path) -> tuple[dict[str, dict[str, object]], dict[str, dict[str, float]]]:
    spatial = {}
    for row in xlsx_rows(source_dir / "avonet.xlsx", "AVONET1_BirdLife"):
        sci = row.get("Species1", "").replace("\u00a0", " ").strip()
        if not sci:
            continue
        spatial[norm(sci)] = {
            "rangeSize": fnum(row, "Range.Size"),
            "centroidLatitude": fnum(row, "Centroid.Latitude"),
            "centroidLongitude": fnum(row, "Centroid.Longitude"),
            "sourceSheet": "AVONET1_BirdLife",
            "scientific": sci,
        }
    avonet = {}
    for row in xlsx_rows(source_dir / "avonet.xlsx", "AVONET2_eBird"):
        sci = row.get("Species2", "").replace("\u00a0", " ").strip()
        if not sci:
            continue
        raw = {k: fnum(row, k) for k in ("Mass", "Beak.Length_Culmen", "Beak.Width", "Beak.Depth", "Tarsus.Length", "Wing.Length", "Hand-Wing.Index")}
        avonet[norm(sci)] = {
            "scientific": sci,
            "family": row.get("Family2", ""),
            "order": row.get("Order2", ""),
            "raw": raw,
            "spatial": spatial.get(norm(sci)),
        }
    return avonet, family_medians(avonet)


def canonical_scientific(scientific: str) -> str:
    return SYNONYM_DECISIONS.get(scientific, SYNONYM_DECISIONS.get(scientific.replace("\u00a0", " "), scientific.replace("\u00a0", " ")))


def normalize_au_wlab(source_dir: Path) -> tuple[dict[str, object], dict[str, object]]:
    rows = xlsx_rows(source_dir / "au.xlsx", "WLAB")
    accepted = []
    supplementary_species = []
    no_confirmed = []
    for row in rows:
        taxon_level = str(row.get("TaxonLevel", "")).strip()
        supplementary = str(row.get("Supplementary", "")).strip()
        population = str(row.get("Population", "")).strip()
        if taxon_level.lower() != "sp":
            continue
        record = {
            "name": row.get("TaxonName", "").strip(),
            "scientific": row.get("TaxonScientificName", "").replace("\u00a0", " ").strip(),
            "population": population,
            "status": str(row.get("Australian IUCN RedListStatus_2020", "")).strip(),
            "spid": str(row.get("SpID", "")).strip(),
            "taxonId": str(row.get("TaxonID", "")).strip(),
            "avibaseId": str(row.get("ABD_Avibase ID", "")).strip(),
            "family": str(row.get("FamilyCommonName", "")).strip(),
            "familyScientific": str(row.get("FamilyScientificName", "")).strip(),
            "order": str(row.get("Order", "")).strip(),
            "taxonLevel": taxon_level,
            "supplementary": supplementary,
        }
        if supplementary:
            supplementary_species.append(record)
            continue
        if population == "No confirmed record":
            no_confirmed.append(record)
            continue
        accepted.append(record)
    accepted.sort(key=lambda r: int(r["spid"]) if str(r["spid"]).isdigit() else 999999)
    fixture = {
        "source": SOURCE_META["au.xlsx"]["url"],
        "version": "BirdLife Australia Working List v4.3",
        "scope": "WLAB sheet rows where TaxonLevel case-insensitively equals sp, Supplementary is blank and Population is not No confirmed record.",
        "sourceSpeciesCount": sum(1 for row in rows if str(row.get("TaxonLevel", "")).strip().lower() == "sp"),
        "count": len(accepted),
        "species": accepted,
    }
    exclusion = {
        "supplementary_species_count": len(supplementary_species),
        "supplementary_species": supplementary_species,
        "no_confirmed_record_species": no_confirmed,
    }
    return fixture, exclusion


def effective_identity_keys(effective: dict[str, object]) -> set[str]:
    keys: set[str] = set()
    for profile in effective.get("profiles", []):
        values = [profile.get("name"), profile.get("scientific"), *list(profile.get("aliases") or [])]
        for value in values:
            if not value:
                continue
            keys.add(norm(str(value)))
            keys.add(norm(canonical_scientific(str(value))))
    return keys


def derive_au_missing(au_fixture: dict[str, object], effective: dict[str, object]) -> list[dict[str, object]]:
    identities = effective_identity_keys(effective)
    missing = []
    for row in au_fixture["species"]:
        scientific = str(row["scientific"])
        name = str(row["name"])
        if norm(scientific) in identities or norm(canonical_scientific(scientific)) in identities or norm(name) in identities:
            continue
        missing.append(row)
    return missing


def nirbc_coverage(source_dir: Path, uk_fixture: dict[str, object]) -> dict[str, object]:
    nirbc = load_json(source_dir, "nirbc-abc-2020.json")
    uk_keys: set[str] = set()
    for row in uk_fixture["species"]:
        for key in ("scientific", "name", "internationalName", "international"):
            value = row.get(key)
            if value:
                uk_keys.add(norm(str(value)))
                uk_keys.add(norm(canonical_scientific(str(value))))
    unresolved = []
    represented = []
    for row in nirbc["species"]:
        values = [row.get("scientific"), row.get("name"), row.get("international")]
        if any(norm(str(value)) in uk_keys or norm(canonical_scientific(str(value))) in uk_keys for value in values if value):
            represented.append(row)
            continue
        alias = NIRBC_BOU_REPRESENTED_ALIASES.get(str(row.get("name", "")))
        if alias:
            represented.append({**row, "representedByBouAlias": alias})
            continue
        unresolved.append(row)
    return {"fixture": nirbc, "represented": represented, "unresolved": unresolved}


def choose_family_order(rows: list[dict[str, object]], avonet_row: dict[str, object] | None) -> tuple[str, str]:
    for row in rows:
        if row.get("familyScientific") or row.get("order"):
            return str(row.get("familyScientific") or ""), str(row.get("order") or "")
    if avonet_row:
        return str(avonet_row["family"]), str(avonet_row["order"])
    return "", ""


def classify_habitats(name: str, family: str, order: str, extract: str = "") -> list[str]:
    text = f"{name} {family} {order} {extract}".lower()
    habitats = set()
    if any(w in text for w in ["duck", "goose", "swan", "grebe", "diver", "cormorant", "pelican", "flamingo", "rail", "crake", "swamphen", "coot"]):
        habitats.update(["water", "wetland"])
    if any(w in text for w in ["gull", "tern", "skua", "auk", "petrel", "shearwater", "albatross", "frigate", "booby", "gannet", "shore", "sandpiper", "plover", "stint", "godwit", "curlew", "oystercatcher", "turnstone"]):
        habitats.update(["coast", "wetland"])
    if any(w in text for w in ["warbler", "woodpecker", "treecreeper", "owl", "cuckoo", "pigeon", "dove", "parrot", "lorikeet", "honeyeater", "kingfisher", "flycatcher", "thrush", "tit", "finch", "bunting"]):
        habitats.add("woodland")
    if any(w in text for w in ["lark", "pipit", "wagtail", "wheatear", "chat", "shrike", "starling", "rook", "crow", "magpie", "bustard", "grouse", "quail", "partridge", "pheasant"]):
        habitats.update(["grassland", "farmland"])
    if any(w in text for w in ["vulture", "eagle", "kite", "falcon", "harrier", "buzzard"]):
        habitats.update(["hills", "grassland"])
    if any(w in text for w in ["rainforest", "forest", "woodland", "eucalypt", "bushland", "taiga", "scrub", "mallee", "mangrove"]):
        habitats.add("woodland")
    if any(w in text for w in ["marsh", "swamp", "wetland", "reedbed", "estuary", "mudflat", "lagoon", "lake", "river"]):
        habitats.update(["wetland", "water"])
    if any(w in text for w in ["coast", "coastal", "seabird", "ocean", "marine", "island", "shore", "beach", "cliff"]):
        habitats.add("coast")
    if any(w in text for w in ["grassland", "steppe", "savanna", "pasture", "farmland", "arable", "cultivated"]):
        habitats.update(["grassland", "farmland"])
    if any(w in text for w in ["heath", "moor", "tundra", "alpine"]):
        habitats.add("heath")
    if any(w in text for w in ["urban", "city", "park", "garden", "suburban"]):
        habitats.update(["urban", "park"])
    if "parakeet" in text or "pigeon" in text or "starling" in text:
        habitats.add("urban")
    return sorted(habitats or {"default"})


def status_months(region: str, status: str, population: str, name: str) -> tuple[list[int], bool, str, int]:
    joined = f"{status} {population} {name}".lower()
    if "failed introduction" in joined or "domestic" in joined or "no confirmed record" in joined:
        return [], False, "excluded", 0
    if "extinct" in joined or "presumed extinct" in joined or "historical" in joined:
        return [], False, "rare_or_historical", 3
    if region == "uk":
        if "vagrant" in joined or "category b" in joined or "†" in joined or "bbrc" in joined:
            return PASSAGE, False, "exceptional_vagrant", 4
        return PASSAGE, False, "national_checklist_only", 6
    if "vagrant" in joined or "category b" in joined or "†" in joined or "bbrc" in joined:
        return PASSAGE, False, "exceptional_vagrant", 4
    if "non-breeding" in joined:
        return WINTER, False, "non_breeding_visitor", 12
    if any(w in joined for w in ["migrant", "summer"]):
        return SUMMER, True, "seasonal", 25
    return ALL_MONTHS, True, "ordinary", 55


def stat_formula(name: str, scientific: str, family: str, order: str, raw: dict[str, float], fallback: str) -> tuple[dict[str, int], dict[str, object]]:
    mass = float(raw.get("Mass") or 45.0)
    beak = float(raw.get("Beak.Length_Culmen") or 15.0) + float(raw.get("Beak.Width") or 5.0) + float(raw.get("Beak.Depth") or 6.0)
    hwi = float(raw.get("Hand-Wing.Index") or 25.0)
    wing = float(raw.get("Wing.Length") or 100.0)
    tarsus = float(raw.get("Tarsus.Length") or 25.0)
    fam = family or "unknown"
    lower = f"{name} {scientific} {family} {order}".lower()
    weapon = 0
    if any(w in lower for w in ["eagle", "falcon", "hawk", "vulture", "owl", "skua", "shrike", "heron", "egret", "ibis", "stork", "pelican"]):
        weapon = 2
    if any(w in lower for w in ["cassowary", "emu", "ostrich", "swan", "goose", "eider", "albatross"]):
        weapon = max(weapon, 1)
    migration = 2 if any(w in lower for w in ["albatross", "swift", "swallow", "martin", "tern", "shearwater", "petrel", "sandpiper", "plover", "godwit", "curlew"]) else 0
    if "vagrant" in lower:
        migration = max(migration, 1)
    trophic = 2 if any(w in lower for w in ["eagle", "falcon", "hawk", "owl", "vulture", "shrike", "skua"]) else 1 if any(w in lower for w in ["gull", "crow", "raven", "heron", "kingfisher"]) else 0
    cognition = FAMILY_COGNITION.get(fam, 6 if "Passeriformes" in order else 5)
    if fam == "Laridae" or "gull" in name.lower():
        cognition = min(cognition, 6)
    hp = clamp(round(1 + math.log10(max(mass, 1)) * 2))
    defense = clamp(round((hp + tarsus / 18 + (1 if "cryptic" in lower or "bittern" in lower else 0)) / 1.7))
    strength = clamp(round(1 + math.log10(max(mass, 1)) * 1.5 + beak / 30 + weapon + trophic))
    aerial_boost = 1 if any(w in lower for w in ["swift", "peregrine", "falcon", "frigatebird"]) else 0
    speed = clamp(round(2 + hwi / 15 + wing / 400 + aerial_boost))
    stamina = clamp(round(3 + hwi / 14 + math.log10(max(mass, 1)) * 0.5 + migration))
    if "albatross" in lower:
        stamina = max(stamina, 9)
    if "swift" in lower or "peregrine" in lower:
        speed = max(speed, 9)
    if "emu" in lower or "cassowary" in lower:
        strength = max(strength, 8)
        stamina = max(stamina, 8)
    if fam == "Corvidae":
        cognition = 10
    if fam in {"Psittacidae", "Cacatuidae", "Psittaculidae", "Strigopidae"}:
        cognition = max(cognition, 9)
    if fam == "Laridae":
        strength = min(strength, 7)
    stats = {"hp": hp, "stamina": stamina, "strength": strength, "def": defense, "spd": speed, "int": clamp(cognition)}
    detail = {
        "formulaVersion": FORMULA_VERSION,
        "fallback": fallback,
        "rawTraits": raw,
        "derivedInputs": {"mass": mass, "beakSum": beak, "hwi": hwi, "wing": wing, "tarsus": tarsus, "weapon": weapon, "trophic": trophic, "migration": migration, "familyCognitionTier": cognition},
        "formula": "v2: speed=2+HWI/15+wing/400 with documented aerial boosts; stamina=3+HWI/14+log10(mass)*0.5+migration; strength=1+log10(mass)*1.5+beakSum/30+weapon+trophic; hp=1+log10(mass)*2.",
    }
    return stats, detail


def clamp(value: float) -> int:
    return max(1, min(10, int(value)))


def load_wikipedia_fixture(source_dir: Path) -> dict[str, object]:
    fixture = load_json(source_dir, "wikipedia-field-guide-fixture.json")
    entries = fixture.get("entries")
    if not isinstance(entries, dict):
        raise ValueError("wikipedia-field-guide-fixture.json must contain an entries object")
    return fixture


def wikipedia_entry(entries: dict[str, object], scientific: str) -> dict[str, object]:
    entry = entries.get(scientific)
    if not isinstance(entry, dict) or not entry.get("extract") or not entry.get("url") or "revisionId" not in entry:
        raise ValueError(f"missing exact Wikipedia field-guide fixture for {scientific}")
    if entry.get("requestedScientific") != scientific:
        raise ValueError(f"Wikipedia fixture key/requestedScientific mismatch for {scientific}")
    if scientific == "Entomyzon albipennis" and str(entry.get("url", "")).startswith("https://absa.asn.au/"):
        return entry
    if "CC BY-SA" not in str(entry.get("license", "")):
        raise ValueError(f"Wikipedia fixture for {scientific} lacks CC BY-SA attribution")
    return entry


def intersect_bounds(a: dict[str, float], b: dict[str, float]) -> dict[str, float] | None:
    bounds = {
        "latMin": max(a["latMin"], b["latMin"]),
        "latMax": min(a["latMax"], b["latMax"]),
        "lonMin": max(a["lonMin"], b["lonMin"]),
        "lonMax": min(a["lonMax"], b["lonMax"]),
    }
    if bounds["latMin"] > bounds["latMax"] or bounds["lonMin"] > bounds["lonMax"]:
        return None
    return {k: round(v, 4) for k, v in bounds.items()}


def avonet_range_box(spatial: dict[str, object] | None, region: str, exact: bool) -> tuple[dict[str, float] | None, dict[str, object]]:
    if not spatial or not exact:
        return None, {
            "source": "AVONET Supplementary Dataset 1",
            "method": "unavailable_or_fallback",
            "spawnableEvidence": False,
            "reason": "No exact AVONET spatial identity; national checklist membership only.",
        }
    lat = spatial.get("centroidLatitude")
    lon = spatial.get("centroidLongitude")
    area = spatial.get("rangeSize")
    evidence = {
        "source": "AVONET Supplementary Dataset 1",
        "sourceSheet": spatial.get("sourceSheet"),
        "method": "centroid_plus_circular_equivalent_radius_intersected_with_region_bounds",
        "rangeSizeKm2": area,
        "centroidLatitude": lat,
        "centroidLongitude": lon,
        "spawnableEvidence": False,
    }
    if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)) or not isinstance(area, (int, float)) or area <= 0:
        evidence["reason"] = "Incomplete AVONET spatial fields."
        return None, evidence
    radius_km = math.sqrt(float(area) / math.pi)
    lat_radius = min(45.0, radius_km / 111.0)
    lon_radius = min(180.0, radius_km / max(20.0, 111.0 * abs(math.cos(math.radians(float(lat))))))
    raw = {
        "latMin": float(lat) - lat_radius,
        "latMax": float(lat) + lat_radius,
        "lonMin": float(lon) - lon_radius,
        "lonMax": float(lon) + lon_radius,
    }
    evidence["radiusKm"] = round(radius_km, 2)
    evidence["unclampedBounds"] = {k: round(v, 4) for k, v in raw.items()}
    bounded = intersect_bounds(raw, REGION_BOUNDS[region])
    if not bounded:
        evidence["reason"] = f"Centroid-derived range does not intersect {REGION_NAMES[region]} bounds."
        return None, evidence
    evidence["spawnableEvidence"] = True
    evidence["reason"] = f"Exact AVONET spatial identity intersects {REGION_NAMES[region]} bounds."
    return bounded, evidence


def build(source_dir: Path) -> dict[str, object]:
    avonet, medians = load_avonet(source_dir)
    wiki_fixture = load_wikipedia_fixture(source_dir)
    wiki_entries = wiki_fixture["entries"]
    missing = load_json(source_dir, "missing-summary.json")
    uk_fixture = load_json(source_dir, "uk-bou-abc-2025.json")
    es_fixture = load_json(source_dir, "spain-selected-50.json")
    es_locality = load_json(source_dir, "spain-gbif-locality-grid-20260716.json")
    inat = load_json(source_dir, "spain-inat-species-counts.json")
    effective = load_json(source_dir, "effective-catalogue.json")
    au_fixture, au_exclusion = normalize_au_wlab(source_dir)
    au_missing = derive_au_missing(au_fixture, effective)
    nirbc = nirbc_coverage(source_dir, uk_fixture)

    uk_rows = [{**r, "region": "uk", "status": r.get("category", ""), "population": "BOU A/B/C"} for r in missing["ukMissing"]]
    au_rows = [{**r, "region": "au"} for r in au_missing]
    es_rows = [{**r, "region": "es", "status": "SEO official; iNaturalist ranked", "population": "Spain selected top 50"} for r in es_fixture["species"]]
    memberships = uk_rows + au_rows + es_rows
    by_canon: dict[str, list[dict[str, object]]] = defaultdict(list)
    for row in memberships:
        row["canonicalScientific"] = canonical_scientific(str(row["scientific"]))
        by_canon[str(row["canonicalScientific"])].append(row)

    profiles = []
    education = {}
    stat_rows = []
    art_manifest = {}
    region_names = {"uk": [], "au": [], "es": []}
    for scientific in sorted(by_canon):
        rows = sorted(by_canon[scientific], key=lambda r: {"uk": 0, "au": 1, "es": 2}[str(r["region"])])
        primary = rows[0]
        name = str(primary["name"])
        avo = avonet.get(norm(scientific))
        trait_proxy_scientific = None
        # WLAB recognises White-quilled Honeyeater as a species while AVONET's
        # source taxonomy still carries the close Blue-faced Honeyeater record.
        # Morphology is safely proxied; range is not.
        if not avo and scientific == "Entomyzon albipennis":
            avo = avonet.get(norm("Entomyzon cyanotis"))
            trait_proxy_scientific = "Entomyzon cyanotis"
        wiki = wikipedia_entry(wiki_entries, scientific)
        family, order = choose_family_order(rows, avo)
        raw = dict(avo["raw"]) if avo else {}
        spatial = dict(avo["spatial"]) if avo and avo.get("spatial") else None
        fallback = "trait_proxy_scientific" if trait_proxy_scientific else "exact_scientific"
        if not avo:
            family = family or "unknown"
            median = medians.get(family, {})
            raw = {k: median.get(k, 45.0 if k == "Mass" else 20.0) for k in ("Mass", "Beak.Length_Culmen", "Beak.Width", "Beak.Depth", "Tarsus.Length", "Wing.Length", "Hand-Wing.Index")}
            fallback = "family_median" if median else "global_default"
            order = order or "unknown"
        elif not family:
            family, order = str(avo["family"]), str(avo["order"])
        habitats = classify_habitats(name, family, order, str(wiki["extract"]))
        countries = sorted({REGION_NAMES[str(r["region"])] for r in rows})
        region_data = {}
        commonness_values = []
        spawnable = False
        for r in rows:
            region = str(r["region"])
            months, can_spawn, status_class, commonness = status_months(region, str(r.get("status") or r.get("category") or ""), str(r.get("population") or ""), name)
            bounds = REGION_BOUNDS[region]
            range_evidence: dict[str, object] = {
                "source": "national_checklist",
                "method": "catalogue_membership_only",
                "spawnableEvidence": can_spawn,
            }
            spatial_cells = []
            if region == "au":
                if scientific == "Entomyzon albipennis" and can_spawn:
                    bounds = {"latMin": -22.5, "latMax": -10.0, "lonMin": 124.0, "lonMax": 139.5}
                    range_evidence = {
                        "source": "Australian Bird Study Association White-quilled Honeyeater species sheet",
                        "method": "authoritative_kimberley_top_end_northwest_queensland_bounds",
                        "spawnableEvidence": True,
                        "reason": "ABSA places the species from the Kimberley across the Top End to extreme north-west Queensland.",
                    }
                elif can_spawn:
                    au_bounds, range_evidence = avonet_range_box(spatial, region, fallback == "exact_scientific")
                    if au_bounds:
                        bounds = au_bounds
                    else:
                        can_spawn = False
                        status_class = "national_checklist_only" if status_class == "ordinary" else status_class
                        commonness = min(commonness, 6)
                else:
                    _, range_evidence = avonet_range_box(spatial, region, fallback == "exact_scientific")
                    range_evidence["spawnableEvidence"] = False
            elif region == "uk":
                can_spawn = False
                range_evidence = {
                    "source": "BOU British List national membership",
                    "method": "catalogue_recognition_only",
                    "spawnableEvidence": False,
                    "reason": "New UK national-list additions are not local map-spawn evidence.",
                }
            elif region == "es":
                locality = es_locality["species"].get(scientific, {})
                spatial_cells = list(locality.get("cells") or [])
                if spatial_cells:
                    bounds = {
                        "latMin": min(cell["latMin"] for cell in spatial_cells),
                        "latMax": max(cell["latMax"] for cell in spatial_cells),
                        "lonMin": min(cell["lonMin"] for cell in spatial_cells),
                        "lonMax": max(cell["lonMax"] for cell in spatial_cells),
                    }
                else:
                    can_spawn = False
                    status_class = "national_checklist_only"
                    commonness = min(commonness, 6)
                range_evidence = {
                    "source": "SEO/BirdLife official list, iNaturalist Spain ranking, and GBIF georeferenced Spanish occurrences",
                    "method": "gbif_observed_locality_grid",
                    "spawnableEvidence": can_spawn,
                    "reason": "Ordinary spawning is limited to one-degree cells containing sampled GBIF occurrences; national membership alone is not local spawn evidence.",
                    "sampledGeoreferenced": locality.get("sampledGeoreferenced", 0),
                    "taxonomyProxyScientific": locality.get("taxonomyProxyScientific"),
                }
            if region == "es":
                commonness = max(18, min(70, round(15 + math.log10(max(int(r.get("observations", 1)), 1)) * 12)))
            region_data[region] = {
                "name": r["name"],
                "scientific": r["scientific"],
                "status": r.get("status") or r.get("category") or r.get("population") or "accepted",
                "population": r.get("population", ""),
                "months": months,
                "habitats": habitats,
                "bounds": bounds,
                "spawnable": can_spawn,
                "statusClass": status_class,
                "commonness": commonness,
                "rangeEvidence": range_evidence,
            }
            if region == "es":
                region_data[region]["spatialCells"] = spatial_cells
            commonness_values.append(commonness)
            spawnable = spawnable or can_spawn
            region_names[region].append(str(r["name"]))
        stats, stat_detail = stat_formula(name, scientific, family, order, raw, fallback)
        if trait_proxy_scientific:
            stat_detail["scientificMatch"] = False
            stat_detail["traitProxyScientific"] = trait_proxy_scientific
            stat_detail["traitProxyReason"] = "Source-taxonomy proxy for the WLAB-recognised White-quilled Honeyeater split."
        if name == "Carrion Crow":
            stats["int"] = 10
        art_path = f"/burbz/bird-art-cache/national-completion/{slug(scientific)}_field_guide_art_pending_20260715.svg"
        aliases = sorted({scientific, *[str(r["scientific"]).replace("\u00a0", " ") for r in rows], *[str(r["name"]) for r in rows]})
        aliases = [alias for alias in aliases if AMBIGUOUS_ALIAS_OWNERS.get(alias, scientific) == scientific]
        profile = {
            "id": slug(scientific),
            "name": name,
            "scientific": scientific,
            "scientificName": scientific,
            "commonName": name,
            "family": family or "unknown",
            "order": order or "unknown",
            "countries": countries,
            "regionData": region_data,
            "spawnable": spawnable,
            "rarity": rarity(min(commonness_values)),
            "commonness": min(commonness_values),
            "aliases": aliases,
            "stats": stats,
            "traits": trait_labels(raw, family, order, fallback),
            "rationale": player_stat_rationale(name, raw, family, order),
            "sources": sources_for(rows, wiki),
            "origin": f"National completion profile from {', '.join(countries)} accepted checklist membership.",
            "habitat": ", ".join(habitats),
            "habitats": habitats,
            "months": sorted(set(m for rd in region_data.values() for m in rd["months"]), key=lambda m: (m - 1) % 12),
            "bounds": combined_bounds(region_data.values()),
            "range": range_text(name, region_data),
            "diet": diet_text(name, family, order),
            "conservation": conservation_text(rows),
            "art": art_path,
            "artProvenance": {
                "kind": "generated_placeholder",
                "license": "generated placeholder, not species-accurate plumage art",
                "source": "scripts/build_national_bird_completion.py",
                "path": art_path,
            },
            "statProvenance": {
                "source": "AVONET Supplementary Dataset 1 eBird sheet",
                "scientificMatch": bool(avo),
                "family": family or "unknown",
                "order": order or "unknown",
                "spatial": spatial,
                **stat_detail,
            },
            "wikipedia": wikipedia_profile_source(wiki),
        }
        profiles.append(profile)
        education[name] = education_entry(profile)
        stat_rows.append({"name": name, "scientific": scientific, "family": profile["family"], "order": profile["order"], "stats": stats, **profile["statProvenance"]})
        art_manifest[scientific] = {"name": name, "kind": "generated_placeholder", "license": "generated placeholder, no bird or plumage depiction", "source": "scripts/build_national_bird_completion.py", "path": art_path, "hash": None}

    profiles.sort(key=lambda p: p["scientific"])
    names = [p["name"] for p in profiles]
    region_names = {k: sorted(v) for k, v in region_names.items()}
    manifest = build_manifest(source_dir, uk_fixture, au_fixture, au_exclusion, nirbc, es_fixture, inat, effective, memberships, by_canon, profiles, au_missing)
    return {
        "version": "national-bird-completion-20260715",
        "profiles": profiles,
        "names": names,
        "regions": {"uk": {"names": region_names["uk"]}, "au": {"names": region_names["au"]}, "es": {"names": region_names["es"]}},
        "commonness": {p["name"]: p["commonness"] for p in profiles},
        "education": education,
        "stats": stat_rows,
        "artManifest": art_manifest,
        "manifest": manifest,
        "fixtures": {
            "ukAccepted": uk_fixture,
            "auAccepted": au_fixture,
            "missingSummary": {"ukMissing": missing["ukMissing"], "auMissing": au_missing},
            "spainSelected50": es_fixture,
            "spainInatCounts": inat,
            "wikipediaFieldGuide": wiki_fixture,
        },
    }


def rarity(commonness: int) -> str:
    if commonness <= 6:
        return "legendary"
    if commonness <= 15:
        return "epic"
    if commonness <= 35:
        return "rare"
    if commonness <= 70:
        return "uncommon"
    return "common"


def trait_labels(raw: dict[str, float], family: str, order: str, fallback: str) -> list[str]:
    return [
        f"mass {round(float(raw.get('Mass') or 0), 2)} g",
        f"hand-wing index {round(float(raw.get('Hand-Wing.Index') or 0), 2)}",
        f"family {family or 'unknown'}",
        f"order {order or 'unknown'}",
        f"trait source {fallback}",
    ]


def player_stat_rationale(name: str, raw: dict[str, float], family: str, order: str) -> str:
    mass = float(raw.get("Mass") or 45.0)
    hwi = float(raw.get("Hand-Wing.Index") or 25.0)
    wing = float(raw.get("Wing.Length") or 100.0)
    tarsus = float(raw.get("Tarsus.Length") or 25.0)
    bill = float(raw.get("Beak.Length_Culmen") or 15.0) + float(raw.get("Beak.Width") or 5.0) + float(raw.get("Beak.Depth") or 6.0)
    body = "large-bodied" if mass >= 1000 else "mid-sized" if mass >= 80 else "small-bodied"
    flight = "long-winged and built for sustained flight" if hwi >= 35 or wing >= 250 else "compact-winged and built for short agile movements"
    legs = "long-legged" if tarsus >= 45 else "short-legged"
    bill_text = "a heavy bill" if bill >= 55 else "a fine bill"
    cognition = "with high problem-solving potential for its group" if family in {"Corvidae", "Psittacidae", "Cacatuidae", "Psittaculidae", "Strigopidae", "Ptilonorhynchidae"} else "with cognition set from its broader bird family"
    migration = "Migration and wide-ranging flight lift stamina." if any(w in name.lower() for w in ["albatross", "swift", "swallow", "martin", "tern", "shearwater", "petrel", "sandpiper", "plover", "godwit", "curlew"]) else "Local movement style keeps stamina moderate."
    return f"{name} is treated as a {body}, {legs} bird with {bill_text}. It is {flight}, so body size, bill shape, leg length and flight style drive the battle stats, {cognition}. {migration}"


def wikipedia_profile_source(entry: dict[str, object]) -> dict[str, object]:
    return {
        "extract": entry["extract"],
        "url": entry["url"],
        "pageTitle": entry.get("pageTitle"),
        "pageid": entry.get("pageid"),
        "revisionId": entry.get("revisionId"),
        "revisionTimestamp": entry.get("revisionTimestamp"),
        "retrieved": entry.get("retrieved"),
        "license": entry.get("license"),
        "requestedScientific": entry.get("requestedScientific"),
    }


def sources_for(rows: list[dict[str, object]], wiki: dict[str, object]) -> list[str]:
    urls = []
    for r in rows:
        region = r["region"]
        if region == "uk":
            urls.extend([SOURCE_META["uk.xlsx"]["url"], SOURCE_META["avonet.xlsx"]["url"]])
        elif region == "au":
            urls.extend([SOURCE_META["au.xlsx"]["url"], SOURCE_META["avonet.xlsx"]["url"]])
        else:
            urls.extend([SOURCE_META["es.pdf"]["url"], SOURCE_META["spain-inat-species-counts.json"]["url"], SOURCE_META["avonet.xlsx"]["url"]])
    urls.append(str(wiki["url"]))
    return sorted(set(urls))


def combined_bounds(region_values) -> dict[str, float]:
    vals = [rd["bounds"] for rd in region_values]
    return {"latMin": min(v["latMin"] for v in vals), "latMax": max(v["latMax"] for v in vals), "lonMin": min(v["lonMin"] for v in vals), "lonMax": max(v["lonMax"] for v in vals)}


def range_text(name: str, region_data: dict[str, object]) -> str:
    parts = []
    for r, rd in region_data.items():
        evidence = rd.get("rangeEvidence", {})
        method = str(evidence.get("method", "catalogue_membership_only")).replace("_", " ")
        parts.append(f"{REGION_NAMES[r]}: {rd['statusClass'].replace('_', ' ')} using {method}")
    return f"{name} range handling is source-labelled and conservative. " + "; ".join(parts) + "."


def diet_text(name: str, family: str, order: str) -> str:
    text = f"{name} {family} {order}".lower()
    if any(w in text for w in ["eagle", "falcon", "hawk", "owl", "vulture", "shrike", "kingfisher"]):
        return "Primarily animal prey; exact local diet is not inferred beyond broad trophic context."
    if any(w in text for w in ["duck", "goose", "swan", "finch", "bunting", "parrot", "pigeon", "dove"]):
        return "Mostly plant material or seeds with seasonal invertebrates where typical for the group."
    if any(w in text for w in ["gull", "tern", "shore", "sandpiper", "plover", "heron", "egret"]):
        return "Aquatic or coastal invertebrates, fish or opportunistic food according to broad group ecology."
    return "Broad omnivorous or invertebrate-feeding context from family ecology; no fabricated local prey details."


def conservation_text(rows: list[dict[str, object]]) -> str:
    statuses = sorted({str(r.get("status") or r.get("category") or r.get("population") or "accepted") for r in rows})
    return "Checklist status: " + "; ".join(statuses)


def education_entry(profile: dict[str, object]) -> dict[str, object]:
    wiki = profile["wikipedia"]
    extract = str(wiki["extract"])
    return {
        "title": profile["name"],
        "scientificName": profile["scientificName"],
        "summary": extract,
        "wikipediaExtract": extract,
        "wikipediaAttribution": {
            "url": wiki["url"],
            "license": wiki["license"],
            "revisionId": wiki["revisionId"],
            "revisionTimestamp": wiki["revisionTimestamp"],
            "retrieved": wiki["retrieved"],
            "pageTitle": wiki["pageTitle"],
        },
        "taxonomy": f"{profile['order']} / {profile['family']}; canonical scientific name {profile['scientificName']}.",
        "identification": f"Sourced field-guide context from Wikipedia identifies this entry as {profile['scientificName']} and records: {extract[:420].rstrip()}",
        "behaviour": f"Game stats are derived from AVONET morphology and a fixed ecology rubric. {profile['rationale']}",
        "habitat": profile["habitat"],
        "diet": profile["diet"],
        "breeding": "Breeding or visit status is represented only when the source checklist status supports it.",
        "range": profile["range"],
        "conservation": profile["conservation"],
        "morphology": profile["traits"],
        "learningNotes": [
            "This is a national-checklist completion entry, not a claim of local abundance.",
            "Rare and vagrant memberships are not ordinary local spawns.",
            "Placeholder art is explicitly pending and does not depict plumage.",
            "Stats are deterministic from AVONET traits or documented family-median fallback.",
        ],
        "sources": [{"url": url} for url in profile["sources"]],
    }


def build_manifest(source_dir: Path, uk_fixture, au_fixture, au_exclusion, nirbc, es_fixture, inat, effective, memberships, by_canon, profiles, au_missing) -> dict[str, object]:
    raw_union = {str(r["scientific"]) for r in memberships}
    normalized_union = {str(r["scientific"]).replace("\u00a0", " ") for r in memberships}
    source_files = {}
    for name, meta in SOURCE_META.items():
        path = source_dir / name
        source_files[name] = {**meta, "sha256": sha256(path), "bytes": path.stat().st_size}
    generated_source_fixtures = {
        "au-wlab-v4.3-species.json": au_fixture,
        "missing-summary.json": {"ukMissing": load_json(source_dir, "missing-summary.json")["ukMissing"], "auMissing": au_missing},
    }
    for name, data in generated_source_fixtures.items():
        raw = canonical_json_bytes(data)
        source_files[name]["sha256"] = hashlib.sha256(raw).hexdigest()
        source_files[name]["bytes"] = len(raw)
    uk = [r for r in memberships if r["region"] == "uk"]
    au = [r for r in memberships if r["region"] == "au"]
    es = [r for r in memberships if r["region"] == "es"]
    shared = sum(1 for rows in by_canon.values() if len(rows) > 1)
    return {
        "version": "national-bird-completion-20260715",
        "parserVersion": PARSER_VERSION,
        "sourceFiles": source_files,
        "contracts": {
            "uk": {"accepted": 636, "pre_existing": 282, "missing": len(uk), "membership_added": len(uk), "unresolved": 0},
            "au": {
                "accepted": len(au_fixture["species"]),
                "pre_existing": len(au_fixture["species"]) - len(au_missing),
                "missing": len(au),
                "membership_added": len(au),
                "unresolved": 0,
                "supplementary_excluded": au_exclusion["supplementary_species_count"],
                "no_confirmed_record_excluded": sorted(r["scientific"] for r in au_exclusion["no_confirmed_record_species"]),
            },
            "es": {"accepted_selection": 50, "pre_existing_removed": True, "membership_added": len(es), "unresolved": 0},
            "taxonomy": {"regional_memberships": len(memberships), "raw_exact_binomial_union": len(raw_union), "nbsp_normalized_union": len(normalized_union), "unique_profiles": len(profiles), "shared_profile_groups": shared, "alias_resolved": len(memberships) - len(profiles), "unresolved": 0},
            "nirbc": {"accepted_abc": len(nirbc["fixture"]["species"]), "covered_by_bou": len(nirbc["represented"]), "northern_ireland_only_unresolved": len(nirbc["unresolved"])},
        },
        "synonymDecisions": [{"from": k, "to": v, "decision": "merge"} for k, v in SYNONYM_DECISIONS.items()],
        "splitDecisions": SPLIT_DECISIONS,
        "spainRanking": {
            "sourceCount": len(inat["species"]),
            "sort": "observations desc, scientific asc",
            "exclusions": SPAIN_EXCLUSIONS,
            "selectedFirst50Scientific": [r["scientific"] for r in es_fixture["species"]],
        },
        "effectiveCatalogue": {"sourceProfiles": len(effective["profiles"]), "sha256": source_files["effective-catalogue.json"]["sha256"]},
        "wikipediaFieldGuide": {
            "entries": len(load_json(source_dir, "wikipedia-field-guide-fixture.json")["entries"]),
            "sha256": source_files["wikipedia-field-guide-fixture.json"]["sha256"],
            "license": "Mixed: CC BY-SA 4.0 for Wikipedia entries; Entomyzon albipennis uses a cited Australian Bird Study Association field-guide source.",
        },
        "generated": {"profiles": len(profiles), "educationEntries": len(profiles), "artPlaceholders": len(profiles)},
    }


def placeholder_svg(profile: dict[str, object]) -> str:
    title = profile["name"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    sci = profile["scientificName"].replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512" role="img" aria-label="Field guide art pending placeholder for {title}">
  <rect width="512" height="512" fill="#f4f1e8"/>
  <rect x="24" y="24" width="464" height="464" fill="none" stroke="#2f3a3f" stroke-width="6" stroke-dasharray="18 12"/>
  <text x="256" y="164" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#2f3a3f">FIELD GUIDE ART</text>
  <text x="256" y="210" text-anchor="middle" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#2f3a3f">PENDING</text>
  <text x="256" y="284" text-anchor="middle" font-family="Arial, sans-serif" font-size="22" fill="#445158">{title}</text>
  <text x="256" y="322" text-anchor="middle" font-family="Arial, sans-serif" font-size="17" font-style="italic" fill="#445158">{sci}</text>
  <text x="256" y="392" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" fill="#5d696f">No bird or plumage depiction.</text>
</svg>
'''


def js_module(payload: dict[str, object]) -> str:
    public = {k: payload[k] for k in ("version", "profiles", "names", "regions", "commonness")}
    return """/* Generated by scripts/build_national_bird_completion.py. Do not edit by hand. */
(function(root, factory) {
  const expansion = factory();
  if (typeof module === 'object' && module.exports) module.exports = expansion;
  if (root) root.BURBZ_NATIONAL_BIRD_COMPLETION_20260715 = expansion;
})(typeof window !== 'undefined' ? window : globalThis, function() {
  'use strict';
  const data = __DATA__;
  const byName = new Map();
  data.profiles.forEach(profile => {
    byName.set(profile.name.toLowerCase(), profile);
    (profile.aliases || []).forEach(alias => byName.set(String(alias).toLowerCase(), profile));
  });
  function addUnique(list, name) { if (Array.isArray(list) && !list.includes(name)) list.push(name); }
  function addToRegionalPools(regionPools) {
    if (!regionPools) return;
    Object.keys(data.regions).forEach(region => {
      const target = regionPools[region];
      if (!target) return;
      data.profiles.forEach(profile => {
        const regional = profile.regionData[region];
        if (!regional || regional.spawnable !== true) return;
        (regional.habitats || ['default']).forEach(habitat => {
          const key = target[habitat] ? habitat : 'default';
          if (!target[key]) target[key] = [];
          addUnique(target[key], profile.name);
        });
      });
    });
  }
  function addToHabitatPools(pools) {
    if (!pools) return;
    data.profiles.forEach(profile => (profile.habitats || ['default']).forEach(habitat => {
      const key = pools[habitat] ? habitat : 'default';
      if (!pools[key]) pools[key] = [];
      addUnique(pools[key], profile.name);
    }));
  }
  function inBounds(bounds, lat, lon) {
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= bounds.latMin && lat <= bounds.latMax && lon >= bounds.lonMin && lon <= bounds.lonMax;
  }
  function isEligible(region, name, lat, lon, month, habitat) {
    const profile = byName.get(String(name || '').toLowerCase());
    if (!profile || !data.regions[region]) return false;
    const rd = profile.regionData && profile.regionData[region];
    if (!rd || !rd.spawnable) return false;
    if (!inBounds(rd.bounds, Number(lat), Number(lon))) return false;
    if (rd.spatialCells && rd.spatialCells.length && !rd.spatialCells.some(cell => inBounds(cell, Number(lat), Number(lon)))) return false;
    if (!rd.months.includes(Number(month))) return false;
    if (habitat && rd.habitats && rd.habitats.length && !rd.habitats.includes(habitat) && !rd.habitats.includes('default')) return false;
    return true;
  }
  return Object.assign({}, data, { addToRegionalPools, addToHabitatPools, isEligible });
});
""".replace("__DATA__", json.dumps(public, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


def write_outputs(payload: dict[str, object], root: Path) -> None:
    out = root / "data" / "national-bird-completion"
    art = root / "bird-art-cache" / "national-completion"
    out.mkdir(parents=True, exist_ok=True)
    art.mkdir(parents=True, exist_ok=True)
    files = {
        out / "manifest.json": payload["manifest"],
        out / "profiles.json": payload["profiles"],
        out / "education.json": payload["education"],
        out / "stat-provenance.json": payload["stats"],
        out / "art-manifest.json": payload["artManifest"],
        out / "uk-accepted-fixture.json": payload["fixtures"]["ukAccepted"],
        out / "au-accepted-fixture.json": payload["fixtures"]["auAccepted"],
        out / "spain-selected-50-fixture.json": payload["fixtures"]["spainSelected50"],
        out / "spain-ranked-candidates-fixture.json": payload["fixtures"]["spainInatCounts"],
        out / "wikipedia-field-guide-fixture.json": payload["fixtures"]["wikipediaFieldGuide"],
        out / "taxonomy-decisions.json": {"synonymDecisions": payload["manifest"]["synonymDecisions"], "splitDecisions": payload["manifest"]["splitDecisions"]},
        out / "source-cache" / "au-wlab-v4.3-species.json": payload["fixtures"]["auAccepted"],
        out / "source-cache" / "missing-summary.json": payload["fixtures"]["missingSummary"],
    }
    for path, data in files.items():
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    for profile in payload["profiles"]:
        rel = profile["art"].replace("/burbz/", "")
        path = root / rel
        path.write_text(placeholder_svg(profile), encoding="utf-8")
    # Fill art hashes after SVGs exist, then rewrite the manifest.
    art_manifest = payload["artManifest"]
    for scientific, row in art_manifest.items():
        path = root / row["path"].replace("/burbz/", "")
        row["hash"] = sha256(path)
    (out / "art-manifest.json").write_text(json.dumps(art_manifest, ensure_ascii=False, sort_keys=True, indent=2) + "\n", encoding="utf-8")
    (root / "national_bird_completion_20260715.js").write_text(js_module(payload), encoding="utf-8")


def compare_trees(expected_root: Path, actual_root: Path) -> list[str]:
    diffs = []
    paths = [
        "national_bird_completion_20260715.js",
        "data/national-bird-completion/manifest.json",
        "data/national-bird-completion/profiles.json",
        "data/national-bird-completion/education.json",
        "data/national-bird-completion/stat-provenance.json",
        "data/national-bird-completion/art-manifest.json",
        "data/national-bird-completion/uk-accepted-fixture.json",
        "data/national-bird-completion/au-accepted-fixture.json",
        "data/national-bird-completion/spain-selected-50-fixture.json",
        "data/national-bird-completion/spain-ranked-candidates-fixture.json",
        "data/national-bird-completion/wikipedia-field-guide-fixture.json",
        "data/national-bird-completion/taxonomy-decisions.json",
        "data/national-bird-completion/source-cache/au-wlab-v4.3-species.json",
        "data/national-bird-completion/source-cache/missing-summary.json",
    ]
    for path in (expected_root / "bird-art-cache" / "national-completion").glob("*.svg"):
        paths.append(str(path.relative_to(expected_root)))
    for rel in paths:
        a, b = expected_root / rel, actual_root / rel
        if not b.exists():
            diffs.append(f"missing {rel}")
        elif a.read_bytes() != b.read_bytes():
            diffs.append(f"changed {rel}")
    return diffs


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args(argv)
    payload = build(args.source_dir)
    if args.check:
        with tempfile.TemporaryDirectory() as td:
            temp_root = Path(td) / "root"
            temp_root.mkdir()
            write_outputs(payload, temp_root)
            diffs = compare_trees(temp_root, ROOT)
        if diffs:
            print("national bird completion artifacts are not deterministic/current:", file=sys.stderr)
            for diff in diffs[:50]:
                print(diff, file=sys.stderr)
            return 1
        print("national bird completion artifacts are current")
        return 0
    write_outputs(payload, ROOT)
    print(f"wrote {len(payload['profiles'])} profiles, {len(payload['education'])} education entries and {len(payload['artManifest'])} SVG placeholders")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
