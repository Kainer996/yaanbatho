// Burbz file-backed sound manager. Standalone UMD module; safe in browsers
// without HTMLAudioElement and in mobile browsers that reject locked playback.
(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BurbzAudioCore = api;
  if (root && root.window) root.window.BurbzAudioCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  // THE INTERFACE PALETTE.
  // Every one of these was chosen by measuring the file, not by its filename.
  // A tap wants its whole body inside about 50 ms and to be gone inside 200 ms;
  // anything that rings on is what makes an interface feel heavy. Measured with
  // decodeAudioData, "body" is the point by which 90% of the sound's energy has
  // passed and "tail" is the last sample above 1% of peak:
  //
  //   sfx-ui-tap.mp3   body 111 ms, tail 999 ms   <- rang for a full second
  //   ui-wood.mp3      body  47 ms, tail 200 ms   <- a wooden tick, and done
  //   ui-lock.mp3      body  67 ms, tail 150 ms
  //   ui-coins.mp3     body 281 ms, tail 448 ms
  //   ui-spell.mp3     body 247 ms, tail 507 ms
  //   sfx-resource.mp3 body 726 ms                <- far too long for a pickup
  //
  // So the short, characterful pack carries the interface — wood for a tap, a
  // lock for an unlock, coins for coins, a spell accent for magic — and the
  // bespoke one-second Burbz sounds keep the big moments, where a tail belongs.
  var DEFAULT_SOUND_MANIFEST = Object.freeze({
    tap: 'assets/audio/ui-wood.mp3',
    page: 'assets/audio/sfx-page-wing.mp3',
    capture: 'assets/audio/sfx-capture.mp3',
    hit: 'assets/audio/sfx-battle-hit.mp3',
    specialHit: 'assets/audio/ui-spell.mp3',
    fireballCharge: 'assets/audio/fireball-v412/charge.mp3',
    fireballCast: 'assets/audio/fireball-v412/cast.mp3',
    fireballImpact: 'assets/audio/fireball-v412/impact.mp3',
    defend: 'assets/audio/sfx-battle-defend.mp3',
    victory: 'assets/audio/sfx-victory.mp3',
    defeat: 'assets/audio/sfx-defeat-error.mp3',
    levelUp: 'assets/audio/reward-level-up.mp3',
    questComplete: 'assets/audio/sfx-quest-complete.mp3',
    unlock: 'assets/audio/ui-lock.mp3',
    coins: 'assets/audio/ui-coins.mp3',
    build: 'assets/audio/sfx-build.mp3',
    error: 'assets/audio/sfx-defeat-error.mp3',
    // Calm steps are soft, close and level with each other, so no step clanks.
    // The gravel set is the same loudness, only grittier: it plays when danger is near.
    footstepGround: Object.freeze(['assets/audio/footsteps/calm-grass-01.mp3','assets/audio/footsteps/calm-grass-02.mp3','assets/audio/footsteps/calm-grass-03.mp3']),
    footstepWood: Object.freeze(['assets/audio/footsteps/calm-wood-01.mp3','assets/audio/footsteps/calm-wood-02.mp3','assets/audio/footsteps/calm-wood-03.mp3']),
    footstepStone: Object.freeze(['assets/audio/footsteps/calm-stone-01.mp3','assets/audio/footsteps/calm-stone-02.mp3']),
    footstepTense: Object.freeze(['assets/audio/footsteps/tense-gravel-01.mp3','assets/audio/footsteps/tense-gravel-02.mp3','assets/audio/footsteps/tense-gravel-03.mp3','assets/audio/footsteps/tense-gravel-04.mp3']),
    // Gentle camp sounds for quiet moments.
    campChop: Object.freeze(['assets/audio/camp/chop-01.mp3','assets/audio/camp/chop-02.mp3']),
    campDust: Object.freeze(['assets/audio/camp/dust-01.mp3','assets/audio/camp/dust-02.mp3']),
    campEat: Object.freeze(['assets/audio/camp/eat-01.mp3','assets/audio/camp/eat-02.mp3','assets/audio/camp/eat-03.mp3']),
    campfire: 'assets/audio/camp/campfire-loop.mp3',
    campStool: 'assets/audio/camp/stool.mp3',
    rain: 'assets/audio/weather/rain-loop.mp3',
    wind: 'assets/audio/weather/wind-loop.mp3',
    birdsong: 'assets/audio/ambience-empire-treetops.mp3',
    residentChatter: Object.freeze(Array.from({length:16}, function(_, i) {
      return 'assets/audio/little-folk/mumble-' + String(i + 1).padStart(2, '0') + '.mp3';
    }))
  });

  // How loud each role sits. The files were mastered at wildly different levels
  // (measured RMS ran from -21 dB to -33 dB), so without this the interface
  // shouts and the rewards whisper. A tap should be felt more than heard.
  var DEFAULT_VOLUMES = Object.freeze({
    tap: 0.3,
    page: 0.38,
    capture: 0.8,
    hit: 0.55,
    specialHit: 0.6,
    fireballCharge: 0.18,
    fireballCast: 0.48,
    fireballImpact: 0.38,
    defend: 0.5,
    victory: 0.9,
    defeat: 0.65,
    levelUp: 0.85,
    questComplete: 0.9,
    unlock: 0.5,
    coins: 0.45,
    build: 0.55,
    error: 0.45,
    campChop: 0.42,
    campDust: 0.34,
    campEat: 0.4,
    // The fire's level when the player stands right beside it.
    campfire: 0.5,
    campStool: 0.42,
    // Weather beds sit under everything else.
    rain: 0.42,
    wind: 0.22,
    // Treetops and birds fill the rest between songs.
    birdsong: 0.3
  });

  // A button that returns the identical pitch on every press reads as a machine.
  // A few per cent of drift, chosen fresh each time, is the whole difference
  // between a wooden interface that sounds handmade and one that sounds sampled.
  // Rewards are left alone: a fanfare that wobbles sounds broken, not handmade.
  var DEFAULT_PITCH_DRIFT = Object.freeze({
    tap: 0.06,
    page: 0.035,
    hit: 0.05,
    specialHit: 0.04,
    defend: 0.04,
    unlock: 0.04,
    coins: 0.05,
    build: 0.045,
    error: 0.03,
    campChop: 0.04,
    campDust: 0.03,
    campEat: 0.03
  });

  // A tap is over inside 200 ms now, so it can answer the finger sooner without
  // ever stacking into mush.
  var DEFAULT_COOLDOWNS = Object.freeze({
    tap: 65,
    page: 140,
    capture: 250,
    hit: 55,
    specialHit: 120,
    fireballCharge: 100,
    fireballCast: 120,
    fireballImpact: 100,
    defend: 100,
    victory: 500,
    defeat: 500,
    levelUp: 400,
    questComplete: 500,
    unlock: 250,
    coins: 100,
    build: 180,
    error: 180,
    campChop: 250,
    campDust: 900,
    campEat: 1200
  });

  // No entry here plays a real bird. Burbz identifies wild birds by ear, so a
  // recorded call coming out of a button would tell the player they had heard
  // something they had not. Every sound in the bank is made, not recorded.
  function classifyInteraction(targetLike) {
    if (!targetLike || typeof targetLike !== 'object') return null;
    var dataset = targetLike.dataset || {};
    if (dataset.audio === 'none' || dataset.sound === 'none') return null;
    if (dataset.audio) return String(dataset.audio);
    if (dataset.sound) return String(dataset.sound);

    var text = [dataset.action, targetLike.id, targetLike.className]
      .filter(Boolean).join(' ').toLowerCase();
    if (/\b(build|craft|forge|upgrade)\b/.test(text)) return 'build';
    if (/\b(coin|gold|shop|purchase|buy)\b/.test(text)) return 'coins';
    if (/\b(capture|discover)\b/.test(text)) return 'capture';
    if (/\b(page|tab|nav|menu|screen)\b/.test(text)) return 'page';

    var tag = String(targetLike.tagName || '').toUpperCase();
    if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' ||
        targetLike.role === 'button') return 'tap';
    return null;
  }

  // ---- THE CALM BUS ----------------------------------------------------------
  // iPhone Safari ignores HTMLAudioElement.volume. Every clip played that way
  // comes out at the level it was mastered at, so on Yaan's phone the music
  // (mastered at -15 LUFS) and a wooden tap (peaking at -1.7 dB) played at
  // full blast, whatever the tables above said. A gain inside an AudioContext
  // is honoured on every phone, so in a browser every sound now runs through
  // one context and one chain:
  //
  //   ui ─────┐
  //   sfx ────┤
  //   nature ─┼─> master ─> warmth (high shelf -5 dB) ─> glue (soft compressor) ─> out
  //   music ──┘   (music is low-passed first, as if from the next room)
  //   room  ────> a short, dark room reverb, fed by sends, back into master
  //
  // The warmth shelf takes the glassy top off everything, which is where
  // harshness lives. The glue compressor is gentle: it only stops a fanfare
  // from jumping out over the quiet bed. The room gives taps and chimes a
  // soft tail that dies on its own, instead of a sample that stops dead.
  var BUS_LEVELS = Object.freeze({ master: 0.85, ui: 1, sfx: 1, nature: 1, music: 1, room: 0.9 });

  // A room impulse built from noise: a stereo exponential decay that also
  // darkens as it fades, the way a small wooden room swallows its highs.
  function makeRoomImpulse(ctx, seconds) {
    var rate = ctx.sampleRate || 44100;
    var length = Math.max(1, Math.floor(rate * seconds));
    var buffer = ctx.createBuffer(2, length, rate);
    for (var channel = 0; channel < 2; channel++) {
      var data = buffer.getChannelData(channel);
      var smooth = 0;
      for (var i = 0; i < length; i++) {
        var t = i / length;
        // One-pole low-pass whose corner falls as the tail fades.
        var a = 0.55 - 0.45 * t;
        smooth += a * ((Math.random() * 2 - 1) - smooth);
        data[i] = smooth * Math.exp(-6.9 * t) * (i < rate * 0.004 ? i / (rate * 0.004) : 1);
      }
    }
    return buffer;
  }

  function createBus(options) {
    options = options || {};
    var Context = options.AudioContext ||
      (root && (root.AudioContext || root.webkitAudioContext));
    if (typeof Context !== 'function') return null;
    var ctx;
    try { ctx = new Context(); } catch (_) { return null; }
    var fetcher = typeof options.fetch === 'function' ? options.fetch
      : (root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    var inputs = Object.create(null);
    var buffers = Object.create(null);
    var loading = Object.create(null);
    try {
      var master = ctx.createGain();
      master.gain.value = BUS_LEVELS.master;
      var warmth = ctx.createBiquadFilter();
      warmth.type = 'highshelf';
      warmth.frequency.value = 5200;
      warmth.gain.value = -5;
      var glue = ctx.createDynamicsCompressor();
      glue.threshold.value = -22;
      glue.knee.value = 18;
      glue.ratio.value = 2.5;
      glue.attack.value = 0.012;
      glue.release.value = 0.3;
      master.connect(warmth);
      warmth.connect(glue);
      glue.connect(ctx.destination);
      ['ui', 'sfx', 'nature'].forEach(function(name) {
        var gain = ctx.createGain();
        gain.gain.value = BUS_LEVELS[name];
        gain.connect(master);
        inputs[name] = gain;
      });
      var music = ctx.createGain();
      music.gain.value = BUS_LEVELS.music;
      var distance = ctx.createBiquadFilter();
      distance.type = 'lowpass';
      distance.frequency.value = 3600;
      distance.Q.value = 0.5;
      music.connect(distance);
      distance.connect(master);
      inputs.music = music;
      var room = ctx.createConvolver();
      room.buffer = makeRoomImpulse(ctx, 1.7);
      var roomOut = ctx.createGain();
      roomOut.gain.value = BUS_LEVELS.room;
      room.connect(roomOut);
      roomOut.connect(master);
      inputs.room = room;
    } catch (_) {
      try { ctx.close(); } catch (_) {}
      return null;
    }

    function resume() {
      if (!ctx || ctx.state === 'running' || typeof ctx.resume !== 'function') return Promise.resolve(true);
      try { return Promise.resolve(ctx.resume()).then(function() { return true; }, function() { return false; }); }
      catch (_) { return Promise.resolve(false); }
    }
    // iOS suspends the context after a call or when the app is backgrounded
    // ('interrupted'); any real touch wakes it again.
    if (root && typeof root.addEventListener === 'function' && options.listen !== false) {
      var wake = function(event) { if (event && event.isTrusted === false) return; resume(); };
      ['pointerdown', 'touchend', 'keydown'].forEach(function(type) {
        try { root.addEventListener(type, wake, { passive: true }); } catch (_) {}
      });
    }

    function load(src) {
      if (!src) return Promise.resolve(null);
      if (hasOwnKey(buffers, src)) return Promise.resolve(buffers[src]);
      if (loading[src]) return loading[src];
      if (!fetcher) return Promise.resolve(null);
      loading[src] = Promise.resolve().then(function() { return fetcher(src); })
        .then(function(response) {
          if (!response || response.ok === false) throw new Error('missing ' + src);
          return response.arrayBuffer();
        })
        .then(function(bytes) {
          return new Promise(function(resolve, reject) {
            var done = ctx.decodeAudioData(bytes, resolve, reject);
            if (done && typeof done.then === 'function') done.then(resolve, reject);
          });
        })
        .then(function(buffer) { buffers[src] = buffer || null; delete loading[src]; return buffers[src]; },
          function() { buffers[src] = null; delete loading[src]; return null; });
      return loading[src];
    }

    // Music keeps its streaming element; only its output is routed here.
    function routeMedia(element, name) {
      if (!element || typeof ctx.createMediaElementSource !== 'function') return null;
      try {
        var source = ctx.createMediaElementSource(element);
        var gain = ctx.createGain();
        gain.gain.value = 0;
        source.connect(gain);
        gain.connect(inputs[name] || inputs.music);
        return gain;
      } catch (_) { return null; }
    }

    var noise = null;
    function noiseBuffer() {
      if (noise) return noise;
      var rate = ctx.sampleRate || 44100, length = Math.floor(rate * 2);
      noise = ctx.createBuffer(1, length, rate);
      var data = noise.getChannelData(0);
      for (var i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      return noise;
    }

    return {
      ctx: ctx,
      input: function(name) { return inputs[name] || inputs.sfx; },
      resume: resume,
      load: load,
      buffer: function(src) { return hasOwnKey(buffers, src) ? buffers[src] : undefined; },
      routeMedia: routeMedia,
      noiseBuffer: noiseBuffer,
      now: function() { return ctx.currentTime; }
    };
  }

  function hasOwnKey(object, key) { return Object.prototype.hasOwnProperty.call(object, key); }

  var sharedBusInstance;
  // One context for the whole game. Null outside a browser, so Node tests and
  // very old browsers keep the element path below.
  function sharedBus() {
    if (sharedBusInstance === undefined) sharedBusInstance = createBus();
    return sharedBusInstance;
  }

  // ---- SOFT HANDS -------------------------------------------------------------
  // The interface sounds are made, not sampled, so each one has an envelope
  // that always reaches silence: no file can end on a cliff. They borrow from
  // what ASMR artists reach for: a fingertip tap on wood, paper turning, a
  // small glass bead, a felt mallet. All sit in the low mids that a phone
  // speaker can still carry (above about 500 Hz), with no bright click on top.
  function envelope(param, t, peak, attack, tau) {
    param.setValueAtTime(0, t);
    param.linearRampToValueAtTime(peak, t + attack);
    param.setTargetAtTime(0, t + attack, tau);
    return t + attack + tau * 9;  // about -78 dB: silence
  }

  function strike(bus, dest, t, freq, o) {
    var ctx = bus.ctx;
    var tone = ctx.createBiquadFilter();
    tone.type = 'lowpass';
    tone.frequency.value = o.cutoff || 2600;
    tone.Q.value = 0.5;
    var out = ctx.createGain();
    var end = envelope(out.gain, t, o.peak, o.attack || 0.004, o.tau);
    tone.connect(out);
    out.connect(dest);
    if (o.send && o.room) {
      var send = ctx.createGain();
      send.gain.value = o.send;
      out.connect(send);
      send.connect(o.room);
    }
    (o.partials || [[1, 1]]).forEach(function(part) {
      var osc = ctx.createOscillator();
      var level = ctx.createGain();
      osc.type = 'sine';
      var f = freq * part[0];
      // A struck thing starts a touch sharp and settles: that small drop is
      // what makes a sine sound knocked rather than switched on.
      osc.frequency.setValueAtTime(f * (o.bend || 1), t);
      if (o.bend && o.bend !== 1) osc.frequency.exponentialRampToValueAtTime(f, t + (o.bendTime || 0.02));
      level.gain.value = part[1];
      osc.connect(level);
      level.connect(tone);
      osc.start(t);
      osc.stop(end + 0.02);
    });
    if (o.grain) {
      // A breath of texture on the attack: the fingertip meeting the wood.
      var grain = ctx.createBufferSource();
      grain.buffer = bus.noiseBuffer();
      var band = ctx.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = o.grainFreq || 1800;
      band.Q.value = 0.8;
      var grainGain = ctx.createGain();
      var grainEnd = envelope(grainGain.gain, t, o.peak * o.grain, 0.0015, 0.006);
      grain.connect(band);
      band.connect(grainGain);
      grainGain.connect(tone);
      grain.start(t, Math.random() * 1.5);
      grain.stop(grainEnd + 0.02);
    }
    return end;
  }

  function paper(bus, dest, t, o) {
    var ctx = bus.ctx;
    var src = ctx.createBufferSource();
    src.buffer = bus.noiseBuffer();
    var band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.Q.value = 0.7;
    band.frequency.setValueAtTime(o.from, t);
    band.frequency.exponentialRampToValueAtTime(o.to, t + o.sweep);
    var soft = ctx.createBiquadFilter();
    soft.type = 'lowpass';
    soft.frequency.value = 3400;
    var gain = ctx.createGain();
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(o.peak, t + o.rise);
    gain.gain.setTargetAtTime(0, t + o.rise + o.hold, o.tau);
    var end = t + o.rise + o.hold + o.tau * 9;
    var last = soft;
    if (typeof ctx.createStereoPanner === 'function') {
      var pan = ctx.createStereoPanner();
      pan.pan.setValueAtTime(o.pan || 0, t);
      pan.pan.linearRampToValueAtTime(-(o.pan || 0) * 0.5, end);
      soft.connect(pan);
      last = pan;
    }
    src.connect(band);
    band.connect(soft);
    last.connect(gain);
    gain.connect(dest);
    if (o.send && o.room) {
      var send = ctx.createGain();
      send.gain.value = o.send;
      gain.connect(send);
      send.connect(o.room);
    }
    src.start(t, Math.random() * 1.4);
    src.stop(end + 0.02);
    return end;
  }

  // Each takes (bus, destination, start time, volume 0..1, drift, room send
  // node) and returns when it is silent. Volume scales the designed peak.
  var SOFT_SOUNDS = Object.freeze({
    // A fingertip on a wooden box: a short knock, low and round.
    tap: function(bus, dest, t, v, r, room) {
      return strike(bus, dest, t, 560 * r, { peak: 0.11 * v, tau: 0.022, bend: 1.18, bendTime: 0.014,
        partials: [[1, 1], [2.42, 0.22]], cutoff: 2300, grain: 0.35, grainFreq: 1700, send: 0.14, room: room });
    },
    // A page turning: a soft paper sweep that drifts across the ears.
    page: function(bus, dest, t, v, r, room) {
      return paper(bus, dest, t, { peak: 0.11 * v, from: 700 * r, to: 2300 * r, sweep: 0.2, rise: 0.05, hold: 0.07,
        tau: 0.05, pan: (Math.random() * 2 - 1) * 0.35, send: 0.12, room: room });
    },
    // Two wooden-bar notes, a fifth apart: something opening.
    unlock: function(bus, dest, t, v, r, room) {
      strike(bus, dest, t, 523.25 * r, { peak: 0.06 * v, tau: 0.09, partials: [[1, 1], [3.93, 0.1]], cutoff: 2600, send: 0.3, room: room });
      return strike(bus, dest, t + 0.1, 783.99 * r, { peak: 0.05 * v, tau: 0.13, partials: [[1, 1], [3.93, 0.08]], cutoff: 2800, send: 0.35, room: room });
    },
    // Two small glass beads touching.
    coins: function(bus, dest, t, v, r, room) {
      strike(bus, dest, t, 1318.5 * r, { peak: 0.045 * v, tau: 0.06, partials: [[1, 1], [2.76, 0.14]], cutoff: 3600, send: 0.35, room: room });
      return strike(bus, dest, t + 0.065, 1975.5 * r, { peak: 0.035 * v, tau: 0.08, partials: [[1, 1], [2.76, 0.1]], cutoff: 3800, send: 0.4, room: room });
    },
    // A felt mallet, falling a step: "not quite", never a buzzer.
    error: function(bus, dest, t, v, r, room) {
      strike(bus, dest, t, 392 * r, { peak: 0.06 * v, tau: 0.07, bend: 1.06, partials: [[1, 1], [2.0, 0.12]], cutoff: 1500, send: 0.2, room: room });
      return strike(bus, dest, t + 0.13, 329.63 * r, { peak: 0.055 * v, tau: 0.1, bend: 1.04, partials: [[1, 1], [2.0, 0.1]], cutoff: 1400, send: 0.25, room: room });
    }
  });

  // On the bus the mix is set by ear for a quiet room, not for the element
  // path above. Rewards still stand out, but as a warm swell, not a shout.
  var BUS_VOLUMES = Object.freeze({
    tap: 1,
    page: 1,
    unlock: 1,
    coins: 1,
    error: 1,
    capture: 0.42,
    hit: 0.34,
    specialHit: 0.36,
    fireballCharge: 0.14,
    fireballCast: 0.32,
    fireballImpact: 0.26,
    defend: 0.32,
    victory: 0.45,
    defeat: 0.3,
    levelUp: 0.45,
    questComplete: 0.45,
    build: 0.36,
    campChop: 0.42,
    campDust: 0.38,
    campEat: 0.42,
    // A crackling fire is one of the oldest calming sounds there is. Let it
    // be heard when you sit by it.
    campfire: 0.95,
    campStool: 0.4,
    // Rain on leaves is the other. The file sits at -39 LUFS, so it can rise.
    rain: 0.8,
    wind: 0.24,
    birdsong: 0.26,
    residentChatter: 0.3,
    footstep: 0.3
  });

  // Where each sound lives, and how much of it reaches the room.
  var BUS_ROUTES = Object.freeze({
    tap: 'ui', page: 'ui', unlock: 'ui', coins: 'ui', error: 'ui',
    campChop: 'nature', campDust: 'nature', campEat: 'nature', campfire: 'nature', campStool: 'nature',
    rain: 'nature', wind: 'nature', birdsong: 'nature',
    footstepGround: 'nature', footstepWood: 'nature', footstepStone: 'nature', footstepTense: 'nature'
  });
  var BUS_SENDS = Object.freeze({
    capture: 0.22, levelUp: 0.25, questComplete: 0.25, victory: 0.2, build: 0.14,
    residentChatter: 0.12, campStool: 0.1, campChop: 0.1
  });

  function createAudioManager(options) {
    options = options || {};
    var hasOwn = Object.prototype.hasOwnProperty;
    // A caller that brings its own Audio (every test does) keeps the element
    // path. The game passes nothing and gets the calm bus.
    var bus = hasOwn.call(options, 'bus') ? options.bus
      : (hasOwn.call(options, 'Audio') || options.audioFactory ? null : sharedBus());
    var AudioFactory = hasOwn.call(options, 'Audio')
      ? options.Audio
      : (options.audioFactory || (root && root.Audio));
    var manifest = Object.assign({}, DEFAULT_SOUND_MANIFEST, options.manifest || {});
    var cooldowns = Object.assign({}, DEFAULT_COOLDOWNS, options.cooldowns || {});
    var volumes = Object.assign({}, DEFAULT_VOLUMES, options.volumes || {});
    var pitchDrift = Object.assign({}, DEFAULT_PITCH_DRIFT, options.pitchDrift || {});
    var random = typeof options.random === 'function' ? options.random : Math.random;
    var now = typeof options.now === 'function' ? options.now : Date.now;
    var schedule = typeof options.setTimeout === 'function'
      ? options.setTimeout
      : (root && typeof root.setTimeout === 'function' ? root.setTimeout.bind(root) : null);
    var maxPolyphony = Math.max(1, Number(options.maxPolyphony) || 6);
    var maxPerSound = Math.max(1, Number(options.maxPerSound) || maxPolyphony);
    var localEnabled = options.enabled !== false;
    var active = [];
    var lastPlayed = Object.create(null);
    var lastSource = Object.create(null);
    var lastAnyPlayedAt = -Infinity;

    function isEnabled() {
      if (typeof options.getEnabled === 'function') {
        try { return !!options.getEnabled(); } catch (_) { return false; }
      }
      return localEnabled;
    }

    function safePause(audio) {
      if (!audio || typeof audio.pause !== 'function') return;
      try { audio.pause(); } catch (_) { /* unavailable media is intentionally silent */ }
    }

    function removeActive(entry) {
      var index = active.indexOf(entry);
      if (index !== -1) active.splice(index, 1);
    }

    // Stopping a sound on the bus is a short fade, never a cut: a tail that
    // stops mid-ring is the click Yaan heard at the end of every tap.
    function releaseEntry(entry) {
      if (entry.voice) {
        var voice = entry.voice;
        entry.voice = null;
        try {
          var t = bus.ctx.currentTime;
          voice.gain.gain.cancelScheduledValues(t);
          voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
          voice.gain.gain.setTargetAtTime(0, t, 0.04);
          voice.source.stop(t + 0.4);
        } catch (_) {}
      } else safePause(entry.audio);
      removeActive(entry);
    }

    function stopAll() {
      active.slice().forEach(releaseEntry);
      Object.keys(loops).forEach(stopLoop);
    }

    // Calm is the default. Tense swaps in the gritty steps and hushes the fire.
    var mood = 'calm';
    function setMood(value) {
      mood = value === 'tense' ? 'tense' : 'calm';
      if (mood === 'tense') campfire(0);
      return mood;
    }

    // Looping beds: the campfire and the weather. Each fades to its target.
    var loops = Object.create(null);
    function stopLoop(name) {
      var loop = loops[name];
      if (!loop) return;
      if (loop.node) fadeBusLoop(loop, 0, 0.12, true);
      if (loop.audio) safePause(loop.audio);
      delete loops[name];
    }
    // Bus loops: a looping buffer under a gain that glides to its target.
    function fadeBusLoop(loop, target, tau, stop) {
      try {
        var t = bus.ctx.currentTime;
        loop.node.gain.cancelScheduledValues(t);
        loop.node.gain.setValueAtTime(loop.node.gain.value, t);
        loop.node.gain.setTargetAtTime(target, t, tau);
        if (stop && loop.source) loop.source.stop(t + tau * 8);
      } catch (_) {}
    }
    function busLoopTo(name, value, loopOptions) {
      var target = value * (Number(busVolume(name)) || 0);
      var loop = loops[name];
      if (loopOptions && loopOptions.immediate && target === 0) { stopLoop(name); return false; }
      if (target > 0 && !loop) {
        var src = chooseSource(name);
        if (!src) return false;
        var node;
        try { node = bus.ctx.createGain(); node.gain.value = 0; node.connect(bus.input(BUS_ROUTES[name] || 'nature')); }
        catch (_) { return false; }
        loop = loops[name] = { node: node, source: null, target: 0, bus: true };
        bus.load(src).then(function(buffer) {
          if (loops[name] !== loop || !buffer) { if (loops[name] === loop && !buffer) delete loops[name]; return; }
          try {
            var source = bus.ctx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(node);
            // Start somewhere different each time so a return never replays
            // the same opening crackle.
            source.start(bus.ctx.currentTime, random() * Math.max(0, buffer.duration - 0.1));
            loop.source = source;
          } catch (_) { delete loops[name]; }
        });
      }
      if (!loop) return false;
      loop.target = target;
      if (target > 0) fadeBusLoop(loop, target, 0.9, false);
      else {
        fadeBusLoop(loop, 0, 0.35, false);
        // Let the fade finish, then free the source if nothing wanted it back.
        if (schedule) schedule(function() { if (loops[name] === loop && loop.target === 0) stopLoop(name); }, 3000);
      }
      return target > 0;
    }
    function busVolume(name) {
      return hasOwn.call(BUS_VOLUMES, name) ? BUS_VOLUMES[name] : (hasOwn.call(volumes, name) ? volumes[name] : 1);
    }
    function stopCampfire() { stopLoop('campfire'); }
    function rampLoop(name) {
      var loop = loops[name];
      if (!loop || loop.timer) return;
      var step = function() {
        loop.timer = false;
        if (loops[name] !== loop) return;
        var diff = loop.target - loop.volume;
        loop.volume = Math.abs(diff) <= 0.02 ? loop.target : loop.volume + (diff > 0 ? 0.02 : -0.02);
        try { loop.audio.volume = loop.volume; } catch (_) {}
        if (loop.volume <= 0 && loop.target <= 0) { stopLoop(name); return; }
        if (loop.volume !== loop.target && schedule) { loop.timer = true; schedule(step, 60); }
      };
      step();
    }
    function loopTo(name, level, loopOptions) {
      var value = Math.max(0, Math.min(1, Number(level) || 0));
      if (!isEnabled()) value = 0;
      if (bus) return busLoopTo(name, value, loopOptions);
      if (loopOptions && loopOptions.immediate && value === 0) { stopLoop(name); return false; }
      var target = value * (Number(volumes[name]) || 0);
      if (target > 0 && !loops[name]) {
        var src = chooseSource(name), audio = src ? makeAudio(src) : null;
        if (!audio) return false;
        try { audio.loop = true; audio.volume = 0; audio.preload = 'auto'; } catch (_) {}
        var loop = loops[name] = { audio: audio, volume: 0, target: 0, timer: false };
        try {
          Promise.resolve(typeof audio.play === 'function' ? audio.play() : null).catch(function() {
            if (loops[name] === loop) stopLoop(name);
          });
        } catch (_) { stopLoop(name); return false; }
      }
      if (!loops[name]) return false;
      loops[name].target = target;
      rampLoop(name);
      return target > 0;
    }
    function campfire(level, fireOptions) {
      return loopTo('campfire', mood === 'tense' ? 0 : level, fireOptions);
    }
    // Rain follows the real sky; a light wind always moves a little.
    function ambience(rain, wind, ambienceOptions) {
      loopTo('rain', rain, ambienceOptions);
      loopTo('wind', wind, ambienceOptions);
    }
    function birdsong(level, birdOptions) { return loopTo('birdsong', level, birdOptions); }
    function loopLevel(name) { return loops[name] ? loops[name].target : 0; }
    function stopFootsteps() {
      active.slice().filter(function(entry){return entry.name.indexOf('footstep')===0;}).forEach(releaseEntry);
    }
    function stop(name) {
      active.slice().filter(function(entry){return entry.name===name;}).forEach(releaseEntry);
    }

    function setEnabled(value) {
      localEnabled = !!value;
      if (typeof options.setEnabled === 'function') {
        try { options.setEnabled(localEnabled); } catch (_) { /* settings hooks are optional */ }
      }
      if (!localEnabled) stopAll();
      return localEnabled;
    }

    function chooseSource(name) {
      var candidate = manifest[name];
      if (Array.isArray(candidate)) {
        if (candidate.length > 1) {
          candidate = candidate.filter(function(src) { return src !== lastSource[name]; });
        }
        if (!candidate.length) return null;
        var index = Math.floor(random() * candidate.length);
        index = Math.max(0, Math.min(candidate.length - 1, index));
        return candidate[index] || null;
      }
      return typeof candidate === 'string' && candidate ? candidate : null;
    }

    function makeAudio(src) {
      if (typeof AudioFactory !== 'function') return null;
      try {
        return new AudioFactory(src);
      } catch (_) {
        try { return AudioFactory(src); } catch (_) { return null; }
      }
    }

    function activeFor(name) {
      return active.reduce(function(count, entry) {
        return count + (entry.name === name ? 1 : 0);
      }, 0);
    }

    function playedRecently(windowMs) {
      var timestamp;
      try { timestamp = Number(now()); } catch (_) { timestamp = Date.now(); }
      if (!Number.isFinite(timestamp)) return false;
      var elapsed = timestamp - lastAnyPlayedAt;
      return elapsed >= 0 && elapsed <= Math.max(0, Number(windowMs) || 0);
    }

    function play(name, playOptions) {
      playOptions = playOptions || {};
      if (!isEnabled()) return Promise.resolve(false);
      if (bus) return playOnBus(name, playOptions);
      var src = chooseSource(name);
      if (!src || typeof AudioFactory !== 'function') return Promise.resolve(false);

      var timestamp;
      try { timestamp = Number(now()); } catch (_) { timestamp = Date.now(); }
      if (!Number.isFinite(timestamp)) timestamp = 0;
      var cooldown = hasOwn.call(playOptions, 'cooldown')
        ? Math.max(0, Number(playOptions.cooldown) || 0)
        : Math.max(0, Number(cooldowns[name]) || 0);
      if (hasOwn.call(lastPlayed, name) && timestamp - lastPlayed[name] < cooldown) {
        return Promise.resolve(false);
      }
      var soundLimit = Math.max(1, Number(playOptions.maxPolyphony) || maxPerSound);
      if (active.length >= maxPolyphony || activeFor(name) >= soundLimit) {
        return Promise.resolve(false);
      }

      // Reserve the cooldown before invoking play(), preventing async tap storms.
      lastPlayed[name] = timestamp;
      lastAnyPlayedAt = timestamp;
      var audio = makeAudio(src);
      if (!audio) {
        if (lastPlayed[name] === timestamp) delete lastPlayed[name];
        return Promise.resolve(false);
      }

      var volume = hasOwn.call(playOptions, 'volume')
        ? Number(playOptions.volume)
        : (hasOwn.call(volumes, name) ? Number(volumes[name]) : 1);
      var rate;
      if (hasOwn.call(playOptions, 'playbackRate')) {
        rate = Number(playOptions.playbackRate);
      } else {
        var drift = Math.max(0, Math.min(0.4, Number(pitchDrift[name]) || 0));
        rate = drift > 0 ? 1 + (random() * 2 - 1) * drift : 1;
      }
      try { audio.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1)); } catch (_) {}
      try { audio.playbackRate = Number.isFinite(rate) && rate > 0 ? rate : 1; } catch (_) {}
      try { audio.preload = 'auto'; } catch (_) {}
      try { audio.loop = playOptions.loop === true; } catch (_) {}

      var entry = { name: name, audio: audio };
      lastSource[name] = src;
      active.push(entry);
      var finish = function() { removeActive(entry); };
      try {
        if (typeof audio.addEventListener === 'function') {
          audio.addEventListener('ended', finish, { once: true });
          audio.addEventListener('error', finish, { once: true });
        } else {
          audio.onended = finish;
          audio.onerror = finish;
        }
      } catch (_) { /* old audio mocks and browsers may reject listener options */ }

      var result;
      try {
        result = typeof audio.play === 'function' ? audio.play() : null;
      } catch (_) {
        finish();
        if (lastPlayed[name] === timestamp) delete lastPlayed[name];
        return Promise.resolve(false);
      }
      return Promise.resolve(result).then(function() {
        // A cancelled charge or mute must also win over a late play promise.
        if (active.indexOf(entry) < 0 || !isEnabled()) { safePause(audio); finish(); return false; }
        return true;
      }, function() {
        finish();
        if (lastPlayed[name] === timestamp) delete lastPlayed[name];
        return false;
      });
    }

    // The bus version of play: the same cooldowns and voice limits, but every
    // sound gets a gain the phone honours and an ending that fades to nothing.
    function playOnBus(name, playOptions) {
      var soft = SOFT_SOUNDS[name];
      var src = soft ? null : chooseSource(name);
      if (!soft && !src) return Promise.resolve(false);
      var timestamp;
      try { timestamp = Number(now()); } catch (_) { timestamp = Date.now(); }
      if (!Number.isFinite(timestamp)) timestamp = 0;
      var cooldown = hasOwn.call(playOptions, 'cooldown')
        ? Math.max(0, Number(playOptions.cooldown) || 0)
        : Math.max(0, Number(cooldowns[name]) || 0);
      if (hasOwn.call(lastPlayed, name) && timestamp - lastPlayed[name] < cooldown) return Promise.resolve(false);
      var soundLimit = Math.max(1, Number(playOptions.maxPolyphony) || maxPerSound);
      if (activeFor(name) >= soundLimit) return Promise.resolve(false);
      // When every voice is busy the oldest one bows out with a short fade,
      // so a run of quick taps can never swallow the chime that follows.
      while (active.length >= maxPolyphony) releaseEntry(active[0]);
      lastPlayed[name] = timestamp;
      lastAnyPlayedAt = timestamp;
      if (bus.ctx.state !== 'running') bus.resume();

      // An explicit element volume is read as "this much of the usual", so a
      // caller asking for a quieter hit still gets a quieter hit on the bus.
      var volume = hasOwn.call(playOptions, 'busVolume') ? Number(playOptions.busVolume)
        : busVolume(name) * (hasOwn.call(playOptions, 'volume') && Number(volumes[name]) > 0
          ? Number(playOptions.volume) / Number(volumes[name]) : 1);
      if (!Number.isFinite(volume)) volume = 1;
      volume = Math.max(0, Math.min(1.5, volume));
      var rate;
      if (hasOwn.call(playOptions, 'playbackRate')) rate = Number(playOptions.playbackRate);
      else {
        var drift = Math.max(0, Math.min(0.4, Number(pitchDrift[name]) || 0));
        rate = drift > 0 ? 1 + (random() * 2 - 1) * drift : 1;
      }
      if (!Number.isFinite(rate) || rate <= 0) rate = 1;
      var dest = bus.input(BUS_ROUTES[name] || 'sfx');
      var room = bus.input('room');
      var entry = { name: name, audio: null, voice: null };
      active.push(entry);
      var finish = function() { removeActive(entry); };

      if (soft) {
        try {
          var gain = bus.ctx.createGain();
          gain.gain.value = 1;
          gain.connect(dest);
          var end = soft(bus, gain, bus.ctx.currentTime + 0.005, volume, rate, room);
          // A silent carrier lets stop() fade the whole voice, sends and all.
          var carrier = bus.ctx.createBufferSource();
          carrier.buffer = bus.noiseBuffer();
          var mute = bus.ctx.createGain();
          mute.gain.value = 0;
          carrier.connect(mute);
          mute.connect(gain);
          carrier.onended = finish;
          carrier.start(bus.ctx.currentTime);
          carrier.stop(end + 0.05);
          entry.voice = { gain: gain, source: carrier };
        } catch (_) { finish(); return Promise.resolve(false); }
        return Promise.resolve(true);
      }

      lastSource[name] = src;
      var begin = function(buffer) {
        if (!buffer || active.indexOf(entry) < 0 || !isEnabled()) { finish(); return false; }
        try {
          var ctx = bus.ctx, t = ctx.currentTime + 0.005;
          var source = ctx.createBufferSource();
          source.buffer = buffer;
          source.playbackRate.value = rate;
          source.loop = playOptions.loop === true;
          var gain = ctx.createGain();
          var length = buffer.duration / rate;
          // In: 4 ms, so no file starts with a click. Out: the last stretch
          // glides to silence, so no file ends on a cliff either.
          gain.gain.setValueAtTime(0, t);
          gain.gain.linearRampToValueAtTime(volume, t + 0.004);
          if (!source.loop) {
            var fade = Math.min(0.16, length * 0.3);
            gain.gain.setValueAtTime(volume, t + Math.max(0.005, length - fade));
            gain.gain.linearRampToValueAtTime(0, t + length);
          }
          source.connect(gain);
          gain.connect(dest);
          var send = hasOwn.call(BUS_SENDS, name) ? BUS_SENDS[name] : 0;
          if (send > 0) {
            var sendGain = ctx.createGain();
            sendGain.gain.value = send;
            gain.connect(sendGain);
            sendGain.connect(room);
          }
          source.onended = finish;
          source.start(t);
          entry.voice = { gain: gain, source: source };
          return true;
        } catch (_) { finish(); return false; }
      };
      var ready = bus.buffer(src);
      if (ready !== undefined) return Promise.resolve(begin(ready));
      // Not decoded yet: the first press of a new sound waits for it, but
      // only briefly. A reward heard a second late is worse than none.
      var asked = Date.now();
      return bus.load(src).then(function(buffer) {
        if (Date.now() - asked > 700) { finish(); return false; }
        return begin(buffer);
      });
    }

    // Decode the sounds a session is likely to need before they are needed.
    function preload() {
      if (!bus) return;
      Object.keys(manifest).forEach(function(name) {
        if (SOFT_SOUNDS[name] || name === 'residentChatter') return;
        [].concat(manifest[name]).forEach(function(src) { if (typeof src === 'string') bus.load(src); });
      });
    }

    // Call from a user gesture. A disposable muted clip unlocks mobile playback;
    // it never starts ambience or a loop.
    function prime(name) {
      if (bus) {
        var woke = bus.resume();
        preload();
        return woke;
      }
      var src = chooseSource(name || 'tap');
      if (!src || typeof AudioFactory !== 'function') return Promise.resolve(false);
      var audio = makeAudio(src);
      if (!audio) return Promise.resolve(false);
      try { audio.muted = true; audio.volume = 0; audio.preload = 'auto'; } catch (_) {}
      var result;
      try { result = typeof audio.play === 'function' ? audio.play() : null; }
      catch (_) { return Promise.resolve(false); }
      return Promise.resolve(result).then(function() {
        safePause(audio);
        try { audio.currentTime = 0; } catch (_) {}
        return true;
      }, function() {
        safePause(audio);
        return false;
      });
    }

    function later(name, delay, opts) {
      if (!schedule) return false;
      try {
        schedule(function() { return play(name, opts); }, delay);
        return true;
      } catch (_) { return false; }
    }

    var manager = {
      manifest: manifest,
      play: play,
      prime: prime,
      playedRecently: playedRecently,
      setEnabled: setEnabled,
      isEnabled: isEnabled,
      stopAll: stopAll,
      stop: stop,
      stopFootsteps: stopFootsteps,
      setMood: setMood,
      mood: function() { return mood; },
      campfire: campfire,
      stopCampfire: stopCampfire,
      ambience: ambience,
      birdsong: birdsong,
      loopLevel: loopLevel,
      footstep: function(surface) {
        if(active.some(function(entry){return entry.name.indexOf('footstep')===0;}))return Promise.resolve(false);
        var name=mood==='tense'&&surface!=='wood'?'footstepTense':({wood:'footstepWood',stone:'footstepStone'}[surface]||'footstepGround');
        return play(name,{volume:0.26,busVolume:BUS_VOLUMES.footstep,maxPolyphony:1,cooldown:280,playbackRate:1+(random()*2-1)*0.035});
      },
      createFootsteps: function(){return createFootstepController({enabled:isEnabled,play:function(surface){return manager.footstep(surface);},stop:stopFootsteps});},
      tap: function(opts) { return play('tap', opts); },
      page: function(opts) { return play('page', opts); },
      capture: function(opts) { return play('capture', opts); },
      hit: function(opts) { return play('hit', opts); },
      specialHit: function(opts) { return play('specialHit', opts); },
      defend: function(opts) { return play('defend', opts); },
      victory: function(opts) { return play('victory', opts); },
      defeat: function(opts) { return play('defeat', opts); },
      levelUp: function(opts) { return play('levelUp', opts); },
      questComplete: function(opts) { return play('questComplete', opts); },
      unlock: function(opts) { return play('unlock', opts); },
      coins: function(opts) { return play('coins', opts); },
      build: function(opts) { return play('build', opts); },
      error: function(opts) { return play('error', opts); },
      // A single shared voice channel for village and town taps. No queue:
      // a rapid tap keeps selecting people while the current greeting finishes.
      residentChatter: function() { return play('residentChatter', {volume:0.38, busVolume:BUS_VOLUMES.residentChatter, maxPolyphony:1, cooldown:180}); },
      // The calm bus, when the game has one, for the soundscape and the music.
      bus: bus
    };
    Object.defineProperty(manager, 'enabled', {
      enumerable: true,
      get: isEnabled,
      set: setEnabled
    });
    return manager;
  }

  // Distance measured around a real movement call, never a key or camera pose.
  // Call reset on menus, scene changes, blur and teardown. No timers or save data.
  function createFootstepController(options) {
    var remaining=0.18,idle=0,sinceStep=1;
    function reset(){remaining=0.18;idle=0;options.stop();}
    function update(before,after,dt,surface) {
      if(!before||!after||!Number.isFinite(dt)||dt<=0||dt>0.25||!options.enabled()){reset();return false;}
      sinceStep+=dt;
      var distance=Math.hypot(after.x-before.x,after.z-before.z);
      if(!Number.isFinite(distance)||distance>4*dt+0.03){reset();return false;}
      if(distance<0.00001){idle+=dt;if(idle>0.12)reset();return false;}
      idle=0;remaining-=distance;
      if(remaining>0||sinceStep<0.32)return false;
      remaining+=1.2;sinceStep=0;options.play(surface);return true;
    }
    return {update:update,reset:reset,dispose:reset};
  }

  function musicVolumeForZoom(zoom, options) {
    options = options || {};
    var normalZoom = Number(options.normalZoom);
    var silentZoom = Number(options.silentZoom);
    var maxVolume = Number(options.maxVolume);
    normalZoom = Number.isFinite(normalZoom) ? normalZoom : 16.35;
    silentZoom = Number.isFinite(silentZoom) ? silentZoom : 19.1;
    maxVolume = Number.isFinite(maxVolume) ? Math.max(0, Math.min(1, maxVolume)) : 0.2;
    var currentZoom = Number(zoom);
    if (!Number.isFinite(currentZoom) || currentZoom <= normalZoom) return maxVolume;
    if (currentZoom >= silentZoom || silentZoom <= normalZoom) return 0;
    var closeProgress = (currentZoom - normalZoom) / (silentZoom - normalZoom);
    return maxVolume * (1 - Math.max(0, Math.min(1, closeProgress)));
  }

  // Looping beds are deliberately separate from one-shot SFX. Two persistent
  // HTMLAudioElements overlap near the seam, so music and ambience never snap
  // from the final sample straight back to the opening sample.
  function createMusicManager(options) {
    options = options || {};
    var hasOwn = Object.prototype.hasOwnProperty;
    var AudioFactory = hasOwn.call(options, 'Audio')
      ? options.Audio
      : (options.audioFactory || (root && root.Audio));
    var src = options.src || 'assets/audio/bgm-burbz-quest-v2.mp3';
    var volume = hasOwn.call(options, 'volume') ? Number(options.volume) : 0.2;
    var crossfadeSeconds = hasOwn.call(options, 'crossfadeSeconds')
      ? Number(options.crossfadeSeconds) : 4;
    crossfadeSeconds = Math.max(0.25, Number.isFinite(crossfadeSeconds) ? crossfadeSeconds : 4);
    var fadeStepMs = Math.max(30, Number(options.fadeStepMs) || 80);
    var schedule = typeof options.setTimeout === 'function'
      ? options.setTimeout
      : (root && typeof root.setTimeout === 'function' ? root.setTimeout.bind(root) : null);
    var cancelSchedule = typeof options.clearTimeout === 'function'
      ? options.clearTimeout
      : (root && typeof root.clearTimeout === 'function' ? root.clearTimeout.bind(root) : null);
    var now = typeof options.now === 'function' ? options.now : Date.now;
    var localEnabled = options.enabled !== false;
    var wanted = false;
    var tracks = [];
    var activeIndex = 0;
    // Milliseconds; zero keeps legacy callers immediate. The master envelope
    // multiplies the two seam weights, never changes their relative balance.
    function durationOption(name) {
      var value = Number(options[name]);
      return Number.isFinite(value) ? Math.max(0, value) : 0;
    }
    var fadeInMs = durationOption('fadeInMs');
    var fadeOutMs = durationOption('fadeOutMs');
    var volumeRampMs = durationOption('volumeRampMs');
    // A rest between plays. With a gap the song fades out at its end, stays
    // silent for gapMs, then fades back in from the top instead of looping.
    var gapMs = durationOption('gapMs');
    var outroMs = hasOwn.call(options, 'outroMs') ? durationOption('outroMs') : fadeOutMs;
    var onRest = typeof options.onRest === 'function' ? options.onRest : null;
    // route(track) may hand back a GainNode that carries the track instead
    // of its own volume (the calm bus does this: iPhones ignore .volume).
    var route = typeof options.route === 'function' ? options.route : null;
    var outputs = [];
    var resting = false;
    var outro = false;
    var restTimer = null;
    var fadeTimer = null;
    var timerTicket = null;
    var gain = 0;
    var ramp = null;
    var seam = null;
    var playing = [false, false];
    var pending = [null, null];
    var primed = [false, false];
    var listeners = [];
    var epoch = 0;
    var resumePromise = null;
    var destroyed = false;
    var suppressed = Object.create(null);

    function isEnabled() {
      if (destroyed || !localEnabled) return false;
      if (typeof options.getEnabled === 'function') {
        try { return !!options.getEnabled(); } catch (_) { return false; }
      }
      return true;
    }

    function isSuppressed() {
      return Object.keys(suppressed).length > 0;
    }

    function targetVolume() {
      return Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.2));
    }

    function makeOneAudio() {
      if (typeof AudioFactory !== 'function') return null;
      var audio = null;
      try { audio = new AudioFactory(src); }
      catch (_) {
        try { audio = AudioFactory(src); } catch (_) { audio = null; }
      }
      if (!audio) return null;
      // Native looping is a fallback if a browser throttles the crossfade
      // timer. Under normal playback the outgoing deck is paused first.
      try { audio.loop = !gapMs; } catch (_) {}
      try { audio.preload = 'auto'; } catch (_) {}
      try { audio.volume = 0; } catch (_) {}
      var output = null;
      if (route) { try { output = route(audio) || null; } catch (_) { output = null; } }
      outputs.push(output);
      return audio;
    }

    function makeTracks() {
      if (tracks.length) return tracks;
      var first = makeOneAudio();
      if (!first) return tracks;
      // A song that rests between plays needs only one deck.
      var second = gapMs ? null : makeOneAudio();
      tracks = second ? [first, second] : [first];
      tracks.forEach(function(track, index) {
        var inspect = function() { gapMs ? maybeOutro(index) : maybeCrossfade(index); };
        listeners[index] = inspect;
        try {
          if (typeof track.addEventListener === 'function') {
            track.addEventListener('timeupdate', inspect);
            track.addEventListener('loadedmetadata', inspect);
            if (gapMs) track.addEventListener('ended', function() { beginRest(index); });
          }
        } catch (_) {}
      });
      return tracks;
    }

    function safePause(track) {
      if (!track || typeof track.pause !== 'function') return;
      try { track.pause(); } catch (_) {}
    }

    function clock() {
      try { var value = Number(now()); return Number.isFinite(value) ? value : 0; }
      catch (_) { return 0; }
    }

    function shouldPlay() { return !destroyed && wanted && isEnabled() && !isSuppressed(); }

    function setOutput(index, level) {
      var output = outputs[index];
      if (!output) return false;
      try {
        var param = output.gain, t = output.context ? output.context.currentTime : 0;
        param.cancelScheduledValues(t);
        param.setTargetAtTime(level, t, 0.05);
      } catch (_) { try { output.gain.value = level; } catch (_) {} }
      return true;
    }

    function silenceTrack(track) {
      // Muting as well as pausing protects against a late browser play resolve.
      var index = tracks.indexOf(track);
      if (index >= 0) setOutput(index, 0);
      try { track.volume = 0; track.muted = true; } catch (_) {}
      safePause(track);
    }

    function clearFadeTimer() {
      timerTicket = null;
      if (fadeTimer !== null && cancelSchedule) {
        try { cancelSchedule(fadeTimer); } catch (_) {}
      }
      fadeTimer = null;
    }

    function renderGain() {
      tracks.forEach(function(track, index) {
        var weight = seam ? (index === seam.from ? 1 - seam.progress : seam.progress)
          : (index === activeIndex ? 1 : 0);
        var level = playing[index] ? gain * weight : 0;
        try {
          // A routed track plays at full element volume; its gain node rides.
          track.volume = setOutput(index, level) ? (playing[index] ? 1 : 0) : level;
          track.muted = !playing[index];
        } catch (_) {}
      });
    }

    function silenceAll() {
      clearFadeTimer();
      if (seam && seam.progress >= 0.5) activeIndex = seam.to;
      seam = null;
      ramp = null;
      gain = 0;
      tracks.forEach(function(track, index) {
        silenceTrack(track);
        playing[index] = false;
        if (index !== activeIndex) { try { track.currentTime = 0; } catch (_) {} }
      });
    }

    function sample() {
      var timestamp = clock();
      if (ramp) {
        var progress = Math.max(0, Math.min(1, (timestamp - ramp.at) / ramp.ms));
        gain = ramp.from + (ramp.to - ramp.from) * progress;
        if (progress >= 1) { gain = ramp.to; ramp = null; }
      }
      if (seam) {
        seam.progress = Math.max(0, Math.min(1, (timestamp - seam.at) / (crossfadeSeconds * 1000)));
        if (seam.progress >= 1) {
          silenceTrack(tracks[seam.from]);
          playing[seam.from] = false;
          try { tracks[seam.from].currentTime = 0; } catch (_) {}
          activeIndex = seam.to;
          seam = null;
        }
      }
      renderGain();
      if (!ramp && gain === 0 && !shouldPlay()) silenceAll();
    }

    function scheduleStep() {
      if (fadeTimer !== null || !schedule || (!ramp && !seam)) return;
      var ticket = {};
      timerTicket = ticket;
      fadeTimer = schedule(function() {
        if (timerTicket !== ticket) return;
        fadeTimer = null;
        timerTicket = null;
        if (destroyed || isSuppressed()) { stopPlayback(true); return; }
        if (!shouldPlay() && (!ramp || ramp.to !== 0)) { stopPlayback(false); return; }
        sample();
        scheduleStep();
      }, fadeStepMs);
    }

    function rampTo(target, ms) {
      sample();
      if (ramp && ramp.to === target) return;
      if (gain === target) { ramp = null; }
      else if (ms > 0 && schedule) ramp = {from: gain, to: target, at: clock(), ms: ms};
      else { gain = target; ramp = null; }
      renderGain();
      if (!ramp && gain === 0 && !shouldPlay()) silenceAll();
      if (!ramp && !seam) clearFadeTimer();
      scheduleStep();
    }

    function stopPlayback(immediate) {
      epoch++;
      resumePromise = null;
      pending.forEach(function(job, index) {
        if (!job) return;
        job.valid = false;
        silenceTrack(job.track);
        playing[index] = false;
      });
      if (immediate || !playing.some(Boolean)) silenceAll();
      else rampTo(0, fadeOutMs);
    }

    // One unresolved play per deck. Cancelled requests retain their reservation
    // until settlement, so an old promise can never pause a newer use of a deck.
    function playDeck(index, kind) {
      if (pending[index]) return pending[index].promise;
      var track = tracks[index];
      if (!track || typeof track.play !== 'function') return Promise.resolve(false);
      var job = {track: track, kind: kind, valid: true, promise: null};
      pending[index] = job;
      try { track.volume = 0; track.muted = kind === 'prime'; } catch (_) {}
      var result;
      try { result = track.play(); }
      catch (_) { result = Promise.reject(_); }
      job.promise = Promise.resolve(result).then(function() {
        pending[index] = null;
        if (!job.valid || destroyed || isSuppressed() || !isEnabled()) {
          silenceTrack(track);
          return false;
        }
        primed[index] = true;
        if (job.kind === 'prime' && !(shouldPlay() && index === activeIndex)) {
          silenceTrack(track);
          try { track.currentTime = 0; } catch (_) {}
          return true;
        }
        if (!shouldPlay()) { silenceTrack(track); return false; }
        playing[index] = true;
        if (job.kind === 'seam') {
          seam = {from: activeIndex, to: index, at: clock(), progress: 0};
          renderGain();
          scheduleStep();
        } else rampTo(targetVolume(), fadeInMs);
        return true;
      }, function() {
        pending[index] = null;
        silenceTrack(track);
        return false;
      });
      return job.promise;
    }

    function maybeCrossfade(index) {
      var toIndex = activeIndex === 0 ? 1 : 0;
      if (index !== activeIndex || !playing[index] || seam || pending[toIndex] ||
          tracks.length < 2 || !schedule || !shouldPlay()) return false;
      var track = tracks[index];
      var duration = Number(track && track.duration);
      var currentTime = Number(track && track.currentTime);
      if (!Number.isFinite(duration) || duration <= crossfadeSeconds ||
          !Number.isFinite(currentTime) || duration - currentTime > crossfadeSeconds) return false;
      try { tracks[toIndex].currentTime = 0; } catch (_) {}
      playDeck(toIndex, 'seam');
      return true;
    }

    function setResting(value) {
      if (resting === value) return;
      resting = value;
      if (onRest) { try { onRest(value); } catch (_) {} }
    }

    // Start the fade a little before the last note so the song ends in silence.
    function maybeOutro(index) {
      if (outro || index !== activeIndex || !playing[index] || !shouldPlay()) return false;
      var track = tracks[index];
      var duration = Number(track && track.duration);
      var currentTime = Number(track && track.currentTime);
      if (!Number.isFinite(duration) || !Number.isFinite(currentTime)) return false;
      var left = (duration - currentTime) * 1000;
      if (left > outroMs) return false;
      outro = true;
      rampTo(0, Math.max(0, left - 150));
      return true;
    }

    function beginRest(index) {
      if (index !== activeIndex || destroyed) return;
      outro = false;
      silenceTrack(tracks[index]);
      playing[index] = false;
      ramp = null;
      gain = 0;
      try { tracks[index].currentTime = 0; } catch (_) {}
      setResting(true);
      if (restTimer !== null && cancelSchedule) { try { cancelSchedule(restTimer); } catch (_) {} }
      restTimer = schedule ? schedule(function() {
        restTimer = null;
        setResting(false);
        sync();
      }, gapMs) : null;
      if (restTimer === null) setResting(false);
    }

    function sync() {
      if (resting && !destroyed) {
        if (!shouldPlay()) stopPlayback(isSuppressed());
        return Promise.resolve(false);
      }
      if (!shouldPlay()) {
        stopPlayback(destroyed || isSuppressed());
        return Promise.resolve(false);
      }
      makeTracks();
      if (!tracks[activeIndex]) return Promise.resolve(false);
      if (playing[activeIndex]) {
        rampTo(targetVolume(), fadeInMs);
        return Promise.resolve(true);
      }
      var job = pending[activeIndex];
      if (job && !job.valid) {
        if (!resumePromise) {
          var ticket = epoch;
          resumePromise = job.promise.then(function() {
            if (ticket !== epoch || !shouldPlay()) return false;
            resumePromise = null;
            return sync();
          });
        }
        return resumePromise;
      }
      return playDeck(activeIndex, 'start');
    }

    function start() {
      if (destroyed) return Promise.resolve(false);
      wanted = true;
      return sync();
    }

    // Normal pauses use the exit envelope; safety callers can opt out explicitly.
    function pause(pauseOptions) {
      wanted = false;
      stopPlayback(destroyed || isSuppressed() || !!(pauseOptions && pauseOptions.immediate));
      return false;
    }

    // Call in a real gesture. Pending primes can be adopted by start(), and a
    // later prime never mutes or pauses decks already owned by live playback.
    function prime() {
      if (destroyed || isSuppressed() || !isEnabled()) return Promise.resolve(false);
      var available = makeTracks();
      var ticket = epoch;
      return Promise.all(available.map(function(track, index) {
        if (pending[index]) return pending[index].promise;
        if (playing[index] || primed[index]) return Promise.resolve(true);
        return playDeck(index, 'prime');
      })).then(function(results) {
        return ticket === epoch && !destroyed && !isSuppressed() && isEnabled() && results.length === 2 && results.every(Boolean);
      });
    }

    function setEnabled(value) {
      localEnabled = !!value;
      return sync();
    }

    function setSuppressed(reason, value) {
      reason = String(reason || 'unspecified');
      if (value) suppressed[reason] = true;
      else delete suppressed[reason];
      return sync();
    }

    function setVolume(value) {
      var next = Number(value);
      if (Number.isFinite(next)) volume = Math.max(0, Math.min(1, next));
      if (shouldPlay() && playing[activeIndex] && !outro) rampTo(targetVolume(), volumeRampMs);
      return volume;
    }

    function destroy() {
      wanted = false;
      destroyed = true;
      if (restTimer !== null && cancelSchedule) { try { cancelSchedule(restTimer); } catch (_) {} }
      restTimer = null;
      stopPlayback(true);
      tracks.forEach(function(track, index) {
        if (typeof track.removeEventListener !== 'function') return;
        try {
          track.removeEventListener('timeupdate', listeners[index]);
          track.removeEventListener('loadedmetadata', listeners[index]);
        } catch (_) {}
      });
      tracks = [];
      listeners = [];
      outputs = [];
      suppressed = Object.create(null);
    }

    return {
      src: src,
      start: start,
      pause: pause,
      prime: prime,
      sync: sync,
      setEnabled: setEnabled,
      setSuppressed: setSuppressed,
      setVolume: setVolume,
      destroy: destroy,
      isEnabled: isEnabled,
      isSuppressed: isSuppressed,
      getAudio: function() { return tracks[activeIndex] || null; },
      getAudios: function() { return tracks.slice(); },
      get volume() { return targetVolume(); },
      get wanted() { return wanted; },
      get resting() { return resting; }
    };
  }

  return {
    DEFAULT_SOUND_MANIFEST: DEFAULT_SOUND_MANIFEST,
    createAudioManager: createAudioManager,
    createFootstepController: createFootstepController,
    createMusicManager: createMusicManager,
    musicVolumeForZoom: musicVolumeForZoom,
    classifyInteraction: classifyInteraction,
    createBus: createBus,
    sharedBus: sharedBus,
    SOFT_SOUNDS: SOFT_SOUNDS,
    BUS_VOLUMES: BUS_VOLUMES
  };
});
