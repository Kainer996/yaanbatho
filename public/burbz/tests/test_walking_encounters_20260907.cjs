const assert = require('node:assert/strict');
const { test } = require('node:test');
const E = require('../walking_encounter_core.js');
const W = require('../walking_story_core.js');
global.window = global;
require('../quest_core.js');
const Q = global.BurbzQuestCore;

const clone = value => JSON.parse(JSON.stringify(value));
function fixture(lengthM = 2400) {
  const route = [[51.5, -1.2], [51.503, -1.2], [51.506, -1.2], [51.509, -1.2], [51.512, -1.2]];
  return {
    id: 'test-walk', type: 'footpath', name: 'Mapped test route', lengthM,
    route, startedAt: 1000, distanceWalkedM: 0, birdsCaptured: [], chestsOpened: 0,
    checkpoints: route.map((p, i) => ({ lat: p[0], lon: p[1], kind: i === 0 ? 'npc' : i === route.length - 1 ? 'finish' : 'flag', reached: false }))
  };
}
function reachThrough(quest, index) {
  quest.checkpoints.forEach((cp, i) => { if (i <= index) { cp.reached = true; cp.reachedAt = 1000 + i * 1000; } });
}

test('same quest produces the same two or three fictional, on-checkpoint stops', () => {
  const quest = fixture();
  assert.deepEqual(E.createQuestEncounters(quest), E.createQuestEncounters(clone(quest)));
  assert.deepEqual(E.createQuestEncounters(quest).map(s => s.id), ['warden', 'lantern-post', 'wayfarer-rest']);
  assert.deepEqual(E.createQuestEncounters(fixture(1400)).map(s => s.id), ['warden', 'lantern-post']);
  const stops = E.ensureQuestEncounters(quest);
  assert.deepEqual(stops.map(s => s.checkpointIndex), [1, 2, 3]);
  for (const [i, stop] of stops.entries()) {
    assert.equal(stop.fictional, true);
    assert.equal(stop.fictionLabel, E.FICTION_LABEL);
    assert.equal(stop.lat, quest.checkpoints[stop.checkpointIndex].lat);
    assert.equal(stop.lon, quest.checkpoints[stop.checkpointIndex].lon);
    assert(Math.abs(stop.routeFraction - (i + 1) / 4) < 0.000001);
    assert.equal(stop.artPath, 'assets/walking-quests/' + stop.artKey + '.webp');
    assert.equal(stop.choices.length, 2);
    assert.equal(stop.reward, undefined);
  }
});

test('poor data yields fewer encounters without creating checkpoints or finish destinations', () => {
  const quest = fixture();
  quest.checkpoints = [quest.checkpoints[0], quest.checkpoints[1], quest.checkpoints[4]];
  const checkpoints = clone(quest.checkpoints);
  assert.equal(E.ensureQuestEncounters(quest).length, 1);
  assert.deepEqual(quest.checkpoints, checkpoints);
  const noStops = fixture();
  noStops.checkpoints = [noStops.checkpoints[0], noStops.checkpoints[4]];
  assert.deepEqual(E.ensureQuestEncounters(noStops), []);
});

test('encounters do not invent destinations for off-route checkpoints', () => {
  const quest = fixture();
  quest.checkpoints[2].lon += 0.1;
  const checkpoints = clone(quest.checkpoints);
  assert.equal(E.ensureQuestEncounters(quest).length, 2);
  assert(!E.listQuestEncounters(quest).some(s => s.checkpointIndex === 2));
  assert.deepEqual(quest.checkpoints, checkpoints);
});

test('reading previews or opening a locked choice cannot discover anything', () => {
  const quest = fixture();
  assert.equal(E.listQuestEncounters(quest).length, 3);
  assert.equal(E.chooseEncounter(quest, 'warden', 'curiosity').status, 'locked');
  assert.deepEqual(E.onProgress(quest, { now: 9999 }), []);
  assert.deepEqual(E.encounterJournal(quest), []);
  const preview = E.listQuestEncounters(quest);
  preview[0].discovered = true;
  preview[0].choices[0].outcome = 'edited';
  assert.equal(E.listQuestEncounters(quest)[0].discovered, false);
  assert.notEqual(E.listQuestEncounters(quest)[0].choices[0].outcome, 'edited');
});

test('later and overlapping checkpoint states cannot bypass ordered arrival', () => {
  const quest = fixture();
  quest.checkpoints[2].reached = true;
  quest.checkpoints[3].reached = true;
  assert.deepEqual(E.onProgress(quest), []);
  quest.checkpoints[0].reached = true;
  assert.deepEqual(E.onProgress(quest), []);
  quest.checkpoints[1].reached = true;
  assert.equal(E.onProgress(quest).length, 3);
  assert.deepEqual(E.onProgress(quest), []);
});

