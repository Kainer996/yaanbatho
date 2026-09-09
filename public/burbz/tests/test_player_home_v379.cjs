const assert=require('node:assert/strict'),C=require('../player_home_core.js');
let h=C.initial(),wallet={branches:100};assert.equal(h.intro,'welcome');assert.equal(C.normalize(undefined,true).intro,'done');assert.equal(C.available(h,'bench'),1);
const before=JSON.stringify(h);let r=C.propose(h,wallet,{kind:'place',item:'bench',area:'yard',x:4,z:4});assert(r.ok);assert.equal(JSON.stringify(h),before);h=r.home;assert.equal(C.available(h,'bench'),0);assert(!C.propose(h,wallet,{kind:'place',item:'bench',area:'yard',x:-4,z:4}).ok);
r=C.propose(h,wallet,{kind:'place',id:h.placed[0].id,item:'bench',area:'yard',x:-4,z:4,turn:1});assert(r.ok);h=r.home;assert.equal(h.placed.length,1);assert.equal(h.placed[0].turn,1);
r=C.propose(h,wallet,{kind:'store',id:h.placed[0].id});assert(r.ok);h=r.home;assert.equal(C.available(h,'bench'),1);assert(!C.propose(h,wallet,{kind:'store',id:1}).ok);
for(const [area,x,z] of [['yard',0,0],['yard',0,5],['yard',6,6],['yard',15,1],['room',0,0],['room',0,4],['room',0,-3.5]])assert(!C.validPlacement(h,{item:area==='room'?'chair':'bench',area,x,z,turn:0}).ok);
assert(C.propose(h,wallet,{kind:'place',item:'rug',area:'room',x:0,z:1}).ok);assert(!C.propose(h,wallet,{kind:'place',item:'books',area:'room',x:3,z:0}).ok);
r=C.propose(h,wallet,{kind:'craft',item:'books'});assert(r.ok);assert.equal(r.wallet.branches,90);h=r.home;assert(C.propose(h,r.wallet,{kind:'place',item:'books',area:'room',x:3,z:0}).ok);
assert(!C.propose(h,{branches:2},{kind:'craft',item:'chair'}).ok);assert(!C.propose(h,{branches:NaN},{kind:'upgrade'}).ok);
r=C.propose(h,wallet,{kind:'upgrade'});assert(r.ok);assert.equal(r.home.tier,1);assert.equal(r.wallet.branches,75);r=C.propose(r.home,r.wallet,{kind:'upgrade'});assert(r.ok);assert.equal(r.home.tier,2);assert.equal(r.wallet.branches,15);assert(!C.propose(r.home,r.wallet,{kind:'upgrade'}).ok);
r=C.propose(h,wallet,{kind:'find',id:'lost-pot'});assert(r.ok);assert.equal(r.home.owned.flowers,h.owned.flowers+1);assert(!C.propose(r.home,wallet,{kind:'find',id:'lost-pot'}).ok);assert.equal(C.normalize(JSON.parse(JSON.stringify(r.home))).finds.length,1);
for(const area of ['room','yard']){const w=C.world(h,area),p=w.spawn();assert(w.allowed(p.x,p.z));assert(!w.allowed(Infinity,0));if(area==='room'){for(let z=3.8;z>-1.5;z-=.1)assert(w.allowed(0,z),'clear desk approach');assert(!w.allowed(0,-3.5));}else assert(!w.allowed(0,0));}
const malformed=C.normalize({tier:999,owned:{bench:Infinity},placed:[{id:1,item:'bench',area:'yard',x:NaN,z:4}],finds:['made-up']});assert.equal(malformed.tier,2);assert.deepEqual(malformed.placed,[]);assert.deepEqual(malformed.finds,[]);
console.log('Personal home: migration, decoration placement/move/store, safe paths, upgrades, finite costs and once-only discoveries pass');
