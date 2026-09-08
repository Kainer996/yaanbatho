const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base=process.env.QA_URL||'http://127.0.0.1:8871',out=process.env.EVIDENCE_DIR||'/tmp/burbz-village-discoveries';fs.mkdirSync(out,{recursive:true});
const fixture=require('./village_walk_fixture_20260907.cjs');
(async()=>{const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader']});const errors=[],results=[];
try{const context=await browser.newContext({viewport:{width:1280,height:800},serviceWorkers:'block'});await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());await context.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:fixture}));
const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
await page.goto(base+'/burbz/',{waitUntil:'domcontentloaded'});await page.waitForTimeout(1400);
await page.evaluate(()=>{Element.prototype.requestFullscreen=()=>Promise.reject(Error('test viewport'));});
await run(()=>{if(merlinTutActive)endMerlinTutorial(false);const empire=ensureEmpireState();empire.villages={};const rec={seed:101,name:'Alder Hollow',lat:51.5,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};empire.villages['101']=rec;const eco=ensureVillageEconomy(rec);eco.buildings={cabin:3,well:2,cottages:2,hut:1};eco.population=12;eco.ruins=[];eco.constructions=[];saveState();openEmpireVillage(101);});
await page.locator('#villageStage canvas').waitFor();
const open=async()=>{await page.locator('#villageWalkBtn').click();await page.waitForFunction(()=>window.__burbzVillageWalkDebug?.state().ready||window.__burbzVillageWalkDebug?.state().failed,null,{timeout:60000});assert.equal(await page.evaluate(()=>__burbzVillageWalkDebug.state().failed),false);};
const state=()=>page.evaluate(()=>__burbzVillageWalkDebug.state());
const closePanel=async()=>{if(await page.locator('.vd-panel').isVisible())await page.locator('.vd-close').click();};
const approach=async(kind,id)=>{await closePanel();const result=await page.evaluate(({kind,id})=>{const d=__burbzVillageWalkDebug,s=d.state(),world=d.world(),obj=kind==='resident'?s.discoveries.residents.find(o=>world.allowed(o.x,o.z)):s.discoveries.objects.find(o=>o.kind===kind&&(id===undefined||o.id===id));if(!obj)return false;for(const rad of [0,.6,1,1.6])for(let i=0;i<32;i++){const x=obj.x+Math.cos(i/32*Math.PI*2)*rad,z=obj.z+Math.sin(i/32*Math.PI*2)*rad;if(world.allowed(x,z)&&d.place({x,z,yaw:Math.atan2(x-obj.x,z-obj.z),pitch:-.15}))return true;}return false;},{kind,id});assert(result,'safe approach '+kind+':'+id);await page.waitForTimeout(650);};
await open();console.log('Discovery view ready');
// Set up a clear path, then move through real keyboard controls (not test teleport).
const startMove=await page.evaluate(()=>{const d=__burbzVillageWalkDebug,w=d.world();for(const o of d.state().discoveries.objects){let clear=true;for(let i=0;i<=12;i++)if(!w.allowed(o.x+i*.1,o.z))clear=false;if(clear){d.place({x:o.x,z:o.z,yaw:0,pitch:0});return{x:o.x,z:o.z};}}throw Error('No clear movement fixture');});
await page.keyboard.down('KeyD');await page.waitForFunction(p=>Math.hypot(__burbzVillageWalkDebug.state().player.x-p.x,__burbzVillageWalkDebug.state().player.z-p.z)>.65,startMove,{timeout:20000});await page.keyboard.up('KeyD');

