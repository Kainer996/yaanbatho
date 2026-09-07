/* Real catalogue + accepted-detection funnel; all persistence is disposable. */
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const fn = name => {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name);
  const lineEnd = html.indexOf('\n', start);
  return html.slice(start, html.slice(start, lineEnd).endsWith('}') ? lineEnd : html.indexOf('\n}', start) + 2);
};
const catalogue = html.slice(html.indexOf('const BURBZ_SPECIES_PROFILES = ['), html.indexOf('function getBirdInfo('));
function fixture(saved) {
  const storage = new Map(saved ? [['burbz_state', saved]] : []);
  const calls = { toast: [], encounters: [], quest: [], diary: [], flashes: [], xp: 0, birdXp: 0 };
  const ctx = vm.createContext({console: {warn(){}}, require, Date, Map, Set, localStorage: {
    setItem(k, v) {storage.set(k, v);}, getItem(k) {return storage.get(k) || null;}
  }, calls});
  vm.runInContext('window = globalThis', ctx);
  for (const file of ['uk_bird_expansion_50.js','uk_bird_expansion_2.js','au_bird_expansion.js','uk_bird_expansion_3.js','uk_bird_expansion_4.js','uk_bird_alias_completion_20260803.js','au_bird_expansion_2.js','national_bird_completion_20260715.js','sound_listener_core.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), ctx);
  }
  vm.runInContext(`
    const UK50=BURBZ_UK_BIRD_EXPANSION_50, UK26=BURBZ_UK_BIRD_EXPANSION_26, AU_EXP=BURBZ_AU_BIRD_EXPANSION,
      UK_FINAL=BURBZ_UK_BIRD_EXPANSION_FINAL, UK4=BURBZ_UK_BIRD_EXPANSION_4, AU50=BURBZ_AU_BIRD_EXPANSION_50,
      NATIONAL=BURBZ_NATIONAL_BIRD_COMPLETION_20260715, UK_BIRD_ALIASES=BURBZ_UK_BIRD_ALIAS_COMPLETION_20260803;
    ${catalogue}
    let gameState=JSON.parse(localStorage.getItem('burbz_state') || '{"player":{"xp":0,"coins":0},"flock":[],"discoveredSpecies":{}}');
    let continuousSoundScanWanted=true;
    const SOUND_SESSION_MAX_PER_WINDOW=4, BIRD_BIOLOGY_STATS_VERSION='fixture';
    const soundDiscoveryHistory=BurbzSoundListenerCore.createDiscoveryHistory();
    const soundDiscoveryFlippedKeys=new Set();
    const determineBirdRarity=()=> 'common', generateBirdStats=()=>({hp:80,cha:50}), hashStr=()=>1,
      resolveBuiltInBirdArt=()=>null, defaultBirdCare=()=>({}), getBirdArtUrl=()=>null,
      recruitCostForBird=()=>150, discoveryRewardForBird=()=>14, fetchBirdArt=()=>{},
      logDiary=(...args)=>calls.diary.push(args), queueCloudSave=()=>{}, queueActionBadgeUpdate=()=>{},
      addCoins=n=>gameState.player.coins+=n, addPlayerXp=n=>{ calls.xp+=n; gameState.player.xp+=n; },
      levelUpBird=(_,n)=>calls.birdXp+=n, updateHeader=()=>{}, renderBirdex=()=>{}, renderProfile=()=>{},
      showToast=text=>calls.toast.push(text), showScanEncounterCard=b=>calls.encounters.push(b.species),
      showRecruitChoiceOverlay=()=>{}, checkBadges=()=>{}, showCatalogUnmatchedRecognition=()=>{},
      questRegisterBirdEncounter=b=>calls.quest.push(b.species), renderSoundSessionDiscoveries=()=>{},
      $=()=>({classList:{add(){},remove(){}},style:{}}), RARITY_COLORS={common:'#fff'};
    let reenter=null;
    function updateQuestProgress() { const cb=reenter; reenter=null; if(cb)cb(); }
    const document={querySelectorAll:()=>[]};
    ${['speciesKey','canonicalSpeciesName','discoveryKeysForSpecies','getDiscoveredRecordForSpecies','companionForSpecies','nextDiscoverySightingCount','rememberDiscoveredBird','createBirdEntry','normaliseAcceptedBirdCandidates','recordSoundSessionDiscovery','flashSoundSessionBird','durableSaveState','saveState','handleBirdCandidates'].map(fn).join('\n')}
    function detect(name='Goldcrest', rest=[], opts={}) {
      return handleBirdCandidates({species:name,confidence:.96}, rest, {source:'sound',...opts});
    }
  `, ctx);
  return {ctx, calls, storage, run: code=>vm.runInContext(code, ctx)};
}
let n=0;
function check(name, run) {run(); console.log('PASS '+name); n++;}
check('first discovery gives one entry/reward/toast, repeated owned bursts give none', () => {
  const f=fixture(); f.run("detect(); gameState.flock.push({...createBirdEntry('Goldcrest'),id:'owned'});");
  assert.equal(f.run('new Set(Object.values(gameState.discoveredSpecies).map(r=>r.key)).size'), 1);
  assert.equal(f.calls.xp, 8); assert.equal(f.calls.toast.length,1); assert.equal(f.calls.encounters.length,1);
  f.run("for(let i=0;i<100;i++) detect(i%2?' GOLDCREST ':'Goldcrest', [{common_name:'Goldcrest',confidence:.99}]);");
  assert.equal(f.calls.xp,8); assert.equal(f.calls.birdXp,0); assert.equal(f.calls.toast.length,1);
  assert.equal(f.calls.encounters.length,1); assert.equal(f.run('gameState.player.coins'),14);
  assert.equal(f.run('soundDiscoveryHistory.snapshot().length'),1);
  assert.equal(f.run('getDiscoveredRecordForSpecies("Goldcrest").sightingCount'),101);
  assert.equal(f.calls.quest.length,101, 'non-reward encounter processing still runs');
});
check('saved discovery survives a fresh runtime and listening session', () => {
  const first=fixture(); first.run('detect()');
  const again=fixture(first.storage.get('burbz_state')); again.run('detect()');
  assert.equal(again.calls.xp,0); assert.equal(again.calls.toast.length,0); assert.equal(again.calls.encounters.length,0);
  assert.equal(again.run('soundDiscoveryHistory.snapshot()[0].isNew'),false);
  assert.equal(JSON.parse(again.storage.get('burbz_state')).discoveredSpecies.goldcrest.sightingCount,2);
  again.run("detect('Firecrest')"); assert.equal(again.calls.xp,8); assert.equal(again.calls.toast.length,1);
});
check('legacy IDs, aliases, scientific identity and companion-only saves are known', () => {
  for (const book of [
    {old_backend_id:{species:'GOLDCREST', photoAt:'fixture-date', recruitCost:21}},
    {legacy_key:{commonName:'European Robin'}},
    {legacy_key:{scientificName:'Erithacus rubecula'}},
    {Robin:{species:'robin'}},
  ]) {
    const name=book.old_backend_id?'Goldcrest':'Robin';
    const f=fixture(JSON.stringify({player:{xp:77,coins:200},flock:[],discoveredSpecies:book}));
    f.run(`detect(${JSON.stringify(name)})`);
    assert.equal(f.calls.xp,0); assert.equal(f.calls.toast.length,0); assert.equal(f.run('gameState.player.coins'),200);
    if(name==='Goldcrest') assert.equal(f.run('getDiscoveredRecordForSpecies("Goldcrest").photoAt'),'fixture-date');
  }
  const f=fixture();f.run("gameState.flock=[{species:'Goldcrest',xp:99}]; detect();");
  assert.equal(f.calls.xp,0); assert.equal(f.calls.birdXp,0); assert.equal(f.calls.toast.length,0);
  assert.equal(f.run('gameState.flock[0].xp'),99);
});
check('alias bursts coalesce while genuinely distinct species stay separate', () => {
  const f=fixture();
  f.run("detect('European Robin',[{species:'ROBIN'},{species:'Erithacus rubecula'}]); detect('Robin');");
  assert.equal(f.calls.xp,8); assert.equal(f.run('soundDiscoveryHistory.snapshot().length'),1);
  f.run("detect('Magpie'); detect('Australian Magpie');");
  assert.equal(f.calls.xp,24); assert.equal(f.run('soundDiscoveryHistory.snapshot().length'),3);
});
check('reentrant and queued accepted callbacks cannot claim discovery twice', () => {
  const f=fixture();f.run('reenter=()=>detect(); detect();');
  assert.equal(f.calls.xp,8); assert.equal(f.calls.toast.length,1); assert.equal(f.run('gameState.player.coins'),14);
});
check('one-shot/photo routes cannot replay discovery or companion XP', () => {
  const f=fixture();f.run("detect(); continuousSoundScanWanted=false; detect('Goldcrest'); detect('Goldcrest',[],{source:'photo'});");
  assert.equal(f.calls.xp,8); assert.equal(f.calls.birdXp,0); assert.equal(f.calls.toast.length,1); assert.equal(f.calls.encounters.length,1);
});
check('repeat icon feedback is brief, cancels older animation and respects reduced motion', () => {
  const f=fixture();f.run(`
    let canceled=0, played=[];
    const icon={getAnimations:()=>[{cancel:()=>canceled++}],animate:(frames,opts)=>played.push(opts)};
    document.querySelectorAll=()=>[{dataset:{speciesName:'Goldcrest'},querySelector:()=>icon}];
    flashSoundSessionBird('goldcrest'); flashSoundSessionBird('goldcrest');
  `);
  assert.equal(f.run('canceled'),2);assert.equal(f.run('played[0].duration'),420);
  f.run("window.matchMedia=()=>({matches:true}); flashSoundSessionBird('goldcrest');");
  assert.equal(f.run('played.length'),2);assert.equal(f.calls.toast.length,0);
});
console.log(`${n} discovery regression groups passed`);
