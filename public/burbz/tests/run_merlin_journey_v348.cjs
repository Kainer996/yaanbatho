const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('fs'),path=require('path');
const out=path.join(process.env.EVIDENCE_DIR || require('os').tmpdir(),'burbz-merlin-journey-evidence-'+(process.env.PHONE_WIDTH||390));fs.mkdirSync(out,{recursive:true});
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8');
const checks=[];function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+': '+JSON.stringify(detail));}
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH || undefined,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
let page;
try{
const context=await browser.newContext({viewport:{width:Number(process.env.PHONE_WIDTH||390),height:Number(process.env.PHONE_HEIGHT||844)},isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
await context.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();')}));
await context.addInitScript(()=>localStorage.setItem('burbzIntroSeen:two-part-hf-20260729','1'));
page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));
const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
const care=()=>run(()=>({...getMerlinCare(),rations:ensureLarder().small_bird_prey_ration}));
const title=()=>page.locator('#merlinTutorialTitle').textContent();
async function at(text){await page.waitForFunction(text=>document.getElementById('merlinTutorialTitle')?.textContent===text,text,{timeout:20000});check(text,true);}
async function next(){await page.locator('#merlinTutorialNext').tap();await page.waitForTimeout(350);}
await page.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded'});
await page.waitForTimeout(1500);
if(await page.locator('#introSkipBtn').isVisible()) await page.locator('#introSkipBtn').tap();
await at('A kingdom in darkness');await next();await at('Only you can save us');await next();await at('I am Merlin, your friend');await next();await at('Come and see to me');
await page.locator('#petSprite').tap();await at('Food, cheer and energy');await next();await at('A falcon’s proper meal');await next();await at('Feed me!');
let before=await care();await page.locator('#merlinFeedBtn').tap();await at('That is how you feed me');let after=await care();check('real meal lowers hunger and spends one ration',after.hunger<before.hunger&&after.rations===before.rations-1,{before,after});
await next();await at('A little play?');before=await care();await page.locator('#merlinPlayBtn').tap();await at('Time for a wizard nap');after=await care();check('real play lifts cheer and costs energy',after.happiness>before.happiness&&after.energy===before.energy-12,{before,after});
check('play breather is disabled',await page.locator('#merlinPlayBtn').isDisabled());
before=await care();await page.locator('#merlinRestBtn').tap();after=await care();check('sleep starts with saved deadline and no immediate reward',after.restEndsAt> Date.now()&&after.energy===before.energy&&after.bondXp===before.bondXp,{before,after});
check('sleep visibly disables care',await page.locator('#merlinRestBtn').isDisabled()&&await page.locator('#merlinFeedBtn').isDisabled()&&await page.locator('#merlinPlayBtn').isDisabled());
check('nap appearance and countdown',await page.locator('.merlin-perch-assembly.merlin-resting').count()===1&&(await page.locator('#merlinCareMood').textContent()).includes('Wizard nap'));
await page.screenshot({path:path.join(out,'phone-resting.png')});
await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(800);
let saved=await care();check('reload preserves the same nap or its one completion',saved.restEndsAt===after.restEndsAt||saved.lastRestedAt===after.restEndsAt,{saved});
if(saved.restEndsAt){await at('Time for a wizard nap');await at('Ready for an adventure');}else{if(await title()==='Time for a wizard nap')await next();await at('Ready for an adventure');}
saved=await care();check('nap finishes exactly once',saved.energy===100&&!saved.restEndsAt&&saved.bondXp===before.bondXp+3,{before,saved});
check('rested button prevents repeat reward',await page.locator('#merlinRestBtn').isDisabled());
await page.screenshot({path:path.join(out,'phone-rested.png')});await next();await at('Our first little quest');await next();await at('Never stuck for a task');
await page.locator('.nav-item[data-screen="quests"]').tap();await at('Player Quests');await next();await at('Kingdom Errands');await next();await at('Send me out!');
await page.locator('[data-expedition-template="merlin_first_flight"]').tap();
await page.locator('#questOverlay.open [data-quest-bird-id="merlin-guide"]').tap();
await page.screenshot({path:path.join(out,'phone-dispatch.png')});await page.locator('#questSendBtn').tap();await at('Now we wait — briefly');
check('first quest uses the existing expedition and empty perch',await run(()=>merlinIsAway()&&ensureBirdExpeditions().some(q=>q.templateId==='merlin_first_flight')));
await next();await page.locator('#expeditionQuestList .quest-away-card .quest-claim-btn').first().waitFor({state:'visible',timeout:30000});
const claimBox=await page.locator('#expeditionQuestList .quest-away-card .quest-claim-btn').first().boundingBox();
await page.touchscreen.tap(claimBox.x+claimBox.width/2,claimBox.y+claimBox.height/2);
await page.waitForFunction(()=>window.__testEval('tutorialFlowState().errandClaimed===true'));
check('claim grants reward and returns Merlin',await run(()=>tutorialFlowState().errandClaimed&&!merlinIsAway()));
await at('Back with a prize!');await next();await at('To the Academy!');
await page.locator('.nav-item[data-screen="academy"]').tap();await at('Your Academy');await next();await at('A gift for the Barracks');await next();await at('Build the Barracks');
await page.locator('.academy-building-card[data-building="tavern"] .academy-build-btn').tap();
await page.locator('#academyTreehouse').tap({position:{x:150,y:120}});await at('The Barracks stands!');
check('first building is real and paid for by the guided gift',await run(()=>isAcademyRoomBuilt('tavern')));
await next();await at('Home and the Kitchen');await next();await at('Heal, train and charm');await next();await at('Out to the world');
await page.locator('.nav-item[data-screen="map"]').tap();await at('Your live map');await next();await at('Real-life quests');await next();await at('Off you go, my friend');
check('opening ends with a gentle, concrete invitation', (await page.locator('#merlinTutorialText').textContent()).includes('when you are ready'));
await next();
const regularBird=await run(()=>{
  if(merlinTutActive)endMerlinTutorial(false);markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));
  const b=createBirdEntry('European Robin','Erithacus rubecula',.96);
  rememberDiscoveredBird(b,{silent:true});const rec=getDiscoveredRecordForSpecies(b.species);rec.discoveredAt='2026-08-01T12:00:00Z';
  gameState.player.coins=10000;recruitDiscoveredBird(rec.key);return gameState.flock[gameState.flock.length-1].id;
});
await page.locator('#captureOverlay.show').waitFor();
check('ordinary bird receives a personal welcome and sourced field note',(await page.locator('#captureWelcome').textContent()).includes('new friend')&&(await page.locator('#captureOverlay .card-name').textContent()).includes('Robin'));
await page.waitForTimeout(3000);await page.screenshot({path:path.join(out,'ordinary-bird-welcome.png')});
page.once('dialog',d=>d.accept('Bramble'));
await page.locator('#captureNameBtn').tap();
check('new companion can be named without losing species identity',(await page.locator('#captureCardWrapper .card-nickname').textContent())==='Bramble'&&(await page.locator('#captureCardWrapper .card-name').textContent()).includes('Robin'));
await page.locator('#captureDismiss').tap();await page.waitForTimeout(500);await run(id=>openBirdInfo(id),regularBird);
check('real discovery history and bond are visible',/1 Aug 2026|Aug 1, 2026/.test(await page.locator('.bird-personal-story').textContent())&&(await page.locator('.bird-personal-story').textContent()).includes('Bramble'));
await page.screenshot({path:path.join(out,'ordinary-bird-story.png')});
await page.locator('.bird-personal-story button').tap();
check('personal meal action opens the real feed sheet',await page.locator('.feed-sheet-head').isVisible());
await run(()=>saveState());await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);await page.waitForTimeout(900);
check('ordinary companion name and discovery survive reload',await run(id=>{const b=gameState.flock.find(b=>b.id===id);return b?.customName==='Bramble'&&getDiscoveredRecordForSpecies(b.species)?.discoveredAt==='2026-08-01T12:00:00Z';},regularBird));
check('no phone document overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
check('no browser errors',!errors.length,errors);
}catch(e){if(page){console.log('CURRENT',await page.locator('body').innerText().catch(()=>''));await page.screenshot({path:path.join(out,'failed.png')}).catch(()=>{});}throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(checks,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
