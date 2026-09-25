'use strict';
// Photo Merlin v487 in the real page: a camera photo carries the rough place,
// ranked bird cards appear beside the photo, and only This is my bird adds one.
// Recognition answers are controlled HTTP responses, not a model accuracy test.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || '/opt/node22/lib/node_modules/playwright');
const F=require('./connected_world_fixture_v386.cjs'),root=path.resolve(__dirname,'..');
const out=process.env.EVIDENCE_DIR||'/tmp/burbz-photo-merlin-v487';fs.mkdirSync(out,{recursive:true});
const report={checks:[],errors:[],requests:[],missing:[],served:{},limits:'Real app, cropper and Birdex on a disposable save; controlled recognition answers; Chromium phone emulation, not a physical phone.'};
const server=F.createServer({root,port:9086,report});
const fixture=path.join(root,'tests/fixtures/photo-v350/raven-flight.jpg');
const raven={found:false,accepted:false,verified:false,retryable:false,policy:'photo-gemini-v487',model:'gemini-vision',modelName:'gemini-3.8-flash',
  reason:'pick-your-bird',message:'Bird detected. Pick your bird from the matches.',receiptId:'c'.repeat(64),placeUsed:true,
  candidates:[{species:'Common Raven',scientificName:'Corvus corax',score:.71,local:'likely',plumage:'adult'},
    {species:'Carrion Crow',scientificName:'Corvus corone',score:.2,local:'likely'},
    {species:'Anhinga',scientificName:'Anhinga anhinga',score:.03,local:'unexpected'}]};
let browser,page;const run=code=>page.evaluate(code=>__testEval(code),code),pass=s=>{report.checks.push(s);console.log('PASS',s);};
const field=(body,name)=>{const m=body.toString('latin1').match(new RegExp('name="'+name+'"\\r\\n\\r\\n([^\\r]*)'));return m?m[1]:undefined;};
(async()=>{try{
 await server.listen();
 browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block',
   permissions:['geolocation'],geolocation:{latitude:53.871234,longitude:-2.391234}});
 await context.route('**/*',async route=>{
  const req=route.request(),u=new URL(req.url());
  if(u.pathname==='/burbz/api/identify/image'){
   const body=req.postDataBuffer();
   report.requests.push({contract:field(body,'photoContract'),lat:field(body,'lat'),lon:field(body,'lon'),week:field(body,'photoWeek')});
   return route.fulfill({status:422,json:raven});
  }
  if(!['localhost','127.0.0.1'].includes(u.hostname))return route.abort();
  return route.continue();
 });
 page=await context.newPage();page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');await run('if(merlinTutActive)endMerlinTutorial(false);');
 const before=await run('JSON.stringify({coins:gameState.player.coins,known:Object.keys(gameState.discoveredSpecies||{}).length})');
 const [shot]=await Promise.all([page.waitForEvent('filechooser'),page.locator('#captureBtn').click()]);
 assert.equal(await shot.element().getAttribute('id'),'nativeCameraInput');
 await shot.setFiles(fixture);await page.locator('#birdCropOverlay.show').waitFor();
 await page.locator('#birdCropConfirm').click();
 await page.locator('#birdCropMatches:not([hidden]) .bird-match').nth(2).waitFor();
 const request=report.requests[0];
 assert.equal(request.contract,'merlin-v487');assert.equal(request.lat,'53.87');assert.equal(request.lon,'-2.39');
 assert(Number(request.week)>=1&&Number(request.week)<=48);
 pass('A fresh camera photo carries the contract, a two-decimal place and the BirdNET week');
 const text=await page.locator('#birdCropMatches').innerText();
 assert.match(text,/Raven[\s\S]*Good match[\s\S]*Likely here[\s\S]*Adult/);
 assert.match(text,/Anhinga[\s\S]*Possible match[\s\S]*Not expected here/);
 assert.equal(await page.locator('.bird-match-pick').count(),3);
 assert.equal(await run('JSON.stringify({coins:gameState.player.coins,known:Object.keys(gameState.discoveredSpecies||{}).length})'),before);
 pass('Ranked cards show match strength, local status and plumage; nothing is added yet');
 for(const [name,size,comic] of [['portrait',{width:390,height:844},false],['small',{width:320,height:568},false],['landscape',{width:844,height:390},false],['comic',{width:390,height:844},true]]){
  await page.setViewportSize(size);await page.evaluate(on=>{document.body.classList.toggle('comic-ui',on);if(on)document.documentElement.dataset.appearance='comic';else delete document.documentElement.dataset.appearance;},comic);
  const button=page.locator('.bird-match-pick').first();await button.scrollIntoViewIfNeeded();
  const box=await button.boundingBox();
  assert(box.height>=44&&box.x>=0&&box.x+box.width<=size.width+1&&box.y>=0&&box.y+box.height<=size.height+1,name+' button reachable '+JSON.stringify(box));
  await page.screenshot({path:path.join(out,'matches-'+name+'.png')});
 }
 await page.evaluate(()=>{document.body.classList.remove('comic-ui');delete document.documentElement.dataset.appearance;});await page.setViewportSize({width:390,height:844});
 pass('This is my bird stays reachable and at least 44 px tall in portrait, small phone, landscape and comic');
 await page.locator('.bird-match-pick').first().click();
 await page.locator('#birdCropOverlay.show').waitFor({state:'hidden'});
 await page.waitForFunction(()=>document.querySelector('#scanResult').classList.contains('show'));
 assert.match(await page.locator('#scanResult').innerText(),/Raven/);
 assert.equal(await run("!!getDiscoveredRecordForSpecies(canonicalSpeciesName('Common Raven'))"),true);
 pass('This is my bird adds the raven through the normal discovery flow');
 assert.deepEqual(report.errors,[]);report.complete=true;
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
