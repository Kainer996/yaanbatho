const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(process.env.PHOTO_TEST_HTML || require('node:path').join(__dirname,'../index.html'),'utf8');
const start=html.includes('let photoIdBusy = false;')?html.indexOf('let photoIdBusy = false;'):html.indexOf('async function identifyImage(');
const fn=html.slice(start,html.indexOf('\nasync function startCamera()',start));
const TEST_OWNER='photo_profile_test_12345',TEST_STATE=JSON.stringify({photoProfileId:TEST_OWNER});
const testIdentity={gameState:{photoProfileId:TEST_OWNER},photoSaveBaseline:TEST_STATE,localStorage:{getItem:()=>TEST_STATE},crypto:{randomUUID:()=>TEST_OWNER+'-request-id'}};
// v486: a strong match and a pick-your-bird answer both carry ranked matches.
// Nothing reaches the Birdex until the player taps This is my bird.
const accepted=(species='European Robin',scientificName='Erithacus rubecula',confidence=.98)=>({found:true,accepted:true,verified:true,policy:'photo-gemini-v486',model:'gemini-vision',modelName:'gemini-3.8-flash',retryable:false,receiptId:'a'.repeat(64),species,scientificName,confidence,
  candidates:[{species,scientificName,score:confidence,local:'likely'},{species:'Common Redstart',scientificName:'Phoenicurus phoenicurus',score:.01}]});
