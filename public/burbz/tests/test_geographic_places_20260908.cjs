'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../geographic_places_core.js'),network=require('../walking_route_core.js');
const here={lat:53.35,lon:-1.78},at=Date.now();
const node=(id,lat=here.lat,lon=here.lon,tags={})=>({type:'node',id,lat,lon,tags});
const way=(id=10,nodes=[1,2,3],tags={highway:'path'})=>({type:'way',id,nodes,tags});
const validData=()=>({elements:[node(1,here.lat-.001),node(2),node(3,here.lat+.001),way()]});
const parse=(data=validData(),position=here)=>core.parse(data,position,network);
test('places use exact mapped interior-node coordinates and fictional stable identities',()=>{
 const data=validData(),before=JSON.stringify(data),r=parse(data);assert.equal(r.places.length,1);const p=r.places[0];
 assert.equal(p.id,'wayside:node:2');assert.equal(p.lat,here.lat);assert.equal(p.lon,here.lon);assert.equal(p.seed,core.hash(2));assert.ok(['cabin','hut','chapel','storehouse'].includes(p.type));
 assert.deepEqual(parse({elements:[...data.elements].reverse()}),r);assert.deepEqual(parse({elements:[...data.elements,...data.elements]}),r);assert.equal(JSON.stringify(data),before);
 assert.deepEqual(parse(data,{...here,lon:here.lon+.0001}).places,r.places,'nearby player motion cannot change a place identity');
});
test('restricted, conditional, technical, connector, permissive, bridge and tunnel ways are excluded',()=>{
 const overrides=[{access:'private'},{foot:'no'},{'access:conditional':'yes @ (sunrise-sunset)'},{locked:'yes'},{highway:'steps'},{highway:'pedestrian'},{highway:'cycleway',foot:'yes'},{highway:'residential'},{access:'permissive'},{sac_scale:'mountain_hiking'},{construction:'yes'},{ford:'yes'},{bridge:'yes'},{tunnel:'yes'},{indoor:'yes'},{'oneway:foot':'sometimes'}];
 for(const tags of overrides){const d=validData();d.elements.at(-1).tags={highway:'path',...tags};assert.equal(parse(d).places.length,0,JSON.stringify(tags));}
 for(const tags of [{highway:'footway',foot:'designated'},{highway:'bridleway'},{highway:'track',foot:'yes'},{highway:'path',bridge:'no',tunnel:'no'}]){const d=validData();d.elements.at(-1).tags=tags;assert.equal(parse(d).places.length,1);}
});
test('barriers, foot restrictions, missing topology and endpoints cannot invent a stop',()=>{
 for(const tags of [{barrier:'fence'},{barrier:'gate',locked:'yes'},{access:'private'},{ford:'yes'}]){const d=validData();d.elements[0].tags=tags;assert.equal(parse(d).places.length,0);}
 const blocked=validData();blocked.elements.push({type:'relation',id:20,tags:{'restriction:foot':'no_entry'},members:[{type:'way',ref:10}]});assert.equal(parse(blocked).places.length,0);
 const missing=validData();missing.elements.splice(0,1);assert.equal(parse(missing).places.length,0);
 const endpoints=validData();endpoints.elements.at(-1).nodes=[1,3];assert.equal(parse(endpoints).places.length,0);
});
test('incomplete provider responses and invalid locations fail closed',()=>{
 for(const d of [{},{elements:null},{elements:[],remark:'runtime error: timeout'},{elements:Array(25001).fill(node(1))}])assert.throws(()=>parse(d),/completely/);
 for(const p of [{lat:NaN,lon:0},{lat:86,lon:0},{lat:0,lon:181},null])assert.throws(()=>parse(validData(),p),/completely/);
 assert.deepEqual(parse({elements:[]}),{places:[],falls:[]});
});
test('place count, radius and spacing are bounded while duplicate shared nodes pay one identity',()=>{
 const elements=[];for(let i=0;i<80;i++){const lat=here.lat+(Math.floor(i/10)-4)*.002,lon=here.lon+(i%10-5)*.003,id=1000+i*3;elements.push(node(id,lat-.0001,lon),node(id+1,lat,lon),node(id+2,lat+.0001,lon),way(2000+i,[id,id+1,id+2]));}
 const data={elements},r=parse(data);assert.equal(r.places.length,12);assert.equal(new Set(r.places.map(p=>p.id)).size,12);
 for(let i=0;i<r.places.length;i++){assert.ok(core.distance(r.places[i],here)<=1500);for(let j=0;j<i;j++)assert.ok(core.distance(r.places[i],r.places[j])>140);}
 assert.deepEqual(parse({elements:[...elements].reverse()}),r);
});
test('waterfalls require explicit mapped tags and valid node or center geometry',()=>{
 const elements=[node(1,here.lat,here.lon,{waterway:'waterfall'}),{type:'way',id:2,tags:{waterway:'waterfall'},center:{...here}},{type:'relation',id:3,tags:{waterway:'waterfall'},center:{...here}},node(4,here.lat,here.lon,{natural:'water'}),{type:'way',id:5,tags:{waterway:'waterfall'}},node(6,here.lat+.1,here.lon,{waterway:'waterfall'})];
 const r=parse({elements});assert.deepEqual(r.falls.map(p=>p.id),['fall:node:1','fall:way:2','fall:relation:3']);assert.equal(r.places.length,0);assert.ok(r.falls.every(p=>p.lat===here.lat&&p.lon===here.lon));
 assert.equal(parse({elements:Array.from({length:20},(_,i)=>node(i,here.lat,here.lon,{waterway:'waterfall'}))}).falls.length,8);
});
test('repeated waterfall nodes from the path and waterfall query outputs create one cascade each',()=>{
 const a=node(1,here.lat,here.lon,{waterway:'waterfall'}),b=node(2,here.lat+.001,here.lon,{waterway:'waterfall'});
 assert.deepEqual(parse({elements:[a,b,a,b,a]}).falls,parse({elements:[a,b]}).falls);
});
test('a path with an invalid endpoint coordinate cannot establish complete accessible topology',()=>{
 const d=validData();d.elements[0].lat=NaN;assert.equal(parse(d).places.length,0);
});
test('queries retain full walking topology, access restrictions and explicit mapped waterfalls',()=>{
 const q=core.query(here,network);assert.match(q,/node\(w\.paths\)/);assert.match(q,/restriction:foot/);assert.match(q,/nwr\[waterway=waterfall\]/);assert.match(q,/out body center/);assert.match(q,/around:1800,53\.350000,-1\.780000/);
});
test('arrival requires a fresh accurate coordinate fix and physical proximity',()=>{
 const fix={...here,accuracy:10,at};assert.equal(core.arrival(here,fix,at).ready,true);
 for(const bad of [null,{...fix,lat:NaN},{...fix,at:undefined},{...fix,at:at-120001},{...fix,at:at+10001},{...fix,accuracy:51},{...fix,accuracy:-1},{...fix,accuracy:NaN},{...fix,lon:here.lon+.002}])assert.equal(core.arrival(here,bad,at).ready,false,JSON.stringify(bad));
 for(const edge of [{...fix,at:at-120000},{...fix,at:at+10000},{...fix,accuracy:50}])assert.equal(core.arrival(here,edge,at).ready,true);
 assert.equal(core.arrival(here,{...fix,lat:here.lat+44/111195},at).ready,true);assert.equal(core.arrival(here,{...fix,lat:here.lat+46/111195},at).ready,false);
 assert.equal(core.distance(here,here),0);assert.equal(core.distance(null,here),Infinity);assert.ok(core.distance({lat:0,lon:179.999},{lat:0,lon:-179.999})<225);
});

