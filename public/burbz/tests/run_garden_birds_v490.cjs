/* Browser proof for the garden Academy tree and the garden birds (v490).
 * Real game page, real Three renderer; synthetic map and software WebGL, so
 * this is not a physical-phone or frame-rate claim.
 * Run: EVIDENCE_DIR=/tmp/v490 PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node tests/run_garden_birds_v490.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-garden-birds-v490';fs.mkdirSync(out,{recursive:true});
const report={served:{},missing:[],checks:[],errors:[],limits:['Synthetic map and DEM; software WebGL; headless audio is never unlocked, so sound is checked by its gate, not by ear.']};
const BUILT=['dorm','tavern','kitchen','training','hospital','library','observatory'];
const seed=F.SEED+`\n{const f=JSON.parse(localStorage.getItem('burbz_state'));f.settings.sfx=true;Object.assign(f.playerHome,{tier:1,outlook:true,anchor:{lat:54.45,lon:-2.65,revision:1,source:'chosen'},owned:{...f.playerHome.owned,birdbath:1,feeder:1,bench:1},placed:[...f.playerHome.placed,{id:2,item:'birdbath',area:'yard',x:4,z:7,turn:0},{id:3,item:'feeder',area:'yard',x:-4,z:7,turn:0},{id:4,item:'bench',area:'yard',x:5,z:-5,turn:0}]});f.lastKnownHome={lat:54.45,lon:-2.65};localStorage.setItem('burbz_state',JSON.stringify(f));}`;
const server=F.createServer({root,port:Number(process.env.PORT||8986),report,seed});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),pass=(name,detail)=>{report.checks.push({name,detail});console.log('PASS',name);};
const stand=(dx,dz,yaw,pitch)=>page.evaluate(([dx,dz,yaw,pitch])=>{const g=proofYard.group;return __burbzVillageWalkDebug.place({x:g.position.x+dx,z:g.position.z+dz,yaw,pitch,mode:'walk'});},[dx,dz,yaw,pitch]);
const birds=()=>page.evaluate(()=>proofYard.birds.birds.map(b=>({key:b.key,look:b.look,state:b.state,roost:b.roost,kind:b.perch?.kind||null,x:b.pos.x,y:b.pos.y,z:b.pos.z,yaw:b.yaw})));
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:844,height:390},hasTouch:true,serviceWorkers:'block'});
 await F.routeMap(context,report,{height:(x,z)=>120+Math.sin(x/45)*3+Math.cos(z/60)*2});
 await context.route('**/burbz/**',route=>{const rel=decodeURIComponent(new URL(route.request().url()).pathname).replace(/^\/burbz\//,'');if(!/^(assets|bird-art-cache|icons|lib|data)\//.test(rel)||rel.includes('..'))return route.fallback();const file=path.join(root,rel);if(fs.existsSync(file)&&fs.statSync(file).size>200)return route.fulfill({path:file});return route.fallback();});
 page=await context.newPage();page.setDefaultTimeout(30000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');
 await run(`if(merlinTutActive)endMerlinTutorial(false);tutorialFlowState().errandClaimed=true;gameState.academyBuildings=gameState.academyBuildings||{};for(const id of ${JSON.stringify(BUILT)})gameState.academyBuildings[id]={...(gameState.academyBuildings[id]||{}),built:true};saveState();const fn=BurbzPlayerHomeScene.createYardContent;BurbzPlayerHomeScene.createYardContent=(...args)=>{const c=fn(...args);window.proofYard=c;return c;};enterGeographicWorld({localPose:{x:0,y:0,z:8,yaw:0,pitch:-.08}});`);
 await page.waitForFunction(()=>window.__burbzVillageWalkDebug&&(__burbzVillageWalkDebug.state().ready||__burbzVillageWalkDebug.state().failed),null,{timeout:120000});
 assert(!await page.evaluate(()=>__burbzVillageWalkDebug.state().failed));await page.waitForFunction(()=>window.proofYard?.group.parent);await page.waitForTimeout(1500);

 // The tree: beside the house, only the built buildings, a little taller than the woodland.
 report.tree=await page.evaluate(()=>{const a=proofYard.academy,spot=BurbzPlayerHomeCore.academyTree(__testEval('gameState.playerHome')),T=THREE,box=new T.Box3().setFromObject(a.group);return{built:__testEval('academyBuiltRoomIds()').sort(),houses:[...a.houses].sort(),height:a.height,top:box.max.y-a.group.getWorldPosition(new T.Vector3()).y,spot,local:a.group.position.toArray(),perches:a.perches.length,kinds:[...new Set(a.perches.map(p=>p.kind))].sort(),houseDistance:Math.hypot(spot.x,spot.z)};});
 // The garden tree shows exactly what the Academy screen shows (the Roost was retired in v302).
 assert.deepEqual(report.tree.houses,report.tree.built);assert(report.tree.houses.length>=6);assert(report.tree.top>8&&report.tree.top<12.5,'tree height '+report.tree.top);assert(report.tree.houseDistance<11);
 assert(['bough','deck','roof','top','twig'].every(k=>report.tree.kinds.includes(k)));
 pass('The Academy tree stands beside the house with only the built Academy buildings, a little taller than the woodland',report.tree);
 const blocked=await stand(report.tree.spot.x,report.tree.spot.z,0,0);assert.equal(blocked,false);
 pass('The player cannot walk into the trunk, roots or low treehouses');

 // Views for Yaan.
 assert(await stand(3,15,.41,.1));await page.waitForTimeout(700);await page.screenshot({path:path.join(out,'house-and-academy-tree.png')});
 const sp=report.tree.spot;assert(await stand(sp.x+4,sp.z+5.5,Math.atan2(4,5.5),.28));await page.waitForTimeout(700);await page.screenshot({path:path.join(out,'academy-tree-close.png')});
 pass('Screenshots: the house with its Academy tree, and the tree up close');

 // The flock: twelve birds of seven species, living their lives.
 // The game makes its own weather from the clock; birds shelter in a shower, so pin a fair day.
 await page.evaluate(()=>{const real=BurbzGardenBirds.environment;window.__realEnv=real;BurbzGardenBirds.environment=()=>({...real(),rain:0,lamp:0,hour:10,wind:{speed:.25,x:-.93,z:-.37}});});
 const start=await birds();assert.equal(start.length,12);assert.deepEqual([...new Set(start.map(b=>b.key))].sort(),['blackbird','bluetit','chaffinch','goldfinch','greattit','robin','wren']);
 assert(await stand(0,16,0,.05));
 const seen={fly:0,perch:0,ground:0},kinds=new Set();let moved=0,prev=start;for(let i=0;i<14;i++){await page.waitForTimeout(700);const now=await birds();for(const b of now){assert(Number.isFinite(b.x+b.y+b.z),'finite bird');seen[b.state]++;if(b.kind)kinds.add(b.kind);}moved+=now.reduce((n,b,j)=>n+Math.hypot(b.x-prev[j].x,b.z-prev[j].z),0);prev=now;}
 report.flock={seen,kinds:[...kinds].sort(),moved};assert(seen.fly>0&&seen.perch>0,'birds fly and perch');assert(moved>5);
 pass('Birds perch, forage and fly between the tree, the house and the garden',report.flock);
 await page.screenshot({path:path.join(out,'garden-birds.png')});
 // A close look: hold one low bird still for the photo, then let it go.
 const close=await page.evaluate(()=>{const G=BurbzGardenBirds,fid={};for(const [k,sp] of Object.entries(G.SPECIES)){fid[k]=sp.fid;sp.fid=.3;}window.__fid=fid;const g=proofYard.group.position,robin=proofYard.birds.birds.find(b=>b.key==='robin'),bath=proofYard.birds.perches.find(p=>p.kind==='bath'&&(!p.taken||p.taken===robin));if(robin&&bath){if(robin.perch)robin.perch.taken=null;if(bath.taken&&bath.taken!==robin)bath.taken.perch=null;robin.flight=null;robin.state='perch';robin.perch=bath;bath.taken=robin;robin.pos.set(bath.x,bath.y+robin.foot,bath.z);robin.until=1e12;robin.nextSong=1e12;}
  const list=robin&&bath?[robin]:proofYard.birds.birds.filter(b=>b.state!=='fly'&&b.pos.y<2.6);
  for(const b of list)for(const a of [0,1,2,3,4,5,6,7].map(i=>i*Math.PI/4)){const d=1,x=b.pos.x+Math.sin(a)*d,z=b.pos.z+Math.cos(a)*d,yaw=Math.atan2(x-b.pos.x,z-b.pos.z);if(__burbzVillageWalkDebug.place({x:g.x+x,z:g.z+z,yaw,pitch:0,mode:'walk'})){const eye=__burbzVillageWalkDebug.state().player.y+1.38-proofYard.group.position.y,pitch=Math.atan2(b.pos.y-eye,d);__burbzVillageWalkDebug.place({x:g.x+x,z:g.z+z,yaw,pitch,mode:'walk'});b.until=1e12;return{key:b.key,state:b.state,kind:b.perch?.kind||'ground'};}}return null;});
 if(close){await page.waitForTimeout(600);await page.screenshot({path:path.join(out,'bird-close-'+close.key+'.png')});report.closeUp=close;pass('Close look at a '+close.key,close);}
 await page.evaluate(()=>{for(const [k,v] of Object.entries(window.__fid))BurbzGardenBirds.SPECIES[k].fid=v;for(const b of proofYard.birds.birds)if(b.until>1e11)b.until=0;});

 // Come close and a bird flies off.
 const target=(await birds()).map((b,i)=>({...b,i})).find(b=>b.state!=='fly'&&b.y<3);
 if(target){const g=await page.evaluate(()=>proofYard.group.position.toArray());report.flee={bird:target.key,state:target.state};const ok=await page.evaluate(([x,z])=>{const g=proofYard.group.position;for(const [dx,dz] of [[.9,0],[-.9,0],[0,.9],[0,-.9],[1.3,1.3],[-1.3,-1.3]])if(__burbzVillageWalkDebug.place({x:g.x+x+dx,z:g.z+z+dz,yaw:0,pitch:0,mode:'walk'}))return true;return false;},[target.x,target.z]);
  if(ok){await page.waitForTimeout(900);const after=(await birds())[target.i];report.flee.after={state:after.state,moved:Math.hypot(after.x-target.x,after.z-target.z)};assert(after.state==='fly'||report.flee.after.moved>.8,'bird flies off');pass('A bird flies off when the player comes close',report.flee);}}

 // Sound: on with sounds on; off the moment the wand's microphone opens.
 await stand(0,16,0,.05);await page.waitForTimeout(400);
 const gate=await page.evaluate(async()=>{const r={};r.allowed=BurbzCalmAudio.birds();await new Promise(ok=>setTimeout(ok,300));r.onBefore=proofYard.birds.soundOn;__testEval("setBurbzMusicSuppressed('sound-scan',true)");r.allowedMic=BurbzCalmAudio.birds();await new Promise(ok=>setTimeout(ok,400));r.onMic=proofYard.birds.soundOn;__testEval("setBurbzMusicSuppressed('sound-scan',false)");await new Promise(ok=>setTimeout(ok,400));r.onAfter=proofYard.birds.soundOn;return r;});
 report.soundGate=gate;assert.equal(gate.allowed,true);assert.equal(gate.onBefore,true);assert.equal(gate.allowedMic,false);assert.equal(gate.onMic,false);assert.equal(gate.onAfter,true);
 pass('Birdsong plays with sounds on and stops while the microphone listens',gate);
 const files=await page.evaluate(async()=>{const out=[];for(const [n,c] of Object.entries(BurbzGardenBirds.SOUNDS))for(let i=1;i<=c;i++){const u='assets/audio/garden-birds/'+n+'-'+String(i).padStart(2,'0')+'.mp3',r=await fetch(u);out.push({u,ok:r.ok,bytes:(await r.arrayBuffer()).byteLength});}return out;});
 assert(files.length===28&&files.every(f=>f.ok&&f.bytes>5000));pass('Every birdsong file the flock names is served',files.length);

 // Wind: perched birds turn to face into it.
 await page.evaluate(()=>{const real=window.__realEnv;BurbzGardenBirds.environment=()=>({...real(),rain:0,lamp:0,hour:10,wind:{speed:.8,x:-.93,z:-.37}});});await page.waitForTimeout(6000);
 const windy=await birds(),into=Math.atan2(.93,.37),perched=windy.filter(b=>b.state==='perch'&&b.kind!=='twig'),off=perched.map(b=>Math.abs(Math.atan2(Math.sin(b.yaw-into),Math.cos(b.yaw-into))));
 report.wind={perched:perched.length,meanOff:off.reduce((a,b)=>a+b,0)/Math.max(1,off.length)};assert(perched.length===0||report.wind.meanOff<.7,'perched birds face the wind');pass('Perched birds face into a strong wind',report.wind);

 // Dusk: the birds go to roost in the tree, and the windows light up.
 await page.evaluate(()=>{const real=window.__realEnv;BurbzGardenBirds.environment=()=>({...real(),lamp:1,hour:22});});await page.waitForTimeout(9000);
 const night=await birds(),roosting=night.filter(b=>b.roost&&b.state==='perch'&&['twig','bough','deck'].includes(b.kind)).length;
 report.night={roosting,states:night.map(b=>b.state+':'+b.kind)};assert(roosting>=8,'birds roost in the tree: '+roosting);
 const glow=await page.evaluate(()=>{let max=0;proofYard.academy.group.traverse(o=>{if(o.material?.isMeshBasicMaterial&&o.material.transparent)max=Math.max(max,o.material.opacity);});return max;});assert(glow>.8,'lit windows '+glow);
 pass('At night the birds roost in the Academy tree and its windows glow',{...report.night,glow});
 await page.evaluate(()=>{BurbzGardenBirds.environment=window.__realEnv;});

 // The Build view looks down through a faded canopy and keeps its birds.
 assert(await stand(3,10,.3,0));await page.waitForTimeout(900);await page.locator('.cw-farm-build:not([hidden])').click();await page.waitForFunction(()=>document.querySelector('#playerHome canvas'));await page.waitForTimeout(2500);await page.screenshot({path:path.join(out,'build-view.png')});
 pass('The Build view opens over the garden with the Academy tree and birds');
 assert.equal(report.errors.length,0,report.errors.join('\n'));report.complete=true;
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{await page.screenshot({path:path.join(out,'failure.png')});}catch{}}finally{fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(report,null,2));await browser?.close();server.server.close();}})();
