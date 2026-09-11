const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.PHOTO_TEST_HTML || require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.includes('let photoIdBusy = false;')?html.indexOf('let photoIdBusy = false;'):html.indexOf('async function identifyImage(');
const fn=html.slice(start,html.indexOf('\nasync function startCamera()',start));
async function invoke(result,ok=true){
  const awards=[],bats=[],toasts=[],button={addEventListener(){},classList:{contains:()=>false,toggle(){}},scrollIntoView(){}};const context={$:()=>button,closeBirdCropper(){},AbortController,setTimeout,clearTimeout,FormData:class{append(){}},getCurrentPositionForPhotoId:async()=>null,
    fetch:async()=>({ok,json:async()=>result}),batLabelInIdentifyResult:r=>/bat/i.test(r.species||'')?'bat':'',looksLikeBatLabel:s=>/bat/i.test(s||''),
    triggerBatEasterEgg:(...a)=>bats.push(a),handleBirdCandidates:(...a)=>awards.push(a),showToast:t=>toasts.push(t),console};
  vm.createContext(context);vm.runInContext(fn,context);await context.identifyImage({});return {awards,bats,toasts,button};
}
test('inconclusive, legacy guesses, bad HTTP and invalid confidences never enter discovery or bat rewards',async()=>{
  const clear={found:true,accepted:true,verified:true,policy:'photo-evidence-v393',species:'European Robin',scientificName:'Erithacus rubecula',confidence:.98};
  const cases=[{found:false,message:'Bird not found. Try a closer, clearer photo.'},{found:true,species:'Kestrel',confidence:.5},{...clear,accepted:false},{...clear,confidence:.89},{...clear,confidence:Infinity},{...clear,policy:'old'},{found:false,species:'bat'}];
  for(const raw of cases){const r=await invoke(raw);assert.equal(r.awards.length,0);assert.equal(r.bats.length,0);assert.match(r.toasts[0],/^Bird not found/);assert.equal(r.button.disabled,false);}
  assert.equal((await invoke(clear,false)).awards.length,0);
  assert.equal((await invoke({...clear,verified:false})).awards.length,0);
  assert.equal((await invoke({...clear,policy:'photo-evidence-v350'})).awards.length,0);
  assert.equal((await invoke(clear)).awards.length,1);
});

