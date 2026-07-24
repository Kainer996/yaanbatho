"""Merlin stands on a branch, not on a plank.

The old top-right perch was a chunky gradient slab with a bracket tab, and the
Merlin cutout floated near it rather than gripping it. This release replaces it
with a drawn bough that reaches in from a tree past the right edge of the
screen, and locks the bird to the bark: the bough and the bird are separate
fixed layers (the flight code still needs to move the bird alone) that share
one sway keyframe about one pivot — the base of the bough at the screen edge.

The arithmetic in these tests is the contract. Move the bird's `right` without
moving its `transform-origin` and the two layers pivot about different points,
which slides Merlin off the branch mid-sway; that is what the pivot test
catches.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"

# The cutout's toe pads sit 72.4% down the square art and its talon cluster is
# centred 44% across, which is why the sprite pivots there and why the bough's
# top surface is drawn at y≈39.4 in the SVG's user units.
TALON_PIVOT = "transform-origin: 44% 72%;"


def css_rule(html: str, selector: str) -> str:
    match = re.search(r"(?:^|\}|\*/)\s*" + re.escape(selector) + r"\s*\{([^}]*)\}", html)
    assert match, f"no CSS rule found for {selector}"
    return re.sub(r"/\*.*?\*/", "", match.group(1), flags=re.S)


def declaration(rule: str, prop: str) -> str:
    match = re.search(r"(?:^|;)\s*" + re.escape(prop) + r"\s*:\s*([^;]+)", rule)
    assert match, f"no {prop} declaration in rule: {rule}"
    return match.group(1).strip()


def test_the_slab_perch_is_gone():
    html = INDEX.read_text(encoding="utf-8")
    # The plank was two pseudo-elements: a clip-path bracket and a gradient bar.
    assert ".pet-perch::before" not in html
    assert ".pet-perch::after" not in html
    assert "polygon(0 36%,100% 36%,94% 62%" not in html


def test_the_perch_is_a_drawn_bough_with_leafy_twigs():
    html = INDEX.read_text(encoding="utf-8")
    assert '<div class="pet-perch show" id="petPerch" aria-hidden="true">' in html
    assert '<svg class="pet-branch" viewBox="0 0 180 104"' in html
    # Tapered bark, twigs and leaves rather than a flat bar.
    for marker in [
        'id="merlinBarkFill"',
        'id="merlinTwigFill"',
        'id="merlinLeaf"',
        'class="pet-branch-spray"',
        'class="pet-branch-drop"',
        'href="#merlinLeaf"',
    ]:
        assert marker in html, marker
    # The bough's top surface passes under the talons at y≈39.4 user units.
    assert "106 39.4" in html


def test_bough_and_bird_share_one_sway_about_one_pivot():
    html = INDEX.read_text(encoding="utf-8")
    perch = css_rule(html, ".pet-perch")
    bird = css_rule(html, ".pet-companion")

    # Same keyframe, same duration: the two layers must move as one body.
    assert declaration(perch, "animation") == declaration(bird, "animation")
    assert "merlin-bough-sway" in declaration(perch, "animation")
    # Same vertical band, so a shared pivot row means a shared pivot point.
    assert declaration(perch, "top") == declaration(bird, "top")

    perch_right = float(re.match(r"(-?[\d.]+)px", declaration(perch, "right")).group(1))
    bird_right = float(re.match(r"(-?[\d.]+)px", declaration(bird, "right")).group(1))

    # The bough pivots on its own right edge; the bird pivots on a point that
    # many pixels further right. Both land on the same screen column only while
    # this equality holds.
    perch_origin = declaration(perch, "transform-origin")
    bird_origin = declaration(bird, "transform-origin")
    assert perch_origin.startswith("100% ")
    offset = float(re.search(r"calc\(100% \+ ([\d.]+)px\)", bird_origin).group(1))
    assert offset == bird_right - perch_right

    # ...and on the same row.
    assert perch_origin.split()[-1] == bird_origin.split()[-1]

    # The pivot sits off the right of the screen, so the tip of the bough
    # travels far more than the base does.
    assert perch_right < 0


def test_the_bough_reaches_in_from_off_screen():
    html = INDEX.read_text(encoding="utf-8")
    perch = css_rule(html, ".pet-perch")
    width = float(re.match(r"([\d.]+)px", declaration(perch, "width")).group(1))
    right = float(re.match(r"(-?[\d.]+)px", declaration(perch, "right")).group(1))
    # Wide enough to read as a bough, and its thick base is cropped by the
    # screen edge so it reads as continuing into an unseen tree.
    assert width >= 150
    assert width + right >= 140
    assert "pointer-events: none;" in perch


def test_idle_breath_keeps_the_talons_on_the_bark():
    html = INDEX.read_text(encoding="utf-8")
    idle = re.search(r"@keyframes pet-idle \{([^}]*)\}", html)
    assert idle, "pet-idle keyframes missing"
    # A vertical bob lifted him clear of the perch; a rock about the talons does not.
    assert "translateY" not in idle.group(1)
    assert "rotate(" in idle.group(1)
    assert TALON_PIVOT in html
    # Flight still spins about the body, not the feet.
    assert ".pet-sprite.pet-walk { transform-origin: 50% 50%;" in html


def test_reduced_motion_still_leaves_him_standing_on_the_branch():
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(
        r"@media \(prefers-reduced-motion: reduce\) \{\s*\.pet-perch[^}]*\}[^}]*\}",
        html,
    )
    assert block, "no reduced-motion guard for the perch"
    body = block.group(0)
    assert "animation: none;" in body
    # Both layers must be parked at the same angle or he floats off the bark.
    assert ".pet-perch, .pet-companion { transform: rotate(-0.2deg); }" in body


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-merlin-branch-perch-v118-20260724" in sw
