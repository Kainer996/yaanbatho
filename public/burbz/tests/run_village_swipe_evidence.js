#!/usr/bin/env node
// Browser evidence for village-swipe-v332-20260826: swipe between your
// villages. Boots the REAL game in Chromium with touch, plants three owned
// villages, opens one, then proves with real touch gestures:
//
//   - the pager under the title says where you stand (1 of 3),
//   - a left swipe on the page glides to the next village and the hub
//     settles back at translateX(0),
//   - a right swipe comes back again,
//   - a drag that starts on the 3D stage moves the camera, not the village,
//   - a vertical drag changes nothing,
//   - zero page errors throughout.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_village_swipe_evidence.js
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

const URL = process.env.BURBZ_URL || 'http://127.0.0.1:8765/index.html';
const EXE = process.env.CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

// Keyed by SEED, never by name: the game names a village from its own
// place-name table, so names planted here are replaced on load.
const HOUR = 3600000;
function plantedVillages(now) {
  const village = (seed, lat, lon) => ({
    seed, name: 'Seed ' + seed, lat, lon,
    claimedAt: new Date(now - 40 * HOUR).toISOString(),
    liberatedAt: new Date(now - 40 * HOUR).toISOString(),
    lastTributeAt: now - HOUR,
    economy: { population: 6, buildings: { cabin: 2, well: 2, hut: 2 }, constructions: [], ruins: [] }
  });
  return {
    101: village(101, 51.50, -3.20),
    202: village(202, 51.52, -3.22),
    303: village(303, 51.54, -3.24)
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  // Fresh session containers hold LFS pointers where the art bytes live, so
  // resource 404s are the environment's, not the release's (same rule the
  // art-hash tests follow). Script errors stay fatal.
  // The royal map's tile host is unreachable from an offline container too.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });

  // ---- boot once so the game writes a real save, then plant on top of it ---
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  await page.evaluate(villages => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.empire = state.empire || {};
    state.empire.villages = villages;
    state.empire.townCharters = [];
    state.empire.cityCharters = [];
    state.empire.regionCharters = [];
    state.lastVillage = { seed: 101, name: 'Seed 101', lat: 51.50, lon: -3.20 };
    localStorage.setItem('burbz_state', JSON.stringify(state));
  }, plantedVillages(Date.now()));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });

  // ---- past the intro, onto the village screen ----------------------------
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove());
    window.switchScreen('village');
  });
  await page.waitForSelector('#empireVillageHub:not([hidden])', { timeout: 30000 });
  await page.waitForSelector('#villagePager:not([hidden])', { timeout: 30000 });
  await page.waitForTimeout(800);

  const readState = () => page.evaluate(() => ({
    title: (document.getElementById('villageTitle') || {}).textContent || '',
    pager: (document.getElementById('villagePager') || {}).textContent || '',
    transform: (document.getElementById('empireVillageHub') || { style: {} }).style.transform || ''
  }));

  const first = await readState();
  check('pager stands and counts the villages', /1 of 3 villages/.test(first.pager), JSON.stringify(first.pager.trim()));

  // ---- a real finger, through CDP touch events ----------------------------
  const cdp = await context.newCDPSession(page);
  async function touchDrag(x0, y0, x1, y1) {
    const steps = 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', {
        type: 'touchMove',
        touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }]
      });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  // The hub stands below the royal map — bring it onto the screen the way a
  // player's scroll would, or the touches land on the map above it.
  await page.evaluate(() => document.getElementById('villageTitle').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const titleBox = await (await page.$('#villageTitle')).boundingBox();
  const onPage = { x: titleBox.x + titleBox.width / 2, y: titleBox.y + titleBox.height / 2 };

  // 1. swipe left on the page → the next village
  await touchDrag(onPage.x + 90, onPage.y, onPage.x - 90, onPage.y);
  await page.waitForTimeout(900);
  const second = await readState();
  check('left swipe glides to the next village', second.title !== first.title && /2 of 3 villages/.test(second.pager),
    first.title.trim() + ' → ' + second.title.trim());
  // The glide-in rides requestAnimationFrame behind a fresh 3D build — wait
  // for it to land rather than racing it.
  const settled = await page.waitForFunction(
    () => /^translateX\(0(px)?\)$/.test(document.getElementById('empireVillageHub').style.transform),
    { timeout: 5000 }).then(() => true).catch(() => false);
  check('the hub settles back at rest', settled);

  // 2. swipe right → back again
  await touchDrag(onPage.x - 90, onPage.y, onPage.x + 90, onPage.y);
  await page.waitForTimeout(900);
  const third = await readState();
  check('right swipe comes back', third.title === first.title && /1 of 3 villages/.test(third.pager), third.title.trim());

  // 3. a drag on the 3D stage is the camera's, not the carousel's
  await page.evaluate(() => document.getElementById('villageStage').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const stageBox = await (await page.$('#villageStage')).boundingBox();
  await touchDrag(stageBox.x + stageBox.width / 2 + 90, stageBox.y + stageBox.height / 2,
    stageBox.x + stageBox.width / 2 - 90, stageBox.y + stageBox.height / 2);
  await page.waitForTimeout(900);
  const afterStage = await readState();
  check('a stage drag keeps the village', afterStage.title === third.title && /1 of 3 villages/.test(afterStage.pager));

  // 4. a vertical drag changes nothing
  await touchDrag(onPage.x, onPage.y, onPage.x, onPage.y + 120);
  await page.waitForTimeout(600);
  const afterVertical = await readState();
  check('a vertical drag keeps the village', afterVertical.title === third.title);

  check('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? 'FAILED ' + failed + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
