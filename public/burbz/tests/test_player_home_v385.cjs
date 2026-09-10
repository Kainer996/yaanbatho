const assert=require('node:assert/strict'),crypto=require('node:crypto');
const C=require('../player_home_core.js');
const original={version:1,intro:'done',tier:1,owned:{bench:1,flowers:1,rug:3,books:1},placed:[{id:7,item:'bench',area:'yard',x:4,z:4,turn:1},{id:8,item:'books',area:'room',x:3,z:0,turn:0}],finds:['desk-note','lost-pot'],nextId:9};
const originalBytes=JSON.stringify(original),migrated=C.normalize(original);
assert.equal(JSON.stringify(original),originalBytes);assert.equal(migrated.version,3);assert.deepEqual(migrated.placed,original.placed);assert.deepEqual([...migrated.finds].sort(),[...original.finds].sort());assert.deepEqual(migrated.rooms,{});assert.deepEqual(migrated.trees,{});assert.equal(migrated.nextId,9);
assert(Object.keys(C.ITEMS).length>=32);assert.equal(new Set(Object.values(C.ITEMS).map(i=>i.type)).size,Object.keys(C.ITEMS).length);
for(const [old,radius] of [[16,C.YARD.ground],[14.3,C.YARD.walk],[10,C.YARD.decorate]])assert(Math.abs(radius**2/old**2-2)<1e-12);
assert(C.validPlacement(migrated,{item:'bench',area:'yard',x:12,z:0,turn:0}).ok);assert(!C.validPlacement(migrated,{item:'bench',area:'yard',x:16,z:0,turn:0}).ok);
const garden=C.world(migrated,'yard');assert(garden.allowed(19,0));assert(!garden.allowed(C.YARD.walk+.1,0));
assert(!C.propose(C.initial(true),{branches:100},{kind:'build-room',room:'library'}).ok);
assert(!C.propose(migrated,{branches:27},{kind:'build-room',room:'library'}).ok);
assert(!C.propose(migrated,{branches:100},{kind:'build-room',room:'fake'}).ok);
assert(!C.propose(migrated,{branches:100},{kind:'place',item:'rug',area:'library',x:0,z:0}).ok);
let home=migrated,wallet={branches:300};
for(const [id,room] of Object.entries(C.ROOMS)){
 const before=JSON.stringify(home),cash=wallet.branches,r=C.propose(home,wallet,{kind:'build-room',room:id});assert(r.ok);assert.equal(JSON.stringify(home),before);assert.equal(wallet.branches,cash);assert.equal(r.wallet.branches,cash-room.timber);home=r.home;wallet=r.wallet;
 assert(home.rooms[id]);assert(!C.propose(home,wallet,{kind:'build-room',room:id}).ok);
 const world=C.world(home,id),spawn=world.spawn();assert(world.allowed(spawn.x,spawn.z));for(let z=2.8;z>=-1.5;z-=.2)assert(world.allowed(0,z),id+' central approach');assert(!world.allowed(0,-2.8),id+' themed furniture collision');assert(!world.allowed(-2.9,-2.8));assert(!world.allowed(4,0));
 const r2=C.propose(home,wallet,{kind:'place',item:'rug',area:id,x:0,z:0});assert(r2.ok);home=r2.home;
 assert(C.propose(home,wallet,{kind:'find',id:id+'-story'}).ok);
}
assert.equal(home.placed.filter(p=>p.item==='rug').length,3);assert.equal(home.owned.books,1);assert.equal(C.available(home,'books'),1,'furniture displaced by the new passage is stored, not lost');assert(home.placed.some(p=>p.id===7));
for(const r of Object.values(C.ROOMS))for(let x=0;x<=3.6;x+=.2)assert(C.world(home,'room').allowed(x,r.doorZ),'built doorway stays reachable');
assert.deepEqual(C.normalize(JSON.parse(JSON.stringify(home))),home);
// Capacity is per space as well as global, including a move from another room.
let full=C.normalize({...home,owned:{...home.owned,rug:100},placed:[]});
for(const area of ['room','library','conservatory'])for(let n=0;n<32;n++){const r=C.propose(full,wallet,{kind:'place',item:'rug',area,x:0,z:0});assert(r.ok);full=r.home;}
assert.equal(full.placed.length,96);assert(!C.propose(full,wallet,{kind:'place',item:'rug',area:'workshop',x:0,z:0}).ok);assert(!C.propose(full,wallet,{kind:'place',id:full.placed[0].id,item:'rug',area:'library',x:0,z:0}).ok);
assert(C.propose(full,wallet,{kind:'place',id:full.placed[0].id,item:'rug',area:'room',x:.5,z:0}).ok);
// Three saved physical strikes, one atomic yield, and no duplicate payout.
const tree=C.TREES[0],action={kind:'chop',id:tree.id,area:'yard',x:tree.x+1,z:tree.z};let forest=C.normalize({...home,trees:{}}),purse={branches:10};
assert(!C.propose(forest,purse,{...action,area:'room'}).ok);assert(!C.propose(forest,purse,{...action,x:0,z:0}).ok);assert(!C.world(forest,'yard').allowed(tree.x,tree.z));
for(let hit=1;hit<=3;hit++){const before=JSON.stringify(forest),cash=purse.branches,r=C.propose(forest,purse,action);assert(r.ok);assert.equal(JSON.stringify(forest),before);assert.equal(purse.branches,cash);forest=C.normalize(JSON.parse(JSON.stringify(r.home)));purse=r.wallet;assert.equal(C.treeState(forest,tree.id),hit);assert.equal(purse.branches,hit<3?10:13);}
assert(C.world(forest,'yard').allowed(tree.x,tree.z));assert(!C.propose(forest,purse,action).ok);assert.equal(purse.branches,13);
const snapshotTime=Date.now(),oldWorld=C.world(forest,'yard',snapshotTime),tomorrow=snapshotTime+86400000;assert(oldWorld.allowed(tree.x,tree.z));const nextWorld=C.world(forest,'yard',tomorrow);assert(!nextWorld.allowed(tree.x,tree.z));const oldPoint={x:tree.x,z:tree.z,y:0,yaw:1.2,pitch:.13},safe=C.safePosition(nextWorld,oldPoint);assert(nextWorld.allowed(safe.x,safe.z));assert(Math.hypot(safe.x-oldPoint.x,safe.z-oldPoint.z)<=1);assert.equal(safe.yaw,1.2);assert.equal(safe.pitch,.13);assert.equal(C.treeState(forest,tree.id,tomorrow),0);forest.trees[tree.id].day='2001-01-01';assert(C.propose(forest,purse,action).ok);
const malformed=C.normalize({version:2,rooms:{fake:true,library:'yes'},trees:{'tree-0':{day:C.dayKey(),hits:99}},owned:{rug:Infinity},placed:[{id:1,item:'rug',area:'library',x:0,z:0}],finds:['invented']});assert.deepEqual(malformed.rooms,{});assert.deepEqual(malformed.trees,{});assert.deepEqual(malformed.placed,[]);
console.log('Homestead state: v1 migration, doubled area, room gates/costs, safe passages, independent placements, caps and once-daily physical timber transactions pass');
// Real THREE geometry proves each catalogue design is distinct and bounded.
const T=require('../lib/three.min.js');require('../settlement_models.js');globalThis.BurbzBuildingRoomsCore=require('../building_rooms_core.js');require('../building_rooms_scene.js');require('../player_home_scene.js');
const S=globalThis.BurbzPlayerHomeScene,signatures=new Set();
for(const [id,item] of Object.entries(C.ITEMS)){const mesh=S.ornament(T,item.type),hash=crypto.createHash('sha256');let vertices=0;mesh.traverse(o=>{if(o.geometry){const a=o.geometry.attributes.position;vertices+=a.count;hash.update(Buffer.from(a.array.buffer));}});assert(vertices>0&&vertices<20000,id+' geometry budget');signatures.add(hash.digest('hex'));if(!['lantern','chair'].includes(id)){const box=new T.Box3().setFromObject(mesh);assert(box.max.x<=item.w/2+.22&&box.min.x>=-item.w/2-.22&&box.max.z<=item.d/2+.22&&box.min.z>=-item.d/2-.22,id+' footprint agrees with geometry');}S.disposeScene(mesh);assert.equal(mesh.children.length,0);}
assert.equal(signatures.size,Object.keys(C.ITEMS).length);
for(const area of ['room',...Object.keys(C.ROOMS)]){const view=S.create(T,home,area,390/844,{exposure:1,hemi:1,keyColor:0xffe7b5,keyIntensity:1,sun:1});assert(view.world.allowed(view.world.spawn().x,view.world.spawn().z));assert(view.targets.some(o=>o.userData.roomTarget));if(area==='room'){assert(view.screenSize);assert(view.screen.material.depthTest);assert.equal(view.targets.filter(o=>o.userData.roomTarget).length,3);}else{assert.equal(view.screen,null);assert(view.targets.some(o=>o.userData.findId===area+'-story'));}view.dispose();assert.equal(view.scene.children.length,0);}
const wings=S.upperRooms(T,home);assert.equal(wings.children.length,3);const wingBounds=new T.Box3().setFromObject(wings);assert(wingBounds.max.x<2.75&&wingBounds.min.x> -2.75&&wingBounds.max.z<2.25&&wingBounds.min.z> -2.25);assert(wingBounds.max.y>4,'built rooms visibly raise the roofline');S.disposeScene(wings);
console.log('Homestead geometry: 32 distinct models, bounded footprints/vertices, themed rooms, physical door targets and disposal pass');
