const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../geographic_home_picker.js'),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function harness(){let document,maps=[],requests=[];
 class Node extends EventTarget{
  constructor(tag='div'){super();this.tagName=tag.toUpperCase();this.children=[];this.style={};this.inert=false;this.disabled=false;this.hidden=false;this.tabIndex=this.tagName==='BUTTON'?0:-1;}
  setAttribute(key,value){this[key]=value;}
  appendChild(node){node.remove();this.children.push(node);node.parent=this;return node;}
  remove(){if(this.parent){this.parent.children=this.parent.children.filter(n=>n!==this);this.parent=null;}}
  get isConnected(){return this===document.body||!!this.parent?.isConnected;}
  getClientRects(){return this.isConnected&&!this.hidden?[{}]:[];}
  closest(){for(let n=this;n;n=n.parent)if(n.inert)return n;return null;}
  focus(){document.activeElement=this;}
  set innerHTML(value){if(!value.includes('data-picker'))return;this.nodes={'.gwp-map':new Node(),'.gwp-coordinates':new Node(),'[data-picker=locate]':new Node('button'),'[data-picker=cancel]':new Node('button'),'[data-picker=place]':new Node('button')};this.nodes['[data-picker=locate]'].disabled=true;this.nodes['[data-picker=place]'].disabled=true;for(const n of Object.values(this.nodes))this.appendChild(n);}
  querySelector(selector){return this.nodes?.[selector];}
  querySelectorAll(){return Object.values(this.nodes||{}).filter(n=>n.tagName==='BUTTON');}
 }
 document=new EventTarget();document.body=new Node('body');document.body.style.overflow='clip';document.createElement=tag=>new Node(tag);
 const app=new Node(),alreadyInert=new Node(),previous=new Node('button');alreadyInert.inert=true;document.body.appendChild(app);document.body.appendChild(alreadyInert);app.appendChild(previous);previous.focus();
 class MapStub extends EventTarget{
  constructor(options){super();this.options=options;this.center={lng:options.center[0],lat:options.center[1]};this.removes=0;maps.push(this);}
  on(type,listener){this.addEventListener(type,listener);}
  emit(type){this.dispatchEvent(new Event(type));}
  getCenter(){return this.center;}
  stop(){this.stops=(this.stops||0)+1;this.emit('move');}
  jumpTo(options){this.center={lng:options.center[0],lat:options.center[1]};this.lastJump=options;this.emit('move');}
  remove(){this.removes++;if(this.removeFails)throw Error('lost context');}
 }
 const window=new EventTarget(),navigator={geolocation:{getCurrentPosition:(success,error,options)=>requests.push({success,error,options})}};const context={document,AbortController,navigator,devicePixelRatio:2,maplibregl:{Map:MapStub},addEventListener:window.addEventListener.bind(window)};
 vm.createContext(context);vm.runInContext(source,context);
 const root=()=>document.body.children.find(n=>n.id==='geographicHomePicker');
 return{api:context.BurbzGeographicHomePicker,document,window,app,alreadyInert,previous,maps,root,requests,navigator,
  click:kind=>root().querySelector('[data-picker='+kind+']').dispatchEvent(new Event('click')),
  key:(key,shiftKey=false)=>{const e=new Event('keydown',{cancelable:true});Object.assign(e,{key,shiftKey});document.dispatchEvent(e);return e;},
  cleaned:()=>{assert.equal(root(),undefined);assert.equal(app.inert,false);assert.equal(alreadyInert.inert,true);assert.equal(document.body.style.overflow,'clip');assert.equal(document.activeElement,previous);}
 };
}
(async()=>{
 let load,returned=0;const early=harness();const opening=early.api.open({loadMapLibre:()=>new Promise(resolve=>load=resolve),cancel:()=>returned++});
 assert(early.api.isOpen());assert(early.app.inert);assert.equal(await early.api.open({}),false,'second picker cannot take ownership');
 early.api.close();early.cleaned();assert.equal(returned,1);load();assert.equal(await opening,false);assert.equal(early.maps.length,0,'late library load cannot recreate a cancelled picker');

 const h=harness();let commits=0,placed=0,cancelled=0,save;
 await h.api.open({anchor:{lat:52,lon:-2},style:{version:8},loadMapLibre:async()=>{},commit:()=>{commits++;return commits===1?{ok:false,error:'Storage full'}:new Promise(resolve=>save=resolve);},placed:()=>placed++,cancel:()=>cancelled++});
 const map=h.maps[0],button=h.root().querySelector('[data-picker=place]');map.emit('load');assert.equal(button.disabled,false);assert.equal(map.options.center[0],-2);
 button.focus();assert(h.key('Tab').defaultPrevented);assert.equal(h.document.activeElement,h.root().querySelector('[data-picker=locate]'));h.key('Tab',true);assert.equal(h.document.activeElement,button);
 h.click('place');await tick();assert.equal(commits,1);assert.equal(placed,0);assert(h.api.isOpen());assert.equal(button.disabled,false);assert.equal(h.root().querySelector('.gwp-coordinates').textContent,'Storage full');
 assert.equal(map.stops,1,'Place freezes map inertia before reading the committed crosshair');map.emit('move');map.emit('load');map.emit('error');assert.equal(h.root().querySelector('.gwp-coordinates').textContent,'Storage full','queued inertia/load/tile errors cannot erase a failed save');
 h.root().querySelector('.gwp-map').dispatchEvent(new Event('pointerdown'));assert.match(h.root().querySelector('.gwp-coordinates').textContent,/Crosshair:/,'a deliberate map gesture dismisses the saved error');
 h.click('place');h.click('place');assert.equal(commits,2,'duplicate save taps commit only once');h.api.close();assert(h.api.isOpen(),'ordinary Back waits for in-flight durable save');save({ok:true});await tick();assert.equal(placed,1);assert.equal(cancelled,0);assert.equal(map.removes,1);h.cleaned();h.key('Escape');assert.equal(cancelled,0,'closed picker key listeners are removed');

 const forced=harness();placed=0;cancelled=0;
 await forced.api.open({loadMapLibre:async()=>{},commit:()=>new Promise(resolve=>save=resolve),placed:()=>placed++,cancel:()=>cancelled++});forced.maps[0].emit('load');forced.click('place');assert(forced.api.isOpen());
 forced.api.close('save-replaced');forced.cleaned();save({ok:true});await tick();assert.equal(placed,0);assert.equal(cancelled,0);assert.equal(forced.maps[0].removes,1,'forced close disposes once while save awaits');

 const hidden=harness();cancelled=0;await hidden.api.open({loadMapLibre:async()=>{},cancel:()=>cancelled++});hidden.maps[0].removeFails=true;hidden.window.dispatchEvent(new Event('pagehide'));hidden.cleaned();assert.equal(cancelled,0,'pagehide never restores the preceding game view');
 const invalid=harness();await invalid.api.open({loadMapLibre:async()=>{}});const im=invalid.maps[0];im.center={lat:NaN,lng:0};im.emit('load');assert(invalid.root().querySelector('[data-picker=place]').disabled);im.center={lat:0,lng:540};im.emit('move');assert.equal(invalid.root().querySelector('[data-picker=place]').disabled,false);assert.match(invalid.root().querySelector('.gwp-coordinates').textContent,/-180\.00000/);invalid.api.close('navigation');invalid.cleaned();
 const fail=harness();cancelled=0;assert.equal(await fail.api.open({loadMapLibre:async()=>{throw Error('Library unavailable');},cancel:()=>cancelled++}),false);assert.match(fail.root().querySelector('.gwp-coordinates').textContent,/Library unavailable/);fail.key('Escape');fail.cleaned();assert.equal(cancelled,1);

 const gps=harness();let selected=null;commits=0;await gps.api.open({loadMapLibre:async()=>{},commit:point=>{commits++;selected=point;return{ok:true};}});const gm=gps.maps[0];gm.emit('load');
 assert.equal(gps.requests.length,0,'opening picker never requests GPS');gps.click('locate');gps.click('locate');assert.equal(gps.requests.length,1,'duplicate Locate taps share one request');
 assert.deepEqual(JSON.parse(JSON.stringify(gps.requests[0].options)),{enableHighAccuracy:true,timeout:12000,maximumAge:0});
 gps.requests[0].error({code:1});assert.match(gps.root().querySelector('.gwp-coordinates').textContent,/permission was denied/);assert.equal(gps.root().querySelector('[data-picker=locate]').disabled,false);
 gm.emit('move');assert.match(gps.root().querySelector('.gwp-coordinates').textContent,/permission was denied/,'queued map movement also preserves location denial');
 const fix=()=>({coords:{latitude:52.1,longitude:-1.2,accuracy:12},timestamp:Date.now()});
 const invalidFixes=[{coords:{latitude:85.052}},{coords:{latitude:'52'}},{coords:{longitude:181}},{coords:{accuracy:501}},{coords:{accuracy:-1}},{coords:{accuracy:NaN}},{timestamp:Date.now()-31000},{timestamp:Date.now()+10000},{timestamp:NaN}];
 for(const change of invalidFixes){const position=fix();if(change.coords)Object.assign(position.coords,change.coords);else Object.assign(position,change);gps.click('locate');gps.requests.at(-1).success(position);assert.match(gps.root().querySelector('.gwp-coordinates').textContent,/fresh, accurate/);assert.deepEqual(gm.center,{lng:0,lat:0});assert.equal(commits,0);}
 gps.click('locate');gps.requests.at(-1).success(fix());assert.deepEqual(gm.center,{lng:-1.2,lat:52.1});assert.equal(gm.lastJump.zoom,15);assert.equal(commits,0,'location only previews; it cannot anchor or grant rewards');assert.match(gps.root().querySelector('.gwp-coordinates').textContent,/then press Place/);
 gm.center={lat:52.2,lng:-1.3};gm.emit('move');gps.click('locate');const late=gps.requests.at(-1);gps.click('place');await tick();assert.equal(commits,1);assert.equal(selected.lat,52.2);assert(Math.abs(selected.lon+1.3)<1e-10,'Place commits the adjusted crosshair, not the last GPS fix');gps.cleaned();late.success(fix());assert.deepEqual(gm.center,{lat:52.2,lng:-1.3},'late location cannot move a placed/disposed map');
 const retry=harness();await retry.api.open({loadMapLibre:async()=>{}});retry.maps[0].emit('load');retry.navigator.geolocation=null;retry.click('locate');assert.match(retry.root().querySelector('.gwp-coordinates').textContent,/unavailable in this browser/);
 retry.navigator.geolocation={getCurrentPosition:(success,error)=>error({code:3})};retry.click('locate');assert.match(retry.root().querySelector('.gwp-coordinates').textContent,/timed out/);assert.equal(retry.root().querySelector('[data-picker=locate]').disabled,false);
 retry.navigator.geolocation={getCurrentPosition:(success,error)=>retry.requests.push({success,error})};retry.click('locate');retry.api.close('navigation');retry.cleaned();retry.requests[0].success(fix());assert.deepEqual(retry.maps[0].center,{lat:0,lng:0},'navigation discards pending location callbacks');
 console.log('Home picker: finite map choice, focus/cancellation/save lifecycle, explicit location preview with fresh accurate fixes, denial/unavailable/timeout retry, and stale callback guards pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
