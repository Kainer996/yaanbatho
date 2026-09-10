const assert=require('node:assert/strict');
const C=require('../geographic_world_core.js'),F=require('../academy_flight_core.js');
const near=(a,b,e=1e-6)=>assert(Math.abs(a-b)<e,`${a} differs from ${b} by more than ${e}`);
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const fresh=(extra={})=>({x:0,y:0,z:0,yaw:0,pitch:0,mode:'walk',...extra});
const flat={height:()=>0,allowed:()=>true,allowed3:()=>true,clear:()=>true};

test('one metre east/south/up at equatorial, UK and high latitude anchors',()=>{
 for(const lat of [0,54.45,80,-70]){
  const a={lat,lon:-2.65,altitude:240},p={x:1,y:5,z:1},g=C.unproject(a,p),q=C.project(a,g);
  near(q.x,1);near(q.z,1);near(q.y,5);assert(g.lon>a.lon&&g.lat<a.lat);near(g.altitude,245);
  near(C.distance(a,C.unproject(a,{x:1,y:0,z:0})),1,1e-5);
  near(C.distance(a,C.unproject(a,{x:0,y:0,z:1})),1,1e-5);
 }
});
test('dateline uses the nearby world copy without longitude or polar jumps',()=>{
 const a={lat:15,lon:179.99999},b={lat:15,lon:-179.99999},p=C.project(a,b);
 assert(p.x>0&&p.x<3);near(C.bearing(a,b),90,1e-5);near(C.unproject(a,p).lon,b.lon);
 const pole={lat:C.MAX_LAT,lon:0};assert(C.project(pole,pole));assert(C.unproject(pole,{x:0,y:0,z:0}));
 assert.equal(C.unproject(pole,{x:0,y:0,z:-1}),null);
 assert.equal(C.normalizeAnchor({lat:86,lon:0}),null);
});
test('strict geographic save validation rejects absent, nonfinite and coercible positions',()=>{
 for(const value of [null,{}, {lat:null,lon:0},{lat:'54',lon:0},{lat:0,lon:181},{lat:NaN,lon:0},{lat:0,lon:0,altitude:Infinity},{lat:0,lon:0,altitude:null}])assert.equal(C.normalizeAnchor(value),null);
 const anchor={lat:54.45,lon:-2.65,revision:3,source:'chosen'},raw={lat:54.46,lon:-2.66,altitude:250,yaw:20,pitch:4,mode:'fly',velocity:{x:99},reward:12};
 const p=C.normalizePose(raw,anchor);assert(C.validatePose(p));near(p.pitch,1.1);assert(Math.abs(p.yaw)<=Math.PI);assert.equal(p.mode,'fly');assert(!('velocity'in p)&&!('reward'in p));assert.deepEqual(anchor,{lat:54.45,lon:-2.65,revision:3,source:'chosen'});
 assert.equal(C.normalizePose(null,null),null);assert.equal(C.normalizePose({lat:NaN,lon:0},anchor).lat,54.45);
 assert.equal(C.validatePose({...p,mode:'teleport'}),false);
});
test('floating origin preserves absolute altitude, heading, velocity and save pose',()=>{
 const a={lat:54.45,lon:179.995,altitude:100},p=fresh({x:1300,y:17,z:-500,mode:'fly',yaw:1,pitch:.2,velocity:{x:3,y:2,z:1}}),before=C.savedPose(a,p),b={...before,altitude:50};
 const q=C.rebase(p,a,b);assert(C.needsRebase(p));assert(!C.needsRebase(q));near(q.x,0);near(q.z,0);near(q.y,67);const after=C.savedPose(b,q);near(after.lat,before.lat,1e-10);near(after.lon,before.lon,1e-10);for(const key of ['altitude','yaw','pitch','mode'])assert.equal(after[key],before[key]);assert.notEqual(q.velocity,p.velocity);assert.equal(p.x,1300);
});
test('walking is physical metres with diagonal normalization and dt bounded after resume',()=>{
 const straight=fresh(),diagonal=fresh();for(let i=0;i<60;i++){C.step(straight,{forward:1},1/60,flat);C.step(diagonal,{forward:1,side:1},1/60,flat);}
 near(straight.z,-2.7);near(Math.hypot(diagonal.x,diagonal.z),2.7);
 const p=fresh();C.step(p,{forward:1},100,flat);near(p.z,-.216);C.step(p,{forward:1},-1,flat);near(p.z,-.216);
});
test('swept thin wall blocks walking but permits sliding along its actual edge',()=>{
 const world={...flat,clear:(a,b)=>!(Math.min(a.x,b.x)<.10&&Math.max(a.x,b.x)>=.10)},p=fresh();
 for(let i=0;i<60;i++)C.step(p,{side:1,forward:1},1/60,world);
 assert(p.x<.10&&p.z< -1.8);assert(p.y===0);
});
test('missing terrain and unsafe ledges retain a verified safe body position',()=>{
 const p=fresh(),before=JSON.stringify(p);const missing=C.step(p,{forward:1},.08,{...flat,height:()=>null});assert.equal(missing.ready,false);assert.equal(missing.reason,'terrain-loading');assert.deepEqual([p.x,p.y,p.z],[0,0,0]);
 const edge={...flat,height:(x,z)=>z< -.2?null:0};for(let i=0;i<20;i++)C.step(p,{forward:1},.08,edge);assert(p.z>=-.2&&p.z<0);
 const cliff=fresh(),world={...flat,height:(x,z)=>z<-.1?-4:0};for(let i=0;i<10;i++)C.step(cliff,{forward:1},.08,world);assert(cliff.z>=-.1&&cliff.y===0);
 const rise=fresh();assert.equal(C.step(rise,{},.02,{...flat,height:()=>20}).reason,'terrain-changed');assert.equal(rise.y,0);
 assert(before.length>0);
});
test('geographic flight reuses Academy integrator exactly with configured metre speeds',()=>{
 const p=fresh({y:10,mode:'fly'}),reference={...p};for(let i=0;i<120;i++){const input={forward:1,side:.3,lift:.2,turn:.1,pitch:.1};C.step(p,input,1/60,flat);F.step(reference,input,1/60,flat,{speed:18,liftSpeed:6});}
 for(const axis of ['x','y','z','yaw','pitch'])near(p[axis],reference[axis]);assert(p.y>11);
 const original=fresh({y:10});for(let i=0;i<300;i++)F.step(original,{forward:1,lift:1},1/60,flat);near(original.velocity.z,-5.2,1e-8);near(original.velocity.y,3.2,1e-8);
});
test('look pitch cannot ascend; flight floor, ceiling, swept obstruction and unknown tiles are physical',()=>{
 const p=fresh({y:10,mode:'fly'});for(let i=0;i<120;i++)C.step(p,{forward:1,pitch:1},1/60,flat);near(p.y,10);near(p.pitch,1.1);
 const up=fresh({y:399.9,mode:'fly'}),down=fresh({y:.4,mode:'fly'});for(let i=0;i<120;i++){C.step(up,{lift:1},1/60,flat);C.step(down,{lift:-1},1/60,flat);}assert(up.y<=400&&down.y>=C.MIN_AGL);
 const obstacle={...flat,clear:(a,b)=>!(a.z>-.2&&b.z<=-.2)},stopped=fresh({y:10,mode:'fly'});for(let i=0;i<60;i++)C.step(stopped,{forward:1},1/60,obstacle);assert(stopped.z>-.2);
 const unknown=fresh({y:10,mode:'fly'}),world={...flat,height:(x,z)=>z<-.3?null:0};let result;for(let i=0;i<60;i++)result=C.step(unknown,{forward:1},1/60,world);assert(unknown.z>=-.3);assert.equal(result.ready,false);
});
test('takeoff and landing need verified reachable ground; camera/bob does not change the body',()=>{
 const p=fresh();assert(C.takeoff(p,flat).ok);assert.equal(p.mode,'fly');near(p.y,.65);const before={...p};F.cameraMotion({},p,.02);assert.deepEqual(p,before);
 const far={...p,y:3};assert.equal(C.land(far,flat).reason,'too-high');assert.equal(far.mode,'fly');
 assert.equal(C.land(p,{...flat,landable:()=>false}).ok,false);assert.equal(C.land(p,{...flat,height:()=>null}).ready,false);assert(C.land(p,flat).ok);assert.equal(p.mode,'walk');near(p.y,0);
 assert.equal(C.takeoff(p,{...flat,allowed3:()=>false}).ok,false);assert.equal(p.mode,'walk');
});
test('flight has no legacy 32m world wall and safely descends from changed high-altitude bounds',()=>{
 const p=fresh({x:5000,z:5000,y:20,mode:'fly'});assert(C.step(p,{forward:1},.08,flat).moved);assert(p.z<5000);
 const high=fresh({y:410,mode:'fly'});for(let i=0;i<60;i++)C.step(high,{lift:-1},1/60,flat);assert(high.y<410);
});
test('save projection and simulation never modify GPS, home state, rewards or supplied terrain',()=>{
 const sensor=Object.freeze({lat:54.45,lon:-2.65,accuracy:9}),anchor=Object.freeze({...sensor,revision:1}),terrain=Object.freeze({...flat}),p=fresh({y:10,mode:'fly'});for(let i=0;i<600;i++)C.step(p,{forward:1},1/60,terrain);
 const save=C.savedPose(anchor,p);assert(save.lat>anchor.lat);assert.deepEqual(sensor,{lat:54.45,lon:-2.65,accuracy:9});assert.equal(anchor.revision,1);assert.equal(Object.keys(save).length,6);
});
console.log(`${count} geographic world groups passed.`);
