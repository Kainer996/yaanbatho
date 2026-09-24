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
    campfire: 0.5
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

  function createAudioManager(options) {
    options = options || {};
    var hasOwn = Object.prototype.hasOwnProperty;
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

    function stopAll() {
      active.slice().forEach(function(entry) {
        safePause(entry.audio);
        removeActive(entry);
      });
      stopCampfire();
    }

    // Calm is the default. Tense swaps in the gritty steps and hushes the fire.
    var mood = 'calm';
    function setMood(value) {
      mood = value === 'tense' ? 'tense' : 'calm';
      if (mood === 'tense') campfire(0);
      return mood;
    }

    // One looping campfire bed. Its volume follows how close the player stands.
    var fire = { audio: null, volume: 0, target: 0, timer: false };
    function stopCampfire() {
      fire.target = 0;
      fire.volume = 0;
      if (fire.audio) safePause(fire.audio);
      fire.audio = null;
    }
    function rampCampfire() {
      if (fire.timer || !fire.audio) return;
      var step = function() {
        fire.timer = false;
        if (!fire.audio) return;
        var diff = fire.target - fire.volume;
        fire.volume = Math.abs(diff) <= 0.02 ? fire.target : fire.volume + (diff > 0 ? 0.02 : -0.02);
        try { fire.audio.volume = fire.volume; } catch (_) {}
        if (fire.volume <= 0 && fire.target <= 0) { stopCampfire(); return; }
        if (fire.volume !== fire.target && schedule) { fire.timer = true; schedule(step, 60); }
      };
      step();
    }
    function campfire(level, fireOptions) {
      var value = Math.max(0, Math.min(1, Number(level) || 0));
      if (mood === 'tense' || !isEnabled()) value = 0;
      if (fireOptions && fireOptions.immediate && value === 0) { stopCampfire(); return false; }
      fire.target = value * (Number(volumes.campfire) || 0);
      if (fire.target > 0 && !fire.audio) {
        var src = chooseSource('campfire'), audio = src ? makeAudio(src) : null;
        if (!audio) return false;
        try { audio.loop = true; audio.volume = 0; audio.preload = 'auto'; } catch (_) {}
        fire.audio = audio;
        fire.volume = 0;
        try {
          Promise.resolve(typeof audio.play === 'function' ? audio.play() : null).catch(function() {
            if (fire.audio === audio) stopCampfire();
          });
        } catch (_) { stopCampfire(); return false; }
      }
      rampCampfire();
      return fire.target > 0;
    }
    function stopFootsteps() {
      active.slice().filter(function(entry){return entry.name.indexOf('footstep')===0;}).forEach(function(entry){safePause(entry.audio);removeActive(entry);});
    }
    function stop(name) {
      active.slice().filter(function(entry){return entry.name===name;}).forEach(function(entry){safePause(entry.audio);removeActive(entry);});
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

    // Call from a user gesture. A disposable muted clip unlocks mobile playback;
    // it never starts ambience or a loop.
    function prime(name) {
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
      footstep: function(surface) {
        if(active.some(function(entry){return entry.name.indexOf('footstep')===0;}))return Promise.resolve(false);
        var name=mood==='tense'&&surface!=='wood'?'footstepTense':({wood:'footstepWood',stone:'footstepStone'}[surface]||'footstepGround');
        return play(name,{volume:0.26,maxPolyphony:1,cooldown:280,playbackRate:1+(random()*2-1)*0.035});
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
      residentChatter: function() { return play('residentChatter', {volume:0.38, maxPolyphony:1, cooldown:180}); }
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
      try { audio.loop = true; } catch (_) {}
      try { audio.preload = 'auto'; } catch (_) {}
      try { audio.volume = 0; } catch (_) {}
      return audio;
    }

    function makeTracks() {
      if (tracks.length) return tracks;
      var first = makeOneAudio();
      if (!first) return tracks;
      var second = makeOneAudio();
      tracks = second ? [first, second] : [first];
      tracks.forEach(function(track, index) {
        var inspect = function() { maybeCrossfade(index); };
        listeners[index] = inspect;
        try {
          if (typeof track.addEventListener === 'function') {
            track.addEventListener('timeupdate', inspect);
            track.addEventListener('loadedmetadata', inspect);
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

    function silenceTrack(track) {
      // Muting as well as pausing protects against a late browser play resolve.
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
        try {
          track.volume = playing[index] ? gain * weight : 0;
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

    function sync() {
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
      if (shouldPlay() && playing[activeIndex]) rampTo(targetVolume(), volumeRampMs);
      return volume;
    }

    function destroy() {
      wanted = false;
      destroyed = true;
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
      get wanted() { return wanted; }
    };
  }

  return {
    DEFAULT_SOUND_MANIFEST: DEFAULT_SOUND_MANIFEST,
    createAudioManager: createAudioManager,
    createFootstepController: createFootstepController,
    createMusicManager: createMusicManager,
    musicVolumeForZoom: musicVolumeForZoom,
    classifyInteraction: classifyInteraction
  };
});
