'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../geographic_world_core.js'),K=require('../village_world_core.js');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
test('a saved village house projects into the overhead scene without settlement economy changes',()=>{
 const start=html.indexOf('function settlementPlayerHome('),end=html.indexOf('\nfunction ',start+1);assert(start>=0,'overhead home attachment exists');
 const origin={lat:54.45,lon:-2.65},anchor=G.unproject(origin,{x:12,y:0,z:-8});
 const scene={children:[],userData:{walkSurface:{radius:35},walkTerrain:{heightAt:()=>2}},add(o){this.children.push(o);}};
 const home={tier:1,anchor,rooms:{library:true}},state={playerHome:home,player:{branches:111},empire:{villages:{}}},before=JSON.stringify(state);
 const mesh={position:{set(x,y,z){Object.assign(this,{x,y,z});}},userData:{}};
 const ctx={gameState:state,BurbzGeographicWorldCore:G,BurbzPlayerHomeScene:{createHouse:()=>mesh},THREE:{}};vm.createContext(ctx);vm.runInContext(html.slice(start,end),ctx);
 const result=ctx.settlementPlayerHome(scene,origin);assert.equal(scene.children.length,1);assert.strictEqual(result,mesh);assert(Math.abs(mesh.position.x-12)<1e-5);assert(Math.abs(mesh.position.z+8)<1e-5);assert.equal(mesh.position.y,2);assert(mesh.userData.overheadHome);assert.equal(JSON.stringify(state),before);
 for(const bad of [{tier:0,anchor},{tier:1,anchor:null},{tier:1,anchor:G.unproject(origin,{x:500,y:0,z:0})}]){state.playerHome=bad;assert.equal(ctx.settlementPlayerHome(scene,origin),null);}
});
test('tree roots reject steep or unknown ground including a narrow cliff at the trunk',()=>{
 assert.equal(typeof K.treeGround,'function');
 assert(K.treeGround(10,10,1,(x,z)=>x*.12+z*.08));
 assert.equal(K.treeGround(10,10,1,(x,z)=>x),null);
 assert.equal(K.treeGround(0,0,1,x=>x>.1?3:0),null);
 assert.equal(K.treeGround(0,0,1,()=>null),null);
 assert.equal(K.treeGround(0,0,1,x=>x>0?null:0),null);
});
test('rock fields are stable through chunk turnover, avoid paths and never invent missing ground',()=>{
 const cell={x:64,z:64},shift={x:12,z:8},height=(x,z)=>x*.8;
 const a=K.rocks(cell,shift,height,()=>false);assert(a.length>0);assert.deepEqual(a,K.rocks(cell,shift,height,()=>false));assert.deepEqual(K.rocks(cell,shift,()=>null,()=>false),[]);assert.deepEqual(K.rocks(cell,shift,height,()=>true),[]);
 for(const r of a){assert(r.x>=64&&r.x<96&&r.z>=64&&r.z<96);assert(r.y<height(r.x,r.z),'boulder base is embedded');}
});
test('cascades follow an existing downhill river with unique chunk ownership',()=>{
 const river={x:0,z:0,ux:1,uz:0,width:4,start:150,end:210,kind:'river'},height=x=>-x*.5;
 const a=K.cascades({x:32,z:0},[river],height,()=>false);assert(a.length>=2);for(const row of a){assert(row.drop>=1.35);assert(row.points.every((p,i)=>!i||p.y<=row.points[i-1].y));}
 const b=K.cascades({x:64,z:0},[river],height,()=>false);assert(!a.some(x=>b.some(y=>y.id===x.id)));
 assert.deepEqual(K.cascades({x:32,z:0},[river],()=>120,()=>false),[]);assert.deepEqual(K.cascades({x:32,z:0},[river],()=>null,()=>false),[]);assert.deepEqual(K.cascades({x:32,z:0},[{...river,kind:'road'}],height,()=>false),[]);assert.deepEqual(K.cascades({x:32,z:0},[river],height,()=>true),[]);
});
test('moving, upgrading or extending a saved home invalidates owned and unowned village overviews',()=>{
 const extract=name=>{const a=html.indexOf('function '+name+'('),b=html.indexOf('\nfunction ',a+1);assert(a>=0);return html.slice(a,b);};
 const ctx={gameState:{playerHome:{tier:1,anchor:{lat:54,lon:-2,revision:1},rooms:{}}},EMPIRE_BUILDINGS:[],ensureVillageEconomy:r=>r,villageConstructions:()=>[],villageReadyToOpen:()=>[],villageWholesaleProjects:()=>[]};vm.createContext(ctx);vm.runInContext(extract('settlementPlayerHomeKey')+'\n'+extract('villageBuildingSceneKey'),ctx);
 for(const rec of [null,{population:4,buildingPlots:{},ruins:[]}]){let key=ctx.villageBuildingSceneKey(rec);for(const edit of [h=>h.tier++,h=>h.anchor.lon+=.001,h=>h.rooms.library=true]){edit(ctx.gameState.playerHome);const next=ctx.villageBuildingSceneKey(rec);assert.notEqual(next,key);key=next;}ctx.gameState.playerHome={tier:1,anchor:{lat:54,lon:-2,revision:1},rooms:{}};}
});

test('wide rotated outcrops and waterfall bank rocks block their real footprints',()=>{
 const r={x:0,z:0,y:1,w:3,h:2,d:.6,angle:Math.PI/2};
 assert(K.rockContains(r,0,null,2.5));assert(!K.rockContains(r,2.5,null,0));assert(K.rockContains(r,0,2,0));assert(!K.rockContains(r,0,5,0));
});
