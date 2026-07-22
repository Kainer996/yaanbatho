/* UK British-List completion (wave 4). Adds source-backed British List species
   that recent taxonomic splits left outside the earlier waves. Placeholder
   "art pending" cards until each species gets its manga RPG painting.
   Sources: BTO British List and the linked species references per row. */
(function (root, factory) {
  const expansion = factory();
  if (typeof module === 'object' && module.exports) module.exports = expansion;
  if (root) root.BURBZ_UK_BIRD_EXPANSION_4 = expansion;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Coarse British range envelopes shared with the other UK waves.
  const UK = { latMin:49, latMax:61, lonMin:-9, lonMax:3 };
  const SOUTH_COAST = { latMin:49, latMax:53.5, lonMin:-6, lonMax:3 };
  const SOUTH_WEST = { latMin:49, latMax:52, lonMin:-9, lonMax:-2 };
  const NORTH = { latMin:53.5, latMax:61, lonMin:-9, lonMax:2 };
  const EAST = { latMin:52, latMax:61, lonMin:-3, lonMax:3 };

  // rows: [name, scientific, rarity, stats, traits, rationale, habitats, months,
  //        zones, bounds, origin, range, diet, conservation, extraAliases]
  const rows = [
    ["Cabot's Tern","Thalasseus acuflavida","legendary",
      {hp:4,stamina:9,strength:3,def:5,spd:9,int:6},
      ["yellow-tipped bill","plunge-diving fisher","transatlantic vagrant"],
      "Cabot's Tern uses the real medium-tern body plan: light build limits HP and weapon strength, while sustained aerial fishing and buoyant flight drive very high stamina and flight speed on a fixed 1–10 scale.",
      ["coast","water"],[5,6,7,8,9],["uk_coast","southern_uk"],SOUTH_COAST,
      "Breeds on warm coasts of the Americas from the eastern USA to Argentina.",
      "An extreme transatlantic vagrant to British coasts, usually picked out among Sandwich Tern flocks in summer.",
      "Small marine fish caught by plunge-diving, with some shrimps and squid.",
      "Least Concern globally; a very rare vagrant in Britain.",
      ["Cabot's Tern","Cayenne Tern"]],

    ["Fea's Petrel","Pterodroma feae","legendary",
      {hp:4,stamina:10,strength:3,def:5,spd:9,int:6},
      ["gadfly petrel","dynamic soarer","pelagic wanderer"],
      "Fea's Petrel uses the real gadfly-petrel body plan: a small, light seabird with modest HP and strength but world-class ocean endurance and fast, arcing dynamic soaring, so its fixed 1–10 scores peak on stamina and flight speed.",
      ["coast"],[7,8,9,10],["uk_coast","western_uk"],SOUTH_WEST,
      "Breeds on the Cape Verde and Desertas Islands in the north-east Atlantic.",
      "A rare but almost annual visitor to south-western sea areas, seen on autumn seawatches and pelagic trips.",
      "Squid, small fish and crustaceans seized at the ocean surface.",
      "Near Threatened globally; a scarce visitor to British waters.",
      ["Fea's Petrel","Cape Verde Petrel"]],

    ["Stejneger's Stonechat","Saxicola stejnegeri","legendary",
      {hp:3,stamina:8,strength:2,def:5,spd:7,int:6},
      ["East Asian chat","perch-and-pounce hunter","long-distance vagrant"],
      "Stejneger's Stonechat uses the real small-chat body plan: a tiny insectivore with low HP and strength, offset by the migratory endurance of an East Asian breeder and quick, agile perch-and-pounce flight on a fixed 1–10 scale.",
      ["grassland","heath","coast","farmland"],[9,10,11],["uk_coast","northern_uk","eastern_uk"],NORTH,
      "Breeds across eastern Siberia and winters in South and South-East Asia.",
      "A rare autumn vagrant, chiefly to the Northern Isles and North Sea coasts.",
      "Insects and other small invertebrates, with some seeds and berries in autumn.",
      "Least Concern globally; a rare vagrant in Britain.",
      ["Stejneger's Stonechat"]],

    ["Arctic Redpoll","Acanthis hornemanni","legendary",
      {hp:3,stamina:7,strength:2,def:7,spd:7,int:6},
      ["frosty plumage","cold-hardy finch","Arctic winter visitor"],
      "Arctic Redpoll uses the real small-finch body plan: a tiny seed-eater with low HP and strength, but dense insulating plumage lifts its defence and cold hardiness, with nimble flock flight, on a fixed 1–10 scale.",
      ["woodland","heath","coast","farmland"],[10,11,12,1,2,3],["uk_coast","eastern_uk","northern_uk"],EAST,
      "Breeds on the tundra and scrub of the high Arctic across Eurasia and North America.",
      "A scarce winter visitor, most often on the east coast among flocks of Common Redpoll.",
      "Birch, alder and conifer seeds, with some insects taken in summer.",
      "Least Concern globally; a scarce winter visitor to Britain.",
      ["Arctic Redpoll","Hoary Redpoll","Coues's Arctic Redpoll"]]
  ];

  const COMMONNESS_BY_RARITY = { common:92, uncommon:68, rare:38, epic:18, legendary:6 };

  function slug(name) {
    return name.toLowerCase().replace(/[’']/g, '_').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function articleName(name) {
    return name.replace(/’/g, "'");
  }
  function sources(name) {
    return [
      'https://www.bto.org/learn/about-birds/british-list',
      'https://en.wikipedia.org/wiki/' + articleName(name).replace(/'/g, '%27').replace(/ /g, '_')
    ];
  }

  const species = rows.map(row => {
    const [name, scientific, rarity, stats, traits, rationale, habitats, months, zones, bounds, origin, range, diet, conservation, extraAliases] = row;
    return {
      id: slug(name), name, scientific, scientificName: scientific, ukStatus: conservation, rarity,
      commonness: COMMONNESS_BY_RARITY[rarity], aliases: [scientific, ...(extraAliases || [])],
      stats, traits, rationale, sources: sources(name),
      origin, habitat: habitats.join(', '), range, diet, conservation,
      habitats: [...habitats], months: [...months], zones: [...zones], bounds: { ...bounds },
      art: '/burbz/bird-art-cache/uk-vagrant-completion/' + slug(name) + '_art_pending_20260722.svg'
    };
  });

  const byName = Object.fromEntries(species.map(bird => [bird.name, bird]));
  const names = species.map(bird => bird.name);
  const profiles = species.map(bird => ({ ...bird, lat: (bird.bounds.latMin + bird.bounds.latMax) / 2, lon: (bird.bounds.lonMin + bird.bounds.lonMax) / 2 }));
  const art = Object.fromEntries(species.map(bird => [bird.name, bird.art]));
  const commonness = Object.fromEntries(species.map(bird => [bird.name, bird.commonness]));

  function addToHabitatPools(pools) {
    species.forEach(bird => bird.habitats.forEach(habitat => {
      if (!pools[habitat]) pools[habitat] = [];
      if (!pools[habitat].includes(bird.name)) pools[habitat].push(bird.name);
    }));
  }
  function inBounds(bounds, lat, lon) {
    return Number(lat) >= bounds.latMin && Number(lat) <= bounds.latMax && Number(lon) >= bounds.lonMin && Number(lon) <= bounds.lonMax;
  }
  function isEligible(name, lat, lon, month, habitat = '') {
    const bird = byName[String(name || '').split('(')[0].trim()];
    if (!bird) return true; // Species from other rosters are unchanged.
    const m = Number(month);
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
    if (!bird.months.includes(m)) return false;
    if (!hasCoords) return true;
    return inBounds(bird.bounds, lat, lon);
  }

  return { version: 'uk-british-list-completion-20260722', species, names, profiles, art, commonness, addToHabitatPools, isEligible };
});
