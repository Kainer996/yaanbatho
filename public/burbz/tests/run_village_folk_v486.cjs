// Village folk v486 in a real phone browser: every villager and animal is one
// skinned mesh, pen animals graze inside their rails, hens peck the cobbles,
// carts keep their horse and their pusher, and the scene stays error free.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');
const out=path.join(process.env.EVIDENCE_DIR || require('os').tmpdir(),'burbz-village-folk-v486-evidence');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const checks=[];function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+': '+JSON.stringify(detail));}
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true,args:process.env.RENDER_BACKEND==='native'?['--use-angle=d3d11']:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});let page;
try{
const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true,reducedMotion:'no-preference',serviceWorkers:'block'});
await context.addInitScript(()=>{Date.prototype.getHours=()=>13;});
await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
await context.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();')}));
page=await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.stack));
const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
await page.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(1800);
if(await page.locator('#introSkipBtn').isVisible().catch(()=>false))await page.locator('#introSkipBtn').tap();await page.waitForTimeout(900);
await run(()=>{
  markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));if(merlinTutActive)endMerlinTutorial(false);
  burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);
  Object.assign(gameState.player,{coins:1000000,branches:100000,stone:100000,level:12});
  const empire=ensureEmpireState();empire.villages={};empire.townCharters=[];empire.cityCharters=[];
  for(const seed of [101,102,103]){
    const rec={seed,name:'Alder '+seed,lat:51.5+(seed-101)*.002,lon:-.12,claimedAt:new Date().toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};empire.villages[String(seed)]=rec;
    const eco=ensureVillageEconomy(rec);eco.buildings={cabin:3,well:2,cottages:1,hut:1,minehut:1,lumberhut:1,tavern:1,farm:2};eco.population=24;eco.ruins=[];eco.constructions=[];
  }saveState();openEmpireVillage(101);
});
await page.waitForSelector('#villageStage canvas');await page.waitForTimeout(800);

const cast=await run(()=>{
  const skinned=o=>{let s=0,plain=0;o.traverse(n=>{if(n.isSkinnedMesh)s++;else if(n.isMesh)plain++;});return {s,plain};};
  const people=[...(settlementResidentActors.village||[]),...villageNpcs.filter(o=>o.userData.humanoidRig)];
  const animals=[...villageLivestock,...villageChickens,...villageNpcs.filter(o=>o.userData.dogRig||o.userData.animalKind==='cat')];
  return {
    skinning:window.BurbzSettlementModels.skinningSupported(),
    people:people.map(o=>({id:o.userData.resident?.id||o.userData.npc?.role,...skinned(o.userData.humanoidRig.body)})),
    animals:animals.map(o=>({kind:o.userData.animalKind,name:o.userData.animalName,...skinned(o)})),
    pens:villageLivestock.map(o=>({kind:o.userData.livestockKind,muzzle:!!o.userData.muzzle,pen:o.userData.pen})),
    hens:villageChickens.filter(o=>o.userData.animalKind!=='cat').length,
    carts:villageTraffic.map(o=>({horse:!!o.userData.horse,pusher:!!o.userData.pusher,horseDrawn:!!o.userData.horseDrawn})),
  };
});
check('the phone browser skins characters on the GPU',cast.skinning,cast.skinning);
check('every villager is one skinned mesh',cast.people.length>0&&cast.people.every(p=>p.s===1),cast.people);
check('every animal is one skinned mesh with a name',cast.animals.length>0&&cast.animals.every(a=>a.s===1&&a.name),cast.animals);
check('pens hold rigged livestock with a real muzzle',cast.pens.length>0&&cast.pens.every(p=>p.muzzle&&p.pen),cast.pens);
check('hens strut the village',cast.hens>0,cast.hens);
check('every cart keeps its horse or its pusher',cast.carts.every(c=>c.horseDrawn?c.horse:c.pusher),cast.carts);

