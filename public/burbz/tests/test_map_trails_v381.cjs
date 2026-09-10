const {test}=require('node:test'),assert=require('node:assert/strict');
const trail=require('../map_trail_core.js');global.window=global;require(process.env.QUEST_CORE_TEST_PATH||'../quest_core.js');const core=BurbzQuestCore;
const here={lat:53.003,lon:-1},fix={...here,accuracy:8,at:1000000};
function quest(){return {id:'walk',routeSchemaVersion:1,routeCertification:{status:'certified'},route:[[53,-1],[53.003,-1],[53.005,-1]],distanceWalkedM:200,chestsOpened:0,checkpoints:[{kind:'flag',lat:53,lon:-1,reached:false},{kind:'chest',...here,reached:false},{kind:'finish',lat:53.005,lon:-1,reached:false}]};}
test('11 m and the full 45 m unlock chest intents despite an earlier flag; no reward or route skip',()=>{
 for(const radius of [0,11,44.99]){const q=quest(),p=trail.destination(here,0,radius),events=core.questProcessFix(q,p.lat,p.lon,8,1000000);assert.equal(core.questReachRadiusM(q,1),45);assert.equal(events.filter(e=>e.type==='chest').length,1);assert.equal(q.chestsOpened,0);assert(q.checkpoints.every(p=>!p.reached));}
 for(const radius of [45.01,90,185]){const q=quest(),p=trail.destination(here,0,radius);assert(!core.questProcessFix(q,p.lat,p.lon,8,1000000).some(e=>e.type==='chest'));}
 const q=quest();q.routeSchemaVersion=undefined;assert.equal(core.questReachRadiusM(q,1),45);q.checkpoints[0].lat=here.lat+.0001;assert.equal(core.questReachRadiusM(q,1),45,'nearby markers cannot shrink chest range');
});
test('bad fixes and completed chests never produce claim intents',()=>{
 for(const accuracy of [NaN,undefined,-1,61,500])assert(!core.questProcessFix(quest(),here.lat,here.lon,accuracy,1000000).some(e=>e.type==='chest'));
 const q=quest();q.checkpoints[1].reached=true;assert(!core.questProcessFix(q,here.lat,here.lon,8,1000000).some(e=>e.type==='chest'));
});
test('gathering uses the yellow circle, requires a fresh accurate GPS fix and handles every compass direction',()=>{
 for(const lat of [-60,0,53,80])for(let angle=0;angle<6.2;angle+=.5){const f={...fix,lat};assert(trail.gathering(trail.destination(f,angle,184.9),f,1000000).ready);assert(!trail.gathering(trail.destination(f,angle,185.1),f,1000000).ready);for(const [lon,lat] of trail.circle(f).geometry.coordinates[0])assert(Math.abs(trail.distance(f,{lat,lon})-185)<.00001);}
 for(const f of [null,{...fix,at:undefined},{...fix,at:1},{...fix,at:1020000},{...fix,accuracy:61},{...fix,accuracy:NaN},{...fix,lat:NaN}])assert(!trail.gathering(here,f,1000000).ready);
});
test('two physical route edges are six metres each side without changing saved coordinates',()=>{
 for(const lat of [0,53,80]){const route=[[lat,-1],[lat+.001,-1],[lat+.002,-1]],before=JSON.stringify(route),edges=trail.corridor(route);assert.equal(edges.length,2);assert.equal(JSON.stringify(route),before);for(const edge of edges)edge.geometry.coordinates.forEach(([lon,l],i)=>assert(Math.abs(trail.distance({lat:route[i][0],lon:-1},{lat:l,lon})-6)<.00001));assert(edges[0].geometry.coordinates[1][0]>-1);assert(edges[1].geometry.coordinates[1][0]<-1);}
 for(const route of [[[53,0],[53,0],[53.001,0],[53,0]],[[0,179.999],[0,-179.999]],[[53,0],[53.001,0],[53.001,.001]]])for(const edge of trail.corridor(route)){const ps=edge.geometry.coordinates;assert(ps.flat().every(Number.isFinite));assert(ps.slice(1).every((p,i)=>Math.abs(p[0]-ps[i][0])<1));}
 assert.deepEqual(trail.corridor([[NaN,0],[53,0]]),[]);assert.deepEqual(trail.corridor([[53,0],[53,0]]),[]);
});
test('building models stay at checkpoint/tavern coordinates and follow saved route corrections',()=>{
 const q=quest();q.trailTavern={lat:53.002,lon:-1,name:'The Wren'};const encounters=[{id:'lantern-post',artKey:'lantern-post',kind:'building',checkpointIndex:1},{id:'wayfarer-rest',kind:'building',checkpointIndex:0}];const before=JSON.stringify(q),rows=trail.buildings(q,encounters);assert.equal(rows.length,3);assert.deepEqual(rows.map(r=>r.type),['lantern-post','trail-shelter','tavern']);assert.equal(rows[0].lat,q.checkpoints[1].lat);assert.equal(rows[2].lat,q.trailTavern.lat);assert.equal(JSON.stringify(q),before);q.checkpoints[1].lat+=.001;assert.equal(trail.buildings(q,encounters)[0].lat,q.checkpoints[1].lat);q.completedAt=1;assert.deepEqual(trail.buildings(q,encounters),[]);
});
test('the three building types contain finite volumetric meshes and distinct geometry',()=>{
 global.THREE=require('../lib/three.min.js');require('../settlement_models.js');require('../geographic_details_scene.js');const lengths=[];
 for(const type of ['lantern-post','trail-shelter','tavern']){const data=BurbzGeographicDetailsScene.geometry(type,42);assert(data.every(Number.isFinite));assert(data.length>1000);const bounds=[0,1,2].map(k=>{const values=[];for(let i=k;i<data.length;i+=9)values.push(data[i]);return Math.max(...values)-Math.min(...values);});assert(bounds.every(n=>n>.5));lengths.push(data.length);}
 assert.equal(new Set(lengths).size,3);
});
test('automatic GPS callback displays but cannot reward stale, future or inaccurate fixes',()=>{
 const fs=require('node:fs'),vm=require('node:vm'),html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),start=html.indexOf('function handleLivePosition('),end=html.indexOf('let liveMapLastSpawnFetch',start),source=html.slice(start,end);
 const sandbox={Number,console,liveMapUserMoved:false,validLivePosition:()=>true,rememberHomeFix:()=>{},updateLiveMapPosition:()=>{},quests:0,sides:0,questOnPositionFix:()=>sandbox.quests++,sideQuestOnPositionFix:()=>sandbox.sides++,mapGatheringGate:p=>trail.gathering(p,sandbox.liveMapLastPosition)};vm.createContext(sandbox);vm.runInContext(source,sandbox);
 for(const [timestamp,accuracy] of [[1,8],[Date.now()+60000,8],[Date.now(),80],[undefined,8]]){sandbox.handleLivePosition({coords:{latitude:53,longitude:-1,accuracy},timestamp},false);assert.equal(sandbox.quests,0);assert.equal(sandbox.sides,0);}
 sandbox.handleLivePosition({coords:{latitude:53,longitude:-1,accuracy:8},timestamp:Date.now()},false);assert.equal(sandbox.quests,1);assert.equal(sandbox.sides,1);
});
