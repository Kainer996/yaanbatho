'use strict';
const CURRENT_BUILD = 'market-tabs-v389-20260910';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const C=require('../geographic_world_core.js'),walk=require('../village_walk_core.js');
const extract=(name,next)=>html.slice(html.indexOf('function '+name+'('),html.indexOf('function '+next+'('));
test('five actual miles remain five miles at UK settlement coordinates and across rebases',()=>{
 for(const origin of [{lat:54.45,lon:-2.65},{lat:53.381,lon:-1.47},{lat:0,lon:179.99}]){
  const metres=5*1609.344,end=C.unproject(origin,{x:metres,y:143,z:0}),projected=C.project(origin,end);
  assert(Math.abs(projected.x-metres)<1e-5);assert(Math.abs(C.distance(origin,end)-metres)<.1);
  const shifted=C.project(end,origin);assert(Math.abs(Math.hypot(shifted.x,shifted.z)-metres)<1e-5);
 }
});
test('passive avatar refresh neither moves the real map nor changes GPS',()=>{
 const calls=[],pose={lat:54.45,lon:-2.65},gps={lat:51,lon:0};
 const ctx={liveMap:{},geographicAvatarMarker:null,savedGeographicPose:()=>pose,liveMapLastPosition:gps,window:{maplibregl:{}},document:{createElement:()=>({setAttribute(){}})},maplibregl:{Marker:class{constructor(o){calls.push(['marker',o.element]);}setLngLat(p){calls.push(['position',p]);return this;}addTo(map){calls.push(['map',map]);return this;}remove(){calls.push(['removed']);}}}};
 vm.createContext(ctx);vm.runInContext(extract('refreshGeographicAvatarMarker','initializePlayerHome'),ctx);ctx.refreshGeographicAvatarMarker();ctx.refreshGeographicAvatarMarker();assert.equal(calls.filter(c=>c[0]==='marker').length,1);assert.strictEqual(ctx.liveMapLastPosition,gps);assert.equal(calls.filter(c=>c[0]==='position').length,3);ctx.savedGeographicPose=()=>null;ctx.refreshGeographicAvatarMarker();assert.equal(ctx.geographicAvatarMarker,null);
 assert(!html.includes('geographicMapInspect'));assert(!html.includes('mapWorldExploreBtn'));assert(!html.includes('frameGeographicJourneyOnMap'));
});
test('settlement transfer preserves canonical position and heading without GPS authority',async()=>{
 let handoff;const save={playerHome:{anchor:{lat:54.45,lon:-2.65}}},record={lat:54.46,lon:-2.66};const ctx={BurbzGeographicWorldCore:C,gameState:save,currentScreen:'village',BurbzVillageWalk:{isOpen:()=>true,close:()=>{}},enterGeographicWorld:o=>{handoff=o;return true;},$:()=>({click(){}})};
 vm.createContext(ctx);vm.runInContext('async '+extract('exploreFromSettlement','refreshGeographicAvatarMarker'),ctx);
 const local={x:45,z:-23,yaw:.7,pitch:.1,mode:'fly'};assert(await ctx.exploreFromSettlement(record,local));const p=C.project(record,handoff.pose);assert(Math.abs(p.x-local.x)<1e-6);assert(Math.abs(p.z-local.z)<1e-6);assert.equal(handoff.pose.yaw,.7);assert.equal(handoff.pose.mode,'fly');assert(handoff.isCurrent());ctx.currentScreen='scan';assert(!handoff.isCurrent());assert.strictEqual(ctx.gameState,save);
});
test('forged upgrades and purchases cannot spend on a coin-shortage path',()=>{
 const calls=[],ctx={gameState:{player:{coins:2,branches:0},inventory:{items:{}}},lootCore:()=>({forgeUpgradeCost:()=>({coins:80,branches:5}),canUpgradeForge:()=>({ok:false,missing:['coins','timber']})}),burbzForgeLevel:()=>1,showResourceQuestPrompt:(...a)=>calls.push(a),showToast:()=>{throw Error('must show choices');},addCoins:()=>{throw Error('must not spend');}};
 vm.createContext(ctx);vm.runInContext(extract('upgradeForge','renderForgeCraft'),ctx);ctx.upgradeForge();assert.deepEqual(calls,[['coins',80,'Upgrading the forge']]);
});
test('changed module pins and footstep assets agree across all three worker lists and updater',()=>{
 const rev='home-countryside-v387-20260910',sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),updater=fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8');
 const modules=['audio_core.js','first_person_hud.js','first_person_hud.css','geographic_world.js','geographic_world.css','player_home.js','player_home_core.js','village_walk.js','village_walk_core.js','village_walk_scene.js','scan_home.css'];
 const assets=fs.readdirSync(path.join(root,'assets/audio/footsteps')).filter(f=>f.endsWith('.mp3')).map(f=>'assets/audio/footsteps/'+f);assert.equal(assets.length,6);
 assert(html.includes("const BURBZ_BUILD = '"+CURRENT_BUILD+"'"));assert(sw.match(/const BURBZ_CACHE = '([^']+)'/)[1].endsWith(CURRENT_BUILD));
 for(const list of ['BURBZ_ASSETS','BURBZ_CORE','BURBZ_INSTALL_REQUIRED']){const entries=[...sw.match(new RegExp('const '+list+' = \\[([\\s\\S]*?)\\];'))[1].matchAll(/^\s*['"](\.\/[^'"]+)['"]/gm)].map(m=>m[1]);for(const name of [...modules.map(f=>f+'?v='+rev),...assets])assert.equal(entries.filter(e=>e==='./'+name).length,1,list+': '+name);}
 for(const f of [...modules,...assets]){assert(fs.existsSync(path.join(root,f)));assert(updater.includes('"'+f+'"'));}
});
