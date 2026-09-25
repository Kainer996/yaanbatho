/* Browser proof for Home as the hub (v491). Real game page in Chromium with a
 * disposable save: every box opens its own screen, and every box fits on
 * phones held both ways. Viewport emulation, not a physical-phone claim.
 * Run: EVIDENCE_DIR=/tmp/v491 PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node tests/run_home_hub_v491.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-home-hub-v491';fs.mkdirSync(out,{recursive:true});
const report={served:{},missing:[],checks:[],errors:[],limits:['Chromium viewport emulation with a disposable save; no physical-phone claim.']};
const server=F.createServer({root,port:Number(process.env.PORT||8987),report,seed:F.SEED});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),pass=(name,detail)=>{report.checks.push({name,detail});console.log('PASS',name);};
// Seven villages, three towns and one county; the Kitchen, Training Hall and
// Hospital built; one drill done, one running in the Library; one bird hurt.
const SAVE=`(()=>{const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.regionCharters=[];e.mergeChartersVersion=1;for(let i=0;i<16;i++){const v=e.villages[8100+i]={seed:8100+i,name:'Willow '+i,lat:54.45+i*.001,lon:-2.65,claimedAt:'2026-09-14T11:00:00Z',lastTributeAt:Date.now()};const eco=ensureVillageEconomy(v);eco.population=16;eco.happiness=1;eco.buildings={cabin:4,well:1};}for(let i=0;i<9;i+=3)e.townCharters.push({seeds:[8100+i,8101+i,8102+i],mergedAt:'2026-09-14T13:00:00Z'});e.regionCharters=[{seeds:empireSettlementsInfo().towns.map(t=>t.heartSeed),mergedAt:'2026-09-14T14:00:00Z'}];
 gameState.academyBuildings={outdoors:{built:true},kitchen:{built:true},training:{built:true},hospital:{built:true},library:{built:true},tavern:{built:true}};
 gameState.flock=['Blue Tit','Great Tit','Robin','Rook'].map((n,i)=>{const b=createBirdEntry(n,'',.99);b.id='hub'+i;return b;});gameState.flock[2].hp=Math.round((gameState.flock[2].maxHp||40)*.4);
 const now=Date.now();gameState.birdTrainingSessions=[{id:'t1',birdId:'hub0',birdName:'Blue Tit',label:'Wing sprints',room:'training',status:'complete',startMs:now-3600e3,endMs:now-60e3,progressPct:100},{id:'t2',birdId:'hub1',birdName:'Great Tit',label:'Study',room:'library',status:'active',startMs:now-600e3,endMs:now+840e3,progressPct:40}];
 featureGateMap={map:true,quests:true,academy:true,inventory:true,forge:true,kitchen:true,training:true,hospital:true,village:true,battle:true,birdex:true};saveState();switchScreen('scan');renderScanHome();})()`;
const home=async()=>{await run(`closeTrainingHub?.(false);document.querySelectorAll('dialog[open]').forEach(d=>d.close());switchScreen('scan');renderScanHome();`);await page.waitForFunction(()=>__testEval("currentScreen")==='scan'&&document.querySelector('#screen-scan .desk-empire-open'));await page.waitForTimeout(250);};
const state=()=>run(`({screen:currentScreen,room:typeof academyInteriorRoom!=='undefined'?academyInteriorRoom:null,page:empirePageName,forgeTab:typeof forgeActiveTab!=='undefined'?forgeActiveTab:null,hub:!!document.getElementById('trainingHubModal')?.classList.contains('show')})`);
async function tap(selector,at=.5){await home();const box=await page.locator(selector).first().boundingBox();assert(box,'visible '+selector);await page.mouse.click(box.x+box.width/2,box.y+box.height*at);await page.waitForTimeout(500);return state();}
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});await F.routeMap(context,report);
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');
 await run(`if(merlinTutActive)endMerlinTutorial(false);`);await run(SAVE);await page.waitForTimeout(600);

 // The eight asks: each box opens its own screen. Taps land on the box's
 // summary line, not its title, to prove the whole box is the button.
 const routes={};
 // The Academy shows its tree; tap the roots, below every house.
 routes.academy=await tap('#screen-scan .desk-panel-academy .home-tree',.97);assert.equal(routes.academy.screen,'academy');
 routes.crafting=await tap('#screen-scan .desk-panel-stores .desk-panel-summary');assert.equal(routes.crafting.screen,'forge');
 routes.kitchen=await tap('#screen-scan .desk-panel-kitchen .desk-panel-summary');assert.deepEqual([routes.kitchen.screen,routes.kitchen.room],['academy-room','kitchen']);
 routes.training=await tap('#screen-scan .desk-panel-training .desk-panel-summary');assert.deepEqual([routes.training.screen,routes.training.room,routes.training.hub],['academy-room','training',false]);
 routes.hospital=await tap('#screen-scan .desk-panel-hospital .desk-panel-summary');assert.deepEqual([routes.hospital.screen,routes.hospital.room],['academy-room','hospital']);
 routes.villages=await tap('#screen-scan [data-home-action="column-villages"]');assert.deepEqual([routes.villages.screen,routes.villages.page],['village','villages']);
 routes.towns=await tap('#screen-scan [data-home-action="column-towns"]');assert.deepEqual([routes.towns.screen,routes.towns.page],['village','towns']);
 routes.regions=await tap('#screen-scan [data-home-action="column-regions"]');assert.deepEqual([routes.regions.screen,routes.regions.page],['village','realm']);
 // The page scrolls smoothly to the Counties list under the map.
 await page.waitForFunction(()=>document.getElementById('empireRealmPanel').getBoundingClientRect().top<innerHeight*.6,null,{timeout:5000}).catch(()=>{});const counties=await page.evaluate(()=>{const r=document.getElementById('empireRealmPanel').getBoundingClientRect();return{top:r.top,bottom:r.bottom,vh:innerHeight};});assert(counties.top<counties.vh*.6,'counties list in view '+JSON.stringify(counties));
 await page.screenshot({path:path.join(out,'regions.png')});
 pass('Academy, Crafting, Kitchen, Training, Hospital, Villages, Towns and Regions each open their own screen',routes);
 // Empty space in a column opens that column's page; a tile still opens its own holding.
 await home();const colBox=await page.locator('#screen-scan .desk-empire-column').nth(1).boundingBox(),tileBox=await page.locator('#screen-scan .desk-empire-column').nth(1).locator('.desk-empire-holding').first().boundingBox();
 await page.mouse.click(colBox.x+colBox.width/2,colBox.y+colBox.height-3);await page.waitForTimeout(400);const columnTap=await state();assert.deepEqual([columnTap.screen,columnTap.page],['village','towns']);
 await home();await page.mouse.click(tileBox.x+tileBox.width/2,tileBox.y+tileBox.height/2);await page.waitForTimeout(500);const tileTap=await state();assert.equal(tileTap.screen,'town');
 pass('Column space opens the page; a tile still opens its own town',{columnTap,tileTap});
 // A drill in the Library opens the Library.
 await home();const libraryRoute=await run(`(()=>{const b=document.querySelector('#desk-training-list [data-home-action="train-t2"]');if(!b)return null;b.click();return {screen:currentScreen,room:academyInteriorRoom};})()`);
 assert.deepEqual(libraryRoute,{screen:'academy-room',room:'library'});pass('A running drill opens the room it runs in',libraryRoute);

 // The gold edge: a finished drill and a hurt bird want the player; Crafting does not.
 await home();const edges=await page.evaluate(()=>Object.fromEntries(['stores','kitchen','training','hospital'].map(id=>[id,document.querySelector('#screen-scan .desk-panel-'+id).dataset.homeAttention])));
 assert.equal(edges.training,'true');assert.equal(edges.hospital,'true');assert.equal(edges.stores,'false');
 const columns=await page.locator('#screen-scan .desk-empire-open').allTextContents();assert.deepEqual(columns.map(t=>t.replace('›','').trim()),['Villages7','Towns3','Regions1']);
 pass('Boxes that want the player wear a gold edge; column titles show their counts',{edges,columns});

 // Every box fits, whole, on phones held both ways.
 const sizes=[[390,844],[360,740],[360,640],[412,915],[844,390],[740,360],[915,412],[1280,800]],fits=[];
 for(const [w,h] of sizes){await page.setViewportSize({width:w,height:h});await home();await page.waitForTimeout(400);
  const f=await page.evaluate(()=>{const main=document.querySelector('.scan-home-main'),rect=s=>document.querySelector(s).getBoundingClientRect(),vh=innerHeight,ids=['.desk-panel-building','.scan-home-start','.scan-home-today','.desk-panel-stores','.desk-panel-kitchen','.desk-panel-training','.desk-panel-hospital','.desk-panel-academy'];
   const boxes=ids.map(s=>{const r=rect(s);return{s,top:Math.round(r.top),bottom:Math.round(r.bottom),w:Math.round(r.width),h:Math.round(r.height)};});
   const col=document.querySelector('.desk-empire-holdings').getBoundingClientRect(),tile=document.querySelector('.desk-empire-holding').getBoundingClientRect(),dock=document.getElementById('bottomDock').getBoundingClientRect();
   const floor=dock.top>vh/2&&dock.width>dock.height?dock.top:vh;
   return{layout:main.dataset.homeLayout,scroll:main.scrollHeight-main.clientHeight,boxes,floor:Math.round(floor),tile:{top:Math.round(tile.top),bottom:Math.round(tile.bottom),w:Math.round(tile.width),h:Math.round(tile.height)},col:{top:Math.round(col.top),bottom:Math.round(col.bottom)}};});
  f.size=[w,h];fits.push(f);await page.screenshot({path:path.join(out,`home-${w}x${h}.png`)});
  assert(f.scroll<=2,'no hidden overflow '+JSON.stringify(f));
  for(const b of f.boxes){assert(b.h>=30&&b.w>=60,'box too small '+JSON.stringify(b));assert(b.bottom<=f.floor+1,'box cut off '+JSON.stringify({size:f.size,b,floor:f.floor}));}
  assert(f.tile.h>=44&&f.tile.bottom<=f.col.bottom+1,'first Empire tile is whole '+JSON.stringify(f));
  if(w>h&&h<=550)assert.equal(f.layout,'short-landscape');
 }
 pass('Every Home box is whole and on screen at eight phone and laptop sizes',fits.map(f=>({size:f.size,layout:f.layout,tile:f.tile.h})));
 assert.equal(report.errors.length,0,report.errors.join('\n'));report.complete=true;
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
