const {test}=require('node:test');
const assert=require('node:assert/strict');
const core=require('../appearance_core.js');
function documentFixture(){
  const attrs={}, classes=new Set(['unrelated']), meta={}, radios=[{value:'normal'},{value:'comic'}];
  return {attrs,classes,meta,radios,documentElement:{setAttribute(k,v){attrs[k]=v;}},body:{classList:{toggle(k,on){on?classes.add(k):classes.delete(k);}}},querySelector(){return {setAttribute(k,v){meta[k]=v;}};},querySelectorAll(){return radios;}};
}
test('missing, legacy, corrupt and inaccessible saves default to Normal',()=>{
 for(const state of [null,'{}','null','bad json',JSON.stringify({settings:{appearance:'future'}})]) assert.equal(core.readStoredTheme({getItem:()=>state}),'normal');
 assert.equal(core.readStoredTheme({getItem(){throw Error('blocked')}}),'normal');
 assert.equal(core.readStoredTheme({getItem:()=>JSON.stringify({settings:{appearance:'comic'}})}),'comic');
});
test('both directions update only the selected theme, preserving unrelated classes',()=>{
 const doc=documentFixture();
 for(const theme of ['comic','normal','comic']){
  core.apply(theme,doc);assert.equal(doc.attrs['data-appearance'],theme);
  assert.equal(doc.classes.has('comic-ui'),theme==='comic');assert.equal(doc.classes.has('woodland-ui'),theme==='normal');
  assert.equal(doc.classes.has('unrelated'),true);assert.equal(doc.radios.find(x=>x.checked).value,theme);
 }
});
test('choice persists across restart without changing progress or other settings',()=>{
 const state={player:{level:17,coins:12345},flock:[{id:'bird-1',xp:123}],walkingQuest:{id:'walk',checkpointIndex:2},settings:{music:false,sfx:true,vibration:false}};
 const before=structuredClone(state);let stored;
 assert.equal(core.choose(state.settings,'comic',()=>{stored=JSON.stringify(state);return {ok:true};}).ok,true);
 const expected=structuredClone(before);expected.settings.appearance='comic';assert.deepEqual(JSON.parse(stored),expected);
 assert.equal(core.readStoredTheme({getItem:()=>stored}),'comic');
 core.choose(state.settings,'normal',()=>{stored=JSON.stringify(state);return {ok:true};});
 expected.settings.appearance='normal';assert.deepEqual(JSON.parse(stored),expected);
});
test('write failures restore exact previous settings and visual selection',()=>{
 for(const fail of [()=>({ok:false}),()=>{throw Error('quota')}]) for(const settings of [{music:false},{appearance:'comic',music:false}]){
  const before=structuredClone(settings),doc=documentFixture();
  assert.equal(core.choose(settings,'normal',fail,doc).ok,false);assert.deepEqual(settings,before);
  assert.equal(doc.attrs['data-appearance'],core.normalize(before.appearance));
 }
});
test('unknown choices never save or change settings',()=>{
 const settings={appearance:'comic'};let called=false;
 assert.equal(core.choose(settings,'invalid',()=>{called=true}).ok,false);assert.equal(called,false);assert.deepEqual(settings,{appearance:'comic'});
});
