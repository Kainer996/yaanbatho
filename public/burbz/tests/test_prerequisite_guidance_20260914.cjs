'use strict';
const assert=require('node:assert/strict'),G=require('../prerequisite_guidance_core.js'),L=require('../loot_crafting_core.js');
const copy=v=>JSON.parse(JSON.stringify(v));
const facts=(overrides={})=>({recipe:{id:'reed_bow',label:'Wayfarer Bow',coins:20,materials:[{id:'oak_twig',label:'Oak Twig',have:0,need:2,each:6,buyable:true},{id:'river_reed',label:'River Reed',have:0,need:2,each:6,buyable:true}]},coins:1000,branches:100,level:10,market:{built:true,coins:135,branches:28,level:4},forge:{level:1,required:1,queueFull:false},routes:{academy:true,forge:true},sources:Object.fromEntries(['coins','branches','xp'].map(kind=>[kind,{label:'Earn '+kind,available:true,action:{kind:'errand',id:kind}}])),...overrides});
const plan=f=>{const graph=G.forgePlan(f);return {...graph,...G.resolve(graph,graph.goal)};};
let f=facts(),before=JSON.stringify(f),p=plan(f);assert.equal(JSON.stringify(f),before,'Resolver is read-only');
assert.deepEqual(p.actions.map(a=>a.action.itemId),['oak_twig','river_reed']);assert.equal(p.shortages.length,2,'Every missing ingredient, no unrelated Market construction requirement');
f=facts({market:{built:false,coins:135,branches:28,level:4}});p=plan(f);assert.deepEqual(p.actions.map(a=>a.action.kind),['market-build']);
f=facts({coins:0,branches:0,level:1,market:{built:false,coins:135,branches:28,level:4}});p=plan(f);assert.deepEqual(new Set(p.actions.map(a=>a.action.id)),new Set(['xp','coins','branches']));assert(!p.actions.some(a=>a.action.kind==='market'),'Never directs Market construction funding back into the unbuilt Market');assert.equal(p.issues.length,0);
f=facts({coins:40});p=plan(f);assert.equal(p.actions[0].action.id,'coins','Budget reserves both missing materials and recipe coins (44 total)');assert(!p.actions.some(a=>a.action.kind==='market'));
f=facts();f.recipe.materials[0].have=1;p=plan(f);assert.equal(p.actions.find(a=>a.action.itemId==='oak_twig').action.quantity,1,'Partial purchase re-resolves remaining quantity');
f=facts();f.recipe.materials.forEach(m=>m.have=m.need);p=plan(f);assert.deepEqual(p.actions.map(a=>a.action.kind),['recipe']);assert.equal(p.shortages.length,0);
f=facts();f.recipe.materials[0].buyable=false;p=plan(f);assert(p.issues.some(i=>i.id==='recipe:material:oak_twig'));assert(!p.actions.some(a=>a.action.itemId==='oak_twig'),'Unknown sources never fabricated');
f=facts({sources:{},coins:0});p=plan(f);assert.equal(p.status,'blocked');assert(p.issues.length);assert.equal(p.actions.length,0,'No false ready action when no supply source is available');
f=facts();f.forge={level:1,required:3,upgrade:{coins:150,branches:40,materials:[]}};f.recipe.materials.forEach(m=>m.have=m.need);p=plan(f);assert(p.actions.some(a=>a.action.kind==='forge-upgrade'));assert(!p.actions.some(a=>a.action.kind==='recipe'),'Forge level and trainer level are separate');
f=facts();f.recipe.materials.forEach(m=>m.have=m.need);f.forge.queueFull=true;p=plan(f);assert.deepEqual(p.actions.map(a=>a.action.kind),['forge-queue']);
f=facts();f.routes.academy=false;p=plan(f);assert.equal(p.actions.length,0,'Known destination gate cannot be bypassed');
const cycle={nodes:{a:{requires:['b']},b:{requires:['a']}}};assert(G.resolve(cycle,'a').issues.some(i=>i.reason==='cycle'));assert(G.resolve({nodes:{}},'absent').issues.some(i=>i.reason==='unknown'));
const many={nodes:{root:{requires:Array.from({length:20},(_,i)=>'n'+i)}}};for(let i=0;i<20;i++)many.nodes['n'+i]={satisfied:true};assert(G.resolve(many,'root',{maxNodes:2}).issues.some(i=>i.reason==='limit'));
for(const recipe of L.allRecipes()){
 const item=L.craftableById(recipe.gearId),lv=1,upgrade=L.forgeUpgradeCost(lv);
 const materials=ms=>Object.entries(ms).map(([id,need])=>({id,label:L.materialById(id)?.label||id,have:0,need,buyable:!L.materialById(id)?.craftOnly,each:L.buyQuote('material',L.materialById(id)?.rarity,1e6,1,1).each}));
 f=facts({recipe:{id:item.id,label:item.label,coins:recipe.coins,materials:materials(recipe.materials)},coins:0,branches:0,level:1,market:{built:false,coins:135,branches:28,level:4},forge:{level:lv,required:L.minForgeLevelForRarity(item.rarity),upgrade:{...upgrade,materials:materials(upgrade.materials)}}});
 p=plan(f);assert(!p.issues.length,item.id+': valid graph must not cycle or exhaust traversal');assert(p.actions.length,item.id+': known attainable earning route must surface');
}
console.log('PASS: real catalogue recipes, multiple shortages/budgets, partial purchases, Market/build/level/Forge gates, unavailable sources, bounded cycles and immutable facts');
