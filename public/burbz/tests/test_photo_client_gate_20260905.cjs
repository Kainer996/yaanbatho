const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.PHOTO_TEST_HTML || require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.includes('let photoIdBusy = false;')?html.indexOf('let photoIdBusy = false;'):html.indexOf('async function identifyImage(');
const fn=html.slice(start,html.indexOf('\nasync function startCamera()',start));
const TEST_OWNER='photo_profile_test_12345',TEST_STATE=JSON.stringify({photoProfileId:TEST_OWNER});
const testIdentity={gameState:{photoProfileId:TEST_OWNER},photoSaveBaseline:TEST_STATE,localStorage:{getItem:()=>TEST_STATE},crypto:{randomUUID:()=>TEST_OWNER+'-request-id'}};
const accepted=(species='European Robin',scientificName='Erithacus rubecula',confidence=.98)=>({found:true,accepted:true,verified:true,policy:'photo-gemini-v425',model:'gemini-vision',modelName:'gemini-3.8-flash',receiptId:'a'.repeat(64),species,scientificName,confidence});
async function invoke(result,ok=true){
  const awards=[],bats=[],toasts=[],button={addEventListener(){},classList:{contains:()=>false,toggle(){}},scrollIntoView(){}};const context={...testIdentity,$:()=>button,closeBirdCropper(){},AbortController,setTimeout,clearTimeout,FormData:class{append(){}},getCurrentPositionForPhotoId:async()=>null,
    fetch:async()=>({ok,json:async()=>result}),batLabelInIdentifyResult:r=>/bat/i.test(r.species||'')?'bat':'',looksLikeBatLabel:s=>/bat/i.test(s||''),
    triggerBatEasterEgg:(...a)=>bats.push(a),handleBirdCandidates:(...a)=>awards.push(a),showToast:t=>toasts.push(t),console};
  vm.createContext(context);vm.runInContext(fn,context);await context.identifyImage({});return {awards,bats,toasts,button};
}
test('inconclusive, legacy guesses, bad HTTP and invalid confidences never enter discovery or bat rewards',async()=>{
  const clear=accepted();
  const cases=[{found:false,message:'Bird not found. Try a closer, clearer photo.'},{found:true,species:'Kestrel',confidence:.5},{...clear,accepted:false},{...clear,confidence:.79},{...clear,confidence:Infinity},{...clear,policy:'old'},{found:false,species:'bat'}];
  for(const raw of cases){const r=await invoke(raw);assert.equal(r.awards.length,0);assert.equal(r.bats.length,0);assert.match(r.toasts[0],/Bird not found|Photo checking/);assert.equal(r.button.disabled,false);}
  assert.equal((await invoke(clear,false)).awards.length,0);
  assert.equal((await invoke({...clear,verified:false})).awards.length,0);
  assert.equal((await invoke({...clear,policy:'photo-evidence-v350'})).awards.length,0);
  assert.equal((await invoke(clear)).awards.length,1);
});

