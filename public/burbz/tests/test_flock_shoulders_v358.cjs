// Run the actual production factory and animation, without a DOM or fake THREE.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const THREE = require('../lib/three.min.js');
const html = fs.readFileSync(process.env.BURBZ_TEST_HTML || require.resolve('../index.html'), 'utf8');
function fn(name) {
  const start = html.indexOf('function ' + name + '(');
  assert(start >= 0, name);
  return html.slice(start, html.indexOf('\n}', start) + 2);
}
const ctx = { THREE, villageFlocks: [] };
vm.createContext(ctx);
vm.runInContext(fn('villageMakeOverheadFlock') + '\n' + fn('villageAnimateFlockActors'), ctx);
let seed = 358;
const rng = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
for (const count of [2, 5, 9]) {
  const flock = ctx.villageMakeOverheadFlock(rng, { timber: 0x624128 }, count);
  assert.equal(flock.userData.members.length, count);
  for (const speed of [-0.075, 0.075]) {
    flock.userData.speed = speed;
    for (let frame = 0; frame <= 240; frame++) {
      ctx.villageAnimateFlockActors([flock], frame / 24);
      flock.updateMatrixWorld(true);
      for (const bird of flock.userData.members) {
        for (const side of ['left', 'right']) {
          const wing = bird.userData[side];
          wing.geometry.computeBoundingBox();
          // The old boxes hinge at their centres: their inner edge leaves the
          // ellipsoid on every stroke. The new geometry originates at a shoulder.
          const root = wing.userData.shoulderRoot
            ? new THREE.Vector3(...wing.userData.shoulderRoot)
            : new THREE.Vector3(0, 0, side === 'left' ? wing.geometry.boundingBox.min.z : wing.geometry.boundingBox.max.z);
          bird.worldToLocal(wing.localToWorld(root));
          const inside = (root.x / 0.12375) ** 2 + (root.y / 0.06) ** 2 + (root.z / 0.0615) ** 2;
          assert(inside < 1, `${side} wing detached: shoulder radius²=${inside.toFixed(3)}, frame=${frame}`);
        }
      }
      // Body +X faces the actual tangent, including clockwise flight.
      const ph = flock.userData.phase + frame / 24 * speed;
      const heading = new THREE.Vector3(1, 0, 0).applyQuaternion(flock.quaternion);
      const tangent = new THREE.Vector3(-Math.sin(ph), 0, Math.cos(ph) * .72).multiplyScalar(Math.sign(speed)).normalize();
      assert(heading.dot(tangent) > .999999);
    }
  }
}
assert(html.includes('villageAnimateFlockActors(townFlocks,'), 'town must use the same corrected animation');
console.log('PASS: both shoulders stay inside every body through 8,192+ full-wave poses; both route directions face forwards.');
