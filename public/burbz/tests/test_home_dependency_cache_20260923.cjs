'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),source=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const origin='https://game.example/burbz/';
const deps=['building_rooms_core.js?v=tavern-hall-open-v450-20260923','building_rooms_scene.js?v=village-hall-desk-v441-20260922','village_walk_core.js?v=alderwing-followups-v417-20260914'];
function harness({cached=true,network='hang',cacheFailure=false}={}){
 const handlers={},calls=[],stores=new Map();
 const self={location:new URL(origin+'sw.js'),BurbzGeographicCache:{respond:()=>false},addEventListener:(name,fn)=>handlers[name]=fn};
 const context={self,URL,Response,Headers,Request,console,setTimeout,clearTimeout,importScripts:()=>{},fetch:req=>{calls.push(typeof req==='string'?req:req.url);return network==='hang'?new Promise(()=>{}):Promise.resolve(new Response('network'));}};
 for(const k of ['BURBZ_UK_BIRD_EXPANSION_50','BURBZ_UK_BIRD_EXPANSION_26','BURBZ_AU_BIRD_EXPANSION','BURBZ_UK_BIRD_EXPANSION_FINAL','BURBZ_AU_BIRD_EXPANSION_50'])self[k]={art:{}};
 context.caches={keys:async()=>[...stores.keys()],open:async name=>{
  // Simulate cache reads failing without failing unrelated network cache writes.
  if(!stores.has(name))stores.set(name,new Map());const store=stores.get(name);
  return {match:async(req,options)=>{if(cacheFailure)throw Error('cache unavailable');const url=new URL(typeof req==='string'?req:req.url,origin).href;if(options?.ignoreSearch){const item=[...store].find(([key])=>key.split('?')[0]===url.split('?')[0]);return item?.[1].clone();}return store.get(url)?.clone();},put:async(req,response)=>store.set(new URL(typeof req==='string'?req:req.url,origin).href,response.clone())};
 }};
 vm.createContext(context);vm.runInContext(source,context);const cacheName=vm.runInContext('BURBZ_CACHE',context);
 if(cached)stores.set(cacheName,new Map(deps.map(d=>[origin+d,new Response('current '+d)])));
 return {calls,stores,cacheName,async dispatch(rel){let response;handlers.fetch({request:new Request(new URL(rel,origin)),respondWith:p=>response=p,waitUntil:()=>{}});return response;}};
}
async function bounded(p){let t;try{return await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error('Cached Home dependency is blocked on the network')),200);})]);}finally{clearTimeout(t);}}
(async()=>{
 for(const dep of deps){const h=harness();const r=await bounded(h.dispatch(dep));assert.equal(await r.text(),'current '+dep);assert.deepEqual(h.calls,[]);}
 console.log('PASS exact current cached dependencies bypass hung network');
 for(const rel of ['building_rooms_core.js?v=wrong','building_rooms_core.js','index.html','player_home.js?v=other','https://other.example/building_rooms_core.js?v=village-hall-desk-v441-20260922']){const h=harness({network:'ok'});assert.equal(await(await h.dispatch(rel)).text(),'network');assert.equal(h.calls.length,1);}
 console.log('PASS nonmatching versions, unversioned files, navigation assets and foreign origins retain network path');
 for(const opts of [{cached:false,network:'ok'},{cached:true,network:'ok',cacheFailure:true}]){const h=harness(opts);assert.equal(await(await h.dispatch(deps[0])).text(),'network');}
 console.log('PASS absent or unavailable cache still uses network');
 const h=harness({cached:false,network:'ok'});h.stores.set('burbz-old',new Map([[origin+deps[0],new Response('old')]]));assert.equal(await(await h.dispatch(deps[0])).text(),'network');
 console.log('PASS old cache is not preferred over network');
 const home=fs.readFileSync(path.join(root,'player_home.js'),'utf8');assert(home.includes("['village_walk_core.js','BurbzVillageWalkCore','alderwing-followups-v417-20260914']"));
 console.log('PASS Home walking dependency uses installed canonical URL');
})().catch(e=>{console.error(e);process.exitCode=1;});
