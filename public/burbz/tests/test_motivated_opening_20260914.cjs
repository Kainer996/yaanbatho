'use strict';
// Bounded runtime checks: real opening/build/dispatch/claim/feeding functions,
// in-memory disposable saves, no browser, permissions or external providers.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const gate = require('../onboarding_gate_core.js');
const academy = require('../academy_treehouse_core.js');
const merlinCore = require('../merlin_companion_core.js');
const html = fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const fn = name => { const m=html.match(new RegExp('function '+name+'\\([^]*?\\n}')); if(!m)throw Error(name); return m[0]; };
const block = (start,end) => html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))+end.length);
const functions = ['refreshAcademyHomeIfVisible','tutorialFlowState','openingProgress','openingObjective','nextOpeningChapter','openingCareSatisfied','openingErrandsIntroduced','openingSupplyErrandAvailable','commitOpeningFlow','maybeGrantMerlinBarracksGift','maybeGrantMerlinKitchenGift','maybeGrantTutorialFalconRation','academyBuildingProgressLock','academyBuildBuilding','introduceKitchenShortage','startBirdExpedition','claimBirdExpedition','claimedExpeditionCount','activePlayerQuest','noteOpeningDiscoveryReviewed','burbzFeedFood','recordFeedReceipt','merlinTutorialResumePosition'];
function fresh() { return {player:{coins:220,branches:0,stone:0,xp:0,level:1},flock:[],discoveredSpecies:{},academyBuildings:{outdoors:{built:true}},birdExpeditions:[],tutorialFlow:{openingStarted:true},inventory:{items:{},gear:{},larder:{small_bird_prey_ration:2}},pantry:{},quests:{},questClaimReceipts:{},merlinCare:{...merlinCore.DEFAULT_MERLIN_CARE,hunger:60}}; }
function runtime(initial=fresh()) {
  const node = {style:{},classList:{contains:()=>false,add(){},remove(){}},querySelector:()=>null};
  const c = {console:{warn(){},log:console.log},window:{BurbzOnboardingGate:gate,BurbzAcademyCore:academy,BurbzMerlinCompanionCore:merlinCore},gameState:initial,
    ACADEMY_BUILDINGS:{tavern:{cost:60,branches:8,unlockLevel:1,room:'tavern',x:1,y:1,label:'Birdhouse'},kitchen:{cost:130,branches:25,unlockLevel:1,room:'kitchen',x:2,y:2,label:'Kitchen'}},
    academySelectedRoom:'outdoors',MERLIN_GUIDE:{id:'merlin-guide',commonName:'Merlin',species:'Merlin',power:40,stamina:40},MERLIN_CORE:merlinCore,currentScreen:'academy',merlinTutActive:false,
    saved:JSON.stringify(initial),failSave:false,seen:['story'],effects:[],timers:[],
    document:{getElementById:()=>node,querySelector:()=>null,querySelectorAll:()=>[]},$:()=>node,
    setTimeout:(callback,ms)=>{c.timers.push({callback,ms});return c.timers.length;},
    merlinChaptersSeen:()=>c.seen, isAcademyBuildingBuilt:id=>!!c.gameState.academyBuildings[id]?.built,
    playerBranches:()=>c.gameState.player.branches,ensureAcademyBuildings(){}, snapshotGameState:()=>structuredClone(c.gameState),restoreGameStateSnapshot:s=>{c.gameState=s;},
    durableSaveState:()=>{if(c.failSave)throw Error('injected disk failure');c.saved=JSON.stringify(c.gameState);return {ok:true};}, saveState:()=>{if(c.failSave)return {ok:false};c.saved=JSON.stringify(c.gameState);return {ok:true};},
    addCoins:n=>c.gameState.player.coins+=n,addBranches:n=>c.gameState.player.branches+=n,addStone:n=>c.gameState.player.stone+=n,applyPlayerXpState:n=>c.gameState.player.xp+=n,
    queueQuestClaimCloudSync(){},queueActionBadgeUpdate(){},updateHeader(){},renderAcademy(){},renderBirdExpeditions(){},renderPetCompanion(){},renderInventory(){},
    showToast:m=>c.effects.push(m),queueCompletionNotice(){},announcePlayerLevelUps(){},onFirstBarracksBuilt(){},
    updateQuestProgress:(type,n,effects)=>{c.gameState.progress=c.gameState.progress||{};c.gameState.progress[type]=(c.gameState.progress[type]||0)+n;},
    getMerlinCare:()=>c.gameState.merlinCare,merlinIsAway:()=>c.gameState.birdExpeditions.some(q=>q.birdId==='merlin-guide'&&q.status!=='claimed'),dietHungerCore:()=>({FEEDING_HUNGER_MIN:60}),
    birdAssignedPost:()=>null,isStarterExpeditionTemplate:id=>academy.getQuestTemplates().find(t=>t.id===id)?.starter,
    expeditionBirdById:id=>id==='merlin-guide'?c.MERLIN_GUIDE:null,birdHasActiveExpedition:()=>c.merlinIsAway(),warnOrBlockBirdWork:()=>true,merlinExpeditionSlowFactor:()=>1,nocturnalNightBonusFor:()=>null,
    applyQuartermasterPlanning:q=>q,applyExpeditionCarryLimit:q=>{q.rewards.branches=1;return q;},ensureBirdExpeditions:()=>c.gameState.birdExpeditions,
    SFX:{page(){},tap(){},build(){},levelUp(){},capture(){}},burbzTutorialAction:e=>c.effects.push(e),
    questClaimReceipt:id=>c.gameState.questClaimReceipts[id],setQuestClaimReceipt:(id,value)=>c.gameState.questClaimReceipts[id]=value,
    legacyKitchenSupplyIngredient:()=>null,kitchenIngredientById:id=>id==='small_bird_prey_ration'?{id}:null,
    addLarderIngredient:(id,n)=>{c.gameState.inventory.larder[id]=(c.gameState.inventory.larder[id]||0)+n;return true;},
    academyBirdById:()=>null,getExpeditionTemplate:id=>academy.getQuestTemplates().find(t=>t.id===id),
    closeQuestOverlay(){},playQuestClaimCelebration(){},maybeOpenQuestKnowledgeQuiz(){},updateMerlinFlowPointer(){},applyFeatureGates(){},switchScreen:screen=>c.currentScreen=screen,
    discoveredSpeciesSet:()=>new Set(Object.keys(c.gameState.discoveredSpecies)),getDiscoveredRecordForSpecies:species=>c.gameState.discoveredSpecies[species],
    feedEntryForKey:()=>({key:'merlin',merlin:true,name:'Merlin',target:{commonName:'Merlin'}}),refillPantry(){},feedFoodOptions:()=>[{kind:'larder',id:'small_bird_prey_ration',prep:'whole',emoji:'🪶',label:'Prey ration'}],
    kitchenDietCore:()=>({applyFeedingTransaction:(state,target,spec)=>{if(state.merlinCare.hunger<60)return {ok:false,state,message:'Full'};let next=structuredClone(state);next.inventory.larder.small_bird_prey_ration--;next.merlinCare.hunger=0;next.merlinCare.lastFedAt=Date.now();return {ok:true,state:next,before:60,after:0,compatibility:{verdict:'primary',family:'prey'}};}}),
    feedRewardsForVerdict:()=>({bondXp:5,trainerXp:10}),kitchenRecordFieldNote(){},inferBirdDiet:()=>({}),chefBulkFeedSameSpecies:()=>null,playFeedDopamineBurst(){},refreshFeedSurfaces(){},
  };
  vm.createContext(c);
  vm.runInContext(block('const PLAYER_QUESTS = [','\n];')+'\n'+block('const MERLIN_LEGACY_STEP_CHAPTERS = [','\n];')+'\n'+functions.map(fn).join('\n'),c);
  return c;
}
function use(c,code){return vm.runInContext(code,c);}

