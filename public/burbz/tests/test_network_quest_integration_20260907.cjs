// Actual route/quest/encounter cores plus extracted production integration.
// GPS values and providers are simulated; no claim of an outdoor walk.
const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
global.window = global;
const R = require('../walking_route_core.js');
const E = require('../walking_encounter_core.js');
require('../quest_core.js');
const Q = global.BurbzQuestCore;
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const copy = value => JSON.parse(JSON.stringify(value));
const noop = () => {};
function source(name) {
  const match = new RegExp('^(?:async )?function ' + name + '\\(', 'm').exec(html);
  assert(match, 'missing production function ' + name);
  for (let end=html.indexOf('}',match.index);end>=0;end=html.indexOf('}',end+1)) {
    const body=html.slice(match.index,end+1);
    try { new vm.Script('('+body+')'); return body; } catch {}
  }
  throw Error('Could not extract '+name);
}
function osmRoute(loop) {
  const points = [];
  if (loop) {
    // 160 real node segments: enough to catch old 120-point overview reduction.
    for (let side = 0; side < 4; side++) for (let i = 0; i < 40; i++) {
      const f = i / 40;
      const corners = [[51.5, -1.2], [51.505, -1.2], [51.505, -1.192], [51.5, -1.192], [51.5, -1.2]];
      const a = corners[side], b = corners[side + 1];
      points.push({ lat: a[0] + (b[0] - a[0]) * f, lon: a[1] + (b[1] - a[1]) * f });
    }
    points.push({ ...points[0] });
  } else for (let i = 0; i <= 30; i++) points.push({ lat: 51.5 + i * 0.0003, lon: -1.2 });
  const nodes = points.map((_, i) => i + 1);
  if (loop) nodes[nodes.length - 1] = nodes[0];
  return { elements: [{ type: 'way', id: 1, nodes, geometry: points, tags: { highway: 'footway', designation: 'public_footpath', foot: 'yes', surface: 'gravel', name: 'Test Path' } }] };
}
function offer(loop = true) {
  const offers = R.parseOffers(osmRoute(loop), 51.5, -1.2);
  const found = offers.find(value => value.routeMode === (loop ? 'loop' : 'out-and-back'));
  assert(found, 'fixture must provide a useful walk');
  assert.equal(R.validateOffer(found).valid, true);
  return found;
}
function context(names, extra = {}) {
  const state = { player:{level:50,xp:0,coins:0,branches:0},inventory:{items:{},gear:{}},badges:{},questClaimReceipts:{},walkingQuests: { active: null, history: [] } }, effects = { xp: 0, coins: 0, saved: 0, rendered: 0 };
  const ctx = {
    window: { BurbzQuestCore: { ...Q }, BurbzWalkingRouteCore: R, BurbzWalkingEncounterCore: E, BurbzQuestPocketCore:require('../quest_pocket_core.js') },
    console, Date, Math, Number, JSON, Promise, Set, Map, BurbzMapTrailCore:require('../map_trail_core.js'),
    gameState: state, effects, walkQuestLastSave: 0, document:{hidden:false},
    localStorage:{setItem(key,value){effects.saved++;effects.disk=JSON.parse(value);}},
    queueCloudSave:noop,queueActionBadgeUpdate:noop,queueQuestClaimCloudSync:noop,
    announcePlayerLevelUps:noop,updateHeader:noop,renderInventory:noop,logDiary:noop,
    activeWalkingQuest: () => state.walkingQuests.active,
    ensureWalkingQuestState: () => state.walkingQuests,
    sideQuestActive: () => null,
    addPlayerXp: n => { effects.xp += n; }, addCoins: n => { effects.coins += n; },
    saveState: () => { effects.saved++; },
    applyWalkingStoryCompletion: () => null,
    MERLIN_CORE: { grantMerlinBondXp: value => value }, getMerlinCare: () => ({}),
    questMapMarkers: [], QUEST_BUZZ: {}, SFX: { tap: noop, capture: noop, levelUp: noop },
    maybeChartLoopHome: noop, scheduleWalkQuestRealign: noop, showQuestNpcDialog: noop,
    showToast: noop, vibrate: noop, handleWalkingStoryWaymarker: noop,
    maybeToggleOffRoadSideQuest: noop, maybeDiscoverSettlementShop: noop,
    updateWalkQuestHud: noop, applyQuestZoomLock: noop, updateQuestProgress: noop,
    queueCompletionNotice: noop, clearWalkingQuestFromMap: noop, playQuestClaimCelebration: noop,
    drawWalkingQuestOnMap: () => { effects.rendered++; },
    setTimeout: () => 1, clearTimeout: noop,
    uninstallWalkQuestAlignmentReadinessRetry: noop,
    mapDistanceMeters: (a, b) => Q.questHaversine(a.lat, a.lon, b.lat, b.lon),
    questOverview: { on: true, selectedIndex: 0, offers: [], at: null, fetchedAt: 0 },
    questOverviewColor: () => '#bb9c5b', questOfferRequestSeq: 0, walkQuestOffersCache: [],
    liveMapHasPrecisePosition: true, liveMapLastPosition: { lat: 51.5, lon: -1.2, accuracy: 5, at:Date.now() },
    ...extra
  };
  vm.createContext(ctx);
  const transactionFunctions=['durableSaveState','saveState','snapshotGameState','restoreStateTree','restoreGameStateSnapshot','questClaimReceipt','setQuestClaimReceipt','questPocketChange','questPocketResume','applyQuestPocketReward','commitQuestFinish','announceQuestPocketReward','applyPlayerXpState','playerLevelUpGrant','addCoins'];
  vm.runInContext(html.split('\n').find(line=>line.startsWith('const XP_PER_LEVEL ='))+'\n'+[...new Set(names.concat('mapGatheringGate',transactionFunctions))].map(source).join('\n'), ctx);
  return ctx;
}

