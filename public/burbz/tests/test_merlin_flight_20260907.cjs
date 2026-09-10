'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Flight = require('../merlin_flight.js');
const fs = require('node:fs');
const vm = require('node:vm');
const actualAtlasWindow = {};
vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname, '../assets/merlin-flight/atlas-config.js'), 'utf8'), { window: actualAtlasWindow });
const actualAtlas = actualAtlasWindow.MERLIN_FLIGHT_ATLAS;

function advance(model, seconds, dt = 1 / 60) {
  for (let i = 0; i < seconds / dt && !model.done; i++) model.step(dt);
  return model.snapshot();
}
function seeded(seed) {
  return () => { seed = Math.imul(1664525, seed) + 1013904223 | 0; return (seed >>> 0) / 4294967296; };
}

test('curves, poses and talon targets remain finite and contained on phones and landscape', () => {
  for (const [width, height] of [[320, 568], [390, 844], [844, 390], [667, 320], [1440, 900]]) {
    for (const seed of [3, 51, 102]) {
      const bounds = Flight.flightBounds(width, height);
      const model = new Flight.FlightModel({ bounds, rng: seeded(seed) });
      let previous = model.position;
      for (let i = 0; i < 1800 && !model.done; i++) {
        if (i > 80 && i % 251 === 0) model.drop(i % width, i % height);
        const view = model.step(1 / 60);
        for (const value of Object.values(view.position)) assert.ok(Number.isFinite(value));
        assert.ok(view.position.x >= bounds.left - .001 && view.position.x <= bounds.right + .001);
        assert.ok(view.position.y >= bounds.top - .001 && view.position.y <= bounds.bottom + .001);
        assert.ok(Math.hypot(view.position.x - previous.x, view.position.y - previous.y) < 12, 'no teleport during a bank or pickup');
        assert.ok(view.row >= 0 && view.row < 8 && view.frame >= 0 && view.frame < 8);
        if (view.token) {
          assert.ok(view.token.y <= bounds.bottom && view.token.x >= bounds.left && view.token.x <= bounds.right);
        }
        previous = view.position;
      }
      assert.equal(model.done, true);
    }
  }
});

test('cruise turns reveal front, quarter, profile, back, rising and descending views', () => {
  const model = new Flight.FlightModel({ rng: () => .5 });
  const seen = new Set();
  for (let i = 0; i < 1500; i++) seen.add(model.step(1 / 60).row);
  [0, 1, 2, 3, 4, 5, 6].forEach(row => assert.ok(seen.has(row), 'view ' + row));
  assert.equal(Flight.viewForVelocity({ x: 10, y: 0, z: 1 }), 0);
  assert.equal(Flight.viewForVelocity({ x: 10, y: 0, z: -1 }), 4);
  assert.equal(Flight.viewForVelocity({ x: 100, y: 0, z: 0 }), 2);
});

test('wing phase advances continuously through acceleration and short glides use the swept pose', () => {
  const model = new Flight.FlightModel({ rng: () => .5 });
  let glides = 0;
  for (let i = 0; i < 1400; i++) {
    if (i === 250) model.drop(240, 410);
    const before = model.wingPhase;
    const view = model.step(1 / 60);
    if (!view.powered) { assert.equal(view.frame, 5); glides++; }
    else assert.ok((model.wingPhase - before + 1) % 1 < .081, 'no wing phase jump when speed changes');
  }
  assert.ok(glides > 0 && glides < 180, 'brief occasional glides, purposeful beats most of the time');
});

test('a tap makes a falling pebble, a shallow reach, one pickup and visible carry before return', () => {
  const model = new Flight.FlightModel({ rng: () => .5 });
  advance(model, 1);
  assert.equal(model.drop(245, 430), true);
  const origin = model.token.y;
  advance(model, .2);
  assert.ok(model.token.y > origin && model.token.y < model.token.floorY);
  const seen = new Set();
  let carryView, deposit;
  for (let i = 0; i < 600; i++) {
    const view = model.step(1 / 60); seen.add(view.state);
    if (view.carrying) carryView = view;
    if (view.deposited) deposit = view.deposited;
  }
  assert.ok(seen.has('reach')); assert.ok(seen.has('carry'));
  assert.ok(carryView && carryView.row === 7);
  assert.ok(deposit); assert.equal(model.pickups, 1);
  assert.equal(model.token, null); assert.equal(model.carrying, null);
});

