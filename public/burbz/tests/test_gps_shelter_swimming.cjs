const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../geographic_world_core.js'),C=require('../flight_craft_core.js'),H=require('../player_home_core.js');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
function section(start,end){return html.slice(html.indexOf(start),html.indexOf(end,html.indexOf(start)));}
function app(){const home=H.initial(true);home.anchor={lat:54,lon:-2,revision:1,source:'initial'};const a={gameState:{playerHome:home,worldJourney:{saved:true}},BurbzGeographicWorldCore:G,Date,Number,Error,refreshGeographicAvatarMarker(){},durableSaveState:()=>({ok:true})};vm.createContext(a);vm.runInContext(section('function placeTemporaryShelter(','async function enterGeographicWorld('),a);vm.runInContext(section('function validLivePosition(','// Remember roughly'),a);return a;}
test('shelter follows GPS only before construction; building replaces it at chosen coordinates',()=>{
 const a=app();assert(a.placeTemporaryShelter({lat:55,lon:-3}));assert.equal(a.gameState.playerHome.anchor.revision,2);assert.equal(a.gameState.worldJourney,null);
 const proposal=H.propose(a.gameState.playerHome,{branches:25},{kind:'build-home',lat:56,lon:-4,expectedRevision:2});assert(proposal.ok);a.gameState.playerHome=proposal.home;
 assert.equal(proposal.home.tier,1);assert.equal(proposal.home.anchor.lat,56);assert.equal(proposal.wallet.branches,0);assert(!a.placeTemporaryShelter({lat:57,lon:-5}));assert.equal(a.gameState.playerHome.anchor.lat,56);assert.equal(H.normalize(JSON.parse(JSON.stringify(proposal.home))).tier,1);
});
test('failed or stale shelter writes keep the original home and journey',()=>{
 const a=app(),before=JSON.stringify(a.gameState);a.durableSaveState=()=>({ok:false});assert(!a.placeTemporaryShelter({lat:55,lon:-3}));assert.equal(JSON.stringify(a.gameState),before);a.durableSaveState=()=>({ok:true});assert(!a.placeTemporaryShelter({lat:55,lon:-3},()=>false));assert.equal(JSON.stringify(a.gameState),before);
});
test('door requests a fresh actual GPS fix, rejects stale/denied fixes, and skips GPS for a built house',async()=>{
 const a=app();let settings;a.navigator={geolocation:{getCurrentPosition(ok,fail,options){settings=options;ok({coords:{latitude:55,longitude:-3,accuracy:8},timestamp:Date.now()});}}};assert(await a.prepareOpeningShelter(()=>true));assert.equal(settings.maximumAge,0);assert.equal(a.gameState.playerHome.anchor.lat,55);
 const before=JSON.stringify(a.gameState);a.navigator.geolocation.getCurrentPosition=ok=>ok({coords:{latitude:56,longitude:-4,accuracy:8},timestamp:Date.now()-120000});await assert.rejects(a.prepareOpeningShelter(()=>true),/fresh location/);assert.equal(JSON.stringify(a.gameState),before);
 a.navigator.geolocation.getCurrentPosition=(ok,fail)=>fail();await assert.rejects(a.prepareOpeningShelter(()=>true),/Allow location/);assert.equal(JSON.stringify(a.gameState),before);a.gameState.playerHome.tier=1;assert(await a.prepareOpeningShelter(()=>true));
});
test('tiny shack has a reachable desk and door; stored furnishings survive replacement',()=>{
 const s=H.initial(true),layout=H.roomLayout(s),w=H.world(s,'room');assert(layout.width*layout.depth<16);assert.equal(H.roomLayout({...s,tier:1}).width,9);assert(w.allowed(0,layout.spawnZ));assert(w.allowed(0,layout.standZ));for(let z=layout.standZ;z<layout.doorZ-.1;z+=.05)assert(w.allowed(0,z));assert(!w.allowed(2,0));assert(!w.allowed(0,layout.deskZ));
 s.owned.books=1;s.placed=[{id:1,item:'books',area:'room',x:3,z:0,turn:0}];const n=H.normalize(s);assert.equal(n.placed.length,0);assert.equal(n.owned.books,1);
});
test('swimming is durable, bounded, solid-aware, reaches land and can reboard',()=>{
 const sample=(x,z)=>({height:0,kind:x<2?'sea':'ground'}),clear=()=>true,walk=()=>true,p={x:0,y:0,z:0,yaw:0,pitch:0,mode:'swim'};
 for(let i=0;i<80;i++)C.swimStep(p,{side:1},.02,sample,clear,walk);assert.equal(p.mode,'walk');assert(p.x>=2&&p.x<2.1);
 Object.assign(p,{x:0,mode:'swim'});C.swimStep(p,{side:1},100,sample,clear,walk);assert(p.x<=.145);
 const before=p.x;C.swimStep(p,{side:1},.02,sample,()=>false,walk);assert.equal(p.x,before);C.swimStep(p,{side:1},.02,()=>null,clear,walk);assert.equal(p.x,before);
 const pose={lat:54,lon:-2,altitude:0,yaw:0,pitch:0,mode:'swim'};assert(G.validatePose(pose));assert.equal(G.normalizePose(JSON.parse(JSON.stringify(pose))).mode,'swim');assert(C.boardable(C.at(pose,'parked','sea'),pose));assert(!C.resumeRequired(C.at(pose,'parked','sea')));
});
test('real quest map shows one exact built-house marker independently of GPS and virtual journey',()=>{
 const markers=[];class Marker{constructor(){markers.push(this);}setLngLat(p){this.point=p;return this;}addTo(map){this.map=map;return this;}remove(){this.removed=true;}}
 const a={gameState:{playerHome:{...H.initial(true),tier:1,anchor:{lat:55,lon:-3,revision:4,source:'chosen'}}},liveMap:{id:'real-map'},window:{maplibregl:{Marker}},maplibregl:{Marker},BurbzPlayerHomeCore:H,geographicHomeMarker:null,geographicAvatarMarker:null,savedGeographicPose:()=>null,refreshCampMarkers(){},document:{createElement:()=>({style:{},setAttribute(){}})}};
 vm.createContext(a);vm.runInContext(section('function refreshGeographicAvatarMarker()','function initializePlayerHome()'),a);a.refreshGeographicAvatarMarker();assert.equal(markers.length,1);assert.deepEqual(Array.from(markers[0].point),[-3,55]);a.gameState.lastKnownHome={lat:1,lon:2};a.refreshGeographicAvatarMarker();assert.equal(markers.length,1);assert.deepEqual(Array.from(markers[0].point),[-3,55]);a.gameState.playerHome.tier=0;a.refreshGeographicAvatarMarker();assert(markers[0].removed);assert.equal(a.geographicHomeMarker,null);
});
test('temporary GPS clearing removes only nearby scenery in a disposable travelling scene',()=>{
 const T=require('../lib/three.min.js'),scene=new T.Scene(),ground=new T.Mesh(new T.BoxGeometry(200,.1,200),new T.MeshBasicMaterial());scene.add(ground);scene.userData.walkSurface={ground};scene.userData.walkTerrain={radius:100};
 const near=new T.Mesh(new T.BoxGeometry(3,4,3),new T.MeshBasicMaterial()),far=near.clone();near.position.set(0,2,0);far.position.set(50,2,50);scene.add(near,far);
 const trees=new T.InstancedMesh(new T.BoxGeometry(.5,4,.5),new T.MeshBasicMaterial(),2);trees.setMatrixAt(0,new T.Matrix4().makeTranslation(3,2,4));trees.setMatrixAt(1,new T.Matrix4().makeTranslation(70,2,70));scene.add(trees);
 const a={gameState:{playerHome:{...H.initial(true),anchor:{lat:54,lon:-2,revision:1,source:'initial'}}},BurbzGeographicWorldCore:G};vm.createContext(a);vm.runInContext(section('function prepareShelterClearing(','async function createTravellingSettlement('),a);
 const kept=a.prepareShelterClearing(T,scene,{lat:54,lon:-2},[near,far]);assert.equal(kept.length,1);assert.equal(kept[0],far);assert(!near.visible);assert(far.visible);assert(ground.visible);const m=new T.Matrix4();trees.getMatrixAt(0,m);assert.equal(m.elements[0],0);trees.getMatrixAt(1,m);assert.equal(m.elements[12],70);
});

test('a player on the bank can enter water again to retrieve their craft',()=>{
 const p={x:.02,y:0,z:0,yaw:0,pitch:0,mode:'walk'},sample=x=>({height:0,kind:x>=0?'ground':'freshwater'});
 assert(C.swimStep(p,{side:-1},.05,sample,()=>true,()=>true));assert.equal(p.mode,'swim');assert(p.x<0);
});

test('a simultaneous initial GPS anchor does not cancel first door entry; building during GPS does',async()=>{
 const a=app();let success;a.navigator={geolocation:{getCurrentPosition(ok){success=ok;}}};const enter=a.prepareOpeningShelter(()=>true);assert(a.placeTemporaryShelter({lat:55,lon:-3}));success({coords:{latitude:56,longitude:-4,accuracy:8},timestamp:Date.now()});assert(await enter);assert.equal(a.gameState.playerHome.anchor.lat,56);
 const later=a.prepareOpeningShelter(()=>true);a.gameState.playerHome={...a.gameState.playerHome,tier:1};success({coords:{latitude:57,longitude:-5,accuracy:8},timestamp:Date.now()});assert.equal(await later,false);assert.equal(a.gameState.playerHome.anchor.lat,56);
});
