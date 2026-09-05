const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),vm=require('vm');
const out=path.join(process.env.EVIDENCE_DIR || require('os').tmpdir(),'burbz-peeps-v350-evidence');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const checks=[];function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+': '+JSON.stringify(detail));}
for(const [,attrs,code] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\//.test(attrs)&&code.trim())new vm.Script(code);
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true,args:process.env.RENDER_BACKEND==='native'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});let page;
try{
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
await context.addInitScript(()=>{
  Date.prototype.getHours=()=>13;
  window.__peepPlays=[];const play=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(this.src.includes('/little-folk/'))window.__peepPlays.push({src:this.src,volume:this.volume});return play.call(this);};
});
await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
await context.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();')}));
page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::'))console.log('CONSOLE',m.text());});
const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
await page.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(1800);
if(await page.locator('#introSkipBtn').isVisible())await page.locator('#introSkipBtn').tap();await page.waitForTimeout(900);
await run(()=>{
  markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));if(merlinTutActive)endMerlinTutorial(false);
  burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);
  Object.assign(gameState.player,{coins:1000000,branches:100000,stone:100000,level:12});
  const empire=ensureEmpireState();empire.villages={};empire.townCharters=[];empire.cityCharters=[];
  for(const seed of [101,102,103]){
    const rec={seed,name:'Alder '+seed,lat:51.5+(seed-101)*.002,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};empire.villages[String(seed)]=rec;
    const eco=ensureVillageEconomy(rec);eco.buildings={cabin:3,well:2,cottages:1,hut:1,minehut:1,lumberhut:1,tavern:1};eco.population=24;eco.ruins=[];eco.constructions=[];
  }saveState();openEmpireVillage(101);
});
await page.waitForSelector('#villageStage canvas');await page.waitForTimeout(500);
const audit=kind=>run(kind=>{
  const people=settlementResidentActors[kind],records=kind==='village'?[empireVillageRecordBySeed(101)]:townMemberRecords(currentTownSettlement());
  const all=records.flatMap(r=>ensureVillageEconomy(r).residentLedger.residents);
  return {count:all.length,shown:people.length,people:people.map(o=>({person:o.userData.resident,humanoid:!!o.userData.humanoidRig,bird:!!o.userData.birdRig,blocked:o.userData.pathBlocked,paths:o.userData.paths})),crew:records.map(r=>villageWorkforce(r)),ledger:all,draws:(kind==='village'?villageRenderer:townRenderer).info.render.calls};
},kind);
async function peepTap(kind){
  const chosen=await run(kind=>{
    const actors=settlementResidentActors[kind];
    const cam=kind==='village'?villageCam:townCam;
    // Find a genuinely visible street-side view, not a person behind a roof.
    const fixed=Date.now(),animate=settlementAnimateResidents;
    window.__restorePeepAnimation=()=>{settlementAnimateResidents=animate;};
    settlementAnimateResidents=(kind,now,motion)=>animate(kind,fixed,motion);
    for(const target of actors.filter(o=>o.visible))for(const azimuth of [0,Math.PI/2,Math.PI,Math.PI*1.5]){
      Object.assign(cam,{tx:target.position.x,tz:target.position.z,dist:6,polar:.65,azimuth,lastInputAt:Date.now()});
      (kind==='village'?villageAnimateFrame:townAnimateFrame)(1);
      const camera=kind==='village'?villageCamera:townCamera;
      const p=target.localToWorld(new THREE.Vector3(0,.8,0)).project(camera),rect=(kind==='village'?villageRenderer:townRenderer).domElement.getBoundingClientRect();
      const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),camera);
      const targets=kind==='village'?villageBuildings.concat(villageNpcs.filter(o=>o.visible)):townEconBuildings.concat(townDistrictGroups,townNpcs.filter(o=>o.visible));
      const hit=ray.intersectObjects(targets,true)[0];
      if(hit&&settlementSceneObjectContains(target,hit.object))return {id:target.userData.resident.id,x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(-p.y*.5+.5)*rect.height,canvas:rect.toJSON(),stage:$(kind+'Stage').getBoundingClientRect().toJSON()};
    }
    throw Error('No unoccluded Peep view found');
  },kind);
  await page.touchscreen.tap(chosen.x,chosen.y);await page.waitForTimeout(180);
  const selected=await run(kind=>({id:settlementSceneSelection[kind]?.object.userData.resident?.id,detail:$(kind+'SceneDesc').textContent,icon:$(kind+'SceneIcon').textContent,plays:window.__peepPlays}),kind);
  check(kind+' phone tap selects a named humanoid Peep',selected.id===chosen.id&&selected.detail.startsWith('Peep · ')&&selected.icon==='👤',{chosen,selected});
  check(kind+' tap starts original chatter at modest volume',selected.plays.length>0&&selected.plays.at(-1).volume===.38,selected.plays);
  const before=selected.plays.length;
  await page.evaluate(({kind,chosen})=>{const el=document.querySelector('#'+kind+'Stage canvas');for(let i=0;i<20;i++)for(const type of ['pointerdown','pointerup'])el.dispatchEvent(new PointerEvent(type,{bubbles:true,pointerId:90,pointerType:'touch',clientX:chosen.x,clientY:chosen.y,button:0}));},{kind,chosen});
  check(kind+' rapid taps keep one voice',await page.evaluate(n=>window.__peepPlays.length===n,before));
  await page.screenshot({path:path.join(out,kind+'-peep-close.png')});
  await run(()=>{sfxEnabled=false;SFX.setEnabled(false);});
  await page.touchscreen.tap(chosen.x,chosen.y);
  check(kind+' muted taps still select without speech',await page.evaluate(n=>window.__peepPlays.length===n,before));
  await run(()=>{sfxEnabled=true;SFX.setEnabled(true);window.__restorePeepAnimation();});
}
let a=await audit('village');check('all village residents are humanoid Peeps',a.people.every(p=>p.humanoid&&!p.bird&&p.person.kind==='humanoid'),a.people);
await peepTap('village');check('village renders a bounded real census',a.count===24&&a.shown>0&&a.shown<=8,a);check('every displayed resident can reach home and assigned job',a.people.every(p=>!p.blocked),a.people);
const routines=await run(()=>{
  const noon=new Date();noon.setHours(13,0,0,0);const log={};
  for(let t=0;t<420;t+=2){settlementAnimateResidents('village',noon.getTime()+t*1000,1);for(const actor of settlementResidentActors.village){const u=actor.userData;(log[u.resident.id] ||=new Set()).add(u.routine.activity);}}
  return Object.fromEntries(Object.entries(log).map(([id,set])=>[id,[...set]]));
});check('residents commute, work, rest and seek water',Object.values(routines).some(s=>s.includes('Working')&&s.includes('Walking to work')&&s.includes('At home')&&s.includes('Drinking at the well')),routines);
await run(()=>{const noon=new Date();noon.setHours(13,0,0,0);settlementAnimateResidents('village',noon.getTime(),1);});
await page.screenshot({path:path.join(out,'village-day.png')});
const before=await run(()=>{settlementAnimateResidents=()=>{};saveState();return ensureVillageEconomy(empireVillageRecordBySeed(101)).residentLedger;});
await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(1300);
await run(()=>{if(merlinTutActive)endMerlinTutorial(false);markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);empireLedgerOnlyMode=false;window.__loadedPeepMemory={};const advance=window.BurbzPeepNeeds.advance;window.BurbzPeepNeeds.advance=(p,...args)=>{if(!window.__loadedPeepMemory[p.id])window.__loadedPeepMemory[p.id]=JSON.parse(JSON.stringify(p.lifeMemory||null));return advance(p,...args);};openEmpireVillage(101);});
const after=await run(()=>ensureVillageEconomy(empireVillageRecordBySeed(101)).residentLedger);
const identity=l=>l.residents.map(({lifeMemory,...p})=>p);
check('reload preserves every resident home and job',JSON.stringify(identity(before))===JSON.stringify(identity(after)));
const loaded=await page.evaluate(()=>window.__loadedPeepMemory);
check('reload preserves needs and route position before resuming',before.residents.filter(p=>p.lifeMemory).every(p=>JSON.stringify(loaded[p.id])===JSON.stringify(p.lifeMemory)),{before:before.residents.filter(p=>p.lifeMemory).map(p=>[p.id,p.lifeMemory]),loaded});
const reassignment=await run(()=>{const rec=empireVillageRecordBySeed(101),eco=ensureVillageEconomy(rec);delete eco.buildings.hut;delete eco.buildings.cottages;eco.buildings.farm=1;renderVillage();const ledger=ensureVillageEconomy(rec).residentLedger;return {people:ledger.residents,crew:villageWorkforce(rec)};});
check('removed homes and jobs reconcile without phantom buildings',reassignment.people.every(p=>p.jobId!=='hut'&&p.homeId!=='cottages:0')&&reassignment.people.filter(p=>!p.homeId).length===6&&reassignment.people.filter(p=>p.jobId==='farm').length===reassignment.crew.assigned.farm,reassignment);
await run(()=>{const rec=empireVillageRecordBySeed(101),eco=ensureVillageEconomy(rec);eco.buildings=Object.fromEntries(EMPIRE_BUILDINGS.map(b=>[b.id,1]));eco.population=18;renderVillage();});
async function tapDoors(kind){
  const ids=await run(kind=>[...new Set((kind==='village'?villageBuildings:townEconBuildings).filter(o=>o.userData.buildingId&&!o.userData.construction).map(o=>o.userData.buildingId))],kind);
  for(const id of ids){
    const point=await run(({kind,id})=>{
      const target=(kind==='village'?villageBuildings:townEconBuildings).find(o=>o.userData.buildingId===id&&!o.userData.construction);
      const bounds=new THREE.Box3().setFromObject(target),center=bounds.getCenter(new THREE.Vector3());
      const cam=kind==='village'?villageCam:townCam;Object.assign(cam,{tx:center.x,tz:center.z,dist:9,polar:.65,azimuth:.5,lastInputAt:Date.now()});
      (kind==='village'?villageAnimateFrame:townAnimateFrame)(1);
      const camera=kind==='village'?villageCamera:townCamera;const p=center.project(camera),rect=$(kind+'Stage').getBoundingClientRect();
      return {x:rect.left+(p.x*.5+.5)*rect.width,y:rect.top+(-p.y*.5+.5)*rect.height};
    },{kind,id});
    await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(100);
    const opened=await run(()=>buildingInteriorOpenView?.buildingId);check(kind+' touch opens '+id,opened===id,{point,opened});
    await run(()=>closeBuildingInterior());
  }
}
await tapDoors('village');
await run(()=>{const empire=ensureEmpireState();empire.townCharters=[{seeds:[101,102,103],mergedAt:new Date().toISOString()}];openEmpireTown(empireSettlementsInfo().towns[0].id);});
await page.waitForSelector('#townStage canvas');await page.waitForTimeout(400);
a=await audit('town');check('all town residents are humanoid Peeps',a.people.every(p=>p.humanoid&&!p.bird&&p.person.kind==='humanoid'),a.people);await peepTap('town');check('town residents come from all three original wards',a.count===66&&a.shown>0&&a.shown<=11&&new Set(a.people.map(p=>p.person.id.split(':')[0])).size===3,a);check('town workers can reach their real workplaces',a.people.every(p=>!p.blocked),a.people);
await page.screenshot({path:path.join(out,'town-day.png')});await tapDoors('town');
const dog=await run(()=>{
  const dog=townWalkers.find(o=>o.userData.dogRig);dog.userData.route.phase=0;const life=window.BurbzSettlementLife,duration=life.routeLength(dog.userData.patrolPath)/.6;
  const states=[];for(const time of [.1,.3,.5,.7,duration+2]){settlementAnimateDog(dog,time,1);dog.updateMatrixWorld(true);states.push({gait:dog.userData.gait,pos:dog.position.toArray(),hips:dog.userData.dogRig.legs.map(h=>h.rotation.toArray().slice(0,3)),paws:dog.userData.dogRig.legs.map(h=>h.userData.knee.children[1].getWorldPosition(new THREE.Vector3()).toArray())});}
  return states;
});check('dog moves forwards, plants paws and stops to sniff',dog.slice(0,4).every(d=>d.gait.moving&&d.hips.every(h=>h[0]===0&&h[1]===0))&&!dog[4].gait.moving&&JSON.stringify(dog[0].pos)!==JSON.stringify(dog[1].pos),dog);
await page.setViewportSize({width:320,height:740});await page.screenshot({path:path.join(out,'town-320.png')});check('no JavaScript errors',errors.length===0,errors);check('phone layout has no document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}catch(e){if(page){console.log('PAGE ERRORS/STATE',await page.evaluate(()=>({title:document.getElementById('merlinTutorialTitle')?.textContent,screen:document.querySelector('.screen.active')?.id})));await page.screenshot({path:path.join(out,'failed.png')}).catch(()=>{});}throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(checks,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
