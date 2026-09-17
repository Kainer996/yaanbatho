'use strict';
// Actual card templates/styles, disposable save. The sole HTML instrumentation
// exposes the existing closure to the harness; it never reaches production.
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'/tmp/burbz-desk-cards-v420');
fs.mkdirSync(out,{recursive:true});assert(!fs.existsSync(path.join(out,'results.json')),'Preserve prior evidence');
const live=process.env.BURBZ_URL,old=process.env.EXPECT_OLD==='1',pwa=process.env.TEST_PWA==='1';
const names=['Blue Tit','Great Tit','Long-tailed Tit','Goldcrest','Treecreeper','Great Spotted Woodpecker'];
const slugs=['blue_tit','great_tit','long_tailed_tit','goldcrest','treecreeper','great_spotted_woodpecker'];
const report={mode:live?'public':'local candidate',checks:[],errors:[],sourceSHA:{},limits:['Chromium desktop and phone viewport emulation; no physical-phone claim.','Disposable test save; HTML adds only a closure test hook and deterministic save seed.']};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const pass=(name,data)=>{report.checks.push({name,data});console.log('PASS',name);};
const seed=F.SEED+`\nwindow.__testCardReady=true;`;
const instrument=html=>html.replace('\ninit();',F.HOOK+'\n'+seed+'\ninit();');
const proxyCache=new Map();let server,browser,context,page;
async function serverStart(){
 server=http.createServer(async(req,res)=>{try{
  const pathname=new URL(req.url,'http://localhost').pathname;
  if(pathname.startsWith('/api/')){res.setHeader('Content-Type','application/json');return res.end('{"enabled":false}');}
  const name=decodeURIComponent(pathname).replace(/^\/burbz\//,'')||'index.html',file=path.resolve(root,name);
  if(!file.startsWith(root+'/')){res.writeHead(403);return res.end();}
  let bytes;try{bytes=fs.readFileSync(file);if(bytes.length<300&&bytes.toString().startsWith('version https://git-lfs'))bytes=null;}catch(_){}
  if(!bytes){
   for(const base of (process.env.BURBZ_ASSET_ROOTS||'/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/gemini-offline-v410/work/runtime-assets:/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/companion-release-v363/public/burbz:/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/world-sky-v401/public/burbz:/home/yaan/Documents/Codex/2026-09-06/burbz-visual-polish/work/v362-update-http-cache/burbz').split(':')){const cached=path.resolve(base,name);if(!cached.startsWith(base+'/'))continue;try{const b=fs.readFileSync(cached);if(!(b.length<300&&b.toString().startsWith('version https://git-lfs'))){bytes=b;break;}}catch{}}
  }
  if(!bytes){
   if(!/^(assets|bird-art-cache|icons|lib|vendor)\//.test(name)){res.writeHead(404);return res.end();}
   if(!proxyCache.has(name))proxyCache.set(name,fetch('https://yaanbatho.com/burbz/'+name).then(async r=>{if(!r.ok)throw Error('public asset '+r.status+' '+name);return Buffer.from(await r.arrayBuffer());}));
   bytes=await proxyCache.get(name);
  }
  if(name==='index.html'){report.sourceSHA.index=sha(bytes);bytes=Buffer.from(instrument(bytes.toString()));}
  if(name==='sw.js')report.sourceSHA.worker=sha(bytes);
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.mp4':'video/mp4','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(bytes);
 }catch(e){res.writeHead(502);res.end(String(e));}});
 await new Promise(r=>server.listen(8983,'127.0.0.1',r));return 'http://localhost:8983/burbz/';
}
const run=code=>page.evaluate(code=>__testEval(code),code);

(async()=>{try{
 const url=live||await serverStart();browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});if(live)await context.route('**/burbz/**',async route=>{const req=route.request(),u=new URL(req.url());if(req.resourceType()==='document'&&req.method()==='GET'&&['/burbz/','/burbz/index.html'].includes(u.pathname)){const r=await route.fetch(),b=await r.body();assert.equal(sha(b),sha(fs.readFileSync(path.join(root,'index.html'))));report.sourceSHA.index=sha(b);return route.fulfill({response:r,body:instrument(b.toString())});}return route.continue();});page=await context.newPage();page.setDefaultTimeout(90000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval);await run(`if(merlinTutActive)endMerlinTutorial(false);`);
 await run(`gameState.flock=['Blue Tit','Great Tit','Herring Gull','Rook'].map((name,i)=>{const b=createBirdEntry(name,'',.99);b.id='name-proof-'+i;if(i===0)b.customName='';if(i===1)b.customName='Ada';if(i===3)b.customName='A very long name with <tags> & punctuation “Moon”';return b;});currentBurbzMode='companions';currentFilter='all';currentBirdFamilyFilter='all';switchScreen('birdex');renderBirdex();`);
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1280,height:800}]){
  await page.setViewportSize(size);await page.waitForTimeout(150);
  const facts=await page.locator('#birdGrid [data-owned-bird-card]').evaluateAll(cards=>cards.map(c=>{const row=c.querySelector('.card-name-row'),a=row.querySelector('.card-name').getBoundingClientRect(),n=row.querySelector('.card-nickname'),b=n.getBoundingClientRect();return{height:c.getBoundingClientRect().height,rowHeight:row.getBoundingClientRect().height,title:row.title,aria:c.getAttribute('aria-label'),species:row.querySelector('.card-name').textContent,nickname:n.textContent,sameLine:!n.textContent||Math.abs(a.top-b.top)<2,overflow:c.scrollWidth>c.clientWidth+2};}));
  assert.equal(facts.length,4);assert(facts.every(f=>f.sameLine&&!f.overflow&&f.rowHeight===20),JSON.stringify(facts));assert(Math.max(...facts.map(f=>f.height))-Math.min(...facts.map(f=>f.height))<.5,JSON.stringify(facts));assert(facts.every(f=>f.aria.includes(f.species)&&f.aria.includes(f.nickname)&&f.title.includes(f.nickname)));
  await page.screenshot({path:path.join(out,'cards-'+size.width+'.png')});pass('Mixed named, unnamed, special and long names share one row and equal cards at '+size.width,facts);
 }
 await page.locator('[data-bird-id="name-proof-1"] .card-front [data-action="flip-card"]').click();await page.locator('#birdEquipOverlay.show').waitFor();await run('closeBirdEquip()');pass('Full companion card interaction remains available');
 await run(`(()=>{const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.regionCharters=[];e.mergeChartersVersion=1;for(let i=0;i<16;i++){const v=e.villages[8100+i]={seed:8100+i,name:'Willow '+i,lat:54.45+i*.001,lon:-2.65,claimedAt:'2026-09-14T11:00:00Z',lastTributeAt:Date.now()};const eco=ensureVillageEconomy(v);eco.population=16;eco.happiness=1;eco.buildings={cabin:4,well:1};}for(let i=0;i<9;i+=3)e.townCharters.push({seeds:[8100+i,8101+i,8102+i],mergedAt:'2026-09-14T13:00:00Z'});e.regionCharters=[{seeds:empireSettlementsInfo().towns.map(t=>t.heartSeed),mergedAt:'2026-09-14T14:00:00Z'}];const roles=ensureRolesState();roles.villages['8109']='name-proof-0';gameState.academyBuildings={outdoors:{built:true},kitchen:{built:true},training:{built:true},hospital:{built:true}};gameState.completionNotices=[{id:'desk-proof-finished',kind:'academy-building',title:'Hospital finished',sub:'Your new room',target:{room:'hospital'}}];gameState.inventory.gear.willow_wand=2;featureGateMap={map:true,quests:true,academy:true,inventory:true,kitchen:true,training:true,hospital:true,village:true};switchScreen('scan');renderScanHome();})()`);
 const model=await run('scanHomeDeskSnapshot().empireDesk');assert.equal(model.villages.length,7);assert.equal(model.towns.length,3);assert.equal(model.regions.length,1);pass('Home projects actual signed village, town and region holdings without duplicate town wards',model);
 for(const size of [{width:320,height:568},{width:390,height:844},{width:844,height:390},{width:1280,height:800}]){
  await page.setViewportSize(size);await page.waitForTimeout(250);
  const facts=await page.evaluate(()=>{const main=document.querySelector('.scan-home-main'),empire=document.querySelector('.desk-panel-building'),r=empire.getBoundingClientRect(),cols=[...document.querySelectorAll('.desk-empire-column')].map(el=>{const r=el.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height};});return{cols,main:{h:main.clientHeight,sh:main.scrollHeight,w:main.clientWidth,sw:main.scrollWidth},empire:{x:r.x,y:r.y,w:r.width,h:r.height},bad:document.querySelectorAll('.desk-empire-holding.is-bad').length,good:document.querySelectorAll('.desk-empire-holding.is-good').length};});
  assert.equal(facts.cols.length,3);assert(facts.cols.every(c=>c.w>60&&c.h>=40),JSON.stringify(facts));assert(facts.cols[0].x<facts.cols[1].x&&facts.cols[1].x<facts.cols[2].x);assert(facts.main.sw<=facts.main.w+2&&facts.main.sh<=facts.main.h+2,JSON.stringify(facts));assert(facts.bad>0);await page.screenshot({path:path.join(out,'empire-'+size.width+'.png')});pass('Three simultaneous Empire columns fit without outer scrolling at '+size.width,facts);
 }
 await page.setViewportSize({width:390,height:844});await page.locator('#desk-empire-notices').click();await page.locator('#homeBuildingNotices.show').waitFor();await page.locator('[data-home-action="complete-desk-proof-finished"]').click();await page.waitForFunction(()=>__testEval('currentScreen')==='academy');assert.equal(await run("gameState.completionNotices.some(n=>n.id==='desk-proof-finished')"),false);pass('Completed building opens its actual destination and acknowledges the notice');
 await run("switchScreen('scan');renderScanHome()");await page.locator('[data-home-action="holding-villages-8109"]').click();await page.waitForFunction(()=>__testEval('villageActive?.seed')===8109);pass('Village tile opens its actual management view');
 await run("switchScreen('scan');renderScanHome()");const town=model.towns[0];await page.locator('[data-home-action="holding-towns-'+town.id+'"]').click();await page.waitForFunction(id=>__testEval('townActiveId')===id,town.id);pass('Town tile opens its actual management view');
 await run("switchScreen('scan');renderScanHome()");const region=model.regions[0];await page.locator('[data-home-action="holding-regions-'+region.id+'"]').click();await page.waitForFunction(id=>__testEval('regionHallActiveId')===id,region.id);pass('Region tile opens its actual county hall');
 await run("switchScreen('scan');renderScanHome()");const list=page.locator('#desk-empire-villages + .desk-empire-holdings');await list.hover();await page.mouse.wheel(0,600);await page.waitForTimeout(150);assert(await list.evaluate(el=>el.scrollTop>0));pass('Village column scrolls independently');
 await run(`gameState.empire.villages={};gameState.empire.townCharters=[];gameState.empire.regionCharters=[];renderScanHome();`);assert.equal(await page.locator('.desk-empire-holding').count(),0);assert.equal(await page.locator('.desk-empire-column .desk-empty').count(),3);pass('Empty holdings produce honest empty columns');
 assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(e){report.failure=e.stack;console.error(e);try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}process.exitCode=1;}
 finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server?.closeAllConnections();server?.close();}
})();
