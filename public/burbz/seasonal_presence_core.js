/* Burbz seasonal and geographic presence core.
 *
 * A bird only exists where and when it exists. The Kingdom of Burbz is drawn
 * on the player's real map, so a Swift hawking over a Cheshire street in
 * January is a lie the game should not tell: British Swifts are in the Congo
 * basin in January. Same for a Fieldfare in July, a Cuckoo in November, or a
 * Puffin on a cliff in December when the whole colony is out on the Atlantic.
 *
 * The date comes from the device clock — the phone in the player's hand — and
 * the position from the same geolocation fix the live map already holds. No
 * extra permission, no network call, no server clock that might be in another
 * timezone.
 *
 * The regional expansions (UK50, UK26, UK_FINAL, UK4, AU50, NATIONAL) already
 * carry month and range rules for the species they own. This core covers the
 * ones nothing owned: the legacy WILD_BIRDS / REGION_AREA_SPECIES roster, which
 * until now was eligible every month of the year in every part of its region.
 *
 * It fails OPEN for any name it does not know, so it layers on top of the
 * expansions instead of fighting them, and never silently empties a habitat
 * pool for a species someone else already vouched for.
 *
 * Sources for the windows below: BTO BirdFacts arrival/departure and seasonal
 * occurrence summaries, RSPB "when to see" guidance, and — for the Australian
 * roster — BirdLife Australia seasonal movement notes.
 */
