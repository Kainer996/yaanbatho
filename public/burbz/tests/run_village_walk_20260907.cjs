/* Real Burbz scene + disposable context. Never connects to production storage. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_URL||'http://127.0.0.1:8871',out=process.env.EVIDENCE_DIR||'/tmp/burbz-village-walk';
fs.mkdirSync(out,{recursive:true});
const html=require('./village_walk_fixture_20260907.cjs');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu',...(process.env.SOFTWARE_GL?['--use-angle=swiftshader']:[])]});
 const results=[],errors=[];
 try{
  const context=await browser.newContext({viewport:{width:1280,height:800},deviceScaleFactor:1,serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await context.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:html}));
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error'&&/Shader|VALIDATE|GL_INVALID|Framebuffer/.test(m.text()))errors.push(m.text());});
  const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
  await page.goto(base+'/burbz/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);
  await run(()=>{
   if(merlinTutActive)endMerlinTutorial(false);
   burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);
   const empire=ensureEmpireState();empire.villages={};empire.townCharters=[];
   const rec={seed:101,name:'Alder Hollow',lat:51.5,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};
   empire.villages['101']=rec;const eco=ensureVillageEconomy(rec);eco.buildings={cabin:3,well:2,cottages:2,hut:1,minehut:1,lumberhut:2,tavern:2};eco.population=16;eco.ruins=[];eco.constructions=[];
   saveState();openEmpireVillage(101);
  });
  await page.locator('#villageStage canvas').waitFor();await page.locator('#villageWalkBtn').scrollIntoViewIfNeeded();await page.waitForTimeout(800);
  const before=await run(()=>({coins:gameState.player.coins,xp:gameState.player.xp,tutorial:localStorage.getItem(BURBZ_TUTORIAL_STATE_KEY),buildings:JSON.stringify(ensureVillageEconomy(ensureEmpireState().villages['101']).buildings),camera:{...villageCam},scene:villageScene.uuid,renderer:villageRenderer.domElement.width}));
  assert.equal(await page.evaluate(()=>!!window.BurbzVillageWalk),false,'module is lazy');
  await page.screenshot({path:path.join(out,'village-entry-desktop.png')});
  const start=Date.now();await page.locator('#villageWalkBtn').click();
  await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().ready||window.__burbzVillageWalkDebug?.state().failed,{timeout:30000});
  console.log('Opened',await page.evaluate(()=>window.__burbzVillageWalkDebug.state()));
  assert.equal(await page.evaluate(()=>window.__burbzVillageWalkDebug.state().failed),false);
  results.push({test:'open',ms:Date.now()-start,nativeFullscreen:await page.evaluate(()=>!!document.fullscreenElement)});
  const device=await run(()=>{const g=villageRenderer.getContext(),ex=g.getExtension('WEBGL_debug_renderer_info');return {renderer:g.getParameter(ex.UNMASKED_RENDERER_WEBGL),vendor:g.getParameter(ex.UNMASKED_VENDOR_WEBGL),ua:navigator.userAgent};});results.push({device});
  const state=()=>page.evaluate(()=>window.__burbzVillageWalkDebug.state());
  const first=await state();assert.equal(first.buildings.filter(b=>b.id==='cottages').length,2);assert.equal(first.buildings.find(b=>b.id==='cabin').level,3);
  assert.equal(await run(()=>villageScene.uuid),before.scene,'same village scene');
  const borrowed=await page.evaluate(()=>document.querySelector('#villageWalk canvas')===window.__burbzVillageDebug.state().renderer.domElement);assert(borrowed);
  await page.waitForTimeout(1700);await page.screenshot({path:path.join(out,'walk-desktop.png')});
  const p0=(await state()).player;await page.keyboard.down('KeyD');await page.waitForTimeout(750);await page.keyboard.up('KeyD');const p1=(await state()).player;
  assert(Math.hypot(p1.x-p0.x,p1.z-p0.z)>.6,'WASD moves');
  await page.mouse.move(650,400);await page.mouse.down();await page.mouse.move(810,435,{steps:8});await page.mouse.up();const p2=(await state()).player;
  assert(Math.abs(p2.yaw-p1.yaw)>.35,'mouse drag looks');
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(400);await page.keyboard.up('ArrowRight');assert((await state()).player.yaw<p2.yaw-.2);
  await page.keyboard.down('KeyW');await page.waitForTimeout(4500);await page.keyboard.up('KeyW');
  assert(await page.evaluate(()=>{const d=__burbzVillageWalkDebug;const p=d.state().player;return d.world().allowed(p.x,p.z)}));
  results.push({test:'desktop-walking',...await state()});
  await page.waitForTimeout(2000);await page.evaluate(()=>__burbzVillageWalkDebug.resetSamples());await page.keyboard.down('ArrowLeft');await page.waitForTimeout(8000);await page.keyboard.up('ArrowLeft');results.push({test:'desktop-warm-pan',...await state()});
  await page.keyboard.press('Escape');await page.waitForFunction(()=>!document.getElementById('villageWalk'));assert(await page.locator('#villageStage canvas').count());
  assert.deepEqual(await run(()=>({coins:gameState.player.coins,xp:gameState.player.xp,tutorial:localStorage.getItem(BURBZ_TUTORIAL_STATE_KEY),buildings:JSON.stringify(ensureVillageEconomy(ensureEmpireState().villages['101']).buildings),camera:{...villageCam}})),{coins:before.coins,xp:before.xp,tutorial:before.tutorial,buildings:before.buildings,camera:before.camera});
  assert.equal(await page.evaluate(()=>document.activeElement.id),'villageWalkBtn');
  // Viewport fallback plus rotated touch pointer gestures on the full real scene.
  const cdp=await context.newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
  await page.evaluate(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(Error('QA platform fullscreen unavailable'));});
  await page.setViewportSize({width:390,height:844});await page.locator('#villageWalkBtn').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().ready);
  await page.evaluate(()=>document.getElementById('villageWalk').classList.add('vw-touch'));
  const touch=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  await touch('touchStart',[{x:79,y:750,id:1}]);await touch('touchMove',[{x:98,y:719,id:1}]);await page.waitForTimeout(800);
  const touchStart=(await state()).player;
  await touch('touchMove',[{x:98,y:719,id:1},{x:265,y:460,id:2}]);await touch('touchMove',[{x:98,y:719,id:1},{x:315,y:475,id:2}]);await page.waitForTimeout(350);await touch('touchEnd',[]);
  const touchEnd=(await state()).player;assert(Math.abs(touchEnd.yaw-touchStart.yaw)>.15,'right thumb looks while left walks');
  await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,'walk-portrait.png')});
  results.push({test:'portrait-touch',...await state(),viewport:await page.locator('#villageWalk').boundingBox()});
  await page.setViewportSize({width:844,height:390});await page.waitForTimeout(750);
  assert.equal(await page.evaluate(()=>document.getElementById('villageWalk').clientHeight),390);
  await page.waitForTimeout(3500);await page.screenshot({path:path.join(out,'walk-landscape.png')});results.push({test:'landscape',...await state()});
  // Focus/visibility pause cannot retain a held movement pointer/key.
  await page.keyboard.down('KeyW');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await state();await page.waitForTimeout(250);assert.equal((await state()).frames,paused.frames);assert.equal(paused.running,false);
  await page.keyboard.up('KeyW');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(250);assert((await state()).frames>paused.frames);
  await run(()=>handleBurbzBackPress());assert.equal(await page.locator('#villageWalk').count(),0,'browser back handler exits one layer');assert.equal(await run(()=>currentScreen),'village');
  const memories=[];
  for(let i=0;i<4;i++){
   await page.locator('#villageWalkBtn').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().ready);await page.waitForTimeout(350);memories.push((await state()).memory);
   await page.locator('.vw-exit').click();await page.waitForTimeout(300);assert.equal(await page.locator('#villageWalk').count(),0);assert.equal(await page.locator('#villageStage canvas').count(),1);
  }
  assert(memories.at(-1).geometries<=memories[0].geometries+2,'bounded geometry on reentry');assert(memories.at(-1).textures<=memories[0].textures+2,'bounded textures on reentry');results.push({test:'reentry',memories});
  await page.locator('#villageWalkBtn').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().ready);
  await run(()=>villageRenderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  assert.equal((await state()).running,false);assert.equal((await state()).failed,true);assert(await page.locator('.vw-error').isVisible());await page.locator('.vw-error button').click();
  results.push({test:'context-error',passed:true});
  assert.deepEqual(errors,[]);await run(()=>{villageRunning=false;cancelAnimationFrame(villageAnimationRequest);clearTimeout(villagePauseTimer);});await context.close();
 }finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));await browser.close();}
 console.log(JSON.stringify({results,errors},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
