"""Service-worker self-update: stale clients pick up new builds on their own.

A mobile tab or installed PWA can sit in the background for hours without a
real navigation, so it keeps showing whatever build it loaded last — players
were still seeing the pre-v6 tutorial long after the v6 deploy went live. The
page now re-checks for a new service worker whenever the app is opened or
foregrounded, reloads exactly once when an updated worker takes over, and
Settings shows a build tag so anyone can tell which build is running.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def test_registration_checks_for_updates_on_open_and_foreground():
    html = HTML.read_text(encoding="utf-8")
    assert "navigator.serviceWorker.register('./sw.js', { scope: './' }).then(reg => {" in html
    assert "reg.update().catch(() => {})" in html
    assert "document.addEventListener('visibilitychange', () => { if (!document.hidden) checkForNewBuild(); });" in html


def test_updated_worker_reloads_the_page_exactly_once():
    html = HTML.read_text(encoding="utf-8")
    assert "navigator.serviceWorker.addEventListener('controllerchange', () => {" in html
    # A first-ever install must never reload; only a replaced controller does.
    assert "const hadControllerAtLoad = !!navigator.serviceWorker.controller;" in html
    assert "if (!hadControllerAtLoad || swReloadedForUpdate) return;" in html
    assert "swReloadedForUpdate = true;" in html
    # The service worker still activates immediately for the takeover to work.
    sw = SW.read_text(encoding="utf-8")
    assert "self.skipWaiting()" in sw
    assert "self.clients.claim()" in sw


def test_settings_shows_the_running_build_tag():
    html = HTML.read_text(encoding="utf-8")
    assert 'id="settingsBuildLine"' in html
    assert "buildLine.textContent = 'Build ' + BURBZ_BUILD;" in html


def test_build_tag_matches_the_newest_cache_marker():
    html = HTML.read_text(encoding="utf-8")
    build = re.search(r"const BURBZ_BUILD = '([^']+)';", html)
    assert build, "BURBZ_BUILD constant missing"
    cache = re.search(r"const BURBZ_CACHE = 'burbz-([^']+)';", SW.read_text(encoding="utf-8"))
    assert cache, "BURBZ_CACHE constant missing"
    # The build tag shown in Settings is the newest marker on the cache name,
    # so bumping one without the other fails the build.
    assert cache.group(1).endswith(build.group(1)), (cache.group(1), build.group(1))
