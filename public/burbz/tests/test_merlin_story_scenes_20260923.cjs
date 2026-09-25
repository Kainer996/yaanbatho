'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'merlin_story_scenes.js');
assert(fs.existsSync(source), 'Initial Merlin lessons need a dedicated illustrated scene presenter');
const scenes = require(source);
const ids = ['lesson-0', 'alderwing-story-v420-4', 'alderwing-story-v420-5', 'alderwing-story-v420-7', 'alderwing-hub-v420'];
const selected = ids.map(id => scenes.sceneFor(id));
assert(selected.every(Boolean), 'Each of the five opening beats has its own painting');
assert.equal(new Set(selected.map(scene => scene.key)).size, ids.length);
for (const scene of selected) {
  assert(scene.description, 'Art remains understandable without images');
  assert(scene.image && !scene.image.includes('..') && !scene.image.includes('://'));
  assert(fs.existsSync(path.join(root, scene.image)), 'Every finished painting is same-origin');
}
for (const id of [null, '', 'lesson-12', 'alderwing-story-v420-1', 'alderwing-story-v420-9', 'alderwing-arrival-v395', 'alderwing-desk-v395', '__proto__', 'constructor']) {
  assert.equal(scenes.sceneFor(id), null, `Never cover gameplay or later lessons: ${id}`);
}
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const steps = html.match(/const MERLIN_TUTORIAL_STEPS = (\[.*?\n\]);/s)[1];
assert.equal(crypto.createHash('sha256').update(steps).digest('hex'), '55bfd15e493da45af2995bb052d6847b09b496358ead7758fb87456fe2a67198', 'Lesson text, IDs, order and actions change only on purpose (v467 cut the opening story to four beats; v469 paced the lessons after Alderwing and cut the Play step)');
assert(html.includes('BurbzMerlinStoryScenes?.show('));
assert(html.includes('BurbzMerlinStoryScenes?.clear('));
assert(!fs.readFileSync(source, 'utf8').match(/localStorage|requestAnimationFrame|setInterval|fetch\(/), 'Presentation has no persistence, loop or external requests');
console.log('PASS five scene mappings, unknown/action exclusion, finished artwork, immutable lesson contract and read-only presenter');
