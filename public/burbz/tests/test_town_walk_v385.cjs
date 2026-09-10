const assert = require('node:assert/strict');
const T = require('../lib/three.min.js');
globalThis.BurbzVillageWalkCore = require('../village_walk_core.js');
require('../village_walk_scene.js');

// Town overview hit targets deliberately include its ground, charter stone,
// civic hall and real buildings. Collision must retain that original registry.
const scene = new T.Scene();
const material = new T.MeshStandardMaterial();
const ground = new T.Mesh(new T.CircleGeometry(32, 80), material);
ground.rotation.x = -Math.PI / 2;
ground.userData.townGround = true;
scene.add(ground);

const standard = new T.Mesh(new T.BoxGeometry(.8, 1.2, .8), material);
standard.position.y = .6;
standard.userData.townHallStone = true;
scene.add(standard);

const hall = new T.Mesh(new T.BoxGeometry(6, 4, 4), material);
hall.position.set(-11.5, 2, .5);
hall.userData.townHall = true;
scene.add(hall);

const cabin = new T.Mesh(new T.BoxGeometry(6, 3, 2), material);
cabin.position.set(8, 1.5, -6);
cabin.rotation.y = Math.PI / 4;
cabin.userData.buildingId = 'cabin';
cabin.userData.footprint = { minX: -3, maxX: 3, minZ: -1, maxZ: 1 };
scene.add(cabin);

const targets = [ground, standard, hall, cabin];
const originalTargets = targets.slice();
const world = BurbzVillageWalkScene.create(T, scene, targets, [], {
  radius: 30, heightAt: () => 0, river: null
});
const spawn = world.spawn();
assert(world.allowed(spawn.x, spawn.z), 'a town containing its ground target has a safe spawn');
assert(world.allowed(4.8, 7.5), 'the original preferred footpath remains usable');
assert(world.allowed(0, 5), 'clear plaza floor remains walkable');
assert(!world.allowed(0, 0), 'the charter stone remains physical');
assert(!world.allowed(-11.5, .5), 'the actual hall remains solid');
assert(!world.allowed(-8.4, .5), 'hall wall retains player-radius clearance');
assert(!world.allowed(8, -6), 'the actual cabin remains solid');
assert.equal(world.polygons.length, 3, 'only the three physical structures produce polygons');
assert.equal(world.segments.length, 0, 'registered ground and buildings are not sliced again');

const cabinPoint = (x, z) => new T.Vector3(x, 0, z).applyMatrix4(cabin.matrixWorld);
const inside = cabinPoint(2.5, 0), beside = cabinPoint(0, 2);
assert(!world.allowed(inside.x, inside.z), 'rotated cabin footprint blocks its actual interior');
assert(world.allowed(beside.x, beside.z), 'rotated footprint leaves clear floor inside its larger world AABB open');

assert.equal(targets.length, originalTargets.length);
for (let i = 0; i < targets.length; i++) assert.equal(targets[i], originalTargets[i]);
assert.equal(targets[0].userData.townGround, true, 'ground remains registered for ledger taps');
assert.equal(ground.parent, scene);
assert.equal(ground.visible, true);
for (const object of targets) object.geometry.dispose();
material.dispose();
console.log('Town walking: registered ground permits spawn and clear floor, hall/charter/cabin collisions remain, rotated footprints and original tap targets are preserved.');
