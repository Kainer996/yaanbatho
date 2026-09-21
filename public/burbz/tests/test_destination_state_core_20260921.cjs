const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const routeCore = require('../destination_route_core.js');
const rewards = require('../destination_reward_core.js');
const state = require('../destination_state_core.js');

function p(x, y) {
  return { lat: 51.5 + y / 111320, lon: -0.12 + x / 70000 };
}

function way(id, nodes, points, tags) {
  return {
    type: 'way',
    id,
    nodes,
    geometry: points,
    tags: Object.assign({ highway: 'footway', foot: 'yes', designation: 'public_footpath' }, tags || {})
  };
}

function osm(ways) {
  const elements = [];
  const nodes = new Map();
  for (const w of ways) {
    for (let i = 0; i < w.nodes.length; i++) {
      const id = String(w.nodes[i]);
      if (!nodes.has(id)) nodes.set(id, { type: 'node', id, lat: w.geometry[i].lat, lon: w.geometry[i].lon, tags: {} });
    }
    elements.push(w);
  }
  return { elements: [...nodes.values(), ...elements], osm3s: { timestamp_osm_base: '2026-09-21T12:00:00Z' } };
}

function routeA() {
  const raw = osm([
    way(10, [1, 2, 3, 4], [p(0, 0), p(0, 120), p(80, 200), p(160, 280)])
  ]);
  const result = routeCore.planDestinationRoute(raw, p(0, 4), p(158, 278), { minRouteM: 20 });
  assert.equal(result.ok, true);
  return result.route;
}

function routeB() {
  const raw = osm([
    way(20, [11, 12, 13, 14], [p(400, 0), p(420, 130), p(500, 220), p(610, 260)])
  ]);
  const result = routeCore.planDestinationRoute(raw, p(401, 3), p(608, 258), { minRouteM: 20 });
  assert.equal(result.ok, true);
  return result.route;
}

function quoteFor(route, ascentM = 0) {
  return rewards.quoteDestinationReward({ distanceM: route.lengthM }, { available: true, ascentM, descentM: 0 }, { difficulty: 'moderate' });
}

const content = {
  source: 'destination-state-test-content',
  buildings: [
    {
      id: 'wayside-study',
      label: 'Wayside Study',
      nativeAction: { adapter: 'destinationBuilding', method: 'openRoom', payload: { room: 'study' } },
      meaningful: true
    },
    {
      id: 'field-kitchen',
      label: 'Field Kitchen',
      nativeAction: { adapter: 'destinationBuilding', method: 'openRoom', payload: { room: 'kitchen' } },
      meaningful: true
    }
  ],
  characters: [
    {
      id: 'rowan-field-note',
      name: 'Rowan',
      dialogue: ['Mark what the path gives you, then bring the story home.'],
      nativeAction: { adapter: 'destinationCharacter', method: 'speak', payload: { character: 'rowan' } },
      meaningful: true
    },
    {
      id: 'merlin-waymark',
      name: 'Merlin',
      dialogue: ['A good walk is a spell with boots on.'],
      nativeAction: { adapter: 'destinationCharacter', method: 'speak', payload: { character: 'merlin' } },
      meaningful: true
    }
  ]
};

const catalogue = [
  {
    name: 'Robin',
    scientific: 'Erithacus rubecula',
    canonical: 'Erithacus rubecula',
    commonName: 'Robin',
    rarity: 'common',
    inRange: true,
    habitats: ['garden', 'woodland'],
    months: [9],
    recordKeys: ['erithacus rubecula']
  },
  {
    name: 'Goldcrest',
    scientific: 'Regulus regulus',
    canonical: 'Regulus regulus',
    commonName: 'Goldcrest',
    rarity: 'common',
    inRange: true,
    habitats: ['woodland'],
    months: [9],
    recordKeys: ['regulus regulus']
  }
];

const context = { habitats: ['garden', 'woodland'], month: 9 };

function buildPlan(overrides = {}) {
  const route = overrides.route || routeA();
  return state.buildDestinationRecord({
    route,
    quote: overrides.quote || quoteFor(route),
    content: overrides.content || content,
    catalogue: overrides.catalogue || catalogue,
    context: overrides.context || context,
    now: overrides.now || 1790000000000,
    idSeed: overrides.idSeed || 'state-test-a',
    commonBirdCount: overrides.commonBirdCount || 1
  });
}

