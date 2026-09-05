/* Geometry for thumb aiming; no DOM, timers, damage or resource mutation. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzBattleAim=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  function targetAt(value,targets){
    if(!targets.length)return null;
    const sorted=[...targets].sort((a,b)=>a.x-b.x),first=sorted[0].x,last=sorted.at(-1).x;
    const x=first+(last-first)*Math.max(0,Math.min(100,Number(value)||0))/100;
    return sorted.reduce((best,t)=>Math.abs(t.x-x)<Math.abs(best.x-x)?t:best);
  }
  function valueFor(index,targets){
    if(targets.length<2)return 50;const xs=targets.map(t=>t.x),min=Math.min(...xs),max=Math.max(...xs),t=targets.find(t=>t.index===index);
    return t&&max>min?(t.x-min)/(max-min)*100:50;
  }
  function curve(start,end,width=Infinity){
    const bend=Math.min(110,Math.max(35,Math.hypot(end.x-start.x,end.y-start.y)*.3));
    return {start,end,control:{x:Math.max(12,Math.min(width-12,(start.x+end.x)/2+bend)),y:Math.min(start.y,end.y)+Math.abs(start.y-end.y)*.2}};
  }
  function pointAt(c,t){t=Math.max(0,Math.min(1,t));const q=1-t;return {x:q*q*c.start.x+2*q*t*c.control.x+t*t*c.end.x,y:q*q*c.start.y+2*q*t*c.control.y+t*t*c.end.y};}
  return {targetAt,valueFor,curve,pointAt};
});
