const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
const root=path.join(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const definitions=vm.runInNewContext(html.slice(html.indexOf('const EMPIRE_BUILDINGS = ['),html.indexOf('const EMPIRE_BUILDING_INDEX ='))+';EMPIRE_BUILDINGS');
const tavern=definitions.find(b=>b.id==='tavern'),hall=definitions.find(b=>b.id==='village_hall');
assert.equal(tavern.name,'Tavern');assert.equal(tavern.maxLevel,3);assert.equal(tavern.need,'joy');assert.equal(tavern.perLevel,12);assert.equal(tavern.buildMinutes,50);assert.equal(tavern.unlockLevel,6);
assert.equal(JSON.stringify(tavern.cost),JSON.stringify({coins:45,branches:15,stone:0}));
assert.equal(hall.maxLevel,1);assert.equal(hall.unlockLevel,1,'Hall is available from level 1 without progression');assert.equal(hall.buildMinutes,50);assert.equal(hall.need,undefined);assert.equal(hall.tier,undefined);assert.deepEqual(hall.cost,tavern.cost);
const returnSource=html.slice(html.indexOf('function returnToVillageHallDesk(){'),html.indexOf('function openCommandDesk('));
for(const id of ['tavern','village_hall'])for(const owned of [false,true])for(const mode of ['geographic','village','town']){
 const saved={target:{seed:17,buildingId:id},standalone:mode!=='geographic',geographicPose:{lat:1,lon:2}};
 let opened=0,room=0,walk=0;
 const ctx={gameState:{commandDeskReturn:saved},currentScreen:mode==='geographic'?'scan':mode,buildingRoomsAdapter:()=>({describe:()=>owned?{}:null}),BurbzGeographicWorldCore:{validCoordinate:()=>true},enterGeographicWorld:()=>{opened++;return Promise.resolve();},openEmpireVillage:()=>opened++,currentTownSettlement:()=>({id:'town-17'}),currentVillage:()=>({seed:17}),townScene:{},townRenderer:{},villageScene:{},villageRenderer:{},openBuildingInterior:()=>room++,walkBuildingInterior:()=>walk++,setTimeout:fn=>fn(),showToast:()=>{}};
 vm.createContext(ctx);vm.runInContext(returnSource,ctx);assert.equal(ctx.returnToVillageHallDesk(),id==='village_hall'&&owned);
 assert.equal(opened,id==='village_hall'&&owned?1:0);assert.equal(room,id==='village_hall'&&owned&&mode!=='geographic'?1:0);assert.equal(walk,room);assert.equal(ctx.gameState.commandDeskReturn,saved,'no free grant or save rewrite');
}
const ctx={console};vm.createContext(ctx);for(const file of ['lib/three.min.js','settlement_models.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),ctx);
for(const id of ['tavern','village_hall']){const model=ctx.BurbzSettlementModels.building(ctx.THREE,id,1,()=>.5),meta=model.userData;assert.equal(meta.buildingModel,id);assert(meta.architecture);assert(Number.isFinite(meta.door.x+meta.door.z));assert(meta.footprint.width>0&&meta.footprint.depth>0);model.traverse(o=>{if(o.geometry)for(const n of o.geometry.attributes.position.array)assert(Number.isFinite(n));});}
const interior=require('../building_interior_core.js');assert.equal(interior.interiorView('village_hall',{level:1}).id,'village_hall');assert(fs.existsSync(path.join(root,interior.imagePath(interior.interiorView('village_hall',{level:1})))));
console.log('PASS separate catalogue/economy, 12 legacy/owned geographic/village/town return cases, exterior doors/footprints, existing card asset');
