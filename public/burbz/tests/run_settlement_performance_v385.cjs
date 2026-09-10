/* Real village/town render-loop comparison. Run sequentially, never beside another browser.
 * --baseline serves v384; the default serves the current worktree. Neither edits runtime files.
 * Outputs refuse reuse. Current results compare fixtures/cameras with BASELINE_RESULTS.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('/root/src/gstack/node_modules/playwright');
const baseline=process.argv.includes('--baseline'),resume=process.argv.includes('--resume');
const root=baseline?'/root/burbz-study-v384/public/burbz':path.resolve(__dirname,'..');
const evidence='/root/burbz-homestead-v385-evidence';
const out=process.env.EVIDENCE_DIR||path.join(evidence,'settlement-performance-'+(baseline?'v384':'v385'));
const baselineFile=process.env.BASELINE_RESULTS||path.join(evidence,'settlement-performance-v384/results.json');
const before=!baseline?JSON.parse(fs.readFileSync(baselineFile,'utf8')):null;
if(before)assert.equal(before.complete,true,'Baseline must be complete before comparison');
assert(!fs.existsSync(path.join(out,'results.json')),'Choose a new EVIDENCE_DIR; prior measurements are preserved');
fs.mkdirSync(out,{recursive:true});
const port=Number(process.env.SETTLEMENT_PERF_PORT)||8899,url=`http://localhost:${port}/burbz/`;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const fixedDate='2026-09-10T12:00:00Z',warmupMs=1500,sampleMs=4000;
const report={baseline,sourceRoot:root,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),at:new Date().toISOString(),fixedDate,protocol:{clock:'Fixed civil Date only; native performance, timers and animation frames',viewport:{width:390,height:844},deviceScaleFactor:1,hardwareConcurrency:4,deviceMemory:4,warmupMs,sampleMs,appearances:['normal','comic'],views:['village-overview','village-walking','town-overview',...(baseline?[]:['town-walking'])],motions:'Overview: two idle samples. Walking: idle then native ArrowRight look; same baseline start position and yaw.',measurement:'Completed outer BurbzManga.render calls, summed underlying renderer passes, actual resolution and wall-clock frame gaps. Adaptive detail remains active.'},hashes:{},servedVersions:{},fixtures:{},samples:[],comparisons:[],errors:[],glErrors:[],checks:[],limitations:['Chromium 1228 with ANGLE SwiftShader and touch emulation; not physical-phone performance.','Local same-origin art only; external requests blocked. New v385 scene objects remain enabled.','Fixed civil clock and equal saved economy/camera; ambient animation phase follows real elapsed time.','Town walking did not exist in v384 and has no before/after comparison.','No throughput threshold is asserted: raw samples and resolution accompany every comparison.']};
if(before)assert.deepEqual({...report.protocol,views:before.protocol.views},before.protocol,'Use the identical comparison protocol');
if(resume){const previous=JSON.parse(fs.readFileSync(path.join(evidence,'settlement-performance-before-undefined-keys/results.json'),'utf8'));assert(!baseline&&previous.samples.length===4&&previous.samples.every(s=>s.label.startsWith('normal-village-')));assert.deepEqual(previous.protocol,report.protocol,'Resume requires the identical native-clock protocol; clock-controlled evidence cannot supply throughput samples');assert.deepEqual(previous.errors,[]);assert.deepEqual(previous.glErrors,[]);for(const [file,digest] of Object.entries(previous.hashes))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest);for(const key of ['samples','comparisons','hashes','servedVersions','fixtures'])report[key]=previous[key];report.precedingEvidence='settlement-performance-before-undefined-keys/results.json: four Normal village samples passed before undefined-vs-absent JSON key comparison error. Exact source verified unchanged on resume.';}
const seed=`
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
const fixture=JSON.parse(JSON.stringify(DEFAULT_STATE));
Object.assign(fixture.player,{name:'Rowan',level:20,coins:123456,branches:4321,stone:123});
fixture.settings={music:false,sfx:false,vibration:false,appearance:'normal'};
fixture.playerHome=BurbzPlayerHomeCore.initial(true);fixture.playerHome.tier=1;
fixture.starterTimber={taken:{0:true,1:true,2:true,3:true,4:true,5:true}};
for(const q of PLAYER_QUESTS)fixture.quests[q.id]={progress:q.target,claimed:true};
localStorage.setItem('burbz_state',JSON.stringify(fixture));
window.__testEval=code=>eval(code);
`;
const server=http.createServer((req,res)=>{
 try{
  const rel=decodeURIComponent(new URL(req.url,url).pathname).replace(/^\/burbz\//,'')||'index.html',file=path.resolve(root,rel);
  if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
  let bytes=fs.readFileSync(file);const digest=hash(bytes);report.hashes[rel]=digest;
  const versions=report.servedVersions[rel]||=[];if(!versions.includes(digest))versions.push(digest);
  if(rel==='index.html'){assert(bytes.toString().includes('\ninit();'),'Fixture anchor exists');bytes=Buffer.from(bytes.toString().replace('\ninit();','\n'+seed+'\ninit();'));}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
 }catch(error){report.httpErrors||=[];report.httpErrors.push({url:req.url,message:error.message});res.writeHead(404);res.end();}
});
let browser,context,page;
const run=code=>page.evaluate(code=>__testEval(code),code);
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
async function touch(selector){const el=page.locator(selector);await el.waitFor({state:'visible'});await el.evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));await el.tap({trial:true});const b=await el.boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
async function setup(appearance){
 context=await browser.newContext({viewport:report.protocol.viewport,deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.route('**/*',r=>new URL(r.request().url()).origin===new URL(url).origin?r.continue():r.abort('blockedbyclient'));
 await context.addInitScript(()=>{Object.defineProperty(navigator,'hardwareConcurrency',{get:()=>4});Object.defineProperty(navigator,'deviceMemory',{get:()=>4});Element.prototype.requestFullscreen=()=>Promise.reject(Error('Fixed viewport benchmark'));});
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/Shader Error|GL_INVALID|INVALID_OPERATION|INVALID_VALUE|WebGL context lost/i.test(m.text()))report.glErrors.push(m.text());});
 await page.addInitScript(iso=>{const NativeDate=Date,fixed=NativeDate.parse(iso);globalThis.Date=new Proxy(NativeDate,{construct:(target,args,newTarget)=>Reflect.construct(target,args.length?args:[fixed],newTarget),apply:target=>new target(fixed).toString(),get:(target,key,receiver)=>key==='now'?()=>fixed:Reflect.get(target,key,receiver)});},fixedDate);await page.goto(url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');report.build=await run('BURBZ_BUILD');
 await run(`if(merlinTutActive)endMerlinTutorial(false);gameState.flock=[];gameState.empire={};const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.mergeChartersVersion=1;gameState.villageDiscoveries={version:1,seed:38520260910,villages:{}};for(const seed of [101,102,103]){const v=e.villages[seed]={seed,name:'Alder '+seed,lat:51.5+(seed-101)*.002,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};const eco=ensureVillageEconomy(v);eco.buildings={cabin:3,well:2,cottages:2,hut:1,tavern:1,chapel:1};eco.population=20;eco.stores.food=100;eco.stores.water=100;eco.ruins=[];eco.constructions=[];}gameState.settings.appearance=${JSON.stringify(appearance)};BurbzAppearanceCore.apply(${JSON.stringify(appearance)},document);applyFeatureGates();saveState();`);
 const fixture=await run('JSON.parse(JSON.stringify({player:gameState.player,empire:gameState.empire,villageDiscoveries:gameState.villageDiscoveries}))');
 report.fixtures[appearance]={hash:hash(JSON.stringify(fixture)),state:fixture};
 if(before)assert.deepEqual(fixture,before.fixtures[appearance].state,'Identical saved settlement fixture: '+appearance);
 await run(`window.__settlementPerf={kind:'village',frames:0,rows:[],collect:false};const original=BurbzManga.render;BurbzManga.render=function(...args){const p=window.__settlementPerf,renderer=p.kind==='town'?townRenderer:villageRenderer,scene=p.kind==='town'?townScene:villageScene;if(args[1]!==renderer||args[2]!==scene)return original.apply(this,args);const render=renderer.render,started=performance.now();let calls=0,triangles=0,passes=0;renderer.render=function(...values){const value=render.apply(this,values);calls+=this.info.render.calls;triangles+=this.info.render.triangles;passes++;return value;};try{const value=original.apply(this,args),now=performance.now();p.frames++;if(p.collect)p.rows.push({at:now,renderMs:now-started,calls,triangles,passes,dpr:renderer.getPixelRatio(),width:renderer.domElement.width,height:renderer.domElement.height});return value;}finally{renderer.render=render;}};`);
}
async function overview(kind){
 await run(`__settlementPerf.kind=${JSON.stringify(kind)};${kind==='village'?'openEmpireVillage(101);':"ensureEmpireState().townCharters=[{seeds:[101,102,103],mergedAt:new Date().toISOString()}];saveState();openEmpireTown(empireSettlementsInfo().towns[0].id);"}`);
 await page.locator('#'+kind+'Stage canvas').waitFor({state:'visible',timeout:60000});
 await page.locator('#'+kind+'Stage').evaluate(e=>e.scrollIntoView({block:'center',inline:'nearest',behavior:'instant'}));
 await run(`Object.assign(${kind}Cam,{azimuth:0,polar:1.02,dist:${kind==='town'?38:20},tx:0,tz:0,lastInputAt:performance.now()});`);
 const frames=await run('__settlementPerf.frames');await page.waitForFunction(n=>__settlementPerf.frames>n+3,frames,{timeout:60000});await page.waitForTimeout(warmupMs);
}
async function walking(kind,appearance){
 await touch('#'+kind+'WalkBtn');await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().ready||window.__burbzVillageWalkDebug?.state().failed,null,{timeout:90000});
 assert.equal(await page.evaluate(()=>__burbzVillageWalkDebug.state().failed),false);
 if(!baseline)await page.waitForFunction(()=>__burbzVillageWalkDebug.state().discoveries?.artReady,null,{timeout:60000});
 const previous=before?.samples.find(s=>s.label===appearance+'-'+kind+'-walking-idle');
 if(previous)assert(await page.evaluate(p=>__burbzVillageWalkDebug.place(p),previous.start.player),'Baseline walking viewpoint is still walkable');
 await page.waitForTimeout(warmupMs);
}
async function snapshot(kind,walking){
 return run(`(()=>{const scene=${kind}Scene,renderer=${kind}Renderer,camera=${kind}Camera,objects={all:0,meshes:0,instances:0,sprites:0,lights:0};scene.traverse(o=>{objects.all++;if(o.isMesh)objects.meshes++;if(o.isInstancedMesh)objects.instances+=o.count;if(o.isSprite)objects.sprites++;if(o.isLight)objects.lights++;});return {camera:{position:camera.position.toArray(),quaternion:camera.quaternion.toArray(),fov:camera.fov,aspect:camera.aspect,near:camera.near,far:camera.far},player:${walking?'__burbzVillageWalkDebug.state().player':'null'},memory:{...renderer.info.memory},dpr:renderer.getPixelRatio(),buffer:{width:renderer.domElement.width,height:renderer.domElement.height},quality:${kind}SceneQuality,objects,scene:scene.uuid,buildings:${kind==='town'?'townEconBuildings':'villageBuildings'}.map(b=>({id:b.userData.buildingId,level:b.userData.modelLevel,x:b.position.x,z:b.position.z}))};})()`);
}
async function sample(kind,appearance,walking,motion){
 const label=appearance+'-'+kind+'-'+(walking?'walking':'overview')+'-'+motion;
 const start=await snapshot(kind,walking),previous=before?.samples.find(s=>s.label===label);
 if(previous&&motion==='idle'){
  const close=(a,b)=>Array.isArray(a)?a.every((v,i)=>close(v,b[i])):Math.abs(a-b)<1e-5;
  assert(close(start.camera.position,previous.start.camera.position)&&close(start.camera.quaternion,previous.start.camera.quaternion),'Identical initial camera: '+label);
  assert.equal(start.camera.aspect,previous.start.camera.aspect,'Equal initial aspect: '+label);
  assert.deepEqual(JSON.parse(JSON.stringify(start.buildings)),previous.start.buildings,'Equal actual building layout: '+label);
 }
 if(motion==='look')await page.keyboard.down('ArrowRight');
 let measured;
 try{measured=await page.evaluate(ms=>new Promise(resolve=>{
  const p=__settlementPerf,started=performance.now(),initial=p.frames,longTasks=[];p.rows=[];p.collect=true;
  const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({at:e.startTime,duration:e.duration}))));observer.observe({type:'longtask'});
  setTimeout(()=>{p.collect=false;observer.disconnect();resolve({durationMs:performance.now()-started,completedFrames:p.frames-initial,rows:p.rows.slice(),longTasks});},ms);
 }),sampleMs);}finally{if(motion==='look')await page.keyboard.up('ArrowRight');}
 assert(measured.completedFrames>3,'Real scene rendered throughout '+label);
 const rows=measured.rows,gaps=rows.slice(1).map((r,i)=>r.at-rows[i].at).sort((a,b)=>a-b),pct=(a,n)=>a[Math.min(a.length-1,Math.floor(a.length*n))];
 const result={label,kind,walking,motion,comparable:!(kind==='town'&&walking),start,end:await snapshot(kind,walking),...measured,fps:measured.completedFrames*1000/measured.durationMs,frameGap:{median:pct(gaps,.5),p95:pct(gaps,.95),max:pct(gaps,1)},drawCalls:{median:pct(rows.map(r=>r.calls).sort((a,b)=>a-b),.5)},triangles:{median:pct(rows.map(r=>r.triangles).sort((a,b)=>a-b),.5)}};
 report.samples.push(result);
 if(previous)report.comparisons.push({label,baselineFps:previous.fps,currentFps:result.fps,fpsChangePercent:100*(result.fps/previous.fps-1),baselineP95:previous.frameGap.p95,currentP95:result.frameGap.p95,baselineDraws:previous.drawCalls.median,currentDraws:result.drawCalls.median,baselineDpr:[...new Set(previous.rows.map(r=>r.dpr))],currentDpr:[...new Set(rows.map(r=>r.dpr))],baselineBuffer:previous.end.buffer,currentBuffer:result.end.buffer});
 console.log(JSON.stringify({label,fps:result.fps,p95:result.frameGap.p95,draws:result.drawCalls.median,dpr:result.end.dpr}));save();
}
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
 browser=await chromium.launch({headless:true,executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader']});
 for(const appearance of report.protocol.appearances){
  await setup(appearance);
  for(const kind of ['village','town']){
   if(resume&&appearance==='normal'&&kind==='village')continue;
   await overview(kind);await page.screenshot({path:path.join(out,appearance+'-'+kind+'-overview.png')});
   await sample(kind,appearance,false,'idle');await sample(kind,appearance,false,'idle-repeat');
   if(kind==='village'||!baseline){await walking(kind,appearance);await page.screenshot({path:path.join(out,appearance+'-'+kind+'-walking.png')});await sample(kind,appearance,true,'idle');await sample(kind,appearance,true,'look');await touch('.vw-exit');}
  }
  await context.close();context=null;page=null;
 }
 for(const [file,digest]of Object.entries(report.hashes)){assert.equal(report.servedVersions[file].length,1,file+' has one source version');assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,file+' unchanged during sampling');}
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.glErrors,[]);assert.equal(report.samples.length,baseline?12:16);
 report.complete=true;report.checks.push('Equal input fixtures, cameras and building layouts for shared views; actual render counts and source integrity verified.');console.log('PASS settlement performance protocol:',report.samples.length,'samples');
})().catch(async error=>{report.failure=error.stack;console.error(error);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{save();if(browser)await browser.close();server.close();});