(function (root, factory) {
  const core = factory();
  if (typeof module === 'object' && module.exports) module.exports = core;
  if (root) root.BurbzSeasonalPresenceCore = core;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ALL_MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'];

  // Coarse British envelopes, drawn per species below rather than borrowed from
  // the UK expansion — these have to hold Orkney and Shetland (Golden Eagle,
  // Red Grouse) and the Solent (White-tailed Eagle), which its boxes do not.
  const SCOTLAND = { latMin: 55.5, latMax: 61, lonMin: -8, lonMax: -0.5 };
  const NORTH_AND_WEST = { latMin: 51, latMax: 61, lonMin: -9, lonMax: -1 };
  const SOUTH = { latMin: 49, latMax: 54, lonMin: -6, lonMax: 3 };
  const SOUTH_EAST = { latMin: 50, latMax: 53.5, lonMin: -1.6, lonMax: 2 };
  const WEST_SCOTLAND_AND_SOLENT = [
    { latMin: 55.5, latMax: 59.5, lonMin: -8, lonMax: -4 },
    { latMin: 50.4, latMax: 51.1, lonMin: -1.8, lonMax: -0.9 }
  ];

  // South-eastern Australia, where the game's Australian roster lives. The
  // trans-equatorial and inland-breeding migrants below are absent from it for
  // the southern winter.
  const AU = { latMin: -45, latMax: -9, lonMin: 112, lonMax: 154 };

  const STATUS_LABELS = {
    resident: 'Resident',
    summer_visitor: 'Summer visitor',
    winter_visitor: 'Winter visitor',
    breeding_season: 'Breeding season only',
    irruptive: 'Irruptive visitor'
  };

  function occurrence(status, months, options) {
    const opts = options || {};
    return {
      status,
      months: months && months.length ? months.slice() : ALL_MONTHS.slice(),
      bounds: opts.bounds || null,
      habitats: opts.habitats || null,
      note: opts.note || ''
    };
  }

  const summer = (months, note, opts) => occurrence('summer_visitor', months, { ...(opts || {}), note });
  const winter = (months, note, opts) => occurrence('winter_visitor', months, { ...(opts || {}), note });
  const ashore = (months, note, opts) => occurrence('breeding_season', months, { ...(opts || {}), note });
  const irruptive = (months, note, opts) => occurrence('irruptive', months, { ...(opts || {}), note });
  const resident = (note, opts) => occurrence('resident', ALL_MONTHS, { ...(opts || {}), note });

  // Habitat qualifiers, for windows where "here" means a particular kind of
  // place and not just a part of the country.
  const SEABIRD = { habitats: ['coast', 'water'] };
  const MOORLAND = { habitats: ['hills', 'grassland'] };
  const FAST_RIVER = { habitats: ['water'] };

  const APR_SEP = [4, 5, 6, 7, 8, 9];
  const APR_AUG = [4, 5, 6, 7, 8];
  const MAR_OCT = [3, 4, 5, 6, 7, 8, 9, 10];
  const OCT_MAR = [10, 11, 12, 1, 2, 3];
  const SEP_APR = [9, 10, 11, 12, 1, 2, 3, 4];

  // ---------------------------------------------------------------------
  // British roster.
  // ---------------------------------------------------------------------
  const UK_PRESENCE = {
    // --- Summer visitors: in Africa for the British winter ---------------
    'Swift': [summer([5, 6, 7, 8], 'Swifts are here for barely three months. They arrive at the very end of April and most have gone by mid-August, back to central Africa where they stay airborne for the rest of the year.')],
    'Swallow': [summer(MAR_OCT, 'Swallows arrive from South Africa in late March and are gone by October.')],
    'House Martin': [summer([4, 5, 6, 7, 8, 9, 10], 'House Martins nest under British eaves from April to October, then head for Africa.')],
    'Sand Martin': [summer([3, 4, 5, 6, 7, 8, 9], 'Sand Martins are the first hirundine back — often in March — and the first to leave.')],
    'Cuckoo': [summer([4, 5, 6, 7], 'A famous short stay: adult Cuckoos arrive in April and many are heading back to the Congo by the end of June.')],
    'Willow Warbler': [summer(APR_SEP, 'Willow Warblers pour in during April and leave through September.')],
    'Common Redstart': [summer(APR_SEP, 'A summer visitor to western and northern woods, wintering in the Sahel.')],
    'Pied Flycatcher': [summer(APR_AUG, 'Pied Flycatchers hold western oak woods from April, and are gone by the end of August.')],
    'Spotted Flycatcher': [summer([5, 6, 7, 8, 9], 'One of the last migrants to arrive — rarely before May — and away again by September.')],
    'Tree Pipit': [summer(APR_AUG, 'A summer visitor to heath and woodland edge, wintering in Africa.')],
    'Sedge Warbler': [summer(APR_SEP, 'Sedge Warblers sing from reedbeds April to September, then cross the Sahara in one flight.')],
    'Reed Warbler': [summer(APR_SEP, 'A summer reedbed warbler, wintering in West Africa.')],
    'Garden Warbler': [summer(APR_SEP, 'A skulking summer warbler, in Africa for the winter.')],
    'Common Whitethroat': [summer(APR_SEP, 'Whitethroats scratch out their song from scrub April to September.')],
    'Greater Whitethroat': [summer(APR_SEP, 'Whitethroats scratch out their song from scrub April to September.')],
    'Common Nightingale': [summer(APR_AUG, 'Nightingales sing in south-eastern scrub from mid-April, and are silent and gone by August.')],
    'Turtle Dove': [summer([5, 6, 7, 8, 9], 'Britain\'s only migratory dove, and now one of its scarcest birds. Here May to September.')],
    'Yellow Wagtail': [summer(APR_SEP, 'A summer wagtail of damp farmland, wintering in Africa.')],
    'Common Quail': [summer([5, 6, 7, 8], 'Quail are heard far more than seen, and only in high summer.')],
    'Little Ringed Plover': [summer([3, 4, 5, 6, 7, 8, 9], 'A summer visitor to gravel pits and shingle, unlike the resident Ringed Plover.')],
    'Northern Wheatear': [summer(MAR_OCT, 'Among the earliest migrants back — often on open ground in March — and away by October.')],
    'Osprey': [summer([3, 4, 5, 6, 7, 8, 9], 'Ospreys return to their nests in late March and are back in West Africa by October.')],
    'Common Tern': [summer(APR_SEP, 'Terns hold British coasts and gravel pits April to September.')],
    'Common Sandpiper': [summer(MAR_OCT, 'Breeds by northern and western rivers in summer; only a handful stay through a British winter.')],

    // --- Winter visitors: here from the Arctic and the near Continent -----
    'Redwing': [winter(OCT_MAR, 'Redwings arrive from Iceland and Scandinavia in October and are gone by early spring.')],
    'Fieldfare': [winter(OCT_MAR, 'Fieldfares come south for the winter berry crop and leave again in March.')],
    'Brambling': [winter(OCT_MAR, 'A winter finch from northern forests, often mixed in with Chaffinch flocks.')],
    'Bohemian Waxwing': [irruptive([11, 12, 1, 2, 3], 'Waxwings only reach Britain when the Scandinavian rowan crop fails — a winter irruption, and never a summer bird.')],
    'Pink-footed Goose': [winter(SEP_APR, 'Pink-feet arrive from Iceland and Greenland in September and leave in April.')],
    'Brent Goose': [winter(OCT_MAR, 'Brent Geese winter on British estuaries and breed in the high Arctic.')],
    'Barnacle Goose': [winter(SEP_APR, 'Wild Barnacle Geese winter from Svalbard and Greenland; feral flocks are a separate story.')],
    'Whooper Swan': [winter(OCT_MAR, 'Whooper Swans arrive from Iceland in October; only a couple of pairs stay to breed.')],
    'Eurasian Wigeon': [winter(SEP_APR, 'Enormous winter numbers arrive from Russia and Iceland; only a few pairs breed here.')],
    'Northern Pintail': [winter(SEP_APR, 'A scarce winter duck of estuaries and flooded fields.')],
    'Common Pochard': [winter(SEP_APR, 'Mostly a winter duck on British lakes and reservoirs.')],
    'Common Goldeneye': [winter([10, 11, 12, 1, 2, 3, 4], 'A winter visitor from northern Europe; a tiny Scottish population nests in boxes.')],
    'Grey Plover': [winter([8, 9, 10, 11, 12, 1, 2, 3, 4, 5], 'A high-Arctic breeder that only ever winters or passes through Britain.')],
    'Bar-tailed Godwit': [winter([8, 9, 10, 11, 12, 1, 2, 3, 4, 5], 'Winters on British estuaries and breeds in Arctic Scandinavia and Russia.')],
    'Sanderling': [winter([8, 9, 10, 11, 12, 1, 2, 3, 4, 5], 'Sanderling chase the tideline all winter; every one of them breeds in the high Arctic.')],
    'Ruddy Turnstone': [winter([8, 9, 10, 11, 12, 1, 2, 3, 4, 5], 'A winter and passage shorebird; British Turnstones breed in Greenland and Canada.')],

    // --- Seabirds ashore only for the breeding season --------------------
    // These carry a habitat rule as well as a window. The habitat pools
    // normally keep a Puffin off a suburban street, but pickHabitatBird has a
    // fallback that draws straight from the regional roster when a pool comes
    // back empty, and that path has no habitat of its own to check against.
    'Puffin': [ashore([4, 5, 6, 7], 'Puffins are only on land from April to July. Once the young leave the burrow the whole colony vanishes onto the open Atlantic until spring.', SEABIRD)],
    'Gannet': [ashore([2, 3, 4, 5, 6, 7, 8, 9, 10], 'Gannets hold their colonies from February to October and winter far out at sea.', SEABIRD)],
    'Kittiwake': [ashore([2, 3, 4, 5, 6, 7, 8, 9], 'The one British gull that truly lives at sea — ashore only to nest, and pelagic all winter.', SEABIRD)],

    // --- Two-season species: same bird, different birds -------------------
    'Chiffchaff': [
      summer(MAR_OCT, 'Chiffchaffs are back and singing in March, weeks before the other warblers.'),
      winter([11, 12, 1, 2], 'A growing number now skip Africa entirely and winter in southern Britain, especially around sewage works and reedbeds.', { bounds: SOUTH })
    ],
    'Blackcap': [
      summer(MAR_OCT, 'British Blackcaps are summer visitors that winter in Iberia and North Africa.'),
      winter([11, 12, 1, 2], 'The Blackcaps in a British garden in midwinter are different birds — central European breeders that now migrate north-west instead of south.')
    ],

    // --- Range-restricted residents --------------------------------------
    'Golden Eagle': [resident('Almost the entire British population is in the Scottish Highlands and Islands.', { bounds: SCOTLAND })],
    'White-tailed Eagle': [resident('Reintroduced to western Scotland and, more recently, the Isle of Wight.', { bounds: WEST_SCOTLAND_AND_SOLENT })],
    'Red Grouse': [resident('A bird of heather moorland — northern and western uplands only.', { bounds: NORTH_AND_WEST, ...MOORLAND })],
    'Dipper': [resident('Dippers need fast, clean, stony rivers, which puts them in the north and west.', { bounds: NORTH_AND_WEST, ...FAST_RIVER })],
    'Ring-necked Parakeet': [resident('The feral population is centred on London and the south-east.', { bounds: SOUTH_EAST })]
  };

  // ---------------------------------------------------------------------
  // Australian roster. Most of these birds are resident; the ones below are
  // the genuine seasonal movers into the game's south-eastern range.
  // ---------------------------------------------------------------------
  const AU_PRESENCE = {
    'Asian Koel': [summer([9, 10, 11, 12, 1, 2, 3], 'Koels arrive in spring to lay in other birds\' nests and head north again by autumn.', { bounds: AU })],
    'Rainbow Bee-eater': [summer([9, 10, 11, 12, 1, 2, 3], 'Southern Bee-eaters are spring and summer birds only — they move north for the winter.', { bounds: AU })],
    'Dollarbird': [summer([9, 10, 11, 12, 1, 2, 3, 4], 'A spring and summer migrant to eastern Australia, wintering in New Guinea.', { bounds: AU })],
    'Sacred Kingfisher': [summer([9, 10, 11, 12, 1, 2, 3], 'In the south-east this is a spring and summer bird, moving north for the winter.', { bounds: AU })],
    'Latham\'s Snipe': [summer([8, 9, 10, 11, 12, 1, 2, 3], 'Breeds in Japan and spends the southern summer in Australian wetlands.', { bounds: AU })]
  };

  const PRESENCE_BY_REGION = { uk: UK_PRESENCE, au: AU_PRESENCE };

  function cleanName(name) {
    return String(name || '').split('(')[0].trim();
  }

  function windowsFor(name, region) {
    const key = cleanName(name);
    if (!key) return null;
    if (region && PRESENCE_BY_REGION[region]) return PRESENCE_BY_REGION[region][key] || null;
    for (const table of Object.values(PRESENCE_BY_REGION)) {
      if (table[key]) return table[key];
    }
    return null;
  }

  function inBounds(bounds, lat, lon) {
    if (!bounds) return true;
    const boxes = Array.isArray(bounds) ? bounds : [bounds];
    return boxes.some(box => Number(lat) >= box.latMin && Number(lat) <= box.latMax
      && Number(lon) >= box.lonMin && Number(lon) <= box.lonMax);
  }

  function windowMatches(occ, month, lat, lon, habitat) {
    if (!occ.months.includes(Number(month))) return false;
    if (occ.habitats && habitat && !occ.habitats.includes(habitat)) return false;
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
    if (hasCoords && !inBounds(occ.bounds, lat, lon)) return false;
    return true;
  }

  function monthsLabel(months) {
    const set = [...new Set(months.map(Number))].sort((a, b) => a - b);
    if (set.length >= 12) return 'All year';
    if (set.length === 1) return MONTH_NAMES[set[0]];
    // A set of months is one unbroken run — wrapping December to January —
    // exactly when a single member lacks its predecessor. That start is then
    // the front of the run, so [10,11,12,1,2,3] reads "October to March"
    // rather than a list of six month names.
    const starts = set.filter(m => !set.includes(m === 1 ? 12 : m - 1));
    if (starts.length !== 1) return set.map(m => MONTH_NAMES[m].slice(0, 3)).join(', ');
    return MONTH_NAMES[starts[0]] + ' to ' + MONTH_NAMES[((starts[0] + set.length - 2) % 12) + 1];
  }

  // Meteorological seasons, flipped below the equator so an Australian player
  // in December is told it is summer rather than winter.
  function seasonForMonth(month, lat) {
    const m = Number(month);
    const southern = Number.isFinite(Number(lat)) && Number(lat) < 0;
    const northern = [12, 1, 2].includes(m) ? 'winter'
      : [3, 4, 5].includes(m) ? 'spring'
        : [6, 7, 8].includes(m) ? 'summer' : 'autumn';
    if (!southern) return northern;
    return { winter: 'summer', spring: 'autumn', summer: 'winter', autumn: 'spring' }[northern];
  }

  // BirdNET counts four weeks to a month, 1-48, and its range filter reads the
  // number in that scale. Handing it an ISO week would shift the season by up
  // to a month — the exact error the filter exists to avoid.
  function birdnetWeek(date) {
    const month = date.getMonth() + 1;
    return (month - 1) * 4 + Math.min(3, Math.floor((date.getDate() - 1) / 7)) + 1;
  }

  /** What the device clock says it is right now, and what that means. */
  function nowContext(dateArg, lat) {
    const date = dateArg instanceof Date ? dateArg : (dateArg ? new Date(dateArg) : new Date());
    const month = date.getMonth() + 1;
    const season = seasonForMonth(month, lat);
    return {
      month,
      birdnetWeek: birdnetWeek(date),
      season,
      seasonLabel: season.charAt(0).toUpperCase() + season.slice(1),
      monthLabel: MONTH_NAMES[month]
    };
  }

  // The month labels are read far more often than they change — there are 16
  // distinct ones across the whole table — so each species gets its merged
  // month set and its label once, at load, instead of per lookup.
  const PRESENCE_SUMMARY = new Map();
  Object.values(PRESENCE_BY_REGION).forEach(table => {
    Object.entries(table).forEach(([species, windows]) => {
      const months = [...new Set(windows.flatMap(occ => occ.months))].sort((a, b) => a - b);
      PRESENCE_SUMMARY.set(species, { months, monthsLabel: monthsLabel(months) });
    });
  });

  // Nothing mutates the fail-open answer, and most candidates take that branch,
  // so it is one shared object rather than a fresh one per check.
  const UNKNOWN_PRESENCE = Object.freeze({
    species: '', known: false, present: true, status: 'unknown', statusLabel: '',
    months: Object.freeze(ALL_MONTHS.slice()), monthsLabel: 'All year', note: '',
    reason: 'no-presence-rule'
  });

  function monthNow() {
    return (new Date()).getMonth() + 1;
  }

  /**
   * Could this bird be seen here, now? Answers with a bare boolean.
   *
   * This is the spawn-picker's question, asked around a thousand times per map
   * refresh, so it stops at the answer and builds none of the display text that
   * presenceReport does. Unknown names come back true — this core only ever
   * subtracts birds it can vouch for being absent.
   */
  function isPresent(name, context) {
    const ctx = context || {};
    const windows = windowsFor(name, ctx.region);
    if (!windows || !windows.length) return true;
    const month = Number(ctx.month) || monthNow();
    return windows.some(occ => windowMatches(occ, month, ctx.lat, ctx.lon, ctx.habitat));
  }

  /** The same question with the wording a player needs. For UI surfaces only. */
  function presenceReport(name, context) {
    const ctx = context || {};
    const windows = windowsFor(name, ctx.region);
    if (!windows || !windows.length) return UNKNOWN_PRESENCE;
    const month = Number(ctx.month) || monthNow();
    const match = windows.find(occ => windowMatches(occ, month, ctx.lat, ctx.lon, ctx.habitat));
    const shown = match || windows[0];
    const summary = PRESENCE_SUMMARY.get(cleanName(name)) || { months: ALL_MONTHS, monthsLabel: 'All year' };
    return {
      species: cleanName(name),
      known: true,
      present: !!match,
      status: shown.status,
      statusLabel: STATUS_LABELS[shown.status] || shown.status,
      months: summary.months,
      monthsLabel: summary.monthsLabel,
      note: shown.note || '',
      // "Wrong time of year" and "wrong part of the country" are different
      // facts, and the player deserves to be told which one it is.
      reason: match ? 'present'
        : (windows.some(occ => occ.months.includes(month)) ? 'out-of-range' : 'out-of-season')
    };
  }

  /** One line for the map: what season it is, and what that means for birds. */
  function seasonSummary(context) {
    const ctx = context || {};
    const now = nowContext(ctx.date, ctx.lat);
    const lastMonth = now.month === 1 ? 12 : now.month - 1;
    const arrivals = [];
    const departures = [];
    Object.entries(PRESENCE_BY_REGION[ctx.region] || {}).forEach(([species, windows]) => {
      const here = windows.some(occ => occ.months.includes(now.month));
      const wasHere = windows.some(occ => occ.months.includes(lastMonth));
      if (here && !wasHere) arrivals.push(species);
      if (!here && wasHere) departures.push(species);
    });
    return { ...now, arrivals: arrivals.sort(), departures: departures.sort() };
  }

  function knownSpecies(region) {
    return Object.keys(PRESENCE_BY_REGION[region] || {}).sort();
  }

  return {
    version: 'seasonal-presence-20260729',
    // The game's five entry points: one cheap gate, one worded report, the
    // clock, the map's season line, and the roster for tests.
    isPresent,
    presenceReport,
    nowContext,
    birdnetWeek,
    seasonSummary,
    knownSpecies
  };
});
