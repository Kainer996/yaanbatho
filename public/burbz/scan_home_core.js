/* Read-only field-desk projection. The existing game owns counts and actions. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzScanHomeCore=api;})(globalThis,function(){'use strict';
 const count=n=>Number.isFinite(n)&&n>0?Math.floor(n):0;
 const fraction=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):null;
 const ROUTES=[
  ['map','Map','Walk, explore & find birds','map','world'],
  ['quests','Quests','Your next step & rewards','quests','world'],
  ['birdex','Your birds','Discoveries & companions','birdex','world'],
  ['academy','Academy','Build a home for your birds','academy','world'],
  ['village','Empire','Your villages & their people','village','world'],
  ['battle','Battle','Take your birds to the arena','battle','world'],
  ['kitchen','Kitchen','Meals & companion care','kitchen','care'],
  ['hospital','Hospital','Help your birds recover','hospital','care'],
  ['training','Training','Help your birds grow stronger','training','care'],
  ['forge','Forge','Craft & upgrade equipment','forge','care'],
  ['inventory','Stores','Food, materials & equipment','inventory','care'],
  ['leaderboards','Ranks','See how you are doing','leaderboards','more'],
  ['diary','Diary','Your story with Merlin','quests','more'],
  ['profile','Your profile','Level, achievements & saves','profile','more'],
  ['settings','Settings','Sound, appearance & help','settings','more']
 ];
 function derive(input={}){
  input=input&&typeof input==='object'?input:{};
  const actions=[],g=input.gates||{},n=input.counts||{},p=input.player||{};
  const add=(id,title,detail,icon,target,tone='ready')=>actions.push({id,title,detail,icon,target,tone});
  const questCount=count(input.quests?.count);
  if(questCount)add('quests',questCount+' '+(questCount===1?'reward ready':'rewards ready'),input.quests.first?.name||'Open your quests to collect','quests',{kind:'quest',id:input.quests.first?.id});
  if(g.kitchen&&input.kitchenBuilt===false)add('kitchen','Build the Kitchen','A place to feed your birds','kitchen',{kind:'kitchen'},'quiet');
  else if(g.kitchen&&count(n.kitchen))add('kitchen','Kitchen',count(n.kitchen)+' '+(count(n.kitchen)===1?'bird would like a meal':'birds would like a meal'),'kitchen',{kind:'kitchen'},'care');
  if(g.hospital&&count(n.hospital))add('hospital','Hospital',count(n.hospital)+' '+(count(n.hospital)===1?'bird needs treatment':'birds need treatment'),'hospital',{kind:'hospital'},'care');
  if(g.training&&count(n.training))add('training','Training finished',count(n.training)+' '+(count(n.training)===1?'drill to collect':'drills to collect'),'training',{kind:'training'});
  if(g.forge&&count(input.forgeReady))add('forge','Forge ready',count(input.forgeReady)+' '+(count(input.forgeReady)===1?'piece to collect':'pieces to collect'),'forge',{kind:'forge'});
  if(g.village&&input.notice)add('building',input.notice.title||'Building complete',input.notice.sub||'Visit your village','village',{kind:'notice',id:input.notice.id});
  if(!questCount&&input.nextQuest)add('next-quest','Your next quest',input.nextQuest.name||'Open your Player Quests','quests',{kind:'quest',id:input.nextQuest.id},'quiet');
  if(g.kitchen&&!actions.some(a=>a.id==='kitchen'))add('kitchen','Kitchen','Food & companion care','kitchen',{kind:'kitchen'},'quiet');
  const walk=input.walk?{name:input.walk.name||'Your active walk',detail:input.walk.detail||'Pick up where you left off',progress:fraction(input.walk.progress),target:{kind:'walk'}}:null;
  const villages=(g.village&&Array.isArray(input.villages)?input.villages:[]).filter(v=>v&&Number.isFinite(v.seed)&&typeof v.name==='string').map(v=>({seed:v.seed,name:v.name,pop:count(v.pop),happiness:fraction(v.happiness)})).sort((a,b)=>(a.pop?0:1)-(b.pop?0:1)||(a.happiness??2)-(b.happiness??2)||a.name.localeCompare(b.name));
  const routes=ROUTES.filter(([id])=>g[id]===true).map(([id,title,detail,icon,group])=>({id:'route-'+id,title,detail,icon,group,target:['kitchen','hospital','training','forge'].includes(id)?{kind:id}:id==='village'?{kind:'villages'}:id==='settings'?{kind:'settings'}:{kind:'route',screen:id}}));
  const player={name:typeof p.name==='string'?p.name:'',level:count(p.level)||null,coins:p.showCoins!==false&&Number.isFinite(p.coins)&&p.coins>=0?Math.floor(p.coins):null};
  return {actions,routes,walk,player,villages:villages.slice(0,3),villageCount:villages.length,flockCount:count(input.flockCount),discovered:count(input.discovered),readyCount:questCount+count(n.training)*(g.training?1:0)+count(input.forgeReady)*(g.forge?1:0)};
 }
 return {derive};
});
