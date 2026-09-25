'use strict';
// Browser evidence for Academy day and night (v483): both Academy trees keep
// the game's clock. By day no night art is fetched; from dusk the moonlit
// tree, the lit houses, the star field and the lamplight pools all arrive.
// Run: node tests/run_academy_day_night_v483.cjs  (EVIDENCE_DIR to keep shots)
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
function loadPlaywright() {
  for (const id of ['playwright', '/opt/node22/lib/node_modules/playwright', '/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright']) {
    try { return require(id); } catch (e) {}
  }
  throw Error('Playwright is not installed');
}
const { chromium } = loadPlaywright();
const F = require('./connected_world_fixture_v386.cjs');
const root = path.resolve(__dirname, '..'), out = process.env.EVIDENCE_DIR || '/tmp/burbz-academy-day-night-v483';
const report = { served:{}, missing:[], errors:[], checks:[], night:[] };
const fixture = F.createServer({ root, port:8969, report });
fs.mkdirSync(out, { recursive:true });
let browser;
const pass = text => { report.checks.push(text); console.log('PASS', text); };

async function open(viewport, reducedMotion) {
  const context = await browser.newContext({ viewport, deviceScaleFactor:1, hasTouch:true, serviceWorkers:'block', reducedMotion:reducedMotion ? 'reduce' : 'no-preference' });
  await F.routeMap(context, report);
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  page.on('pageerror', e => report.errors.push(e.message));
  page.on('request', r => { if (r.url().includes('academy-night-20260925')) report.night.push(r.url().split('academy-night-20260925/')[1]); });
  await page.goto(fixture.url, { waitUntil:'domcontentloaded' });
  await page.waitForFunction(() => typeof __testEval === 'function' && __testEval('typeof switchScreen') === 'function');
  const run = code => page.evaluate(code => __testEval(code), code);
  await run("merlinTutActive&&typeof merlinTutClose==='function'&&merlinTutClose();ensureAcademyBuildings(false);for(const id of Object.keys(BurbzAcademy3D.ANCHORS))gameState.academyBuildings[id]=Object.assign(gameState.academyBuildings[id]||{},{built:true});saveState()");
  const hour = async h => { await run(`window.__burbzForceHour=${h};BurbzAcademyDayNight.refresh()`); };
  const shot = name => page.screenshot({ path:path.join(out, name + '.png') });
  return { context, page, run, hour, shot };
}
// Real pixels from a screenshot: the mean brightness of the roots (no houses
// or labels there) and a count of lamp-bright warm pixels.
async function brightness(page, selector, name) {
  const png = await page.locator(selector).first().screenshot({ path:name ? path.join(out, name + '.png') : undefined });
  return page.evaluate(async bytes => {
    const img = new Image(); img.src = 'data:image/png;base64,' + bytes; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let roots = 0, n = 0, lamps = 0;
    for (let i = 0; i < d.length; i += 4) {
      const y = Math.floor(i / 4 / c.width) / c.height;
      if (y > 0.74 && y < 0.9) { roots += (d[i] + d[i + 1] + d[i + 2]) / 3; n++; }
      if (d[i] > 230 && d[i + 1] > 150 && d[i + 2] < 110) lamps++;
    }
    return { roots:roots / n, lamps };
  }, png.toString('base64'));
}

