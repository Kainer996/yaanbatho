/* Burbz Empire Realm Core — the Crusader-Kings layer of the liberation war.
 *
 * Pure, deterministic helpers only. Villages the player has liberated from the
 * evil Burbz first form permanent, exact three-village TOWNS. Nearby Towns
 * then found COUNTIES, and the feudal ladder above them NESTS the way Crusader
 * Kings' does — every tier is made of the tier below, never of loose villages:
 *
 *   3 villages within SETTLEMENT_TOWN_RADIUS_KM → found a TOWN
 *   3 towns within REGION_RADIUS_KM              → found a COUNTY
 *   2 counties within DUCHY_RADIUS_KM       → unite into a DUCHY
 *   2 duchies within KINGDOM_RADIUS_KM      → proclaim a KINGDOM
 *   2 kingdoms anywhere on Earth            → proclaim the EMPIRE
 *
 * Counties grant a unity tax bonus to their member sanctuaries (rising as
 * their liege chain climbs), and — once the realm holds two or more counties
 * — can open TRADE ROUTES between their capitals. All of it stays
 * liberation-themed: every county is a rescued piece of the Kingdom of Burbz,
 * every caravan flies between free sanctuaries, and nothing here ever
 * conquers anyone.
 *
 * The game stays deliberately simple before this layer exists: none of these
 * mechanics surface until the player has founded enough nearby towns to found
 * a county (REGION_MIN_TOWNS within REGION_RADIUS_KM of each other).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzEmpireRealmCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const EARTH_RADIUS_KM = 6371.0088;
  // Towns chained within this range of each other belong to the same region.
  const REGION_RADIUS_KM = 150;
  // A cluster founds a region once it holds this many permanent towns. Keep
  // the old public name as an alias for browser/tests written before Towns
  // became the unit of county formation.
  const REGION_MIN_TOWNS = 3;
  const REGION_MIN_VILLAGES = REGION_MIN_TOWNS;
  // County unity: sanctuaries inside a founded county pay 15% more taxes.
  const REGION_TAX_BONUS = 0.15;
  // The nested feudal ladder above counties — simplified Crusader Kings.
  // Each tier is made OF the tier below: a duchy is 2+ counties whose
  // capitals chain within DUCHY_RADIUS_KM, a kingdom is 2+ duchies whose
  // seats chain within KINGDOM_RADIUS_KM, and the empire is proclaimed the
  // moment 2 kingdoms stand anywhere on Earth. A county never "grows into"
  // a duchy by itself, however many villages it holds.
  const COUNTY_TIER = { rank: 'county', label: 'County', icon: '🛡️' };
  const DUCHY_RADIUS_KM = 600;
  const DUCHY_MIN_COUNTIES = 2;
  const KINGDOM_RADIUS_KM = 2000;
  const KINGDOM_MIN_DUCHIES = 2;
  const EMPIRE_MIN_KINGDOMS = 2;
  const EMPIRE_NAME = 'Empire of the Liberated Skies';
  // Unity taxes rise as a county's liege chain climbs: a lone county pays
  // +15%, one sworn to a duchy +20%, one inside a kingdom +25%, and every
  // county of the proclaimed empire +30%.
  const LIEGE_TAX_BONUS = { county: 0.15, duchy: 0.20, kingdom: 0.25, empire: 0.30 };
  const TRADE_ROUTE_COLOR = '#f0c767';
  // Deterministic export goods a region's caravans carry, keyed off its
  // capital seed. Ids must exist in loot_crafting_core MATERIALS.
  const TRADE_GOODS = ['oak_twig', 'river_reed', 'iron_grit', 'down_tuft', 'storm_glass', 'moon_dust'];

  // ---- Shared, hand-written place names -------------------------------------
  // Every settlement on Earth draws its name from PLACE_NAMES: two hundred
  // invented names, written by hand to read like real villages and towns.
  // Every player sees the same two hundred, so the world feels authored
  // rather than generated (the old 14-letter syllable stems read as noise).
  //
  // The SEED is the only identity. Save data must never key on a name:
  // with a finite pool, far-apart places can share a name — exactly like
  // Earth's many Newtons. Three properties keep the map readable:
  //   1. Deterministic — placeName(kind, seed) is a pure function, so a
  //      village is called the same thing on every phone, forever.
  //   2. Spread — the index strides the pool by 73 (coprime with 200), so
  //      any 200 consecutive seeds get 200 different names. Neighbouring
  //      map cells hold consecutive seeds (villageCellSeed is sequential),
  //      which pushes namesake villages kilometres apart.
  //   3. Rank offsets — each rank adds its own offset, all six distinct
  //      mod 200, so a capital village, its town and its county can never
  //      share a name for the same seed.
  const PLACE_NAME_VERSION = 2;
  const VILLAGE_CELL_DEG = 0.02;
  // The live map asks for at most four cells beyond the legal latitude/
  // longitude edges.  These compact ranges cover that whole supported world.
  // Ordinary cells occupy the low half of uint32; guaranteed waysteads occupy
  // the high half, so the two kinds can never alias each other.
  const CELL_I_MIN = -4504, CELL_I_MAX = 4504;
  const CELL_J_MIN = -9004, CELL_J_MAX = 9004;
  const CELL_J_COUNT = CELL_J_MAX - CELL_J_MIN + 1;
  const BLOCK_I_MIN = Math.floor(CELL_I_MIN / 3), BLOCK_I_MAX = Math.floor(CELL_I_MAX / 3);
  const BLOCK_J_MIN = Math.floor(CELL_J_MIN / 3), BLOCK_J_MAX = Math.floor(CELL_J_MAX / 3);
  const BLOCK_J_COUNT = BLOCK_J_MAX - BLOCK_J_MIN + 1;
  // Two hundred names, alphabetical for easy auditing. Order is API: a name's
  // position decides which seeds wear it, so append-or-replace in place —
  // never re-sort, insert or delete once shipped.
  const PLACE_NAMES = Object.freeze([
    'Acornshaw', 'Alderbrook', 'Aldergate', 'Amberwick', 'Amblefirth',
    'Anchorstow', 'Applecote', 'Ashenfell', 'Aspenlow', 'Asterfield',
    'Badgerbrook', 'Barleymoor', 'Beckthorpe', 'Beechenholt', 'Bellbrook',
    'Bilberrow', 'Birchhollow', 'Bitterndell', 'Bouldergate', 'Brackenholt',
    'Bramblewick', 'Briarcombe', 'Brockhollow', 'Buntingfold', 'Burdockley',
    'Cairnbrook', 'Cedarmoor', 'Chalkden', 'Cherrystow', 'Chestnutley',
    'Cinderfell', 'Cliffburn', 'Cloverstow', 'Cobbleton', 'Cockleby',
    'Comfreydell', 'Cootfen', 'Copperfell', 'Cowslipmead', 'Cranmoor',
    'Cricketfield', 'Crocusbank', 'Cuckooshaw', 'Curlewgate', 'Cygnetford',
    'Damsonfold', 'Dapplegill', 'Dawnbeck', 'Deephurst', 'Dewhollow',
    'Dimmerdale', 'Dipperford', 'Doveholt', 'Driftmoor', 'Dunlinshore',
    'Dunnockley', 'Duskmere', 'Eaglescrag', 'Eiderholm', 'Elderglen',
    'Elmsworth', 'Elverthorpe', 'Emberley', 'Embertarn', 'Evergill',
    'Falconleigh', 'Fallowden', 'Farrowby', 'Featherlow', 'Ferncombe',
    'Fernsham', 'Finchdale', 'Flintlow', 'Foxbourne', 'Foxglovedell',
    'Frostfold', 'Furzeholt', 'Galesworth', 'Gannetholm', 'Garthby',
    'Gildenbrook', 'Gloamwick', 'Gorsefen', 'Greywold', 'Gullwick',
    'Harebellmoor', 'Harrowdell', 'Hartsholt', 'Hawksfell', 'Hawthorndale',
    'Hazelgarth', 'Heatherby', 'Heronmere', 'Herringwharf', 'Hollowbeck',
    'Hollybourne', 'Honeycroft', 'Hornbeck', 'Humblestow', 'Inglebeck',
    'Ironcombe', 'Ivymoor', 'Jackdawley', 'Jaywood', 'Junipermoor',
    'Kelpcove', 'Kestrelby', 'Kilnfold', 'Kitewood', 'Lanternwick',
    'Lapwingley', 'Larchfell', 'Larkbourne', 'Lilyfen', 'Lindenshaw',
    'Linnetstow', 'Loamfield', 'Longmarsh', 'Mallowmarsh', 'Maplecroft',
    'Marlbourne', 'Martenscroft', 'Meadowbeck', 'Merrowdale', 'Millthwaite',
    'Minnowbrook', 'Misthollow', 'Mistleford', 'Moorcott', 'Mossbridge',
    'Nettleby', 'Nuthatchden', 'Oakhollow', 'Oatgarth', 'Orchardholt',
    'Ospreymere', 'Otterwade', 'Owlcombe', 'Oxenfen', 'Pebbleford',
    'Pengarth', 'Pinefold', 'Pintailmere', 'Pippincote', 'Ploverstow',
    'Primrosebank', 'Puffinholm', 'Quailsham', 'Quillbrook', 'Quincefen',
    'Rainholm', 'Ramsondell', 'Ravenmere', 'Reedholme', 'Ridgefold',
    'Rimebeck', 'Robinsworth', 'Rooksby', 'Rowanleigh', 'Rushfen',
    'Saltmere', 'Scarholm', 'Sealfirth', 'Sedgefen', 'Shalefell',
    'Shrikefell', 'Silverbeck', 'Siskinford', 'Slatefell', 'Sloecombe',
    'Snipefen', 'Sorrelton', 'Sparrowden', 'Starlingden',
    'Stonewharf', 'Stormgarth', 'Swanfold', 'Swiftmere', 'Tanglemere',
    'Tarnlow', 'Tealbrook', 'Teaselcroft', 'Ternby', 'Thistlemere',
    'Thornrigg', 'Tidewick', 'Timberholt', 'Turnstonecove', 'Umberfell',
    'Vetchfield', 'Vixenholt', 'Wagtailford', 'Walnutshaw', 'Wheatcroft',
    'Whistlebrook', 'Willowcombe', 'Winterbeck', 'Wrenfold', 'Yarrowden',
    'Yewgarth'
  ]);
  const PLACE_NAME_COUNT = PLACE_NAMES.length;
  // Coprime with the pool size, so seed → index is a bijection mod 200.
  const PLACE_NAME_STRIDE = 73;
  const PLACE_NAME_RANKS = Object.freeze({
    village: { offset: 0 },
    town:    { offset: 33 },
    city:    { offset: 71 },
    county:  { offset: 107 },
    duchy:   { offset: 139 },
    kingdom: { offset: 171 }
  });

  function placeName(kind, seed) {
    const rank = String(kind || '').toLowerCase();
    const config = PLACE_NAME_RANKS[rank];
    if (!config) throw new TypeError('Unknown place rank: ' + kind);
    const value = (Number(seed) >>> 0) % PLACE_NAME_COUNT;
    return PLACE_NAMES[(value * PLACE_NAME_STRIDE + config.offset) % PLACE_NAME_COUNT];
  }

  function placeLabel(kind, seed) {
    const rank = String(kind || '').toLowerCase();
    const proper = placeName(rank, seed);
    if (rank === 'village') return proper + ' Village';
    return rank.charAt(0).toUpperCase() + rank.slice(1) + ' of ' + proper;
  }

  function integerInRange(value, min, max) {
    const n = Number(value);
    return Number.isInteger(n) && n >= min && n <= max ? n : null;
  }

  function villageCellSeed(i, j) {
    const row = integerInRange(i, CELL_I_MIN, CELL_I_MAX);
    const col = integerInRange(j, CELL_J_MIN, CELL_J_MAX);
    if (row === null || col === null) return null;
    return (1 + (row - CELL_I_MIN) * CELL_J_COUNT + (col - CELL_J_MIN)) >>> 0;
  }

  function waysteadBlockSeed(bi, bj) {
    const row = integerInRange(bi, BLOCK_I_MIN, BLOCK_I_MAX);
    const col = integerInRange(bj, BLOCK_J_MIN, BLOCK_J_MAX);
    if (row === null || col === null) return null;
    return (0x80000000 + 1 + (row - BLOCK_I_MIN) * BLOCK_J_COUNT + (col - BLOCK_J_MIN)) >>> 0;
  }

  // Kept only to recognise v223-and-earlier saves. New village identity never
  // uses this lossy 32-bit hash.
  function legacyHash32(text) {
    let h = 2166136261;
    const value = String(text || '');
    for (let i = 0; i < value.length; i++) {
      h ^= value.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function uint32Value(value) {
    const n = Number(value);
    return Number.isInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
  }

  function canonicalSeedForLegacyRecord(record, fallbackSeed) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return null;
    let oldSeed = uint32Value(record.seed);
    if (oldSeed === null) oldSeed = uint32Value(fallbackSeed);
    if (oldSeed === null) return null;
    const lat = Number(record.lat), lon = Number(record.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return oldSeed;
    const i = Math.floor(lat / VILLAGE_CELL_DEG), j = Math.floor(lon / VILLAGE_CELL_DEG);
    const legacyCell = legacyHash32('burbz-village:' + i + ':' + j);
    if (legacyCell === oldSeed && legacyCell % 100 < 34) return villageCellSeed(i, j) ?? oldSeed;
    const bi = Math.floor(i / 3), bj = Math.floor(j / 3);
    const legacyWaystead = legacyHash32('burbz-waystead:' + bi + ':' + bj);
    if (legacyWaystead === oldSeed) return waysteadBlockSeed(bi, bj) ?? oldSeed;
    return oldSeed;
  }

  // Heal a reference and return its old/new identity pair. Invalid rows are
  // ignored rather than folded onto seed zero.
  function migrateVillageReference(record, fallbackSeed, seedMap, migrateIdentity) {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return;
    let seed = uint32Value(record.seed);
    if (seed === null) seed = uint32Value(fallbackSeed);
    if (seed === null) return;
    const oldSeed = seed;
    // A legacy hash collision can leave an owned village and last/pending
    // village with the same old seed but different coordinates. Coordinate
    // evidence must win for each reference; the first owned mapping remains
    // the fallback for key-only records such as victories, roles and routes.
    const coordinateSeed = migrateIdentity ? canonicalSeedForLegacyRecord(record, fallbackSeed) : oldSeed;
    if (coordinateSeed !== null && coordinateSeed !== oldSeed) seed = coordinateSeed;
    else if (seedMap.has(oldSeed)) seed = seedMap.get(oldSeed);
    if (seed === null) return;
    if (!seedMap.has(oldSeed)) seedMap.set(oldSeed, seed);
    record.seed = seed;
    record.name = placeName('village', seed);
    return { oldSeed, seed };
  }

  function migrateVillageCollection(collection, seedMap, migrateIdentity) {
    if (!collection || typeof collection !== 'object') return;
    if (Array.isArray(collection)) {
      collection.forEach(record => migrateVillageReference(record, null, seedMap, migrateIdentity));
      return;
    }
    const next = {};
    Object.entries(collection).forEach(([key, record]) => {
      const migrated = migrateVillageReference(record, key, seedMap, migrateIdentity);
      const targetKey = migrated ? String(migrated.seed) : key;
      if (!Object.prototype.hasOwnProperty.call(next, targetKey)) next[targetKey] = record;
    });
    Object.keys(collection).forEach(key => { delete collection[key]; });
    Object.assign(collection, next);
  }

  function rekeyAssignments(table, seedMap) {
    if (!table || typeof table !== 'object' || Array.isArray(table)) return;
    const next = {};
    Object.entries(table).forEach(([key, value]) => {
      const oldSeed = uint32Value(key);
      const newSeed = oldSeed === null ? null : seedMap.get(oldSeed);
      const targetKey = newSeed === undefined || newSeed === null ? key : String(newSeed);
      if (!Object.prototype.hasOwnProperty.call(next, targetKey)) next[targetKey] = value;
    });
    Object.keys(table).forEach(key => { delete table[key]; });
    Object.assign(table, next);
  }

  function migrateTradeRoutes(routes, seedMap) {
    if (!routes || typeof routes !== 'object' || Array.isArray(routes)) return;
    const next = {};
    Object.entries(routes).forEach(([key, route]) => {
      if (!route || typeof route !== 'object' || Array.isArray(route)) { next[key] = route; return; }
      const oldA = uint32Value(route.a), oldB = uint32Value(route.b);
      if (oldA === null || oldB === null) { next[key] = route; return; }
      route.a = seedMap.get(oldA) ?? oldA;
      route.b = seedMap.get(oldB) ?? oldB;
      const newKey = tradeRouteKey(route.a, route.b);
      if (!Object.prototype.hasOwnProperty.call(next, newKey)) next[newKey] = route;
    });
    Object.keys(routes).forEach(key => { delete routes[key]; });
    Object.assign(routes, next);
  }

  /* In-place save migration. v2 replaces the old lossy coordinate hash with an
     injective world-cell identity and rekeys every known seed/region reference.
     Coordinates, timestamps, economies, routes, resources and progression
     contents are retained. Re-running it is byte-for-byte idempotent. */
  function migratePlaceNames(state) {
    if (!state || typeof state !== 'object' || Array.isArray(state)) return state;
    const migrateIdentity = (Number(state.placeNameVersion) || 0) < 2;
    const seedMap = new Map();
    const empire = state.empire;
    if (empire && typeof empire === 'object' && !Array.isArray(empire)) {
      migrateVillageCollection(empire.villages, seedMap, migrateIdentity);
      migrateVillageReference(empire.pendingLiberation, null, seedMap, migrateIdentity);
    }
    migrateVillageReference(state.lastVillage, null, seedMap, migrateIdentity);
    if (empire && typeof empire === 'object' && !Array.isArray(empire)) {
      migrateVillageCollection(empire.liberationVictories, seedMap, migrateIdentity);
      migrateTradeRoutes(empire.tradeRoutes, seedMap);
    }
    if (state.birdRoles && typeof state.birdRoles === 'object' && !Array.isArray(state.birdRoles)) {
      rekeyAssignments(state.birdRoles.villages, seedMap);
      rekeyAssignments(state.birdRoles.regions, seedMap);
    }
    if (state.knowledgeQuiz && typeof state.knowledgeQuiz === 'object') {
      const oldQuizSeed = uint32Value(state.knowledgeQuiz.lastVillageKey);
      if (oldQuizSeed !== null && seedMap.has(oldQuizSeed)) state.knowledgeQuiz.lastVillageKey = String(seedMap.get(oldQuizSeed));
    }
    state.placeNameVersion = PLACE_NAME_VERSION;
    return state;
  }

  // ---- Settlement tiers: village → town → city ------------------------------
  // The street-level layer BELOW regions. Liberate 3 neighbouring villages
  // (connected within SETTLEMENT_TOWN_RADIUS_KM) and those exact three grow
  // together into one TOWN; raise 3 neighbouring towns (squares connected
  // within SETTLEMENT_CITY_RADIUS_KM) and those exact three merge into one
  // CITY. Later claims never reshape an already-founded group. Merged districts
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

  function validVillageIdentity(v) {
    return validVillage(v) && uint32Value(v.seed) !== null;
  }

  function haversineKm(lat1, lon1, lat2, lon2) {
    const dLat = toRad(lat2) - toRad(lat1);
    const dLon = toRad(lon2) - toRad(lon1);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function claimTime(v) {
    // `liberatedAt` was the field name in a few early saves. Prefer the modern
    // claim timestamp, but replay those saves chronologically when possible.
    const t = Date.parse(v && (v.claimedAt || v.liberatedAt));
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }

  function seedNumber(v) {
    const seed = Number(v && v.seed);
    return Number.isFinite(seed) && seed >= 0 ? seed >>> 0 : 0;
  }

  /* A total order for replaying claims. Claim time is the game chronology;
     seed/coordinates/name make equal or missing timestamps deterministic even
     when callers hand us the same records in a different array order. */
  function chronologicalCompare(a, b) {
    const timeDiff = claimTime(a) - claimTime(b);
    if (timeDiff) return timeDiff;
    const seedDiff = seedNumber(a) - seedNumber(b);
    if (seedDiff) return seedDiff;
    const latDiff = Number(a && a.lat) - Number(b && b.lat);
    if (Number.isFinite(latDiff) && latDiff) return latDiff;
    const lonDiff = Number(a && a.lon) - Number(b && b.lon);
    if (Number.isFinite(lonDiff) && lonDiff) return lonDiff;
    return String(a && a.name || '').localeCompare(String(b && b.name || ''));
  }

  /* Chain villages into proximity clusters (union-find): any two villages
     within radiusKm join the same cluster, and chains extend it — a string of
     towns up a valley is one region even if its ends are far apart. */
  function clusterVillages(villages, radiusKm) {
    const claims = (Array.isArray(villages) ? villages : []).filter(validVillageIdentity);
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
    clusters.forEach(c => c.sort(chronologicalCompare));
    clusters.sort((a, b) => chronologicalCompare(a[0], b[0]));
    return clusters;
  }

  function uniqueChronologicalVillages(villages) {
    const ordered = (Array.isArray(villages) ? villages : [])
      .filter(validVillageIdentity)
      .slice()
      .sort(chronologicalCompare);
    const seen = new Set();
    return ordered.filter(v => {
      const key = String(seedNumber(v));
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function groupIsConnected(group, radiusKm) {
    const rows = Array.isArray(group) ? group : [];
    if (!rows.length) return false;
    if (rows.length === 1) return validVillageIdentity(rows[0]);
    return clusterVillages(rows, radiusKm).length === 1;
  }

  function groupDistanceKm(group) {
    let total = 0;
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        total += haversineKm(group[i].lat, group[i].lon, group[j].lat, group[j].lon);
      }
    }
    return total;
  }

  function compareIndexLists(a, b) {
    const length = Math.min(a.length, b.length);
    for (let i = 0; i < length; i++) {
      if (a[i] !== b[i]) return a[i] - b[i];
    }
    return a.length - b.length;
  }

  /* Choose one exact connected group from the currently-unassigned pool.
     Chronology wins first (the oldest possible heart keeps its claim), then
     spatial compactness chooses between rival groups around that heart, and a
     final member-order comparison removes any remaining ambiguity. */
  function bestExactGroup(pool, groupSize, radiusKm, requiredIndex) {
    const size = Math.max(2, Math.floor(Number(groupSize) || 3));
    if (!Array.isArray(pool) || pool.length < size) return null;
    let best = null;
    function considerIndices(indices, knownDistanceKm) {
      const members = indices.map(index => pool[index]).sort(chronologicalCompare);
      if (!Number.isFinite(knownDistanceKm) && !groupIsConnected(members, radiusKm)) return;
      const candidate = {
        indices: indices.slice(),
        members,
        heartIndex: indices[0],
        distanceKm: Number.isFinite(knownDistanceKm) ? knownDistanceKm : groupDistanceKm(members)
      };
      if (!best || candidate.heartIndex < best.heartIndex ||
          (candidate.heartIndex === best.heartIndex && candidate.distanceKm < best.distanceKm - 1e-9) ||
          (candidate.heartIndex === best.heartIndex && Math.abs(candidate.distanceKm - best.distanceKm) <= 1e-9 &&
           compareIndexLists(candidate.indices, best.indices) < 0)) best = candidate;
    }

    const mustInclude = Number.isInteger(requiredIndex) && requiredIndex >= 0 && requiredIndex < pool.length
      ? requiredIndex : null;
    // The game makes trios. Because deriveExactGroups maintains a pool with no
    // previously eligible trio, every newly eligible trio contains the latest
    // claim. Search its local graph rather than all world-wide combinations.
    if (size === 3 && mustInclude !== null) {
      const radius = Math.max(1, Number(radiusKm) || REGION_RADIUS_KM);
      const neighbourDistance = new Map();
      for (let i = 0; i < pool.length; i++) {
        if (i === mustInclude) continue;
        const distance = haversineKm(pool[i].lat, pool[i].lon, pool[mustInclude].lat, pool[mustInclude].lon);
        if (distance <= radius) neighbourDistance.set(i, distance);
      }
      const neighbours = Array.from(neighbourDistance.keys());
      const considered = new Set();
      function considerPair(i, j) {
        const indices = [i, j, mustInclude].sort((a, b) => a - b);
        const key = indices[0] + ':' + indices[1] + ':' + indices[2];
        if (considered.has(key)) return;
        considered.add(key);
        const iRequired = neighbourDistance.get(i);
        const jRequired = neighbourDistance.get(j);
        const between = haversineKm(pool[i].lat, pool[i].lon, pool[j].lat, pool[j].lon);
        // At least one endpoint is a neighbour of the required claim. If only
        // one is, the other endpoint must join through it.
        if (iRequired === undefined && (jRequired === undefined || between > radius)) return;
        if (jRequired === undefined && (iRequired === undefined || between > radius)) return;
        considerIndices(indices,
          (iRequired === undefined ? haversineKm(pool[i].lat, pool[i].lon, pool[mustInclude].lat, pool[mustInclude].lon) : iRequired) +
          (jRequired === undefined ? haversineKm(pool[j].lat, pool[j].lon, pool[mustInclude].lat, pool[mustInclude].lon) : jRequired) +
          between);
      }
      // Any two neighbours are connected through the required claim.
      for (let a = 0; a < neighbours.length; a++) {
        for (let b = a + 1; b < neighbours.length; b++) considerPair(neighbours[a], neighbours[b]);
      }
      // One neighbour can also connect a non-neighbour through an old edge.
      neighbours.forEach(i => {
        for (let j = 0; j < pool.length; j++) {
          if (j === i || j === mustInclude || neighbourDistance.has(j)) continue;
          considerPair(i, j);
        }
      });
      return best;
    }

    const picked = [];
    function consider(start) {
      const targetSize = mustInclude === null ? size : size - 1;
      if (picked.length === targetSize) {
        const indices = mustInclude === null ? picked.slice() : picked.concat(mustInclude).sort((a, b) => a - b);
        considerIndices(indices, NaN);
        return;
      }
      for (let i = start; i < pool.length; i++) {
        if (i === mustInclude) continue;
        let available = 0;
        for (let j = i; j < pool.length; j++) if (j !== mustInclude) available++;
        if (available < targetSize - picked.length) break;
        picked.push(i);
        consider(i + 1);
        picked.pop();
      }
    }
    consider(0);
    return best;
  }

  /* Replay claims in chronological order and permanently consume exact groups.
     A later bridge claim can connect two old components, but trios already
     removed from the pool cannot be reshuffled. The same history therefore
     always yields the same stable towns and cities without stored derivation. */
  function deriveExactGroups(items, radiusKm, groupSize) {
    const ordered = (Array.isArray(items) ? items : [])
      .filter(validVillageIdentity)
      .slice()
      .sort(chronologicalCompare);
    const pool = [];
    const groups = [];
    ordered.forEach(item => {
      pool.push(item);
      const match = bestExactGroup(pool, groupSize, radiusKm, pool.length - 1);
      if (!match) return;
      groups.push(match.members);
      match.indices.slice().sort((a, b) => b - a).forEach(index => pool.splice(index, 1));
    });
    return { groups, unassigned: pool.slice().sort(chronologicalCompare) };
  }

  function largestProximityCluster(items, radiusKm) {
    return clusterVillages(items, radiusKm).reduce((best, cluster) => Math.max(best, cluster.length), 0);
  }

  /* Replay signed merge charters over a pool of points (villages, or town
     market squares). Since merge-when-ready-v290 the player signs every
     merge; formation replays the charters instead of consuming trios
     automatically. Charters are history: order preserved, each seed bound at
     most once, and a charter whose members are not all present simply sleeps
     until they are. Charters may hold more than `minSize` seeds so pre-v290
     automatic formations survive as signed history. */
  function replayCharters(pool, charters, minSize) {
    const size = Math.max(2, Math.floor(Number(minSize) || 3));
    const bySeed = new Map(pool.map(p => [String(seedNumber(p)), p]));
    const consumed = new Set();
    const groups = [];
    (Array.isArray(charters) ? charters : []).forEach(row => {
      if (!row || typeof row !== 'object' || Array.isArray(row)) return;
      const seeds = [];
      (Array.isArray(row.seeds) ? row.seeds : []).forEach(value => {
        const seed = uint32Value(value);
        if (seed !== null && !seeds.includes(seed)) seeds.push(seed);
      });
      if (seeds.length < size) return;
      const members = [];
      for (const seed of seeds) {
        const key = String(seed);
        if (consumed.has(key) || !bySeed.has(key)) return;
        members.push(bySeed.get(key));
      }
      seeds.forEach(seed => consumed.add(String(seed)));
      members.sort(chronologicalCompare);
      groups.push({ members, mergedAt: typeof row.mergedAt === 'string' ? row.mergedAt : '' });
    });
    const unassigned = pool.filter(p => !consumed.has(String(seedNumber(p)))).sort(chronologicalCompare);
    return { groups, unassigned };
  }

  /* Every region on the ground is a COUNTY, whatever its size — the higher
     tiers are made of counties, not of village counts. */
  function regionTier() { return COUNTY_TIER; }

  /* The unity tax bonus a county's villages actually enjoy: the base county
     bonus, raised by the county's liege chain (annotated by realmFromRegions:
     liegeTier is 'county', 'duchy', 'kingdom' or 'empire'). */
  function regionUnityBonus(region) {
    const tier = region && region.liegeTier;
    return (tier && LIEGE_TAX_BONUS[tier]) || REGION_TAX_BONUS;
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

  /* The heart of the endgame: founded towns → counties. A county's capital is
     its earliest-founded town, represented to legacy economy/trade callers by
     that town's heart village. `villages` stays flattened and `villageCount`
     stays the underlying sanctuary count; county formation now counts Towns.
     The id remains the capital heart seed for deterministic existing saves. */
  function deriveRegions(villages, options) {
    const opts = options || {};
    const radiusKm = Number(opts.radiusKm) || REGION_RADIUS_KM;
    const legacyMin = opts.minTowns !== undefined ? opts.minTowns : opts.minVillages;
    const minTowns = Math.max(2, Math.floor(Number(legacyMin) || REGION_MIN_TOWNS));
    const settlementOptions = Object.assign({}, opts.settlementOptions || {});
    if (opts.townRadiusKm !== undefined) settlementOptions.townRadiusKm = opts.townRadiusKm;
    if (opts.cityRadiusKm !== undefined) settlementOptions.cityRadiusKm = opts.cityRadiusKm;
    if (opts.townCharters !== undefined) settlementOptions.townCharters = opts.townCharters;
    if (opts.cityCharters !== undefined) settlementOptions.cityCharters = opts.cityCharters;
    const settlements = deriveSettlements(villages, settlementOptions);
    const townPoints = settlements.towns.map(town => ({
      seed: town.heartSeed,
      name: town.name,
      lat: town.centroid.lat,
      lon: town.centroid.lon,
      claimedAt: town.foundedAt,
      town
    }));
    const clusters = clusterVillages(townPoints, radiusKm);
    const regions = [];
    const unassignedTowns = [];
    // Player-signed region charters replace automatic county formation when
    // provided, exactly as town charters do in deriveSettlements.
    const manualRegions = opts.regionCharters !== undefined && opts.regionCharters !== null;
    let regionGroups;
    if (manualRegions) {
      const replay = replayCharters(townPoints, opts.regionCharters, minTowns);
      regionGroups = replay.groups.map(g => ({ points: g.members, mergedAt: g.mergedAt }));
      replay.unassigned.forEach(point => { if (point.town) unassignedTowns.push(point.town); });
    } else {
      regionGroups = clusters.map(cluster => ({ points: cluster, mergedAt: '' }));
    }
    regionGroups.forEach(({ points, mergedAt }) => {
      const towns = points.map(point => point.town).filter(Boolean);
      if (towns.length < minTowns) { if (!manualRegions) unassignedTowns.push(...towns); return; }
      const capitalTown = towns[0];
      const capital = capitalTown.villages.find(v => seedNumber(v) === capitalTown.heartSeed) || capitalTown.villages[0];
      const otherVillages = towns.reduce((all, town) => all.concat(town.villages), [])
        .filter(v => v !== capital)
        .sort(chronologicalCompare);
      // Several old economy, trade and map paths treat villages[0] as capital.
      const regionVillages = [capital].concat(otherVillages);
      const capitalSeed = capitalTown.heartSeed;
      const properName = placeName('county', capitalSeed);
      regions.push({
        id: String(capitalSeed),
        capitalSeed,
        capitalName: String(capital.name || capitalTown.name || 'Sanctuary'),
        properName,
        name: placeLabel('county', capitalSeed),
        tier: COUNTY_TIER.rank,
        tierLabel: COUNTY_TIER.label,
        tierIcon: COUNTY_TIER.icon,
        townCount: towns.length,
        towns,
        villageCount: regionVillages.length,
        villages: regionVillages,
        centroid: centroidOf(regionVillages),
        foundedAt: mergedAt || towns[minTowns - 1].foundedAt || capitalTown.foundedAt || '',
        duchyId: null,
        kingdomId: null,
        liegeTier: 'county'
      });
    });
    // Preserve the historical raw-village field: loose villages and every
    // town not yet inside a county remain unassigned at the realm layer.
    const assignedSeeds = new Set();
    regions.forEach(region => region.villages.forEach(v => assignedSeeds.add(String(seedNumber(v)))));
    const unassigned = uniqueChronologicalVillages(villages)
      .filter(v => !assignedSeeds.has(String(seedNumber(v))));
    // Progress hint now reports the best Town cluster toward a County.
    const largestCluster = clusters.reduce((best, c) => Math.max(best, c.length), 0);
    return {
      regions,
      unassigned,
      unassignedTowns,
      largestCluster,
      clusterCount: clusters.length,
      settlements
    };
  }

  /* Nest the counties into the full feudal pyramid — the simplified Crusader
     Kings ladder where every title CONTAINS the tier below it. Reuses the
     same union-find chaining as counties, but over county capitals (for
     duchies) and duchy seats (for kingdoms). The earliest-founded member still
     anchors each title's stable seed and seat, while each rank receives its own
     generated proper name. The counties passed in are annotated in place
     (duchyId / kingdomId / liegeTier) so the economy and UI can read the liege
     chain straight off the region. */
  function realmFromRegions(regions) {
    const counties = Array.isArray(regions) ? regions.filter(Boolean) : [];
    counties.forEach(c => { c.duchyId = null; c.kingdomId = null; c.liegeTier = 'county'; });
    const capitalOf = c => (c.villages && c.villages[0]) || c.centroid || {};
    const countyBySeed = new Map(counties.map(c => [String(Number(c.capitalSeed) >>> 0), c]));
    const duchies = [];
    const capitalPoints = counties.map(c => {
      const cap = capitalOf(c);
      return { seed: c.capitalSeed, name: c.capitalName, lat: cap.lat, lon: cap.lon, claimedAt: cap.claimedAt };
    });
    clusterVillages(capitalPoints, DUCHY_RADIUS_KM).forEach(cluster => {
      if (cluster.length < DUCHY_MIN_COUNTIES) return;
      const members = cluster.map(p => countyBySeed.get(String(Number(p.seed) >>> 0))).filter(Boolean);
      if (members.length < DUCHY_MIN_COUNTIES) return;
      const seat = members[0];
      const allVillages = members.reduce((all, c) => all.concat(c.villages || []), []);
      const duchy = {
        id: 'duchy-' + (Number(seat.capitalSeed) >>> 0),
        tier: 'duchy', tierLabel: 'Duchy', tierIcon: '🏰',
        properName: placeName('duchy', seat.capitalSeed),
        name: placeLabel('duchy', seat.capitalSeed),
        seatName: seat.capitalName,
        seatSeed: Number(seat.capitalSeed) >>> 0,
        countyCount: members.length,
        counties: members,
        villageCount: allVillages.length,
        villages: allVillages,
        centroid: centroidOf(allVillages),
        foundedAt: cluster[DUCHY_MIN_COUNTIES - 1].claimedAt || '',
        kingdomId: null
      };
      members.forEach(c => { c.duchyId = duchy.id; c.liegeTier = 'duchy'; });
      duchies.push(duchy);
    });
    const duchyBySeed = new Map(duchies.map(d => [String(d.seatSeed), d]));
    const kingdoms = [];
    const seatPoints = duchies.map(d => {
      const cap = capitalOf(d.counties[0]);
      return { seed: d.seatSeed, name: d.seatName, lat: cap.lat, lon: cap.lon, claimedAt: d.foundedAt };
    });
    clusterVillages(seatPoints, KINGDOM_RADIUS_KM).forEach(cluster => {
      if (cluster.length < KINGDOM_MIN_DUCHIES) return;
      const members = cluster.map(p => duchyBySeed.get(String(Number(p.seed) >>> 0))).filter(Boolean);
      if (members.length < KINGDOM_MIN_DUCHIES) return;
      const seat = members[0];
      const allVillages = members.reduce((all, d) => all.concat(d.villages), []);
      const kingdom = {
        id: 'kingdom-' + seat.seatSeed,
        tier: 'kingdom', tierLabel: 'Kingdom', tierIcon: '👑',
        properName: placeName('kingdom', seat.seatSeed),
        name: placeLabel('kingdom', seat.seatSeed),
        seatName: seat.seatName,
        seatSeed: seat.seatSeed,
        duchyCount: members.length,
        duchies: members,
        countyCount: members.reduce((sum, d) => sum + d.countyCount, 0),
        villageCount: allVillages.length,
        villages: allVillages,
        centroid: centroidOf(allVillages),
        foundedAt: cluster[KINGDOM_MIN_DUCHIES - 1].claimedAt || ''
      };
      members.forEach(d => {
        d.kingdomId = kingdom.id;
        d.counties.forEach(c => { c.kingdomId = kingdom.id; c.liegeTier = 'kingdom'; });
      });
      kingdoms.push(kingdom);
    });
    let empire = null;
    if (kingdoms.length >= EMPIRE_MIN_KINGDOMS) {
      empire = {
        tier: 'empire', tierLabel: 'Empire', tierIcon: '☀️',
        name: EMPIRE_NAME,
        kingdomCount: kingdoms.length,
        kingdoms,
        villageCount: kingdoms.reduce((sum, k) => sum + k.villageCount, 0)
      };
      kingdoms.forEach(k => k.duchies.forEach(d => d.counties.forEach(c => { c.liegeTier = 'empire'; })));
    }
    return { duchies, kingdoms, empire };
  }

  /* One call for the whole realm: exact Towns from villages, counties from
     Towns, then the nested duchy/kingdom/empire pyramid on top. Existing realm
     fields stay in place; settlement and Town progress are additive. */
  function deriveRealm(villages, options) {
    const base = deriveRegions(villages, options);
    const pyramid = realmFromRegions(base.regions);
    return {
      regions: base.regions,
      unassigned: base.unassigned,
      unassignedTowns: base.unassignedTowns,
      largestCluster: base.largestCluster,
      clusterCount: base.clusterCount,
      settlements: base.settlements,
      duchies: pyramid.duchies,
      kingdoms: pyramid.kingdoms,
      empire: pyramid.empire
    };
  }

  /* Settlement growth: liberated villages → exact towns → exact cities.
     Formation is replayed chronologically. As soon as an eligible trio exists,
     those members are permanently consumed from the unassigned pool. This is
     the stability guarantee: a fourth village, or a later bridge between old
     clusters, cannot redraw an established Town. Rank-specific proper names
     still come from the earliest member's seed. Towns that join a City remain
     its boroughs; tierBySeed maps consumed villages to the top settlement. */
  function deriveSettlements(villages, options) {
    const opts = options || {};
    const townRadiusKm = Number(opts.townRadiusKm) || SETTLEMENT_TOWN_RADIUS_KM;
    const cityRadiusKm = Number(opts.cityRadiusKm) || SETTLEMENT_CITY_RADIUS_KM;
    // Historical option names remain supported for pure-core fixtures; in the
    // live game both constants are exactly three.
    const villagesPerTown = Math.max(2, Math.floor(Number(opts.minVillages) || SETTLEMENT_TOWN_MIN_VILLAGES));
    const townsPerCity = Math.max(2, Math.floor(Number(opts.minTowns) || SETTLEMENT_CITY_MIN_TOWNS));
    const claims = uniqueChronologicalVillages(villages);
    // Player-signed charters replace automatic trio formation when provided.
    // An empty charter list means "manual merging, nothing signed yet" — no
    // town forms on its own. Leaving the option out keeps the pre-v290
    // automatic behaviour for older callers and fixtures.
    const manualTowns = opts.townCharters !== undefined && opts.townCharters !== null;
    let townGrouping;
    let townMergedAts = null;
    if (manualTowns) {
      const replay = replayCharters(claims, opts.townCharters, villagesPerTown);
      townGrouping = { groups: replay.groups.map(g => g.members), unassigned: replay.unassigned };
      townMergedAts = replay.groups.map(g => g.mergedAt);
    } else {
      townGrouping = deriveExactGroups(claims, townRadiusKm, villagesPerTown);
    }
    const towns = townGrouping.groups.map((group, index) => {
      const heart = group[0];
      const heartSeed = Number(heart.seed) >>> 0;
      const properName = placeName('town', heartSeed);
      return {
        id: 'town-' + heartSeed,
        tier: 'town',
        heartSeed,
        heartName: String(heart.name || 'Freehold'),
        properName,
        name: properName,
        label: placeLabel('town', heartSeed),
        icon: SETTLEMENT_TIERS.town.icon,
        villageCount: group.length,
        villages: group,
        centroid: centroidOf(group),
        foundedAt: (townMergedAts && townMergedAts[index]) ||
          group[villagesPerTown - 1].claimedAt || group[villagesPerTown - 1].liberatedAt ||
          heart.claimedAt || heart.liberatedAt || '',
        cityId: null
      };
    });

    // Market-square points let the same chronological engine consume exactly
    // three Towns at a time. A fourth nearby Town remains standalone.
    const townPoints = towns.map(town => ({
      seed: town.heartSeed,
      name: town.name,
      lat: town.centroid.lat,
      lon: town.centroid.lon,
      claimedAt: town.foundedAt,
      town
    }));
    const manualCities = opts.cityCharters !== undefined && opts.cityCharters !== null;
    let cityGrouping;
    let cityMergedAts = null;
    if (manualCities) {
      const replay = replayCharters(townPoints, opts.cityCharters, townsPerCity);
      cityGrouping = { groups: replay.groups.map(g => g.members), unassigned: replay.unassigned };
      cityMergedAts = replay.groups.map(g => g.mergedAt);
    } else {
      cityGrouping = deriveExactGroups(townPoints, cityRadiusKm, townsPerCity);
    }
    const cities = cityGrouping.groups.map((group, index) => {
      const members = group.map(point => point.town);
      const heartTown = members[0];
      const cityVillages = members.reduce((all, t) => all.concat(t.villages), []).sort(chronologicalCompare);
      const properName = placeName('city', heartTown.heartSeed);
      const city = {
        id: 'city-' + heartTown.heartSeed,
        tier: 'city',
        heartSeed: heartTown.heartSeed,
        heartName: heartTown.heartName,
        properName,
        name: properName,
        label: placeLabel('city', heartTown.heartSeed),
        icon: SETTLEMENT_TIERS.city.icon,
        townCount: members.length,
        towns: members,
        villageCount: cityVillages.length,
        villages: cityVillages,
        centroid: centroidOf(cityVillages),
        foundedAt: (cityMergedAts && cityMergedAts[index]) ||
          group[townsPerCity - 1].claimedAt || heartTown.foundedAt || ''
      };
      members.forEach(t => { t.cityId = city.id; });
      return city;
    });
    // Every liberated village knows what it now belongs to.
    const tierBySeed = {};
    const cityById = new Map(cities.map(city => [city.id, city]));
    towns.forEach(town => {
      const s = town.cityId ? cityById.get(town.cityId) : town;
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

    const unassignedVillages = townGrouping.unassigned;
    const standaloneTowns = towns.filter(town => !town.cityId);
    return {
      towns,
      cities,
      tierBySeed,
      townCount: towns.length,
      cityCount: cities.length,
      largestVillageCluster: largestProximityCluster(unassignedVillages, townRadiusKm),
      largestTownCluster: largestProximityCluster(cityGrouping.unassigned, cityRadiusKm),
      // `unassigned` remains a friendly alias; explicit names distinguish the
      // two formation stages for newer callers.
      unassigned: unassignedVillages,
      unassignedVillages,
      standaloneTowns
    };
  }

  /* Crown ladder — the player's realm-wide style is the highest title they
     actually hold on the nested ladder, exactly as in Crusader Kings:
     Count of a county, Duke once counties unite, Monarch once duchies unite,
     Emperor of the Liberated Skies once two kingdoms stand. */
  function crownTitle(regions) {
    const list = Array.isArray(regions) ? regions.filter(Boolean) : [];
    if (!list.length) return null;
    const pyramid = realmFromRegions(list);
    if (pyramid.empire) return 'Emperor of the Liberated Skies';
    if (pyramid.kingdoms.length) return 'Monarch of ' + pyramid.kingdoms[0].properName;
    if (pyramid.duchies.length) return 'Duke of ' + pyramid.duchies[0].properName;
    const best = list.slice().sort((a, b) => (b.villageCount || 0) - (a.villageCount || 0) || claimTime(a.villages && a.villages[0]) - claimTime(b.villages && b.villages[0]))[0];
    return 'Count of ' + (best.properName || placeName('county', best.capitalSeed));
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

  // ---- Painted realm territory: Crusader-Kings colours on the atlas --------
  // Once counties swear to a duchy or better, the atlas paints each county's
  // lands in its realm's own colour — one hue per liege, like a Crusader
  // Kings map. Everything here is pure maths so it can run under Node.

  /* One deterministic heraldic colour per liege seat. Golden-angle hues keep
     neighbouring realms visually distinct without a stored palette. */
  function realmSeatTint(seed) {
    const s = Number(seed) >>> 0;
    const hue = Math.round((s * 137.508) % 360);
    return {
      hue,
      fill: 'hsl(' + hue + ', 58%, 52%)',
      border: 'hsl(' + hue + ', 62%, 30%)'
    };
  }

  /* An organic border around a county's villages: sample a ring of points
     paddingKm out from every village, then wrap a convex hull around the lot.
     Works in a local planar frame about the centroid (longitudes unwrapped),
     so a county straddling the dateline still gets one sane shape. Returns a
     closed [lon, lat] ring, or null when there is nothing to wrap. */
  function territoryHullRing(villages, paddingKm, samplesPerVillage) {
    const claims = (Array.isArray(villages) ? villages : []).filter(validVillage);
    if (!claims.length) return null;
    const pad = Math.max(0.5, Number(paddingKm) || 2);
    const samples = Math.max(6, Math.min(24, Math.round(Number(samplesPerVillage) || 12)));
    const centre = centroidOf(claims);
    const kmPerLat = Math.PI * EARTH_RADIUS_KM / 180;
    const kmPerLon = kmPerLat * Math.max(0.05, Math.cos(toRad(centre.lat)));
    const points = [];
    claims.forEach(v => {
      let lon = Number(v.lon);
      lon += 360 * Math.round((centre.lon - lon) / 360); // same 360° branch as the centre
      const x = (lon - centre.lon) * kmPerLon;
      const y = (Number(v.lat) - centre.lat) * kmPerLat;
      for (let i = 0; i < samples; i++) {
        const a = (i / samples) * Math.PI * 2;
        points.push([x + Math.cos(a) * pad, y + Math.sin(a) * pad]);
      }
    });
    // Andrew's monotone-chain convex hull.
    points.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    points.forEach(p => {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    });
    const upper = [];
    for (let i = points.length - 1; i >= 0; i--) {
      const p = points[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    if (hull.length < 3) return null;
    const ring = hull.map(([x, y]) => [centre.lon + x / kmPerLon, centre.lat + y / kmPerLat]);
    ring.push(ring[0].slice());
    return ring;
  }

  /* GeoJSON for the painted realm: one polygon per county that answers to a
     duchy or better, coloured by its TOP liege's seat — every county of one
     kingdom wears the kingdom's colour, a lone duchy wears its own. Counties
     still standing alone stay unpainted: the colours are the reward for
     uniting several counties into a realm. */
  function realmTerritoryFeatureCollection(realm, options) {
    const opts = options || {};
    const counties = realm && Array.isArray(realm.regions) ? realm.regions : [];
    const duchies = realm && Array.isArray(realm.duchies) ? realm.duchies : [];
    const kingdoms = realm && Array.isArray(realm.kingdoms) ? realm.kingdoms : [];
    const features = [];
    counties.forEach(county => {
      if (!county || !county.duchyId) return;
      const kingdom = county.kingdomId ? kingdoms.find(k => k.id === county.kingdomId) : null;
      const duchy = duchies.find(d => d.id === county.duchyId) || null;
      const liege = kingdom || duchy;
      if (!liege) return;
      const ring = territoryHullRing(county.villages, opts.paddingKm || 2, opts.samplesPerVillage);
      if (!ring) return;
      const tint = realmSeatTint(liege.seatSeed);
      features.push({
        type: 'Feature',
        properties: {
          id: String(county.id),
          name: String(county.name || ''),
          liegeId: String(liege.id),
          liegeName: String(liege.name || ''),
          liegeTier: String(liege.tier || ''),
          color: tint.fill,
          border: tint.border
        },
        geometry: { type: 'Polygon', coordinates: [ring] }
      });
    });
    return { type: 'FeatureCollection', features };
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
    PLACE_NAME_VERSION,
    PLACE_NAMES,
    placeName,
    placeLabel,
    villageCellSeed,
    waysteadBlockSeed,
    migratePlaceNames,
    EARTH_RADIUS_KM,
    REGION_RADIUS_KM,
    REGION_MIN_TOWNS,
    REGION_MIN_VILLAGES,
    REGION_TAX_BONUS,
    COUNTY_TIER,
    DUCHY_RADIUS_KM,
    DUCHY_MIN_COUNTIES,
    KINGDOM_RADIUS_KM,
    KINGDOM_MIN_DUCHIES,
    EMPIRE_MIN_KINGDOMS,
    EMPIRE_NAME,
    LIEGE_TAX_BONUS,
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
    validVillageIdentity,
    haversineKm,
    clusterVillages,
    chronologicalCompare,
    deriveExactGroups,
    replayCharters,
    regionTier,
    regionUnityBonus,
    regionCoverageRadiusKm,
    centroidOf,
    deriveRegions,
    realmFromRegions,
    deriveRealm,
    crownTitle,
    tradeRouteKey,
    tradeRouteCandidates,
    tradeRouteCost,
    tradeRouteIncome,
    tradeRouteGoods,
    greatCircleArc,
    tradeRouteFeatureCollection,
    realmSeatTint,
    territoryHullRing,
    realmTerritoryFeatureCollection
  };
});
