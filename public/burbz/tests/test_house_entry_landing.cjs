'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../geographic_world_core.js'),C=require('../flight_craft_core.js');
global.THREE=require('../lib/three.min.js');global.document={createElement:()=>({style:{},addEventListener(){},remove(){}})};global.matchMedia=()=>({matches:true});require('../flight_craft.js');
function fixture({altitude=20,kind='ground',sample,clear=()=>true,parkingClear=()=>true,save=true}={}){
 const origin={lat:54.45,lon:-2.65},player={x:0,y:altitude,z:0,yaw:0,pitch:0,mode:'fly',velocity:{x:2,y:0,z:1}},pose=()=>({...G.unproject(origin,player),yaw:player.yaw,pitch:player.pitch,mode:player.mode});
 let record=C.at(pose(),'flying',kind),resets=0;const messages=[],s={player,source:{scene:new THREE.Scene()},root:{append(){}},abort:new AbortController(),auto:{reset(){resets++;}}};
 const craft=BurbzFlightCraft.attach(s,{initialPose:pose(),craft:{read:()=>record,commit(next){if(!save)return false;record=next;return true;}}},{style(){},local:p=>G.project(origin,p),geo:p=>G.unproject(origin,p),pose,sample:sample||(()=>({height:0,kind})),clear,parkingClear,resetLift(){},message:text=>messages.push(text)});
 craft.initialize();return{craft,s,player,messages,record:()=>record,resets:()=>resets};
}
test('house quest uses the Home Enter Alderwing button, retaining save and flight records',()=>{
 const html=fs.readFileSync(require.resolve('../index.html'),'utf8'),start=html.indexOf('function playerQuestGo(q) {'),end=html.indexOf('\n}\n',start)+2,calls=[];
 const ctx={currentScreen:'quests',switchScreen(screen){calls.push(screen);ctx.currentScreen=screen;},$:id=>({click(){calls.push(id);}}),enterGeographicWorld(){throw Error('House quest resumed flight');}};
 vm.runInNewContext(html.slice(start,end)+"\nplayerQuestGo({id:'pq_build_home',go:'scan'});",ctx);
 assert.deepEqual(calls,['scan','playerHomeStand']);
});
test('Land craft lands from low, cruising and maximum flight altitude on open ground and water',()=>{
 for(const kind of ['ground','freshwater','sea'])for(const altitude of [1,20,400]){
  const f=fixture({altitude,kind});assert(f.craft.control(),kind+' '+altitude);assert.equal(f.player.y,0);assert.equal(f.player.mode,'walk');assert.equal(f.record().phase,'boarded');assert.equal(f.record().surface,kind);assert.deepEqual(f.player.velocity,{x:0,y:0,z:0});assert(f.resets()>0);assert(f.craft.leave());assert.equal(f.record().phase,kind==='ground'?'parked':'deck');f.craft.dispose();
 }
});
test('blocked ground, missing terrain and obstacles along the full descent refuse without moving or saving',()=>{
 for(const options of [{parkingClear:()=>false},{sample:()=>null},{clear:(x,y,z)=>!(y>7&&y<8)},{clear:(x,y,z)=>!(x>.8&&y>7&&y<8)}]){
  const f=fixture(options),before=structuredClone(f.player),record=structuredClone(f.record());assert.equal(f.craft.control(),false);assert.equal(f.messages.at(-1),"Can't land here");assert.deepEqual(f.player,before);assert.deepEqual(f.record(),record);f.craft.dispose();
 }
});
test('landing save failure rolls back flight position, velocity and occupancy',()=>{
 const f=fixture({save:false}),before=structuredClone(f.player),record=structuredClone(f.record());assert.equal(f.craft.control(),false);assert.deepEqual(f.player,before);assert.deepEqual(f.record(),record);assert(f.craft.aboard());assert.match(f.messages.at(-1),/could not be saved/);f.craft.dispose();
});
test('blocked landing can be retried successfully after moving over open ground',()=>{
 const f=fixture({parkingClear:x=>x>5});assert.equal(f.craft.control(),false);f.player.x=10;assert(f.craft.control());assert.equal(f.player.x,10);assert.equal(f.player.y,0);f.craft.dispose();
});