function photoHarness(fetcher, position=async()=>null) {
  const elements=Object.fromEntries(['captureBtn','photoIdStatus','photoIdMessage','photoIdRetry','birdCropOverlay','birdCropTitle','birdCropHint','birdCropAnalysis','birdCropMessage','birdCropProgress','birdCropRetake','birdCropConfirm','birdCropFullPhoto','birdCropZoom'].map(id=>[id,{hidden:true,classList:{contains:()=>false,toggle(){}},scrollIntoView(){},addEventListener(type,fn){this[type]=fn;}}]));
  const awards=[],timers=new Map();let serial=0;
  const ctx={...testIdentity,$:id=>elements[id],closeBirdCropper(){},AbortController,FormData:class{append(){}},getCurrentPositionForPhotoId:position,
    fetch:fetcher,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),
    batLabelInIdentifyResult:()=>'',looksLikeBatLabel:()=>false,triggerBatEasterEgg(){},
    handleBirdCandidates:(...a)=>awards.push(a),showToast(){},console:{log(){}}};
  vm.createContext(ctx);vm.runInContext(fn,ctx);
  return {ctx,elements,awards,timers,expire:()=>[...timers.values()].forEach(fn=>fn())};
}
test('failure stays visible after the toast, and retry uses the same photo through the discovery gate',async()=>{
  let calls=0;const blob={id:'original-photo'};
  const h=photoHarness(async()=>({ok:++calls>1,json:async()=>calls===1?{found:false,message:'Photo identification is unavailable right now.'}:accepted()}));
  await h.ctx.identifyImage(blob);
  assert.equal(h.elements.photoIdStatus.hidden,false);
  assert.match(h.elements.photoIdMessage.textContent,/unavailable/);
  assert.equal(h.elements.photoIdRetry.hidden,false);
  assert.equal(h.awards.length,0);
  await h.ctx.identifyImage(vm.runInContext('photoIdRetryBlob',h.ctx));
  assert.equal(h.awards.length,1);assert.equal(h.awards[0][2].blob,undefined);
  assert.equal(h.elements.photoIdRetry.hidden,true);assert.equal(h.elements.captureBtn.disabled,false);
  assert.equal(h.timers.size,0);
});
for(const stage of ['upload','body'])test(`${stage} stalls time out and late results cannot award discoveries`,async()=>{
  let release;const never=new Promise(r=>release=r);
  const h=photoHarness(async()=>stage==='upload'?never:{ok:true,json:()=>stage==='body'?never:Promise.resolve({})});
  const pending=h.ctx.identifyImage({});
  for(let i=0;i<8;i++)await Promise.resolve();
  h.expire();await pending;
  assert.match(h.elements.photoIdMessage.textContent,/too long/);
  assert.equal(h.elements.photoIdRetry.hidden,false);assert.equal(h.elements.captureBtn.disabled,false);
  release({ok:true,json:async()=>accepted()});
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.awards.length,0);assert.equal(h.timers.size,0);
});
test('network rejection clears busy state and duplicate taps make only one request',async()=>{
  let rejectRequest,calls=0;const h=photoHarness(()=>{calls++;return new Promise((_,reject)=>rejectRequest=reject);});
  const first=h.ctx.identifyImage({});await Promise.resolve();await Promise.resolve();
  await h.ctx.identifyImage({});assert.equal(calls,1);
  rejectRequest(new Error('offline'));await first;
  assert.match(h.elements.photoIdMessage.textContent,/connect/i);assert.equal(h.elements.photoIdRetry.hidden,false);
  assert.equal(h.elements.captureBtn.disabled,false);assert.equal(h.awards.length,0);
});
test('analysis remains beside the full photo, has no invented percentage, and cancellation rejects late awards',async()=>{
  let release;const pendingReply=new Promise(r=>release=r);
  const h=photoHarness(()=>pendingReply);
  const pending=h.ctx.identifyImage({});
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.elements.birdCropAnalysis.hidden,false);
  assert.equal(h.elements.birdCropProgress.hidden,false);
  assert.match(h.elements.birdCropMessage.textContent,/checking/i);
  assert.equal(h.elements.birdCropProgress.value,undefined);
  vm.runInContext('photoIdCancel()',h.ctx);await pending;
  assert.equal(h.elements.birdCropProgress.hidden,true);
  assert.match(h.elements.birdCropMessage.textContent,/cancelled/);
  release({ok:true,json:async()=>accepted('Raven','Corvus corax',.99)});
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

// The canvas double samples the supplied source pixels through the actual
// drawImage rectangle. This catches lost edge pixels and preview substitution;
// real browser JPEG/model evidence is kept separate from these contract tests.
function cropUploadHarness({width=720,height=240,delayEncoding=false,fetcher}={}) {
  const ids=['captureBtn','photoIdStatus','photoIdMessage','photoIdRetry','birdCropOverlay',
    'birdCropTitle','birdCropHint','birdCropAnalysis','birdCropMessage','birdCropProgress',
    'birdCropRetake','birdCropConfirm','birdCropFullPhoto','birdCropZoom','birdCropClose','birdCropStage','birdCropImg'];
  const elements=Object.fromEntries(ids.map(id=>{
    const classes=new Set();
    return [id,{dataset:{},style:{},disabled:false,hidden:false,textContent:'',
      classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),
        contains:n=>classes.has(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},
      getBoundingClientRect:()=>({width:300,left:0,top:0}),scrollIntoView(){},
      addEventListener(type,listener){this[type]=listener;}}];
  }));
  const encodings=[],uploads=[],awards=[],previews=[],canvases=[];
  const source={width,height,closed:false,close(){this.closed=true;},
    pixel(x,y){return [x < width/3 ? 255 : 0,x >= width/3 && x < width*2/3 ? 255 : 0,x >= width*2/3 ? 255 : 0,Math.floor(y)];}};
  function canvas() {
    const out={width:0,height:0,draw:null,getContext(){return {drawImage(...args){out.draw=args;}};},
      toBlob(done){
        const [src,x,y,w,h]=out.draw;
        const blob={width:out.width,height:out.height,source:src,
          pixel:(px,py)=>src.pixel(x+(px+.5)*w/out.width,y+(py+.5)*h/out.height)};
        if(delayEncoding) encodings.push(()=>done(blob)); else done(blob);
      }};
    canvases.push(out);return out;
  }
  const ctx={...testIdentity,$:id=>elements[id],document:{createElement:()=>canvas()},CAPTURE_MAX_SIDE:3072,
    updateNativePreviewFromCanvas:c=>previews.push(c),showNativePhotoPreview:b=>previews.push(b),
    URL:{revokeObjectURL(){}},window:{addEventListener(){}},SFX:{tap(){}},openNativeCamera(){},
    AbortController,setTimeout,clearTimeout,FormData:class{constructor(){this.values=[];}append(...args){this.values.push(args);}},
    getCurrentPositionForPhotoId:async()=>null,fetch:async(url,options)=>{
      uploads.push(options.body.values.find(row=>row[0]==='image')[1]);
      return fetcher?fetcher(url,options):{ok:true,json:async()=>accepted('European herring gull','Larus argentatus',.99)};
    },batLabelInIdentifyResult:()=>'',looksLikeBatLabel:()=>false,triggerBatEasterEgg(){},
    handleBirdCandidates:(...args)=>awards.push(args),showToast(){},console:{log(){}}};
  vm.createContext(ctx);
  const start=html.indexOf('const birdCrop =');
  const cropCode=html.slice(start,html.indexOf('\nfunction updateNativePreviewFromCanvas(',start));
  const normalizerStart=html.indexOf('async function normalizeCapturedPhoto(');
  const normalizer=html.slice(normalizerStart,html.indexOf('\nasync function captureCameraFrame(',normalizerStart));
  vm.runInContext(cropCode+'\n'+normalizer+'\n'+fn,ctx);
  ctx.fixtureSource=source;
  vm.runInContext(`Object.assign(birdCrop,{source:fixtureSource,W:${width},H:${height},size0:${Math.min(width,height)},size:${Math.min(width,height)},cx:${width/2},cy:${height/2},zmax:100});initBirdCropperControls()`,ctx);
  elements.birdCropOverlay.classList.add('show');
  return {ctx,elements,source,encodings,uploads,awards,previews,canvases};
}

