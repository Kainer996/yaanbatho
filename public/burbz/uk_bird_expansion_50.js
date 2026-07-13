/* Source-backed UK bird expansion. Data sources: BTO BirdFacts and BTO British List. */
(function (root, factory) {
  const expansion = factory();
  if (typeof module === 'object' && module.exports) module.exports = expansion;
  if (root) root.BURBZ_UK_BIRD_EXPANSION_50 = expansion;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const ALL_MONTHS = [1,2,3,4,5,6,7,8,9,10,11,12];
  const SUMMER = [4,5,6,7,8,9];
  const WINTER = [10,11,12,1,2,3];
  const PASSAGE = [3,4,5,8,9,10];
  const UK = { latMin:49, latMax:61, lonMin:-9, lonMax:3 };
  const SCOTLAND = { latMin:55.5, latMax:59.5, lonMin:-8, lonMax:-0.5 };
  const NORTH = { latMin:53.5, latMax:61, lonMin:-9, lonMax:2 };
  const SOUTH = { latMin:49, latMax:53.5, lonMin:-6, lonMax:3 };
  const WEST = { latMin:49, latMax:61, lonMin:-9, lonMax:-1 };
  const EAST = { latMin:49, latMax:56, lonMin:-1.5, lonMax:3 };

  const rows = [
    ["Capercaillie","Tetrao urogallus","legendary",{hp:9,stamina:7,strength:9,def:8,spd:4,int:5},["very large grouse","pinewood specialist","ground forager"],"BTO records a re-introduced Scottish breeder; exceptional size and strength raise HP and weapon power.",["woodland"],ALL_MONTHS,["scotland"],SCOTLAND,"Native across northern Eurasian conifer forests; re-introduced in Britain.","Restricted to native pinewoods in the Scottish Highlands.","Pine shoots, needles, berries and invertebrates.","BTO British List: Re-introduced Breeder, 1,000–10,000 adults."],
    ["Black Grouse","Lyrurus tetrix","epic",{hp:7,stamina:7,strength:7,def:6,spd:6,int:5},["lekking grouse","moorland edge","powerful display"],"BTO records a local resident breeder; medium-large size, display endurance and strong wings support balanced strength.",["hills","woodland","grassland"],ALL_MONTHS,["northern_uk","uk_uplands"],NORTH,"Northern Eurasian grouse of moorland and woodland margins.","Local in northern England, Wales and Scotland.","Buds, shoots, berries and insects.","BTO British List: Resident Breeder, 1,000–10,000 males."],
    ["Ptarmigan","Lagopus muta","epic",{hp:6,stamina:8,strength:5,def:9,spd:5,int:5},["alpine grouse","winter camouflage","cold specialist"],"BTO records a Scottish resident breeder; cold endurance and camouflage drive high defence rather than raw strength.",["hills"],ALL_MONTHS,["scotland","uk_uplands"],SCOTLAND,"Arctic-alpine species across northern Eurasia and North America.","Confined in Britain to high Scottish mountains.","Heather shoots, buds, leaves and berries.","BTO British List: Resident Breeder, 1,000–10,000 pairs."],
    ["White-fronted Goose","Anser albifrons","rare",{hp:8,stamina:9,strength:7,def:7,spd:6,int:6},["long-distance migrant","winter goose","social grazer"],"BTO records a winter migrant; large size and migration endurance produce high stamina and HP.",["wetland","farmland","coast"],WINTER,["uk_wetlands","uk_coast"],UK,"Arctic-breeding goose wintering in temperate Europe.","Winter flocks chiefly on wetlands, estuaries and grazing land.","Grasses, roots, shoots and spilled grain.","BTO British List: Winter Migrant, 10,000–100,000 birds."],
    ["Bewick's Swan","Cygnus columbianus","epic",{hp:9,stamina:9,strength:8,def:8,spd:6,int:6},["small swan","Arctic migrant","wetland grazer"],"BTO records a winter migrant; swan size gives high HP while long migration demands exceptional endurance.",["water","wetland","farmland"],WINTER,["uk_wetlands","southern_uk"],SOUTH,"Arctic Russian breeder wintering in north-west Europe.","Mostly winter wetlands and farmland in southern and eastern Britain.","Aquatic plants, grasses, roots and grain.","BTO British List: Winter Migrant, 1,000–10,000 birds."],
    ["Garganey","Spatula querquedula","epic",{hp:5,stamina:8,strength:4,def:5,spd:7,int:5},["summer duck","shallow-wetland specialist","migrant"],"BTO records a scarce migrant breeder and passage visitor; migration endurance and agile flight outweigh small size.",["water","wetland"],SUMMER,["uk_wetlands","southern_uk"],SOUTH,"Eurasian migrant wintering in Africa.","Scarce in shallow, well-vegetated lowland wetlands.","Aquatic invertebrates, seeds and plant material.","BTO British List: Migrant Breeder and Passage Visitor, 100–500 pairs."],
    ["Scaup","Aythya marila","rare",{hp:6,stamina:8,strength:5,def:7,spd:6,int:5},["diving duck","coastal winterer","migrant"],"BTO records a scarce breeder and passage/winter visitor; diving endurance and robust size raise stamina and defence.",["water","coast"],ALL_MONTHS,["uk_coast","northern_uk"],NORTH,"Circumpolar diving duck.","Mostly coastal bays and large waters, especially in northern Britain.","Molluscs, aquatic invertebrates and plants.","BTO British List: Scarce Breeder and Passage/Winter Visitor, 1,000–10,000 birds."],
    ["Common Scoter","Melanitta nigra","uncommon",{hp:6,stamina:9,strength:5,def:7,spd:7,int:5},["sea duck","flocking diver","long-distance migrant"],"BTO records a numerous passage/winter visitor with scarce breeding; sea endurance and speed dominate its stats.",["coast","water"],ALL_MONTHS,["uk_coast","northern_uk"],NORTH,"Northern Eurasian sea duck.","Large winter flocks offshore; very local northern breeding lochs.","Marine molluscs, crustaceans and aquatic insects.","BTO British List: Resident/Migrant Breeder and Passage/Winter Visitor, 100,000–500,000 birds."],
    ["Long-tailed Duck","Clangula hyemalis","rare",{hp:5,stamina:9,strength:4,def:7,spd:7,int:5},["Arctic sea duck","deep diver","winter visitor"],"BTO records a scarce breeder and winter visitor; small size is offset by diving and migration endurance.",["coast","water"],ALL_MONTHS,["uk_coast","northern_uk"],NORTH,"Circumpolar Arctic sea duck.","Principally northern coasts and offshore waters in winter.","Molluscs, crustaceans, fish eggs and aquatic insects.","BTO British List: Scarce Breeder and Winter Visitor, 10,000–100,000 birds."],
    ["Smew","Mergellus albellus","epic",{hp:5,stamina:8,strength:4,def:6,spd:7,int:5},["winter sawbill","fish diver","scarce visitor"],"BTO records only 100–500 wintering birds; diving agility and migration endurance compensate for small size.",["water","wetland"],WINTER,["southern_uk","uk_wetlands"],SOUTH,"Northern Eurasian sawbill wintering farther south.","Scarce on sheltered lakes and reservoirs in winter.","Small fish and aquatic invertebrates.","BTO British List: Winter Visitor, 100–500 birds."],
    ["Red-breasted Merganser","Mergus serrator","rare",{hp:6,stamina:8,strength:6,def:6,spd:8,int:5},["sawbill","fast swimmer","coastal fisher"],"BTO records resident breeding and winter visitors; streamlined size, speed and underwater endurance shape its stats.",["coast","water"],ALL_MONTHS,["uk_coast","northern_uk","western_uk"],NORTH,"Northern Hemisphere fish-eating duck.","Breeds mainly north and west; winters around coasts and estuaries.","Fish, crustaceans and aquatic insects.","BTO British List: Resident Breeder and Winter Visitor, 1,000–10,000 pairs."],
    ["Nightjar","Caprimulgus europaeus","rare",{hp:4,stamina:8,strength:3,def:7,spd:8,int:6},["nocturnal","aerial insectivore","heathland migrant"],"BTO records a migrant breeder; long-winged agility, night cognition and flight endurance are its strengths.",["heath","woodland"],SUMMER,["southern_uk"],SOUTH,"Eurasian summer migrant wintering in Africa.","Heaths, clear-felled woodland and open conifer plantations, mainly southern Britain.","Moths and other flying insects.","BTO British List: Migrant Breeder and Passage Visitor, 1,000–10,000 males."],
    ["Corncrake","Crex crex","epic",{hp:5,stamina:7,strength:4,def:8,spd:5,int:5},["secretive rail","hay-meadow migrant","rasping caller"],"BTO records a migrant breeder with a contracted range; concealment defence and migration endurance exceed modest size.",["farmland","grassland","wetland"],SUMMER,["northern_uk","western_uk"],NORTH,"Eurasian migrant wintering in Africa.","Now concentrated in western Scottish islands and a few northern sites.","Insects, seeds and other small invertebrates.","BTO British List: Migrant Breeder and Passage Visitor, 1,000–10,000 males."],
    ["Spotted Crake","Porzana porzana","legendary",{hp:4,stamina:7,strength:3,def:8,spd:5,int:5},["elusive rail","fen specialist","summer visitor"],"BTO describes a rare fen and marsh summer visitor; small size but secretive defence and migration endurance stand out.",["wetland"],[4,5,6,7,8],["uk_wetlands"],UK,"Eurasian migrant wintering in Africa.","Very scarce and shifting in fens and marshes across Britain.","Aquatic invertebrates, insects, seeds and shoots.","BTO British List: Scarce Breeder and Passage Visitor, 10–100 males."],
    ["Coot","Fulica atra","common",{hp:6,stamina:7,strength:6,def:7,spd:5,int:6},["territorial rail","powerful swimmer","adaptable wetland bird"],"BTO records a widespread resident breeder and winter visitor; robust size and territorial strength suit balanced stats.",["water","wetland","park"],ALL_MONTHS,["nationwide","uk_wetlands"],UK,"Widespread across Europe, Asia, Africa and Australasia.","Lakes, reservoirs, ponds and slow rivers throughout Britain.","Aquatic plants, seeds and invertebrates.","BTO British List: Resident Breeder and Winter Visitor, 10,000–100,000 pairs."],
    ["Red-necked Grebe","Podiceps grisegena","legendary",{hp:5,stamina:8,strength:4,def:6,spd:7,int:5},["scarce grebe","diving fisher","winter visitor"],"BTO records only 10–100 birds; underwater agility and endurance matter more than small body size.",["water","coast"],WINTER,["uk_coast","uk_wetlands"],UK,"Northern Eurasian and North American grebe.","Scarce on large waters and sheltered coasts in winter.","Fish and aquatic invertebrates.","BTO British List: Scarce Breeder and Winter Visitor, 10–100 birds."],
    ["Slavonian Grebe","Podiceps auritus","legendary",{hp:4,stamina:8,strength:3,def:6,spd:7,int:5},["rare breeding grebe","diver","winter coast bird"],"BTO records only 10–100 breeding pairs; small size is balanced by diving speed and endurance.",["water","coast"],ALL_MONTHS,["scotland","uk_coast"],NORTH,"Northern Eurasian and North American grebe.","Tiny Scottish breeding population; more widespread on coasts in winter.","Fish, crustaceans and aquatic insects.","BTO British List: Resident Breeder and Winter Visitor, 10–100 pairs."],
    ["Black-necked Grebe","Podiceps nigricollis","legendary",{hp:4,stamina:8,strength:3,def:6,spd:7,int:5},["colonial grebe","agile diver","scarce breeder"],"BTO records only 10–100 breeding pairs; diving agility and stamina outweigh slight size and strength.",["water","wetland"],ALL_MONTHS,["uk_wetlands"],UK,"Widespread but local grebe across Eurasia, Africa and the Americas.","Very local breeder; passage and winter bird on larger waters.","Aquatic insects, crustaceans and small fish.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 10–100 pairs."],
    ["Stone-curlew","Burhinus oedicnemus","epic",{hp:6,stamina:8,strength:5,def:8,spd:7,int:6},["nocturnal wader","dry-ground specialist","summer migrant"],"BTO records a local migrant breeder; running speed, night cognition and camouflage defence define it.",["grassland","farmland"],SUMMER,["southern_uk","eastern_uk"],SOUTH,"Dry-country species across southern Eurasia and Africa.","Local on dry open ground in southern and eastern England.","Insects, worms, molluscs and small vertebrates.","BTO British List: Migrant Breeder, 100–500 pairs."],
    ["Golden Plover","Pluvialis apricaria","uncommon",{hp:5,stamina:9,strength:4,def:7,spd:8,int:5},["upland breeder","winter flocking wader","migrant"],"BTO records breeding plus passage/winter visitors; migration endurance and swift flight set its profile.",["hills","grassland","farmland","coast"],ALL_MONTHS,["uk_uplands","nationwide"],UK,"Breeds in northern European and Arctic uplands.","Breeds on moors; widespread lowland flocks outside breeding season.","Insects, worms, molluscs and seeds.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 10,000–100,000 pairs."],
    ["Dotterel","Charadrius morinellus","epic",{hp:4,stamina:9,strength:3,def:7,spd:8,int:5},["montane plover","long-distance migrant","high-altitude breeder"],"BTO records a migrant breeder and passage visitor; small size contrasts with high-altitude and migration endurance.",["hills"],[4,5,6,7,8,9,10],["scotland","uk_uplands"],SCOTLAND,"Arctic and montane Eurasian plover.","Breeds on a few high Scottish plateaux; passage elsewhere.","Insects and other small invertebrates.","BTO British List: Migrant Breeder and Passage Visitor, 500–1,000 males."],
    ["Whimbrel","Numenius phaeopus","rare",{hp:6,stamina:10,strength:5,def:6,spd:8,int:5},["long-distance migrant","coastal wader","curved bill"],"BTO records a migrant breeder and passage visitor; exceptional migration endurance and speed dominate its stats.",["coast","wetland","hills"],[4,5,6,7,8,9,10],["uk_coast","northern_uk"],NORTH,"Circumpolar breeder wintering far south.","Very local northern breeding; passage around British coasts.","Crabs, worms, molluscs and insects.","BTO British List: Migrant Breeder and Passage Visitor, 500–1,000 pairs."],
    ["Knot","Calidris canutus","uncommon",{hp:4,stamina:10,strength:3,def:6,spd:8,int:5},["Arctic migrant","huge winter flocks","estuary specialist"],"BTO records 100,000–500,000 passage/winter birds; tiny size belies extraordinary endurance and flight speed.",["coast","wetland"],[9,10,11,12,1,2,3,4,5],["uk_coast"],UK,"High-Arctic breeder wintering on temperate coasts.","Major estuaries and tidal flats around Britain outside summer.","Molluscs, worms and crustaceans.","BTO British List: Passage/Winter Visitor, 100,000–500,000 birds."],
    ["Ruff","Calidris pugnax","epic",{hp:5,stamina:9,strength:5,def:6,spd:7,int:5},["lekking wader","passage migrant","wet grassland bird"],"BTO records scarce breeding and passage/winter visits; migration endurance and display strength shape its stats.",["wetland","farmland"],ALL_MONTHS,["uk_wetlands","eastern_uk"],EAST,"Eurasian migrant wader.","Scarce breeder; chiefly passage and winter on wetlands and flooded fields.","Insects, worms, molluscs and seeds.","BTO British List: Scarce Breeder and Passage/Winter Visitor, 500–1,000 birds."],
    ["Woodcock","Scolopax rusticola","uncommon",{hp:6,stamina:8,strength:5,def:9,spd:7,int:5},["camouflaged wader","woodland specialist","crepuscular"],"BTO records resident/migrant breeding and winter visitors; stocky size and exceptional camouflage defence stand out.",["woodland","wetland"],ALL_MONTHS,["nationwide"],UK,"Widespread woodland wader across Eurasia.","Woodland throughout Britain, reinforced by winter migrants.","Earthworms and soil invertebrates.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 10,000–100,000 males."],
    ["Jack Snipe","Lymnocryptes minimus","rare",{hp:3,stamina:8,strength:2,def:9,spd:6,int:5},["tiny snipe","cryptic winterer","bog feeder"],"BTO British List records a passage/winter visitor; tiny size is offset by migration endurance and superb camouflage defence.",["wetland"],WINTER,["uk_wetlands"],UK,"Northern Eurasian breeder wintering farther south.","Boggy ground, marsh edges and wet fields across Britain in winter.","Worms, insects, molluscs and seeds.","BTO British List: Passage/Winter Visitor, 100,000–500,000 birds."],
    ["Green Sandpiper","Tringa ochropus","rare",{hp:4,stamina:9,strength:3,def:6,spd:8,int:5},["freshwater wader","migrant","alert feeder"],"BTO records scarce breeding and passage/winter visits; high migration endurance and agile speed lead the profile.",["water","wetland"],ALL_MONTHS,["uk_wetlands"],UK,"Northern Eurasian breeder wintering south.","Freshwater margins, ditches and muddy pools; chiefly passage and winter.","Aquatic insects and other invertebrates.","BTO British List: Scarce Breeder and Passage/Winter Visitor; population unavailable."],
    ["Greenshank","Tringa nebularia","rare",{hp:5,stamina:9,strength:4,def:6,spd:8,int:5},["long-legged wader","northern breeder","migrant"],"BTO records resident/migrant breeding and passage/winter visitors; long-distance endurance and fast flight are strongest.",["wetland","coast","hills"],ALL_MONTHS,["northern_uk","uk_coast","uk_uplands"],NORTH,"Northern Eurasian migrant wader.","Breeds mainly Scottish uplands; widespread estuarine passage and wintering.","Aquatic insects, crustaceans, worms and small fish.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 1,000–10,000 pairs."],
    ["Arctic Tern","Sterna paradisaea","epic",{hp:4,stamina:10,strength:3,def:5,spd:9,int:6},["polar migrant","aerial fisher","colonial seabird"],"BTO records a migrant breeder; world-leading migration endurance and aerial speed outweigh small size.",["coast"],SUMMER,["uk_coast","northern_uk"],NORTH,"Circumpolar breeder migrating to Antarctic waters.","Breeding coasts and islands, strongest in northern Britain.","Small fish and marine invertebrates.","BTO British List: Migrant Breeder and Passage Visitor, 10,000–100,000 pairs."],
    ["Guillemot","Uria aalge","common",{hp:6,stamina:9,strength:6,def:7,spd:7,int:5},["cliff-nesting auk","deep diver","colonial seabird"],"BTO British List records up to a million breeding pairs; robust size, diving strength and sea endurance support high stamina.",["coast"],ALL_MONTHS,["uk_coast"],UK,"North Atlantic and North Pacific auk.","Breeds on sea cliffs around Britain; offshore outside breeding.","Small schooling fish.","BTO British List: Migrant/Resident Breeder and Winter Visitor, 500,000–1 million pairs."],
    ["Black Guillemot","Cepphus grylle","rare",{hp:5,stamina:8,strength:5,def:7,spd:6,int:5},["northern auk","coastal diver","resident seabird"],"BTO British List records a northern resident breeder; diving endurance and compact strength balance moderate speed.",["coast"],ALL_MONTHS,["scotland","uk_coast"],NORTH,"Circumpolar northern auk.","Rocky coasts and islands, concentrated in Scotland and Northern Ireland.","Fish and crustaceans.","BTO British List: Resident Breeder, 10,000–100,000 pairs."],
    ["Red-throated Diver","Gavia stellata","rare",{hp:7,stamina:9,strength:6,def:7,spd:7,int:5},["northern diver","powerful swimmer","coastal winterer"],"BTO records resident/migrant breeding and winter visits; large size, diving strength and migration endurance produce robust stats.",["water","coast"],ALL_MONTHS,["scotland","uk_coast"],NORTH,"Circumpolar northern diver.","Breeds on northern lochs; winters around British coasts.","Fish and aquatic invertebrates.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 1,000–10,000 pairs."],
    ["Manx Shearwater","Puffinus puffinus","uncommon",{hp:5,stamina:10,strength:4,def:6,spd:9,int:6},["ocean migrant","dynamic soarer","island breeder"],"BTO records 100,000–500,000 breeding pairs; ocean endurance and fast, efficient flight define this bird.",["coast"],SUMMER,["uk_coast","western_uk"],WEST,"North Atlantic breeder migrating to the South Atlantic.","Breeds on western offshore islands; feeds at sea.","Small fish, squid and crustaceans.","BTO British List: Migrant Breeder, 100,000–500,000 pairs."],
    ["Storm Petrel","Hydrobates pelagicus","epic",{hp:2,stamina:10,strength:1,def:6,spd:8,int:5},["tiny ocean bird","nocturnal colony","long-distance migrant"],"BTO records tens of thousands of nests; minute size and strength contrast with exceptional ocean endurance and agility.",["coast"],SUMMER,["uk_coast","western_uk"],WEST,"North-east Atlantic and Mediterranean seabird.","Remote western and northern islands; pelagic feeding waters.","Planktonic crustaceans, tiny fish and offal.","BTO British List: Migrant Breeder, 10,000–100,000 nests."],
    ["Bittern","Botaurus stellaris","legendary",{hp:7,stamina:7,strength:7,def:10,spd:4,int:6},["reedbed heron","camouflage master","booming caller"],"BTO British List records only 10–100 males; large size and extraordinary reed camouflage give maximum defence.",["wetland"],ALL_MONTHS,["uk_wetlands","eastern_uk"],EAST,"Widespread but local across Eurasian wetlands.","Very local extensive reedbeds, chiefly eastern England.","Fish, amphibians and aquatic invertebrates.","BTO British List: Resident Breeder and Winter Visitor, 10–100 males."],
    ["Hen Harrier","Circus cyaneus","epic",{hp:6,stamina:9,strength:6,def:6,spd:8,int:7},["moorland raptor","low-quartering hunter","migrant"],"BTO British List records only 500–1,000 pairs; sustained hunting endurance, speed and hunting cognition lead its stats.",["hills","grassland","wetland"],ALL_MONTHS,["northern_uk","uk_uplands"],NORTH,"Northern Hemisphere open-country raptor.","Breeds mainly northern and western uplands; wider in winter.","Voles and small birds.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 500–1,000 pairs."],
    ["Long-eared Owl","Asio otus","rare",{hp:5,stamina:7,strength:5,def:8,spd:7,int:7},["nocturnal owl","woodland roost","silent hunter"],"BTO records resident breeding and winter visitors; silent agility, concealment defence and hunting cognition exceed modest size.",["woodland","hills"],ALL_MONTHS,["nationwide"],UK,"Widespread across the Northern Hemisphere.","Scattered woodland and scrub near open hunting ground.","Small mammals and birds.","BTO British List: Resident Breeder and Passage/Winter Visitor, 1,000–10,000 pairs."],
    ["Short-eared Owl","Asio flammeus","rare",{hp:6,stamina:8,strength:6,def:7,spd:8,int:7},["day-flying owl","moorland hunter","nomadic"],"BTO British List records breeding and winter visitors; sustained quartering speed, endurance and hunting cognition are strong.",["hills","grassland","wetland"],ALL_MONTHS,["northern_uk","uk_uplands"],NORTH,"Open-country owl with near-global distribution.","Moorland, marsh and rough grassland, strongest in northern Britain.","Voles and other small mammals.","BTO British List: Migrant/Resident Breeder and Passage/Winter Visitor, 1,000–10,000 pairs."],
    ["Lesser Spotted Woodpecker","Dryobates minor","epic",{hp:3,stamina:7,strength:4,def:6,spd:7,int:7},["tiny woodpecker","canopy forager","resident"],"BTO British List records a local resident breeder; tiny size limits HP but climbing agility and foraging cognition remain high.",["woodland","park"],ALL_MONTHS,["southern_uk"],SOUTH,"Temperate Eurasian woodland species.","Local mature deciduous woodland, mainly England and Wales.","Wood-boring insects, larvae and spiders.","BTO British List: Resident Breeder, 1,000–10,000 pairs."],
    ["Hobby","Falco subbuteo","rare",{hp:5,stamina:8,strength:5,def:5,spd:10,int:7},["aerial falcon","dragonfly hunter","summer migrant"],"BTO records a migrant breeder; extreme aerial speed and agility plus hunting cognition define this light falcon.",["wetland","woodland","grassland"],SUMMER,["southern_uk"],SOUTH,"Eurasian falcon wintering in Africa.","Summer visitor across England and Wales near open wetland and woodland.","Large insects and small birds caught in flight.","BTO British List: Migrant Breeder and Passage Visitor, 1,000–10,000 pairs."],
    ["Chough","Pyrrhocorax pyrrhocorax","epic",{hp:6,stamina:8,strength:5,def:6,spd:8,int:8},["coastal corvid","acrobat","social forager"],"BTO British List records only 100–500 pairs; corvid cognition and cliff-flight agility are its outliers.",["coast","hills","grassland"],ALL_MONTHS,["western_uk","uk_coast"],WEST,"Mountain and coastal corvid across Eurasia and North Africa.","Local western sea cliffs and nearby short turf.","Soil invertebrates, insects and some seeds.","BTO British List: Resident Breeder, 100–500 pairs."],
    ["Crested Tit","Lophophanes cristatus","epic",{hp:3,stamina:6,strength:2,def:6,spd:8,int:7},["pinewood tit","Scottish specialist","agile forager"],"BTO records a Scottish resident breeder; tiny size limits strength while canopy agility and foraging cognition score highly.",["woodland"],ALL_MONTHS,["scotland"],SCOTLAND,"European conifer-forest tit.","In Britain confined to Caledonian pinewoods in the Scottish Highlands.","Insects, spiders and conifer seeds.","BTO British List: Resident Breeder, 1,000–10,000 pairs."],
    ["Bearded Tit","Panurus biarmicus","epic",{hp:3,stamina:7,strength:2,def:7,spd:7,int:6},["reedbed specialist","acrobatic climber","resident"],"BTO British List records only 500–1,000 pairs; slight size is balanced by reed agility and habitat-specialist cognition.",["wetland"],ALL_MONTHS,["uk_wetlands","eastern_uk"],EAST,"Temperate Eurasian reedbed specialist.","Local large reedbeds, especially eastern and southern England.","Reed seeds in winter and insects in summer.","BTO British List: Resident Breeder and Passage/Winter Visitor, 500–1,000 pairs."],
    ["Woodlark","Lullula arborea","rare",{hp:4,stamina:8,strength:3,def:6,spd:7,int:6},["heathland lark","song-flight","ground nester"],"BTO British List records a local breeder; song-flight endurance and open-ground agility exceed its small size.",["heath","woodland","grassland"],ALL_MONTHS,["southern_uk"],SOUTH,"European and western Asian open-woodland lark.","Local heaths, forest clearings and short grass mainly southern England.","Seeds and invertebrates.","BTO British List: Resident/Migrant Breeder and Passage Visitor, 1,000–10,000 pairs."],
    ["Cetti’s Warbler","Cettia cetti","rare",{hp:3,stamina:7,strength:2,def:8,spd:7,int:6},["explosive singer","dense-scrub skulker","resident"],"BTO records a resident breeder; tiny size contrasts with concealment defence, vocal stamina and agile movement.",["wetland","woodland"],ALL_MONTHS,["southern_uk","uk_wetlands"],SOUTH,"Southern European and Asian wet-scrub warbler.","Dense waterside scrub, largely southern Britain.","Insects and other small invertebrates.","BTO British List: Resident Breeder and Passage Visitor, 1,000–10,000 males."],
    ["Wood Warbler","Phylloscopus sibilatrix","rare",{hp:3,stamina:8,strength:2,def:5,spd:8,int:6},["canopy warbler","summer migrant","trilling singer"],"BTO records a migrant breeder; small size is offset by migration endurance and canopy agility.",["woodland"],SUMMER,["western_uk","northern_uk"],WEST,"European breeder wintering in sub-Saharan Africa.","Mature deciduous woodland, stronger in western and northern Britain.","Insects and spiders.","BTO British List: Migrant Breeder and Passage Visitor, 1,000–10,000 males."],
    ["Grasshopper Warbler","Locustella naevia","rare",{hp:3,stamina:8,strength:2,def:8,spd:7,int:6},["reeling singer","scrub skulker","summer migrant"],"BTO British List records a migrant breeder; migration endurance and concealment defence dominate this small bird.",["wetland","grassland","woodland"],SUMMER,["nationwide"],UK,"European breeder wintering in Africa.","Patchy rough grass, scrub, reed and young forestry across Britain.","Insects and spiders.","BTO British List: Migrant Breeder and Passage Visitor, 10,000–100,000 territories."],
    ["Lesser Whitethroat","Sylvia curruca","uncommon",{hp:3,stamina:8,strength:2,def:6,spd:8,int:6},["hedgerow warbler","summer migrant","agile gleaner"],"BTO records a migrant breeder; small size contrasts with migration endurance and quick scrub agility.",["woodland","farmland","park"],SUMMER,["southern_uk","eastern_uk"],SOUTH,"Eurasian breeder wintering in eastern Africa.","Hedges and scrub, commonest in southern and eastern England.","Insects, spiders and berries.","BTO British List: Migrant Breeder and Passage Visitor, 10,000–100,000 territories."],
    ["Dartford Warbler","Sylvia undata","epic",{hp:3,stamina:6,strength:2,def:8,spd:7,int:6},["southern heath specialist","resident skulker","long-tailed warbler"],"BTO records a local resident breeder; tiny size is protected by dense-heath concealment defence and agility.",["heath"],ALL_MONTHS,["southern_uk"],SOUTH,"Western Mediterranean and Atlantic heathland warbler.","Confined mainly to lowland heath in southern England.","Insects, spiders and small berries.","BTO British List: Resident Breeder, 1,000–10,000 pairs."],
    ["Ring Ouzel","Turdus torquatus","rare",{hp:5,stamina:9,strength:4,def:7,spd:8,int:6},["upland thrush","summer migrant","rocky-slope forager"],"BTO records a migrant breeder; migration and upland endurance, robust thrush size and swift flight shape its stats.",["hills","grassland"],SUMMER,["northern_uk","uk_uplands"],NORTH,"European mountain thrush wintering around the Mediterranean.","Breeds in uplands of northern and western Britain.","Earthworms, insects, berries and fruit.","BTO British List: Migrant Breeder and Passage Visitor, 1,000–10,000 territories."]
  ];

  // Several British birds occupy different ranges and habitats between their
  // breeding, passage and winter seasons. A single rectangle would either
  // hide genuine winter visitors or create impossible summer spawns, so these
  // source-backed exceptions are expressed as explicit month/habitat rules.
  const WINTER_EXT = [9,10,11,12,1,2,3,4];
  const BREEDING = [5,6,7,8];
  const LOCATION_RULES = {
    "Scaup": [
      { months:WINTER_EXT, habitats:["coast","water"], bounds:UK },
      { months:BREEDING, habitats:["water"], bounds:SCOTLAND }
    ],
    "Common Scoter": [
      { months:WINTER_EXT, habitats:["coast","water"], bounds:UK },
      { months:BREEDING, habitats:["coast","water"], bounds:SCOTLAND }
    ],
    "Long-tailed Duck": [
      { months:[10,11,12,1,2,3,4], habitats:["coast","water"], bounds:UK }
    ],
    "Red-breasted Merganser": [
      { months:WINTER_EXT, habitats:["coast","water"], bounds:UK },
      { months:BREEDING, habitats:["coast","water"], bounds:NORTH }
    ],
    "Slavonian Grebe": [
      { months:WINTER_EXT, habitats:["coast","water"], bounds:UK },
      { months:BREEDING, habitats:["water"], bounds:SCOTLAND }
    ],
    "Golden Plover": [
      { months:WINTER_EXT, habitats:["farmland","grassland","coast","wetland"], bounds:UK },
      { months:BREEDING, habitats:["hills","grassland"], bounds:NORTH }
    ],
    "Dotterel": [
      { months:[4,5,9,10], habitats:["hills","grassland"], bounds:UK },
      { months:[6,7,8], habitats:["hills"], bounds:SCOTLAND }
    ],
    "Whimbrel": [
      { months:[4,5,8,9,10], habitats:["coast","wetland"], bounds:UK },
      { months:[6,7], habitats:["hills","coast"], bounds:NORTH }
    ],
    "Ruff": [
      { months:[8,9,10,11,12,1,2,3,4], habitats:["wetland","farmland"], bounds:UK },
      { months:[5,6,7], habitats:["wetland"], bounds:EAST }
    ],
    "Green Sandpiper": [
      { months:[8,9,10,11,12,1,2,3,4], habitats:["water","wetland"], bounds:UK },
      { months:[5,6,7], habitats:["water","wetland"], bounds:SCOTLAND }
    ],
    "Greenshank": [
      { months:[8,9,10,11,12,1,2,3,4], habitats:["coast","wetland","water"], bounds:UK },
      { months:[5,6,7], habitats:["hills","wetland"], bounds:SCOTLAND }
    ],
    "Arctic Tern": [
      { months:[4,5,8,9], habitats:["coast"], bounds:UK },
      { months:[6,7], habitats:["coast"], bounds:NORTH }
    ],
    "Red-throated Diver": [
      { months:WINTER_EXT, habitats:["coast"], bounds:UK },
      { months:BREEDING, habitats:["water","coast"], bounds:SCOTLAND }
    ],
    "Hen Harrier": [
      { months:WINTER_EXT, habitats:["wetland","grassland","hills"], bounds:UK },
      { months:BREEDING, habitats:["hills","grassland"], bounds:NORTH }
    ],
    "Short-eared Owl": [
      { months:WINTER_EXT, habitats:["wetland","grassland","hills"], bounds:UK },
      { months:BREEDING, habitats:["hills","grassland"], bounds:NORTH }
    ],
    "Ring Ouzel": [
      { months:[4,5,9,10], habitats:["hills","grassland"], bounds:UK },
      { months:[6,7,8], habitats:["hills","grassland"], bounds:NORTH }
    ]
  };

  const sourceSlugs = {
    "Bewick's Swan":"bewicks-swan", "Cetti’s Warbler":"cettis-warbler"
  };
  function slug(name) {
    return name.toLowerCase().replace(/[’']/g, '_').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }
  function idSlug(name) { return slug(name); }
  function sourceUrl(name) {
    const s = sourceSlugs[name] || name.toLowerCase().replace(/’/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return 'https://www.bto.org/understanding-birds/birdfacts/' + s;
  }
  const COMMONNESS_BY_RARITY = { common:92, uncommon:68, rare:38, epic:18, legendary:7 };
  const species = rows.map(row => {
    const [name, scientific, rarity, stats, traits, rationale, habitats, months, zones, bounds, origin, range, diet, conservation] = row;
    return {
      id:idSlug(name), name, scientific, scientificName:scientific, ukStatus:conservation, rarity, commonness:COMMONNESS_BY_RARITY[rarity], aliases:[scientific], stats, traits, rationale,
      sources:[sourceUrl(name), 'https://www.bto.org/learn/about-birds/british-list'],
      origin, habitat:habitats.join(', '), range, diet, conservation,
      habitats:[...habitats], months:[...months], zones:[...zones], bounds:{...bounds},
      art:name === 'Coot' ? '/burbz/bird-art-cache/eurasian_coot_burbz_manga_20260630.png' : '/burbz/bird-art-cache/' + slug(name) + '_burbz_manga_rpg_20260713.png'
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
    if (!bird) return true; // Existing saves and non-UK rosters are unchanged.
    const m = Number(month);
    const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lon));
    const rules = LOCATION_RULES[bird.name];
    if (rules) return rules.some(rule => rule.months.includes(m) && (!habitat || rule.habitats.includes(habitat)) && (!hasCoords || inBounds(rule.bounds, lat, lon)));
    if (!bird.months.includes(m)) return false;
    if (!hasCoords) return true;
    return inBounds(bird.bounds, lat, lon);
  }

  function supportedRegionForCoords(lat, lon) {
    lat = Number(lat); lon = Number(lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) return 'unsupported';
    if (lat >= -45 && lat <= -9 && lon >= 112 && lon <= 154) return 'au';
    // Coarse but explicit UK land/island envelopes. These deliberately exclude
    // Dublin/most of the Republic of Ireland and continental Europe rather
    // than treating every non-Australian coordinate as Britain.
    const ukBoxes = [
      { latMin:49.8, latMax:54.8, lonMin:-5.8, lonMax:2.0 },       // England and Wales
      { latMin:54.8, latMax:58.8, lonMin:-6.6, lonMax:0.5 },      // mainland Scotland and northern England
      { latMin:58.7, latMax:61.1, lonMin:-3.8, lonMax:-0.4 },     // Orkney and Shetland
      { latMin:56.0, latMax:58.8, lonMin:-8.8, lonMax:-5.0 },     // Hebrides
      { latMin:54.0, latMax:55.4, lonMin:-8.3, lonMax:-5.3 }      // Northern Ireland
    ];
    return ukBoxes.some(box => inBounds(box, lat, lon)) ? 'uk' : 'unsupported';
  }

  return { version:'uk50-source-backed-20260713', species, names, profiles, art, commonness, addToHabitatPools, isEligible, supportedRegionForCoords };
});
