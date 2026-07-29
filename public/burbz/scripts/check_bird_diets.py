#!/usr/bin/env python3
"""Generate and verify source-backed Burbz diet records.

The oracle is EltonTraits 1.0 BirdFuncDat at /tmp/BirdFuncDat.txt. The script
produces deterministic JSON plus a browser-friendly JS wrapper, and --check
fails if the source hash, catalogue count, match counts, or generated files
drift.
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
DEFAULT_SOURCE = Path("/tmp/BirdFuncDat.txt")
PROFILES_PATH = ROOT / "data" / "national-bird-completion" / "profiles.json"
INDEX_PATH = ROOT / "index.html"
JSON_OUT = ROOT / "data" / "bird-diet-records.json"
JS_OUT = ROOT / "data" / "bird-diet-records.js"
SUMMARY_OUT = ROOT / "data" / "bird-diet-provenance-summary.json"

EXPECTED_SHA256 = "97216eb1797da077169ebb1ebea275db293b09fc62f8bb8911f9beb98c50d321"
EXPECTED_PROFILE_COUNT = 951
DIET_VERSION = "diet-hunger-20260723"

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
    # Area-roster names whose BirdFuncDat row is filed under another vernacular.
    "lesser redpoll": "Common Redpoll",
    "kittiwake": "Black-legged Kittiwake",
    "dollarbird": "Asian Dollarbird",
    "bush stone-curlew": "Bush Thick-knee",
}

# Where a bare game name is ambiguous across BirdFuncDat's vernaculars, pin the
# species outright. "Magpie" means Pica pica in a British garden, but the
# generic "Australian <name>" candidate used to win the race and fed the UK
# Magpie an Australian Magpie's diet. BirdFuncDat also files two species as
# "Black-billed Magpie", so the common name alone cannot settle it either.
GAME_BIRD_SOURCE_SCIENTIFIC_NAMES = {
    "magpie": "Pica pica",
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

# BirdFuncDat files every invertebrate on earth — earthworm, mayfly, mussel,
# caterpillar — in one Diet-Inv column, so the column alone cannot say whether
# a bird takes a worm or a midge. These columns can: they record WHERE the bird
# forages, and where a bird forages decides which invertebrates it gets.
FORSTRAT_COLUMNS = [
    "ForStrat-watbelowsurf",
    "ForStrat-wataroundsurf",
    "ForStrat-ground",
    "ForStrat-understory",
    "ForStrat-midhigh",
    "ForStrat-canopy",
    "ForStrat-aerial",
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

# Families that bring shellfish up out of ground-level mud and shingle.
# BirdFuncDat files a mudflat probe as "ground", so without this an
# Oystercatcher would score earthworms and no cockles at all.
SHELLFISH_FROM_GROUND_FAMILIES = (
    FAMILY_HINTS["shore_invertebrate"] | FAMILY_HINTS["aquatic_invertebrate"]
)

# Birds that take their insects out of the air, whatever height band
# BirdFuncDat filed them under. ForStrat records the HEIGHT a bird feeds at,
# not whether its feet ever touch down, so a Barn Swallow hawking low over a
# meadow is logged as "ground" — and a naive read of that column would hand a
# swallow an earthworm. Their whole invertebrate share is flying insects.
AERIAL_HAWKER_FAMILIES = {
    "Apodidae",
    "Hemiprocnidae",
    "Hirundinidae",
    "Caprimulgidae",
    "Aegothelidae",
    "Podargidae",
    "Nyctibiidae",
    "Meropidae",
}
AERIAL_HAWKER_NAME_HINT = (
    r"\b(swift|swiftlet|swallow|martin|nightjar|nighthawk|bee-?eater|flycatcher)\b"
)

# Worms, flying insects and shellfish are claims about a particular habitat, so
# the game only makes them when a real share of the bird's foraging happens
# where that food lives. A Blue Tit spends a tenth of its time on the ground;
# that is a bird hopping over a lawn, not a bird pulling earthworms.
INVERTEBRATE_SUBFAMILY_MIN_SHARE = 0.25

# ---------------------------------------------------------------------------
# Curated corrections, keyed by BirdFuncDat scientific name.
#
# BirdFuncDat is a global trait table built to a ten-column budget, and for the
# handful of birds a Burbz player meets every single day that budget shows.
# It records no fruit at all for a Carrion Crow, no fish for a Great
# Black-backed Gull, and 40% seed for a Treecreeper. Each entry below states
# which way the source is wrong for that species and why, and the reason ships
# with the record so the game can say out loud where a claim came from.
#
#   promote -> force into the primary (full-meal) set
#   add     -> force into the secondary (half-meal) set
#   demote  -> real food, but the source overstates it into a main meal
#   remove  -> the source claims a food this species does not actually take
# ---------------------------------------------------------------------------
DIET_CORRECTIONS: dict[str, dict[str, Any]] = {
    # --- Corvids: omnivores whose fruit and grain columns read zero ---------
    "Corvus corone": {
        "promote": ["carrion"],
        "add": ["fruit_berries", "molluscs_crustaceans", "fish"],
        "reason": (
            "A Carrion Crow is one of the most catholic feeders in Britain: "
            "earthworms and grubs off pasture, carrion it is named for, spilt "
            "grain, windfall fruit, shore shellfish dropped onto rock, and "
            "stranded fish. BirdFuncDat scores its fruit and fish columns at "
            "zero, which the crow itself does not respect."
        ),
    },
    "Corvus frugilegus": {
        "add": ["fruit_berries"],
        "reason": "Rooks work stubble and orchards as well as pasture; the source records no fruit column at all.",
    },
    "Pica pica": {
        "promote": ["invertebrates"],
        "add": ["fruit_berries", "seeds"],
        "reason": "A Magpie lives on invertebrates through the summer and turns to carrion, scraps, fruit and grain the rest of the year — beetles and leatherjackets are a main meal, not a side one.",
    },
    "Garrulus glandarius": {
        "promote": ["seeds"],
        "reason": "The Jay is an acorn specialist — it caches thousands each autumn and plants oak woods doing it. Acorns are a main meal, not a side dish.",
    },
    # --- Large gulls: the textbook "eats almost anything" birds -------------
    "Larus argentatus": {
        "add": ["seeds", "fruit_berries", "aquatic_plants"],
        "reason": (
            "The Herring Gull is the definitive omnivore of the British coast "
            "and of every chip shop behind it: fish, crabs, worms off playing "
            "fields, carrion, grain, berries, and whatever a bin holds. The "
            "source's plant columns are all zero, which no seaside town would "
            "recognise."
        ),
    },
    "Larus fuscus": {
        "add": ["seeds"],
        "reason": "Lesser Black-backed Gulls follow the plough and raid landfill as readily as they fish.",
    },
    "Larus marinus": {
        "promote": ["fish"],
        "reason": "The source records no fish for the Great Black-backed Gull. It is the largest gull in the world and takes fish, seabirds and carrion alike.",
    },
    "Larus canus": {
        "add": ["seeds", "fruit_berries"],
        "reason": "Common Gulls feed inland on grassland invertebrates, grain and berries through the winter.",
    },
    "Larus ridibundus": {
        "add": ["carrion", "fruit_berries"],
        "reason": "Black-headed Gulls scavenge scraps and take autumn fruit as well as following the plough for worms.",
    },
    # A deliberate counterweight: not every gull is a bin bird, and the game
    # should teach the difference.
    "Rissa tridactyla": {
        "remove": ["small_birds", "small_mammals", "seeds", "aquatic_plants"],
        "reason": (
            "The Kittiwake is the one British gull that lives at sea. It takes "
            "fish and plankton off the surface and does not scavenge, follow "
            "ploughs, or come to bread — the seed and vertebrate columns are "
            "artefacts of a family-wide estimate."
        ),
    },
    # --- Foraging-height artefacts in the source ---------------------------
    "Parus ater": {
        "remove": ["worms"],
        "reason": "The source files the Coal Tit as a 100% ground forager. It is a conifer specialist that works needles and cones, and it does not pull earthworms.",
    },
    "Certhia familiaris": {
        "promote": ["invertebrates"],
        "demote": ["seeds"],
        "remove": ["worms"],
        "reason": "The source gives the Treecreeper 40% seed. It is a bark-crevice insectivore that spirals up trunks after spiders and grubs; seed is an occasional winter feeder visit at most.",
    },
    "Sitta europaea": {
        "promote": ["seeds"],
        "remove": ["worms"],
        "reason": "Nuthatches wedge nuts and seeds into bark to hammer them open and cache them for winter — that is a main meal. They work trunks, not soil.",
    },
    "Fringilla coelebs": {
        "promote": ["seeds"],
        "remove": ["worms"],
        "reason": "A Chaffinch is a seed-eater that switches to insects to raise chicks. It picks seed and small invertebrates off the ground; it does not take earthworms.",
    },
    # --- Under-reported staples -------------------------------------------
    "Sturnus vulgaris": {
        "promote": ["invertebrates", "worms"],
        "reason": "Leatherjackets and lawn grubs are the food a Starling is built for — that open-bill probe exists to lever turf apart. Fruit matters, but it is not the whole story.",
    },
    "Turdus merula": {
        "promote": ["fruit_berries"],
        "reason": "A Blackbird spends half the year on worms and half on berries and windfall fruit; both are main meals, not one and a side.",
    },
    "Turdus viscivorus": {
        "promote": ["fruit_berries"],
        "reason": "The Mistle Thrush is named for the berries it eats. A single bird will hold one laden holly or rowan against all comers for a whole winter — that is a main meal by any measure.",
    },
    "Buteo buteo": {
        "add": ["carrion", "worms", "invertebrates"],
        "reason": "The source gives the Common Buzzard nothing but vertebrate prey. Buzzards walk fields for earthworms in wet weather and are habitual carrion feeders — that is how they get through winter.",
    },
    "Milvus milvus": {
        "add": ["worms", "invertebrates", "fish"],
        "reason": "Red Kites are scavengers first, but they also take earthworms from pasture and dead fish from water margins.",
    },
    "Anas platyrhynchos": {
        "promote": ["aquatic_plants", "seeds"],
        "reason": "A Mallard is a dabbling duck: pondweed, grain and seed are the staple, with invertebrates alongside. (Bread is neither, and is bad for them.)",
    },
    "Branta canadensis": {
        "add": ["seeds"],
        "reason": "Canada Geese graze grass and leaves but also feed heavily on grain and grass seed.",
    },
    "Columba palumbus": {
        "promote": ["seeds"],
        "reason": "Wood Pigeons strip clover and brassica leaves, but grain and beech mast are just as much a main meal.",
    },
    "Pyrrhula pyrrhula": {
        "promote": ["seeds"],
        "reason": "Bullfinches are bud and seed feeders — the heavy bill is a seed-crusher.",
    },
    # --- Diet-PlantO swamping the seed-eaters ------------------------------
    # "Other plant material" — leaves, buds, shoots, roots — is the game's
    # leafy/aquatic-plant family, and for several seed specialists the source
    # scores it above Diet-Seed. Left alone the game would ask a player to feed
    # a Crossbill pondweed as its main meal.
    "Loxia curvirostra": {
        "promote": ["seeds"],
        "demote": ["aquatic_plants"],
        "reason": "A Crossbill's entire head is a tool for one job: prising conifer cones apart for the seed inside. Needles and buds are a side dish, not the meal.",
    },
    "Cardinalis cardinalis": {
        "promote": ["seeds"],
        "demote": ["aquatic_plants"],
        "reason": "The source records no seed at all for the Northern Cardinal, on low certainty. That heavy conical bill is a seed-cracker, and sunflower hearts are what brings cardinals to a feeder.",
    },
    "Perdix perdix": {
        "promote": ["seeds"],
        "reason": "Grey Partridges live on weed seed and spilt grain, with leaves alongside; only the chicks are true insect feeders.",
    },
    "Alectoris rufa": {
        "promote": ["seeds"],
        "reason": "Red-legged Partridges are seed and grain feeders that also graze leaves and shoots.",
    },
    "Psittacula krameri": {
        "promote": ["seeds"],
        "reason": "Ring-necked Parakeets raid seed, grain and nuts as hard as they strip fruit — a garden feeder empties fast when they find it.",
    },
    "Glossopsitta concinna": {
        "promote": ["nectar"],
        "reason": "A lorikeet's brush-tipped tongue is built for blossom. Nectar is the main meal, with lerps, fruit and seed around it.",
    },

    # --- Other single-food misfiles ---------------------------------------
    "Turdus pilaris": {
        "promote": ["fruit_berries"],
        "reason": "Fieldfares arrive for the winter berry crop and strip hawthorn and rowan flock by flock. Berries are a main meal, not a side one.",
    },
    "Gallinago gallinago": {
        "promote": ["worms"],
        "reason": "A Snipe's bill is a worm probe with a flexible tip, worked into soft mud up to the hilt. Earthworms are the mainstay.",
    },
    "Tachybaptus ruficollis": {
        "add": ["fish"],
        "reason": "The source records no fish for the Little Grebe. It dives for small fish alongside the aquatic insects and snails.",
    },

    # --- Australian roster -------------------------------------------------
    "Threskiornis molucca": {
        "add": ["seeds", "fruit_berries"],
        "reason": "The Australian White Ibis has taken to towns so completely it has a nickname for it. Alongside wetland invertebrates it takes scraps, grain and fruit.",
    },
    "Dacelo novaeguineae": {
        "add": ["small_birds"],
        "reason": "Kookaburras take nestlings and small birds as well as the insects, lizards and snakes the source records.",
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


def foraging_strata(row: dict[str, Any] | None) -> dict[str, float]:
    """The row's ForStrat percentages: where this bird takes its food."""
    if not row:
        return {key: 0.0 for key in FORSTRAT_COLUMNS}
    return {key: percent(row, key) for key in FORSTRAT_COLUMNS}