test('Use full photo sends every original edge and aspect ratio through the same saved-discovery gate',async()=>{
  const h=cropUploadHarness();
  await h.ctx.confirmBirdCrop(true);
  assert.equal(h.uploads.length,1);const blob=h.uploads[0];
  assert.deepEqual([blob.width,blob.height],[720,240]);
  assert.equal(blob.source,h.source);
  assert.deepEqual(blob.pixel(0,0),[255,0,0,0]);
  assert.deepEqual(blob.pixel(719,239),[0,0,255,239]);
  assert.equal(h.awards.length,1);assert.equal(h.awards[0][2].blob,undefined);
  assert.equal(h.previews[0],blob);assert.equal(h.source.closed,true);
});

test('Identify still sends the selected square while full-photo resize never crops or enlarges source pixels',async()=>{
  const cropped=cropUploadHarness();await cropped.ctx.confirmBirdCrop();
  const blob=cropped.uploads[0];assert.deepEqual([blob.width,blob.height],[240,240]);
  assert.deepEqual(blob.pixel(0,0),[0,255,0,0]);
  assert.deepEqual(blob.pixel(239,239),[0,255,0,239]);
  for(const [width,height,expected] of [[6000,4000,[3072,2048]],[4000,6000,[2048,3072]],[300,900,[300,900]]]){
    const full=cropUploadHarness({width,height});await full.ctx.confirmBirdCrop(true);
    assert.deepEqual([full.uploads[0].width,full.uploads[0].height],expected);
    assert.deepEqual(full.canvases[0].draw.slice(1,5),[0,0,width,height]);
    assert.equal(full.uploads[0].source,full.source);
  }
});

