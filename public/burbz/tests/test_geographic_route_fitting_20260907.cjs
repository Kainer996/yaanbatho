'use strict';
// Exercise the production controller, with an independent perspective camera.
// MapLibre's public project/unproject sample terrain in the actual browser;
// this double models an elevated plane and clamps its real camera zoom limits.
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const renderer = fs.readFileSync(path.join(__dirname,'..','geographic_map_3d.js'),'utf8');
const cameraCore = require('../geographic_camera_core.js');
const DEM = 'burbz-geographic-dem';
const clone = value => JSON.parse(JSON.stringify(value));
function freeze(value) { if (value && typeof value==='object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
class Events {
  constructor() { this.events=new Map(); }
  on(name,fn) { if(!this.events.has(name))this.events.set(name,new Set());this.events.get(name).add(fn);return this; }
  off(name,fn) { this.events.get(name)?.delete(fn);return this; }
  emit(name,event={}) { for(const fn of [...(this.events.get(name)||[])])fn(event); }
  addEventListener(name,fn) { this.on(name,fn); }
  removeEventListener(name,fn) { this.off(name,fn); }
}
function element(rect,hidden=false) {
  return {getBoundingClientRect:()=>({...rect,width:rect.right-rect.left,height:rect.bottom-rect.top}),getClientRects:()=>hidden?[]:[rect]};
}
function fixture(options={}) {
  let width=options.width||390,height=options.height||526;
  const offset=options.offset||[40,90];
  const mapRect={left:offset[0],top:offset[1],right:offset[0]+width,bottom:offset[1]+height};
  const container={...element(mapRect),clientWidth:width,clientHeight:height,isConnected:true,appendChild(){},closest:()=>null};
  const canvas=new Events(),map=new Events();
  const camera={lng:-1.52,lat:53.365,zoom:15,pitch:50,padding:{top:230,right:0,bottom:0,left:0}};
  const calls={fits:[],jumps:[],projects:[],unprojects:[],padding:[],saves:0};
  const sources=new Map(),layers=new Map();
  const origin={lng:-1.52,lat:53.365},metresX=66500,metresY=111320,metresPerPixel0=93700;
  const world=point=>[(point[0]-origin.lng)*metresX,(origin.lat-point[1])*metresY];
  const geographic=point=>({lng:origin.lng+point[0]/metresX,lat:origin.lat-point[1]/metresY});
  let time=0,serial=0;
  const timers=new Map();
  map.demLoaded=options.demLoaded!==false;
  map.getContainer=()=>container;map.getCanvasContainer=()=>canvas;
  map.getZoom=()=>camera.zoom;map.getPitch=()=>camera.pitch;map.getCenter=()=>({lng:camera.lng,lat:camera.lat});
  map.getStyle=()=>({layers:[]});map.isStyleLoaded=()=>true;map.isSourceLoaded=()=>map.demLoaded;
  map.getSource=id=>sources.get(id);map.addSource=(id,source)=>sources.set(id,source);map.removeSource=id=>sources.delete(id);
  map.getLayer=id=>layers.get(id);map.addLayer=layer=>layers.set(layer.id,layer);map.removeLayer=id=>layers.delete(id);
  map.setTerrain=terrain=>{map.terrain=terrain;};map.getTerrain=()=>map.terrain;
  map.setPixelRatio=()=>{};map.setLayoutProperty=()=>{};
  map.triggerRepaint=()=>{};map.isMoving=()=>false;
  map.setPadding=padding=>{camera.padding=clone(padding);calls.padding.push(clone(padding));};
  map.cameraForBounds=(bounds,settings)=>{
    calls.fits.push({bounds:clone(bounds),settings:clone(settings),existingPadding:clone(camera.padding)});
    if(options.noInitialCamera)return null;
    const southwest=world(bounds[0]),northeast=world(bounds[1]),pad=settings.padding;
    const extentX=Math.abs(northeast[0]-southwest[0]),extentY=Math.abs(northeast[1]-southwest[1]);
    const scale=Math.min((width-pad.left-pad.right)/Math.max(.001,extentX),(height-pad.top-pad.bottom)/Math.max(.001,extentY));
    const zoom=options.initialZoom??Math.min(settings.maxZoom,Math.log2(scale*metresPerPixel0));
    const actualScale=2**zoom/metresPerPixel0;
    const targetX=(pad.left+width-pad.right)/2,targetY=(pad.top+height-pad.bottom)/2;
    const center=geographic([(southwest[0]+northeast[0])/2-(targetX-width/2)/actualScale,(southwest[1]+northeast[1])/2-(targetY-height/2)/actualScale]);
    return {center,zoom,bearing:0};
  };
  map.jumpTo=step=>{
    if(step.center){const lng=step.center.lng??step.center[0],lat=step.center.lat??step.center[1];assert.ok(Number.isFinite(lng)&&Number.isFinite(lat),'nonfinite camera center');camera.lng=lng;camera.lat=lat;}
    if(step.zoom!==undefined){assert.ok(Number.isFinite(step.zoom),'nonfinite camera zoom');camera.zoom=Math.max(4,Math.min(19,step.zoom));}
    if(step.pitch!==undefined)camera.pitch=step.pitch;
    if(step.padding)camera.padding=clone(step.padding);
    calls.jumps.push({step:clone(step),camera:clone(camera)});map.emit('moveend');
  };
  map.project=point=>{
    calls.projects.push([...point]);
    if(options.throwProjection)throw Error('projection unavailable');
    if(options.invalidAbovePitch!==undefined && camera.pitch>options.invalidAbovePitch)return {x:NaN,y:NaN};
    const p=world(point),center=world([camera.lng,camera.lat]),x=p[0]-center[0],y=p[1]-center[1];
    const angle=camera.pitch*Math.PI/180,scale=2**camera.zoom/metresPerPixel0,sin=Math.sin(angle),cos=Math.cos(angle),distance=800;
    const altitude=map.demLoaded&&map.terrain?(options.elevation??90):0;
    const depth=distance-(y*sin+altitude*cos)*scale;
    return {x:width/2+x*scale*distance/depth,y:height/2+(y*cos-altitude*sin)*scale*distance/depth};
  };
  map.unproject=pixel=>{
    calls.unprojects.push([...pixel]);
    if(options.throwUnproject)throw Error('terrain raycast unavailable');
    const angle=camera.pitch*Math.PI/180,scale=2**camera.zoom/metresPerPixel0,sin=Math.sin(angle),cos=Math.cos(angle),distance=800;
    const altitude=map.demLoaded&&map.terrain?(options.elevation??90):0,sx=pixel[0]-width/2,sy=pixel[1]-height/2;
    const y=(sy*distance+altitude*scale*(sin*distance-sy*cos))/(scale*(distance*cos+sy*sin));
    const x=sx*(distance-(y*sin+altitude*cos)*scale)/(scale*distance);
    const center=world([camera.lng,camera.lat]);
    return geographic([center[0]+x,center[1]+y]);
  };
  const cardTop=options.cardTop??Math.round(height*.60);
  const cardRect={left:mapRect.left,top:mapRect.top+cardTop,right:mapRect.right,bottom:mapRect.bottom};
  const card=element(cardRect),occluders=options.occluders||[card],observers=[];
  let doc;
  if(options.document){
    doc=new Events();doc.hidden=false;doc.getElementById=id=>id==='mapQuestFocusCard'?card:null;doc.querySelectorAll=()=>occluders;
    doc.createElement=()=>{
      const button=new Events(),span={},status={};button.setAttribute=()=>{};button.querySelector=()=>span;
      return {querySelector:selector=>selector==='button'?button:status,remove(){}};
    };
  }
  class ResizeObserver {
    constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}
    observe(target){this.target=target;}
    disconnect(){this.disconnected=true;}
    notify(){if(!this.disconnected)this.callback([{target:this.target}]);}
  }
  const gameState=freeze({player:{coins:235,xp:19},walkingQuest:{checkpointIndex:3,route:[{lon:-1.52,lat:53.365}],returnLeg:true},settings:{appearance:'comic'}});
  const ctx={console,performance:{now:()=>time},devicePixelRatio:1,BurbzGeographicCameraCore:cameraCore,gameState,
    localStorage:{getItem(){throw Error('fit may not read saves');},setItem(){calls.saves++;throw Error('fit may not write saves');}},
    setTimeout:(fn,delay)=>{const id=++serial;timers.set(id,{fn,due:time+(Number(delay)||0)});return id;},clearTimeout:id=>timers.delete(id)};
  if(doc){ctx.document=doc;ctx.ResizeObserver=ResizeObserver;}
  vm.createContext(ctx);vm.runInContext(renderer,ctx,{filename:'geographic_map_3d.js'});
  const controller=ctx.BurbzGeographicMap3D.attach(map);
  function tick(ms=500) {
    const end=time+ms;let count=0;
    while(true){const next=[...timers].filter(([,timer])=>timer.due<=end).sort((a,b)=>a[1].due-b[1].due)[0];if(!next)break;assert.ok(++count<40,'unbounded fit timer chain');time=next[1].due;timers.delete(next[0]);next[1].fn();}time=end;
  }
  function resize(nextWidth,nextHeight,nextCardTop=Math.round(nextHeight*.60)){
    width=nextWidth;height=nextHeight;container.clientWidth=width;container.clientHeight=height;
    mapRect.right=mapRect.left+width;mapRect.bottom=mapRect.top+height;
    cardRect.right=mapRect.right;cardRect.bottom=mapRect.bottom;cardRect.top=mapRect.top+nextCardTop;
  }
  return {controller,map,camera,calls,container,canvas,occluders,timers,gameState,tick,doc,card,observers,resize,
    resizeCard:top=>{cardRect.top=mapRect.top+top;},notifyCard:()=>observers.forEach(observer=>observer.notify()),advance:ms=>{time+=ms;}};
}
const route=freeze([
  {lon:-1.525,lat:53.361},{lon:-1.516,lat:53.358},{lon:-1.514,lat:53.367},
  {lon:-1.519,lat:53.373},{lon:-1.526,lat:53.369},{lon:-1.525,lat:53.361}
]);
function allVisible(f,points) {
  const bounds=f.controller.state.fit.area;
  for(const point of points){const p=f.map.project(Array.isArray(point)?point:[point.lon,point.lat]);assert.ok(p.x>=bounds.left-.75&&p.x<=bounds.right+.75&&p.y>=bounds.top-.75&&p.y<=bounds.bottom+.75,JSON.stringify({p,bounds}));}
}

test('actual controller fits terrain-projected whole walks above portrait and landscape cards',()=>{
  for(const [width,height] of [[390,526],[320,480],[844,300],[1280,746]]) {
    const f=fixture({width,height});
    assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true,JSON.stringify(f.controller.state.fit));
    assert.equal(f.controller.state.fit.points,route.length);assert.equal(f.controller.state.fit.status,'fit');
    assert.ok(f.controller.state.fit.iterations<=36);assert.equal(f.controller.state.fit.pitch,32);allVisible(f,route);
    assert.ok(f.controller.state.fit.area.bottom<=Math.round(height*.60)-14);
    assert.deepEqual(f.calls.fits[0].existingPadding,{top:0,right:0,bottom:0,left:0});
    assert.equal(f.calls.fits[0].settings.maxZoom,15.8);f.controller.dispose();
  }
});