function makeRoot() {
  return {
    profileId: 'profile-a',
    revision: 7,
    player: { xp: 0, level: 1, coins: 10 },
    inventory: { items: {}, gear: {}, larder: {} },
    discoveredSpecies: {},
    tavernPatrons: [],
    walkingQuests: { active: { id: 'legacy-walk', checkpoints: [{ id: 'old', reached: false }] }, history: [] },
    sideQuest: { active: null, history: [] },
    walkingStories: { completed: [], scrolls: [] }
  };
}

function makeAdapter(root, options = {}) {
  const attempts = { persist: 0, unlocks: [] };
  const failAt = new Set(options.failPersistAt || []);
  const throwAt = new Set(options.throwPersistAt || []);
  return {
    attempts,
    getProfileId: s => s.profileId,
    getRevision: s => s.revision,
    snapshot: s => JSON.parse(JSON.stringify(s)),
    persist: () => {
      attempts.persist += 1;
      if (options.failPersistOnce && attempts.persist === 1 || failAt.has(attempts.persist)) return { ok: false, error: new Error('storage unavailable') };
      if (options.throwPersistOnce && attempts.persist === 1 || throwAt.has(attempts.persist)) throw new Error('storage exploded');
      root.revision += 1;
      return { ok: true };
    },
    applyPlayerXpState: amount => {
      root.player.xp += amount;
    },
    addCoinsState: amount => {
      root.player.coins += amount;
    },
    addLootState: loot => {
      for (const item of loot || []) root.inventory.items[item.id] = (root.inventory.items[item.id] || 0) + item.qty;
    },
    isSpeciesUnlocked: species => !!root.discoveredSpecies[state.speciesKey(species)],
    unlockSpeciesForDestination: (species, meta) => {
      attempts.unlocks.push({ species, meta });
      root.discoveredSpecies[state.speciesKey(species)] = {
        key: state.speciesKey(species),
        species,
        commonName: species,
        source: 'destination-meeting',
        meta
      };
      root.tavernPatrons.push({ key: state.speciesKey(species), species, metAt: meta && meta.at });
      return { unlocked: true };
    }
  };
}

function refs(root) {
  return {
    destinationQuests: root.destinationQuests,
    active: root.destinationQuests && root.destinationQuests.active,
    archive: root.destinationQuests && root.destinationQuests.archive,
    meetings: root.destinationQuests && root.destinationQuests.meetings,
    receipts: root.destinationQuests && root.destinationQuests.receipts,
    player: root.player,
    inventory: root.inventory,
    walkingQuests: root.walkingQuests
  };
}

function assertRefsSame(root, before) {
  assert.equal(root.destinationQuests, before.destinationQuests, 'destinationQuests reference changed');
  assert.equal(root.destinationQuests.active, before.active, 'active destination reference changed');
  assert.equal(root.destinationQuests.archive, before.archive, 'archive reference changed');
  assert.equal(root.destinationQuests.meetings, before.meetings, 'meetings reference changed');
  assert.equal(root.destinationQuests.receipts, before.receipts, 'receipts reference changed');
  assert.equal(root.player, before.player, 'player reference changed');
  assert.equal(root.inventory, before.inventory, 'inventory reference changed');
  assert.equal(root.walkingQuests, before.walkingQuests, 'legacy walkingQuests reference changed');
}

function extractIndexFunction(name) {
  const source = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = source.indexOf('function ' + name + '(');
  assert.notEqual(start, -1, 'missing index helper ' + name);
  const brace = source.indexOf('{', source.indexOf(')', start));
  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i++) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === '*' && next === '/') {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '/' && next === '/') {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === '/' && next === '*') {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === '\'' || ch === '"' || ch === '`') {
      quote = ch;
      continue;
    }
    if (ch === '{') depth += 1;
    else if (ch === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error('Could not extract helper ' + name);
}

