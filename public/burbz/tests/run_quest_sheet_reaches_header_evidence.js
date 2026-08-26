#!/usr/bin/env node
// Browser evidence for quiet-arena-v331-20260826, quest half. Boots the REAL
// game in Chromium, opens a real errand sheet from the Quests screen, and
// proves the sheet opens all the way up to just under the coins:
//
//   - the panel's top edge sits just below the header, not at 82% of the screen,
//   - the whole errand — every duration tier and every bird — is on screen,
//   - the sheet still clears the header, so the coins stay readable.
//
// Run it (playwright + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_quest_sheet_reaches_header_evidence.js
// Exits non-zero if any check fails.

function requirePlaywright() {
  const candidates = [process.env.PLAYWRIGHT_CORE_PATH, 'playwright-core', 'playwright',
    '/opt/node22/lib/node_modules/playwright/index.js'].filter(Boolean);
  for (const id of candidates) {
    try { return require(id); } catch (e) {}
  }
  console.error('playwright-core not found; set PLAYWRIGHT_CORE_PATH');
  process.exit(2);
}
const { chromium } = requirePlaywright();

const URL = process.env.BURBZ_URL || 'http://127.0.0.1:8765/index.html';
const EXE = process.env.CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOT = process.env.SHOT_PATH || '';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

const PHONES = [
  { label: '360x780 (Yaan\'s phone)', width: 360, height: 780 },
  { label: '360x667 (iPhone SE)', width: 360, height: 667 }
];

const FLOCK = ['Merlin', 'Carrion Crow', 'Great Spotted Woodpecker', 'Hooded Crow'];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  for (const phone of PHONES) {
    console.log('\n' + phone.label);
    const page = await browser.newPage({
      viewport: { width: phone.width, height: phone.height }, deviceScaleFactor: 2
    });
    const errors = [];
    page.on('pageerror', e => errors.push(String((e && e.message) || e)));
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.openQuestSend && !!window.switchScreen, { timeout: 90000 });
    await page.waitForFunction(() => {
      try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
    }, { timeout: 90000 });

    await page.evaluate(flock => {
      const state = JSON.parse(localStorage.getItem('burbz_state'));
      state.flock = flock.map((sp, i) => ({
        id: 'q-' + i, species: sp, commonName: sp, rarity: 'common',
        hp: 90, maxHp: 90, atk: 45, def: 45, spd: 45, int: 50, cha: 50, stamina: 70,
        level: 5, hunger: 100, energy: 100, mood: 100, health: 100
      }));
      state.player = state.player || {}; state.player.level = 5;
      localStorage.setItem('burbz_state', JSON.stringify(state));
      localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
    }, FLOCK);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.openQuestSend && !!window.switchScreen, { timeout: 90000 });
    await page.waitForFunction(() => (window.__burbzMapDebug.state.flock || []).length >= 4, { timeout: 90000 });
    await page.evaluate(() => document.querySelectorAll(
      '.intro-cutscene-overlay, .merlin-tutorial-overlay, .toast-host, .toast').forEach(el => el.remove()));

    // Open a real errand the way a thumb does: the Quests screen, then the card.
    await page.evaluate(() => window.switchScreen('quests'));
    await page.waitForTimeout(500);
    const opened = await page.evaluate(() => {
      const core = window.BurbzAcademyCore;
      const templates = (core && core.getQuestTemplates && core.getQuestTemplates()) || [];
      const pick = templates.find(t => t.tutorial !== true) || templates[0];
      if (!pick) return null;
      window.openQuestSend(pick.id);
      return pick.id;
    });
    check('  an errand sheet opens', !!opened, String(opened));
    await page.waitForSelector('#questOverlay.open .quest-overlay-panel.is-send', { timeout: 10000 });
    await page.waitForTimeout(400);
    await page.evaluate(() => document.querySelectorAll(
      '.merlin-tutorial-overlay, .toast-host, .toast').forEach(el => el.remove()));

    const m = await page.evaluate(() => {
      const panel = document.querySelector('#questOverlay.open .quest-overlay-panel.is-send');
      const header = document.querySelector('.header');
      const pr = panel.getBoundingClientRect();
      const hr = header.getBoundingClientRect();
      const sendBtn = panel.querySelector('.quest-send-btn');
      const birds = panel.querySelectorAll('.qs-bird, [onclick^="selectQuestBird"]');
      const durations = panel.querySelectorAll('[onclick^="selectQuestDuration"]');
      return {
        panelTop: Math.round(pr.top), panelBottom: Math.round(pr.bottom),
        headerBottom: Math.round(hr.bottom),
        gap: Math.round(pr.top - hr.bottom),
        viewport: window.innerHeight,
        panelScrollH: panel.scrollHeight, panelClientH: panel.clientHeight,
        innerOverflow: panel.scrollHeight - panel.clientHeight,
        headerVisible: hr.bottom <= pr.top + 1,
        sendBottom: sendBtn ? Math.round(sendBtn.getBoundingClientRect().bottom) : null,
        birds: birds.length, durations: durations.length,
        maxHeightCss: getComputedStyle(panel).maxHeight,
        headerVar: getComputedStyle(document.documentElement).getPropertyValue('--burbz-header-h').trim()
      };
    });
    console.log('  ' + JSON.stringify(m));

    check('  the header height is measured, not guessed', /^\d+px$/.test(m.headerVar), m.headerVar);
    // "Just under the coins": the panel starts within a few px of the header's
    // bottom edge, instead of the old 82vh which left a big dead gap.
    check('  the sheet reaches up to just under the coins', m.gap >= 0 && m.gap <= 12,
      m.gap + 'px below the header');
    check('  the coins stay visible above the sheet', m.headerVisible);
    check('  the errand fits without scrolling inside the sheet', m.innerOverflow <= 0,
      m.panelScrollH + ' into ' + m.panelClientH + ' px');
    check('  every duration tier and every bird is in the sheet',
      m.durations >= 6 && m.birds >= 4, m.durations + ' durations, ' + m.birds + ' birds');
    if (errors.length) console.log('  page errors: ' + JSON.stringify(errors.slice(0, 3)));
    if (SHOT && phone.height === 780) await page.screenshot({ path: SHOT });
    await page.close();
  }
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length ? failed.length + ' CHECK(S) FAILED' : 'all ' + results.length + ' checks passed'));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
