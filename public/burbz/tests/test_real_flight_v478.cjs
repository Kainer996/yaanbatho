const assert=require('node:assert/strict');
const G=require('../geographic_world_core.js'),F=require('../academy_flight_core.js');
// Real flight (v478): gravity always pulls, wings lift only with airspeed,
// wingbeats pay for height, dives gather speed and climbs spend it.
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const flat={height:()=>0,allowed:()=>true,allowed3:()=>true,clear:()=>true};
const craft=F.settings({speed:G.FLIGHT_SPEED,liftSpeed:G.LIFT_SPEED});
const fly=(p,input,seconds,each)=>{for(let i=0;i<Math.round(seconds*60);i++){G.step(p,typeof input==='function'?input(i):input,1/60,flat,'fly');each?.(p,i);}return p;};
const grounded=()=>{const p={x:0,y:0,z:0,yaw:0,pitch:0,mode:'walk'};assert(G.takeoff(p,flat).ok);return p;};
const aloft=(y=200,speed=craft.speed,pitch=0)=>({x:0,y,z:0,yaw:0,pitch,mode:'fly',velocity:{x:0,y:0,z:-speed}});
const energy=p=>(p.velocity.x**2+p.velocity.y**2+p.velocity.z**2)/2+craft.gravity*p.y;

