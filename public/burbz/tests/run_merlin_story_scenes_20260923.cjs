'use strict';
// Local, isolated native UI proof; existing live media are read-only LFS originals.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),live=process.env.BURBZ_ASSET_ROOT||fs.readFileSync('/etc/burbz-webroot','utf8').trim();
const out=process.env.EVIDENCE_DIR||'/root/.hermes/task-progress/burbz-home-ground-intro/intro-browser';
fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],assets:{},screenshots:[],limits:'Local candidate, isolated new browser profile, original movie/art bytes, read-only closure inspection hook. Native input only for tutorial actions; synthetic map provider through existing fixture, no paid requests. No service-worker, live delivery or physical-phone claim.'};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
let missingArt=false,browser,page;
const server=http.createServer((req,res)=>{
 try {
  const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname).replace(/^\/burbz\//,'')||'index.html';
  const file=path.resolve(root,rel);if(!file.startsWith(root+'/')||!['GET','HEAD'].includes(req.method)||rel.startsWith('api/')){res.writeHead(403);return res.end();}
  if(missingArt&&/^(assets|bird-art-cache)\//.test(rel)&&/\.(webp|png|svg)$/.test(rel)){res.writeHead(503);return res.end();}
  let bytes=fs.readFileSync(file);
  if(bytes.subarray(0,90).toString().startsWith('version https://git-lfs.github.com/spec/')){
   const expected=bytes.toString().match(/oid sha256:([a-f0-9]+)/)[1];bytes=fs.readFileSync(path.join(live,rel));assert.equal(hash(bytes),expected,rel+' live original matches LFS object');report.assets[rel]={bytes:bytes.length,sha256:expected};
  }
  if(rel==='index.html')bytes=Buffer.from(bytes.toString().replace('\ninit();',F.HOOK+'\ninit();'));
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.mp4':'video/mp4','.mp3':'audio/mpeg','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-store');
  const range=req.headers.range?.match(/^bytes=(\d+)-(\d*)$/);
  if(range){const start=Number(range[1]),end=range[2]?Math.min(Number(range[2]),bytes.length-1):bytes.length-1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});return res.end(bytes.subarray(start,end+1));}
  res.end(bytes);
 }catch(e){res.writeHead(404);res.end();(report.missing||=[]).push(e.message);}
});
const pass=s=>{report.checks.push(s);console.log('PASS',s);};
const run=s=>page.evaluate(s=>window.__testEval(s),s);
async function scene(key){await page.locator(`.merlin-story-scene[data-scene="${key}"]`).waitFor();await page.waitForTimeout(420);}
async function shot(name){if(process.env.STORY_NO_SCREENSHOTS==='1'||(process.env.STORY_SCREENSHOT_FILTER&&!new RegExp(process.env.STORY_SCREENSHOT_FILTER).test(name)))return;const file=path.join(out,name+'.png');await page.screenshot({path:file});report.screenshots.push(file);}
async function layout(name){
 await page.evaluate(()=>document.fonts.ready);
 const result=await page.evaluate(()=>{
  const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};
  const controls=['merlinTutorialBack','merlinTutorialReadingPause','merlinTutorialNext','settingsBtn'].map(id=>{const e=document.getElementById(id),r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {id,...rect(e),hit:e===hit||e.contains(hit),disabled:e.disabled};});
  const t=document.getElementById('merlinTutorialText'),s=document.querySelector('.merlin-story-scene');
  const artBounds=[...s.querySelectorAll('.merlin-story-visual,.merlin-story-label')].filter(e=>e.getClientRects().length).map(e=>({className:e.className,...rect(e)}));
  return {width:innerWidth,height:innerHeight,controls,artBounds,text:{...rect(t),client:t.clientHeight,scroll:t.scrollHeight},scene:rect(s),sceneKey:s.dataset.scene,overflow:document.documentElement.scrollWidth>innerWidth};
 });
 assert(!result.overflow,name+' horizontal overflow');assert(result.scene.h>=100,name+' helpful visible scene');
 for(const c of result.controls){assert(c.x>=0&&c.y>=0&&c.x+c.w<=result.width+1&&c.y+c.h<=result.height+1,name+' clipped '+c.id);assert(c.w>=44&&c.h>=44,name+' touch target '+c.id);assert(c.disabled||c.hit,name+' occluded '+c.id);}
 assert(result.text.scroll<=result.text.client+1,name+' dialogue clipped');
 for(const r of result.artBounds)assert(r.y>=result.scene.y&&r.y+r.h<=result.scene.y+result.scene.h+1,name+' clipped illustration '+r.className);
 (report.layouts||=[]).push({name,...result});await shot(name);
}
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const url=`http://localhost:${server.address().port}/burbz/`;report.url=url;
 browser=await chromium.launch({headless:true,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',permissions:['geolocation'],geolocation:{latitude:54.45,longitude:-2.65,accuracy:10}});
 await F.routeMap(context,report);page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#introCutsceneOverlay.show').waitFor();await page.waitForFunction(()=>document.querySelector('#introCutsceneVideo').currentTime>.25);
 await shot('original-trailer');await page.locator('#introSkipBtn').click();await scene('earth');pass('Fresh profile plays original trailer; native Skip opens illustrated Earth greeting');
 const ledger=await run('JSON.stringify({player:gameState.player,inventory:gameState.inventory})');
 const keys=['earth','multiverse','alderwing','birds','spellbound','you','app','freedom','later','tour','hub'];
 for(let i=0;i<keys.length;i++){
  if(i){await page.locator('#merlinTutorialNext').click();await scene(keys[i]);}
  await layout('portrait-'+i+'-'+keys[i]);
  for(const [w,h]of [[320,568],[667,375]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);await layout(`${keys[i]}-${w}x${h}`);}
  await page.setViewportSize({width:390,height:844});await page.waitForTimeout(300);
  if(i===4){
   for(const [w,h]of [[320,568],[844,390],[667,375],[1280,800]]){await page.setViewportSize({width:w,height:h});await page.waitForTimeout(300);await layout(`spellbound-${w}x${h}`);}
   await page.emulateMedia({reducedMotion:'reduce'});await layout('spellbound-reduced-motion');assert.equal(await page.locator('.merlin-tutorial-merlin').evaluate(e=>getComputedStyle(e).animationName),'none');
   await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'no-preference'});
   await page.locator('#merlinTutorialBack').click();await scene('birds');await page.keyboard.press('Enter');await scene('spellbound');pass('Native Back and keyboard Next select the correct matching illustrations');
   const before=await run('JSON.stringify({player:gameState.player,inventory:gameState.inventory,flow:gameState.tutorialFlow})');
   await page.locator('#settingsBtn').click();await page.locator('#settingsModal.show').waitFor();assert.equal(await page.locator('.merlin-story-scene').count(),0);
   await page.locator('#settingsCloseBtn').click();await scene('spellbound');assert.equal(await run('JSON.stringify({player:gameState.player,inventory:gameState.inventory,flow:gameState.tutorialFlow})'),before);pass('Settings removes only story artwork and resumes same beat with unchanged player/inventory/flow');
   await page.reload({waitUntil:'domcontentloaded'});await scene('spellbound');assert.equal(await page.locator('#introCutsceneOverlay').isVisible(),false);pass('Reload resumes exact saved story scene without replaying movie');
   await page.locator('#merlinTutorialReadingPause').click();await page.locator('#merlinTutorialOverlay.show').waitFor({state:'hidden'});assert.equal(await page.locator('.merlin-story-scene').count(),0);
   await page.locator('#bottomDock .nav-item[data-screen="map"]').click();await page.waitForFunction(()=>document.querySelector('#screen-map').classList.contains('active'));assert.equal(await page.locator('.merlin-story-scene').count(),0);
   await page.locator('#bottomDock .nav-item[data-screen="scan"]').click();await page.locator('#scanHomeActions [data-home-action="next-quest"]').click();await scene('spellbound');pass('Native Pause, Map/Home navigation and current-goal resume retain lesson and rebuild its scene');
   await page.locator('#settingsBtn').click();await page.locator('#settingsAppearanceTab').click();await page.locator('input[name="appearanceTheme"][value="comic"]').check();await page.locator('#settingsCloseBtn').click();await scene('spellbound');await layout('comic-spellbound');
   await page.locator('#settingsBtn').click();await page.locator('#settingsAppearanceTab').click();await page.locator('input[name="appearanceTheme"][value="normal"]').check();await page.locator('#settingsCloseBtn').click();await scene('spellbound');pass('Both native Appearance settings retain cream-on-dark story and readable controls');
  }
 }
 assert.equal(await run('JSON.stringify({player:gameState.player,inventory:gameState.inventory})'),ledger);pass('All eleven sequential reading beats reached through native Next without spending or rewards');
 await page.locator('#merlinTutorialNext').click();await page.locator('#merlinTutorialOverlay.free.show').waitFor();assert.equal(await page.locator('.merlin-story-scene').count(),0);assert(!await page.locator('#merlinTutorialOverlay').evaluate(e=>e.classList.contains('merlin-illustrated')));await shot('native-enter-alderwing');
 await page.locator('#playerHomeStand').click();await page.locator('#alderwingIntroGuide').waitFor({timeout:60000});await shot('native-home-handoff');assert.equal(await page.locator('.merlin-story-scene').count(),0);pass('Native Enter Alderwing reaches original Home guide with no illustrated layer left over');
 const handoffPhase=await page.locator('#alderwingIntroGuide').getAttribute('data-phase');await page.locator('#alderwingIntroGuide button').click();await page.waitForFunction(p=>document.querySelector('#alderwingIntroGuide')?.dataset.phase!==p,handoffPhase);assert.equal(await page.locator('.merlin-story-scene').count(),0);await shot('native-home-next');pass('Original shelter Next continues the separately owned hands-on guide');
 // Separate isolated profile: art unavailable and an established completed save.
 const fallback=await browser.newContext({viewport:{width:320,height:568},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});await F.routeMap(fallback,{...report,mapFixture:undefined});page=await fallback.newPage();page.on('pageerror',e=>report.errors.push(e.message));missingArt=true;
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.locator('#introCutsceneOverlay.show').waitFor();await page.locator('#introSkipBtn').click();await scene('earth');await layout('missing-art-earth');for(let i=0;i<4;i++)await page.locator('#merlinTutorialNext').click();await scene('spellbound');await layout('missing-art-spellbound');pass('Missing art retains helpful static diagram/captions and readable 320px controls in reduced motion');
 await page.evaluate(()=>{const key='burbzTutorialState:merlin-interactive-flow-v7-20260728';localStorage.setItem(key,JSON.stringify({status:'completed',mode:'story',stepId:'lesson-12'}));localStorage.setItem('burbzTutorialChapters:merlin-interactive-flow-v7-20260728',JSON.stringify(['story']));});
 await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1800);assert.equal(await page.locator('.merlin-story-scene').count(),0);assert.equal(await page.locator('#introCutsceneOverlay').isVisible(),false);pass('Completed-story synthetic save does not replay opening artwork or movie');
 assert.deepEqual(report.errors,[]);report.complete=true;
}catch(e){report.failure=e.stack;console.error(e);try{await shot('failure');report.state=await run('({step:merlinTutCurrentStep(),screen:currentScreen,saved:readMerlinTutorialState()})');}catch{}process.exitCode=1;
}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.close(r));}})();
