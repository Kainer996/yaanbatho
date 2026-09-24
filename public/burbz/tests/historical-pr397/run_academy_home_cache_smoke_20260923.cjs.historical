#!/usr/bin/env node
'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/opt/oauth-station/node_modules/playwright');

const root = path.resolve(__dirname, '..');
const out = path.resolve(process.env.EVIDENCE_DIR || process.argv[2] || path.join(root, 'tests/evidence/academy-home-cache-20260923'));
const htmlSource = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const marker = htmlSource.match(/scan_home\.css\?v=([^"\s]+)/)[1];
const build = htmlSource.match(/const BURBZ_BUILD = '([^']+)';/)[1];
const assets = [
  'index.html',
  `scan_home.css?v=${marker}`,
  `scan_home_core.js?v=${marker}`,
  `scan_home.js?v=${marker}`,
  `academy_home_intro.js?v=${marker}`,
];
const profileId = 'cacheWorkerProfile20260923';
const fallbackRoots = (() => {
  try {
    const configured = fs.readFileSync('/etc/burbz-webroot', 'utf8').trim();
    return [configured, '/etc/burbz-webroot'].filter(Boolean);
  } catch (_) {
    return ['/etc/burbz-webroot'];
  }
})();

const report = {
  marker,
  url: null,
  checks: [],
  cached: {},
  missing: [],
  fallback: [],
  blocked: [],
  consoleErrors: [],
  pageErrors: [],
  limits: [
    'Candidate-only local install smoke; old-main reopened takeover remains for independent CACHE-002 validator.',
    'Chromium software rendering in isolated context; not physical-phone performance.'
  ],
};

fs.mkdirSync(out, { recursive: true });

function sha256(bytes) {
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function pass(name, detail = true) {
  report.checks.push({ name, detail });
  console.log('PASS', name);
}

function contentType(file) {
  return ({
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.webp': 'image/webp',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.woff2': 'font/woff2',
  })[path.extname(file)] || 'application/octet-stream';
}

function readServedFile(rel) {
  const clean = rel.split('?')[0].replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, clean);
  if (!file.startsWith(root + path.sep)) {
    const err = new Error('forbidden path');
    err.status = 403;
    throw err;
  }
  let bytes = fs.readFileSync(file);
  if (bytes.length < 200 && bytes.toString('utf8').startsWith('version https://git-lfs.github.com/spec/')) {
    let hydrated = null;
    for (const dir of fallbackRoots) {
      const fallback = path.resolve(dir, clean);
      if (fallback.startsWith(path.resolve(dir) + path.sep) && fs.existsSync(fallback) && fs.statSync(fallback).isFile()) {
        hydrated = fs.readFileSync(fallback);
        break;
      }
    }
    if (!hydrated) throw new Error('Unhydrated LFS asset has no fallback: ' + clean);
    bytes = hydrated;
    report.fallback.push(clean);
  }
  return { file, clean, bytes };
}

function createServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost/');
    if (url.pathname === '/burbz/api/auth/config') {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ configured: false, googleClientId: '' }));
      return;
    }
    const rel = decodeURIComponent(url.pathname).replace(/^\/burbz\/?/, '') || 'index.html';
    try {
      const { file, clean, bytes } = readServedFile(rel);
      res.setHeader('Content-Type', contentType(file));
      res.setHeader('Cache-Control', 'no-cache');
      res.end(bytes);
      if (/\.(html|js|css)$/.test(clean)) {
        report.served = report.served || {};
        report.served[clean] = sha256(bytes);
      }
    } catch (error) {
      report.missing.push({ rel, message: error.message });
      res.writeHead(error.status || 404);
      res.end(error.message);
    }
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, url: `http://localhost:${port}/burbz/` });
    });
  });
}

