'use strict';
// Alderwing nature v470: real-cover ground, varied plants, the distant land,
// flowing streams and waterfalls, the new craft and its cockpit view.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),repo=path.resolve(root,'../..'),read=name=>fs.readFileSync(path.join(root,name),'utf8');
const N=require('../world_nature_core.js'),W=require('../world_water_core.js');
const BUILD='alderwing-nature-v470-20260925';
// Later Alderwing releases that re-ship some of these modules under their own marker.
const LATER=['alderwing-steady-v472-20260925','realistic-flight-v478-20260925','glide-release-v481-20260925','alderwing-seamless-v482-20260925','academy-day-night-v483-20260925','desk-screen-v484-20260925','smooth-sky-plain-plot-v485-20260925','village-folk-v486-20260925','photo-merlin-v487-20260925'],current=build=>build===BUILD||LATER.includes(build);
const layer=(sourceLayer,cls,subclass)=>({sourceLayer,geometry:{type:'Polygon'},properties:{class:cls,subclass}});
const hex=rgb=>rgb.map(v=>Math.round(Math.pow(Math.max(0,v),1/2.2)*255));

test('real OpenMapTiles cover becomes the right kind of ground',()=>{
 assert.equal(N.cover(layer('landcover','wood','forest')),'wood');
 assert.equal(N.cover(layer('landcover','farmland','farmland')),'farmland');
 assert.equal(N.cover(layer('landcover','farmland','vineyard')),'orchard');
 assert.equal(N.cover(layer('landcover','rock','scree')),'scree');
 assert.equal(N.cover(layer('landcover','rock','bare_rock')),'rock');
 assert.equal(N.cover(layer('landcover','grass','heath')),'heath');
 assert.equal(N.cover(layer('landcover','grass','fell')),'heath');
 assert.equal(N.cover(layer('landcover','grass','scrub')),'scrub');
 assert.equal(N.cover(layer('landcover','grass','meadow')),'meadow');
 assert.equal(N.cover(layer('landcover','grass','golf_course')),'sport');
 assert.equal(N.cover(layer('landcover','wetland','bog')),'wetland');
 assert.equal(N.cover(layer('landcover','sand','beach')),'sand');
 assert.equal(N.cover(layer('landcover','ice','glacier')),'ice');
 assert.equal(N.cover(layer('landuse','residential')),'urban');
 assert.equal(N.cover(layer('landuse','forest')),'wood');
 assert.equal(N.cover({...layer('landcover','wood'),geometry:{type:'LineString'}}),null,'lines never become cover');
 assert.equal(N.cover(layer('water','lake')),null,'water is handled by the shore renderer');
 // A wood inside a park is a wood; rock beats meadow.
 assert.equal(N.stronger('wood','park'),'wood');assert.equal(N.stronger('meadow','rock'),'rock');
});

test('seasons follow the real date and hemisphere',()=>{
 const uk=N.season(new Date('2026-09-24T12:00:00Z'),54.5),oz=N.season(new Date('2026-09-24T12:00:00Z'),-33.9),jan=N.season(new Date('2026-01-10T12:00:00Z'),51.5);
 assert(uk.autumn>.5,'late September is autumn in Britain');assert(oz.spring>.5,'and spring in Sydney');assert(jan.winter>.8);
 const sum=o=>o.winter+o.spring+o.summer+o.autumn;for(const s of [uk,oz,jan])assert(Math.abs(sum(s)-1)<1e-9);
 const equator=N.season(new Date('2026-01-10T12:00:00Z'),2);assert(equator.summer>.8,'the tropics stay green');
});

