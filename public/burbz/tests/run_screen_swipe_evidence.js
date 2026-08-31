#!/usr/bin/env node
// Browser evidence for screen-swipe-v336-20260831: swipe between the game's
// screens. Boots the REAL game in Chromium with touch, silences the tutorial,
// plants three owned villages, then proves with real touch gestures:
//
//   - a left swipe on the quest board glides to the Empire screen, the dock's
//     Empire button lights up, and every screen settles without a trace,
//   - a swipe on the Empire header turns the page while a swipe on the
//     village hub below still swipes villages — two roads, no collision,
//   - a slow 40px drag springs back; the same 40px as a quick flick commits,
//   - a horizontal drag on the live map steers the map, never the page,
//   - the road wraps: Burbz swipes on to the Stores,
//   - a vertical drag turns no page,
//   - the active screen genuinely follows the finger mid-drag, with the
//     neighbour riding in beside it — not just teleporting on release,
//   - a touch cancelled past the commit line only ever springs back,
//   - the element under the finger can be replaced mid-drag (a live re-render,
//     same as the quest board's own 20s refresh) without stranding the touch
//     — it springs back clean rather than freezing the page,
//   - an open sheet holds the page still,
//   - zero page errors throughout.
//
// Run it (playwright-core + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_screen_swipe_evidence.js
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

// Every Merlin lesson marked seen, so no chapter stands over a swipe.
const TUTORIAL_KEY = 'burbzTutorialChapters:merlin-interactive-flow-v7-20260728';
const TUTORIAL_CHAPTERS = ['story', 'quests', 'errand', 'academy', 'academy_tour', 'explore', 'scan',
  'birdex', 'battle', 'village', 'town', 'diary', 'forge', 'inventory', 'leaderboards', 'profile'];

// Keyed by SEED, never by name: the game names a village from its own
// place-name table, so names planted here are replaced on load.
const HOUR = 3600000;
function plantedVillages(now) {
  const village = (seed, lat, lon) => ({
    seed, name: 'Seed ' + seed, lat, lon,
    claimedAt: new Date(now - 40 * HOUR).toISOString(),
    liberatedAt: new Date(now - 40 * HOUR).toISOString(),
    lastTributeAt: now - HOUR,
    economy: { population: 6, buildings: { cabin: 2, well: 2, hut: 2 }, constructions: [], ruins: [] }
  });
  return {
    101: village(101, 51.50, -3.20),
    202: village(202, 51.52, -3.22),
    303: village(303, 51.54, -3.24)
  };
}

