'use strict';
// Merlin flight v3: one painted side view, steering physics, a whole-screen
// play sky, and home to the perch after four pebbles.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Flight = require('../merlin_flight.js');
const root = path.join(__dirname, '..');
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/merlin-flight/atlas-config.js'), 'utf8'), { window: win });
const atlas = win.MERLIN_FLIGHT_ATLAS;

function model(options = {}) {
  return new Flight.FlightModel({ atlas, bounds: Flight.flightBounds(390, 844), home: { x: 340, y: 124 }, rng: () => .5, ...options });
}
function run(m, seconds, each) {
  for (let i = 0; i < seconds * 60 && !m.done; i++) { const before = m.snapshot(); const view = m.step(1 / 60); if (each) each(view, before); }
  return m.snapshot();
}

test('the atlas is one side view: an 8-pose wing beat plus reach, grab, lift and flare', () => {
  assert.equal(atlas.version, 3);
  assert.equal(atlas.url, 'assets/merlin-flight/merlin-flight-v3.webp');
  assert.deepEqual(Object.keys(atlas.clips).sort(), ['flap', 'flare', 'grab', 'lift', 'reach']);
  assert.equal(atlas.clips.flap.length, 8);
  assert.equal(new Set(atlas.frames.map(f => f.source.join())).size, atlas.frames.length);
  for (const f of atlas.frames) {
    assert.ok(f.source[0] + f.source[2] <= atlas.width && f.source[1] + f.source[3] <= atlas.height);
    assert.ok(f.grip.every(n => n > 0 && n < 1));
  }
  assert.ok(atlas.width * atlas.height * 4 < 8 * 1024 ** 2, 'decoded atlas stays small');
});

test('flying Merlin is drawn at one fixed size, the size he sits on his perch', () => {
  const m = model();
  const lengths = new Set();
  run(m, 6, view => lengths.add(Flight.drawScale(atlas) * atlas.bodyLength));
  assert.deepEqual([...lengths], [Flight.DISPLAY_LENGTH]);
  assert.ok(Flight.DISPLAY_LENGTH >= 90 && Flight.DISPLAY_LENGTH <= 110);
  assert.equal(m.scale, Flight.drawScale(atlas));
});

test('cruising visits the whole wing beat, glides on the level-wing pose and never jerks', () => {
  const m = model();
  const frames = new Set(); let glides = 0, maxTurn = 0, maxJump = 0, last = null;
  run(m, 14, (view, before) => {
    if (view.clip === 'flap') frames.add(view.frame);
    if (view.gliding) { glides++; assert.equal(view.frame, 2); }
    if (last) {
      const a = Math.atan2(last.velocity.y, last.velocity.x), b = Math.atan2(view.velocity.y, view.velocity.x);
      maxTurn = Math.max(maxTurn, Math.abs(Math.atan2(Math.sin(b - a), Math.cos(b - a))));
      maxJump = Math.max(maxJump, Math.hypot(view.position.x - last.position.x, view.position.y - last.position.y));
    }
    last = view;
  });
  assert.equal(frames.size, 8);
  assert.ok(glides > 20, 'he glides between beats');
  assert.ok(maxTurn < .2, 'heading turns smoothly, frame to frame: ' + maxTurn);
  assert.ok(maxJump < 8, 'no teleports: ' + maxJump);
});

test('a tap anywhere drops a pebble exactly there, even on the dock or the header', () => {
  for (const [x, y] of [[20, 830], [370, 20], [195, 420]]) {
    const m = model();
    assert.equal(m.drop(x, y), true);
    assert.ok(Math.abs(m.token.x - Math.min(Math.max(x, 12), 378)) < .01);
    assert.ok(Math.abs(m.token.restY - Math.min(Math.max(y, 12), 832)) < .01);
  }
});

test('the talons meet each pebble exactly, then he carries it to the pile', () => {
  for (const [x, y] of [[60, 780], [200, 300], [330, 700], [40, 120]]) {
    const m = model();
    run(m, 1);
    m.drop(x, y);
    const target = { x: m.token.x, y: m.token.restY };
    let touched = false, sawReach = false;
    run(m, 12, (view, before) => {
      if (view.clip === 'reach') sawReach = true;
      if (!before.carrying && view.carrying) {
        const grip = Flight.gripOffset(atlas, { clip: 'grab', frame: 0, facing: view.turn, pitch: view.pitch }, m.scale);
        assert.ok(Math.hypot(view.position.x + grip.x - target.x, view.position.y + grip.y - target.y) < 1.5, 'talons on the pebble');
        assert.equal(view.clip, 'grab'); assert.equal(view.paintedPebble, true);
        touched = true;
      }
    });
    assert.ok(sawReach && touched, x + ',' + y);
    assert.equal(m.pickups, 1); assert.equal(m.delivered, 1); assert.equal(m.pileStones.length, 1);
  }
});

