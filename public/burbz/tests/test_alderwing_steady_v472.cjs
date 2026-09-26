'use strict';
// Alderwing steady v472: trees keep their size, the land stops popping,
// forests are dense again and the cockpit gauges sit in a real panel.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const N=require('../world_nature_core.js'),K=require('../village_world_core.js');
const BUILD='alderwing-steady-v472-20260925';
global.THREE=require('../lib/three.min.js');const T=global.THREE;
global.document={createElement:()=>({style:{},addEventListener(){},remove(){}})};global.matchMedia=()=>({matches:false});
require('../world_nature.js');require('../world_horizon.js');require('../flight_craft.js');
const W=globalThis.BurbzWorldNature;

test('trees never change size: each is drawn whole or not at all',()=>{
 const trees=['pine','spruce','oak','birch','hawthorn','dead'];
 for(const kind of trees){assert.equal(W.KINDS[kind].lod,1,kind);assert.equal(W.KINDS[kind+'Far'].lod,2,kind+'Far');assert(!W.KINDS[kind].range&&!W.KINDS[kind+'Far'].range,'no shrinking range for '+kind);}
 assert.equal(W.KINDS.boulder.lod,3,'boulders stand whole to the edge');
 // Only shrubs and ground plants still shrink, and only far away.
 for(const [kind,spec] of Object.entries(W.KINDS))if(!spec.lod)assert(spec.range[0]>=12&&(spec.tier==='small'||spec.range[0]>=70),kind+' shrinks only where it is a few pixels tall');
 const text=read('world_nature.js'),shader=text.slice(text.indexOf('const VERTEX='),text.indexOf('function patch('));
 assert(shader.includes('natureShow=natureMode<1.5?step(natureDistance,natureSwap):(natureMode<2.5?step(natureSwap,natureDistance):1.)*step('),'a tree swaps forms and ends at the edge by a hard step');
 assert.equal((shader.match(/natureShow=[^;]*smoothstep/g)||[]).length,1,'the one smooth fade is for shrubs and ground plants');
 assert(W.SWAP[0]>=24&&W.SWAP[1]>0,'each tree swaps at its own distance, never in one ring');
 const walk=read('village_world.js');assert(walk.includes('<44,\'t\')')&&44>=W.SWAP[0]+W.SWAP[1]+6,'detailed trees join the pools before they are due to show');
 // v474 replaced the fixed margin: far trees now ride the ground as it bends.
 assert(shader.includes('transformed.y+=natureDrop*smoothstep('),'far trees stay on the ground where it bends onto the distant land');
});

test('the simple form of every tree has the size and outline of its detailed form',()=>{
 const scene=new T.Scene(),n=W.create(T,scene,{style:()=>{},time:{value:0},eye:{value:new T.Vector3()},edge:{value:new T.Vector4(-1e6,-1e6,1e6,1e6)}});
 const box=kind=>{n.add(kind,kind,[{x:0,y:0,z:0}]);const mesh=scene.children.find(m=>m.name==='Alderwing '+kind);mesh.geometry.computeBoundingBox();return mesh.geometry.boundingBox;};
 for(const kind of ['pine','spruce','oak','birch','hawthorn','dead']){
  const near=box(kind),far=box(kind+'Far'),h=v=>v.max.y,w=v=>Math.max(v.max.x-v.min.x,v.max.z-v.min.z);
  assert(Math.abs(h(far)-h(near))/h(near)<.12,kind+' height '+h(near).toFixed(2)+' vs '+h(far).toFixed(2));
  assert(Math.abs(w(far)-w(near))/w(near)<.25,kind+' spread '+w(near).toFixed(2)+' vs '+w(far).toFixed(2));
 }
 const d=n.diagnostics();for(const kind of ['pineFar','spruceFar','oakFar','birchFar','hawthornFar','deadFar'])assert(d.kinds[kind].triangles<=26,kind+' is cheap: '+d.kinds[kind].triangles);
 n.dispose();
});

