const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');const out=path.join(process.env.EVIDENCE_DIR || require('os').tmpdir(),'burbz-dense-settlement-evidence');fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,deviceScaleFactor:1,serviceWorkers:'block'});
await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
await context.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();')}));
const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.stack));
const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
await page.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(1800);if(await page.locator('#introSkipBtn').isVisible())await page.locator('#introSkipBtn').tap();await page.waitForTimeout(900);
const result=await run(()=>{
if(merlinTutActive)endMerlinTutorial(false);markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));burbzDaylightGradeNow=()=>window.BurbzDaylightCore.daylightGradeForHour(13);
const e=ensureEmpireState();e.villages={};e.townCharters=[];e.cityCharters=[];e.regionCharters=[];
const route=window.BurbzSettlementLife.streetRoute;const routes=[];
window.BurbzSettlementLife.streetRoute=(...args)=>{const t=performance.now(),p=route(...args);routes.push({ok:!!p,ms:performance.now()-t,start:args[0],near:p?undefined:args[2].filter(o=>args[0].x>o.minX-1&&args[0].x<o.maxX+1&&args[0].z>o.minZ-1&&args[0].z<o.maxZ+1)});return p;};
for(let i=0;i<9;i++){const seed=101+i,rec={seed,name:'Birch '+i,lat:51.5+i*.002,lon:-.12,claimedAt:new Date(Date.now()+i*1000).toISOString(),liberatedAt:new Date().toISOString(),lastTributeAt:Date.now()};e.villages[seed]=rec;const eco=ensureVillageEconomy(rec);eco.buildings=Object.fromEntries(EMPIRE_BUILDINGS.map(b=>[b.id,b.maxLevel]));eco.population=60;eco.ruins=[];eco.constructions=[];}
for(const seeds of [[101,102,103],[104,105,106],[107,108,109]])e.townCharters.push({seeds,mergedAt:new Date().toISOString()});e.cityCharters.push({seeds:[101,104,107],mergedAt:new Date().toISOString()});saveState();
const info=empireSettlementsInfo(),city=info.cities[0];if(!city)throw Error('Fixture failed to form a city');const t=performance.now();openEmpireTown(city.id);
return {buildMs:performance.now()-t,wards:city.villages.length,buildings:townEconBuildings.filter(o=>o.userData.buildingId).length,residents:settlementResidentActors.town.length,blocked:settlementResidentActors.town.filter(o=>o.userData.pathBlocked).map(o=>o.userData.resident),routes,land:townScene.userData.landRadius};
});
console.log(JSON.stringify(result));await page.waitForTimeout(800);await page.screenshot({path:path.join(out,'city.png')});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({result,errors},null,2));
if(result.wards!==9||result.buildings!==135||result.blocked.length||result.routes.some(r=>!r.ok)||errors.length)throw Error('Dense city failed');
console.log('PASS dense city: all 135 real buildings and doors, bounded resident sample, no errors');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
