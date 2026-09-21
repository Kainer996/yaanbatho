'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright');

const repoRoot = path.resolve(__dirname, '..');
const evidenceRoot = process.env.EVIDENCE_DIR || '/root/burbz-alderwing-cleanup-evidence/red';
const baselineDir = process.env.BASELINE_DIR || '/root/burbz-alderwing-cleanup-evidence/baseline';
const targetDir = process.env.TARGET_DIR || baselineDir;
const targetName = process.env.TARGET_NAME || (targetDir === baselineDir ? 'baseline' : 'candidate');
const chromeCandidates = [
  process.env.CHROME_PATH,
  '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',
  '/root/.cache/ms-playwright/chromium-1187/chrome-linux/chrome',
  '/usr/bin/chromium'
].filter(Boolean);
const chromePath = chromeCandidates.find(p => fs.existsSync(p));
if (!chromePath) throw Error('No Chromium executable found. Set CHROME_PATH.');

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const runDir = path.join(evidenceRoot, `${stamp}-${targetName}`);
fs.mkdirSync(runDir, { recursive: true });

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
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
  if (reward.materials) for (const [id, count] of Object.entries(reward.materials)) {
    if (Number(count) > 0) bits.push(`${count} ${id.replaceAll('_', ' ')}`);
  }
  if (reward.gear) for (const [id, count] of Object.entries(reward.gear)) {
    if (Number(count) > 0) bits.push(`${count} ${id.replaceAll('_', ' ')}`);
  }
  return bits.length ? `Reward: ${bits.join(', ')}.` : '';
}

const moduleFiles = [
  'village_walk.js',
  'village_discovery_content.js',
  'village_discovery_core.js',
  'village_discoveries.js',
  'village_discoveries.css',
  'village_walk.css'
];
const report = {
  targetName,
  startedAt: new Date().toISOString(),
  command: {
    argv: process.argv,
    cwd: process.cwd(),
    node: process.version,
    playwrightModule: require.resolve(process.env.PLAYWRIGHT_MODULE || '/home/ubuntu/node_modules/playwright'),
    chromePath
  },
  fixtureLimits: [
    'Uses a synthetic flat connected village world with deterministic points; terrain and buildings are not the oracle for this RED slice.',
    'Loads the exact captured baseline discovery and village_walk modules from /root/burbz-alderwing-cleanup-evidence/baseline by default.',
    'Executes BurbzVillageWalk.open in Chromium with harness stubs only for unrelated subsystems, then inspects the real BurbzVillageDiscoveries scene, HUD, and panel DOM.',
    'Does not make paid/provider/backend calls and blocks external network requests.'
  ],
  files: {
    harness: { path: path.relative(repoRoot, __filename), sha256: sha256(__filename) },
    targetDir,
    moduleHashes: Object.fromEntries(moduleFiles.map(file => [file, sha256(path.join(targetDir, file))]))
  },
  served: [],
  console: [],
  pageErrors: [],
  checks: []
};

function addCheck(id, pass, expected, observed) {
  report.checks.push({
    id,
    pass,
    expected,
    observed
  });
}

function savedBaselineVisibleRootCount() {
  if (process.env.BASELINE_VISIBLE_ROOT_COUNT) {
    const count = Number(process.env.BASELINE_VISIBLE_ROOT_COUNT);
    if (Number.isFinite(count) && count > 0) return count;
  }
  const reportPath = process.env.BASELINE_REPORT;
  const latestPath = '/root/burbz-alderwing-cleanup-evidence/red/latest-baseline-red-run.txt';
  try {
    const file = reportPath || path.join(fs.readFileSync(latestPath, 'utf8').trim(), 'baseline-red-results.json');
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    return Number(saved.scenes?.defaultScene?.visibleRootCount) || null;
  } catch (_) {
    return null;
  }
}

