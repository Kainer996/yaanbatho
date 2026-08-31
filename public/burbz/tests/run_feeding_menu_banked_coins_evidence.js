#!/usr/bin/env node
// Browser evidence for feeding-menu-banked-coins-v337-20260831. Boots the
// REAL game in Chromium, plants a flock, a pantry, spare gear and one
// already-landed Find Coins expedition, and proves:
//
//   - the landed expedition banks itself: player coins rise by its reward
//     with no CLAIM tap, and the expedition leaves the ledger,
//   - the feed sheet opens with the two menu columns (Primary meals /
//     Secondary meals) as icon + name, and the robin's mainstay is right,
//   - the old explainer paragraph and the "Eats:" line are gone,
//   - no food row is highlighted or tagged — the player reads the menu,
//   - the Stores button and the Birds tab carry no red dot, and the tab
//     reads "Birds", not "Burbz",
//   - zero page errors.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_feeding_menu_banked_coins_evidence.js
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

const BASE_COINS = 11;      // Yaan's own balance from the report
const QUEST_COINS = 12;
const QUEST_XP = 8;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
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

  await page.evaluate(({ BASE_COINS, QUEST_COINS, QUEST_XP }) => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.player.coins = BASE_COINS;
    state.player.level = 9;
    state.flock = [{
      id: 'pip', species: 'European Robin', commonName: 'European Robin', rarity: 'common',
      hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 40, cha: 40, stamina: 60, level: 3,
      care: { hunger: 55 }
    }];
    // A full pantry so the feed sheet has rows to not-highlight.
    state.pantry = { seeds: 5, suet: 5, insects: 5, worms: 5, berries: 5, fruit: 5, fish: 5 };
    // Spare kit + an empty slot: the OLD build would light the Stores dot.
    state.inventory = state.inventory || {};
    state.inventory.gear = Object.assign({}, state.inventory.gear, { thorn_talons: 1 });
    state.inventory.equipment = {};
    // One Find Coins errand, already landed, never claimed. The banker must
    // pay it out on its own.
    state.birdExpeditions = [{
      id: 'exp_evidence_pip', birdId: 'pip', birdName: 'European Robin',
      templateId: 'find_coins', label: 'Find Coins', icon: '🪙',
      startMs: Date.now() - 600000, endMs: Date.now() - 60000, durationMinutes: 5,
      status: 'active', seed: 7,
      rewards: { coins: QUEST_COINS, branches: 0, xp: QUEST_XP, items: {}, itemRolls: 0 }
    }];
    localStorage.setItem('burbz_state', JSON.stringify(state));
  }, { BASE_COINS, QUEST_COINS, QUEST_XP });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.openFeedSheet === 'function', { timeout: 90000 });

  // ---- 1. The landed errand banks itself -----------------------------------
  const banked = await page.waitForFunction(({ BASE_COINS, QUEST_COINS }) => {
    try {
      const state = JSON.parse(localStorage.getItem('burbz_state') || 'null');
      if (!state) return null;
      const gone = !(state.birdExpeditions || []).some(q => q.id === 'exp_evidence_pip');
      if (state.player.coins >= BASE_COINS + QUEST_COINS && gone) {
        return { coins: state.player.coins, gone };
      }
      return null;
    } catch (e) { return null; }
  }, { BASE_COINS, QUEST_COINS }, { timeout: 45000 }).then(h => h.jsonValue());
  check('the landed errand banked its coins with no CLAIM tap',
    banked && banked.coins === BASE_COINS + QUEST_COINS && banked.gone,
    JSON.stringify(banked));

  // ---- 2 + 3 + 4. The feed sheet: menu columns, no lecture, no glow --------
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove());
    window.openFeedSheet('pip');
  });
  await page.waitForSelector('#burbzFeedSheet.open .feed-food', { timeout: 30000 });
  const sheet = await page.evaluate(() => {
    const root = document.getElementById('burbzFeedSheet');
    const col = kind => root.querySelector('.feed-menu-col[data-feed-menu-col="' + kind + '"]');
    const foods = kind => Array.from((col(kind) || document.createElement('div')).querySelectorAll('.feed-menu-food')).map(el => el.textContent.trim());
    return {
      hasMenu: !!root.querySelector('.feed-sheet-menu'),
      primary: foods('primary'),
      secondary: foods('secondary'),
      oldHint: root.textContent.includes('Tap one food to serve it'),
      oldEats: root.textContent.includes('Eats:'),
      highlighted: root.querySelectorAll('.feed-food.known-pref').length,
      tagged: root.querySelectorAll('.feed-food-tag').length,
      rows: root.querySelectorAll('.feed-food').length,
      menuColumns: getComputedStyle(root.querySelector('.feed-sheet-menu')).gridTemplateColumns.split(' ').length
    };
  });
  check('the feed sheet carries the two-column menu', sheet.hasMenu && sheet.menuColumns === 2,
    sheet.menuColumns + ' columns');
  check("the robin's primary meal is worms, icon and name", sheet.primary.some(t => /🪱/.test(t) && /Worms/.test(t)),
    JSON.stringify(sheet.primary));
  check('its side foods stand in the secondary column', sheet.secondary.some(t => /Insects/.test(t)) && sheet.secondary.some(t => /Berries/.test(t)),
    JSON.stringify(sheet.secondary));
  check('the explainer paragraph and the Eats line are gone', !sheet.oldHint && !sheet.oldEats);
  check('no food row is highlighted or tagged', sheet.rows > 0 && sheet.highlighted === 0 && sheet.tagged === 0,
    sheet.rows + ' rows, ' + sheet.highlighted + ' glowing, ' + sheet.tagged + ' tagged');

  // ---- 5. The quiet dock: Stores dark, the Birds tab named and dark --------
  const dock = await page.evaluate(() => {
    window.__badgeSync && window.__badgeSync();
    const stores = document.querySelector('[data-quick-destination="inventory"], [data-game-route][data-screen="inventory"]');
    const birds = document.querySelector('[data-game-route][data-screen="birdex"]');
    return {
      storesBadge: stores ? stores.querySelectorAll('.nav-action-badge').length : -1,
      birdsBadge: birds ? birds.querySelectorAll('.nav-action-badge').length : -1,
      birdsLabel: birds ? (birds.querySelector('.nav-label') || {}).textContent : null,
      birdsAria: birds ? birds.getAttribute('aria-label') : null
    };
  });
  check('the Stores button carries no dot despite spare kit', dock.storesBadge === 0, JSON.stringify(dock));
  check('the Birds tab carries no dot despite a free bird', dock.birdsBadge === 0, JSON.stringify(dock));
  check('the tab reads Birds, not Burbz', dock.birdsLabel === 'Birds' && dock.birdsAria === 'Birds codex',
    dock.birdsLabel + ' / ' + dock.birdsAria);

  check('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? 'FAILED ' + failed + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