(async () => {
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  // Fresh session containers hold LFS pointers where the art bytes live, so
  // resource 404s are the environment's, not the release's (same rule the
  // art-hash tests follow). Script errors stay fatal.
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch/.test(m.text())) errors.push('console: ' + m.text()); });

  // ---- boot once so the game writes a real save, then plant on top of it ---
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  await page.evaluate(({ villages, tutorialKey, chapters }) => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.empire = state.empire || {};
    state.empire.villages = villages;
    state.empire.townCharters = [];
    state.empire.cityCharters = [];
    state.empire.regionCharters = [];
    state.lastVillage = { seed: 101, name: 'Seed 101', lat: 51.50, lon: -3.20 };
    localStorage.setItem('burbz_state', JSON.stringify(state));
    localStorage.setItem(tutorialKey, JSON.stringify(chapters));
  }, { villages: plantedVillages(Date.now()), tutorialKey: TUTORIAL_KEY, chapters: TUTORIAL_CHAPTERS });

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function', { timeout: 90000 });
  await page.evaluate(() => {
    document.querySelectorAll('.intro-cutscene-overlay, .merlin-tutorial-overlay').forEach(el => el.remove());
  });
  await page.waitForTimeout(600);

  // ---- helpers -------------------------------------------------------------
  const cdp = await context.newCDPSession(page);
  // Each event carries an explicit input timestamp, so the finger's own clock
  // (the game reads e.timeStamp) says how quick the gesture was — CDP
  // round-trips through a busy container run ~90ms apiece, which would turn
  // every synthetic flick into a slow drag.
  // Low-level primitives, so a gesture can be paused mid-flight to sample
  // state, interrupted with a cancel, or resumed after the DOM under the
  // touch has been rewritten — none of which a single all-in-one drag can do.
  let touchClock = Date.now() / 1000;
  async function touchStart(x, y) {
    touchClock = Date.now() / 1000;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }], timestamp: touchClock });
  }
  async function touchMoveTo(x, y, stepMs) {
    touchClock += (stepMs === undefined ? 16 : stepMs) / 1000;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }], timestamp: touchClock });
  }
  async function touchEnd() {
    touchClock += 0.016;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: touchClock });
  }
  async function touchCancel() {
    touchClock += 0.016;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [], timestamp: touchClock });
  }
  async function touchDrag(x0, y0, x1, y1, opts) {
    const steps = (opts && opts.steps) || 8;
    const pauseMs = opts && opts.pauseMs !== undefined ? opts.pauseMs : 16;
    const stepMs = (opts && opts.stepMs) !== undefined ? opts.stepMs : Math.max(pauseMs, 16);
    await touchStart(x0, y0);
    for (let i = 1; i <= steps; i++) {
      await touchMoveTo(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps, stepMs);
      if (pauseMs) await page.waitForTimeout(pauseMs);
    }
    await touchEnd();
  }
  const activeScreen = () => page.evaluate(() => document.body.getAttribute('data-active-screen'));
  const goTo = async name => {
    await page.evaluate(n => window.switchScreen(n), name);
    await page.waitForTimeout(700);
  };
  // The screen title is the one surface every road stop keeps clear of maps,
  // stages and shelves — swipe there.
  async function titlePoint() {
    const box = await page.evaluate(() => {
      const active = document.querySelector('.screen.active');
      const title = active && active.querySelector('.screen-title');
      const r = (title || active).getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + Math.min(r.height / 2, 24) };
    });
    return box;
  }
  // A settled page: no peeked neighbour, no leftover transform on any screen.
  const settledClean = () => page.evaluate(() =>
    !document.querySelector('.screen.swipe-peek') &&
    [...document.querySelectorAll('.screen')].every(s => !s.style.transform));

  // ---- 1. a left swipe on the quest board glides to the Empire -------------
  await goTo('quests');
  let p = await titlePoint();
  await touchDrag(p.x + 80, p.y, p.x - 80, p.y);
  await page.waitForTimeout(900);
  check('left swipe on Quests lands on the Empire', (await activeScreen()) === 'village', await activeScreen());
  check('the dock Empire button lights up', await page.evaluate(() =>
    !!document.querySelector('[data-game-route][data-screen="village"].active')));
  check('every screen settles without a trace', await settledClean());

  // ---- 2. two roads on one screen: the header turns the page, the hub
  //         swipes villages ---------------------------------------------------
  p = await titlePoint();
  await touchDrag(p.x + 80, p.y, p.x - 80, p.y);
  await page.waitForTimeout(900);
  check('a swipe on the Empire header turns the page to Scan', (await activeScreen()) === 'scan', await activeScreen());

  await goTo('village');
  await page.waitForSelector('#villagePager:not([hidden])', { timeout: 30000 });
  await page.evaluate(() => document.getElementById('villageTitle').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(500);
  const hubTitleBefore = await page.evaluate(() => document.getElementById('villageTitle').textContent);
  const hubBox = await (await page.$('#villageTitle')).boundingBox();
  await touchDrag(hubBox.x + hubBox.width / 2 + 90, hubBox.y + 10, hubBox.x + hubBox.width / 2 - 90, hubBox.y + 10);
  await page.waitForTimeout(900);
  const hubTitleAfter = await page.evaluate(() => document.getElementById('villageTitle').textContent);
  check('a swipe on the village hub still swipes villages, not pages',
    (await activeScreen()) === 'village' && hubTitleAfter !== hubTitleBefore,
    hubTitleBefore.trim() + ' → ' + hubTitleAfter.trim());

  // ---- 3. a slow 40px drag springs back; a quick 40px flick commits --------
  await goTo('scan');
  p = await titlePoint();
  await touchDrag(p.x + 20, p.y, p.x - 20, p.y, { steps: 5, pauseMs: 90 });
  await page.waitForTimeout(700);
  check('a slow 40px drag springs back', (await activeScreen()) === 'scan', await activeScreen());
  await touchDrag(p.x + 20, p.y, p.x - 20, p.y, { steps: 3, pauseMs: 0, stepMs: 20 });
  await page.waitForTimeout(900);
  check('the same 40px as a quick flick turns the page', (await activeScreen()) === 'academy', await activeScreen());

  // ---- 4. the live map keeps every horizontal drag -------------------------
  await goTo('map');
  await touchDrag(300, 450, 100, 450);
  await page.waitForTimeout(700);
  check('a drag on the live map steers the map, never the page', (await activeScreen()) === 'map', await activeScreen());

  // ---- 5. the road wraps ---------------------------------------------------
  await goTo('birdex');
  p = await titlePoint();
  await touchDrag(p.x + 80, p.y, p.x - 80, p.y);
  await page.waitForTimeout(900);
  check('the road wraps: Burbz swipes on to the Stores', (await activeScreen()) === 'inventory', await activeScreen());

  // ---- 6. a vertical drag turns no page ------------------------------------
  await goTo('quests');
  p = await titlePoint();
  await touchDrag(p.x, p.y + 40, p.x, p.y + 200);
  await page.waitForTimeout(600);
  check('a vertical drag turns no page', (await activeScreen()) === 'quests', await activeScreen());

  // ---- 7. the screen genuinely follows the finger, mid-drag ----------------
  // Every earlier check only samples state after release — a build that
  // teleported on commit instead of sliding would still pass all of them.
  p = await titlePoint();
  await touchStart(p.x, p.y);
  await touchMoveTo(p.x - 50, p.y, 16);
  await page.waitForTimeout(30);
  const midDrag = await page.evaluate(() => {
    const t = document.querySelector('.screen.active').style.transform;
    const peek = document.querySelector('.screen.swipe-peek');
    return { activeTransform: t, peekTransform: peek ? peek.style.transform : null };
  });
  check('the active screen follows the finger mid-drag',
    /translateX\(-5\d(\.\d+)?px\)/.test(midDrag.activeTransform), midDrag.activeTransform);
  check('the peeked neighbour rides in beside it, not after the fact',
    !!midDrag.peekTransform && midDrag.peekTransform.includes('calc('), midDrag.peekTransform);
  await touchMoveTo(p.x - 90, p.y, 16);
  await touchEnd();
  await page.waitForTimeout(900);
  check('the drag that was followed also commits correctly', (await activeScreen()) === 'village', await activeScreen());

  // ---- 8. a cancelled touch never commits, however far it had travelled ----
  await goTo('quests');
  p = await titlePoint();
  await touchStart(p.x, p.y);
  await touchMoveTo(p.x - 90, p.y, 16); // well past the 70px commit line
  await touchCancel();
  await page.waitForTimeout(700);
  check('a touch cancelled past the commit line still only springs back',
    (await activeScreen()) === 'quests', await activeScreen());
  check('the page settles clean after a cancel', await settledClean());

  // ---- 9. the element under the finger can be replaced mid-drag and the
  //         gesture still survives to a clean release ------------------------
  // The quest board redraws itself on a live timer while the player has it
  // open (and the Academy and village yards do the same on theirs) — a touch
  // that began on a card the redraw just replaced must not freeze the page.
  // Confirmed directly in this Chromium build: once the exact touched
  // element leaves the document, the browser drops every later event for
  // that touch everywhere — not just on the removed node — so there is no
  // event left to finish the gesture with; the one safe outcome is a clean,
  // prompt spring-back rather than a page frozen mid-slide forever.
  // Reproduced by swapping the touched node for an identical clone, exactly
  // what innerHTML-based re-render does under the hood.
  await goTo('quests');
  p = await titlePoint();
  await touchStart(p.x, p.y);
  await touchMoveTo(p.x - 50, p.y, 16);
  await page.evaluate(px => {
    const el = document.elementFromPoint(px.x, px.y);
    if (el && el.parentNode) el.parentNode.replaceChild(el.cloneNode(true), el);
  }, p);
  await touchMoveTo(p.x - 90, p.y, 16); // the browser has already dropped this touch; no-op
  await touchEnd();                    // ...and this
  await page.waitForTimeout(900);
  check('a mid-drag replacement of the touched element springs back, not frozen',
    (await activeScreen()) === 'quests', await activeScreen());
  check('the page settles clean after surviving a mid-drag replacement', await settledClean());

  // ---- 10. an open sheet holds the page still -------------------------------
  await page.evaluate(() => document.getElementById('settingsModal').classList.add('show'));
  await touchDrag(p.x + 80, p.y, p.x - 80, p.y);
  await page.waitForTimeout(700);
  check('an open sheet holds the page still', (await activeScreen()) === 'quests', await activeScreen());
  await page.evaluate(() => document.getElementById('settingsModal').classList.remove('show'));

  check('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | ') || 'clean');

  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? 'FAILED ' + failed + '/' + results.length : 'ALL ' + results.length + ' CHECKS PASSED');
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
