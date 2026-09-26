'use strict';
// Alderwing living water v496: world-anchored flowing ripples on every stream,
// river and lake; waterfalls that arc off their lips; settlement rivers that
// run on as streams; a reservoir that meets its distant water; flecks that
// ride the current; and running water you can hear.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const W=require('../world_water_core.js');
const BUILD='alderwing-water-v496-20260926';
// A beck over a 12m crag: flat, then 10m of 1.2 grade, then gentle again.
const line=[];for(let x=-10;x<=70;x+=5)line.push({x,z:3});
const crag=(x,z)=>x<20?50:x<30?50-(x-20)*1.2:38-(x-30)*.02;

test('streams hug their ground and carry their flow direction to the shader',()=>{
 const p=W.prepare(line,'stream',false,crag),cells=[{x:-32,z:-16},{x:0,z:-16},{x:32,z:-16},{x:64,z:-16}],parts=cells.map(c=>W.build(c,32,[p],crag));
 for(const o of parts){assert.equal(o.shape.length,o.positions.length/3*4,'four shape values per vertex');
  for(let i=0;i<o.positions.length/3;i++){const part=o.shape[i*4+3];if(part===1)continue;const x=o.positions[i*3],y=o.positions[i*3+1],c=cells[parts.indexOf(o)];
   // No stream floats: every ribbon vertex sits 8cm over its own ground, falls included.
   assert(Math.abs(y-(crag(x+c.x,0)+.08))<1e-6,'ribbon on the ground at x='+(x+c.x));
   assert(Math.abs(Math.hypot(o.shape[i*4],o.shape[i*4+1])-1)<1e-6,'unit flow direction');}}
 assert(parts.some(o=>o.shape.some((v,i)=>i%4===3&&v===2)),'the rock a fall pours down is marked');
 assert(parts.some(o=>o.shape.some((v,i)=>i%4===3&&v===1)),'the plunge pool is marked');
});

test('a waterfall arcs off its lip, stays clear of the rock and lands in its pool',()=>{
 const p=W.prepare(line,'stream',false,crag),parts=[{x:0,z:-16},{x:32,z:-16}].map(c=>({c,o:W.build(c,32,[p],crag)}));
 const owners=parts.filter(({o})=>o.curtain.indices.length);assert.equal(owners.length,1,'one chunk owns the sheet: the one holding its lip');
 const {c,o}=owners[0],P=o.curtain.positions,F=o.curtain.flow;assert.equal(F.length,P.length/3*4);
 let lipY=-Infinity,footY=Infinity,air=0;
 for(let i=0;i<P.length/3;i++){const x=P[i*3]+c.x,y=P[i*3+1],u=F[i*4+2];assert(y>=crag(x,0)-1e-6,'never inside the rock at x='+x.toFixed(2));if(u===0)lipY=Math.max(lipY,y);if(u>.999)footY=Math.min(footY,y);air=Math.max(air,y-crag(x,0));}
 assert(Math.abs(lipY-(50+.1))<.2,'the sheet leaves the lip at stream level: '+lipY);assert(footY<38.4,'it lands at the pool: '+footY);
 assert(air>1.5,'the steep fall stands off the rock face: '+air.toFixed(2));
 const rows=P.length/15;assert(rows>=7,'rows run down the sheet: '+rows);
 for(let r=1;r<rows;r++){const a=(r-1)*5+2,b=r*5+2,d=Math.hypot(P[b*3]-P[a*3],P[b*3+1]-P[a*3+1],P[b*3+2]-P[a*3+2]);assert(d<1.6,'rows stay close enough to curve smoothly: '+d.toFixed(2));}
 const foot=parts.find(({o})=>o.splash.length);assert(foot,'droplets are thrown up where it lands');assert(foot.o.splash.every(s=>s.rise>0&&s.speed>0&&s.size>0));
});

test('overlapping map pieces draw once, and mapped lakes and river areas draw their own water',()=>{
 const flat=()=>10,a=W.prepare(line,'river',false,flat),b=W.prepare(line.slice(3),'river',false,flat);
 const one=W.build({x:0,z:-16},32,[a],flat),two=W.build({x:0,z:-16},32,[a,b],flat);
 assert.equal(two.indices.length,one.indices.length,'the second tile piece skips what the first drew');
 const wet=W.build({x:0,z:-16},32,[a],flat,{wet:(x,z)=>x>10});assert(wet.indices.length<one.indices.length&&wet.indices.length>0,'no ribbon over a mapped lake');
});

