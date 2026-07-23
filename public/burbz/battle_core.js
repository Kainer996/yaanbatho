// Burbz Battle Core v3 — "Skyclash"
// A squad-based battle engine modelled on the genre's top-rated systems:
// every bird fights on the field at once, turn order runs on a speed-driven
// Combat Readiness meter, skills run on cooldowns, signatures are ultimates,
// and a shared team Focus pool can be burned to Surge a skill. Physical
// attacks scale off ATK against DEF; spells scale off MAG against RES —
// small birds carry the magic of the Kingdom, so a goldcrest can duel an
// eagle and win. Diplomacy runs on CHA: every bird can Parley, sapping a
// foe's will to fight, and a charming bird can win a weakened foe over
// without a blow — the robin's road to victory where the eagle slugs it
// out. Wing classes and real-bird type matchups are kept from v2.
// Pure engine: no DOM, deterministic via seeded RNG, UMD export.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBattleCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // ---------------------------------------------------------------------------
  // Wing classes (types)
  // ---------------------------------------------------------------------------
  const BIRD_TYPES = {
    raptor:     { id:'raptor',     label:'Raptor',     icon:'🦅', color:'#e0594a', blurb:'Birds of prey — eagles, hawks, falcons, owls and other true hunters.' },
    trickster:  { id:'trickster',  label:'Trickster',  icon:'🃏', color:'#a06ae8', blurb:'Corvids, parrots, mimics and nest raiders — the clever ones.' },
    songbird:   { id:'songbird',   label:'Songbird',   icon:'🎵', color:'#4aa8e0', blurb:'Garden and woodland perching birds — small, fierce and territorial.' },
    skydancer:  { id:'skydancer',  label:'Skydancer',  icon:'🪽', color:'#43c6a8', blurb:'Swifts, swallows and hummingbirds — untouchable masters of the air.' },
    waterbird:  { id:'waterbird',  label:'Waterbird',  icon:'🌊', color:'#4a6de0', blurb:'Waterfowl, waders, seabirds and fishers — big, sturdy and unbothered.' },
    groundbird: { id:'groundbird', label:'Groundbird', icon:'🥾', color:'#b8863b', blurb:'Pheasants, pigeons and giant walkers — heavy birds that hold the turf.' }
  };

  // Balanced wheel: every class is strong against exactly two and weak against
  // exactly the two that are strong against it. 1.6x / 0.625x like the classics.
  const TYPE_CHART = {
    raptor:     { songbird:1.6, groundbird:1.6, trickster:0.625, skydancer:0.625 },
    trickster:  { raptor:1.6, waterbird:1.6, songbird:0.625, groundbird:0.625 },
    songbird:   { trickster:1.6, skydancer:1.6, raptor:0.625, waterbird:0.625 },
    skydancer:  { raptor:1.6, groundbird:1.6, songbird:0.625, waterbird:0.625 },
    waterbird:  { skydancer:1.6, songbird:1.6, trickster:0.625, groundbird:0.625 },
    groundbird: { trickster:1.6, waterbird:1.6, raptor:0.625, skydancer:0.625 }
  };

  // Real-bird facts shown in the battle log when a matchup fires.
  const TYPE_FACTS = {
    'raptor>songbird':     'Sparrowhawks really do raid garden feeders for songbirds.',
    'raptor>groundbird':   'Eagles and goshawks take grouse and pheasants on the ground.',
    'trickster>raptor':    'Corvids gang up and mob birds of prey until they flee — for real.',
    'trickster>waterbird': 'Crows and magpies raid unguarded waterfowl nests for eggs.',
    'songbird>trickster':  'Small birds swarm and scold nest raiders — mobbing works.',
    'songbird>skydancer':  'House sparrows really do evict house martins from their own nests.',
    'skydancer>raptor':    'Swifts can outfly a falcon in level flight — most raids fail.',
    'skydancer>groundbird':'Hit-and-run swoops that a heavy ground bird can never answer.',
    'waterbird>skydancer': 'Aerial feints don\'t dent a swan — one wing-slap ends the raid.',
    'waterbird>songbird':  'Herons and big gulls snap up any small bird that strays too close.',
    'groundbird>trickster':'Nest raiders bounce off armoured ground parents — nobody cons a cassowary.',
    'groundbird>waterbird':'On land the waddlers lose — ground birds hold the turf.'
  };

  function effectiveness(attackerType, defenderType) {
    const mult = (TYPE_CHART[attackerType] && TYPE_CHART[attackerType][defenderType]) || 1;
    const fact = mult > 1 ? TYPE_FACTS[attackerType + '>' + defenderType] || null : null;
    return { mult, fact };
  }

  // ---------------------------------------------------------------------------
  // Species classification — accurate to real bird groups
  // ---------------------------------------------------------------------------
  function speciesKey(name) {
    return String(name || '').toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  // Explicit calls for species that keyword rules would misfile.
  const TYPE_OVERRIDES = {
    magpie_lark: 'songbird',            // not a magpie — a mudnester
    gray_shrikethrush: 'songbird', grey_shrikethrush: 'songbird',
    black_faced_cuckooshrike: 'songbird',
    bush_stone_curlew: 'groundbird',    // 'curlew' in name but a dry-land walker
    hardhead: 'waterbird',              // Australian white-eyed duck
    shoebill: 'waterbird',
    hamerkop: 'waterbird',
    laughing_kookaburra: 'raptor',      // kingfisher family, but a famous snake-hunter
    tawny_frogmouth: 'raptor',          // nocturnal ambush predator
    great_frigatebird: 'trickster',     // aerial pirate — steals other birds' catch
    common_myna: 'trickster',           // brilliant mimic
    northern_mockingbird: 'trickster',
    superb_lyrebird: 'trickster',       // the world's greatest mimic
    spangled_drongo: 'trickster',       // fakes alarm calls to steal food
    asian_koel: 'trickster',            // brood parasite (cuckoo family)
    satin_bowerbird: 'trickster',       // steals blue treasures for its bower
    toco_toucan: 'trickster',           // notorious nest raider
    australian_magpie: 'trickster',     // swoop-season legend, very clever
    kakapo: 'groundbird',               // the flightless night parrot
    eurasian_hoopoe: 'groundbird',      // ground forager
    kori_bustard: 'groundbird'
  };

  // Keyword rules, checked in priority order against name tokens.
  const TYPE_RULES = [
    { type:'raptor', tokens:['eagle','hawk','goshawk','sparrowhawk','falcon','kestrel','merlin','kite','harrier','buzzard','osprey','owl','boobook','frogmouth','vulture','condor','secretarybird','butcherbird','kookaburra','shrike','skua'] },
    { type:'trickster', tokens:['crow','raven','magpie','jackdaw','rook','jay','chough','nutcracker','parrot','parakeet','macaw','cockatoo','corella','galah','rosella','lorikeet','budgerigar','cockatiel','kea','kakapo','cuckoo','koel','drongo','mockingbird','lyrebird','myna','currawong','bowerbird','toucan','frigatebird'] },
    { type:'skydancer', tokens:['swift','swallow','martin','hummingbird','flycatcher','fantail','wagtail','nightjar','dollarbird','roller','woodswallow','needletail','treeswift'], substrings:['bee_eater'] },
    { type:'waterbird', tokens:['duck','mallard','teal','wigeon','pintail','shoveler','pochard','goldeneye','eider','shelduck','goosander','merganser','gadwall','garganey','smew','scoter','scaup','swan','goose','grebe','coot','moorhen','swamphen','rail','crake','heron','egret','bittern','stork','ibis','spoonbill','pelican','cormorant','shag','darter','anhinga','gull','kittiwake','fulmar','shearwater','petrel','gannet','booby','albatross','penguin','puffin','razorbill','guillemot','auk','loon','diver','crane','flamingo','curlew','whimbrel','godwit','snipe','woodcock','sandpiper','plover','lapwing','killdeer','oystercatcher','avocet','turnstone','dunlin','sanderling','knot','stint','stilt','redshank','greenshank','phalarope','kingfisher','dipper','tern','skimmer','jacana'] },
    { type:'groundbird', tokens:['pheasant','partridge','quail','grouse','ptarmigan','ostrich','emu','cassowary','rhea','kiwi','bustard','bronzewing','peafowl','turkey','junglefowl','roadrunner','hoopoe','tinamou'], substrings:['pigeon','dove'] }
  ];

  function classifySpecies(name) {
    const key = speciesKey(name);
    if (TYPE_OVERRIDES[key]) return TYPE_OVERRIDES[key];
    const tokens = key.split('_').filter(Boolean);
    for (const rule of TYPE_RULES) {
      if (rule.tokens && rule.tokens.some(t => tokens.includes(t))) return rule.type;
      if (rule.substrings && rule.substrings.some(s => key.includes(s))) return rule.type;
    }
    return 'songbird';
  }

  // ---------------------------------------------------------------------------
  // Move schools — the six Academy disciplines
  // ---------------------------------------------------------------------------
  // strike/aero are physical (ATK vs DEF); mind/song are spellcraft (MAG vs RES).
  const MOVE_SCHOOLS = {
    strike: { id:'strike', label:'Strike', icon:'⚔️', stat:'atk', room:'training',    roomLabel:'Training Hall' },
    guard:  { id:'guard',  label:'Guard',  icon:'🛡️', stat:'def', room:'workshop',    roomLabel:'Nest Workshop' },
    aero:   { id:'aero',   label:'Aero',   icon:'🪽', stat:'atk', room:'training',    roomLabel:'Training Hall' },
    mind:   { id:'mind',   label:'Mind',   icon:'🧠', stat:'mag', room:'observatory', roomLabel:'Moon Observatory' },
    song:   { id:'song',   label:'Song',   icon:'🎵', stat:'mag', room:'crowbar',     roomLabel:'The Crowbar' },
    endure: { id:'endure', label:'Endure', icon:'🌰', stat:'stamina', room:'kitchen', roomLabel:'Kitchen & Pantry' }
  };

  // Tier unlocks at 1 / 3 / 6 claimed training sessions in the discipline.
  const TIER_THRESHOLDS = [1, 3, 6];

  // Discipline skills — the s2 slot. cd is the cooldown in own-turns.
  const MOVE_LINES = {
    strike: [
      { id:'talon_jab',      label:'Talon Jab',      power:58, cd:2, kind:'attack' },
      { id:'power_strike',   label:'Power Strike',   power:74, cd:2, kind:'attack', rider:{ kind:'debuff', stat:'def', pct:0.15, turns:2 } },
      { id:'tempest_talons', label:'Tempest Talons', power:92, cd:3, kind:'attack', rider:{ kind:'debuff', stat:'def', pct:0.25, turns:2 } }
    ],
    aero: [
      { id:'quick_dart', label:'Quick Dart', power:46, cd:2, kind:'attack', crPushSelf:0.2 },
      { id:'wind_slash', label:'Wind Slash', power:60, cd:2, kind:'attack', crPushSelf:0.3 },
      { id:'sonic_dive', label:'Sonic Dive', power:74, cd:3, kind:'attack', crPushSelf:0.3, crShred:0.15 }
    ],
    mind: [
      { id:'sharp_eyes',  label:'Sharp Eyes',  power:52, cd:2, kind:'attack', rider:{ kind:'debuff', stat:'def', pct:0.15, turns:2 } },
      { id:'outsmart',    label:'Outsmart',    power:64, cd:2, kind:'attack', rider:{ kind:'debuff', stat:'mag', pct:0.18, turns:2 } },
      { id:'master_plan', label:'Master Plan', power:60, cd:3, kind:'attack', aoe:true, rider:{ kind:'debuff', stat:'def', pct:0.18, turns:2 } }
    ],
    guard: [
      { id:'feather_guard', label:'Feather Guard', power:0, cd:3, kind:'barrier', barrierPct:0.22 },
      { id:'nest_wall',     label:'Nest Wall',     power:0, cd:3, kind:'barrier', barrierPct:0.3, rider:{ kind:'buff', stat:'def', pct:0.2, turns:2 } },
      { id:'iron_plumage',  label:'Iron Plumage',  power:0, cd:3, kind:'barrier', barrierPct:0.3, teamWide:true, rider:{ kind:'buff', stat:'def', pct:0.2, turns:2 } }
    ],
    song: [
      { id:'rally_chirp',   label:'Rally Chirp',   power:0, cd:3, kind:'buff', rider:{ kind:'buff', stat:'atk', pct:0.2, turns:2 }, alsoStat:'mag' },
      { id:'morale_anthem', label:'Morale Anthem', power:0, cd:3, kind:'buff', rider:{ kind:'buff', stat:'atk', pct:0.25, turns:2 }, alsoStat:'mag', healPct:0.12 },
      { id:'dawn_chorus',   label:'Dawn Chorus',   power:0, cd:4, kind:'buff', rider:{ kind:'buff', stat:'atk', pct:0.3, turns:2 }, alsoStat:'mag', healPct:0.18, teamWide:true }
    ],
    endure: [
      { id:'second_wind',    label:'Second Wind',    power:0, cd:3, kind:'heal', healPct:0.3 },
      { id:'deep_roost',     label:'Deep Roost',     power:0, cd:3, kind:'heal', healPct:0.4, cleanse:true },
      { id:'marathon_heart', label:'Marathon Heart', power:0, cd:4, kind:'heal', healPct:0.35, cleanse:true, teamWide:true }
    ]
  };

  // Basic attacks (s1): no cooldown, feed the team Focus pool. Every bird
  // carries both and auto-leads with whichever side of it is stronger.
  const PECK  = { id:'peck',  label:'Peck',  icon:'🐤', school:'basic', stat:'atk', power:42, cd:0, kind:'attack', focusGain:1, copy:'Reliable jab that builds team Focus.' };
  const SPARK = { id:'spark', label:'Spark', icon:'✨', school:'basic', stat:'mag', power:42, cd:0, kind:'attack', focusGain:1, copy:'A dart of kingdom magic that builds team Focus.' };

  // Diplomacy — Charm (CHA) is the small birds' battlefield. Every bird
  // carries Parley: a charm offensive that saps a foe's will to fight, and
  // can win a weakened foe over entirely, ending its fight without a blow.
  // Warriors carry the branches; charmers carry the conversation.
  const PARLEY = { id:'parley', label:'Parley', icon:'🕊️', school:'charm', stat:'cha', power:0, cd:3, kind:'parley', focusGain:1,
    copy:'Charm diplomacy: saps a foe\'s will to fight; a weakened foe may be won over completely.' };
  const PARLEY_WINOVER_HP_PCT = 0.35; // foes at or below this share of max HP can be talked out of the fight

  // A bird's resistance to being charmed: cool heads and charming tongues
  // are both hard to sway. The flat term keeps weak-willed foes from being
  // trivially farmed by any mid-charm bird.
  function charmResolve(fighter) {
    return Math.round(effStat(fighter, 'int') * 0.5 + effStat(fighter, 'cha') * 0.5) + 40;
  }

  // ---------------------------------------------------------------------------
  // Signature moves — curated, real-behaviour flavoured, per famous species.
  // In Skyclash the signature is the bird's ULTIMATE (s3): big cooldown, big hit.
  // ---------------------------------------------------------------------------
  // rider kinds: debuff (enemy), buff (self), steal (focus), heal (self),
  // pierce (ignores barriers), crit (bonus crit chance).
  const SIGNATURES = [
    { match:['peregrine'], label:'Hunting Stoop', power:118, rider:{ kind:'crit', bonus:0.25 }, fact:'Peregrines dive at over 300 km/h — the fastest animal on Earth.' },
    { match:['golden_eagle'], label:'Sky Hammer', power:126, fact:'Golden eagles knock prey off cliffsides with 2-metre wings.' },
    { match:['harpy_eagle'], label:'Canopy King', power:130, fact:'Harpy eagle talons are bigger than a grizzly bear\'s claws.' },
    { match:['bald_eagle'], label:'Freedom Dive', power:118, fact:'Bald eagles snatch fish without ever breaking flight.' },
    { match:['white_tailed_eagle','steller_sea_eagle','african_fish_eagle','wedge_tailed_eagle'], label:'Sea King Sweep', power:120, fact:'Sea eagles carry off prey more than half their own weight.' },
    { match:['sparrowhawk','goshawk'], label:'Hedge Ambush', power:104, rider:{ kind:'crit', bonus:0.3 }, fact:'Sparrowhawks thread hedges at full speed to surprise their prey.' },
    { match:['kite'], label:'Carrion Spiral', power:92, rider:{ kind:'heal', pct:0.15 }, fact:'Kites patrol in lazy spirals, stealing scraps mid-air.' },
    { match:['kestrel'], label:'Wind Hover', power:88, rider:{ kind:'crit', bonus:0.25 }, fact:'Kestrels hold perfectly still in the wind, then drop like a dart.' },
    { match:['merlin'], label:'Moor Chase', power:94, crPushSelf:0.3, fact:'Merlins run down songbirds in low, twisting pursuit flights.' },
    { match:['owl','boobook'], label:'Silent Ambush', power:100, rider:{ kind:'crit', bonus:0.35 }, fact:'Fringed feathers make owl flight almost perfectly silent.' },
    { match:['osprey'], label:'Talon Splash', power:106, fact:'Ospreys plunge feet-first and close their nostrils underwater.' },
    { match:['vulture','condor'], label:'Bone Breaker', power:98, rider:{ kind:'pierce' }, fact:'Bearded vultures drop bones from height to crack them open.' },
    { match:['secretarybird'], label:'Serpent Stamp', power:120, fact:'Secretarybirds kick snakes with five times their body weight.' },
    { match:['kookaburra'], label:'Laughing Judgement', power:96, rider:{ kind:'debuff', stat:'atk', pct:0.2, turns:2 }, fact:'A kookaburra\'s dawn laugh warns rivals off its hunting ground.' },
    { match:['butcherbird'], label:'Larder Hook', power:98, fact:'Butcherbirds wedge prey in tree forks — a hanging larder.' },
    { match:['frogmouth'], label:'Statue Strike', power:94, rider:{ kind:'crit', bonus:0.3 }, fact:'Tawny frogmouths freeze like broken branches, then lunge.' },
    { match:['crow','raven','rook','jackdaw'], label:'Mob Rule', power:84, aoe:true, rider:{ kind:'debuff', stat:'atk', pct:0.2, turns:2 }, fact:'Corvids recruit the whole neighbourhood to drive off raptors.' },
    { match:['australian_magpie'], label:'Swoop Season', power:94, crShred:0.2, fact:'Australian magpies dive-bomb anyone near the nest each spring.' },
    { match:['magpie'], label:'Shiny Snatch', power:78, rider:{ kind:'steal', focus:3 }, fact:'Magpies are bold enough to raid anything left glittering.' },
    { match:['jay'], label:'Acorn Cache', power:76, rider:{ kind:'heal', pct:0.18 }, fact:'A jay buries thousands of acorns a year — and remembers them.' },
    { match:['drongo'], label:'False Alarm', power:72, rider:{ kind:'steal', focus:4 }, fact:'Drongos mimic alarm calls to scare others off their food — real con artists.' },
    { match:['lyrebird'], label:'Perfect Mimic', power:80, rider:{ kind:'debuff', stat:'def', pct:0.25, turns:2 }, fact:'Lyrebirds imitate chainsaws, camera shutters and other birds flawlessly.' },
    { match:['mockingbird'], label:'Two Hundred Songs', power:78, rider:{ kind:'debuff', stat:'atk', pct:0.2, turns:2 }, fact:'A mockingbird can learn over 200 different songs.' },
    { match:['cuckoo','koel'], label:'Nest Trick', power:82, rider:{ kind:'debuff', stat:'def', pct:0.22, turns:2 }, fact:'Cuckoos fool other species into raising their chicks.' },
    { match:['kea'], label:'Puzzle Break', power:84, rider:{ kind:'pierce' }, fact:'Keas solve multi-step puzzles — and dismantle parked cars.' },
    { match:['cockatoo','corella','galah'], label:'Crest Riot', power:86, rider:{ kind:'pierce' }, fact:'Cockatoos learn to open bins — and teach the trick to others.' },
    { match:['parrot','macaw','parakeet','lorikeet','budgerigar','cockatiel','rosella'], label:'Vice Grip', power:86, rider:{ kind:'pierce' }, fact:'A big parrot\'s bill cracks nuts no human hand could open.' },
    { match:['bowerbird'], label:'Blue Heist', power:76, rider:{ kind:'steal', focus:3 }, fact:'Satin bowerbirds steal anything blue to decorate their bowers.' },
    { match:['frigatebird'], label:'Pirate Chase', power:82, rider:{ kind:'steal', focus:4 }, fact:'Frigatebirds harass other seabirds until they drop their catch.' },
    { match:['toucan'], label:'Bill Toss', power:84, fact:'Toucans toss fruit — and raid nests — with that giant bill.' },
    { match:['wren'], label:'Thunder Song', power:72, rider:{ kind:'debuff', stat:'atk', pct:0.2, turns:2 }, fact:'Gram for gram, the wren has one of the loudest songs of any bird.' },
    { match:['robin'], label:'Winter Carol', power:70, rider:{ kind:'buff', stat:'mag', pct:0.2, turns:2 }, fact:'Robins sing through winter and defend territory ferociously.' },
    { match:['nightingale'], label:'Midnight Aria', power:74, rider:{ kind:'buff', stat:'mag', pct:0.25, turns:2 }, fact:'Nightingales sing over 200 song types, day and night.' },
    { match:['starling'], label:'Murmuration', power:68, aoe:true, rider:{ kind:'buff', stat:'def', pct:0.22, turns:2 }, fact:'Starling murmurations swirl in thousands to confuse predators.' },
    { match:['skylark'], label:'Sky Anthem', power:70, rider:{ kind:'buff', stat:'atk', pct:0.22, turns:2 }, fact:'Skylarks sing continuously while hovering high over their field.' },
    { match:['blackbird','song_thrush'], label:'Dusk Serenade', power:74, rider:{ kind:'buff', stat:'atk', pct:0.2, turns:2 }, fact:'Song thrushes smash snails open on a favourite anvil stone.' },
    { match:['mistle_thrush'], label:'Storm Singer', power:78, fact:'Mistle thrushes sing loudest from treetops in wild weather.' },
    { match:['woodpecker'], label:'Jackhammer', power:88, rider:{ kind:'pierce' }, fact:'Woodpeckers strike wood up to 20 times a second without concussion.' },
    { match:['nuthatch'], label:'Headfirst Drop', power:76, crPushSelf:0.25, fact:'Nuthatches are the only UK bird that walks down trees headfirst.' },
    { match:['goldcrest','firecrest'], label:'Pinpoint Dart', power:68, crPushSelf:0.35, fact:'The goldcrest is the UK\'s smallest bird at just five grams.' },
    { match:['tit','chickadee','titmouse'], label:'Acro Peck', power:70, crPushSelf:0.25, fact:'Tits hang upside-down to reach food nothing else can.' },
    { match:['goldfinch','chaffinch','greenfinch','bullfinch','crossbill','linnet','siskin','redpoll','finch'], label:'Thistle Dart', power:72, fact:'Goldfinch beaks are fine-tuned tweezers for thistle seeds.' },
    { match:['sparrow'], label:'Street Gang', power:74, rider:{ kind:'buff', stat:'atk', pct:0.18, turns:2 }, fact:'House sparrows squabble in gangs and fear almost nothing.' },
    { match:['swift'], label:'Scythe Wings', power:86, crPushSelf:0.3, fact:'Swifts eat, drink and sleep on the wing for ten months straight.' },
    { match:['swallow','martin'], label:'Skimming Strike', power:80, crPushSelf:0.25, fact:'Swallows drink by skimming ponds at full speed.' },
    { match:['hummingbird'], label:'Blur Wings', power:76, crPushSelf:0.3, rider:{ kind:'steal', focus:2 }, fact:'Hummingbirds beat their wings 50 times a second and fly backwards.' },
    { match:['wagtail'], label:'Tail Feint', power:72, crShred:0.2, fact:'Willie wagtails fearlessly harass eagles a hundred times their size.' },
    { match:['fantail'], label:'Fan Dance', power:70, crShred:0.2, fact:'Fantails flush insects by flashing their tail like a fan.' },
    { match:['bee_eater'], label:'Sting Snip', power:78, fact:'Bee-eaters wipe a bee\'s sting off on a branch before eating it.' },
    { match:['swan'], label:'Wing Thunder', power:106, fact:'A swan\'s wing-slap is strong enough to see off a fox.' },
    { match:['goose'], label:'Honk Charge', power:94, rider:{ kind:'debuff', stat:'atk', pct:0.18, turns:2 }, fact:'Geese guard territory so fiercely they\'ve been used as watchdogs.' },
    { match:['heron','egret','bittern'], label:'Spear Bill', power:100, rider:{ kind:'crit', bonus:0.25 }, fact:'Herons stand statue-still, then strike faster than the eye.' },
    { match:['kingfisher'], label:'Plunge Dive', power:94, rider:{ kind:'crit', bonus:0.25 }, fact:'Kingfishers hit the water at speeds that would blind other birds.' },
    { match:['pelican'], label:'Scoop Gulp', power:92, rider:{ kind:'heal', pct:0.18 }, fact:'A pelican\'s pouch holds three times more than its stomach.' },
    { match:['shoebill'], label:'Guillotine Bill', power:114, fact:'Shoebills decapitate lungfish with one snap of that colossal bill.' },
    { match:['gull','kittiwake'], label:'Chip Raid', power:78, rider:{ kind:'steal', focus:3 }, fact:'Herring gulls time their swoops to steal food from your hand.' },
    { match:['tern'], label:'Arctic Arrow', power:82, crPushSelf:0.25, fact:'Arctic terns fly from pole to pole every single year.' },
    { match:['albatross'], label:'Endless Glide', power:86, rider:{ kind:'heal', pct:0.2 }, fact:'Albatrosses glide 1,000 km a day without flapping.' },
    { match:['penguin'], label:'Torpedo Slide', power:98, fact:'Penguins rocket through water at over 30 km/h.' },
    { match:['puffin'], label:'Beakful Barrage', power:84, fact:'A puffin can carry a dozen sand eels crosswise in its bill.' },
    { match:['gannet'], label:'Missile Plunge', power:104, rider:{ kind:'crit', bonus:0.25 }, fact:'Gannets hit the sea at 100 km/h with built-in facial airbags.' },
    { match:['cormorant','shag','darter'], label:'Deep Hunt', power:88, fact:'Cormorants chase fish underwater like feathered submarines.' },
    { match:['dipper'], label:'River Walk', power:80, rider:{ kind:'heal', pct:0.15 }, fact:'Dippers walk along riverbeds underwater, gripping with their claws.' },
    { match:['crane'], label:'Dawn Dance', power:88, rider:{ kind:'buff', stat:'atk', pct:0.2, turns:2 }, fact:'Cranes perform leaping duet dances to bond for life.' },
    { match:['flamingo'], label:'Sift & Sweep', power:82, rider:{ kind:'debuff', stat:'def', pct:0.2, turns:2 }, fact:'Flamingos feed upside-down, pumping water through comb-like bills.' },
    { match:['oystercatcher'], label:'Shell Cracker', power:86, rider:{ kind:'pierce' }, fact:'Oystercatchers chisel or stab shellfish open — each bird has its own technique.' },
    { match:['lapwing'], label:'Broken Wing Act', power:76, rider:{ kind:'debuff', stat:'atk', pct:0.2, turns:2 }, fact:'Lapwings fake a broken wing to lure predators from their nest.' },
    { match:['snipe'], label:'Drumming Dive', power:80, fact:'Snipe "drum" in display dives — the sound is their tail feathers.' },
    { match:['pigeon','dove','bronzewing'], label:'Homing Charge', power:84, fact:'Pigeons navigate home across hundreds of unfamiliar kilometres.' },
    { match:['pheasant'], label:'Rocket Flush', power:92, crPushSelf:0.25, fact:'A flushed pheasant explodes from cover at near-vertical angles.' },
    { match:['grouse','ptarmigan'], label:'Moor Burst', power:86, fact:'Red grouse burst from heather with startling wing-claps.' },
    { match:['partridge','quail'], label:'Covey Rush', power:82, rider:{ kind:'buff', stat:'def', pct:0.2, turns:2 }, fact:'Partridge coveys roost in a circle, facing out — nobody sneaks up.' },
    { match:['ostrich'], label:'Piston Kick', power:124, fact:'An ostrich kick can kill a lion — and it runs at 70 km/h.' },
    { match:['cassowary'], label:'Dagger Claw', power:126, rider:{ kind:'pierce' }, fact:'Cassowaries carry a 12 cm dagger claw on each foot.' },
    { match:['emu'], label:'Outback Stampede', power:108, fact:'Emus once "won" an actual war against the Australian army.' },
    { match:['kiwi'], label:'Night Probe', power:84, rider:{ kind:'crit', bonus:0.3 }, fact:'Kiwis sniff out worms with nostrils at the tip of their bill.' },
    { match:['kakapo'], label:'Boom Night', power:80, rider:{ kind:'buff', stat:'def', pct:0.25, turns:2 }, fact:'Kakapo booms carry five kilometres on still nights.' },
    { match:['hoopoe'], label:'Crest Flash', power:78, rider:{ kind:'debuff', stat:'atk', pct:0.18, turns:2 }, fact:'Hoopoes flare that zebra crest when startled.' },
    { match:['waxwing'], label:'Berry Blitz', power:76, rider:{ kind:'heal', pct:0.18 }, fact:'Waxwings strip whole berry trees in nomadic winter raids.' }
  ];

  // Per-class fallback signatures for species without a curated entry.
  const CLASS_SIGNATURES = {
    raptor:     { label:'Talon Ambush',   power:100, fact:'Raptors strike from above with locked talons.' },
    trickster:  { label:'Clever Heist',   power:80, rider:{ kind:'steal', focus:3 }, fact:'Clever birds turn a rival\'s strength against them.' },
    songbird:   { label:'Territory Song', power:74, rider:{ kind:'buff', stat:'mag', pct:0.18, turns:2 }, fact:'A singing bird is a bird claiming ground.' },
    skydancer:  { label:'Aerial Loop',    power:80, crPushSelf:0.25, fact:'Aerial specialists attack where they can\'t be answered.' },
    waterbird:  { label:'Wing Slap',      power:90, fact:'Big waterbirds settle arguments with heavy wings.' },
    groundbird: { label:'Turf Charge',    power:88, fact:'Ground birds put their whole weight behind a charge.' }
  };

  const ULTIMATE_CD = 4;        // signature cooldown once used
  const ULTIMATE_OPENING_CD = 1; // signatures need one own-turn of wind-up

  function signatureFor(speciesName, typeId) {
    const key = speciesKey(speciesName);
    const tokens = key.split('_').filter(Boolean);
    let best = null;
    for (const sig of SIGNATURES) {
      for (const m of sig.match) {
        const hit = m.includes('_') ? key.includes(m) : tokens.includes(m);
        // prefer the most specific (longest) match across all entries
        if (hit && (!best || m.length > best.matchLen)) best = { sig, matchLen: m.length };
      }
    }
    const base = best ? best.sig : (CLASS_SIGNATURES[typeId] || CLASS_SIGNATURES.songbird);
    return {
      id: 'sig_' + speciesKey(base.label),
      label: base.label,
      icon: (BIRD_TYPES[typeId] || BIRD_TYPES.songbird).icon,
      school: 'signature',
      stat: 'auto',              // resolved per bird: MAG-leaning birds cast it as a spell
      power: base.power || 84,
      cd: ULTIMATE_CD,
      kind: 'attack',
      aoe: !!base.aoe,
      crPushSelf: base.crPushSelf || 0,
      crShred: base.crShred || 0,
      rider: base.rider || null,
      stab: true,
      ultimate: true,
      fact: base.fact || null
    };
  }

  // ---------------------------------------------------------------------------
  // Magic — the balancing force of the Kingdom
  // ---------------------------------------------------------------------------
  // Small birds channel more of the kingdom's magic. When a bird object does
  // not carry a mag stat (legacy saves), derive one from its physical bulk:
  // the smaller the bird (low ATK, low HP), the higher its MAG.
  function deriveMagic(bird) {
    const explicit = Number(bird && bird.mag);
    if (Number.isFinite(explicit) && explicit > 0) return Math.round(explicit);
    const atk = Number(bird && bird.atk); const maxHp = Number(bird && bird.maxHp);
    const level = Math.max(1, Number(bird && bird.level) || 1);
    const levelMult = 1 + (level - 1) * 0.05;
    const atkBase = (Number.isFinite(atk) ? atk : 40) / levelMult;
    const hpBase = (Number.isFinite(maxHp) ? maxHp : 80) / levelMult;
    // bulk 0 (tiny) .. ~100 (giant)
    const bulk = Math.max(0, Math.min(100, (atkBase + Math.max(0, hpBase - 40)) / 2));
    return Math.max(20, Math.round((112 - bulk * 0.85) * levelMult));
  }

  // Magic resistance: grit plus cleverness plus a share of raw magic.
  function deriveResist(f) {
    return Math.max(10, Math.round(f.def * 0.35 + f.int * 0.3 + f.mag * 0.2));
  }

  // ---------------------------------------------------------------------------
  // Fighters
  // ---------------------------------------------------------------------------
  function hashString(value) {
    let h = 2166136261;
    const s = String(value || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function seededRandom(seed) {
    let state = hashString(seed) || 1;
    return function() {
      state ^= state << 13; state >>>= 0;
      state ^= state >>> 17; state >>>= 0;
      state ^= state << 5; state >>>= 0;
      return (state >>> 0) / 4294967296;
    };
  }
  function n(v, fallback) { const num = Number(v); return Number.isFinite(num) ? num : fallback; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function birdName(bird) { return String(bird.customName || '').trim() || bird.commonName || bird.species || bird.name || 'Burb'; }

  function disciplineTier(count) {
    let tier = 0;
    for (let i = 0; i < TIER_THRESHOLDS.length; i++) if (count >= TIER_THRESHOLDS[i]) tier = i + 1;
    return tier; // 0..3
  }

  // Trained moves: the bird's two best-trained disciplines, at their unlocked tier.
  function trainedMoves(disciplines) {
    const d = disciplines || {};
    return Object.keys(MOVE_LINES)
      .map(school => ({ school, count: n(d[school], 0), tier: disciplineTier(n(d[school], 0)) }))
      .filter(x => x.tier > 0)
      .sort((a, b) => b.count - a.count || a.school.localeCompare(b.school))
      .slice(0, 2)
      .map(x => {
        const def = MOVE_LINES[x.school][x.tier - 1];
        const schoolMeta = MOVE_SCHOOLS[x.school];
        return { ...def, school: x.school, stat: schoolMeta.stat, icon: schoolMeta.icon, tier: x.tier };
      });
  }

  // Gear bonuses: pass the summed stat bonuses of equipped items on
  // bird.gear (or opts.gear), e.g. { atk:8, mag:0, def:5, res:3, spd:2,
  // maxHp:20, critBonus:0.05, focusStart:1 }. BurbzLootCore.equipmentBonuses
  // produces this shape from an equipped loadout.
  function buildFighter(bird, options) {
    const opts = options || {};
    const typeId = opts.typeId || classifySpecies(bird.species || bird.commonName);
    const disciplines = opts.disciplines || (bird.academy && bird.academy.disciplines) || {};
    const gear = opts.gear || bird.gear || {};
    const g = k => n(gear[k], 0);
    const stamina = n(bird.stamina, 50) ;
    const maxHp = Math.max(40, n(bird.maxHp, 80)) + g('maxHp');
    const hpRatio = clamp(n(bird.hp, n(bird.maxHp, 80)) / Math.max(1, n(bird.maxHp, 80)), 0, 1);
    const hp = Math.round(maxHp * hpRatio);
    const mag = Math.max(5, deriveMagic(bird) + g('mag'));
    const f = {
      id: String(bird.id || (speciesKey(birdName(bird)) + '_' + hashString(birdName(bird)))),
      birdId: bird.id || null,
      name: birdName(bird),
      species: bird.species || birdName(bird),
      type: typeId,
      level: n(bird.level, 1),
      rarity: bird.rarity || 'common',
      artUrl: bird.artUrl || null,
      emoji: bird.emoji || '🐦',
      maxHp, hp,
      atk: n(bird.atk, 40) + g('atk'),
      def: n(bird.def, 40) + g('def'),
      spd: n(bird.spd, 40) + g('spd'),
      int: n(bird.int, 45), cha: n(bird.cha, 45), stamina,
      mag,
      critBonus: g('critBonus'),
      cr: 0,                    // combat readiness 0..100
      mods: [],                 // [{stat, pct, turns}] — buffs positive, debuffs negative
      barrier: 0,               // flat damage-absorbing shield HP
      fainted: hp <= 0
    };
    f.res = deriveResist(f) + g('res');
    const basic = { ...(f.mag > f.atk ? SPARK : PECK) };
    const sig = signatureFor(bird.species || bird.commonName, typeId);
    sig.stat = f.mag > f.atk ? 'mag' : 'atk';
    f.skills = [basic, { ...PARLEY }, ...trainedMoves(disciplines), sig].map(s => ({
      ...s,
      cdLeft: s.ultimate ? ULTIMATE_OPENING_CD : 0
    }));
    return f;
  }

  // Give an AI opponent a believable training history for its tier.
  function buildOpponentFighter(bird, tier, seedStr) {
    const typeId = classifySpecies(bird.species || bird.commonName);
    const rng = seededRandom(seedStr || (birdName(bird) + '_' + tier));
    const schools = Object.keys(MOVE_LINES);
    const disciplines = {};
    const t = clamp(Math.round(n(tier, 0)), 0, 6);
    const trainedCount = t <= 0 ? (rng() < 0.5 ? 1 : 0) : Math.min(2, 1 + Math.floor(t / 2));
    const sessionsByTier = [1, 1, 3, 3, 6, 6, 6];
    for (let i = 0; i < trainedCount; i++) {
      const school = schools[Math.floor(rng() * schools.length)];
      disciplines[school] = Math.max(disciplines[school] || 0, sessionsByTier[t]);
    }
    return buildFighter(bird, { typeId, disciplines });
  }

  // ---------------------------------------------------------------------------
  // Skyclash squad battle state machine
  // ---------------------------------------------------------------------------
  const FOCUS_MAX = 10;
  const SURGE_COST = 4;   // burn Focus to Surge a skill: +40% output, +15% crit

  function createBattle(config) {
    const player = (config.playerFighters || []).filter(Boolean).slice(0, 4);
    const opponent = (config.opponentFighters || []).filter(Boolean).slice(0, 4);
    if (!player.length || !opponent.length) throw new Error('Both sides need at least one fighter');
    // Everyone opens partway up the meter so first turns come quickly and
    // faster birds still act first.
    [player, opponent].forEach(team => team.forEach(f => { f.cr = 35; }));
    return {
      version: 3,
      seed: config.seed || ('battle_' + player.length + '_' + opponent.length),
      rngState: hashString(config.seed || 'battle') || 1,
      tier: n(config.tier, 0),
      turn: 0,
      teams: { player, opponent },
      focus: { player: n(config.playerFocusStart, 0), opponent: 0 },
      acting: null,        // {side, index} once the meter fills
      phase: 'tick',       // tick | act | over
      winner: null
    };
  }

  // RNG that persists inside the battle object (survives JSON round-trips).
  function battleRng(battle) {
    let s = battle.rngState >>> 0 || 1;
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s >>>= 0; s ^= s << 5; s >>>= 0;
    battle.rngState = s;
    return s / 4294967296;
  }

  function livingFighters(battle, side) {
    return battle.teams[side].map((f, i) => ({ f, i })).filter(x => !x.f.fainted);
  }
  function teamAlive(battle, side) { return battle.teams[side].some(f => !f.fainted); }
  function actingFighter(battle) {
    return battle.acting ? battle.teams[battle.acting.side][battle.acting.index] : null;
  }

  function effStat(fighter, stat) {
    const base = n(fighter[stat], 40);
    const pct = (fighter.mods || []).filter(m => m.stat === stat).reduce((s, m) => s + m.pct, 0);
    return Math.max(5, Math.round(base * (1 + clamp(pct, -0.6, 0.8))));
  }

  // Advance the Combat Readiness meter until one bird reaches 100 and becomes
  // the acting fighter. Returns {side, index, fighter} or null when over.
  function tickToNextTurn(battle) {
    if (battle.phase === 'over') return null;
    if (battle.phase === 'act' && battle.acting) {
      const f = actingFighter(battle);
      return { ...battle.acting, fighter: f };
    }
    const all = [];
    ['player', 'opponent'].forEach(side => livingFighters(battle, side).forEach(x => all.push({ side, index: x.i, f: x.f })));
    if (!all.length) return null;
    let bestT = Infinity;
    all.forEach(e => {
      const spd = Math.max(5, effStat(e.f, 'spd'));
      const t = Math.max(0, (100 - e.f.cr) / spd);
      e.t = t; e.spdNow = spd;
      if (t < bestT) bestT = t;
    });
    all.forEach(e => { e.f.cr = Math.min(100, e.f.cr + e.spdNow * bestT); });
    const ready = all.filter(e => e.f.cr >= 100 - 1e-9)
      .sort((a, b) => b.f.cr - a.f.cr || b.spdNow - a.spdNow || (a.side === 'player' ? -1 : 1));
    const next = ready[0];
    next.f.cr = 100;
    battle.acting = { side: next.side, index: next.index };
    battle.phase = 'act';
    battle.turn += 1;
    // Cooldowns tick down at the start of the bird's own turn.
    next.f.skills.forEach(s => { if (s.cdLeft > 0) s.cdLeft -= 1; });
    return { side: next.side, index: next.index, fighter: next.f };
  }

  // Turn-order forecast for the UI timeline strip (next `count` turns).
  function forecastTurnOrder(battle, count) {
    const sim = [];
    ['player', 'opponent'].forEach(side => livingFighters(battle, side).forEach(x =>
      sim.push({ side, index: x.i, name: x.f.name, emoji: x.f.emoji, artUrl: x.f.artUrl, cr: x.f.cr, spd: Math.max(5, effStat(x.f, 'spd')) })));
    const out = [];
    const max = Math.max(1, Math.min(12, n(count, 6)));
    for (let k = 0; k < max && sim.length; k++) {
      let bestT = Infinity, best = null;
      sim.forEach(e => { const t = Math.max(0, (100 - e.cr) / e.spd); if (t < bestT) { bestT = t; best = e; } });
      sim.forEach(e => { e.cr = Math.min(100, e.cr + e.spd * bestT); });
      out.push({ side: best.side, index: best.index, name: best.name, emoji: best.emoji, artUrl: best.artUrl });
      best.cr = 0;
    }
    return out;
  }

  function skillUsable(fighter, skill) { return (skill.cdLeft || 0) <= 0; }

  // Actions available to the acting fighter (for the UI and the AI).
  function availableActions(battle) {
    const f = actingFighter(battle);
    if (!f) return [];
    const foeSide = battle.acting.side === 'player' ? 'opponent' : 'player';
    const targets = livingFighters(battle, foeSide).map(x => x.i);
    const allies = livingFighters(battle, battle.acting.side).map(x => x.i);
    return f.skills.map((s, i) => ({
      kind: 'skill',
      skillIndex: i,
      skill: s,
      usable: skillUsable(f, s),
      needsTarget: (s.kind === 'attack' || s.kind === 'parley') && !s.aoe,
      targets: (s.kind === 'attack' || s.kind === 'parley') ? targets : allies,
      canSurge: battle.focus[battle.acting.side] >= SURGE_COST && s.school !== 'basic'
    }));
  }

  function addFocus(battle, side, amount) {
    battle.focus[side] = clamp(battle.focus[side] + amount, 0, FOCUS_MAX);
  }

  function computeDamage(battle, attacker, defender, skill, opts) {
    const o = opts || {};
    const stat = skill.stat === 'auto' ? (attacker.mag > attacker.atk ? 'mag' : 'atk') : (skill.stat || 'atk');
    const magic = stat === 'mag';
    const attStat = effStat(attacker, magic ? 'mag' : 'atk');
    const defStat = effStat(defender, magic ? 'res' : 'def');
    const { mult, fact } = effectiveness(attacker.type, defender.type);
    let critChance = clamp(0.08 + effStat(attacker, 'int') / 800 + (attacker.critBonus || 0), 0.05, 0.5);
    if (skill.rider && skill.rider.kind === 'crit') critChance = clamp(critChance + skill.rider.bonus, 0, 0.65);
    if (o.surge) critChance = clamp(critChance + 0.15, 0, 0.8);
    const crit = battleRng(battle) < critChance;
    const stab = skill.stab ? 1.2 : 1;
    const variance = 0.9 + battleRng(battle) * 0.2;
    const pierce = !!(skill.rider && skill.rider.kind === 'pierce');
    let raw = (4 + skill.power * (attStat / ((defStat + 70) * 1.6))) * mult * stab * variance * (crit ? 1.5 : 1);
    if (o.surge) raw *= 1.4;
    if (o.aoeSplit) raw *= 0.72;
    let absorbed = 0;
    if (defender.barrier > 0 && !pierce) {
      absorbed = Math.min(defender.barrier, raw);
      defender.barrier = Math.round(defender.barrier - absorbed);
      raw -= absorbed;
    }
    return { dmg: Math.max(pierce || absorbed <= 0 ? 1 : 0, Math.round(raw)), crit, mult, fact, magic, absorbed: Math.round(absorbed), pierced: pierce && defender.barrier > 0 };
  }

  function applyHeal(fighter, amount) {
    const healed = Math.max(0, Math.min(Math.round(amount), fighter.maxHp - fighter.hp));
    fighter.hp += healed;
    return healed;
  }

  function pushCr(fighter, pct) {
    if (!fighter.fainted) fighter.cr = clamp(fighter.cr + pct * 100, 0, 99.5);
  }

  function applyRider(battle, skill, attacker, defender, events, side, defSide) {
    const rider = skill.rider;
    if (!rider) return;
    if (rider.kind === 'debuff' && defender) {
      defender.mods.push({ stat: rider.stat, pct: -rider.pct, turns: rider.turns });
      events.push({ type:'debuff', side: defSide, name: defender.name, stat: rider.stat,
        text: defender.name + '\'s ' + rider.stat.toUpperCase() + ' drops ' + Math.round(rider.pct * 100) + '%!' });
    } else if (rider.kind === 'buff') {
      attacker.mods.push({ stat: rider.stat, pct: rider.pct, turns: rider.turns });
      events.push({ type:'buff', side, name: attacker.name, stat: rider.stat,
        text: attacker.name + '\'s ' + rider.stat.toUpperCase() + ' rises ' + Math.round(rider.pct * 100) + '%!' });
    } else if (rider.kind === 'steal') {
      const stolen = Math.min(rider.focus || 2, battle.focus[defSide]);
      battle.focus[defSide] -= stolen;
      addFocus(battle, side, stolen);
      if (stolen > 0) events.push({ type:'steal', side, text: attacker.name + ' steals ' + stolen + ' Focus!' });
    } else if (rider.kind === 'heal') {
      const healed = applyHeal(attacker, attacker.maxHp * rider.pct);
      if (healed > 0) events.push({ type:'heal', side, name: attacker.name, healed, hp: attacker.hp, maxHp: attacker.maxHp,
        text: attacker.name + ' recovers ' + healed + ' HP.' });
    }
    // 'crit' and 'pierce' riders are applied inside computeDamage.
  }

  function handleFaint(battle, defender, defSide, side, events) {
    if (defender.hp > 0 || defender.fainted) return;
    defender.fainted = true;
    defender.cr = 0;
    addFocus(battle, side, 2);
    // Beaten evil Burbz are never killed: the usurper's magic simply unravels.
    events.push({ type:'faint', side: defSide, name: defender.name,
      text: defSide === 'opponent'
        ? defender.name + '\'s dark magic unravels — the shadow scatters!'
        : defender.name + ' is out of the match!' });
  }

  // Resolve the acting fighter's chosen action.
  // action: { skillIndex, targetIndex?, surge? }
  function resolveAction(battle, action) {
    if (battle.phase !== 'act' || !battle.acting) throw new Error('No fighter is ready to act');
    const side = battle.acting.side;
    const defSide = side === 'player' ? 'opponent' : 'player';
    const attacker = actingFighter(battle);
    const events = [];
    let skill = attacker.skills[action.skillIndex] || attacker.skills[0];
    if (!skillUsable(attacker, skill)) skill = attacker.skills[0];
    let surge = !!action.surge && skill.school !== 'basic' && battle.focus[side] >= SURGE_COST;
    if (surge) {
      battle.focus[side] -= SURGE_COST;
      events.push({ type:'surge', side, name: attacker.name, text: attacker.name + ' surges with the flock\'s Focus!' });
    }
    skill.cdLeft = skill.cd || 0;
    if (skill.focusGain) addFocus(battle, side, skill.focusGain);

    events.push({ type:'move', side, name: attacker.name, move: skill.label, school: skill.school, ultimate: !!skill.ultimate,
      text: attacker.name + ' uses ' + skill.label + '!' });

    if (skill.kind === 'attack') {
      const foes = livingFighters(battle, defSide);
      let targets;
      if (skill.aoe) targets = foes.map(x => x.f);
      else {
        const chosen = foes.find(x => x.i === action.targetIndex) || foes[0];
        targets = [chosen.f];
      }
      let anyCrit = false;
      targets.forEach(defender => {
        const res = computeDamage(battle, attacker, defender, skill, { surge, aoeSplit: skill.aoe && targets.length > 1 });
        defender.hp = Math.max(0, defender.hp - res.dmg);
        anyCrit = anyCrit || res.crit;
        events.push({ type:'damage', side: defSide, name: defender.name, targetIndex: battle.teams[defSide].indexOf(defender),
          dmg: res.dmg, crit: res.crit, mult: res.mult, magic: res.magic, hp: defender.hp, maxHp: defender.maxHp,
          text: defender.name + ' takes ' + res.dmg + (res.magic ? ' magic' : '') + ' damage' + (res.crit ? ' — critical hit!' : '.') });
        if (res.mult > 1) events.push({ type:'fact', side, text: 'Super effective! ' + (res.fact || '') });
        else if (res.mult < 1) events.push({ type:'info', side, text: 'Not very effective...' });
        if (res.pierced) events.push({ type:'info', side, text: skill.label + ' pierces straight through the barrier!' });
        else if (res.absorbed > 0) events.push({ type:'info', side: defSide, text: defender.name + '\'s barrier absorbs ' + res.absorbed + ' damage.' });
        if (skill.crShred) { defender.cr = clamp(defender.cr - skill.crShred * 100, 0, 100); events.push({ type:'cr', side: defSide, name: defender.name, text: defender.name + ' is knocked down the turn meter!' }); }
        handleFaint(battle, defender, defSide, side, events);
        if (!defender.fainted) applyRider(battle, skill, attacker, defender, events, side, defSide);
        else if (skill.rider && (skill.rider.kind === 'heal' || skill.rider.kind === 'buff' || skill.rider.kind === 'steal')) applyRider(battle, skill, attacker, null, events, side, defSide);
      });
      if (anyCrit) addFocus(battle, side, 1);
      if (skill.ultimate && skill.fact && battle.turn <= 14) events.push({ type:'fact', side, text: skill.fact });
      if (skill.crPushSelf) { pushCr(attacker, skill.crPushSelf); events.push({ type:'cr', side, name: attacker.name, text: attacker.name + ' races back up the turn meter!' }); }
    } else if (skill.kind === 'parley') {
      const foes = livingFighters(battle, defSide);
      const chosen = foes.find(x => x.i === action.targetIndex) || foes[0];
      const defender = chosen.f;
      const charm = effStat(attacker, 'cha');
      const resolve = charmResolve(defender);
      const surgeMult = surge ? 1.35 : 1;
      events.push({ type:'parley', side, name: attacker.name, target: defender.name,
        text: attacker.name + ' parleys with ' + defender.name + ' — pure charm against the will to fight!' });
      // Only the player's flock can truly win hearts: the usurper's silver
      // tongue can rattle morale, but never turns a loyal companion.
      const winChance = clamp((charm / resolve) * 0.5 * surgeMult, 0.1, 0.85);
      const canWinOver = side === 'player' && defender.hp <= defender.maxHp * PARLEY_WINOVER_HP_PCT;
      if (canWinOver && battleRng(battle) < winChance) {
        defender.fainted = true;
        defender.swayed = true;
        defender.cr = 0;
        battle.swayed = battle.swayed || { player: 0, opponent: 0 };
        battle.swayed[side] += 1;
        addFocus(battle, side, 2);
        events.push({ type:'sway', side: defSide, name: defender.name, targetIndex: battle.teams[defSide].indexOf(defender),
          text: defender.name + ' is won over! The usurper\'s shadow lifts and the bird bows out of the fight in peace.' });
      } else {
        const swayPct = clamp((charm / resolve) * 0.22 * surgeMult, 0.08, 0.4);
        defender.mods.push({ stat:'atk', pct:-swayPct, turns:2 });
        defender.mods.push({ stat:'mag', pct:-swayPct, turns:2 });
        const shred = clamp((charm / resolve) * 0.15, 0.05, 0.25);
        defender.cr = clamp(defender.cr - shred * 100, 0, 100);
        events.push({ type:'debuff', side: defSide, name: defender.name, stat:'atk',
          text: defender.name + ' wavers — its will to fight drops ' + Math.round(swayPct * 100) + '%!' });
        if (canWinOver) events.push({ type:'info', side, text: defender.name + ' nearly turns... one more kind word might do it.' });
        else if (side === 'player' && defender.hp > defender.maxHp * PARLEY_WINOVER_HP_PCT) events.push({ type:'info', side, text: 'Too proud to turn yet — wear ' + defender.name + ' down below ' + Math.round(PARLEY_WINOVER_HP_PCT * 100) + '% HP, then parley again.' });
      }
    } else if (skill.kind === 'barrier') {
      const scale = surge ? 1.4 : 1;
      const strength = f => Math.round(f.maxHp * skill.barrierPct * scale);
      const allies = skill.teamWide ? livingFighters(battle, side).map(x => x.f) : [attacker];
      allies.forEach(f => { f.barrier = Math.max(f.barrier, strength(f)); });
      events.push({ type:'barrier', side, name: attacker.name,
        text: (skill.teamWide ? 'The whole flock is wrapped in a woven barrier!' : attacker.name + ' weaves a barrier of feathers and light!') });
      applyRider(battle, skill, attacker, null, events, side, defSide);
    } else if (skill.kind === 'heal') {
      const scale = (surge ? 1.4 : 1) * (0.75 + effStat(attacker, 'mag') / 220);
      const allies = skill.teamWide ? livingFighters(battle, side).map(x => x.f) : [attacker];
      allies.forEach(f => {
        const healed = applyHeal(f, f.maxHp * skill.healPct * scale);
        if (skill.cleanse) f.mods = f.mods.filter(m => m.pct > 0);
        if (healed > 0) events.push({ type:'heal', side, name: f.name, healed, hp: f.hp, maxHp: f.maxHp,
          text: f.name + ' recovers ' + healed + ' HP' + (skill.cleanse ? ' and shakes off bad effects.' : '.') });
      });
    } else if (skill.kind === 'buff') {
      const allies = skill.teamWide ? livingFighters(battle, side).map(x => x.f) : [attacker];
      allies.forEach(f => {
        if (skill.rider) {
          f.mods.push({ stat: skill.rider.stat, pct: skill.rider.pct * (surge ? 1.3 : 1), turns: skill.rider.turns });
          if (skill.alsoStat) f.mods.push({ stat: skill.alsoStat, pct: skill.rider.pct * (surge ? 1.3 : 1), turns: skill.rider.turns });
        }
        if (skill.healPct) applyHeal(f, f.maxHp * skill.healPct);
      });
      events.push({ type:'buff', side, name: attacker.name,
        text: (skill.teamWide ? 'The whole flock rallies to ' + attacker.name + '\'s song!' : attacker.name + ' rallies!') });
    }

    // End of the acting bird's turn: tick its effect durations, reset meter.
    attacker.mods = (attacker.mods || []).map(m => ({ ...m, turns: m.turns - 1 })).filter(m => m.turns > 0);
    attacker.cr = 0;
    battle.acting = null;
    battle.phase = 'tick';

    // Winner check.
    if (!teamAlive(battle, 'opponent')) {
      battle.phase = 'over'; battle.winner = 'player';
      events.push({ type:'end', winner:'player', text:'Victory! The evil Burbz squad breaks and the darkness retreats a little further.' });
    } else if (!teamAlive(battle, 'player')) {
      battle.phase = 'over'; battle.winner = 'opponent';
      events.push({ type:'end', winner:'opponent', text:'Defeat... the evil Burbz hold the perch. Your flock needs rest and more training.' });
    }
    return events;
  }

  // AI: score every usable skill/target pair, pick the best with noise.
  function aiChooseAction(battle) {
    const side = battle.acting.side;
    const foeSide = side === 'player' ? 'opponent' : 'player';
    const me = actingFighter(battle);
    const foes = livingFighters(battle, foeSide);
    const allies = livingFighters(battle, side);
    let best = null;
    const consider = (action, score) => {
      score *= 0.85 + battleRng(battle) * 0.3;
      if (!best || score > best.score) best = { action, score };
    };
    me.skills.forEach((s, i) => {
      if (!skillUsable(me, s)) return;
      if (s.kind === 'attack') {
        const stat = s.stat === 'auto' ? (me.mag > me.atk ? 'mag' : 'atk') : (s.stat || 'atk');
        foes.forEach(x => {
          const defStat = effStat(x.f, stat === 'mag' ? 'res' : 'def');
          const mult = effectiveness(me.type, x.f.type).mult;
          let score = (4 + s.power * (effStat(me, stat) / ((defStat + 70) * 1.6))) * mult * (s.stab ? 1.2 : 1);
          if (s.aoe) score *= 0.72 * foes.length;
          if (x.f.hp < score * 1.15) score *= 2.2; // go for the finish
          if (x.f.barrier > 0 && !(s.rider && s.rider.kind === 'pierce')) score *= 0.8;
          consider({ skillIndex: i, targetIndex: x.i, surge: battle.focus[side] >= SURGE_COST + 2 && s.school !== 'basic' }, score);
        });
      } else if (s.kind === 'parley') {
        // Charmers reach for diplomacy; brutes barely bother. The AI can't
        // win foes over (that grace is the player's), so it values the sway.
        const charm = effStat(me, 'cha');
        foes.forEach(x => {
          const pull = charm / charmResolve(x.f);
          consider({ skillIndex: i, targetIndex: x.i }, 6 + pull * 18);
        });
      } else if (s.kind === 'heal') {
        const hurt = allies.filter(x => x.f.hp < x.f.maxHp * 0.5).length;
        consider({ skillIndex: i }, me.hp < me.maxHp * 0.4 || (s.teamWide && hurt >= 2) ? 40 + hurt * 14 : 3);
      } else if (s.kind === 'barrier') {
        consider({ skillIndex: i }, me.barrier <= 0 && battle.turn <= allies.length * 3 ? 30 : 5);
      } else if (s.kind === 'buff') {
        consider({ skillIndex: i }, battle.turn <= allies.length * 2 && !me.mods.some(x => x.pct > 0) ? 28 : 6);
      }
    });
    return best ? best.action : { skillIndex: 0, targetIndex: foes.length ? foes[0].i : 0 };
  }

  // ---------------------------------------------------------------------------
  // Perch League — the war's front line against the evil Burbz.
  // Each habitat tier is patrolled by stronger shadow squads; ladder + reward
  // economy stays tunable in one place.
  // ---------------------------------------------------------------------------
  const LEAGUE_TIERS = [
    { id:'garden',   label:'Garden Perch',     icon:'🌼', rarities:['common'],            favoredTypes:['songbird','groundbird'], levelBoost:0, winCoins:12, winBranches:2,  promoteWins:3, promoCoins:40,  promoBranches:12, copy:'Shadow scouts probe the garden hedges — the weakest of the evil Burbz.' },
    { id:'hedgerow', label:'Hedgerow Cup',     icon:'🌿', rarities:['common','uncommon'], favoredTypes:['songbird','trickster'],  levelBoost:1, winCoins:18, winBranches:3,  promoteWins:3, promoCoins:60,  promoBranches:16, copy:'Evil Burbz raiders haunt the farm hedges and lanes.' },
    { id:'woodland', label:'Woodland Crown',   icon:'🌳', rarities:['uncommon'],          favoredTypes:['trickster','songbird'],  levelBoost:2, winCoins:24, winBranches:4,  promoteWins:3, promoCoins:80,  promoBranches:20, copy:'Deep woods crawl with the shadow\'s corrupted tricksters.' },
    { id:'river',    label:'River Trophy',     icon:'🏞️', rarities:['uncommon','rare'],   favoredTypes:['waterbird'],             levelBoost:3, winCoins:30, winBranches:5,  promoteWins:3, promoCoins:100, promoBranches:26, copy:'Waterlogged evil Burbz bruisers patrol the riverbanks.' },
    { id:'coast',    label:'Coastal Gauntlet', icon:'⚓', rarities:['rare'],              favoredTypes:['waterbird','skydancer'], levelBoost:4, winCoins:38, winBranches:6,  promoteWins:3, promoCoins:130, promoBranches:32, copy:'Cliff colonies swarm with sea-hardened shadow squads.' },
    { id:'highland', label:'Highland Talons',  icon:'🏔️', rarities:['rare','epic'],       favoredTypes:['raptor'],                levelBoost:5, winCoins:46, winBranches:8,  promoteWins:3, promoCoins:170, promoBranches:40, copy:'The usurper\'s raptor elite rule the high crags. Bring counters or bandages.' },
    { id:'sky',      label:'Sky Court',        icon:'👑', rarities:['epic','legendary'],  favoredTypes:null,                      levelBoost:6, winCoins:56, winBranches:10, promoteWins:0, promoCoins:0,   promoBranches:0,  copy:'The endless summit — the dark lord\'s own legendary guard.' }
  ];

  // Diminishing returns after this many wins per day keeps battle grinding from
  // out-earning quests; the first win of the day pays double coins.
  const DAILY_FULL_REWARD_WINS = 6;
  const REDUCED_REWARD_PCT = 0.3;

  function battleRewards(tierIndex, winner, opts) {
    const ti = clamp(n(tierIndex, 0), 0, LEAGUE_TIERS.length - 1);
    const tier = LEAGUE_TIERS[ti];
    const o = opts || {};
    if (winner !== 'player') {
      return { coins: 4, branches: 0, birdXp: 8, playerXp: 10, firstWinBonus: false, reduced: false, swayed: 0, charmCoins: 0 };
    }
    let coins = tier.winCoins;
    let branches = tier.winBranches;
    let reduced = false;
    if (n(o.winsToday, 0) >= DAILY_FULL_REWARD_WINS) {
      coins = Math.max(2, Math.round(coins * REDUCED_REWARD_PCT));
      branches = Math.max(0, Math.round(branches * REDUCED_REWARD_PCT));
      reduced = true;
    }
    const firstWinBonus = !!o.firstWinOfDay;
    if (firstWinBonus) coins *= 2;
    // Charm diplomacy pays: every foe won over by Parley leaves goodwill
    // gifts instead of a grudge. Never reduced — kindness doesn't grind.
    const swayed = Math.max(0, Math.round(n(o.swayed, 0)));
    const charmCoins = swayed * (6 + ti * 3);
    return { coins, branches, birdXp: 22 + ti * 7, playerXp: 30 + ti * 10, firstWinBonus, reduced, swayed, charmCoins };
  }

  return {
    BIRD_TYPES, TYPE_CHART, TYPE_FACTS, effectiveness, classifySpecies, speciesKey,
    MOVE_SCHOOLS, MOVE_LINES, TIER_THRESHOLDS, PECK, SPARK, PARLEY, PARLEY_WINOVER_HP_PCT, charmResolve, SIGNATURES, CLASS_SIGNATURES, signatureFor,
    ULTIMATE_CD, ULTIMATE_OPENING_CD, FOCUS_MAX, SURGE_COST,
    deriveMagic, deriveResist,
    disciplineTier, trainedMoves, buildFighter, buildOpponentFighter,
    createBattle, tickToNextTurn, forecastTurnOrder, availableActions, resolveAction, aiChooseAction,
    actingFighter, livingFighters, teamAlive, effStat, skillUsable,
    LEAGUE_TIERS, battleRewards, DAILY_FULL_REWARD_WINS,
    hashString, seededRandom
  };
});
