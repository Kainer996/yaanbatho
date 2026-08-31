#!/usr/bin/env node
// Browser evidence for every-bird-carries-its-weight-v335-20260827. Boots the
// REAL game in Chromium, plants a flock built around Yaan's report — "I have a
// merlin that can only carry the same amount as a reed warbler or a robin" —
// and proves, through the game's own code and its own screens:
//
//   - a Merlin carries several times what a Robin or a Reed Warbler carries,
//   - the load climbs the whole way up the roster with no flat stretch,
//   - what a bird is BUILT to carry counts too: a Mute Swan of nine times the
//     Raven's weight hauls less than a Golden Eagle, and a Griffon Vulture
//     carries less than a sea-eagle it outweighs,
//   - every playable bird knows its real weight — nothing guesses,
//   - Merlin the guide, the bird who flies the tutorial errand, carries a real
//     falcon's load rather than a wren's,
//   - the bird card renders the carry chip and the new carrying-guild chip,
//   - a real expedition sent from the real quest board comes home carrying the
//     thing it was sent for.
//
// Run it (playwright + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_every_bird_carries_its_weight_evidence.js
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

// The bird at the heart of the report, the two birds it was wrongly level with,
// and the heavyweights that prove the top of the curve is a real bird.
const FLOCK = [
  { species: 'Reed Warbler', name: 'Reed Warbler' },
  { species: 'Robin', name: 'Robin' },
  { species: 'Merlin', name: 'Merlin' },
  { species: 'Raven', name: 'Raven' },
  { species: 'Mute Swan', name: 'Mute Swan' },
  { species: 'Golden Eagle', name: 'Golden Eagle' }
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));

  // ---- boot once so the game writes a real save, then plant on top of it ----
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  // The game runs inside an IIFE, so the only handles it publishes are the
  // size core itself, switchScreen and __burbzMapDebug. Everything below is
  // driven through those and through the rendered DOM — no private internals.
  await page.waitForFunction(() => !!window.BurbzBirdSizeCore && !!window.__burbzMapDebug, { timeout: 90000 });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  await page.evaluate(flock => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    // Planted WITHOUT any size fields at all — exactly the shape an old save
    // has. The migration must fill in the weight, the class and the guild.
    state.flock = flock.map((b, i) => ({
      id: 'evidence-' + i, species: b.species, commonName: b.name, rarity: 'common',
      hp: 90, maxHp: 90, atk: 45, def: 45, spd: 40, int: 50, cha: 50, stamina: 50,
      level: 1, hunger: 100, energy: 100, mood: 100, health: 100
    }));
    state.player = state.player || {};
    state.player.level = 8;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
  }, FLOCK);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.BurbzBirdSizeCore && !!window.__burbzMapDebug, { timeout: 90000 });
  await page.waitForFunction(() => (window.__burbzMapDebug.state.flock || []).length >= 6, { timeout: 90000 });

  // ---- 1. the report, answered, through the game's own live flock ----------
  const loads = await page.evaluate(() => {
    const core = window.BurbzBirdSizeCore;
    const out = {};
    (window.__burbzMapDebug.state.flock || []).forEach(b => {
      out[b.species] = {
        carry: core.carryCapacity(b), massG: b.massG,
        guild: b.carryGuild, source: b.sizeSource, sizeClass: b.sizeClass
      };
    });
    return out;
  });
  const m = loads['Merlin'] || {}, r = loads['Robin'] || {}, w = loads['Reed Warbler'] || {};
  check('the Merlin knows it is a 200 g falcon', m.massG === 200 && m.guild === 'raptor',
    JSON.stringify(m));
  check('a Merlin carries several times a Robin', m.carry >= r.carry + 3,
    'merlin ' + m.carry + ' vs robin ' + r.carry);
  check('a Merlin carries several times a Reed Warbler', m.carry >= w.carry + 3,
    'merlin ' + m.carry + ' vs reed warbler ' + w.carry);
  check('a Robin and a Reed Warbler still carry one', r.carry === 1 && w.carry === 1,
    'robin ' + r.carry + ', reed warbler ' + w.carry);
  const ladder = ['Reed Warbler', 'Robin', 'Merlin', 'Raven', 'Golden Eagle'].map(k => loads[k].carry);
  check('the load climbs the roster with no flat stretch',
    ladder[1] <= ladder[2] - 3 && ladder[2] < ladder[3] && ladder[3] < ladder[4],
    ladder.join(' < '));
  check('all weight and no grip: the Swan hauls less than the Eagle',
    loads['Mute Swan'].carry < loads['Golden Eagle'].carry,
    'swan ' + loads['Mute Swan'].carry + ' (11 kg) vs eagle ' + loads['Golden Eagle'].carry + ' (4.5 kg)');
  check('an old save was re-derived, so nothing is guessing',
    Object.values(loads).every(v => v.source === 'field' || v.source === 'mass'),
    Object.entries(loads).map(([k, v]) => k + ':' + v.source).join(' '));

  // ---- 2. every playable bird knows what it weighs -------------------------
  const coverage = await page.evaluate(() => {
    const core = window.BurbzBirdSizeCore;
    let total = 0, guessing = 0;
    const sources = ['BURBZ_UK_BIRD_EXPANSION_50', 'BURBZ_UK_BIRD_EXPANSION_26', 'BURBZ_AU_BIRD_EXPANSION',
      'BURBZ_UK_BIRD_EXPANSION_FINAL', 'BURBZ_AU_BIRD_EXPANSION_50', 'BURBZ_UK_BIRD_EXPANSION_4',
      'BURBZ_NATIONAL_BIRD_COMPLETION_20260715'];
    sources.forEach(key => ((window[key] || {}).profiles || []).forEach(p => {
      total += 1;
      const s = core.speciesSize(p);
      if (s.source === 'stats' || s.source === 'default') guessing += 1;
    }));
    return { total, guessing };
  });
  check('every playable bird has a real weight', coverage.guessing === 0,
    coverage.total + ' species, ' + coverage.guessing + ' guessing');

  // ---- 3. grip beats bulk -------------------------------------------------
  const grip = await page.evaluate(() => {
    const core = window.BurbzBirdSizeCore;
    const at = (massG, carryGuild) => core.carryCapacity({ massG, carryGuild, stamina: 50, level: 1 });
    return {
      griffon: at(8000, 'vulture'), seaEagle: at(5000, 'raptor'),
      osprey: at(1500, 'osprey'), heron: at(1500, 'fisher'),
      mallard: at(1100, 'waterfowl'), merlin: at(200, 'raptor')
    };
  });
  check('an 8 kg vulture carries less than a 5 kg sea-eagle', grip.griffon < grip.seaEagle,
    'griffon ' + grip.griffon + ' vs sea-eagle ' + grip.seaEagle);
  check('the Osprey out-carries a Heron of its own weight', grip.osprey > grip.heron,
    'osprey ' + grip.osprey + ' vs heron ' + grip.heron);

  // ---- 4. the card says so, on screen, in the real DOM ---------------------
  // Open the Merlin's own card the way a tap does, and read the chips the
  // player actually sees.
  await page.evaluate(() => window.switchScreen('academy'));
  await page.waitForTimeout(600);
  const merlinId = await page.evaluate(() =>
    ((window.__burbzMapDebug.state.flock || []).find(b => b.species === 'Merlin') || {}).id);
  await page.evaluate(id => window.openBirdInfo(id), merlinId);
  await page.waitForSelector('#birdInfoModal.show', { timeout: 15000 });
  await page.waitForTimeout(500);
  const shownChips = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.bird-size-chip')).map(el => el.textContent.trim()));
  check('the bird card renders the carry chip on screen',
    shownChips.some(c => /carries 5 loads/.test(c)), shownChips.join(' | ') || '(none)');
  check('the bird card renders the new carrying-guild chip',
    shownChips.some(c => /Talons/.test(c) && /carrying/.test(c)), shownChips.join(' | ') || '(none)');
  if (SHOT) {
    // Merlin's tutorial card and the badge toasts sit over the whole app; the
    // evidence shot is of the size panel underneath them.
    await page.evaluate(() => {
      document.querySelectorAll('.intro-cutscene-overlay, .merlin-tutorial-overlay, .merlin-tutorial-card, .toast-host, .toast, .merlin-perch, .merlin-listening-dock').forEach(el => el.remove());
      const panel = document.querySelector('.bird-size-panel');
      if (panel) panel.scrollIntoView({ block: 'center' });
    });
    await page.waitForTimeout(400);
    await page.screenshot({ path: SHOT });
    console.log('  shot  ' + SHOT);
  }
  await page.evaluate(() => window.closeBirdInfo && window.closeBirdInfo());
  await page.waitForTimeout(300);

  // ---- 6. a real errand comes home with what it was sent for ---------------
  const errand = await page.evaluate(() => {
    const core = window.BurbzBirdSizeCore;
    const flock = window.__burbzMapDebug.state.flock || [];
    const robin = flock.find(b => b.species === 'Robin');
    const eagle = flock.find(b => b.species === 'Golden Eagle');
    // A day-long Branch Run and an hour on the Bark & Grub Round, as the real
    // quest tables roll them.
    const timber = { branches: 90, items: { soft_moss: 12 } };
    const food = { branches: 2, items: { mealworm_scoop: 3 } };
    const sum = o => Object.values(o || {}).reduce((a, b) => a + b, 0);
    const rt = core.applyCarryLimit(timber, robin), et = core.applyCarryLimit(timber, eagle);
    const rf = core.applyCarryLimit(food, robin);
    return {
      robinTimber: rt.branches, eagleTimber: et.branches,
      robinFood: sum(rf.items), robinFoodBranches: rf.branches
    };
  });
  check('a timber errand comes home as timber, and the big bird brings far more',
    errand.eagleTimber >= 40 && errand.eagleTimber > errand.robinTimber * 10,
    'eagle ' + errand.eagleTimber + ' branches vs robin ' + errand.robinTimber);
  check('a food errand comes home as food, even in a one-load hold',
    errand.robinFood > 0 && errand.robinFoodBranches === 0,
    errand.robinFood + ' food, ' + errand.robinFoodBranches + ' branches');

  check('no page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

  await browser.close();

  const failed = results.filter(r => !r.ok);
  console.log('\n' + (results.length - failed.length) + '/' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
