/* Garden birds round the player's house: a robin, blue and great tits,
 * chaffinches, goldfinches, a wren and a pair of blackbirds.
 *
 * They behave as the real birds do. They perch on the Academy tree, the house
 * and the garden furniture, and face into the wind to keep their feathers
 * flat. Robins hop and pause, blackbirds run and stop to listen, chaffinches
 * shuffle and peck. Tits and finches fly in bounds, flapping up and closing
 * their wings to dip; robins, wrens and blackbirds fly straight. In a side
 * wind every bird crabs, its body turned into the wind while it tracks to its
 * perch, and gusts jostle it. Come too close and a bird flies off, sometimes
 * with an alarm call. At dusk they go to roost in the tree; at dawn they sing
 * most. Each species sings in its own season, as it does outside.
 *
 * Songs are made with ElevenLabs (assets/audio/garden-birds/), never recorded
 * birds, and they are placed in space: louder and brighter near, softer and
 * duller far, left or right as heard. The host mutes them while Merlin's wand
 * listens, so the sound ID never hears the game's own birds.
 *
 * Presentation only: never reads or writes game state.
 */
(function(root){'use strict';

// Real birds are small. A touch larger than life keeps them readable on a phone.
const SIZE=1.5;
const TAU=Math.PI*2;
const clamp=(v,a,b)=>v<a?a:v>b?b:v;
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
function wrap(a){while(a>Math.PI)a-=TAU;while(a<-Math.PI)a+=TAU;return a;}

// ---- species ---------------------------------------------------------------
// len: real length in metres. flight: 'bound' (flap-and-dip), 'direct' or
// 'whirr' (wren). speed: airspeed m/s. ground: share of stops made on the
// ground. fid: how close the player may come before it flies (metres).
// upright: body angle when perched. gap: seconds between song bouts.
const SPECIES={
 robin:{name:'European robin',len:.14,flight:'direct',hz:14,speed:6,ground:.5,fid:2.4,upright:.62,bob:true,song:'robin-song',alarm:'robin-tick',gap:[7,16],voice:.8,
  season:[1,1,1,1,1,.9,.3,.6,1,1,1,1],looks:['robin']},
 bluetit:{name:'Blue tit',len:.12,flight:'bound',hz:17,speed:6.5,ground:.04,fid:3,upright:.4,acrobat:true,song:'bluetit-song',gap:[10,22],voice:.6,
  season:[1,1,1,1,1,.7,.4,.4,.5,.5,.6,.8],looks:['bluetit','bluetit']},
 greattit:{name:'Great tit',len:.14,flight:'bound',hz:16,speed:7,ground:.1,fid:3.2,upright:.38,acrobat:true,song:'greattit-song',gap:[8,18],voice:.8,
  season:[1,1,1,1,.9,.6,.3,.35,.5,.6,.6,.8],looks:['greattit']},
 chaffinch:{name:'Chaffinch',len:.145,flight:'bound',hz:15,speed:8,ground:.55,fid:4,upright:.28,song:'chaffinch-song',gap:[8,16],voice:.8,
  season:[.4,1,1,1,1,1,.8,.35,.35,.35,.35,.35],looks:['chaffinchM','chaffinchF']},
 goldfinch:{name:'Goldfinch',len:.12,flight:'bound',hz:17,speed:8,ground:.08,fid:4,upright:.3,flock:true,song:'goldfinch-twitter',gap:[5,12],voice:.55,
  season:[1,1,1,1,1,1,1,1,1,1,1,1],looks:['goldfinch','goldfinch','goldfinch']},
 wren:{name:'Wren',len:.1,flight:'whirr',hz:22,speed:5,ground:.45,fid:2.6,upright:.2,bob:true,low:true,song:'wren-song',gap:[10,24],voice:1,
  season:[.8,1,1,1,1,1,.7,.4,.8,.9,.8,.8],looks:['wren']},
 blackbird:{name:'Blackbird',len:.25,flight:'direct',hz:9,speed:9,ground:.62,fid:5.5,upright:.34,runs:true,song:'blackbird-song',alarm:'blackbird-alarm',gap:[9,20],voice:.9,
  season:[.35,.8,1,1,1,1,.8,.35,.35,.35,.35,.35],looks:['blackbirdM','blackbirdF']}
};

// Plumage from field guides, painted flat in the game's ink-and-cel style.
const LOOKS={
 robin:{back:0x86694a,wing:0x7a5f42,prim:0x5f4a35,breast:0xd9652a,face:0xd9652a,belly:0xece6d8,edge:0xa8aeb0,cap:0x86694a,tail:0x735a3e,beak:0x2e2824,legs:0xa07f68,headR:.1,beak:[.075,.022],plump:1.08},
 bluetit:{back:0x87a35a,wing:0x4a86c8,prim:0x3a6aa6,bar:0xf2f2ee,breast:0xe9cf38,face:0xf3f3ef,belly:0xe9cf38,cap:0x3d7fc6,stripe:0x1d2330,cheek:0xf3f3ef,tail:0x3f78b8,beak:0x2a2a2e,legs:0x6f7c8c,headR:.105,beak:[.05,.022],plump:1.02},
 greattit:{back:0x7d9450,wing:0x6b7c8d,prim:0x4f5c69,bar:0xf0efe8,breast:0xe4c83a,face:0x15181c,belly:0xe4c83a,cap:0x15181c,cheek:0xf4f4f0,belt:0x15181c,tail:0x55636f,beak:0x1d1d20,legs:0x6c7684,headR:.1,beak:[.06,.022],plump:1},
 chaffinchM:{back:0x8d5b3b,wing:0x2c2a28,prim:0x201f1e,bar:0xf1efe6,breast:0xc98566,face:0xc98566,belly:0xe0c3b4,cap:0x6e8197,rump:0x7e8f48,tail:0x2f2d2b,beak:0x8b8f97,legs:0x9a8a80,headR:.095,beak:[.07,.03],plump:1},
 chaffinchF:{back:0x9a8866,wing:0x4a4238,prim:0x39332c,bar:0xf1efe6,breast:0xc6b699,face:0xb7a684,belly:0xe0d6c2,cap:0x8f7f60,rump:0x8e9656,tail:0x5a5040,beak:0x9a9a9a,legs:0x9a8a80,headR:.095,beak:[.07,.03],plump:1},
 goldfinch:{back:0xb99b73,wing:0x1e1e20,prim:0x161618,bar:0xf1c232,breast:0xcbb08d,face:0xc8312b,belly:0xf1ede4,cap:0x16161a,cheek:0xf2f0ea,tail:0x1d1d1f,beak:0xe8d6c0,legs:0xc9a58f,headR:.1,beak:[.1,.026],plump:.98},
 wren:{back:0x7a5638,wing:0x6a4a30,prim:0x5a3e28,bar:0x8c6a48,breast:0xb89573,face:0xc9ab86,belly:0xc4a482,cap:0x6f4e33,tail:0x6a4a30,beak:0x4a3a2c,legs:0xa58367,headR:.12,beak:[.08,.016],plump:1.15,cocked:true},
 blackbirdM:{back:0x17171b,wing:0x121216,prim:0x0d0d10,breast:0x1b1b1f,face:0x17171b,belly:0x1f1f23,cap:0x17171b,tail:0x0f0f12,beak:0xf0a321,ring:0xf0b531,legs:0x3a302a,headR:.085,beak:[.1,.03],plump:.96,longTail:true},
 blackbirdF:{back:0x4b3829,wing:0x44321f,prim:0x362818,breast:0x6f5441,face:0x5a4433,belly:0x7a6250,cap:0x4b3829,tail:0x3c2c1f,beak:0xa88a3d,legs:0x3f342c,headR:.085,beak:[.1,.03],plump:.96,longTail:true,speckle:0x3c2c1f}
};

// ---- shared geometry ---------------------------------------------------------
// Each bird is four meshes (body, head, two wings), every part baked into one
// vertex-coloured geometry, so a whole bird is four draws on one material.
// Model space: +Z forward, +Y up; the unit bird is one "length" long.
function builder(T){
 const sphere=new T.SphereGeometry(1,10,7),cone=new T.ConeGeometry(1,1,7),box=new T.BoxGeometry(1,1,1);
 function shape(parts,len){const pos=[],norm=[],col=[];for(const [base,color,p,sc,rot]of parts){if(color==null)continue;const g=base.index?base.toNonIndexed():base.clone();g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(p[0]*len,p[1]*len,p[2]*len),new T.Quaternion().setFromEuler(new T.Euler(rot?.[0]||0,rot?.[1]||0,rot?.[2]||0)),new T.Vector3(sc[0]*len,sc[1]*len,sc[2]*len)));pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);const c=new T.Color(color);for(let i=0;i<g.attributes.position.count;i++)col.push(c.r,c.g,c.b);g.dispose();}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.computeBoundingSphere();return g;}
 function make(look,len){
  const L=LOOKS[look],k=L.plump||1,tailLen=L.longTail?.3:.22,tailTilt=L.cocked?-1.05:.12;
  const body=shape([
   [sphere,L.back,[0,.02,-.02],[.17*k,.18*k,.3]],
   [sphere,L.breast,[0,-.03,.1],[.16*k,.165*k,.19]],
   [sphere,L.belly,[0,-.09,-.05],[.135*k,.11*k,.2]],
   [sphere,L.edge,[0,-.005,.17],[.1,.12,.07]],
   [sphere,L.rump,[0,.04,-.24],[.1,.08,.1]],
   [sphere,L.belt,[0,-.05,.12],[.035,.14,.13]],
   [sphere,L.speckle,[.05,-.02,.19],[.03,.03,.02]],[sphere,L.speckle,[-.05,-.05,.18],[.03,.03,.02]],[sphere,L.speckle,[0,-.09,.15],[.03,.03,.02]],
   // Tail: a flat fan off the rump; a wren carries it cocked straight up.
   [sphere,L.tail,[0,.02+(L.cocked?.14:0),-.28-tailLen*.5+(L.cocked?.12:0)],[.07,.03,tailLen*.56],[tailTilt,0,0]],
   [sphere,L.tail,[0,.015,-.24],[.09,.05,.1]],
   // Legs and toes.
   [box,L.legs,[.045,-.23,.03],[.018,.13,.018]],[box,L.legs,[-.045,-.23,.03],[.018,.13,.018]],
   [box,L.legs,[.045,-.295,.06],[.02,.012,.09]],[box,L.legs,[-.045,-.295,.06],[.02,.012,.09]]
  ],len);
  const r=L.headR,bl=L.beak[0],bw=L.beak[1];
  const head=shape([
   [sphere,L.cap,[0,.055,.03],[r,r*.98,r*1.08]],
   [sphere,L.face,[0,.03,.075],[r*.86,r*.78,r*.62]],
   [sphere,L.cap===L.face?null:L.cap,[0,.1,.02],[r*.9,r*.5,r*.95]],
   [sphere,L.cheek,[r*.62,.03,.05],[r*.32,r*.45,r*.5]],[sphere,L.cheek,[-r*.62,.03,.05],[r*.32,r*.45,r*.5]],
   [sphere,L.stripe,[r*.66,.06,.06],[r*.2,r*.12,r*.55]],[sphere,L.stripe,[-r*.66,.06,.06],[r*.2,r*.12,r*.55]],
   [sphere,L.ring,[r*.72,.075,.09],[r*.2,r*.2,r*.12]],[sphere,L.ring,[-r*.72,.075,.09],[r*.2,r*.2,r*.12]],
   [sphere,0x0c0c0e,[r*.8,.075,.095],[r*.15,r*.15,r*.1]],[sphere,0x0c0c0e,[-r*.8,.075,.095],[r*.15,r*.15,r*.1]],
   [cone,L.beak,[0,.035,.03+r+bl*.45],[bw,bl,bw*.85],[Math.PI/2,0,0]]
  ],len);
  // Wings open along +X / -X from the shoulder, chord trailing back (-Z).
  const wing=side=>shape([
   [sphere,L.wing,[side*.24,0,-.07],[.25,.018,.13]],
   [sphere,L.prim,[side*.48,0,-.13],[.17,.014,.1],[0,side*.35,0]],
   [sphere,L.bar,[side*.2,.012,-.02],[.17,.012,.03]],
   [sphere,L.bar&&L.bar!==L.wing?L.bar:null,[side*.3,.012,-.09],[.12,.01,.022]]
  ],len);
  return{body,head,wingR:wing(1),wingL:wing(-1)};
 }
 return{make,dispose(){sphere.dispose();cone.dispose();box.dispose();}};
}

