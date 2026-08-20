"""Empire · Scan · Academy stand solid; the rest of the dock scrolls.

Yaan's ask: the v298 dock scrolled the Scan button away with everything
else. Scan must hold the bottom centre — Empire on its left, Academy on
its right — while the other ten destinations scroll left and right
beneath them.
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


def test_the_strip_scrolls_and_the_island_does_not():
    # The scroller and the island are siblings inside one dock, so the
    # island cannot travel with the scroll position.
    dock_open = HTML.index('<div class="bottom-dock" id="bottomDock">')
    nav_open = HTML.index('id="bottomNav"', dock_open)
    anchor_open = HTML.index('bottom-dock-anchor', dock_open)
    assert dock_open < nav_open < anchor_open
    nav_css = re.search(r"\.bottom-nav\s*\{([^}]*)\}", HTML).group(1)
    assert "overflow-x: auto" in nav_css
    anchor_css = re.search(r"\.bottom-dock-anchor\s*\{([^}]*)\}", HTML).group(1)
    assert "position: absolute" in anchor_css
    assert "left: 50%" in anchor_css and "translateX(-50%)" in anchor_css


def test_the_dock_wrapper_carries_the_chrome_and_the_js_measures_it():
    dock_css = re.search(r"\.bottom-dock\s*\{([^}]*)\}", HTML).group(1)
    assert "position: absolute" in dock_css and "bottom: 0" in dock_css
    # Layout maths, tutorial inerting and tap-audio suppression all follow
    # the wrapper, so the islanded tabs behave exactly like strip tabs.
    assert "document.querySelector('.bottom-dock')" in HTML
    assert "'.header, .main, .bottom-dock'" in HTML
    assert "control.closest('.bottom-dock')" in HTML
    assert "'#bottomDock .nav-item.active'" in HTML
