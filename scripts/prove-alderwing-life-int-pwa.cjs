'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public/burbz');
const evidenceRoot = process.env.EVIDENCE_DIR || '/root/burbz-alderwing-cleanup-evidence/work-life-int/pwa';
const runDir = path.join(evidenceRoot, new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(runDir, { recursive: true });

const rev = 'destination-cleanup-v434-20260921';
const changedModules = ['village_walk.js', 'building_rooms.js', 'village_discoveries.js'];
const chromePath = [
  process.env.CHROME_PATH,
  '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  '/usr/bin/chromium'
].filter(Boolean).find(file => fs.existsSync(file));
if (!chromePath) throw Error('No Chromium executable found. Set CHROME_PATH.');

const report = {
  startedAt: new Date().toISOString(),
  runDir,
  revision: rev,
  command: { argv: process.argv, cwd: process.cwd(), node: process.version, chromePath },
  changedModules,
  checks: [],
  missing: [],
  console: [],
  pageErrors: [],
  screenshots: []
};

function shaBuffer(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function shaFile(file) {
  return shaBuffer(fs.readFileSync(file));
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.json')) return 'application/json; charset=utf-8';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.png')) return 'image/png';
  if (file.endsWith('.svg')) return 'image/svg+xml';
  if (file.endsWith('.mp3')) return 'audio/mpeg';
  if (file.endsWith('.mp4')) return 'video/mp4';
  return 'application/octet-stream';
}

function check(id, pass, observed, expected = true) {
  report.checks.push({ id, pass, expected, observed });
  assert.ok(pass, `${id}: ${JSON.stringify(observed)}`);
}

function createServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    const rel = decodeURIComponent(url.pathname).replace(/^\/burbz\/?/, '') || 'index.html';
    const file = path.resolve(publicRoot, rel);
    if (!file.startsWith(publicRoot + path.sep)) {
      res.writeHead(403);
      res.end();
      return;
    }
    try {
      let data = fs.readFileSync(file);
      if (rel === 'index.html') {
        const html = data.toString();
        data = Buffer.from(html.includes('window.__testEval=code=>eval(code);')
          ? html
          : html.replace('\ninit();', '\nwindow.__testEval=code=>eval(code);\ninit();'));
      }
      res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-cache' });
      res.end(data);
    } catch (_) {
      report.missing.push(rel);
      res.writeHead(404);
      res.end('not found');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    server,
    origin: `http://localhost:${server.address().port}`,
    url: `http://localhost:${server.address().port}/burbz/`
  })));
}

