'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../geographic_forest_core.js');

const ring = (w,s,e,n) => [[w,s],[e,s],[e,n],[w,n],[w,s]];
const geometry = (...rings) => ({type:'Polygon',coordinates:rings});
const feature = (g, overrides={}) => ({type:'Feature',sourceLayer:'landcover',properties:{class:'wood'},geometry:g,...overrides});
const small = geometry(ring(-1.503,53.378,-1.500,53.381));
const view = {bounds:[-1.504,53.377,-1.499,53.382],center:[-1.5015,53.3795],zoom:17};
const place = (features=[feature(small)],v=view,o={}) => core.placeTrees(features,v,{maxTrees:1200,...o});
const ids = result => result.trees.map(t=>t.id).sort();
const records = result => [...result.trees].sort((a,b)=>a.id.localeCompare(b.id));
const point = t => [t.longitude,t.latitude];
const assertSubset = (a,b) => {const set=new Set(ids(b));assert.ok(a.trees.every(t=>set.has(t.id)));};
const degM = Math.PI*6378137/180;
function distanceToSegment(p,segment) {
  const wrap=x=>((x+180)%360+360)%360-180;
  const cos=Math.cos(p[1]*Math.PI/180);
  const a=[wrap(segment[0][0]-p[0])*cos,segment[0][1]-p[1]];
  const b=[a[0]+wrap(segment[1][0]-segment[0][0])*cos,segment[1][1]-p[1]];
  const dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
  const t=length?Math.max(0,Math.min(1,-(a[0]*dx+a[1]*dy)/length)):0;
  return Math.hypot(a[0]+t*dx,a[1]+t*dy)*degM;
}

test('UMD exports the same public API without requiring a browser or external dependency',()=>{
  const sandbox={};vm.runInNewContext(fs.readFileSync(require.resolve('../geographic_forest_core.js'),'utf8'),sandbox);
  assert.equal(typeof sandbox.BurbzGeographicForestCore.placeTrees,'function');
  assert.equal(core.DEFAULTS.maxTrees,600);assert.equal(core.LIMITS.maxTrees,1200);
  assert.equal(core.LIMITS.maxRouteSegments,2048);
});

test('woodland requires an actual mapped semantic and polygon geometry',()=>{
  assert.equal(core.isWoodlandFeature(feature(small)),true);
  for(const props of [{class:'park'},{class:'grass'},{class:'forest'},{natural:'wood'},{name:'Forest',habitat:'woodland'}]) {
    assert.equal(core.isWoodlandFeature(feature(small,{properties:props})),false);
  }
  assert.equal(core.isWoodlandFeature(feature(small,{sourceLayer:'park'})),false);
  assert.equal(core.isWoodlandFeature(feature(small,{sourceLayer:undefined})),false);
  assert.equal(core.isWoodlandFeature(feature({type:'Point',coordinates:[-1.5,53.38]})),false);
  assert.equal(place([feature(small,{properties:{class:'grass'}})]).trees.length,0);
});

test('querySourceFeatures and rendered-feature source-layer forms are accepted',()=>{
  for(const metadata of [{'source-layer':'landcover'},{layer:{'source-layer':'landcover'}}]) {
    const f=feature(small,{sourceLayer:undefined,...metadata});assert.ok(place([f]).trees.length>0);
  }
  assert.equal(core.isWoodlandFeature(feature(small,{sourceLayer:'landuse',properties:{class:'forest'}})),true);
  assert.equal(core.isWoodlandFeature(feature(small,{sourceLayer:'landuse',properties:{class:'other',landuse:'forest'}})),true);
  assert.equal(core.isWoodlandFeature(feature(small,{sourceLayer:'landuse',properties:{class:'wood'}})),false);
});

test('all illustrative coordinates remain inside the supplied real polygon and visible bounds',()=>{
  const result=place();assert.ok(result.trees.length>200);
  for(const tree of result.trees){
    assert.ok(core.pointInWoodland(point(tree),small));
    assert.ok(tree.longitude>=view.bounds[0]&&tree.longitude<=view.bounds[2]);
    assert.ok(tree.latitude>=view.bounds[1]&&tree.latitude<=view.bounds[3]);
    assert.ok(tree.size>=0.82&&tree.size<=1.30);assert.ok(Number.isInteger(tree.variant)&&tree.variant>=0&&tree.variant<4);
  }
});

