/* Responsive placement of existing nodes; game state and input handlers stay owned by the game. */
(function(root){
'use strict';
let dispose=null;
function bind(api){
 if(dispose)dispose();
 const app=document.getElementById('app');if(!app)return;
 const media=root.matchMedia('(min-width:640px) and (orientation:landscape)'),slots=[];
 let frame=0;
 for(const kind of ['village','town']){
  const stage=document.getElementById(kind+'Stage'),screen=document.getElementById('screen-'+kind),controls=document.getElementById(kind+'LayoutControls');
  if(stage&&screen&&controls)slots.push({kind,stage,screen,controls,marker:null});
 }
 function update(){
  frame=0;
  // Home projects the same app into a 3D monitor. Its original composition
  // remains intact; the body-level immersive canvases are never resized here.
  const wide=media.matches&&!app.closest('.ph-screen-surface');
  app.classList.toggle('landscape-ui',wide);
  for(const slot of slots){
   const {kind,stage,screen,controls}=slot;
   const focus=stage.contains(document.activeElement)?document.activeElement:null;
   const enabled=wide&&screen.classList.contains('active')&&(kind==='town'||
    (document.getElementById('empirePageVillages')?.classList.contains('is-active')&&!document.getElementById('empireVillageHub')?.hidden));
   if(enabled&&!slot.marker){
    const scroll=screen.scrollTop;slot.marker=document.createComment(kind+'-portrait-stage');stage.before(slot.marker);screen.prepend(stage);
    screen.classList.add('landscape-settlement');controls.tabIndex=0;controls.setAttribute('role','region');controls.setAttribute('aria-label',kind==='town'?'Town management':'Village management');
    screen.scrollTop=0;controls.scrollTop=scroll;
   }else if(!enabled&&slot.marker){
    const scroll=controls.scrollTop;slot.marker.replaceWith(stage);slot.marker=null;screen.classList.remove('landscape-settlement');
    controls.removeAttribute('tabindex');controls.removeAttribute('role');controls.removeAttribute('aria-label');screen.scrollTop=scroll;
   }
   if(focus&&document.activeElement!==focus)focus.focus({preventScroll:true});
  }
  api.resizeVillage?.();api.resizeTown?.();api.resizeAtlas?.();
 }
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 const observer=new MutationObserver(schedule);
 observer.observe(document.body,{attributes:true,attributeFilter:['data-active-screen'],childList:true});
 for(const id of ['empirePageVillages','empireVillageHub']){const el=document.getElementById(id);if(el)observer.observe(el,{attributes:true,attributeFilter:['class','hidden']});}
 media.addEventListener('change',schedule);root.addEventListener('resize',schedule,{passive:true});
 dispose=()=>{observer.disconnect();media.removeEventListener('change',schedule);root.removeEventListener('resize',schedule);if(frame)cancelAnimationFrame(frame);for(const slot of slots){if(slot.marker)slot.marker.replaceWith(slot.stage);slot.screen.classList.remove('landscape-settlement');slot.controls.removeAttribute('tabindex');slot.controls.removeAttribute('role');slot.controls.removeAttribute('aria-label');}app.classList.remove('landscape-ui');};
 update();
}
root.BurbzLandscapeUI={bind};
})(window);
