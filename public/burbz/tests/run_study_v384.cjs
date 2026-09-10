/* Full-app proof: one live command screen, genuine touch/media and house camera travel.
 * Fixtures seed a veteran save and mock recognition responses; game actions remain real.
 * Run from any cwd. Screenshots/reports stay outside the shipped application. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/src/gstack/node_modules/playwright');
const preview=process.argv.includes('--preview');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||('/root/burbz-study-v384-evidence/'+(preview?'preview':'browser'));
const port=Number(process.env.STUDY_PORT)||8894,url=`http://localhost:${port}/burbz/`;fs.mkdirSync(out,{recursive:true});
const seed=`
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
if(!localStorage.getItem('study-test-seeded')){
 const fixture=JSON.parse(JSON.stringify(DEFAULT_STATE));
 fixture.player.level=20;fixture.player.coins=123456;fixture.player.branches=4321;
 fixture.playerHome=BurbzPlayerHomeCore.initial(true);fixture.playerHome.tier=1;
 fixture.settings={music:false,sfx:false,appearance:'normal'};
 fixture.starterTimber={taken:{0:true,1:true,2:true,3:true,4:true,5:true}};
 fixture.studyProof='retained';localStorage.setItem('burbz_state',JSON.stringify(fixture));
 localStorage.setItem('study-test-seeded','1');
}
window.__testEval=code=>eval(code);
`;
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,url).pathname).replace(/^\/burbz\//,'')||'index.html',file=path.resolve(root,rel);
 if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 try{let data=fs.readFileSync(file);if(rel==='index.html'||/^(?:player_home|scan_home).*\.(js|css)$/.test(rel)||rel.startsWith('assets/home-v384/'))report.servedHashes[rel]=crypto.createHash('sha256').update(data).digest('hex');if(rel==='index.html')data=Buffer.from(data.toString().replace('\ninit();','\n'+seed+'\ninit();'));
 res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(data);
 }catch{res.writeHead(404);res.end();}
});
const report={checks:[],errors:[],transitions:{},servedHashes:{}};let browser,page,context,videoStartedAt;
const record=(name,details=true)=>{report.checks.push({name,details});console.log('PASS',name);};
const run=code=>page.evaluate(code=>__testEval(code),code);
async function touch(selector){const el=page.locator(selector);await el.waitFor({state:'visible'});await el.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await page.waitForFunction(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},await el.elementHandle(),{timeout:10000});const b=await el.boundingBox();assert(b,selector+' has an unobscured touch target');await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
async function shot(name){await page.screenshot({path:path.join(out,name+'.png')});}
async function atDesk(){await page.waitForFunction(()=>!BurbzPlayerHome.isOpen());assert.equal(await run('currentScreen'),'scan');assert(await page.locator('#playerHomeStand').isVisible());}
async function standing(){await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.frames>3&&!BurbzPlayerHome.diagnostics()?.busy);assert.equal(await page.evaluate(()=>BurbzPlayerHome.diagnostics().mode),'room');}
async function home(){await run("closeTrainingHub();switchScreen('scan');renderScanHome();");await page.locator('#screen-scan').evaluate(e=>e.scrollTop=0);}
async function startTrace(name){await page.evaluate(name=>{const rows=[];window.__studyTrace={name,rows,active:true};function sample(){const d=BurbzPlayerHome.diagnostics(),r=document.getElementById('app').getBoundingClientRect();rows.push({time:performance.now(),home:!!d,busy:d?.busy,transition:d?.transition,x:r.x,y:r.y,width:r.width,height:r.height,camera:d?.camera,surfaceVisible:d?.surfaceVisible});if(window.__studyTrace.active)requestAnimationFrame(sample);}requestAnimationFrame(sample);},name);}
async function finishTrace(name){const rows=await page.evaluate(()=>{window.__studyTrace.active=false;return window.__studyTrace.rows;});report.transitions[name]=rows;return rows;}
function intermediate(rows,direction){const during=rows.filter(r=>r.transition===direction);assert(during.length>=4,`${direction} has multiple actual animation frames`);const widths=during.map(r=>r.width),range=Math.max(...widths)-Math.min(...widths);assert(range>100,`${direction} visibly changes projected screen size`);const cameras=during.map(r=>r.camera?.z).filter(Number.isFinite);assert(Math.max(...cameras)-Math.min(...cameras)>.1,`${direction} moves the physical camera`);return {frames:during.length,range};}
async function sameNodes(inHouse){assert(await page.evaluate(inHouse=>{
 const refs=window.__studyRefs;return refs.app===document.getElementById('app')&&refs.scan===document.getElementById('screen-scan')&&refs.mic===document.getElementById('scanBtn')&&refs.camera===document.getElementById('captureBtn')&&refs.app.isConnected&&!!refs.app.closest('#playerHome')===inHouse;
},inHouse));for(const id of ['app','screen-scan','scanBtn','captureBtn'])assert.equal(await page.locator('#'+id).count(),1,id+' remains unique');}
async function screenCorners(){const corners=await page.evaluate(()=>{
 const d=BurbzPlayerHome.diagnostics(),v=d.screen,w=d.projection.width,h=d.projection.height,m=new DOMMatrix(getComputedStyle(document.querySelector('.ph-screen-surface')).transform);
 return [[0,0,v.x-v.width/2,v.y+v.height/2],[w,0,v.x+v.width/2,v.y+v.height/2],[w,h,v.x+v.width/2,v.y-v.height/2],[0,h,v.x-v.width/2,v.y-v.height/2]].map(([x,y,wx,wy])=>{const a=new DOMPoint(x,y).matrixTransform(m),b=__burbzPlayerHomeDebug.project({x:wx,y:wy,z:v.z});return {css:{x:a.x/a.w,y:a.y/a.w},world:b,error:Math.hypot(a.x/a.w-b.x,a.y/a.w-b.y)};});
 });assert(corners.every(p=>p.error<.1),'all real CSS corners coincide with the physical monitor');return corners;}
async function fixture(){await run(`
 const hungry=createBirdEntry('Great Spotted Woodpecker','Dendrocopos major',.99);hungry.id='study-hungry';hungry.care.hunger=92;hungry.care.lastUpdated=Date.now();
 const hurt=createBirdEntry('Robin','Erithacus rubecula',.99);hurt.id='study-hurt';hurt.hp=5;hurt.maxHp=100;
 gameState.flock=[hungry,hurt];gameState.player.mealsServed=1;gameState.pantry={mealworm_scoop:5};
 for(const id of ['kitchen','tavern','hospital','training'])gameState.academyBuildings[id]={built:true,builtAt:'fixture'};
 gameState.birdTrainingSessions=[{id:'study-training',birdId:'study-hungry',birdName:'Woodpecker',room:'training',startMs:Date.now()-120000,endMs:Date.now()-60000,status:'complete',rewards:{}}];
 gameState.forgeJobs=[{id:'study-forge',gearId:'thorn_talons',startMs:Date.now()-60000,endMs:Date.now()-1}];
 const q=DAILY_QUESTS[0];gameState.quests[q.id]={progress:q.target,claimed:false};window.studyQuest=q.id;
 const empire=ensureEmpireState();empire.villages={};
 for(const [seed,name,pop] of [[8101,'Willowbrook',12],[8102,'Fern Hollow',9]]){const v=empire.villages[seed]={seed,name,lat:53.349+(seed-8101)*.002,lon:-1.786,claimedAt:new Date().toISOString()};const eco=ensureVillageEconomy(v);eco.population=pop;eco.stores.food=0;eco.stores.water=0;}
 applyFeatureGates();saveState();updateActionBadges();renderScanHome();`);}

(async()=>{await new Promise(r=>server.listen(port,'127.0.0.1',r));
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
 context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',permissions:['geolocation'],geolocation:{latitude:53.349,longitude:-1.786,accuracy:8},...(preview?{recordVideo:{dir:out,size:{width:390,height:844}}}:{})});
 page=await context.newPage();videoStartedAt=Date.now();page.on('pageerror',e=>report.errors.push(e.message));
 await page.addInitScript(()=>{window.mediaRequests=0;const original=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=(...args)=>{window.mediaRequests++;return original(...args);};});
 await context.route('**/api/identify/sound',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({found:false,message:'No bird in this proof recording.'})}));
 let photoUploads=0;await context.route('**/api/identify/image',r=>{photoUploads++;return r.fulfill({contentType:'application/json',body:JSON.stringify({found:false,message:'No bird in this proof image.'})});});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');await atDesk();
 report.build=await run('BURBZ_BUILD');await run('if(merlinTutActive)endMerlinTutorial(false);');assert.equal(await page.evaluate(()=>mediaRequests),0);await fixture();
 await page.locator('.scan-home-backdrop').evaluate(img=>img.decode());
 await page.evaluate(()=>window.__studyRefs={app:document.getElementById('app'),scan:document.getElementById('screen-scan'),mic:document.getElementById('scanBtn'),camera:document.getElementById('captureBtn')});
 record('Veteran returns to the study without media permission');
 if(preview){
  await run('for(const q of PLAYER_QUESTS)gameState.quests[q.id]={progress:q.target,claimed:true};applyFeatureGates();updateActionBadges();renderScanHome();');
  report.previewTimeline={readyMs:Date.now()-videoStartedAt};await page.waitForTimeout(1300);report.previewTimeline.standMs=Date.now()-videoStartedAt;await touch('#playerHomeStand');await standing();await sameNodes(true);await page.waitForTimeout(700);
  const previewCdp=await context.newCDPSession(page),b=await page.locator('.ph-stick').boundingBox(),f={x:b.x+b.width/2,y:b.y+b.height/2},z=await page.evaluate(()=>BurbzPlayerHome.diagnostics().player.z);
  await previewCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[f]});await previewCdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:f.x,y:f.y+25}]});await page.waitForFunction(z=>BurbzPlayerHome.diagnostics().player.z>z+.8,z);await previewCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(800);
  await previewCdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[f]});await previewCdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:f.x,y:f.y-25}]});await page.waitForFunction(z=>BurbzPlayerHome.diagnostics().player.z<=z+.05,z);await previewCdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(450);
  report.previewTimeline.seatMs=Date.now()-videoStartedAt;await touch('.ph-interact');await atDesk();await sameNodes(false);report.previewTimeline.returnedMs=Date.now()-videoStartedAt;await page.waitForTimeout(1400);await shot('returned-to-study');record('Recorded actual Home, stand, touch walk and sit journey');assert.deepEqual(report.errors,[]);report.complete=true;return;
 }

 for(const appearance of ['normal','comic'])for(const width of [320,390,1280]){
  await page.setViewportSize({width,height:width===1280?800:844});await run(`gameState.settings.appearance='${appearance}';BurbzAppearanceCore.apply('${appearance}',document);`);await page.locator('#screen-scan').evaluate(e=>e.scrollTop=0);
  for(const id of ['scanBtn','captureBtn']){const box=await page.locator('#'+id).boundingBox();assert(box&&box.height>=44&&box.y+box.height<720,`${id} prominent at ${width}`);}
  assert(await page.locator('#screen-scan').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'no horizontal overflow');
  await shot(`study-${appearance}-${width}`);
 }
 await page.setViewportSize({width:390,height:844});await run("gameState.settings.appearance='normal';BurbzAppearanceCore.apply('normal',document);");
 record('Both appearances fit 320, 390 and desktop with accessible scanner targets');

 await startTrace('stand');await touch('#playerHomeStand');await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.transition==='stand');await sameNodes(true);await page.waitForTimeout(350);await shot('stand-intermediate');await standing();const standTrace=await finishTrace('stand');record('Pull-away has genuine intermediate camera and live DOM frames',intermediate(standTrace,'stand'));
 await sameNodes(true);assert(await page.evaluate(()=>document.getElementById('app').inert));assert(await page.locator('.ph-screen-surface').isVisible());await page.waitForTimeout(400);await shot('standing-live-screen');
 const chairPose=await page.evaluate(()=>({...BurbzPlayerHome.diagnostics().player}));const corners=[];
 for(const side of [-1,1]){assert(await page.evaluate(side=>__burbzPlayerHomeDebug.place({x:side*1.3,z:.3,yaw:side*.34,pitch:0}),side));await page.waitForTimeout(100);corners.push(await screenCorners());await shot(side<0?'monitor-oblique-left':'monitor-oblique-right');}
 assert(await page.evaluate(p=>__burbzPlayerHomeDebug.place(p),chairPose));record('DOM corners match the 3D monitor from both oblique sides',corners);
 // The real existing refresh runs while the player is still in the room.
 await run('gameState.player.coins=234567;updateHeader();updateActionBadges();');assert.match(await page.locator('.home-stat-coins strong').innerText(),/234[,. ]?567/);await sameNodes(true);record('The same live monitor refreshes player state in the room');
 const cdp=await context.newCDPSession(page),stick=await page.locator('.ph-stick').boundingBox(),finger={x:stick.x+stick.width/2,y:stick.y+stick.height/2};const before=await page.evaluate(()=>BurbzPlayerHome.diagnostics().player.z);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[finger]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:finger.x,y:finger.y+25}]});await page.waitForTimeout(550);await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});const moved=await page.evaluate(()=>BurbzPlayerHome.diagnostics().player.z);assert(moved>before+.2);await page.waitForTimeout(180);assert(Math.abs(await page.evaluate(()=>BurbzPlayerHome.diagnostics().player.z)-moved)<.05);await sameNodes(true);await shot('walked-back-live-screen');record('Real thumb walking moves away from the live monitor and release stops');
 await page.keyboard.down('KeyW');await page.waitForFunction(z=>BurbzPlayerHome.diagnostics().player.z<=z+.1,before);await page.keyboard.up('KeyW');await page.locator('.ph-interact').waitFor({state:'visible'});assert.match(await page.locator('.ph-interact').innerText(),/Sit at/);
 await startTrace('seat');await touch('.ph-interact');await page.waitForTimeout(420);await shot('seat-intermediate');await atDesk();const seatTrace=await finishTrace('seat');record('Sitting reverses into the exact same command screen',intermediate(seatTrace,'seat'));await sameNodes(false);assert.equal(await page.evaluate(()=>document.getElementById('app').inert),false);

 // Route destinations are all exercised by native touches, without invoking their handlers.
 const routes=[['map','map'],['quests','quests'],['birdex','birdex'],['academy','academy'],['village','village'],['battle','battle'],['kitchen','academy-room'],['hospital','academy-room'],['training',null],['forge','forge'],['inventory','inventory'],['leaderboards','leaderboards'],['diary','diary'],['profile','profile'],['settings',null]];
 for(const [id,screen] of routes){await home();await touch(`[data-home-action="route-${id}"]`);if(screen)assert.equal(await run('currentScreen'),screen,`route ${id}`);else if(id==='training'){assert(await page.locator('#trainingHubModal.show').isVisible());await run('closeTrainingHub();');}else{assert(await page.locator('#settingsModal.show').isVisible());await run("document.getElementById('settingsModal').classList.remove('show');");}}
 record('Every study directory destination opens through its actual touch control');
 await home();const economy=await run('empireVillages().map(v=>({name:v.name,happiness:Math.round(villageEconomySnapshot(v).happiness*100)}))');for(const v of economy)assert.match(await page.locator('.home-village').filter({hasText:v.name}).innerText(),new RegExp(v.happiness+'% happy'));
 await touch('[data-home-action="village-8101"]');assert.equal(await run('villageActive.seed'),8101);await home();await touch('[data-home-action="quests"]');const questId=await run('window.studyQuest');await touch(`[data-quest="${questId}"]`);assert(await run('gameState.quests[window.studyQuest].claimed'));await page.locator('#questClaimCelebration').waitFor({state:'hidden'});await home();record('Village state matches the economy and ready rewards claim through real controls');

 // Native scanner gestures and media generation guards must survive moving #app.
 await touch('#scanBtn');await page.waitForFunction(()=>__testEval('!!listenerTrack&&listenerTrack.readyState===\'live\''),null,{timeout:15000});assert.equal(await page.evaluate(()=>mediaRequests),1);
 await touch('#playerHomeStand');await standing();assert(await run('continuousSoundScanWanted&&listenerTrack.readyState==="live"'));await touch('.ph-interact');await atDesk();assert.equal(await page.evaluate(()=>mediaRequests),1);await touch('#scanBtn');assert.equal(await run('continuousSoundScanWanted'),false);assert.equal(await run('!!mediaStream'),false);record('Listening survives stand and sit without duplicate permission; Stop releases it');
 const chooser=page.waitForEvent('filechooser');await touch('#captureBtn');const pick=await chooser;await pick.setFiles(path.join(root,'assets/home-v378/woodland-lookout.webp'));await page.locator('#birdCropConfirm').waitFor({state:'visible'});const uploaded=page.waitForResponse(r=>r.url().endsWith('/api/identify/image'));await touch('#birdCropConfirm');await uploaded;await page.waitForFunction(()=>!document.getElementById('captureBtn').disabled);assert.equal(photoUploads,1);record('Camera still opens native picker, crop and one real upload');
 await run("window.__burbzSoundTestDeps={getUserMedia:async()=>{throw Object.assign(new Error('Permission denied'),{name:'NotAllowedError'});}};");await touch('#scanBtn');await page.waitForFunction(()=>__testEval('soundListenerState')==='error');assert.equal(await page.locator('#scanBtn').isDisabled(),false);assert.match(await page.locator('#merlinListenerLine').innerText(),/permission|microphone|denied/i);record('Denied microphone leaves a visible retry');

 await touch('#playerHomeStand');await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.transition==='stand');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await page.evaluate(()=>BurbzPlayerHome.diagnostics());await page.waitForTimeout(400);const still=await page.evaluate(()=>BurbzPlayerHome.diagnostics());assert.equal(still.frames,paused.frames);assert.deepEqual(still.camera,paused.camera);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await standing();await touch('.ph-interact');await atDesk();record('Blur pauses camera and renderer; focus resumes the same transition');
 await page.emulateMedia({reducedMotion:'reduce'});await touch('#playerHomeStand');await standing();assert.equal(await page.evaluate(()=>BurbzPlayerHome.diagnostics().transition),null);await sameNodes(true);await touch('.ph-interact');await atDesk();await sameNodes(false);record('Reduced motion preserves monitor ownership with immediate endpoints');await page.emulateMedia({reducedMotion:'no-preference'});
 await touch('#playerHomeStand');await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.transition==='stand');await page.emulateMedia({reducedMotion:'reduce'});await standing();await touch('.ph-interact');await atDesk();record('Turning on reduced motion during travel resolves to a usable endpoint');await page.emulateMedia({reducedMotion:'no-preference'});
 await touch('#playerHomeStand');await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.busy);await page.setViewportSize({width:1280,height:800});await standing();await sameNodes(true);await shot('resized-during-stand');await touch('.ph-interact');await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.busy);await page.setViewportSize({width:320,height:844});await atDesk();await sameNodes(false);assert(await page.locator('#screen-scan').evaluate(e=>e.scrollWidth<=e.clientWidth+1));record('Resizing during both camera movements keeps the screen attached and restores layout');
 await page.setViewportSize({width:390,height:844});await touch('#playerHomeStand');await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.busy);await page.evaluate(()=>BurbzPlayerHome.close('test-dispose'));await sameNodes(false);assert.equal(await page.locator('.ph-screen-surface').count(),0);assert.equal(await page.evaluate(()=>document.getElementById('app').inert),false);assert.equal(await page.locator('#playerHome canvas').count(),0);record('Disposal mid-animation restores the original app and removes renderer/surface');
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval);await atDesk();assert.equal(await run('gameState.studyProof'),'retained');assert.equal(await run('gameState.playerHome.tier'),1);assert.equal(await page.evaluate(()=>mediaRequests),0);record('Reload preserves save/home and returns safely without starting capture');
 await run("gameState=JSON.parse(JSON.stringify(DEFAULT_STATE));gameState.playerHome=BurbzPlayerHomeCore.initial(true);initQuests();applyFeatureGates();renderScanHome();");for(const key of ['kitchen','hospital','training','forge','battle','inventory','leaderboards'])assert.equal(await page.locator(`[data-home-action="route-${key}"]`).count(),0);for(const key of ['map','quests','village','profile','settings'])assert.equal(await page.locator(`[data-home-action="route-${key}"]`).count(),1);await shot('new-player-gates');record('New players only see destinations their actual progression gates allow');
 assert.deepEqual(report.errors,[]);report.complete=true;
})().catch(async error=>{report.failure=error.stack;console.error(error);if(page){await shot('failure').catch(()=>{});report.diagnostics=await page.evaluate(()=>window.BurbzPlayerHome?.diagnostics()).catch(()=>null);}process.exitCode=1;}).finally(async()=>{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));const video=page?.video();if(context)await context.close();if(preview&&video)await video.saveAs(path.join(out,'study-home-house-preview.webm'));if(browser)await browser.close();server.close();});
