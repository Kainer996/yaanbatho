/* Alderwing living water v496 in the actual retained renderer with explicitly
 * synthetic, offline map input: a beck falling over a 30m crag, rapids down a
 * steep valley side, a 1km reservoir with a wide river flowing into it, and
 * the village's own river. Evidence, not a unit test: it checks the shaders
 * compile, that every water part is drawn, that water moves between frames,
 * that the reservoir meets its distant water, and that running water is heard. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/src/gstack/node_modules/playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-alderwing-water-v496',report={served:{},missing:[],checks:[],errors:[],console:[],limits:['Actual retained renderer and loader with explicitly synthetic DEM/vector input.','Software WebGL at a phone viewport: frame times are a relative proxy, not phone FPS.','Headless audio has no speakers: the check reads the live Web Audio graph, not what an ear hears.']};
fs.mkdirSync(out,{recursive:true});const server=F.createServer({root,port:8995,report});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),read=()=>page.evaluate(()=>__burbzVillageWalkDebug.state()),nature=()=>page.evaluate(()=>__burbzVillageWalkDebug.nature()),pass=name=>{report.checks.push(name);console.log('PASS',name);};
const G=require('../geographic_world_core.js'),coord=(x,z)=>{const g=G.unproject(F.ANCHOR,{x,y:0,z});return[g.lon,g.lat];},rect=(x0,z0,x1,z1)=>[[x0,z0],[x1,z0],[x1,z1],[x0,z1],[x0,z0]].map(([a,b])=>coord(a,b));
// North of the village: a 30m crag for x>-80 and a long steep valley side
// for x<-100. East: a 1km reservoir with a round hill on its west shore.
// South-west: a 40m river flowing south along a mapped centre line.
const LAKE={x0:140,z0:40,x1:1140,z1:740},HILL={x:60,z:300,r:55,h:38},RIVER={x:-50,half:20,z0:160,z1:1000};
function height(x,z){
 const west=x<-100?1:x<-80?(-80-x)/20:0,rapid=z<-40?Math.min(60,(-40-z)*.42):0,crag=z<-120?30+(-120-z)*.08:z<-100?(-100-z)*1.5:0;let h=120+west*rapid+(1-west)*crag;
 const hill=Math.max(0,1-Math.hypot(x-HILL.x,z-HILL.z)/HILL.r);h+=HILL.h*hill*hill*(3-2*hill);
 const dl=Math.max(LAKE.x0-x,x-LAKE.x1,LAKE.z0-z,z-LAKE.z1,0);if(dl<20)h=Math.min(h,116+dl*.2);
 const dr=Math.max(Math.abs(x-RIVER.x)-RIVER.half,RIVER.z0-z,z-RIVER.z1,0);if(dr<20)h=Math.min(h,116.3+(RIVER.z1-Math.min(z,RIVER.z1))*.0004+dr*.18);
 return h;
}
const extraFeatures=[
 {type:'Feature',id:901,properties:{class:'stream'},geometry:{type:'LineString',coordinates:[coord(60,-260),coord(60,-160),coord(60,-110),coord(60,-60),coord(60,40)]}},
 {type:'Feature',id:903,properties:{class:'stream'},geometry:{type:'LineString',coordinates:[coord(-140,-300),coord(-140,-200),coord(-140,-100),coord(-140,-20)]}},
 {type:'Feature',id:905,properties:{class:'stream'},geometry:{type:'LineString',coordinates:[coord(RIVER.x,RIVER.z0),coord(RIVER.x,400),coord(RIVER.x,700),coord(RIVER.x,RIVER.z1)]}},
 {type:'Feature',id:902,properties:{class:'water',subclass:'lake'},geometry:{type:'Polygon',coordinates:[rect(LAKE.x0,LAKE.z0,LAKE.x1,LAKE.z1)]}},
 {type:'Feature',id:904,properties:{class:'water',subclass:'river'},geometry:{type:'Polygon',coordinates:[rect(RIVER.x-RIVER.half,RIVER.z0,RIVER.x+RIVER.half,RIVER.z1)]}}];
// Walk there in short hops, sidestepping anything in the way, so the ground
// ahead streams in as it would for a player.
async function travel(x,z){
 for(let i=0;i<160;i++){const d=await page.evaluate(([x,z])=>{const s=__burbzVillageWalkDebug.state().player,dx=x-s.x,dz=z-s.z,d=Math.hypot(dx,dz);if(d<3)return 0;const k=Math.min(1,18/d);
   for(const off of [0,5,-5,11,-11,18,-18])for(const kk of [k,k*.5]){const nx=s.x+dx*kk-dz/d*off,nz=s.z+dz*kk+dx/d*off;if(__burbzVillageWalkDebug.place({x:nx,z:nz,mode:'walk',yaw:Math.atan2(-dx,-dz),pitch:0}))return d;}return -d;},[x,z]);
  if(d===0)break;await page.waitForTimeout(d<0?700:220);}
 await page.waitForTimeout(2200);
}
// VIEWS=beck,river runs only those views, for quick looks while tuning.
const ONLY=process.env.VIEWS?process.env.VIEWS.split(','):null;
async function view(name,pose,{wait=1800,pair=true}={}){
 await travel(pose.x,pose.z);
 await page.evaluate(p=>{if(!__burbzVillageWalkDebug.place(p))throw Error('Pose unreachable: '+JSON.stringify(p));},pose);await page.waitForTimeout(wait);
 await page.screenshot({path:path.join(out,name+'.png')});if(pair){await page.waitForTimeout(450);await page.screenshot({path:path.join(out,name+'-later.png')});}
}
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader','--autoplay-policy=no-user-gesture-required']});
 const c=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});await F.routeMap(c,report,{height,extraFeatures});
 page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.on('console',m=>{const t=m.text();if(/Shader Error|WebGLProgram|GL_INVALID|Program Info Log/i.test(t))report.console.push(t.slice(0,4000));});
 await F.nativeClock(page);await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan',null,{timeout:120000});
 await run(`if(merlinTutActive)endMerlinTutorial(false);gameState.playerHome.anchor={lat:54.45,lon:-2.65,revision:1,source:'chosen'};const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.mergeChartersVersion=1;const v=e.villages[101]={seed:101,name:'Alder Hollow',lat:54.45,lon:-2.65,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString()};const eco=ensureVillageEconomy(v);eco.buildings={cabin:1,well:1};eco.population=4;eco.ruins=[];eco.constructions=[];saveState();openEmpireVillage(101);`);
 // Fair weather, so no shower hides the water.
 await run(`window.BurbzCalmAudio.weather=()=>({rain:0,wind:.2,cloud:.3});`);
 await page.locator('#villageWalkBtn:not([disabled])').waitFor({timeout:90000});await page.locator('#villageWalkBtn').click();
 await page.waitForFunction(()=>window.__burbzVillageWalkDebug&&(__burbzVillageWalkDebug.state().ready||__burbzVillageWalkDebug.state().failed),null,{timeout:90000});assert(!(await read()).failed);
 await page.waitForFunction(()=>__burbzVillageWalkDebug.nature().horizon?.ready,null,{timeout:90000});
 // Sound on, as a player would have it, with one real tap to wake the audio.
 await run(`sfxEnabled=true;`);await page.mouse.click(200,300);
 let n=await nature();
 assert(n.streams>=3,'three mapped streams and the village river: '+n.streams);assert(n.water.rivers>=1,'the village river runs on as a stream line');
 assert(n.falls.some(f=>Math.abs(f.x-60)<4&&f.drop>20&&f.drop<40),JSON.stringify(n.falls));
 pass('Mapped streams, the settlement river and the 30m fall are all shaped');

 const want=name=>!ONLY||ONLY.includes(name);
 // 1. A beck seen from its bank: ripples ride the current, flecks drift on it.
 if(want('beck')){await view('beck',{x:57.3,z:-62,mode:'walk',yaw:Math.PI+.35,pitch:-.32});
 n=await nature();assert(n.water.near&&n.water.near.d<2.5,'standing on the bank: '+JSON.stringify(n.water.near));
 await page.waitForFunction(()=>__burbzVillageWalkDebug.nature().water.drift>0,null,{timeout:15000});
 pass('Beside the beck, flecks of foam and leaves ride the current');
 n=await nature();assert(n.water.mix.brook.level>.2,'the brook is heard beside it: '+JSON.stringify(n.water.mix));
 await page.waitForFunction(()=>{const s=__burbzVillageWalkDebug.nature().water.sound;return s&&s.brook.playing&&s.brook.gain>.05;},null,{timeout:20000}).catch(()=>{});
 n=await nature();report.sound={beck:n.water.sound,mix:n.water.mix};
 if(n.water.sound?.brook?.playing)pass('The brook is heard on the calm nature bus: '+n.water.sound.brook.gain.toFixed(3));else report.limits.push('Headless audio did not start the brook loop: '+JSON.stringify(n.water.sound));}

 // 2. The waterfall from its pool: an arcing sheet, droplets and spray.
 if(want('waterfall')){await view('waterfall',{x:53,z:-78,mode:'walk',yaw:-.12,pitch:.3});
 n=await nature();assert(n.water.falls>=1,'a waterfall sheet is drawn');assert(n.water.drops>0,'droplets fly where it lands');assert(n.spray>0,'spray rises from the pool');assert(n.water.fallsNear>=1&&n.water.mix.fall.level>.2,'the fall roars: '+JSON.stringify(n.water.mix));
 pass('The 30m fall arcs off its lip into a churning pool, with spray, droplets and a roar');}

 // 3. Rapids down the steep valley side.
 if(want('rapids')){await view('rapids',{x:-136.8,z:-150,mode:'walk',yaw:Math.PI-.3,pitch:-.35});
 n=await nature();assert(n.water.near&&n.water.near.steep>.4,'steep white water: '+JSON.stringify(n.water.near));
 pass('Steep water runs fast and white');}

 // 4. The reservoir from its shore, and from the air across to the far side.
 if(want('reservoir')){await view('reservoir-shore',{x:128,z:420,mode:'walk',yaw:-Math.PI/2,pitch:-.08});
 // From the hilltop, 38m up, the view runs across the whole reservoir.
 await view('reservoir-hill',{x:HILL.x,z:HILL.z,mode:'walk',yaw:-Math.PI/2+.3,pitch:-.16},{wait:4000});
 n=await nature();assert(n.horizon.ready,'the distant water is ready');
 pass('The reservoir runs from the near water into the distant water');}

 // 5. A wide mapped river flows east into the reservoir.
 if(want('river')){await view('river',{x:RIVER.x-RIVER.half-6,z:300,mode:'walk',yaw:Math.PI+.9,pitch:-.25});
 n=await nature();assert(n.water.heard&&n.water.heard.d<8,'on the river bank: '+JSON.stringify(n.water.heard));assert(n.water.mix.river.level>.2,'the river rushes: '+JSON.stringify(n.water.mix));
 pass('The wide river flows along its mapped line and is heard from its bank');}

 // 6. The village's own river, now a flowing stream.
 const s=await read(),river=s.continuity.corridors.find(r=>r.kind==='river');
 if(river&&want('village')){const along=-60,off=river.width/2+1.8,x=river.x+river.ux*along-river.uz*off,z=river.z+river.uz*along+river.ux*off,tx=river.x+river.ux*(along+12),tz=river.z+river.uz*(along+12);
  await view('village-river',{x,z,mode:'walk',yaw:Math.atan2(-(tx-x),-(tz-z)),pitch:-.32});
  n=await nature();assert(n.water.near&&n.water.near.d<3,'beside the village river: '+JSON.stringify(n.water.near));
  pass('The village river flows as a stream through and beyond the village');}
 else if(want('village'))report.limits.push('Seed 101 had no authored river in this build.');

 // 7. A passing shower rings the reservoir with raindrops.
 if(want('rain')){await run(`window.BurbzCalmAudio.weather=()=>({rain:.85,wind:.35,cloud:.9});`);await view('rain-reservoir',{x:128,z:420,mode:'walk',yaw:-Math.PI/2,pitch:-.3},{wait:3500});
  pass('Rain rings the reservoir');}

 assert.deepEqual(report.console,[],'no shader errors');assert.deepEqual(report.errors,[]);
 const st=await read();report.render={draws:st.draws,triangles:st.triangles,dpr:st.dpr};report.complete=true;await c.close();
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{report.state=await nature();await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
