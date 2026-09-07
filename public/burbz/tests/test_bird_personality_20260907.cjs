const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
function fn(name){const i=html.indexOf('function '+name+'('),e=html.indexOf('\n',i);assert.ok(i>=0,name);return html.slice(i,html.slice(i,e).endsWith('}')?e:html.indexOf('\n}',i)+2);}
const ctx=vm.createContext({console,require});
const charm=html.slice(html.indexOf('const BURBZ_CHARM = {'),html.indexOf('\nfunction speciesCharmBase'));
vm.runInContext(`
const window=globalThis,clamp=(x,a,b)=>Math.min(b,Math.max(a,x));
const profiles={goldcrest:{id:'goldcrest',name:'Goldcrest',scientificName:'Regulus regulus',stats:{hp:1,stamina:6,strength:1,def:4,spd:7,int:5}},robin:{id:'robin',name:'Robin',stats:{hp:2,stamina:6,strength:2,def:4,spd:6,int:6}}};
const findSpeciesProfile=s=>/goldcrest|regulus regulus/i.test(s||'')?profiles.goldcrest:/robin/i.test(s||'')?profiles.robin:null;
const hashStr=()=>1, SPECIAL_MOVES=['first','second'], BIRD_EMOJIS=['a','b'];
const birdSizeCore=()=>null,speciesSizeInfo=p=>({score:p.id==='goldcrest'?1:10,classId:'tiny',massG:6,carryGuild:'songbird'});
${charm}
${['speciesCharmBase','generateBirdStats','birdPersonalityValue','migrateBirdPersonality','mergeCloudState'].map(fn).join('\n')}
const DEFAULT_STATE={player:{},flock:[]};
const applySpecialBirdCharacter=b=>b,dietHungerCore=()=>null,migrateGamePlaceNames=s=>s;
`,ctx);
const run=c=>vm.runInContext(c,ctx);
let n=0;function check(name,f){f();console.log('PASS '+name);n++;}
check('Goldcrest uses existing high CHA scale without changing physical stats',()=>{
 assert.equal(run("speciesCharmBase(profiles.goldcrest)"),9);
 assert.equal(run("generateBirdStats('Goldcrest').cha"),90);
 assert.equal(run("generateBirdStats('Goldcrest').atk"),10);
 assert.equal(run("generateBirdStats('Goldcrest').spd"),70);
 assert.equal(run("generateBirdStats('Goldcrest').int"),50);
});
check('targeted migration preserves XP, injury, size, training, nickname and equipment identity',()=>{
 run(`let gold={id:'owned',species:'Goldcrest',customName:'Pip',level:5,xp:91,hp:12,maxHp:61,atk:17,def:24,spd:99,int:63,cha:48,massG:6,training:{chaBonus:7,atkBonus:5},academy:{room:'crowbar'},bond:{xp:20}}; let before=JSON.stringify(gold); migrateBirdPersonality(gold);`);
 assert.equal(run('gold.cha'),115);
 assert.equal(run("JSON.stringify({...gold,cha:48})===before"),true);
 run('let once=JSON.stringify(gold);migrateBirdPersonality(gold);');assert.equal(run('JSON.stringify(gold)===once'),true);
});
check('trained values never go down, missing CHA gets a consistent default, other species stay untouched',()=>{
 run("let trained={species:'Goldcrest',level:5,cha:240};migrateBirdPersonality(trained);");assert.equal(run('trained.cha'),240);
 assert.equal(run("migrateBirdPersonality({species:'GOLDCREST',level:1}).cha"),90);
 assert.equal(run("migrateBirdPersonality({scientificName:'Regulus regulus',cha:40}).cha"),90);
 assert.equal(run("migrateBirdPersonality({species:'Robin',cha:34}).cha"),34);
 assert.equal(run("birdPersonalityValue({species:'Robin',cha:0})"),0);
});
check('cloud/local-style reload reaches same CHA and all display values agree with mechanics',()=>{
 run("let loaded=mergeCloudState({player:{xp:80},flock:[{species:'Goldcrest',level:1,cha:40,xp:23,customName:'Pip'}]});");
 assert.equal(run('loaded.flock[0].cha'),90);assert.equal(run('birdPersonalityValue(loaded.flock[0])'),90);
 assert.equal(run('loaded.flock[0].xp'),23);assert.equal(run('loaded.player.xp'),80);
 assert.equal(run('mergeCloudState(JSON.parse(JSON.stringify(loaded))).flock[0].cha'),90);
 assert.ok(fn('loadState').includes('migrateBirdPersonality(b)'));
});
check('existing civic-role aptitude sees high personality without changing the role formula',()=>{
 const roles=require('../bird_roles_core.js');
 // APIs deliberately consume cha, never a separate personality property.
 const p={id:'crest',species:'Goldcrest',int:50,cha:90,sizeScore:1,level:1};
 const high=roles.roleAptitude(p,'steward'),low=roles.roleAptitude({...p,cha:40},'steward');
 assert.ok(high>low,JSON.stringify({high,low}));
});
check('full equipment and both reverse card renderers expose the existing stat',()=>{
 for(const name of ['renderBirdEquip','createBirdCardHTML','createKnownSpeciesCardHTML','openBirdInfo','renderSoundSessionDiscoveries']){
  const source=fn(name);assert.ok(source.includes('Personality'),name);assert.ok(source.includes('birdPersonalityValue('),name);
 }
 assert.ok(html.includes('.bird-equip-stat.is-personality { grid-column:1/-1;'));
});
console.log(n+' Personality regression groups passed');
