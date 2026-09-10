const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.CLAIM_TEST_HTML||require('node:path').join(__dirname,'../index.html'),'utf8');
function source(name){const re=new RegExp('^(?:async )?function '+name+'\\([^]*?^}', 'm'),m=html.match(re);if(!m)throw Error(name);const first=m[0].split('\n')[0];return first.endsWith('}')?first:m[0];}
function fixture(){
 let disk=null,writes=0,fail=true;const effects=[];
 const context={console,Date,Math,Set,Number,JSON,Map,Array,Infinity,window:{},
 gameState:{player:{xp:15,level:1,coins:2,branches:0},inventory:{items:{},gear:{}},pantry:{},lootPity:{rolls:0},quests:{gear:{progress:0,claimed:false},playergear:{progress:0,claimed:false}},flock:[],mapPickups:{day:new Date().toISOString().split('T')[0],collected:{}},starterTimber:{taken:{}},sideQuests:{active:{id:'s1',discoveries:[]},npcLandmarks:[],waysideTales:[]},tavernPatrons:[],completionNotices:[]},
 localStorage:{setItem(k,v){writes++;if(fail)throw Error('quota');disk=v;}},queueCloudSave:()=>{},queueActionBadgeUpdate:()=>{},
 liveMapHasPrecisePosition:true,liveMapLastPosition:{lat:53,lon:-1,accuracy:8,at:Date.now()},mapDistanceMeters:()=>0,MAP_PICKUP_RANGE_M:185,mapGatheringGate:()=>({ready:true}),
 CHEST_SVG:'chest',PANTRY_CAP:{berries:10,seeds:10},clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),XP_PER_LEVEL:()=>20,STARTER_TIMBER_PER_BUNDLE:5,
 SIDE_QUEST_NPC_LANDMARK_CAP:30,COMPLETION_NOTICE_LIMIT:30,completionNoticeSerial:0,currentScreen:'map',QUEST_BUZZ:{chest:1},
 DAILY_QUESTS:[{id:'gear',name:'Gear',type:'gear_found',target:1}],WEEKLY_QUESTS:[],ACHIEVEMENT_QUESTS:[],featureGateOpen:()=>true,
 activePlayerQuest:()=>({id:'playergear',name:'Find gear',type:'gear_found',target:1}),syncActivePlayerQuest:()=>{},
 canonicalSpeciesName:s=>s,speciesKey:s=>s.toLowerCase(),companionForSpecies:()=>null,villageRngFrom:()=>()=>.5,
 kitchenIngredientById:id=>({id,label:id}),ensureLarder:()=>context.gameState.larder||(context.gameState.larder={}),
 randomXpScrollKey:()=>'xp_scroll_minor',birdXpItem:id=>({id,label:id}),birdXpItemDetail:()=>'',
 SFX:{questComplete:()=>effects.push('sound'),capture:()=>effects.push('sound'),levelUp:()=>effects.push('sound'),tap:()=>{}},
 showToast:s=>effects.push('toast:'+s),showQuestNpcDialog:()=>effects.push('dialog'),vibrate:()=>effects.push('buzz'),
 updateHeader:()=>effects.push('header'),renderInventory:()=>effects.push('inventory'),drawSideQuestOnMap:()=>effects.push('side-map'),updateWalkQuestHud:()=>effects.push('hud'),
 drawSideQuestNpcLandmarks:()=>effects.push('npc-marker'),renderCompletionNotices:()=>effects.push('notice'),renderPlayerQuests:()=>effects.push('quests'),
 announcePlayerLevelUps:old=>{if(context.gameState.player.level>old)effects.push('level');},setTimeout:()=>effects.push('timer'),$:()=>null,
 ensureStarterTimberState:()=>context.gameState.starterTimber,starterTimberDone:()=>true,ensureSideQuestState:()=>context.gameState.sideQuests,sideQuestActive:()=>context.gameState.sideQuests.active,
 lootCore:()=>({gearById:id=>({id,label:id}),materialById:id=>({id,label:id}),rollLoot:(_src,{pity})=>{pity.rolls++;return [{kind:'gear',id:'sword',qty:1},{kind:'material',id:'ore',qty:2}];}})
 };
 vm.createContext(context);
 for(const name of ['durableSaveState','saveState','snapshotGameState','restoreStateTree','restoreGameStateSnapshot','playerLevelUpGrant','applyPlayerXpState','addPlayerXp','addCoins','addBranches','addBirdXpItemToBag','addLarderIngredient','grantLootDrops','lootLinesToText','queueCompletionNotice','queueQuestCompleteNotice','ensureCompletionNotices','updateQuestProgress','pickupDayKey','ensureMapPickupState','collectStarterTimber','collectMapPickup','ensureTavernPatrons','addTavernPatron','rememberSideQuestNpc','sideQuestClaimDiscovery'])vm.runInContext(source(name),context);
 const a=html.indexOf('const MAP_PICKUP_TYPES = ['),b=html.indexOf('\n];',a)+3;vm.runInContext(html.slice(a,b)+'\nthis.pickupTypes=MAP_PICKUP_TYPES;',context);
 return {c:context,effects,get disk(){return disk;},get writes(){return writes;},allow(){fail=false;},fail(){fail=true;},resetEffects(){effects.length=0;}};
}
for(const kind of ['coins','xp','chest','gearcache','relic','birdscroll','minnow','starter','woodland'])test(kind+' map pickup rolls back on write failure; retry/reload grant exactly once',()=>{
 const f=fixture(),c=f.c,before=JSON.stringify(c.gameState),type=kind==='starter'||kind==='woodland'?{glyph:'wood',label:'Timber',grant(){c.addBranches(1);return '+1';}}:c.pickupTypes.find(t=>t.id===kind);
 const p={key:'p1',seed:3,type,lat:53,lon:-1,...(kind==='starter'?{starterIndex:0}:{}),...(kind==='woodland'?{woodland:true}:{})};
 c.collectMapPickup(p,null);assert.equal(JSON.stringify(c.gameState),before);assert.equal(f.disk,null);assert.equal(f.writes,1,'no nested premature save');assert.equal(f.effects.length,1);assert.match(f.effects[0],/could not|Could not/);
 f.allow();f.resetEffects();c.collectMapPickup(p,null);assert.equal(f.writes,2);assert(f.disk);const saved=f.disk;assert(f.effects.includes('sound'));assert.equal(JSON.stringify(c.gameState),saved);
 c.gameState=JSON.parse(saved);f.resetEffects();c.collectMapPickup(p,null);assert.equal(f.writes,2);assert.equal(JSON.stringify(c.gameState),saved);assert.equal(f.effects.length,0);
 if(['gearcache','relic'].includes(kind)){assert.equal(c.gameState.lootPity.rolls,1);assert.equal(c.gameState.quests.gear.progress,1);assert.equal(c.gameState.completionNotices.length,2);}
});
for(const kind of ['weapon','lore','npc'])test(kind+' discovery commits claim/rewards/quest notice/landmark together, with no failed-claim UI',async()=>{
 const f=fixture(),c=f.c,d={id:'find1',kind,claimed:false,lat:53,lon:-1,species:'Wren',tale:{id:'tale1',title:'Tale',text:'Words'}};c.gameState.sideQuests.active.discoveries.push(d);const before=JSON.stringify(c.gameState);
 assert.equal(await c.sideQuestClaimDiscovery(d.id),false);assert.equal(JSON.stringify(c.gameState),before);assert.equal(d.claimed,false,'in-place rollback keeps held discovery reference');assert.equal(f.disk,null);assert.equal(f.writes,1);assert.equal(f.effects.length,1);assert.match(f.effects[0],/could not be saved/);
 f.allow();f.resetEffects();assert.equal(await c.sideQuestClaimDiscovery(d.id),true);assert.equal(f.writes,2);assert(d.claimed);const saved=f.disk;assert.equal(JSON.stringify(c.gameState),saved);assert(f.effects.includes('sound'));
 c.gameState=JSON.parse(saved);f.resetEffects();assert.equal(await c.sideQuestClaimDiscovery(d.id),false);assert.equal(f.writes,2);assert.equal(JSON.stringify(c.gameState),saved);assert.equal(f.effects.length,0);
 if(kind==='weapon'){assert.equal(c.gameState.inventory.gear.sword,1);assert.equal(c.gameState.lootPity.rolls,1);assert.equal(c.gameState.completionNotices.length,2);}
 if(kind==='npc'){assert.equal(c.gameState.tavernPatrons.length,1);assert.equal(c.gameState.sideQuests.npcLandmarks.length,1);}
 if(kind==='lore')assert.equal(c.gameState.sideQuests.waysideTales.length,1);
});
test('loot-generation errors also restore claimed flag and partial mutations',async()=>{const f=fixture(),c=f.c;c.gameState.sideQuests.active.discoveries.push({id:'bad',kind:'weapon',claimed:false});const before=JSON.stringify(c.gameState);c.lootCore=()=>({rollLoot(){c.gameState.lootPity.rolls++;throw Error('broken loot');}});assert.equal(await c.sideQuestClaimDiscovery('bad'),false);assert.equal(JSON.stringify(c.gameState),before);assert.equal(f.writes,0);assert.equal(f.effects.length,1);});
test('normal quest progress callers still save and notify immediately',()=>{const f=fixture();f.allow();f.c.updateQuestProgress('gear_found',1);assert.equal(f.writes,1);assert(f.effects.includes('notice'));assert.equal(JSON.parse(f.disk).quests.gear.progress,1);});

