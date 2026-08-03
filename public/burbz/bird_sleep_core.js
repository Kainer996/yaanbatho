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

  // Nocturnal companions sleep from 06:00 until 18:00 local time, then wake in
  // the early evening so their natural rhythm still leaves a long play window.
  function isScheduledSleepTime(bird, localHour) {
    if (!isNocturnalBird(bird)) return false;
    const hour = ((Number(localHour) || 0) % 24 + 24) % 24;
    return hour >= 6 && hour < 18;
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
    sanitizeSleepCare,
    isNocturnalBird,
    isScheduledSleepTime,
    advanceTiredness,
    sleepPlan,
    sleepReadiness
  };
});
