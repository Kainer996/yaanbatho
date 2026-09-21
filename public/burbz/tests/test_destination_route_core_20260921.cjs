'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
// Preserve strict OSM-evidence regression coverage separately from gap guidance.
const core = require('../destination_route_core.js');
const route = {...core, planDestinationRoute: core.planMappedDestinationRoute};
const elevation = require('../destination_elevation_core.js');
const rewards = require('../destination_reward_core.js');

const ORIGIN = { lat: 51.5007, lon: -0.1795 };
const p = (north, east) => ({
  lat: ORIGIN.lat + north / 111320,
  lon: ORIGIN.lon + east / (111320 * Math.cos(ORIGIN.lat * Math.PI / 180))
});
const way = (id, nodes, geometry, tags = {}) => ({
  type: 'way',
  id,
  nodes,
  geometry,
  tags: { highway: 'footway', designation: 'public_footpath', surface: 'compacted', ...tags }
});
const node = (id, point, tags = {}) => ({ type: 'node', id, lat: point.lat, lon: point.lon, tags });
const rawOsm = elements => ({ osm3s: { timestamp_osm_base: '2026-09-21T12:00:00Z' }, elements });
const osm = elements => {
  const complete = elements.slice();
  const explicit = new Set(elements.filter(e => e && e.type === 'node' && e.id != null).map(e => String(e.id)));
  for (const w of elements) {
    if (!w || w.type !== 'way' || !Array.isArray(w.nodes) || !Array.isArray(w.geometry)) continue;
    for (let i = 0; i < w.nodes.length; i++) {
      const id = String(w.nodes[i]);
      const g = w.geometry[i];
      if (explicit.has(id) || !g || !Number.isFinite(g.lat) || !Number.isFinite(g.lon)) continue;
      explicit.add(id);
      complete.push(node(id, g));
    }
  }
  return rawOsm(complete);
};

async function runFetch(fetchFn, start, end, opts = {}) {
  return route.fetchDestinationRoute(start, end, { fetchFn, endpoints: ['https://example.test/overpass'], timeoutMs: 1000, requireMappedRoute: true, ...opts });
}

test('directed destination search preserves every source vertex and refuses a non-shared crossing', () => {
  const network = osm([
    way(1, [1, 2, 3], [p(0, 0), p(0, 200), p(0, 400)]),
    way(2, [3, 4, 5], [p(0, 400), p(200, 400), p(400, 400)]),
    way(3, [6, 7], [p(-120, 200), p(120, 200)], { bridge: 'yes', layer: '1' })
  ]);
  const result = route.planDestinationRoute(network, p(0, 5), p(395, 400));
  assert.equal(result.ok, true, result.error && result.error.code);
  assert.deepEqual(result.route.points.map(pt => [Math.round((pt.lat - ORIGIN.lat) * 111320), Math.round((pt.lon - ORIGIN.lon) * 111320 * Math.cos(ORIGIN.lat * Math.PI / 180))]), [
    [0, 5], [0, 200], [0, 400], [200, 400], [395, 400]
  ]);
  assert.equal(result.route.routeEvidence.segments.length, 4);
  assert.equal(route.validateDestinationRoute(result.route).valid, true);
  const blocked = route.planDestinationRoute(network, p(-100, 200), p(100, 200), { maxEndpointSnapM: 30 });
  assert.equal(blocked.ok, true);
  assert.equal(blocked.route.routeEvidence.ways.length, 1);
});

