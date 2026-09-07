/* Burbz walking routes: bounded, tagged OpenStreetMap topology, never tile
 * outlines or invented waypoint connections. Pure browser/Node module.
 *
 * Provider/tag decisions (checked 2026-09-07):
 * https://wiki.openstreetmap.org/wiki/Key:access — foot overrides general
 * access; restricted purposes and unevaluated conditions are not through access.
 * https://wiki.openstreetmap.org/wiki/Tag:highway%3Dfootway — sidewalks and
 * crossing links are connectors; area=yes outlines are not walking circuits.
 * https://dev.overpass-api.de/overpass-doc/en/full_data/bbox.html — clipped
 * geometry can be incomplete. We preserve node identities and skip each gap.
 * BRouter's hiking-mountain profile is a preference-based hiking router, not
 * independent proof of public access. New offers do not use it to self-certify:
 * https://github.com/abrensch/brouter/blob/master/misc/profiles2/hiking-mountain.brf
 *
 * Offer points contain the COMPLETE walk, including the actual reverse path
 * for out-and-back walks. Evidence is persisted for independent validation on
 * activation/reload; coordinates may only be rounded within 1 metre. OSM is
 * community mapping, not a survey or guarantee of current ground conditions.
 * Trail data © OpenStreetMap contributors (ODbL).
 */