test('a settlement river narrows away along its own widths',()=>{
 const p=W.prepare([{x:0,z:0},{x:60,z:0}],'river',false,()=>5,q=>q.x<30?3.2:3.2*(1-(q.x-30)/30));
 assert(p.samples.every(q=>Number.isFinite(q.w)));assert.equal(W.at(p,10).w,3.2);assert(W.at(p,50).w<1.2);
 const o=W.build({x:0,z:-16},64,[p],()=>5),halves=[];for(let i=0;i<o.shape.length;i+=4)halves.push(o.shape[i+2]);
 assert(Math.max(...halves)<=1.6+1e-9&&Math.min(...halves)<1,'the ribbon follows each sample width');
});

test('the nearest running water and every fall in reach, for the ear and the flecks',()=>{
 const p=W.prepare(line,'stream',false,crag),n=W.nearest([p],5,6,60);
 assert(n.water&&Math.abs(n.water.d-(3-1.1))<.05,'distance is to the water edge: '+n.water.d);assert.equal(n.water.kind,'stream');
 assert.equal(n.falls.length,1);assert(Math.abs(n.falls[0].drop-12)<.01);
 assert.equal(W.nearest([p],5,500,60).water,null,'nothing in reach');
});

test('small quick water babbles, broad water rushes, falls roar, each from its side',()=>{
 const at=(water,falls=[])=>W.listen({water,falls},{x:0,y:1.4,z:0,yaw:0});
 const beck=at({d:1,x:2,y:0,z:0,width:2.2,steep:.6,kind:'stream'}),river=at({d:1,x:2,y:0,z:0,width:12,steep:0,kind:'river'});
 assert(beck.brook.level>beck.river.level,'a lively beck babbles');assert(river.river.level>river.brook.level,'a broad river rushes');
 // Facing -z, water at +x is on the right.
 assert(beck.brook.pan>0,'heard from the right');assert(at({d:1,x:-2,y:0,z:0,width:2.2,steep:.6,kind:'stream'}).brook.pan<0,'and from the left');
 assert(at({d:40,x:40,y:0,z:0,width:2.2,steep:.6,kind:'stream'}).brook.level===0,'a far beck is silent');
 assert(at({d:1,x:2,y:0,z:0,width:4,steep:0,kind:'canal'}).river.level<at({d:1,x:2,y:0,z:0,width:4,steep:0,kind:'river'}).river.level,'a canal barely moves');
 const fall=at(null,[{d:20,drop:12,x:0,y:0,z:-20}]),big=at(null,[{d:20,drop:30,x:0,y:0,z:-20}]);
 assert(fall.fall.level>0&&big.fall.level>fall.fall.level,'a bigger drop roars louder');assert(fall.fall.cutoff<15000,'distance softens the top end');
 const high=at({d:1,x:2,y:-60,z:0,width:2.2,steep:.6,kind:'stream'});assert.equal(high.brook.level,0,'flying high, the beck falls silent');
});

test('the water tile repeats seamlessly and carries ripples, foam and caustics',()=>{
 const t=W.texture(64),t2=W.texture(64);assert.deepEqual(t.data,t2.data,'made the same way every time');
 const n=64*64;let r=0,g=0,bLo=255,bHi=0,aHi=0;for(let i=0;i<n;i++){r+=t.data[i*4];g+=t.data[i*4+1];bLo=Math.min(bLo,t.data[i*4+2]);bHi=Math.max(bHi,t.data[i*4+2]);aHi=Math.max(aHi,t.data[i*4+3]);}
 assert(Math.abs(r/n-127.5)<6&&Math.abs(g/n-127.5)<6,'ripple slopes average flat');assert(bLo<30&&bHi>225,'foam spans its range');assert(aHi>240,'caustic lines are bright');
 // Opposite edges continue each other: the step across the wrap is no larger than steps inside.
 let wrap=0,inside=0;for(let y=0;y<64;y++){const e=(x)=>t.data[(y*64+x)*4+2];wrap=Math.max(wrap,Math.abs(e(0)-e(63)));for(let x=1;x<64;x++)inside=Math.max(inside,Math.abs(e(x)-e(x-1)));}
 assert(wrap<=inside,'foam wraps: '+wrap+' vs '+inside);
});

