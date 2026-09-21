const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),vm=require('vm'),path=require('path');
const R=require('../destination_route_core.js'),T=require('../map_trail_core.js');
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const p=(x,y=0)=>({lat:51.5+y/111320,lon:-.17+x/70000});
test('public footpath is preferred to a shorter parallel road; road remains usable when needed',()=>{
 const a=p(0),b=p(200),c=p(100,80),nodes=[a,b,c].map((p,i)=>({type:'node',id:i+1,...p}));
 const road={type:'way',id:10,nodes:[1,2],geometry:[a,b],tags:{highway:'residential'}};
 const foot={type:'way',id:11,nodes:[1,3,2],geometry:[a,c,b],tags:{highway:'footway',designation:'public_footpath'}};
 for(const [ways,expected] of [[[road,foot],['11','11']],[[road],['10']]]){const r=R.planDestinationRoute({elements:[...nodes,...ways]},a,b);assert.equal(r.ok,true);assert.deepEqual(r.route.routeEvidence.segments.map(s=>s.wayId),expected);assert(R.validateDestinationRoute(r.route).valid);}
});
function harness(){
 const c={console,Date,Number,Set,gameState:{player:{level:1,coins:0},mapPickups:{day:'today',collected:{}}},document:{hidden:true},liveMapHasPrecisePosition:true,liveMapLastPosition:{...p(0),at:Date.now(),accuracy:5},phase:'active',liveWoodlandTimber:[],liveMapPickupRenderKey:'old',durable:null,fail:false,updates:0};
 c.pickups=Array.from({length:30},(_,i)=>({key:'loot-'+i,seed:i,...p(30+i),type:{glyph:'coin',grant(){c.gameState.player.coins++;return '+1';}}}));
 Object.assign(c,{destinationActiveQuest:()=>({phase:c.phase}),mapGatheringGate:q=>T.gathering(q,c.liveMapHasPrecisePosition?c.liveMapLastPosition:null),starterTimberPickupsNear:()=>[],mapPickupsNear:()=>c.pickups,ensureMapPickupState:()=>c.gameState.mapPickups,snapshotGameState:()=>structuredClone(c.gameState),restoreGameStateSnapshot:s=>{c.gameState=s;},villageRngFrom:()=>()=>.5,durableSaveState:()=>{if(c.fail)throw Error('disk full');c.durable=JSON.stringify(c.gameState);},updateHeader:()=>c.updates++,drawMapPickups:()=>c.updates++,burbzHash32:()=>1,WOODLAND_TIMBER_TYPE:{grant:()=>''}});
 vm.createContext(c);vm.runInContext(html.slice(html.indexOf('function collectMapPickup('),html.indexOf('function resumeDestinationPocketGathering()')),c);return c;
}
test('hidden pocket collection gathers ALL nearby loot beyond marker cap and persists once',()=>{const c=harness();assert.equal(c.autoCollectDestinationPickups(),30);assert.equal(c.gameState.player.coins,30);assert.equal(c.updates,0);assert.equal(c.autoCollectDestinationPickups(),0);c.gameState=JSON.parse(c.durable);assert.equal(c.autoCollectDestinationPickups(),0);assert.equal(c.gameState.player.coins,30);});
test('fresh GPS radius gates every item, including off-route loot, regardless of camera',()=>{const c=harness();c.pickups[0]={...c.pickups[0],...p(500)};assert.equal(c.autoCollectDestinationPickups(),29);assert.equal(c.gameState.mapPickups.collected['loot-0'],undefined);c.liveMapLastPosition={...p(500),at:Date.now(),accuracy:5};assert.equal(c.autoCollectDestinationPickups(),1);});
test('stale, future, inaccurate, absent and inactive fixes never award nearby loot',()=>{for(const change of [c=>c.liveMapLastPosition.at=1,c=>c.liveMapLastPosition.at=Date.now()+60000,c=>c.liveMapLastPosition.accuracy=61,c=>c.liveMapHasPrecisePosition=false,c=>c.phase='review']){const c=harness();change(c);assert.equal(c.autoCollectDestinationPickups(),0);assert.equal(c.gameState.player.coins,0);}});
test('failed pocket save restores loot and receipt, successful retry pays once',()=>{const c=harness();c.fail=true;assert.equal(c.autoCollectDestinationPickups(),0);assert.equal(c.gameState.player.coins,0);assert.deepEqual(Object.keys(c.gameState.mapPickups.collected),[]);c.fail=false;assert.equal(c.autoCollectDestinationPickups(),30);assert.equal(c.autoCollectDestinationPickups(),0);});
