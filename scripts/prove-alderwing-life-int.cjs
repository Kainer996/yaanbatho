'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public/burbz');
const baselineDir = process.env.BASELINE_DIR || '/root/burbz-alderwing-cleanup-evidence/baseline';
const evidenceRoot = process.env.EVIDENCE_DIR || '/root/burbz-alderwing-cleanup-evidence/work-life-int/browser';
const runDir = path.join(evidenceRoot, new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(runDir, { recursive: true });

const chromePath = [
  process.env.CHROME_PATH,
  '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  '/usr/bin/chromium'
].filter(Boolean).find(file => fs.existsSync(file));
if (!chromePath) throw Error('No Chromium executable found. Set CHROME_PATH.');

const moduleFiles = [
  'village_walk.js',
  'village_discovery_content.js',
  'village_discovery_core.js',
  'village_discoveries.js',
  'village_discoveries.css',
  'village_walk.css',
  'building_rooms.js'
];

const report = {
  startedAt: new Date().toISOString(),
  runDir,
  command: { argv: process.argv, cwd: process.cwd(), node: process.version, chromePath },
  limits: {
    maxDiscoveryDrawCalls: 120,
    maxDiscoveryTriangles: 25000,
    performanceRule: 'candidateMedianMs <= baselineMedianMs * 1.25 + 5 after warmup',
    sampleCount: 140,
    fixture: 'synthetic flat walkable village, 1280x800 viewport, dpr 1, service workers blocked for lifecycle/performance'
  },
  browser: {},
  files: {},
  checks: [],
  console: [],
  pageErrors: [],
  screenshots: []
};

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

for (const file of moduleFiles) {
  const full = path.join(publicRoot, file);
  if (fs.existsSync(full)) report.files[file] = { path: full, sha256: sha(full) };
}

function check(id, pass, observed, expected = true) {
  report.checks.push({ id, pass, expected, observed });
  assert.ok(pass, `${id}: ${JSON.stringify(observed)}`);
}

function contentType(file) {
  if (file.endsWith('.html')) return 'text/html; charset=utf-8';
  if (file.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (file.endsWith('.css')) return 'text/css; charset=utf-8';
  if (file.endsWith('.webp')) return 'image/webp';
  if (file.endsWith('.png')) return 'image/png';
  return 'application/octet-stream';
}

function rewardText(reward = {}) {
  const bits = [];
  if (Number(reward.coins) > 0) bits.push(`${reward.coins} coins`);
  if (Number(reward.branches) > 0) bits.push(`${reward.branches} branches`);
  for (const [id, count] of Object.entries(reward.materials || {})) if (Number(count) > 0) bits.push(`${count} ${id}`);
  for (const [id, count] of Object.entries(reward.gear || {})) if (Number(count) > 0) bits.push(`${count} ${id}`);
  return bits.join(', ');
}

function pageHtml() {
  return `<!doctype html>
<meta charset="utf-8">
<title>Alderwing lifecycle integration proof</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0c1412;color:white;font-family:sans-serif}.stage{position:absolute;left:-9999px;top:-9999px;width:1px;height:1px;overflow:hidden}</style>
<link rel="stylesheet" href="/village_walk.css">
<link rel="stylesheet" href="/village_discoveries.css">
<div id="borrowed" class="stage"></div>
<script src="/lib/three.min.js"></script>
<script>
window.BurbzFlightCraft = {};
window.BurbzShoreWater = {};
window.BurbzOpenLandCore = {};
window.BurbzWildernessPlacesCore = {};
window.BurbzWildernessPlaces = {};
window.BurbzBuildingWorkCore = {};
window.BurbzBuildingWork = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, reset(){}, diagnostics(){ return {}; } }; } };
window.BurbzVillageHarvestScene = { prepare(){} };
window.BurbzVillageHarvestCore = {};
window.BurbzVillageHarvest = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, diagnostics(){ return {}; } }; } };
window.BurbzInteriorLifeCore = {};
window.BurbzInteriorLife = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, closePanel(){ return false; }, diagnostics(){ return { stub:true }; } }; } };
window.BurbzAcademyFlightCore = {};
window.BurbzAcademyFlight = { attach(){ return null; } };
window.BurbzFirstPersonMap = {};
window.BurbzFirstPersonHud = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, closePanel(){ return false; }, diagnostics(){ return {}; } }; } };
window.BurbzWorldSky = {};
window.BurbzVillageWorldCore = {};
window.BurbzVillageWorld = { attach(){ return Promise.resolve(); } };
window.BurbzAlderwingIntro = { inputReset(){}, inputStart(){}, inputEnd(){}, inputMove(){}, inputLook(){} };
window.BurbzLookSettings = { closeFor(){}, isOpen(){ return false; }, vertical(v){ return v; } };
window.BurbzVillageWalkCore = {
  EYE: 1.52,
  autoFlight(){ return { allow(){}, start(){}, drag(){}, release(){}, reset(){}, forward(){ return 0; }, state(){ return { enabled:false, armed:false, latched:false }; } }; },
  move(player, movement, dt, world){
    const speed = 4.2 * Math.min(dt || 0, 0.05);
    player.x += ((movement.side || 0) * Math.cos(player.yaw) - (movement.forward || 0) * Math.sin(player.yaw)) * speed;
    player.z += ((movement.side || 0) * Math.sin(player.yaw) + (movement.forward || 0) * Math.cos(player.yaw)) * speed;
    player.y = world.height(player.x, player.z);
  },
  look(player, dx, dy, scale){ player.yaw -= dx * scale; player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - dy * scale)); },
  outwardBoundary(){ return false; },
  quality(dpr, maxDpr, intervals, fastStreak){ return { dpr, fastStreak }; }
};
window.BurbzVillageWalkScene = { create(){ return window.__proof.world; }, batch(){ return function unbatch(){}; } };
window.BurbzBuildingRoomsCore = {
  plan(target){ return { name: target?.buildingId ? 'Proof Cottage' : 'Interior', exit: { x: 0, z: 0.6 }, action: null }; },
  world(){ return window.__proof.roomWorld; }
};
window.BurbzBuildingRoomsScene = {
  create(T, plan){
    const scene = new T.Scene();
    scene.add(new T.HemisphereLight(0xfff4df, 0x263330, 1.2));
    return { plan, scene, world: window.__proof.roomWorld, dispose(){ window.__proof.roomDisposals++; } };
  }
};
</script>
<script src="/village_discovery_content.js"></script>
<script src="/village_discovery_core.js"></script>
<script src="/building_rooms.js"></script>
<script src="/village_discoveries.js"></script>
<script src="/village_walk.js"></script>`;
}

function createServer(targetDir) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = null;
    if (url.pathname === '/' || url.pathname === '/harness.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(pageHtml());
      return;
    }
    const rel = url.pathname.slice(1);
    if (rel === 'lib/three.min.js') file = path.join(publicRoot, rel);
    else if (rel.startsWith('assets/')) file = path.join(publicRoot, rel);
    else if (moduleFiles.includes(rel)) {
      const target = path.join(targetDir, rel);
      file = fs.existsSync(target) ? target : path.join(publicRoot, rel);
    } else if (rel.endsWith('.css')) {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end('');
      return;
    } else if (rel.endsWith('.js')) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end('/* empty proof dependency */');
      return;
    }
    if (!file || !fs.existsSync(file)) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({
    server,
    url: `http://127.0.0.1:${server.address().port}/harness.html`
  })));
}

