'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/oauth-station/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const repoRoot = path.resolve(root, '..', '..');
const out = process.env.EVIDENCE_DIR || path.resolve(root, 'tests/evidence/academy-home-20260922');
fs.mkdirSync(out, { recursive:true });

const changedProductAndTestFiles = [
  'public/burbz/index.html',
  'public/burbz/scan_home.css',
  'public/burbz/scan_home.js',
  'public/burbz/scan_home_core.js',
  'public/burbz/academy_home_intro.js',
  'public/burbz/sw.js',
  'scripts/update-live-burbz.sh',
  'public/burbz/tests/run_academy_home_20260922.cjs',
  'public/burbz/tests/run_academy_home_cache_smoke_20260923.cjs',
  'public/burbz/tests/run_academy_home_intro_20260922.cjs',
  'public/burbz/tests/test_scan_home_academy_projection_20260922.cjs',
  'public/burbz/tests/test_academy_home_intro_20260922.cjs',
  'public/burbz/tests/test_academy_home_cache_pins_20260923.cjs'
];
const hashFile = file => crypto.createHash('sha256').update(fs.readFileSync(path.resolve(repoRoot, file))).digest('hex');
const collectHashes = () => Object.fromEntries(changedProductAndTestFiles.map(file => [file, hashFile(file)]));
const report = { checks:[], errors:[], consoleErrors:[], networkNotes:[], blocked:[], missing:[], screenshots:[], changedProductAndTestFiles, hashes:{ start:collectHashes() } };
const pass = (name, detail = true) => { report.checks.push({ name, detail }); console.log('PASS', name); };
const save = () => { report.hashes.end = collectHashes(); fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(report, null, 2)); };

const seed = `
if(!localStorage.getItem('__academy_home_seeded_20260922')){
  localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
  localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
  localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
  const f=JSON.parse(JSON.stringify(DEFAULT_STATE));
  Object.assign(f.player,{name:'Rowan',level:20,coins:200000,branches:200000,stone:1000});
  f.settings={music:false,sfx:false,vibration:false,appearance:'normal'};
  for(const q of PLAYER_QUESTS)f.quests[q.id]={progress:q.target,claimed:true};
  localStorage.setItem('burbz_state',JSON.stringify(f));
  localStorage.setItem('__academy_home_seeded_20260922','1');
}
`;

function contentType(file) {
  return ({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav','.woff2':'font/woff2'})[path.extname(file)] || 'application/octet-stream';
}

function serve() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1/');
    const name = decodeURIComponent(url.pathname).replace(/^\/burbz\//, '') || 'index.html';
    const file = path.resolve(root, name);
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try {
      let bytes;
      try { bytes = fs.readFileSync(file); }
      catch (error) {
        // Sparse-clone QA only: reuse deployed static art read-only, never code.
        if (!/^(assets|bird-art-cache|icons|fonts)\//.test(name)) throw error;
        const fallback = fs.readFileSync('/etc/burbz-webroot', 'utf8').trim();
        bytes = fs.readFileSync(path.join(fallback, name));
      }
      if (name === 'index.html') {
        const html = bytes.toString();
        bytes = Buffer.from(html.replace('\ninit();', '\nwindow.__testEval=code=>eval(code);\n' + seed + '\ninit();'));
      }
      res.setHeader('Content-Type', contentType(file));
      res.setHeader('Cache-Control', 'no-cache');
      res.end(bytes);
    } catch (error) {
      report.missing.push(name);
      res.writeHead(404);
      res.end(error.message);
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url:`http://127.0.0.1:${port}/burbz/` });
    });
  });
}

async function touchScroll(page, selector) {
  const box = await page.locator(selector).boundingBox();
  assert(box, selector + ' has a box');
  const client = await page.context().newCDPSession(page);
  const x = Math.round(box.x + box.width / 2);
  const y1 = Math.round(box.y + box.height * 0.78);
  const y2 = Math.round(box.y + box.height * 0.24);
  await client.send('Input.dispatchTouchEvent', { type:'touchStart', touchPoints:[{ x, y:y1, radiusX:4, radiusY:4, force:1 }] });
  await client.send('Input.dispatchTouchEvent', { type:'touchMove', touchPoints:[{ x, y:y2, radiusX:4, radiusY:4, force:1 }] });
  await client.send('Input.dispatchTouchEvent', { type:'touchEnd', touchPoints:[] });
}

function evidenceName(label, ext = 'json') {
  return String(label).replace(/[^a-z0-9._-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() + '.' + ext;
}

function writeEvidenceJson(name, value) {
  fs.writeFileSync(path.join(out, name), JSON.stringify(value, null, 2));
  return name;
}

async function elementInfo(page, query) {
  return page.evaluate(q => {
    const normalizeText = value => String(value || '').replace(/\s+/g, ' ').trim();
    const candidates = Array.from(document.querySelectorAll(q.selector || '')).filter(el => !q.text || normalizeText(el.textContent).includes(q.text));
    const el = candidates[q.index || 0] || null;
    const rectOf = node => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left:+r.left.toFixed(2), top:+r.top.toFixed(2), right:+r.right.toFixed(2), bottom:+r.bottom.toFixed(2), width:+r.width.toFixed(2), height:+r.height.toFixed(2), x:+r.x.toFixed(2), y:+r.y.toFixed(2) };
    };
    const overflowText = node => {
      if (!node) return '';
      const style = getComputedStyle(node);
      return style.overflow + style.overflowX + style.overflowY;
    };
    const clips = node => /(auto|scroll|hidden|clip)/.test(overflowText(node));
    const clipIntersection = node => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      let left = Math.max(0, r.left), top = Math.max(0, r.top);
      let right = Math.min(window.innerWidth, r.right), bottom = Math.min(window.innerHeight, r.bottom);
      for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        if (!clips(parent)) continue;
        const pr = parent.getBoundingClientRect();
        left = Math.max(left, pr.left);
        top = Math.max(top, pr.top);
        right = Math.min(right, pr.right);
        bottom = Math.min(bottom, pr.bottom);
      }
      return { left:+left.toFixed(2), top:+top.toFixed(2), right:+right.toFixed(2), bottom:+bottom.toFixed(2), width:+Math.max(0, right - left).toFixed(2), height:+Math.max(0, bottom - top).toFixed(2) };
    };
    const scroller = document.getElementById('academyHomeRooms');
    if (!el) return { found:false, query:q, scroller:{ scrollTop:scroller ? scroller.scrollTop : null, rect:rectOf(scroller) } };
    const rect = rectOf(el);
    const clipped = clipIntersection(el);
    const center = { x:+((clipped.left + clipped.right) / 2).toFixed(2), y:+((clipped.top + clipped.bottom) / 2).toFixed(2) };
    const hit = clipped.width > 0 && clipped.height > 0 ? document.elementFromPoint(center.x, center.y) : null;
    let clipper = null;
    for (let parent = el.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      const style = getComputedStyle(parent);
      const scrollable = /(auto|scroll)/.test(style.overflowY + style.overflow);
      if (scrollable && parent.scrollHeight > parent.clientHeight + 2) {
        clipper = parent;
        break;
      }
    }
    const scrollerRect = rectOf(scroller);
    const rawClipperRect = rectOf(clipper);
    const clipperOutsideScroller = !!(clipper && scrollerRect && rawClipperRect && (rawClipperRect.bottom < scrollerRect.top || rawClipperRect.top > scrollerRect.bottom || rect.bottom < scrollerRect.top || rect.top > scrollerRect.bottom));
    const targetBelow = rect.bottom > clipped.bottom + 1;
    const targetAbove = rect.top < clipped.top - 1;
    const clipperCanScrollToward = !!(clipper && ((targetAbove && clipper.scrollTop > 0) || (targetBelow && clipper.scrollTop + clipper.clientHeight < clipper.scrollHeight - 2)));
    const wheelHost = clipperOutsideScroller || !clipperCanScrollToward ? scroller : (clipper || scroller);
    const clipperRect = rectOf(wheelHost);
    const mainScrollerWheel = wheelHost && scroller && wheelHost === scroller;
    const fullyVisible = clipped.width >= Math.min(rect.width, 44) - 1 && clipped.height >= Math.min(rect.height, 44) - 1 && !targetBelow && !targetAbove;
    return {
      found:true,
      query:q,
      text:normalizeText(el.textContent).slice(0, 120),
      rect,
      clipped,
      center,
      hit:{ ok:!!(hit && (hit === el || el.contains(hit))), target:hit ? (hit.id ? '#' + hit.id : normalizeText(hit.className || hit.tagName).slice(0, 80)) : null },
      fullyVisible,
      targetBelow,
      targetAbove,
      scroller:{ scrollTop:scroller ? +scroller.scrollTop.toFixed(2) : null, clientHeight:scroller ? scroller.clientHeight : null, scrollHeight:scroller ? scroller.scrollHeight : null, rect:rectOf(scroller) },
      clipper:clipper ? { tag:clipper.tagName, id:clipper.id || '', className:normalizeText(clipper.className).slice(0, 120), scrollTop:+clipper.scrollTop.toFixed(2), clientHeight:clipper.clientHeight, scrollHeight:clipper.scrollHeight, rect:clipperRect } : null,
      wheelPoint:clipperRect ? {
        x:+Math.min(window.innerWidth - 4, Math.max(4, mainScrollerWheel ? clipperRect.left + 12 : clipperRect.left + clipperRect.width / 2)).toFixed(2),
        y:+Math.min(window.innerHeight - 4, Math.max(4, clipperRect.top + clipperRect.height / 2)).toFixed(2)
      } : { x:Math.round(window.innerWidth / 2), y:Math.round(window.innerHeight / 2) }
    };
  }, query);
}

async function exposeByWheel(page, query, label, options = {}) {
  const maxSteps = options.maxSteps || 48;
  const motion = [];
  for (let step = 0; step <= maxSteps; step += 1) {
    const info = await elementInfo(page, query);
    motion.push({ step, info });
    if (!info.found) throw new Error(label + ' not found: ' + JSON.stringify(query));
    if (info.fullyVisible && info.hit.ok) {
      const file = writeEvidenceJson(evidenceName('motion-' + label), { label, query, motion });
      report.motionSequences = report.motionSequences || [];
      report.motionSequences.push(file);
      return { ...info, motionFile:file };
    }
    const point = info.wheelPoint || { x:200, y:400 };
    const deltaY = info.targetAbove ? -Math.abs(options.deltaY || 180) : Math.abs(options.deltaY || 180);
    await page.mouse.move(point.x, point.y);
    await page.mouse.wheel(0, deltaY);
    await page.waitForTimeout(options.pauseMs || 80);
  }
  const file = writeEvidenceJson(evidenceName('motion-' + label + '-failed'), { label, query, motion });
  report.motionSequences = report.motionSequences || [];
  report.motionSequences.push(file);
  throw new Error(label + ' was not reachable by wheel; evidence ' + file);
}

async function nativeClick(page, query, label, options = {}) {
  const info = await exposeByWheel(page, query, label, options);
  await page.mouse.click(info.center.x, info.center.y);
  return info;
}

async function collectFloorAudit(page, label) {
  const audit = await page.evaluate(labelText => {
    const round = value => +Number(value || 0).toFixed(2);
    const rectOf = node => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return { left:round(r.left), top:round(r.top), right:round(r.right), bottom:round(r.bottom), width:round(r.width), height:round(r.height), x:round(r.x), y:round(r.y) };
    };
    const styleOf = node => {
      if (!node) return null;
      const style = getComputedStyle(node);
      return { overflow:style.overflow, overflowX:style.overflowX, overflowY:style.overflowY, display:style.display, minHeight:style.minHeight, flexShrink:style.flexShrink };
    };
    const clipped = node => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      let left = Math.max(0, r.left), top = Math.max(0, r.top);
      let right = Math.min(window.innerWidth, r.right), bottom = Math.min(window.innerHeight, r.bottom);
      for (let parent = node.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
        const style = getComputedStyle(parent);
        if (!/(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) continue;
        const pr = parent.getBoundingClientRect();
        left = Math.max(left, pr.left);
        top = Math.max(top, pr.top);
        right = Math.min(right, pr.right);
        bottom = Math.min(bottom, pr.bottom);
      }
      return { left:round(left), top:round(top), right:round(right), bottom:round(bottom), width:round(Math.max(0, right - left)), height:round(Math.max(0, bottom - top)) };
    };
    const nodeMetric = node => ({
      rect:rectOf(node),
      clipped:clipped(node),
      clientHeight:node ? node.clientHeight : null,
      scrollHeight:node ? node.scrollHeight : null,
      clientWidth:node ? node.clientWidth : null,
      scrollWidth:node ? node.scrollWidth : null,
      scrollTop:node ? round(node.scrollTop) : null,
      style:styleOf(node)
    });
    const scroller = document.getElementById('academyHomeRooms');
    const tree = document.getElementById('academyHomeTree');
    const rooms = Array.from(document.querySelectorAll('#academyHomeRooms .academy-home-room')).map(card => {
      const banner = card.querySelector('.academy-home-room-banner');
      const title = card.querySelector('h3');
      const body = card.querySelector('p');
      const native = card.querySelector('.academy-home-room-native');
      const controls = Array.from(card.querySelectorAll('button')).map(button => ({ text:button.textContent.replace(/\s+/g, ' ').trim().slice(0, 80), disabled:button.disabled, rect:rectOf(button), clipped:clipped(button), clientHeight:button.clientHeight, scrollHeight:button.scrollHeight }));
      return {
        id:card.dataset.room,
        card:nodeMetric(card),
        banner:nodeMetric(banner),
        title:nodeMetric(title),
        body:nodeMetric(body),
        native:nodeMetric(native),
        nativePanel:nodeMetric(card.querySelector('.academy-home-native-panel')),
        nestedScrollers:Array.from(card.querySelectorAll('.training-hall-panel,.stores-panel,.magpie-panel,.manager-office-panel,.kitchen-roster,.room-bird-list')).map(node => ({ className:String(node.className), metric:nodeMetric(node) })),
        controls
      };
    });
    return {
      label:labelText,
      viewport:{ width:window.innerWidth, height:window.innerHeight, devicePixelRatio:window.devicePixelRatio },
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      appearance:document.documentElement.dataset.appearance || document.body.dataset.appearance || '',
      tree:{ ownedCount:Number(tree && tree.dataset.ownedCount || 0), className:tree ? String(tree.className) : '' },
      scroller:nodeMetric(scroller),
      rooms
    };
  }, label);
  const file = writeEvidenceJson(evidenceName('floor-audit-' + label), audit);
  report.floorAudits = report.floorAudits || [];
  report.floorAudits.push(file);
  return audit;
}