test('polygon holes and their boundaries remain empty',()=>{
  const hole=ring(-1.5023,53.3787,-1.5007,53.3803),g=geometry(small.coordinates[0],hole);
  const result=place([feature(g)]);assert.ok(result.trees.length>100);
  assert.ok(result.trees.every(t=>core.pointInWoodland(point(t),g)));
  assert.equal(core.pointInWoodland([-1.5015,53.3795],g),false);
  assert.equal(core.pointInWoodland(hole[0],g),false);
  assert.equal(core.pointInWoodland([-1.503,53.379],g),true);
});

test('disjoint MultiPolygon islands contain trees without filling the gap',()=>{
  const g={type:'MultiPolygon',coordinates:[[ring(-1.503,53.378,-1.502,53.381)],[ring(-1.501,53.378,-1.500,53.381)]]};
  const result=place([feature(g)]);assert.ok(result.trees.some(t=>t.longitude<-1.502));assert.ok(result.trees.some(t=>t.longitude>-1.501));
  assert.ok(result.trees.every(t=>t.longitude<=-1.502||t.longitude>=-1.501));
});

test('winding reversal and consecutive duplicate vertices preserve geographic membership',()=>{
  const reversed=geometry([...small.coordinates[0]].reverse());
  const repeated=geometry([small.coordinates[0][0],...small.coordinates[0]]);
  assert.deepEqual(records(place([feature(reversed)])),records(place()));
  assert.deepEqual(records(place([feature(repeated)])),records(place()));
});

test('a malformed hole rejects its complete source feature, including valid outer and other islands',()=>{
  const badHoles=[
    [[-1.502,53.379],[-1.501,53.379],[-1.501,53.380]],
    [[-1.502,53.379],[-1.501,53.379],[NaN,53.380],[-1.502,53.379]],
    ring(-1.6,53.378,-1.59,53.379),
    ring(-1.504,53.379,-1.502,53.380),
    ring(-1.503,53.379,-1.502,53.380),
    [[-1.502,53.379],[-1.501,53.380],[-1.502,53.380],[-1.501,53.379],[-1.502,53.379]]
  ];
  for(const hole of badHoles){
    const g={type:'MultiPolygon',coordinates:[[small.coordinates[0]],[small.coordinates[0],hole]]};
    const result=place([feature(g)]);assert.equal(result.trees.length,0);assert.equal(result.diagnostics.invalidFeatures,1);
  }
});

test('nested and intersecting holes reject rather than turning a hole into woodland',()=>{
  for(const holes of [
    [ring(-1.5025,53.3785,-1.5005,53.3805),ring(-1.502,53.379,-1.501,53.380)],
    [ring(-1.5025,53.3785,-1.501,53.380),ring(-1.502,53.379,-1.5005,53.3805)]
  ])assert.equal(place([feature(geometry(small.coordinates[0],...holes))]).trees.length,0);
});

test('invalid outer geometry never falls back to a rectangle or centroid',()=>{
  const invalid=[
    geometry([]),geometry([[0,0],[1,0],[1,1],[0,1]]),geometry([[0,0],[1,0],[2,0],[0,0]]),
    geometry([[0,0],[1,1],[0,1],[1,0],[0,0]]),geometry([[0,0],[Infinity,1],[1,1],[0,0]]),
    geometry([[0,0],[1,0],[1,91],[0,0]]),{type:'MultiPolygon',coordinates:[]}
  ];
  for(const g of invalid)assert.equal(place([feature(g)]).trees.length,0);
});

test('repeated requests and reordered tiled features return identical stable records',()=>{
  const left=feature(geometry(ring(-1.503,53.378,-1.5015,53.381)),{id:'left'});
  const right=feature(geometry(ring(-1.5015,53.378,-1.500,53.381)),{id:'right'});
  assert.deepEqual(place([left,right]),place([right,left]));assert.deepEqual(place(),place());
});

test('anonymous features sharing an initial edge remain deterministic when the vertex budget fits only one',()=>{
  const a=feature(small),b=feature(geometry(ring(-1.503,53.378,-1.500,53.379)));
  assert.deepEqual(place([a,b],view,{maxVertices:5}),place([b,a],view,{maxVertices:5}));
});

test('duplicate source features and differently clipped tile fragments do not duplicate trees',()=>{
  const left=feature(geometry(ring(-1.503,53.378,-1.5015,53.381)));
  const right=feature(geometry(ring(-1.5015,53.378,-1.500,53.381)));
  assert.deepEqual(records(place([left,right])),records(place()));
  const duplicates=place([feature(small),feature(small),left,right]);
  assert.deepEqual(records(duplicates),records(place()));assert.equal(new Set(ids(duplicates)).size,duplicates.trees.length);
  assert.equal(duplicates.diagnostics.duplicatePolygons,1);
});

