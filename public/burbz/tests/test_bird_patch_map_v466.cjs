'use strict';
// bird-patch-map-v466: a bird's home patch on the real map, and "same bird".
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const C = require('../bird_home_range_core.js');
const dir = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');
const PIN = 'bird-patch-map-v466-20260924';

// Names in the catalogue resolve to one patch key.
assert.equal(C.keyOf('European Robin'), 'robin');
assert.equal(C.keyOf('Common Raven'), 'raven');
assert.equal(C.keyOf('Eurasian Wren'), 'wren');
assert.equal(C.keyOf('Tawny Owl'), 'tawny owl');
assert.equal(C.keyOf('Wood Pigeon'), C.keyOf('Woodpigeon'));

// A robin keeps a small patch; a raven roams miles.
const robin = C.rangeFor('European Robin'), tawny = C.rangeFor('Tawny Owl'), raven = C.rangeFor('Raven');
assert(robin.radiusM <= 60 && !robin.estimated);
assert(tawny.radiusM >= 150 && tawny.radiusM <= 400 && tawny.pair && tawny.faithful === 'life');
assert(raven.radiusM >= 2000);
assert(robin.radiusM < tawny.radiusM && tawny.radiusM < raven.radiusM);
assert.notEqual(robin.color, raven.color);
for (const [key, r] of Object.entries(C.RANGES)) {
  assert(/^#[0-9a-f]{6}$/i.test(r.color), key + ' colour');
  assert(r.r >= 40 && r.r <= 10000, key + ' radius');
  assert(['life', 'season', 'roams'].includes(r.faithful), key + ' faithful');
  assert(r.note && r.note.length < 160, key + ' note');
}

// Unknown birds get an honest estimate that grows with size and hunting.
const small = C.rangeFor('Made-up Warbler', { massG: 10, guild: 'songbird' });
const hunter = C.rangeFor('Made-up Hawk', { massG: 900, guild: 'raptor' });
assert(small.estimated && hunter.estimated);
assert(small.radiusM < hunter.radiusM);
assert(/^hsl\(/.test(small.color));
assert.equal(C.rangeFor('Made-up Warbler').color, C.rangeFor('Made-up Warbler').color);

// Distance sanity: 0.001° of latitude is ~111 m.
assert(Math.abs(C.distanceM({ lat: 53.87, lng: -2.39 }, { lat: 53.871, lng: -2.39 }) - 111.2) < 1);

// Yaan's story: two tawny owls at the quarry, heard night after night.
const quarry = { lat: 53.8712, lng: -2.3921 };
const day = 24 * 3600 * 1000;
const t0 = Date.UTC(2026, 8, 20, 21, 0);
let log = [];
let r = C.recordEncounter(log, 'Tawny Owl', quarry, { now: t0 });
log = r.log;
assert.equal(r.lesson.kind, 'first');
assert.match(r.lesson.text, /Tawny Owl lives around here/);
assert.match(r.lesson.text, /250 m/);

// The owl keeps calling that evening: one visit, not two.
r = C.recordEncounter(log, 'Tawny Owl', { lat: 53.8714, lng: -2.3925 }, { now: t0 + 10 * 60 * 1000 });
log = r.log;
assert.equal(r.lesson.kind, 'same-visit');
assert.equal(r.patch.visits, 1);

// Next night, 120 m away: the same pair. This is the lesson.
r = C.recordEncounter(log, 'Tawny Owl', { lat: 53.8722, lng: -2.3910 }, { now: t0 + day });
log = r.log;
assert.equal(r.lesson.kind, 'same-bird');
assert.equal(r.patch.visits, 2);
assert.match(r.lesson.text, /right here yesterday/);
assert.match(r.lesson.text, /same pair/);
assert.match(r.lesson.text, /Birds are not all over the place/);

// Third night: a neighbour.
r = C.recordEncounter(log, 'Tawny Owl', quarry, { now: t0 + 2 * day });
log = r.log;
assert.equal(r.lesson.kind, 'neighbour');
assert.equal(r.patch.visits, 3);
assert.equal(r.patch.days, 3);

// A tawny owl 5 km away is a different owl with its own patch.
r = C.recordEncounter(log, 'Tawny Owl', { lat: 53.9160, lng: -2.3921 }, { now: t0 + 2 * day + 3600e3 });
log = r.log;
assert.equal(r.lesson.kind, 'first');
// A raven 1.5 km away is still inside its huge patch: the same pair.
let rl = [];
rl = C.recordEncounter(rl, 'Raven', quarry, { now: t0 }).log;
const rv = C.recordEncounter(rl, 'Common Raven', { lat: 53.8850, lng: -2.3921 }, { now: t0 + day });
assert.equal(rv.lesson.kind, 'same-bird');
// A robin 300 m away is a different robin.
let bl = C.recordEncounter([], 'Robin', quarry, { now: t0 }).log;
assert.equal(C.recordEncounter(bl, 'European Robin', { lat: 53.8739, lng: -2.3921 }, { now: t0 + day }).lesson.kind, 'first');

// The map draws each known patch once.
const patches = C.knownPatches(log);
assert.equal(patches.filter(p => p.key === 'tawny owl').length, 2);
const home = patches.find(p => p.key === 'tawny owl' && p.visits === 3);
assert(home && C.distanceM(home.center, quarry) < 150);

// Bad input never throws or saves junk.
assert.equal(C.recordEncounter(log, 'Tawny Owl', null).patch, null);
assert.equal(C.recordEncounter(log, 'Tawny Owl', { lat: 0, lng: 0 }).patch, null);
assert.equal(C.recordEncounter(log, '', quarry).patch, null);
assert.deepEqual(C.loadLog({ getItem: () => '{broken' }), []);
const mem = new Map(); const store = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) };
assert(C.saveLog(store, log));
assert.equal(C.loadLog(store).length, log.length);
let big = [];
for (let i = 0; i < C.MAX_ENCOUNTERS + 50; i++) big = C.recordEncounter(big, 'Wren', { lat: 50 + i * 0.01, lng: -2 }, { now: t0 + i }).log;
assert.equal(big.length, C.MAX_ENCOUNTERS);
console.log('Home range core: ranges, colours, same-bird lessons, patches and storage pass.');

