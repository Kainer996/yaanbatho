'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const core = require('../academy_treehouse_core.js');
const stops = [...Array.from({length:15},(_,i)=>i+1),30,60,120,240,480,720,1440];
const bird = {id:'slider-test',power:160,int:80,spd:90,stamina:120,cha:140};
const templates = core.getQuestTemplates().filter(t=>!t.tutorial);

test('exact indexed stops and every template dispatch use selected minutes',()=>{
  assert.deepEqual(core.QUEST_DURATION_MINUTES,stops);
  for(const t of templates){
    assert.deepEqual(core.getQuestDurationOptions(t.id).map(o=>o.minutes),stops);
    for(const m of stops){const q=core.createBirdExpedition(bird,t.id,1000,{durationMinutes:m});assert.equal(q.durationMinutes,m);assert.equal(q.endMs,1000+m*60000);}
  }
});
test('short selections scale below five without rebalancing legacy >=5 anchors',()=>{
  for(const t of templates){
    const opts=core.getQuestDurationOptions(t.id);
    for(const m of stops){const p=opts.find(o=>o.minutes===m);assert.ok(p,`${t.id} ${m}`);
      const ratio=Math.pow(m/Math.max(5,t.minutes),.9),physical=Math.pow(m/Math.max(5,t.minutes),.45);
      assert.ok(Math.abs(p.ratio-ratio)<1e-10);assert.ok(Math.abs(p.physicalRatio-physical)<1e-10);
    }
    for(let i=1;i<opts.length;i++)for(const k of ['coins','branches','stone'])for(let j=0;j<2;j++)assert.ok(opts[i][k][j]>=opts[i-1][k][j]);
  }
});
test('invalid/fractional selections retain authored defaults; tutorial timer never selectable',()=>{
  for(const value of [undefined,null,'',0,-1,1.5,16,45,Infinity,NaN,'garbage']){
    const q=core.createBirdExpedition(bird,'branch_run',1000,{durationMinutes:value});assert.equal(q.durationMinutes,5);
  }
  assert.equal(core.createBirdExpedition(bird,'branch_run',0,{durationMinutes:'2'}).durationMinutes,2);
  for(const m of stops){const q=core.createBirdExpedition(bird,'merlin_first_flight',1000,{durationMinutes:m});assert.equal(q.endMs,6000);assert.equal(q.rewards.xp,8);}
  assert.deepEqual(core.getQuestDurationOptions('merlin_first_flight'),[]);
});
test('completion uses exact deadline, survives reload, preserves old banked data and terminal status',()=>{
  const old={id:'old',templateId:'branch_run',startMs:1000,endMs:86401000,status:'active',rewards:{coins:1234,branches:99,items:{old_map:7}},equipment:{provision:true,charm:true}};
  const serialized=JSON.stringify(old);
  assert.equal(core.advanceBirdExpedition(old,old.endMs-1).status,'active');
  assert.equal(core.advanceBirdExpedition(old,old.endMs-300000).status,'active');
  for(const at of [old.endMs,old.endMs+1])assert.equal(core.advanceBirdExpedition(JSON.parse(serialized),at).status,'complete');
  for(const status of ['claimed','cancelled','failed'])assert.equal(core.advanceBirdExpedition({...old,status},old.endMs+1).status,status);
  assert.equal(JSON.stringify(old),serialized);assert.deepEqual(core.advanceBirdExpedition(old,old.endMs).rewards,old.rewards);
});
test('canonical bird preview bounds contain deterministic payouts and grow with duration',()=>{
  for(const t of templates)for(const nightBonus of [null,{coins:3,branches:2,xp:3,itemRolls:2}]){
    let prior;
    for(const m of stops){
      const p=core.getBirdExpeditionPreview(bird,t.id,{durationMinutes:m,nightBonus});
      for(const k of ['coins','branches','stone','itemRolls'])if(prior)for(let i=0;i<2;i++)assert.ok(p[k][i]>=prior[k][i],`${t.id} ${m} ${k}`);
      for(let seed=0;seed<30;seed++){
        const q=core.createBirdExpedition(bird,t.id,1000+seed,{durationMinutes:m,nightBonus});
        for(const k of ['coins','branches','stone','itemRolls'])assert.ok(q.rewards[k]>=p[k][0]&&q.rewards[k]<=p[k][1],`${t.id} ${m} ${k}`);
        assert.equal(q.rewards.xp,p.xp);
      }
      prior=p;
    }
  }
});
test('carry policy remains bounded with nondecreasing total occupied load at fixed roll seeds',()=>{
  const size=require('../bird_size_core.js');
  for(const sizeScore of [1,25,50,75,100])for(const t of templates)for(const now of [1000,1001,1002]){
    const b={...bird,sizeScore};let prior;
    for(const m of stops){
      const q=core.createBirdExpedition(b,t.id,now,{durationMinutes:m});
      const c=size.applyCarryLimit(q.rewards,b,2);
      assert.ok(c.unitsUsed<=c.capacity);
      if(prior){assert.ok(q.rewards.coins>=prior.coins);assert.ok(q.rewards.xp>=prior.xp);assert.ok(c.unitsUsed>=prior.units,`${sizeScore} ${t.id} ${m}`);}
      prior={coins:q.rewards.coins,xp:q.rewards.xp,units:c.unitsUsed};
    }
  }
});
test('invalid inputs use the same authored normalization in preview and dispatch',()=>{
  for(const t of templates)for(const value of [true,false,[],[2],{},null,undefined,'',1.5,16,Infinity,'bad']){
    const q=core.createBirdExpedition(bird,t.id,1000,{durationMinutes:value});
    assert.equal(q.durationMinutes,t.minutes,`${t.id}: ${String(value)}`);
    const p=core.getBirdExpeditionPreview(bird,t.id,{durationMinutes:value});
    assert.equal(p.minutes,t.minutes);
    assert.equal(p.xp,q.rewards.xp);
  }
});
