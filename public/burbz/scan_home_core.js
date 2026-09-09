/* Read-only home-panel projection. The existing game owns all counts/actions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzScanHomeCore=api;})(globalThis,function(){'use strict';
 const count=n=>Number.isFinite(n)&&n>0?Math.floor(n):0;
 function derive(input={}){
  const actions=[],g=input.gates||{},n=input.counts||{};
  const add=(id,title,detail,icon,target,tone='ready')=>actions.push({id,title,detail,icon,target,tone});
  if(count(input.quests?.count))add('quests',count(input.quests.count)+' '+(input.quests.count===1?'reward ready':'rewards ready'),input.quests.first?.name||'Open your quests to collect','quests',{kind:'quest',id:input.quests.first?.id});
  if(g.kitchen&&input.kitchenBuilt===false)add('kitchen','Build the Kitchen','A place to feed your birds','kitchen',{kind:'kitchen'},'quiet');
  else if(g.kitchen&&count(n.kitchen))add('kitchen','Kitchen',count(n.kitchen)+' '+(n.kitchen===1?'bird would like a meal':'birds would like a meal'),'kitchen',{kind:'kitchen'},'care');
  if(g.hospital&&count(n.hospital))add('hospital','Hospital',count(n.hospital)+' '+(n.hospital===1?'bird needs treatment':'birds need treatment'),'hospital',{kind:'hospital'},'care');
  if(g.training&&count(n.training))add('training','Training finished',count(n.training)+' '+(n.training===1?'drill to collect':'drills to collect'),'training',{kind:'training'});
  if(g.forge&&count(input.forgeReady))add('forge','Forge ready',count(input.forgeReady)+' '+(input.forgeReady===1?'piece to collect':'pieces to collect'),'forge',{kind:'forge'});
  if(input.walk)add('walk','Your walk',input.walk.name||'Return to your active walk','map',{kind:'walk'},'quiet');
  if(g.village&&input.notice)add('building',input.notice.title||'Building complete',input.notice.sub||'Visit your village','village',{kind:'notice',id:input.notice.id});
  if(!actions.some(a=>a.id==='quests')&&input.nextQuest)add('next-quest','Player quest',input.nextQuest.name,'quests',{kind:'quest',id:input.nextQuest.id},'quiet');
  if(g.kitchen&&!actions.some(a=>a.id==='kitchen'))add('kitchen','Kitchen','Food & companion care','kitchen',{kind:'kitchen'},'quiet');
  const villages=(g.village?input.villages||[]:[]).filter(v=>Number.isFinite(v.seed)&&typeof v.name==='string').map(v=>({...v,pop:count(v.pop),happiness:Number.isFinite(v.happiness)?Math.max(0,Math.min(1,v.happiness)):null})).sort((a,b)=>(a.pop?0:1)-(b.pop?0:1)||(a.happiness??2)-(b.happiness??2)||a.name.localeCompare(b.name));
  return {actions,villages:villages.slice(0,3),villageCount:villages.length,flockCount:count(input.flockCount),discovered:count(input.discovered)};
 }
 return {derive};
});
