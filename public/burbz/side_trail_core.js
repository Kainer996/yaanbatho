// Burbz Side Trail Core — off-road side quests.
// Walk 300 m away from your main quest's golden route and a side quest opens
// by itself. The main quest keeps every marker and simply waits. Off the road
// the wander is charted like any Side Quest — random chests, weapons, quest
// givers, and wayside tales: small lore finds that never appear on the roads.
// Walk back within 150 m of the route and the side quest banks itself.
// Pure logic module: no DOM, deterministic, UMD export for Node tests.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzSideTrailCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const EARTH_R = 6371000;
  const SIDE_TRAIL_TRIGGER_M = 300;   // this far off the route starts a side quest
  const SIDE_TRAIL_RETURN_M = 150;    // back within this banks it (hysteresis)
  const SIDE_TRAIL_MAX_ACCURACY_M = 80; // same GPS bar as Side Quest charting
  const SIDE_TRAIL_START_STRIKES = 2; // consecutive off-route fixes before starting

  function toRad(d) { return d * Math.PI / 180; }

  function haversineM(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function routePoints(route) {
    return (Array.isArray(route) ? route : []).map(p => {
      if (Array.isArray(p)) return { lat: Number(p[0]), lon: Number(p[1]) };
      return { lat: Number(p && p.lat), lon: Number(p && p.lon) };
    }).filter(p => isFinite(p.lat) && isFinite(p.lon));
  }

  // Shortest distance in metres from a point to the route polyline. The quest
  // route arrives exactly as quest_core persists it: [[lat, lon], ...].
  function distanceFromRouteM(route, lat, lon) {
    const pts = routePoints(route);
    if (!pts.length || !isFinite(lat) || !isFinite(lon)) return Infinity;
    if (pts.length === 1) return haversineM(lat, lon, pts[0].lat, pts[0].lon);
    let best = Infinity;
    const cosLat = Math.max(0.2, Math.cos(toRad(lat)));
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const ax = (a.lon - lon) * cosLat, ay = a.lat - lat;
      const bx = (b.lon - lon) * cosLat, by = b.lat - lat;
      const vx = bx - ax, vy = by - ay;
      const denom = vx * vx + vy * vy;
      const t = denom > 0 ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / denom)) : 0;
      const d = haversineM(lat, lon, a.lat + (b.lat - a.lat) * t, a.lon + (b.lon - a.lon) * t);
      if (d < best) best = d;
    }
    return best;
  }

  // One decision per GPS fix. Two consecutive far fixes are needed to start,
  // so a single GPS jump never opens a side quest; one near fix is enough to
  // bank an auto side quest, because coming home should feel instant.
  // state: { strikes } — carried between fixes by the caller.
  // input: { questActive, sideActive, sideAuto, distM, accuracy }
  // Returns { action: 'start' | 'end' | null, strikes }.
  function sideTrailStep(state, input) {
    const strikes = Math.max(0, Number(state && state.strikes) || 0);
    input = input || {};
    const acc = Number(input.accuracy);
    const distM = Number(input.distM);
    if (!input.questActive || !isFinite(distM) ||
        (isFinite(acc) && acc > SIDE_TRAIL_MAX_ACCURACY_M)) {
      return { action: null, strikes: 0 };
    }
    if (input.sideActive) {
      if (input.sideAuto && distM <= SIDE_TRAIL_RETURN_M) return { action: 'end', strikes: 0 };
      return { action: null, strikes: 0 };
    }
    if (distM >= SIDE_TRAIL_TRIGGER_M) {
      const next = strikes + 1;
      if (next >= SIDE_TRAIL_START_STRIKES) return { action: 'start', strikes: 0 };
      return { action: null, strikes: next };
    }
    return { action: null, strikes: 0 };
  }

  // What the wander stumbles across. Lore joins the classic three: the
  // hedge-rows keep stories the roads never tell.
  function sideTrailDiscoveryKind(roll) {
    const r = isFinite(roll) ? Math.min(0.999999, Math.max(0, Number(roll))) : 0;
    if (r < 0.38) return 'chest';
    if (r < 0.62) return 'weapon';
    if (r < 0.82) return 'questgiver';
    return 'lore';
  }

  // Names for the wanders themselves — random everything, even the title.
  const SIDE_TRAIL_NAME_PARTS = {
    adjectives: ['Crooked', 'Hidden', 'Mossy', 'Whispering', 'Untrodden', 'Sunlit', 'Bramble', 'Forgotten'],
    nouns: ['Byway', 'Detour', 'Hollow', 'Meadow', 'Green Lane', 'Shortcut', 'Wander', 'Crossing']
  };

  function sideTrailQuestName(rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    const adj = SIDE_TRAIL_NAME_PARTS.adjectives[Math.floor(r() * SIDE_TRAIL_NAME_PARTS.adjectives.length) % SIDE_TRAIL_NAME_PARTS.adjectives.length];
    const noun = SIDE_TRAIL_NAME_PARTS.nouns[Math.floor(r() * SIDE_TRAIL_NAME_PARTS.nouns.length) % SIDE_TRAIL_NAME_PARTS.nouns.length];
    return 'The ' + adj + ' ' + noun;
  }

  // The Wayside Tales. Hedge-lore of the free realm: what lives BESIDE the
  // roads. Short, warm, and canon — the usurper, the evil Burbz, Merlin and
  // the Academy all cast their shadows here, but from the ditch's point of
  // view. Collected tales sit in the Feathered Folio next to the road scrolls.
  const WAYSIDE_TALES = [
    {
      id: 'wt01_hedge_witchs_receipt',
      title: 'The Hedge-Witch\'s Receipt',
      text: 'For a walker gone astray: one handful of blackberries, eaten slowly. One long look at where you came from. One shrug. The old hedge-witch swore no bird is ever truly lost — only early to somewhere else. She billed the Academy for that advice. They paid it.'
    },
    {
      id: 'wt02_usurpers_blind_spot',
      title: 'The Usurper\'s Blind Spot',
      text: 'The usurper charts every road in the realm and watches them all. But a walker who leaves the road leaves his map. The wardens call it the blind spot, and they use it. Nothing frightens a tyrant like footsteps he cannot predict.'
    },
    {
      id: 'wt03_field_between_roads',
      title: 'The Field Between the Roads',
      text: 'Two great roads run a valley apart, and between them lies a field no waymarker names. The skylarks nest there. They say the field belongs to nobody, which the birds know is the same as belonging to everybody. The evil Burbz never garrison it. Smoke needs an address.'
    },
    {
      id: 'wt04_scarecrows_watch',
      title: 'The Scarecrow\'s Watch',
      text: 'The village folk build scarecrows, and the birds find this endlessly funny. But in the dark years the crows kept a straight face and hid muster notes in the scarecrows\' sleeves. The usurper\'s soldiers searched every roadside post and never once thought to frisk a coat full of straw.'
    },
    {
      id: 'wt05_song_of_the_ditch_wren',
      title: 'The Song of the Ditch-Wren',
      text: 'The Crowbar\'s regulars sing it after the second cordial: "The road is for the mighty, the verge is for the wise, the ditch is for the wren who watched the empire with her eyes." The wren in question never confirmed the story. She never denied it either.'
    },
    {
      id: 'wt06_gleaners_right',
      title: 'The Gleaner\'s Right',
      text: 'Old law of the free realm: what the harvest drops belongs to whoever walks for it. The Quartermaster calls gleaning the realm\'s second granary. So if you find a chest off the road, open it without guilt. Somebody left it for a walker. That walker is you.'
    },
    {
      id: 'wt07_lost_waymarker',
      title: 'The Waymarker That Wandered',
      text: 'One waymarker in the realm refuses to stay put. Surveyors fix it; by morning it stands a meadow away, pointing somewhere new. Scribe Inkwing wants it catalogued as an error. Sage Oakfeather wants it promoted. Merlin, asked to settle it, said only: "Let it walk. It is doing its job."'
    },
    {
      id: 'wt08_merlins_lost_feather',
      title: 'Merlin\'s Lost Feather',
      text: 'Somewhere off a road nobody marks, Merlin moulted one feather and never fetched it back. The mice built a chapel round it. The feather does nothing at all, the mice insist, except glow faintly when a free walker passes. Which, they add, is plenty.'
    },
    {
      id: 'wt09_shortcut_that_wasnt',
      title: 'The Shortcut That Wasn\'t',
      text: 'A young rook once found a shortcut that saved no time at all — it wound through an orchard, past a pond, under the best climbing oak in the county. She mapped it anyway and labelled it honestly: "Longer. Better." The Academy Library keeps that map under glass.'
    },
    {
      id: 'wt10_toll_of_the_green_lane',
      title: 'The Toll of the Green Lane',
      text: 'The green lanes charge no coins. Their toll is attention: notice the hedge, the thrush in it, the light on the wet grass, and you have paid in full. The evil Burbz cannot walk them — a thing made of borrowed shadow has nothing to pay attention with.'
    },
    {
      id: 'wt11_cartography_of_getting_lost',
      title: 'On the Cartography of Getting Lost',
      text: 'From a margin note in the Academy Library: every blank on a map was filled by somebody who did not know where they were. Lost is not the opposite of found. Lost is how found begins. — filed, without irony, in the wrong drawer.'
    },
    {
      id: 'wt12_what_the_hedgerow_keeps',
      title: 'What the Hedgerow Keeps',
      text: 'A hedgerow is a realm one wing tall. It keeps wrens, whitethroats, a kingdom of beetles, last year\'s nests and next year\'s plans. When the usurper burned the signposts, the hedgerows remembered every path — a hedge grows along a road the way a story grows along a life.'
    }
  ];

  const TALES_BY_ID = {};
  WAYSIDE_TALES.forEach(t => { TALES_BY_ID[t.id] = t; });

  function waysideTaleById(id) { return TALES_BY_ID[id] || null; }

  // Random pick among the tales the walker has not read yet; once the pool is
  // read dry, any tale may turn up again. Deterministic given rand.
  function nextWaysideTale(seenIds, rand) {
    const r = typeof rand === 'function' ? rand : Math.random;
    const seen = {};
    (Array.isArray(seenIds) ? seenIds : []).forEach(id => { if (TALES_BY_ID[id]) seen[id] = true; });
    const fresh = WAYSIDE_TALES.filter(t => !seen[t.id]);
    const pool = fresh.length ? fresh : WAYSIDE_TALES;
    return pool[Math.floor(r() * pool.length) % pool.length];
  }

  // Every tale must be whole and unique. Throws on the first bad entry;
  // returns totals so tests can assert the pool's shape.
  function validateWaysideTales() {
    const ids = {};
    WAYSIDE_TALES.forEach(t => {
      if (!String(t.id || '').trim()) throw new Error('Tale without id');
      if (ids[t.id]) throw new Error('Duplicate tale id: ' + t.id);
      ids[t.id] = true;
      if (!String(t.title || '').trim()) throw new Error('Missing title on ' + t.id);
      if (String(t.text || '').trim().length < 80) throw new Error('Tale too thin: ' + t.id);
    });
    return { tales: WAYSIDE_TALES.length };
  }

  return {
    SIDE_TRAIL_TRIGGER_M: SIDE_TRAIL_TRIGGER_M,
    SIDE_TRAIL_RETURN_M: SIDE_TRAIL_RETURN_M,
    SIDE_TRAIL_MAX_ACCURACY_M: SIDE_TRAIL_MAX_ACCURACY_M,
    SIDE_TRAIL_START_STRIKES: SIDE_TRAIL_START_STRIKES,
    WAYSIDE_TALES: WAYSIDE_TALES,
    SIDE_TRAIL_NAME_PARTS: SIDE_TRAIL_NAME_PARTS,
    distanceFromRouteM: distanceFromRouteM,
    sideTrailStep: sideTrailStep,
    sideTrailDiscoveryKind: sideTrailDiscoveryKind,
    sideTrailQuestName: sideTrailQuestName,
    waysideTaleById: waysideTaleById,
    nextWaysideTale: nextWaysideTale,
    validateWaysideTales: validateWaysideTales
  };
});