test('atlas drawing and talon positions share the body pivot, frame anchors, scale, mirror and bank', () => {
  const talons = []; talons[6] = Array.from({ length: 8 }, (_, frame) => [.47 + frame * .002, .815]);
  const view = { position: { x: 210, y: 300 }, row: 6, frame: 3, scale: .9, mirror: true, bank: .2 };
  const atlas = { pivot: [.5, .625], talons };
  const geometry = Flight.spriteGeometry(view, 136, atlas);
  assert.deepEqual(geometry.destination, [-61.2, -76.5, 122.4, 122.4]);
  const x = -(.476 - .5) * 122.4, y = (.815 - .625) * 122.4;
  assert.ok(Math.abs(geometry.talon.x - (210 + x * Math.cos(.2) - y * Math.sin(.2))) < 1e-9);
  assert.ok(Math.abs(geometry.talon.y - (300 + x * Math.sin(.2) + y * Math.cos(.2))) < 1e-9);
  let args;
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, drawImage(...values) { args = values; } };
  Flight.drawSprite(ctx, 'image', view, { size: 136, atlas });
  assert.deepEqual(args, ['image', 3 * 256, 6 * 256, 256, 256, ...geometry.destination]);
});

test('actual asymmetric talons contact the pebble exactly before pickup and return', () => {
  const talons = [];
  talons[6] = Array.from({ length: 8 }, (_, frame) => [.455 + .005 * Math.sin(frame), .83 + .004 * Math.cos(frame)]);
  talons[7] = Array.from({ length: 8 }, (_, frame) => [.475 + .004 * Math.sin(frame), .805 + .003 * Math.cos(frame)]);
  const atlas = { pivot: [.5, .625], talons };
  for (const x of [20, 240, 370]) {
    const model = new Flight.FlightModel({ rng: () => .5, atlas }); advance(model, 3);
    model.drop(x, 430);
    const target = { x: model.token.x, y: model.token.floorY };
    let pickedUp = false, returned = false;
    for (let i = 0; i < 600 && !returned; i++) {
      const wasCarrying = !!model.carrying;
      const view = model.step(1 / 60);
      const contact = Flight.spriteGeometry(view, model.size, atlas).grip;
      if (!wasCarrying && view.carrying) {
        assert.ok(Math.hypot(contact.x - target.x, contact.y - target.y) < 1e-6, 'no pickup snap'); pickedUp = true;
      }
      if (wasCarrying && view.deposited) {
        assert.ok(Math.hypot(contact.x - view.deposited.x, contact.y - view.deposited.y) < 1e-6, 'no return snap'); returned = true;
      }
      assert.ok(view.position.x >= model.bounds.left && view.position.x <= model.bounds.right);
    }
    assert.ok(pickedUp && returned);
  }
});

