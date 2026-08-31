"""Every destination stands fixed and symmetrical — nothing scrolls.

Yaan's asks, in two beats: first Scan had to hold the bottom centre with
Empire and Academy beside it (anchored-dock-v301); then the strip under
them had to stop scrolling too. The dock is a double-decker now: six
management rooms ride the top deck, and the adventure row below flanks
the solid island — Map and Quests to port, Battle and the codex to
starboard.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = (ROOT / "index.html").read_text(encoding="utf-8")


def island() -> str:
    m = re.search(r'<div class="bottom-dock-anchor"[^>]*>(.*?)</div>\n  </div>', HTML, re.DOTALL)
    assert m, "the anchored island is missing"
    return m.group(1)


def strip() -> str:
    m = re.search(r'<nav\b[^>]*\bid="bottomNav"[^>]*>(.*?)</nav>', HTML, re.DOTALL)
    assert m, "#bottomNav is missing"
    return m.group(1)


def test_the_island_holds_empire_scan_academy_in_that_order():
    labels = re.findall(r'<div class="nav-label">([^<]+)</div>', island())
    assert labels == ["Empire", "Scan", "Academy"]
    # Real routed tabs, not copies: the strip carries none of the three.
    s = strip()
    for screen in ("village", "scan", "academy"):
        assert f'data-screen="{screen}"' not in s, screen
    assert HTML.count('data-screen="scan"') >= 1


def test_the_dock_is_fixed_and_symmetrical_with_no_scrolling():
    dock_open = HTML.index('<div class="bottom-dock" id="bottomDock">')
    nav_open = HTML.index('id="bottomNav"', dock_open)
    anchor_open = HTML.index('bottom-dock-anchor', dock_open)
    assert dock_open < nav_open < anchor_open
    nav_css = re.search(r"\.bottom-nav\s*\{([^}]*)\}", HTML).group(1)
    assert "overflow" not in nav_css, "nothing in the dock scrolls any more"
    assert "flex-direction: column" in nav_css
    anchor_css = re.search(r"\.bottom-dock-anchor\s*\{([^}]*)\}", HTML).group(1)
    assert "position: absolute" in anchor_css
    assert "left: 50%" in anchor_css and "translateX(-50%)" in anchor_css


def test_two_decks_six_up_top_and_a_symmetric_adventure_row():
    top = re.search(r'<div class="dock-row dock-row-top">(.*?)</div>\n  <div class="dock-row dock-row-low">', HTML, re.DOTALL).group(1)
    assert re.findall(r'<div class="nav-label">([^<]+)</div>', top) == [
        "Kitchen", "Stores", "Training", "Hospital", "Forge", "Ranks"
    ]
    low = HTML[HTML.index('<div class="dock-row dock-row-low">'):HTML.index('</nav>')]
    pairs = low.split('<div class="dock-pair">')[1:]
    assert len(pairs) == 2, "two symmetric wings flank the island"
    assert re.findall(r'<div class="nav-label">([^<]+)</div>', pairs[0]) == ["Map", "Quests"]
    # feeding-menu-banked-coins-v337: the codex tab is the player's Birds —
    # Burbz names the enemy zombie flock, never their own companions.
    assert re.findall(r'<div class="nav-label">([^<]+)</div>', pairs[1]) == ["Battle", "Birds"]
    # Both wings are equal-sized, so space-between keeps them mirrored.
    low_css = re.search(r"\.dock-row-low\s*\{([^}]*)\}", HTML).group(1)
    assert "space-between" in low_css


def test_the_dock_wrapper_carries_the_chrome_and_the_js_measures_it():
    dock_css = re.search(r"\.bottom-dock\s*\{([^}]*)\}", HTML).group(1)
    assert "position: absolute" in dock_css and "bottom: 0" in dock_css
    # Layout maths, tutorial inerting and tap-audio suppression all follow
    # the wrapper, so the islanded tabs behave exactly like strip tabs.
    assert "document.querySelector('.bottom-dock')" in HTML
    assert "'.header, .main, .bottom-dock'" in HTML
    assert "control.closest('.bottom-dock')" in HTML
    assert "'#bottomDock .nav-item.active'" in HTML
