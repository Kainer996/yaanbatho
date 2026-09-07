'use strict';
// Run the actual inline navigation/camera functions. MapLibre geometry and
// DOM rectangles are deterministic doubles; physical rendering is browser QA.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function functionSource(name) {
  const match = new RegExp('(?:async )?function ' + name + '\\(').exec(html);
  assert.ok(match, 'Missing production function ' + name);
  const rest = html.slice(match.index);
  const next = /\n(?:async )?function \w+\(/.exec(rest);
  assert.ok(next, 'Missing function boundary for ' + name);
  return rest.slice(0, next.index);
}
const functions = [
  'openNetworkQuestOfferDetail', 'focusQuestOnMap', 'questOverviewGeoJSON',
  'questMapInspectionMode', 'setQuestMapInspectionMode',
  'applyBurbzCameraPadding', 'tuneCameraForZoom', 'fitSelectedQuestRoute',
  'updateLiveMapPosition', 'restoreSelectedQuestMapAfterLoad'
].map(functionSource).join('\n');

const original = {
  name:'Test circuit', kind:'path', routeFingerprint:'qa-route-one',
  routeSchemaVersion:1, routeMode:'loop', lengthM:1400,
  points:[{lat:53.3707,lon:-1.5104},{lat:53.375,lon:-1.514}]
};
function fixture(offers = [original]) {
  const state = { inspection:false, pitch:52, padding:null, paddingWrites:0, frames:[], layouts:0, fits:[], moves:[], draws:[], markerDraws:0, center:[-1.50,53.36], markerUpdates:[] };
  const buttons = { '#wqNetworkBegin':{}, '#wqNetworkMap':{} };
  const sheet = { innerHTML:'', querySelector:selector => buttons[selector] };
  const shell = { classList:{contains:() => state.inspection,toggle:() => {}} };
  const card = { classList:{contains:() => true},getBoundingClientRect:() => ({top:400,bottom:650,height:250}) };
  const canvas = { style:{}, dataset:{} };
  const container = { clientHeight:700,getBoundingClientRect:() => ({top:0,bottom:700,width:390,height:700}) };
  class Bounds { constructor(){this.points=[];} extend(point){this.points.push(point);return this;} }
  const map = {
    getContainer:() => container, getCanvasContainer:() => canvas,
    getZoom:() => 15, getPitch:() => state.pitch, getBearing:() => 0,
    getCenter:() => ({lng:state.center[0],lat:state.center[1]}),
    isMoving:() => false, getPadding:() => state.padding, setPadding:padding => {state.padding=padding;state.paddingWrites++;},
    dragPan:{enable:() => {state.drag=true;},disable:() => {state.drag=false;}},
    fitBounds:(bounds,options) => state.fits.push({points:bounds.points,options}),
    easeTo:options => {state.moves.push(options);if(options.pitch!==undefined)state.pitch=options.pitch;},
    flyTo:options => state.moves.push(options)
  };
  const ctx = {
    console, Promise, maplibregl:{LngLatBounds:Bounds}, window:{maplibregl:{LngLatBounds:Bounds},BurbzWalkingQuestUI:require('../walking_quest_ui.js')},
    liveMap:map, liveMapHasPrecisePosition:true, liveMapLastPosition:{lat:53.37,lon:-1.512,accuracy:8},
    liveMapUserMoved:false, liveMapUserMarker:{setLngLat:point => state.markerUpdates.push(point)},
    liveMapSpawns:[], liveMapFeatureCount:0,
    questOverview:{on:false,offers:[...offers],selectedIndex:null,prevZoom:null,areaBirdsWasOpen:null},
    walkQuestOffersCache:[], BURBZ_START_ZOOM:16.35, QUEST_OVERVIEW_ZOOM:14.8,
    $:id => id==='liveMapShell'?shell:id==='mapQuestFocusCard'?card:null,
    walkQuestSheetEl:() => sheet, nextWalkingStoryForLength:() => null,
    previewWalkingEncounters:() => [], escapeHtml:String,
    showWalkQuestSheet:() => {state.sheetOpen=true;},
    closeWalkQuestSheet:() => {state.sheetOpen=false;},
    activeWalkingQuest:() => null, openActiveWalkQuestSheet:() => {},
    startWalkingQuestFromOffer:() => {}, SFX:{tap:() => {}},
    switchScreen:screen => {state.screen=screen;},
    areaBirdsOpenPreference:() => false, setAreaBirdsOpen:() => {},
    drawQuestOverviewLines:() => state.draws.push(ctx.questOverviewGeoJSON()),
    drawQuestOverviewMarkers:() => {state.markerDraws++;},
    renderQuestMapFocusCard:() => {state.inspection=true;},
    questOfferDisplayPoints:offer => offer.points,
    questOverviewColor:() => '#b2c69d',
    ensureOfferLoopBack:() => Promise.resolve(null),
    fetchQuestLikelyBirds:() => Promise.resolve([]), likelyRowsToQuestBirds:() => [],
    setTimeout:fn => {fn();return 1;}, requestAnimationFrame:fn => {state.frames.push(fn);},
    syncQuestMapFocusLayout:() => {state.layouts++;}, syncBurbzMusicForMapZoom:() => {},
    setMapLabels:() => {}, mapDistanceMeters:() => 100,
    drawPlayerRange:() => {}, mapRegionForCoords:() => 'unsupported',
    drawBirdSpawns:() => {}, updateNearbyCard:() => {}
  };
  vm.createContext(ctx);
  const pitchSource = html.match(/^function burbzPitchForZoom\([^\n]+/m)[0];
  vm.runInContext(pitchSource + '\n' + functions,ctx);
  return {ctx,state,buttons};
}
let passed=0;
async function main() {
  for (const detached of [false,true]) {
    const other={...original,name:'Other route',routeFingerprint:'other'};
    const {ctx,state,buttons}=fixture(detached?[other]:[original]);
    ctx.openNetworkQuestOfferDetail(original);
    assert.equal(typeof buttons['#wqNetworkMap'].onclick,'function');
    buttons['#wqNetworkMap'].onclick();
    assert.equal(ctx.questOverview.on,true);
    assert.equal(ctx.questOverview.offers[ctx.questOverview.selectedIndex],original);
    assert.equal(state.screen,'map');
    assert.equal(state.sheetOpen,false);
    assert.equal(state.draws.length,1);
    const selected=state.draws[0].features.filter(f=>f.properties.selected);
    assert.equal(selected.length,1);
    assert.equal(selected[0].properties.name,original.name);
    assert.equal(selected[0].geometry.coordinates.length,original.points.length);
    assert.equal(state.markerDraws,1);
    assert.equal(state.fits.length,1);
    passed++;
  }
  {
    const {ctx,state,buttons}=fixture();
    ctx.openNetworkQuestOfferDetail({...original});
    buttons['#wqNetworkMap'].onclick();
    assert.equal(ctx.questOverview.offers.length,1,'matching fingerprint must not duplicate route');
    assert.equal(state.draws[0].features[0].properties.selected,true);
    passed++;
  }
  {
    const {ctx,state}=fixture();state.inspection=true;
    ctx.fitSelectedQuestRoute(original);
    const {points,options}=state.fits[0];
    for(const point of original.points)assert.ok(points.some(p=>p[0]===point.lon&&p[1]===point.lat));
    assert.ok(points.some(p=>p[0]===ctx.liveMapLastPosition.lon&&p[1]===ctx.liveMapLastPosition.lat));
    assert.equal(options.pitch,0);assert.equal(options.bearing,0);assert.equal(options.maxZoom,15.8);assert.equal(options.duration,0);
    assert.equal(options.padding.bottom,318,'reserve card top plus gap');
    assert.equal(options.padding.top,76);assert.equal(options.padding.left,28);
    assert.ok(700-options.padding.top-options.padding.bottom>=120);
    passed++;
  }
  {
    const {ctx,state}=fixture();state.inspection=true;
    ctx.liveMap.getContainer=()=>({clientHeight:526,getBoundingClientRect:()=>({top:0,bottom:526,width:390,height:526})});
    const previousSelector=ctx.$;
    ctx.$=id=>id==='mapQuestFocusCard'?{classList:{contains:()=>true},getBoundingClientRect:()=>({top:131,bottom:495,height:364})}:previousSelector(id);
    ctx.fitSelectedQuestRoute(original);
    const padding=state.fits[0].options.padding;
    assert.ok(526-padding.bottom<=131-18,'even a tall phone brief must not cover the fitted route');
    assert.ok(526-padding.top-padding.bottom>=32,'retain a positive visible map area');
    passed++;
  }
  {
    const {ctx,state}=fixture();state.inspection=true;
    ctx.setQuestMapInspectionMode(true);
    assert.equal(state.drag,true);assert.equal(state.pitch,0);
    assert.equal(state.padding.top,0);assert.equal(state.padding.bottom,0);
    state.pitch=48;ctx.tuneCameraForZoom();assert.equal(state.pitch,0,'moveend tuning must retain inspection pitch');
    const writes=state.paddingWrites;
    ctx.applyBurbzCameraPadding();assert.equal(state.padding.top,0,'resize must not restore avatar padding');
    assert.equal(state.paddingWrites,writes,'unchanged padding must not interrupt camera movement');
    state.inspection=false;ctx.setQuestMapInspectionMode(false);
    assert.equal(state.drag,false);assert.equal(state.padding.top,308);
    assert.ok(state.pitch>=44,'normal perspective returns on close');
    passed++;
  }
  {
    const {ctx,state}=fixture();state.inspection=true;ctx.questOverview.on=true;ctx.questOverview.selectedIndex=0;
    assert.match(functionSource('initLiveMap'),/restoreSelectedQuestMapAfterLoad\(\)/,'map load must restore the selected route');
    ctx.restoreSelectedQuestMapAfterLoad();
    assert.equal(state.draws.length,1);assert.equal(state.markerDraws,1);
    assert.equal(state.fits.length,0,'wait for card layout before fitting');
    state.frames.shift()();assert.equal(state.layouts,1);assert.equal(state.fits.length,1);
    ctx.restoreSelectedQuestMapAfterLoad();
    ctx.questOverview.selectedIndex=null;
    state.frames.shift()();assert.equal(state.fits.length,1,'stale load callback must not refit a closed or changed selection');
    passed++;
  }
  {
    const {ctx,state}=fixture();state.inspection=true;
    await ctx.updateLiveMapPosition(53.372,-1.514,'GPS',{precise:true,fly:false,accuracy:7});
    await ctx.updateLiveMapPosition(53.373,-1.515,'GPS',{precise:true,fly:true,accuracy:7});
    assert.equal(state.moves.length,0,'GPS must update location without recentering inspection');
    assert.equal(state.markerUpdates.length,2,'live player marker must still move');
    assert.equal(ctx.liveMapLastPosition.lat,53.373);
    state.inspection=false;
    await ctx.updateLiveMapPosition(53.374,-1.516,'GPS',{precise:true,accuracy:7});
    assert.equal(state.moves.length,1,'normal GPS following resumes after inspection');
    passed++;
  }
  console.log('PASS: '+passed+' walking map navigation and inspection contracts');
}
main().catch(error=>{console.error(error);process.exitCode=1;});
