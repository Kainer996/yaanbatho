'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const core=require('../village_harvest_core.js');
const now=Date.parse('2026-09-08T23:59:59.900Z');
const wood={id:core.id('wood',1.25,-2.5),kind:'wood',x:1.25,y:0,z:-2.5,radius:.4};
const stone={...wood,id:core.id('stone',1.25,-2.5),kind:'stone'};
const fresh=()=>({player:{branches:7,stone:11,coins:99},inventory:{unchanged:true}});
test('three wood or two stone pay once per stable object, village and UTC day',()=>{
 const s=fresh();assert.equal(core.available(s,101,wood,now),true);
 assert.deepEqual(core.claim(s,101,wood,now),{resource:'branches',quantity:3});
 assert.equal(core.claim(s,101,wood,now),null);assert.equal(core.available(s,101,wood,now),false);
 assert.deepEqual(core.claim(s,101,stone,now),{resource:'stone',quantity:2});
 assert.deepEqual(s.player,{branches:10,stone:13,coins:99});assert.deepEqual(s.inventory,{unchanged:true});
 assert.equal(core.claim(s,102,wood,now).quantity,3,'another real village is independent');
 assert.equal(core.claim(s,101,wood,now+200).quantity,3,'next UTC day replenishes');
 assert.equal(core.claim(s,101,wood,now+250),null);assert.equal(s.player.branches,16);
});
test('JSON save/reload retains spent supplies and rollback allows one successful retry',()=>{
 let s=fresh();const original=JSON.stringify(s);core.claim(s,101,wood,now);
 s=JSON.parse(JSON.stringify(s));assert.equal(core.claim(s,101,wood,now),null);assert.equal(s.player.branches,10);
 s=JSON.parse(original);assert.equal(core.available(s,101,wood,now),true);assert.equal(core.claim(s,101,wood,now).quantity,3);assert.equal(core.claim(s,101,wood,now),null);assert.equal(s.player.branches,10);
});
test('invalid resource kinds never mutate state; IDs separate kind and stable coordinates',()=>{
 const s=fresh(),before=JSON.stringify(s);for(const n of [null,{...wood,kind:'coins'},{...wood,kind:''}])assert.equal(core.claim(s,101,n,now),null);
 assert.equal(JSON.stringify(s),before);assert.notEqual(wood.id,stone.id);assert.equal(core.id('wood',1.25000000001,-2.49999999999),wood.id);
 assert.notEqual(core.id('wood',1.27,-2.5),wood.id);
});
test('gathering requires facing a nearby object at the same level and a clear pedestrian approach',()=>{
 const p={x:0,y:0,z:0,yaw:0},n={...wood,x:0,z:-2,radius:.4};
 assert.equal(core.inReach(p,n,{allowed:()=>true}),true);
 for(const q of [{...p,y:2},{...p,yaw:Math.PI},{...p,yaw:.7},{...p,x:NaN}])assert.equal(core.inReach(q,n,{allowed:()=>true}),false);
 assert.equal(core.inReach(p,{...n,z:-3},{allowed:()=>true}),false);
 assert.equal(core.inReach(p,{...n,z:0},{allowed:()=>true}),false);
 assert.equal(core.inReach(p,n,{allowed:(x,z)=>z>-.7}),false,'intervening wall prevents gathering through it');
 assert.equal(core.inReach(p,n,{allowed:(x,z)=>z>-1.6}),true,'the solid target itself does not make its surface unreachable');
});
test('reach radius is bounded and target height/geometry must be finite',()=>{
 const p={x:0,y:0,z:0,yaw:0};
 assert.equal(core.inReach(p,{...wood,x:0,z:-3.1,radius:100},{allowed:()=>true}),false);
 for(const key of ['x','y','z','radius'])assert.equal(core.inReach(p,{...wood,[key]:Infinity},{allowed:()=>true}),false);
});
