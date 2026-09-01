#!/usr/bin/env node
// Browser evidence for empire-three-pages-v343-20260901: the Empire tab is
// three pages the player swipes through. Boots the REAL game in Chromium
// with touch and proves:
//
//   - a new save opens the Empire on the map page; one with villages opens
//     on the villages page,
//   - the tab strip has three tabs and tapping one turns the page,
//   - a sideways drag on the page turns it, and the page settles at rest,
//   - the village carousel still swipes between villages, but at its first
//     village a right-drag hands the touch to the page track (Towns),
//   - a rung the player has not reached shows one faded square with a
//     count, not a paragraph,
//   - every caption sits behind an eye (hidden until tapped),
//   - the royal map has a real size once its page is shown,
//   - zero page errors throughout.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     PLAYWRIGHT_CORE_PATH=/opt/node22/lib/node_modules/playwright/node_modules/playwright-core \
//     node tests/run_empire_three_pages_evidence.js
// Set BURBZ_SHOTS=/some/dir to save a screenshot of each page.
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
const SHOTS = process.env.BURBZ_SHOTS || '';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

const HOUR = 3600000;
function plantedVillages(now) {
  const village = (seed, lat, lon) => ({
    seed, name: 'Seed ' + seed, lat, lon,
    claimedAt: new Date(now - 40 * HOUR).toISOString(),
    liberatedAt: new Date(now - 40 * HOUR).toISOString(),
    lastTributeAt: now - HOUR,
    economy: { population: 6, buildings: { cabin: 2, well: 2, hut: 2 }, constructions: [], ruins: [] }
  });
  return { 101: village(101, 51.50, -3.20), 202: village(202, 51.52, -3.22), 303: village(303, 51.54, -3.24) };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });

  const activePage = () => page.evaluate(() => (document.querySelector('.empire-page.is-active') || { dataset: {} }).dataset.empirePage || '');
  const tabs = () => page.evaluate(() => [...document.querySelectorAll('.empire-page-tab')].map(t => ({ page: t.dataset.empirePage, label: t.querySelector('.ept-label').textContent, active: t.classList.contains('is-active') })));

  // ---- 1. an empty empire opens on the map ---------------------------------
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay, .merlin-tutorial-overlay').forEach(el => el.remove());
    window.switchScreen('village');
  });
  await page.waitForTimeout(600);
  check('a new save opens the Empire on the map page', (await activePage()) === 'realm', await activePage());
  const strip = await tabs();
  check('three tabs stand in the strip: EMPIRE · TOWNS · VILLAGES', strip.map(t => t.label).join(' · ') === 'EMPIRE · TOWNS · VILLAGES', strip.map(t => t.label).join(' · '));
  const mapBox = await (await page.$('#empireMapCard')).boundingBox();
  check('the royal map has a real size on its page', mapBox && mapBox.height > 300, mapBox && Math.round(mapBox.height) + 'px');
  const emptyVillages = await page.evaluate(() => {
    window.showEmpirePage('villages');
    const cta = document.querySelector('#empirePanel .empire-ghost-cta');
    return { cta: cta ? cta.textContent.trim() : '', paragraphs: document.querySelectorAll('#empirePanel .empire-onboarding-step').length };
  });
  check('an empty villages page is one gold button, no numbered steps', /FREE YOUR FIRST VILLAGE/.test(emptyVillages.cta) && emptyVillages.paragraphs === 0, JSON.stringify(emptyVillages));
  const ghost = await page.evaluate(() => { window.showEmpirePage('towns'); const g = document.querySelector('#empireTownsPanel .empire-ghost-count'); return g ? g.textContent.trim() : ''; });
  check('the towns page shows a faded square with a star count', /⭐ 0 \/ 3/.test(ghost), ghost);

  // ---- 2. plant three villages ---------------------------------------------
  await page.evaluate(villages => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.empire = state.empire || {};
    state.empire.villages = villages;
    state.empire.townCharters = []; state.empire.cityCharters = []; state.empire.regionCharters = [];
    state.lastVillage = { seed: 101, name: 'Seed 101', lat: 51.50, lon: -3.20 };
    delete state.empirePage;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    localStorage.setItem('burbzTutorialChapters:' + (window.BURBZ_TUTORIAL_VERSION || ''), '[]');
  }, plantedVillages(Date.now()));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove());
    window.switchScreen('village');
  });
  await page.waitForSelector('#empireVillageHub:not([hidden])', { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => { document.querySelectorAll('.merlin-tutorial-overlay').forEach(el => el.classList.remove('show')); });
  check('a save with villages opens on the villages page', (await activePage()) === 'villages', await activePage());
  const tiles = await page.evaluate(() => document.querySelectorAll('#empirePanel .empire-tile').length);
  check('one square per village', tiles === 3, String(tiles));

  // ---- 3. no caption is on show; every one waits behind an eye ------------
  const captions = await page.evaluate(() => {
    const shown = [];
    document.querySelectorAll('#empirePages .empire-tier-copy, #empirePages .realm-hint, #empirePages .merge-banner-copy, #villageSub .info-note').forEach(el => {
      const note = el.closest('.info-note');
      if (!note || !note.hidden) shown.push(el.textContent.trim().slice(0, 40));
    });
    const hint = document.querySelector('.province-desk-hint');
    return { shown, deskHint: hint ? hint.textContent.trim() : '', pager: (document.getElementById('villagePager') || {}).textContent || '' };
  });
  check('every caption waits behind a closed eye', captions.shown.length === 0, JSON.stringify(captions.shown));
  check('the desk hint is an eye, not a sentence', captions.deskHint.length <= 3, JSON.stringify(captions.deskHint));
  check('the village pager is dots, not a sentence', !/villages/.test(captions.pager), JSON.stringify(captions.pager.trim()));
  const eyeOpens = await page.evaluate(() => {
    const dot = document.querySelector('#empirePanel .empire-tier-head .info-dot');
    if (!dot) return false;
    dot.click();
    const note = document.getElementById(dot.getAttribute('data-info-dot'));
    const open = note && !note.hidden && /merge star/.test(note.textContent);
    dot.click();
    return open;
  });
  check('tapping the tier eye opens the caption and the colour key', eyeOpens);

  if (SHOTS) {
    for (const name of ['villages', 'towns', 'realm']) {
      await page.evaluate(n => { window.showEmpirePage(n, { silent: true }); document.getElementById('screen-village').scrollTop = 0; }, name);
      await page.waitForTimeout(700);
      await page.screenshot({ path: SHOTS + '/empire-page-' + name + '.png' });
    }
    await page.evaluate(() => window.showEmpirePage('villages', { silent: true }));
    await page.waitForTimeout(300);
  }

  // ---- 4. tabs and drags turn the page -------------------------------------
  await page.evaluate(() => document.querySelector('.empire-page-tab[data-empire-page="towns"]').click());
  await page.waitForTimeout(500);
  check('tapping TOWNS turns the page', (await activePage()) === 'towns', await activePage());

  const cdp = await context.newCDPSession(page);
  async function touchDrag(x0, y0, x1, y1) {
    const steps = 8;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0 }] });
    for (let i = 1; i <= steps; i++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (x1 - x0) * i / steps, y: y0 + (y1 - y0) * i / steps }] });
      await page.waitForTimeout(16);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  }
  await page.evaluate(() => { document.getElementById('screen-village').scrollTop = 0; });
  await page.waitForTimeout(300);
  const townsBox = await (await page.$('#empireTownsPanel')).boundingBox();
  const onTowns = { x: townsBox.x + townsBox.width / 2, y: townsBox.y + Math.min(40, townsBox.height / 2) };
  await touchDrag(onTowns.x + 90, onTowns.y, onTowns.x - 90, onTowns.y);
  await page.waitForTimeout(700);
  check('a left drag on the page turns to VILLAGES', (await activePage()) === 'villages', await activePage());
  const rest = await page.evaluate(() => [...document.querySelectorAll('.empire-page')].every(p => !p.style.transform));
  check('the pages settle at rest after the glide', rest);
  const panelBox = await (await page.$('#empirePanel')).boundingBox();
  const onVillages = { x: panelBox.x + panelBox.width / 2, y: panelBox.y + 20 };
  await touchDrag(onVillages.x - 90, onVillages.y, onVillages.x + 90, onVillages.y);
  await page.waitForTimeout(700);
  check('a right drag on the page turns back to TOWNS', (await activePage()) === 'towns', await activePage());
  await touchDrag(onTowns.x - 90, onTowns.y, onTowns.x + 90, onTowns.y);
  await page.waitForTimeout(700);
  check('another right drag reaches the EMPIRE map page', (await activePage()) === 'realm', await activePage());
  const mapShown = await page.evaluate(() => { const r = document.getElementById('empireMapCard').getBoundingClientRect(); return r.width > 300 && r.height > 300; });
  check('the map page shows the royal map at full size', mapShown);

  // ---- 5. the village carousel nests inside the page track -----------------
  await page.evaluate(() => { window.showEmpirePage('villages', { silent: true }); });
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('villageTitle').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  const titleBox = await (await page.$('#villageTitle')).boundingBox();
  const onHub = { x: titleBox.x + titleBox.width / 2, y: titleBox.y + titleBox.height / 2 };
  const readVillage = () => page.evaluate(() => (document.getElementById('villageTitle') || {}).textContent || '');
  const v1 = await readVillage();
  await touchDrag(onHub.x + 90, onHub.y, onHub.x - 90, onHub.y);
  await page.waitForTimeout(900);
  const v2 = await readVillage();
  check('a left drag on the village still glides to the next village', v2 !== v1 && (await activePage()) === 'villages', v1.trim() + ' → ' + v2.trim());
  await page.waitForFunction(() => /^translateX\(0(px)?\)$/.test(document.getElementById('empireVillageHub').style.transform) || !document.getElementById('empireVillageHub').style.transform, { timeout: 5000 }).catch(() => {});
  await touchDrag(onHub.x - 90, onHub.y, onHub.x + 90, onHub.y);
  await page.waitForTimeout(900);
  const v3 = await readVillage();
  check('a right drag comes back to the first village', v3 === v1 && (await activePage()) === 'villages', v3.trim());
  await page.waitForTimeout(400);
  // At the first village, another right drag has nowhere to go inside the
  // carousel — it hands the touch outward and the page turns to TOWNS.
  await page.evaluate(() => document.getElementById('villageTitle').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  const titleBox2 = await (await page.$('#villageTitle')).boundingBox();
  await touchDrag(titleBox2.x + titleBox2.width / 2 - 90, titleBox2.y + titleBox2.height / 2, titleBox2.x + titleBox2.width / 2 + 90, titleBox2.y + titleBox2.height / 2);
  await page.waitForTimeout(800);
  check('at the first village a right drag turns the page to TOWNS', (await activePage()) === 'towns' && (await readVillage()) === v1, await activePage());

  check('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? 'FAILED ' + failed + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
