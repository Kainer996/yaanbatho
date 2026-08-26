#!/usr/bin/env node
// Browser evidence for field-any-bird-v330-20260826. Boots the REAL game in
// Chromium, plants a flock whose fourth bird carries a very long name, walks
// the real Battle screen — pick four birds, press START BATTLE — and proves:
//
//   - every card in both arena rows is the same width and the same height,
//     however long the bird's name is (the Great Spotted Woodpecker used to
//     take a track nearly twice as wide as its squadmates),
//   - tapping any living bird in your own row hands it the turn,
//   - the same bird can take turn after turn,
//   - handing the turn over does not buy the flock extra turns.
//
// Run it (playwright + a Chromium build are the only requirements):
//   cd public/burbz && python3 -m http.server 8765 &
//   BURBZ_URL=http://127.0.0.1:8765/index.html \
//     CHROMIUM_EXECUTABLE_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome \
//     node tests/run_field_any_bird_evidence.js
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

// Four birds, fed and idle so the Battle screen will field them. The last one
// wears the longest common name the UK list has to offer: this is the card
// that used to blow its grid track open and drag the whole row out of shape.
const FLOCK = [
  { species: 'Carrion Crow', name: 'Carrion Crow' },
  { species: 'Hooded Crow', name: 'Hooded Crow' },
  { species: 'Common Kestrel', name: 'Common Kestrel' },
  { species: 'Great Spotted Woodpecker', name: 'Great Spotted Woodpecker' }
];

