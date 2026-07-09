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

    offers.sort(function (a, b) {
      var rank = { trail: 0, footpath: 1, path: 2 };
      if (rank[a.kind] !== rank[b.kind]) return rank[a.kind] - rank[b.kind];
      return a.startDistM - b.startDistM;
    });
    return offers.slice(0, 12);
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

  // Long trails can span hundreds of km — clip a walkable slice (max ~6km)
  // starting from the trail point nearest the player, and make the route begin there.
  function normaliseTrailForPlayer(pts, playerLat, playerLon, maxLenM) {
    maxLenM = maxLenM || 6000;
    if (pts.length < 2) return pts;
    var bestI = 0, bestD = Infinity;
    for (var i = 0; i < pts.length; i++) {
      var d = questHaversine(playerLat, playerLon, pts[i].lat, pts[i].lon);
      if (d < bestD) { bestD = d; bestI = i; }
    }
    // Walk outward from the nearest point in the longer direction until maxLen.
    var fwd = pts.slice(bestI), back = pts.slice(0, bestI + 1).reverse();
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

  // Snap a generated loop onto real walkable paths via the free BRouter public
  // instance (no key, CORS *, hiking profile). Falls back to the raw waypoint
  // loop if the router is unreachable — the quest still works as GPS targets.
  function fetchAdventureRoute(lat, lon, targetLenM, opts) {
    opts = opts || {};
    var raw = generateAdventureRoute(lat, lon, targetLenM, opts.rand);
    var fetchFn = opts.fetchFn || (typeof fetch !== 'undefined' ? fetch.bind(window) : null);
    if (!fetchFn) return Promise.resolve(raw);
    // 4 corner waypoints + home keeps the URL small and the loop shape intact.
    var wp = [raw[0], raw[Math.floor(raw.length * 0.25)], raw[Math.floor(raw.length * 0.5)], raw[Math.floor(raw.length * 0.75)], raw[raw.length - 1]];
    var lonlats = wp.map(function (p) { return p.lon.toFixed(6) + ',' + p.lat.toFixed(6); }).join('|');
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
      if (!coords || coords.length < 2) throw new Error('brouter empty route');
      var pts = coords.map(function (c) { return { lat: c[1], lon: c[0] }; });
      // Sanity: keep the snapped route only if it stayed roughly loop-sized.
      var len = routeLengthM(pts);
      if (len < targetLenM * 0.4 || len > targetLenM * 3.2) return raw;
      return pts;
    }).catch(function (err) {
      if (timer) clearTimeout(timer);
      console.warn('BURBZ quest brouter fallback to raw loop:', err && err.message);
      return raw;
    });
  }

  // ---------------- Quest assembly ----------------

  var QUEST_GIVER_NAMES = ['Elder Bramblewing', 'Sage Oakfeather', 'Warden Thistledown', 'Keeper Mossbeak'];
  var CHEST_LOOT = [
    { coins: 25, label: 'a pouch of 25 coins' },
    { coins: 40, label: 'a chest of 40 coins' },
    { coins: 30, xp: 15, label: '30 coins and a glowing feather (+15 XP)' },
    { coins: 20, xp: 25, label: '20 coins and an old map scrap (+25 XP)' }
  ];

  function buildQuestFromOffer(offer, opts) {
    opts = opts || {};
    var rand = opts.rand || Math.random;
    var pts = decimateRoute(offer.points, 160);
    var lenM = routeLengthM(pts);
    // Flags roughly every 350m, 3..8 of them, chests on 2-3 random flags.
    var nFlags = Math.max(3, Math.min(8, Math.round(lenM / 350)));
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
    var end = pts[pts.length - 1];
    checkpoints.push({ kind: 'finish', lat: end.lat, lon: end.lon, label: 'Quest Banner', reached: false });

    return {
      id: 'q' + Date.now().toString(36) + Math.floor(rand() * 1e6).toString(36),
      type: offer.kind,               // trail | footpath | path | adventure
      name: offer.name,
      ref: offer.ref || null,
      npcName: npcName,
      route: pts.map(function (p) { return [ +p.lat.toFixed(6), +p.lon.toFixed(6) ]; }),
      lengthM: Math.round(lenM),
      checkpoints: checkpoints,
      startedAt: opts.now || Date.now(),
      distanceWalkedM: 0,
      lastFix: null,
      birdsCaptured: [],
      chestsOpened: 0
    };
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
      }
    });

    var fin = quest.checkpoints[quest.checkpoints.length - 1];
    if (fin && fin.kind === 'finish' && !fin.reached &&
        questHaversine(lat, lon, fin.lat, fin.lon) <= REACH_RADIUS_M) {
      var pending = questPendingCheckpoints(quest);
      if (pending === 0) {
        fin.reached = true;
        fin.reachedAt = now;
        events.push({ type: 'finish', checkpoint: fin, index: quest.checkpoints.length - 1 });
      } else if (!quest._finishNudged) {
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
    return {
      id: quest.id,
      name: quest.name,
      type: quest.type,
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
      xp: questXpFor(quest)
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
    pointAtFraction: pointAtFraction,
    decimateRoute: decimateRoute,
    buildOverpassQuery: buildOverpassQuery,
    parseOverpassTrails: parseOverpassTrails,
    chainWays: chainWays,
    normaliseTrailForPlayer: normaliseTrailForPlayer,
    generateAdventureRoute: generateAdventureRoute,
    fetchAdventureRoute: fetchAdventureRoute,
    buildQuestFromOffer: buildQuestFromOffer,
    questProcessFix: questProcessFix,
    questPendingCheckpoints: questPendingCheckpoints,
    questIsComplete: questIsComplete,
    questXpFor: questXpFor,
    questSummary: questSummary,
    fetchTrailOffers: fetchTrailOffers,
    REACH_RADIUS_M: REACH_RADIUS_M
  };
})();
