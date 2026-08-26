"""The living canopy — layered painted branches (2026-08-06).

The v234 living-tree release animated the Academy by tilting the one flat
painting, and Yaan called it what it was: "it's the same picture of the tree
... it's just warping." He generated a new master tree and six branch
paintings to fix it properly. This release rebuilds the scene in layers:

- a new tree background (assets/academy-tree-manga-20260806.webp) whose
  trunk barely breathes — treeSway is now a hair of drift, not a lean;
- real cut-out boughs (assets/academy-branches/*.webp, background-removed
  from Yaan's generations) layered BEHIND the buildings (sprouting from the
  trunk) and IN FRONT of them (overhanging the camera), each pivoting about
  the point where its bark meets the trunk on its own tempo and phase —
  the branches genuinely move while the trunk stands still;
- the alive engine's procedural corner tufts retired (two art styles of
  foliage would clash), machinery kept;
- default room positions retuned so fresh buildings land on the painted
  boughs of the new tree.
"""

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
ALIVE = (ROOT / "academy_alive_core.js").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")

RELEASE_PIN = "living-canopy-v236-20260806"
# The build has moved on (sleep-retired-v238) but the canopy cores have not,
# so they keep their own pin while the build tracks the current tag.
CURRENT_BUILD = "village-swipe-v332-20260826"
# magpie-market-v316 edited this core, so it ships under that tag now.
MAGPIE_CORE_PIN = "magpie-market-v316-20260824"

BRANCH_SPRITES = ("branch-a", "branch-b", "branch-c", "branch-d")


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


# ---- the new tree ------------------------------------------------------------

def test_new_tree_painting_ships_and_is_referenced():
    assert (ROOT / "assets" / "academy-tree-manga-20260806.webp").exists()
    rule = re.search(r"\.academy-tree-swaybg[^{]*\{([^}]*)\}", HTML)
    assert rule and "academy-tree-manga-20260806.webp" in rule.group(1), (
        "the sway div must paint the new tree"
    )
    # The old painting must no longer be precached — users should not pay for
    # both trees.
    assert "academy-tree-manga-20260629.png" not in SW


def test_the_trunk_breathes_instead_of_warping():
    kf = re.search(r"@keyframes treeSway \{([^}]*)\}", HTML)
    assert kf, "treeSway keyframes must exist"
    angles = [abs(float(a)) for a in re.findall(r"rotate\((-?[\d.]+)deg\)", kf.group(1))]
    assert angles and max(angles) <= 0.2, (
        "global tree sway must stay a subtle breath (the warp complaint); "
        "visible movement belongs to the branch layers"
    )


# ---- the branch layers -------------------------------------------------------

def test_branch_sprites_ship():
    for name in BRANCH_SPRITES:
        assert (ROOT / "assets" / "academy-branches" / f"{name}.webp").exists(), name


def test_branches_sandwich_the_buildings():
    # Back layer before the sway wrapper (behind buildings), front layer after.
    back = HTML.index('class="academy-branches academy-branches-back"')
    wrapper = HTML.index('id="academyTreeSway"')
    front = HTML.index('class="academy-branches academy-branches-front"')
    assert back < wrapper < front, (
        "back boughs must render behind the treehouses, front boughs in front"
    )
    # Six placed boughs, each an instance class with its own pivot and tempo.
    for n in range(1, 7):
        assert f'ab-{n}' in HTML, f"branch instance ab-{n} missing"
        rule = re.search(re.escape(f".ab-{n}") + r" \{([^}]*)\}", HTML)
        assert rule, f".ab-{n} needs CSS"
        css = rule.group(1)
        assert "transform-origin" in css, f".ab-{n} must pivot at its bark end"
        assert "abSway" in css, f".ab-{n} must ride a sway keyframe"


def test_boughs_pivot_on_three_distinct_tempos():
    for kf in ("abSwayA", "abSwayB", "abSwayC"):
        assert f"@keyframes {kf}" in HTML, f"{kf} missing"
    # Real rotation, not translation-only drift.
    seg = HTML[HTML.index("@keyframes abSwayA"):]
    seg = seg[: seg.index("/* ----", 10) if "/* ----" in seg[10:] else len(seg)]
    assert "rotate(" in seg and "translateY(" in seg, (
        "boughs must pivot with a touch of vertical spring"
    )


def test_branch_layers_never_eat_taps_and_respect_reduced_motion():
    layers = re.search(r"\.academy-branches \{([^}]*)\}", HTML)
    assert layers and "pointer-events:none" in layers.group(1).replace(" ", ""), (
        "branch layers must pass placement taps through to the tree"
    )
    assert ".academy-branch { animation:none; }" in HTML, (
        "reduced motion must still the canopy"
    )


def test_canopy_dims_at_night():
    assert re.search(
        r"\.academy-treehouse\.alive-night \.academy-branch \{[^}]*brightness\(", HTML
    ), "the branch layers must darken with the night scene"


# ---- the engine's procedural tufts stand down --------------------------------

def test_procedural_corner_tufts_are_retired_but_machinery_kept():
    # The painted boughs replaced the canvas-drawn corner tufts; the functions
    # stay (and are still pinned by the academy-alive suite) so they can come
    # back with one defs entry if the layers ever go.
    assert "buildFoliage" in ALIVE and "drawFoliage" in ALIVE
    fol = ALIVE[ALIVE.index("function buildFoliage()"):ALIVE.index("function drawFoliage(")]
    assert "var defs = [];" in fol, "the tuft defs list must be empty"
    assert "living-canopy" in fol, "the retirement must say why, in place"


# ---- rooms land on the painted boughs ---------------------------------------

def test_default_room_positions_sit_on_the_new_boughs():
    out = _run_node(
        """
        const core = require('./academy_treehouse_core.js');
        const pos = Object.fromEntries(core.getAcademyRooms().map(r => [r.id, [r.x, r.y]]));
        console.log(JSON.stringify(pos));
        """
    )
    # The six painted shelves of the 2026-08-06 tree (fractions read off the
    # painting). A change here is a design decision, not drift.
    expected = {
        "tavern": [80, 71], "training": [75, 58],
        "hospital": [25, 52], "crowbar": [75, 41], "kitchen": [50, 55],
        "workshop": [29, 30], "library": [74, 26], "nursery": [35, 16],
        "observatory": [66, 12], "quest_roost": [49, 71], "outdoors": [50, 92],
    }
    for room, xy in expected.items():
        assert out[room] == xy, f"{room} default moved off its bough: {out[room]}"


# ---- release pins ------------------------------------------------------------

def test_release_is_pinned_and_shipped():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    assert RELEASE_PIN in SW, "the release lineage stays in BURBZ_CACHE"
    # academy_treehouse_core moved with v258, then again with v287
    # (training statBonus); the alive core still ships under this release.
    for core, pin in (("academy_alive_core.js", MAGPIE_CORE_PIN),
                      ("academy_treehouse_core.js", "iron-ingot-errand-v326-20260825")):
        assert f"{core}?v={pin}" in HTML, core
        assert f"./{core}?v={pin}" in SW, core
    for name in BRANCH_SPRITES:
        assert f"./assets/academy-branches/{name}.webp" in SW, (
            f"{name} must be precached for offline play"
        )
    assert "./assets/academy-tree-manga-20260806.webp" in SW
