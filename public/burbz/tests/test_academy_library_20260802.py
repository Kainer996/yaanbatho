"""The Academy grows a Library — the reading room that makes birds cleverer.

A new buildable treehouse room, The Library (floor 5, right branch), joins the
Academy. Birds stationed there grow INT passively like the Moon Observatory
(two INT rooms on purpose: one charts the sky, one reads about it), and a new
Quiet Study drill — shorter and kinder than the Focus Roost — raises INT and
counts toward the same MIND battle-move line. The room has hand-drawn SVG art:
a building sprite on the tree (assets/academy-buildings/library.svg, with
living-light anchors read off its own geometry) and an inline procedural
interior scene, reached through the SVG fallback path in ACADEMY_ROOM_SCENES.
"""
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"
RELEASE_PIN = "screen-swipe-v336-20260831"
PREVIOUS_RELEASE_PIN = "merlin-bond-meter-v197-20260802"


def run_node(source: str) -> dict:
    result = subprocess.run(
        ["node", "-e", source],
        cwd=ROOT,
        text=True,
        capture_output=True,
        check=True,
    )
    return json.loads(result.stdout)


def test_library_room_is_defined_in_the_academy_core():
    out = run_node(
        """
        const core = require('./academy_treehouse_core.js');
        const room = core.getAcademyRooms().find(r => r.id === 'library');
        const drill = core.getTrainingTemplates().find(t => t.id === 'quiet_study');
        console.log(JSON.stringify({ room, drill }));
        """
    )
    room = out["room"]
    assert room, "library room missing from TREEHOUSE_ROOMS"
    assert room["label"] == "The Library"
    assert room["trainStat"] == "int"
    assert room["floor"] == 5 and room["branch"] == "right"
    assert room["cost"] > 0 and room["branches"] > 0 and room["unlockLevel"] >= 1
    drill = out["drill"]
    assert drill, "quiet_study drill missing from TRAINING_TEMPLATES"
    assert drill["room"] == "library"
    assert drill["stat"] == "int"
    # Same MIND school as the Focus Roost, so Library sessions advance the
    # same battle-move line.
    assert drill["school"] == "mind"


def test_quiet_study_sessions_run_and_reward_int():
    out = run_node(
        """
        const core = require('./academy_treehouse_core.js');
        const bird = { id: 'robin-1', commonName: 'Robin' };
        const now = 1754000000000;
        const session = core.createTrainingSession(bird, 'quiet_study', now);
        const mid = core.advanceTrainingSession(session, now + 75 * 60 * 1000);
        const done = core.advanceTrainingSession(session, now + 150 * 60 * 1000);
        console.log(JSON.stringify({
          room: session.room,
          stat: session.rewards.stat,
          school: session.rewards.school,
          midStatus: mid.status,
          doneStatus: done.status
        }));
        """
    )
    assert out["room"] == "library"
    assert out["stat"] == "int"
    assert out["school"] == "mind"
    assert out["midStatus"] == "active"
    assert out["doneStatus"] == "complete"


def test_library_is_wired_into_the_page():
    html = HTML.read_text(encoding="utf-8")
    # Buildable sprite on the tree, room config, and passive INT growth.
    assert "library:'assets/academy-buildings/library.svg'" in html
    assert "library: { label:'THE LIBRARY', icon:'📚', buildingId:'library'" in html
    assert "library:     { stat:'int',     label:'INT' }" in html
    # The interior is the inline SVG scene: the fallback path must exist and
    # the Library must NOT have a painted-PNG interior entry that would
    # bypass it.
    assert "if (!src) return ACADEMY_ROOM_SVG_FALLBACKS(room, label);" in html
    assert "library: 'assets/academy-interiors-manga" not in html
    assert "library() {" in html  # the inline interior scene itself


def test_library_art_and_ambience_exist():
    svg = (ROOT / "assets/academy-buildings/library.svg").read_text(encoding="utf-8")
    assert 'aria-label="The Library"' in svg
    assert "<svg" in svg and "</svg>" in svg
    alive = (ROOT / "academy_alive_core.js").read_text(encoding="utf-8")
    assert "library: [" in alive  # living-light anchors for the sprite
    three_d = (ROOT / "academy_3d_core.js").read_text(encoding="utf-8")
    assert "library:     { angle:" in three_d  # its own branch anchor
    assert "label: 'The Library'" in three_d  # and a building style


def test_release_is_versioned_for_service_worker_self_update():
    sw = SW.read_text(encoding="utf-8")
    cache_line = next(
        line for line in sw.splitlines() if line.startswith("const BURBZ_CACHE = ")
    )
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert cache_line.rstrip("';").endswith(RELEASE_PIN)
    assert f"const BURBZ_BUILD = '{RELEASE_PIN}';" in HTML.read_text(encoding="utf-8")
    # The new sprite is precached for offline play.
    assert "'./assets/academy-buildings/library.svg'" in sw
