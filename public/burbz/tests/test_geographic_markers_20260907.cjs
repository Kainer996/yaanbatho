'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../geographic_marker_layer.js'),'utf8');
class Events{
  constructor(){this.listeners=new Map();}
  on(name,fn){if(!this.listeners.has(name))this.listeners.set(name,new Set());this.listeners.get(name).add(fn);return this;}
  off(name,fn){this.listeners.get(name)?.delete(fn);return this;}
  emit(name,event={}){for(const fn of [...(this.listeners.get(name)||[])])fn(event);}
  addEventListener(name,fn){this.on(name,fn);}
  removeEventListener(name,fn){this.off(name,fn);}
  count(name){return name?this.listeners.get(name)?.size||0:[...this.listeners.values()].reduce((n,set)=>n+set.size,0);}
}
class Element extends Events{
  constructor(doc){super();this.ownerDocument=doc;this.attributes={};this.writes=[];this.style=new Proxy({},{set:(object,key,value)=>{this.writes.push([key,value]);object[key]=value;return true;}});this.children=[];this.isConnected=true;this.classes=new Set();this.classList={add:(...names)=>names.forEach(n=>this.classes.add(n)),remove:(...names)=>names.forEach(n=>this.classes.delete(n)),toggle:(name)=>{if(this.classes.has(name)){this.classes.delete(name);return false;}this.classes.add(name);return true;}};}
  hasAttribute(name){return Object.hasOwn(this.attributes,name);}
  setAttribute(name,value){this.attributes[name]=value;}
  appendChild(child){child.remove();this.children.push(child);child.parentElement=this;child.isConnected=true;return child;}
  remove(){if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(e=>e!==this);this.parentElement=null;this.isConnected=false;}
  getClientRects(){this.layoutReads=(this.layoutReads||0)+1;return this.isConnected&&!this.cssHidden?[{width:390,height:700}]:[];}
  closest(){return this.screen;}
}
function fixture(){
  const doc=new Events();doc.hidden=false;doc.createElement=()=>new Element(doc);const observers=[];
  class Observer{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  const context={document:doc,console,IntersectionObserver:Observer,MutationObserver:Observer,requestAnimationFrame(){throw Error('No marker RAF loop');},setTimeout(){throw Error('No marker timer');}};
  vm.createContext(context);vm.runInContext(source,context);const api=context.BurbzGeographicMarkers;
  function makeMap(){
    const map=new Events();map.container=new Element(doc);map.container.screen=new Element(doc);map.canvas=new Element(doc);map.container.appendChild(map.canvas);map.projections=[];map.repaints=0;map.bearing=20;map.pitch=48;map.center={lng:0,lat:50};map.elevation=120;map.scale=10;
    map.getContainer=()=>map.container;map.getCanvasContainer=()=>map.canvas;map.getBearing=()=>map.bearing;map.getPitch=()=>map.pitch;map.getCenter=()=>({...map.center});
    map.project=coordinates=>{map.projections.push([...coordinates]);return{x:coordinates[0]*map.scale+195,y:350-coordinates[1]-map.elevation*.1};};
    map.triggerRepaint=()=>map.repaints++;
    for(const name of ['unproject','queryTerrainElevation','setTerrain','jumpTo','setCenter','getCanvas'])map[name]=()=>{throw Error('Marker must only use public CPU project: '+name);};
    Object.defineProperty(map,'terrain',{get(){throw Error('Marker must never access terrain depth internals');}});
    return map;
  }
  const map=makeMap();const marker=(options={})=>new api.Marker({element:new Element(doc),...options});
  return{doc,api,map,makeMap,marker,observers,element:()=>new Element(doc)};
}
test('many markers share one render listener and one batched repaint',()=>{
  const f=fixture();const markers=Array.from({length:150},(_,i)=>f.marker().setLngLat([i/100,50]).addTo(f.map));
  assert.equal(f.map.count('render'),1);assert.equal(f.map.repaints,1);assert.equal(f.map.projections.length,0);f.map.emit('render');assert.equal(f.map.projections.length,150);assert.equal(f.map.repaints,1);
  for(let i=0;i<10;i++)f.map.emit('render');assert.equal(f.map.projections.length,150,'unchanged renders need no projection pass');markers.forEach(m=>m.remove());assert.equal(f.map.count(),0);
});
test('existing element identity, hit listeners, accessibility and game properties survive',()=>{
  const f=fixture(),element=f.element();let clicks=0;element.addEventListener('click',()=>clicks++);element.setAttribute('aria-label','Waymarker 3');element.style.zIndex='20';element.classList.add('quest-marker-pin');
  const marker=f.marker({element}).setLngLat([1,50]).addTo(f.map);marker._burbzPickup={key:'original'};f.map.emit('render');
  assert.equal(marker.getElement(),element);assert.equal(element.parentElement,f.map.canvas);assert.equal(element.attributes['aria-label'],'Waymarker 3');assert.equal(element.style.zIndex,'20');assert.ok(element.classes.has('quest-marker-pin'));element.emit('click');assert.equal(clicks,1);assert.equal(marker._burbzPickup.key,'original');marker.remove();marker.addTo(f.map);f.map.emit('render');element.emit('click');assert.equal(clicks,2);
});
test('stored and caller coordinates stay exact while actual projection includes terrain',()=>{
  const f=fixture(),coordinates=Object.freeze([-1.780123456789,53.350987654321]),marker=f.marker().setLngLat(coordinates).addTo(f.map);f.map.emit('render');
  assert.deepEqual(f.map.projections[0],[...coordinates]);assert.deepEqual(Array.from(marker.getLngLat().toArray()),[...coordinates]);const copy=marker.getLngLat();copy.lng=99;assert.equal(marker.getLngLat().lng,coordinates[0]);
  const previous=marker.getElement().style.transform;f.map.elevation+=100;f.map.emit('sourcedata');f.map.emit('render');assert.notEqual(marker.getElement().style.transform,previous);assert.equal(marker.getLngLat().lat,coordinates[1]);
});
test('map projection uses a nearby world copy without rewriting the saved longitude',()=>{
  const f=fixture();f.map.center.lng=179.9;const marker=f.marker().setLngLat([-179.95,0]).addTo(f.map);f.map.emit('render');assert.ok(Math.abs(f.map.projections[0][0]-180.05)<1e-8);assert.equal(marker.getLngLat().lng,-179.95);
});
test('finish marker offset is only a screen offset and anchors remain distinct',()=>{
  const f=fixture(),offset=Object.freeze([14,-14]),a=f.marker({anchor:'center',offset}).setLngLat([0,50]).addTo(f.map),b=f.marker({anchor:'bottom'}).setLngLat([0,50]).addTo(f.map);f.map.emit('render');
  assert.match(a.getElement().style.transform,/^translate\(-50%, -50%\) translate\(209px, 274px\)/);assert.match(b.getElement().style.transform,/^translate\(-50%, -100%\) translate\(195px, 288px\)/);assert.deepEqual(f.map.projections,[[0,50],[0,50]]);const returned=a.getOffset();returned.x=0;assert.equal(a.getOffset().x,14);
});
test('player rotation subtracts map bearing and map pitch follows real camera',()=>{
  const f=fixture(),m=f.marker({rotationAlignment:'map',pitchAlignment:'map'}).setLngLat([0,50]).setRotation(70).addTo(f.map);f.map.emit('render');assert.match(m.getElement().style.transform,/rotateX\(48deg\) rotateZ\(50deg\)$/);
  f.map.bearing=45;f.map.pitch=32;f.map.emit('move');f.map.emit('render');assert.match(m.getElement().style.transform,/rotateX\(32deg\) rotateZ\(25deg\)$/);assert.equal(m.getRotation(),70);assert.equal(m.getRotationAlignment(),'map');
});
test('viewport marker rotation stays independent of map and automatic pitch follows rotation alignment',()=>{
  const f=fixture(),m=f.marker({rotation:15}).setLngLat([0,50]).addTo(f.map);f.map.emit('render');assert.match(m.getElement().style.transform,/rotateX\(0deg\) rotateZ\(15deg\)$/);
  m.setRotationAlignment('map');assert.equal(m.getPitchAlignment(),'map');f.map.emit('render');assert.match(m.getElement().style.transform,/rotateX\(48deg\) rotateZ\(-5deg\)$/);m.setPitchAlignment('viewport').setOffset({x:2,y:3});f.map.emit('render');assert.match(m.getElement().style.transform,/rotateX\(0deg\)/);
});
test('bursts of setters and move events only project latest values on render',()=>{
  const f=fixture(),m=f.marker().setLngLat([0,50]).addTo(f.map);f.map.emit('render');const initial=f.map.projections.length;
  for(let i=0;i<200;i++){m.setLngLat([i/100,50]);m.setRotation(i);f.map.emit('move');}assert.equal(f.map.projections.length,initial);assert.equal(f.map.repaints,2);f.map.emit('render');assert.equal(f.map.projections.length,initial+1);assert.equal(f.map.projections.at(-1)[0],1.99);assert.equal(m.getRotation(),199);
});
test('unchanged projected position causes no redundant DOM transform write',()=>{
  const f=fixture(),m=f.marker().setLngLat([0,50]).addTo(f.map);f.map.emit('render');const writes=m.getElement().writes.filter(x=>x[0]==='transform').length;
  for(let i=0;i<20;i++){f.map.emit('move');f.map.emit('render');}assert.equal(m.getElement().writes.filter(x=>x[0]==='transform').length,writes);
});
test('hidden document suspends projection and setters request no background frames',()=>{
  const f=fixture();f.doc.hidden=true;const m=f.marker().setLngLat([0,50]).addTo(f.map);assert.equal(f.map.repaints,0);f.map.emit('render');m.setRotation(20);f.map.emit('move');f.map.emit('render');assert.equal(f.map.projections.length,0);assert.equal(f.map.repaints,0);
  f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.map.repaints,1);f.map.emit('render');assert.equal(f.map.projections.length,1);
});
test('hidden or detached map suspends work and visible observer resumes exactly once',()=>{
  const f=fixture(),m=f.marker().setLngLat([0,50]).addTo(f.map);f.map.emit('render');f.map.container.cssHidden=true;f.observers.forEach(o=>o.callback());f.map.emit('move');f.map.emit('render');assert.equal(f.map.projections.length,1);m.setRotation(30);assert.equal(f.map.repaints,1);
  f.map.container.cssHidden=false;f.observers.forEach(o=>o.callback());assert.equal(f.map.repaints,2);f.map.emit('render');assert.equal(f.map.projections.length,2);f.map.container.isConnected=false;f.map.emit('move');f.map.emit('render');assert.equal(f.map.projections.length,2);
});
test('removing last marker releases map and document listeners and visibility observers',()=>{
  const f=fixture(),m=f.marker().setLngLat([0,50]).addTo(f.map);assert.equal(f.doc.count(),1);m.remove();m.remove();assert.equal(f.map.count(),0);assert.equal(f.doc.count(),0);assert.ok(f.observers.every(o=>o.disconnected));const before=f.map.repaints;m.setRotation(50);f.doc.emit('visibilitychange');assert.equal(f.map.repaints,before);assert.equal(f.map.canvas.children.length,0);
});
test('map removal clears all attached markers and permits independent reuse',()=>{
  const f=fixture(),a=f.marker().setLngLat([0,50]).addTo(f.map),b=f.marker().setLngLat([1,50]).addTo(f.map);f.map.emit('remove');assert.equal(f.map.canvas.children.length,0);assert.equal(f.map.count(),0);assert.equal(f.doc.count(),0);
  const second=f.makeMap();a.addTo(second);second.emit('render');assert.equal(a.getElement().parentElement,second.canvas);assert.equal(second.projections.length,1);assert.equal(b.getElement().parentElement,null);
});
test('multiple maps keep independent managers and moving a marker releases the original',()=>{
  const f=fixture(),second=f.makeMap(),m=f.marker().setLngLat([0,50]).addTo(f.map);m.addTo(f.map);assert.equal(f.map.count('render'),1);m.addTo(second);assert.equal(f.map.count(),0);assert.equal(second.count('render'),1);second.emit('render');assert.equal(second.projections.length,1);
});
test('one invalid projection hides only that marker and recovers on source update',()=>{
  const f=fixture();const original=f.map.project;f.map.project=p=>p[0]===1?{x:NaN,y:0}:original(p);const bad=f.marker().setLngLat([1,50]).addTo(f.map),good=f.marker().setLngLat([2,50]).addTo(f.map);assert.doesNotThrow(()=>f.map.emit('render'));assert.equal(bad.getElement().style.visibility,'hidden');assert.equal(good.getElement().style.visibility,'visible');
  f.map.project=original;f.map.emit('sourcedata');f.map.emit('render');assert.equal(bad.getElement().style.visibility,'visible');
});
test('invalid geographic input never replaces the existing valid position',()=>{
  const f=fixture(),m=f.marker().setLngLat([1,50]);for(const input of [[NaN,50],[1,Infinity],[0,91],['1',50]])assert.throws(()=>m.setLngLat(input),/finite/);assert.equal(m.getLngLat().lng,1);assert.throws(()=>m.setOffset([Infinity,0]),/finite/);assert.throws(()=>m.setRotation(NaN),/finite/);
});
test('optional popup uses public APIs and remains operable with always-visible opacity',()=>{
  const f=fixture(),m=f.marker().setLngLat([1,50]).addTo(f.map);const popup={open:false,removed:0,setLngLat(p){this.position=p;return this;},addTo(map){this.map=map;this.open=true;return this;},isOpen(){return this.open;},remove(){this.open=false;this.removed++;return this;}};
  m.setPopup(popup);assert.equal(m.getPopup(),popup);m.getElement().emit('click',{stopPropagation(){}});assert.equal(popup.open,true);assert.equal(popup.map,f.map);assert.equal(m.getElement().style.opacity,'1');m.setLngLat([2,50]);assert.equal(popup.position.lng,2);m.togglePopup();assert.equal(popup.open,false);m.togglePopup();m.remove();assert.equal(popup.open,false);m.setPopup(null);assert.equal(m.getPopup(),null);
});
test('heading setters and moving render passes never force DOM layout',()=>{
  const f=fixture(),markers=Array.from({length:100},()=>f.marker().setLngLat([0,50]).addTo(f.map));f.map.emit('render');assert.equal(f.map.container.layoutReads,1);
  for(let i=0;i<120;i++){markers[0].setRotation(i);f.map.emit('move');f.map.emit('render');}
  assert.equal(f.map.container.layoutReads,1,'cached visibility must not getClientRects on each setter/render');assert.equal(f.map.projections.length,12100);
  f.map.emit('resize');assert.equal(f.map.container.layoutReads,2);f.map.emit('render');assert.equal(f.map.container.layoutReads,2);
});
test('visibility events refresh the layout cache and hidden cheap checks work before callbacks',()=>{
  const f=fixture(),m=f.marker().setLngLat([0,50]).addTo(f.map);f.map.emit('render');const initial=f.map.container.layoutReads;
  f.doc.hidden=true;m.setRotation(40);f.map.emit('render');assert.equal(f.map.projections.length,1);assert.equal(f.map.container.layoutReads,initial);
  f.doc.hidden=false;f.doc.emit('visibilitychange');assert.equal(f.map.container.layoutReads,initial+1);f.map.emit('render');assert.equal(f.map.projections.length,2);
  f.map.container.cssHidden=true;f.map.emit('resize');m.setRotation(50);f.map.emit('render');assert.equal(f.map.projections.length,2);f.map.container.cssHidden=false;f.map.emit('resize');f.map.emit('render');assert.equal(f.map.projections.length,3);
  m.remove();const reads=f.map.container.layoutReads;f.observers.forEach(o=>o.callback());assert.equal(f.map.container.layoutReads,reads,'disposed observers must not measure detached UI');
});
