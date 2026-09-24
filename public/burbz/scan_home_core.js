/* Read-only field-desk projection. The existing game owns counts and actions. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzScanHomeCore=api;})(globalThis,function(root){'use strict';
 const count=n=>Number.isFinite(n)&&n>0?Math.floor(n):0;
 const fraction=n=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):null;
 const asObject=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
 const finiteNumber=value=>{const n=Number(value);return Number.isFinite(n)?n:null;};
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
 function canonicalAcademyCatalog(source) {
  let rows=[];
  if(Array.isArray(source))rows=source;
  else if(source&&typeof source.getAcademyRooms==='function')rows=source.getAcademyRooms();
  else if(root&&root.BurbzAcademyCore&&typeof root.BurbzAcademyCore.getAcademyRooms==='function')rows=root.BurbzAcademyCore.getAcademyRooms();
  const seen=new Set();
  return (Array.isArray(rows)?rows:[]).filter(room=>room&&typeof room.id==='string'&&!seen.has(room.id)&&seen.add(room.id)).map(room=>({
   id:room.id,label:typeof room.label==='string'?room.label:room.id,icon:typeof room.icon==='string'?room.icon:'',
   cost:count(Number(room.cost)),branches:count(Number(room.branches)),unlockLevel:count(Number(room.unlockLevel))||1,
   floor:Number.isFinite(Number(room.floor))?Number(room.floor):null,branch:typeof room.branch==='string'?room.branch:'',
   x:finiteNumber(room.x),y:finiteNumber(room.y),role:typeof room.role==='string'?room.role:'',
   effect:typeof room.effect==='string'?room.effect:'',trainStat:typeof room.trainStat==='string'?room.trainStat:null
  }));
 }
 function compactLedgerRecord(record) {
  if(!record||typeof record!=='object'||Array.isArray(record))return null;
  const out={built:record.built===true};
  if(typeof record.builtAt==='string'||typeof record.builtAt==='number')out.builtAt=record.builtAt;
  const x=finiteNumber(record.x),y=finiteNumber(record.y);
  if(x!==null)out.x=x;
  if(y!==null)out.y=y;
  if(typeof record.movedAt==='string'||typeof record.movedAt==='number')out.movedAt=record.movedAt;
  return out;
 }
 function coordinateFor(room,ledger) {
  const savedX=ledger&&finiteNumber(ledger.x),savedY=ledger&&finiteNumber(ledger.y);
  if(savedX!==null&&savedY!==null)return {coordinates:{x:savedX,y:savedY},source:'ledger'};
  if(room.x!==null&&room.y!==null)return {coordinates:{x:room.x,y:room.y},source:'catalog'};
  return {coordinates:null,source:null};
 }
 function activeAwayIds(input) {
  const ids=new Set();
  const add=id=>{if(id!=null&&String(id))ids.add(String(id));};
  if(Array.isArray(input.awayBirdIds))input.awayBirdIds.forEach(add);
  const awayMap=asObject(input.awayBirds);
  Object.keys(awayMap).forEach(id=>{if(awayMap[id])add(id);});
  (Array.isArray(input.birdExpeditions)?input.birdExpeditions:[]).forEach(row=>{
   if(!row||typeof row!=='object')return;
   const status=String(row.status||'active').toLowerCase();
   if(!['claimed','cancelled','failed'].includes(status))add(row.birdId);
  });
  return ids;
 }
 function birdName(bird) {
  return typeof bird.nickname==='string'&&bird.nickname?bird.nickname:
   typeof bird.customName==='string'&&bird.customName?bird.customName:
   typeof bird.commonName==='string'&&bird.commonName?bird.commonName:
   typeof bird.species==='string'&&bird.species?bird.species:'Companion';
 }
 function birdSummary(bird,room) {
  return {id:String(bird.id),name:birdName(bird),room,commonName:typeof bird.commonName==='string'?bird.commonName:'',species:typeof bird.species==='string'?bird.species:''};
 }
 function kitchenIntroduced(input) {
  return input.kitchenIntroduced===true||input.openingProgress?.kitchenIntroduced===true||input.opening?.kitchenIntroduced===true||input.tutorialFlow?.kitchenIntroduced===true;
 }
 function buildState(room,{owned,input}) {
  if(room.id==='outdoors')return {visible:false,status:'canonical',reason:'outdoors'};
  if(owned)return {visible:false,status:'built',reason:'owned'};
  if(room.id==='kitchen'&&!kitchenIntroduced(input))return {visible:false,status:'hidden',reason:'kitchen-not-introduced'};
  const player=asObject(input.player),level=finiteNumber(player.level),coins=finiteNumber(player.coins),branches=finiteNumber(player.branches);
  const levelLocked=level!==null&&level<room.unlockLevel;
  const affordable=coins===null||branches===null?null:coins>=room.cost&&branches>=room.branches;
  return {visible:true,status:levelLocked?'locked':affordable===false?'unaffordable':level!==null&&affordable===true?'available':'unbuilt',reason:levelLocked?'level':affordable===false?'resources':level!==null&&affordable===true?'ready':'needs-economy'};
 }
 const NON_RESIDENTIAL_ACADEMY_ROOMS=new Set(['tavern','kitchen','magpie_market','manager_office']);
 function birdSavedAcademyRoom(bird) {
  if(!bird||typeof bird!=='object')return 'outdoors';
  if(typeof bird.academy?.room==='string'&&bird.academy.room)return bird.academy.room;
  if(typeof bird.room==='string'&&bird.room)return bird.room;
  return 'outdoors';
 }
 function academyDisplayRoomId(bird,input={},options={}) {
  input=input&&typeof input==='object'?input:{};
  options=options&&typeof options==='object'?options:{};
  const catalog=canonicalAcademyCatalog(options.catalog||input.catalog);
  const byId=new Map(catalog.map(room=>[room.id,room]));
  const ledger=asObject(input.academyBuildings||input.rooms);
  const savedRoom=birdSavedAcademyRoom(bird);
  if(savedRoom==='outdoors')return {room:'outdoors',savedRoom,reason:'outdoors'};
  const room=byId.get(savedRoom);
  if(!room)return {room:'outdoors',savedRoom,reason:'unknown-room'};
  if(NON_RESIDENTIAL_ACADEMY_ROOMS.has(savedRoom))return {room:'outdoors',savedRoom,reason:'nonresidential-room'};
  const record=compactLedgerRecord(ledger[savedRoom]);
  if(!(record&&record.built===true))return {room:'outdoors',savedRoom,reason:'unowned-room'};
  return {room:savedRoom,savedRoom,reason:'owned-room'};
 }
  function projectAcademyRooms(input={},options={}) {
  input=input&&typeof input==='object'?input:{};
  options=options&&typeof options==='object'?options:{};
  const catalog=canonicalAcademyCatalog(options.catalog||input.catalog);
  const byId=new Map(catalog.map(room=>[room.id,room]));
  const ledger=asObject(input.academyBuildings||input.rooms);
  const awayIds=activeAwayIds(input),occupants=new Map(),awayOccupants=[],excludedOccupants=[];
  (Array.isArray(input.flock)?input.flock:[]).forEach(bird=>{
   if(!bird||typeof bird!=='object'||bird.id==null||String(bird.id)==='')return;
   const display=academyDisplayRoomId(bird,input,{catalog});
   const summary={...birdSummary(bird,display.room),savedRoom:display.savedRoom,displayReason:display.reason};
   if(awayIds.has(summary.id)){awayOccupants.push({...summary,reason:'away'});return;}
   if(!byId.has(display.room)){excludedOccupants.push({...summary,reason:'display-room-missing'});return;}
   if(!occupants.has(display.room))occupants.set(display.room,[]);
   occupants.get(display.room).push(summary);
  });
  const academyRoles=asObject(asObject(input.birdRoles).academy);
  const flockById=new Map((Array.isArray(input.flock)?input.flock:[]).filter(b=>b&&b.id!=null).map(b=>[String(b.id),b]));
  const rooms=catalog.map(room=>{
   const record=compactLedgerRecord(ledger[room.id]);
   const owned=room.id==='outdoors'||!!(record&&record.built===true);
   const coord=coordinateFor(room,record);
   const rows=occupants.get(room.id)||[];
   const awayCount=awayOccupants.filter(row=>row.room===room.id).length;
   const roleBirdId=academyRoles[room.id]!=null&&String(academyRoles[room.id])?String(academyRoles[room.id]):null;
   const roleBird=roleBirdId?flockById.get(roleBirdId):null;
   return {
    id:room.id,label:room.label,icon:room.icon,roleId:room.role,effect:room.effect,trainStat:room.trainStat,
    cost:room.cost,branches:room.branches,unlockLevel:room.unlockLevel,floor:room.floor,branch:room.branch,
    owned,status:owned?'owned':'unbuilt',ledger:record,coordinates:coord.coordinates,coordinateSource:coord.source,
    suggestedCoordinates:room.x!==null&&room.y!==null?{x:room.x,y:room.y}:null,
    build:buildState(room,{owned,input}),occupants:rows,occupantCount:rows.length,awayCount,
    role:{birdId:roleBirdId,staffed:!!roleBird&&owned&&!awayIds.has(roleBirdId),away:!!roleBirdId&&awayIds.has(roleBirdId),name:roleBird?birdName(roleBird):''}
   };
  });
  const unknownRecords=Object.keys(ledger).filter(id=>!byId.has(id)).map(id=>{
   const record=compactLedgerRecord(ledger[id]);
   const coord=coordinateFor({x:null,y:null},record);
   return {id,ledger:record,coordinates:coord.coordinates,coordinateSource:coord.source};
  });
  const ownedIds=rooms.filter(room=>room.owned).map(room=>room.id);
  return {
   catalogIds:rooms.map(room=>room.id),rooms,ownedIds,unownedIds:rooms.filter(room=>!room.owned).map(room=>room.id),
   buildableIds:rooms.filter(room=>room.build.visible).map(room=>room.id),unknownRecords,awayOccupants,excludedOccupants,
   counts:{catalog:rooms.length,owned:ownedIds.length,unowned:rooms.length-ownedIds.length,occupants:rooms.reduce((sum,room)=>sum+room.occupantCount,0),away:awayOccupants.length,excluded:excludedOccupants.length}
  };
 }
 function derive(input={}){
  input=input&&typeof input==='object'?input:{};
  const actions=[],g=input.gates||{},playableGates={...g},n=input.counts||{},p=input.player||{};
  // A route being introduced does not make an unfinished room playable.
  for(const id of ['kitchen','training','hospital'])playableGates[id]=g[id]===true&&input.rooms?.[id]?.built===true;
  const add=(id,title,detail,icon,target,tone='ready')=>actions.push({id,title,detail,icon,target,tone});
  const questCount=count(input.quests?.count);
  if(input.nextQuest)add('next-quest',input.nextQuest.name||'Your next quest',input.nextQuest.detail||'Continue your next Player Quest','quests',input.nextQuest.source==='progression'?{kind:'home-goal'}:{kind:'quest',id:input.nextQuest.id},'quiet');
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
  const academy=input.academyRooms&&typeof input.academyRooms==='object'?input.academyRooms:null;
  const academyBuildRows=(g.academy&&Array.isArray(input.academyBuildRows)?input.academyBuildRows:[]).filter(b=>b&&typeof b.id==='string'&&typeof b.label==='string');
  const availableBuilds=(Array.isArray(input.availableBuilds)?input.availableBuilds:[]).filter(b=>b&&typeof b.id==='string'&&typeof b.name==='string'&&(b.target?.kind==='academy-build'?g.academy===true:b.target?.kind==='build-opportunity'&&g.village===true));
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
  return {panels,empire,villageDesk,equipment,availableBuilds,academy,academyBuildRows,forgeReady:count(input.forgeReady),gates:playableGates,stores,kitchen,training,hospital,completed,actions,routes,walk,player,builds,villages:villages.slice(0,3),villageCount:villages.length,flockCount:count(input.flockCount),discovered:count(input.discovered),readyCount:questCount+count(n.training)*(g.training?1:0)+count(input.forgeReady)*(g.forge?1:0)};
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
  if(g.forge===true)panels.push({id:'stores',at:date(input.featureDates?.forge)});
  for(const id of ['kitchen','training','hospital'])if(g[id]===true)panels.push({id,at:date(input.rooms?.[id]?.builtAt)});
  if(g.village===true||completed.length)panels.push({id:'building',at:date(input.featureDates?.village),feature:g.village===true});
  let featured=panels[0];
  for(const p of panels)if(!['today'].includes(p.id)&&(p.id!=='building'||g.village===true)&&(p.at>featured.at||(p.at===featured.at&&p.id!=='discover')))featured=p;
  return {items:panels,featured:featured.id};
 }
 return {derive,progressivePanels,empireColumns,canonicalAcademyCatalog,academyDisplayRoomId,projectAcademyRooms};
});
