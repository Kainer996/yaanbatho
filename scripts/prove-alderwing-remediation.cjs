'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright');

const repoRoot = path.resolve(__dirname, '..');
const publicRoot = path.join(repoRoot, 'public/burbz');
const baselineDir = process.env.BASELINE_DIR || '/root/burbz-alderwing-cleanup-evidence/baseline';
const evidenceRoot = process.env.EVIDENCE_DIR || '/root/burbz-alderwing-cleanup-evidence/remediation';
const runDir = path.join(evidenceRoot, new Date().toISOString().replace(/[:.]/g, '-'));
fs.mkdirSync(runDir, { recursive: true });

const chromePath = [
  process.env.CHROME_PATH,
  '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/usr/bin/chromium'
].filter(Boolean).find(file => fs.existsSync(file));
if (!chromePath) throw Error('No Chromium executable found. Set CHROME_PATH.');

const moduleFiles = [
  'lib/three.min.js',
  'settlement_models.js',
  'village_walk_core.js',
  'village_walk_scene.js',
  'village_discovery_content.js',
  'village_discovery_core.js',
  'village_discoveries.js',
  'village_discoveries.css',
  'village_walk.css',
  'wilderness_places_core.js',
  'wilderness_places.js',
  'wilderness_places.css',
  'interior_life_core.js',
  'interior_life.js',
  'building_rooms_core.js',
  'building_rooms_scene.js',
  'player_home_core.js',
  'player_home_scene.js',
  'village_walk.js'
];

const report = {
  startedAt: new Date().toISOString(),
  runDir,
  chromePath,
  command: { argv: process.argv, cwd: process.cwd(), node: process.version },
  checks: [],
  errors: [],
  screenshots: [],
  files: Object.fromEntries(moduleFiles.filter(file => fs.existsSync(path.join(publicRoot, file))).map(file => [file, sha(path.join(publicRoot, file))])),
  limits: [
    'Local Chromium over a no-store localhost server; external requests are aborted.',
    'Disposable localStorage keys only; no production save, recognition, backend, provider, or billing calls.',
    'Wilderness, home, and interior pickup checks instantiate their real browser modules and actual Three.js geometry; village reduced-motion/control checks use BurbzVillageWalk with current modules.'
  ]
};

