'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const core=require('../first_village_tutorial.js');
const fn=name=>html.match(new RegExp('(?:async )?function '+name+'\\([^]*?\\n}'))?.[0]||'';
function runtime(phase='overview-walk',target='village_hall'){
 const c={gameState:{tutorialFlow:{firstVillage:{version:1,enrolled:true,seed:7,hallState:'built',phase}}},buildingInteriorOpenView:{seed:7,buildingId:target},currentScreen:'village',villageScene:{},villageRenderer:{},villageCamera:{},villageBuildings:[],ensureVillageWalkModule:async()=>{},buildingRoomsAdapter:()=>({describe:()=>true}),empireVillageRecordBySeed:()=>({name:'Selected Hall'}),walkingCharacterState:()=>{},buildingWorkAdapter:()=>({}),showToast:m=>{c.toast=m;},currentVillage:()=>({seed:7,name:'Selected Hall'}),continuousWalkingAdapter:()=>({}),villageDiscoveryAdapter:()=>({}),villageHarvestAdapter:()=>({}),geographicWorldVisit:false,firstVillageHallState:()=>c.gameState.tutorialFlow.firstVillage,firstVillageTutorialAdapter:()=>({owner:()=>c.gameState}),closeBuildingInterior:()=>{c.buildingInteriorOpenView=null;},window:{BurbzFirstVillageTutorial:core,BurbzVillageWalk:{open:o=>{c.opened=o;}}}};
 const buttons={villageWalkBtn:{disabled:false,isConnected:true,addEventListener:(event,cb)=>{c.top=cb;}}};c.$=id=>buttons[id];c.button=()=>({disabled:false,isConnected:true});
 vm.createContext(c);vm.runInContext(fn('walkSelectedVillage')+'\n'+fn('walkBuildingInterior')+'\n'+html.slice(html.indexOf("$('villageWalkBtn')?.addEventListener"),html.indexOf('// The saved founding ward')),c);return c;
}
for(const entrance of ['sheet','top'])for(const phase of ['overview-gesture','overview-camera','overview-walk','orientation','connected'])test(entrance+' respects selected Hall lesson phase '+phase,async()=>{
 const c=runtime(phase);await (entrance==='sheet'?c.walkBuildingInterior(c.button()):c.top());
 if(['overview-gesture','overview-camera'].includes(phase)){assert.equal(c.opened,undefined,'required gestures cannot be bypassed');assert.match(c.toast,/overview lesson/);if(entrance==='sheet')assert.ok(c.buildingInteriorOpenView,'denied action retains sheet');}
 else{assert.ok(c.opened,'room opens');assert.equal((c.opened.startRoom||c.opened.room).seed,7);assert.equal((c.opened.startRoom||c.opened.room).buildingId,'village_hall');assert.ok(c.opened.firstVillageTutorial,'Hall lesson adapter required');assert.equal(c.opened.fromDesk,true,'computer pullback required');assert.equal(c.opened.isCurrent(),true);c.gameState={};assert.equal(c.opened.isCurrent(),false,'frame guard rejects replaced profile');}
});
for(const phase of ['overview-walk','complete'])for(const cancel of ['root','screen','view'])test('sheet async '+cancel+' cancellation at '+phase,async()=>{
 const c=runtime(phase);let finish;c.ensureVillageWalkModule=()=>new Promise(r=>finish=r);const button=c.button(),p=c.walkBuildingInterior(button);
 if(cancel==='root')c.gameState={tutorialFlow:{firstVillage:{seed:8}}};if(cancel==='screen')c.currentScreen='scan';if(cancel==='view')c.buildingInteriorOpenView=null;
 finish();await p;assert.equal(c.opened,undefined);assert.equal(button.disabled,false);
});
for(const kind of ['veteran','other-building','other-Hall'])test('ordinary visit remains ordinary: '+kind,async()=>{const c=runtime(kind==='veteran'?'complete':'overview-gesture',kind==='other-building'?'hut':'village_hall');if(kind==='other-Hall')c.buildingInteriorOpenView.seed=8;await c.walkBuildingInterior(c.button());assert.ok(c.opened);assert.equal(c.opened.room.buildingId,kind==='other-building'?'hut':'village_hall');assert.ok(!c.opened.firstVillageTutorial);assert.ok(!c.opened.fromDesk);assert.equal(c.opened.isCurrent(),true);c.gameState={};assert.equal(c.opened.isCurrent(),false);});
for(const entrance of ['sheet','top'])test(entrance+' selected-village switch rejects pending lesson',async()=>{const c=runtime();let finish;c.ensureVillageWalkModule=()=>new Promise(r=>finish=r);const p=entrance==='sheet'?c.walkBuildingInterior(c.button()):c.top();c.currentVillage=()=>({seed:8});finish();await p;assert.equal(c.opened,undefined);});
