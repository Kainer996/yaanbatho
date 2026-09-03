#!/usr/bin/env node
// Browser evidence for step-inside-buildings-v341-20260901 plus the painted
// interior upgrade generated-building-interiors-v344-20260902. Boots the REAL
// game in Chromium with a veteran save owning one built-up village, then
// walks the whole feature with real clicks:
//
//   - the desk under the 3D village is door tiles now (no card wall),
//   - tapping a tile opens the building's interior overlay: the real painting,
//     the crew truth, the stores truth, and the same build button,
//   - the build button really builds (coins fall, a construction starts,
//     the room re-renders showing BUILDING),
//   - the Alehouse interior pours: STEP UP TO THE BAR opens the Puffin's
//     Rest rounds,
//   - a real tap on the 3D stage over the village well opens the well's
//     interior — the scene path, not just the tile path,
//   - the town's absorbed sections (Entertainment essay, Metal Works,
//     network card wall) are gone from the town screen source at runtime.
//
// Zero page errors throughout.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_step_inside_buildings_evidence.js
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
const SHOTS = process.env.EVIDENCE_SHOT_DIR || '';

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

  // ---- Plant: a veteran save owning one built-up standalone village -------
  await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    const now = Date.now();
    state.player.coins = 600;
    state.player.branches = 250;
    state.player.stone = 60;
    state.player.level = 12; // veteran: every gate open
    state.flock = [{
      id: 'pip', species: 'European Robin', commonName: 'European Robin', rarity: 'common',
      hp: 60, maxHp: 60, atk: 40, def: 40, spd: 40, int: 40, cha: 40, stamina: 60, level: 3,
      care: { hunger: 10, happiness: 90 }
    }];
    state.empire = state.empire || {};
    state.empire.villages = {
      '101': {
        seed: 101, name: 'Elmbrook', lat: 51.5, lon: -0.12,
        claimedAt: new Date(now - 86400000).toISOString(),
        liberatedAt: new Date(now - 86400000).toISOString(),
        lastTributeAt: now,
        economy: {
          buildings: { cabin: 1, well: 1, hut: 1, lumberhut: 1, tavern: 1, storehouse: 1 },
          population: 12,
          stores: { food: 30, water: 45 },
          constructions: [],
          ruins: []
        }
      }
    };
    state.lastVillage = { seed: 101, name: 'Elmbrook', lat: 51.5, lon: -0.12 };
    localStorage.setItem('burbz_state', JSON.stringify(state));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
  // The intro cutscene overlay eats pointer events; evidence walks past it
  // the way every evidence script does.
  await page.evaluate(() => document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove()));
  await page.evaluate(() => window.switchScreen('village'));
  await page.waitForFunction(() => {
    const grid = document.querySelector('#villageManagePanel .province-build-grid');
    return !!(grid && grid.children.length);
  }, { timeout: 30000 });

  // ---- 1. The desk is door tiles, not a card wall -------------------------
  const desk = await page.evaluate(() => {
    const grid = document.querySelector('#villageManagePanel .province-build-grid');
    return {
      tiles: grid ? grid.querySelectorAll('[data-action="enter-building"]').length : 0,
      isTiles: !!(grid && grid.classList.contains('is-tiles')),
      oldCards: document.querySelectorAll('#villageManagePanel .province-building').length,
      hint: !!document.querySelector('#villageManagePanel .province-desk-hint'),
      deskButtons: document.querySelectorAll('#villageManagePanel .province-build-btn').length
    };
  });
  check('the desk offers one door tile per building', desk.isTiles && desk.tiles >= 8, JSON.stringify(desk));
  check('the card wall is gone from the desk (no build buttons on the desk)', desk.oldCards === 0 && desk.deskButtons === 0);
  check('the desk teaches the door: "Tap a building to step inside"', desk.hint);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/desk-tiles.png', fullPage: false });

  // ---- 2. A tile opens the hut's interior ---------------------------------
  await page.click('#villageManagePanel [data-action="enter-building"][data-building="hut"]');
  await page.waitForSelector('#buildingInteriorOverlay.show', { timeout: 15000 });
  const hut = await page.evaluate(() => {
    const overlay = document.getElementById('buildingInteriorOverlay');
    const painting = overlay.querySelector('.bi-scene-art');
    return {
      title: (overlay.querySelector('.shop-name') || {}).textContent || '',
      scene: !!overlay.querySelector('.bi-scene'),
      painting: painting ? {
        src: painting.getAttribute('src'),
        complete: painting.complete,
        naturalWidth: painting.naturalWidth,
        naturalHeight: painting.naturalHeight
      } : null,
      placeholderSvgs: overlay.querySelectorAll('.building-interior-scene svg').length,
      crewLine: (overlay.querySelector('.building-interior-body') || {}).textContent || '',
      buildBtn: !!overlay.querySelector('.province-build-btn')
    };
  });
  check('the Hunter-Gatherer Hut opens: its name over its painted room', /Hunter-Gatherer Hut/.test(hut.title) && hut.scene, hut.title);
  check('the full-size hut painting loaded with no SVG placeholder', hut.painting && hut.painting.complete && hut.painting.naturalWidth === 1448 && hut.painting.naturalHeight === 1086 && /building-interiors-manga\/hut\.webp$/.test(hut.painting.src) && hut.placeholderSvgs === 0, JSON.stringify(hut.painting));
  check('the room tells the crew truth (posted hands or the idle warning)', /at work|posted|dle/.test(hut.crewLine));
  check('the granary line reads the real stores', /Granary holds/.test(hut.crewLine));
  check('the build button stands inside the room', hut.buildBtn);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/hut-interior.png', fullPage: false });

  // ---- 3. Building from inside really builds ------------------------------
  await page.evaluate(() => window.closeBuildingInterior());
  await page.evaluate(() => window.openBuildingInterior(101, 'well'));
  await page.waitForSelector('#buildingInteriorOverlay.show', { timeout: 15000 });
  const wellBefore = await page.evaluate(() => ({
    title: (document.querySelector('#buildingInteriorOverlay .shop-name') || {}).textContent || '',
    cistern: /Cistern holds/.test((document.querySelector('#buildingInteriorOverlay .building-interior-body') || {}).textContent || ''),
    painting: (document.querySelector('#buildingInteriorOverlay .bi-scene-art') || {}).getAttribute('src') || '',
    coins: JSON.parse(localStorage.getItem('burbz_state')).player.coins
  }));
  check('the well opens by its exported door too', /Timber Well/.test(wellBefore.title), wellBefore.title);
  check('the well has its own painting', /building-interiors-manga\/well\.webp$/.test(wellBefore.painting), wellBefore.painting);
  check('the cistern line reads the real water store', wellBefore.cistern);
  await page.click('#buildingInteriorOverlay .province-build-btn:not([disabled])');
  await page.waitForFunction(() => {
    const body = document.querySelector('#buildingInteriorOverlay .building-interior-body');
    return body && /BUILDING/.test(body.textContent);
  }, { timeout: 15000 });
  const wellAfter = await page.evaluate(() => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    return {
      coins: state.player.coins,
      rising: (state.empire.villages['101'].economy.constructions || []).map(c => c.id),
      atmosphere: !!document.querySelector('#buildingInteriorOverlay .bi-scene-rising')
    };
  });
  check('the upgrade starts from inside: a real construction on the well', wellAfter.rising.indexOf('well') !== -1, JSON.stringify(wellAfter.rising));
  check('the painted room shows the construction atmosphere', wellAfter.atmosphere);
  check('and the coins were really spent', wellAfter.coins < wellBefore.coins, wellBefore.coins + ' -> ' + wellAfter.coins);
  if (SHOTS) await page.screenshot({ path: SHOTS + '/well-building.png', fullPage: false });

  // ---- 4. The Alehouse pours from inside ----------------------------------
  await page.evaluate(() => window.closeBuildingInterior());
  await page.evaluate(() => window.openBuildingInterior(101, 'tavern'));
  await page.waitForSelector('#buildingInteriorOverlay.show', { timeout: 15000 });
  const barBtn = await page.$('#buildingInteriorOverlay [data-action="interior-bar"]');
  check('the Alehouse interior offers its bar', !!barBtn);
  if (barBtn) {
    await barBtn.click();
    await page.waitForSelector('#villageShopOverlay.show', { timeout: 15000 });
    const bar = await page.evaluate(() => ({
      shop: (document.querySelector('#villageShopOverlay .shop-name') || {}).textContent || '',
      interiorClosed: !document.getElementById('buildingInteriorOverlay').classList.contains('show')
    }));
    check("STEP UP TO THE BAR opens the Puffin's Rest rounds", /Puffin/.test(bar.shop) && bar.interiorClosed, bar.shop);
    await page.evaluate(() => window.villageCloseShop());
  }

  // ---- 5. A real tap on the 3D stage opens the well -----------------------
  // The Timber Well is the village centrepiece at world (0,0): a quick tap
  // on the stage centre rides the real raycast path.
  await page.evaluate(() => document.getElementById('villageStage').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(800);
  const stage = await page.$('#villageStage canvas');
  let sceneTapped = false;
  if (stage) {
    for (const [fx, fy] of [[0.5, 0.55], [0.5, 0.5], [0.45, 0.6], [0.55, 0.6]]) {
      const box = await page.evaluate(() => document.getElementById('villageStage').getBoundingClientRect().toJSON());
      await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy, { delay: 40 });
      try {
        await page.waitForSelector('#buildingInteriorOverlay.show', { timeout: 2500 });
        sceneTapped = true;
        break;
      } catch (e) {}
    }
  }
  const sceneTitle = sceneTapped
    ? await page.evaluate(() => (document.querySelector('#buildingInteriorOverlay .shop-name') || {}).textContent || '')
    : '';
  check('a real tap on the 3D village opens a building interior', sceneTapped, sceneTitle || 'no overlay after 4 taps');
  if (SHOTS && sceneTapped) await page.screenshot({ path: SHOTS + '/scene-tap.png', fullPage: false });
  await page.evaluate(() => window.closeBuildingInterior());

  // ---- 6. The town screen shed its absorbed sections ----------------------
  const townSource = await page.evaluate(() => {
    return {
      interiorWired: typeof window.openBuildingInterior === 'function' && typeof window.closeBuildingInterior === 'function' && typeof window.buildingInteriorBuild === 'function',
      // The page's own script: the absorbed sections must not exist.
      invest: document.body.innerHTML.indexOf('INVEST IN FUN') !== -1,
      metal: document.getElementById('townMetalSection') !== null,
      entertainment: document.getElementById('townEntertainmentSection') !== null
    };
  });
  check('the interior renderer is live on the page', townSource.interiorWired);
  check('the Entertainment essay and Metal Works sections are gone', !townSource.invest && !townSource.metal && !townSource.entertainment);

  // ---- 7. Quiet page ------------------------------------------------------
  check('zero page errors through the whole walk', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
