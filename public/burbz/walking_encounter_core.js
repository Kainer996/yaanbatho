// Alderwing encounters ride the walking quest's existing ordered checkpoints.
// They are fictional story stops, never real-world POIs or extra destinations.
// This module awards nothing and has no DOM, network, GPS or economy side effects.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzWalkingEncounterCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const VERSION = 1;
  const FICTION_LABEL = 'Fictional Alderwing encounter';
  const ROUTE_TOLERANCE_M = 20;
  const CATALOGUE = [
    {
      id: 'warden', name: 'Warden Thistledown', kind: 'npc', role: 'Bird cartographer',
      artKey: 'warden',
      lore: 'Across the veil, Thistledown steadies a rolled chart beneath one feathered wing. The little bird has mapped Alderwing for years, yet still leaves room in the margins for what a walker might discover.',
      prompt: 'What will you add to the Warden’s field notes?',
      choices: [
        { id: 'curiosity', label: 'A question about the old maps', outcome: 'Thistledown pencils a tiny question mark into the margin. “A good map should leave you curious,” the bird says. Your question becomes part of the Warden’s travelling notes.' },
        { id: 'kindness', label: 'A motto for fellow travellers', outcome: '“Leave the next walker a little hope.” Thistledown copies your motto beneath a small drawing of Merlin, then folds the chart with great care.' }
      ]
    },
    {
      id: 'lantern-post', name: 'Lantern Post', kind: 'building', role: 'Alderwing waylight',
      artKey: 'lantern-post',
      lore: 'In Alderwing, a brass lantern hangs from a weathered timber post. Beneath its amber light, the little humanoid Peeps tuck folded messages into a dry wooden box. A hopeful word can travel farther than its writer.',
      prompt: 'Which message belongs in the story’s lantern box?',
      choices: [
        { id: 'courage', label: '“Small steps still carry us.”', outcome: 'Your message joins a neat bundle tied with grass. In Alderwing, a nervous Peep reads it twice, straightens their little hood, and smiles.' },
        { id: 'welcome', label: '“There is room beside our light.”', outcome: 'The lantern keeper pins your welcome inside the box. In Alderwing, two travelling Peeps stop arguing about whose turn it is to be brave.' }
      ]
    },
    {
      id: 'wayfarer-rest', name: 'Wayfarer’s Rest', kind: 'building', role: 'Alderwing woodland shelter',
      artKey: 'wayfarer-rest',
      lore: 'Beyond the veil stands an open-sided woodland shelter, its roof patched with patient care. A bird keeper has collected stories from every corner of Alderwing. No inn, no shop: just a dry page and a place in the tale.',
      prompt: 'What will this shelter remember of your visit?',
      choices: [
        { id: 'tale', label: 'Leave a tale for the next walker', outcome: 'The keeper binds your little tale into the shelter’s book. A blank page waits beside it, ready for someone whose journey has only just begun.' },
        { id: 'listen', label: 'Hear how the shelter was built', outcome: 'One bird brought a beam; a dozen Peeps brought the same nail. The keeper laughs softly. “We needed both the beam and their enthusiasm.” You carry their story onward.' }
      ]
    }
  ];

  function copy(value) { return JSON.parse(JSON.stringify(value)); }
  function timestamp(value) { return typeof value === 'number' && isFinite(value) && value > 0 ? value : null; }
  function validPoint(lat, lon) {
    return typeof lat === 'number' && isFinite(lat) && Math.abs(lat) <= 90 &&
      typeof lon === 'number' && isFinite(lon) && Math.abs(lon) <= 180;
  }
  function longitudeDelta(a, b) { return ((b - a + 540) % 360) - 180; }
  function distanceM(a, b) {
    const rad = Math.PI / 180;
    const dLat = (b.lat - a.lat) * rad, dLon = longitudeDelta(a.lon, b.lon) * rad;
    const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.max(0, Math.min(1, s))));
  }

  // Measure against the existing line; never move a checkpoint onto an invented
  // spot. Reject malformed or off-route presentation data rather than adding
  // an encounter away from that line. Access validation belongs to route core.
  function routeGeometry(quest) {
    const points = quest && quest.route;
    if (!Array.isArray(points) || points.length < 2) return null;
    if (!points.every(p => Array.isArray(p) && validPoint(p[0], p[1]))) return null;
    const route = points.map(p => ({ lat: p[0], lon: p[1] }));
    const lengths = [], offsets = [0];
    for (let i = 1; i < route.length; i++) {
      lengths.push(distanceM(route[i - 1], route[i]));
      offsets.push(offsets[i - 1] + lengths[i - 1]);
    }
    return offsets[offsets.length - 1] > 0 ? { points: route, lengths: lengths, offsets: offsets, total: offsets[offsets.length - 1] } : null;
  }
  function checkpointPlacement(cp, geometry) {
    if (!cp || !validPoint(cp.lat, cp.lon) || !geometry) return null;
    // Network quests retain ordered arc distance. On a retraced path the same
    // coordinates occur twice, so nearest geometry alone picks the outward leg.
    const orderedDistance = cp.routeDistanceM;
    if (typeof orderedDistance === 'number' && isFinite(orderedDistance) && orderedDistance >= 0 && orderedDistance <= geometry.total + 1) {
      const target = Math.min(orderedDistance, geometry.total);
      for (let i = 1; i < geometry.points.length; i++) {
        if (target > geometry.offsets[i] && i < geometry.points.length - 1) continue;
        const a = geometry.points[i - 1], b = geometry.points[i];
        const fraction = geometry.lengths[i - 1] ? (target - geometry.offsets[i - 1]) / geometry.lengths[i - 1] : 0;
        const p = { lat: a.lat + (b.lat - a.lat) * fraction, lon: a.lon + longitudeDelta(a.lon, b.lon) * fraction };
        if (distanceM(cp, p) <= ROUTE_TOLERANCE_M) return { lat: cp.lat, lon: cp.lon, routeFraction: target / geometry.total };
        break;
      }
    }
    let best = null;
    for (let i = 1; i < geometry.points.length; i++) {
      const a = geometry.points[i - 1], b = geometry.points[i];
      const scale = Math.cos((a.lat + b.lat + cp.lat) / 3 * Math.PI / 180);
      const x = longitudeDelta(a.lon, b.lon) * scale, y = b.lat - a.lat;
      const px = longitudeDelta(a.lon, cp.lon) * scale, py = cp.lat - a.lat;
      const fraction = x * x + y * y ? Math.max(0, Math.min(1, (px * x + py * y) / (x * x + y * y))) : 0;
      const nearest = { lat: a.lat + (b.lat - a.lat) * fraction, lon: a.lon + longitudeDelta(a.lon, b.lon) * fraction };
      const distance = distanceM(cp, nearest);
      if (!best || distance < best.distance - 0.01) {
        best = { distance: distance, routeFraction: (geometry.offsets[i - 1] + fraction * geometry.lengths[i - 1]) / geometry.total };
      }
    }
    return best && best.distance <= ROUTE_TOLERANCE_M ? { lat: cp.lat, lon: cp.lon, routeFraction: best.routeFraction } : null;
  }

  function createQuestEncounters(quest) {
    const geometry = routeGeometry(quest), candidates = [];
    if (!geometry || !Array.isArray(quest.checkpoints)) return [];
    quest.checkpoints.forEach((cp, i) => {
      if (!cp || (cp.kind !== 'flag' && cp.kind !== 'chest')) return;
      const point = checkpointPlacement(cp, geometry);
      if (point) candidates.push({ checkpointIndex: i, point: point });
    });
    // Poor/legacy data may contain fewer checkpoints. Do not make extra stops
    // or place an NPC at the finish merely to fill an advertised quota.
    const count = Math.min(candidates.length, Number(quest.lengthM) >= 1500 ? 3 : 2);
    const stops = [];
    for (let i = 0; i < count; i++) {
      const slot = count === 1 ? 0 : Math.round(i * (candidates.length - 1) / (count - 1));
      const candidate = candidates[slot], definition = CATALOGUE[i];
      stops.push(Object.assign(copy(definition), candidate.point, {
        checkpointIndex: candidate.checkpointIndex,
        artPath: 'assets/walking-quests/' + definition.artKey + '.webp',
        fictional: true, fictionLabel: FICTION_LABEL,
        discovered: false, discoveredAt: null,
        choiceId: null, choiceAt: null, outcome: null
      }));
    }
    return stops;
  }

  function ensureQuestEncounters(quest) {
    if (!quest || typeof quest !== 'object') return [];
    if (!quest.encounters || typeof quest.encounters !== 'object' || Array.isArray(quest.encounters)) {
      quest.encounters = { version: VERSION, stops: createQuestEncounters(quest) };
    }
    // A future-version save belongs to its own reader. Do not overwrite it.
    if (quest.encounters.version !== VERSION || !Array.isArray(quest.encounters.stops)) return [];
    const geometry = routeGeometry(quest), seen = {};
    return quest.encounters.stops.filter(stop => {
      if (!stop || !CATALOGUE.some(definition => definition.id === stop.id) || seen[stop.id]) return false;
      seen[stop.id] = true;
      const index = stop.checkpointIndex;
      const cp = Number.isInteger(index) && Array.isArray(quest.checkpoints) ? quest.checkpoints[index] : null;
      if (!cp || (cp.kind !== 'flag' && cp.kind !== 'chest')) return false;
      const point = checkpointPlacement(cp, geometry);
      if (!point) return false;
      // Alignment can rechart an active quest. The encounter follows its actual
      // checkpoint; its saved discovery and once-only narrative do not reset.
      Object.assign(stop, point, { fictional: true, fictionLabel: FICTION_LABEL });
      return true;
    });
  }

  function listQuestEncounters(quest) { return copy(ensureQuestEncounters(quest)); }

  // Call after questProcessFix and after any durable chest-claim transaction.
  // Reached checkpoints are the sole arrival authority: proximity, a map tap,
  // an open dialog, a chest intent and a skipped future marker grant nothing.
  function onProgress(quest, opts) {
    if (!quest || quest.completedAt) return [];
    const now = timestamp(opts && opts.now) || Date.now(), discovered = [];
    ensureQuestEncounters(quest).forEach(stop => {
      if (stop.discovered === true) return;
      for (let i = 0; i <= stop.checkpointIndex; i++) {
        if (!quest.checkpoints[i] || quest.checkpoints[i].reached !== true) return;
      }
      stop.discovered = true;
      stop.discoveredAt = timestamp(quest.checkpoints[stop.checkpointIndex].reachedAt) || now;
      discovered.push(copy(stop));
    });
    return discovered;
  }

  // A saved narrative choice has no rewards and cannot be changed by reopening
  // a dialog. Callers save the quest before presenting the selected outcome.
  function chooseEncounter(quest, encounterId, choiceId, opts) {
    const stop = ensureQuestEncounters(quest).find(entry => entry.id === encounterId);
    if (!stop || stop.discovered !== true) return { status: 'locked' };
    if (stop.choiceId) return { status: 'already-chosen', encounter: copy(stop) };
    const choice = (Array.isArray(stop.choices) ? stop.choices : []).find(entry => entry.id === choiceId);
    if (!choice) return { status: 'invalid-choice' };
    stop.choiceId = choice.id;
    stop.choiceAt = timestamp(opts && opts.now) || Date.now();
    stop.outcome = choice.outcome;
    return { status: 'chosen', encounter: copy(stop) };
  }

  // Copy this onto the existing completed-quest summary before clearing active.
  // No separate campaign or economy ledger is introduced.
  function encounterJournal(quest) { return listQuestEncounters(quest).filter(stop => stop.discovered === true); }

  return {
    VERSION: VERSION,
    FICTION_LABEL: FICTION_LABEL,
    createQuestEncounters: createQuestEncounters,
    ensureQuestEncounters: ensureQuestEncounters,
    listQuestEncounters: listQuestEncounters,
    onProgress: onProgress,
    chooseEncounter: chooseEncounter,
    encounterJournal: encounterJournal
  };
});