test('an actual quest-core chest intent stays locked until the durable claim commits', () => {
  const quest = fixture();
  const cp = quest.checkpoints[1];
  cp.kind = 'chest';
  cp.loot = Q.normaliseChestLoot({ coins: 10, xp: 0, larder: {} }, 'encounter-test');
  quest.checkpoints[0].reached = true;
  const events = Q.questProcessFix(quest, cp.lat, cp.lon, 5, 2000);
  assert(events.some(event => event.type === 'chest'));
  assert.equal(cp.reached, false);
  assert.deepEqual(E.onProgress(quest), []);
  const receipts = {};
  let persistCount = 0;
  const tx = Q.runDurableChestClaim({
    claimKey: 'encounter-test', bundle: cp.loot, now: 2000,
    snapshot: () => clone(quest), restore: snapshot => Object.assign(quest, snapshot),
    getReceipt: key => receipts[key], setReceipt: (key, value) => { receipts[key] = value; },
    validate: bundle => Q.validateChestRewardBundle(bundle, () => true, () => true),
    apply: () => { cp.reached = true; cp.reachedAt = 2000; },
    persist: () => { persistCount++; return true; }
  });
  assert.equal(tx.status, 'committed');
  assert.equal(persistCount, 1);
  assert.deepEqual(E.onProgress(quest).map(stop => stop.id), ['warden']);
  assert.deepEqual(E.onProgress(quest), []);
});

test('poor-accuracy GPS rejected by quest core cannot unlock an encounter', () => {
  const quest = fixture();
  quest.checkpoints[0].reached = true;
  const cp = quest.checkpoints[1];
  assert.deepEqual(Q.questProcessFix(quest, cp.lat, cp.lon, 999, 2000), []);
  assert.equal(cp.reached, false);
  assert.deepEqual(E.onProgress(quest), []);
});

test('a failed durable chest save rolls back its encounter arrival', () => {
  const quest = fixture();
  quest.checkpoints[0].reached = true;
  quest.checkpoints[1].kind = 'chest';
  const loot = Q.normaliseChestLoot({ coins: 10, xp: 0, larder: {} }, 'encounter-save-failed');
  const tx = Q.runDurableChestClaim({
    claimKey: 'encounter-save-failed', bundle: loot, now: 2000,
    snapshot: () => clone(quest), restore: snapshot => Object.assign(quest, snapshot),
    getReceipt: () => null, setReceipt: () => {},
    validate: bundle => Q.validateChestRewardBundle(bundle, () => true, () => true),
    apply: () => { quest.checkpoints[1].reached = true; },
    persist: () => { throw new Error('storage unavailable'); }
  });
  assert.equal(tx.status, 'failed');
  assert.equal(quest.checkpoints[1].reached, false);
  assert.deepEqual(E.onProgress(quest), []);
});

test('a committed flag arrival discovers once and remains discovered after reload', () => {
  let quest = fixture();
  quest.checkpoints[0].reached = true;
  const cp = quest.checkpoints[1];
  const events = Q.questProcessFix(quest, cp.lat, cp.lon, 5, 2000);
  assert(events.some(event => event.type === 'flag'));
  const discoveries = E.onProgress(quest, { now: 7000 });
  assert.equal(discoveries.length, 1);
  assert.equal(discoveries[0].discoveredAt, 2000);
  quest = clone(quest);
  assert.deepEqual(E.onProgress(quest, { now: 9000 }), []);
  assert.equal(E.encounterJournal(quest).length, 1);
});

test('choice is once-only narrative and cannot alter saved quest rewards or campaign', () => {
  let quest = fixture();
  W.attachWalkingStory(quest, W.WALKING_STORIES[0]);
  reachThrough(quest, 3);
  const campaignBefore = clone(W.WALKING_STORIES);
  const before = clone(quest);
  E.onProgress(quest);
  assert.equal(E.chooseEncounter(quest, 'warden', 'invalid').status, 'invalid-choice');
  const chosen = E.chooseEncounter(quest, 'warden', 'curiosity', { now: 8000 });
  assert.equal(chosen.status, 'chosen');
  assert.equal(chosen.encounter.choiceAt, 8000);
  assert.equal(chosen.encounter.outcome, chosen.encounter.choices[0].outcome);
  quest = clone(quest);
  const second = E.chooseEncounter(quest, 'warden', 'kindness', { now: 9000 });
  assert.equal(second.status, 'already-chosen');
  assert.equal(second.encounter.choiceId, 'curiosity');
  assert.equal(second.encounter.choiceAt, 8000);
  assert.deepEqual(W.WALKING_STORIES, campaignBefore);
  assert.equal(W.WALKING_STORIES.length, 20);
  const withoutEncounters = clone(quest);
  delete withoutEncounters.encounters;
  assert.deepEqual(withoutEncounters, before);
  assert.deepEqual(Q.questSummary(quest, 10000), Q.questSummary(before, 10000));
});

