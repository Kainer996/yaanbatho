"""The living Academy tree (2026-08-06).

Yaan asked for the Academy to read as a genuinely living, breathing place:

- the painted tree sways slowly the way Merlin's perch branch does, and the
  treehouses ride the SAME sway — they are pinned to the tree, not floating
  over it;
- the buildings are smaller and nestled into the bark, each rocking gently on
  its own bough at its own angle and tempo;
- the windows go dark and relight far more often (residents moving between
  rooms), and three chimneys smoke instead of one and a half;
- The Crowbar's little crow steps onto the pub deck and patrols it — hops
  along, turns, pecks at the boards, flicks his tail, hops back.

The crow is the one deliberate bird on the tree. The no-birds rule
(test_academy_alive_20260729.test_no_birds_anywhere_on_the_academy_tree)
banned the AMBIENT birds — engine flyers, flocks, companion sprites — and
those stay banned: the pub's regular is hand-authored markup in index.html
(same precedent as the Library's hand-drawn SVG art), not an engine actor,
and he wears his own class names on purpose.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
CORE = (ROOT / "academy_alive_core.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")

RELEASE_PIN = "living-canopy-v236-20260806"
# Later releases advance BURBZ_BUILD but academy_alive_core.js has not moved,
# so the core keeps its own pin while the build tracks the current tag.
CURRENT_BUILD = "alderwing-living-settlements-v348-20260904"
# magpie-market-v316 edited this core, so it ships under that tag now.
MAGPIE_CORE_PIN = "rook-recognition-special-characters-v347-20260904"

PLACEABLE_ROOMS = (
    "tavern", "quest_roost", "crowbar", "training", "kitchen",
    "hospital", "nursery", "workshop", "library", "observatory",
)


def _run_node(script: str) -> dict:
    result = subprocess.run(
        ["node", "-e", script],
        capture_output=True,
        text=True,
        encoding="utf-8",
        cwd=str(ROOT),
        timeout=60,
    )
    assert result.returncode == 0, f"node failed: {result.stderr}"
    return json.loads(result.stdout.strip().splitlines()[-1])


# ---- the buildings ride the tree's own sway ---------------------------------

def test_buildings_ride_the_same_sway_as_the_tree():
    assert '<div class="academy-tree-sway" id="academyTreeSway">' in HTML, (
        "the sway wrapper must exist in the treehouse markup"
    )
    # It wraps all three treehouse layers, so buildings, hint and birds all
    # lean with the canopy.
    seg = HTML[HTML.index('id="academyTreeSway"'):]
    seg = seg[: seg.index("academy-stage-3d")]
    for layer in ("treehouseBranchLayer", "treehouseRoomLayer", "treehouseBirdLayer"):
        assert layer in seg, f"{layer} must live inside the sway wrapper"
    # Both the painted tree and the wrapper run the IDENTICAL animation
    # shorthand — same name, duration, easing — so they can never drift apart.
    sway = re.search(r"\.academy-tree-sway \{([^}]*)\}", HTML)
    bg = re.search(r"\.academy-tree-swaybg[^{]*\{([^}]*)\}", HTML)
    assert sway and bg
    shorthand = "animation:treeSway 13s ease-in-out infinite alternate"
    assert shorthand in sway.group(1), "the wrapper must ride treeSway"
    assert shorthand in bg.group(1), "the painting must ride the same treeSway"


def test_sway_wrapper_never_eats_taps_but_rooms_stay_tappable():
    sway = re.search(r"\.academy-tree-sway \{([^}]*)\}", HTML)
    assert "pointer-events:none" in sway.group(1).replace(" ", ""), (
        "the wrapper must pass placement taps through to the tree"
    )
    node = re.search(r"\.treehouse-room-node \{([^}]*)\}", HTML)
    assert "pointer-events:auto" in node.group(1).replace(" ", ""), (
        "room buttons must re-enable pointer events inside the inert wrapper"
    )


# ---- smaller buildings, nestled in and rocking on their boughs --------------

def test_buildings_are_smaller_and_nestled_into_the_bark():
    sprite = re.search(r"\.treehouse-building-sprite \{([^}]*)\}", HTML)
    assert sprite, "sprite CSS must exist"
    css = sprite.group(1)
    assert "width:92px" in css and "height:92px" in css, (
        "sprites shrank from 112px to 92px to sit into the tree"
    )
    assert "thBranchRock" in css, "every building rocks on its bough"
    assert "@keyframes thBranchRock" in HTML
    node = re.search(r"\.treehouse-room-node \{([^}]*)\}", HTML)
    assert "width:92px" in node.group(1), "the node box shrinks with its sprite"


def test_every_room_sits_on_its_own_bough():
    # Each placeable room gets its own resting tilt and rock tempo, so the
    # tree reads as many boughs rather than one sheet of buildings.
    for room in PLACEABLE_ROOMS:
        rule = re.search(
            re.escape(f'.treehouse-room-node[data-room="{room}"]') + r" \{([^}]*)\}",
            HTML,
        )
        assert rule, f"{room} needs its own bough tuning"
        assert "--th-tilt" in rule.group(1) and "--th-rock-dur" in rule.group(1)


def test_glow_radii_scale_with_the_smaller_sprite_box():
    assert "a.r * (box / SPRITE_BOX)" in CORE, (
        "anchor glow radii were tuned on 112px paintings and must scale down "
        "with the box, or windows would over-glow the shrunken buildings"
    )


# ---- The Crowbar's crow ------------------------------------------------------

def test_the_crowbar_crow_patrols_the_deck():
    assert "function crowbarCrowHTML()" in HTML
    assert "r.id === 'crowbar' ? crowbarCrowHTML() : ''" in HTML, (
        "only The Crowbar gets the crow"
    )
    for cls in ("crowbar-crow", "cb-crow-body", "cb-crow-head", "cb-crow-tail"):
        assert cls in HTML, f"the crow puppet must carry {cls}"
    for kf in (
        "crowbarCrowPatrol", "crowbarCrowBob", "crowbarCrowPeck",
        "crowbarCrowTailFlick",
    ):
        assert f"@keyframes {kf}" in HTML, f"the crow must animate via {kf}"
    # He genuinely walks backwards and forwards: the patrol flips his facing.
    patrol = HTML[
        HTML.index("@keyframes crowbarCrowPatrol"):
        HTML.index("@keyframes crowbarCrowBob")
    ]
    assert "scaleX(-1)" in patrol and "scaleX(1)" in patrol, (
        "the patrol must turn the crow around, not moonwalk him home"
    )


def test_the_no_birds_rule_still_binds_the_ambience_engine():
    # The crow is markup; the engine stays birdless and the companion sprites
    # stay off the tree.
    assert 'class="treehouse-bird"' not in HTML
    for gone in ("spawnBirdActor", "spawnFeather", "drawBirdActors"):
        assert gone not in CORE


# ---- livelier windows, more smoke -------------------------------------------

def test_more_chimneys_and_livelier_windows():
    out = _run_node(
        """
        const core = require('./academy_alive_core.js');
        const smoke = room => (core.ANCHORS[room] || []).filter(a => a.type === 'smoke');
        console.log(JSON.stringify({
          kitchenPower: smoke('kitchen')[0].power,
          crowbarSmokes: smoke('crowbar').length,
          hospitalSmokes: smoke('hospital').length,
          crowbarLanterns: (core.ANCHORS.crowbar || []).filter(a => a.glow === 'lantern').length,
          windowOff: core.GLOW_STYLES.window.offChance,
          lanternOff: core.GLOW_STYLES.lantern.offChance,
          fractionsValid: Object.values(core.ANCHORS).flat()
            .every(a => a.fx >= 0 && a.fx <= 1 && a.fy >= 0 && a.fy <= 1)
        }));
        """
    )
    assert out["kitchenPower"] >= 1.2, "the Kitchen chimney works harder now"
    assert out["crowbarSmokes"] >= 1, "the Crowbar stovepipe must smoke"
    assert out["hospitalSmokes"] >= 1, "the Hospital ward stove must smoke"
    assert out["crowbarLanterns"] >= 2, "the painted lanterns must survive"
    assert out["windowOff"] >= 0.02, "windows must go dark noticeably often"
    assert out["lanternOff"] >= 0.012, "lanterns too"
    assert out["fractionsValid"], "new smoke anchors are fractions of the box"


# ---- safety rails ------------------------------------------------------------

def test_reduced_motion_switches_all_of_it_off():
    for frag in (
        ".academy-tree-swaybg { animation:none; }",
        ".academy-tree-sway { animation:none; }",
        ".treehouse-building-sprite { animation:none; }",
        ".crowbar-crow,.cb-crow-body,.cb-crow-head,.cb-crow-tail { animation:none; }",
    ):
        assert frag in HTML, f"reduced motion must disable: {frag}"


# ---- release pins ------------------------------------------------------------

def test_release_is_pinned_and_shipped():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    assert RELEASE_PIN in SW, "the release lineage stays in BURBZ_CACHE"
    assert f'academy_alive_core.js?v={MAGPIE_CORE_PIN}' in HTML
    assert f"./academy_alive_core.js?v={MAGPIE_CORE_PIN}" in SW
