const {test}=require('node:test'),assert=require('node:assert/strict');
require('../settlement_scene_core.js');const core=globalThis.BurbzSettlementSceneCore;
test('detail reacts to missed 60Hz budget and sustained severe stalls',()=>{
 const state={dpr:2,minDpr:1,maxDpr:2};
 assert.equal(core.adaptDetail(state,{frames:48,avgFrameMs:24}).dpr,1.75);
 assert.equal(core.adaptDetail(state,{frames:8,avgFrameMs:280}).dpr,1.75);
 assert.equal(core.adaptDetail(state,{frames:2,avgFrameMs:280}).changed,false);
 assert.equal(core.adaptDetail(state,{frames:48,avgFrameMs:16.7}).changed,false);
 assert.equal(core.adaptDetail({dpr:1,minDpr:1,maxDpr:2},{frames:48,avgFrameMs:80}).dpr,1);
});
