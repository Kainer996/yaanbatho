'use strict';
// Real preview dependency graph; only persistence/DOM effects and dispatch
// eligibility outside the preview are injected. All saves are synthetic.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const academy = require('../academy_treehouse_core.js');
const merlin = require('../merlin_companion_core.js');
const roles = require('../bird_roles_core.js');
const size = require('../bird_size_core.js');
const loot = require('../loot_crafting_core.js');
const hunger = require('../diet_hunger_core.js');
const sleep = require('../bird_sleep_core.js');
const html = fs.readFileSync(require.resolve('../index.html'), 'utf8');
const NOW = new Date(2026, 8, 23, 22, 0, 0).getTime();
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }
function source(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' exists');
  const eol = html.indexOf('\n', start);
  return html.slice(start, /}\s*$/.test(html.slice(start, eol)) ? eol : html.indexOf('\n}', start) + 2);
}
const functions = ['dietHungerCore','birdSleepCore','birdRolesCore','birdSizeCore','lootCore',
  'getMerlinCare','merlinExpeditionSlowFactor','academyBirdById','expeditionBirdById',
  'ensureRolesState','ensureChefCareers','pauseHeadChefCareer','ensureEmpireState',
  'roleDefFor','rolePostState','roleMultiplier','academyRoleMultiplier','birdAssignedPost',
  'birdLoadout','birdGearBonuses','burbzForgeLevel','nocturnalNightBonusFor',
  'getExpeditionTemplate','isStarterExpeditionTemplate','applyQuartermasterPlanning',
  'applyExpeditionCarryLimit','questDurationLabel','questSendDurationLabel','questSendPreviewText',
  'ensureBirdExpeditions','birdHasActiveExpedition','refreshAcademyHomeIfVisible','startBirdExpedition'];