test('controller uses measured map-relative controls and the actual short-phone card boundary',()=>{
  const offset=[40,90];
  const f=fixture({offset,cardTop:131,occluders:[
    element({left:40,top:221,right:430,bottom:616}),
    element({left:48,top:130,right:98,bottom:205}),
    element({left:40,top:90,right:430,bottom:616},true)
  ]});
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true);
  assert.ok(f.controller.state.fit.area.bottom<=117);allVisible(f,route);f.controller.dispose();
});

test('offscreen terrain shift uses correctly signed unproject recentering and is independently rechecked',()=>{
  const f=fixture({elevation:700});
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true);
  assert.ok(f.calls.unprojects.length>0,'fixture must exercise screen-space panning');
  assert.ok(f.calls.projects.length>=route.length*2,'the corrected camera must be reprojected');allVisible(f,route);f.controller.dispose();
});

test('all coordinates, repeated return legs, precise GPS and saved progress remain unchanged',()=>{
  const gps=freeze({lon:-1.531,lat:53.362,accuracy:9,source:'gps'});
  const returnPath=freeze([route[0],route[1],route[2],route[1],route[0],gps]);
  const f=fixture(),before=JSON.stringify({returnPath,gps,state:f.gameState});
  assert.equal(f.controller.fitRoute(returnPath,{occluders:f.occluders}),true);f.tick();
  assert.equal(f.controller.state.fit.points,returnPath.length);
  assert.equal(JSON.stringify({returnPath,gps,state:f.gameState}),before);assert.equal(f.calls.saves,0);
  const expected=returnPath.map(p=>[p.lon,p.lat]);
  assert.deepEqual(f.calls.projects.slice(0,returnPath.length),expected);
  assert.deepEqual(f.calls.fits[0].bounds,[[-1.531,53.358],[-1.514,53.367]]);allVisible(f,returnPath);f.controller.dispose();
});

