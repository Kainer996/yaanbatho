'use strict';
// Run the real catalogue composition and card/sprite resolvers without a save or DOM.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const painting = '/burbz/bird-art-cache/raven_burbz_cloaked_mountain_20260923.webp';
const warrior = '/burbz/bird-art-cache/raven_burbz_manga_warrior_20260802.png';
const sprite = '/burbz/bird-art-cache/cutouts/raven_burbz_manga_warrior_20260802_cutout.png';
const context = { window: {}, UK50:{art:{}}, UK26:{art:{}}, AU_EXP:{art:{}}, UK_FINAL:{art:{}}, AU50:{art:{}}, UK4:{art:{}}, findSpeciesProfile: name => name === 'Corvus corax' ? {name:'Raven',aliases:['Common Raven']} : null,
  canonicalSpeciesName: name => ['Common Raven', 'Corvus corax'].includes(name) ? 'Raven' : name,
  getBirdMarkerEmoji: () => 'bird', escapeHtml: value => String(value) };
vm.createContext(context);
for (const file of ['bird_art_release_20260727.js', 'bird_art_release_20260803.js', 'bird_art_release_20260901.js']) {
  vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
}
vm.runInContext('const GENERATED_ART_COMPLETION = window.BURBZ_GENERATED_ART_COMPLETION_20260726;', context);
vm.runInContext(html.slice(html.indexOf('const BUILT_IN_BIRD_ART = {'), html.indexOf('function birdHabitatArtKey(')), context);
// Extract complete top-level functions using the next top-level function boundary.
function loadFunction(name) {
  const start = html.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  const end = html.indexOf('\n}', start) + 2;
  vm.runInContext(html.slice(start, end), context);
}
vm.runInContext('const LEGACY_BIRD_ART_REPLACEMENTS = {};', context);
for (const name of ['replaceLegacyBirdArtUrl','resolveBirdArtFromMap','resolveBuiltInBirdArt','resolveBuiltInBirdCardArt','getBirdArtUrl','getBirdCardArtUrl','birdCutoutUrlFor','birdOnlyImgHTML','birdCardImgAttrs']) loadFunction(name);
const mapStart = html.indexOf('const MAP_BIRD_CUTOUT_ART = {');
vm.runInContext(html.slice(mapStart, html.indexOf('\n};', mapStart) + 3), context);
const run = code => vm.runInContext(code, context);
for (const species of ['Raven','Common Raven','Corvus corax']) {
  for (const saved of [warrior, '/burbz/bird-art-cache/raven_burbz_manga_20260624_v2.png', 'https://example.invalid/old-art.png', null, {old:true}]) {
    const bird = {species, commonName:species, name:'Player nickname', artUrl:saved, xp:1234, level:12, bond:83, hp:77, equipment:{weapon:'kept'}};
    context.bird = bird;
    const before = JSON.stringify(bird);
    const card = run('birdCardImgAttrs(bird)');
    assert.equal(card.src, painting, species);
    assert(!card.isCutout);
    assert(card.extra.includes('card-art-painting'));
    assert.equal(run('getBirdArtUrl(bird)'), warrior, 'sprite/icon art stays unchanged');
    assert(run("birdOnlyImgHTML(bird, 'moving')").includes(sprite));
    assert.equal(JSON.stringify(bird), before, 'rendering must not mutate saved progression or art');
  }
}
assert.notEqual(run("resolveBuiltInBirdCardArt('Little Raven')"), painting);
assert.notEqual(run("resolveBuiltInBirdCardArt('Australian Raven')"), painting);
assert.equal(run("resolveBuiltInBirdCardArt('Blue Tit')"), '/burbz/assets/bird-cards-v411/blue_tit-manga-20260914.webp');
const bytes = fs.readFileSync(path.join(root, painting.replace('/burbz/', '')));
assert.equal(bytes.toString('ascii', 0, 4), 'RIFF');
assert.equal(bytes.toString('ascii', 8, 12), 'WEBP');
assert.equal(bytes.toString('ascii', 12, 16), 'VP8L', 'lossless WebP');
console.log('PASS: 15 saved Raven/alias fixtures select the painting, preserve progression and transparent sprites; other ravens/art remain unchanged; lossless WebP exists.');
