#!/usr/bin/env python3
"""Build the Burbz deep bird education dataset from Wikipedia + Burbz species list.

The output is intentionally static JSON so the live game is fast and does not
need to call Wikipedia from a visitor's phone.
"""
from __future__ import annotations

import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML_PATH = ROOT / "index.html"
OUT_PATH = ROOT / "data" / "bird-education.json"

TITLE_OVERRIDES = {
    "European Robin": "European robin",
    "Wren": "Eurasian wren",
    "Blackbird": "Common blackbird",
    "Blue Tit": "Eurasian blue tit",
    "Great Tit": "Great tit",
    "Wood Pigeon": "Common wood pigeon",
    "Magpie": "Eurasian magpie",
    "Jackdaw": "Western jackdaw",
    "Rook": "Rook (bird)",
    "Goldfinch": "European goldfinch",
    "Chaffinch": "Common chaffinch",
    "Chiffchaff": "Common chiffchaff",
    "Starling": "Common starling",
    "Dunnock": "Dunnock",
    "Long-tailed Tit": "Long-tailed tit",
    "Coal Tit": "Coal tit",
    "Goldcrest": "Goldcrest",
    "Treecreeper": "Eurasian treecreeper",
    "Nuthatch": "Eurasian nuthatch",
    "Jay": "Eurasian jay",
    "Song Thrush": "Song thrush",
    "Greenfinch": "European greenfinch",
    "Bullfinch": "Eurasian bullfinch",
    "Swift": "Common swift",
    "Swallow": "Barn swallow",
    "House Martin": "Common house martin",
    "Pied Wagtail": "White wagtail",
    "Grey Wagtail": "Grey wagtail",
    "Skylark": "Eurasian skylark",
    "Meadow Pipit": "Meadow pipit",
    "Yellowhammer": "Yellowhammer",
    "Reed Bunting": "Common reed bunting",
    "Stonechat": "European stonechat",
    "Kestrel": "Common kestrel",
    "Sparrowhawk": "Eurasian sparrowhawk",
    "Buzzard": "Common buzzard",
    "Tawny Owl": "Tawny owl",
    "Little Owl": "Little owl",
    "Barn Owl": "Barn owl",
    "Kingfisher": "Common kingfisher",
    "Red Kite": "Red kite",
    "Lapwing": "Northern lapwing",
    "Cuckoo": "Common cuckoo",
    "Heron": "Grey heron",
    "Mallard": "Mallard",
    "Mute Swan": "Mute swan",
    "Canada Goose": "Canada goose",
    "Cormorant": "Great cormorant",
    "Oystercatcher": "Eurasian oystercatcher",
    "Gannet": "Northern gannet",
    "Razorbill": "Razorbill",
    "Puffin": "Atlantic puffin",
    "Merlin": "Merlin (bird)",
    "Osprey": "Osprey",
    "Golden Eagle": "Golden eagle",
    "Raven": "Common raven",
    "Firecrest": "Common firecrest",
}

SAFE_REPLACEMENTS = {
    " kills ": " catches ",
    " killed ": " caught ",
    " killing ": " catching ",
    " dead ": " carrion ",
}


def request_json(url: str, params: dict) -> dict:
    query = urllib.parse.urlencode(params)
    req = urllib.request.Request(
        f"{url}?{query}",
        headers={"User-Agent": "BurbzFieldGuide/1.0 (https://yaanbatho.com/burbz/)"},
    )
    with urllib.request.urlopen(req, timeout=25) as res:
        return json.loads(res.read().decode("utf-8"))


def wild_birds() -> list[str]:
    html = HTML_PATH.read_text(encoding="utf-8")
    match = re.search(r"const WILD_BIRDS = \[(.*?)\];", html, re.S)
    if not match:
        raise SystemExit("Could not find WILD_BIRDS")
    return re.findall(r"'([^']+)'", match.group(1))


def clean_text(text: str) -> str:
    text = re.sub(r"\s+", " ", text or "").strip()
    for old, new in SAFE_REPLACEMENTS.items():
        text = text.replace(old, new)
    return text