// ---- space and sound ---------------------------------------------------------
// Where the wind blows towards. It matches the drift of the cloud sky, which
// moves the clouds towards -x, -z in world_sky.js.
const WIND_DIR={x:-.93,z:-.37};
function environment(now=Date.now()){
 let wind=.25,rain=0;try{const w=root.BurbzCalmAudio?.weather?.();if(w){if(Number.isFinite(w.wind))wind=w.wind;if(Number.isFinite(w.rain))rain=w.rain;}}catch(_){}
 const d=new Date(now),hour=d.getHours()+d.getMinutes()/60;let lamp=hour>=19||hour<5?1:0;
 try{const dn=root.BurbzAcademyDayNight;if(dn?.lampFactorForHour)lamp=dn.lampFactorForHour(hour);}catch(_){}
 return{wind:{speed:clamp(wind,0,1),x:WIND_DIR.x,z:WIND_DIR.z},rain:clamp(rain,0,1),lamp:clamp(lamp,0,1),hour,month:d.getMonth()};
}

// File counts per sound. Each take is its own file so a song never repeats
// the same way twice in a row.
const SOUNDS={'robin-song':3,'robin-tick':3,'bluetit-song':3,'greattit-song':3,'chaffinch-song':2,'goldfinch-twitter':3,'wren-song':3,'blackbird-song':3,'blackbird-alarm':3,'wing-flutter':2};
const AUDIO={ctx:null,master:null,buffers:new Map(),loading:new Map(),voices:new Set(),unlock:false,hushed:0,base:'assets/audio/garden-birds/'};
function audioContext(){if(AUDIO.ctx)return AUDIO.ctx;
 // The game's calm bus when there is one: one context, the same warm room and
 // soft top end as every other sound, and a gain iPhones honour.
 const bus=root.BurbzAudioCore?.sharedBus?.();
 if(bus&&bus.ctx){try{AUDIO.ctx=bus.ctx;AUDIO.master=bus.ctx.createGain();AUDIO.master.gain.value=0;AUDIO.master.connect(bus.input('nature'));AUDIO.unlock=true;return AUDIO.ctx;}catch(_){AUDIO.ctx=null;AUDIO.master=null;}}
 const AC=root.AudioContext||root.webkitAudioContext;if(!AC)return null;
 try{AUDIO.ctx=new AC();AUDIO.master=AUDIO.ctx.createGain();AUDIO.master.gain.value=0;AUDIO.master.connect(AUDIO.ctx.destination);}catch(_){AUDIO.ctx=null;return null;}
 if(!AUDIO.unlock&&root.addEventListener){AUDIO.unlock=true;const wake=e=>{if(e&&e.isTrusted===false)return;if(AUDIO.ctx?.state==='suspended')AUDIO.ctx.resume().catch(()=>{});};for(const type of ['pointerdown','touchend','keydown'])root.addEventListener(type,wake,{passive:true});}
 return AUDIO.ctx;}
