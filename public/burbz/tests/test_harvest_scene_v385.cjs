'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const T=require('../lib/three.min.js');
global.BurbzVillageHarvestCore=require('../village_harvest_core.js');
global.BurbzVillageWalkCore=require('../village_walk_core.js');
global.matchMedia=()=>({matches:false});
require('../village_harvest_scene.js');require('../village_walk_scene.js');
function fixture(){
 const scene=new T.Scene(),anchor=new T.Group();scene.add(anchor);
 const trunkGeo=new T.CylinderGeometry(.18,.25,2,8);trunkGeo.translate(0,1,0);
 const crownGeo=new T.ConeGeometry(1,2.5,8);crownGeo.translate(0,3,0);
 const trunk=new T.InstancedMesh(trunkGeo,new T.MeshLambertMaterial(),2),crown=new T.InstancedMesh(crownGeo,new T.MeshLambertMaterial(),2);
 for(const mesh of [trunk,crown]){for(let i=0;i<2;i++)mesh.setMatrixAt(i,new T.Matrix4().makeTranslation(i*4,0,0));anchor.add(mesh);}
 anchor.userData.harvestNodes=[0,1].map(index=>({kind:'wood',x:index*4,y:0,z:0,radius:.25,family:'pines',index}));anchor._burbzHarvestSets={pines:[trunk,crown]};
 const taken=new Set(),api={available:n=>!taken.has(n.id)},view=BurbzVillageHarvestScene.prepare(T,scene,api);
 return{scene,trunk,crown,taken,api,view};
}
test('actual instanced tree falls in intermediate frames, leaves a stump and frees its trunk collision',()=>{
 const f=fixture(),node=f.view.nodes[0],m=new T.Matrix4();
 const world=()=>BurbzVillageWalkScene.create(T,f.scene,[],[],{radius:20,heightAt:()=>0});
 assert.equal(world().allowed(0,0),false);f.taken.add(node.id);f.view.fell(node,100,{x:0,z:2});
 f.view.update(500);f.trunk.getMatrixAt(0,m);assert(m.elements.some((v,i)=>Math.abs(v-new T.Matrix4().elements[i])>.01),'real source instance changes while falling');assert.equal(f.view.diagnostics().falling.length,1);
 assert.equal(f.view.update(1000),true);f.crown.getMatrixAt(0,m);assert.equal(m.elements[0],0);assert.equal(m.elements[5],0);assert.equal(world().allowed(0,0),true,'no invisible standing trunk');assert.equal(world().allowed(4,0),false,'neighbour still blocks');
 const stump=f.scene.children.find(o=>o.userData.harvestStumps);stump.getMatrixAt(0,m);assert(m.elements[0]>0);assert.equal(f.view.diagnostics().felled.length,1);
});
test('saved daily claims apply before walking, regrow next day and never modify neighbouring matrices',()=>{
 const f=fixture(),node=f.view.nodes[1],original=new T.Matrix4(),now=new T.Matrix4();f.trunk.getMatrixAt(0,original);f.taken.add(node.id);f.view.refresh();f.trunk.getMatrixAt(0,now);assert.deepEqual(now.elements,original.elements);f.trunk.getMatrixAt(1,now);assert.equal(now.elements[0],0);
 f.taken.clear();f.view.refresh();f.trunk.getMatrixAt(1,now);assert.deepEqual(now.elements,new T.Matrix4().makeTranslation(4,0,0).elements);assert.deepEqual(f.view.diagnostics().felled,[]);
 assert.equal(BurbzVillageHarvestScene.prepare(T,f.scene,f.api),f.view,'reentry reuses one bounded view');assert.equal(f.scene.children.filter(o=>o.userData.harvestStumps).length,1);
});
test('combined tree vertex ranges are removed and restored without affecting neighbouring scenery',()=>{
 const scene=new T.Scene(),tree=new T.Group();tree.userData.natureTree=true;scene.add(tree);
 const first=new T.BoxGeometry(.5,2,.5).toNonIndexed();first.translate(0,1,0);const second=first.clone();second.translate(4,0,0);const data=new Float32Array(first.attributes.position.array.length*2);data.set(first.attributes.position.array);data.set(second.attributes.position.array,first.attributes.position.array.length);
 const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(data,3));const mesh=new T.Mesh(geo,new T.MeshLambertMaterial());scene.add(mesh);tree._burbzHarvestParts=[{mesh,start:0,count:first.attributes.position.count}];const before=data.slice();let taken=false;const view=BurbzVillageHarvestScene.prepare(T,scene,{available:()=>!taken});taken=true;view.refresh();assert(data.slice(0,first.attributes.position.array.length).every(v=>v===0));assert.deepEqual(data.slice(first.attributes.position.array.length),before.slice(first.attributes.position.array.length));taken=false;view.refresh();assert.deepEqual(data,before);
});
test('reduced motion commits a stump immediately without a falling animation',()=>{
 global.matchMedia=()=>({matches:true});try{const f=fixture(),node=f.view.nodes[0];f.taken.add(node.id);f.view.fell(node,1,{x:0,z:1});assert.deepEqual(f.view.diagnostics().falling,[]);assert.equal(f.view.diagnostics().felled.length,1);}finally{global.matchMedia=()=>({matches:false});}
});

