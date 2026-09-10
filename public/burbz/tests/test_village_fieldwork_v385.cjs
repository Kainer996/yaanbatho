const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const core=require('../village_discovery_core.js'),catalogue=require('../loot_crafting_core.js');
assert.equal(core.QUESTS.length,50);assert.equal(core.LORE.length,30);assert.equal(core.ACTIVITIES.length,12);
assert.equal(new Set(core.ACTIVITIES.map(x=>x.id)).size,12);
const covered=new Set(),memories=new Set();
for(let seed=0;seed<100;seed++){
 const rec=core.village({},seed,'fieldwork-test'),original=JSON.stringify(rec),a=core.activities(rec);
 assert.equal(JSON.stringify(rec),original,'reading a legacy record never dirties the save');assert.equal(a.length,3);
 assert.deepEqual(core.activities(JSON.parse(original)),a,'old records receive stable sites after reload');
 const originalQuest=rec.questId,originalLoot=JSON.stringify(rec.loot),originalLore=JSON.stringify(rec.lore);
 for(const {story} of a){
  covered.add(story.id);memories.add(story.memory);assert.equal(story.steps.length,3);
  for(const [id,n] of Object.entries(story.reward.materials||{})){assert(catalogue.materialById(id));assert(n>0&&Number.isInteger(n));}
  const later=story.id+':2',before=JSON.stringify(rec);assert.equal(core.act(rec,'activity',later,story.steps[2].answer),null,'no stage skipping');assert.equal(JSON.stringify(rec),before);
  for(let step=0;step<3;step++){
   const id=story.id+':'+step,node=story.steps[step],snapshot=JSON.stringify(rec);
   assert.equal(core.act(rec,'activity','invented:'+step),null);assert.equal(core.act(rec,'activity','__proto__:'+step),null);
   if(node.choices){
    assert.equal(core.act(rec,'activity',id,'invented'),null);assert.equal(core.act(rec,'activity',id),null);
    const wrong=node.choices.find(c=>c[0]!==node.answer)[0],feedback=core.act(rec,'activity',id,wrong);
    assert(feedback.tryAgain);assert(!feedback.reward);assert.equal(JSON.stringify(rec),snapshot,'wrong choice changes no progress or purse');
   }
   const result=core.act(rec,'activity',id,node.answer);assert(result);
   assert.equal(core.activities(rec).find(a=>a.story.id===story.id).step,step+1);
   assert.equal(!!result.reward,step===2,'only the completed physical sequence pays');
   assert.equal(core.act(rec,'activity',id,node.answer),null,'no repeated payouts or checkpoint advances');
  }
 }
 assert(core.activities(rec).every(a=>a.completed));
 assert.equal(rec.questId,originalQuest);assert.equal(JSON.stringify(rec.loot),originalLoot);assert.equal(JSON.stringify(rec.lore),originalLore);
 assert.deepEqual(rec.collected,[]);assert.deepEqual(rec.read,[]);assert.equal(rec.accepted,false,'side stories do not complete original requests');
 assert.deepEqual(core.activities(JSON.parse(JSON.stringify(rec))),core.activities(rec));
}
assert.equal(covered.size,12);assert.equal(memories.size,12);
// Exercise the real atomic index adapter, including a failure on the final reward.
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8'),start=html.indexOf('function villageDiscoveryAdapter(seed)'),end=html.indexOf('let villageWalkLoad',start);
let fail=false,persisted='';const ctx={window:{BurbzVillageDiscoveryCore:core,BurbzLootCore:catalogue},gameState:{player:{coins:100,branches:30},inventory:{gear:{},items:{}}},crypto:{getRandomValues:a=>{a[0]=83;return a;}},snapshotGameState:()=>JSON.parse(JSON.stringify(ctx.gameState)),restoreGameStateSnapshot:s=>ctx.gameState=s,durableSaveState:()=>{if(fail)throw Error('storage unavailable');persisted=JSON.stringify(ctx.gameState);},updateHeader(){throw Error('HUD failure after commit');}};
vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);const adapter=ctx.villageDiscoveryAdapter(385);adapter.prepare();const story=core.activities(adapter.record())[0].story;
for(let n=0;n<2;n++)adapter.act('activity',story.id+':'+n);
const before=JSON.stringify(ctx.gameState);fail=true;assert.throws(()=>adapter.act('activity',story.id+':2',story.steps[2].answer),/storage unavailable/);assert.equal(JSON.stringify(ctx.gameState),before,'failed save restores both field notes and payout');
fail=false;const result=adapter.act('activity',story.id+':2',story.steps[2].answer);assert(result.reward);assert.equal(persisted,JSON.stringify(ctx.gameState));assert.equal(adapter.act('activity',story.id+':2',story.steps[2].answer),null);assert.equal(ctx.gameState.player.coins,100+story.reward.coins,'HUD failure cannot undo paid reward');
console.log('PASS: 300 field stories, 900 ordered interactions, clue choices, legacy identity retention, catalogue rewards, reload and atomic failure/retry.');