test('invalid pitched projections lower pitch only as needed and retain the fallback policy',()=>{
  for(const [threshold,expected] of [[20,18],[0,0]]) {
    const f=fixture({invalidAbovePitch:threshold});
    assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true);
    assert.equal(f.controller.state.fit.pitch,expected);assert.equal(f.controller.getPitch(15,true),expected);allVisible(f,route);f.controller.dispose();
  }
});

test('negative initial zoom and an impossible tiny viewport terminate with an honest flat non-fit',()=>{
  const f=fixture({width:100,height:140,cardTop:80,initialZoom:-8,elevation:0});
  const worldRoute=freeze([[-170,-65],[170,65],[-170,-65]]);
  assert.equal(f.controller.fitRoute(worldRoute,{occluders:f.occluders}),false);
  assert.notEqual(f.controller.state.fit.status,'fit');assert.equal(f.controller.getPitch(4,true),0);
  assert.ok(f.controller.state.fit.iterations<=36);assert.ok(f.calls.jumps.length<=39);
  assert.ok(f.calls.jumps.every(call=>call.camera.zoom>=4&&Number.isFinite(call.camera.zoom)));
  assert.equal(f.calls.fits[0].settings.maxZoom,15.8);f.controller.dispose();
});

test('missing initial camera, projection/raycast failures and no available area keep the adapter fallback flat',()=>{
  for(const settings of [{noInitialCamera:true},{throwProjection:true},{throwUnproject:true,elevation:700},{width:70,height:70,cardTop:40}]) {
    const f=fixture(settings);
    assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),false);
    assert.equal(f.controller.getPitch(15,true),0,'a failed controller fit must not make tuneCameraForZoom repitch the flat adapter fallback');
    assert.notEqual(f.controller.state.fit?.status,'fit');
    if(!settings.width){
      settings.noInitialCamera=false;settings.throwProjection=false;settings.throwUnproject=false;
      assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true,'failed fitting must release its reentrancy guard');
    }
    f.controller.dispose();
  }
});

