'use strict';
// Execute the actual renderer with a deterministic clock, DOM and WebGL2 double.
// Geometry and lifecycle are exercised here; pixels and GPU speed require browser QA.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '..', 'geographic_map_3d.js'), 'utf8');
const IDENTITY = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
const FOREST = 'burbz-geographic-forest';
const DEM = 'burbz-geographic-dem';
const clone = x => JSON.parse(JSON.stringify(x));
function deepFreeze(x) { if (x && typeof x === 'object') { Object.freeze(x); Object.values(x).forEach(deepFreeze); } return x; }
class Events {
  constructor() { this.events = new Map(); }
  on(name, fn) { if (!this.events.has(name)) this.events.set(name, new Set()); this.events.get(name).add(fn); return this; }
  off(name, fn) { this.events.get(name)?.delete(fn); return this; }
  emit(name, arg={}) { for (const fn of [...(this.events.get(name) || [])]) fn(arg); }
  addEventListener(name, fn) { this.on(name, fn); }
  removeEventListener(name, fn) { this.off(name, fn); }
  listenerCount() { return [...this.events.values()].reduce((n, list) => n + list.size, 0); }
}
class Element extends Events {
  constructor() { super(); this.children=[];this.attributes={};this.style={};this.dataset={};this.isConnected=true;this.textContent='';this.parentElement=null;this.width=390;this.height=700; }
  set innerHTML(value) { this.html=value;this.button=new Element();this.status=new Element();this.span=new Element();this.button.span=this.span; }
  get innerHTML() { return this.html || ''; }
  querySelector(selector) { return selector==='button'?this.button:selector==='span'?this.span:this.status; }
  setAttribute(name, value) { this.attributes[name]=value; }
  appendChild(child) { this.children.push(child);child.parentElement=this;return child; }
  remove() { this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(x=>x!==this); }
  getClientRects() { return this.isConnected && !this.cssHidden ? [this.getBoundingClientRect()] : []; }
  getBoundingClientRect() { return {left:0,top:0,right:this.width,bottom:this.height,width:this.width,height:this.height}; }
  closest() { return this.screen || null; }
}
function fakeGL(options={}) {
  let serial=0; const gl={live:new Set(), draws:[], matrices:[], uploads:[],shaderChecks:0};
  ['VERTEX_SHADER','FRAGMENT_SHADER','COMPILE_STATUS','LINK_STATUS','ARRAY_BUFFER','STATIC_DRAW','DYNAMIC_DRAW','FLOAT','DEPTH_TEST','LEQUAL','BLEND','CULL_FACE','FRONT','BACK','TRIANGLES'].forEach((k,i)=>gl[k]=i+1);
  for (const type of ['Shader','Program','VertexArray','Buffer']) {
    gl['create'+type]=()=>{const h={type,id:++serial};gl.live.add(h);return h;};
    gl['delete'+type]=h=>gl.live.delete(h);
  }
  for (const name of ['shaderSource','compileShader','attachShader','linkProgram','bindVertexArray','enableVertexAttribArray','vertexAttribPointer','vertexAttribDivisor','useProgram','enable','depthFunc','depthMask','disable','cullFace','uniform1f'])gl[name]=()=>{};
  gl.bindBuffer=(type,buffer)=>{gl.boundBuffer=buffer;};
  gl.bufferData=(target,data,usage)=>{gl.uploads.push({buffer:gl.boundBuffer,usage,data:typeof data==='number'?data:Array.from(data)});};
  gl.getShaderParameter=()=>++gl.shaderChecks!==options.failShader;
  gl.getShaderInfoLog=()=> 'injected shader failure';
  gl.getProgramParameter=()=>!options.failLink;
  gl.getProgramInfoLog=()=> 'injected program failure';
  gl.getUniformLocation=(program,name)=>({program,name});
  gl.uniformMatrix4fv=(location,transpose,matrix)=>gl.matrices.push(Array.from(matrix));
  gl.drawArraysInstanced=(mode,start,vertices,count)=>gl.draws.push({mode,start,vertices,count});
  return gl;
}
function fixture(options={}) {
  let time=1, sequence=0;
  const timers=new Map();const observers=[],workers=[];let workerAttempts=0;
  const doc=new Events();doc.hidden=!!options.hidden;doc.createElement=()=>new Element();
  const parent=new Element(),container=new Element(),canvas=new Element();parent.appendChild(container);container.appendChild(canvas);container.screen=new Element();
  const gl=fakeGL(options.gl);
  const map=new Events();map.sources=new Map();map.layers=new Map();map.calls=[];map.queries=[];
  map.zoom=15;map.center={lng:-1.78,lat:53.35};map.moving=false;map.styleLoaded=options.styleLoaded!==false;map.demLoaded=options.demLoaded!==false;map.elevation=options.elevation??320;
  const styleLayers=[{id:'real-woodland',type:'fill',source:'actual-vector-id','source-layer':'landcover'},{id:'real-roads',type:'line',source:'actual-vector-id','source-layer':'transportation'}];
  map.getContainer=()=>container;map.getCanvasContainer=()=>canvas;map.getCenter=()=>({...map.center});map.getZoom=()=>map.zoom;
  map.getBounds=()=>({getWest:()=>-1.79,getSouth:()=>53.34,getEast:()=>-1.77,getNorth:()=>53.36});
  map.getStyle=()=>({sources:{'actual-vector-id':{type:'vector'}},layers:[...styleLayers,...map.layers.values()]});
  map.getSource=id=>map.sources.get(id);map.getLayer=id=>map.layers.get(id);
  map.addSource=(id,data)=>{assert.ok(!map.sources.has(id),'duplicate source');map.sources.set(id,data);map.calls.push(['addSource',id]);};
  map.addLayer=(layer,before)=>{assert.ok(!map.layers.has(layer.id),'duplicate layer');map.layers.set(layer.id,layer);map.calls.push(['addLayer',layer.id,before]);layer.onAdd?.(map,gl);};
  map.removeLayer=id=>{map.layers.get(id)?.onRemove?.(map,gl);map.layers.delete(id);map.calls.push(['removeLayer',id]);};
  map.removeSource=id=>{map.sources.delete(id);map.calls.push(['removeSource',id]);};
  let terrainFailures=Number(options.terrainFailures)||0;
  map.setTerrain=value=>{map.calls.push(['setTerrain',clone(value)]);if(value&&terrainFailures-->0)throw Error(options.terrainError||'Style is not done loading');map.terrain=value;};
  map.getTerrain=()=>map.terrain;
  map.setLayoutProperty=(...args)=>map.calls.push(['layout',...args]);
  map.setPixelRatio=value=>{map.calls.push(['pixelRatio',value]);if(options.resizeOnPixelRatio)map.emit('resize');};
  map.triggerRepaint=()=>map.calls.push(['repaint']);
  map.isStyleLoaded=()=>map.styleLoaded;map.isSourceLoaded=()=>map.demLoaded;map.areTilesLoaded=()=>map.demLoaded;
  map.isMoving=()=>map.moving;map.queryTerrainElevation=()=>map.elevation;
  map.querySourceFeatures=(id,query)=>{map.queries.push({id,query:clone(query)});return query.sourceLayer==='landcover'?(options.features||[]):(options.roads||[]);};
  map.setCenter=map.flyTo=map.easeTo=map.fitBounds=()=>{throw new Error('renderer must not own GPS/camera');};
  const placements=[],viewChanges=[];
  const trees=options.trees||[{id:'oak-a',longitude:-1.7801,latitude:53.3501,variant:0,size:1},{id:'fir-b',longitude:-1.7799,latitude:53.3499,variant:1,size:.9}];
  const core={timber:(features,view)=>require('../geographic_forest_core.js').timber(features,view),placeTrees:(features,view,settings)=>{placements.push({features:clone(features),view:clone(view),settings:clone(settings)});return options.useActualCore?require('../geographic_forest_core.js').placeTrees(features,view,settings):{trees,diagnostics:{sampled:trees.length}};}};
  class FakeWorker {
    constructor(url) { workerAttempts++;if(options.workerConstructorThrows)throw Error('Worker blocked by policy');this.url=url;this.messages=[];this.terminated=0;workers.push(this); }
    postMessage(message) { if(options.workerPostThrows||this.postFailure)throw Error('DataCloneError: cannot post placement');this.messages.push(clone(message)); }
    terminate() { this.terminated++; }
    // A browser callback already queued before termination may still be invoked.
    reply(id,result={trees,diagnostics:{sampled:trees.length}}) { this.onmessage?.({data:{id,result}}); }
    reject(id,error='Placement failed') { this.onmessage?.({data:{id,error}}); }
    fail() { this.onerror?.({message:'Worker script failed'}); }
  }
  class Observer { constructor(fn){this.fn=fn;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;} }
  const ctx={console,document:doc,performance:{now:()=>time},devicePixelRatio:2,BurbzGeographicForestCore:core,IntersectionObserver:Observer,MutationObserver:Observer,
    setTimeout:(fn,delay)=>{const id=++sequence;timers.set(id,{fn,due:time+(Number(delay)||0)});return id;},
    clearTimeout:id=>timers.delete(id),requestAnimationFrame:()=>{throw new Error('static woodland must not schedule RAF');}};
  if(options.worker)ctx.Worker=FakeWorker;
  vm.createContext(ctx);vm.runInContext(source,ctx,{filename:'geographic_map_3d.js'});
  const api=ctx.BurbzGeographicMap3D;
  const attach=(extra={})=>api.attach(map,{document:doc,getRoutes:()=>options.routes||[],isVisible:()=>!container.cssHidden,onViewChange:enabled=>viewChanges.push(enabled),...extra});
  function wireActualRotate(){
    // Run the shipped pointer handler, with MapLibre jumpTo's synchronous move
    // events: setBearing does not leave isMoving true for the later render.
    const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
    const start=html.indexOf('function wireMapRotateOnly()');assert.ok(start>=0);
    const handler=html.slice(start,html.indexOf('\nfunction wireMapMoveTracking()',start));
    map.dragPan=map.doubleClickZoom=map.keyboard={disable(){}};map.bearing=0;map.getBearing=()=>map.bearing;
    map.setBearing=value=>{map.bearing=value;for(const event of ['movestart','move','rotatestart','rotate','rotateend','moveend'])map.emit(event);};
    ctx.liveMap=map;ctx.questMapInspectionMode=()=>false;ctx.applyPlayerHeading=()=>{};
    vm.runInContext(handler+'\nwireMapRotateOnly();',ctx);
  }
  function tick(ms=200) { const target=time+ms;let jobs=0;while(true){const next=[...timers].filter(([,v])=>v.due<=target).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;assert.ok(++jobs<50,'unbounded self-scheduling');time=next[1].due;timers.delete(next[0]);next[1].fn();}time=target; }
  return {api,attach,map,gl,doc,parent,container,canvas,placements,trees,timers,observers,workers,viewChanges,wireActualRotate,get workerAttempts(){return workerAttempts;},tick,advance:ms=>{time+=ms;},setTime:value=>{time=value;}};
}