def aggregate_strata(rows: list[dict[str, str]]) -> dict[str, float]:
    if not rows:
        return {key: 0.0 for key in FORSTRAT_COLUMNS}
    return {
        key: sum(percent(row, key) for row in rows) / len(rows)
        for key in FORSTRAT_COLUMNS
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


def is_aerial_hawker(ctx: dict[str, str]) -> bool:
    return (
        ctx["family"] in AERIAL_HAWKER_FAMILIES
        or ctx["family"] in FAMILY_HINTS["aerial_insectivore"]
        or has_name_hint(ctx, AERIAL_HAWKER_NAME_HINT)
    )


def legacy_invertebrate_shares(ctx: dict[str, str]) -> dict[str, float]:
    """Taxonomic fallback for the handful of rows with no ForStrat evidence."""
    if ctx["family"] in SHELLFISH_FROM_GROUND_FAMILIES or has_name_hint(ctx, r"\b(oystercatcher|curlew|sandpiper|plover|godwit|turnstone|knot|snipe|duck|teal|wigeon|goose|swan|gull|tern|heron|egret|coot|moorhen|rail)\b"):
        return {"worms": 0.6, "molluscs_crustaceans": 1.0, "invertebrates": 1.0}
    return {"worms": 0.5, "invertebrates": 1.0}


def invertebrate_shares(ctx: dict[str, str], strata: dict[str, float]) -> dict[str, float]:
    """Split the single Diet-Inv column across the game's four invertebrate foods.

    Diet-Inv is one number covering earthworms, midges, mussels and
    caterpillars alike, so it cannot say on its own whether a bird takes a
    worm. BirdFuncDat's ForStrat columns can: where a bird forages decides
    which invertebrates reach it. A Carrion Crow forages 90% on the ground, so
    earthworms are a real food for it and the game must not refuse them. A
    Great Tit works the canopy, so caterpillars are its food and earthworms
    are not.

    Returns a share per family in 0..1, applied to the Diet-Inv percentage.
    """
    if is_aerial_hawker(ctx):
        # Insects on the wing are the whole diet. A grub or a mealworm is still
        # an insect and a hand-reared swift will take one, so it stays a thin
        # secondary — but nothing that lives in soil or mud ever reaches these
        # birds, so worms and shellfish score nothing at all.
        return {"flying_insects": 1.0, "invertebrates": 0.2}

    total = sum(max(0.0, strata.get(key, 0.0)) for key in FORSTRAT_COLUMNS)
    if total <= 0:
        return legacy_invertebrate_shares(ctx)

    water = strata["ForStrat-watbelowsurf"] + strata["ForStrat-wataroundsurf"]
    ground = strata["ForStrat-ground"]
    aerial = strata["ForStrat-aerial"]
    vegetation = (
        strata["ForStrat-understory"]
        + strata["ForStrat-midhigh"]
        + strata["ForStrat-canopy"]
    )

    # A mudflat probe and a lawn probe are both "ground" to BirdFuncDat. For
    # shore and waterside families that ground share is shellfish as much as
    # it is worms, so an Oystercatcher scores cockles and not earthworms alone.
    shellfish = water + ground if ctx["family"] in SHELLFISH_FROM_GROUND_FAMILIES else water

    def specialised(share: float) -> float:
        return share if share >= INVERTEBRATE_SUBFAMILY_MIN_SHARE else 0.0

    return {
        # Insects taken on the wing.
        "flying_insects": specialised(aerial / total),
        # Earthworms and leatherjackets come out of soil, turf and mud.
        "worms": specialised(ground / total),
        # Snails, mussels and crustaceans come from in and around water.
        "molluscs_crustaceans": specialised(min(1.0, shellfish / total)),
        # Grubs, mealworms and suet stand in for whatever invertebrate the bird
        # normally takes off a surface, so this scores as well as its best
        # non-aerial foraging layer does — but a bird that only ever feeds in
        # the air cannot be handed a tray of them.
        "invertebrates": max(vegetation, ground, water) / total,
    }


def endotherm_families(ctx: dict[str, str], vend: float) -> list[str]:
    """Which vertebrate-prey foods a Diet-Vend percentage unlocks.

    Diet-Vend is "endothermic vertebrates" — birds AND mammals in one column,
    with no split between them. Narrowing it to mammals for everything that is
    not a raptor was a claim the source never made, and it is what made a
    Carrion Crow refuse prey it robs nests for. Anything with a nonzero Vend
    now scores both, ordered by which the species is better known for.
    """
    sci = ctx["scientific"].lower()
    if sci == "falco columbarius":
        return ["small_birds"]
    family = ctx["family"]
    if family in FAMILY_HINTS["raptor_bird"] or has_name_hint(ctx, r"\b(falcon|hawk|goshawk|sparrowhawk|kite|harrier|eagle|merlin)\b"):
        return ["small_birds", "small_mammals"]
    if family in FAMILY_HINTS["raptor_mammal"] or has_name_hint(ctx, r"\b(owl)\b"):
        return ["small_mammals", "small_birds"]
    return ["small_mammals", "small_birds"]


def game_family_scores(
    source_percentages: dict[str, int | float] | None,
    ctx: dict[str, str],
    strata: dict[str, float] | None = None,
) -> dict[str, int | float]:
    scores: dict[str, float] = {}
    if not source_percentages:
        return scores

    inv = float(source_percentages.get("Diet-Inv") or 0)
    for family, share in invertebrate_shares(ctx, strata or {}).items():
        add_score(scores, family, inv * min(1.0, max(0.0, share)))

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


# How much trouble each food family is to keep in the larder. Seed and grubs
# are always to hand; a live small bird is not.
FOOD_FAMILY_SUPPLY_COST = {
    "invertebrates": 1,
    "seeds": 1,
    "fruit_berries": 1,
    "worms": 1,
    "aquatic_plants": 2,
    "flying_insects": 2,
    "molluscs_crustaceans": 2,
    "nectar": 2,
    "carrion": 3,
    "fish": 3,
    "small_mammals": 4,
    "small_birds": 5,
}

# A bird that eats almost anything is an easy companion; a bird with one food
# is a commitment. The player should be told which they are taking on BEFORE
# the bird is hungry, not after.
FEEDING_TIERS = (
    (8, "omnivore", "Eats almost anything", 1,
     "Takes food from nearly every family — the easiest kind of bird to keep fed."),
    (5, "generalist", "Wide diet", 2,
     "Has real favourites but will accept plenty else — straightforward to keep fed."),
    (3, "selective", "Particular", 3,
     "Only a few foods will do. Keep the right ones stocked before taking this bird out."),
    (0, "specialist", "Specialist", 4,
     "A narrow, demanding diet. Feeding this bird well is a challenge in its own right."),
)


def feeding_profile(primary: list[str], secondary: list[str]) -> dict[str, Any]:
    """How easy this bird is to keep fed, from the breadth of its diet."""
    compatible = list(dict.fromkeys(primary + secondary))
    breadth = len(compatible)
    tier, label, difficulty, summary = next(
        (t, label, difficulty, summary)
        for threshold, t, label, difficulty, summary in FEEDING_TIERS
        if breadth >= threshold
    )
    costs = [FOOD_FAMILY_SUPPLY_COST.get(family, 2) for family in (primary or compatible)]
    return {
        "breadth": breadth,
        "familyCount": len(FOOD_FAMILIES),
        "tier": tier,
        "label": label,
        "difficulty": difficulty,
        "summary": summary,
        # The cheapest main meal decides whether a player can actually feed
        # this bird from the starting pantry.
        "easiestPrimarySupplyCost": min(costs) if costs else 3,
        "omnivore": tier == "omnivore",
    }


def apply_diet_correction(
    ctx: dict[str, str],
    primary: list[str],
    secondary: list[str],
) -> tuple[list[str], list[str], dict[str, Any] | None]:
    """Layer a curated correction over the source-derived families.

    Returns the corrected sets plus the correction that was applied, so the
    record can carry its reason and the game can disclose it rather than
    quietly presenting a hand edit as raw source data.
    """
    correction = DIET_CORRECTIONS.get(ctx["scientific"])
    if not correction:
        return primary, secondary, None

    promote = [family for family in correction.get("promote", []) if family in FOOD_FAMILIES]
    add = [family for family in correction.get("add", []) if family in FOOD_FAMILIES]
    demote = [family for family in correction.get("demote", []) if family in FOOD_FAMILIES]
    remove = set(correction.get("remove", []))
    dropped_from_primary = remove | set(demote)

    new_primary = sorted({*(f for f in primary if f not in dropped_from_primary), *promote})
    new_secondary = sorted(
        {*(f for f in secondary if f not in remove), *add, *demote} - set(new_primary)
    )
    applied = {
        "scientificName": ctx["scientific"],
        "promoted": promote,
        "added": add,
        "demoted": demote,
        "removed": sorted(remove),
        "reason": correction.get("reason", ""),
    }
    return new_primary, new_secondary, applied


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
    correction: dict[str, Any] | None = None,
) -> str:
    common = (profile or {}).get("name") or (row or {}).get("English") or "This bird"
    scientific = (profile or {}).get("scientificName") or (row or {}).get("Scientific") or ""
    if scientific == "Falco columbarius":
        return MERLIN_CONTEXT
    if correction and correction.get("reason"):
        return correction["reason"]
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
    strata: dict[str, float] | None = None,
) -> dict[str, Any]:
    ctx = row_context(row, profile)
    scores = game_family_scores(source_percentages, ctx, strata if strata is not None else foraging_strata(row))
    primary, secondary = primary_secondary(scores)
    correction = None
    if method == "unmatched":
        primary = []
        secondary = ["invertebrates", "seeds", "fruit_berries"]
        scores = {family: 1 for family in secondary}
    else:
        primary, secondary, correction = apply_diet_correction(ctx, primary, secondary)
    refused = sorted(family for family in FOOD_FAMILIES if family not in set(primary + secondary))
    certainty = (row or {}).get("Diet-Certainty") or ("F" if method == "family-fallback" else "U")
    aliases = list(dict.fromkeys([str(a) for a in ((profile or {}).get("aliases") or []) if a]))
    name = (profile or {}).get("name") or (row or {}).get("English") or ctx["common"]
    scientific = (profile or {}).get("scientificName") or (row or {}).get("Scientific") or ctx["scientific"]
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
        "dietCorrection": correction,
        "feeding": feeding_profile(primary, secondary),
        "education": education_text(profile, row, method, primary, secondary, fallback_reason, correction),
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
            "dietCorrection": correction,
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
) -> tuple[str, dict[str, str] | None, str | None, int | None, dict[str, int | float] | None, dict[str, float]]:
    scientific = norm(profile.get("scientificName") or profile.get("scientific"))
    if scientific in indices["by_scientific"]:
        row = indices["by_scientific"][scientific]
        return "exact", row, None, 1, diet_percentages(row), foraging_strata(row)

    for alias in profile.get("aliases") or []:
        if is_scientific_alias(alias) and norm(alias) in indices["by_scientific"]:
            row = indices["by_scientific"][norm(alias)]
            return "scientific-alias", row, f"profile scientific alias {alias}", 1, diet_percentages(row), foraging_strata(row)

    common_candidates = [
        profile.get("name"),
        profile.get("commonName"),
        *(alias for alias in (profile.get("aliases") or []) if not is_scientific_alias(alias)),
    ]
    for candidate in common_candidates:
        if norm(candidate) in indices["by_common"]:
            row = indices["by_common"][norm(candidate)]
            return "common-name", row, f"profile common-name token {candidate}", 1, diet_percentages(row), foraging_strata(row)

    family_key = norm(profile.get("family"))
    family_rows = indices["by_family"].get(family_key) or []
    if family_rows:
        percentages = aggregate_percentages(family_rows)
        reason = f"matched {len(family_rows)} BirdFuncDat rows for family {profile.get('family')}"
        return "family-fallback", None, reason, len(family_rows), percentages, aggregate_strata(family_rows)

    return "unmatched", None, "no species, alias, common-name, or BirdFuncDat family match", 0, None, foraging_strata(None)


