const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const html=require('./village_walk_fixture_20260907.cjs');
const base=process.env.QA_URL||'http://127.0.0.1:8871',out=process.env.EVIDENCE_DIR||'/tmp/burbz-village-walk';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu']});const results=[];
 try{
  if(!process.env.ONLY_FALLBACK){
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await context.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:html}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
  await page.goto(base+'/burbz/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1700);
  const seeds=await run(()=>{
   if(merlinTutActive)endMerlinTutorial(false);burbzDaylightGradeNow=()=>BurbzDaylightCore.daylightGradeForHour(13);
   const seen={};for(let seed=1;seed<80;seed++){const r=villageRngFrom(seed);r();r();const q=r(),name=q<.22?'green':q<.42?'crossroads':q<.62?'riverside':q<.82?'lane':'hamlet';if(!seen[name])seen[name]=seed;}
   return seen;
  });
  async function village(seed,mode){
   await run(({seed,mode})=>{
    const e=ensureEmpireState(),rec={seed,name:'QA '+mode+' '+seed,lat:51.5,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};e.villages[String(seed)]=rec;
    const eco=ensureVillageEconomy(rec);eco.buildings=mode==='empty'?{}:Object.fromEntries(EMPIRE_BUILDINGS.filter(b=>mode==='legacy'||b.tier!=='town').map(b=>[b.id,b.maxLevel]));eco.population=mode==='empty'?0:30;eco.constructions=[];
    if(mode!=='empty')eco.ruins=[];saveState();villageBuiltSeed=null;openEmpireVillage(seed);
   },{seed,mode});
   await page.locator('#villageWalkBtn').scrollIntoViewIfNeeded();await page.waitForTimeout(150);
  }
  await village(seeds.green,'empty');
  // A cancelled first load must not mount a canvas or start a loop later.
  let releaseLoad;const gate=new Promise(resolve=>releaseLoad=resolve);
  await context.route('**/village_walk_core.js*',async route=>{await gate;await route.continue();});
  await page.locator('#villageWalkBtn').tap();await page.locator('#villageWalk').waitFor();await page.locator('.vw-exit').tap();releaseLoad();await page.waitForTimeout(600);
  assert.equal(await page.locator('#villageWalk').count(),0);assert.equal(await page.locator('#villageStage canvas').count(),1);await context.unroute('**/village_walk_core.js*');results.push({test:'cancel-pending-load',passed:true});
  const state=()=>page.evaluate(()=>__burbzVillageWalkDebug.state());
  for(const [layout,seed] of Object.entries(seeds)){
   const mode=layout==='green'?'empty':'dense';await village(seed,mode);await page.locator('#villageWalkBtn').tap();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().ready);
   await page.waitForTimeout(1600);
   const checks=await page.evaluate(()=>{const d=__burbzVillageWalkDebug,s=d.state(),w=d.world();return {spawn:w.allowed(s.player.x,s.player.z),blockedBuildings:w.polygons.every(p=>!w.allowed(p.reduce((n,v)=>n+v.x,0)/p.length,p.reduce((n,v)=>n+v.z,0)/p.length)),radius:w.radius};});
   assert(checks.spawn&&checks.blockedBuildings);
   if(mode==='empty')assert((await state()).buildings.every(b=>!b.id),'no invented buildings in an empty save');
   if(layout==='riverside'){
    const bridge=await run(()=>{const w=__burbzVillageWalkDebug.world(),r=villageScene.userData.walkTerrain.river;return{bank:w.allowed(r.x-r.uz*3,r.z+r.ux*3),deck:w.allowed(r.x,r.z),height:w.height(r.x,r.z),river:r};});
    assert(!bridge.bank&&bridge.deck&&bridge.height>.7);results.push({test:'real-river-bridge',...bridge});
   }
   await page.evaluate(()=>__burbzVillageWalkDebug.resetSamples());await page.keyboard.down('ArrowRight');await page.waitForTimeout(5000);await page.keyboard.up('ArrowRight');
   results.push({test:layout+'-'+mode,...checks,...await state()});
   if(layout==='riverside')await page.screenshot({path:path.join(out,'walk-riverside-portrait.png')});
   await page.locator('.vw-exit').tap();assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  }
  // Night view uses the real daylight grade, and accepts a deliberate walk at
  // full rate while respecting the existing reduced ambient-motion preference.
  await context.clearPermissions();await page.emulateMedia({reducedMotion:'reduce'});
  await run(()=>{burbzDaylightGradeNow=()=>BurbzDaylightCore.daylightGradeForHour(22);villageBuiltSeed=null;renderVillage();});
  await page.locator('#villageWalkBtn').tap();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().ready);await page.waitForTimeout(500);
  await page.screenshot({path:path.join(out,'walk-night-portrait.png')});
  await page.evaluate(()=>history.back());await page.waitForFunction(()=>!document.getElementById('villageWalk'));assert.equal(await run(()=>currentScreen),'village');results.push({test:'native-browser-history-back',passed:true});
  assert.deepEqual(errors,[]);await context.close();
  }
  // No WebGL on a second disposable browser context exercises the real fallback.
  const noGl=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
  await noGl.addInitScript(()=>{const get=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/i.test(type)?null:get.call(this,type,...args);};});
  await noGl.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await noGl.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:html}));
  const fallback=await noGl.newPage();await fallback.goto(base+'/burbz/',{waitUntil:'domcontentloaded'});await fallback.waitForTimeout(1700);
  await fallback.evaluate(()=>__testEval("if(merlinTutActive)endMerlinTutorial(false);const rec={seed:101,name:'Fallback village',lat:51.5,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};ensureEmpireState().villages['101']=rec;ensureVillageEconomy(rec);openEmpireVillage(101);"));
  await fallback.locator('#villageWalkBtn').click();await fallback.locator('.vw-error:not([hidden])').waitFor();assert.equal(await fallback.evaluate(()=>__burbzVillageWalkDebug.state().running),false);await fallback.locator('.vw-error button').click();assert.equal(await fallback.locator('#villageWalk').count(),0);results.push({test:'missing-WebGL-fallback',passed:true});await noGl.close();
 }finally{fs.writeFileSync(path.join(out,process.env.ONLY_FALLBACK?'fallback.json':'edges.json'),JSON.stringify(results,null,2));await browser.close();}
 console.log(JSON.stringify(results,null,2));
})().catch(error=>{console.error(error);process.exitCode=1;});