async function preparePage(page, url) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.THREE && window.BurbzVillageWalk && window.BurbzVillageDiscoveries && window.BurbzBuildingRooms);
  await page.evaluate(serializedRewardText => {
    window.__proofRewardText = eval(serializedRewardText);
    if (!window.__proof) {
      const originalRaf = window.requestAnimationFrame.bind(window);
      const originalCancel = window.cancelAnimationFrame.bind(window);
      const activeRafs = new Set();
      window.requestAnimationFrame = cb => {
        const id = originalRaf(ts => {
          activeRafs.delete(id);
          if (window.__proof?.measuringFrames) {
            if (window.__proof.lastFrameTime) window.__proof.frameIntervals.push(ts - window.__proof.lastFrameTime);
            window.__proof.lastFrameTime = ts;
          }
          cb(ts);
        });
        activeRafs.add(id);
        window.__proof.rafMaxActive = Math.max(window.__proof.rafMaxActive, activeRafs.size);
        return id;
      };
      window.cancelAnimationFrame = id => {
        activeRafs.delete(id);
        return originalCancel(id);
      };
      const listenerStats = { active: 0, total: 0, aborted: 0 };
      const nativeAdd = EventTarget.prototype.addEventListener;
      EventTarget.prototype.addEventListener = function(type, listener, options) {
        const signal = options && typeof options === 'object' ? options.signal : null;
        if (signal && !signal.aborted) {
          listenerStats.active++;
          listenerStats.total++;
          signal.addEventListener('abort', () => {
            listenerStats.active--;
            listenerStats.aborted++;
          }, { once: true });
        }
        return nativeAdd.call(this, type, listener, options);
      };
      const disposeCounts = { geometry: 0, material: 0, texture: 0 };
      const gDispose = THREE.BufferGeometry.prototype.dispose;
      THREE.BufferGeometry.prototype.dispose = function() { disposeCounts.geometry++; return gDispose.call(this); };
      const mDispose = THREE.Material.prototype.dispose;
      THREE.Material.prototype.dispose = function() { disposeCounts.material++; return mDispose.call(this); };
      const tDispose = THREE.Texture.prototype.dispose;
      THREE.Texture.prototype.dispose = function() { disposeCounts.texture++; return tDispose.call(this); };
      const world = {
        radius: 26,
        segments: [],
        spawn(){ return { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.12, mode: 'walk' }; },
        height(){ return 0; },
        allowed(){ return true; },
        surface(){ return 'grass'; }
      };
      const roomWorld = {
        radius: 6,
        segments: [],
        spawn(){ return { x: 0, y: 0, z: -0.8, yaw: 0, pitch: -0.08, mode: 'walk' }; },
        height(){ return 0; },
        allowed(){ return true; },
        surface(){ return 'wood'; }
      };
      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0x16221d);
      scene.add(new THREE.HemisphereLight(0xf8f0db, 0x435245, 1.7));
      const sun = new THREE.DirectionalLight(0xffe6b0, 2.3);
      sun.position.set(4, 8, 6);
      scene.add(sun);
      const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(1280, 800, false);
      document.getElementById('borrowed').append(renderer.domElement);
      const camera = new THREE.PerspectiveCamera(58, 1280 / 800, 0.08, 120);
      const building = new THREE.Group();
      building.userData = { buildingId: 'proof-cottage', wardSeed: 5150 };
      const model = new THREE.Group();
      model.userData = { architecture: true, door: { x: 0, z: 0 }, footprint: { maxZ: 0 } };
      building.add(model);
      scene.add(building);
      window.__proof = {
        activeRafs,
        listenerStats,
        disposeCounts,
        world,
        roomWorld,
        scene,
        renderer,
        camera,
        building,
        roomDisposals: 0,
        rafMaxActive: 0,
        records: {},
        settlements: [],
        measuringFrames: false,
        lastFrameTime: 0,
        frameIntervals: []
      };
    }
    window.__proof.makeApi = seed => {
      const core = window.BurbzVillageDiscoveryCore;
      const key = String(seed);
      if (!window.__proof.records[key]) {
        const state = { villageDiscoveries: { version: 1, seed: core.hash(`life-int-${seed}`), villages: {} } };
        const rec = core.village(state, seed, `life-int-${seed}`);
        window.__proof.records[key] = { state, rec };
      }
      const rec = window.__proof.records[key].rec;
      return {
        prepare(){},
        record(){ return rec; },
        rewardText: window.__proofRewardText,
        act(type, id, giver){ return core.act(rec, type, id, giver); }
      };
    };
    window.__proof.openSettlement = async ({ name, seed, retained = false, withDoor = false }) => {
      if (window.BurbzVillageWalk.isOpen()) {
        window.BurbzVillageWalk.close('navigation');
        await window.BurbzVillageWalk.whenClosed();
      }
      const api = window.__proof.makeApi(seed);
      const source = {
        scene: window.__proof.scene,
        renderer: window.__proof.renderer,
        camera: window.__proof.camera,
        buildings: withDoor ? [window.__proof.building] : [],
        movers: [],
        world: window.__proof.world,
        discovery: retained ? { api, world: window.__proof.world } : null,
        dispose(){ window.__proof.settlements.push({ name, disposed: true }); }
      };
      const opened = await window.BurbzVillageWalk.open({
        name,
        source: async () => source,
        discoveries: retained ? undefined : api,
        interiors: {
          describe(target){ return target?.buildingId ? { name: 'Proof Cottage' } : null; },
          people(){ return []; },
          open(){}
        }
      });
      if (!opened) throw Error(`open failed for ${name}`);
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return true;
    };
    window.__proof.discoveryContribution = () => {
      const diag = window.BurbzVillageWalk.diagnostics();
      const root = window.__proof.scene.children.find(child =>
        child.type === 'Group' &&
        child.children.length === diag.discoveries.objects.length &&
        child.children.every(grp => grp.type === 'Group')
      );
      if (!root) throw Error('discovery root not found');
      const visibleWorld = node => {
        for (let cur = node; cur; cur = cur.parent) if (!cur.visible) return false;
        return true;
      };
      let draws = 0;
      let triangles = 0;
      const signatures = [];
      root.traverse(node => {
        if (!node.isMesh || !node.geometry || !visibleWorld(node)) return;
        draws++;
        const g = node.geometry;
        triangles += g.index ? g.index.count / 3 : (g.attributes?.position?.count || 0) / 3;
        signatures.push(g.type);
      });
      return { draws, triangles, signatures };
    };
    window.__proof.domState = () => ({
      huds: document.querySelectorAll('.vd-hud').length,
      panels: document.querySelectorAll('.vd-panel').length,
      hudHidden: document.querySelector('.vd-hud')?.hidden || false,
      panelOpen: !!document.querySelector('.vd-panel:not([hidden])'),
      doorVisible: !!document.querySelector('.vr-door') && !document.querySelector('.vr-door').hidden,
      rootOpen: !!document.getElementById('villageWalk')
    });
    window.__proof.runtimeState = () => ({
      diag: window.BurbzVillageWalk.diagnostics(),
      dom: window.__proof.domState(),
      activeRafs: window.__proof.activeRafs.size,
      rafMaxActive: window.__proof.rafMaxActive,
      disposeCounts: { ...window.__proof.disposeCounts },
      listenerStats: { ...window.__proof.listenerStats },
      rendererSame: window.__proof.renderer === window.__proof.renderer,
      canvasInWalk: !!document.querySelector('#villageWalk canvas'),
      webgl: (() => {
        const gl = window.__proof.renderer.getContext();
        const dbg = gl.getExtension('WEBGL_debug_renderer_info');
        return {
          vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
          renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
        };
      })()
    });
  }, rewardText.toString());
}

