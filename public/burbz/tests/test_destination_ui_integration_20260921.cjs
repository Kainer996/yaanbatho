const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const ROOT = path.join(__dirname, '..');
const INDEX = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const SW = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const UPDATER = fs.readFileSync(path.join(ROOT, '..', '..', 'scripts', 'update-live-burbz.sh'), 'utf8');
const routeCore = require('../destination_route_core.js');
const rewardCore = require('../destination_reward_core.js');
const stateCore = require('../destination_state_core.js');

function destinationPoint(x, y) {
  return { lat: 51.5 + y / 111320, lon: -0.12 + x / 70000 };
}

function destinationWay(id, nodeIds, points) {
  return {
    type: 'way',
    id,
    nodes: nodeIds,
    geometry: points,
    tags: { highway: 'footway', foot: 'yes', designation: 'public_footpath' }
  };
}

function destinationOsm(ways) {
  const nodes = new Map();
  const elements = [];
  ways.forEach(way => {
    way.nodes.forEach((nodeId, index) => {
      const id = String(nodeId);
      if (!nodes.has(id)) {
        nodes.set(id, { type: 'node', id, lat: way.geometry[index].lat, lon: way.geometry[index].lon, tags: {} });
      }
    });
    elements.push(way);
  });
  return { elements: Array.from(nodes.values()).concat(elements), osm3s: { timestamp_osm_base: '2026-09-21T12:00:00Z' } };
}

function destinationRoute(seed) {
  const offset = seed * 500;
  const raw = destinationOsm([
    destinationWay(700 + seed, [1, 2, 3, 4].map(id => id + offset), [
      destinationPoint(offset, 0),
      destinationPoint(offset + 20, 140),
      destinationPoint(offset + 90, 220),
      destinationPoint(offset + 180, 290)
    ])
  ]);
  const result = routeCore.planDestinationRoute(raw, destinationPoint(offset + 2, 4), destinationPoint(offset + 178, 288), { minRouteM: 20 });
  assert.equal(result.ok, true);
  return result.route;
}

function destinationContent() {
  return {
    source: 'destination-ui-timeline-test-content',
    buildings: [
      { id: 'academy-kitchen-pantry', label: 'Kitchen & Pantry', meaningful: true, nativeAction: { adapter: 'destinationNative', method: 'openKitchen' } }
    ],
    characters: [
      { id: 'merlin-waymark', name: 'Merlin', dialogue: ['Bring the walking tale home.'], meaningful: true, nativeAction: { adapter: 'destinationNative', method: 'speakMerlin' } }
    ]
  };
}

function destinationCatalogue() {
  return [
    { commonName: 'Robin', scientificName: 'Erithacus rubecula', rarity: 'common', habitats: ['garden'] }
  ];
}

function makeTimelineRoot() {
  return {
    profileId: 'profile-a',
    revision: 1,
    player: { xp: 0, level: 1, coins: 5 },
    inventory: { items: {} },
    discoveredSpecies: {}
  };
}

function makeTimelineAdapter(root, options = {}) {
  const attempts = { persist: 0, native: [], unlocks: [] };
  const failAt = new Set(options.failPersistAt || []);
  return {
    attempts,
    getProfileId: () => root.profileId,
    getRevision: () => root.revision,
    snapshot: value => JSON.parse(JSON.stringify(value)),
    restore: (target, before) => stateCore._restoreTree(target, before),
    persist: () => {
      attempts.persist += 1;
      if (failAt.has(attempts.persist)) return { ok: false, error: new Error('storage blocked') };
      root.revision += 1;
      return { ok: true };
    },
    applyPlayerXpState: amount => { root.player.xp += amount; },
    addCoinsState: amount => { root.player.coins += amount; },
    addLootState: loot => {
      for (const item of loot || []) root.inventory.items[item.id] = (root.inventory.items[item.id] || 0) + item.qty;
    },
    isSpeciesUnlocked: species => !!root.discoveredSpecies[stateCore.speciesKey(species)],
    unlockSpeciesForDestination: (species, meta) => {
      attempts.unlocks.push({ species, meta });
      root.discoveredSpecies[stateCore.speciesKey(species)] = { species, commonName: species, meta };
      return { unlocked: true };
    }
  };
}

