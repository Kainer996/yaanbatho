/* Burbz Empire Realm Core — the Crusader-Kings layer of the liberation war.
 *
 * Pure, deterministic helpers only. Villages the player has liberated from the
 * evil Burbz cluster into REGIONS by real-world proximity; regions carry
 * feudal tiers (County → Duchy → Kingdom), grant a unity tax bonus to their
 * member sanctuaries, and — once the realm holds two or more regions — can
 * open TRADE ROUTES between their capitals. All of it stays liberation-themed:
 * every region is a rescued piece of the Kingdom of Burbz, every caravan flies
 * between free sanctuaries, and nothing here ever conquers anyone.
 *
 * The game stays deliberately simple before this layer exists: none of these
 * mechanics surface until the player has liberated enough villages to found a
 * region (REGION_MIN_VILLAGES within REGION_RADIUS_KM of each other).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzEmpireRealmCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const EARTH_RADIUS_KM = 6371.0088;
  // Villages chained within this range of each other belong to the same region.
  const REGION_RADIUS_KM = 150;
  // A cluster founds a region once it holds this many liberated villages.
  const REGION_MIN_VILLAGES = 3;
  // Region unity: sanctuaries inside a founded region pay 15% more taxes.
  const REGION_TAX_BONUS = 0.15;
  // Feudal ladder per region size — the "scales up from there" curve.
  const REGION_TIERS = [
    { min: 8, rank: 'kingdom', label: 'Kingdom', icon: '👑', weight: 3 },
    { min: 5, rank: 'duchy',   label: 'Duchy',   icon: '🏰', weight: 2 },
    { min: 0, rank: 'county',  label: 'County',  icon: '🛡️', weight: 1 }
  ];
  const TRADE_ROUTE_COLOR = '#f0c767';
  // Deterministic export goods a region's caravans carry, keyed off its
  // capital seed. Ids must exist in loot_crafting_core MATERIALS.
  const TRADE_GOODS = ['oak_twig', 'river_reed', 'iron_grit', 'down_tuft', 'storm_glass', 'moon_dust'];

  // ---- Settlement tiers: village → town → city ------------------------------
  // The street-level layer BELOW regions. Liberate 3 neighbouring villages
  // (chained within SETTLEMENT_TOWN_RADIUS_KM of each other) and they grow
  // together into one TOWN; raise 3 neighbouring towns (squares chained within
  // SETTLEMENT_CITY_RADIUS_KM) and they merge into one CITY. Merged districts
  // pay bonus taxes and their shared guilds build faster; on the atlas their
  // daylight pools fuse into one glow. Regions (150 km) sit far above this.
  const SETTLEMENT_TOWN_RADIUS_KM = 5;
  const SETTLEMENT_TOWN_MIN_VILLAGES = 3;
  const SETTLEMENT_CITY_RADIUS_KM = 15;
  const SETTLEMENT_CITY_MIN_TOWNS = 3;
  const SETTLEMENT_TIERS = {
    village: { rank: 'village', label: 'Village', icon: '🏡', taxBonus: 0,    buildTimeFactor: 1,    territoryRadiusM: 2200 },
    town:    { rank: 'town',    label: 'Town',    icon: '🏘️', taxBonus: 0.10, buildTimeFactor: 0.85, territoryRadiusM: 3200 },
    city:    { rank: 'city',    label: 'City',    icon: '🏙️', taxBonus: 0.25, buildTimeFactor: 0.70, territoryRadiusM: 4200 }
  };
  function settlementTierInfo(rank) {
    return SETTLEMENT_TIERS[rank] || SETTLEMENT_TIERS.village;
  }

  function toRad(deg) { return Number(deg) * Math.PI / 180; }

  function validVillage(v) {
    if (!v || v.lat === null || v.lat === undefined || v.lon === null || v.lon === undefined) return false;
    const lat = Number(v.lat), lon = Number(v.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2) - toRad(lat1);
    const dLon = toRad(lon2) - toRad(lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function claimTime(v) {
    const t = Date.parse(v && v.claimedAt);
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }

  /* Chain villages into proximity clusters (union-find): any two villages
     within radiusKm join the same cluster, and chains extend it — a string of
     towns up a valley is one region even if its ends are far apart. */
  function clusterVillages(villages, radiusKm) {
    const claims = (Array.isArray(villages) ? villages : []).filter(validVillage);
    const radius = Math.max(1, Number(radiusKm) || REGION_RADIUS_KM);
    const parent = claims.map((_, i) => i);
    function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
    function union(i, j) { const ri = find(i), rj = find(j); if (ri !== rj) parent[rj] = ri; }
    for (let i = 0; i < claims.length; i++) {
      for (let j = i + 1; j < claims.length; j++) {
        if (haversineKm(claims[i].lat, claims[i].lon, claims[j].lat, claims[j].lon) <= radius) union(i, j);
      }
    }
    const groups = new Map();
    claims.forEach((v, i) => {
      const rootIdx = find(i);
      if (!groups.has(rootIdx)) groups.set(rootIdx, []);
      groups.get(rootIdx).push(v);
    });
    const clusters = Array.from(groups.values());
    clusters.forEach(c => c.sort((a, b) => claimTime(a) - claimTime(b)));
    clusters.sort((a, b) => claimTime(a[0]) - claimTime(b[0]));
    return clusters;
  }

  function regionTier(villageCount) {
    const n = Math.max(0, Math.floor(Number(villageCount) || 0));
    for (const tier of REGION_TIERS) { if (n >= tier.min) return tier; }
    return REGION_TIERS[REGION_TIERS.length - 1];
  }

  /* Tier-ladder progress for the Region Hall: which tier comes next and how
     many more liberated sanctuaries it takes. null once the region already
     sits at the top of the ladder (a Kingdom has nowhere higher to climb). */
  function nextRegionTier(villageCount) {
    const n = Math.max(0, Math.floor(Number(villageCount) || 0));
    const ladder = REGION_TIERS.slice().sort((a, b) => a.min - b.min);
    for (const tier of ladder) { if (n < tier.min) return { next: tier, needed: tier.min - n }; }
    return null;
  }

  /* How far a founded region's daylight reaches on the royal atlas: from its
     centroid out past its farthest sanctuary, plus padding so the region's
     countryside wakes too. Founding a region unlocks the WHOLE region of the
     map — the county's lands, not just pinpricks around its towns. */
  function regionCoverageRadiusKm(region, paddingKm) {
    const villages = region && Array.isArray(region.villages) ? region.villages.filter(validVillage) : [];
    if (!villages.length) return 0;
    const centre = region.centroid && validVillage(region.centroid) ? region.centroid : centroidOf(villages);
    let reach = 0;
    villages.forEach(v => { reach = Math.max(reach, haversineKm(centre.lat, centre.lon, v.lat, v.lon)); });
    return reach + Math.max(0, Number(paddingKm) || 0);
  }

  function centroidOf(villages) {
    // Average on unit vectors so a region straddling the dateline still gets
    // a sane centre for its banner.
    let x = 0, y = 0, z = 0;
    villages.forEach(v => {
      const lat = toRad(v.lat), lon = toRad(v.lon);
      x += Math.cos(lat) * Math.cos(lon);
      y += Math.cos(lat) * Math.sin(lon);
      z += Math.sin(lat);
    });
    const n = Math.max(1, villages.length);
    x /= n; y /= n; z /= n;
    const hyp = Math.sqrt(x * x + y * y) || 1e-12;
    return { lat: Math.atan2(z, hyp) * 180 / Math.PI, lon: Math.atan2(y, x) * 180 / Math.PI };
  }

  /* The heart of the endgame: liberated villages → founded regions.
     Capital = the earliest-liberated village of the cluster (the sanctuary
     that anchored the freedom spell first). Region id = its capital seed, so
     ids survive new liberations unless two regions genuinely grow together. */
  function deriveRegions(villages, options) {
    const opts = options || {};
    const radiusKm = Number(opts.radiusKm) || REGION_RADIUS_KM;
    const minVillages = Math.max(2, Math.floor(Number(opts.minVillages) || REGION_MIN_VILLAGES));
    const clusters = clusterVillages(villages, radiusKm);
    const regions = [];
    const unassigned = [];
    clusters.forEach(cluster => {
      if (cluster.length < minVillages) { unassigned.push(...cluster); return; }
      const capital = cluster[0];
      const tier = regionTier(cluster.length);
      regions.push({
        id: String(Number(capital.seed) >>> 0),
        capitalSeed: Number(capital.seed) >>> 0,
        capitalName: String(capital.name || 'Sanctuary'),
        name: tier.label + ' of ' + String(capital.name || 'the Free Marches'),
        tier: tier.rank,
        tierLabel: tier.label,
        tierIcon: tier.icon,
        tierWeight: tier.weight,
        villageCount: cluster.length,
        villages: cluster,
        centroid: centroidOf(cluster),
        foundedAt: cluster[minVillages - 1].claimedAt || cluster[0].claimedAt || ''
      });
    });
    // Progress hint for the pre-region game: how close is the best cluster?
    const largestCluster = clusters.reduce((best, c) => Math.max(best, c.length), 0);
    return { regions, unassigned, largestCluster, clusterCount: clusters.length };
  }

  /* Settlement growth: liberated villages → towns → cities.
     A town keeps the name of its HEART — the earliest-liberated village of the
     cluster — and a city keeps the name of its earliest-founded town, so names
     and ids survive new liberations exactly like region capitals do. Towns
     that join a city keep existing (they are its boroughs); tierBySeed maps
     every liberated village straight to the top settlement it belongs to. */
  function deriveSettlements(villages, options) {
    const opts = options || {};
    const townRadiusKm = Number(opts.townRadiusKm) || SETTLEMENT_TOWN_RADIUS_KM;
    const cityRadiusKm = Number(opts.cityRadiusKm) || SETTLEMENT_CITY_RADIUS_KM;
    const minVillages = Math.max(2, Math.floor(Number(opts.minVillages) || SETTLEMENT_TOWN_MIN_VILLAGES));
    const minTowns = Math.max(2, Math.floor(Number(opts.minTowns) || SETTLEMENT_CITY_MIN_TOWNS));
    const clusters = clusterVillages(villages, townRadiusKm);
    const towns = [];
    let largestVillageCluster = 0;
    clusters.forEach(cluster => {
      if (cluster.length < minVillages) { largestVillageCluster = Math.max(largestVillageCluster, cluster.length); return; }
      const heart = cluster[0];
      towns.push({
        id: 'town-' + (Number(heart.seed) >>> 0),
        tier: 'town',
        heartSeed: Number(heart.seed) >>> 0,
        name: String(heart.name || 'Freehold'),
        label: 'Town of ' + String(heart.name || 'Freehold'),
        icon: SETTLEMENT_TIERS.town.icon,
        villageCount: cluster.length,
        villages: cluster,
        centroid: centroidOf(cluster),
        foundedAt: cluster[minVillages - 1].claimedAt || cluster[0].claimedAt || '',
        cityId: null
      });
    });
    // Towns whose market squares chain within cityRadiusKm merge into cities.
    const townPoints = towns.map(t => ({ seed: t.heartSeed, name: t.name, lat: t.centroid.lat, lon: t.centroid.lon, claimedAt: t.foundedAt }));
    const townClusters = clusterVillages(townPoints, cityRadiusKm);
    const townBySeed = new Map(towns.map(t => [String(t.heartSeed), t]));
    const cities = [];
    let largestTownCluster = 0;
    townClusters.forEach(cluster => {
      if (cluster.length < minTowns) { largestTownCluster = Math.max(largestTownCluster, cluster.length); return; }
      const members = cluster.map(p => townBySeed.get(String(Number(p.seed) >>> 0))).filter(Boolean);
      if (members.length < minTowns) return;
      const heartTown = members[0];
      const cityVillages = members.reduce((all, t) => all.concat(t.villages), []).sort((a, b) => claimTime(a) - claimTime(b));
      const city = {
        id: 'city-' + heartTown.heartSeed,
        tier: 'city',
        heartSeed: heartTown.heartSeed,
        name: heartTown.name,
        label: 'City of ' + heartTown.name,
        icon: SETTLEMENT_TIERS.city.icon,
        townCount: members.length,
        towns: members,
        villageCount: cityVillages.length,
        villages: cityVillages,
        centroid: centroidOf(cityVillages),
        foundedAt: cluster[minTowns - 1].claimedAt || heartTown.foundedAt || ''
      };
      members.forEach(t => { t.cityId = city.id; });
      cities.push(city);
    });
    // Every liberated village knows what it now belongs to.
    const tierBySeed = {};
    towns.forEach(town => {
      const s = town.cityId ? cities.find(c => c.id === town.cityId) : town;
      town.villages.forEach(v => {
        tierBySeed[String(Number(v.seed) >>> 0)] = {
          tier: s.tier,
          role: (Number(v.seed) >>> 0) === s.heartSeed ? 'heart' : 'district',
          id: s.id,
          name: s.name,
          label: s.label,
          icon: s.icon
        };
      });
    });
    return { towns, cities, tierBySeed, townCount: towns.length, cityCount: cities.length, largestVillageCluster, largestTownCluster };
  }

  /* Crown ladder — the player's realm-wide title once regions exist. Score is
     the sum of region tier weights, so a Kingdom counts triple a County. */
  function crownTitle(regions) {
    const list = Array.isArray(regions) ? regions : [];
    if (!list.length) return null;
    const score = list.reduce((sum, r) => sum + (Number(r.tierWeight) || 1), 0);
    const best = list.slice().sort((a, b) => (b.tierWeight || 0) - (a.tierWeight || 0) || (b.villageCount || 0) - (a.villageCount || 0))[0];
    if (score >= 8) return 'Emperor of the Liberated Skies';
    if (score >= 5) return 'High Monarch of the Free Realms';
    if (score >= 3) return 'Monarch of ' + best.capitalName;
    if (score >= 2) return 'Duke of ' + best.capitalName;
    return 'Count of ' + best.capitalName;
  }

  function tradeRouteKey(idA, idB) {
    const pair = [String(idA), String(idB)].sort();
    return pair[0] + '~' + pair[1];
  }

  /* Every unordered pair of regions is a possible caravan road. */
  function tradeRouteCandidates(regions) {
    const list = Array.isArray(regions) ? regions : [];
    const out = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        const capA = a.villages[0], capB = b.villages[0];
        out.push({
          key: tradeRouteKey(a.id, b.id),
          a: a.id, b: b.id,
          distanceKm: Math.round(haversineKm(capA.lat, capA.lon, capB.lat, capB.lon))
        });
      }
    }
    out.sort((x, y) => x.distanceKm - y.distanceKm);
    return out;
  }

  /* Opening the Nth caravan road costs more than the last — the endgame keeps
     asking for the branch economy the early game taught. */
  function tradeRouteCost(openedCount) {
    const n = Math.max(0, Math.floor(Number(openedCount) || 0));
    return { coins: 140 + 110 * n, branches: 35 + 15 * n };
  }

  /* Trade income per 8-hour cycle. Balance intent:
     - both regions must actually live: income scales on sqrt(popA * popB),
       so two thriving realms out-earn ten ghost towns;
     - distance PAYS: the fantasy of liberating Delamere Forest and then the
       south of France is rewarded — far-flung caravans carry rarer cargo
       (factor 1 + min(1.25, km/1600), so ~Cheshire→Provence ≈ ×1.7);
     - a mature long route earns like two extra healthy provinces, never more,
       so building villages stays the primary loop. */
  function tradeRouteIncome(popA, popB, distanceKm) {
    const a = Math.max(1, Number(popA) || 0), b = Math.max(1, Number(popB) || 0);
    const distance = Math.max(0, Number(distanceKm) || 0);
    const distanceFactor = 1 + Math.min(1.25, distance / 1600);
    const coins = Math.round((6 + 1.15 * Math.sqrt(a * b)) * distanceFactor);
    const goodsQty = 1 + Math.min(3, Math.floor(Math.sqrt(Math.min(a, b)) / 3));
    return { coins, goodsQty, distanceFactor: Number(distanceFactor.toFixed(3)) };
  }

  /* Each capital exports one signature good, seeded so it never changes. The
     route delivers both regions' goods to the royal stores each cycle. */
  function tradeRouteGoods(capitalSeedA, capitalSeedB) {
    const a = TRADE_GOODS[(Number(capitalSeedA) >>> 0) % TRADE_GOODS.length];
    let bIdx = (Number(capitalSeedB) >>> 0) % TRADE_GOODS.length;
    if (TRADE_GOODS[bIdx] === a) bIdx = (bIdx + 1) % TRADE_GOODS.length;
    return [a, TRADE_GOODS[bIdx]];
  }

  /* Great-circle arc between two capitals for the map — slerped, with
     longitudes unwrapped point-to-point so a route over the dateline renders
     as the short arc instead of a world-spanning zigzag. */
  function greatCircleArc(from, to, steps) {
    if (!validVillage(from) || !validVillage(to)) return null;
    const count = Math.max(8, Math.min(128, Math.round(Number(steps) || 48)));
    const la1 = toRad(from.lat), lo1 = toRad(from.lon);
    const la2 = toRad(to.lat), lo2 = toRad(to.lon);
    const ax = Math.cos(la1) * Math.cos(lo1), ay = Math.cos(la1) * Math.sin(lo1), az = Math.sin(la1);
    const bx = Math.cos(la2) * Math.cos(lo2), by = Math.cos(la2) * Math.sin(lo2), bz = Math.sin(la2);
    const omega = Math.acos(Math.max(-1, Math.min(1, ax * bx + ay * by + az * bz)));
    const coords = [];
    let prevLon = Number(from.lon);
    for (let i = 0; i <= count; i++) {
      const t = i / count;
      let x, y, z;
      if (omega < 1e-9) { x = ax; y = ay; z = az; }
      else {
        const sinO = Math.sin(omega);
        const f0 = Math.sin((1 - t) * omega) / sinO, f1 = Math.sin(t * omega) / sinO;
        x = f0 * ax + f1 * bx; y = f0 * ay + f1 * by; z = f0 * az + f1 * bz;
      }
      const lat = Math.atan2(z, Math.sqrt(x * x + y * y) || 1e-12) * 180 / Math.PI;
      let lon = Math.atan2(y, x) * 180 / Math.PI;
      lon += 360 * Math.round((prevLon - lon) / 360);
      prevLon = lon;
      coords.push([lon, lat]);
    }
    return coords;
  }

  function tradeRouteFeatureCollection(routes, steps) {
    const features = (Array.isArray(routes) ? routes : []).map(route => {
      if (!route || !validVillage(route.from) || !validVillage(route.to)) return null;
      const arc = greatCircleArc(route.from, route.to, steps);
      if (!arc) return null;
      return {
        type: 'Feature',
        properties: {
          key: String(route.key || ''),
          name: String(route.from.name || '') + ' ⇄ ' + String(route.to.name || ''),
          color: TRADE_ROUTE_COLOR
        },
        geometry: { type: 'LineString', coordinates: arc }
      };
    }).filter(Boolean);
    return { type: 'FeatureCollection', features };
  }

  return {
    EARTH_RADIUS_KM,
    REGION_RADIUS_KM,
    REGION_MIN_VILLAGES,
    REGION_TAX_BONUS,
    REGION_TIERS,
    TRADE_ROUTE_COLOR,
    TRADE_GOODS,
    SETTLEMENT_TOWN_RADIUS_KM,
    SETTLEMENT_TOWN_MIN_VILLAGES,
    SETTLEMENT_CITY_RADIUS_KM,
    SETTLEMENT_CITY_MIN_TOWNS,
    SETTLEMENT_TIERS,
    settlementTierInfo,
    deriveSettlements,
    validVillage,
    haversineKm,
    clusterVillages,
    regionTier,
    nextRegionTier,
    regionCoverageRadiusKm,
    centroidOf,
    deriveRegions,
    crownTitle,
    tradeRouteKey,
    tradeRouteCandidates,
    tradeRouteCost,
    tradeRouteIncome,
    tradeRouteGoods,
    greatCircleArc,
    tradeRouteFeatureCollection
  };
});
