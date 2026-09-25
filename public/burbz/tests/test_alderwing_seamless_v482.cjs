'use strict';
// Alderwing seamless v482: nothing pops as the viewer moves. The ground bends
// onto the distant land by distance, trees end one at a time on a round edge,
// canopy crowns carry the woods on, shadows hold still, and rain brings clouds.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const K=require('../village_world_core.js');
const BUILD='alderwing-seamless-v482-20260925';
global.THREE=require('../lib/three.min.js');const T=global.THREE;
global.document={createElement:()=>({style:{},addEventListener(){},remove(){}})};global.matchMedia=()=>({matches:false});
global.BurbzDaylightCore=require('../daylight_core.js');
require('../world_nature.js');require('../world_horizon.js');
const W=globalThis.BurbzWorldNature,H=globalThis.BurbzWorldHorizon,Sky=require('../world_sky.js');
const world=read('village_world.js'),SHADE=JSON.parse(world.match(/SHADE=(\[[^\]]+\])/)[1]);

test('the distances fit: every change happens where it cannot be seen as a line',()=>{
 const nearestEdge=K.CHUNK*(K.RINGS-1);
 assert(W.MORPH[1]<nearestEdge,'the ground has bent fully onto the distant land before the shown square can end');
 assert(W.MORPH[1]-W.MORPH[0]>=32,'over a wide band, as CDLOD morphs, so no vertex jumps');
 assert(W.END[0]+W.END[1]<=nearestEdge-W.EDGE,'far trees end inside the shown ground');
 assert(W.END[1]>=16,'each at its own distance across a wide band');
 assert(SHADE[1]<=W.END[0],'shadows have faded before any tree ends, so no shadow ever appears with one');
 assert(W.CROWNS[0]>=H.RISE[0]&&W.CROWNS[0]+W.CROWNS[1]<=H.RISE[1],'canopy crowns end where the distant canopy rises');
 const fine=H.LEVELS[0],reach=fine.cells/2*fine.step-fine.snap/2;
 assert(H.MORPH[1]<reach,'the fine distant grid bends onto the coarse one before its own edge');
});

test('trees are whole or nothing, end by distance, and canopy crowns take over across the same band',()=>{
 const text=read('world_nature.js'),shader=text.slice(text.indexOf('const VERTEX='),text.indexOf('function patch('));
 assert.equal((shader.match(/natureShow=[^;]*smoothstep/g)||[]).length,1,'only shrubs and ground plants fade');
 assert(shader.includes('*step(natureFlat,${END[0]}.+${END[1]}.*natureSeed.y)'),'far trees end by distance across the ground, tree by tree');
 assert(shader.includes('natureShow=step(${END[0]}.+${END[1]}.*natureSeed.z,natureFlat)*step(natureFlat,${CROWNS[0]}.+${CROWNS[1]}.*natureSeed.y)'),'canopy crowns start in the same band and end in their own');
 assert(shader.includes('transformed.y+=natureDrop*smoothstep(${MORPH[0]}.,${MORPH[1]}.,max(abs(natureOff.x),abs(natureOff.y)))'),'far trees ride the ground as it bends');
 for(const kind of ['crownBroad','crownConifer'])assert.equal(W.KINDS[kind].lod,4,kind);
 // Crossing the band, trees go and crowns come in step: the wood stays as full.
 for(let d=W.END[0];d<=W.END[0]+W.END[1];d+=2){const trees=(W.END[0]+W.END[1]-d)/W.END[1],crowns=(d-W.END[0])/W.END[1];assert(Math.abs(trees+crowns-1)<1e-9);}
});

