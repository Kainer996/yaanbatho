/* Independent move/look/cast pointer ownership. A cancellation never releases a spell. */
(function(root){'use strict';
 function attach({host,look,signal,pose,blocked,begin,cast,cancel,aim}){
  const events=new AbortController();signal?.addEventListener('abort',()=>{reset();events.abort();},{once:true});
  const make=(cls,label,text)=>{const b=document.createElement('button');b.type='button';b.className=cls;b.setAttribute('aria-label',label);b.title=label;b.innerHTML='<span class="fp-aim-knob" aria-hidden="true"></span><span class="fp-stick-label" aria-hidden="true">'+text+'</span>';host.append(b);return b;};
  const lookStick=make('fp-look-stick','Look around: hold and drag','LOOK'),castStick=make('fp-cast-stick','Hold to aim; release to cast. Keyboard: hold Q, aim with arrows, release Q.','CAST');
  let casting=null,looking=null,disposed=false;
  const on=(n,e,f,o={})=>n.addEventListener(e,f,{...o,signal:events.signal});
  function resetStick(node){node.querySelector('.fp-aim-knob').style.transform='';node.classList.remove('fp-aim-active');}
  function stop(aborted=true){const p=casting;casting=null;resetStick(castStick);if(!p)return;try{p.node?.releasePointerCapture(p.id);}catch(_){}if(aborted||blocked()||disposed)cancel?.();else cast({...pose()});}
  function reset(){stop(true);const p=looking;looking=null;resetStick(lookStick);try{p?.node.releasePointerCapture(p.id);}catch(_){};}
  function displacement(e,p){const dx=e.clientX-p.x,dy=e.clientY-p.y,length=Math.max(1,Math.hypot(dx,dy)/28);p.dx=dx/length/28;p.dy=dy/length/28;p.node.querySelector('.fp-aim-knob')?.style.setProperty('transform','translate('+p.dx*24+'px,'+p.dy*24+'px)');}
  function down(e,type){if(e.button!==0||blocked()||disposed||(type==='cast'?casting:looking))return;e.preventDefault();e.stopPropagation();if(type==='cast'&&begin?.()===false)return;const node=e.currentTarget,r=node.getBoundingClientRect(),p={id:e.pointerId,node,x:r.left+r.width/2,y:r.top+r.height/2,dx:0,dy:0};if(type==='cast')casting=p;else looking=p;node.setPointerCapture(e.pointerId);node.classList.add('fp-aim-active');displacement(e,p);}
  for(const [node,type]of [[castStick,'cast'],[lookStick,'look']]){
   on(node,'pointerdown',e=>down(e,type));on(node,'pointermove',e=>{const p=type==='cast'?casting:looking;if(p?.id===e.pointerId){e.preventDefault();e.stopPropagation();displacement(e,p);}});
   for(const event of ['pointerup','pointercancel','lostpointercapture'])on(node,event,e=>{const p=type==='cast'?casting:looking;if(p?.id!==e.pointerId)return;e.preventDefault();e.stopPropagation();if(type==='cast')stop(event!=='pointerup'||!node.hasPointerCapture(e.pointerId));else{looking=null;resetStick(node);try{node.releasePointerCapture(e.pointerId);}catch(_){}}});
  }
  on(look,'pointerdown',e=>{if(e.button!==2||casting||blocked())return;e.preventDefault();e.stopImmediatePropagation();if(begin?.()===false)return;casting={id:e.pointerId,node:look,x:e.clientX,y:e.clientY,mouse:true};look.setPointerCapture(e.pointerId);},{capture:true});
  on(look,'pointermove',e=>{if(casting?.mouse&&casting.id===e.pointerId){aim(e.clientX-casting.x,e.clientY-casting.y,.003);casting.x=e.clientX;casting.y=e.clientY;e.preventDefault();e.stopImmediatePropagation();}},{capture:true});
  for(const event of ['pointerup','pointercancel','lostpointercapture'])on(look,event,e=>{if(casting?.mouse&&casting.id===e.pointerId){e.stopImmediatePropagation();stop(event!=='pointerup'||!look.hasPointerCapture(e.pointerId));}},{capture:true});
  on(look,'contextmenu',e=>e.preventDefault());
  on(document,'keydown',e=>{if(e.code==='Escape'){reset();return;}if(e.code!=='KeyQ'||e.repeat||e.ctrlKey||e.altKey||e.metaKey||blocked()||casting||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;e.preventDefault();e.stopImmediatePropagation();if(begin?.()===false)return;casting={keyboard:true};castStick.classList.add('fp-aim-active');},{capture:true});
  on(document,'keyup',e=>{if(e.code==='KeyQ'&&casting?.keyboard){e.preventDefault();e.stopImmediatePropagation();stop(false);}},{capture:true});
  on(window,'blur',reset);on(document,'visibilitychange',()=>{if(document.hidden)reset();});on(window,'resize',reset);
  return{reset,update(dt){if(blocked()){reset();return;}const p=casting&&!casting.mouse&&!casting.keyboard?casting:looking;if(p)aim(p.dx*1.9*Math.min(.05,dt),p.dy*1.9*Math.min(.05,dt),1);},state:()=>({casting:!!casting,looking:!!looking}),dispose(){disposed=true;reset();events.abort();lookStick.remove();castStick.remove();}};
 }
 root.BurbzFirstPersonCastControls={attach};
})(globalThis);
