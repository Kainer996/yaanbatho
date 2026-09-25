'use strict';
// Browser evidence for Merlin flight v3 (v475): one perch size on every
// screen, a whole-screen play sky where taps on buttons drop pebbles instead
// of leaving the screen, and home to the perch after four pebbles.
// Run: node tests/run_merlin_flight_v3.cjs  (EVIDENCE_DIR to keep shots)
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright', '/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright']) {
    try { return require(id); } catch (e) {}
  }
  throw Error('Playwright is not installed');
}
const { chromium } = loadPlaywright();
const F = require('./connected_world_fixture_v386.cjs');
const root = path.resolve(__dirname, '..'), out = process.env.EVIDENCE_DIR || '/tmp/burbz-merlin-flight-v3';
const report = { served:{}, missing:[], errors:[], checks:[] };
const fixture = F.createServer({ root, port:8968, report });
fs.mkdirSync(out, { recursive:true });
let browser, page;
const run = code => page.evaluate(code => __testEval(code), code);
const pass = text => { report.checks.push(text); console.log('PASS', text); };
const shot = name => page.screenshot({ path:path.join(out, name + '.png') });
const box = selector => page.locator(selector).boundingBox();
// The bough sways; measure the perch at the same moment of its sway.
const perchBox = async () => { await page.evaluate(() => document.getAnimations().forEach(a => { if (a.effect?.target?.closest?.('#merlinPerchAssembly')) { a.pause(); a.currentTime = 0; } })); return box('#petSprite'); };
const flight = () => page.evaluate(() => window.__burbzMerlinFlightDebug());

(async () => { try {
  await fixture.listen();
  browser = await chromium.launch({ headless:true, args:['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const context = await browser.newContext({ viewport:{ width:360, height:780 }, deviceScaleFactor:2, hasTouch:true, serviceWorkers:'block' });
  await F.routeMap(context, report);
  page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => report.errors.push(e.message));
  await page.goto(fixture.url, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof __testEval === 'function' && __testEval('typeof switchScreen') === 'function');
  await run("merlinTutActive&&typeof merlinTutClose==='function'&&merlinTutClose();gameState.merlinCare=Object.assign(getMerlinCare(),{energy:90,restEndsAt:0,lastPlayedAt:0});saveState()");

  // ---- One perch size on every screen --------------------------------------
  const sizes = {};
  for (const screen of ['scan', 'map', 'inventory']) {
    await run(`switchScreen('${screen}')`); await page.waitForTimeout(500);
    await run('renderPetCompanion()');
    sizes[screen] = await perchBox();
    await shot('01-perch-' + screen);
  }
  for (const screen of ['map', 'inventory']) for (const key of ['x', 'y', 'width', 'height'])
    assert.ok(Math.abs(sizes[screen][key] - sizes.scan[key]) < 1, `${screen} ${key}: ${sizes[screen][key]} vs Home ${sizes.scan[key]}`);
  pass(`Merlin's perch is the same size and spot on Home, Map and Birds (${Math.round(sizes.scan.width)}px)`);

  // ---- Play: the whole screen is his sky -----------------------------------
  await run("switchScreen('scan')"); await page.waitForTimeout(400);
  await run("careForMerlin('play')");
  await page.waitForFunction(() => document.querySelector('.merlin-flight-layer .merlin-flight-canvas'));
  await page.waitForTimeout(300);
  const hits = await page.evaluate(() => [[40, 760], [60, 120], [180, 400], [340, 30]].map(([x, y]) => document.elementFromPoint(x, y)?.className));
  assert.deepEqual(hits, ['merlin-flight-sky', 'merlin-flight-sky', 'merlin-flight-sky', 'merlin-flight-sky'], 'the sky is on top of dock, header and content');
  pass('During play the sky covers the dock, the header and every button');

  // A filmstrip of the takeoff and cruise.
  for (let i = 0; i < 12; i++) { await page.waitForTimeout(120); await shot('02-fly-' + String(i).padStart(2, '0')); }

  // Taps that land on real buttons: Enter Alderwing and the Map dock icon.
  const targets = [await box('#screen-scan button:visible >> nth=0'), await box('#bottomNav [data-screen="map"]')];
  const taps = targets.filter(Boolean).map(b => [b.x + b.width / 2, b.y + b.height / 2]);
  taps.push([90, 520], [270, 640]);
  const screenBefore = await run('document.body.dataset.activeScreen');
  for (let i = 0; i < 4; i++) {
    await page.waitForFunction(n => window.__burbzMerlinFlightDebug().state?.pickups === n && ['cruise', 'takeoff'].includes(window.__burbzMerlinFlightDebug().state?.state), i, { timeout:20000 });
    await page.touchscreen.tap(taps[i][0], taps[i][1]);
    await page.waitForTimeout(60);
    const state = (await flight()).state;
    assert.ok(state.token, 'tap ' + i + ' made a pebble');
    assert.ok(Math.abs(state.token.x - taps[i][0]) < 1 && Math.abs(state.token.restY - taps[i][1]) < 1, 'pebble lies where the finger tapped');
    assert.equal(await run('document.body.dataset.activeScreen'), screenBefore, 'the tap never pressed the button underneath');
    if (i === 0) for (let k = 0; k < 16; k++) { await page.waitForTimeout(90); await shot('03-fetch-' + String(k).padStart(2, '0')); }
  }
  pass('Taps on Enter Alderwing and the Map icon drop pebbles there and never leave Home');

  await page.waitForFunction(() => window.__burbzMerlinFlightDebug().state?.state === 'landing', null, { timeout:30000 });
  await shot('04-flying-home');
  await page.waitForFunction(() => !document.querySelector('.merlin-flight-layer'), null, { timeout:15000 });
  await page.waitForTimeout(300);
  await shot('05-back-on-perch');
  assert.equal(await page.locator('#petSprite').isVisible(), true);
  const after = await perchBox();
  for (const key of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(after[key] - sizes.scan[key]) < 1.5, key);
  assert.equal(await run('document.body.dataset.activeScreen'), 'scan');
  pass('After four pebbles Merlin flies home and sits back on his perch, same size and spot');

  // ---- Map screen: play works there too, same sky --------------------------
  await run("gameState.merlinCare.lastPlayedAt=0;switchScreen('map')"); await page.waitForTimeout(600);
  await run("careForMerlin('play')");
  await page.waitForFunction(() => document.querySelector('.merlin-flight-layer .merlin-flight-canvas'));
  await page.waitForTimeout(900);
  await shot('06-map-play');
  await page.locator('.merlin-flight-finish:not(.merlin-flight-care)').click();
  await page.waitForFunction(() => !document.querySelector('.merlin-flight-layer'), null, { timeout:15000 });
  pass('Finish on the Map flies him home and ends play');

  assert.deepEqual(report.errors, []);
  pass('No page errors');
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
} catch (error) {
  console.error('FAIL', error.stack || error);
  if (page) await shot('failure').catch(() => {});
  process.exitCode = 1;
} finally {
  if (browser) await browser.close();
  fixture.server.close();
} })();
