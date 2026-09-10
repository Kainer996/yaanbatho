/* Full app / real catalogue; private player saves are never read. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR;
assert(out,'Set a fresh EVIDENCE_DIR');fs.mkdirSync(out,{recursive:true});
const report={at:new Date().toISOString(),served:{},missing:[],checks:[],errors:[],limitations:['Disposable browser profile and synthetic save only; no private user save was accessed.','Local v387 build; no publication or deployment.']};
const fixture=F.createServer({root,port:Number(process.env.BIRDEX_PORT||8918),report});
let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code);
const save=()=>fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));
const pass=name=>{report.checks.push(name);console.log('PASS',name);save();};
const ready=()=>page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan',null,{timeout:60000});
const authority=()=>run('JSON.stringify({flock:gameState.flock,book:gameState.discoveredSpecies,player:gameState.player,inventory:gameState.inventory,quests:gameState.quests,diary:gameState.diary})');
async function showDiscovered(){await run("if(merlinTutActive)endMerlinTutorial(false); currentFilter='all';currentBirdFamilyFilter='all';switchScreen('birdex');");await page.locator('#burbzModeTabs [data-mode=birdex]').click();await page.locator('#birdexDiscoveryRow [data-discovery=discovered]').click();}
async function checkCount(n){assert.equal(await page.locator('#birdGrid .bird-card').count(),n);assert.equal(await page.locator('#birdexDiscoveryRow [data-discovery=discovered]').innerText(),'Discovered · '+n);assert.equal(await page.locator('.birdex-window-count').innerText(),`Showing ${n} of ${n} species`);}
(async()=>{try{
 await fixture.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});await F.routeMap(context,report);
 await context.route('**/burbz/**',async route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/burbz\//,'');if(!/^(assets|bird-art-cache|icons)\//.test(rel)||rel.includes('..'))return route.fallback();const file=path.join(root,rel);if(fs.existsSync(file)&&fs.statSync(file).size)return route.fallback();if(!process.env.ASSET_CACHE)return route.fallback();const cached=path.join(process.env.ASSET_CACHE,rel);if(!fs.existsSync(cached))return route.fallback();return route.fulfill({path:cached});});
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));await F.nativeClock(page);await page.goto(fixture.url,{waitUntil:'domcontentloaded'});await ready();
 await run("if(merlinTutActive)endMerlinTutorial(false); gameState.flock=[];gameState.discoveredSpecies={};rememberDiscoveredBird(createBirdEntry('Common Greenfinch','Chloris chloris',.96));saveState();");
 const first=await authority();await showDiscovered();await checkCount(1);assert.equal(await authority(),first);assert.match(await page.locator('#birdGrid').innerText(),/Common Greenfinch/);await page.screenshot({path:path.join(out,'greenfinch-one-card.png')});
 pass('Phone Birds → Discovered renders one Common Greenfinch; badge/list counts agree; rendering preserves save authority');
 const economy=await run('JSON.stringify({coins:gameState.player.coins,xp:gameState.player.xp,quests:gameState.quests})');
 for(const name of ['Greenfinch','European Greenfinch','Chloris chloris','Common Greenfinch'])await run(`rememberDiscoveredBird(createBirdEntry(${JSON.stringify(name)},'Chloris chloris',.96));`);
 assert.equal(await run('JSON.stringify({coins:gameState.player.coins,xp:gameState.player.xp,quests:gameState.quests})'),economy);await run('saveState();renderBirdex();');await checkCount(1);
 const book=await run('JSON.stringify(gameState.discoveredSpecies)');await page.reload({waitUntil:'domcontentloaded'});await ready();await showDiscovered();await checkCount(1);assert.equal(await run('JSON.stringify(gameState.discoveredSpecies)'),book);
 pass('Repeated common/scientific/European labels and real page reload retain one card with no extra rewards or quest progress');
 await run("gameState.flock=[{...createBirdEntry('Common Greenfinch'),id:'fixture-green-a',customName:'Fern',xp:77},{...createBirdEntry('Greenfinch'),id:'fixture-green-b',customName:'Moss',xp:99}];saveState();");
 await page.locator('#burbzModeTabs [data-mode=companions]').click();assert.equal(await page.locator('#birdGrid .bird-card').count(),2);assert.match(await page.locator('#birdGrid').innerText(),/Fern/);assert.match(await page.locator('#birdGrid').innerText(),/Moss/);
 const companions=await run('JSON.stringify(gameState.flock)');await page.locator('#burbzModeTabs [data-mode=birdex]').click();await checkCount(1);assert.equal(await run('JSON.stringify(gameState.flock)'),companions);
 pass('Companions keeps both named Greenfinches, IDs and XP; switching to Discovered groups only the species card');
 await run("for(const name of ['Magpie','Australian Magpie','Redpoll','Arctic Redpoll'])rememberDiscoveredBird(createBirdEntry(name));saveState();renderBirdex();");await checkCount(5);
 assert.equal(await run('gameState.flock.length'),2);await page.screenshot({path:path.join(out,'distinct-species.png')});
 pass('European/Australian magpies and Redpoll/Arctic Redpoll remain four separate discoveries alongside Greenfinch');
 await page.locator('#birdexDiscoveryRow [data-discovery=all]').click();assert.equal(await page.locator('#birdGrid .bird-card:not(.undiscovered):not(.locked-card)').count(),5);
 const keys=await run('birdexSpeciesRows().map(r=>birdexSpeciesKey(r.bird))');assert.equal(new Set(keys).size,keys.length);
 await page.locator('#birdexDiscoveryRow [data-discovery=undiscovered]').click();assert.equal(await page.locator('#birdGrid .bird-card:not(.undiscovered):not(.locked-card)').count(),0);
 pass('All and Undiscovered share the same deduplicated catalogue; no known bird becomes a second locked card');
 assert.deepEqual(report.errors,[]);report.complete=true;
 }catch(error){report.failure=error.stack;console.error(error);process.exitCode=1;try{await page.screenshot({path:path.join(out,'failure.png')});}catch(_){} }finally{save();await browser?.close();fixture.server.close();}
})();
