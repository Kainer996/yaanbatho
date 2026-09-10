'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const K=require('../village_world_core.js'),G=require('../geographic_world_core.js'),W=require('../village_walk_core.js'),F=require('../geographic_forest_core.js');

test('authored ground joins real unexaggerated elevations with a continuous value and slope',()=>{
 const o={radius:32,blend:64,datum:120,authored:(x,z)=>2+Math.sin(x*.01)*.2,raw:(x,z)=>120+x*.02+z*.01};
 for(const angle of [0,.5,1,2,3,4,5]){
  const p=d=>({x:Math.cos(angle)*d,z:Math.sin(angle)*d});
  for(const radius of [32,96]){const a=p(radius-.0001),b=p(radius+.0001);assert(Math.abs(K.joinedHeight(a.x,a.z,o)-K.joinedHeight(b.x,b.z,o))<.0001);}
  const far=p(140);assert(Math.abs(K.joinedHeight(far.x,far.z,o)-(o.raw(far.x,far.z)-120))<1e-10);
 }
 assert.equal(K.joinedHeight(33,0,{...o,raw:()=>null}),null);
 assert.equal(K.joinedHeight(30,0,{...o,raw:()=>null}),o.authored(30,0));
});

test('decoded DEM interpolation distinguishes missing tiles from real zero metres',()=>{
 const origin={x:.5,z:.5,scale:1000};const tiles=[{z:1,x:1,y:1,dem:{dim:512,get:(x,z)=>x*.1+z*.2}}];
 assert.equal(K.elevation(tiles,origin,0,0),0);
 assert(Math.abs(K.elevation(tiles,origin,2,3)-.8192)<1e-9);
 assert.equal(K.elevation(tiles,origin,-1,-1),null);
});

test('movement samples the exact generated ground triangles on both sides of chunk seams',()=>{
 const h=(x,z)=>5+Math.sin(x*.05)*2+Math.cos(z*.04),a={id:'0,0',x:0,z:0},b={id:'1,0',x:32,z:0};
 const ga=K.groundMesh(a,h,0),gb=K.groundMesh(b,h,0);
 for(let z=0;z<32;z+=.25){assert(Math.abs(K.meshHeight(a,ga,32,z)-K.meshHeight(b,gb,32,z))<1e-8);}
 for(let z=0;z<32;z+=2)for(let x=2;x<32;x+=2)assert(Math.abs(K.meshHeight(a,ga,x,z)-h(x,z))<1e-9);
 assert.equal(K.groundMesh(a,(x,z)=>x>10?null:2,0),null,'missing coverage cannot produce a partial ground tile');
});

test('streamed tree IDs and positions are fixed in metres across movement and chunk turnover',()=>{
 const shift={x:63.82,z:-51.93},a=K.chunks(0,0),b=K.chunks(35,0);
 assert.equal(a.length,121);assert.equal(b.length,121);
 const ids=new Set(),old=new Map();
 for(const c of a)for(const t of K.trees(c,shift)){assert(!ids.has(t.id),'a tree belongs to exactly one chunk');ids.add(t.id);old.set(t.id,t);}
 let common=0;for(const c of b)for(const t of K.trees(c,shift))if(old.has(t.id)){assert.deepEqual(t,old.get(t.id));common++;}
 assert(common>9000);assert.deepEqual(K.trees(a[0],shift),K.trees(a[0],shift));
 for(const row of K.trees(a[0],shift))assert(row.x>=a[0].x&&row.x<a[0].x+32&&row.z>=a[0].z&&row.z<a[0].z+32);
});

test('removing the old circular limit preserves building and scenery collision',()=>{
 const w=W.createWorld({radius:30,polygons:[[{x:1,z:1},{x:3,z:1},{x:3,z:3},{x:1,z:3}]],segments:[[{x:5,z:0},{x:5,z:5}]]});
 assert(!w.allowed(31,0));assert(w.allowedBeyond(31,0));assert(!w.allowedBeyond(2,2));assert(!w.allowedBeyond(5.1,2));
 const player={x:29,z:0,y:0,yaw:-Math.PI/2,pitch:0};const world={...w,allowed:w.allowedBeyond};
 for(let i=0;i<80;i++)W.move(player,{forward:1},1/60,world);assert(player.x>32);
 for(let i=0;i<80;i++)W.move(player,{forward:-1},1/60,world);assert(Math.abs(player.x-29)<1e-8);assert.equal(player.yaw,-Math.PI/2);
});

test('compiled water/woodland masks preserve topology and holes without recompiling each cell',()=>{
 const geometry={type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[.4,.4],[.6,.4],[.6,.6],[.4,.6],[.4,.4]]]};
 const mask=F.compileMask(geometry,0);assert(mask([.2,.2]));assert(!mask([.5,.5]));assert(!mask([2,2]));
 assert(!F.compileMask({type:'Polygon',coordinates:[[[0,0],[1,1],[0,1],[1,0],[0,0]]]},0)([.2,.2]));
});

test('geographic streamed positions retain actual metres and the same heading on return',()=>{
 const origin={lat:54.45,lon:-2.65};for(const x of [32,100,1000,8046.72]){const pose=G.unproject(origin,{x,y:127,z:8});const back=G.project(origin,pose);assert(Math.abs(back.x-x)<1e-5);assert(Math.abs(back.z-8)<1e-5);assert.equal(back.y,127);}
});


test('river and road ribbons share chunk edges, follow elevations and taper without rectangular ends',()=>{
 const c={x:10,z:-3,ux:.6,uz:.8,width:3.4,start:35,end:155,kind:'river'},h=(x,z)=>x*.01+z*.02;
 assert.equal(K.corridorWidth(c,20),3.4);assert.equal(K.corridorWidth(c,155),0);assert(K.corridorWidth(c,150)<.02);
 const ids=new Map();for(const cell of K.chunks(0,0))for(const bank of [false,true]){const data=K.ribbonMesh(cell,c,h,bank);for(let i=0;i<data.positions.length;i+=3){const x=data.positions[i]+cell.x,y=data.positions[i+1],z=data.positions[i+2]+cell.z;assert(x>=cell.x-1e-8&&x<=cell.x+32+1e-8&&z>=cell.z-1e-8&&z<=cell.z+32+1e-8);assert(Math.abs(y-h(x,z)-(bank?.024:.02))<1e-8);}}
 assert(K.corridorContains(c,10+100*.6,-3+100*.8));assert(!K.corridorContains(c,10+156*.6,-3+156*.8));
});