test('production atlas pickup and delivery have continuous body and held-pebble paths', () => {
  const cases = [[320, 568, 300, 368], [390, 844, 370, 644], [390, 844, 245, 430], [844, 390, 50, 170]];
  for (const [width, height, x, y] of cases) {
    const model = new Flight.FlightModel({ bounds: Flight.flightBounds(width, height), rng: () => .5, atlas: actualAtlas });
    advance(model, 3);
    const beforeDrop = model.snapshot(); model.drop(x, y);
    assert.equal(model.facingRight, beforeDrop.mirror, 'a tap does not flip a flying bird in place');
    let previous = model.snapshot(), maxBody = 0, maxGrip = 0, reached = false, delivered = false;
    const tokenTarget = { x: model.token.x, y: model.token.floorY };
    for (let i = 0; i < 900 && !model.done; i++) {
      const view = model.step(1 / 60), geometry = Flight.spriteGeometry(view, model.size, actualAtlas);
      const step = Math.hypot(view.position.x - previous.position.x, view.position.y - previous.position.y);
      maxBody = Math.max(maxBody, step);
      if (previous.carrying && view.carrying) {
        const oldGrip = Flight.spriteGeometry(previous, model.size, actualAtlas).grip;
        maxGrip = Math.max(maxGrip, Math.hypot(geometry.grip.x - oldGrip.x, geometry.grip.y - oldGrip.y));
      }
      if (!previous.carrying && view.carrying) {
        reached = true;
        assert.ok(Math.hypot(geometry.talon.x - tokenTarget.x, geometry.talon.y - tokenTarget.y) < .01, 'painted extended talons make contact before pickup');
      }
      if (previous.carrying && !view.carrying && view.deposited) {
        delivered = true;
        assert.ok(Math.hypot(geometry.grip.x - view.deposited.x, geometry.grip.y - view.deposited.y) < .01, 'carried grip deposits exactly at the return spot');
      }
      if (view.mirror !== previous.mirror) {
        assert.ok(view.row === 0 || view.row === 4, 'mirroring only occurs while facing the viewer or facing away');
        assert.ok(previous.row === 0 || previous.row === 4, 'turn passes through a front/rear view before reversing');
      }
      previous = view;
    }
    assert.ok(maxBody < 6.5, `${width}×${height}: body jump ${maxBody}`);
    assert.ok(maxGrip < 6.5, `${width}×${height}: held pebble jump ${maxGrip}`);
    assert.ok(reached && delivered);
  }
});

test('production atlas rapid retargeting keeps bounded position and turns through front/rear views', () => {
  const model = new Flight.FlightModel({ rng: seeded(17), atlas: actualAtlas });
  advance(model, 2);
  let previous = model.snapshot();
  for (let i = 0; i < 1000 && !model.done; i++) {
    if (i < 190 && i % 7 === 0) model.drop(i % 2 ? 30 : 370, 270 + i % 150);
    const view = model.step(1 / 60);
    assert.ok(Math.hypot(view.position.x - previous.position.x, view.position.y - previous.position.y) < 7);
    if (view.mirror !== previous.mirror) assert.ok([0, 4].includes(view.row) && [0, 4].includes(previous.row));
    previous = view;
  }
  assert.ok(model.pickups >= 1);
});

test('legacy closing grip uses a joined mesh with fixed torso and exact talon mapping', () => {
  const calls = [], transforms = [];
  const ctx = { save() {}, restore() {}, translate() {}, rotate() {}, scale() {}, beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, clip() {}, transform(...args) { transforms.push(args); }, drawImage(...args) { calls.push(args); } };
  const view = { row: 7, frame: 0, scale: 1, bank: .12, mirror: true, carrying: true, gripOffset: { x: 23, y: 24 }, position: { x: 200, y: 300 } };
  const geometry = Flight.drawSprite(ctx, {}, view, { atlas: { cell: 256, pivot: [.5, .625] }, size: 136 });
  assert.equal(calls.length, 9); assert.equal(transforms.length, 8);
  assert.deepEqual(calls[0].slice(1), [0, 7 * 256, 256, 160, -68, -85, 136, 85], 'torso and wing roots use the unshifted upper sprite');
  const goal = { x: -(23 * Math.cos(.12) + 24 * Math.sin(.12)), y: -23 * Math.sin(.12) + 24 * Math.cos(.12) };
  let gripTriangles = 0;
  transforms.forEach(([a,b,c,d,e,f]) => {
    assert.ok([a,b,c,d,e,f].every(Number.isFinite));
    assert.ok(a*d-b*c > 0, 'no folded or inverted triangle');
    const atTalon = { x:a*geometry.localTalon.x+c*geometry.localTalon.y+e, y:b*geometry.localTalon.x+d*geometry.localTalon.y+f };
    if (Math.hypot(atTalon.x-goal.x,atTalon.y-goal.y)<1e-7) gripTriangles++;
    else assert.ok(Math.abs(a-1)+Math.abs(b)+Math.abs(c)+Math.abs(d-1)+Math.abs(e)+Math.abs(f)<1e-7, 'only the outer fixed triangles omit the shared grip vertex');
  });
  assert.equal(gripTriangles, 6, 'all six triangles incident on the talon agree exactly');
  assert.deepEqual(geometry.grip, { x: 223, y: 324 });
});

