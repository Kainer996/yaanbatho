#!/usr/bin/env node
// Real touch regression against a disposable fixture of the actual game.
// See BROWSER_CARD_SWIPE_20260907.md for the fixture/server and invocation.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_CORE_PATH || 'playwright');
const URL = process.env.BURBZ_URL || 'http://127.0.0.1:8792/burbz/after.html';
assert(['localhost','127.0.0.1','[::1]'].includes(new global.URL(URL).hostname), 'Use disposable localhost state only');
const OUT = process.env.BURBZ_EVIDENCE_DIR || '/tmp/burbz-card-swipe';
fs.mkdirSync(OUT,{recursive:true});
const checks=[];
const check=(name,condition)=>{assert(condition,name); checks.push(name); console.log('PASS '+name);};
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
 const page=await context.newPage();const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(URL,{waitUntil:'domcontentloaded'});
 await page.waitForSelector('body[data-qa-ready=true]',{timeout:60000});
 await page.waitForFunction(()=>[...document.querySelectorAll('.bird-equip-art')].every(i=>i.complete&&i.naturalWidth>0&&i.previousElementSibling.hidden),null,{timeout:60000});
 const cdp=await context.newCDPSession(page);
 const tick=()=>page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const touch=(type,x=0,y=330)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'||type==='touchCancel'?[]:[{x,y,id:1}]});
 const move=async(x,y=330)=>{await touch('touchMove',x,y);await tick();};
 const settled=async()=>{await page.waitForFunction(()=>!birdEquipSwipeAnimating&&!birdEquipSwipe.gesture);await tick();};
 const current=()=>page.evaluate(()=>birdEquipState.birdId);
 const open=async(id='qa-0')=>{await page.evaluate(id=>{openBirdEquip(id);document.querySelector('.bird-equip-scroll').scrollTop=0;window.qaHaptics=[];},id);await tick();};
 const swipe=async(direction=-1)=>{const x=direction<0?310:70;await touch('touchStart',x);for(let i=1;i<=4;i++)await move(x+direction*i*40);await touch('touchEnd');await settled();};
 const sample=()=>page.evaluate(()=>{
  const v=document.querySelector('#birdEquipViewport').getBoundingClientRect();
  const panels=[...document.querySelectorAll('#birdEquipTrack > .bird-equip-panel')];
  const intervals=panels.map(p=>{const r=p.getBoundingClientRect();return [Math.max(v.left,r.left),Math.min(v.right,r.right)]}).filter(([l,r])=>r>l).sort((a,b)=>a[0]-b[0]);
  let right=v.left,gap=0;for(const [l,r] of intervals){gap+=Math.max(0,l-right);right=Math.max(right,r);}gap+=Math.max(0,v.right-right);
  return {gap,opacity:panels.map(p=>getComputedStyle(p).opacity),x:new DOMMatrixReadOnly(getComputedStyle(document.querySelector('#birdEquipTrack')).transform).m41};
 });
 await page.evaluate(()=>{
  window.qaFrames=[];window.qaSampling=true;
  const frame=()=>{if(!window.qaSampling)return;const v=$('birdEquipViewport').getBoundingClientRect();const panels=[...$('birdEquipTrack').children];const ranges=panels.map(p=>{const r=p.getBoundingClientRect();return [Math.max(v.left,r.left),Math.min(v.right,r.right)]}).filter(([l,r])=>r>l).sort((a,b)=>a[0]-b[0]);let end=v.left,gap=0;for(const [l,r] of ranges){gap+=Math.max(0,l-end);end=Math.max(end,r)}gap+=Math.max(0,v.right-end);qaFrames.push({gap,x:new DOMMatrixReadOnly(getComputedStyle($('birdEquipTrack')).transform).m41,opacity:panels.every(p=>getComputedStyle(p).opacity==='1')});requestAnimationFrame(frame)};requestAnimationFrame(frame);
 });
 await page.evaluate(()=>{window.qaIncoming=$('birdEquipTrack').querySelector('[data-delta="1"]');window.qaPortrait=qaIncoming.querySelector('img.bird-equip-art');});
 await page.screenshot({path:path.join(OUT,'swipe-01-start.png')});
 await touch('touchStart',310);
 for(const [i,x] of [270,230,190,150].entries()){await move(x);const s=await sample();check('drag frame '+i+' is fully covered and opaque',s.gap<1&&s.opacity.every(o=>o==='1'));await page.screenshot({path:path.join(OUT,'swipe-0'+(i+2)+'-drag.png')});}
 check('no tick during movement',(await page.evaluate(()=>qaHaptics.length))===0);
 await touch('touchEnd');await settled();
 await page.screenshot({path:path.join(OUT,'swipe-06-committed.png')});
 check('incoming panel and decoded artwork survive commit',await page.evaluate(()=>$('birdEquipBody')===qaIncoming&&qaIncoming.querySelector('img.bird-equip-art')===qaPortrait&&qaPortrait.naturalWidth>0));
 check('one small tick on commit',await page.evaluate(()=>qaHaptics.length===1&&qaHaptics[0]===8));
 check('next companion selected',await current()==='qa-1');
 const frames=await page.evaluate(()=>{qaSampling=false;return qaFrames});
 check('all sampled drag/settle frames have continuous opaque coverage',frames.length>10&&frames.every(f=>f.gap<1&&f.opacity)&&frames.some(f=>f.x<-175&&f.x>-360));
 fs.writeFileSync(path.join(OUT,'intermediate-frames.json'),JSON.stringify(frames,null,2));
 await swipe(1);check('reverse swipe returns to previous companion',await current()==='qa-0');
 await swipe(1);check('existing wrap from first to last is preserved',await current()==='qa-3');
 await swipe(-1);check('existing wrap from last to first is preserved',await current()==='qa-0');
 await open();await touch('touchStart',310);await move(190);await touch('touchCancel');await settled();check('cancel past threshold never commits or ticks',await page.evaluate(()=>birdEquipState.birdId==='qa-0'&&qaHaptics.length===0));
 await touch('touchStart',310);await move(180);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:180,y:330,id:1},{x:230,y:330,id:2}]});
 await touch('touchCancel');await settled();check('multitouch cancels without a commit',await page.evaluate(()=>birdEquipState.birdId==='qa-0'&&qaHaptics.length===0));
 await touch('touchStart',310);await move(180);await touch('touchCancel');
 check('post-drag synthetic click cannot activate favorite',await page.evaluate(()=>{const b=$('birdEquipBody').querySelector('.bird-equip-fav');const before=b.getAttribute('aria-pressed');b.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:1}));return $('birdEquipBody').querySelector('.bird-equip-fav').getAttribute('aria-pressed')===before}));await settled();
 await touch('touchStart',220);await move(190);await touch('touchEnd');await settled();check('short drag returns home',await current()==='qa-0');
 await touch('touchStart',280);await move(160);await move(280);await move(315);await touch('touchEnd');await settled();check('direction reversal below threshold cancels',await current()==='qa-0');
 // Regrab an active settle on the same frame. Its current rendered position is frozen.
 await touch('touchStart',310);await move(150);await touch('touchEnd');
 await touch('touchStart',120);check('settling motion can be grabbed',await page.evaluate(()=>!!birdEquipSwipe.gesture&&!birdEquipSwipeAnimating));
 await move(340);await touch('touchEnd');await settled();check('regrab/reverse leaves a valid centered card',(await sample()).x===0);
 for(let i=0;i<6;i++)await swipe(i%2?1:-1);check('six consecutive gestures stay bounded to three panels',await page.locator('#birdEquipTrack > .bird-equip-panel').count()===3);
 await open();await page.locator('#birdEquipBody .full-card-facts').evaluate(el=>el.open=true);await touch('touchStart',200,520);await move(201,340);await touch('touchEnd');await settled();check('vertical drag scrolls full back without changing companion',await page.evaluate(()=>birdEquipState.birdId==='qa-0'&&document.querySelector('.bird-equip-scroll').scrollTop>40));
 await page.locator('#birdEquipBody .bird-equip-slot').first().click();check('loadout button opens real picker',await page.locator('#birdEquipSlotPicker').count()===1);
 await open();await page.locator('#birdEquipBody .bird-equip-fav').click();check('portrait favourite remains tappable',await page.locator('#birdEquipBody .bird-equip-fav').getAttribute('aria-pressed')==='true');
 await page.keyboard.press('ArrowRight');await settled();check('keyboard advances companion',await current()==='qa-1');
 await page.locator('#birdEquipBody [aria-label="Next companion"]').click();await settled();check('desktop pager button advances companion',await current()==='qa-2');
 await page.evaluate(()=>$('birdEquipOverlay').querySelector('.bird-equip-close').focus());await page.keyboard.press('Shift+Tab');check('focus stays in active panel',await page.evaluate(()=>!!document.activeElement.closest('#birdEquipBody')&&!document.activeElement.closest('[inert]')));
 await open();await touch('touchStart',310);await move(140);await page.evaluate(()=>{closeBirdEquip();openBirdEquip('qa-2')});await touch('touchEnd');await settled();check('close/reopen clears pending gesture',await current()==='qa-2');
 await open();await touch('touchStart',310);await move(130);await touch('touchEnd');await page.evaluate(()=>{window.qaRoster=gameState.flock;gameState.flock=gameState.flock.filter(b=>b.id!=='qa-1');renderBirdEquip()});await settled();check('data refresh cannot commit removed neighbor',await current()==='qa-0');
 await page.evaluate(()=>{gameState.flock=qaRoster;renderBirdEquip()});
 await open();await page.evaluate(()=>{gameState.flock=gameState.flock.slice(0,1);renderBirdEquip()});await swipe();check('one bird has no motion or pager',await page.evaluate(()=>birdEquipState.birdId==='qa-0'&&$('birdEquipTrack').children.length===1&&!$('birdEquipBody').querySelector('.bird-equip-pager')&&qaHaptics.length===0));
 await page.evaluate(()=>{gameState.flock=[];renderBirdEquip()});check('empty roster has no stale neighbor',await page.locator('#birdEquipTrack > .bird-equip-panel').count()===1);
 await page.evaluate(()=>{gameState.flock=qaRoster;});await open();
 await page.emulateMedia({reducedMotion:'reduce'});await swipe();check('reduced motion commits without an animation',await page.evaluate(()=>birdEquipState.birdId==='qa-1'&&$('birdEquipTrack').getAnimations().length===0));await page.emulateMedia({reducedMotion:'no-preference'});
 await page.evaluate(()=>gameState.settings.vibration=false);await open();await swipe();check('vibration preference disables ticks',await page.evaluate(()=>qaHaptics.length===0));
 await page.evaluate(()=>{gameState.settings.vibration=true;Object.defineProperty(navigator,'vibrate',{configurable:true,value:undefined})});await swipe();check('unsupported haptics still changes card',await current()==='qa-2');
 // Exercise actual failed and pending <img> loads with a reserved fallback.
 await page.route('**/qa-missing-art.png',r=>r.fulfill({status:404,body:''}));
 await page.evaluate(()=>__testEval("window.qaCardArt=birdCardImgAttrs;birdCardImgAttrs=b=>b.id==='qa-1'?{src:'qa-missing-art.png'}:window.qaCardArt(b);"));
 await page.evaluate(()=>{window.qaArt=getBirdArtUrl;getBirdArtUrl=b=>b.id==='qa-1'?'qa-missing-art.png':qaArt(b);});await open();
 await page.waitForFunction(()=>$('birdEquipTrack').querySelector('[data-delta="1"] .bird-equip-art').hidden);
 await swipe();check('failed image retains a visible same-size fallback',await page.evaluate(()=>{const i=$('birdEquipBody').querySelector('.bird-equip-art'),f=i.previousElementSibling;return i.hidden&&!f.hidden&&f.getBoundingClientRect().height>=168}));
 await page.screenshot({path:path.join(OUT,'failed-portrait-fallback.png')});
 let releaseImage;const slow=new Promise(resolve=>releaseImage=resolve);
 await page.route('**/qa-slow-art.png',async r=>{await slow;await r.fulfill({status:404,body:''})});
 await page.evaluate(()=>__testEval("birdCardImgAttrs=b=>b.id==='qa-1'?{src:'qa-slow-art.png'}:window.qaCardArt(b);"));
 await page.evaluate(()=>{getBirdArtUrl=b=>b.id==='qa-1'?'qa-slow-art.png':qaArt(b)});await open();await swipe();check('pending image never empties the portrait frame',await page.evaluate(()=>{const i=$('birdEquipBody').querySelector('.bird-equip-art');return !i.complete&&!i.previousElementSibling.hidden&&i.previousElementSibling.getBoundingClientRect().height>=168}));releaseImage();
 await page.evaluate(()=>__testEval('birdCardImgAttrs=window.qaCardArt'));
 await page.evaluate(()=>{getBirdArtUrl=qaArt});await open();
 // Appearance v362 loads both scoped themes. On older bases, enable the
 // preserved Comic stylesheet only while testing Comic, including its fonts.
 const comic=await page.addStyleTag(process.env.BURBZ_COMIC_CSS ? {content:fs.readFileSync(process.env.BURBZ_COMIC_CSS,'utf8')} : {url:new global.URL('comic_ui.css',URL).href});
 await comic.evaluate(el=>el.sheet.disabled=true);
 for(const width of [320,390,430,1100]){
  await page.setViewportSize({width,height:844});
  for(const theme of ['normal','comic']){
   await comic.evaluate((el,theme)=>el.sheet.disabled=theme!=='comic',theme);
   await page.evaluate(theme=>{document.documentElement.dataset.appearance=theme;document.body.classList.toggle('comic-ui',theme==='comic');document.body.classList.toggle('woodland-ui',theme==='normal')},theme);await open();await swipe();
   check(theme+' '+width+'px fits with centered track',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth&&new DOMMatrixReadOnly(getComputedStyle($('birdEquipTrack')).transform).m41===0));
   if(theme==='comic')check('Comic stylesheet is active at '+width+'px',await page.locator('.bird-equip-overlay').evaluate(el=>getComputedStyle(el).color)==='rgb(21, 40, 40)');
   if(width===390)await page.screenshot({path:path.join(OUT,theme+'-390.png')});
  }
 }
 check('no page errors',errors.length===0);
 fs.writeFileSync(path.join(OUT,'checks.json'),JSON.stringify({checks,errors,frames:frames.length},null,2));
 console.log(checks.length+' browser checks passed; '+frames.length+' intermediate frames inspected.');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
