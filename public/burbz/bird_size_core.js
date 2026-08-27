// Burbz Bird Size Core — "Weight tells, and so does what the bird is for".
// One honest rule, applied everywhere: a bigger bird can carry more and hits
// harder; a little bird carries less and hits softer. Size is not a made-up
// game number — where the catalogue knows a species' real body mass (AVONET
// Supplementary Dataset 1, shipped in each profile's statProvenance) that mass
// IS the size. The hand-curated UK/AU roster carries its own field-guide
// weights below (raven-weight-and-wit-v255: a Raven really is twice a Carrion
// Crow, and its load says so).
//
// every-bird-carries-its-weight-v335 finished that job and then went one step
// further. Two things changed:
//
//   1. EVERY playable bird now has a real weight. 425 of them — the Bald Eagle,
//      the Emperor Penguin, the Ostrich, the Reed Warbler — had none, and were
//      guessing one off HP and STRENGTH. Nothing guesses any more.
//   2. Weight is no longer the whole answer to "what can it carry". A Merlin
//      hunts by carrying prey home in its feet; a Mute Swan is nine times
//      heavier and carries nothing at all. So every bird also joins a carrying
//      guild, and the guild says what the bird is BUILT to carry.
//
// Everything downstream — expedition hauls, combat stats, the size chip on a
// bird card — comes from one 0-100 size score, so the rule can never disagree
// with itself.
// Pure module: no DOM, no game state, UMD export.
(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBirdSizeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function n(value, fallback) {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ---------------------------------------------------------------------------
  // Size classes — the five weights of the Kingdom
  // ---------------------------------------------------------------------------
  // `minScore` is inclusive; the classes tile 0-100 with no gaps. Carry and
  // battle numbers are continuous functions of the score (below) — the class is
  // the label the player reads, not the maths.
  const SIZE_CLASSES = [
    { id:'tiny',   label:'Tiny',   icon:'🪶', minScore:0,  blurb:'Goldcrest weight. Can barely lift a beakful — and a gust of eagle is the end of the argument.' },
    { id:'small',  label:'Small',  icon:'🐦', minScore:20, blurb:'Robin and tit weight. Light loads, quick work, easily outmuscled — but nobody charms a town hall better.' },
    { id:'medium', label:'Medium', icon:'🕊️', minScore:40, blurb:'Blackbird to jackdaw. A useful hauler that can hold its own in a scrap.' },
    { id:'large',  label:'Large',  icon:'🦆', minScore:60, blurb:'Crow, raven, buzzard, goose. Heavy hauls and heavy blows — and heavy going behind a governor\'s desk.' },
    { id:'giant',  label:'Giant',  icon:'🦅', minScore:80, blurb:'Eagle, swan, emu. Carries a stack of cargo and fights like it. Do not hand it the ledger.' }
  ];
  const SIZE_CLASS_INDEX = Object.fromEntries(SIZE_CLASSES.map(c => [c.id, c]));

  function sizeClassForScore(score) {
    const s = clamp(n(score, 0), 0, 100);
    let match = SIZE_CLASSES[0];
    for (const cls of SIZE_CLASSES) if (s >= cls.minScore) match = cls;
    return match;
  }

  // ---------------------------------------------------------------------------
  // Field-guide weights for the hand-curated roster
  // ---------------------------------------------------------------------------
  // The UK/AU roster ships no AVONET provenance, so until v255 its flagship
  // birds guessed their weight off HP and STRENGTH — and the guess flattened
  // the one fact Yaan asked the game to honour the night a real raven finally
  // flew over him: a Raven (~1.2 kg) is TWICE a Carrion Crow (~510 g), a
  // Buzzard dwarfs a Robin, and a Herring Gull is a genuine heavyweight.
  // These are typical adult body masses in grams, rounded from BTO/RSPB and
  // BirdLife Australia field guides, keyed by roster profile id (with the
  // profile name slug as a fallback for stub profiles).
  const FIELD_GUIDE_MASS_G = {
    // Corvids — the family the rule was written for.
    raven: 1200, carrion_crow: 510, rook: 480, jackdaw: 220, magpie: 230,
    jay: 170, australian_raven: 650, little_raven: 550,
    // The named yardsticks.
    robin: 18, buzzard: 780, herring_gull: 1150,
    // Gulls carry an awful lot.
    lesser_black_backed_gull: 800, common_gull: 400, silver_gull: 320,
    // Little charmers and garden regulars.
    goldcrest: 5.5, firecrest: 5.5, wren: 10, blue_tit: 11, coal_tit: 9,
    great_tit: 18, long_tailed_tit: 8, house_sparrow: 28,
    eurasian_tree_sparrow: 22, dunnock: 21, chaffinch: 21, goldfinch: 16,
    greenfinch: 28, bullfinch: 21, common_linnet: 15, eurasian_siskin: 12,
    yellowhammer: 27, reed_bunting: 18, starling: 78, blackbird: 100,
    song_thrush: 83, redwing: 63, fieldfare: 100, skylark: 38,
    meadow_pipit: 18, tree_pipit: 22, pied_wagtail: 21, grey_wagtail: 17,
    stonechat: 15, northern_wheatear: 25, common_redstart: 15,
    pied_flycatcher: 13, chiffchaff: 8, willow_warbler: 9, blackcap: 21,
    greater_whitethroat: 15, sedge_warbler: 12, treecreeper: 9, nuthatch: 23,
    swallow: 19, house_martin: 18, sand_martin: 14, swift: 40, dipper: 60,
    kingfisher: 40, great_spotted_woodpecker: 85, green_woodpecker: 190,
    // Doves and pigeons.
    woodpigeon: 490, stock_dove: 300, collared_dove: 200, feral_pigeon: 300,
    rock_pigeon: 300, ring_necked_parakeet: 120, cuckoo: 110,
    // Raptors and owls.
    kestrel: 190, sparrowhawk: 220, red_kite: 1000, osprey: 1500, merlin: 200,
    peregrine_falcon: 850, golden_eagle: 4500, white_tailed_eagle: 5000,
    western_marsh_harrier: 600, tawny_owl: 470, barn_owl: 300, little_owl: 170,
    // Waders, waterbirds and the big hauliers.
    lapwing: 230, curlew: 900, oystercatcher: 540, common_redshank: 120,
    common_snipe: 110, dunlin: 50, common_sandpiper: 50,
    black_tailed_godwit: 300, pied_avocet: 300, mallard: 1100, gadwall: 850,
    northern_shoveler: 600, tufted_duck: 700, common_pochard: 800,
    common_goldeneye: 800, goosander: 1400, green_winged_teal: 330,
    mute_swan: 11000, canada_goose: 4500, greylag_goose: 3300,
    pink_footed_goose: 2500, heron: 1500, cormorant: 2200, gannet: 3000,
    puffin: 380, razorbill: 700, little_grebe: 140, eurasian_coot: 800,
    pheasant: 1200, red_grouse: 600, grey_partridge: 390,
    red_legged_partridge: 480,
    // Australian regulars.
    australian_magpie: 340, willie_wagtail: 20, noisy_miner: 72,
    rainbow_lorikeet: 130, laughing_kookaburra: 340, galah: 330,
    little_corella: 550, sulphur_crested_cockatoo: 800, crested_pigeon: 200,
    spotted_dove: 160, magpie_lark: 90, welcome_swallow: 15,
    superb_fairywren: 10, black_swan: 6000, australian_pelican: 5500,
    australian_white_ibis: 1800, straw_necked_ibis: 1300, masked_lapwing: 370,
    wedge_tailed_eagle: 3800, square_tailed_kite: 520, tawny_frogmouth: 350,
    pacific_black_duck: 1050, australian_wood_duck: 800, common_myna: 110,
    eastern_rosella: 100, crimson_rosella: 130, australian_king_parrot: 220,
    dusky_moorhen: 530, australasian_swamphen: 1000,

    // -- every-bird-carries-its-weight-v335 ---------------------------------
    // Until now 425 of the roster's 567 birds had no weight anywhere, so they
    // guessed one off HP and STRENGTH — and the guess put a Bald Eagle, an
    // Emperor Penguin and an Ostrich in the same bracket as a thrush. These are
    // typical adult body masses in grams from the standard field guides
    // (BTO/RSPB, BirdLife Australia, Cornell Birds of the World). Now every
    // playable bird has a real weight, and the carry rule can be trusted.

    // Australian regulars.
    chestnut_teal: 600, little_pied_cormorant: 700, red_wattlebird: 110,
    grey_butcherbird: 90, white_faced_heron: 550, pied_currawong: 320,
    red_rumped_parrot: 60, common_bronzewing: 350, brown_thornbill: 7,
    grey_fantail: 8, new_holland_honeyeater: 20, eastern_spinebill: 11,
    white_plumed_honeyeater: 19, royal_spoonbill: 1700, ruddy_turnstone: 110,
    white_browed_scrubwren: 13, yellow_tailed_black_cockatoo: 750,
    eastern_yellow_robin: 20, spotted_pardalote: 9, little_black_cormorant: 800,
    australasian_grebe: 220, long_billed_corella: 600, gang_gang_cockatoo: 260,
    golden_whistler: 25, musk_lorikeet: 60, hoary_headed_grebe: 250,
    grey_teal: 500, little_wattlebird: 65, australasian_darter: 2000,
    red_browed_finch: 10, gray_shrikethrush: 65, pied_stilt: 190,
    black_faced_cuckooshrike: 110, silvereye: 11, hardhead: 900,
    buff_banded_rail: 170, black_shouldered_kite: 260, blue_billed_duck: 850,
    nankeen_night_heron: 750, torresian_crow: 550, noisy_friarbird: 100,
    blue_faced_honeyeater: 105, brown_honeyeater: 11, lewins_honeyeater: 32,
    yellow_faced_honeyeater: 17, bell_miner: 30, eastern_whipbird: 65,
    satin_bowerbird: 170, australasian_figbird: 125, olive_backed_oriole: 100,
    spangled_drongo: 90, mistletoebird: 9, striated_pardalote: 11,
    yellow_rumped_thornbill: 9, sacred_kingfisher: 55, dollarbird: 135,
    nankeen_kestrel: 165, southern_boobook: 300, whistling_kite: 700,
    bush_stone_curlew: 700, rufous_whistler: 25, white_winged_chough: 350,
    grey_currawong: 350, pied_butcherbird: 130, superb_lyrebird: 970,
    rainbow_bee_eater: 27, asian_koel: 200, emu: 35000,

    // North American garden and backyard birds.
    american_robin: 77, northern_cardinal: 45, blue_jay: 85,
    black_capped_chickadee: 11, tufted_titmouse: 21, northern_mockingbird: 49,
    house_finch: 21, american_goldfinch: 13, cedar_waxwing: 32,
    red_winged_blackbird: 53, common_grackle: 115, common_yellowthroat: 10,
    mourning_dove: 120, red_bellied_woodpecker: 72, pileated_woodpecker: 290,
    ruby_throated_hummingbird: 3.2, belted_kingfisher: 150, killdeer: 95,
    // …and the North American heavyweights.
    bald_eagle: 4500, red_tailed_hawk: 1100, great_horned_owl: 1400,
    turkey_vulture: 2000, common_loon: 4100, great_blue_heron: 2400,
    wood_duck: 650, trumpeter_swan: 11000, snow_goose: 2700,
    sandhill_crane: 4500, snowy_owl: 2000, burrowing_owl: 155,

    // European and UK birds the roster had missed.
    black_headed_gull: 280, little_egret: 450, great_crested_grebe: 900,
    eurasian_wigeon: 750, northern_pintail: 850, common_shelduck: 1100,
    common_eider: 2200, common_tern: 120, grey_plover: 220,
    bar_tailed_godwit: 300, mandarin_duck: 570, common_nightingale: 20,
    egyptian_goose: 2000,
    northern_goshawk: 900, common_crane: 5500, western_cattle_egret: 350,
    common_quail: 95, whooper_swan: 10000, great_egret: 900,
    mistle_thrush: 120, great_black_backed_gull: 1700, common_whitethroat: 15,
    garden_warbler: 19, reed_warbler: 13, spotted_flycatcher: 15,
    brambling: 24, lesser_redpoll: 12, marsh_tit: 11, willow_tit: 11,
    hawfinch: 55, yellow_wagtail: 17, ringed_plover: 64,
    little_ringed_plover: 40, kittiwake: 400, northern_fulmar: 800,
    european_shag: 1800, water_rail: 120, turtle_dove: 150, corn_bunting: 45,
    sanderling: 55, barnacle_goose: 1700, brent_goose: 1400,
    common_moorhen: 320, bohemian_waxwing: 55, red_crossbill: 40,
    eurasian_hoopoe: 60, european_bee_eater: 55, eurasian_eagle_owl: 2800,
    eurasian_griffon_vulture: 8000, bearded_vulture: 5700,
    greater_flamingo: 3000, white_stork: 3400,

    // The world birds — the Birdex's showpieces, and the reason the old guess
    // hurt most: an Ostrich guessing its way to thrush weight is absurd.
    emperor_penguin: 30000, king_penguin: 14000, gentoo_penguin: 5500,
    // The roster ids for these two come from slugged accented names.
    adelie_penguin: 4700, ad_lie_penguin: 4700, southern_rockhopper_penguin: 2700,
    african_penguin: 3100, little_penguin: 1100,
    common_ostrich: 110000, southern_cassowary: 44000, greater_rhea: 23000,
    north_island_brown_kiwi: 2400,
    kakapo: 2400, kea: 950, african_grey_parrot: 420, scarlet_macaw: 1000,
    hyacinth_macaw: 1550, budgerigar: 32, cockatiel: 90,
    toco_toucan: 600, resplendent_quetzal: 205,
    harpy_eagle: 6500, andean_condor: 11000, california_condor: 9000,
    secretarybird: 3900, shoebill: 5000, marabou_stork: 6500,
    grey_crowned_crane: 3500, red_crowned_crane: 8000, sarus_crane: 6900,
    lilac_breasted_roller: 100, malachite_kingfisher: 18,
    african_fish_eagle: 2900, steller_sea_eagle: 7500,
    wandering_albatross: 8500, great_frigatebird: 1400,
    blue_footed_booby: 1500, brown_pelican: 3500, kori_bustard: 11000,
    sociable_weaver: 27, red_billed_quelea: 18,

    // -- the six expansion catalogues ---------------------------------------
    // The roster is not only the base array: uk_bird_expansion_2/3/4/50.js and
    // au_bird_expansion.js / _2.js push another 235 species in, and every one
    // of them was guessing its weight off HP and STRENGTH too. Same sources as
    // above (BTO BirdFacts, BirdLife Australia / HANZAB). Where a species is
    // strongly dimorphic the figure is the mid-sex mass, not the male's.
    apostlebird: 120, aquatic_warbler: 12, arctic_redpoll: 14, arctic_skua:
    430, arctic_tern: 110, australasian_gannet: 2300, australasian_pipit: 25,
    australasian_shoveler: 650, australian_brushturkey: 2200,
    australian_bustard: 5500, australian_hobby: 250,
    australian_owlet_nightjar: 50, australian_reed_warbler: 18,
    australian_ringneck: 150, australian_shelduck: 1500, azure_kingfisher: 30,
    balearic_shearwater: 500, bar_shouldered_dove: 120, bassian_thrush: 100,
    bearded_tit: 15, bewick_s_swan: 6000, bittern: 1100,
    black_faced_cormorant: 1700, black_fronted_dotterel: 35, black_grouse:
    1100, black_guillemot: 420, black_kite: 750, black_necked_grebe: 300,
    black_necked_stork: 4100, black_redstart: 17, black_tern: 65,
    black_throated_diver: 3000, blue_winged_kookaburra: 300, bluethroat: 18,
    brahminy_kite: 600, brolga: 6000, brown_cuckoo_dove: 200, brown_falcon:
    550, brown_goshawk: 350, brown_headed_honeyeater: 14, brown_quail: 95,
    brown_treecreeper: 30, buff_rumped_thornbill: 8, cabot_s_tern: 200,
    cape_barren_goose: 4500, capercaillie: 3500, carnaby_s_black_cockatoo:
    600, caspian_tern: 650, cetti_s_warbler: 14, channel_billed_cuckoo: 600,
    chestnut_breasted_munia: 13, chough: 310, cirl_bunting: 24,
    collared_sparrowhawk: 180, comb_crested_jacana: 120, common_rosefinch: 22,
    common_scoter: 1200, coot: 800, corncrake: 155, crescent_honeyeater: 17,
    crested_tern: 350, crested_tit: 11, curlew_sandpiper: 60,
    dartford_warbler: 10, diamond_firetail: 17, dotterel: 110,
    double_barred_finch: 10, dusky_woodswallow: 35, eastern_cattle_egret: 380,
    eurasian_spoonbill: 1700, european_honey_buzzard: 750, fairy_martin: 11,
    fan_tailed_cuckoo: 50, far_eastern_curlew: 900, fea_s_petrel: 300,
    flame_robin: 13, forest_kingfisher: 40, garganey: 350, glaucous_gull:
    1600, glossy_black_cockatoo: 450, glossy_ibis: 600,
    golden_headed_cisticola: 10, golden_oriole: 70, golden_plover: 220,
    grasshopper_warbler: 13, great_bowerbird: 215, great_cormorant: 2200,
    great_grey_shrike: 65, great_northern_diver: 4100, great_shearwater: 850,
    great_skua: 1400, green_rosella: 150, green_sandpiper: 80, greenshank:
    190, grey_crowned_babbler: 80, grey_phalarope: 55, guillemot: 1000,
    hen_harrier: 450, hobby: 210, hooded_crow: 510, hooded_plover: 90,
    iceland_gull: 800, jack_snipe: 60, jacky_winter: 15, kelp_gull: 1000,
    knot: 140, lapland_bunting: 27, leach_s_storm_petrel: 45,
    leaden_flycatcher: 13, lesser_spotted_woodpecker: 20, lesser_whitethroat:
    12, little_auk: 160, little_friarbird: 60, little_gull: 120, little_heron:
    200, little_shrikethrush: 30, little_stint: 25, little_tern: 55,
    long_eared_owl: 290, long_tailed_duck: 750, long_tailed_skua: 280,
    magpie_goose: 2400, malleefowl: 1900, manx_shearwater: 420, marsh_warbler:
    12, mediterranean_gull: 290, montagu_s_harrier: 310, musk_duck: 2000,
    nightjar: 83, orange_footed_scrubfowl: 600, pacific_baza: 330,
    pacific_gull: 1100, pacific_reef_heron: 400, pale_headed_rosella: 110,
    parrot_crossbill: 55, peaceful_dove: 50, pectoral_sandpiper: 75,
    pheasant_coucal: 350, pied_cormorant: 1800, pied_oystercatcher: 700,
    pink_eared_duck: 400, plumed_egret: 400, plumed_whistling_duck: 800,
    powerful_owl: 1400, ptarmigan: 450, purple_sandpiper: 70,
    red_backed_fairywren: 8, red_backed_shrike: 28, red_breasted_merganser:
    1100, red_capped_plover: 40, red_capped_robin: 9, red_crested_pochard:
    1100, red_necked_avocet: 310, red_necked_grebe: 900, red_necked_phalarope:
    35, red_necked_stint: 30, red_tailed_black_cockatoo: 700,
    red_throated_diver: 1500, red_winged_parrot: 130, regent_bowerbird: 110,
    restless_flycatcher: 20, ring_ouzel: 110, rock_pipit: 25, roseate_tern:
    110, rough_legged_buzzard: 1000, ruddy_duck: 560, ruff: 150,
    rufous_fantail: 10, sahul_sunbird: 9, sandwich_tern: 240, savi_s_warbler:
    16, scaly_breasted_lorikeet: 85, scarlet_honeyeater: 9, scarlet_robin: 13,
    scaup: 1000, scottish_crossbill: 45, serin: 12, sharp_tailed_sandpiper:
    65, shore_lark: 35, short_eared_owl: 330, short_toed_treecreeper: 9,
    singing_honeyeater: 30, slavonian_grebe: 450, smew: 600, snow_bunting: 38,
    sooty_oystercatcher: 800, sooty_shearwater: 800, spiny_cheeked_honeyeater:
    45, splendid_fairywren: 10, spotted_crake: 90, spotted_redshank: 160,
    stejneger_s_stonechat: 14, stone_curlew: 450, storm_petrel: 28,
    striated_thornbill: 7, swamp_harrier: 650, taiga_bean_goose: 3200,
    tasmanian_nativehen: 900, temminck_s_stint: 25, tree_martin: 15,
    tundra_bean_goose: 2800, twite: 15, varied_sittella: 13, varied_triller:
    35, variegated_fairywren: 8, velvet_scoter: 1700, water_pipit: 23,
    weebill: 6, whimbrel: 430, whinchat: 17, white_bellied_cuckooshrike: 75,
    white_bellied_sea_eagle: 3000, white_breasted_woodswallow: 38,
    white_browed_babbler: 40, white_cheeked_honeyeater: 20,
    white_eared_honeyeater: 22, white_fronted_chat: 13, white_fronted_goose:
    2300, white_headed_pigeon: 380, white_naped_honeyeater: 14,
    white_necked_heron: 900, white_throated_honeyeater: 13,
    white_throated_treecreeper: 22, wonga_pigeon: 400, wood_sandpiper: 65,
    wood_warbler: 10, woodcock: 300, woodlark: 28, wryneck: 35,
    yellow_billed_spoonbill: 1700, yellow_browed_warbler: 7,
    yellow_legged_gull: 1100, yellow_thornbill: 7, yellow_throated_miner: 55,
    zebra_finch: 12
  };

  function slugForName(name) {
    return String(name || '').split('(')[0].trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  function fieldGuideMassG(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const byId = FIELD_GUIDE_MASS_G[String(profile.id || '')];
    if (Number.isFinite(byId) && byId > 0) return byId;
    const byName = FIELD_GUIDE_MASS_G[slugForName(profile.name)];
    if (Number.isFinite(byName) && byName > 0) return byName;
    return null;
  }

  // ---------------------------------------------------------------------------
  // Where a size score comes from
  // ---------------------------------------------------------------------------
  // Real body mass, in grams, if this species' profile carries it. The national
  // completion catalogue records AVONET's measured Mass on every profile; the
  // hand-curated roster does not, and this returns null rather than inventing a
  // number.
  function massGramsFromProfile(profile) {
    if (!profile || typeof profile !== 'object') return null;
    const direct = Number(profile.massG);
    if (Number.isFinite(direct) && direct > 0) return direct;
    const prov = profile.statProvenance || {};
    const candidates = [
      prov.derivedInputs && prov.derivedInputs.mass,
      prov.rawTraits && prov.rawTraits.Mass
    ];
    for (const value of candidates) {
      const mass = Number(value);
      if (Number.isFinite(mass) && mass > 0) return mass;
    }
    return null;
  }

  // Grams → 0-100, on a log scale because bird mass spans four orders of
  // magnitude. 2.5 g (the smallest hummingbirds) sits at 0; 12 kg (a mute swan,
  // about as heavy as a flying bird gets) sits at 100.
  const MASS_LOG_MIN = 0.4;   // log10(2.5 g)
  const MASS_LOG_MAX = 4.08;  // log10(12000 g)
  function sizeScoreFromMassGrams(grams) {
    const g = Number(grams);
    if (!Number.isFinite(g) || g <= 0) return null;
    const span = MASS_LOG_MAX - MASS_LOG_MIN;
    return clamp(Math.round(((Math.log10(g) - MASS_LOG_MIN) / span) * 100), 0, 100);
  }

  // …and back again: the typical grams behind a score, for birds that only
  // stored the score. The carry rule below runs on grams, not on the log-scale
  // score, so a raven's load really is double a crow's rather than one notch up.
  function massGramsFromScore(score) {
    const s = clamp(n(score, 45), 0, 100);
    const span = MASS_LOG_MAX - MASS_LOG_MIN;
    return Math.pow(10, MASS_LOG_MIN + (s / 100) * span);
  }

  // No measured mass: read the size back off the 1-10 biology stats the profile
  // was written from. HP is body size in this game's stat language (the
  // generated catalogue literally derives it as 1 + log10(mass) * 2) and
  // STRENGTH carries the rest of the build, so the blend tracks weight closely.
  function sizeScoreFromStats(stats) {
    if (!stats || typeof stats !== 'object') return null;
    const hp = Number(stats.hp);
    const strength = Number(stats.strength);
    if (!Number.isFinite(hp) && !Number.isFinite(strength)) return null;
    const bulk = (Number.isFinite(hp) ? hp : strength) * 0.65 + (Number.isFinite(strength) ? strength : hp) * 0.35;
    return clamp(Math.round(((bulk - 1) / 9) * 100), 0, 100);
  }

  // The one entry point: what size is this species? Returns the score, the
  // class, the grams when they are genuinely known, and where the answer came
  // from — so the UI can say "measured" rather than implying it everywhere.
  function speciesSize(profile) {
    // The carrying guild travels with the size, because both are facts about
    // the species and neither one may be re-decided later from a save.
    const guild = carryGuildForProfile(profile);
    const sized = (score, massG, source) => ({
      score, classId: sizeClassForScore(score).id, class: sizeClassForScore(score),
      massG, source, carryGuild: guild
    });
    const grams = massGramsFromProfile(profile);
    const fromMass = sizeScoreFromMassGrams(grams);
    if (fromMass != null) return sized(fromMass, grams, 'mass');
    // No measured mass: the curated field-guide weight, where the roster has one.
    const fieldGrams = fieldGuideMassG(profile);
    const fromField = sizeScoreFromMassGrams(fieldGrams);
    if (fromField != null) return sized(fromField, fieldGrams, 'field');
    const fromStats = sizeScoreFromStats(profile && profile.stats);
    if (fromStats != null) return sized(fromStats, null, 'stats');
    // Nothing known at all — a mid-sized bird is the least wrong guess.
    return sized(45, null, 'default');
  }

  // A bird already in the flock stores its own size (set when its stats were
  // generated). Level and training must never change it: a well-fed robin is
  // still a robin.
  function birdSizeScore(bird) {
    if (!bird || typeof bird !== 'object') return 45;
    const stored = Number(bird.sizeScore);
    if (Number.isFinite(stored)) return clamp(stored, 0, 100);
    const fromClass = SIZE_CLASS_INDEX[String(bird.sizeClass || '')];
    if (fromClass) return fromClass.minScore + 10;
    return 45;
  }

  // ---------------------------------------------------------------------------
  // What a bird is built to carry — the carrying guilds
  // ---------------------------------------------------------------------------
  // Weight is half the answer. The other half is what the bird is FOR. A Merlin
  // hunts by carrying prey home in its feet; a Mute Swan is nine times heavier
  // and carries nothing at all. So every bird joins a carrying guild, and the
  // guild is a straight multiplier on what its weight alone would allow.
  //
  // The numbers are read off real loads: raptors and owls fly with prey in
  // their talons, so they lift a big share of their own body weight; corvids
  // and shrikes carry in beak and feet and are famous for it; parrots have feet
  // like hands; a pelican has a pouch. Against that, waterfowl have webbed feet
  // and a flat bill, gamebirds barely fly, swifts and swallows never land, and
  // an albatross cannot take off carrying anything.
  const CARRY_GUILDS = {
    osprey:    { id:'osprey',    factor:1.60, label:'Best feet', blurb:'A reversible toe and a sole full of spines: the finest grip in the Kingdom.' },
    raptor:    { id:'raptor',    factor:1.45, label:'Talons',    blurb:'Hunts by carrying prey home in its feet.' },
    owl:       { id:'owl',       factor:1.35, label:'Talons',    blurb:'Silent, and strong in the foot — it flies with its supper.' },
    beakfisher:{ id:'beakfisher',factor:1.35, label:'Sure bill', blurb:'Takes a fish a quarter of its own weight and flies off with it.' },
    corvid:    { id:'corvid',    factor:1.30, label:'Beak & wit', blurb:'Carries in beak and foot, and works out how to carry more.' },
    fisher:    { id:'fisher',    factor:1.15, label:'Fisher',    blurb:'A bill built to hold a heavy, slippery catch.' },
    gull:      { id:'gull',      factor:1.15, label:'Scavenger', blurb:'Will lift anything it can get a bill around.' },
    pouch:     { id:'pouch',     factor:1.15, label:'Pouch',     blurb:'Fishes with the pouch, but drains it and swallows before take-off.' },
    kite:      { id:'kite',      factor:1.15, label:'Snatcher',  blurb:'Light on the wing and weak in the foot — it snatches scraps, not prey.' },
    bonedropper:{ id:'bonedropper', factor:1.10, label:'Bone-dropper', blurb:'Carries bones aloft to drop on the rocks. Nothing else on Earth does this.' },
    parrot:    { id:'parrot',    factor:1.10, label:'Hands',     blurb:'Feet like hands — for a perched bird. It rarely flies carrying anything.' },
    clinger:   { id:'clinger',   factor:1.05, label:'Clinger',   blurb:'Strong bill, strong grip, short flights.' },
    songbird:  { id:'songbird',  factor:1.00, label:'Beakful',   blurb:'Carries an honest beakful for its size.' },
    wader:     { id:'wader',     factor:0.80, label:'Long legs', blurb:'Built for wading, not for hauling.' },
    pigeon:    { id:'pigeon',    factor:0.75, label:'Crop',      blurb:'Fine flier, but weak feet — it carries inside, not underneath.' },
    oceanic:   { id:'oceanic',   factor:0.70, label:'Ocean wing', blurb:'Wings for a thousand miles, and no way to lift cargo.' },
    aerial:    { id:'aerial',    factor:0.65, label:'On the wing', blurb:'Almost never lands, so almost never carries.' },
    swimmer:   { id:'swimmer',   factor:0.60, label:'Swimmer',   blurb:'Swims better than anything here, and cannot fly a load.' },
    vulture:   { id:'vulture',   factor:0.60, label:'Walking foot', blurb:'Blunt feet made for walking on a carcass. It carries its meal inside, not underneath.' },
    waterfowl: { id:'waterfowl', factor:0.55, label:'Webbed',    blurb:'Webbed feet and a flat bill: heavy, and no way to hold on.' },
    ratite:    { id:'ratite',    factor:0.55, label:'On foot',   blurb:'Cannot fly a load — but can walk one a very long way.' },
    gamebird:  { id:'gamebird',  factor:0.50, label:'Ground bird', blurb:'Runs, then flies just far enough. Carrying is not in the plan.' }
  };
  const DEFAULT_CARRY_GUILD = 'songbird';

  // The generated catalogue records family and order on every profile, so most
  // of the roster is placed by taxonomy rather than by guesswork.
  const FAMILY_GUILD = {
    Accipitridae:'raptor', Falconidae:'raptor', Sagittariidae:'raptor',
    Pandionidae:'osprey', Cathartidae:'vulture',
    Strigidae:'owl', Tytonidae:'owl',
    Corvidae:'corvid', Laniidae:'corvid', Artamidae:'corvid', Cracticidae:'corvid',
    Cacatuidae:'parrot', Psittaculidae:'parrot', Psittacidae:'parrot',
    Strigopidae:'parrot', Nestoridae:'parrot',
    Pelecanidae:'pouch',
    Alcedinidae:'beakfisher', Halcyonidae:'beakfisher', Cerylidae:'beakfisher',
    Meropidae:'beakfisher',
    Ardeidae:'fisher', Ciconiidae:'fisher', Threskiornithidae:'fisher',
    Balaenicipitidae:'fisher', Sulidae:'fisher', Fregatidae:'fisher',
    Phalacrocoracidae:'fisher', Anhingidae:'fisher',
    Laridae:'gull', Stercorariidae:'gull', Alcidae:'gull', Rynchopidae:'gull',
    Picidae:'clinger', Ramphastidae:'clinger', Bucerotidae:'clinger',
    Trogonidae:'clinger', Coraciidae:'clinger', Upupidae:'clinger',
    Apodidae:'aerial', Hirundinidae:'aerial', Caprimulgidae:'aerial',
    Eurostopodidae:'aerial', Podargidae:'aerial', Trochilidae:'aerial',
    Diomedeidae:'oceanic', Procellariidae:'oceanic', Hydrobatidae:'oceanic',
    Oceanitidae:'oceanic', Phaethontidae:'oceanic',
    Columbidae:'pigeon', Pteroclidae:'pigeon',
    Scolopacidae:'wader', Charadriidae:'wader', Recurvirostridae:'wader',
    Haematopodidae:'wader', Burhinidae:'wader', Jacanidae:'wader',
    Glareolidae:'wader', Rostratulidae:'wader', Chionididae:'wader',
    Gruidae:'wader', Otididae:'wader', Phoenicopteridae:'wader',
    Anatidae:'waterfowl', Anseranatidae:'waterfowl', Rallidae:'waterfowl',
    Podicipedidae:'waterfowl', Gaviidae:'waterfowl',
    Spheniscidae:'swimmer',
    Phasianidae:'gamebird', Numididae:'gamebird', Odontophoridae:'gamebird',
    Turnicidae:'gamebird', Pedionomidae:'gamebird', Megapodiidae:'gamebird',
    Casuariidae:'ratite', Struthionidae:'ratite', Rheidae:'ratite',
    Apterygidae:'ratite', Dromaiidae:'ratite'
  };
  const ORDER_GUILD = {
    Accipitriformes:'raptor', Falconiformes:'raptor', Cathartiformes:'vulture',
    Strigiformes:'owl', Psittaciformes:'parrot',
    Coraciiformes:'beakfisher', Pelecaniformes:'fisher', Suliformes:'fisher',
    Ciconiiformes:'fisher', Piciformes:'clinger', Bucerotiformes:'clinger',
    Trogoniformes:'clinger', Charadriiformes:'wader', Otidiformes:'wader',
    Phoenicopteriformes:'wader', Gruiformes:'waterfowl',
    Anseriformes:'waterfowl', Podicipediformes:'waterfowl', Gaviiformes:'waterfowl',
    Sphenisciformes:'swimmer', Galliformes:'gamebird',
    Procellariiformes:'oceanic', Phaethontiformes:'oceanic',
    Columbiformes:'pigeon', Pterocliformes:'pigeon',
    Caprimulgiformes:'aerial', Apodiformes:'aerial',
    Struthioniformes:'ratite', Casuariiformes:'ratite', Rheiformes:'ratite',
    Apterygiformes:'ratite'
  };

  // The hand-curated roster carries no taxonomy at all, so it is placed by
  // name. Most birds say what they are — "eagle", "gull", "duck" — and the
  // ones that do not are named here by profile id.
  const GUILD_BY_ID = {
    merlin:'raptor', hobby:'raptor', secretarybird:'raptor',
    sparrowhawk:'raptor', goshawk:'raptor', northern_goshawk:'raptor',
    western_marsh_harrier:'raptor', buzzard:'raptor',
    black_shouldered_kite:'raptor', letter_winged_kite:'raptor',
    black_winged_kite:'raptor', osprey:'osprey', bearded_vulture:'bonedropper',
    red_kite:'kite', whistling_kite:'kite', square_tailed_kite:'kite',
    kea:'parrot', kakapo:'parrot', galah:'parrot', budgerigar:'parrot',
    cockatiel:'parrot', rainbow_lorikeet:'parrot', musk_lorikeet:'parrot',
    little_corella: 'parrot', long_billed_corella:'parrot',
    hardhead:'waterfowl', gadwall:'waterfowl', mallard:'waterfowl',
    common_pochard:'waterfowl', goosander:'waterfowl', eurasian_wigeon:'waterfowl',
    northern_pintail:'waterfowl', northern_shoveler:'waterfowl',
    common_goldeneye:'waterfowl', common_eider:'waterfowl', hoary_headed_grebe:'waterfowl',
    australasian_grebe:'waterfowl', great_crested_grebe:'waterfowl',
    little_grebe:'waterfowl', eurasian_coot:'waterfowl', water_rail:'waterfowl',
    buff_banded_rail:'waterfowl', dusky_moorhen:'waterfowl',
    australasian_swamphen:'waterfowl', common_moorhen:'waterfowl',
    red_grouse:'gamebird', grey_partridge:'gamebird', red_legged_partridge:'gamebird',
    pheasant:'gamebird', common_quail:'gamebird', australian_brushturkey:'gamebird',
    kittiwake:'gull', razorbill:'gull', puffin:'gull', guillemot:'gull',
    dipper:'songbird', kookaburra:'beakfisher', laughing_kookaburra:'beakfisher',
    dollarbird:'clinger', shoebill:'fisher', australasian_darter:'fisher',
    european_shag:'fisher', cormorant:'fisher', gannet:'fisher',
    royal_spoonbill:'fisher', australian_white_ibis:'fisher',
    straw_necked_ibis:'fisher', little_egret:'fisher', great_egret:'fisher',
    western_cattle_egret:'fisher', nankeen_night_heron:'fisher',
    white_faced_heron:'fisher', heron:'fisher', great_blue_heron:'fisher',
    pacific_reef_heron:'fisher', kingfisher:'beakfisher', sacred_kingfisher:'beakfisher',
    malachite_kingfisher:'beakfisher', belted_kingfisher:'beakfisher',
    rainbow_bee_eater:'beakfisher', european_bee_eater:'beakfisher',
    northern_fulmar:'oceanic', wandering_albatross:'oceanic',
    swift:'aerial', tawny_frogmouth:'aerial', great_frigatebird:'fisher',
    blue_footed_booby:'fisher', kori_bustard:'wader', sandhill_crane:'wader',
    common_crane:'wader', grey_crowned_crane:'wader', red_crowned_crane:'wader',
    sarus_crane:'wader', greater_flamingo:'wader', bush_stone_curlew:'wader',
    pied_stilt:'wader', killdeer:'wader', emu:'ratite', common_ostrich:'ratite',
    southern_cassowary:'ratite', greater_rhea:'ratite',
    north_island_brown_kiwi:'ratite',
    magpie_lark:'songbird', willie_wagtail:'songbird', silvereye:'songbird',
    white_winged_chough:'corvid', pied_currawong:'corvid', grey_currawong:'corvid',
    grey_butcherbird:'corvid', pied_butcherbird:'corvid',
    australian_magpie:'corvid', torresian_crow:'corvid', spangled_drongo:'corvid',
    toco_toucan:'clinger', eurasian_hoopoe:'clinger', lilac_breasted_roller:'clinger',
    resplendent_quetzal:'clinger'
  };

  // Word by word, longest first, so "sea-eagle" wins before "eagle" and
  // "black-headed gull" before "gull". Order matters here.
  const GUILD_BY_KEYWORD = [
    ['ratite',   ['ostrich','cassowary','emu','rhea','kiwi']],
    ['raptor',   ['eagle','hawk','kite','harrier','buzzard','falcon','kestrel','caracara','goshawk','sparrowhawk','baza','merlin','hobby','gyrfalcon']],
    ['owl',      ['owl','boobook','morepork']],
    ['pouch',    ['pelican']],
    ['corvid',   ['crow','raven','rook','jackdaw','magpie','jay','chough','nutcracker','shrike','currawong','butcherbird','treepie']],
    ['parrot',   ['parrot','cockatoo','macaw','lorikeet','rosella','corella','cockatiel','budgerigar','parakeet','lovebird','conure','galah','lory']],
    ['swimmer',  ['penguin']],
    ['oceanic',  ['albatross','petrel','shearwater','fulmar','prion','storm-petrel','tropicbird']],
    ['gull',     ['gull','tern','skua','kittiwake','noddy','auk','puffin','razorbill','guillemot','murrelet']],
    ['beakfisher',['kingfisher','kookaburra','kingbird','bee-eater']],
    ['fisher',   ['heron','egret','bittern','stork','ibis','spoonbill','cormorant','shag','darter','gannet','booby','frigatebird','shoebill']],
    ['gamebird', ['pheasant','partridge','grouse','quail','ptarmigan','francolin','guineafowl','brushturkey','megapode','junglefowl','peafowl','turkey']],
    ['waterfowl',['duck','goose','swan','teal','wigeon','pintail','shoveler','pochard','goldeneye','merganser','shelduck','eider','scoter','goosander','smew','grebe','coot','moorhen','rail','crake','swamphen','loon','diver','hardhead']],
    ['wader',    ['sandpiper','plover','godwit','curlew','redshank','greenshank','snipe','dunlin','stint','turnstone','oystercatcher','avocet','stilt','lapwing','phalarope','sanderling','woodcock','crane','bustard','flamingo','dotterel','knot','ruff','killdeer','stone-curlew','thick-knee','jacana','pratincole']],
    ['pigeon',   ['pigeon','dove','bronzewing','sandgrouse']],
    ['clinger',  ['woodpecker','toucan','hornbill','trogon','quetzal','hoopoe','roller','barbet','wryneck','flicker','sapsucker','dollarbird']],
    ['aerial',   ['swift','swallow','martin','nightjar','frogmouth','hummingbird','swiftlet','nighthawk','potoo']]
  ];

  // Taxonomy is blind to the thing that matters most here: Accipitridae holds
  // the eagles, the Old World vultures and the kites in one family, and they
  // carry nothing alike. A griffon has near-chicken feet and gorges rather than
  // carries; a red kite snatches scraps; an osprey has the best grip of any
  // bird alive. These are checked by name BEFORE the family map, so the family
  // can never overrule them.
  const GUILD_EXCEPTIONS = [
    ['bonedropper', ['bearded vulture', 'lammergeier']],
    ['waterfowl', ['magpie goose']],
    ['vulture',  ['vulture', 'condor']],
    ['osprey',   ['osprey', 'fish hawk']],
    ['kite',     ['red kite', 'black kite', 'whistling kite', 'brahminy kite', 'square-tailed kite', 'swallow-tailed kite']]
  ];

  // Whole words only. A plain substring test reads "Eastern" as a tern, "Bittern"
  // as a tern, "Owlet-nightjar" as an owl and "Dovekie" as a dove — so each
  // keyword matches on word boundaries, tolerating an English plural and a
  // hyphen wherever the keyword has a space.
  const GUILD_WORD_CACHE = {};
  function guildWordRegex(word) {
    let re = GUILD_WORD_CACHE[word];
    if (!re) {
      const body = String(word).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[-\s]+/g, '[-\\s]');
      re = new RegExp('(^|[^a-z])' + body + 's?($|[^a-z])', 'i');
      GUILD_WORD_CACHE[word] = re;
    }
    return re;
  }

  function guildFromText(text, table) {
    const t = String(text || '').toLowerCase();
    if (!t) return null;
    for (const [guild, words] of (table || GUILD_BY_KEYWORD)) {
      for (const word of words) if (guildWordRegex(word).test(t)) return guild;
    }
    return null;
  }

  // Which carrying guild does this species belong to? Taxonomy first, because
  // it cannot be fooled by a name; then the roster's own id list; then the name
  // itself. A bird that answers to none of them is an ordinary songbird, which
  // is the honest default — most birds are.
  function carryGuildForProfile(profile) {
    if (!profile || typeof profile !== 'object') return DEFAULT_CARRY_GUILD;
    const names = [profile.name, profile.commonName].concat(profile.aliases || []);
    // 1. A call made on this exact bird beats every rule below it.
    const byId = GUILD_BY_ID[String(profile.id || '')] || GUILD_BY_ID[slugForName(profile.name)];
    if (byId) return byId;
    // 2. The exceptions taxonomy cannot see.
    for (const name of names) {
      const hit = guildFromText(name, GUILD_EXCEPTIONS);
      if (hit) return hit;
    }
    // 3. Taxonomy, where the catalogue knows it.
    const byFamily = FAMILY_GUILD[String(profile.family || '')];
    if (byFamily) return byFamily;
    const byOrder = ORDER_GUILD[String(profile.order || '')];
    if (byOrder) return byOrder;
    // 4. The name — how the hand-written roster, which carries no taxonomy at
    //    all, gets placed. Most birds say what they are.
    for (const name of names) {
      const hit = guildFromText(name);
      if (hit) return hit;
    }
    return DEFAULT_CARRY_GUILD;
  }

  function carryGuild(guildId) {
    return CARRY_GUILDS[String(guildId || '')] || CARRY_GUILDS[DEFAULT_CARRY_GUILD];
  }

  // ---------------------------------------------------------------------------
  // Carrying — bigger birds bring more home, in true proportion
  // ---------------------------------------------------------------------------
  // Capacity is measured in load units: one item is one unit, and timber packs
  // three branches to the unit.
  //
  // Until v335 the units were weight straight over 100 g, and that flattened
  // the game at both ends: every bird from a 5 g Goldcrest to a 110 g Myna
  // carried exactly 1, every bird over 2 kg carried the cap of 20, and a
  // Merlin — a falcon that hunts by carrying prey home — managed 2 against a
  // Robin's 1. Yaan's rule, and the fix: a wren or a robin carries one, and
  // from there it climbs all the way to what a real bird could really lift.
  //
  // Two things decide it now.
  //   1. Weight, on a square-root curve anchored on the Robin. Doubling a
  //      bird's weight does not double its load — that is why the old rule ran
  //      out of headroom — but four times the bird really is twice the haul.
  //   2. The carrying guild above: what the bird is actually built to carry.
  // So a Merlin carries 5 to a Robin's 1, a Raven 11, a Golden Eagle 23 — and
  // an 11 kg Mute Swan, all weight and no grip, manages 14.
  //
  // Stamina and level still add a little on top — a seasoned bird packs better
  // — but they can never lift a wren into eagle territory.
  const BRANCHES_PER_LOAD_UNIT = 3;
  const CARRY_REFERENCE_MASS_G = 18;   // a Robin: the bird Yaan named as "carries one".
  const CARRY_MASS_EXPONENT = 0.5;     // four times the bird, twice the load.
  const MIN_CARRY_UNITS = 1;
  const MAX_CARRY_UNITS = 30;          // a Steller's Sea-Eagle, and nothing carries more.
  // Kept so older callers and saved games that still speak in grams-per-unit
  // have an honest answer, and because the size chip's copy quotes it.
  const GRAMS_PER_LOAD_UNIT = 100;

  // The grams behind a bird in the flock: its stored true weight when it has
  // one, otherwise the typical weight implied by its size score.
  function birdMassGrams(bird) {
    const direct = Number(bird && bird.massG);
    if (Number.isFinite(direct) && direct > 0) return direct;
    return massGramsFromScore(birdSizeScore(bird));
  }

  // The guild a bird in the flock belongs to. It is stamped on the bird when
  // its stats are generated, so this never has to go looking for the profile.
  function birdCarryGuild(bird) {
    if (!bird || typeof bird !== 'object') return DEFAULT_CARRY_GUILD;
    const stored = String(bird.carryGuild || '');
    if (CARRY_GUILDS[stored]) return stored;
    // A companion saved before v335 has no guild on it. Read one off its own
    // name rather than flattening every legacy bird to "songbird".
    return carryGuildForProfile(bird) || DEFAULT_CARRY_GUILD;
  }

  // What this bird's own back is worth, before gear — the honest number, kept
  // unrounded so the callers that want a bar rather than a chip can have one.
  function carryUnitsRaw(bird) {
    const grams = Math.max(1, birdMassGrams(bird));
    const byWeight = Math.pow(grams / CARRY_REFERENCE_MASS_G, CARRY_MASS_EXPONENT);
    return byWeight * carryGuild(birdCarryGuild(bird)).factor;
  }

  function carryCapacity(bird, equipmentBonus) {
    const staminaBonus = Math.max(0, (n(bird && bird.stamina, 50) - 50) / 120);
    const levelBonus = Math.max(0, (n(bird && bird.level, 1) - 1) / 10);
    const satchelBonus = Math.max(0, Math.floor(n(equipmentBonus, 0)));
    // Even a goldcrest manages one load of its own; a satchel always adds on top.
    const ownUnits = Math.max(MIN_CARRY_UNITS, Math.round(carryUnitsRaw(bird) + staminaBonus + levelBonus));
    return clamp(ownUnits + satchelBonus, MIN_CARRY_UNITS, MAX_CARRY_UNITS);
  }

  // How much a bird of this size finds room for on the way home, as a multiple
  // of a mid-sized bird's haul: a tiny bird brings back roughly half, a giant
  // nearly double.
  function haulMultiplier(bird) {
    const score = birdSizeScore(bird);
    return Math.round((0.55 + (score / 100) * 1.15) * 100) / 100;    // 0.55 .. 1.70
  }

  // Apply both halves of the rule to an expedition payout. Timber and item
  // counts scale by the haul multiplier, then the whole load is capped at what
  // the bird can physically carry — anything over the cap is left behind, and
  // named so the player can see why.
  function applyCarryLimit(rewards, bird, equipmentBonus) {
    const capacity = carryCapacity(bird, equipmentBonus);
    const mult = haulMultiplier(bird);
    const source = rewards && typeof rewards === 'object' ? rewards : {};
    const branchesWanted = Math.max(0, Math.round(n(source.branches, 0) * mult));
    const items = {};
    Object.entries(source.items || {}).forEach(([id, count]) => {
      const wanted = Math.max(0, Math.round(n(count, 0) * mult));
      if (wanted > 0) items[id] = wanted;
    });

    // A bird comes home with the thing it was sent for. Before v335 finds were
    // packed first and timber got a single unit back, which meant a Golden Eagle
    // on a day-long TIMBER errand returned three branches and an armful of moss,
    // and any bird with a one-unit hold — nearly half the roster — came home
    // from a food errand with two sticks and nothing to eat.
    //
    // Now the hold is shared in proportion to what the bird actually found. A
    // timber errand is mostly timber, so timber gets most of the hold; a food
    // errand is mostly food, so food does. Neither side comes home empty while
    // the other has room to spare, and if the hold is a single unit the bigger
    // find wins it outright — which is the same thing as "bring back what you
    // were sent for".
    const branchUnitsWanted = Math.ceil(branchesWanted / BRANCHES_PER_LOAD_UNIT);
    const itemUnitsWanted = Object.values(items).reduce((sum, count) => sum + count, 0);
    const totalWanted = branchUnitsWanted + itemUnitsWanted;
    let branchUnits = branchUnitsWanted;
    let itemUnits = itemUnitsWanted;
    if (totalWanted > capacity) {
      branchUnits = Math.min(branchUnitsWanted, Math.round(capacity * (branchUnitsWanted / totalWanted)));
      itemUnits = Math.min(itemUnitsWanted, capacity - branchUnits);
      // Rounding can leave a unit spare. Give it to whichever side still wants one.
      let spare = capacity - branchUnits - itemUnits;
      while (spare > 0 && (branchUnits < branchUnitsWanted || itemUnits < itemUnitsWanted)) {
        if (itemUnits < itemUnitsWanted) itemUnits += 1; else branchUnits += 1;
        spare -= 1;
      }
      // Never come home with none of one find while the other fills the hold.
      if (branchUnits === 0 && branchUnitsWanted > 0 && itemUnits > 1) { branchUnits = 1; itemUnits -= 1; }
      if (itemUnits === 0 && itemUnitsWanted > 0 && branchUnits > 1) { itemUnits = 1; branchUnits -= 1; }
    }

    // Within the item half, the commonest find goes in first: a bird sent for
    // acorns comes home with acorns, not with the one pinch of grit it also
    // picked up. Ties keep their rolled order so the payout stays deterministic.
    const ordered = Object.entries(items).sort((a, b) => b[1] - a[1]);
    let unitsUsed = 0;
    const carriedItems = {};
    let leftBehind = 0;
    ordered.forEach(([id, count]) => {
      const taken = Math.min(count, Math.max(0, itemUnits - unitsUsed));
      if (taken > 0) { carriedItems[id] = taken; unitsUsed += taken; }
      leftBehind += count - taken;
    });
    const branches = Math.min(branchesWanted, branchUnits * BRANCHES_PER_LOAD_UNIT);
    leftBehind += Math.ceil(Math.max(0, branchesWanted - branches) / BRANCHES_PER_LOAD_UNIT);

    return {
      capacity,
      haulMultiplier: mult,
      unitsUsed: unitsUsed + Math.ceil(branches / BRANCHES_PER_LOAD_UNIT),
      branches,
      items: carriedItems,
      leftBehind,
      overloaded: leftBehind > 0
    };
  }

  // ---------------------------------------------------------------------------
  // Battle — bigger birds hit harder
  // ---------------------------------------------------------------------------
  // A single multiplier on the combat stats (HP, ATK, DEF and MAG), monotonic in
  // size so the rule is exactly true: every step up in weight is a step up in
  // fighting strength. It is applied ONCE, where a bird's stats are generated,
  // so nothing downstream has to remember to apply it again.
  //
  // Speed, cleverness and charm are deliberately untouched: a swift still
  // outflies a swan, and a robin still out-talks an eagle. Small birds keep the
  // Kingdom's magic as their edge — but an edge, now, not an equaliser.
  const BATTLE_MIN_MULT = 0.75;
  const BATTLE_MAX_MULT = 1.30;
  function battlePowerMultiplier(birdOrScore) {
    const score = typeof birdOrScore === 'number' ? clamp(birdOrScore, 0, 100) : birdSizeScore(birdOrScore);
    const mult = BATTLE_MIN_MULT + (score / 100) * (BATTLE_MAX_MULT - BATTLE_MIN_MULT);
    return Math.round(mult * 1000) / 1000;
  }

  // One line for the card: "🦅 Giant · carries 8 · +30% in battle".
  function sizeSummary(bird, equipmentBonus) {
    const score = birdSizeScore(bird);
    const cls = sizeClassForScore(score);
    const mult = battlePowerMultiplier(score);
    const pct = Math.round((mult - 1) * 100);
    const guild = carryGuild(birdCarryGuild(bird));
    return {
      score,
      classId: cls.id,
      label: cls.label,
      icon: cls.icon,
      blurb: cls.blurb,
      capacity: carryCapacity(bird, equipmentBonus),
      haulMultiplier: haulMultiplier(bird),
      carryGuild: guild.id,
      carryGuildLabel: guild.label,
      carryGuildBlurb: guild.blurb,
      carryGuildFactor: guild.factor,
      battleMultiplier: mult,
      battlePct: pct,
      battleLabel: (pct >= 0 ? '+' : '') + pct + '% in battle'
    };
  }

  return {
    SIZE_CLASSES,
    SIZE_CLASS_INDEX,
    FIELD_GUIDE_MASS_G,
    CARRY_GUILDS,
    DEFAULT_CARRY_GUILD,
    FAMILY_GUILD,
    ORDER_GUILD,
    GUILD_BY_ID,
    BRANCHES_PER_LOAD_UNIT,
    GRAMS_PER_LOAD_UNIT,
    CARRY_REFERENCE_MASS_G,
    CARRY_MASS_EXPONENT,
    MIN_CARRY_UNITS,
    MAX_CARRY_UNITS,
    BATTLE_MIN_MULT,
    BATTLE_MAX_MULT,
    sizeClassForScore,
    carryGuildForProfile,
    carryGuild,
    birdCarryGuild,
    carryUnitsRaw,
    massGramsFromProfile,
    fieldGuideMassG,
    sizeScoreFromMassGrams,
    massGramsFromScore,
    sizeScoreFromStats,
    speciesSize,
    birdSizeScore,
    birdMassGrams,
    carryCapacity,
    haulMultiplier,
    applyCarryLimit,
    battlePowerMultiplier,
    sizeSummary
  };
});