test('one-way foot direction, supported turn restrictions and unsupported restrictions are conservative', () => {
  const base = [
    way(1, [1, 2], [p(0, 0), p(0, 100)], { 'oneway:foot': 'yes' }),
    way(2, [2, 3], [p(0, 100), p(100, 100)]),
    way(3, [2, 4, 5, 3], [p(0, 100), p(0, 200), p(100, 200), p(100, 100)]),
    { type: 'relation', id: 10, tags: { type: 'restriction', 'restriction:foot': 'no_straight_on' }, members: [
      { type: 'way', ref: 1, role: 'from' }, { type: 'node', ref: 2, role: 'via' }, { type: 'way', ref: 2, role: 'to' }
    ] }
  ];
  const forward = route.planDestinationRoute(osm(base), p(0, 2), p(100, 100));
  assert.equal(forward.ok, true);
  assert.deepEqual(forward.route.routeEvidence.segments.map(s => s.wayId), ['1', '3', '3', '3']);
  const reverse = route.planDestinationRoute(osm(base), p(100, 100), p(0, 2));
  assert.equal(reverse.ok, false);
  assert.equal(reverse.error.code, 'route-unreachable');
  const unsupported = route.planDestinationRoute(osm([
    way(1, [1, 2], [p(0, 0), p(0, 100)]),
    { type: 'relation', id: 11, tags: { type: 'restriction', 'restriction:foot': 'no_u_turn' }, members: [
      { type: 'way', ref: 1, role: 'from' }, { type: 'way', ref: 1, role: 'via' }, { type: 'way', ref: 1, role: 'to' }
    ] }
  ]), p(0, 1), p(0, 90));
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.error.code, 'unsupported-restriction');
});

test('public access policy rejects private, conditional, ambiguous and blocked routes regardless of input order', () => {
  const cases = [
    way(1, [1, 2], [p(0, 0), p(0, 100)], { access: 'private', foot: 'yes' }),
    way(2, [3, 4], [p(0, 0), p(0, 100)], { 'foot:conditional': 'yes @ (Mo-Fr)' }),
    way(3, [5, 6], [p(0, 0), p(0, 100)], { highway: 'service', access: 'private' })
  ];
  for (const w of cases) {
    const result = route.planDestinationRoute(osm([w]), p(0, 1), p(0, 90));
    assert.equal(result.ok, false, JSON.stringify(w.tags));
    assert.equal(result.error.code, 'no-walkable-data');
  }
  const blockedNode = node(2, p(0, 50), { barrier: 'gate', access: 'private' });
  const blocked = route.planDestinationRoute(osm([way(4, [1, 2, 3], [p(0, 0), p(0, 50), p(0, 100)]), blockedNode]), p(0, 1), p(0, 90));
  assert.equal(blocked.ok, false);
  assert.equal(blocked.error.code, 'no-walkable-data');
  const firstPositive = route.planDestinationRoute(osm([
    way(5, [10, 11], [p(0, 0), p(0, 100)], { foot: 'yes' }),
    way(6, [10, 11], [p(0, 0), p(0, 100)], { access: 'private' })
  ]), p(0, 1), p(0, 90));
  const firstNegative = route.planDestinationRoute(osm([
    way(6, [10, 11], [p(0, 0), p(0, 100)], { access: 'private' }),
    way(5, [10, 11], [p(0, 0), p(0, 100)], { foot: 'yes' })
  ]), p(0, 1), p(0, 90));
  assert.equal(firstPositive.ok, true);
  assert.equal(firstNegative.ok, true);
  assert.deepEqual(firstPositive.route.routeEvidence.segments.map(s => s.wayId), firstNegative.route.routeEvidence.segments.map(s => s.wayId));
});

test('endpoint projection is bounded, explained and supports same-segment routes both ways', () => {
  const network = osm([way(1, [1, 2], [p(0, 0), p(0, 200)])]);
  const forward = route.planDestinationRoute(network, p(8, 40), p(-6, 160), { minRouteM: 20, maxEndpointSnapM: 15 });
  assert.equal(forward.ok, true);
  assert.equal(forward.route.points.length, 2);
  assert.equal(forward.route.projections.start.snapDistanceM > 0, true);
  assert.match(forward.route.projections.start.note, /not certified/);
  const backward = route.planDestinationRoute(network, p(-6, 160), p(8, 40), { minRouteM: 20, maxEndpointSnapM: 15 });
  assert.equal(backward.ok, true);
  assert.equal(backward.route.points.length, 2);
  assert.notEqual(forward.route.projections.start.id, backward.route.projections.start.id);
  const far = route.planDestinationRoute(network, p(40, 40), p(0, 160), { maxEndpointSnapM: 15 });
  assert.equal(far.ok, false);
  assert.equal(far.error.code, 'endpoint-too-far');
  const identical = route.planDestinationRoute(network, p(0, 40), p(0, 40), { minRouteM: 20 });
  assert.equal(identical.ok, false);
  assert.equal(identical.error.code, 'route-too-short');
});

