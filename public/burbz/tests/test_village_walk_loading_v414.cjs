'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),core=require('../village_walk_core.js');
class Element{
 constructor(){this.style={};this.children=[];this.queries={};this.events={};this.classList={add(){},remove(){},toggle(){}};this.tagName='SECTION';}
 querySelector(key){return this.queries[key]||=(new Element());}querySelectorAll(){return[];}closest(){return null;}
 setAttribute(){}focus(){}append(el){this.children.push(el);el.parentNode=this;}appendChild(el){this.append(el);}remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(x=>x!==this);}addEventListener(name,fn){(this.events[name]||=[]).push(fn);}
}
function fixture(){
 const body=new Element(),head=new Element(),doc=new Element();Object.assign(doc,{body,head,activeElement:new Element(),getElementById:()=>null,createElement:()=>new Element()});const context={document:doc,AbortController,Set,Map,Promise,console:{warn(){}},setTimeout,clearTimeout,matchMedia:()=>({matches:false}),navigator:{maxTouchPoints:0},location:{hostname:'localhost'},cancelAnimationFrame(){},requestAnimationFrame:()=>1,addEventListener:Element.prototype.addEventListener,events:{}};context.window=context;
 for(const name of ['FlightCraft','ShoreWater','OpenLandCore','WildernessPlacesCore','WildernessPlaces','BuildingWorkCore','BuildingWork','FirstPersonMap','FirstPersonHud','VillageHarvestScene','VillageHarvestCore','VillageHarvest','InteriorLifeCore','InteriorLife','AcademyFlightCore','AcademyFlight','BuildingRoomsCore','BuildingRoomsScene','BuildingRooms','VillageWalkScene','WorldSky','VillageWorldCore','VillageWorld','VillageDiscoveryContent','VillageDiscoveryCore','VillageDiscoveries'])context['Burbz'+name]={};
 let pending;head.appendChild=el=>{head.append(el);if(el.src){assert(el.src.startsWith('village_walk_core.js?'));pending=el;}else queueMicrotask(()=>el.onload());};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve('../village_walk.js'),'utf8'),context);
 return{context,resolve(){context.BurbzVillageWalkCore=core;pending.onload();},body};
}
(async()=>{
 const f=fixture();let sourceCalls=0;const ready=f.context.BurbzVillageWalk.open({source:async()=>{sourceCalls++;assert(f.context.BurbzVillageWalk.diagnostics().auto,'Auto exists before scene initialization');throw Error('Stop before renderer fixture');}});
 assert(ready instanceof Promise);assert.equal(f.context.BurbzVillageWalk.diagnostics().auto,undefined);assert.equal(sourceCalls,0);
 // Blur/reset and an early movement touch are valid while dependencies load.
 for(const fn of f.context.events.blur||[])fn();const stick=f.body.children[0].querySelector('.vw-stick');for(const fn of stick.events.pointerdown||[])fn({button:0,pointerType:'touch',currentTarget:stick,preventDefault(){},stopPropagation(){}});
 f.resolve();assert.equal(await ready,false);assert.equal(sourceCalls,1);assert(f.context.BurbzVillageWalk.diagnostics().auto);f.context.BurbzVillageWalk.close();
 console.log('PASS First native opening awaits the real walking core before creating Auto; loading input/reset stay safe');
 const cancelled=fixture();let invoked=false;const pending=cancelled.context.BurbzVillageWalk.open({source:async()=>{invoked=true;}});cancelled.context.BurbzVillageWalk.close();cancelled.resolve();assert.equal(await pending,false);assert(!invoked);assert(!cancelled.context.BurbzVillageWalk.isOpen());
 console.log('PASS Closing during dependency loading neither initializes Auto nor opens a late scene');
 const auto=core.autoFlight();auto.allow(true);auto.start(4);auto.drag(4,0,-120,90);auto.release(4,true);assert.equal(auto.forward(),1);auto.reset();assert.equal(auto.forward(),0);
 console.log('PASS Existing genuine Auto drag/release latch and stop semantics remain unchanged');
})().catch(e=>{console.error(e);process.exitCode=1;});