test('preview, map GeoJSON, saved active route and distance retain the complete mapped walk', () => {
  for (const isLoop of [true, false]) {
    const selected = offer(isLoop);
    const ctx = context(['questOfferDisplayPoints', 'questOfferWalkKm', 'refreshQuestChainLinks', 'prepareQuestOffers', 'questOverviewGeoJSON', 'walkQuestRouteGeoJSON']);
    ctx.questOverview.offers = ctx.prepareQuestOffers([selected]);
    const quest = Q.buildQuestFromOffer(selected, { rand: () => 0.4, now: 1000 });
    const overview = ctx.questOverviewGeoJSON().features[0].geometry.coordinates;
    const active = ctx.walkQuestRouteGeoJSON(quest).features[0].geometry.coordinates;
    assert.equal(overview.length, selected.points.length);
    assert.equal(active.length, selected.points.length);
    assert.equal(R.validateQuest(copy(quest)).valid, true);
    for (let i = 0; i < overview.length; i++) assert(Q.questHaversine(overview[i][1], overview[i][0], active[i][1], active[i][0]) < 0.2);
    assert(Math.abs(ctx.questOfferWalkKm(selected).km * 1000 - quest.lengthM) < 1);
    if (!isLoop) {
      assert.equal(quest.loopStyle, 'out-and-back');
      assert.equal(quest.lengthM, selected.lengthM, 'complete return geometry must never be doubled again');
      assert.deepEqual(quest.route[0], quest.route.at(-1));
    }
  }
});

test('the real activation handler starts the previewed network route without legacy recharting', async () => {
  const selected = offer(false);
  selected.likelyBirds = [{ species: 'Robin', rarity: 'common' }];
  const ctx = context(['startWalkingQuestFromOffer', 'activateWalkingQuestFromOffer'], {
    walkQuestPendingActivation: null, walkQuestActivationInFlight: false, walkQuestActivationRequest: 0,
    visibleWalkablePathWays: () => [[{ lat: 0, lon: 0 }, { lat: 1, lon: 1 }]],
    attachStoryToNewWalkingQuest: noop, closeWalkQuestSheet: noop, setQuestOverview: noop,
    switchScreen: noop, questOnPositionFix: () => [],
    ensureOfferLoopBack: () => { throw Error('a validated complete route must not be extended'); }
  });
  ctx.window.BurbzQuestCore.repairQuestRouteAgainstWays = () => { throw Error('network route must not be recharted onto basemap data'); };
  await ctx.startWalkingQuestFromOffer(selected);
  const active = ctx.gameState.walkingQuests.active;
  assert(active);
  assert.equal(active.routeCertification.status, 'certified');
  assert.equal(active.routeFingerprint, selected.routeFingerprint);
  assert.equal(active.lengthM, selected.lengthM);
  assert.equal(active.route.length, selected.points.length);
  assert.equal(active.encounters.stops.length, 3);
  assert.equal(R.validateQuest(active).valid, true);
  assert(ctx.effects.saved > 0);
});

