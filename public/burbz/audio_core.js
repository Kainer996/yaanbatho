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
    tap: 'assets/audio/ui-lock.mp3',
    page: 'assets/audio/ui-book.mp3',
    capture: 'assets/audio/ui-lock.mp3',
    hit: 'assets/audio/ui-metal.mp3',
    specialHit: 'assets/audio/ui-spell.mp3',
    defend: 'assets/audio/ui-metal.mp3',
    victory: 'assets/audio/reward-level-up.mp3',
    defeat: 'assets/audio/ui-book.mp3',
    levelUp: 'assets/audio/reward-level-up.mp3',
    questComplete: 'assets/audio/reward-level-up.mp3',
    unlock: 'assets/audio/ui-lock.mp3',
    coins: 'assets/audio/ui-coins.mp3',
    build: 'assets/audio/ui-wood.mp3',
    bird: 'assets/audio/bird-blackbird.mp3',
    owl: 'assets/audio/bird-tawny-owl.mp3',
    error: 'assets/audio/ui-metal.mp3'
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
    bird: 500,
    owl: 800,
    error: 180
  });

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
    if (/\b(owl|night)\b/.test(text)) return 'owl';
    if (/\b(bird|capture|discover|scan)\b/.test(text)) return 'bird';
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
      capture: function(opts) { var result = play('capture', opts); later('bird', 80, opts); return result; },
      hit: function(opts) { return play('hit', opts); },
      specialHit: function(opts) { return play('specialHit', opts); },
      defend: function(opts) { return play('defend', opts); },
      victory: function(opts) { var result = play('victory', opts); later('coins', 140, opts); return result; },
      defeat: function(opts) { return play('defeat', opts); },
      levelUp: function(opts) { var result = play('levelUp', opts); later('specialHit', 110, opts); return result; },
      questComplete: function(opts) { var result = play('questComplete', opts); later('coins', 140, opts); return result; },
      unlock: function(opts) { return play('unlock', opts); },
      coins: function(opts) { return play('coins', opts); },
      build: function(opts) { return play('build', opts); },
      bird: function(opts) { return play('bird', opts); },
      owl: function(opts) { return play('owl', opts); },
      error: function(opts) { return play('error', opts); }
    };
    Object.defineProperty(manager, 'enabled', {
      enumerable: true,
      get: isEnabled,
      set: setEnabled
    });
    return manager;
  }

  // Background music is deliberately separate from the one-shot SFX manager:
  // it owns one persistent HTMLAudioElement, never consumes the SFX polyphony
  // budget, and keeps its playback position while gameplay is temporarily
  // suppressed (intro video, microphone listening, or a hidden page).
  function createMusicManager(options) {
    options = options || {};
    var hasOwn = Object.prototype.hasOwnProperty;
    var AudioFactory = hasOwn.call(options, 'Audio')
      ? options.Audio
      : (options.audioFactory || (root && root.Audio));
    var src = options.src || 'assets/audio/bgm-birbs-quest.mp3';
    var volume = hasOwn.call(options, 'volume') ? Number(options.volume) : 0.2;
    var localEnabled = options.enabled !== false;
    var wanted = false;
    var audio = null;
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

    function makeAudio() {
      if (audio) return audio;
      if (typeof AudioFactory !== 'function') return null;
      try {
        audio = new AudioFactory(src);
      } catch (_) {
        try { audio = AudioFactory(src); } catch (_) { audio = null; }
      }
      if (!audio) return null;
      try { audio.loop = true; } catch (_) {}
      try { audio.preload = 'auto'; } catch (_) {}
      try { audio.volume = Math.max(0, Math.min(1, Number.isFinite(volume) ? volume : 0.2)); } catch (_) {}
      return audio;
    }

    function safePause() {
      if (!audio || typeof audio.pause !== 'function') return;
      try { audio.pause(); } catch (_) {}
    }

    function sync() {
      if (!wanted || !isEnabled() || isSuppressed()) {
        safePause();
        return Promise.resolve(false);
      }
      var track = makeAudio();
      if (!track || typeof track.play !== 'function') return Promise.resolve(false);
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
      safePause();
      return false;
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
      if (audio) {
        try { audio.volume = volume; } catch (_) {}
      }
      return volume;
    }

    function destroy() {
      wanted = false;
      safePause();
      audio = null;
      suppressed = Object.create(null);
    }

    return {
      src: src,
      start: start,
      pause: pause,
      sync: sync,
      setEnabled: setEnabled,
      setSuppressed: setSuppressed,
      setVolume: setVolume,
      destroy: destroy,
      isEnabled: isEnabled,
      isSuppressed: isSuppressed,
      getAudio: function() { return audio; },
      get wanted() { return wanted; }
    };
  }

  return {
    DEFAULT_SOUND_MANIFEST: DEFAULT_SOUND_MANIFEST,
    createAudioManager: createAudioManager,
    createMusicManager: createMusicManager,
    classifyInteraction: classifyInteraction
  };
});
