const assert=require('node:assert/strict');
const C=require('../player_home_core.js');
const old={version:2,intro:'done',tier:2,rooms:{library:true,conservatory:true,workshop:true},owned:{bench:1,rug:2,flowers:1},placed:[{id:4,item:'bench',area:'yard',x:4,z:4,turn:1},{id:7,item:'rug',area:'library',x:0,z:0,turn:0}],trees:{'tree-0':{day:C.dayKey(),hits:3}},finds:['lost-pot','library-story'],nextId:8};
const original=JSON.stringify(old),migrated=C.normalize(old);
assert.equal(migrated.version,3);assert.equal(migrated.anchor,null);assert.equal(JSON.stringify(old),original);
for(const key of ['intro','tier','rooms','owned','placed','trees','finds','nextId']){
 if(key==='owned')continue; // The catalogue normalizer includes all known zero-count designs.
 assert.deepEqual(migrated[key],old[key],key+' survives v2 migration');
}
const wallet={branches:17};
const seed={kind:'anchor',lat:52.4,lon:-2.1,source:'initial',expectedRevision:0};
const first=C.propose(migrated,wallet,seed);assert(first.ok);assert.equal(first.home.anchor.revision,1);
assert.deepEqual(first.wallet,wallet);assert.equal(migrated.anchor,null);
assert(!C.propose(first.home,wallet,{...seed,expectedRevision:1,lon:10}).ok,'late GPS cannot move an established home');
assert(!C.propose(first.home,wallet,{...seed,source:'chosen',expectedRevision:0}).ok,'stale picker cannot replace a newer anchor');
const move={kind:'anchor',lat:-33.8,lon:151.2,source:'chosen',expectedRevision:1};
const second=C.propose(first.home,wallet,move);assert(second.ok);assert.equal(second.home.anchor.revision,2);assert.deepEqual(second.wallet,wallet);
for(const key of Object.keys(first.home).filter(k=>k!=='anchor'))assert.deepEqual(second.home[key],first.home[key],key+' stays unchanged on relocation');
assert.equal(C.treeState(second.home,'tree-0'),3,'moving the house never replenishes its daily tree reward');
assert.deepEqual(C.normalize(JSON.parse(JSON.stringify(second.home))),second.home);
for(const value of [null,{}, {lat:null,lon:0,source:'chosen',revision:1},{lat:'0',lon:0,source:'chosen',revision:1},{lat:0,lon:Infinity,source:'chosen',revision:1},{lat:90,lon:0,source:'chosen',revision:1},{lat:0,lon:181,source:'chosen',revision:1},{lat:0,lon:0,source:'chosen',revision:0},{lat:0,lon:0,source:'gps',revision:1}])assert.equal(C.normalizeAnchor(value),null);
assert(C.normalizeAnchor({lat:0,lon:0,source:'chosen',revision:1}),'zero coordinates are valid, never a missing-location fallback');
assert(C.propose(migrated,wallet,{...seed,lat:C.MAX_MAP_LAT,lon:180}).ok);
assert(!C.propose({...first.home,anchor:{...first.home.anchor,revision:Number.MAX_SAFE_INTEGER}},wallet,{...move,expectedRevision:Number.MAX_SAFE_INTEGER}).ok);
// The adapter owns atomic replacement: declining a proposal never mutates the
// original home or wallet, so failed durable saves can restore their identities.
assert.equal(first.home.anchor.lon,-2.1);assert.equal(wallet.branches,17);
const connected=C.world(second.home,'yard',Date.now(),{connected:true});
assert(connected.allowed(500,500),'no invisible clearing boundary in the geographic world');
assert(!connected.allowed(0,0),'the owned house remains solid');
assert(!connected.allowed(4,4),'the saved bench remains solid');
const spawn=connected.spawn();assert(connected.allowed(spawn.x,spawn.z));assert.equal(spawn.z,4);assert.equal(spawn.yaw,Math.PI);

