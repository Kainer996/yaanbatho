const assert=require('node:assert/strict'),C=require('../academy_flight_core.js');
// Controls drive real flight (v477): forward flaps ahead, backward airbrakes,
// the sideways push banks into a turn, the view steers the path, and the
// camera follows the wings. The body never strafes or reverses.
const world={allowed3:()=>true,clear:()=>true},fresh=()=>({x:0,y:40,z:15,yaw:0,pitch:0}),advance=(p,input,n=120)=>{for(let i=0;i<n;i++)C.step(p,input,1/60,world);return p;};
const cruise=C.settings().speed;
const ahead=advance(fresh(),{forward:1},240);assert(ahead.z<15-10,'forward flapping flies ahead');assert(Math.abs(ahead.x)<1e-9);assert(Math.abs(ahead.y-40)<1.5,'powered flight holds its height');assert(ahead.wing.airspeed>cruise*.9&&ahead.wing.airspeed<cruise*1.25,'powered flight settles near cruise');
const glide=advance(fresh(),{},120),brake=advance(fresh(),{forward:-1},120);assert(brake.velocity.z<=0,'the airbrake never flies backwards');assert(brake.wing.airspeed<glide.wing.airspeed,'the airbrake slows the bird');
for(const side of [1,-1]){const p=advance(fresh(),{forward:1,side});assert(p.yaw*side<-1,'the sideways push turns the bird');assert(p.x*side>1,'the path curves into the turn');}
const down=advance(Object.assign(fresh(),{pitch:-.4}),{}),up=advance(Object.assign(fresh(),{pitch:.4}),{},60);assert(down.y<39&&down.wing.airspeed>cruise,'looking down dives and gathers speed');assert(up.y>40&&up.wing.airspeed<glide.wing.airspeed,'looking up climbs and bleeds speed');
let p=fresh(),m={},samples=[];for(let i=0;i<240;i++){C.step(p,{forward:1,lift:.6},1/60,world);samples.push(C.cameraMotion(m,p,1/60));}const flap=samples.slice(-120);assert(flap.every(x=>x.mode==='flapping'||x.mode==='hovering'));assert(Math.max(...flap.map(x=>x.bob))-Math.min(...flap.map(x=>x.bob))>.07,'visible wingbeat');assert(flap.some(x=>Math.abs(x.pitch)>.008));
p=Object.assign(fresh(),{pitch:-.2});m={};for(let i=0;i<180;i++){C.step(p,{},1/60,world);C.cameraMotion(m,p,1/60);}const still=C.cameraMotion(m,p,1/60);assert(['gliding','diving'].includes(still.mode));assert(Math.abs(still.bob)<1e-4,'a glide holds the wings still');
for(const turn of [-1,1]){p=fresh();m={};let view;for(let i=0;i<180;i++){C.step(p,{forward:1,turn},1/60,world);view=C.cameraMotion(m,p,1/60);}assert(view.roll*turn>.1,'bank matches turn');assert(Math.abs(view.roll)<=.25);for(let i=0;i<180;i++){C.step(p,{forward:1},1/60,world);view=C.cameraMotion(m,p,1/60);}assert(Math.abs(view.roll)<1e-3,'bank settles after turn');}
const original=JSON.stringify(p);const reduced=C.cameraMotion(m,p,1/60,true);assert.deepEqual([reduced.bob,reduced.pitch,reduced.roll,reduced.fov],[0,0,0,0]);assert.equal(JSON.stringify(p),original,'camera motion never changes body physics');p.landed='library';assert.equal(C.cameraMotion(m,p,1/60).mode,'perched');
console.log('PASS forward flapping, airbrake, banked turns, view-steered dive and climb, wingbeats, still glide, left/right banking, settle, reduced motion and body isolation');
