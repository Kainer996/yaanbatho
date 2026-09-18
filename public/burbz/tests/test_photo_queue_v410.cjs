/* Real Chromium + IndexedDB + HTTP, with a deterministic provider stand-in.
 * node public/burbz/tests/test_photo_queue_v410.cjs
 * Full app/reward integration is covered separately: this callback models only
 * an atomic receipt commit. No requests leave localhost and no paid calls run.
 */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium}=require(process.env.PLAYWRIGHT_PATH || '/home/yaan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const base=path.resolve(__dirname,'..');
const accepted={found:true,accepted:true,verified:true,policy:'photo-gemini-v425',model:'gemini-vision',modelName:'gemini-3.8-flash',receiptId:'a'.repeat(64),confidence:.99,species:'European Robin',scientificName:'Erithacus rubecula'};
let mode='success',calls=[],paid=new Set(),release=[];
const html=`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/photo_queue.css"><button id="game">Keep playing</button><button id="saved">Saved photos</button><script src="/photo_queue.js"></script><script>
window.scope='profile-a';window.messages=[];window.claims=0;window.clicks=0;window.savedBeforeFetch=[];
const nativeFetch=window.fetch;window.fetch=async function(...args){if(String(args[0]).includes('identify/image')){const rows=await BurbzPhotoQueue.storage.list(scope);savedBeforeFetch.push(rows.some(r=>r.blob.size>0&&r.status==='checking'));}return nativeFetch(...args);};
window.queue=BurbzPhotoQueue.create({owner:()=>scope,message:x=>messages.push(x),count:count=>{window.savedCount=count;if(window.switchOnCount){window.switchOnCount=false;scope='profile-b';}},claim:async(item,ctx)=>{if(!ctx.isCurrent())return false;const receipts=JSON.parse(localStorage.getItem('receipts')||'[]');if(!receipts.includes(item.result.receiptId)){receipts.push(item.result.receiptId);localStorage.setItem('receipts',JSON.stringify(receipts));claims++;}return true;},preview:()=>{},autoClaim:()=>false});
document.querySelector('#game').onclick=()=>clicks++;document.querySelector('#saved').onclick=()=>queue.show();
window.addPhoto=async(text='bird')=>queue.enqueue(new Blob([text],{type:'image/jpeg'}));
window.boot=navigator.serviceWorker.register('/sw.js').then(()=>navigator.serviceWorker.ready);
</script>`;
const server=http.createServer(async(req,res)=>{
 const u=new URL(req.url,'http://localhost');
 if(u.pathname.endsWith('/api/identify/image')){
  let raw='';for await(const chunk of req)raw+=chunk.toString();
  const field=name=>raw.match(new RegExp('name="'+name+'"\\r\\n\\r\\n([^\\r]+)'))?.[1];
  const requestId=field('photoRequestId');calls.push({requestId,owner:field('photoOwner')});
  if(mode==='hold')await new Promise(resolve=>release.push(resolve));
  if(mode==='budget' || mode==='month'){res.writeHead(503,{'Content-Type':'application/json'});return res.end(JSON.stringify({reason:mode==='month'?'month-changed':'photo-budget-exhausted',message:'Shared monthly photo allowance used. Your photo stays saved.',retryAt:Math.floor(Date.now()/1000)+3600}));}
  if(mode==='interrupt' && !paid.has(requestId)){paid.add(requestId);return req.socket.destroy();}
  paid.add(requestId);res.writeHead(200,{'Content-Type':'application/json'});
  const result={...accepted};if(mode==='invalid')delete result.receiptId;
  return res.end(JSON.stringify(result));
 }
 if(u.pathname==='/sw.js'){res.writeHead(200,{'Content-Type':'application/javascript','Cache-Control':'no-store'});return res.end(`self.addEventListener('install',event=>event.waitUntil(caches.open('queue-proof').then(cache=>cache.addAll(['/','/photo_queue.js','/photo_queue.css'])).then(()=>self.skipWaiting())));self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));self.addEventListener('fetch',event=>{if(event.request.method==='GET')event.respondWith(caches.match(event.request).then(value=>value||fetch(event.request)));});`);}
 if(['/photo_queue.js','/photo_queue.css'].includes(u.pathname)){res.writeHead(200,{'Content-Type':u.pathname.endsWith('.js')?'application/javascript':'text/css'});return res.end(fs.readFileSync(path.join(base,u.pathname.slice(1))));}
 res.writeHead(200,{'Content-Type':'text/html'});res.end(html);
});
const wait=async fn=>{for(let i=0;i<1000;i++){if(await fn())return;await new Promise(r=>setTimeout(r,30));}throw Error('Condition did not become true');};
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const url=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-gpu']});
 let context;
 async function fresh(next='success',viewport={width:390,height:844}){if(context)await context.close();mode=next;calls=[];paid=new Set();release=[];context=await browser.newContext({viewport});const page=await context.newPage();await page.goto(url);await page.evaluate(()=>boot);await page.waitForFunction(()=>!!navigator.serviceWorker.controller);return page;}
 try{
  let page;
  if(!process.env.QUEUE_TEST_FROM_INTERRUPT){
  page=await fresh();await context.setOffline(true);const item=await page.evaluate(()=>addPhoto());
  assert.equal(calls.length,0);assert.equal(await page.evaluate(()=>savedCount),1);
  await page.click('#game');assert.equal(await page.evaluate(()=>clicks),1);
  await page.reload();await page.waitForFunction(()=>!!window.queue);assert.equal(await page.evaluate(async()=>{const rows=await queue.list();return await rows[0].blob.text();}),'bird');
  await page.click('#saved');await page.waitForSelector('dialog[open]');
  assert.match(await page.locator('dialog').innerText(),/saved on this device/i);
  for(let i=0;i<10;i++){await page.keyboard.press('Tab');assert.ok(await page.evaluate(()=>!!document.activeElement.closest('dialog')));}
  await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.activeElement.id),'saved');
  await page.click('#game');assert.equal(await page.evaluate(()=>clicks),1);
  await context.setOffline(false);await page.evaluate(()=>queue.process());await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.status==='ready')).catch(async error=>{console.log('DIAGNOSTIC',await page.evaluate(async()=>({online:navigator.onLine,rows:(await queue.list()).map(r=>({...r,blob:undefined})),scope,messages,savedBeforeFetch})),calls);throw error;});
  assert.equal(calls.length,1);assert.equal(await page.evaluate(()=>claims),0);assert.ok((await page.evaluate(()=>savedBeforeFetch)).every(Boolean));
  await page.evaluate(async()=>{const item=(await queue.list())[0];await Promise.all([queue.claim(item),queue.claim(item)]);});
  assert.equal(await page.evaluate(()=>claims),1);assert.equal(await page.evaluate(async()=> (await queue.list()).length),0);
  console.log('PASS offline save, reload, game continuation, reconnect, deliberate single receipt claim, keyboard dialog');

  page=await fresh('hold');await context.setOffline(true);const duplicate=await page.evaluate(async()=>{const a=await addPhoto();const b=await addPhoto();return [a.id,b.id];});assert.equal(duplicate[0],duplicate[1]);
  const tab=await context.newPage();await tab.goto(url);await tab.evaluate(()=>boot);await context.setOffline(false);
  await Promise.all([page.evaluate(()=>queue.process()),tab.evaluate(()=>queue.process())].map(p=>{p.catch(()=>{});return Promise.resolve();}));
  await wait(()=>calls.length===1);await tab.evaluate(async()=>queue.retry((await queue.list())[0].id));assert.equal(calls.length,1);
  await tab.evaluate(async()=>queue.pause((await queue.list())[0].id));await wait(async()=>await page.evaluate(async()=> (await queue.list())[0].manual));
  await tab.evaluate(async()=>queue.remove((await queue.list())[0].id));release.splice(0).forEach(r=>r());await new Promise(r=>setTimeout(r,100));
  assert.equal(await page.evaluate(async()=> (await queue.list()).length),0);assert.equal(calls.length,1);
  console.log('PASS duplicate input, cross-tab lease/retry, remote pause/removal, late response does not recreate photo');

  page=await fresh();await context.setOffline(true);
  const pair=await page.evaluate(async result=>{
    queue.dispose();Object.defineProperty(navigator,'locks',{value:undefined,configurable:true});
    const first=await BurbzPhotoQueue.storage.add(scope,new Blob(['crop-one'],{type:'image/jpeg'}));
    const second=await BurbzPhotoQueue.storage.add(scope,new Blob(['crop-two'],{type:'image/jpeg'}));
    for(const item of [first,second])await BurbzPhotoQueue.storage.update(scope,item.id,row=>({...row,result,status:'ready'}));
    window.startedClaims=0;
    window.queue=BurbzPhotoQueue.create({owner:()=>scope,claim:async(item,ctx)=>{startedClaims++;await new Promise(resolve=>window.finishClaim=resolve);if(!ctx.isCurrent())return false;localStorage.setItem('receipts',JSON.stringify([item.result.receiptId]));return true;}});
    return [first.id,second.id];
  },accepted);
  const claimant=await context.newPage();await claimant.goto(url);await claimant.evaluate(()=>boot);await claimant.evaluate(()=>Object.defineProperty(navigator,'locks',{value:undefined,configurable:true}));
  const pendingClaim=page.evaluate(async id=>queue.claim((await queue.list()).find(row=>row.id===id)),pair[0]);
  await wait(()=>page.evaluate(()=>startedClaims===1));
  assert.equal(await claimant.evaluate(async id=>queue.claim((await queue.list()).find(row=>row.id===id)),pair[1]),false);
  assert.equal(await claimant.evaluate(()=>claims),0);
  await page.evaluate(()=>finishClaim());await pendingClaim;
  assert.equal(await claimant.evaluate(async id=>queue.claim((await queue.list()).find(row=>row.id===id)),pair[1]),true);
  assert.equal(await claimant.evaluate(()=>claims),0);
  assert.equal(await claimant.evaluate(async()=> (await queue.list()).length),0);
  console.log('PASS owner-wide IndexedDB claim lease serializes distinct photos with one shared receipt, without Web Locks');


  }
  page=await fresh('interrupt');await page.evaluate(()=>addPhoto());await wait(()=>page.evaluate(async()=> {const row=(await queue.list())[0];return row?.networkWait===true || row?.status==='ready';})).catch(async error=>{console.log('INTERRUPT DIAGNOSTIC',calls,await page.evaluate(async()=>({rows:(await queue.list()).map(row=>({...row,blob:undefined})),messages,online:navigator.onLine,savedBeforeFetch})));throw error;});
  const requestBefore=await page.evaluate(async()=> (await queue.list())[0].requestId);
  await page.evaluate(async()=>{const row=(await queue.list())[0];if(row.status!=='ready')await queue.retry(row.id);});await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.status==='ready'));
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.requestId===requestBefore));assert.equal(paid.size,1);
  console.log('PASS interrupted response recovers same request ID and one provider execution');

  page=await fresh('hold');await page.evaluate(()=>addPhoto());await wait(()=>calls.length===1);
  const beforeReload=await page.evaluate(async()=> (await queue.list())[0].requestId);
  await page.reload();await page.waitForFunction(()=>!!window.queue);await page.evaluate(()=>queue.process());
  assert.equal(calls.length,1);assert.equal(await page.evaluate(async()=> (await queue.list())[0].requestId),beforeReload);
  release.splice(0).forEach(r=>r());mode='success';
  // Advance only the persisted lease deadline to simulate the documented 70 s
  // crash timeout; do not alter the request identity or result under test.
  await page.evaluate(async()=>{const row=(await queue.list())[0];await BurbzPhotoQueue.storage.update(scope,row.id,item=>({...item,leaseUntil:Date.now()-1}));await queue.process();});
  await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.status==='ready'));
  assert.equal(calls.length,2);assert.ok(calls.every(c=>c.requestId===beforeReload));assert.equal(paid.size,1);
  console.log('PASS reload during upload preserves lease and recovers expired lease with the original request ID');


  page=await fresh('budget');await page.evaluate(()=>addPhoto());await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.retryAt>Date.now()));
  const budgetId=await page.evaluate(async()=> (await queue.list())[0].requestId);await page.evaluate(async()=>{await queue.retry((await queue.list())[0].id);await queue.process();});assert.equal(calls.length,1);
  assert.equal(await page.evaluate(async()=> (await queue.list())[0].requestId),budgetId);await page.click('#saved');assert.equal(await page.getByRole('button',{name:'Check now'}).isDisabled(),true);await page.keyboard.press('Escape');await page.click('#game');assert.equal(await page.evaluate(()=>clicks),1);
  console.log('PASS budget wait preserves photo/request and does not block other gameplay');

  page=await fresh('month');await page.evaluate(()=>addPhoto());await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.retryAt>Date.now()));
  const monthRequest=await page.evaluate(async()=> (await queue.list())[0].requestId);assert.equal(await page.evaluate(async()=> (await queue.list())[0].manual),false);
  mode='success';await page.evaluate(async()=>{const row=(await queue.list())[0];await BurbzPhotoQueue.storage.update(scope,row.id,item=>({...item,retryAt:Date.now()-1}));return queue.process();});
  await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.status==='ready'));assert.equal(calls.length,2);assert.ok(calls.every(c=>c.requestId===monthRequest));
  console.log('PASS unfinalized month-boundary wait resumes the same request automatically after its retry time');


  page=await fresh();await context.setOffline(true);await page.evaluate(()=>addPhoto());await page.evaluate(()=>{switchOnCount=true;});await context.setOffline(false);await page.evaluate(()=>queue.process());await new Promise(r=>setTimeout(r,100));
  assert.equal(calls.length,0);assert.equal(await page.evaluate(()=>scope),'profile-b');assert.equal(await page.evaluate(async()=> (await queue.list()).length),0);assert.equal(await page.evaluate(async()=> (await BurbzPhotoQueue.storage.list('profile-a')).length),1);
  await page.evaluate(()=>{scope='profile-a';return queue.process();});await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.status==='ready'));assert.equal(calls.length,1);
  console.log('PASS profile switch during pre-fetch render prevents egress and retains original owner photo');

  page=await fresh();const quota=await page.evaluate(async()=>{const native=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('full','QuotaExceededError');};try{await addPhoto();return 'unexpected success';}catch(e){return e.message;}finally{IDBObjectStore.prototype.put=native;}});
  assert.match(quota,/not saved or sent/);assert.equal(calls.length,0);assert.equal(await page.evaluate(async()=> (await queue.list()).length),0);assert.equal(await page.evaluate(()=>messages.some(x=>x.startsWith('Photo saved'))),false);
  console.log('PASS actual IndexedDB transaction quota abort causes no upload or false saved message');

  page=await fresh('invalid',{width:667,height:320});await page.evaluate(()=>addPhoto());await wait(()=>page.evaluate(async()=> (await queue.list())[0]?.manual===true));assert.equal(await page.evaluate(()=>claims),0);await page.click('#saved');
  assert.equal(await page.getByRole('button',{name:'View result'}).count(),0);
  assert.ok(await page.evaluate(()=>{const p=document.querySelector('dialog');return p.scrollWidth<=p.clientWidth && p.getBoundingClientRect().height<=innerHeight;}));
  console.log('PASS invalid/missing receipt cannot claim; short landscape panel fits viewport');
  console.log(process.env.QUEUE_TEST_FROM_INTERRUPT?'ALL 7 REMAINING REAL BROWSER QUEUE SCENARIOS PASSED':'ALL 10 REAL BROWSER QUEUE SCENARIOS PASSED');
 }finally{release.splice(0).forEach(r=>r());await context?.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(error=>{console.error(error);process.exitCode=1;server.close();});
