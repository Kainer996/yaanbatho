/* Browser proof for the calm sound bus (v492). Real game page in Chromium with
 * a disposable save: every sound runs through one AudioContext, the music is
 * carried by a gain node rather than element volume, the soundscape starts on
 * the first touch and hushes for the microphone and for mute, and a tap
 * leaves no page errors. Chromium audio, not a physical-phone listen.
 * Run: EVIDENCE_DIR=/tmp/v492 PLAYWRIGHT_MODULE=... CHROMIUM_PATH=... node tests/run_asmr_sound_v492.cjs
 */
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright'),F=require('./connected_world_fixture_v386.cjs');
const root=path.resolve(__dirname,'..'),out=process.env.EVIDENCE_DIR||'/tmp/burbz-asmr-sound-v492';fs.mkdirSync(out,{recursive:true});
const report={served:{},missing:[],checks:[],errors:[],limits:['Chromium with a disposable save; no physical-phone listen.']};
const server=F.createServer({root,port:Number(process.env.PORT||8988),report,seed:F.SEED});let browser,page;
const run=code=>page.evaluate(code=>__testEval(code),code),pass=(name,detail)=>{report.checks.push({name,detail});console.log('PASS',name);};
(async()=>{try{
 await server.listen();browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH||'/opt/pw-browsers/chromium-1194/chrome-linux/chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,serviceWorkers:'block'});await F.routeMap(context,report);
 page=await context.newPage();page.setDefaultTimeout(20000);page.on('pageerror',e=>report.errors.push(e.message));
 await page.goto(server.url,{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.__testEval&&__testEval('currentScreen')==='scan');
 await run(`if(merlinTutActive)endMerlinTutorial(false);`);
 const shared=await run(`({bus:!!SFX.bus,same:SFX.bus===BurbzAudioCore.sharedBus(),ctx:getAudioCtx()===SFX.bus.ctx,scape:!!window.BurbzSoundscape})`);
 assert.deepEqual(shared,{bus:true,same:true,ctx:true,scape:true});pass('One AudioContext carries the interface, the listener and the soundscape',shared);
 await page.mouse.click(195,420);await page.waitForTimeout(800);
 const primed=await run(`({state:SFX.bus.ctx.state,scape:BurbzSoundscape.playing})`);
 assert.equal(primed.state,'running');assert.equal(primed.scape,true);
 pass('The first touch wakes the bus and starts the soundscape',primed);
 await run(`gameState.settings.music=true;musicEnabled=true;MUSIC.setEnabled(true);MUSIC.start()`);await page.waitForFunction(()=>__testEval('MUSIC.getAudios().length')>0,null,{timeout:10000});
 const music=await run(`(()=>{const a=MUSIC.getAudios()[0];return{tracks:MUSIC.getAudios().length,volume:MUSIC.volume,elementVolume:a.volume}})()`);
 assert.equal(music.tracks,1,'a resting song needs one deck');assert(music.volume<=.05,'music sits low');assert(music.elementVolume===0||music.elementVolume===1,'element volume is a switch; the gain node rides');
 pass('Music is carried by the bus at its quiet level',music);
 const hush=await run(`(()=>{sfxEnabled=false;const off=BurbzSoundscape.tick();sfxEnabled=true;burbzMicListening=true;const mic=BurbzSoundscape.tick();burbzMicListening=false;const back=BurbzSoundscape.tick();return{off,mic,back};})()`);
 assert.equal(hush.off,null);assert.equal(hush.mic,null);assert.equal(hush.back,'menu');pass('The soundscape hushes for mute and for Merlin\'s wand',hush);
 const fx=await page.evaluate(async()=>{const out={};for(const n of ['tap','page','unlock','coins','error','build','questComplete'])out[n]=await __testEval(`SFX.play('${n}',{cooldown:0})`);return out;});
 for(const [k,v] of Object.entries(fx))assert.equal(v,true,k);pass('Every interface sound plays on the bus',fx);
 assert.deepEqual(report.errors,[]);pass('No page errors',{});
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));console.log('PASS asmr sound v492');
}catch(e){report.errors.push(String(e&&e.stack||e));fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,1));console.error(e);process.exitCode=1;}finally{await browser?.close();server.server.close();}})();
