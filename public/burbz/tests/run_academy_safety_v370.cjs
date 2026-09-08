/* Disposable Academy collision, service and lifecycle regression proof. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_URL||'http://127.0.0.1:8871';
const out=process.env.EVIDENCE_DIR||'/tmp/academy-safety-v370';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader']});
 const errors=[],report={};let page;
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await context.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:require('./village_walk_fixture_20260907.cjs')}));
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
  const state=()=>page.evaluate(()=>__burbzVillageWalkDebug.state());
  await page.goto(base+'/burbz/',{waitUntil:'domcontentloaded'});
  await page.waitForTimeout(1200);
  await page.evaluate(()=>Element.prototype.requestFullscreen=()=>Promise.reject(Error('test viewport')));
  await run(()=>{if(merlinTutActive)endMerlinTutorial(false);gameState.player.level=20;ensureAcademyBuildings(false);for(const id of Object.keys(BurbzAcademy3D.ANCHORS))gameState.academyBuildings[id]={built:true};localStorage.setItem(ACADEMY_VIEW_KEY,'3d');switchScreen('academy');applyAcademyView();saveState();});
  await page.locator('#academyStage3D canvas').waitFor();
  const ids=await run(()=>Object.keys(BurbzAcademy3D.ANCHORS).filter(id=>isAcademyRoomBuilt(id)).sort());assert.equal(ids.length,12);
  const open=async room=>{await run(room=>flyAcademy(room||undefined),room);await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().failed||window.__burbzVillageWalkDebug?.state().frames>0,null,{timeout:90000});assert.equal((await state()).failed,false);if(room)assert.equal((await state()).interiors.plan.buildingId,room);};
  const returned=async()=>{assert.equal(await page.locator('#villageWalk').count(),0);assert.equal(await run(()=>!!ACADEMY_3D?._state.borrowed),false);assert.equal(await page.locator('#academyStage3D canvas').count(),1);};
  await open();
  // Exercise the real Academy collision world against an independently raycast
  // scene surface, without adding a synthetic obstacle or changing runtime.
  report.meshCollision=await run(()=>{
   const s=ACADEMY_3D._state,T=THREE,solids=[];s.scene.updateMatrixWorld(true);
   s.scene.traverse(o=>{if(o.isMesh&&o.geometry&&!o.material?.transparent&&!o.userData.sky)solids.push(o);});
   const ray=new T.Raycaster(new T.Vector3(0,7.45,20),new T.Vector3(0,0,-1),0,40);
   const hit=ray.intersectObjects(solids,false).find(h=>h.distance>2&&h.distance<30);if(!hit)throw Error('No real Academy surface on collision probe');
   const w=__burbzVillageWalkDebug.world(),p={x:hit.point.x,y:hit.point.y-.45,z:hit.point.z+1.5,yaw:0,pitch:0};
   const start={...p},beyond={...p,z:hit.point.z-.8};if(w.clear(p,beyond))throw Error('Real mesh does not block the flight ray');
   for(let i=0;i<360;i++)BurbzAcademyFlightCore.step(p,{forward:1},1/60,w);
   if(start.z-p.z<.5)throw Error('Collision probe never advanced toward mesh');
   if(p.z<hit.point.z+.10)throw Error('Flight crossed the real mesh surface');
   if(Math.abs(p.velocity.z)>.001)throw Error('Blocked flight still has forward velocity');
   return{meshType:hit.object.type,roomId:hit.object.userData.roomId||null,surfaceZ:hit.point.z,startZ:start.z,stoppedZ:p.z,forwardVelocity:p.velocity.z};
  });
  console.log('Real mesh collision passed');
  // Blur must stop both held native controls and the animation owner.
  await page.evaluate(()=>__burbzVillageWalkDebug.place({x:0,y:5,z:20,yaw:0,pitch:0,landed:null,velocity:{x:0,y:0,z:0}}));
  await page.keyboard.down('Space');
  await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.y>5.3,null,{timeout:20000});
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  const paused=await state();assert.equal(paused.running,false);assert.deepEqual(paused.player.velocity,{x:0,y:0,z:0});
  await page.waitForTimeout(350);assert.equal((await state()).frames,paused.frames);
  await page.keyboard.up('Space');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(n=>__burbzVillageWalkDebug.state().frames>=n+3,paused.frames,{timeout:20000});
  assert.equal((await state()).player.y,paused.player.y,'blur removes held climb rather than resuming it');report.blurReset=true;
  await page.locator('.vw-exit').click();await returned();
  // Every new room service must land on its actual existing painted service.
  report.serviceRooms=[];
  for(const id of ids){
   await run(()=>{switchScreen('academy');applyAcademyView();});await open(id);
   const action=(await state()).interiors.plan.action;assert(action&&action.kind==='academy-service');
   assert(await page.evaluate(p=>__burbzVillageWalkDebug.place(p),action),'reachable service '+id);
   await page.locator('.vr-service').waitFor({state:'visible'});await page.locator('.vr-service').click();
   await returned();assert.equal(await run(()=>currentScreen),'academy-room');assert.equal(await run(()=>academyInteriorRoom),id);
   assert.equal(await page.locator('.academy-explore-room').count(),1);report.serviceRooms.push(id);console.log('Service',id);
  }
  // A room may remain in a previous scene until refresh; ownership still gates pads.
  await run(()=>{switchScreen('academy');applyAcademyView();gameState.academyBuildings.observatory={built:false};});
  await open();assert(!(await state()).flight.pads.some(p=>p.roomId==='observatory'));await page.locator('.vw-exit').click();await returned();
  await run(()=>flyAcademy('observatory'));assert.equal(await page.locator('#villageWalk').count(),0);report.unbuiltExcluded=true;
  await run(()=>{gameState.academyBuildings.observatory={built:true};applyAcademyView();});
  // Room exit, flight exit and reentry must release all owned scene additions.
  report.resourceCycles=[];
  for(let i=0;i<3;i++){
   await open('library');const active=await state();assert(active.interiors.life.pickups.length===2);
   await page.locator('.vw-exit').click();await returned();
   await run(()=>{switchScreen('academy');applyAcademyView();});
   await page.waitForTimeout(250);
   report.resourceCycles.push(await run(()=>({children:ACADEMY_3D._state.scene.children.length,geometries:ACADEMY_3D._state.renderer.info.memory.geometries,textures:ACADEMY_3D._state.renderer.info.memory.textures})));
  }
  assert.deepEqual(report.resourceCycles[2],report.resourceCycles[1],'reentry does not retain flight pads, room meshes or textures');
  // Navigation from inside a room must not reopen its old painted service.
  await open('library');await run(()=>switchScreen('birdex'));await returned();assert.equal(await run(()=>currentScreen),'birdex');
  await page.waitForTimeout(350);assert.equal(await run(()=>currentScreen),'birdex');assert.equal(await page.locator('#villageWalk').count(),0);report.navigationCleanup=true;
  await run(()=>{switchScreen('academy');applyAcademyView();});await open();
  // Real browser context-loss event: a usable error exit restores the borrowed
  // canvas. No fake economy writes or replacement renderer are introduced.
  await run(()=>ACADEMY_3D._state.renderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));
  assert.equal((await state()).failed,true);await page.locator('.vw-error button').click();await returned();
  await open();assert.equal((await state()).failed,false);await page.locator('.vw-exit').click();await returned();report.contextLossExitAndReentry=true;
  // Delay a cold dependency, navigate away, then allow its actual execution.
  await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1000);await page.evaluate(()=>Element.prototype.requestFullscreen=()=>Promise.reject(Error('test viewport')));
  await run(()=>{if(merlinTutActive)endMerlinTutorial(false);localStorage.setItem(ACADEMY_VIEW_KEY,'3d');switchScreen('academy');applyAcademyView();});
  let release,seen;const requested=new Promise(r=>seen=r);
  await context.route('**/academy_flight.js*',r=>new Promise(resolve=>{release=async()=>{await r.continue();resolve();};seen();}));
  await page.locator('#academyFlightBtn').click();await requested;await run(()=>switchScreen('birdex'));await release();
  await page.waitForFunction(()=>!!window.BurbzAcademyFlight,null,{timeout:20000});await returned();assert.equal(await run(()=>currentScreen),'birdex');report.delayedNavigation=true;
  // Destroy the actual WebGL context last: the app intentionally falls back
  // to the painted tree instead of trying to reuse a dead renderer.
  await run(()=>{switchScreen('academy');applyAcademyView();});await open();
  const canLose=await run(()=>{const extension=ACADEMY_3D._state.renderer.getContext().getExtension('WEBGL_lose_context');if(!extension)return false;extension.loseContext();return true;});
  if(canLose){await page.waitForFunction(()=>__burbzVillageWalkDebug.state().failed,null,{timeout:20000});assert(await run(()=>ACADEMY_3D._state.renderer.getContext().isContextLost()));await page.locator('.vw-error button').click();assert.equal(await page.locator('#villageWalk').count(),0);assert.equal(await run(()=>academy3dBroken),true);assert.equal(await run(()=>ACADEMY_3D),null);assert(await page.locator('#academyTreehouse').isVisible());assert(await page.locator('#academyStage3D').isHidden());report.realContextLossPaintedFallback=true;}
  else report.realContextLossPaintedFallback='WEBGL_lose_context unavailable';
  assert.deepEqual(errors,[]);report.pass=true;
 }catch(error){report.failure=error.stack||String(error);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
 finally{report.errors=errors;fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser.close();}
 console.log('PASS Academy safety',JSON.stringify(report));
})().catch(error=>{console.error(error);process.exitCode=1;});