function soundUrl(name,take){return AUDIO.base+name+'-'+String(take).padStart(2,'0')+'.mp3';}
function loadSound(url){const ctx=AUDIO.ctx;if(!ctx||!root.fetch)return null;if(AUDIO.buffers.has(url))return AUDIO.buffers.get(url);if(!AUDIO.loading.has(url))AUDIO.loading.set(url,root.fetch(url).then(r=>{if(!r.ok)throw Error('missing');return r.arrayBuffer();}).then(b=>new Promise((ok,no)=>ctx.decodeAudioData(b,ok,no))).then(buf=>{AUDIO.buffers.set(url,buf);return buf;}).catch(()=>{AUDIO.buffers.set(url,null);return null;}));return null;}
// Loudness falls with distance; far birds also lose their top end in the air.
// The takes are the loudest files in the game (about -18 LUFS), so even a
// bird beside you sits at half gain, level with the soundscape.
function voiceShape(d,voice){const ref=2.5,gain=voice*(d<=ref?1:ref/(ref+(d-ref)*.9));return{gain:clamp(gain,0,1)*.5,cutoff:clamp(15000*Math.exp(-d/38),2400,15000)};}

// ---- the flock ---------------------------------------------------------------
// perches: [{x,y,z,kind}] in the host group's space. kind is one of
//   'top' | 'twig' | 'bough' | 'deck' | 'roof' (the Academy tree),
//   'ridge' (the house), 'rail' | 'post' | 'bath' | 'feeder' (garden things).
// ground(x,z): ground height. walkable(x,z): lawn a bird can forage on.
// obstacles: [{x,z,r,top}] that a flight must clear.
function create(T,options={}){
 const group=new T.Group();group.name='garden-birds';
 const parts=builder(T),material=new T.MeshLambertMaterial({vertexColors:true});
 const perches=(options.perches||[]).filter(p=>Number.isFinite(p.x+p.y+p.z)).map((p,i)=>({...p,i,taken:null}));
 const ground=options.ground||(()=>0),walkable=options.walkable||(()=>true),obstacles=options.obstacles||[],radius=options.radius||12;
 let seed=(options.seed>>>0)||20260925;const rand=()=>{seed=(seed+0x6D2B79F5)|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};
 const pick=a=>a[Math.floor(rand()*a.length)],range=r=>r[0]+rand()*(r[1]-r[0]);
 const geos=new Map(),birds=[],flocks=new Map();
 // Lawn spots worth foraging: open grass, a little away from the house.
 const lawn=[];for(let i=0;i<90&&lawn.length<40;i++){const a=i*2.39996,r=3+Math.sqrt((i+.5)/90)*(radius-3),x=Math.sin(a)*r,z=Math.cos(a)*r;if(walkable(x,z)&&Number.isFinite(ground(x,z)))lawn.push({x,z});}
 const perchY=p=>p.y;
 for(const [key,sp] of Object.entries(SPECIES))for(const look of sp.looks){
  if(!geos.has(look))geos.set(look,parts.make(look,sp.len*SIZE));const g=geos.get(look),obj=new T.Group(),body=new T.Mesh(g.body,material),head=new T.Mesh(g.head,material),wingR=new T.Mesh(g.wingR,material),wingL=new T.Mesh(g.wingL,material),len=sp.len*SIZE;
  head.position.set(0,.13*len,.2*len);head.rotation.order='YXZ';wingR.position.set(.16*len,.1*len,.1*len);wingL.position.set(-.16*len,.1*len,.1*len);wingR.rotation.order=wingL.rotation.order='YZX';
  for(const m of [body,head,wingR,wingL]){m.castShadow=false;m.receiveShadow=false;obj.add(m);}obj.name='garden-bird-'+key;group.add(obj);
  const b={key,sp,look,obj,body,head,wingR,wingL,len,foot:.3*len,state:'perch',perch:null,pos:new T.Vector3(),yaw:rand()*TAU,pitch:0,roll:0,until:0,
   gaze:{yaw:0,pitch:0,roll:0,ty:0,tp:0,tr:0,next:0},fold:1,flap:0,wingFlick:0,bob:0,fluff:1,hang:false,roost:false,
   flight:null,hop:null,nextSong:0,singing:0,voice:null,lastAlarm:-99};
  birds.push(b);if(sp.flock){if(!flocks.has(key))flocks.set(key,[]);flocks.get(key).push(b);}
 }
 // Start everyone somewhere sensible, spread through the garden.
 function free(kinds,near,avoid){const list=perches.filter(p=>!p.taken&&kinds.includes(p.kind)&&(!avoid||Math.hypot(p.x-avoid.x,p.z-avoid.z)>avoid.r));if(!list.length)return null;if(!near)return pick(list);list.sort((a,b)=>Math.hypot(a.x-near.x,a.y-near.y,a.z-near.z)-Math.hypot(b.x-near.x,b.y-near.y,b.z-near.z));return list[Math.min(list.length-1,Math.floor(rand()*Math.min(4,list.length)))];}
 const likes={robin:['post','rail','deck','bough','ridge','bath','feeder','twig'],bluetit:['twig','feeder','bough','deck','top','rail'],greattit:['twig','feeder','bough','top','roof','rail'],chaffinch:['twig','bough','top','ridge','roof','bath'],goldfinch:['top','twig','bough','roof','feeder'],wren:['bough','deck','rail','post','twig'],blackbird:['roof','ridge','top','post','bough','bath']};
 const roostKinds=['twig','bough','deck'];
 function setPerch(b,p){if(b.perch)b.perch.taken=null;b.perch=p;if(p){p.taken=b;b.pos.set(p.x,perchY(p)+b.foot,p.z);}}
 function land(b,target,now,env){b.flight=null;b.hang=false;if(target.perch){setPerch(b,target.perch);b.state='perch';}else{setPerch(b,null);b.state='ground';b.pos.set(target.x,ground(target.x,target.z)+b.foot,target.z);b.hop={next:now+range([.4,1.4]),bout:0};}
  b.until=now+range(b.state==='ground'?[5,14]:[5,18])*(env.rain>.3?1.8:1);if(env.wind.speed>.3)b.yaw=Math.atan2(-env.wind.x,-env.wind.z)+(rand()-.5)*.5;b.gaze.next=now+.2;}
 for(const b of birds){const p=free(likes[b.key]);if(p&&rand()>b.sp.ground*.6)setPerch(b,p);else if(lawn.length){const s=pick(lawn);b.state='ground';b.pos.set(s.x,ground(s.x,s.z)+b.foot,s.z);b.hop={next:0,bout:0};}else if(p)setPerch(b,p);}

 // ---- flight ------------------------------------------------------------------
 function bezier(a,b,c,d,t,out){const u=1-t;out.x=u*u*u*a.x+3*u*u*t*b.x+3*u*t*t*c.x+t*t*t*d.x;out.y=u*u*u*a.y+3*u*u*t*b.y+3*u*t*t*c.y+t*t*t*d.y;out.z=u*u*u*a.z+3*u*u*t*b.z+3*u*t*t*c.z+t*t*t*d.z;return out;}
 function plan(b,target,now){
  const A=b.pos.clone(),B=new T.Vector3(target.x,target.perch?perchY(target.perch)+b.foot:ground(target.x,target.z)+b.foot,target.z),dx=B.x-A.x,dz=B.z-A.z,D=Math.max(.3,Math.hypot(dx,dz)),ux=dx/D,uz=dz/D;
  // Songbirds drop off a perch and swoop up onto the next; a ground bird
  // springs up first, and one landing on the ground glides down to it.
  const c1=new T.Vector3(A.x+ux*D*.3,A.y-Math.min(.55,.1+.07*D),A.z+uz*D*.3),c2=new T.Vector3(B.x-ux*D*.3,B.y-Math.min(.7,.12+.09*D),B.z-uz*D*.3);
  if(b.state==='ground'){c1.set(A.x+ux*D*.2,A.y+.45+D*.04,A.z+uz*D*.2);}
  if(!target.perch){c2.set(B.x-ux*D*.35,B.y+.35+D*.06,B.z-uz*D*.35);}
  if(D>9&&!b.sp.low){const cruise=Math.max(A.y,B.y)+Math.min(3,D*.1);c1.y=Math.max(c1.y,cruise);c2.y=Math.max(c2.y,cruise*.9);}
  for(const c of [c1,c2]){const g=ground(c.x,c.z);if(Number.isFinite(g))c.y=Math.max(c.y,g+(b.sp.low?.25:.45));}
  // Clear the house and the trunk rather than fly through them.
  const p=new T.Vector3();for(let pass=0;pass<3;pass++){let lift=0;for(let i=1;i<12;i++){bezier(A,c1,c2,B,i/12,p);for(const o of obstacles){if(Math.hypot(p.x-o.x,p.z-o.z)<o.r&&p.y<o.top+.35)lift=Math.max(lift,o.top+.5-p.y);}}if(!lift)break;c1.y+=lift*1.35;c2.y+=lift*1.35;}
  let L=0;const q=A.clone();for(let i=1;i<=16;i++){bezier(A,c1,c2,B,i/16,p);L+=p.distanceTo(q);q.copy(p);}
  b.flight={A,c1,c2,B,L:Math.max(.4,L),s:0,target,start:now,phase:rand(),lastYaw:b.yaw,prev:A.clone(),gustSeed:rand()*50};
  if(b.perch){b.perch.taken=null;b.perch=null;}if(target.perch)target.perch.taken=b;
  b.state='fly';b.hang=false;b.hop=null;
 }
 const tan=new T.Vector3(),at=new T.Vector3(),ahead=new T.Vector3();
 function fly(b,now,dt,env){
  const f=b.flight,sp=b.sp,w=env.wind,ws=w.speed*6;// wind in m/s: a calm day is 1–2, a blustery one 5–6
  bezier(f.A,f.c1,f.c2,f.B,Math.min(1,f.s+.02),ahead);bezier(f.A,f.c1,f.c2,f.B,f.s,at);tan.subVectors(ahead,at);
  const th=Math.hypot(tan.x,tan.z)||1e-6,dx=tan.x/th,dz=tan.z/th;
  // The wind triangle: to hold its track the bird turns its body into the
  // crosswind (crabbing), and a headwind slows it over the ground.
  const va=sp.speed*(f.s>.82?lerp(1,.45,(f.s-.82)/.18):f.s<.1?lerp(.55,1,f.s/.1):1),wx=w.x*ws,wz=w.z*ws,along=wx*dx+wz*dz,cx=wx-along*dx,cz=wz-along*dz,cross=Math.min(va*.9,Math.hypot(cx,cz));
  const gs=Math.max(1.2,Math.sqrt(Math.max(.01,va*va-cross*cross))+along);
  f.s=Math.min(1,f.s+gs*dt/f.L);bezier(f.A,f.c1,f.c2,f.B,f.s,at);
  // Flap-and-bound: climb on a burst of beats, then close the wings and dip.
  const env01=Math.sin(Math.PI*f.s),boundHz=sp.flight==='bound'?(b.key==='goldfinch'?2.6:2.2):0;let rising=true;
  if(boundHz){const ph=(now*boundHz+f.phase)%1;rising=ph<.55;const tri=rising?ph/.55:1-(ph-.55)/.45;at.y+=(tri-.5)*.22*SIZE*Math.min(1,env01*2.5);}
  // Gusts jostle small birds, more the stronger the wind.
  const g1=Math.sin(now*3.1+f.gustSeed)*.6+Math.sin(now*7.7+f.gustSeed*1.7)*.4,g2=Math.sin(now*2.3+f.gustSeed*2.1)*.6+Math.sin(now*6.1+f.gustSeed)*.4,jig=w.speed*w.speed*.35*env01;
  at.x+=-dz*g1*jig;at.z+=dx*g1*jig;at.y+=g2*jig*.6;
  const vy=(at.y-b.pos.y)/Math.max(dt,1e-3);b.pos.copy(at);
  // Body heading is the air velocity, not the track.
  const hx=gs*dx-wx,hz=gs*dz-wz,yaw=Math.atan2(hx,hz),turn=wrap(yaw-b.yaw);b.yaw+=turn*Math.min(1,dt*9);
  b.roll=lerp(b.roll,clamp(-turn*1.6,-.7,.7)+g1*jig*.8,Math.min(1,dt*6));
  const landing=f.s>.84,launch=f.s<.1;
  b.pitch=landing?lerp(b.pitch,-.75,Math.min(1,dt*8)):lerp(b.pitch,clamp(-vy/(gs+1)*.5,-.5,.5),Math.min(1,dt*6));
  // Wings: bounding birds fold between bursts; everyone flares to land.
  const beating=landing||launch||sp.flight!=='bound'||rising;
  b.fold=lerp(b.fold,beating?0:1,Math.min(1,dt*(beating?30:22)));
  const glide=b.key==='blackbird'&&f.s>.55&&f.s<.84&&f.L>6;
  b.flap=glide?.18+Math.sin(now*2)*.05:(landing?1.25:1)*Math.sin(now*TAU*sp.hz*(landing?1.2:1)+f.phase*9)+.25;
  if(f.s>=1)land(b,f.target,now,env);
 }

 // ---- decisions ---------------------------------------------------------------
 function goSomewhere(b,now,env,flee){
  const sp=b.sp,listener=env.listener,avoid=flee&&listener?{x:listener.x,z:listener.z,r:sp.fid*2.4}:null;
  let target=null;
  if(b.roost||env.lamp>.55){const p=free(roostKinds,b.pos,avoid)||free(likes[b.key],b.pos,avoid);if(p){target={x:p.x,z:p.z,perch:p};b.roost=env.lamp>.55;}}
  else if(sp.flock&&!flee&&flocks.get(b.key)[0]!==b){const lead=flocks.get(b.key)[0],goal=lead.flight?{x:lead.flight.B.x,y:lead.flight.B.y,z:lead.flight.B.z}:{x:lead.pos.x,y:lead.pos.y,z:lead.pos.z};const p=free(likes[b.key],goal,avoid);if(p)target={x:p.x,z:p.z,perch:p};}
  if(!target){const toGround=!flee&&env.rain<.3&&lawn.length&&rand()<sp.ground;
   if(toGround){let s=null;for(let i=0;i<6&&!s;i++){const c=pick(lawn);if(!avoid||Math.hypot(c.x-avoid.x,c.z-avoid.z)>avoid.r)s=c;}if(s)target={x:s.x+(rand()-.5),z:s.z+(rand()-.5)};if(target&&!walkable(target.x,target.z))target=null;}
   if(!target){const kinds=env.rain>.3?roostKinds:flee?['top','twig','roof','ridge','bough']:likes[b.key],p=free(kinds,flee||rand()<.4?null:b.pos,avoid)||free(likes[b.key],null,avoid);if(p)target={x:p.x,z:p.z,perch:p};}}
  if(!target)return false;plan(b,target,now);
  // The rest of a charm of goldfinches follows its leader a moment later.
  if(sp.flock&&flocks.get(b.key)[0]===b)for(const other of flocks.get(b.key))if(other!==b&&other.state!=='fly')other.until=Math.min(other.until,now+.15+rand()*.6);
  if(flee&&listener){const d=Math.hypot(b.pos.x-listener.x,b.pos.z-listener.z);if(sp.alarm&&now-b.lastAlarm>6&&rand()<.7){b.lastAlarm=now;sound(sp.alarm,b,env,.9);}if(d<5)sound('wing-flutter',b,env,.5,true);}
  return true;
 }
 function perched(b,now,dt,env){
  const sp=b.sp;b.fold=lerp(b.fold,1,Math.min(1,dt*14));b.flap=lerp(b.flap,.08,Math.min(1,dt*10));
  const upright=b.roost?.15:sp.upright;b.pitch=lerp(b.pitch,-upright,Math.min(1,dt*6));b.roll=lerp(b.roll,b.hang?Math.PI:0,Math.min(1,dt*6));
  if(env.wind.speed>.3&&!b.hang){const into=Math.atan2(-env.wind.x,-env.wind.z);b.yaw+=wrap(into-b.yaw)*Math.min(1,dt*.8);}
  if(b.perch)b.pos.set(b.perch.x,perchY(b.perch)+(b.hang?-b.foot*.9:b.foot),b.perch.z);
  // A robin bobs and flicks its wings; a wren bobs its whole body.
  if(sp.bob&&!b.roost&&rand()<dt*.35)b.bob=1;if((b.key==='robin'||b.key==='blackbird')&&!b.roost&&rand()<dt*.12)b.wingFlick=1;
  if(sp.acrobat&&b.perch?.kind==='twig'&&!b.roost&&rand()<dt*.05)b.hang=!b.hang;
 }
 function forage(b,now,dt,env){
  const sp=b.sp,h=b.hop;b.fold=lerp(b.fold,1,Math.min(1,dt*14));b.flap=lerp(b.flap,.08,Math.min(1,dt*10));b.roll=lerp(b.roll,0,Math.min(1,dt*6));
  b.pitch=lerp(b.pitch,-(sp.upright*.7),Math.min(1,dt*6));
  if(h.move){const m=h.move,t=clamp((now-m.start)/m.time,0,1);b.pos.x=lerp(m.x0,m.x1,t);b.pos.z=lerp(m.z0,m.z1,t);b.pos.y=ground(b.pos.x,b.pos.z)+b.foot+(m.hop?Math.sin(Math.PI*t)*m.hop:0);if(t>=1)h.move=null;return;}
  if(now<h.next)return;
  // Blackbirds run and stop to listen; everyone else hops.
  if(h.bout<=0){h.bout=sp.runs?1:1+Math.floor(rand()*(b.key==='robin'?3:5));b.yaw+=(rand()-.5)*2.2;}
  const step=sp.runs?.35+rand()*.7:b.key==='chaffinch'||b.key==='goldfinch'?.05+rand()*.05:.1+rand()*.08,x1=b.pos.x+Math.sin(b.yaw)*step,z1=b.pos.z+Math.cos(b.yaw)*step;
  if(!walkable(x1,z1)||Math.hypot(x1,z1)>radius){b.yaw+=Math.PI*(.6+rand()*.8);h.next=now+.2;return;}
  h.move={x0:b.pos.x,z0:b.pos.z,x1,z1,start:now,time:sp.runs?step/1.3:.13,hop:sp.runs?0:.035*SIZE};h.bout--;
  if(h.bout<=0){h.next=now+(sp.runs?.3:.1)+range(b.key==='robin'?[.8,2.4]:sp.runs?[.8,2]:[.25,.9]);if(rand()<.55)b.peck=now;else if(sp.runs||b.key==='robin'){b.gaze.tr=(rand()-.5)*.9;b.gaze.ty=(rand()-.5)*.8;b.gaze.next=now+.9;}}
  else h.next=now+(sp.runs?.02:.06+rand()*.06);
 }
 function lookAround(b,now,dt){
  const hd=b.gaze;
  if(b.roost){hd.ty=2.5;hd.tp=.45;hd.tr=0;}
  else if(now>hd.next){
   // Small birds look in quick jerks, holding each glance a moment.
   if(rand()<.08){hd.ty=(rand()<.5?-1:1)*2.2;hd.tp=.45;hd.next=now+range([1,2.2]);}// preen
   else{hd.ty=(rand()-.5)*2.6;hd.tp=(rand()-.5)*.5;hd.tr=rand()<.25?(rand()-.5)*.8:0;hd.next=now+range([.25,1.4]);}}
  let tp=hd.tp;if(b.peck&&now-b.peck<.28){tp=1.1*Math.sin(Math.PI*(now-b.peck)/.28);}
  if(b.singing>now){tp=-.35+Math.sin(now*38)*.04;}
  const k=Math.min(1,dt*(b.roost?3:22));hd.yaw+=(hd.ty-hd.yaw)*k;hd.pitch+=(tp-hd.pitch)*k;hd.roll+=(hd.tr-hd.roll)*k;
 }

 // ---- sound ---------------------------------------------------------------------
 let soundOn=false,disposed=false,hushSeen=AUDIO.hushed;const mine=new Set();
 function sound(name,b,env,level=1,quiet=false){
  if(!soundOn||!env.listener||disposed)return 0;const ctx=AUDIO.ctx;if(!ctx||ctx.state!=='running')return 0;
  const d=Math.hypot(b.pos.x-env.listener.x,b.pos.y-env.listener.y,b.pos.z-env.listener.z);if(d>55)return 0;
  if(AUDIO.voices.size>=4&&!quiet)return 0;const count=SOUNDS[name]||0;if(!count)return 0;
  const url=soundUrl(name,1+Math.floor(rand()*count)),buf=loadSound(url);if(!buf)return 0;
  try{const src=ctx.createBufferSource(),gain=ctx.createGain(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null;
   src.buffer=buf;src.playbackRate.value=1+(rand()-.5)*.06;filter.type='lowpass';src.connect(filter);filter.connect(gain);if(pan){gain.connect(pan);pan.connect(AUDIO.master);}else gain.connect(AUDIO.master);
   const v={src,gain,filter,pan,bird:b,level:level*b.sp.voice,end:ctx.currentTime+buf.duration};place(v,env.listener,true);src.start();AUDIO.voices.add(v);mine.add(v);
   src.onended=()=>{AUDIO.voices.delete(v);mine.delete(v);try{src.disconnect();gain.disconnect();filter.disconnect();pan?.disconnect();}catch(_){}};
   return buf.duration;}catch(_){return 0;}
 }
 function place(v,listener,now){const b=v.bird,dx=b.pos.x-listener.x,dz=b.pos.z-listener.z,d=Math.hypot(dx,b.pos.y-listener.y,dz),s=voiceShape(d,v.level),t=AUDIO.ctx.currentTime;
  // Camera forward is (-sin yaw, -cos yaw); its right is (cos yaw, -sin yaw).
  const right=(dx*Math.cos(listener.yaw)-dz*Math.sin(listener.yaw))/Math.max(.5,Math.hypot(dx,dz));
  if(now){v.gain.gain.value=s.gain;v.filter.frequency.value=s.cutoff;if(v.pan)v.pan.pan.value=clamp(right*.85,-.85,.85);}
  else{v.gain.gain.setTargetAtTime(s.gain,t,.05);v.filter.frequency.setTargetAtTime(s.cutoff,t,.08);if(v.pan)v.pan.pan.setTargetAtTime(clamp(right*.85,-.85,.85),t,.05);}}
 function preload(){for(const b of birds){for(const n of [b.sp.song,b.sp.alarm])if(n&&SOUNDS[n])for(let i=1;i<=SOUNDS[n];i++)loadSound(soundUrl(n,i));}for(let i=1;i<=SOUNDS['wing-flutter'];i++)loadSound(soundUrl('wing-flutter',i));}
 function singRate(b,env){const sp=b.sp,h=env.hour;let r=sp.season[env.month]??1;
  if(env.lamp>.55)return b.key==='robin'?.12:0; // a robin under a lamp sometimes sings on
  if(h>=4.5&&h<8)r*=2.2;else if(h>=17&&h<19.5)r*=1.3;else if(h>=12&&h<15)r*=.7;
  if(env.rain>.3)r*=.3;if(env.wind.speed>.5)r*=.6;return r;}

 // ---- per frame -------------------------------------------------------------------
 let last=null,hidden=false;const tmpQ=new T.Quaternion(),tmpE=new T.Euler(0,0,0,'YXZ');
 function update(time,ctx={}){
  if(disposed)return;const now=Number.isFinite(time)?time:performance.now()/1000,dt=last===null?0:clamp(now-last,0,.1);
  if(last===null)for(const b of birds){b.until=now+range([1,9]);b.nextSong=now+range([1,b.sp.gap[1]]);}last=now;
  const env={...(ctx.environment||environment()),listener:ctx.listener||null},reduced=!!ctx.reduced;
  // A hush from elsewhere (the microphone opening) must not leave us muted.
  if(hushSeen!==AUDIO.hushed){hushSeen=AUDIO.hushed;soundOn=false;}
  // Out of sight and earshot, the garden rests.
  const far=env.listener&&Math.hypot(env.listener.x,env.listener.z)>90;if(far!==hidden){hidden=far;group.visible=!far;}
  const wantSound=!!ctx.sound&&!far&&!!env.listener;if(wantSound&&!AUDIO.ctx)audioContext();
  if(AUDIO.master){const target=wantSound?1:0;if(wantSound!==soundOn){soundOn=wantSound;AUDIO.master.gain.setTargetAtTime(target,AUDIO.ctx.currentTime,wantSound?.4:.08);if(wantSound)preload();}}
  if(far)return;
  for(const b of birds){
   const sp=b.sp,listener=env.listener;
   // Roost at dusk, wake at dawn.
   if(env.lamp>.55&&!b.roost&&b.state!=='fly'&&!reduced){b.roost=true;goSomewhere(b,now,env,false);}
   else if(env.lamp<.4&&b.roost){b.roost=false;b.until=now+range([.5,6]);}
   if(b.state==='fly')fly(b,now,dt,env);
   else{
    const d=listener?Math.hypot(b.pos.x-listener.x,(b.pos.y-listener.y)*.6,b.pos.z-listener.z):99,scare=b.roost?1:sp.fid*(b.state==='ground'?1:.75);
    if(!reduced&&d<scare){goSomewhere(b,now,env,true);}
    else if(!reduced&&now>b.until&&!b.roost){goSomewhere(b,now,env,false)||(b.until=now+2);}
    if(b.state==='perch')perched(b,now,dt,env);else if(b.state==='ground')(reduced?null:forage(b,now,dt,env));
    if(now>b.nextSong&&(!b.roost||b.key==='robin')){const r=singRate(b,env);if(r>0&&rand()<Math.min(1,r)){const took=sound(sp.song,b,env);b.singing=now+(took||1.5);}b.nextSong=now+range(sp.gap)/Math.max(.25,r||.25)+(b.singing>now?b.singing-now:0);}
   }
   if(sp.flock&&b.state==='fly'&&b.singing<now&&rand()<dt*.3)b.singing=now+(sound(sp.song,b,env,.6,true)||1);// goldfinches twitter on the wing
   lookAround(b,now,dt);
   b.bob=Math.max(0,b.bob-dt*4);b.wingFlick=Math.max(0,b.wingFlick-dt*3);b.fluff=lerp(b.fluff,b.roost||env.rain>.3||env.lamp>.55?1.15:1,Math.min(1,dt*2));
   // Pose the meshes.
   const o=b.obj;o.position.copy(b.pos);tmpE.set(b.pitch+(b.bob?Math.sin(b.bob*Math.PI)*.35:0),b.yaw,b.roll);o.quaternion.setFromEuler(tmpE);
   // Perched birds keep the head level while the body tilts.
   b.body.scale.set(b.fluff,b.fluff,1+(b.fluff-1)*.4);b.head.rotation.set(b.gaze.pitch-(b.state==='fly'?0:b.pitch)*.8,b.gaze.yaw,b.gaze.roll);
   const fold=clamp(b.fold,0,1),open=1-fold,flick=b.wingFlick?Math.sin(b.wingFlick*Math.PI)*.35:0,flap=b.flap*open;
   // A real wing folds at the wrist, so the closed wing is half its open span.
   const span=1-.42*fold,chord=1-.3*fold;b.wingR.scale.set(span,1,chord);b.wingL.scale.set(span,1,chord);
   b.wingR.rotation.set(-Math.PI/2*fold,Math.PI/2*.95*fold-flick,flap-.06*fold);
   b.wingL.rotation.set(-Math.PI/2*fold,-Math.PI/2*.95*fold+flick,-flap+.06*fold);
  }
  if(soundOn&&env.listener)for(const v of mine)place(v,env.listener,false);
 }
 function dispose(){disposed=true;for(const v of mine){try{v.src.stop();}catch(_){}}mine.clear();group.removeFromParent();for(const g of geos.values())for(const geo of Object.values(g))geo.dispose();material.dispose();parts.dispose();}
 return{group,birds,perches,update,dispose,get soundOn(){return soundOn;}};
}

// Perch points along the top of any object: its highest edge, spread out.
// Used for the house ridge and garden furniture.
function topPerches(T,object,frame,count=3,kind='ridge'){
 frame.updateMatrixWorld(true);const inv=new T.Matrix4().copy(frame.matrixWorld).invert(),v=new T.Vector3(),pts=[];let top=-Infinity;
 object.updateMatrixWorld(true);object.traverse(o=>{if(!o.isMesh||!o.geometry?.attributes?.position||o.material?.transparent)return;const p=o.geometry.attributes.position,m=new T.Matrix4().multiplyMatrices(inv,o.matrixWorld);for(let i=0;i<p.count;i+=1){v.fromBufferAttribute(p,i).applyMatrix4(m);if(v.y>top-.3){pts.push(v.clone());if(v.y>top)top=v.y;}}});
 const high=pts.filter(p=>p.y>top-.06);if(!high.length)return[];
 let ax='x';{const xs=high.map(p=>p.x),zs=high.map(p=>p.z);ax=Math.max(...xs)-Math.min(...xs)>=Math.max(...zs)-Math.min(...zs)?'x':'z';}
 high.sort((a,b)=>a[ax]-b[ax]);const out=[];for(let i=0;i<count;i++){const p=high[Math.round((high.length-1)*(count===1?.5:i/(count-1)))];out.push({x:p.x,y:p.y,z:p.z,kind});}
 return out.filter((p,i,a)=>a.findIndex(q=>Math.hypot(q.x-p.x,q.z-p.z)<.25)===i);
}

// Hush every garden bird at once, e.g. the moment the microphone opens.
function silence(){AUDIO.hushed++;if(AUDIO.master&&AUDIO.ctx)AUDIO.master.gain.setValueAtTime(0,AUDIO.ctx.currentTime);for(const v of AUDIO.voices){try{v.src.stop();}catch(_){}}}

root.BurbzGardenBirds={SPECIES,LOOKS,SOUNDS,SIZE,WIND_DIR,environment,voiceShape,create,topPerches,silence};
if(typeof module==='object'&&module.exports)module.exports=root.BurbzGardenBirds;
})(typeof globalThis!=='undefined'?globalThis:this);
