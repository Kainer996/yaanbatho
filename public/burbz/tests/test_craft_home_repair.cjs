'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const C=require('../flight_craft_core.js'),G=require('../geographic_world_core.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const source=html.slice(html.indexOf('function saveFlightCraft('),html.indexOf('function geographicSettlementRecords('));
const home={lat:54.45,lon:-2.65,revision:1},pose={...home,altitude:120,yaw:-1.9997,pitch:0,mode:'walk'};
test('normalized craft receipts remain byte stable through reads and reloads at every heading',()=>{
 for(let n=-32000;n<=32000;n++){
  const a=C.at({...pose,yaw:n/10000});
  assert.deepEqual(C.normalize(JSON.parse(JSON.stringify(a))),a,'heading '+n/10000);
 }
});
test('a renderer receipt survives repeated canonical reads, genuine failure rolls back, and retry works',()=>{
 const state={playerHome:{anchor:home},flightCraft:C.at(pose),worldJourney:{prior:true},player:{coins:12},inventory:{seed:3}};
 let ok=true,writes=0;
 const c={gameState:state,BurbzFlightCraftCore:C,BurbzGeographicWorldCore:G,refreshGeographicAvatarMarker(){},durableSaveState(){writes++;return{ok};}};
 vm.createContext(c);vm.runInContext(source,c);
 const receipt=C.normalize(C.normalize(state.flightCraft));
 assert(c.saveFlightCraft(receipt,pose,receipt,state,1),'same craft must pass the receipt guard');
 const prior=state.flightCraft,journey=state.worldJourney;ok=false;
 assert(!c.saveFlightCraft({...prior,phase:'boarded'},pose,prior,state,1));
 assert.equal(state.flightCraft,prior);assert.equal(state.worldJourney,journey);
 ok=true;assert(c.saveFlightCraft({...prior,phase:'boarded'},pose,prior,state,1));
 assert.equal(writes,3);assert.deepEqual(state.player,{coins:12});assert.deepEqual(state.inventory,{seed:3});
});
const craftSource=fs.readFileSync(require.resolve('../flight_craft.js'),'utf8');
const provision=craftSource.slice(craftSource.indexOf(' function provision(){'),craftSource.indexOf(' function initialize(){'));
function provisionAtDoor({phase='parked',door=true,ok=true,terrain=true}={}){
 const old=C.at({...pose,...G.unproject(home,{x:500,y:120,z:500})},phase);
 const c={C,G,record:old,homeBerthPending:door,closed:false,aboard:false,onDeck:false,opts:{homeDoor:door,getHome:()=>({anchor:home}),craft:{shelterIntro:()=>false}},env:{local:p=>G.project(home,p),geo:p=>G.unproject(home,p),sample:()=>terrain?{height:120,kind:'ground'}:null,clear:()=>true,parkingClear:()=>true},writes:0};
 c.local=()=>c.env.local(c.record);c.commit=next=>{c.writes++;if(ok)c.record=next;return ok;};vm.createContext(c);vm.runInContext(provision+'result=provision();',c);return{c,old};
}
test('every saved craft phase parks outside the chosen home on home-door return',()=>{
 for(const phase of ['parked','boarded','flying','deck']){const {c}=provisionAtDoor({phase});assert(c.result);assert.equal(c.writes,1);assert.equal(c.record.phase,'parked');assert(G.distance(home,c.record)<20);}
});
test('ordinary exploration preserves distant parking; failed home return preserves the prior craft',()=>{
 for(const options of [{door:false},{ok:false},{terrain:false}]){const {c,old}=provisionAtDoor(options);assert.equal(c.record,old);if(options.door===false)assert.equal(c.writes,0);else assert.equal(c.result,false);}
});
test('Build uses the real save gate, opens the existing editor with local pose, and retries after failure',async()=>{
 const text=fs.readFileSync(require.resolve('../village_world.js'),'utf8');
 const binding=text.slice(text.indexOf(" build.addEventListener('click'"),text.indexOf(' const geo=',text.indexOf(" build.addEventListener('click'")));
 const state={playerHome:{anchor:home},flightCraft:C.at(pose)};
 let handler,ok=true,opened=[];
 const a={gameState:state,BurbzFlightCraftCore:C,BurbzGeographicWorldCore:G,refreshGeographicAvatarMarker(){},durableSaveState:()=>({ok}),
  build:{addEventListener(event,fn){handler=fn;}},places:new Map([['home',{x:10,z:20}]]),root:{BurbzPlayerHomeCore:{YARD:{walk:50}}},s:{player:{x:12,z:24,yaw:pose.yaw,pitch:0,mode:'walk'},reset(){},abort:new AbortController()},opts:{getHome:()=>({tier:1}),openBuild:p=>opened.push(p)}};
 vm.createContext(a);vm.runInContext(source,a);
 let receipt=C.normalize(C.normalize(state.flightCraft));
 a.save=()=>{const result=a.saveFlightCraft(receipt,pose,receipt,state,1);if(result)receipt=C.normalize(state.flightCraft);return result;};
 vm.runInContext(binding,a);await handler();assert.equal(opened.length,1);assert.equal(opened[0].x,2);assert.equal(opened[0].z,4);assert.equal(a.s.uiBusy,false);
 ok=false;await handler();assert.equal(opened.length,1);assert.equal(a.s.uiBusy,false);
 ok=true;await handler();assert.equal(opened.length,2);
});
test('nearby actions do not use a horizontal strip and Build explains its purpose',()=>{
 const css=fs.readFileSync(require.resolve('../first_person_hud.css'),'utf8'),world=fs.readFileSync(require.resolve('../village_world.js'),'utf8');
 assert(!/\.fp-actions\{[^}]*overflow-x:auto/.test(css),'no horizontally scrolling nearby actions');
 assert(/\.fp-actions \.fp-action\{[^}]*position:static!important[^}]*max-height:none/.test(css),'all viewport actions override inline positioning and allow complete labels');
 // Inspect every shipped stylesheet: lazy modules must not override the shared tray.
 for(const file of fs.readdirSync(require('node:path').resolve(__dirname,'..')).filter(f=>f.endsWith('.css'))){
  const sheet=fs.readFileSync(require('node:path').resolve(__dirname,'..',file),'utf8');
  for(const rule of sheet.matchAll(/([^{}]+)\{([^{}]*)\}/g))if(rule[1].includes('.fp-actions')&&rule[1].includes('.vw-building-work')){
   assert(!/overflow-x\s*:\s*(auto|scroll)|flex-direction\s*:\s*row|(?:max-)?height\s*:\s*56px/.test(rule[2]),file+' must not restore clipped horizontal construction actions');
  }
 }
 assert(world.includes("build.textContent='Build & decorate'"));
});