// Thirty seconds of village life at 30 frames a second.
const life=await run(()=>{
  const pens=villageLivestock.map(o=>({o,start:o.position.clone(),out:0,walked:0,crab:0,low:Infinity})),hens=villageChickens.filter(o=>o.userData.animalKind!=='cat').map(o=>({o,start:o.position.clone(),low:Infinity}));
  const nose=new THREE.Vector3(),prev=new THREE.Vector3(),step=new THREE.Vector3(),p=new THREE.Vector3();
  const t0=performance.now()/1000;
  for(let f=0;f<900;f++){
    const t=t0+f/30;
    for(const a of pens)a.last=a.o.position.clone();
    villageAnimateLivestockActors(villageLivestock,t,1);
    villageChickens.forEach(ch=>window.BurbzVillageAnimals.small(ch,t,1));
    for(const a of pens){
      const u=a.o.userData;step.copy(a.o.position).sub(a.last);
      if(step.length()>1e-5){a.walked+=step.length();nose.set(1,0,0).applyQuaternion(a.o.quaternion);if(nose.dot(step.normalize())<.95)a.crab++;}
      a.out=Math.max(a.out,Math.abs(a.o.position.x)-u.pen.hw,Math.abs(a.o.position.z)-u.pen.hd);
      a.o.updateMatrixWorld(true);u.muzzle.getWorldPosition(p);a.o.parent.getWorldPosition(prev);a.low=Math.min(a.low,p.y-prev.y);
    }
    for(const h of hens){h.o.updateMatrixWorld(true);(h.o.userData.beak||h.o.userData.neck).getWorldPosition(p);h.o.parent.getWorldPosition(prev);h.low=Math.min(h.low,p.y-prev.y-h.o.position.y);}
  }
  return {pens:pens.map(a=>({kind:a.o.userData.livestockKind,walked:+a.walked.toFixed(3),crab:a.crab,out:+a.out.toFixed(4),low:+a.low.toFixed(3)})),hens:hens.map(h=>({moved:+h.o.position.distanceTo(h.start).toFixed(3),low:+h.low.toFixed(3)}))};
});
check('pen animals wander their pens',life.pens.some(a=>a.walked>.2),life.pens);
check('pen animals walk head first',life.pens.every(a=>a.crab===0),life.pens);
check('pen animals stay inside their rails',life.pens.every(a=>a.out<=1e-6),life.pens);
check('grazing puts muzzles on the grass',life.pens.some(a=>a.low<.2),life.pens);
check('hens wander and peck the ground',life.hens.some(h=>h.moved>.05)&&life.hens.some(h=>h.low<.08),life.hens);

// Close-ups for the eye, and the whole village for the draw count.
const shots=await run(()=>{
  const list=[],p=new THREE.Vector3();
  const tag=(o,label)=>{if(!o)return;o.getWorldPosition(p);list.push({label,x:p.x,y:p.y,z:p.z});};
  tag((settlementResidentActors.village||[]).find(o=>o.visible),'villager');
  tag(villageNpcs.find(o=>o.userData.npc?.role==='guard'),'guard');
  tag(villageNpcs.find(o=>o.userData.dogRig),'dog');
  tag(villageLivestock[0],'pen');
  tag(villageChickens.find(o=>o.userData.animalKind!=='cat'),'hens');
  tag(villageTraffic.find(o=>o.userData.horseDrawn),'horse-cart');
  tag(villageTraffic.find(o=>!o.userData.horseDrawn),'handcart');
  return list;
});
for(const item of shots){
  await run(({item})=>{Object.assign(villageCam,{tx:item.x,tz:item.z,dist:/pen|cart/.test(item.label)?4.5:/hens/.test(item.label)?2.4:3.2,polar:.9,azimuth:.6,lastInputAt:Date.now()+1e9});villageAnimateFrame(performance.now()/1000);},{item});
  await page.waitForTimeout(250);
  await page.screenshot({path:path.join(out,item.label+'.png'),clip:await page.locator('#villageStage canvas').boundingBox()});
}
const draws=await run(()=>{Object.assign(villageCam,{tx:0,tz:0,dist:16,polar:.95,azimuth:.4,lastInputAt:Date.now()+1e9});villageAnimateFrame(performance.now()/1000);villageRenderer.render(villageScene,villageCamera);return villageRenderer.info.render.calls;});
await page.screenshot({path:path.join(out,'village.png')});
console.log('village draw calls',draws);
check('the page stays free of script errors',errors.length===0,errors);
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({checks,draws},null,1));
console.log('evidence',out);
}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
