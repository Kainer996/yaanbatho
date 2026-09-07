/* Full-game Merlin flight evidence in a fresh, disposable browser context.
 * No persistent browser profile, user save, cloud token or remote asset is used.
 * Run: NODE_PATH=… CHROME_PATH=/usr/bin/chromium EVIDENCE_DIR=… node this-file
 * The optional BASE_URL must be a loopback server. Otherwise this file serves
 * the checkout itself on an ephemeral loopback port.
 */
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const gameRoot = path.resolve(__dirname, '..');
const evidence = path.resolve(process.env.EVIDENCE_DIR || path.join(os.tmpdir(), 'burbz-merlin-flight-v1-evidence'));
fs.mkdirSync(evidence, { recursive: true });
const checks = [];
let server, browser, activePage, activeTheme = 'setup';
const source = fs.readFileSync(path.join(gameRoot, 'index.html'), 'utf8');
assert(source.includes('\ninit();'), 'Main game IIFE init hook must exist');
const instrumented = source.replace('\ninit();', '\nwindow.__testEval = code => eval(code);\nmarkMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(chapter => chapter.id));\ninit();');

function check(name, ok, detail) {
  checks.push({ theme: activeTheme, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) });
  console.log(`${ok ? 'PASS' : 'FAIL'} [${activeTheme}] ${name}`);
  assert(ok, `${name}${detail === undefined ? '' : ': ' + JSON.stringify(detail)}`);
}
function same(name, actual, expected) { check(name, JSON.stringify(actual) === JSON.stringify(expected), { actual, expected }); }

async function serve() {
  if (process.env.BASE_URL) {
    const url = new URL(process.env.BASE_URL);
    assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Evidence may only run on a loopback origin');
    return new URL('/burbz/', url).href;
  }
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.mp3': 'audio/mpeg' };
  server = http.createServer((req, res) => {
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname); }
    catch (_) { res.writeHead(400); return res.end(); }
    if (!pathname.startsWith('/burbz/')) { res.writeHead(404); return res.end(); }
    const file = path.resolve(gameRoot, pathname.slice('/burbz/'.length) || 'index.html');
    if (!file.startsWith(gameRoot + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (error, data) => {
      if (error) { res.writeHead(404); return res.end(); }
      res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(req.method === 'HEAD' ? undefined : data);
    });
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  return `http://127.0.0.1:${server.address().port}/burbz/`;
}

const run = (page, fn, arg = null) => page.evaluate(([code, value]) => window.__testEval('(' + code + ')(' + JSON.stringify(value) + ')'), [fn.toString(), arg]);
const debug = page => page.evaluate(() => {
  const value = window.__burbzMerlinFlightDebug;
  return typeof value === 'function' ? value() : value;
});
const snapshot = page => run(page, () => ({
  care: { energy: gameState.merlinCare.energy, happiness: gameState.merlinCare.happiness,
    hunger: gameState.merlinCare.hunger, bond: (gameState.merlinCare.bondLevel - 1) * 100 + gameState.merlinCare.bondXp,
    lastPlayedAt: gameState.merlinCare.lastPlayedAt, restStartedAt: gameState.merlinCare.restStartedAt,
    restEndsAt: gameState.merlinCare.restEndsAt, lastRestedAt: gameState.merlinCare.lastRestedAt,
    transactions: gameState.merlinCare.hungerTransactions },
  player: JSON.parse(JSON.stringify(gameState.player)),
  inventory: JSON.parse(JSON.stringify(gameState.inventory)), pantry: JSON.parse(JSON.stringify(gameState.pantry))
}));

async function stopped(page, label) {
  await page.waitForFunction(() => {
    const value = window.__burbzMerlinFlightDebug;
    const d = typeof value === 'function' ? value() : value;
    return d && !d.active && !d.loading && d.rafCount === 0 && !document.querySelector('.merlin-flight-layer');
  }, null, { timeout: 6000 });
  const d = await debug(page);
  check(label, !d.active && d.rafCount === 0 && await page.locator('.merlin-flight-canvas').count() === 0, d);
}

async function fixture(page) {
  // Only this context's newly created state is edited. These are independent
  // scenario fixtures, not extra care transactions or fabricated player proof.
  await run(page, () => {
    if (merlinTutActive) endMerlinTutorial(false);
    markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(chapter => chapter.id));
    if (typeof closeIntroCutscene === 'function') closeIntroCutscene();
    // Keep unrelated minute economy ticks and ambient saved chatter outside
    // these exact transaction comparisons. Rest's real 250ms refresh stays on.
    clearInterval(petCareTimer); clearTimeout(petChatterTimer);
    gameState.settings.sfx = false; gameState.settings.music = false; gameState.settings.vibration = false;
    gameState.birdExpeditions = [];
    const now = Date.now();
    gameState.merlinCare = MERLIN_CORE.sanitizeMerlinCare({ ...gameState.merlinCare,
      energy: 70, happiness: 45, hunger: 35, bondLevel: 2, bondXp: 20,
      lastCareAt: now, lastHungerAt: now, lastPlayedAt: null, restStartedAt: null, restEndsAt: null
    }, now);
    switchScreen('scan');
    closeMerlinCareMenu({ force: true });
    ensureLarder(); // Finish the existing starter-food migration before comparisons.
    renderPetCompanion();
    saveState();
  });
}

