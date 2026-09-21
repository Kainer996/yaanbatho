'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const source=html.match(/^async function initLiveMap\(\).*$/m)[0];
async function check(fail){
 const visible=new Set(),handlers={};
 const context={liveMap:null,liveMapLastPosition:null,liveMapHasPrecisePosition:false,
  getFallbackMapCenter:()=>({lat:51.5,lon:-.16}),setMapLabels(){},
  async loadMapLibreIfNeeded(){visible.add('show');if(fail)throw Error('MapLibre unavailable');},
  maplibregl:{Map:class{on(name,fn){handlers[name]=fn;}setCenter(){}}},
  BurbzFieldMapUI:{mapCredits(){}},burbzMapStyle:()=>({}),burbzPitchForZoom:()=>0,
  BURBZ_START_ZOOM:16,BURBZ_MAX_ZOOM:19,window:{devicePixelRatio:1},
  $:()=>({classList:{add:v=>visible.add(v),remove:v=>visible.delete(v)}}),
  console:{warn(){}},buildFallbackHabitatMarkers:()=>visible.add('show'),
  questMapInspectionMode:()=>false};
 context.window.maplibregl=context.maplibregl;
 for(const name of ['applyBurbzCameraPadding','wireMapRotateOnly','styleBurbzMapLayers','ensureBurbzMapSources','enableBurbzTerrain','wireMapMoveTracking','resumeWalkingQuestIfAny','resumeSideQuestIfAny','drawSideQuestNpcLandmarks','restoreSelectedQuestMapAfterLoad','refreshGeographicAvatarMarker','startLiveGeolocation','wireMapControls'])context[name]=()=>{};
 vm.createContext(context);vm.runInContext(source,context);await context.initLiveMap();
 assert(visible.has('show'),'Early fallback remains until actual map load');
 if(fail){assert.equal(handlers.load,undefined);assert(visible.has('show'));}
 else{assert.equal(typeof handlers.load,'function');handlers.load();assert(!visible.has('show'),'Loaded map must release the fallback touch overlay');}
}
(async()=>{await check(false);console.log('PASS early fallback removed after real map load');await check(true);console.log('PASS failed map keeps fallback available');})().catch(e=>{console.error(e);process.exitCode=1;});
