#!/usr/bin/env node
// Browser evidence for release-polish-v342-20260901. Boots the REAL game in
// Chromium and proves the polish pass with real geometry and real taps:
//
//   1. The dock's SCAN label sits fully on screen (its 46px lens used to
//      push the label's foot past the viewport edge), and the island no
//      longer covers the top deck's labels.
//   2. Academy: tapping Build starts placement AND carries the player back
//      up to the tree — the scroll Yaan asked for by name.
//   3. Merlin's perch is gone from the Empire screen, so the LEDGER button
//      is visible and takes the tap; on the arena the league record is
//      unobscured; inside a room the Back button answers a real tap.
//   4. The scan waveform box is hidden while the microphone is closed.
//   5. The photo viewer's CLOSE handler exists on window (it used to throw).
//
// Zero page errors throughout.
//
// Run it:
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_release_polish_evidence.js
// Exits non-zero if any check fails.

function requirePlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE_PATH, 'playwright-core', 'playwright',
    '/opt/node22/lib/node_modules/playwright'].filter(Boolean);
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

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch|net::/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  // A veteran save: gates open, coins for a build, the tutorial done.
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.player.level = 12; state.player.coins = 800; state.player.branches = 300;
    state.flock = [{ id: 'pip', species: 'European Robin', commonName: 'European Robin', rarity: 'common',
      hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 40, cha: 40, stamina: 60, level: 4,
      care: { hunger: 30, happiness: 80 } }];
    localStorage.setItem('burbz_state', JSON.stringify(state));
    localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
    localStorage.setItem('burbzTutorialChapters:merlin-interactive-flow-v7-20260728', JSON.stringify(
      ['story', 'quests', 'errand', 'academy', 'academy_tour', 'explore', 'scan', 'birdex', 'battle',
       'village', 'town', 'diary', 'forge', 'inventory', 'leaderboards', 'profile']));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
  await page.waitForTimeout(900);

  // ---- 1. The dock island ---------------------------------------------------
  const dock = await page.evaluate(() => {
    const vh = window.innerHeight;
    const island = document.querySelector('.bottom-dock-anchor').getBoundingClientRect();
    const scanLabel = document.querySelector('.bottom-dock-anchor .nav-scan .nav-label').getBoundingClientRect();
    const topLabel = [...document.querySelectorAll('.dock-row-top .nav-label')]
      .find(l => l.textContent === 'Training').getBoundingClientRect();
    return { vh, islandTop: island.top, scanBottom: scanLabel.bottom, trainingBottom: topLabel.bottom };
  });
  check('SCAN label sits fully on screen', dock.scanBottom <= dock.vh, `bottom ${dock.scanBottom.toFixed(1)} vs viewport ${dock.vh}`);
  check('the island does not cover the top deck\'s labels', dock.trainingBottom <= dock.islandTop + 1,
    `Training label bottom ${dock.trainingBottom.toFixed(1)} vs island top ${dock.islandTop.toFixed(1)}`);

  // ---- 2. Academy: Build carries the player to the tree ---------------------
  await page.evaluate(() => window.switchScreen('academy'));
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    const screen = document.getElementById('screen-academy');
    const panel = document.getElementById('academyBuildPanel');
    panel.scrollIntoView({ block: 'start' });
    screen.scrollTop = Math.max(screen.scrollTop, 400);
  });
  await page.waitForTimeout(300);
  const scrolledBefore = await page.evaluate(() => document.getElementById('screen-academy').scrollTop);
  const buildBtn = await page.$('.academy-building-card.buildable .academy-build-btn:not([disabled])');
  check('a buildable card offers a Build button below the fold', !!buildBtn && scrolledBefore > 200,
    `scrollTop ${scrolledBefore}`);
  if (buildBtn) {
    const label = (await buildBtn.textContent()).trim();
    check('the button reads Build', label === 'Build', label);
    await buildBtn.click();
    await page.waitForFunction(() => document.getElementById('screen-academy').scrollTop < 40, { timeout: 4000 }).catch(() => {});
    const after = await page.evaluate(() => ({
      scrollTop: document.getElementById('screen-academy').scrollTop,
      hint: !!document.querySelector('.treehouse-placement-hint')
    }));
    check('tapping Build scrolls the tree back into view', after.scrollTop < 40, `scrollTop ${after.scrollTop}`);
    check('the tap-the-tree placement hint is up', after.hint);
  }

  // ---- 3. The perch stays off the controls ----------------------------------
  await page.evaluate(() => window.switchScreen('village'));
  await page.waitForTimeout(700);
  const empire = await page.evaluate(() => {
    const perch = document.getElementById('merlinPerchAssembly');
    const ledger = document.getElementById('empireLedgerBtn');
    const r = ledger.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { perchHidden: !perch || perch.offsetParent === null || getComputedStyle(perch).display === 'none',
             ledgerTakesTheTap: !!(hit && (hit === ledger || ledger.contains(hit))) };
  });
  check('Empire: Merlin\'s perch stands down', empire.perchHidden);
  check('Empire: the LEDGER button takes the tap', empire.ledgerTakesTheTap);

  await page.evaluate(() => window.switchScreen('battle'));
  await page.waitForTimeout(700);
  const battle = await page.evaluate(() => {
    const perch = document.getElementById('merlinPerchAssembly');
    const prog = document.querySelector('.league-progress');
    const r = prog ? prog.getBoundingClientRect() : null;
    const hit = r ? document.elementFromPoint(r.right - 8, r.top + 8) : null;
    return { perchHidden: !perch || getComputedStyle(perch).display === 'none',
             recordVisible: !!(hit && (prog === hit || prog.contains(hit) || hit.contains(prog))) };
  });
  check('Arena: the perch stands down', battle.perchHidden);
  check('Arena: the league record is unobscured', battle.recordVisible);

  await page.evaluate(() => window.openAcademyRoom('kitchen'));
  await page.waitForTimeout(800);
  const roomBack = await page.$('#academyRoomBackBtn');
  const roomState = await page.evaluate(() => {
    const perch = document.getElementById('merlinPerchAssembly');
    const back = document.getElementById('academyRoomBackBtn');
    const r = back.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { perchHidden: !perch || getComputedStyle(perch).display === 'none',
             backTakesTheTap: !!(hit && (hit === back || back.contains(hit))) };
  });
  check('Room: the perch stands down indoors', roomState.perchHidden);
  check('Room: the Back button takes the tap', roomState.backTakesTheTap);
  if (roomBack) {
    await roomBack.click();
    await page.waitForTimeout(600);
    const backWorked = await page.evaluate(() => document.body.getAttribute('data-active-screen'));
    check('a real tap on Back leaves the room', backWorked !== 'academy-room', backWorked);
  }

  // ---- 4. The waveform earns its space --------------------------------------
  await page.evaluate(() => window.switchScreen('scan'));
  await page.waitForTimeout(600);
  const wave = await page.evaluate(() => {
    const el = document.getElementById('waveformContainer');
    return { hidden: getComputedStyle(el).display === 'none' };
  });
  check('the waveform box is hidden while the microphone is closed', wave.hidden);

  // ---- 5. The photo viewer can close ----------------------------------------
  const closeWired = await page.evaluate(() => typeof window.closePlayerBirdPhotoViewer === 'function');
  check('the photo viewer CLOSE handler is wired to window', closeWired);

  // ---- errors ----------------------------------------------------------------
  check('zero page errors across the whole run', errors.length === 0, errors.slice(0, 3).join(' | ') || 'none');

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} checks passed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
