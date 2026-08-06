(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzBirdSleepCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOUR_MS = 60 * 60 * 1000;
  const AWAKE_TIREDNESS_PER_HOUR = 5;
  const SLEEP_RECOVERY_PER_HOUR = 20;
  const AUTO_SLEEP_AT = 85;
  const WORK_BLOCK_AT = 90;
  const WAKE_AT = 15;
  const MAX_ELAPSED_MS = 48 * HOUR_MS;
  // Night runs 18:00–06:00 local — the same window nocturnal companions are
  // awake for. Any bird may be worked at night (the player's own bedtime quest
  // must never be locked behind owning an owl); a nocturnal bird worked at
  // night is simply in its element, and the Night Hunter bonus multiplies its
  // whole payout, in any capacity.
  const NIGHT_START_HOUR = 18;
  const NIGHT_END_HOUR = 6;
  const NOCTURNAL_NIGHT_BONUS = Object.freeze({
    coins: 2,      // expedition coin payouts double
    branches: 1.5, // timber hauls half again
    xp: 2,         // expedition AND training XP double
    itemRolls: 1   // one guaranteed extra find per expedition
  });

  function clamp(value, min, max) {
    const n = Number(value);
    return Math.max(min, Math.min(max, Number.isFinite(n) ? n : min));
  }

  function validTime(value, fallback) {
    const n = Number(value);
    return Number.isFinite(n) && n >= 0 ? n : fallback;
  }

  function sanitizeSleepCare(raw, now = Date.now()) {
    const care = raw && typeof raw === 'object' ? { ...raw } : {};
    care.tiredness = clamp(care.tiredness == null ? 20 : care.tiredness, 0, 100);
    care.lastTirednessAt = validTime(care.lastTirednessAt, now);
    care.sleeping = !!care.sleeping;
    care.sleepingSince = care.sleeping ? validTime(care.sleepingSince, care.lastTirednessAt) : null;
    care.sleepReturnRoom = typeof care.sleepReturnRoom === 'string' && care.sleepReturnRoom ? care.sleepReturnRoom : null;
    care.sleepReason = care.sleeping && (care.sleepReason === 'schedule' || care.sleepReason === 'tired') ? care.sleepReason : null;
    return care;
  }

  function birdWords(bird) {
    const traits = Array.isArray(bird && bird.traits) ? bird.traits.join(' ') : String((bird && bird.traits) || '');
    return [bird && bird.commonName, bird && bird.species, bird && bird.scientificName, bird && bird.rationale, traits]
      .filter(Boolean).join(' ').toLowerCase();
  }

  function isNocturnalBird(bird) {
    const words = birdWords(bird);
    return /\b(nocturnal|night hunter|night-active|owl|owlet|boobook|morepork|nightjar|frogmouth|potoo|oilbird|kiwi|kakapo)\b/i.test(words);
  }

  function normalizeHour(localHour) {
    return ((Number(localHour) || 0) % 24 + 24) % 24;
  }

  function isNightHour(localHour) {
    const hour = normalizeHour(localHour);
    return hour >= NIGHT_START_HOUR || hour < NIGHT_END_HOUR;
  }

  // Nocturnal companions sleep from 06:00 until 18:00 local time, then wake in
  // the early evening so their natural rhythm still leaves a long play window.
  function isScheduledSleepTime(bird, localHour) {
    if (!isNocturnalBird(bird)) return false;
    return !isNightHour(localHour);
  }

  // The Night Hunter bonus: the reward pack for using a nocturnal bird at
  // night. Returns the multiplier set, or null when it does not apply — the
  // reward cores stay pure and just apply whatever pack they are handed.
  function nocturnalNightBonus(bird, localHour) {
    return isNocturnalBird(bird) && isNightHour(localHour) ? { ...NOCTURNAL_NIGHT_BONUS } : null;
  }

  function advanceTiredness(rawCare, now = Date.now(), sleepingOverride) {
    const care = sanitizeSleepCare(rawCare, now);
    const elapsed = clamp(now - care.lastTirednessAt, 0, MAX_ELAPSED_MS);
    const sleeping = typeof sleepingOverride === 'boolean' ? sleepingOverride : care.sleeping;
    const rate = sleeping ? -SLEEP_RECOVERY_PER_HOUR : AWAKE_TIREDNESS_PER_HOUR;
    care.tiredness = clamp(care.tiredness + (elapsed / HOUR_MS) * rate, 0, 100);
    care.lastTirednessAt = now;
    return care;
  }

  function sleepPlan(rawCare, bird, options = {}) {
    const now = validTime(options.now, Date.now());
    const hour = options.localHour == null ? new Date(now).getHours() : Number(options.localHour);
    const care = sanitizeSleepCare(rawCare, now);
    const scheduled = isScheduledSleepTime(bird, hour);
    const busy = !!options.busy;
    const roostBuilt = options.roostBuilt !== false;
    const shouldSleep = !care.sleeping && !busy && roostBuilt && (scheduled || care.tiredness >= AUTO_SLEEP_AT);
    const shouldWake = care.sleeping && !scheduled && care.tiredness <= WAKE_AT;
    return {
      scheduled,
      shouldSleep,
      shouldWake,
      sleeping: shouldSleep || (care.sleeping && !shouldWake),
      reason: scheduled ? 'schedule' : care.tiredness >= AUTO_SLEEP_AT ? 'tired' : care.sleepReason,
      tiredness: care.tiredness
    };
  }

  function sleepReadiness(rawCare, bird, options = {}) {
    const now = validTime(options.now, Date.now());
    const care = advanceTiredness(rawCare, now);
    const plan = sleepPlan(care, bird, { ...options, now });
    const sleeping = care.sleeping || plan.shouldSleep || plan.scheduled;
    const blocked = sleeping || care.tiredness >= WORK_BLOCK_AT;
    return {
      ok: !blocked,
      sleeping,
      tiredness: care.tiredness,
      warning: !blocked && care.tiredness >= 70,
      message: sleeping ? 'Sleeping in The Roost.' : blocked ? 'Too tired — needs sleep in The Roost.' : care.tiredness >= 70 ? 'Getting tired.' : ''
    };
  }

  return {
    HOUR_MS,
    AWAKE_TIREDNESS_PER_HOUR,
    SLEEP_RECOVERY_PER_HOUR,
    AUTO_SLEEP_AT,
    WORK_BLOCK_AT,
    WAKE_AT,
    NIGHT_START_HOUR,
    NIGHT_END_HOUR,
    NOCTURNAL_NIGHT_BONUS,
    sanitizeSleepCare,
    isNocturnalBird,
    isNightHour,
    isScheduledSleepTime,
    nocturnalNightBonus,
    advanceTiredness,
    sleepPlan,
    sleepReadiness
  };
});