test('late DEM arrival performs at most two guarded re-fits and retains complete geometry',()=>{
  const f=fixture({demLoaded:false,elevation:500});
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders,isCurrent:()=>true}),true);f.tick();
  assert.equal(f.calls.fits.length,1);f.map.demLoaded=true;
  for(let i=0;i<100;i++)f.map.emit('sourcedata',{sourceId:DEM});f.tick(1000);
  assert.equal(f.calls.fits.length,3);allVisible(f,route);
  for(let i=0;i<10;i++){f.map.emit('sourcedata',{sourceId:DEM});f.tick();}
  assert.equal(f.calls.fits.length,3);assert.equal(f.controller.state.fit.points,route.length);f.controller.dispose();
});

test('pointerdown cancels pending terrain re-fits before manual pan and does not block an explicit later fit',()=>{
  const f=fixture({demLoaded:false});
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true);f.tick();
  f.canvas.emit('pointerdown');f.map.jumpTo({center:{lng:-1.45,lat:53.38}});
  const afterPan=clone(f.camera),jumpCount=f.calls.jumps.length;f.map.demLoaded=true;
  for(let i=0;i<20;i++)f.map.emit('sourcedata',{sourceId:DEM});f.tick(1000);
  assert.equal(f.calls.fits.length,1);assert.equal(f.calls.jumps.length,jumpCount);assert.deepEqual(f.camera,afterPan);
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true);assert.equal(f.calls.fits.length,2);f.controller.dispose();
});

test('stale selection, expired pending work and disposal prevent late terrain recentering',()=>{
  for(const reason of ['stale','expired','disposed']) {
    let current=true;const f=fixture({demLoaded:false});
    assert.equal(f.controller.fitRoute(route,{occluders:f.occluders,isCurrent:()=>current}),true);f.tick();
    if(reason==='stale')current=false;else if(reason==='expired')f.advance(16000);else f.controller.dispose();
    const count=f.calls.jumps.length;f.map.demLoaded=true;f.map.emit('sourcedata',{sourceId:DEM});f.tick(1000);
    assert.equal(f.calls.jumps.length,count,reason);assert.equal(f.calls.fits.length,1);f.controller.dispose();
  }
});

test('hidden map does not run a pending camera refit when optional DEM fails',()=>{
  const f=fixture({demLoaded:false});
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders,isCurrent:()=>true}),true);f.tick();
  f.container.isConnected=false;
  const count=f.calls.jumps.length;
  for(let i=0;i<3;i++)f.map.emit('error',{sourceId:DEM,error:Error('offline DEM')});
  f.tick(1000);
  assert.equal(f.controller.state.visible,false);
  assert.equal(f.calls.jumps.length,count,'hidden map camera should remain idle when DEM fallback becomes ready');
  f.controller.dispose();
});

