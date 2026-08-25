#!/usr/bin/env node
// Browser evidence for art-same-origin-v325-20260825: the real game, booted in
// Chromium, must not ask GitHub for anything — and must still paint real bird
// art rather than falling back to emoji glyphs.
//
// Every request the page makes is logged. The two claims proved here are:
//
//   1. ZERO requests to github.com or raw.githubusercontent.com, across the
//      boot, the service-worker install, the Birdex and the Academy. That is
//      the leak: the old build routed most art through GitHub's LFS raw
//      endpoint, so every player spent a 1 GB/month allowance on every play,
//      and once it was exhausted GitHub blocked LFS downloads for everyone —
//      which is what broke the Pages deploy.
//   2. Bird art actually RENDERS: <img> elements whose src is same-origin
//      /burbz/bird-art-cache/… and which have real pixel dimensions. A page
//      that quietly degraded every bird to an emoji fallback would also make
//      zero GitHub requests, so claim 1 alone would be worthless.
//
// Run it (playwright-core + a Chromium build are the only requirements). Serve
// from public/, NOT public/burbz: every art path in the game is an absolute
// /burbz/… URL, so a server rooted one level in 404s all of it. And reach it on
// localhost, not 127.0.0.1 — index.html only registers the service worker when
// the hostname is literally 'localhost' (or the scheme is https), and the
// service worker's precache list is half of what this harness is here to prove.
//   cd public && python3 -m http.server 8765 &
//   BURBZ_URL=http://localhost:8765/burbz/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_art_same_origin_evidence.js
// Exits non-zero if any check fails.

function requirePlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE_PATH, 'playwright-core', 'playwright'].filter(Boolean);
  for (const id of candidates) {
    try { return require(id); } catch (e) {}
  }
  console.error('playwright-core not found; set PLAYWRIGHT_CORE_PATH');
  process.exit(2);
}
const { chromium } = requirePlaywright();

const URL_ = process.env.BURBZ_URL || 'http://localhost:8765/burbz/index.html';
// The game asks its own backend for this on boot. A static file server has no
// backend, so the 404 is a property of the harness, not of the build. It is the
// only console error tolerated, and it is named rather than pattern-swallowed.
const ENV_ONLY_404 = '/api/auth/config';
const EXE = process.env.CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

const BANNED_HOSTS = ['github.com', 'raw.githubusercontent.com', 'media.githubusercontent.com',
                      'objects.githubusercontent.com'];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await context.newPage();

  const errors = [];
  const requests = [];
  const banned = [];
  // Log from the CONTEXT, not the page: a service worker's own precache fetches
  // do not surface as page requests, and the ~292-URL precache list was half
  // the leak. Requests are recorded but never blocked — blocking would hide a
  // regression behind a green run.
  context.on('request', req => {
    let host = '';
    try { host = new URL(req.url()).hostname; } catch (e) { host = ''; }
    requests.push({ url: req.url(), host });
    if (BANNED_HOSTS.includes(host)) banned.push(req.url());
  });
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  // Console 404 text does not carry the URL, so failures are tracked by
  // response instead — that way a real missing asset is named, not guessed at.
  const notFound = [];
  context.on('response', res => {
    if (res.status() === 404 && !res.url().includes(ENV_ONLY_404)) notFound.push(res.url());
  });
  page.on('console', m => {
    if (m.type() !== 'error') return;
    const text = m.text();
    if (text.includes('404') || text.includes('Failed to load resource')) return; // counted above
    // Same backend endpoint again, seen from the other side: on the very first
    // install the service worker's fetch handler answers the missing /api/ call
    // with Response.error(), which surfaces as a bare "TypeError: Failed to
    // fetch". It has nothing to do with art, and only appears on a cold profile.
    if (text.includes('Failed to fetch')) return;
    errors.push('console: ' + text);
  });

  // ---- boot the real game ------------------------------------------------
  await page.goto(URL_, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__burbzSizeRolesDebug, { timeout: 90000 });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  // ---- plant a flock so real paintings are actually asked for ------------
  // Species chosen across the three art routes the old build sent to GitHub:
  // a built-in painting, a manga-warrior painting, and a map cutout.
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    const species = ['Blackbird', 'European Robin', 'Barn Owl', 'Kingfisher', 'Goldfinch'];
    state.flock = species.map((name, i) => ({
      id: 'art-evidence-' + i, species: name, commonName: name,
      customName: 'Art ' + i, rarity: 'common',
      hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 90, cha: 90, stamina: 60,
      sizeScore: 18, level: 5
    }));
    state.player = state.player || {};
    state.player.level = 12;
    localStorage.setItem('burbz_state', JSON.stringify(state));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__burbzSizeRolesDebug, { timeout: 90000 });
  await page.waitForTimeout(2500);

  // ---- walk the screens that paint birds ---------------------------------
  for (const screen of ['birdex', 'academy', 'quests']) {
    try {
      await page.evaluate(name => { if (window.switchScreen) window.switchScreen(name); }, screen);
      await page.waitForTimeout(1500);
    } catch (e) { /* a screen that will not open is caught by the render check */ }
  }

  // Give the service worker time to install and run its precache.
  await page.waitForTimeout(4000);
  const swState = await page.evaluate(async () => {
    if (!navigator.serviceWorker) return 'unsupported';
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return 'none';
    return (reg.active && 'active') || (reg.installing && 'installing') || (reg.waiting && 'waiting') || 'unknown';
  });

  // ---- the evidence ------------------------------------------------------
  const artImgs = await page.evaluate(() => Array.from(document.images)
    .filter(img => (img.currentSrc || img.src || '').includes('/bird-art-cache/'))
    .map(img => ({
      src: img.currentSrc || img.src,
      w: img.naturalWidth, h: img.naturalHeight,
      complete: img.complete
    })));
  const rendered = artImgs.filter(i => i.complete && i.w > 0 && i.h > 0);
  const ORIGIN = new URL(URL_).origin;
  const remoteSrc = artImgs.filter(i => /^https?:\/\//.test(i.src) && !i.src.startsWith(ORIGIN));

  console.log('\nart-same-origin-v325-20260825 — browser evidence');
  console.log(`  requests logged: ${requests.length}, service worker: ${swState}`);
  console.log(`  bird-art <img> found: ${artImgs.length}, rendered with real pixels: ${rendered.length}`);

  check('zero requests to any GitHub host', banned.length === 0,
        banned.length ? banned.slice(0, 5).join(', ') : '0 of ' + requests.length + ' requests');
  check('the service worker installed', swState === 'active' || swState === 'installing' || swState === 'waiting',
        swState);
  check('bird art is actually painted as <img>, not emoji fallbacks', rendered.length > 0,
        rendered.length + ' images with real pixel dimensions');
  check('every bird-art <img> is same-origin', remoteSrc.length === 0,
        remoteSrc.length ? remoteSrc.slice(0, 3).map(i => i.src).join(', ') : 'all local');
  check('every bird-art request went to this origin',
        requests.filter(r => r.url.includes('/bird-art-cache/'))
                .every(r => r.url.startsWith(ORIGIN)),
        requests.filter(r => r.url.includes('/bird-art-cache/')).length + ' art requests');
  check('nothing 404s', notFound.length === 0,
        notFound.length ? notFound.slice(0, 5).join(', ') : 'none (bar the backend endpoint no static server has)');
  check('no page errors', errors.length === 0, errors.join(' || ') || 'none');

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  process.exit(failed.length ? 1 : 0);
})().catch(err => { console.error(err); process.exit(3); });
