/* First-person flight math, independent of rendering and saved game state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzAcademyFlightCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
function step(p,input,dt,world){
 dt=clamp(dt,0,.08);if(p.landed)return;
 p.yaw+=clamp(input.turn,-1,1)*dt*1.4;p.pitch=clamp(p.pitch+clamp(input.pitch,-1,1)*dt, -1.1,1.1);
 const throttle=clamp(input.forward,-1,1),lift=clamp(input.lift,-1,1),speed=5.2;
 const target={x:-Math.sin(p.yaw)*Math.cos(p.pitch)*speed*throttle,y:Math.sin(p.pitch)*speed*throttle+lift*3.2,z:-Math.cos(p.yaw)*Math.cos(p.pitch)*speed*throttle};
 p.velocity=p.velocity||{x:0,y:0,z:0};const blend=1-Math.exp(-dt*5);
 for(const axis of ['x','y','z'])p.velocity[axis]+=(target[axis]-p.velocity[axis])*blend;
 const n=Math.max(1,Math.ceil(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)*dt/.08));
 for(let i=0;i<n;i++)for(const axis of ['x','y','z']){const next={x:p.x,y:p.y,z:p.z};next[axis]+=p.velocity[axis]*dt/n;if(world.allowed3(next.x,next.y,next.z)&&(!world.clear||world.clear(p,next)))p[axis]=next[axis];else p.velocity[axis]=0;}
}
function nearest(p,pads,radius=2.1){let best=null;for(const pad of pads){const d=Math.hypot(p.x-pad.x,p.y-pad.y,p.z-pad.z);if(d<radius){radius=d;best=pad;}}return best;}
function land(p,pad,world){if(!pad||Math.hypot(p.x-pad.x,p.y-pad.y,p.z-pad.z)>2.1||!world.allowed3(pad.x,pad.y,pad.z)||world.clear&&!world.clear(p,pad))return false;Object.assign(p,{x:pad.x,y:pad.y,z:pad.z,yaw:pad.yaw,pitch:-.04,landed:pad.roomId,velocity:{x:0,y:0,z:0}});return true;}
function takeoff(p){p.landed=null;p.velocity={x:0,y:0,z:0};}
return {step,nearest,land,takeoff};
});