async function settleCompletionNotices(page, run) {
  const steps = [];
  for (let i = 0; i < 16; i += 1) {
    await run("switchScreen('scan');renderScanHome();renderCompletionNotices();");
    const remaining = await run('(gameState.completionNotices||[]).map(n=>({id:n.id,kind:n.kind,title:n.title}))');
    if (!remaining.length) {
      report.completionNoticeDismissal = steps;
      return steps;
    }
    const visibleClose = page.locator('#completionNoticeStack .completion-notice-close:visible').first();
    if (await visibleClose.count()) {
      const before = await visibleClose.getAttribute('data-notice-dismiss');
      await visibleClose.click();
      steps.push({ kind:'visible-close', id:before });
      await page.waitForTimeout(160);
      continue;
    }
    const deskNoticeVisible = await page.locator('#desk-empire-notices').evaluate(el => !!el && !el.hidden && el.offsetParent !== null).catch(() => false);
    if (deskNoticeVisible) {
      await page.locator('#desk-empire-notices').click();
      await page.locator('#homeBuildingNotices[open]').waitFor();
      const row = page.locator('#homeBuildingNotices [data-home-action^="complete-"]').first();
      if (await row.count()) {
        const action = await row.getAttribute('data-home-action');
        await row.click();
        steps.push({ kind:'home-completed-surface', action });
        await page.waitForTimeout(220);
        continue;
      }
      await run('BurbzScanHome.closeBuildPicker?.(false);try{document.getElementById("homeBuildingNotices")?.close();}catch(e){}');
    }
    throw new Error('Completion notices remain but no native dismissal surface was reachable: ' + JSON.stringify(remaining));
  }
  throw new Error('Completion notices did not settle after repeated native dismissal attempts');
}