test('an already stale route or invalid geographic input never changes the camera',()=>{
  const f=fixture(),before=f.calls.jumps.length;
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders,isCurrent:()=>false}),false);
  assert.equal(f.controller.fitRoute([[NaN,53],[-1.52,53.36]],{occluders:f.occluders}),false);
  assert.equal(f.calls.jumps.length,before);assert.equal(f.calls.fits.length,0);f.controller.dispose();
});

test('flat control requests a verified flat fit and restored 3D uses a bounded inspection pitch',()=>{
  const f=fixture();f.controller.setEnabled(false);
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true);assert.equal(f.controller.state.fit.pitch,0);allVisible(f,route);
  f.controller.setEnabled(true);assert.equal(f.controller.fitRoute(route,{occluders:f.occluders}),true);
  assert.equal(f.controller.getPitch(15,true),32);assert.ok(f.controller.getPitch(15,false)>40);f.controller.dispose();
});

test('orientation resize refits the retained complete route after the 15-second terrain window',()=>{
  const f=fixture(),before=JSON.stringify(route);
  assert.equal(f.controller.fitRoute(route,{occluders:f.occluders,isCurrent:()=>true}),true);f.tick(1000);
  const initial=f.calls.fits.length;f.advance(16000);f.resize(844,300,176);
  for(let i=0;i<100;i++)f.map.emit('resize');f.tick(1000);
  assert.ok(f.calls.fits.length>initial,'expired terrain window must not discard the explicit resize route');
  assert.ok(f.calls.fits.length<=initial+3,'resize burst must coalesce, with at most two follow-up terrain fits');
  assert.ok(f.controller.state.fit.area.right<=820);assert.ok(f.controller.state.fit.area.bottom<=162);allVisible(f,route);
  assert.equal(f.controller.state.fit.points,route.length);assert.equal(JSON.stringify(route),before);
  const settled=f.calls.fits.length;f.tick(10000);assert.equal(f.calls.fits.length,settled);f.controller.dispose();
});

test('actual card ResizeObserver refits current geometry when theme text changes after terrain expiry',()=>{
  const f=fixture({document:true});
  assert.equal(f.observers.length,1);assert.equal(f.observers[0].target,f.card);
  assert.equal(f.controller.fitRoute(route,{isCurrent:()=>true}),true);f.tick(1000);f.advance(16000);
  const initial=f.calls.fits.length,oldBottom=f.controller.state.fit.area.bottom;
  f.resizeCard(240);for(let i=0;i<50;i++)f.notifyCard();f.tick(1000);
  assert.ok(f.calls.fits.length>initial&&f.calls.fits.length<=initial+3);
  assert.ok(f.controller.state.fit.area.bottom<oldBottom);assert.equal(f.controller.state.fit.area.bottom,226);allVisible(f,route);
  f.controller.dispose();assert.ok(f.observers.every(observer=>observer.disconnected));
});

test('stale selection cancels retained resize fitting and cannot resurrect the previous route later',()=>{
  for(const signal of ['viewport','card']){
    let current=true;const f=fixture({document:true});
    assert.equal(f.controller.fitRoute(route,{isCurrent:()=>current}),true);f.tick(1000);f.advance(16000);
    current=false;const initial=f.calls.jumps.length;
    if(signal==='viewport'){f.resize(844,300,176);f.map.emit('resize');}else{f.resizeCard(240);f.notifyCard();}
    f.tick(1000);assert.equal(f.calls.jumps.length,initial,signal);
    current=true;f.map.emit('resize');f.notifyCard();f.tick(1000);
    assert.equal(f.calls.jumps.length,initial,'stale retained route should be released');f.controller.dispose();
  }
});

test('hidden and disposed maps do not run retained viewport or card refits',()=>{
  for(const reason of ['hidden','disposed']){
    const f=fixture({document:true});assert.equal(f.controller.fitRoute(route,{isCurrent:()=>true}),true);f.tick(1000);f.advance(16000);
    const initial=f.calls.jumps.length;
    if(reason==='hidden'){f.doc.hidden=true;f.doc.emit('visibilitychange');}else f.controller.dispose();
    f.resize(844,300,176);f.map.emit('resize');f.notifyCard();f.tick(1000);
    assert.equal(f.calls.jumps.length,initial,reason);
    if(reason==='hidden'){
      f.doc.hidden=false;f.doc.emit('visibilitychange');f.tick(1000);
      assert.ok(f.calls.jumps.length>initial,'the still-current route may refit after returning to the map');allVisible(f,route);
    }else assert.ok(f.observers.every(observer=>observer.disconnected));
    f.controller.dispose();
  }
});
