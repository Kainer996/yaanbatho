const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const audioCore = require(path.join(__dirname, '..', 'audio_core.js'));

class MockAudio {
  static instances = [];

  constructor(src) {
    this.src = src;
    this.currentTime = 0;
    this.duration = Number.NaN;
    this.loop = false;
    this.muted = false;
    this.paused = true;
    this.playCalls = 0;
    this.volume = 1;
    this.listeners = {};
    MockAudio.instances.push(this);
  }

  addEventListener(name, callback) {
    (this.listeners[name] ||= []).push(callback);
  }

  emit(name) {
    (this.listeners[name] || []).forEach(callback => callback());
  }

  play() {
    this.paused = false;
    this.playCalls += 1;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
}

test('music manager overlaps two decks across the loop seam', async () => {
  MockAudio.instances = [];
  let clock = 0;
  let nextTimerId = 1;
  const timers = new Map();
  const manager = audioCore.createMusicManager({
    Audio: MockAudio,
    src: 'score.mp3',
    volume: 0.2,
    crossfadeSeconds: 4,
    fadeStepMs: 80,
    now: () => clock,
    setTimeout: callback => {
      const id = nextTimerId++;
      timers.set(id, callback);
      return id;
    },
    clearTimeout: id => timers.delete(id)
  });

  assert.equal(await manager.start(), true);
  assert.equal(MockAudio.instances.length, 2);
  const [outgoing, incoming] = MockAudio.instances;
  assert.equal(outgoing.loop, true, 'native loop remains as a throttling fallback');
  assert.equal(outgoing.volume, 0.2);
  assert.equal(incoming.volume, 0);

  outgoing.duration = 20;
  outgoing.currentTime = 16.1;
  outgoing.emit('timeupdate');
  await Promise.resolve();
  await Promise.resolve();

  assert.equal(incoming.playCalls, 1);
  assert.equal(timers.size, 1);

  clock = 2000;
  timers.values().next().value();
  assert.ok(Math.abs(outgoing.volume - 0.1) < 0.0001);
  assert.ok(Math.abs(incoming.volume - 0.1) < 0.0001);

  const finalTimer = Array.from(timers.values()).at(-1);
  clock = 4000;
  finalTimer();
  assert.equal(outgoing.paused, true);
  assert.equal(outgoing.currentTime, 0);
  assert.equal(manager.getAudio(), incoming);
  assert.equal(incoming.volume, 0.2);
});

test('looping beds preserve suppression and enabled controls', async () => {
  MockAudio.instances = [];
  const manager = audioCore.createMusicManager({ Audio: MockAudio, src: 'bed.mp3' });

  await manager.start();
  const tracks = manager.getAudios();
  manager.setSuppressed('microphone', true);
  assert.equal(manager.isSuppressed(), true);
  assert.ok(tracks.every(track => track.paused));

  manager.setSuppressed('microphone', false);
  assert.equal(manager.isSuppressed(), false);
  assert.equal(manager.getAudio().paused, false);

  manager.setEnabled(false);
  assert.ok(tracks.every(track => track.paused));
  manager.setVolume(0.075);
  assert.equal(manager.volume, 0.075, 'the intended level remains inspectable while paused');
});

test('field-map music fades continuously to silence as the player zooms close', () => {
  const volumeAt = zoom => audioCore.musicVolumeForZoom(zoom, {
    normalZoom: 16.35,
    silentZoom: 19.1,
    maxVolume: 0.2
  });

  assert.equal(volumeAt(4), 0.2, 'wide views keep the full score');
  assert.equal(volumeAt(16.35), 0.2, 'the normal outside view keeps the full score');
  assert.ok(volumeAt(17.1) < volumeAt(16.35));
  assert.ok(volumeAt(17.85) < volumeAt(17.1));
  assert.ok(volumeAt(18.6) < volumeAt(17.85));
  assert.equal(volumeAt(19.1), 0, 'the closest view is silent');
  assert.equal(volumeAt(30), 0, 'zoom values beyond the cap remain silent');
});

test('bespoke cues play once without legacy composite follow-ups', async () => {
  MockAudio.instances = [];
  let scheduled = 0;
  const manager = audioCore.createAudioManager({
    Audio: MockAudio,
    now: (() => {
      let value = 0;
      return () => (value += 1000);
    })(),
    setTimeout: () => {
      scheduled += 1;
      return scheduled;
    }
  });

  await manager.capture();
  await manager.victory();
  await manager.levelUp();
  await manager.questComplete();

  assert.equal(scheduled, 0);
  assert.deepEqual(
    MockAudio.instances.map(audio => audio.src),
    [
      'assets/audio/sfx-capture.mp3',
      'assets/audio/sfx-victory.mp3',
      'assets/audio/sfx-level-up.mp3',
      'assets/audio/sfx-quest-complete.mp3'
    ]
  );
});
