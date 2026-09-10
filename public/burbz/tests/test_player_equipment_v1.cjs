'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),L=require('../loot_crafting_core.js'),C=require('../player_equipment_core.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const fn=name=>{const start=html.indexOf('function '+name+'('),end=html.indexOf('\nfunction ',start+10);assert(start>=0&&end>start,name);return html.slice(start,end);};
const guideStart=html.indexOf('const MERLIN_GUIDE = Object.freeze({');
const guideSource=html.slice(guideStart,html.indexOf('\n});',guideStart)+4);
assert(guideStart>=0&&guideSource.endsWith('});'));
const fresh=()=>({player:{coins:100},forgeLevel:3,flock:[{id:'bird1',commonName:'Robin'}],quests:{gear:{progress:0}},inventory:{gear:{willow_wand:2,thorn_talons:1,ember_wisp:1},equipment:{},items:{oak_twig:12},larder:{}}});
function fixture(){const c={structuredClone,JSON,Math,Number,Object,Array,String,console,MERLIN_GUIDE_SIZE:{},generateBirdStats:()=>({maxHp:80}),ensureBirdAcademy:bird=>bird,gameState:fresh(),window:{BurbzPlayerEquipmentCore:C},lootCore:()=>L,queueCloudSave(){},queueActionBadgeUpdate(){},showToast(){},SFX:{questComplete(){},tap(){}},fail:false,saved:null,effects:0};c.localStorage={setItem:(key,value)=>{if(c.fail)throw Error('Quota');c.saved=JSON.parse(value);}};c.updateQuestProgress=(type,n,effects)=>{c.gameState.quests.gear.progress+=n;effects.push(()=>c.effects++);};vm.createContext(c);vm.runInContext(guideSource+'\n'+['merlinBattleBird','getBattleFlock','snapshotGameState','restoreStateTree','restoreGameStateSnapshot','durableSaveState','saveState','commitEquipmentChange','playerEquipmentAdapter','walkingCombatAdapter','equipItemOnBird','unequipItemFromBird','storesSellBag','storesSellRarity','storesSellQuote'].map(fn).join('\n'),c);c.merlinId=vm.runInContext('MERLIN_GUIDE.id',c);return c;}
let n=0;const check=(name,f)=>{f();n++;console.log('PASS',name);};
check('Every one of the 35 Forge definitions equips and unequips without changing total ownership',()=>{const c=fixture();for(const item of Object.values(L.GEAR)){c.gameState.inventory.gear[item.id]=1;assert(c.commitEquipmentChange(C.PLAYER,item.slot,item.id).ok);assert.equal(c.gameState.inventory.gear[item.id],0);assert.equal(c.saved.inventory.equipment[C.PLAYER][item.slot],item.id);assert(c.commitEquipmentChange(C.PLAYER,item.slot,null).ok);assert.equal(c.saved.inventory.gear[item.id],1);}assert.equal(c.gameState.quests.gear.progress,0);});
check('Bird and keeper compete for the same item; swapping returns the exact old copy',()=>{const c=fixture();assert(c.equipItemOnBird('bird1','spell','ember_wisp'));assert(!c.commitEquipmentChange(C.PLAYER,'spell','ember_wisp').ok);assert(c.unequipItemFromBird('bird1','spell'));assert(c.commitEquipmentChange(C.PLAYER,'spell','ember_wisp').ok);assert(!c.equipItemOnBird('bird1','spell','ember_wisp'));assert(c.commitEquipmentChange(C.PLAYER,'weapon','willow_wand').ok);assert(c.commitEquipmentChange(C.PLAYER,'weapon','thorn_talons').ok);assert.equal(c.gameState.inventory.gear.willow_wand,2);assert.equal(c.gameState.inventory.gear.thorn_talons,0);assert.equal(c.gameState.quests.gear.progress,1);});
check('Unavailable, fractional, overflowing, forged owner and wrong-slot requests never mutate',()=>{for(const qty of [0,-1,1.5,NaN,Infinity,'2']){const state=fresh();state.inventory.gear.ember_wisp=qty;const before=structuredClone(state);assert(!C.change(state,L,C.PLAYER,'spell','ember_wisp').ok);assert.deepEqual(state,before);}for(const [owner,slot,id] of [[C.PLAYER,'armour','ember_wisp'],['unknown','spell','ember_wisp'],[C.PLAYER,'__proto__','ember_wisp'],[C.PLAYER,'spell','constructor']]){const state=fresh(),before=structuredClone(state);assert(!C.change(state,L,owner,slot,id).ok);assert.deepEqual(state,before);}const state=fresh();state.inventory.equipment[C.PLAYER]={spell:'ember_wisp'};state.inventory.gear.ember_wisp=Number.MAX_SAFE_INTEGER;const before=structuredClone(state);assert(!C.change(state,L,C.PLAYER,'spell').ok);assert.deepEqual(state,before);});
check('Failed writes roll back gear, loadout, quest and live object identity before notices',()=>{for(const owner of [C.PLAYER,'bird1',fixture().merlinId]){const c=fixture(),before=JSON.stringify(c.gameState),bag=c.gameState.inventory.gear,eq=c.gameState.inventory.equipment;c.fail=true;assert(!c.commitEquipmentChange(owner,'spell','ember_wisp').ok);assert.equal(JSON.stringify(c.gameState),before);assert.equal(c.gameState.inventory.gear,bag);assert.equal(c.gameState.inventory.equipment,eq);assert.equal(c.effects,0);c.fail=false;assert(c.commitEquipmentChange(owner,'spell','ember_wisp').ok);const worn=c.gameState.inventory.equipment[owner];c.fail=true;assert(!c.commitEquipmentChange(owner,'spell',null).ok);assert.equal(c.gameState.inventory.equipment[owner],worn);assert.equal(worn.spell,'ember_wisp');assert.equal(c.gameState.inventory.gear.ember_wisp,0);}});
check('Market can sell only spare copies, including after save reload',()=>{const c=fixture();assert(c.commitEquipmentChange(C.PLAYER,'spell','ember_wisp').ok);assert.equal(c.storesSellQuote('gear','ember_wisp',1).qty,0);c.gameState=JSON.parse(JSON.stringify(c.saved));assert.equal(C.loadout(c.gameState).spell,'ember_wisp');assert.equal(c.storesSellQuote('gear','ember_wisp','all').qty,0);assert(c.commitEquipmentChange(C.PLAYER,'spell',null).ok);assert.equal(c.storesSellQuote('gear','ember_wisp',1).qty,1);assert(c.equipItemOnBird('bird1','weapon','willow_wand'));assert.equal(c.storesSellQuote('gear','willow_wand','all').qty,1);});
check('Existing saves migrate lazily; inspection and stale adapters never create or mutate items',()=>{const c=fixture(),before=JSON.stringify(c.gameState);const snapshot=C.snapshot(c.gameState,L);assert.equal(JSON.stringify(c.gameState),before);assert.deepEqual(snapshot.loadout,{});const api=c.playerEquipmentAdapter();c.gameState=structuredClone(c.gameState);assert(!api.change('spell','ember_wisp').ok);assert.equal(JSON.stringify(c.gameState),before);});
check('Player bonuses reuse the existing Forge tempering and same equipped items',()=>{const state=fresh();C.change(state,L,C.PLAYER,'weapon','willow_wand');assert.deepEqual(C.snapshot(state,L).bonuses,L.equipmentBonuses({weapon:'willow_wand'},{gearLevel:3}));assert(C.snapshot(state,L).bonuses.mag>0);});
check('Walking potion, HP and cooldown saves are atomic with the shared bag, including auto-restock and reload',()=>{const c=fixture();c.gameState.inventory.gear.tonic_of_vigour=2;assert(c.commitEquipmentChange(C.PLAYER,'potion','tonic_of_vigour').ok);const a=c.walkingCombatAdapter(),record={version:1,hp:45,cr:0,cooldowns:{ember_wisp:2},records:[]},before=JSON.stringify(c.gameState),bag=c.gameState.inventory.gear,eq=c.gameState.inventory.equipment;c.fail=true;assert.throws(()=>a.save(record,{potion:'tonic_of_vigour'}));assert.equal(JSON.stringify(c.gameState),before);assert.equal(c.gameState.inventory.gear,bag);assert.equal(c.gameState.inventory.equipment,eq);c.fail=false;assert(a.save(record,{potion:'tonic_of_vigour'}));assert.equal(bag.tonic_of_vigour,0);assert.equal(eq[C.PLAYER].potion,'tonic_of_vigour');assert.equal(c.storesSellQuote('gear','tonic_of_vigour','all').qty,0);assert(a.save(record,{potion:'tonic_of_vigour'}));assert.equal(eq[C.PLAYER].potion,undefined);assert.equal(bag.tonic_of_vigour,0);assert.throws(()=>a.save(record,{potion:'tonic_of_vigour'}));c.gameState=JSON.parse(JSON.stringify(c.saved));assert.deepEqual(c.gameState.wildernessCombat,record);assert.throws(()=>a.save({...record,hp:80}));assert.throws(()=>a.kit());assert.equal(c.gameState.quests.gear.progress,0);});
check('The canonical Forge roster lets Merlin equip all 35 items without adding him to the saved flock',()=>{
 const c=fixture(),owner=c.merlinId,flock=JSON.stringify(c.gameState.flock);
 assert(c.getBattleFlock().some(b=>b.id===owner));assert(!c.gameState.flock.some(b=>b.id===owner));
 for(const item of Object.values(L.GEAR)){
  c.gameState.inventory.gear[item.id]=1;
  assert(c.equipItemOnBird(owner,item.slot,item.id),'Merlin equips '+item.id);
  assert.equal(c.saved.inventory.equipment[owner][item.slot],item.id);
  assert.equal(c.gameState.inventory.gear[item.id],0);
  assert.equal(c.storesSellQuote('gear',item.id,'all').qty,0);
  const before=JSON.stringify(c.gameState);
  assert(!c.equipItemOnBird('bird1',item.slot,item.id));
  assert(!c.commitEquipmentChange(C.PLAYER,item.slot,item.id).ok);
  assert.equal(JSON.stringify(c.gameState),before,'last copy remains with Merlin');
  assert(c.unequipItemFromBird(owner,item.slot));
  assert.equal(c.saved.inventory.gear[item.id],1);
  assert.equal(c.storesSellQuote('gear',item.id,'all').qty,1);
  assert(!c.unequipItemFromBird(owner,item.slot),'cannot return a copy twice');
 }
 assert.equal(JSON.stringify(c.gameState.flock),flock);
});
check('An existing Merlin loadout survives reload and returns its only copy for another owner',()=>{
 const c=fixture(),owner=c.merlinId;
 c.gameState.inventory.gear.ember_wisp=0;
 c.gameState.inventory.equipment[owner]={spell:'ember_wisp'};
 c.saveState();c.gameState=JSON.parse(JSON.stringify(c.saved));
 assert(!c.gameState.flock.some(b=>b.id===owner));
 assert.equal(c.storesSellQuote('gear','ember_wisp',1).qty,0);
 assert(c.unequipItemFromBird(owner,'spell'));
 assert.equal(c.saved.inventory.gear.ember_wisp,1);
 assert(!c.saved.inventory.equipment[owner].spell);
 assert(c.commitEquipmentChange(C.PLAYER,'spell','ember_wisp').ok);
 c.gameState=JSON.parse(JSON.stringify(c.saved));
 assert.equal(C.loadout(c.gameState).spell,'ember_wisp');
 assert.equal(c.gameState.inventory.gear.ember_wisp,0);
 assert(!c.equipItemOnBird(owner,'spell','ember_wisp'));
 assert(c.commitEquipmentChange(C.PLAYER,'spell',null).ok);
 assert(c.equipItemOnBird('bird1','spell','ember_wisp'));
 assert.equal(c.saved.inventory.gear.ember_wisp,0);
 assert.equal(c.saved.inventory.equipment.bird1.spell,'ember_wisp');
});
check('A failed Merlin swap restores the persisted loadout, quantities and quest before retry/reload',()=>{
 const c=fixture(),owner=c.merlinId;
 assert(c.equipItemOnBird(owner,'weapon','willow_wand'));
 const before=JSON.stringify(c.gameState),saved=JSON.stringify(c.saved),notices=c.effects;
 const bag=c.gameState.inventory.gear,kit=c.gameState.inventory.equipment[owner],quest=c.gameState.quests.gear;
 c.fail=true;assert(!c.equipItemOnBird(owner,'weapon','thorn_talons'));
 assert.equal(JSON.stringify(c.gameState),before);assert.equal(JSON.stringify(c.saved),saved);
 assert.equal(c.gameState.inventory.gear,bag);assert.equal(c.gameState.inventory.equipment[owner],kit);
 assert.equal(c.gameState.quests.gear,quest);assert.equal(c.effects,notices);
 c.fail=false;assert(c.equipItemOnBird(owner,'weapon','thorn_talons'));
 c.gameState=JSON.parse(JSON.stringify(c.saved));
 assert.equal(c.gameState.inventory.equipment[owner].weapon,'thorn_talons');
 assert.equal(c.gameState.inventory.gear.willow_wand,2);assert.equal(c.gameState.inventory.gear.thorn_talons,0);
 assert(c.unequipItemFromBird(owner,'weapon'));assert.equal(c.saved.inventory.gear.thorn_talons,1);
});
check('App transactions still reject unknown owners, even with an existing forged loadout',()=>{
 const c=fixture();c.gameState.inventory.equipment.unknown={spell:'ember_wisp'};
 const before=JSON.stringify(c.gameState);
 for(const owner of ['unknown','merlin-impostor','__proto__','constructor','',null,undefined]){
  assert(!c.equipItemOnBird(owner,'weapon','willow_wand'));
  assert(!c.unequipItemFromBird(owner,'spell'));
  assert.equal(JSON.stringify(c.gameState),before);
 }
 assert.equal(c.saved,null);assert.equal(c.effects,0);
});
console.log(n+' shared equipment groups passed');
