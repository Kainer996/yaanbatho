"""Merlin moves on his branch instead of sitting there as a flat sticker.

The top-right companion used to be one 348KB PNG of a falcon, rocked a fraction
of a degree by `pet-idle`.  At 54px that reads as a sticker pinned to a plank.

This release cuts that same painting into four pieces — cape and tail, torso,
folded wing, head — stacks them in one square and turns each about its own
joint, so he breathes, shuffles a wing, glances up and peers down at the map,
and beats both wings when he flies off.  The pieces behind a moving one were
inpainted before export, which is why a lifted wing shows flank feathers rather
than a hole; that is a property of the art files, so the tests here check the
contract the CSS depends on: every piece present, every piece on its own pivot,
every pivot inside the art it turns.

The arithmetic that matters: `.merlin-body` must pivot on the talons, the same
44%/72% point `.pet-sprite` uses, or breathing lifts him off the bark.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INDEX = ROOT / "index.html"
SW = ROOT / "sw.js"
RIG_DIR = ROOT / "assets" / "merlin"

PARTS = ["back", "body", "wing", "head"]

# WebP magic: "RIFF" .... "WEBP"
WEBP_HEADER = (b"RIFF", b"WEBP")


def css_rule(html: str, selector: str) -> str:
    match = re.search(r"(?:^|\}|\*/)\s*" + re.escape(selector) + r"\s*\{([^}]*)\}", html)
    assert match, f"no CSS rule found for {selector}"
    return re.sub(r"/\*.*?\*/", "", match.group(1), flags=re.S)


def declaration(rule: str, prop: str) -> str:
    match = re.search(r"(?:^|;)\s*" + re.escape(prop) + r"\s*:\s*([^;]+)", rule)
    assert match, f"no {prop} declaration in rule: {rule}"
    return match.group(1).strip()


def keyframes(html: str, name: str) -> str:
    match = re.search(r"@keyframes " + re.escape(name) + r"\s*\{(.*?)\n\}", html, re.S)
    assert match, f"@keyframes {name} missing"
    return match.group(1)


def test_every_rig_piece_ships_as_a_real_transparent_webp():
    assert RIG_DIR.is_dir(), "assets/merlin is missing"
    for part in PARTS:
        art = RIG_DIR / f"merlin-{part}.webp"
        assert art.exists(), f"{art.name} missing"
        raw = art.read_bytes()
        assert raw[:4] == WEBP_HEADER[0] and raw[8:12] == WEBP_HEADER[1], f"{art.name} is not a WebP"
        # Real art, not a stub, and still far lighter than the 348KB cutout.
        assert 1_500 < len(raw) < 120_000, f"{art.name} is {len(raw)} bytes"
    total = sum((RIG_DIR / f"merlin-{p}.webp").stat().st_size for p in PARTS)
    assert total < 200_000, f"the whole puppet must stay lighter than the old cutout, got {total}"


def test_the_perched_companion_is_the_puppet_not_the_flat_cutout():
    html = INDEX.read_text(encoding="utf-8")
    sprite = re.search(r'<button class="pet-sprite" id="petSprite".*?</button>', html, re.S)
    assert sprite, "petSprite button missing"
    markup = sprite.group(0)
    assert 'class="merlin-rig"' in markup
    for part in PARTS:
        assert f'merlin-part merlin-{part}' in markup, part
        assert f'/burbz/assets/merlin/merlin-{part}.webp' in markup, part
    # The 348KB single-image cutout must not be what he wears on the branch.
    assert "merlin_burbz_manga_20260624_v2_cutout.png" not in markup


def test_one_bird_to_a_screen_reader_not_four_images():
    html = INDEX.read_text(encoding="utf-8")
    sprite = re.search(r'<button class="pet-sprite" id="petSprite".*?</button>', html, re.S).group(0)
    named = re.findall(r'alt="Merlin the wizard falcon"', sprite)
    assert len(named) == 1, "exactly one piece carries the bird's name"
    # The other three, and the eye glint, are decoration.
    assert sprite.count('aria-hidden="true"') == len(PARTS) - 1 + 1


def test_the_runtime_rebuilds_the_same_rig_it_ships_in_the_markup():
    html = INDEX.read_text(encoding="utf-8")
    # renderPetCompanion repaints the sprite when state reloads; it must not
    # fall back to the flat cutout and silently kill the animation.
    assert "if (!sprite.querySelector('.merlin-rig')) sprite.innerHTML = merlinRigHTML();" in html
    assert "function merlinRigHTML()" in html
    assert "rigParts: Object.freeze(['back', 'body', 'wing', 'head'])" in html


def test_each_piece_turns_about_its_own_joint():
    html = INDEX.read_text(encoding="utf-8")
    origins = {}
    for part in PARTS:
        rule = css_rule(html, f".merlin-{part}")
        origins[part] = declaration(rule, "transform-origin")
        assert "animation" in rule, f".merlin-{part} never moves"
        # A joint has to sit inside the art it pivots.
        x, y = (float(v.rstrip("%")) for v in origins[part].split())
        assert 0 < x < 100 and 0 < y < 100, f".merlin-{part} pivots outside the sprite"
    # Four joints, four distinct points — a shared pivot means a shared piece.
    assert len(set(origins.values())) == len(PARTS)
    # Back to front: cape and tail behind, head in front.
    zs = [float(declaration(css_rule(html, f".merlin-{p}"), "z-index")) for p in PARTS]
    assert zs == sorted(zs) and len(set(zs)) == len(PARTS)


def test_breathing_pivots_on_the_talons_so_he_never_lifts_off_the_bark():
    html = INDEX.read_text(encoding="utf-8")
    body = css_rule(html, ".merlin-body")
    origin_y = float(declaration(body, "transform-origin").split()[1].rstrip("%"))
    # The cutout's toe pads are 72.4% down the square art; the torso has to swell
    # from there, the same row .pet-sprite rocks about.
    assert 74 < origin_y < 82, "the torso must pivot at the feet, not the middle"
    breath = keyframes(html, "merlin-breathe")
    # A chest fills upward; it must not translate, or the talons drift.
    assert "translate" not in breath
    assert "scaleY" in breath


def test_the_idle_is_a_long_cycle_with_short_events_not_a_constant_twitch():
    html = INDEX.read_text(encoding="utf-8")
    for selector, lower in ((".merlin-head", 4.0), (".merlin-wing", 5.0), (".merlin-back", 6.0)):
        animation = declaration(css_rule(html, selector), "animation")
        seconds = float(re.search(r"([\d.]+)s", animation).group(1))
        assert seconds >= lower, f"{selector} cycles every {seconds}s — too busy to read as idle"
    # The wing shuffle is two beats inside one cycle, then stillness.
    shuffle = keyframes(html, "merlin-wing-shuffle")
    lifts = re.findall(r"rotate\((-[\d.]+)deg\)", shuffle)
    assert len(lifts) >= 4, "the shuffle needs a settle between beats"
    assert shuffle.strip().startswith("0%,"), "the wing rests for most of the cycle"


def test_flight_swaps_the_idle_for_a_real_wingbeat():
    html = INDEX.read_text(encoding="utf-8")
    assert ".pet-sprite.pet-walk .merlin-wing { animation: merlin-wing-beat" in html
    beat = keyframes(html, "merlin-wing-beat")
    angles = [float(v) for v in re.findall(r"rotate\((-?[\d.]+)deg\)", beat)]
    # Up-and-over then down-and-forward: a beat, not a wobble.
    assert max(angles) - min(angles) > 30, f"wingbeat sweeps only {max(angles) - min(angles)} degrees"
    # The idle cycles must stand down so they cannot fight the beat.
    assert ".pet-sprite.pet-walk .merlin-body,\n.pet-sprite.pet-walk .merlin-head { animation: none; }" in html


def test_reduced_motion_parks_the_whole_puppet():
    html = INDEX.read_text(encoding="utf-8")
    block = re.search(
        r"@media \(prefers-reduced-motion: reduce\) \{.*?\n\}", html, re.S
    )
    assert block, "no reduced-motion guard"
    body = block.group(0)
    assert ".merlin-part" in body and ".merlin-glint" in body
    # Parked, and parked square — a frozen mid-turn pose would look broken.
    assert ".merlin-part { transform: none; }" in body
    assert ".merlin-glint { opacity: 0; }" in body


def test_the_bough_still_carries_him_and_gained_a_leafy_tip():
    html = INDEX.read_text(encoding="utf-8")
    # The talon contact point is the contract between bird and branch.
    assert "106 39.4" in html
    # The bough now stops in foliage instead of tapering to a bare point.
    assert 'class="pet-branch-tip"' in html
    tip = css_rule(html, ".pet-branch-tip")
    assert "merlin-twig-flutter" in declaration(tip, "animation")
    # Each twig group flexes about where it joins, not about the bough's pivot.
    origins = {declaration(css_rule(html, s), "transform-origin")
               for s in (".pet-branch-spray", ".pet-branch-tip", ".pet-branch-drop")}
    assert len(origins) == 3


def test_the_rig_is_precached_so_merlin_animates_offline():
    sw = SW.read_text(encoding="utf-8")
    for part in PARTS:
        assert f"'./assets/merlin/merlin-{part}.webp'" in sw, part
    assert "burbz-audio-prey-hunts-kitchen-v139-20260726" in sw


def test_the_perch_position_lives_in_css_not_in_inline_pixels():
    html = INDEX.read_text(encoding="utf-8")
    # setPetOnPerch used to re-assert `right: 20px; top: 0` as inline styles,
    # which outrank the stylesheet — resizing Merlin in CSS then moved the bough
    # but left the bird pinned to the old spot, hovering off the bark. It has to
    # clear those properties and let CSS place him.
    perch_fn = html.split("function setPetOnPerch()", 1)[1].split("\n}", 1)[0]
    assert "companion.style.right = ''" in perch_fn
    assert "companion.style.top = ''" in perch_fn
    for pinned in ("'20px'", "'0'"):
        assert f"companion.style.right = {pinned}" not in perch_fn
        assert f"companion.style.top = {pinned}" not in perch_fn


def test_bird_and_bough_are_sized_so_the_talons_meet_the_bark():
    html = INDEX.read_text(encoding="utf-8")

    def px(rule, prop):
        # A bare 0 is valid CSS and carries no unit.
        raw = declaration(css_rule(html, rule), prop)
        match = re.match(r"(-?[\d.]+)(px)?$", raw.strip())
        assert match, f"{rule} {prop} is {raw!r}, not a pixel length"
        return float(match.group(1))

    sprite = px(".pet-sprite", "width")
    bird_w, bird_r, bird_t = (px(".pet-companion", p) for p in ("width", "right", "top"))
    bough_w, bough_r, bough_t = (px(".pet-perch", p) for p in ("width", "right", "top"))

    # The bough SVG keeps a 0 0 180 104 viewBox whatever size it is drawn at, so
    # everything in it — including the 106 39.4 bark line — scales by this.
    k = bough_w / 180.0
    assert 0.6 < k <= 1.0, "the bough should never be drawn larger than its viewBox"

    # Both measured leftwards from the screen edge, inside the same assembly.
    talon_x = -(bird_r + bird_w) + (bird_w - sprite) / 2 + 0.44 * sprite
    talon_y = bird_t + 0.72 * sprite
    bark_x = -(bough_r + bough_w) + 106.0 * k
    bark_y = bough_t + 39.4 * k
    assert abs(talon_x - bark_x) < 2.0, f"talons are {talon_x - bark_x:.1f}px off the bark horizontally"
    assert abs(talon_y - bark_y) < 2.0, f"talons are {talon_y - bark_y:.1f}px off the bark vertically"

    # Big enough to read as a falcon at arm's length, and the bough stays the
    # smaller partner so the bird is what the eye lands on.
    assert sprite >= 68, "Merlin is too small to make out on a phone"
    assert bough_w < 180, "the bough should be the shorter one now"

    # The art's right edge must stay on screen: the cutout paints out to 93.5%
    # of its square, and the sprite is centred in the companion box.
    art_right = -(bird_r + bird_w) + (bird_w - sprite) / 2 + 0.935 * sprite
    assert art_right < -6, "Merlin's tail would clip the screen edge"
