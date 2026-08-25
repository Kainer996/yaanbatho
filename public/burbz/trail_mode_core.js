/* Burbz Trail Mode Core — is the player actually out walking?
 *
 * Pure logic, no DOM and no game globals, so the whole judgement can be driven
 * from Node with synthetic GPS traces. index.html feeds it every position fix
 * and acts on the verdict.
 *
 * The judgement has to survive three kinds of lie:
 *   1. A phone sitting on a table still reports new coordinates. GPS drifts by
 *      tens of metres, so a single "moved" fix proves nothing — only sustained
 *      ground covered over a real stretch of time does.
 *   2. A poor fix invents motion. Anything less accurate than TRAIL_MAX_ACCURACY_M
 *      is thrown away rather than believed.
 *   3. A car, a bus or a train move far faster than a walk. Above
 *      TRAIL_MAX_SPEED_MPS this is a journey, not a wander, and Burbz must not
 *      invite someone to look at their phone while driving.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzTrailModeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var EARTH_R = 6371000;

  // A stroll is about 1.4 m/s. The floor sits below a dawdle so a slow walk
  // still counts; the ceiling sits above a run and below any vehicle.
  var TRAIL_MIN_SPEED_MPS = 0.55;   // ~2 km/h — slower than this is standing about
  var TRAIL_MAX_SPEED_MPS = 6.0;    // ~21.6 km/h — faster than this is a vehicle
  var TRAIL_MIN_DISTANCE_M = 80;    // ground actually covered, at best accuracy
  // …and more than that when the fixes are vague. A drifting phone accumulates
  // ground roughly in proportion to its own error, so the bar rises with it:
  // at 10 m accuracy a walk must cover 80 m, at 25 m it must cover 150 m.
  var TRAIL_DISTANCE_ACCURACY_FACTOR = 6;
  var TRAIL_MIN_SECONDS = 45;       // sustained, not one GPS jump
  // Deliberately strict. A false negative costs nothing — the player can still
  // start a wander by hand. A false positive takes over the screen of someone
  // sitting still, so a fix vaguer than this is not evidence of anything.
  var TRAIL_MAX_ACCURACY_M = 25;
  var TRAIL_WINDOW_SECONDS = 180;   // how far back the verdict looks
  // Ground covered is measured as the NET displacement of each short segment,
  // never as a sum of step-to-step hops. Summing hops is what turns a phone
  // jittering on a table into half a kilometre of "walking": every wobble adds,
  // and none of them cancel. Over a 30-second segment a wobble cancels itself
  // out while a walk carries on in one direction — and a circular route still
  // counts, because each segment of it is close enough to straight.
  var TRAIL_SEGMENT_SECONDS = 30;
  // Each segment's displacement is discounted by the noise the device itself
  // admits to. A fix that says "accurate to 12 m" cannot prove a 10 m walk, so
  // half that accuracy is subtracted from every segment before it counts —
  // half, because the error lands in a random direction and partly cancels over
  // the segment. The effect is exactly what it should be: the vaguer the fixes,
  // the more ground the player has to genuinely cover before Burbz believes it.
  var TRAIL_NOISE_DISCOUNT = 0.5;
  var TRAIL_ASSUMED_ACCURACY_M = 10;  // when a fix states no accuracy at all

  // Time in the pocket is the point of a walk: the phone is away and the player
  // is looking at the world. A fully pocketed wander pays half as much again.
  var POCKET_BONUS_MAX = 0.5;
  var POCKET_MIN_SECONDS = 60;      // below a minute there is no bonus to speak of

  function toRad(d) { return d * Math.PI / 180; }

  function haversineM(a, b) {
    var dLat = toRad(b.lat - a.lat);
    var dLon = toRad(b.lon - a.lon);
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
  }

  function finite(value) {
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  }

  function usableFix(fix) {
    if (!fix || typeof fix !== 'object') return null;
    var lat = finite(fix.lat), lon = finite(fix.lon), at = finite(fix.at);
    if (lat === null || lon === null || at === null) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    var accuracy = finite(fix.accuracy);
    // An unknown accuracy is trusted; a stated bad one is not.
    if (accuracy !== null && accuracy > TRAIL_MAX_ACCURACY_M) return null;
    return { lat: lat, lon: lon, at: at, accuracy: accuracy };
  }

  // Ground covered: the net displacement of each TRAIL_SEGMENT_SECONDS slice,
  // added together. See the note on TRAIL_SEGMENT_SECONDS for why this is not a
  // sum of consecutive hops.
  function segmentDistanceM(fixes) {
    if (!fixes || fixes.length < 2) return 0;
    var total = 0;
    var anchor = fixes[0];
    for (var i = 1; i < fixes.length; i++) {
      var spanMs = fixes[i].at - anchor.at;
      var last = i === fixes.length - 1;
      if (spanMs >= TRAIL_SEGMENT_SECONDS * 1000 || last) {
        var accuracy = Math.max(
          anchor.accuracy === null ? TRAIL_ASSUMED_ACCURACY_M : anchor.accuracy,
          fixes[i].accuracy === null ? TRAIL_ASSUMED_ACCURACY_M : fixes[i].accuracy
        );
        var net = haversineM(anchor, fixes[i]) - accuracy * TRAIL_NOISE_DISCOUNT;
        if (net > 0) total += net;
        anchor = fixes[i];
      }
    }
    return total;
  }

  function worstAccuracyM(fixes) {
    var worst = 0;
    for (var i = 0; i < fixes.length; i++) {
      var a = fixes[i].accuracy === null ? TRAIL_ASSUMED_ACCURACY_M : fixes[i].accuracy;
      if (a > worst) worst = a;
    }
    return worst || TRAIL_ASSUMED_ACCURACY_M;
  }

  /* A rolling verdict over the last TRAIL_WINDOW_SECONDS of fixes.
   *
   * `push` returns the current reading every time, so the caller can show a
   * live speed as well as act on the verdict:
   *   { walking, vehicle, distanceM, seconds, speedMps, fixes }
   */
  function createWalkDetector(options) {
    options = options || {};
    var minSpeed = finite(options.minSpeedMps);
    var maxSpeed = finite(options.maxSpeedMps);
    var minDistance = finite(options.minDistanceM);
    var minSeconds = finite(options.minSeconds);
    var windowSeconds = finite(options.windowSeconds);
    minSpeed = minSpeed === null ? TRAIL_MIN_SPEED_MPS : minSpeed;
    maxSpeed = maxSpeed === null ? TRAIL_MAX_SPEED_MPS : maxSpeed;
    minDistance = minDistance === null ? TRAIL_MIN_DISTANCE_M : minDistance;
    minSeconds = minSeconds === null ? TRAIL_MIN_SECONDS : minSeconds;
    windowSeconds = windowSeconds === null ? TRAIL_WINDOW_SECONDS : windowSeconds;

    var fixes = [];

    function reading() {
      if (fixes.length < 2) {
        return { walking: false, vehicle: false, distanceM: 0, seconds: 0, speedMps: 0, fixes: fixes.length };
      }
      var distance = segmentDistanceM(fixes);
      var seconds = (fixes[fixes.length - 1].at - fixes[0].at) / 1000;
      var speed = seconds > 0 ? distance / seconds : 0;
      var bar = Math.max(minDistance, worstAccuracyM(fixes) * TRAIL_DISTANCE_ACCURACY_FACTOR);
      var longEnough = seconds >= minSeconds && distance >= bar;
      var vehicle = longEnough && speed > maxSpeed;
      return {
        walking: longEnough && speed >= minSpeed && speed <= maxSpeed,
        vehicle: vehicle,
        distanceM: Math.round(distance),
        requiredM: Math.round(bar),
        seconds: Math.round(seconds),
        speedMps: Number(speed.toFixed(3)),
        fixes: fixes.length
      };
    }

    return {
      push: function (fix) {
        var next = usableFix(fix);
        if (!next) return reading();
        var last = fixes[fixes.length - 1];
        // Out-of-order or repeated timestamps would poison the window.
        if (last && next.at <= last.at) return reading();
        fixes.push(next);
        var horizon = next.at - windowSeconds * 1000;
        while (fixes.length && fixes[0].at < horizon) fixes.shift();
        return reading();
      },
      read: reading,
      reset: function () { fixes = []; return reading(); }
    };
  }

  /* Pocket time on a wander. `pocketMs` is time the screen was off or the app
   * was in the background while the quest ran; `totalMs` is the whole quest.
   * Returns the multiplier to apply to the wander's XP and a line of words.
   */
  function pocketBonus(pocketMs, totalMs) {
    var pocket = Math.max(0, finite(pocketMs) || 0);
    var total = Math.max(0, finite(totalMs) || 0);
    if (total <= 0 || pocket < POCKET_MIN_SECONDS * 1000) {
      return { share: 0, multiplier: 1, pocketMinutes: Math.floor(pocket / 60000), earned: false };
    }
    var share = Math.max(0, Math.min(1, pocket / total));
    return {
      share: Number(share.toFixed(3)),
      multiplier: Number((1 + POCKET_BONUS_MAX * share).toFixed(3)),
      pocketMinutes: Math.floor(pocket / 60000),
      earned: true
    };
  }

  return {
    TRAIL_MIN_SPEED_MPS: TRAIL_MIN_SPEED_MPS,
    TRAIL_MAX_SPEED_MPS: TRAIL_MAX_SPEED_MPS,
    TRAIL_MIN_DISTANCE_M: TRAIL_MIN_DISTANCE_M,
    TRAIL_DISTANCE_ACCURACY_FACTOR: TRAIL_DISTANCE_ACCURACY_FACTOR,
    TRAIL_MIN_SECONDS: TRAIL_MIN_SECONDS,
    TRAIL_MAX_ACCURACY_M: TRAIL_MAX_ACCURACY_M,
    TRAIL_WINDOW_SECONDS: TRAIL_WINDOW_SECONDS,
    TRAIL_SEGMENT_SECONDS: TRAIL_SEGMENT_SECONDS,
    TRAIL_NOISE_DISCOUNT: TRAIL_NOISE_DISCOUNT,
    TRAIL_ASSUMED_ACCURACY_M: TRAIL_ASSUMED_ACCURACY_M,
    segmentDistanceM: segmentDistanceM,
    POCKET_BONUS_MAX: POCKET_BONUS_MAX,
    POCKET_MIN_SECONDS: POCKET_MIN_SECONDS,
    haversineM: haversineM,
    createWalkDetector: createWalkDetector,
    pocketBonus: pocketBonus
  };
});
