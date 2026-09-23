const test = require('node:test');
const assert = require('node:assert/strict');
const {createMusicManager} = require('../audio_core.js');

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function fixture(options = {}) {
  let time = 0, id = 0, maxTimers = 0;
  const timers = new Map(), instances = [];
  class Audio {
    constructor(src) {
      Object.assign(this, {src, volume: 1, muted: false, paused: true, currentTime: 0,
        duration: 20, playCalls: 0, deferred: false, reject: false, queue: [], listeners: {}});
      instances.push(this);
    }
    addEventListener(name, callback) { (this.listeners[name] ||= []).push(callback); }
    removeEventListener(name, callback) { this.listeners[name] = (this.listeners[name] || []).filter(f => f !== callback); }
    emit(name = 'timeupdate') { (this.listeners[name] || []).forEach(f => f()); }
    play() {
      this.playCalls++;
      if (this.reject) return Promise.reject(new Error('blocked'));
      this.paused = false;
      if (!this.deferred) return Promise.resolve();
      return new Promise((resolve, reject) => this.queue.push({
        resolve: () => { this.paused = false; resolve(); }, reject
      }));
    }
    pause() { this.paused = true; }
    resolve() { this.queue.shift().resolve(); }
    fail() { this.queue.shift().reject(new Error('blocked')); }
  }
  const manager = createMusicManager({Audio, volume: 0.4, fadeInMs: 1000, fadeOutMs: 1000,
    volumeRampMs: 1000, crossfadeSeconds: 4, fadeStepMs: 50, now: () => time,
    setTimeout: (callback, ms) => {
      timers.set(++id, {callback, at: time + ms});
      maxTimers = Math.max(maxTimers, timers.size);
      assert.ok(timers.size <= 1, 'one shared envelope/seam timer');
      return id;
    }, clearTimeout: id => timers.delete(id), ...options});
  function tick(ms) {
    const end = time + ms;
    for (;;) {
      const next = [...timers].sort((a,b) => a[1].at - b[1].at)[0];
      if (!next || next[1].at > end) break;
      time = next[1].at; timers.delete(next[0]); next[1].callback();
    }
    time = end;
  }
  return {manager, instances, timers, tick, Audio, get maxTimers() { return maxTimers; }};
}
const level = f => f.instances.reduce((sum,a) => sum + (a.paused || a.muted ? 0 : a.volume), 0);
function silent(f) {
  assert.ok(f.instances.every(a => a.paused && a.volume === 0), 'all decks paused at zero');
  assert.equal(f.timers.size, 0, 'no remaining timers');
}
async function ready(f) { assert.equal(await f.manager.start(), true); f.tick(1000); near(level(f), 0.4); }
async function seam(f) { f.manager.getAudio().currentTime = 16; f.manager.getAudio().emit(); await flush(); }

