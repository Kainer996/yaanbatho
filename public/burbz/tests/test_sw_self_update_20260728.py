"""Service-worker self-update: stale clients pick up new builds on their own.

A mobile tab or installed PWA can sit in the background for hours without a
real navigation, so it keeps showing whatever build it loaded last — players
were still seeing the pre-v6 tutorial long after the v6 deploy went live. The
page now re-checks for a new service worker whenever the app is opened or
foregrounded, reloads exactly once when an updated worker takes over, and
Settings shows a build tag so anyone can tell which build is running.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTML = ROOT / "index.html"
SW = ROOT / "sw.js"


def test_registration_checks_for_updates_on_open_and_foreground():
    html = HTML.read_text(encoding="utf-8")
    assert "navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'imports' }).then(reg => {" in html
    assert "swRegistration.update().catch(err => console.warn('Burbz update check failed:', err))" in html
    assert "document.addEventListener('visibilitychange', () => { if (!document.hidden) registerOrCheckForNewBuild(); });" in html


def test_registration_does_not_wait_for_every_page_asset_and_retries_transient_failures():
    html = HTML.read_text(encoding="utf-8")
    registration = html.split("// Register Play/PWA service worker", 1)[1].split("// Run", 1)[0]
    assert "window.addEventListener('load'" not in registration
    assert "window.addEventListener('pageshow', registerOrCheckForNewBuild);" in registration
    assert "window.addEventListener('focus', registerOrCheckForNewBuild);" in registration
    assert "window.addEventListener('online', registerOrCheckForNewBuild);" in registration
    assert "window.setTimeout(registerOrCheckForNewBuild, 15000);" in registration
    sw = SW.read_text(encoding="utf-8")
    assert "new Promise(resolve => setTimeout(() => resolve(false), 10000))" in sw


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


def test_optional_cache_quota_failure_or_hang_cannot_strand_mobile_on_old_worker():
    script = r"""
const fs = require('fs'), vm = require('vm');
const listeners = {};
const expansion = { art: {} };
let skippedWaiting = false;
let quotaFailureAttempted = false;
const self = {
  BURBZ_UK_BIRD_EXPANSION_50: expansion,
  BURBZ_UK_BIRD_EXPANSION_26: expansion,
  BURBZ_AU_BIRD_EXPANSION: expansion,
  BURBZ_UK_BIRD_EXPANSION_FINAL: expansion,
  BURBZ_AU_BIRD_EXPANSION_50: expansion,
  BURBZ_NATIONAL_BIRD_COMPLETION_20260715: expansion,
  BURBZ_UK_BIRD_EXPANSION_4: expansion,
  addEventListener: (name, fn) => { listeners[name] = fn; },
  clients: { claim: async () => {} },
  skipWaiting: async () => { skippedWaiting = true; },
  location: { origin: 'https://yaanbatho.com' }
};
const caches = {
  open: async () => ({
    put: async asset => {
      if (asset === failedAsset) {
        quotaFailureAttempted = true;
        throw new Error('simulated mobile cache quota failure');
      }
    }
  }),
  keys: async () => ['burbz-previous-build'],
  match: async () => null
};
const failedAsset = './assets/audio/bgm-burbz-quest-v2.mp3';
const hungAsset = './assets/audio/bgm-birbs-quest.mp3';
const sandbox = {
  self, caches, importScripts: () => {}, URL, Response,
  console: { warn: () => {}, log: console.log },
  fetch: async asset => asset === hungAsset ? new Promise(() => {}) : new Response('ok')
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), sandbox, { filename: 'sw.js' });
let work;
listeners.install({ waitUntil: promise => { work = promise; } });
Promise.resolve(work)
  .then(() => console.log(JSON.stringify({ skippedWaiting, quotaFailureAttempted })))
  .catch(err => { console.error(err); process.exit(1); });
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8",
        capture_output=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "skippedWaiting": True,
        "quotaFailureAttempted": True,
    }


def test_current_document_and_changed_runtimes_remain_installation_requirements():
    sw = SW.read_text(encoding="utf-8")
    required = sw.split("const BURBZ_INSTALL_REQUIRED = [", 1)[1].split("];", 1)[0]
    assert "'./index.html'" in required
    assert "'./empire_realm_core.js?v=merge-when-ready-v290-20260820'" in required
    assert "'./settlement_merge_core.js?v=merge-when-ready-v290-20260820'" in required
    assert "'./town_strategy_core.js?v=town-strategy-v273-20260816'" in required
    validation = sw.split("function cacheHasCompleteFallback", 1)[1].split("self.addEventListener('install'", 1)[0]
    assert "Promise.all(BURBZ_CORE.map(asset" in validation


