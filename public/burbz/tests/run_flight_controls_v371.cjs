/* Real touch controls and rendered camera motion on the borrowed Academy scene. */
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_URL||'http://127.0.0.1:8871',out=process.env.EVIDENCE_DIR||'/tmp/flight-controls-v371';
fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader']});
 const report={viewports:[],errors:[]};let page;
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});
  await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
  await context.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:require('./village_walk_fixture_20260907.cjs')}));
  page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));
  const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
  const state=()=>page.evaluate(()=>__burbzVillageWalkDebug.state());
  const cdp=await context.newCDPSession(page),touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
  const release=()=>touch('touchEnd',[]);
  const place=async(y=12)=>{await page.evaluate(y=>{window.dispatchEvent(new Event('blur'));__burbzVillageWalkDebug.place({x:0,y,z:20,yaw:0,pitch:0,landed:null,velocity:{x:0,y:0,z:0}});window.dispatchEvent(new Event('focus'));},y);await page.waitForFunction(()=>__burbzVillageWalkDebug.state().running);};
  const samples=n=>run(n=>new Promise(resolve=>{const result=[];let last=-1;function next(){const s=__burbzVillageWalkDebug.state();if(s.frames!==last){last=s.frames;const c=ACADEMY_3D._state.camera;result.push({player:s.player,motion:s.flight.motion,camera:{x:c.position.x,y:c.position.y,z:c.position.z,pitch:c.rotation.x,yaw:c.rotation.y,roll:c.rotation.z}});}if(result.length>=n)resolve(result);else requestAnimationFrame(next);}requestAnimationFrame(next);}),n);
  const verifyCamera=rows=>{for(const {player:p,motion:m,camera:c} of rows){for(const v of Object.values(c))assert(Number.isFinite(v));assert(Math.abs(c.x-p.x)<1e-8);assert(Math.abs(c.z-p.z)<1e-8);assert(Math.abs(c.y-p.y-.45-m.bob)<1e-8,'rendered camera bob');assert(Math.abs(c.pitch-p.pitch-m.pitch)<1e-8,'rendered camera pitch');assert(Math.abs(c.yaw-p.yaw)<1e-8);assert(Math.abs(c.roll-m.roll)<1e-8,'rendered bank');}};
  const flat=rows=>{verifyCamera(rows);for(const r of rows)for(const key of ['bob','pitch','roll'])assert(Math.abs(r.motion[key])<1e-8,'flat '+key);};
  await page.goto(base+'/burbz/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1200);
  await page.evaluate(()=>Element.prototype.requestFullscreen=()=>Promise.reject(Error('test viewport')));
  await run(()=>{if(merlinTutActive)endMerlinTutorial(false);gameState.player.level=20;ensureAcademyBuildings(false);for(const id of Object.keys(BurbzAcademy3D.ANCHORS))gameState.academyBuildings[id]={built:true};localStorage.setItem(ACADEMY_VIEW_KEY,'3d');switchScreen('academy');applyAcademyView();saveState();});
  await page.locator('#academyStage3D canvas').waitFor();await page.locator('#academyFlightBtn').click();
  await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().frames>0,null,{timeout:90000});
  assert.equal((await state()).failed,false);assert.equal(await page.locator('.af-forward,.af-lift,[data-flight]').count(),0);
  assert.equal(await page.locator('.af-controls input[type=range]').count(),1);assert.equal(await page.locator('.af-controls button:not(.af-land)').count(),0);
  for(const viewport of [{width:390,height:844},{width:320,height:568},{width:844,height:390}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(300);await place();
   for(const selector of ['.vw-stick','.af-right input','.vw-exit']){const b=await page.locator(selector).boundingBox();assert(b&&b.x>=0&&b.y>=0&&b.x+b.width<=viewport.width&&b.y+b.height<=viewport.height,selector+' fits '+viewport.width);}
   const stick=await page.locator('.vw-stick').boundingBox(),cx=stick.x+stick.width/2,cy=stick.y+stick.height/2;
   const directions=[];
   for(const [name,dx,dy,axis,sign] of [['forward',0,-30,'z',-1],['backward',0,30,'z',1],['left',-30,0,'x',-1],['right',30,0,'x',1]]){
    await place();const before=(await state()).player;await touch('touchStart',[{x:cx,y:cy,id:1}]);await touch('touchMove',[{x:cx+dx,y:cy+dy,id:1}]);
    await page.waitForFunction(({before,axis,sign})=>(__burbzVillageWalkDebug.state().player[axis]-before[axis])*sign>.4,{before,axis,sign},{timeout:20000});
    const after=(await state()).player;await release();assert.equal(after.yaw,0,name+' never turns head');assert.equal(after.pitch,0,name+' never tilts head');assert.equal(after.y,before.y,name+' does not alter altitude');assert(Math.abs(after[axis==='x'?'z':'x']-before[axis==='x'?'z':'x'])<1e-8,name+' correct axis');directions.push(name);
   }
   await place();const before=(await state()).player,range=await page.locator('.af-right input').boundingBox(),lx=Math.round(viewport.width*.66),ly=Math.round(viewport.height*.38);
   const points=[{x:cx,y:cy,id:1},{x:lx,y:ly,id:2}];await touch('touchStart',points);
   points[0]={x:cx,y:cy-30,id:1};points[1]={x:lx+30,y:ly-20,id:2};await touch('touchMove',points);
   points.push({x:range.x+range.width/2,y:range.y+8,id:3});await touch('touchStart',points);
   await page.waitForFunction(before=>{const p=__burbzVillageWalkDebug.state().player;return Math.hypot(p.x-before.x,p.z-before.z)>.4&&p.y>before.y+.25&&Math.abs(p.yaw)>.05&&Math.abs(p.pitch)>.03;},before,{timeout:20000});
   const simultaneous=(await state()).player;await release();assert.equal(await page.locator('.af-right input').inputValue(),'0','slider springs to neutral');
   await page.screenshot({path:path.join(out,'controls-'+viewport.width+'.png')});report.viewports.push({viewport,directions,simultaneous});console.log('Controls PASS',viewport.width);
  }
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);await place(10);
  await page.keyboard.down('KeyW');await page.keyboard.down('Space');await page.waitForFunction(()=>__burbzVillageWalkDebug.state().flight.motion.mode==='flapping');
  const climb=await samples(24);verifyCamera(climb);assert(Math.max(...climb.map(r=>r.motion.bob))-Math.min(...climb.map(r=>r.motion.bob))>.02,'visible wingbeat bob');assert(Math.max(...climb.map(r=>r.motion.pitch))-Math.min(...climb.map(r=>r.motion.pitch))>.006,'visible wingbeat pitch');assert(climb.at(-1).player.y>climb[0].player.y,'body really climbs');
  await page.keyboard.up('Space');await page.keyboard.up('KeyW');await place(18);
  await page.keyboard.down('KeyW');await page.keyboard.down('ShiftLeft');await page.waitForFunction(()=>__burbzVillageWalkDebug.state().flight.motion.mode==='gliding');
  const glide=await samples(16);flat(glide);assert(glide.at(-1).player.y<glide[0].player.y,'body really descends');await page.keyboard.up('ShiftLeft');await page.keyboard.up('KeyW');
  report.camera={climb,glide,banks:{}};
  for(const [name,key,sign] of [['left','ArrowLeft',1],['right','ArrowRight',-1]]){
   await place();await page.keyboard.down('KeyW');await page.keyboard.down(key);const rows=await samples(14);verifyCamera(rows);assert(rows.some(r=>r.motion.roll*sign>.015),name+' banks with heading');assert(rows.every(r=>Math.abs(r.motion.roll)<=.240001),'bounded roll');assert(rows.some((r,i)=>i&&Math.abs(r.motion.roll-rows[i-1].motion.roll)>.0001),'bank changes over frames');await page.keyboard.up(key);await page.keyboard.up('KeyW');report.camera.banks[name]=rows;
  }
  await place();flat(await samples(3));report.reset=true;
  await page.emulateMedia({reducedMotion:'reduce'});await page.keyboard.down('KeyW');await page.keyboard.down('Space');await page.keyboard.down('ArrowLeft');const reduced=await samples(12);flat(reduced);assert(reduced.at(-1).player.y>reduced[0].player.y,'reduced motion keeps flight');await page.keyboard.up('ArrowLeft');await page.keyboard.up('Space');await page.keyboard.up('KeyW');await page.emulateMedia({reducedMotion:'no-preference'});report.reducedMotion=true;
  await place();const pad=(await state()).flight.pads.find(p=>p.roomId==='library');assert(pad);await page.evaluate(p=>__burbzVillageWalkDebug.place({...p,pitch:0,landed:null,velocity:{x:0,y:0,z:0}}),pad);
  await page.locator('.af-land').waitFor({state:'visible'});await page.locator('.af-land').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.landed==='library');flat(await samples(3));
  await page.locator('.vr-door').waitFor({state:'visible'});await page.locator('.vr-door').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().interiors.inside);flat(await samples(3));assert.equal(await page.locator('.af-controls').isVisible(),false,'flight controls hidden indoors');
  await page.locator('.vw-exit').click();await page.waitForFunction(()=>!__burbzVillageWalkDebug.state().interiors.inside);flat(await samples(3));await page.locator('.af-land').click();await page.waitForFunction(()=>!__burbzVillageWalkDebug.state().player.landed);flat(await samples(3));report.landRoomReturn=true;
  await page.locator('.vw-exit').click();assert.equal(await page.locator('#villageWalk').count(),0);assert.equal(await run(()=>ACADEMY_3D._state.borrowed),false);assert.equal(await page.locator('#academyStage3D canvas').count(),1);report.exitRestored=true;
  assert.deepEqual(report.errors,[]);report.pass=true;console.log('PASS flight controls v371');
 }catch(error){report.failure=error.stack;if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});throw error;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