test('every water material shares one look, compiles its hooks and moves with one clock',()=>{
 global.THREE=require('../lib/three.min.js');global.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){},beginPath(){},moveTo(){},bezierCurveTo(){},fill(){},stroke(){},lineTo(){}}),width:0,height:0})};
 require('../shore_water.js');require('../world_water.js');const T=global.THREE,S=globalThis.BurbzShoreWater,WW=globalThis.BurbzWorldWater,styled=[];
 const lambert=()=>({uniforms:{},vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader});
 for(const [name,m,marks] of [['stream',WW.streamMaterial(T,{time:S.sky.time,style:x=>styled.push(x)}),['shoreTap(','shoreSurface(','discard','streamShape']],['fall',WW.fallMaterial(T,{time:S.sky.time,style:x=>styled.push(x)}),['fallFlow','shoreSurface(']]]){
  const shader=lambert();m.onBeforeCompile(shader);for(const mark of marks)assert((shader.vertexShader+shader.fragmentShader).includes(mark),name+' has '+mark);
  assert(shader.fragmentShader.indexOf('uniform sampler2D shoreMap')<shader.fragmentShader.indexOf('void main'),name+' declares the shared water before main');
  assert.equal(shader.uniforms.shoreTime,S.sky.time,name+' runs on the shared clock');assert.equal(shader.uniforms.shoreMap,S.sky.map,name+' samples the shared tile');}
 assert.equal(styled.length,2,'both are fogged like the land');
 const lake=new T.MeshLambertMaterial();S.style(lake,S.sky.time,{flows:[{ax:0,az:0,bx:10,bz:0}],flowSpeed:.8});const shader=lambert();lake.onBeforeCompile(shader);
 assert(shader.fragmentShader.includes('shoreCurrent(')&&shader.fragmentShader.includes('shoreStill('),'a river area flows; still water drifts');assert.equal(shader.uniforms.shoreFlows.value,1);
 assert(S.sky.map.value.generateMipmaps&&S.sky.map.value.wrapS===T.RepeatWrapping,'the tile is mipmapped and repeats, so distant ripples never shimmer');
 const horizon=read('world_horizon.js');assert(horizon.includes('shoreSurface(gl_FragColor.rgb,horizonWorld,shoreStill(horizonWorld)'),'distant water uses the same look');
});

test('the world wiring: settlement rivers run as streams, stepped cascades are gone, lakes bend onto the distant water',()=>{
 const world=read('village_world.js');
 assert(!world.includes('cascadeMesh')&&!world.includes('k.cascades(')&&!world.includes('alderwing-cascade-v408'),'no stepped cascades');
 assert(world.includes("if(corridor.kind!=='river')for(const bank of"),'settlement rivers are no longer flat ribbons');
 assert(/function riverCorridors\(\)/.test(world)&&world.includes('c.object.visible=false'),'neighbours\' flat river planes give way to streams');
 assert(world.includes('function waterSurface(options){const m=groundMaterial.clone();styleFog(m);styleGround(m);'),'lake and sea chunks bend like the ground');
 assert(world.includes('const farWater=[.018,.05,.07];'),'distant water starts from the near deep colour');
 assert(world.includes('{wet:(x,z)=>lakeIn(ctx,x,z)}'),'streams leave mapped lakes to the lake water');
 assert(world.includes('waterSound?.update(null,.2)'),'indoors the water falls silent');
 assert(world.includes("createSound({allowed:()=>!s.room&&root.BurbzCalmAudio?.birds?.()===true})"),'water sounds only with sound on, the page in view and the microphone closed');
});

test('v496 ships together: build marker, cache, three worker lists, loader, updater and sounds',()=>{
 const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js'),updater=fs.readFileSync(path.join(repo,'scripts/update-live-burbz.sh'),'utf8');
 assert(html.includes("const BURBZ_BUILD = '"+BUILD+"';"));assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].endsWith('-'+BUILD));
 for(const file of ['shore_water.js','world_horizon.js','world_water_core.js','world_water.js','village_world.js','village_walk.js'])assert.equal(sw.split("'./"+file+"?v="+BUILD+"'").length-1,3,file+' in all three worker lists');
 for(const file of ['shore_water.js','world_horizon.js','world_water_core.js','world_water.js','village_world.js'])assert(walk.includes("'"+file+"':'"+BUILD+"'"),'loader pin '+file);
 assert(html.includes('village_walk.js?v='+BUILD));
 const manifest=JSON.parse(read('assets/audio/water/manifest.json'));assert.equal(manifest.assets.length,3);
 for(const a of manifest.assets){const bytes=fs.readFileSync(path.join(root,'assets/audio/water',a.path));assert.equal(bytes.length,a.bytes,a.path);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),a.sha256,a.path);
  assert.equal(sw.split("'./assets/audio/water/"+a.path+"'").length-1,3,a.path+' cached offline');assert(updater.includes('"assets/audio/water/'+a.path+'"'),'updater '+a.path);
  assert(read('world_water.js').includes("'assets/audio/water/"+a.path+"'"),'played by the world: '+a.path);}
 assert(updater.includes('"assets/audio/water/manifest.json"'));assert(read('assets/audio/ATTRIBUTION.md').includes('## Running water (26 September 2026)'));
});
