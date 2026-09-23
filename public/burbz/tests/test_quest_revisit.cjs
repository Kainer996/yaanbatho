'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const trail=require('../map_trail_core.js'),places=require('../geographic_places_core.js'),state=require('../destination_state_core.js'),ui=require('../destination_quest_ui.js');
const now=1800000000000,p={lat:51.5,lon:-.12},fix={...p,at:now,accuracy:5};
function record(){return {schemaVersion:1,kind:'destination-quest',id:'walk',phase:'active',route:{},quote:{},receipts:{encounters:{}},entries:['building','character','bird'].map((kind,i)=>({schemaVersion:1,id:kind,kind,route:{...p,lon:p.lon+i*.02,distanceM:i*1000,sourceSegment:{}},generatedGameEncounter:true,observedRealWorld:false,nativeAction:{method:'open'}}))};}
function fixture(){let root={profileId:'a',revision:0,destinationQuests:{...state.emptyDestinationState(),active:record()}},saved,fail=false;const adapter={persist(){if(fail)return false;saved=JSON.parse(JSON.stringify(root));return true;}};return {get root(){return root},set root(x){root=x},adapter,get saved(){return saved},fail(){fail=true},recover(){fail=false}};}
test('destination GPS discovery persists without paying; stale/no GPS revisit but unseen future blocked',async()=>{
 const f=fixture();assert.equal(typeof state.observeDestinationEncounters,'function','GPS encounters need durable passed evidence');
 assert.equal(state.observeDestinationEncounters(f.root,fix,f.adapter,{now}).status,'committed');
 assert.equal(f.root.destinationQuests.active.entries[0].receiptId,undefined);
 f.root=JSON.parse(JSON.stringify(f.saved));let opened=0;const c=ui.createTimelineController({rootState:()=>f.root,stateCore:state,saveAdapter:f.adapter,now:()=>now+900000,getPrecisePosition:()=>null,nativeHandlers:{open:()=>opened++}});
 assert.equal((await c.openEntry('building')).status,'committed');assert.equal((await c.openEntry('building')).status,'duplicate');assert.equal(opened,2);
 assert.equal((await c.openEntry('character')).status,'not-discovered');
 state.finishDestinationWalk(f.root,f.adapter,{now});assert.equal((await c.openEntry('character')).status,'committed','honor review unchanged');
});
test('destination failed discovery save rolls back; stale inaccurate or future fix never discovers',()=>{
 const f=fixture();assert.equal(typeof state.observeDestinationEncounters,'function');const before=JSON.stringify(f.root);f.fail();assert.equal(state.observeDestinationEncounters(f.root,fix,f.adapter,{now}).status,'failed');assert.equal(JSON.stringify(f.root),before);f.recover();for(const bad of [null,{...fix,at:now-130000},{...fix,at:now+11000},{...fix,accuracy:90}])assert.equal(state.observeDestinationEncounters(f.root,bad,f.adapter,{now}).status,'unchanged');assert.equal(JSON.stringify(f.root),before);
});
test('destination serializes native double taps and cancels pending native receipt',async()=>{
 const f=fixture();f.root.destinationQuests.active.phase='review';let release,count=0;const c=ui.createTimelineController({rootState:()=>f.root,stateCore:state,saveAdapter:f.adapter,prepareNative:()=>{count++;return new Promise(r=>release=r);}});
 const a=c.openEntry('building'),b=c.openEntry('building');assert.equal(count,1);assert.equal(typeof c.cancelPending,'function');c.cancelPending();release({close:()=>count--});assert.equal((await a).status,'stale-native');await b;assert.equal(count,0);assert.deepEqual(f.root.destinationQuests.active.receipts.encounters,{});
});
test('cancelled pending entry cannot block or clear a newer pending entry',async()=>{
 const f=fixture();f.root.destinationQuests.active.phase='review';const waiting=[];let attempts=0;
 const c=ui.createTimelineController({rootState:()=>f.root,stateCore:state,saveAdapter:f.adapter,prepareNative:()=>{attempts++;return new Promise(r=>waiting.push(r));}});
 const old=c.openEntry('building');c.cancelPending();const next=c.openEntry('character');assert.equal(attempts,2);waiting[0]({close(){}});assert.equal((await old).status,'stale-native');const duplicate=c.openEntry('character');assert.equal(attempts,2);waiting[1](true);assert.equal((await next).status,'committed');assert.equal((await duplicate).status,'committed');assert.equal(Object.keys(f.root.destinationQuests.active.receipts.encounters).length,1);
});
test('wayside saved visits permit seated entry without granting unseen places',()=>{
 const place={...p,id:'wayside:1'};assert.equal(typeof places.entryGate,'function');assert.equal(places.entryGate(place,null,{visited:{[place.id]:now}},now).ready,true);assert.equal(places.entryGate(place,null,{},now).ready,false);assert.equal(places.entryGate(place,fix,{},now).ready,true);
});
test('side finds use recorded GPS path vertices, never inferred gaps or mere found label',()=>{
 assert.equal(typeof trail.sideDiscoveryPassed,'function');const d={id:'d',...p,foundAt:new Date(now).toISOString()},q={discoveries:[d],path:[[p.lat,p.lon,now]]};assert.equal(trail.sideDiscoveryPassed(q,d),true);assert.equal(trail.sideDiscoveryPassed({...q,path:[]},d),false);assert.equal(trail.sideDiscoveryPassed({...q,path:[[p.lat-.01,p.lon,now],[p.lat+.01,p.lon,now]]},d),false);assert.equal(trail.sideDiscoveryPassed(q,{...d,id:'not-member'}),false);
});
test('profile switch during native preparation discards receipt and closes only prepared room',async()=>{
 const f=fixture();f.root.destinationQuests.active.phase='review';const original=f.root;let release,closed=0;
 const c=ui.createTimelineController({rootState:()=>f.root,stateCore:state,saveAdapter:f.adapter,prepareNative:()=>new Promise(r=>release=r)});
 const pending=c.openEntry('building');f.root={...fixture().root,profileId:'b'};release({close:()=>closed++});assert.equal((await pending).status,'stale-native');assert.equal(closed,1);assert.deepEqual(original.destinationQuests.active.receipts.encounters,{});assert.deepEqual(f.root.destinationQuests.active.receipts.encounters,{});
});
test('discovered destination encounter save failure preserves eligibility and retries exactly once',async()=>{
 const f=fixture();state.observeDestinationEncounters(f.root,fix,f.adapter,{now});let opened=0;const c=ui.createTimelineController({rootState:()=>f.root,stateCore:state,saveAdapter:f.adapter,nativeHandlers:{open:()=>opened++}});
 const before=JSON.stringify(f.root);f.fail();assert.equal((await c.openEntry('building')).status,'failed');assert.equal(JSON.stringify(f.root),before);assert.equal(opened,0);f.recover();assert.equal((await c.openEntry('building')).status,'committed');assert.equal((await c.openEntry('building')).status,'duplicate');assert.equal(Object.keys(f.root.destinationQuests.active.receipts.encounters).length,1);
});
test('planned records and old non-GPS encounter receipts cannot fabricate first discovery',()=>{
 const f=fixture();f.root.destinationQuests.active.receipts.encounters.building={entryId:'building',phase:'active'};
 assert.equal(state.encounterGate(f.root,'building',null,now).ready,false);assert.equal(state.encounterGate(f.root,'building',fix,now).ready,true);
 state.observeDestinationEncounters(f.root,fix,f.adapter,{now});f.root.destinationQuests.active.entries[0].route.lon+=.01;assert.equal(state.encounterGate(f.root,'building',null,now).ready,false);
});
test('claimed Side Quest lore stays on the map and rereads without collecting again',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),code=html.slice(html.indexOf('function drawSideQuestOnMap()'),html.indexOf('function clearSideQuestFromMap()'));
 let read=0,claims=0;const elements=[],q={discoveries:[{id:'l',kind:'lore',...p,claimed:true,tale:{title:'Saved tale',text:'Story'}},{id:'c',kind:'chest',...p,claimed:false}]};
 const ctx={sideQuestMapMarkers:[],drawSideQuestTrail(){},sideQuestActive:()=>q,liveMap:{},window:{maplibregl:{}},document:{createElement:tag=>({tag,attrs:{},setAttribute(k,v){this.attrs[k]=v},appendChild(){},addEventListener(k,fn){this[k]=fn},dataset:{}})},CHEST_SVG:'chest',createGeographicMarker:({element})=>{elements.push(element);return {setLngLat(){return this},addTo(){return this}}},sideQuestClaimDiscovery:()=>claims++,showQuestNpcDialog:()=>read++};vm.createContext(ctx);vm.runInContext(code,ctx);ctx.drawSideQuestOnMap();assert.equal(elements.length,2);assert.equal(elements[0].tag,'button');elements[0].click({stopPropagation(){}});assert.equal(read,1);assert.equal(claims,0);
});
test('reached legacy walking encounter remains on the map and opens with no GPS',()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');const start=html.indexOf('  const encounterStops = window.BurbzWalkingEncounterCore.listQuestEncounters(quest);',html.indexOf('function drawWalkingQuestOnMap()'));
 const code=html.slice(start,html.indexOf('  drawTrailExtrasOnMap(quest);',start));const cp={lat:p.lat,lon:p.lon,kind:'flag',label:'Saved story',reached:true},encounter={id:'saved',name:'Shelter',checkpointIndex:0,discovered:true,kind:'building'};
 function element(){return {dataset:{},style:{},classList:{add(){},toggle(){}},setAttribute(){},appendChild(){},insertAdjacentHTML(){},addEventListener(type,fn){this[type]=fn}};}
 const markers=[],opened=[];const ctx={quest:{id:'legacy',checkpoints:[cp]},window:{BurbzWalkingEncounterCore:{listQuestEncounters:()=>[encounter]},BurbzQuestCore:{questFinishIsReady:()=>false},BurbzWalkingQuestUI:{icon:()=>''}},document:{createElement:element},nextRequiredIdx:1,questMapMarkers:[],liveMap:{},openWalkingEncounter:id=>opened.push(id),createGeographicMarker:({element:el})=>({setLngLat(){return this},addTo(){markers.push(el);return this}})};
 vm.createContext(ctx);vm.runInContext(code,ctx);assert.equal(markers.length,1,'passed story marker must not disappear');markers[0].click({stopPropagation(){}});assert.deepEqual(opened,['saved']);
});
test('legacy Side Quest claim reuses passed evidence with no GPS and exact-once save rollback',async()=>{
 const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');const code=html.slice(html.indexOf('async function sideQuestClaimDiscovery('),html.indexOf('// --- Log + finish'));
 const d={id:'lore',kind:'lore',...p,foundAt:new Date(now).toISOString(),tale:{id:'t',title:'Lore',text:'Read me'},claimed:false},q={id:'q',discoveries:[d],path:[[p.lat,p.lon,now]]};let gameState={player:{level:1,xp:0},side:q},fail=true;
 const ctx={window:{BurbzMapTrailCore:trail},BurbzMapTrailCore:trail,Date,sideQuestActive:()=>gameState.side,ensureSideQuestState:()=>gameState.side,gameState,mapGatheringGate:()=>({ready:false,reason:'No GPS'}),showToast(){},snapshotGameState:()=>structuredClone(gameState),restoreGameStateSnapshot:s=>{Object.assign(gameState,s)},applyPlayerXpState:n=>gameState.player.xp+=n,durableSaveState:()=>{if(fail)throw Error('blocked')},announcePlayerLevelUps(){},SFX:{questComplete(){}},showQuestNpcDialog(){},vibrate(){},QUEST_BUZZ:{},updateHeader(){},renderInventory(){},drawSideQuestOnMap(){},updateWalkQuestHud(){}};q.waysideTales=[];vm.createContext(ctx);vm.runInContext(code,ctx);assert.equal(await ctx.sideQuestClaimDiscovery('lore'),false);assert.equal(gameState.player.xp,0);fail=false;assert.equal(await ctx.sideQuestClaimDiscovery('lore'),true);assert.equal(gameState.player.xp,10);assert.equal(await ctx.sideQuestClaimDiscovery('lore'),false);assert.equal(gameState.player.xp,10);
});