test('craft scale: real gravity, stall at half cruise, small birds beat faster',()=>{
 assert(Math.abs(craft.gravity-9.78)<.05);assert.equal(craft.stall,craft.speed/2);assert(craft.top>craft.speed*2);
 const bird=F.settings();assert(bird.rate>craft.rate,'a sparrow beats faster than the great craft');
});
test('take-off starts with one wingbeat; without more flapping the craft settles back down',()=>{
 const p=grounded();assert(p.wing.beating,'take-off begins a downstroke');let top=p.y;fly(p,{},3,q=>top=Math.max(top,q.y));
 assert(top>.9,'the first wingbeat lifts the craft');assert(Math.abs(p.y-G.MIN_AGL)<.01,'it settles without more flapping');assert.equal(p.wing.mode,'grounded');
});
test('holding Flap climbs off the ground, labouring',()=>{
 const p=fly(grounded(),{lift:1},6);assert(p.y>8,'flapping lifts the craft clear');assert(p.y<30,'the climb is hard work');
});
test('flapping with the stick forward runs, lifts off and climbs away',()=>{
 const p=grounded();let air=null;fly(p,{lift:1,forward:1},10,(q,i)=>{if(air===null&&q.y>1.5)air=i/60;});
 assert(air!==null&&air<2.5,'the run lifts off within a couple of seconds');assert(p.wing.airspeed>craft.stall*1.2,'it reaches flying speed');assert(p.y>20,'and climbs');
});
test('a quick tap still gives one whole downstroke',()=>{
 const tap=aloft(100,0),none=aloft(100,0);fly(tap,i=>i===0?{lift:1}:{},.2);fly(none,{},.2);
 assert(tap.wing.beating,'the beat outlives the tap');assert(tap.velocity.y-none.velocity.y>1.5,'the stroke keeps pushing after release');
 fly(tap,{},1/craft.rate);assert(!tap.wing.beating,'one tap, one beat');
});
test('a gentle descent gathers speed with no flapping',()=>{
 for(const pitch of [-.18,-.3]){const p=aloft(250,craft.speed,pitch),before=p.wing?.airspeed??craft.speed;fly(p,{},8);assert(p.wing.airspeed>before+3,'heading slightly down builds speed');assert(!p.wing.beating);}
 const steep=fly(aloft(400,craft.speed,-1),{},8);assert(Math.abs(steep.wing.airspeed-craft.top)<.01,'a steep dive reaches the fastest stoop, no further');assert.equal(steep.wing.mode,'diving');
});
test('pulling up trades speed for height until the wings stall',()=>{
 const p=aloft(100,craft.speed,.35);let peak=p.y,stalledAt=null;fly(p,{},6,(q,i)=>{peak=Math.max(peak,q.y);if(stalledAt===null&&q.wing.mode==='stalling')stalledAt=i/60;});
 assert(peak>104,'the pull-up gains height');assert(stalledAt!==null&&stalledAt<5,'it slows until it stalls');assert(p.y<peak-3,'a stalled craft sinks');
});
test('Flap climbs at flying speed; diving recovers a stall',()=>{
 const p=fly(aloft(100),{lift:1},10);assert(p.y>120,'Flap climbs');assert(p.wing.airspeed>craft.stall*1.2,'and keeps flying speed');
 const q=aloft(100,craft.speed,.6);fly(q,{},3);assert(q.wing.stall>.5,'stalled');q.pitch=-.5;fly(q,{},3);assert(q.wing.airspeed>craft.stall,'the dive restores flying speed');assert(q.wing.stall<.2,'stall recovered');
});
test('tucking the wings drops faster than a glide',()=>{
 const tuck=fly(aloft(200),{lift:-1},4),glide=fly(aloft(200),{},4);assert(tuck.y<glide.y-10);assert(tuck.wing.airspeed>glide.wing.airspeed);
});
test('without wingbeats, energy only drains',()=>{
 const p=aloft(300,craft.speed,.1);const start=energy(p);let most=start;fly(p,i=>({turn:i<300?.5:0}),20,q=>{q.pitch=Math.sin(q.y)*.3;most=Math.max(most,energy(q));});
 assert(most<start*1.001,'no free energy');assert(energy(p)<start*.9,'drag takes its share');
});
test('flight still respects floors, walls and the speed cap at Academy scale',()=>{
 const world={allowed3:(x,y,z)=>Math.abs(x)<10&&y>.4&&y<20&&Math.abs(z)<10&&!(z<-2&&z>-3),clear:()=>true};
 const p={x:0,y:5,z:0,yaw:0,pitch:0};for(let i=0;i<180;i++)F.step(p,{forward:1},1/60,world);assert(p.z<=-.5&&p.z>=-2,'swept collision holds even thin wall');
 const low={x:0,y:3,z:5,yaw:0,pitch:-1};for(let i=0;i<600;i++)F.step(low,{},1/60,world);assert(low.y>.4,'the floor holds');assert.equal(low.wing.mode,'grounded');
});
test('a resumed flight glides on; grounded or landed birds do not',()=>{
 const p={x:0,y:50,z:0,yaw:0,pitch:0};F.step(p,{},1/60,{allowed3:()=>true});assert(p.velocity.z<-4,'mid-air resume picks up in a glide');
 const g={x:0,y:.5,z:0,yaw:0,pitch:0};F.step(g,{},1/60,{allowed3:(x,y)=>y>.45});assert(Math.abs(g.velocity.z)<1e-9,'no glide from the floor');
 const perched={x:0,y:5,z:0,yaw:0,pitch:0,landed:'library',velocity:{x:0,y:0,z:0}},before=JSON.stringify(perched);F.step(perched,{lift:1,forward:1},1,{allowed3:()=>true});assert.equal(JSON.stringify(perched),before);
});
test('the camera shudders in a stall and widens in a dive',()=>{
 const s=aloft(200,craft.speed,.6),m={};let pitches=[];fly(s,{},4,q=>pitches.push(F.cameraMotion(m,q,1/60).pitch));
 const late=pitches.slice(-60);assert(Math.max(...late)-Math.min(...late)>.004,'stall buffet');assert(late.reduce((a,b)=>a+b)/late.length<-.03,'the nose drops');
 const d=aloft(400,craft.speed,-.8),n={};let view;fly(d,{},5,q=>view=F.cameraMotion(n,q,1/60));assert(view.fov>3,'speed widens the view');
});
console.log(`${count} real flight groups passed.`);
