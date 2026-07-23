/* Source-backed Burbz diet compatibility and hunger transaction core. */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDietHungerCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  const FOOD_FAMILIES = {
    small_birds: { id:'small_birds', label:'Small-bird prey rations', defaultPrep:'whole' },
    small_mammals: { id:'small_mammals', label:'Small mammals', defaultPrep:'live' },
    fish: { id:'fish', label:'Fish', defaultPrep:'live' },
    flying_insects: { id:'flying_insects', label:'Flying insects', defaultPrep:'tossed' },
    invertebrates: { id:'invertebrates', label:'General invertebrates', defaultPrep:'fresh' },
    worms: { id:'worms', label:'Worms', defaultPrep:'fresh' },
    molluscs_crustaceans: { id:'molluscs_crustaceans', label:'Molluscs and crustaceans', defaultPrep:'cracked' },
    seeds: { id:'seeds', label:'Seeds', defaultPrep:'husked' },
    fruit_berries: { id:'fruit_berries', label:'Fruit and berries', defaultPrep:'fresh' },
    nectar: { id:'nectar', label:'Nectar', defaultPrep:'fresh' },
    aquatic_plants: { id:'aquatic_plants', label:'Aquatic or leafy plants', defaultPrep:'floating' },
    carrion: { id:'carrion', label:'Carrion', defaultPrep:'fresh' }
  };

  const HUNGER_THRESHOLDS = Object.freeze({
    fedMax: 44,
    peckishMin: 45,
    hungryMin: 70,
    urgentMin: 85
  });

  const ACTIVITY_HUNGER_DELTAS = Object.freeze({
    expedition: 12,
    training: 10,
    battle: 12,
    academy_drill: 10,
    passive_room_tick: 1
  });

  const HUNGER_HISTORY_LIMIT = 80;

  const PREPS = {
    whole: { id:'whole', label:'Whole prey ration' },
    live: { id:'live', label:'Live' },
    fresh: { id:'fresh', label:'Fresh' },
    cracked: { id:'cracked', label:'Cracked' },
    husked: { id:'husked', label:'Husked' },
    floating: { id:'floating', label:'Floating' },
    tossed: { id:'tossed', label:'Tossed' },
    smeared: { id:'smeared', label:'Smeared' }
  };

  const INGREDIENTS = {
    small_bird_prey_ration: {
      id:'small_bird_prey_ration', label:'Small-Bird Prey Ration', family:'small_birds',
      preps:['whole','fresh'], nourishment:42,
      desc:'Tasteful prepared falcon ration representing small-bird prey.'
    },
    field_vole: {
      id:'field_vole', label:'Field Vole', family:'small_mammals',
      preps:['live','fresh'], nourishment:36,
      desc:'Small mammal prey for owls and mammal-hunting raptors.'
    },
    live_minnow: {
      id:'live_minnow', label:'Live Minnow', family:'fish',
      preps:['live','fresh'], nourishment:34,
      desc:'Live fish for plunge-divers and fish hunters.'
    },
    river_trout: {
      id:'river_trout', label:'River Trout', family:'fish',
      preps:['live','fresh'], nourishment:38,
      desc:'A larger fish ration for specialist fish-eating birds.'
    },
    aerial_midges: {
      id:'aerial_midges', label:'Cloud of Midges', family:'flying_insects',
      preps:['tossed'], nourishment:30,
      desc:'Flying insects for birds that feed on the wing.'
    },
    mealworm_scoop: {
      id:'mealworm_scoop', label:'Mealworm Scoop', family:'invertebrates',
      preps:['fresh','smeared'], nourishment:18,
      desc:'Useful for true insectivores, but not a universal bird food.'
    },
    garden_worms: {
      id:'garden_worms', label:'Garden Worms', family:'worms',
      preps:['fresh'], nourishment:24,
      desc:'Earthworms for ground-foraging insect and worm eaters.'
    },
    shore_snail_mix: {
      id:'shore_snail_mix', label:'Shore Snail Mix', family:'molluscs_crustaceans',
      preps:['cracked','fresh'], nourishment:26,
      desc:'Molluscs and small crustaceans for waders and shorebirds.'
    },
    sunflower_seeds: {
      id:'sunflower_seeds', label:'Sunflower Seeds', family:'seeds',
      preps:['husked','fresh','floating'], nourishment:28,
      desc:'Oil-rich seeds, best husked for finches.'
    },
    acorn_handful: {
      id:'acorn_handful', label:'Acorn Handful', family:'seeds',
      preps:['fresh','cracked'], nourishment:24,
      desc:'Whole acorns and mast for jays, pigeons and other seed/nut eaters.'
    },
    hedgerow_berries: {
      id:'hedgerow_berries', label:'Hedgerow Berries', family:'fruit_berries',
      preps:['fresh'], nourishment:25,
      desc:'Native berries and soft autumn fruit.'
    },
    windfall_apple: {
      id:'windfall_apple', label:'Windfall Apple', family:'fruit_berries',
      preps:['fresh'], nourishment:22,
      desc:'Soft fruit for frugivores and thrushes.'
    },
    nectar_cup: {
      id:'nectar_cup', label:'Nectar Cup', family:'nectar',
      preps:['fresh'], nourishment:24,
      desc:'A nectar feeder for blossom specialists.'
    },
    pondweed_tangle: {
      id:'pondweed_tangle', label:'Pondweed Tangle', family:'aquatic_plants',
      preps:['floating','fresh'], nourishment:25,
      desc:'Aquatic or leafy plant food for dabblers and grazers.'
    },
    suet_cake: {
      id:'suet_cake', label:'Suet Cake', family:'invertebrates',
      preps:['smeared','fresh'], nourishment:20,
      desc:'High-energy fat cake, best pressed into bark for bark-feeders.'
    },
    carrion_scraps: {
      id:'carrion_scraps', label:'Carrion Scraps', family:'carrion',
      preps:['fresh'], nourishment:32,
      desc:'Scavenged food for carrion specialists.'
    },
    gizzard_grit: {
      id:'gizzard_grit', label:'Gizzard Grit', family:'grit',
      preps:['fresh'], nourishment:0,
      desc:'Grinding grit for seed meals; not a nourishing food by itself.'
    }
  };

  const LEGACY_FAMILY = {
    insects:'invertebrates',
    flying:'flying_insects',
    berries:'fruit_berries',
    fruit:'fruit_berries',
    aquatic:'aquatic_plants',
    meat:'small_mammals'
  };

  // Explicit bridge between old Academy pantry family counts and Kitchen
  // larder ingredient ids. A feeding transaction owns one side only:
  // `pantry.<family>` for direct Academy tray food, or
  // `inventory.larder.<ingredient>` for prepared Kitchen/Merlin food.
  const PANTRY_BRIDGE = {
    seeds:   { pantryKey:'seeds',   ingredientId:'sunflower_seeds', prep:'husked',   label:'Seeds' },
    suet:    { pantryKey:'suet',    ingredientId:'suet_cake',       prep:'smeared',  label:'Suet' },
    insects: { pantryKey:'insects', ingredientId:'mealworm_scoop',  prep:'fresh',    label:'Insects' },
    worms:   { pantryKey:'worms',   ingredientId:'garden_worms',    prep:'fresh',    label:'Worms' },
    berries: { pantryKey:'berries', ingredientId:'hedgerow_berries',prep:'fresh',    label:'Berries' },
    fruit:   { pantryKey:'fruit',   ingredientId:'windfall_apple',  prep:'fresh',    label:'Fruit' },
    fish:    { pantryKey:'fish',    ingredientId:'live_minnow',     prep:'live',     label:'Fish' },
    flying:  { pantryKey:'flying',  ingredientId:'aerial_midges',   prep:'tossed',   label:'Aerial bugs' },
    meat:    { pantryKey:'meat',    ingredientId:'field_vole',      prep:'live',     label:'Small prey' },
    carrion: { pantryKey:'carrion', ingredientId:'carrion_scraps',  prep:'fresh',    label:'Carrion' },
    acorns:  { pantryKey:'acorns',  ingredientId:'acorn_handful',   prep:'fresh',    label:'Acorns / nuts' },
    aquatic: { pantryKey:'aquatic', ingredientId:'pondweed_tangle', prep:'floating', label:'Pondweed' }
  };

  let payloadCache = null;
  let indexCache = null;

  function loadPayload() {
    if (payloadCache) return payloadCache;
    if (root && root.BURBZ_BIRD_DIET_RECORDS) {
      payloadCache = root.BURBZ_BIRD_DIET_RECORDS;
      return payloadCache;
    }
    if (typeof require === 'function') {
      try {
        payloadCache = require('./data/bird-diet-records.js');
        return payloadCache;
      } catch (err) {}
      try {
        payloadCache = require('./data/bird-diet-records.json');
        return payloadCache;
      } catch (err) {}
    }
    payloadCache = { metadata:{}, records:[], sourceRecords:[] };
    return payloadCache;
  }

  function norm(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  function compact(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
  }

  function unique(values) {
    const seen = new Set();
    const out = [];
    (values || []).forEach(value => {
      const clean = String(value || '').trim();
      if (clean && !seen.has(clean)) { seen.add(clean); out.push(clean); }
    });
    return out;
  }

  function expandSourceRecord(record) {
    if (!record || !record.s) return null;
    const primary = unique(record.primary || []);
    const secondary = unique(record.secondary || []);
    return {
      id: record.i,
      name: record.n,
      commonName: record.n,
      scientificName: record.s,
      scientific: record.s,
      family: record.f,
      aliases: unique(record.a || []),
      matchMethod: 'source-row',
      certainty: record.c || 'U',
      sourceRow: { specId: record.r },
      sourceDiet: record.p || {},
      dietPercentages: record.p || {},
      birdFuncDat: record.p || {},
      gameFamilyScores: record.g || {},
      primaryCompatibleFamilies: primary,
      secondaryCompatibleFamilies: secondary,
      refusedCompatibleFamilies: Object.keys(FOOD_FAMILIES).filter(f => !primary.includes(f) && !secondary.includes(f)),
      compatibleIngredientFamilies: primary.concat(secondary.filter(f => !primary.includes(f))),
      prepByFamily: record.prep || {}
    };
  }

  function indexRecord(indices, record) {
    if (!record) return;
    const keys = [
      record.id,
      record.name,
      record.commonName,
      record.scientificName,
      record.scientific,
      record.sourceScientificName,
      record.sourceCommonName
    ].concat(record.aliases || []);
    keys.forEach(key => {
      const n = norm(key);
      const c = compact(key);
      if (n && !indices.byNorm[n]) indices.byNorm[n] = record;
      if (c && !indices.byCompact[c]) indices.byCompact[c] = record;
    });
  }

  function buildIndices() {
    if (indexCache) return indexCache;
    const payload = loadPayload();
    const indices = { byNorm:Object.create(null), byCompact:Object.create(null), records:[] };
    (payload.records || []).forEach(record => {
      indices.records.push(record);
      indexRecord(indices, record);
    });
    (payload.sourceRecords || []).forEach(raw => {
      const record = expandSourceRecord(raw);
      if (!record) return;
      indices.records.push(record);
      indexRecord(indices, record);
    });
    indexCache = indices;
    return indices;
  }

  function speciesKeys(species) {
    if (typeof species === 'string') return [species];
    if (!species || typeof species !== 'object') return [];
    return [
      species.scientificName,
      species.scientific,
      species.commonName,
      species.name,
      species.species,
      species.id
    ].concat(species.aliases || []);
  }

  function getDietRecord(species) {
    const indices = buildIndices();
    for (const key of speciesKeys(species)) {
      const byNorm = indices.byNorm[norm(key)];
      if (byNorm) return byNorm;
      const byCompact = indices.byCompact[compact(key)];
      if (byCompact) return byCompact;
    }
    return null;
  }

  function canonicalFamily(family) {
    return FOOD_FAMILIES[family] ? family : (LEGACY_FAMILY[family] || family);
  }

  function ingredientById(id) {
    return INGREDIENTS[id] || null;
  }

  function pantryBridgeForKey(key) {
    const bridge = PANTRY_BRIDGE[String(key || '')];
    return bridge ? { ...bridge } : null;
  }

  function pantryKeyForIngredientId(ingredientId) {
    const row = Object.values(PANTRY_BRIDGE).find(bridge => bridge.ingredientId === ingredientId);
    return row ? row.pantryKey : null;
  }

  function familySet(record, field) {
    return new Set((record && Array.isArray(record[field]) ? record[field] : []).map(canonicalFamily));
  }

  function expectedPrep(record, family) {
    const prepMap = (record && record.prepByFamily) || {};
    return prepMap[family] || (FOOD_FAMILIES[family] && FOOD_FAMILIES[family].defaultPrep) || null;
  }

  function fallbackRecord(species) {
    const name = typeof species === 'string'
      ? species
      : ((species && (species.commonName || species.name || species.species || species.scientificName)) || 'Unknown bird');
    return {
      id: 'unmatched-runtime',
      name,
      commonName: name,
      scientificName: '',
      matchMethod: 'unmatched',
      certainty: 'U',
      primaryCompatibleFamilies: [],
      secondaryCompatibleFamilies: ['invertebrates', 'seeds', 'fruit_berries'],
      prepByFamily: { invertebrates:'fresh', seeds:'husked', fruit_berries:'fresh' },
      education: 'Conservative unmatched fallback: no species-level diet claim is made.'
    };
  }

  function scoreFoodCompatibility(species, ingredientSpec, prepArg) {
    const ingredientId = typeof ingredientSpec === 'string'
      ? ingredientSpec
      : ingredientSpec && (ingredientSpec.ingredientId || ingredientSpec.id);
    const prep = prepArg || (ingredientSpec && ingredientSpec.prep) || 'fresh';
    const ingredient = ingredientById(ingredientId);
    const record = getDietRecord(species) || fallbackRecord(species);
    if (!ingredient) {
      return {
        verdict:'refused',
        nourishment:0,
        compatible:false,
        ingredientId,
        family:null,
        prep,
        record
      };
    }

    const family = canonicalFamily(ingredient.family);
    const primary = familySet(record, 'primaryCompatibleFamilies');
    const secondary = familySet(record, 'secondaryCompatibleFamilies');
    const wantedPrep = expectedPrep(record, family);
    const compatible = primary.has(family) || secondary.has(family);
    if (!compatible) {
      return {
        verdict:'refused',
        nourishment:0,
        compatible:false,
        ingredientId: ingredient.id,
        family,
        prep,
        expectedPrep: wantedPrep,
        record,
        reason:'family-not-compatible'
      };
    }
    if (wantedPrep && prep !== wantedPrep) {
      return {
        verdict:'wrong_prep',
        nourishment:Math.max(4, Math.round((ingredient.nourishment || 20) * 0.25)),
        compatible:true,
        ingredientId: ingredient.id,
        family,
        prep,
        expectedPrep: wantedPrep,
        record,
        reason:'wrong-preparation'
      };
    }
    if (primary.has(family)) {
      return {
        verdict:'primary',
        nourishment:ingredient.nourishment || 32,
        compatible:true,
        ingredientId: ingredient.id,
        family,
        prep,
        expectedPrep: wantedPrep,
        record
      };
    }
    return {
      verdict: record.matchMethod === 'unmatched' ? 'insufficient' : 'secondary',
      nourishment:Math.max(8, Math.round((ingredient.nourishment || 20) * 0.55)),
      compatible:true,
      ingredientId: ingredient.id,
      family,
      prep,
      expectedPrep: wantedPrep,
      record
    };
  }

  function createKitchenDietRule(species) {
    const record = getDietRecord(species);
    if (!record) return null;
    const pref = unique(record.primaryCompatibleFamilies || []);
    const ok = unique(record.secondaryCompatibleFamilies || []);
    const avoid = Object.keys(FOOD_FAMILIES).filter(family => !pref.includes(family) && !ok.includes(family));
    const fact = record.education || ('Source-backed BirdFuncDat diet: primary ' + (pref.join(', ') || 'none') + '; secondary ' + (ok.join(', ') || 'none') + '.');
    return { pref, ok, avoid, prep:{ ...((record && record.prepByFamily) || {}) }, fact, record };
  }

  function dietFamilyLabel(family) {
    const id = canonicalFamily(family);
    return (FOOD_FAMILIES[id] && FOOD_FAMILIES[id].label) || String(id || '').replace(/_/g, ' ');
  }

  function dietFamilyLabels(families) {
    return unique(families || []).map(dietFamilyLabel);
  }

  function dietMatchLabel(record) {
    const method = String(record && record.matchMethod || 'unmatched');
    if (method === 'override') return 'BirdFuncDat Merlin override';
    if (method === 'exact' || method === 'source-row') return 'BirdFuncDat exact match';
    if (method === 'scientific-alias') return 'BirdFuncDat scientific-alias match';
    if (method === 'common-name') return 'BirdFuncDat common-name match';
    if (method === 'family-fallback') return 'BirdFuncDat family fallback';
    if (method === 'unmatched') return 'Conservative unmatched fallback';
    return 'BirdFuncDat ' + method.replace(/-/g, ' ');
  }

  function dietFallbackType(record) {
    const method = String(record && record.matchMethod || 'unmatched');
    if (method === 'family-fallback') return 'family-fallback';
    if (method === 'unmatched') return 'unmatched-conservative';
    if (method === 'override') return 'merlin-override';
    if (method === 'common-name') return 'common-name-match';
    if (method === 'scientific-alias') return 'scientific-alias-match';
    return 'exact-match';
  }

  function dietDisclosureForSpecies(species) {
    const record = getDietRecord(species) || fallbackRecord(species);
    const primaryFamilies = unique(record.primaryCompatibleFamilies || []);
    const secondaryFamilies = unique(record.secondaryCompatibleFamilies || []);
    const compatibleFamilies = primaryFamilies.concat(secondaryFamilies.filter(family => !primaryFamilies.includes(family)));
    const method = String(record.matchMethod || 'unmatched');
    const certainty = record.certainty || 'U';
    const provenance = dietMatchLabel(record) + ' · certainty ' + certainty;
    let education = record.education || '';
    if (method === 'family-fallback') {
      education = education || ('Family-level fallback for ' + (record.family || 'this family') + '; no species-level prey claim is made.');
    } else if (method === 'unmatched') {
      education = education || 'Conservative unmatched fallback: no species-level diet claim is made.';
    } else if (method === 'override' && compact(record.scientificName) === compact('Falco columbarius')) {
      education = education || 'Merlin is Falco columbarius, a small falcon whose main food is small-bird prey; insects are secondary.';
    } else {
      education = education || ('Source-backed BirdFuncDat diet: primary ' + (primaryFamilies.join(', ') || 'none') + '; secondary ' + (secondaryFamilies.join(', ') || 'none') + '.');
    }
    return {
      name: record.name || record.commonName || (typeof species === 'string' ? species : ''),
      commonName: record.commonName || record.name || '',
      scientificName: record.scientificName || record.scientific || '',
      matchMethod: method,
      fallbackType: dietFallbackType(record),
      certainty,
      provenance,
      primaryFamilies,
      secondaryFamilies,
      compatibleFamilies,
      primaryLabels: dietFamilyLabels(primaryFamilies),
      secondaryLabels: dietFamilyLabels(secondaryFamilies),
      compatibleLabels: dietFamilyLabels(compatibleFamilies),
      education,
      sourceRowsUsed: Number(record.sourceRowsUsed || (record.sourceRow ? 1 : 0)) || 0,
      sourceScientificName: record.sourceScientificName || (record.sourceRow && record.sourceRow.scientificName) || null,
      sourceCommonName: record.sourceCommonName || (record.sourceRow && record.sourceRow.commonName) || null,
      noSpeciesClaim: method === 'family-fallback' || method === 'unmatched'
    };
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state || {}));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, Number(value) || 0));
  }

  function normalizeTransactionIds(source) {
    const seen = new Set();
    const out = [];
    const rows = []
      .concat(Array.isArray(source && source.hungerTransactions) ? source.hungerTransactions : [])
      .concat(Array.isArray(source && source.hungerTransactionLog) ? source.hungerTransactionLog : [])
      .concat(Array.isArray(source && source.hungerHistory) ? source.hungerHistory : []);
    rows.forEach(row => {
      const id = typeof row === 'string' ? row : (row && row.id);
      const clean = String(id || '').trim();
      if (clean && !seen.has(clean)) { seen.add(clean); out.push(clean); }
    });
    return out;
  }

  function normalizeTransactionLog(source, ids, now) {
    const seen = new Set();
    const out = [];
    const pushLog = row => {
      if (!row) return;
      const id = String(row.id || '').trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      out.push({
        id,
        type: String(row.type || row.activityType || 'legacy'),
        activityId: row.activityId == null ? null : String(row.activityId),
        delta: Number.isFinite(Number(row.delta)) ? Number(row.delta) : 0,
        before: Number.isFinite(Number(row.before)) ? Number(row.before) : null,
        after: Number.isFinite(Number(row.after)) ? Number(row.after) : null,
        at: Number(row.at) || Number(source && source.lastHungerAt) || Number(now) || Date.now()
      });
    };
    (Array.isArray(source && source.hungerTransactionLog) ? source.hungerTransactionLog : []).forEach(pushLog);
    (Array.isArray(source && source.hungerHistory) ? source.hungerHistory : []).forEach(pushLog);
    (Array.isArray(source && source.hungerTransactions) ? source.hungerTransactions : []).forEach(row => {
      if (typeof row === 'object') pushLog(row);
    });
    (ids || []).forEach(id => {
      if (!seen.has(id)) pushLog({ id, type:'legacy', at:Number(source && source.lastHungerAt) || Number(now) || Date.now() });
    });
    return out.slice(-HUNGER_HISTORY_LIMIT);
  }

  function sanitizeCare(raw, now) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const ids = normalizeTransactionIds(source);
    return {
      ...source,
      hunger: clamp(source.hunger === undefined ? 20 : source.hunger, 0, 100),
      happiness: clamp(source.happiness === undefined ? 80 : source.happiness, 0, 100),
      lastHungerAt: Number(source.lastHungerAt) || Number(now) || Date.now(),
      hungerTransactions: ids,
      hungerTransactionLog: normalizeTransactionLog(source, ids, now)
    };
  }

  function hungerStatusForCare(rawCare, now) {
    const care = sanitizeCare(rawCare, now);
    const hunger = clamp(care.hunger, 0, 100);
    let level = 'fed';
    let label = 'Fed';
    if (hunger >= HUNGER_THRESHOLDS.urgentMin) { level = 'urgent'; label = 'Urgent care'; }
    else if (hunger >= HUNGER_THRESHOLDS.hungryMin) { level = 'hungry'; label = 'Hungry'; }
    else if (hunger >= HUNGER_THRESHOLDS.peckishMin) { level = 'peckish'; label = 'Peckish'; }
    return {
      hunger,
      level,
      label,
      warnsWork: hunger >= HUNGER_THRESHOLDS.hungryMin,
      blocksWork: hunger >= HUNGER_THRESHOLDS.urgentMin,
      message: hunger >= HUNGER_THRESHOLDS.urgentMin
        ? 'Urgent care: feed this bird before demanding work.'
        : hunger >= HUNGER_THRESHOLDS.hungryMin
          ? 'Hungry: this bird can help, but feed them soon.'
          : hunger >= HUNGER_THRESHOLDS.peckishMin
            ? 'Peckish: a meal would help before longer work.'
            : 'Fed and ready.'
    };
  }

  function activityReadiness(bird, activityType, now) {
    const status = hungerStatusForCare(bird && bird.care, now);
    const name = (bird && (bird.customName || bird.commonName || bird.species || bird.name)) || 'This bird';
    const activity = String(activityType || 'work').replace(/_/g, ' ');
    return {
      ok: !status.blocksWork,
      warning: status.warnsWork,
      status,
      message: status.blocksWork
        ? name + ' needs food before ' + activity + '.'
        : status.warnsWork
          ? name + ' is hungry before ' + activity + '.'
          : status.message
    };
  }

  function transactionIdFor(opts) {
    const options = opts || {};
    if (options.transactionId) return String(options.transactionId);
    if (options.activityType || options.activityId) return [options.activityType || 'activity', options.activityId || 'unknown'].join(':');
    return '';
  }

  function careHasTransaction(rawCare, txId, now) {
    if (!txId) return false;
    return sanitizeCare(rawCare, now).hungerTransactions.includes(String(txId));
  }

  function applyHungerDeltaToCare(rawCare, opts) {
    const options = opts || {};
    const now = Number(options.now) || Date.now();
    const txId = transactionIdFor(options);
    const care = sanitizeCare(rawCare, now);
    if (txId && care.hungerTransactions.includes(txId)) {
      return { ok:true, duplicate:true, care, transactionId:txId, before:care.hunger, after:care.hunger };
    }
    const before = care.hunger;
    const delta = Number(options.delta) || 0;
    const after = clamp(before + delta, 0, 100);
    care.hunger = after;
    care.lastHungerAt = now;
    if (txId) {
      care.hungerTransactions.push(txId);
      care.hungerTransactionLog.push({
        id: txId,
        type: String(options.activityType || options.type || 'hunger'),
        activityId: options.activityId == null ? null : String(options.activityId),
        delta,
        before,
        after,
        at: now
      });
      care.hungerTransactionLog = care.hungerTransactionLog.slice(-HUNGER_HISTORY_LIMIT);
    }
    return { ok:true, duplicate:false, care, transactionId:txId, before, after };
  }

  function migrateHungerState(rawState, now) {
    const state = cloneState(rawState);
    state.flock = Array.isArray(state.flock) ? state.flock.map(bird => ({
      ...bird,
      care: sanitizeCare(bird && bird.care, now)
    })) : [];
    state.merlinCare = sanitizeCare(state.merlinCare, now);
    state.birdCare = sanitizeCare(state.birdCare, now);
    if (!state.inventory || typeof state.inventory !== 'object') state.inventory = {};
    if (!state.inventory.larder || typeof state.inventory.larder !== 'object') state.inventory.larder = {};
    if (!state.pantry || typeof state.pantry !== 'object') state.pantry = {};
    return state;
  }

  function findBird(state, target) {
    const flock = Array.isArray(state.flock) ? state.flock : [];
    if (target && target.birdId) return flock.find(bird => bird.id === target.birdId) || null;
    const wanted = speciesKeys(target).map(compact).filter(Boolean);
    return flock.find(bird => speciesKeys(bird).map(compact).some(key => wanted.includes(key))) || null;
  }

  function inventoryCount(state, ingredientId) {
    return Math.max(0, Math.floor(Number(state.inventory && state.inventory.larder && state.inventory.larder[ingredientId]) || 0));
  }

  function pantryCount(state, pantryKey) {
    return Math.max(0, Math.floor(Number(state.pantry && state.pantry[pantryKey]) || 0));
  }

  function normalizeFeedingSpec(ingredientSpec) {
    const rawId = typeof ingredientSpec === 'string'
      ? ingredientSpec
      : ingredientSpec && (ingredientSpec.ingredientId || ingredientSpec.id);
    const explicitPantryKey = ingredientSpec && ingredientSpec.pantryKey;
    const source = ingredientSpec && (ingredientSpec.inventoryPath || ingredientSpec.source || ingredientSpec.store);
    if (explicitPantryKey || source === 'pantry') {
      const pantryKey = explicitPantryKey || rawId;
      const bridge = pantryBridgeForKey(pantryKey);
      if (bridge) {
        return {
          ingredientId: bridge.ingredientId,
          prep: (ingredientSpec && ingredientSpec.prep) || bridge.prep,
          pantryKey: bridge.pantryKey,
          inventoryPath: 'pantry',
          bridge
        };
      }
    }
    const pantryBridge = pantryBridgeForKey(rawId);
    if (!ingredientById(rawId) && pantryBridge) {
      return {
        ingredientId: pantryBridge.ingredientId,
        prep: (ingredientSpec && ingredientSpec.prep) || pantryBridge.prep,
        pantryKey: pantryBridge.pantryKey,
        inventoryPath: 'pantry',
        bridge: pantryBridge
      };
    }
    return {
      ingredientId: rawId,
      prep: (ingredientSpec && ingredientSpec.prep) || (ingredientById(rawId) && ingredientById(rawId).preps[0]) || 'fresh',
      pantryKey: ingredientSpec && ingredientSpec.pantryKey || null,
      inventoryPath: 'larder',
      bridge: pantryKeyForIngredientId(rawId) ? pantryBridgeForKey(pantryKeyForIngredientId(rawId)) : null
    };
  }

  function inventoryCountForFeedingSpec(state, spec) {
    const normalized = normalizeFeedingSpec(spec);
    if (normalized.inventoryPath === 'pantry') return pantryCount(state, normalized.pantryKey);
    return inventoryCount(state, normalized.ingredientId);
  }

  function consumeInventory(state, ingredientId) {
    if (!state.inventory || typeof state.inventory !== 'object') state.inventory = {};
    if (!state.inventory.larder || typeof state.inventory.larder !== 'object') state.inventory.larder = {};
    state.inventory.larder[ingredientId] = inventoryCount(state, ingredientId) - 1;
    return { ['inventory.larder.' + ingredientId]: 1 };
  }

  function consumeFeedingInventory(state, spec) {
    const normalized = normalizeFeedingSpec(spec);
    if (normalized.inventoryPath === 'pantry') {
      if (!state.pantry || typeof state.pantry !== 'object') state.pantry = {};
      state.pantry[normalized.pantryKey] = pantryCount(state, normalized.pantryKey) - 1;
      return { ['pantry.' + normalized.pantryKey]: 1 };
    }
    return consumeInventory(state, normalized.ingredientId);
  }

  function inventorySnapshot(state) {
    return {
      pantry: { ...((state && state.pantry) || {}) },
      larder: { ...((state && state.inventory && state.inventory.larder) || {}) }
    };
  }

  function applyFeedingTransaction(rawState, target, ingredientSpec, opts) {
    const options = opts || {};
    const txId = String(options.transactionId || '');
    const state = migrateHungerState(rawState, options.now);
    const normalizedSpec = normalizeFeedingSpec(ingredientSpec);
    const ingredientId = normalizedSpec.ingredientId;
    const compatibility = scoreFoodCompatibility(target, normalizedSpec);
    const isMerlin = target && (target.target === 'merlin' || compact(target.scientificName) === compact('Falco columbarius'));
    const subject = isMerlin ? { care: state.merlinCare } : findBird(state, target);
    if (!subject) {
      return { ok:false, state, consumed:{}, compatibility, transactionId:txId, inventoryPath:normalizedSpec.inventoryPath, message:'No matching bird for feeding transaction.' };
    }
    subject.care = sanitizeCare(subject.care, options.now);
    if (careHasTransaction(subject.care, txId, options.now)) {
      return { ok:true, duplicate:true, state, consumed:{}, compatibility, transactionId:txId, inventoryPath:normalizedSpec.inventoryPath, before:subject.care.hunger, after:subject.care.hunger, message:'Feeding transaction already applied.' };
    }
    if (subject.care.hunger <= 0) {
      return { ok:false, state, consumed:{}, compatibility, transactionId:txId, inventoryPath:normalizedSpec.inventoryPath, before:0, after:0, message:((target && (target.commonName || target.name)) || subject.commonName || subject.species || 'That bird') + ' is already fully fed; no food was spent.' };
    }
    const acceptedVerdict = compatibility.verdict === 'primary' || compatibility.verdict === 'insufficient';
    if (!acceptedVerdict) {
      return {
        ok:false,
        state,
        consumed:{},
        compatibility,
        transactionId:txId,
        inventoryPath:normalizedSpec.inventoryPath,
        before:subject.care.hunger,
        after:subject.care.hunger,
        message: compatibility.verdict === 'secondary'
          ? ((normalizedSpec.label || ingredientId) + ' is only a secondary food; choose a primary meal for ' + ((target && (target.commonName || target.name)) || subject.commonName || subject.species || 'that bird') + '.')
          : compatibility.reason
      };
    }
    if (inventoryCountForFeedingSpec(state, normalizedSpec) < 1) {
      return { ok:false, state, consumed:{}, compatibility, transactionId:txId, inventoryPath:normalizedSpec.inventoryPath, before:subject.care.hunger, after:subject.care.hunger, message:normalizedSpec.inventoryPath === 'pantry' ? 'Food is not available in the pantry.' : 'Ingredient is not available in the larder.' };
    }
    const consumed = consumeFeedingInventory(state, normalizedSpec);
    const applied = applyHungerDeltaToCare(subject.care, {
      transactionId: txId,
      activityType: 'feeding',
      activityId: ingredientId,
      delta: -compatibility.nourishment,
      now: options.now
    });
    subject.care = applied.care;
    subject.care.happiness = clamp(subject.care.happiness + 6, 0, 100);
    subject.care.lastFedAt = Number(options.now) || Date.now();
    subject.care.lastHungerAt = Number(options.now) || Date.now();
    if (isMerlin) state.merlinCare = subject.care;
    const feedMessage = compatibility.verdict === 'insufficient'
      ? 'Fed a conservative care ration; the exact wild diet is not claimed for this fallback record.'
      : 'Fed a source-backed primary meal.';
    return { ok:true, duplicate:false, state, consumed, compatibility, transactionId:txId, inventoryPath:normalizedSpec.inventoryPath, before:applied.before, after:applied.after, message:feedMessage };
  }

  function applyActivityHungerTransaction(rawState, opts) {
    const options = opts || {};
    const txId = transactionIdFor(options);
    const state = migrateHungerState(rawState, options.now);
    const bird = findBird(state, { birdId:options.birdId });
    if (!bird) return { ok:false, state, transactionId:txId };
    const applied = applyHungerDeltaToCare(bird.care, {
      transactionId: txId,
      activityType: options.activityType || 'activity',
      activityId: options.activityId || 'unknown',
      delta: Math.max(0, Number(options.delta) || 0),
      now: options.now
    });
    bird.care = applied.care;
    return { ok:true, duplicate:applied.duplicate, state, transactionId:txId, before:applied.before, after:applied.after };
  }

  function isBirdReservedForActivity(state, birdId) {
    const active = value => value && value.birdId === birdId && !['claimed', 'cancelled', 'failed'].includes(String(value.status || '').toLowerCase());
    return (Array.isArray(state && state.birdExpeditions) && state.birdExpeditions.some(active))
      || (Array.isArray(state && state.birdTrainingSessions) && state.birdTrainingSessions.some(active));
  }

  function metadata() {
    return loadPayload().metadata || {};
  }

  return {
    FOOD_FAMILIES,
    HUNGER_THRESHOLDS,
    ACTIVITY_HUNGER_DELTAS,
    PREPS,
    INGREDIENTS,
    PANTRY_BRIDGE,
    metadata,
    loadPayload,
    getDietRecord,
    ingredientById,
    pantryBridgeForKey,
    pantryKeyForIngredientId,
    normalizeFeedingSpec,
    inventoryCountForFeedingSpec,
    inventorySnapshot,
    scoreFoodCompatibility,
    createKitchenDietRule,
    dietDisclosureForSpecies,
    dietFamilyLabel,
    sanitizeCare,
    hungerStatusForCare,
    activityReadiness,
    applyHungerDeltaToCare,
    migrateHungerState,
    applyFeedingTransaction,
    applyActivityHungerTransaction,
    isBirdReservedForActivity
  };
});
