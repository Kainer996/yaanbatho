const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const core=require('../village_discovery_core.js'),walk=require('../village_walk_core.js'),loot=require('../loot_crafting_core.js');
assert.equal(core.QUESTS.length,50);assert.equal(new Set(core.QUESTS.map(q=>q.title)).size,50);assert.equal(new Set(core.QUESTS.map(q=>q.intro)).size,50);
assert.equal(core.LORE.length,30);
for(const reward of core.LOOT.map(l=>l.reward)){
 for(const id of Object.keys(reward.gear||{}))assert(loot.gearById(id),id);
 for(const id of Object.keys(reward.materials||{}))assert(loot.materialById(id),id);
}
let firstOrder;
for(let player=0;player<20;player++){
 let state={};const assigned=[],weapons=new Set(),lore=new Set();
 for(let i=0;i<110;i++){
  const seed=9000+(i*193),r=core.village(state,seed,'player:'+player),q=core.quest(r);assigned.push(q.id);
  assert.equal(core.village(state,String(seed),'changed entropy'),r,'revisit retains same record');
  assert.equal(core.act(r,'step',0),null,'must accept');assert.equal(core.act(r,'finish'),null,'must do work');
  core.act(r,'accept',null,'Pip');assert.equal(r.giver,'Pip');assert.equal(core.act(r,'accept'),null);
  for(let j=0;j<q.steps.length;j++){
   assert.equal(core.act(r,'step',j+1),null,'no skipping ordered steps');assert(core.act(r,'step',j));assert.equal(core.act(r,'step',j),null,'no repeating step');
  }
  assert(core.act(r,'finish').reward.coins>0);assert.equal(core.act(r,'finish'),null,'finish cannot pay twice');
  for(const l of r.loot){assert(core.act(r,'loot',l.id).reward);assert.equal(core.act(r,'loot',l.id),null);Object.keys(l.reward.gear||{}).forEach(id=>{if(loot.gearById(id).slot==='weapon')weapons.add(id);});}
  assert.equal(core.act(r,'loot','invented'),null);
  r.lore.forEach(id=>{assert(core.act(r,'lore',id).text);assert(core.act(r,'lore',id).text);lore.add(id);});assert.equal(r.read.length,2);
  state=JSON.parse(JSON.stringify(state));assert.equal(core.village(state,seed).completed,true,'reload retains claims');
 }
 assert.equal(new Set(assigned.slice(0,50)).size,50);assert.equal(new Set(assigned.slice(50,100)).size,50);assert(weapons.size>=3);assert(lore.size>=25);
 if(firstOrder)assert.notDeepEqual(assigned,firstOrder,'random deck across players');else firstOrder=assigned;
}
// Random assignments cannot depend on completion: 50 abandoned requests still differ.
const unfinished={};assert.equal(new Set(Array.from({length:50},(_,i)=>core.village(unfinished,i,'unfinished').questId)).size,50);
const polygon=[{x:-.4,z:-12},{x:.4,z:-12},{x:.4,z:12},{x:-.4,z:12}];
const world=walk.createWorld({radius:11,polygons:[polygon]});const spawn={x:3,z:2};
const points=core.positions(world,spawn,123,12);assert.equal(points.length,12);assert(points.every(p=>p.x>.4&&world.allowed(p.x,p.z)),'all items stay on the connected side of impassable wall');assert.deepEqual(points,core.positions(world,spawn,123,12));
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),sw=fs.readFileSync(path.join(__dirname,'../sw.js'),'utf8'),updater=fs.readFileSync(path.join(__dirname,'../../../scripts/update-live-burbz.sh'),'utf8');
for(const file of ['village_discovery_content.js','village_discovery_core.js','village_discoveries.js']){assert.equal(sw.split('./'+file+'?').length-1,3,file+' in every cache list');assert(updater.includes('"'+file+'"'));}
assert(html.includes('discoveries: villageDiscoveryAdapter(seed)'));
// Execute the real index transaction adapter with fault-injected storage.
const vm=require('node:vm'),start=html.indexOf('function villageDiscoveryAdapter(seed)'),end=html.indexOf('let villageWalkLoad',start);
const state={player:{coins:100,branches:40},inventory:{gear:{},items:{}}};let fails=false,persisted=null;
const ctx={window:{BurbzVillageDiscoveryCore:core,BurbzLootCore:loot},gameState:state,crypto:{getRandomValues:a=>{a[0]=42;return a;}},snapshotGameState:()=>JSON.parse(JSON.stringify(ctx.gameState)),restoreGameStateSnapshot:s=>ctx.gameState=s,durableSaveState:()=>{if(fails)throw Error('quota');persisted=JSON.stringify(ctx.gameState);}};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);const adapter=ctx.villageDiscoveryAdapter(123);
fails=true;assert.throws(()=>adapter.prepare(),/quota/);assert.equal(ctx.gameState.villageDiscoveries,undefined);
fails=false;adapter.prepare();const pick=adapter.record().loot[0],before=JSON.stringify(ctx.gameState);
fails=true;assert.throws(()=>adapter.act('loot',pick.id),/quota/);assert.equal(JSON.stringify(ctx.gameState),before);
fails=false;assert(adapter.act('loot',pick.id));assert.equal(adapter.act('loot',pick.id),null);assert.equal(persisted,JSON.stringify(ctx.gameState));
console.log('PASS: 2,200 complete quests, shuffled cycles, catalogue rewards, revisit/reload, duplicate claims, reachable placement, atomic failure/retry and offline wiring.');
