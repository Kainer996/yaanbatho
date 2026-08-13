/* Burbz Night Sky Core — knows when it is truly night where the player stands.
 *
 * The game already lights its 3D scenes from the clock (daylight_core.js).
 * This core answers a sharper question: is the sun actually down over the
 * player's head right now? It computes real sunrise and sunset from the
 * calendar date and the player's last known latitude and longitude, using the
 * classic NOAA-style sunrise equation. With no location it falls back to the
 * same fixed night hours the daylight core uses, so the answer is always
 * sensible.
 *
 * Pure, deterministic helpers only — everything takes plain numbers or a Date
 * and returns plain values, so it all runs under Node for tests.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzNightSkyCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  // The sun's altitude at the moment we call it "set": the standard -0.833°
  // (refraction plus the solar disc). Owls start hunting right about then.
  const SUNSET_ALTITUDE_DEG = -0.833;

  // Fallback night window with no location fix — the same fixed hours the
  // daylight core grades scenes by (night before dawn at 5, after dusk at 19).
  const FALLBACK_NIGHT_START_HOUR = 19;
  const FALLBACK_NIGHT_END_HOUR = 5;

  const RAD = Math.PI / 180;

  function finiteLatLon(lat, lon) {
    const la = Number(lat), lo = Number(lon);
    return Number.isFinite(la) && Number.isFinite(lo) && la >= -90 && la <= 90 && lo >= -180 && lo <= 180;
  }

  function dayOfYearUTC(date) {
    const d = date instanceof Date ? date : new Date(date);
    const start = Date.UTC(d.getUTCFullYear(), 0, 1);
    return Math.floor((d.getTime() - start) / 86400000) + 1;
  }

  /* Solar declination in degrees for a day of the year (cosine approximation,
     within ~1° — plenty for deciding "is it dark outside"). */
  function solarDeclinationDeg(dayOfYear) {
    return -23.44 * Math.cos((2 * Math.PI / 365) * (Number(dayOfYear) + 10));
  }

  /* Equation of time in minutes: how far the real sun runs ahead of clock
     noon. Classic three-term approximation. */
  function equationOfTimeMinutes(dayOfYear) {
    const b = (2 * Math.PI * (Number(dayOfYear) - 81)) / 364;
    return 9.87 * Math.sin(2 * b) - 7.53 * Math.cos(b) - 1.5 * Math.sin(b);
  }

  /* Sunrise and sunset for the UTC day of `date` at lat/lon, as minutes from
     UTC midnight (they may run below 0 or past 1440 far from Greenwich —
     callers compare instants, not clock faces). Polar edge cases return
     polar:'night' (sun never rises) or polar:'day' (sun never sets). */
  function sunTimesUTC(date, lat, lon) {
    if (!finiteLatLon(lat, lon)) return null;
    const n = dayOfYearUTC(date);
    const declRad = solarDeclinationDeg(n) * RAD;
    const latRad = Number(lat) * RAD;
    const solarNoonMin = 720 - 4 * Number(lon) - equationOfTimeMinutes(n);
    const cosHourAngle = (Math.sin(SUNSET_ALTITUDE_DEG * RAD) - Math.sin(latRad) * Math.sin(declRad)) /
      (Math.cos(latRad) * Math.cos(declRad));
    if (cosHourAngle > 1) return { polar: 'night', solarNoonMin, sunriseMin: null, sunsetMin: null };
    if (cosHourAngle < -1) return { polar: 'day', solarNoonMin, sunriseMin: null, sunsetMin: null };
    const halfDayMin = 4 * (Math.acos(cosHourAngle) / RAD);
    return {
      polar: null,
      solarNoonMin,
      sunriseMin: solarNoonMin - halfDayMin,
      sunsetMin: solarNoonMin + halfDayMin
    };
  }

  /* True when the sun is below the horizon at `date` over lat/lon. The
     daylight window can straddle the UTC midnight far from Greenwich, so the
     instant is tested against the window shifted a day each way too. */
  function isNightAt(date, lat, lon) {
    const times = sunTimesUTC(date, lat, lon);
    if (!times) return null;
    if (times.polar) return times.polar === 'night';
    const d = date instanceof Date ? date : new Date(date);
    const nowMin = d.getUTCHours() * 60 + d.getUTCMinutes() + d.getUTCSeconds() / 60;
    const daylit = [nowMin - 1440, nowMin, nowMin + 1440]
      .some(minute => minute >= times.sunriseMin && minute <= times.sunsetMin);
    return !daylit;
  }

  /* Fallback: fixed night hours on the player's local clock. */
  function isNightForClockHour(hour) {
    const h = Number(hour);
    if (!Number.isFinite(h)) return false;
    const wrapped = ((h % 24) + 24) % 24;
    return wrapped >= FALLBACK_NIGHT_START_HOUR || wrapped < FALLBACK_NIGHT_END_HOUR;
  }

  /* The one call the game makes each minute: is it night right now?
     Prefers the real sun over the player's location; falls back to the
     local clock when no fix has ever been saved. */
  function nightDecision(opts) {
    const o = opts || {};
    const now = o.now instanceof Date ? o.now : new Date(Number(o.now) || Date.now());
    if (finiteLatLon(o.lat, o.lon)) {
      const night = isNightAt(now, Number(o.lat), Number(o.lon));
      if (night !== null) return { night, source: 'sun' };
    }
    const hour = Number.isFinite(Number(o.localHour)) ? Number(o.localHour) : now.getHours();
    return { night: isNightForClockHour(hour), source: 'clock' };
  }

  /* Open straight onto the dark Sound scan only for a player who has already
     met the game — a first-ever open still gets the intro, and a player still
     mid-tutorial keeps Merlin's guidance, day or night. */
  function shouldOpenNightListening(state) {
    const s = state || {};
    return !!s.night && !!s.introSeen && !s.tutorialBusy;
  }

  return {
    SUNSET_ALTITUDE_DEG,
    FALLBACK_NIGHT_START_HOUR,
    FALLBACK_NIGHT_END_HOUR,
    dayOfYearUTC,
    solarDeclinationDeg,
    equationOfTimeMinutes,
    sunTimesUTC,
    isNightAt,
    isNightForClockHour,
    nightDecision,
    shouldOpenNightListening
  };
});
