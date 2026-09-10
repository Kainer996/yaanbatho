'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Flight = require('../merlin_flight.js');
const win = {};
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../assets/merlin-flight/atlas-config.js'), 'utf8'), { window: win });
const atlas = win.MERLIN_FLIGHT_ATLAS;

test('164 unique source cells describe five 16-pose flaps, six 8-pose glides and three 12-pose pickups', () => {
  assert.equal(atlas.version, 2);
  assert.equal(atlas.frames.length, 164);
  assert.equal(new Set(atlas.frames.map(f => f.source.join(','))).size, 164);
  for (let view = 0; view < 5; view++) assert.equal(atlas.clips['flap-' + view].length, 16);
  for (let view = 0; view < 6; view++) assert.equal(atlas.clips['glide-' + view].length, 8);
  for (let view = 0; view < 3; view++) assert.equal(atlas.clips['pickup-' + view].length, 12);
  for (const ids of Object.values(atlas.clips)) assert.equal(new Set(ids).size, ids.length);
  for (const f of atlas.frames) {
    assert.ok(f.talon.every(n => Number.isFinite(n) && n > 0 && n < 1));
    assert.ok(f.source[0] + f.source[2] <= atlas.columns * atlas.cell);
    assert.ok(f.source[1] + f.source[3] <= atlas.rows * atlas.cell);
  }
  assert.ok(atlas.columns * atlas.rows * atlas.cell ** 2 * 4 <= 24 * 1024 ** 2, 'decoded atlas stays below 24 MiB');
});

test('real-time flight visits all 16 flap poses and eight changing glide poses', () => {
  const model = new Flight.FlightModel({ atlas, rng: () => .5 });
  const flap = new Set(), glide = new Set();
  let glideFrames = 0;
  for (let i = 0; i < 1350; i++) {
    const view = model.step(1 / 60);
    if (view.clip.startsWith('flap-')) flap.add(view.frame);
    if (view.clip.startsWith('glide-')) { glide.add(view.frame); glideFrames++; assert.equal(view.powered, false); }
  }
  assert.equal(flap.size, 16);
  assert.equal(glide.size, 8);
  assert.ok(glideFrames >= 75 && glideFrames < 550);
});

test('all three approach directions extend, touch, close and retract their authored feet', () => {
  for (const [x, expected] of [[500, 0], [600, 1], [850, 2]]) {
    const model = new Flight.FlightModel({ atlas, bounds: Flight.flightBounds(1000, 800, 152), rng: () => .5 });
    model.position = { x: 500, y: 300, z: .6 };
    model.returnPoint = { x: 180, y: 250, z: .7 };
    model.drop(x, 500);
    assert.equal(model.pickupView, expected);
    const target = { x: model.token.x, y: model.token.floorY };
    const reach = new Set(), retract = new Set();
    let touched = false, contactMirror;
    for (let i = 0; i < 450 && !model.deposited; i++) {
      const before = !!model.carrying, view = model.step(1 / 60);
      if (view.clip === 'pickup-' + expected) {
        if (!view.carrying) reach.add(view.frame);
        else {
          retract.add(view.frame);
          if (contactMirror !== undefined) assert.equal(view.mirror, contactMirror, 'authored recovery never mirrors a profile in place');
        }
      }
      if (!before && view.carrying) {
        const talon = Flight.spriteGeometry(view, model.size, atlas).talon;
        assert.ok(Math.hypot(talon.x - target.x, talon.y - target.y) < .01);
        assert.equal(view.frame, 5); touched = true; contactMirror = view.mirror;
      }
    }
    assert.deepEqual([...reach].sort((a,b)=>a-b), [0,1,2,3,4,5]);
    assert.deepEqual([...retract].sort((a,b)=>a-b), [5,6,7,8,9,10,11]);
    assert.ok(touched && model.deposited);
    assert.equal(model.pickups, 1);
  }
});

test('new atlas uses authored rectangles, with bounded grip interpolation and no inverted triangles', () => {
  const model = new Flight.FlightModel({ atlas, rng: () => .5 });
  for (let i = 0; i < 180; i++) model.step(1 / 60);
  model.drop(245, 430);
  const drawn = new Set();
  let triangles = 0;
  const ctx = { save(){}, restore(){}, translate(){}, rotate(){}, scale(){}, beginPath(){}, moveTo(){}, lineTo(){}, closePath(){}, clip(){},
    transform(a,b,c,d,e,f) { assert.ok([a,b,c,d,e,f].every(Number.isFinite)); assert.ok(a*d-b*c>0); triangles++; },
    drawImage(image,sx,sy,sw,sh) { drawn.add(sx+','+sy); assert.equal(sw,192); assert.ok(sh>0&&sh<=192); }
  };
  for (let i = 0; i < 550; i++) Flight.drawSprite(ctx, {}, model.step(1/60), { atlas, size: 152 });
  assert.ok(drawn.size > 30); assert.ok(triangles > 0);
});

test('reduced-motion uses a static authored pose and still returns one cosmetic pebble', () => {
  const model = new Flight.FlightModel({ atlas, reducedMotion: true });
  const start = { ...model.position };
  model.drop(240, 430);
  for (let i = 0; i < 80; i++) {
    const view = model.step(1/60);
    assert.equal(view.clip, 'glide-1'); assert.equal(view.frame, 0);
    assert.deepEqual(view.position, start);
  }
  assert.equal(model.pickups, 1); assert.equal(model.carrying, null);
});
