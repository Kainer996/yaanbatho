/* Burbz Quest Core — real-world walking quests.
 * Pure logic module: trail discovery (OpenStreetMap Overpass), route parsing,
 * fallback route generation, checkpoint/chest placement, progress tracking, XP.
 * No DOM access here; index.html wires UI + map rendering.
 * Trail data © OpenStreetMap contributors (ODbL).
 */
(function () {
  'use strict';

  var EARTH_R = 6371000;

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

  // Nearby quest choice is first and foremost about how far the player must
  // travel before the walk begins. Preserve kind only as a stable tie-breaker.
  function sortOffersByStartDistance(offers) {
    var rank = { trail: 0, footpath: 1, path: 2, adventure: 3 };
    return (offers || []).slice().sort(function (a, b) {
      var ra = a && a.startDistM, rb = b && b.startDistM;
      var da = (ra == null || ra === '') ? Infinity : Number(ra);
      var db = (rb == null || rb === '') ? Infinity : Number(rb);
      if (!isFinite(da)) da = Infinity;
      if (!isFinite(db)) db = Infinity;
      if (da !== db) return da - db;
      return (rank[a && a.kind] == null ? 9 : rank[a.kind]) - (rank[b && b.kind] == null ? 9 : rank[b.kind]);
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

  // Keep payload small: decimate a polyline to at most maxPts evenly spaced points.
  function decimateRoute(pts, maxPts) {
    maxPts = maxPts || 160;
    if (pts.length <= maxPts) return pts.slice();
    var out = [];
    for (var i = 0; i < maxPts; i++) out.push(pointAtFraction(pts, i / (maxPts - 1)));
    return out;
  }

  // ---------------- Overpass (OpenStreetMap) trail discovery ----------------

  // kumi.systems mirror was unreliable in testing (90s timeouts); the VK mirror
  // answered in <0.5s with CORS *. Both honour OSM ODbL attribution requirements.
  var OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
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
    var unnamedPublicWays = [];
    els.forEach(function (el) {
      if (el.type === 'relation' && el.tags) {
        // Geometry arrives clipped to the query bbox, so member ways can be
        // fragments in arbitrary order — chain them end-to-end first.
        var memberSegs = [];
        (el.members || []).forEach(function (m) {
          if (m.type === 'way' && m.geometry) {
            var seg = wayToPoints(m); // strips nulls left by bbox clipping
            if (seg.length >= 2) memberSegs.push(seg);
          }
        });
        var pts = chainWays(memberSegs);
        if (pts.length >= 2) {
          offers.push({
            kind: 'trail',
            ref: 'rel/' + el.id,
            name: (el.tags.name || el.tags.ref || 'Ancient Trail'),
            points: pts,
            tags: el.tags
          });
        }
      } else if (el.type === 'way' && el.tags && el.geometry && el.geometry.length >= 2) {
        var isPublic = /public_footpath|public_bridleway|restricted_byway|byway_open_to_all_traffic/i.test(el.tags.designation || '');
        var nm = el.tags.name;
        if (nm) {
          var key = nm.toLowerCase();
          if (!wayGroups[key]) wayGroups[key] = { name: nm, ways: [], isPublic: isPublic };
          wayGroups[key].ways.push(el);
          if (isPublic) wayGroups[key].isPublic = true;
        } else if (isPublic) {
          unnamedPublicWays.push(el);
        }
      }
    });

    Object.keys(wayGroups).forEach(function (k) {
      var g = wayGroups[k];
      var pts = chainWays(g.ways.map(wayToPoints));
      if (pts.length < 2) return;
      offers.push({
        kind: g.isPublic ? 'footpath' : 'path',
        ref: 'way/' + g.ways.map(function (w) { return w.id; }).join('+'),
        name: g.name,
        points: pts,
        tags: g.ways[0].tags || {}
      });
    });

    // Unnamed public footpaths: every connected cluster is its own quest.
    var ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X'];
    clusterChains(unnamedPublicWays.map(wayToPoints)).slice(0, 10).forEach(function (pts, i) {
      if (pts.length < 2) return;
      offers.push({
        kind: 'footpath',
        ref: 'footpath-cluster/' + i,
        name: 'Public Footpath ' + (ROMAN[i] || (i + 1)),
        points: pts,
        tags: {}
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

    return sortOffersByStartDistance(offers).slice(0, 12);
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
        var bestI = -1, bestMode = null, bestD = 61; // join ends within 60m
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
    var naturalLoop = closesM <= 180 && routeLengthM(pts) <= maxLenM * 1.5;
    var ring = pts.slice();
    if (naturalLoop && closesM <= 5) ring.pop(); // discard duplicate closing node before rotating
    var bestI = 0, bestD = Infinity;
    for (var i = 0; i < ring.length; i++) {
      var d = questHaversine(playerLat, playerLon, ring[i].lat, ring[i].lon);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    if (naturalLoop) {
      var rotated = ring.slice(bestI).concat(ring.slice(0, bestI));
      rotated.push({ lat: rotated[0].lat, lon: rotated[0].lon });
      return rotated;
    }
    // Walk outward from the nearest point in the longer direction until maxLen.
    var fwd = ring.slice(bestI), back = ring.slice(0, bestI + 1).reverse();
    var pick = routeLengthM(fwd) >= routeLengthM(back) ? fwd : back;
    var out = [pick[0]], acc = 0;
    for (var j = 1; j < pick.length; j++) {
      acc += questHaversine(pick[j - 1].lat, pick[j - 1].lon, pick[j].lat, pick[j].lon);
      out.push(pick[j]);
      if (acc >= maxLenM) break;
    }
    return out;
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
    var deadline = Date.now() + (opts.maxTotalMs || 20000);
    var best = null;
    function finish(cand) {
      if (!cand) return null;
      var combined = outward.concat(cand.pts.slice(1));
      return { points: combined, loopedBack: true, returnLenM: Math.round(cand.len), totalLenM: Math.round(outwardLen + cand.len) };
    }
    function tryVia(i) {
      if (i >= vias.length || Date.now() > deadline) return Promise.resolve(finish(best));
      return brouterRoute([end].concat(vias[i]).concat([start]), opts).then(function (legPts) {
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
    { coins: 25, label: 'a pouch of 25 coins' },
    { coins: 40, label: 'a chest of 40 coins' },
    { coins: 30, xp: 15, label: '30 coins and a glowing feather (+15 XP)' },
    { coins: 20, xp: 25, label: '20 coins and an old map scrap (+25 XP)' }
  ];

  // Players should end where they started whenever possible. Routes whose ends
  // already meet are natural loops; linear paths become out-and-back walks with
  // the banner back at the start (one-way leg capped so the round trip stays sane).
  var LOOP_ENDS_MEET_M = 180;
  var OUT_AND_BACK_ONE_WAY_CAP_M = 2800;

  function offerLoopStyle(points) {
    if (!points || points.length < 2) return 'loop';
    var a = points[0], b = points[points.length - 1];
    return questHaversine(a.lat, a.lon, b.lat, b.lon) <= LOOP_ENDS_MEET_M ? 'loop' : 'out-and-back';
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

  // Offer kinds whose route is already the full walk: charted adventures,
  // side-quest scroll rings, and retraced free wanders. They never get the
  // out-and-back doubling and never need a routed loop home.
  var SELF_CONTAINED_KINDS = { adventure: 1, side: 1, retrace: 1 };

  function offerIsSelfContained(offer) {
    return !!(offer && SELF_CONTAINED_KINDS[offer.kind]);
  }

  function buildQuestFromOffer(offer, opts) {
    opts = opts || {};
    var rand = opts.rand || Math.random;
    var rawPts = offer.points;
    var loopStyle = offerIsSelfContained(offer) ? 'loop' : offerLoopStyle(rawPts);
    if (loopStyle === 'out-and-back') rawPts = trimRouteToLength(rawPts, OUT_AND_BACK_ONE_WAY_CAP_M);
    var pts = decimateRoute(rawPts, 160);
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
      var loot = CHEST_LOOT[Math.floor(rand() * CHEST_LOOT.length)];
      checkpoints[slotI] = {
        kind: 'chest', lat: checkpoints[slotI].lat, lon: checkpoints[slotI].lon,
        label: 'Treasure Chest', reached: false, loot: loot
      };
    }
    // Loops and out-and-back walks both finish back at the start; nudge the
    // banner ~15m aside so it doesn't sit exactly on top of the quest giver.
    var end = loopStyle === 'out-and-back' ? destPoint(pts[0].lat, pts[0].lon, 90, 15) : pts[pts.length - 1];
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
    var pts = decimateRoute(loop.points, 160);
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

  var REACH_RADIUS_M = 45;
  var MAX_FIX_JUMP_M = 150;   // GPS glitch guard per fix
  var MAX_FIX_ACCURACY_M = 60;

  // Feed a geolocation fix into the active quest. Mutates quest; returns events.
  function questProcessFix(quest, lat, lon, accuracy, now) {
    var events = [];
    if (!quest || quest.completedAt) return events;
    now = now || Date.now();
    if (typeof accuracy === 'number' && accuracy > MAX_FIX_ACCURACY_M) return events;
    if (quest.lastFix) {
      var d = questHaversine(quest.lastFix.lat, quest.lastFix.lon, lat, lon);
      var dt = Math.max(1, (now - quest.lastFix.t) / 1000);
      if (d <= MAX_FIX_JUMP_M && d / dt < 5.5 && d >= 2) {
        quest.distanceWalkedM += d;
      }
    }
    quest.lastFix = { lat: lat, lon: lon, t: now };

    quest.checkpoints.forEach(function (cp, idx) {
      if (cp.reached) return;
      if (cp.kind === 'finish') return; // finish checked after the loop, needs the rest done
      if (questHaversine(lat, lon, cp.lat, cp.lon) <= REACH_RADIUS_M) {
        cp.reached = true;
        cp.reachedAt = now;
        if (cp.kind === 'chest') quest.chestsOpened++;
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
    buildOverpassQuery: buildOverpassQuery,
    parseOverpassTrails: parseOverpassTrails,
    chainWays: chainWays,
    normaliseTrailForPlayer: normaliseTrailForPlayer,
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
    buildQuestFromOffer: buildQuestFromOffer,
    offerIsSelfContained: offerIsSelfContained,
    upgradeQuestWithLoop: upgradeQuestWithLoop,
    offerLoopStyle: offerLoopStyle,
    trimRouteToLength: trimRouteToLength,
    questProcessFix: questProcessFix,
    questPendingCheckpoints: questPendingCheckpoints,
    questIsComplete: questIsComplete,
    questXpFor: questXpFor,
    questTrailBirdBonus: questTrailBirdBonus,
    questSummary: questSummary,
    fetchTrailOffers: fetchTrailOffers,
    REACH_RADIUS_M: REACH_RADIUS_M
  };
})();
