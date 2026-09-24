#!/usr/bin/env node
// Browser evidence for bird-patch-map-v465-20260924. Boots the REAL game at
// Yaan's quarry with a granted geolocation and proves:
//   - a heard Tawny Owl opens "Where it lives" with a real map and a circle,
//   - the circle pulses while the owl sings, then settles,
//   - the next night, in the same patch, Merlin says it is the same pair,
//   - a Raven's patch is far bigger than a Robin's,
//   - the live Map screen carries the patch layers,
//   - zero page errors.
// Run it:
//   cd public/burbz && python3 -m http.server 8765 &
//   node tests/run_bird_patch_map_evidence.js [screenshot-dir]
function requirePlaywright() {
  for (const id of [process.env.PLAYWRIGHT_CORE_PATH, 'playwright-core', 'playwright'].filter(Boolean)) {
    try { return require(id); } catch (e) {}
  }
  console.error('playwright-core not found; set PLAYWRIGHT_CORE_PATH');
  process.exit(2);
}
const { chromium } = requirePlaywright();
const URL = process.env.BURBZ_URL || 'http://127.0.0.1:8765/index.html';
const EXE = process.env.CHROMIUM_EXECUTABLE_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const SHOTS = process.argv[2] || null;
const results = [];
function check(name, ok, detail) {
  results.push({ name, ok: !!ok });
  console.log((ok ? '  ok   ' : '  FAIL ') + name + (detail === undefined ? '' : '  — ' + detail));
}