function chestFixture(){
 const f=fixture(),c=f.c;vm.runInContext(fs.readFileSync(require('node:path').join(__dirname,'../quest_core.js'),'utf8'),c);
 c.kitchenIngredientById=require('../kitchen_pantry_core.js').ingredientById;
 vm.runInContext(html.match(/^const XP_PER_LEVEL = .*;$/m)[0],c);
 c.playQuestClaimCelebration=()=>f.effects.push('celebration');
 for(const name of ['sideQuestChestLoot','questClaimReceipt','setQuestClaimReceipt','queueQuestClaimCloudSync'])vm.runInContext(source(name),c);
 return f;
}
test('all twelve deterministic side chest bins pass the actual strict validator and kitchen catalogue',()=>{
 const f=chestFixture(),c=f.c,seen=new Set();
 for(let i=0;i<200;i++){
  const key='bin:'+i;let hash=2166136261;for(const ch of key){hash^=ch.charCodeAt(0);hash=Math.imul(hash,16777619);}seen.add((hash>>>0)%12);
  const loot=c.sideQuestChestLoot(key,37);
  assert.doesNotThrow(()=>c.window.BurbzQuestCore.validateChestRewardBundle(loot,c.kitchenIngredientById,()=>false));
  assert.equal(loot.coins,37);assert.equal(loot.xp,12);assert.deepEqual(loot,c.sideQuestChestLoot(key,37));
 }
 assert.equal(seen.size,12);
});
for(const larder of [{young_rabbit:1,wood_mouse:1},{pigeon_prey_ration:1,field_vole:1}])test('legacy two-unit side chest '+Object.keys(larder)[0]+' repairs atomically and claims once after reload',async()=>{
 const f=chestFixture(),c=f.c,loot={coins:31,xp:12,larder},d={id:'legacy-chest',kind:'chest',lat:53,lon:-1,claimed:false,loot};
 c.gameState.sideQuests.active.discoveries.push(d);const before=JSON.stringify(c.gameState),claimKey='side:s1:discovery:legacy-chest';
 assert.throws(()=>c.window.BurbzQuestCore.validateChestRewardBundle(loot,c.kitchenIngredientById,()=>false),/Incomplete chest food bundle/);
 assert.equal(await c.sideQuestClaimDiscovery(d.id),false);assert.equal(JSON.stringify(c.gameState),before);assert.equal(f.disk,null);assert.equal(f.writes,1);assert.equal(f.effects.filter(x=>x==='celebration').length,0);
 f.allow();f.resetEffects();assert.equal(await c.sideQuestClaimDiscovery(d.id),true);assert.equal(f.writes,2);assert.equal(d.lat,53);assert.equal(d.lon,-1);assert.equal(d.id,'legacy-chest');
 const expected=JSON.parse(JSON.stringify(c.window.BurbzQuestCore.normaliseChestLoot(loot,claimKey)));assert.deepEqual(JSON.parse(JSON.stringify(d.loot)),expected);
 for(const [id,qty] of Object.entries(larder))assert.ok(d.loot.larder[id]>=qty,'saved food retained');
 assert.equal(c.gameState.player.coins,33);assert.equal(c.gameState.player.xp,27);assert.deepEqual(JSON.parse(JSON.stringify(c.gameState.larder)),expected.larder);
 const saved=f.disk;assert.equal(JSON.stringify(c.gameState),saved);assert.ok(c.gameState.questClaimReceipts[claimKey]);assert.equal(f.effects.filter(x=>x==='celebration').length,1);
 c.gameState=JSON.parse(saved);f.resetEffects();assert.equal(await c.sideQuestClaimDiscovery(d.id),false);assert.equal(f.writes,2);assert.equal(JSON.stringify(c.gameState),saved);assert.equal(f.effects.length,0);
 // Even a stale claimed flag cannot bypass the durable receipt.
 c.gameState.sideQuests.active.discoveries[0].claimed=false;assert.equal(await c.sideQuestClaimDiscovery(d.id),false);assert.equal(f.writes,2);assert.equal(c.gameState.player.coins,33);
});
test('normalization never bypasses unknown-ingredient validation or commits an invalid saved chest',async()=>{
 const f=chestFixture(),c=f.c;c.gameState.sideQuests.active.discoveries.push({id:'invalid-food',kind:'chest',claimed:false,lat:53,lon:-1,loot:{coins:31,xp:12,larder:{unknown_food:1,wood_mouse:1}}});
 const before=JSON.stringify(c.gameState);f.allow();assert.equal(await c.sideQuestClaimDiscovery('invalid-food'),false);assert.equal(JSON.stringify(c.gameState),before);assert.equal(f.writes,0);assert.equal(f.disk,null);assert.equal(f.effects.filter(x=>x==='celebration').length,0);
});