test('coordinate and route bounds are explicit and no disconnected or partial network becomes a success', () => {
  assert.equal(route.planDestinationRoute(osm([]), { lat: NaN, lon: 0 }, p(0, 1)).error.code, 'invalid-coordinate');
  assert.equal(route.planDestinationRoute(osm([]), { lat: 91, lon: 0 }, p(0, 1)).error.code, 'invalid-coordinate');
  assert.equal(route.planDestinationRoute(osm([way(1, [1, 2], [p(0, 0), p(0, 20)])]), p(0, 1), p(0, 19), { minRouteM: 50 }).error.code, 'route-too-short');
  assert.equal(route.planDestinationRoute(osm([way(1, [1, 2], [p(0, 0), p(0, 900)])]), p(0, 1), p(0, 899), { maxRouteM: 500 }).error.code, 'route-too-long');
  assert.equal(route.planDestinationRoute(osm([way(1, [1, 2], [p(0, 0), p(0, 100)]), way(2, [3, 4], [p(200, 0), p(200, 100)])]), p(0, 1), p(200, 99)).error.code, 'route-unreachable');
  assert.equal(route.planDestinationRoute({ remark: 'runtime error', elements: [] }, p(0, 1), p(0, 99)).error.code, 'provider-partial');
  assert.equal(route.planDestinationRoute(osm([way(1, [1, 2, 3], [p(0, 0), null, p(0, 100)])]), p(0, 1), p(0, 99)).error.code, 'no-walkable-data');
});

test('provider geometry cannot certify a destination route without complete source node elements', () => {
  const noNodeElements = route.planDestinationRoute(rawOsm([
    way(6001, [601, 602, 603], [p(20, 0), p(20, 80), p(20, 160)])
  ]), p(20, 4), p(20, 155), { minRouteM: 20 });
  assert.equal(noNodeElements.ok, false);
  assert.equal(noNodeElements.error.code, 'no-walkable-data');

  const missingInteriorNode = route.planDestinationRoute(rawOsm([
    node(611, p(40, 0)),
    node(613, p(40, 160)),
    way(6002, [611, 612, 613], [p(40, 0), p(40, 80), p(40, 160)])
  ]), p(40, 4), p(40, 155), { minRouteM: 20 });
  assert.equal(missingInteriorNode.ok, false);
  assert.equal(missingInteriorNode.error.code, 'no-walkable-data');

  const contradictoryNodeCoordinate = route.planDestinationRoute(rawOsm([
    node(621, p(60, 0)),
    node(622, p(70, 80)),
    node(623, p(60, 160)),
    way(6003, [621, 622, 623], [p(60, 0), p(60, 80), p(60, 160)])
  ]), p(60, 4), p(60, 155), { minRouteM: 20, maxEndpointSnapM: 20 });
  assert.equal(contradictoryNodeCoordinate.ok, false);
  assert.equal(contradictoryNodeCoordinate.error.code, 'no-walkable-data');
});