def test_upgrade_activation_refreshes_frozen_phone_and_keeps_a_proven_complete_fallback():
    script = r"""
const fs = require('fs'), vm = require('vm');
const listeners = {};
const expansion = { art: {} };
let claimed = false, navigated = 0;
const self = {
  BURBZ_UK_BIRD_EXPANSION_50: expansion,
  BURBZ_UK_BIRD_EXPANSION_26: expansion,
  BURBZ_AU_BIRD_EXPANSION: expansion,
  BURBZ_UK_BIRD_EXPANSION_FINAL: expansion,
  BURBZ_AU_BIRD_EXPANSION_50: expansion,
  BURBZ_NATIONAL_BIRD_COMPLETION_20260715: expansion,
  BURBZ_UK_BIRD_EXPANSION_4: expansion,
  addEventListener: (name, fn) => { listeners[name] = fn; },
  clients: {
    claim: async () => { claimed = true; },
    matchAll: async () => [
      {
        url: 'https://yaanbatho.com/burbz/',
        visibilityState: 'hidden',
        navigate: async () => { navigated += 1; }
      },
      {
        url: 'https://yaanbatho.com/quarry-pro/',
        visibilityState: 'hidden',
        navigate: async () => { navigated += 100; }
      }
    ]
  },
  registration: { scope: 'https://yaanbatho.com/burbz/' },
  skipWaiting: async () => {},
  location: { origin: 'https://yaanbatho.com' }
};
const deleted = [];
const caches = {
  open: async key => ({
    put: async () => {},
    match: async () => key === 'burbz-older-complete' ? new Response('cached') : null
  }),
  keys: async () => ['burbz-ancient', 'burbz-older-complete', 'burbz-previous-build'],
  delete: async key => { deleted.push(key); return true; },
  match: async () => null
};
const sandbox = {
  self, caches, importScripts: () => {}, URL, Response,
  console: { warn: () => {}, log: console.log },
  fetch: async () => new Response('ok')
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), sandbox, { filename: 'sw.js' });
let work;
listeners.activate({ waitUntil: promise => { work = promise; } });
Promise.resolve(work)
  .then(() => console.log(JSON.stringify({ claimed, navigated, deleted })))
  .catch(err => { console.error(err); process.exit(1); });
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8",
        capture_output=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {
        "claimed": True,
        "navigated": 1,
        "deleted": ["burbz-ancient", "burbz-previous-build"],
    }
    sw = SW.read_text(encoding="utf-8")
    navigation = sw.split("self.clients.matchAll", 1)[1].split("});", 1)[0]
    assert "Promise.all(clients.map" not in navigation
    assert "client.navigate(client.url).catch" in navigation


def test_offline_fetch_prefers_current_build_before_retained_fallback_cache():
    script = r"""
const fs = require('fs'), vm = require('vm');
const listeners = {};
const expansion = { art: {} };
const self = {
  BURBZ_UK_BIRD_EXPANSION_50: expansion,
  BURBZ_UK_BIRD_EXPANSION_26: expansion,
  BURBZ_AU_BIRD_EXPANSION: expansion,
  BURBZ_UK_BIRD_EXPANSION_FINAL: expansion,
  BURBZ_AU_BIRD_EXPANSION_50: expansion,
  BURBZ_NATIONAL_BIRD_COMPLETION_20260715: expansion,
  BURBZ_UK_BIRD_EXPANSION_4: expansion,
  addEventListener: (name, fn) => { listeners[name] = fn; },
  clients: { claim: async () => {} },
  skipWaiting: async () => {},
  location: { origin: 'https://yaanbatho.com' }
};
const caches = {
  open: async key => ({
    put: async () => {},
    match: async () => new Response(key === 'burbz-old' ? 'old-index' : 'current-index')
  }),
  keys: async () => ['burbz-old'],
  delete: async () => true
};
const sandbox = {
  self, caches, importScripts: () => {}, URL, Response,
  console: { warn: () => {}, log: console.log },
  fetch: async () => { throw new Error('offline'); },
  setTimeout
};
vm.runInNewContext(fs.readFileSync('sw.js', 'utf8'), sandbox, { filename: 'sw.js' });
let work;
listeners.fetch({
  request: { method: 'GET', url: 'https://yaanbatho.com/burbz/index.html', mode: 'navigate' },
  respondWith: promise => { work = promise; }
});
Promise.resolve(work)
  .then(response => response.text())
  .then(text => console.log(JSON.stringify({ text })))
  .catch(err => { console.error(err); process.exit(1); });
"""
    result = subprocess.run(
        ["node", "-e", script], cwd=ROOT, text=True, encoding="utf-8",
        capture_output=True, timeout=30,
    )
    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == {"text": "current-index"}