class Events {
 constructor(){this.events=new Map();}
 addEventListener(name,fn,opts={}){this.on(name,fn);opts.signal?.addEventListener('abort',()=>this.off(name,fn),{once:true});}
 on(name,fn){if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);}
 off(name,fn){this.events.get(name)?.delete(fn);}
 async emit(name,event={}){for(const fn of [...(this.events.get(name)||[])])await fn({type:name,preventDefault(){},stopPropagation(){},stopImmediatePropagation(){},...event});}
}
class Element extends Events {
 constructor(doc){super();this.doc=doc;this.hidden=false;this.disabled=false;this.children=[];this.parts={};this.attributes={};}
 set innerHTML(v){this.html=v;for(const selector of ['.gp-close','.gp-enter','h3','.gp-description','.gp-distance'])this.parts[selector]=new Element(this.doc);}
 querySelector(s){return this.parts[s];}setAttribute(k,v){this.attributes[k]=v;}
 append(e){this.children.push(e);e.parent=this;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(e=>e!==this);this.removed=true;}
 focus(){this.doc.activeElement=this;}getClientRects(){return this.hidden?[]:[{}];}
}
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture(config={}){
 const doc=new Events();doc.hidden=false;doc.createElement=()=>new Element(doc);doc.body=new Element(doc);doc.getElementById=()=>null;
 const map=new Events(),container=new Element(doc);Object.assign(map,{getContainer:()=>container,getCanvasContainer:()=>container,getZoom:()=>16,getCenter:()=>({lng:here.lon,lat:here.lat}),getPitch:()=>32,getBearing:()=>-24,isMoving:()=>false,isStyleLoaded:()=>true,getStyle:()=>({layers:[]}),jumpTo:camera=>jumps.push(camera)});
 const pending=deferred(),markers=[],saves=[],opens=[],jumps=[],renderers=[],renders={set:[],disposed:0,refreshes:0};let clock=at,data=config.data||{catalogue:parse().places},position={...here,accuracy:10,at},visible=true,isOpen=false;
 const scene={state:{},set:r=>renders.set.push(r),refresh:()=>renders.refreshes++,dispose:()=>renders.disposed++};
 const walk={isOpen:()=>isOpen,open:opts=>{opens.push(opts);isOpen=true;},close:reason=>{isOpen=false;opens.at(-1)?.resume(reason);}};
 class Clock extends Date{static now(){return clock;}}
 class Renderer{constructor(){this.domElement=new Element(doc);this.disposed=0;this.lost=0;renderers.push(this);}setPixelRatio(){}setSize(){}dispose(){this.disposed++;}forceContextLoss(){this.lost++;}}
 const ctx={document:doc,Date:Clock,devicePixelRatio:2,THREE:{WebGLRenderer:Renderer,Scene:class{},PerspectiveCamera:class{}},AbortController,MutationObserver:class{observe(){}disconnect(){this.disconnected=true;}},BurbzGeographicPlacesCore:{...core,arrival:(p,f)=>core.arrival(p,f,clock)},BurbzWalkingRouteCore:network,BurbzVillageWalk:walk,BurbzGeographicDetailsScene:{create:(map,options)=>{renders.options=options;return scene;}},console};
 vm.runInNewContext(fs.readFileSync(require.resolve('../geographic_places.js'),'utf8'),ctx);
 const options={isVisible:()=>visible,getPosition:()=>position,data:()=>data,save:next=>{saves.push(next);if(config.saveFails)return false;data=next;return true;},fetch:config.fetch||(()=>pending.promise),loadWalk:config.loadWalk||(()=>Promise.resolve()),refreshMap:()=>{},marker:({element})=>{const marker={element,setLngLat(p){this.point=p;return this;},addTo(){markers.push(this);return this;},remove(){this.removed=true;}};return marker;}};
 const api=ctx.BurbzGeographicPlaces.attach(map,options),card=doc.body.children[0];
 return{api,ctx,map,doc,card,options,markers,saves,opens,jumps,renders,renderers,pending,advance:ms=>clock+=ms,select:()=>markers[0].element.emit('click'),enter:()=>card.querySelector('.gp-enter').emit('click'),setPosition:p=>position=p,setVisible:v=>visible=v};
}
test('place controller is idempotent and close cancels delayed entry without opening a room',async()=>{
 const load=deferred(),f=fixture({loadWalk:()=>load.promise});assert.equal(f.ctx.BurbzGeographicPlaces.attach(f.map,f.options),f.api);
 await f.select();assert.equal(f.card.hidden,false);const entering=f.enter();assert.equal(f.card.querySelector('.gp-enter').disabled,true);f.api.close();load.resolve();await entering;assert.equal(f.opens.length,0);assert.equal(f.card.hidden,true);f.api.dispose();assert.equal(f.renders.disposed,1);assert.ok(f.markers.every(m=>m.removed));
});
test('position or navigation changes during dependency loading reject entry',async()=>{
 for(const change of ['position','navigation','dispose']){const load=deferred(),f=fixture({loadWalk:()=>load.promise});await f.select();const entering=f.enter();if(change==='position')f.setPosition({...here,accuracy:10,at,lon:here.lon+.01});else if(change==='navigation')f.setVisible(false);else f.api.dispose();load.resolve();await entering;assert.equal(f.opens.length,0,change);f.api.dispose();}
});
test('late network results after disposal cannot persist or create markers',async()=>{
 const f=fixture();f.api.dispose();const count=f.markers.length;f.pending.resolve(validData());await new Promise(r=>setImmediate(r));assert.equal(f.saves.length,0);assert.equal(f.markers.length,count);assert.equal(f.renders.disposed,1);
});
test('fresh mapped coordinates replace stale cached identities and survive saved reload within the catalogue cap',async()=>{
 const original=parse().places[0],stale={...original,lat:here.lat-.003,lon:here.lon-.004};
 const older=Array.from({length:239},(_,i)=>({...original,id:'wayside:node:'+(1000+i),lat:here.lat+.02+i*.0001}));
 const data={catalogue:[stale,...older],visited:{[original.id]:at-1000}},fresh=validData();
 fresh.elements[1].lat=here.lat+.0003;fresh.elements[1].lon=here.lon+.0002;
 fresh.elements.push(node(9000,here.lat+.001,here.lon,{waterway:'waterfall'}));
 const f=fixture({data,fetch:async()=>fresh});await new Promise(r=>setImmediate(r));
 assert.equal(f.saves.length,1);const saved=JSON.parse(JSON.stringify(f.options.data()));
 assert.equal(saved.catalogue.length,240);assert.equal(new Set(saved.catalogue.map(p=>p.id)).size,240);
 const corrected=saved.catalogue.find(p=>p.id===original.id);
 assert.equal(corrected.lat,fresh.elements[1].lat);assert.equal(corrected.lon,fresh.elements[1].lon);
 assert.ok(saved.catalogue.some(p=>p.id==='fall:node:9000'),'new waterfall retained before old rows reach the cap');
 assert.ok(!saved.catalogue.some(p=>p.id===older.at(-1).id),'oldest tail row yields to fresh provider data');
 assert.equal(saved.visited[original.id],at-1000,'coordinate refresh preserves independent visit history');
 f.api.dispose();const reload=fixture({data:saved});
 assert.equal(reload.saves.length,0,'restoration is checked before a replacement network response');
 const restored=reload.api.state.places.find(p=>p.id===original.id);
 assert.equal(restored.lat,corrected.lat);assert.equal(restored.lon,corrected.lon);
 assert.ok(reload.markers.some(m=>m.point[0]===corrected.lon&&m.point[1]===corrected.lat),'restored marker uses corrected coordinates');
 const model=reload.renders.set.at(-1).find(p=>p.id===original.id);
 assert.equal(model.lat,corrected.lat);assert.equal(model.lon,corrected.lon);reload.api.dispose();
});
test('failed dependency opening keeps its actionable error visible and allows a retry',async()=>{
 let calls=0;const f=fixture({loadWalk:async()=>{calls++;if(calls===1)throw Error('Connection lost; retry opening');}});await f.select();await f.enter();assert.match(f.card.querySelector('.gp-distance').textContent,/Connection lost; retry opening/);assert.equal(f.card.querySelector('.gp-enter').disabled,false);await f.enter();assert.equal(f.opens.length,1);f.api.dispose();
});
test('a failed nearby fetch retries after bounded backoff rather than caching failure for five minutes',async()=>{
 let calls=0;const f=fixture({fetch:async()=>{calls++;if(calls===1)throw Error('Connection lost');return validData();}});await new Promise(r=>setImmediate(r));assert.match(f.api.state.error,/Connection lost/);await f.api.update();assert.equal(calls,1);f.advance(14999);await f.api.update();assert.equal(calls,1);f.advance(1);await f.api.update();assert.equal(calls,2);assert.equal(f.api.state.error,null);assert.equal(f.saves.length,1);f.api.dispose();
});
test('GPS must still be fresh and nearby when lazy walking dependencies request the room renderer',async()=>{
 for(const change of ['distant','stale','poor']){const f=fixture();await f.select();await f.enter();assert.equal(f.opens.length,1);if(change==='distant')f.setPosition({...here,lon:here.lon+.01,accuracy:10,at});else if(change==='poor')f.setPosition({...here,accuracy:51,at});else f.advance(120001);assert.throws(()=>f.opens[0].source(),/GPS|door|position/i);assert.equal(f.renderers.length,0);assert.equal(f.saves.length,0);f.api.dispose();}
});
test('disposal after walking opens but before lazy dependencies finish cannot allocate a room',async()=>{
 const f=fixture();await f.select();await f.enter();assert.equal(f.opens.length,1);f.api.dispose();assert.throws(()=>f.opens[0].source(),/closed|cancel|GPS|door|position|disposed/i);assert.equal(f.renderers.length,0);assert.equal(f.saves.length,0);
});
test('failed visit persistence leaves no visit and room failure exit releases its temporary renderer',async()=>{
 const f=fixture({saveFails:true});await f.select();await f.enter();const visit=f.opens[0];visit.source();assert.equal(f.renderers.length,1);assert.throws(()=>visit.suspend(),/save/);assert.equal(f.api.inside,false);assert.equal(f.options.data().visited,undefined);visit.resume('failure');assert.equal(f.renderers[0].disposed,1);assert.equal(f.renderers[0].lost,1);assert.equal(f.doc.body.children.length,1,'hidden temporary room host removed');f.api.dispose();assert.equal(f.renderers[0].disposed,1);
});
test('successful visit returns to the exact map camera and retains its independent geographic identity',async()=>{
 const f=fixture();await f.select();await f.enter();const visit=f.opens[0];assert.equal(visit.room.scope,'geographic');assert.equal(visit.room.homeId,'wayside:node:2');visit.source();visit.suspend();assert.equal(f.api.inside,true);assert.equal(f.card.hidden,true);assert.equal(f.options.data().visited['wayside:node:2'],at);assert.equal(f.options.data().empire,undefined);visit.resume('exit');assert.equal(f.api.inside,false);assert.equal(f.card.hidden,false);assert.deepEqual(JSON.parse(JSON.stringify(f.jumps[0])),{center:{lng:here.lon,lat:here.lat},zoom:16,pitch:32,bearing:-24});assert.equal(f.renderers[0].disposed,1);f.api.dispose();
});