(function (root) {
  'use strict';
  var VERSION = 1;
  var LIMITS = { ways: 6500, nodes: 40000, edges: 60000, components: 12, cycles: 200, offers: 8 };
  var PATH_CLASSES = /^(footway|path|bridleway)$/;
  var CONNECTOR_CLASSES = /^(steps|pedestrian)$/;
  var ALLOW = /^(yes|designated|official|public|permissive)$/;
  var DENY = /^(no|private|customers|destination|delivery|agricultural|forestry|permit|military|discouraged|use_sidepath|unknown|variable)$/;
  var PUBLIC_DESIGNATION = /^(public_footpath|public_bridleway|restricted_byway|byway_open_to_all_traffic)$/;
  function text(value) { return String(value == null ? '' : value).trim().toLowerCase(); }
  function point(p) { return Array.isArray(p) ? { lat: Number(p[0]), lon: Number(p[1]) } : { lat: Number(p && p.lat), lon: Number(p && p.lon) }; }
  function validPoint(p) { return p && Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= 90 && Math.abs(p.lon) <= 180; }
  function distance(a, b) {
    var r = Math.PI / 180, x = (b.lat - a.lat) * r, y = (b.lon - a.lon) * r;
    var h = Math.sin(x / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(y / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function length(points) { var m = 0; for (var i = 1; i < points.length; i++) m += distance(points[i - 1], points[i]); return m; }
  function interpolate(a, b, t) { return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t }; }
  function hash(value) { var h = 2166136261; for (var i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619); return (h >>> 0).toString(36); }
  function fingerprint(points) { return 'osm-v1-' + hash(points.map(function (p) { return p.lat.toFixed(5) + ',' + p.lon.toFixed(5); }).join(';')); }
  function explicitAccess(tags) { return text(tags.foot) || text(tags.access); }
  function hasCondition(tags) {
    return Object.keys(tags).some(function (k) { return /^(access|foot|oneway:foot)(:.*)?:conditional$/.test(k) && text(tags[k]); }) || !!text(tags.opening_hours);
  }
  function restrictionReason(tags) {
    var access = explicitAccess(tags);
    if (DENY.test(access) || (access && !ALLOW.test(access))) return 'restricted-access';
    if (hasCondition(tags)) return 'conditional-access';
    if (/^(yes|true|1)$/.test(text(tags.locked))) return 'locked';
    return null;
  }
  function classifyWay(tags) {
    tags = tags || {};
    var highway = text(tags.highway), access = explicitAccess(tags), reason = restrictionReason(tags);
    if (!reason && (text(tags.area) === 'yes' || text(tags.indoor) === 'yes' || (text(tags.conveying) && text(tags.conveying) !== 'no'))) reason = 'area-or-indoor';
    if (!reason && (text(tags.construction) || text(tags.disused) === 'yes' || text(tags.abandoned) === 'yes' || text(tags.impassable) === 'yes' || text(tags.smoothness) === 'impassable')) reason = 'unusable';
    if (!reason && text(tags.sac_scale) && !/^(hiking|t1-hiking)$/.test(text(tags.sac_scale))) reason = 'technical-hiking';
    if (!reason && (text(tags.ford) && text(tags.ford) !== 'no')) reason = 'ford';
    if (!reason && !(PATH_CLASSES.test(highway) || CONNECTOR_CLASSES.test(highway) || (/^(track|cycleway)$/.test(highway) && (ALLOW.test(access) || PUBLIC_DESIGNATION.test(text(tags.designation)))))) reason = 'not-walking-network';
    var connector = CONNECTOR_CLASSES.test(highway) || /^(sidewalk|crossing|link)$/.test(text(tags.footway)) || highway === 'cycleway';
    var publicAccess = PUBLIC_DESIGNATION.test(text(tags.designation)) || /^(yes|designated|official|public)$/.test(access);
    var forward = !text(tags['foot:forward']) || ALLOW.test(text(tags['foot:forward']));
    var backward = !text(tags['foot:backward']) || ALLOW.test(text(tags['foot:backward']));
    if (/^(yes|1|true)$/.test(text(tags['oneway:foot']))) backward = false;
    if (text(tags['oneway:foot']) === '-1') forward = false;
    if (text(tags['oneway:foot']) && !/^(yes|1|true|-1|no|0|false)$/.test(text(tags['oneway:foot']))) reason = 'unclear-direction';
    return { eligible: !reason && (forward || backward), reason: reason, path: !connector, publicPath: !connector && publicAccess && access !== 'permissive', permissive: access === 'permissive', steps: highway === 'steps', forward: forward, backward: backward };
  }
  function nodeBlocked(tags) {
    tags = tags || {};
    if (restrictionReason(tags)) return true;
    if (text(tags.ford) && text(tags.ford) !== 'no') return true;
    var barrier = text(tags.barrier);
    if (!barrier || barrier === 'no' || barrier === 'entrance') return false;
    if (ALLOW.test(explicitAccess(tags))) return false;
    return !/^(stile|kissing_gate|bollard|cycle_barrier|kerb)$/.test(barrier);
  }
  function buildOverpassQuery(lat, lon, radiusM) {
    if (!validPoint({ lat: lat, lon: lon })) throw new Error('Invalid search position');
    var radius = Math.max(500, Math.min(5000, Math.round(Number(radiusM) || 3000)));
    var around = 'around:' + radius + ',' + lat.toFixed(6) + ',' + lon.toFixed(6);
    // No output geometry clipping and no output row limit that silently splits
    // ways. Body geometry includes the node-id array; node body includes gates.
    return '[out:json][timeout:20][maxsize:8388608];way[highway~"^(path|footway|bridleway|track|pedestrian|steps|cycleway)$"](' + around + ')->.paths;(.paths;node(w.paths);relation(bw.paths)[type=restriction]["restriction:foot"];);out body geom;';
  }
  function diagnostics(status, reason, extra) { return Object.assign({ status: status, reason: reason, provider: 'OpenStreetMap' }, extra || {}); }
  function empty(status, reason, extra) { var out = []; out.diagnostics = diagnostics(status, reason, extra); return out; }
  function buildGraph(json) {
    var elements = json && json.elements;
    if (!Array.isArray(elements)) return { error: 'invalid-data' };
    if (json.remark) return { error: 'data-incomplete' };
    var ways = elements.filter(function (e) { return e && e.type === 'way'; });
    if (ways.length > LIMITS.ways || elements.length > LIMITS.nodes + LIMITS.ways + 200) return { error: 'data-limit' };
    var nodeTags = new Map(), excludedWays = new Set();
    elements.forEach(function (e) {
      if (e && e.type === 'node') nodeTags.set(String(e.id), e.tags || {});
      if (e && e.type === 'relation' && e.tags && e.tags['restriction:foot']) (e.members || []).forEach(function (m) { if (m.type === 'way') excludedWays.add(String(m.ref)); });
    });
    var nodes = new Map(), edges = [], sourceWays = new Map(), edgePairs = new Set(), conflicts = new Set();
    var skipped = 0, missingTopology = 0;
    ways.forEach(function (w) {
      var info = classifyWay(w.tags), wid = String(w.id);
      if (!info.eligible || excludedWays.has(wid)) { skipped++; return; }
      if (!Array.isArray(w.nodes) || !Array.isArray(w.geometry) || w.nodes.length !== w.geometry.length) { missingTopology++; return; }
      var geometry = w.geometry.map(function (p) { return p ? point(p) : null; });
      sourceWays.set(wid, { id: wid, nodes: w.nodes.map(String), geometry: geometry, tags: Object.assign({}, w.tags) });
      w.nodes.forEach(function (id, i) {
        var p = geometry[i], key = String(id);
        if (!validPoint(p) || id == null) return;
        if (nodes.has(key) && distance(nodes.get(key), p) > 0.5) { conflicts.add(key); return; }
        if (!nodes.has(key)) nodes.set(key, { id: key, lat: p.lat, lon: p.lon, edges: [], tags: nodeTags.get(key) || {} });
      });
      for (var i = 1; i < w.nodes.length; i++) {
        var a = String(w.nodes[i - 1]), b = String(w.nodes[i]);
        // Do not filter null geometry first: that draws a line across the hole.
        if (a === b || !validPoint(geometry[i - 1]) || !validPoint(geometry[i])) continue;
        var len = distance(geometry[i - 1], geometry[i]);
        if (!(len > 0.05)) continue;
        var pair = a < b ? a + '/' + b : b + '/' + a;
        if (edgePairs.has(pair)) continue;
        edgePairs.add(pair);
        edges.push({ id: edges.length, a: a, b: b, len: len, wayId: wid, index: i - 1, f0: 0, f1: 1, info: info });
      }
    });
    if (nodes.size > LIMITS.nodes || edges.length > LIMITS.edges) return { error: 'data-limit' };
    edges = edges.filter(function (e) { return !conflicts.has(e.a) && !conflicts.has(e.b) && !nodeBlocked(nodes.get(e.a).tags) && !nodeBlocked(nodes.get(e.b).tags); });
    edges.forEach(function (e, i) { e.id = i; nodes.get(e.a).edges.push(i); nodes.get(e.b).edges.push(i); });
    return { nodes: nodes, edges: edges, ways: sourceWays, skipped: skipped, missingTopology: missingTopology };
  }
  function nearestOnEdge(graph, e, p) {
    var a = graph.nodes.get(e.a), b = graph.nodes.get(e.b), cos = Math.max(0.001, Math.cos(p.lat * Math.PI / 180));
    var x = (b.lon - a.lon) * cos, y = b.lat - a.lat;
    var t = Math.max(0, Math.min(1, (((p.lon - a.lon) * cos) * x + (p.lat - a.lat) * y) / (x * x + y * y)));
    var spot = interpolate(a, b, t);
    return { edge: e.id, t: t, point: spot, distance: distance(p, spot) };
  }
  function componentStarts(graph, p, maxStartM, minUniqueM) {
    var assigned = new Set(), starts = [];
    graph.nodes.forEach(function (node) {
      if (assigned.has(node.id) || !node.edges.length) return;
      var queue = [node.id], candidates = new Set(); assigned.add(node.id);
      for (var i = 0; i < queue.length; i++) graph.nodes.get(queue[i]).edges.forEach(function (eid) {
        candidates.add(eid); var e = graph.edges[eid], next = e.a === queue[i] ? e.b : e.a;
        if (!assigned.has(next)) { assigned.add(next); queue.push(next); }
      });
      var best = null, componentLength = 0, pathLength = 0;
      candidates.forEach(function (eid) { var e = graph.edges[eid]; componentLength += e.len; if (e.info.path) pathLength += e.len; var hit = nearestOnEdge(graph, e, p); if (!best || hit.distance < best.distance) best = hit; });
      // A row of tiny disconnected pavement fragments must not occupy all of
      // the bounded search slots ahead of a useful park or countryside network.
      if (componentLength < minUniqueM || pathLength < minUniqueM * 0.5) return;
      if (best && best.distance <= maxStartM) starts.push(best);
    });
    return starts.sort(function (a, b) { return a.distance - b.distance; }).slice(0, LIMITS.components);
  }
  function splitStart(graph, hit) {
    var e = graph.edges[hit.edge];
    if (hit.t * e.len < 0.1) return e.a;
    if ((1 - hit.t) * e.len < 0.1) return e.b;
    var originalB = e.b, id = 'start/' + e.wayId + '/' + e.index;
    var fraction = e.f0 + (e.f1 - e.f0) * hit.t;
    graph.nodes.set(id, { id: id, lat: hit.point.lat, lon: hit.point.lon, edges: [e.id], tags: {} });
    graph.nodes.get(originalB).edges = graph.nodes.get(originalB).edges.filter(function (eid) { return eid !== e.id; });
    var second = Object.assign({}, e, { id: graph.edges.length, a: id, b: originalB, f0: fraction, len: e.len * (1 - hit.t) });
    e.b = id; e.f1 = fraction; e.len *= hit.t;
    graph.edges.push(second); graph.nodes.get(id).edges.push(second.id); graph.nodes.get(originalB).edges.push(second.id);
    return id;
  }
  function heapPush(heap, item) { var i = heap.length; heap.push(item); while (i) { var p = (i - 1) >> 1; if (heap[p][0] <= item[0]) break; heap[i] = heap[p]; i = p; } heap[i] = item; }
  function heapPop(heap) {
    var out = heap[0], last = heap.pop(); if (!heap.length) return out;
    var i = 0;
    while (i * 2 + 1 < heap.length) { var c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1][0] < heap[c][0]) c++; if (heap[c][0] >= last[0]) break; heap[i] = heap[c]; i = c; }
    heap[i] = last; return out;
  }
  function shortestTree(graph, start, maxLen) {
    var costs = new Map([[start, 0]]), distances = new Map([[start, 0]]), parent = new Map(), heap = [[0, start]], visited = 0;
    while (heap.length && visited++ < LIMITS.nodes * 8) {
      var item = heapPop(heap), id = item[1]; if (item[0] !== costs.get(id)) continue;
      if (distances.get(id) > maxLen) continue;
      graph.nodes.get(id).edges.forEach(function (eid) {
        var e = graph.edges[eid], next = e.a === id ? e.b : e.a;
        // Retain the first endpoint beyond the radius so a sparse, long OSM
        // segment can be cut at an exact on-segment turnaround. Do not expand it.
        var metres = distances.get(id) + e.len;
        var cost = item[0] + e.len * (e.info.path ? (e.info.permissive ? 1.1 : 1) : 1.65);
        if (!costs.has(next) || cost < costs.get(next)) { costs.set(next, cost); distances.set(next, metres); parent.set(next, { node: id, edge: eid }); heapPush(heap, [cost, next]); }
      });
    }
    return { parent: parent, distances: distances };
  }
  function pathTo(tree, start, target) {
    var out = [], current = target, guard = 0;
    while (current !== start && guard++ <= LIMITS.nodes) { var prev = tree.parent.get(current); if (!prev) return null; out.push({ edge: prev.edge, from: prev.node, to: current }); current = prev.node; }
    return current === start ? out.reverse() : null;
  }
  function reversePath(path) { return path.slice().reverse().map(function (s) { return { edge: s.edge, from: s.to, to: s.from }; }); }
  function trimPath(graph, path, cap) {
    var out = [], travelled = 0;
    for (var i = 0; i < path.length; i++) {
      var s = path[i], e = graph.edges[s.edge];
      if (travelled + e.len <= cap + 0.05) { out.push(s); travelled += e.len; continue; }
      var part = (cap - travelled) / e.len;
      if (part < 0.000001) break;
      var forward = e.a === s.from, f0 = forward ? e.f0 : e.f1, f1 = forward ? e.f1 : e.f0;
      var fraction = f0 + (f1 - f0) * part, id = 'turn/' + e.wayId + '/' + e.index + '/' + fraction.toFixed(10);
      var p = interpolate(graph.nodes.get(s.from), graph.nodes.get(s.to), part);
      graph.nodes.set(id, { id: id, lat: p.lat, lon: p.lon, edges: [], tags: {} });
      var cut = Object.assign({}, e, { id: graph.edges.length, a: forward ? s.from : id, b: forward ? id : s.from,
        f0: forward ? f0 : fraction, f1: forward ? fraction : f0, len: cap - travelled });
      graph.edges.push(cut); out.push({ edge: cut.id, from: s.from, to: id }); break;
    }
    return out;
  }
  function permittedTraversal(graph, path) { return path.every(function (s) { var e = graph.edges[s.edge]; return e.a === s.from ? e.info.forward : e.info.backward; }); }
  function candidate(graph, path, mode, options) {
    if (!path || !path.length) return null;
    if (!permittedTraversal(graph, path)) { path = reversePath(path); if (!permittedTraversal(graph, path)) return null; }
    var points = [], counts = new Map(), total = 0, pathM = 0, publicM = 0, used = new Set();
    for (var i = 0; i < path.length; i++) {
      var step = path[i], edge = graph.edges[step.edge];
      if (i && path[i - 1].to !== step.from) return null;
      if (!i) points.push(point(graph.nodes.get(step.from)));
      points.push(point(graph.nodes.get(step.to))); total += edge.len;
      if (edge.info.path) pathM += edge.len; if (edge.info.publicPath) publicM += edge.len;
      counts.set(edge.id, (counts.get(edge.id) || 0) + 1); used.add(edge.id);
    }
    if (path[0].from !== path[path.length - 1].to) return null;
    var unique = 0, circuitM = 0; counts.forEach(function (count, eid) { unique += graph.edges[eid].len; if (count === 1) circuitM += graph.edges[eid].len; });
    if (total < options.minLengthM || total > options.maxLengthM || unique < options.minUniqueM || pathM / total < 0.5) return null;
    if (mode === 'loop' && (circuitM < 350 || unique / total < 0.65)) return null;
    return { path: path, points: points, routeMode: mode, lengthM: total, uniqueLengthM: unique, pathShare: pathM / total, publicPathShare: publicM / total, used: used, viaSpur: mode === 'loop' && total - unique > 2 };
  }
  function candidatesFrom(graph, start, options) {
    var tree = shortestTree(graph, start, options.maxLengthM), crosses = [], out = [];
    graph.edges.forEach(function (e) {
      if (!tree.distances.has(e.a) || !tree.distances.has(e.b)) return;
      if ((tree.parent.get(e.a) || {}).edge === e.id || (tree.parent.get(e.b) || {}).edge === e.id) return;
      var len = tree.distances.get(e.a) + tree.distances.get(e.b) + e.len;
      if (len >= options.minLengthM && len <= options.maxLengthM) crosses.push({ edge: e, len: len });
    });
    crosses.sort(function (a, b) { return Math.abs(a.len - options.targetLengthM) - Math.abs(b.len - options.targetLengthM); });
    crosses.slice(0, LIMITS.cycles).forEach(function (entry) {
      var e = entry.edge, outward = pathTo(tree, start, e.a), home = pathTo(tree, start, e.b);
      if (!outward || !home) return;
      var c = candidate(graph, outward.concat([{ edge: e.id, from: e.a, to: e.b }], reversePath(home)), 'loop', options);
      if (c) out.push(c);
    });
    // The longest useful connected walk is the alternative when no circuit can
    // be found; its reverse traversal is explicit and remains on the same ways.
    var targets = Array.from(tree.distances.entries()).filter(function (pair) { return pair[1] * 2 >= options.minLengthM && pair[1] >= options.minUniqueM; });
    targets.sort(function (a, b) { return Math.abs(a[1] * 2 - options.targetLengthM) - Math.abs(b[1] * 2 - options.targetLengthM); });
    targets.slice(0, 48).forEach(function (pair) {
      var p = pathTo(tree, start, pair[0]);
      if (p && pair[1] * 2 > options.maxLengthM) p = trimPath(graph, p, Math.max(options.minUniqueM, Math.min(options.maxLengthM / 2, options.targetLengthM / 2)));
      var c = p && candidate(graph, p.concat(reversePath(p)), 'out-and-back', options); if (c) out.push(c);
    });
    return out;
  }
  function score(c, options) {
    return (c.routeMode === 'loop' ? 10000 : 0) + (c.lengthM >= 800 && c.lengthM <= 5000 ? 500 : 0) + c.publicPathShare * 1700 + c.pathShare * 700 - c.startDistM * 0.35 - Math.abs(c.lengthM - options.targetLengthM) * 0.35 - (c.viaSpur ? 120 : 0);
  }
  function similar(a, b, graph) {
    var common = 0; a.used.forEach(function (id) { if (b.used.has(id)) common += graph.edges[id].len; });
    return a.routeMode === b.routeMode && common / a.uniqueLengthM >= 0.82 && common / b.uniqueLengthM >= 0.82;
  }
  function toOffer(c, graph, json, index) {
    var ids = new Set(), nodeIds = new Set(), warnings = new Set(), names = new Map();
    var segments = c.path.map(function (s) {
      var e = graph.edges[s.edge], w = graph.ways.get(e.wayId), forward = e.a === s.from;
      ids.add(e.wayId); nodeIds.add(w.nodes[e.index]); nodeIds.add(w.nodes[e.index + 1]);
      if (e.info.steps) warnings.add('Includes steps'); if (e.info.permissive) warnings.add('Includes permissive paths');
      if (!text(w.tags.surface)) warnings.add('Surface information is incomplete');
      var name = String(w.tags.name || '').trim(); if (name) names.set(name, (names.get(name) || 0) + e.len);
      return { wayId: e.wayId, index: e.index, from: forward ? e.f0 : e.f1, to: forward ? e.f1 : e.f0 };
    });
    var named = Array.from(names.entries()).sort(function (a, b) { return b[1] - a[1]; })[0];
    var baseName = named ? named[0] : (c.publicPathShare >= 0.98 ? 'Public footpath' : 'Mapped path');
    var name = baseName + (c.routeMode === 'loop' ? (c.viaSpur ? ' circuit' : ' loop') : ' out & back');
    var evidence = { version: VERSION, source: 'OpenStreetMap', sourceTimestamp: json.osm3s && json.osm3s.timestamp_osm_base || null,
      ways: Array.from(ids).map(function (id) { return graph.ways.get(id); }),
      nodes: Array.from(nodeIds).map(function (id) { var n = graph.nodes.get(id); return { id: id, lat: n.lat, lon: n.lon, tags: Object.assign({}, n.tags) }; }), segments: segments };
    var fp = fingerprint(c.points);
    return { routeSchemaVersion: VERSION, networkVerified: true, routeMode: c.routeMode, kind: 'footpath', ref: fp, routeFingerprint: fp,
      name: name, points: c.points, lengthM: Math.round(c.lengthM), uniqueLengthM: Math.round(c.uniqueLengthM), startDistM: Math.round(c.startDistM), startDistanceKind: 'straight-line',
      pathShare: c.pathShare, publicPathShare: c.publicPathShare, publicRightOfWay: c.publicPathShare >= 0.98, ring: c.routeMode === 'loop', viaSpur: c.viaSpur,
      returnDistanceM: c.routeMode === 'out-and-back' ? Math.round(c.lengthM / 2) : null,
      source: 'OpenStreetMap', sourceTimestamp: evidence.sourceTimestamp, routeEvidence: evidence, warnings: Array.from(warnings),
      routeDataNote: 'Access and conditions can change; follow signs.',
      fallbackReason: c.routeMode === 'out-and-back' ? 'No suitable mapped loop was selected here. This walk returns along the same paths.' : null,
      tags: {} };
  }
  function parseOffers(json, lat, lon, opts) {
    if (!validPoint({ lat: lat, lon: lon })) return empty('no-position', 'A precise position is needed.');
    var options = Object.assign({ minLengthM: 650, minUniqueM: 350, maxLengthM: 5600, targetLengthM: 2200, maxStartM: 2500, maxOffers: 6 }, opts || {});
    options.minLengthM = Math.max(650, Number(options.minLengthM) || 650); options.minUniqueM = Math.max(350, Number(options.minUniqueM) || 350);
    options.maxLengthM = Math.max(options.minLengthM, Math.min(6500, Number(options.maxLengthM) || 5600));
    options.maxOffers = Math.max(1, Math.min(LIMITS.offers, Number(options.maxOffers) || 6));
    var graph = buildGraph(json);
    if (graph.error) return empty('data-incomplete', graph.error);
    if (!graph.edges.length) return empty('no-walkable-data', graph.missingTopology ? 'Mapped node connections were not provided.' : 'No eligible mapped walking paths were returned.', { skippedWays: graph.skipped });
    var starts = componentStarts(graph, { lat: lat, lon: lon }, options.maxStartM, options.minUniqueM), candidates = [];
    starts.forEach(function (hit) { var start = splitStart(graph, hit); candidatesFrom(graph, start, options).forEach(function (c) { c.componentStart = start; c.startDistM = distance({ lat: lat, lon: lon }, c.points[0]); candidates.push(c); }); });
    candidates.sort(function (a, b) { return score(b, options) - score(a, options) || a.lengthM - b.lengthM; });
    var selected = [];
    candidates.forEach(function (c) { if (selected.length < options.maxOffers && !selected.some(function (other) {
      return (c.routeMode === 'out-and-back' && other.routeMode === 'out-and-back' && c.componentStart === other.componentStart) || similar(c, other, graph);
    })) selected.push(c); });
    var offers = selected.map(function (c, i) { return toOffer(c, graph, json, i); });
    offers.diagnostics = diagnostics(offers.length ? 'ready' : 'no-useful-route', offers.length ? null : 'The mapped network has no sufficiently long connected walk. Try a wider area or explore freely.', { skippedWays: graph.skipped, missingTopology: graph.missingTopology, loops: offers.filter(function (o) { return o.routeMode === 'loop'; }).length });
    return offers;
  }
  function validateRoute(value, points) {
    var evidence = value && value.routeEvidence;
    function fail(reason) { return { valid: false, certified: false, reason: reason }; }
    if (!value || value.routeSchemaVersion !== VERSION || !evidence || evidence.version !== VERSION) return fail('missing-route-evidence');
    if (!Array.isArray(points) || points.length < 3 || points.length > LIMITS.edges * 2) return fail('invalid-route');
    points = points.map(point); if (points.some(function (p) { return !validPoint(p); })) return fail('invalid-coordinate');
    if (!Array.isArray(evidence.ways) || evidence.ways.length > LIMITS.ways || !Array.isArray(evidence.nodes) || !Array.isArray(evidence.segments) || evidence.segments.length !== points.length - 1) return fail('invalid-route-evidence');
    var ways = new Map(), nodes = new Map();
    evidence.nodes.forEach(function (n) { if (n) nodes.set(String(n.id), n); });
    evidence.ways.forEach(function (w) { if (w) ways.set(String(w.id), w); });
    var expected = [], previousKey = null, firstKey = null, unique = new Map(), pathM = 0, total = 0, circuitM = 0;
    for (var i = 0; i < evidence.segments.length; i++) {
      var s = evidence.segments[i], w = s && ways.get(String(s.wayId)), info = w && classifyWay(w.tags);
      if (!w || !info.eligible || !Array.isArray(w.nodes) || !Array.isArray(w.geometry) || !Number.isInteger(s.index) || s.index < 0 || s.index + 1 >= w.nodes.length) return fail('ineligible-way');
      var a = w.geometry[s.index], b = w.geometry[s.index + 1];
      if (!validPoint(a) || !validPoint(b) || !Number.isFinite(s.from) || !Number.isFinite(s.to) || s.from < 0 || s.from > 1 || s.to < 0 || s.to > 1 || s.from === s.to) return fail('invalid-segment');
      if (s.to > s.from ? !info.forward : !info.backward) return fail('restricted-direction');
      var na = nodes.get(String(w.nodes[s.index])), nb = nodes.get(String(w.nodes[s.index + 1]));
      if (!na || !nb || nodeBlocked(na.tags) || nodeBlocked(nb.tags) || distance(na, a) > 0.5 || distance(nb, b) > 0.5) return fail('blocked-or-invalid-node');
      function keyAt(f) { return f === 0 ? 'n/' + w.nodes[s.index] : f === 1 ? 'n/' + w.nodes[s.index + 1] : 's/' + w.id + '/' + s.index + '/' + f.toFixed(10); }
      var fromKey = keyAt(s.from), toKey = keyAt(s.to);
      if (i && previousKey !== fromKey) return fail('disconnected-route');
      if (!i) { firstKey = fromKey; expected.push(interpolate(a, b, s.from)); }
      expected.push(interpolate(a, b, s.to)); previousKey = toKey;
      var metres = distance(expected[i], expected[i + 1]); total += metres; if (info.path) pathM += metres;
      var k = String(w.id) + '/' + s.index + '/' + Math.min(s.from, s.to).toFixed(10) + '/' + Math.max(s.from, s.to).toFixed(10);
      if (!unique.has(k)) unique.set(k, { length: metres, count: 0 }); unique.get(k).count++;
    }
    if (previousKey !== firstKey) return fail('open-route');
    var uniqueM = 0; unique.forEach(function (e) { uniqueM += e.length; if (e.count === 1) circuitM += e.length; });
    if (total < 649.5 || total > 6500.5 || uniqueM < 349.5 || pathM / total < 0.5) return fail('insufficient-route-quality');
    if (value.routeMode === 'loop') { if (circuitM < 349.5 || uniqueM / total < 0.65) return fail('false-loop'); }
    else if (value.routeMode === 'out-and-back') { if (Math.abs(total - 2 * uniqueM) > 1) return fail('invalid-return'); }
    else return fail('invalid-route-mode');
    if (points.some(function (p, j) { return distance(p, expected[j]) > 1; })) return fail('route-evidence-mismatch');
    if (value.routeFingerprint !== fingerprint(expected)) return fail('route-fingerprint-mismatch');
    if (!Number.isFinite(value.lengthM) || Math.abs(value.lengthM - total) > 2) return fail('route-distance-mismatch');
    return { valid: true, certified: true, reason: null, lengthM: Math.round(total), uniqueLengthM: Math.round(uniqueM), source: 'OpenStreetMap', sourceTimestamp: evidence.sourceTimestamp || null };
  }
  function validateOffer(offer) { return validateRoute(offer, offer && offer.points); }
  function validateQuest(quest) {
    var result = validateRoute(quest, quest && quest.route); if (!result.valid) return result;
    var route = quest.route.map(point), checkpoints = Array.isArray(quest.checkpoints) ? quest.checkpoints : [];
    for (var c = 0; c < checkpoints.length; c++) {
      var cp = checkpoints[c];
      if (!validPoint(cp)) return { valid: false, certified: false, reason: 'invalid-checkpoint' };
      var best = Infinity, cos = Math.max(0.001, Math.cos(cp.lat * Math.PI / 180));
      for (var i = 1; i < route.length; i++) {
        var a = route[i - 1], b = route[i], x = (b.lon - a.lon) * cos, y = b.lat - a.lat;
        var denom = x * x + y * y, t = denom ? Math.max(0, Math.min(1, ((cp.lon - a.lon) * cos * x + (cp.lat - a.lat) * y) / denom)) : 0;
        best = Math.min(best, distance(cp, interpolate(a, b, t)));
        if (best <= 2) break;
      }
      if (best > 2) return { valid: false, certified: false, reason: 'checkpoint-off-route' };
    }
    return result;
  }
  var api = { VERSION: VERSION, LIMITS: Object.assign({}, LIMITS), buildOverpassQuery: buildOverpassQuery, parseOffers: parseOffers, validateOffer: validateOffer, validateQuest: validateQuest, classifyWay: classifyWay, nodeBlocked: nodeBlocked, routeLengthM: length };
  root.BurbzWalkingRouteCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