test('pools share each kind\'s shape, carry a drop per plant and skip cells nothing in can show',()=>{
 const scene=new T.Scene(),eye={value:new T.Vector3(0,1.4,0)},edge={value:new T.Vector4(-160,-160,160,160)},n=W.create(T,scene,{style:()=>{},time:{value:0},eye,edge});
 const tree={x:10,y:0,z:10,drop:1.5};n.add('a','oakFar',[tree]);n.add('b','oakFar',[{x:10,y:0,z:300}]);
 n.add('c','crownBroad',[{x:200,y:0,z:0}]);n.add('e','crownConifer',[{x:600,y:0,z:600}]);n.update();n.flush();
 const mesh=(kind,x,z)=>scene.children.find(m=>m.name==='Alderwing '+kind&&Math.floor(m.boundingSphere.center.x/W.CELL)===Math.floor(x/W.CELL)&&Math.floor(m.boundingSphere.center.z/W.CELL)===Math.floor(z/W.CELL));
 const near=mesh('oakFar',10,10),far=mesh('oakFar',10,300),shared=near.geometry.attributes.position;
 assert.equal(near.geometry.attributes.natureDrop.array[0],1.5,'the drop is stored with the tree');
 assert.equal(far.geometry.attributes.position,shared,'cells share the kind\'s buffers');assert.notEqual(near.geometry.attributes.natureDrop,far.geometry.attributes.natureDrop,'each cell has its own drops');
 assert(near.visible&&!far.visible,'far trees beyond their end skip the draw');
 assert(mesh('crownBroad',200,0).visible,'canopy crowns in their ring draw');assert(!mesh('crownConifer',600,600).visible,'beyond it they skip');
 tree.drop=-2;n.redrop('oakFar',[tree]);n.flush();assert.equal(near.geometry.attributes.natureDrop.array[0],-2,'drops follow the distant land when it changes');
 // A released cell lets go of the shared buffers before it is disposed.
 n.remove('b');assert(!scene.children.includes(far));assert.equal(far.geometry.attributes.position,undefined);assert.equal(near.geometry.attributes.position,shared);
 n.dispose();
});

test('canopy crowns are cheap and read as a few trees together',()=>{
 const scene=new T.Scene(),n=W.create(T,scene,{style:()=>{},time:{value:0},eye:{value:new T.Vector3()},edge:{value:new T.Vector4(-1e6,-1e6,1e6,1e6)}});
 const box=kind=>{n.add(kind,kind,[{x:0,y:0,z:0}]);const mesh=scene.children.find(m=>m.name==='Alderwing '+kind);mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox;};
 const spread=b=>Math.max(b.max.x-b.min.x,b.max.z-b.min.z);
 const oak=box('oakFar'),broad=box('crownBroad'),spruce=box('spruceFar'),conifer=box('crownConifer');
 assert(spread(broad)>spread(oak)*1.2,'a broadleaf crown covers more than one tree');assert(broad.max.y<oak.max.y*1.3,'but stands no taller than a big tree');
 assert(spread(conifer)>spread(spruce)*1.2&&conifer.max.y<spruce.max.y*1.3,'conifers alike');
 const d=n.diagnostics();for(const kind of ['crownBroad','crownConifer'])assert(d.kinds[kind].triangles<=30,kind+': '+d.kinds[kind].triangles);
 n.dispose();
});

test('the ground bends onto the distant land by distance, fades its grass and eases new data in',()=>{
 assert(world.includes('float groundBend=max(1.0-smoothstep(0.0,12.0,groundInset),smoothstep(${MORPH[0]}.,${MORPH[1]}.,max(groundOff.x,groundOff.y)));'),'by square distance from the eye; its own edge still bends fully');
 assert(world.includes('diffuseColor.rgb*=mix(clamp(groundDetail,.55,1.5)*mix(.84,1.16,clamp(groundBroad*.5,0.,1.)),1.0,groundBent);'),'the grass detail fades as the ground becomes the untextured distant land');
 assert(world.includes('float groundEase=clamp((groundClock-groundFarPrev.z)/${FAR_EASE},0.,1.)'),'new map data eases in');
 assert(world.includes("FAR_EASE=(root.BurbzWorldHorizon?.BLEND||1200)/1000"),'with the distant land');
 assert(world.includes('height:(x,z)=>{const h=datum===null?null:joined(x,z,steadyRaw);'),'the distant land reads the same ground as the chunks, yards included');
 assert(world.includes('if(r&&(!c||r.z>c.z)){c=r;steadyHeights.set(key,c);}'),'and keeps the most detailed height it has read');
});

