'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const C=require('../flight_craft_core.js'),G=require('../geographic_world_core.js');
const pose={lat:54.45,lon:-2.65,altitude:80,yaw:0,pitch:0,mode:'walk'};
test('one strict parking record retains actual geography independently of the home anchor',()=>{
  const craft=C.at(pose),copy=JSON.parse(JSON.stringify(craft));
  assert.deepEqual(C.normalize(copy),craft);
  for(const change of [{lat:'54.45'},{altitude:NaN},{version:2},{phase:'unknown'},{surface:'water'},{yaw:Infinity}])assert.equal(C.normalize({...craft,...change}),null);
  assert.equal(C.normalize({...craft,home:{lat:1,lon:1}}).lat,pose.lat);
});
test('boarding requires a nearby parked craft at the player height, not arbitrary flight',()=>{
  const craft=C.at(pose);
  assert(C.boardable(craft,pose));
  assert(!C.boardable(craft,{...pose,altitude:90}));
  assert(!C.boardable(craft,{...pose,lon:pose.lon+.001}));
  assert(!C.boardable(craft,{...pose,mode:'fly'}));
  assert(!C.boardable({...craft,phase:'flying'},pose));
  assert(C.boardable({...craft,phase:'deck'},pose));
  assert(C.occupied({...craft,phase:'boarded'}));
  assert(!C.occupied({...craft,phase:'deck'}));
});
test('the full hull rejects missing terrain, narrow banks, steep ground and obstacles',()=>{
  const flat=()=>({height:5,kind:'ground'}),clear=()=>true;
  assert(C.berth(0,0,flat,clear));
  assert.equal(C.berth(0,0,(x,z)=>x>.5?null:flat(),clear),null);
  assert.equal(C.berth(0,0,(x,z)=>({height:5,kind:x>.5?'freshwater':'ground'}),clear),null);
  assert.equal(C.berth(0,0,(x,z)=>({height:5+x,kind:'ground'}),clear),null);
  assert.equal(C.berth(0,0,flat,(x,y,z)=>x<.5),null);
  assert(C.berth(0,0,()=>({height:5,kind:'sea'}),clear));
});
test('initial provisioning searches bounded clear dry ground without moving an existing record',()=>{
  let calls=0;
  const sample=(x,z)=>{calls++;return{height:5,kind:Math.hypot(x,z)<6?'freshwater':'ground'};};
  const result=C.findBerth({x:0,z:0},sample,()=>true);
  assert(result&&Math.hypot(result.x,result.z)>=6);assert(calls<5000);
  const before=C.at(pose);C.findBerth({x:20,z:20},()=>null,()=>true);assert.deepEqual(before,C.at(pose));
  assert.equal(C.findBerth({x:0,z:0},()=>null,()=>true),null);
});
test('freshwater and sea stay bounded across frame rates, pauses and reduced motion',()=>{
  function run(kind,hz){let state={},max=0;for(let i=0;i<hz*20;i++){state=C.floatPose(state,kind,i/hz,1/hz);max=Math.max(max,Math.abs(state.y));assert(Number.isFinite(state.velocity));assert(Math.abs(state.y)<.2);}return{state,max};}
  const fresh=run('freshwater',60),sea=run('sea',60);
  assert(sea.max>fresh.max*2.9);assert(Math.abs(run('sea',30).max-sea.max)<.01);
  assert(Math.abs(C.floatPose(sea.state,'sea',10000,10000).y)<.2);
  let calm=sea.state;for(let i=0;i<120;i++)calm=C.floatPose(calm,'sea',i/60,1/60,true);
  assert(Math.abs(calm.y)<.0001);assert.equal(calm.roll,0);
  assert.equal(C.floatPose({},'ground',1,1/60).y,0);
});
test('board distance remains local across the dateline',()=>{
  const a={...pose,lat:0,lon:179.999999},b={...a,lon:-179.999999};
  assert(G.distance(a,b)<1);assert(C.boardable(C.at(a),b));
});
