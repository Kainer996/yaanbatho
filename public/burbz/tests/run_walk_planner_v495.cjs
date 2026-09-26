/* Browser proof for the walk planner (v495). Real game page in Chromium with a
 * disposable save and the synthetic map fixture: My location stays lit, taps
 * place checkpoints and the destination, the game fills the route, and the
 * panel fits phones held both ways. Viewport emulation, not a physical-phone claim.
 * Run: EVIDENCE_DIR=/tmp/v495 PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node tests/run_walk_planner_v495.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-walk-planner-v495';fs.mkdirSync(out,{recursive:true});
const report={served:{},missing:[],checks:[],errors:[],limits:['Chromium viewport emulation with a disposable save and a synthetic map; map-data requests are blocked, so routes use the game\'s dashed fallback. The route engine\'s footpath choice is proven in test_walk_planner_v495.cjs.']};
const server=F.createServer({root,port:Number(process.env.PORT||8995),report,seed:F.SEED});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),pass=(name,detail)=>{report.checks.push({name,detail});console.log('PASS',name);};
const planner=()=>run(`(()=>{const c=ensureDestinationQuestController(),s=c.state();return{phase:s.phase,start:s.start,startSource:s.startSource,end:s.end,via:s.via.length,pick:c.mapPickState(),route:s.preview&&{len:s.preview.route.lengthM,checkpoints:(s.preview.route.checkpoints||[]).length}};})()`);
const lit=selector=>page.locator(selector).first().evaluate(b=>({pressed:b.getAttribute('aria-pressed'),chosen:b.classList.contains('is-chosen'),tick:!!b.querySelector('.dq-choice-tick'),border:getComputedStyle(b).borderTopColor}));
// Tap an open patch of map, never a control or a pin.
async function tapMap(fx,fy){
 await page.waitForFunction(()=>!__burbzMapDebug.map.isMoving());
 const box=await page.evaluate(()=>__burbzMapDebug.map.getContainer().getBoundingClientRect().toJSON());
 for(let i=0;i<12;i++){const x=box.x+box.width*fx+i*9,y=box.y+box.height*fy+i*7;
  const ok=await page.evaluate(([x,y])=>document.elementFromPoint(x,y)?.classList.contains('maplibregl-canvas'),[x,y]);
  if(ok){await page.mouse.click(x,y);await page.waitForTimeout(450);return;}}
 throw Error('no open map at '+fx+','+fy);
}
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',permissions:['geolocation'],geolocation:{latitude:F.ANCHOR.lat,longitude:F.ANCHOR.lon,accuracy:6}});await F.routeMap(context,report);
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');
 await run(`if(merlinTutActive)endMerlinTutorial(false);featureGateMap={map:true,quests:true,academy:true,inventory:true,forge:true,kitchen:true,training:true,hospital:true,village:true,battle:true,birdex:true};delete gameState.destinationQuests;saveState();switchScreen('map');`);
 await page.waitForFunction(()=>!!window.__burbzMapDebug?.map?.loaded());await page.waitForTimeout(800);
 // A stale fix: My location must ask the phone again.
 await run(`if(liveMapLastPosition)liveMapLastPosition.at=Date.now()-600000;`);
 await page.locator('#mapQuestShowBtn').click();await page.waitForSelector('#destinationQuestSheet.open');
 const look=await page.evaluate(()=>{const s=q=>getComputedStyle(document.querySelector(q));return{panel:s('.destination-quest-panel').backgroundColor,head:s('.destination-sheet-head').backgroundColor,step:s('.dq-step').backgroundColor,title:s('#destinationQuestTitle').fontFamily,text:document.querySelector('#destinationQuestTitle').textContent};});
 assert.equal(look.panel,'rgb(20, 21, 23)');assert.equal(look.head,'rgb(40, 39, 37)');assert.equal(look.step,'rgb(29, 30, 32)');assert.match(look.title,/Rajdhani/);assert.equal(look.text,'Plan a walk');
 assert.equal((await planner()).start,null,'stale fix does not set the start');await page.screenshot({path:path.join(out,'1-open.png')});
 pass('The planner wears the Home charcoal and gold',look);

 // Headless Chromium's location emulation times out on a fresh high-accuracy
 // request, so the test stands in for the phone's GPS sensor. Everything after
 // the sensor (the game's request, the live map, the planner) is the real code.
 const sensor=ok=>page.evaluate(ok=>{navigator.geolocation.getCurrentPosition=(yes,no)=>setTimeout(()=>ok?yes({coords:{latitude:54.45,longitude:-2.65,accuracy:6},timestamp:Date.now()}):no({code:1,message:'denied'}),150);},ok);
 await sensor(false);await page.locator('[data-destination-gps]').click();
 assert.match(await page.locator('[data-destination-gps]').textContent(),/Finding you/);
 await page.waitForFunction(()=>!document.querySelector('[data-destination-gps]').classList.contains('is-waiting'));
 const denied=await lit('[data-destination-gps]');assert.equal(denied.pressed,'false');assert.equal((await planner()).start,null);
 assert.match(await page.evaluate(()=>document.getElementById('toast')?.textContent||document.body.innerText),/Allow location, or tap the map/);
 await sensor(true);await page.locator('[data-destination-gps]').click();await page.waitForFunction(()=>__testEval('ensureDestinationQuestController().state().start')!==null);await page.waitForTimeout(200);
 const gps=await lit('[data-destination-gps]'),mapBtn=await lit('[data-destination-pick="start"]');
 assert.deepEqual([gps.pressed,gps.chosen,gps.tick],['true',true,true]);assert.equal(gps.border,'rgb(242, 207, 115)');assert.equal(mapBtn.pressed,'false');
 assert.equal((await planner()).pick,null,'My location stays on screen, lit, before the next step');
 await page.screenshot({path:path.join(out,'2-my-location-lit.png')});
 pass('My location asks for a fresh fix, says so when refused, and stays lit with a gold edge and tick',{denied,gps,mapBtn});

 await page.locator('[data-destination-pick="checkpoint"]').click();assert.equal((await planner()).pick.kind,'checkpoint');
 await page.screenshot({path:path.join(out,'3-drop-checkpoint.png')});
 await tapMap(.32,.42);let s=await planner();assert.equal(s.via,1);
 assert.equal(await page.locator('.destination-route-marker.checkpoint').count(),1);assert.equal(await page.locator('[data-destination-remove-checkpoint]').count(),1);
 assert.equal((await lit('[data-destination-gps]')).pressed,'true','start stays lit after a checkpoint');
 pass('A map tap drops checkpoint 1, with its own numbered pin',s);

 await page.locator('[data-destination-pick="end"]').click();await tapMap(.62,.3);
 await page.waitForFunction(()=>__testEval('ensureDestinationQuestController().state().phase')==='preview',null,{timeout:60000});await page.waitForTimeout(500);
 s=await planner();assert.equal(s.route.checkpoints,1);assert(await page.locator('[data-destination-begin]').isEnabled());
 assert.equal(await page.locator('.dq-strip .dq-chip.is-chosen').first().textContent(),'▶ StartMy location');
 await page.screenshot({path:path.join(out,'4-route-ready.png')});
 pass('The destination tap fills the route through the checkpoint and lights Start walk',s);

 await page.locator('[data-destination-edit]').first().click();assert.equal((await lit('[data-destination-gps]')).pressed,'true');
 await page.locator('[data-destination-pick="start"]').click();await tapMap(.25,.55);
 await page.waitForFunction(()=>__testEval('ensureDestinationQuestController().state().phase')==='preview',null,{timeout:60000});
 await page.locator('[data-destination-edit]').first().click();
 const after={gps:await lit('[data-destination-gps]'),map:await lit('[data-destination-pick="start"]')};
 assert.equal(after.gps.pressed,'false');assert.deepEqual([after.map.pressed,after.map.chosen,after.map.tick],['true',true,true]);
 pass('Tap the map for the start moves the light to that button',after);

 await page.locator('[data-destination-remove-checkpoint="0"]').click();
 await page.waitForFunction(()=>{const s=__testEval('ensureDestinationQuestController().state()');return s.phase==='preview'&&!s.via.length;},null,{timeout:60000});
 s=await planner();assert.equal(s.route.checkpoints,0);assert.equal(await page.locator('.destination-route-marker.checkpoint').count(),0);
 pass('Removing the checkpoint routes again without it',s);

 await page.locator('[data-destination-begin]').click();await page.waitForFunction(()=>!!__testEval('destinationActiveQuest()'));
 await run(`ensureDestinationQuestController().openPlanner()`);await page.waitForSelector('[data-destination-finish]');
 assert.equal(await page.locator('#destinationQuestTitle').textContent(),'Your walk');assert.equal(await page.locator('[data-destination-form]').count(),0,'no planning form under a live walk');
 await page.screenshot({path:path.join(out,'5-your-walk.png')});
 pass('Start walk saves the walk; the sheet shows Your walk with no planning form',{});

 const fits=[];
 for(const [w,h] of [[360,640],[390,844],[412,915],[844,390],[740,360]]){
  await page.setViewportSize({width:w,height:h});await page.waitForTimeout(350);
  const f=await page.evaluate(()=>{const p=document.querySelector('.destination-quest-panel').getBoundingClientRect(),dock=document.getElementById('bottomDock')?.getBoundingClientRect();return{left:Math.round(p.left),right:Math.round(p.right),top:Math.round(p.top),bottom:Math.round(p.bottom),vw:innerWidth,vh:innerHeight,scrollX:document.documentElement.scrollWidth-innerWidth,dockTop:dock&&dock.width>dock.height?Math.round(dock.top):null};});
  f.size=[w,h];fits.push(f);await page.screenshot({path:path.join(out,`fit-${w}x${h}.png`)});
  assert(f.left>=0&&f.right<=f.vw,'panel inside the screen '+JSON.stringify(f));assert(f.top>=0&&f.bottom<=f.vh,'panel on screen '+JSON.stringify(f));assert(f.scrollX<=0,'no sideways scroll');
  if(f.dockTop!=null)assert(f.bottom<=f.dockTop+1,'panel above the dock '+JSON.stringify(f));
 }
 pass('The panel fits phones held both ways',fits);
 assert.equal(report.errors.length,0,report.errors.join('\n'));report.complete=true;
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
