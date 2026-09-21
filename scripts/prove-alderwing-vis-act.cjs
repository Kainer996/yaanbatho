'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public/burbz');
const outRoot = process.env.EVIDENCE_DIR || '/root/burbz-alderwing-cleanup-evidence/work-vis-act/native-probe';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outRoot, stamp);
fs.mkdirSync(runDir, { recursive: true });

const chromeCandidates = [
  process.env.CHROME_PATH,
  '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/usr/bin/chromium'
].filter(Boolean);
const chromePath = chromeCandidates.find(file => fs.existsSync(file));
if (!chromePath) throw Error('No Chromium executable found. Set CHROME_PATH.');

const core = require('../public/burbz/village_discovery_core.js');
const report = {
  startedAt: new Date().toISOString(),
  runDir,
  chromePath,
  checks: [],
  errors: [],
  limits: [
    'Uses the real BurbzVillageWalk and BurbzVillageDiscoveries browser surface with a synthetic flat walkable world.',
    'Uses a local transaction adapter mirroring the product rollback contract so Storage.setItem can be faulted deterministically.',
    'No paid/provider/backend requests are made; external network is blocked.'
  ]
};

function check(id, pass, observed) {
  report.checks.push({ id, pass, observed });
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
  return bits.length ? `Reward: ${bits.join(', ')}.` : '';
}

function pageHtml() {
  return `<!doctype html>
<meta charset="utf-8">
<title>Alderwing VIS/ACT probe</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0b1013;color:white;font-family:sans-serif}#host{position:fixed;inset:0}</style>
<link rel="stylesheet" href="/village_discoveries.css">
<div id="host"></div>
<script src="/lib/three.min.js"></script>
<script>
window.BurbzFlightCraft = {};
window.BurbzShoreWater = {};
window.BurbzOpenLandCore = {};
window.BurbzWildernessPlacesCore = {};
window.BurbzWildernessPlaces = {};
window.BurbzBuildingWorkCore = {};
window.BurbzVillageHarvestScene = { prepare(){} };
window.BurbzVillageHarvestCore = {};
window.BurbzInteriorLifeCore = {};
window.BurbzInteriorLife = {};
window.BurbzAcademyFlightCore = {};
window.BurbzAcademyFlight = { attach(){ return null; } };
window.BurbzBuildingRoomsCore = { plan(){ return {}; }, world(){ return window.__probeWorld; } };
window.BurbzBuildingRoomsScene = {};
window.BurbzFirstPersonMap = {};
window.BurbzWorldSky = {};
window.BurbzVillageWorldCore = {};
window.BurbzVillageWorld = { attach(){ return Promise.resolve(); } };
window.BurbzAlderwingIntro = { inputReset(){}, inputStart(){}, inputEnd(){}, inputMove(){}, inputLook(){} };
window.BurbzLookSettings = { closeFor(){}, isOpen(){ return false; }, vertical(v){ return v; } };
window.BurbzBuildingRooms = { attach(){ return { key(){ return false; }, leave(){ return false; }, diagnostics(){ return {}; }, update(){}, dispose(){}, closePanel(){ return false; } }; } };
window.BurbzBuildingWork = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, reset(){}, diagnostics(){ return {}; } }; } };
window.BurbzVillageHarvest = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, diagnostics(){ return {}; } }; } };
window.BurbzFirstPersonHud = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, closePanel(){ return false; }, diagnostics(){ return {}; } }; } };
window.BurbzVillageWalkScene = { create(){ return window.__probeWorld; }, batch(){ return function unbatch(){}; } };
window.BurbzVillageWalkCore = {
  EYE: 1.52,
  autoFlight(){ return { allow(){}, start(){}, drag(){}, release(){}, reset(){}, forward(){ return 0; }, state(){ return { enabled:false, armed:false, latched:false }; } }; },
  move(player, movement, dt, world){
    const speed = 2.4 * Math.min(dt || 0, 0.05);
    player.x += ((movement.side || 0) * Math.cos(player.yaw) - (movement.forward || 0) * Math.sin(player.yaw)) * speed;
    player.z += ((movement.side || 0) * Math.sin(player.yaw) + (movement.forward || 0) * Math.cos(player.yaw)) * speed;
    player.y = world.height(player.x, player.z);
  },
  look(player, dx, dy, scale){ player.yaw -= dx * scale; player.pitch = Math.max(-1.1, Math.min(1.1, player.pitch - dy * scale)); },
  outwardBoundary(){ return false; },
  quality(dpr, maxDpr, intervals, fastStreak){ return { dpr, fastStreak }; }
};
</script>
<script src="/village_discovery_content.js"></script>
<script src="/village_discovery_core.js"></script>
<script src="/village_discoveries.js"></script>
<script src="/village_walk.js"></script>`;
}