function photoHarness(fetcher, position=async()=>null) {
  const elements=Object.fromEntries(['captureBtn','photoIdStatus','photoIdMessage','photoIdRetry','birdCropOverlay','birdCropTitle','birdCropHint','birdCropAnalysis','birdCropMessage','birdCropProgress','birdCropRetake','birdCropConfirm'].map(id=>[id,{hidden:true,classList:{contains:()=>false,toggle(){}},scrollIntoView(){},addEventListener(type,fn){this[type]=fn;}}]));
  const awards=[],timers=new Map();let serial=0;
  const ctx={$:id=>elements[id],closeBirdCropper(){},AbortController,FormData:class{append(){}},getCurrentPositionForPhotoId:position,
    fetch:fetcher,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),
    batLabelInIdentifyResult:()=>'',looksLikeBatLabel:()=>false,triggerBatEasterEgg(){},
    handleBirdCandidates:(...a)=>awards.push(a),showToast(){},console:{log(){}}};
  vm.createContext(ctx);vm.runInContext(fn,ctx);
  return {ctx,elements,awards,timers,expire:()=>[...timers.values()].forEach(fn=>fn())};
}
test('failure stays visible after the toast, and retry uses the same photo through the discovery gate',async()=>{
  let calls=0;const blob={id:'original-photo'};
  const h=photoHarness(async()=>({ok:++calls>1,json:async()=>calls===1?{found:false,message:'Photo identification is unavailable right now.'}:{found:true,accepted:true,verified:true,policy:'photo-evidence-v393',species:'European Robin',scientificName:'Erithacus rubecula',confidence:.98}}));
  await h.ctx.identifyImage(blob);
  assert.equal(h.elements.photoIdStatus.hidden,false);
  assert.match(h.elements.photoIdMessage.textContent,/unavailable/);
  assert.equal(h.elements.photoIdRetry.hidden,false);
  assert.equal(h.awards.length,0);
  await h.ctx.identifyImage(vm.runInContext('photoIdRetryBlob',h.ctx));
  assert.equal(h.awards.length,1);assert.equal(h.awards[0][2].blob,blob);
  assert.equal(h.elements.photoIdRetry.hidden,true);assert.equal(h.elements.captureBtn.disabled,false);
  assert.equal(h.timers.size,0);
});
for(const stage of ['location','upload','body'])test(`${stage} stalls time out and late results cannot award discoveries`,async()=>{
  let release;const never=new Promise(r=>release=r);
  const h=photoHarness(async()=>stage==='upload'?never:{ok:true,json:()=>stage==='body'?never:Promise.resolve({})},stage==='location'?()=>never:async()=>null);
  const pending=h.ctx.identifyImage({});
  for(let i=0;i<8;i++)await Promise.resolve();
  h.expire();await pending;
  assert.match(h.elements.photoIdMessage.textContent,/too long/);
  assert.equal(h.elements.photoIdRetry.hidden,false);assert.equal(h.elements.captureBtn.disabled,false);
  release({ok:true,json:async()=>({found:true,accepted:true,verified:true,policy:'photo-evidence-v393',species:'European Robin',confidence:.98})});
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.awards.length,0);assert.equal(h.timers.size,0);
});
test('network rejection clears busy state and duplicate taps make only one request',async()=>{
  let rejectRequest,calls=0;const h=photoHarness(()=>{calls++;return new Promise((_,reject)=>rejectRequest=reject);});
  const first=h.ctx.identifyImage({});await Promise.resolve();await Promise.resolve();
  await h.ctx.identifyImage({});assert.equal(calls,1);
  rejectRequest(new Error('offline'));await first;
  assert.match(h.elements.photoIdMessage.textContent,/connection/);assert.equal(h.elements.photoIdRetry.hidden,false);
  assert.equal(h.elements.captureBtn.disabled,false);assert.equal(h.awards.length,0);
});
test('analysis remains beside the full photo, has no invented percentage, and cancellation rejects late awards',async()=>{
  let release;const pendingReply=new Promise(r=>release=r);
  const h=photoHarness(()=>pendingReply);
  const pending=h.ctx.identifyImage({});
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.elements.birdCropAnalysis.hidden,false);
  assert.equal(h.elements.birdCropProgress.hidden,false);
  assert.match(h.elements.birdCropMessage.textContent,/checking/);
  assert.equal(h.elements.birdCropProgress.value,undefined);
  vm.runInContext('photoIdCancel()',h.ctx);await pending;
  assert.equal(h.elements.birdCropProgress.hidden,true);
  assert.match(h.elements.birdCropMessage.textContent,/cancelled/);
  release({ok:true,json:async()=>({accepted:true,verified:true,found:true,species:'Raven',confidence:.99,policy:'photo-evidence-v393'})});
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.awards.length,0);assert.equal(h.timers.size,0);
});
test('framing can pass 8x, preserves its anchor and never crops outside original pixels',()=>{
  const cropStart=html.indexOf('const birdCrop =');
  const cropFn=html.slice(cropStart,html.indexOf('\nfunction initBirdCropperControls()',cropStart));
  const elements={birdCropStage:{getBoundingClientRect:()=>({width:300})},birdCropImg:{style:{}},birdCropZoom:{}};
  const ctx={$:id=>elements[id],photoIdBusy:false};vm.createContext(ctx);vm.runInContext(cropFn,ctx);
  vm.runInContext('Object.assign(birdCrop,{source:{},W:6000,H:4000,size0:4000,size:4000,cx:3000,cy:2000,zmax:4000/48});setBirdCropZoom(20)',ctx);
  assert.equal(vm.runInContext('birdCrop.size',ctx),200);
  assert.equal(elements.birdCropZoom.value,'20');
  vm.runInContext('setBirdCropZoom(30,200,150)',ctx);
  assert(Math.abs(vm.runInContext('birdCrop.cx+(200-150)/(300/birdCrop.size)',ctx)-(3000+50/(300/200)))<.001);
  vm.runInContext('setBirdCropZoom(100000);birdCrop.cx=-500;birdCrop.cy=99999;clampBirdCrop()',ctx);
  assert.equal(vm.runInContext('birdCrop.size',ctx),48);
  assert.equal(vm.runInContext('birdCrop.cx',ctx),24);
  assert.equal(vm.runInContext('birdCrop.cy',ctx),3976);
});