function pageHtml() {
  return `<!doctype html>
<meta charset="utf-8">
<title>Alderwing RED baseline harness</title>
<style>
  html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#101614;color:white;font-family:sans-serif}
  #host{position:fixed;inset:0}
</style>
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
  window.BurbzBuildingRoomsCore = { plan(){ return {}; }, world(){ return window.__redHarnessWorld; } };
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
  window.BurbzVillageWalkScene = { create(){ return window.__redHarnessWorld; }, batch(){ return function unbatch(){}; } };
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
  const publicRoot = path.join(repoRoot, 'public/burbz');
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    let file = null;
    if (url.pathname === '/' || url.pathname === '/harness.html') {
      const body = pageHtml();
      report.served.push({ url: url.pathname, source: 'generated harness html' });
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(body);
      return;
    }
    if (url.pathname === '/lib/three.min.js') file = path.join(publicRoot, 'lib/three.min.js');
    else if (url.pathname.startsWith('/assets/')) file = path.join(publicRoot, url.pathname.slice(1));
    else if (moduleFiles.includes(url.pathname.slice(1))) file = path.join(targetDir, url.pathname.slice(1));
    else if (url.pathname.endsWith('.css')) {
      report.served.push({ url: url.pathname, source: 'empty harness css dependency' });
      res.writeHead(200, { 'content-type': 'text/css; charset=utf-8' });
      res.end('');
      return;
    } else if (url.pathname.endsWith('.js')) {
      report.served.push({ url: url.pathname, source: 'empty harness js dependency' });
      res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' });
      res.end('/* harness empty dependency */');
      return;
    }
    if (!file || !fs.existsSync(file) || !path.resolve(file).startsWith(path.dirname(file.startsWith(targetDir) ? targetDir : publicRoot))) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    report.served.push({ url: url.pathname, source: file });
    res.writeHead(200, { 'content-type': contentType(file), 'cache-control': 'no-store' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise(resolve => {
    server.listen(0, '127.0.0.1', () => resolve({ server, url: `http://127.0.0.1:${server.address().port}/harness.html` }));
  });
}

