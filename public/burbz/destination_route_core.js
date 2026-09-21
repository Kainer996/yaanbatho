/* Destination route core: directed open walks from an arbitrary selected start
 * to an arbitrary selected endpoint. This is separate from walking_route_core's
 * loop/out-and-back offer mode so legacy quest certification keeps its old
 * semantics.
 */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDestinationRouteCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  const VERSION = 1;
  const KIND = 'destination-route';
  const DEFAULT_ENDPOINTS = Object.freeze([
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
  ]);
  const DEFAULTS = Object.freeze({
    minRouteM: 25,
    maxRouteM: 15000,
    maxAirDistanceM: 12000,
    maxEndpointSnapM: 45,
    queryPaddingM: 450,
    maxWays: 6500,
    maxNodes: 40000,
    maxElements: 47000,
    maxBodyBytes: 9000000,
    timeoutMs: 5000,
    totalTimeoutMs: 12000
  });
  const PATH_CLASSES = /^(footway|path|bridleway)$/;
  const CONNECTOR_CLASSES = /^(steps|pedestrian)$/;
  const ROAD_CLASSES = /^(residential|living_street|service|unclassified|tertiary|secondary|primary|tertiary_link|secondary_link|primary_link)$/;
  const ALLOW = /^(yes|designated|official|public|permissive)$/;
  const PUBLIC_DESIGNATION = /^(public_footpath|public_bridleway|restricted_byway|byway_open_to_all_traffic)$/;
  const DENY = /^(no|private|customers|destination|delivery|agricultural|forestry|permit|military|discouraged|unknown|variable|use_sidepath)$/;
  const EARTH_M = 6371000;

  function tryWalkingCore() {
    if (root && root.BurbzWalkingRouteCore) return root.BurbzWalkingRouteCore;
    if (typeof require === 'function') {
      try { return require('./walking_route_core.js'); } catch (_) {}
    }
    return null;
  }

  function text(value) { return String(value == null ? '' : value).trim().toLowerCase(); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function point(value) {
    if (value == null) return { lat: NaN, lon: NaN };
    return Array.isArray(value)
      ? { lat: Number(value[0]), lon: Number(value[1]) }
      : { lat: Number(value && value.lat), lon: Number(value && value.lon) };
  }
  function validPoint(value) {
    const p = point(value);
    return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180;
  }
  function distance(a, b) {
    a = point(a); b = point(b);
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r;
    const dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_M * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function routeLengthM(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
    return total;
  }
  function interpolate(a, b, t) {
    a = point(a); b = point(b);
    return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
  }
  function fail(code, message, extra) {
    return { ok: false, error: Object.assign({ code, message: message || code }, extra || {}) };
  }
  function hashString(value) {
    let h = 2166136261;
    for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
    return (h >>> 0).toString(36);
  }
  function fingerprint(points, segments) {
    return 'dest-v1-' + hashString(points.map(p => point(p).lat.toFixed(7) + ',' + point(p).lon.toFixed(7)).join(';') + '|' +
      (segments || []).map(s => [s.wayId, s.index, Number(s.from).toFixed(10), Number(s.to).toFixed(10)].join(':')).join(';'));
  }

  function hasCondition(tags) {
    return Object.keys(tags || {}).some(k => /^(access|foot|oneway:foot|foot:forward|foot:backward)(:.*)?:conditional$/.test(k) && text(tags[k])) ||
      !!text(tags && tags.opening_hours);
  }

  function classifyWay(tags) {
    tags = tags || {};
    const highway = text(tags.highway);
    const access = text(tags.access);
    const foot = text(tags.foot);
    const designation = text(tags.designation);
    let reason = null;
    if (DENY.test(foot) || DENY.test(access)) reason = 'restricted-access';
    if (!reason && hasCondition(tags)) reason = 'conditional-access';
    if (!reason && (text(tags.area) === 'yes' || text(tags.indoor) === 'yes')) reason = 'area-or-indoor';
    if (!reason && (text(tags.construction) || text(tags.disused) === 'yes' || text(tags.abandoned) === 'yes' || text(tags.impassable) === 'yes' || text(tags.smoothness) === 'impassable')) reason = 'unusable';
    if (!reason && text(tags.sac_scale) && !/^(hiking|t1-hiking)$/.test(text(tags.sac_scale))) reason = 'technical-hiking';
    if (!reason && text(tags.ford) && text(tags.ford) !== 'no') reason = 'ford';

    const network = PATH_CLASSES.test(highway) || CONNECTOR_CLASSES.test(highway);
    const road = ROAD_CLASSES.test(highway) && text(tags.motorroad) !== 'yes';
    const documented = network || road || (/^(track|cycleway)$/.test(highway) && (ALLOW.test(foot) || PUBLIC_DESIGNATION.test(designation)));
    if (!reason && !documented) reason = 'not-walking-network';

    let forward = true, backward = true;
    const ff = text(tags['foot:forward']);
    const fb = text(tags['foot:backward']);
    if (ff) {
      if (DENY.test(ff)) forward = false;
      else if (!ALLOW.test(ff)) reason = reason || 'unclear-direction';
    }
    if (fb) {
      if (DENY.test(fb)) backward = false;
      else if (!ALLOW.test(fb)) reason = reason || 'unclear-direction';
    }
    const oneway = text(tags['oneway:foot']);
    if (/^(yes|1|true)$/.test(oneway)) backward = false;
    else if (oneway === '-1') forward = false;
    else if (oneway && !/^(no|0|false)$/.test(oneway)) reason = reason || 'unclear-direction';

    const connector = road || CONNECTOR_CLASSES.test(highway) || /^(sidewalk|crossing|link)$/.test(text(tags.footway)) || highway === 'cycleway';
    const publicPath = !connector && (PUBLIC_DESIGNATION.test(designation) || /^(yes|designated|official|public)$/.test(foot) || access === 'public');
    return {
      eligible: !reason && (forward || backward),
      reason,
      path: !connector,
      publicPath,
      permissive: foot === 'permissive' || access === 'permissive',
      steps: highway === 'steps',
      forward,
      backward
    };
  }

  function nodeBlocked(tags) {
    tags = tags || {};
    if (DENY.test(text(tags.foot)) || DENY.test(text(tags.access)) || hasCondition(tags)) return true;
    if (text(tags.ford) && text(tags.ford) !== 'no') return true;
    const barrier = text(tags.barrier);
    if (!barrier || barrier === 'no' || barrier === 'entrance') return false;
    if (ALLOW.test(text(tags.foot)) || ALLOW.test(text(tags.access))) return false;
    return !/^(stile|kissing_gate|bollard|cycle_barrier|kerb)$/.test(barrier);
  }

  function parseRestrictions(elements) {
    const no = new Set();
    const only = new Map();
    for (const rel of elements.filter(e => e && e.type === 'relation')) {
      const restriction = text(rel.tags && rel.tags['restriction:foot']);
      if (!restriction) continue;
      const members = Array.isArray(rel.members) ? rel.members : [];
      const from = members.filter(m => m.role === 'from' && m.type === 'way');
      const to = members.filter(m => m.role === 'to' && m.type === 'way');
      const via = members.filter(m => m.role === 'via');
      if (from.length !== 1 || to.length !== 1 || via.length !== 1 || via[0].type !== 'node') {
        return { error: 'unsupported-restriction', relationId: rel.id, reason: 'Only single via-node foot restrictions are supported.' };
      }
      if (!/^(no_|only_)/.test(restriction)) {
        return { error: 'unsupported-restriction', relationId: rel.id, reason: 'Unsupported foot restriction value.' };
      }
      const key = String(from[0].ref) + '|' + String(via[0].ref);
      if (restriction.indexOf('no_') === 0) no.add(key + '|' + String(to[0].ref));
      else {
        if (!only.has(key)) only.set(key, new Set());
        only.get(key).add(String(to[0].ref));
      }
    }
    return { no, only };
  }

  function explicitProviderNode(element) {
    if (!element || element.type !== 'node' || element.id == null) return null;
    const p = point(element);
    if (!validPoint(p)) return null;
    return {
      id: String(element.id),
      lat: p.lat,
      lon: p.lon,
      tags: Object.assign({}, element.tags || {}),
      source: 'provider-node',
      providerElement: true
    };
  }

  function stableTags(tags) {
    tags = tags || {};
    return Object.keys(tags).sort().map(k => k + '=' + String(tags[k])).join('&');
  }

  function hasExplicitProviderNodeEvidence(node) {
    return !!(node && (node.providerElement === true || node.source === 'provider-node'));
  }

  function buildGraph(json, opts) {
    opts = Object.assign({}, DEFAULTS, opts || {});
    if (!json || !Array.isArray(json.elements)) return { error: 'provider-invalid-data' };
    if (json.remark) return { error: 'provider-partial', remark: String(json.remark) };
    const elements = json.elements;
    if (elements.length > opts.maxElements) return { error: 'provider-too-large' };
    const restrictions = parseRestrictions(elements);
    if (restrictions.error) return restrictions;

    const providerNodes = new Map();
    const conflicts = new Set();
    for (const e of elements) {
      const n = explicitProviderNode(e);
      if (!n) continue;
      const existing = providerNodes.get(n.id);
      if (existing) {
        if (distance(existing, n) > 0.5 || stableTags(existing.tags) !== stableTags(n.tags)) conflicts.add(n.id);
        continue;
      }
      providerNodes.set(n.id, n);
    }
    const nodes = new Map();
    const segments = [];
    const ways = new Map();
    let skippedWays = 0, missingTopology = 0;

    for (const w of elements.filter(e => e && e.type === 'way')) {
      const id = String(w.id);
      const info = classifyWay(w.tags || {});
      if (!info.eligible) { skippedWays++; continue; }
      if (!Array.isArray(w.nodes) || !Array.isArray(w.geometry) || w.nodes.length !== w.geometry.length) { missingTopology++; continue; }
      const geometry = w.geometry.map(g => g ? point(g) : null);
      const cleanNodes = w.nodes.map(String);
      let completeTopology = true;
      for (let i = 0; i < cleanNodes.length; i++) {
        const key = cleanNodes[i], p = geometry[i], sourceNode = providerNodes.get(key);
        if (!sourceNode || !validPoint(p) || !validPoint(sourceNode) || conflicts.has(key) || distance(sourceNode, p) > 0.5) {
          completeTopology = false;
          break;
        }
      }
      if (!completeTopology) { missingTopology++; continue; }
      ways.set(id, { id, nodes: cleanNodes, geometry, tags: Object.assign({}, w.tags || {}) });
      for (let i = 0; i < cleanNodes.length; i++) {
        const key = cleanNodes[i], p = providerNodes.get(key);
        const existing = nodes.get(key);
        if (existing && distance(existing, p) > 0.5) conflicts.add(key);
        else if (!existing) nodes.set(key, { id: key, lat: p.lat, lon: p.lon, tags: Object.assign({}, p.tags || {}), source: 'provider-node', providerElement: true, outgoing: [] });
      }
      for (let i = 1; i < cleanNodes.length; i++) {
        const a = cleanNodes[i - 1], b = cleanNodes[i];
        const pa = geometry[i - 1], pb = geometry[i];
        if (a === b || !validPoint(pa) || !validPoint(pb)) { missingTopology++; continue; }
        const len = distance(pa, pb);
        if (!(len > 0.05)) continue;
        segments.push({ id: segments.length, wayId: id, index: i - 1, a, b, pa, pb, len, info });
      }
    }

    if (nodes.size > opts.maxNodes || ways.size > opts.maxWays) return { error: 'provider-too-large' };
    const baseArcs = [];
    for (const seg of segments) {
      if (conflicts.has(seg.a) || conflicts.has(seg.b)) continue;
      const aNode = nodes.get(seg.a), bNode = nodes.get(seg.b);
      if (!aNode || !bNode || nodeBlocked(aNode.tags) || nodeBlocked(bNode.tags)) continue;
      if (seg.info.forward) baseArcs.push(makeArc(seg, seg.a, seg.b, 0, 1));
      if (seg.info.backward) baseArcs.push(makeArc(seg, seg.b, seg.a, 1, 0));
    }
    for (const arc of baseArcs) nodes.get(arc.from).outgoing.push(arc);
    if (!baseArcs.length) return { error: 'no-walkable-data', skippedWays, missingTopology };
    return { nodes, ways, segments, restrictions, skippedWays, missingTopology };
  }

  function makeArc(seg, from, to, f0, f1) {
    return {
      id: 'a/' + seg.id + '/' + f0 + '/' + f1,
      from,
      to,
      wayId: seg.wayId,
      index: seg.index,
      segment: seg,
      f0,
      f1,
      len: seg.len * Math.abs(f1 - f0),
      // Prefer public footpaths; pavements/roads remain connected alternatives.
      cost: seg.len * Math.abs(f1 - f0) * (seg.info.publicPath ? 0.8 : seg.info.path ? 1 : 1.8),
      path: seg.info.path,
      publicPath: seg.info.publicPath
    };
  }

  function nearestOnSegment(seg, p) {
    const cos = Math.max(0.001, Math.cos(point(p).lat * Math.PI / 180));
    const x = (seg.pb.lon - seg.pa.lon) * cos, y = seg.pb.lat - seg.pa.lat;
    const denom = x * x + y * y;
    const t = denom ? Math.max(0, Math.min(1, (((point(p).lon - seg.pa.lon) * cos) * x + (point(p).lat - seg.pa.lat) * y) / denom)) : 0;
    const spot = interpolate(seg.pa, seg.pb, t);
    return { segment: seg, t, point: spot, distanceM: distance(p, spot) };
  }

  function projectEndpoint(graph, p, role, opts) {
    let best = null;
    for (const seg of graph.segments) {
      const hit = nearestOnSegment(seg, p);
      if (nodeBlocked(graph.nodes.get(seg.a)?.tags) || nodeBlocked(graph.nodes.get(seg.b)?.tags)) continue;
      if (!best || hit.distanceM < best.distanceM) best = hit;
    }
    if (!best || best.distanceM > opts.maxEndpointSnapM) {
      return { error: fail('endpoint-too-far', role + ' is not within ' + opts.maxEndpointSnapM + 'm of mapped public walking geometry.', { role, snapDistanceM: best ? Math.round(best.distanceM) : null }) };
    }
    const t = best.t < 1e-10 ? 0 : best.t > 1 - 1e-10 ? 1 : best.t;
    const id = 'projection/' + role + '/' + best.segment.wayId + '/' + best.segment.index + '/' + t.toFixed(10);
    return {
      id,
      role,
      wayId: best.segment.wayId,
      index: best.segment.index,
      fraction: t,
      point: best.point,
      snapDistanceM: Math.round(best.distanceM * 100) / 100,
      note: 'Selected endpoint was snapped to mapped walking geometry; the off-path connector is not certified as a public walk.'
    };
  }

  function cloneSearchGraph(graph, start, end) {
    const nodes = new Map();
    graph.nodes.forEach((n, id) => nodes.set(id, { id, lat: n.lat, lon: n.lon, outgoing: n.outgoing.slice() }));
    function ensure(id, p) {
      if (!nodes.has(id)) nodes.set(id, { id, lat: p.lat, lon: p.lon, outgoing: [] });
      return nodes.get(id);
    }
    function endpointNode(proj) {
      if (proj.fraction === 0) return graph.segments.find(s => s.wayId === proj.wayId && s.index === proj.index).a;
      if (proj.fraction === 1) return graph.segments.find(s => s.wayId === proj.wayId && s.index === proj.index).b;
      ensure(proj.id, proj.point);
      return proj.id;
    }
    const startNode = endpointNode(start);
    const endNode = endpointNode(end);
    for (const proj of [start, end]) {
      if (proj.fraction === 0 || proj.fraction === 1) continue;
      const seg = graph.segments.find(s => s.wayId === proj.wayId && s.index === proj.index);
      const virtual = nodes.get(proj.id);
      if (seg.info.forward) {
        virtual.outgoing.push(makeArc(seg, proj.id, seg.b, proj.fraction, 1));
        nodes.get(seg.a).outgoing.push(makeArc(seg, seg.a, proj.id, 0, proj.fraction));
      }
      if (seg.info.backward) {
        virtual.outgoing.push(makeArc(seg, proj.id, seg.a, proj.fraction, 0));
        nodes.get(seg.b).outgoing.push(makeArc(seg, seg.b, proj.id, 1, proj.fraction));
      }
    }
    if (start.wayId === end.wayId && start.index === end.index && start.fraction !== end.fraction) {
      const seg = graph.segments.find(s => s.wayId === start.wayId && s.index === start.index);
      if (end.fraction > start.fraction && seg.info.forward) ensure(startNode, start.point).outgoing.push(makeArc(seg, startNode, endNode, start.fraction, end.fraction));
      if (end.fraction < start.fraction && seg.info.backward) ensure(startNode, start.point).outgoing.push(makeArc(seg, startNode, endNode, start.fraction, end.fraction));
    }
    return { nodes, startNode, endNode };
  }

  function turnAllowed(graph, previousArc, viaNode, nextArc) {
    if (!previousArc || !previousArc.wayId || !nextArc.wayId || previousArc.wayId === nextArc.wayId) return true;
    const base = previousArc.wayId + '|' + viaNode;
    if (graph.restrictions.no.has(base + '|' + nextArc.wayId)) return false;
    const only = graph.restrictions.only.get(base);
    return !only || only.has(nextArc.wayId);
  }

  function shortestPath(graph, work) {
    const startKey = work.startNode + '|';
    const costs = new Map([[startKey, 0]]);
    const parent = new Map();
    const heap = [[0, work.startNode, null, startKey]];
    let finalKey = null;
    let guard = 0;
    while (heap.length && guard++ < DEFAULTS.maxNodes * 10) {
      heap.sort((a, b) => b[0] - a[0]);
      const [cost, id, previousArc, stateKey] = heap.pop();
      if (cost !== costs.get(stateKey)) continue;
      if (id === work.endNode) { finalKey = stateKey; break; }
      const node = work.nodes.get(id);
      if (!node) continue;
      for (const arc of node.outgoing) {
        if (!turnAllowed(graph, previousArc, id, arc)) continue;
        const nextKey = arc.to + '|' + arc.wayId;
        const nextCost = cost + (arc.cost == null ? arc.len : arc.cost);
        if (!costs.has(nextKey) || nextCost < costs.get(nextKey)) {
          costs.set(nextKey, nextCost);
          parent.set(nextKey, { previousKey: stateKey, arc });
          heap.push([nextCost, arc.to, arc, nextKey]);
        }
      }
    }
    if (!finalKey) return null;
    const arcs = [];
    let current = finalKey, safety = 0;
    while (current !== startKey && safety++ < DEFAULTS.maxNodes) {
      const prev = parent.get(current);
      if (!prev) return null;
      arcs.push(prev.arc);
      current = prev.previousKey;
    }
    return arcs.reverse();
  }

  function uniqueBy(array, keyFn) {
    const seen = new Set(), out = [];
    for (const item of array) {
      const key = keyFn(item);
      if (!seen.has(key)) { seen.add(key); out.push(item); }
    }
    return out;
  }

  function routeFromArcs(graph, arcs, start, end, opts, providerMeta) {
    if (!arcs || !arcs.length) return fail('route-unreachable', 'No directed public walking-network route connects the selected endpoints.');
    const points = [];
    const segments = [];
    let publicM = 0, pathM = 0;
    for (const arc of arcs) {
      const a = interpolate(arc.segment.pa, arc.segment.pb, arc.f0);
      const b = interpolate(arc.segment.pa, arc.segment.pb, arc.f1);
      if (!points.length) points.push(a);
      else if (distance(points[points.length - 1], a) > 0.5) return fail('internal-disconnected-route', 'Route reconstruction found a geometry gap.');
      points.push(b);
      if (arc.path) pathM += arc.len;
      if (arc.publicPath) publicM += arc.len;
      segments.push({
        wayId: arc.wayId,
        index: arc.index,
        from: arc.f0,
        to: arc.f1,
        fromNode: arc.segment.a,
        toNode: arc.segment.b,
        lengthM: Math.round(arc.len * 100) / 100,
        access: {
          highway: text(graph.ways.get(arc.wayId).tags.highway) || null,
          designation: text(graph.ways.get(arc.wayId).tags.designation) || null,
          access: text(graph.ways.get(arc.wayId).tags.access) || null,
          foot: text(graph.ways.get(arc.wayId).tags.foot) || null,
          onewayFoot: text(graph.ways.get(arc.wayId).tags['oneway:foot']) || null
        }
      });
    }
    const lengthM = routeLengthM(points);
    if (lengthM < opts.minRouteM) return fail('route-too-short', 'Destination route is shorter than the supported minimum.', { lengthM: Math.round(lengthM), minRouteM: opts.minRouteM });
    if (lengthM > opts.maxRouteM) return fail('route-too-long', 'Destination route is longer than the supported maximum.', { lengthM: Math.round(lengthM), maxRouteM: opts.maxRouteM });
    const wayIds = uniqueBy(segments.map(s => s.wayId), x => x);
    const nodeIds = new Set();
    segments.forEach(s => { nodeIds.add(s.fromNode); nodeIds.add(s.toNode); });
    const evidence = {
      type: KIND,
      version: VERSION,
      source: 'OpenStreetMap',
      sourceTimestamp: providerMeta && providerMeta.sourceTimestamp || null,
      ways: wayIds.map(id => clone(graph.ways.get(id))),
      nodes: Array.from(nodeIds).map(id => {
        const n = graph.nodes.get(id);
        return { id, lat: n.lat, lon: n.lon, tags: Object.assign({}, n.tags || {}), source: 'provider-node', providerElement: true };
      }),
      segments,
      restrictions: {
        no: Array.from(graph.restrictions.no),
        only: Array.from(graph.restrictions.only.entries()).map(([key, values]) => [key, Array.from(values)])
      }
    };
    const fp = fingerprint(points, segments);
    return {
      ok: true,
      route: {
        routeSchemaVersion: VERSION,
        routeMode: 'destination',
        kind: KIND,
        networkVerified: true,
        source: 'OpenStreetMap',
        sourceTimestamp: evidence.sourceTimestamp,
        points,
        lengthM: Math.round(lengthM),
        pathShare: lengthM ? Math.round((pathM / lengthM) * 1000) / 1000 : 0,
        publicPathShare: lengthM ? Math.round((publicM / lengthM) * 1000) / 1000 : 0,
        routeFingerprint: fp,
        routeEvidence: evidence,
        projections: { start, end },
        routeDataNote: 'Route is suggested from public map data; access and conditions can change, so follow signs and conditions on the ground.'
      }
    };
  }

  function planMappedDestinationRoute(json, startInput, endInput, opts) {
    const opts2 = Object.assign({}, DEFAULTS, opts || {});
    const start = point(startInput), end = point(endInput);
    if (!validPoint(start) || !validPoint(end)) return fail('invalid-coordinate', 'Start and destination must be finite latitude/longitude coordinates.');
    const airM = distance(start, end);
    if (airM > opts2.maxAirDistanceM) return fail('selection-too-wide', 'Selected endpoints are outside the supported bounded search area.', { airDistanceM: Math.round(airM), maxAirDistanceM: opts2.maxAirDistanceM });
    const graph = buildGraph(json, opts2);
    if (graph.error) return fail(graph.error, graph.reason || graph.remark || graph.error, { relationId: graph.relationId, skippedWays: graph.skippedWays, missingTopology: graph.missingTopology });
    const startProjection = projectEndpoint(graph, start, 'start', opts2);
    const incompleteTopology = graph.missingTopology > 0;
    const incompleteTopologyFailure = () => fail('no-walkable-data', 'Provider data is missing required node topology for the selected route.', { skippedWays: graph.skippedWays, missingTopology: graph.missingTopology });
    if (startProjection.error && incompleteTopology) return incompleteTopologyFailure();
    if (startProjection.error) return startProjection.error;
    const endProjection = projectEndpoint(graph, end, 'end', opts2);
    if (endProjection.error && incompleteTopology) return incompleteTopologyFailure();
    if (endProjection.error) return endProjection.error;
    if (distance(startProjection.point, endProjection.point) < opts2.minRouteM) {
      return fail('route-too-short', 'Destination route is shorter than the supported minimum.', { lengthM: Math.round(distance(startProjection.point, endProjection.point)), minRouteM: opts2.minRouteM });
    }
    const work = cloneSearchGraph(graph, startProjection, endProjection);
    const arcs = shortestPath(graph, work);
    return routeFromArcs(graph, arcs, startProjection, endProjection, opts2, { sourceTimestamp: json.osm3s && json.osm3s.timestamp_osm_base || null });
  }

  // Guidance is a separate save schema, never invented OSM evidence. Mapped
  // parts retain the complete v1 evidence and gaps remain explicit to the player.
  function guidanceRoute(start, end, parts, reason) {
    const points = [];
    for (const part of parts) {
      const line = part.kind === 'mapped' ? part.route.points : part.points;
      if (!points.length) points.push(point(line[0]));
      points.push(...line.slice(1).map(point));
    }
    const gaps = parts.filter(p => p.kind === 'guidance');
    const gapM = gaps.reduce((sum, p) => sum + routeLengthM(p.points), 0);
    const lengthM = routeLengthM(points);
    return { ok: true, route: {
      routeSchemaVersion: 2, routeMode: 'destination', kind: KIND,
      networkVerified: gaps.length === 0, source: 'walking-guidance',
      points, lengthM: Math.round(lengthM), selectedStart: point(start), selectedEnd: point(end),
      guidanceDistanceM: Math.round(gapM),
      pathShare: lengthM ? parts.reduce((n,p) => n + (p.route ? p.route.lengthM * p.route.pathShare : 0), 0) / lengthM : 0,
      publicPathShare: lengthM ? parts.reduce((n,p) => n + (p.route ? p.route.lengthM * p.route.publicPathShare : 0), 0) / lengthM : 0,
      routeFingerprint: 'dest-v2-' + hashString(JSON.stringify({start:point(start),end:point(end),parts})),
      routeEvidence: {type:KIND,version:2,parts}, fallbackReason: reason || null,
      routeDataNote: gaps.length ? 'Dashed gaps show direction only, not a mapped path. Choose your own accessible way; any route to your destination counts.' : 'Suggested public paths and roads. Any route to your destination counts.'
    }};
  }
  function directGuidance(start, end, reason) {
    return guidanceRoute(start, end, [{kind:'guidance',points:[point(start),point(end)]}], reason);
  }
  function planDestinationRoute(json, startInput, endInput, opts) {
    if (opts && opts.requireMappedRoute) return planMappedDestinationRoute(json, startInput, endInput, opts);
    const start = point(startInput), end = point(endInput);
    if (!validPoint(start) || !validPoint(end)) return fail('invalid-coordinate', 'Choose valid start and destination coordinates.');
    const limits = Object.assign({}, DEFAULTS, opts || {}, {minRouteM:0,maxRouteM:Infinity,maxEndpointSnapM:Infinity,maxAirDistanceM:Infinity});
    if (distance(start,end) > DEFAULTS.maxAirDistanceM) return directGuidance(start,end,'selection-outside-map-search');
    const graph = buildGraph(json,limits);
    if (graph.error) return directGuidance(start,end,graph.error);
    const a = projectEndpoint(graph,start,'start',limits), b = projectEndpoint(graph,end,'end',limits);
    if (a.error || b.error) return directGuidance(start,end,'no-mapped-connection');
    const work = cloneSearchGraph(graph,a,b);
    let arcs = shortestPath(graph,work);
    if (!arcs) {
      // Connect a bounded set of separate map components. Penalising guidance
      // heavily keeps existing public paths/roads whenever they connect.
      const parents = new Map();
      const find = id => {let p=id;while(parents.get(p)!==p)p=parents.get(p);while(id!==p){const next=parents.get(id);parents.set(id,p);id=next;}return p;};
      work.nodes.forEach((n,id)=>parents.set(id,id));
      work.nodes.forEach(n=>n.outgoing.forEach(arc=>{const x=find(arc.from),y=find(arc.to);if(x!==y)parents.set(x,y);}));
      const groups = new Map();
      work.nodes.forEach((n,id)=>{if(nodeBlocked(graph.nodes.get(id)?.tags))return;const k=find(id);if(!groups.has(k))groups.set(k,[]);groups.get(k).push(n);});
      const startGroup=find(work.startNode),endGroup=find(work.endNode);
      const ranked=[...groups.entries()].map(([id,nodes])=>({id,nodes,score:id===startGroup||id===endGroup ? -1 : nodes.reduce((best,n)=>Math.min(best,distance(start,n)+distance(n,end)),Infinity)})).sort((a,b)=>a.score-b.score).slice(0,32).map(g=>[g.id,g.nodes]);
      const representatives=ranked.map(([id,nodes])=>{
        const selected=[...nodes].sort((x,y)=>(distance(start,x)+distance(x,end))-(distance(start,y)+distance(y,end))).slice(0,8);
        for(let i=0;i<8;i++)selected.push(nodes[Math.floor(i*(nodes.length-1)/7)]);
        for(const key of [work.startNode,work.endNode])if(find(key)===id)selected.push(work.nodes.get(key));
        return uniqueBy(selected,n=>n.id);
      });
      const addGap=(x,y)=>{const len=distance(x,y);x.outgoing.push({from:x.id,to:y.id,wayId:null,len,cost:len*8+25,guidance:true,pa:point(x),pb:point(y)});};
      for(let i=0;i<representatives.length;i++)for(let j=i+1;j<representatives.length;j++){
        let best=null;
        for(const x of representatives[i])for(const y of representatives[j]){const d=distance(x,y);if(!best||d<best.d)best={x,y,d};}
        if(best){addGap(best.x,best.y);addGap(best.y,best.x);}
      }
      arcs=shortestPath(graph,work);
    }
    if (!arcs || !arcs.length) return directGuidance(start,end,'no-mapped-connection');
    const parts=[];let block=[];
    const flush=()=>{if(!block.length)return;const r=routeFromArcs(graph,block,a,b,limits,{sourceTimestamp:json.osm3s?.timestamp_osm_base});if(r.ok)parts.push({kind:'mapped',route:r.route});block=[];};
    if(distance(start,a.point)>0)parts.push({kind:'guidance',points:[start,a.point]});
    for(const arc of arcs){if(arc.guidance){flush();parts.push({kind:'guidance',points:[arc.pa,arc.pb]});}else block.push(arc);}
    flush();
    if(distance(b.point,end)>0)parts.push({kind:'guidance',points:[b.point,end]});
    if(parts.length===1 && parts[0].kind==='mapped')return {ok:true,route:parts[0].route};
    const result=guidanceRoute(start,end,parts);
    return validateDestinationRoute(result.route).valid ? result : directGuidance(start,end,'map-gap');
  }
  function validateGuidanceRoute(value) {
    const invalid=reason=>({valid:false,certified:false,reason});
    const e=value.routeEvidence;
    if(value.routeMode!=='destination'||value.kind!==KIND||e?.type!==KIND||e.version!==2||!Array.isArray(e.parts)||!e.parts.length||e.parts.length>1000)return invalid('invalid-guidance-evidence');
    if(!validPoint(value.selectedStart)||!validPoint(value.selectedEnd))return invalid('invalid-endpoints');
    let last=point(value.selectedStart);
    for(const part of e.parts){
      if(part.kind==='mapped') {if(part.route?.routeSchemaVersion!==1||!validateDestinationRoute(part.route).valid)return invalid('invalid-mapped-part');}
      else if(part.kind!=='guidance'||!Array.isArray(part.points)||part.points.length!==2)return invalid('invalid-guidance-part');
      const points=part.kind==='mapped'?part.route.points:part.points;
      if(points.some(p=>!validPoint(p))||distance(last,points[0])>0.01)return invalid('disconnected-guidance');
      last=point(points[points.length-1]);
    }
    if(distance(last,value.selectedEnd)>0.01)return invalid('wrong-destination');
    const rebuilt=guidanceRoute(value.selectedStart,value.selectedEnd,e.parts).route;
    for(const key of ['points','lengthM','routeFingerprint','networkVerified','guidanceDistanceM'])if(JSON.stringify(value[key])!==JSON.stringify(rebuilt[key]))return invalid('guidance-'+key+'-mismatch');
    return {valid:true,certified:rebuilt.networkVerified,reason:null,lengthM:rebuilt.lengthM,source:'walking-guidance'};
  }

  function keyAt(way, index, fraction) {
    if (fraction === 0) return 'n/' + way.nodes[index];
    if (fraction === 1) return 'n/' + way.nodes[index + 1];
    return 's/' + way.id + '/' + index + '/' + Number(fraction).toFixed(10);
  }

  function validateDestinationRoute(value) {
    if (value && value.routeSchemaVersion === 2) return validateGuidanceRoute(value);
    function invalid(reason) { return { valid: false, certified: false, reason }; }
    if (!value || value.routeSchemaVersion !== VERSION || value.routeMode !== 'destination' || value.kind !== KIND) return invalid('invalid-route-type');
    const evidence = value.routeEvidence;
    if (!evidence || evidence.type !== KIND || evidence.version !== VERSION || !Array.isArray(evidence.ways) || !Array.isArray(evidence.nodes) || !Array.isArray(evidence.segments)) return invalid('invalid-route-evidence');
    if (!Array.isArray(value.points) || value.points.length < 2) return invalid('invalid-route');
    const ways = new Map(), nodes = new Map();
    evidence.ways.forEach(w => { if (w && w.id != null) ways.set(String(w.id), w); });
    evidence.nodes.forEach(n => { if (n && n.id != null) nodes.set(String(n.id), n); });
    const expected = [];
    let previousKey = null, total = 0;
    for (let i = 0; i < evidence.segments.length; i++) {
      const s = evidence.segments[i], way = s && ways.get(String(s.wayId));
      if (!way || !Array.isArray(way.nodes) || !Array.isArray(way.geometry) || !Number.isInteger(s.index) || s.index < 0 || s.index + 1 >= way.nodes.length) return invalid('ineligible-way');
      const info = classifyWay(way.tags || {});
      if (!info.eligible) return invalid('ineligible-way');
      const from = Number(s.from), to = Number(s.to);
      if (!Number.isFinite(from) || !Number.isFinite(to) || from < 0 || from > 1 || to < 0 || to > 1 || from === to) return invalid('invalid-segment');
      if (to > from ? !info.forward : !info.backward) return invalid('restricted-direction');
      const a = point(way.geometry[s.index]), b = point(way.geometry[s.index + 1]);
      if (!validPoint(a) || !validPoint(b)) return invalid('invalid-segment');
      const na = nodes.get(String(way.nodes[s.index])), nb = nodes.get(String(way.nodes[s.index + 1]));
      if (!na || !nb || !hasExplicitProviderNodeEvidence(na) || !hasExplicitProviderNodeEvidence(nb) || nodeBlocked(na.tags || {}) || nodeBlocked(nb.tags || {}) || distance(na, a) > 0.5 || distance(nb, b) > 0.5) return invalid('blocked-or-invalid-node');
      const fromKey = keyAt(way, s.index, from), toKey = keyAt(way, s.index, to);
      if (i && previousKey !== fromKey) return invalid('disconnected-route');
      if (!i) expected.push(interpolate(a, b, from));
      expected.push(interpolate(a, b, to));
      previousKey = toKey;
      total += distance(interpolate(a, b, from), interpolate(a, b, to));
    }
    const points = value.points.map(point);
    if (points.some(p => !validPoint(p)) || points.length !== expected.length) return invalid('route-evidence-mismatch');
    for (let i = 0; i < points.length; i++) if (distance(points[i], expected[i]) > 1) return invalid('route-evidence-mismatch');
    if (value.routeFingerprint !== fingerprint(expected, evidence.segments)) return invalid('route-fingerprint-mismatch');
    if (!Number.isFinite(value.lengthM) || Math.abs(Number(value.lengthM) - total) > 2) return invalid('route-distance-mismatch');
    return { valid: true, certified: true, reason: null, lengthM: Math.round(total), source: 'OpenStreetMap', sourceTimestamp: evidence.sourceTimestamp || null };
  }

  function bboxFor(startInput, endInput, opts) {
    const opts2 = Object.assign({}, DEFAULTS, opts || {});
    const start = point(startInput), end = point(endInput);
    if (!validPoint(start) || !validPoint(end)) throw new Error('invalid-coordinate');
    const midLat = (start.lat + end.lat) / 2;
    const padLat = opts2.queryPaddingM / 111320;
    const padLon = opts2.queryPaddingM / (111320 * Math.max(0.05, Math.cos(midLat * Math.PI / 180)));
    return {
      south: Math.max(-90, Math.min(start.lat, end.lat) - padLat),
      west: Math.max(-180, Math.min(start.lon, end.lon) - padLon),
      north: Math.min(90, Math.max(start.lat, end.lat) + padLat),
      east: Math.min(180, Math.max(start.lon, end.lon) + padLon)
    };
  }

  function buildDestinationOverpassQuery(start, end, opts) {
    const box = bboxFor(start, end, opts);
    const b = [box.south, box.west, box.north, box.east].map(n => n.toFixed(6)).join(',');
    const timeout = Math.max(8, Math.min(25, Math.round(((opts && opts.timeoutMs) || DEFAULTS.timeoutMs) / 1000)));
    return '[out:json][timeout:' + timeout + '][maxsize:9437184];' +
      'way[highway~"^(path|footway|bridleway|track|pedestrian|steps|cycleway|residential|living_street|service|unclassified|tertiary|secondary|primary|tertiary_link|secondary_link|primary_link)$"](' + b + ')->.paths;' +
      '(.paths;node(w.paths);relation(bw.paths)[type=restriction]["restriction:foot"];);out body geom;';
  }

  function bodyHash(textValue) {
    return 'fnv1a-' + hashString(String(textValue || ''));
  }

  function parseProviderJson(textValue) {
    try { return { json: JSON.parse(textValue) }; }
    catch (_) { return { error: 'provider-invalid-json' }; }
  }

  function timeoutError() {
    const err = new Error('provider-timeout');
    err.code = 'provider-timeout';
    return err;
  }

  async function fetchWithBodyTimeout(fetchFn, endpoint, query, opts, signal) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    let timer = null, timedOut = false;
    let removeAbort = null;
    if (signal && signal.aborted) throw Object.assign(new Error('provider-cancelled'), { code: 'provider-cancelled' });
    if (signal && ctrl) {
      const onAbort = () => ctrl.abort();
      signal.addEventListener('abort', onAbort, { once: true });
      removeAbort = () => signal.removeEventListener('abort', onAbort);
    }
    try {
      const timeout = new Promise((_, reject) => {
        timer = setTimeout(() => {
          timedOut = true;
          reject(timeoutError());
          if (ctrl) ctrl.abort();
        }, opts.timeoutMs);
      });
      return await Promise.race([timeout, Promise.resolve().then(async () => {
        const response = await fetchFn(endpoint, {
          method: opts.method === 'GET' ? 'GET' : 'POST',
          ...(opts.method === 'GET' ? {} : {body:'data=' + encodeURIComponent(query),headers:{'Content-Type':'application/x-www-form-urlencoded'}}),
          signal: ctrl ? ctrl.signal : signal
        });
        if (!response || response.status === 429) throw Object.assign(new Error('provider-rate-limited'), { code: 'provider-rate-limited', status: response && response.status });
        if (!response.ok) throw Object.assign(new Error('provider-http'), { code: 'provider-http', status: response.status });
        const textValue = await response.text();
        if (textValue.length > opts.maxBodyBytes) throw Object.assign(new Error('provider-body-too-large'), { code: 'provider-body-too-large' });
        return {
          text: textValue,
          status: response.status,
          cors: response.headers && typeof response.headers.get === 'function' ? response.headers.get('access-control-allow-origin') : null
        };
      })]);
    } catch (err) {
      if (timedOut) throw timeoutError();
      if ((signal && signal.aborted) || err.name === 'AbortError') throw Object.assign(new Error('provider-cancelled'), { code: 'provider-cancelled' });
      throw err;
    } finally {
      if (timer) clearTimeout(timer);
      if (removeAbort) removeAbort();
    }
  }

  const recentMapData = new Map();
  function mapApiEndpoint(start,end,opts) {
    const b=bboxFor(start,end,opts), mid={lat:(b.south+b.north)/2,lon:(b.west+b.east)/2};
    const area=distance({lat:b.south,lon:mid.lon},{lat:b.north,lon:mid.lon})*distance({lat:mid.lat,lon:b.west},{lat:mid.lat,lon:b.east});
    if(area>4000000 || b.east-b.west>1) return null;
    return 'https://api.openstreetmap.org/api/0.6/map.json?bbox='+[b.west,b.south,b.east,b.north].map(n=>n.toFixed(6)).join(',');
  }
  async function fetchDestinationRoute(start, end, opts) {
    const opts2 = Object.assign({}, DEFAULTS, opts || {});
    if (!validPoint(start) || !validPoint(end)) return fail('invalid-coordinate', 'Start and destination must be finite latitude/longitude coordinates.');
    if (opts2.signal && opts2.signal.aborted) return fail('provider-cancelled', 'Route request was cancelled.');
    const airM = distance(start, end);
    if (airM > opts2.maxAirDistanceM) return opts2.requireMappedRoute ? fail('selection-too-wide', 'Selected endpoints are outside the supported bounded search area.') : directGuidance(start,end,'selection-outside-map-search');
    const query = buildDestinationOverpassQuery(start, end, opts2);
    const endpoints = (opts2.endpoints || DEFAULT_ENDPOINTS).map(endpoint=>({endpoint}));
    const mapApi = (!opts2.endpoints || opts2.mapApiFallback === true) && opts2.mapApiFallback !== false ? mapApiEndpoint(start,end,opts2) : null;
    if(mapApi) endpoints.splice(1,0,{endpoint:mapApi,method:'GET'});
    const fetchFn = opts2.fetchFn || (root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    if (!fetchFn) return opts2.requireMappedRoute ? fail('provider-unavailable', 'No fetch implementation is available.') : directGuidance(start,end,'provider-unavailable');
    if (root?.navigator?.onLine === false && !opts2.fetchFn && !opts2.requireMappedRoute) return directGuidance(start,end,'offline');
    const deadline=Date.now()+opts2.totalTimeoutMs;
    let last = null; const attempts=[];
    for (let index=0;index<endpoints.length;index++) {
      const {endpoint,method}=endpoints[index];
      if(Date.now()>=deadline)break;
      if(opts2.signal?.aborted)return fail('provider-cancelled','Route request was cancelled.');
      try {opts2.onProgress?.({attempt:index+1,total:endpoints.length,alternative:index>0});} catch(_){}
      try {
        const key=endpoint+'|'+query, stored=!opts2.fetchFn&&recentMapData.get(key);
        const response = stored && Date.now()-stored.at<300000 ? stored.response : await fetchWithBodyTimeout(fetchFn, endpoint, query, {...opts2,method,timeoutMs:Math.max(1,Math.min(opts2.timeoutMs,deadline-Date.now()))}, opts2.signal);
        const parsed = parseProviderJson(response.text);
        if (parsed.error) {
          last = fail(parsed.error, 'Routing provider returned non-JSON data.', { provider: endpoint, status: response.status, bodyHash: bodyHash(response.text) });
          continue;
        }
        if (!parsed.json || !Array.isArray(parsed.json.elements) || parsed.json.remark) {
          last = fail('provider-partial', 'Routing provider returned partial or incomplete map data.', { provider: endpoint, status: response.status, bodyHash: bodyHash(response.text), remark: parsed.json && parsed.json.remark || null });
          continue;
        }
        if(method==='GET'){
          // OSM API ways refer to explicit nodes rather than duplicating coordinates.
          const nodes=new Map(parsed.json.elements.filter(e=>e.type==='node').map(e=>[String(e.id),e]));
          parsed.json.elements=parsed.json.elements.map(e=>e.type==='way'&&!e.geometry&&Array.isArray(e.nodes)?{...e,geometry:e.nodes.map(id=>{const n=nodes.get(String(id));return n?{lat:n.lat,lon:n.lon}:null;})}:e);
        }
        const planned = planDestinationRoute(parsed.json, start, end, opts2);
        planned.provider = {
          endpoint,
          query,
          status: response.status,
          bodyHash: bodyHash(response.text),
          cors: response.cors || null,
          sourceTimestamp: parsed.json.osm3s && parsed.json.osm3s.timestamp_osm_base || null
        };
        if (planned.ok) {
          planned.route.provider = planned.provider;
          if(!opts2.fetchFn){recentMapData.set(key,{at:Date.now(),response});while(recentMapData.size>2)recentMapData.delete(recentMapData.keys().next().value);}
        }
        return planned;
      } catch (err) {
        const code = err && err.code || 'provider-network';
        attempts.push({provider:endpoint,code,status:err?.status||null});
        last = fail(code, 'The walking-map services are busy or unavailable. Your start and destination are kept. Try Preview again in a moment.', {provider:endpoint,status:err?.status||null,attempts});
        if (code === 'provider-cancelled') return last;
      }
    }
    if (opts2.signal?.aborted) return fail('provider-cancelled','Route request was cancelled.');
    return opts2.requireMappedRoute ? (last || fail('provider-unavailable', 'No routing provider could be reached.')) : directGuidance(start,end,last?.error?.code || 'provider-unavailable');
  }

  const api = {
    VERSION,
    KIND,
    DEFAULTS: Object.assign({}, DEFAULTS),
    DEFAULT_ENDPOINTS: DEFAULT_ENDPOINTS.slice(),
    classifyWay,
    nodeBlocked,
    routeLengthM,
    distance,
    buildDestinationOverpassQuery,
    bboxFor,
    planDestinationRoute,
    planMappedDestinationRoute,
    validateDestinationRoute,
    fetchDestinationRoute,
    _buildGraph: buildGraph
  };
  const walking = tryWalkingCore();
  if (walking && typeof walking.routeLengthM === 'function') api.legacyRouteLengthM = walking.routeLengthM;
  return api;
});
