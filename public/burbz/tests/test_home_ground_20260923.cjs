'use strict';
const assert=require('node:assert/strict');
const C=require('../player_home_core.js'),K=require('../village_world_core.js'),T=require('../lib/three.min.js');
require('../settlement_models.js');require('../player_home_scene.js');
const S=globalThis.BurbzPlayerHomeScene,checks=[];
function test(name,fn){try{fn();checks.push(name);console.log('PASS',name);}catch(e){console.error('FAIL',name,e.message);process.exitCode=1;}}
const home=C.normalize({...C.initial(true),tier:1,owned:{...C.initial().owned,pond:1},placed:[{id:1,item:'pond',area:'yard',x:5,z:0,turn:0}],rooms:{library:true},finds:['welcome-stone'],anchor:{lat:54.45,lon:-2.65,revision:3,source:'chosen'},farm:{plots:[{id:1,x:10,z:0,crop:'reed',plantedAt:1000,wateredAt:1000}],seeds:{reed:2},nextId:2}});
const original=JSON.stringify(home);
test('Stock paving and outlook solids are absent, paid pond and finds remain',()=>{
 const calls=[],batch=globalThis.BurbzSettlementModels.batch;globalThis.BurbzSettlementModels.batch=(...args)=>{const b=batch(...args);for(const method of ['box','add']){const fn=b[method];b[method]=function(...a){calls.push({method,args:a});return fn.apply(this,a);};}return b;};
 let v;try{v=S.createYardContent(T,home,{portrait:false});}finally{globalThis.BurbzSettlementModels.batch=batch;}
 try{assert(!calls.some(c=>c.method==='box'&&c.args[6]===0xab9e7c),'paved stock path remains');assert(!calls.some(c=>c.method==='add'&&[0x557f89,0x9b9f87].includes(c.args[1])),'stock pond or boulder remains');assert(!v.solids.some(s=>s.id.startsWith('outlook-')));assert(v.solids.some(s=>s.id==='decoration:1'));assert.equal(v.targets.filter(t=>t.kind==='find').length,C.FINDS.filter(f=>f.area==='yard').length);assert.equal(v.farmPlots,1);assert(v.group.getObjectByName('player-home-house'));}finally{v.dispose();}
});
test('Removed stock footprints no longer block walking or farm; doorway still clear',()=>{const s=C.initial();assert(C.world(s,'yard',0,{connected:true}).allowed(-10,24));assert(C.world(s,'yard',0,{connected:true}).allowed(7,18));assert.equal(C.world(s,'yard').surface(0,8),'ground');assert(!C.validPlot(home,{x:0,z:6}).ok);assert(!C.world(home,'yard').allowed(5,0));});
test('Final terrain ground function stays flat under full house and smooth/bounded outside',()=>{
 for(const tier of [0,1,2]){const s={...home,tier},profile=S.createYardContent(T,s,{portrait:false});try{const flat=profile.groundRadius,blend=profile.groundBlendRadius;assert(Number.isFinite(flat));for(const sign of [-1,1]){const raw=(x,z)=>7+sign*(x*.31+z*.14),at=(x,z)=>K.homeHeight(x,z,{x:0,z:0,base:7,radius:flat,blendRadius:blend},raw(x,z));for(let x=-3;x<=3;x+=.25)for(let z=-3;z<=4;z+=.25)assert.equal(at(x,z),7);assert.equal(at(blend+1,0),raw(blend+1,0));assert.equal(K.homeHeight(0,0,{x:0,z:0,base:7,radius:flat,blendRadius:blend},null),null);for(const edge of [flat,blend])assert(Math.abs(at(edge+.001,0)-at(edge-.001,0))<.002);}}finally{profile.dispose();}}
});
test('Grid terrain sampler agrees with real chunk triangles and seams on slopes',()=>{const height=(x,z)=>.2*x+Math.sin(z*.4)*2;for(const cell of K.chunks(0,0,1)){const data=K.groundMesh(cell,height);for(let x=cell.x;x<=cell.x+K.CHUNK;x+=.65)for(let z=cell.z;z<=cell.z+K.CHUNK;z+=.75)assert(Math.abs(K.sampleGround(x,z,height)-K.meshHeight(cell,data,x,z))<1e-7);}assert.equal(K.sampleGround(1,1,()=>null),null);});
test('Decorations, finds, trees and farm follow final terrain with matching solid heights',()=>{
 const ground=(x,z)=>K.sampleGround(x,z,(x,z)=>.13*x+.08*z+Math.sin(z*.4)),v=S.createYardContent(T,home,{portrait:false,groundHeight:ground});try{
 const pond=v.group.children.find(o=>o.userData.placementId===1);assert(Math.abs(pond.position.y-ground(5,0))<1e-6);const solid=v.solids.find(s=>s.id==='decoration:1');assert.equal(solid.minY,ground(5,0));assert(Math.abs(solid.maxY-new T.Box3().setFromObject(pond).max.y)<1e-6);
 for(const f of C.FINDS.filter(f=>f.area==='yard')){const m=v.group.children.find(o=>o.userData.findId===f.id);assert.equal(m.position.y,ground(f.x,f.z));assert.equal(v.targets.find(t=>t.id===f.id).y,.6+ground(f.x,f.z));}
 for(const t of C.visibleTrees(home)){const solid=v.solids.find(s=>s.id===t.id);assert.equal(solid.minY,ground(t.x,t.z));assert.equal(solid.maxY,3.8+ground(t.x,t.z));}
 const farm=v.group.getObjectByName('player-home-farm');let instances=0;farm.traverse(o=>{if(!o.isInstancedMesh)return;const matrix=new T.Matrix4(),p=new T.Vector3();for(let i=0;i<o.count;i++){o.getMatrixAt(i,matrix);p.setFromMatrixPosition(matrix);assert(Math.abs(p.y-ground(p.x,p.z))<1e-5);instances++;}});assert(instances>0);
 assert.equal(JSON.stringify(home),original,'rendering mutated owned save');}finally{v.dispose();}
});
test('Default exterior contains no Merlin billboard or portrait load',()=>{const old=T.TextureLoader.prototype.load,loaded=[];T.TextureLoader.prototype.load=function(url){loaded.push(url);return new T.Texture();};let v;try{v=S.createYardContent(T,home);let sprites=0;v.group.traverse(o=>{if(o.isSprite)sprites++;});assert.equal(sprites,0,'exterior Merlin billboard remains');assert.equal(loaded.length,0,'exterior still requests portrait');}finally{v?.dispose();T.TextureLoader.prototype.load=old;}});
console.log(JSON.stringify({passed:checks.length,checks}));