const T=require('../lib/three.min.js');require('../settlement_models.js');require('../player_home_scene.js');
const view=BurbzPlayerHomeScene.createYardContent(T,second.home,{portrait:false});
assert(view.group.isGroup);assert(view.allowed(1000,-1000));assert(!view.allowed(0,0));assert.equal(view.entrance.z,4);
assert(view.targets.some(t=>t.kind==='home'&&t.id==='home-door'));
assert(!view.targets.some(t=>t.kind==='tree'&&t.id==='tree-0'),'saved stump remains felled after geographic relocation');
assert(view.targets.some(t=>t.kind==='find'&&t.id==='lost-pot'));
assert(view.solids.some(b=>b.id==='house'&&b.maxY>4));assert(view.solids.some(b=>b.id==='decoration:4'));
let lights=0,vertices=0,minY=Infinity;view.group.traverse(o=>{if(o.isLight)lights++;const p=o.geometry?.attributes.position;if(p)for(let i=0;i<p.count;i++){vertices++;minY=Math.min(minY,p.getY(i));}});
assert.equal(lights,0,'world owner supplies lighting');assert(vertices>1000&&vertices<100000,'same bounded modeled yard content');
const bounds=new T.Box3().setFromObject(view.group);assert(bounds.min.y>-.2,'no island cylinder underside or finite terrain rim');
const holder=new T.Group();holder.add(view.group);const geometries=new Set(),materials=new Set();let disposed=0;
view.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[])materials.add(m);});
for(const resource of [...geometries,...materials])resource.addEventListener('dispose',()=>disposed++);
view.dispose();assert.equal(view.group.children.length,0);assert.equal(holder.children.length,0);assert.equal(disposed,geometries.size+materials.size);
console.log('Connected home: v2 migration, atomic anchor proposals, stale-GPS/picker protection, relocation retention, unbounded yard collision, actual shared meshes and disposal pass.');

// Exercise the actual asynchronous controller handoff without WebGL or a DOM.
// A slow loader must neither reopen a closed session nor release its replacement.
const fs=require('node:fs'),vm=require('node:vm');
const controller=fs.readFileSync(require.resolve('../player_home.js'),'utf8');
const handoffSource=controller.slice(controller.indexOf('async function handoff('),controller.indexOf('\nfunction outside('));
function session(callback){const owner={busy:false,area:'library',mode:'room',player:{x:1,z:2,yaw:.8,pitch:.1},panel:{hidden:false},returnToWorld:false},messages=[],closed=[];
 const context={s:owner,api:{enterWorld:callback,chooseHomeLocation:callback},state:()=>second.home,reset:()=>{},notify:message=>messages.push(message),close:reason=>{closed.push(reason);context.s=null;return true;}};
 vm.createContext(context);vm.runInContext(handoffSource+'\nglobalThis.runHandoff=handoff;',context);
 return{context,owner,messages,closed};
}
(async()=>{
 let payload,resolve;const active=session(p=>{payload=p;return new Promise(r=>resolve=r);});
 const pending=active.context.runHandoff('world',{x:0,z:4,yaw:Math.PI,pitch:0});
 assert(active.owner.busy);assert(active.owner.panel.hidden);assert(payload.isCurrent());
 assert.equal(payload.returnOptions.start,'room');assert.equal(payload.returnOptions.options.area,'library');
 assert.equal(payload.localPose.z,4);assert.equal(payload.returnOptions.options.pose.x,1);
 assert(payload.release());assert.equal(payload.release(),false);assert.equal(payload.isCurrent(),false);resolve(true);await pending;
 assert.deepEqual(active.closed,['world']);
 const failed=session(async()=>{throw Error('Tiles unavailable');});await failed.context.runHandoff('world');
 assert.equal(failed.context.s,failed.owner);assert.equal(failed.owner.busy,false);assert.equal(failed.messages.at(-1),'Tiles unavailable');assert.equal(failed.closed.length,0);
 const stale=session(p=>{payload=p;return new Promise(r=>resolve=r);});const stalePending=stale.context.runHandoff('location');
 const replacement={busy:true};stale.context.s=replacement;assert.equal(payload.isCurrent(),false);assert.equal(payload.release(),false);resolve(false);await stalePending;
 assert.equal(stale.context.s,replacement);assert.equal(replacement.busy,true);assert.equal(stale.closed.length,0);
 console.log('Home handoff: exact room return, one release, failed loader recovery and stale asynchronous ownership checks pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
