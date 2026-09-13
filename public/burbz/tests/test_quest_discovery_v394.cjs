'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
global.window=global;const R=require('../walking_route_core.js');require('../quest_core.js');const Q=global.BurbzQuestCore;
const p=(n,e)=>({lat:53+n/111320,lon:-2+e/(111320*Math.cos(53*Math.PI/180))});
const data={elements:[{type:'way',id:1,nodes:[1,2,3,4,1],geometry:[p(0,0),p(0,500),p(500,500),p(500,0),p(0,0)],tags:{highway:'footway',foot:'yes',designation:'public_footpath'}}]};
const good=()=>({ok:true,json:async()=>data});
const options=fetchFn=>({endpoints:['primary','secondary'],timeoutMs:100,fetchFn});
test('HTTP 200 partial/error graphs retry the next provider, never become route evidence',async()=>{
 for(const bad of [{elements:[],remark:'runtime error: Query ran out of memory'}, {},{elements:null}]){
  const calls=[];const offers=await Q.fetchTrailOffers(53,-2,options(async url=>{calls.push(url);return url==='primary'?{ok:true,json:async()=>bad}:good();}));
  assert.deepEqual(calls,['primary','secondary']);assert(offers.length);assert(offers.every(o=>R.validateOffer(o).valid));
 }
});
test('HTTP rejection, invalid JSON and a network error retry complete data',async()=>{
 for(const bad of [()=>({ok:false,status:504}),()=>({ok:true,json:async()=>{throw Error('Invalid JSON');}}),()=>{throw Error('Network disconnected');}]){
  const calls=[];const offers=await Q.fetchTrailOffers(53,-2,options(async url=>{calls.push(url);return url==='primary'?bad():good();}));assert(offers.length);assert.equal(calls.length,2);
 }
});
test('deadline covers a hung response body and rejects late primary results',async()=>{
 let late;const calls=[];const offers=await Q.fetchTrailOffers(53,-2,{...options(async url=>{calls.push(url);return url==='primary'?{ok:true,json:()=>new Promise(resolve=>late=resolve)}:good();}),timeoutMs:15});
 assert(offers.length);const before=JSON.stringify(offers);late({elements:[]});await Promise.resolve();assert.equal(JSON.stringify(offers),before);assert.deepEqual(calls,['primary','secondary']);
});
test('all providers failing rejects instead of pretending there are no nearby walks',async()=>{
 await assert.rejects(Q.fetchTrailOffers(53,-2,options(async()=>({ok:true,json:async()=>({elements:[],remark:'timeout'})}))),/Mapped paths/);
});
test('a genuinely complete empty map returns the established honest no-route result',async()=>{
 let calls=0;const offers=await Q.fetchTrailOffers(53,-2,options(async()=>{calls++;return {ok:true,json:async()=>({elements:[]})};}));assert.equal(offers.length,0);assert.equal(calls,1);assert.equal(offers.diagnostics.status,'no-walkable-data');
});