async function run() {
  const { server, url } = await createServer();
  report.url = url;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, executablePath: chromePath, args: ['--no-sandbox', '--use-angle=swiftshader'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, serviceWorkers: 'block' });
    await context.route('**/*', route => {
      const requestUrl = route.request().url();
      if (requestUrl.startsWith(new URL(url).origin + '/')) return route.continue();
      report.console.push({ type: 'blocked-network', text: requestUrl });
      return route.abort();
    });
    const page = await context.newPage();
    page.on('console', msg => report.console.push({ type: msg.type(), text: msg.text() }));
    page.on('pageerror', err => report.pageErrors.push(err.stack || err.message));
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => window.THREE && window.BurbzVillageWalk && window.BurbzVillageDiscoveryCore && window.BurbzVillageDiscoveries);

    await page.evaluate(serializedRewardText => {
      window.__redRewardText = eval(serializedRewardText);
      window.__redHarnessWorld = {
        radius: 18,
        segments: [],
        spawn(){ return { x: 0, y: 0, z: 0, yaw: 0, pitch: -0.15, mode: 'walk' }; },
        height(){ return 0; },
        allowed(){ return true; },
        surface(){ return 'grass'; }
      };
      window.__redHarness = {
        source: null,
        record: null,
        state: null,
        async open(kind) {
          if (window.BurbzVillageWalk.isOpen()) {
            window.BurbzVillageWalk.close('exit');
            await window.BurbzVillageWalk.whenClosed();
          }
          const T = window.THREE;
          const scene = new T.Scene();
          scene.background = new T.Color(0x16221d);
          scene.add(new T.HemisphereLight(0xf8f0db, 0x435245, 1.7));
          const sun = new T.DirectionalLight(0xffe6b0, 2.3);
          sun.position.set(4, 8, 6);
          scene.add(sun);
          const camera = new T.PerspectiveCamera(58, 1280 / 800, 0.08, 120);
          camera.position.set(0, 5.8, 8.2);
          camera.lookAt(0, 0.6, 0);
          const renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
          renderer.setPixelRatio(1);
          renderer.setSize(1280, 800, false);
          const core = window.BurbzVillageDiscoveryCore;
          const state = { villageDiscoveries: { version: 1, seed: core.hash('red-harness'), villages: {} } };
          const rec = core.village(state, 101, 'red-harness');
          if (kind === 'glow') {
            rec.questId = core.QUESTS[0].id;
            rec.accepted = false;
            rec.completed = false;
            rec.step = 0;
            rec.collected = ['opened-positive'];
            rec.loot = [
              { id: 'positive', label: 'Positive coins', reward: { coins: 12 } },
              { id: 'empty', label: 'Empty pouch', reward: {} },
              { id: 'zero', label: 'Zero coins', reward: { coins: 0, materials: { oak_twig: 0 } } },
              { id: 'negative', label: 'Negative coins', reward: { coins: -4 } },
              { id: 'nonfinite', label: 'Nonfinite coins', reward: { coins: null } },
              { id: 'missing', label: 'Missing reward' },
              { id: 'unsupported', label: 'Unsupported reward', reward: { reputation: 3 } },
              { id: 'opened-positive', label: 'Opened positive', reward: { coins: 6 } }
            ];
            rec.lore = [];
          }
          if (kind === 'completed-seal') {
            const first = core.activities(rec)[0];
            rec.fieldwork = { [first.story.id]: { step: first.story.steps.length } };
          }
          const api = {
            prepare(){},
            record(){ return rec; },
            rewardText: window.__redRewardText,
            act(type, id, giver){ return core.act(rec, type, id, giver); }
          };
          const source = {
            scene,
            renderer,
            camera,
            buildings: [],
            movers: [],
            world: window.__redHarnessWorld,
            discovery: { api, world: window.__redHarnessWorld }
          };
          window.__redHarness.source = source;
          window.__redHarness.record = rec;
          window.__redHarness.state = state;
          const opened = await window.BurbzVillageWalk.open({ name: 'RED Alderwing baseline', source: async () => source, discoveries: api });
          if (!opened) throw Error('BurbzVillageWalk.open returned false');
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
          return true;
        },
        collect() {
          const T = window.THREE;
          const diag = window.BurbzVillageWalk.diagnostics();
          const source = window.__redHarness.source;
          const markerRoot = source.scene.children.find(child =>
            child.type === 'Group' &&
            child.children.length === diag.discoveries.objects.length &&
            child.children.every(grp => grp.type === 'Group')
          );
          if (!markerRoot) throw Error('Discovery marker root not found');
          const worldVisible = node => {
            for (let cur = node; cur; cur = cur.parent) if (!cur.visible) return false;
            return true;
          };
          const markerGroups = markerRoot.children;
          const markers = diag.discoveries.objects.map((obj, index) => {
            const group = markerGroups[index];
            const nodes = [];
            group.traverse(node => {
              const material = Array.isArray(node.material) ? node.material[0] : node.material;
              nodes.push({
                type: node.type,
                geometryType: node.geometry && node.geometry.type,
                materialType: material && material.type,
                visibleSelf: node.visible,
                visibleWorld: worldVisible(node),
                transparent: material && material.transparent,
                alphaTest: material && material.alphaTest,
                color: material && material.color && material.color.getHexString(),
                scale: { x: node.scale.x, y: node.scale.y, z: node.scale.z }
              });
            });
            return {
              ...obj,
              groupVisibleWorld: worldVisible(group),
              visibleSprites: nodes.filter(n => n.type === 'Sprite' && n.visibleWorld),
              allSprites: nodes.filter(n => n.type === 'Sprite'),
              visibleMeshes: nodes.filter(n => n.type === 'Mesh' && n.visibleWorld),
              visibleRings: nodes.filter(n => n.geometryType === 'RingGeometry' && n.visibleWorld),
              meshSignatures: nodes
                .filter(n => n.type === 'Mesh' && n.visibleWorld)
                .map(n => `${n.geometryType}:${n.color || 'none'}:${Number(n.scale.x).toFixed(2)}:${Number(n.scale.y).toFixed(2)}:${Number(n.scale.z).toFixed(2)}`)
            };
          });
          const visibleRoots = markers.filter(m => m.groupVisibleWorld);
          const visibleItemSprites = markers.filter(m => m.groupVisibleWorld && m.visibleSprites.length && ['loot', 'lore', 'board', 'step', 'activity'].includes(m.kind));
          const lootMarkers = markers.filter(m => m.kind === 'loot');
          const visibleLootMeshes = lootMarkers.flatMap(m => m.meshSignatures);
          const distinctLootGeometry = [...new Set(visibleLootMeshes)].sort();
          const glowRows = lootMarkers.map(marker => {
            const loot = window.__redHarness.record.loot.find(row => row.id === marker.id);
            const reward = loot && loot.reward;
            const positive = !!reward && (
              Number(reward.coins) > 0 ||
              Number(reward.branches) > 0 ||
              Object.values(reward.materials || {}).some(v => Number(v) > 0) ||
              Object.values(reward.gear || {}).some(v => Number(v) > 0)
            );
            const opened = window.__redHarness.record.collected.includes(marker.id);
            return {
              id: marker.id,
              positiveGrantableLoot: positive,
              opened,
              markerVisible: marker.groupVisibleWorld,
              visibleRingCount: marker.visibleRings.length,
              visibleSpriteCount: marker.visibleSprites.length,
              shouldGlow: positive && !opened,
              glows: marker.groupVisibleWorld && marker.visibleRings.length > 0
            };
          });
          return {
            ready: diag.ready,
            failed: diag.failed,
            frames: diag.frames,
            discovery: diag.discoveries,
            markerCount: markers.length,
            visibleRootCount: visibleRoots.length,
            visibleActivityRootCount: visibleRoots.filter(m => m.kind === 'activity').length,
            visibleItemSpriteCount: visibleItemSprites.length,
            visibleItemSprites: visibleItemSprites.map(m => ({ kind: m.kind, id: m.id, spriteCount: m.visibleSprites.length })),
            lootMarkerCount: lootMarkers.length,
            distinctLootGeometry,
            glowRows,
            renderer: { draws: diag.draws, triangles: diag.triangles, memory: diag.memory },
            userAgent: navigator.userAgent,
            webgl: !!source.renderer.getContext()
          };
        }
      };
    }, rewardText.toString());

    await page.evaluate(() => window.__redHarness.open('default'));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().discoveries?.artReady === true, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    const defaultScene = await page.evaluate(() => window.__redHarness.collect());
    await page.screenshot({ path: path.join(runDir, 'baseline-default-scene.png'), fullPage: true });

    addCheck(
      'sprite_billboard_presence',
      defaultScene.visibleItemSpriteCount === 0,
      'Every first-person loot/lore/request/activity pickup uses zero visible THREE.Sprite billboard representations after assets settle.',
      {
        artReady: defaultScene.discovery.artReady,
        visibleItemSpriteCount: defaultScene.visibleItemSpriteCount,
        examples: defaultScene.visibleItemSprites.slice(0, 10)
      }
    );

    const defaultLootKinds = defaultScene.distinctLootGeometry.length;
    addCheck(
      'three_visible_geometric_chest_variants',
      defaultLootKinds >= 3,
      'A normal 3+ loot village exposes at least three distinct visible procedural chest geometry signatures.',
      {
        lootMarkerCount: defaultScene.lootMarkerCount,
        distinctVisibleLootGeometryCount: defaultLootKinds,
        distinctLootGeometry: defaultScene.distinctLootGeometry
      }
    );

    const baselineVisibleRootCount = targetName === 'baseline'
      ? defaultScene.visibleRootCount
      : savedBaselineVisibleRootCount() || defaultScene.visibleRootCount;
    const allowedVisibleRoots = Math.floor(baselineVisibleRootCount * 0.65);
    const reductionPercent = baselineVisibleRootCount
      ? Math.round((1 - defaultScene.visibleRootCount / baselineVisibleRootCount) * 1000) / 10
      : 0;
    addCheck(
      'clutter_reduction_against_identical_baseline',
      defaultScene.visibleRootCount <= allowedVisibleRoots,
      'Candidate visible discovery prop roots are at least 35% lower than the identical unaccepted baseline fixture.',
      {
        baselineVisibleRootCount,
        observedCandidateVisibleRootCount: defaultScene.visibleRootCount,
        requiredMaxVisibleRoots: allowedVisibleRoots,
        reductionPercent,
        visibleActivityRootCount: defaultScene.visibleActivityRootCount
      }
    );

    await page.evaluate(() => window.__redHarness.open('glow'));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().discoveries?.artReady === true, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    const glowScene = await page.evaluate(() => window.__redHarness.collect());
    await page.screenshot({ path: path.join(runDir, 'baseline-glow-table-scene.png'), fullPage: true });
    const wrongGlowRows = glowScene.glowRows.filter(row => row.glows !== row.shouldGlow);
    addCheck(
      'chest_glow_truth_table',
      wrongGlowRows.length === 0,
      'Chest glow is visible iff unopened and the reward contains positive grantable loot; empty, zero, negative, nonfinite, missing, unsupported-only, and opened rows do not glow.',
      {
        rows: glowScene.glowRows,
        wrongRows: wrongGlowRows
      }
    );

    await page.evaluate(() => window.__redHarness.open('completed-seal'));
    await page.waitForFunction(() => window.BurbzVillageWalk.diagnostics().discoveries?.artReady === true, null, { timeout: 15000 });
    await page.waitForTimeout(500);
    const sealScene = await page.evaluate(() => window.__redHarness.collect());
    await page.screenshot({ path: path.join(runDir, 'baseline-completion-seal-scene.png'), fullPage: true });
    const visibleActivitySealSprites = sealScene.visibleItemSprites.filter(row => row.kind === 'activity');
    addCheck(
      'completion_seal_sprite_presence',
      visibleActivitySealSprites.length === 0,
      'Completed fieldwork seals are not represented by visible sprites in first-person pickup paths.',
      {
        visibleActivitySpriteExamples: visibleActivitySealSprites.slice(0, 5),
        visibleItemSpriteCount: sealScene.visibleItemSpriteCount
      }
    );

    await page.locator('.vd-journal').click();
    await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
    const journalText = await page.locator('.vd-panel').innerText();
    await page.getByRole('button', { name: /Track the villagers' request|Track the villagers’ request/ }).click();
    await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
    await page.screenshot({ path: path.join(runDir, 'baseline-remote-request-offer.png'), fullPage: true });
    const requestText = await page.locator('.vd-panel').innerText();
    const offerButtons = await page.locator('.vd-body button').evaluateAll(buttons => buttons.map(button => button.textContent.trim()));
    const uiStyles = await page.evaluate(() => {
      const panel = document.querySelector('.vd-panel');
      const close = document.querySelector('.vd-close');
      const heading = document.querySelector('.vd-panel h2');
      const action = document.querySelector('.vd-body button');
      const style = el => {
        const s = getComputedStyle(el);
        return {
          color: s.color,
          backgroundColor: s.backgroundColor,
          backgroundImage: s.backgroundImage,
          borderColor: s.borderColor,
          outlineColor: s.outlineColor
        };
      };
      return { panel: style(panel), close: style(close), heading: style(heading), action: style(action) };
    });
    const beforeAccept = await page.evaluate(() => ({ ...window.__redHarness.record }));
    if (offerButtons.includes("I’ll help") || offerButtons.includes("I'll help")) {
      await page.getByRole('button', { name: /I.ll help/ }).click();
      await page.locator('.vd-panel:not([hidden])').waitFor({ timeout: 5000 });
    }
    const afterRemoteAccept = await page.evaluate(() => ({
      accepted: window.__redHarness.record.accepted,
      giver: window.__redHarness.record.giver,
      step: window.__redHarness.record.step,
      completed: window.__redHarness.record.completed
    }));
    addCheck(
      'remote_journal_cannot_accept_request',
      !afterRemoteAccept.accepted,
      'The remote journal may track/explain the request but cannot accept it away from a reachable resident or request post.',
      {
        journalText,
        requestText,
        offerButtons,
        beforeAccepted: beforeAccept.accepted,
        afterRemoteAccept
      }
    );
    addCheck(
      'request_offer_has_not_now',
      offerButtons.some(label => /^not now$/i.test(label)),
      'Request offer includes an explicit nonmutating Not now deferral.',
      { offerButtons }
    );
    const greenGoldStyleHit = JSON.stringify(uiStyles).match(/255,\s*229,\s*164|248,\s*199,\s*90|199,\s*165,\s*96|166,\s*144,\s*96|32,\s*61,\s*52|41,\s*72,\s*57/i);
    addCheck(
      'charcoal_cool_accent_replaces_green_gold',
      !greenGoldStyleHit,
      'Discovery panel styling avoids the old green/gold palette and uses the new charcoal/cool-accent hierarchy.',
      { uiStyles }
    );

    report.scenes = { defaultScene, glowScene, sealScene };
    report.pageTextTail = (await page.locator('body').innerText()).slice(-3000);
    await context.close();
  } finally {
    await browser?.close();
    server.close();
  }
}

