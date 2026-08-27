#!/usr/bin/env node
// Browser evidence for walk-detection-removed-v334-20260827. Boots the REAL
// game in Chromium with a granted geolocation that then DRIVES — a stream of
// real position fixes at road speed, the exact situation that used to pop
// "Eyes on the trail" over Yaan's screen at work — and proves:
//
//   - no sheet, card or wander opens by itself; no side quest starts,
//   - the walk detector is not even reachable from the page,
//   - Settings no longer carries a Trail Mode row,
//   - the player's own Side Quest button still works,
//   - zero page errors (the retired toggle's init lines are truly gone).
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_walk_detection_removed_evidence.js
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

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2,
    geolocation: { latitude: 51.50, longitude: -3.20, accuracy: 8 },
    permissions: ['geolocation']
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove()));
  await page.waitForTimeout(1500);

  // ---- drive: ~40 km/h north for two minutes of simulated fixes ----------
  // 0.0001 deg lat ≈ 11 m; one fix per 600 ms at ~11 m per fix ≈ road speed
  // to the page's own clock-free reading of consecutive positions.
  for (let i = 1; i <= 40; i++) {
    await context.setGeolocation({ latitude: 51.50 + i * 0.0001, longitude: -3.20, accuracy: 8 });
    await page.waitForTimeout(600);
  }

  const afterDrive = await page.evaluate(() => ({
    trailSheet: !!document.querySelector('.trail-card-title, .trail-card-hero'),
    eyesText: document.body.textContent.includes('Eyes on the trail'),
    sheetOpen: !!document.querySelector('#walkQuestSheet.open, .quest-overlay.open'),
    detectorReachable: typeof window.trailModeOnPositionFix !== 'undefined',
    sideQuestRunning: !!(window.__burbzQuestDebug && (() => {
      const s = window.__burbzQuestDebug.getState();
      return s && s.sideQuest && s.sideQuest.active;
    })())
  }));
  check('driving opens nothing', !afterDrive.trailSheet && !afterDrive.eyesText && !afterDrive.sheetOpen,
    JSON.stringify(afterDrive));
  check('no wander started itself', afterDrive.sideQuestRunning === false);
  check('the detector is unreachable from the page', afterDrive.detectorReachable === false);

  // ---- Settings carries no Trail Mode row ---------------------------------
  const settings = await page.evaluate(() => {
    const labels = Array.from(document.querySelectorAll('.settings-label')).map(el => el.textContent);
    return { hasTrailRow: labels.some(t => /Trail Mode/i.test(t)), toggle: !!document.getElementById('toggleTrailMode') };
  });
  check('Settings has no Trail Mode row', !settings.hasTrailRow && !settings.toggle, JSON.stringify(settings));

  // ---- the player's own road still opens ----------------------------------
  const intro = await page.evaluate(() => {
    window.openSideQuestIntroSheet();
    const el = document.querySelector('.quest-overlay-panel');
    return { open: !!el, button: !!(el && el.textContent.includes('START SIDE QUEST')) };
  });
  check("the player's own Side Quest sheet still opens", intro.open && intro.button, JSON.stringify(intro));

  check('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? 'FAILED ' + failed + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