test('fresh opening: Birdhouse gift/build, real gap, earned supply, Kitchen, usable meal',()=>{
  const c=runtime();
  assert.equal(c.openingProgress().stage,'birdhouse');assert.equal(c.openingErrandsIntroduced(),false);
  assert.equal(c.maybeGrantMerlinBarracksGift(),true);assert.equal(c.academyBuildBuilding('tavern'),true);
  assert.equal(c.gameState.player.coins,220);assert.equal(c.gameState.player.branches,0);
  assert.equal(c.openingProgress().stage,'discovery');assert.equal(c.openingProgress().kitchenIntroduced,false);
  assert.ok(c.academyBuildingProgressLock('kitchen'));
  c.commitOpeningFlow({discoveryDeferred:true,companionMet:true});
  assert.equal(c.openingProgress().stage,'kitchen');assert.equal(c.openingErrandsIntroduced(),false);
  assert.equal(c.academyBuildBuilding('kitchen'),false);assert.equal(c.gameState.tutorialFlow.kitchenShortageSeen,true);
  assert.equal(c.openingSupplyErrandAvailable(),true);c.startBirdExpedition('merlin-guide','merlin_first_flight',{});
  let q=c.gameState.birdExpeditions[0];assert.ok(q.endMs-q.startMs<=10000);assert.ok(q.rewards.branches>=25,'carry must not swallow the delivery');
  q.startMs=Date.now()-20000;q.endMs=Date.now()-1;c.claimBirdExpedition(q.id);
  assert.equal(c.gameState.tutorialFlow.openingSupplyReturnClaimed,true);assert.equal(c.nextOpeningChapter(),'errand');
  assert.equal(c.academyBuildBuilding('kitchen'),true);assert.equal(c.openingProgress().stage,'care');
  const before=c.gameState.inventory.larder.small_bird_prey_ration;c.burbzFeedFood('merlin','larder','small_bird_prey_ration');
  assert.equal(c.gameState.inventory.larder.small_bird_prey_ration,before-1);assert.equal(c.gameState.merlinCare.hunger,0);assert.ok(c.gameState.merlinCare.bondXp>=5);
  assert.equal(c.openingProgress().stage,'done');assert.equal(Object.keys(c.gameState.discoveredSpecies).length,0,'Merlin is never a fake discovery');
  assert.equal(c.activePlayerQuest().id,'pq_build_barracks','unclaimed earned rewards survive guidance');
});