// The patch map is wired into the game and shipped offline.
const html = read('index.html'), sw = read('sw.js');
const updater = fs.readFileSync(path.join(dir, '../../scripts/update-live-burbz.sh'), 'utf8');
for (const f of ['bird_home_range_core.js', 'bird_patch_map.js']) assert(html.includes(`<script src="${f}?v=${PIN}"></script>`), f);
assert(html.includes(`<link rel="stylesheet" href="bird_patch_map.css?v=${PIN}">`));
assert(html.indexOf('bird_home_range_core.js?v=') < html.indexOf('bird_patch_map.js?v='));
for (const list of ['BURBZ_ASSETS', 'BURBZ_CORE', 'BURBZ_INSTALL_REQUIRED']) {
  const start = sw.indexOf('const ' + list + ' = ['), body = sw.slice(start, sw.indexOf('];', start));
  for (const f of ['bird_home_range_core.js', 'bird_patch_map.js', 'bird_patch_map.css']) assert.equal(body.split(`'./${f}?v=${PIN}'`).length - 1, 1, list + ' ' + f);
}
assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].split('-' + PIN).length === 2);
assert.equal(html.match(/const BURBZ_BUILD = '([^']+)'/)[1], PIN);
for (const f of ['bird_home_range_core.js', 'bird_patch_map.js', 'bird_patch_map.css']) assert(updater.includes(`"${f}"`), 'updater ' + f);
for (const id of ['birdPatchPanel', 'birdPatchMap', 'birdPatchLegend', 'birdPatchLesson', 'birdPatchOpenMap']) assert(html.includes(`id="${id}"`), id);
assert(html.includes("if (typeof birdPatchMeet === 'function') birdPatchMeet(surfaced, opts.source);\n  return surfaced;"), 'confirmed birds reach the patch map');
const commitOnly = html.slice(html.indexOf('if (opts.commitOnly) {'), html.indexOf('const newDiscoveries = [];'));
assert(!commitOnly.includes('birdPatchMeet'), 'queued photos are not placed at the claim spot');
assert(html.includes('window.BurbzBirdPatchMap?.attachLiveMap(liveMap);'));
assert(html.includes('window.BurbzBirdPatchMap.setListening(active);'));
assert(html.includes('This phone keeps where you met each bird'));
assert(!html.includes('raw coordinates are not stored.'));
console.log('Bird patch map: wiring, pins, worker lists and updater pass.');
