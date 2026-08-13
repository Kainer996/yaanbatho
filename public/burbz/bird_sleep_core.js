(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzBirdSleepCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const HOUR_MS = 60 * 60 * 1000;
  // Sleep is RETIRED (2026-08-09, Yaan's call): a roost full of sleeping birds
  // locked the whole flock out of battle, so no bird ever tires, sleeps or is
  // blocked from work any more. The constants and function shapes stay so old
  // saves sanitize cleanly and the API keeps its contract; this module now
  // chiefly owns nocturnal detection and the Night Hunter bonus, which are
  // rewards, not blockers. Re-enabling sleep means reverting this release.
  const AWAKE_TIREDNESS_PER_HOUR = 0;
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
  // Ascendant (v258): the advantage is now truly massive. An owl flown at
  // night out-earns any daytime bird by a mile — that is the whole point of
  // keeping one. Timers never change; only the payout swells.
  const NOCTURNAL_NIGHT_BONUS = Object.freeze({
    coins: 3,      // expedition coin payouts triple
    branches: 2,   // timber hauls double
    xp: 3,         // expedition AND training XP triple
    itemRolls: 2,  // two guaranteed extra finds per expedition
    statBonus: 2   // training stat gains double
  });
  // Night Wings: the battle half of the Night Hunter law. A nocturnal bird
  // fighting after dark is a different animal — half again as fast and as
  // fierce, tougher, and striking true out of the black. buildFighter in
  // battle_core.js applies whatever pack it is handed; only a nocturnal bird
  // at night ever gets one.
  const NOCTURNAL_NIGHT_BATTLE = Object.freeze({
    atk: 1.5,        // talons half again as sharp
    spd: 1.5,        // silent wings own the turn meter
    mag: 1.5,        // moon-magic runs high
    def: 1.25,       // the dark is armour
    maxHp: 1.25,     // fresh at an hour that tires everyone else
    critBonus: 0.15  // strikes from nowhere land true
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
    // Sleep retired: every companion is permanently awake and rested. Old saves
    // carrying tiredness or a sleeping flag are healed on the spot; only
    // sleepReturnRoom survives so the app can walk a woken bird home.
    care.tiredness = 0;
    care.lastTirednessAt = validTime(care.lastTirednessAt, now);
    care.sleeping = false;
    care.sleepingSince = null;
    care.sleepReturnRoom = typeof care.sleepReturnRoom === 'string' && care.sleepReturnRoom ? care.sleepReturnRoom : null;
    care.sleepReason = null;
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

  // Sleep retired: nobody has a bedtime any more — not even the owls. The
  // function stays because callers and tests know its name; it just never
  // schedules anyone to sleep.
  function isScheduledSleepTime() {
    return false;
  }

  // The Night Hunter bonus: the reward pack for using a nocturnal bird at
  // night. Returns the multiplier set, or null when it does not apply — the
  // reward cores stay pure and just apply whatever pack they are handed.
  function nocturnalNightBonus(bird, localHour) {
    return isNocturnalBird(bird) && isNightHour(localHour) ? { ...NOCTURNAL_NIGHT_BONUS } : null;
  }

  // Night Wings: the battle-stat pack for a nocturnal bird fighting at night.
  // Same contract as the reward pack — a pack when the law applies, null when
  // it does not, and battle_core stays pure by just applying what it is handed.
  function nocturnalNightBattleBoost(bird, localHour) {
    return isNocturnalBird(bird) && isNightHour(localHour) ? { ...NOCTURNAL_NIGHT_BATTLE } : null;
  }

  function advanceTiredness(rawCare, now = Date.now()) {
    // Sleep retired: tiredness never accrues, so advancing time just stamps
    // the clock on an already-rested care record.
    const care = sanitizeSleepCare(rawCare, now);
    care.lastTirednessAt = now;
    return care;
  }

  function sleepPlan(rawCare, bird, options = {}) {
    const now = validTime(options.now, Date.now());
    // Sleep retired: never put a bird down, and wake any bird an old save
    // still marks as sleeping the moment it is looked at.
    const wasSleeping = !!(rawCare && typeof rawCare === 'object' && rawCare.sleeping);
    return {
      scheduled: false,
      shouldSleep: false,
      shouldWake: wasSleeping,
      sleeping: false,
      reason: null,
      tiredness: sanitizeSleepCare(rawCare, now).tiredness
    };
  }

  function sleepReadiness() {
    // Sleep retired: every companion is always ready for battle, quests,
    // training and posts.
    return { ok: true, sleeping: false, tiredness: 0, warning: false, message: '' };
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
    NOCTURNAL_NIGHT_BATTLE,
    sanitizeSleepCare,
    isNocturnalBird,
    isNightHour,
    isScheduledSleepTime,
    nocturnalNightBonus,
    nocturnalNightBattleBoost,
    advanceTiredness,
    sleepPlan,
    sleepReadiness
  };
});