async function waitFrames(page, frames = 8) {
  await page.evaluate(count => new Promise(resolve => {
    let left = count;
    function tick() {
      if (--left <= 0) resolve();
      else requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }), frames);
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)] || 0;
}

async function screenshot(page, name) {
  const file = path.join(runDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
}

async function runLifecycle(browser) {
  const { server, url } = await createServer(publicRoot);
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(new URL(url).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('console', msg => report.console.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => report.pageErrors.push(err.stack || err.message));
    await preparePage(page, url);
    report.browser.userAgent = await page.evaluate(() => navigator.userAgent);

    const settlements = [];
    for (const item of [
      { name: 'Proof Village', seed: 101 },
      { name: 'Proof Village', seed: 101 },
      { name: 'Proof Village', seed: 101 },
      { name: 'Proof Village', seed: 101 },
      { name: 'Proof Village', seed: 101 },
      { name: 'Proof Town', seed: 202 },
      { name: 'Retained Hamlet', seed: 303, retained: true }
    ]) {
      await page.evaluate(item => window.__proof.openSettlement(item), item);
      await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().ready);
      await waitFrames(page, 8);
      const state = await page.evaluate(() => ({ runtime: window.__proof.runtimeState(), contribution: window.__proof.discoveryContribution() }));
      settlements.push({
        name: item.name,
        seed: item.seed,
        retained: !!item.retained,
        questId: state.runtime.diag.discoveries.questId,
        objects: state.runtime.diag.discoveries.objects.length,
        residents: state.runtime.diag.discoveries.residents.length,
        contribution: state.contribution
      });
      if (settlements.length === 1) await screenshot(page, 'village-discovery-open');
      await page.evaluate(() => window.BurbzVillageWalk.close('navigation'));
      await page.waitForFunction(() => !window.BurbzVillageWalk.isOpen());
      await waitFrames(page, 2);
    }
    const afterCycles = await page.evaluate(() => window.__proof.runtimeState());
    check('cycle_settlement_count', settlements.length === 7, { settlements: settlements.map(s => ({ name: s.name, seed: s.seed, questId: s.questId })) }, 7);
    check('single_raf_owner_bound', afterCycles.rafMaxActive <= 2, { rafMaxActive: afterCycles.rafMaxActive }, '<=2');
    check('raf_released_after_close', afterCycles.activeRafs === 0, { activeRafs: afterCycles.activeRafs }, 0);
    check('discovery_dom_released_after_cycles', afterCycles.dom.huds === 0 && afterCycles.dom.panels === 0 && !afterCycles.dom.rootOpen, afterCycles.dom);
    check('listeners_aborted_after_cycles', afterCycles.listenerStats.active === 0 && afterCycles.listenerStats.aborted >= 7, afterCycles.listenerStats);
    check('discovery_resources_disposed', afterCycles.disposeCounts.geometry > 0 && afterCycles.disposeCounts.material > 0, afterCycles.disposeCounts);
    check('retained_has_no_wrong_residents', settlements.at(-1).residents === 0, settlements.at(-1));

    await page.evaluate(() => window.__proof.openSettlement({ name: 'Door Village', seed: 404, withDoor: true }));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().interiors?.nearest);
    await page.keyboard.press('KeyF');
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().interiors?.inside);
    await waitFrames(page, 4);
    const inside = await page.evaluate(() => window.__proof.runtimeState());
    await screenshot(page, 'interior-pauses-discovery');
    check('interior_entry_pauses_discovery', inside.diag.interiors.inside && inside.diag.discoveries.paused === true && inside.dom.hudHidden === true, {
      interiors: inside.diag.interiors,
      discoveries: inside.diag.discoveries,
      dom: inside.dom
    });
    await page.evaluate(() => window.BurbzVillageWalk.close('navigation'));
    await page.waitForFunction(() => !window.BurbzVillageWalk.isOpen());

    await page.evaluate(() => window.__proof.openSettlement({ name: 'Blur Village', seed: 505 }));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().running);
    await page.keyboard.down('KeyW');
    await page.evaluate(() => window.dispatchEvent(new Event('blur')));
    await page.waitForFunction(() => !window.BurbzVillageWalk.diagnostics().running);
    const blurred = await page.evaluate(() => window.__proof.runtimeState());
    await page.keyboard.up('KeyW');
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().running);
    const focused = await page.evaluate(() => window.__proof.runtimeState());
    check('blur_releases_inputs_and_raf', blurred.activeRafs === 0 && blurred.diag.running === false, blurred);
    check('focus_resumes_without_stale_ui', focused.diag.running === true && focused.dom.panelOpen === false, focused);
    await page.evaluate(() => window.BurbzVillageWalk.close('navigation'));
    await page.waitForFunction(() => !window.BurbzVillageWalk.isOpen());

    await page.evaluate(() => window.__proof.openSettlement({ name: 'Context Village', seed: 606 }));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().ready);
    const lost = await page.evaluate(() => {
      const event = new Event('webglcontextlost', { cancelable: true });
      window.__proof.renderer.domElement.dispatchEvent(event);
      return event.defaultPrevented;
    });
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().failed);
    await screenshot(page, 'context-loss-error');
    const contextLost = await page.evaluate(() => window.__proof.runtimeState());
    check('context_loss_fails_and_releases_inputs', lost && contextLost.diag.failed && contextLost.activeRafs === 0, contextLost);
    await page.evaluate(() => window.BurbzVillageWalk.close('navigation'));
    await page.waitForFunction(() => !window.BurbzVillageWalk.isOpen());

    const contribution = settlements[0].contribution;
    check('candidate_discovery_draw_call_bound', contribution.draws <= report.limits.maxDiscoveryDrawCalls, contribution, `<=${report.limits.maxDiscoveryDrawCalls}`);
    check('candidate_discovery_triangle_bound', contribution.triangles <= report.limits.maxDiscoveryTriangles, contribution, `<=${report.limits.maxDiscoveryTriangles}`);
    report.lifecycle = { settlements, afterCycles, inside, blurred, focused, contextLost, contribution };
  } finally {
    if (context) await context.close().catch(() => {});
    server.close();
  }
}