async function screenshot(page, name) {
  const file = path.join(runDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}

(async () => {
  const { server, origin, url } = await createServer();
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
    });
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    await context.route('**/*', route => route.request().url().startsWith(origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('console', msg => report.console.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => report.pageErrors.push(err.stack || err.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.__testEval && navigator.serviceWorker, null, { timeout: 60000 });
    await page.waitForFunction(() => navigator.serviceWorker.ready.then(() => true), null, { timeout: 120000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller || navigator.serviceWorker.ready.then(() => location.reload()), null, { timeout: 120000 }).catch(() => {});
    if (!(await page.evaluate(() => !!navigator.serviceWorker.controller))) {
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForFunction(() => navigator.serviceWorker.controller && window.__testEval, null, { timeout: 120000 });
    }
    await page.waitForFunction(expected => window.__testEval?.('BURBZ_BUILD') === expected, rev, { timeout: 120000 });

    await page.evaluate(() => __testEval(`(() => {
      if (typeof merlinTutActive !== 'undefined' && merlinTutActive) endMerlinTutorial(false);
      localStorage.setItem(BURBZ_INTRO_SEEN_KEY, '1');
      localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY, JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c => c.id)));
      gameState.player.level = Math.max(gameState.player.level || 1, 20);
      gameState.player.coins = 2468;
      gameState.player.branches = 1357;
      gameState.lifeIntProof = 'retained-save';
      const rec = { seed: 404, name: 'Lifecycle Proof', lat: 51.5, lon: -0.12, claimedAt: new Date().toISOString(), liberatedAt: new Date().toISOString() };
      ensureEmpireState().villages['404'] = rec;
      const eco = ensureVillageEconomy(rec);
      eco.buildings = { cabin: 1 };
      eco.population = 2;
      eco.ruins = [];
      eco.constructions = [];
      saveState();
      return true;
    })()`));

    const cacheProbe = await page.evaluate(async ({ rev, changedModules }) => {
      const keys = await caches.keys();
      const cacheName = keys.find(key => key.endsWith(rev));
      if (!cacheName) return { keys, cacheName: null, modules: {} };
      const cache = await caches.open(cacheName);
      const modules = {};
      for (const file of changedModules) {
        const url = `./${file}?v=${rev}`;
        const response = await cache.match(url);
        const bytes = response ? Array.from(new Uint8Array(await response.arrayBuffer())) : null;
        modules[file] = { url, ok: !!response && response.ok, bytes };
      }
      return { keys, cacheName, modules };
    }, { rev, changedModules });
    check('candidate_cache_name_present', !!cacheProbe.cacheName, { keys: cacheProbe.keys, cacheName: cacheProbe.cacheName });
    const cacheHashes = {};
    for (const file of changedModules) {
      const row = cacheProbe.modules[file];
      const cached = row?.bytes ? Buffer.from(row.bytes) : null;
      const cachedSha = cached ? shaBuffer(cached) : null;
      const sourceSha = shaFile(path.join(publicRoot, file));
      cacheHashes[file] = { url: row?.url, cachedSha, sourceSha, cachedBytes: cached?.length || 0, sourceBytes: fs.statSync(path.join(publicRoot, file)).size };
      check(`cached_bytes_match_${file}`, row?.ok && cachedSha === sourceSha, cacheHashes[file]);
    }

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(expected => window.__testEval?.('BURBZ_BUILD') === expected, rev, { timeout: 120000 });
    await page.evaluate(() => __testEval('openEmpireVillage(404)'));
    await page.waitForFunction(() => window.__testEval?.('!!(villageScene && villageRenderer && villageCamera && villageBuildings)'), null, { timeout: 60000 });
    await page.evaluate(() => __testEval(`(async () => {
      await ensureVillageWalkModule();
      return BurbzVillageWalk.open({
        name: empireVillageRecordBySeed(404).name,
        seed: 404,
        exitLabel: '<- Proof',
        discoveries: villageDiscoveryAdapter(404),
        harvest: villageHarvestAdapter(404),
        work: buildingWorkAdapter(),
        interiors: buildingRoomsAdapter(),
        character: walkingCharacterState,
        source: () => ({ scene: villageScene, renderer: villageRenderer, camera: villageCamera, buildings: villageBuildings, changed: settlementRetireBuildingObjects, movers: [] }),
        suspend: () => { villageRunning = false; cancelAnimationFrame(villageAnimationRequest); clearTimeout(villagePauseTimer); },
        animate: t => villageAnimateFrame(t, true),
        resume: () => {}
      });
    })()`));
    await page.waitForFunction(() => window.__burbzVillageWalkDebug?.state().ready, null, { timeout: 60000 });
    await page.waitForFunction(() => document.querySelector('.vd-journal') && window.__burbzVillageWalkDebug.state().discoveries?.objects?.length, null, { timeout: 60000 });
    const offlineState = await page.evaluate(() => ({
      build: __testEval('BURBZ_BUILD'),
      retainedSave: __testEval('gameState.lifeIntProof'),
      coins: __testEval('gameState.player.coins'),
      branches: __testEval('gameState.player.branches'),
      walk: window.__burbzVillageWalkDebug.state(),
      journalVisible: !!document.querySelector('.vd-journal') && !document.querySelector('.vd-journal').hidden,
      geometricRuntime: window.__burbzVillageWalkDebug.state().discoveries.objects.some(o => Object.hasOwn(o, 'variant') && Object.hasOwn(o, 'rewardGrantable'))
    }));
    await screenshot(page, 'offline-village-discovery');
    check('offline_reload_uses_candidate_build', offlineState.build === rev, offlineState.build, rev);
    check('offline_retained_save_preserved', offlineState.retainedSave === 'retained-save' && offlineState.coins === 2468 && offlineState.branches === 1357, offlineState);
    check('offline_village_walk_ready', offlineState.walk.ready && !offlineState.walk.failed, { ready: offlineState.walk.ready, failed: offlineState.walk.failed });
    check('offline_new_discovery_ui_geometry_visible', offlineState.journalVisible && offlineState.geometricRuntime, {
      journalVisible: offlineState.journalVisible,
      geometricRuntime: offlineState.geometricRuntime,
      objects: offlineState.walk.discoveries.objects.slice(0, 5)
    });

    report.cache = { cacheProbe: { keys: cacheProbe.keys, cacheName: cacheProbe.cacheName }, cacheHashes };
    report.offlineState = offlineState;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(runDir, 'life-int-pwa-report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(evidenceRoot, 'latest-pwa-proof.txt'), `${runDir}\n`);
    await context.close();
    console.log(JSON.stringify({ ok: true, runDir, checks: report.checks.length }, null, 2));
  } catch (error) {
    report.error = error.stack || error.message;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(runDir, 'life-int-pwa-report.json'), JSON.stringify(report, null, 2));
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
    server.close();
  }
})();