test('source FeatureCollection, view and route coordinates are never mutated',()=>{
  const input={type:'FeatureCollection',features:[feature(small)]},v=structuredClone(view),options={routeSegments:[[[-1.502,53.377],[-1.502,53.382]]],clearanceM:10};
  const before=JSON.stringify([input,v,options]);core.placeTrees(input,v,options);assert.equal(JSON.stringify([input,v,options]),before);
});

test('panning a non-saturated forest retains each overlapping world-cell record',()=>{
  const shifted={...view,zoom:16,bounds:[-1.502,53.378,-1.499,53.382],center:[-1.5005,53.380]};
  const a=place(undefined,{...view,zoom:16}),b=place(undefined,shifted),byId=new Map(b.trees.map(t=>[t.id,t]));
  const overlap=a.trees.filter(t=>t.longitude>=shifted.bounds[0]);assert.ok(overlap.length>100);
  for(const tree of overlap)assert.deepEqual(byId.get(tree.id),tree);
});

test('LOD is nested from zoom13 through19 including under the same tree cap',()=>{
  for(const maxTrees of [35,1200]){
    let previous=place(undefined,{...view,zoom:13},{maxTrees});assert.ok(previous.trees.length>0);
    for(let zoom=14;zoom<=19;zoom++){
      const next=place(undefined,{...view,zoom},{maxTrees});assertSubset(previous,next);
      const byId=new Map(next.trees.map(t=>[t.id,t]));for(const t of previous.trees)assert.deepEqual(byId.get(t.id),t);
      previous=next;
    }
  }
});

test('stable density thinning produces a subset without relocating or resizing trees',()=>{
  const full=place(undefined,{...view,zoom:16}),thin=place(undefined,{...view,zoom:16},{density:0.35});assert.ok(thin.trees.length>0&&thin.trees.length<full.trees.length);assertSubset(thin,full);
  const byId=new Map(full.trees.map(t=>[t.id,t]));for(const t of thin.trees)assert.deepEqual(byId.get(t.id),t);
});

test('negative longitudes and southern latitudes are supported',()=>{
  const g=geometry(ring(-58.42,-34.61,-58.416,-34.606));const v={bounds:[-58.421,-34.611,-58.415,-34.605],zoom:16};
  const result=place([feature(g)],v);assert.ok(result.trees.length>20);assert.ok(result.trees.every(t=>core.pointInWoodland(point(t),g)));
});

test('antimeridian polygons and crossing visible bounds keep trees on the two genuine sides',()=>{
  const g=geometry(ring(179.997,-0.002,-179.997,0.002)),v={bounds:[179.996,-0.003,-179.996,0.003],center:[180,0],zoom:16};
  const result=place([feature(g)],v);assert.ok(result.trees.some(t=>t.longitude>179.997));assert.ok(result.trees.some(t=>t.longitude<-179.997));
  assert.ok(result.trees.every(t=>core.pointInWoodland(point(t),g)));
  const copy={...g,coordinates:g.coordinates.map(r=>r.map(p=>[p[0]<0?p[0]+360:p[0],p[1]]))};
  assert.deepEqual(records(place([feature(copy)],v)),records(result));
});

test('antimeridian holes remain excluded and equivalent center longitude is stable',()=>{
  const g=geometry(ring(179.997,-0.003,-179.997,0.003),ring(179.999,-0.001,-179.999,0.001));
  const v={bounds:[179.996,-0.004,-179.996,0.004],center:[180,0],zoom:16},result=place([feature(g)],v);
  assert.ok(result.trees.length>0);assert.ok(result.trees.every(t=>core.pointInWoodland(point(t),g)));
  assert.equal(core.pointInWoodland([180,0],g),false);
  assert.deepEqual(records(result),records(place([feature(g)],{...v,center:[-180,0]})));
});

test('invalid views and empty input safely return zero trees',()=>{
  for(const v of [{},{bounds:[1,1,1,2],zoom:16},{bounds:[0,2,1,1],zoom:16},{bounds:[0,0,1,NaN],zoom:16},{...view,zoom:NaN}])assert.equal(place(undefined,v).diagnostics.status,'invalid-view');
  assert.equal(place([]).trees.length,0);assert.equal(place(null).trees.length,0);
  assert.equal(place(undefined,{...view,zoom:12.99}).diagnostics.status,'zoom-hidden');
});