async function measurePerformance(browser, targetName, targetDir) {
  if (!fs.existsSync(targetDir)) throw Error(`${targetName} target directory not found: ${targetDir}`);
  const { server, url } = await createServer(targetDir);
  let context;
  try {
    context = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(new URL(url).origin) ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('console', msg => report.console.push({ type: `${targetName}:${msg.type()}`, text: msg.text() }));
    page.on('pageerror', err => report.pageErrors.push(`${targetName}: ${err.stack || err.message}`));
    await preparePage(page, url);
    await page.evaluate(() => window.__proof.openSettlement({ name: 'Performance Village', seed: 707 }));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().ready);
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().frames > 80);
    await page.evaluate(() => {
      window.__proof.frameIntervals = [];
      window.__proof.lastFrameTime = 0;
      window.__proof.measuringFrames = true;
      window.__burbzVillageWalkDebug.resetSamples();
    });
    await page.waitForFunction(count => window.BurbzVillageWalk.diagnostics().sampleCount >= count, report.limits.sampleCount, { timeout: 30000 });
    const result = await page.evaluate(() => {
      const diag = window.BurbzVillageWalk.diagnostics();
      window.__proof.measuringFrames = false;
      return {
        diagnostics: diag,
        frameIntervals: window.__proof.frameIntervals.slice(),
        userAgent: navigator.userAgent,
        webgl: window.__proof.runtimeState().webgl,
        contribution: window.__proof.discoveryContribution()
      };
    });
    await screenshot(page, `${targetName}-performance`);
    await page.evaluate(() => window.BurbzVillageWalk.close('navigation'));
    await page.waitForFunction(() => !window.BurbzVillageWalk.isOpen());
    return {
      targetName,
      targetDir,
      moduleSha256: Object.fromEntries(moduleFiles.filter(file => fs.existsSync(path.join(targetDir, file))).map(file => [file, sha(path.join(targetDir, file))])),
      medianMs: Number.isFinite(result.diagnostics.medianMs) ? result.diagnostics.medianMs : median(result.frameIntervals),
      rawRafMedianMs: median(result.frameIntervals),
      meanMs: result.diagnostics.meanMs,
      p95Ms: result.diagnostics.p95Ms,
      sampleCount: result.diagnostics.sampleCount,
      rawIntervalCount: result.frameIntervals.length,
      contribution: result.contribution,
      webgl: result.webgl,
      userAgent: result.userAgent
    };
  } finally {
    if (context) await context.close().catch(() => {});
    server.close();
  }
}