async function openCare(page) {
  if (!await page.locator('#merlinCareMenu').isVisible()) {
    const flightCare = page.locator('.merlin-flight-care');
    if (await flightCare.isVisible()) await flightCare.tap();
    else {
      // The canonical perch intentionally never becomes geometrically still.
      // A real touchscreen tap at its measured centre avoids Playwright's
      // animation-stability wait without bypassing browser hit testing.
      const rect = await page.locator('#petSprite').boundingBox();
      assert(rect, 'Canonical perched Merlin is visible');
      await page.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
    }
  }
  await page.locator('#merlinCareMenu').waitFor({ state: 'visible' });
}

async function play(page) {
  await openCare(page);
  const before = await snapshot(page);
  await page.locator('#merlinPlayBtn').tap();
  await page.waitForFunction(() => {
    const value = window.__burbzMerlinFlightDebug;
    const d = typeof value === 'function' ? value() : value;
    return d && d.active && !d.loading && d.state && document.querySelector('.merlin-flight-sky');
  }, null, { timeout: 15000 });
  const after = await snapshot(page);
  check('actual Play spends energy and grants bond once', after.care.energy === before.care.energy - 12 && after.care.bond === before.care.bond + 8 && after.care.happiness === Math.min(100, before.care.happiness + 22), { before: before.care, after: after.care });
  same('Play leaves inventory and coins intact', [after.player, after.inventory, after.pantry], [before.player, before.inventory, before.pantry]);
  check('one flight layer and one frame loop', await page.locator('.merlin-flight-layer').count() === 1 && (await debug(page)).rafCount === 1);
  return after;
}

async function tapSky(page, xFraction = .5, yFraction = .42) {
  const rect = await page.locator('.merlin-flight-sky').boundingBox();
  assert(rect, 'Play sky has a visible tap target');
  await page.touchscreen.tap(rect.x + rect.width * xFraction, rect.y + Math.min(rect.height - 65, rect.height * yFraction));
}

async function selectTheme(page, theme) {
  await page.locator('#settingsBtn').tap();
  await page.locator('#settingsModal.show').waitFor();
  await page.locator('#settingsAppearanceTab').tap();
  const input = page.locator(`input[name="appearanceTheme"][value="${theme}"]`);
  check('real Appearance controls are present', await input.count() === 1);
  await input.check();
  check('real Appearance choice changes the selected theme', await page.locator('html').getAttribute('data-appearance') === theme);
  check('Appearance choice uses the game save', await run(page, value => JSON.parse(localStorage.getItem('burbz_state')).settings.appearance === value, theme));
  await page.locator('#settingsCloseBtn').tap();
}

