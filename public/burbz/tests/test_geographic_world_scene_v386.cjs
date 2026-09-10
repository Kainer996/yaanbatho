'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../geographic_world.js'),'utf8');
function extract(name,next){const start=source.indexOf('function '+name+'('),end=source.indexOf('function '+next+'(',start);assert(start>=0&&end>start);return source.slice(start,end);}
class Geometry{constructor(){this.attributes={};}setAttribute(k,v){this.attributes[k]=v;}setIndex(v){this.index=v;}computeVertexNormals(){}}
class Attribute{constructor(array,size){this.array=array;this.itemSize=size;}}
class Mesh{constructor(geometry,material){this.geometry=geometry;this.material=material;this.position={set(x,y,z){Object.assign(this,{x,y,z});}};}}
const T={BufferGeometry:Geometry,Float32BufferAttribute:Attribute,Mesh,MeshLambertMaterial:class{constructor(p){Object.assign(this,p);}},DoubleSide:2};
const context=vm.createContext({root:{THREE:T},Math,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),rawHeight:(s,x,z)=>s.elevation(x,z)});
vm.runInContext(extract('ground','inside')+extract('prepareItem','refreshHome'),context);
function item(x){return{x,z:0,heading:0,kind:'home',ready:false,content:{radius:8,blendRadius:16,group:{position:{set(){}},rotation:{}}}};}
const a=item(0),b=item(-2),state={items:new Map([['a',a],['b',b]]),scene:{add(){}},elevation:(x,z)=>100+x*.3+z*.15};
assert.equal(context.prepareItem(state,a),true);assert.equal(context.prepareItem(state,b),true);
// At x=-14 both radial grids have an exact vertex on their downhill blend.
// Compare movement height to the actual generated mesh positions, removing
// only the deliberate 18mm anti-z-fighting surface offset.
function meshHeight(i,ring){return i.patch.geometry.attributes.position.array[(ring*40+20)*3+1]+i.patch.position.y-.018;}
const rendered=Math.max(meshHeight(a,7),meshHeight(b,6),state.elevation(-14,0));
assert(Math.abs(context.ground(state,-14,0)-rendered)<1e-8,'overlapping movement ground must match the highest rendered patch');
state.items=new Map([['b',b],['a',a]]);
assert(Math.abs(context.ground(state,-14,0)-rendered)<1e-8,'patch insertion order must not lift the player');
assert.equal(context.ground(state,100,0),130,'outside all plots uses the original sloped DEM');
state.elevation=()=>null;
assert.equal(context.ground(state,-14,0),null,'known plot metadata does not turn missing terrain into safe ground');
console.log('geographic world scene: overlapping slope, rendered height, ordering and missing terrain passed');

// MapLibre querySourceFeatures omits sourceLayer and exposes geometry through
// a getter. Exercise the actual reader, then the real woodland validator.
const forest=require('../geographic_forest_core.js');
const providerFeature=Object.create({
 get id(){return 41;},
 get properties(){return{class:'wood'};},
 get geometry(){return{type:'Polygon',coordinates:[[[-2.654,54.446],[-2.646,54.446],[-2.646,54.454],[-2.654,54.454],[-2.654,54.446]]]};}
});
let handedOff;
context.excludeAuthoredBuildings=()=>{};
context.refreshForest=(s,features)=>{handedOff=features;};
vm.runInContext(extract('refreshFeatures','refreshForest'),context);
const featureState={items:new Map(),map:{getStyle:()=>({layers:[{source:'world-vector','source-layer':'landcover'}]}),querySourceFeatures:(source,options)=>options.sourceLayer==='landcover'?[providerFeature]:[]}};
context.refreshFeatures(featureState);
assert.equal(handedOff.length,1);
assert.equal(handedOff[0].sourceLayer,'landcover');
assert.equal(handedOff[0].geometry.type,'Polygon');
assert.equal(Object.hasOwn(providerFeature,'sourceLayer'),false,'provider features remain untouched');
assert(forest.placeTrees(handedOff,{bounds:[-2.654,54.446,-2.646,54.454],center:[-2.65,54.45],zoom:16},{maxTrees:12}).trees.length>0,'native vector woodland must reach the actual bounded tree placer');
console.log('geographic world adapter: getter-based source geometry and woodland layer identity passed');

// A saved flight above a house is already safe even though its ground footprint
// is blocked. An actual air obstruction can move it sideways without landing.
context.C=()=>({reset(p){p.velocity={x:0,y:0,z:0};}});
vm.runInContext(extract('recover','bounds'),context);
const airborne={items:new Map(),elevation:()=>100,p:{x:0,y:150,z:0,yaw:.4,pitch:.1,mode:'fly'}};
// Model collision heights above the shared terrain datum.
context.allowed=(s,x,z,y)=>Math.hypot(x,z)>2||y!==undefined&&y>=120;
assert.equal(context.recover(airborne),true);
assert.deepEqual(airborne.p,{x:0,y:150,z:0,yaw:.4,pitch:.1,mode:'fly',velocity:{x:0,y:0,z:0}},'safe saved flight must not move or descend over a blocked ground footprint');
const obstructed={items:new Map(),elevation:()=>100,p:{x:0,y:115,z:0,yaw:.4,pitch:.1,mode:'fly'}};
assert.equal(context.recover(obstructed),true);
assert(Math.hypot(obstructed.p.x,obstructed.p.z)>2);
assert.equal(obstructed.p.y,115,'lateral flight recovery preserves altitude');
assert.equal(obstructed.p.mode,'fly');
const unavailable={items:new Map(),elevation:()=>null,p:{x:0,y:150,z:0,yaw:.4,pitch:.1,mode:'fly'}};
assert.equal(context.recover(unavailable),false);
assert.equal(unavailable.p.y,150,'missing elevation does not lower a flying save');
console.log('geographic world recovery: saved flight height, lateral recovery and unknown ground passed');

