/* Read-only pedestrian geometry and motion. No game globals or persistence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzVillageWalkCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const RADIUS=.27, EYE=1.38, SPEED=2.7;
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  function distance2(x,z,a,b){
    const dx=b.x-a.x,dz=b.z-a.z,k=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
    return (x-a.x-k*dx)**2+(z-a.z-k*dz)**2;
  }
  function inside(x,z,polygon){
    let yes=false;
    for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
      const a=polygon[i],b=polygon[j];
      if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)yes=!yes;
    }return yes;
  }
  function createWorld({radius=27,heightAt=()=>0,river=null,polygons=[],segments=[]}={}){
    const cells=new Map(),cellSize=2;
    function add(segment){
      const [a,b]=segment;
      for(let x=Math.floor((Math.min(a.x,b.x)-RADIUS)/cellSize);x<=Math.floor((Math.max(a.x,b.x)+RADIUS)/cellSize);x++)
        for(let z=Math.floor((Math.min(a.z,b.z)-RADIUS)/cellSize);z<=Math.floor((Math.max(a.z,b.z)+RADIUS)/cellSize);z++){
          const key=x+','+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(segment);
        }
    }
    segments.forEach(add);polygons.forEach(p=>p.forEach((a,i)=>add([a,p[(i+1)%p.length]])));
    function riverCoords(x,z){const dx=x-river.x,dz=z-river.z;return{across:dx*river.ux+dz*river.uz,along:-dx*river.uz+dz*river.ux};}
    function allowed(x,z){
      if(!Number.isFinite(x+z)||Math.hypot(x,z)>radius-RADIUS)return false;
      if(river){const p=riverCoords(x,z);if(Math.abs(p.across)<river.width/2+RADIUS&&Math.abs(p.along)>.69-RADIUS)return false;}
      for(const p of polygons)if(inside(x,z,p))return false;
      for(const [a,b] of cells.get(Math.floor(x/cellSize)+','+Math.floor(z/cellSize))||[])
        if(distance2(x,z,a,b)<RADIUS*RADIUS)return false;
      return true;
    }
    function height(x,z){
      let y=heightAt(x,z);
      if(river){const p=riverCoords(x,z),span=river.width+2.2;
        if(Math.abs(p.along)<.8&&Math.abs(p.across)<span/2+.45){
          // Meet the original arched bridge's five plank centres with short approach ramps.
          const a=Math.abs(p.across),end=span/2;
          y=Math.max(y,a>end?.48*(1-(a-end)/.45):.365+Math.cos(p.across/span*Math.PI)*.4);
        }
      }return y;
    }
    function spawn(preferred={x:4.8,z:7.5}){
      if(allowed(preferred.x,preferred.z))return {...preferred,y:height(preferred.x,preferred.z)};
      for(let rad=2;rad<radius-1;rad+=.65)for(let i=0;i<64;i++){
        const x=Math.sin(i/64*Math.PI*2)*rad,z=Math.cos(i/64*Math.PI*2)*rad;
        if(allowed(x,z))return{x,z,y:height(x,z)};
      }throw Error('No safe village footpath is available.');
    }
    return {allowed,height,spawn,radius,polygons,segments,cellCount:cells.size};
  }
  function move(player,input,dt,world){
    dt=clamp(Number(dt)||0,0,.05);
    let side=Number(input.side)||0,forward=Number(input.forward)||0;
    const magnitude=Math.max(1,Math.hypot(side,forward));side/=magnitude;forward/=magnitude;
    const s=Math.sin(player.yaw),c=Math.cos(player.yaw),speed=SPEED*dt;
    const dx=(side*c-forward*s)*speed,dz=(-side*s-forward*c)*speed;
    // Swept small steps prevent tunnelling even after a delayed frame; axis
    // separation lets a shoulder slide along a wall without camera jitter.
    const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/(RADIUS*.45)));
    for(let i=0;i<steps;i++){
      if(world.allowed(player.x+dx/steps,player.z))player.x+=dx/steps;
      if(world.allowed(player.x,player.z+dz/steps))player.z+=dz/steps;
    }
    player.y=world.height(player.x,player.z);
    return player;
  }
  function look(player,dx,dy,sensitivity=.003){
    player.yaw-=clamp(dx,-300,300)*sensitivity;
    player.pitch=clamp(player.pitch-dy*sensitivity,-1.10,1.10);
  }
  // A fresh window of real RAF intervals; no busy waits or benchmark loop.
  function quality(dpr,maxDpr,intervals,fastStreak=0){
    const mean=intervals.reduce((a,b)=>a+b,0)/Math.max(1,intervals.length);
    if(mean>19.2)return {dpr:Math.max(.65,dpr-.15),fastStreak:0,mean};
    fastStreak=mean<17.2?fastStreak+1:0;
    return {dpr:fastStreak>=4?Math.min(maxDpr,dpr+.1):dpr,fastStreak:fastStreak>=4?0:fastStreak,mean};
  }
  return {createWorld,move,look,quality,distance2,inside,RADIUS,EYE,SPEED};
});