(async () => {
  // Map tiles come through the container proxy when one is set.
  const args = ['--no-sandbox', '--ignore-certificate-errors'];
  if (process.env.HTTPS_PROXY) args.push('--proxy-server=' + process.env.HTTPS_PROXY, '--proxy-bypass-list=127.0.0.1;localhost');
  const browser = await chromium.launch({ executablePath: EXE, args });
  const context = await browser.newContext({
    viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, ignoreHTTPSErrors: true,
    geolocation: { latitude: 53.8712, longitude: -2.3921, accuracy: 10 },
    permissions: ['geolocation']
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String((e && e.message) || e)));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|Failed to fetch|net::|blocked by CORS policy/.test(m.text())) errors.push('console: ' + m.text()); });

  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => typeof window.switchScreen === 'function' && window.BurbzBirdPatchMap, { timeout: 90000 });
  await page.evaluate(() => document.querySelectorAll('.intro-cutscene-overlay').forEach(el => el.remove()));
  await page.waitForTimeout(1200);
  await page.evaluate(() => { localStorage.removeItem('burbz.birdPatches.v1'); switchScreen('scan'); });

  // First hearing of the owl.
  const first = await page.evaluate(async () => {
    window.__burbzBirdPatchDebug.configure();
    const lessons = await BurbzBirdPatchMap.meet([{ commonName: 'Tawny Owl' }], { source: 'sound' });
    return lessons[0];
  });
  check('first owl teaches its patch', first && first.lesson.kind === 'first', first && first.lesson.text);
  await page.waitForFunction(() => BurbzBirdPatchMap.state.miniReady, { timeout: 30000 }).catch(() => {});
  const panel = await page.evaluate(() => {
    const p = document.getElementById('birdPatchPanel');
    const r = p.getBoundingClientRect();
    return { hidden: p.hidden, h: r.height, lesson: document.getElementById('birdPatchLesson').textContent, legend: document.getElementById('birdPatchLegend').textContent };
  });
  check('panel is visible on the scan screen', !panel.hidden && panel.h > 150, panel.h);
  check('legend names the owl and its range', /Tawny Owl.*250 m.*Stays for life/.test(panel.legend), panel.legend);
  const mapReady = await page.evaluate(() => BurbzBirdPatchMap.state.miniReady);
  check('real map loaded around the player', mapReady);
  if (mapReady) {
    const circle = await page.evaluate(() => {
      const d = BurbzBirdPatchMap.state.data['patch-song'];
      return { n: d.features.length, color: d.features[0].properties.color };
    });
    check('coloured owl circle drawn', circle.n === 1 && circle.color === '#b0662a', JSON.stringify(circle));
    await page.scrollIntoViewIfNeeded?.('#birdPatchPanel');
    await page.evaluate(() => document.getElementById('birdPatchPanel').scrollIntoView({ block: 'center' }));
    // The owl is still calling: the next five-second window hears it again.
    await page.evaluate(() => BurbzBirdPatchMap.meet([{ commonName: 'Tawny Owl' }], { source: 'sound' }));
    const samples = [];
    for (let i = 0; i < 6; i++) {
      samples.push(await page.evaluate(() => BurbzBirdPatchMap.state.mini.getPaintProperty('patch-song-fill', 'fill-opacity')));
      await page.waitForTimeout(180);
    }
    const spread = Math.max(...samples) - Math.min(...samples);
    check('circle pulses while the owl sings', spread > 0.05, samples.map(v => v.toFixed(2)).join(' '));
    await page.waitForTimeout(1200);
    if (SHOTS) await page.locator('#birdPatchPanel').screenshot({ path: SHOTS + '/patch-owl-first.png' });
    await page.waitForTimeout(4500);
    const settled = await page.evaluate(() => BurbzBirdPatchMap.state.mini.getPaintProperty('patch-song-fill', 'fill-opacity'));
    check('circle settles when the song stops', Math.abs(settled - 0.14) < 1e-6, settled);
  }

  // Next night: shift the saved meeting back a day, then hear it again nearby.
  const again = await page.evaluate(async () => {
    const key = 'burbz.birdPatches.v1';
    const log = JSON.parse(localStorage.getItem(key));
    log.forEach(e => { e.t -= 24 * 3600 * 1000; });
    localStorage.setItem(key, JSON.stringify(log));
    const lessons = await BurbzBirdPatchMap.meet([{ commonName: 'Tawny Owl' }], { source: 'sound' });
    return lessons[0];
  });
  check('next night: same pair of owls', again && again.lesson.kind === 'same-bird' && /same pair/.test(again.lesson.text), again && again.lesson.text);
  await page.waitForTimeout(1500);
  if (SHOTS) await page.locator('#birdPatchPanel').screenshot({ path: SHOTS + '/patch-owl-same.png' });

  // Robin and Raven together: small circle, huge circle.
  const both = await page.evaluate(async () => BurbzBirdPatchMap.meet([{ commonName: 'European Robin' }, { commonName: 'Raven' }], { source: 'sound' }));
  const rr = Object.fromEntries(both.map(b => [b.name, b.range.radiusM]));
  check('raven roams far wider than a robin', rr.Raven >= 40 * rr['European Robin'], JSON.stringify(rr));
  await page.waitForTimeout(1800);
  if (SHOTS) await page.locator('#birdPatchPanel').screenshot({ path: SHOTS + '/patch-robin-raven.png' });

  // Through the game's own confirm path, as a photo.
  const viaGame = await page.evaluate(async () => {
    const before = JSON.parse(localStorage.getItem('burbz.birdPatches.v1')).length;
    window.__burbzBirdPatchDebug.confirm({ species: 'Blackbird', scientificName: 'Turdus merula', confidence: 0.9 }, [], { source: 'photo' });
    await new Promise(r => setTimeout(r, 1500));
    const log = JSON.parse(localStorage.getItem('burbz.birdPatches.v1'));
    return { added: log.length - before, last: log[log.length - 1] };
  });
  check('game confirm path records the meeting', viaGame.added === 1 && viaGame.last.via === 'photo', JSON.stringify(viaGame.last));

  // The live Map screen carries the same patches.
  await page.evaluate(() => switchScreen('map'));
  await page.waitForFunction(() => { const m = window.__burbzMapDebug.map; return m && m.getLayer && m.getLayer('burbz-bird-patch-known-fill'); }, { timeout: 45000 }).catch(() => {});
  const live = await page.evaluate(() => {
    const m = window.__burbzMapDebug.map;
    if (!m || !m.getLayer('burbz-bird-patch-known-fill')) return null;
    return BurbzBirdPatchMap.state.data['burbz-bird-patch-known'].features.map(f => f.properties.name);
  });
  check('live map shows known patches', live && live.includes('Tawny Owl') && live.includes('Raven'), JSON.stringify(live));
  if (SHOTS) { await page.waitForTimeout(2500); await page.screenshot({ path: SHOTS + '/patch-live-map.png' }); }

  check('zero page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter(r => !r.ok).length;
  console.log(failed ? failed + ' check(s) failed' : 'All ' + results.length + ' checks passed');
  process.exit(failed ? 1 : 0);
})().catch(err => { console.error(err); process.exit(1); });
