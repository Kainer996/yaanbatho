"""Academy opens in 2D by default (academy-2d-default-v250-20260811).

The tutorial sends new players to the Academy to tap the tree and place a
building. The 3D tree misfires those taps on some phones, so the painted 2D
Academy is now the default view. 3D stays one tap away and a saved 3D choice
is still honoured.
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")
SW = (ROOT / "sw.js").read_text(encoding="utf-8")
OWN_RELEASE_PIN = "academy-2d-default-v250-20260811"
PREVIOUS_RELEASE_PIN = "walking-story-quests-v249-20260811"
CURRENT_BUILD = "companion-card-polish-v355-20260906"


def test_the_academy_defaults_to_the_painted_2d_tree():
    # Only an explicit saved '3d' choice opens the 3D tree.
    assert "localStorage.getItem(ACADEMY_VIEW_KEY) === '3d' ? '3d' : '2d'" in HTML
    # Even a broken localStorage lands on the painting, never the 3D canvas.
    assert "} catch (e) { return '2d'; }" in HTML


def test_3d_is_still_one_tap_away():
    assert 'id="academyViewToggle"' in HTML
    assert "function toggleAcademyView()" in HTML
    # The button starts as the way IN to 3D, matching the 2D default.
    assert '>🌳 3D</button>' in HTML


def test_release_is_versioned():
    assert f"const BURBZ_BUILD = '{CURRENT_BUILD}';" in HTML
    cache_line = next(line for line in SW.splitlines() if line.startswith("const BURBZ_CACHE"))
    assert PREVIOUS_RELEASE_PIN in cache_line  # lineage kept
    assert OWN_RELEASE_PIN in cache_line  # this release's own segment
    assert cache_line.rstrip("';").endswith(CURRENT_BUILD)