test('after four pebbles Merlin flies home and lands on his perch', () => {
  const m = model();
  const taps = [[60, 780], [200, 300], [330, 700], [40, 120]];
  let tapped = 0, flare = false;
  for (let i = 0; i < 60 * 45 && !m.done; i++) {
    if (tapped < taps.length && m.state === 'cruise' && m.stateTime > .5) m.drop(...taps[tapped++]);
    const view = m.step(1 / 60);
    if (view.clip === 'flare') flare = true;
  }
  assert.equal(m.done, true); assert.equal(m.finishReason, 'complete');
  assert.equal(m.pickups, 4); assert.equal(m.pileStones.length, 4);
  assert.ok(flare, 'lands with the flare pose');
  assert.ok(Math.hypot(m.position.x - 340, m.position.y - 124) < 1, 'ends exactly on the perch');
  assert.equal(m.facing, -1, 'faces the way the perched Merlin does');
});

test('no more than four pebbles are ever accepted; one may wait while he is busy', () => {
  const m = model();
  assert.equal(m.drop(100, 500), true);
  assert.equal(m.drop(200, 500), true);
  assert.ok(m.queued);
  run(m, 20);
  assert.equal(m.pickups, 2);
  for (let i = 0; i < 2; i++) { m.drop(150 + i * 50, 600); run(m, 10); }
  assert.equal(m.pickups, 4);
  assert.equal(m.drop(100, 400), false);
});

test('an idle sky sends him home; a tap keeps him playing', () => {
  const m = model({ idleMs: 3000 });
  run(m, 2.5); m.drop(100, 600); run(m, 2.5);
  assert.notEqual(m.state, 'landing');
  run(m, 12);
  assert.equal(m.done, true); assert.equal(m.finishReason, 'idle');
});

test('reduced motion shows still poses and still counts four pebbles', () => {
  const m = model({ reducedMotion: true });
  const start = { ...m.position };
  for (let i = 0; i < 4; i++) { m.drop(100 + i * 40, 600); run(m, 1, view => assert.notEqual(view.clip, 'lift')); }
  assert.equal(m.pickups, 4); assert.equal(m.done, true);
  assert.ok(start.x > 0);
});

test('Hermite segments start and end on the given points and speeds', () => {
  const seg = { p0: { x: 0, y: 0 }, v0: { x: 100, y: 0 }, p1: { x: 200, y: 50 }, v1: { x: 0, y: 80 }, T: 1.2 };
  const a = Flight.hermite(seg, 0), b = Flight.hermite(seg, 1.2);
  assert.deepEqual([a.position.x, a.position.y, b.position.x, b.position.y].map(Math.round), [0, 0, 200, 50]);
  assert.deepEqual([a.velocity.x, a.velocity.y, b.velocity.x, b.velocity.y].map(Math.round), [100, 0, 0, 80]);
});