function makeExtractedDiscoveryApi(failFirstDurable = false) {
  const gameState = makeRoot();
  gameState.quests = { discover_one: { progress: 0, claimed: false } };
  let durableSaves = 0;
  let hiddenSaves = 0;
  let effectRuns = 0;
  let fail = failFirstDurable;
  const context = {
    gameState,
    DAILY_QUESTS: [{ id: 'discover_one', type: 'discover', target: 1, name: 'Discover one' }],
    WEEKLY_QUESTS: [],
    ACHIEVEMENT_QUESTS: [],
    currentScreen: 'home',
    speciesKey: state.speciesKey,
    canonicalSpeciesName: species => String(species || ''),
    getDiscoveredRecordForSpecies: species => gameState.discoveredSpecies[state.speciesKey(species)] || null,
    companionForSpecies: () => null,
    nextDiscoverySightingCount: existing => (existing && existing.sightingCount || 0) + 1,
    recruitCostForBird: () => 5,
    getBirdArtUrl: () => null,
    discoveryKeysForSpecies: species => [state.speciesKey(species)],
    discoveryRewardForBird: () => 3,
    addCoins: amount => { gameState.player.coins += amount; },
    logDiary: () => {},
    activePlayerQuest: () => null,
    syncActivePlayerQuest: () => {},
    showToast: () => {},
    renderPlayerQuests: () => {},
    queueActionBadgeUpdate: () => {},
    saveState: () => { hiddenSaves += 1; return { ok: true }; },
    queueQuestCompleteNotice: (_quest, deferredEffects) => {
      const effect = () => { effectRuns += 1; };
      if (deferredEffects) deferredEffects.push(effect);
      else effect();
    }
  };
  vm.createContext(context);
  vm.runInContext(extractIndexFunction('updateQuestProgress') + '\n' + extractIndexFunction('rememberDiscoveredBird'), context);
  return {
    gameState,
    rememberDiscoveredBird: context.rememberDiscoveredBird,
    getDiscoveredRecordForSpecies: context.getDiscoveredRecordForSpecies,
    snapshotGameState: () => JSON.parse(JSON.stringify(gameState)),
    restoreGameStateSnapshot: before => state._restoreTree(gameState, before),
    durableSaveState: () => {
      durableSaves += 1;
      if (fail) {
        fail = false;
        return { ok: false, error: new Error('durable write failed') };
      }
      gameState.revision += 1;
      return { ok: true };
    },
    applyPlayerXpState: amount => { gameState.player.xp += amount; },
    addCoins: amount => { gameState.player.coins += amount; },
    counters: () => ({ durableSaves, hiddenSaves, effectRuns })
  };
}

test('complete predeparture plan is route-linked, versioned, nonempty and serializable', () => {
  const first = buildPlan({ idSeed: 'shape-a', route: routeA(), commonBirdCount: 2 });
  const second = buildPlan({ idSeed: 'shape-b', route: routeB(), commonBirdCount: 1 });
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.equal(first.record.schemaVersion, state.VERSION);
  assert.equal(first.record.phase, 'planned');
  assert.equal(routeCore.validateDestinationRoute(first.record.route).valid, true);
  assert.deepEqual(first.record.quote, rewards.deserializeQuote(JSON.stringify(first.record.quote)));
  const categories = first.record.entries.reduce((acc, e) => (acc[e.kind] = (acc[e.kind] || 0) + 1, acc), {});
  assert.equal(categories.building >= 1, true);
  assert.equal(categories.character >= 1, true);
  assert.equal(categories.bird >= 1, true);
  assert(first.record.entries.every(e => e.id && Number.isFinite(e.route.distanceM) && e.route.distanceM >= 0));
  assert(first.record.entries.every(e => e.route.fraction >= 0 && e.route.fraction <= 1));
  assert(first.record.entries.every(e => e.route.sourceSegment && Number.isInteger(e.route.sourceSegment.index)));
  assert(first.record.entries.every(e => e.generatedGameEncounter === true));
  assert(first.record.entries.every(e => e.observedRealWorld === false));
  assert(first.record.entries.every((entry, index, list) => !index || list[index - 1].route.distanceM <= entry.route.distanceM));
  assert.equal(first.record.contentSources.commonBirdPool, 'BurbzAreaBirdsCore.rank');
  assert.equal(first.record.contentSources.buildings, content.source);
  assert.equal(first.record.contentSources.characters, content.source);
  const roundTrip = state.sanitizeDestinationState(JSON.parse(JSON.stringify({ version: state.VERSION, active: first.record, archive: [], previews: {}, meetings: {}, receipts: {} })));
  assert.equal(roundTrip.active.entries.length, first.record.entries.length);
  assert.equal(roundTrip.active.route.routeFingerprint, first.record.route.routeFingerprint);
  const birdIds = first.record.entries.filter(e => e.kind === 'bird').map(e => e.id)
    .concat(second.record.entries.filter(e => e.kind === 'bird').map(e => e.id));
  assert.equal(new Set(birdIds).size, birdIds.length);
});

test('invalid or incomplete content never begins as an empty destination plan', () => {
  assert.equal(buildPlan({ content: { ...content, buildings: [] } }).ok, false);
  assert.equal(buildPlan({ content: { ...content, characters: [] } }).ok, false);
  assert.equal(buildPlan({ catalogue: [] }).ok, false);
  assert.match(buildPlan({ content: { ...content, buildings: [{ id: 'label-only', label: 'Label only' }] } }).error.message, /building/i);
});