test('far trees and boulders stop at the shown ground; cells beyond it skip their draw',()=>{
 const scene=new T.Scene(),edge={value:new T.Vector4(-100,-100,100,100)},n=W.create(T,scene,{style:()=>{},time:{value:0},eye:{value:new T.Vector3()},edge});
 n.add('a','oakFar',[{x:10,y:0,z:10}]);n.add('b','oakFar',[{x:400,y:0,z:10}]);n.add('c','oak',[{x:400,y:0,z:20}]);n.update();
 const meshes=scene.children.filter(m=>m.isInstancedMesh);const at=x=>meshes.filter(m=>m.boundingSphere.center.x>x-70&&m.boundingSphere.center.x<x+70);
 assert(at(64).every(m=>m.visible),'inside the edge');assert(at(448).filter(m=>m.name==='Alderwing oakFar').every(m=>!m.visible),'far forms beyond the edge skip the draw');
 assert(at(448).filter(m=>m.name==='Alderwing oak').every(m=>m.visible),'detailed trees only ever exist near the eye');
 n.dispose();
});

test('forests are dense again, with copses in open country and the real limits kept',()=>{
 const seasons=N.season(new Date('2026-09-25T12:00:00Z'),53.9),at=(o,i)=>N.sample({altitude:150,slope:.1,lat:53.9,seasons,x:i*37.1,z:i*91.7,...o});
 const mean=(o,f)=>{let t=0;for(let i=0;i<3000;i++)t+=f(at(o,i));return t/3000;};
 assert(mean({cover:'wood'},s=>s.trees)>.95,'mapped woods are dense');
 assert(mean({cover:null,openBias:1},s=>s.kind==='woodland')>.38,'even where the map records plenty, much unmapped land is woodland');
 assert(mean({cover:null,openBias:0},s=>s.kind==='woodland')>.7,'where it records little, most of it is');
 const copse=mean({cover:'meadow'},s=>s.trees>.5);assert(copse>.08&&copse<.3,'meadows keep copses and open grass: '+copse);
 assert(mean({cover:'farmland'},s=>s.trees>.5)>.05,'fields have copses too');
 assert.equal(N.sample({altitude:900,slope:.1,cover:'wood',lat:54.5,seasons,x:1,z:1}).trees,0,'still no trees above the treeline');
 assert.equal(N.sample({altitude:300,slope:1.6,cover:'wood',lat:54.5,seasons,x:1,z:1}).trees,0,'or on cliffs');
});

test('the shown square grows side by side and eases without covering an unbuilt chunk',()=>{
 const C=K.CHUNK,built=new Set(),shown={x0:0,z0:0,x1:0,z1:0,ready:false},dt=1/30,speed=18,has=(x,z)=>built.has(x+','+z);
 let player={x:16,z:16},cut=null,last=null,frames=0,grows=0;
 const covered=c=>{for(let x=Math.floor(c.x0/C);x<Math.ceil(c.x1/C);x++)for(let z=Math.floor(c.z0/C);z<Math.ceil(c.z1/C);z++)if(!has(x,z))return false;return true;};
 for(let t=0;t<14;t+=dt,frames++){
  // Flying diagonally at full speed; new chunks build two a frame, nearest first.
  player={x:player.x+speed*dt*.8,z:player.z+speed*dt*.6};const cx=Math.floor(player.x/C),cz=Math.floor(player.z/C);
  const wanted=K.chunks(player.x,player.z).filter(c=>!built.has(c.id));for(const c of wanted.slice(0,2))built.add(c.id);
  for(const id of [...built]){const [x,z]=id.split(',').map(Number),ring=Math.max(Math.abs(x-cx),Math.abs(z-cz));if(ring>K.RINGS&&!(cut&&x*C<cut.x1&&x*C+C>cut.x0&&z*C<cut.z1&&z*C+C>cut.z0))built.delete(id);}
  cut=K.easeSquare(shown,K.showTarget(has,cx,cz),80*dt);
  if(!shown.ready)continue;
  assert(covered(cut),'frame '+frames+': the cut holds only built chunks');
  assert(shown.x0>=cut.x0&&shown.x1<=cut.x1&&shown.z0>=cut.z0&&shown.z1<=cut.z1,'the shown square lies within the cut');
  if(last){for(const side of ['x0','z0','x1','z1'])assert(Math.abs(shown[side]-last[side])<=80*dt+1e-9,'frame '+frames+': '+side+' eases, never jumps');if(shown.x1>last.x1)grows++;}
  if(t>4)assert(cx*C-shown.x0>=C*3&&shown.x1-(cx+1)*C>=C*2,'frame '+frames+': the viewer stays well inside the shown ground');
  last={...shown};
 }
 assert(grows>20,'the leading side keeps growing as the viewer flies on');
 assert.deepEqual(K.showTarget(()=>false,0,0),null,'nothing shows before the viewer\'s own chunk is built');
 const full=K.showTarget(()=>true,0,0);assert.deepEqual(full,{x0:-(K.RINGS-1)*C,z0:-(K.RINGS-1)*C,x1:K.RINGS*C,z1:K.RINGS*C},'at most four rings out; the fifth is built ahead');
});

