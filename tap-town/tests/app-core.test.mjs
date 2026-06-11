import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInitialState, buyBuilding, collectBuilding, claimQuest, currentQuest, questProgress,
  energySummary, getLevel, moveBuilding, startResidentJob, finishResidentJobs, BUILDINGS,
  PLOTS, MAP_BOUNDS, getMapBounds, centerCamera, clampCamera, residentRoutePlan, residentPosition, RESIDENTS
} from '../app-core.js';

test('initial town has a playable loop and sane resources', () => {
  const state = createInitialState(1_000_000);
  assert.equal(state.coins, 420);
  assert.ok(state.placed.length >= 6);
  assert.equal(currentQuest(state).id, 'collect-hall');
  const energy = energySummary(state);
  assert.ok(energy.max >= energy.used);
});

test('expanded map exposes many buildable plots and central bounds', () => {
  const bounds = getMapBounds();
  assert.equal(PLOTS.length >= 45, true);
  assert.equal(bounds.width, MAP_BOUNDS.width);
  assert.ok(bounds.width > 1200);
  assert.ok(bounds.height > 1000);
  assert.equal(new Set(PLOTS.map(p => p.id)).size, PLOTS.length);
  assert.equal(PLOTS.every(p => p.x >= 0 && p.x <= bounds.width && p.y >= 0 && p.y <= bounds.height), true);
});

test('camera helpers centre and clamp against actual expanded map size', () => {
  const centred = centerCamera({ width: 390, height: 720 }, 0.74);
  assert.equal(centred.scale, 0.74);
  assert.ok(centred.x < 0);
  assert.ok(centred.y < 0);
  const clamped = clampCamera({ x: -99_999, y: 99_999, scale: 9 }, { width: 390, height: 720 });
  assert.equal(clamped.scale, 1.55);
  assert.ok(clamped.x > -2600 && clamped.x < -1800);
  assert.equal(clamped.y, MAP_BOUNDS.padding);
});

test('player can build a park, spending coins and using a free plot', () => {
  const state = createInitialState(1_000_000);
  const next = buyBuilding(state, 'park', 'p01', 1_000_000);
  assert.equal(next.coins, state.coins - BUILDINGS.park.cost);
  assert.equal(next.placed.some(b => b.type === 'park' && b.plotId === 'p01'), true);
  assert.equal(next.stats.builds.park, 1);
});

test('building cannot be placed on an occupied plot', () => {
  const state = createInitialState(1_000_000);
  assert.throws(() => buyBuilding(state, 'park', 'p28', 1_000_000), /occupied/);
});

test('collecting town hall advances the first quest and allows claim', () => {
  const state = createInitialState(1_000_000);
  const hall = state.placed.find(b => b.type === 'hall');
  const collected = collectBuilding(state, hall.id, 1_000_000);
  assert.equal(questProgress(collected).ready, true);
  const claimed = claimQuest(collected);
  assert.ok(claimed.coins > collected.coins);
  assert.ok(claimed.questClaims.includes('collect-hall'));
});

test('move mode changes plot without duplicating building count', () => {
  const state = createInitialState(1_000_000);
  const b = state.placed[0];
  const moved = moveBuilding(state, b.id, 'p01');
  assert.equal(moved.placed.length, state.placed.length);
  assert.equal(moved.placed.find(x => x.id === b.id).plotId, 'p01');
  assert.equal(moved.stats.moves, 1);
});

test('resident jobs finish into coins and XP after timer boundary', () => {
  const state = createInitialState(1_000_000);
  const bakery = state.placed.find(b => b.type === 'bakery');
  const started = startResidentJob(state, 'poppy', bakery.id, 1_000_000);
  assert.ok(started.residents.find(r => r.id === 'poppy').jobUntil > 1_000_000);
  const done = finishResidentJobs(started, 1_060_000);
  assert.equal(done.residents.find(r => r.id === 'poppy').jobUntil, 0);
  assert.ok(done.coins > started.coins);
  assert.ok(done.xp > started.xp);
});

test('resident movement uses route-like positions instead of a fixed orbit', () => {
  const state = createInitialState(1_000_000);
  const milo = RESIDENTS[0];
  const planA = residentRoutePlan(state, milo, 0, 1_000_000);
  const planB = residentRoutePlan(state, milo, 0, 1_008_000);
  const posA = residentPosition(state, milo, 0, 1_000_000);
  const posB = residentPosition(state, milo, 0, 1_018_000);
  assert.ok(Math.hypot(planA.target.x - planA.start.x, planA.target.y - planA.start.y) > 40);
  assert.notDeepEqual(posA, posB);
  assert.ok(posA.x >= 0 && posA.x <= MAP_BOUNDS.width);
  assert.ok(posA.y >= 0 && posA.y <= MAP_BOUNDS.height);
  assert.equal(typeof planB.resting, 'boolean');
});

test('level gating prevents late buildings before enough XP', () => {
  const state = createInitialState(1_000_000);
  assert.equal(getLevel(state.xp), 1);
  assert.throws(() => buyBuilding(state, 'cinema', 'p01', 1_000_000), /level 4/i);
});