test('both identification actions, retake and crop gestures lock during encoding; closing drops the old result',async()=>{
  const h=cropUploadHarness({delayEncoding:true});
  const pending=h.ctx.confirmBirdCrop(true);
  for(const id of ['birdCropConfirm','birdCropFullPhoto','birdCropRetake','birdCropZoom'])assert.equal(h.elements[id].disabled,true,id);
  assert.equal(h.elements.birdCropOverlay.classList.contains('full-photo'),true);
  assert.equal(h.elements.birdCropImg.style.transform,'translate(0px,100px) scale(0.4166666666666667)');
  await h.ctx.confirmBirdCrop();await h.ctx.confirmBirdCrop(true);
  assert.equal(h.encodings.length,1);
  h.ctx.setBirdCropZoom(10);assert.equal(vm.runInContext('birdCrop.size',h.ctx),240);
  h.elements.birdCropClose.click();
  assert.equal(h.source.closed,true);
  h.encodings.shift()();await pending;
  assert.equal(h.uploads.length,0);assert.equal(h.awards.length,0);assert.equal(h.previews.length,0);
});

test('an old full-photo encoding cannot unlock a replacement photo or upload after cancellation',async()=>{
  const h=cropUploadHarness({delayEncoding:true});const old=h.ctx.confirmBirdCrop(true);
  h.elements.birdCropClose.click();
  const replacement={...h.source,closed:false};h.ctx.replacement=replacement;
  vm.runInContext('birdCrop.source=replacement',h.ctx);h.ctx.setBirdPhotoStage('frame');
  const next=h.ctx.confirmBirdCrop(true);
  h.encodings.shift()();await old;
  assert.equal(h.elements.birdCropFullPhoto.disabled,true);assert.equal(h.elements.birdCropConfirm.disabled,true);
  assert.equal(h.uploads.length,0);
  h.encodings.shift()();await next;
  assert.equal(h.uploads.length,1);assert.equal(h.uploads[0].source,replacement);assert.equal(h.awards.length,1);
});

test('full-photo cancellation during real identifyImage flow blocks a late accepted response',async()=>{
  let release;const reply=new Promise(resolve=>release=resolve);
  const h=cropUploadHarness({fetcher:()=>reply});
  const pending=h.ctx.confirmBirdCrop(true);
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.uploads.length,1);assert.equal(h.elements.birdCropFullPhoto.disabled,true);
  h.elements.birdCropClose.click();await pending;
  release({ok:true,json:async()=>accepted('European herring gull','Larus argentatus',.99)});
  for(let i=0;i<8;i++)await Promise.resolve();
  assert.equal(h.awards.length,0);assert.equal(h.elements.captureBtn.disabled,false);
});

test('receipt-backed tentative species remain visible without awarding a discovery',async()=>{
  const result={...accepted('Grey Wagtail','Motacilla cinerea',.85),found:false,accepted:false,verified:false,retryable:false,reason:'verification-disagrees',suggestions:[{species:'Grey Wagtail',scientificName:'Motacilla cinerea'}]};
  const h=photoHarness(async()=>({ok:false,json:async()=>result}));await h.ctx.identifyImage({});
  assert.match(h.elements.photoIdMessage.textContent,/Possible bird: Grey Wagtail.*Not confirmed or added to Birdex/);
  assert.equal(h.awards.length,0);
  for(const change of [{receiptId:''},{policy:'photo-gemini-v410'},{retryable:true}])assert(!h.ctx.photoResultMessage({...result,...change}).includes('Possible bird'));
  assert.equal((await invoke(accepted('Grey Wagtail','Motacilla cinerea',.85))).awards.length,1);
  assert.equal((await invoke(accepted('Grey Wagtail','Motacilla cinerea',.79))).awards.length,0);
});


test('full-photo recognition preserves bounded original file bytes and clears them on close',async()=>{
  const h=cropUploadHarness();const original={size:2048,type:'image/jpeg',originalPixels:true};
  vm.runInContext('birdCrop.originalFile = null',h.ctx);h.ctx.original=original;vm.runInContext('birdCrop.originalFile = original',h.ctx);
  await h.ctx.confirmBirdCrop(true);assert.equal(h.uploads[0],original);assert.equal(vm.runInContext('birdCrop.originalFile',h.ctx),null);
});