test('phase transitions keep zero-GPS review availability and require explicit archived completion', () => {
  const root = makeRoot();
  const adapter = makeAdapter(root);
  const plan = buildPlan({ commonBirdCount: 2 }).record;
  const begun = state.beginDestinationQuest(root, plan, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 1790000001000 });
  assert.equal(begun.status, 'committed');
  assert.equal(root.destinationQuests.active.phase, 'active');
  assert.equal(root.destinationQuests.active.entries.length, plan.entries.length);
  const finished = state.finishDestinationWalk(root, adapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 1790000002000, gpsTicks: 0, usedSuggestedTrack: false });
  assert.equal(finished.status, 'committed');
  assert.equal(root.destinationQuests.active.phase, 'review');
  assert.equal(root.destinationQuests.active.finish.gpsTicks, 0);
  assert.deepEqual(state.reviewEntries(root).map(e => e.id), plan.entries.map(e => e.id));
  state.advanceTime(root, 1000 * 60 * 60 * 24 * 40);
  assert.equal(root.destinationQuests.active.phase, 'review');
  assert.equal(root.destinationQuests.archive.length, 0);
  const completed = state.completeDestinationQuest(root, adapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 1790000003000 });
  assert.equal(completed.status, 'committed');
  assert.equal(root.destinationQuests.active, null);
  assert.equal(root.destinationQuests.archive.length, 1);
  assert.equal(root.destinationQuests.archive[0].phase, 'completed');
  assert.equal(root.destinationQuests.archive[0].entries.length, plan.entries.length);
  const coinsAfter = root.player.coins;
  const xpAfter = root.player.xp;
  const duplicate = state.completeDestinationQuest(root, adapter, { expectedProfileId: 'profile-a', expectedRevision: 10, questId: root.destinationQuests.archive[0].id, now: 1790000004000 });
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(root.player.coins, coinsAfter);
  assert.equal(root.player.xp, xpAfter);
});

test('encounter receipts survive reload and cannot count during-walk plus review twice', () => {
  const root = makeRoot();
  const adapter = makeAdapter(root);
  const plan = buildPlan({ commonBirdCount: 2 }).record;
  state.beginDestinationQuest(root, plan, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 1 });
  const bird = root.destinationQuests.active.entries.find(e => e.kind === 'bird');
  const building = root.destinationQuests.active.entries.find(e => e.kind === 'building');
  const first = state.applyDestinationEncounter(root, bird.id, { choiceId: 'greet', phase: 'active' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 2 });
  assert.equal(first.status, 'committed');
  assert.equal(first.value.meeting.counted, true);
  const serialized = JSON.parse(JSON.stringify(root));
  Object.assign(root, serialized);
  const duplicate = state.applyDestinationEncounter(root, bird.id, { choiceId: 'greet-again', phase: 'review' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 3 });
  assert.equal(duplicate.status, 'duplicate');
  assert.equal(root.destinationQuests.meetings[state.speciesKey(bird.species)].encounterIds.length, 1);
  const buildResult = state.applyDestinationEncounter(root, building.id, { choiceId: 'open' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 4 });
  assert.equal(buildResult.status, 'committed');
  const secondBuild = state.applyDestinationEncounter(root, building.id, { choiceId: 'open-again' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 10, now: 5 });
  assert.equal(secondBuild.status, 'duplicate');
});

test('transactions roll back references and retry cleanly on persist failure, callback throw and stale guards', () => {
  const root = makeRoot();
  const plan = buildPlan().record;
  const adapter = makeAdapter(root, { failPersistOnce: true });
  const playerRef = root.player;
  const walkingRef = root.walkingQuests;
  const failed = state.beginDestinationQuest(root, plan, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 10 });
  assert.equal(failed.status, 'failed');
  assert.equal(root.destinationQuests, undefined);
  assert.equal(root.player, playerRef);
  assert.equal(root.walkingQuests, walkingRef);
  const retry = state.beginDestinationQuest(root, plan, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 11 });
  assert.equal(retry.status, 'committed');
  const beforeCoins = root.player.coins;
  const thrown = state.applyDestinationEncounter(root, root.destinationQuests.active.entries[0].id, { throwBeforeReceipt: true }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 12 });
  assert.equal(thrown.status, 'failed');
  assert.equal(root.player, playerRef);
  assert.equal(root.player.coins, beforeCoins);
  const stale = state.finishDestinationWalk(root, adapter, { expectedProfileId: 'profile-b', expectedRevision: root.revision, now: 13 });
  assert.equal(stale.status, 'stale-profile');
  assert.equal(root.destinationQuests.active.phase, 'active');
  assert.equal(adapter.attempts.persist, 2);
});

