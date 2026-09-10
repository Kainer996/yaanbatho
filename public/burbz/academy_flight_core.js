/* First-person flight math, independent of rendering and saved game state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzAcademyFlightCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
function step(p,input,dt,world,options={}){
 dt=clamp(dt,0,.08);if(p.landed)return;
 p.yaw+=clamp(input.turn,-1,1)*dt*1.4;p.pitch=clamp(p.pitch+clamp(input.pitch,-1,1)*dt, -1.1,1.1);
 const forward=clamp(input.forward,-1,1),side=clamp(input.side,-1,1),lift=clamp(input.lift,-1,1),speed=Number.isFinite(options.speed)?clamp(options.speed,.1,80):5.2,liftSpeed=Number.isFinite(options.liftSpeed)?clamp(options.liftSpeed,.1,20):3.2,scale=1/Math.max(1,Math.hypot(forward,side));
 // Looking up/down aims the head; only the height control changes altitude.
 const target={x:(-Math.sin(p.yaw)*forward+Math.cos(p.yaw)*side)*speed*scale,y:lift*liftSpeed,z:(-Math.cos(p.yaw)*forward-Math.sin(p.yaw)*side)*speed*scale};
 p.velocity=p.velocity||{x:0,y:0,z:0};const blend=1-Math.exp(-dt*5);
 for(const axis of ['x','y','z'])p.velocity[axis]+=(target[axis]-p.velocity[axis])*blend;
 const n=Math.max(1,Math.ceil(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)*dt/.08));
 for(let i=0;i<n;i++)for(const axis of ['x','y','z']){const next={x:p.x,y:p.y,z:p.z};next[axis]+=p.velocity[axis]*dt/n;if(world.allowed3(next.x,next.y,next.z)&&(!world.clear||world.clear(p,next)))p[axis]=next[axis];else p.velocity[axis]=0;}
}
function nearest(p,pads,radius=2.1){let best=null;for(const pad of pads){const d=Math.hypot(p.x-pad.x,p.y-pad.y,p.z-pad.z);if(d<radius){radius=d;best=pad;}}return best;}
function land(p,pad,world){if(!pad||Math.hypot(p.x-pad.x,p.y-pad.y,p.z-pad.z)>2.1||!world.allowed3(pad.x,pad.y,pad.z)||world.clear&&!world.clear(p,pad))return false;Object.assign(p,{x:pad.x,y:pad.y,z:pad.z,yaw:pad.yaw,pitch:-.04,landed:pad.roomId,velocity:{x:0,y:0,z:0}});return true;}
function takeoff(p){p.landed=null;p.velocity={x:0,y:0,z:0};}
// Camera-only wingbeat and bank: collision and landing use the unchanged body.
function cameraMotion(m,p,dt,reduced=false){
 dt=clamp(dt,0,.08);const previous=m.yaw??p.yaw,delta=Math.atan2(Math.sin(p.yaw-previous),Math.cos(p.yaw-previous));m.yaw=p.yaw;
 const v=p.velocity||{x:0,y:0,z:0},forward=Math.max(0,-Math.sin(p.yaw)*v.x-Math.cos(p.yaw)*v.z),speed=clamp(forward/5.2,0,1);
 if(p.landed||reduced){m.strength=0;m.bank=0;m.phase=0;return{bob:0,pitch:0,roll:0,mode:p.landed?'perched':'reduced'};}
 const flapping=forward>.2&&v.y>.08,gliding=forward>.2&&v.y<-.08;
 m.strength=(m.strength||0)+((flapping?speed:0)-(m.strength||0))*(1-Math.exp(-dt*12));
 m.phase=((m.phase||0)+dt*Math.PI*2*3.2)%(Math.PI*2);
 const turn=dt>0?clamp(delta/dt,-2,2):0,target=clamp(turn*.16*speed,-.24,.24);
 m.bank=(m.bank||0)+(target-(m.bank||0))*(1-Math.exp(-dt*7));
 return {bob:Math.sin(m.phase)*.045*m.strength,pitch:Math.sin(m.phase+.5)*.012*m.strength,roll:m.bank,mode:flapping?'flapping':gliding?'gliding':'cruising'};
}
return {step,nearest,land,takeoff,cameraMotion};
});
