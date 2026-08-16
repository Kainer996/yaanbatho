/* Burbz Town Strategy Core
 *
 * Pure, deterministic rules for the Town Hall progression and the one-policy
 * town economy. The browser owns persistence and UI; this module only heals
 * input state and performs maths, so the same rules can be exercised in Node.
 *
 * Balance invariants:
 * - town income aggregates existing district income; it never adds a second
 *   passive payout;
 * - every productive policy gives something else up;
 * - material and larder quantities are scaled once, after aggregation;
 * - policy changes are prospective and locked for 24 hours.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzTownStrategyCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const MINUTE_MS = 60 * 1000;
  const HOUR_MS = 60 * MINUTE_MS;
  const TOWN_POLICY_LOCK_MS = 24 * HOUR_MS;
  const FUTURE_CLOCK_TOLERANCE_MS = 5 * MINUTE_MS;
  const CUSTOM_NAME_MAX_LENGTH = 48;

  function freezeCost(coins, branches, stone, materials) {
    return Object.freeze({
      coins,
      branches,
      stone,
      materials: Object.freeze({ ...(materials || {}) })
    });
  }

  function freezeHallLevel(level) {
    return Object.freeze({ ...level, cost: level.cost });
  }

  // Gates deliberately stop short of the town maximum. Rare materials keep
  // expeditions and the Fletcher's Forge relevant throughout the Town game.
  const TOWN_HALL_LEVELS = Object.freeze([
    freezeHallLevel({
      level: 1,
      label: 'Town Hall',
      minDevelopment: 0,
      minPopulation: 0,
      minHappiness: 0,
      cost: freezeCost(0, 0, 0, {}),
      buildMinutes: 0,
      buildTimeMs: 0,
      builderSlots: 1,
      unlock: 'A united town and one builder queue.'
    }),
    freezeHallLevel({
      level: 2,
      label: 'Market Town',
      minDevelopment: 9,
      minPopulation: 18,
      minHappiness: 0.60,
      cost: freezeCost(180, 45, 20, { oak_twig: 4, river_reed: 4 }),
      buildMinutes: 30,
      buildTimeMs: 30 * MINUTE_MS,
      builderSlots: 1,
      unlock: 'Town policies.'
    }),
    freezeHallLevel({
      level: 3,
      label: 'Guild Town',
      minDevelopment: 21,
      minPopulation: 36,
      minHappiness: 0.70,
      cost: freezeCost(360, 90, 60, { iron_grit: 6, storm_glass: 4 }),
      buildMinutes: 120,
      buildTimeMs: 2 * HOUR_MS,
      builderSlots: 2,
      unlock: 'A second builder queue.'
    }),
    freezeHallLevel({
      level: 4,
      label: 'Great Town',
      minDevelopment: 39,
      minPopulation: 66,
      minHappiness: 0.80,
      cost: freezeCost(720, 160, 120, { sun_amber: 6, gold_thread: 6 }),
      buildMinutes: 360,
      buildTimeMs: 6 * HOUR_MS,
      builderSlots: 2,
      unlock: 'Great-town prestige.'
    }),
    freezeHallLevel({
      level: 5,
      label: 'Royal Borough',
      minDevelopment: 57,
      minPopulation: 90,
      minHappiness: 0.85,
      cost: freezeCost(1400, 280, 240, { ancient_rune: 4, phoenix_ember: 2 }),
      buildMinutes: 720,
      buildTimeMs: 12 * HOUR_MS,
      builderSlots: 3,
      unlock: 'A third builder queue.'
    })
  ]);

  function freezePolicy(policy) { return Object.freeze({ ...policy }); }

  const TOWN_POLICIES = Object.freeze({
    balanced: freezePolicy({
      id: 'balanced', label: 'Balanced',
      coins: 1, branches: 1, stone: 1, materials: 1, larder: 1,
      growthPerMember: 0, buildTimeFactor: 1
    }),
    growth: freezePolicy({
      id: 'growth', label: 'Growth',
      coins: 0.80, branches: 0.90, stone: 0.90, materials: 0.90, larder: 1.15,
      growthPerMember: 1, buildTimeFactor: 1
    }),
    trade: freezePolicy({
      id: 'trade', label: 'Trade',
      coins: 1.20, branches: 0.75, stone: 0.85, materials: 0.85, larder: 0.85,
      growthPerMember: 0, buildTimeFactor: 1
    }),
    industry: freezePolicy({
      id: 'industry', label: 'Industry',
      coins: 0.80, branches: 1.25, stone: 1.20, materials: 1.20, larder: 0.80,
      growthPerMember: 0, buildTimeFactor: 1
    }),
    builders: freezePolicy({
      id: 'builders', label: 'Builders',
      coins: 0.90, branches: 0.90, stone: 0.90, materials: 0.90, larder: 0.90,
      growthPerMember: 0, buildTimeFactor: 0.80
    })
  });

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function sanitizedNow(now) {
    return Math.max(0, finiteNumber(now, Date.now()));
  }

  function canonicalPolicyId(id) {
    const key = String(id == null ? '' : id).trim().toLowerCase();
    if (Object.prototype.hasOwnProperty.call(TOWN_POLICIES, key)) return key;
    const byLabel = Object.values(TOWN_POLICIES).find(policy => policy.label.toLowerCase() === key);
    return byLabel ? byLabel.id : null;
  }

  function sanitizedMemberSeeds(seeds) {
    const unique = new Set();
    (Array.isArray(seeds) ? seeds : []).forEach(value => {
      const number = Number(value);
      if (!Number.isFinite(number) || number < 0) return;
      unique.add(number >>> 0);
    });
    return Array.from(unique).sort((a, b) => a - b);
  }

  function sanitizedMaterialMap(raw) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(id => {
      if (!id || id === '__proto__' || id === 'prototype' || id === 'constructor') return;
      const quantity = Math.max(0, Math.floor(finiteNumber(raw[id], 0)));
      if (quantity > 0) out[id] = quantity;
    });
    return out;
  }

  function sanitizedCost(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    return {
      coins: Math.max(0, Math.floor(finiteNumber(raw.coins, 0))),
      branches: Math.max(0, Math.floor(finiteNumber(raw.branches, 0))),
      stone: Math.max(0, Math.floor(finiteNumber(raw.stone, 0))),
      materials: sanitizedMaterialMap(raw.materials)
    };
  }

  function sanitizeHallConstruction(raw, hallLevel) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const toLevel = Math.floor(finiteNumber(raw.toLevel, 0));
    const startMs = finiteNumber(raw.startMs, NaN);
    const endMs = finiteNumber(raw.endMs, NaN);
    if (toLevel !== hallLevel + 1 || toLevel > TOWN_HALL_LEVELS.length ||
        !Number.isFinite(startMs) || !Number.isFinite(endMs) ||
        startMs < 0 || endMs <= startMs) return null;
    const out = { toLevel, startMs, endMs };
    const fromLevel = Math.floor(finiteNumber(raw.fromLevel, 0));
    if (fromLevel === hallLevel) out.fromLevel = fromLevel;
    if (typeof raw.id === 'string' && raw.id.trim()) out.id = raw.id.trim().slice(0, 96);
    const paidCost = sanitizedCost(raw.paidCost || raw.cost);
    if (paidCost) out.paidCost = paidCost;
    return out;
  }

  function sanitizeTownState(raw, now) {
    const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const currentTime = sanitizedNow(now);
    const hallLevel = clamp(Math.floor(finiteNumber(source.hallLevel, 1)), 1, TOWN_HALL_LEVELS.length);
    let policy = canonicalPolicyId(source.policy) || 'balanced';
    if (hallLevel < 2) policy = 'balanced';
    let policyChangedAt = Math.max(0, finiteNumber(source.policyChangedAt, 0));
    if (policyChangedAt > currentTime + FUTURE_CLOCK_TOLERANCE_MS) policyChangedAt = currentTime;
    const customName = typeof source.customName === 'string'
      ? source.customName.trim().replace(/\s+/g, ' ').slice(0, CUSTOM_NAME_MAX_LENGTH)
      : '';
    return {
      hallLevel,
      hallConstruction: sanitizeHallConstruction(source.hallConstruction, hallLevel),
      policy,
      policyChangedAt,
      memberSeeds: sanitizedMemberSeeds(source.memberSeeds),
      customName
    };
  }

  function hallLevelInfo(level) {
    const numeric = Math.floor(finiteNumber(level, 1));
    return TOWN_HALL_LEVELS.find(info => info.level === numeric) || TOWN_HALL_LEVELS[0];
  }

  function nextHallUpgrade(state) {
    const clean = sanitizeTownState(state);
    return clean.hallLevel >= TOWN_HALL_LEVELS.length ? null : hallLevelInfo(clean.hallLevel + 1);
  }

  function builderSlots(state) {
    return hallLevelInfo(sanitizeTownState(state).hallLevel).builderSlots;
  }

  function policyModifiers(id) {
    const key = canonicalPolicyId(id) || 'balanced';
    return { ...TOWN_POLICIES[key] };
  }

  function policyChangeBlockReason(state, hasAccrued, now) {
    const currentTime = sanitizedNow(now);
    const clean = sanitizeTownState(state, currentTime);
    if (clean.hallLevel < 2) return 'Raise the Town Hall to level 2 to unlock policies.';
    if (hasAccrued) return 'Collect the town strongbox before changing policy.';
    if (clean.policyChangedAt > 0 && currentTime - clean.policyChangedAt < TOWN_POLICY_LOCK_MS) {
      return 'The current town policy is locked for 24 hours.';
    }
    return '';
  }

  function canChangePolicy(state, hasAccrued, now) {
    return !policyChangeBlockReason(state, !!hasAccrued, now);
  }

  function setPolicy(state, id, hasAccrued, now) {
    const currentTime = sanitizedNow(now);
    const clean = sanitizeTownState(state, currentTime);
    const policy = canonicalPolicyId(id);
    if (!policy) return { ok: false, state: clean, reason: 'Unknown town policy.' };
    if (policy === clean.policy) return { ok: true, state: clean, reason: '' };
    const reason = policyChangeBlockReason(clean, !!hasAccrued, currentTime);
    if (reason) return { ok: false, state: clean, reason };
    return { ok: true, state: { ...clean, policy, policyChangedAt: currentTime }, reason: '' };
  }

  function scaledAggregateMap(raw, multiplier) {
    const out = {};
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
    Object.keys(raw).forEach(id => {
      if (!id || id === '__proto__' || id === 'prototype' || id === 'constructor') return;
      const aggregate = Math.max(0, finiteNumber(raw[id], 0));
      const scaled = Math.floor(aggregate * multiplier);
      if (scaled > 0) out[id] = scaled;
    });
    return out;
  }

  function applyPolicyBundle(bundle, policyId) {
    const source = bundle && typeof bundle === 'object' && !Array.isArray(bundle) ? bundle : {};
    const policy = policyModifiers(policyId);
    return {
      coins: Math.floor(Math.max(0, finiteNumber(source.coins, 0)) * policy.coins),
      branches: Math.floor(Math.max(0, finiteNumber(source.branches, 0)) * policy.branches),
      stone: Math.floor(Math.max(0, finiteNumber(source.stone, 0)) * policy.stone),
      materials: scaledAggregateMap(source.materials, policy.materials),
      larder: scaledAggregateMap(source.larder, policy.larder)
    };
  }

  function buildTimeFactor(state) {
    const source = state && typeof state === 'object' && !Array.isArray(state) ? state : {};
    return canonicalPolicyId(source.policy) === 'builders' ? 0.80 : 1;
  }

  function memberSignature(seeds) {
    return sanitizedMemberSeeds(seeds).join(',');
  }

  function townProsperity(input) {
    const source = input && typeof input === 'object' ? input : {};
    const populationRatio = clamp(Math.max(0, finiteNumber(source.population, 0)) / 90, 0, 1);
    let happiness = Math.max(0, finiteNumber(source.happiness, 0));
    if (happiness > 1) happiness /= 100;
    const happinessRatio = clamp(happiness, 0, 1);
    const maxDevelopment = Math.max(0, finiteNumber(source.maxDevelopment, 0));
    const developmentRatio = maxDevelopment > 0
      ? clamp(Math.max(0, finiteNumber(source.development, 0)) / maxDevelopment, 0, 1)
      : 0;
    return Math.round(100 * (
      happinessRatio * 0.40 +
      developmentRatio * 0.35 +
      populationRatio * 0.25
    ));
  }

  return {
    TOWN_HALL_LEVELS,
    TOWN_POLICIES,
    TOWN_POLICY_LOCK_MS,
    sanitizeTownState,
    hallLevelInfo,
    nextHallUpgrade,
    builderSlots,
    policyModifiers,
    canChangePolicy,
    setPolicy,
    applyPolicyBundle,
    buildTimeFactor,
    memberSignature,
    townProsperity
  };
});
