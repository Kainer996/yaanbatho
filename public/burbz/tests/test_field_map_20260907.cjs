const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const ui=require('../field_map_ui.js');
const layers=[
 {id:'background',type:'background'},
 {id:'landcover',type:'fill','source-layer':'landcover'},
 {id:'water',type:'fill'}, {id:'waterway',type:'line'},
 {id:'highway_path',type:'line',paint:{'line-width':2}},
 {id:'highway_minor_casing',type:'line',paint:{'line-width':4}},
 {id:'building',type:'fill'}, {id:'building_3d',type:'fill-extrusion'},
 {id:'place_city',type:'symbol',layout:{'text-field':['get','name']}},
 {id:'highway_name',type:'symbol','source-layer':'transportation_name'}
];
const snapshot=JSON.stringify(layers),paints={},layouts={};
const map={getStyle:()=>({layers,sources:{real:{url:'unchanged'}}}),
 setPaintProperty:(id,k,v)=>{(paints[id]||={})[k]=v;},setLayoutProperty:(id,k,v)=>{(layouts[id]||={})[k]=v;},getLayoutProperty:(id,k)=>layouts[id]?.[k]};
ui.apply(map);
assert.equal(JSON.stringify(layers),snapshot,'Provider source/style input untouched');
assert.equal(paints.highway_path['line-color'][7],'#fff1bd');
assert.equal(paints.highway_minor_casing['line-color'],'#65694f');
assert.equal(paints.water['fill-color'],'#527f86');
assert.equal(paints.place_city['text-halo-width'],1.6);
assert.equal(layouts.building_3d.visibility,'none');
assert.equal(layouts.highway_name.visibility,'none');
assert.equal(paints.highway_path['line-width'],undefined,'Provider road widths preserved');
assert.equal(ui.pickupIcon({id:'starter_timber',glyph:'🪵'}),'🪵');
assert.equal(ui.pickupIcon({id:'woodland_timber',glyph:'🪵'}),'🪵');
assert.equal(ui.pickupIcon({id:'xp',glyph:'📜'}),'📜');
assert.equal(ui.pickupIcon({id:'frog',glyph:'frog-art'}),'frog-art','Unchanged pickups retain their specific icon');
const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const fn=html.slice(html.indexOf('function switchScreen(name)'),html.indexOf('\nfunction activateGameHudDestination'));
let opened=0,trail=0,notices=0,allowed=false;
const ctx={geographicPlaces:null,window:{},currentScreen:'map',featureGateOpen:()=>allowed,featureUnlockHint:()=> 'Existing milestone',showToast:()=>notices++,SFX:{page:()=>{}},recordScreenTrail:()=>trail++,
 $$:()=>[],$:()=>null,document:{querySelectorAll:()=>[],body:{setAttribute:()=>{}}},syncBurbzMusicForMapZoom:()=>{},updateMerlinListeningUI:()=>{},academyViewPause:()=>{},renderInventory:()=>opened++,queueActionBadgeUpdate:()=>{}};
vm.createContext(ctx);vm.runInContext(fn,ctx);
ctx.switchScreen('inventory');assert.equal(opened,0);assert.equal(trail,0);assert.equal(ctx.currentScreen,'map');assert.equal(notices,1);
allowed=true;ctx.switchScreen('inventory');assert.equal(opened,1);assert.equal(ctx.currentScreen,'inventory');assert.equal(trail,1);
const gate=require('../onboarding_gate_core.js');
const input={chainIds:['start','pq_equip_gear','later'],claimedIds:[],playerLevel:1,evidence:{}};
assert.equal(gate.unlockedFeatures(input).inventory,false);
assert.equal(gate.unlockedFeatures({...input,claimedIds:['start']}).inventory,true);
assert.equal(gate.unlockedFeatures({...input,evidence:{inventory:true}}).inventory,true);
assert.equal(gate.unlockedFeatures({...input,playerLevel:12}).inventory,true);
for(const file of ['field_map_ui.js','field_map_ui.css']){
 const pin=file+'?v=map-pictures-v374-20260908';
 assert.ok(html.includes(pin));
 assert.equal(fs.readFileSync(path.join(root,'sw.js'),'utf8').split(pin).length-1,3);
 assert.ok(fs.readFileSync(path.join(root,'../../scripts/update-live-burbz.sh'),'utf8').includes('"'+file+'"'));
}
console.log('Field map: presentation, geometry preservation, pickup icons, Stores early/eligible/legacy gates and offline dependencies passed.');
