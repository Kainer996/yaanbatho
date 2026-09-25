/* Real flight v478 in the actual retained renderer with explicitly synthetic,
 * offline map input. Boards the craft, then flaps, stalls, dives and pulls up
 * with the real controls. Evidence, not a unit test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-real-flight-v478',report={served:{},missing:[],checks:[],samples:{},errors:[],limits:['Actual retained renderer and loader with explicitly synthetic DEM/vector input.','Software WebGL at a phone viewport, not phone hardware.']};
fs.mkdirSync(out,{recursive:true});const server=F.createServer({root,port:8985,report});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),read=()=>page.evaluate(()=>__burbzVillageWalkDebug.state()),pass=name=>{report.checks.push(name);console.log('PASS',name);};
const agl=()=>page.evaluate(()=>{const d=__burbzVillageWalkDebug.state();return d.player.y-__burbzVillageWalkDebug.world().height(d.player.x,d.player.z);});
const height=(x,z)=>120+8*Math.sin(x/70)+6*Math.cos(z/55);
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'});await F.routeMap(c,report,{height});
 page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));await F.nativeClock(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan',null,{timeout:120000});
 await run(`if(merlinTutActive)endMerlinTutorial(false);gameState.playerHome.anchor={lat:54.45,lon:-2.65,revision:1,source:'chosen'};const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.mergeChartersVersion=1;const v=e.villages[101]={seed:101,name:'Alder Hollow',lat:54.45,lon:-2.65,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString()};const eco=ensureVillageEconomy(v);eco.buildings={cabin:1,well:1};eco.population=4;eco.ruins=[];eco.constructions=[];saveState();openEmpireVillage(101);`);
 await page.locator('#villageWalkBtn:not([disabled])').waitFor({timeout:90000});await page.locator('#villageWalkBtn').click();
 await page.waitForFunction(()=>window.__burbzVillageWalkDebug&&(__burbzVillageWalkDebug.state().ready||__burbzVillageWalkDebug.state().failed),null,{timeout:90000});assert(!(await read()).failed);
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.craft?.record,null,{timeout:30000});
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),p=BurbzGeographicWorldCore.project(d.continuity.origin,d.continuity.craft.record);if(!__burbzVillageWalkDebug.place({x:p.x,z:p.z,mode:'walk'}))throw Error('Craft unreachable');});
 await page.locator('.cw-wings').click();await page.getByRole('button',{name:'Take off',exact:true}).click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.mode==='fly');
 assert((await read()).player.wing.beating,'take-off starts a wingbeat');
 // Software WebGL runs well below 60 fps, so wait on game state, not the clock.
 await page.waitForFunction(()=>{const d=__burbzVillageWalkDebug.state();return d.player.wing.mode==='grounded'&&d.player.y-__burbzVillageWalkDebug.world().height(d.player.x,d.player.z)<.6;},null,{timeout:20000});report.samples.settled=await agl();pass('Take-off gives one wingbeat; without flapping the craft settles back down');
 const cdp=await c.newCDPSession(page);
 async function touch(label,down){const b=await page.getByRole('button',{name:label,exact:true}).boundingBox();await cdp.send('Input.dispatchTouchEvent',down?{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:3}]}:{type:'touchEnd',touchPoints:[]});}
 const start=Date.now();await touch('Flap',true);try{await page.waitForFunction(()=>{const d=__burbzVillageWalkDebug.state();return d.player.y-__burbzVillageWalkDebug.world().height(d.player.x,d.player.z)>8;},null,{timeout:15000});}finally{await touch('Flap',false);}
 report.samples.climbSeconds=(Date.now()-start)/1000;pass('Holding Flap climbs clear of the ground in '+report.samples.climbSeconds.toFixed(1)+' s');
 await page.waitForFunction(()=>document.querySelector('button[aria-label="Flap"]')?.dataset.stall==='true',null,{timeout:4000});
 await page.screenshot({path:path.join(out,'stall.png')});report.samples.stall=(await read()).player.wing;pass('Letting go of Flap stalls the craft, and the Flap button lights');
 // Dive: a cruising craft heading down gathers speed with no flapping.
 const cruise=18;
 await page.evaluate(v=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+150,mode:'fly',yaw:0,pitch:-.3,velocity:{x:0,y:0,z:-v}});},cruise);
 const top0=await agl();await page.waitForFunction(v=>__burbzVillageWalkDebug.state().player.wing.airspeed>v+4,cruise,{timeout:30000});const dive=await read();report.samples.dive={airspeed:dive.player.wing.airspeed,drop:top0-await agl(),mode:dive.player.wing.mode};
 assert(dive.player.wing.airspeed>cruise+4,'the dive gathers speed');assert(!dive.player.wing.beating,'no flapping needed');await page.screenshot({path:path.join(out,'dive.png')});
 pass('Heading down gathers speed without flapping: '+cruise+' → '+dive.player.wing.airspeed.toFixed(1)+' m/s');
 // Pull up: height first, then speed bleeds away into a stall.
 await page.evaluate(v=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+150,mode:'fly',yaw:0,pitch:.4,velocity:{x:0,y:0,z:-v}});},cruise);
 const low=await page.evaluate(()=>__burbzVillageWalkDebug.state().player.y);await page.waitForFunction(y=>__burbzVillageWalkDebug.state().player.y>y+3,low,{timeout:20000});const climbed=(await read()).player.y-low;
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.wing.mode==='stalling',null,{timeout:6000});report.samples.pullUp={climbed,stall:(await read()).player.wing};
 pass('Pulling up gains '+climbed.toFixed(1)+' m, then slows into a stall');
 // Powered flight: holding W flaps ahead and holds height at cruise.
 await page.evaluate(v=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+150,mode:'fly',yaw:0,pitch:0,velocity:{x:0,y:0,z:-v}});},cruise);
 const level=await page.evaluate(()=>__burbzVillageWalkDebug.state().player.y);await page.locator('.vw-look').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(3000);await page.keyboard.up('KeyW');
 const powered=await read();report.samples.powered={airspeed:powered.player.wing.airspeed,drift:powered.player.y-level};assert(Math.abs(powered.player.y-level)<3,'powered flight holds its height');assert(powered.player.wing.airspeed>cruise*.85);
 await page.screenshot({path:path.join(out,'cruise.png')});pass('Flapping ahead holds height at '+powered.player.wing.airspeed.toFixed(1)+' m/s');
 assert.deepEqual(report.errors,[]);report.complete=true;await c.close();
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{report.state=await read();await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
