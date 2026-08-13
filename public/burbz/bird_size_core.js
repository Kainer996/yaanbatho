// Burbz Bird Size Core — "Weight tells".
// One honest rule, applied everywhere: a bigger bird can carry more and hits
// harder; a little bird carries less and hits softer. Size is not a made-up
// game number — where the catalogue knows a species' real body mass (AVONET
// Supplementary Dataset 1, shipped in each profile's statProvenance) that mass
// IS the size. The hand-curated UK/AU roster carries its own field-guide
// weights below (raven-weight-and-wit-v255: a Raven really is twice a Carrion
// Crow, and its load says so). Only a bird with no weight anywhere falls back
// to the biology stats it was written from: HP and STRENGTH.
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
    raven: 1200, carrion_crow: 510, rook: 430, jackdaw: 220, magpie: 230,
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
    song_thrush: 70, redwing: 63, fieldfare: 100, skylark: 38,
    meadow_pipit: 18, tree_pipit: 22, pied_wagtail: 21, grey_wagtail: 17,
    stonechat: 15, northern_wheatear: 25, common_redstart: 15,
    pied_flycatcher: 13, chiffchaff: 8, willow_warbler: 9, blackcap: 17,
    greater_whitethroat: 15, sedge_warbler: 12, treecreeper: 9, nuthatch: 23,
    swallow: 19, house_martin: 18, sand_martin: 14, swift: 40, dipper: 60,
    kingfisher: 40, great_spotted_woodpecker: 85, green_woodpecker: 190,
    // Doves and pigeons.
    woodpigeon: 490, stock_dove: 300, collared_dove: 200, feral_pigeon: 300,
    rock_pigeon: 300, ring_necked_parakeet: 120, cuckoo: 110,
    // Raptors and owls.
    kestrel: 190, sparrowhawk: 220, red_kite: 1000, osprey: 1500, merlin: 180,
    peregrine_falcon: 700, golden_eagle: 4500, white_tailed_eagle: 5000,
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
    australian_magpie: 300, willie_wagtail: 20, noisy_miner: 60,
    rainbow_lorikeet: 130, laughing_kookaburra: 340, galah: 330,
    little_corella: 550, sulphur_crested_cockatoo: 800, crested_pigeon: 200,
    spotted_dove: 160, magpie_lark: 90, welcome_swallow: 15,
    superb_fairywren: 10, black_swan: 6000, australian_pelican: 5500,
    australian_white_ibis: 1800, straw_necked_ibis: 1300, masked_lapwing: 370,
    wedge_tailed_eagle: 3800, square_tailed_kite: 520, tawny_frogmouth: 350,
    pacific_black_duck: 1050, australian_wood_duck: 800, common_myna: 110,
    eastern_rosella: 100, crimson_rosella: 130, australian_king_parrot: 220,
    dusky_moorhen: 400, australasian_swamphen: 1000
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
    const grams = massGramsFromProfile(profile);
    const fromMass = sizeScoreFromMassGrams(grams);
    if (fromMass != null) {
      return { score: fromMass, classId: sizeClassForScore(fromMass).id, class: sizeClassForScore(fromMass), massG: grams, source: 'mass' };
    }
    // No measured mass: the curated field-guide weight, where the roster has one.
    const fieldGrams = fieldGuideMassG(profile);
    const fromField = sizeScoreFromMassGrams(fieldGrams);
    if (fromField != null) {
      return { score: fromField, classId: sizeClassForScore(fromField).id, class: sizeClassForScore(fromField), massG: fieldGrams, source: 'field' };
    }
    const fromStats = sizeScoreFromStats(profile && profile.stats);
    if (fromStats != null) {
      return { score: fromStats, classId: sizeClassForScore(fromStats).id, class: sizeClassForScore(fromStats), massG: null, source: 'stats' };
    }
    // Nothing known at all — a mid-sized bird is the least wrong guess.
    return { score: 45, classId: sizeClassForScore(45).id, class: sizeClassForScore(45), massG: null, source: 'default' };
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
  // Carrying — bigger birds bring more home, in true proportion
  // ---------------------------------------------------------------------------
  // Capacity is measured in load units: one item is one unit, and timber packs
  // three branches to the unit. Since v255 the units come straight off the
  // bird's weight — one load per 100 g — so twice the bird is twice the haul:
  // a 1.2 kg Raven packs 12 loads to a 510 g Carrion Crow's 5, a Buzzard
  // shoulders 8 to a Robin's 1, and a Herring Gull hauls a genuine 12.
  // Stamina and level add a little on top — a seasoned bird packs better — but
  // they can never lift a wren into eagle territory.
  const BRANCHES_PER_LOAD_UNIT = 3;
  const GRAMS_PER_LOAD_UNIT = 100;
  const MIN_CARRY_UNITS = 1;
  const MAX_CARRY_UNITS = 20;

  // The grams behind a bird in the flock: its stored true weight when it has
  // one, otherwise the typical weight implied by its size score.
  function birdMassGrams(bird) {
    const direct = Number(bird && bird.massG);
    if (Number.isFinite(direct) && direct > 0) return direct;
    return massGramsFromScore(birdSizeScore(bird));
  }

  function carryCapacity(bird, equipmentBonus) {
    const base = birdMassGrams(bird) / GRAMS_PER_LOAD_UNIT;
    const staminaBonus = Math.max(0, (n(bird && bird.stamina, 50) - 50) / 120);
    const levelBonus = Math.max(0, (n(bird && bird.level, 1) - 1) / 10);
    const satchelBonus = Math.max(0, Math.floor(n(equipmentBonus, 0)));
    // Even a goldcrest manages one load of its own; a satchel always adds on top.
    const ownUnits = Math.max(MIN_CARRY_UNITS, Math.round(base + staminaBonus + levelBonus));
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

    // Finds are packed first — a bird drops sticks before it drops supper — but
    // a timber errand always keeps one unit back for timber, so even a goldcrest
    // sent for branches comes home with a beakful rather than nothing at all.
    const timberReserve = branchesWanted > 0 ? 1 : 0;
    const itemRoom = Math.max(0, capacity - timberReserve);
    let unitsUsed = 0;
    const carriedItems = {};
    let leftBehind = 0;
    Object.entries(items).forEach(([id, count]) => {
      const room = Math.max(0, itemRoom - unitsUsed);
      const taken = Math.min(count, room);
      if (taken > 0) { carriedItems[id] = taken; unitsUsed += taken; }
      leftBehind += count - taken;
    });
    const branchRoom = Math.max(0, capacity - unitsUsed) * BRANCHES_PER_LOAD_UNIT;
    const branches = Math.min(branchesWanted, branchRoom);
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
    return {
      score,
      classId: cls.id,
      label: cls.label,
      icon: cls.icon,
      blurb: cls.blurb,
      capacity: carryCapacity(bird, equipmentBonus),
      haulMultiplier: haulMultiplier(bird),
      battleMultiplier: mult,
      battlePct: pct,
      battleLabel: (pct >= 0 ? '+' : '') + pct + '% in battle'
    };
  }

  return {
    SIZE_CLASSES,
    SIZE_CLASS_INDEX,
    FIELD_GUIDE_MASS_G,
    BRANCHES_PER_LOAD_UNIT,
    GRAMS_PER_LOAD_UNIT,
    MIN_CARRY_UNITS,
    MAX_CARRY_UNITS,
    BATTLE_MIN_MULT,
    BATTLE_MAX_MULT,
    sizeClassForScore,
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
