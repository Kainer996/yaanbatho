/* Burbz Side Quest Core — free-roam discovery.
 * Pure logic module for wandering WITHOUT an active quest:
 *  - side-quest scrolls found on the map become small self-contained quests
 *  - the free walk is recorded as a breadcrumb trail
 *  - "wherever they've walked" can be turned into a proper replayable quest
 * Offers produced here feed BurbzQuestCore.buildQuestFromOffer.
 * No DOM access here; index.html wires UI + map rendering.
 */
(function () {
  'use strict';

  var EARTH_R = 6371000;

  function toRad(d) { return d * Math.PI / 180; }

  function roamHaversine(lat1, lon1, lat2, lon2) {
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

  function pathLengthM(pts) {
    var t = 0;
    for (var i = 1; i < pts.length; i++) t += roamHaversine(pts[i - 1].lat, pts[i - 1].lon, pts[i].lat, pts[i].lon);
    return t;
  }

  // ---------------- Tuning ----------------

  var MAX_FIX_JUMP_M = 150;         // GPS glitch guard per fix (mirrors quest core)
  var MAX_FIX_ACCURACY_M = 60;
  var PATH_POINT_GAP_M = 18;        // record the walk sparsely
  var PATH_MAX_POINTS = 500;
  var WALK_QUEST_MIN_M = 350;       // same playability floor as trail offers
  var ROAM_SESSION_GAP_MS = 45 * 60 * 1000; // a long pause starts a fresh wander

  // ---------------- Side quest scrolls ----------------

  var SIDE_QUEST_GIVERS = ['Scout Wrenlock', 'Peddler Puffinch', 'Old Corvid Marlow', 'Fletcher Nightjar', 'Robin the Redcap'];

  // Side quests are short, self-contained wanders discovered as scrolls in the
  // world. Each template becomes an offer for BurbzQuestCore.buildQuestFromOffer
  // (checkpoints, chests, XP) — a found scroll turns into a real quest the
  // moment the player takes it up.
  var SIDE_QUEST_TEMPLATES = [
    {
      id: 'lost-fledgling',
      name: 'The Lost Fledgling',
      brief: 'A fledgling strayed from its roost before the shadow lifted here. Walk the round and guide it home.',
      lenM: 700
    },
    {
      id: 'feather-cache',
      name: 'The Feather Cache',
      brief: 'A travelling peddler buried spare wares along this circuit. Walk it and dig them up before the magpies do.',
      lenM: 900
    },
    {
      id: 'shadow-scraps',
      name: 'Scraps of the Shadow',
      brief: 'Traces of the usurper’s veil still cling to these paths. Sweep the loop to clear them for the free birds.',
      lenM: 1200
    },
    {
      id: 'wayfarers-round',
      name: 'The Wayfarer’s Round',
      brief: 'An old wayfarer swears this is the finest round in the shire and dares you to walk it before sundown.',
      lenM: 1600
    }
  ];

  // Deterministic scroll contents from a numeric seed, so the same map spot
  // holds the same side quest all day (matches the map-pickup seeding).
  function sideQuestForSeed(seed) {
    seed = Math.abs(Math.floor(Number(seed) || 0));
    var tpl = SIDE_QUEST_TEMPLATES[seed % SIDE_QUEST_TEMPLATES.length];
    return {
      template: tpl.id,
      name: tpl.name,
      brief: tpl.brief,
      lenM: tpl.lenM,
      giver: SIDE_QUEST_GIVERS[(seed >> 3) % SIDE_QUEST_GIVERS.length]
    };
  }

  // A taken-up scroll becomes a small loop offer starting at the scroll itself.
  // The waypoint ring is a target shape — the walker picks real paths between
  // waypoints, exactly like a charted adventure's fallback route.
  function sideQuestOffer(scroll, rand) {
    if (!scroll || !isFinite(scroll.lat) || !isFinite(scroll.lon)) return null;
    rand = rand || Math.random;
    var lenM = scroll.lenM || 900;
    var radius = Math.max(120, lenM / (2 * Math.PI));
    var startBearing = Math.floor(rand() * 360);
    var centre = destPoint(scroll.lat, scroll.lon, startBearing, radius);
    var n = 10;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var ang = startBearing + 180 + (360 * i / n); // scroll sits on the circle
      var jitter = 1 + (rand() - 0.5) * 0.3;
      pts.push(destPoint(centre.lat, centre.lon, ang % 360, radius * jitter));
    }
    pts[0] = { lat: scroll.lat, lon: scroll.lon };
    pts[pts.length - 1] = { lat: scroll.lat, lon: scroll.lon }; // loop home
    return {
      kind: 'side',
      ref: 'side/' + (scroll.template || 'scroll') + '/' + (scroll.key || scroll.id || '0'),
      name: scroll.name || 'Side Quest',
      brief: scroll.brief || '',
      giver: scroll.giver || SIDE_QUEST_GIVERS[0],
      points: pts,
      lengthM: Math.round(pathLengthM(pts)),
      startDistM: 0
    };
  }

  // ---------------- Free-walk recording ----------------

  function createRoamState(now) {
    return {
      startedAt: now || 0,
      lastFix: null,
      distanceM: 0,
      path: [],          // [[lat, lon]] sparse walked breadcrumb trail
      nudged: false      // "your wander could be a quest" toast fired
    };
  }

  // A malformed save or a long pause both mean: start a fresh wander.
  function roamStateStale(roam, now) {
    if (!roam || typeof roam !== 'object' || !Array.isArray(roam.path)) return true;
    if (roam.lastFix && isFinite(roam.lastFix.t) && (now - roam.lastFix.t) > ROAM_SESSION_GAP_MS) return true;
    return false;
  }

  // Feed a geolocation fix into the roam state while NO quest is active.
  // Mutates roam; returns { movedM, pathChanged, becameQuestReady }.
  function recordRoamFix(roam, lat, lon, accuracy, now) {
    var out = { movedM: 0, pathChanged: false, becameQuestReady: false };
    if (!roam || !isFinite(lat) || !isFinite(lon)) return out;
    now = now || 0;
    if (typeof accuracy === 'number' && accuracy > MAX_FIX_ACCURACY_M) return out;

    if (roam.lastFix) {
      var d = roamHaversine(roam.lastFix.lat, roam.lastFix.lon, lat, lon);
      var dt = Math.max(1, (now - roam.lastFix.t) / 1000);
      if (d <= MAX_FIX_JUMP_M && d / dt < 5.5 && d >= 2) {
        roam.distanceM += d;
        out.movedM = d;
      }
    }
    roam.lastFix = { lat: lat, lon: lon, t: now };

    var wasReady = walkQuestReady(roam);
    var lastPt = roam.path[roam.path.length - 1];
    if (!lastPt || roamHaversine(lastPt[0], lastPt[1], lat, lon) >= PATH_POINT_GAP_M) {
      roam.path.push([+lat.toFixed(6), +lon.toFixed(6)]);
      out.pathChanged = true;
      if (roam.path.length > PATH_MAX_POINTS) {
        // Thin every other early point; the recent trail keeps full detail.
        var keep = [];
        for (var i = 0; i < roam.path.length; i++) {
          if (i % 2 === 0 || i > roam.path.length - 60) keep.push(roam.path[i]);
        }
        roam.path = keep;
      }
    }
    if (!wasReady && walkQuestReady(roam)) out.becameQuestReady = true;
    return out;
  }

  function roamPathPoints(roam) {
    return ((roam && roam.path) || []).map(function (p) { return { lat: p[0], lon: p[1] }; });
  }

  function roamPathLengthM(roam) {
    return pathLengthM(roamPathPoints(roam));
  }

  function walkQuestReady(roam, minLenM) {
    return roamPathLengthM(roam) >= (minLenM || WALK_QUEST_MIN_M);
  }

  // ---------------- Walk → quest ----------------

  // Turn wherever the player has walked into a quest offer. The recorded trail
  // is reversed when the player stands nearer its end, so the new quest starts
  // right under their feet and leads back along their own footsteps.
  function walkedPathToOffer(roam, playerLat, playerLon, opts) {
    opts = opts || {};
    var pts = roamPathPoints(roam);
    if (pts.length < 2) return null;
    var lenM = pathLengthM(pts);
    if (lenM < (opts.minLenM || WALK_QUEST_MIN_M)) return null;
    if (isFinite(playerLat) && isFinite(playerLon)) {
      var dStart = roamHaversine(playerLat, playerLon, pts[0].lat, pts[0].lon);
      var dEnd = roamHaversine(playerLat, playerLon, pts[pts.length - 1].lat, pts[pts.length - 1].lon);
      if (dEnd < dStart) pts = pts.slice().reverse();
    }
    var s = pts[0];
    return {
      kind: 'retrace',
      ref: 'walk/' + (roam.startedAt || 0).toString(36),
      name: opts.name || 'My Wandered Trail',
      points: pts,
      lengthM: Math.round(lenM),
      startDistM: isFinite(playerLat) && isFinite(playerLon) ? roamHaversine(playerLat, playerLon, s.lat, s.lon) : 0
    };
  }

  window.BurbzSideQuestCore = {
    roamHaversine: roamHaversine,
    destPoint: destPoint,
    pathLengthM: pathLengthM,
    createRoamState: createRoamState,
    roamStateStale: roamStateStale,
    recordRoamFix: recordRoamFix,
    roamPathPoints: roamPathPoints,
    roamPathLengthM: roamPathLengthM,
    walkQuestReady: walkQuestReady,
    walkedPathToOffer: walkedPathToOffer,
    sideQuestForSeed: sideQuestForSeed,
    sideQuestOffer: sideQuestOffer,
    SIDE_QUEST_TEMPLATES: SIDE_QUEST_TEMPLATES,
    SIDE_QUEST_GIVERS: SIDE_QUEST_GIVERS,
    WALK_QUEST_MIN_M: WALK_QUEST_MIN_M,
    ROAM_SESSION_GAP_MS: ROAM_SESSION_GAP_MS
  };
})();
