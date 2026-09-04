const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path'),vm=require('vm');
const out=path.join(process.env.EVIDENCE_DIR || require('os').tmpdir(),'burbz-settlement-life-evidence');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const checks=[];function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+': '+JSON.stringify(detail));}
for(const [,attrs,code] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\//.test(attrs)&&code.trim())new vm.Script(code);
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});let page;
try{
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
await context.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();')}));
page=await context.newPage();page.setDefaultTimeout(20000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('net::'))console.log('CONSOLE',m.text());});
const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
await page.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(1800);
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
  return {count:all.length,shown:people.length,people:people.map(o=>({person:o.userData.resident,blocked:o.userData.pathBlocked,paths:o.userData.paths})),crew:records.map(r=>villageWorkforce(r)),ledger:all,draws:(kind==='village'?villageRenderer:townRenderer).info.render.calls};
},kind);
let a=await audit('village');check('village renders a bounded real census',a.count===24&&a.shown>0&&a.shown<=8,a);check('every displayed resident can reach home and assigned job',a.people.every(p=>!p.blocked),a.people);
const routines=await run(()=>{
  const noon=new Date();noon.setHours(13,0,0,0);const log={};
  for(let t=0;t<420;t+=2){settlementAnimateResidents('village',noon.getTime()+t*1000,1);for(const actor of settlementResidentActors.village){const u=actor.userData;(log[u.resident.id] ||=new Set()).add(u.routine.activity);}}
  return Object.fromEntries(Object.entries(log).map(([id,set])=>[id,[...set]]));
});check('residents commute, work, rest and take breaks',Object.values(routines).some(s=>s.includes('Working')&&s.includes('Walking to work')&&s.includes('At home')&&s.includes('Taking a break')),routines);
await run(()=>{const noon=new Date();noon.setHours(13,0,0,0);settlementAnimateResidents('village',noon.getTime(),1);});
await page.screenshot({path:path.join(out,'village-day.png')});
const before=await run(()=>{saveState();return ensureVillageEconomy(empireVillageRecordBySeed(101)).residentLedger;});
await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(1300);
await run(()=>{if(merlinTutActive)endMerlinTutorial(false);markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);empireLedgerOnlyMode=false;openEmpireVillage(101);});
const after=await run(()=>ensureVillageEconomy(empireVillageRecordBySeed(101)).residentLedger);check('reload preserves every resident home and job',JSON.stringify(before)===JSON.stringify(after));
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
a=await audit('town');check('town residents come from all three original wards',a.count===66&&a.shown>0&&a.shown<=11&&new Set(a.people.map(p=>p.person.id.split(':')[0])).size===3,a);check('town workers can reach their real workplaces',a.people.every(p=>!p.blocked),a.people);
await page.screenshot({path:path.join(out,'town-day.png')});await tapDoors('town');
const dog=await run(()=>{
  const dog=townWalkers.find(o=>o.userData.dogRig);dog.userData.route.phase=0;const life=window.BurbzSettlementLife,duration=life.routeLength(dog.userData.patrolPath)/.6;
  const states=[];for(const time of [.1,.3,.5,.7,duration+2]){settlementAnimateDog(dog,time,1);dog.updateMatrixWorld(true);states.push({gait:dog.userData.gait,pos:dog.position.toArray(),hips:dog.userData.dogRig.legs.map(h=>h.rotation.toArray().slice(0,3)),paws:dog.userData.dogRig.legs.map(h=>h.userData.knee.children[1].getWorldPosition(new THREE.Vector3()).toArray())});}
  return states;
});check('dog moves forwards, plants paws and stops to sniff',dog.slice(0,4).every(d=>d.gait.moving&&d.hips.every(h=>h[0]===0&&h[1]===0))&&!dog[4].gait.moving&&JSON.stringify(dog[0].pos)!==JSON.stringify(dog[1].pos),dog);
check('no JavaScript errors',errors.length===0,errors);check('phone layout has no document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}catch(e){if(page){console.log('PAGE ERRORS/STATE',await page.evaluate(()=>({title:document.getElementById('merlinTutorialTitle')?.textContent,screen:document.querySelector('.screen.active')?.id})));await page.screenshot({path:path.join(out,'failed.png')}).catch(()=>{});}throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(checks,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