function controller(f,player){
 const documentBefore=global.document,performanceBefore=global.performance,threeBefore=global.THREE;
 let clock=0;const elements=[];
 global.document={hidden:false,createElement:()=>Object.assign(new EventTarget(),{remove(){},setAttribute(){},textContent:''})};global.performance={now:()=>clock};global.THREE=T;
 require('../village_harvest.js');
 const s={options:{harvest:f.api},source:{scene:f.scene,buildings:[],movers:[],renderer:{shadowMap:{}}},world:BurbzVillageWalkScene.create(T,f.scene,[],[],{radius:20,heightAt:()=>0}),player,root:{append(...nodes){elements.push(...nodes);},classList:{contains:()=>false}},abort:new AbortController()};f.scene.userData.walkTerrain={radius:20,heightAt:()=>0};
 const harvest=BurbzVillageHarvest.attach(s);
 return{s,harvest,elements,tick:now=>{clock=now;harvest.update(now/1000);},click:now=>{clock=now;elements[0].dispatchEvent(new Event('click'));},done(){harvest.dispose();s.abort.abort();global.document=documentBefore;global.performance=performanceBefore;global.THREE=threeBefore;}};
}
test('a falling outdoor tree never replaces room walls; rebuild waits for the outdoor return',()=>{
 const f=fixture(),node=f.view.nodes[0],c=controller(f,{x:0,y:0,z:2,yaw:0,pitch:0});
 try{f.taken.add(node.id);f.view.fell(node,0,c.s.player);const indoor={allowed:()=>true};c.s.room={};c.s.world=indoor;c.tick(1000);assert.equal(c.s.world,indoor,'room collision remains authoritative');c.s.room=null;c.tick(1100);assert.notEqual(c.s.world,indoor);assert(c.s.world.allowed(0,0));}finally{c.done();}
});
test('daily regrowth moves a player off the new trunk locally, preserving the view direction',()=>{
 const f=fixture(),node=f.view.nodes[0];f.taken.add(node.id);f.view.refresh();const c=controller(f,{x:0,y:0,z:0,yaw:1.2,pitch:.3}),originalNow=Date.now,day=originalNow();
 try{f.taken.clear();Date.now=()=>day+86400000;c.tick(2000);assert(c.s.world.allowed(c.s.player.x,c.s.player.z));assert(Math.hypot(c.s.player.x,c.s.player.z)<1.5);assert.equal(c.s.player.yaw,1.2);assert.equal(c.s.player.pitch,.3);}finally{Date.now=originalNow;c.done();}
});
test('a post-commit graphics failure reports saved timber and cannot retry the paid reward',()=>{
 const f=fixture();let timber=0;f.api.collect=n=>{if(!f.api.available(n))return null;f.taken.add(n.id);timber+=3;return{quantity:3};};const c=controller(f,{x:0,y:0,z:2,yaw:0,pitch:0}),warn=console.warn;
 try{f.view.fell=()=>{throw Error('Injected renderer failure');};console.warn=()=>{};c.click(0);c.click(300);c.click(600);assert.equal(timber,3);assert.match(c.elements[1].textContent,/is saved/);assert.doesNotMatch(c.elements[1].textContent,/Could not save/);c.click(900);assert.equal(timber,3);assert.deepEqual(c.harvest.diagnostics().hits,{});}finally{console.warn=warn;c.done();}
});