(async () => { try {
  await fixture.listen();
  browser = await chromium.launch({ headless:true, args:['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const phone = await open({ width:390, height:844 });
  const { page, run, hour, shot } = phone;

  // ---- Noon: the day painting, and not one night file fetched -------------
  await hour(12); await run("switchScreen('academy')"); await page.waitForTimeout(1500);
  const noon = await run(`({awake:$('academyTreehouse').classList.contains('dn-awake'),phase:$('academyTreehouse').dataset.daylight,day:getComputedStyle(document.querySelector('.academy-tree-swaybg')).opacity,houses:document.querySelectorAll('.treehouse-building-night[data-night-src]').length,loaded:document.querySelectorAll('.treehouse-building-night[src]').length})`);
  assert.deepEqual(noon, { awake:false, phase:'day', day:'1', houses:12, loaded:0 });
  const dayLight = await brightness(page, '#academyTreehouse', 'probe-day');
  await shot('01-academy-noon');
  await run("switchScreen('scan')"); await page.waitForTimeout(1200);
  assert.equal(await run("document.getElementById('desk-academy-list').classList.contains('dn-awake')"), false);
  assert.deepEqual(report.night, [], 'no night art is fetched by day');
  pass('By day both Academy trees show the day painting and fetch no night art');

  // ---- Night: moonlit tree, lit houses, stars and lamplight ---------------
  await hour(23); await run("switchScreen('academy')");
  await page.waitForFunction(() => [...document.querySelectorAll('.treehouse-building-night')].every(i => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(3000);
  const night = await run(`(()=>{const t=$('academyTreehouse'),stars=t.querySelector('.dn-stars');const g=stars.getContext('2d').getImageData(0,0,stars.width,stars.height).data;let lit=0;for(let i=3;i<g.length;i+=4)if(g[i]>0)lit++;
    return {awake:t.classList.contains('dn-awake'),phase:t.dataset.daylight,day:getComputedStyle(t.querySelector('.academy-tree-swaybg')).opacity,
      nightTree:getComputedStyle(t.querySelector('.academy-tree-night')).backgroundImage.includes('academy-night-20260925/manga/tree.webp'),
      houses:[...t.querySelectorAll('.treehouse-building-night')].map(i=>getComputedStyle(i).opacity),pools:t.querySelectorAll('.academy-night-pool').length,
      poolLayer:getComputedStyle($('academyNightPools')).opacity,boughs:[...t.querySelectorAll('.ab-night')].filter(i=>i.naturalWidth>0).length,starPixels:lit,
      moon:getComputedStyle(t.querySelector('.dn-moon')).opacity}})()`);
  assert.equal(night.awake, true); assert.equal(night.phase, 'night'); assert.equal(night.day, '0', 'the day painting has faded out');
  assert(night.nightTree, 'the moonlit tree is painted'); assert.equal(night.houses.length, 12); assert(night.houses.every(o => o === '1'), 'every house shows its lit night picture');
  assert.equal(night.pools, 12, 'one lamplight pool per house'); assert.equal(night.poolLayer, '1'); assert.equal(night.boughs, 6, 'all six boughs have their night copy');
  assert(night.starPixels > 200, 'the star field is drawn'); assert.equal(night.moon, '1');
  const nightLight = await brightness(page, '#academyTreehouse', 'probe-night');
  console.log('brightness', JSON.stringify({ day:dayLight, night:nightLight }));
  assert(nightLight.roots < dayLight.roots * 0.75, `the roots are moonlit (${nightLight.roots.toFixed(0)} vs ${dayLight.roots.toFixed(0)} by day)`);
  assert(nightLight.lamps > 150, `lamps burn in the windows (${nightLight.lamps} px)`);
  await shot('02-academy-night');
  pass(`At night the Academy is moonlit (roots ${nightLight.roots.toFixed(0)} vs ${dayLight.roots.toFixed(0)} by day), ${nightLight.lamps} px of lamplight, stars and a moon`);

  await run("switchScreen('scan')");
  await page.waitForFunction(() => [...document.querySelectorAll('.home-tree-house-night')].length > 0 && [...document.querySelectorAll('.home-tree-house-night')].every(i => i.complete && i.naturalWidth > 0));
  await page.waitForTimeout(1500);
  const home = await run(`(()=>{const list=document.getElementById('desk-academy-list');return {awake:list.classList.contains('dn-awake'),art:getComputedStyle(list.querySelector('.home-tree-art')).opacity,
    night:getComputedStyle(list.querySelector('.home-tree-night')).backgroundImage.includes('academy-night-20260925/home/tree.webp'),
    houses:list.querySelectorAll('.home-tree-house').length,lit:[...list.querySelectorAll('.home-tree-house-night')].map(i=>getComputedStyle(i).opacity),
    pools:list.querySelectorAll('.home-tree-pool').length,sky:!!list.querySelector('.home-tree-sky .dn-stars')}})()`);
  assert.equal(home.awake, true); assert.equal(home.art, '0'); assert(home.night, 'Home paints the moonlit tree');
  assert(home.houses >= 1 && home.lit.length === home.houses && home.lit.every(o => o === '1'), 'every Home house is lit');
  assert.equal(home.pools, home.houses); assert(home.sky, 'Home has its own night sky');
  await page.locator('#screen-scan .home-tree').first().screenshot({ path:path.join(out, '03-home-night.png') });
  pass(`At night Home's Academy shows the moonlit tree and ${home.houses} lit houses`);

  // ---- Dusk: the golden hour, lamps coming on ------------------------------
  await hour(18); await run("switchScreen('academy')"); await page.waitForTimeout(1500);
  const dusk = await run(`(()=>{const t=$('academyTreehouse');return {phase:t.dataset.daylight,warm:+getComputedStyle(t.querySelector('.academy-dusk')).opacity,day:+getComputedStyle(t.querySelector('.academy-tree-swaybg')).opacity,lamps:+getComputedStyle($('academyNightPools')).opacity}})()`);
  assert.equal(dusk.phase, 'dusk'); assert(dusk.warm > 0.9, 'the golden-hour wash is on'); assert(dusk.day > 0.4 && dusk.day < 0.6, 'the day painting is half faded');
  assert(dusk.lamps > 0.1 && dusk.lamps < 0.5, 'the lamps are coming on');
  await shot('04-academy-dusk');
  pass('At 18:00 the Academy glows gold, half day and half night, lamps coming on');
  await phone.context.close();

  // ---- Wide boxes use the wide night tree ----------------------------------
  report.night = [];
  const laptop = await open({ width:1280, height:800 });
  await laptop.hour(22); await laptop.run("switchScreen('academy')"); await laptop.page.waitForTimeout(2500);
  assert(report.night.includes('manga/tree-wide.webp'), 'the wide night tree is fetched');
  assert(!report.night.includes('manga/tree.webp'), 'the tall night tree is not fetched on a wide box');
  await laptop.shot('05-academy-night-wide');
  pass('A wide Academy fetches only the wide night painting');
  await laptop.context.close();

  // ---- Reduced motion: the stars hold still --------------------------------
  const calm = await open({ width:390, height:844 }, true);
  await calm.hour(23); await calm.run("switchScreen('academy')"); await calm.page.waitForTimeout(1500);
  const still = await calm.run(`({twinkle:getComputedStyle(document.querySelector('#academyTreehouse .dn-twinkle')).animationName,shooting:getComputedStyle(document.querySelector('#academyTreehouse .dn-shooting-star')).display,tree:getComputedStyle(document.querySelector('.academy-tree-night')).animationName})`);
  assert.deepEqual(still, { twinkle:'none', shooting:'none', tree:'none' });
  pass('Reduced motion stills the stars, the shooting star and the sway');
  await calm.context.close();

  // ---- Offline with no night painting: the day tree stays up ---------------
  const lost = await open({ width:390, height:844 });
  await lost.context.route('**/academy-night-20260925/manga/tree.webp', r => r.abort('internetdisconnected'));
  await lost.hour(23); await lost.run("switchScreen('academy')");
  await lost.page.waitForFunction(() => document.getElementById('academyTreehouse').classList.contains('dn-no-night'));
  await lost.page.waitForTimeout(800);
  assert.equal(await lost.run("getComputedStyle(document.querySelector('.academy-tree-swaybg')).opacity"), '1');
  await lost.shot('06-academy-night-no-art');
  pass('If the night painting cannot load, the day painting stays up under a moonlit shade');
  await lost.context.close();

  assert.deepEqual(report.errors, [], 'no page errors');
  console.log(`${report.checks.length} Academy day and night browser checks passed. Shots: ${out}`);
} catch (e) { console.error(e); console.error(JSON.stringify(report.errors)); process.exitCode = 1; }
finally { await browser?.close(); fixture.server.close(); } })();