test('the ground edge bends across the same triangles the distant land draws',()=>{
 for(let i=0;i<400;i++){const x=(Math.sin(i*1.7)*400),z=(Math.cos(i*2.3)*400),c=K.latticeCorners(x,z,16);
  assert(Math.abs(c.reduce((s,r)=>s+r[2],0)-1)<1e-9);assert(c.every(r=>r[2]>=-1e-9));
  const f=(x,z)=>3+.2*x-.7*z;assert(Math.abs(c.reduce((s,r)=>s+f(r[0],r[1])*r[2],0)-f(x,z))<1e-6,'exact on a plane');}
 // The horizon's own cells: (x0,z0),(x0,z0+S),(x0+S,z0) then (x0+S,z0),(x0,z0+S),(x0+S,z0+S).
 const text=read('world_horizon.js');assert(text.includes('const a=r*n+j,d=a+n;idx.push(a,d,a+1,a+1,d,d+1);'));
 assert.deepEqual(K.latticeCorners(4,4,16).map(r=>r.slice(0,2)).sort(),[[0,0],[0,16],[16,0]]);
 assert.deepEqual(K.latticeCorners(12,12,16).map(r=>r.slice(0,2)).sort(),[[0,16],[16,0],[16,16]]);
});

test('a rebuilt distant land eases from what was drawn, lit everywhere',async()=>{
 let now=0;const realNow=performance.now,realFetch=global.fetch;performance.now=()=>now;global.fetch=()=>new Promise(()=>{});
 try{
  const scene=new T.Scene(),abort=new AbortController();abort.abort();
  let tint=0;const h=(x,z)=>100+20*Math.sin(x/90)+15*Math.cos(z/70);
  const H=globalThis.BurbzWorldHorizon.create(T,scene,{origin:{lat:54,lon:-3},merc:{x:.49,z:.32,scale:2.3e7},style:()=>{},height:h,nature:(x,z,alt)=>({ground:[.2+tint,.4,.1],canopy:alt>110?4:0,water:false}),signal:abort.signal});
  H.setDatum(100);const view={cut:{x0:-96,z0:-96,x1:96,z1:96},bend:{x0:-90,z0:-90,x1:90,z1:90}};
  const run=(player,frames=4000)=>{for(let i=0;i<frames;i++){now+=16;H.update(player,view,now/1000);}};
  run({x:0,z:0});assert(H.ready,'both levels built from the detailed height alone');
  const fine=scene.children.find(m=>m.name==='Alderwing horizon 0'),normals=fine.geometry.attributes.normal.array;
  for(let i=0;i<normals.length;i+=3)assert(Math.hypot(normals[i],normals[i+1],normals[i+2])>.99,'every vertex is lit, even under the cut');
  const L=H.lattice(32,48);assert(Math.abs(L.h-(h(32,48)-100))<1e-3);assert.deepEqual(L.color.map(v=>+v.toFixed(3)),[.2,.4,.1]);
  // The ground changes colour and the viewer moves on: the new grid starts
  // exactly where the old one was drawn, then eases in.
  const epoch=H.epoch;tint=.3;H.refresh();run({x:70,z:0},2);
  const next=scene.children.find(m=>m.name==='Alderwing horizon 0');assert.equal(next.position.x,64);assert.equal(H.diagnostics().blend[0]<1,true,'easing');
  const g=next.geometry,prevColor=g.attributes.horizonPrevColor.array,color=g.attributes.color.array,prev=g.attributes.horizonPrev.array,n=65,k=32*n+40;
  assert(Math.abs(prevColor[k*3]-.2)<1e-6&&Math.abs(color[k*3]-.5)<1e-6,'starts from the old colour');
  assert(Math.abs(prev[k*2]-(h(64+(40-32)*16,0)-100))<1e-3,'and the old height');
  run({x:70,z:0},200);assert.equal(H.diagnostics().blend[0],1);assert(H.epoch>epoch,'the detailed ground refreshes its bend once the land has eased');
  H.dispose();
 }finally{performance.now=realNow;global.fetch=realFetch;}
});

