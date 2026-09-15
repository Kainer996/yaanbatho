'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const G=require('../geographic_world_core.js'),C=require('../flight_craft_core.js');
global.THREE=require('../lib/three.min.js');global.document={createElement:()=>({style:{},addEventListener(){},remove(){}})};global.matchMedia=()=>({matches:true});require('../flight_craft.js');
test('wounded players can manually steer, land and exit the actual craft controller to return to safety',()=>{
 const origin={lat:54.45,lon:-2.65},player={x:0,y:12,z:0,yaw:0,pitch:0,mode:'fly',velocity:{x:0,y:0,z:0}},pose=()=>({...G.unproject(origin,player),yaw:player.yaw,pitch:player.pitch,mode:player.mode});let record=C.at(pose(),'flying','ground'),resets=0;
 const s={player,source:{scene:new THREE.Scene()},root:{append(){}},abort:new AbortController(),combat:{isDead:()=>true},auto:{reset(){resets++;}}};
 const craft=BurbzFlightCraft.attach(s,{initialPose:pose(),craft:{read:()=>record,commit(next){record=next;return true;}}},{style(){},local:p=>G.project(origin,p),geo:p=>G.unproject(origin,p),pose,sample:()=>({height:0,kind:'ground'}),clear:()=>true,parkingClear:()=>true,resetLift(){},message(){}});
 craft.initialize();assert(craft.aboard());for(let i=0;i<40;i++)craft.move({forward:1,lift:0,side:0},.05);assert(Math.hypot(player.x,player.z)>2,'Manual steering stays available while wounded');
 player.y=1;assert(craft.control(),'Landing works while wounded');assert.equal(player.mode,'walk');assert(craft.leave(),'Safe disembarkation works while wounded');assert(!craft.aboard());assert.equal(record.phase,'parked');assert(resets>=2);craft.dispose();
});
