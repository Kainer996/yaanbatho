'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
class Element{constructor(){this.nodes=new Map();this.hidden=true;this.classList={add(){},remove(){}};}append(){}addEventListener(){}remove(){}focus(){}setAttribute(){}querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,new Element());return this.nodes.get(k);}}
const context={console,document:{createElement:()=>new Element()},matchMedia:()=>({matches:false})};vm.createContext(context);
for(const file of ['lib/three.min.js','settlement_models.js','village_walk_core.js','building_rooms_core.js','building_rooms_scene.js','interior_life_core.js','interior_life.js','building_rooms.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),context,{filename:file});
const target={scope:'geographic',buildingId:'cabin',seed:12,homeId:'wayside:node:12'};
for(const [label,extra,finds]of [['map building',{},false],['NPC-only capability',{people:()=>[]},false],['owned room',{people:()=>[],collected:()=>false,collect:()=>null},true]]){
 const plan=context.BurbzBuildingRoomsCore.plan(target),world=context.BurbzBuildingRoomsCore.world(plan),scene=new context.THREE.Scene();
 const s={options:{room:target,interiors:{describe:()=>({name:'Cabin'}),...extra}},root:new Element(),abort:{signal:{}},source:{scene,buildings:[],renderer:{toneMappingExposure:1}},player:world.spawn(),world,reset(){}};
 const rooms=context.BurbzBuildingRooms.attach(s);assert(rooms.enter(target));for(let i=0;i<10;i++)assert.doesNotThrow(()=>rooms.update(i));const diagnostics=rooms.diagnostics();assert(diagnostics.inside);assert.equal((diagnostics.life?.pickups.length||0)>0,finds);rooms.dispose();assert.equal(s.room,null);console.log('PASS',label,'renders updates with only its actual capabilities');
}
{
 const plan=context.BurbzBuildingRoomsCore.plan(target),world=context.BurbzBuildingRoomsCore.world(plan),scene=new context.THREE.Scene();const s={options:{name:'Starting village',interiors:{describe:()=>({name:'Wayside shelter'})}},root:new Element(),abort:{signal:{}},source:{scene,buildings:[],renderer:{toneMappingExposure:1}},player:world.spawn(),world,reset(){},continuity:{placeVersion:0,buildings:()=>[],syncControls(){},navigation:()=>({places:[{name:'The Mapmaker’s Bothy',x:0,z:0,radius:13}]})}};
 const rooms=context.BurbzBuildingRooms.attach(s);assert(rooms.enter(target));assert(rooms.leave());assert.equal(s.root.querySelector('.vw-title strong').textContent,'The Mapmaker’s Bothy');rooms.dispose();console.log('PASS Room return restores the actual streamed location heading');
}
