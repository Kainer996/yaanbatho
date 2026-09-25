const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const G=require('../geographic_world_core.js'),F=require('../academy_flight_core.js');
// Glide on release (v479): only Flap beats the wings. Let go and the wings go
// still, the craft tips over into a steady glide and loses height gently.
// One Flap button sits by the right thumb; the Dive button is gone.
let count=0;function test(name,fn){fn();count++;console.log('PASS '+name);}
const flat={height:()=>0,allowed:()=>true,allowed3:()=>true,clear:()=>true};
const craft=F.settings({speed:G.FLIGHT_SPEED,liftSpeed:G.LIFT_SPEED});
const fly=(p,input,seconds,each)=>{for(let i=0;i<Math.round(seconds*60);i++){G.step(p,typeof input==='function'?input(i):input,1/60,flat,'fly');each?.(p,i);}return p;};
const grounded=()=>{const p={x:0,y:0,z:0,yaw:0,pitch:0,mode:'walk'};assert(G.takeoff(p,flat).ok);return p;};
const aloft=(y=200,speed=craft.speed,pitch=0)=>({x:0,y,z:0,yaw:0,pitch,mode:'fly',velocity:{x:0,y:0,z:-speed}});
const read=file=>fs.readFileSync(path.join(__dirname,'..',file),'utf8');

test('only Flap beats the wings; the stick and Auto glide',()=>{
 let beats=0;const p=fly(aloft(100),{forward:1},10,q=>beats+=q.wing.beating?1:0);
 assert.equal(beats,0,'pushing ahead never flaps');assert.equal(p.wing.mode,'gliding');assert(p.y<100,'still wings lose height');
 const q=fly(aloft(100),{lift:1},3);assert(q.wing.beating&&q.y>100,'Flap beats and climbs');
});
test('letting go of Flap stills the wings within one beat and glides on, never stalling',()=>{
 for(const [name,start] of [['a climb',()=>fly(aloft(100),{lift:1},5)],['a hover',()=>fly(aloft(100,0),{lift:1,forward:-1},4)]]){
  const p=start();assert(p.wing.beating);fly(p,{},1/craft.rate+.05);assert(!p.wing.beating,name+': the wings go still within one beat');
  let most=0;const y=p.y;fly(p,{},12,q=>most=Math.max(most,q.wing.stall));
  assert(most<.2,name+': letting go never stalls');assert.equal(p.wing.mode,'gliding');assert(p.y<y-10,name+': the craft loses height');
  assert(Math.abs(p.wing.airspeed-craft.speed)<craft.speed*.1,name+': back to cruise speed');assert(Math.abs(-p.velocity.y-craft.speed/8)<.5,name+': a gentle 8:1 glide');
 }
});
test('still wings with a level look hold a steady glide at cruise',()=>{
 const p=fly(aloft(100),{},4),y=p.y,samples=[];fly(p,{},8,q=>samples.push(q.wing.airspeed));
 assert(Math.max(...samples)-Math.min(...samples)<.5,'airspeed holds steady');assert(Math.abs(p.wing.airspeed-craft.speed)<craft.speed*.05);
 const sink=(y-p.y)/8;assert(sink>craft.speed/10&&sink<craft.speed/6,'height drains gently: '+sink.toFixed(2)+' m/s');
});
test('a glide carries the craft all the way down to the ground',()=>{
 let most=0,beats=0;const p=fly(aloft(20),{},16,q=>{most=Math.max(most,q.wing.stall);beats+=q.wing.beating?1:0;});
 assert.equal(p.wing.mode,'grounded');assert(Math.abs(p.y-G.MIN_AGL)<.01);assert.equal(beats,0);assert(most<.2);
});
test('flapping with the stick held back hovers in place',()=>{
 const p=fly(grounded(),{lift:1,forward:-1},6);assert(p.y>8&&p.y<25,'a hover climbs slowly');assert(Math.hypot(p.x,p.z)<3,'a hover holds its place');assert.equal(p.wing.mode,'hovering');
 const on=fly(grounded(),{lift:1},6);assert(Math.hypot(on.x,on.z)>10,'Flap alone flies on as it climbs');
});
test('pulling up still stalls, and looking down still gathers speed',()=>{
 const p=fly(aloft(100,craft.speed,.6),{},3);assert(p.wing.stall>.5&&p.wing.mode==='stalling','a pull-up stalls');
 const d=fly(aloft(250,craft.speed,-.18),{},8);assert(d.wing.airspeed>craft.speed+3,'a look down builds speed');
});
test('the Academy bird glides the same way at its own scale',()=>{
 const p={x:0,y:30,z:0,yaw:0,pitch:0};for(let i=0;i<600;i++)F.step(p,{},1/60,{allowed3:()=>true});
 assert(Math.abs(p.wing.airspeed-5.2)<.3);assert(Math.abs(-p.velocity.y-5.2/8)<.15);assert(!p.wing.beating);
});
test('one Flap button sits by the right thumb; the Dive button is gone',()=>{
 const world=read('village_world.js'),combat=read('wilderness_combat.js'),css=read('wilderness_combat.css'),hud=read('first_person_hud.css');
 assert(!/'Dive'|descend/.test(world),'no Dive button in the craft');assert(/setAttribute\('aria-label','Flap'\)/.test(world));
 assert(!/Dive"\]|wc-descend/.test(combat+css+hud),'no Dive layout left behind');
 assert(/#villageWalk\.wc-ready\.fp-ready \.wc-climb\{right:calc\(116px/.test(css),'landscape Flap sits beside the attack stick');
 assert(/#villageWalk\.wc-ready\.fp-ready \.wc-climb\{left:auto!important;right:calc\(18px/.test(css),'portrait Flap sits on the right');
 for(const file of ['village_walk.js','building_rooms.js'])assert(read(file).includes('Let go to glide')&&!read(file).includes('fly on'),file+' teaches the glide');
});
console.log(`${count} glide on release groups passed.`);