test('the distant land keeps the most detailed elevation tile first',()=>{
 const dem=v=>({dim:4,get:()=>v}),m={x:.5,z:.3,scale:1e7},tile=z=>{const n=2**z;return{z,x:Math.floor(m.x*n),y:Math.floor(m.z*n),dem:dem(z*10)};};
 assert.deepEqual(K.elevationSample([tile(14),tile(12)],m,0,0),{h:140,z:14});
 assert.deepEqual(K.elevationSample([tile(12)],m,0,0),{h:120,z:12});
 assert.equal(K.elevation([tile(14),tile(12)],m,0,0),140);assert.equal(K.elevationSample([],m,0,0),null);
});

test('a moved distant land draws the same; new data eases in and the ground follows at once',async()=>{
 let now=0;const realNow=performance.now,realFetch=global.fetch;performance.now=()=>now;global.fetch=()=>new Promise(()=>{});
 try{
  const scene=new T.Scene(),abort=new AbortController();abort.abort();let tint=0;
  const h=(x,z)=>100+20*Math.sin(x/90)+15*Math.cos(z/70);
  const D=H.create(T,scene,{origin:{lat:54,lon:-3},merc:{x:.49,z:.32,scale:2.3e7},style:()=>{},height:h,nature:(x,z,alt)=>({ground:[.2+tint,.4,.1],canopy:alt>110?4:0,water:false,wood:alt>110?.9:.1,conifer:.3,crown:[.1,.3,.1]}),signal:abort.signal,eye:{value:new T.Vector3()}});
  D.setDatum(100);const view={cut:{x0:-96,z0:-96,x1:96,z1:96},bend:{x0:-90,z0:-90,x1:90,z1:90}};
  const run=(player,frames)=>{for(let i=0;i<frames;i++){now+=16;D.update(player,view,now/1000);}};
  run({x:0,z:0},4000);assert(D.ready);const epoch=D.epoch;
  // Recentred on the same land: nothing drawn changes, so nothing eases.
  run({x:70,z:0},4000);assert.equal(scene.children.find(m=>m.name==='Alderwing horizon 0').position.x,64);assert.deepEqual(D.diagnostics().blend,[1,1]);assert.equal(D.epoch,epoch,'the ground keeps its bend');
  // New map data: the land eases in, and the ground and crowns follow from the start.
  tint=.3;D.refresh();run({x:70,z:0},4);assert(D.diagnostics().blend[0]<1);assert(D.epoch>epoch);assert(D.diagnostics().changes[0].points>0);
  // sampleAt reads the fine level across the triangles it draws.
  const L=D.lattice(64+16,32),S=D.sampleAt(64+16,32);assert(Math.abs(S.h-L.h)<1e-6&&Math.abs(S.canopy-L.canopy)<1e-6);
  const a=D.lattice(64,0),b=D.lattice(80,0),mid=D.sampleAt(72,0);assert(Math.abs(mid.h-(a.h+b.h)/2)<1e-6,'halfway along a lattice edge');
  assert(Math.abs(mid.wood-.9)<.9&&mid.crown.length===3);assert.equal(D.sampleAt(5000,0),null,'nothing off the grid');
  const text=read('world_horizon.js');
  assert(text.includes('horizonFine*max(smoothstep(${MORPH[0]}.,${MORPH[1]}.,max(abs(horizonOff.x),abs(horizonOff.y))),1.0-smoothstep(0.,32.,horizonInset))'),'the fine level bends by distance, and at its own edge if outrun');
  assert(text.includes('transformed.y+=horizonTop*smoothstep(${RISE[0]}.,${RISE[1]}.,length(horizonOff));'),'woods rise by distance alone');
  D.dispose();
 }finally{performance.now=realNow;global.fetch=realFetch;}
});

