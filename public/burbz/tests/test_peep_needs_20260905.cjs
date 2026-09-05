const test=require('node:test'),assert=require('node:assert/strict');
const needs=require('../peep_needs_core.js'),life=require('../settlement_life_core.js');
function fixture(overrides={}){
  const destinations=Object.fromEntries(Object.entries({home:[-8,0],work:[8,0],well:[0,8],fun:[0,-8],green:[0,0]}).map(([k,[x,z]])=>[k,{key:k,point:{x,z},path:[{x,z},{x:0,z:0}]}]));
  const env={life,destinations,routeFrom:(m,t)=>[{x:m.x,z:m.z},{x:0,z:0},t.point]};
  const p={id:'1:resident:0',name:'Pip',homeId:'cabin:0',jobId:'hut'};
  p.lifeMemory={...needs.initial(p,env,1000),x:8,z:0,action:'work',target:'work',targetKey:'work',thirst:20,energy:80,fun:80,elapsed:0,...overrides};
  let now=1000;const tick=(seconds=1,hour=13)=>needs.advance(p,env,now+=seconds*1000,hour);
  const until=(predicate,limit=300)=>{let state;for(let i=0;i<limit;i++){state=tick();if(predicate(state,p.lifeMemory))return state;}throw Error('Never arrived: '+JSON.stringify(p.lifeMemory));};
  return {env,p,tick,until};
}
test('thirst makes a Peep walk to an actual well before drinking',()=>{
  const f=fixture({thirst:80});assert.equal(f.tick().activity,'Going to the well');
  assert.equal(f.p.lifeMemory.x,8);assert.ok(f.tick().thirst>=80);
  f.until(s=>s.activity==='Drinking at the well');assert.deepEqual([f.p.lifeMemory.x,f.p.lifeMemory.z],[0,8]);
  const before=f.p.lifeMemory.thirst;f.tick();assert.ok(f.p.lifeMemory.thirst<before);
});
test('tired Peeps physically reach their own home, sleep and recover',()=>{
  const f=fixture({energy:20});assert.equal(f.tick().activity,'Heading home to sleep');assert.equal(f.p.lifeMemory.x,8);
  f.until(s=>s.activity==='Sleeping at home');assert.equal(f.p.lifeMemory.x,-8);assert.equal(f.tick().inside,true);
  const before=f.p.lifeMemory.energy;f.tick();assert.ok(f.p.lifeMemory.energy>before);
});
test('nightfall does not teleport a Peep home',()=>{
  const f=fixture();const s=f.tick(1,23);assert.equal(s.activity,'Heading home to sleep');assert.equal(s.inside,false);assert.equal(s.x,8);
});
test('missing entertainment makes a Peep unhappy; built entertainment relieves boredom on arrival',()=>{
  const f=fixture({fun:20});delete f.env.destinations.fun;
  assert.equal(f.tick().mood,'Unhappy');assert.equal(f.tick().need,'Needs entertainment');
  f.env.destinations.fun={key:'fun',point:{x:0,z:-8},path:[{x:0,z:-8},{x:0,z:0}]};
  assert.equal(f.tick().activity,'Looking for entertainment');
  f.until(s=>s.activity==='Enjoying a little entertainment');const before=f.p.lifeMemory.fun;f.tick();assert.ok(f.p.lifeMemory.fun>before);
});
test('missing wells never relieve thirst and missing homes lead to honest outdoor rest',()=>{
  const f=fixture({thirst:80});delete f.env.destinations.well;assert.equal(f.tick().need,'Needs a reachable well');
  const before=f.p.lifeMemory.thirst;for(let i=0;i<20;i++)f.tick();assert.ok(f.p.lifeMemory.thirst>=before);
  f.p.lifeMemory.energy=10;delete f.env.destinations.home;assert.match(f.tick().activity,/Resting outside/);assert.equal(f.tick().inside,false);
});
test('blocked paths retry at a bounded rate without moving or granting relief',()=>{
  const f=fixture({thirst:80});let tries=0;const route=f.env.routeFrom;f.env.routeFrom=()=>{tries++;return null;};
  for(let i=0;i<15;i++)f.tick();assert.equal(tries,1);assert.equal(f.p.lifeMemory.x,8);assert.ok(f.p.lifeMemory.thirst>80);
  f.env.routeFrom=route;assert.equal(f.tick().activity,'Going to the well');f.until(s=>s.activity==='Drinking at the well');
});
test('removing a destination during a trip stops safely at the current position',()=>{
  const f=fixture({thirst:80});f.tick();f.tick();const pos=[f.p.lifeMemory.x,f.p.lifeMemory.z];delete f.env.destinations.well;
  assert.equal(f.tick().activity,'Waiting for a clear path');assert.deepEqual([f.p.lifeMemory.x,f.p.lifeMemory.z],pos);
});
test('saved needs and routes survive reconcile and reopening adds no offline penalty',()=>{
  const f=fixture({thirst:80});f.tick();f.tick();const snapshot=JSON.parse(JSON.stringify(f.p.lifeMemory));
  const ledger=life.reconcile({residents:[f.p],nextId:1},{seed:1,population:1,homes:[{id:'cabin:0',capacity:1}],jobs:[{id:'hut',capacity:1}]});
  assert.deepEqual(ledger.residents[0].lifeMemory,snapshot);
  const state=needs.advance(ledger.residents[0],f.env,snapshot.at+86400000,13);
  assert.equal(state.thirst,Math.round(snapshot.thirst));assert.equal(state.x,snapshot.x);assert.equal(ledger.residents[0].homeId,'cabin:0');
});
test('need rates use elapsed time rather than frame count',()=>{
  const a=fixture(),b=fixture();for(let i=0;i<100;i++)a.tick(.1);for(let i=0;i<10;i++)b.tick(1);
  for(const k of ['thirst','energy','fun'])assert.ok(Math.abs(a.p.lifeMemory[k]-b.p.lifeMemory[k])<1e-8);
});
