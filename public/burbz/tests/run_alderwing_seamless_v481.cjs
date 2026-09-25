/* Alderwing seamless v481 in the actual retained renderer with explicitly
 * synthetic, offline map input and a fixed rainy sky. Frames are pumped by
 * hand while the craft flies north: after each frame the scene is drawn again
 * from the previous frame's camera, so every changed pixel is a pop, never
 * camera motion. Evidence, not a unit test. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'/root/src/gstack/node_modules/playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-alderwing-seamless-v481',report={served:{},missing:[],checks:[],errors:[],pops:[],limits:['Actual retained renderer and loader with explicitly synthetic DEM/vector input and a fixed weather report.','Software WebGL at a phone viewport: a relative proxy, not phone FPS.','Grizedale Forest and Pendle flights were measured separately against live providers.']};
fs.mkdirSync(out,{recursive:true});const server=F.createServer({root,port:8985,report});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),read=()=>page.evaluate(()=>__burbzVillageWalkDebug.state()),pass=name=>{report.checks.push(name);console.log('PASS',name);};
const G=require('../geographic_world_core.js'),coord=(x,z)=>{const g=G.unproject(F.ANCHOR,{x,y:0,z});return[g.lon,g.lat];},ring=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]].map(([a,b])=>coord(a,b));
// Rolling land with a mapped wood to the north and open meadow to the south.
const height=(x,z)=>120+8*Math.sin(x/70)+6*Math.cos(z/55);
const extraFeatures=[{type:'Feature',id:961,properties:{class:'wood',subclass:'forest'},geometry:{type:'Polygon',coordinates:[ring(0,-420,900,500)]}}];
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||undefined,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const c=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});await F.routeMap(c,report,{height,extraFeatures});
 page=await c.newPage();page.on('pageerror',e=>report.errors.push(e.message));await F.nativeClock(page);
 // Frames are pumped by hand once the flight starts.
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);window.__manual=false;window.__queue=[];window.requestAnimationFrame=cb=>{if(!window.__manual)return raf(cb);window.__queue.push(cb);return window.__queue.length;};window.__pump=ts=>{const q=window.__queue;window.__queue=[];for(const cb of q)cb(ts);};});
 await page.goto(server.url,{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan',null,{timeout:120000});
 // A fixed rainy report, never the network.
 await page.evaluate(()=>{const sky={rain:.8,wind:.5,cloud:.6};setInterval(()=>{if(window.BurbzCalmAudio)window.BurbzCalmAudio.weather=()=>sky;},100);if(window.BurbzCalmAudio)window.BurbzCalmAudio.weather=()=>sky;});
 await run(`if(merlinTutActive)endMerlinTutorial(false);gameState.playerHome.anchor={lat:54.45,lon:-2.65,revision:1,source:'chosen'};const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.mergeChartersVersion=1;const v=e.villages[101]={seed:101,name:'Alder Hollow',lat:54.45,lon:-2.65,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString()};const eco=ensureVillageEconomy(v);eco.buildings={cabin:1,well:1};eco.population=4;eco.ruins=[];eco.constructions=[];saveState();openEmpireVillage(101);`);
 await page.locator('#villageWalkBtn:not([disabled])').waitFor({timeout:90000});await page.locator('#villageWalkBtn').click();
 await page.waitForFunction(()=>window.__burbzVillageWalkDebug&&(__burbzVillageWalkDebug.state().ready||__burbzVillageWalkDebug.state().failed),null,{timeout:90000});assert(!(await read()).failed);
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.horizon?.ready&&__burbzVillageWalkDebug.state().continuity?.shown?.ready,null,{timeout:90000});
 // Rain brings clouds, a grey sky and a thicker haze.
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.sky?.weather?.known,null,{timeout:30000});
 let s=(await read()).continuity;assert(s.sky.weather.cover>.85&&s.sky.weather.rain>.75,'rain covers the sky: '+JSON.stringify(s.sky.weather));assert(s.fog[1]<2400&&s.fog[0]<100,'and thickens the haze: '+s.fog);
 await page.screenshot({path:path.join(out,'rain-foot.png')});pass('Rain comes with a covered grey sky and a thicker haze');
 // The mapped wood carries on beyond the far trees as canopy crowns.
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.crowns?.count>200,null,{timeout:60000});s=(await read()).continuity;
 assert(s.nature.kinds.crownBroad?.live>0||s.nature.kinds.crownConifer?.live>0,'canopy crowns are pooled');pass('The wood is drawn crown by crown beyond the far trees: '+s.crowns.count+' crowns in '+s.crowns.cells+' cells');
 // Board the craft, climb, and take over the frames.
 await page.waitForFunction(()=>__burbzVillageWalkDebug.state().continuity?.craft?.record,null,{timeout:30000});
 await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),p=BurbzGeographicWorldCore.project(d.continuity.origin,d.continuity.craft.record);if(!__burbzVillageWalkDebug.place({x:p.x,z:p.z,mode:'walk'}))throw Error('Craft unreachable');});
 await page.locator('.cw-wings').click();await page.locator('.cw-wings').click();await page.waitForFunction(()=>__burbzVillageWalkDebug.state().player.mode==='fly');
 const start=await page.evaluate(()=>{const d=__burbzVillageWalkDebug.state(),w=__burbzVillageWalkDebug.world();const y=w.height(d.player.x,d.player.z)+50;__burbzVillageWalkDebug.place({...d.player,y,mode:'fly',yaw:0,pitch:-.22});return{x:d.player.x,y,z:d.player.z};});
 await page.waitForTimeout(6000);
 await page.evaluate(()=>{const L={},orig=BurbzManga.render;BurbzManga.render=function(T,r,s,c){L.T=T;L.r=r;L.s=s;L.c=c;return orig.apply(this,arguments);};let prevA=null,prevCam=null,cv=null,ctx=null,hidden=false;
  const grab=()=>{const src=L.r.domElement;if(!cv)cv=document.createElement('canvas');if(cv.width!==src.width||cv.height!==src.height){cv.width=src.width;cv.height=src.height;ctx=cv.getContext('2d',{willReadFrequently:true});}ctx.drawImage(src,0,0);return ctx.getImageData(0,0,src.width,src.height);};
  // The pilot's own cockpit moves with the camera, so it leaves the comparison.
  const hide=()=>{let n=null;L.s.traverse(o=>{if(o.material?.userData?.craftNeedle)n=o;});if(!n)return false;let g=n;while(g.parent&&g.parent!==L.s)g=g.parent;Object.defineProperty(g,'visible',{get:()=>false,set:()=>{},configurable:true});return true;};
  window.__pops={step(pose,ts){if(!hidden&&L.s)hidden=hide();__burbzVillageWalkDebug.place(pose);__pump(ts);if(!L.r)return null;const A=grab();let changed=null;
   if(prevA&&prevCam&&prevA.width===A.width){const cam=L.c.clone();cam.position.copy(prevCam.p);cam.quaternion.copy(prevCam.q);cam.updateMatrixWorld(true);orig.call(BurbzManga,L.T,L.r,L.s,cam);const B=grab(),a=prevA.data,b=B.data;changed=0;for(let i=0;i<a.length;i+=4)if(Math.max(Math.abs(a[i]-b[i]),Math.abs(a[i+1]-b[i+1]),Math.abs(a[i+2]-b[i+2]))>28)changed++;changed/=A.width*A.height;}
   prevA=A;prevCam={p:L.c.position.clone(),q:L.c.quaternion.clone()};return changed;}};window.__manual=true;});
 await page.waitForTimeout(400);
 let ts=1e6,peak=0;const pops=[];for(let i=0;i<150;i++){ts+=1000/30;const d=36*i/30,changed=await page.evaluate(([p,ts])=>__pops.step(p,ts),[{x:start.x,y:start.y,z:start.z-d,mode:'fly',yaw:0,pitch:-.22},ts]);if(changed!==null){pops.push(changed);peak=Math.max(peak,changed);}if(i===75)await page.screenshot({path:path.join(out,'rain-flight.png')});}
 const sorted=[...pops].sort((a,b)=>a-b),median=sorted[sorted.length>>1];report.pops={frames:pops.length,median,p99:sorted[Math.floor(sorted.length*.99)],peak};
 // Trees hand over one at a time: no frame changes far more than a typical one.
 assert(peak<.015,'no frame changes more than 1.5% of the screen: '+peak.toFixed(4));assert(peak<median*4+.002,'no spike stands out of the steady handover: '+JSON.stringify(report.pops));
 pass('Flying 180m north at 36m/s, the most any frame changed was '+(peak*100).toFixed(2)+'% of the screen');
 s=await read();report.render={draws:s.draws,triangles:s.triangles,dpr:s.dpr,crowns:s.continuity.crowns,horizon:s.continuity.horizon?.changes};assert.deepEqual(report.errors,[]);report.complete=true;await c.close();
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{report.state=await read();await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