test('out-and-back turnaround stays a named flag for every chest randomization', () => {
  const selected = offer(false);
  for (const rand of [0, 0.1, 0.4, 0.6, 0.9, 0.9999]) {
    const quest = Q.buildQuestFromOffer(selected, { rand: () => rand });
    const turn = quest.checkpoints.find(cp => String(cp.label).startsWith('Turnaround'));
    assert(turn, 'the turn must stay discoverable in the UI');
    assert.equal(turn.kind, 'flag');
    const farEnd = Q.pointAtFraction(selected.points, 0.5);
    assert(Q.questHaversine(turn.lat, turn.lon, farEnd.lat, farEnd.lon) < 0.2);
  }
});

test('repeated GPS at a previous stop or poor GPS at the turn cannot skip the turnaround', () => {
  const quest = Q.buildQuestFromOffer(offer(false), { rand: () => 0.4, now: 1000 });
  const index = quest.checkpoints.findIndex(cp => String(cp.label).startsWith('Turnaround'));
  for (let i = 0; i < index; i++) quest.checkpoints[i].reached = true;
  const previous = quest.checkpoints[index - 1], turn = quest.checkpoints[index];
  for (let i = 0; i < 30; i++) Q.questProcessFix(quest, previous.lat, previous.lon, 5, 10000 + i * 2000);
  assert.equal(turn.reached, false);
  assert.deepEqual(Q.questProcessFix(quest, turn.lat, turn.lon, 500, 100000), []);
  assert.equal(turn.reached, false);
  assert.equal(Q.questIsComplete(quest), false);
  assert(Q.questProcessFix(quest, turn.lat, turn.lon, 5, 120000).some(event => event.type === 'flag'));
  assert.equal(turn.reached, true, 'a later accurate fix resumes without continuous-GPS distance requirements');
});

test('old 90m radius overlap cannot collect both the outward stop and the turnaround while stationary', () => {
  const data = osmRoute(false);
  data.elements[0].geometry = [{ lat: 51.5, lon: -1.2 }, { lat: 51.5032, lon: -1.2 }];
  data.elements[0].nodes = [1, 2];
  const selected = R.parseOffers(data, 51.5, -1.2)[0];
  assert(selected && selected.lengthM < 750);
  const quest = Q.buildQuestFromOffer(selected, { rand: () => 0.4 });
  quest.checkpoints[0].reached = true;
  const turnIndex = quest.checkpoints.findIndex(cp => String(cp.label).startsWith('Turnaround'));
  const before = quest.checkpoints[turnIndex - 1], turn = quest.checkpoints[turnIndex];
  const overlap = { lat: (before.lat + turn.lat) / 2, lon: (before.lon + turn.lon) / 2 };
  assert(Q.questHaversine(overlap.lat, overlap.lon, before.lat, before.lon) < 90);
  assert(Q.questHaversine(overlap.lat, overlap.lon, turn.lat, turn.lon) < 90);
  for (let i = 0; i < 20; i++) {
    assert.deepEqual(Q.questProcessFix(quest, overlap.lat, overlap.lon, 5, 10000 + i * 2000), []);
  }
  assert.equal(before.reached, false);
  assert.equal(turn.reached, false);
  assert.equal(Q.questIsComplete(quest), false);
});

test('network quests reject missing, negative, nonfinite and over-60m GPS accuracy', () => {
  for (const accuracy of [undefined, NaN, Infinity, -1, 61, 120]) {
    const quest = Q.buildQuestFromOffer(offer(false), { rand: () => 0.4 });
    assert.deepEqual(Q.questProcessFix(quest, quest.route[0][0], quest.route[0][1], accuracy, 5000), []);
    assert.equal(quest.checkpoints[0].reached, false);
    assert.equal(quest.lastFix, null);
  }
});

test('inaccurate basemap geometry cannot rechart a certified network quest', () => {
  const quest = Q.buildQuestFromOffer(offer(), { rand: () => 0.4 });
  const before = copy(quest.route);
  const ctx = context(['alignActiveQuestRouteToMapPaths'], {
    visibleWalkablePathWays: () => { throw Error('new routes must not read generalized tiles for authority'); }
  });
  ctx.gameState.walkingQuests.active = quest;
  assert.equal(ctx.alignActiveQuestRouteToMapPaths(true), false);
  assert.deepEqual(quest.route, before);
  assert.equal(quest.routeCertification.status, 'certified');
  quest.route[1][1] += 0.05;
  const corrupted = copy(quest.route);
  ctx.alignActiveQuestRouteToMapPaths(true);
  assert.equal(quest.routeCertification.status, 'blocked');
  assert.deepEqual(quest.route, corrupted, 'invalid data must be blocked rather than replaced by a different walk');
});

