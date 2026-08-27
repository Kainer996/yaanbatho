#!/usr/bin/env node
// Browser evidence for kitchen-clean-table-v333-20260827. Boots the REAL game
// in Chromium, plants a flock (one bird wearing its species name, one
// renamed, one full), opens the Kitchen and proves:
//
//   - the feeding table does not scroll inside the screen (no inner
//     scrollbox: the list's scroll height equals its client height),
//   - a bird named by its species shows its name ONCE,
//   - a renamed bird still shows its species underneath,
//   - the full bird's bar carries no "optional top-ups" caption,
//   - zero page errors.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_kitchen_clean_table_evidence.js
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
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  // Fresh containers hold LFS pointers for art and no route to the tile host;
  // resource failures are the environment's. Script errors stay fatal.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    const bird = (id, common, extra) => Object.assign({
      id, species: common, commonName: common, rarity: 'common',
      hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 40, cha: 40, stamina: 60, level: 3
    }, extra || {});
    state.flock = [
      // Wears its species name — the line under the name must vanish.
      bird('crow', 'Carrion Crow', { care: { hunger: 55 } }),
      // Renamed — the species stays underneath.
      bird('pip', 'European Robin', { customName: 'Pip', care: { hunger: 55 } }),
      // Completely full — its bar must carry no caption.
      bird('full', 'Great Tit', { care: { hunger: 0 } })
    ];
    localStorage.setItem('burbz_state', JSON.stringify(state));
  });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove());
    // The player's own road in: the Kitchen button on the dock.
    document.querySelector('[data-quick-destination="kitchen"]').click();
  });
  await page.waitForSelector('.kitchen-roster-list .kitchen-roster-row', { timeout: 30000 });
  await page.waitForTimeout(600);

  const read = await page.evaluate(() => {
    const list = document.querySelector('.kitchen-roster-list');
    const style = getComputedStyle(list);
    const rows = {};
    document.querySelectorAll('.kitchen-roster-row').forEach(row => {
      const key = row.getAttribute('data-kitchen-roster-bird');
      rows[key] = {
        name: (row.querySelector('.kitchen-roster-name') || {}).textContent || '',
        species: row.querySelector('.kitchen-roster-species') ? row.querySelector('.kitchen-roster-species').textContent : null,
        note: row.querySelector('.bird-hunger-note') ? row.querySelector('.bird-hunger-note').textContent : null
      };
    });
    return {
      overflowY: style.overflowY,
      maxHeight: style.maxHeight,
      innerScroll: list.scrollHeight - list.clientHeight,
      rows,
      pageHasOldCopy: document.body.textContent.includes('optional top-ups still use one ingredient')
    };
  });

  check('the list is not its own scrollbox', read.overflowY === 'visible' && read.maxHeight === 'none',
    'overflow-y=' + read.overflowY + ', max-height=' + read.maxHeight);
  check('the list holds nothing it hides', read.innerScroll === 0, read.innerScroll + 'px hidden');
  const crow = read.rows['crow'] || {}, pip = read.rows['pip'] || {}, full = read.rows['full'] || {};
  check('a species-named bird says its name once', /Carrion Crow/.test(crow.name) && crow.species === null,
    JSON.stringify({ name: crow.name.trim(), species: crow.species }));
  // The game canonicalises "European Robin" to its own name for the species,
  // "Robin" — the check is that a species line stands at all under a nickname.
  check('a renamed bird keeps its species underneath', /Pip/.test(pip.name) && /Robin/.test(pip.species || ''),
    JSON.stringify({ name: pip.name.trim(), species: pip.species }));
  check('Merlin keeps his Latin line', (read.rows['merlin'] || {}).species === 'Falco columbarius · permanent companion');
  check('a full bird\'s bar carries no caption', full.note === null, JSON.stringify(full.note));
  check('a hungry bird keeps its working caption', typeof crow.note === 'string' && crow.note.length > 0, JSON.stringify(crow.note));
  check('the old copy is gone from the page', read.pageHasOldCopy === false);
  check('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? 'FAILED ' + failed + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
