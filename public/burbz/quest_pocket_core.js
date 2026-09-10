/* Hidden-page time is a screen-away proxy, not a pocket or movement sensor. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzQuestPocketCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const MIN_MS=60000, MAX_GAP_MS=24*60*60*1000;
  const positive=value=>Number.isFinite(Number(value))?Math.max(0,Number(value)):0;
  function stamp(value){if(typeof value==='string')return positive(Date.parse(value));return positive(value);}
  function elapsed(from,now){return from===null?0:Math.min(MAX_GAP_MS,Math.max(0,now-from));}
  function state(quest,now){
    const p=quest.pocket||{},start=stamp(quest.startedAt)||now;
    const timestamp=value=>value!=null&&Number.isFinite(value)&&value>=start?value:null;
    return {version:1,hiddenSince:timestamp(p.hiddenSince),suspendedSince:timestamp(p.suspendedSince),suspendedMs:positive(p.suspendedMs),lastAt:positive(p.lastAt)};
  }
  // Returns new fields. Duplicate hide/pagehide events never reset an interval.
  function transition(quest,event,now){
    now=stamp(now); const p=state(quest,now);let ms=positive(quest.pocketMs);
    const close=()=>{ms+=elapsed(p.hiddenSince,now);p.hiddenSince=null;};
    if(now<p.lastAt){p.hiddenSince=null;if(p.suspendedSince!==null)p.suspendedSince=now;}
    if(event==='hide'&&p.suspendedSince===null&&p.hiddenSince===null)p.hiddenSince=now;
    if(event==='show'||event==='finish')close();
    if(event==='suspend'){close();if(p.suspendedSince===null)p.suspendedSince=now;}
    if(event==='resume'&&p.suspendedSince!==null){p.suspendedMs+=Math.max(0,now-p.suspendedSince);p.suspendedSince=null;}
    p.lastAt=now;
    return {pocketMs:ms,pocket:p};
  }
  function reading(quest,now){
    now=stamp(now);const p=state(quest,now),start=stamp(quest.startedAt)||now;
    const total=Math.max(0,now-start-p.suspendedMs-(p.suspendedSince===null?0:Math.max(0,now-p.suspendedSince)));
    const pocketMs=Math.min(total,positive(quest.pocketMs)+(now<p.lastAt?0:elapsed(p.hiddenSince,now)));
    const earned=pocketMs>=MIN_MS&&total>0;
    const share=earned?Math.min(1,pocketMs/total):0;
    return {pocketMs,pocketMinutes:Math.floor(pocketMs/60000),share:Number(share.toFixed(3)),multiplier:earned?Number((1+0.5*share).toFixed(3)):1,earned};
  }
  function reward(quest,baseXp,now){
    const r=reading(quest,now),xp=Math.round(positive(baseXp)*r.multiplier)-Math.round(positive(baseXp));
    const items=r.earned?{oak_twig:1,...(r.share>=0.5?{down_tuft:1}:{}),...(r.share>=0.9?{iron_grit:1}:{})}:{};
    return {...r,extraXp:xp,items,achievement:r.earned?'pocket_pathfinder':null};
  }
  function receiptKey(kind,quest){return 'quest-finish:'+kind+':'+quest.id+':'+String(quest.startedAt||'legacy');}
  // The completion and its reward share one save. Caller mutations must be state-only.
  function commit(options){
    if(options.getReceipt(options.key))return {status:'duplicate'};
    const before=options.snapshot();
    try{
      const value=options.apply();
      options.setReceipt(options.key,{version:1,at:options.now,xp:positive(value.xp),pocketReward:value.pocketReward||null});
      const result=options.persist();
      if(result===false||result&&result.ok===false)throw new Error('Quest save failed');
      return {status:'committed',value};
    }catch(error){options.restore(before);return {status:'failed',error};}
  }
  return Object.freeze({MIN_MS,MAX_GAP_MS,transition,reading,reward,receiptKey,commit});
});
