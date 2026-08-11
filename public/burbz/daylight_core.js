/* Burbz Daylight Core — the real sky over the player's head.
 *
 * The 3D village and town scenes light themselves from the player's local
 * clock: night keeps the moonlit look the game has always had, midday brings
 * a full sun, and dawn and dusk pass through a golden transition between the
 * two. Pure, deterministic helpers only — everything takes a fractional local
 * hour (0-24) and returns plain numbers, so it all runs under Node.
 *
 * The colour work is integer-RGB mixing on hex numbers (the same shape the
 * VILLAGE_PALETTES use); no THREE dependency here.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDaylightCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // Local hours. Night ends as dawn breaks, full day runs to dusk, and night
  // returns after the dusk fade. Fixed hours on purpose: simple, predictable,
  // and no location permission needed just to light a scene.
  const DAWN_START_HOUR = 5;
  const DAY_START_HOUR = 7;
  const DUSK_START_HOUR = 17;
  const NIGHT_START_HOUR = 19;

  // Day-sky colour targets the night palettes blend toward as the sun rises.
  const DAY_SKY = 0x7fb2e4;
  const DAY_GROUND = 0x49682e;
  const DAY_HEMI_SKY = 0xdcecff;
  const DAY_HEMI_GROUND = 0x77683f;
  // Golden-hour warmth layered over dawn and dusk.
  const WARM_SKY = 0xe08a4e;
  // The key light: cool moonlight at night, warm sunlight by day.
  const MOON_LIGHT = 0xbfd2ff;
  const SUN_LIGHT = 0xfff1c8;
  const WARM_LIGHT = 0xffb070;

  function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? 0 : n > 1 ? 1 : n;
  }

  function smooth(t) {
    const k = clamp01(t);
    return k * k * (3 - 2 * k);
  }

  function wrapHour(hour) {
    const h = Number(hour) % 24;
    return Number.isFinite(h) ? (h < 0 ? h + 24 : h) : 0;
  }

  /* 0 through the night, 1 through the day, smooth ramps across dawn and dusk. */
  function sunFactorForHour(hour) {
    const h = wrapHour(hour);
    if (h < DAWN_START_HOUR || h >= NIGHT_START_HOUR) return 0;
    if (h < DAY_START_HOUR) return smooth((h - DAWN_START_HOUR) / (DAY_START_HOUR - DAWN_START_HOUR));
    if (h < DUSK_START_HOUR) return 1;
    return smooth((NIGHT_START_HOUR - h) / (NIGHT_START_HOUR - DUSK_START_HOUR));
  }

  /* Golden-hour warmth: zero at full day and full night, peaking mid-way
     through each transition — the sky blushes exactly while the sun is low. */
  function warmFactorForHour(hour) {
    const s = sunFactorForHour(hour);
    return 4 * s * (1 - s);
  }

  function phaseForHour(hour) {
    const h = wrapHour(hour);
    if (h < DAWN_START_HOUR || h >= NIGHT_START_HOUR) return 'night';
    if (h < DAY_START_HOUR) return 'dawn';
    if (h < DUSK_START_HOUR) return 'day';
    return 'dusk';
  }

  /* Integer-RGB mix of two hex colours — the palette entries' native shape. */
  function mixHex(from, to, t) {
    const k = clamp01(t);
    const a = Number(from) >>> 0, b = Number(to) >>> 0;
    const r = Math.round(((a >> 16) & 255) + ((((b >> 16) & 255) - ((a >> 16) & 255)) * k));
    const g = Math.round(((a >> 8) & 255) + ((((b >> 8) & 255) - ((a >> 8) & 255)) * k));
    const bl = Math.round((a & 255) + (((b & 255) - (a & 255)) * k));
    return (r << 16) | (g << 8) | bl;
  }

  /* The whole lighting balance sheet for one moment of the day. The night
     row reproduces the game's original moonlit look exactly, so a player at
     midnight sees the village they have always seen. */
  function daylightGradeForHour(hour) {
    const sun = sunFactorForHour(hour);
    const warm = warmFactorForHour(hour);
    return {
      phase: phaseForHour(hour),
      sun: Number(sun.toFixed(3)),
      warm: Number(warm.toFixed(3)),
      stars: Number((1 - sun).toFixed(3)),   // star + firefly presence
      moon: sun < 0.5,                        // moon in the sky, else the sun
      torch: Number((1 - 0.85 * sun).toFixed(3)), // lanterns fade by day
      hemi: Number((2.0 + 1.4 * sun).toFixed(3)),
      keyIntensity: Number((1.95 + 1.05 * sun).toFixed(3)),
      keyColor: mixHex(mixHex(MOON_LIGHT, SUN_LIGHT, sun), WARM_LIGHT, warm * 0.45),
      exposure: Number((1.25 + 0.18 * sun).toFixed(3))
    };
  }

  /* Re-light a village palette for the given grade: sky, ground and the
     hemisphere bounce blend toward their daytime selves, with golden-hour
     warmth over the transitions. Materials (plaster, timber, stone, roofs)
     keep their authored colours — brightness comes from the lights. */
  function gradePalette(pal, grade) {
    if (!pal || !grade || !grade.sun) return pal;
    const sun = clamp01(grade.sun), warm = clamp01(grade.warm) * 0.45;
    return Object.assign({}, pal, {
      sky: mixHex(mixHex(pal.sky, DAY_SKY, sun), WARM_SKY, warm),
      ground: mixHex(pal.ground, DAY_GROUND, sun * 0.7),
      hemiSky: mixHex(mixHex(pal.hemiSky, DAY_HEMI_SKY, sun), WARM_SKY, warm * 0.5),
      hemiGround: mixHex(pal.hemiGround, DAY_HEMI_GROUND, sun * 0.8)
    });
  }

  return {
    DAWN_START_HOUR,
    DAY_START_HOUR,
    DUSK_START_HOUR,
    NIGHT_START_HOUR,
    DAY_SKY,
    DAY_GROUND,
    DAY_HEMI_SKY,
    DAY_HEMI_GROUND,
    WARM_SKY,
    MOON_LIGHT,
    SUN_LIGHT,
    WARM_LIGHT,
    sunFactorForHour,
    warmFactorForHour,
    phaseForHour,
    mixHex,
    daylightGradeForHour,
    gradePalette
  };
});