test('all geographic place, grass and cascade models produce finite stable triangles using settlement geometry',()=>{
 const ctx={console};vm.createContext(ctx);for(const file of ['lib/three.min.js','settlement_models.js','geographic_details_scene.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),ctx);
 for(const type of ['cabin','hut','chapel','storehouse','grass','waterfall']){const data=ctx.BurbzGeographicDetailsScene.geometry(type,1234);assert.ok(data.length>81&&data.length%27===0,type+' triangles');assert.ok(data.length/9<60000,type+' bounded model');assert.ok(data.every(Number.isFinite));assert.deepEqual(Array.from(ctx.BurbzGeographicDetailsScene.geometry(type,1234)),Array.from(data));for(let i=0;i<data.length;i+=9){assert.ok(Math.abs(Math.hypot(data[i+3],data[i+4],data[i+5])-1)<1e-5,type+' normalized normal');for(let j=6;j<9;j++)assert.ok(data[i+j]>=0&&data[i+j]<=1,type+' normalized color');}}
});
test('water/grass layers retain provider geometry and animation pauses for gestures, hidden tabs, reduced motion and disposal',async()=>{
 const doc=new Events();doc.hidden=false;const canvas=new Element(doc),container=new Element(doc),motion=new Events();motion.matches=false;let moving=false,water=true,clock=0,serial=0,updates=0,ready=false;
 const timers=new Map(),sources=new Map(),layers=new Map(),images=new Map(),style=[{id:'land',type:'fill',source:'provider-land','source-layer':'landcover'},{id:'lake',type:'fill',source:'provider-water','source-layer':'water'},{id:'stream',type:'line',source:'provider-river','source-layer':'waterway'}];
 const context2d={beginPath(){},moveTo(){},lineTo(){},stroke(){},fillRect(){},bezierCurveTo(){},getImageData:()=>({data:new Uint8ClampedArray(128*128*4)})};doc.createElement=()=>({getContext:()=>context2d});
 const map=new Events();Object.assign(map,{getContainer:()=>container,getCanvasContainer:()=>canvas,isMoving:()=>moving,isStyleLoaded:()=>ready,getStyle:()=>({layers:style}),getSource:id=>sources.get(id),addSource:(id,s)=>sources.set(id,s),removeSource:id=>sources.delete(id),getLayer:id=>layers.get(id),addLayer:l=>layers.set(l.id,l),removeLayer:id=>layers.delete(id),hasImage:id=>images.has(id),addImage:(id,img)=>images.set(id,img),removeImage:id=>images.delete(id),updateImage:id=>{assert.ok(images.has(id));updates++;},setPaintProperty:(id)=>assert.ok(layers.has(id)),queryRenderedFeatures:()=>water?[{}]:[],triggerRepaint(){}});
 const ctx={document:doc,AbortController,Uint8ClampedArray,matchMedia:()=>motion,setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,due:clock+delay});return id;},clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>{throw Error('surface must not create an RAF loop');}};
 vm.runInNewContext(fs.readFileSync(require.resolve('../geographic_surfaces.js'),'utf8'),ctx);const api=ctx.BurbzGeographicSurfaces.attach(map);assert.equal(ctx.BurbzGeographicSurfaces.attach(map),api);assert.equal(layers.size,0);
 const tick=ms=>{clock+=ms;for(const [id,t]of [...timers])if(t.due<=clock){timers.delete(id);t.fn();}};
 ready=true;await map.emit('idle');await map.emit('idle');assert.equal(layers.size,7);assert.equal(images.size,2);assert.equal(api.state.grassLayers,1);assert.equal(api.state.waterLayers,5);assert.equal(api.state.errors.length,0);
 assert.equal(layers.get('burbz-surface-grass').source,'provider-land');assert.deepEqual(JSON.parse(JSON.stringify(layers.get('burbz-surface-grass').filter)),['==',['get','class'],'grass']);assert.equal(layers.get('burbz-surface-water').source,'provider-water');assert.equal(layers.get('burbz-surface-river').source,'provider-river');assert.equal(timers.size,1);
 tick(400);assert.equal(updates,1);await canvas.emit('pointerdown',{pointerId:1});assert.equal(timers.size,0);tick(1000);assert.equal(updates,1);await doc.emit('pointerup',{pointerId:1});assert.equal(timers.size,1);
 moving=true;await map.emit('movestart');tick(1000);assert.equal(updates,1);moving=false;await map.emit('moveend');tick(400);assert.equal(updates,2);
 doc.hidden=true;await doc.emit('visibilitychange');tick(1000);assert.equal(updates,2);doc.hidden=false;await doc.emit('visibilitychange');motion.matches=true;await motion.emit('change');tick(1000);assert.equal(updates,2);
 motion.matches=false;await motion.emit('change');water=false;await map.emit('moveend');assert.equal(timers.size,0);water=true;await map.emit('moveend');assert.equal(timers.size,1);
 api.dispose();assert.equal(timers.size,0);assert.equal(layers.size,0);assert.equal(images.size,0);assert.equal(sources.size,0);await map.emit('idle');tick(1000);assert.equal(updates,2);assert.ok([...map.events.values()].every(set=>set.size===0));
});

