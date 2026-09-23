'use strict';
// Isolated local integration proof: real Chromium HTMLAudioElement + unchanged MP3.
// Synthetic old save and map fixture, eval observer hook; not owner/physical-device/public acceptance.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'/home/ubuntu/node_modules/playwright');
const F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/root/.hermes/task-progress/tonight-release-20260923/music-evidence';
fs.mkdirSync(out,{recursive:true});
const report={checks:[],served:{},missing:[],errors:[],samples:[],limits:['Desktop Chromium with touch/mobile emulation, not physical iOS/Android.','Synthetic old save and map data; native media/network decoder/clock/playback and app handlers.','Service workers blocked; parent owns installed/offline and public acceptance.']};
const policyProbe=process.env.MUSIC_POLICY_PROBE==='1';
const seed=F.SEED.replace('music:false','music:true').replace("f.lastKnownHome=null;","f.playerHome.anchor={lat:54.45,lon:-2.65,revision:1,source:'chosen'};f.lastKnownHome=null;")+(policyProbe?"\nif(!sessionStorage.getItem('music-policy-probed')){sessionStorage.setItem('music-policy-probed','1');window.musicPolicyResult=MUSIC.start().then(ok=>({ok,decks:MUSIC.getAudios().map(a=>({paused:a.paused,volume:a.volume}))}));}":'');
const server=F.createServer({root,port:Number(process.env.PORT||8987),report,seed});
// Media seeking needs real byte-range responses, unlike the generic fixture server.
const serveFixture=server.server.listeners('request')[0];server.server.removeAllListeners('request');
server.server.on('request',(req,res)=>{
 const pathname=new URL(req.url,server.url).pathname;
 if(pathname!=='/burbz/assets/audio/bgm-burbz-quest-v2.mp3')return serveFixture(req,res);
 const bytes=fs.readFileSync(path.join(root,'assets/audio/bgm-burbz-quest-v2.mp3'));
 report.musicSHA256=F.sha(bytes);res.setHeader('Content-Type','audio/mpeg');res.setHeader('Accept-Ranges','bytes');
 const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
 if(range){const start=+range[1],end=range[2]?Math.min(+range[2],bytes.length-1):bytes.length-1;if(start>=bytes.length){res.writeHead(416,{'Content-Range':`bytes */${bytes.length}`});return res.end();}res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${bytes.length}`,'Content-Length':end-start+1});return res.end(bytes.subarray(start,end+1));}
 res.setHeader('Content-Length',bytes.length);res.end(bytes);
});
let browser,context,page;
const run=code=>page.evaluate(code=>__testEval(code),code);
const pass=name=>{report.checks.push(name);console.log('PASS',name);};
const snap=()=>run(`({suppressed:MUSIC.isSuppressed(),target:MUSIC.volume,wanted:MUSIC.wanted,decks:MUSIC.getAudios().map(a=>({src:a.currentSrc,paused:a.paused,muted:a.muted,volume:a.volume,time:a.currentTime,duration:a.duration,ready:a.readyState,rate:a.playbackRate,error:a.error?.code||null}))})`);
const level=s=>s.decks.reduce((n,a)=>n+(!a.paused&&!a.muted?a.volume:0),0);
async function sample(label){const s=await snap();report.samples.push({label,...s});return s;}
async function silence(label){const s=await sample(label);assert.ok(s.decks.every(a=>a.paused&&a.volume===0),label);}
async function settled(){await page.waitForFunction(()=>__testEval('MUSIC.getAudios().some(a=>!a.paused&&!a.muted&&a.volume>=0.199)'));}
async function settings(){await page.locator('#settingsBtn').click();await page.locator('#settingsModal.show').waitFor();}
(async()=>{try{
 await server.listen();browser=await chromium.launch({channel:'chromium',headless:true,args:['--no-sandbox','--autoplay-policy=user-gesture-required','--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 report.browser=browser.version();context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,serviceWorkers:'block',permissions:['microphone']});
 await F.routeMap(context,report);
 await context.addInitScript(()=>{
  window.musicProof={plays:[],microphones:[],gestures:[]};
  for(const type of ['pointerdown','click','keydown'])window.addEventListener(type,e=>{const event={type,trusted:e.isTrusted,active:navigator.userActivation.isActive};musicProof.gestures.push(event);musicProof.currentGesture=event;queueMicrotask(()=>{musicProof.currentGesture=null;});},true);
  const nativePlay=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){const el=this,music=el.src.includes('bgm-burbz-quest-v2.mp3'),record={src:el.src,gesture:window.event?{type:window.event.type,trusted:window.event.isTrusted}:null,active:navigator.userActivation.isActive,at:performance.now(),muted:el.muted,volume:el.volume};if(music){window.musicProof.decks||=[];if(!musicProof.decks.includes(el))musicProof.decks.push(el);record.deck=musicProof.decks.indexOf(el);musicProof.plays.push(record);}const p=nativePlay.call(el);if(music)p.then(()=>{record.result='resolved';},e=>{record.result=e.name;});return p;};
  const gum=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=function(c){musicProof.microphones.push((musicProof.decks||[]).map(a=>({paused:a.paused,muted:a.muted,volume:a.volume})));return gum(c);};
 });
 page=await context.newPage();page.on('pageerror',e=>report.errors.push(e.message));page.setDefaultTimeout(30000);
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');
 const preserved=await run('JSON.stringify({player:gameState.player,home:gameState.playerHome,flock:gameState.flock,quests:gameState.quests,inventory:gameState.inventory})');
 if(policyProbe){report.autoplay=await page.evaluate(()=>musicPolicyResult);assert.equal(report.autoplay.ok,false);assert.ok(report.autoplay.decks.every(a=>a.paused&&a.volume===0));
 assert.ok((await page.evaluate(()=>musicProof.plays)).some(p=>p.result==='NotAllowedError'));pass('Real Chromium autoplay policy rejects non-gesture play and leaves a retryable silent controller');}
 else {assert.equal((await snap()).decks.length,0);pass('Old saved profile boots without any music play before the first trusted gesture');}
 await page.touchscreen.tap(180,35);await settled();let s=await sample('trusted touch settled');
 assert.equal(s.decks.length,2);assert.ok(s.decks.every(a=>a.duration>0&&a.ready>=2&&a.rate===1&&!a.error&&a.src.endsWith('/assets/audio/bgm-burbz-quest-v2.mp3')));
 const plays=await page.evaluate(()=>musicProof.plays);assert.ok([0,1].every(i=>plays.some(p=>p.deck===i&&p.result==='resolved')));if(!policyProbe)assert.ok([0,1].every(i=>plays.some(p=>p.deck===i&&p.result==='resolved'&&p.gesture?.trusted&&['pointerdown','click'].includes(p.gesture.type))));pass('Trusted touch resolves BOTH actual MP3 decks; decode/normal playback rate confirmed');
 const t=s.decks.find(a=>!a.paused).time;await page.waitForTimeout(400);assert.ok((await snap()).decks.some(a=>!a.paused&&a.time>t));pass('Real media currentTime advances');
 // Observe ramps at app settings controls, not fabricated Audio objects.
 await settings();await page.locator('#toggleMusic').click();s=await sample('disable immediate');assert.ok(level(s)>0);
 await page.waitForTimeout(350);s=await sample('disable midpoint');assert.ok(level(s)>0&&level(s)<0.2);await page.waitForTimeout(700);await silence('disable endpoint');
 await page.locator('#toggleMusic').click();s=await sample('enable immediate');assert.ok(level(s)<0.05);await page.waitForTimeout(650);s=await sample('enable midpoint');assert.ok(level(s)>0&&level(s)<0.2);await settled();pass('Native Settings music off/on fades out/in at intermediate and final gains');
 await page.locator('#replayIntroBtn').click();await silence('intro immediate');await page.locator('#introSkipBtn').click();await settled();pass('Native Replay intro suppresses music immediately; Skip resumes fade');
 // Actual continuous scanner with Chromium fake input (no real microphone or provider calls).
 await run("if(merlinTutActive)endMerlinTutorial(false,{pause:true});");
 await page.locator('.nav-item[data-screen="scan"]').click();
 const sound=page.locator('#scanBtn');await sound.click();
 await page.waitForFunction(()=>musicProof.microphones.length>0);await silence('scanner capture');
 assert.ok((await page.evaluate(()=>musicProof.microphones)).every(ds=>ds.length===2&&ds.every(a=>a.paused&&a.volume===0)));
 await run('stopContinuousSoundListening({userStop:true})');await settled();pass('Music is synchronously paused at zero BEFORE actual getUserMedia; scanner release fades back');
 // Seek real decoded media to exercise the existing five-second two-deck loop.
 await run('MUSIC.getAudio().currentTime=MUSIC.getAudio().duration-4.9');
 await page.waitForFunction(()=>__testEval('MUSIC.getAudios().filter(a=>!a.paused&&a.volume>0.01).length===2'));
 s=await sample('real seam midpoint');assert.ok(Math.abs(level(s)-0.2)<0.015);await page.waitForTimeout(5300);s=await sample('real seam complete');assert.equal(s.decks.filter(a=>!a.paused).length,1);pass('Actual decoded-song seam overlaps both decks then retires outgoing deck');
 // Native media target-volume ramp is sampled without renderer scheduling noise.
 await run('MUSIC.setVolume(0)');s=await sample('volume target immediate');assert.ok(level(s)>0);await page.waitForTimeout(180);s=await sample('volume target midpoint');assert.ok(level(s)>0&&level(s)<0.2);await page.waitForTimeout(400);assert.equal(level(await sample('volume target endpoint')),0);await run('MUSIC.setVolume(0.2)');await settled();
 await run("switchScreen('map')");await page.waitForFunction(()=>__testEval('liveMapReady&&!!liveMap'));await run('liveMap.setZoom(BURBZ_START_ZOOM)');await settled();
 await run('liveMap.setZoom(BURBZ_MUSIC_SILENT_ZOOM)');await page.waitForTimeout(650);assert.equal(level(await sample('map zoom endpoint')),0);
 await run("switchScreen('scan')");await settled();pass('Native target-volume ramp has intermediate gains; real MapLibre zoom callback attenuates and leaving map restores base');
 // Lifecycle is dispatched explicitly; unit tests also exercise stale-promise races.
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await silence('BFCache pagehide');await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await settled();pass('BFCache pagehide suppresses immediately and pageshow restores');
 const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');await cdp.send('Page.setWebLifecycleState',{state:'frozen'});await cdp.send('Page.setWebLifecycleState',{state:'active'});
 // Exact native visibility event requires a background tab in headed browsers; flag emulated event explicitly.
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await silence('hidden lifecycle event');
 await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});await settled();pass('Visibility handler immediate suppression (hidden property injected in headless)');
 assert.equal(await run('JSON.stringify({player:gameState.player,home:gameState.playerHome,flock:gameState.flock,quests:gameState.quests,inventory:gameState.inventory})'),preserved);pass('Music/settings/intro/scanner/zoom lifecycle preserves synthetic old player/home/flock/quests/inventory');
 report.mainSession=await page.evaluate(()=>({plays:musicProof.plays,gestures:musicProof.gestures,microphones:musicProof.microphones}));
 await run('gameState.settings.music=false;saveState()');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');await page.touchscreen.tap(180,35);assert.equal((await snap()).decks.length,0);assert.equal(await run('musicEnabled'),false);pass('Old music:false save reload stays silent after a real gesture');
 await settings();await page.locator('#toggleMusic').click();await page.locator('#toggleMusic').click();await page.locator('#toggleMusic').click();await settled();pass('Old muted save can enable and quickly reverse fade using native controls');
 report.firstSession=await page.evaluate(()=>({plays:musicProof.plays,gestures:musicProof.gestures,microphones:musicProof.microphones}));
 await run('delete gameState.settings.music;saveState()');await page.reload({waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');
 assert.equal(await run('musicEnabled'),true);assert.equal((await snap()).decks.length,0);await page.touchscreen.tap(180,35);await settled();
 assert.equal(await run('JSON.stringify({player:gameState.player,home:gameState.playerHome,flock:gameState.flock,quests:gameState.quests,inventory:gameState.inventory})'),preserved);pass('Legacy save without music setting retains original true default, requires gesture after reload, and preserves old progression/possessions');
 report.native=await page.evaluate(()=>({plays:musicProof.plays,gestures:musicProof.gestures,microphones:musicProof.microphones}));
 await page.screenshot({path:path.join(out,'music-settings.png')});
 await page.evaluate(()=>window.dispatchEvent(new PageTransitionEvent('pagehide',{persisted:false})));assert.equal((await snap()).decks.length,0);await page.touchscreen.tap(180,35);assert.equal((await snap()).decks.length,0);pass('Terminal disposal prevents later gestures resurrecting music');
 report.complete=true;
}catch(e){report.failure=e.stack;console.error(e);process.exitCode=1;try{report.last=await snap();report.native=await page.evaluate(()=>({plays:musicProof.plays,gestures:musicProof.gestures,microphones:musicProof.microphones}));await page.screenshot({path:path.join(out,'failure.png')});}catch{}}
finally{fs.writeFileSync(path.join(out,'native-results.json'),JSON.stringify(report,null,2));await browser?.close();await new Promise(r=>server.server.close(r));}})();