(async () => {
  let browser, server;
  try {
    const served = await serve();
    server = served.server;
    browser = await chromium.launch({ headless:true, executablePath:chromium.executablePath(), args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream'] });
    const context = await browser.newContext({ viewport:{ width:390, height:844 }, hasTouch:true, serviceWorkers:'block', reducedMotion:'reduce' });
    await context.grantPermissions(['microphone', 'camera'], { origin:new URL(served.url).origin });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') return route.continue();
      report.blocked.push(route.request().url());
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    const run = code => page.evaluate(code => window.__testEval(code), code);
    page.on('pageerror', e => report.errors.push(e.message));
    page.on('console', m => {
      if (m.type() !== 'error') return;
      const text = m.text();
      if (text.includes('ERR_BLOCKED_BY_CLIENT') || text.includes('tiles.openfreemap.org') || text.includes('status of 404')) report.networkNotes.push(text);
      else report.consoleErrors.push(text);
    });
    await page.goto(served.url, { waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan', null, { timeout:60000 });
    const seedProbe = 'seed-probe-' + Date.now();
    const seedReloadBefore = await run(`(() => {
      const saved = JSON.parse(localStorage.getItem('burbz_state') || '{}');
      saved.player = saved.player || {};
      saved.player.coins = 1234567;
      saved.__academyHomeSeedProbe = '${seedProbe}';
      localStorage.setItem('burbz_state', JSON.stringify(saved));
      return { profile:saved.photoProfileId, coins:saved.player.coins, probe:saved.__academyHomeSeedProbe, seeded:localStorage.getItem('__academy_home_seeded_20260922') };
    })()`);
    await page.reload({ waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan', null, { timeout:60000 });
    const seedReloadAfter = await run(`(() => {
      const raw = localStorage.getItem('burbz_state') || '{}';
      const saved = JSON.parse(raw);
      return { profile:saved.photoProfileId, coins:saved.player?.coins, probe:saved.__academyHomeSeedProbe, seeded:localStorage.getItem('__academy_home_seeded_20260922'), stateLength:raw.length };
    })()`);
    assert.equal(seedReloadAfter.profile, seedReloadBefore.profile);
    assert.equal(seedReloadAfter.coins, 1234567);
    assert.equal(seedReloadAfter.probe, seedProbe);
    assert.equal(seedReloadAfter.seeded, '1');
    await run('gameState.player.coins=200000;saveState();renderScanHome();');
    pass('seed-once fixture does not rewrite the synthetic save on reload', { before:seedReloadBefore, after:seedReloadAfter });

    await run("switchScreen('academy')");
    assert.equal(await run('currentScreen'), 'scan');
    assert.equal(await page.locator('#screen-academy.active').count(), 0);
    pass('ordinary Academy route aliases to scan Home before the old screen lifecycle');

    await run(`
      gameState.academyBuildings = { outdoors:{ built:true, builtAt:'starter' } };
      gameState.birdExpeditions = [];
      gameState.birdTrainingSessions = [];
      gameState.flock = gameState.flock && gameState.flock.length ? gameState.flock : [(() => {
        const bird = createBirdEntry('Great Tit','Parus major',.94);
        bird.id = 'fresh-outdoor';
        bird.level = 2;
        bird.hp = bird.maxHp || 100;
        bird.maxHp = bird.maxHp || 100;
        normalizeBirdCare(bird);
        ensureBirdAcademy(bird);
        bird.academy.room = 'outdoors';
        bird.academy.lastForage = null;
        bird.academy.lastGroom = null;
        bird.care.hunger = 35;
        bird.care.happiness = 75;
        return bird;
      })()];
      saveState();
      renderScanHome();
    `);
	    await page.locator('#academyHomeTree').waitFor();
		    assert.equal(await page.locator('#academyHomeRooms [data-room="outdoors"]').count(), 1);
		    assert.equal(await page.locator('#academyHomeRooms .academy-home-room').count(), 1);
		    assert(await page.locator('[data-home-native-room="outdoors"] .academy-bird-row').count() >= 1, 'fresh Outdoors proof includes at least one bird');
		    assert.equal(await page.locator('#academyHomeRooms [data-home-native-room="outdoors"] button').filter({ hasText:/^Build\b/ }).count(), 0, 'fresh ordinary room feed has no Build buttons');
		    const fewRoomSize = await page.locator('#academyHomeRooms .academy-home-room').first().evaluate(el => ({ height:el.getBoundingClientRect().height, minHeight:parseFloat(getComputedStyle(el).minHeight) || 0 }));
		    const fewAudit = await collectFloorAudit(page, 'few-outdoors-only');
		    assert.equal(fewAudit.rooms.length, 1);
		    assert.equal(fewAudit.rooms[0].id, 'outdoors');
		    assert(fewAudit.rooms[0].banner.rect.height >= 110, JSON.stringify(fewAudit.rooms[0].banner));
		    assert.equal(fewAudit.scroller.scrollTop, 0);
		    await page.screenshot({ path:path.join(out, 'fresh-outdoors-only-home.png'), fullPage:true });
		    report.screenshots.push('fresh-outdoors-only-home.png');
		    pass('ordinary fresh Home shows only owned Outdoors with enlarged original-art room composition', { fewRoomSize, banner:fewAudit.rooms[0].banner.rect, body:fewAudit.rooms[0].body.rect });

    const purity = await run(`(() => {
      const savedState = JSON.stringify(gameState);
      const savedStorage = localStorage.getItem('burbz_state');
      const originalSave = saveState;
      const originalDurable = typeof durableSaveState === 'function' ? durableSaveState : null;
      const originalCloud = typeof queueCloudSave === 'function' ? queueCloudSave : null;
      let saveCalls = 0, durableCalls = 0, cloudCalls = 0;
      saveState = function(){ saveCalls += 1; return true; };
      if (originalDurable) durableSaveState = function(){ durableCalls += 1; return true; };
      if (originalCloud) queueCloudSave = function(){ cloudCalls += 1; return true; };
      try {
        const now = Date.now();
        gameState = JSON.parse(savedState);
        gameState.player.level = 20;
        gameState.player.coins = 200000;
        gameState.player.branches = 200000;
        gameState.settings = { music:false, sfx:false, vibration:false, appearance:'normal' };
        gameState.academyBuildings = {};
        for (const id of ACADEMY_BUILDING_ORDER) {
          const c = ACADEMY_BUILDINGS[id];
          gameState.academyBuildings[id] = { built:true, builtAt:'purity', x:c.x, y:c.y };
        }
        gameState.flock = [
          { id:'sparse-chef', commonName:'Sparse Goldcrest', species:'Goldcrest', scientificName:'Regulus regulus', hp:72, maxHp:80, level:4, rarity:'common', power:40, care:'bad-care', training:null, academy:{ room:'kitchen', disciplines:'bad' } },
          { id:'malformed-room', commonName:'Malformed Blue Tit', species:'Blue Tit', scientificName:'Cyanistes caeruleus', hp:50, maxHp:60, level:3, rarity:'common', power:35, academy:{ room:'unknown-room' } },
          { id:'sparse-training', commonName:'Sparse Great Tit', species:'Great Tit', scientificName:'Parus major', hp:90, maxHp:90, level:5, rarity:'common', power:45, care:{ hunger:88 }, academy:{ room:'training' } },
          { id:'sparse-quest', commonName:'Sparse Crow', species:'Carrion Crow', scientificName:'Corvus corone', hp:110, maxHp:110, level:7, rarity:'uncommon', power:64, care:{ hunger:30, happiness:70 }, training:{ trainCount:2 }, academy:{ room:'quest_roost' } }
        ];
        gameState.birdRoles = { academy:{ kitchen:'sparse-chef' }, villages:{}, regions:{} };
        gameState.chefCareers = { 'sparse-chef':{ activeSince:now - 10 * 24 * 60 * 60 * 1000, totalMs:0 } };
        gameState.birdTrainingSessions = [{ id:'bad-training-session' }];
        gameState.birdExpeditions = [{ id:'bad-expedition' }];
        gameState.pantry = { ...DEFAULT_PANTRY, seeds:3, insects:3, meat:3 };
        gameState.pantryLastRefill = new Date(now).toISOString();
        gameState.inventory = { ...(gameState.inventory || {}), items:{}, gear:{}, larder:{ small_bird_prey_ration:2, sunflower_seeds:2 } };
        gameState.merlinCare = { hunger:20, happiness:80, energy:100 };
        gameState.completionNotices = [];
        const before = JSON.stringify(gameState);
        const idle = { saveCalls, durableCalls, cloudCalls };
        renderScanHome();
        renderScanHome();
        const after = JSON.stringify(gameState);
        const diffPaths = [];
        const collectDiffs = (a, b, path) => {
          if (diffPaths.length >= 24) return;
          if (JSON.stringify(a) === JSON.stringify(b)) return;
          const objectA = a && typeof a === 'object';
          const objectB = b && typeof b === 'object';
          if (!objectA || !objectB) { diffPaths.push(path || '<root>'); return; }
          const keys = new Set([...Object.keys(a || {}), ...Object.keys(b || {})]);
          for (const key of keys) collectDiffs(a && a[key], b && b[key], path ? path + '.' + key : key);
        };
        collectDiffs(JSON.parse(before), JSON.parse(after), '');
        const coordTexts = Array.from(document.querySelectorAll('#academyHomeRooms .academy-home-chip')).map(el => el.textContent.trim()).filter(text => /^-?\\d+\\s*[·,]\\s*-?\\d+$/.test(text));
        return {
          same: before === after,
          diffPaths,
          saveCalls,
          durableCalls,
          cloudCalls,
          idle,
          storageSame: localStorage.getItem('burbz_state') === savedStorage,
          coordTexts
        };
      } finally {
        saveState = originalSave;
        if (originalDurable) durableSaveState = originalDurable;
        if (originalCloud) queueCloudSave = originalCloud;
        gameState = JSON.parse(savedState);
        localStorage.setItem('burbz_state', savedStorage);
        renderScanHome();
      }
    })()`);
    assert.deepEqual(purity, { same:true, diffPaths:[], saveCalls:0, durableCalls:0, cloudCalls:0, idle:{ saveCalls:0, durableCalls:0, cloudCalls:0 }, storageSame:true, coordTexts:[] });
    pass('repeated Home render is pure for sparse/malformed bird fields and hides internal coordinate chips', purity);

    const beforeBrowse = await run('JSON.stringify({coins:gameState.player.coins,branches:gameState.player.branches,buildings:gameState.academyBuildings})');
    await page.locator('[data-home-action="build-rooms"]').first().click();
    await page.locator('#academyBuildPicker[open]').waitFor();
    const rows = await page.locator('#academyBuildPicker .academy-building-card').evaluateAll(cards => cards.map(card => card.dataset.building));
    assert(rows.includes('tavern'));
    assert(!rows.includes('outdoors'));
    assert(!rows.includes('kitchen'));
    await page.keyboard.press('Tab');
    await page.keyboard.press('ArrowDown');
    assert.equal(await run('JSON.stringify({coins:gameState.player.coins,branches:gameState.player.branches,buildings:gameState.academyBuildings})'), beforeBrowse);
    pass('Build rooms picker is separate, focusable, excludes Outdoors, hides Kitchen and browsing never spends');

    const feedSeparation = await run(`(() => {
      BurbzScanHome.closeBuildPicker(false);
      const savedState = JSON.stringify(gameState);
      const savedStorage = localStorage.getItem('burbz_state');
      try {
        const makeBird = (id, name, scientific, room) => {
          const bird = createBirdEntry(name, scientific, .92);
          bird.id = id;
          bird.level = 8;
          bird.hp = bird.maxHp || 100;
          bird.maxHp = bird.maxHp || 100;
          normalizeBirdCare(bird);
          ensureBirdAcademy(bird);
          bird.academy.room = room;
          bird.care.hunger = 35;
          bird.care.happiness = 80;
          return bird;
        };
        gameState = JSON.parse(savedState);
        gameState.player.coins = 200000;
        gameState.player.branches = 200000;
        gameState.academyBuildings = {
          outdoors:{ built:true, builtAt:'starter' },
          tavern:{ built:true, builtAt:'r6-feed-proof', x:ACADEMY_BUILDINGS.tavern.x, y:ACADEMY_BUILDINGS.tavern.y },
          training:{ built:true, builtAt:'r6-feed-proof', x:ACADEMY_BUILDINGS.training.x, y:ACADEMY_BUILDINGS.training.y },
          hospital:{ built:true, builtAt:'r6-feed-proof', x:ACADEMY_BUILDINGS.hospital.x, y:ACADEMY_BUILDINGS.hospital.y }
        };
        const flow = tutorialFlowState();
        flow.kitchenIntroduced = false;
        gameState.birdExpeditions = [];
        gameState.birdTrainingSessions = [];
        gameState.birdRoles = { academy:{}, villages:{}, regions:{} };
        gameState.flock = [
          makeBird('r6-outdoor','Great Tit','Parus major','outdoors'),
          makeBird('r6-unbuilt-library','Raven','Corvus corax','library'),
          makeBird('r6-hidden-kitchen','Goldcrest','Regulus regulus','kitchen')
        ];
        const before = {
          coins:gameState.player.coins,
          branches:playerBranches(),
          buildings:JSON.stringify(gameState.academyBuildings),
          storage:localStorage.getItem('burbz_state')
        };
        renderScanHome();
        const model = window.BurbzScanHomeCore.projectAcademyRooms({
          academyBuildings:gameState.academyBuildings,
          flock:gameState.flock,
          birdExpeditions:gameState.birdExpeditions,
          birdRoles:gameState.birdRoles,
          player:{ level:gameState.player.level, coins:gameState.player.coins, branches:playerBranches() },
          openingProgress:openingProgress(),
          kitchenIntroduced:openingProgress().kitchenIntroduced
        }, { catalog:TREEHOUSE_ROOM_CATALOG });
        const outdoors = model.rooms.find(room => room.id === 'outdoors');
        const feedButtons = Array.from(document.querySelectorAll('#academyHomeRooms [data-home-native-room] button')).map(button => ({
          text:button.textContent.replace(/\\s+/g,' ').trim(),
          onclick:button.getAttribute('onclick') || '',
          room:button.closest('[data-home-native-room]')?.dataset.homeNativeRoom || ''
        }));
        const buildLeakButtons = feedButtons.filter(button => /^Build\\b/.test(button.text) || button.onclick.includes('academyBuildAndMoveBird'));
        const hiddenKitchenLeaks = feedButtons.filter(button => /\bKITCHEN\b/.test(button.text.toUpperCase()) || button.onclick.includes(",'kitchen'") || button.onclick.includes(',"kitchen"'));
        const nativeOutdoors = Array.from(document.querySelectorAll('[data-home-native-room="outdoors"] .academy-bird-row [data-bird-info]')).map(el => el.dataset.birdInfo);
        BurbzScanHome.openBuildPicker();
        const pickerRows = Array.from(document.querySelectorAll('#academyBuildPicker .academy-building-card')).map(card => card.dataset.building);
        BurbzScanHome.closeBuildPicker(false);
        academyBuildAndMoveBird('r6-unbuilt-library','library');
        const afterCompatibilityCall = {
          coins:gameState.player.coins,
          branches:playerBranches(),
          libraryBuilt:!!gameState.academyBuildings.library?.built,
          screen:currentScreen,
          pickerOpen:!!document.getElementById('academyBuildPicker')?.open,
          buildings:JSON.stringify(gameState.academyBuildings),
          storageSame:localStorage.getItem('burbz_state') === before.storage
        };
        BurbzScanHome.closeBuildPicker(false);
        return {
          modelOutdoors:outdoors.occupants.map(row => ({ id:row.id, savedRoom:row.savedRoom, reason:row.displayReason })),
          nativeOutdoors,
          buildLeakButtons,
          hiddenKitchenLeaks,
          pickerRows,
          before,
          afterCompatibilityCall
        };
      } finally {
        gameState = JSON.parse(savedState);
        localStorage.setItem('burbz_state', savedStorage);
        BurbzScanHome.closeBuildPicker(false);
        renderScanHome();
      }
    })()`);
    assert.deepEqual(feedSeparation.modelOutdoors.map(row => row.id), ['r6-outdoor','r6-unbuilt-library','r6-hidden-kitchen']);
    assert.deepEqual(feedSeparation.nativeOutdoors, ['r6-outdoor','r6-unbuilt-library','r6-hidden-kitchen']);
    assert.equal(feedSeparation.modelOutdoors.find(row => row.id === 'r6-unbuilt-library').reason, 'unowned-room');
    assert.equal(feedSeparation.modelOutdoors.find(row => row.id === 'r6-hidden-kitchen').reason, 'nonresidential-room');
    assert.deepEqual(feedSeparation.buildLeakButtons, []);
    assert.deepEqual(feedSeparation.hiddenKitchenLeaks, []);
    assert(feedSeparation.pickerRows.includes('library'), JSON.stringify(feedSeparation.pickerRows));
    assert.equal(feedSeparation.afterCompatibilityCall.coins, feedSeparation.before.coins);
    assert.equal(feedSeparation.afterCompatibilityCall.branches, feedSeparation.before.branches);
    assert.equal(feedSeparation.afterCompatibilityCall.libraryBuilt, false);
    assert.equal(feedSeparation.afterCompatibilityCall.storageSame, true);
    pass('ordinary room feed displays invalid saved room birds in Outdoors, hides unbuilt/hidden construction, and stale build-and-move cannot spend', feedSeparation);
    await run('new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(() => { BurbzScanHome.closeBuildPicker(false); resolve(true); })))');

    await run('BurbzScanHome.closeBuildPicker(false);gameState.player.coins=0;gameState.player.branches=0;renderScanHome();');
    await page.locator('[data-home-action="build-rooms"]').first().click();
    await page.locator('#academyBuildPicker[open]').waitFor();
    const helpBefore = await run(`(() => ({
      coins:gameState.player.coins,
      branches:playerBranches(),
      trainingBuilt:!!gameState.academyBuildings.training?.built,
      helpText:document.querySelector('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-help-training"]')?.textContent.trim() || null,
      buildDisabled:document.querySelector('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-training"]')?.disabled,
      buildings:JSON.stringify(gameState.academyBuildings),
      quests:JSON.stringify(gameState.quests),
      xp:gameState.player.xp || 0,
      storage:localStorage.getItem('burbz_state')
    }))()`);
    assert.equal(helpBefore.helpText, 'Help');
    assert.equal(helpBefore.buildDisabled, true);
    await run(`(() => {
      gameState.player.coins = 200000;
      gameState.player.branches = 200000;
      window.__helpSaveProbe = { save:0, durable:0, cloud:0, originalSave:saveState, originalDurable:durableSaveState, originalCloud:typeof queueCloudSave === 'function' ? queueCloudSave : null };
      saveState = function(){ window.__helpSaveProbe.save += 1; return true; };
      durableSaveState = function(){ window.__helpSaveProbe.durable += 1; return true; };
      if (typeof queueCloudSave === 'function') queueCloudSave = function(){ window.__helpSaveProbe.cloud += 1; };
    })()`);
    const helpPreClick = await run(`(() => ({
      coins:gameState.player.coins,
      branches:playerBranches(),
      trainingBuilt:!!gameState.academyBuildings.training?.built,
      helpText:document.querySelector('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-help-training"]')?.textContent.trim() || null,
      buildDisabled:document.querySelector('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-training"]')?.disabled,
      buildings:JSON.stringify(gameState.academyBuildings),
      quests:JSON.stringify(gameState.quests),
      xp:gameState.player.xp || 0,
      storage:localStorage.getItem('burbz_state')
    }))()`);
    await page.locator('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-help-training"]').click();
    await page.waitForFunction(() => !!document.querySelector('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-training"]:not([disabled])'));
    const helpAfter = await run(`(() => {
      const probe = window.__helpSaveProbe;
      const result = {
        coins:gameState.player.coins,
        branches:playerBranches(),
        trainingBuilt:!!gameState.academyBuildings.training?.built,
        buildDisabled:document.querySelector('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-training"]')?.disabled,
        helpPresent:!!document.querySelector('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-help-training"]'),
        rowText:document.querySelector('#academyBuildPicker [data-building="training"]')?.textContent.replace(/\\s+/g,' ').trim() || '',
        toast:document.getElementById('toastContainer')?.textContent.replace(/\\s+/g,' ').trim() || '',
        buildings:JSON.stringify(gameState.academyBuildings),
        quests:JSON.stringify(gameState.quests),
        xp:gameState.player.xp || 0,
        storage:localStorage.getItem('burbz_state'),
        counters:{ save:probe.save, durable:probe.durable, cloud:probe.cloud }
      };
      saveState = probe.originalSave;
      durableSaveState = probe.originalDurable;
      if (probe.originalCloud) queueCloudSave = probe.originalCloud;
      delete window.__helpSaveProbe;
      return result;
    })()`);
    assert.equal(helpAfter.trainingBuilt, false);
    assert.equal(helpAfter.coins, helpPreClick.coins);
    assert.equal(helpAfter.branches, helpPreClick.branches);
    assert.equal(helpAfter.buildings, helpPreClick.buildings);
    assert.equal(helpAfter.quests, helpPreClick.quests);
    assert.equal(helpAfter.xp, helpPreClick.xp);
    assert.equal(helpAfter.storage, helpPreClick.storage);
    assert.deepEqual(helpAfter.counters, { save:0, durable:0, cloud:0 });
    assert.equal(helpAfter.buildDisabled, false);
    assert.equal(helpAfter.helpPresent, false);
    assert(helpAfter.toast.includes('Press Build') || helpAfter.rowText.includes('READY'), JSON.stringify(helpAfter));
    const trainingBuild = page.locator('#academyBuildPicker [data-building="training"] [data-home-action="academy-build-training"]');
    const trainingBuildBox = await trainingBuild.boundingBox();
    assert(trainingBuildBox, 'refreshed Training Build button has a native box');
    const explicitTrainingBefore = await run('({coins:gameState.player.coins,branches:playerBranches(),training:gameState.academyBuildings.training || null,notices:(gameState.completionNotices||[]).length})');
    await page.mouse.click(trainingBuildBox.x + trainingBuildBox.width / 2, trainingBuildBox.y + trainingBuildBox.height / 2);
    await page.mouse.click(trainingBuildBox.x + trainingBuildBox.width / 2, trainingBuildBox.y + trainingBuildBox.height / 2);
    await page.waitForFunction(() => __testEval('!!gameState.academyBuildings.training?.built'));
    const explicitTrainingAfter = await run(`(() => ({
      coins:gameState.player.coins,
      branches:playerBranches(),
      training:gameState.academyBuildings.training || null,
      notices:(gameState.completionNotices||[]).filter(n => n && n.kind === 'academy-building' && n.target && n.target.room === 'training').length,
      currentScreen
    }))()`);
    assert.equal(explicitTrainingBefore.training, null);
    assert.equal(explicitTrainingBefore.coins - explicitTrainingAfter.coins, await run('ACADEMY_BUILDINGS.training.cost'));
    assert.equal(explicitTrainingBefore.branches - explicitTrainingAfter.branches, await run('Number(ACADEMY_BUILDINGS.training.branches)||0'));
    assert.equal(explicitTrainingAfter.training.x, await run('ACADEMY_BUILDINGS.training.x'));
    assert.equal(explicitTrainingAfter.training.y, await run('ACADEMY_BUILDINGS.training.y'));
    assert.equal(explicitTrainingAfter.notices, 1);
    assert.equal(explicitTrainingAfter.currentScreen, 'scan');
    pass('stale Help stays guidance-only after resources change, and the refreshed explicit Training Build spends once at canonical cost', { helpBefore, helpPreClick, helpAfter, explicitTrainingBefore, explicitTrainingAfter });

    await page.locator('[data-home-action="build-rooms"]').first().click();
    await page.locator('#academyBuildPicker[open]').waitFor();
    await page.locator('#academyBuildPicker [data-building="tavern"] [data-home-action="academy-build-tavern"]').click();
    await page.waitForFunction(() => __testEval('!!gameState.academyBuildings.tavern?.built'));
    const tavern = await run('gameState.academyBuildings.tavern');
    assert.equal(tavern.x, await run('ACADEMY_BUILDINGS.tavern.x'));
    assert.equal(tavern.y, await run('ACADEMY_BUILDINGS.tavern.y'));
    assert.equal(await run('currentScreen'), 'scan');
    pass('explicit Birdhouse Build uses canonical coordinates and returns to Home');

    await page.locator('[data-home-action="build-rooms"]').first().click();
    await page.locator('#academyBuildPicker[open]').waitFor();
    await run('gameState.player.coins=0;gameState.player.branches=0;');
    await page.locator('#academyBuildPicker [data-building="hospital"] [data-home-action="academy-build-hospital"]').click();
    await page.waitForTimeout(300);
    assert.equal(await run('!!gameState.academyBuildings.hospital?.built'), false);
    pass('stale picker affordability is rechecked by the original build transaction');
    await run("try{closeResourceQuestPrompt();}catch(e){};try{document.getElementById('prerequisiteGuide')?.close();}catch(e){};BurbzScanHome.closeBuildPicker(false);");

    await run('gameState.player.coins=200000;gameState.player.branches=200000;renderScanHome();');
    await page.locator('[data-home-action="build-rooms"]').first().click();
    await page.locator('#academyBuildPicker[open]').waitFor();
    const rollbackBefore = await run('JSON.stringify({coins:gameState.player.coins,branches:gameState.player.branches,hospital:gameState.academyBuildings.hospital})');
    await run("window.__savedDurableSaveState=durableSaveState;durableSaveState=(opts)=>{durableSaveState=window.__savedDurableSaveState;throw new Error('forced save failure');};");
    await page.locator('#academyBuildPicker [data-building="hospital"] [data-home-action="academy-build-hospital"]').click();
    await page.waitForTimeout(400);
    assert.equal(await run('JSON.stringify({coins:gameState.player.coins,branches:gameState.player.branches,hospital:gameState.academyBuildings.hospital})'), rollbackBefore);
    pass('failed durable save rolls back supplies and built ledger');
    await run('BurbzScanHome.closeBuildPicker(false);');

    await run("gameState.academyBuildings.tavern.x=12.5;gameState.academyBuildings.tavern.y=34.5;gameState.academyBuildings.tavern.movedAt='qa-preserve';saveState();renderScanHome();");
    await page.locator('[data-home-action="build-rooms"]').first().click();
    await page.locator('#academyBuildPicker[open]').waitFor();
    await page.locator('#academyBuildPicker [data-building="workshop"] [data-home-action="academy-build-workshop"]').click();
    await page.waitForFunction(() => __testEval('!!gameState.academyBuildings.workshop?.built'));
    assert.deepEqual(await run('({x:gameState.academyBuildings.tavern.x,y:gameState.academyBuildings.tavern.y,movedAt:gameState.academyBuildings.tavern.movedAt})'), { x:12.5, y:34.5, movedAt:'qa-preserve' });
    pass('building a new room preserves existing room coordinates');

    await run(`
      for(const id of ACADEMY_BUILDING_ORDER){if(id==='outdoors')continue;const c=ACADEMY_BUILDINGS[id];gameState.academyBuildings[id]={built:true,builtAt:'qa',x:c.x,y:c.y};}
      const makeBird=(id,name,scientific,room)=>{
        const bird=createBirdEntry(name,scientific,.94);
        bird.id=id;bird.level=20;bird.hp=bird.maxHp||100;bird.maxHp=bird.maxHp||100;
        normalizeBirdCare(bird);ensureBirdAcademy(bird);
        bird.academy.room=room;bird.academy.lastForage=null;bird.academy.lastGroom=null;bird.care.lastTrained=null;
        bird.care.hunger=42;bird.care.happiness=82;return bird;
      };
      gameState.flock=[
        makeBird('home-outdoor','Great Tit','Parus major','outdoors'),
        makeBird('home-trainer','Blue Tit','Cyanistes caeruleus','training'),
        makeBird('home-patient','European Robin','Erithacus rubecula','outdoors'),
        makeBird('home-quest','Carrion Crow','Corvus corone','quest_roost'),
        makeBird('home-chef','Goldcrest','Regulus regulus','library')
      ];
      academyBirdById('home-patient').hp=12;
      gameState.pantry={...DEFAULT_PANTRY,seeds:10,suet:10,insects:10,worms:10,berries:10,fruit:10,fish:10,flying:8,meat:10,carrion:10,acorns:10,aquatic:10};
      gameState.inventory.larder={...(gameState.inventory.larder||{}),small_bird_prey_ration:4,mealworm_scoop:4,sunflower_seeds:4,hedgerow_berries:4};
      gameState.birdExpeditions=[];gameState.birdTrainingSessions=[];
      const flow=tutorialFlowState();flow.openingStarted=true;flow.discoveryReviewed=true;flow.companionMet=true;flow.kitchenIntroduced=true;flow.kitchenShortageSeen=true;flow.errandClaimed=true;flow.openingCareDone=false;
	      assignBirdRole('academy','kitchen','home-chef');
	      gameState.chefCareers=gameState.chefCareers||{};gameState.chefCareers['home-chef']={activeSince:Date.now()-10*24*60*60*1000,totalMs:0};
	      document.getElementById('feedNotePopup')?.remove();
	      saveState();renderScanHome();
	    `);
	    await page.waitForFunction(() => document.querySelectorAll('#academyHomeRooms .academy-home-room').length === 13);
	    await page.reload({ waitUntil:'domcontentloaded', timeout:60000 });
	    await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan', null, { timeout:60000 });
	    await page.waitForFunction(() => document.querySelectorAll('#academyHomeRooms .academy-home-room').length === 13);
	    const comparableBaseState = await run('JSON.stringify(gameState)');
	    const academyOrder = await run('ACADEMY_BUILDING_ORDER.slice()');
	    const allRoomIds = Array.from(new Set(['outdoors', ...academyOrder]));
	    const renderComparableOwnership = async (label, ownedIds) => {
	      const detail = await run(`(() => {
	        const base = JSON.parse(${JSON.stringify(comparableBaseState)});
	        const requested = ${JSON.stringify(ownedIds)};
	        const beforeStorage = localStorage.getItem('burbz_state');
	        const originalSave = saveState;
	        const originalDurable = typeof durableSaveState === 'function' ? durableSaveState : null;
	        const originalCloud = typeof queueCloudSave === 'function' ? queueCloudSave : null;
	        let saveCalls = 0, durableCalls = 0, cloudCalls = 0;
	        saveState = function(){ saveCalls += 1; return true; };
	        if (originalDurable) durableSaveState = function(){ durableCalls += 1; return true; };
	        if (originalCloud) queueCloudSave = function(){ cloudCalls += 1; return true; };
	        try {
	          gameState = base;
	          gameState.__academyHomeSavedCount = 999;
	          gameState.academyBuildings = {};
	          const wanted = new Set(requested);
	          wanted.add('outdoors');
	          for (const id of ACADEMY_BUILDING_ORDER) {
	            if (!wanted.has(id)) continue;
	            const c = ACADEMY_BUILDINGS[id] || {};
	            gameState.academyBuildings[id] = { built:true, builtAt:'adaptive-composition-proof', x:c.x, y:c.y };
	          }
	          const comparableRooms = {
	            'home-outdoor':'outdoors',
	            'home-trainer':'training',
	            'home-patient':'outdoors',
	            'home-quest':'training',
	            'home-chef':'hospital'
	          };
	          (gameState.flock || []).forEach(bird => {
	            if (bird && comparableRooms[bird.id] && bird.academy) bird.academy.room = comparableRooms[bird.id];
	          });
	          switchScreen('scan');
	          renderScanHome();
	          const host = document.getElementById('academyHomeTree');
	          const scroller = document.getElementById('academyHomeRooms');
	          const ledgerOwned = Object.keys(gameState.academyBuildings || {}).filter(id => gameState.academyBuildings[id] && gameState.academyBuildings[id].built).sort();
	          const rosterByRoom = Object.fromEntries(Array.from(document.querySelectorAll('#academyHomeRooms [data-home-native-room]')).map(panel => [
	            panel.dataset.homeNativeRoom,
	            Array.from(panel.querySelectorAll('.academy-bird-row [data-bird-info]')).map(el => el.dataset.birdInfo)
	          ]));
	          const visibleControl = el => {
	            if (el.tagName !== 'SUMMARY' && el.closest('details:not([open])')) return false;
	            const rect = el.getBoundingClientRect();
	            const style = getComputedStyle(el);
	            return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
	          };
	          const controlTextByRoom = Object.fromEntries(Array.from(document.querySelectorAll('#academyHomeRooms [data-home-native-room]')).map(panel => [
	            panel.dataset.homeNativeRoom,
	            Array.from(panel.querySelectorAll('button:not(:disabled), summary')).filter(visibleControl).map(el => el.textContent.replace(/\s+/g,' ').trim()).filter(Boolean)
	          ]));
	          return {
	            label:${JSON.stringify(label)},
	            requested:[...wanted].sort(),
	            ledgerOwned,
	            renderedOwned:Number(host && host.dataset.ownedCount || 0),
	            hostClass:host ? String(host.className) : '',
	            screenDensity:document.getElementById('screen-scan')?.dataset?.homeDensity || '',
	            savedCountProbe:gameState.__academyHomeSavedCount,
	            roomOrder:Array.from(document.querySelectorAll('#academyHomeRooms .academy-home-room')).map(el => el.dataset.room),
	            rosterByRoom,
	            controlTextByRoom,
	            scrollTop:scroller ? scroller.scrollTop : null,
	            saveCalls,
	            durableCalls,
	            cloudCalls,
	            storageSame:localStorage.getItem('burbz_state') === beforeStorage
	          };
	        } finally {
	          saveState = originalSave;
	          if (originalDurable) durableSaveState = originalDurable;
	          if (originalCloud) queueCloudSave = originalCloud;
	        }
	      })()`);
	      assert.equal(detail.saveCalls, 0, label + ' render-only comparison called saveState');
	      assert.equal(detail.durableCalls, 0, label + ' render-only comparison called durableSaveState');
	      assert.equal(detail.cloudCalls, 0, label + ' render-only comparison called queueCloudSave');
	      assert.equal(detail.storageSame, true, label + ' render-only comparison rewrote localStorage');
	      await page.waitForFunction(() => !document.getElementById('toastContainer')?.children.length, null, { timeout:10000 });
	      await page.waitForTimeout(120);
	      const audit = await collectFloorAudit(page, label);
	      assert.equal(audit.scroller.scrollTop, 0, label + ' should be captured at natural room start');
	      const shot = label + '.png';
	      await page.screenshot({ path:path.join(out, shot), fullPage:true });
	      report.screenshots.push(shot);
	      return { detail, audit, shot };
	    };
	    const comparableFew = await renderComparableOwnership('adaptive-few-comparable-start', ['outdoors','tavern','training','hospital']);
	    const comparableMature = await renderComparableOwnership('adaptive-mature-comparable-start', allRoomIds);
	    await run('gameState = JSON.parse(' + JSON.stringify(comparableBaseState) + ');switchScreen("scan");renderScanHome();');
	    const fewOutdoor = comparableFew.audit.rooms.find(room => room.id === 'outdoors');
	    const matureOutdoor = comparableMature.audit.rooms.find(room => room.id === 'outdoors');
	    assert(fewOutdoor && matureOutdoor, 'paired adaptive audits include Outdoors');
	    const adaptiveCompare = {
	      few:{
	        renderedOwned:comparableFew.detail.renderedOwned,
	        savedCountProbe:comparableFew.detail.savedCountProbe,
	        hostClass:comparableFew.detail.hostClass,
	        roster:comparableFew.detail.rosterByRoom.outdoors,
	        controls:comparableFew.detail.controlTextByRoom.outdoors,
	        bannerHeight:fewOutdoor.banner.rect.height,
	        descriptionHeight:fewOutdoor.body.rect.height,
	        nativeHeight:fewOutdoor.native.rect.height,
	        cardHeight:fewOutdoor.card.rect.height,
	        visibleCardHeight:fewOutdoor.card.clipped.height,
	        scroller:comparableFew.audit.scroller.rect
	      },
	      mature:{
	        renderedOwned:comparableMature.detail.renderedOwned,
	        savedCountProbe:comparableMature.detail.savedCountProbe,
	        hostClass:comparableMature.detail.hostClass,
	        roster:comparableMature.detail.rosterByRoom.outdoors,
	        controls:comparableMature.detail.controlTextByRoom.outdoors,
	        bannerHeight:matureOutdoor.banner.rect.height,
	        descriptionHeight:matureOutdoor.body.rect.height,
	        nativeHeight:matureOutdoor.native.rect.height,
	        cardHeight:matureOutdoor.card.rect.height,
	        visibleCardHeight:matureOutdoor.card.clipped.height,
	        scroller:comparableMature.audit.scroller.rect
	      }
	    };
	    assert.equal(comparableFew.detail.renderedOwned, 4);
	    assert.equal(comparableMature.detail.renderedOwned, allRoomIds.length);
	    assert.equal(comparableFew.detail.savedCountProbe, comparableMature.detail.savedCountProbe);
	    assert(comparableFew.detail.hostClass.includes('academy-home-few'), JSON.stringify(comparableFew.detail));
	    assert(comparableMature.detail.hostClass.includes('academy-home-many'), JSON.stringify(comparableMature.detail));
	    assert.deepEqual(comparableFew.detail.rosterByRoom.outdoors, comparableMature.detail.rosterByRoom.outdoors, JSON.stringify(adaptiveCompare));
	    assert.deepEqual(comparableFew.detail.controlTextByRoom.outdoors, comparableMature.detail.controlTextByRoom.outdoors, JSON.stringify(adaptiveCompare));
	    assert(fewOutdoor.banner.rect.height >= matureOutdoor.banner.rect.height + 32, JSON.stringify(adaptiveCompare));
	    assert(fewOutdoor.native.rect.height >= matureOutdoor.native.rect.height, JSON.stringify(adaptiveCompare));
	    assert(fewOutdoor.card.rect.height >= 320, JSON.stringify(adaptiveCompare));
	    assert(matureOutdoor.banner.rect.height >= 68, JSON.stringify(adaptiveCompare));
	    report.adaptiveComparableOwnership = { few:comparableFew.detail, mature:comparableMature.detail, compare:adaptiveCompare, screenshots:[comparableFew.shot, comparableMature.shot] };
	    pass('adaptive composition uses actual owned ledger count for larger few-owned room presentation', report.adaptiveComparableOwnership);
		    const matureRoomSize = await page.locator('#academyHomeRooms .academy-home-room').first().evaluate(el => ({ height:el.getBoundingClientRect().height, minHeight:parseFloat(getComputedStyle(el).minHeight) || 0 }));
    const bannerArt = await page.locator('#academyHomeRooms .academy-home-room-banner').evaluateAll(els => els.filter(el => getComputedStyle(el).backgroundImage.includes('assets/academy')).length);
    assert(bannerArt >= 10, 'room banners use original Academy art');
    const openPlaceholders = await page.locator('#academyHomeRooms .academy-home-room button').evaluateAll(buttons => buttons.filter(btn => btn.textContent.trim() === 'Open').length);
    assert.equal(openPlaceholders, 0, 'generic duplicate Open placeholders are gone');
	    const matureFeedBuildLeak = await page.locator('#academyHomeRooms [data-home-native-room] button').evaluateAll(buttons => buttons.map(button => ({
	      text:button.textContent.replace(/\s+/g,' ').trim(),
	      onclick:button.getAttribute('onclick') || '',
	      room:button.closest('[data-home-native-room]')?.dataset.homeNativeRoom || ''
	    })).filter(button => /^Build\b/.test(button.text) || button.onclick.includes('academyBuildAndMoveBird')));
	    assert.deepEqual(matureFeedBuildLeak, [], 'mature everyday room feed has no construction or build-and-move controls');
    assert(await page.locator('[data-home-native-room="tavern"] .barracks-recruit-launch').count());
    assert(await page.locator('[data-home-native-room="kitchen"] [data-kitchen-roster-bird="merlin"] [data-action="kitchen-roster-feed"]').count());
    assert(await page.locator('[data-home-native-room="kitchen"] .chef-board [data-action="chef-board-serve"]').count());
    assert(await page.locator('[data-home-native-room="kitchen"] .chef-feed-all').count());
    assert(await page.locator('[data-home-native-room="training"] .training-duration-chip').count());
    assert(await page.locator('[data-home-native-room="training"] .training-template-card .training-bird-btn').count());
    assert(await page.locator('[data-home-native-room="hospital"] [data-bird-goto="home-patient"] .room-bird-add-btn').count());
    assert(await page.locator('[data-home-native-room="magpie_market"] #magpieMarketPanel [role="tab"]').count());
    assert(await page.locator('[data-home-native-room="manager_office"] .manager-office-panel').count());
	    assert(await page.locator('[data-home-native-room="quest_roost"] .academy-home-quest-board').count());
	    assert.equal(await page.locator('[data-home-native-room="quest_roost"] button').filter({ hasText:'1h Forage' }).count(), 1);
	    assert.equal(await page.locator('[data-home-native-room="quest_roost"] button').filter({ hasText:'2h Supplies' }).count(), 1);
	    assert.equal(await page.locator('[data-home-native-room="quest_roost"] button').filter({ hasText:'3h Scout' }).count(), 1);
	    const matureAudit = await collectFloorAudit(page, 'mature-all-13-before-actions');
	    assert.deepEqual(matureAudit.rooms.map(room => room.id), ['outdoors','tavern','training','hospital','crowbar','kitchen','magpie_market','manager_office','workshop','library','nursery','observatory','quest_roost']);
	    const clippedNative = matureAudit.rooms.filter(room => room.native.scrollHeight > room.native.clientHeight + 1 && room.native.style.overflowY === 'hidden');
	    assert.deepEqual(clippedNative, [], 'native room bodies must not be hidden-clipped');
	    await page.screenshot({ path:path.join(out, 'floor-before-reachability.png'), fullPage:true });
	    report.screenshots.push('floor-before-reachability.png');
	    await page.screenshot({ path:path.join(out, 'mature-home-phone.png'), fullPage:true });
	    report.screenshots.push('mature-home-phone.png');
	    pass('mature Home renders all 13 owned rooms as banner compartments with native controls', { matureRoomSize, bannerArt });

	    await nativeClick(page, { selector:'[data-home-native-room="outdoors"] .academy-actions button', text:'Feed' }, 'outdoors-feed');
	    await page.waitForFunction(() => __testEval('academyFeedTrayBirdId') === 'home-outdoor');
	    assert.equal(await page.locator('[data-home-native-room="outdoors"] .academy-tray').count(), 1);
	    const groomBefore = await run('academyBirdById("home-outdoor").academy.lastGroom || null');
	    await nativeClick(page, { selector:'[data-home-native-room="outdoors"] .academy-actions button', text:'Groom' }, 'outdoors-groom');
	    await page.waitForFunction(before => __testEval('academyBirdById("home-outdoor").academy.lastGroom || null') !== before, groomBefore);
	    await nativeClick(page, { selector:'[data-home-native-room="outdoors"] .academy-actions button', text:'Forage' }, 'outdoors-forage');
	    await page.waitForFunction(() => __testEval('!!academyBirdById("home-outdoor").academy.lastForage'));
	    assert.equal(await run('gameState.birdExpeditions.some(q=>q.birdId==="home-outdoor")'), false);
	    pass('native Outdoors Feed, Groom and Forage are reachable by wheel exposure and canonical care actions', {
	      trayOpen:true,
	      groom:await run('academyBirdById("home-outdoor").academy.lastGroom'),
	      forage:await run('academyBirdById("home-outdoor").academy.lastForage')
	    });
	    const moveBefore = await run('({coins:gameState.player.coins,branches:playerBranches(),room:academyBirdById("home-outdoor").academy.room})');
	    await nativeClick(page, { selector:'[data-home-native-room="outdoors"] .academy-move-disclosure summary', text:'Move' }, 'outdoors-move-disclosure');
	    await nativeClick(page, { selector:'[data-home-native-room="outdoors"] .academy-move-disclosure[open] .academy-move-btn', text:'TRAINING HALL' }, 'outdoors-move-training');
	    await page.waitForFunction(() => __testEval('academyBirdById("home-outdoor").academy.room') === 'training');
	    const moveAfter = await run('({coins:gameState.player.coins,branches:playerBranches(),room:academyBirdById("home-outdoor").academy.room})');
	    assert.equal(moveAfter.coins, moveBefore.coins);
	    assert.equal(moveAfter.branches, moveBefore.branches);
	    assert.equal(moveAfter.room, 'training');
	    await run('academyMoveBird("home-outdoor","kitchen")');
	    const refusedMove = await run('({coins:gameState.player.coins,branches:playerBranches(),room:academyBirdById("home-outdoor").academy.room,toast:document.getElementById("toastContainer")?.textContent.replace(/\\s+/g," ").trim() || ""})');
	    assert.equal(refusedMove.coins, moveBefore.coins);
	    assert.equal(refusedMove.branches, moveBefore.branches);
	    assert.equal(refusedMove.room, 'training');
	    assert(refusedMove.toast.includes('Kitchen'), JSON.stringify(refusedMove));
	    pass('native Move disclosure transfers only to owned lodging rooms while counter-room refusal preserves resources', { moveBefore, moveAfter, refusedMove });

	    await nativeClick(page, { selector:'[data-home-native-room="tavern"] .barracks-recruit-launch' }, 'birdhouse-recruit');
	    await page.locator('#barracksRecruitOverlay.show').waitFor();
	    assert.equal(await page.locator('#barracksRecruitOverlay .barracks-recruit-sheet').count(), 1);
	    await run('closeBarracksRecruitOverlay();renderScanHome();');
	    await page.waitForFunction(() => !document.getElementById('barracksRecruitOverlay')?.classList.contains('show'));
	    pass('native Birdhouse Recruit button is reachable from its in-room floor and opens the original roster overlay');

	    await page.locator('[data-home-native-room="hospital"] [data-bird-goto="home-patient"] .room-bird-add-btn').click();
    await page.waitForFunction(() => __testEval('academyBirdById("home-patient").academy.room') === 'hospital');
    assert.equal(await run('academyBirdById("home-patient").academy.hospitalReturnRoom'), 'outdoors');
    await page.locator('[data-home-native-room="hospital"] button').filter({ hasText:'Forage' }).first().click();
    await page.waitForFunction(() => __testEval('!!academyBirdById("home-patient").academy.lastForage'));
    await run('const b=academyBirdById("home-patient");b.hp=b.maxHp;tickAcademy(Date.now()+60*60*1000);saveState();renderScanHome();');
    assert.equal(await run('academyBirdById("home-patient").academy.room'), 'outdoors');
    pass('native Hospital admission, ward Forage and canonical passive discharge remain reachable from Home');

	    await run("document.querySelector('[data-home-native-room=\"kitchen\"] details')?.setAttribute('open','');");
	    const durationSelectionSave = await run('localStorage.getItem("burbz_state")');
	    const durationSelectionSessions = await run('gameState.birdTrainingSessions.length');
	    const chooseTrainingDuration = async (label, minutes) => {
	      const reach = await exposeByWheel(page, { selector:'[data-home-native-room="training"] .training-duration-chip', text:label }, 'training-duration-' + minutes);
	      const scrollBefore = await page.locator('#academyHomeRooms').evaluate(el => el.scrollTop);
	      await page.mouse.click(reach.center.x, reach.center.y);
	      await page.waitForFunction(value => __testEval('trainingDurationChoice') === value, minutes);
	      const state = await page.evaluate(() => ({
	        choice:window.__testEval('trainingDurationChoice'),
	        selectedDomText:document.querySelector('[data-home-native-room="training"] .training-duration-chip.selected')?.textContent.trim() || null,
	        activeAction:document.activeElement?.dataset?.homeAction || null,
	        activeText:document.activeElement?.textContent?.trim() || null,
	        scrollTop:document.getElementById('academyHomeRooms')?.scrollTop || 0,
	        kitchenDetailsOpen:!!document.querySelector('[data-home-native-room="kitchen"] details[open]'),
	        saveRaw:localStorage.getItem('burbz_state'),
	        sessionCount:window.__testEval('gameState.birdTrainingSessions.length')
	      }));
	      assert.equal(state.choice, minutes);
	      assert.equal(state.selectedDomText, label);
	      assert.equal(state.activeAction, 'training-duration-' + minutes);
	      assert(Math.abs(state.scrollTop - scrollBefore) <= 2, JSON.stringify({ before:scrollBefore, after:state.scrollTop }));
	      assert.equal(state.kitchenDetailsOpen, true);
	      assert.equal(state.saveRaw, durationSelectionSave);
	      assert.equal(state.sessionCount, durationSelectionSessions);
	      return state;
	    };
	    const duration30 = await chooseTrainingDuration('30m', 30);
	    const duration60 = await chooseTrainingDuration('1h', 60);
	    const duration15 = await chooseTrainingDuration('15m', 15);
	    const duration30Final = await chooseTrainingDuration('30m', 30);
	    report.trainingDurationAfterClick = { duration30, duration60, duration15, duration30Final };
	    const trainingBefore = await run('({trainCount:academyBirdById("home-trainer").training.trainCount||0,spd:academyBirdById("home-trainer").spd||0,xp:gameState.player.xp||0,durationChoice:trainingDurationChoice})');
	    await page.locator('[data-home-native-room="training"] .training-template-card .training-bird-btn').filter({ hasText:'Blue Tit' }).first().click();
	    await page.waitForFunction(() => __testEval('gameState.birdTrainingSessions.length===1'));
	    const trainingId = await run('gameState.birdTrainingSessions[0].id');
	    assert.equal(await run(`gameState.birdTrainingSessions.find(s=>s.id==='${trainingId}')?.status`), 'active');
	    assert.equal(await run(`gameState.birdTrainingSessions.find(s=>s.id==='${trainingId}')?.durationMinutes`), 30);
    await run(`const s=gameState.birdTrainingSessions.find(s=>s.id==='${trainingId}');s.startMs=Date.now()-120000;s.endMs=Date.now()-1000;saveState();renderScanHome();`);
    report.trainingPanelBeforeClaim = await page.locator('[data-home-native-room="training"]').evaluate(el => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 1000));
    report.trainingSessionsBeforeClaim = await run('JSON.stringify(gameState.birdTrainingSessions)');
    await page.locator('[data-home-native-room="training"] button').filter({ hasText:'CLAIM TRAINING' }).first().click();
    await page.waitForFunction(before => __testEval('academyBirdById("home-trainer").training.trainCount||0') > before.trainCount, trainingBefore);
    const trainingAfterClaim = await run(`({
      trainCount:academyBirdById("home-trainer").training.trainCount||0,
      spd:academyBirdById("home-trainer").spd||0,
      xp:gameState.player.xp||0,
      status:gameState.birdTrainingSessions.find(s=>s.id==='${trainingId}')?.status,
      active:birdHasActiveTraining('home-trainer')
    })`);
    assert.equal(trainingAfterClaim.status, 'claimed');
    assert.equal(trainingAfterClaim.active, false);
    assert(trainingAfterClaim.trainCount === trainingBefore.trainCount + 1, JSON.stringify(trainingAfterClaim));
    const claimAgain = page.locator('[data-home-native-room="training"] button').filter({ hasText:'CLAIM TRAINING' });
    if (await claimAgain.count()) await claimAgain.first().click();
    await page.waitForTimeout(250);
    assert.equal(await run('academyBirdById("home-trainer").training.trainCount||0'), trainingAfterClaim.trainCount);
    await page.reload({ waitUntil:'domcontentloaded', timeout:60000 });
    await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan', null, { timeout:60000 });
    await page.locator('#academyHomeTree').waitFor();
    const trainingAfterReload = await run(`({
      trainCount:academyBirdById("home-trainer").training.trainCount||0,
      status:gameState.birdTrainingSessions.find(s=>s.id==='${trainingId}')?.status,
      active:birdHasActiveTraining('home-trainer')
    })`);
    assert.deepEqual(trainingAfterReload, { trainCount:trainingAfterClaim.trainCount, status:'claimed', active:false });
    pass('native Training notice board starts legitimately, due-timestamp claim is once-only and survives reload', { trainingBefore, trainingAfterClaim, trainingAfterReload });

    const mealBefore = await run('({meals:gameState.player.mealsServed||0,stock:gameState.inventory.larder.small_bird_prey_ration,done:tutorialFlowState().openingCareDone})');
    await page.locator('[data-home-native-room="kitchen"] [data-kitchen-roster-bird="merlin"] [data-action="kitchen-roster-feed"]').click();
    await page.locator('#burbzFeedSheet.open').waitFor();
    await page.locator('#burbzFeedSheet [data-feed-food="larder:small_bird_prey_ration"]').click();
    await page.waitForFunction(before => __testEval('gameState.player.mealsServed||0') > before.meals, mealBefore);
    assert.equal(await run('gameState.inventory.larder.small_bird_prey_ration'), mealBefore.stock - 1);
    assert.equal(await run('!!tutorialFlowState().openingCareDone'), true);
    await run('closeFeedSheet();renderScanHome();');
    const chefServeBefore = await run('gameState.player.mealsServed||0');
    await page.locator('[data-home-native-room="kitchen"] .chef-board [data-action="chef-board-serve"]:not([disabled])').first().click();
    await page.waitForFunction(before => __testEval('gameState.player.mealsServed||0') > before, chefServeBefore);
    assert.equal(await page.locator('[data-home-native-room="kitchen"] .chef-feed-all:not([disabled])').count(), 1);
    pass('native Kitchen roster meal, Head Chef Serve controls and Feed all mastery state are exposed in Home');

    const coinsBeforeMarket = await run('gameState.player.coins');
    await page.locator('[data-home-native-room="magpie_market"] .magpie-btn.buy').first().click();
    await page.waitForFunction(before => __testEval('gameState.player.coins') < before, coinsBeforeMarket);
    await page.locator('[data-home-native-room="magpie_market"] #market-tab-sell').click();
    assert.equal(await page.locator('[data-home-native-room="magpie_market"] #market-tab-sell[aria-selected="true"]').count(), 1);
    pass('native Magpie Market buy and sell tab controls work inside Home');

	    await nativeClick(page, { selector:'[data-home-native-room="quest_roost"] button', text:'1h Forage' }, 'quest-roost-start-1h-forage');
	    await page.waitForFunction(() => __testEval('gameState.birdExpeditions.some(q=>q.birdId==="home-quest"&&q.templateId==="short_forage")'));
	    const questId = await run('gameState.birdExpeditions.find(q=>q.birdId==="home-quest").id');
	    const questStarted = await run(`(() => {
	      const q=gameState.birdExpeditions.find(q=>q.id==='${questId}');
	      return { id:q.id, birdId:q.birdId, templateId:q.templateId, status:q.status, progressPct:q.progressPct ?? null, startMs:q.startMs, endMs:q.endMs, rewards:q.rewards };
	    })()`);
	    assert.equal(questStarted.status, 'active');
	    await run(`const q=gameState.birdExpeditions.find(q=>q.id==='${questId}');q.startMs=Date.now()-120000;q.endMs=Date.now()-1000;renderScanHome();`);
	    const questBeforeClaim = await run(`(() => {
	      const q=gameState.birdExpeditions.find(q=>q.id==='${questId}');
	      const advanced=BurbzAcademyCore.advanceBirdExpedition(q,Date.now());
	      return {
	        stored:{ id:q.id, status:q.status, progressPct:q.progressPct ?? null, startMs:q.startMs, endMs:q.endMs },
	        advanced:{ status:advanced.status, progressPct:advanced.progressPct },
	        player:{ coins:gameState.player.coins||0, branches:playerBranches(), stone:gameState.player.stone||0, xp:gameState.player.xp||0 },
	        activeCount:gameState.birdExpeditions.length,
	        receipt:questClaimReceipt('expedition:${questId}')
	      };
	    })()`);
	    assert.deepEqual(questBeforeClaim.stored.status, 'active');
	    assert.equal(questBeforeClaim.stored.progressPct, null);
	    assert.equal(questBeforeClaim.advanced.status, 'complete');
	    assert.equal(questBeforeClaim.receipt, null);
	    report.questBoardBeforeClaim = await page.locator('[data-home-native-room="quest_roost"]').evaluate(el => el.textContent.replace(/\s+/g, ' ').trim().slice(0, 1000));
	    report.questSessionsBeforeClaim = await run('JSON.stringify(gameState.birdExpeditions)');
	    const claimReach = await exposeByWheel(page, { selector:'[data-home-native-room="quest_roost"] .academy-home-quest-row button', text:'Claim' }, 'quest-roost-claim');
	    await page.mouse.click(claimReach.center.x, claimReach.center.y);
	    await page.mouse.click(claimReach.center.x, claimReach.center.y);
	    await page.waitForFunction(id => !__testEval(`gameState.birdExpeditions.some(q=>q.id==='${id}')`), questId);
	    const questAfterClaim = await run(`(() => {
	      const receipt=questClaimReceipt('expedition:${questId}');
	      return {
	        receipt,
	        active:gameState.birdExpeditions.some(q=>q.id==='${questId}'),
	        player:{ coins:gameState.player.coins||0, branches:playerBranches(), stone:gameState.player.stone||0, xp:gameState.player.xp||0 },
	        savedReceipt:JSON.parse(localStorage.getItem('burbz_state')||'{}').questClaimReceipts?.['expedition:${questId}'] || null
	      };
	    })()`);
	    assert.equal(questAfterClaim.active, false);
	    assert(questAfterClaim.receipt, 'quest receipt was written');
	    assert(questAfterClaim.savedReceipt, 'quest receipt was persisted');
	    assert.equal(questAfterClaim.player.coins - questBeforeClaim.player.coins, questAfterClaim.receipt.coins);
	    assert.equal(questAfterClaim.player.branches - questBeforeClaim.player.branches, questAfterClaim.receipt.branches);
	    assert.equal(questAfterClaim.player.stone - questBeforeClaim.player.stone, questAfterClaim.receipt.stone);
	    await page.reload({ waitUntil:'domcontentloaded', timeout:60000 });
	    await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan', null, { timeout:60000 });
	    const questAfterReload = await run(`(() => ({
	      active:gameState.birdExpeditions.some(q=>q.id==='${questId}'),
	      receipt:questClaimReceipt('expedition:${questId}'),
	      player:{ coins:gameState.player.coins||0, branches:playerBranches(), stone:gameState.player.stone||0, xp:gameState.player.xp||0 }
	    }))()`);
	    assert.equal(questAfterReload.active, false);
	    assert.equal(questAfterReload.receipt.coins, questAfterClaim.receipt.coins);
	    assert.deepEqual(questAfterReload.player, questAfterClaim.player);
	    pass('native Quest Roost starts a mission, timestamp-only advancement exposes Claim, and double Claim persists one reward', { questStarted, questBeforeClaim, questAfterClaim, questAfterReload });
	    await page.waitForTimeout(3300);
	    await run("try{closeQuestOverlay();}catch(e){};renderScanHome();");
	    await page.waitForFunction(() => !document.getElementById('questClaimCelebration') && !document.getElementById('questOverlay')?.classList.contains('open') && !document.getElementById('toastContainer')?.children.length);
	    const afterActionAudit = await collectFloorAudit(page, 'mature-all-13-after-actions');
	    assert.equal(afterActionAudit.rooms.length, 13);
	    const noticeSteps = await settleCompletionNotices(page, run);
	    assert.equal(await run('(gameState.completionNotices||[]).length'), 0);
	    await page.reload({ waitUntil:'domcontentloaded', timeout:60000 });
	    await page.waitForFunction(() => window.__testEval && __testEval('currentScreen') === 'scan', null, { timeout:60000 });
	    await page.locator('#academyHomeTree').waitFor();
	    assert.equal(await run('(gameState.completionNotices||[]).length'), 0);
	    const beforeScroll = await page.locator('#academyHomeRooms').evaluate(el => el.scrollTop);
	    await touchScroll(page, '#academyHomeRooms');
	    await page.waitForTimeout(350);
	    const afterScroll = await page.locator('#academyHomeRooms').evaluate(el => el.scrollTop);
	    assert(afterScroll > beforeScroll);
	    await page.screenshot({ path:path.join(out, 'floor-after-reachability.png'), fullPage:true });
	    report.screenshots.push('floor-after-reachability.png');
	    pass('mature room list responds to native vertical touch scroll after action proof', { beforeScroll, afterScroll, noticeSteps });

    const viewports = [[320,568],[390,844],[844,390],[1280,800]];
    const appearancePreferences = [
      { appearance:'normal', colorScheme:'dark' },
      { appearance:'normal', colorScheme:'light' },
      { appearance:'comic', colorScheme:'dark' },
      { appearance:'comic', colorScheme:'light' }
    ];
    report.layoutMetrics = [];
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width, height });
      for (const { appearance, colorScheme } of appearancePreferences) {
        await page.emulateMedia({ colorScheme, reducedMotion:'no-preference' });
        await run("gameState.settings.appearance='" + appearance + "';BurbzAppearanceCore.apply('" + appearance + "',document);switchScreen('scan');renderScanHome();");
        await page.waitForTimeout(260);
        const overflow = await page.evaluate(() => {
          const screen = document.getElementById('screen-scan');
          const main = screen.querySelector('.scan-home-main');
          return { body:document.documentElement.scrollWidth - window.innerWidth, main:main.scrollWidth - main.clientWidth };
        });
        assert(overflow.body <= 2 && overflow.main <= 2, `${width}x${height} ${appearance} overflow ${JSON.stringify(overflow)}`);
        const metrics = await page.evaluate(() => {
          const rectOf = el => {
            if (!el) return null;
            const r = el.getBoundingClientRect();
            return { x:+r.x.toFixed(2), y:+r.y.toFixed(2), top:+r.top.toFixed(2), right:+r.right.toFixed(2), bottom:+r.bottom.toFixed(2), left:+r.left.toFixed(2), width:+r.width.toFixed(2), height:+r.height.toFixed(2) };
          };
          const bySelector = selector => rectOf(document.querySelector(selector));
          const intersection = el => {
            const r = el.getBoundingClientRect();
            const left = Math.max(0, r.left), top = Math.max(0, r.top);
            const right = Math.min(window.innerWidth, r.right), bottom = Math.min(window.innerHeight, r.bottom);
            return { width:Math.max(0, right - left), height:Math.max(0, bottom - top), left, top, right, bottom };
          };
          const clippedIntersection = el => {
            const r = el.getBoundingClientRect();
            let left = Math.max(0, r.left), top = Math.max(0, r.top);
            let right = Math.min(window.innerWidth, r.right), bottom = Math.min(window.innerHeight, r.bottom);
            for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
              const style = getComputedStyle(node);
              if (!/(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) continue;
              const nr = node.getBoundingClientRect();
              left = Math.max(left, nr.left);
              top = Math.max(top, nr.top);
              right = Math.min(right, nr.right);
              bottom = Math.min(bottom, nr.bottom);
            }
            return { width:Math.max(0, right - left), height:Math.max(0, bottom - top), left, top, right, bottom };
          };
          const centerHit = el => {
            const r = el.getBoundingClientRect();
            const x = Math.max(0, Math.min(window.innerWidth - 1, r.left + r.width / 2));
            const y = Math.max(0, Math.min(window.innerHeight - 1, r.top + r.height / 2));
            const hit = document.elementFromPoint(x, y);
            return { ok:!!(hit && (el === hit || el.contains(hit))), hit:hit ? (hit.id ? '#' + hit.id : hit.className || hit.tagName) : '', x:+x.toFixed(2), y:+y.toFixed(2) };
          };
          const tracks = value => !value || value === 'none' ? [] : (value.match(/(?:minmax\([^)]*\)|[^\s]+)/g) || []);
          const visible = el => {
            const box = el.getBoundingClientRect();
            const style = getComputedStyle(el);
            return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
          };
          const targetSelector = [
            '#academyHomeTree .academy-home-tools button',
            '#academyHomeTree .academy-home-room-open',
            '#academyHomeTree .academy-btn',
            '#academyHomeTree .academy-move-disclosure summary',
            '#academyHomeTree .academy-move-btn',
            '#academyHomeTree .room-bird-add-btn',
            '#academyHomeTree .training-duration-chip',
            '#academyHomeTree .training-bird-btn',
            '#academyHomeTree .kitchen-roster-feed-btn',
            '#academyHomeTree .chef-board-serve',
            '#academyHomeTree .chef-feed-all',
            '#academyHomeTree .barracks-recruit-launch',
            '#academyHomeTree .academy-home-quest-row button',
            '#academyHomeTree .academy-home-quest-open',
            '#academyHomeTree .magpie-panel button',
            '#academyHomeTree .manager-office-panel button',
            '#academyHomeTree .role-post-row'
          ].join(',');
          const topTargetSelector = [
            '#scanBtn',
            '#captureBtn',
            '#scanHomeActions .home-action',
            '#academyHomeTree .academy-home-tools button',
            '#scanHomeDeskPanels .desk-panel-heading',
            '#deskBuildOptions button:not(:disabled)',
            '.desk-equipment-control',
            '#playerHomeStand',
            '#campHomeButton',
            '#savedPhotosButton'
          ].join(',');
          const targetViolations = Array.from(document.querySelectorAll(targetSelector)).filter(visible).map(el => {
            const r = el.getBoundingClientRect();
            return { text:el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 70), cls:el.className, width:Math.round(r.width), height:Math.round(r.height) };
          }).filter(r => r.width < 44 || r.height < 44);
          const topTargetFailures = Array.from(document.querySelectorAll(topTargetSelector)).filter(el => visible(el) && clippedIntersection(el).width > 0 && clippedIntersection(el).height > 0).map(el => {
            const r = el.getBoundingClientRect();
            const inter = clippedIntersection(el);
            const hit = centerHit(el);
            return {
              id:el.id || '',
              action:el.dataset.homeAction || '',
              text:el.textContent.trim().replace(/\\s+/g, ' ').slice(0, 70),
              rect:{ width:+r.width.toFixed(2), height:+r.height.toFixed(2), top:+r.top.toFixed(2), bottom:+r.bottom.toFixed(2) },
              intersection:{ width:+inter.width.toFixed(2), height:+inter.height.toFixed(2) },
              hit
            };
          }).filter(item => item.intersection.width < 44 || item.intersection.height < 44 || !item.hit.ok);
          const moveStrips = Array.from(document.querySelectorAll('#academyHomeTree .academy-move')).filter(visible).map(el => ({ overflowX:getComputedStyle(el).overflowX, extra:Math.round(el.scrollWidth - el.clientWidth) })).filter(row => row.overflowX === 'auto' || row.overflowX === 'scroll' || row.extra > 12);
          const deskEl = document.getElementById('scanHomeDeskPanels');
          const deskStyle = deskEl ? getComputedStyle(deskEl) : null;
          const screenEl = document.getElementById('screen-scan');
          const leftRailEl = document.querySelector('#screen-scan > .academy-home-screen-rail-left');
          const rightRailEl = document.querySelector('#screen-scan > .academy-home-screen-rail-right');
          const hitAt = (x, y) => {
            const hit = document.elementFromPoint(Math.max(0, Math.min(window.innerWidth - 1, x)), Math.max(0, Math.min(window.innerHeight - 1, y)));
            return { id:hit?.id || '', cls:hit?.className || '', tag:hit?.tagName || '', text:hit?.textContent?.trim?.().replace(/\s+/g, ' ').slice(0, 50) || '' };
          };
          const railInfo = (el, side) => {
            const rect = rectOf(el);
            const style = el ? getComputedStyle(el) : null;
            const centerX = rect ? rect.left + rect.width / 2 : 0;
            const centerY = rect ? Math.min(Math.max(rect.top + 8, 1), window.innerHeight - 2) : 0;
            const hit = rect ? hitAt(centerX, centerY) : null;
            return {
              side,
              rect,
              pointerEvents:style?.pointerEvents || '',
              display:style?.display || '',
              zIndex:style?.zIndex || '',
              hitAtCenter:hit,
              hitIsRail:!!(hit && (hit.cls || '').includes('academy-home-screen-rail'))
            };
          };
          const deskCards = Array.from(document.querySelectorAll('#scanHomeDeskPanels :is(.desk-panel-stores,.desk-panel-building)')).filter(visible).map(el => ({ cls:el.className, rect:rectOf(el) }));
          const rowTracks = tracks(deskStyle?.gridTemplateRows || '');
          const columnTracks = tracks(deskStyle?.gridTemplateColumns || '');
          const slotCount = Math.max(1, rowTracks.length) * Math.max(1, columnTracks.length);
          const cardsBottom = deskCards.length ? Math.max(...deskCards.map(card => card.rect.bottom)) : 0;
          const deskRect = rectOf(deskEl);
          const mainEl = document.querySelector('#screen-scan .scan-home-main');
          const mainStyle = mainEl ? getComputedStyle(mainEl) : null;
          const mainRect = rectOf(mainEl);
          const soundRect = bySelector('#scanBtn');
          const cameraRect = bySelector('#captureBtn');
          const goalRect = bySelector('.scan-home-today');
          const treeRect = bySelector('#academyHomeTree');
          const screenRect = rectOf(screenEl);
          const leftRail = railInfo(leftRailEl, 'left');
          const rightRail = railInfo(rightRailEl, 'right');
          const railEdges = {
            leftOuterDelta:leftRail.rect && screenRect ? +(leftRail.rect.left - screenRect.left).toFixed(2) : null,
            rightOuterDelta:rightRail.rect && screenRect ? +(screenRect.right - rightRail.rect.right).toFixed(2) : null,
            leftWidth:leftRail.rect?.width || 0,
            rightWidth:rightRail.rect?.width || 0,
            screenWidth:screenRect?.width || 0,
            academyLeftOffset:leftRail.rect && treeRect ? +(treeRect.left - leftRail.rect.right).toFixed(2) : null,
            academyRightOffset:rightRail.rect && treeRect ? +(rightRail.rect.left - treeRect.right).toFixed(2) : null
          };
          const headerRect = bySelector('#academyHomeTree .academy-home-header');
          const firstRoomRect = bySelector('#academyHomeRooms .academy-home-room');
          const firstRoomTitleRect = bySelector('#academyHomeRooms .academy-home-room h3');
          const firstRoomBodyRect = bySelector('#academyHomeRooms .academy-home-room p');
          const overlaps = (a, b) => !!(a && b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top);
          const scannerIntrusions = [
            ['sound', soundRect],
            ['camera', cameraRect]
          ].filter(([, button]) => overlaps(button, goalRect) || overlaps(button, treeRect)).map(([name, button]) => ({ name, button, goal:goalRect, tree:treeRect }));
          const landscapeShort = matchMedia('(orientation: landscape) and (max-height: 550px)').matches;
          const coversMainColumn = child => !!(child && mainRect && child.left <= mainRect.left + 8 && child.right >= mainRect.right - 8);
          const implicitSideBlankArea = !landscapeShort && treeRect && deskRect && deskRect.left > treeRect.right + 4
            ? {
                left:+treeRect.right.toFixed(2),
                top:+treeRect.top.toFixed(2),
                right:+deskRect.right.toFixed(2),
                bottom:+Math.max(treeRect.top, deskRect.top - 4).toFixed(2),
                width:+(deskRect.right - treeRect.right).toFixed(2),
                height:+Math.max(0, deskRect.top - treeRect.top - 4).toFixed(2)
              }
            : null;
	          const scannerOwnsRoomRow = landscapeShort && !!(deskRect && treeRect && deskRect.top >= treeRect.top - 1 && soundRect && cameraRect && Math.max(soundRect.bottom, cameraRect.bottom) > treeRect.top + 1);
	          const academyToDeskRatio = treeRect && deskRect && deskRect.width ? +(treeRect.width / deskRect.width).toFixed(3) : null;
	          const coordTexts = Array.from(document.querySelectorAll('#academyHomeRooms .academy-home-chip')).map(el => el.textContent.trim()).filter(text => /^-?\\d+\\s*[·,]\\s*-?\\d+$/.test(text));
	          const roomInternalFailures = Array.from(document.querySelectorAll('#academyHomeRooms .academy-home-room')).map(card => {
	            const banner = card.querySelector('.academy-home-room-banner');
	            const title = card.querySelector('h3');
	            const native = card.querySelector('.academy-home-room-native');
	            const cardStyle = getComputedStyle(card);
	            const nativeStyle = getComputedStyle(native);
	            const cardRect = rectOf(card), bannerRect = rectOf(banner), titleRect = rectOf(title), nativeRect = rectOf(native);
	            const titleInsideBanner = !!(bannerRect && titleRect && titleRect.top >= bannerRect.top - 1 && titleRect.bottom <= bannerRect.bottom + 1);
	            const cardClipsContent = cardStyle.overflowY === 'hidden' && card.scrollHeight > card.clientHeight + 1;
	            const nativeClipsContent = nativeStyle.overflowY === 'hidden' && native.scrollHeight > native.clientHeight + 1;
	            return {
	              room:card.dataset.room,
	              titleInsideBanner,
	              cardClipsContent,
	              nativeClipsContent,
	              card:{ rect:cardRect, clientHeight:card.clientHeight, scrollHeight:card.scrollHeight, overflow:cardStyle.overflowY },
	              banner:{ rect:bannerRect, clientHeight:banner.clientHeight, scrollHeight:banner.scrollHeight, overflow:getComputedStyle(banner).overflowY },
	              title:{ rect:titleRect, clipped:clippedIntersection(title) },
	              native:{ rect:nativeRect, clientHeight:native.clientHeight, scrollHeight:native.scrollHeight, overflow:nativeStyle.overflowY }
	            };
	          }).filter(item => !item.titleInsideBanner || item.cardClipsContent || item.nativeClipsContent);
	          return {
	            targetViolations,
	            topTargetFailures,
	            moveStrips,
	            coordTexts,
	            roomInternalFailures,
	            scannerIntrusions,
	            rails:{ left:leftRail, right:rightRail, edges:railEdges },
            geometry:{
              screen:screenRect,
              usableHomeContainer:screenRect,
              main:mainRect,
              hero:bySelector('#screen-scan .scan-home-hero'),
              scanner:bySelector('#screen-scan .scan-home-start'),
              sound:soundRect,
              camera:cameraRect,
              goal:goalRect,
              tree:treeRect,
              roomscroll:bySelector('#academyHomeRooms'),
              header:headerRect,
              firstRoom:firstRoomRect,
              firstRoomTitle:firstRoomTitleRect,
              firstRoomBody:firstRoomBodyRect,
              desk:deskRect,
              cards:deskCards,
              dock:bySelector('#bottomDock')
            },
	            landscape:{
	              short:landscapeShort,
	              mainColumns:tracks(mainStyle?.gridTemplateColumns || ''),
	              mainRows:tracks(mainStyle?.gridTemplateRows || ''),
	              deskGridColumnStart:deskStyle?.gridColumnStart || '',
	              deskGridColumnEnd:deskStyle?.gridColumnEnd || '',
	              treeCoversMainColumn:coversMainColumn(treeRect),
	              deskCoversMainColumn:coversMainColumn(deskRect),
	              implicitSideBlankArea,
	              scannerOwnsRoomRow,
	              academyWidth:treeRect ? +treeRect.width.toFixed(2) : 0,
              academyToDeskRatio,
              academyToMainRatio:treeRect && mainEl ? +(treeRect.width / mainEl.getBoundingClientRect().width).toFixed(3) : null,
              headerHeight:headerRect ? +headerRect.height.toFixed(2) : 0,
              firstRoomTitleWidth:firstRoomTitleRect ? +firstRoomTitleRect.width.toFixed(2) : 0,
              firstRoomBodyHeight:firstRoomBodyRect ? +firstRoomBodyRect.height.toFixed(2) : 0
            },
            desk:{
              rows:rowTracks,
              columns:columnTracks,
              visibleCards:deskCards.length,
              slotCount,
              emptySlots:slotCount - deskCards.length,
              gapBelowCards:deskRect && cardsBottom ? +(deskRect.bottom - cardsBottom).toFixed(2) : null
            }
          };
        });
        const expectedRoomHeight = width <= 340 && height <= 620 ? 120 : height < 500 ? 128 : Math.min(190, Math.floor(height * 0.28));
        report.layoutMetrics.push({ width, height, appearance, colorScheme, expected:{ roomscrollMinHeight:expectedRoomHeight, deskEmptySlots:0, scannerIntrusions:0, railWidth:10 }, overflow, ...metrics });
        assert.deepEqual(metrics.targetViolations, [], `${width}x${height} ${appearance} target violations ${JSON.stringify(metrics.targetViolations)}`);
        assert.deepEqual(metrics.topTargetFailures, [], `${width}x${height} ${appearance} top target hit failures ${JSON.stringify(metrics.topTargetFailures)}`);
	        assert.deepEqual(metrics.moveStrips, [], `${width}x${height} ${appearance} move strips ${JSON.stringify(metrics.moveStrips)}`);
	        assert.deepEqual(metrics.coordTexts, [], `${width}x${height} ${appearance} coordinate chips ${JSON.stringify(metrics.coordTexts)}`);
	        assert.deepEqual(metrics.roomInternalFailures, [], `${width}x${height} ${appearance} internal room clipping ${JSON.stringify(metrics.roomInternalFailures)}`);
	        assert.deepEqual(metrics.scannerIntrusions, [], `${width}x${height} ${appearance} scanner overlap ${JSON.stringify(metrics.scannerIntrusions)}`);
        assert(metrics.rails.left.rect && metrics.rails.right.rect, `${width}x${height} ${appearance}/${colorScheme} rails missing ${JSON.stringify(metrics.rails)}`);
        assert.equal(metrics.rails.left.pointerEvents, 'none', `${width}x${height} ${appearance}/${colorScheme} left rail intercepts ${JSON.stringify(metrics.rails.left)}`);
        assert.equal(metrics.rails.right.pointerEvents, 'none', `${width}x${height} ${appearance}/${colorScheme} right rail intercepts ${JSON.stringify(metrics.rails.right)}`);
        assert.equal(metrics.rails.left.hitIsRail, false, `${width}x${height} ${appearance}/${colorScheme} left rail receives hit ${JSON.stringify(metrics.rails.left)}`);
        assert.equal(metrics.rails.right.hitIsRail, false, `${width}x${height} ${appearance}/${colorScheme} right rail receives hit ${JSON.stringify(metrics.rails.right)}`);
        assert(Math.abs(metrics.rails.edges.leftOuterDelta) <= 1, `${width}x${height} ${appearance}/${colorScheme} left rail misses usable Home edge ${JSON.stringify(metrics.rails)}`);
        assert(Math.abs(metrics.rails.edges.rightOuterDelta) <= 1, `${width}x${height} ${appearance}/${colorScheme} right rail misses usable Home edge ${JSON.stringify(metrics.rails)}`);
        assert(metrics.rails.edges.leftWidth >= 8 && metrics.rails.edges.leftWidth <= 12, `${width}x${height} ${appearance}/${colorScheme} left rail width ${JSON.stringify(metrics.rails)}`);
        assert(metrics.rails.edges.rightWidth >= 8 && metrics.rails.edges.rightWidth <= 12, `${width}x${height} ${appearance}/${colorScheme} right rail width ${JSON.stringify(metrics.rails)}`);
        assert.equal(metrics.desk.emptySlots, 0, `${width}x${height} ${appearance} reserved empty desk grid slots ${JSON.stringify(metrics.desk)}`);
        assert(metrics.desk.gapBelowCards == null || metrics.desk.gapBelowCards <= 8, `${width}x${height} ${appearance} desk gap below cards ${JSON.stringify(metrics.desk)}`);
        assert(metrics.geometry.roomscroll.height >= expectedRoomHeight, `${width}x${height} ${appearance} room region too short ${JSON.stringify({ expectedRoomHeight, actual:metrics.geometry.roomscroll.height, metrics })}`);
	        if (metrics.landscape.short) {
	          assert.equal(metrics.landscape.scannerOwnsRoomRow, false, `${width}x${height} ${appearance} scanner still reserves room-row space ${JSON.stringify(metrics.landscape)}`);
	          assert(metrics.landscape.academyWidth >= 320, `${width}x${height} ${appearance} Academy room column remains too narrow ${JSON.stringify(metrics.landscape)}`);
          assert(metrics.landscape.academyToDeskRatio >= 1.35, `${width}x${height} ${appearance} Academy cutaway is not primary beside desk ${JSON.stringify(metrics.landscape)}`);
          assert(metrics.landscape.academyToMainRatio >= 0.48, `${width}x${height} ${appearance} Academy cutaway underuses the main row ${JSON.stringify(metrics.landscape)}`);
          assert(metrics.landscape.headerHeight <= 76, `${width}x${height} ${appearance} Academy header wraps too tall ${JSON.stringify(metrics.landscape)}`);
	          assert(metrics.landscape.firstRoomTitleWidth >= 140, `${width}x${height} ${appearance} room title copy too compressed ${JSON.stringify(metrics.landscape)}`);
	          assert(metrics.landscape.firstRoomBodyHeight >= 14, `${width}x${height} ${appearance} room body copy not visibly readable ${JSON.stringify(metrics.landscape)}`);
	        } else {
	          assert.equal(metrics.landscape.deskGridColumnStart, '1', `${width}x${height} ${appearance} desk inherited a non-unified grid column ${JSON.stringify(metrics.landscape)}`);
	          assert.equal(metrics.landscape.treeCoversMainColumn, true, `${width}x${height} ${appearance} Academy cutaway does not occupy the unified main column ${JSON.stringify(metrics.landscape)}`);
	          assert.equal(metrics.landscape.deskCoversMainColumn, true, `${width}x${height} ${appearance} Crafting/Empire desk does not occupy the unified main column ${JSON.stringify(metrics.landscape)}`);
	          assert(!metrics.landscape.implicitSideBlankArea || metrics.landscape.implicitSideBlankArea.width <= 12 || metrics.landscape.implicitSideBlankArea.height <= 12, `${width}x${height} ${appearance} implicit desktop side blank column remains ${JSON.stringify(metrics.landscape)}`);
	        }
        const shot = `home-${width}x${height}-${appearance}-${colorScheme}.png`;
        await page.screenshot({ path:path.join(out, shot), fullPage:true });
        report.screenshots.push(shot);
      }
    }
    await page.screenshot({ path:path.join(out, 'home-landscape-comic.png'), fullPage:true });
    report.screenshots.push('home-landscape-comic.png');
    pass('four viewport sizes pass in normal/comic appearances and light/dark browser preferences without horizontal overflow');

    await page.setViewportSize({ width:390, height:844 });
    await page.emulateMedia({ reducedMotion:'no-preference' });
    await run("gameState.settings.appearance='normal';BurbzAppearanceCore.apply('normal',document);switchScreen('scan');renderScanHome();");
    const pulse = await page.locator('#scanHomeActions [data-home-action="next-quest"]').evaluate(el => ({ disabled:el.disabled, animationName:getComputedStyle(el).animationName, animationDuration:getComputedStyle(el).animationDuration }));
    assert.equal(pulse.disabled, false);
    assert(pulse.animationName.includes('home-current-quest-pulse'), JSON.stringify(pulse));
    assert.equal(pulse.animationDuration, '4s');
    const cameraChooser = page.waitForEvent('filechooser', { timeout:1500 }).catch(() => null);
    await page.locator('#captureBtn').click();
    const chooser = await cameraChooser;
    if (chooser) await chooser.setFiles([]).catch(() => {});
    await page.locator('#scanHomeSession:not([hidden])').waitFor();
    await page.waitForFunction(() => document.getElementById('screen-scan')?.classList.contains('camera-mode'));
    await page.locator('#scanHomeSession>summary').click();
    await page.waitForFunction(() => !document.getElementById('scanHomeSession').open);
    const soundBefore = await run('({wanted:continuousSoundScanWanted,state:soundListenerState,button:document.getElementById("scanBtn").textContent})');
    await page.locator('#scanBtn').click();
    await page.locator('#scanHomeSession:not([hidden])').waitFor();
    await page.waitForFunction(() => __testEval('continuousSoundScanWanted===true && soundListenerState!=="requesting"'), null, { timeout:10000 });
    const soundStarted = await run('({wanted:continuousSoundScanWanted,state:soundListenerState,button:document.getElementById("scanBtn").textContent,stopHidden:document.getElementById("deskSessionStop").hidden})');
    assert.equal(soundStarted.wanted, true);
    assert.equal(soundStarted.stopHidden, false);
    await page.locator('#deskSessionStop').click();
    await page.waitForFunction(() => __testEval('continuousSoundScanWanted===false'), null, { timeout:10000 });
    const soundStopped = await run('({wanted:continuousSoundScanWanted,state:soundListenerState,button:document.getElementById("scanBtn").textContent,stopHidden:document.getElementById("deskSessionStop").hidden})');
    assert.equal(soundStopped.wanted, false);
    await page.locator('#scanHomeSession>summary').click();
    await page.waitForFunction(() => !document.getElementById('scanHomeSession').open);
    report.scannerLifecycle = { cameraCancelled:true, soundBefore, soundStarted, soundStopped };
    await page.locator('#settingsBtn').click();
    await page.locator('#settingsModal.show').waitFor();
    await run('closeBurbzSettings();');
    await page.locator('#campHomeButton').click();
    await page.locator('.exploration-sheet[open]').waitFor();
    await page.locator('.exploration-sheet [data-close]').click();
    await page.locator('#playerHomeStand').click();
    await page.waitForFunction(() => window.BurbzPlayerHome?.isOpen?.(), null, { timeout:60000 });
    await run("BurbzPlayerHome.close('test');switchScreen('scan');renderScanHome();");
    await page.locator('.desk-equipment-control').click();
    await page.locator('.desk-equipment-dialog[open]').waitFor();
    await page.locator('.desk-kit-close').click();
    await page.locator('[data-home-action="panel-stores"]').first().click();
    await page.waitForFunction(() => __testEval('currentScreen') === 'inventory' || __testEval('currentScreen') === 'forge');
    await run("switchScreen('scan');renderScanHome();gameState.completionNotices=[{id:'qa-training-notice',kind:'academy-building',icon:'🏋️',title:'Training built',sub:'At the Academy',target:{room:'training'}}];renderScanHome();");
    await page.locator('#desk-empire-notices').click();
    await page.locator('#homeBuildingNotices[open]').waitFor();
    await page.locator('[data-home-action="complete-qa-training-notice"]').click();
    await page.waitForFunction(() => __testEval('currentScreen') === 'scan' && !__testEval('gameState.completionNotices.length'));
    pass('Current Goal pulse, scanner drawer, Settings, Camps, Enter Alderwing, Equipment, Forge/Stores and completed Academy notice controls remain native and route back to Home');

    await run("switchScreen('scan');renderScanHome();");
    await page.locator('.academy-home-explore').click();
    await page.waitForFunction(() => __testEval("currentScreen==='academy'||!!window.BurbzVillageWalk?.isOpen?.()"), null, { timeout:60000 });
    pass('secondary explicit 3D Academy route remains reachable');

    assert.equal(report.errors.length, 0, 'page errors');
    assert.equal(report.consoleErrors.length, 0, 'unexpected console errors');
    save();
  } catch (error) {
    report.failure = error.stack || String(error);
    console.error(error);
    try { save(); } catch (_) {}
    process.exitCode = 1;
  } finally {
    await browser?.close();
    server?.close();
  }
})();
