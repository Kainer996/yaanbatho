'use strict';

const assert = require('node:assert/strict');

global.window = global;
const core = require('../village_discovery_core.js');

const ids = (prefix, count) => Array.from({ length: count }, (_, i) => prefix + String(i + 1).padStart(2, '0'));
const requestStageCounts = [3,3,3,3,3,3,3,2,3,3,3,3,3,2,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,3,2,3,3,3,3,3,3,3,3,3,3,3,3,3];

assert.deepEqual(core.QUESTS.map(q => q.id), ids('vq', 50), 'request IDs/order stay stable');
assert.deepEqual(core.LORE.map(l => l.id), ids('vl', 30), 'lore IDs/order stay stable');
assert.deepEqual(core.ACTIVITIES.map(a => a.id), ids('vf', 12), 'fieldwork IDs/order stay stable');
assert.deepEqual(core.QUESTS.map(q => q.steps.length), requestStageCounts, 'request stage counts stay stable');
assert(core.QUESTS.every(q => q.steps.every(step => step.label && step.done)), 'every request stage keeps playable label and done copy');
assert(core.ACTIVITIES.every(a => a.steps.length === 3), 'fieldwork stories keep three stages');

const inventory = core.editorialInventory();
assert.equal(inventory.requests.length, 50);
assert.equal(inventory.fieldwork.length, 12);
assert.deepEqual(inventory.loreIds, ids('vl', 30));

for (const row of inventory.requests) {
  assert.match(row.offer, /Need:/, row.id + ' offer explains need');
  assert.match(row.offer, /Work:/, row.id + ' offer explains work');
  assert.match(row.offer, /Reward: 30 coins and 2 Oak Twigs/i, row.id + ' offer names reward');
  assert.match(row.offer, /Accept only here/i, row.id + ' offer preserves physical authority');
  assert.equal(row.objectives.length, row.stageCount);
  assert(row.objectives.every(step => /Current task:/.test(step.guidance) && /blue marker/.test(step.guidance)), row.id + ' objectives are actionable');
  assert.match(row.completion, /Return to a villager or request post/i, row.id + ' completion gives return target');
}

for (const row of inventory.fieldwork) {
  assert.equal(row.objectives.length, 3);
  assert(row.objectives.every(step => /Current fieldwork:/.test(step.guidance) && /story marker/.test(step.guidance)), row.id + ' fieldwork objectives are actionable');
  assert(row.completion.length > 40, row.id + ' keeps completion lore');
}

console.log('PASS village quest writing inventory v431');