function beginTimelineQuest(root, adapter, seed = 1, options = {}) {
  const route = destinationRoute(seed);
  const quote = rewardCore.quoteDestinationReward({ distanceM: route.lengthM }, { available: false, reason: 'fixture neutral', ascentM: 0, descentM: 0 }, { difficulty: 'normal' });
  const built = stateCore.buildDestinationRecord({
    route,
    quote,
    content: destinationContent(),
    catalogue: destinationCatalogue(),
    context: { habitats: ['garden'], month: 9 },
    idSeed: 'timeline-ui-' + seed,
    commonBirdCount: options.commonBirdCount || 3,
    areaBirdsCore: { rank: rows => rows },
    routeCore,
    rewardCore,
    now: 1790000000000 + seed
  });
  assert.equal(built.ok, true);
  const begun = stateCore.beginDestinationQuest(root, built.record, adapter, { expectedProfileId: root.profileId, expectedRevision: root.revision, now: 1790000000100 + seed });
  assert.equal(begun.status, 'committed');
  return root.destinationQuests.active;
}

test('destination UI modules are registered as the Main Quest surface', () => {
  for (const file of [
    'destination_route_core.js',
    'destination_elevation_core.js',
    'destination_reward_core.js',
    'destination_state_core.js',
    'destination_quest_ui.js',
    'destination_quest_ui.css'
  ]) {
    assert.ok(new RegExp(file.replace('.', '\\.') + '\\?v=' + (['destination_quest_ui.js','destination_quest_ui.css','destination_route_core.js'].includes(file)?'walk-planner-v495-20260926':file==='destination_state_core.js'?'quest-revisit-v457-20260923':'destination-cleanup-v434-20260921')).test(INDEX), file + ' index pin');
    assert.ok(new RegExp('\\./' + file.replace('.', '\\.') + '\\?v=' + (['destination_quest_ui.js','destination_quest_ui.css','destination_route_core.js'].includes(file)?'walk-planner-v495-20260926':file==='destination_state_core.js'?'quest-revisit-v457-20260923':'destination-cleanup-v434-20260921')).test(SW), file + ' service worker pin');
    assert.ok(UPDATER.includes('"' + file + '"'), file + ' updater pin');
  }
  assert.ok(/id="mapQuestShowBtn"[\s\S]*Main Quests/.test(INDEX), 'map primary quest entry should say Main Quests');
  assert.ok(/id="mapSideQuestBtn"[\s\S]*Side Quests/.test(INDEX), 'old walking entry remains Side Quests');
  assert.ok(/BurbzDestinationQuestUI\.attach\(/.test(INDEX), 'index constructs extracted destination controller');
  assert.ok(/__burbzDestinationDebug/.test(INDEX), 'browser evidence hook is exposed');
});

test('destination planner cancels stale async previews and banks only the current plan', async () => {
  const ui = require('../destination_quest_ui.js');
  assert.equal(typeof ui.createPlannerController, 'function');

  let routeResolve;
  const routeCalls = [];
  const fakeRoute = {
    fetchDestinationRoute(start, end, opts) {
      routeCalls.push({ start, end, opts });
      return new Promise(resolve => { routeResolve = resolve; });
    },
    distance() { return 100; }
  };
  const fakeElevation = {
    async sampleRouteElevation() {
      return { available: false, reason: 'fixture DEM down', ascentM: 0, descentM: 0, provenance: { provider: 'fixture' } };
    }
  };
  const fakeReward = {
    quoteDestinationReward(metrics, elevation) {
      return {
        version: 1,
        xp: 42,
        coins: 9,
        loot: [{ id: 'garden_worms', qty: 1 }],
        difficulty: { label: 'moderate', distanceKm: metrics.distanceM / 1000 },
        elevation: { status: elevation.available ? 'measured' : 'unavailable', reason: elevation.reason }
      };
    },
    deserializeQuote(value) {
      return typeof value === 'string' ? JSON.parse(value) : value;
    }
  };
  const beginCalls = [];
  const fakeState = {
    buildDestinationRecord(input) {
      return { ok: true, record: { id: 'dq-current', route: input.route, quote: input.quote, entries: [{ id: 'entry-a', kind: 'building' }] } };
    },
    stageDestinationPreview(root, record, opts) {
      root.destinationQuests = root.destinationQuests || { previews: {} };
      root.destinationQuests.previews[opts.previewId] = { record, generation: opts.generation };
      root.destinationQuests.currentPreviewId = opts.previewId;
      return { ok: true, preview: root.destinationQuests.previews[opts.previewId] };
    },
    cancelDestinationPreview(root, previewId) {
      if (root.destinationQuests && root.destinationQuests.previews[previewId]) {
        root.destinationQuests.previews[previewId].cancelled = true;
        if (root.destinationQuests.currentPreviewId === previewId) root.destinationQuests.currentPreviewId = null;
      }
      return { ok: true };
    },
    beginDestinationQuest(root, record, adapter, guard) {
      beginCalls.push({ record, guard });
      root.destinationQuests.active = { id: record.id, phase: 'active', entries: record.entries };
      return { status: 'committed', value: { questId: record.id } };
    }
  };
  const rootState = { photoProfileId: 'profile-a', saveRevision: 3 };
  const statuses = [];
  const controller = ui.createPlannerController({
    rootState: () => rootState,
    profileId: () => 'profile-a',
    revision: () => 3,
    routeCore: fakeRoute,
    elevationCore: fakeElevation,
    rewardCore: fakeReward,
    stateCore: fakeState,
    saveAdapter: {},
    content: {
      buildings: [{ id: 'study', label: 'Wayside Study', meaningful: true, nativeAction: { adapter: 'native', method: 'open' } }],
      characters: [{ id: 'rowan', name: 'Rowan', dialogue: ['Walk well.'], meaningful: true, nativeAction: { adapter: 'native', method: 'talk' } }]
    },
    catalogue: [{ commonName: 'Robin', rarity: 'common' }],
    onStatus: status => statuses.push(status)
  });

  controller.setManualStart('51.50695', '-0.16440');
  controller.setManualEnd('51.50705', '-0.16370');
  const stale = controller.preview();
  controller.cancel();
  routeResolve({
    ok: true,
    route: {
      kind: 'destination-route',
      lengthM: 55,
      points: [{ lat: 51.50695, lon: -0.1644 }, { lat: 51.50705, lon: -0.1637 }],
      provider: { endpoint: 'fixture', bodyHash: 'fnv1a-test' }
    }
  });
  await stale;
  assert.equal(controller.state().preview, null, 'late cancelled preview must not repaint');
  assert.equal(beginCalls.length, 0, 'late cancelled preview must not become begin-able');

  const current = controller.preview();
  routeResolve({
    ok: true,
    route: {
      kind: 'destination-route',
      lengthM: 55,
      points: [{ lat: 51.50695, lon: -0.1644 }, { lat: 51.50705, lon: -0.1637 }],
      provider: { endpoint: 'fixture', bodyHash: 'fnv1a-test-2' }
    }
  });
  const preview = await current;
  assert.equal(preview.ok, true);
  assert.equal(preview.quote.elevation.status, 'unavailable');
  assert.equal(preview.route.points.length, 2);
  const begin = controller.begin();
  assert.equal(begin.status, 'committed');
  assert.equal(rootState.destinationQuests.active.id, 'dq-current');
  assert.equal(beginCalls.length, 1);
  assert.ok(statuses.some(status => status && status.code === 'preview-ready'));
});

test('destination timeline controller finishes, reviews, unlocks and pays through canonical state', () => {
  const ui = require('../destination_quest_ui.js');
  assert.equal(typeof ui.createTimelineController, 'function');
  const root = makeTimelineRoot();
  const adapter = makeTimelineAdapter(root);
  const active = beginTimelineQuest(root, adapter, 2);
  const nativeCalls = [];
  const controller = ui.createTimelineController({
    rootState: () => root,
    profileId: state => state.profileId,
    revision: state => state.revision,
    stateCore,
    saveAdapter: adapter,
    nativeHandlers: {
      openKitchen: (entry, payload) => nativeCalls.push({ method: 'openKitchen', entryId: entry.id, payload }),
      speakMerlin: (entry, payload) => nativeCalls.push({ method: 'speakMerlin', entryId: entry.id, payload }),
      meetCommonSpecies: (entry, payload) => nativeCalls.push({ method: 'meetCommonSpecies', entryId: entry.id, payload })
    }
  });

  assert.deepEqual(controller.entries().map(entry => entry.id), active.entries.map(entry => entry.id));
  const finish = controller.finishWalk({ confirmed: true, gpsTicks: 0, usedSuggestedTrack: false });
  assert.equal(finish.status, 'committed');
  assert.equal(root.destinationQuests.active.phase, 'review');
  assert.equal(root.destinationQuests.active.finish.requiresGpsArrival, false);

  const building = root.destinationQuests.active.entries.find(entry => entry.kind === 'building');
  const buildingResult = controller.openEntry(building.id, { choiceId: 'open-room' });
  assert.equal(buildingResult.status, 'committed');
  assert.equal(nativeCalls.at(-1).method, 'openKitchen');
  const persistAfterBuilding = adapter.attempts.persist;
  const duplicateBuilding = controller.openEntry(building.id, { choiceId: 'open-again' });
  assert.equal(duplicateBuilding.status, 'duplicate');
  assert.equal(adapter.attempts.persist, persistAfterBuilding);
  assert.equal(nativeCalls.filter(call => call.entryId === building.id).length, 2);

  const birds = root.destinationQuests.active.entries.filter(entry => entry.kind === 'bird');
  assert.equal(birds.length, 3);
  assert.equal(controller.openEntry(birds[0].id, { choiceId: 'meet-1' }).value.meeting.count, 1);
  assert.equal(controller.openEntry(birds[1].id, { choiceId: 'meet-2' }).value.meeting.count, 2);
  const third = controller.openEntry(birds[2].id, { choiceId: 'meet-3' });
  assert.equal(third.status, 'committed');
  assert.equal(third.value.meeting.eligibleForUnlock, true);
  assert.equal(adapter.attempts.unlocks.length, 1);
  assert.equal(!!root.discoveredSpecies.robin, true);

  const quote = JSON.parse(JSON.stringify(root.destinationQuests.active.quote));
  const beforePay = { xp: root.player.xp, coins: root.player.coins, loot: Object.assign({}, root.inventory.items) };
  const complete = controller.completeQuest({ confirmed: true });
  assert.equal(complete.status, 'committed');
  assert.equal(root.destinationQuests.active, null);
  assert.equal(root.destinationQuests.archive.length, 1);
  assert.equal(root.player.xp - beforePay.xp, quote.xp);
  assert.equal(root.player.coins - beforePay.coins, quote.coins);
  for (const item of quote.loot) {
    assert.equal((root.inventory.items[item.id] || 0) - (beforePay.loot[item.id] || 0), item.qty);
  }
  assert.equal(controller.completeQuest({ confirmed: true, questId: root.destinationQuests.archive[0].id }).status, 'duplicate');
  assert.equal(root.player.xp - beforePay.xp, quote.xp);
  assert.equal(root.player.coins - beforePay.coins, quote.coins);
});

test('destination timeline controller blocks native side effects on failed save and retries once', () => {
  const ui = require('../destination_quest_ui.js');
  assert.equal(typeof ui.createTimelineController, 'function');
  const root = makeTimelineRoot();
  const adapter = makeTimelineAdapter(root, { failPersistAt: [2, 4, 6] });
  beginTimelineQuest(root, adapter, 3);
  const nativeCalls = [];
  const controller = ui.createTimelineController({
    rootState: () => root,
    profileId: state => state.profileId,
    revision: state => state.revision,
    stateCore,
    saveAdapter: adapter,
    nativeHandlers: {
      openKitchen: entry => nativeCalls.push(entry.id),
      meetCommonSpecies: entry => nativeCalls.push(entry.id)
    }
  });

  const failedFinish = controller.finishWalk({ confirmed: true, gpsTicks: 0 });
  assert.equal(failedFinish.status, 'failed');
  assert.equal(root.destinationQuests.active.phase, 'active');
  assert.equal(controller.finishWalk({ confirmed: true, gpsTicks: 0 }).status, 'committed');

  const entry = root.destinationQuests.active.entries.find(item => item.kind === 'building');
  const failedEntry = controller.openEntry(entry.id, { choiceId: 'open-room' });
  assert.equal(failedEntry.status, 'failed');
  assert.equal(nativeCalls.length, 0);
  assert.equal(root.destinationQuests.active.receipts.encounters[entry.id], undefined);
  assert.equal(controller.openEntry(entry.id, { choiceId: 'open-room' }).status, 'committed');
  assert.deepEqual(nativeCalls, [entry.id]);

  const quote = root.destinationQuests.active.quote;
  const beforePay = { xp: root.player.xp, coins: root.player.coins };
  const failedComplete = controller.completeQuest({ confirmed: true });
  assert.equal(failedComplete.status, 'failed');
  assert.equal(root.destinationQuests.active.phase, 'review');
  assert.equal(root.player.xp, beforePay.xp);
  assert.equal(root.player.coins, beforePay.coins);
  assert.equal(controller.completeQuest({ confirmed: true }).status, 'committed');
  assert.equal(root.player.xp - beforePay.xp, quote.xp);
  assert.equal(root.player.coins - beforePay.coins, quote.coins);
});

test('destination timeline controller shares during-walk receipts and unlocks across quests', () => {
  const ui = require('../destination_quest_ui.js');
  const root = makeTimelineRoot();
  const adapter = makeTimelineAdapter(root);
  beginTimelineQuest(root, adapter, 4, { commonBirdCount: 2 });
  const nativeCalls = [];
  const controller = ui.createTimelineController({
    rootState: () => root,
    profileId: state => state.profileId,
    revision: state => state.revision,
    stateCore,
    saveAdapter: adapter,
    nativeHandlers: { meetCommonSpecies: entry => nativeCalls.push(entry.id) }
  });
  const firstWalkBirds = root.destinationQuests.active.entries.filter(entry => entry.kind === 'bird');
  assert.equal(firstWalkBirds.length, 2);
  // Active interactions now require a genuine nearby fix (simulated here).
  stateCore.observeDestinationEncounters(root, { ...firstWalkBirds[0].route, accuracy:5, at:Date.now() }, adapter);
  const duringWalk = controller.openEntry(firstWalkBirds[0].id, { choiceId: 'during-walk-meet', phase: 'active' });
  assert.equal(duringWalk.status, 'committed');
  assert.equal(duringWalk.value.phase, 'active');
  assert.equal(duringWalk.value.meeting.count, 1);
  assert.equal(controller.finishWalk({ confirmed: true, gpsTicks: 0 }).status, 'committed');
  const reviewDuplicate = controller.openEntry(firstWalkBirds[0].id, { choiceId: 'review-meet' });
  assert.equal(reviewDuplicate.status, 'duplicate');
  assert.equal(root.destinationQuests.meetings.robin.encounterIds.length, 1);
  const secondFirstWalk = controller.openEntry(firstWalkBirds[1].id, { choiceId: 'review-second' });
  assert.equal(secondFirstWalk.status, 'committed');
  assert.equal(secondFirstWalk.value.meeting.count, 2);
  assert.equal(controller.completeQuest({ confirmed: true }).status, 'committed');
  assert.equal(adapter.attempts.unlocks.length, 0);

  beginTimelineQuest(root, adapter, 5, { commonBirdCount: 1 });
  const secondController = ui.createTimelineController({
    rootState: () => root,
    profileId: state => state.profileId,
    revision: state => state.revision,
    stateCore,
    saveAdapter: adapter,
    nativeHandlers: { meetCommonSpecies: entry => nativeCalls.push(entry.id) }
  });
  const thirdWalkBird = root.destinationQuests.active.entries.find(entry => entry.kind === 'bird');
  stateCore.observeDestinationEncounters(root, { ...thirdWalkBird.route, accuracy:5, at:Date.now() }, adapter);
  const third = secondController.openEntry(thirdWalkBird.id, { choiceId: 'third-walk-meet', phase: 'active' });
  assert.equal(third.status, 'committed');
  assert.equal(third.value.meeting.count, 3);
  assert.equal(third.value.meeting.eligibleForUnlock, true);
  assert.equal(adapter.attempts.unlocks.length, 1);
  assert.equal(root.destinationQuests.meetings.robin.encounterIds.length, 3);
  assert.equal(new Set(root.destinationQuests.meetings.robin.encounterIds).size, 3);
});

test('planner rejects profile/reset changes during route or elevation and stale staged revision', async () => {
  const ui = require('../destination_quest_ui.js');
  const route = destinationRoute(12);
  for (const change of ['profile', 'reset', 'revision']) {
    let current = makeTimelineRoot(), resolve;
    const previous = current;
    const planner = ui.createPlannerController({
      rootState: () => current, routeCore: { ...routeCore, fetchDestinationRoute: () => new Promise(r => { resolve = r; }) },
      elevationCore: { sampleRouteElevation: async () => ({ available: false }) }, rewardCore, stateCore,
      content: destinationContent(), catalogue: destinationCatalogue(), saveAdapter: makeTimelineAdapter(current)
    });
    planner.setManualStart(51.5, -.12); planner.setManualEnd(51.502, -.12);
    const pending = planner.preview();
    if (change === 'profile') current = { ...makeTimelineRoot(), profileId: 'profile-b' };
    if (change === 'reset') current = makeTimelineRoot();
    if (change === 'revision') current.revision++;
    resolve({ ok: true, route });
    assert.equal((await pending).stale, true, change);
    assert.equal(current.destinationQuests, undefined, 'late route must not write new save');
    assert.equal(previous.destinationQuests, undefined, 'late route must not stage discarded save');
    assert.equal(planner.state().phase, 'cancelled');
  }
  const current = makeTimelineRoot();
  const planner = ui.createPlannerController({ rootState: () => current, routeCore: { ...routeCore, fetchDestinationRoute: async () => ({ ok: true, route }) },
    elevationCore: { sampleRouteElevation: async () => ({ available: false }) }, rewardCore, stateCore,
    content: destinationContent(), catalogue: destinationCatalogue(), saveAdapter: makeTimelineAdapter(current) });
  planner.setManualStart(51.5, -.12); planner.setManualEnd(51.502, -.12);
  assert.equal((await planner.preview()).ok, true);
  current.revision++;
  assert.equal(planner.begin().status, 'stale-revision');
  assert.equal(current.destinationQuests.active, null);
});

test('slow DEM falls back neutrally and cancellation releases pending preview without saving', async () => {
  const ui = require('../destination_quest_ui.js'), route = destinationRoute(13);
  const current = makeTimelineRoot();
  let demSignal;
  const options = { rootState: () => current, routeCore: { ...routeCore, fetchDestinationRoute: async () => ({ ok: true, route }) },
    elevationCore: { sampleRouteElevation: (_points, opts) => { demSignal = opts.signal; return new Promise(() => {}); } },
    elevationTimeoutMs: 20, rewardCore, stateCore, content: destinationContent(), catalogue: destinationCatalogue(), saveAdapter: makeTimelineAdapter(current) };
  const planner = ui.createPlannerController(options);
  planner.setManualStart(51.5, -.12); planner.setManualEnd(51.502, -.12);
  const preview = await planner.preview();
  assert.equal(preview.ok, true); assert.equal(preview.quote.elevation.status, 'unavailable');
  assert.equal(preview.quote.elevation.multiplier, 1); assert.match(preview.elevation.reason, /timed out/);
  assert.equal(demSignal.aborted, true);
  const second = planner.preview();
  await new Promise(resolve => setImmediate(resolve));
  planner.cancel('navigation');
  const outcome = await second;
  assert.equal(outcome.stale, true); assert.equal(demSignal.aborted, true);
  assert.equal(planner.state().pending, false); assert.equal(current.destinationQuests.active, null);
});

test('planner lifecycle removes map picking, async work, Main button and Escape listeners', () => {
  const ui = require('../destination_quest_ui.js');
  class Element extends EventTarget {
    constructor() { super(); this.dataset = {}; this.attrs = {}; this.isConnected = true; this.children = new Map(); this.all = new Map(); this.classes = new Set();
      this.classList = { add: v => this.classes.add(v), remove: v => this.classes.delete(v), contains: v => this.classes.has(v), toggle: (v,on) => on ? this.classes.add(v) : this.classes.delete(v) }; }
    setAttribute(k,v) { this.attrs[k] = v; } getAttribute(k) { return this.attrs[k]; }
    appendChild(node) { node.isConnected = true; } remove() { this.isConnected = false; } focus() { this.focused = true; }
    set innerHTML(value) { this.children.clear(); this.all.clear(); this.html = value;
      const pick = new Element(); pick.setAttribute('data-destination-pick', 'start'); this.all.set('[data-destination-pick]', [pick]); }
    querySelector(selector) { if (!this.children.has(selector)) this.children.set(selector,new Element()); return this.children.get(selector); }
    querySelectorAll(selector) { return this.all.get(selector) || []; }
  }
  const doc = new Element(), body = new Element(), button = new Element(); let sheet;
  doc.body = body; doc.getElementById = id => id === 'mapQuestShowBtn' ? button : null;
  doc.createElement = () => (sheet = new Element());
  const listeners = new Set(); let inspection = false;
  const map = { on: (_event, fn) => listeners.add(fn), off: (_event, fn) => listeners.delete(fn) };
  const current = makeTimelineRoot();
  const opts = { document: doc, rootState: () => current, getMap: () => map, setMapInspectionMode: v => { inspection = v; }, stateCore, routeCore, rewardCore };
  const controller = ui.attach(opts);
  button.dispatchEvent(new Event('click', { cancelable: true }));
  assert.equal(sheet.classList.contains('open'), true);
  sheet.querySelectorAll('[data-destination-pick]')[0].dispatchEvent(new Event('click'));
  assert.equal(listeners.size, 2); assert.equal(inspection, true); // map pick + persistent style restoration
  const esc = new Event('keydown', { cancelable: true }); Object.defineProperty(esc, 'key', { value: 'Escape' }); doc.dispatchEvent(esc);
  assert.equal(listeners.size, 1); assert.equal(inspection, false); // style restoration survives planner close assert.equal(sheet.classList.contains('open'), false);
  button.dispatchEvent(new Event('click', { cancelable: true }));
  sheet.querySelectorAll('[data-destination-pick]')[0].dispatchEvent(new Event('click'));
  const removed = sheet;
  controller.dispose(); controller.dispose();
  assert.equal(listeners.size, 0); assert.equal(removed.isConnected, false); assert.equal(button.dataset.destinationQuestWired, undefined);
  button.dispatchEvent(new Event('click', { cancelable: true }));
  assert.equal(sheet, removed, 'disposed Main listener must not open a replacement sheet');
  assert.equal(controller.openPlanner(), false);
  const replacement = ui.attach(opts);
  button.dispatchEvent(new Event('click', { cancelable: true }));
  assert.notEqual(sheet, removed); assert.equal(sheet.classList.contains('open'), true);
  replacement.dispose();
});
