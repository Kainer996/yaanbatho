// Burbz file-backed sound manager. Standalone UMD module; safe in browsers
// without HTMLAudioElement and in mobile browsers that reject locked playback.
(function(root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (root) root.BurbzAudioCore = api;
  if (root && root.window) root.window.BurbzAudioCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  var DEFAULT_SOUND_MANIFEST = Object.freeze({
    tap: 'assets/audio/sfx-ui-tap.mp3',
    page: 'assets/audio/sfx-page-wing.mp3',
    capture: 'assets/audio/sfx-capture.mp3',
    hit: 'assets/audio/sfx-battle-hit.mp3',
    specialHit: 'assets/audio/sfx-battle-magic.mp3',
    defend: 'assets/audio/sfx-battle-defend.mp3',
    victory: 'assets/audio/sfx-victory.mp3',
    defeat: 'assets/audio/sfx-defeat-error.mp3',
    levelUp: 'assets/audio/sfx-level-up.mp3',
    questComplete: 'assets/audio/sfx-quest-complete.mp3',
    unlock: 'assets/audio/sfx-capture.mp3',
    coins: 'assets/audio/sfx-resource.mp3',
    build: 'assets/audio/sfx-build.mp3',
    error: 'assets/audio/sfx-defeat-error.mp3'
  });

  var DEFAULT_COOLDOWNS = Object.freeze({
    tap: 90,
    page: 140,
    capture: 250,
    hit: 55,
    specialHit: 120,
    defend: 100,
    victory: 500,
    defeat: 500,
    levelUp: 400,
    questComplete: 500,
    unlock: 250,
    coins: 100,
    build: 180,
    error: 180
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

      var volume = hasOwn.call(playOptions, 'volume') ? Number(playOptions.volume) : 1;
      var rate = hasOwn.call(playOptions, 'playbackRate') ? Number(playOptions.playbackRate) : 1;
      try { audio.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 1)); } catch (_) {}
      try { audio.playbackRate = Number.isFinite(rate) && rate > 0 ? rate : 1; } catch (_) {}
      try { audio.preload = 'auto'; } catch (_) {}

      var entry = { name: name, audio: audio };
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
      error: function(opts) { return play('error', opts); }
    };
    Object.defineProperty(manager, 'enabled', {
      enumerable: true,
      get: isEnabled,
      set: setEnabled
    });
    return manager;
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
    var fadeTimer = null;
    var fading = false;
    var fadeStartedAt = 0;
    var fadeProgress = 0;
    var suppressed = Object.create(null);

    function isEnabled() {
      if (!localEnabled) return false;
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
        try {
          if (typeof track.addEventListener === 'function') {
            track.addEventListener('timeupdate', inspect);
            track.addEventListener('loadedmetadata', inspect);
          }
        } catch (_) {}
      });
      try { tracks[activeIndex].volume = targetVolume(); } catch (_) {}
      return tracks;
    }

    function safePause(track) {
      if (!track || typeof track.pause !== 'function') return;
      try { track.pause(); } catch (_) {}
    }

    function clearFadeTimer() {
      if (fadeTimer !== null && cancelSchedule) {
        try { cancelSchedule(fadeTimer); } catch (_) {}
      }
      fadeTimer = null;
    }

    function resetStandby() {
      tracks.forEach(function(track, index) {
        if (index === activeIndex) {
          try { track.muted = false; track.volume = targetVolume(); } catch (_) {}
          return;
        }
        safePause(track);
        try { track.currentTime = 0; track.muted = false; track.volume = 0; } catch (_) {}
      });
    }

    function settleFade() {
      if (!fading) return;
      if (fadeProgress >= 0.5 && tracks.length > 1) activeIndex = activeIndex === 0 ? 1 : 0;
      fading = false;
      fadeProgress = 0;
      clearFadeTimer();
      resetStandby();
    }

    function runFadeStep(fromIndex, toIndex) {
      if (!fading || !schedule || !wanted || !isEnabled() || isSuppressed()) return;
      var elapsed;
      try { elapsed = Math.max(0, Number(now()) - fadeStartedAt); }
      catch (_) { elapsed = 0; }
      fadeProgress = Math.max(0, Math.min(1, elapsed / (crossfadeSeconds * 1000)));
      var level = targetVolume();
      try { tracks[fromIndex].volume = level * (1 - fadeProgress); } catch (_) {}
      try { tracks[toIndex].volume = level * fadeProgress; } catch (_) {}
      if (fadeProgress >= 1) {
        safePause(tracks[fromIndex]);
        try { tracks[fromIndex].currentTime = 0; tracks[fromIndex].volume = 0; } catch (_) {}
        activeIndex = toIndex;
        fading = false;
        fadeProgress = 0;
        fadeTimer = null;
        return;
      }
      fadeTimer = schedule(function() { runFadeStep(fromIndex, toIndex); }, fadeStepMs);
    }

    function startCrossfade() {
      if (fading || tracks.length < 2 || !schedule) return false;
      var fromIndex = activeIndex;
      var toIndex = fromIndex === 0 ? 1 : 0;
      var incoming = tracks[toIndex];
      try {
        incoming.currentTime = 0;
        incoming.muted = false;
        incoming.volume = 0;
      } catch (_) {}
      var playResult;
      try { playResult = incoming.play(); }
      catch (_) { return false; }
      Promise.resolve(playResult).then(function() {
        if (!wanted || !isEnabled() || isSuppressed()) {
          safePause(incoming);
          return;
        }
        fading = true;
        fadeProgress = 0;
        try { fadeStartedAt = Number(now()); } catch (_) { fadeStartedAt = 0; }
        runFadeStep(fromIndex, toIndex);
      }, function() { safePause(incoming); });
      return true;
    }

    function maybeCrossfade(index) {
      if (index !== activeIndex || fading || tracks.length < 2 ||
          !wanted || !isEnabled() || isSuppressed()) return false;
      var track = tracks[index];
      var duration = Number(track && track.duration);
      var currentTime = Number(track && track.currentTime);
      if (!Number.isFinite(duration) || duration <= crossfadeSeconds ||
          !Number.isFinite(currentTime)) return false;
      if (duration - currentTime > crossfadeSeconds) return false;
      return startCrossfade();
    }

    function sync() {
      if (!wanted || !isEnabled() || isSuppressed()) {
        settleFade();
        tracks.forEach(safePause);
        return Promise.resolve(false);
      }
      var available = makeTracks();
      var track = available[activeIndex];
      if (!track || typeof track.play !== 'function') return Promise.resolve(false);
      resetStandby();
      var result;
      try { result = track.play(); }
      catch (_) { return Promise.resolve(false); }
      return Promise.resolve(result).then(function() { return true; }, function() { return false; });
    }

    function start() {
      wanted = true;
      return sync();
    }

    function pause() {
      wanted = false;
      settleFade();
      tracks.forEach(safePause);
      return false;
    }

    // Prime both decks inside the first real gesture. This makes the later
    // crossfade and Empire ambience reliable on stricter mobile browsers.
    function prime() {
      var available = makeTracks();
      if (!available.length) return Promise.resolve(false);
      return Promise.all(available.map(function(track) {
        var wasMuted = !!track.muted;
        var oldVolume = Number(track.volume);
        try { track.muted = true; track.volume = 0; } catch (_) {}
        var result;
        try { result = track.play(); }
        catch (_) { return Promise.resolve(false); }
        return Promise.resolve(result).then(function() {
          safePause(track);
          try {
            track.currentTime = 0;
            track.muted = wasMuted;
            track.volume = Number.isFinite(oldVolume) ? oldVolume : 0;
          } catch (_) {}
          return true;
        }, function() {
          safePause(track);
          return false;
        });
      })).then(function(results) { resetStandby(); return results.some(Boolean); });
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
      if (!fading) resetStandby();
      return volume;
    }

    function destroy() {
      wanted = false;
      settleFade();
      tracks.forEach(safePause);
      tracks = [];
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
    createMusicManager: createMusicManager,
    musicVolumeForZoom: musicVolumeForZoom,
    classifyInteraction: classifyInteraction
  };
});