run().then(() => {
  const failures = report.checks.filter(check => !check.pass);
  report.finishedAt = new Date().toISOString();
  report.failureCount = failures.length;
  report.exitCode = failures.length ? 1 : 0;
  const summary = [
    '# Alderwing RED Baseline Evidence',
    '',
    `Target: ${targetName}`,
    `Browser: ${report.command.chromePath}`,
    `Exit code: ${report.exitCode}`,
    '',
    '## Failed GREEN Assertions',
    ...failures.map(check => `- ${check.id}: ${check.expected}`),
    '',
    '## Screenshots',
    '- baseline-default-scene.png',
    '- baseline-glow-table-scene.png',
    '- baseline-completion-seal-scene.png',
    '- baseline-remote-request-offer.png'
  ].join('\n');
  fs.writeFileSync(path.join(runDir, 'baseline-red-results.json'), JSON.stringify(report, null, 2));
  fs.writeFileSync(path.join(runDir, 'baseline-red-summary.md'), summary);
  fs.writeFileSync(path.join(evidenceRoot, 'latest-baseline-red-run.txt'), runDir + '\n');
  console.log(JSON.stringify({ runDir, failures: failures.map(f => f.id), exitCode: report.exitCode }, null, 2));
  process.exitCode = report.exitCode;
}).catch(error => {
  report.finishedAt = new Date().toISOString();
  report.harnessError = error.stack || error.message;
  report.exitCode = 2;
  try {
    fs.writeFileSync(path.join(runDir, 'baseline-red-results.json'), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(evidenceRoot, 'latest-baseline-red-run.txt'), runDir + '\n');
  } catch (_) {}
  console.error(error);
  process.exitCode = 2;
});
