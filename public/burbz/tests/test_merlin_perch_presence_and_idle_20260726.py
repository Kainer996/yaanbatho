"""An empty branch when Merlin is out, and a branch that behaves like a branch.

Two things.

Merlin leaving on a quest is a state, not a one-off repaint. Every surface that
draws or moves him now asks `merlinIsAway()`, `syncMerlinPerchPresence()` puts
the bough right from any tick, and a CSS rule keeps him off the bark even if
something else re-adds his `show` class. An empty perch cannot come back
carrying a bird that left ten minutes ago.

And the idle got its volume turned up. He was moving a fraction of a degree,
which at 96px reads as a still image. The bough now takes his weight down and
springs back up as well as rocking about the trunk — the whole assembly moves,
so his talons stay on the bark — and every joint in the four-piece puppet
swings roughly twice as far as it did. It is still an idle: long stillness
broken by short events, not a constant twitch.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"


def css_rule(html: str, selector: str) -> str:
    match = re.search(r"(?:^|\}|\*/)\s*" + re.escape(selector) + r"\s*\{([^}]*)\}", html)
    assert match, f"no CSS rule found for {selector}"
    return re.sub(r"/\*.*?\*/", "", match.group(1), flags=re.S)


def keyframes(html: str, name: str) -> str:
    """The block's body, brace-matched — some of these are written on one line."""
    start = html.index("@keyframes " + name)
    open_at = html.index("{", start)
    depth = 0
    for i in range(open_at, len(html)):
        if html[i] == "{":
            depth += 1
        elif html[i] == "}":
            depth -= 1
            if depth == 0:
                return html[open_at + 1:i]
    raise AssertionError(f"@keyframes {name} is unbalanced")


def function_source(html: str, name: str) -> str:
    start = html.index(f"function {name}(")
    end = html.find("\nfunction ", start + 10)
    assert end > start
    return html[start:end]


def swing(frames: str, unit: str = "deg") -> float:
    """Total travel of a rotate()/translateY() across a keyframe block."""
    values = [float(v) for v in re.findall(r"\((-?[\d.]+)" + unit + r"\)", frames)]
    assert values, f"no {unit} values in keyframes"
    return max(values) - min(values)


# ---------------------------------------------------------------------------
# Merlin is not on the branch while he is away
# ---------------------------------------------------------------------------

def test_an_away_merlin_is_hidden_by_css_not_only_by_a_repaint():
    html = HTML.read_text(encoding="utf-8")
    # Belt and braces: the away class alone takes him off the bark, so no other
    # code path can put him back by re-adding `show`.
    assert ".merlin-perch-assembly.merlin-away .pet-companion { display: none !important; }" in html


def test_one_question_decides_where_merlin_is():
    html = HTML.read_text(encoding="utf-8")
    assert "function merlinIsAway(" in html
    away = function_source(html, "merlinIsAway")
    assert "birdHasActiveExpedition(MERLIN_GUIDE.id)" in away

    sync = function_source(html, "syncMerlinPerchPresence")
    assert "merlinIsAway()" in sync
    assert "classList.toggle('show', !away)" in sync
    assert "classList.toggle('merlin-away', away)" in sync
    # Away takes his flight timer, his speech bubble and his care menu with him.
    # The close is forced: a tutorial lesson can hold the menu open, but Merlin
    # flying off always wins.
    assert "clearTimeout(petFlightTimer)" in sync
    assert "closeMerlinCareMenu({ force:true })" in sync

    # The renderer defers to the same sync rather than duplicating the logic.
    render = function_source(html, "renderPetCompanion")
    assert "syncMerlinPerchPresence()" in render
    assert "birdHasActiveExpedition" not in render


def test_nothing_can_fly_a_missing_merlin_back_onto_the_perch():
    html = HTML.read_text(encoding="utf-8")
    fly = function_source(html, "petFlyOutAndReturn")
    assert "merlinIsAway()" in fly
    # The quest board redraws while quests run, so it keeps the bough honest.
    board = function_source(html, "renderBirdExpeditions")
    assert "syncMerlinPerchPresence()" in board