function seedState() {
  return {
    photoProfileId: profileId,
    player: { name: 'Cache QA', level: 20, xp: 0, totalCaptures: 1, wins: 0, losses: 0, coins: 200000, branches: 200000, stone: 1000 },
    settings: { sfx: false, music: false, particles: false, vibration: false, invertVerticalLook: false, appearance: 'normal' },
    academyBuilderVersion: 8,
    academyBuildings: {
      outdoors: { built: true, builtAt: 'starter' },
      tavern: { built: true, builtAt: 'cache-smoke', x: 50, y: 80 },
    },
    flock: [{
      id: 'cache-bird-1',
      name: 'Blue Tit',
      species: 'Blue Tit',
      commonName: 'Blue Tit',
      scientificName: 'Cyanistes caeruleus',
      rarity: 'common',
      level: 20,
      hp: 100,
      maxHp: 100,
      care: { hunger: 42, happiness: 88, lastFed: null, lastTrained: null },
      training: { feedCount: 0, trainCount: 0, hpBonus: 0, atkBonus: 0, defBonus: 0, spdBonus: 0, intBonus: 0, staminaBonus: 0, chaBonus: 0, magBonus: 0 },
      academy: { room: 'outdoors', lastGroom: null, lastForage: null },
    }],
    inventory: { items: { berry_bundle: 1, shiny_pebble: 1 }, gear: { thorn_talons: 1, willow_wand: 1, ember_wisp: 0, tonic_of_vigour: 1 }, equipment: { '@player': { spell: 'ember_wisp' } }, giftsGiven: {}, larder: { small_bird_prey_ration: 2, mealworm_scoop: 2, sunflower_seeds: 2, live_minnow: 1, hedgerow_berries: 1, gizzard_grit: 1, field_vole: 3, wood_mouse: 2, carrion_scraps: 2, common_frog: 1 } },
    pantry: { seeds: 10, suet: 10, insects: 10, worms: 10, berries: 10, fruit: 10, fish: 10, flying: 8, meat: 10, carrion: 10, acorns: 10, aquatic: 10 },
    quests: {},
    badges: {},
    discoveredSpecies: {},
    birdExpeditions: [],
    walkingQuests: { active: null, history: [] },
    tutorialFlow: { errandClaimed: true, barracksGiftGranted: true, barracksCelebrated: true, openingStarted: true, discoveryReviewed: true, companionMet: true, kitchenIntroduced: true, kitchenShortageSeen: true, openingSupplyReturnClaimed: true, openingCareDone: true },
    diary: { entries: [] },
    completionNotices: [],
    birdRoles: { academy: {}, villages: {}, regions: {} },
    chefCareers: {},
  };
}

async function browserShaForCache(page, cacheName, asset) {
  return page.evaluate(async ({ cacheName, asset }) => {
    const cache = await caches.open(cacheName);
    const response = await cache.match(new URL(asset, location.href));
    if (!response) return null;
    const bytes = await response.arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return {
      bytes: bytes.byteLength,
      sha256: Array.from(new Uint8Array(digest)).map(n => n.toString(16).padStart(2, '0')).join(''),
    };
  }, { cacheName, asset });
}