test('pending and blocked active quests cannot award GPS pickups in either save version', () => {
  for (const version of [undefined, 1]) for (const status of ['pending', 'blocked', 'uncertified']) {
    const quest = Q.buildQuestFromOffer(offer(), { rand: () => 0.4 });
    quest.routeSchemaVersion = version;
    quest.routeCertification.status = status;
    const ctx = context(['questOnPositionFix']);
    ctx.gameState.walkingQuests.active = quest;
    assert.deepEqual(copy(ctx.questOnPositionFix(quest.route[0][0], quest.route[0][1], 5, 5000)), []);
    assert.equal(ctx.effects.xp, 0);
    assert.equal(ctx.effects.coins, 0);
    assert.equal(quest.checkpoints[0].reached, false);
  }
});

test('completion keeps the last discoveries and saved choices in history and awards only once', () => {
  const quest = Q.buildQuestFromOffer(offer(), { rand: () => 0.4 });
  quest.checkpoints.forEach(cp => { cp.reached = true; cp.reachedAt = 5000; });
  E.onProgress(quest, { now: 5000 });
  E.chooseEncounter(quest, 'warden', 'curiosity', { now: 6000 });
  // The final stop may arrive in the same GPS fix that produces the finish.
  quest.encounters.stops.at(-1).discovered = false;
  quest.encounters.stops.at(-1).discoveredAt = null;
  const ctx = context(['completeWalkingQuest']);
  ctx.gameState.walkingQuests.active = quest;
  ctx.completeWalkingQuest();
  const history = ctx.gameState.walkingQuests.history;
  assert.equal(history.length, 1);
  assert.equal(history[0].encounters.length, 3);
  assert.equal(history[0].encounters[0].choiceId, 'curiosity');
  const rewards = { xp: ctx.gameState.player.xp, coins: ctx.gameState.player.coins };
  assert.equal(Object.keys(ctx.gameState.questClaimReceipts).length,1,'completion has one durable receipt');
  assert.deepEqual(copy(ctx.gameState),ctx.effects.disk,'reward and history share the durable write');
  assert(rewards.xp > 0);
  assert.equal(ctx.gameState.walkingQuests.active, null);
  ctx.completeWalkingQuest();
  assert.equal(history.length, 1);
  assert.deepEqual({ xp: ctx.gameState.player.xp, coins: ctx.gameState.player.coins }, rewards);
});

test('stale fetch cannot replace a newer area and moving during a fetch restarts discovery', async () => {
  const pending = [];
  const ctx = context(['discoverNearbyQuestOffers'], {
    prepareQuestOffers: values => values,
    visibleMapWalkingQuestOffers: () => { throw Error('tile evidence used'); }
  });
  ctx.window.BurbzQuestCore.fetchTrailOffers = (lat, lon) => new Promise(resolve => pending.push({ lat, lon, resolve }));
  const first = ctx.discoverNearbyQuestOffers(true);
  ctx.liveMapLastPosition = { lat: 51.52, lon: -1.2 };
  const newer = ctx.discoverNearbyQuestOffers(true);
  pending[1].resolve([{ ref: 'new-area' }]);
  await newer;
  pending[0].resolve([{ ref: 'old-area' }]);
  assert.equal(await first, null);
  assert.equal(ctx.questOverview.offers[0].ref, 'new-area');
  const moving = ctx.discoverNearbyQuestOffers(true);
  ctx.liveMapLastPosition = { lat: 51.54, lon: -1.2 };
  pending[2].resolve([{ ref: 'stale-while-walking' }]);
  await Promise.resolve();
  assert.equal(pending[3].lat, 51.54);
  pending[3].resolve([{ ref: 'current-area' }]);
  await moving;
  assert.equal(ctx.questOverview.offers[0].ref, 'current-area');
});

test('losing precise location during discovery prevents publishing stale offers', async () => {
  let respond;
  const ctx = context(['discoverNearbyQuestOffers'], { prepareQuestOffers: values => values });
  ctx.window.BurbzQuestCore.fetchTrailOffers = () => new Promise(resolve => { respond = resolve; });
  const attempt = ctx.discoverNearbyQuestOffers(true);
  ctx.liveMapHasPrecisePosition = false;
  respond([{ ref: 'location-expired' }]);
  const result = await attempt;
  assert(!result || result.length === 0);
  assert.equal(ctx.questOverview.offers.length, 0);
});
