'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const M=require('../empire_map_core.js'),G=require('../geographic_world_core.js'),W=require('../wilderness_combat_core.js'),O=require('../enemy_outposts_core.js'),B=require('../battle_core.js'),L=require('../loot_crafting_core.js'),C=require('../first_person_spell_core.js');
let checks=0;function test(name,fn){fn();checks++;console.log('PASS',name);}
const geo=(lat,lon,bearing,m)=>{const [lng,y]=M.destination(lat,lon,bearing,m);return {lat:y,lon:((lng+540)%360)-180};};
const distance=(a,b)=>G.distance(a,b)*M.EARTH_RADIUS_M/(40075016.68557849/(2*Math.PI));
test('Canonical circles include their entire daylight rim, union overlaps, and stay geographic across dateline/poles',()=>{
 for(const centre of [{lat:54.45,lon:-2.65},{lat:0,lon:179.9998},{lat:84.8,lon:-179.9998}]){
  const light=M.createTerritoryLight([{...centre,radius:80,kind:'camp'},{...geo(centre.lat,centre.lon,Math.PI/2,130),radius:80,kind:'outpost'}]);
  assert(light.contains(centre));assert(light.contains(geo(centre.lat,centre.lon,0,79.999)));assert(!light.contains(geo(centre.lat,centre.lon,0,80.01)));
  assert(light.contains(geo(centre.lat,centre.lon,Math.PI/2,105)));const a=geo(centre.lat,centre.lon,-Math.PI/2,100),b=geo(centre.lat,centre.lon,Math.PI/2,300);
  const t=light.firstHit(a,b);assert(t>0.0499&&t<.0501,t);assert.equal(light.firstHit(centre,b),0);
 }
 const empty=M.createTerritoryLight([{lat:null,lon:0,radius:80},{lat:0,lon:0,radius:NaN}]);assert.equal(empty.circles.length,0);assert.equal(empty.firstHit({lat:NaN,lon:0},{lat:0,lon:0}),0);
});
test('Segment queries catch thin daylight between dark endpoints without per-frame full-map derivation',()=>{
 const circle={lat:0,lon:0,radius:80},light=M.createTerritoryLight([circle]);
 const a=geo(0,0,-Math.PI/2,100),b=geo(0,0,Math.PI/2,100);assert(!light.contains(a)&&!light.contains(b));assert(Math.abs(light.firstHit(a,b)-.1)<.00001);
 // An almost tangent 0.03 m sliver is smaller than the old 0.16 m samples.
 const north=geo(0,0,0,79.999999),left=geo(north.lat,north.lon,-Math.PI/2,1),right=geo(north.lat,north.lon,Math.PI/2,1);assert(!light.contains(left)&&!light.contains(right));assert.notEqual(light.firstHit(left,right),null);
 const rows=Array.from({length:10000},(_,i)=>({lat:-80+(i%16000)*.01,lon:-170+(i%30000)*.01,radius:80}));rows.push(circle);const many=M.createTerritoryLight(rows);
 for(let i=0;i<100;i++){assert(many.contains({lat:0,lon:0}));assert(Math.abs(many.firstHit(a,b)-.1)<.00001);}assert.equal(many.circles.length,10001);
});
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function fn(name){const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+10);assert(start>=0&&end>start,name);return html.slice(start,end);}
function app(){const c={structuredClone,JSON,Number,Object,Math,String,Array,Date,console,Map,Set,WeakSet,gameState:{player:{},empire:{villages:[],regions:[]},exploration:{camps:[]}},BurbzEnemyOutpostsCore:O,BurbzGeographicWorldCore:G,window:{BurbzEmpireMapCore:M},EMPIRE_TERRITORY_RADIUS_M:2200,empireTerritoryLightCache:null,empireMappableVillages:()=>c.gameState.empire.villages,empireVillageTerritoryRadiusM:v=>v===2?6000:2200,realmCore:()=>({regionCoverageRadiusKm:r=>r.radiusKm}),empireRegionsInfo:()=>({regions:c.gameState.empire.regions}),queueCloudSave(){},queueActionBadgeUpdate(){},setTimeout:()=>0,localStorage:{getItem:()=>null,setItem:(k,v)=>{if(c.fail)throw Error('quota');c.raw=v;}}};vm.createContext(c);vm.runInContext(['snapshotGameState','restoreStateTree','restoreGameStateSnapshot','durableSaveState','invalidateEmpireTerritoryLight','empireTerritoryLight','enemyOutpostDark'].map(fn).join('\n'),c);return c;}
test('Atlas and hostile placement use one saved source; scout half-light grants no invulnerability',()=>{
 const c=app();c.gameState.empire.villages=[{seed:1,lat:1,lon:1},{seed:2,lat:2,lon:2}];c.gameState.empire.regions=[{id:'county',centroid:{lat:3,lon:3},radiusKm:20}];c.gameState.exploration.camps=[{id:'tent',lat:4,lon:4,lightRadiusM:60}];const camp=O.nearby({lat:5,lon:5})[0];c.gameState.enemyOutposts=O.empty();O.discover(c.gameState.enemyOutposts,camp,0);O.damage(c.gameState.enemyOutposts,[0,1,2].map(member=>({campId:camp.id,id:camp.id+':guard:'+member,member,hp:0})),0);
 const light=c.empireTerritoryLight();assert.equal(light.circles.length,5);assert.equal(light.circles.find(r=>r.id==='village:2').radius,6000);assert.equal(light.circles.find(r=>r.kind==='region').radius,20000);
 for(const row of light.circles){assert(light.contains(geo(row.lat,row.lon,0,row.radius-1)));assert(!c.enemyOutpostDark(row));}
 c.empirePlayerPosition=()=>({lat:50,lon:50});assert(c.enemyOutpostDark(c.empirePlayerPosition()));assert.equal(c.empireTerritoryLight(),light,'reads reuse snapshot');c.durableSaveState();assert.equal(c.empireTerritoryLight(),light,'unrelated saves do not rebuild the spatial index');
 const fog=fn('updateEmpireFogMask');assert(fog.includes('empireTerritoryLight().circles'));assert(fog.includes('empirePlayerPosition()'));assert(!fog.includes('BurbzEnemyOutpostsCore.receipts'));
});
test('Save revalidation shares one settlement-tier derivation and preserves promoted daylight radii',()=>{
 const c=app(),R=require('../empire_realm_core.js');let derivations=0,tier='village';c.realmCore=()=>R;c.empireRegionsInfo=()=>({regions:[]});c.empireSettlementsInfo=()=>{derivations++;return{tierBySeed:{1:{tier}}};};c.empireSettlementOfSeed=()=>({tier});
 c.gameState.empire.villages=[{seed:1,lat:54,lon:-2}];vm.runInContext(fn('empireVillageTerritoryRadiusM'),c);
 for(const next of ['village','town','city']){tier=next;const previous=derivations;c.durableSaveState();const light=c.empireTerritoryLight();assert.equal(derivations,previous+1);assert.equal(light.circles[0].radius,R.settlementTierInfo(tier).territoryRadiusM);assert.equal(light.circles[0].radius,c.empireVillageTerritoryRadiusM(1));}
});
test('Durable lighting updates, failed placement rollback, stale identity and JSON reload keep one truth',()=>{
 const c=app(),point={lat:54.45,lon:-2.65},before=c.snapshotGameState(),dark=c.empireTerritoryLight();assert(!dark.contains(point));
 c.gameState.exploration.camps.push({id:'tent',...point,lightRadiusM:60});c.fail=true;assert.throws(()=>c.durableSaveState({throwOnFailure:true}));c.restoreGameStateSnapshot(before);assert(!c.empireTerritoryLight().contains(point));
 c.fail=false;c.gameState.exploration.camps.push({id:'tent',...point,lightRadiusM:60});assert(c.durableSaveState().ok);assert(c.empireTerritoryLight().contains(point));assert.notEqual(c.empireTerritoryLight(),dark);
 c.gameState=JSON.parse(c.raw);assert(c.empireTerritoryLight().contains(point));c.gameState=before;assert(!c.empireTerritoryLight().contains(point));
});
test('Combat conversion reads live origin after rebase and refuses missing geographic authority',()=>{
 let origin={lat:54.45,lon:-2.65};const point=G.unproject(origin,{x:500,y:0,z:100}),light=M.createTerritoryLight([{...point,radius:60}]),boundary=W.territoryBoundary({G,origin:()=>origin,light});
 assert(boundary.safeAt(500,100));assert(!boundary.safeAt(600,100));const previous=origin;origin=G.unproject(origin,{x:900,y:0,z:200});const p=G.project(origin,point);assert(boundary.safeAt(p.x,p.z));assert.equal(boundary.firstHit(p,p),0);assert(W.territoryBoundary({G,origin:()=>previous}).safeAt(600,100));
});
const pose={x:200,y:1.55,z:200,yaw:0,pitch:0};
function fixture({stored,spell='ember_wisp',save=()=>true,safe=()=>false,segment=()=>null}={}){const core=W.create({B,L,C,stored,kit:()=>({loadout:{weapon:'willow_wand',spell}}),ground:()=>0,safeAt:(x,z)=>safe({x,z}),safeSegment:segment,allowed:()=>true,clear:()=>true,walkClear:()=>true,save});core.begin(pose);core.cancel();return core;}
function target(c,id,x=200,z=192,hp=160){const fighter=B.buildFighter({id,species:'Crow',hp,maxHp:hp}),a={id,side:'opponent',fighter,position:{x,y:1.55,z},radius:.65,cr:0,age:0,home:{x,y:1.55,z}};c.actors.push(a);return a;}
const tick=(c,n=12,p=pose)=>{for(let i=0;i<n;i++)c.step(.05,p);};
test('Crossing into newly created light clears already released attacks without heal, defeat or XP',()=>{
 let lit=false,commits=[];const c=fixture({stored:{hp:23},safe:p=>lit&&p.x>=199,save:(r,e)=>commits.push(e)}),guard=target(c,'camp:guard');guard.campId='camp';guard.member=0;
 c.begin(pose);c.release(pose);assert.equal(c.engine.projectiles.length,1);lit=true;c.step(.05,pose);assert(c.inspect().safe);assert.equal(c.engine.projectiles.length,0);assert.equal(c.actors.length,0);assert.equal(c.inspect().hero.hp,23);assert.equal(guard.fighter.hp,160);assert(commits.every(e=>e.outpostHits.every(h=>h.hp>0)));
 assert(!c.begin(pose));lit=false;c.step(.05,pose);assert(!c.inspect().safe);assert.equal(c.inspect().hero.hp,23);
});
test('New light on target cancels in-flight damage even before another main combat step',()=>{
 let lit=false;const c=fixture({safe:p=>lit&&p.z<195}),guard=target(c,'guard');c.begin(pose);c.release(pose);lit=true;for(let i=0;i<15;i++)c.engine.step(.05);assert.equal(guard.fighter.hp,160);assert.equal(c.engine.projectiles.length,0);
});
test('Projectile and splash paths cannot bridge light between dark endpoints',()=>{
 const segment=(a,b)=>{const dz=b.z-a.z;if(!dz)return null;const t=(196-a.z)/dz;return t>=0&&t<=1?t:null;};const c=fixture({segment}),guard=target(c,'behind-light');c.begin(pose);c.release(pose);tick(c);assert.equal(guard.fighter.hp,160);assert.equal(c.engine.projectiles.length,0);
 const thin=(a,b)=>a.z<195&&b.z<195&&a.x<201&&b.x>201?Math.max(0,(201-a.x)/(b.x-a.x)):null;const splash=fixture({segment:thin});splash.setMode('spell');const a=target(splash,'primary'),b=target(splash,'splash',202,192);splash.begin(pose);splash.release(pose);tick(splash);assert(a.fighter.hp<160);assert.equal(b.fighter.hp,160);
});
test('Pursuit and telegraphed melee cannot cross light; elevated attacks share the same guard',()=>{
 let cut=false;const c=fixture({segment:(a,b)=>cut&&a.z!==b.z?0:null}),a=target(c,'chaser',200,197);cut=true;const before={...a.position};tick(c,10);assert.deepEqual(a.position,before);assert.equal(c.inspect().hero.hp,80);
 a.position={x:200,y:1.55,z:199};a.phase='windup';a.attackTime=.54;c.step(.05,pose);assert.equal(c.inspect().hero.hp,80);
 a.position.y=80;assert(!c.canHostileAttack(a.position,pose));assert(!c.hostileAttack(a,B.PECK));cut=false;a.position.y=1.55;assert(c.hostileAttack(a,B.PECK));assert(c.inspect().hero.hp<80);
});
test('Hostile resolution rollback preserves player HP and suppressing a live defender never writes zero',()=>{
 let fail=true,lit=false;const commits=[],c=fixture({safe:()=>lit,save:(r,e)=>{if(fail)return false;commits.push(e);return true;}}),a=target(c,'guard',200,199);a.campId='camp';a.member=0;
 assert(!c.hostileAttack(a,B.PECK));assert.equal(c.inspect().hero.hp,80);fail=false;lit=true;tick(c,1);c.checkpoint();assert.equal(c.actors.length,0);assert(commits.every(e=>e.outpostHits.length===0));assert.equal(c.inspect().hero.hp,80);
});
console.log(checks+' lit-territory safety groups passed');
