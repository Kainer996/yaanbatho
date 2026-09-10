/* Comparable full-app home measurements; no runtime files are modified.
 * --baseline serves immutable reviewed v384. Default serves the current worktree.
 * The controller response gains only an accessor to its actual renderer/scene.
 */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {chromium}=require('/root/src/gstack/node_modules/playwright');
const baseline=process.argv.includes('--baseline');
const root=baseline?'/root/burbz-study-v384/public/burbz':path.resolve(__dirname,'..');
const out=process.env.EVIDENCE_DIR||'/root/burbz-homestead-v385-evidence/performance-'+(baseline?'v384':'v385');
const port=Number(process.env.HOMESTEAD_PERF_PORT)||8896,url=`http://localhost:${port}/burbz/`;
fs.mkdirSync(out,{recursive:true});
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={sourceRoot:root,sourceCommit:execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),baseline,at:new Date().toISOString(),browser:'Chromium 1228, ANGLE SwiftShader, 390x844, DPR1',protocol:'Two 4-second samples per view after 1-second warmup; idle then real keyboard look. Source bytes hashed before diagnostic-only instrumentation.',hashes:{},checks:[],samples:[],errors:[],glErrors:[],fixtures:{},lifecycle:[],limitations:['Software-WebGL/touch emulation, not a physical phone.','No external art downloads. External network requests are blocked in this deterministic local fixture.','Renderer info includes the actual manga render passes; FPS derives from completed home frames and wall time.']};
const seed=`
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);
localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');
localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
if(!localStorage.getItem('homestead-perf-seeded')){
 const f=JSON.parse(JSON.stringify(DEFAULT_STATE));f.player.level=20;f.player.coins=123456;f.player.branches=5000;f.playerHome=BurbzPlayerHomeCore.initial(true);f.playerHome.tier=2;f.settings={music:false,sfx:false,appearance:'normal'};f.starterTimber={taken:{0:true,1:true,2:true,3:true,4:true,5:true}};
 for(const q of PLAYER_QUESTS)f.quests[q.id]={progress:q.target,claimed:true};
 localStorage.setItem('burbz_state',JSON.stringify(f));localStorage.setItem('homestead-perf-seeded','1');
}
window.__testEval=code=>eval(code);
`;
const server=http.createServer((req,res)=>{
 const rel=decodeURIComponent(new URL(req.url,url).pathname).replace(/^\/burbz\//,'')||'index.html',file=path.resolve(root,rel);
 if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
 try{let bytes=fs.readFileSync(file);if(/\.(js|css|html)$/.test(rel))report.hashes[rel]=hash(bytes);
  if(rel==='index.html')bytes=Buffer.from(bytes.toString().replace('\ninit();','\n'+seed+'\ninit();'));
  if(rel==='player_home.js'){const source=bytes.toString(),anchor='root.BurbzPlayerHome={';assert(source.includes(anchor));bytes=Buffer.from(source.replace(anchor,'root.__homesteadPerfRef=()=>s;\n'+anchor));}
  res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg'})[path.extname(file)]||'application/octet-stream');res.end(bytes);
 }catch{res.writeHead(404);res.end();}
});
let browser,context,page;
const run=code=>page.evaluate(code=>__testEval(code),code);
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const pass=(name,details=true)=>{report.checks.push({name,details});console.log('PASS',name);save();};
async function touch(selector){const e=page.locator(selector);await e.waitFor({state:'visible'});await e.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));await e.tap({trial:true});const b=await e.boundingBox();await page.touchscreen.tap(b.x+b.width/2,b.y+b.height/2);}
async function settled(){await page.waitForFunction(()=>BurbzPlayerHome.diagnostics()?.frames>3&&!BurbzPlayerHome.diagnostics()?.busy,null,{timeout:60000});await page.waitForTimeout(1000);}
async function fixture(full){
 await run(`BurbzPlayerHome.close('performance-fixture');if(merlinTutActive)endMerlinTutorial(false);gameState.playerHome=BurbzPlayerHomeCore.initial(true);gameState.playerHome.tier=2;gameState.flock=[];gameState.empire={};ensureEmpireState();`);
 if(full)await run(`
  const species=[['Robin','Erithacus rubecula'],['Great Spotted Woodpecker','Dendrocopos major'],['Blue Tit','Cyanistes caeruleus'],['Blackbird','Turdus merula']];
  for(let i=0;i<20;i++){const q=species[i%4],b=createBirdEntry(q[0],q[1],.99);b.id='perf-bird-'+i;b.care.hunger=20+i*2;b.care.lastUpdated=Date.now();gameState.flock.push(b);}
  const e=ensureEmpireState();e.mergeChartersVersion=1;e.townCharters=[];
  for(let i=0;i<24;i++){const g=Math.floor(i/3),v=e.villages[9000+i]={seed:9000+i,name:'Perf village '+(i+1),lat:53.35+g*.045+(i%3)*.001,lon:-1.786,claimedAt:new Date().toISOString()};const eco=ensureVillageEconomy(v);eco.population=20;eco.stores.food=120;eco.stores.water=120;if(i%3===2)e.townCharters.push({seeds:[8998+i,8999+i,9000+i],mergedAt:new Date().toISOString()});}
  for(const id of ['kitchen','hospital','training','tavern'])gameState.academyBuildings[id]={built:true,builtAt:'fixture'};
  gameState.walkingQuests={active:{id:'perf-original-walk',name:'The Feathered Path',type:'path',startedAt:Date.now(),distanceWalkedM:1250,lengthM:3000,route:[[53.349,-1.786],[53.36,-1.786]],routeCertification:{status:'certified'},checkpoints:[{kind:'flag',lat:53.349,lon:-1.786,reached:true},{kind:'chest',lat:53.354,lon:-1.786,reached:false},{kind:'finish',lat:53.36,lon:-1.786,reached:false}],birdsCaptured:[],chestsOpened:0},history:[]};
  const C=BurbzPlayerHomeCore;let h=gameState.playerHome;for(const key of Object.keys(C.ITEMS))h.owned[key]=40;
  const legacy=['bench','flowers','lantern','birdbath','rug','chair','books','table'];
  for(const area of ['room','yard']){let placed=0;const coords=[];for(let x=-8;x<=8;x+=1)for(let z=-8;z<=8;z+=1)coords.push({x,z});coords.sort((a,b)=>Math.hypot(a.x,a.z)-Math.hypot(b.x,b.z));
   for(const pos of coords){if(placed>=16)break;for(let j=0;j<legacy.length;j++){const item=legacy[(placed+j)%legacy.length];if(h.placed.some(p=>p.area===area&&p.x===pos.x&&p.z===pos.z))continue;const proposal=C.propose(h,{branches:5000},{kind:'place',item,area,...pos,turn:placed%4});if(proposal.ok){h=proposal.home;placed++;break;}}}
  }
  gameState.playerHome=h;
 `);
 await run('applyFeatureGates();saveState();updateHeader();updateActionBadges();renderScanHome();');
 const facts=await run('({birds:gameState.flock.length,villages:empireVillages().length,townCharters:gameState.empire.townCharters.length,placed:gameState.playerHome.placed.length,roomPlaced:gameState.playerHome.placed.filter(p=>p.area==="room").length,yardPlaced:gameState.playerHome.placed.filter(p=>p.area==="yard").length,saveBytes:localStorage.getItem("burbz_state").length})');
 if(full){assert.equal(facts.birds,20);assert.equal(facts.villages,24);assert.equal(facts.placed,32);}report.fixtures[full?'full':'simple']=facts;
}
async function sample(label,look){
 if(look)await page.keyboard.down('ArrowRight');
 const result=await page.evaluate(()=>new Promise(resolve=>{
  const start=performance.now(),begin=BurbzPlayerHome.diagnostics().frames,rows=[];let last=start,lastFrame=begin;const observer=new PerformanceObserver(list=>longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));const longTasks=[];observer.observe({type:'longtask'});
  function tick(){const now=performance.now(),d=BurbzPlayerHome.diagnostics();if(d.frames>lastFrame)rows.push({gap:now-last,frames:d.frames-lastFrame,draws:d.draws}),last=now,lastFrame=d.frames;
   if(now-start<4000){requestAnimationFrame(tick);return;}observer.disconnect();const s=__homesteadPerfRef(),info=s.renderer.info,objects={all:0,meshes:0,lights:0,sprites:0};s.view.scene.traverse(o=>{objects.all++;if(o.isMesh)objects.meshes++;if(o.isLight)objects.lights++;if(o.isSprite)objects.sprites++;});resolve({durationMs:now-start,completedFrames:d.frames-begin,rows,longTasks,renderer:{render:{...info.render},memory:{...info.memory},pixelRatio:s.renderer.getPixelRatio(),drawingBuffer:{width:s.renderer.domElement.width,height:s.renderer.domElement.height}},objects,diagnostics:{mode:d.mode,area:d.area,room:d.room,player:d.player,homePlacements:d.home.placed.length}});
  }requestAnimationFrame(tick);
 }));
 if(look)await page.keyboard.up('ArrowRight');
 const gaps=result.rows.map(r=>r.gap).sort((a,b)=>a-b);result.fps=Number((result.completedFrames*1000/result.durationMs).toFixed(2));result.frameGap={median:gaps[Math.floor(gaps.length*.5)],p95:gaps[Math.floor(gaps.length*.95)],max:gaps.at(-1)};result.label=label;result.motion=look?'keyboard look':'idle';report.samples.push(result);console.log(JSON.stringify({label,motion:result.motion,fps:result.fps,frameGap:result.frameGap,draws:result.renderer.render.calls,triangles:result.renderer.render.triangles,objects:result.objects.all,longTasks:result.longTasks.length}));save();
}
async function lifecycle(label){
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await page.evaluate(()=>BurbzPlayerHome.diagnostics().frames);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>BurbzPlayerHome.diagnostics().frames),paused);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(n=>BurbzPlayerHome.diagnostics().frames>n,paused);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});const hidden=await page.evaluate(()=>BurbzPlayerHome.diagnostics().frames);await page.waitForTimeout(350);assert.equal(await page.evaluate(()=>BurbzPlayerHome.diagnostics().frames),hidden);await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await page.waitForFunction(n=>BurbzPlayerHome.diagnostics().frames>n,hidden);
 const disposal=await page.evaluate(()=>{const s=__homesteadPerfRef(),r=s.renderer,geometries=new Set(),materials=new Set(),textures=new Set();s.view.scene.traverse(o=>{if(o.geometry)geometries.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});const record={expected:{geometries:geometries.size,materials:materials.size,textures:textures.size},disposed:{geometries:0,materials:0,textures:0}};for(const [name,set] of Object.entries({geometries,materials,textures}))for(const resource of set)resource.addEventListener('dispose',()=>record.disposed[name]++);BurbzPlayerHome.close('performance-dispose');record.remainingCanvas=!!r.domElement.isConnected;record.homeOpen=BurbzPlayerHome.isOpen();record.memoryAfter={...r.info.memory};return record;});
 assert.equal(disposal.remainingCanvas,false);assert.equal(disposal.homeOpen,false);for(const key of ['geometries','materials','textures'])assert(disposal.disposed[key]>=disposal.expected[key],label+' disposes '+key);report.lifecycle.push({label,blurPaused:true,hiddenPaused:true,resumed:true,disposal});pass(label+' pauses hidden/blurred rendering and disposes its scene/renderer',disposal);
}
(async()=>{
 await new Promise(r=>server.listen(port,'127.0.0.1',r));browser=await chromium.launch({headless:true,executablePath:'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',args:['--no-sandbox','--use-angle=swiftshader']});
 context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block'});
 await context.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort('blockedbyclient'));
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{if(/INVALID_OPERATION|INVALID_VALUE|shader error|WebGL context lost/i.test(m.text()))report.glErrors.push(m.text());});
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');await page.emulateMedia({reducedMotion:'reduce'});report.build=await run('BURBZ_BUILD');
 for(const full of [false,true])for(const appearance of ['normal','comic']){
  await fixture(full);await run(`gameState.settings.appearance='${appearance}';BurbzAppearanceCore.apply('${appearance}',document);`);const prefix=(full?'full':'simple')+'-'+appearance;
  await touch('#playerHomeStand');await settled();
  for(const mode of ['room','yard','overview']){
   if(mode!=='room'){await touch('.ph-top [data-ph="back"]');await settled();}assert.equal(await page.evaluate(()=>BurbzPlayerHome.diagnostics().mode),mode);
   await page.screenshot({path:path.join(out,prefix+'-'+mode+'.png')});await sample(prefix+'-'+mode,false);if(mode!=='overview')await sample(prefix+'-'+mode,true);
  }
  await lifecycle(prefix);
 }
 if(!baseline){
  await fixture(true);await run(`const C=BurbzPlayerHomeCore;let h=C.initial(true);h.tier=2;for(const room of ['library','conservatory','workshop']){const q=C.propose(h,{branches:5000},{kind:'build-room',room});if(!q.ok)throw Error(q.error);h=q.home;}for(const id of Object.keys(C.ITEMS))h.owned[id]=100;const items=Object.keys(C.ITEMS);for(const area of ['room','library','conservatory']){let count=0;const coords=[];for(let x=-4;x<=4;x+=.5)for(let z=-4.5;z<=4.5;z+=.5)coords.push({x,z});coords.sort((a,b)=>Math.hypot(b.x,b.z)-Math.hypot(a.x,a.z));for(const pos of coords){if(count>=32)break;for(let i=0;i<items.length;i++){const item=items[(count+i)%items.length],q=C.propose(h,{branches:5000},{kind:'place',item,area,...pos,turn:count%4});if(q.ok){h=q.home;count++;break;}}}}if(h.placed.length!==96)throw Error('Stress fixture has '+h.placed.length+' placements');gameState.playerHome=h;saveState();renderScanHome();`);
  report.fixtures.maximum=await run('({placed:gameState.playerHome.placed.length,rooms:gameState.playerHome.rooms,byArea:gameState.playerHome.placed.reduce((a,p)=>(a[p.area]=(a[p.area]||0)+1,a),{})})');await run("gameState.settings.appearance='normal';BurbzAppearanceCore.apply('normal',document);");await touch('#playerHomeStand');await settled();
  for(const room of ['room','library','conservatory','workshop']){if(room!=='room'){await touch('[data-ph="menu"]');await touch('[data-ph="rooms"]');await touch('[data-ph="enter-room"][data-room="'+room+'"]');await settled();}await page.screenshot({path:path.join(out,'maximum-'+room+'.png')});await sample('maximum-96-'+room,false);}
  await lifecycle('maximum-96-rooms');
 }
 for(const [file,digest] of Object.entries(report.hashes))assert.equal(hash(fs.readFileSync(path.join(root,file))),digest,file+' stayed unchanged during measurements');assert.deepEqual(report.errors,[]);report.complete=true;pass('Full saved-world and simple-save performance/lifecycle protocol completed');
})().catch(async error=>{report.failure=error.stack;console.error(error);if(page)await page.screenshot({path:path.join(out,'failure.png')}).catch(()=>{});process.exitCode=1;}).finally(async()=>{save();if(browser)await browser.close();server.close();});
