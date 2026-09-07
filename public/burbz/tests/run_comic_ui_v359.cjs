const fs=require('fs'),path=require('path'),assert=require('assert');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const base=process.env.BURBZ_URL || 'http://127.0.0.1:8765/burbz/';
const out=process.env.EVIDENCE_DIR || '/tmp/burbz-comic-ui-v359';
fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
const mode=process.argv[2]||'verified';
function contrastAudit(){
 const rgb=s=>{const n=s.match(/[\d.]+/g);return n?n.map(Number):[0,0,0,0]};
 const blend=(f,b)=>f.slice(0,3).map((v,i)=>v*(f[3]??1)+b[i]*(1-(f[3]??1)));
 const lum=c=>c.slice(0,3).map(n=>{n/=255;return n<=.04045?n/12.92:Math.pow((n+.055)/1.055,2.4)}).reduce((v,n,i)=>v+n*[.2126,.7152,.0722][i],0);
 const rows=[];
 for(const e of document.querySelectorAll('body *')){
  if(![...e.childNodes].some(n=>n.nodeType===3&&/[A-Za-z0-9]/.test(n.textContent))||e.closest('svg,script,style'))continue;
  const r=e.getBoundingClientRect(),s=getComputedStyle(e);if(r.width<1||r.height<1||r.right<0||r.left>=innerWidth||r.bottom<=0||r.top>=innerHeight||s.visibility==='hidden'||e.closest('[disabled],.disabled,.is-locked'))continue;
  let chain=[],el=e,opacity=1;while(el){const cs=getComputedStyle(el);opacity*=Number(cs.opacity);chain.push(cs);el=el.parentElement;}if(opacity<.8)continue;
  let bg=[255,255,255];for(const cs of chain.reverse())bg=blend(rgb(cs.backgroundColor),bg);
  const fg=blend(rgb(s.color),bg),a=lum(fg),b=lum(bg),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
  const min=parseFloat(s.fontSize)>=24||(parseFloat(s.fontSize)>=18.66&&Number(s.fontWeight)>=700)?3:4.5;
  if(ratio<min)rows.push({id:e.id,cls:e.className,text:e.textContent.trim().slice(0,65),ratio:+ratio.toFixed(2),fg:s.color,bg:bg.map(Math.round),font:s.fontSize});
 }
 return rows.slice(0,60);
}
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH,args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true,serviceWorkers:'block',reducedMotion:'reduce'});
 await context.route('**/*',r=>r.request().url().startsWith(new URL(base).origin+'/')?r.continue():r.abort());
 const html=fs.readFileSync(root+'/index.html','utf8').replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();');
 await context.route(base,r=>r.fulfill({contentType:'text/html',body:html}));
 const page=await context.newPage(),errors=[],results=[];page.on('pageerror',e=>errors.push(e.message));
 const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
 try{
  await page.goto(base,{waitUntil:'domcontentloaded'});await page.waitForTimeout(1400);
  if(await page.locator('#introSkipBtn').isVisible())await page.locator('#introSkipBtn').tap();
  await page.waitForTimeout(700);
  await run(()=>{markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));if(merlinTutActive)endMerlinTutorial(false);startMerlinTutorial=()=>{};Object.assign(gameState.player,{level:12,coins:123457,branches:4321,stone:123});gameState.flock=['Great Spotted Woodpecker','Carrion Crow','Hooded Crow','Common Kestrel'].map((sp,i)=>({id:'comic-test-'+i,species:sp,commonName:sp,rarity:'common',hp:400,maxHp:400,atk:45,def:45,spd:40+i*6,int:50,cha:50,stamina:70,level:5,hunger:100,energy:100,mood:100,health:100}));saveState();updateHeader();});
  await run(()=>gameState.flock.forEach(b=>b.artUrl=getBirdArtUrl(b)));
  await page.evaluate(()=>document.fonts.ready);
  for(const screen of (mode==='combat-only'?[]:['map','quests','birdex','scan','academy','inventory','forge','battle','profile','diary','leaderboards','village'])){
   await run(s=>switchScreen(s),screen);await page.waitForTimeout(450);await page.evaluate(()=>document.querySelectorAll('.toast,.tutorial-nav-pointer').forEach(e=>e.style.visibility='hidden'));
   await page.screenshot({path:path.join(out,'screenshots',mode+'-'+screen+'.png')});
   results.push(await page.evaluate(s=>({screen:s,active:document.querySelector('.screen.active')?.id,overflow:document.documentElement.scrollWidth>innerWidth,fonts:[...new Set([...document.querySelectorAll('.screen.active *')].slice(0,500).map(e=>getComputedStyle(e).fontFamily))],surfaces:[...document.querySelectorAll('.screen.active *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>200&&r.height>40&&r.top<innerHeight&&r.bottom>0}).map(e=>({tag:e.tagName,cls:e.className,id:e.id,bg:getComputedStyle(e).backgroundColor,image:getComputedStyle(e).backgroundImage.slice(0,100),color:getComputedStyle(e).color,text:e.textContent.trim().slice(0,65)})).slice(0,45)}),screen));
   results[results.length-1].contrast=await page.evaluate(contrastAudit);
  }
  await run(()=>openBirdEquip(gameState.flock[0].id));await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'screenshots',mode+'-companion.png')});results.push({screen:'companion',contrast:await page.evaluate(contrastAudit)});await run(()=>closeBirdEquip());
  await run(()=>{switchScreen('quests');openQuestSend('branch_run');});await page.waitForTimeout(100);await page.screenshot({path:path.join(out,'screenshots',mode+'-send.png')});results.push({screen:'send',contrast:await page.evaluate(contrastAudit)});await run(()=>closeQuestOverlay());
  await page.locator('#settingsBtn').tap();await page.waitForTimeout(100);await page.screenshot({path:path.join(out,'screenshots',mode+'-settings.png')});
  await run(()=>closeTopBurbzLayer());
  await run(()=>{for(const id of Object.keys(BurbzAcademy3D.ANCHORS))gameState.academyBuildings[id]={built:true,builtAt:'test'};});
  for(const room of ['kitchen','hospital','training','library','magpie_market','manager_office']){
    await run(id=>openAcademyRoom(id),room);await page.waitForTimeout(150);await page.screenshot({path:path.join(out,'screenshots',mode+'-room-'+room+'.png')});results.push({screen:'room-'+room,contrast:await page.evaluate(contrastAudit)});
  }
  await run(()=>{switchScreen('map');openMerlinCareMenu();});await page.screenshot({path:path.join(out,'screenshots',mode+'-care.png')});await run(()=>closeMerlinCareMenu());
  await run(()=>{switchScreen('battle');battleSelectedIds=gameState.flock.slice(0,4).map(b=>b.id);renderBattleSelect();});
  await page.locator('#battleStartBtn').tap();await page.waitForSelector('#arenaPlayerRow .arena-unit');await page.waitForTimeout(1300);
  for(const [w,h] of [[390,844],[360,780],[360,667],[320,568],[844,390],[1280,900]]){
    await page.setViewportSize({width:w,height:h});await page.waitForTimeout(160);
    await page.screenshot({path:path.join(out,'screenshots',mode+'-arena-'+w+'x'+h+'.png')});
    results.push(await page.evaluate(()=>({screen:'arena',w:innerWidth,h:innerHeight,arenaScroll:document.getElementById('battleArena').scrollHeight-document.getElementById('battleArena').clientHeight,buttons:[...document.querySelectorAll('#arenaActions button')].map(e=>({text:e.textContent.trim(),bottom:e.getBoundingClientRect().bottom,height:e.getBoundingClientRect().height})),navTop:document.getElementById('bottomDock').getBoundingClientRect().top})));
  }

  for(const r of results){
    assert(!r.overflow,'horizontal overflow: '+r.screen);
    if(r.screen==='arena'){assert(r.arenaScroll<=1,'arena scroll at '+r.w+'x'+r.h);assert(r.buttons.length>0);assert(r.buttons.every(b=>b.bottom<=r.navTop && b.height>=44),'buttons fit and remain tappable');}
  }
  // Real aim/cancel/cast path, including the smallest phone and landscape.
  const hpBefore=await run(()=>battleState.battle.teams.opponent.map(f=>f.hp));
  for(const [w,h] of [[320,568],[844,390]]){
    await page.setViewportSize({width:w,height:h});
    await page.locator('#arenaActions .move-btn').first().tap();
    await page.waitForSelector('#battleAimCast');
    const fit=await page.evaluate(()=>{const r=document.getElementById('battleAimCast').getBoundingClientRect();return {top:r.top,bottom:r.bottom,nav:document.getElementById('bottomDock').getBoundingClientRect().top,scroll:document.getElementById('battleArena').scrollHeight-document.getElementById('battleArena').clientHeight};});
    await page.screenshot({path:path.join(out,'screenshots',mode+'-aim-'+w+'x'+h+'.png')});
    assert(fit.top>=0&&fit.bottom<=fit.nav&&fit.scroll<=1,'aim controls fit '+JSON.stringify(fit));
    await page.locator('#battleAimCancel').tap();
    assert.deepEqual(await run(()=>battleState.battle.teams.opponent.map(f=>f.hp)),hpBefore,'cancel is free');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#arenaActions .move-btn').first().tap();
  await page.locator('#battleAimSlider').focus();
  await page.locator('#battleAimSlider').press('End');
  await page.locator('#battleAimCast').tap();
  await page.waitForFunction(before=>window.__burbzArenaDebug.battle().teams.opponent.some((f,i)=>f.hp<before[i]),hpBefore,{timeout:15000});
  await page.waitForTimeout(4500);
  await page.waitForFunction(()=>{const b=window.__burbzArenaDebug.battle();return b.phase==='act'&&b.acting?.side==='player'&&document.querySelector('#arenaActions .move-btn');});
  await page.locator('#unit_player_1').tap();
  await page.locator('#arenaActions .move-btn').first().tap();
  await page.locator('#unit_opponent_0').tap();
  await page.waitForSelector('#arenaActions .attack-confirm-btn');
  for(const [w,h] of [[320,568],[844,390]]){
    await page.setViewportSize({width:w,height:h});
    const fit=await page.evaluate(()=>({bottom:document.querySelector('#arenaActions .attack-confirm-btn').getBoundingClientRect().bottom,nav:document.getElementById('bottomDock').getBoundingClientRect().top,scroll:document.getElementById('battleArena').scrollHeight-document.getElementById('battleArena').clientHeight}));
    await page.screenshot({path:path.join(out,'screenshots',mode+'-confirm-'+w+'x'+h+'.png')});
    assert(fit.bottom<=fit.nav&&fit.scroll<=1,'attack confirmation fits '+JSON.stringify(fit));
  }
  await page.locator('#arenaActions .attack-confirm-btn').tap();
  await page.waitForTimeout(4500);
  results.push({screen:'combat-interactions',aimCancelledWithoutDamage:true,aimCastDamagedOpponent:true,physicalTargetAndConfirm:true});
  // Render an isolated victory fixture through the actual result/reward handler.
  await page.setViewportSize({width:390,height:844});
  await run(()=>{battleState.battle.phase='over';battleState.battle.winner='player';endPerchBattle();});
  await page.evaluate(()=>document.querySelectorAll('.toast,.tutorial-nav-pointer').forEach(e=>e.style.visibility='hidden'));
  await page.screenshot({path:path.join(out,'screenshots',mode+'-victory.png')});
  assert(await page.locator('#battleAgainBtn').isVisible());
  results.push({screen:'victory-fixture',contrast:await page.evaluate(contrastAudit)});
  assert.deepEqual(errors,[]);
 }finally{fs.writeFileSync(path.join(out,mode+'-results.json'),JSON.stringify({results,errors},null,2));await browser.close();}
 console.log(JSON.stringify({mode,screens:results.length,errors}));
})().catch(e=>{console.error(e);process.exitCode=1});
