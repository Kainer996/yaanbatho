'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'),F=require('./connected_world_fixture_v386.cjs');
const live=process.env.BURBZ_URL,root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR;fs.mkdirSync(out,{recursive:true});
const report={served:{},missing:[],errors:[],checks:[],requests:[],warnings:[]},fixture=F.createServer({root,port:Number(process.env.WORLD_PORT||8925),report});
const recorded=fs.readFileSync(process.env.QUEST_OSM_FIXTURE),check=name=>{report.checks.push(name);console.log('PASS',name);};
let browser,page,mode=process.argv.includes('--real')?'live':'partial';
const run=code=>page.evaluate(code=>__testEval(code),code);
(async()=>{try{
 if(!live)await fixture.listen();browser=await chromium.launch({headless:true,executablePath:'/usr/bin/chromium',args:['--no-sandbox','--enable-gpu']});
 const context=await browser.newContext({viewport:process.argv.includes('--desktop')?{width:1280,height:800}:{width:390,height:844},hasTouch:!process.argv.includes('--desktop'),serviceWorkers:'block',geolocation:{latitude:54.45,longitude:-2.65,accuracy:10},permissions:['geolocation']});
 await F.routeMap(context,report);
 if(!live)await context.route('**/burbz/**',async route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/burbz\//,'');if(!/^(assets|bird-art-cache|icons|lib)\//.test(rel)||rel.includes('..'))return route.fallback();const local=path.join(root,rel);if(fs.existsSync(local)&&fs.statSync(local).size>200)return route.fallback();const cached=[process.env.HUD_ASSET_CACHE,process.env.SUPPLEMENTAL_ASSET_CACHE,process.env.ASSET_CACHE,'/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/cards-prerequisites-v417/public/burbz','/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/companion-release-v363/public/burbz','/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/v362-update-http-cache/burbz'].filter(Boolean).map(p=>path.join(p,rel)).find(p=>fs.existsSync(p)&&fs.statSync(p).size>200);return cached?route.fulfill({path:cached}):route.fallback();});
 await context.route('**/api/interpreter',async route=>{const req=route.request(),query=new URLSearchParams(req.postData()||'').get('data')||'';if(!query.includes('relation(bw.paths)'))return route.abort('blockedbyclient');report.requests.push({url:req.url(),mode});if(mode==='live')return route.continue();if(mode==='fail')return route.abort('internetdisconnected');const partial=mode==='partial'&&req.url().includes('maps.mail.ru');return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:partial?JSON.stringify({elements:[],remark:'runtime error: Query ran out of memory'}):mode==='empty'?' {"elements":[]}':recorded});});
 if(live)await context.route(new URL(live).origin+'/**',async route=>{if(route.request().resourceType()!=='document')return route.continue();const response=await route.fetch(),html=await response.text();assert.equal(F.sha(Buffer.from(html)),F.sha(fs.readFileSync(path.join(root,'index.html'))));report.publicHTMLSHA=F.sha(Buffer.from(html));return route.fulfill({response,body:html.replace('\ninit();',F.HOOK+'\n'+F.SEED+'\ninit();')});});
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.stack));page.on('console',m=>{if(m.type()==='warning'&&/quest/i.test(m.text()))report.warnings.push(m.text());});
 await page.goto(live||fixture.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan',null,{timeout:45000});
 if(process.argv.includes('--new')){await run('gameState=JSON.parse(JSON.stringify(DEFAULT_STATE));gameState.player.name="Rowan";gameState.settings={music:false,sfx:false,vibration:false,appearance:"normal"};saveState();');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');}
 await run('if(merlinTutActive)endMerlinTutorial(false);switchScreen("map");');await page.locator('#mapQuestShowBtn').waitFor({state:'visible'});await page.waitForFunction(()=>__testEval('liveMapHasPrecisePosition&&!!liveMapLastPosition'),null,{timeout:30000});
 const authority=await run('JSON.stringify({inventory:gameState.inventory,coins:gameState.player.coins,quests:gameState.walkingQuests})');
 await page.locator('#mapQuestShowBtn').click();assert(await page.locator('#walkQuestSheet.open .quest-board-panel').isVisible());check('Actual Show quests immediately opens the quest system');
 await page.locator('[data-quest-offer]').first().waitFor({state:'visible',timeout:40000});const offers=await run('questOverview.offers');assert(offers.length>0);assert(offers.every(o=>o.routeEvidence?.ways.length));report.offerCount=offers.length;assert(await run('questOverview.markers.length===questOverview.offers.length'));await page.screenshot({path:path.join(out,'quest-board.png')});check('Complete real OSM evidence loads actual route cards and map markers');
 report.layout=[];
 for(const size of [{width:390,height:844},{width:320,height:568},{width:844,height:390},{width:1280,height:800}]){
  await page.setViewportSize(size);await page.waitForTimeout(1300);
  const dims=await page.evaluate(()=>{const box=s=>{const r=document.querySelector(s).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};const sheet=box('#walkQuestSheet .quest-board-panel'),map=box('#liveMapShell');return{sheet,map,card:box('[data-quest-offer]'),close:box('#walkQuestSheet .quest-overlay-close'),modal:document.querySelector('#walkQuestSheet').getAttribute('aria-modal')};});const markers=await page.evaluate(()=>[...document.querySelectorAll('.wq-offer-pin')].map(e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,visible:getComputedStyle(e).visibility!=='hidden',hit:!!document.elementFromPoint(r.x+r.width/2,r.y+r.height*.7)?.closest('.wq-offer-pin')};}));
  report.layout.push({size,...dims,markers});
  if(!process.env.EXPECT_LARGE){assert(markers.every(m=>m.visible&&m.x>=dims.map.x&&m.y>=dims.map.y&&m.x+m.w<=dims.map.right&&m.y+m.h<=dims.map.bottom),'Marker outside map '+JSON.stringify(markers));assert(markers.every(m=>m.x+m.w<=dims.sheet.x||m.x>=dims.sheet.right||m.y+m.h<=dims.sheet.y||m.y>=dims.sheet.bottom),'Marker behind picker');assert(markers.some(m=>m.hit),'No clickable walk marker');}await page.screenshot({path:path.join(out,'picker-'+size.width+'.png')});
  if(!process.env.EXPECT_LARGE){assert(dims.sheet.w*dims.sheet.h/(dims.map.w*dims.map.h)<=.48,JSON.stringify(dims));assert(dims.card.h>=44&&dims.card.h<=118,JSON.stringify(dims));assert(dims.close.w>=44&&dims.close.h>=44);assert.equal(dims.modal,'false');}
  if(!process.env.EXPECT_LARGE){
   await page.waitForFunction(()=>!__testEval('liveMap.isMoving()'));
   const scroll=page.locator('.wq-picker-scroll'),before=await scroll.evaluate(e=>({top:e.scrollTop,page:window.scrollY}));
   await scroll.hover();await page.mouse.wheel(0,240);await page.waitForTimeout(200);
   assert((await scroll.evaluate(e=>e.scrollTop))>before.top);assert.equal(await page.evaluate(()=>window.scrollY),before.page);
   await scroll.evaluate(e=>e.scrollTop=0);
   const point=dims.sheet.y>dims.map.y+20?{x:dims.map.x+dims.map.w*.35,y:dims.map.y+dims.map.h*.3}:{x:dims.sheet.right+70,y:dims.map.y+dims.map.h*.6};
   assert(await page.evaluate(p=>!!document.elementFromPoint(p.x,p.y)?.closest('#liveMapShell'),point),'Map hit target blocked');
   const camera=await run('liveMap.getCenter().toArray()');
   await page.mouse.move(point.x,point.y);await page.mouse.down();await page.mouse.move(point.x+40,point.y-20,{steps:8});await page.mouse.up();await page.waitForTimeout(250);
   assert.notDeepEqual(await run('liveMap.getCenter().toArray()'),camera,'Map drag must work while list is open');
   assert(await page.locator('#walkQuestSheet.open').isVisible());
  }

 }
 if(process.env.EXPECT_LARGE){report.complete=true;return;}
 check('Independent inner scrolling and real map dragging work in all four viewports');
 await page.setViewportSize({width:390,height:844});
 await page.waitForTimeout(1400);
 const touchPoint=await page.evaluate(()=>{for(const e of document.querySelectorAll('.wq-offer-pin')){const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height*.75;if(document.elementFromPoint(x,y)?.closest('.wq-offer-pin')===e)return{x,y};}});
 assert(touchPoint);await page.touchscreen.tap(touchPoint.x,touchPoint.y);await page.locator('#mapQuestFocusCard.show').waitFor();
 await run('closeQuestMapFocus();');await page.locator('#mapQuestShowBtn').click();await page.waitForTimeout(1300);
 const cdp=await context.newCDPSession(page),centre=await run('liveMap.getCenter().toArray()');
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:1,x:180,y:300}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:1,x:220,y:320}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(250);
 assert.notDeepEqual(await run('liveMap.getCenter().toArray()'),centre);
 await page.locator('.maplibregl-canvas').focus();await page.keyboard.press('Escape');assert.equal(await page.locator('#walkQuestSheet.open').count(),0);
 await page.locator('#mapQuestShowBtn').click();await page.locator('[data-quest-offer]').first().waitFor();
 check('A visible walk marker opens its real brief by touch; exposed-map touch pans, and Escape closes the nonmodal picker');

 if(mode==='partial'){assert(report.requests.some(x=>x.url.includes('overpass-api.de')));assert(report.warnings.some(x=>x.includes('Incomplete mapped paths')));check('Incomplete HTTP 200 primary response recovers through secondary provider');}
 await page.locator('[data-quest-offer="0"]').click();assert(await page.locator('#mapQuestFocusCard.show').isVisible());await page.locator('#mapQuestFocusDetails').click();assert(await page.locator('#wqNetworkBegin').isVisible());assert.equal(await page.locator('#walkQuestSheet').getAttribute('aria-modal'),'true');assert.equal(await page.locator('#walkQuestSheet').evaluate(e=>e.classList.contains('is-walk-picker')),false);assert(await page.locator('#wqNetworkMap').isVisible());await page.screenshot({path:path.join(out,'quest-details.png')});await page.locator('#walkQuestSheet .quest-overlay-close').click();check('Loaded walk opens its real map brief, story and Begin/View route controls');
 await run('closeQuestMapFocus();');await page.locator('#mapQuestShowBtn').click();const requests=report.requests.length;await page.waitForTimeout(300);assert.equal(report.requests.length,requests);await page.locator('#walkQuestSheet .quest-overlay-close').click();await context.setOffline(true);await page.locator('#mapQuestShowBtn').click();assert(await page.locator('[data-quest-offer]').count()>0);assert((await page.locator('#walkQuestSheetStatus').innerText()).includes('Offline'));await page.locator('#walkQuestSheet .quest-overlay-close').click();check('Recent same-area walks remain available offline, explicitly labelled');
 await run('questOverview.fetchedAt=0;');mode='fail';await page.locator('#mapQuestShowBtn').click();await page.locator('#walkQuestRetry').waitFor({state:'visible'});assert.equal(await page.locator('[data-quest-offer]').count(),0);assert((await page.locator('#walkQuestSheetStatus').innerText()).includes('offline'));await page.screenshot({path:path.join(out,'quest-offline.png')});check('Offline uncached discovery shows an honest error and usable Retry');
 await context.setOffline(false);mode='partial';await page.locator('#walkQuestRetry').click();await page.locator('[data-quest-offer]').first().waitFor({state:'visible'});check('Retry reconnects and loads real mapped walks');
 // A result arriving after the user leaves the board cannot overwrite another sheet.
 await page.locator('#walkQuestSheet .quest-overlay-close').click();await run('questOverview.fetchedAt=0;');mode='empty';await page.locator('#mapQuestShowBtn').click();await page.locator('#walkQuestRetry').waitFor({state:'visible'});assert((await page.locator('#walkQuestSheetStatus').innerText()).includes('No useful connected walk'));assert.equal(await page.locator('[data-quest-offer]').count(),0);check('Complete empty network is distinct from failure, with Side Quest and Retry');
 await page.locator('#walkQuestSheet .quest-overlay-close').click();assert.equal(await run('JSON.stringify({inventory:gameState.inventory,coins:gameState.player.coins,quests:gameState.walkingQuests})'),authority);check('Browsing, failure and retry preserve inventory, currency and quest progress');
 mode='good';await page.locator('#mapQuestShowBtn').click();await page.locator('[data-quest-offer]').first().waitFor();
 await page.locator('[data-game-route][data-screen="scan"]:visible').first().click();assert.equal(await page.locator('#walkQuestSheet.open').count(),0);
 await run('switchScreen("map")');check('Leaving the map through the dock dismisses the picker and its observers');
 for(const size of [{width:667,height:375},{width:320,height:740},{width:1280,height:800}]){await page.setViewportSize(size);mode='good';await page.locator('#mapQuestShowBtn').click();await page.locator('[data-quest-offer]').first().waitFor({state:'visible'});const close=await page.locator('#walkQuestSheet .quest-overlay-close').boundingBox();assert(close.x>=0&&close.y>=0&&close.x+close.width<=size.width&&close.y+close.height<=size.height);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:path.join(out,'quest-'+size.width+'x'+size.height+'.png')});await page.locator('#walkQuestSheet .quest-overlay-close').click();}check('Phone portrait/landscape and desktop quest panels stay usable');
 // Save a real selected walk through the existing Begin handler, then reload.
 await page.locator('#mapQuestShowBtn').click();await page.locator('[data-quest-offer="0"]').click();await page.locator('#mapQuestFocusDetails').click();await page.locator('#wqNetworkBegin').click();await page.waitForFunction(()=>__testEval('!!activeWalkingQuest()'));const saved=await run('JSON.stringify(activeWalkingQuest())');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');await run('if(merlinTutActive)endMerlinTutorial(false);switchScreen("map");');await page.locator('#mapQuestShowBtn').click();assert(await page.locator('#walkQuestSheet.open').isVisible());assert.equal(await run('activeWalkingQuest().id'),JSON.parse(saved).id);assert.deepEqual(await run('activeWalkingQuest().route'),JSON.parse(saved).route);check('An existing saved quest reopens its journal with the same route after reload');
 assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'failure.png')});report.body=await page.locator('body').innerText();}catch{}}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();if(!live)fixture.server.close();}
})();