test('the cockpit is a real panel: gauges set in its face, below the eye, facing the pilot',()=>{
 const craft=globalThis.BurbzFlightCraft.model(T,()=>{}),meshes=[];craft.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
 let triangles=0;for(const m of meshes)triangles+=m.geometry.index?m.geometry.index.count/3:m.geometry.attributes.position.count/3;assert(triangles<8000,'triangles '+triangles);
 const shown=m=>{for(let o=m;o;o=o.parent)if(!o.visible)return false;return true;};
 const needles=meshes.filter(m=>m.material.userData.craftNeedle),dash=needles[0].parent.parent,panel=dash.children.find(o=>o.isMesh);
 assert.equal(needles.length,3);assert(needles.every(n=>n.parent.parent===dash));
 craft.view(false);craft.animate(1,false);assert(!shown(panel)&&!needles.some(shown),'from outside, the hull shows its own cockpit well');
 craft.view(true);craft.animate(2,true,{pitch:-.2});craft.group.updateMatrixWorld(true);assert(shown(panel)&&needles.every(shown),'aboard, the pilot sees the panel and its gauges');
 const box=new T.Box3().setFromObject(panel),eye=new T.Vector3(0,1.38,0);
 assert(box.max.y<1.1,'the whole cockpit sits well below the 1.38m eye line');assert(box.max.z<0,'and ahead of the pilot');
 // Wide enough to meet both edges of a landscape phone screen.
 const spread=Math.atan2(box.max.x,-(box.min.z+box.max.z)/2);assert(spread>.55,'spans the view: '+spread.toFixed(2));
 const pos=panel.geometry.attributes.position.array;
 for(const needle of needles){const pivot=needle.parent.getWorldPosition(new T.Vector3()),face=new T.Vector3(0,0,1).applyQuaternion(needle.parent.getWorldQuaternion(new T.Quaternion()));
  assert(face.dot(eye.clone().sub(pivot).normalize())>.8,'each gauge faces the pilot');
  // Its face lies on the panel: the nearest panel vertex behind it is a few millimetres away.
  let best=Infinity;for(let i=0;i<pos.length;i+=3){const d=Math.hypot(pos[i]-pivot.x,pos[i+1]-pivot.y,pos[i+2]-pivot.z);if(d<best)best=d;}assert(best<.03,'mounted, not floating: '+best.toFixed(3));
  assert(pivot.y<box.max.y-.04,'set below the coaming, not perched on top');
 }
 craft.animate(3,true,{pitch:-.45});craft.group.updateMatrixWorld(true);assert(new T.Box3().setFromObject(panel).max.y<box.max.y-.5,'looking down, the cockpit sinks away');
 craft.animate(4,true,{pitch:-1.3});assert(!shown(panel)&&!needles.some(shown),'and is gone when the pilot looks straight down');
 craft.view(false);assert(meshes.every(m=>m.visible));craft.dispose();
});