// A lost context may return null GL state before the DOM loss event arrives.
// Run the actual custom layer entry point, not a copy of its guard condition.
context.current=()=>true;context.LAYER='geographic-world-content';
vm.runInContext(extract('customLayer','daylight'),context);
const layer=context.customLayer({ready:true,contextLost:false});
let reads=0;
const lost={isContextLost:()=>true,getParameter(){reads++;throw Error('lost GL must not be queried');}};
assert.doesNotThrow(()=>layer.render(lost,{defaultProjectionData:{mainMatrix:new Array(16).fill(0)}}));
assert.equal(reads,0);
const racing={isContextLost:()=>false,getParameter:()=>null,isEnabled:()=>false};
assert.doesNotThrow(()=>layer.render(racing,{defaultProjectionData:{mainMatrix:new Array(16).fill(0)}}),'null state during a context-loss race must not be spread');
console.log('geographic world GL: context loss and null viewport race passed');

// Retain the provider's original predicate, reuse its extrusion, and replace
// each mask from that original rather than nesting previous masks on refresh.
vm.runInContext(extract('filterExpression','refreshFeatures'),context);
context.C=()=>({unproject:(origin,p)=>({lon:p.x/100000,lat:p.z/100000})});
const original=['all',['==','extrude',true],['in','class','house','apartments']];
const providerLayers=[{id:'building-3d',type:'fill-extrusion','source-layer':'building',source:'openmaptiles',filter:original}];
let additions=0,updates=0,latest;
const masked={origin:{},items:new Map([['home',{x:0,z:0,content:{blendRadius:30}}]]),errors:[],map:{
 getStyle:()=>({layers:providerLayers}),getLayer:id=>providerLayers.find(l=>l.id===id),getFilter:id=>providerLayers.find(l=>l.id===id)?.filter,
 addLayer(layer){additions++;providerLayers.push(layer);},setLayoutProperty(id,key,value){assert.equal(value,'visible');},
 setFilter(id,value){updates++;latest=value;providerLayers.find(l=>l.id===id).filter=value;}
}};
context.installBuildings(masked);
assert.equal(additions,0,'an existing provider extrusion must not be duplicated');
context.excludeAuthoredBuildings(masked,[]);
const json=value=>JSON.parse(JSON.stringify(value));
assert.deepEqual(json(latest[1]),['all',['==',['get','extrude'],true],['in',['get','class'],['literal',['house','apartments']]]]);
assert.equal(latest[2][1][0],'within');
assert.deepEqual(original,['all',['==','extrude',true],['in','class','house','apartments']],'provider filter object must stay untouched');
context.excludeAuthoredBuildings(masked,[]);assert.equal(updates,1,'unchanged masks do not trigger native style work');
masked.items.get('home').x=10;context.excludeAuthoredBuildings(masked,[]);
assert.equal(latest.length,3);assert.equal(latest[1][1][0],'==','refresh starts from the saved provider filter');
const fallback={map:{...masked.map,getStyle:()=>({layers:[{id:'building',type:'fill','source-layer':'building',source:'openmaptiles'}]}),getFilter:()=>undefined}};
context.installBuildings(fallback);assert.equal(additions,1);assert.equal(fallback.buildingLayers[0].id,'gw-real-buildings');
console.log('geographic world buildings: provider reuse, original filters and replacement masks passed');

// Emulate the pinned MapLibre order: onRemove detaches THREE's canvas restore
// listener, then the map emits loss. Old buffer callbacks must run while lost.
let gpuLost=true,disposed=0,rendererDetached=false;
const resource=()=>({dispose(){assert(gpuLost,'old GPU handles must be released before restoration');disposed++;}});
context.disposeMesh=mesh=>{mesh.geometry.dispose();mesh.material.dispose();};
context.removeItem=(s,id)=>{const item=s.items.get(id);item.content.dispose();s.items.delete(id);};
context.clearInput=s=>{s.p.velocity={x:0,y:0,z:0};};context.status=(s,value)=>{s.status=value;};
vm.runInContext(extract('disposeContent','dispose'),context);
const gpuState={ready:true,contextLost:false,items:new Map([['home',{content:resource()}]]),forest:[{geometry:resource(),material:resource()}],treeSolids:[{}],draws:15,p:{x:2,y:125,z:3,yaw:.4,mode:'fly'},renderer:{dispose(){rendererDetached=true;}}};
context.customLayer(gpuState).onRemove();assert(rendererDetached);
context.contextLost(gpuState);
assert.equal(disposed,3);assert.equal(gpuState.items.size,0);assert.equal(gpuState.forest.length,0);assert.equal(gpuState.ready,false);
assert.equal(gpuState.p.y,125);assert.equal(gpuState.p.mode,'fly');
gpuLost=false;assert.doesNotThrow(()=>context.disposeContent(gpuState),'restored teardown must have no retired GPU callbacks');
assert.equal(disposed,3,'owned GPU content is released once');
console.log('geographic world lifecycle: loss cleanup before restoration preserves pose and releases each resource once');