function sceneFixture(){
 const ctx={console,BurbzGeographicMap3D:require('../geographic_map_3d.js'),requestAnimationFrame(){throw Error('map scene must not own a frame loop');}};
 vm.createContext(ctx);for(const file of ['lib/three.min.js','settlement_models.js','geographic_details_scene.js'])vm.runInContext(fs.readFileSync(require.resolve('../'+file),'utf8'),ctx);
 const resources=new Set(),uploads=[],draws=[],queried=[];let serial=0,center={lng:here.lon,lat:here.lat},extent=.001,moving=false,interacting=false,visible=true,terrain=true,ready=true,height=100;
 const allocate=kind=>{const r={kind,id:++serial};resources.add(r);return r;},release=r=>{assert.ok(resources.delete(r),'resource released once');};
 const gl={createShader:()=>allocate('shader'),deleteShader:release,createProgram:()=>allocate('program'),deleteProgram:release,createBuffer:()=>allocate('buffer'),deleteBuffer:release,createVertexArray:()=>allocate('vao'),deleteVertexArray:release,getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:()=>({}),bufferData:(target,data)=>uploads.push(Array.from(data)),drawArrays:(mode,start,count)=>draws.push(count)};
 for(const name of ['shaderSource','compileShader','attachShader','linkProgram','bindVertexArray','bindBuffer','enableVertexAttribArray','vertexAttribPointer','useProgram','uniformMatrix4fv','enable','depthFunc','depthMask','disable','cullFace','uniform1f'])gl[name]=()=>{};
 const layers=new Map(),map=new Events();Object.assign(map,{getCenter:()=>center,getZoom:()=>16,getBounds:()=>({getWest:()=>center.lng-extent,getEast:()=>center.lng+extent,getSouth:()=>center.lat-extent,getNorth:()=>center.lat+extent}),getTerrain:()=>terrain?{}:null,isSourceLoaded:()=>ready,queryTerrainElevation:point=>{queried.push(point);return height;},isMoving:()=>moving,isStyleLoaded:()=>true,getLayer:id=>layers.get(id),addLayer:l=>{assert.ok(!layers.has(l.id));layers.set(l.id,l);l.onAdd(map,gl);},removeLayer:id=>{const l=layers.get(id);layers.delete(id);l.onRemove(map,gl);},triggerRepaint(){}});
 const api=ctx.BurbzGeographicDetailsScene.create(map,{visible:()=>visible,interacting:()=>interacting});
 return{api,map,gl,resources,uploads,draws,queried,geometry:ctx.BurbzGeographicDetailsScene.geometry,layer:()=>layers.get('burbz-geographic-details'),view:(lng,lat=here.lat)=>center={lng,lat},moving:v=>moving=v,interacting:v=>interacting=v,visible:v=>visible=v,dem:(loaded,elevation=height)=>{ready=loaded;height=elevation;},terrain:v=>terrain=v};
}
const sceneRecord=(id,lon=here.lon,lat=here.lat,type='hut')=>({id,lon,lat,type,seed:1234});
test('scene excludes distant model vertices and DEM queries while retaining the approach margin',()=>{
 const f=sceneFixture(),inside=sceneRecord('inside'),margin=sceneRecord('margin',here.lon,here.lat+.0014,'waterfall');
 f.api.set([inside,margin,sceneRecord('north',here.lon,here.lat+.0016),sceneRecord('east',here.lon+.003,here.lat,'grass')]);
 assert.equal(f.api.state.objects,2);assert.deepEqual(Array.from(f.layer().anchors,a=>a.id),['inside','margin']);assert.equal(f.queried.length,2);
 assert.equal(f.uploads.at(-1).length/9,f.geometry('hut',1234).length/9+f.geometry('waterfall',1234).length/9);
 assert.ok(f.uploads.at(-1).every(Number.isFinite));f.api.dispose();assert.equal(f.resources.size,0);
});
test('scene culling retains nearby coordinates across the antimeridian world copy',()=>{
 const f=sceneFixture();f.view(180);f.api.set([sceneRecord('wrapped',-179.9995),sceneRecord('far',-179.99)]);
 assert.equal(f.api.state.objects,1);assert.equal(f.layer().anchors[0].id,'wrapped');
 const data=f.uploads.at(-1);for(let i=0;i<data.length;i+=9)assert.ok(Math.abs(data[i])<100,'wrapped local vertices stay near the camera');f.api.dispose();
});
test('actual view movement rebuilds culled models on idle and stationary idle performs no extra uploads',async()=>{
 const f=sceneFixture();f.api.set([sceneRecord('first'),sceneRecord('second',here.lon+.01)]);assert.equal(f.layer().anchors[0].id,'first');const count=f.uploads.length;
 f.view(here.lon+.01);f.moving(true);await f.map.emit('moveend');await f.map.emit('idle');assert.equal(f.uploads.length,count,'movement defers geometry work');
 f.moving(false);await f.map.emit('idle');assert.equal(f.uploads.length,count+1);assert.equal(f.layer().anchors[0].id,'second');await f.map.emit('idle');assert.equal(f.uploads.length,count+1);
 f.visible(false);f.view(here.lon);await f.map.emit('moveend');await f.map.emit('idle');assert.equal(f.uploads.length,count+1,'hidden map defers rebuild');f.visible(true);await f.map.emit('idle');assert.equal(f.layer().anchors[0].id,'first');f.api.dispose();
});
test('scene waits for verified DEM heights, retains them through reload and updates when elevation is ready',async()=>{
 const f=sceneFixture();f.dem(false,0);f.api.set([sceneRecord('known')]);assert.equal(f.api.state.objects,0);assert.equal(f.queried.length,0,'unloaded DEM zero sentinel is never sampled');
 f.dem(true,123.5);await f.map.emit('sourcedata',{sourceId:'burbz-geographic-dem'});await f.map.emit('idle');assert.equal(f.layer().anchors[0].elevation,123.5);const verified=f.uploads.at(-1);
 f.dem(false,0);f.api.set([sceneRecord('known'),sceneRecord('unknown',here.lon+.0001)]);assert.equal(f.api.state.objects,1);assert.equal(f.layer().anchors[0].elevation,123.5);assert.deepEqual(f.uploads.at(-1),verified);assert.equal(f.queried.length,1);
 f.dem(true,null);await f.map.emit('sourcedata',{sourceId:'burbz-geographic-dem'});await f.map.emit('idle');assert.equal(f.api.state.objects,1,'null query retains only previously verified records');
 f.dem(true,140);await f.map.emit('sourcedata',{sourceId:'burbz-geographic-dem'});await f.map.emit('idle');assert.equal(f.api.state.objects,2);assert.ok(f.layer().anchors.every(a=>a.elevation===140));
 f.terrain(false);await f.map.emit('terrain');await f.map.emit('idle');assert.ok(f.layer().anchors.every(a=>a.elevation===0),'flat fallback ignores cached terrain heights');f.api.dispose();
});
test('scene restoration recreates GPU resources and disposal removes listeners and prevents later uploads',async()=>{
 const f=sceneFixture();f.api.set([sceneRecord('visible')]);assert.equal(f.resources.size,3);const original=f.layer().program;
 const identity={defaultProjectionData:{mainMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};
 f.layer().render(f.gl,identity);assert.equal(f.draws.length,2);f.visible(false);f.layer().render(f.gl,identity);assert.equal(f.draws.length,2);f.visible(true);
 await f.map.emit('webglcontextrestored');assert.equal(f.resources.size,3);assert.notEqual(f.layer().program,original);assert.equal(f.api.state.objects,1);
 const count=f.uploads.length;f.api.dispose();assert.equal(f.resources.size,0);assert.equal(f.layer(),undefined);assert.ok([...f.map.events.values()].every(s=>s.size===0));
 await f.map.emit('idle');await f.map.emit('webglcontextrestored');f.api.set([sceneRecord('late')]);assert.equal(f.uploads.length,count);f.api.dispose();assert.equal(f.resources.size,0);
});
test('held pointers block meadow rebuilding with isMoving false and final release resumes pending work once',async()=>{
 const f=fixture(),canvas=f.map.getCanvasContainer();let samples=0,longitude=here.lon;
 f.ctx.BurbzGeographicForestCore={placeTrees:()=>{samples++;return{trees:[]};}};
 f.map.getStyle=()=>({layers:[{source:'land','source-layer':'landcover'}]});f.map.querySourceFeatures=()=>[];
 f.map.getCenter=()=>({lng:longitude,lat:here.lat});f.map.getBounds=()=>({getWest:()=>longitude-.001,getEast:()=>longitude+.001,getSouth:()=>here.lat-.001,getNorth:()=>here.lat+.001});
 await f.map.emit('idle');assert.equal(samples,1);assert.equal(f.map.isMoving(),false);
 await canvas.emit('pointerdown',{pointerId:1});await canvas.emit('pointerdown',{pointerId:2});assert.equal(f.renders.options.interacting(),true);
 const refreshes=f.renders.refreshes,sets=f.renders.set.length;
 for(let i=0;i<5;i++){longitude+=.0001;await f.map.emit('moveend');await f.map.emit('idle');}
 assert.equal(samples,1,'held setBearing-like events cannot rerun meadow placement');assert.equal(f.renders.set.length,sets);
 await f.doc.emit('pointerup',{pointerId:1});assert.equal(f.renders.options.interacting(),true);assert.equal(samples,1);assert.equal(f.renders.refreshes,refreshes);
 await f.doc.emit('pointercancel',{pointerId:2});assert.equal(f.renders.options.interacting(),false);assert.equal(samples,2);assert.equal(f.renders.refreshes,refreshes+1);
 await f.map.emit('idle');assert.equal(samples,2);f.api.dispose();const disposedRefreshes=f.renders.refreshes;
 await canvas.emit('pointerdown',{pointerId:3});await f.doc.emit('pointerup',{pointerId:3});assert.equal(f.renders.refreshes,disposedRefreshes,'aborted pointer handlers cannot revive scene work');
});
test('scene retains drawable geometry during a held pointer and uploads the final pending view once on release',async()=>{
 const f=sceneFixture(),records=[sceneRecord('first'),sceneRecord('second',here.lon+.01)];f.api.set(records);const uploads=f.uploads.length;
 const projection={defaultProjectionData:{mainMatrix:[1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1]}};
 f.interacting(true);assert.equal(f.map.isMoving(),false);
 for(let i=1;i<=5;i++){f.view(here.lon+.002*i);await f.map.emit('moveend');await f.map.emit('idle');f.api.set(records);}
 assert.equal(f.uploads.length,uploads);assert.equal(f.layer().anchors[0].id,'first');
 f.layer().render(f.gl,projection);assert.equal(f.draws.length,2,'last geometry remains renderable throughout the hold');
 f.interacting(false);f.api.refresh();assert.equal(f.uploads.length,uploads+1);assert.equal(f.layer().anchors[0].id,'second');
 await f.map.emit('idle');f.api.refresh();assert.equal(f.uploads.length,uploads+1);f.api.dispose();
});
