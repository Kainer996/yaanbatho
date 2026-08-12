// BURBZ — hold-to-steer gate for 3D stages.
//
// A 3D stage sits in the middle of a scrolling page. Before this gate, the
// canvas swallowed every touch, so a player scrolling past the village
// yanked the camera instead. The gate gives the page first claim on a touch:
// a swipe scrolls like anywhere else, and only a finger held still for a
// beat grabs the camera. After the grab, the same finger steers. A mouse or
// pen steers at once (no scroll to protect), and a second finger always
// steers — a pinch is never a scroll.
//
// Pure state machine, no DOM: the caller feeds it pointer events and asks
// `move()` whether the camera may follow. Timers are injectable for tests.
(function (root) {
  'use strict';

  var HOLD_MS = 300; // how long a still finger waits before it grabs the camera
  var SLOP_PX = 10;  // wiggle allowed while waiting; further than this is a scroll

  function createHoldGate(opts) {
    opts = opts || {};
    var holdMs = opts.holdMs || HOLD_MS;
    var slopPx = opts.slopPx || SLOP_PX;
    var setTimer = opts.setTimer || function (fn, ms) { return setTimeout(fn, ms); };
    var clearTimer = opts.clearTimer || function (id) { clearTimeout(id); };
    var onEngage = opts.onEngage || function () {};

    var gate = {
      engaged: false,   // the camera is grabbed; moves steer
      rejected: false,  // this gesture belongs to the page (scroll or tap)
      pointerCount: 0
    };
    var timer = null;
    var start = null; // where the waiting finger went down
    var last = null;  // where it is now

    function stopTimer() {
      if (timer !== null) { clearTimer(timer); timer = null; }
    }

    function engage(via) {
      if (gate.engaged) return;
      stopTimer();
      gate.engaged = true;
      var at = last || start || { x: 0, y: 0 };
      try { onEngage({ via: via, x: at.x, y: at.y }); } catch (e) {}
    }

    // Returns true when this pointer may steer right away.
    gate.down = function (p) {
      gate.pointerCount++;
      last = { x: p.x, y: p.y };
      if (gate.pointerCount >= 2) { gate.rejected = false; engage('pinch'); return true; }
      gate.engaged = false;
      gate.rejected = false;
      if (p.pointerType && p.pointerType !== 'touch') { gate.engaged = true; return true; }
      start = { x: p.x, y: p.y };
      timer = setTimer(function () {
        timer = null;
        if (!gate.rejected && gate.pointerCount > 0) engage('hold');
      }, holdMs);
      return false;
    };

    // Returns true when the camera may follow this move.
    gate.move = function (p) {
      last = { x: p.x, y: p.y };
      if (gate.engaged) return true;
      if (gate.rejected || !start) return false;
      if (Math.abs(p.x - start.x) + Math.abs(p.y - start.y) > slopPx) {
        gate.rejected = true; // the finger is scrolling — leave it to the page
        stopTimer();
      }
      return false;
    };

    gate.up = function () {
      gate.pointerCount = Math.max(0, gate.pointerCount - 1);
      if (gate.pointerCount === 0) {
        stopTimer();
        gate.engaged = false;
        gate.rejected = false;
        start = null;
        last = null;
      }
    };
    gate.cancel = gate.up;

    return gate;
  }

  var api = { createHoldGate: createHoldGate, HOLD_MS: HOLD_MS, SLOP_PX: SLOP_PX };
  root.BurbzTouchSteer = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