async function exerciseTheme(base, theme) {
  activeTheme = theme;
  const origin = new URL(base).origin;
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    isMobile: true, hasTouch: true, serviceWorkers: 'block', reducedMotion: 'no-preference' });
  const errors = [], blockedRemote = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (!url.startsWith(origin + '/')) { blockedRemote.push(url); return route.abort(); }
    if (new URL(url).pathname === '/burbz/') return route.fulfill({ contentType: 'text/html', body: instrumented });
    return route.continue();
  });
  await context.addInitScript(() => {
    // The first-run epoch would otherwise clear this context's intro flag.
    localStorage.setItem('burbz_epoch', 'new-dawn-evil-burbz-20260720');
    localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
  });
  const page = await context.newPage(); activePage = page;
  page.setDefaultTimeout(20000);
  page.on('pageerror', error => errors.push(error.stack || String(error)));
  try {
    await page.goto(base, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__testEval);
    await fixture(page);
    await selectTheme(page, theme);
    const played = await play(page);
    await openCare(page);
    check('Play cooldown remains visible and disabled', await page.locator('#merlinPlayBtn').isDisabled());
    // Directly exercise the same care handler for a stale or scripted duplicate
    // click; disabled native controls cannot dispatch an ordinary user click.
    const repeated = await run(page, () => careForMerlin('play'));
    check('duplicate Play is rejected', repeated === false);
    same('duplicate Play grants no second bond or energy change', (await snapshot(page)).care, played.care);
    await page.locator('#merlinCareClose').tap();
    // Closing care may deliberately finish the session. Start an independent
    // visual session if that is the product's chosen close behavior.
    if (!(await debug(page)).active) { await fixture(page); await play(page); }
    const beforePebbles = await snapshot(page);
    for (let i = 0; i < 6; i++) await tapSky(page, .24 + (i % 3) * .2, .35 + (i % 2) * .12);
    await page.waitForFunction(() => {
      const raw = window.__burbzMerlinFlightDebug; const d = typeof raw === 'function' ? raw() : raw;
      return d && d.state && d.state.pickups >= 1;
    }, null, { timeout: 7000 });
    same('repeated pebble taps and pickup grant no care, inventory or currency rewards', await snapshot(page), beforePebbles);
    const poses = [], positions = [];
    for (let i = 0; i < 10; i++) {
      const d = await debug(page); poses.push(`${d.state.row}:${d.state.frame}`); positions.push(d.state.position);
      await page.waitForTimeout(90);
    }
    const d = await debug(page);
    check('flight uses changing atlas frames and moves through a route', new Set(poses).size > 3 && Math.hypot(positions[0].x - positions[9].x, positions[0].y - positions[9].y) > 5, { poses, diagnostics: d });
    check('phone flight remains on screen', d.state.position.x >= 0 && d.state.position.x <= 390 && d.state.position.y >= 0 && d.state.position.y <= 844);
    check('flight canvas never captures controls', await page.locator('.merlin-flight-canvas').evaluate(el => getComputedStyle(el).pointerEvents === 'none'));
    // Move only this fixture's cooldown clock beyond the ten-second boundary:
    // an already-running 25-second session must still never pay Play twice.
    await run(page, () => { gameState.merlinCare.lastPlayedAt = Date.now() - MERLIN_CORE.MERLIN_PLAY_COOLDOWN_MS - 1; renderMerlinCareMenu(); });
    const afterCooldown = await snapshot(page);
    check('active session rejects another Play even after cooldown', await run(page, () => careForMerlin('play')) === false);
    same('active session after cooldown cannot grant a second transaction', await snapshot(page), afterCooldown);
    await page.screenshot({ path: path.join(evidence, `${theme}-phone-fetch.png`) });
    await page.locator('#settingsBtn').tap();
    check('Settings remains usable during flight', await page.locator('#settingsModal.show').isVisible());
    await page.locator('#settingsCloseBtn').tap();

    // An actual Rest press cancels flight and retains the saved nap deadline.
    if (!(await debug(page)).active) { await fixture(page); await play(page); }
    await openCare(page);
    const beforeRest = await snapshot(page);
    await page.locator('#merlinRestBtn').tap();
    await stopped(page, 'Rest cancels the complete flight session');
    const resting = await snapshot(page);
    check('Rest starts a ten-second saved nap without an immediate reward', resting.care.restEndsAt - resting.care.restStartedAt === 10000 && resting.care.energy === beforeRest.care.energy && resting.care.bond === beforeRest.care.bond);
    check('all care buttons are disabled while resting', await page.locator('#merlinPlayBtn').isDisabled() && await page.locator('#merlinRestBtn').isDisabled() && await page.locator('#merlinFeedBtn').isDisabled());
    for (const action of ['rest', 'play', 'feed']) check(`${action} cannot interrupt or reward an active nap`, await run(page, action => careForMerlin(action), action) === false);
    same('repeated sleeping care preserves the same nap', (await snapshot(page)).care, resting.care);
    await page.screenshot({ path: path.join(evidence, `${theme}-phone-rest.png`) });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__testEval);
    const reloaded = await snapshot(page);
    check('reload preserves nap deadline or its one completion', reloaded.care.restEndsAt === resting.care.restEndsAt || reloaded.care.lastRestedAt === resting.care.restEndsAt);
    await page.waitForFunction(() => window.__testEval('!gameState.merlinCare.restEndsAt'), null, { timeout: 12500 });
    const rested = await snapshot(page);
    check('nap completes exactly once after reload', rested.care.energy === 100 && rested.care.bond === beforeRest.care.bond + 3 && rested.care.lastRestedAt === resting.care.restEndsAt, rested.care);
    await run(page, () => { renderPetCompanion(); renderPetCompanion(); getMerlinCare(); });
    same('later renders cannot award the nap twice', (await snapshot(page)).care, rested.care);
    await openCare(page);
    check('Rested control remains disabled', await page.locator('#merlinRestBtn').isDisabled());
    check('selected appearance survives the nap reload', await page.locator('html').getAttribute('data-appearance') === theme);

    await fixture(page);
    const takeoffCentre = await page.locator('#petSprite').evaluate(el => {
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    await play(page);
    await page.waitForFunction(home => {
      const raw = window.__burbzMerlinFlightDebug, d = typeof raw === 'function' ? raw() : raw;
      return d?.active && d.state && Math.hypot(d.state.position.x - home.x, d.state.position.y - home.y) > 25;
    }, takeoffCentre, { timeout: 6000 });
    const beforeFinish = await snapshot(page);
    await page.getByRole('button', { name: 'Finish', exact: true }).tap();
    await stopped(page, 'manual Finish lands and removes the normal-motion session');
    const landing = await debug(page);
    const perchedCentre = await page.locator('#petSprite').evaluate(el => {
      const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
    });
    const landingError = Math.hypot(landing.state.position.x - perchedCentre.x, landing.state.position.y - perchedCentre.y);
    const homeError = Math.hypot(landing.state.position.x - takeoffCentre.x, landing.state.position.y - takeoffCentre.y);
    // The branch and perched sprite resume their small idle sway after landing.
    // Eight CSS pixels permits that live sway, but catches the old fixed-host
    // remeasurement which shifted the destination a full header height upward.
    check('manual Finish reaches the measured visible perch centre', landing.state.done && landingError <= 8 && homeError <= 8 && await page.locator('#petSprite .merlin-rig').isVisible(),
      { landing: landing.state.position, takeoffCentre, perchedCentre, landingError, homeError });
    same('manual Finish grants no extra care or rewards', await snapshot(page), beforeFinish);

    await fixture(page); await play(page);
    const beforeThemeChange = await snapshot(page), themeGeneration = (await debug(page)).generation;
    await page.locator('#settingsBtn').tap();
    await page.locator('#settingsAppearanceTab').tap();
    const otherTheme = theme === 'normal' ? 'comic' : 'normal';
    await page.locator(`input[name="appearanceTheme"][value="${otherTheme}"]`).check();
    check('Appearance changes during active flight', await page.locator('html').getAttribute('data-appearance') === otherTheme);
    await page.locator(`input[name="appearanceTheme"][value="${theme}"]`).check();
    const afterThemeChange = await debug(page);
    check('theme changes preserve one session and one loop', afterThemeChange.active && afterThemeChange.generation === themeGeneration && afterThemeChange.rafCount === 1 && await page.locator('.merlin-flight-layer').count() === 1);
    same('theme changes during Play grant no rewards', await snapshot(page), beforeThemeChange);
    await page.locator('#settingsCloseBtn').tap();
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    await stopped(page, 'simulated background visibility cancels flight');
    await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')); });
    check('foregrounding does not start another session', !(await debug(page)).active);

    await fixture(page); await play(page);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true })));
    await stopped(page, 'pagehide cancels flight and input');

    await fixture(page); await play(page);
    await page.setViewportSize({ width: 844, height: 390 });
    await stopped(page, 'orientation-sized viewport change removes stale coordinates');
    await fixture(page); await play(page);
    await page.screenshot({ path: path.join(evidence, `${theme}-landscape-flight.png`) });
    check('landscape play surface and document fit the viewport', await page.locator('.merlin-flight-sky').evaluate(el => {
      const rect = el.getBoundingClientRect(); return rect.left >= 0 && rect.right <= innerWidth && rect.top >= 0 && rect.bottom <= innerHeight && document.documentElement.scrollWidth <= innerWidth;
    }));
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await stopped(page, 'changing reduced-motion preference cleans up active flight');
    await page.setViewportSize({ width: 390, height: 844 });
    await fixture(page); await play(page);
    const reducedBefore = await debug(page);
    await tapSky(page);
    await page.waitForTimeout(1100);
    const reducedAfter = await debug(page);
    check('reduced motion uses a stationary pose while retaining harmless fetch feedback', reducedAfter.state.reducedMotion && reducedAfter.state.pickups >= 1 && reducedAfter.state.position.x === reducedBefore.state.position.x && reducedAfter.state.position.y === reducedBefore.state.position.y);
    await page.screenshot({ path: path.join(evidence, `${theme}-reduced-motion.png`) });
    await page.getByRole('button', { name: 'Finish', exact: true }).tap();
    await stopped(page, 'Finish cleans up the reduced-motion session');

    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await fixture(page); await play(page);
    await run(page, () => {
      gameState.birdExpeditions = [{ id: 'disposable-merlin-flight-test', birdId: MERLIN_GUIDE.id,
        startMs: Date.now() - 2000, endMs: Date.now() - 1000, status: 'complete', rewards: {} }];
      syncMerlinPerchPresence();
    });
    await stopped(page, 'an unclaimed completed expedition still cancels and hides Merlin');
    check('away perch stays empty', await page.locator('#merlinPerchAssembly').evaluate(el => el.classList.contains('merlin-away')) && !await page.locator('#petSprite').isVisible());
    check('away Merlin rejects Play', await run(page, () => careForMerlin('play')) === false);
    await run(page, () => { gameState.birdExpeditions[0].status = 'claimed'; renderPetCompanion(); });
    check('claiming the fixture returns the canonical perched rig', await page.locator('#petSprite .merlin-rig').isVisible());

    await fixture(page); await play(page);
    await run(page, () => switchScreen('birdex'));
    await stopped(page, 'screen navigation cancels the play surface');
    check('no full-game JavaScript errors', errors.length === 0, errors);
    checks.push({ theme, name: 'network isolation', ok: true, detail: { remoteRequestsBlocked: blockedRemote.length } });
    for (const suffix of ['failed.png', 'errors.json']) fs.rmSync(path.join(evidence, `${theme}-${suffix}`), { force: true });
  } catch (error) {
    await page.screenshot({ path: path.join(evidence, `${theme}-failed.png`) }).catch(() => {});
    const surfaces = await page.evaluate(() => ['settingsModal', 'merlinTutorialOverlay', 'introCutsceneOverlay', 'petSprite'].map(id => {
      const el = document.getElementById(id), s = el && getComputedStyle(el), r = el && el.getBoundingClientRect();
      return { id, className: el?.className, display: s?.display, visibility: s?.visibility, opacity: s?.opacity, rect: r && { x:r.x, y:r.y, width:r.width, height:r.height }, text:el?.innerText?.slice(0, 400) };
    })).catch(() => []);
    fs.writeFileSync(path.join(evidence, `${theme}-errors.json`), JSON.stringify({ errors, surfaces, failure: error.stack || String(error) }, null, 2));
    throw error;
  } finally { await context.close(); activePage = null; }
}

(async () => {
  try {
    const base = await serve();
    browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/chromium', headless: true,
      args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
    for (const theme of ['normal', 'comic']) await exerciseTheme(base, theme);
    console.log(`${checks.filter(row => row.ok).length} checks passed. Evidence: ${evidence}`);
  } catch (error) {
    if (activePage && !activePage.isClosed()) await activePage.screenshot({ path: path.join(evidence, `${activeTheme}-failed.png`) }).catch(() => {});
    console.error(error.stack || error); process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    if (server && server.listening) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
    fs.writeFileSync(path.join(evidence, 'results.json'), JSON.stringify({ checks, passed: checks.filter(row => row.ok).length, failed: checks.filter(row => !row.ok).length, success: !process.exitCode }, null, 2) + '\n');
  }
})();
