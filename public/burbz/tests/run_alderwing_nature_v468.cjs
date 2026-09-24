/* Alderwing nature v468 in the actual retained renderer with explicitly
 * synthetic, offline map input: a meadow valley under a 30m crag that a
 * mapped stream falls over, a lake and a wood. Evidence, not a unit test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/src/gstack/node_modules/playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-alderwing-nature-v468',report={served:{},missing:[],checks:[],errors:[],limits:['Actual retained renderer and loader with explicitly synthetic DEM/vector input.','Software WebGL at a phone viewport: frame times are a relative proxy, not phone FPS.','Real Lake District and Pendle checks were run separately against live providers.']};
fs.mkdirSync(out,{recursive:true});const server=F.createServer({root,port:8969,report});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),read=()=>page.evaluate(()=>__burbzVillageWalkDebug.state()),nature=()=>page.evaluate(()=>__burbzVillageWalkDebug.nature()),pass=name=>{report.checks.push(name);console.log('PASS',name);};
const G=require('../geographic_world_core.js'),coord=(x,z)=>{const g=G.unproject(F.ANCHOR,{x,y:0,z});return[g.lon,g.lat];},ring=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]].map(([a,b])=>coord(a,b));
// Ground rises north of the village: flat meadow, a 30m crag, then a slope.
const height=(x,z)=>120+(z<-120?30+(-120-z)*.08:z<-100?(-100-z)*1.5:0);
const extraFeatures=[{type:'Feature',id:901,properties:{class:'stream'},geometry:{type:'LineString',coordinates:[coord(60,-260),coord(60,-160),coord(60,-110),coord(60,-60),coord(60,40)]}},
 {type:'Feature',id:902,properties:{class:'water'},geometry:{type:'Polygon',coordinates:[ring(-40,150,90,50)]}}];
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});await F.routeMap(c,report,{height,extraFeatures});
 page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));await F.nativeClock(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan',null,{timeout:120000});
 await run(`if(merlinTutActive)endMerlinTutorial(false);gameState.playerHome.anchor={lat:54.45,lon:-2.65,revision:1,source:'chosen'};const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.mergeChartersVersion=1;const v=e.villages[101]={seed:101,name:'Alder Hollow',lat:54.45,lon:-2.65,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString()};const eco=ensureVillageEconomy(v);eco.buildings={cabin:1,well:1};eco.population=4;eco.ruins=[];eco.constructions=[];saveState();openEmpireVillage(101);`);
 await page.locator('#villageWalkBtn:not([disabled])').waitFor({timeout:90000});await page.locator('#villageWalkBtn').click();
 await page.waitForFunction(()=>window.__burbzVillageWalkDebug&&(__burbzVillageWalkDebug.state().ready||__burbzVillageWalkDebug.state().failed),null,{timeout:90000});assert(!(await read()).failed);
 await page.waitForFunction(()=>__burbzVillageWalkDebug.nature().horizon?.ready,null,{timeout:90000});
 let n=await nature();assert(n.haze,'the aerial haze replaces the 104m fog');assert.equal(n.horizon.levels.length,2);assert(n.horizon.tiles.every(t=>t.loaded));
 pass('Distant land from real elevation tiles is ready and the view reaches the haze');
 assert(Object.keys(n.nature.kinds).length>=5,'several kinds of plants: '+Object.keys(n.nature.kinds));assert(n.nature.draws<200);
 pass('Varied plants share per-cell instanced pools: '+Object.keys(n.nature.kinds).sort().join(', '));
 assert(n.streams>=1);assert(n.falls.some(f=>Math.abs(f.x-60)<4&&f.drop>20&&f.drop<40),JSON.stringify(n.falls));assert(n.streamTriangles>0);
 pass('The mapped stream flows as a ribbon and becomes a waterfall at the real 30m crag');
 await page.evaluate(()=>{if(!__burbzVillageWalkDebug.place({x:52,z:-80,mode:'walk',yaw:0,pitch:.28}))throw Error('Foot of the falls unreachable');});
 await page.waitForFunction(()=>__burbzVillageWalkDebug.nature().spray>0,null,{timeout:30000});await page.waitForTimeout(1500);await page.screenshot({path:path.join(out,'waterfall.png')});
 pass('Spray rises from the plunge pool at the foot of the fall');
 await page.evaluate(()=>{for(let z=116;z>80;z-=2)for(const x of [-40,-30,-50,-20,-60])if(__burbzVillageWalkDebug.place({x,z,mode:'walk',yaw:Math.PI,pitch:-.12}))return;throw Error('Lake shore unreachable');});await page.waitForTimeout(1500);await page.screenshot({path:path.join(out,'lake.png')});
 pass('The mapped lake shows from its real shore');
 // The craft: board, take off, and look straight down past the dashboard.
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.craft?.record,null,{timeout:30000});
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),p=BurbzGeographicWorldCore.project(d.continuity.origin,d.continuity.craft.record),w=__burbzVillageWalkDebug.world();for(let r=4;r<9;r+=.5){const x=p.x+r,z=p.z+r*.6;if(w.allowed(x,z)&&__burbzVillageWalkDebug.place({x,z,mode:'walk',yaw:Math.atan2(-(p.x-x),-(p.z-z)),pitch:-.3}))return;}throw Error('No view of the parked craft');});
 await page.waitForTimeout(1200);await page.screenshot({path:path.join(out,'craft-parked.png')});
 let craft=(await read()).continuity.craft;assert(craft.view.hull&&craft.view.wings,'hull and wings show from outside');assert(craft.view.span<2.6,'wrists fold in beside the hull when parked: '+craft.view.span);
 pass('The parked craft shows its hull and folded feathered wings');
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),p=BurbzGeographicWorldCore.project(d.continuity.origin,d.continuity.craft.record);if(!__burbzVillageWalkDebug.place({x:p.x,z:p.z,mode:'walk'}))throw Error('Craft unreachable');});
 await page.locator('.cw-wings').click();await page.locator('.cw-wings').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.mode==='fly');
 craft=(await read()).continuity.craft;assert(craft.aboard);assert(!craft.view.hull&&!craft.view.wings,'no hull or wings in the pilot view');
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();__burbzVillageWalkDebug.place({...d.player,y:w.height(d.player.x,d.player.z)+40,mode:'fly',pitch:-.1});});await page.waitForTimeout(1500);
 await page.screenshot({path:path.join(out,'cockpit.png')});craft=(await read()).continuity.craft;assert(craft.view.dashboard,'the dashboard frames the forward view');assert(craft.view.span>3.6,'wrists spread wide in flight: '+craft.view.span);
 await page.locator('.vw-look').focus();await page.keyboard.down('ArrowDown');try{await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.pitch<-1.4,null,{timeout:15000});}finally{await page.keyboard.up('ArrowDown');}
 await page.waitForTimeout(600);craft=(await read()).continuity.craft;assert(!craft.view.dashboard,'looking down slides the dashboard away');assert((await read()).player.pitch>=-1.5);
 await page.screenshot({path:path.join(out,'cockpit-down.png')});
 pass('Aboard, the pilot sees no wings, keeps a small dashboard ahead and can look straight down');
 const s=await read();report.render={draws:s.draws,triangles:s.triangles,dpr:s.dpr};assert.deepEqual(report.errors,[]);report.complete=true;await c.close();
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{report.state=await read();await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
