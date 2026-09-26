/* Walk planner v495: checkpoints between the start and the destination.
 * The game fills each leg: footpaths first, then pavements and roads.
 * Run: node --test tests/test_walk_planner_v495.cjs
 */
'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),R=require('../destination_route_core.js');
const p=(x,y=0)=>({lat:51.5+y/111320,lon:-.17+x/(111320*Math.cos(51.5*Math.PI/180))});
function osm(specs){const nodes=new Map(),ways=specs.map(([id,ids,points,tags={}])=>{ids.forEach((n,i)=>nodes.set(n,{type:'node',id:n,...points[i]}));return{type:'way',id,nodes:ids,geometry:points,tags:{highway:'footway',foot:'yes',...tags}};});return{elements:[...nodes.values(),...ways]};}
const near=(route,q)=>Math.min(...route.points.map(x=>R.distance(x,q)));
function valid(result,start,end){assert.equal(result.ok,true,JSON.stringify(result.error));const r=result.route;assert.equal(R.validateDestinationRoute(r).valid,true,JSON.stringify(R.validateDestinationRoute(r)));assert.equal(R.validateDestinationRoute(JSON.parse(JSON.stringify(r))).valid,true);assert(R.distance(r.points[0],start)<.01);assert(R.distance(r.points.at(-1),end)<.01);return r;}
// A straight footway with a loop to the north through (500,300).
const loop=()=>osm([[1,[1,2,3],[p(0),p(300),p(700)]],[2,[3,4],[p(700),p(1000)]],[3,[2,5,3],[p(300),p(500,300),p(700)]]]);

test('no checkpoint: the walk takes the straight footway',()=>{const r=valid(R.planDestinationRoute(loop(),p(0),p(1000)),p(0),p(1000));assert(Math.abs(r.lengthM-1000)<3);assert.equal(r.checkpoints,undefined);});

test('a checkpoint near a path pulls the walk along that path, with no dashed gaps',()=>{
 const cp=p(500,305),r=valid(R.planDestinationRoute(loop(),p(0),p(1000),{via:[cp]}),p(0),p(1000));
 assert.equal(r.routeSchemaVersion,2);assert.equal(r.networkVerified,true);assert.equal(r.guidanceDistanceM,0);
 assert(r.routeEvidence.parts.every(x=>x.kind==='mapped'));assert(near(r,p(500,300))<1,'passes the loop top');
 assert(r.lengthM>1300,'walks the loop, not the straight path: '+r.lengthM);assert.deepEqual(r.checkpoints,[cp]);
});

test('checkpoints are visited in the order the player placed them',()=>{
 const net=osm([[1,[1,2,3,4],[p(0),p(400),p(800),p(1200)]]]),a=p(800),b=p(400),r=valid(R.planDestinationRoute(net,p(0),p(1200),{via:[a,b]}),p(0),p(1200));
 const first=q=>r.points.findIndex(x=>R.distance(x,q)<1),lastAt=q=>r.points.map(x=>R.distance(x,q)<1).lastIndexOf(true);assert(first(a)>=0&&lastAt(b)>first(a),'goes to 800 m, back to 400 m, then on');assert(Math.abs(r.lengthM-2000)<4);
});

test('footpaths win over roads when both reach the next stop',()=>{
 const net=osm([[1,[1,2],[p(0),p(1000)],{highway:'residential',foot:undefined}],[2,[1,3,2],[p(0),p(500,150),p(1000)]]]);
 const r=valid(R.planDestinationRoute(net,p(0),p(1000)),p(0),p(1000));assert.deepEqual([...new Set(r.routeEvidence.segments.map(s=>s.wayId))],['2']);
});

test('where no footpath goes, the walk uses pavements and roads',()=>{
 const net=osm([[1,[1,2],[p(0),p(500)]],[2,[2,3],[p(500),p(500,400)],{highway:'residential',foot:undefined}],[3,[3,4],[p(500,400),p(1000,400)],{highway:'footway',footway:'sidewalk',foot:undefined}]]);
 const r=valid(R.planDestinationRoute(net,p(0),p(1000,400),{via:[p(500,200)]}),p(0),p(1000,400));assert.equal(r.networkVerified,true);
 const kinds=r.routeEvidence.parts.flatMap(x=>x.route.routeEvidence.segments.map(s=>s.access.highway));assert(kinds.includes('residential')&&kinds.includes('footway'));
});

test('a checkpoint far from any path gets a dashed side trip to its exact spot',()=>{
 const cp=p(500,200),r=valid(R.planDestinationRoute(osm([[1,[1,2,3],[p(0),p(500),p(1000)]]]),p(0),p(1000),{via:[cp]}),p(0),p(1000));
 assert(near(r,cp)<.01);assert(r.guidanceDistanceM>=390&&r.guidanceDistanceM<=410,String(r.guidanceDistanceM));assert.equal(r.networkVerified,false);
});

