'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../side_trail_core.js'),html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const start=1800000000000,minute=60000;
const input=(now,distM=500)=>({questActive:true,questId:'original',sideActive:false,distM,accuracy:10,fixAt:now,now});
function elapsed(minutes=40,dist=500){let state;for(let i=0;i<=minutes;i++)state=core.sideTrailStep(state,input(start+i*minute,dist));return state;}
function functionSource(name){const begin=html.indexOf('function '+name+'(');assert.ok(begin>=0,name);for(let end=html.indexOf('}',begin);end>=0;end=html.indexOf('}',end+1)){const source=html.slice(begin,end+1);try{new vm.Script('('+source+')');return source;}catch{}}throw Error(name+' not parsed');}
function freshGame(){return{xp:77,coins:12,inventory:{sword:1},receipts:{chest1:true},walkingQuests:{active:{id:'original',name:'The Original',route:[[51.5,-1.2],[51.51,-1.2]],routeCertification:{status:'certified'},checkpoints:[{id:'c1',reached:true,loot:{coins:20}},{id:'c2',reached:false}],rewards:{xp:130},lastFix:{lat:51.5,lon:-1.2,t:start},distanceWalkedM:450,customFutureData:{held:'unchanged'}},history:[]},sideQuest:{active:null,history:[],waysideTales:[],npcLandmarks:[]}};}
function fixture(game=freshGame()){
 let now=start,fail=false,stored=null;const calls=[],nodes={};
 const element=()=>({hidden:false,style:{},classList:{add(){},remove(){}},setAttribute(k,v){this[k]=v;},appendChild(child){nodes[child.id]=child;}});nodes.mapQuestHud=element();
 const ctx={gameState:JSON.parse(JSON.stringify(game)),window:{BurbzSideTrailCore:core},document:{hidden:true,createElement:element},$:id=>nodes[id],currentScreen:'map',SIDE_QUEST_FIRST_FIND_M:120,QUEST_BUZZ:{start:'start'},SFX:{levelUp(){}},Math,JSON,console,detourLastEvidenceSave:0,
 Date:class extends Date{static now(){return now;}},
 durableSaveState(){if(fail)throw Error('storage full');stored=JSON.stringify(ctx.gameState);return{ok:true};},saveState(){try{return ctx.durableSaveState();}catch(error){return{ok:false,error};}},
 questPocketSuspend(q,t){q.testPocket={state:'suspended',at:t};calls.push(['suspend',q.id]);},questPocketResume(q,t){q.testPocket={state:'active',at:t};calls.push(['resume',q.id]);},
 showToast:m=>calls.push(['toast',m]),showQuestNpcDialog:(...a)=>calls.push(['dialog',...a]),escapeHtml:s=>String(s).replaceAll('<','&lt;'),vibrate(){},
 addPlayerXp(){throw Error('switching must not grant XP');},sideQuestClaimDiscovery(){throw Error('switching must not claim remote loot');},endSideQuest(){throw Error('switching must not complete a quest');}
 };
 for(const name of ['clearWalkingQuestFromMap','clearSideQuestFromMap','startSideQuestPocketMode','stopSideQuestPocketMode','drawSideQuestOnMap','drawWalkingQuestOnMap','closeWalkQuestSheet','renderQuests','updateMapSideQuestButton','acquireQuestWakeLock','releaseQuestWakeLock'])ctx[name]=()=>calls.push([name]);
 vm.createContext(ctx);for(const name of ['snapshotGameState','restoreStateTree','restoreGameStateSnapshot','ensureWalkingQuestState','ensureSideQuestState','activeWalkingQuest','sideQuestActive','savedOriginalQuest','questDetourActionsHTML','updateDetourResumeButton','updateWalkQuestHud','commitDetourTransition','resumeOriginalQuest','resumeSavedDetour','maybeToggleOffRoadSideQuest','startOffRoadSideQuest','questOnPositionFix','sideQuestTrailGeoJSON'])vm.runInContext(functionSource(name),ctx);
 return{ctx,calls,nodes,time:t=>now=t,fail:v=>fail=v,stored:()=>JSON.parse(stored),reload:()=>fixture(JSON.parse(stored)),far(minutes=40){for(let i=0;i<=minutes;i++){now=start+i*minute;ctx.maybeToggleOffRoadSideQuest(ctx.activeWalkingQuest(),51.505,-1.21,10,now);}}};
}
test('distance AND duration are required, with exact 500 m and 40 minute boundaries',()=>{
 assert.equal(elapsed(39).action,null);assert.equal(elapsed(40).action,'start');assert.equal(elapsed(60,499.99).action,null);
 assert.equal(core.sideTrailStep(undefined,input(start,5000)).action,null);
 const almost=elapsed(39);assert.equal(core.sideTrailStep(almost,input(start+40*minute-1)).action,null);assert.equal(core.sideTrailStep(almost,input(start+40*minute)).action,'start');
});
test('only a new fresh accurate fix confirms elapsed time; uncertain GPS preserves the saved start',()=>{
 const state=elapsed(39),t=start+40*minute;
 for(const invalid of [{accuracy:81},{accuracy:undefined},{accuracy:NaN},{accuracy:-1},{fixAt:t-120001},{fixAt:t+1},{fixAt:undefined}]){const next=core.sideTrailStep(state,{...input(t),...invalid});assert.equal(next.action,null,JSON.stringify(invalid));assert.equal(next.elapsedMs,39*minute);assert.equal(next.startedAt,start);}
 for(const reset of [{distM:499},{questId:'new'},{questActive:false}]){const next=core.sideTrailStep(state,{...input(t),...reset});assert.equal(next.action,null);assert.equal(next.elapsedMs,0);}
 assert.equal(core.sideTrailStep(state,input(state.lastFixAt)).elapsedMs,39*minute);
 assert.equal(core.sideTrailStep(elapsed(40),input(start+40*minute)).action,null,'replayed fix never starts another quest');
 const backwards=core.sideTrailStep(state,input(start));assert.equal(backwards.elapsedMs,0);
});
test('screen-off and reload gaps count wall time only after a fresh far confirmation, never while GPS is absent',()=>{
 const initial=core.sideTrailStep(null,input(start));const saved=JSON.parse(JSON.stringify(initial));
 assert.equal(core.sideTrailStep(saved,{...input(start+41*minute),fixAt:start}).action,null);
 assert.equal(core.sideTrailStep(saved,{...input(start+41*minute),fixAt:undefined}).action,null);
 assert.equal(core.sideTrailStep(saved,input(start+41*minute)).action,'start');
 assert.equal(core.sideTrailStep(saved,input(start+41*minute,0)).startedAt,null);
 const uncertain=core.sideTrailStep(saved,{...input(start+41*minute,0),accuracy:200});assert.equal(uncertain.startedAt,start);assert.equal(uncertain.action,null);
});
test('serialized elapsed evidence survives reload but old strikes and changed quest identities do not count',()=>{
 const state=JSON.parse(JSON.stringify(elapsed(39)));assert.equal(core.sideTrailStep(state,input(start+40*minute)).action,'start');
 assert.equal(core.sideTrailStep({strikes:999},input(start)).elapsedMs,0);
 assert.equal(core.sideTrailStep(state,{...input(start+40*minute),questId:'another'}).elapsedMs,0);
});
test('being near the original route never ends an active manual or automatic side quest',()=>{
 for(const sideAuto of [true,false])for(const distM of [0,150,499,500,2000])assert.equal(core.sideTrailStep(elapsed(),{...input(start+41*minute,distM),sideActive:true,sideAuto}).action,null);
});
test('distance is measured against full segments, rejects broken topology and supports antimeridian routes',()=>{
 assert.ok(core.distanceFromRouteM([[51.5,-1.2],[51.51,-1.2]],51.505,-1.2)<.01);
 assert.ok(core.distanceFromRouteM([[0,179.99],[0,-179.99]],0,180)<.01);
 assert.equal(core.distanceFromRouteM([[0,0],[NaN,1],[0,2]],0,1),Infinity);
 assert.equal(core.distanceFromRouteM([[0,0],[0,1]],91,0),Infinity);
});
test('pure transfers keep complete references and refuse overwriting an unrelated or saved quest',()=>{
 const game=freshGame(),q=game.walkingQuests.active,s={id:'side',auto:true,parentQuestId:q.id,discoveries:[{claimed:false,loot:{coins:5}}]};
 const switched=core.detourTransition(game.walkingQuests,game.sideQuest,'start',s);assert.equal(switched.walking.suspended,q);assert.equal(switched.side.active,s);assert.equal(game.walkingQuests.active,q);
 assert.equal(core.detourTransition(switched.walking,switched.side,'start',s),null);
 const resumed=core.detourTransition(switched.walking,switched.side,'original');assert.equal(resumed.walking.active,q);assert.equal(resumed.side.suspendedDetour,s);
 assert.equal(core.detourTransition(resumed.walking,resumed.side,'start',s),null);
 assert.equal(core.detourTransition({active:{id:'unrelated'}},resumed.side,'side'),null);
});
test('real adapter suspends exactly at 40 minutes and its paused original cannot process a near GPS fix',()=>{
 const f=fixture(),before=JSON.parse(JSON.stringify(f.ctx.gameState.walkingQuests.active));f.far(39);assert.ok(f.ctx.activeWalkingQuest());assert.equal(f.ctx.sideQuestActive(),null);
 f.time(start+40*minute);assert.equal(f.ctx.maybeToggleOffRoadSideQuest(f.ctx.activeWalkingQuest(),51.505,-1.21,10,start+40*minute),true);
 assert.equal(f.ctx.activeWalkingQuest(),null);assert.equal(f.ctx.sideQuestActive().parentQuestId,'original');
 const original=f.ctx.gameState.walkingQuests.suspended;for(const field of ['route','checkpoints','rewards','distanceWalkedM','customFutureData'])assert.deepEqual(original[field],before[field]);
 assert.equal(f.ctx.questOnPositionFix(51.505,-1.2,10,start+41*minute).length,0);assert.ok(f.ctx.sideQuestActive());assert.equal(f.ctx.gameState.xp,77);assert.equal(f.ctx.gameState.coins,12);
 assert.equal(f.nodes.mapDetourResume.hidden,false);assert.match(f.nodes.mapDetourResume.textContent,/Resume Original/);assert.match(f.ctx.questDetourActionsHTML(),/resumeOriginalQuest/);
});
test('resume original is immediate without GPS or discovery claims and both saved quests survive reload and switching',()=>{
 const f=fixture();f.far();const side=f.ctx.sideQuestActive();side.discoveries.push({id:'remote',lat:0,lon:0,claimed:false,loot:{coins:55}});side.distanceM=800;
 assert.equal(f.ctx.resumeOriginalQuest(),true);assert.equal(f.ctx.sideQuestActive(),null);assert.equal(f.ctx.activeWalkingQuest().lastFix,null);assert.equal(f.ctx.activeWalkingQuest().offRouteEvidence,null);
 const reloaded=f.reload();assert.equal(reloaded.ctx.gameState.sideQuest.suspendedDetour.discoveries[0].claimed,false);assert.equal(reloaded.ctx.gameState.sideQuest.suspendedDetour.distanceM,800);
 assert.equal(reloaded.ctx.resumeSavedDetour(),true);assert.equal(reloaded.ctx.activeWalkingQuest(),null);assert.equal(reloaded.ctx.sideQuestActive().discoveries[0].id,'remote');
 assert.equal(reloaded.ctx.resumeSavedDetour(),false,'double tap cannot switch twice');assert.equal(reloaded.ctx.resumeOriginalQuest(),true);assert.equal(reloaded.ctx.resumeOriginalQuest(),false);
 assert.equal(reloaded.ctx.gameState.xp,77);assert.equal(reloaded.ctx.gameState.coins,12);assert.deepEqual(reloaded.ctx.gameState.receipts,{chest1:true});
});
test('real adapter reload preserves a pocketed wait and requires a new fresh confirming fix',()=>{
 const f=fixture();f.far(0);const restored=f.reload();restored.time(start+41*minute);
 const q=restored.ctx.activeWalkingQuest();assert.equal(restored.ctx.maybeToggleOffRoadSideQuest(q,51.505,-1.21,10,start),false);assert.equal(restored.ctx.sideQuestActive(),null);
 assert.equal(restored.ctx.maybeToggleOffRoadSideQuest(q,51.505,-1.21,undefined,start+41*minute),false);assert.equal(restored.ctx.sideQuestActive(),null);
 assert.equal(restored.ctx.maybeToggleOffRoadSideQuest(q,51.505,-1.21,10,start+41*minute),true);assert.equal(restored.ctx.savedOriginalQuest().id,'original');
});
test('failed start and resume roll back both quests and pocket ownership before any UI changes',()=>{
 const f=fixture();f.far(39);f.fail(true);f.time(start+40*minute);assert.equal(f.ctx.maybeToggleOffRoadSideQuest(f.ctx.activeWalkingQuest(),51.505,-1.21,10,start+40*minute),false);assert.ok(f.ctx.activeWalkingQuest());assert.equal(f.ctx.sideQuestActive(),null);assert.equal(f.ctx.activeWalkingQuest().testPocket,undefined);
 f.fail(false);f.time(start+40*minute+1);assert.equal(f.ctx.maybeToggleOffRoadSideQuest(f.ctx.activeWalkingQuest(),51.505,-1.21,10,start+40*minute+1),true);
 const before=JSON.stringify(f.ctx.gameState),clears=f.calls.filter(c=>c[0]==='clearWalkingQuestFromMap').length;f.fail(true);assert.equal(f.ctx.resumeOriginalQuest(),false);assert.equal(JSON.stringify(f.ctx.gameState),before);assert.equal(f.calls.filter(c=>c[0]==='clearWalkingQuestFromMap').length,clears);
 f.fail(false);assert.equal(f.ctx.resumeOriginalQuest(),true);
});
test('after explicit side completion the whole original remains available and legacy paired saves resume safely',()=>{
 const f=fixture();f.far();f.ctx.gameState.sideQuest.active=null;assert.equal(f.ctx.resumeOriginalQuest(),true);assert.equal(f.ctx.activeWalkingQuest().id,'original');
 const game=freshGame();game.sideQuest.active={id:'legacy',auto:true,parentQuestId:'original',discoveries:[],path:[[0,0,start]],distanceM:1};
 const old=fixture(game);assert.equal(old.ctx.activeWalkingQuest(),null);assert.equal(old.ctx.resumeOriginalQuest(),true);assert.equal(old.ctx.gameState.sideQuest.suspendedDetour.id,'legacy');
});
test('resuming the charted side trail does not draw a fictional connector across its suspended journey',()=>{
 const f=fixture(),geo=f.ctx.sideQuestTrailGeoJSON({path:[[0,0,1],[0,.001,2],[2,2,3,'resume'],[2,2.001,4]]});
 assert.equal(geo.features.length,2);assert.equal(geo.features[0].geometry.coordinates.length,2);assert.equal(geo.features[1].geometry.coordinates[0][0],2);
});
test('four saved themes vary character, goal and first find across the existing four discovery catalogues',()=>{
 const themes=[0,.25,.5,.99].map(n=>core.sideTrailTheme(()=>n));for(const field of ['id','character','objective','firstKind'])assert.equal(new Set(themes.map(t=>t[field])).size,4);
 assert.deepEqual(themes.map(t=>t.firstKind).sort(),['chest','lore','questgiver','weapon']);for(const t of themes){assert.ok(t.intro.length>70);assert.deepEqual(JSON.parse(JSON.stringify(t)),t);}
});
test('all inline application scripts parse after detour integration',()=>{
 for(const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\/ld\+json/.test(match[1]))new vm.Script(match[2]);
});
