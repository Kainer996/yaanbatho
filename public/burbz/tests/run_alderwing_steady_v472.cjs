/* Alderwing steady v472 in the actual retained renderer with explicitly
 * synthetic, offline map input. Flies with the real key and samples the shown
 * square and the distant land as it goes. Evidence, not a unit test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/src/gstack/node_modules/playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-alderwing-steady-v472',report={served:{},missing:[],checks:[],errors:[],limits:['Actual retained renderer and loader with explicitly synthetic DEM/vector input.','Software WebGL at a phone viewport: frame times are a relative proxy, not phone FPS.','Grizedale Forest and Pendle checks were run separately against live providers.']};
fs.mkdirSync(out,{recursive:true});const server=F.createServer({root,port:8984,report});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),read=()=>page.evaluate(()=>__burbzVillageWalkDebug.state()),pass=name=>{report.checks.push(name);console.log('PASS',name);};
const G=require('../geographic_world_core.js'),coord=(x,z)=>{const g=G.unproject(F.ANCHOR,{x,y:0,z});return[g.lon,g.lat];},ring=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]].map(([a,b])=>coord(a,b));
// Rolling land with a mapped wood to the north and open meadow to the south.
const height=(x,z)=>120+8*Math.sin(x/70)+6*Math.cos(z/55);
const extraFeatures=[{type:'Feature',id:951,properties:{class:'wood',subclass:'forest'},geometry:{type:'Polygon',coordinates:[ring(0,-420,900,500)]}}];
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'});await F.routeMap(c,report,{height,extraFeatures});
 page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));await F.nativeClock(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan',null,{timeout:120000});
 await run(`if(merlinTutActive)endMerlinTutorial(false);gameState.playerHome.anchor={lat:54.45,lon:-2.65,revision:1,source:'chosen'};const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.mergeChartersVersion=1;const v=e.villages[101]={seed:101,name:'Alder Hollow',lat:54.45,lon:-2.65,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString()};const eco=ensureVillageEconomy(v);eco.buildings={cabin:1,well:1};eco.population=4;eco.ruins=[];eco.constructions=[];saveState();openEmpireVillage(101);`);
 await page.locator('#villageWalkBtn:not([disabled])').waitFor({timeout:90000});await page.locator('#villageWalkBtn').click();
 await page.waitForFunction(()=>window.__burbzVillageWalkDebug&&(__burbzVillageWalkDebug.state().ready||__burbzVillageWalkDebug.state().failed),null,{timeout:90000});assert(!(await read()).failed);
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.horizon?.ready&&__burbzVillageWalkDebug.state().continuity?.shown?.ready,null,{timeout:90000});
 let s=(await read()).continuity;assert(s.haze,'the aerial haze is on');
 const C=32,inside=(sq,id)=>{const [x,z]=id.split(',').map(Number);return x*C>=sq.x0&&x*C<sq.x1&&z*C>=sq.z0&&z*C<sq.z1;};
 const check=(s,label)=>{const ids=new Set(s.chunkIds.map(c=>c.id));for(let x=s.cut.x0;x<s.cut.x1;x+=C)for(let z=s.cut.z0;z<s.cut.z1;z+=C)assert(ids.has(x/C+','+z/C),label+': chunk '+x/C+','+z/C+' inside the cut is built');
  assert(s.shown.x0>=s.cut.x0&&s.shown.x1<=s.cut.x1&&s.shown.z0>=s.cut.z0&&s.shown.z1<=s.cut.z1,label+': the shown square lies inside the cut');
  assert.deepEqual(s.horizon.cut,[s.cut.x0,s.cut.z0,s.cut.x1,s.cut.z1],label+': the distant land is cut where the detailed ground ends');};
 check(s,'start');pass('The shown square, its chunk-aligned cut and the distant land agree');
 const n=s.nature;assert(['oakFar','birchFar','pineFar','spruceFar'].some(k=>n.kinds[k]?.live>0),'far forms are pooled');assert(n.shown<n.draws||n.draws<120,'cells beyond the shown ground skip their draw');
 pass('Trees are pooled whole: '+Object.keys(n.kinds).filter(k=>/Far$/.test(k)).join(', '));
 // Board the craft and fly north with the real key, sampling as the square moves.
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.craft?.record,null,{timeout:30000});
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),p=BurbzGeographicWorldCore.project(d.continuity.origin,d.continuity.craft.record);if(!__burbzVillageWalkDebug.place({x:p.x,z:p.z,mode:'walk'}))throw Error('Craft unreachable');});
 await page.locator('.cw-wings').click();await page.locator('.cw-wings').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.mode==='fly');
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+45,mode:'fly',yaw:0,pitch:-.25});});await page.waitForTimeout(2500);
 const craft=(await read()).continuity.craft;assert(craft.aboard&&craft.view.dashboard&&!craft.view.hull&&!craft.view.wings,'aboard: the cockpit only');
 await page.screenshot({path:path.join(out,'cockpit.png')});pass('Aboard, the pilot sees the panelled cockpit and no hull or wings');
 await page.locator('.vw-look').focus();const samples=[];let before=null,moved=0;
 await page.keyboard.down('KeyW');
 try{for(let i=0;i<40;i++){await page.waitForTimeout(150);const now=await page.evaluate(()=>{const s=__burbzVillageWalkDebug.state();return{t:performance.now(),p:s.player,c:s.continuity};});samples.push(now);
  check(now.c,'sample '+i);
  if(before){const dt=(now.t-before.t)/1000;for(const side of ['x0','z0','x1','z1'])// At most 80m a second, plus one frame (8m) that can straddle a sample.
   assert(Math.abs(now.c.shown[side]-before.c.shown[side])<=80*dt+10,'sample '+i+': the shown '+side+' eases, never jumps: '+before.c.shown[side]+' to '+now.c.shown[side]+' in '+dt.toFixed(2)+'s');
   moved+=Math.hypot(now.p.x-before.p.x,now.p.z-before.p.z);assert(now.c.horizon.epoch>=before.c.horizon.epoch);}
  if(i===20)await page.screenshot({path:path.join(out,'flight.png')});before=now;}}
 finally{await page.keyboard.up('KeyW');}
 assert(moved>40,'the craft flew on: '+moved.toFixed(1)+'m');
 const shifts=samples.filter((s,i)=>i&&s.c.shown.z0!==samples[i-1].c.shown.z0).length;assert(shifts>0,'the square followed the flight');
 pass('Flying '+Math.round(moved)+'m, the ground edge eased in '+shifts+' samples and never uncovered a chunk');
 // Look straight down: the cockpit sinks away.
 await page.keyboard.down('ArrowDown');try{await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.pitch<-1.4,null,{timeout:15000});}finally{await page.keyboard.up('ArrowDown');}
 await page.waitForTimeout(600);assert(!(await read()).continuity.craft.view.dashboard,'looking down, the cockpit is gone');
 await page.screenshot({path:path.join(out,'down.png')});pass('Looking straight down, nothing blocks the ground');
 s=await read();report.render={draws:s.draws,triangles:s.triangles,dpr:s.dpr};assert.deepEqual(report.errors,[]);report.complete=true;await c.close();
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{report.state=await read();await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