test('gift rollback/retry/replay and Kitchen gift retirement',()=>{
  const c=runtime(), before=JSON.stringify(c.gameState);c.failSave=true;
  assert.equal(c.maybeGrantMerlinBarracksGift(),false);assert.equal(JSON.stringify(c.gameState),before);
  c.failSave=false;c.maybeGrantMerlinBarracksGift();const after=JSON.stringify(c.gameState);c.maybeGrantMerlinBarracksGift();c.maybeGrantMerlinKitchenGift();c.maybeGrantTutorialFalconRation();assert.equal(JSON.stringify(c.gameState),after);
});

test('building failed save preserves supplies and one-time XP then retries once',()=>{
  const c=runtime();c.maybeGrantMerlinBarracksGift();const before=JSON.stringify(c.gameState);c.failSave=true;
  assert.equal(c.academyBuildBuilding('tavern'),false);assert.equal(JSON.stringify(c.gameState),before);
  c.failSave=false;c.academyBuildBuilding('tavern');assert.equal(c.gameState.player.xp,60);c.academyBuildBuilding('tavern');assert.equal(c.gameState.player.xp,60);
});

test('errands cannot be dispatched before need; failed send leaves Merlin home',()=>{
  const c=runtime();c.startBirdExpedition('merlin-guide','merlin_first_flight',{});assert.equal(c.gameState.birdExpeditions.length,0);
  c.commitOpeningFlow({kitchenShortageSeen:true});const before=JSON.stringify(c.gameState);c.failSave=true;
  c.startBirdExpedition('merlin-guide','merlin_first_flight',{});assert.equal(JSON.stringify(c.gameState),before);
});

test('legacy pending First Flight earns one useful upgrade; failed/repeated claim is atomic',()=>{
  const c=runtime();c.gameState.tutorialFlow.kitchenShortageSeen=true;
  const q=academy.createBirdExpedition(c.MERLIN_GUIDE,'merlin_first_flight',Date.now()-10000);q.rewards={coins:4,branches:1,xp:8,items:{oak_twig:1}};c.gameState.birdExpeditions=[q];
  const before=JSON.stringify(c.gameState);c.failSave=true;c.claimBirdExpedition(q.id);assert.equal(JSON.stringify(c.gameState),before);
  c.failSave=false;c.claimBirdExpedition(q.id);assert.equal(c.gameState.player.branches,25);assert.ok(c.gameState.player.coins>=350);
  const after=JSON.stringify(c.gameState);c.claimBirdExpedition(q.id);c.startBirdExpedition('merlin-guide','merlin_first_flight',{});assert.equal(JSON.stringify(c.gameState),after);
  assert.ok(c.gameState.questClaimReceipts['opening:kitchen-supplies-v1']);
});

test('legacy claimed First Flight receipt is retained; later supply lesson is bounded separately',()=>{
  const c=runtime();c.gameState.tutorialFlow={errandClaimed:true,kitchenShortageSeen:true};c.gameState.questClaimReceipts['expedition:old']={coins:4};
  assert.equal(c.openingSupplyErrandAvailable(),true);c.startBirdExpedition('merlin-guide','merlin_first_flight',{});const q=c.gameState.birdExpeditions[0];q.startMs=Date.now()-20000;q.endMs=Date.now()-1;c.claimBirdExpedition(q.id);
  assert.equal(c.gameState.questClaimReceipts['expedition:old'].coins,4);assert.equal(c.openingSupplyErrandAvailable(),false);
});