await page.screenshot({path:path.join(out,'desktop-discoveries.png')});
// Greet an actual saved Peep, then accept the village's single request.
await approach('resident');await page.waitForFunction(()=>__burbzVillageWalkDebug.state().discoveries.nearest?.kind==='resident');await page.locator('.vd-interact').click();await page.getByRole('button',{name:'I’ll help',exact:true}).click();assert((await run(()=>gameState.villageDiscoveries.villages['101'])).accepted);
await page.keyboard.press('Escape');assert(await page.locator('#villageWalk').count());assert(!await page.locator('.vd-panel').isVisible(),'Escape closes journal first');
let rec=await run(()=>gameState.villageDiscoveries.villages['101']);const questId=rec.questId;assert(rec.giver&&rec.giver!=='The village folk','actual resident is the quest giver');
const steps=await page.evaluate(()=>BurbzVillageDiscoveryCore.quest(__testEval('gameState.villageDiscoveries.villages["101"]')).steps.length);
for(let i=0;i<steps;i++){await approach('step',i);await page.locator('.vd-interact').click();assert.equal((await run(()=>gameState.villageDiscoveries.villages['101'])).step,i+1);}
await closePanel();await page.locator('.vw-exit').click();await open();assert.equal((await run(()=>gameState.villageDiscoveries.villages['101'])).step,steps,'reentry keeps steps');
await approach('board');await page.locator('.vd-interact').click();const before=await run(()=>gameState.player.coins);await page.getByRole('button',{name:'Finish quest',exact:true}).click();assert.equal(await run(()=>gameState.player.coins),before+30);
await approach('board');await page.locator('.vd-interact').click();assert.equal(await page.getByRole('button',{name:'Finish quest',exact:true}).count(),0);
rec=await run(()=>gameState.villageDiscoveries.villages['101']);
for(const l of rec.loot){await approach('loot',l.id);await page.locator('.vd-interact').click();assert((await run(()=>gameState.villageDiscoveries.villages['101'])).collected.includes(l.id));}
for(const id of rec.lore){await approach('lore',id);await page.locator('.vd-interact').click();assert((await run(()=>gameState.villageDiscoveries.villages['101'])).read.includes(id));}
await closePanel();await page.locator('.vd-journal').click();assert((await page.locator('.vd-body').innerText()).includes('Completed'));await page.screenshot({path:path.join(out,'desktop-completed-journal.png')});
results.push({test:'resident quest, all steps, reentry, finish once, every loot and lore',questId,record:await run(()=>gameState.villageDiscoveries.villages['101'])});
// Persisted save is authoritative, including the completed reward claim.
const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('burbz_state')));assert(saved.villageDiscoveries.villages['101'].completed);assert.equal(saved.villageDiscoveries.villages['101'].collected.length,rec.loot.length);
// Actual page reload, using normal init and retained storage rather than a reseeded fixture.
const reloadHtml=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8').replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();');await context.unroute(base+'/burbz/');await context.route(base+'/burbz/',r=>r.fulfill({contentType:'text/html',body:reloadHtml}));await page.reload({waitUntil:'domcontentloaded'});await page.waitForTimeout(1300);await run(()=>openEmpireVillage(101));await open();assert.equal((await run(()=>gameState.villageDiscoveries.villages['101'])).questId,questId);assert.equal((await state()).discoveries.objects.filter(o=>o.kind==='loot'&&o.visible).length,0);
// Narrow portrait and landscape journal layouts, real touch scrolling.
const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
for(const viewport of [{width:390,height:844},{width:844,height:390},{width:320,height:568}]){await page.setViewportSize(viewport);await page.locator('.vd-journal').click();await page.waitForTimeout(400);const box=await page.locator('.vd-panel').boundingBox();assert(box.x>=0&&box.x+box.width<=viewport.width);assert(box.y>=0&&box.y+box.height<=viewport.height);if(viewport.height===390){
 const scrollBefore=await page.locator('.vd-panel').evaluate(el=>el.scrollTop);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-50,id:1}]});
 for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:box.x+box.width/2,y:box.y+box.height-50-i*25,id:1}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await page.waitForTimeout(300);
 assert(await page.locator('.vd-panel').evaluate(el=>el.scrollTop)>scrollBefore,'touch scrolls landscape journal');
}
await page.screenshot({path:path.join(out,'journal-'+viewport.width+'.png')});await closePanel();}
// Empty village still has one posted request, no invented residents, reachable objects.
await page.locator('.vw-exit').click();await run(()=>{const rec={seed:909,name:'Quiet Clearing',lat:51.51,lon:-.13,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString()};ensureEmpireState().villages['909']=rec;const eco=ensureVillageEconomy(rec);eco.buildings={};eco.population=0;eco.ruins=[];eco.constructions=[];openEmpireVillage(909);});await open();assert.equal((await state()).discoveries.residents.length,0);assert.notEqual((await state()).discoveries.questId,questId);await approach('board');await page.locator('.vd-interact').click();await page.getByRole('button',{name:'I’ll help',exact:true}).click();assert.equal((await run(()=>gameState.villageDiscoveries.villages['909'])).giver,'The village folk');
await closePanel();const memory=[];for(let i=0;i<3;i++){memory.push((await state()).memory);await page.locator('.vw-exit').click();await open();}assert((await state()).memory.geometries<=memory[0].geometries+2);assert((await state()).memory.textures<=memory[0].textures+2);
// Blur clears held controls; context failure remains escapable and restores the canvas.
await page.keyboard.down('KeyW');await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=(await state()).frames;await page.waitForTimeout(400);assert.equal((await state()).frames,paused);await page.keyboard.up('KeyW');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
await run(()=>villageRenderer.domElement.dispatchEvent(new Event('webglcontextlost',{cancelable:true})));assert((await state()).failed);await page.locator('.vw-error button').click();assert(await page.locator('#villageStage canvas').count());
assert.deepEqual(errors,[]);results.push({test:'reload, mobile layouts, empty village, bounded resources',memory});await context.close();
}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,errors},null,2));await browser.close();}
console.log('PASS',JSON.stringify(results));})().catch(e=>{console.error(e);process.exitCode=1;});