function sha(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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
function round(value) { return Number.isFinite(value) ? Math.round(value * 1000) / 1000 : value; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }

function loadCore(file) {
  const context = { console, globalThis: null };
  context.globalThis = context;
  vm.createContext(context);
  const contentFile = path.join(path.dirname(file), 'village_discovery_content.js');
  vm.runInContext(fs.readFileSync(contentFile, 'utf8'), context, { filename: contentFile });
  vm.runInContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return context.BurbzVillageDiscoveryCore;
}
function markerMatrix(core, state, seed, entropy) {
  const rec = core.village(state, seed, entropy);
  const story = core.quest(rec);
  const activities = core.activities(rec);
  const count = 1 + rec.loot.length + rec.lore.length + story.steps.length + activities.reduce((sum, row) => sum + row.story.steps.length, 0);
  const points = core.positions({ radius: 28, allowed: () => true, height: () => 0 }, { x: 0, y: 0, z: 0 }, rec.placementSeed, count);
  const ids = [
    ['board', 'board'],
    ...rec.loot.map(row => ['loot', row.id]),
    ...rec.lore.map(id => ['lore', id]),
    ...story.steps.map((_, index) => ['step', index]),
    ...activities.flatMap(row => row.story.steps.map((_, index) => ['activity', `${row.story.id}:${index}`]))
  ];
  return ids.map(([kind, id], index) => ({ kind, id: String(id), x: round(points[index].x), y: round(points[index].y), z: round(points[index].z) }));
}
function legacySaveMatrix() {
  const baselineCore = loadCore(path.join(baselineDir, 'village_discovery_core.js'));
  const candidateCore = loadCore(path.join(publicRoot, 'village_discovery_core.js'));
  const baseSeed = 101;
  const baselineFresh = { villageDiscoveries: { version: 1, seed: baselineCore.hash('legacy-matrix'), villages: {} } };
  const candidateFresh = { villageDiscoveries: { version: 1, seed: candidateCore.hash('legacy-matrix'), villages: {} } };
  const baseRec = baselineCore.village(baselineFresh, baseSeed, 'legacy-matrix');
  const candRec = candidateCore.village(candidateFresh, baseSeed, 'legacy-matrix');
  const steps = candidateCore.quest(candRec).steps.length;
  const activityId = candidateCore.activities(candRec)[0].story.id;
  const baseTemplate = {
    ordinal: baseRec.ordinal,
    questId: baseRec.questId,
    accepted: false,
    step: 0,
    completed: false,
    giver: '',
    loot: clone(baseRec.loot),
    lore: clone(baseRec.lore),
    collected: [],
    read: [],
    fieldwork: {},
    placementSeed: baseRec.placementSeed
  };
  const cases = [
    ['unaccepted', {}],
    ['accepted_step0', { accepted: true, giver: 'Pip Reedhand' }],
    ['partial_step1', { accepted: true, giver: 'Pip Reedhand', step: 1 }],
    ['ready_to_finish', { accepted: true, giver: 'Pip Reedhand', step: steps }],
    ['completed_rewarded', { accepted: true, giver: 'Pip Reedhand', step: steps, completed: true }],
    ['collected_read', { collected: [baseRec.loot[0].id], read: [baseRec.lore[0]] }],
    ['fieldwork_partial', { fieldwork: { [activityId]: { step: 2 } } }],
    ['fieldwork_completed', { fieldwork: { [activityId]: { step: 3 } } }]
  ];
  const rows = cases.map(([name, patch]) => {
    const legacy = { villageDiscoveries: { version: 1, seed: 7, villages: { [baseSeed]: { ...clone(baseTemplate), ...clone(patch) } } } };
    const before = JSON.stringify(legacy);
    const rec = candidateCore.village(legacy, baseSeed, 'legacy-matrix');
    const after = JSON.stringify(legacy);
    return { name, nonmutating: before === after, serialized: after, record: clone(rec) };
  });
  const baselineIds = markerMatrix(baselineCore, baselineFresh, baseSeed, 'legacy-matrix');
  const candidateIds = markerMatrix(candidateCore, candidateFresh, baseSeed, 'legacy-matrix');
  const fullDeck = { villageDiscoveries: { version: 1, seed: candidateCore.hash('full-deck'), villages: {} } };
  for (let seed = 1; seed <= 2200; seed++) candidateCore.village(fullDeck, seed, 'full-deck');
  const quests = Object.values(fullDeck.villageDiscoveries.villages).map(row => row.questId);
  const summary = {
    rows,
    baselineIds,
    candidateIds,
    idsPositionsStable: JSON.stringify(baselineIds) === JSON.stringify(candidateIds),
    completeQuestCoverage: { total: quests.length, uniqueQuestIds: new Set(quests).size, availableQuestIds: candidateCore.QUESTS.length }
  };
  const file = path.join(runDir, 'legacy-save-baseline-candidate-matrix.json');
  fs.writeFileSync(file, JSON.stringify(summary, null, 2));
  report.legacyMatrix = file;
  check('legacy_serialized_rows_nonmutating', rows.every(row => row.nonmutating), rows.map(row => ({ name: row.name, nonmutating: row.nonmutating })));
  check('legacy_baseline_candidate_id_position_matrix_stable', summary.idsPositionsStable, { baseline: baselineIds, candidate: candidateIds });
  check('legacy_2200_quest_generation_retains_catalogue', quests.length === 2200 && new Set(quests).size === candidateCore.QUESTS.length, summary.completeQuestCoverage);
}

function pageHtml() {
  return `<!doctype html>
<meta charset="utf-8">
<title>Alderwing remediation proof</title>
<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#0b1013;color:white;font-family:sans-serif}#manual{position:fixed;inset:0;pointer-events:auto}</style>
<link rel="stylesheet" href="/village_walk.css">
<link rel="stylesheet" href="/village_discoveries.css">
<link rel="stylesheet" href="/wilderness_places.css">
<div id="manual"></div>
<script src="/lib/three.min.js"></script>
<script>
window.BurbzFlightCraft = {};
window.BurbzShoreWater = {};
window.BurbzOpenLandCore = {};
window.BurbzWildernessCombat = null;
window.BurbzBuildingWorkCore = {};
window.BurbzBuildingWork = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, reset(){}, diagnostics(){ return {}; } }; } };
window.BurbzVillageHarvestScene = { prepare(){} };
window.BurbzVillageHarvestCore = {};
window.BurbzVillageHarvest = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, diagnostics(){ return {}; } }; } };
window.BurbzAcademyFlightCore = {};
window.BurbzAcademyFlight = { attach(){ return null; } };
window.BurbzFirstPersonMap = {};
window.BurbzFirstPersonHud = { attach(){ return { key(){ return false; }, update(){}, dispose(){}, closePanel(){ return false; }, diagnostics(){ return {}; } }; } };
window.BurbzWorldSky = {};
window.BurbzVillageWorldCore = {};
window.BurbzVillageWorld = { attach(){ return Promise.resolve(); } };
window.BurbzAlderwingIntro = { inputReset(){}, inputStart(){}, inputEnd(){}, inputMove(){}, inputLook(){} };
window.BurbzLookSettings = { closeFor(){}, isOpen(){ return false; }, vertical(v){ return v; } };
window.BurbzLootCore = { materialById(id){ return id === 'oak_twig'; }, gearById(id){ return id === 'thorn_talons'; } };
</script>
<script src="/settlement_models.js"></script>
<script src="/village_walk_core.js"></script>
<script src="/village_walk_scene.js"></script>
<script src="/building_rooms_core.js"></script>
<script src="/building_rooms_scene.js"></script>
<script src="/interior_life_core.js"></script>
<script src="/interior_life.js"></script>
<script src="/player_home_core.js"></script>
<script src="/player_home_scene.js"></script>
<script src="/wilderness_places_core.js"></script>
<script src="/wilderness_places.js"></script>
<script src="/village_discovery_content.js"></script>
<script src="/village_discovery_core.js"></script>
<script src="/village_discoveries.js"></script>
<script>
window.BurbzInteriorLifeCore = window.BurbzInteriorLifeCore;
window.BurbzBuildingRooms = { attach(){ return { key(){ return false; }, leave(){ return false; }, update(){}, dispose(){}, closePanel(){ return false; }, diagnostics(){ return {}; } }; } };
</script>
<script src="/village_walk.js"></script>`;
}
function createServer() {
  const files = new Set(moduleFiles);
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/' || url.pathname === '/probe.html') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' });
      res.end(pageHtml());
      return;
    }
    const rel = url.pathname.slice(1);
    let file = null;
    if (files.has(rel) || rel.startsWith('assets/') || rel.startsWith('bird-art-cache/')) file = path.join(publicRoot, rel);
    else if (rel.endsWith('.css')) {
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end('');
      return;
    } else if (rel.endsWith('.js')) {
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end('/* empty remediation dependency */');
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

async function installBrowserProbe(page) {
  await page.evaluate(() => {
    window.__rem = {};
    const core = window.BurbzVillageDiscoveryCore;
    const saveKey = 'alderwing_remediation_disposable_save';
    const nativeSetItem = Storage.prototype.setItem;
    const clone = value => JSON.parse(JSON.stringify(value));
    function rewardText(reward = {}) {
      const bits = [];
      if (Number(reward.coins) > 0) bits.push(`${reward.coins} coins`);
      if (Number(reward.branches) > 0) bits.push(`${reward.branches} branches`);
      for (const [id, count] of Object.entries(reward.materials || {})) if (Number(count) > 0) bits.push(`${count} ${id === 'oak_twig' ? 'Oak Twigs' : id}`);
      for (const [id, count] of Object.entries(reward.gear || {})) if (Number(count) > 0) bits.push(`${count} ${id}`);
      return bits.join(' and ');
    }
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
    function makeState(kind = 'default', fromStorage = false, supplied = null) {
      if (supplied) return clone(supplied);
      if (fromStorage && localStorage.getItem(saveKey)) return JSON.parse(localStorage.getItem(saveKey));
      const state = { player: { coins: 100, branches: 30 }, inventory: { items: {}, gear: {} }, villageDiscoveries: { version: 1, seed: core.hash('remediation'), villages: {} } };
      const rec = core.village(state, 101, 'remediation');
      rec.questId = core.QUESTS[0].id;
      rec.accepted = false;
      rec.step = 0;
      rec.completed = false;
      rec.giver = '';
      rec.loot = [
        { id: 'loot0', label: 'Coin pouch', reward: { coins: 5 } },
        { id: 'loot1', label: 'Twig bundle', reward: { materials: { oak_twig: 2 } } },
        { id: 'loot2', label: 'Empty keepsake box', reward: {} }
      ];
      rec.lore = [core.LORE[0].id, core.LORE[1].id];
      rec.collected = [];
      rec.read = [];
      rec.fieldwork = {};
      if (kind === 'legacy-accepted') { rec.accepted = true; rec.giver = 'Pip Reedhand'; }
      return state;
    }
    function record(state) { return state.villageDiscoveries.villages['101']; }
    function createSource(state) {
      const T = window.THREE;
      const scene = new T.Scene();
      scene.background = new T.Color(0x10171b);
      scene.add(new T.HemisphereLight(0xf5f8ff, 0x42525a, 1.7));
      const sun = new T.DirectionalLight(0xffffff, 2.2);
      sun.position.set(4, 8, 6);
      scene.add(sun);
      const camera = new T.PerspectiveCamera(58, 1280 / 800, 0.08, 120);
      const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
      renderer.setPixelRatio(1);
      renderer.setSize(1280, 800, false);
      const resident = new T.Object3D();
      resident.position.set(1.8, 0, 0.2);
      resident.userData.resident = true;
      resident.userData.npc = { name: 'Pip Reedhand' };
      scene.add(resident);
      const world = { radius: 28, segments: [], spawn(){ return { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.15, mode: 'walk' }; }, height(){ return 0; }, allowed(){ return true; }, surface(){ return 'grass'; } };
      const api = {
        prepare(){},
        record: () => record(window.__rem.state),
        rewardText,
        act(type, id, giver) {
          const before = clone(window.__rem.state);
          try {
            const result = core.act(record(window.__rem.state), type, id, giver);
            if (!result) return result;
            if (result.reward) applyReward(window.__rem.state, result.reward);
            localStorage.setItem(saveKey, JSON.stringify(window.__rem.state));
            return result;
          } catch (error) {
            restore(window.__rem.state, before);
            throw error;
          }
        }
      };
      return { scene, renderer, camera, buildings: [], movers: [resident], world, discovery: { api, world, movers: [resident] }, api };
    }
    Storage.prototype.setItem = function(key, value) { return nativeSetItem.call(this, key, value); };
    window.__rem.openVillage = async (kind = 'default', opts = {}) => {
      if (window.BurbzVillageWalk.isOpen()) {
        window.BurbzVillageWalk.close('exit');
        await window.BurbzVillageWalk.whenClosed();
      }
      window.__rem.state = makeState(kind, !!opts.fromStorage, opts.state || null);
      nativeSetItem.call(localStorage, saveKey, JSON.stringify(window.__rem.state));
      window.__rem.source = createSource(window.__rem.state);
      const opened = await window.BurbzVillageWalk.open({ name: 'Remediation village', source: async () => window.__rem.source, discoveries: window.__rem.source.api });
      if (!opened) throw Error('BurbzVillageWalk.open returned false');
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return true;
    };
    window.__rem.snapshot = () => ({ state: clone(window.__rem.state), diagnostics: window.BurbzVillageWalk.diagnostics(), persisted: localStorage.getItem(saveKey) });
    window.__rem.placeNear = (kind, id) => {
      const debug = window.__burbzVillageWalkDebug;
      const diag = debug.state();
      const world = debug.world();
      const item = kind === 'resident' ? diag.discoveries.residents[0] : diag.discoveries.objects.find(row => row.kind === kind && (id === undefined || String(row.id) === String(id)) && row.visible !== false);
      if (!item) return false;
      for (const radius of [0, .5, 1.1]) for (let i = 0; i < 32; i++) {
        const x = item.x + Math.cos(i / 32 * Math.PI * 2) * radius;
        const z = item.z + Math.sin(i / 32 * Math.PI * 2) * radius;
        if (world.allowed(x, z) && debug.place({ x, z, yaw: Math.atan2(x - item.x, z - item.z), pitch: -0.15 })) return true;
      }
      return false;
    };
    window.__rem.collectVillageScene = () => {
      const diag = window.BurbzVillageWalk.diagnostics();
      const root = window.__rem.source.scene.children.find(child => child.type === 'Group' && child.children.length === diag.discoveries.objects.length);
      const visibleWorld = node => { for (let cur = node; cur; cur = cur.parent) if (!cur.visible) return false; return true; };
      const signature = node => ({ type: node.type, geometryType: node.geometry?.type || null, visible: visibleWorld(node), px: +node.position.x.toFixed(3), py: +node.position.y.toFixed(3), pz: +node.position.z.toFixed(3), rx: +node.rotation.x.toFixed(3), ry: +node.rotation.y.toFixed(3), rz: +node.rotation.z.toFixed(3) });
      const markers = diag.discoveries.objects.map((obj, index) => {
        const group = root.children[index];
        const nodes = [];
        group.traverse(node => nodes.push(signature(node)));
        return { ...obj, groupTransform: signature(group), visibleSprites: nodes.filter(row => row.type === 'Sprite' && row.visible), visibleMeshes: nodes.filter(row => row.type === 'Mesh' && row.visible), visibleRings: nodes.filter(row => row.geometryType === 'RingGeometry' && row.visible), nodes };
      });
      return { objects: markers, visibleItemSprites: markers.filter(row => ['loot', 'lore', 'board', 'step', 'activity'].includes(row.kind)).flatMap(row => row.visibleSprites), glowRows: markers.filter(row => row.kind === 'loot').map(row => ({ id: row.id, glows: row.visibleRings.length > 0, open: row.open, rewardGrantable: row.rewardGrantable })), transformRows: markers.map(row => ({ kind: row.kind, id: String(row.id), group: row.groupTransform, meshes: row.visibleMeshes.map(m => [m.geometryType, m.px, m.py, m.pz, m.rx, m.ry, m.rz]).join('|') })) };
    };
    window.__rem.sameScenarioPreservation = () => {
      const T = window.THREE;
      const scene = new T.Scene();
      const world = { radius: 22, segments: [{ id: 'lane-a' }, { id: 'lane-b' }], spawn(){ return { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.1, mode: 'walk' }; }, height(){ return 0; }, allowed(x, z){ return Number.isFinite(x + z) && Math.abs(x) < 12 && Math.abs(z) < 12; }, surface(){ return 'grass'; } };
      const buildings = [], movers = [], harvest = [];
      for (let i = 0; i < 5; i++) { const g = new T.Group(); g.position.set(i - 2, 0, 5); g.userData.buildingId = i === 2 ? 'market' : 'cabin'; g.userData.paidHome = i === 0; g.userData.shop = i === 2; scene.add(g); buildings.push(g); }
      for (let i = 0; i < 4; i++) { const actor = new T.Object3D(); actor.position.set(-3 + i, 0, -2); actor.userData.resident = true; actor.userData.npc = { name: 'Resident ' + i }; scene.add(actor); movers.push(actor); }
      for (let i = 0; i < 3; i++) { const crop = new T.Mesh(new T.BoxGeometry(.2, .2, .2), new T.MeshBasicMaterial()); crop.position.set(3, 0, -3 + i); crop.userData.harvestPlot = true; scene.add(crop); harvest.push(crop); }
      const samplePath = [-10, -5, 0, 5, 10].flatMap(x => [-10, -5, 0, 5, 10].map(z => ({ x, z, allowed: world.allowed(x, z), height: world.height(x, z) })));
      const before = { buildings: buildings.map(b => ({ id: b.userData.buildingId, paidHome: !!b.userData.paidHome, shop: !!b.userData.shop, x: b.position.x, z: b.position.z })), movers: movers.map(m => ({ name: m.userData.npc.name, x: m.position.x, z: m.position.z })), harvest: harvest.map(h => ({ x: h.position.x, z: h.position.z, visible: h.visible })), path: samplePath };
      const state = makeState('default');
      const api = createSource(state).api;
      window.__rem.state = state;
      const abort = new AbortController();
      const holder = document.createElement('section');
      document.body.append(holder);
      const session = { root: holder, source: { scene, movers }, world, player: world.spawn(), options: {}, abort, uiBusy: false, failed: false, closed: false, reset(){}, room: null };
      const discoveries = window.BurbzVillageDiscoveries.attach(session, { api, scene, world, movers });
      discoveries.update(performance.now() / 1000, true);
      const diag = discoveries.diagnostics();
      const after = { buildings: buildings.map(b => ({ id: b.userData.buildingId, paidHome: !!b.userData.paidHome, shop: !!b.userData.shop, x: b.position.x, z: b.position.z })), movers: movers.map(m => ({ name: m.userData.npc.name, x: m.position.x, z: m.position.z })), harvest: harvest.map(h => ({ x: h.position.x, z: h.position.z, visible: h.visible })), path: samplePath.map(row => ({ ...row, allowedAfter: world.allowed(row.x, row.z), heightAfter: world.height(row.x, row.z) })), discoveryObjects: diag.objects.length, residents: diag.residents.length };
      discoveries.dispose();
      abort.abort();
      holder.remove();
      return { before, after };
    };
    window.__rem.wildernessProof = () => {
      const T = window.THREE, C = window.BurbzWildernessPlacesCore, W = window.BurbzWildernessPlaces;
      const rows = [];
      const examples = new Map();
      for (let row = 9000; row < 9040 && examples.size < 4; row++) for (let col = 1; col < 40 && examples.size < 4; col++) {
        const record = C.cell(row, col);
        if (record && !examples.has(record.storyId)) examples.set(record.storyId, record);
      }
      const root = document.getElementById('manual');
      for (const record of examples.values()) {
        const content = W.create(T, record, {});
        const sprites = [];
        const targetMeshes = [];
        for (const target of content.targets) target.model.traverse(node => { if (node.type === 'Sprite' && node.visible) sprites.push({ record: record.id, kind: target.kind }); if (node.isMesh && node.visible) targetMeshes.push({ kind: target.kind, geometry: node.geometry?.type }); });
        const state = { player: { coins: 0 }, inventory: { items: {} }, wildernessPlaces: { version: 1, sites: {} } };
        const api = { read: () => C.read(state, record), act: (type, index) => C.act(state, record, type, index) };
        const abort = new AbortController();
        const session = { root, abort, player: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mode: 'walk' }, world: { height(){ return 0; }, allowed(){ return true; } }, uiBusy: false, failed: false, closed: false, reset(){}, room: null };
        const inst = W.attach(session, { record, api, targets: content.targets, frame: { x: 0, y: 0, z: 0 } });
        const keeper = content.targets.find(t => t.kind === 'keeper');
        const book = content.targets.find(t => t.kind === 'book');
        let panelOpened = false;
        if (keeper) { session.player.x = keeper.x; session.player.z = keeper.z; inst.update(performance.now() / 1000, true); inst.key('KeyE'); panelOpened = !!root.querySelector('.wp-panel:not([hidden])'); const accept = [...root.querySelectorAll('.wp-panel button')].find(b => /help/i.test(b.textContent)); accept?.click(); }
        if (book) { inst.closePanel(); session.player.x = book.x; session.player.z = book.z; inst.update(performance.now() / 1000, true); inst.key('KeyE'); panelOpened = panelOpened || !!root.querySelector('.wp-panel:not([hidden])'); }
        rows.push({ id: record.id, storyId: record.storyId, targets: content.targets.map(t => ({ kind: t.kind, index: t.index })), visibleSprites: sprites, targetMeshes, panelOpened, state: C.read(state, record) });
        inst.dispose();
        abort.abort();
        content.dispose();
      }
      return rows;
    };
    window.__rem.homeInteriorProof = () => {
      const T = window.THREE;
      const home = window.BurbzPlayerHomeCore.normalize({ tier: 1, rooms: { library: true, workshop: true, conservatory: true }, owned: {}, placed: [], finds: [], farm: { version: 1, plots: [], seeds: {}, nextId: 1 } }, true);
      const grade = { hemi: 1.3, keyColor: 0xffffff, keyIntensity: 1.8, sun: 1 };
      const areas = ['yard', 'room', 'library', 'workshop', 'conservatory'];
      const homeRows = areas.map(area => {
        const scene = window.BurbzPlayerHomeScene.create(T, home, area, 16 / 9, grade, { portrait: true, now: 1700000000000 });
        const findRows = scene.finds.map(mesh => { const sprites = []; const meshes = []; mesh.traverse(node => { if (node.type === 'Sprite' && node.visible) sprites.push(node.type); if (node.isMesh && node.visible) meshes.push(node.geometry?.type); }); return { id: mesh.userData.findId, sprites, meshes }; });
        const merlinSprites = [];
        scene.scene.traverse(node => { if (node.type === 'Sprite' && node.visible) merlinSprites.push({ x: node.position.x, y: node.position.y, z: node.position.z }); });
        scene.dispose();
        return { area, findRows, merlinSpriteCount: merlinSprites.length };
      });
      const target = { buildingId: 'cabin', seed: 44, homeId: 'proof-home', scope: 'village' };
      const plan = window.BurbzBuildingRoomsCore.plan(target);
      const room = window.BurbzBuildingRoomsScene.create(T, plan);
      room.target = target;
      const state = { interiorDiscoveries: {} };
      const api = { collected: (t, id) => window.BurbzInteriorLifeCore.collected(state, t, id), collect: (t, id) => { const item = window.BurbzInteriorLifeCore.claim(state, t, id); return item ? `Collected ${item.label}` : null; }, people: () => [] };
      const root = document.getElementById('manual');
      const abort = new AbortController();
      const session = { root, abort, player: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0, mode: 'walk' }, uiBusy: false, failed: false, closed: false, reset(){}, room: null };
      const life = window.BurbzInteriorLife.attach(session, room, api);
      life.update(performance.now() / 1000 + 1);
      const before = life.diagnostics();
      for (const pickup of before.pickups) { session.player.x = pickup.x; session.player.z = pickup.z; life.update(performance.now() / 1000 + 2); life.key('KeyE'); life.closePanel(); }
      const after = life.diagnostics();
      const sprites = [];
      room.scene.traverse(node => { if (node.type === 'Sprite' && node.visible) sprites.push(node.type); });
      life.dispose();
      abort.abort();
      room.dispose();
      return { homeRows, interior: { before, after, sprites, state } };
    };
  });
}