def test_the_empty_bough_rides_lighter_without_him():
    html = HTML.read_text(encoding="utf-8")
    assert ".merlin-perch-assembly.merlin-away { animation: merlinBranchLighten" in html
    lighten = keyframes(html, "merlinBranchLighten")
    # No falcon on the end of it: it sits higher than the loaded bough's rest.
    assert "translateY" in lighten
    heights = [float(v) for v in re.findall(r"translateY\((-?[\d.]+)px\)", lighten)]
    assert max(heights) < 0, "the unloaded bough should sit above the loaded rest position"


# ---------------------------------------------------------------------------
# The branch reads as a branch, and Merlin reads as alive
# ---------------------------------------------------------------------------

def test_the_bough_bobs_as_well_as_rocks():
    html = HTML.read_text(encoding="utf-8")
    sway = keyframes(html, "merlinBranchSway")
    # Up and down — the motion that says "this is growing out of a tree".
    assert "translateY" in sway
    assert swing(sway, "px") >= 4.0, "the bob is too small to read"
    # And it still rocks about the trunk end, so the two read as one bough.
    assert swing(sway) >= 2.5
    assert "transform-origin: right center" in css_rule(html, ".merlin-perch-assembly")
    # One parent carries both, so the talons cannot drift off the bark.
    for child in (".pet-perch", ".pet-companion"):
        assert "animation" not in css_rule(html, child), child


def test_the_bough_moves_on_a_believable_cycle_not_a_creep():
    html = HTML.read_text(encoding="utf-8")
    seconds = float(re.search(r"([\d.]+)s", css_rule(html, ".merlin-perch-assembly").split("animation:")[1]).group(1))
    assert 4 <= seconds <= 12, f"a bough in light air, not a {seconds}s creep"


def test_every_joint_swings_far_enough_to_see():
    html = HTML.read_text(encoding="utf-8")
    # Old amplitudes, kept here as the floor this release had to clear.
    for name, was in (("merlin-head-look", 8.0), ("merlin-wing-shuffle", 6.6), ("merlin-cape-sway", 2.1)):
        assert swing(keyframes(html, name)) > was * 1.5, f"{name} barely moved"
    # The chest still swells from the talons and still never translates.
    breathe = keyframes(html, "merlin-breathe")
    assert "translate" not in breathe
    scales = [float(v) for v in re.findall(r"scaleY\(([\d.]+)\)", breathe)]
    assert max(scales) >= 1.03, "the breath is invisible at this size"
    # The sprite's own rock grew too, without lifting him off the bark.
    idle = keyframes(html, "pet-idle")
    assert "translateY" not in idle
    assert swing(idle) >= 2.0


def test_the_twigs_quiver_harder_than_they_did():
    html = HTML.read_text(encoding="utf-8")
    assert swing(keyframes(html, "merlin-twig-flutter")) >= 5.0
    # Three twig groups, three different speeds — no two flex in lockstep.
    speeds = {re.search(r"([\d.]+)s", css_rule(html, s).split("animation:")[1]).group(1)
              for s in (".pet-branch-spray", ".pet-branch-tip", ".pet-branch-drop")}
    assert len(speeds) == 3


def test_the_louder_idle_is_still_an_idle_and_still_parks_for_reduced_motion():
    html = HTML.read_text(encoding="utf-8")
    # Long cycles: events punctuate stillness rather than running continuously.
    for selector, lower in ((".merlin-head", 4.0), (".merlin-wing", 5.0), (".merlin-back", 6.0)):
        seconds = float(re.search(r"([\d.]+)s", css_rule(html, selector).split("animation:")[1]).group(1))
        assert seconds >= lower, f"{selector} cycles every {seconds}s"
    block = re.search(r"@media \(prefers-reduced-motion: reduce\) \{\s*\.merlin-perch-assembly.*?\n\}", html, re.S)
    assert block, "the perch lost its reduced-motion guard"
    assert "animation:none !important;" in block.group(0)