def first_sentences(text: str, count: int = 3) -> str:
    sentences = re.split(r"(?<=[.!?])\s+(?=[A-Z])", clean_text(text))
    return " ".join(sentences[:count]).strip()


def paragraph_chunks(text: str) -> list[str]:
    bits = [clean_text(p) for p in re.split(r"\n{2,}", text or "")]
    return [p for p in bits if len(p) > 80]


def wikipedia_extract(title: str) -> tuple[str, str, str]:
    data = request_json(
        "https://en.wikipedia.org/w/api.php",
        {
            "action": "query",
            "format": "json",
            "prop": "extracts|info",
            "explaintext": 1,
            "redirects": 1,
            "inprop": "url",
            "titles": title,
        },
    )
    page = next(iter(data["query"]["pages"].values()))
    if "missing" in page:
        raise RuntimeError(f"Missing Wikipedia page for {title}")
    return page["title"], clean_text(page.get("extract", "")), page.get("fullurl", "")


def scientific_name(extract: str, species: str) -> str:
    # Most bird pages start: "The common raven (Corvus corax) is..."
    first = first_sentences(extract, 1)
    match = re.search(r"\(([A-Z][a-z]+(?:\s[a-z][a-z\-]+){1,3})\)", first)
    if match:
        return match.group(1)
    return species


def build_entry(species: str) -> dict:
    title = TITLE_OVERRIDES.get(species, species)
    wiki_title, extract, url = wikipedia_extract(title)
    chunks = paragraph_chunks(extract)
    summary = first_sentences(extract, 4)
    if len(summary) < 120 and chunks:
        summary = chunks[0]
    sci = scientific_name(extract, species)
    deep = clean_text("\n\n".join(chunks[:8]))
    if len(deep) > 5500:
        deep = deep[:5500].rsplit(" ", 1)[0] + "…"

    learning = [
        f"Learn the name pair: {species} — {sci}.",
        "Check shape and behaviour first, then colours; light and distance can make colour unreliable.",
        "Use habitat as a clue: where the bird is often narrows the possibilities quickly.",
        "Listen for repeated calls or song patterns when the bird is hard to see.",
    ]

    return {
        "title": species,
        "wikipediaTitle": wiki_title,
        "scientificName": sci,
        "summary": summary,
        "taxonomy": f"Scientific name: {sci}. Wikipedia page: {wiki_title}.",
        "identification": "Start with size, silhouette, bill shape, posture, tail length, wing shape, and movement style. Then compare plumage markings and any seasonal differences.",
        "behaviour": "Watch how it moves, feeds, flies, perches, gathers with others, and reacts to people or open space. Behaviour is often the fastest route to confident identification.",
        "habitat": "Use the Wikipedia notes below with your location: gardens, farmland, woodland, wetland, coast, upland, towns, or open sky all point to different likely birds.",
        "diet": "Use feeding clues gently: seed-eaters, insect-feeders, fish-feeders, grazing waterbirds, and generalists all behave differently in the field.",
        "breeding": "For learning, notice nesting season, display behaviour, song territories, family groups, and juvenile plumage without disturbing birds or nests.",
        "range": "Compare the range notes with the UK season and habitat. Some birds are resident, while others are summer visitors, winter visitors, passage migrants, or coastal specialists.",
        "conservation": "Conservation status can change by country and year. Treat Wikipedia as a starter, then compare with RSPB/BTO/IUCN if you need the latest UK status.",
        "wikipediaDeepDive": deep,
        "learningNotes": learning,
        "sources": [{"label": f"Wikipedia — {wiki_title}", "url": url}],
    }


def main() -> None:
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    data = {}
    for i, species in enumerate(wild_birds(), 1):
        print(f"[{i:02d}] {species}")
        data[species] = build_entry(species)
        time.sleep(0.1)
    OUT_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_PATH} ({len(data)} birds)")


if __name__ == "__main__":
    main()