// The numeric helpers are also used by the actual GPU upload path below.
test('Mercator maps known positions and clamps polar input to finite values',()=>{
  const {api}=fixture();const origin=api.mercator(0,0);assert.ok(Math.abs(origin[0]-.5)<1e-12);assert.ok(Math.abs(origin[1]-.5)<1e-12);
  const north=api.mercator(0,60),east=api.mercator(10,0);assert.ok(north[1]<origin[1]);assert.ok(east[0]>origin[0]);
  for(const lat of [-90,90])assert.ok(api.mercator(180,lat).every(Number.isFinite));
});
test('local matrix composes east/north/up metres without losing its world origin',()=>{
  const {api}=fixture();const matrix=[2,0,0,0,0,3,0,0,0,0,4,0,7,11,13,1];
  const actual=api.localMatrix(matrix,[.4,.6],.01);
  const input=[10,20,30,1],result=[0,0,0,0];
  for(let r=0;r<4;r++)for(let c=0;c<4;c++)result[r]+=actual[c*4+r]*input[c];
  const expected=[8,12.2,14.2,1];expected.forEach((x,i)=>assert.ok(Math.abs(result[i]-x)<1e-5));
});
test('tree geometry is finite triangles with unit normals and normalized colors',()=>{
  const {api}=fixture();for(const kind of [0,1]){const geometry=api.treeGeometry(kind);assert.ok(geometry.length>0&&geometry.length%27===0);assert.ok(geometry.every(Number.isFinite));
    for(let i=0;i<geometry.length;i+=9){const n=Math.hypot(...geometry.slice(i+3,i+6));assert.ok(Math.abs(n-1)<1e-5,'degenerate triangle has zero normal');for(const c of geometry.slice(i+6,i+9))assert.ok(c>=0&&c<=1);}
  }
});
test('phone pixel budget and quality tiers limit device DPR',()=>{
  const {api}=fixture();assert.equal(api.pixelRatio(390,700,3,0),1);const hi=api.pixelRatio(390,700,3,3);assert.ok(hi<=2&&390*700*hi*hi<=1400000);assert.equal(api.pixelRatio(390,700,1,3),1);
});
test('synchronous resize from setPixelRatio cannot recurse or blank installation',()=>{
  const f=fixture({resizeOnPixelRatio:true}),c=f.attach();f.tick();assert.equal(f.map.calls.filter(x=>x[0]==='pixelRatio').length,1);assert.equal(c.state.errors.length,0);assert.ok(c.state.trees>0);assert.equal(c.state.webgl,'instanced');c.dispose();
});
test('quality requires enough samples and downshifts sustained ordinary jank',()=>{
  const {api}=fixture();assert.equal(api.qualityStep(3,Array(47).fill(30)).tier,3);assert.equal(api.qualityStep(3,Array(60).fill(30)).tier,2);assert.equal(api.qualityStep(0,Array(60).fill(30)).tier,0);assert.equal(api.qualityStep(2,Array(60).fill(16)).tier,2);
});
test('quality does not discard every severe active-frame stall',()=>{
  const {api}=fixture();const result=api.qualityStep(3,Array(60).fill(120));assert.equal(result.tier,2);assert.equal(result.p90,120);
});
test('attach is idempotent and allocates one control and forest layer',()=>{
  const f=fixture(),a=f.attach(),b=f.attach();assert.equal(a,b);assert.equal(f.parent.children.length,2);assert.equal([...f.map.layers.keys()].filter(x=>x===FOREST).length,1);assert.equal(f.timers.size,1);assert.equal(f.api.attach(null),null);const shade=[...f.map.layers.values()].find(x=>x.type==='hillshade');assert.notEqual(shade?.source,f.map.getTerrain().source,'hillshade and terrain require separate DEM source instances');a.dispose();
});
test('style deferred attach installs only after style load and can rebuild a replaced style',()=>{
  const f=fixture({styleLoaded:false}),c=f.attach();assert.equal(f.map.sources.size,0);f.map.styleLoaded=true;f.map.emit('style.load');f.tick();const first=f.map.getLayer(FOREST);assert.ok(first);
  for(const id of [...f.map.layers.keys()])f.map.removeLayer(id);f.map.sources.clear();f.map.terrain=null;f.map.emit('style.load');f.tick();assert.ok(f.map.getLayer(FOREST));assert.notEqual(f.map.getLayer(FOREST),first);assert.equal(f.map.getTerrain()?.source,DEM,'replacement style must reactivate terrain as well as recreating its source');assert.equal(f.parent.children.length,2);c.dispose();assert.equal(f.gl.live.size,0);
});
test('attach after the initial style.load installs at idle exactly once, then removes the recovery listener',()=>{
  const f=fixture({styleLoaded:false});f.map.emit('style.load');const c=f.attach();
  f.map.emit('idle');f.tick();assert.equal(f.map.getLayer(FOREST),undefined,'dirty style waits');
  f.map.styleLoaded=true;f.map.emit('idle');f.tick();assert.ok(f.map.getLayer(FOREST));assert.equal(c.state.terrainActive,true);assert.ok(c.state.trees>0);
  const sourceCount=f.map.calls.filter(x=>x[0]==='addSource').length,layerCount=f.map.calls.filter(x=>x[0]==='addLayer').length;
  for(let i=0;i<20;i++)f.map.emit('idle');f.tick();
  assert.equal(f.map.calls.filter(x=>x[0]==='addSource').length,sourceCount);assert.equal(f.map.calls.filter(x=>x[0]==='addLayer').length,layerCount);
  assert.equal(f.parent.children.length,2);c.dispose();const calls=f.map.calls.length;f.map.emit('idle');f.tick();assert.equal(f.map.calls.length,calls);assert.equal(f.gl.live.size,0);
});
test('worker timber follows the fixed player view and discards stale or hidden completions',()=>{
  const f=fixture({worker:true}),supplies=[],timberView={bounds:[-1.79,53.34,-1.77,53.36],center:[-1.78,53.35]};
  const c=f.attach({getTimberView:()=>timberView,onTimber:items=>supplies.push(clone(items))});f.tick();const w=f.workers[0],first=w.messages[0];assert.deepEqual(first.timberView,timberView);
  c.refresh();f.tick();w.reply(first.id,{trees:f.trees,diagnostics:{},timber:[{key:'stale'}]});assert.equal(supplies.length,0);
  const next=w.messages[1];w.reply(next.id,{trees:f.trees,diagnostics:{},timber:[{key:'current'}]});assert.deepEqual(supplies,[[{key:'current'}]]);
  c.refresh();f.tick();const pending=w.messages[2];f.doc.hidden=true;f.doc.emit('visibilitychange');w.reply(pending.id,{trees:f.trees,diagnostics:{},timber:[{key:'hidden'}]});assert.equal(supplies.length,1);c.dispose();
});
test('blocked workers still supply fixed timber in 2D without drawing a hidden forest',()=>{
  const features=[{properties:{class:'wood'},geometry:{type:'Polygon',coordinates:[[[-1.79,53.34],[-1.77,53.34],[-1.77,53.36],[-1.79,53.36],[-1.79,53.34]]]}}];
  const timberView={bounds:[-1.79,53.34,-1.77,53.36],center:[-1.78,53.35]},supplies=[];
  const f=fixture({worker:true,workerConstructorThrows:true,features}),c=f.attach({getTimberView:()=>timberView,onTimber:items=>supplies.push(clone(items))});f.tick();assert.ok(supplies[0].length>10);
  const before=supplies[0];c.setEnabled(false);f.tick();assert.deepEqual(supplies.at(-1),before);assert.equal(c.state.terrainActive,false);
  f.map.getLayer(FOREST).render(f.gl,{defaultProjectionData:{mainMatrix:IDENTITY}});assert.equal(f.gl.draws.length,0);
  const count=supplies.length;f.doc.hidden=true;f.doc.emit('visibilitychange');c.refresh();f.tick();assert.equal(supplies.length,count);c.dispose();
});
test('woodland query discovers provider source and sends only explicit landcover semantics',()=>{
  const features=[{type:'Feature',properties:{class:'wood',subclass:'forest'},geometry:{type:'Polygon',coordinates:[[[-1.8,53.3],[-1.7,53.3],[-1.7,53.4],[-1.8,53.3]]]}}];
  const f=fixture({features}),c=f.attach();f.tick();const query=f.map.queries.find(q=>q.query.sourceLayer==='landcover');assert.equal(query.id,'actual-vector-id');assert.deepEqual(query.query.filter,['==','class','wood']);assert.equal(f.placements[0].features[0].sourceLayer,'landcover');assert.equal(f.placements[0].features[0].properties.class,'wood');c.dispose();
});
test('source features and road clearings are bounded before placement',()=>{
  const polygon={properties:{class:'wood'},geometry:{type:'Polygon',coordinates:[]}};
  const road={geometry:{type:'LineString',coordinates:Array.from({length:3000},(_,i)=>[i/1e6,53])}};
  const routes=[Array.from({length:2000},(_,i)=>({lon:-1.8+i/1e6,lat:53.35}))];
  const f=fixture({features:Array(1000).fill(polygon),roads:Array(150).fill(road),routes}),c=f.attach();f.tick();assert.equal(f.placements[0].features.length,256);assert.ok(f.placements[0].settings.routeSegments.length<=2049);assert.equal(f.placements[0].settings.routeSegments.length,1999,'all selected-route segments take precedence over decorative road clearings');assert.ok(f.placements[0].settings.maxTrees<=1000);c.dispose();
});
test('frozen GPS route and provider geometry remain unchanged during renderer work',()=>{
  const routes=deepFreeze([[{lon:-1.78,lat:53.35},{lon:-1.779,lat:53.351}]]),features=deepFreeze([{properties:{class:'wood'},geometry:{type:'Polygon',coordinates:[]}}]);
  const before=JSON.stringify({routes,features});const f=fixture({routes,features}),c=f.attach();f.tick();f.map.emit('moveend');f.tick();c.setEnabled(false);f.tick();c.setEnabled(true);f.tick();assert.equal(JSON.stringify({routes,features}),before);c.dispose();
});
test('hundreds of map events coalesce to one scheduled rebuild',()=>{
  const f=fixture(),c=f.attach();f.tick();const initial=c.state.forestBuilds;
  for(let i=0;i<500;i++){f.map.emit('sourcedata',{sourceId:'actual-vector-id'});f.map.emit('moveend');c.refresh();}
  assert.equal(f.timers.size,1);f.tick(500);assert.equal(c.state.forestBuilds,initial+1);assert.equal(f.timers.size,0);f.tick(10000);assert.equal(c.state.forestBuilds,initial+1);c.dispose();
});
test('an initially hidden map never activates terrain or builds trees',()=>{
  const f=fixture({hidden:true}),c=f.attach();assert.ok(!f.map.calls.some(x=>x[0]==='setTerrain'&&x[1]),'hidden attach activates terrain');f.tick();assert.equal(f.placements.length,0);c.dispose();
});
test('background and hidden-screen events suspend builds until visible again',()=>{
  const f=fixture(),c=f.attach();f.tick();const before=c.state.forestBuilds;f.doc.hidden=true;f.doc.emit('visibilitychange');f.map.emit('sourcedata',{sourceId:DEM});f.tick();assert.equal(c.state.forestBuilds,before);assert.equal(c.state.terrainActive,false);
  f.doc.hidden=false;f.container.cssHidden=true;f.doc.emit('visibilitychange');f.tick();assert.equal(c.state.forestBuilds,before);f.container.cssHidden=false;f.doc.emit('visibilitychange');f.tick();assert.ok(c.state.forestBuilds>before);c.dispose();
});
test('2D toggle stops terrain and woodland drawing without changing map position',()=>{
  const f=fixture(),c=f.attach();f.tick();c.setEnabled(false);f.tick();assert.equal(c.state.terrainActive,false);const layer=f.map.getLayer(FOREST);layer.render(f.gl,{defaultProjectionData:{mainMatrix:IDENTITY}});assert.equal(f.gl.draws.length,0);assert.equal(c.getPitch(16,false),0);c.setEnabled(true);f.tick();assert.equal(c.state.terrainActive,true);c.dispose();
});
test('unrelated network errors do not disable optional terrain',()=>{
  const f=fixture(),c=f.attach();f.tick();f.map.emit('error',{sourceId:'actual-vector-id',error:Error('basemap tile')});assert.equal(c.state.terrainActive,true);assert.notEqual(c.state.elevation,'unavailable');c.dispose();
});
test('one transient DEM error is tolerated but persistent errors degrade to flat map',()=>{
  const f=fixture({demLoaded:false}),c=f.attach();f.tick();f.map.emit('error',{sourceId:DEM,error:Error('one tile')});assert.notEqual(c.state.elevation,'unavailable');
  for(let i=0;i<20;i++)f.map.emit('error',{sourceId:DEM,error:Error('persistent tile '+i)});f.tick();assert.equal(c.state.elevation,'unavailable');assert.equal(c.state.terrainActive,false);assert.ok(f.map.getLayer(FOREST));assert.ok(c.state.errors.length<=8);c.dispose();
});
test('a finite zero query cannot certify DEM readiness before source loading',()=>{
  const f=fixture({demLoaded:false,elevation:0}),c=f.attach();f.tick();assert.notEqual(c.state.elevation,'ready');assert.equal(c.state.trees,0);assert.equal(c.state.elevationPendingTrees,2);f.map.demLoaded=true;f.map.emit('sourcedata',{sourceId:DEM,isSourceLoaded:true});f.tick();assert.equal(c.state.elevation,'ready');assert.equal(c.state.trees,2);c.dispose();
});
test('GPU upload keeps signed geographic offsets and rendered height finite',()=>{
  const f=fixture(),c=f.attach();f.tick();const layer=f.map.getLayer(FOREST);assert.equal(layer.count,2);
  const uploads=f.gl.uploads.filter(x=>x.usage===f.gl.DYNAMIC_DRAW&&Array.isArray(x.data)&&x.data.length===6);assert.equal(uploads.length,2);
  assert.ok(uploads[0].data[0]<0&&uploads[0].data[1]>0);assert.ok(uploads[1].data[0]>0&&uploads[1].data[1]<0);
  for(const u of uploads){assert.ok(u.data.every(Number.isFinite));assert.ok(Math.abs(u.data[2]-320.15)<.001);assert.ok(u.data[3]>0);}
  layer.render(f.gl,{defaultProjectionData:{mainMatrix:IDENTITY}});assert.equal(f.gl.draws.length,4);assert.ok(f.gl.matrices[0].every(Number.isFinite));c.dispose();
});
test('world copies adjacent to the antimeridian do not get Earth-wide tree offsets',()=>{
  const f=fixture({trees:[{id:'across',longitude:-179.999,latitude:0,variant:0,size:1}]}),c=f.attach();f.map.center={lng:179.999,lat:0};f.tick();
  const u=f.gl.uploads.findLast(x=>x.usage===f.gl.DYNAMIC_DRAW&&Array.isArray(x.data)&&x.data.length===6);assert.ok(Math.abs(u.data[0])<300);assert.ok(Math.abs(u.data[1])<.01);c.dispose();
});
test('rendering stationary woodland never creates a private frame loop',()=>{
  const f=fixture(),c=f.attach();f.tick();const layer=f.map.getLayer(FOREST),repaints=f.map.calls.filter(x=>x[0]==='repaint').length;
  for(let i=0;i<20;i++)layer.render(f.gl,{defaultProjectionData:{mainMatrix:IDENTITY}});
  assert.equal(f.timers.size,0);assert.equal(f.map.calls.filter(x=>x[0]==='repaint').length,repaints);assert.ok(c.state.draws<=4);c.dispose();
});
test('active render timings lower quality while stationary gaps do not',()=>{
  const f=fixture(),c=f.attach();f.tick();f.setTime(6000);f.map.moving=true;
  for(let i=0;i<60;i++){f.advance(30);f.map.emit('render');}assert.equal(c.state.tier,2);assert.equal(c.state.frameP90,30);f.map.moving=false;f.advance(10000);f.map.emit('render');assert.equal(c.state.tier,2);c.dispose();
});
test('severe moving frame timings reach adaptive quality rather than disappearing',()=>{
  const f=fixture(),c=f.attach();f.tick();f.setTime(6000);f.map.moving=true;for(let i=0;i<60;i++){f.advance(120);f.map.emit('render');}assert.ok(c.state.tier<3);c.dispose();
});
test('context loss cancels scheduled work and restoration rebuilds usable GPU resources',()=>{
  const f=fixture(),c=f.attach();f.tick();c.refresh();f.map.emit('webglcontextlost');assert.equal(f.timers.size,0);const before=c.state.forestBuilds;c.refresh();f.tick();assert.equal(c.state.forestBuilds,before);f.map.emit('webglcontextrestored');f.tick();assert.equal(c.state.webgl,'instanced');assert.ok(c.state.forestBuilds>before);c.dispose();assert.equal(f.gl.live.size,0);
});
test('dispose releases GPU resources, listeners, control and pending timers',()=>{
  const f=fixture(),c=f.attach();f.tick();assert.ok(f.gl.live.size>0);c.refresh();c.dispose();c.dispose();assert.equal(f.gl.live.size,0);assert.equal(f.map.listenerCount(),0);assert.equal(f.doc.listenerCount(),0);assert.equal(f.timers.size,0);assert.equal(f.parent.children.length,1);assert.ok(f.observers.every(x=>x.disconnected));assert.equal(f.map.sources.size,0);assert.equal(f.map.layers.size,0);assert.notEqual(f.attach(),c);
});
test('a disposed controller cannot reactivate terrain or schedule work',()=>{
  const f=fixture(),c=f.attach();f.tick();c.dispose();const calls=f.map.calls.length;c.setEnabled(true);c.refresh();f.tick();assert.equal(f.map.calls.length,calls);assert.equal(f.timers.size,0);
});
test('shader failure leaves the map usable and releases partial GPU allocations',()=>{
  const f=fixture({gl:{failShader:2}}),c=f.attach();f.tick();assert.equal(c.state.webgl,'unavailable');assert.ok(f.parent.children.length>1);c.setEnabled(false);c.dispose();assert.equal(f.gl.live.size,0,'compiled vertex shader leaks if fragment compilation fails');
});
test('the actual forest core integrates with renderer query, view and instance upload',()=>{
  const features=deepFreeze([{properties:{class:'wood'},geometry:{type:'Polygon',coordinates:[[[-1.788,53.344],[-1.772,53.344],[-1.772,53.356],[-1.788,53.356],[-1.788,53.344]]]}}]);
  const f=fixture({features,useActualCore:true}),c=f.attach();f.tick();assert.ok(c.state.trees>0,JSON.stringify(c.state.placement));assert.ok(c.state.trees<=1000);assert.equal(c.state.trees,f.map.getLayer(FOREST).count);assert.equal(c.state.errors.length,0);c.dispose();
});
test('dense optional road clearings cannot exhaust the actual forest core route budget',()=>{
  const features=[{properties:{class:'wood'},geometry:{type:'Polygon',coordinates:[[[-1.788,53.346],[-1.772,53.346],[-1.772,53.356],[-1.788,53.356],[-1.788,53.346]]]}}];
  const roads=Array.from({length:100},(_,row)=>({geometry:{type:'LineString',coordinates:Array.from({length:25},(_,i)=>[-1.789+i*.0006,53.3401+row*.000002])}}));
  const f=fixture({features,roads,useActualCore:true}),c=f.attach();f.tick();assert.ok(c.state.trees>0,'optional roads eliminate all otherwise valid woodland: '+JSON.stringify(c.state.placement));c.dispose();
});
test('terrain activation waits for both loaded style and the DEM source',()=>{
  const f=fixture({styleLoaded:false}),c=f.attach();
  c.refresh();f.map.emit('moveend');f.tick();
  assert.equal(f.map.calls.filter(x=>x[0]==='setTerrain').length,0);assert.notEqual(c.state.elevation,'unavailable');
  f.map.styleLoaded=true;c.refresh();f.tick();assert.equal(f.map.calls.filter(x=>x[0]==='setTerrain').length,0,'style readiness alone does not prove source installation');
  f.map.emit('style.load');f.tick();assert.equal(c.state.terrainActive,true);assert.equal(c.state.errors.length,0);c.dispose();
});
test('a transient style-loading exception retries optional terrain without permanently disabling it',()=>{
  const f=fixture({terrainFailures:1}),c=f.attach();assert.equal(c.state.terrainActive,false);assert.notEqual(c.state.elevation,'unavailable');
  f.tick(500);assert.equal(c.state.terrainActive,true);assert.equal(c.state.elevation,'ready');assert.equal(c.state.errors.length,0);assert.equal(f.timers.size,0);c.dispose();
});
test('a permanent terrain activation failure leaves working forest and flat map',()=>{
  const f=fixture({terrainFailures:1,terrainError:'unsupported raster DEM'}),c=f.attach();f.tick();assert.equal(c.state.elevation,'unavailable');assert.equal(c.state.terrainActive,false);assert.ok(c.state.trees>0);assert.equal(f.timers.size,0);c.dispose();
});
test('placement worker starts lazily and successful completion creates no idle work loop',()=>{
  const f=fixture({worker:true}),c=f.attach();assert.equal(f.workers.length,0);f.tick();
  assert.equal(f.workers.length,1);const w=f.workers[0];assert.equal(w.messages.length,1);assert.match(w.url,/geographic_forest_worker\.js/);assert.equal(f.placements.length,0);assert.equal(c.state.forestBuilds,0);
  w.reply(w.messages[0].id);assert.equal(c.state.trees,2);assert.equal(c.state.forestBuilds,1);f.tick(10000);assert.equal(w.messages.length,1);assert.equal(f.timers.size,0);c.dispose();
});
test('worker concurrency retains only the latest queued view and discards stale results',()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const w=f.workers[0],first=w.messages[0];
  for(let i=1;i<=30;i++){f.map.center.lng=-1.78+i/1000;c.refresh();f.tick(200);}
  assert.equal(w.messages.length,1,'only one worker request may be inflight');assert.equal(f.workers.length,1);
  w.reply(first.id);assert.equal(c.state.forestBuilds,0,'the old view must not flash into the new view');assert.equal(w.messages.length,2);
  const latest=w.messages[1];assert.equal(latest.view.center[0],f.map.center.lng);assert.ok(latest.id>first.id+1,'intermediate queued requests were replaced');
  w.reply(first.id);assert.equal(c.state.forestBuilds,0);w.reply(latest.id+100);assert.equal(c.state.forestBuilds,0);
  w.reply(latest.id);assert.equal(c.state.forestBuilds,1);assert.equal(c.state.trees,2);f.tick(10000);assert.equal(w.messages.length,2);assert.equal(f.timers.size,0);c.dispose();
});
for(const pause of ['hidden','flat','context loss','dispose'])test(`worker termination on ${pause} discards queued and late placements`,()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const w=f.workers[0],first=w.messages[0];c.refresh();f.tick();assert.equal(w.messages.length,1);
  if(pause==='hidden'){f.doc.hidden=true;f.doc.emit('visibilitychange');}
  else if(pause==='flat')c.setEnabled(false);
  else if(pause==='context loss')f.map.emit('webglcontextlost');
  else c.dispose();
  assert.equal(w.terminated,1);w.reply(first.id);f.tick(10000);assert.equal(c.state.forestBuilds,0);assert.equal(w.messages.length,1);assert.equal(f.workers.length,1);assert.equal(f.timers.size,0);c.dispose();
});
test('resuming a visible map starts a fresh worker and cannot accept old worker results',()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const old=f.workers[0];f.doc.hidden=true;f.doc.emit('visibilitychange');f.doc.hidden=false;f.doc.emit('visibilitychange');f.tick();
  assert.equal(f.workers.length,2);const current=f.workers[1];old.reply(old.messages[0].id);assert.equal(c.state.forestBuilds,0);assert.equal(current.terminated,0);current.reply(current.messages[0].id);assert.equal(c.state.forestBuilds,1);c.dispose();
});
test('an error queued by a terminated worker cannot terminate its replacement',()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const old=f.workers[0];f.doc.hidden=true;f.doc.emit('visibilitychange');f.doc.hidden=false;f.doc.emit('visibilitychange');f.tick();const current=f.workers[1];
  old.fail();assert.equal(current.terminated,0,'obsolete worker error terminated the current worker');current.reply(current.messages[0].id);assert.equal(c.state.forestBuilds,1);assert.equal(f.placements.length,0);c.dispose();
});
test('worker constructor rejection falls back once with at most 180 trees',()=>{
  const f=fixture({worker:true,workerConstructorThrows:true}),c=f.attach();f.tick();assert.equal(f.workerAttempts,1);assert.equal(c.state.worker,'fallback');assert.equal(f.placements[0].settings.maxTrees,180);assert.equal(c.state.trees,2);
  for(let i=0;i<3;i++){c.refresh();f.tick();}assert.equal(f.workerAttempts,1);assert.ok(f.placements.every(p=>p.settings.maxTrees<=180));c.dispose();
});
for(const error of ['script','placement'])test(`worker ${error} failure terminates once and recovers through bounded synchronous fallback`,()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const w=f.workers[0];
  if(error==='script')w.fail();else w.reject(w.messages[0].id);
  assert.equal(w.terminated,1);f.tick(500);assert.equal(c.state.worker,'fallback');assert.equal(f.workers.length,1);assert.equal(c.state.forestBuilds,1);assert.equal(f.placements[0].settings.maxTrees,180);f.tick(10000);assert.equal(f.placements.length,1);assert.equal(f.timers.size,0);c.dispose();
});
test('synchronous worker postMessage failure cannot strand every later placement',()=>{
  const f=fixture({worker:true,workerPostThrows:true}),c=f.attach();f.tick(500);c.refresh();f.tick(500);
  assert.equal(c.state.worker,'fallback');assert.equal(f.workers.length,1);assert.equal(f.workers[0].terminated,1);assert.ok(c.state.forestBuilds>0);assert.ok(f.placements.every(p=>p.settings.maxTrees<=180));assert.equal(f.timers.size,0);c.dispose();
});
test('failure to dispatch the latest queued worker request also recovers without an uncaught callback',()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const w=f.workers[0];c.refresh();f.tick();w.postFailure=true;
  assert.doesNotThrow(()=>w.reply(w.messages[0].id));f.tick(500);assert.equal(w.terminated,1);assert.equal(c.state.worker,'fallback');assert.equal(c.state.forestBuilds,1);assert.equal(f.placements[0].settings.maxTrees,180);assert.equal(f.timers.size,0);c.dispose();
});
test('worker completion during a gesture defers GPU uploads until interaction ends',()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const w=f.workers[0],before=f.gl.uploads.length;
  f.map.moving=true;w.reply(w.messages[0].id);assert.equal(c.state.forestBuilds,0);assert.equal(f.gl.uploads.length,before);
  f.map.moving=false;f.map.emit('moveend');f.tick();assert.equal(c.state.forestBuilds,1);assert.ok(f.gl.uploads.length>before);assert.equal(w.messages.length,2);
  w.reply(w.messages[1].id);f.tick(10000);assert.equal(c.state.forestBuilds,2);assert.equal(f.timers.size,0);c.dispose();
});
test('a long interaction defers placement with one timer and backgrounding cancels retries',()=>{
  const f=fixture({worker:true});f.map.moving=true;const c=f.attach();f.tick(1000);assert.equal(f.workers.length,0);assert.equal(f.placements.length,0);assert.equal(f.timers.size,1);
  f.doc.hidden=true;f.doc.emit('visibilitychange');f.tick(1000);assert.equal(f.timers.size,0);assert.equal(f.workers.length,0);
  f.map.moving=false;f.doc.hidden=false;f.doc.emit('visibilitychange');f.tick();assert.equal(f.workers.length,1);c.dispose();assert.equal(f.timers.size,0);
});
function movingFrames(f,count,interval){for(let i=0;i<count;i++){f.advance(interval);f.map.emit('render');}}
test('3D starts with full terrain rather than assuming every device needs reduced relief',()=>{
  const f=fixture(),c=f.attach();f.tick();assert.equal(c.state.terrainReduced,false);assert.equal(c.state.terrainActive,true);assert.equal(f.viewChanges.length,0);c.dispose();
});
test('sustained slow movement reduces terrain while retaining enabled pitched trees and hillshade',()=>{
  const f=fixture(),c=f.attach();f.tick();f.map.moving=true;movingFrames(f,13,200);f.tick(0);
  assert.equal(c.state.terrainReduced,true);assert.equal(c.state.enabled,true);assert.equal(c.state.terrainActive,false);assert.equal(f.map.getTerrain(),null);assert.notEqual(c.state.elevation,'unavailable');assert.equal(c.getPitch(15,false),44,'reduced mode retains perspective with fewer distant tiles');assert.equal(c.getPitch(15,true),32,'route inspection keeps its verified framing pitch');
  f.map.getLayer(FOREST).render(f.gl,{defaultProjectionData:{mainMatrix:IDENTITY}});assert.ok(f.gl.draws.length>0,'illustrated woodland stays in the pitched map');
  const shade=f.map.calls.findLast(x=>x[0]==='layout'&&x[1]==='burbz-geographic-hillshade'&&x[2]==='visibility');assert.equal(shade?.[3],'visible');assert.equal(f.viewChanges.length,0,'do not interrupt an active gesture to refit the route');
  f.map.moving=false;f.map.emit('moveend');f.tick();assert.equal(f.viewChanges.length,1);assert.equal(f.viewChanges[0],true);c.dispose();
});
test('terrain reduction needs enough samples as well as two seconds of slow interaction',()=>{
  const f=fixture(),c=f.attach();f.tick();f.map.moving=true;movingFrames(f,10,300);assert.equal(c.state.terrainReduced,false,'nine intervals over two seconds are still too few samples');c.dispose();
  const short=fixture(),controller=short.attach();short.tick();short.map.moving=true;movingFrames(short,15,100);assert.equal(controller.state.terrainReduced,false,'many slow frames over less than two seconds are a transient burst');controller.dispose();
});
test('smooth sustained movement does not reduce real terrain',()=>{
  const f=fixture(),c=f.attach();f.tick();f.map.moving=true;movingFrames(f,160,20);assert.equal(c.state.terrainReduced,false);assert.equal(c.state.terrainActive,true);assert.equal(f.viewChanges.length,0);c.dispose();
});
test('hidden and idle render gaps cannot be treated as slow moving frames',()=>{
  const f=fixture(),c=f.attach();f.tick();movingFrames(f,30,250);assert.equal(c.state.terrainReduced,false);f.map.moving=true;f.doc.hidden=true;f.doc.emit('visibilitychange');movingFrames(f,30,250);assert.equal(c.state.terrainReduced,false);assert.equal(f.viewChanges.length,0);c.dispose();
});
test('separate short gestures cannot accumulate into one sustained slow interaction',()=>{
  const f=fixture(),c=f.attach();f.tick();f.map.moving=true;movingFrames(f,9,250);f.map.moving=false;movingFrames(f,2,5000);f.map.moving=true;movingFrames(f,6,250);assert.equal(c.state.terrainReduced,false,'idle must reset the slow-gesture window');c.dispose();
});
test('terrain reduction notifies once and a manual 2D to 3D transition retries fresh terrain',()=>{
  const f=fixture(),c=f.attach();f.tick();f.map.moving=true;movingFrames(f,20,200);assert.equal(c.state.terrainReduced,true);assert.equal(f.viewChanges.length,0);f.tick(0);
  f.map.moving=false;f.map.emit('moveend');f.tick();assert.equal(f.viewChanges.length,1);f.map.moving=true;movingFrames(f,20,200);f.map.moving=false;f.map.emit('moveend');f.tick();assert.equal(f.viewChanges.length,1);
  c.setEnabled(false);c.setEnabled(true);assert.equal(c.state.terrainReduced,false);assert.equal(c.state.terrainActive,true);f.map.moving=true;movingFrames(f,5,200);assert.equal(c.state.terrainReduced,false,'manual retry must not reuse the old slow samples');assert.notEqual(c.state.elevation,'unavailable');c.dispose();
});
test('terrain pause and retry reanchor existing GPU instances to the displayed ground',()=>{
  const f=fixture(),c=f.attach();f.tick();f.map.moving=true;movingFrames(f,13,200);f.tick(0);
  const instances=()=>f.gl.uploads.filter(u=>u.usage===f.gl.DYNAMIC_DRAW&&Array.isArray(u.data)&&u.data.length===6).slice(-2);
  assert.equal(instances().length,2);for(const u of instances())assert.ok(Math.abs(u.data[2]-.15)<.001,'tree must not float at the old DEM altitude after terrain pauses');
  c.setEnabled(false);c.setEnabled(true);for(const u of instances())assert.ok(Math.abs(u.data[2]-320.15)<.001,'retry must restore geographic tree elevation');c.dispose();
});
test('slow initial DEM loading is not mistaken for measured ready-terrain performance',()=>{
  const f=fixture({demLoaded:false}),c=f.attach();f.tick();f.map.moving=true;movingFrames(f,30,200);assert.equal(c.state.terrainReduced,false);assert.equal(c.state.elevation,'loading');c.dispose();
});
test('the shipped setBearing pointer gesture is measured despite jumpTo isMoving being false',()=>{
  const f=fixture(),c=f.attach();f.tick();f.wireActualRotate();f.canvas.emit('pointerdown',{pointerId:7,clientX:100});
  for(let i=1;i<=13;i++){f.advance(200);f.canvas.emit('pointermove',{pointerId:7,clientX:100+i*4});assert.equal(f.map.isMoving(),false);f.map.emit('render');}
  assert.notEqual(f.map.getBearing(),0);assert.equal(c.state.terrainReduced,true);f.tick(0);assert.equal(f.viewChanges.length,0,'do not refit while the pointer is rotating');
  f.doc.emit('pointerup',{pointerId:7});f.tick();assert.equal(f.viewChanges.length,1);c.dispose();
});
test('holding a stationary pointer never becomes a slow-map measurement',()=>{
  const f=fixture(),c=f.attach();f.tick();f.canvas.emit('pointerdown',{pointerId:7});movingFrames(f,30,200);assert.equal(c.state.terrainReduced,false);
  f.map.emit('move');movingFrames(f,30,200);assert.equal(c.state.terrainReduced,false,'a single old camera movement must expire during a stationary hold');c.dispose();
});
test('real pointer-driven camera changes still measure stalls longer than 400ms',()=>{
  const f=fixture(),c=f.attach();f.tick();f.wireActualRotate();f.canvas.emit('pointerdown',{pointerId:7,clientX:100});
  for(let i=1;i<=16;i++){f.canvas.emit('pointermove',{pointerId:7,clientX:100+i*4});f.advance(550);f.map.emit('render');}
  assert.notEqual(f.map.getBearing(),0);assert.equal(c.state.terrainReduced,true,'long real render stalls must not be discarded as expired gestures');
  f.doc.emit('pointerup',{pointerId:7});f.tick();c.dispose();
});
test('pointer-driven rotation defers worker uploads and placement until pointer release',()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const worker=f.workers[0];f.canvas.emit('pointerdown',{pointerId:2});f.map.emit('move');worker.reply(worker.messages[0].id);assert.equal(c.state.forestBuilds,0);
  c.refresh();f.tick(180);assert.equal(worker.messages.length,1);assert.equal(c.state.forestBuilds,0);
  f.doc.emit('pointercancel',{pointerId:2});f.tick();assert.equal(c.state.forestBuilds,1);assert.equal(worker.messages.length,2);c.dispose();
});
test('pointerleave ends custom rotation and releases deferred map work',()=>{
  const f=fixture({worker:true}),c=f.attach();f.tick();const worker=f.workers[0];f.canvas.emit('pointerdown',{pointerId:4});f.map.emit('move');worker.reply(worker.messages[0].id);assert.equal(c.state.forestBuilds,0);
  f.canvas.emit('pointerleave',{pointerId:4});f.tick();assert.equal(c.state.forestBuilds,1);c.dispose();
});
test('backgrounding forgets a pointer whose release event was never delivered',()=>{
  const f=fixture(),c=f.attach();f.tick();f.canvas.emit('pointerdown',{pointerId:9});f.map.emit('move');f.doc.hidden=true;f.doc.emit('visibilitychange');f.advance(5000);f.doc.hidden=false;f.doc.emit('visibilitychange');f.tick();
  for(let i=0;i<13;i++){f.advance(200);f.map.emit('move');f.map.emit('render');}
  assert.equal(c.state.terrainReduced,false,'automated camera updates after resume must not inherit an abandoned pointer');c.dispose();
});
test('renderer disposal removes capture and canvas pointer handlers',()=>{
  const f=fixture(),c=f.attach();assert.equal(f.canvas.events.get('pointerdown').size,1);assert.equal(f.doc.events.get('pointerup').size,1);f.canvas.emit('pointerdown',{pointerId:3});f.map.emit('move');c.dispose();
  assert.equal(f.canvas.listenerCount(),0);assert.equal(f.doc.listenerCount(),0);f.canvas.emit('pointerdown',{pointerId:5});f.doc.emit('pointerup',{pointerId:5});f.tick();assert.equal(f.timers.size,0);
});
