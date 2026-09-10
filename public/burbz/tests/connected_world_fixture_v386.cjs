/* Deterministic map inputs for the real MapLibre renderer. No renderer/camera/clock mocks. */
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),crypto=require('node:crypto'),zlib=require('node:zlib');
const C=require('../geographic_world_core.js');
const ANCHOR={lat:54.45,lon:-2.65},HOOK='\nwindow.__testEval=code=>eval(code);';
const sha=bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const coord=(x,z)=>{const g=C.unproject(ANCHOR,{x,y:0,z});return[g.lon,g.lat];};
const ring=(x,z,w,d)=>[[x-w/2,z-d/2],[x+w/2,z-d/2],[x+w/2,z+d/2],[x-w/2,z+d/2],[x-w/2,z-d/2]].map(([a,b])=>coord(a,b));
const feature=(id,properties,geometry)=>({type:'Feature',id,properties,geometry});
const data={type:'FeatureCollection',features:[
 feature(1,{class:'grass'},{type:'Polygon',coordinates:[ring(0,0,20000,20000)]}),
 feature(2,{class:'path',subclass:'footway'},{type:'LineString',coordinates:[coord(0,-10000),coord(0,10000)]}),
 feature(3,{class:'path',subclass:'footway'},{type:'LineString',coordinates:[coord(-10000,100),coord(10000,100)]}),
 feature(4,{class:'water'},{type:'Polygon',coordinates:[ring(145,80,35,50)]}),
 feature(5,{class:'building',render_height:9,render_min_height:0},{type:'Polygon',coordinates:[ring(75,65,12,16)]}),
 feature(6,{class:'wood'},{type:'Polygon',coordinates:[ring(-200,50,100,200)]})
]};
const style={version:8,name:'Explicit deterministic geographic proof input',sources:{openmaptiles:{type:'vector',tiles:['https://tiles.openfreemap.org/proof/{z}/{x}/{y}.pbf'],minzoom:0,maxzoom:16}},layers:[
 {id:'background',type:'background',paint:{'background-color':'#b8cad1'}},
 {id:'landcover',type:'fill',source:'openmaptiles','source-layer':'landcover',filter:['==',['get','class'],'grass'],paint:{'fill-color':'#729465'}},
 {id:'landcover-wood',type:'fill',source:'openmaptiles','source-layer':'landcover',filter:['==',['get','class'],'wood'],paint:{'fill-color':'#436d48'}},
 {id:'water',type:'fill',source:'openmaptiles','source-layer':'water',paint:{'fill-color':'#599da9'}},
 {id:'road-path',type:'line',source:'openmaptiles','source-layer':'transportation',paint:{'line-color':'#d9c598','line-width':7}},
 {id:'building',type:'fill',source:'openmaptiles','source-layer':'building',paint:{'fill-color':'#bfaa85'}}
]};
// Small standards-shaped MVT fixture, including real source-layer metadata. The
// production feature/collision readers therefore consume MapLibre-decoded tiles.
function vi(n){const out=[];n=Math.round(n);while(n>127){out.push((n%128)|128);n=Math.floor(n/128);}out.push(n);return Buffer.from(out);}
const packed=values=>Buffer.concat(values.map(vi)),field=(id,b)=>Buffer.concat([vi(id*8+2),vi(b.length),b]),integer=(id,n)=>Buffer.concat([vi(id*8),vi(n)]);
function vectorTile(z,x,y){
 const scale=2**z,extent=4096,layers=[];
 for(const name of ['landcover','transportation','water','building']){
  const keys=[],values=[],features=[];
  for(const f of data.features){const kind=f.properties.class,layer=kind==='grass'||kind==='wood'?'landcover':kind==='path'?'transportation':kind;if(layer!==name)continue;
   const coords=f.geometry.type==='Polygon'?f.geometry.coordinates[0].slice(0,-1):f.geometry.coordinates;let points=coords.map(([lon,lat])=>[(lon+180)/360,(1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2]).map(([mx,my])=>[Math.round((mx*scale-x)*extent),Math.round((my*scale-y)*extent)]);
   if(Math.max(...points.map(p=>p[0]))<0||Math.min(...points.map(p=>p[0]))>extent||Math.max(...points.map(p=>p[1]))<0||Math.min(...points.map(p=>p[1]))>extent)continue;
   // Every fixture polygon is an axis-aligned rectangle and every path is an
   // axis-aligned segment, so coordinate clipping is exact for these inputs.
   // Keep a small standard tile buffer; never emit20km coordinates into Int16 layout buffers.
   points=points.map(p=>p.map(v=>Math.max(-64,Math.min(extent+64,v))));
   points=points.filter((p,i)=>!i||p[0]!==points[i-1][0]||p[1]!==points[i-1][1]);
   if(points.length<(f.geometry.type==='Polygon'?3:2))continue;
   const tags=[];for(const [key,value]of Object.entries(f.properties)){let ki=keys.indexOf(key);if(ki<0){ki=keys.length;keys.push(key);}const valueKey=JSON.stringify(value);let index=values.findIndex(v=>v.key===valueKey);if(index<0){index=values.length;values.push({key:valueKey,value});}tags.push(ki,index);}
   let px=0,py=0;const commands=[];points.forEach(([a,b],i)=>{if(i===0)commands.push(9);else if(i===1)commands.push(((points.length-1)<<3)|2);const dx=a-px,dy=b-py;commands.push(dx<0?-dx*2-1:dx*2,dy<0?-dy*2-1:dy*2);px=a;py=b;});if(f.geometry.type==='Polygon')commands.push(15);
   features.push(field(2,Buffer.concat([integer(1,f.id),field(2,packed(tags)),integer(3,f.geometry.type==='Polygon'?3:2),field(4,packed(commands))])));
  }
  const valueBytes=values.map(({value})=>field(4,typeof value==='string'?field(1,Buffer.from(value)):integer(5,value)));
  layers.push(field(3,Buffer.concat([field(1,Buffer.from(name)),...features,...keys.map(k=>field(3,Buffer.from(k))),...valueBytes,integer(5,extent),integer(15,2)])));
 }
 return Buffer.concat(layers);
}
// PNG is test elevation data, not game artwork: Terrarium encodes exact metres.
const crcTable=Uint32Array.from({length:256},(_,i)=>{for(let k=0;k<8;k++)i=i&1?0xedb88320^(i>>>1):i>>>1;return i>>>0;});
function crc(bytes){let n=0xffffffff;for(const b of bytes)n=crcTable[(n^b)&255]^(n>>>8);return(n^0xffffffff)>>>0;}
function chunk(type,bytes){const name=Buffer.from(type),size=Buffer.alloc(4),sum=Buffer.alloc(4);size.writeUInt32BE(bytes.length);sum.writeUInt32BE(crc(Buffer.concat([name,bytes])));return Buffer.concat([size,name,bytes,sum]);}
function demTile(z,x,y){
 const width=512,raw=Buffer.alloc((width*4+1)*width),anchorX=(ANCHOR.lon+180)/360,metres=C.EARTH_CIRCUMFERENCE*Math.cos(ANCHOR.lat*Math.PI/180);
 for(let py=0;py<width;py++)for(let px=0;px<width;px++){
  // A gentle one-percent eastward slope gives an independent nonzero DEM check.
  let dx=(x+(px+.5)/width)/2**z-anchorX;dx-=Math.round(dx);
  const elevation=120+Math.max(-40,Math.min(40,dx*metres*.01)),encoded=Math.round((elevation+32768)*256),i=py*(width*4+1)+1+px*4;
  raw[i]=(encoded>>>16)&255;raw[i+1]=(encoded>>>8)&255;raw[i+2]=encoded&255;raw[i+3]=255;
 }
 const header=Buffer.alloc(13);header.writeUInt32BE(width);header.writeUInt32BE(width,4);header[8]=8;header[9]=6;
 return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',header),chunk('IDAT',zlib.deflateSync(raw)),chunk('IEND',Buffer.alloc(0))]);
}
const SEED=`
localStorage.setItem(BURBZ_EPOCH_KEY,BURBZ_FRESH_START_EPOCH);localStorage.setItem(BURBZ_INTRO_SEEN_KEY,'1');localStorage.setItem(BURBZ_TUTORIAL_CHAPTERS_KEY,JSON.stringify(MERLIN_TUTORIAL_CHAPTERS.map(c=>c.id)));
if(!localStorage.getItem('connected-world-proof-seeded')){
 const f=JSON.parse(JSON.stringify(DEFAULT_STATE));Object.assign(f.player,{name:'Rowan',level:20,coins:123456,branches:4321,stone:123});f.settings={music:false,sfx:false,vibration:false,appearance:'normal'};
 f.playerHome={version:2,intro:'done',tier:1,rooms:{library:true},trees:{'tree-0':{day:'2026-09-10',hits:2}},owned:{bench:1,flowers:1,rug:1,fern:1},placed:[{id:1,item:'rug',area:'room',x:0,z:1,turn:1}],finds:['desk-note'],nextId:2};
 f.lastKnownHome=null;f.worldProof='retained-v385';f.starterTimber={taken:{0:true,1:true,2:true,3:true,4:true,5:true}};for(const q of PLAYER_QUESTS)f.quests[q.id]={progress:q.target,claimed:true};localStorage.setItem('burbz_state',JSON.stringify(f));localStorage.setItem('connected-world-proof-seeded','1');
}`;
function createServer({root,baseline,port=8901,report,seed=true}){
 let version='current';const url=`http://localhost:${port}/burbz/`;
 const server=http.createServer((req,res)=>{
  const name=decodeURIComponent(new URL(req.url,url).pathname).replace(/^\/burbz\//,'')||'index.html',source=version==='baseline'?baseline:root,file=path.resolve(source,name);
  if(!file.startsWith(source+'/')){res.writeHead(403);return res.end();}
  try{
   let bytes=fs.readFileSync(file);if(bytes.length<200&&bytes.toString().startsWith('version https://git-lfs.github.com/spec/'))throw Error('Unhydrated LFS fixture: '+name);
   if(/\.(html|js|css)$/.test(name)){const key=version+':'+name,versions=report.served[key]||=[];const digest=sha(bytes);if(!versions.includes(digest))versions.push(digest);}
   if(name==='index.html'){let html=bytes.toString();if(!html.includes('\ninit();'))throw Error('bootstrap hook not found');bytes=Buffer.from(html.replace('\ninit();',HOOK+(seed?'\n'+SEED:'')+'\ninit();'));}
   const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webp':'image/webp','.png':'image/png','.svg':'image/svg+xml','.mp3':'audio/mpeg','.wav':'audio/wav'};
   res.setHeader('Content-Type',mime[path.extname(file)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.end(bytes);
  }catch(error){report.missing.push({version,name,error:error.message});res.writeHead(404);res.end();}
 });
 return{server,url,listen:()=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);}),setVersion:value=>{version=value;}};
}
async function routeMap(context,report,options={}){
 const tiles=new Map();report.mapFixture={styleSHA:sha(JSON.stringify(style)),styleRequests:0,vectorRequests:[],demRequests:[],blocked:[],terrain:'Locally encoded 512px Terrarium PNG: 120m + a one-percent eastward slope; actual MapLibre DEM decoding and rendering.',features:'MVT transport, water, woodland and building source layers decoded by MapLibre; intentionally synthetic geographic fixture, separate from real-provider proof.'};
 await context.route('**/*',async route=>{
  const request=route.request(),url=new URL(request.url());if(options.offline?.()){(report.mapFixture.offlineDenied||=[]).push(request.url());return route.abort('internetdisconnected');}if(url.hostname==='localhost'||url.hostname==='127.0.0.1')return route.continue();
  if(options.realProvider&&['tiles.openfreemap.org','tiles.mapterhorn.com'].includes(url.hostname)){(report.mapFixture.realProviderRequests||=[]).push(request.url());return route.continue();}
  if(url.hostname==='tiles.openfreemap.org'&&url.pathname==='/styles/liberty'){report.mapFixture.styleRequests++;return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify(style)});}
  if(url.hostname==='tiles.openfreemap.org'){const m=url.pathname.match(/^\/proof\/(\d+)\/(\d+)\/(\d+)\.pbf$/);if(m){const key=m.slice(1).join('/');report.mapFixture.vectorRequests.push(key);return route.fulfill({contentType:'application/x-protobuf',headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=86400'},body:vectorTile(...m.slice(1).map(Number))});}}
  if(url.hostname==='tiles.mapterhorn.com'){
   if(options.missingTerrain?.())return route.abort('internetdisconnected');
   const m=url.pathname.match(/\/(\d+)\/(\d+)\/(\d+)\.(webp|png)$/);if(m){const key=m.slice(1,4).join('/');if(!tiles.has(key))tiles.set(key,demTile(...m.slice(1,4).map(Number)));report.mapFixture.demRequests.push(key);return route.fulfill({contentType:'image/png',headers:{'Access-Control-Allow-Origin':'*','Cache-Control':'public,max-age=86400'},body:tiles.get(key)});}
  }
  report.mapFixture.blocked.push({url:request.url(),method:request.method()});return route.abort('blockedbyclient');
 });
}
async function nativeClock(page){
 await page.addInitScript(()=>{
  window.proofNativeClock={Date,raf:requestAnimationFrame,timer:setTimeout,interval:setInterval,now:performance.now};
  const NativeDate=Date,fixed=NativeDate.parse('2026-09-10T12:00:00Z');
  globalThis.Date=new Proxy(NativeDate,{construct:(target,args,newTarget)=>Reflect.construct(target,args.length?args:[fixed],newTarget),apply:target=>new target(fixed).toString(),get:(target,key,receiver)=>key==='now'?()=>fixed:Reflect.get(target,key,receiver)});
  window.proofSensorCalls={media:0,gps:0};const media=navigator.mediaDevices?.getUserMedia;if(media)navigator.mediaDevices.getUserMedia=function(...args){proofSensorCalls.media++;return media.apply(this,args);};
  const gps=navigator.geolocation?.getCurrentPosition;if(gps)navigator.geolocation.getCurrentPosition=function(...args){proofSensorCalls.gps++;return gps.apply(this,args);};
  window.proofLongTasks=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())proofLongTasks.push({start:entry.startTime,duration:entry.duration});}).observe({type:'longtask',buffered:true});
 });
}
module.exports={ANCHOR,HOOK,SEED,style,vectorTile,demTile,sha,createServer,routeMap,nativeClock};