test('failed encounter, finish, completion and stale guards preserve exact destination references', () => {
  const encounterRoot = makeRoot();
  const encounterAdapter = makeAdapter(encounterRoot);
  const encounterPlan = buildPlan().record;
  assert.equal(state.beginDestinationQuest(encounterRoot, encounterPlan, encounterAdapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 20 }).status, 'committed');
  const encounterBefore = refs(encounterRoot);
  const encounterEntry = encounterRoot.destinationQuests.active.entries[0];
  const encounterFailed = state.applyDestinationEncounter(encounterRoot, encounterEntry.id, { throwBeforeReceipt: true }, encounterAdapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 21 });
  assert.equal(encounterFailed.status, 'failed');
  assertRefsSame(encounterRoot, encounterBefore);

  const finishRoot = makeRoot();
  const finishAdapter = makeAdapter(finishRoot, { failPersistAt: [2] });
  assert.equal(state.beginDestinationQuest(finishRoot, buildPlan({ idSeed: 'finish-ref' }).record, finishAdapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 30 }).status, 'committed');
  const finishBefore = refs(finishRoot);
  const finishFailed = state.finishDestinationWalk(finishRoot, finishAdapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 31 });
  assert.equal(finishFailed.status, 'failed');
  assertRefsSame(finishRoot, finishBefore);
  const finishRetry = state.finishDestinationWalk(finishRoot, finishAdapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 32 });
  assert.equal(finishRetry.status, 'committed');

  const completeRoot = makeRoot();
  const completeAdapter = makeAdapter(completeRoot, { failPersistAt: [3] });
  assert.equal(state.beginDestinationQuest(completeRoot, buildPlan({ idSeed: 'complete-ref' }).record, completeAdapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 40 }).status, 'committed');
  assert.equal(state.finishDestinationWalk(completeRoot, completeAdapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 41 }).status, 'committed');
  const completeBefore = refs(completeRoot);
  const coinsBefore = completeRoot.player.coins;
  const xpBefore = completeRoot.player.xp;
  const completeFailed = state.completeDestinationQuest(completeRoot, completeAdapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 42 });
  assert.equal(completeFailed.status, 'failed');
  assert.equal(completeRoot.player.coins, coinsBefore);
  assert.equal(completeRoot.player.xp, xpBefore);
  assertRefsSame(completeRoot, completeBefore);
  const completeRetry = state.completeDestinationQuest(completeRoot, completeAdapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 43 });
  assert.equal(completeRetry.status, 'committed');

  const staleRoot = makeRoot();
  const staleAdapter = makeAdapter(staleRoot);
  assert.equal(state.beginDestinationQuest(staleRoot, buildPlan({ idSeed: 'stale-ref' }).record, staleAdapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 50 }).status, 'committed');
  const staleBefore = refs(staleRoot);
  const staleFinish = state.finishDestinationWalk(staleRoot, staleAdapter, { expectedProfileId: 'profile-b', expectedRevision: 8, now: 51 });
  assert.equal(staleFinish.status, 'stale-profile');
  assertRefsSame(staleRoot, staleBefore);
  assert.equal(state.finishDestinationWalk(staleRoot, staleAdapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 52 }).status, 'committed');
  const staleCompleteBefore = refs(staleRoot);
  const staleComplete = state.completeDestinationQuest(staleRoot, staleAdapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 53 });
  assert.equal(staleComplete.status, 'stale-revision');
  assertRefsSame(staleRoot, staleCompleteBefore);
});

test('defensive loading preserves legacy state and rejects malformed destination records safely', () => {
  const legacy = makeRoot();
  const legacySnapshot = JSON.stringify({ walkingQuests: legacy.walkingQuests, sideQuest: legacy.sideQuest, player: legacy.player, discoveredSpecies: legacy.discoveredSpecies });
  const absent = state.sanitizeDestinationState(legacy.destinationQuests);
  assert.equal(absent.active, null);
  assert.equal(JSON.stringify({ walkingQuests: legacy.walkingQuests, sideQuest: legacy.sideQuest, player: legacy.player, discoveredSpecies: legacy.discoveredSpecies }), legacySnapshot);
  const validPlan = buildPlan().record;
  const valid = state.sanitizeDestinationState({ version: state.VERSION, active: validPlan, archive: [], previews: {}, meetings: {}, receipts: {} });
  assert.equal(valid.active.id, validPlan.id);
  const bad = state.sanitizeDestinationState({ version: state.VERSION, active: { id: 'bad', phase: 'active', entries: [] }, archive: [{ id: 'also-bad' }], previews: 'x', meetings: 'x' });
  assert.equal(bad.active, null);
  assert.deepEqual(bad.archive, []);
  assert.equal(bad.loadErrors.length >= 1, true);
});