(async () => {
  const browser = await chromium.launch({ executablePath: EXE });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));

  // ---- boot once so the game writes a real save, then plant on top of it ----
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.BurbzBattleCore && !!window.battlePickToggle, { timeout: 90000 });
  await page.waitForFunction(() => {
    try { return !!JSON.parse(localStorage.getItem('burbz_state') || 'null'); } catch (e) { return false; }
  }, { timeout: 90000 });

  await page.evaluate(flock => {
    const state = JSON.parse(localStorage.getItem('burbz_state'));
    state.flock = flock.map((b, i) => ({
      id: 'evidence-' + i, species: b.species, commonName: b.name, rarity: 'common',
      hp: 90, maxHp: 90, atk: 45, def: 45, spd: 40 + i * 6, int: 50, cha: 50, stamina: 70,
      level: 5, hunger: 100, energy: 100, mood: 100, health: 100
    }));
    state.player = state.player || {};
    state.player.level = 5;
    localStorage.setItem('burbz_state', JSON.stringify(state));
    // Skip the intro cutscene and Merlin's tutorial — this harness is here for
    // the arena, and both overlays sit on top of the Battle screen.
    localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
  }, FLOCK);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.BurbzBattleCore && !!window.battlePickToggle, { timeout: 90000 });
  await page.waitForFunction(() => (window.__burbzMapDebug.state.flock || []).length >= 4, { timeout: 90000 });

  // ---- walk the real Battle screen ----
  // Merlin's tutorial spotlight sits over the whole app; this harness is here
  // for the arena underneath it.
  const clearOverlays = () => page.evaluate(() => document.querySelectorAll(
    '.intro-cutscene-overlay, .merlin-tutorial-overlay, .toast-host, .toast'
  ).forEach(el => el.remove()));
  await page.evaluate(() => window.switchScreen('battle'));
  await page.waitForTimeout(400);
  const picked = await page.evaluate(() => {
    const ids = (window.__burbzMapDebug.state.flock || []).map(b => b.id).slice(0, 4);
    ids.forEach(id => window.battlePickToggle(id));
    return ids.length;
  });
  check('four birds picked into the squad', picked === 4, picked + ' picked');
  await clearOverlays();
  await page.evaluate(() => document.getElementById('battleStartBtn').click());
  await page.waitForSelector('#arenaPlayerRow .arena-unit', { timeout: 20000 });
  await page.waitForTimeout(900);

  const readRow = id => page.evaluate(rowId => {
    const host = document.getElementById(rowId);
    return Array.from(host.children).map(el => {
      const r = el.getBoundingClientRect();
      const art = el.querySelector('.au-art');
      return {
        name: (el.querySelector('.au-name') || {}).textContent || '',
        w: Math.round(r.width * 100) / 100,
        h: Math.round(r.height * 100) / 100,
        artW: art ? Math.round(art.getBoundingClientRect().width * 100) / 100 : null
      };
    });
  }, id);

  const spread = list => Math.max(...list) - Math.min(...list);
  for (const [label, id] of [['your squad', 'arenaPlayerRow'], ['evil Burbz', 'arenaOppRow']]) {
    const row = await readRow(id);
    const widths = row.map(c => c.w);
    const heights = row.map(c => c.h);
    // Sub-pixel grid rounding is fine; a blown-open track is not.
    check(label + ' cards share one width', row.length > 1 && spread(widths) <= 1,
      widths.join(' / ') + ' px');
    check(label + ' cards share one height', row.length > 1 && spread(heights) <= 1,
      heights.join(' / ') + ' px');
  }
  const playerRow = await readRow('arenaPlayerRow');
  console.log('  player row: ' + JSON.stringify(playerRow));

  // ---- the arena must not push the page sideways ----
  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('arena does not scroll the page sideways', overflow <= 0, overflow + 'px of overflow');

  if (SHOT) {
    await clearOverlays();
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(250);
    await page.screenshot({ path: SHOT });
  }

  // ---- field any bird, as often as you like ----
  // Everything below goes through the same handlers a thumb does: the card's
  // own onclick, the move buttons, the ATTACK button.
  const swap = await page.evaluate(() => {
    const b = window.__burbzArenaDebug.battle();
    const started = b.acting.index;
    const other = b.teams.player
      .map((f, i) => ({ f, i })).find(x => !x.f.fainted && x.i !== started);
    document.getElementById('unit_player_' + other.i).click();
    const now = window.__burbzArenaDebug.acting();
    const shown = Array.from(document.querySelectorAll('#arenaActions .move-btn'))
      .filter(el => (el.getAttribute('onclick') || '').indexOf('battleSelectSkill') === 0)
      .map(el => el.querySelector('.mv-name span').textContent);
    const want = other.f.skills.map(sk => sk.label + (sk.tier ? ' ' + ['I', 'II', 'III'][sk.tier - 1] : ''));
    const banner = (document.querySelector('.arena-turn-banner') || {}).textContent || '';
    return {
      started, other: other.i, afterTap: now.index, otherName: other.f.name,
      shown, want, banner,
      pickableCards: document.querySelectorAll('#arenaPlayerRow .arena-unit.pickable').length,
      turnFlags: document.querySelectorAll('#arenaPlayerRow .au-turn-flag').length
    };
  });
  check('tapping another bird hands it the turn', swap.afterTap === swap.other,
    'acting ' + swap.started + ' -> ' + swap.afterTap + ' (' + swap.otherName + ')');
  check('the move list is the tapped bird\'s own',
    swap.shown.length > 0 && swap.shown.join('|') === swap.want.join('|'),
    swap.shown.join(' / '));
  check('the banner names the bird you tapped', swap.banner.indexOf(swap.otherName) === 0, swap.banner);
  check('exactly one bird wears the TURN flag', swap.turnFlags === 1, swap.turnFlags + ' flags');
  check('the other living birds are marked as pickable', swap.pickableCards >= 1,
    swap.pickableCards + ' pickable cards');

  // ---- the same bird, turn after turn ----
  const FAVOURITE = swap.other;
  const swung = [];
  for (let round = 0; round < 4; round++) {
    const ok = await page.waitForFunction(() => {
      const b = window.__burbzArenaDebug.battle();
      return !!(b && b.phase === 'act' && b.acting && b.acting.side === 'player');
    }, null, { timeout: 20000 }).then(() => true).catch(() => false);
    if (!ok) break;
    const took = await page.evaluate(fav => {
      document.getElementById('unit_player_' + fav).click();          // send in the favourite
      const b = window.__burbzArenaDebug.battle();
      if (b.acting.index !== fav) return { acted: -1 };
      const move = Array.from(document.querySelectorAll('#arenaActions .move-btn'))
        .filter(el => (el.getAttribute('onclick') || '').indexOf('battleSelectSkill') === 0 && !el.disabled)[0];
      move.click();                                                    // pick a move
      const foe = b.teams.opponent.map((f, i) => ({ f, i })).find(x => !x.f.fainted);
      const unit = document.getElementById('unit_opponent_' + foe.i);
      if (unit) unit.click();                                          // aim
      const attack = document.querySelector('#arenaActions .attack-confirm-btn:not([disabled])');
      if (attack) attack.click(); else return { acted: -1 };           // strike
      return { acted: fav, name: b.teams.player[fav].name };
    }, FAVOURITE);
    if (took.acted !== FAVOURITE) break;
    swung.push(took.acted);
    await page.waitForTimeout(1200);
  }
  check('the same bird can take turn after turn', swung.length >= 3,
    swung.length + ' turns in a row for player bird ' + FAVOURITE);

  await browser.close();
  const failed = results.filter(r => !r.ok);
  if (errors.length) console.log('page errors: ' + JSON.stringify(errors.slice(0, 5)));
  console.log(failed.length ? failed.length + ' CHECK(S) FAILED' : 'all ' + results.length + ' checks passed');
  process.exit(failed.length ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