test('saved discovery follows checkpoint realignment without resetting a choice', () => {
  const quest = fixture();
  reachThrough(quest, 1);
  E.onProgress(quest);
  E.chooseEncounter(quest, 'warden', 'kindness', { now: 9000 });
  quest.route.forEach(point => { point[1] += 0.002; });
  quest.checkpoints.forEach(cp => { cp.lon += 0.002; });
  const stops = E.listQuestEncounters(quest);
  assert.equal(stops[0].lon, quest.checkpoints[1].lon);
  assert.equal(stops[0].discovered, true);
  assert.equal(stops[0].choiceId, 'kindness');
  assert.deepEqual(E.onProgress(quest), []);
});

test('completed-quest journal is a detached copy of discovered stops only', () => {
  const quest = fixture();
  reachThrough(quest, 1);
  E.onProgress(quest);
  const history = { encounters: E.encounterJournal(quest) };
  quest.completedAt = 15000;
  reachThrough(quest, 4);
  assert.deepEqual(E.onProgress(quest), []);
  assert.equal(history.encounters.length, 1);
  history.encounters[0].name = 'history changed';
  assert.equal(E.encounterJournal(quest)[0].name, 'Warden Thistledown');
});

test('invalid geometry and future-version saves fail closed without destroying state', () => {
  for (const route of [[], [[51.5, -1.2]], [[NaN, 0], [0, 0]], [[91, 0], [0, 0]], [[0, 0], [0, Infinity]], [[0, 0], [0, 0]]]) {
    const quest = fixture(); quest.route = route;
    assert.deepEqual(E.ensureQuestEncounters(quest), []);
  }
  assert.deepEqual(E.ensureQuestEncounters(null), []);
  const quest = fixture();
  quest.encounters = { version: 99, stops: [{ future: 'keep me' }] };
  assert.deepEqual(E.listQuestEncounters(quest), []);
  assert.deepEqual(quest.encounters, { version: 99, stops: [{ future: 'keep me' }] });
});

test('route fractions use local longitude across the date line', () => {
  const quest = fixture();
  quest.route = [[0, 179.998], [0, -179.998]];
  quest.checkpoints = [{ kind: 'npc', lat: 0, lon: 179.998 }, { kind: 'flag', lat: 0, lon: -180 }, { kind: 'finish', lat: 0, lon: -179.998 }];
  const stops = E.ensureQuestEncounters(quest);
  assert.equal(stops.length, 1);
  assert(Math.abs(stops[0].routeFraction - 0.5) < 0.000001);
});

test('actual built quests keep campaign and reward data while gaining checkpoint encounters', () => {
  const points = Array.from({ length: 41 }, (_, i) => ({ lat: 51.5 + i * 0.00055, lon: -1.2 }));
  const quest = Q.buildQuestFromOffer({ kind: 'footpath', name: 'Mapped Way', points }, { rand: () => 0.42, now: 1000 });
  W.attachWalkingStory(quest, W.nextWalkingStory(quest.lengthM, []));
  const before = clone(quest);
  const stops = E.ensureQuestEncounters(quest);
  assert.equal(stops.length, 3);
  assert(stops.every(stop => ['flag', 'chest'].includes(quest.checkpoints[stop.checkpointIndex].kind)));
  assert(stops.every(stop => stop.lat === quest.checkpoints[stop.checkpointIndex].lat && stop.lon === quest.checkpoints[stop.checkpointIndex].lon));
  const withoutEncounters = clone(quest); delete withoutEncounters.encounters;
  assert.deepEqual(withoutEncounters, before);
});

test('ordered route distance keeps return-leg encounter fractions on the return leg', () => {
  const quest = fixture();
  quest.route = [[51.5, -1.2], [51.512, -1.2], [51.5, -1.2]];
  const lengthM = Q.routeLengthM(quest.route.map(p => ({ lat: p[0], lon: p[1] })));
  quest.checkpoints = [0, 0.25, 0.5, 0.75, 1].map((fraction, i) => {
    const p = Q.pointAtFraction(quest.route.map(p => ({ lat: p[0], lon: p[1] })), fraction);
    return { kind: i === 0 ? 'npc' : i === 4 ? 'finish' : 'flag', ...p, routeDistanceM: fraction * lengthM, reached: false };
  });
  const stops = E.ensureQuestEncounters(quest);
  assert.equal(stops.length, 3);
  assert(Math.abs(stops[2].routeFraction - 0.75) < 0.000001);
  assert.equal(stops[0].lat, stops[2].lat);
});
