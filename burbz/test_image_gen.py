"""Quick test: generate a couple of manga-style bird warriors via Gemini."""

import os
import sys
from pathlib import Path

import google.generativeai as genai

API_KEY = os.environ.get("GEMINI_API_KEY", "")
if not API_KEY:
    sys.exit("GEMINI_API_KEY not set")
MODEL = "gemini-2.5-flash-image"
OUT_DIR = Path(__file__).parent / "bird-art-cache" / "test"
OUT_DIR.mkdir(parents=True, exist_ok=True)

BIRDS = [
    ("Robin", "legendary"),
    ("Kingfisher", "epic"),
]

genai.configure(api_key=API_KEY)
model = genai.GenerativeModel(MODEL)


def build_prompt(species: str, rarity: str) -> str:
    return (
        f"Manga/anime style character portrait of a {species} bird "
        f"as a fierce battle warrior. Dynamic pose, bold colors, dramatic "
        f"lighting, clean lines. Collectible card game character — powerful "
        f"and cool. {rarity}-tier. Square format, white background."
    )


def extract_image(response) -> bytes | None:
    for part in response.candidates[0].content.parts:
        inline = getattr(part, "inline_data", None)
        if inline and getattr(inline, "mime_type", "").startswith("image/"):
            return inline.data
    return None


def generate(species: str, rarity: str) -> Path | None:
    prompt = build_prompt(species, rarity)
    print(f"  prompt: {prompt[:100]}...")
    response = model.generate_content(prompt)
    data = extract_image(response)
    if not data:
        print(f"  no image returned. response text: {getattr(response, 'text', '<none>')[:200]}")
        return None
    out_path = OUT_DIR / f"{species.lower()}_{rarity}.png"
    out_path.write_bytes(data)
    return out_path


def main() -> int:
    print(f"Model: {MODEL}")
    print(f"Output dir: {OUT_DIR}")
    results = []
    for species, rarity in BIRDS:
        print(f"\nGenerating {species} ({rarity})...")
        try:
            path = generate(species, rarity)
        except Exception as e:
            print(f"  ERROR: {type(e).__name__}: {e}")
            results.append((species, None, str(e)))
            continue
        if path:
            print(f"  saved: {path} ({path.stat().st_size} bytes)")
            results.append((species, path, None))
        else:
            results.append((species, None, "no image in response"))

    print("\n--- Summary ---")
    ok = sum(1 for _, p, _ in results if p)
    print(f"{ok}/{len(results)} succeeded")
    for species, path, err in results:
        if path:
            print(f"  OK  {species}: {path}")
        else:
            print(f"  FAIL {species}: {err}")
    return 0 if ok == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())