test('three distinct same-species meetings across walks return canonical unlock eligibility only once', () => {
  const root = makeRoot();
  const adapter = makeAdapter(root);
  const one = buildPlan({ route: routeA(), idSeed: 'same-1', commonBirdCount: 2 }).record;
  const two = buildPlan({ route: routeB(), idSeed: 'same-2', commonBirdCount: 1 }).record;
  state.beginDestinationQuest(root, one, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 1 });
  const birdsOne = root.destinationQuests.active.entries.filter(e => e.kind === 'bird');
  assert.equal(state.applyDestinationEncounter(root, birdsOne[0].id, {}, adapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 2 }).value.meeting.eligibleForUnlock, false);
  assert.equal(state.applyDestinationEncounter(root, birdsOne[1].id, {}, adapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 3 }).value.meeting.eligibleForUnlock, false);
  state.finishDestinationWalk(root, adapter, { expectedProfileId: 'profile-a', expectedRevision: 10, now: 4 });
  state.completeDestinationQuest(root, adapter, { expectedProfileId: 'profile-a', expectedRevision: 11, now: 5 });
  state.beginDestinationQuest(root, two, adapter, { expectedProfileId: 'profile-a', expectedRevision: 12, now: 6 });
  const third = root.destinationQuests.active.entries.find(e => e.kind === 'bird');
  const unlocked = state.applyDestinationEncounter(root, third.id, {}, adapter, { expectedProfileId: 'profile-a', expectedRevision: 13, now: 7 });
  assert.equal(unlocked.status, 'committed');
  assert.equal(unlocked.value.meeting.eligibleForUnlock, true);
  assert.equal(adapter.attempts.unlocks.length, 1);
  assert.equal(root.destinationQuests.meetings[state.speciesKey(third.species)].encounterIds.length, 3);
  const repeat = state.applyDestinationEncounter(root, third.id, {}, adapter, { expectedProfileId: 'profile-a', expectedRevision: 14, now: 8 });
  assert.equal(repeat.status, 'duplicate');
  assert.equal(adapter.attempts.unlocks.length, 1);

  const already = makeRoot();
  already.discoveredSpecies[state.speciesKey(third.species)] = { species: third.species };
  const adapter2 = makeAdapter(already);
  state.beginDestinationQuest(already, buildPlan({ idSeed: 'already', commonBirdCount: 3 }).record, adapter2, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 1 });
  for (const entry of already.destinationQuests.active.entries.filter(e => e.kind === 'bird')) {
    state.applyDestinationEncounter(already, entry.id, {}, adapter2, { expectedProfileId: 'profile-a', expectedRevision: already.revision, now: 2 });
  }
  assert.equal(adapter2.attempts.unlocks.length, 0);
});

test('reentrant third same-species unlock cannot commit the same encounter twice', () => {
  const root = makeRoot();
  const adapter = makeAdapter(root);
  const plan = buildPlan({ idSeed: 'reentrant-third', commonBirdCount: 3 }).record;
  assert.equal(state.beginDestinationQuest(root, plan, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 60 }).status, 'committed');
  const birds = root.destinationQuests.active.entries.filter(e => e.kind === 'bird');
  assert.equal(birds.length >= 3, true);
  assert.equal(state.applyDestinationEncounter(root, birds[0].id, { choiceId: 'first' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 61 }).status, 'committed');
  assert.equal(state.applyDestinationEncounter(root, birds[1].id, { choiceId: 'second' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 62 }).status, 'committed');

  const nested = [];
  let attemptedReentry = false;
  adapter.unlockSpeciesForDestination = (species, meta) => {
    adapter.attempts.unlocks.push({ species, meta });
    if (!attemptedReentry) {
      attemptedReentry = true;
      nested.push(state.applyDestinationEncounter(root, birds[2].id, { choiceId: 'nested-reentry' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 10, now: 63 }));
    }
    root.discoveredSpecies[state.speciesKey(species)] = { key: state.speciesKey(species), species, commonName: species, source: 'destination-meeting', meta };
    return { unlocked: true, species, meta };
  };

  const third = state.applyDestinationEncounter(root, birds[2].id, { choiceId: 'outer' }, adapter, { expectedProfileId: 'profile-a', expectedRevision: 10, now: 63 });
  assert.equal(third.status, 'committed');
  assert.equal(nested.length, 1);
  assert.equal(nested[0].status, 'duplicate');
  assert.equal(adapter.attempts.unlocks.length, 1);
  assert.equal(root.destinationQuests.active.receipts.encounters[birds[2].id].choiceId, 'outer');
  assert.equal(root.destinationQuests.meetings[state.speciesKey(birds[2].species)].encounterIds.length, 3);
});