test('provider entrypoint derives query extent, handles failures, cancellation and changed coordinate pairs', async () => {
  const good = osm([way(1, [1, 2], [p(0, 0), p(0, 300)])]);
  const requests = [];
  const fetchFn = async (url, init) => {
    requests.push({ url, body: init.body, signal: init.signal });
    return { ok: true, status: 200, headers: { get: name => name.toLowerCase() === 'access-control-allow-origin' ? '*' : null }, text: async () => JSON.stringify(good) };
  };
  const a = await runFetch(fetchFn, p(0, 1), p(0, 250), { minRouteM: 20 });
  const b = await runFetch(fetchFn, p(0, 20), p(0, 280), { minRouteM: 20 });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  assert.notEqual(requests[0].body, requests[1].body);
  assert.match(a.provider.query, /way\[highway/);
  assert.ok(a.provider.bodyHash);
  assert.equal(a.provider.cors, '*');
  assert.equal(a.route.routeEvidence.ways[0].id, '1');
  for (const [status, expected] of [[429, 'provider-rate-limited'], [500, 'provider-http']]) {
    const result = await runFetch(async () => ({ ok: false, status, text: async () => 'nope', headers: { get: () => null } }), p(0, 1), p(0, 250));
    assert.equal(result.ok, false);
    assert.equal(result.error.code, expected);
  }
  assert.equal((await runFetch(async () => ({ ok: true, status: 200, text: async () => '<html></html>', headers: { get: () => null } }), p(0, 1), p(0, 250))).error.code, 'provider-invalid-json');
  assert.equal((await runFetch(async () => ({ ok: true, status: 200, text: async () => JSON.stringify({ remark: 'partial', elements: [] }), headers: { get: () => null } }), p(0, 1), p(0, 250))).error.code, 'provider-partial');
  const ctrl = new AbortController();
  ctrl.abort();
  assert.equal((await runFetch(fetchFn, p(0, 1), p(0, 250), { signal: ctrl.signal })).error.code, 'provider-cancelled');
});

test('saved provenance round-trips and hostile mutations are rejected while legacy routes still validate', () => {
  const routeResult = route.planDestinationRoute(osm([way(1, [1, 2, 3], [p(0, 0), p(0, 100), p(0, 200)])]), p(0, 5), p(0, 195), { minRouteM: 20 });
  assert.equal(routeResult.ok, true);
  const saved = JSON.parse(JSON.stringify(routeResult.route));
  assert.equal(route.validateDestinationRoute(saved).valid, true);
  const missingVertex = JSON.parse(JSON.stringify(saved));
  missingVertex.points.splice(1, 1);
  assert.equal(route.validateDestinationRoute(missingVertex).reason, 'route-evidence-mismatch');
  const forgedDistance = JSON.parse(JSON.stringify(saved));
  forgedDistance.lengthM += 25;
  assert.equal(route.validateDestinationRoute(forgedDistance).reason, 'route-distance-mismatch');
  const reversedSegment = JSON.parse(JSON.stringify(saved));
  reversedSegment.routeEvidence.segments[0].from = reversedSegment.routeEvidence.segments[0].to;
  assert.equal(route.validateDestinationRoute(reversedSegment).reason, 'invalid-segment');
  const fabricatedNodeEvidence = JSON.parse(JSON.stringify(saved));
  delete fabricatedNodeEvidence.routeEvidence.nodes[0].providerElement;
  delete fabricatedNodeEvidence.routeEvidence.nodes[0].source;
  assert.equal(route.validateDestinationRoute(fabricatedNodeEvidence).reason, 'blocked-or-invalid-node');
  const tamperedType = JSON.parse(JSON.stringify(saved));
  tamperedType.routeEvidence.type = 'loop-route';
  assert.equal(route.validateDestinationRoute(tamperedType).reason, 'invalid-route-evidence');
  const partialSourceWay = route.planDestinationRoute(osm([way(7, [70, 71, 72], [p(0, 0), p(0, 100), p(0, 200)])]), p(0, 5), p(0, 90), { minRouteM: 20 });
  assert.equal(partialSourceWay.ok, true);
  assert.equal(partialSourceWay.route.routeEvidence.nodes.length, 2);
  const fullSourceWayNodes = JSON.parse(JSON.stringify(partialSourceWay.route));
  fullSourceWayNodes.routeEvidence.nodes.push({ id: '72', lat: p(0, 200).lat, lon: p(0, 200).lon, tags: {}, source: 'provider-node', providerElement: true });
  assert.equal(route.validateDestinationRoute(fullSourceWayNodes).valid, true);
  const oldLoop = require('../walking_route_core.js');
  const loop = oldLoop.parseOffers(osm([way(8, [80, 81, 82, 83, 80], [p(0, 0), p(0, 500), p(500, 500), p(500, 0), p(0, 0)])]), ORIGIN.lat, ORIGIN.lon)[0];
  assert.equal(oldLoop.validateOffer(loop).valid, true);
});

test('route DEM sampling decodes real Terrarium metres, route-wide slope and true flat zero', async () => {
  const routePoints = [p(0, 0), p(0, 150), p(0, 300)];
  const flatLoader = async () => elevation.syntheticTerrariumTile(0);
  const flat = await elevation.sampleRouteElevation(routePoints, { spacingM: 75, tileLoader: flatLoader });
  assert.equal(flat.available, true);
  assert.equal(flat.ascentM, 0);
  assert.equal(flat.descentM, 0);
  assert.equal(flat.samples.every(s => s.elevationM === 0), true);
  const slope = await elevation.sampleRouteElevation(routePoints, {
    spacingM: 75,
    tileLoader: async () => elevation.syntheticTerrariumTile(x => x * 2)
  });
  assert.equal(slope.available, true);
  assert.ok(slope.ascentM >= 30);
  assert.equal(slope.provenance.provider, 'Mapterhorn Terrarium512');
  assert.equal(elevation.decodeTerrariumPixel(128, 0, 0), 0);
});

test('unavailable DEM is explicit and reward quote uses a neutral elevation fallback', async () => {
  const unavailable = await elevation.sampleRouteElevation([p(0, 0), p(0, 300)], {
    tileLoader: async () => { throw new Error('network down'); }
  });
  assert.equal(unavailable.available, false);
  assert.match(unavailable.reason, /network down/);
  const measured = rewards.quoteDestinationReward({ distanceM: 3000 }, { available: true, ascentM: 120 }, { difficulty: 'moderate' });
  const neutral = rewards.quoteDestinationReward({ distanceM: 3000 }, unavailable, { difficulty: 'moderate' });
  assert.equal(neutral.elevation.status, 'unavailable');
  assert.equal(neutral.elevation.multiplier, rewards.CONSTANTS.NEUTRAL_ELEVATION_MULTIPLIER);
  assert.ok(measured.xp > neutral.xp);
  assert.ok(measured.coins >= neutral.coins);
  assert.deepEqual(neutral, rewards.deserializeQuote(JSON.stringify(neutral)));
});

test('distance elevation difficulty quotes are bounded, monotonic and use existing loot ids', () => {
  const short = rewards.quoteDestinationReward({ distanceM: 800 }, { available: true, ascentM: 0 }, { difficulty: 'easy' });
  const long = rewards.quoteDestinationReward({ distanceM: 6000 }, { available: true, ascentM: 0 }, { difficulty: 'easy' });
  const climb = rewards.quoteDestinationReward({ distanceM: 6000 }, { available: true, ascentM: 350 }, { difficulty: 'hard' });
  assert.ok(long.xp > short.xp);
  assert.ok(long.coins > short.coins);
  assert.ok(climb.xp > long.xp);
  assert.ok(climb.coins >= long.coins);
  assert.ok(climb.xp <= rewards.CONSTANTS.MAX_XP);
  assert.ok(climb.coins <= rewards.CONSTANTS.MAX_COINS);
  for (const quote of [short, long, climb]) {
    assert.ok(quote.loot.length >= 1);
    for (const item of quote.loot) assert.ok(rewards.CONSTANTS.EXISTING_LOOT_IDS.includes(item.id), item.id);
    assert.deepEqual(quote, rewards.deserializeQuote(JSON.stringify(quote)));
  }
});