test('shadows hold still: whole texels across the light, faded before trees end',()=>{
 const texel=320/1024;
 for(let i=0;i<300;i++){const a=i*2.399,e=.15+.8*((i*7)%13)/13,d={x:Math.cos(a)*Math.cos(e),y:Math.sin(e),z:Math.sin(a)*Math.cos(e)};
  const side=[d.z/Math.hypot(d.x,d.z),0,-d.x/Math.hypot(d.x,d.z)],up=[d.y*side[2],d.z*side[0]-d.x*side[2],-d.y*side[0]],dot=(p,q)=>p.x*q[0]+p.y*q[1]+p.z*q[2];
  const x=Math.sin(i)*900,z=Math.cos(i*1.3)*900,c=K.shadowCentre(x,z,d,texel),gx=Math.round(x/16)*16,gz=Math.round(z/16)*16;
  for(const axis of [side,up]){const t=dot(c,axis)/texel;assert(Math.abs(t-Math.round(t))<1e-6,'whole texels');}
  assert(Math.abs(dot(c,[d.x,d.y,d.z])-(gx*d.x+gz*d.z))<1e-6,'same depth along the light');
  assert(Math.hypot(c.x-gx,c.y,c.z-gz)<texel,'within a texel of its 16m step');}
 assert(world.includes('centre=k.shadowCentre(x,z,direction,(camera.right-camera.left)/row.light.shadow.mapSize.x)'),'the world uses it');
 assert.equal(T.ShaderChunk.lights_fragment_begin.split('vDirectionalShadowCoord[ i ] ) : 1.0;').length,2,'three\'s light chunk has the line the fade patches');
 assert(world.includes('float cwShadowFade=smoothstep(${SHADE[0]}.,${SHADE[1]}.,vFogDepth);'),'shadows fade with distance');
});

test('the far ground builds ahead of a fast flight, and crowns 40m before they can show',()=>{
 assert(world.includes('const to={x:s.player.x+Math.max(-48,Math.min(48,ahead.x)),z:s.player.z+Math.max(-48,Math.min(48,ahead.z))}'),'chunks build nearest to where the viewer will be');
 assert(world.includes('reach=W.CROWNS[0]+W.CROWNS[1]+40'),'crown cells join before they show');
 assert(world.includes("map(([key,near])=>[key,near+(crownCells.has(key)?1e4:0)])"),'missing cells before changed ones');
 assert(world.includes('const until=performance.now()+(crownQueue.length&&!crownCells.has(crownQueue[0])?3:1.5);while(crownQueue.length&&performance.now()<until)buildCrowns(crownQueue.shift());'),'within 1.5-3ms a frame');
 // Pools reach the GPU after every change of the frame, so none is drawn from stale data.
 const u=world.slice(world.indexOf(' function update(time){'));assert(u.indexOf('crowns(time);nature.flush();')>0&&u.indexOf('nature.flush()')===u.indexOf('crowns(time);nature.flush();')+'crowns(time);'.length,'one flush, after the last change');
 assert(world.includes('f=horizon.sampleAt(x,z,crownSample)')&&world.includes('CROWN_GRID=6.4'),'on a fixed jittered grid, from the distant land\'s record of each wood');
});

