const assert=require('node:assert/strict');
const test=require('node:test');
const T=require('../lib/three.min.js');
require('../settlement_models.js');
const models=global.BurbzSettlementModels;
const audio=require('../audio_core.js');

test('Peeps have a stable humanoid silhouette and opposing walking limbs',()=>{
  const p={id:'42:resident:7',name:'Moss',kind:'humanoid'};
  const a=models.resident(T,p),b=models.resident(T,p),rig=a.userData.humanoidRig;
  assert.equal(a.userData.birdRig,undefined);
  assert.equal(rig.arms.length,2);assert.equal(rig.legs.length,2);
  assert.ok(rig.head && rig.body);
  const bounds=new T.Box3().setFromObject(a);
  assert.ok(bounds.max.y>1.2 && bounds.max.y<1.4);
  assert.deepEqual([...rig.body.children[0].geometry.attributes.color.array],[...b.userData.humanoidRig.body.children[0].geometry.attributes.color.array]);
  models.animateResident(a,{moving:true,stride:1},1,1);
  assert.ok(rig.legs[0].rotation.x*rig.legs[1].rotation.x<0);
  assert.ok(rig.legs[0].rotation.x*rig.arms[0].rotation.x<0);
  models.animateResident(a,{moving:false},2,0);
  assert.ok([...rig.legs,...rig.arms].every(l=>l.rotation.x===0));
  assert.equal(rig.head.rotation.y,0);
});

test('Peep chatter never overlaps/repeats, mute stops it, and rejection stays harmless',async()=>{
  const made=[];let now=1000,fail=false;
  class Clip {
    constructor(src){this.src=src;this.listeners={};made.push(this);}
    addEventListener(n,f){this.listeners[n]=f;}
    play(){return fail?Promise.reject(Error('locked')):Promise.resolve();}
    pause(){this.paused=true;}
  }
  const s=audio.createAudioManager({Audio:Clip,now:()=>now,random:()=>0});
  assert.equal(s.manifest.residentChatter.length,16);
  const results=await Promise.all(Array.from({length:20},()=>s.residentChatter()));
  assert.equal(results.filter(Boolean).length,1);assert.equal(made.length,1);
  assert.equal(made[0].volume,.38);
  made[0].listeners.ended();now+=2200;
  assert.equal(await s.residentChatter(),true);assert.notEqual(made[0].src,made[1].src);
  s.setEnabled(false);assert.equal(made[1].paused,true);
  assert.equal(await s.residentChatter(),false);
  s.setEnabled(true);now+=2200;fail=true;
  assert.equal(await s.residentChatter(),false);
  fail=false;assert.equal(await s.residentChatter(),true);
});