def source_record(row: dict[str, str]) -> dict[str, Any]:
    percentages = diet_percentages(row)
    ctx = row_context(row, None)
    scores = game_family_scores(percentages, ctx, foraging_strata(row))
    primary, secondary = primary_secondary(scores)
    primary, secondary, correction = apply_diet_correction(ctx, primary, secondary)
    record = {
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
    }
    if correction:
        record["fix"] = 1
    return record


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
        method, row, reason, source_rows, percentages, strata = match_profile(profile, indices)
        counts[method] += 1
        record = record_from_parts(
            record_id=profile["id"],
            profile=profile,
            row=row,
            method=method,
            source_percentages=percentages,
            fallback_reason=reason,
            source_rows=source_rows,
            strata=strata,
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
            "path": str(source_path),
            "sha256": sha,
            "rowCount": len(rows),
            "rawParsedRowCount": raw_row_count,
            "usableScientificRowCount": len(rows),
        },
        "profiles": {
            "path": str(PROFILES_PATH.relative_to(ROOT)),
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

# The feeding rating is a pure function of the compatible families, and the
# runtime recomputes it from the same rule — shipping it would put a quarter of
# a megabyte of derived text on a phone for nothing. It stays in the full JSON,
# where it is worth reading. `dietCorrection` ships as a bare flag for the same
# reason: the correction's reasoning already travels as the record's education
# line, so the runtime only needs to know that a correction was applied.


def game_wild_bird_names() -> list[str]:
    """Every bird name the game can put in front of a player.

    WILD_BIRDS is the legacy scan catalogue; REGION_AREA_SPECIES is the closed
    whitelist the map spawns and the Area Birds panel draw from. Both need a
    real diet: a name that reaches the runtime without one falls through to the
    conservative fallback, and a Kittiwake that refuses fish while accepting
    berries is worse than no record at all.
    """
    text = INDEX_PATH.read_text(encoding="utf-8")
    match = re.search(r"const WILD_BIRDS\s*=\s*\[(.*?)\n\];", text, flags=re.S)
    if not match:
        raise SystemExit("Could not parse WILD_BIRDS from index.html")
    names = re.findall(r"'((?:[^'\\]|\\.)*)'", match.group(1))

    area = re.search(r"const REGION_AREA_SPECIES\s*=\s*\{(.*?)\n\};", text, flags=re.S)
    if not area:
        raise SystemExit("Could not parse REGION_AREA_SPECIES from index.html")
    names += re.findall(r"'((?:[^'\\]|\\.)*)'", area.group(1))

    cleaned = [name.replace("\\'", "'").split("(")[0].strip() for name in names]
    return list(dict.fromkeys(name for name in cleaned if name))


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
    source_by_scientific = {norm(row.get("s")): row for row in payload.get("sourceRecords", [])}
    manual_common = {norm(key): value for key, value in GAME_BIRD_SOURCE_COMMON_NAMES.items()}
    manual_scientific = {norm(key): value for key, value in GAME_BIRD_SOURCE_SCIENTIFIC_NAMES.items()}
    supplements: list[dict[str, Any]] = []
    unresolved: list[str] = []
    for game_name in game_wild_bird_names():
        game_key = norm(game_name)
        if game_key in indexed:
            continue
        pinned = source_by_scientific.get(norm(manual_scientific.get(game_key)))
        if pinned:
            supplement = dict(pinned)
            supplement["a"] = [game_name]
            supplements.append(supplement)
            indexed.add(game_key)
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


def runtime_record(record: dict[str, Any]) -> dict[str, Any]:
    compact_record = {key: record[key] for key in RUNTIME_RECORD_FIELDS if key in record}
    if record.get("dietCorrection"):
        compact_record["corrected"] = 1
    return compact_record


def runtime_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return compact browser data; the full global source table stays build-only."""
    records = [runtime_record(record) for record in payload["records"]]
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