test('entrance reaches start, midpoint and endpoint without repeated sync restarting it', async () => {
  const f = fixture(); await f.manager.start(); near(level(f), 0);
  f.tick(500); near(level(f), 0.2);
  for (let i = 0; i < 20; i++) { await f.manager.start(); await f.manager.sync(); f.manager.setVolume(0.4); }
  near(level(f), 0.2); assert.equal(f.instances[0].playCalls, 1);
  f.tick(500); near(level(f), 0.4); assert.equal(f.timers.size, 0);
});
test('pause fades then pauses; restart resumes existing position with a new entrance', async () => {
  const f = fixture(); await ready(f); f.instances[0].currentTime = 7;
  assert.equal(f.manager.pause(), false); near(level(f), 0.4);
  f.tick(500); near(level(f), 0.2); f.manager.pause(); await f.manager.sync();
  f.tick(500); silent(f); assert.equal(f.instances[0].currentTime, 7);
  await f.manager.start(); near(level(f), 0); f.tick(500); near(level(f), 0.2);
});
test('entrance and exit reversals continue from the audible gain without replay', async () => {
  const f = fixture(); await f.manager.start(); f.tick(500); near(level(f), 0.2);
  f.manager.pause(); near(level(f), 0.2); f.tick(500); near(level(f), 0.1);
  await f.manager.start(); near(level(f), 0.1); f.tick(500); near(level(f), 0.25);
  f.tick(500); near(level(f), 0.4); assert.equal(f.instances[0].playCalls, 1);
});
test('volume ramps and reversals do not jump or reset on repeated targets', async () => {
  const f = fixture(); await ready(f); f.manager.setVolume(0.2); near(level(f), 0.4);
  f.tick(500); near(level(f), 0.3); f.manager.setVolume(0.2);
  f.tick(500); near(level(f), 0.2); f.manager.setVolume(0.6);
  f.tick(500); near(level(f), 0.4); f.manager.setVolume(0.2); near(level(f), 0.4);
  f.tick(500); near(level(f), 0.3); f.tick(500); near(level(f), 0.2);
  assert.equal(f.instances[0].playCalls, 1);
});
test('volume ramps compose with unchanged linear two-deck seam weights', async () => {
  const f = fixture(); await ready(f); await seam(f); f.tick(1000);
  near(f.instances[0].volume, 0.3); near(f.instances[1].volume, 0.1);
  f.manager.setVolume(0.2); near(level(f), 0.4); await f.manager.sync();
  f.tick(500); near(level(f), 0.3); near(f.instances[1].volume, 0.3 * 0.375);
  f.tick(500); near(f.instances[0].volume, 0.1); near(f.instances[1].volume, 0.1);
  f.tick(2000); near(level(f), 0.2); assert.equal(f.manager.getAudio(), f.instances[1]);
  assert.equal(f.instances[0].paused, true); assert.equal(f.instances.length, 2);
});
test('pause and reversal during seam preserve both weights until silent', async () => {
  const f = fixture(); await ready(f); await seam(f); f.tick(1000);
  const before = f.instances.map(a => a.volume); f.manager.pause();
  assert.deepEqual(f.instances.map(a => a.volume), before);
  f.tick(500); near(level(f), 0.2); await f.manager.start(); near(level(f), 0.2);
  f.tick(500); near(level(f), 0.3); assert.equal(f.instances[1].playCalls, 1);
  f.manager.pause(); f.tick(1000); silent(f); await f.manager.start(); f.tick(1000); near(level(f), 0.4);
});
test('pending seam reserves the incoming deck against timeupdate storms', async () => {
  const f = fixture(); await ready(f); f.instances[1].deferred = true;
  for (let i=0; i<30; i++) { f.instances[0].currentTime = 16; f.instances[0].emit(); await f.manager.sync(); }
  assert.equal(f.instances[1].playCalls, 1); assert.equal(f.instances[0].playCalls, 1);
  f.tick(2000); near(level(f), 0.4); f.instances[1].resolve(); await flush();
  f.tick(2000); near(f.instances[0].volume, 0.2); near(f.instances[1].volume, 0.2);
});
test('a delayed entrance waits for playback and repeated starts share one request', async () => {
  const f = fixture();
  // Allocate silently through prime, then defer a later entrance.
  await f.manager.prime(); f.instances[0].deferred = true;
  const first = f.manager.start(), second = f.manager.start();
  f.tick(2000); near(level(f), 0); assert.equal(f.instances[0].playCalls, 2);
  f.instances[0].resolve(); assert.equal(await first, true); assert.equal(await second, true);
  near(level(f), 0); f.tick(500); near(level(f), 0.2);
});
test('rejected or throwing starts stay silent and can be explicitly retried', async () => {
  for (const throwing of [false, true]) {
    const f = fixture(); await f.manager.prime(); const a = f.instances[0], original = a.play;
    if (throwing) a.play = () => { throw new Error('blocked'); }; else a.reject = true;
    assert.equal(await f.manager.start(), false); silent(f);
    a.play = original; a.reject = false; await ready(f);
  }
});
test('rejected seam leaves outgoing music intact and permits a later retry', async () => {
  const f = fixture(); await ready(f); f.instances[1].reject = true; await seam(f);
  near(level(f), 0.4); assert.equal(f.instances[1].paused, true);
  f.instances[1].reject = false; await seam(f); f.tick(2000); near(f.instances[1].volume, 0.2);
});
test('prime then start adopts the same pending play without late pause or gain restoration', async () => {
  const f = fixture();
  const play = f.Audio.prototype.play;
  f.Audio.prototype.play = function() { this.deferred = true; return play.call(this); };
  const prime = f.manager.prime(), start = f.manager.start(), primeAgain = f.manager.prime();
  assert.equal(f.instances[0].playCalls, 1); assert.equal(f.instances[1].playCalls, 1);
  near(level(f), 0); f.instances[0].resolve(); await flush(); f.tick(500); near(level(f), 0.2);
  f.instances[1].resolve(); await prime; await start; await primeAgain; near(level(f), 0.2);
  assert.equal(f.instances[0].paused, false); assert.equal(f.instances[1].paused, true);
  await f.manager.prime(); near(level(f), 0.2); assert.equal(f.instances[0].playCalls, 1);
});
for (const reason of ['hidden', 'scanner', 'intro']) {
  test(`${reason} suppression instantly cancels envelopes and pending seam playback`, async () => {
    const f = fixture(); await ready(f); f.instances[1].deferred = true; await seam(f);
    const staleTimers = [...f.timers.values()].map(t => t.callback);
    await f.manager.setSuppressed(reason, true); silent(f);
    f.instances[1].resolve(); await flush(); staleTimers.forEach(fn => fn());
    f.manager.setVolume(0.7); await f.manager.start(); await f.manager.prime(); silent(f);
    await f.manager.setSuppressed(reason, false); near(level(f), 0); f.tick(1000); near(level(f), 0.7);
  });
}
test('overlapping suppression reasons require all owners to release', async () => {
  const f = fixture(); await ready(f); await f.manager.setSuppressed('hidden', true);
  await f.manager.setSuppressed('scanner', true); await f.manager.setSuppressed('hidden', false); silent(f);
  await f.manager.setSuppressed('scanner', false); f.tick(1000); near(level(f), 0.4);
});
test('user disable fades and cancels pending starts; re-enable reverses smoothly', async () => {
  const f = fixture(); await ready(f); await f.manager.setEnabled(false); near(level(f), 0.4);
  f.tick(500); near(level(f), 0.2); await f.manager.setEnabled(true); near(level(f), 0.2);
  f.tick(1000); near(level(f), 0.4); await f.manager.setEnabled(false); f.tick(1000); silent(f);
  f.manager.setVolume(0.8); await f.manager.sync(); silent(f);
});
for (const action of ['pause', 'disable', 'hidden', 'destroy', 'immediate']) {
  test(`${action} invalidates delayed entrance and cannot resurrect`, async () => {
    const f = fixture(); await f.manager.prime(); f.instances[0].deferred = true;
    const start = f.manager.start();
    if (action === 'disable') f.manager.setEnabled(false);
    else if (action === 'hidden') f.manager.setSuppressed('hidden', true);
    else if (action === 'destroy') f.manager.destroy();
    else f.manager.pause(action === 'immediate' ? {immediate: true} : undefined);
    f.instances[0].resolve(); assert.equal(await start, false); await flush(); f.tick(5000); silent(f);
    if (action === 'destroy') {
      assert.equal(await f.manager.start(), false); assert.equal(await f.manager.prime(), false);
      assert.equal(await f.manager.sync(), false); assert.equal(f.manager.getAudios().length, 0);
      assert.equal(f.instances.length, 2);
    }
  });
}
test('immediate stop clears live timers and stale callbacks cannot touch restarted playback', async () => {
  const f = fixture(); await f.manager.start(); f.tick(250);
  const callbacks = [...f.timers.values()].map(t => t.callback);
  f.manager.pause({immediate:true}); silent(f); await f.manager.start(); f.tick(250); near(level(f), 0.1);
  callbacks.forEach(fn => fn()); near(level(f), 0.1); f.tick(750); near(level(f), 0.4);
});
test('cancelled play resolves before a restart reuses its deck', async () => {
  const f = fixture(); await f.manager.prime(); f.instances[0].deferred = true;
  const old = f.manager.start(); f.manager.pause({immediate:true}); const next = f.manager.start();
  assert.equal(f.instances[0].playCalls, 2); f.instances[0].deferred = false;
  f.instances[0].resolve(); assert.equal(await old, false); assert.equal(await next, true);
  f.tick(1000); near(level(f), 0.4); assert.equal(f.instances[0].playCalls, 3);
});
test('prime aggregate is invalidated if teardown occurs between deck resolutions', async () => {
  const f = fixture(); const play = f.Audio.prototype.play;
  f.Audio.prototype.play = function() { this.deferred = true; return play.call(this); };
  const prime = f.manager.prime(); f.instances[0].resolve(); await flush();
  f.manager.destroy(); silent(f); f.instances[1].resolve();
  assert.equal(await prime, false); silent(f);
});
for (const stage of ['entrance', 'seam', 'exit']) {
  for (const action of ['hidden', 'destroy']) {
    test(`${action} synchronously silences an active ${stage} and invalidates its timer`, async () => {
      const f = fixture(); await f.manager.start();
      if (stage !== 'entrance') { f.tick(1000); await seam(f); }
      if (stage === 'exit') f.manager.pause();
      f.tick(250); assert.ok(level(f) > 0);
      const callbacks = [...f.timers.values()].map(t => t.callback);
      assert.equal(callbacks.length, 1);
      if (action === 'hidden') f.manager.setSuppressed('hidden', true); else f.manager.destroy();
      silent(f); callbacks.forEach(fn => fn()); f.tick(5000); silent(f);
      f.instances.forEach(a => a.emit()); await flush(); silent(f);
    });
  }
}
test('prime during a pending start does not interrupt it', async () => {
  const f = fixture(); const play = f.Audio.prototype.play;
  f.Audio.prototype.play = function() { this.deferred = true; return play.call(this); };
  const start = f.manager.start(), prime = f.manager.prime();
  assert.equal(f.instances[0].playCalls, 1); assert.equal(f.instances[1].playCalls, 1);
  f.instances[1].resolve(); await flush(); near(level(f), 0);
  f.instances[0].resolve(); assert.equal(await start, true); assert.equal(await prime, true);
  f.tick(1000); near(level(f), 0.4); assert.equal(f.instances[0].paused, false);
});
test('zero-volume ramp, later recovery, and volume changes during exit never replay', async () => {
  const f = fixture(); await ready(f); f.manager.setVolume(0); f.tick(500); near(level(f), 0.2);
  f.tick(500); near(level(f), 0); await f.manager.sync(); assert.equal(f.timers.size, 0);
  f.manager.setVolume(0.4); f.tick(500); near(level(f), 0.2); f.manager.pause();
  f.manager.setVolume(0.8); f.tick(500); near(level(f), 0.1); f.tick(500); silent(f);
  assert.equal(f.instances[0].playCalls, 1);
});
test('settings getter disables through sync and unavailable Audio stays silent', async () => {
  let enabled = true; const f = fixture({getEnabled: () => enabled}); await ready(f);
  enabled = false; await f.manager.sync(); f.tick(500); near(level(f), 0.2); f.tick(500); silent(f);
  const absent = fixture({Audio:null}); assert.equal(await absent.manager.start(), false);
  assert.equal(await absent.manager.prime(), false); assert.equal(absent.timers.size, 0);
});
test('prime reports success only when BOTH decks unlock and retries just the failed deck', async () => {
  const f = fixture(); const play = f.Audio.prototype.play;
  f.Audio.prototype.play = function() { if(f.instances.indexOf(this)===1) this.reject=true; return play.call(this); };
  assert.equal(await f.manager.prime(), false);
  assert.equal(f.instances[0].playCalls,1);assert.equal(f.instances[1].playCalls,1);
  f.Audio.prototype.play=play;f.instances[1].reject=false;
  assert.equal(await f.manager.prime(),true);
  assert.equal(f.instances[0].playCalls,1);assert.equal(f.instances[1].playCalls,2);silent(f);
});

test('default durations preserve immediate entrance, volume change and pause', async () => {
  const f = fixture({fadeInMs:0, fadeOutMs:0, volumeRampMs:0});
  await f.manager.start(); near(level(f), 0.4); f.manager.setVolume(0.2); near(level(f), 0.2);
  f.manager.pause(); silent(f); assert.equal(f.timers.size, 0);
});
