"""Cut Merlin's cutout into the four puppet layers the top-right companion uses.

The perched companion in the map header is not the flat 768px cutout any more.
It is that same painting sliced into cape+tail, torso, folded wing and head,
stacked in one square and turned about its own joint by CSS (see `.merlin-rig`
in index.html).  This script is how those four files are produced.

Two things make the trick hold together:

* Priority.  Where the masks overlap, the piece in front wins — head, then
  wing, then cape/tail, then whatever is left is torso.  Otherwise a pixel
  would appear in two layers and double up as they separate.

* Inpainting.  Every layer behind a moving one is painted solid underneath it
  before export, by smearing surrounding colour into the vacated region.  A
  lifted wing then shows flank feathers rather than a hole, and a turned head
  drags neck rather than sky.

Run from public/burbz:

    python3 scripts/build_merlin_rig.py

Needs the real raster, so `git lfs pull` the cutout first — the script refuses
to run against an LFS pointer.  Re-run it whenever Merlin's art is redrawn, and
adjust the polygons below if his pose changes; the joint percentages in the CSS
are derived from the pivots listed in PIVOTS and must be updated to match.
"""

import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "bird-art-cache" / "cutouts" / "merlin_burbz_manga_20260624_v2_cutout.png"
OUT_DIR = ROOT / "assets" / "merlin"
EXPORT = 320  # the sprite renders at 54-72 CSS px, so 320 covers 3x screens

# Outlines in the 768px source art.  Head is cut at the collar, the wing along
# its leading edge, and cape/tail take everything trailing off to the right.
HEAD = [(176, 44), (424, 44), (424, 118), (392, 150), (356, 180),
        (300, 202), (250, 196), (216, 178), (186, 140)]

WING = [(346, 252), (366, 232), (398, 226), (438, 244), (468, 282),
        (492, 330), (504, 380), (500, 432), (478, 468), (444, 470),
        (408, 440), (378, 388), (356, 322)]

BACK = [(408, 172), (452, 176), (520, 196), (600, 244), (680, 306),
        (718, 348), (716, 396), (686, 424), (656, 452), (652, 520),
        (628, 588), (596, 628), (560, 632), (520, 576), (492, 500),
        (476, 452), (500, 420), (510, 356), (494, 296), (462, 240),
        (430, 200)]

# The joint each layer turns about, in source pixels.  These are what the
# transform-origin percentages in index.html are computed from.
PIVOTS = {
    "back": (430, 230),   # shoulder, where the cloak hangs
    "body": (350, 600),   # the talons, so breathing never lifts him
    "wing": (372, 250),   # wing shoulder
    "head": (330, 196),   # base of the skull
}


def poly_mask(size, points, feather=1.2):
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).polygon(points, fill=255)
    if feather:
        mask = mask.filter(ImageFilter.GaussianBlur(feather))
    return np.asarray(mask, dtype=np.float32) / 255.0


def dilate(mask, pixels):
    img = Image.fromarray((mask * 255).astype(np.uint8))
    for _ in range(int(pixels)):
        img = img.filter(ImageFilter.MaxFilter(3))
    return np.asarray(img, dtype=np.float32) / 255.0


def inpaint(rgb, alpha, hole, iterations=90):
    """Flood surrounding colour into `hole` so a lifted piece leaves no void."""
    known = (alpha > 0.35) & (hole < 0.5)
    colour = rgb.astype(np.float32) * known[..., None]
    filled = known.astype(np.float32)
    for _ in range(iterations):
        total = np.zeros_like(colour)
        count = np.zeros_like(filled)
        for dy, dx in ((-1, 0), (1, 0), (0, -1), (0, 1),
                       (-1, -1), (-1, 1), (1, -1), (1, 1)):
            total += np.roll(np.roll(colour, dy, 0), dx, 1)
            count += np.roll(np.roll(filled, dy, 0), dx, 1)
        fresh = (filled < 0.5) & (count > 0)
        if not fresh.any():
            break
        colour[fresh] = total[fresh] / count[fresh][..., None]
        filled[fresh] = 1.0
    return np.clip(colour, 0, 255).astype(np.uint8)


def export(rgb, alpha, name):
    layer = np.dstack([rgb, (np.clip(alpha, 0, 1) * 255).astype(np.uint8)])
    img = Image.fromarray(layer, "RGBA").resize((EXPORT, EXPORT), Image.LANCZOS)
    path = OUT_DIR / f"merlin-{name}.webp"
    img.save(path, quality=92, method=6)
    print(f"  {path.relative_to(ROOT)}  {path.stat().st_size:,} bytes")
    return img


def main():
    if not SRC.exists():
        sys.exit(f"missing {SRC}")
    if SRC.read_bytes()[:8] == b"version ":
        sys.exit(f"{SRC.name} is a git-lfs pointer — run `git lfs pull` first")

    src = Image.open(SRC).convert("RGBA")
    arr = np.asarray(src)
    rgb = arr[:, :, :3]
    alpha = arr[:, :, 3].astype(np.float32) / 255.0

    head = poly_mask(src.size, HEAD)
    wing = np.clip(poly_mask(src.size, WING) - head, 0, 1)
    back = np.clip(poly_mask(src.size, BACK) - head - wing, 0, 1)

    silhouette = (alpha > 0.35).astype(np.float32)
    # Only the head and wing visibly swing clear, so those are the voids to fill.
    filled = inpaint(rgb, alpha, np.clip(head + wing, 0, 1))

    # The torso keeps a solid patch under the wing and a collar of neck pixels
    # reaching up past the head cut, so neither exposes background as it moves.
    core = np.clip(alpha - head - back, 0, 1)
    body = np.clip(dilate((core > 0.5).astype(np.float32), 12), 0, 1)
    body = np.minimum(body, dilate(silhouette, 2))
    body = np.maximum(np.clip(body - back * 0.85, 0, 1), core)
    # The cloak grows a little towards the wing for the same reason.
    cape = np.minimum(dilate((back > 0.4).astype(np.float32), 8), dilate(silhouette, 2))

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    print(f"cutting {SRC.name} into {OUT_DIR.relative_to(ROOT)}")
    export(filled, cape, "back")
    export(filled, body, "body")
    export(rgb, np.minimum(wing, alpha), "wing")
    export(rgb, np.minimum(head, alpha), "head")

    print("\ntransform-origin values for index.html:")
    for name, (px, py) in PIVOTS.items():
        print(f"  .merlin-{name}: {px / src.width * 100:.1f}% {py / src.height * 100:.1f}%")


if __name__ == "__main__":
    main()
