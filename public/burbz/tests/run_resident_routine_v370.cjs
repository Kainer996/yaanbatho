/* Real ledger resident, real street routes and real room actor updates; only time/needs are controlled. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_URL||'http://127.0.0.1:8871';
const out=process.env.EVIDENCE_DIR||'/tmp/resident-routine-v370';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader']});
 const report={transitions:[]},errors=[];
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
  await context.addInitScript(()=>{window.__routineNow=Date.now();window.__routineHour=22;Date.now=()=>window.__routineNow;Date.prototype.getHours=()=>window.__routineHour;Date.prototype.getMinutes=()=>0;});
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await context.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:require('./village_walk_fixture_20260907.cjs')}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
  await page.goto(base+'/burbz/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1400);
  await page.evaluate(()=>Element.prototype.requestFullscreen=()=>Promise.reject(Error('test viewport')));
  await run(()=>{if(merlinTutActive)endMerlinTutorial(false);const empire=ensureEmpireState();empire.villages={};const rec={seed:101,name:'Alder Hollow',lat:51.5,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};empire.villages['101']=rec;const eco=ensureVillageEconomy(rec);eco.buildings={cabin:3,cottages:3,well:2,hut:1,tavern:3,lumberhut:1,minehut:1};eco.population=24;eco.ruins=[];eco.constructions=[];saveState();openEmpireVillage(101);});
  await page.locator('#villageStage canvas').waitFor();
  report.person=await run(()=>{const model=settlementResidentBrains.village.find(m=>{const d=m.userData.peepEnvironment.destinations;return m.userData.resident.homeId==='cabin:0'&&d.home&&d.work&&d.food&&d.work.target.buildingId!==d.food.target.buildingId;});if(!model)throw Error('No real housed worker with distinct meal destination');window.__routinePerson=model.userData.resident.id;const p=model.userData.resident;Object.assign(p.lifeMemory,{energy:95,thirst:0,hunger:25,fun:100});return{id:p.id,name:p.name,homeId:p.homeId,jobId:p.jobId,initial:{...p.lifeMemory}};});
  // No resident action, target, position, route or occupancy is assigned by this test.
  const advance=async(hour,goal,departOnly=false)=>{
   const result=await run(({hour,goal,departOnly})=>{window.__routineHour=hour;const trace=[];let travel=0,last=null;
    for(let i=0;i<500;i++){
     window.__routineNow+=1000;settlementAnimateResidents('village',Date.now(),1);
     const u=settlementResidentBrains.village.find(m=>m.userData.resident.id===window.__routinePerson).userData,m=u.resident.lifeMemory,r=u.routine;
     const key=m.action==='sleep'?'home':m.action,d=u.peepEnvironment.destinations[key];
     if(r.inside&&(!d||Math.hypot(m.x-d.point.x,m.z-d.point.z)>=.08))throw Error('Inside before arrival');
     if(m.action==='travel'){travel++;if(r.inside)throw Error('Travelling resident marked inside');}
     if(last&&Math.hypot(m.x-last.x,m.z-last.z)>.801)throw Error('Resident jumped instead of walking');
     last={x:m.x,z:m.z};trace.push({action:m.action,target:m.target,inside:r.inside,x:m.x,z:m.z,room:r.room});
     if(departOnly?m.action==='travel'&&m.target===goal:r.inside&&key===goal)return{goal,hour,travel,trace};
    }throw Error('Did not reach '+goal+': '+JSON.stringify(trace.slice(-8)));
   },{hour,goal,departOnly});report.transitions.push(result);console.log('ROUTINE',goal,departOnly?'departing':'arrived',result.trace.length,'seconds');return result;
  };
  await advance(22,'home');
  // Show the actual home resident, then keep this room open while their schedule changes.
  await run(()=>openBuildingInterior(101,'cabin'));await page.locator('[data-action="interior-walk"]').click();
  await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().interiors?.inside,null,{timeout:90000});
  await page.waitForFunction(id=>__burbzVillageWalkDebug.state().interiors.life.actors.some(a=>a.id===id),report.person.id);
  await page.screenshot({path:path.join(out,'home-before-work.png')});
  await advance(10,'work',true);
  await page.waitForFunction(id=>{const a=__burbzVillageWalkDebug.state().interiors.life.actors.find(a=>a.id===id);return !a||a.leaving;},report.person.id);
  report.homeDepartureRefresh=true;
  await page.locator('.vw-exit').click();await run(()=>closeBuildingInterior());
  // Open the real work room while the person is still on the street.
  await run(id=>openBuildingInterior(101,id),report.person.jobId);await page.locator('[data-action="interior-walk"]').click();
  await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().interiors?.inside);
  assert(!(await page.evaluate(()=>__burbzVillageWalkDebug.state().interiors.life.actors)).some(a=>a.id===report.person.id),'Worker must not appear before street arrival');
  const work=await advance(10,'work');assert(work.travel>0,'Home to work uses a real route');
  await page.waitForFunction(id=>__burbzVillageWalkDebug.state().interiors.life.actors.some(a=>a.id===id&&!a.leaving),report.person.id);
  report.workArrivalRefresh=true;await page.screenshot({path:path.join(out,'work-after-arrival.png')});
  await advance(12.75,'food',true);
  await page.waitForFunction(id=>{const a=__burbzVillageWalkDebug.state().interiors.life.actors.find(a=>a.id===id);return !a||a.leaving;},report.person.id);
  report.workDepartureRefresh=true;
  await page.locator('.vw-exit').click();await run(()=>closeBuildingInterior());
  const meal=await advance(12.75,'food');assert(meal.travel>0,'Work to meal uses a real route');
  const food=await run(()=>{const u=settlementResidentBrains.village.find(m=>m.userData.resident.id===window.__routinePerson).userData;return{target:u.routine.room,hunger:u.resident.lifeMemory.hunger};});
  await run(target=>openBuildingInterior(target.seed,target.buildingId),food.target);await page.locator('[data-action="interior-walk"]').click();
  await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().interiors?.inside);
  await page.waitForFunction(id=>__burbzVillageWalkDebug.state().interiors.life.actors.some(a=>a.id===id),report.person.id);
  await page.screenshot({path:path.join(out,'meal-after-arrival.png')});report.mealResident=true;
  await page.locator('.vw-exit').click();await run(()=>closeBuildingInterior());
  const home=await advance(22,'home');assert(home.travel>0,'Meal to home uses a real route');
  report.final=await run(()=>{const u=settlementResidentBrains.village.find(m=>m.userData.resident.id===window.__routinePerson).userData;return{id:u.resident.id,name:u.resident.name,routine:u.routine,memory:u.resident.lifeMemory};});
  assert.equal(report.final.id,report.person.id);assert.equal(report.final.name,report.person.name);assert(report.final.routine.inside);assert(report.final.memory.hunger<food.hunger,'Meal relieves real hunger before the journey home');
  assert.deepEqual(errors,[]);report.errors=errors;report.pass=true;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));console.log('PASS resident home → work → meal → home',report.person.name);
 } catch(error){report.error=error.stack;report.errors=errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));throw error;} finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
