/* Visited map data, separate from the versioned offline application shell. */
(function(root){
  'use strict';
  const NAME='burbzgeo-openfreemap-mapterhorn-v1', MAX_ENTRIES=192, MAX_BYTES=64*1024*1024, MAX_ITEM=4*1024*1024;
  const MAX_METADATA_ENTRIES=64, MAX_METADATA_BYTES=8*1024*1024, MAX_TILE_BYTES=MAX_BYTES-MAX_METADATA_BYTES;
  const allowed=url=>url.protocol==='https:'&&['tiles.openfreemap.org','tiles.mapterhorn.com'].includes(url.hostname)&&!url.username&&!url.password&&(!url.port||url.port==='443');
  function metadata(request,response){const path=new URL(request.url).pathname;return /\/(?:styles|fonts|glyphs|sprites)\//.test(path)||/\.(?:json|png)(?:$|\?)/.test(path)||/json/i.test(response.headers.get('content-type')||'');}
  async function cached(request){try{return await (await caches.open(NAME)).match(request);}catch(error){return null;}}
  let queue=Promise.resolve();
  async function remember(request,response){
    if(!response.ok||response.status===206||response.type==='opaque'||/\b(?:private|no-store)\b/i.test(response.headers.get('cache-control')||''))return;
    const size=Number(response.headers.get('content-length'));
    if(size>MAX_ITEM)return;
    const bytes=await response.arrayBuffer();if(bytes.byteLength>MAX_ITEM)return;
    const headers=new Headers(response.headers);headers.set('x-burbz-bytes',String(bytes.byteLength));headers.set('x-burbz-cached-at',String(Date.now()));headers.set('x-burbz-kind',metadata(request,response)?'metadata':'tile');
    const stored=new Response(bytes,{status:response.status,statusText:response.statusText,headers});
    const next=queue.then(async()=>{
      const cache=await caches.open(NAME);
      // Cache.put replaces atomically. Deleting first would lose usable offline
      // data if the replacement hit the storage quota.
      await cache.put(request,stored);
      const rows=await Promise.all((await cache.keys()).map(async key=>{const value=await cache.match(key);return {key,bytes:Number(value?.headers.get('x-burbz-bytes'))||MAX_ITEM,at:Number(value?.headers.get('x-burbz-cached-at'))||0,kind:value&&(value.headers.get('x-burbz-kind')|| (metadata(key,value)?'metadata':'tile'))};}));
      // Tile travel must not evict the style, source manifests, glyphs and
      // sprites that make those visited tiles usable when the device is offline.
      for(const kind of ['metadata','tile']){
        const group=rows.filter(row=>row.kind===kind).sort((a,b)=>a.at-b.at);
        let total=group.reduce((sum,row)=>sum+row.bytes,0),count=group.length;
        const entryLimit=kind==='metadata'?MAX_METADATA_ENTRIES:MAX_ENTRIES,byteLimit=kind==='metadata'?MAX_METADATA_BYTES:MAX_TILE_BYTES;
        for(const row of group){if(count<=entryLimit&&total<=byteLimit)break;await cache.delete(row.key);total-=row.bytes;count--;}
      }
    });
    queue=next.catch(()=>{});await next;
  }
  function respond(event){
    const request=event.request;if(request.method!=='GET'||!allowed(new URL(request.url))||request.credentials==='include'||request.headers.has('authorization')||request.headers.has('proxy-authorization')||request.headers.has('cookie'))return false;
    let settle;const writes=new Promise(resolve=>{settle=resolve;});event.waitUntil(writes);
    event.respondWith((async()=>{
      try{
        const response=await fetch(request);
        if(response.ok){remember(request,response.clone()).catch(()=>{}).finally(settle);return response;}
        const fallback=await cached(request);settle();return fallback||response;
      }catch(error){
        try{return await cached(request)||Response.error();}finally{settle();}
      }
    })());return true;
  }
  root.BurbzGeographicCache={NAME,MAX_ENTRIES,MAX_BYTES,MAX_ITEM,MAX_METADATA_ENTRIES,MAX_METADATA_BYTES,MAX_TILE_BYTES,allowed,respond};
})(globalThis);
