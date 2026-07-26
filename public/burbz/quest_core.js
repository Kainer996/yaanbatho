/* Burbz Quest Core — real-world walking quests.
 * Pure logic module: trail discovery (OpenStreetMap Overpass), route parsing,
 * fallback route generation, checkpoint/chest placement, progress tracking, XP.
 * No DOM access here; index.html wires UI + map rendering.
 * Trail data © OpenStreetMap contributors (ODbL).
 */
(function () {
  'use strict';

  var EARTH_R = 6371000;
  // A route is geometrically closed only when its recorded ends genuinely meet.
  // Larger gaps may be candidates for a routed return, but must never be bridged
  // by drawing a straight segment between unrelated path ends.
  var REAL_LOOP_CLOSE_M = 3;

  function toRad(d) { return d * Math.PI / 180; }

  function questHaversine(lat1, lon1, lat2, lon2) {
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function destPoint(lat, lon, bearingDeg, distM) {
    var br = toRad(bearingDeg);
    var dR = distM / EARTH_R;
    var la1 = toRad(lat), lo1 = toRad(lon);
    var la2 = Math.asin(Math.sin(la1) * Math.cos(dR) + Math.cos(la1) * Math.sin(dR) * Math.cos(br));
    var lo2 = lo1 + Math.atan2(Math.sin(br) * Math.sin(dR) * Math.cos(la1), Math.cos(dR) - Math.sin(la1) * Math.sin(la2));
    return { lat: la2 * 180 / Math.PI, lon: ((lo2 * 180 / Math.PI) + 540) % 360 - 180 };
  }

  function routeLengthM(pts) {
    var t = 0;
    for (var i = 1; i < pts.length; i++) t += questHaversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    return t;
  }

  // Only offers with a real, known trailhead compete for nearby ranking.
  // Within that set, prefer public rights of way, named hiking routes and
  // genuine loops before using trailhead distance as the tie-breaker.
  function sortOffersByStartDistance(offers) {
    return (offers || []).slice().sort(function (a, b) {
      var ra = a && a.startDistM, rb = b && b.startDistM;
      var da = (ra == null || ra === '') ? Infinity : Number(ra);
      var db = (rb == null || rb === '') ? Infinity : Number(rb);
      if (!isFinite(da)) da = Infinity;
      if (!isFinite(db)) db = Infinity;
      if (isFinite(da) !== isFinite(db)) return isFinite(da) ? -1 : 1;
      var qa = offerQualityScore(a), qb = offerQualityScore(b);
      if (qa !== qb) return qb - qa;
      if (da !== db) return da - db;
      var ak = stableOfferKey(a), bk = stableOfferKey(b);
      return ak < bk ? -1 : (ak > bk ? 1 : 0);
    });
  }

  // If one route ends close to another route's start, surface that as a quiet
  // onward-adventure hint. One nearest target per offer; self-links are ignored.
  function questChainTargetIndices(offers, thresholdM) {
    offers = offers || [];
    thresholdM = isFinite(thresholdM) ? Math.max(1, Number(thresholdM)) : 120;
    return offers.map(function (offer, i) {
      var pts = offer && offer.points;
      if (!pts || !pts.length) return null;
      var end = pts[pts.length - 1], best = null, bestD = thresholdM + 1;
      offers.forEach(function (candidate, j) {
        if (i === j || !candidate || !candidate.points || !candidate.points.length) return;
        var start = candidate.points[0];
        var d = questHaversine(end.lat, end.lon, start.lat, start.lon);
        if (d <= thresholdM && d < bestD) { best = j; bestD = d; }
      });
      return best;
    });
  }

  // Point along a polyline at a fraction [0..1] of its total length.
  function pointAtFraction(pts, frac) {
    if (!pts.length) return null;
    if (pts.length === 1 || frac <= 0) return pts[0];
    var total = routeLengthM(pts);
    if (total <= 0 || frac >= 1) return pts[pts.length - 1];
    var target = total * frac, acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var seg = questHaversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
      if (acc + seg >= target && seg > 0) {
        var f = (target - acc) / seg;
        return {
          lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * f,
          lon: pts[i - 1].lon + (pts[i].lon - pts[i - 1].lon) * f
        };
      }
      acc += seg;
    }
    return pts[pts.length - 1];
  }

  // Closest point on the actual polyline, not merely its nearest OSM node.
  function nearestPointOnRoute(pts, lat, lon, closed) {
    if (!pts || !pts.length) return null;
    if (pts.length === 1) return { point: pts[0], segmentIndex: 0, distanceM: questHaversine(lat, lon, pts[0].lat, pts[0].lon) };
    var best = null;
    var count = closed ? pts.length : pts.length - 1;
    var cosLat = Math.max(0.2, Math.cos(toRad(lat)));
    for (var i = 0; i < count; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var ax = (a.lon - lon) * cosLat, ay = a.lat - lat;
      var bx = (b.lon - lon) * cosLat, by = b.lat - lat;
      var vx = bx - ax, vy = by - ay;
      var denom = vx * vx + vy * vy;
      var t = denom > 0 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / denom)) : 0;
      var point = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
      var distanceM = questHaversine(lat, lon, point.lat, point.lon);
      if (!best || distanceM < best.distanceM) best = { point: point, segmentIndex: i, distanceM: distanceM };
    }
    return best;
  }

  // Keep payload small: decimate a polyline to at most maxPts evenly spaced points.
  // Sampling only (corridor checks, overlap fractions) — for anything that gets
  // DRAWN use simplifyRoute, which never cuts corners.
  function decimateRoute(pts, maxPts) {
    maxPts = maxPts || 160;
    if (pts.length <= maxPts) return pts.slice();
    var out = [];
    for (var i = 0; i < maxPts; i++) out.push(pointAtFraction(pts, i / (maxPts - 1)));
    return out;
  }

  // Perpendicular distance (m) from p to segment a-b, equirectangular approx.
  function pointSegDistM(p, a, b) {
    var cosLat = Math.max(0.2, Math.cos(toRad(a.lat)));
    var bx = (b.lon - a.lon) * cosLat, by = b.lat - a.lat;
    var px = (p.lon - a.lon) * cosLat, py = p.lat - a.lat;
    var denom = bx * bx + by * by;
    var t = denom > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / denom)) : 0;
    var dx = px - bx * t, dy = py - by * t;
    return Math.sqrt(dx * dx + dy * dy) * 111320;
  }

  // Douglas-Peucker: indices of the vertices needed to stay within epsM of the
  // original line. Kept points are always REAL vertices of the input.
  function douglasPeuckerKeep(pts, epsM) {
    var keep = new Array(pts.length);
    keep[0] = keep[pts.length - 1] = true;
    var stack = [[0, pts.length - 1]];
    while (stack.length) {
      var span = stack.pop(), s = span[0], e = span[1];
      if (e - s < 2) continue;
      var worst = -1, worstD = epsM;
      for (var i = s + 1; i < e; i++) {
        var d = pointSegDistM(pts[i], pts[s], pts[e]);
        if (d > worstD) { worstD = d; worst = i; }
      }
      if (worst > 0) { keep[worst] = true; stack.push([s, worst], [worst, e]); }
    }
    var out = [];
    for (var j = 0; j < pts.length; j++) if (keep[j]) out.push(j);
    return out;
  }

  // Shape-preserving cap: drop redundant vertices but keep every corner, so the
  // drawn line still lies ON the footpath. (Even resampling — the old approach
  // for stored routes — chorded bends into straight cuts across the map.)
  function simplifyRoute(pts, maxPts, startEpsM) {
    maxPts = maxPts || 320;
    if (!pts || pts.length <= 2) return (pts || []).slice();
    var kept = null;
    for (var eps = startEpsM || 1.2; eps <= 500; eps *= 1.7) {
      kept = douglasPeuckerKeep(pts, eps);
      if (kept.length <= maxPts) break;
    }
    if (!kept || kept.length > maxPts) {
      kept = [];
      for (var i = 0; i < maxPts; i++) kept.push(Math.round(i * (pts.length - 1) / (maxPts - 1)));
    }
    return kept.map(function (k) { return pts[k]; });
  }

  // Insert interpolated points so consecutive spacing is at most stepM.
  function densifyRoute(pts, stepM, maxPts) {
    stepM = stepM || 12;
    maxPts = maxPts || 1400;
    if (!pts || pts.length < 2) return (pts || []).slice();
    var out = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var n = Math.min(60, Math.floor(questHaversine(a.lat, a.lon, b.lat, b.lon) / stepM));
      for (var k = 1; k <= n; k++) {
        if (out.length >= maxPts - (pts.length - i)) break;
        var f = k / (n + 1);
        out.push({ lat: a.lat + (b.lat - a.lat) * f, lon: a.lon + (b.lon - a.lon) * f });
      }
      out.push(b);
    }
    return out;
  }

  function projectOntoSegment(p, a, b) {
    var cosLat = Math.max(0.2, Math.cos(toRad(a.lat)));
    var bx = (b.lon - a.lon) * cosLat, by = b.lat - a.lat;
    var px = (p.lon - a.lon) * cosLat, py = p.lat - a.lat;
    var denom = bx * bx + by * by;
    var t = denom > 0 ? Math.max(0, Math.min(1, (px * bx + py * by) / denom)) : 0;
    var pt = { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
    return { pt: pt, distM: questHaversine(p.lat, p.lon, pt.lat, pt.lon) };
  }

  // Snap a route onto real path geometry. Quest routes can come from sources
  // that disagree slightly with the basemap the player is looking at (mirror
  // lag, tile generalisation) — snapping onto the walkable ways rendered on
  // screen makes the golden line hug the same footpaths the player is
  // physically standing on. Points with no way within maxSnapM keep their
  // original position, so partial tile coverage still improves the route.
  function snapRouteToWays(pts, ways, opts) {
    opts = opts || {};
    var maxSnapM = opts.maxSnapM || 30;
    var stepM = opts.stepM || 12;
    if (!pts || pts.length < 2) return { points: (pts || []).slice(), snappedFraction: 0 };
    var segs = [];
    (ways || []).forEach(function (w, wi) {
      if (!w || w.length < 2) return;
      for (var i = 1; i < w.length; i++) {
        var a = w[i - 1], b = w[i];
        if (a && b && isFinite(a.lat) && isFinite(a.lon) && isFinite(b.lat) && isFinite(b.lon)) segs.push({ a: a, b: b, way: wi });
      }
    });
    if (!segs.length) return { points: pts.slice(), snappedFraction: 0 };
    // Grid cells at least 2x the snap radius wide: a point only ever needs to
    // look in its own cell because segments register with one cell of padding.
    var cellDeg = Math.max(60, maxSnapM * 2) / 111320;
    var cosRef = Math.max(0.2, Math.cos(toRad(pts[0].lat)));
    var grid = {};
    function cx(lon) { return Math.floor(lon * cosRef / cellDeg); }
    function cy(lat) { return Math.floor(lat / cellDeg); }
    segs.forEach(function (s, si) {
      var x0 = cx(Math.min(s.a.lon, s.b.lon)) - 1, x1 = cx(Math.max(s.a.lon, s.b.lon)) + 1;
      var y0 = cy(Math.min(s.a.lat, s.b.lat)) - 1, y1 = cy(Math.max(s.a.lat, s.b.lat)) + 1;
      if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4000) return; // degenerate mega-segment
      for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) {
        var k = x + '_' + y;
        (grid[k] = grid[k] || []).push(si);
      }
    });
    var dense = densifyRoute(pts, stepM, opts.maxDensePts || 1400);
    var snapped = 0, lastWay = -1;
    var out = dense.map(function (p) {
      var cands = grid[cx(p.lon) + '_' + cy(p.lat)] || [];
      var best = null, bestSame = null;
      for (var i = 0; i < cands.length; i++) {
        var s = segs[cands[i]];
        var hit = projectOntoSegment(p, s.a, s.b);
        if (hit.distM > maxSnapM) continue;
        if (!best || hit.distM < best.distM) best = { distM: hit.distM, pt: hit.pt, way: s.way };
        if (s.way === lastWay && (!bestSame || hit.distM < bestSame.distM)) bestSame = { distM: hit.distM, pt: hit.pt, way: s.way };
      }
      // Continuity: keep following the way we're on unless another is clearly
      // closer — stops the line zigzagging between two parallel paths.
      var pick = best;
      if (bestSame && best && bestSame.way !== best.way && bestSame.distM <= best.distM + 8) pick = bestSame;
      if (!pick) { lastWay = -1; return p; }
      lastWay = pick.way;
      snapped++;
      return { lat: pick.pt.lat, lon: pick.pt.lon };
    });
    var cleaned = [out[0]];
    for (var j = 1; j < out.length; j++) {
      var prev = cleaned[cleaned.length - 1];
      if (j === out.length - 1 || questHaversine(prev.lat, prev.lon, out[j].lat, out[j].lon) >= 1.5) cleaned.push(out[j]);
    }
    return { points: cleaned, snappedFraction: snapped / dense.length };
  }

  // Re-chart a route ONTO a different path network — the ways the basemap
  // actually renders. Point-snapping can only fix small offsets; when the
  // quest's source data disagrees with the basemap by more than the snap
  // radius (stale mirror, missing paths) the whole walk must be rebuilt on
  // the network the player can see. Rings are rebuilt as rings from the same
  // start; linear routes become the network path toward the route's far end.
  // Returns null when the network can't host the walk — callers keep the
  // existing route rather than draw something half-invented.
  function rechartRouteOnWays(routePts, ways, opts) {
    opts = opts || {};
    if (!routePts || routePts.length < 2) return null;
    var usable = (ways || []).filter(function (w) { return w && w.length >= 2; });
    if (!usable.length) return null;
    var net = buildPathNetwork(usable, opts.joinM);
    if (!net.edges.length) return null;
    var sLat = isFinite(opts.startLat) ? opts.startLat : routePts[0].lat;
    var sLon = isFinite(opts.startLon) ? opts.startLon : routePts[0].lon;
    var start = insertNetworkStart(net, sLat, sLon, opts.maxSnapM || 160);
    if (!start) return null;
    var lenM = routeLengthM(routePts);
    var e0 = routePts[0], e1 = routePts[routePts.length - 1];
    var isRing = questHaversine(e0.lat, e0.lon, e1.lat, e1.lon) <= LOOP_ENDS_MEET_M;
    if (isRing) {
      var loop = findFootpathLoopFrom(net, start.nodeId, {
        minLenM: Math.max(350, lenM * 0.45),
        maxLenM: Math.max(900, lenM * 2),
        targetLenM: Math.max(RING_MIN_LEN_M, lenM)
      });
      if (loop && loop.points && loop.points.length >= 3) {
        return { points: loop.points, lengthM: routeLengthM(loop.points), ring: true };
      }
      // Acyclic visible component: never retain the stale ring and never close
      // it with a chord. Convert it to a deterministic real out-and-back leg.
      var outward = networkFurthestPath(net, start.nodeId);
      if (!outward) return null;
      var outwardPts = pathPointsAlongEdges(net, start.nodeId, outward.path.edgeIds);
      if (outwardPts.length < 2) return null;
      return { points: outwardPts, lengthM: routeLengthM(outwardPts) * 2, ring: false, outAndBack: true };
    }
    var endHit = insertNetworkStart(net, e1.lat, e1.lon, opts.maxSnapM || 160);
    if (!endHit || endHit.nodeId === start.nodeId) return null;
    var path = networkShortestPath(net, start.nodeId, endHit.nodeId);
    if (!path || !path.edgeIds.length) return null;
    var pts = pathPointsAlongEdges(net, start.nodeId, path.edgeIds);
    if (pts.length < 2 || routeLengthM(pts) < 250) return null;
    return { points: pts, lengthM: routeLengthM(pts), ring: false };
  }

  // Single-point variant, for checkpoints/markers. Null when no way is close.
  function snapPointToWays(p, ways, maxSnapM) {
    maxSnapM = maxSnapM || 30;
    if (!p || !isFinite(p.lat) || !isFinite(p.lon)) return null;
    var best = null;
    (ways || []).forEach(function (w) {
      if (!w || w.length < 2) return;
      var n = nearestPointOnRoute(w, p.lat, p.lon, false);
      if (n && n.distanceM <= maxSnapM && (!best || n.distanceM < best.distanceM)) best = n;
    });
    return best ? { lat: best.point.lat, lon: best.point.lon, distM: best.distanceM } : null;
  }

  var ROUTE_ALIGNMENT_VERSION = 3;
  var ROUTE_CERTIFICATION_TOLERANCE_M = 2;
  var ROUTE_CERTIFICATION_SAMPLE_M = 2;

  function mapTransportationClass(feature) {
    var p = feature && feature.properties || {};
    return String(p.subclass || p.class || p.type || '').trim().toLowerCase();
  }

  // Pure, deterministic policy shared by visible offer discovery and active
  // route certification. It is deliberately an allow-list, not substring
  // matching, and explicit private/no-foot tags always win.
  function isEligibleMapTransportationFeature(feature) {
    var p = feature && feature.properties || {};
    if (/^(no|private)$/i.test(String(p.access || '').trim())) return false;
    if (/^(no|private)$/i.test(String(p.foot || '').trim())) return false;
    var cls = mapTransportationClass(feature);
    return /^(path|footway|pedestrian|steps|bridleway|track|cycleway)$/.test(cls);
  }

  function questWayClassification(tags) {
    tags = tags || {};
    var highway = String(tags.highway || '').trim().toLowerCase();
    var forbidden = /^(no|private)$/i.test(String(tags.access || '').trim()) ||
      /^(no|private)$/i.test(String(tags.foot || '').trim());
    var designationPublic = /public_footpath|public_bridleway|restricted_byway|byway_open_to_all_traffic/i
      .test(String(tags.designation || ''));
    var foot = String(tags.foot || '').trim().toLowerCase();
    var access = String(tags.access || '').trim().toLowerCase();
    var positiveFoot = /^(designated|yes|permissive)$/.test(foot);
    var positiveAccess = /^(public|yes|permissive)$/.test(access);
    var named = !!String(tags.name || tags.ref || '').trim();
    var discoveryClass = /^(path|footway|bridleway|track)$/.test(highway);
    var eligible = !forbidden && discoveryClass && (
      highway === 'footway' || highway === 'bridleway' ||
      designationPublic || positiveFoot || positiveAccess ||
      (highway === 'path' && named)
    );
    // `highway=track` without affirmative walking/public evidence is commonly a
    // farm or service track. It may remain alignment geometry, but is no quest.
    if (highway === 'track' && !(designationPublic || positiveFoot || positiveAccess)) eligible = false;
    var publicFootpath = designationPublic || highway === 'footway' || highway === 'bridleway' ||
      foot === 'designated' || access === 'public';
    return {
      highway: highway,
      forbidden: forbidden,
      eligible: eligible,
      publicFootpath: !forbidden && publicFootpath,
      explicitPublic: !forbidden && (designationPublic || foot === 'designated' || access === 'public'),
      named: named
    };
  }

  // Quest discovery is intentionally stricter than alignment. Urban pedestrian
  // plazas, steps, cycleways, and access-unknown tracks can help certify a short
  // connector, but must never be advertised as a public-footpath adventure.
  function isEligibleQuestDiscoveryFeature(feature) {
    if (!isEligibleMapTransportationFeature(feature)) return false;
    var p = feature && feature.properties || {};
    var cls = mapTransportationClass(feature);
    if (/^(pedestrian|cycleway|steps)$/.test(cls)) return false;
    var tags = {};
    Object.keys(p).forEach(function (key) {
      if (p[key] == null || typeof p[key] === 'object') return;
      tags[key] = p[key];
    });
    tags.highway = cls;
    return questWayClassification(tags).eligible;
  }

  function eligibleMapTransportationWays(features) {
    var ways = [], seen = {};
    (features || []).forEach(function (feature) {
      if (!isEligibleMapTransportationFeature(feature)) return;
      var geom = feature && feature.geometry || {};
      var lines = geom.type === 'LineString' ? [geom.coordinates] :
        geom.type === 'MultiLineString' ? geom.coordinates : [];
      lines.forEach(function (coords) {
        var pts = (coords || []).filter(function (c) {
          return c && isFinite(c[0]) && isFinite(c[1]);
        }).map(function (c) { return { lat: Number(c[1]), lon: Number(c[0]) }; });
        if (pts.length < 2) return;
        var key = pts.map(function (p) { return p.lat.toFixed(7) + ',' + p.lon.toFixed(7); }).join(';');
        if (!seen[key]) { seen[key] = true; ways.push(pts); }
      });
    });
    return ways;
  }

  function routeObjects(route) {
    return (route || []).map(function (p) {
      return Array.isArray(p) ? { lat: Number(p[0]), lon: Number(p[1]) } :
        { lat: Number(p.lat), lon: Number(p.lon) };
    }).filter(function (p) { return isFinite(p.lat) && isFinite(p.lon); });
  }

  function routePointsFrom(value) {
    var route = value && Array.isArray(value.points) ? value.points :
      (Array.isArray(value) ? value : []);
    return routeObjects(route);
  }

  function routeIsStrictLoop(value) {
    var pts = routePointsFrom(value);
    if (pts.length < 3) return false;
    var a = pts[0], b = pts[pts.length - 1];
    if (questHaversine(a.lat, a.lon, b.lat, b.lon) > REAL_LOOP_CLOSE_M) return false;
    var lenM = routeLengthM(pts);
    // A route that simply retraces one line can have identical endpoints while
    // enclosing no walkable circuit. Require a small but real enclosed width.
    return lenM > 0 && ringAreaM2(pts) >= lenM * 2;
  }

  // Length-weighted corridor coverage. Uniform distance samples make the result
  // insensitive to vertex density, direction, and where a closed route happens
  // to start. Each sample is compared with the WHOLE other polyline.
  function routeCoverageFraction(subject, corridor, thresholdM, opts) {
    opts = opts || {};
    thresholdM = isFinite(thresholdM) ? Math.max(0.5, Number(thresholdM)) :
      (isFinite(opts.thresholdM) ? Math.max(0.5, Number(opts.thresholdM)) : 18);
    var a = routePointsFrom(subject), b = routePointsFrom(corridor);
    if (a.length < 2 || b.length < 2) return 0;
    var lenM = routeLengthM(a);
    if (!(lenM > 0)) return 0;
    var spacingM = Math.max(8, Number(opts.sampleSpacingM) || 24);
    var maxSamples = Math.max(12, Number(opts.maxSamples) || 220);
    var count = Math.max(2, Math.min(maxSamples, Math.ceil(lenM / spacingM)));
    var hits = 0;
    for (var i = 0; i <= count; i++) {
      var p = pointAtFraction(a, i / count);
      var n = nearestPointOnRoute(b, p.lat, p.lon, false);
      if (n && n.distanceM <= thresholdM) hits++;
    }
    return hits / (count + 1);
  }

  // Whole-geometry, bidirectional equivalence. Requiring both coverages and a
  // similar total length keeps two routes that merely share a trunk distinct.
  function routesEquivalent(a, b, opts) {
    opts = opts || {};
    var ap = routePointsFrom(a), bp = routePointsFrom(b);
    if (ap.length < 2 || bp.length < 2) return false;
    var al = routeLengthM(ap), bl = routeLengthM(bp);
    if (!(al > 0) || !(bl > 0)) return false;
    var lengthRatio = Math.min(al, bl) / Math.max(al, bl);
    var minLengthRatio = isFinite(opts.minLengthRatio) ? Number(opts.minLengthRatio) : 0.78;
    if (lengthRatio < minLengthRatio) return false;
    var thresholdM = isFinite(opts.thresholdM) ? Number(opts.thresholdM) : 18;
    var minCoverage = isFinite(opts.minCoverage) ? Number(opts.minCoverage) : 0.88;
    var sampleOpts = {
      sampleSpacingM: opts.sampleSpacingM,
      maxSamples: opts.maxSamples,
      thresholdM: thresholdM
    };
    return routeCoverageFraction(ap, bp, thresholdM, sampleOpts) >= minCoverage &&
      routeCoverageFraction(bp, ap, thresholdM, sampleOpts) >= minCoverage;
  }

  function hasExplicitPublicEvidence(offer) {
    var tags = offer && offer.tags || {};
    return !!(offer && offer.publicRightOfWay) ||
      /public_footpath|public_bridleway|restricted_byway|byway_open_to_all_traffic/i.test(String(tags.designation || '')) ||
      /^(public)$/i.test(String(tags.access || '')) ||
      /^(designated)$/i.test(String(tags.foot || ''));
  }

  function hasUsefulOfferName(offer) {
    var name = String(offer && offer.name || '').trim();
    return !!name && !/^(Ancient Trail|Footpath Ring|Nearby Footpath Walk|Mapped Footpath(?:\s+[IVX]+|\s+\d+)?)$/i.test(name);
  }

  // Used only to decide which representative survives an equivalence group.
  // Large, separated bands make the preference deterministic and legible:
  // explicit public evidence, named hiking routes/footpaths, then real loops.
  function offerQualityScore(offer) {
    if (!offer) return -Infinity;
    var tags = offer.tags || {}, score = 0;
    var named = hasUsefulOfferName(offer);
    if (hasExplicitPublicEvidence(offer)) score += 1200;
    if (offer.kind === 'trail' && /^(hiking|foot|walking)$/i.test(String(tags.route || ''))) score += named ? 900 : 650;
    if (offer.kind === 'footpath') score += 460;
    else if (offer.kind === 'path') score += 160;
    if (named) score += offer.kind === 'trail' || offer.kind === 'footpath' ? 240 : 90;
    if (routeIsStrictLoop(offer)) score += 320;
    if (offer.ring) score += 40;
    if (offer.source === 'visible-map') score += 15;
    return score;
  }

  function stableOfferKey(offer) {
    var pts = routePointsFrom(offer);
    var first = pts[0] || { lat: 0, lon: 0 };
    return String(offer && offer.ref || '') + '|' + String(offer && offer.name || '') + '|' +
      first.lat.toFixed(7) + ',' + first.lon.toFixed(7);
  }

  function preferredEquivalentOffer(a, b) {
    var aq = offerQualityScore(a), bq = offerQualityScore(b);
    if (aq !== bq) return aq > bq ? a : b;
    var al = routePointsFrom(a).length, bl = routePointsFrom(b).length;
    if (al !== bl) return al > bl ? a : b; // preserve the richer real geometry
    return stableOfferKey(a) <= stableOfferKey(b) ? a : b;
  }

  function mergeEquivalentOffer(preferred, other) {
    var out = {};
    Object.keys(preferred || {}).forEach(function (key) { out[key] = preferred[key]; });
    out.publicRightOfWay = hasExplicitPublicEvidence(preferred) || hasExplicitPublicEvidence(other);
    var refs = [];
    [preferred && preferred.ref, other && other.ref].concat(
      preferred && preferred.sourceRefs || [], other && other.sourceRefs || []
    ).forEach(function (ref) { if (ref && refs.indexOf(ref) < 0) refs.push(ref); });
    if (refs.length) out.sourceRefs = refs.sort();
    return out;
  }

  function dedupeQuestOffers(offers, opts) {
    opts = opts || {};
    var out = [];
    (offers || []).forEach(function (candidate) {
      if (!candidate || routePointsFrom(candidate).length < 2) return;
      var duplicateAt = -1;
      for (var i = 0; i < out.length; i++) {
        if (routesEquivalent(candidate, out[i], opts)) { duplicateAt = i; break; }
      }
      if (duplicateAt < 0) { out.push(candidate); return; }
      var preferred = preferredEquivalentOffer(out[duplicateAt], candidate);
      var other = preferred === candidate ? out[duplicateAt] : candidate;
      out[duplicateAt] = mergeEquivalentOffer(preferred, other);
    });
    return out;
  }

  var compiledWalkableWaysCache = typeof WeakMap !== 'undefined' ? new WeakMap() : null;

  function canonicalWayKey(pts) {
    var forward = pts.map(function (p) { return p.lat.toFixed(7) + ',' + p.lon.toFixed(7); }).join(';');
    var reverse = pts.slice().reverse().map(function (p) { return p.lat.toFixed(7) + ',' + p.lon.toFixed(7); }).join(';');
    return forward <= reverse ? forward : reverse;
  }

  // Compile once, then reuse for every route/checkpoint query. Besides exact
  // reverse-insensitive way deduplication, this replaces the former O(W^2)
  // component pass and all-way nearest scans with a local segment grid.
  function compileWalkableWays(ways, opts) {
    opts = opts || {};
    if (ways && ways.__burbzCompiledWalkableWays) return ways;
    var raw = Array.isArray(ways) ? ways : [];
    if (compiledWalkableWaysCache && compiledWalkableWaysCache.has(raw)) return compiledWalkableWaysCache.get(raw);
    var usable = [], seen = {};
    raw.forEach(function (way) {
      var pts = routeObjects(way);
      if (pts.length < 2) return;
      var key = canonicalWayKey(pts);
      if (!seen[key]) { seen[key] = true; usable.push(pts); }
    });
    var first = usable[0] && usable[0][0] || { lat: 0, lon: 0 };
    var lat0 = first.lat, lon0 = first.lon;
    var cosRef = Math.max(0.2, Math.cos(toRad(lat0)));
    var cellM = Math.max(12, Number(opts.cellM) || 24);
    function mx(lon) { return (lon - lon0) * 111320 * cosRef; }
    function my(lat) { return (lat - lat0) * 111320; }
    function cellX(lon) { return Math.floor(mx(lon) / cellM); }
    function cellY(lat) { return Math.floor(my(lat) / cellM); }
    var grid = {}, longSegments = [], segments = [];
    usable.forEach(function (way, wi) {
      for (var i = 1; i < way.length; i++) {
        var a = way[i - 1], b = way[i];
        var seg = { a: a, b: b, wayIndex: wi, id: segments.length };
        segments.push(seg);
        var x0 = cellX(Math.min(a.lon, b.lon)) - 1, x1 = cellX(Math.max(a.lon, b.lon)) + 1;
        var y0 = cellY(Math.min(a.lat, b.lat)) - 1, y1 = cellY(Math.max(a.lat, b.lat)) + 1;
        if ((x1 - x0 + 1) * (y1 - y0 + 1) > 4096) { longSegments.push(seg.id); continue; }
        for (var x = x0; x <= x1; x++) for (var y = y0; y <= y1; y++) {
          var k = x + '_' + y;
          (grid[k] = grid[k] || []).push(seg.id);
        }
      }
    });
    function segmentIdsNear(p, radiusM) {
      // Segment bboxes were registered with a full-cell pad, so sub-cell
      // certification radii need only inspect the point's own cell.
      var reach = Math.max(0, Math.ceil((Number(radiusM) || 2) / cellM) - 1);
      var cx = cellX(p.lon), cy = cellY(p.lat), ids = [], hit = {};
      for (var dx = -reach; dx <= reach; dx++) for (var dy = -reach; dy <= reach; dy++) {
        var arr = grid[(cx + dx) + '_' + (cy + dy)] || [];
        for (var i = 0; i < arr.length; i++) if (!hit[arr[i]]) { hit[arr[i]] = true; ids.push(arr[i]); }
      }
      longSegments.forEach(function (id) { if (!hit[id]) { hit[id] = true; ids.push(id); } });
      return ids;
    }
    var parent = usable.map(function (_, i) { return i; });
    function root(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function unite(a, b) { a = root(a); b = root(b); if (a !== b) parent[Math.max(a, b)] = Math.min(a, b); }
    usable.forEach(function (way, wi) {
      [way[0], way[way.length - 1]].forEach(function (p) {
        segmentIdsNear(p, PATH_MERGE_M + 0.5).forEach(function (sid) {
          var seg = segments[sid];
          if (seg.wayIndex === wi) return;
          if (projectOntoSegment(p, seg.a, seg.b).distM <= PATH_MERGE_M) unite(wi, seg.wayIndex);
        });
      });
    });
    var compiled = {
      __burbzCompiledWalkableWays: true,
      ways: usable,
      segments: segments,
      components: parent.map(function (_, i) { return root(i); }),
      segmentIdsNear: segmentIdsNear,
      cellM: cellM
    };
    if (compiledWalkableWaysCache) compiledWalkableWaysCache.set(raw, compiled);
    return compiled;
  }

  function wayComponents(ways) {
    return compileWalkableWays(ways).components.slice();
  }

  function nearestWayHit(p, ways, maxDistanceM) {
    var compiled = compileWalkableWays(ways);
    var limit = isFinite(maxDistanceM) ? Math.max(0, Number(maxDistanceM)) : Infinity;
    var ids = compiled.segmentIdsNear(p, isFinite(limit) ? limit : compiled.cellM);
    var best = null;
    ids.forEach(function (sid) {
      var seg = compiled.segments[sid];
      var hit = projectOntoSegment(p, seg.a, seg.b);
      if (hit.distM > limit) return;
      if (!best || hit.distM < best.distanceM - 1e-9 ||
          (Math.abs(hit.distM - best.distanceM) <= 1e-9 && seg.wayIndex < best.wayIndex)) {
        best = { distanceM: hit.distM, wayIndex: seg.wayIndex, point: hit.pt };
      }
    });
    return best;
  }

  // Certify the WHOLE polyline, not just its vertices. Samples are never more
  // than 2 m apart; checkpoints use the same strict 2 m corridor. A transition
  // between disconnected visible-way components is rejected even when a short
  // gap's midpoint happens to be within 2 m of both ends.
  function certifyRouteAgainstWays(route, checkpoints, ways, opts) {
    opts = opts || {};
    var toleranceM = Math.min(ROUTE_CERTIFICATION_TOLERANCE_M, opts.toleranceM || ROUTE_CERTIFICATION_TOLERANCE_M);
    var spacingM = Math.min(ROUTE_CERTIFICATION_SAMPLE_M, opts.sampleSpacingM || ROUTE_CERTIFICATION_SAMPLE_M);
    var pts = routeObjects(route), compiled = compileWalkableWays(ways), usable = compiled.ways;
    if (pts.length < 2) return { certified: false, reason: 'invalid-route', sampleSpacingM: spacingM, sampleCount: 0 };
    if (!usable.length) return { certified: false, reason: 'no-eligible-ways', sampleSpacingM: spacingM, sampleCount: 0 };
    var dense = [pts[0]];
    for (var i = 1; i < pts.length; i++) {
      var a = pts[i - 1], b = pts[i];
      var len = questHaversine(a.lat, a.lon, b.lat, b.lon);
      var parts = Math.max(1, Math.ceil(len / spacingM));
      for (var k = 1; k <= parts; k++) {
        dense.push({ lat: a.lat + (b.lat - a.lat) * k / parts, lon: a.lon + (b.lon - a.lon) * k / parts });
      }
    }
    var comps = compiled.components, maxDistanceM = 0, disconnected = false, previousComp = null;
    dense.forEach(function (p) {
      var hit = nearestWayHit(p, compiled, toleranceM);
      if (!hit) { maxDistanceM = Infinity; return; }
      maxDistanceM = Math.max(maxDistanceM, hit.distanceM);
      var comp = comps[hit.wayIndex];
      if (previousComp !== null && comp !== previousComp) disconnected = true;
      previousComp = comp;
    });
    var maxCheckpointDistanceM = 0;
    (checkpoints || []).forEach(function (cp) {
      if (!cp || !isFinite(cp.lat) || !isFinite(cp.lon)) { maxCheckpointDistanceM = Infinity; return; }
      var hit = nearestWayHit({ lat: Number(cp.lat), lon: Number(cp.lon) }, compiled, toleranceM);
      maxCheckpointDistanceM = Math.max(maxCheckpointDistanceM, hit ? hit.distanceM : Infinity);
    });
    var reason = disconnected ? 'disconnected-route' :
      maxDistanceM > toleranceM ? 'route-off-way' :
      maxCheckpointDistanceM > toleranceM ? 'checkpoint-off-way' : null;
    return {
      certified: !reason, reason: reason, sampleSpacingM: spacingM,
      sampleCount: dense.length, maxDistanceM: maxDistanceM,
      maxCheckpointDistanceM: maxCheckpointDistanceM
    };
  }

  function roundedRoute(pts) {
    return pts.map(function (p) { return [+p.lat.toFixed(6), +p.lon.toFixed(6)]; });
  }

  function rechartCandidateMatchesOriginal(oldRoute, candidatePoints, opts) {
    opts = opts || {};
    if (!oldRoute.length || !candidatePoints || candidatePoints.length < 2) return false;
    var intendedStart = oldRoute[0];
    var startHit = nearestPointOnRoute(candidatePoints, intendedStart.lat, intendedStart.lon, false);
    var maxStartM = isFinite(opts.maxRechartStartM) ? Number(opts.maxRechartStartM) : 170;
    if (!startHit || startHit.distanceM > maxStartM) return false;
    return routesEquivalent(oldRoute, candidatePoints, {
      // Recharting reconciles source/basemap generalisation, so its corridor is
      // deliberately wider than duplicate detection. Bidirectional coverage
      // still prevents an equal-length but unrelated nearby circuit replacing it.
      thresholdM: isFinite(opts.rechartCorridorM) ? Number(opts.rechartCorridorM) : 190,
      minCoverage: isFinite(opts.minRechartCoverage) ? Number(opts.minRechartCoverage) : 0.58,
      minLengthRatio: isFinite(opts.minRechartLengthRatio) ? Number(opts.minRechartLengthRatio) : 0.58,
      sampleSpacingM: 35,
      maxSamples: 180
    });
  }

  // Atomic/idempotent migration for persisted and newly-created quests. Only
  // route geography/alignment metadata are changed; gameplay/progress fields
  // and checkpoint objects retain all identity, claim, reward and reached data.
  function repairQuestRouteAgainstWays(quest, ways, opts) {
    opts = opts || {};
    if (!quest || !Array.isArray(quest.route) || quest.route.length < 2) return { status: 'impossible', reason: 'invalid-quest' };
    var compiled = compileWalkableWays(ways);
    var usable = compiled.ways;
    if (!usable.length) return { status: 'pending', reason: 'tiles-not-ready' };
    var existing = certifyRouteAgainstWays(quest.route, quest.checkpoints || [], compiled);
    if (quest.routeAlignmentVersion === ROUTE_ALIGNMENT_VERSION && quest.routeCertification &&
        quest.routeCertification.status === 'certified' && existing.certified) {
      return { status: 'certified', changed: false, certification: existing };
    }
    // querySourceFeatures exposes only currently loaded viewport tiles. Once a
    // route has a durable certificate, contrary non-authoritative tile evidence
    // can only mean "not enough tiles yet"; it must never replace that certificate.
    if (quest.routeCertification && quest.routeCertification.status === 'certified' && !existing.certified &&
        !opts.authoritativeFullCoverage) {
      return { status: 'pending', reason: 'partial-tiles', changed: false };
    }

    var oldRoute = routeObjects(quest.route);
    var routeOnly = existing.reason === 'checkpoint-off-way' ? {
      certified: true, reason: null, sampleSpacingM: existing.sampleSpacingM,
      sampleCount: existing.sampleCount, maxDistanceM: existing.maxDistanceM
    } : certifyRouteAgainstWays(oldRoute, [], compiled);
    var candidate = routeOnly.certified ? { points: oldRoute, ring: routeIsStrictLoop(oldRoute), source: 'existing' } : null;

    // First reconcile the small source/tile offsets this helper was designed
    // for. A strict certificate and high snapped fraction make this controlled,
    // unlike rebuilding an entirely different loop merely because it is nearby.
    if (!candidate) {
      var smallSnapM = isFinite(opts.smallSnapM) ? Number(opts.smallSnapM) : 32;
      var snapped = snapRouteToWays(oldRoute, usable, {
        maxSnapM: smallSnapM,
        stepM: opts.snapStepM || 12,
        maxDensePts: opts.maxDensePts || 1800
      });
      var snappedCert = snapped.snappedFraction >= 0.94 ?
        certifyRouteAgainstWays(snapped.points, [], compiled) : { certified: false };
      if (snappedCert.certified && routesEquivalent(oldRoute, snapped.points, {
        thresholdM: smallSnapM + 3,
        minCoverage: 0.9,
        minLengthRatio: 0.8,
        sampleSpacingM: 24,
        maxSamples: 200
      })) {
        candidate = { points: snapped.points, ring: routeIsStrictLoop(snapped.points), source: 'snap' };
      }
    }

    if (!candidate) {
      // Always anchor topology repair to the persisted trailhead. The caller's
      // live GPS may be kilometres away and must never select a different loop.
      var anchoredOpts = {};
      Object.keys(opts).forEach(function (key) { anchoredOpts[key] = opts[key]; });
      anchoredOpts.startLat = oldRoute[0].lat;
      anchoredOpts.startLon = oldRoute[0].lon;
      candidate = rechartRouteOnWays(oldRoute, usable, anchoredOpts);
      if (candidate && !rechartCandidateMatchesOriginal(oldRoute, candidate.points, opts)) {
        return opts.authoritativeFullCoverage ? { status: 'impossible', reason: 'unrelated-route' } :
          { status: 'pending', reason: 'partial-tiles', changed: false };
      }
      if (candidate) candidate.source = 'rechart';
    }
    if (!candidate || !candidate.points || candidate.points.length < 2) {
      return opts.authoritativeFullCoverage ? { status: 'impossible', reason: 'no-connected-route' } :
        { status: 'pending', reason: 'partial-tiles', changed: false };
    }

    var points = candidate.points;
    // A middle-only tile fragment can look like a valid tiny replacement route.
    // Never truncate a saved quest from viewport evidence.
    if (!opts.authoritativeFullCoverage && routeLengthM(points) < routeLengthM(oldRoute) * 0.8) {
      return { status: 'pending', reason: 'partial-tiles', changed: false };
    }
    // Keep shape-preserving simplification only when its entire segments still
    // certify; otherwise persist the real source-edge geometry unchanged.
    if (points.length > 320) {
      var simpler = simplifyRoute(points, 320);
      if (certifyRouteAgainstWays(simpler, [], compiled).certified) points = simpler;
    }
    var newRoute = roundedRoute(points);
    var routeForFractions = { route: oldRoute.map(function (p) { return [p.lat, p.lon]; }) };
    var isLoop = candidate.ring === true && routeIsStrictLoop(points);
    var remappedCheckpoints = (quest.checkpoints || []).map(function (cp) {
      var next = {};
      Object.keys(cp || {}).forEach(function (key) { next[key] = cp[key]; });
      var target;
      if (cp.kind === 'npc') target = points[0];
      else if (cp.kind === 'finish') target = isLoop ? points[points.length - 1] : points[0];
      else target = pointAtFraction(points, questNearestRouteFraction(routeForFractions, cp.lat, cp.lon));
      if (target) { next.lat = +target.lat.toFixed(6); next.lon = +target.lon.toFixed(6); }
      return next;
    });
    var finalCert = certifyRouteAgainstWays(newRoute, remappedCheckpoints, compiled);
    if (!finalCert.certified) {
      return opts.authoritativeFullCoverage ? { status: 'impossible', reason: finalCert.reason, certification: finalCert } :
        { status: 'pending', reason: 'partial-tiles', changed: false, certification: finalCert };
    }

    if (!Array.isArray(quest.routeOriginal)) quest.routeOriginal = quest.route.map(function (p) { return p.slice(); });
    quest.route = newRoute;
    quest.checkpoints = remappedCheckpoints;
    quest.routeRaw = newRoute.map(function (p) { return p.slice(); });
    quest.loopStyle = isLoop ? 'loop' : 'out-and-back';
    quest.loopedBack = isLoop ? !!quest.loopedBack : false;
    quest.lengthM = Math.round(routeLengthM(points) * (isLoop ? 1 : 2));
    quest.routeAlignmentVersion = ROUTE_ALIGNMENT_VERSION;
    quest.routeCertification = {
      status: 'certified', schemaVersion: ROUTE_ALIGNMENT_VERSION,
      sampleSpacingM: ROUTE_CERTIFICATION_SAMPLE_M,
      toleranceM: ROUTE_CERTIFICATION_TOLERANCE_M
    };
    return { status: 'certified', changed: true, certification: finalCert };
  }

  // ---------------- Overpass (OpenStreetMap) trail discovery ----------------

  // kumi.systems mirror was unreliable in testing (90s timeouts); the VK mirror
  // answered in <0.5s with CORS *. Both honour OSM ODbL attribution requirements.
  var OVERPASS_ENDPOINTS = [
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
    'https://overpass-api.de/api/interpreter'
  ];

  function buildOverpassQuery(lat, lon, radiusM) {
    var r = Math.round(radiusM || 3000);
    var around = 'around:' + r + ',' + lat.toFixed(6) + ',' + lon.toFixed(6);
    // Clip output geometry to a box around the player: named trail relations can be
    // 100km+ long and `out geom` would otherwise return the whole thing (400KB+).
    var dLat = (r + 2000) / 111320;
    var dLon = (r + 2000) / (111320 * Math.max(0.2, Math.cos(toRad(lat))));
    var clip = (lat - dLat).toFixed(5) + ',' + (lon - dLon).toFixed(5) + ',' + (lat + dLat).toFixed(5) + ',' + (lon + dLon).toFixed(5);
    return '[out:json][timeout:14];(' +
      'relation[route~"^(hiking|foot|walking)$"](' + around + ');' +
      'way[highway~"^(path|footway|bridleway|track)$"][name](' + around + ');' +
      'way[designation~"public_footpath|public_bridleway|restricted_byway|byway_open_to_all_traffic",i](' + around + ');' +
      'way[highway~"^(path|footway)$"][foot~"^(designated|yes)$"](' + around + ');' +
      'way[highway~"^(path|footway|bridleway|track)$"][access!~"^(private|no)$"][foot!~"^(private|no)$"](' + around + ');' +
      ');out geom(' + clip + ') 400;'; // body verbosity: keeps relation members (tags verbosity drops them)
  }

  function wayToPoints(el) {
    // bbox-clipped output can null out points outside the clip window
    return (el.geometry || []).filter(function (g) { return g && isFinite(g.lat) && isFinite(g.lon); })
      .map(function (g) { return { lat: g.lat, lon: g.lon }; });
  }

  // Overpass returns hiking relations (named long trails) and footpath ways.
  // Turn them into quest offers: relations first (legendary trails), then named
  // footpaths grouped by name, then unnamed public footpaths.
  function parseOverpassTrails(json, playerLat, playerLon) {
    var els = (json && json.elements) || [];
    var offers = [];
    var wayGroups = {};
    var unnamedWalkableWays = [];
    var walkableWays = []; // every walkable geometry, fuel for the footpath ring network
    var networkAllPublic = true;
    els.forEach(function (el) {
      if (el.type === 'relation' && el.tags) {
        // Geometry arrives clipped to the query bbox, so member ways can be
        // fragments in arbitrary order — chain them end-to-end first.
        var memberSegs = [];
        (el.members || []).forEach(function (m) {
          if (m.type === 'way' && m.geometry) {
            var seg = wayToPoints(m); // strips nulls left by bbox clipping
            if (seg.length >= 2) { memberSegs.push(seg); walkableWays.push(seg); }
          }
        });
        var pts = chainWays(memberSegs);
        if (pts.length >= 2) {
          offers.push({
            kind: 'trail',
            ref: 'rel/' + el.id,
            name: (el.tags.name || el.tags.ref || 'Ancient Trail'),
            points: pts,
            tags: el.tags,
            namedHikingRoute: !!(el.tags.name || el.tags.ref)
          });
        }
      } else if (el.type === 'way' && el.tags && el.geometry && el.geometry.length >= 2) {
        var info = questWayClassification(el.tags);
        if (!info.eligible) return;
        var wayPoints = wayToPoints(el);
        if (wayPoints.length < 2) return;
        walkableWays.push(wayPoints);
        if (!info.publicFootpath) networkAllPublic = false;
        var isPublic = info.publicFootpath;
        var nm = el.tags.name;
        if (nm) {
          var key = nm.toLowerCase();
          if (!wayGroups[key]) wayGroups[key] = { name: nm, ways: [], allPublic: isPublic, explicitPublic: info.explicitPublic };
          wayGroups[key].ways.push(el);
          if (!isPublic) wayGroups[key].allPublic = false;
          if (info.explicitPublic) wayGroups[key].explicitPublic = true;
        } else {
          if (isPublic) unnamedWalkableWays.push(el);
        }
      }
    });

    Object.keys(wayGroups).forEach(function (k) {
      var g = wayGroups[k];
      var pts = chainWays(g.ways.map(wayToPoints));
      if (pts.length < 2) return;
      offers.push({
        kind: g.allPublic ? 'footpath' : 'path',
        ref: 'way/' + g.ways.map(function (w) { return w.id; }).join('+'),
        name: g.name,
        points: pts,
        tags: g.ways[0].tags || {},
        publicRightOfWay: !!g.explicitPublic && !!g.allPublic
      });
    });

    // Unnamed walkable paths from the basemap: every real connected cluster is
    // a quest. Never bridge disconnected paths with a cross-field shortcut.
    var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    clusterChains(unnamedWalkableWays.map(wayToPoints)).slice(0, 10).forEach(function (pts, i) {
      if (pts.length < 2) return;
      offers.push({
        kind: 'footpath',
        ref: 'footpath-cluster/' + i,
        name: 'Mapped Footpath ' + (ROMAN[i] || (i + 1)),
        points: pts,
        tags: {},
        publicRightOfWay: true
      });
    });

    offers.forEach(function (o) {
      o.points = normaliseTrailForPlayer(o.points, playerLat, playerLon);
      o.lengthM = routeLengthM(o.points);
      var s = o.points[0];
      o.startDistM = questHaversine(playerLat, playerLon, s.lat, s.lon);
    });

    // Playable filter: at least ~350m of walking, start within 2.5km.
    offers = offers.filter(function (o) { return o.lengthM >= 350 && o.startDistM <= 2500; });

    offers = sortOffersByStartDistance(offers).slice(0, 12);
    // Footpaths right next to the player ALWAYS yield a quest — a ring around
    // the path network when one exists, a straight walk otherwise. Added after
    // the playable filter so short-but-adjacent paths can't be filtered away.
    offers = ensureFootpathQuestNearPlayer(offers, walkableWays, playerLat, playerLon, {
      publicRightOfWay: networkAllPublic && walkableWays.length > 0
    });
    return sortOffersByStartDistance(dedupeQuestOffers(offers)).slice(0, 12);
  }

  // Greedy end-to-end chaining of way fragments. Returns ALL connected chains,
  // longest first — disconnected fragments become separate chains (and, for
  // public footpaths, separate quests).
  function clusterChains(ways) {
    var segs = ways.filter(function (w) { return w.length >= 2; });
    var chains = [];
    var guard = 0;
    while (segs.length && guard++ < 500) {
      var chain = segs.shift();
      var joined = true;
      while (joined && segs.length && guard++ < 500) {
        joined = false;
        var head = chain[0], tail = chain[chain.length - 1];
        var bestI = -1, bestMode = null, bestD = 1.5; // shared-node joins only; never bridge a mapped gap
        for (var i = 0; i < segs.length; i++) {
          var s = segs[i];
          var d;
          d = questHaversine(tail.lat, tail.lon, s[0].lat, s[0].lon); if (d < bestD) { bestD = d; bestI = i; bestMode = 'append'; }
          d = questHaversine(tail.lat, tail.lon, s[s.length - 1].lat, s[s.length - 1].lon); if (d < bestD) { bestD = d; bestI = i; bestMode = 'appendRev'; }
          d = questHaversine(head.lat, head.lon, s[s.length - 1].lat, s[s.length - 1].lon); if (d < bestD) { bestD = d; bestI = i; bestMode = 'prepend'; }
          d = questHaversine(head.lat, head.lon, s[0].lat, s[0].lon); if (d < bestD) { bestD = d; bestI = i; bestMode = 'prependRev'; }
        }
        if (bestI >= 0) {
          var seg = segs.splice(bestI, 1)[0];
          if (bestMode === 'appendRev' || bestMode === 'prependRev') seg = seg.slice().reverse();
          chain = (bestMode === 'append' || bestMode === 'appendRev') ? chain.concat(seg) : seg.concat(chain);
          joined = true;
        }
      }
      chains.push(chain);
    }
    chains.sort(function (a, b) { return routeLengthM(b) - routeLengthM(a); });
    return chains;
  }

  // Back-compat single-chain helper: the longest connected chain of the set.
  function chainWays(ways) {
    var chains = clusterChains(ways);
    return chains.length ? chains[0] : [];
  }

  // Start every offer at the point nearest the player. Preserve a complete natural
  // loop instead of cutting it in half; only linear/very long trails are sliced.
  function normaliseTrailForPlayer(pts, playerLat, playerLon, maxLenM) {
    maxLenM = maxLenM || 6000;
    if (pts.length < 2) return pts;
    var closesM = questHaversine(pts[0].lat, pts[0].lon, pts[pts.length - 1].lat, pts[pts.length - 1].lon);
    var naturalLoop = routeIsStrictLoop(pts) && routeLengthM(pts) <= maxLenM * 1.5;
    var ring = pts.slice();
    if (naturalLoop && closesM <= 0.25) ring.pop(); // discard only a true duplicate closing node
    var nearest = nearestPointOnRoute(ring, playerLat, playerLon, naturalLoop);
    var bestI = nearest ? nearest.segmentIndex : 0;
    var startPoint = nearest ? nearest.point : ring[bestI];
    if (naturalLoop) {
      var rotated = [startPoint].concat(ring.slice(bestI + 1), ring.slice(0, bestI + 1));
      var last = rotated[rotated.length - 1];
      if (!last || questHaversine(last.lat, last.lon, startPoint.lat, startPoint.lon) > 0.25) {
        rotated.push({ lat: startPoint.lat, lon: startPoint.lon });
      } else {
        rotated[rotated.length - 1] = { lat: startPoint.lat, lon: startPoint.lon };
      }
      return rotated;
    }
    // Walk outward from the nearest point in the longer direction until maxLen.
    var fwd = [startPoint].concat(ring.slice(bestI + 1));
    var back = [startPoint].concat(ring.slice(0, bestI + 1).reverse());
    var pick = routeLengthM(fwd) >= routeLengthM(back) ? fwd : back;
    var out = [pick[0]], acc = 0;
    for (var j = 1; j < pick.length; j++) {
      acc += questHaversine(pick[j - 1].lat, pick[j - 1].lon, pick[j].lat, pick[j].lon);
      out.push(pick[j]);
      if (acc >= maxLenM) break;
    }
    return out;
  }

  // ---------------- Footpath ring quests (graph loops, no routing server) ----------------

  // Two separate tolerances, because conflating them is what put a straight
  // diagonal across the footpath. joinM (generous) decides where to SPLIT a way
  // for a T-junction — harmless if a touch loose. mergeM (tight) decides which
  // endpoints FUSE into one shared node — and fusing two genuinely-different
  // path ends that sit, say, 15 m apart is what makes the drawn ring slash
  // straight across the gap between them. Real OSM/tile junctions share the
  // exact same node (gap ~0), so a tight mergeM keeps every true junction while
  // refusing to invent a connection where the map shows none.
  var PATH_MERGE_M = 1;

  // Build a node/edge graph from walkable way geometries. Ways are split where
  // another way's endpoint touches them (within joinM), then endpoints within
  // mergeM merge into shared nodes. Edges keep their full real geometry.
  function buildPathNetwork(ways, joinM, mergeM) {
    joinM = joinM || 20;
    mergeM = mergeM || Math.min(joinM, PATH_MERGE_M);
    var segs = (ways || []).filter(function (w) { return w && w.length >= 2; });
    var cellDeg = Math.max(joinM, 1) / 111320;
    function gridCell(lat, lon) {
      var cosLat = Math.max(0.2, Math.cos(toRad(lat)));
      return [Math.round(lon * cosLat / cellDeg), Math.round(lat / cellDeg)];
    }
    function gridPush(grid, lat, lon, val) {
      var c = gridCell(lat, lon), k = c[0] + '_' + c[1];
      (grid[k] = grid[k] || []).push(val);
    }
    function gridNear(grid, lat, lon) {
      var c = gridCell(lat, lon), out = [];
      for (var dx = -1; dx <= 1; dx++) for (var dy = -1; dy <= 1; dy++) {
        var arr = grid[(c[0] + dx) + '_' + (c[1] + dy)];
        if (arr) out = out.concat(arr);
      }
      return out;
    }

    // Junction detection: split a way wherever another way's endpoint sits on it.
    var endGrid = {};
    segs.forEach(function (w) {
      gridPush(endGrid, w[0].lat, w[0].lon, w[0]);
      gridPush(endGrid, w[w.length - 1].lat, w[w.length - 1].lon, w[w.length - 1]);
    });
    var pieces = [];
    segs.forEach(function (w) {
      var cur = [w[0]];
      for (var i = 1; i < w.length; i++) {
        cur.push(w[i]);
        if (i === w.length - 1) break;
        var touches = gridNear(endGrid, w[i].lat, w[i].lon).some(function (p) {
          return p !== w[i] && questHaversine(p.lat, p.lon, w[i].lat, w[i].lon) <= joinM;
        });
        if (touches) { pieces.push(cur); cur = [w[i]]; }
      }
      if (cur.length >= 2) pieces.push(cur);
    });

    var nodes = [], edges = [], nodeGrid = {};
    function nodeIdFor(p) {
      var cands = gridNear(nodeGrid, p.lat, p.lon);
      for (var i = 0; i < cands.length; i++) {
        if (questHaversine(nodes[cands[i]].lat, nodes[cands[i]].lon, p.lat, p.lon) <= mergeM) return cands[i];
      }
      var id = nodes.length;
      nodes.push({ lat: p.lat, lon: p.lon, edges: [] });
      gridPush(nodeGrid, p.lat, p.lon, id);
      return id;
    }
    pieces.forEach(function (pts) {
      var lenM = routeLengthM(pts);
      if (!(lenM > 0)) return;
      var a = nodeIdFor(pts[0]), b = nodeIdFor(pts[pts.length - 1]);
      var e = { id: edges.length, a: a, b: b, pts: pts, lenM: lenM };
      edges.push(e);
      nodes[a].edges.push(e.id);
      if (b !== a) nodes[b].edges.push(e.id);
    });
    return { nodes: nodes, edges: edges };
  }

  // Snap a position onto the nearest edge and split the edge at that point, so
  // ring searches start exactly where the player joins the path network.
  function insertNetworkStart(net, lat, lon, maxSnapM) {
    var best = null;
    net.edges.forEach(function (e) {
      var n = nearestPointOnRoute(e.pts, lat, lon, false);
      if (n && (!best || n.distanceM < best.hit.distanceM)) best = { edge: e, hit: n };
    });
    if (!best || best.hit.distanceM > (maxSnapM || 400)) return null;
    var e = best.edge, hit = best.hit;
    var p = { lat: hit.point.lat, lon: hit.point.lon };
    var dA = questHaversine(p.lat, p.lon, net.nodes[e.a].lat, net.nodes[e.a].lon);
    var dB = questHaversine(p.lat, p.lon, net.nodes[e.b].lat, net.nodes[e.b].lon);
    if (Math.min(dA, dB) <= 15) return { nodeId: dA <= dB ? e.a : e.b, snapDistM: hit.distanceM };
    var id = net.nodes.length;
    net.nodes.push({ lat: p.lat, lon: p.lon, edges: [] });
    var firstPts = e.pts.slice(0, hit.segmentIndex + 1).concat([p]);
    var secondPts = [p].concat(e.pts.slice(hit.segmentIndex + 1));
    var oldB = e.b;
    e.b = id; e.pts = firstPts; e.lenM = routeLengthM(firstPts);
    if (oldB !== e.a) {
      var listB = net.nodes[oldB].edges;
      var at = listB.indexOf(e.id);
      if (at >= 0) listB.splice(at, 1);
    }
    net.nodes[id].edges.push(e.id);
    var e2 = { id: net.edges.length, a: id, b: oldB, pts: secondPts, lenM: routeLengthM(secondPts) };
    net.edges.push(e2);
    net.nodes[id].edges.push(e2.id);
    net.nodes[oldB].edges.push(e2.id);
    return { nodeId: id, snapDistM: hit.distanceM };
  }

  function edgePointsFrom(net, edgeId, fromNode) {
    var e = net.edges[edgeId];
    return e.a === fromNode ? e.pts.slice() : e.pts.slice().reverse();
  }

  // Dijkstra over the (small) footpath network. excludedEdges (a map of
  // edgeId -> true) keeps a ring search from walking straight back along
  // edges it already used.
  function networkShortestPath(net, fromNode, toNode, excludedEdges) {
    excludedEdges = excludedEdges || {};
    var n = net.nodes.length;
    var dist = new Array(n), prevEdge = new Array(n), done = new Array(n);
    for (var i = 0; i < n; i++) { dist[i] = Infinity; prevEdge[i] = -1; done[i] = false; }
    dist[fromNode] = 0;
    for (var iter = 0; iter < n; iter++) {
      var u = -1, bd = Infinity;
      for (var j = 0; j < n; j++) if (!done[j] && dist[j] < bd) { bd = dist[j]; u = j; }
      if (u < 0) break;
      done[u] = true;
      if (u === toNode) break;
      net.nodes[u].edges.forEach(function (eid) {
        if (excludedEdges[eid]) return;
        var e = net.edges[eid];
        var v = e.a === u ? e.b : e.a;
        if (done[v]) return;
        var nd = dist[u] + e.lenM;
        if (nd < dist[v]) { dist[v] = nd; prevEdge[v] = eid; }
      });
    }
    if (!isFinite(dist[toNode])) return null;
    var seq = [], cur = toNode, guard = 0;
    while (cur !== fromNode && guard++ < net.edges.length + 2) {
      var eid = prevEdge[cur];
      if (eid < 0) return null;
      seq.unshift(eid);
      var e = net.edges[eid];
      cur = e.a === cur ? e.b : e.a;
    }
    return { lenM: dist[toNode], edgeIds: seq };
  }

  // Deterministic longest shortest-path in the connected component. This is
  // the safe fallback for legacy rings when the visible network has no cycle:
  // walk out along real edges and return over the same certified geometry.
  function networkFurthestPath(net, fromNode) {
    var best = null;
    for (var node = 0; node < net.nodes.length; node++) {
      if (node === fromNode) continue;
      var path = networkShortestPath(net, fromNode, node);
      if (!path || !path.edgeIds.length) continue;
      if (!best || path.lenM > best.path.lenM + 0.001 ||
          (Math.abs(path.lenM - best.path.lenM) <= 0.001 && node < best.node)) {
        best = { node: node, path: path };
      }
    }
    return best;
  }

  function pathPointsAlongEdges(net, fromNode, edgeIds, startPts) {
    var pts = startPts ? startPts.slice() : [{ lat: net.nodes[fromNode].lat, lon: net.nodes[fromNode].lon }];
    var cur = fromNode;
    edgeIds.forEach(function (eid) {
      var seg = edgePointsFrom(net, eid, cur);
      // Two edges meet at a shared graph node, but each edge keeps its own real
      // endpoint — at a true junction those endpoints coincide, so we drop the
      // duplicate. When they differ (a small tolerated fusion), KEEP the next
      // edge's real start: the line then walks edge A to its real end and
      // bridges to edge B's real start, instead of skipping B's endpoint and
      // cutting a diagonal across the gap.
      var last = pts[pts.length - 1];
      var coincident = last && seg[0] && questHaversine(last.lat, last.lon, seg[0].lat, seg[0].lon) <= 1;
      pts = pts.concat(seg.slice(coincident ? 1 : 0));
      var e = net.edges[eid];
      cur = e.a === cur ? e.b : e.a;
    });
    return pts;
  }

  // Planar shoelace area of a closed ring, m². An "out and back along the same
  // line" pseudo-ring encloses ~nothing — this is how those get rejected.
  function ringAreaM2(pts) {
    if (!pts || pts.length < 3) return 0;
    var lat0 = pts[0].lat, lon0 = pts[0].lon;
    var cosLat = Math.max(0.2, Math.cos(toRad(lat0)));
    var area = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      var ax = (a.lon - lon0) * 111320 * cosLat, ay = (a.lat - lat0) * 111320;
      var bx = (b.lon - lon0) * 111320 * cosLat, by = (b.lat - lat0) * 111320;
      area += ax * by - bx * ay;
    }
    return Math.abs(area) / 2;
  }

  var RING_MIN_LEN_M = 450;
  var RING_MAX_LEN_M = 6500;
  var RING_TARGET_LEN_M = 2500;
  var RING_MIN_MEAN_WIDTH_M = 12; // require area >= lenM * this

  // Cycle through startNode: leave along each incident edge in turn and ask
  // Dijkstra for a way home that doesn't reuse that edge. Closest-to-target
  // length wins; degenerate there-and-back "rings" fail the area check.
  function findFootpathRing(net, startNode, opts) {
    opts = opts || {};
    var minLen = opts.minLenM || RING_MIN_LEN_M;
    var maxLen = opts.maxLenM || RING_MAX_LEN_M;
    var target = opts.targetLenM || RING_TARGET_LEN_M;
    var node = net.nodes[startNode];
    if (!node) return null;
    var best = null, tried = {};
    function consider(pts, lenM) {
      if (lenM < minLen || lenM > maxLen) return false;
      if (ringAreaM2(pts) < lenM * (opts.minMeanWidthM || RING_MIN_MEAN_WIDTH_M)) return false;
      var score = Math.abs(lenM - target);
      if (!best || score < best.score) best = { points: pts, lengthM: lenM, score: score };
      return true;
    }
    node.edges.forEach(function (eid) {
      if (tried[eid]) return;
      tried[eid] = true;
      var e = net.edges[eid];
      if (e.a === e.b) { // a way that is itself a closed loop
        consider(edgePointsFrom(net, eid, startNode), e.lenM);
        return;
      }
      var other = e.a === startNode ? e.b : e.a;
      // The shortest cycle can be a too-small city block or a too-thin
      // there-and-back — when it is, ban that home path and look wider.
      var excluded = {};
      excluded[eid] = true;
      for (var attempt = 0; attempt < 4; attempt++) {
        var home = networkShortestPath(net, other, startNode, excluded);
        if (!home) return;
        var lenM = e.lenM + home.lenM;
        if (lenM > maxLen) return;
        var pts = pathPointsAlongEdges(net, other, home.edgeIds, edgePointsFrom(net, eid, startNode));
        if (consider(pts, lenM)) return;
        home.edgeIds.forEach(function (id) { excluded[id] = true; });
      }
    });
    if (!best) return null;
    var s = net.nodes[startNode];
    var last = best.points[best.points.length - 1];
    if (questHaversine(last.lat, last.lon, s.lat, s.lon) > 1) best.points.push({ lat: s.lat, lon: s.lon });
    return { points: best.points, lengthM: best.lengthM };
  }

  // A ring straight through the player's spot, or — when they stand on a
  // dead-end spur — a lollipop: connector out to a junction, ring around it,
  // same connector home. Either way the walk ends exactly where it began.
  function findFootpathLoopFrom(net, startNode, opts) {
    opts = opts || {};
    var direct = findFootpathRing(net, startNode, opts);
    if (direct) return { points: direct.points, lengthM: direct.lengthM, viaSpur: false };
    var maxLen = opts.maxLenM || RING_MAX_LEN_M;
    var junctions = [];
    for (var t = 0; t < net.nodes.length; t++) {
      if (t !== startNode && net.nodes[t].edges.length >= 3) junctions.push(t);
    }
    var reachable = junctions.map(function (t) {
      var path = networkShortestPath(net, startNode, t);
      return path ? { node: t, path: path } : null;
    }).filter(function (r) { return r && r.path.lenM * 2 < maxLen; })
      .sort(function (x, y) { return x.path.lenM - y.path.lenM; });
    for (var i = 0; i < Math.min(reachable.length, 12); i++) {
      var r = reachable[i];
      var ring = findFootpathRing(net, r.node, Object.assign({}, opts, {
        minLenM: Math.max(250, (opts.minLenM || RING_MIN_LEN_M) - r.path.lenM * 2),
        maxLenM: maxLen - r.path.lenM * 2
      }));
      if (!ring) continue;
      var outPts = pathPointsAlongEdges(net, startNode, r.path.edgeIds);
      var backPts = outPts.slice().reverse();
      var pts = outPts.concat(ring.points.slice(1)).concat(backPts.slice(1));
      return { points: pts, lengthM: r.path.lenM * 2 + ring.lengthM, viaSpur: true };
    }
    return null;
  }

  // Whenever public footpaths run near the player there is ALWAYS a quest that
  // starts on them: a ring back to the start when the network allows one,
  // otherwise a straight out-and-back walk along the nearest connected paths.
  var FOOTPATH_NEARBY_M = 400;
  function ensureFootpathQuestNearPlayer(offers, walkableWays, playerLat, playerLon, opts) {
    opts = opts || {};
    offers = offers || [];
    var nearM = opts.nearM || FOOTPATH_NEARBY_M;
    var segs = (walkableWays || []).filter(function (w) { return w && w.length >= 2; });
    if (!segs.length || !isFinite(playerLat) || !isFinite(playerLon)) return offers;
    var net = buildPathNetwork(segs, opts.joinM);
    var start = insertNetworkStart(net, playerLat, playerLon, nearM);
    if (!start) return offers; // no footpath near the player
    var out = offers.slice();
    var loop = findFootpathLoopFrom(net, start.nodeId, opts);
    if (loop && loop.points.length >= 3) {
      var sp = loop.points[0];
      out.unshift({
        kind: 'footpath',
        ref: 'footpath-ring/' + sp.lat.toFixed(5) + ',' + sp.lon.toFixed(5),
        name: 'Footpath Ring',
        points: loop.points,
         tags: {},
         publicRightOfWay: !!opts.publicRightOfWay,
         ring: true,
        lengthM: routeLengthM(loop.points),
        startDistM: questHaversine(playerLat, playerLon, sp.lat, sp.lon)
      });
      return out;
    }
    // No ring anywhere in this network — guarantee a straight quest instead,
    // but only if nothing else already starts within reach.
    var hasNearbyStart = out.some(function (o) {
      var d = Number(o && o.startDistM);
      return isFinite(d) && d <= nearM;
    });
    if (hasNearbyStart) return out;
    var chains = clusterChains(segs.map(function (w) { return w.slice(); }));
    var bestChain = null, bestD = Infinity;
    chains.forEach(function (chain) {
      var n = nearestPointOnRoute(chain, playerLat, playerLon, false);
      if (n && n.distanceM < bestD) { bestD = n.distanceM; bestChain = chain; }
    });
    if (!bestChain || bestD > nearM) return out;
    var pts = normaliseTrailForPlayer(bestChain, playerLat, playerLon);
    if (pts.length < 2 || routeLengthM(pts) < (opts.minStraightM || 120)) return out;
    out.unshift({
      kind: 'footpath',
      ref: 'footpath-near/' + pts[0].lat.toFixed(5) + ',' + pts[0].lon.toFixed(5),
      name: 'Nearby Footpath Walk',
      points: pts,
       tags: {},
       publicRightOfWay: !!opts.publicRightOfWay,
       lengthM: routeLengthM(pts),
      startDistM: questHaversine(playerLat, playerLon, pts[0].lat, pts[0].lon)
    });
    return out;
  }

  // Turn the walkable path geometry already visible in MapLibre into offers.
  function parseMapWalkableFeatures(features, playerLat, playerLon) {
    var elements = [], seen = {};
    (features || []).forEach(function (feature, fi) {
      if (!isEligibleQuestDiscoveryFeature(feature)) return;
      var props = feature.properties || {}, geom = feature.geometry || {};
      var cls = mapTransportationClass(feature);
      var tags = {};
      Object.keys(props).forEach(function (key) {
        if (props[key] == null || typeof props[key] === 'object') return;
        tags[key] = props[key];
      });
      tags.highway = cls;
      if (!tags.name && props.ref) tags.name = props.ref;
      var lines = geom.type === 'LineString' ? [geom.coordinates] :
        geom.type === 'MultiLineString' ? geom.coordinates : [];
      lines.forEach(function (coords, li) {
        var geometry = (coords || []).filter(function (c) { return c && isFinite(c[0]) && isFinite(c[1]); })
          .map(function (c) { return { lat: Number(c[1]), lon: Number(c[0]) }; });
        if (geometry.length < 2) return;
        var key = canonicalWayKey(geometry);
        if (seen[key]) return;
        seen[key] = true;
        elements.push({ type: 'way', id: 'map_' + fi + '_' + li,
          tags: tags, geometry: geometry });
      });
    });
    return parseOverpassTrails({ elements: elements }, playerLat, playerLon).map(function (offer, i) {
      offer.source = 'visible-map';
      offer.ref = 'map-path/' + i + '-' + Math.abs(Math.round((offer.points[0].lat * 1e5) + (offer.points[0].lon * 1e5)));
      return offer;
    });
  }

  // ---------------- Fallback: game-generated adventure loop ----------------

  // Deterministic-ish loop of GPS waypoints around the player. No routing engine:
  // waypoints are targets, the walker picks real paths between them.
  function generateAdventureRoute(lat, lon, targetLenM, rand) {
    rand = rand || Math.random;
    targetLenM = targetLenM || 2500;
    var radius = Math.max(180, targetLenM / (2 * Math.PI));
    var startBearing = Math.floor(rand() * 360);
    var centre = destPoint(lat, lon, startBearing, radius);
    var n = 10;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var ang = startBearing + 180 + (360 * i / n); // player sits on the circle
      var jitter = 1 + (rand() - 0.5) * 0.35;
      var p = destPoint(centre.lat, centre.lon, ang % 360, radius * jitter);
      pts.push(p);
    }
    pts[0] = { lat: lat, lon: lon };
    pts[pts.length - 1] = { lat: lat, lon: lon }; // loop home
    return pts;
  }

  // Route a set of waypoints along real walkable paths via the free BRouter
  // public instance (no key, CORS *, hiking profile). Resolves to the snapped
  // polyline, or null when the router is unreachable or returns nothing.
  function brouterRoute(waypoints, opts) {
    opts = opts || {};
    var fetchFn = opts.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(window) : null);
    if (!fetchFn || !waypoints || waypoints.length < 2) return Promise.resolve(null);
    var lonlats = waypoints.map(function (p) { return p.lon.toFixed(6) + ',' + p.lat.toFixed(6); }).join('|');
    var url = (opts.brouterBase || 'https://brouter.de/brouter') +
      '?lonlats=' + encodeURIComponent(lonlats) + '&profile=hiking-mountain&alternativeidx=0&format=geojson';
    var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
    var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 9000) : null;
    return fetchFn(url, { signal: ctrl ? ctrl.signal : undefined }).then(function (r) {
      if (timer) clearTimeout(timer);
      if (!r.ok) throw new Error('brouter ' + r.status);
      return r.json();
    }).then(function (gj) {
      var coords = gj && gj.features && gj.features[0] && gj.features[0].geometry && gj.features[0].geometry.coordinates;
      if (!coords || coords.length < 2) return null;
      return coords.map(function (c) { return { lat: c[1], lon: c[0] }; });
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      console.warn('BURBZ quest brouter unreachable:', err && err.message);
      return null;
    });
  }

  // Snap a generated loop onto real walkable paths. Falls back to the raw
  // waypoint loop if the router is unreachable — the quest still works as GPS targets.
  function fetchAdventureRoute(lat, lon, targetLenM, opts) {
    opts = opts || {};
    var raw = generateAdventureRoute(lat, lon, targetLenM, opts.rand);
    // 4 corner waypoints + home keeps the URL small and the loop shape intact.
    var wp = [raw[0], raw[Math.floor(raw.length * 0.25)], raw[Math.floor(raw.length * 0.5)], raw[Math.floor(raw.length * 0.75)], raw[raw.length - 1]];
    return brouterRoute(wp, opts).then(function (pts) {
      if (!pts) return raw;
      // Sanity: keep the snapped route only if it stayed roughly loop-sized.
      var len = routeLengthM(pts);
      if (len < targetLenM * 0.4 || len > targetLenM * 3.2) return raw;
      return pts;
    });
  }

  function bearingBetween(a, b) {
    var la1 = toRad(a.lat), la2 = toRad(b.lat), dLon = toRad(b.lon - a.lon);
    var y = Math.sin(dLon) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  }

  // Fraction of polyline A that runs within thresholdM of polyline B — used to
  // reject "loops" that mostly retrace the outward path.
  function routeOverlapFraction(aPts, bPts, thresholdM) {
    thresholdM = thresholdM || 40;
    var a = decimateRoute(aPts, 50), b = decimateRoute(bPts, 60);
    if (!a.length || !b.length) return 0;
    var hits = 0;
    a.forEach(function (p) {
      for (var i = 0; i < b.length; i++) {
        if (questHaversine(p.lat, p.lon, b[i].lat, b[i].lon) <= thresholdM) { hits++; return; }
      }
    });
    return hits / a.length;
  }

  // A linear trail no longer has to mean walking back the way you came: ask
  // the router for a RETURN leg from the trail's end to its start that bows
  // away from the outward path, turning the whole walk into one loop. Several
  // via points are tried — both sides of the start-end chord at growing
  // offsets — because the nearest detour often has no footpaths while a wider
  // one does, plus a final no-via leg (the path network sometimes loops home
  // by itself). A leg that mostly retraces the outward trail is rejected; a
  // clearly-different leg is accepted on the spot, otherwise the least
  // retracing candidate found within the time budget wins.
  // Resolves null only when no sane loop exists — callers keep the out-and-back.
  var LOOP_ACCEPT_OVERLAP = 0.45; // different enough to stop searching
  var LOOP_MAX_OVERLAP = 0.8;     // above this the way home is basically a retrace
  function fetchLoopBackRoute(points, opts) {
    opts = opts || {};
    var outward = trimRouteToLength(points, opts.oneWayCapM || OUT_AND_BACK_ONE_WAY_CAP_M);
    if (!outward || outward.length < 2) return Promise.resolve(null);
    var start = outward[0], end = outward[outward.length - 1];
    var directD = questHaversine(end.lat, end.lon, start.lat, start.lon);
    if (directD <= LOOP_ENDS_MEET_M) return Promise.resolve(null); // already a natural loop
    var outwardLen = routeLengthM(outward);
    var chordMid = { lat: (start.lat + end.lat) / 2, lon: (start.lon + end.lon) / 2 };
    var routeMid = pointAtFraction(outward, 0.5);
    // Bow the return leg away from wherever the outward path bulges; on a
    // dead-straight trail just pick a perpendicular side (both get tried).
    var awayBearing = questHaversine(routeMid.lat, routeMid.lon, chordMid.lat, chordMid.lon) > 40
      ? bearingBetween(routeMid, chordMid)
      : (bearingBetween(end, start) + 90) % 360;
    var vias = [];
    [0.45, 0.75, 0.25, 1.1].forEach(function (f) {
      var off = Math.max(140, Math.min(1100, directD * f));
      vias.push([destPoint(chordMid.lat, chordMid.lon, awayBearing, off)]);
      vias.push([destPoint(chordMid.lat, chordMid.lon, (awayBearing + 180) % 360, off)]);
    });
    vias.push([]); // straight end→start: fine when the network differs anyway
    var maxLegLen = Math.max(outwardLen * 1.8, directD * 3) + 800;
    // Keep loop charting responsive on a slow public router. Natural mapped
    // loops are already preferred in discovery; this is a bounded best effort
    // for a different-path return on an otherwise linear quest.
    var deadline = Date.now() + (opts.maxTotalMs || 8000);
    var best = null;
    function finish(cand) {
      if (!cand) return null;
      var combined = outward.concat(cand.pts.slice(1));
      if (!routeIsStrictLoop(combined)) return null;
      return { points: combined, loopedBack: true, returnLenM: Math.round(cand.len), totalLenM: Math.round(outwardLen + cand.len) };
    }
    function tryVia(i) {
      if (i >= vias.length || Date.now() > deadline) return Promise.resolve(finish(best));
      var routeOpts = {};
      Object.keys(opts).forEach(function (key) { routeOpts[key] = opts[key]; });
      routeOpts.timeoutMs = Math.min(opts.timeoutMs || 4000, Math.max(500, deadline - Date.now()));
      return brouterRoute([end].concat(vias[i]).concat([start]), routeOpts).then(function (legPts) {
        if (legPts && legPts.length >= 2) {
          var legLen = routeLengthM(legPts);
          if (legLen <= maxLegLen) {
            var overlap = routeOverlapFraction(legPts, outward, 40);
            if (overlap <= LOOP_ACCEPT_OVERLAP) return finish({ pts: legPts, len: legLen, overlap: overlap });
            if (overlap <= LOOP_MAX_OVERLAP && (!best || overlap < best.overlap)) best = { pts: legPts, len: legLen, overlap: overlap };
          }
        }
        return tryVia(i + 1);
      });
    }
    return tryVia(0);
  }

  // ---------------- Quest assembly ----------------

  var QUEST_GIVER_NAMES = ['Elder Bramblewing', 'Sage Oakfeather', 'Warden Thistledown', 'Keeper Mossbeak'];
  var CHEST_LOOT = [
    { coins: 25, xp: 10, larder: { field_vole: 2, mealworm_scoop: 1 } },
    { coins: 40, xp: 12, larder: { small_bird_prey_ration: 1, garden_worms: 2 } },
    { coins: 30, xp: 15, larder: { field_vole: 1, live_minnow: 2 } },
    { coins: 20, xp: 25, larder: { small_bird_prey_ration: 2, sunflower_seeds: 1 } },
    // Bird-study scrolls go to the bag; use them from there on a bird you choose.
    { coins: 15, item: 'xp_scroll_minor', larder: { field_vole: 2, hedgerow_berries: 1 } },
    { coins: 10, item: 'xp_scroll_greater', larder: { small_bird_prey_ration: 1, pondweed_tangle: 2 } }
  ];

  function chestLootHash(value) {
    var text = String(value || 'legacy-chest'), hash = 2166136261;
    for (var i = 0; i < text.length; i++) { hash ^= text.charCodeAt(i); hash = Math.imul(hash, 16777619); }
    return hash >>> 0;
  }

  // Clone persisted loot and repair old active quests deterministically. Legacy
  // chests pre-date food/progression rewards, so the stable claim key chooses a
  // useful bundle once instead of rerolling whenever the save is loaded.
  function normaliseChestLoot(raw, stableKey) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var out = {};
    Object.keys(source).forEach(function (key) {
      if (key !== 'larder') out[key] = source[key];
    });
    out.coins = Math.max(1, Math.floor(Number(out.coins) || 25));
    if (!(Number(out.xp) > 0) && !out.item) out.xp = 10;
    var larder = {};
    if (source.larder && typeof source.larder === 'object' && !Array.isArray(source.larder)) {
      Object.keys(source.larder).forEach(function (id) {
        var qty = Math.max(0, Math.floor(Number(source.larder[id]) || 0));
        if (qty) larder[id] = qty;
      });
    }
    var units = Object.keys(larder).reduce(function (sum, id) { return sum + larder[id]; }, 0);
    var primary = (larder.field_vole || 0) + (larder.small_bird_prey_ration || 0);
    if (primary < 1 || units < 3 || Object.keys(larder).length < 2) {
      var fallback = [
        { primary: 'field_vole', secondary: 'mealworm_scoop' },
        { primary: 'small_bird_prey_ration', secondary: 'garden_worms' },
        { primary: 'field_vole', secondary: 'hedgerow_berries' },
        { primary: 'small_bird_prey_ration', secondary: 'sunflower_seeds' }
      ][chestLootHash(stableKey) % 4];
      larder[fallback.primary] = Math.max(2, larder[fallback.primary] || 0);
      larder[fallback.secondary] = Math.max(1, larder[fallback.secondary] || 0);
    }
    out.larder = larder;
    return out;
  }

  // Validate and clone the complete deterministic bundle before any gameplay
  // mutation. Resolvers are injected by the browser's live catalogues.
  function validateChestRewardBundle(raw, ingredientExists, itemExists) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid chest reward bundle');
    var coins = Number(raw.coins), xp = Number(raw.xp || 0);
    if (!isFinite(coins) || coins < 0 || Math.floor(coins) !== coins) throw new Error('Invalid chest coins');
    if (!isFinite(xp) || xp < 0 || Math.floor(xp) !== xp) throw new Error('Invalid chest XP');
    var larder = raw.larder;
    if (!larder || typeof larder !== 'object' || Array.isArray(larder)) throw new Error('Invalid chest larder');
    var cleanLarder = {}, units = 0, ids = Object.keys(larder);
    ids.forEach(function (id) {
      var qty = Number(larder[id]);
      if (!id || !isFinite(qty) || qty <= 0 || Math.floor(qty) !== qty) throw new Error('Invalid chest ingredient quantity: ' + id);
      if (typeof ingredientExists !== 'function' || !ingredientExists(id)) throw new Error('Unknown chest ingredient: ' + id);
      cleanLarder[id] = qty; units += qty;
    });
    if (units < 3 || ids.length < 2 || !((cleanLarder.field_vole || 0) + (cleanLarder.small_bird_prey_ration || 0))) {
      throw new Error('Incomplete chest food bundle');
    }
    var out = { coins: coins, xp: xp, larder: cleanLarder };
    if (raw.item) {
      if (typeof itemExists !== 'function' || !itemExists(raw.item)) throw new Error('Unknown chest item: ' + raw.item);
      out.item = String(raw.item);
    }
    return out;
  }

  // Exact-once local transaction. The caller owns state shape and success UI.
  function runDurableChestClaim(opts) {
    opts = opts || {};
    var claimKey = String(opts.claimKey || '');
    if (!claimKey) return { status: 'failed', error: new Error('Missing chest claim key') };
    var prior = typeof opts.getReceipt === 'function' ? opts.getReceipt(claimKey) : null;
    if (prior) return { status: 'duplicate', receipt: prior };
    var snapshot = typeof opts.snapshot === 'function' ? opts.snapshot() : null;
    try {
      var bundle = opts.validate(opts.bundle);
      opts.apply(bundle);
      var receipt = { bundle: JSON.parse(JSON.stringify(bundle)), committedAt: Number(opts.now || Date.now()) };
      opts.setReceipt(claimKey, receipt);
      var persisted = opts.persist();
      if (persisted === false || (persisted && persisted.ok === false)) {
        throw (persisted && persisted.error) || new Error('Chest claim persistence failed');
      }
      return { status: 'committed', bundle: bundle, receipt: receipt };
    } catch (error) {
      if (typeof opts.restore === 'function') opts.restore(snapshot);
      return { status: 'failed', error: error };
    }
  }

  // Players should end where they started whenever possible. Routes whose ends
  // already meet are natural loops; linear paths become out-and-back walks with
  // the banner back at the start (one-way leg capped so the round trip stays sane).
  var LOOP_ENDS_MEET_M = REAL_LOOP_CLOSE_M;
  var OUT_AND_BACK_ONE_WAY_CAP_M = 2800;

  function offerLoopStyle(points) {
    if (!points || points.length < 2) return 'loop';
    return routeIsStrictLoop(points) ? 'loop' : 'out-and-back';
  }

  function trimRouteToLength(pts, maxLenM) {
    if (routeLengthM(pts) <= maxLenM) return pts;
    var out = [pts[0]], acc = 0;
    for (var i = 1; i < pts.length; i++) {
      var seg = questHaversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
      if (acc + seg >= maxLenM) {
        // OSM nodes on straight tracks can be hundreds of metres apart — cut the
        // final segment at the exact cap instead of overshooting past it.
        var f = seg > 0 ? (maxLenM - acc) / seg : 0;
        out.push({
          lat: pts[i - 1].lat + (pts[i].lat - pts[i - 1].lat) * f,
          lon: pts[i - 1].lon + (pts[i].lon - pts[i - 1].lon) * f
        });
        break;
      }
      acc += seg;
      out.push(pts[i]);
    }
    return out;
  }

  function buildQuestFromOffer(offer, opts) {
    opts = opts || {};
    var rand = opts.rand || Math.random;
    var rawPts = offer.points;
    var loopStyle = offer.kind === 'adventure' ? 'loop' : offerLoopStyle(rawPts);
    if (loopStyle === 'out-and-back') rawPts = trimRouteToLength(rawPts, OUT_AND_BACK_ONE_WAY_CAP_M);
    // Shape-preserving: the stored route must trace the real footpath, corners
    // included, or the drawn line sends the player the wrong way.
    var pts = simplifyRoute(rawPts, 320);
    var oneWayM = routeLengthM(pts);
    var lenM = loopStyle === 'out-and-back' ? oneWayM * 2 : oneWayM; // walking distance incl. return leg
    // Flags roughly every 350m of the polyline they sit on (the one-way leg for
    // out-and-backs), 3..8 of them, chests on 2-3 random flags.
    var nFlags = Math.max(3, Math.min(8, Math.round(oneWayM / 350)));
    var checkpoints = [];
    var npcName = QUEST_GIVER_NAMES[Math.floor(rand() * QUEST_GIVER_NAMES.length)];
    var start = pts[0];
    checkpoints.push({ kind: 'npc', lat: start.lat, lon: start.lon, label: npcName, reached: false });
    var chestSlots = [];
    for (var i = 1; i <= nFlags; i++) {
      var p = pointAtFraction(pts, i / (nFlags + 1));
      checkpoints.push({ kind: 'flag', lat: p.lat, lon: p.lon, label: 'Waymarker ' + i, reached: false });
      chestSlots.push(checkpoints.length - 1);
    }
    var nChests = Math.min(chestSlots.length, lenM > 2500 ? 3 : 2);
    for (var c = 0; c < nChests; c++) {
      var slotI = chestSlots.splice(Math.floor(rand() * chestSlots.length), 1)[0];
      var loot = normaliseChestLoot(CHEST_LOOT[Math.floor(rand() * CHEST_LOOT.length)], 'new:' + c + ':' + slotI);
      checkpoints[slotI] = {
        kind: 'chest', lat: checkpoints[slotI].lat, lon: checkpoints[slotI].lon,
        label: 'Treasure Chest', reached: false, loot: loot
      };
    }
    // Both loop and out-and-back finishes are geographically on-route. Marker
    // overlap is a presentation concern handled with a screen-space offset.
    var end = loopStyle === 'out-and-back' ? pts[0] : pts[pts.length - 1];
    checkpoints.push({ kind: 'finish', lat: end.lat, lon: end.lon, label: 'Quest Banner', reached: false });

    return {
      id: 'q' + Date.now().toString(36) + Math.floor(rand() * 1e6).toString(36),
      type: offer.kind,               // trail | footpath | path | adventure
      name: offer.name,
      ref: offer.ref || null,
      npcName: npcName,
      loopStyle: loopStyle,           // loop | out-and-back
      loopedBack: !!offer.loopedBack, // loop returns home along DIFFERENT paths
      route: pts.map(function (p) { return [ +p.lat.toFixed(6), +p.lon.toFixed(6) ]; }),
      routeAlignmentVersion: 0,
      routeCertification: { status: 'uncertified' },
      lengthM: Math.round(lenM),
      checkpoints: checkpoints,
      startedAt: opts.now || Date.now(),
      distanceWalkedM: 0,
      lastFix: null,
      birdsCaptured: [],
      chestsOpened: 0,
      trailNpcs: [],                  // birds found mid-quest, perched ahead on the route
      trailTavern: null,              // appears once enough trail birds are befriended
      tavernBoon: null                // drink bought at the trail tavern
    };
  }

  // Convert a running out-and-back quest into a loop once a return leg turns
  // up mid-walk. Checkpoints stay put — they all sit on the outward leg and
  // the finish banner is already back at the start — only the drawn route and
  // the round distance change. Returns true when the quest was upgraded.
  function upgradeQuestWithLoop(quest, loop) {
    if (!quest || quest.completedAt) return false;
    if (quest.loopStyle !== 'out-and-back' || quest.loopedBack) return false;
    if (!loop || !loop.loopedBack || !loop.points || loop.points.length < 2) return false;
    var pts = simplifyRoute(loop.points, 320);
    quest.route = pts.map(function (p) { return [ +p.lat.toFixed(6), +p.lon.toFixed(6) ]; });
    quest.loopStyle = 'loop';
    quest.loopedBack = true;
    quest.lengthM = Math.round(loop.totalLenM || routeLengthM(pts));
    return true;
  }

  // ---------------- Trail bird NPCs + the wandering tavern ----------------

  // Find a bird on your quest and it lands ahead of you on the route as an
  // NPC. Befriend enough of them and a tavern appears further along the trail.
  var TRAIL_TAVERN_NPCS_NEEDED = 3;

  function questRoutePoints(quest) {
    return ((quest && quest.route) || []).map(function (p) { return { lat: p[0], lon: p[1] }; });
  }

  // Fraction [0..1] along the quest route nearest to the given position.
  function questNearestRouteFraction(quest, lat, lon) {
    var pts = questRoutePoints(quest);
    if (pts.length < 2 || !isFinite(lat) || !isFinite(lon)) return 0;
    var total = routeLengthM(pts);
    if (total <= 0) return 0;
    var acc = 0, bestFrac = 0, bestD = Infinity;
    for (var i = 0; i < pts.length; i++) {
      if (i > 0) acc += questHaversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
      var d = questHaversine(lat, lon, pts[i].lat, pts[i].lon);
      if (d < bestD) { bestD = d; bestFrac = acc / total; }
    }
    return Math.max(0, Math.min(1, bestFrac));
  }

  // A spot AHEAD of the player on the route — minFrac..maxFrac of the route
  // length beyond wherever they currently are, capped before the finish.
  function questPlaceAhead(quest, lat, lon, minFrac, maxFrac, rand) {
    rand = rand || Math.random;
    var f0 = questNearestRouteFraction(quest, lat, lon);
    var f = Math.min(0.96, f0 + minFrac + (maxFrac - minFrac) * rand());
    var p = pointAtFraction(questRoutePoints(quest), f);
    return p ? { lat: +p.lat.toFixed(6), lon: +p.lon.toFixed(6), frac: f } : null;
  }

  // Register a bird found mid-quest: it appears as an NPC ahead on the route.
  // One NPC per species per quest. Returns the npc, or null if skipped.
  function questAddTrailNpc(quest, bird, lat, lon, rand) {
    if (!quest || quest.completedAt || !bird) return null;
    quest.trailNpcs = Array.isArray(quest.trailNpcs) ? quest.trailNpcs : [];
    var key = normSpeciesName(bird.species || bird.name);
    if (!key) return null;
    if (quest.trailNpcs.some(function (n) { return normSpeciesName(n.species) === key; })) return null;
    var spot = questPlaceAhead(quest, lat, lon, 0.08, 0.28, rand);
    if (!spot) return null;
    var npc = {
      id: 'tnpc_' + quest.trailNpcs.length + '_' + Math.floor((rand || Math.random)() * 1e6).toString(36),
      species: bird.species || bird.name,
      rarity: bird.rarity || 'common',
      lat: spot.lat, lon: spot.lon,
      met: false
    };
    quest.trailNpcs.push(npc);
    return npc;
  }

  function questMetTrailNpcs(quest) {
    return ((quest && quest.trailNpcs) || []).filter(function (n) { return n && n.met; });
  }

  // Once enough trail birds are befriended, the wandering tavern sets up ahead
  // on the route. Returns the tavern when it (newly) appears, else null.
  function questMaybeSpawnTavern(quest, lat, lon, rand) {
    if (!quest || quest.completedAt || quest.trailTavern) return null;
    if (questMetTrailNpcs(quest).length < TRAIL_TAVERN_NPCS_NEEDED) return null;
    var spot = questPlaceAhead(quest, lat, lon, 0.1, 0.22, rand);
    if (!spot) return null;
    quest.trailTavern = { name: 'The Wandering Perch', lat: spot.lat, lon: spot.lon, visited: false, drinkBought: null };
    return quest.trailTavern;
  }

  // ---------------- Progress tracking ----------------

  // GPS/path alignment is approximate on phones: a generous 90 m reach keeps
  // quest chests and waymarkers collectible without requiring exact path pixels.
  var REACH_RADIUS_M = 90;
  var MAX_FIX_JUMP_M = 150;   // GPS glitch guard per fix
  var MAX_DISTANCE_ACCURACY_M = 60;
  var MAX_CHECKPOINT_ACCURACY_M = 120;

  // Feed a geolocation fix into the active quest. Mutates quest; returns events.
  function questProcessFix(quest, lat, lon, accuracy, now) {
    var events = [];
    if (!quest || quest.completedAt) return events;
    now = now || Date.now();
    if (typeof accuracy === 'number' && accuracy > MAX_CHECKPOINT_ACCURACY_M) return events;
    var accurateForDistance = typeof accuracy !== 'number' || accuracy <= MAX_DISTANCE_ACCURACY_M;
    if (quest.lastFix && accurateForDistance && (typeof quest.lastFix.accuracy !== 'number' || quest.lastFix.accuracy <= MAX_DISTANCE_ACCURACY_M)) {
      var d = questHaversine(quest.lastFix.lat, quest.lastFix.lon, lat, lon);
      var dt = Math.max(1, (now - quest.lastFix.t) / 1000);
      if (d <= MAX_FIX_JUMP_M && d / dt < 5.5 && d >= 2) {
        quest.distanceWalkedM += d;
      }
    }
    quest.lastFix = { lat: lat, lon: lon, t: now, accuracy: accuracy };

    quest.checkpoints.forEach(function (cp, idx) {
      if (cp.reached) return;
      if (cp.kind === 'finish') return; // finish checked after the loop, needs the rest done
      if (questHaversine(lat, lon, cp.lat, cp.lon) <= REACH_RADIUS_M) {
        if (cp.kind === 'chest') {
          // Chest reach is only an intent. The UI transaction validates rewards,
          // writes the receipt and reached/count state durably, then shows success.
          events.push({ type: cp.kind, checkpoint: cp, index: idx, reachedAt: now });
          return;
        }
        cp.reached = true;
        cp.reachedAt = now;
        events.push({ type: cp.kind, checkpoint: cp, index: idx });
        quest._finishNudged = false; // fresh progress re-arms the missed-waymarker nudge
      }
    });

    // Trail bird NPCs and the wandering tavern are bonus stops — they never
    // gate the finish banner, so they're checked outside the checkpoint list.
    (Array.isArray(quest.trailNpcs) ? quest.trailNpcs : []).forEach(function (npc) {
      if (!npc || npc.met) return;
      if (questHaversine(lat, lon, npc.lat, npc.lon) <= REACH_RADIUS_M) {
        npc.met = true;
        npc.metAt = now;
        events.push({ type: 'trail-npc', npc: npc });
      }
    });
    var tav = quest.trailTavern;
    if (tav && !tav.visited && questHaversine(lat, lon, tav.lat, tav.lon) <= REACH_RADIUS_M) {
      tav.visited = true;
      tav.visitedAt = now;
      events.push({ type: 'tavern', tavern: tav });
    }

    var fin = quest.checkpoints[quest.checkpoints.length - 1];
    if (fin && fin.kind === 'finish' && !fin.reached &&
        questHaversine(lat, lon, fin.lat, fin.lon) <= REACH_RADIUS_M) {
      var pending = questPendingCheckpoints(quest);
      if (pending === 0) {
        fin.reached = true;
        fin.reachedAt = now;
        events.push({ type: 'finish', checkpoint: fin, index: quest.checkpoints.length - 1 });
      } else if (!quest._finishNudged && quest.distanceWalkedM >= 150) {
        // Loops and out-and-backs start inside the finish radius — stay quiet until
        // the player has actually walked, so the nudge only ever means "you came
        // back but a waymarker is still missing".
        quest._finishNudged = true;
        events.push({ type: 'finish-blocked', pending: pending });
      }
    }
    return events;
  }

  function questPendingCheckpoints(quest) {
    return quest.checkpoints.filter(function (c) { return c.kind !== 'finish' && !c.reached; }).length;
  }

  function questFinishIsReady(quest) {
    return !!quest && questPendingCheckpoints(quest) === 0;
  }

  function questIsComplete(quest) {
    var fin = quest.checkpoints[quest.checkpoints.length - 1];
    return !!(fin && fin.reached);
  }

  // ---------------- Rewards ----------------

  // "Trail birdwatch" bonus: each quest carries the species likely to be seen
  // or heard along its route (quest.likelyBirds, habitat + region accurate).
  // Capturing them during the quest pays escalating bonus XP/coins, with
  // milestone jackpots for spotting several and a Master Birdwatcher prize for
  // the full set.
  var TRAIL_BIRD_BONUS = {
    common: { xp: 35, coins: 12 },
    regular: { xp: 45, coins: 16 },
    uncommon: { xp: 60, coins: 22 },
    scarce: { xp: 90, coins: 35 },
    rare: { xp: 140, coins: 60 }
  };

  function normSpeciesName(s) {
    return String(s || '').split('(')[0].trim().toLowerCase();
  }

  function questTrailBirdBonus(quest) {
    var likely = (quest && quest.likelyBirds) || [];
    var captured = {};
    ((quest && quest.birdsCaptured) || []).forEach(function (b) {
      var s = normSpeciesName(b.species); if (s) captured[s] = true;
      var n = normSpeciesName(b.name); if (n) captured[n] = true;
    });
    // Skip blank/unnamed likely birds so an empty name can never self-match.
    var matched = likely.filter(function (lb) { var k = normSpeciesName(lb.species); return k && captured[k]; });
    var xp = 0, coins = 0;
    matched.forEach(function (lb) {
      var tier = TRAIL_BIRD_BONUS[lb.rarity] || TRAIL_BIRD_BONUS.regular;
      xp += tier.xp; coins += tier.coins;
    });
    if (matched.length >= 2) xp += 50;
    if (matched.length >= 4) { xp += 150; coins += 50; }
    var fullSet = likely.length >= 5 && matched.length === likely.length;
    if (fullSet) { xp += 250; coins += 100; }
    return { matched: matched, xp: xp, coins: coins, fullSet: fullSet, total: likely.length };
  }

  function questXpFor(quest) {
    var flags = quest.checkpoints.filter(function (c) { return c.kind === 'flag' && c.reached; }).length;
    var km = quest.distanceWalkedM / 1000;
    var xp = 40 +
      Math.round(km * 30) +
      flags * 15 +
      quest.chestsOpened * 25 +
      quest.birdsCaptured.length * 20;
    if (quest.type === 'trail') xp += 30; // legendary named trail bonus
    return xp;
  }

  function questSummary(quest, now) {
    now = now || Date.now();
    var tb = questTrailBirdBonus(quest);
    // Tavern drink boons: bought mid-quest at the wandering tavern, paid out here.
    var boon = quest.tavernBoon || null;
    var xpMult = (boon && Number(boon.xpMult)) || 1;
    var tbCoinMult = (boon && Number(boon.tbCoinMult)) || 1;
    return {
      trailBirds: {
        total: tb.total,
        matched: tb.matched.length,
        matchedNames: tb.matched.map(function (m) { return m.species; }),
        xp: tb.xp,
        coins: Math.round(tb.coins * tbCoinMult),
        fullSet: tb.fullSet
      },
      tavern: {
        boon: boon ? (boon.label || boon.id || null) : null,
        npcsMet: questMetTrailNpcs(quest).length,
        visited: !!(quest.trailTavern && quest.trailTavern.visited)
      },
      id: quest.id,
      name: quest.name,
      type: quest.type,
      ref: quest.ref || null,
      routeStart: quest.route && quest.route[0] ? quest.route[0].slice() : null,
      npcName: quest.npcName,
      completedAt: now,
      startedAt: quest.startedAt,
      durationMin: Math.max(1, Math.round((now - quest.startedAt) / 60000)),
      distanceKm: +(quest.distanceWalkedM / 1000).toFixed(2),
      routeLengthKm: +(quest.lengthM / 1000).toFixed(2),
      birds: quest.birdsCaptured.slice(),
      chestsOpened: quest.chestsOpened,
      checkpointsHit: quest.checkpoints.filter(function (c) { return c.reached; }).length,
      checkpointsTotal: quest.checkpoints.length,
      // Headline XP includes the trail-bird bonus, then the tavern drink multiplier.
      xp: Math.round((questXpFor(quest) + tb.xp) * xpMult)
    };
  }

  // ---------------- Discovery entry point ----------------

  function fetchTrailOffers(lat, lon, opts) {
    opts = opts || {};
    var radius = opts.radiusM || 3000;
    var q = buildOverpassQuery(lat, lon, radius);
    var endpoints = opts.endpoints || OVERPASS_ENDPOINTS;
    var fetchFn = opts.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(window) : null);
    if (!fetchFn) return Promise.resolve([]);
    function tryEndpoint(i) {
      if (i >= endpoints.length) return Promise.resolve([]);
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = ctrl ? setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 16000) : null;
      return fetchFn(endpoints[i], {
        method: 'POST',
        body: 'data=' + encodeURIComponent(q),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (r) {
        if (timer) clearTimeout(timer);
        if (!r.ok) throw new Error('overpass ' + r.status);
        return r.json();
      }).then(function (json) {
        return parseOverpassTrails(json, lat, lon);
      }).catch(function (err) {
        if (timer) clearTimeout(timer);
        console.warn('BURBZ quest overpass endpoint failed:', endpoints[i], err && err.message);
        return tryEndpoint(i + 1);
      });
    }
    return tryEndpoint(0);
  }

  window.BurbzQuestCore = {
    questHaversine: questHaversine,
    destPoint: destPoint,
    routeLengthM: routeLengthM,
    sortOffersByStartDistance: sortOffersByStartDistance,
    questChainTargetIndices: questChainTargetIndices,
    pointAtFraction: pointAtFraction,
    decimateRoute: decimateRoute,
    simplifyRoute: simplifyRoute,
    densifyRoute: densifyRoute,
    snapRouteToWays: snapRouteToWays,
    snapPointToWays: snapPointToWays,
    routeCoverageFraction: routeCoverageFraction,
    routesEquivalent: routesEquivalent,
    dedupeQuestOffers: dedupeQuestOffers,
    offerQualityScore: offerQualityScore,
    compileWalkableWays: compileWalkableWays,
    certifyRouteAgainstWays: certifyRouteAgainstWays,
    repairQuestRouteAgainstWays: repairQuestRouteAgainstWays,
    isEligibleMapTransportationFeature: isEligibleMapTransportationFeature,
    isEligibleQuestDiscoveryFeature: isEligibleQuestDiscoveryFeature,
    eligibleMapTransportationWays: eligibleMapTransportationWays,
    ROUTE_ALIGNMENT_VERSION: ROUTE_ALIGNMENT_VERSION,
    rechartRouteOnWays: rechartRouteOnWays,
    buildOverpassQuery: buildOverpassQuery,
    parseOverpassTrails: parseOverpassTrails,
    parseMapWalkableFeatures: parseMapWalkableFeatures,
    chainWays: chainWays,
    buildPathNetwork: buildPathNetwork,
    insertNetworkStart: insertNetworkStart,
    networkShortestPath: networkShortestPath,
    ringAreaM2: ringAreaM2,
    findFootpathRing: findFootpathRing,
    findFootpathLoopFrom: findFootpathLoopFrom,
    ensureFootpathQuestNearPlayer: ensureFootpathQuestNearPlayer,
    normaliseTrailForPlayer: normaliseTrailForPlayer,
    nearestPointOnRoute: nearestPointOnRoute,
    generateAdventureRoute: generateAdventureRoute,
    fetchAdventureRoute: fetchAdventureRoute,
    brouterRoute: brouterRoute,
    fetchLoopBackRoute: fetchLoopBackRoute,
    routeOverlapFraction: routeOverlapFraction,
    questNearestRouteFraction: questNearestRouteFraction,
    questAddTrailNpc: questAddTrailNpc,
    questMetTrailNpcs: questMetTrailNpcs,
    questMaybeSpawnTavern: questMaybeSpawnTavern,
    TRAIL_TAVERN_NPCS_NEEDED: TRAIL_TAVERN_NPCS_NEEDED,
    CHEST_LOOT: CHEST_LOOT.map(function (loot) { return normaliseChestLoot(loot, 'export'); }),
    normaliseChestLoot: normaliseChestLoot,
    validateChestRewardBundle: validateChestRewardBundle,
    runDurableChestClaim: runDurableChestClaim,
    buildQuestFromOffer: buildQuestFromOffer,
    upgradeQuestWithLoop: upgradeQuestWithLoop,
    offerLoopStyle: offerLoopStyle,
    trimRouteToLength: trimRouteToLength,
    questProcessFix: questProcessFix,
    questPendingCheckpoints: questPendingCheckpoints,
    questFinishIsReady: questFinishIsReady,
    questIsComplete: questIsComplete,
    questXpFor: questXpFor,
    questTrailBirdBonus: questTrailBirdBonus,
    questSummary: questSummary,
    fetchTrailOffers: fetchTrailOffers,
    REACH_RADIUS_M: REACH_RADIUS_M
  };
})();
