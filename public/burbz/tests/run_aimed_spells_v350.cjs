const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const fs=require('fs'),path=require('path'),vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'../index.html'),'utf8'),out=path.join(process.env.EVIDENCE_DIR||require('os').tmpdir(),'burbz-aim-v350-evidence');fs.mkdirSync(out,{recursive:true});
for(const [,attrs,code] of source.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi))if(!/src=|application\//.test(attrs)&&code.trim())new vm.Script(code);
const checks=[];function check(name,ok,detail){checks.push({name,ok:!!ok,detail});console.log((ok?'PASS ':'FAIL ')+name);if(!ok)throw Error(name+': '+JSON.stringify(detail));}
(async()=>{
const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});let page;
try{
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2,serviceWorkers:'block'});
await context.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:8765/')?r.continue():r.abort());
await context.route('http://127.0.0.1:8765/burbz/',r=>r.fulfill({contentType:'text/html',body:source.replace('\ninit();','\nwindow.__testEval=code=>eval(code);\ninit();')}));
page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.stack));
const run=(fn,arg=null)=>page.evaluate(([fn,arg])=>window.__testEval('('+fn+')('+JSON.stringify(arg)+')'),[fn.toString(),arg]);
await page.goto('http://127.0.0.1:8765/burbz/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>!!window.__testEval);
if(await page.locator('#introSkipBtn').isVisible())await page.locator('#introSkipBtn').tap();
await page.waitForTimeout(1100);
await run(()=>{markMerlinChaptersSeen(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id));if(merlinTutActive)endMerlinTutorial(false);window.__castProof=[];window.__flightProof=[];const core=battleCore(),resolve=core.resolveAction;core.resolveAction=(b,a)=>{const events=resolve(b,a);window.__castProof.push({a,events,cd:b.teams.player[0].skills.map(s=>s.cdLeft),hp:b.teams.opponent.map(f=>f.hp)});return events;};const draw=battleDrawAim;battleDrawAim=(p,t)=>{const ok=draw(p,t),dot=$('battleAimOverlay').querySelector('.aim-projectile');if(dot)window.__flightProof.push({t,x:+dot.getAttribute('cx'),y:+dot.getAttribute('cy'),hp:p.b.teams.opponent.map(f=>f.hp)});return ok;};});
async function setup(){return run(()=>{
  switchScreen('battle');const core=battleCore(),f=core.buildFighter({...merlinBattleBird(),mag:80,atk:40,hp:600,maxHp:600,spd:100});
  f.skills=[{...core.PECK,cdLeft:0},...['frost_sigil','ember_wisp','tempest_scroll'].map(id=>({...lootCore().spellSkillFor(id),gearId:id,cdLeft:0}))];
  const rival=leagueRivalOpponents().opponents;
  const foes=Array.from({length:4},(_,i)=>{const o=core.buildOpponentFighter(rival[i%rival.length],0,'aim-'+i);o.hp=o.maxHp=600;o.def=o.res=40;return o;});
  const b=core.createBattle({playerFighters:[f],opponentFighters:foes,seed:'browser-aim'});b.phase='act';b.turn=1;b.acting={side:'player',index:0};b.turnHolder={side:'player',index:0};
  battleState={battle:b,busy:false,pendingSkillIndex:null,pendingTargetIndex:null};$('battleSelect').style.display='none';$('battleResult').style.display='none';$('battleArena').style.display='';$('battleArena').classList.add('live');$('battleLog').innerHTML='';window.__castProof=[];window.__flightProof=[];renderArena();return b.teams.opponent.map(f=>f.hp);
});}
async function select(i){await page.locator('#arenaActions button[onclick="battleSelectSkill('+i+')"]').tap();await page.waitForSelector('#battleAimSlider');}
async function tapCard(i){const r=await page.locator('#unit_opponent_'+i+' .au-art').boundingBox();await page.touchscreen.tap(r.x+r.width/2,r.y+r.height/2);}
await setup();await select(3);await page.waitForTimeout(150);
check('spell selection opens a generous aim control without spending cooldown',await run(()=>battleState.battle.teams.player[0].skills[3].cdLeft===0&&$('battleAimSlider').getBoundingClientRect().height>=44&&$('battleAimCast').getBoundingClientRect().height>=44));
const range=await page.locator('#battleAimSlider').boundingBox(),cdp=await context.newCDPSession(page);
await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:range.x+8,y:range.y+range.height/2}]});
for(let i=1;i<=6;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:range.x+8+(range.width-16)*i/12,y:range.y+range.height/2}]});
await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
check('real phone drag changes the aimed bird and previews actual neighbours',await run(()=>battleState.pendingTargetIndex>0&&battleAimPlan().hits.length===3&&document.querySelectorAll('.splash-target').length===2&&window.__castProof.length===0));
check('rendered SVG markers coincide with bird artwork in screen pixels',await run(()=>{const p=battleAimPlan(),svg=$('battleAimOverlay'),circle=svg.querySelector('circle'),target=battleArtPoint('opponent',p.index),point=new DOMPoint(+circle.getAttribute('cx'),+circle.getAttribute('cy')).matrixTransform(svg.getScreenCTM());return Math.hypot(point.x-target.x,point.y-target.y)<1;}));
await page.screenshot({path:path.join(out,'phone-aim-preview.png')});
await page.locator('#battleAimCancel').tap();check('cancel spends neither turn nor cooldown',await run(()=>battleState.battle.turn===1&&battleState.battle.phase==='act'&&battleState.battle.teams.player[0].skills.every(s=>s.cdLeft===0)&&$('battleAimPanel').hidden));
await select(2);await run(()=>handleBurbzBackPress());check('back cancels aiming before leaving the battle',await run(()=>currentScreen==='battle'&&$('battleAimPanel').hidden&&battleState.battle.phase==='act'));
await select(2);await run(()=>switchScreen('inventory'));check('screen navigation clears the viewport aim overlay without spending a turn',await run(()=>currentScreen==='inventory'&&$('battleAimOverlay').style.display==='none'&&battleState.battle.turn===1&&battleState.battle.teams.player[0].skills.every(s=>s.cdLeft===0)));await setup();
await select(1);await tapCard(2);
await page.evaluate(()=>{const b=document.getElementById('battleAimCast');b.click();b.click();b.click();});
await run(()=>switchScreen('inventory'));check('navigation waits for the committed spell flight to finish',await run(()=>currentScreen==='battle'&&battleState.aimFlight));
await page.waitForFunction(()=>window.__castProof.length===1);
const direct=await run(()=>({proof:window.__castProof[0],flight:window.__flightProof,hit:[...document.querySelectorAll('.spell-hit')].map(e=>e.id),target:battleArtPoint('opponent',2)}));
check('Frost flight ends at the aimed bird before damage resolves',direct.flight.length>1&&direct.flight[0].hp.every(h=>h===600)&&direct.flight.at(-1).hp.every(h=>h===600)&&Math.hypot(direct.flight.at(-1).x-direct.target.x,direct.flight.at(-1).y-direct.target.y)<1,direct.flight);
check('rapid cast taps resolve once and damage only the aimed enemy',direct.proof.events.filter(e=>e.type==='damage').length===1&&direct.proof.events.find(e=>e.type==='damage').targetIndex===2&&direct.proof.cd[1]===2,direct.proof);
check('damaged bird receives one visible hit pulse',direct.hit.includes('unit_opponent_2'),direct.hit);
await page.waitForTimeout(850);await setup();await select(3);await tapCard(1);await page.locator('#battleAimCast').tap();await page.waitForFunction(()=>window.__castProof.length===1);
const splash=await run(()=>({proof:window.__castProof[0],hit:[...document.querySelectorAll('.spell-hit')].map(e=>e.id)}));
check('Tempest applies real damage and feedback to primary and adjacent cards',JSON.stringify(splash.proof.events.filter(e=>e.type==='damage').map(e=>e.targetIndex))==='[1,0,2]'&&splash.hit.length===3&&splash.proof.hp[3]===600,splash);
await page.screenshot({path:path.join(out,'phone-splash-impact.png')});
await page.waitForTimeout(850);await setup();await select(2);await run(()=>{battleCastAimed();battleState.battle.teams.opponent[0].fainted=true;});await page.waitForTimeout(850);
check('a removed target cancels the flight without a fallback hit or charge',await run(()=>window.__castProof.length===0&&battleState.battle.teams.player[0].skills[2].cdLeft===0&&!battleState.busy));
await setup();await select(3);await page.setViewportSize({width:320,height:740});await page.waitForTimeout(200);
const layout=await run(()=>{const r=$('battleAimCast').getBoundingClientRect(),nav=document.querySelector('.bottom-nav').getBoundingClientRect(),p=battleAimPlan();return {bottom:r.bottom,nav:nav.top,width:document.documentElement.scrollWidth,viewport:innerWidth,points:p.hits.map(h=>battleArtPoint('opponent',h.index)),path:$('battleAimOverlay').querySelector('path')?.getAttribute('d')};});
check('320px resize keeps cast reachable and curve anchored to current geometry',layout.width<=layout.viewport&&layout.bottom<=layout.nav&&layout.points.every(p=>p.x<320)&&!!layout.path,layout);
await page.screenshot({path:path.join(out,'small-phone-aim.png')});
await page.emulateMedia({reducedMotion:'reduce'});await page.locator('#battleAimCast').tap();await page.waitForFunction(()=>window.__castProof.length===1);
check('reduced motion uses a single static hit highlight',await page.evaluate(()=>{const art=document.querySelector('.spell-hit .au-art');return art&&getComputedStyle(art).animationName==='none';}));
await page.waitForTimeout(850);
// Real client state stays unchanged when a photo is inconclusive, including a
// legacy found:true response that lacks the new evidence acceptance marker.
const photo=await run(async()=>{const originalFetch=window.fetch,originalPosition=getCurrentPositionForPhotoId;getCurrentPositionForPhotoId=async()=>null;const results=[];for(const result of [{found:false,message:'Bird not found. Try a closer, clearer photo.'},{found:true,species:'Kestrel',confidence:.5}]){const before=JSON.stringify(gameState);window.fetch=async()=>({ok:true,json:async()=>result});await identifyImage(new Blob(['fixture']));results.push(before===JSON.stringify(gameState));}window.fetch=originalFetch;getCurrentPositionForPhotoId=originalPosition;return results;});
check('inconclusive photo attempts leave collection, resources and quests unchanged',photo.every(Boolean),photo);
check('no JavaScript errors',errors.length===0,errors);
}catch(e){if(page)await page.screenshot({path:path.join(out,'failed.png')}).catch(()=>{});throw e;}finally{await browser.close();fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(checks,null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