(async () => {
  let browser;
  try {
    browser = await chromium.launch({
      headless: true,
      executablePath: chromePath,
      args: ['--no-sandbox', '--use-angle=swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding']
    });
    await runLifecycle(browser);
    const baseline = await measurePerformance(browser, 'baseline', baselineDir);
    const candidate = await measurePerformance(browser, 'candidate', publicRoot);
    const allowedMedian = baseline.medianMs * 1.25 + 5;
    check('performance_baseline_sample_count', baseline.sampleCount >= report.limits.sampleCount, baseline.sampleCount, `>=${report.limits.sampleCount}`);
    check('performance_candidate_sample_count', candidate.sampleCount >= report.limits.sampleCount, candidate.sampleCount, `>=${report.limits.sampleCount}`);
    check('performance_median_bound', candidate.medianMs <= allowedMedian, { baselineMedianMs: baseline.medianMs, candidateMedianMs: candidate.medianMs, allowedMedianMs: allowedMedian }, '<= baseline*1.25+5ms');
    report.performance = { baseline, candidate, allowedMedianMs: allowedMedian };
    report.browser.webgl = candidate.webgl;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(runDir, 'life-int-browser-report.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(evidenceRoot, 'latest-browser-proof.txt'), `${runDir}\n`);
    console.log(JSON.stringify({ ok: true, runDir, checks: report.checks.length }, null, 2));
  } catch (error) {
    report.error = error.stack || error.message;
    report.finishedAt = new Date().toISOString();
    fs.writeFileSync(path.join(runDir, 'life-int-browser-report.json'), JSON.stringify(report, null, 2));
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
})();