test('latest tap replaces an uncollected target, and only one next pebble waits during carry', () => {
  const model = new Flight.FlightModel({ rng: () => .5 });
  advance(model, 1);
  for (let i = 0; i < 30; i++) model.drop(180 + i, 300 + i);
  assert.equal(model.token.id, 30);
  while (!model.carrying) model.step(1 / 60);
  assert.equal(model.pickups, 1);
  for (let i = 0; i < 25; i++) model.drop(180 + i, 430);
  assert.equal(model.token.id, 55);
  advance(model, 8);
  assert.equal(model.pickups, 2);
  assert.equal(model.carrying, null); assert.equal(model.token, null);
});

test('reduced motion preserves fetch feedback without cross-screen motion or flapping', () => {
  const model = new Flight.FlightModel({ reducedMotion: true });
  const origin = { ...model.position };
  model.drop(220, 430);
  const reached = advance(model, .3);
  assert.equal(reached.carrying, true); assert.equal(reached.frame, 2);
  assert.deepEqual(model.position, origin);
  advance(model, 1);
  assert.equal(model.pickups, 1); assert.deepEqual(model.position, origin);
  model.land('finished'); assert.equal(model.done, true);
});

test('stop discards targets and lands at a measured perch outside the cruise inset', () => {
  const home = { x: 343, y: 110, z: .65 };
  const model = new Flight.FlightModel({ home });
  advance(model, 3); model.drop(220, 350); model.land('finished');
  assert.equal(model.drop(210, 300), false);
  advance(model, 2);
  assert.equal(model.done, true); assert.deepEqual(model.position, home);
  assert.equal(model.token, null); assert.equal(model.carrying, null);
});

test('open play rectangles have real holes for overlapping native controls', () => {
  const obstacles = [{ left: 20, right: 60, top: 30, bottom: 60 }, { left: 40, right: 80, top: 40, bottom: 70 }];
  const spaces = Flight.openRectangles({ left: 0, right: 100, top: 0, bottom: 100 }, obstacles);
  for (let y = .5; y < 100; y++) for (let x = .5; x < 100; x++) {
    const expected = !obstacles.some(r => x > r.left && x < r.right && y > r.top && y < r.bottom);
    const actual = spaces.filter(r => x > r.left && x < r.right && y > r.top && y < r.bottom).length;
    assert.equal(actual, expected ? 1 : 0, `${x},${y}`);
  }
});