test('altitude, slope and latitude shape the land like the real world',()=>{
 const seasons=N.season(new Date('2026-07-01T12:00:00Z'),54.5);
 assert(N.treeline(54.5)<N.treeline(46),'the Alps grow trees far higher than the Lakes');
 const valley=N.sample({altitude:120,slope:.1,cover:'wood',lat:54.5,seasons,x:10,z:10});
 const summit=N.sample({altitude:900,slope:.1,cover:'wood',lat:54.5,seasons,x:10,z:10});
 assert(valley.trees>.7);assert.equal(summit.trees,0,'no trees above the treeline');
 const cliff=N.sample({altitude:300,slope:1.6,cover:'meadow',lat:54.5,seasons,x:10,z:10});
 assert(cliff.rockiness>.99);assert.equal(cliff.trees,0);const [r,g,b]=hex(cliff.ground);assert(Math.abs(r-g)<16&&Math.abs(g-b)<22,'cliffs are grey rock, not grass: '+[r,g,b]);
 const alps=N.sample({altitude:3600,slope:.3,cover:null,lat:46,seasons,x:1,z:1});assert(alps.snow>.9,'high Alpine summits keep snow in summer');
 const lakes=N.sample({altitude:900,slope:.3,cover:null,lat:54.5,seasons,x:1,z:1});assert.equal(lakes.snow,0,'British fells are bare in summer');
 const winter=N.season(new Date('2026-01-15T12:00:00Z'),54.5);assert(N.sample({altitude:900,slope:.3,cover:null,lat:54.5,seasons:winter,x:1,z:1}).snow>.5,'and white in winter');
 for(const cover of N.COVERS){const s=N.sample({altitude:200,slope:.2,cover,lat:52,seasons,x:3,z:4});assert(s.ground.every(v=>v>=0&&v<=1.2),cover);assert(s.trees>=0&&s.trees<=1);}
});

test('mapped heath blooms purple in August and rusts after',()=>{
 const at=day=>N.sample({altitude:400,slope:.2,cover:'heath',lat:53.9,seasons:N.season(new Date(day),53.9),x:40,z:90});
 const august=at('2026-08-16T12:00:00Z'),october=at('2026-10-20T12:00:00Z');
 assert(august.bloom>.9&&october.bloom<.05);
 const [ar,,ab]=hex(august.ground),[or,,ob]=hex(october.ground);assert(ab-ar>ob-or+8,'the bloom is more purple than autumn rust: '+[ar,ab,or,ob]);
});

test('unmapped land keeps authored woodland where the map records none nearby',()=>{
 const seasons=N.season(new Date('2026-06-01T12:00:00Z'),52),share=bias=>Array.from({length:1500},(_,i)=>N.sample({altitude:80,lat:52,seasons,openBias:bias,x:i*37.1,z:i*91.7})).filter(s=>s.kind==='woodland').length/1500;
 // v472 keeps close to half of it wooded even there, at Yaan's request for denser forest.
 assert(share(0)>.45,'no woods mapped: a natural woodland mosaic');assert(share(1)<share(0)-.2,'woods mapped nearby: more unmapped ground is open country');
});

test('plant scatter is fixed in metres and never depends on the viewer',()=>{
 const a=N.scatter({x:64,z:-32},32,2,733),b=N.scatter({x:64,z:-32},32,2,733);assert.deepEqual(a,b);
 assert(a.length>200&&a.every(r=>r.x>=64&&r.x<96&&r.z>=-32&&r.z<0));
 const ids=new Set();for(const cell of [{x:0,z:0},{x:32,z:0},{x:0,z:32}])for(const r of N.scatter(cell,32,4.6,701)){assert(!ids.has(r.id));ids.add(r.id);}
 assert.equal(N.pick({oak:0,birch:0},.5),null);assert.equal(N.pick({oak:1,birch:0},.99),'oak');
});

test('mapped streams resample downstream and find real waterfalls',()=>{
 const line=[];for(let x=0;x<=60;x+=5)line.push({x,z:0});
 const fall=(x,z)=>x<20?50:x<30?50-(x-20)*1.2:38-(x-30)*.02;
 const p=W.prepare(line,'stream',false,fall);
 assert(p.samples.every((s,i)=>!i||(s.s>p.samples[i-1].s&&s.s-p.samples[i-1].s<=2+1e-9)),'steps of at most 2m along the flow');assert(Math.abs(p.samples.at(-1).s-60)<1e-9);
 assert.equal(p.falls.length,1);assert(Math.abs(p.falls[0].drop-12)<.01);assert.equal(p.falls[0].top.x,20);assert.equal(p.falls[0].foot.x,30);
 assert.equal(W.prepare(line,'stream',false,(x,z)=>50-x*.05).falls.length,0,'a gentle beck has no waterfall');
 assert.equal(W.prepare(line,'stream',false,(x,z)=>x===20?80:50).falls.length,0,'a single bad elevation sample is not a cliff');
 assert(W.width('river')>W.width('stream')&&W.width('stream',true)<W.width('stream'),'widths follow the mapped class');
});

