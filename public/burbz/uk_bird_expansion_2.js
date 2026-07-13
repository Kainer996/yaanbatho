/* Source-backed UK bird expansion, wave 2. Data sources: BTO BirdFacts and BTO British List. */
(function (root, factory) {
  const expansion = factory();
  if (typeof module === 'object' && module.exports) module.exports = expansion;
  if (root) root.BURBZ_UK_BIRD_EXPANSION_26 = expansion;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ALL_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
  const SUMMER = [4,5,6,7,8,9];
  const WINTER = [10,11,12,1,2,3];
  const UK = { latMin:49, latMax:61, lonMin:-9, lonMax:3 };
  const SCOTLAND = { latMin:55.5, latMax:59.5, lonMin:-8, lonMax:-0.5 };
  const NORTH = { latMin:53.5, latMax:61, lonMin:-9, lonMax:2 };
  const SOUTH = { latMin:49, latMax:53.5, lonMin:-6, lonMax:3 };
  const EAST = { latMin:49, latMax:56, lonMin:-1.5, lonMax:3 };
  const NORTH_AND_NI = { latMin:54, latMax:61, lonMin:-9, lonMax:-0.5 };
  const SOUTHWEST = { latMin:49.9, latMax:51.2, lonMin:-5.8, lonMax:-2.8 };
  const NORTHERN_ISLES = { latMin:58.7, latMax:61.1, lonMin:-4.5, lonMax:-0.4 };

  const rows = [
    ["Hooded Crow","Corvus cornix","uncommon",{hp:6,stamina:7,strength:6,def:8,spd:6,int:9},["clever corvid","northern generalist","bold scavenger"],"BTO records a widespread resident breeder in Scotland and Northern Ireland; corvid problem-solving matches Carrion Crow cognition while size stays medium-large.",["farmland","coast","hills","urban"],ALL_MONTHS,["scotland","northern_uk"],NORTH_AND_NI,"Northern and eastern Europe through to central Asia.","Replaces Carrion Crow in north-west Scotland, the Scottish islands and Northern Ireland.","Omnivorous: carrion, invertebrates, grain, eggs and shoreline scraps.","BTO British List: Resident Breeder and Winter Visitor, 100,000–500,000 pairs."],
    ["Rock Pipit","Anthus petrosus","uncommon",{hp:3,stamina:7,strength:2,def:7,spd:6,int:5},["rocky-shore specialist","hardy resident","tideline forager"],"BTO records a widespread coastal resident breeder; small pipit size keeps strength low while storm-coast hardiness lifts defence and stamina.",["coast"],ALL_MONTHS,["uk_coast"],UK,"North-west European coasts from Fennoscandia to Iberia.","Rocky shores, cliffs and harbour walls right around Britain.","Small marine invertebrates, insects and sandhoppers picked from the tideline.","BTO British List: Resident Breeder and Winter Visitor, 10,000–100,000 pairs."],
    ["Whinchat","Saxicola rubetra","rare",{hp:3,stamina:8,strength:2,def:5,spd:7,int:5},["upland chat","long-distance migrant","perch hunter"],"BTO records a migrant breeder wintering in Africa; trans-Saharan migration endurance dominates a small, lightly built chat.",["grassland","hills"],SUMMER,["northern_uk","uk_uplands"],NORTH,"European breeder wintering in sub-Saharan Africa.","Breeds in bracken-fringed upland grassland, mainly northern and western Britain; passage elsewhere.","Insects, spiders and some berries taken from low perches.","BTO British List: Migrant Breeder and Passage Visitor, 10,000–100,000 pairs."],
    ["Black Redstart","Phoenicurus ochruros","epic",{hp:3,stamina:7,strength:2,def:6,spd:7,int:6},["urban cliff bird","quivering tail","scarce breeder"],"BTO records only around 100 breeding pairs; agile insect-hawking and adaptable urban cognition outweigh its small frame.",["urban","coast"],ALL_MONTHS,["southern_uk"],SOUTH,"Southern and central Eurasian breeder; partial migrant.","Industrial sites, city rooftops and rocky coasts, chiefly southern and eastern England.","Insects, spiders and berries taken from walls and waste ground.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 10–100 pairs."],
    ["Twite","Linaria flavirostris","rare",{hp:3,stamina:7,strength:2,def:6,spd:7,int:5},["upland finch","moor-edge breeder","flocking winterer"],"BTO records a declining resident breeder; small finch size limits power while hardy moorland and saltmarsh living support stamina.",["hills","coast","grassland"],ALL_MONTHS,["northern_uk","uk_uplands"],NORTH,"Discontinuous range from north-west Europe to central Asia.","Breeds on Pennine and Scottish moor edges; winters on east-coast saltmarshes.","Small seeds year-round, especially of moorland and saltmarsh plants.","BTO British List: Resident/Migrant Breeder and Winter Visitor, 1,000–10,000 pairs."],
    ["Snow Bunting","Plectrophenax nivalis","rare",{hp:3,stamina:8,strength:2,def:8,spd:7,int:5},["Arctic bunting","blizzard-proof","mountain-top breeder"],"BTO records a tiny Scottish breeding population plus Arctic winter visitors; extreme cold tolerance drives high defence for a small bird.",["hills","coast"],ALL_MONTHS,["scotland","uk_coast"],UK,"Circumpolar Arctic breeder; the world's most northerly songbird.","Breeds on the highest Cairngorm plateaux; winters on northern and eastern coasts.","Seeds and insects picked from snowfields, shingle and strandlines.","BTO British List: Resident/Migrant Breeder and Winter Visitor, 10,000–100,000 wintering birds."],
    ["Cirl Bunting","Emberiza cirlus","epic",{hp:3,stamina:6,strength:2,def:6,spd:6,int:5},["Devon specialist","hedgerow bunting","sedentary"],"BTO records a very local resident breeder confined to south Devon farmland; small size and a tiny sedentary range cap every physical stat.",["farmland","grassland"],ALL_MONTHS,["southern_uk"],SOUTHWEST,"Southern Europe and north-west Africa; Britain is the range edge.","Almost entirely coastal south Devon mixed farmland with thick hedges.","Seeds and, in summer, grasshoppers and other invertebrates.","BTO British List: Resident Breeder, 1,000–10,000 pairs."],
    ["Scottish Crossbill","Loxia scotica","legendary",{hp:4,stamina:6,strength:5,def:6,spd:7,int:6},["UK endemic","pine-cone cracker","Caledonian forest"],"BTO records Britain's only endemic bird species; a heavy crossed bill gives real bite strength for a finch, confined to Scots pinewoods.",["woodland"],ALL_MONTHS,["scotland"],SCOTLAND,"Endemic to Scotland — found nowhere else on Earth.","Native and mature planted pinewoods of the Scottish Highlands.","Conifer seeds, especially Scots pine, levered out with the crossed bill.","BTO British List: Resident Breeder, 1,000–10,000 pairs."],
    ["Great Skua","Stercorarius skua","rare",{hp:7,stamina:9,strength:8,def:7,spd:8,int:7},["sea pirate","gull-killer","fearless diver-bomber"],"BTO records a northern colonial breeder; it robs Gannets and kills gulls, so strength approaches raptor benchmarks while staying below the eagles.",["coast"],SUMMER,["scotland","uk_coast"],NORTHERN_ISLES,"Breeds only in the north-east Atlantic; winters at sea to Iberia.","Breeding colonies on Shetland, Orkney and the Western Isles; offshore on passage.","Fish (often stolen), seabirds, eggs and carrion.","BTO British List: Migrant Breeder and Passage Visitor, 1,000–10,000 pairs."],
    ["Arctic Skua","Stercorarius parasiticus","epic",{hp:5,stamina:9,strength:6,def:6,spd:9,int:7},["aerial pirate","falcon-like chaser","declining breeder"],"BTO records a declining northern breeder; it outflies terns and Kittiwakes to steal fish, so speed and pursuit cognition lead its stats.",["coast"],SUMMER,["scotland","uk_coast"],NORTHERN_ISLES,"Circumpolar Arctic breeder wintering in southern oceans.","Breeds on northern Scottish moorland near seabird colonies; coastal passage elsewhere.","Fish stolen from other seabirds, plus small birds, eggs and insects.","BTO British List: Migrant Breeder and Passage Visitor, 100–500 pairs."],
    ["Sandwich Tern","Thalasseus sandvicensis","uncommon",{hp:4,stamina:9,strength:4,def:5,spd:9,int:6},["large tern","plunge diver","early migrant"],"BTO records a colonial migrant breeder; the biggest British tern earns solid speed and migration stamina without heavyweight strength.",["coast"],[3,4,5,6,7,8,9],["uk_coast"],UK,"Breeds on European coasts; winters along African shores.","Shingle and dune colonies scattered around the British coast.","Sandeels and other small fish caught in shallow plunge dives.","BTO British List: Migrant Breeder and Passage Visitor, 10,000–100,000 pairs."],
    ["Little Tern","Sternula albifrons","epic",{hp:2,stamina:8,strength:2,def:5,spd:9,int:6},["tiny seabird","hovering fisher","beach nester"],"BTO records a scarce beach-nesting migrant breeder; Britain's smallest tern trades any power for hovering agility and flat-out speed.",["coast"],SUMMER,["uk_coast"],UK,"Breeds across Eurasia; British birds winter in West Africa.","Vulnerable shingle-beach colonies scattered around the coast.","Small fish and invertebrates snatched in hovering dives close inshore.","BTO British List: Migrant Breeder, 1,000–10,000 pairs."],
    ["Roseate Tern","Sterna dougallii","legendary",{hp:3,stamina:9,strength:3,def:5,spd:9,int:6},["rarest UK seabird","rosy-flushed","island colonist"],"BTO records Britain's rarest breeding seabird, concentrated on one or two islands; elegant fast flight and long migration define it.",["coast"],SUMMER,["uk_coast","eastern_uk"],UK,"Scattered colonies worldwide; European birds winter off West Africa.","Almost all British pairs nest on Coquet Island, Northumberland.","Small marine fish, especially sandeels, taken in shallow dives.","BTO British List: Migrant Breeder, 100–500 pairs."],
    ["Mediterranean Gull","Ichthyaetus melanocephalus","rare",{hp:5,stamina:7,strength:5,def:6,spd:7,int:6},["expanding gull","jet-black hood","colonial"],"BTO records a recent colonist now breeding in growing numbers; a medium gull with balanced, unexceptional physical stats.",["coast","wetland","urban"],ALL_MONTHS,["southern_uk","eastern_uk"],SOUTH,"Formerly Black Sea breeder, now spread across western Europe.","Breeds within Black-headed Gull colonies, mainly southern and eastern England.","Insects, marine invertebrates, fish and scraps.","BTO British List: Migrant/Resident Breeder and Winter Visitor, 1,000–10,000 pairs."],
    ["Little Gull","Hydrocoloeus minutus","rare",{hp:3,stamina:8,strength:2,def:5,spd:8,int:5},["world's smallest gull","tern-like flight","passage visitor"],"BTO records a passage and winter visitor; the smallest gull on Earth keeps buoyant marsh-tern agility with minimal strength.",["coast","water"],[3,4,5,8,9,10,11,12,1,2],["uk_coast"],UK,"Breeds across northern Eurasia; winters at sea off western Europe.","Passage flocks off headlands and at reservoirs; some overwinter offshore.","Insects taken from the surface in summer; small fish and marine invertebrates at sea.","BTO British List: Passage/Winter Visitor, 1,000–10,000 birds."],
    ["Great Northern Diver","Gavia immer","epic",{hp:8,stamina:9,strength:7,def:8,spd:6,int:5},["heavyweight diver","deep-water fisher","winter visitor"],"BTO records a winter visitor; one of the heaviest flying birds in British waters, with dive power and bulk driving HP and defence.",["coast","water"],[9,10,11,12,1,2,3,4,5],["uk_coast","western_uk"],UK,"Breeds in Iceland, Greenland and North America (as Common Loon).","Winters around British coasts, favouring the north and west.","Fish and crustaceans caught in long, deep dives.","BTO British List: Winter Visitor, 1,000–10,000 birds."],
    ["Black-throated Diver","Gavia arctica","epic",{hp:7,stamina:9,strength:7,def:7,spd:6,int:5},["loch breeder","streamlined diver","rare"],"BTO records a rare Scottish breeder; large diver bulk and underwater hunting power sit just below its Great Northern relative.",["water","coast"],ALL_MONTHS,["scotland","uk_coast"],SCOTLAND,"Northern Eurasian breeder wintering on temperate coasts.","Breeds on large north-west Scottish lochs; winters around the coast.","Fish caught in sustained underwater pursuit.","BTO British List: Resident Breeder and Winter Visitor, 100–500 pairs."],
    ["Velvet Scoter","Melanitta fusca","rare",{hp:6,stamina:8,strength:6,def:7,spd:7,int:5},["heavy sea duck","white wing-flash","winter visitor"],"BTO records a winter visitor to northern and eastern coasts; the largest scoter carries genuine bulk and rough-sea endurance.",["coast"],WINTER,["uk_coast","eastern_uk"],UK,"Breeds from Fennoscandia across northern Russia.","Winters offshore among Common Scoter flocks, mainly off eastern Scotland and England.","Mussels and other molluscs taken in dives to the seabed.","BTO British List: Winter Visitor, 1,000–10,000 birds."],
    ["Eurasian Spoonbill","Platalea leucorodia","epic",{hp:7,stamina:7,strength:6,def:6,spd:6,int:6},["spatula bill","returning colonist","sweep feeder"],"BTO records a re-established breeder after centuries of absence; heron-scale size gives solid HP while the sweeping bill needs finesse, not force.",["wetland","coast"],ALL_MONTHS,["eastern_uk","uk_wetlands"],EAST,"Patchy across Eurasia and Africa; north-west European population growing.","Small colonies on East Anglian and northern English coastal wetlands.","Small fish, shrimps and aquatic insects sieved with side-to-side bill sweeps.","BTO British List: Migrant Breeder and Passage/Winter Visitor, 10–100 pairs."],
    ["Purple Sandpiper","Calidris maritima","rare",{hp:3,stamina:8,strength:2,def:8,spd:6,int:5},["surf-line wader","rock specialist","confiding"],"BTO records a winter visitor; feeding in breaking surf on wave-washed rocks earns high defence for such a small, stocky wader.",["coast"],[10,11,12,1,2,3,4],["uk_coast","northern_uk"],UK,"Breeds on Arctic tundra and mountains; winters on North Atlantic rocks.","Rocky shores, piers and groynes, strongest in northern and eastern Britain.","Molluscs, crustaceans and insects picked from weed-covered rock.","BTO British List: Passage/Winter Visitor, 10,000–100,000 birds."],
    ["Red-necked Phalarope","Phalaropus lobatus","legendary",{hp:2,stamina:9,strength:1,def:5,spd:7,int:5},["spinning swimmer","role-reversed breeder","Shetland rarity"],"BTO records one of Britain's rarest breeders, spinning on Shetland pools; near-zero mass but an ocean-crossing migration to the Pacific.",["wetland","water"],[5,6,7,8],["scotland"],NORTHERN_ISLES,"Circumpolar Arctic breeder; British birds winter in the tropical Pacific.","A few dozen pairs on Shetland and Western Isles machair pools.","Tiny aquatic invertebrates whirled up by spinning on the surface.","BTO British List: Migrant Breeder, 10–100 males."],
    ["Wood Sandpiper","Tringa glareola","epic",{hp:3,stamina:9,strength:2,def:6,spd:8,int:5},["delicate wader","marsh passage migrant","rare northern breeder"],"BTO records a rare Scottish breeder and regular passage migrant; slight build with long-haul migration endurance and nimble flight.",["wetland"],[4,5,6,7,8,9],["uk_wetlands","scotland"],UK,"Breeds across northern Eurasia; winters in Africa.","A handful breed in Scottish bogs; freshwater marshes on passage elsewhere.","Insects, worms and other small invertebrates from marsh edges.","BTO British List: Migrant Breeder and Passage Visitor, 10–100 pairs."],
    ["Spotted Redshank","Tringa erythropus","rare",{hp:4,stamina:9,strength:3,def:6,spd:8,int:5},["elegant wader","sooty summer plumage","passage visitor"],"BTO records a passage and winter visitor; a slim, deep-wading Tringa whose Arctic-to-Africa journeys drive stamina and speed.",["wetland","coast"],[7,8,9,10,11,12,1,2,3,4,5],["uk_wetlands","uk_coast"],UK,"Breeds in Arctic Eurasia; winters from Britain to tropical Africa.","Coastal lagoons, estuaries and marsh pools on passage; a few overwinter.","Small fish, shrimps and aquatic insects chased in belly-deep water.","BTO British List: Passage/Winter Visitor, 100–500 birds."],
    ["Little Auk","Alle alle","rare",{hp:3,stamina:8,strength:2,def:6,spd:7,int:4},["starling-sized seabird","Arctic wanderer","storm-driven"],"BTO records a winter visitor from the high Arctic; a tiny whirring auk whose ocean toughness far exceeds its size.",["coast"],[10,11,12,1,2],["uk_coast","northern_uk"],UK,"Breeds in vast high-Arctic colonies; winters in the North Atlantic.","Offshore northern and eastern waters in winter; storm-blown birds appear near coasts.","Planktonic crustaceans, especially copepods.","BTO British List: Winter Visitor, 10,000–100,000 birds."],
    ["Leach's Storm Petrel","Hydrobates leucorhous","legendary",{hp:2,stamina:10,strength:1,def:6,spd:8,int:5},["night-flying ocean sprite","remote island breeder","gale rider"],"BTO records breeding only on remote north-western islands; among the lightest British seabirds yet rides Atlantic gales with maximum endurance.",["coast"],SUMMER,["uk_coast","scotland"],NORTHERN_ISLES,"North Atlantic and North Pacific seabird.","Breeds on St Kilda, the Flannans and other remote Scottish islands; otherwise far offshore.","Plankton, tiny fish and squid snatched from the sea surface at night.","BTO British List: Migrant Breeder, 10,000–100,000 pairs."],
    ["European Honey Buzzard","Pernis apivorus","legendary",{hp:6,stamina:8,strength:6,def:7,spd:7,int:7},["wasp-nest raider","secretive raptor","summer migrant"],"BTO records a rare migrant breeder; armoured face feathering and the nerve to dig out wasp nests reward defence and cognition over raw power.",["woodland"],[5,6,7,8,9],["southern_uk"],SOUTH,"European breeder wintering in equatorial Africa.","Very scarce in large, quiet forests, mainly southern England, Wales and Scotland.","Wasp and bee larvae dug from nests, plus frogs and nestlings.","BTO British List: Migrant Breeder and Passage Visitor, 10–100 pairs."]
  ];

  // Seasonal range splits, mirroring the UK50 module: these species occupy
  // clearly different ranges or habitats between breeding, passage and winter,
  // so single rectangles would create impossible spawns.
  const WINTER_EXT = [9,10,11,12,1,2,3,4];
  const BREEDING = [5,6,7,8];
  const LOCATION_RULES = {
    "Snow Bunting": [
      { months:[10,11,12,1,2,3,4], habitats:["coast","hills"], bounds:UK },
      { months:[5,6,7,8,9], habitats:["hills"], bounds:SCOTLAND }
    ],
    "Whinchat": [
      { months:[4,5,8,9], habitats:["grassland","hills"], bounds:UK },
      { months:[6,7], habitats:["grassland","hills"], bounds:NORTH }
    ],
    "Twite": [
      { months:WINTER_EXT, habitats:["coast","grassland","hills"], bounds:UK },
      { months:BREEDING, habitats:["hills","grassland"], bounds:NORTH }
    ],
    "Black-throated Diver": [
      { months:WINTER_EXT, habitats:["coast"], bounds:UK },
      { months:BREEDING, habitats:["water"], bounds:SCOTLAND }
    ],
    "Wood Sandpiper": [
      { months:[4,5,8,9], habitats:["wetland"], bounds:UK },
      { months:[6,7], habitats:["wetland"], bounds:SCOTLAND }
    ],
    "Great Skua": [
      { months:[4,5,8,9], habitats:["coast"], bounds:UK },
      { months:[6,7], habitats:["coast"], bounds:NORTH }
    ],
    "Arctic Skua": [
      { months:[4,5,8,9], habitats:["coast"], bounds:UK },
      { months:[6,7], habitats:["coast"], bounds:NORTH }
    ]
  };

  const sourceSlugs = {
    "Leach's Storm Petrel":"leachs-storm-petrel",
    "European Honey Buzzard":"honey-buzzard"
  };
  function slug(name) {
    return name.toLowerCase().replace(/[’']/g, '_').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function sourceUrl(name) {
    const s = sourceSlugs[name] || name.toLowerCase().replace(/’/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'https://www.bto.org/understanding-birds/birdfacts/' + s;
  }
  const COMMONNESS_BY_RARITY = { common:92, uncommon:68, rare:38, epic:18, legendary:7 };
  const species = rows.map(row => {
    const [name, scientific, rarity, stats, traits, rationale, habitats, months, zones, bounds, origin, range, diet, conservation] = row;
    return {
      id:slug(name), name, scientific, scientificName:scientific, ukStatus:conservation, rarity, commonness:COMMONNESS_BY_RARITY[rarity], aliases:[scientific], stats, traits, rationale,
      sources:[sourceUrl(name), 'https://www.bto.org/learn/about-birds/british-list'],
      origin, habitat:habitats.join(', '), range, diet, conservation,
      habitats:[...habitats], months:[...months], zones:[...zones], bounds:{...bounds},
      // Placeholder card art until each species gets its manga RPG painting.
      art:'/burbz/bird-art-cache/' + slug(name) + '_burbz_placeholder_20260713.png'
    };
  });
  const byName = Object.fromEntries(species.map(bird => [bird.name, bird]));
  const names = species.map(bird => bird.name);
  const profiles = species.map(bird => ({...bird, lat:(bird.bounds.latMin + bird.bounds.latMax) / 2, lon:(bird.bounds.lonMin + bird.bounds.lonMax) / 2}));
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
    const rules = LOCATION_RULES[bird.name];
    if (rules) return rules.some(rule => rule.months.includes(m) && (!habitat || rule.habitats.includes(habitat)) && (!hasCoords || inBounds(rule.bounds, lat, lon)));
    if (!bird.months.includes(m)) return false;
    if (!hasCoords) return true;
    return inBounds(bird.bounds, lat, lon);
  }

  return { version:'uk26-source-backed-20260713', species, names, profiles, art, commonness, addToHabitatPools, isEligible };
});
