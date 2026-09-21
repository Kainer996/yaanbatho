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

test('unavailable or stale native room never marks a building visited', async () => {
 const ui=require('../destination_quest_ui.js'),root=makeTimelineRoot(),adapter=makeTimelineAdapter(root);
 const active=beginTimelineQuest(root,adapter),entry=active.entries.find(e=>e.kind==='building');
 let resolve,ready=false,native=0;
 const controller=ui.createTimelineController({rootState:()=>root,profileId:s=>s.profileId,revision:s=>s.revision,stateCore,saveAdapter:adapter,
 prepareNative:()=>new Promise(r=>resolve=r),nativeHandlers:{openKitchen:()=>native++}});
 let pending=controller.openEntry(entry.id);assert.equal(active.receipts.encounters[entry.id],undefined);resolve(false);
 assert.equal((await pending).status,'native-unavailable');assert.equal(native,0);
 pending=controller.openEntry(entry.id);root.profileId='different-profile';resolve(true);
 assert.equal((await pending).status,'stale-native');assert.equal(active.receipts.encounters[entry.id],undefined);
 root.profileId='profile-a';pending=controller.openEntry(entry.id);resolve(true);
 assert.equal((await pending).status,'committed');assert.equal(native,1);assert(active.receipts.encounters[entry.id]);
});