test('stream ribbons face the sky and split exactly between chunks',()=>{
 const line=[];for(let x=-10;x<=70;x+=5)line.push({x,z:3});
 const h=(x,z)=>x<20?50:x<30?50-(x-20)*1.2:38-(x-30)*.02,p=W.prepare(line,'stream',false,h);
 const cells=[{x:-32,z:-16},{x:0,z:-16},{x:32,z:-16},{x:64,z:-16}],parts=cells.map(c=>W.build(c,32,[p],h));
 let up=0,down=0;for(const [i,o] of parts.entries()){const P=o.positions,I=o.indices;for(let j=0;j<I.length;j+=3){const a=I[j]*3,b=I[j+1]*3,c=I[j+2]*3,ny=(P[b+2]-P[a+2])*(P[c]-P[a])-(P[b]-P[a])*(P[c+2]-P[a+2]);ny>0?up++:down++;}
  assert.equal(o.flow.length,o.positions.length,'one flow triple per vertex '+i);}
 assert.equal(down,0,'every stream triangle is visible from above');
 const quads=parts.reduce((n,o)=>n+(o.indices.length-(o.mist.length?30:0))/6,0);assert.equal(quads,p.samples.length-1,'each 2m piece is built by exactly one chunk');
 const foot=parts.find(o=>o.mist.length);assert(foot,'a plunge pool with spray at the foot of the fall');assert.equal(foot.mist.length,3);
 assert(parts.some(o=>o.banks.length)&&parts.some(o=>o.gully.length),'steep water cuts a boulder-lined gully');
 const corridors=W.corridors([{kind:'stream',line}],10,{x:0,z:0});assert(corridors.length&&corridors.every(c=>c.kind==='river'&&c.width>0));
});

test('the craft is a few cheap meshes, folds its wings and clears the pilot view',()=>{
 global.THREE=require('../lib/three.min.js');global.document={createElement:()=>({style:{},addEventListener(){},remove(){}})};global.matchMedia=()=>({matches:false});
 require('../flight_craft.js');const T=global.THREE,styled=[],craft=globalThis.BurbzFlightCraft.model(T,m=>styled.push(m));
 const meshes=[];craft.group.traverse(o=>{if(o.isMesh)meshes.push(o);});
 assert(meshes.length<=10,'few draws: '+meshes.length);assert(styled.length===1,'one shared, styled material');
 let triangles=0;for(const m of meshes)triangles+=m.geometry.index?m.geometry.index.count/3:m.geometry.attributes.position.count/3;assert(triangles<8000,'triangles '+triangles);
 const span=()=>{craft.group.updateMatrixWorld(true);const box=new T.Box3();for(const m of meshes)box.expandByObject(m);return box.max.x-box.min.x;};
 for(let t=0;t<4;t+=.05)craft.animate(t,false);const parked=span();
 for(let t=4;t<8;t+=.05)craft.animate(t,true);const flying=span();
 assert(parked<.7*flying,'parked wings fold along the hull: '+parked.toFixed(2)+' of '+flying.toFixed(2));assert(flying>5.5,'wings spread wide in flight: '+flying.toFixed(2));
 craft.view(true);const visible=meshes.filter(m=>{for(let o=m;o;o=o.parent)if(!o.visible)return false;return true;});
 assert(visible.length>0&&visible.length<=4,'aboard, only the dashboard and its needles remain');
 for(const m of visible){const box=new T.Box3().setFromObject(m);assert(box.max.y<1.2,'the dashboard sits below the 1.38m eye line');assert(box.max.z<0,'and ahead of the pilot');}
 craft.animate(9,true,{pitch:-1.3});assert(!visible.some(m=>{for(let o=m;o;o=o.parent)if(!o.visible)return false;return true;}),'looking down hides the dashboard too');
 craft.view(false);assert(meshes.every(m=>m.visible));craft.dispose();
});

