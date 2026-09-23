'use strict';
// Exact-byte localhost installed upgrade. Only the separate SW-blocked seed page is instrumented.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),cp=require('node:child_process'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/opt/oauth-station/node_modules/playwright');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),F=require('./connected_world_fixture_v386.cjs');
const out=process.env.EVIDENCE_DIR||'/root/.hermes/task-progress/burbz-home-ground-intro/release-pwa';
const live=process.env.BURBZ_ASSET_ROOT||fs.readFileSync('/etc/burbz-webroot','utf8').trim();
const build='home-ground-intro-v451-20260923',oldBuild='tavern-hall-open-v450-20260923';
const modules=['player_home.css','player_home_core.js','player_home_scene.js','player_home.js','alderwing_intro.js','village_world_core.js','village_world.js','village_walk.js','merlin_story_scenes.js','merlin_story_scenes.css'];
const art=['assets/dashboard-banners/your-empire.webp','assets/dashboard-banners/open-camera.webp','assets/special-birds/rook-witch-scene.webp','assets/walking-quests/warden.webp','assets/walking-quests/wayfarer-rest.webp','assets/home-v395/living-field-desk.webp'];
const changed=['index.html','sw.js',...modules],snapshots={old:{},new:{}},unchanged=new Map();
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
fs.mkdirSync(out+'/baseline',{recursive:true});
const R={started:new Date().toISOString(),complete:false,checks:[],errors:[],missing:[],assetFallback:{},hashes:{},served:{},saves:[],scope:'Loopback Chromium, genuine worker installation/update/offline restart, exact unmodified candidate bytes. Synthetic saves only. No production writes, paid APIs, physical-phone or full-suite claim.'};
R.base=cp.execFileSync('git',['-C',repo,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
for(const name of changed){
 snapshots.new[name]=fs.readFileSync(root+'/'+name);
 if(!name.startsWith('merlin_story_scenes.')){
  snapshots.old[name]=cp.execFileSync('git',['-C',repo,'show',R.base+':public/burbz/'+name],{maxBuffer:20*1024*1024});
  fs.writeFileSync(out+'/baseline/'+name,snapshots.old[name]);
 }
 R.hashes[name]={old:snapshots.old[name]?sha(snapshots.old[name]):null,new:sha(snapshots.new[name])};
}
const deps=[...snapshots.new['player_home.js'].toString().matchAll(/\['((?:building_rooms_core|building_rooms_scene|village_walk_core)\.js)','[^']+','([^']+)'\]/g)].map(m=>m[1]+'?v='+m[2]);
assert.equal(deps.length,3);R.dependencies=deps;
let version='seed',fault=false,stallOnly=null,browser,context,page,server;
const pending=new Set(),sockets=new Set();
function save(){fs.writeFileSync(out+'/results.json',JSON.stringify(R,null,2));}
function pass(name,data={}){R.checks.push({name,...data});save();console.log('PASS',name);}
function bytesFor(name){
 if(changed.includes(name)){const b=snapshots[version==='old'?'old':'new'][name];if(!b)throw Error('not in baseline: '+name);return b;}
 if(unchanged.has(name))return unchanged.get(name);
 const file=path.resolve(root,name);assert(file.startsWith(root+'/'));
 let bytes;
 try{bytes=fs.readFileSync(file);}catch{bytes=cp.execFileSync('git',['-C',repo,'show',R.base+':public/burbz/'+name],{maxBuffer:50*1024*1024,stdio:['ignore','pipe','pipe']});}
 if(bytes.subarray(0,90).toString().startsWith('version https://git-lfs.github.com/spec/')){
  const expected=/oid sha256:([a-f0-9]+)/.exec(bytes.toString())[1];
  bytes=fs.readFileSync(path.join(live,name));assert.equal(sha(bytes),expected,'read-only asset fallback identity '+name);
  R.assetFallback[name]={sha256:expected,bytes:bytes.length};
 }
 unchanged.set(name,bytes);return bytes;
}
function release(){for(const res of pending)res.destroy();pending.clear();}
const seed=F.SEED+`\n{const f=JSON.parse(localStorage.getItem('burbz_state'));f.playerHome.anchor={lat:54.45,lon:-2.65,revision:1,source:'chosen'};f.playerHome.arrival='done';f.tutorialFlow={...f.tutorialFlow,discoveryReviewed:true,companionMet:true,openingCareDone:true};f.homeCacheProof='synthetic-v451-preservation';localStorage.setItem('burbz_state',JSON.stringify(f));}`;
async function state(label){const raw=await page.evaluate(()=>localStorage.getItem('burbz_state'));const value=JSON.parse(raw);R.saves.push({label,sha256:sha(raw),state:value});return value;}
// Ambient care is measured, not called byte-identical. Every other save field is compared.
function stable(value){const s=structuredClone(value);for(const k of ['hunger','lastCareAt','lastHungerAt','thingsSaid','chatterIndex','tipIndex'])delete s.merlinCare[k];return s;}
async function ready(){await page.locator('#playerHomeStand').waitFor({state:'visible',timeout:60000});}
async function shot(name){const file=out+'/'+name+'.png';await page.screenshot({path:file});return file;}
async function cacheProof(marker,names){return page.evaluate(async({marker,names})=>{
 const key=(await caches.keys()).find(k=>k.endsWith(marker));if(!key)return null;const c=await caches.open(key),hashes={};
 for(const name of names){const r=await c.match(new URL(name,location.href));if(!r)return null;hashes[name]=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await r.arrayBuffer()))].map(n=>n.toString(16).padStart(2,'0')).join('');}
 return {key,hashes,controller:navigator.serviceWorker.controller?.scriptURL,count:(await c.keys()).length};
},{marker,names});}
async function eventually(fn,label,timeout=150000){const until=Date.now()+timeout;while(Date.now()<until){if(await fn())return;await page.waitForTimeout(300);}throw Error('Timed out: '+label);}
async function liveHome(label){
 const beforeRequests=(R.stalled||[]).length,t=Date.now();await page.locator('#playerHomeStand').click();
 await page.waitForFunction(()=>{const d=window.BurbzPlayerHome?.diagnostics();return d&&d.frames>3&&!d.failed&&!d.busy;},null,{timeout:22000});
 const before=await page.evaluate(()=>BurbzPlayerHome.diagnostics());await page.keyboard.down('KeyS');await page.waitForTimeout(900);await page.keyboard.up('KeyS');const after=await page.evaluate(()=>BurbzPlayerHome.diagnostics());
 assert(after.frames>before.frames);assert(Math.hypot(after.player.x-before.player.x,after.player.z-before.player.z)>.1);assert(!after.failed);
 assert.equal((R.stalled||[]).length,beforeRequests,'exact cached Home dependencies never hit stalled origin');
 pass(label,{elapsedMs:Date.now()-t,before,after,screenshot:await shot(label)});
 await page.locator('[data-ph="menu"]').click();await page.locator('.ph-panel [data-ph="command"]').click();await page.locator('#playerHome').waitFor({state:'detached'});await ready();
}
async function offlineNewGameMedia(){
 await page.locator('#settingsBtn').click();const reset=page.waitForEvent('dialog').then(async d=>{assert.match(d.message(),/brand-new game/);await d.accept();});await page.locator('#startNewGameBtn').click({noWaitAfter:true});await reset;
 await page.locator('#introCutsceneOverlay.show').waitFor();
 const sample=()=>page.locator('#introCutsceneVideo').evaluate(v=>({time:v.currentTime,ready:v.readyState,error:v.error?{code:v.error.code,message:v.error.message}:null}));
 await page.waitForFunction(()=>{const v=document.querySelector('#introCutsceneVideo');return v.currentTime>.2||v.error;},null,{timeout:20000});
 const media={first:await sample()};
 if(media.first.error){await page.getByRole('button',{name:'Retry trailer',exact:true}).click();await page.waitForTimeout(3000);media.afterNativeRetry=await sample();}
 media.playbackAdvanced=(await sample()).time>.2;return media;
}
(async()=>{const bound=setTimeout(()=>{R.failure='Harness exceeded 8-minute bound';save();process.exit(2);},480000);try{
 server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://localhost'),name=decodeURIComponent(u.pathname).replace(/^\/burbz\//,'')||'index.html';
  if(!u.pathname.startsWith('/burbz/')||name.includes('..')||!['GET','HEAD'].includes(req.method)){res.writeHead(403);return res.end();}
  if(name.startsWith('api/')){res.writeHead(404);return res.end();}
  if(fault&&/^(building_rooms_core|building_rooms_scene|village_walk_core)\.js$/.test(name)&&(!stallOnly||name===stallOnly)){
   (R.stalled||=[]).push({version,url:req.url});pending.add(res);res.on('close',()=>pending.delete(res));return;
  }
  try{
   let bytes=bytesFor(name);if(version==='seed'&&name==='index.html')bytes=Buffer.from(bytes.toString().replace('\ninit();',F.HOOK+'\n'+seed+'\ninit();'));
   if(changed.includes(name))R.served[version+':'+name]=sha(bytes);
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.jpg':'image/jpeg','.svg':'image/svg+xml','.mp3':'audio/mpeg','.ogg':'audio/ogg','.woff2':'font/woff2','.mp4':'video/mp4'};
   res.setHeader('Content-Type',mime[path.extname(name)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
   const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');if(range){const start=+range[1],end=range[2]?Math.min(+range[2],bytes.length-1):bytes.length-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});return res.end(bytes.subarray(start,end+1));}
   res.end(bytes);
  }catch(e){R.missing.push({version,name,error:e.message});res.writeHead(404);res.end();}
 });
 server.on('connection',s=>{sockets.add(s);s.on('close',()=>sockets.delete(s));});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const url='http://localhost:'+server.address().port+'/burbz/';R.url=url;
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/root/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome',args:['--no-sandbox','--enable-unsafe-swiftshader','--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1']});R.browserVersion=browser.version();
 const boot=await browser.newContext({serviceWorkers:'block'}),p=await boot.newPage();await p.goto(url,{waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');
 const storage=await p.evaluate(()=>({...localStorage}));fs.writeFileSync(out+'/synthetic-storage.json',JSON.stringify(storage,null,2));await boot.close();version='old';pass('Synthetic completed save generated separately with worker blocked');
 context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'allow'});
 await context.addInitScript(({storage,origin})=>{if(location.origin===origin&&!localStorage.getItem('release-proof-seeded')){for(const[k,v]of Object.entries(storage))localStorage.setItem(k,v);localStorage.setItem('release-proof-seeded','1');}},{storage,origin:new URL(url).origin});
 page=await context.newPage();page.setDefaultTimeout(45000);page.on('pageerror',e=>R.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await ready();await page.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:150000});await page.reload({waitUntil:'domcontentloaded'});await ready();
 const baselineNames=['index.html',...deps];R.baseline=await cacheProof(oldBuild,baselineNames);assert(R.baseline?.controller);assert.equal(R.baseline.hashes['index.html'],R.hashes['index.html'].old);for(const d of deps)assert.equal(R.baseline.hashes[d],sha(bytesFor(d.split('?')[0])));
 const initial=await state('baseline-reopened');pass('Immutable HEAD baseline installed and reopened under its controller; exact cached document/dependencies');
 fault=true;stallOnly='building_rooms_scene.js';await liveHome('baseline-repaired-stall-home');assert.deepEqual(stable(await state('baseline-home-return')),stable(initial));fault=false;stallOnly=null;release();
 if(process.env.BASELINE_MEDIA_PROBE==='1'){
  await eventually(async()=>!!await cacheProof(oldBuild,['assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4']),'baseline movie cached');
  await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await ready();await liveHome('baseline-offline-home-before-media');R.baselineMedia=await offlineNewGameMedia();R.probeOnly=true;R.complete=true;pass('Baseline-only offline New Game media diagnostic',R.baselineMedia);return;
 }
 version='new';let navigations=0;page.on('framenavigated',f=>{if(f===page.mainFrame())navigations++;});await page.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
 await page.waitForFunction(build=>[...document.scripts].some(s=>s.src.endsWith('player_home.js?v='+build)),build,{timeout:150000});await ready();
 const names=['index.html',...modules.map(n=>n+'?v='+build),...deps,...art,'assets/cutscenes/burbz-intro-two-part-hf-20260729.mp4'];
 await eventually(async()=>{R.candidate=await cacheProof(build,names);return R.candidate?.controller;},'candidate cache');
 for(const name of names)assert.equal(R.candidate.hashes[name],sha(bytesFor(name.split('?')[0])),name+' cached exact candidate bytes');
 assert(navigations>0);assert.deepEqual(stable(await state('candidate-takeover')),stable(initial));assert.equal(await page.locator('.merlin-story-scene').count(),0);pass('Native old-to-new takeover/reload; exact candidate HTML, ten modules, three dependencies and six art URLs',{navigations});
 fault=true;await liveHome('candidate-all-dependencies-stalled-home');assert.deepEqual(stable(await state('candidate-home-return')),stable(initial));
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await ready();await liveHome('offline-restarted-home');assert.deepEqual(stable(await state('offline-home-return')),stable(initial));pass('Offline restart, advancing renderer, native movement and command return preserve completed save');
 // Offline New Game is explicitly confined to this disposable context, never an owner profile.
 R.offlineArt=await page.evaluate(async names=>Promise.all(names.map(src=>new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>resolve({src,width:i.naturalWidth,height:i.naturalHeight});i.onerror=()=>reject(Error('Offline art failed: '+src));i.src=src;}))),art);assert.equal(R.offlineArt.length,art.length);
 R.offlineNewGameMedia=await offlineNewGameMedia();await page.locator('#introSkipBtn').click();
 const keys=['earth','multiverse','alderwing','birds','spellbound','you','app','freedom','later','tour','hub'];R.story=[];
 for(const key of keys){
  await page.locator('.merlin-story-scene[data-scene="'+key+'"]').waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.merlin-story-scene img')].every(i=>i.complete&&i.naturalWidth>0));
  R.story.push({key,images:await page.locator('.merlin-story-scene img').evaluateAll(a=>a.map(i=>({src:i.getAttribute('src'),width:i.naturalWidth}))) });
  if(key==='spellbound'){
   const before=await page.evaluate(()=>JSON.parse(localStorage.getItem('burbzTutorialState:merlin-interactive-flow-v7-20260728')));
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('.merlin-story-scene[data-scene="spellbound"]').waitFor();const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('burbzTutorialState:merlin-interactive-flow-v7-20260728')));R.storyReload=structuredClone({before,after});assert(Date.parse(after.updatedAt)>=Date.parse(before.updatedAt));delete before.updatedAt;delete after.updatedAt;assert.deepEqual(after,before);
   await shot('offline-story-spellbound');
  }
  if(key!=='hub')await page.locator('#merlinTutorialNext').click();
 }
 pass('Native offline New Game/Skip; all eleven illustrations decode, saved middle scene survives offline restart (movie playback recorded separately)');
 await page.locator('#merlinTutorialNext').click();await page.locator('#merlinTutorialOverlay.free.show').waitFor();assert.equal(await page.locator('.merlin-story-scene').count(),0);await shot('offline-story-handoff');
 // Validate measured ambient transitions with the unchanged companion core.
 const core=require('../merlin_companion_core.js');
 for(let i=1;i<R.saves.length;i++){
  const a=R.saves[i-1].state.merlinCare,b=R.saves[i].state.merlinCare;let care=a;
  for(let j=0;j<b.thingsSaid-a.thingsSaid;j++)care=core.nextMerlinUtterance(care).state;
  for(const k of ['thingsSaid','chatterIndex','tipIndex'])assert.equal(b[k],care[k],'canonical ambient transition '+k);
  const tick=core.tickMerlinCare(a,0,b.lastHungerAt);assert(Math.abs(b.hunger-tick.hunger)<1e-9,'unchanged core hunger clock');assert(b.lastHungerAt>=a.lastHungerAt);assert(b.lastCareAt>=a.lastCareAt);
 }
 R.careDeltas=R.saves.map(s=>({label:s.label,...Object.fromEntries(['hunger','lastCareAt','lastHungerAt','thingsSaid','chatterIndex','tipIndex'].map(k=>[k,s.state.merlinCare[k]]))}));
 for(const name of changed)assert.equal(sha(fs.readFileSync(root+'/'+name)),R.hashes[name].new,'candidate unchanged since freeze');
 assert.deepEqual(R.errors,[]);assert.deepEqual(R.missing,[]);R.complete=true;pass('Exact source bytes unchanged, all non-care save fields equal, measured canonical care/chatter, no uncaught errors or missing static files');
}catch(e){R.failure=e.stack;console.error(e);process.exitCode=1;try{R.failureBody=await page?.locator('body').innerText();if(page){R.video=await page.locator('#introCutsceneVideo').evaluate(v=>({src:v.currentSrc,error:v.error?{code:v.error.code,message:v.error.message}:null,ready:v.readyState,time:v.currentTime,network:v.networkState}));await shot('failure');}}catch{}}
finally{clearTimeout(bound);R.finished=new Date().toISOString();save();await browser?.close();release();for(const s of sockets)s.destroy();if(server)await new Promise(r=>server.close(r));}
})();