test('rain brings clouds: the sky, light and haze follow the weather',()=>{
 const scene=new T.Scene();scene.background=new T.Color(0x123456);scene.fog=new T.Fog(0x234567,40,104);const hemi=new T.HemisphereLight(0xabcdef,0x124578,2),key=new T.DirectionalLight(0xffccbb,1.7);key.castShadow=true;scene.add(hemi,key);
 const renderer={toneMappingExposure:1.35,getPixelRatio:()=>1},blue=new T.Color(0x7fb2e4);
 const sky=Sky.attach(T,scene,{renderer,palette:{sky:0x172838,ground:0x223344,hemiSky:0x334455,hemiGround:0x445566},moonTexture:()=>new T.Texture(),grade:()=>global.BurbzDaylightCore.daylightGradeForHour(12),colors:()=>({top:blue.clone().multiplyScalar(.5),mid:blue.clone(),hor:blue.clone().lerp(new T.Color(0xffffff),.3)})});
 const dome=sky.group.children[0].material.uniforms,sat=c=>{const hsl={};c.getHSL(hsl);return hsl.s;};
 sky.update(0,{cloud:.1,rain:0,wind:.3});const clear={key:key.intensity,hemi:hemi.intensity,sat:sat(scene.background),sun:sky.group.children.find(o=>o.renderOrder===-980).material.uniforms.opacity.value};
 assert(Math.abs(dome.cover.value-.1)<1e-9,'the first report arrives at once');assert.equal(clear.sun,1,'the sun shows through a few clouds');
 for(let t=1;t<=60;t++)sky.update(t,{cloud:.3,rain:.8,wind:.6});
 assert(dome.cover.value>.85,'rain always brings a covered sky: '+dome.cover.value);assert(dome.gloom.value>.75,'and a darker one');
 assert(key.intensity<clear.key*.6,'the sun\'s light softens');assert(hemi.intensity>clear.hemi,'the sky\'s light takes over');
 assert(sat(scene.background)<clear.sat*.6,'the sky and haze turn grey');assert(scene.fog.color.equals(scene.background));
 assert(sky.group.children.find(o=>o.renderOrder===-980).material.uniforms.opacity.value<.05,'the sun hides');
 const w=sky.weather();assert(w.known&&w.rain>.75);
 // Later reports roll in over seconds, never at once.
 sky.update(61,{cloud:0,rain:0,wind:.3});sky.update(62,{cloud:0,rain:0,wind:.3});assert(dome.cover.value>.6,'clouds clear slowly: '+dome.cover.value.toFixed(2));
 for(let t=63;t<=120;t++)sky.update(t,{cloud:0,rain:0,wind:.3});assert(dome.cover.value<.02);
 // No report yet: a few fair-weather clouds, never an empty sky.
 const fresh=Sky.attach(T,new T.Scene(),{renderer:{toneMappingExposure:1,getPixelRatio:()=>1},palette:{sky:0x172838,ground:0x223344,hemiSky:0x334455,hemiGround:0x445566},moonTexture:()=>new T.Texture(),grade:()=>global.BurbzDaylightCore.daylightGradeForHour(12),colors:()=>({top:blue,mid:blue,hor:blue})});
 fresh.update(0);assert(fresh.group.children[0].material.uniforms.cover.value>.2);fresh.dispose();
 sky.dispose();assert.equal(key.intensity,1.7);assert.equal(hemi.intensity,2);assert.equal(renderer.toneMappingExposure,1.35);
 assert(world.includes('skyDriver?.update(time,weatherAt(time));'),'the world passes the weather where the player stands');
 assert(world.includes('scene.fog.near=HAZE[0]*(1-.55*rain);scene.fog.far=HAZE[1]*(1-.12*grey-.5*rain);'),'rain thickens the haze');
 const explore=read('exploration.js');assert(explore.includes('showRain(time,sky?.rain||0);'),'rain falls in flight too');
 assert(explore.includes('const dx=(wind-vx)*dt,dy=(speed+vy)*dt,dz=-vz*dt;'),'streaming past at the craft\'s own speed');
});

