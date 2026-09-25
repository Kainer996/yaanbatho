// Burbz soundscape: a quiet, living bed of sound under the whole game, made
// on the phone rather than played from files. Standalone UMD module.
//
// What makes a sound feel like ASMR, and what this borrows from it:
//
//   * Close, soft, detailed texture. Leaves brushing, paper, a drip from a
//     leaf, all quiet enough that you lean in rather than back.
//   * Movement across the ears. Each rustle drifts from one side to the other,
//     which is most of what makes a sound feel near you on headphones.
//   * No sharp edges. Every event swells in and fades out on its own. Nothing
//     starts with a click or ends mid-ring, and the top end is kept dark.
//   * Slow, uneven rhythm. Events come at random, never on a beat, so the ear
//     stops predicting and settles.
//   * Low level. The bed sits well under the music and the interface; you
//     notice it most when it stops.
//
// Layers:
//   air     a breathing band of pink noise, darker indoors and at night, that
//           opens with the wind outdoors
//   leaves  rustles made of tiny grains of noise, panned as they pass
//   drips   water falling from leaves while it rains, and a little after
//   chimes  a far wind chime in a pentatonic scale, now and then, everywhere
//
// It never plays while Merlin's wand listens: the game's own sounds must
// never reach the birdsong microphone. The host passes allowed() for that.
(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BurbzSoundscapeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  function clamp(value, low, high) { return Math.max(low, Math.min(high, value)); }

  // Levels, as linear gain into the nature bus. Tuned against the music at
  // about -42 LUFS: the bed sits a little under it, events just above it.
  var LEVELS = Object.freeze({
    air: { menu: 0.025, indoor: 0.02, outdoor: 0.03, windBoost: 0.05 },
    leaves: { menu: 0.035, outdoor: 0.07 },
    drip: 0.05,
    chime: 0.02
  });

  // Seconds between events, as [shortest, longest].
  var GAPS = Object.freeze({
    leavesOutdoor: [1.6, 5.5],
    leavesMenu: [10, 24],
    chime: [26, 70],
    chimeNight: [55, 120],
    drip: [0.35, 1.6]
  });

  // D major pentatonic, two octaves up: no note in it can clash with another.
  var CHIME_NOTES = Object.freeze([587.33, 659.25, 739.99, 880, 987.77, 1174.66, 1318.51]);

  // Where the player is, from the last time the world reported its weather.
  // Exploration reports every frame; silence for a moment means a menu.
  function sceneFor(state, nowMs) {
    if (state.outdoorAt == null || nowMs - state.outdoorAt > 1500) return 'menu';
    return state.wind > 0 ? 'outdoor' : 'indoor';
  }

  function isNight(date) {
    var hour = date.getHours();
    return hour >= 21 || hour < 6;
  }

  function create(options) {
    options = options || {};
    var bus = options.bus || null;
    var allowed = typeof options.allowed === 'function' ? options.allowed : function() { return true; };
    var mood = typeof options.mood === 'function' ? options.mood : function() { return 'calm'; };
    var random = typeof options.random === 'function' ? options.random : Math.random;
    var clock = typeof options.now === 'function' ? options.now : Date.now;
    var schedule = typeof options.setInterval === 'function' ? options.setInterval
      : (root && typeof root.setInterval === 'function' ? root.setInterval.bind(root) : null);
    var cancel = typeof options.clearInterval === 'function' ? options.clearInterval
      : (root && typeof root.clearInterval === 'function' ? root.clearInterval.bind(root) : null);
    var state = { outdoorAt: null, rain: 0, wind: 0, wetUntil: 0 };
    var next = { leaves: 0, chime: 0, drip: 0 };
    var nodes = null;
    var timer = null;
    var on = false;
    var events = 0;

    function inert() {
      return { start: function() { return false; }, stop: function() {}, outdoors: function() {}, tick: function() { return null; },
        get playing() { return false; }, get events() { return 0; }, scene: function() { return 'menu'; } };
    }
    if (!bus || !bus.ctx) return inert();
    var ctx = bus.ctx;

    function range(pair) { return pair[0] + random() * (pair[1] - pair[0]); }

    // Pink noise (Paul Kellet's filter), stereo, long enough not to be heard
    // looping. Made once; every layer reads from it at a different offset.
    function pinkNoise(seconds) {
      var rate = ctx.sampleRate || 44100, length = Math.floor(rate * seconds);
      var buffer = ctx.createBuffer(2, length, rate);
      for (var channel = 0; channel < 2; channel++) {
        var data = buffer.getChannelData(channel);
        var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (var i = 0; i < length; i++) {
          var white = random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.969 * b2 + white * 0.153852;
          b3 = 0.8665 * b3 + white * 0.3104856;
          b4 = 0.55 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.016898;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
        // Cross-fade the ends so the loop has no seam.
        var edge = Math.floor(rate * 0.05);
        for (var j = 0; j < edge; j++) {
          var k = j / edge;
          data[j] = data[j] * k + data[length - edge + j] * (1 - k);
        }
      }
      return buffer;
    }

    function build() {
      if (nodes) return nodes;
      var out = ctx.createGain();
      out.gain.value = 0;
      out.connect(bus.input('nature'));
      var pink = pinkNoise(9);

      // The air: pink noise, low-passed, with two slow, unrelated LFOs, one on
      // its brightness and one on its level, so it breathes and never repeats.
      var air = ctx.createBufferSource();
      air.buffer = pink;
      air.loop = true;
      var airTone = ctx.createBiquadFilter();
      airTone.type = 'lowpass';
      airTone.frequency.value = 420;
      airTone.Q.value = 0.3;
      var airGain = ctx.createGain();
      airGain.gain.value = 0;
      air.connect(airTone);
      airTone.connect(airGain);
      airGain.connect(out);
      var breath = ctx.createOscillator();
      breath.frequency.value = 0.043;
      var breathDepth = ctx.createGain();
      breathDepth.gain.value = 110;
      breath.connect(breathDepth);
      breathDepth.connect(airTone.frequency);
      var swell = ctx.createOscillator();
      swell.frequency.value = 0.071;
      var swellDepth = ctx.createGain();
      swellDepth.gain.value = 0.012;
      swell.connect(swellDepth);
      swellDepth.connect(airGain.gain);
      var t = ctx.currentTime;
      air.start(t, random() * 8);
      breath.start(t);
      swell.start(t);
      nodes = { out: out, pink: pink, air: air, airTone: airTone, airGain: airGain, breath: breath, swell: swell };
      return nodes;
    }

    function glide(param, value, tau) {
      var t = ctx.currentTime;
      try {
        param.cancelScheduledValues(t);
        param.setValueAtTime(param.value, t);
        param.setTargetAtTime(value, t, tau);
      } catch (_) { try { param.value = value; } catch (_) {} }
    }

    function panner(from, to, start, end) {
      if (typeof ctx.createStereoPanner !== 'function') return null;
      var pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(from, start);
      pan.pan.linearRampToValueAtTime(to, end);
      return pan;
    }

    // A rustle is a run of tiny grains, each a random height, under a smooth
    // swell. The grains are the crinkle; the swell keeps it gentle.
    function rustle(level, now) {
      var t = now + 0.02;
      var length = 0.6 + random() * 1.3;
      var src = ctx.createBufferSource();
      src.buffer = nodes.pink;
      var band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = 1500 + random() * 2200;
      band.Q.value = 0.55;
      var dark = ctx.createBiquadFilter();
      dark.type = 'lowpass';
      dark.frequency.value = 4200;
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      var step = 0.016;
      var count = Math.floor(length / step);
      for (var i = 1; i <= count; i++) {
        var x = i / count;
        var body = Math.sin(Math.PI * x);
        body *= body;
        var grain = 0.3 + 0.7 * Math.pow(random(), 1.6);
        gain.gain.linearRampToValueAtTime(level * body * grain, t + i * step);
      }
      gain.gain.linearRampToValueAtTime(0, t + length + 0.03);
      var side = random() < 0.5 ? -1 : 1;
      var pan = panner(side * (0.3 + random() * 0.5), -side * random() * 0.4, t, t + length);
      src.connect(band);
      band.connect(dark);
      dark.connect(gain);
      if (pan) { gain.connect(pan); pan.connect(nodes.out); } else gain.connect(nodes.out);
      src.start(t, random() * 8);
      src.stop(t + length + 0.08);
      events++;
    }

    // A drop: a sine that rises quickly as it fades, which is the sound a
    // small bubble makes as it closes. Dark and very short.
    function drip(level, now) {
      var t = now + 0.01;
      var f = 650 + random() * 900;
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, t);
      osc.frequency.exponentialRampToValueAtTime(f * (1.5 + random() * 0.4), t + 0.045);
      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(level * (0.4 + random() * 0.6), t + 0.002);
      gain.gain.setTargetAtTime(0, t + 0.002, 0.016);
      var dark = ctx.createBiquadFilter();
      dark.type = 'lowpass';
      dark.frequency.value = 2600;
      var pan = panner((random() * 2 - 1) * 0.8, (random() * 2 - 1) * 0.8, t, t + 0.15);
      osc.connect(dark);
      dark.connect(gain);
      if (pan) { gain.connect(pan); pan.connect(nodes.out); } else gain.connect(nodes.out);
      var room = ctx.createGain();
      room.gain.value = 0.3;
      gain.connect(room);
      room.connect(bus.input('room'));
      osc.start(t);
      osc.stop(t + 0.2);
      events++;
    }

    // A far wind chime: two to four notes, each a glassy strike that rings
    // for a few seconds and fades on its own, mostly into the room.
    function chime(level, now) {
      var notes = 2 + Math.floor(random() * 3);
      var t = now + 0.05;
      var side = (random() * 2 - 1) * 0.6;
      for (var n = 0; n < notes; n++) {
        var f = CHIME_NOTES[Math.floor(random() * CHIME_NOTES.length)];
        var tau = 0.8 + random() * 0.6;
        var peak = level * (0.6 + random() * 0.4);
        var gain = ctx.createGain();
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(peak, t + 0.006);
        gain.gain.setTargetAtTime(0, t + 0.006, tau);
        var dark = ctx.createBiquadFilter();
        dark.type = 'lowpass';
        dark.frequency.value = 3000;
        var end = t + 0.006 + tau * 9;
        [[1, 1], [2.76, 0.12], [5.4, 0.035]].forEach(function(part) {
          var osc = ctx.createOscillator();
          osc.type = 'sine';
          osc.frequency.value = f * part[0];
          var level = ctx.createGain();
          level.gain.value = part[1];
          osc.connect(level);
          level.connect(dark);
          osc.start(t);
          osc.stop(end);
        });
        dark.connect(gain);
        var pan = panner(side, side * 0.6, t, end);
        if (pan) { gain.connect(pan); pan.connect(nodes.out); } else gain.connect(nodes.out);
        var room = ctx.createGain();
        room.gain.value = 0.55;
        gain.connect(room);
        room.connect(bus.input('room'));
        t += 0.22 + random() * 0.55;
      }
      events++;
    }

    // One step of the scheduler. Returns the scene, for tests and debugging.
    function tick() {
      var nowMs = Number(clock()) || 0;
      var want = on && !!safe(allowed) && mood() !== 'tense';
      if (!want) {
        if (nodes) glide(nodes.out.gain, 0, 0.12);
        return null;
      }
      build();
      glide(nodes.out.gain, 1, 0.9);
      var scene = sceneFor(state, nowMs);
      var night = isNight(new Date(nowMs));
      var wind = clamp(state.wind, 0, 1);
      var air = LEVELS.air[scene] + (scene === 'outdoor' ? LEVELS.air.windBoost * wind : 0);
      var bright = scene === 'outdoor' ? 520 + 1100 * wind : scene === 'indoor' ? 300 : 400;
      if (night) { air *= 0.8; bright *= 0.8; }
      glide(nodes.airGain.gain, air, 1.5);
      glide(nodes.airTone.frequency, bright, 2);

      var now = ctx.currentTime;
      var seconds = nowMs / 1000;
      if (!next.chime) next.chime = seconds + range([8, 20]);
      if (!next.leaves) next.leaves = seconds + range([2, 6]);
      if (seconds >= next.leaves) {
        if (scene === 'outdoor') {
          rustle(LEVELS.leaves.outdoor * (0.55 + 0.6 * wind), now);
          next.leaves = seconds + range(GAPS.leavesOutdoor) / (0.6 + wind);
        } else if (scene === 'menu') {
          rustle(LEVELS.leaves.menu, now);
          next.leaves = seconds + range(GAPS.leavesMenu);
        } else next.leaves = seconds + range(GAPS.leavesMenu);
      }
      if (seconds >= next.chime) {
        chime(LEVELS.chime * (scene === 'indoor' ? 0.6 : 1), now);
        next.chime = seconds + range(night ? GAPS.chimeNight : GAPS.chime);
      }
      // Leaves keep dripping for a minute and a half after the rain stops.
      if (state.rain > 0.05) state.wetUntil = nowMs + 90000;
      if (scene === 'outdoor' && nowMs < state.wetUntil && seconds >= next.drip) {
        var wet = state.rain > 0.05 ? 1 : clamp((state.wetUntil - nowMs) / 90000, 0, 1);
        drip(LEVELS.drip * (0.4 + 0.6 * wet), now);
        next.drip = seconds + range(GAPS.drip) / (0.4 + wet);
      }
      return scene;
    }

    function safe(fn) { try { return fn(); } catch (_) { return false; } }

    function start() {
      if (on) return true;
      on = true;
      if (schedule && timer === null) timer = schedule(tick, 250);
      tick();
      return true;
    }

    function stop() {
      on = false;
      if (timer !== null && cancel) { try { cancel(timer); } catch (_) {} }
      timer = null;
      tick();
    }

    // Exploration calls this every frame with the sky it is drawing.
    function outdoors(rain, wind) {
      state.outdoorAt = Number(clock()) || 0;
      state.rain = clamp(Number(rain) || 0, 0, 1);
      state.wind = clamp(Number(wind) || 0, 0, 1);
    }

    return {
      start: start,
      stop: stop,
      tick: tick,
      outdoors: outdoors,
      scene: function() { return sceneFor(state, Number(clock()) || 0); },
      get playing() { return on; },
      get events() { return events; }
    };
  }

  return { create: create, sceneFor: sceneFor, LEVELS: LEVELS, GAPS: GAPS, CHIME_NOTES: CHIME_NOTES };
});