test('browser adapter uses deferred canonical discovery effects and fails closed without safe helper', () => {
  function makeBrowserRoot(failNextDurable = false) {
    const gameState = makeRoot();
    gameState.quests = { discover_one: { progress: 0, claimed: false } };
    let durableSaves = 0;
    let hiddenSaves = 0;
    let effectRuns = 0;
    let fail = failNextDurable;
    const apiRoot = {
      gameState,
      snapshotGameState: () => JSON.parse(JSON.stringify(gameState)),
      restoreGameStateSnapshot: before => state._restoreTree(gameState, before),
      durableSaveState: () => {
        durableSaves += 1;
        if (fail) {
          fail = false;
          return { ok: false, error: new Error('durable write failed') };
        }
        gameState.revision += 1;
        return { ok: true };
      },
      applyPlayerXpState: amount => { gameState.player.xp += amount; },
      addCoins: amount => { gameState.player.coins += amount; },
      getDiscoveredRecordForSpecies: species => gameState.discoveredSpecies[state.speciesKey(species)],
      rememberDiscoveredBird: (bird, opts = {}) => {
        const key = state.speciesKey(bird.species || bird.commonName);
        const isNew = !gameState.discoveredSpecies[key];
        gameState.discoveredSpecies[key] = { key, species: bird.species || bird.commonName, commonName: bird.commonName || bird.species };
        if (isNew) {
          gameState.quests.discover_one.progress += 1;
          if (opts.effects) opts.effects.push(() => { effectRuns += 1; });
          else hiddenSaves += 1;
        }
        return isNew;
      },
      counters: () => ({ durableSaves, hiddenSaves, effectRuns })
    };
    return apiRoot;
  }

  const apiRoot = makeBrowserRoot(true);
  const adapter = state.createBrowserAdapter(apiRoot);
  const plan = buildPlan({ idSeed: 'browser-deferred', commonBirdCount: 3, catalogue: [catalogue[0]] }).record;
  assert.equal(state.beginDestinationQuest(apiRoot.gameState, plan, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 70 }).status, 'failed');
  assert.equal(apiRoot.counters().hiddenSaves, 0);
  assert.equal(Object.keys(apiRoot.gameState.discoveredSpecies).length, 0);
  assert.equal(state.beginDestinationQuest(apiRoot.gameState, plan, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 71 }).status, 'committed');
  const birds = apiRoot.gameState.destinationQuests.active.entries.filter(e => e.kind === 'bird');
  assert.equal(state.applyDestinationEncounter(apiRoot.gameState, birds[0].id, {}, adapter, { expectedProfileId: 'profile-a', expectedRevision: 8, now: 72 }).status, 'committed');
  assert.equal(state.applyDestinationEncounter(apiRoot.gameState, birds[1].id, {}, adapter, { expectedProfileId: 'profile-a', expectedRevision: 9, now: 73 }).status, 'committed');
  const third = state.applyDestinationEncounter(apiRoot.gameState, birds[2].id, {}, adapter, { expectedProfileId: 'profile-a', expectedRevision: 10, now: 74 });
  assert.equal(third.status, 'committed');
  assert.equal(apiRoot.counters().hiddenSaves, 0);
  assert.equal(apiRoot.counters().effectRuns, 1);
  assert.equal(apiRoot.gameState.discoveredSpecies.robin.commonName, 'Robin');

  const unsafeRoot = { gameState: makeRoot(), durableSaveState: () => ({ ok: true }) };
  const unsafeAdapter = state.createBrowserAdapter(unsafeRoot);
  assert.throws(() => unsafeAdapter.unlockSpeciesForDestination('Robin', { source: 'test' }), /canonical deferred discovery/i);
  assert.deepEqual(unsafeRoot.gameState.discoveredSpecies, {});
});

