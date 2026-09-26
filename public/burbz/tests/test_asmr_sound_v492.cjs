// The calm bus and the soundscape (v492). Run: node --test tests/test_asmr_sound_v492.cjs
// A small fake AudioContext records what each sound asks of Web Audio.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const A=require('../audio_core.js'),S=require('../asmr_soundscape.js');
const root=path.join(__dirname,'..'),repo=path.join(root,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8');
const BUILD='asmr-sound-v492-20260925';

function param(value=0){const p={value,calls:[]};for(const k of ['setValueAtTime','linearRampToValueAtTime','exponentialRampToValueAtTime','setTargetAtTime','cancelScheduledValues'])p[k]=(...a)=>{p.calls.push([k,...a]);if(k!=='cancelScheduledValues')p.value=k==='setTargetAtTime'?a[0]:a[0];return p;};return p;}
class FakeContext{
 constructor(){this.currentTime=0;this.sampleRate=8000;this.state='suspended';this.nodes=[];this.destination={kind:'destination'};FakeContext.last=this;}
 node(kind,extra={}){const n={kind,context:this,out:[],connect(t){this.out.push(t);return t;},disconnect(){},start(...a){this.started=a;},stop(t){this.stopAt=t;},...extra};this.nodes.push(n);return n;}
 createGain(){return this.node('gain',{gain:param(1)});}
 createBiquadFilter(){return this.node('filter',{type:'',frequency:param(350),Q:param(1),gain:param(0)});}
 createDynamicsCompressor(){return this.node('compressor',{threshold:param(),knee:param(),ratio:param(),attack:param(),release:param()});}
 createConvolver(){return this.node('convolver',{buffer:null});}
 createOscillator(){return this.node('osc',{type:'sine',frequency:param(440)});}
 createBufferSource(){return this.node('source',{buffer:null,loop:false,playbackRate:param(1)});}
 createStereoPanner(){return this.node('pan',{pan:param(0)});}
 createMediaElementSource(el){return this.node('media',{element:el});}
 createBuffer(ch,len,rate){const data=[...Array(ch)].map(()=>new Float32Array(len));return{numberOfChannels:ch,length:len,sampleRate:rate,duration:len/rate,getChannelData:i=>data[i]};}
 decodeAudioData(bytes,ok){const b=this.createBuffer(1,8000,8000);ok(b);return Promise.resolve(b);}
 resume(){this.state='running';return Promise.resolve();}
}
const fetch=()=>Promise.resolve({ok:true,arrayBuffer:()=>Promise.resolve(new ArrayBuffer(8))});
const makeBus=()=>A.createBus({AudioContext:FakeContext,fetch,listen:false});
const tick=()=>new Promise(r=>setImmediate(r));

test('outside a browser there is no bus, and a caller with its own Audio keeps the element path',()=>{
 assert.equal(A.sharedBus(),null);
 const m=A.createAudioManager({Audio:function(){}});assert.equal(m.bus,null);
});

test('the bus is one warm chain: shelf and gentle compressor before the speaker, music low-passed',()=>{
 const bus=makeBus(),ctx=bus.ctx;
 const shelf=ctx.nodes.find(n=>n.kind==='filter'&&n.type==='highshelf');assert(shelf&&shelf.gain.value<0,'the top end is softened');
 const glue=ctx.nodes.find(n=>n.kind==='compressor');assert(glue.ratio.value<=3,'glue, not a brick wall');assert(glue.out.includes(ctx.destination));
 const lp=ctx.nodes.find(n=>n.kind==='filter'&&n.type==='lowpass');assert(bus.input('music').out.includes(lp)&&lp.frequency.value<=4000,'music sounds like the next room');
 const room=ctx.nodes.find(n=>n.kind==='convolver');assert(room.buffer&&room.buffer.duration>1,'a real room tail');
});

test('a tap is made, not sampled: no file, low and round, and its envelope always reaches silence',async()=>{
 const bus=makeBus(),m=A.createAudioManager({bus,random:()=>.5});
 assert.equal(await m.play('tap'),true);
 const oscs=bus.ctx.nodes.filter(n=>n.kind==='osc');assert(oscs.length>=2);
 assert(oscs.every(o=>o.frequency.calls.every(c=>typeof c[1]!=='number'||c[1]>=450&&c[1]<=2000)),'phone-speaker mids, nothing shrill');
 const envelopes=bus.ctx.nodes.filter(n=>n.kind==='gain'&&n.gain.calls.some(c=>c[0]==='setTargetAtTime'));
 assert(envelopes.length&&envelopes.every(g=>g.gain.calls.find(c=>c[0]==='setTargetAtTime')[1]===0),'every envelope glides to zero');
 assert(oscs.every(o=>o.stopAt>=.15),'oscillators outlive their decay: the tail is never cut');
 for(const name of ['page','unlock','coins','error'])assert.equal(await m.play(name),true,name);
});

test('files on the bus fade in and out, and stop() fades rather than cuts',async()=>{
 const bus=makeBus(),m=A.createAudioManager({bus,random:()=>0});
 assert.equal(await m.play('questComplete'),true);
 const src=bus.ctx.nodes.filter(n=>n.kind==='source').at(-1),gain=src.out[0];
 const ramps=gain.gain.calls.filter(c=>c[0]==='linearRampToValueAtTime');
 assert(ramps[0][1]>0&&ramps[0][1]<=.5,'a reward is a warm swell, not a shout');assert.equal(ramps.at(-1)[1],0,'the file ends at silence');
 m.stop('questComplete');const release=gain.gain.calls.at(-1);assert.equal(release[0],'setTargetAtTime');assert.equal(release[1],0);assert(src.stopAt>bus.ctx.currentTime,'stopped after the fade');
});

test('quick taps never swallow the chime that follows',async()=>{
 const bus=makeBus(),m=A.createAudioManager({bus,maxPolyphony:3});
 for(let i=0;i<5;i++)await m.play('tap',{cooldown:0});
 assert.equal(await m.play('coins'),true);
 // A one-voice sound still refuses a second voice instead of cutting the first.
 assert.equal(await m.residentChatter(),true);assert.equal(await m.residentChatter(),false);
});

test('loops glide on the bus, and mute or danger fades them away',async()=>{
 const bus=makeBus(),m=A.createAudioManager({bus,random:()=>0,setTimeout:()=>0});
 assert.equal(m.campfire(1),true);await tick();await tick();
 const fire=bus.ctx.nodes.filter(n=>n.kind==='source').find(n=>n.loop);assert(fire,'the fire loops');
 assert(m.loopLevel('campfire')>.5,'a fire you sit beside is heard');
 m.setMood('tense');assert.equal(m.loopLevel('campfire'),0);
 m.ambience(1,.3);m.setEnabled(false);assert.equal(m.loopLevel('rain'),0);
});

test('music rides a gain node on the bus, so a phone honours its level',()=>{
 const bus=makeBus();class Track{constructor(){this.volume=1;this.muted=false;this.duration=100;this.currentTime=0;}addEventListener(){}play(){return Promise.resolve();}pause(){}}
 const routed=[];let clock=0;
 const music=A.createMusicManager({Audio:Track,volume:.045,gapMs:1000,now:()=>clock,setTimeout:()=>0,route:t=>{const g=bus.routeMedia(t,'music');routed.push(g);return g;}});
 return music.start().then(()=>{
  assert.equal(music.getAudios().length,1,'a resting song needs one deck');assert.equal(routed.length,1);
  const node=routed[0];assert(node.out.includes(bus.input('music')));
  assert.equal(music.getAudio().volume,1,'the element plays at full; the node sets the level');
  assert.equal(node.gain.calls.at(-1)[1],.045);
  music.pause({immediate:true});assert.equal(node.gain.calls.at(-1)[1],0);
 });
});

test('the soundscape follows the scene and hushes for mute, danger and the microphone',()=>{
 const bus=makeBus();let clock=0,ok=true,mood='calm';
 const s=S.create({bus,now:()=>clock,allowed:()=>ok,mood:()=>mood,setInterval:()=>1,clearInterval(){},random:(()=>{let x=.37;return()=>(x=(x*9301+.4927)%1);})()});
 assert.equal(s.tick(),null,'silent until started');s.start();assert.equal(s.tick(),'menu');
 s.outdoors(0,.4);assert.equal(s.tick(),'outdoor');s.outdoors(.2,0);assert.equal(s.tick(),'indoor');
 clock+=2000;assert.equal(s.tick(),'menu','a menu once the world stops reporting');
 ok=false;assert.equal(s.tick(),null);ok=true;mood='tense';assert.equal(s.tick(),null);mood='calm';
 // Outdoors in the rain for a while: leaves rustle, drips fall, a chime sounds.
 s.outdoors(.8,.6);for(let i=0;i<400;i++){clock+=250;s.outdoors(.8,.6);s.tick();}
 assert(s.events>40,'a living bed: '+s.events);
 const pans=bus.ctx.nodes.filter(n=>n.kind==='pan');assert(pans.length>10&&pans.some(p=>p.pan.calls[0][1]<0)&&pans.some(p=>p.pan.calls[0][1]>0),'sounds move across both ears');
 assert(S.LEVELS.air.outdoor+S.LEVELS.air.windBoost<=.1,'the bed stays under everything');
 assert.deepEqual(S.create({}).tick(),null,'no bus, no sound, no error');
});

test('the game wires it up: one context, soundscape gates, quiet music routed through the bus',()=>{
 const html=read('index.html');
 assert.match(html,/const BURBZ_MUSIC_BASE_VOLUME = 0\.0[0-4]\d*;/);
 assert(html.includes("route: track => SFX?.bus?.routeMedia?.(track, 'music') || null"));
 assert(html.includes("allowed: () => sfxEnabled && !burbzMicListening && !mediaStream && !document.hidden"),'never plays into Merlin\'s microphone');
 assert(html.includes('burbzSoundscape?.outdoors(rain,wind)'));assert(html.includes('burbzSoundscape?.start();'));
 assert(html.includes('const bus = window.BurbzAudioCore?.sharedBus?.();'),'the listener shares the one context');
 assert(read('garden_birds.js').includes("AUDIO.master.connect(bus.input('nature'))"));
});

test('v492 ships together: build marker, cache, loader order, three worker lists and the updater',()=>{
 const html=read('index.html'),sw=read('sw.js'),updater=fs.readFileSync(path.join(repo,'scripts/update-live-burbz.sh'),'utf8');
 // Later releases ship on top under their own marker; v492 stays in the cache chain.
 const LATER=['quest-lines-v493-20260926','photo-merlin-v494-20260926','walk-planner-v495-20260926'];assert([BUILD,...LATER].some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));assert([BUILD,...LATER].some(b=>sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].endsWith('-'+b)));assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].includes('-'+BUILD));
 const order=['audio_core.js','asmr_soundscape.js','garden_birds.js'].map(f=>html.indexOf('<script src="'+f+'?v='+BUILD+'"></script>'));
 assert(order.every(i=>i>0)&&order[0]<order[1]&&order[1]<order[2],'core, then soundscape, then birds');
 const self={location:new URL('https://example.test/burbz/sw.js'),addEventListener(){}};
 for(const key of ['BURBZ_UK_BIRD_EXPANSION_50','BURBZ_UK_BIRD_EXPANSION_26','BURBZ_AU_BIRD_EXPANSION','BURBZ_UK_BIRD_EXPANSION_FINAL','BURBZ_AU_BIRD_EXPANSION_50'])self[key]={art:{}};
 const ctx=vm.createContext({self,URL,importScripts(){},console});vm.runInContext(sw,ctx);const lists=vm.runInContext('({BURBZ_ASSETS,BURBZ_CORE,BURBZ_INSTALL_REQUIRED})',ctx);
 for(const f of ['audio_core.js','asmr_soundscape.js','garden_birds.js']){for(const list of Object.values(lists))assert(list.includes('./'+f+'?v='+BUILD),f);assert(updater.includes('"'+f+'"'),f);}
});