function fresh() {
  return {
    player:{coins:150,branches:4},
    flock:[{id:'b',commonName:'Tawny Owl',species:'Tawny Owl',level:20,power:160,stamina:120,int:80,spd:90,cha:140,sizeScore:50},
      {id:'qm',commonName:'Planner',level:20,int:150,cha:110,sizeScore:50}],
    merlinCare:{...merlin.DEFAULT_MERLIN_CARE,lastCareAt:NOW,hunger:20},
    birdRoles:{academy:{quest_roost:'qm'},villages:{},regions:{}},
    chefCareers:{},empire:{mergeChartersVersion:1},forgeLevel:3,
    inventory:{equipment:{b:{trinket:'oakframe_satchel'},'merlin-guide':{}},items:{oak_twig:5},gear:{},larder:{}},
    birdExpeditions:[],tutorialFlow:{unrelatedReceipt:true}
  };
}
function runtime(state = fresh(), id = 'b') {
  const c = {Date:Clock,gameState:state,MERLIN_CORE:merlin,
    MERLIN_GUIDE:{id:'merlin-guide',species:'Merlin',commonName:'Merlin',level:1,power:80,int:55,spd:85,stamina:48,cha:72,sizeScore:35},
    window:{BurbzAcademyCore:academy,BurbzBirdRolesCore:roles,BurbzBirdSizeCore:size,BurbzLootCore:loot,BurbzDietHungerCore:hunger,BurbzBirdSleepCore:sleep},
    questSendState:{templateId:'branch_run',durationMinutes:5,birdId:id},
    currentScreen:'quests',saves:0,events:[],notes:[],domReads:0,
    saveState(){ c.saves++; },durableSaveState(){ c.saves++; },
    burbzTutorialAction(event){ c.events.push(event); },
    $(){ c.domReads++; return null; },
    // Dispatch-only boundaries: its real lookup/housekeeping/economy still run.
    openingErrandsIntroduced:()=>true,isAcademyBuildingBuilt:()=>true,warnOrBlockBirdWork:()=>true,
    snapshotGameState:()=>structuredClone(c.gameState),queueQuestClaimCloudSync(){},updateQuestProgress(){},
    showToast(message){c.notes.push(message);},renderPetCompanion(){},renderBirdExpeditions(){},SFX:{page(){}}
  };
  vm.createContext(c);
  vm.runInContext(functions.map(source).join('\n'), c);
  return c;
}
function references(value, path = [], out = []) {
  if (value && typeof value === 'object') {
    out.push([path,value]);
    for (const key of Object.keys(value)) references(value[key],path.concat(key),out);
  }
  return out;
}
function assertPure(c) {
  const before = structuredClone(c.gameState), refs = references(c.gameState);
  for (const minutes of academy.QUEST_DURATION_MINUTES) {
    c.questSendState.durationMinutes = minutes;
    assert.match(c.questSendPreviewText(), /coins/);
  }
  assert.deepEqual(c.gameState,before,'the entire save must remain equal');
  for (const [path,ref] of refs) assert.equal(path.reduce((value,key)=>value[key],c.gameState),ref,'reference retained: '+path.join('.'));
  assert.equal(c.saves,0,'no save');
  assert.deepEqual(c.events,[],'no tutorial event');
  assert.equal(c.domReads,0,'no care-menu effect');
}
const cases = {
  'expired Merlin nap': s=>{s.merlinCare.restStartedAt=NOW-20000;s.merlinCare.restEndsAt=NOW-10000;s.merlinCare.energy=20;return 'merlin-guide';},
  'missing Merlin care': s=>{delete s.merlinCare;return 'merlin-guide';},
  'stale chef and role records': s=>{s.birdRoles.academy.kitchen='gone';s.birdRoles.academy.quest_roost=' qm ';s.birdRoles.regions.old='gone';s.chefCareers.gone={workedMs:5,activeSince:NOW-5000};return 'b';},
  'missing role and empire records': s=>{delete s.birdRoles;delete s.empire;delete s.chefCareers;return 'b';},
  'missing equipment entry': s=>{delete s.inventory.equipment.b;return 'b';},
  'equipped nocturnal companion': ()=> 'b',
  'hungry Merlin': s=>{s.merlinCare.hunger=90;return 'merlin-guide';}
};
for (const [label,prepare] of Object.entries(cases)) test('preview is read-only with '+label,()=>{
  const state=fresh();const id=prepare(state);assertPure(runtime(state,id));
});
test('real dispatch housekeeping still completes naps, pauses stale chefs and creates loadouts',()=>{
  const s=fresh();cases['expired Merlin nap'](s);cases['stale chef and role records'](s);delete s.inventory.equipment['merlin-guide'];
  const c=runtime(s,'merlin-guide');c.startBirdExpedition('merlin-guide','branch_run',{durationMinutes:5});
  assert.equal(c.gameState.merlinCare.restEndsAt,null);
  assert.equal(c.events.filter(e=>e==='merlin-rested').length,1);
  assert.equal(c.saves,2,'one nap save and one dispatch save');
  assert.equal(c.gameState.chefCareers.gone.activeSince,null);
  assert.equal(c.gameState.birdRoles.academy.kitchen,undefined);
  assert.ok(c.gameState.inventory.equipment['merlin-guide']);
  assert.equal(c.gameState.birdExpeditions.length,1);
});
test('fed/hungry/rested Merlin and equipped bird previews match canonical dispatch from equivalent saves',()=>{
  for(const prepare of [()=> 'merlin-guide',cases['hungry Merlin'],cases['expired Merlin nap'],cases['missing Merlin care'],cases['stale chef and role records'],()=> 'b']) {
    for(const minutes of academy.QUEST_DURATION_MINUTES) {
      const state=fresh(),id=prepare(state),c=runtime(structuredClone(state),id),d=runtime(structuredClone(state),id);
      c.questSendState.durationMinutes=minutes;
      const text=c.questSendPreviewText();
      d.startBirdExpedition(id,'branch_run',{durationMinutes:minutes});
      const job=d.gameState.birdExpeditions[0];assert.ok(job,'real dispatch banked a job');
      const coins=text.match(/(\d+)–(\d+) coins/).slice(1).map(Number);
      const bird=d.expeditionBirdById(id);
      const p=academy.getBirdExpeditionPreview(bird,'branch_run',{durationMinutes:minutes,nightBonus:d.nocturnalNightBonusFor(bird)});
      const bounds=[0,1].map(i=>d.applyExpeditionCarryLimit(d.applyQuartermasterPlanning({rewards:{coins:p.coins[i],branches:p.branches[i],stone:p.stone[i],xp:p.xp,items:{}}}),bird));
      assert.deepEqual(coins,bounds.map(q=>q.rewards.coins));
      assert.ok(job.rewards.coins>=coins[0]&&job.rewards.coins<=coins[1]);
      assert.ok(text.includes('+'+job.rewards.xp+' XP'));
      assert.ok(text.includes('Carry capacity '+job.carry.capacity+' units'));
      assert.ok(job.rewards.branches<=bounds[1].rewards.branches);
      if(bounds[1].rewards.branches)assert.ok(text.includes('up to '+bounds[1].rewards.branches+' timber'));
      const slow=id==='merlin-guide'?d.merlinExpeditionSlowFactor():1;
      assert.equal(job.endMs-job.startMs,minutes*60000*slow);
      assert.equal(text.includes('hungry flight:'),slow>1);
      if(slow>1)assert.ok(text.includes('hungry flight: '+d.questSendDurationLabel(minutes*slow)));
      assert.deepEqual(c.gameState,state,'preview cannot perform dispatch housekeeping');
      assert.equal(c.saves,0);assert.deepEqual(c.events,[]);
    }
  }
});
