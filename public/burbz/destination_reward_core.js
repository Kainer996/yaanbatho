/* Destination reward core: deterministic preview/banked quote math only.
 * Actual payment stays with the canonical economy transaction owner.
 */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDestinationRewardCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const CONSTANTS = Object.freeze({
    VERSION: 1,
    NEUTRAL_ELEVATION_MULTIPLIER: 1,
    MIN_XP: 25,
    MAX_XP: 950,
    MIN_COINS: 5,
    MAX_COINS: 180,
    BASE_XP: 30,
    XP_PER_KM: 42,
    XP_PER_ASCENT_M: 0.28,
    BASE_COINS: 8,
    COINS_PER_KM: 8,
    COINS_PER_ASCENT_M: 0.045,
    EXISTING_LOOT_IDS: Object.freeze([
      'field_vole',
      'wood_mouse',
      'mealworm_scoop',
      'garden_worms',
      'sunflower_seeds',
      'common_shrew',
      'xp_scroll_minor'
    ])
  });
  const DIFFICULTY = Object.freeze({
    easy: 0.9,
    moderate: 1,
    hard: 1.18,
    strenuous: 1.35
  });

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }
  function normalDifficulty(input) {
    const raw = String(input && input.difficulty || input || 'moderate').toLowerCase();
    return Object.prototype.hasOwnProperty.call(DIFFICULTY, raw) ? raw : 'moderate';
  }
  function elevationState(elevation) {
    if (elevation && elevation.available === true) {
      const ascentM = Math.max(0, Number(elevation.ascentM) || 0);
      return {
        status: 'measured',
        ascentM: Math.round(ascentM),
        descentM: Math.max(0, Math.round(Number(elevation.descentM) || 0)),
        multiplier: Math.round((1 + Math.min(0.35, ascentM / 1800)) * 1000) / 1000,
        reason: null,
        provenance: elevation.provenance || null
      };
    }
    return {
      status: 'unavailable',
      ascentM: 0,
      descentM: 0,
      multiplier: CONSTANTS.NEUTRAL_ELEVATION_MULTIPLIER,
      reason: elevation && elevation.reason || 'Elevation unavailable',
      provenance: elevation && elevation.provenance || null
    };
  }
  function lootFor(distanceKm, elevation, difficulty) {
    const loot = [];
    loot.push({ id: distanceKm >= 2 ? 'field_vole' : 'garden_worms', qty: distanceKm >= 2 ? 2 : 1 });
    if (distanceKm >= 4) loot.push({ id: 'wood_mouse', qty: 1 });
    if (elevation.ascentM >= 150 || difficulty === 'hard' || difficulty === 'strenuous') loot.push({ id: 'mealworm_scoop', qty: 1 });
    if (distanceKm >= 6 || difficulty === 'strenuous') loot.push({ id: 'xp_scroll_minor', qty: 1 });
    return loot;
  }

  function quoteDestinationReward(routeMetrics, elevation, opts) {
    routeMetrics = routeMetrics || {};
    const distanceM = Math.max(0, Number(routeMetrics.distanceM || routeMetrics.lengthM) || 0);
    const distanceKm = distanceM / 1000;
    const diff = normalDifficulty(opts);
    const diffMult = DIFFICULTY[diff];
    const elev = elevationState(elevation);
    const xpRaw = (CONSTANTS.BASE_XP + distanceKm * CONSTANTS.XP_PER_KM + elev.ascentM * CONSTANTS.XP_PER_ASCENT_M) * diffMult * elev.multiplier;
    const coinRaw = (CONSTANTS.BASE_COINS + distanceKm * CONSTANTS.COINS_PER_KM + elev.ascentM * CONSTANTS.COINS_PER_ASCENT_M) * Math.min(1.2, diffMult);
    const xp = Math.round(clamp(xpRaw, CONSTANTS.MIN_XP, CONSTANTS.MAX_XP));
    const coins = Math.round(clamp(coinRaw, CONSTANTS.MIN_COINS, CONSTANTS.MAX_COINS));
    const quote = {
      version: CONSTANTS.VERSION,
      currency: 'coins',
      xp,
      coins,
      loot: lootFor(distanceKm, elev, diff),
      difficulty: {
        label: diff,
        multiplier: diffMult,
        distanceKm: Math.round(distanceKm * 1000) / 1000
      },
      elevation: elev,
      formula: {
        xp: 'round(clamp((BASE_XP + km*XP_PER_KM + ascentM*XP_PER_ASCENT_M) * difficulty * elevationMultiplier, MIN_XP, MAX_XP))',
        coins: 'round(clamp((BASE_COINS + km*COINS_PER_KM + ascentM*COINS_PER_ASCENT_M) * min(1.2,difficulty), MIN_COINS, MAX_COINS))'
      }
    };
    return deserializeQuote(JSON.stringify(quote));
  }

  function sanitizeLoot(list) {
    const out = [];
    for (const raw of Array.isArray(list) ? list : []) {
      const id = String(raw && raw.id || '');
      const qty = Math.max(1, Math.min(9, Math.floor(Number(raw && raw.qty) || 1)));
      if (CONSTANTS.EXISTING_LOOT_IDS.includes(id)) out.push({ id, qty });
    }
    return out;
  }
  function deserializeQuote(value) {
    const raw = typeof value === 'string' ? JSON.parse(value) : value;
    const diff = normalDifficulty(raw && raw.difficulty && raw.difficulty.label);
    const elev = raw && raw.elevation && raw.elevation.status === 'measured'
      ? {
          status: 'measured',
          ascentM: Math.max(0, Math.round(Number(raw.elevation.ascentM) || 0)),
          descentM: Math.max(0, Math.round(Number(raw.elevation.descentM) || 0)),
          multiplier: Number(raw.elevation.multiplier) || CONSTANTS.NEUTRAL_ELEVATION_MULTIPLIER,
          reason: null,
          provenance: raw.elevation.provenance || null
        }
      : {
          status: 'unavailable',
          ascentM: 0,
          descentM: 0,
          multiplier: CONSTANTS.NEUTRAL_ELEVATION_MULTIPLIER,
          reason: raw && raw.elevation && raw.elevation.reason || 'Elevation unavailable',
          provenance: raw && raw.elevation && raw.elevation.provenance || null
        };
    return {
      version: CONSTANTS.VERSION,
      currency: 'coins',
      xp: Math.round(clamp(Number(raw && raw.xp) || CONSTANTS.MIN_XP, CONSTANTS.MIN_XP, CONSTANTS.MAX_XP)),
      coins: Math.round(clamp(Number(raw && raw.coins) || CONSTANTS.MIN_COINS, CONSTANTS.MIN_COINS, CONSTANTS.MAX_COINS)),
      loot: sanitizeLoot(raw && raw.loot),
      difficulty: {
        label: diff,
        multiplier: DIFFICULTY[diff],
        distanceKm: Math.max(0, Number(raw && raw.difficulty && raw.difficulty.distanceKm) || 0)
      },
      elevation: elev,
      formula: raw && raw.formula || {
        xp: 'round(clamp((BASE_XP + km*XP_PER_KM + ascentM*XP_PER_ASCENT_M) * difficulty * elevationMultiplier, MIN_XP, MAX_XP))',
        coins: 'round(clamp((BASE_COINS + km*COINS_PER_KM + ascentM*COINS_PER_ASCENT_M) * min(1.2,difficulty), MIN_COINS, MAX_COINS))'
      }
    };
  }

  return {
    VERSION: CONSTANTS.VERSION,
    CONSTANTS: Object.assign({}, CONSTANTS, { EXISTING_LOOT_IDS: CONSTANTS.EXISTING_LOOT_IDS.slice() }),
    DIFFICULTY: Object.assign({}, DIFFICULTY),
    quoteDestinationReward,
    deserializeQuote
  };
});