// ---- The browser lifecycle, with a small fake DOM ----
class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  fire(type, event = {}) { for (const fn of [...(this.listeners.get(type) || [])]) fn({ type, stopPropagation() {}, preventDefault() {}, ...event }); }
  count() { return [...this.listeners.values()].reduce((sum, values) => sum + values.size, 0); }
}
class Element extends Events {
  constructor(tag, doc) {
    super(); this.tagName = tag.toUpperCase(); this.doc = doc; this.children = []; this.attributes = {}; this.style = {}; this.dataset = {}; this.className = '';
    this.classList = { add: name => { this.className += ' ' + name; } };
  }
  appendChild(child) { this.children.push(child); child.parentElement = this; return child; }
  setAttribute(key, value) { this.attributes[key] = value; }
  getAttribute(key) { return this.attributes[key] || null; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(item => item !== this); this.parentElement = null; }
  contains(el) { return el === this || this.children.some(child => child.contains(el)); }
  focus() { this.doc.activeElement = this; }
  get isConnected() { return this === this.doc.body || !!this.parentElement?.isConnected; }
  getBoundingClientRect() { return { left: 300, right: 388, top: 80, bottom: 168, width: 88, height: 88 }; }
  getContext() { return this.doc.context; }
}
function browser(options = {}) {
  const env = new Events(), doc = new Events();
  env.document = doc; env.innerWidth = 390; env.innerHeight = 844; env.devicePixelRatio = 3;
  doc.hidden = false; doc.body = new Element('body', doc); doc.activeElement = doc.body;
  doc.createElement = tag => new Element(tag, doc);
  const draws = [];
  doc.context = new Proxy({}, { get: (target, key) => key === 'drawImage' ? (...args) => draws.push(args) : target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
  const media = new Events(); media.matches = !!options.reduced; env.matchMedia = () => media;
  const queue = new Map(); let next = 1, now = 0;
  env.requestAnimationFrame = fn => { const id = next++; queue.set(id, fn); return id; };
  env.cancelAnimationFrame = id => queue.delete(id);
  const observers = [];
  env.MutationObserver = class { constructor(callback) { this.callback = callback; this.connected = true; observers.push(this); } observe() {} disconnect() { this.connected = false; } };
  const callbacks = { takeoff: 0, restore: 0, finishes: [], errors: [], pebbles: [] };
  const controller = Flight.create({
    environment: env, atlas, loadAtlas: options.loadAtlas || (() => Promise.resolve({ naturalWidth: atlas.width, naturalHeight: atlas.height })),
    onTakeoff: () => callbacks.takeoff++, onRestore: () => callbacks.restore++, onFinish: outcome => callbacks.finishes.push(outcome),
    onError: error => callbacks.errors.push(error), onPebble: data => callbacks.pebbles.push(data), rng: () => .5, ...options.controller
  });
  return { env, doc, media, queue, observers, callbacks, controller, draws,
    get layer() { return doc.body.children[0]; },
    tick(ms = 16.667) { now += ms; const jobs = [...queue.values()]; queue.clear(); jobs.forEach(fn => fn(now)); },
    tap(x, y, id = 1) { const pad = this.layer.children[0]; pad.fire('pointerdown', { clientX: x, clientY: y, pointerId: id, button: 0 }); pad.fire('pointerup', { clientX: x, clientY: y, pointerId: id }); },
    navigate() { doc.body.setAttribute('data-active-screen', 'quests'); observers.filter(o => o.connected).forEach(o => o.callback()); }
  };
}

test('the play sky covers the whole screen and swallows every tap into a pebble', async () => {
  const b = browser();
  assert.equal(await b.controller.start(), true);
  const [pad, canvas, toolbar] = b.layer.children;
  assert.equal(pad.className, 'merlin-flight-sky');
  assert.equal(canvas.width, 780, 'DPR is capped at two');
  assert.match(toolbar.className, /merlin-flight-toolbar/);
  let swallowed = 0;
  pad.fire('pointerdown', { clientX: 30, clientY: 830, pointerId: 7, button: 0, stopPropagation() { swallowed++; } });
  pad.fire('pointerup', { clientX: 31, clientY: 829, pointerId: 7, stopPropagation() { swallowed++; } });
  pad.fire('click', { stopPropagation() { swallowed++; } });
  assert.equal(swallowed, 3, 'nothing underneath hears the tap');
  const token = b.controller.diagnostics.state.token;
  assert.ok(token && Math.abs(token.x - 31) < .01 && Math.abs(token.restY - 829) < .01, 'pebble lands on the dock spot');
  const pads = ['click', 'pointerdown', 'pointerup'].map(type => b.doc.listeners.get(type)?.size || 0);
  assert.deepEqual(pads, [0, 0, 0], 'no document-wide capture');
  b.controller.dispose();
});

test('four fetched pebbles end the game on the perch and restore the perched Merlin once', async () => {
  const b = browser();
  await b.controller.start();
  const spots = [[80, 700], [300, 300], [120, 820], [260, 560]];
  let tapped = 0;
  for (let i = 0; i < 60 * 60 && b.controller.active; i++) {
    const state = b.controller.diagnostics.state;
    if (tapped < spots.length && state && state.state === 'cruise' && state.pickups === tapped) b.tap(...spots[tapped++]);
    b.tick();
  }
  assert.equal(b.controller.active, false);
  assert.deepEqual(b.callbacks.pebbles.map(p => p.pickups), [1, 2, 3, 4]);
  assert.equal(b.callbacks.restore, 1);
  assert.equal(b.callbacks.finishes.length, 1);
  assert.equal(b.callbacks.finishes[0].reason, 'complete');
  assert.equal(b.callbacks.finishes[0].pickups, 4);
  assert.equal(b.doc.body.children.length, 0);
  assert.equal(b.doc.count() + b.env.count() + b.media.count(), 0);
});

test('Finish and Care still work from the play bar', async () => {
  let opened = 0;
  const b = browser({ controller: { onCare: () => opened++ } });
  await b.controller.start();
  const toolbar = b.layer.children[2], actions = toolbar.children[1];
  assert.equal(actions.children[0].textContent, 'Care');
  assert.equal(actions.children[1].textContent, 'Finish');
  actions.children[0].fire('click');
  assert.equal(opened, 1); assert.equal(b.controller.active, true);
  actions.children[1].fire('click');
  assert.equal(b.controller.diagnostics.state.state, 'landing');
  for (let i = 0; i < 600 && b.controller.active; i++) b.tick();
  assert.equal(b.controller.active, false); assert.equal(b.callbacks.restore, 1);
});

test('stopped, superseded, hidden or navigated loads never take off, and every listener is cleaned', async () => {
  for (const reason of ['stop', 'navigation', 'pagehide', 'hidden']) {
    let resolve;
    const b = browser({ loadAtlas: () => new Promise(done => { resolve = done; }) });
    const pending = b.controller.start();
    if (reason === 'stop') b.controller.stop('navigation', { immediate: true });
    else if (reason === 'navigation') b.navigate();
    else if (reason === 'hidden') { b.doc.hidden = true; b.doc.fire('visibilitychange'); }
    else b.env.fire('pagehide');
    resolve({ naturalWidth: atlas.width, naturalHeight: atlas.height });
    assert.equal(await pending, false, reason); assert.equal(b.callbacks.takeoff, 0);
    assert.equal(b.doc.body.children.length, 0);
    assert.equal(b.doc.count() + b.env.count() + b.media.count(), 0, reason);
  }
  for (const reason of ['resize', 'orientationchange', 'motion']) {
    const b = browser(); await b.controller.start(); b.tick();
    if (reason === 'motion') b.media.fire('change'); else b.env.fire(reason);
    assert.equal(b.controller.active, false, reason); assert.equal(b.callbacks.restore, 1, reason);
    assert.equal(b.doc.count() + b.env.count() + b.media.count(), 0, reason);
  }
});

test('missing or wrong-sized artwork fails cleanly without hiding the perched Merlin', async () => {
  for (const loadAtlas of [() => Promise.reject(new Error('offline miss')), () => Promise.resolve({ naturalWidth: 10, naturalHeight: 10 })]) {
    const b = browser({ loadAtlas });
    assert.equal(await b.controller.start(), false);
    assert.equal(b.callbacks.takeoff, 0); assert.equal(b.callbacks.errors.length, 1); assert.equal(b.queue.size, 0);
  }
});

test('an idle game ends on real time even when frames are slow', async () => {
  const b = browser(); await b.controller.start(); b.tick();
  for (let i = 0; i < 51; i++) b.tick(500);
  assert.equal(b.controller.diagnostics.state.state, 'landing');
  for (let i = 0; i < 600 && b.controller.active; i++) b.tick();
  assert.equal(b.controller.active, false);
});

test('the game ships v3 together: pins, worker lists, updater and the Home perch size', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const sw = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
  const updater = fs.readFileSync(path.join(root, '../../scripts/update-live-burbz.sh'), 'utf8');
  const pin = 'merlin-flight-v479-20260925';
  for (const file of ['merlin_flight.js', 'merlin_flight.css', 'assets/merlin-flight/atlas-config.js']) {
    assert.ok(html.includes(file + '?v=' + pin), file);
    assert.equal(sw.split("'./" + file + '?v=' + pin + "'").length - 1, 3, file + ' in all three worker lists');
    assert.ok(updater.includes('"' + file + '"'), file + ' in updater');
  }
  assert.equal(sw.split("'./assets/merlin-flight/merlin-flight-v3.webp'").length - 1, 3);
  assert.ok(updater.includes('"assets/merlin-flight/merlin-flight-v3.webp"'));
  assert.ok(!/merlin-flight-v[12]\.webp/.test(html + sw + updater), 'old atlases are gone');
  assert.ok(html.includes("atlasUrl: 'assets/merlin-flight/merlin-flight-v3.webp'"));
  assert.ok(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].includes(pin));
  // Merlin keeps one size on every screen: Home no longer shrinks his perch.
  const home = fs.readFileSync(path.join(root, 'scan_home.css'), 'utf8');
  for (const rule of home.split('}').filter(rule => rule.includes('#merlinPerchAssembly'))) assert.ok(!/scale\(/.test(rule), rule);
});
