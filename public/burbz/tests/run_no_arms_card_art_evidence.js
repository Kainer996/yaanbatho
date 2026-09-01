#!/usr/bin/env node
// Browser evidence for no-arms-card-art-v340-20260901. Boots the REAL game in
// Chromium with two companions side by side:
//
//   - a European Robin, whose original painting draws it holding a sword in a
//     wing-hand (one of the 37 the audit flagged) — its card must show the
//     armless warrior cutout standing on the habitat backdrop: img class
//     card-art-cutout, warrior-cutout src, NO blurred wash, and the card's
//     own .card-art-bg painted with a habitat scene;
//   - a Wren, whose original painting is armless — its card must be exactly
//     what it was before this release: the original painting plus its wash.
//
// The robin's info sheet gets the same treatment, and the Birdex preview card
// route shares birdCardImgAttrs so the companions grid stands for both.
//
// The repo's art rasters are LFS pointers in fresh containers, so every
// /bird-art-cache/ request is fulfilled from the live site (yaanbatho.com
// serves byte-identical files) — that lets the checks assert real decoded
// pixels (naturalWidth) and take a screenshot worth eyeballing.
//
// Run it:
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_no_arms_card_art_evidence.js
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
const https = require('https');

const URL = process.env.BURBZ_URL || 'http://127.0.0.1:8765/index.html';
const EXE = process.env.CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOT_DIR = process.env.EVIDENCE_SHOT_DIR || '/tmp';

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

function fetchLive(path) {
  return new Promise((resolve, reject) => {
    https.get('https://yaanbatho.com' + path, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode + ' ' + path)); }
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });

  // Local art files are LFS pointers; serve the real bytes from the live site.
  const artCache = new Map();
  await page.route('**/bird-art-cache/**', async route => {
    const path = new global.URL(route.request().url()).pathname;
    try {
      if (!artCache.has(path)) artCache.set(path, await fetchLive(path));
      const type = path.endsWith('.webp') ? 'image/webp' : path.endsWith('.svg') ? 'image/svg+xml' : 'image/png';
      await route.fulfill({ status: 200, contentType: type, body: artCache.get(path) });
    } catch (e) {
      await route.continue();
    }
  });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.player.level = 12; // the v338 gates open everything for veterans
    state.flock = [
      { id: 'sword_robin', species: 'European Robin', commonName: 'European Robin', rarity: 'common',
        hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 40, cha: 40, stamina: 60, level: 3,
        care: { hunger: 10, happiness: 90 } },
      { id: 'plain_wren', species: 'Wren', commonName: 'Wren', rarity: 'common',
        hp: 50, maxHp: 50, atk: 30, def: 30, spd: 45, int: 40, cha: 40, stamina: 60, level: 2,
        care: { hunger: 10, happiness: 90 } }
    ];
    localStorage.setItem('burbz_state', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });

  // The intro cutscene overlays a fresh save; skip it so the screenshots
  // show the cards, not the video. The checks below read the DOM either way.
  const dismissIntro = async () => {
    for (let i = 0; i < 20; i++) {
      const showing = await page.evaluate(() => {
        const overlay = document.getElementById('introCutsceneOverlay');
        if (!overlay || getComputedStyle(overlay).display === 'none' || !overlay.offsetParent && getComputedStyle(overlay).position !== 'fixed') return false;
        if (getComputedStyle(overlay).visibility === 'hidden' || getComputedStyle(overlay).opacity === '0') return false;
        document.getElementById('introSkipBtn')?.click();
        return true;
      });
      if (!showing) return;
      await page.waitForTimeout(250);
    }
  };
  await dismissIntro();
  await page.evaluate(() => window.switchScreen('birdex'));
  await page.waitForSelector('#birdGrid .bird-card[data-bird-id="sword_robin"]', { timeout: 30000 });
  await page.waitForFunction(() => {
    const img = document.querySelector('.bird-card[data-bird-id="sword_robin"] .card-art img');
    return img && img.complete;
  }, { timeout: 60000 });

  const cards = await page.evaluate(() => {
    const read = id => {
      const art = document.querySelector('.bird-card[data-bird-id="' + id + '"] .card-art');
      if (!art) return null;
      const img = art.querySelector('img:not(.card-art-wash)');
      const bg = art.querySelector('.card-art-bg');
      return {
        src: img ? img.getAttribute('src') : null,
        className: img ? img.className : null,
        decoded: img ? img.naturalWidth > 0 : false,
        hasWash: !!art.querySelector('img.card-art-wash'),
        bgStyle: bg ? bg.getAttribute('style') || '' : ''
      };
    };
    return { robin: read('sword_robin'), wren: read('plain_wren') };
  });

  check('armed robin card serves the warrior cutout',
    cards.robin && /european_robin_burbz_manga_warrior_20260802_cutout\.png/.test(cards.robin.src || ''),
    cards.robin && cards.robin.src);
  check('robin cutout carries the card-art-cutout class',
    cards.robin && /\bcard-art-cutout\b/.test(cards.robin.className || ''), cards.robin && cards.robin.className);
  check('robin cutout really decodes (live art through the route)',
    cards.robin && cards.robin.decoded);
  check('robin card has NO blurred wash behind the cutout',
    cards.robin && !cards.robin.hasWash);
  check('robin card paints a habitat backdrop behind the cutout',
    cards.robin && /habitat-backgrounds\//.test(cards.robin.bgStyle));
  check('armless wren card keeps its original painting',
    cards.wren && /wren_burbz_manga_20260624_v2\.png/.test(cards.wren.src || ''), cards.wren && cards.wren.src);
  check('wren painting keeps the card-art-painting class and its wash',
    cards.wren && /\bcard-art-painting\b/.test(cards.wren.className || '') && cards.wren.hasWash);

  await dismissIntro();
  const shot1 = SHOT_DIR + '/no_arms_companions.png';
  await page.screenshot({ path: shot1 });
  console.log('  shot ' + shot1);

  // ---- The robin's info sheet gets the same swap --------------------------
  await page.evaluate(() => window.openBirdInfo('sword_robin'));
  await page.waitForSelector('#birdInfoModal.show .bird-info-art img', { timeout: 30000 });
  const info = await page.evaluate(() => {
    const art = document.querySelector('#birdInfoModal .bird-info-art');
    const img = art && art.querySelector('img');
    return {
      src: img ? img.getAttribute('src') : null,
      className: img ? img.className : null,
      bgStyle: art ? art.getAttribute('style') || '' : ''
    };
  });
  check('info sheet serves the warrior cutout too',
    /european_robin_burbz_manga_warrior_20260802_cutout\.png/.test(info.src || ''), info.src);
  check('info sheet cutout uses contain, not cover',
    /\bcard-art-cutout\b/.test(info.className || ''));
  check('info sheet stands the cutout on a habitat backdrop',
    /habitat-backgrounds\//.test(info.bgStyle));

  const shot2 = SHOT_DIR + '/no_arms_info_sheet.png';
  await page.screenshot({ path: shot2 });
  console.log('  shot ' + shot2);

  const pageErrors = errors.filter(e => !/\/api\/auth\/config/.test(e));
  check('zero page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok);
  console.log(failed.length ? 'EVIDENCE FAILED: ' + failed.length + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
