const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync(require.resolve('../geographic_cache.js'),'utf8');
// Response byte lengths are simulated so budget tests do not allocate64MB or
// compete with actual browser rendering. Headers, URLs and cache ordering are real.
class ResponseStub{
 constructor(body={byteLength:12},options={}){this.length=typeof body==='string'?body.length:body.byteLength;this.status=options.status??200;this.statusText=options.statusText||'';this.type=options.type||'basic';this.headers=new Headers(options.headers);this.ok=this.status>=200&&this.status<300;this.tag=options.tag||'';this.reads=0;}
 clone(){return new ResponseStub({byteLength:this.length},{status:this.status,statusText:this.statusText,type:this.type,headers:this.headers,tag:this.tag});}
 async arrayBuffer(){this.reads++;return{byteLength:this.length};}
 static error(){return new ResponseStub({byteLength:0},{status:0,type:'error'});}
}
function harness(ResponseImpl=ResponseStub){const values=new Map();let clock=0,network=new ResponseStub(),openFails=false,putFails=false,fetches=0;
 const cache={async match(request){return values.get(request.url)?.clone();},async put(request,response){if(putFails)throw Error('QuotaExceededError');values.set(request.url,response.clone());},async delete(request){return values.delete(request.url);},async keys(){return [...values.keys()].map(url=>({url}));}};
 const context={Headers,Response:ResponseImpl,URL,Date:{now:()=>++clock},caches:{async open(){if(openFails)throw Error('Cache unavailable');return cache;}},fetch:async()=>{fetches++;if(network instanceof Error)throw network;return network;}};
 vm.createContext(context);vm.runInContext(source,context);const api=context.BurbzGeographicCache;
 async function request(url,options={}){let response,waits=[];const event={request:{url,method:options.method||'GET',credentials:options.credentials||'same-origin',headers:new Headers(options.headers)},respondWith:p=>{response=p;},waitUntil:p=>waits.push(p)};const handled=api.respond(event);if(!handled)return{handled};const value=await response;await Promise.all(waits);return{handled,value};}
 return{api,values,request,setNetwork:v=>network=v,setOpenFailure:v=>openFails=v,setPutFailure:v=>putFails=v,get fetches(){return fetches;}};
}
const tile=n=>'https://tiles.openfreemap.org/planet/20260910/15/100/'+n+'.pbf';
const meta=n=>'https://tiles.openfreemap.org/styles/style-'+n+'.json';
(async()=>{
 const h=harness();
 for(const [url,options] of [[tile(0),{method:'POST'}],['https://example.com/a',{}],['https://tiles.openfreemap.org.evil.test/a',{}],['http://tiles.openfreemap.org/a',{}],['https://user:pass@tiles.openfreemap.org/a',{}],['https://tiles.openfreemap.org:8443/a',{}],[tile(0),{headers:{Authorization:'Bearer private'}}],[tile(0),{headers:{Cookie:'private=true'}}],[tile(0),{credentials:'include'}]])assert.equal((await h.request(url,options)).handled,false);
 assert.equal(h.fetches,0,'unhandled/private requests never reach the geographic cache fetch');
 const response=new ResponseStub('tile',{headers:{'content-type':'application/x-protobuf','etag':'tile-v1'},tag:'network'});h.setNetwork(response);
 assert.equal((await h.request(tile(1))).value,response,'online response is returned unchanged');assert.equal(h.values.get(tile(1)).headers.get('etag'),'tile-v1');
 h.setNetwork(Error('Offline'));let result=await h.request(tile(1));assert.equal(result.value.headers.get('etag'),'tile-v1');assert.equal(result.value.headers.get('x-burbz-bytes'),'4');
 assert.equal((await h.request(tile(99))).value.type,'error','uncached offline area yields an honest error response');
 h.setNetwork(new ResponseStub('unavailable',{status:503}));assert.equal((await h.request(tile(1))).value.status,200,'visited tile survives provider HTTP failure');
 h.setOpenFailure(true);const unavailable=new ResponseStub('provider unavailable',{status:503});h.setNetwork(unavailable);assert.equal((await h.request(tile(1))).value,unavailable,'cache failure preserves the real network HTTP response');
 h.setNetwork(Error('Offline'));assert.equal((await h.request(tile(1))).value.type,'error','unavailable cache plus offline still resolves an error response');
 h.setOpenFailure(false);h.setPutFailure(true);const newer=new ResponseStub('newer',{tag:'newer'});h.setNetwork(newer);assert.equal((await h.request(tile(1))).value,newer,'quota failure does not fail the network response');
 h.setNetwork(Error('Offline'));assert.equal((await h.request(tile(1))).value.headers.get('etag'),'tile-v1','failed cache replacement retains prior offline bytes');h.setPutFailure(false);
 for(const rejected of [new ResponseStub({byteLength:h.api.MAX_ITEM+1}),new ResponseStub('short',{headers:{'content-length':String(h.api.MAX_ITEM+1)}}),new ResponseStub('partial',{status:206}),new ResponseStub('opaque',{type:'opaque'}),new ResponseStub('private',{headers:{'cache-control':'private, max-age=600'}}),new ResponseStub('nostore',{headers:{'cache-control':'no-store'}})]){h.setNetwork(rejected);assert.equal((await h.request(tile(3))).value,rejected);assert(!h.values.has(tile(3)));}
 const count=harness(),bootstrap=[meta('base'),'https://tiles.openfreemap.org/planet/20260910','https://tiles.openfreemap.org/styles/liberty/sprite.png','https://tiles.openfreemap.org/fonts/NotoSans/0-255.pbf'];
 for(const url of bootstrap){count.setNetwork(new ResponseStub('metadata',{headers:{'content-type':url.includes('/planet/')?'application/json':'application/octet-stream'}}));await count.request(url);}
 count.setNetwork(new ResponseStub('tile'));for(let i=0;i<count.api.MAX_ENTRIES+8;i++)await count.request(tile(i));
 for(const url of bootstrap)assert(count.values.has(url),'tile travel retains '+url);assert.equal([...count.values.keys()].filter(p=>p.includes('/15/')).length,count.api.MAX_ENTRIES);assert(!count.values.has(tile(0)));assert(count.values.has(tile(199)));
 const bytes=harness();bytes.setNetwork(new ResponseStub({byteLength:bytes.api.MAX_ITEM}));for(let i=0;i<17;i++)await bytes.request(tile(i));
 assert.equal(bytes.values.size,bytes.api.MAX_TILE_BYTES/bytes.api.MAX_ITEM);assert(!bytes.values.has(tile(0)));assert(bytes.values.has(tile(16)));
 for(let i=0;i<4;i++)await bytes.request(meta(i));assert.equal([...bytes.values.keys()].filter(p=>p.includes('/styles/')).length,2);
 assert([...bytes.values.values()].reduce((sum,v)=>sum+v.length,0)<=bytes.api.MAX_BYTES,'combined partitions respect total byte budget');
 const metadata=harness();for(let i=0;i<70;i++)await metadata.request(meta(i));assert.equal(metadata.values.size,metadata.api.MAX_METADATA_ENTRIES,'metadata is bounded independently too');
 const native=harness(Response);const actual=new Response('actual tile bytes',{headers:{'content-type':'application/x-protobuf','etag':'actual-v1'}});native.setNetwork(actual);assert.equal(await (await native.request(tile(0))).value.text(),'actual tile bytes');native.setNetwork(Error('Offline'));const offline=(await native.request(tile(0))).value;assert.equal(await offline.text(),'actual tile bytes');assert.equal(offline.headers.get('etag'),'actual-v1','real Response bytes and provider metadata survive cache reconstruction');
 console.log('Geographic cache: exact public host/GET/no-auth guard, network/offline/error/quota behavior, byte/count budgets, oversized rejection and separate bootstrap metadata retention pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
