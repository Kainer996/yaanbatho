'use strict';
// v493: player quests run in three lines side by side (Earth, Academy,
// Alderwing); Home shows the live link of each; a gold arrow reopens the
// listening panel while the mic is on.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8'),sw=fs.readFileSync(path.join(root,'sw.js'),'utf8');
const css=fs.readFileSync(path.join(root,'scan_home.css'),'utf8'),homeJs=fs.readFileSync(path.join(root,'scan_home.js'),'utf8');
const gate=require(path.join(root,'onboarding_gate_core.js')),core=require(path.join(root,'scan_home_core.js')),home=require(path.join(root,'player_home_core.js'));
const BUILD='quest-lines-v493-20260926';
// Later releases move the page marker and the cache tail on.
const LATER=['photo-merlin-v494-20260926','village-apart-v495-20260926'];
const block=(start,end)=>html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start))+end.length);
const fn=name=>{const m=html.match(new RegExp('function '+name+'\\([^]*?\\n}'));if(!m)throw Error(name);return m[0];};

function runtime(state={}){
 const c={gameState:{quests:{},player:{},...state},openingProgress:()=>({stage:'done',errands:true}),tutorialFlowState:()=>({}),window:{}};
 vm.createContext(c);
 vm.runInContext(block('const PLAYER_QUESTS = [','\n];')+'\n'+block('const PLAYER_QUEST_LINES = [','\n];')+'\n'+['assignPlayerQuestLines','openingGuidedQuestId','activePlayerQuests','activePlayerQuest'].map(fn).join('\n')+'\nassignPlayerQuestLines();this.PLAYER_QUESTS=PLAYER_QUESTS;',c);
 return c;
}

test('every player quest belongs to one of three lines, each with plenty to do',()=>{
 const c=runtime(),lines={};
 for(const q of c.PLAYER_QUESTS){assert.ok(['earth','academy','alderwing'].includes(q.line),q.id);(lines[q.line]||=[]).push(q.id);}
 assert.equal(new Set(c.PLAYER_QUESTS.map(q=>q.id)).size,c.PLAYER_QUESTS.length,'ids are unique');
 assert.ok(lines.earth.length>=30,'Earth leads the player through the Empire');
 assert.ok(lines.academy.length>=20);assert.ok(lines.alderwing.length>=15);
 assert.equal(lines.earth[0],'pq_first_bird','finding a bird opens the Earth line');
 assert.equal(lines.academy[0],'pq_build_barracks');assert.equal(lines.alderwing[0],'pq_alder_arrive');
 assert.ok(lines.earth.indexOf('pq_found_town')<lines.earth.indexOf('pq_found_region'));
});

test('the three lines move side by side and never wait on each other',()=>{
 const c=runtime();
 assert.equal(JSON.stringify(c.activePlayerQuests().map(q=>q.id)),JSON.stringify(['pq_first_bird','pq_build_barracks','pq_alder_arrive']));
 c.gameState.quests={pq_first_bird:{claimed:true},pq_open_empire:{claimed:true}};
 assert.equal(JSON.stringify(c.activePlayerQuests().map(q=>q.id)),JSON.stringify(['pq_liberate','pq_build_barracks','pq_alder_arrive']));
 assert.equal(c.activePlayerQuest().id,'pq_build_barracks','older callers get the earliest live link');
 for(const q of c.PLAYER_QUESTS.filter(q=>q.line==='alderwing'))c.gameState.quests[q.id]={claimed:true};
 assert.equal(c.activePlayerQuests()[2],null,'a finished line reads null');
});

test('every measure reads real save state and old saves never throw',()=>{
 const c=runtime();
 vm.runInContext(fn('playerWalkCount')+fn('playerWalkKm')+fn('alderwingHome'),c);
 Object.assign(c,{discoveredSpeciesSet:()=>new Set(['a','b']),villageBuildingLevels:()=>0,villageEconomies:()=>[],empireVillages:()=>[],villageEconomySnapshot:()=>null,shopDiscoveryState:()=>({}),completedVillageCount:()=>0,explorationState:()=>({camps:[]}),empireMapOpenCount:()=>0,isAcademyBuildingBuilt:()=>false,claimedExpeditionCount:()=>0,countDiscoveredDiets:()=>0,villagesFedAndWatered:()=>false});
 for(const q of c.PLAYER_QUESTS.filter(q=>typeof q.measure==='function')){const n=q.measure();assert.ok(Number.isFinite(n)&&n>=0,q.id+' '+n);}
 c.gameState.playerHome=home.normalize({tier:1});c.gameState.walkingQuests={history:[{distanceKm:2.5}]};c.gameState.sideQuest={history:[{distanceM:1500}]};
 assert.equal(vm.runInContext('playerWalkKm()',c),4);assert.equal(vm.runInContext('playerWalkCount()',c),2);
});

