'use strict';
// Village folk v472: rigged villagers and animals, one skinned mesh each,
// dressed for their work, walking on the ground they cover.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const T=require('../lib/three.min.js');
require('../settlement_models.js');require('../village_animals.js');
const M=globalThis.BurbzSettlementModels,A=globalThis.BurbzVillageAnimals;
const BUILD='village-folk-v472-20260925';
const meshes=o=>{const out=[];o.traverse(n=>{if(n.isMesh)out.push(n);});return out;};
const tris=o=>meshes(o).reduce((n,m)=>n+(m.geometry.index?m.geometry.index.count:m.geometry.attributes.position.count)/3,0);
const world=(o,obj)=>{o.updateMatrixWorld(true);return obj.getWorldPosition(new T.Vector3());};

test('rig merges parts into one skinned mesh that frees its bones with its geometry',()=>{
  M.setSkinning(true);
  const r=M.rig(T);r.bone('body',null,[0,0,0]);r.bone('hip','body',[0,.5,0]);r.bone('knee','hip',[0,.25,0]);
  r.sphere(.1,[0,.5,0],0xaa3322,'hip');r.limb([0,.5,0],[0,.02,0],.05,.04,0x335577,'hip',{bone:'knee',from:[0,.3,0],to:[0,.2,0]});
  const f=r.finish({meshUnder:'body',pad:[.2,.05,.2]});
  assert.equal(meshes(f.object).length,1);assert.ok(f.mesh.isSkinnedMesh);
  assert.equal(f.bones.body.children[0],f.mesh,'the mesh hangs first under its root bone');
  const box=new T.Box3().setFromObject(f.object);assert.ok(Math.abs(box.max.y-.65)<1e-6&&Math.abs(box.min.y-(-.03))<1e-6,JSON.stringify(box));
  // A bent knee moves the shin, the hip sphere stays put.
  f.bones.knee.rotation.x=1;f.object.updateMatrixWorld(true);f.mesh.skeleton.update();
  const top=f.mesh.getVertexPosition(0,new T.Vector3());assert.ok(Math.abs(top.y-.6)<1e-6);
  let freed=0;const skeleton=f.mesh.skeleton;skeleton.dispose=()=>freed++;f.mesh.geometry.dispose();assert.equal(freed,1);
});

test('a phone that cannot skin still gets jointed rigid pieces',()=>{
  M.setSkinning(false);
  try{
    const r=M.rig(T);r.bone('body',null,[0,0,0]);r.bone('knee','body',[0,.3,0]);
    r.box([.2,.2,.2],[0,.5,0],0xffffff,'body');r.box([.1,.3,.1],[0,.15,0],0x000000,'knee');
    const f=r.finish({meshUnder:'body'});
    assert.ok(f.rigid);assert.equal(meshes(f.object).length,2);assert.ok(meshes(f.object).every(m=>!m.isSkinnedMesh));
    f.bones.knee.rotation.z=Math.PI/2;const shin=meshes(f.bones.knee)[0];f.object.updateMatrixWorld(true);
    const b=new T.Box3().setFromObject(shin);assert.ok(b.max.x-b.min.x>.25,'the shin turned with its bone');
  }finally{M.setSkinning(true);}
});

test('pen animals walk head first, stay inside their rails and graze on the grass',()=>{
  for(const kind of ['sheep','cattle','goat','pig']){
    const pen=new T.Group(),mates=[];
    for(let i=0;i<4;i++){
      const g=A.make(T,kind,40+i);Object.assign(g.userData,{livestockKind:kind,phase:i*1.7,pen:{hw:.9,hd:.7},penMates:mates});
      g.position.set(i*.4-.6,0,i%2?.3:-.3);mates.push(g);pen.add(g);
    }
    let headFirst=0,walking=0,maxOut=0;
    for(let step=0;step<6000;step++){
      const t=step/60;
      for(const g of mates){
        const before=g.position.clone();A.livestock(g,t,1);
        const moved=g.position.clone().sub(before);
        if(moved.length()>1e-5){walking++;const nose=new T.Vector3(1,0,0).applyQuaternion(g.quaternion);if(nose.dot(moved.normalize())>.95)headFirst++;}
        maxOut=Math.max(maxOut,Math.abs(g.position.x)-.9,Math.abs(g.position.z)-.7);
      }
    }
    assert.ok(walking>200,kind+' walks about');assert.equal(headFirst,walking,kind+' never crab-walks');
    assert.ok(maxOut<=1e-9,kind+' stays inside the rails');
  }
});

test('grazing brings the muzzle down to the grass and the legs step forwards',()=>{
  for(const kind of ['sheep','cattle','goat','pig','horse']){
    const g=A.make(T,kind,7),muzzle=g.userData.muzzle||g.userData.neck;
    A.pose(g,kind,{moving:false,stride:0,speed:0,graze:1},1,1);
    assert.ok(world(g,muzzle).y<.2,kind+' reaches the grass: '+world(g,muzzle).y.toFixed(3));
    A.pose(g,kind,{moving:true,stride:1,speed:.1,graze:0},1,1);
    for(const hip of g.userData.legs){assert.equal(hip.rotation.x,0,kind+' legs never swing sideways');}
    assert.ok(g.userData.legs.some(h=>Math.abs(h.rotation.z)>.1),kind+' legs swing fore and aft');
  }
});

test('hens strut about and peck right down at the ground, at any frame rate',()=>{
  const run=hz=>{const g=A.make(T,'hen',3);Object.assign(g.userData,{fowlKind:'hen',phase:1});let path=0,low=Infinity,last=g.position.clone();
    for(let i=0;i<hz*40;i++){A.fowl(g,i/hz,1);path+=g.position.distanceTo(last);last.copy(g.position);low=Math.min(low,world(g,g.userData.beak||g.userData.neck).y);}
    return {path,low};};
  const a=run(30),b=run(120);
  assert.ok(a.path>1&&b.path>1,'hens walk');assert.ok(Math.abs(a.path-b.path)/b.path<.6,'30 Hz and 120 Hz travel alike');
  assert.ok(b.low<.06,'the beak reaches the ground: '+b.low.toFixed(3));
});

test('the game wires roles, carters, builders and animals into the new models',()=>{
  const html=read('index.html');
  assert.match(html,/resident\(THREE, \{id:'visitor:'\+Math\.floor\(r\(\)\*100000\), kind:'humanoid', name:'A visiting builder', role:role \|\| 'commoner'\}\)/);
  assert.match(html,/villageMakeVillager\(r, pal, 'builder'\)/);
  assert.match(html,/while\(o && !o\.userData\.construction && !o\.userData\.traffic\) o=o\.parent;/);
  assert.match(html,/animals\.forEach\(animal => window\.BurbzVillageAnimals\.livestock\(animal, t, motion\)\)/);
  assert.match(html,/wheel\.rotation\.y = -travelled \/ 0\.34/);
  assert.ok(!/hip\.rotation\.x = Math\.sin\(t \* 7 \+ hip\.userData\.phase\)/.test(html),'no sideways horse legs');
  assert.ok(!/\/\/ A visible hammer stroke/.test(html),'no floating hammer');
  for(const name of ['settlement_models.js','village_animals.js'])assert.ok(html.includes(`<script src="${name}?v=${BUILD}"></script>`),name+' pinned');
});
