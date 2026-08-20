/* Burbz Settlement Merge Core
 *
 * Pure, deterministic rules for player-chosen settlement merges. Since
 * merge-when-ready-v290, three villages never grow into a town on their own:
 * each village must first EARN ITS MERGE STAR (40 folk, 75% happiness), and
 * then the player presses Merge. Towns climb to a region the same way. The
 * browser owns persistence and UI; this module only heals charters and does
 * the maths, so the same rules run under Node.
 *
 * A CHARTER records one merge the player signed: { seeds:[a,b,c], mergedAt }.
 * Village charters carry village seeds; region charters carry town heart
 * seeds. Charters are append-only history — deriveSettlements replays them,
 * so the same charters always rebuild the same towns and regions.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzSettlementMergeCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const EARTH_RADIUS_KM = 6371.0088;
  // A village is ready to merge once it houses this many folk...
  const TOWN_MERGE_MIN_POPULATION = 40;
  // ...and keeps them this happy (0..1 scale; 0.75 = 75%).
  const TOWN_MERGE_MIN_HAPPINESS = 0.75;
  // A town is ready to merge into a region once its three wards together
  // reach three ready villages' worth of folk, at the same happiness bar.
  const REGION_MERGE_MIN_POPULATION = 120;
  const REGION_MERGE_MIN_HAPPINESS = 0.75;
  // Every merge joins exactly three places.
  const MERGE_GROUP_SIZE = 3;

  function finiteNumber(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  // Happiness arrives either as 0..1 or as a 0..100 percentage. Heal both.
  function happinessRatio(value) {
    let h = Math.max(0, finiteNumber(value, 0));
    if (h > 1) h /= 100;
    return Math.min(1, h);
  }

  function readiness(input, minPopulation, minHappiness) {
    const source = input && typeof input === 'object' ? input : {};
    const population = Math.max(0, Math.floor(finiteNumber(source.population, 0)));
    const happiness = happinessRatio(source.happiness);
    const popOk = population >= minPopulation;
    const happyOk = happiness >= minHappiness;
    return {
      ready: popOk && happyOk,
      popOk,
      happyOk,
      population,
      happiness,
      popGoal: minPopulation,
      happyGoal: minHappiness
    };
  }

  /* Does this village wear its merge star? {population, happiness} in. */
  function villageMergeReadiness(input) {
    return readiness(input, TOWN_MERGE_MIN_POPULATION, TOWN_MERGE_MIN_HAPPINESS);
  }

  /* Does this town wear its merge star? Aggregated {population, happiness}. */
  function townMergeReadiness(input) {
    return readiness(input, REGION_MERGE_MIN_POPULATION, REGION_MERGE_MIN_HAPPINESS);
  }

  function uint32Value(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
  }

  /* Heal a stored charter list. Keeps order (charters are history), drops
     malformed rows, dedupes seeds within a charter, and never lets one seed
     appear in two charters — the first signing wins. Charters are allowed
     to hold MORE than three seeds so pre-v290 automatic formations (regions
     could hold four or more towns) survive as signed history. */
  function sanitizeCharters(raw) {
    const out = [];
    const taken = new Set();
    (Array.isArray(raw) ? raw : []).forEach(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return;
      const seeds = [];
      (Array.isArray(row.seeds) ? row.seeds : []).forEach(value => {
        const seed = uint32Value(value);
        if (seed === null || seeds.includes(seed) || taken.has(seed)) return;
        seeds.push(seed);
      });
      if (seeds.length < MERGE_GROUP_SIZE) return;
      seeds.sort((a, b) => a - b);
      seeds.forEach(seed => taken.add(seed));
      const mergedAt = typeof row.mergedAt === 'string' ? row.mergedAt : '';
      out.push({ seeds, mergedAt });
    });
    return out;
  }

  /* Every seed already bound by a charter. */
  function charteredSeeds(charters) {
    const taken = new Set();
    sanitizeCharters(charters).forEach(charter => charter.seeds.forEach(seed => taken.add(String(seed))));
    return taken;
  }

  function toRad(deg) { return Number(deg) * Math.PI / 180; }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2) - toRad(lat1);
    const dLon = toRad(lon2) - toRad(lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function validPoint(p) {
    if (!p) return false;
    const lat = Number(p.lat), lon = Number(p.lon);
    return uint32Value(p.seed) !== null && Number.isFinite(lat) && Number.isFinite(lon) &&
      lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function claimTime(p) {
    const t = Date.parse(p && (p.claimedAt || p.foundedAt || p.liberatedAt));
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }

  function chronological(a, b) {
    return claimTime(a) - claimTime(b) || (uint32Value(a.seed) || 0) - (uint32Value(b.seed) || 0);
  }

  /* Chain points into proximity clusters: any two within radiusKm join, and
     chains extend the cluster. Same union-find rule the realm core uses. */
  function clusterPoints(points, radiusKm) {
    const rows = (Array.isArray(points) ? points : []).filter(validPoint);
    const radius = Math.max(1, finiteNumber(radiusKm, 5));
    const parent = rows.map((_, i) => i);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    for (let i = 0; i < rows.length; i++) {
      for (let j = i + 1; j < rows.length; j++) {
        if (haversineKm(rows[i].lat, rows[i].lon, rows[j].lat, rows[j].lon) <= radius) {
          const ri = find(i), rj = find(j);
          if (ri !== rj) parent[rj] = ri;
        }
      }
    }
    const groups = new Map();
    rows.forEach((row, i) => {
      const rootIdx = find(i);
      if (!groups.has(rootIdx)) groups.set(rootIdx, []);
      groups.get(rootIdx).push(row);
    });
    const clusters = Array.from(groups.values());
    clusters.forEach(cluster => cluster.sort(chronological));
    clusters.sort((a, b) => chronological(a[0], b[0]));
    return clusters;
  }

  /* The merges the player could sign right now. Points carry {seed, name,
     lat, lon, claimedAt, ready}; only ready, unchartered points count. One
     candidate per cluster: its three earliest members, so the offer is
     deterministic. Returns [{seeds, names, points}]. */
  function mergeCandidates(points, radiusKm, charters) {
    const taken = charteredSeeds(charters);
    const eligible = (Array.isArray(points) ? points : [])
      .filter(p => validPoint(p) && p.ready && !taken.has(String(uint32Value(p.seed))));
    return clusterPoints(eligible, radiusKm)
      .filter(cluster => cluster.length >= MERGE_GROUP_SIZE)
      .map(cluster => {
        const members = cluster.slice(0, MERGE_GROUP_SIZE);
        return {
          seeds: members.map(p => uint32Value(p.seed)).sort((a, b) => a - b),
          names: members.map(p => String(p.name || 'a settlement')),
          points: members
        };
      });
  }

  /* Validate one merge the player asked for. Points are the SAME rows fed to
     mergeCandidates (ready flags included). Returns {ok, reason, seeds}. */
  function validateMerge(points, radiusKm, charters, chosenSeeds) {
    const rows = (Array.isArray(points) ? points : []).filter(validPoint);
    const bySeed = new Map(rows.map(p => [String(uint32Value(p.seed)), p]));
    const taken = charteredSeeds(charters);
    const seeds = [];
    (Array.isArray(chosenSeeds) ? chosenSeeds : []).forEach(value => {
      const seed = uint32Value(value);
      if (seed !== null && !seeds.includes(seed)) seeds.push(seed);
    });
    if (seeds.length !== MERGE_GROUP_SIZE) return { ok: false, reason: 'A merge joins exactly three places.', seeds };
    const members = [];
    for (const seed of seeds) {
      const point = bySeed.get(String(seed));
      if (!point) return { ok: false, reason: 'One of those places is not yours to merge.', seeds };
      if (taken.has(String(seed))) return { ok: false, reason: 'One of those places has already merged.', seeds };
      if (!point.ready) return { ok: false, reason: String(point.name || 'One of them') + ' has not earned its merge star yet.', seeds };
      members.push(point);
    }
    if (clusterPoints(members, radiusKm).length !== 1) {
      return { ok: false, reason: 'Those three stand too far apart to merge.', seeds };
    }
    return { ok: true, reason: '', seeds: seeds.slice().sort((a, b) => a - b) };
  }

  /* "Aldermoor, Briarwell and Foxholt" for merge banners and toasts. */
  function nameList(names) {
    const list = (Array.isArray(names) ? names : []).map(name => String(name));
    if (list.length <= 1) return list.join('');
    return list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1];
  }

  return {
    TOWN_MERGE_MIN_POPULATION,
    TOWN_MERGE_MIN_HAPPINESS,
    REGION_MERGE_MIN_POPULATION,
    REGION_MERGE_MIN_HAPPINESS,
    MERGE_GROUP_SIZE,
    villageMergeReadiness,
    townMergeReadiness,
    sanitizeCharters,
    charteredSeeds,
    clusterPoints,
    mergeCandidates,
    validateMerge,
    nameList,
    haversineKm
  };
});
