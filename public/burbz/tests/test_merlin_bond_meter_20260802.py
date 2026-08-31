"""Merlin's care menu shows a visible bond meter, not just a level number.

The bond between the player and Merlin has always been tracked (bondXp rolls
into bondLevel at 100), but only the level was ever shown. This release adds
a fourth bar to the care menu that fills toward the next bond level, ticks up
whenever the player feeds, plays with or rests Merlin, and pops a "+X bond"
chip (with sparkles and a level-up line when the level rolls over).
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE_PIN = "feeding-menu-banked-coins-v337-20260831"
# This release's own marker stays on the cache lineage even after later
# releases move BURBZ_BUILD on.
OWN_RELEASE_PIN = "merlin-bond-meter-v197-20260802"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_bond_meter_markup_sits_in_the_care_menu():
    html = HTML.read_text(encoding="utf-8")
    for marker in [
        'id="merlinBondFill"',
        'id="merlinBondXpValue"',
        'id="merlinBondGain"',
        "merlin-bond-row",
        "merlin-bond-fill",
    ]:
        assert marker in html, marker
    # The meter lives inside the same status block as food/happiness/energy,
    # and the existing level readout in the meta row survives.
    status_start = html.index('<div class="merlin-care-status">')
    status_end = html.index("</div>\n    <div class=\"merlin-care-meta\"", status_start)
    assert 'id="merlinBondFill"' in html[status_start:status_end]
    assert 'id="merlinBondLevel"' in html


def test_bond_meter_styles_and_animations_exist():
    html = HTML.read_text(encoding="utf-8")
    for marker in [
        ".merlin-bond-row",
        ".merlin-bond-fill",
        "@keyframes merlinBondBump",
        ".merlin-bond-gain",
        "@keyframes merlinBondGainPop",
    ]:
        assert marker in html, marker


def test_render_updates_bond_fill_and_xp_readout():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("function renderMerlinCareMenu()")
    body = html[start:html.index("\nfunction ", start + 10)]
    assert "$('merlinBondFill').style.width = bondXp + '%'" in body
    assert "$('merlinBondXpValue').textContent = bondXp + '/100'" in body
    assert "'LV.' + pet.bondLevel" in body


def test_care_actions_surface_the_bond_gain():
    html = HTML.read_text(encoding="utf-8")
    start = html.index("function careForMerlin(action)")
    body = html[start:html.index("\nfunction compactMerlinSpeech", start)]
    # Both the diet-core feed path and the generic feed/play/rest path measure
    # the bond before acting and pop the gain after a successful action.
    assert "const bondBefore = merlinBondTotal(getMerlinCare())" in body
    assert body.count("showMerlinBondGain(merlinBondTotal(getMerlinCare()) - bondBefore") == 2
    # The pop helper pulses the fill, shows the chip and celebrates level-ups.
    assert "function showMerlinBondGain(gained, leveledUp)" in html
    assert "bond-bump" in html
    assert "makePetSparkles(12)" in html


def test_core_grants_bond_for_feed_play_and_rest_and_levels_up():
    out = run_node(
        """
        const core = require('./merlin_companion_core.js');
        const now = 1754000000000;
        const base = core.sanitizeMerlinCare({ hunger: 80, happiness: 50, energy: 60, bondXp: 0, bondLevel: 1, lastHungerAt: now }, now);
        const play = core.applyMerlinCareAction(base, {}, 'play', now);
        const rest = core.applyMerlinCareAction(base, {}, 'rest', now);
        const feed = core.applyMerlinCareAction(base, { small_bird_prey_ration: 1 }, 'feed', now);
        const nearLevel = core.grantMerlinBondXp({ ...base, bondXp: 97, bondLevel: 1 }, 8, now);
        console.log(JSON.stringify({
          playBond: play.state.bondXp,
          restBond: rest.state.bondXp,
          feedOk: feed.ok,
          feedBond: feed.state.bondXp,
          leveledLevel: nearLevel.bondLevel,
          leveledXp: nearLevel.bondXp
        }));
        """
    )
    assert out["playBond"] == 8
    assert out["restBond"] == 3
    assert out["feedOk"] is True
    assert out["feedBond"] == 5
    # 97 + 8 rolls the meter over into bond level 2 with 5 XP carried forward.
    assert out["leveledLevel"] == 2
    assert out["leveledXp"] == 5


def test_release_is_versioned_for_service_worker_self_update():
    cache_line = next(
        line for line in SW.read_text(encoding="utf-8").splitlines()
        if line.startswith("const BURBZ_CACHE = ")
    )
    assert OWN_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(RELEASE_PIN)
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML.read_text(encoding="utf-8")