test('with no map data the walk still joins every checkpoint in order',()=>{
 const via=[p(300,100),p(600,-100)],r=valid(R.planDestinationRoute(null,p(0),p(900),{via}),p(0),p(900));
 assert.deepEqual(r.points.map(x=>[+x.lat.toFixed(7),+x.lon.toFixed(7)]),[p(0),...via,p(900)].map(x=>[+x.lat.toFixed(7),+x.lon.toFixed(7)]));assert.equal(r.checkpoints.length,2);
});

test('duplicates are dropped and at most eight checkpoints are kept',()=>{
 const via=[p(100),p(102),...Array.from({length:12},(_,i)=>p(200+i*50,50))],r=valid(R.planDestinationRoute(null,p(0),p(1000),{via}),p(0),p(1000));assert.equal(r.checkpoints.length,8);assert(R.distance(r.checkpoints[0],p(100))<.01&&R.distance(r.checkpoints[1],p(200,50))<.01);
});

test('the map search box covers every checkpoint',()=>{
 const box=R.bboxFor(p(0),p(100),{via:[p(50,2000)],queryPaddingM:0});assert(box.north>=p(50,2000).lat-1e-9);
 assert.match(R.buildDestinationOverpassQuery(p(0),p(100),{via:[p(50,2000)],queryPaddingM:0}),new RegExp(p(50,2000).lat.toFixed(6)));
});

test('fetch sends one map request over all stops and returns the checkpoint walk',async()=>{
 const bodies=[];const fetchFn=async(url,init)=>{bodies.push(decodeURIComponent(String(init.body||'')));return{ok:true,status:200,text:async()=>JSON.stringify(loop())};};
 const r=valid(await R.fetchDestinationRoute(p(0),p(1000),{via:[p(500,305)],fetchFn,endpoints:['https://fixture.test'],mapApiFallback:false}),p(0),p(1000));
 assert.equal(bodies.length,1);assert(near(r,p(500,300))<1);assert.equal(r.checkpoints.length,1);
});