test('the game makes its own weather, made to look good: fair skies and passing showers',()=>{
 const html=read('index.html'),src=html.slice(html.indexOf('const burbzWeather='),html.indexOf('window.BurbzCalmAudio='));
 assert(!/fetch\(|XMLHttpRequest|open-meteo/i.test(src),'nothing leaves the phone');assert(!read('audio-credits.html').includes('open-meteo'),'and no weather service is credited');
 let now=0;const ctx={Date:{now:()=>now},Math};vm.createContext(ctx);vm.runInContext(src+';globalThis.weather=burbzWeatherAt;',ctx);
 const start=Date.parse('2026-09-25T00:00:00Z');let n=0,wet=0,fair=0,showers=0,was=false,last=null;
 for(let s=0;s<3*86400;s+=10){now=start+s*1000;const w={...ctx.weather(53.9,-2.3)};n++;
  if(w.rain>0){wet++;if(!was)showers++;assert(w.cloud>.7,'rain always falls from grey cloud: '+w.cloud.toFixed(2));}was=w.rain>0;if(w.cloud<.55)fair++;
  if(last){assert(Math.abs(w.cloud-last.cloud)<.08,'cloud builds and clears over minutes');assert(Math.abs(w.rain-last.rain)<.3,'rain comes and goes gently');}last=w;
  assert(w.cloud>=.2&&w.cloud<=.95&&w.rain>=0&&w.rain<=1&&w.wind>0&&w.wind<1);}
 assert(fair/n>.75,'mostly fair skies: '+(fair/n).toFixed(2));assert(wet/n>.05&&wet/n<.2,'showers now and then: '+(wet/n).toFixed(2));assert(showers/3>10,'several a day: '+showers/3);
 // The same moment gives the same weather on every screen.
 now=start+123456789;const a={...ctx.weather()},b={...ctx.weather(0,0)};assert.deepEqual(a,b);
});

test('v482 ships together: build marker, cache, three worker lists, loader and consumers',()=>{
 const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js'),updater=fs.readFileSync(path.join(repo,'scripts/update-live-burbz.sh'),'utf8');
 // Later releases ship on top under their own marker and may move a module's
 // pin on; v482 stays in the cache chain and each list still pins it once.
 const LATER=['academy-day-night-v483-20260925','desk-screen-v484-20260925','smooth-sky-plain-plot-v485-20260925','academy-garden-birds-v486-20260925'],shipped=[BUILD,...LATER],cache=sw.match(/const BURBZ_CACHE = '([^']+)'/)[1];
 assert(shipped.some(b=>html.includes("const BURBZ_BUILD = '"+b+"';")));assert(cache.includes('-'+BUILD+'-')||cache.endsWith('-'+BUILD));assert(shipped.some(b=>cache.endsWith('-'+b)));
 const self={location:new URL('https://example.test/burbz/sw.js'),addEventListener(){}};
 for(const key of ['BURBZ_UK_BIRD_EXPANSION_50','BURBZ_UK_BIRD_EXPANSION_26','BURBZ_AU_BIRD_EXPANSION','BURBZ_UK_BIRD_EXPANSION_FINAL','BURBZ_AU_BIRD_EXPANSION_50'])self[key]={art:{}};
 const ctx=vm.createContext({self,URL,importScripts(){},console});vm.runInContext(sw,ctx);const lists=vm.runInContext('({BURBZ_ASSETS,BURBZ_CORE,BURBZ_INSTALL_REQUIRED})',ctx);
 const lazy=['world_nature.js','world_horizon.js','village_world.js','village_world_core.js','world_sky.js'],direct=['village_walk.js','exploration.js'];
 for(const [name,urls] of Object.entries(lists))for(const file of [...lazy,...direct])assert.equal(urls.filter(u=>shipped.some(b=>u==='./'+file+'?v='+b)).length,1,name+': '+file);
 for(const file of lazy)assert(shipped.some(b=>walk.includes("'"+file+"':'"+b+"'")),'loader pin '+file);
 for(const file of direct)assert(shipped.some(b=>html.includes(file+'?v='+b)),'consumer '+file);
 for(const file of [...lazy,...direct])assert(updater.includes('"'+file+'"'),'updater '+file);
 for(const file of fs.readdirSync(root).filter(n=>/\.(js|html)$/.test(n))){const text=read(file);for(const mod of [...lazy,...direct]){const escaped=mod.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');for(const m of text.matchAll(new RegExp('(?<![\\w])'+escaped+'\\?v=([\\w-]+)','g')))assert(shipped.includes(m[1]),file+': stale '+mod);}}
});
