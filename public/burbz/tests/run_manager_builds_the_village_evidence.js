#!/usr/bin/env node
// Browser evidence for manager-builds-the-village-v324-20260825: appoint a bird
// as a village's Project Manager and it builds the village on its own. Boots the
// REAL game in Chromium, plants two villages — one with a robin at the desk
// since two days ago, one with nobody — and proves:
//
//   - the managed village has raised every one of its buildings by itself,
//   - the unmanaged village has raised nothing and spent nothing,
//   - one line, not twenty, tells the player what the bird did,
//   - the village desk names the bird, the count and the time left,
//   - the appointment sheet says how long each candidate would take,
//   - a site the manager's crew is on is labelled as theirs.
//
// Run it (playwright-core + a Chromium build are the only requirements). Serve
// from public/, not public/burbz/: several of the game's own asset paths are
// absolute under /burbz/ and 404 from any other root.
//   cd public && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/burbz/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_manager_builds_the_village_evidence.js
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

const URL = process.env.BURBZ_URL || 'http://127.0.0.1:8765/burbz/index.html';
const EXE = process.env.CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOT = process.env.SHOT_PATH || '';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

const HOUR = 3600000;
const MANAGED_SEED = 4242;   // a grandmaster songbird took this desk 8 hours ago
const EMPTY_SEED = 5353;     // nobody runs this one

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const errors = [];
  // The map tiles live on the open internet; a sandbox with no network is not
  // a broken game. Everything else is a real error.
  const offlineNoise = text => /openfreemap|AJAXError|Failed to fetch/.test(text);
  page.on('pageerror', e => { const t = String((e && e.message) || e); if (!offlineNoise(t)) errors.push(t); });
  // Resource 404s are the static server's business, not the page's: the game
  // ships art it fetches best-effort. Only real script errors count here.
  page.on('console', m => {
    if (m.type() !== 'error') return;
    if (/Failed to load resource/.test(m.text()) || offlineNoise(m.text())) return;
    errors.push('console: ' + m.text());
  });

  // ---- boot once so the game writes a real save, then plant on top of it ---
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__burbzSizeRolesDebug, { timeout: 90000 });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  const planted = await page.evaluate(({ managedSeed, emptySeed, hour }) => {
    const now = Date.now();
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    const village = (seed, lat, lon) => ({
      seed, name: 'Seed ' + seed, lat, lon,
      claimedAt: new Date(now - 40 * hour).toISOString(),
      liberatedAt: new Date(now - 40 * hour).toISOString(),
      lastTributeAt: now,
      economy: { population: 0, buildings: {}, constructions: [], ruins: [], stores: { food: 60, water: 60 }, lastSimAt: now }
    });
    state.empire = state.empire || {};
    const managed = village(managedSeed, 51.50, -3.20);
    // The contract was signed two days ago and the player has not looked since.
    // The robin the game generates is an UNTRAINED robin — the species' own INT
    // and CHA — so its village takes about 42 hours, not the grandmaster's six.
    managed.economy.managerFrom = now - 48 * hour;
    state.empire.villages = { [managedSeed]: managed, [emptySeed]: village(emptySeed, 51.90, -3.90) };
    state.empire.townCharters = [];
    state.empire.cityCharters = [];
    state.empire.regionCharters = [];
    // Yaan's bird, exactly: fully intelligent, high charisma, songbird-sized.
    // Plus a heavy, dull buzzard so the sheet has two very different answers.
    state.flock = [
      { id: 'evidence-robin', species: 'European Robin', commonName: 'European Robin', customName: 'Pip',
        rarity: 'common', hp: 60, maxHp: 60, atk: 40, def: 40, spd: 60, int: 250, cha: 250, stamina: 60,
        sizeScore: 12, level: 8 },
      { id: 'evidence-buzzard', species: 'Common Buzzard', commonName: 'Common Buzzard', customName: 'Grim',
        rarity: 'common', hp: 120, maxHp: 120, atk: 90, def: 80, spd: 50, int: 60, cha: 40, stamina: 80,
        sizeScore: 70, level: 8 }
    ];
    state.birdRoles = { academy: {}, villages: { [managedSeed]: 'evidence-robin' }, regions: {} };
    state.player = state.player || {};
    state.player.level = 12;
    state.player.coins = 5000;
    state.player.branches = 5000;
    state.player.stone = 500;
    state.lastVillage = null;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    return { coins: state.player.coins, branches: state.player.branches };
  }, { managedSeed: MANAGED_SEED, emptySeed: EMPTY_SEED, hour: HOUR });
  console.log('planted', JSON.stringify(planted));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__burbzSizeRolesDebug, { timeout: 90000 });
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove());
    if (typeof window.switchScreen === 'function') window.switchScreen('village');
  });
  await page.waitForSelector('#empirePanel .empire-tile', { timeout: 30000 });
  await page.waitForTimeout(800);

  // ---- 1. the managed village built itself; the empty one did not ---------
  const built = await page.evaluate(({ managedSeed, emptySeed }) => {
    window.__burbzSettlementsDebug.ledger();      // one draw, one reading
    const snap = seed => window.__burbzSettlementsDebug.snapshot(seed);
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    const eco = seed => state.empire.villages[String(seed)].economy;
    return {
      managed: eco(managedSeed),
      empty: eco(emptySeed),
      managedPop: snap(managedSeed).pop,
      wallet: { coins: state.player.coins, branches: state.player.branches }
    };
  }, { managedSeed: MANAGED_SEED, emptySeed: EMPTY_SEED });

  const VILLAGE_TIER = ['cabin', 'hut', 'well', 'lumberhut', 'minehut', 'cottages', 'tavern', 'storehouse'];
  const raised = VILLAGE_TIER.filter(id => (built.managed.buildings[id] || 0) > 0);
  check('the managed village raised every one of its buildings on its own',
    raised.length === VILLAGE_TIER.length, raised.length + '/' + VILLAGE_TIER.length + ' — ' + raised.join(', '));
  check('…and folk have moved into them', built.managedPop > 0, built.managedPop + ' residents');
  check('…and the bird is already on the next site',
    built.managed.constructions.some(c => c.by === 'manager'),
    JSON.stringify(built.managed.constructions.map(c => c.id + (c.by ? ' (' + c.by + ')' : ''))));
  check('the village with no manager raised nothing',
    Object.values(built.empty.buildings).every(v => !v) && !built.empty.constructions.length,
    JSON.stringify(built.empty.buildings));
  check('the manager paid for the work out of the purse',
    built.wallet.coins < 5000 && built.wallet.branches < 5000,
    built.wallet.coins + ' 🪙 · ' + built.wallet.branches + ' 🪵 left of 5000/5000');
  check('no town-tier industry was touched in a lone village',
    ['farm', 'chapel', 'lumber', 'quarry', 'market', 'foundry', 'entertainment']
      .every(id => !(built.managed.buildings[id] || 0)));

  // ---- 2. one line tells the player what happened -------------------------
  const toastText = await page.evaluate(() =>
    [...document.querySelectorAll('.toast, .toast-stack .toast, [class*="toast"]')].map(el => el.textContent.trim()));
  const noticeText = await page.evaluate(() =>
    [...document.querySelectorAll('.completion-notice')].map(el => el.textContent.replace(/\s+/g, ' ').trim()));
  check('one corner card, not one per building', noticeText.length <= 1, JSON.stringify(noticeText));
  console.log('  toasts on screen: ' + JSON.stringify(toastText));

  // ---- 3. the village desk says who is building and how far along ---------
  const desk = await page.evaluate(seed => {
    // The desk renders for whichever village is open; open it the way a tap does.
    const tile = document.querySelector('.empire-tile[data-seed="' + seed + '"]');
    if (tile) tile.click();
    return new Promise(resolve => setTimeout(() => {
      const panel = document.getElementById('villageManagePanel');
      const text = panel ? panel.textContent.replace(/\s+/g, ' ').trim() : '';
      resolve({
        text,
        crewTag: !!panel && !!panel.querySelector('.province-construction-crew'),
        crewTagText: panel && panel.querySelector('.province-construction-crew')
          ? panel.querySelector('.province-construction-crew').textContent.trim() : '',
        row: !!panel && !!panel.querySelector('.role-post-row')
      });
    }, 900));
  }, MANAGED_SEED);
  check('the desk names the bird and what it is doing',
    /Pip .*is building|Pip .*has .* built|Pip .*is finished|Pip .*raised everything/.test(desk.text),
    (desk.text.match(/📋[^.]*\./) || [''])[0]);
  check('the site under way is labelled as the manager’s crew', desk.crewTag, desk.crewTagText);
  check('the Project Manager row is still one tap to the sheet', desk.row);

  // ---- 4. the appointment sheet prices every candidate in hours -----------
  const sheet = await page.evaluate(seed => {
    const html = window.__burbzSizeRolesDebug.sheetHTML('village', String(seed), '');
    const clocks = [...html.matchAll(/role-candidate-clock">([^<]*)</g)].map(m => m[1]);
    const academy = window.__burbzSizeRolesDebug.sheetHTML('academy', 'library', '');
    return { clocks, academyHasClock: /role-candidate-clock/.test(academy), copy: /builds the whole village on its own/.test(html) };
  }, MANAGED_SEED);
  check('every row in the village sheet says how long that bird would take',
    sheet.clocks.length >= 2, JSON.stringify(sheet.clocks));
  // The robin the game generates is an UNTRAINED robin: the species' own INT and
  // CHA, not a grandmaster's. It still beats the buzzard outright.
  const hours = c => (/([\d.]+) days/.test(c) ? parseFloat(RegExp.$1) * 24 : parseFloat(c.match(/([\d.]+)h/)[1]));
  check('the untrained songbird already beats the heavy bird of prey',
    hours(sheet.clocks[0]) < hours(sheet.clocks[1]),
    sheet.clocks.join('  vs  '));
  // …and a bird that HAS spent its days in the Library and its nights in the
  // Crowbar hits Yaan's six hours, in the real page.
  const trained = await page.evaluate(seed => {
    const bird = window.__burbzSizeRolesDebug.flock().find(b => b.id === 'evidence-robin');
    bird.int = 250; bird.cha = 250;
    const html = window.__burbzSizeRolesDebug.sheetHTML('village', String(seed), '');
    return (html.match(/role-holder-effect[\s\S]*?role-candidate-clock">([^<]*)</) || [, ''])[1];
  }, MANAGED_SEED);
  check('a Library-and-Crowbar songbird builds the village in six hours',
    /\b6h\b/.test(trained), trained);
  check('an Academy post says nothing about villages', !sheet.academyHasClock);
  check('the sheet explains that the bird builds the village', sheet.copy);

  // ---- 5. the game booted clean -------------------------------------------
  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  if (SHOT) { await page.screenshot({ path: SHOT, fullPage: false }); console.log('screenshot → ' + SHOT); }
  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