test('a pilot aloft can look straight down; on foot the old head range stays',()=>{
 const text=read('village_walk.js'),start=text.indexOf('  function clampPitch('),end=text.indexOf('\n',start),c={};vm.createContext(c);vm.runInContext(text.slice(start,end)+'\nglobalThis.f=clampPitch;',c);
 assert.equal(c.f({mode:'fly'},-3),-1.5);assert.equal(c.f({mode:'fly'},3),1.2);assert.equal(c.f({mode:'walk'},-3),-1.1);assert.equal(c.f({mode:'swim'},2),1.1);assert.equal(c.f({mode:'walk'},NaN),0);
 assert(text.includes('s.player.pitch=clampPitch(s.player,'),'keys use the shared range');
 assert(read('wilderness_combat.js').includes('root.BurbzVillageWalk?.clampPitch'),'the look stick uses it too');
 assert(read('flight_craft.js').includes("if(s.player.mode==='fly')s.player.pitch=pitch;"),'the flight step keeps the pilot range');
});

test('v470 ships together: build marker, cache, three worker lists, loader and updater',()=>{
 const html=read('index.html'),sw=read('sw.js'),walk=read('village_walk.js'),updater=fs.readFileSync(path.join(repo,'scripts/update-live-burbz.sh'),'utf8');
 // Later releases append to the cache name and move the build marker on, so check membership.
 assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].includes('-alderwing-nature-v470-20260925'));
 const self={location:new URL('https://example.test/burbz/sw.js'),addEventListener(){}};
 for(const key of ['BURBZ_UK_BIRD_EXPANSION_50','BURBZ_UK_BIRD_EXPANSION_26','BURBZ_AU_BIRD_EXPANSION','BURBZ_UK_BIRD_EXPANSION_FINAL','BURBZ_AU_BIRD_EXPANSION_50'])self[key]={art:{}};
 const ctx=vm.createContext({self,URL,importScripts(){},console});vm.runInContext(sw,ctx);const lists=vm.runInContext('({BURBZ_ASSETS,BURBZ_CORE,BURBZ_INSTALL_REQUIRED})',ctx);
 const lazy=['world_nature_core.js','world_nature.js','world_horizon.js','world_water_core.js','world_water.js','shore_water.js','flight_craft.js','village_world.js'],direct=['village_walk.js','manga_render_core.js','wilderness_combat.js'];
 const pinned=(urls,file)=>urls.filter(u=>u.startsWith('./'+file+'?v=')&&current(u.slice(file.length+5)));
 for(const [name,urls] of Object.entries(lists))for(const file of [...lazy,...direct])assert.equal(pinned(urls,file).length,1,name+': '+file);
 for(const file of lazy){assert([BUILD,...LATER].some(b=>walk.includes("'"+file+"':'"+b+"'")),'loader pin '+file);assert(fs.existsSync(path.join(root,file)));}
 for(const file of direct)assert([BUILD,...LATER].some(b=>html.includes(file+'?v='+b)),'consumer '+file);
 for(const file of ['world_nature_core.js','world_nature.js','world_horizon.js','world_water_core.js','world_water.js'])assert(updater.includes('"'+file+'"'),'updater '+file);
 // No stale URL identity survives for any changed module.
 for(const file of fs.readdirSync(root).filter(n=>/\.(js|html)$/.test(n))){const text=read(file);for(const mod of [...lazy,...direct]){const escaped=mod.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');for(const m of text.matchAll(new RegExp('(?<![\\w])'+escaped+'\\?v=([\\w-]+)','g')))assert(current(m[1]),file+': stale '+mod);}}
});
