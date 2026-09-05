// Local-only seeded browser evidence; no test hooks ship in the game.
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const out=path.join(process.env.EVIDENCE_DIR||require('os').tmpdir(),'forge-v351-evidence');fs.mkdirSync(out,{recursive:true});
for(const [,attrs,code] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\//.test(attrs)&&code.trim())new vm.Script(code);
const checks=[],errors=[];
function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+': '+JSON.stringify(detail));}
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true});try{
const c=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
await c.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
await c.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();')}));
const p=await c.newPage();p.on('pageerror',e=>errors.push(e.stack));
const run=(fn,arg=null)=>p.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
await p.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded',timeout:60000});await p.waitForFunction(()=>!!window.__testEval);await p.waitForTimeout(1000);if(await p.locator('#introSkipBtn').isVisible())await p.locator('#introSkipBtn').tap();await p.waitForTimeout(1100);
await run(()=>{markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));if(merlinTutActive)endMerlinTutorial(false);switchScreen('forge');});
check('default Forge entry opens Craft with decoded anvil artwork',await p.locator('#forgeTabCraft').evaluate(e=>e.classList.contains('active'))&&await p.locator('.forge-anvil-art').evaluate(async e=>{await e.decode();return e.naturalWidth===512&&e.getBoundingClientRect().width>=110;}));
check('three empty anvils use one readable row',await p.locator('.forge-job.empty').count()===1&&(await p.locator('.forge-job.empty').innerText()).includes('3 anvils ready'));
check('missing materials still disable crafting',await p.locator('[onclick="craftGear(\'thorn_talons\')"]').isDisabled());
check('upgrade cost remains behind a native touch disclosure',await p.locator('.forge-upgrade-details').evaluate(e=>!e.open));
await p.locator('.forge-upgrade-details summary').tap();
check('upgrade disclosure reveals the unchanged level price and disabled button',await p.locator('.forge-upgrade-cost').isVisible()&&await p.locator('.forge-upgrade-btn').isDisabled());
await p.locator('.forge-upgrade-details summary').tap();
await p.screenshot({path:path.join(out,'phone-390.png')});
const before=await run(()=>{gameState.player.coins=10000;gameState.player.branches=1000;gameState.inventory.items=Object.fromEntries(Object.keys(lootCore().MATERIALS).map(id=>[id,100]));gameState.forgeJobs=[];gameState.forgeLevel=1;saveState();renderForge();return {coins:gameState.player.coins,items:{...gameState.inventory.items},gear:{...gameState.inventory.gear},recipe:lootCore().recipeFor('thorn_talons')};});
await p.locator('[onclick="craftGear(\'thorn_talons\')"]').tap();
const commissioned=await run(()=>({coins:gameState.player.coins,items:gameState.inventory.items,gear:gameState.inventory.gear,jobs:gameState.forgeJobs}));
check('touch Forge spends exact recipe once and queues timed work without awarding gear',commissioned.coins===before.coins-before.recipe.coins&&Object.entries(before.recipe.materials).every(([k,v])=>commissioned.items[k]===before.items[k]-v)&&commissioned.jobs.length===1&&commissioned.jobs[0].endMs>commissioned.jobs[0].startMs&&JSON.stringify(commissioned.gear)===JSON.stringify(before.gear));
check('working commission exposes 44px cancel and progress',await p.locator('.forge-cancel-btn').evaluate(e=>e.getBoundingClientRect().height>=44)&&await p.locator('[data-forge-bar]').count()===1);
await p.locator('.forge-cancel-btn').tap();
check('cancel restores exact materials and coins',await run(before=>gameState.player.coins===before.coins&&Object.entries(before.items).every(([k,v])=>gameState.inventory.items[k]===v)&&gameState.forgeJobs.length===0,before));
await p.locator('[onclick="craftGear(\'thorn_talons\')"]').tap();
await run(()=>{const j=gameState.forgeJobs[0];j.startMs=Date.now()-60000;j.endMs=Date.now()-1;saveState();renderForge();});
await p.locator('.forge-collect-btn').tap();
check('collect awards one piece and removes the ready job',await run(n=>gameState.inventory.gear.thorn_talons===n+1&&gameState.forgeJobs.length===0,before.gear.thorn_talons||0));
for(let i=0;i<3;i++)await p.locator('[onclick="craftGear(\'thorn_talons\')"]').tap();
check('full queue disables recipes and has no phantom free anvil',await p.locator('.forge-job').count()===3&&await p.locator('.forge-job.empty').count()===0&&await p.locator('[onclick="craftGear(\'thorn_talons\')"]').isDisabled());
while(await p.locator('.forge-cancel-btn').count())await p.locator('.forge-cancel-btn').first().tap();
check('rare recipe still requires a higher hearth',await p.locator('[onclick="craftGear(\'feather_mail\')"]').isDisabled());
const preUpgrade=await run(()=>({coins:gameState.player.coins,branches:gameState.player.branches,items:{...gameState.inventory.items},cost:lootCore().forgeUpgradeCost(1)}));
await p.locator('.forge-upgrade-details summary').tap();await p.locator('.forge-upgrade-btn').tap();
check('upgrade spends exact cost and unlocks rare recipes',await run(v=>gameState.forgeLevel===2&&gameState.player.coins===v.coins-v.cost.coins&&gameState.player.branches===v.branches-v.cost.branches&&Object.entries(v.cost.materials).every(([k,n])=>gameState.inventory.items[k]===v.items[k]-n),preUpgrade)&&!(await p.locator('[onclick="craftGear(\'feather_mail\')"]').isDisabled()));
await p.locator('#forgeTabEquip').tap();
check('Equip tab remains selected while interacting',await run(()=>forgeState.tab==='equip')&&await p.locator('.forge-slot').count()===5);
await p.locator('[onclick="forgeOpenSlot(\'weapon\')"]').tap();
await p.locator('[onclick="forgeEquip(\'weapon\',\'thorn_talons\')"]').tap();
check('existing gear can still be equipped to Merlin',await run(()=>birdLoadout(MERLIN_GUIDE.id).weapon==='thorn_talons'));
await run(()=>openForge('equip'));check('explicit Equip entry stays on Equip',await run(()=>forgeState.tab==='equip'));
await run(()=>{switchScreen('inventory');switchScreen('forge');});check('return entry restores Craft',await run(()=>forgeState.tab==='craft'));
await run(()=>{gameState.forgeLevel=5;renderForge();});
check('maximum hearth has no extra paid upgrade',await p.locator('.forge-upgrade-btn').count()===0&&(await p.locator('.forge-workshop').innerText()).includes('Sunfire Forge'));
for(const width of [320,360,390,768]){
 await p.setViewportSize({width,height:width===320?568:844});
 for(const tab of ['craft','materials','equip']){
  await p.locator('#forgeTab'+tab[0].toUpperCase()+tab.slice(1)).tap();
  check(width+'px '+tab+' fits without horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 }
 await p.locator('#forgeTabCraft').tap();
 check(width+'px Forge actions remain at least 44px',await p.locator('.forge-craft-btn').evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)));
 if(width===320)await p.screenshot({path:path.join(out,'phone-320.png')});
}
await p.emulateMedia({reducedMotion:'reduce'});await run(()=>{gameState.forgeJobs=[{id:'ready-proof',gearId:'thorn_talons',startMs:Date.now()-60000,endMs:Date.now()-1}];renderForge();});
check('reduced motion ready job uses a static highlight',await p.locator('.forge-job.ready').evaluate(e=>getComputedStyle(e).animationName==='none'));
check('Forge journeys have no JavaScript page errors',errors.length===0,errors);
fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,errors},null,2));
}finally{await b.close();}})().catch(e=>{fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({checks,errors,error:e.stack},null,2));console.error(e);process.exitCode=1;});
