// Burbz Battle Core v2 — "Perch League"
// A Pokémon-style turn-based battle engine for real birds.
// Every species gets a WING CLASS from its real biology; type matchups are
// grounded in genuine bird behaviour (corvids mob raptors, sparrowhawks hunt
// songbirds, swifts outfly falcons). Moves come from Academy training: six
// disciplines map to six move schools, so a bird fights the way it trained.
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
  const MOVE_SCHOOLS = {
    strike: { id:'strike', label:'Strike', icon:'⚔️', stat:'atk',     room:'training',    roomLabel:'Training Hall' },
    guard:  { id:'guard',  label:'Guard',  icon:'🛡️', stat:'def',     room:'workshop',    roomLabel:'Nest Workshop' },
    aero:   { id:'aero',   label:'Aero',   icon:'🪽', stat:'spd',     room:'training',    roomLabel:'Training Hall' },
    mind:   { id:'mind',   label:'Mind',   icon:'🧠', stat:'int',     room:'observatory', roomLabel:'Moon Observatory' },
    song:   { id:'song',   label:'Song',   icon:'🎵', stat:'cha',     room:'crowbar',     roomLabel:'The Crowbar' },
    endure: { id:'endure', label:'Endure', icon:'🌰', stat:'stamina', room:'kitchen',     roomLabel:'Kitchen & Pantry' }
  };

  // Tier unlocks at 1 / 3 / 6 claimed training sessions in the discipline.
  const TIER_THRESHOLDS = [1, 3, 6];

  const MOVE_LINES = {
    strike: [
      { id:'talon_jab',      label:'Talon Jab',      power:40, cost:28, kind:'attack' },
      { id:'power_strike',   label:'Power Strike',   power:58, cost:38, kind:'attack' },
      { id:'tempest_talons', label:'Tempest Talons', power:80, cost:52, kind:'attack' }
    ],
    aero: [
      { id:'quick_dart', label:'Quick Dart', power:30, cost:24, kind:'attack', priority:1 },
      { id:'wind_slash', label:'Wind Slash', power:45, cost:34, kind:'attack', priority:1 },
      { id:'sonic_dive', label:'Sonic Dive', power:62, cost:48, kind:'attack', priority:1 }
    ],
    mind: [
      { id:'sharp_eyes',  label:'Sharp Eyes',  power:28, cost:24, kind:'attack', rider:{ kind:'debuff', stat:'def', pct:0.12, turns:3 } },
      { id:'outsmart',    label:'Outsmart',    power:42, cost:34, kind:'attack', rider:{ kind:'debuff', stat:'def', pct:0.18, turns:3 } },
      { id:'master_plan', label:'Master Plan', power:56, cost:48, kind:'attack', rider:{ kind:'debuff', stat:'def', pct:0.25, turns:3 } }
    ],
    guard: [
      { id:'feather_guard', label:'Feather Guard', power:0, cost:22, kind:'shield', shieldPct:0.35, shieldTurns:2 },
      { id:'nest_wall',     label:'Nest Wall',     power:0, cost:32, kind:'shield', shieldPct:0.45, shieldTurns:2 },
      { id:'iron_plumage',  label:'Iron Plumage',  power:0, cost:44, kind:'shield', shieldPct:0.55, shieldTurns:3 }
    ],
    song: [
      { id:'rally_chirp',   label:'Rally Chirp',   power:0, cost:24, kind:'buff', rider:{ kind:'buff', stat:'atk', pct:0.15, turns:3 } },
      { id:'morale_anthem', label:'Morale Anthem', power:0, cost:34, kind:'buff', rider:{ kind:'buff', stat:'atk', pct:0.22, turns:3 }, healPct:0.08 },
      { id:'dawn_chorus',   label:'Dawn Chorus',   power:0, cost:48, kind:'buff', rider:{ kind:'buff', stat:'atk', pct:0.30, turns:3 }, healPct:0.15, teamHeal:true }
    ],
    endure: [
      { id:'second_wind',    label:'Second Wind',    power:0, cost:20, kind:'heal', healPct:0.22 },
      { id:'deep_roost',     label:'Deep Roost',     power:0, cost:30, kind:'heal', healPct:0.32, cleanse:true },
      { id:'marathon_heart', label:'Marathon Heart', power:0, cost:40, kind:'heal', healPct:0.42, cleanse:true }
    ]
  };

  const PECK = { id:'peck', label:'Peck', icon:'🐤', school:'basic', stat:'atk', power:20, cost:0, gain:15, kind:'attack', copy:'Free jab that builds energy.' };

  // ---------------------------------------------------------------------------
  // Signature moves — curated, real-behaviour flavoured, per famous species
  // ---------------------------------------------------------------------------
  // rider kinds: debuff (enemy), buff (self), steal (energy), heal (self),
  // pierce (ignores shields), crit (bonus crit chance).
  const SIGNATURES = [
    { match:['peregrine'], label:'Hunting Stoop', power:88, cost:55, rider:{ kind:'crit', bonus:0.2 }, fact:'Peregrines dive at over 300 km/h — the fastest animal on Earth.' },
    { match:['golden_eagle'], label:'Sky Hammer', power:92, cost:58, fact:'Golden eagles knock prey off cliffsides with 2-metre wings.' },
    { match:['harpy_eagle'], label:'Canopy King', power:95, cost:60, fact:'Harpy eagle talons are bigger than a grizzly bear\'s claws.' },
    { match:['bald_eagle'], label:'Freedom Dive', power:86, cost:55, fact:'Bald eagles snatch fish without ever breaking flight.' },
    { match:['white_tailed_eagle','steller_sea_eagle','african_fish_eagle','wedge_tailed_eagle'], label:'Sea King Sweep', power:88, cost:56, fact:'Sea eagles carry off prey more than half their own weight.' },
    { match:['sparrowhawk','goshawk'], label:'Hedge Ambush', power:74, cost:48, rider:{ kind:'crit', bonus:0.25 }, fact:'Sparrowhawks thread hedges at full speed to surprise their prey.' },
    { match:['kite'], label:'Carrion Spiral', power:64, cost:44, rider:{ kind:'heal', pct:0.1 }, fact:'Kites patrol in lazy spirals, stealing scraps mid-air.' },
    { match:['kestrel'], label:'Wind Hover', power:60, cost:42, rider:{ kind:'crit', bonus:0.2 }, fact:'Kestrels hold perfectly still in the wind, then drop like a dart.' },
    { match:['merlin'], label:'Moor Chase', power:66, cost:44, priority:1, fact:'Merlins run down songbirds in low, twisting pursuit flights.' },
    { match:['owl','boobook'], label:'Silent Ambush', power:72, cost:48, rider:{ kind:'crit', bonus:0.3 }, fact:'Fringed feathers make owl flight almost perfectly silent.' },
    { match:['osprey'], label:'Talon Splash', power:76, cost:50, fact:'Ospreys plunge feet-first and close their nostrils underwater.' },
    { match:['vulture','condor'], label:'Bone Breaker', power:70, cost:48, rider:{ kind:'pierce' }, fact:'Bearded vultures drop bones from height to crack them open.' },
    { match:['secretarybird'], label:'Serpent Stamp', power:88, cost:56, fact:'Secretarybirds kick snakes with five times their body weight.' },
    { match:['kookaburra'], label:'Laughing Judgement', power:68, cost:46, rider:{ kind:'debuff', stat:'atk', pct:0.15, turns:3 }, fact:'A kookaburra\'s dawn laugh warns rivals off its hunting ground.' },
    { match:['butcherbird'], label:'Larder Hook', power:70, cost:46, fact:'Butcherbirds wedge prey in tree forks — a hanging larder.' },
    { match:['frogmouth'], label:'Statue Strike', power:66, cost:44, rider:{ kind:'crit', bonus:0.25 }, fact:'Tawny frogmouths freeze like broken branches, then lunge.' },
    { match:['crow','raven','rook','jackdaw'], label:'Mob Rule', power:56, cost:42, rider:{ kind:'debuff', stat:'atk', pct:0.18, turns:3 }, fact:'Corvids recruit the whole neighbourhood to drive off raptors.' },
    { match:['australian_magpie'], label:'Swoop Season', power:66, cost:44, priority:1, fact:'Australian magpies dive-bomb anyone near the nest each spring.' },
    { match:['magpie'], label:'Shiny Snatch', power:50, cost:40, rider:{ kind:'steal', energy:20 }, fact:'Magpies are bold enough to raid anything left glittering.' },
    { match:['jay'], label:'Acorn Cache', power:48, cost:38, rider:{ kind:'heal', pct:0.12 }, fact:'A jay buries thousands of acorns a year — and remembers them.' },
    { match:['drongo'], label:'False Alarm', power:44, cost:38, rider:{ kind:'steal', energy:25 }, fact:'Drongos mimic alarm calls to scare others off their food — real con artists.' },
    { match:['lyrebird'], label:'Perfect Mimic', power:52, cost:40, rider:{ kind:'debuff', stat:'def', pct:0.2, turns:3 }, fact:'Lyrebirds imitate chainsaws, camera shutters and other birds flawlessly.' },
    { match:['mockingbird'], label:'Two Hundred Songs', power:50, cost:40, rider:{ kind:'debuff', stat:'atk', pct:0.15, turns:3 }, fact:'A mockingbird can learn over 200 different songs.' },
    { match:['cuckoo','koel'], label:'Nest Trick', power:54, cost:40, rider:{ kind:'debuff', stat:'def', pct:0.18, turns:3 }, fact:'Cuckoos fool other species into raising their chicks.' },
    { match:['kea'], label:'Puzzle Break', power:56, cost:42, rider:{ kind:'pierce' }, fact:'Keas solve multi-step puzzles — and dismantle parked cars.' },
    { match:['cockatoo','corella','galah'], label:'Crest Riot', power:58, cost:42, rider:{ kind:'pierce' }, fact:'Cockatoos learn to open bins — and teach the trick to others.' },
    { match:['parrot','macaw','parakeet','lorikeet','budgerigar','cockatiel','rosella'], label:'Vice Grip', power:58, cost:42, rider:{ kind:'pierce' }, fact:'A big parrot\'s bill cracks nuts no human hand could open.' },
    { match:['bowerbird'], label:'Blue Heist', power:48, cost:38, rider:{ kind:'steal', energy:22 }, fact:'Satin bowerbirds steal anything blue to decorate their bowers.' },
    { match:['frigatebird'], label:'Pirate Chase', power:54, cost:40, rider:{ kind:'steal', energy:25 }, fact:'Frigatebirds harass other seabirds until they drop their catch.' },
    { match:['toucan'], label:'Bill Toss', power:56, cost:42, fact:'Toucans toss fruit — and raid nests — with that giant bill.' },
    { match:['wren'], label:'Thunder Song', power:44, cost:36, rider:{ kind:'debuff', stat:'atk', pct:0.15, turns:3 }, fact:'Gram for gram, the wren has one of the loudest songs of any bird.' },
    { match:['robin'], label:'Winter Carol', power:42, cost:36, rider:{ kind:'buff', stat:'atk', pct:0.15, turns:3 }, fact:'Robins sing through winter and defend territory ferociously.' },
    { match:['nightingale'], label:'Midnight Aria', power:46, cost:38, rider:{ kind:'buff', stat:'atk', pct:0.18, turns:3 }, fact:'Nightingales sing over 200 song types, day and night.' },
    { match:['starling'], label:'Murmuration', power:40, cost:36, rider:{ kind:'buff', stat:'def', pct:0.2, turns:3 }, fact:'Starling murmurations swirl in thousands to confuse predators.' },
    { match:['skylark'], label:'Sky Anthem', power:42, cost:36, rider:{ kind:'buff', stat:'atk', pct:0.18, turns:3 }, fact:'Skylarks sing continuously while hovering high over their field.' },
    { match:['blackbird','song_thrush'], label:'Dusk Serenade', power:46, cost:38, rider:{ kind:'buff', stat:'atk', pct:0.15, turns:3 }, fact:'Song thrushes smash snails open on a favourite anvil stone.' },
    { match:['mistle_thrush'], label:'Storm Singer', power:50, cost:40, fact:'Mistle thrushes sing loudest from treetops in wild weather.' },
    { match:['woodpecker'], label:'Jackhammer', power:60, cost:42, rider:{ kind:'pierce' }, fact:'Woodpeckers strike wood up to 20 times a second without concussion.' },
    { match:['nuthatch'], label:'Headfirst Drop', power:48, cost:38, priority:1, fact:'Nuthatches are the only UK bird that walks down trees headfirst.' },
    { match:['goldcrest','firecrest'], label:'Pinpoint Dart', power:40, cost:34, priority:1, fact:'The goldcrest is the UK\'s smallest bird at just five grams.' },
    { match:['tit','chickadee','titmouse'], label:'Acro Peck', power:42, cost:36, priority:1, fact:'Tits hang upside-down to reach food nothing else can.' },
    { match:['goldfinch','chaffinch','greenfinch','bullfinch','crossbill','linnet','siskin','redpoll','finch'], label:'Thistle Dart', power:44, cost:36, fact:'Goldfinch beaks are fine-tuned tweezers for thistle seeds.' },
    { match:['sparrow'], label:'Street Gang', power:46, cost:38, rider:{ kind:'buff', stat:'atk', pct:0.12, turns:3 }, fact:'House sparrows squabble in gangs and fear almost nothing.' },
    { match:['swift'], label:'Scythe Wings', power:58, cost:42, priority:1, fact:'Swifts eat, drink and sleep on the wing for ten months straight.' },
    { match:['swallow','martin'], label:'Skimming Strike', power:52, cost:40, priority:1, fact:'Swallows drink by skimming ponds at full speed.' },
    { match:['hummingbird'], label:'Blur Wings', power:48, cost:36, priority:1, rider:{ kind:'steal', energy:15 }, fact:'Hummingbirds beat their wings 50 times a second and fly backwards.' },
    { match:['wagtail'], label:'Tail Feint', power:44, cost:36, priority:1, rider:{ kind:'debuff', stat:'atk', pct:0.12, turns:3 }, fact:'Willie wagtails fearlessly harass eagles a hundred times their size.' },
    { match:['fantail'], label:'Fan Dance', power:42, cost:36, priority:1, rider:{ kind:'debuff', stat:'atk', pct:0.12, turns:3 }, fact:'Fantails flush insects by flashing their tail like a fan.' },
    { match:['bee_eater'], label:'Sting Snip', power:50, cost:38, fact:'Bee-eaters wipe a bee\'s sting off on a branch before eating it.' },
    { match:['swan'], label:'Wing Thunder', power:76, cost:50, fact:'A swan\'s wing-slap is strong enough to see off a fox.' },
    { match:['goose'], label:'Honk Charge', power:66, cost:44, rider:{ kind:'debuff', stat:'atk', pct:0.12, turns:3 }, fact:'Geese guard territory so fiercely they\'ve been used as watchdogs.' },
    { match:['heron','egret','bittern'], label:'Spear Bill', power:70, cost:46, rider:{ kind:'crit', bonus:0.2 }, fact:'Herons stand statue-still, then strike faster than the eye.' },
    { match:['kingfisher'], label:'Plunge Dive', power:66, cost:44, rider:{ kind:'crit', bonus:0.2 }, fact:'Kingfishers hit the water at speeds that would blind other birds.' },
    { match:['pelican'], label:'Scoop Gulp', power:64, cost:44, rider:{ kind:'heal', pct:0.12 }, fact:'A pelican\'s pouch holds three times more than its stomach.' },
    { match:['shoebill'], label:'Guillotine Bill', power:84, cost:54, fact:'Shoebills decapitate lungfish with one snap of that colossal bill.' },
    { match:['gull','kittiwake'], label:'Chip Raid', power:50, cost:38, rider:{ kind:'steal', energy:20 }, fact:'Herring gulls time their swoops to steal food from your hand.' },
    { match:['tern'], label:'Arctic Arrow', power:54, cost:40, priority:1, fact:'Arctic terns fly from pole to pole every single year.' },
    { match:['albatross'], label:'Endless Glide', power:58, cost:42, rider:{ kind:'heal', pct:0.15 }, fact:'Albatrosses glide 1,000 km a day without flapping.' },
    { match:['penguin'], label:'Torpedo Slide', power:70, cost:46, fact:'Penguins rocket through water at over 30 km/h.' },
    { match:['puffin'], label:'Beakful Barrage', power:56, cost:40, fact:'A puffin can carry a dozen sand eels crosswise in its bill.' },
    { match:['gannet'], label:'Missile Plunge', power:74, cost:48, rider:{ kind:'crit', bonus:0.2 }, fact:'Gannets hit the sea at 100 km/h with built-in facial airbags.' },
    { match:['cormorant','shag','darter'], label:'Deep Hunt', power:60, cost:42, fact:'Cormorants chase fish underwater like feathered submarines.' },
    { match:['dipper'], label:'River Walk', power:52, cost:38, rider:{ kind:'heal', pct:0.1 }, fact:'Dippers walk along riverbeds underwater, gripping with their claws.' },
    { match:['crane'], label:'Dawn Dance', power:60, cost:42, rider:{ kind:'buff', stat:'atk', pct:0.15, turns:3 }, fact:'Cranes perform leaping duet dances to bond for life.' },
    { match:['flamingo'], label:'Sift & Sweep', power:54, cost:40, rider:{ kind:'debuff', stat:'def', pct:0.15, turns:3 }, fact:'Flamingos feed upside-down, pumping water through comb-like bills.' },
    { match:['oystercatcher'], label:'Shell Cracker', power:58, cost:40, rider:{ kind:'pierce' }, fact:'Oystercatchers chisel or stab shellfish open — each bird has its own technique.' },
    { match:['lapwing'], label:'Broken Wing Act', power:48, cost:38, rider:{ kind:'debuff', stat:'atk', pct:0.15, turns:3 }, fact:'Lapwings fake a broken wing to lure predators from their nest.' },
    { match:['snipe'], label:'Drumming Dive', power:52, cost:38, fact:'Snipe "drum" in display dives — the sound is their tail feathers.' },
    { match:['pigeon','dove','bronzewing'], label:'Homing Charge', power:56, cost:40, fact:'Pigeons navigate home across hundreds of unfamiliar kilometres.' },
    { match:['pheasant'], label:'Rocket Flush', power:64, cost:42, priority:1, fact:'A flushed pheasant explodes from cover at near-vertical angles.' },
    { match:['grouse','ptarmigan'], label:'Moor Burst', power:58, cost:40, fact:'Red grouse burst from heather with startling wing-claps.' },
    { match:['partridge','quail'], label:'Covey Rush', power:54, cost:40, rider:{ kind:'buff', stat:'def', pct:0.15, turns:3 }, fact:'Partridge coveys roost in a circle, facing out — nobody sneaks up.' },
    { match:['ostrich'], label:'Piston Kick', power:90, cost:56, fact:'An ostrich kick can kill a lion — and it runs at 70 km/h.' },
    { match:['cassowary'], label:'Dagger Claw', power:92, cost:58, rider:{ kind:'pierce' }, fact:'Cassowaries carry a 12 cm dagger claw on each foot.' },
    { match:['emu'], label:'Outback Stampede', power:78, cost:50, fact:'Emus once "won" an actual war against the Australian army.' },
    { match:['kiwi'], label:'Night Probe', power:56, cost:40, rider:{ kind:'crit', bonus:0.25 }, fact:'Kiwis sniff out worms with nostrils at the tip of their bill.' },
    { match:['kakapo'], label:'Boom Night', power:52, cost:40, rider:{ kind:'buff', stat:'def', pct:0.2, turns:3 }, fact:'Kakapo booms carry five kilometres on still nights.' },
    { match:['hoopoe'], label:'Crest Flash', power:50, cost:38, rider:{ kind:'debuff', stat:'atk', pct:0.12, turns:3 }, fact:'Hoopoes flare that zebra crest when startled.' },
    { match:['waxwing'], label:'Berry Blitz', power:48, cost:38, rider:{ kind:'heal', pct:0.12 }, fact:'Waxwings strip whole berry trees in nomadic winter raids.' }
  ];

  // Per-class fallback signatures for species without a curated entry.
  const CLASS_SIGNATURES = {
    raptor:     { label:'Talon Ambush',   power:70, cost:48, fact:'Raptors strike from above with locked talons.' },
    trickster:  { label:'Clever Heist',   power:52, cost:40, rider:{ kind:'steal', energy:18 }, fact:'Clever birds turn a rival\'s strength against them.' },
    songbird:   { label:'Territory Song', power:46, cost:38, rider:{ kind:'buff', stat:'atk', pct:0.12, turns:3 }, fact:'A singing bird is a bird claiming ground.' },
    skydancer:  { label:'Aerial Loop',    power:52, cost:40, priority:1, fact:'Aerial specialists attack where they can\'t be answered.' },
    waterbird:  { label:'Wing Slap',      power:62, cost:44, fact:'Big waterbirds settle arguments with heavy wings.' },
    groundbird: { label:'Turf Charge',    power:60, cost:42, fact:'Ground birds put their whole weight behind a charge.' }
  };

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
      stat: 'atk',
      power: base.power || 55,
      cost: base.cost || 42,
      kind: 'attack',
      priority: base.priority || 0,
      rider: base.rider || null,
      stab: true,
      fact: base.fact || null
    };
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

  function buildFighter(bird, options) {
    const opts = options || {};
    const typeId = opts.typeId || classifySpecies(bird.species || bird.commonName);
    const disciplines = opts.disciplines || (bird.academy && bird.academy.disciplines) || {};
    const stamina = n(bird.stamina, 50);
    const maxHp = Math.max(40, n(bird.maxHp, 80));
    const hp = clamp(n(bird.hp, maxHp), 0, maxHp);
    const moves = [{ ...PECK }, ...trainedMoves(disciplines), signatureFor(bird.species || bird.commonName, typeId)];
    return {
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
      atk: n(bird.atk, 40), def: n(bird.def, 40), spd: n(bird.spd, 40),
      int: n(bird.int, 45), cha: n(bird.cha, 45), stamina,
      energy: clamp(Math.round(25 + stamina / 6), 20, 60),
      moves,
      mods: [],           // [{stat, pct, turns}] — buffs positive, debuffs negative
      shield: null,       // {pct, turns}
      fainted: hp <= 0
    };
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
  // Battle state machine
  // ---------------------------------------------------------------------------
  function createBattle(config) {
    const player = (config.playerFighters || []).filter(Boolean);
    const opponent = (config.opponentFighters || []).filter(Boolean);
    if (!player.length || !opponent.length) throw new Error('Both sides need at least one fighter');
    return {
      seed: config.seed || ('battle_' + player.length + '_' + opponent.length),
      rngState: hashString(config.seed || 'battle') || 1,
      tier: n(config.tier, 0),
      turn: 1,
      teams: { player, opponent },
      active: { player: 0, opponent: 0 },
      phase: 'choose',     // choose | replace | over
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

  function activeFighter(battle, side) { return battle.teams[side][battle.active[side]]; }
  function benchAlive(battle, side) {
    return battle.teams[side].map((f, i) => ({ f, i })).filter(x => !x.f.fainted && x.i !== battle.active[side]);
  }
  function teamAlive(battle, side) { return battle.teams[side].some(f => !f.fainted); }

  function effStat(fighter, stat) {
    const base = n(fighter[stat], 40);
    const pct = (fighter.mods || []).filter(m => m.stat === stat).reduce((s, m) => s + m.pct, 0);
    return Math.max(5, Math.round(base * (1 + clamp(pct, -0.6, 0.8))));
  }

  function moveUsable(fighter, move) { return (move.cost || 0) <= fighter.energy; }

  function availableActions(battle, side) {
    const f = activeFighter(battle, side);
    const actions = f.moves.map((m, i) => ({ kind:'move', moveIndex:i, move:m, usable: moveUsable(f, m) }));
    benchAlive(battle, side).forEach(x => actions.push({ kind:'switch', index:x.i, fighter:x.f }));
    return actions;
  }

  function computeDamage(battle, attacker, defender, move) {
    const attStat = effStat(attacker, move.stat || 'atk');
    const defStat = effStat(defender, 'def');
    const { mult, fact } = effectiveness(attacker.type, defender.type);
    let critChance = clamp(0.05 + effStat(attacker, 'int') / 900, 0.05, 0.4);
    if (move.rider && move.rider.kind === 'crit') critChance = clamp(critChance + move.rider.bonus, 0, 0.6);
    const crit = battleRng(battle) < critChance;
    const stab = move.stab ? 1.2 : 1;
    const variance = 0.9 + battleRng(battle) * 0.2;
    const pierce = !!(move.rider && move.rider.kind === 'pierce');
    let raw = (5 + move.power * (attStat / (defStat + 50))) * mult * stab * variance * (crit ? 1.5 : 1);
    let shielded = 0;
    if (defender.shield && defender.shield.turns > 0 && !pierce) {
      shielded = raw * defender.shield.pct;
      raw -= shielded;
    }
    return { dmg: Math.max(1, Math.round(raw)), crit, mult, fact, shielded: Math.round(shielded), pierced: pierce && !!defender.shield };
  }

  function applyHeal(fighter, pct) {
    const amount = Math.round(fighter.maxHp * pct);
    const healed = Math.max(0, Math.min(amount, fighter.maxHp - fighter.hp));
    fighter.hp += healed;
    return healed;
  }

  function applyRider(battle, move, attacker, defender, events, side, defSide) {
    const rider = move.rider;
    if (!rider) return;
    if (rider.kind === 'debuff') {
      defender.mods.push({ stat: rider.stat, pct: -rider.pct, turns: rider.turns });
      events.push({ type:'debuff', side: defSide, name: defender.name, stat: rider.stat,
        text: defender.name + '\'s ' + rider.stat.toUpperCase() + ' drops ' + Math.round(rider.pct * 100) + '%!' });
    } else if (rider.kind === 'buff') {
      attacker.mods.push({ stat: rider.stat, pct: rider.pct, turns: rider.turns });
      events.push({ type:'buff', side, name: attacker.name, stat: rider.stat,
        text: attacker.name + '\'s ' + rider.stat.toUpperCase() + ' rises ' + Math.round(rider.pct * 100) + '%!' });
    } else if (rider.kind === 'steal') {
      const stolen = Math.min(rider.energy, defender.energy);
      defender.energy -= stolen;
      attacker.energy = clamp(attacker.energy + stolen, 0, 100);
      if (stolen > 0) events.push({ type:'steal', side, text: attacker.name + ' steals ' + stolen + ' energy!' });
    } else if (rider.kind === 'heal') {
      const healed = applyHeal(attacker, rider.pct);
      if (healed > 0) events.push({ type:'heal', side, name: attacker.name, healed, hp: attacker.hp, maxHp: attacker.maxHp,
        text: attacker.name + ' recovers ' + healed + ' HP.' });
    }
    // 'crit' and 'pierce' riders are applied inside computeDamage.
  }

  function executeMove(battle, side, move, events) {
    const attacker = activeFighter(battle, side);
    const defSide = side === 'player' ? 'opponent' : 'player';
    const defender = activeFighter(battle, defSide);
    if (attacker.fainted) return;
    let usedMove = move;
    if (!moveUsable(attacker, move)) usedMove = attacker.moves[0]; // out of energy: fall back to Peck
    attacker.energy = clamp(attacker.energy - (usedMove.cost || 0) + (usedMove.gain || 0), 0, 100);
    events.push({ type:'move', side, name: attacker.name, move: usedMove.label, school: usedMove.school,
      text: attacker.name + ' uses ' + usedMove.label + '!' });

    if (usedMove.kind === 'attack') {
      const res = computeDamage(battle, attacker, defender, usedMove);
      defender.hp = Math.max(0, defender.hp - res.dmg);
      events.push({ type:'damage', side: defSide, name: defender.name, dmg: res.dmg, crit: res.crit, mult: res.mult,
        hp: defender.hp, maxHp: defender.maxHp,
        text: defender.name + ' takes ' + res.dmg + ' damage' + (res.crit ? ' — critical hit!' : '.') });
      if (res.mult > 1) events.push({ type:'fact', side, text: 'Super effective! ' + (res.fact || '') });
      else if (res.mult < 1) events.push({ type:'info', side, text: 'Not very effective...' });
      if (res.pierced) events.push({ type:'info', side, text: usedMove.label + ' pierces straight through the guard!' });
      else if (res.shielded > 0) events.push({ type:'info', side: defSide, text: defender.name + '\'s guard absorbs ' + res.shielded + ' damage.' });
      if (usedMove.fact && usedMove.school === 'signature' && battle.turn <= 2) events.push({ type:'fact', side, text: usedMove.fact });
      applyRider(battle, usedMove, attacker, defender, events, side, defSide);
      if (defender.hp <= 0) {
        defender.fainted = true;
        events.push({ type:'faint', side: defSide, name: defender.name, text: defender.name + ' is out of the match!' });
      }
    } else if (usedMove.kind === 'shield') {
      attacker.shield = { pct: usedMove.shieldPct, turns: usedMove.shieldTurns };
      events.push({ type:'shield', side, name: attacker.name, pct: usedMove.shieldPct,
        text: attacker.name + ' braces — incoming damage cut ' + Math.round(usedMove.shieldPct * 100) + '% for ' + usedMove.shieldTurns + ' turns.' });
    } else if (usedMove.kind === 'heal') {
      const healed = applyHeal(attacker, usedMove.healPct * (0.7 + effStat(attacker, 'stamina') / 250));
      if (usedMove.cleanse) attacker.mods = attacker.mods.filter(m => m.pct > 0);
      events.push({ type:'heal', side, name: attacker.name, healed, hp: attacker.hp, maxHp: attacker.maxHp,
        text: attacker.name + ' recovers ' + healed + ' HP' + (usedMove.cleanse ? ' and shakes off bad effects.' : '.') });
    } else if (usedMove.kind === 'buff') {
      applyRider(battle, usedMove, attacker, defender, events, side, defSide);
      if (usedMove.healPct) {
        if (usedMove.teamHeal) {
          battle.teams[side].forEach(f => { if (!f.fainted) applyHeal(f, usedMove.healPct); });
          events.push({ type:'heal', side, name: attacker.name, hp: attacker.hp, maxHp: attacker.maxHp,
            text: 'The whole team rallies and recovers!' });
        } else {
          const healed = applyHeal(attacker, usedMove.healPct);
          if (healed > 0) events.push({ type:'heal', side, name: attacker.name, healed, hp: attacker.hp, maxHp: attacker.maxHp,
            text: attacker.name + ' recovers ' + healed + ' HP.' });
        }
      }
    }
  }

  // AI: score every usable action, pick the best with a little humanising noise.
  function aiChooseAction(battle) {
    const side = 'opponent';
    const me = activeFighter(battle, side);
    const foe = activeFighter(battle, 'player');
    const myMult = effectiveness(me.type, foe.type).mult;
    const foeMult = effectiveness(foe.type, me.type).mult;

    // Consider a tactical switch when badly countered.
    if (myMult < 1 && foeMult > 1 && battleRng(battle) < 0.35) {
      const better = benchAlive(battle, side).find(x =>
        effectiveness(x.f.type, foe.type).mult >= 1 && x.f.hp > x.f.maxHp * 0.35);
      if (better) return { kind:'switch', index: better.i };
    }

    let best = null;
    me.moves.forEach((m, i) => {
      if (!moveUsable(me, m)) return;
      let score = 0;
      if (m.kind === 'attack') {
        score = (5 + m.power * (effStat(me, m.stat || 'atk') / (effStat(foe, 'def') + 50))) * myMult * (m.stab ? 1.2 : 1);
        if (foe.hp < score * 1.1) score *= 2.2; // go for the finish
      } else if (m.kind === 'heal') {
        score = me.hp < me.maxHp * 0.4 ? 34 + (1 - me.hp / me.maxHp) * 40 : 2;
      } else if (m.kind === 'shield') {
        score = !me.shield && (battle.turn <= 3 || foeMult > 1) ? 25 : 4;
      } else if (m.kind === 'buff') {
        score = battle.turn <= 2 && !me.mods.some(x => x.pct > 0) ? 26 : 6;
      }
      score *= 0.85 + battleRng(battle) * 0.3;
      if (!best || score > best.score) best = { action: { kind:'move', moveIndex:i }, score };
    });
    return best ? best.action : { kind:'move', moveIndex: 0 };
  }

  // Resolve one full turn. playerAction: {kind:'move', moveIndex} | {kind:'switch', index}
  function resolveTurn(battle, playerAction) {
    if (battle.phase !== 'choose') throw new Error('Battle is not awaiting an action');
    const events = [];
    const acts = { player: playerAction, opponent: aiChooseAction(battle) };

    // Switches resolve first, always.
    ['player', 'opponent'].forEach(side => {
      const a = acts[side];
      if (a && a.kind === 'switch') {
        const team = battle.teams[side];
        if (team[a.index] && !team[a.index].fainted) {
          battle.active[side] = a.index;
          const f = team[a.index];
          events.push({ type:'switch', side, name: f.name,
            text: (side === 'player' ? 'You send out ' : 'Rival sends out ') + f.name + '!' });
        }
        acts[side] = null;
      }
    });

    // Moves resolve by priority, then effective speed.
    const order = ['player', 'opponent']
      .filter(side => acts[side])
      .map(side => {
        const f = activeFighter(battle, side);
        const move = f.moves[acts[side].moveIndex] || f.moves[0];
        return { side, move, prio: move.priority || 0, spd: effStat(f, 'spd') };
      })
      .sort((a, b) => b.prio - a.prio || b.spd - a.spd || (battleRng(battle) < 0.5 ? -1 : 1));

    for (const step of order) {
      const attacker = activeFighter(battle, step.side);
      if (attacker.fainted) continue; // knocked out before it could act
      executeMove(battle, step.side, step.move, events);
    }

    // End of turn: tick down the active birds' buffs/shields, regen energy.
    ['player', 'opponent'].forEach(side => {
      const f = activeFighter(battle, side);
      if (!f.fainted) f.energy = clamp(f.energy + 6, 0, 100);
      f.mods = (f.mods || []).map(m => ({ ...m, turns: m.turns - 1 })).filter(m => m.turns > 0);
      if (f.shield) {
        f.shield.turns -= 1;
        if (f.shield.turns <= 0) f.shield = null;
      }
    });

    // Faint handling / winner check.
    if (!teamAlive(battle, 'opponent')) {
      battle.phase = 'over'; battle.winner = 'player';
      events.push({ type:'end', winner:'player', text:'Victory! The rival flock concedes the perch.' });
    } else if (!teamAlive(battle, 'player')) {
      battle.phase = 'over'; battle.winner = 'opponent';
      events.push({ type:'end', winner:'opponent', text:'Defeat... your flock needs rest and more training.' });
    } else {
      // Auto-replace a fainted opponent with its best matchup.
      if (activeFighter(battle, 'opponent').fainted) {
        const foe = activeFighter(battle, 'player');
        const bench = benchAlive(battle, 'opponent')
          .sort((a, b) => effectiveness(b.f.type, foe.type).mult - effectiveness(a.f.type, foe.type).mult || b.f.hp - a.f.hp);
        battle.active.opponent = bench[0].i;
        events.push({ type:'switch', side:'opponent', name: bench[0].f.name, text:'Rival sends out ' + bench[0].f.name + '!' });
      }
      battle.phase = activeFighter(battle, 'player').fainted ? 'replace' : 'choose';
      if (battle.phase === 'replace') events.push({ type:'replace', side:'player', text:'Choose your next bird!' });
    }

    battle.turn += 1;
    return events;
  }

  // Player picks a replacement after a faint.
  function resolveReplacement(battle, index) {
    if (battle.phase !== 'replace') throw new Error('No replacement is pending');
    const f = battle.teams.player[index];
    if (!f || f.fainted) throw new Error('That bird cannot battle');
    battle.active.player = index;
    battle.phase = 'choose';
    return [{ type:'switch', side:'player', name: f.name, text:'You send out ' + f.name + '!' }];
  }

  // ---------------------------------------------------------------------------
  // Perch League — ladder + reward economy, tunable in one place
  // ---------------------------------------------------------------------------
  const LEAGUE_TIERS = [
    { id:'garden',   label:'Garden Perch',     icon:'🌼', rarities:['common'],            favoredTypes:['songbird','groundbird'], levelBoost:0, winCoins:12, winBranches:2,  promoteWins:3, promoCoins:40,  promoBranches:12, copy:'Local garden flocks. Everyone starts on the fence post.' },
    { id:'hedgerow', label:'Hedgerow Cup',     icon:'🌿', rarities:['common','uncommon'], favoredTypes:['songbird','trickster'],  levelBoost:1, winCoins:18, winBranches:3,  promoteWins:3, promoCoins:60,  promoBranches:16, copy:'Farm hedges and lanes — the corvids are watching.' },
    { id:'woodland', label:'Woodland Crown',   icon:'🌳', rarities:['uncommon'],          favoredTypes:['trickster','songbird'],  levelBoost:2, winCoins:24, winBranches:4,  promoteWins:3, promoCoins:80,  promoBranches:20, copy:'Deep woods. Jays, owls and woodpeckers rule here.' },
    { id:'river',    label:'River Trophy',     icon:'🏞️', rarities:['uncommon','rare'],   favoredTypes:['waterbird'],             levelBoost:3, winCoins:30, winBranches:5,  promoteWins:3, promoCoins:100, promoBranches:26, copy:'Riverbank champions — herons, kingfishers and swans.' },
    { id:'coast',    label:'Coastal Gauntlet', icon:'⚓', rarities:['rare'],              favoredTypes:['waterbird','skydancer'], levelBoost:4, winCoins:38, winBranches:6,  promoteWins:3, promoCoins:130, promoBranches:32, copy:'Cliff colonies and sea winds. Gulls fight dirty.' },
    { id:'highland', label:'Highland Talons',  icon:'🏔️', rarities:['rare','epic'],       favoredTypes:['raptor'],                levelBoost:5, winCoins:46, winBranches:8,  promoteWins:3, promoCoins:170, promoBranches:40, copy:'Raptor country. Bring counters or bring bandages.' },
    { id:'sky',      label:'Sky Court',        icon:'👑', rarities:['epic','legendary'],  favoredTypes:null,                      levelBoost:6, winCoins:56, winBranches:10, promoteWins:0, promoCoins:0,   promoBranches:0,  copy:'The endless summit league of legendary birds.' }
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
      return { coins: 4, branches: 0, birdXp: 8, playerXp: 10, firstWinBonus: false, reduced: false };
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
    return { coins, branches, birdXp: 22 + ti * 7, playerXp: 30 + ti * 10, firstWinBonus, reduced };
  }

  return {
    BIRD_TYPES, TYPE_CHART, TYPE_FACTS, effectiveness, classifySpecies, speciesKey,
    MOVE_SCHOOLS, MOVE_LINES, TIER_THRESHOLDS, PECK, SIGNATURES, CLASS_SIGNATURES, signatureFor,
    disciplineTier, trainedMoves, buildFighter, buildOpponentFighter,
    createBattle, availableActions, resolveTurn, resolveReplacement, activeFighter, benchAlive, effStat, moveUsable,
    LEAGUE_TIERS, battleRewards, DAILY_FULL_REWARD_WINS,
    hashString, seededRandom
  };
});
