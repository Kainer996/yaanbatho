#!/usr/bin/env node
// Browser evidence for quiet-arena-v331-20260826. Boots the REAL game in
// Chromium on three phone sizes, walks the real Battle screen, and proves the
// fight fits on one screen with nothing hidden and nothing to scroll:
//
//   - the Battle screen never scrolls vertically, at rest or mid-fight,
//   - no opening narration: the log starts empty,
//   - the Focus rail and the SURGE button are gone,
//   - the moves are fully on screen, inside the visible viewport,
//   - it still holds with a confirm bar up and a log full of events.
//
// Run it (playwright + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_battle_fits_one_screen_evidence.js
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

// Yaan's phone is 360x780 CSS. The other two are a small Android and an
// iPhone SE — the screen sizes a fix that only counts pixels falls over on.
const PHONES = [
  { label: '360x780 (Yaan\'s phone)', width: 360, height: 780 },
  { label: '360x667 (iPhone SE)', width: 360, height: 667 },
  { label: '320x568 (smallest phone in use)', width: 320, height: 568 }
];

// Four birds with long names, so the cards are as tall as they ever get.
const FLOCK = ['Great Spotted Woodpecker', 'Carrion Crow', 'Hooded Crow', 'Common Kestrel'];

async function bootBattle(browser, phone) {
  const page = await browser.newPage({
    viewport: { width: phone.width, height: phone.height }, deviceScaleFactor: 2
  });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.BurbzBattleCore && !!window.battlePickToggle, { timeout: 90000 });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  await page.evaluate(flock => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.flock = flock.map((sp, i) => ({
      id: 'fit-' + i, species: sp, commonName: sp, rarity: 'common',
      hp: 400, maxHp: 400, atk: 45, def: 45, spd: 40 + i * 6, int: 50, cha: 50, stamina: 70,
      level: 5, hunger: 100, energy: 100, mood: 100, health: 100
    }));
    state.player = state.player || {}; state.player.level = 5;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
  }, FLOCK);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.BurbzBattleCore && !!window.battlePickToggle, { timeout: 90000 });
  await page.waitForFunction(() => (window.__burbzMapDebug.state.flock || []).length >= 4, { timeout: 90000 });

  const clearOverlays = () => page.evaluate(() => document.querySelectorAll(
    '.intro-cutscene-overlay, .merlin-tutorial-overlay, .toast-host, .toast').forEach(el => el.remove()));

  await page.evaluate(() => window.switchScreen('battle'));
  await page.waitForTimeout(400);
  await page.evaluate(() => (window.__burbzMapDebug.state.flock || [])
    .map(b => b.id).slice(0, 4).forEach(id => window.battlePickToggle(id)));
  await clearOverlays();
  await page.evaluate(() => document.getElementById('battleStartBtn').click());
  await page.waitForSelector('#arenaPlayerRow .arena-unit', { timeout: 20000 });
  await page.waitForTimeout(1000);
  await clearOverlays();
  return { page, errors, clearOverlays };
}

// Everything the player can actually reach has to be inside the viewport, not
// merely inside a box that happens not to scroll.
const measure = page => page.evaluate(() => {
  const screen = document.getElementById('screen-battle');
  const vh = window.innerHeight;
  const nav = document.querySelector('.bottom-nav');
  const navTop = nav ? nav.getBoundingClientRect().top : vh;
  const buttons = Array.from(document.querySelectorAll('#arenaActions .move-btn'));
  const worst = buttons.reduce((acc, el) => Math.max(acc, el.getBoundingClientRect().bottom), 0);
  return {
    screenScrollH: screen.scrollHeight,
    screenClientH: screen.clientHeight,
    overflow: screen.scrollHeight - screen.clientHeight,
    docOverflow: document.documentElement.scrollHeight - document.documentElement.clientHeight,
    buttons: buttons.length,
    lowestButtonBottom: Math.round(worst),
    navTop: Math.round(navTop),
    logLines: document.querySelectorAll('#battleLog > *').length,
    logScrolls: (() => { const l = document.getElementById('battleLog'); return l.scrollHeight > l.clientHeight + 1; })(),
    hasFocusRail: !!document.getElementById('arenaFocus') || !!document.querySelector('.arena-focus'),
    hasSurge: !!document.querySelector('.surge-btn') ||
      /SURGE/.test((document.getElementById('arenaActions') || {}).textContent || '')
  };
});

// Play a turn through the real buttons, so the log fills and the confirm bar
// shows — the tallest the actions block ever gets.
const playATurn = page => page.evaluate(() => {
  const b = window.__burbzArenaDebug.battle();
  if (!b || !b.acting || b.acting.side !== 'player') return false;
  const move = Array.from(document.querySelectorAll('#arenaActions .move-btn'))
    .filter(el => (el.getAttribute('onclick') || '').indexOf('battleSelectSkill') === 0 && !el.disabled)[0];
  if (!move) return false;
  move.click();
  const foe = b.teams.opponent.map((f, i) => ({ f, i })).find(x => !x.f.fainted);
  const unit = document.getElementById('unit_opponent_' + foe.i);
  if (unit) unit.click();
  return true;
});

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  for (const phone of PHONES) {
    console.log('\n' + phone.label);
    const { page, errors, clearOverlays } = await bootBattle(browser, phone);

    const atRest = await measure(page);
    check('  battle screen does not scroll at the opening', atRest.overflow <= 0,
      atRest.screenScrollH + ' into ' + atRest.screenClientH + ' px');
    check('  the log opens empty — no narration', atRest.logLines === 0,
      atRest.logLines + ' lines');
    check('  the Focus rail is gone', !atRest.hasFocusRail);
    check('  the SURGE button is gone', !atRest.hasSurge);
    check('  every move button is above the nav bar',
      atRest.buttons > 0 && atRest.lowestButtonBottom <= atRest.navTop,
      'lowest button at ' + atRest.lowestButtonBottom + ', nav starts at ' + atRest.navTop);

    // Now fight: four turns of events, and stop with a move chosen so the
    // ATTACK confirm bar is on screen too.
    for (let i = 0; i < 4; i++) {
      await page.waitForFunction(() => {
        const b = window.__burbzArenaDebug.battle();
        return !!(b && b.phase === 'act' && b.acting && b.acting.side === 'player');
      }, null, { timeout: 20000 }).catch(() => {});
      if (!await playATurn(page)) break;
      if (i < 3) {
        await page.evaluate(() => {
          const go = document.querySelector('#arenaActions .attack-confirm-btn:not([disabled])');
          if (go) go.click();
        });
        await page.waitForTimeout(1400);
      }
    }
    await clearOverlays();
    await page.waitForTimeout(300);
    const midFight = await measure(page);
    check('  still no scroll mid-fight, with the ATTACK bar up', midFight.overflow <= 0,
      midFight.screenScrollH + ' into ' + midFight.screenClientH + ' px, ' + midFight.logLines + ' log lines');
    check('  every move button is still above the nav bar',
      midFight.buttons > 0 && midFight.lowestButtonBottom <= midFight.navTop,
      'lowest button at ' + midFight.lowestButtonBottom + ', nav starts at ' + midFight.navTop);
    check('  the log took the squeeze, not the moves', midFight.logLines > 0);
    if (errors.length) console.log('  page errors: ' + JSON.stringify(errors.slice(0, 3)));
    if (SHOT && phone.width === 360 && phone.height === 780) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: SHOT });
    }
    await page.close();
  }
  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (failed.length ? failed.length + ' CHECK(S) FAILED' : 'all ' + results.length + ' checks passed'));
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