function createServer() {
  const moduleFiles = new Set(['village_walk.js', 'village_discovery_content.js', 'village_discovery_core.js', 'village_discoveries.js', 'village_discoveries.css', 'village_walk.css']);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = null;
    if (url.pathname === '/' || url.pathname === '/probe.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(pageHtml());
      return;
    }
    if (url.pathname === '/lib/three.min.js') file = path.join(publicRoot, 'lib/three.min.js');
    else if (url.pathname.startsWith('/assets/')) file = path.join(publicRoot, url.pathname.slice(1));
    else if (moduleFiles.has(url.pathname.slice(1))) file = path.join(publicRoot, url.pathname.slice(1));
    else if (url.pathname.endsWith('.css')) {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end('');
      return;
    } else if (url.pathname.endsWith('.js')) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end('/* empty probe dependency */');
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
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/probe.html` })));
}

function assertPredicate() {
  const catalogue = { materialById: id => id === 'oak_twig', gearById: id => id === 'thorn_talons' };
  const rows = [
    [{ coins: 1 }, true],
    [{ coins: 0, materials: { oak_twig: 0 } }, false],
    [{ coins: -1 }, false],
    [{ coins: Infinity }, false],
    [{ reputation: 4 }, false],
    [{ materials: { missing: 2 } }, false],
    [{ materials: { oak_twig: 2 } }, true],
    [{ gear: { thorn_talons: 1 } }, true]
  ].map(([reward, expected]) => ({ reward, expected, actual: core.rewardHasGrantableLoot(reward, catalogue) }));
  check('core_reward_glow_predicate_truth_table', rows.every(row => row.actual === row.expected), rows);
}

async function main() {
  assertPredicate();
  const { server, url } = await createServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox', '--use-angle=swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url().startsWith(new URL(url).origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('pageerror', error => report.errors.push(error.stack || error.message));
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push(msg.text()); });
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.THREE && window.BurbzVillageWalk && window.BurbzVillageDiscoveries && window.BurbzVillageDiscoveryCore);
    await installProbe(page);

    await visualChecks(page);
    await lootLoreChecks(page);
    await fieldworkChecks(page);
    await failedSaveChecks(page);

    await context.close();
  } finally {
    await browser?.close();
    server.close();
  }
}

async function installProbe(page) {
  await page.evaluate(serializedRewardText => {
    window.__probeRewardText = eval(serializedRewardText);
    window.__probeWorld = {
      radius: 18,
      segments: [],
      spawn(){ return { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.15, mode: 'walk' }; },
      height(){ return 0; },
      allowed(){ return true; },
      surface(){ return 'grass'; }
    };
    const core = window.BurbzVillageDiscoveryCore;
    const saveKey = 'alderwing_probe_state';
    const nativeSetItem = Storage.prototype.setItem;
    function clone(value){ return JSON.parse(JSON.stringify(value)); }
    function restore(target, source) {
      if (!target || !source || typeof target !== 'object' || typeof source !== 'object' || Array.isArray(target) !== Array.isArray(source)) return clone(source);
      if (Array.isArray(target)) {
        target.length = source.length;
        for (let i = 0; i < source.length; i++) target[i] = restore(target[i], source[i]);
        return target;
      }
      Object.keys(target).forEach(key => { if (!Object.hasOwn(source, key)) delete target[key]; });
      Object.keys(source).forEach(key => { target[key] = restore(target[key], source[key]); });
      return target;
    }
    function applyReward(state, reward = {}) {
      state.player.coins += Number(reward.coins || 0);
      state.player.branches += Number(reward.branches || 0);
      for (const [id, qty] of Object.entries(reward.materials || {})) state.inventory.items[id] = (state.inventory.items[id] || 0) + qty;
      for (const [id, qty] of Object.entries(reward.gear || {})) state.inventory.gear[id] = (state.inventory.gear[id] || 0) + qty;
    }
    function record(state){ return state.villageDiscoveries.villages['101']; }
    function configure(kind, fromStorage = false) {
      const state = fromStorage && localStorage.getItem(saveKey)
        ? JSON.parse(localStorage.getItem(saveKey))
        : { player: { coins: 100, branches: 30 }, inventory: { items: {}, gear: {} }, villageDiscoveries: { version: 1, seed: core.hash('vis-act-probe'), villages: {} } };
      if (!record(state)) core.village(state, 101, 'vis-act-probe');
      const rec = record(state);
      rec.questId = core.QUESTS[0].id;
      rec.accepted = false;
      rec.step = 0;
      rec.completed = false;
      rec.giver = '';
      rec.collected = rec.collected || [];
      rec.read = rec.read || [];
      rec.fieldwork = rec.fieldwork || {};
      if (!fromStorage) {
        if (kind === 'chest-fail') { rec.loot = [{ id: 'positive', label: 'Positive coins', reward: { coins: 5 } }]; rec.lore = []; rec.collected = []; rec.fieldwork = {}; }
        if (kind === 'lore-fail') { rec.loot = []; rec.lore = [core.LORE[0].id]; rec.read = []; rec.fieldwork = {}; }
        if (kind === 'activity-mid-fail') { rec.loot = []; rec.lore = []; rec.fieldwork = {}; }
        if (kind === 'activity-final-fail') { rec.loot = []; rec.lore = []; const story = core.activities(rec)[0].story; rec.fieldwork = { [story.id]: { step: 2 } }; }
      }
      return state;
    }
    window.__probe = {
      saveKey,
      state: null,
      source: null,
      failNextSave: false,
      async open(kind = 'default', opts = {}) {
        if (window.BurbzVillageWalk.isOpen()) {
          window.BurbzVillageWalk.close('exit');
          await window.BurbzVillageWalk.whenClosed();
        }
        this.state = configure(kind, !!opts.fromStorage);
        nativeSetItem.call(localStorage, saveKey, JSON.stringify(this.state));
        const scene = new window.THREE.Scene();
        scene.background = new window.THREE.Color(0x12181b);
        scene.add(new window.THREE.HemisphereLight(0xf5f8ff, 0x42525a, 1.7));
        const sun = new window.THREE.DirectionalLight(0xffffff, 2.2);
        sun.position.set(4, 8, 6);
        scene.add(sun);
        const camera = new window.THREE.PerspectiveCamera(58, 1280 / 800, 0.08, 120);
        const renderer = new window.THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
        renderer.setPixelRatio(1);
        renderer.setSize(1280, 800, false);
        const api = {
          prepare(){},
          record: () => record(window.__probe.state),
          rewardText: window.__probeRewardText,
          act(type, id, giver) {
            const before = clone(window.__probe.state);
            try {
              const result = core.act(record(window.__probe.state), type, id, giver);
              if (!result) return result;
              if (result.reward) applyReward(window.__probe.state, result.reward);
              localStorage.setItem(saveKey, JSON.stringify(window.__probe.state));
              return result;
            } catch (error) {
              restore(window.__probe.state, before);
              throw error;
            }
          }
        };
        this.api = api;
        this.source = { scene, renderer, camera, buildings: [], movers: [], world: window.__probeWorld, discovery: { api, world: window.__probeWorld } };
        const opened = await window.BurbzVillageWalk.open({ name: 'VIS/ACT probe', source: async () => this.source, discoveries: api });
        if (!opened) throw Error('BurbzVillageWalk.open returned false');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      },
      snapshot() {
        return {
          state: clone(this.state),
          persisted: localStorage.getItem(saveKey),
          diagnostics: window.BurbzVillageWalk.diagnostics().discoveries,
          wallet: clone(this.state.player)
        };
      },
      failOnce(){ this.failNextSave = true; },
      collectScene() {
        const diag = window.BurbzVillageWalk.diagnostics();
        const root = this.source.scene.children.find(child => child.type === 'Group' && child.children.length === diag.discoveries.objects.length);
        const worldVisible = node => { for (let cur = node; cur; cur = cur.parent) if (!cur.visible) return false; return true; };
        const markers = diag.discoveries.objects.map((obj, index) => {
          const group = root.children[index], nodes = [];
          group.traverse(node => {
            const material = Array.isArray(node.material) ? node.material[0] : node.material;
            nodes.push({ type: node.type, geometryType: node.geometry && node.geometry.type, visibleWorld: worldVisible(node), color: material?.color?.getHexString?.() });
          });
          return { ...obj, groupVisibleWorld: worldVisible(group), visibleSprites: nodes.filter(n => n.type === 'Sprite' && n.visibleWorld), visibleRings: nodes.filter(n => n.geometryType === 'RingGeometry' && n.visibleWorld), visibleMeshes: nodes.filter(n => n.type === 'Mesh' && n.visibleWorld), meshSignatures: nodes.filter(n => n.type === 'Mesh' && n.visibleWorld).map(n => `${n.geometryType}:${n.color || 'none'}`) };
        });
        return {
          objects: diag.discoveries.objects,
          visibleRootCount: markers.filter(m => m.groupVisibleWorld).length,
          visibleActivityRootCount: markers.filter(m => m.groupVisibleWorld && m.kind === 'activity').length,
          visibleItemSpriteCount: markers.filter(m => m.groupVisibleWorld && m.visibleSprites.length && ['loot', 'lore', 'board', 'step', 'activity'].includes(m.kind)).length,
          variants: [...new Set(markers.filter(m => m.kind === 'loot').map(m => m.variant))],
          lootGeometry: [...new Set(markers.filter(m => m.kind === 'loot').flatMap(m => m.meshSignatures))],
          glowRows: markers.filter(m => m.kind === 'loot').map(m => ({ id: m.id, visible: m.groupVisibleWorld, open: m.open, glows: m.visibleRings.length > 0, rewardGrantable: m.rewardGrantable }))
        };
      }
    };
    Storage.prototype.setItem = function(key, value) {
      if (key === saveKey && window.__probe?.failNextSave) {
        window.__probe.failNextSave = false;
        throw Error('probe storage fault');
      }
      return nativeSetItem.call(this, key, value);
    };
  }, rewardText.toString());
}

async function visualChecks(page) {
  await page.evaluate(() => window.__probe.open('default'));
  await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().discoveries?.artReady === true);
  await page.waitForTimeout(300);
  const scene = await page.evaluate(() => window.__probe.collectScene());
  await page.screenshot({ path: path.join(runDir, 'visual-default.png'), fullPage: true });
  check('browser_no_pickup_sprites', scene.visibleItemSpriteCount === 0, scene);
  check('browser_three_chest_variants', scene.variants.includes(0) && scene.variants.includes(1) && scene.variants.includes(2), scene.variants);
  const lootCount = scene.objects.filter(o => o.kind === 'loot').length;
  const loreCount = scene.objects.filter(o => o.kind === 'lore').length;
  const matchedBaselineRoots = 1 + lootCount + loreCount + 9;
  const requiredMax = Math.floor(matchedBaselineRoots * 0.65);
  check('browser_default_clutter_reduced', scene.visibleRootCount <= requiredMax && scene.visibleActivityRootCount === 3, { ...scene, matchedBaselineRoots, requiredMax });
}

async function approach(page, kind, id) {
  const ok = await page.evaluate(({ kind, id }) => {
    const d = window.__burbzVillageWalkDebug, state = d.state(), world = d.world();
    const obj = state.discoveries.objects.find(o => o.kind === kind && (id === undefined || String(o.id) === String(id)) && o.visible !== false);
    if (!obj) return false;
    for (const rad of [0, 0.55, 1.1]) for (let i = 0; i < 32; i++) {
      const x = obj.x + Math.cos(i / 32 * Math.PI * 2) * rad;
      const z = obj.z + Math.sin(i / 32 * Math.PI * 2) * rad;
      if (world.allowed(x, z) && d.place({ x, z, yaw: Math.atan2(x - obj.x, z - obj.z), pitch: -0.15 })) return true;
    }
    return false;
  }, { kind, id });
  assert.ok(ok, `approach ${kind}:${id}`);
  await page.waitForTimeout(180);
}

async function closePanel(page) {
  if (await page.locator('.vd-panel:not([hidden])').count()) await page.locator('.vd-close').click();
}

async function clickInteract(page) {
  await page.locator('.vd-interact:not([hidden])').click();
  await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
}

async function lootLoreChecks(page) {
  await page.evaluate(() => window.__probe.open('loot-lore'));
  const rec = await page.evaluate(() => JSON.parse(JSON.stringify(window.__probe.state.villageDiscoveries.villages['101'])));
  for (const loot of rec.loot) {
    await approach(page, 'loot', loot.id);
    await clickInteract(page);
    await closePanel(page);
  }
  for (const lore of rec.lore) {
    await approach(page, 'lore', lore);
    await clickInteract(page);
    await closePanel(page);
  }
  const after = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'loot-lore-complete.png'), fullPage: true });
  check('native_loot_and_lore_discoverable_once', rec.loot.every(l => after.state.villageDiscoveries.villages['101'].collected.includes(l.id)) && rec.lore.every(id => after.state.villageDiscoveries.villages['101'].read.includes(id)), after.state.villageDiscoveries.villages['101']);
}

async function fieldworkChecks(page) {
  await page.evaluate(() => window.__probe.open('fieldwork'));
  const assignments = await page.evaluate(() => window.BurbzVillageDiscoveryCore.activities(window.__probe.api.record()).map(a => JSON.parse(JSON.stringify(a.story))));
  let wrongChoiceChecked = false;
  const startCoins = await page.evaluate(() => window.__probe.state.player.coins);
  for (const story of assignments) {
    for (let step = 0; step < story.steps.length; step++) {
      const node = story.steps[step];
      await approach(page, 'activity', `${story.id}:${step}`);
      await clickInteract(page);
      if (node.choices) {
        if (!wrongChoiceChecked) {
          const wrong = node.choices.find(choice => choice[0] !== node.answer);
          await page.getByRole('button', { name: wrong[1], exact: true }).click();
          const unchanged = await page.evaluate(id => window.__probe.api.record().fieldwork?.[id]?.step || 0, story.id);
          check('native_fieldwork_wrong_choice_nonmutating', unchanged === step, { story: story.id, step, unchanged });
          await page.getByRole('button', { name: 'Look at the clues again', exact: true }).click();
          wrongChoiceChecked = true;
        }
        const right = node.choices.find(choice => choice[0] === node.answer);
        await page.getByRole('button', { name: right[1], exact: true }).click();
      } else {
        await page.getByRole('button', { name: node.label, exact: true }).click();
      }
      await closePanel(page);
      const progressed = await page.evaluate(id => window.__probe.api.record().fieldwork?.[id]?.step || 0, story.id);
      check(`native_fieldwork_progress_${story.id}_${step}`, progressed === step + 1, { story: story.id, step, progressed });
    }
  }
  const afterCoins = await page.evaluate(() => window.__probe.state.player.coins);
  await page.screenshot({ path: path.join(runDir, 'fieldwork-complete.png'), fullPage: true });
  const repeat = await page.evaluate(stories => {
    const before = JSON.stringify(window.__probe.state);
    for (const story of stories) window.__probe.api.act('activity', `${story.id}:2`, story.steps[2].answer);
    return { before, after: JSON.stringify(window.__probe.state) };
  }, assignments);
  check('native_fieldwork_all_three_complete_once', afterCoins > startCoins && repeat.before === repeat.after, { startCoins, afterCoins, activities: await page.evaluate(() => window.BurbzVillageDiscoveryCore.activities(window.__probe.api.record())) });
}

async function failedSaveChecks(page) {
  await failedChest(page);
  await failedLore(page);
  await failedActivityMid(page);
  await failedActivityFinal(page);
}

async function failedChest(page) {
  await page.evaluate(() => window.__probe.open('chest-fail'));
  const before = await page.evaluate(() => window.__probe.snapshot());
  await approach(page, 'loot', 'positive');
  await page.evaluate(() => window.__probe.failOnce());
  await clickInteract(page);
  const failed = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'failed-chest.png'), fullPage: true });
  check('failed_chest_save_rollback', JSON.stringify(failed.state) === JSON.stringify(before.state) && failed.persisted === before.persisted && failed.diagnostics.objects.find(o => o.kind === 'loot').glows, failed);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await closePanel(page);
  const retry = await page.evaluate(() => window.__probe.snapshot());
  await page.evaluate(() => window.__probe.open('chest-fail', { fromStorage: true }));
  const reload = await page.evaluate(() => window.__probe.snapshot());
  check('failed_chest_retry_open_no_glow_no_duplicate', retry.state.player.coins === before.state.player.coins + 5 && reload.diagnostics.objects.find(o => o.kind === 'loot').open && !reload.diagnostics.objects.find(o => o.kind === 'loot').glows, { retry, reload });
}

async function failedLore(page) {
  await page.evaluate(() => window.__probe.open('lore-fail'));
  const loreId = await page.evaluate(() => window.__probe.api.record().lore[0]);
  const before = await page.evaluate(() => window.__probe.snapshot());
  await approach(page, 'lore', loreId);
  await page.evaluate(() => window.__probe.failOnce());
  await clickInteract(page);
  const failed = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'failed-lore.png'), fullPage: true });
  check('failed_lore_save_rollback', JSON.stringify(failed.state) === JSON.stringify(before.state) && failed.persisted === before.persisted, failed);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await closePanel(page);
  const retry = await page.evaluate(() => window.__probe.snapshot());
  await page.evaluate(() => window.__probe.open('lore-fail', { fromStorage: true }));
  const reload = await page.evaluate(() => window.__probe.snapshot());
  check('failed_lore_retry_reload_once', retry.state.villageDiscoveries.villages['101'].read.includes(loreId) && !reload.diagnostics.objects.find(o => o.kind === 'lore').visible, { retry, reload });
}

async function failedActivityMid(page) {
  await page.evaluate(() => window.__probe.open('activity-mid-fail'));
  const story = await page.evaluate(() => JSON.parse(JSON.stringify(window.BurbzVillageDiscoveryCore.activities(window.__probe.api.record())[0].story)));
  const before = await page.evaluate(() => window.__probe.snapshot());
  await approach(page, 'activity', `${story.id}:0`);
  await page.evaluate(() => window.__probe.failOnce());
  await clickInteract(page);
  await page.getByRole('button', { name: story.steps[0].label, exact: true }).click();
  const failed = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'failed-fieldwork-mid.png'), fullPage: true });
  check('failed_fieldwork_mid_save_rollback', JSON.stringify(failed.state) === JSON.stringify(before.state) && failed.persisted === before.persisted, failed);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await closePanel(page);
  const retry = await page.evaluate(() => window.__probe.snapshot());
  check('failed_fieldwork_mid_retry', retry.state.villageDiscoveries.villages['101'].fieldwork[story.id].step === 1, retry);
}

async function failedActivityFinal(page) {
  await page.evaluate(() => window.__probe.open('activity-final-fail'));
  const story = await page.evaluate(() => JSON.parse(JSON.stringify(window.BurbzVillageDiscoveryCore.activities(window.__probe.api.record())[0].story)));
  const node = story.steps[2], right = node.choices.find(choice => choice[0] === node.answer);
  const before = await page.evaluate(() => window.__probe.snapshot());
  await approach(page, 'activity', `${story.id}:2`);
  await page.evaluate(() => window.__probe.failOnce());
  await clickInteract(page);
  await page.getByRole('button', { name: right[1], exact: true }).click();
  const failed = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'failed-fieldwork-final.png'), fullPage: true });
  check('failed_fieldwork_final_save_rollback', JSON.stringify(failed.state) === JSON.stringify(before.state) && failed.persisted === before.persisted, failed);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  await closePanel(page);
  const retry = await page.evaluate(() => window.__probe.snapshot());
  await page.evaluate(() => window.__probe.open('activity-final-fail', { fromStorage: true }));
  const reload = await page.evaluate(() => window.__probe.snapshot());
  const repeat = await page.evaluate(({ id, answer }) => {
    const before = JSON.stringify(window.__probe.state);
    window.__probe.api.act('activity', `${id}:2`, answer);
    return before === JSON.stringify(window.__probe.state);
  }, { id: story.id, answer: node.answer });
  check('failed_fieldwork_final_retry_reload_no_duplicate', retry.state.player.coins === before.state.player.coins + story.reward.coins && reload.state.villageDiscoveries.villages['101'].fieldwork[story.id].step === 3 && repeat, { retry, reload, repeat });
}

main().then(() => {
  report.finishedAt = new Date().toISOString();
  report.exitCode = 0;
  fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ runDir, checks: report.checks.length, exitCode: 0 }, null, 2));
}).catch(error => {
  report.finishedAt = new Date().toISOString();
  report.exitCode = 1;
  report.failure = error.stack || error.message;
  try { fs.writeFileSync(path.join(runDir, 'results.json'), JSON.stringify(report, null, 2)); } catch (_) {}
  console.error(error);
  process.exitCode = 1;
});