test('browser adapter VM witness exercises extracted canonical discovery helper with deferred effects', () => {
  const failingApi = makeExtractedDiscoveryApi(true);
  const failingAdapter = state.createBrowserAdapter(failingApi);
  const failed = state._runTransaction(failingApi.gameState, failingAdapter, { expectedProfileId: 'profile-a', expectedRevision: 7 }, () => {
    return failingAdapter.unlockSpeciesForDestination('Robin', { source: 'vm-witness' });
  });
  assert.equal(failed.status, 'failed');
  assert.equal(failingApi.counters().hiddenSaves, 0);
  assert.equal(failingApi.counters().effectRuns, 0);
  assert.equal(Object.keys(failingApi.gameState.discoveredSpecies).length, 0);

  const apiRoot = makeExtractedDiscoveryApi(false);
  const adapter = state.createBrowserAdapter(apiRoot);
  const committed = state._runTransaction(apiRoot.gameState, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7 }, () => {
    return adapter.unlockSpeciesForDestination('Robin', { source: 'vm-witness' });
  });
  assert.equal(committed.status, 'committed');
  assert.equal(apiRoot.counters().durableSaves, 1);
  assert.equal(apiRoot.counters().hiddenSaves, 0);
  assert.equal(apiRoot.counters().effectRuns, 1);
  assert.equal(apiRoot.gameState.discoveredSpecies.robin.commonName, 'Robin');
  assert.equal(apiRoot.gameState.quests.discover_one.progress, 1);
});

test('cancelled previews, replaced previews and stale revisions cannot activate or overwrite active plans', () => {
  const root = makeRoot();
  const adapter = makeAdapter(root);
  const first = buildPlan({ idSeed: 'preview-1' }).record;
  const second = buildPlan({ idSeed: 'preview-2', route: routeB() }).record;
  const preview1 = state.stageDestinationPreview(root, first, { previewId: 'p1', generation: 1, profileId: 'profile-a', revision: 7, now: 1 });
  assert.equal(preview1.ok, true);
  assert.equal(state.cancelDestinationPreview(root, 'p1', { profileId: 'profile-a', revision: 7, now: 2 }).ok, true);
  const cancelled = state.beginDestinationQuest(root, first, adapter, { previewId: 'p1', expectedProfileId: 'profile-a', expectedRevision: 7, now: 3 });
  assert.equal(cancelled.status, 'preview-cancelled');
  state.stageDestinationPreview(root, first, { previewId: 'p2-old', generation: 2, profileId: 'profile-a', revision: 7, now: 4 });
  state.stageDestinationPreview(root, second, { previewId: 'p3-new', generation: 3, profileId: 'profile-a', revision: 7, now: 5 });
  const old = state.beginDestinationQuest(root, first, adapter, { previewId: 'p2-old', expectedProfileId: 'profile-a', expectedRevision: 7, now: 6 });
  assert.equal(old.status, 'preview-replaced');
  const begun = state.beginDestinationQuest(root, second, adapter, { previewId: 'p3-new', expectedProfileId: 'profile-a', expectedRevision: 7, now: 7 });
  assert.equal(begun.status, 'committed');
  const activeId = root.destinationQuests.active.id;
  const stale = state.beginDestinationQuest(root, first, adapter, { expectedProfileId: 'profile-a', expectedRevision: 7, now: 8 });
  assert.equal(stale.status, 'stale-revision');
  assert.equal(root.destinationQuests.active.id, activeId);
});

test('both existing mapped v1 and new guidance v2 quests survive save and any-path completion', () => {
  const raw=osm([way(90,[1,2],[p(0,0),p(300,0)])]);
  const mapped=routeCore.planMappedDestinationRoute(raw,p(0,0),p(300,0)).route;
  const guidance=routeCore.planDestinationRoute(null,p(0,0),p(300,100)).route;
  assert.equal(mapped.routeSchemaVersion,1);assert.equal(guidance.routeSchemaVersion,2);
  for(const route of [mapped,guidance]){
    const root=makeRoot(),adapter=makeAdapter(root),plan=buildPlan({route});assert(plan.ok);
    assert.equal(state.beginDestinationQuest(root,plan.record,adapter,{expectedProfileId:'profile-a',expectedRevision:7,now:1}).status,'committed');
    root.destinationQuests=state.sanitizeDestinationState(JSON.parse(JSON.stringify(root.destinationQuests)));
    assert.deepEqual(root.destinationQuests.active.route,route);
    assert.equal(state.finishDestinationWalk(root,adapter,{expectedProfileId:'profile-a',expectedRevision:8,now:2,gpsTicks:0,usedSuggestedTrack:false}).status,'committed');
    assert.equal(state.completeDestinationQuest(root,adapter,{expectedProfileId:'profile-a',expectedRevision:9,now:3}).status,'committed');
    assert.equal(root.player.coins,10+plan.record.quote.coins);
    const before=JSON.stringify(root);
    assert.equal(state.completeDestinationQuest(root,adapter,{questId:plan.record.id,expectedProfileId:'profile-a',expectedRevision:10,now:4}).status,'duplicate');
    assert.equal(JSON.stringify(root),before);
  }
});