test('disabled density and tree budgets produce no hidden fallback forest',()=>{
  for(const o of [{density:0},{density:-1},{maxTrees:0},{maxTrees:-1}])assert.equal(place(undefined,undefined,o).diagnostics.status,'disabled');
});

test('default and hard tree caps bound a large genuinely wooded visible area',()=>{
  const g=geometry(ring(-1.51,53.37,-1.49,53.39)),v={bounds:[-1.51,53.37,-1.49,53.39],zoom:19};
  const normal=core.placeTrees([feature(g)],v),hard=place([feature(g)],v,{maxTrees:10000000});
  assert.equal(normal.trees.length,600);assert.equal(hard.trees.length,1200);assert.ok(hard.diagnostics.limitsHit.includes('trees'));
  assert.ok(hard.diagnostics.candidates<=core.LIMITS.maxCandidates);
});

test('feature and total vertex limits reject safely without dropping hole rings',()=>{
  assert.equal(place(Array.from({length:513},()=>feature(small))).diagnostics.status,'feature-limit');
  const g=geometry(small.coordinates[0],ring(-1.502,53.379,-1.501,53.380));
  const limited=place([feature(g)],undefined,{maxVertices:9});assert.equal(limited.trees.length,0);assert.ok(limited.diagnostics.limitsHit.includes('vertices'));
  assert.equal(limited.diagnostics.acceptedFeatures,0);
});

test('oversized feature/ring budgets reject the entire source feature before sampling',()=>{
  const large=Array.from({length:8001},(_,i)=>[-1.5015+0.001*Math.cos(i/8000*Math.PI*2),53.3795+0.001*Math.sin(i/8000*Math.PI*2)]);large[large.length-1]=large[0];
  const result=place([feature(geometry(large))]);assert.equal(result.trees.length,0);assert.ok(result.diagnostics.limitsHit.includes('feature-vertices'));
  const rings=place([feature(geometry(small.coordinates[0],...Array.from({length:512},()=>small.coordinates[0])))]);
  assert.equal(rings.trees.length,0);assert.ok(rings.diagnostics.limitsHit.includes('rings'));
});

test('candidate exhaustion is explicit and cannot create outside-polygon fallback trees',()=>{
  const result=place(undefined,undefined,{maxCandidates:2});assert.ok(result.diagnostics.candidates<=2);assert.ok(result.diagnostics.limitsHit.includes('candidates'));
  assert.ok(result.trees.every(t=>core.pointInWoodland(point(t),small)));
  assert.equal(place(undefined,undefined,{maxCandidates:0}).trees.length,0);
});

test('pathological valid rings cannot exceed the geometry work budget',()=>{
  const points=[[-1.503,53.378],[-1.500,53.378]];
  for(let i=1;i<=4000;i++)points.push([i%2?-1.501:-1.500,53.378+i*0.0000007]);
  points.push([-1.503,53.381],points[0]);
  const result=place([feature(geometry(points))]);assert.equal(result.trees.length,0);
  assert.ok(result.diagnostics.limitsHit.includes('geometry-checks'));
  assert.ok(result.diagnostics.geometryChecks<=core.LIMITS.maxGeometryChecks+1);
});

test('dense valid geometry stops safely at the point-in-polygon work budget',()=>{
  const points=Array.from({length:7000},(_,i)=>[-1.5015+0.002*Math.cos(i/7000*Math.PI*2),53.3795+0.002*Math.sin(i/7000*Math.PI*2)]);points.push(points[0]);
  const result=place([feature(geometry(points))]);assert.ok(result.diagnostics.limitsHit.includes('point-tests'));
  assert.ok(result.diagnostics.pointTests<=core.LIMITS.maxPointTests+1);
  for(const t of result.trees){const x=(t.longitude+1.5015)/0.002,y=(t.latitude-53.3795)/0.002;assert.ok(x*x+y*y<=1.0000001);}
});

test('global visible bounds stay bounded when intersecting a small mapped woodland',()=>{
  const result=place(undefined,{bounds:[-180,-85,180,85],center:[0,0],zoom:19},{maxCandidates:100});
  assert.ok(result.diagnostics.candidates<=100);assert.ok(result.trees.every(t=>core.pointInWoodland(point(t),small)));
});

