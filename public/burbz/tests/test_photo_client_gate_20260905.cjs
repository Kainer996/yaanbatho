const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require('node:path').join(__dirname,'../index.html'),'utf8');
const fn=html.slice(html.indexOf('async function identifyImage('),html.indexOf('\nasync function startCamera()',html.indexOf('async function identifyImage(')));
async function invoke(result,ok=true){
  const awards=[],bats=[],toasts=[],button={};const context={$:()=>button,FormData:class{append(){}},getCurrentPositionForPhotoId:async()=>null,
    fetch:async()=>({ok,json:async()=>result}),batLabelInIdentifyResult:r=>/bat/i.test(r.species||'')?'bat':'',looksLikeBatLabel:s=>/bat/i.test(s||''),
    triggerBatEasterEgg:(...a)=>bats.push(a),handleBirdCandidates:(...a)=>awards.push(a),showToast:t=>toasts.push(t),console};
  vm.createContext(context);vm.runInContext(fn,context);await context.identifyImage({});return {awards,bats,toasts,button};
}
test('inconclusive, legacy guesses, bad HTTP and invalid confidences never enter discovery or bat rewards',async()=>{
  const clear={found:true,accepted:true,policy:'photo-evidence-v350',species:'European Robin',scientificName:'Erithacus rubecula',confidence:.98};
  const cases=[{found:false,message:'Bird not found. Try a closer, clearer photo.'},{found:true,species:'Kestrel',confidence:.5},{...clear,accepted:false},{...clear,confidence:.89},{...clear,confidence:Infinity},{...clear,policy:'old'},{found:false,species:'bat'}];
  for(const raw of cases){const r=await invoke(raw);assert.equal(r.awards.length,0);assert.equal(r.bats.length,0);assert.match(r.toasts[0],/^Bird not found/);assert.equal(r.button.disabled,false);}
  assert.equal((await invoke(clear,false)).awards.length,0);
  assert.equal((await invoke(clear)).awards.length,1);
});
