'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const O=require('../enemy_outposts_core.js'),G=require('../geographic_world_core.js'),W=require('../wilderness_combat_core.js'),B=require('../battle_core.js'),L=require('../loot_crafting_core.js'),C=require('../first_person_spell_core.js');
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
const candidate=O.nearby({lat:54.45,lon:-2.65})[0];
// Scene doubles exercise the actual outpost controller lifecycle without claiming
// renderer evidence. Geometry, navigation, combat and save assertions stay separate.
class V{set(x,y,z){Object.assign(this,{x,y,z});return this;}}
class Mesh{constructor(g,m){this.geometry=g;this.material=m;this.children=[];this.position=new V();this.scale=new V();this.rotation={};this.uuid='scene-object';}add(m){this.children.push(m);m.parent=this;}removeFromParent(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}setMatrixAt(){}dispose(){this.disposed=true;}}
class Asset{dispose(){this.disposed=true;}}
class Element{constructor(){this.hidden=false;this.children={};}querySelector(k){return this.children[k]||=(new Element());}addEventListener(k,fn){this[k]=fn;}remove(){this.removed=true;}}
function fixture({friendly=false,injured=false,discovered=true,partial=false}={}){
 const f={state:O.empty(),light:friendly,unknown:false,sealed:false,rocks:[{x:-3,z:-2,r:.8}],xp:0,partial};if(discovered)O.discover(f.state,candidate,1000);if(injured)f.state.camps[candidate.id].hp[0]=17;if(friendly)Object.assign(f.state.camps[candidate.id],{hp:[0,0,0],liberated:true,liberatedAt:1000});
 const ground=(x,z)=>f.unknown||f.partial&&(Math.abs(x)>6||Math.abs(z)>6)?null:0,safeAt=()=>f.light||f.unknown;
 const allowed=(x,z,y)=>!f.sealed&&!f.unknown&&!f.rocks.some(r=>Math.hypot(x-r.x,z-r.z)<r.r)&&!f.controller?.blocked(x,y??null,z);
 const segment=(a,b,walking)=>{const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.15));for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,y=a.y+(b.y-a.y)*t;if(!allowed(x,z,walking?undefined:y)||ground(x,z)===null||y<=.08)return false;}return true;};
 f.player={x:0,z:9,y:0,mode:'walk'};f.root={append(el){f.status=el;}};f.scene=new Mesh();f.s={options:{continuousWorld:{}},root:f.root,source:{scene:f.scene},player:f.player,world:{height:ground,allowed:(x,z)=>allowed(x,z)},abort:new AbortController(),continuity:{navigation:()=>({origin:candidate,pose:candidate})}};
 const context={BurbzEnemyOutpostsCore:O,BurbzGeographicWorldCore:G,THREE:{Group:Mesh,Mesh,InstancedMesh:Mesh,BoxGeometry:Asset,CylinderGeometry:Asset,PlaneGeometry:Asset,MeshLambertMaterial:Asset,Matrix4:class{compose(){return this;}},Quaternion:class{},Vector3:V,DoubleSide:2},document:{createElement:()=>new Element()},performance};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../enemy_outposts.js'),'utf8'),context);
 f.adapter={outposts:{read:()=>f.state,now:()=>1000,dark:()=>!f.light,discover:c=>O.discover(f.state,c,1000),collect:id=>O.collect(f.state,id,1000)}};
 f.controller=context.BurbzEnemyOutposts.attach(f.s,{adapter:f.adapter,safeAt,ground,allowed,clear:(a,b)=>segment(a,b,false),walkClear:(a,b)=>segment(a,b,true),notice(){}});
 f.scan=()=>{for(let i=0;i<25;i++)f.controller.update(.05);};f.scan();
 f.combat=()=>W.create({B,L,C,kit:()=>({loadout:{weapon:'willow_wand'},gearLevel:1}),ground,safeAt,allowed,clear:(a,b)=>segment(a,b,false),walkClear:(a,b)=>segment(a,b,true),encounter:p=>f.controller.encounter(p),save:(record,extra)=>{if(f.fail)return false;const reward=O.damage(f.state,extra.outpostHits,1000);f.xp+=reward.xp;f.saved=structuredClone(f.state);if(reward.xp)f.light=true;return true;}});
 f.allowed=allowed;f.segment=segment;return f;
}
test('Blocked preferred slots use distinct real ground positions with a common walk and shot approach',()=>{
 const f=fixture(),e=f.controller.encounter(f.player),d=f.controller.diagnostics().visible[0];assert.equal(e.guards.length,3);assert(d.guardsReady);for(const g of e.guards){assert(f.allowed(g.position.x,g.position.z,g.position.y));assert(Math.hypot(g.position.x+3,g.position.z+2)>.8);assert(f.segment(d.approach,g.position,true));assert(f.segment({...d.approach,y:d.approach.y+.7},g.position,false));}assert.equal(new Set(e.guards.map(g=>g.position.x+':'+g.position.z)).size,3);f.controller.dispose();
});
test('Unloaded or sealed ground leaves saved defenders pending and retries without changing HP or rewards',()=>{
 const f=fixture({injured:true}),before=JSON.stringify(f.state);for(const field of ['unknown','sealed']){f[field]=true;f.scan();assert.equal(f.controller.encounter(f.player).guards.length,0);assert.equal(JSON.stringify(f.state),before);f[field]=false;f.scan();assert.equal(f.controller.encounter(f.player).guards.length,3);assert.equal(f.controller.encounter(f.player).guards[0].hp,17);}assert.equal(f.xp,0);f.controller.dispose();
});
test('A new camp with only its centre loaded retries after approach coverage arrives',()=>{
 const f=fixture({discovered:false,partial:true});assert.equal(f.controller.diagnostics().visible.length,0);assert.equal(Object.keys(f.state.camps).length,0);assert.equal(f.controller.diagnostics().probes.length,0);f.partial=false;f.scan();assert.equal(f.controller.diagnostics().visible.length,1);assert.equal(f.controller.encounter(f.player).guards.length,3);assert.deepEqual(f.state.camps[candidate.id].hp,[50,50,50]);f.controller.dispose();
});
test('Friendly outpost flags reload inside their own light; hostile saves becoming lit stay undefeated',()=>{
 const f=fixture({friendly:true});assert.equal(f.controller.diagnostics().visible.length,1);assert.equal(f.controller.encounter(f.player),null);assert.equal(f.status.querySelector('strong').textContent,'Friendly outpost');assert.equal(f.controller.mapPoints()[0].radius,O.REVEAL);f.controller.dispose();
 const h=fixture();h.light=true;h.scan();assert.equal(h.controller.encounter(h.player).guards.length,0);assert.deepEqual(h.state.camps[candidate.id].hp,[50,50,50]);assert.equal(O.damage(h.state,[],2000).xp,0);assert(!h.state.camps[candidate.id].liberated);h.controller.dispose();
});
test('A streamed obstacle suppresses an injured actor without death and respawns its saved HP on valid ground',()=>{
 const f=fixture({injured:true}),core=f.combat(),pose={...f.player,y:1.55,yaw:0,pitch:0};for(let i=0;i<16;i++)core.step(.05,pose);assert.equal(core.actors.length,3);const actor=core.actors.find(a=>a.member===0);f.rocks.push({...actor.position,r:.8});f.scan();core.step(.05,pose);assert(!core.actors.some(a=>a.id===actor.id));assert.equal(f.state.camps[candidate.id].hp[0],17);for(let i=0;i<16;i++)core.step(.05,pose);assert.equal(core.actors.find(a=>a.member===0).fighter.hp,17);assert.equal(f.xp,0);core.dispose();f.controller.dispose();
});
test('Actual projectiles from the checked approach defeat the relocated roster once, preserving light and ownership on reload',()=>{
 const f=fixture(),d=f.controller.diagnostics().visible[0],pose={...d.approach,y:d.approach.y+.7,yaw:0,pitch:0},core=f.combat();for(let i=0;i<16;i++)core.step(.05,pose);assert.equal(core.actors.length,3);
 for(let shot=0;shot<30&&!f.state.camps[candidate.id].liberated;shot++){
  for(let i=0;i<55;i++)core.step(.05,pose);assert(core.inspect().hero.hp>0);const a=core.actors.find(a=>a.fighter.hp>0&&f.segment(pose,a.position,false));assert(a,'An actual target remains reachable');const dx=a.position.x-pose.x,dz=a.position.z-pose.z,aim={...pose,yaw:Math.atan2(-dx,-dz),pitch:Math.atan2(a.position.y-pose.y,Math.hypot(dx,dz))};assert(core.begin(aim));assert(core.release(aim));for(let i=0;i<16;i++)core.step(.05,aim);
 }
 assert(f.state.camps[candidate.id].liberated);assert.deepEqual(f.state.camps[candidate.id].hp,[0,0,0]);assert.equal(f.xp,O.XP);assert(f.light);assert.equal(core.actors.length,0);f.scan();assert.equal(f.status.querySelector('strong').textContent,'Friendly outpost');core.dispose();f.controller.dispose();f.state=O.normalize(f.saved);assert.equal(O.damage(f.state,[],5000).xp,0);assert.equal(O.collect(f.state,candidate.id,1000+100*3600000),O.CAP);assert.equal(O.collect(f.state,candidate.id,1000+100*3600000),0);
});
console.log(checks+' outpost reliability groups passed');
