#!/usr/bin/env node
// Browser evidence for empire-grid-v322-20260825: the Empire screen is a box
// of boxes. Boots the REAL game in Chromium, plants a save with five villages
// in five different states and a bird holding one of the desks, then proves:
//
//   - one square per village, no drop-down anywhere under the map,
//   - each square wears the colour of the one thing that village wants,
//   - the bird holding the Project Manager post is painted inside its square,
//     and an empty desk shows a greyed banner instead,
//   - COLLECT TAXES & PRODUCE renders ABOVE the boxes,
//   - one tap on a square opens that village, below the boxes.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_empire_grid_evidence.js
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
const SHOT = process.env.SHOT_PATH || '';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

// Six villages, one per colour the ladder can produce. Keyed by SEED, never
// by name: the game names a village from its own place-name table, so the
// names planted here are replaced on load and the seeds are the only handle.
const HOUR = 3600000;
function plantedVillages(now) {
  const village = (seed, lat, lon, pop, buildings, extra) => Object.assign({
    seed, name: 'Seed ' + seed, lat, lon,
    claimedAt: new Date(now - 40 * HOUR).toISOString(),
    liberatedAt: new Date(now - 40 * HOUR).toISOString(),
    lastTributeAt: now - 20 * HOUR,          // a whole cycle banked
    economy: Object.assign({ population: pop, buildings, constructions: [], ruins: [] }, extra || {})
  }, {});
  const building = id => ({ id, toLevel: 2, startMs: now - 60000, endMs: now + 8 * HOUR });
  return {
    // red — nobody lives here
    101: village(101, 51.50, -3.20, 0, {}),
    // red — homes but no food, no water, no cheer
    202: village(202, 51.52, -3.22, 12, { cabin: 3 }),
    // amber — comfortable, but nobody runs it
    303: village(303, 51.54, -3.24, 6, { cabin: 2, well: 2, hut: 2, tavern: 1 }),
    // blue — a manager, so two crews, and both of them idle
    404: village(404, 51.56, -3.26, 6, { cabin: 2, well: 2, hut: 2, tavern: 1 }),
    // green — a manager, and both crews at work
    505: village(505, 51.58, -3.28, 6, { cabin: 2, well: 2, hut: 2, tavern: 1 },
      { constructions: [building('cottages'), building('storehouse')] }),
    // gold — 16 folk, every need met, wearing the ⭐ merge star
    606: village(606, 51.60, -3.30, 16, { cabin: 3, cottages: 2, well: 3, hut: 3, tavern: 3 }),
    // Three neighbours that a signed charter merges into one Town.
    707: village(707, 51.70, -3.40, 16, { cabin: 3, cottages: 2, well: 3, hut: 3, tavern: 3 }),
    808: village(808, 51.702, -3.402, 16, { cabin: 3, cottages: 2, well: 3, hut: 3, tavern: 3 }),
    909: village(909, 51.704, -3.404, 16, { cabin: 3, cottages: 2, well: 3, hut: 3, tavern: 3 })
  };
}
const MANAGED = ['404', '505', '606'];
// Three neighbouring villages, already merged into one Town, so the 🏘️ TOWNS
// tier has a square of its own with a Lord Mayor's desk behind it.
const TOWN_SEEDS = [707, 808, 909];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

  // ---- boot once so the game writes a real save, then plant on top of it ---
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__burbzSizeRolesDebug, { timeout: 90000 });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  const planted = await page.evaluate(({ villages, managed, townSeeds }) => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.empire = state.empire || {};
    state.empire.villages = villages;
    state.empire.townCharters = [{ seeds: townSeeds, mergedAt: new Date().toISOString() }];
    state.empire.cityCharters = [];
    state.empire.regionCharters = [];
    // Two blackbirds and a robin. Blackbird because its cutout is one the
    // game ships under its own canonical name, so the square really has to
    // draw a picture; the robin is here to prove the square falls back to a
    // glyph exactly where every other bird picture in the game already does.
    const species = ['Blackbird', 'Blackbird', 'European Robin'];
    state.flock = managed.map((seed, i) => ({
      id: 'evidence-' + seed, species: species[i], commonName: species[i],
      customName: ['Pip', 'Wick', 'Bramble'][i], rarity: 'common',
      hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 180, cha: 170, stamina: 60,
      sizeScore: 18, level: 5
    }));
    const roles = { academy: {}, villages: {}, regions: {} };
    managed.forEach((seed, i) => { roles.villages[seed] = 'evidence-' + seed; });
    state.birdRoles = roles;
    state.lastVillage = null;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    return { villages: Object.keys(state.empire.villages).length, managed: managed.length, town: townSeeds.join('+') };
  }, { villages: plantedVillages(Date.now()), managed: MANAGED, townSeeds: TOWN_SEEDS });
  console.log('planted', JSON.stringify(planted));

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__burbzSizeRolesDebug, { timeout: 90000 });
  // Boot backfills each bird's art after the first paint. A real player is
  // long past that by the time they open the Empire screen, so wait for it
  // rather than racing it — otherwise the first render of ANY bird picture in
  // the game, this one included, falls back to its emoji for one frame.
  // `every` on an empty array is vacuously true, so wait for the flock to be
  // there AND resolved — not merely for it to be absent.
  await page.waitForFunction(
    n => { const f = window.__burbzSizeRolesDebug.flock() || []; return f.length === n && f.every(b => !!b.artUrl); },
    MANAGED.length, { timeout: 60000 });

  // ---- get past the intro cutscene, then open the Empire screen -----------
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove());
    if (typeof window.switchScreen === 'function') window.switchScreen('village');
  });
  await page.waitForSelector('#empirePanel .empire-tile', { timeout: 30000 });
  await page.waitForTimeout(600);
  // Boot paints the panel once, then backfills every bird's art and saves.
  // A planted save has no art on it yet, so that first paint can beat the
  // backfill and fall back to emoji — as EVERY bird picture in the game does
  // on its first frame. Redraw once, exactly as any state change would, and
  // read the steady state the player actually sits in front of.
  await page.evaluate(() => window.__burbzSettlementsDebug.ledger());
  await page.waitForTimeout(200);

  const read = await page.evaluate(() => {
    // Redraw first, so everything below is read from ONE draw. Background
    // tickers redraw the panel on their own schedule; without this the listing
    // and the checks could describe two different frames.
    window.__burbzSettlementsDebug.ledger();
    const panel = document.getElementById('empirePanel');
    const villageTier = panel.querySelector('[data-empire-tier="tier-villages"]');
    const tiles = [...villageTier.querySelectorAll('.empire-tile')].map(el => ({
      name: (el.querySelector('.empire-tile-name') || {}).textContent || '',
      cls: el.className,
      label: el.getAttribute('aria-label') || '',
      need: (el.querySelector('.empire-tile-need') || {}).textContent || '',
      coin: !!el.querySelector('.empire-tile-coin'),
      seed: el.dataset.seed || '',
      bird: el.querySelector('img.empire-tile-bird') ? 'img'
        : el.querySelector('span.empire-tile-bird.is-vacant') ? 'vacant'
        : el.querySelector('span.empire-tile-bird') ? 'glyph' : 'none',
      box: (r => ({ w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top) }))(el.getBoundingClientRect())
    }));
    const chest = panel.querySelector('.empire-tribute-btn');
    const grid = villageTier.querySelector('.empire-grid');
    return {
      tiles,
      tierLabels: [...panel.querySelectorAll('.empire-tier-label')].map(e => e.textContent),
      townTier: (() => {
        const section = panel.querySelector('[data-empire-tier="tier-towns"]');
        if (!section) return null;
        const tile = section.querySelector('.empire-tile');
        return tile ? {
          count: section.querySelectorAll('.empire-tile').length,
          cls: tile.className, label: tile.getAttribute('aria-label') || '',
          settlement: tile.dataset.settlement || '', action: tile.dataset.action || ''
        } : { count: 0 };
      })(),
      tierCopy: [...panel.querySelectorAll('.empire-tier-copy')].map(e => e.textContent),
      keyDots: panel.querySelectorAll('.egk-dot').length,
      chestTop: chest ? Math.round(chest.getBoundingClientRect().top) : null,
      chestText: chest ? chest.textContent.trim() : null,
      gridTop: grid ? Math.round(grid.getBoundingClientRect().top) : null,
      drawers: panel.querySelectorAll('details').length,
      panelBottom: Math.round(panel.getBoundingClientRect().bottom),
      hubTop: Math.round(document.getElementById('empireVillageHub').getBoundingClientRect().top),
      // Same bird, two surfaces: the square, and the appointment card the
      // village desk has always shown. Both are read from a FRESH draw in
      // this same tick, so a background ticker redrawing the panel between
      // Playwright calls cannot decide the answer.
      art: (() => {
        const tag = html => /^\s*<img/.test(html) ? 'img' : /is-vacant/.test(html) ? 'vacant' : 'glyph';
        const holder = seed => {
          const card = window.__burbzSizeRolesDebug.postCardHTML('village', seed);
          return tag((card.match(/<(?:img|span)[^>]*role-holder-art[^>]*>/) || [''])[0]);
        };
        const square = seed => tag(document.querySelector('.empire-tile[data-seed="' + seed + '"] .empire-tile-art').innerHTML);
        return {
          blackbirdTile: square('404'), blackbirdCard: holder('404'),
          robinTile: square('606'), robinCard: holder('606'),
          vacantTile: square('303')
        };
      })()
    };
  });

  const bySeed = seed => read.tiles.find(t => t.seed === String(seed)) || {};

  console.log('\n--- the boxes ---');
  read.tiles.forEach(t => console.log('  #' + t.seed.padEnd(4), t.name.padEnd(14),
    t.cls.replace('empire-tile ', '').padEnd(22), t.need, t.coin ? '💰' : '  ',
    t.bird.padEnd(7), t.box.w + 'x' + t.box.h, '|', t.label));

  console.log('\n--- checks ---');
  // The local static server has no /burbz/ prefix and LFS art is not hydrated
  // here, so image 404s are the container, not the page. Script errors are not.
  const NETWORK_NOISE = /Failed to load resource|AJAXError|openfreemap|tiles\.|maplibre/i;
  const realErrors = errors.filter(e => !NETWORK_NOISE.test(e));
  check('no page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' / '));
  check('one square per village', read.tiles.length === 6, read.tiles.length + ' squares');
  check('the squares are square', read.tiles.every(t => Math.abs(t.box.w - t.box.h) <= 1),
    read.tiles.map(t => t.box.w + 'x' + t.box.h).join(' '));
  check('nothing under the map unfolds', read.drawers === 0, read.drawers + ' <details>');
  check('the tier is titled VILLAGES', read.tierLabels.includes('VILLAGES'), read.tierLabels.join(','));
  check('the tier still teaches the ladder', read.tierCopy.some(c => c.includes('merge star')), read.tierCopy.join(' | '));
  check('the colour key has five dots', read.keyDots === 5, read.keyDots + ' dots');

  // ---- one colour per thing a village can want ----------------------------
  check('an empty village is red', bySeed(101).cls.includes('is-red'), bySeed(101).label);
  check('a hungry village is red', bySeed(202).cls.includes('is-red'), bySeed(202).label);
  check('a village with no manager is violet', bySeed(303).cls.includes('is-violet'), bySeed(303).label);
  check('a village with idle crews is blue', bySeed(404).cls.includes('is-blue'), bySeed(404).label);
  check('a village being built in is green', bySeed(505).cls.includes('is-green'), bySeed(505).label);
  check('a village wearing the merge star is gold', bySeed(606).cls.includes('is-gold'), bySeed(606).label);
  check('every colour is on screen at once',
    new Set(read.tiles.map(t => (t.cls.match(/is-(red|amber|gold|blue|green)/) || [])[1])).size === 5,
    read.tiles.map(t => t.cls.replace('empire-tile ', '')).join(' | '));

  // ---- the bird in the square ---------------------------------------------
  check('a shipped cutout really lands in the square', read.art.blackbirdTile === 'img',
    JSON.stringify(read.art));
  // The square draws its bird with the same helper the appointment card has
  // always used, so both surfaces must resolve any given species identically.
  check('the square draws a bird exactly like the appointment card does',
    read.art.blackbirdTile === read.art.blackbirdCard && read.art.robinTile === read.art.robinCard,
    JSON.stringify(read.art));
  check('an empty desk is a greyed banner, never a bird', read.art.vacantTile === 'vacant', read.art.vacantTile);
  check('a managed village names its bird', bySeed(404).label.includes('Pip'), bySeed(404).label);
  check('an empty desk says so', bySeed(303).label.includes('No Project Manager'), bySeed(303).label);
  check('a full strongbox shows a coin', read.tiles.filter(t => t.coin).length >= 5,
    read.tiles.filter(t => t.coin).length + ' coins');

  check('the tax chest is above the boxes', read.chestTop !== null && read.chestTop < read.gridTop,
    'chest ' + read.chestTop + ' vs grid ' + read.gridTop);
  check('the chest reads COLLECT TAXES & PRODUCE', (read.chestText || '').includes('COLLECT TAXES & PRODUCE'), read.chestText);
  // ---- the same treatment, one rung up --------------------------------------
  check('a merged Town gets a square of its own', !!read.townTier && read.townTier.count === 1,
    JSON.stringify(read.townTier));
  check('the Town square is coloured by what the town wants',
    !!read.townTier && /is-(red|violet|gold|blue|green)/.test(read.townTier.cls || ''), (read.townTier || {}).cls);
  check("the Town square names the Lord Mayor's desk",
    !!read.townTier && (read.townTier.label || '').includes('Lord Mayor'), (read.townTier || {}).label);
  check('the Town square opens its Town Hall',
    !!read.townTier && read.townTier.action === 'empire-settlement' && !!read.townTier.settlement,
    JSON.stringify(read.townTier));

  check('the village opens below the boxes', read.hubTop >= read.panelBottom - 2,
    'hub ' + read.hubTop + ' vs panel bottom ' + read.panelBottom);

  // ---- one tap opens the village ------------------------------------------
  await page.click('.empire-tile[data-seed="303"]', { timeout: 15000 });
  await page.waitForTimeout(1600);
  const opened = await page.evaluate(() => ({
    title: (document.getElementById('villageTitle') || {}).textContent || '',
    expected: (window.__burbzSettlementsDebug ? '' : ''),
    active: [...document.querySelectorAll('#empirePanel .empire-tile.is-active')].map(el => el.dataset.seed),
    hubHidden: !!(document.getElementById('empireVillageHub') || {}).hidden
  }));
  check('one tap opened that village', opened.title.toUpperCase().includes(bySeed(303).name.toUpperCase()),
    opened.title + ' vs square ' + bySeed(303).name);
  check('its square is marked active', opened.active.includes('303'), JSON.stringify(opened.active));
  check('the village hub is showing', !opened.hubHidden, String(opened.hubHidden));
  check('still no page errors after the tap', errors.filter(e => !NETWORK_NOISE.test(e)).length === 0,
    errors.filter(e => !NETWORK_NOISE.test(e)).slice(0, 3).join(' / '));

  if (SHOT) {
    await page.evaluate(() => document.getElementById('empirePanel').scrollIntoView({ block: 'start' }));
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT });
    console.log('\nscreenshot: ' + SHOT);
  }

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  if (failed.length) { console.error('FAILED: ' + failed.map(f => f.name).join('; ')); process.exit(1); }
})().catch(err => { console.error(err); process.exit(1); });
