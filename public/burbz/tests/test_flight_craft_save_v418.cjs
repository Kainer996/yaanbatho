'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict'),{test}=require('node:test');
const C=require('../flight_craft_core.js'),G=require('../geographic_world_core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const source=html.slice(html.indexOf('function saveFlightCraft('),html.indexOf('function geographicSettlementRecords('));
const pose={lat:54.45,lon:-2.65,altitude:120,yaw:0,pitch:0,mode:'walk'};
function fixture(){
 const c={gameState:{playerHome:{anchor:{...pose,revision:1}},player:{coins:40,hp:70},inventory:{bow:1}},BurbzFlightCraftCore:C,BurbzGeographicWorldCore:G,saves:0,refreshes:0,ok:true};
 c.durableSaveState=()=>{c.saves++;if(c.throwSave)throw Error('storage unavailable');return{ok:c.ok};};
 c.refreshGeographicAvatarMarker=()=>c.refreshes++;vm.createContext(c);vm.runInContext(source,c);
 const identity=c.gameState;return{c,identity,commit:(craft,expected=null,p=pose)=>c.saveFlightCraft(craft,p,expected,identity,1)};
}
test('craft and traveller commit together without touching health, inventory or currency',()=>{
 const {c,commit}=fixture(),craft=C.at(pose);assert(commit(craft));assert.equal(c.saves,1);assert.equal(c.refreshes,1);
 assert.equal(c.gameState.flightCraft.phase,'parked');assert.equal(c.gameState.worldJourney.pose.altitude,120);
 assert.deepEqual(c.gameState.player,{coins:40,hp:70});assert.deepEqual(c.gameState.inventory,{bow:1});
});
test('false and throwing durable saves restore both exact prior objects',()=>{
 for(const throws of [false,true]){const {c,commit}=fixture(),old=C.at(pose),journey={pose};c.gameState.flightCraft=old;c.gameState.worldJourney=journey;c.ok=false;c.throwSave=throws;
 assert(!commit({...old,phase:'boarded'},old));assert.equal(c.gameState.flightCraft,old);assert.equal(c.gameState.worldJourney,journey);assert.equal(c.refreshes,0);}
});
test('stale vehicle receipts, replaced profiles and moved home revisions never overwrite a newer save',()=>{
 for(const kind of ['receipt','profile','home']){const {c,commit}=fixture(),craft=C.at(pose);
 if(kind==='receipt')c.gameState.flightCraft={...craft,phase:'boarded'};
 if(kind==='profile')c.gameState={...c.gameState};
 if(kind==='home')c.gameState.playerHome.anchor.revision=2;
 assert(!commit(craft));assert.equal(c.saves,0);}
});
test('parking location survives a home move when the new scene has the current revision',()=>{
 const {c,identity,commit}=fixture(),craft=C.at(pose);assert(commit(craft));
 c.gameState.playerHome.anchor={lat:55,lon:-3,revision:2};
 assert(c.saveFlightCraft(craft,{...pose,lat:55,lon:-3},craft,identity,2));
 assert.equal(c.gameState.flightCraft.lat,pose.lat);assert.equal(c.gameState.worldJourney.pose.lat,55);
});
test('invalid records and poses fail before any durable write',()=>{
 const {c,commit}=fixture();assert(!commit({...C.at(pose),phase:'other'}));assert(!commit(C.at(pose),null,{...pose,altitude:NaN}));assert.equal(c.saves,0);
});
