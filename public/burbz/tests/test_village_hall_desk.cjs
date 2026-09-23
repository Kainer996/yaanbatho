const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const base=path.join(__dirname,'..');
const core=require('../building_rooms_core.js');
const plan=core.plan({buildingId:'village_hall',seed:17});
assert.equal(plan.name,'Village Hall');
assert.equal(plan.action,null,'Hall has no tavern service');
const tavern=core.plan({buildingId:'tavern',seed:17});
assert.equal(tavern.name,'Tavern');
assert.equal(tavern.action.kind,'bar');
assert.equal(tavern.deskAction,undefined);
assert.equal(plan.deskAction.kind,'command-desk');
assert.equal(plan.props.filter(p=>p.type==='commanddesk').length,1);
const world=core.world(plan);assert(world.allowed(plan.deskAction.x,plan.deskAction.z),'chair approach is accessible');
assert(!world.allowed(3.5,.2),'desk collision');
for(let z=plan.spawn.z;z>=3;z-=.2)assert(world.allowed(0,z),'clear entrance');
for(let x=0;x<=3.5;x+=.2)assert(world.allowed(x,3),'clear approach');
const scene=fs.readFileSync(path.join(base,'player_home_scene.js'),'utf8');
assert.match(scene,/function createCommandDesk\(/);
assert.match(scene,/const commandDesk=createCommandDesk\(/,'home uses shared model');
assert.match(fs.readFileSync(path.join(base,'building_rooms_scene.js'),'utf8'),/BurbzPlayerHomeScene.createCommandDesk/);
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
assert.match(html,/command:openCommandDesk/,'home callback shared');
assert.match(html,/action === 'command-desk'.*openCommandDesk\(false,true\)/);
const definition=html.match(/\{ id: 'tavern',[^\n]+/)[0];
assert.match(definition,/name: 'Tavern'/);assert.match(definition,/need: 'joy'/);assert.match(definition,/perLevel: 12/);
const hallDefinition=html.match(/\{ id: 'village_hall',[^\n]+/)[0];
assert.match(hallDefinition,/name: 'Village Hall'/);assert.match(hallDefinition,/maxLevel: 1/);assert(!hallDefinition.includes("need: 'joy'"));
assert.match(definition,/coins: 45, branches: 15, stone: 0/);assert.match(definition,/unlockLevel: 6/);assert(!definition.includes("tier: 'town'"));
console.log('Village Hall plan, reachable shared desk, preserved bar and build costs/gates: PASS');

// Execute the shipped function, with explicit gates at both asynchronous boundaries.
const vm=require('node:vm');
const entrySource=html.slice(html.indexOf('async function enterGeographicWorld('),html.indexOf('async function chooseGeographicHomeLocation('));
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
async function checkEntry({boundary='close',cancel=null,homeDoor=false}={}){
  const moduleGate=deferred(),closeGate=deferred(),closing=deferred();
  let current=true,opened=null,released=false;
  const context={
    gameState:{playerHome:{tier:1,anchor:{lat:1,lon:2}},flightCraft:null},currentScreen:'scan',activeCampHomeId:null,
    BurbzGeographicWorldCore:{},BurbzFlightCraftCore:{normalize:value=>value,resumeRequired:()=>false},
    ensureVillageWalkModule:()=>moduleGate.promise,
    geographicSettlementRecords:()=>[{name:'Village',seed:17}],geographicWorldVisit:null,
    BurbzPlayerHome:{close:()=>{}},
    BurbzVillageWalk:{whenClosed:()=>{closing.resolve();return closeGate.promise;},open:options=>{opened=options;return true;}},
    continuousWalkingAdapter:()=>({}),walkingCharacterState:{},buildingWorkAdapter:()=>({}),buildingRoomsAdapter:()=>({}),villageHarvestAdapter:()=>({})
  };
  vm.createContext(context);vm.runInContext(entrySource,context);
  const handoff={pose:{lat:1,lon:2,yaw:0},isCurrent:()=>current,
    ...(homeDoor?{entry:'home-door',release:()=>{released=true;current=false;}}:{commandDeskReturn:{target:{buildingId:'village_hall'}}})};
  const pending=context.enterGeographicWorld(handoff);
  const invalidate=()=>{
    if(cancel==='session')current=false;
    if(cancel==='save')context.gameState={...context.gameState};
    if(cancel==='screen')context.currentScreen='collection';
  };
  if(boundary==='module'){invalidate();moduleGate.resolve();}
  else {moduleGate.resolve();await closing.promise;assert.equal(opened,null,'must wait for old fullscreen exit');invalidate();}
  closeGate.resolve();
  const result=await pending;
  if(cancel){assert.equal(result,false,`${cancel} cancellation during ${boundary} must stop entry`);assert.equal(opened,null,'cancelled entry must not open walking');}
  else {
    assert.equal(result,true,'valid entry opens walking');assert(opened);
    if(homeDoor){assert(released,'home release ran');assert.equal(current,false,'home release intentionally invalidates callback');assert.equal(opened.continuousWorld.homeDoor,true);}
    else {assert.equal(opened.commandDeskReturn,handoff.commandDeskReturn);assert.equal(opened.room,handoff.commandDeskReturn.target);}
  }
}
(async()=>{
  for(const boundary of ['module','close'])for(const cancel of ['save','screen','session'])await checkEntry({boundary,cancel});
  await checkEntry();await checkEntry({homeDoor:true});
  console.log('Hall return cancellation at module/close awaits, valid Hall return, and home-door release: PASS (8 cases)');
})().catch(error=>{console.error(error);process.exitCode=1;});
