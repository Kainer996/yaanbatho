/* One ownership ledger for companions and the keeper. No separate item bag. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzPlayerEquipmentCore=api;})(globalThis,function(){
 'use strict';
 const PLAYER='@player';
 const quantity=n=>Number.isSafeInteger(n)&&n>=0;
 // The app supplies its canonical roster, including non-recruited companions.
 function ownerExists(state,owner,companions=state.flock){return owner===PLAYER||(typeof owner==='string'&&owner.length>0&&Array.isArray(companions)&&companions.some(b=>b&&b.id===owner));}
 function loadout(state,owner=PLAYER){return state.inventory?.equipment?.[owner]||{};}
 function change(state,L,owner,slot,id=null,companions=state.flock){
  if(!ownerExists(state,owner,companions)||!L.GEAR_SLOTS.includes(slot))return {ok:false,reason:'Unknown equipment slot or owner.'};
  const inv=state.inventory,bag=inv?.gear,previous=loadout(state,owner)[slot];
  if(!bag)return {ok:false,reason:'The Stores are unavailable.'};
  if(id===previous||(!id&&!previous))return {ok:false,reason:'This loadout is already selected.'};
  if(id){const item=L.gearById(id);if(!item||item.slot!==slot)return {ok:false,reason:'That item does not fit this slot.'};if(!quantity(bag[id])||bag[id]<1)return {ok:false,reason:'None spare in the Stores. Unequip it from its current owner first.'};}
  if(previous&&(!L.gearById(previous)||L.gearById(previous).slot!==slot||!quantity(bag[previous]??0)||!Number.isSafeInteger((bag[previous]??0)+1)))return {ok:false,reason:'This saved item needs to be checked before changing equipment.'};
  inv.equipment ||= {};inv.equipment[owner] ||= {};const equipped=inv.equipment[owner];
  if(previous)bag[previous]=(bag[previous]||0)+1;
  if(id){bag[id]-=1;equipped[slot]=id;}else delete equipped[slot];
  return {ok:true,owner,slot,id,previous};
 }
 function snapshot(state,L){
  const equipped=loadout(state),owners={};
  for(const [owner,kit] of Object.entries(state.inventory?.equipment||{}))for(const id of Object.values(kit||{})){if(!id)continue;(owners[id]||=[]).push(owner===PLAYER?'You':state.flock?.find(b=>b.id===owner)?.customName||state.flock?.find(b=>b.id===owner)?.commonName||'Companion');}
  return {loadout:{...equipped},gearLevel:L.normalizeForgeLevel(state.forgeLevel),bonuses:L.equipmentBonuses(equipped,{gearLevel:state.forgeLevel}),items:Object.values(L.GEAR).map(item=>({id:item.id,slot:item.slot,label:item.label,icon:item.icon,copy:item.copy,stats:item.stats,rarity:item.rarity,count:quantity(state.inventory?.gear?.[item.id])?state.inventory.gear[item.id]:0,owners:owners[item.id]||[]}))};
 }
 return {PLAYER,loadout,change,snapshot};
});
