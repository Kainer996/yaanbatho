const test = require('node:test');
const assert = require('node:assert');
const audioCore = require('../audio_core.js');

test('music fades out, rests for the gap, then fades back in', async () => {
  const timers = []; let clock = 0; const listeners = {};
  class MockAudio {
    constructor(src) { this.src = src; this.volume = 1; this.currentTime = 0; this.duration = 100; this.paused = true; }
    addEventListener(type, fn) { (listeners[type] = listeners[type] || []).push(fn); }
    play() { this.paused = false; return Promise.resolve(); }
    pause() { this.paused = true; }
  }
  const rests = [];
  const music = audioCore.createMusicManager({
    Audio: MockAudio, volume: 0.2 / 3, fadeInMs: 0, outroMs: 10000, gapMs: 180000,
    now: () => clock, setTimeout: (fn, ms) => { timers.push({fn, at: clock + ms}); return timers.length; }, clearTimeout: () => {},
    onRest: value => rests.push(value)
  });
  await music.start();
  const [track] = music.getAudios();
  assert.equal(music.getAudios().length, 1);
  assert.equal(track.loop, false);
  assert.ok(Math.abs(track.volume - 0.2 / 3) < 1e-9);
  track.currentTime = 95; listeners.timeupdate.forEach(fn => fn());
  clock += 5000; timers.shift().fn();
  assert.equal(track.volume, 0);
  listeners.ended.forEach(fn => fn());
  assert.equal(music.resting, true);
  assert.equal(timers.at(-1).at - clock, 180000);
  clock += 180000; timers.pop().fn(); await Promise.resolve(); await Promise.resolve();
  assert.equal(music.resting, false);
  assert.deepEqual(rests, [true, false]);
  assert.equal(track.paused, false);
  assert.equal(track.currentTime, 0);
});
