#!/usr/bin/env node
// Browser evidence for gentle-start-v338-20260831. Boots the REAL game in
// Chromium four times and proves:
//
//   A. a brand-new save meets a dock of four: Map, Quests, Empire, Scan —
//      the top deck is folded (body.dock-compact), the Birds/Battle pair,
//      Forge, Stores, Ranks, Kitchen, Training, Hospital and the diary
//      quill are all off screen, and the Quests screen carries no Daily /
//      Weekly / Achievements / walking boards yet,
//   B. mid-chain, a REAL tap on the chain's gold CLAIM (Quest Roost link)
//      makes the Forge and the Stores step onto the dock in the same
//      breath, with the unlock pop — while Battle stays away,
//   C. a level-12 save (the old early-game line) sees the full dock and
//      every quest board — a veteran's game is untouched,
//   D. on a real village desk the build order reads as two lines — the
//      action, then unbreakable cost chips (no chip ever wraps inside
//      itself, no "0 🪨" chip exists) — the income line is a short number
//      with a little eye, and tapping the eye opens and closes its note,
//   E. zero page errors across all four boots.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_gentle_start_evidence.js
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
const SHOTS = process.env.BURBZ_SHOT_DIR || '';

const CHAPTER_KEY = 'burbzTutorialChapters:merlin-interactive-flow-v7-20260728';
const CHAIN_TO_ROOST = [
  'pq_open_empire', 'pq_liberate', 'pq_first_bird', 'pq_expedition',
  'pq_claim_errand', 'pq_build_barracks', 'pq_recruit', 'pq_true_diet',
  'pq_preen', 'pq_build_training', 'pq_training_drill',
];

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

async function newPage(context, errors) {
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });
  return page;
}

async function bootFresh(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });
}

