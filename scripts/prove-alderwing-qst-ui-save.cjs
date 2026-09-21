'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public/burbz');
const outRoot = process.env.EVIDENCE_DIR || '/root/burbz-alderwing-cleanup-evidence/work-qst-ui-save/browser-probe';
const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(outRoot, stamp);
fs.mkdirSync(runDir, { recursive: true });

const chromePath = [
  process.env.CHROME_PATH,
  '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/usr/bin/chromium'
].filter(Boolean).find(file => fs.existsSync(file));
if (!chromePath) throw Error('No Chromium executable found. Set CHROME_PATH.');

const core = require('../public/burbz/village_discovery_core.js');
const report = {
  startedAt: new Date().toISOString(),
  runDir,
  chromePath,
  checks: [],
  errors: [],
  paths: {},
  limits: [
    'Uses the real BurbzVillageWalk and BurbzVillageDiscoveries browser surface with a synthetic flat walkable world.',
    'Normal quest completion walks with keyboard movement; deterministic setup/failed-save scenarios use debug placement only to stand near the real source before native clicks.',
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
  if (Number(reward.coins) > 0) bits.push(`+${reward.coins} coins`);
  if (Number(reward.branches) > 0) bits.push(`+${reward.branches} branches`);
  for (const [id, count] of Object.entries(reward.materials || {})) if (Number(count) > 0) bits.push(`+${count} ${id === 'oak_twig' ? 'Oak Twigs' : id}`);
  for (const [id, count] of Object.entries(reward.gear || {})) if (Number(count) > 0) bits.push(`+${count} ${id}`);
  return bits.join(' · ');
}

function pageHtml() {
  return `<!doctype html>
<meta charset="utf-8">
<title>Alderwing QST/UI/SAVE probe</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0b1013;color:white;font-family:sans-serif}#host{position:fixed;inset:0}</style>
<link rel="stylesheet" href="/village_walk.css">
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
    const speed = 5.5 * Math.min(dt || 0, 0.05);
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

function selfChecks() {
  const inventory = core.editorialInventory();
  const editorialPath = path.join(runDir, 'editorial-inventory.json');
  fs.writeFileSync(editorialPath, JSON.stringify(inventory, null, 2));
  report.paths.editorialInventory = editorialPath;
  check('editorial_inventory_all_requests_fieldwork_lore', inventory.requests.length === 50 && inventory.fieldwork.length === 12 && inventory.loreIds.length === 30, {
    requests: inventory.requests.length,
    fieldwork: inventory.fieldwork.length,
    lore: inventory.loreIds.length
  });
  check('editorial_inventory_offer_objective_return_clarity', inventory.requests.every(row =>
    /Need:/.test(row.offer) && /Work:/.test(row.offer) && /Reward: 30 coins and 2 Oak Twigs/i.test(row.offer) &&
    row.objectives.every(step => /Current task:/.test(step.guidance) && /blue marker/.test(step.guidance)) &&
    /Return to a villager or request post/i.test(row.completion)
  ), inventory.requests.map(row => ({ id: row.id, offer: row.offer.slice(0, 90) })));

  const old = { villageDiscoveries: { version: 1, seed: core.hash('legacy'), villages: {} } };
  for (let seed = 1; seed <= 50; seed++) core.village(old, seed, 'legacy');
  check('legacy_deck_first_50_unique', new Set(Object.values(old.villageDiscoveries.villages).map(v => v.questId)).size === 50, Object.values(old.villageDiscoveries.villages).map(v => v.questId));
  const partial = {
    villageDiscoveries: {
      version: 1,
      seed: 7,
      villages: {
        '101': {
          ordinal: 0,
          questId: 'vq08',
          accepted: true,
          step: 1,
          completed: false,
          giver: 'Ada',
          loot: [{ id: 'loot0', label: 'Coin pouch', reward: { coins: 12 } }],
          lore: ['vl01'],
          collected: ['loot0'],
          read: ['vl01'],
          fieldwork: { vf01: { step: 2 } },
          placementSeed: 123
        }
      }
    }
  };
  const before = JSON.stringify(partial);
  core.village(partial, 101, 'legacy');
  check('legacy_v1_existing_record_nonmutating', JSON.stringify(partial) === before, partial.villageDiscoveries.villages['101']);
}

async function installProbe(page) {
  await page.evaluate(serializedRewardText => {
    window.__probeRewardText = eval(serializedRewardText);
    window.__probeWorld = {
      radius: 24,
      segments: [],
      spawn(){ return { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.15, mode: 'walk' }; },
      height(){ return 0; },
      allowed(){ return true; },
      surface(){ return 'grass'; }
    };
    const core = window.BurbzVillageDiscoveryCore;
    const saveKey = 'alderwing_qst_ui_save_probe_state';
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
        : { player: { coins: 100, branches: 30 }, inventory: { items: {}, gear: {} }, villageDiscoveries: { version: 1, seed: core.hash('qst-ui-save-probe'), villages: {} } };
      if (!record(state)) core.village(state, 101, 'qst-ui-save-probe');
      const rec = record(state);
      if (!fromStorage) {
        rec.questId = core.QUESTS[0].id;
        rec.accepted = false;
        rec.step = 0;
        rec.completed = false;
        rec.giver = '';
        rec.loot = [{ id: 'loot0', label: 'Coin pouch', reward: { coins: 5 } }];
        rec.lore = [core.LORE[0].id, core.LORE[1].id];
        rec.collected = [];
        rec.read = [];
        rec.fieldwork = {};
        if (kind === 'long-ui') rec.read = core.LORE.map(l => l.id);
        if (kind === 'step-fail') { rec.accepted = true; rec.giver = 'Pip Reedhand'; rec.step = 0; }
        if (kind === 'finish-fail') { rec.accepted = true; rec.giver = 'Pip Reedhand'; rec.step = core.quest(rec).steps.length; }
      }
      return state;
    }
    window.__probe = {
      saveKey,
      state: null,
      source: null,
      api: null,
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
        const movers = [];
        if (kind !== 'empty') {
          const resident = new window.THREE.Object3D();
          resident.position.set(1.8, 0, 0.2);
          resident.userData.resident = true;
          resident.userData.npc = { name: 'Pip Reedhand' };
          scene.add(resident);
          movers.push(resident);
        }
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
        this.source = { scene, renderer, camera, buildings: [], movers, world: window.__probeWorld, discovery: { api, world: window.__probeWorld, movers } };
        const opened = await window.BurbzVillageWalk.open({ name: 'QST/UI/SAVE probe', source: async () => this.source, discoveries: api });
        if (!opened) throw Error('BurbzVillageWalk.open returned false');
        await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      },
      snapshot() {
        return {
          state: clone(this.state),
          persisted: localStorage.getItem(saveKey),
          diagnostics: window.BurbzVillageWalk.diagnostics().discoveries,
          player: clone(window.BurbzVillageWalk.diagnostics().player)
        };
      },
      failOnce(){ this.failNextSave = true; }
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

async function approach(page, kind, id) {
  const ok = await page.evaluate(({ kind, id }) => {
    const d = window.__burbzVillageWalkDebug, state = d.state(), world = d.world();
    const obj = kind === 'resident'
      ? state.discoveries.residents[0]
      : state.discoveries.objects.find(o => o.kind === kind && (id === undefined || String(o.id) === String(id)) && o.visible !== false);
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

async function target(page, kind, id) {
  return page.evaluate(({ kind, id }) => {
    const state = window.__burbzVillageWalkDebug.state();
    const obj = kind === 'resident'
      ? state.discoveries.residents[0]
      : state.discoveries.objects.find(o => o.kind === kind && (id === undefined || String(o.id) === String(id)) && o.visible !== false);
    if (!obj) throw Error('target missing ' + kind + ':' + id);
    return { x: obj.x, z: obj.z, kind: obj.kind, id: obj.id };
  }, { kind, id });
}

async function walkTo(page, point, label) {
  await page.locator('.vw-look').focus();
  const poses = [];
  for (let i = 0; i < 190; i++) {
    const p = await page.evaluate(() => window.__burbzVillageWalkDebug.state().player);
    const dx = point.x - p.x, dz = point.z - p.z, d = Math.hypot(dx, dz);
    poses.push({ i, x: +p.x.toFixed(3), z: +p.z.toFixed(3), yaw: +p.yaw.toFixed(3), d: +d.toFixed(3) });
    if (d < 0.55) {
      report.paths[label] = poses;
      return;
    }
    const want = Math.atan2(-dx, dz);
    const turn = Math.atan2(Math.sin(want - p.yaw), Math.cos(want - p.yaw));
    if (Math.abs(turn) > 0.08) {
      const key = turn > 0 ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.max(24, Math.min(170, Math.abs(turn) / 1.5 * 1000)));
      await page.keyboard.up(key);
    } else {
      await page.keyboard.down('KeyW');
      await page.waitForTimeout(Math.max(35, Math.min(230, (d - 0.35) / 4.8 * 1000)));
      await page.keyboard.up('KeyW');
    }
    await page.waitForTimeout(30);
  }
  report.paths[label] = poses;
  throw Error('Native keyboard walk did not reach ' + label);
}

async function closePanel(page) {
  if (await page.locator('.vd-panel:not([hidden])').count()) await page.locator('.vd-close').click();
}

async function clickInteract(page) {
  await page.locator('.vd-interact:not([hidden])').click();
  await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
}

async function residentDeferAcceptRemote(page) {
  await page.evaluate(() => window.__probe.open('default'));
  await approach(page, 'resident');
  const before = await page.evaluate(() => window.__probe.snapshot());
  await clickInteract(page);
  const offer = await page.locator('.vd-panel').innerText();
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  const deferred = await page.evaluate(() => window.__probe.snapshot());
  await page.evaluate(() => window.__probe.open('default', { fromStorage: true }));
  const reloaded = await page.evaluate(() => window.__probe.snapshot());
  check('resident_not_now_nonmutating_reload_available', JSON.stringify(before.state) === JSON.stringify(deferred.state) && !reloaded.state.villageDiscoveries.villages['101'].accepted && /Reward: 30 coins and 2 Oak Twigs/i.test(offer), { offer, before, deferred, reloaded });

  await approach(page, 'resident');
  await clickInteract(page);
  await page.getByRole('button', { name: "I’ll help", exact: true }).click();
  const accepted = await page.evaluate(() => window.__probe.snapshot());
  check('resident_accept_commits_at_source', accepted.state.villageDiscoveries.villages['101'].accepted && accepted.state.villageDiscoveries.villages['101'].giver === 'Pip Reedhand', accepted.state.villageDiscoveries.villages['101']);
  await closePanel(page);
  await page.locator('.vd-journal').click();
  await page.getByRole('button', { name: /Track the villagers/ }).click();
  const remoteButtons = await page.locator('.vd-body button').evaluateAll(buttons => buttons.map(button => button.textContent.trim()));
  check('remote_journal_cannot_accept', !remoteButtons.some(label => /I.ll help/i.test(label)), remoteButtons);
}

async function emptyPostDeferAccept(page) {
  await page.evaluate(() => window.__probe.open('empty'));
  await approach(page, 'board');
  const before = await page.evaluate(() => window.__probe.snapshot());
  await clickInteract(page);
  await page.getByRole('button', { name: 'Not now', exact: true }).click();
  const deferred = await page.evaluate(() => window.__probe.snapshot());
  await page.evaluate(() => window.__probe.open('empty', { fromStorage: true }));
  const reloaded = await page.evaluate(() => window.__probe.snapshot());
  check('empty_post_not_now_reload_available', JSON.stringify(before.state) === JSON.stringify(deferred.state) && !reloaded.state.villageDiscoveries.villages['101'].accepted && !reloaded.diagnostics.residents.length, { before, deferred, reloaded });
  await approach(page, 'board');
  await clickInteract(page);
  await page.getByRole('button', { name: "I’ll help", exact: true }).click();
  const accepted = await page.evaluate(() => window.__probe.snapshot());
  check('empty_post_accept_uses_canonical_request', accepted.state.villageDiscoveries.villages['101'].accepted && accepted.state.villageDiscoveries.villages['101'].giver === 'The village folk', accepted.state.villageDiscoveries.villages['101']);
}

async function physicalQuest(page) {
  await page.evaluate(() => window.__probe.open('default'));
  await page.screenshot({ path: path.join(runDir, 'physical-start.png'), fullPage: true });
  await walkTo(page, await target(page, 'resident'), 'walk-resident-accept');
  await clickInteract(page);
  await page.getByRole('button', { name: "I’ll help", exact: true }).click();
  await page.getByRole('button', { name: /Follow the first marker/ }).click();
  const steps = await page.evaluate(() => window.BurbzVillageDiscoveryCore.quest(window.__probe.api.record()).steps.length);
  for (let i = 0; i < steps; i++) {
    await walkTo(page, await target(page, 'step', i), `walk-step-${i}`);
    await clickInteract(page);
    const rec = await page.evaluate(() => window.__probe.api.record());
    check(`physical_ordered_step_${i}`, rec.step === i + 1, rec);
    await page.screenshot({ path: path.join(runDir, `physical-step-${i}.png`), fullPage: true });
    await page.getByRole('button', { name: i + 1 < steps ? /Follow the next marker/ : /Return for thanks/ }).click();
  }
  const beforeFinish = await page.evaluate(() => window.__probe.snapshot());
  await walkTo(page, await target(page, 'board'), 'walk-return-board');
  await clickInteract(page);
  await page.getByRole('button', { name: 'Finish quest', exact: true }).click();
  const finished = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'physical-finished.png'), fullPage: true });
  const beforeRec = beforeFinish.state.villageDiscoveries.villages['101'];
  const doneRec = finished.state.villageDiscoveries.villages['101'];
  check('physical_finish_exact_reward_once', doneRec.completed && finished.state.player.coins === beforeFinish.state.player.coins + 30 && (finished.state.inventory.items.oak_twig || 0) === (beforeFinish.state.inventory.items.oak_twig || 0) + 2, { beforeFinish, finished });
  await closePanel(page);
  await walkTo(page, await target(page, 'board'), 'walk-duplicate-board');
  await clickInteract(page);
  const duplicateButtons = await page.locator('.vd-body button').evaluateAll(buttons => buttons.map(button => button.textContent.trim()));
  await closePanel(page);
  await page.evaluate(() => window.__probe.open('default', { fromStorage: true }));
  const reload = await page.evaluate(() => window.__probe.snapshot());
  check('physical_duplicate_reentry_reload_no_second_reward', !duplicateButtons.includes('Finish quest') && reload.state.player.coins === finished.state.player.coins && (reload.state.inventory.items.oak_twig || 0) === (finished.state.inventory.items.oak_twig || 0), { duplicateButtons, beforeRec, doneRec, reload });
  await page.locator('.vd-journal').click();
  await page.getByRole('button', { name: /Track the request post/ }).click();
  const remoteButtons = await page.locator('.vd-body button').evaluateAll(buttons => buttons.map(button => button.textContent.trim()));
  check('remote_journal_cannot_finish', !remoteButtons.includes('Finish quest'), remoteButtons);
  await closePanel(page);
}

async function failedSaveChecks(page) {
  await failedAccept(page);
  await failedStep(page);
  await failedFinish(page);
}

async function failedAccept(page) {
  await page.evaluate(() => window.__probe.open('default'));
  await approach(page, 'resident');
  const before = await page.evaluate(() => window.__probe.snapshot());
  await clickInteract(page);
  await page.evaluate(() => window.__probe.failOnce());
  await page.getByRole('button', { name: "I’ll help", exact: true }).click();
  const failed = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'failed-accept.png'), fullPage: true });
  check('failed_accept_rolls_back', JSON.stringify(failed.state) === JSON.stringify(before.state) && failed.persisted === before.persisted, failed);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const retry = await page.evaluate(() => window.__probe.snapshot());
  check('failed_accept_retry_once_success', retry.state.villageDiscoveries.villages['101'].accepted && retry.state.villageDiscoveries.villages['101'].step === 0, retry.state.villageDiscoveries.villages['101']);
  await closePanel(page);
}

async function failedStep(page) {
  await page.evaluate(() => window.__probe.open('step-fail'));
  await approach(page, 'step', 0);
  const before = await page.evaluate(() => window.__probe.snapshot());
  await page.evaluate(() => window.__probe.failOnce());
  await clickInteract(page);
  const failed = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'failed-step.png'), fullPage: true });
  check('failed_step_rolls_back', JSON.stringify(failed.state) === JSON.stringify(before.state) && failed.persisted === before.persisted, failed);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const retry = await page.evaluate(() => window.__probe.snapshot());
  check('failed_step_retry_once_success', retry.state.villageDiscoveries.villages['101'].step === 1, retry.state.villageDiscoveries.villages['101']);
  await closePanel(page);
}

async function failedFinish(page) {
  await page.evaluate(() => window.__probe.open('finish-fail'));
  await approach(page, 'board');
  const before = await page.evaluate(() => window.__probe.snapshot());
  await clickInteract(page);
  await page.evaluate(() => window.__probe.failOnce());
  await page.getByRole('button', { name: 'Finish quest', exact: true }).click();
  const failed = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'failed-finish.png'), fullPage: true });
  check('failed_finish_rolls_back_rewards', JSON.stringify(failed.state) === JSON.stringify(before.state) && failed.persisted === before.persisted && failed.state.player.coins === before.state.player.coins, failed);
  await page.getByRole('button', { name: 'Try again', exact: true }).click();
  const retry = await page.evaluate(() => window.__probe.snapshot());
  await page.evaluate(() => window.__probe.open('finish-fail', { fromStorage: true }));
  const reload = await page.evaluate(() => window.__probe.snapshot());
  check('failed_finish_retry_once_reload_no_duplicate', retry.state.player.coins === before.state.player.coins + 30 && (retry.state.inventory.items.oak_twig || 0) === (before.state.inventory.items.oak_twig || 0) + 2 && reload.state.player.coins === retry.state.player.coins, { retry, reload });
  await closePanel(page);
}

async function uiChecks(page, context) {
  await page.evaluate(() => window.__probe.open('long-ui'));
  await page.locator('.vd-journal').click();
  await page.locator('.vd-panel:not([hidden])').waitFor();
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  const viewports = [{ width: 320, height: 568 }, { width: 390, height: 844 }, { width: 667, height: 375 }];
  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.waitForTimeout(250);
    if (!(await page.locator('.vd-panel:not([hidden])').count())) await page.locator('.vd-journal').click();
    const metrics = await page.evaluate(() => {
      const panel = document.querySelector('.vd-panel:not([hidden])');
      const rect = el => { const b = el.getBoundingClientRect(); return { x: b.x, y: b.y, width: b.width, height: b.height, right: b.right, bottom: b.bottom }; };
      const controls = [...panel.querySelectorAll('button')].map(el => {
        const b = rect(el), hit = document.elementFromPoint(b.x + b.width / 2, b.y + Math.min(b.height / 2, 22));
        return { text: el.textContent.trim(), box: b, hit: el.contains(hit) };
      });
      const styles = ['.vd-panel', '.vd-close', '.vd-journal', '.vd-guide', '.vd-interact'].map(selector => {
        const el = document.querySelector(selector);
        if (!el) return null;
        const s = getComputedStyle(el);
        return { selector, color: s.color, backgroundColor: s.backgroundColor, backgroundImage: s.backgroundImage, borderColor: s.borderColor, minHeight: s.minHeight };
      }).filter(Boolean);
      return { panel: rect(panel), controls, styles, scrollTop: panel.scrollTop, scrollHeight: panel.scrollHeight, clientHeight: panel.clientHeight };
    });
    const box = metrics.panel;
    const controlsSized = metrics.controls.every(row => row.box.width >= 44 && row.box.height >= 44);
    const visibleControlsHit = metrics.controls.filter(row => row.box.y >= box.y && row.box.bottom <= box.bottom).every(row => row.hit);
    const controlsOk = controlsSized && visibleControlsHit;
    check(`ui_viewport_panel_controls_${viewport.width}x${viewport.height}`, box.x >= -0.5 && box.y >= -0.5 && box.right <= viewport.width + 0.5 && box.bottom <= viewport.height + 0.5 && controlsOk, metrics);
    if (metrics.scrollHeight > metrics.clientHeight + 20) {
      const x = box.x + box.width / 2, y = box.y + box.height - 55;
      const before = await page.locator('.vd-panel').evaluate(el => el.scrollTop);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
      for (let i = 1; i <= 7; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: y - i * 24, id: 1 }] });
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
      await page.waitForTimeout(180);
      const after = await page.locator('.vd-panel').evaluate(el => el.scrollTop);
      check(`ui_touch_scroll_${viewport.width}x${viewport.height}`, after > before, { before, after, viewport });
    }
    await page.screenshot({ path: path.join(runDir, `ui-journal-${viewport.width}x${viewport.height}.png`), fullPage: true });
  }

  await page.keyboard.press('Tab');
  const focusInside = await page.evaluate(() => document.querySelector('.vd-panel').contains(document.activeElement));
  await page.keyboard.down('KeyW');
  const poseBefore = await page.evaluate(() => window.__burbzVillageWalkDebug.state().player);
  await page.waitForTimeout(350);
  const poseDuring = await page.evaluate(() => window.__burbzVillageWalkDebug.state().player);
  await page.keyboard.press('Escape');
  await page.locator('.vd-panel').waitFor({ state: 'hidden' });
  await page.keyboard.up('KeyW');
  const focusRestored = await page.evaluate(() => document.activeElement.className);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(350);
  await page.keyboard.up('KeyW');
  const poseAfter = await page.evaluate(() => window.__burbzVillageWalkDebug.state().player);
  check('ui_focus_escape_movement_isolation', focusInside && Math.hypot(poseDuring.x - poseBefore.x, poseDuring.z - poseBefore.z) < 0.02 && /vd-journal|vd-interact/.test(String(focusRestored)) && Math.hypot(poseAfter.x - poseDuring.x, poseAfter.z - poseDuring.z) > 0.05, { focusInside, focusRestored, poseBefore, poseDuring, poseAfter });

  const styleHit = await page.evaluate(() => {
    const values = [...document.querySelectorAll('.vd-panel,.vd-close,.vd-journal,.vd-guide,.vd-interact,.vd-body button')].map(el => {
      const s = getComputedStyle(el);
      return [s.color, s.backgroundColor, s.backgroundImage, s.borderColor].join(' ');
    }).join(' ');
    return /255,\s*229,\s*164|248,\s*199,\s*90|199,\s*165,\s*96|166,\s*144,\s*96|32,\s*61,\s*52|41,\s*72,\s*57/i.test(values);
  });
  check('ui_charcoal_cool_no_green_gold_styles', !styleHit, { styleHit });
}

async function reducedMotionChecks(page) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.__probe.open('default'));
  await approach(page, 'board');
  await clickInteract(page);
  const before = await page.evaluate(() => {
    const panel = document.querySelector('.vd-panel');
    const action = document.querySelector('.vd-body button');
    return { panelAnimation: getComputedStyle(panel).animationName, panelTransition: getComputedStyle(panel).transitionDuration, actionAnimation: getComputedStyle(action).animationName };
  });
  await page.getByRole('button', { name: "I’ll help", exact: true }).click();
  const after = await page.evaluate(() => window.__probe.snapshot());
  await page.screenshot({ path: path.join(runDir, 'reduced-motion-request.png'), fullPage: true });
  check('reduced_motion_no_new_ui_motion_actions_work', before.panelAnimation === 'none' && before.actionAnimation === 'none' && /^0s(, 0s)*$/.test(before.panelTransition) && after.state.villageDiscoveries.villages['101'].accepted, { before, accepted: after.state.villageDiscoveries.villages['101'].accepted });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function main() {
  selfChecks();
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
    await residentDeferAcceptRemote(page);
    await emptyPostDeferAccept(page);
    await physicalQuest(page);
    await failedSaveChecks(page);
    await uiChecks(page, context);
    await reducedMotionChecks(page);
    await context.close();
  } finally {
    await browser?.close();
    server.close();
  }
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