// ---- The planner screen ----
const fs=require('node:fs'),path=require('node:path'),UI=require('../destination_quest_ui.js'),S=require('../destination_state_core.js');
const read=name=>fs.readFileSync(path.join(__dirname,'..',name),'utf8');
function fakeDoc(){
 class El{constructor(){this.dataset={};this.attrs={};this.isConnected=true;const c=this.cls=new Set();this.classList={add:v=>c.add(v),remove:v=>c.delete(v),contains:v=>c.has(v),toggle:(v,on)=>on?c.add(v):c.delete(v)};}
  setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}appendChild(n){n.isConnected=true;}remove(){this.isConnected=false;}
  set innerHTML(v){this.html=v;}get innerHTML(){return this.html;}querySelector(){return null;}querySelectorAll(){return[];}addEventListener(){}removeEventListener(){}focus(){}}
 const doc=new El();doc.body=new El();doc.createElement=()=>new El();doc.getElementById=()=>null;return doc;
}
let lastSheet=null;
function sheetHtml(){return lastSheet&&lastSheet.html||'';}
const pressed=(html,attr)=>{const m=html.match(new RegExp('<button[^>]*'+attr.replace(/[[\]"]/g,'\\$&')+'[^>]*>'));return m?/aria-pressed="true"/.test(m[0])&&/is-chosen/.test(m[0]):null;};
function open(extra={}){const doc=fakeDoc();const make=doc.createElement;doc.createElement=()=>(lastSheet=make());const state={};
 const c=UI.attach(Object.assign({document:doc,rootState:()=>state,stateCore:S,routeCore:{fetchDestinationRoute:async()=>({ok:false,error:{code:'offline',message:'offline'}})},rewardCore:{quoteDestinationReward:()=>({})}},extra));c.openPlanner();return c;}

test('the screen wears the Home look: Plan a walk, three steps, a gold Start walk button',()=>{
 const c=open();const html=sheetHtml();
 assert.match(html,/Plan a walk/);assert.match(html,/data-step="start"/);assert.match(html,/data-step="checkpoints"/);assert.match(html,/data-step="end"/);
 assert.match(html,/class="dq-go" data-destination-begin disabled/);assert.match(html,/Press a button to set your start/);
 assert.doesNotMatch(html,/Use precise GPS|Tap start on map|Plan a destination walk/);c.dispose();
});

test('My location stays lit once it sets the start; Tap the map takes over when used',()=>{
 const c=open({getPrecisePosition:()=>({lat:54.45,lon:-2.65,accuracy:6,precise:true,source:'Your live position'})});
 let html=sheetHtml();assert.equal(pressed(html,'data-destination-gps'),true,'GPS lit');assert.equal(pressed(html,'data-destination-pick="start"'),false);
 assert.match(html,/Your location/);assert.match(html,/54\.45000, -2\.65000/);assert.match(html,/dq-choice-tick/);
 c.render();html=sheetHtml();assert.equal(pressed(html,'data-destination-gps'),true,'still lit after a redraw');
 c.setMapStart(54.451,-2.651);c.render();html=sheetHtml();
 assert.equal(pressed(html,'data-destination-gps'),false);assert.equal(pressed(html,'data-destination-pick="start"'),true,'map lit');assert.match(html,/Picked on the map/);
 assert.match(html,/is-next[^>]*data-destination-pick="end"|data-destination-pick="end"[^>]*is-next|class="dq-choice is-next" data-destination-pick="end"/,'destination glows as the next step');c.dispose();
});

test('My location asks the phone for a fresh fix when the last one is stale',async()=>{
 let asked=0;const toasts=[];const c=open({getPrecisePosition:()=>null,showToast:m=>toasts.push(m),requestPrecisePosition:async()=>{asked++;return{lat:54.45,lon:-2.65,accuracy:9,precise:true,source:'Your live position'};}});
 assert.equal(c.state().start,null);c.useMyLocation();assert.match(sheetHtml(),/Finding you…/);
 await new Promise(r=>setTimeout(r,0));assert.equal(asked,1);assert.equal(c.state().start.lat,54.45);assert.equal(pressed(sheetHtml(),'data-destination-gps'),true);assert.deepEqual(toasts,[]);c.dispose();
 const failed=open({getPrecisePosition:()=>null,showToast:m=>toasts.push(m),requestPrecisePosition:async()=>{throw new Error('denied');}});
 failed.useMyLocation();await new Promise(r=>setTimeout(r,0));assert.equal(failed.state().start,null);assert.match(toasts.at(-1),/Allow location, or tap the map/);
 assert.equal(pressed(sheetHtml(),'data-destination-gps'),false);assert.match(read('index.html'),/requestPrecisePosition:destinationRequestPrecisePosition/);failed.dispose();
});

test('checkpoints list in order, can be removed, and stop at eight',()=>{
 const c=open();c.setMapStart(54.45,-2.65);
 assert.equal(c.addCheckpoint(54.451,-2.649).ok,true);assert.equal(c.addCheckpoint(54.452,-2.648).ok,true);c.render();let html=sheetHtml();
 assert.match(html,/2 checkpoints/);assert.equal((html.match(/data-destination-remove-checkpoint="/g)||[]).length,2);assert.match(html,/<b>1<\/b><span>54\.45100, -2\.64900/);
 assert.equal(c.removeCheckpoint(0).ok,true);c.render();html=sheetHtml();assert.match(html,/1 checkpoint</);assert.match(html,/<b>1<\/b><span>54\.45200, -2\.64800/);
 for(let i=0;i<7;i++)assert.equal(c.addCheckpoint(54.46+i*.001,-2.64).ok,true);
 const ninth=c.addCheckpoint(54.5,-2.6);assert.equal(ninth.ok,false);assert.equal(ninth.error.code,'checkpoint-limit');c.render();assert.match(sheetHtml(),/data-destination-pick="checkpoint" disabled/);c.dispose();
});

test('preview sends the checkpoints to the route engine in order',async()=>{
 const calls=[];const c=open({routeCore:{fetchDestinationRoute:async(a,b,o)=>{calls.push(o.via);return{ok:false,error:{code:'x',message:'x'}};}}});
 c.setMapStart(54.45,-2.65);c.addCheckpoint(54.455,-2.645);c.addCheckpoint(54.456,-2.644);c.setMapEnd(54.46,-2.64);await c.preview();
 assert.deepEqual(calls[0],[{lat:54.455,lon:-2.645},{lat:54.456,lon:-2.644}]);c.dispose();
});

test('with both ends set, one row of chips keeps the route in view',()=>{
 const c=open({getPrecisePosition:()=>({lat:54.45,lon:-2.65,accuracy:6,precise:true})});c.setMapEnd(54.46,-2.64);c.render();const html=sheetHtml();
 assert.match(html,/class="dq-strip"/);assert.match(html,/My location/);assert.match(html,/On the map/);assert.doesNotMatch(html,/data-step="start"/);c.dispose();
});

test('stylesheet: charcoal boxes, muted gold edges, lit gold choice, glowing gold main button',()=>{
 const css=read('destination_quest_ui.css');
 assert.match(css,/\.destination-quest-panel \{[^}]*background: #141517/);assert.match(css,/\.destination-sheet-head \{[^}]*background: #282725/);
 assert.match(css,/\.dq-step \{[^}]*background: #1d1e20/);assert.match(css,/\.dq-choice\.is-chosen \{[^}]*border-color: #f2cf73/);
 assert.match(css,/\.dq-go \{[^}]*linear-gradient\(180deg, #f7dc8c 0%, #d9a93e 55%, #b9832a 100%\)/);assert.match(css,/font: 800 22px\/1\.05 Rajdhani/);
 assert.doesNotMatch(css,/#322516|#19120b|#684d27/,'the old brown gradients are gone');
});

test('v495 ships together: build marker, cache and every changed file pinned in each worker list',()=>{
 const html=read('index.html'),sw=read('sw.js'),BUILD='walk-planner-v495-20260926';
 assert.ok(html.includes("const BURBZ_BUILD = '"+BUILD+"';"));assert.ok(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].endsWith('-'+BUILD));
 for(const file of ['destination_route_core.js','destination_quest_ui.js','destination_quest_ui.css']){const pin=file+'?v='+BUILD;assert.ok(html.includes(pin),pin);assert.equal(sw.split("'./"+pin+"'").length-1,3,pin+' in every worker list');}
});
