const test=require('node:test'),assert=require('node:assert/strict');
const A=require('../audio_core.js'),W=require('../village_walk_core.js');
function harness(){let enabled=true,stops=0;const cues=[];const c=A.createFootstepController({enabled:()=>enabled,play:s=>cues.push(s),stop:()=>stops++});return{c,cues,mute:()=>enabled=false,get stops(){return stops;}};}
function walk(h,seconds,hz=60,speed=2.7){let p={x:0,z:0};for(let i=0;i<seconds*hz;i++){const next={x:p.x+speed/hz,z:p.z};h.c.update(p,next,1/hz,'ground');p=next;}}
test('actual distance produces consistent cadence across frame rates and slow analogue motion',()=>{
 const counts=[20,30,60,120].map(hz=>{const h=harness();walk(h,10,hz);return h.cues.length;});assert.equal(new Set(counts).size,1);assert(counts[0]>=22&&counts[0]<=23);
 const slow=harness();walk(slow,10,60,1.35);assert(slow.cues.length>=11&&slow.cues.length<=12);
});
test('stationary input, wall collision, teleports and resume gaps do not play or catch up',()=>{
 const h=harness(),world=W.createWorld({radius:12,polygons:[[{x:-1,z:-1},{x:1,z:-1},{x:1,z:1},{x:-1,z:1}]]}),p={x:0,y:0,z:1.28,yaw:0,pitch:0};
 for(let i=0;i<120;i++){const before={...p};W.move(p,{forward:1},1/60,world);h.c.update(before,p,1/60,'stone');}assert.equal(h.cues.length,0);
 h.c.update(p,{...p,x:p.x+100},1/60,'ground');h.c.update(p,{...p,x:p.x+.1},10,'wood');assert.equal(h.cues.length,0);
 h.c.update(p,p,1/60,'wood');assert.equal(h.cues.length,0);
 walk(h,1);assert(h.cues.length<=3);
});
test('mute discards distance and reset stops the walking channel',()=>{
 const h=harness();walk(h,1);const before=h.cues.length;h.mute();walk(h,5);assert.equal(h.cues.length,before);assert(h.stops>0);const stops=h.stops;h.c.dispose();assert.equal(h.stops,stops+1);
});
test('bridge material follows the actual rotated bridge bounds',()=>{
 const w=W.createWorld({river:{x:10,z:4,ux:0,uz:1,width:3.4},surfaceAt:(x,z)=>x<0?'stone':'ground'});
 assert.equal(w.surface(10,4),'wood');assert.equal(w.surface(11,4),'ground');assert.equal(w.surface(10,8),'ground');assert.equal(w.surface(-1,4),'stone');
});
test('outward boundary triggers only movement toward the real edge',()=>{
 const w=W.createWorld({radius:12});assert(W.outwardBoundary({x:11.5,z:0,yaw:0},{side:1},w));
 for(const input of [{},{forward:1},{side:-1}])assert(!W.outwardBoundary({x:11.5,z:0,yaw:0},input,w));
 assert(!W.outwardBoundary({x:0,z:0,yaw:0},{side:1},w));assert(!W.outwardBoundary({x:100,z:0,yaw:0},{side:1},{radius:Infinity}));
});
class Audio {static instances=[];constructor(src){this.src=src;this.listeners={};this.paused=true;Audio.instances.push(this);}addEventListener(n,f){this.listeners[n]=f;}play(){this.paused=false;return Promise.resolve();}pause(){this.paused=true;}end(){this.paused=true;this.listeners.ended?.();}}
test('variants alternate, footsteps do not overlap, and stopping them preserves other effects',async()=>{
 Audio.instances=[];let clock=0;const m=A.createAudioManager({Audio,random:()=>0,now:()=>clock});
 assert(await m.footstep('wood'));const a=Audio.instances.at(-1);assert(a.volume<.3);assert.equal(await m.footstep('stone'),false);
 a.end();clock=500;assert(await m.footstep('wood'));const b=Audio.instances.at(-1);assert.notEqual(a.src,b.src);
 assert(await m.residentChatter());const voice=Audio.instances.at(-1);m.stopFootsteps();assert(b.paused);assert(!voice.paused);
 m.setEnabled(false);assert(voice.paused);clock=1000;assert.equal(await m.footstep('stone'),false);
});
test('failed media playback remains quiet and can be retried without a queued burst',async()=>{
 class Failing extends Audio {play(){return Promise.reject(Error('locked'));}}
 const m=A.createAudioManager({Audio:Failing});assert.equal(await m.footstep('ground'),false);assert.equal(await m.footstep('ground'),false);m.stopFootsteps();
});
