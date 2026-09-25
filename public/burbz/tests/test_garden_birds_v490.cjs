'use strict';
// Academy garden birds v490: the Academy grows as a tree beside the built
// house, carrying only the buildings the player has built, and garden birds
// live round it — perching, foraging, flying in bounds or straight, crabbing
// in a side wind, facing into the wind, fleeing, roosting and singing made
// (never recorded) songs that hush while Merlin's wand listens.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const BUILD='academy-garden-birds-v490-20260925';
global.THREE=require('../lib/three.min.js');const T=global.THREE;
const C=require('../player_home_core.js'),G=require('../garden_birds.js');

test('the Academy tree takes a clear spot beside a built house, and only a built house',()=>{
 const shelter=C.normalize(null);assert.equal(shelter.academyTree,null);assert.equal(C.academyTree(shelter),null);
 const built=C.propose(shelter,{branches:99},{kind:'build-home',expectedRevision:0,lat:54.45,lon:-2.65});assert(built.ok,built.error);
 const spot=built.home.academyTree;assert.deepEqual(spot,{x:-8,z:-2.5});
 const fp=C.houseFootprint(built.home),gap=Math.abs(spot.x)-fp.w/2-C.ACADEMY_TREE.clear;assert(gap>0&&Math.hypot(spot.x,spot.z)<11,'beside the house, clear of it');
 // A garden already using that spot keeps everything; the tree takes the next clear spot.
 const busy=C.normalize({...built.home,academyTree:null,owned:{...built.home.owned,picnic:1},placed:[{id:1,item:'picnic',area:'yard',x:-8,z:-2.5,turn:0}]});
 assert.equal(busy.placed.length,1);assert.notDeepEqual(busy.academyTree,spot);assert(busy.academyTree);
 // Once saved, the spot stays put.
 assert.deepEqual(C.normalize(JSON.parse(JSON.stringify(built.home))).academyTree,spot);
});

test('the tree keeps its roots clear and the player out of its trunk and low houses',()=>{
 const home=C.propose(C.normalize(null),{branches:99},{kind:'build-home',expectedRevision:0,lat:54.45,lon:-2.65}).home,t=home.academyTree;
 home.owned.bench=2;
 const near=C.propose(home,{branches:0},{kind:'place',item:'bench',area:'yard',x:t.x+1,z:t.z,turn:0});assert.equal(near.ok,false);assert.match(near.error,/Academy tree/);
 const far=C.propose(home,{branches:0},{kind:'place',item:'bench',area:'yard',x:5,z:-5,turn:0});assert(far.ok,far.error);
 const plot=C.proposeFarm(home,{branches:9,coins:0},{},{kind:'farm-plot',x:-8,z:0});assert.equal(plot.ok,false);assert.match(plot.error,/Academy tree/);
 const w=C.world(home,'yard');assert.equal(w.allowed(t.x,t.z),false);assert.equal(w.allowed(t.x+2.5,t.z),false);assert.equal(w.allowed(t.x+C.ACADEMY_TREE.walk+.4,t.z),true);
 assert(C.ACADEMY_TREE.walk+.27<=C.ACADEMY_TREE.clear,'a clear garden spot is always walkable');
});

