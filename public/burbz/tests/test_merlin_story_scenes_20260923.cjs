'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'merlin_story_scenes.js');
assert(fs.existsSync(source), 'Initial Merlin lessons need a dedicated illustrated scene presenter');
const scenes = require(source);
const ids = ['lesson-0', ...Array.from({length:9}, (_, i) => `alderwing-story-v420-${i + 1}`), 'alderwing-hub-v420'];
const selected = ids.map(id => scenes.sceneFor(id));
assert(selected.every(Boolean), 'Each of the eleven opening beats has a supporting scene');
assert.equal(new Set(selected.map(scene => scene.key)).size, ids.length);
for (const scene of selected) {
  assert(scene.label && scene.description, 'Art remains understandable without images');
  for (const item of scene.items) {
    assert(item.label);
    if (item.image) {
      assert(!item.image.includes('..') && !item.image.includes('://'));
      assert(fs.existsSync(path.join(root, item.image)), 'Reuse only existing same-origin artwork');
    }
  }
}
for (const id of [null, '', 'lesson-12', 'alderwing-arrival-v395', 'alderwing-desk-v395', '__proto__', 'constructor']) {
  assert.equal(scenes.sceneFor(id), null, `Never cover gameplay or later lessons: ${id}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const steps = html.match(/const MERLIN_TUTORIAL_STEPS = (\[.*?\n\]);/s)[1];
assert.equal(crypto.createHash('sha256').update(steps.split('\n').slice(1,12).join('\n')).digest('hex'), '49e9e0f24e938da6169a16b27964b295fc1f3be1b13f28258c1d0cf67cee0e48', 'First eleven illustrated story beats remain byte-identical');
assert.equal(crypto.createHash('sha256').update(steps).digest('hex'), '27d99b40edcb5b75d03b4df5d5999c0137b3446d16ba79a6fe984378e06a23ca', 'Later Academy targets/copy follow canonical Home; lesson IDs and action events retained');
assert(html.includes('BurbzMerlinStoryScenes?.show('));
assert(html.includes('BurbzMerlinStoryScenes?.clear('));
assert(!fs.readFileSync(source, 'utf8').match(/localStorage|requestAnimationFrame|setInterval|fetch\(/), 'Presentation has no persistence, loop or external requests');
console.log('PASS eleven scene mappings, unknown/action exclusion, existing artwork, immutable lesson contract and read-only presenter');
