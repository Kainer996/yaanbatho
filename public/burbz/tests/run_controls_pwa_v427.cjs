'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium}=require('/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-controls-pwa-v427',build='walk-shelter-controls-v427-20260920';
const files=['walking_quest_ui.js','walking_quest_ui.css','player_home.js','player_home.css','flight_craft.js','flight_craft_core.js','village_world.js','first_person_hud.css','village_walk.js'];
const report={checks:[],errors:[],limits:'Public installed worker and real offline UI in a disposable Chromium profile. Phone-sized laptop viewport; no physical phone certification or photo requests.'};fs.mkdirSync(out,{recursive:true});let browser,page;
const pass=s=>{report.checks.push(s);console.log('PASS',s);};
(async()=>{try{
 browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,permissions:['geolocation'],geolocation:{latitude:54.45,longitude:-2.65,accuracy:10}});
 page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));context.on('console',m=>{if(m.type()==='warning'||m.type()==='error'){(report.console||=[]).push(m.text());console.log('BROWSER',m.text().slice(0,350));}});context.on('requestfailed',r=>{const row={url:r.url(),failure:r.failure()};(report.failedRequests||=[]).push(row);console.log('REQUEST FAILED',JSON.stringify(row));});
 await page.goto('https://yaanbatho.com/burbz/',{waitUntil:'domcontentloaded',timeout:90000});
 await page.locator('#introSkipBtn').click();await page.locator('#merlinTutorialOverlay.show').waitFor();
 let cacheName;
 for(let attempt=0;attempt<240;attempt++){
  const state=await page.evaluate(async build=>{const keys=await caches.keys(),key=keys.find(k=>k.endsWith(build)),reg=await navigator.serviceWorker.getRegistration();return {key,controller:navigator.serviceWorker.controller?.scriptURL,active:reg?.active?.state,installing:reg?.installing?.state,waiting:reg?.waiting?.state,index:key?!!await(await caches.open(key)).match(new URL('index.html',location.href)):false};},build);
  report.installation=state;
  if(state.controller&&state.active==='activated'&&state.index){cacheName=state.key;break;}
  if(attempt%30===0)console.log('INSTALL',JSON.stringify(state).slice(-250));
  await page.waitForTimeout(1000);
 }
 assert(cacheName,'Public worker did not complete installation: '+JSON.stringify(report.installation));report.cache=cacheName;
 for(const rel of ['index.html',...files.map(f=>f+'?v='+build)]){
  const hash=await page.evaluate(async({cacheName,rel})=>{const response=await(await caches.open(cacheName)).match(new URL(rel,location.href));if(!response)throw Error('Missing exact cache entry '+rel);const bytes=await response.arrayBuffer();return [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(v=>v.toString(16).padStart(2,'0')).join('');},{cacheName,rel});
  assert.equal(hash,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,rel.split('?')[0]))).digest('hex'));(report.hashes||={})[rel]=hash;
 }
 pass('Actual public worker installed the tested document and all 9 changed modules at exact pinned URLs');
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('burbz_state')));
 await context.setOffline(true);await page.reload({waitUntil:'domcontentloaded'});await page.locator('#merlinTutorialOverlay.show').waitFor();
 const after=await page.evaluate(()=>JSON.parse(localStorage.getItem('burbz_state')));for(const key of ['playerHome','inventory','player'])assert.deepEqual(after[key],saved[key]);
 await page.locator('#tutorialNavigationPause').click();await page.locator('[data-game-route][data-screen="map"]:visible').first().click();await page.waitForFunction(()=>document.querySelector('#mapQuestShowBtn')?.dataset.wired==='1',null,{timeout:90000});await page.locator('#mapQuestShowBtn').click();await page.locator('#walkQuestSheet.open.is-walk-picker').waitFor();
 assert.equal(await page.locator('#walkQuestSheet').getAttribute('aria-modal'),'false');await page.locator('#walkQuestRetry').waitFor({state:'visible'});
 assert.match(await page.locator('#walkQuestSheetStatus').innerText(),/offline|location|connection/i);assert.equal(await page.locator('[data-quest-offer]').count(),0);
 await page.screenshot({path:path.join(out,'public-offline-picker.png')});await page.locator('#walkQuestSheet .quest-overlay-close').click();
 pass('Installed app starts offline with the same save and opens/closes the compact picker with truthful location/offline recovery');
 assert.deepEqual(report.errors,[]);report.complete=true;
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();}})();