class Events {
  constructor() { this.listeners = new Map(); }
  addEventListener(type, fn) { if (!this.listeners.has(type)) this.listeners.set(type, new Set()); this.listeners.get(type).add(fn); }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  fire(type, event = {}) { for (const fn of [...(this.listeners.get(type) || [])]) fn({ type, ...event }); }
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
  replaceChildren() { this.children.forEach(child => { child.parentElement = null; }); this.children = []; }
  focus() { this.doc.activeElement = this; }
  get isConnected() { return this === this.doc.body || !!this.parentElement?.isConnected; }
  getBoundingClientRect() { return this.rect || { left: 320, right: 390, top: 80, bottom: 168, width: 70, height: 88 }; }
  getClientRects() { return [this.getBoundingClientRect()]; }
  matches(selector) { return selector.split(',').some(part => part === this.tagName.toLowerCase() || part === '[onclick]' && this.attributes.onclick || part === '[tabindex]' && this.attributes.tabindex); }
  getContext() { return this.doc.context; }
}
function browser(options = {}) {
  const env = new Events(), doc = new Events();
  env.document = doc; env.innerWidth = 390; env.innerHeight = 844; env.devicePixelRatio = 3;
  doc.hidden = false; doc.body = new Element('body', doc); doc.activeElement = doc.body;
  doc.createElement = tag => new Element(tag, doc);
  const draws = [];
  doc.context = new Proxy({}, { get: (target, key) => key === 'drawImage' ? (...args) => draws.push(args) : target[key] || (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
  doc.controls = []; doc.querySelectorAll = () => doc.controls;
  env.getComputedStyle = () => ({ display: 'block', visibility: 'visible', pointerEvents: 'auto', overflowY: 'visible', overflowX: 'visible' });
  const media = new Events(); media.matches = !!options.reduced; env.matchMedia = () => media;
  const queue = new Map(); let next = 1, now = 0;
  env.requestAnimationFrame = fn => { const id = next++; queue.set(id, fn); return id; };
  env.cancelAnimationFrame = id => queue.delete(id);
  const observers = [];
  env.MutationObserver = class { constructor(callback) { this.callback = callback; this.connected = true; observers.push(this); } observe() {} disconnect() { this.connected = false; } };
  const callbacks = { takeoff: 0, restore: 0, finishes: [], errors: [] };
  const controller = Flight.create({
    environment: env, loadAtlas: options.loadAtlas || (() => Promise.resolve({ naturalWidth: 2048, naturalHeight: 2048 })),
    onTakeoff: () => callbacks.takeoff++, onRestore: () => callbacks.restore++, onFinish: outcome => callbacks.finishes.push(outcome), onError: error => callbacks.errors.push(error),
    rng: () => .5, ...options.controller
  });
  return { env, doc, media, queue, observers, callbacks, controller, draws,
    tick(ms = 16.667) { now += ms; const jobs = [...queue.values()]; queue.clear(); jobs.forEach(fn => fn(now)); },
    navigate() { doc.body.setAttribute('data-active-screen', 'quests'); observers.filter(o => o.connected).forEach(o => o.callback()); }
  };
}

test('repeated starts share one load, canvas and animation loop; finish restores once', async () => {
  const b = browser();
  const first = b.controller.start(), second = b.controller.start();
  assert.equal(first, second); assert.equal(await first, true);
  assert.equal(b.doc.body.children.length, 1); assert.equal(b.queue.size, 1);
  const canvas = b.doc.body.children[0].children[1];
  assert.equal(canvas.width, 780, 'DPR is capped at two');
  for (let i = 0; i < 180; i++) { b.tick(); assert.equal(b.queue.size, 1); }
  assert.equal(await b.controller.start(), true); assert.equal(b.callbacks.takeoff, 1);
  b.controller.stop('finished');
  for (let i = 0; i < 120; i++) b.tick();
  assert.equal(b.controller.active, false); assert.equal(b.queue.size, 0); assert.equal(b.doc.body.children.length, 0);
  assert.equal(b.callbacks.restore, 1); assert.equal(b.callbacks.finishes.length, 1);
  assert.equal(b.doc.count(), 0); assert.equal(b.env.count(), 0); assert.equal(b.media.count(), 0);
});

test('stopped or superseded artwork loads cannot resurrect the overlay', async () => {
  let resolve;
  const b = browser({ loadAtlas: () => new Promise(done => { resolve = done; }) });
  const pending = b.controller.start(); b.controller.stop('navigation', { immediate: true });
  resolve({ naturalWidth: 2048, naturalHeight: 2048 });
  assert.equal(await pending, false);
  assert.equal(b.callbacks.takeoff, 0); assert.equal(b.queue.size, 0); assert.equal(b.doc.body.children.length, 0);
});

test('navigation and backgrounding cancel a pending atlas before it can take off', async () => {
  for (const reason of ['navigation', 'pagehide', 'hidden']) {
    let resolve;
    const b = browser({ loadAtlas: () => new Promise(done => { resolve = done; }) });
    const pending = b.controller.start();
    if (reason === 'navigation') b.navigate();
    else if (reason === 'hidden') { b.doc.hidden = true; b.doc.fire('visibilitychange'); }
    else b.env.fire('pagehide');
    resolve({ naturalWidth: 2048, naturalHeight: 2048 });
    assert.equal(await pending, false); assert.equal(b.callbacks.takeoff, 0);
    assert.equal(b.controller.active, false); assert.equal(b.doc.count() + b.env.count() + b.media.count(), 0);
  }
});

test('Care toolbar opens the existing care callback without granting or restarting anything', async () => {
  let opened = 0;
  const b = browser({ controller: { onCare: () => opened++ } });
  await b.controller.start();
  const pad = b.doc.body.children[0].children[0];
  const actions = pad.children[2].children[1];
  assert.equal(actions.children[0].textContent, 'Care');
  actions.children[0].fire('click', { stopPropagation() {} });
  assert.equal(opened, 1); assert.equal(b.callbacks.takeoff, 1); assert.equal(b.controller.active, true);
  b.controller.dispose();
});

test('missing or malformed atlas fails cleanly without hiding the perched Merlin', async () => {
  for (const loadAtlas of [() => Promise.reject(new Error('offline miss')), () => Promise.resolve({ naturalWidth: 10, naturalHeight: 10 })]) {
    const b = browser({ loadAtlas }); assert.equal(await b.controller.start(), false);
    assert.equal(b.callbacks.takeoff, 0); assert.equal(b.controller.active, false);
    assert.equal(b.callbacks.errors.length, 1); assert.equal(b.queue.size, 0);
  }
});

test('backgrounding, pagehide, resizing, orientation, navigation and motion changes clean every listener', async () => {
  for (const reason of ['hidden', 'pagehide', 'resize', 'orientationchange', 'navigation', 'motion']) {
    const b = browser(); await b.controller.start(); b.tick();
    if (reason === 'hidden') { b.doc.hidden = true; b.doc.fire('visibilitychange'); }
    else if (reason === 'navigation') b.navigate();
    else if (reason === 'motion') b.media.fire('change');
    else b.env.fire(reason);
    assert.equal(b.controller.active, false, reason); assert.equal(b.queue.size, 0, reason);
    assert.equal(b.callbacks.restore, 1, reason); assert.equal(b.doc.count() + b.env.count() + b.media.count(), 0, reason);
    b.controller.stop('again'); assert.equal(b.callbacks.restore, 1);
  }
});

test('play expiry uses elapsed real time even when rendering is very slow', async () => {
  const b = browser(); await b.controller.start(); b.tick();
  for (let i = 0; i < 51; i++) b.tick(500);
  assert.equal(b.controller.diagnostics.state.state, 'landing');
  for (let i = 0; i < 120; i++) b.tick();
  assert.equal(b.controller.active, false);
});

test('input capture is confined to the play sky, with native control cutouts and 44px Finish', async () => {
  const b = browser();
  const control = new Element('button', b.doc);
  control.rect = { left: 150, right: 240, top: 260, bottom: 310, width: 90, height: 50 };
  b.doc.controls.push(control);
  await b.controller.start(); b.tick();
  for (const type of ['click', 'pointerdown', 'pointerup', 'touchstart', 'touchmove', 'touchend']) assert.equal(b.doc.listeners.get(type)?.size || 0, 0);
  const pad = b.doc.body.children[0].children[0], touchField = pad.children[0];
  assert.ok(touchField.children.length > 1, 'input surface is split around control');
  for (const tile of touchField.children) {
    const x = parseFloat(tile.style.left) + 12, y = parseFloat(tile.style.top) + parseFloat(pad.style.top);
    const right = x + parseFloat(tile.style.width), bottom = y + parseFloat(tile.style.height);
    assert.ok(right <= 146 || x >= 244 || bottom <= 256 || y >= 314, 'native control receives its own pointer events');
  }
  assert.equal(Flight.isInteractiveTarget(control, pad, b.env), true);
  b.controller.dispose(); assert.equal(await b.controller.start(), false);
});
