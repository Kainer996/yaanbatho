/* Execute actual index functions against delayed-loader/save-replacement fixtures. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),crypto=require('node:crypto'),path=require('node:path');
const base=path.resolve(__dirname,'..');
const source=fs.readFileSync(path.join(base,'index.html'),'utf8');
const C=require(path.join(base,'player_home_core.js'));
const choose=source.slice(source.indexOf('async function chooseGeographicHomeLocation('),source.indexOf('async function enterGeographicSettlement('));
const refreshAt=source.indexOf('function refreshAllScreens()'),refresh=source.slice(refreshAt,source.indexOf('\n}\n',refreshAt)+3);
async function loaderRegression(){
 const start=source.indexOf('let burbzMapLibreLoadPromise = null;'),end=source.indexOf('function getFallbackMapCenter()',start);
 assert(start>=0&&end>start,'extract the real loader and its shared state');
 function fixture(stale=false){
  const nodes=[],requests=[],timers=new Map();let nextTimer=0;
  const make=()=>({dataset:{},removed:false,remove(){this.removed=true;}});
  if(stale){const old=make();old.dataset.burbzMaplibre='1';old.onload=()=>{throw Error('stale handler');};nodes.push(old);}
  const context={window:{},Promise,Error,setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout(id){timers.delete(id);},document:{
   querySelectorAll:()=>nodes.filter(n=>!n.removed),createElement:()=>make(),head:{appendChild(node){nodes.push(node);requests.push(node);}}
  }};
  vm.createContext(context);vm.runInContext(source.slice(start,end),context);
  return{context,nodes,requests,timers,load:()=>context.loadMapLibreIfNeeded()};
 }
 const settle=async()=>{await Promise.resolve();await Promise.resolve();};
 const local=fixture(true),pending=local.load();
 assert.strictEqual(local.load(),pending,'concurrent callers share one pending request');
 assert.equal(local.requests.length,1);assert.equal(local.requests[0].src,'lib/maplibre-gl.js?v=5.24.0');
 assert(local.nodes[0].removed);assert.equal(local.nodes[0].onload,null,'already failed scripts cannot trap a new caller');
 local.context.window.maplibregl={Map:function(){}};local.requests[0].onload();await pending;await local.load();
 assert.equal(local.requests.length,1);assert.equal(local.timers.size,0);assert.equal(local.requests[0].onload,null);
 const fallback=fixture(),first=fallback.load();fallback.requests[0].onerror();await settle();
 assert.strictEqual(fallback.load(),first,'callers during CDN fallback join the same attempt');
 assert(fallback.requests[0].removed);assert.equal(fallback.requests.length,2);
 assert.equal(fallback.requests[1].src,'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js');
 fallback.context.window.maplibregl={Map:function(){}};fallback.requests[1].onload();await first;
 const failed=fixture(),both=failed.load(),rejected=assert.rejects(both,/map renderer could not load/);
 failed.requests[0].onerror();await settle();failed.requests[1].onerror();await rejected;
 assert(failed.nodes.every(n=>n.removed));assert.equal(failed.timers.size,0);
 const retry=failed.load();assert.notStrictEqual(retry,both);assert.equal(failed.requests.length,3);
 assert.equal(failed.requests[2].src,'lib/maplibre-gl.js?v=5.24.0','retry prefers the local cached renderer again');
 failed.context.window.maplibregl={Map:function(){}};failed.requests[2].onload();await retry;
 const empty=fixture(),noAPI=empty.load(),emptyRejected=assert.rejects(noAPI,/map renderer could not load/);
 empty.requests[0].onload();await settle();empty.requests[1].onload();await emptyRejected;
 assert(empty.nodes.every(n=>n.removed),'load without the expected API is a recoverable failure');
 const hung=fixture(),hanging=hung.load(),timedOut=assert.rejects(hanging,/map renderer could not load/);
 [...hung.timers.values()][0]();await settle();[...hung.timers.values()][0]();await timedOut;
 assert.equal(hung.timers.size,0);assert(hung.nodes.every(n=>n.removed));
 return{pass:true,concurrentLocal:true,concurrentFallback:true,staleScriptRemoved:true,failureCleanupAndLocalRetry:true,missingAPIRejected:true,networkTimeoutCleaned:true};
}
(async()=>{
 let release,opened=0;const pending=new Promise(r=>release=r);
 const context={gameState:{playerHome:{anchor:null}},currentScreen:'map',loadMapLibreIfNeeded:()=>pending,burbzMapStyle:()=>({}),BurbzGeographicWorldCore:{validCoordinate:()=>false},BurbzPlayerHome:{close(){}},BurbzGeographicWorld:{close(){}},BurbzGeographicHomePicker:{open(){opened++;return true;}},Promise};
 vm.createContext(context);vm.runInContext(choose,context);const waiting=context.chooseGeographicHomeLocation();context.currentScreen='birdex';release();const navigationResult=await waiting;
 const delayedOpenCount=opened;let pickerOptions,homeOpens=0,homeStart,worldPose;context.currentScreen='map';context.BurbzGeographicHomePicker.open=options=>{pickerOptions=options;return true;};context.BurbzPlayerHome.open=start=>{homeOpens++;homeStart=start;};context.enterGeographicWorld=options=>{worldPose=options.pose;return true;};
 await context.chooseGeographicHomeLocation();await pickerOptions.cancel();const mapCancelPreserved=homeOpens===0&&!worldPose;
 await context.chooseGeographicHomeLocation({returnOptions:{start:'room',options:{area:'library'}}});await pickerOptions.cancel();const homeCancelPreserved=homeOpens===1&&homeStart==='room';
 const flight={lat:52,lon:-2,altitude:150,mode:'fly'};await context.chooseGeographicHomeLocation({pose:flight});await pickerOptions.cancel();const worldCancelPreserved=worldPose===flight;
 function replacement(home,level=1,flock=[]){let refreshed=0;const closed=[];const ctx={window:{BurbzPlayerHomeCore:C,BurbzGeographicHomePicker:{close:r=>closed.push('picker:'+r)},BurbzGeographicWorld:{close:r=>closed.push('world:'+r)},BurbzPlayerHome:{close:r=>closed.push('home:'+r)}},BurbzPlayerHomeCore:C,gameState:{playerHome:home,player:{level},flock},localStorage:{getItem:()=>null},BURBZ_INTRO_SEEN_KEY:'intro',geographicWorldVisit:{},geographicMapInspect:true,geographicMapPendingPose:{lat:1,lon:2},currentScreen:'map',loadState(){},refreshGeographicHomeMarkers(){refreshed++;}};
  for(const name of ['updateHeader','initQuests','renderBirdex','renderBattleSelect','renderProfile','renderInventory','renderPetCompanion','renderLeaderboards'])ctx[name]=()=>{};
  vm.createContext(ctx);vm.runInContext(refresh,ctx);ctx.refreshAllScreens();return{closed,markerRefreshCount:refreshed,inspectionMode:ctx.geographicMapInspect,pendingPose:ctx.geographicMapPendingPose,home:ctx.gameState.playerHome};
 }
 const replaced=replacement({...C.initial(),anchor:{lat:52,lon:-2,revision:4,source:'chosen'},rooms:{library:true}}),fresh=replacement(undefined),veteran=replacement(undefined,3),stages=['welcome','house','desk','done'].map(intro=>({intro,actual:replacement({...C.initial(),intro}).home.intro}));
 const loader=await loaderRegression();
 const checks={mapRendererLoader:loader,pendingPickerNavigation:{pickerOpenCount:delayedOpenCount,result:navigationResult,pass:delayedOpenCount===0&&navigationResult===false},pickerCancelDestination:{map:mapCancelPreserved,home:homeCancelPreserved,world:worldCancelPreserved,pass:mapCancelPreserved&&homeCancelPreserved&&worldCancelPreserved},saveReplacement:{...replaced,pass:replaced.markerRefreshCount===1&&!replaced.inspectionMode&&!replaced.pendingPose&&replaced.home.anchor?.revision===4&&replaced.home.rooms.library},freshReplacement:{intro:fresh.home.intro,pass:fresh.home.intro==='welcome'},veteranReplacement:{intro:veteran.home.intro,pass:veteran.home.intro==='done'},savedIntroStages:{stages,pass:stages.every(s=>s.intro===s.actual)},forcedNavigationCleanup:{pass:/BurbzGeographicHomePicker\?\.close\('navigation'\)/.test(source)}};
 const hashes=Object.fromEntries(['index.html','geographic_world.js','geographic_world_core.js','geographic_settlement_scene.js','geographic_home_picker.js','player_home_core.js'].map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(base,file))).digest('hex')]));
 const result={at:new Date().toISOString(),method:'Actual extracted index functions and actual home core, VM dependency doubles; no browser or source mutations',hashes,checks,complete:Object.values(checks).every(c=>c.pass)};
 if(process.env.BURBZ_INTEGRATION_REVIEW_EVIDENCE)fs.writeFileSync(process.env.BURBZ_INTEGRATION_REVIEW_EVIDENCE,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
 if(!result.complete)process.exitCode=1;
})().catch(error=>{console.error(error);process.exitCode=1;});