(async () => {
  let browser;
  let context;
  let server;
  try {
    const served = await createServer();
    server = served.server;
    report.url = served.url;
    browser = await chromium.launch({
      headless: true,
      executablePath: chromium.executablePath(),
      args: ['--no-sandbox', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
    context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      hasTouch: true,
      serviceWorkers: 'allow',
    });
    await context.addInitScript(({ state, profileId }) => {
      if (!localStorage.getItem('burbz_state')) {
        localStorage.setItem('burbz_epoch', 'new-dawn-evil-burbz-20260720');
        localStorage.setItem('burbzIntroSeen:two-part-hf-20260729', '1');
        localStorage.removeItem('burbzIntroPending:two-part-hf-20260729');
        localStorage.setItem('burbzTutorialState:merlin-interactive-flow-v7-20260728', JSON.stringify({ version: 'merlin-interactive-flow-v7-20260728', status: 'completed' }));
        localStorage.setItem('burbzTutorialChapters:merlin-interactive-flow-v7-20260728', JSON.stringify([
          'story', 'quests', 'kitchen_need', 'care', 'errand', 'academy', 'academy_tour', 'explore',
          'scan', 'birdex', 'battle', 'village', 'empire_villages', 'empire_towns', 'town',
          'diary', 'forge', 'inventory', 'leaderboards',
        ]));
        localStorage.setItem(`burbzAcademyHomeIntro:academy-home-intro-v444-20260922:${profileId}`, '1');
        localStorage.setItem('burbz_state', JSON.stringify(state));
      }
    }, { state: seedState(), profileId });
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') return route.continue();
      report.blocked.push(route.request().url());
      return route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    page.on('pageerror', error => report.pageErrors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') report.consoleErrors.push(message.text());
    });

    await page.goto(served.url, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.waitForFunction(() => navigator.serviceWorker.controller, null, { timeout: 120000 });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('#screen-scan.active').waitFor({ timeout: 90000 });
    const loadedPinnedConsumers = await page.evaluate(marker => Array.from(document.querySelectorAll('link[href],script[src]'))
      .map(el => el.href || el.src)
      .filter(url => url.includes(marker))
      .sort(), marker);
    for (const file of ['scan_home.css', 'scan_home_core.js', 'scan_home.js', 'academy_home_intro.js']) {
      assert(loadedPinnedConsumers.some(url => url.includes(`${file}?v=${marker}`)), `${file} was not loaded with the academy home marker`);
    }
    pass('candidate document loaded pinned Academy Home consumers under active service worker controller', { loadedPinnedConsumers });

    const cacheName = await page.evaluate(build => caches.keys().then(keys => keys.find(key => key.endsWith(build))), build);
    assert(cacheName, 'active cache with current global build was not found');
    const shellComplete = await page.evaluate(async cacheName => {
      const cache = await caches.open(cacheName);
      const response = await cache.match('.burbz-shell-complete');
      return response ? response.text() : null;
    }, cacheName);
    assert.equal(shellComplete, cacheName);
    pass('service worker required install list completed and wrote shell marker', { cacheName });

    for (const asset of assets) {
      const cached = await browserShaForCache(page, cacheName, asset);
      assert(cached, `${asset} missing from candidate cache`);
      const source = fs.readFileSync(path.join(root, asset.split('?')[0]));
      assert.equal(cached.sha256, sha256(source), `${asset} cached SHA mismatch`);
      assert.equal(cached.bytes, source.length, `${asset} cached byte length mismatch`);
      report.cached[asset] = cached;
    }
    pass('candidate cache contains exact source bytes for HTML and changed Academy Home runtimes', report.cached);

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('#screen-scan.active').waitFor({ timeout: 90000 });
    await page.waitForTimeout(700);
    const pickerOpenAfterOfflineReload = await page.locator('#academyBuildPicker[open]').count();
    report.pickerOpenAfterOfflineReload = pickerOpenAfterOfflineReload;
    assert.equal(pickerOpenAfterOfflineReload, 0, 'Build rooms picker must be closed after offline reload before trigger proof');
    await page.locator('#academyHomeTree [data-home-action="build-rooms"]').click();
    await page.locator('#academyBuildPicker[open]').waitFor({ timeout: 30000 });
    const browseState = await page.evaluate(() => JSON.parse(localStorage.getItem('burbz_state') || '{}'));
    assert.equal(browseState.player.coins, 200000);
    assert.equal(browseState.player.branches, 200000);
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => !document.querySelector('#academyBuildPicker')?.open, null, { timeout: 30000 });
    const focusRestored = await page.evaluate(() => document.activeElement?.dataset?.homeAction || '');
    assert.equal(focusRestored, 'build-rooms');
    pass('offline native Build rooms picker starts closed, opens from Home trigger, browsing does not spend, Escape closes and restores focus', { pickerOpenAfterOfflineReload, focusRestored });

    await page.locator('[data-home-action="academy-room-tavern"]').click();
    await page.locator('#screen-academy-room.active').waitFor({ timeout: 30000 });
    await page.locator('#academyRoomBackBtn').click();
    await page.locator('#screen-scan.active').waitFor({ timeout: 30000 });
    pass('offline owned Birdhouse room opens through native interior and returns to Home');

    await page.locator('[data-home-native-room="outdoors"] .academy-btn').filter({ hasText: 'Forage' }).first().click();
    await page.waitForFunction(() => {
      const state = JSON.parse(localStorage.getItem('burbz_state') || '{}');
      return !!state.flock?.find(bird => bird.id === 'cache-bird-1')?.academy?.lastForage;
    }, null, { timeout: 30000 });
    const afterForage = await page.evaluate(() => JSON.parse(localStorage.getItem('burbz_state') || '{}'));
    const forageStamp = afterForage.flock.find(bird => bird.id === 'cache-bird-1').academy.lastForage;
    assert(forageStamp, 'Forage timestamp was not persisted');
    await page.screenshot({ path: path.join(out, 'offline-home-after-forage.png'), fullPage: true });
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 90000 });
    await page.locator('#screen-scan.active').waitFor({ timeout: 90000 });
    const afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('burbz_state') || '{}'));
    assert.equal(afterReload.flock.find(bird => bird.id === 'cache-bird-1').academy.lastForage, forageStamp);
    pass('offline Outdoors Forage executes natively and persists across reload', { forageStamp });

    assert.deepEqual(report.pageErrors, []);
    const severeConsole = report.consoleErrors.filter(text => !/Failed to load resource|ERR_BLOCKED_BY_CLIENT|fonts\.googleapis|tiles\.openfreemap\.org/.test(text));
    assert.deepEqual(severeConsole, []);
    report.complete = true;
  } finally {
    fs.writeFileSync(path.join(out, 'cache-smoke.json'), JSON.stringify(report, null, 2));
    await context?.close();
    await browser?.close();
    server?.closeAllConnections?.();
    server?.close();
  }
})().catch(error => {
  report.error = error.stack || String(error);
  try { fs.writeFileSync(path.join(out, 'cache-smoke.json'), JSON.stringify(report, null, 2)); } catch (_) {}
  console.error(error);
  process.exit(1);
});
