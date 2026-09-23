'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const path=require('node:path');const {createRequire}=require('node:module');
const core=require('../academy_treehouse_core.js');
// Reuse the established synthetic-save fixture, including the actual transaction
// functions, without running/modifying its tests or any owner/provider state.
const fixturePath=path.join(__dirname,'test_motivated_opening_20260914.cjs');
const source=fs.readFileSync(fixturePath,'utf8');const fixture={require:createRequire(fixturePath),__dirname,structuredClone,console};vm.createContext(fixture);vm.runInContext(source.slice(0,source.indexOf("test('fresh opening"))+'\nglobalThis.makeRuntime=runtime;',fixture);
const html=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const fn=name=>html.match(new RegExp('function '+name+'\\([^]*?\\n}'))[0];
function runtime(){const c=fixture.makeRuntime();c.openingErrandsIntroduced=()=>true;c.now=1000000;c.Date={now:()=>c.now};c.questSendState={birdId:'merlin-guide',templateId:'branch_run',durationMinutes:1};c.closed=0;c.closeQuestOverlay=()=>c.closed++;c.renderQuests=()=>{};vm.runInContext(fn('confirmQuestSend'),c);return c;}
test('every stop dispatches, reloads, cannot claim before exact end, and pays once',()=>{
 for(const m of core.QUEST_DURATION_MINUTES){const c=runtime();c.questSendState.durationMinutes=m;c.confirmQuestSend();assert.equal(c.closed,1);const q=c.gameState.birdExpeditions[0];assert.equal(q.endMs-c.now,m*60000);c.gameState=JSON.parse(c.saved);c.now=q.endMs-1;const before=JSON.stringify(c.gameState);c.claimBirdExpedition(q.id);assert.equal(JSON.stringify(c.gameState),before);c.now=q.endMs;c.claimBirdExpedition(q.id);assert.equal(c.gameState.birdExpeditions.length,0);assert.ok(c.gameState.questClaimReceipts['expedition:'+q.id]);const after=JSON.stringify(c.gameState);c.claimBirdExpedition(q.id);assert.equal(JSON.stringify(c.gameState),after);c.gameState=JSON.parse(c.saved);c.claimBirdExpedition(q.id);assert.equal(JSON.stringify(c.gameState),c.saved);}
});
test('failed save keeps sheet/selection and unchanged state; dispatch retry is exactly once',()=>{
 const c=runtime();c.questSendState.durationMinutes=4;const before=JSON.stringify(c.gameState);c.failSave=true;c.confirmQuestSend();assert.equal(c.closed,0);assert.equal(c.questSendState.durationMinutes,4);assert.equal(JSON.stringify(c.gameState),before);assert.match(c.effects.at(-1),/could not be saved/);c.failSave=false;c.confirmQuestSend();assert.equal(c.closed,1);c.confirmQuestSend();assert.equal(c.closed,1);assert.equal(c.gameState.birdExpeditions.length,1);
});
test('claim rollback keeps banked reward/receipt intact and later retry pays original rewards',()=>{
 const c=runtime();c.confirmQuestSend();let q=c.gameState.birdExpeditions[0];q.rewards={coins:71,branches:12,stone:7,xp:3,items:{old_map:2}};q.equipment={provision:true,charm:true};const before=JSON.stringify(c.gameState);c.now=q.endMs;c.failSave=true;c.claimBirdExpedition(q.id);assert.equal(JSON.stringify(c.gameState),before);c.failSave=false;c.claimBirdExpedition(q.id);const receipt=c.gameState.questClaimReceipts['expedition:'+q.id];assert.equal(receipt.coins,Math.round(71*1.25));assert.equal(receipt.branches,15);assert.equal(receipt.stone,7);assert.equal(receipt.items.old_map,2);assert.equal(c.gameState.birdExpeditions.length,0);
});
test('existing opening, roost, assigned-post, nap and care blockers do not dismiss SEND',()=>{
 for(const block of ['opening','roost','post','nap','care','missing']){const c=runtime();if(block==='opening')c.openingErrandsIntroduced=()=>false;if(block==='roost'){c.questSendState.birdId='b';c.questSendState.templateId='moon_scout';c.expeditionBirdById=()=>({id:'b',commonName:'Test'});}if(block==='post'){c.birdAssignedPost=()=>({role:{title:'Quartermaster'}});c.birdDisplayName=()=> 'Test';}if(block==='nap')c.gameState.merlinCare.restEndsAt=123;if(block==='care')c.warnOrBlockBirdWork=()=>false;if(block==='missing')c.expeditionBirdById=()=>null;c.confirmQuestSend();assert.equal(c.closed,0,block);assert.equal(c.gameState.birdExpeditions.length,0,block);}
});
