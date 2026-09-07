const fs = require('node:fs'), vm = require('node:vm'), assert = require('node:assert/strict');
const THREE = require('../lib/three.min.js');
const source = fs.readFileSync(require.resolve('../academy_3d_core.js'),'utf8');
// Test-only access to the existing private factory; do not ship a debug export.
const injected = source.replace('createAcademy3D: createAcademy3D', `createAcademy3D: createAcademy3D,
  testHouse: function(three, id) { T=three; return buildTreehouse(id,
    {plank:new T.MeshLambertMaterial({color:0x94734c})},mulberry32(358)); }`);
const ctx = {module:{exports:{}},document:{createElement:()=>({getContext:()=>({
  createRadialGradient:()=>({addColorStop(){}}),fillRect(){}
})})}};
vm.runInNewContext(injected,ctx);
const academy=ctx.module.exports;
let totalTriangles=0;
for(const id of Object.keys(academy.ANCHORS)) {
  const h=academy.testHouse(THREE,id),a=h.userData.architecture;
  assert.equal(a.version,358);assert.equal(a.signature,academy.STYLES[id].signature);
  assert(a.parts.joinery>=4);assert(id==='observatory'||a.parts.shingles>=70);
  const meshes=[];h.traverse(o=>{if(o.isMesh){meshes.push(o);assert.equal(o.userData.roomId,id);}});
  const shells=meshes.filter(o=>o.name===id+'-shell');assert.equal(shells.length,1);
  const shell=shells[0];assert(shell.material.vertexColors);assert(!shell.material.map);
  for(const mesh of meshes) {
    for(const attr of Object.values(mesh.geometry.attributes))for(const n of attr.array)assert(Number.isFinite(n),id+' finite attributes');
    totalTriangles+=(mesh.geometry.index?.count||mesh.geometry.attributes.position.count)/3;
  }
  assert(meshes.length<=20,id+' bounded draw calls');
  assert(h.userData.glows.length>=1);
  for(const key of ['sign','swing','vane','scope'])if(h.userData[key]){
    assert(h.userData[key].parent===h);assert(h.userData[key].children.some(c=>c.isMesh),key+' stays independently animated');
  }
  // No geometry vertex may escape the room-sized model into a screen-wide line.
  const box=new THREE.Box3().setFromObject(h),size=box.getSize(new THREE.Vector3());
  assert(size.toArray().every(n=>n>0&&n<6),id+' bounded geometry');
}
assert(totalTriangles<125000,'all 13 houses fit the geometry budget');
console.log(`PASS: 13 distinct bounded models, merged shells, finite normals/positions, glow/animation hooks; ${Math.round(totalTriangles)} triangles.`);
