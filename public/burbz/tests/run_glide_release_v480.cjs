/* Glide on release v480 in the actual retained renderer with explicitly
 * synthetic, offline map input. Boards the craft, flaps, lets go and glides,
 * dives and pulls up with the real controls, and checks the one Flap button
 * sits by the right thumb. Evidence, not a unit test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-glide-release-v480',report={served:{},missing:[],checks:[],samples:{},errors:[],limits:['Actual retained renderer and loader with explicitly synthetic DEM/vector input.','Software WebGL at a phone viewport, not phone hardware.']};
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
 // Hover in open air, then let go: the wings go still, and the craft drops
 // its nose, finds flying speed and glides down without a stall.
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+80,mode:'fly',velocity:{x:0,y:0,z:0}});});
 await touch('Flap',true);try{await page.waitForFunction(()=>{const p=__burbzVillageWalkDebug.state().player;return p.wing.mode==='hovering'&&p.wing.airspeed<3;},null,{timeout:20000});}finally{await touch('Flap',false);}
 const hover=(await read()).player.wing.airspeed;await page.waitForFunction(()=>!__burbzVillageWalkDebug.state().player.wing.beating,null,{timeout:4000});
 const released=await agl(),glow=await page.evaluate(()=>new Promise(done=>{let lit=false,most=0;const t0=performance.now();(function watch(){const d=__burbzVillageWalkDebug.state();lit=lit||document.querySelector('button[aria-label="Flap"]')?.dataset.stall==='true';most=Math.max(most,d.player.wing.stall);if(performance.now()-t0<20000&&d.player.wing.airspeed<15&&d.player.wing.mode!=='grounded')requestAnimationFrame(watch);else done({lit,most,airspeed:d.player.wing.airspeed,mode:d.player.wing.mode,beating:d.player.wing.beating});})();}));
 report.samples.release={...glow,hover,from:released,to:await agl()};assert(!glow.lit&&glow.most<.2,'letting go never stalls');assert(!glow.beating,'the wings stay still');assert(glow.airspeed>=15&&glow.mode==='gliding','the craft finds flying speed and glides');assert(report.samples.release.to<released,'the craft loses height');
 await page.screenshot({path:path.join(out,'release.png')});pass('Letting go of a hover stills the wings and glides on at '+glow.airspeed.toFixed(1)+' m/s after '+(released-report.samples.release.to).toFixed(1)+' m, with no stall');
 // A long glide at cruise with a level look: steady speed, gentle sink.
 const cruise=18;
 await page.evaluate(v=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+150,mode:'fly',yaw:0,pitch:0,velocity:{x:0,y:0,z:-v}});},cruise);
 const g0=await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state();return {y:d.player.y,x:d.player.x,z:d.player.z};});await page.waitForFunction(g=>{const p=__burbzVillageWalkDebug.state().player;return Math.hypot(p.x-g.x,p.z-g.z)>120;},g0,{timeout:60000});
 const g1=(await read()).player,flown=Math.hypot(g1.x-g0.x,g1.z-g0.z),drop=g0.y-g1.y;report.samples.glide={airspeed:g1.wing.airspeed,flown,drop,ratio:flown/drop,mode:g1.wing.mode};
 assert.equal(g1.wing.mode,'gliding');assert(!g1.wing.beating);assert(Math.abs(g1.wing.airspeed-cruise)<cruise*.1,'glide holds cruise speed');assert(flown/drop>6&&flown/drop<10,'about 8:1');
 await page.screenshot({path:path.join(out,'glide.png')});pass('Still wings glide at '+g1.wing.airspeed.toFixed(1)+' m/s, '+(flown/drop).toFixed(1)+' m on for every metre down');
 // Dive: a cruising craft heading down gathers speed with no flapping.
 await page.evaluate(v=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+150,mode:'fly',yaw:0,pitch:-.3,velocity:{x:0,y:0,z:-v}});},cruise);
 const top0=await agl();await page.waitForFunction(v=>__burbzVillageWalkDebug.state().player.wing.airspeed>v+4,cruise,{timeout:30000});const dive=await read();report.samples.dive={airspeed:dive.player.wing.airspeed,drop:top0-await agl(),mode:dive.player.wing.mode};
 assert(dive.player.wing.airspeed>cruise+4,'the dive gathers speed');assert(!dive.player.wing.beating,'no flapping needed');await page.screenshot({path:path.join(out,'dive.png')});
 pass('Heading down gathers speed without flapping: '+cruise+' → '+dive.player.wing.airspeed.toFixed(1)+' m/s');
 // Pull up: height first, then speed bleeds away into a stall.
 await page.evaluate(v=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+150,mode:'fly',yaw:0,pitch:.4,velocity:{x:0,y:0,z:-v}});},cruise);
 const low=await page.evaluate(()=>__burbzVillageWalkDebug.state().player.y);await page.waitForFunction(y=>__burbzVillageWalkDebug.state().player.y>y+3,low,{timeout:20000});const climbed=(await read()).player.y-low;
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.wing.mode==='stalling',null,{timeout:6000});report.samples.pullUp={climbed,stall:(await read()).player.wing};
 pass('Pulling up gains '+climbed.toFixed(1)+' m, then slows into a stall');
 // Only Flap beats the wings: W glides on, Space flaps and climbs.
 await page.evaluate(v=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+150,mode:'fly',yaw:0,pitch:0,velocity:{x:0,y:0,z:-v}});},cruise);
 await page.locator('.vw-look').focus();await page.keyboard.down('KeyW');const ahead=await page.evaluate(()=>new Promise(done=>{let beats=0;const t0=performance.now();(function watch(){beats+=__burbzVillageWalkDebug.state().player.wing.beating?1:0;if(performance.now()-t0<2000)requestAnimationFrame(watch);else done(beats);})();}));await page.keyboard.up('KeyW');
 assert.equal(ahead,0,'W never beats the wings');
 const level=await page.evaluate(()=>__burbzVillageWalkDebug.state().player.y);await page.keyboard.down('Space');try{await page.waitForFunction(y=>{const p=__burbzVillageWalkDebug.state().player;return p.wing.beating&&p.y>y+3;},level,{timeout:20000});}finally{await page.keyboard.up('Space');}
 const powered=await read();report.samples.powered={airspeed:powered.player.wing.airspeed,climb:powered.player.y-level};assert(powered.player.wing.airspeed>cruise/2,'Flap keeps flying speed');
 pass('W glides on without a wingbeat; Space flaps and climbs at '+powered.player.wing.airspeed.toFixed(1)+' m/s');
 // One Flap button, by the right thumb: above the health panel, beside Attack.
 const layout=await page.evaluate(()=>{const r=q=>document.querySelector(q)?.getBoundingClientRect().toJSON();return {flap:r('button[aria-label="Flap"]'),dive:document.querySelectorAll('button[aria-label="Dive"]').length,vitals:r('.wc-vitals'),attack:r('.fp-cast-stick'),width:innerWidth};});report.samples.layout=layout;
 assert.equal(layout.dive,0,'no Dive button');assert(layout.flap.left>layout.width/2+layout.flap.width,'Flap sits on the right');assert(layout.flap.bottom<=layout.vitals.top&&layout.flap.right<=layout.attack.left,'above health, beside Attack');
 await page.screenshot({path:path.join(out,'flap-right.png')});pass('One Flap button sits by the right thumb; no Dive button');
 assert.deepEqual(report.errors,[]);report.complete=true;await c.close();
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{report.state=await read();await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