test('actual route corridors exclude tree centers along the full segment',()=>{
  const route=[[-1.5015,53.377],[-1.5015,53.382]],result=place(undefined,{...view,zoom:16},{routeSegments:[route],clearanceM:14});
  assert.ok(result.trees.length>0&&result.diagnostics.routeExcluded>0);
  assert.ok(result.trees.every(t=>distanceToSegment(point(t),route)>14-1e-7));
  assertSubset(result,place(undefined,{...view,zoom:16}));
});

test('a return leg supplied later in the route list still excludes the true corridor',()=>{
  const far=[[-1.8,53.1],[-1.79,53.11]],returnLeg=[[-1.5015,53.377],[-1.5015,53.382]];
  const routes=[...Array.from({length:1899},()=>far),returnLeg],result=place(undefined,undefined,{routeSegments:routes,clearanceM:18});
  assert.equal(result.diagnostics.routeSegments,1900);assert.ok(result.trees.length>0&&result.diagnostics.routeExcluded>0);
  assert.ok(result.trees.every(t=>distanceToSegment(point(t),returnLeg)>18-1e-7));
  assert.ok(result.diagnostics.routeChecks<result.diagnostics.uniqueCandidates*2,'distant routes must not be visited per candidate');
});

test('route indexing handles diagonal segments and nearby segments outside the visible bounds',()=>{
  const routes=[[[-1.5035,53.3775],[-1.4995,53.3815]],[[-1.50204,53.377],[-1.50204,53.382]]];
  const v={...view,bounds:[-1.502,53.378,-1.500,53.381]},result=place(undefined,v,{routeSegments:routes,clearanceM:12});
  assert.ok(result.trees.length>0);for(const t of result.trees)for(const r of routes)assert.ok(distanceToSegment(point(t),r)>12-1e-7);
});

test('point route segments clear their actual radius and zero clearance preserves the original forest',()=>{
  const original=place(undefined,{...view,zoom:16}),anchor=point(original.trees[0]),routes=[[anchor,anchor]];
  const result=place(undefined,{...view,zoom:16},{routeSegments:routes,clearanceM:20});assert.ok(result.trees.length<original.trees.length);
  assert.ok(result.trees.every(t=>distanceToSegment(point(t),routes[0])>20-1e-7));
  assert.deepEqual(records(place(undefined,{...view,zoom:16},{routeSegments:routes,clearanceM:0})),records(original));
});

test('antimeridian route corridor does not jump to an invented central-world segment',()=>{
  const g=geometry(ring(179.997,-0.003,-179.997,0.003)),v={bounds:[179.996,-0.004,-179.996,0.004],center:[180,0],zoom:16};
  const route=[[179.996,0],[-179.996,0]],result=place([feature(g)],v,{routeSegments:[route],clearanceM:25});
  assert.ok(result.trees.length>0&&result.diagnostics.routeExcluded>0);assert.ok(result.trees.every(t=>distanceToSegment(point(t),route)>25-1e-7));
});

test('invalid or over-budget routes fail closed without silently dropping any later route',()=>{
  for(const routes of [[[[0,0],[NaN,1]]],[[[0,0]]],'bad',Array.from({length:2049},()=>[[0,0],[1,1]])]){
    const result=place(undefined,undefined,{routeSegments:routes});assert.equal(result.trees.length,0);assert.match(result.diagnostics.status,/^(invalid-route|route-limit)$/);
  }
});

test('route index has a hard allocation budget and fails closed on a world-spanning corridor',()=>{
  const result=place(undefined,{bounds:[-170,-80,170,80],zoom:17},{routeSegments:[[[-160,-70],[10,70]]]});
  assert.equal(result.trees.length,0);assert.equal(result.diagnostics.status,'route-limit');assert.ok(result.diagnostics.limitsHit.includes('route-index'));
  assert.ok(result.diagnostics.routeIndexEntries<=core.LIMITS.maxRouteIndexEntries);
});

test('high-latitude route corridors use conservative spatial buckets and exact local distances',()=>{
  const g=geometry(ring(20,79.999,20.02,80.003)),v={bounds:[19.999,79.998,20.021,80.004],zoom:17};
  const route=[[20.01,79.99],[20.01,80.01]],result=place([feature(g)],v,{routeSegments:[route],clearanceM:15});
  assert.ok(result.trees.length>0);assert.ok(result.trees.every(t=>distanceToSegment(point(t),route)>15-1e-7));
});

