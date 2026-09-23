'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(__dirname+'/../index.html','utf8');
const fn=n=>{const m=html.match(new RegExp('function '+n+'\\([^]*?\\n}'));assert.ok(m,'missing '+n);return m[0];};
test('Hall supply inline actions refresh through one exported controller, including failed transactions',()=>{
 const c={window:{},calls:[],claimBirdExpedition:id=>c.calls.push('claim:'+id),startBirdExpedition:(id,type,o)=>c.calls.push('send:'+id+':'+o.firstHallSeed),renderBuildingInterior:()=>c.calls.push('sheet'),renderVillageManagePanel:()=>c.calls.push('panel')};vm.createContext(c);
 vm.runInContext(fn('firstHallSupplyAction')+';'+html.match(/window.firstHallSupplyAction\s*=\s*firstHallSupplyAction;/)?.[0],c);
 assert.equal(typeof c.window.firstHallSupplyAction,'function');c.window.firstHallSupplyAction('send','bird',7);assert.deepEqual(c.calls,['send:bird:7','sheet','panel']);c.calls=[];c.window.firstHallSupplyAction('claim','job',7);assert.deepEqual(c.calls,['claim:job','sheet','panel']);
 assert.doesNotMatch(fn('firstHallSupplyHTML'),/;renderBuildingInterior\(\)/);
});
test('real reward celebration renders above Hall sheet',()=>{const css=html.match(/\.quest-claim-celebration\s*\{([^}]+)/)[1];assert.ok(Number(css.match(/z-index:\s*(\d+)/)?.[1])>1200,css);});
