'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const Z=require('../zombie_progression_core.js'),W=require('../wilderness_combat_core.js'),B=require('../battle_core.js'),L=require('../loot_crafting_core.js'),C=require('../first_person_spell_core.js'),O=require('../enemy_outposts_core.js');
test('Chickenz start the roster; actual Forge upgrades and discovered bird families unlock flyers without a fixed level order',()=>{
 assert.deepEqual(Z.eligible({gearLevel:1,unlockedSpecies:['Bald Eagle']}).map(r=>r.id),['chickenz']);
 assert.deepEqual(Z.eligible({gearLevel:5,unlockedSpecies:['European Robin']}).map(r=>r.id),['chickenz']);
 assert.deepEqual(Z.eligible({gearLevel:2,unlockedSpecies:['Bald Eagle']}).map(r=>r.id),['chickenz','eaglez']);
 assert.deepEqual(Z.eligible({gearLevel:2,unlockedSpecies:['Peregrine Falcon','Common Raven']}).map(r=>r.id),['chickenz','ravenz','peregrinez']);
 assert.equal(Z.eligible({gearLevel:2,unlockedSpecies:['Raven','Falcon','Eagle','Hawk','Owl']}).length,6);
 assert(Z.ROSTER.every(r=>r.name.endsWith('z')));assert(!Z.byId('chickenz').aerial);
});
test('camp species survive saves, later unlocks and partial defeat without changing HP or reward receipts',()=>{
 const state=O.empty(),p=O.nearby({lat:54.45,lon:-2.65})[0],types=['chickenz','peregrinez','eaglez'];
 O.discover(state,p,100,types);O.damage(state,[{id:p.id+':guard:1',campId:p.id,member:1,hp:17}],200);
 const restored=O.normalize(JSON.parse(JSON.stringify(state)));assert.deepEqual(restored.camps[p.id].enemyKinds,types);assert.equal(restored.camps[p.id].hp[1],17);
 assert(!O.discover(restored,p,300,['owlez','ravenz','hawkez']));assert.deepEqual(restored.camps[p.id].enemyKinds,types);assert.equal(O.damage(restored,[],400).xp,0);
});
function flockFixture(){
 const actors=['ravenz','peregrinez','eaglez'].map((enemyKind,i)=>({id:'bird-'+i,enemyKind,aerial:true,side:'opponent',fighter:{hp:50},position:{x:i*2-2,y:.85,z:-8},cr:0,phase:'takeoff',attackTime:0}));
 const pose={x:0,y:1.55,z:0},events=[],env={body:p=>({...p,y:p.y-.7}),ground:()=>0,dark:()=>true,valid:()=>true,clear:()=>true,attack:a=>events.push({type:'hit',id:a.id}),warn:a=>events.push({type:'warn',id:a.id})};
 let clock=0;return{actors,pose,env,events,tick(n){for(let j=0;j<n;j++){clock+=.05;for(const a of actors){a.cr=Math.min(100,a.cr+2);a.attackTime+=.05;a.moving=false;Z.flyStep(a,actors,pose,.05,clock,env);}assert(actors.filter(a=>['windup','dive'].includes(a.phase)).length<=1,'The flock gives only one dive warning/attack at a time');}}};
}
test('flyers climb, spread into an orbit and take coordinated warned dives that genuinely reach the player',()=>{
 const f=flockFixture();f.tick(60);assert(f.actors.every(a=>a.position.y>2));
 assert(new Set(f.actors.map(a=>Math.round(a.position.x))).size>1);f.tick(800);
 assert(f.events.some(e=>e.type==='hit'));assert(new Set(f.events.filter(e=>e.type==='warn').map(e=>e.id)).size>1);
 for(const hit of f.events.filter(e=>e.type==='hit'))assert(f.events.find(e=>e.type==='warn'&&e.id===hit.id));
});
test('a warned dive keeps its target point so moving aside really evades it',()=>{
 const f=flockFixture(),a=f.actors[0];f.actors.splice(1);Object.assign(a,{phase:'windup',attackTime:0,position:{x:0,y:4,z:-3},diveTarget:{x:0,y:.85,z:0}});f.pose.x=20;f.tick(40);assert(!f.events.some(e=>e.type==='hit'));
});
test('a flyer trapped beneath a canopy follows a clear sideways route and takes off without crossing the tree',()=>{
 const f=flockFixture(),a=f.actors[0];f.actors.splice(1);a.position={x:0,y:.85,z:0};f.pose.z=8;
 f.env.valid=p=>!(Math.abs(p.x)<2&&Math.abs(p.z)<2&&p.y>1);
 f.env.clear=(p,q)=>{for(let i=0;i<=20;i++){const t=i/20;if(!f.env.valid({x:p.x+(q.x-p.x)*t,y:p.y+(q.y-p.y)*t,z:p.z+(q.z-p.z)*t}))return false;}return true;};
 f.tick(120);assert(a.position.y>2);assert.notEqual(a.phase,'takeoff');
});
test('unknown terrain, scenery and bright boundaries stop aerial movement and attacks',()=>{
 for(const key of ['ground','valid','clear','dark']){const f=flockFixture();f.env[key]=()=>key==='ground'?null:false;const before=structuredClone(f.actors.map(a=>a.position));f.tick(100);assert.deepEqual(f.actors.map(a=>a.position),before);assert.equal(f.events.length,0);}
});
function combat(kind){return W.create({B,L,C,kit:()=>({loadout:{weapon:'willow_wand'},gearLevel:1}),ground:()=>0,safeAt:()=>false,allowed:()=>true,clear:()=>true,save:()=>true,encounter:()=>({campId:'test',guards:[{id:'guard',campId:'test',member:0,enemyKind:kind,hp:50,maxHp:50,position:{x:0,z:-4}}]})});}
test('ground enemies cannot peck an airborne player; real flyers can damage through the original combat authority',()=>{
 const chicken=combat('chickenz');for(let i=0;i<400;i++)chicken.step(.05,{x:0,z:0,y:11.55,mode:'fly',yaw:0,pitch:0});assert.equal(chicken.inspect().hero.hp,80);
 const flyer=combat('peregrinez');let maxHeight=0;for(let i=0;i<800&&flyer.inspect().hero.hp===80;i++){flyer.step(.05,{x:0,z:0,y:1.55,mode:'walk',yaw:0,pitch:0});maxHeight=Math.max(maxHeight,...flyer.actors.map(a=>a.position.y));}
 assert(maxHeight>3);assert(flyer.inspect().hero.hp<80);chicken.dispose();flyer.dispose();
});
