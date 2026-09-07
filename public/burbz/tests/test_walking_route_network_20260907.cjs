'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../walking_route_core.js');
const origin = {lat:53,lon:-2};
const p = (north,east) => ({lat:53+north/111320,lon:-2+east/(111320*Math.cos(53*Math.PI/180))});
const way = (id,nodes,geometry,tags={}) => ({type:'way',id,nodes,geometry,tags:{highway:'footway',designation:'public_footpath',surface:'compacted',...tags}});
const osm = elements => ({osm3s:{timestamp_osm_base:'2026-09-07T12:00:00Z'},elements});
const square = (size=500,off=0,id=1) => [way(id,[id*10,id*10+1,id*10+2,id*10+3,id*10],[p(0,off),p(0,off+size),p(size,off+size),p(size,off),p(0,off)])];
const offersFor = (elements,position=origin,options={}) => core.parseOffers(osm(elements),position.lat,position.lon,options);
function validOffers(offers) { assert.ok(offers.length); for(const offer of offers) assert.equal(core.validateOffer(offer).valid,true,JSON.stringify(core.validateOffer(offer))); }

test('real shared-node square becomes a full, accurate public walking loop',()=>{
  const offers=offersFor(square()); validOffers(offers);
  const loop=offers[0]; assert.equal(loop.routeMode,'loop'); assert.ok(loop.lengthM>1900&&loop.lengthM<2100);
  assert.deepEqual(loop.points[0],loop.points.at(-1)); assert.equal(loop.pathShare,1); assert.equal(loop.publicPathShare,1);
  assert.equal(loop.sourceTimestamp,'2026-09-07T12:00:00Z'); assert.equal(loop.startDistanceKind,'straight-line');
});
test('nearby tiny street stub does not eclipse a useful separate footpath loop',()=>{
  const stub=way(8,[801,802],[p(0,0),p(150,0)],{name:'Named street stub',footway:'sidewalk'});
  const offers=offersFor([stub,...square(500,250,2)]); validOffers(offers);
  assert.equal(offers[0].routeMode,'loop'); assert.ok(offers.every(o=>o.lengthM>=650&&o.uniqueLengthM>=350));
});
test('true public loop ranks above named linear paths and sidewalk-heavy loops',()=>{
  const named=way(8,[801,802],[p(0,0),p(1500,0)],{name:'Important Trail'});
  const offers=offersFor([named,...square(500,250,2)]); validOffers(offers); assert.equal(offers[0].routeMode,'loop');
});
test('short or disconnected fragments produce a useful empty state, never a token walk',()=>{
  let offers=offersFor([way(1,[1,2],[p(0,0),p(150,0)])]);
  assert.equal(offers.length,0); assert.equal(offers.diagnostics.status,'no-useful-route');
  offers=offersFor([way(2,[1,2,3,4,5,6],[p(0,0),p(200,0),null,null,p(1000,0),p(1200,0)])]);
  assert.equal(offers.length,0);
});
test('sparse long ways produce exact on-segment out-and-back geometry with full distance',()=>{
  const offers=offersFor([way(1,[1,2],[p(0,0),p(15000,0)])]); validOffers(offers);
  assert.equal(offers[0].routeMode,'out-and-back'); assert.ok(Math.abs(offers[0].lengthM-2200)<3);
  assert.ok(offers[0].fallbackReason.includes('same paths')); assert.equal(offers[0].returnDistanceM,1100);
});
test('a trailhead is projected onto a real segment without drawing access from the player',()=>{
  const offers=offersFor(square(),p(-35,250)); validOffers(offers); const loop=offers[0];
  assert.equal(loop.routeMode,'loop'); assert.ok(Math.abs(loop.startDistM-35)<2);
  assert.ok(Math.abs(loop.points[0].lon-p(0,250).lon)<0.000001); assert.equal(loop.points[0].lat,53);
});
test('connected spur uses its real outward and home path and describes the repeated section',()=>{
  const offers=offersFor([...square(),way(8,[80,10],[p(-200,0),p(0,0)])],p(-200,0)); validOffers(offers);
  assert.equal(offers[0].routeMode,'loop'); assert.equal(offers[0].viaSpur,true); assert.ok(offers[0].lengthM>2350);
});
test('coincident coordinates with different OSM node IDs never invent a junction',()=>{
  const a=way(1,[1,2,3],[p(0,0),p(0,500),p(500,500)]);
  const b=way(2,[30,4,10],[p(500,500),p(500,0),p(0,0)]);
  const offers=offersFor([a,b]); validOffers(offers); assert.ok(offers.every(o=>o.routeMode==='out-and-back'));
});
test('overpasses crossing at different node identities remain disconnected',()=>{
  const a=way(1,[1,2,3],[p(0,0),p(500,500),p(1000,1000)],{bridge:'yes',layer:'1'});
  const b=way(2,[4,5,6],[p(0,1000),p(500,500),p(1000,0)],{layer:'0'});
  const offers=offersFor([a,b]); validOffers(offers); assert.ok(offers.every(o=>o.routeMode==='out-and-back'));
  assert.ok(offers.every(o=>o.routeEvidence.ways.length===1));
});
test('untagged hiking relation members cannot launder a private route',()=>{
  const w=square()[0]; w.tags.access='private';
  const rel={type:'relation',id:8,tags:{route:'hiking',name:'Restricted Trail'},members:[{type:'way',ref:1,geometry:w.geometry}]};
  assert.equal(offersFor([w,rel]).length,0);
});
test('foot access overrides general access; purpose and conditional restrictions are conservative',()=>{
  const allowed=core.classifyWay({highway:'footway',access:'no',foot:'yes'}); assert.equal(allowed.eligible,true);
  for(const access of ['no','private','customers','destination','delivery','permit','agricultural','forestry','military','unknown','discouraged'])
    assert.equal(core.classifyWay({highway:'footway',access}).eligible,false,access);
  for(const tags of [{'foot:conditional':'no @ (sunset-sunrise)'},{'access:conditional':'yes @ (Mo-Fr)'},{opening_hours:'08:00-18:00'}])
    assert.equal(core.classifyWay({highway:'footway',...tags}).eligible,false,JSON.stringify(tags));
  assert.equal(core.classifyWay({highway:'path',access:'private',foot:'permissive'}).eligible,true);
  assert.equal(core.classifyWay({highway:'path',access:'private',foot:'permissive'}).publicPath,false);
});
test('areas, technical hiking, private tracks and unverified cycleways are excluded',()=>{
  for(const tags of [{highway:'footway',area:'yes'},{highway:'path',sac_scale:'mountain_hiking'},{highway:'track'},{highway:'cycleway'},{highway:'footway',construction:'yes'}])
    assert.equal(core.classifyWay(tags).eligible,false,JSON.stringify(tags));
  assert.equal(core.classifyWay({highway:'cycleway',foot:'yes'}).eligible,true);
  assert.equal(core.classifyWay({highway:'track',designation:'public_footpath'}).eligible,true);
});
test('a restricted barrier splits the route even if the surrounding way has public tags',()=>{
  const gate={type:'node',id:11,...p(0,500),tags:{barrier:'gate',access:'private'}};
  const offers=offersFor([...square(),gate]); assert.ok(offers.every(o=>o.routeMode!=='loop'));
  for(const offer of offers) assert.ok(offer.routeEvidence.segments.every(s=>{const w=offer.routeEvidence.ways.find(w=>w.id===s.wayId);return ![w.nodes[s.index],w.nodes[s.index+1]].includes('11');}));
  const open={...gate,tags:{barrier:'gate',foot:'yes'}}; assert.equal(offersFor([...square(),open])[0].routeMode,'loop');
});
test('mapped pedestrian one-way direction is respected, including its return',()=>{
  const w=square()[0]; w.tags['oneway:foot']='yes'; const offers=offersFor([w]); validOffers(offers);
  assert.ok(offers.every(o=>o.routeMode==='loop'));
  for(const o of offers) assert.ok(o.routeEvidence.segments.every(s=>s.to>s.from));
});
test('saved rounding is accepted but replacement geometry and dishonest distance are rejected',()=>{
  const offer=offersFor(square())[0]; const quest={...offer,route:offer.points.map(p=>[+p.lat.toFixed(6),+p.lon.toFixed(6)])};
  assert.equal(core.validateQuest(quest).valid,true);
  const moved=structuredClone(quest); moved.route[1][1]+=0.001; assert.equal(core.validateQuest(moved).reason,'route-evidence-mismatch');
  assert.equal(core.validateOffer({...offer,lengthM:100}).reason,'route-distance-mismatch');
  const broken=structuredClone(offer); broken.routeEvidence.segments[1].from=0.2;
  assert.equal(core.validateOffer(broken).reason,'disconnected-route');
  assert.equal(core.validateQuest({...quest,checkpoints:[{kind:'flag',...p(250,250)}]}).reason,'checkpoint-off-route');
  assert.equal(core.validateQuest({...quest,checkpoints:[{kind:'flag',...p(0,250)}]}).valid,true);
});
test('incomplete provider data and missing topology never become verified offers',()=>{
  const partial=osm(square()); partial.remark='runtime error: Query timed out';
  const offers=core.parseOffers(partial,53,-2); assert.equal(offers.length,0); assert.equal(offers.diagnostics.status,'data-incomplete');
  const untagged=square()[0]; delete untagged.nodes; assert.equal(offersFor([untagged]).length,0);
});
test('queries request full tagged way geometry and node barriers without geometry clipping',()=>{
  const query=core.buildOverpassQuery(53,-2,3000);
  assert.ok(query.includes('node(w.paths)')); assert.ok(query.includes('out body geom;')); assert.ok(!query.includes('out geom('));
  assert.throws(()=>core.buildOverpassQuery(NaN,-2));
});
test('dense city-scale network remains bounded and returns useful loops',()=>{
  const rows=40,els=[]; let id=0;
  const nid=(r,c)=>r*rows+c+1;
  for(let r=0;r<rows;r++) for(let c=0;c<rows;c++) {
    if(c+1<rows) els.push(way(++id,[nid(r,c),nid(r,c+1)],[p(r*40,c*40),p(r*40,(c+1)*40)]));
    if(r+1<rows) els.push(way(++id,[nid(r,c),nid(r+1,c)],[p(r*40,c*40),p((r+1)*40,c*40)]));
  }
  // Provider CPU guard refuses an oversized response rather than silently
  // routing on an arbitrary first slice of its ways.
  const started=performance.now(); const offers=offersFor(Array.from({length:core.LIMITS.ways+1},(_,i)=>({...els[0],id:i})));
  assert.equal(offers.length,0); assert.equal(offers.diagnostics.status,'data-incomplete'); assert.ok(performance.now()-started<1500);
  const compact=[]; for(let r=0;r<rows;r++) compact.push(way(++id,Array.from({length:rows},(_,c)=>nid(r,c)),Array.from({length:rows},(_,c)=>p(r*40,c*40))));
  for(let c=0;c<rows;c++) compact.push(way(++id,Array.from({length:rows},(_,r)=>nid(r,c)),Array.from({length:rows},(_,r)=>p(r*40,c*40))));
  const t=performance.now();const result=offersFor(compact);validOffers(result);assert.equal(result[0].routeMode,'loop');assert.ok(performance.now()-t<2000);
});
