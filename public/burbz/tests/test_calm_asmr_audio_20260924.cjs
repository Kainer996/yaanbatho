const test=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path');
const A=require('../audio_core.js');
class Audio{static instances=[];constructor(src){this.src=src;this.listeners={};this.paused=true;this.volume=1;Audio.instances.push(this);}addEventListener(n,f){this.listeners[n]=f;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}end(){this.paused=true;this.listeners.ended?.();}}
function manager(){Audio.instances.length=0;let clock=0;const timers=[];const m=A.createAudioManager({Audio,now:()=>clock,setTimeout:(f)=>timers.push(f)});return{m,tick:ms=>{clock+=ms;},flush(){while(timers.length)timers.shift()();}};}
const root=path.join(__dirname,'..');
test('every calm and tense sound ships on disk and in all three offline lists and the updater',()=>{
 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),updater=fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8');
 for(const name of ['footstepGround','footstepWood','footstepStone','footstepTense','campChop','campDust','campEat','campfire'])for(const src of [].concat(A.DEFAULT_SOUND_MANIFEST[name])){
  assert(fs.statSync(path.join(root,src)).size>1000,src);
  assert.equal(sw.split("'./"+src+"'").length-1,3,src);assert(updater.includes('"'+src+'"'),src);
 }
});
test('calm footsteps are the default and danger swaps in the gritty set outdoors',async()=>{
 const {m,tick}=manager();assert.equal(m.mood(),'calm');
 assert(await m.footstep('ground'));assert.match(Audio.instances.at(-1).src,/calm-grass/);Audio.instances.at(-1).end();tick(400);
 m.setMood('tense');assert(await m.footstep('stone'));const gritty=Audio.instances.at(-1);assert.match(gritty.src,/tense-gravel/);gritty.end();tick(400);
 assert(await m.footstep('wood'));assert.match(Audio.instances.at(-1).src,/calm-wood/);Audio.instances.at(-1).end();tick(400);
 assert.equal(gritty.volume,.26,'tense steps are grittier, not louder');
 m.setMood('anything');assert.equal(m.mood(),'calm');
});
test('the campfire fades in with nearness, hushes for danger and stops on mute',async()=>{
 const {m,flush}=manager();assert.equal(m.campfire(0),false);assert.equal(Audio.instances.length,0);
 assert(m.campfire(1));const fire=Audio.instances.at(-1);assert.match(fire.src,/campfire-loop/);assert.equal(fire.loop,true);flush();assert.equal(fire.volume,.5);
 m.campfire(.5);flush();assert.equal(fire.volume,.25);
 m.setMood('tense');flush();assert(fire.paused);assert.equal(m.campfire(1),false);
 m.setMood('calm');m.campfire(1);const again=Audio.instances.at(-1);assert.notEqual(again,fire);m.setEnabled(false);assert(again.paused);
 m.setEnabled(true);m.campfire(1);const last=Audio.instances.at(-1);m.campfire(0,{immediate:true});assert(last.paused);
});
test('camp sounds rotate variants and rest between repeats',async()=>{
 const {m,tick}=manager();assert(await m.play('campChop'));const a=Audio.instances.at(-1).src;assert.equal(await m.play('campChop'),false);tick(300);assert(await m.play('campChop'));assert.notEqual(Audio.instances.at(-1).src,a);
 assert(await m.play('campEat'));assert(await m.play('campDust'));
});
