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
  const actions=[],g=input.gates||{},playableGates={...g},n=input.counts||{},p=input.player||{};
  // A route being introduced does not make an unfinished room playable.
  for(const id of ['kitchen','training','hospital'])playableGates[id]=g[id]===true&&input.rooms?.[id]?.built===true;
  const add=(id,title,detail,icon,target,tone='ready')=>actions.push({id,title,detail,icon,target,tone});
  const questCount=count(input.quests?.count);
  if(input.nextQuest)add('next-quest',input.nextQuest.name||'Your next quest',input.nextQuest.detail||'Continue your next Player Quest','quests',{kind:'quest',id:input.nextQuest.id},'quiet');
  if(questCount)add('quests',questCount+' '+(questCount===1?'reward ready':'rewards ready'),input.quests.first?.name||'Open your quests to collect','quests',{kind:'quest',id:input.quests.first?.id});
  if(g.kitchen&&input.kitchenBuilt===false)add('kitchen','Build the Kitchen','A place to feed your birds','kitchen',{kind:'kitchen'},'quiet');
  else if(g.kitchen&&count(n.kitchen))add('kitchen','Kitchen',count(n.kitchen)+' '+(count(n.kitchen)===1?'bird would like a meal':'birds would like a meal'),'kitchen',{kind:'kitchen'},'care');
  if(g.hospital&&count(n.hospital))add('hospital','Hospital',count(n.hospital)+' '+(count(n.hospital)===1?'bird needs treatment':'birds need treatment'),'hospital',{kind:'hospital'},'care');
  if(g.training&&count(n.training))add('training','Training finished',count(n.training)+' '+(count(n.training)===1?'drill to collect':'drills to collect'),'training',{kind:'training'});
  if(g.forge&&count(input.forgeReady))add('forge','Forge ready',count(input.forgeReady)+' '+(count(input.forgeReady)===1?'piece to collect':'pieces to collect'),'forge',{kind:'forge'});
  if(g.village&&input.notice)add('building',input.notice.title||'Building complete',input.notice.sub||'Visit your village','village',{kind:'notice',id:input.notice.id});
  if(g.kitchen&&!actions.some(a=>a.id==='kitchen'))add('kitchen','Kitchen','Food & companion care','kitchen',{kind:'kitchen'},'quiet');
  const walk=input.walk?{name:input.walk.name||'Your active walk',detail:input.walk.detail||'Pick up where you left off',progress:fraction(input.walk.progress),target:{kind:'walk'}}:null;
  const villages=(g.village&&Array.isArray(input.villages)?input.villages:[]).filter(v=>v&&Number.isFinite(v.seed)&&typeof v.name==='string').map(v=>({seed:v.seed,name:v.name,pop:count(v.pop),happiness:fraction(v.happiness)})).sort((a,b)=>(a.pop?0:1)-(b.pop?0:1)||(a.happiness??2)-(b.happiness??2)||a.name.localeCompare(b.name));
  const routes=ROUTES.filter(([id])=>g[id]===true).map(([id,title,detail,icon,group])=>({id:'route-'+id,title,detail,icon,group,target:['kitchen','hospital','training','forge'].includes(id)?{kind:id}:id==='village'?{kind:'villages'}:id==='settings'?{kind:'settings'}:{kind:'route',screen:id}}));
  const player={name:typeof p.name==='string'?p.name:'',level:count(p.level)||null,coins:p.showCoins!==false&&Number.isFinite(p.coins)&&p.coins>=0?Math.floor(p.coins):null};
  const builds=(g.village&&Array.isArray(input.builds)?input.builds:[]).filter(b=>b&&typeof b.id==='string'&&typeof b.name==='string'&&Number.isFinite(b.seed)&&typeof b.building==='string').map(b=>({...b,target:{kind:'build-opportunity',seed:b.seed,building:b.building}}));
  const stores=(g.inventory&&Array.isArray(input.stores)?input.stores:[]).filter(s=>s&&typeof s.id==='string'&&typeof s.name==='string'&&['weapon','armour'].includes(s.slot)&&count(s.count)).map(s=>({...s,count:count(s.count),target:{kind:'stores-gear',id:s.id}}));
  const kitchen=(playableGates.kitchen&&Array.isArray(input.kitchen)?input.kitchen:[]).filter(b=>b&&typeof b.id==='string'&&Number.isFinite(b.hunger)&&b.hunger>0).map(b=>({...b,hunger:Math.max(0,Math.min(100,b.hunger)),target:{kind:'feed-bird',id:b.id}}));
  const training=(playableGates.training&&Array.isArray(input.training)?input.training:[]).filter(s=>s&&typeof s.id==='string').map(s=>({...s,progress:Math.max(0,Math.min(100,Number(s.progress)||0)),target:{kind:'training'}}));
  const hospital=(playableGates.hospital&&Array.isArray(input.hospital)?input.hospital:[]).filter(b=>b&&typeof b.id==='string'&&Number.isFinite(b.hp)&&Number.isFinite(b.maxHp)&&b.maxHp>0&&b.hp<b.maxHp).map(b=>({...b,target:{kind:'hospital'}}));
  const completed=(Array.isArray(input.completed)?input.completed:[]).filter(n=>n&&typeof n.id==='string'&&(n.scope==='academy'?g.academy:g.village)).map(n=>({...n,target:{kind:'notice',id:n.id,scope:n.scope}}));
  const equipment=(Array.isArray(input.equipment)?input.equipment:[]).filter(i=>i&&['weapon','armour','trinket','spell','potion'].includes(i.slot)).map(i=>({...i,target:{kind:'player-equipment',slot:i.slot}}));
  const villageDesk=(g.village&&Array.isArray(input.villageDesk)?input.villageDesk:[]).filter(v=>v&&Number.isFinite(v.seed)&&typeof v.name==='string').map(v=>({...v,target:{kind:'village',seed:v.seed},builds:builds.filter(b=>b.seed===v.seed)}));
  playableGates.village=g.village===true&&villageDesk.length>0;
  const empire=empireColumns(g.village?input.empireDesk:null,builds);
  const panels=progressivePanels(input,{g:playableGates,completed});
  return {panels,empire,villageDesk,equipment,gates:playableGates,stores,kitchen,training,hospital,completed,actions,routes,walk,player,builds,villages:villages.slice(0,3),villageCount:villages.length,flockCount:count(input.flockCount),discovered:count(input.discovered),readyCount:questCount+count(n.training)*(g.training?1:0)+count(input.forgeReady)*(g.forge?1:0)};
 }
 function empireColumns(input,builds=[]) {
  return ['villages','towns','regions'].map(id=>({id,title:{villages:'Villages',towns:'Towns',regions:'Regions'}[id],rows:(Array.isArray(input?.[id])?input[id]:[]).filter(r=>r&&typeof r.id==='string'&&typeof r.name==='string'&&r.target).map(r=>{
   const bad=!r.assigned||['empty','unhappy'].includes(r.need?.id),available=builds.filter(b=>(r.wards||[]).includes(b.seed));
   const status=!r.assigned?'No governor':r.need?.label||'Status unavailable';
   return {...r,tone:bad?'bad':'good',status,buildCount:available.length,buildNames:available.map(b=>b.name),work:r.waiting?r.waiting+' ready to open':r.underway?r.underway+' building':available.length?available.length+' can build':''};
  })}));
 }
 // Timestamp facts come from canonical room construction/first settlement saves.
 // Historical saves without dates have a deterministic order; observing an unlock
 // can improve the UI preference but never grants a feature or changes a save.
 function progressivePanels(input,{g,completed}) {
  const date=v=>{const n=typeof v==='number'?v:Date.parse(v);return Number.isFinite(n)&&n>0?n:0;};
  const panels=[{id:'discover',at:0},{id:'today',at:0}];
  if(g.inventory===true)panels.push({id:'stores',at:date(input.featureDates?.inventory)});
  for(const id of ['kitchen','training','hospital'])if(g[id]===true)panels.push({id,at:date(input.rooms?.[id]?.builtAt)});
  if(g.village===true||completed.length)panels.push({id:'building',at:date(input.featureDates?.village),feature:g.village===true});
  let featured=panels[0];
  for(const p of panels)if(!['today'].includes(p.id)&&(p.id!=='building'||g.village===true)&&(p.at>featured.at||(p.at===featured.at&&p.id!=='discover')))featured=p;
  return {items:panels,featured:featured.id};
 }
 return {derive,progressivePanels,empireColumns};
});
