'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),core=require('../building_work_core.js');
const project={key:'village:7:cabin',startMs:1000,endMs:101000,toLevel:1};
test('one assist deducts one quarter of the original project duration and preserves identity',()=>{
 const before=JSON.stringify(project),next=core.assist(project,21000);assert.equal(next.endMs,76000);assert.equal(next.assistedMs,25000);assert.equal(core.identity(next),core.identity(project));assert.equal(JSON.stringify(project),before);assert.equal(core.assist(next,22000),null);assert.equal(core.assist(JSON.parse(JSON.stringify(next)),23000),null);
});
test('late help can finish the work but cannot be repeated or applied to a future, finished or invalid project',()=>{
 const next=core.assist(project,100999);assert(next.endMs<100999);for(const now of [999,101000,NaN,Infinity])assert.equal(core.assist(project,now),null);
 for(const p of [{...project,key:''},{...project,endMs:0},{...project,readyToOpenAt:500},{...project,assistedAt:0}])assert.equal(core.assist(p,50000),null);
});
test('work requires known ground and close walking proximity at the physical site',()=>{
 const p={x:0,y:2,z:0,mode:'walk'},s={x:4,y:2,z:0,radius:1,loaded:true};assert(core.near(p,s));for(const player of [{...p,x:-.01},{...p,y:4.51},{...p,mode:'fly'},{...p,z:NaN}])assert.equal(core.near(player,s),false);
 for(const site of [{...s,loaded:false},{...s,interior:true},{...s,radius:-1},{...s,y:NaN}])assert.equal(core.near(p,site),false);
});