test('the flight clamp still lets the pilot look straight down',()=>{
 const text=read('village_walk.js'),start=text.indexOf('  function clampPitch('),end=text.indexOf('\n',start),c={};vm.createContext(c);vm.runInContext(text.slice(start,end)+'\nglobalThis.f=clampPitch;',c);
 assert.equal(c.f({mode:'fly'},-3),-1.5);assert.equal(c.f({mode:'walk'},-3),-1.1);
});

test('v472 ships together: build marker, cache, three worker lists, loader and consumers',()=>{
 const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js');
 // Later releases ship on top under their own marker; v472 stays in the cache chain.
 const LATER=['academy-living-tree-v473-20260925','home-dock-back-v474-20260925','academy-manga-v475-20260925','realistic-flight-v478-20260925','merlin-flight-v479-20260925','glide-release-v481-20260925','alderwing-seamless-v482-20260925','academy-day-night-v483-20260925','desk-screen-v484-20260925','smooth-sky-plain-plot-v485-20260925','village-folk-v486-20260925','music-rest-v487-20260925','quests-strip-v488-20260925','fold-fullscreen-v489-20260925','academy-garden-birds-v490-20260925','home-hub-v491-20260925','asmr-sound-v492-20260925','quest-lines-v493-20260926','photo-merlin-v494-20260926','village-apart-v497-20260926'],shipped=[BUILD,...LATER],cache=sw.match(/const BURBZ_CACHE = '([^']+)'/)[1];
 assert(shipped.some(build=>html.includes("const BURBZ_BUILD = '"+build+"';")));
 assert(cache.includes('-'+BUILD)&&shipped.some(build=>cache.endsWith('-'+build)));
 const self={location:new URL('https://example.test/burbz/sw.js'),addEventListener(){}};
 for(const key of ['BURBZ_UK_BIRD_EXPANSION_50','BURBZ_UK_BIRD_EXPANSION_26','BURBZ_AU_BIRD_EXPANSION','BURBZ_UK_BIRD_EXPANSION_FINAL','BURBZ_AU_BIRD_EXPANSION_50'])self[key]={art:{}};
 const ctx=vm.createContext({self,URL,importScripts(){},console});vm.runInContext(sw,ctx);const lists=vm.runInContext('({BURBZ_ASSETS,BURBZ_CORE,BURBZ_INSTALL_REQUIRED})',ctx);
 const lazy=['world_nature_core.js','world_nature.js','world_horizon.js','flight_craft.js','village_world.js','village_world_core.js'];
 // Later releases may move a module's pin on; each list still pins it once.
 const current=build=>shipped.includes(build);
 for(const [name,urls] of Object.entries(lists))for(const file of lazy)assert.equal(urls.filter(u=>u.startsWith('./'+file+'?v=')&&current(u.slice(file.length+5))).length,1,name+': '+file);
 for(const file of lazy)assert(shipped.some(b=>walk.includes("'"+file+"':'"+b+"'")),'loader pin '+file);
 for(const file of fs.readdirSync(root).filter(n=>/\.(js|html)$/.test(n))){const text=read(file);for(const mod of lazy){const escaped=mod.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');for(const m of text.matchAll(new RegExp('(?<![\\w])'+escaped+'\\?v=([\\w-]+)','g')))assert(current(m[1]),file+': stale '+mod);}}
 assert(fs.readFileSync(path.join(repo,'scripts/update-live-burbz.sh'),'utf8').includes('"world_horizon.js"'));
});