test('feature gates open when their own line reaches the link',()=>{
 const c=runtime(),ids=c.PLAYER_QUESTS.map(q=>q.id),lineOf=Object.fromEntries(c.PLAYER_QUESTS.map(q=>[q.id,q.line]));
 let map=gate.unlockedFeatures({chainIds:ids,lineOf,claimedIds:[],evidence:{kitchenBuilt:true},playerLevel:1});
 assert.equal(map.village,false,'the Empire waits for the first bird');
 map=gate.unlockedFeatures({chainIds:ids,lineOf,claimedIds:['pq_first_bird'],evidence:{kitchenBuilt:true},playerLevel:1});
 assert.equal(map.village,true,'the Earth line opens the Empire without waiting on the Academy');
 assert.equal(map.battle,false,'the Academy line still holds the arena');
});

test('a harvest is counted, so harvest quests can be measured',()=>{
 let h=home.normalize({tier:1});assert.equal(h.farm.harvests,0);
 const now=Date.now(),inv={items:{},larder:{}},wallet={branches:10,coins:20};
 let site=null;for(let x=-18;x<=18&&!site;x+=2)for(let z=-18;z<=18&&!site;z+=2)if(home.validPlot(h,{x,z}).ok)site={x,z};
 let r=home.proposeFarm(h,wallet,inv,{kind:'farm-plot',...site},now);assert.ok(r.ok,r.error);h=r.home;const id=h.farm.plots[0].id;
 r=home.proposeFarm(h,r.wallet,r.inventory,{kind:'farm-buy',crop:'pondweed'},now);h=r.home;
 r=home.proposeFarm(h,r.wallet,r.inventory,{kind:'farm-plant',id,crop:'pondweed'},now);assert.ok(r.ok,r.error);h=r.home;
 r=home.proposeFarm(h,r.wallet,r.inventory,{kind:'farm-water',id},now);h=r.home;
 r=home.proposeFarm(h,r.wallet,r.inventory,{kind:'farm-harvest',id},now+16*60000);assert.ok(r.ok,r.error);
 assert.equal(r.home.farm.harvests,1);assert.equal(home.normalize(r.home).farm.harvests,1,'the count survives a reload');
});

test('Home shows one chip per line after the opening and keeps the single goal before it',()=>{
 const lines={claimed:3,total:84,lines:[{line:'earth',label:'Earth',icon:'🌍',id:'pq_open_empire',name:'Open your Empire map',ready:false},{line:'academy',label:'Academy',icon:'🏛️',id:'pq_recruit',name:'Recruit a companion',ready:true},{line:'alderwing',label:'Alderwing',icon:'🏰',id:null,name:'All done',ready:false}]};
 const m=core.derive({questLines:lines});
 assert.deepEqual(m.questLines.map(l=>l.target),[{kind:'player-quest',id:'pq_open_empire'},{kind:'player-quest',id:'pq_recruit'},null]);
 assert.deepEqual(m.questProgress,{claimed:3,total:84});
 assert.deepEqual(core.derive({}).questLines,[]);
 assert.ok(homeJs.includes("goalHeight=panelElement('today')?.dataset.questLines==='true'?110:50"),'the layout makes room for the second row');
 assert.ok(css.includes('.scan-home-today[data-quest-lines="true"] > #scanHomeActions { grid-row:2;grid-column:1 / -1;display:grid;grid-template-columns:repeat(3,minmax(0,1fr))'));
 assert.ok(html.includes("$('scanHomeActions')?.after(homeResume)"),'the Goal button sits beside the quest box, not inside it');
});

test('a gold arrow reopens the listening panel while the mic is on',()=>{
 assert.ok(html.includes('id="soundSessionReopen"'));
 assert.ok(html.includes('showListening:showSoundScanMode'));
 assert.ok(homeJs.includes("reopen.hidden=!on||(!session.hidden&&session.open)"));
});

test('v493 ships together: build marker, cache and every changed file pinned in each worker list',()=>{
 assert.ok([BUILD,...LATER].some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));
 const cache=sw.match(/const BURBZ_CACHE = '([^']+)'/)[1];assert.ok(cache.includes('-'+BUILD)&&[BUILD,...LATER].some(b=>cache.endsWith('-'+b)));
 for(const file of ['scan_home.css','scan_home.js','scan_home_core.js','onboarding_gate_core.js','player_home_core.js']){
  const pin=file+'?v='+BUILD;assert.ok(html.includes(pin),pin);
  assert.equal(sw.split("'./"+pin+"'").length-1,3,pin+' in every worker list');
 }
});