function dockSnapshot() {
  const items = {};
  document.querySelectorAll('[data-game-route][data-screen],[data-quick-destination]').forEach(el => {
    if (!el.closest('#bottomDock') && !el.classList.contains('header-diary-btn')) return;
    const key = el.getAttribute('data-quick-destination') || el.getAttribute('data-screen');
    items[key] = !el.hidden;
  });
  const topRow = document.querySelector('#bottomNav .dock-row-top');
  return {
    items,
    topRowHidden: !!(topRow && topRow.hidden),
    compact: document.body.classList.contains('dock-compact'),
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const errors = [];

  // ---- A. A brand-new save meets a dock of four ----------------------------
  {
    const page = await newPage(context, errors);
    await bootFresh(page);
    const dock = await page.evaluate(dockSnapshot);
    const open = ['map', 'quests', 'village', 'scan'];
    const shut = ['academy', 'birdex', 'battle', 'forge', 'inventory', 'leaderboards', 'kitchen', 'training', 'hospital', 'diary'];
    check('A: the four essentials stand on the dock', open.every(k => dock.items[k] === true), JSON.stringify(dock.items));
    check('A: the nine later destinations wait off screen', shut.every(k => dock.items[k] === false));
    check('A: the empty top deck is folded and the dock is one row', dock.topRowHidden && dock.compact);

    await page.evaluate(() => {
      document.querySelectorAll('.intro-cutscene-overlay, .merlin-tutorial-overlay').forEach(el => el.remove());
      window.switchScreen('quests');
    });
    await page.waitForSelector('#playerQuestsList .player-quest-card', { timeout: 30000 });
    const boards = await page.evaluate(() => ({
      text: document.getElementById('questsList').textContent,
      walking: document.getElementById('walkingQuestsList').innerHTML.trim(),
      chainCard: !!document.querySelector('#playerQuestsList .player-quest-card'),
      errandBoard: document.getElementById('screen-quests').textContent.includes('Kingdom Errands'),
    }));
    check('A: no Daily / Weekly / Achievements boards yet', !/Daily Quests|Weekly Quests|Achievements/.test(boards.text));
    check('A: no walking boards yet', boards.walking === '');
    check('A: the chain card and the errand board still greet the player', boards.chainCard && boards.errandBoard);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/a-fresh-quests.png' });
    await page.close();
  }

  // ---- B. The gold CLAIM opens the Forge and the Stores in one breath ------
  {
    const page = await newPage(context, errors);
    await bootFresh(page);
    await page.evaluate(({ CHAPTER_KEY, CHAIN_TO_ROOST }) => {
      const state = JSON.parse(localStorage.getItem('burbz_state'));
      state.quests = state.quests || {};
      CHAIN_TO_ROOST.forEach(id => { state.quests[id] = { progress: 1, claimed: true }; });
      state.academyBuildings = Object.assign({}, state.academyBuildings, {
        tavern: { built: true }, training: { built: true }, quest_roost: { built: true },
      });
      state.flock = [{
        id: 'pip', species: 'European Robin', commonName: 'European Robin', rarity: 'common',
        hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 40, cha: 40, stamina: 60, level: 4,
      }];
      state.player.level = 5;
      state.player.empireMapOpens = 1;
      state.tutorialFlow = Object.assign({}, state.tutorialFlow, { errandClaimed: true });
      localStorage.setItem('burbz_state', JSON.stringify(state));
      localStorage.setItem(CHAPTER_KEY, JSON.stringify(['story', 'quests', 'errand', 'academy', 'academy_tour']));
    }, { CHAPTER_KEY, CHAIN_TO_ROOST });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
    await page.waitForFunction(() => {
      const academy = document.querySelector('[data-game-route][data-screen="academy"]');
      return academy && !academy.hidden;
    }, { timeout: 30000 });

    const before = await page.evaluate(dockSnapshot);
    check('B: mid-chain the Academy stands, the Forge and Stores wait',
      before.items.academy === true && before.items.forge === false && before.items.inventory === false && before.items.battle === false,
      JSON.stringify(before.items));

    await page.evaluate(() => {
      document.querySelectorAll('.intro-cutscene-overlay, .merlin-tutorial-overlay').forEach(el => el.remove());
      window.switchScreen('quests');
    });
    // The Quest Roost link is complete (the Roost stands) — a real tap on
    // the real gold CLAIM.
    await page.waitForSelector('[data-player-quest-claim="pq_build_quest_roost"]', { timeout: 30000 });
    if (SHOTS) await page.screenshot({ path: SHOTS + '/b-claim-moment.png' });
    // The gold CLAIM pulses forever, so Playwright's stability wait never
    // settles — dispatch the same click straight at the button.
    await page.$eval('[data-player-quest-claim="pq_build_quest_roost"]', el => el.click());
    await page.waitForFunction(() => {
      const forge = document.querySelector('[data-game-route][data-screen="forge"]');
      const stores = document.querySelector('[data-game-route][data-screen="inventory"]');
      return forge && !forge.hidden && stores && !stores.hidden;
    }, { timeout: 15000 });
    const after = await page.evaluate(dockSnapshot);
    check('B: the CLAIM tap walks the Forge and the Stores onto the dock',
      after.items.forge === true && after.items.inventory === true);
    check('B: Battle still waits its turn', after.items.battle === false);
    check('B: the top deck unfolds the moment it has a button', after.topRowHidden === false && after.compact === false);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/b-after-claim.png' });
    await page.close();
  }

  // ---- C. A veteran's game is untouched ------------------------------------
  {
    const page = await newPage(context, errors);
    await bootFresh(page);
    await page.evaluate(() => {
      const state = JSON.parse(localStorage.getItem('burbz_state'));
      state.player.level = 12; // the old early-game line
      localStorage.setItem('burbz_state', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
    const dock = await page.evaluate(dockSnapshot);
    const all = ['map', 'quests', 'village', 'scan', 'academy', 'birdex', 'battle', 'forge', 'inventory', 'leaderboards', 'kitchen', 'training', 'hospital', 'diary'];
    check('C: level 12 stands the whole dock up', all.every(k => dock.items[k] === true), JSON.stringify(dock.items));
    check('C: two rows, nothing folded', dock.topRowHidden === false && dock.compact === false);
    await page.evaluate(() => {
      document.querySelectorAll('.intro-cutscene-overlay, .merlin-tutorial-overlay').forEach(el => el.remove());
      window.switchScreen('quests');
    });
    await page.waitForFunction(() => /Daily Quests/.test(document.getElementById('questsList').textContent), { timeout: 30000 });
    const boards = await page.evaluate(() => document.getElementById('questsList').textContent);
    check('C: Daily, Weekly and Achievements boards all render', /Daily Quests/.test(boards) && /Weekly Quests/.test(boards) && /Achievements/.test(boards));
    await page.close();
  }

  // ---- D. The village desk: two-line orders, unbreakable chips, the eye ----
  {
    const page = await newPage(context, errors);
    await bootFresh(page);
    await page.evaluate(() => {
      const now = Date.now();
      const state = JSON.parse(localStorage.getItem('burbz_state'));
      state.player.level = 12;
      state.player.coins = 5000;
      state.player.branches = 5000;
      state.player.stone = 0;
      state.empire = state.empire || {};
      state.empire.villages = {
        777001: {
          seed: 777001, name: 'Evidence Green', lat: 51.5, lon: -3.2,
          claimedAt: new Date(now - 86400000).toISOString(),
          liberatedAt: new Date(now - 86400000).toISOString(),
          lastTributeAt: now,
          economy: {
            population: 6, buildings: { cabin: 1, well: 1 }, constructions: [], ruins: [],
            stores: { food: 60, water: 60 }, lastSimAt: now,
          },
        },
      };
      state.empire.townCharters = [];
      state.empire.regionCharters = [];
      state.lastVillage = null;
      localStorage.setItem('burbz_state', JSON.stringify(state));
    });
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
    await page.evaluate(() => {
      document.querySelectorAll('.intro-cutscene-overlay, .merlin-tutorial-overlay').forEach(el => el.remove());
      window.switchScreen('village');
    });
    await page.waitForSelector('#empirePanel .empire-tile', { timeout: 30000 });
    await page.evaluate(() => { document.querySelector('.empire-tile[data-seed="777001"]').click(); });
    await page.waitForSelector('.province-build-btn .build-cost-row', { timeout: 30000 });

    const desk = await page.evaluate(() => {
      const bits = [...document.querySelectorAll('.province-build-btn .build-cost-bit')];
      const broken = bits.filter(b => b.getClientRects().length > 1).map(b => b.textContent);
      const zeroStone = bits.some(b => /^0\s*🪨/.test(b.textContent.trim()));
      const acts = document.querySelectorAll('.province-build-btn .build-btn-act').length;
      const income = document.querySelector('.province-income-line');
      const dot = income && income.querySelector('.info-dot');
      const note = document.getElementById('infoNoteVillageIncome');
      return {
        bitCount: bits.length, broken, zeroStone, acts,
        incomeText: income ? income.textContent.trim() : null,
        incomeShort: !!income && income.textContent.trim().length < 90,
        dotThere: !!dot, noteHidden: !!note && note.hidden,
      };
    });
    check('D: every build order carries its action line and its bill', desk.acts > 0 && desk.bitCount > 0, desk.acts + ' actions, ' + desk.bitCount + ' chips');
    check('D: no chip ever breaks in half', desk.broken.length === 0, JSON.stringify(desk.broken));
    check('D: a cost of zero says nothing — no "0 🪨" chip', desk.zeroStone === false);
    check('D: the income line is a short number with an eye', desk.incomeShort && desk.dotThere && desk.noteHidden, JSON.stringify(desk.incomeText));

    await page.click('.province-income-line .info-dot');
    const opened = await page.evaluate(() => {
      const note = document.getElementById('infoNoteVillageIncome');
      return { visible: !!note && !note.hidden, text: note ? note.textContent : '' };
    });
    check('D: the eye opens its note', opened.visible && /taxes every 8 hours/.test(opened.text));
    await page.click('.province-income-line .info-dot');
    const closed = await page.evaluate(() => document.getElementById('infoNoteVillageIncome').hidden);
    check('D: the eye puts the note away again', closed === true);
    if (SHOTS) await page.screenshot({ path: SHOTS + '/d-village-desk.png' });
    await page.close();
  }

  check('E: zero page errors across all four boots', errors.length === 0, errors.slice(0, 4).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(failed.length ? 'FAILED ' + failed.length + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
