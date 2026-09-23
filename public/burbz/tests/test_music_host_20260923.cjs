const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const core = require('../audio_core.js');
const html = fs.readFileSync(require('node:path').join(__dirname, '../index.html'), 'utf8');
const host = html.slice(html.indexOf('const MUSIC ='), html.indexOf('// Conservative default for controls'));
const zoomHost = html.slice(html.indexOf('function syncBurbzMusicForMapZoom()'), html.indexOf('window.__burbzMapDebug'));
const flush = async () => { for (let i=0;i<16;i++) await Promise.resolve(); };
function fixture(rejectIncoming = false) {
  let time=0, id=0, config;
  const audios=[], timers=new Map(), listeners={};
  class Audio {
    constructor(src) { Object.assign(this,{src,paused:true,muted:false,volume:1,currentTime:0,duration:60,rate:1,calls:0,reject:rejectIncoming && audios.length===1}); audios.push(this); }
    play() { this.calls++; if(this.reject) return Promise.reject(Error('blocked')); this.paused=false; return Promise.resolve(); }
    pause() { this.paused=true; }
    addEventListener() {} removeEventListener() {}
  }
  const listen=(type,fn,opts)=>{(listeners[type]||=[]).push({fn,opts});};
  const window={addEventListener:listen,BurbzAudioCore:{...core,createMusicManager(opts){config=opts;return core.createMusicManager({...opts,Audio,now:()=>time,setTimeout:(fn,ms)=>{timers.set(++id,{fn,at:time+ms});return id;},clearTimeout:id=>timers.delete(id)});}}};
  const document={hidden:false,addEventListener:listen};
  const context=vm.createContext({window,document,Promise,SFX:{prime:()=>Promise.resolve(true)},musicEnabled:true,BURBZ_MUSIC_BASE_VOLUME:0.2,BURBZ_START_ZOOM:16.35,BURBZ_MUSIC_SILENT_ZOOM:19.1,currentScreen:'map',liveMap:{getZoom:()=>19.1}});
  vm.runInContext(host+zoomHost+';globalThis.manager=MUSIC;',context);
  return {audios,timers,context,document,get config(){return config;},manager:context.manager,
    emit(type,event={isTrusted:true,type}){for(const item of [...listeners[type]||[]]){item.fn(event);if(item.opts?.once)listeners[type]=listeners[type].filter(x=>x!==item);}},
    tick(ms){const end=time+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;time=next[1].at;timers.delete(next[0]);next[1].fn();}time=end;}
  };
}
const level=f=>f.audios.reduce((n,a)=>n+(a.paused||a.muted?0:a.volume),0);
const silent=f=>assert.ok(f.audios.every(a=>a.paused&&a.volume===0),'all music decks synchronously silent');
test('host explicitly configures entrance, exit and target-volume ramps; song and seam unchanged',()=>{
 const f=fixture();assert.equal(f.config.fadeInMs,1600);assert.equal(f.config.fadeOutMs,900);assert.equal(f.config.volumeRampMs,450);assert.equal(f.config.crossfadeSeconds,5);assert.equal(f.config.src,'assets/audio/bgm-burbz-quest-v2.mp3');
});
test('synthetic gestures cannot start or prime music',async()=>{
 const f=fixture();f.emit('pointerdown',{isTrusted:false,type:'pointerdown'});f.emit('click',{isTrusted:false,type:'click'});await flush();assert.equal(f.audios.length,0);
});
test('trusted touch primes BOTH decks and later touch retries a rejected second deck',async()=>{
 const g=fixture(true);
 g.emit('pointerdown');assert.equal(g.audios.length,2);assert.equal(g.audios[0].calls,1);assert.equal(g.audios[1].calls,1);await flush();g.tick(1600);assert.equal(level(g),0.2);
 g.audios[1].reject=false;g.emit('pointerdown');g.emit('click');await flush();assert.equal(g.audios[1].calls,2,'failed incoming deck gets another trusted attempt');assert.equal(g.audios[0].calls,1,'successful playback is never restarted');
});
test('gesture rejected while suppressed remains retryable after release including keyboard',async()=>{
 const f=fixture();f.manager.setSuppressed('intro',true);f.emit('pointerdown');await flush();assert.equal(f.audios.length,0);f.manager.setSuppressed('intro',false);await flush();f.emit('keydown',{isTrusted:true,type:'keydown',key:'Enter',repeat:false});await flush();assert.equal(f.audios.length,2);assert.ok(f.audios.every(a=>a.calls>=1));f.tick(1600);assert.equal(level(f),0.2);
});
test('map zoom target ramps without changing music playback position',async()=>{
 const f=fixture();f.emit('click');await flush();f.tick(1600);f.audios[0].currentTime=12;assert.equal(vm.runInContext('syncBurbzMusicForMapZoom()',f.context),0);assert.equal(level(f),0.2);f.tick(225);assert.ok(level(f)>0&&level(f)<0.2);f.tick(300);assert.equal(level(f),0);assert.equal(f.audios[0].currentTime,12);
 vm.runInContext("currentScreen='scan';syncBurbzMusicForMapZoom()",f.context);f.tick(500);assert.equal(level(f),0.2);
});
test('hidden and BFCache pagehide silence immediately; return resumes; nonpersisted exit destroys',async()=>{
 const f=fixture();f.emit('click');await flush();f.tick(1600);f.document.hidden=true;f.emit('visibilitychange');silent(f);f.document.hidden=false;f.emit('visibilitychange');await flush();f.tick(1600);assert.equal(level(f),0.2);
 f.emit('pagehide',{persisted:true});silent(f);f.emit('pageshow',{persisted:true});await flush();f.tick(1600);assert.equal(level(f),0.2);f.emit('pagehide',{persisted:false});silent(f);f.emit('click');await flush();f.tick(2000);silent(f);assert.equal(f.manager.getAudios().length,0);
});
test('microphone and movie entry retain synchronous suppression before media access/play',()=>{
 const scan=html.slice(html.indexOf('async function startContinuousSoundListening('),html.indexOf('function cleanupFailedSoundStart('));
 assert.ok(scan.includes("setBurbzMusicSuppressed('sound-scan', true)"));
 assert.ok(scan.indexOf("setBurbzMusicSuppressed('sound-scan', true)")<scan.indexOf('await deps.getUserMedia'));
 const intro=html.slice(html.indexOf('function showIntroCutscene('),html.indexOf('function closeIntroCutscene('));
 assert.ok(intro.includes("setBurbzMusicSuppressed('intro',true)"));
});