function workerHarness() {
  const imports=[],messages=[],sandbox={importScripts:url=>imports.push(url),BurbzGeographicForestCore:core,postMessage:message=>messages.push(message)};
  sandbox.self=sandbox;vm.runInNewContext(fs.readFileSync(require.resolve('../geographic_forest_worker.js'),'utf8'),sandbox);
  return {imports,messages,send:data=>sandbox.onmessage({data})};
}

test('worker imports only the fixed local versioned core and returns the exact pure placement with request id',()=>{
  const worker=workerHarness(),request={id:37,features:[feature(small)],view,options:{maxTrees:40}};
  assert.deepEqual(worker.imports,['geographic_forest_core.js?v=woodland-harvest-v372-20260908']);
  worker.send(request);assert.equal(worker.messages.length,1);assert.equal(worker.messages[0].id,37);
  assert.deepEqual(worker.messages[0].result,core.placeTrees(request.features,view,request.options));
});

test('worker contains malformed and over-budget requests and remains usable for the next generation',()=>{
  const worker=workerHarness();
  worker.send({id:'bad',features:Array.from({length:513},()=>feature(small)),view});
  worker.send({id:'route',features:[feature(small)],view,options:{routeSegments:Array.from({length:2049},()=>[[0,0],[1,1]])}});
  worker.send({id:'next',features:[],view,url:'https://example.invalid/script.js'});
  assert.match(worker.messages[0].error,/feature budget/);assert.match(worker.messages[1].error,/route budget/);
  assert.equal(worker.messages[2].id,'next');assert.equal(worker.messages[2].result.trees.length,0);
  assert.equal(worker.imports.length,1);
});

test('worker ignores uncorrelatable ids instead of echoing arbitrary request objects',()=>{
  const worker=workerHarness();for(const id of [undefined,{},Infinity,'x'.repeat(129)])worker.send({id,features:[],view});
  assert.equal(worker.messages.length,0);
});

test('woodland timber stays inside real polygons and holes, with fixed coordinates across zoom and visual quality',()=>{
  const g=geometry(small.coordinates[0],ring(-1.5023,53.3787,-1.5007,53.3803)),features=[feature(g)];
  const before=JSON.stringify([features,view]),expected=core.timber(features,view);assert.ok(expected.length>10&&expected.length<=96);
  assert.equal(new Set(expected.map(t=>t.key)).size,expected.length);
  for(const t of expected){assert.ok(core.pointInWoodland([t.lon,t.lat],g));assert.match(t.key,/^woodland:/);assert.equal(t.quantity,6);}
  for(const zoom of [10,13,14,17,19])assert.deepEqual(core.timber(features,{...view,zoom,density:.01,maxTrees:1,routeSegments:[[[view.bounds[0],53.38],[view.bounds[2],53.38]]]}),expected);
  assert.equal(JSON.stringify([features,view]),before);
  assert.deepEqual(core.timber(features,null),[]);assert.deepEqual(core.timber([],view),[]);
  assert.deepEqual(core.timber([feature(g,{properties:{class:'grass'}})],view),[]);
});
test('duplicate or clipped woodland tiles never mint another timber identity',()=>{
  const left=feature(geometry(ring(-1.503,53.378,-1.5015,53.381))),right=feature(geometry(ring(-1.5015,53.378,-1.500,53.381)));
  const expected=core.timber([feature(small)],view);
  assert.deepEqual(core.timber([left,right],view),expected);
  assert.deepEqual(core.timber([right,left,feature(small),feature(small)],view),expected);
  const shifted=core.timber([feature(small)],{...view,center:[-1.501,53.38],bounds:[-1.502,53.378,-1.499,53.382]});
  const byId=new Map(expected.map(t=>[t.key,t]));assert.ok(shifted.some(t=>byId.has(t.key)));
  for(const t of shifted)if(byId.has(t.key))assert.deepEqual(t,byId.get(t.key),'GPS movement cannot relocate an existing reward');
});
test('worker timber equals fixed core output while visual tree budgets and route clearings vary',()=>{
  const worker=workerHarness(),expected=core.timber([feature(small)],view);
  for(const [i,settings] of [{maxTrees:1,density:.1},{maxTrees:1000,routeSegments:[[[-1.5015,53.377],[-1.5015,53.382]]],clearanceM:50}].entries()){
    worker.send({id:i,features:[feature(small)],view:{...view,zoom:19},timberView:view,options:settings});
    assert.deepEqual(worker.messages[i].result.timber,expected);
  }
  assert.notEqual(worker.messages[0].result.trees.length,worker.messages[1].result.trees.length);
});