const pickable=(candidates)=>({found:false,accepted:false,verified:false,policy:'photo-gemini-v486',model:'gemini-vision',modelName:'gemini-3.8-flash',retryable:false,receiptId:'b'.repeat(64),reason:'pick-your-bird',message:'Bird detected. Pick your bird from the matches.',candidates});
function element(){
  const classes=new Set();
  return {hidden:true,disabled:false,textContent:'',innerHTML:'',dataset:{},style:{},scrollIntoView(){},
    classList:{add:(...n)=>n.forEach(x=>classes.add(x)),remove:(...n)=>n.forEach(x=>classes.delete(x)),contains:n=>classes.has(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},
    querySelectorAll(){return (this.innerHTML.match(/data-photo-match=/g)||[]).map(()=>({disabled:false}));},
    addEventListener(type,fn){this[type]=fn;}};
}
async function invoke(result,ok=true){
  const awards=[],bats=[],toasts=[],elements={};const $=id=>(elements[id]=elements[id]||element());
  const context={...testIdentity,$,closeBirdCropper(){},AbortController,setTimeout,clearTimeout,FormData:class{append(){}},getCurrentPositionForPhotoId:async()=>null,
    fetch:async()=>({ok,json:async()=>result}),batLabelInIdentifyResult:r=>/bat/i.test(r.species||'')?'bat':'',looksLikeBatLabel:s=>/bat/i.test(s||''),
    triggerBatEasterEgg:(...a)=>bats.push(a),handleBirdCandidates:(...a)=>{awards.push(a);return [{species:a[0].species}];},showToast:t=>toasts.push(t),console};
  vm.createContext(context);vm.runInContext(fn,context);await context.identifyImage({});return {awards,bats,toasts,button:$('captureBtn'),elements,ctx:context};
}
test('inconclusive, legacy guesses, bad HTTP and malformed answers never offer a bird or a bat reward',async()=>{
  const clear=accepted();
  const cases=[{found:false,message:'Bird not found. Try a closer, clearer photo.'},{found:true,species:'Kestrel',confidence:.5},{...clear,accepted:false},{...clear,policy:'photo-gemini-v425'},
    {...clear,receiptId:''},{...clear,retryable:true},{...clear,candidates:[]},{...clear,candidates:[{species:'Robin',scientificName:'bad',score:.9}]},
    {...clear,candidates:[{species:'Robin',scientificName:'Erithacus rubecula',score:Infinity}]},{...clear,scientificName:'Turdus merula'},{found:false,species:'bat'}];
  for(const raw of cases){const r=await invoke(raw);assert.equal(r.awards.length,0);assert.equal(r.bats.length,0);
    assert.match(r.toasts[0],/Bird not found|Photo checking/);assert.equal(r.button.disabled,false);assert.equal(r.elements.birdCropMatches?.hidden??true,true);
    assert.equal(r.ctx.pickPhotoMatch(0),false);assert.equal(r.awards.length,0);}
});
test('a strong match waits for This is my bird, and one result gives one bird',async()=>{
  const r=await invoke(accepted('Common Raven','Corvus corax',.93));
  assert.equal(r.awards.length,0);assert.equal(r.toasts.length,0);
  assert.equal(r.elements.birdCropMatches.hidden,false);
  assert.match(r.elements.birdCropMatches.innerHTML,/Common Raven[\s\S]*Strong match[\s\S]*Likely here[\s\S]*This is my bird/);
  assert.equal(r.elements.birdCropTitle.textContent,'Best matches');
  assert.equal(r.ctx.pickPhotoMatch(0),true);
  assert.equal(JSON.stringify(r.awards[0].slice(0,2)),JSON.stringify([{species:'Common Raven',scientificName:'Corvus corax',confidence:.93},[]]));
  assert.equal(r.awards[0][2].source,'photo');assert.equal(r.awards[0][2].blob,undefined);
  assert.equal(r.ctx.pickPhotoMatch(1),false);assert.equal(r.awards.length,1);
  assert.match(r.toasts[0],/Identified: Common Raven/);
});

function photoHarness(fetcher, position=async()=>null) {
  const elements=Object.fromEntries(['captureBtn','photoIdStatus','photoIdMessage','photoIdRetry','birdCropOverlay','birdCropTitle','birdCropHint','birdCropAnalysis','birdCropMessage','birdCropProgress','birdCropRetake','birdCropConfirm','birdCropFullPhoto','birdCropZoom','birdCropMatches'].map(id=>[id,element()]));
  const awards=[],timers=new Map(),forms=[];let serial=0;
  const ctx={...testIdentity,$:id=>elements[id],closeBirdCropper(){},AbortController,FormData:class{constructor(){this.values=[];forms.push(this);}append(...a){this.values.push(a);}},getCurrentPositionForPhotoId:position,
    fetch:fetcher,setTimeout:fn=>{timers.set(++serial,fn);return serial;},clearTimeout:id=>timers.delete(id),
    batLabelInIdentifyResult:()=>'',looksLikeBatLabel:()=>false,triggerBatEasterEgg(){},
    handleBirdCandidates:(...a)=>{awards.push(a);return [{species:a[0].species}];},showToast(){},console:{log(){}}};
  vm.createContext(ctx);vm.runInContext(fn,ctx);
  return {ctx,elements,awards,timers,forms,expire:()=>[...timers.values()].forEach(fn=>fn())};
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
  assert.equal(h.awards.length,0);assert.equal(h.elements.birdCropMatches.hidden,false);
  assert.equal(h.ctx.pickPhotoMatch(0),true);
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
  assert.equal(h.awards.length,0);assert.equal(h.ctx.pickPhotoMatch(0),false);assert.equal(h.timers.size,0);
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
  assert.equal(h.awards.length,0);assert.equal(h.elements.birdCropMatches.hidden,true);assert.equal(h.timers.size,0);
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
    'birdCropRetake','birdCropConfirm','birdCropFullPhoto','birdCropZoom','birdCropClose','birdCropStage','birdCropImg','birdCropMatches'];
  const elements=Object.fromEntries(ids.map(id=>{
    const classes=new Set();
    return [id,{dataset:{},style:{},disabled:false,hidden:false,textContent:'',
      classList:{add:(...names)=>names.forEach(n=>classes.add(n)),remove:(...names)=>names.forEach(n=>classes.delete(n)),
        contains:n=>classes.has(n),toggle:(n,on)=>on?classes.add(n):classes.delete(n)},
      getBoundingClientRect:()=>({width:300,left:0,top:0}),scrollIntoView(){},innerHTML:'',
      querySelectorAll(){return [];},addEventListener(type,listener){this[type]=listener;}}];
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
    handleBirdCandidates:(...args)=>{awards.push(args);return [{species:args[0].species}];},showToast(){},console:{log(){}}};
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
  assert.equal(h.awards.length,0);assert.equal(h.ctx.pickPhotoMatch(0),true);
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
  assert.equal(h.uploads.length,1);assert.equal(h.uploads[0].source,replacement);assert.equal(h.ctx.pickPhotoMatch(0),true);assert.equal(h.awards.length,1);
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
  assert.equal(h.awards.length,0);assert.equal(h.ctx.pickPhotoMatch(0),false);assert.equal(h.elements.captureBtn.disabled,false);
});

test('a pick-your-bird answer lists local matches first and the player chooses one',async()=>{
  const result=pickable([{species:'Common Raven',scientificName:'Corvus corax',score:.62,local:'likely',plumage:'adult'},
    {species:'Anhinga',scientificName:'Anhinga anhinga',score:.03,local:'unexpected'},
    {species:'Grey Heron',scientificName:'Ardea cinerea',score:.2,local:'likely'}]);
  const h=photoHarness(async()=>({ok:false,json:async()=>result}));await h.ctx.identifyImage({});
  const cards=h.elements.birdCropMatches.innerHTML;
  assert.match(cards,/Common Raven[\s\S]*Good match[\s\S]*Likely here[\s\S]*Adult/);
  assert.match(cards,/Anhinga[\s\S]*Possible match[\s\S]*Not expected here/);
  assert.equal((cards.match(/This is my bird<\/button>/g)||[]).length,3);
  assert.match(h.elements.birdCropMessage.textContent,/Tap This is my bird/);
  assert.equal(h.awards.length,0);
  assert.equal(h.ctx.pickPhotoMatch(2),true);
  assert.equal(h.awards[0][0].scientificName,'Ardea cinerea');assert.equal(h.ctx.pickPhotoMatch(0),false);
  for(const change of [{receiptId:''},{policy:'photo-gemini-v425'},{retryable:true},{reason:'no-bird'}])
    assert.equal(h.ctx.photoMatchesFrom({...result,...change}).length,0);
});
test('card text is escaped and birds outside Burbz cannot be chosen',async()=>{
  const r=await invoke(pickable([{species:'<img src=x onerror=alert(1)>',scientificName:'Corvus corax',score:.5}]));
  assert(!r.elements.birdCropMatches.innerHTML.includes('<img src=x'));
  assert.match(r.elements.birdCropMatches.innerHTML,/Not in Burbz yet[\s\S]*disabled/);
});
test('a fresh camera photo carries a rounded place and week; an old library photo carries none',async()=>{
  const position=async()=>({coords:{latitude:53.871234,longitude:-2.391234}});
  const fresh=photoHarness(async()=>({ok:true,json:async()=>accepted()}),position);
  fresh.ctx.startPhotoPlace({lastModified:Date.now()},false);await fresh.ctx.identifyImage({});
  const sent=Object.fromEntries(fresh.forms[0].values.filter(v=>typeof v[1]==='string'));
  assert.equal(sent.photoContract,'merlin-v486');assert.equal(sent.lat,'53.87');assert.equal(sent.lon,'-2.39');
  assert.equal(Number(sent.photoWeek),vm.runInContext('birdnetWeekOf(new Date())',fresh.ctx));
  const old=photoHarness(async()=>({ok:true,json:async()=>accepted()}),position);
  old.ctx.startPhotoPlace({lastModified:Date.now()-3*24*3600*1000},true);await old.ctx.identifyImage({});
  const oldSent=Object.fromEntries(old.forms[0].values.filter(v=>typeof v[1]==='string'));
  assert.equal(oldSent.photoContract,'merlin-v486');assert.equal(oldSent.lat,undefined);assert.equal(oldSent.photoWeek,undefined);
  assert.equal(vm.runInContext('birdnetWeekOf(new Date(2026,8,25))',old.ctx),36);
  assert.equal(vm.runInContext('birdnetWeekOf(new Date(2026,0,1))',old.ctx),1);
  assert.equal(vm.runInContext('birdnetWeekOf(new Date(2026,11,31))',old.ctx),48);
});


test('full-photo recognition preserves bounded original file bytes and clears them on close',async()=>{
  const h=cropUploadHarness();const original={size:2048,type:'image/jpeg',originalPixels:true};
  vm.runInContext('birdCrop.originalFile = null',h.ctx);h.ctx.original=original;vm.runInContext('birdCrop.originalFile = original',h.ctx);
  await h.ctx.confirmBirdCrop(true);assert.equal(h.uploads[0],original);
  // The matches keep the photo open for another framing; choosing a bird closes it.
  assert.equal(vm.runInContext('birdCrop.originalFile',h.ctx),original);
  assert.equal(h.ctx.pickPhotoMatch(0),true);assert.equal(vm.runInContext('birdCrop.originalFile',h.ctx),null);
});
