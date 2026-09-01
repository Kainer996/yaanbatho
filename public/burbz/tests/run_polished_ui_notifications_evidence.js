#!/usr/bin/env node
// Browser evidence for polished-ui-notifications-v339-20260901. Boots the
// REAL game in Chromium twice and reads the dock's own red badges:
//
// Boot A — a realm with work waiting:
//   - the Empire dot lights for an affordable build even while a scaffold
//     rises in another village (the v337 global gate is gone), PLUS a
//     captured village (Liberation Battle won, birdhouse unbuilt, payable)
//     → badge reads 2,
//   - the Forge dot counts a commission past its clock AND a piece the
//     stores could craft right now → badge reads 2,
//   - the polish landed: 9px dock labels, badges that pop once (no infinite
//     pulse), toasts above the sheets, real screen backgrounds, GO no
//     longer blue, CLAIM no longer orange and standing still.
//
// Boot B — the commission collected and the timber spent:
//   - the Forge badge falls to exactly the craftable piece,
//   - with no timber the birdhouse is not payable and no build affordable,
//     so the Empire badge leaves entirely. A dot is a promise.
//
// Zero page errors across both boots.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_polished_ui_notifications_evidence.js
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

async function bootWith(page, plant) {
  await page.evaluate(plantArgs => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    const now = Date.now();
    // Inline plantState — evaluate serializes only this function's body.
    state.player.coins = plantArgs.coins;
    state.player.branches = plantArgs.branches;
    state.player.level = 12;
    state.player.wins = 3;
    state.flock = [{
      id: 'pip', species: 'European Robin', commonName: 'European Robin', rarity: 'common',
      hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 40, cha: 40, stamina: 60, level: 3,
      care: { hunger: 10, happiness: 90 }
    }];
    state.empire = state.empire || {};
    state.empire.villages = {
      '101': { seed: 101, name: 'Elmbrook', lat: 51.5, lon: -0.12, claimedAt: new Date(now).toISOString(), liberatedAt: new Date(now).toISOString(), lastTributeAt: now,
        economy: { constructions: [{ id: 'cabin', toLevel: 1, startMs: now - 60000, endMs: now + 3600000, by: 'player' }] } },
      '102': { seed: 102, name: 'Alderford', lat: 51.52, lon: -0.10, claimedAt: new Date(now).toISOString(), liberatedAt: new Date(now).toISOString(), lastTributeAt: now,
        economy: { constructions: [] } }
    };
    state.empire.liberationVictories = { '777': { seed: 777, name: 'Thrushwick', wonAt: new Date(now).toISOString() } };
    state.forgeLevel = 1;
    state.forgeJobs = plantArgs.forgeJobDone
      ? [{ id: 'job_done', gearId: 'willow_wand', startMs: now - 7200000, endMs: now - 60000 }]
      : [];
    state.inventory = state.inventory || {};
    state.inventory.items = Object.assign({}, state.inventory.items, { iron_grit: 2 });
    state.inventory.gear = {};
    state.inventory.equipment = { pip: { talon: 'oak_ring' } };
    localStorage.setItem('burbz_state', JSON.stringify(state));
  }, plant);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
}

function readBadges(page) {
  return page.evaluate(() => {
    const read = screen => {
      const item = document.querySelector('[data-game-route][data-screen="' + screen + '"]');
      const badge = item && item.querySelector('.nav-action-badge');
      return { badge: badge ? badge.textContent : null, aria: item ? item.getAttribute('aria-label') : null };
    };
    return { empire: read('village'), forge: read('forge') };
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  // ---- Boot A: a realm with work waiting ----------------------------------
  await bootWith(page, { coins: 500, branches: 200, forgeJobDone: true });
  await page.waitForFunction(() => {
    const item = document.querySelector('[data-game-route][data-screen="village"]');
    return !!(item && item.querySelector('.nav-action-badge'));
  }, { timeout: 30000 }).catch(() => {});
  const a = await readBadges(page);

  check('Empire badge = 2: an affordable build in Alderford (while Elmbrook builds) + captured Thrushwick payable',
    a.empire.badge === '2', JSON.stringify(a.empire));
  check('its label says what is waiting', /things waiting in your empire/.test(a.empire.aria || ''), a.empire.aria);
  check('Forge badge = 2: one commission to collect + Thorn Talons craftable now',
    a.forge.badge === '2', JSON.stringify(a.forge));
  check('its label says make or collect', /ready to make or collect/.test(a.forge.aria || ''), a.forge.aria);

  // ---- The polish, measured off the live page -----------------------------
  const polish = await page.evaluate(() => {
    const label = document.querySelector('.nav-item .nav-label');
    const badge = document.querySelector('.nav-action-badge');
    const badgeStyle = badge ? getComputedStyle(badge) : null;
    const toasts = document.getElementById('toastContainer');
    const screen = document.querySelector('.screen.active') || document.querySelector('.screen');
    const goProbe = document.createElement('button');
    goProbe.className = 'quest-go-btn'; document.body.appendChild(goProbe);
    const claimProbe = document.createElement('button');
    claimProbe.className = 'quest-claim-btn'; document.body.appendChild(claimProbe);
    const go = getComputedStyle(goProbe), claim = getComputedStyle(claimProbe);
    const out = {
      labelSize: label ? getComputedStyle(label).fontSize : null,
      badgeAnimation: badgeStyle ? badgeStyle.animationName : null,
      badgeIterations: badgeStyle ? badgeStyle.animationIterationCount : null,
      toastZ: toasts ? getComputedStyle(toasts).zIndex : null,
      screenBg: screen ? getComputedStyle(screen).backgroundColor : null,
      goImage: go.backgroundImage, claimImage: claim.backgroundImage,
      claimAnimation: claim.animationName
    };
    goProbe.remove(); claimProbe.remove();
    return out;
  });
  check('dock labels render at 9px', polish.labelSize === '9px', polish.labelSize);
  check('the badge pops once and stands still',
    polish.badgeAnimation === 'navBadgeIn' && polish.badgeIterations === '1',
    polish.badgeAnimation + ' ×' + polish.badgeIterations);
  check('toasts stack above the gameplay sheets', polish.toastZ === '1600', polish.toastZ);
  check('the screen paints a real background', polish.screenBg === 'rgb(0, 0, 0)', polish.screenBg);
  check('GO left the blue system', !/77, 171, 247|25, 113, 194/.test(polish.goImage || ''), polish.goImage);
  check('CLAIM left the orange system and stands still',
    !/245, 159, 0/.test(polish.claimImage || '') && polish.claimAnimation === 'none',
    polish.claimAnimation);

  // ---- Boot B: commission collected, timber spent -------------------------
  await bootWith(page, { coins: 500, branches: 0, forgeJobDone: false });
  await page.waitForFunction(() => {
    const item = document.querySelector('[data-game-route][data-screen="forge"]');
    return !!(item && item.querySelector('.nav-action-badge'));
  }, { timeout: 30000 }).catch(() => {});
  const b = await readBadges(page);

  check('collected: the Forge badge falls to exactly the craftable piece',
    b.forge.badge === '1', JSON.stringify(b.forge));
  check('no timber: no build affordable, no birdhouse payable — the Empire badge leaves',
    b.empire.badge === null, JSON.stringify(b.empire));

  check('zero page errors across both boots', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
