"""Merlin stands on a branch, not on a plank.

The old top-right perch was a chunky gradient slab with a bracket tab, and the
Merlin cutout floated near it rather than gripping it. It is a drawn bough now,
reaching in from a tree past the right edge of the screen, with the bird locked
to the bark.

How they stay locked changed when the live compact header was reconciled into
main. There used to be two independent fixed layers sharing one sway keyframe
about one carefully-matched off-screen pivot. Now a single fixed
`.merlin-perch-assembly` holds both and sways as one body, so contact is
structural rather than arithmetic: nothing can drift, because there is only one
thing moving. The bough still overhangs the screen edge, and the bird still
leaves the assembly to fly.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"

# The bough's top surface is drawn at y≈39.4 in the SVG's user units, which is
# where the sprite's toe pads land. The puppet's torso pivots on that same point
# (see test_merlin_animated_rig_20260725), so breathing never lifts him off it.
TALON_CONTACT = "106 39.4"


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


def test_one_assembly_sways_and_carries_both_bough_and_bird():
    html = INDEX.read_text(encoding="utf-8")
    assembly = css_rule(html, ".merlin-perch-assembly")
    perch = css_rule(html, ".pet-perch")
    bird = css_rule(html, ".pet-companion")

    # One fixed parent does the swaying...
    assert declaration(assembly, "position") == "fixed"
    assert "merlinBranchSway" in declaration(assembly, "animation")
    # ...and both children ride it, so neither can drift against the other.
    for rule in (perch, bird):
        assert declaration(rule, "position") == "absolute"
        assert "animation" not in rule

    assert '<div class="merlin-perch-assembly" id="merlinPerchAssembly">' in html
    # The bird sits inside the assembly; the bough is wider than it and hangs
    # off the screen edge so its thick base is cropped by the viewport.
    perch_right = float(re.match(r"(-?[\d.]+)px", declaration(perch, "right")).group(1))
    assert perch_right < 0
    # Flight lifts the bird out of the assembly, and the sway stands down.
    assert ".merlin-perch-assembly:has(.pet-companion.flying) { animation:none; }" in html
    assert "position:fixed" in css_rule(html, ".pet-companion.flying")


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
    # A vertical bob lifted him clear of the perch; a rock about the feet does not.
    assert "translateY" not in idle.group(1)
    assert "rotate(" in idle.group(1)
    # The sprite rocks about its base, and the bark line it rocks on is drawn
    # at the point the toe pads reach.
    assert "transform-origin:50%92%" in css_rule(html, ".pet-sprite").replace(" ", "")
    assert TALON_CONTACT in html


def test_reduced_motion_still_leaves_him_standing_on_the_branch():
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(
        r"@media \(prefers-reduced-motion: reduce\) \{\s*\.merlin-perch-assembly[^}]*\}.*?\n\}",
        html,
        re.S,
    )
    assert block, "no reduced-motion guard for the perch"
    body = block.group(0)
    assert "animation:none !important;" in body
    # One parent parks, so bird and bough stop together and stay in contact —
    # there is no second layer left free to drift.
    assert ".merlin-perch-assembly" in body
    assert ".pet-sprite" in body and ".merlin-part" in body


def test_release_cache_is_bumped():
    sw = SW.read_text(encoding="utf-8")
    assert "burbz-prey-hunts-kitchen-declutter-v138-20260726" in sw