async function screenshot(page, name) {
  const file = path.join(runDir, `${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  report.screenshots.push(file);
  return file;
}
async function waitFrames(page, frames = 3) {
  await page.evaluate(count => new Promise(resolve => {
    let left = count;
    function tick() { if (--left <= 0) resolve(); else requestAnimationFrame(tick); }
    requestAnimationFrame(tick);
  }), frames);
}
async function reducedMotionAndControls(page, context) {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.evaluate(() => window.__rem.openVillage('default'));
  await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().discoveries?.artReady);
  await waitFrames(page, 8);
  const before = await page.evaluate(() => window.__rem.collectVillageScene());
  await page.waitForTimeout(650);
  const after = await page.evaluate(() => window.__rem.collectVillageScene());
  await screenshot(page, 'reduced-motion-stable-geometry');
  check('reduced_motion_chest_and_marker_transforms_stable', JSON.stringify(before.transformRows) === JSON.stringify(after.transformRows), { before: before.transformRows, after: after.transformRows });
  check('reduced_motion_keeps_truthful_unopened_loot_glow', after.glowRows.some(row => row.rewardGrantable && !row.open && row.glows) && after.glowRows.some(row => !row.rewardGrantable && !row.glows), after.glowRows);
  check('reduced_motion_no_pickup_sprites_in_village', after.visibleItemSprites.length === 0, after.visibleItemSprites);

  await page.locator('.vw-look').focus();
  await page.keyboard.press('KeyJ');
  await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
  const journalText = await page.locator('.vd-panel').innerText();
  await screenshot(page, 'reduced-motion-keyj-journal');
  check('reduced_motion_key_j_opens_journal', /Field journal/.test(journalText), journalText.slice(0, 200));
  await page.keyboard.press('Escape');
  await page.locator('.vd-panel').waitFor({ state: 'hidden' });

  const placedLoot = await page.evaluate(() => window.__rem.placeNear('loot', 'loot0'));
  check('reduced_motion_place_near_loot_for_key_e', placedLoot, placedLoot);
  await page.locator('.vw-look').focus();
  await page.keyboard.press('KeyE');
  await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
  const eText = await page.locator('.vd-panel').innerText();
  await screenshot(page, 'reduced-motion-keye-loot');
  check('reduced_motion_key_e_opens_reachable_pickup', /In your bag|Coin pouch|Reward/i.test(eText), eText.slice(0, 250));
  await page.keyboard.press('Escape');
  await page.locator('.vd-panel').waitFor({ state: 'hidden' });

  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 2 });
  await page.evaluate(() => window.__rem.placeNear('board'));
  await page.locator('.vd-interact:not([hidden])').tap({ timeout: 5000 });
  await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
  await screenshot(page, 'reduced-motion-touch-action');
  const touchPanel = await page.locator('.vd-panel').innerText();
  check('reduced_motion_touch_action_opens_request', /Villagers|Need:|Work:/i.test(touchPanel), touchPanel.slice(0, 250));
  await page.keyboard.press('Escape');
  await page.locator('.vd-panel').waitFor({ state: 'hidden' });

  const stickBox = await page.locator('.vw-stick').boundingBox();
  const lookBox = await page.locator('.vw-look').boundingBox();
  assert.ok(stickBox && lookBox, 'touch control boxes exist');
  const startPose = await page.evaluate(() => window.BurbzVillageWalk.diagnostics().player);
  const sx = stickBox.x + stickBox.width / 2, sy = stickBox.y + stickBox.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 1, x: sx, y: sy }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 1, x: sx, y: sy - 40 }] });
  await page.waitForTimeout(450);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(120);
  const movedPose = await page.evaluate(() => window.BurbzVillageWalk.diagnostics().player);
  const lx = lookBox.x + lookBox.width / 2, ly = lookBox.y + lookBox.height / 2;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 2, x: lx, y: ly }] });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ id: 2, x: lx + 80, y: ly + 10 }] });
  await page.waitForTimeout(120);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const lookedPose = await page.evaluate(() => window.BurbzVillageWalk.diagnostics().player);
  await screenshot(page, 'reduced-motion-touch-joystick-look');
  check('reduced_motion_touch_joystick_moves_and_touch_look_turns', Math.hypot(movedPose.x - startPose.x, movedPose.z - startPose.z) > 0.03 && Math.abs(lookedPose.yaw - movedPose.yaw) > 0.02, { startPose, movedPose, lookedPose, stickBox, lookBox });
  await page.emulateMedia({ reducedMotion: 'no-preference' });
}

async function legacyReloadBrowser(page) {
  const matrix = JSON.parse(fs.readFileSync(report.legacyMatrix, 'utf8'));
  const reloadRows = [];
  for (const row of matrix.rows) {
    const state = JSON.parse(row.serialized);
    state.player = { coins: 50, branches: 10 };
    state.inventory = { items: {}, gear: {} };
    await page.evaluate(({ state }) => window.__rem.openVillage('default', { state }), { state });
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().ready);
    await waitFrames(page, 3);
    const first = await page.evaluate(() => window.__rem.snapshot());
    await page.evaluate(() => window.__rem.openVillage('default', { fromStorage: true }));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().ready);
    await waitFrames(page, 3);
    const second = await page.evaluate(() => window.__rem.snapshot());
    reloadRows.push({ name: row.name, firstRecord: first.state.villageDiscoveries.villages['101'], secondRecord: second.state.villageDiscoveries.villages['101'], firstObjects: first.diagnostics.discoveries.objects.map(o => ({ kind: o.kind, id: String(o.id), visible: o.visible, open: o.open, glows: o.glows })), secondObjects: second.diagnostics.discoveries.objects.map(o => ({ kind: o.kind, id: String(o.id), visible: o.visible, open: o.open, glows: o.glows })) });
  }
  const file = path.join(runDir, 'legacy-browser-reload-matrix.json');
  fs.writeFileSync(file, JSON.stringify(reloadRows, null, 2));
  report.legacyBrowserReload = file;
  check('legacy_browser_reload_records_stable', reloadRows.every(row => JSON.stringify(row.firstRecord) === JSON.stringify(row.secondRecord)), reloadRows.map(row => ({ name: row.name, first: row.firstRecord, second: row.secondRecord })));
  check('legacy_browser_reload_discovery_visibility_stable', reloadRows.every(row => JSON.stringify(row.firstObjects) === JSON.stringify(row.secondObjects)), reloadRows.map(row => ({ name: row.name, firstObjects: row.firstObjects, secondObjects: row.secondObjects })));
  await screenshot(page, 'legacy-browser-reload-final-state');
}

async function browserModuleBreadth(page) {
  const preservation = await page.evaluate(() => window.__rem.sameScenarioPreservation());
  fs.writeFileSync(path.join(runDir, 'same-scenario-preservation.json'), JSON.stringify(preservation, null, 2));
  check('same_scenario_paid_home_shop_population_harvest_paths_preserved',
    JSON.stringify(preservation.before.buildings) === JSON.stringify(preservation.after.buildings) &&
    JSON.stringify(preservation.before.movers) === JSON.stringify(preservation.after.movers) &&
    JSON.stringify(preservation.before.harvest) === JSON.stringify(preservation.after.harvest) &&
    preservation.after.path.every(row => row.allowed === row.allowedAfter && row.height === row.heightAfter) &&
    preservation.after.residents === preservation.before.movers.length,
    preservation);

  const wilderness = await page.evaluate(() => window.__rem.wildernessProof());
  fs.writeFileSync(path.join(runDir, 'wilderness-browser-pickup-proof.json'), JSON.stringify(wilderness, null, 2));
  await screenshot(page, 'wilderness-browser-proof');
  check('wilderness_real_browser_targets_are_geometric_no_sprites', wilderness.length >= 4 && wilderness.every(row => row.visibleSprites.length === 0 && row.targetMeshes.length > 0 && row.panelOpened), wilderness);

  const homeInterior = await page.evaluate(() => window.__rem.homeInteriorProof());
  fs.writeFileSync(path.join(runDir, 'home-interior-browser-pickup-proof.json'), JSON.stringify(homeInterior, null, 2));
  await screenshot(page, 'home-interior-browser-proof');
  const homeFindRows = homeInterior.homeRows.flatMap(row => row.findRows.map(find => ({ area: row.area, ...find })));
  check('home_finds_are_geometric_no_find_sprites_merlin_sprite_allowed', homeFindRows.length > 0 && homeFindRows.every(row => row.sprites.length === 0 && row.meshes.length > 0) && homeInterior.homeRows.some(row => row.merlinSpriteCount > 0), homeInterior.homeRows);
  check('interior_finds_are_geometric_collectable_no_sprites', homeInterior.interior.before.pickups.length >= 2 && homeInterior.interior.after.pickups.every(row => !row.visible) && homeInterior.interior.sprites.length === 0 && Object.keys(homeInterior.interior.state.interiorDiscoveries).length > 0, homeInterior.interior);
}

async function performanceStability() {
  const results = [];
  for (let i = 0; i < 3; i++) {
    const dir = path.join(runDir, `life-int-repeat-${i + 1}`);
    fs.mkdirSync(dir, { recursive: true });
    const { spawnSync } = require('node:child_process');
    const child = spawnSync(process.execPath, ['scripts/prove-alderwing-life-int.cjs'], {
      cwd: repoRoot,
      env: { ...process.env, EVIDENCE_DIR: dir, BASELINE_DIR: baselineDir, CHROME_PATH: chromePath },
      encoding: 'utf8',
      timeout: 120000
    });
    fs.writeFileSync(path.join(dir, 'stdout.log'), child.stdout || '');
    fs.writeFileSync(path.join(dir, 'stderr.log'), child.stderr || '');
    const latest = findNewest(path.join(dir));
    let parsed = null;
    if (latest) {
      const reportFile = path.join(latest, 'life-int-browser-report.json');
      if (fs.existsSync(reportFile)) parsed = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    }
    results.push({ index: i + 1, status: child.status, signal: child.signal, dir, latest, performance: parsed?.performance, error: parsed?.error });
  }
  fs.writeFileSync(path.join(runDir, 'performance-stability-reruns.json'), JSON.stringify(results, null, 2));
  check('performance_stability_three_lifecycle_runs_pass', results.every(row => row.status === 0 && row.performance?.candidate?.medianMs <= row.performance?.allowedMedianMs), results.map(row => ({ index: row.index, status: row.status, baseline: row.performance?.baseline?.medianMs, candidate: row.performance?.candidate?.medianMs, allowed: row.performance?.allowedMedianMs, error: row.error })));
}
function findNewest(dir) {
  if (!fs.existsSync(dir)) return null;
  const entries = fs.readdirSync(dir, { withFileTypes: true }).filter(entry => entry.isDirectory()).map(entry => path.join(dir, entry.name));
  return entries.sort().at(-1) || null;
}

(async () => {
  legacySaveMatrix();
  const { server, url } = await createServer();
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox', '--use-angle=swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block', hasTouch: true });
    await context.route('**/*', route => route.request().url().startsWith(new URL(url).origin + '/') ? route.continue() : route.abort());
    const page = await context.newPage();
    page.on('console', msg => { if (msg.type() === 'error') report.errors.push({ type: 'console', text: msg.text() }); });
    page.on('pageerror', error => report.errors.push({ type: 'pageerror', text: error.stack || error.message }));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.THREE && window.BurbzVillageWalk && window.BurbzVillageDiscoveries && window.BurbzWildernessPlaces && window.BurbzInteriorLife && window.BurbzPlayerHomeScene);
    await installBrowserProbe(page);
    await browserModuleBreadth(page);
    await reducedMotionAndControls(page, context);
    await legacyReloadBrowser(page);
    await context.close();
  } finally {
    await browser?.close().catch(() => {});
    server.close();
  }
  await performanceStability();
  report.finishedAt = new Date().toISOString();
  report.exitCode = 0;
  fs.writeFileSync(path.join(runDir, 'remediation-results.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(evidenceRoot, 'latest-remediation-run.txt'), `${runDir}\n`);
  console.log(JSON.stringify({ ok: true, runDir, checks: report.checks.length }, null, 2));
})().catch(error => {
  report.finishedAt = new Date().toISOString();
  report.exitCode = 1;
  report.failure = error.stack || error.message;
  try { fs.writeFileSync(path.join(runDir, 'remediation-results.json'), JSON.stringify(report, null, 2)); } catch (_) {}
  console.error(error);
  process.exitCode = 1;
});