test('the garden tree grows from the 3D Academy: only built houses, perches for birds, a little taller than the woodland',()=>{
 const src=read('academy_3d_core.js');
 assert.match(src,/function buildHomeTree\(three, built, opts\)/);assert.match(src,/if \(list\.indexOf\(id\) < 0\) \{\s*perches\.push/);
 assert.match(src,/buildHomeTree: buildHomeTree/);assert.match(src,/HOME_TREE_SCALE = 0\.56/);
 // The Academy screen's own tree is unchanged: leaf cards unless crowns are asked for.
 assert.match(src,/var crowns = !!\(opts && opts\.crowns\);/);assert.match(src,/buildTree\(mats, rng, \{ crowns: true \}\)/);assert.match(src,/var tree = buildTree\(mats, rng\);/);
 // The woodland's own crown colours.
 for(const tone of ['0x4d6d34','0x557636'])assert(src.includes(tone));
 const scene=read('player_home_scene.js');assert.match(scene,/root\.BurbzAcademyBuiltRooms\?\.\(\)/);assert.match(scene,/tree\.group\.rotation\.y=Math\.atan2\(-spot\.x,8-spot\.z\)/);
 assert.match(read('index.html'),/window\.BurbzAcademyBuiltRooms = \(\) => academyBuiltRoomIds\(\);/);
});

// A tiny garden: a tree with perches, a house to fly round, and a lawn.
function garden(options={}){
 const perches=[];for(let i=0;i<24;i++){const a=i*.9;perches.push({x:-8+Math.sin(a)*2.2,y:2+i%5,z:-2.5+Math.cos(a)*2.2,kind:['twig','bough','deck','roof','top'][i%5]});}
 perches.push({x:0,y:4.4,z:0,kind:'ridge'},{x:1.5,y:4.4,z:0,kind:'ridge'},{x:4,y:1.15,z:7,kind:'bath'},{x:-4,y:1.5,z:7,kind:'feeder'},{x:5,y:1.2,z:-5,kind:'rail'});
 return G.create(T,{perches,ground:()=>0,walkable:(x,z)=>Math.hypot(x,z)<14&&!(Math.abs(x)<3.2&&Math.abs(z)<2.7)&&Math.hypot(x+8,z+2.5)>3.5,obstacles:[{x:0,z:0,r:3.8,top:4.6},{x:-8,z:-2.5,r:1.1,top:4}],radius:13,seed:7,...options});
}
function simulate(flock,seconds,env,listener={x:0,y:1.4,z:16,yaw:0},step=1/30,start=0,each){let t=start;for(let i=0;i<seconds/step;i++){t+=step;flock.update(t,{environment:{hour:12,month:8,rain:0,lamp:0,wind:{speed:.2,x:-.93,z:-.37},...env},listener,sound:false});each?.(t);}return t;}

test('twelve birds of seven garden species, each drawn in four parts on one material',()=>{
 const f=garden();assert.equal(f.birds.length,12);
 const count=k=>f.birds.filter(b=>b.key===k).length;assert.deepEqual({robin:count('robin'),bluetit:count('bluetit'),greattit:count('greattit'),chaffinch:count('chaffinch'),goldfinch:count('goldfinch'),wren:count('wren'),blackbird:count('blackbird')},{robin:1,bluetit:2,greattit:1,chaffinch:2,goldfinch:3,wren:1,blackbird:2});
 // A territorial robin is alone; males and females of the pairs look different.
 assert.deepEqual(f.birds.filter(b=>b.key==='chaffinch').map(b=>b.look).sort(),['chaffinchF','chaffinchM']);assert.deepEqual(f.birds.filter(b=>b.key==='blackbird').map(b=>b.look).sort(),['blackbirdF','blackbirdM']);
 const materials=new Set();f.group.traverse(o=>{if(o.isMesh)materials.add(o.material);});assert.equal(materials.size,1);
 let meshes=0;f.group.traverse(o=>{if(o.isMesh)meshes++;});assert.equal(meshes,48);
 // Real sizes (a touch larger for a phone): a blackbird is nearly twice a wren.
 const len=k=>f.birds.find(b=>b.key===k).len;assert(len('blackbird')/len('wren')>2.2);assert.equal(G.SIZE,1.5);
 f.dispose();
});

test('birds perch, forage and fly, and every flight lands where it was going',()=>{
 const f=garden(),landed=new Set(),flew=new Set();let prev=f.birds.map(b=>b.state);
 simulate(f,90,{},undefined,1/30,0,()=>{f.birds.forEach((b,i)=>{assert(Number.isFinite(b.pos.x+b.pos.y+b.pos.z),'finite');if(b.state==='fly')flew.add(b.key);if(prev[i]==='fly'&&b.state!=='fly')landed.add(b.key);prev[i]=b.state;});});
 assert(flew.size>=6,'most species fly: '+[...flew]);assert(landed.size>=5,'and land: '+[...landed]);
 for(const b of f.birds)if(b.state==='perch'){assert(b.perch);assert(Math.abs(b.pos.y-(b.perch.y+(b.hang?-b.foot*.9:b.foot)))<1e-6);}
 // No two birds share a perch.
 const taken=f.birds.filter(b=>b.perch).map(b=>b.perch.i);assert.equal(new Set(taken).size,taken.length);
 f.dispose();
});

test('tits and finches fly in bounds, closing their wings to dip; robins, wrens and blackbirds beat on',()=>{
 const f=garden(),folded={bound:[0,0],direct:[0,0]};
 simulate(f,120,{},undefined,1/60,0,()=>{for(const b of f.birds)if(b.state==='fly'&&b.flight.s>.15&&b.flight.s<.8){const k=b.sp.flight==='bound'?'bound':'direct';folded[k][0]++;if(b.fold>.8)folded[k][1]++;}});
 const share=k=>folded[k][1]/Math.max(1,folded[k][0]);
 assert(folded.bound[0]>50&&folded.direct[0]>50);assert(share('bound')>.2,'bounding birds fold: '+share('bound'));assert(share('direct')<share('bound')/2,'direct fliers keep beating');
 f.dispose();
});

test('in a side wind a flying bird crabs: its body turns into the wind while it tracks to its perch',()=>{
 const f=garden();let crab=0,n=0;const w={speed:.8,x:-.93,z:-.37};
 simulate(f,90,{wind:w},undefined,1/60,0,()=>{for(const b of f.birds){if(b.state!=='fly'||b.flight.s<.2||b.flight.s>.8)continue;const fl=b.flight,dx=fl.B.x-fl.A.x,dz=fl.B.z-fl.A.z,d=Math.hypot(dx,dz);if(d<4)continue;const cross=Math.abs(w.x*dz/d-w.z*dx/d);if(cross<.7)continue;const track=Math.atan2(dx,dz);crab+=Math.abs(Math.atan2(Math.sin(b.yaw-track),Math.cos(b.yaw-track)));n++;}});
 assert(n>20,'side-wind flights sampled: '+n);assert(crab/n>.12,'mean crab angle '+(crab/n));
 f.dispose();
});

test('perched birds face into a strong wind; a close player sends them off; at dusk they roost in the tree',()=>{
 const f=garden(),w={speed:.8,x:-.93,z:-.37},into=Math.atan2(-w.x,-w.z);simulate(f,40,{wind:w});
 const off=f.birds.filter(b=>b.state==='perch'&&!b.hang).map(b=>Math.abs(Math.atan2(Math.sin(b.yaw-into),Math.cos(b.yaw-into))));assert(off.length>=3);assert(off.reduce((a,b)=>a+b,0)/off.length<.7);
 // Walk up to a bird on the lawn or a low perch: it flies.
 const b=f.birds.find(b=>b.state!=='fly'&&b.pos.y<2);if(b){const t=simulate(f,.5,{},{x:b.pos.x+.8,y:1.4,z:b.pos.z,yaw:0},1/30,100);assert.equal(b.state,'fly');}
 // Dusk: every bird goes to roost in the tree, head tucked, and stays.
 simulate(f,40,{lamp:1,hour:22},undefined,1/30,200);const roost=f.birds.filter(b=>b.roost&&b.state==='perch'&&['twig','bough','deck'].includes(b.perch.kind));assert(roost.length>=10,'roosting '+roost.length);
 for(const b of roost)assert(b.gaze.yaw>2);
 f.dispose();
});

test('songs follow the season and the hour; the robin sings in autumn, the chaffinch mostly does not',()=>{
 const S=G.SPECIES;assert.equal(S.robin.season[8],1);assert(S.chaffinch.season[8]<.5&&S.chaffinch.season[4]===1);assert(S.blackbird.season[9]<.5&&S.blackbird.season[3]===1);
 for(const sp of Object.values(S))assert.equal(sp.season.length,12);
 // Nearer is louder and brighter; far away is soft and dull.
 const near=G.voiceShape(1,1),far=G.voiceShape(30,1);assert(near.gain>far.gain*5);assert(near.cutoff>far.cutoff*2);
});

test('every song is a made ElevenLabs take on disk, listed and checksummed',()=>{
 const dir=path.join(root,'assets/audio/garden-birds'),manifest=JSON.parse(fs.readFileSync(path.join(dir,'manifest.json'),'utf8'));
 assert.match(manifest.generator,/ElevenLabs Sound Effects/);assert.match(fs.readFileSync(path.join(dir,'README.md'),'utf8'),/not recordings/);
 let files=0;for(const [name,n] of Object.entries(G.SOUNDS))for(let i=1;i<=n;i++){const rel=name+'-'+String(i).padStart(2,'0')+'.mp3',file=path.join(dir,rel);assert(fs.existsSync(file),rel);const entry=manifest.assets.find(a=>a.path===rel);assert(entry,'manifest '+rel);assert.equal(entry.sha256,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'));files++;}
 assert.equal(files,28);assert.equal(fs.readdirSync(dir).filter(n=>n.endsWith('.mp3')).length,28);
 // Each species sings its own song; the robin and blackbird have alarm calls.
 for(const sp of Object.values(G.SPECIES))assert(G.SOUNDS[sp.song],sp.song);assert(G.SOUNDS[G.SPECIES.robin.alarm]&&G.SOUNDS[G.SPECIES.blackbird.alarm]);
});

test('the game never lets Merlin\'s wand hear its own birds',()=>{
 const html=read('index.html');
 assert.match(html,/birds:\(\)=>sfxEnabled&&!burbzMicListening&&!mediaStream&&!document\.hidden/);
 // The looping treetops ambience from v487 hushes with the microphone too.
 assert.match(html,/birdsong:\(level,opts\)=>SFX\.birdsong\?\.\(burbzMicListening\|\|mediaStream\?0:level,opts\)/);
 assert.match(html,/if \(reason === 'sound-scan'\) \{\s*burbzMicListening = !!value;\s*if \(value\) window\.BurbzGardenBirds\?\.silence\?\.\(\);/);
 // Songs are placed in the world only; no button, card or scan plays a bird.
 const audio=read('audio_core.js');assert(!/garden-birds/.test(audio));
 assert.match(read('village_world.js'),/sound:!!root\.BurbzCalmAudio\?\.birds\?\.\(\)/);assert.match(read('player_home.js'),/sound:!!root\.BurbzCalmAudio\?\.birds\?\.\(\)/);
 // With sound off the flock stays silent.
 const f=garden();simulate(f,2,{});assert.equal(f.soundOn,false);f.dispose();
});

test('after the wand\'s hush, the birds sing again once the microphone closes',()=>{
 const targets=[];global.AudioContext=function(){this.state='running';this.currentTime=0;this.destination={};this.createGain=()=>({gain:{value:0,setTargetAtTime:v=>targets.push(v),setValueAtTime:v=>targets.push(v)},connect(){}});};
 global.fetch=()=>new Promise(()=>{});
 const f=garden(),ear={x:0,y:1.4,z:6,yaw:0},env={hour:12,month:8,rain:0,lamp:0,wind:{speed:.2,x:-.93,z:-.37}};
 f.update(1,{environment:env,listener:ear,sound:true});assert.equal(f.soundOn,true);assert.equal(targets.at(-1),1);
 G.silence();assert.equal(targets.at(-1),0);
 f.update(1.1,{environment:env,listener:ear,sound:true});assert.equal(f.soundOn,true);assert.equal(targets.at(-1),1,'fades back in');
 f.update(1.2,{environment:env,listener:ear,sound:false});assert.equal(f.soundOn,false);assert.equal(targets.at(-1),0);
 f.dispose();delete global.AudioContext;delete global.fetch;
});

test('v490 ships together: build marker, cache, three worker lists, loaders and updater',()=>{
 const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js'),updater=fs.readFileSync(path.join(repo,'scripts/update-live-burbz.sh'),'utf8');
 const LATER=['home-hub-v491-20260925'],shipped=[BUILD,...LATER],current=b=>shipped.includes(b);
 assert(shipped.some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));const cache=sw.match(/const BURBZ_CACHE = '([^']+)'/)[1];assert(cache.includes('-'+BUILD));
 const self={location:new URL('https://example.test/burbz/sw.js'),addEventListener(){}};
 for(const key of ['BURBZ_UK_BIRD_EXPANSION_50','BURBZ_UK_BIRD_EXPANSION_26','BURBZ_AU_BIRD_EXPANSION','BURBZ_UK_BIRD_EXPANSION_FINAL','BURBZ_AU_BIRD_EXPANSION_50'])self[key]={art:{}};
 const ctx=vm.createContext({self,URL,importScripts(){},console});vm.runInContext(sw,ctx);const lists=vm.runInContext('({BURBZ_ASSETS,BURBZ_CORE,BURBZ_INSTALL_REQUIRED})',ctx);
 const direct=['garden_birds.js','academy_3d_core.js','player_home_core.js','player_home_scene.js','player_home.js','village_walk.js'],lazy=['village_world.js'];
 for(const [name,urls] of Object.entries(lists)){for(const file of [...direct,...lazy])assert.equal(urls.filter(u=>u.startsWith('./'+file+'?v=')&&current(u.slice(file.length+5))).length,1,name+': '+file);for(const [n,c] of Object.entries(G.SOUNDS))for(let i=1;i<=c;i++)assert(urls.includes('./assets/audio/garden-birds/'+n+'-'+String(i).padStart(2,'0')+'.mp3'),name+' '+n);}
 for(const file of direct.filter(f=>f!=='village_walk.js'))assert(shipped.some(b=>html.includes('src="'+file+'?v='+b+'"')),'page '+file);assert(shipped.some(b=>html.includes("village_walk.js?v="+b)));
 for(const file of lazy)assert(shipped.some(b=>walk.includes("'"+file+"':'"+b+"'")),'loader pin '+file);
 assert(updater.includes('"garden_birds.js"'));assert(updater.includes('"assets/audio/garden-birds/robin-song-01.mp3"'));
 for(const file of fs.readdirSync(root).filter(n=>/\.(js|html)$/.test(n))){const text=read(file);for(const mod of [...direct,...lazy]){const escaped=mod.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');for(const m of text.matchAll(new RegExp('(?<![\\w])'+escaped+'\\?v=([\\w-]+)','g')))assert(current(m[1]),file+': stale '+mod);}}
});