test('depleted save gets a usable full delivery without needing Player Quest payouts',()=>{
  const c=runtime();c.gameState.player.coins=0;c.gameState.tutorialFlow={kitchenShortageSeen:true};c.startBirdExpedition('merlin-guide','merlin_first_flight',{});let q=c.gameState.birdExpeditions[0];q.startMs=Date.now()-20000;q.endMs=Date.now()-1;c.claimBirdExpedition(q.id);
  assert.ok(c.gameState.player.coins>=130);assert.ok(c.gameState.player.branches>=25);
});

test('overprepared/prebuilt/legacy games never lose resources or pretend a shortage',()=>{
  const c=runtime();c.gameState.academyBuildings.tavern={built:true};c.gameState.player.branches=80;c.gameState.tutorialFlow={companionMet:true,discoveryReviewed:true};
  assert.equal(c.introduceKitchenShortage(),false);assert.equal(c.gameState.player.branches,80);assert.equal(c.openingSupplyErrandAvailable(),false);
  c.academyBuildBuilding('kitchen');assert.equal(c.gameState.player.branches,55);assert.equal(c.gameState.tutorialFlow.kitchenShortageSeen,undefined);
  c.seen.push('explore');assert.equal(c.openingProgress().stage,'done');
});

test('saved discovery review only accepts actual canonical records',()=>{
  const c=runtime();c.gameState.academyBuildings.tavern={built:true};c.noteOpeningDiscoveryReviewed({species:'invented'});assert.equal(c.gameState.tutorialFlow.discoveryReviewed,undefined);
  c.gameState.discoveredSpecies.Robin={species:'Robin'};c.noteOpeningDiscoveryReviewed({species:'Robin'});assert.equal(c.gameState.tutorialFlow.discoveryReviewed,true);
});

test('meal save failure restores hunger, ration and reward; retry is one meal',()=>{
  const c=runtime();c.gameState.academyBuildings.kitchen={built:true};const before=JSON.stringify(c.gameState);c.failSave=true;
  c.burbzFeedFood('merlin','larder','small_bird_prey_ration');assert.equal(JSON.stringify(c.gameState),before);
  c.failSave=false;c.burbzFeedFood('merlin','larder','small_bird_prey_ration');assert.equal(c.gameState.inventory.larder.small_bird_prey_ration,1);assert.equal(c.gameState.player.mealsServed,1);
});

test('ordered quest IDs and rewards preserved, pending real discovery not consumed on deferral',()=>{
  const c=runtime();c.gameState.academyBuildings.tavern={built:true};c.gameState.quests.pq_build_barracks={claimed:true};c.gameState.tutorialFlow={discoveryDeferred:true,companionMet:true};
  assert.equal(c.activePlayerQuest().id,'pq_build_kitchen');assert.equal(c.gameState.quests.pq_first_bird,undefined);
  c.gameState.academyBuildings.kitchen={built:true};c.gameState.tutorialFlow.openingCareDone=true;assert.equal(c.activePlayerQuest().id,'pq_first_bird');
  assert.equal(use(c,'PLAYER_QUESTS.find(q=>q.id==="pq_liberate").branches'),25);
});

test('feature gates follow actual built Kitchen, discovery access and existing use',()=>{
  const ids=use(runtime(),'PLAYER_QUESTS.map(q=>q.id)');let map=gate.unlockedFeatures({chainIds:ids,claimedIds:[],evidence:{kitchenBuilt:false},playerLevel:1});
  assert.equal(map.academy,true);assert.equal(map.kitchen,false);assert.equal(map.village,false);assert.equal(map.quests_daily,false);
  map=gate.unlockedFeatures({chainIds:ids,claimedIds:[],evidence:{kitchenBuilt:true,kitchen:true,birdex:true},playerLevel:1});assert.equal(map.kitchen,true);assert.equal(map.birdex,true);
});

test('all stable tutorial IDs resume; concise opening story and later five-beat lessons',()=>{
  const c=runtime();use(c,`for(const mode of ['full',...new Set(MERLIN_TUTORIAL_STEPS.map(s=>s.chapterId))]) {
    const seq=MERLIN_TUTORIAL_STEPS.map((s,i)=>mode==='full'||s.chapterId===mode?i:-1).filter(i=>i>=0);
    for(let position=0;position<seq.length;position++) { if(merlinTutorialResumePosition({status:'in_progress',mode,stepId:MERLIN_TUTORIAL_STEPS[seq[position]].id},mode,seq)!==position)throw Error('resume mismatch'); }
    if(mode==='story' && seq.some(i=>MERLIN_TUTORIAL_STEPS[i].text.length>220))throw Error('opening bubble too long');
    if(!['full','story'].includes(mode) && seq.length>5)throw Error(mode+' too long');
  }`);
});
