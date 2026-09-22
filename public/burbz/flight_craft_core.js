/* One persistent aircraft. Rendering, player health and durable transactions
 * belong to the existing world and save owners, not this module. */
(function(root,factory){
  const api=factory(typeof module==='object'&&module.exports?require('./geographic_world_core.js'):root.BurbzGeographicWorldCore);
  if(typeof module==='object'&&module.exports)module.exports=api;
  root.BurbzFlightCraftCore=api;
})(globalThis,function(geo){
'use strict';
const VERSION=1,BOARD_DISTANCE=1.8,HULL_RADIUS=.9,DECK_HEIGHT=.55;
const phases=['parked','deck','boarded','flying'];
const surfaces=['ground','freshwater','sea'];
const finite=Number.isFinite;
function normalize(raw){
  if(!raw||raw.version!==VERSION||!geo.validCoordinate(raw)||
     !finite(raw.altitude)||raw.altitude< -12000||raw.altitude>100000||
     !finite(raw.yaw)||!phases.includes(raw.phase)||!surfaces.includes(raw.surface))return null;
  return {version:VERSION,lat:raw.lat,lon:raw.lon,altitude:raw.altitude,
    yaw:Math.atan2(Math.sin(raw.yaw),Math.cos(raw.yaw)),phase:raw.phase,surface:raw.surface};
}
function at(pose,phase='parked',surface='ground'){
  return normalize({...pose,version:VERSION,phase,surface});
}
function resumeRequired(craft){
  return !!normalize(craft)&&(craft.phase==='flying'||craft.phase==='deck'||craft.phase==='boarded'&&craft.surface!=='ground');
}
function resumePose(craft){
  const c=normalize(craft);return c?{lat:c.lat,lon:c.lon,altitude:c.altitude,yaw:c.yaw,pitch:0,mode:c.phase==='flying'?'fly':'walk'}:null;
}
function matchesJourney(craft,pose){
  return !!normalize(craft)&&geo.validatePose(pose)&&geo.distance(craft,pose)<.25&&
    Math.abs(craft.altitude-pose.altitude)<.15&&pose.mode===(craft.phase==='flying'?'fly':'walk');
}
function occupied(craft){return !!craft&&['boarded','flying'].includes(craft.phase);}
function boardable(craft,player){
  return !!normalize(craft)&&geo.validatePose(player)&&
    ['parked','deck'].includes(craft.phase)&&['walk','swim'].includes(player.mode)&&
    geo.distance(craft,player)<=BOARD_DISTANCE&&Math.abs(craft.altitude-player.altitude)<=2.2;
}
// Fixed-size queries keep provisioning and landing bounded. Every hull sample
// must use known, clear, flat terrain. A flat shoreline can support the hull
// even where water and ground meet; height, not a map label, decides flatness.
function berth(x,z,sample,clear){
  const centre=sample(x,z);
  if(!centre||!finite(centre.height)||!surfaces.includes(centre.kind))return null;
  let low=centre.height,high=centre.height;
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,px=x+Math.cos(angle)*HULL_RADIUS,pz=z+Math.sin(angle)*HULL_RADIUS;
    const row=sample(px,pz);
    if(!row||!finite(row.height)||!surfaces.includes(row.kind)||clear(px,row.height+DECK_HEIGHT,pz)!==true)return null;
    low=Math.min(low,row.height);high=Math.max(high,row.height);
  }
  if(high-low>.45||clear(x,centre.height+DECK_HEIGHT,z)!==true)return null;
  return {x,z,height:high,kind:centre.kind};
}
// A disembarked traveller uses the water surface, with swept body samples and
// a bounded step onto a walkable bank. Unknown terrain and solids remain walls.
function swimmerPosition(x,z,previousY,sample,clear,walkable){
 const row=sample(x,z);if(!row||!finite(row.height)||!surfaces.includes(row.kind)||Math.abs(row.height-previousY)>.6)return null;
 if(row.kind==='ground'&&walkable(x,z)!==true)return null;
 for(const [dx,dz] of [[0,0],[-.27,0],[.27,0],[0,-.27],[0,.27]])
  if(clear(x+dx,row.height+.55,z+dz)!==true)return null;
 return{x,y:row.height,z,mode:row.kind==='ground'?'walk':'swim'};
}
function swimStep(player,input,dt,sample,clear,walkable){
 if(!player||!['walk','swim'].includes(player.mode))return false;
 const side=finite(input.side)?Math.max(-1,Math.min(1,input.side)):0,forward=finite(input.forward)?Math.max(-1,Math.min(1,input.forward)):0;
 const scale=1.8*Math.max(0,Math.min(.08,finite(dt)?dt:0))/Math.max(1,Math.hypot(side,forward));
 const dx=(Math.cos(player.yaw)*side-Math.sin(player.yaw)*forward)*scale,dz=(-Math.sin(player.yaw)*side-Math.cos(player.yaw)*forward)*scale;
 if(player.mode==='walk'){const target=sample(player.x+dx,player.z+dz);if(!target||!['freshwater','sea'].includes(target.kind))return false;}
 const steps=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.08));
 for(let i=0;i<steps;i++){
  const next=swimmerPosition(player.x+dx/steps,player.z+dz/steps,player.y,sample,clear,walkable);
  if(!next)break;Object.assign(player,next);if(player.mode==='walk')break;
 }
 return true;
}
function findBerth(origin,sample,clear,{minRadius=3,maxRadius=18}={}){
  if(!origin||!finite(origin.x)||!finite(origin.z))return null;
  minRadius=Math.max(0,Math.min(24,finite(minRadius)?minRadius:3));
  maxRadius=Math.max(minRadius,Math.min(24,finite(maxRadius)?maxRadius:18));
  for(let r=minRadius;r<=maxRadius;r+=1.5)for(let i=0;i<24;i++){
    const angle=i*Math.PI/12,row=berth(origin.x+Math.sin(angle)*r,origin.z+Math.cos(angle)*r,sample,clear);
    if(row&&row.kind==='ground')return row;
  }
  return null;
}
// The Land control checks the whole descent, not just proximity to the floor.
// Sweep the hull at sub-body intervals so roofs/canopies cannot be skipped.
function landingBerth(player,sample,parkingClear,clear){
  if(!player||![player.x,player.y,player.z].every(finite))return null;
  const target=berth(player.x,player.z,sample,parkingClear);
  if(!target||player.y<target.height-.45)return null;
  const steps=Math.max(1,Math.ceil(Math.abs(player.y-target.height)/.25));
  if(steps>8192)return null; // Bounded even for malformed legacy altitudes.
  for(let step=0;step<=steps;step++){
    const y=player.y+(target.height-player.y)*step/steps+DECK_HEIGHT;
    if(clear(player.x,y,player.z)!==true)return null;
    for(let i=0;i<8;i++){
      const angle=i*Math.PI/4;
      if(clear(player.x+Math.cos(angle)*HULL_RADIUS,y,player.z+Math.sin(angle)*HULL_RADIUS)!==true)return null;
    }
  }
  return target;
}
// Homes face +Z. Search only left of their doorway so the first forward view
// stays open; no berth is preferable to unknown or obstructed ground.
function findHomeBerth(origin,sample,clear,yaw=Math.PI){
  if(!origin||!finite(origin.x)||!finite(origin.z)||!finite(yaw))return null;
  const left={x:-Math.cos(yaw),z:Math.sin(yaw)},forward={x:-Math.sin(yaw),z:-Math.cos(yaw)};
  for(let side=8;side<=20;side+=1.5)for(const ahead of [5,3,8,11]){
    const row=berth(origin.x+left.x*side+forward.x*ahead,origin.z+left.z*side+forward.z*ahead,sample,clear);
    if(row?.kind==='ground')return row;
  }
  return null;
}
// Bounded analytic critical damping is stable across long pause/resume gaps.
// Waves affect the visible hull only: parking coordinates never accumulate bob.
function floatPose(previous,kind,time,dt,reducedMotion=false){
  const water=kind==='freshwater'||kind==='sea',strength=kind==='sea'?1:.32;
  time=finite(time)?time:0;dt=finite(dt)?Math.max(0,Math.min(.1,dt)):0;
  const target=water&&!reducedMotion?strength*(Math.sin(time*1.7)*.10+Math.sin(time*2.9+.7)*.035):0;
  const y=finite(previous?.y)?Math.max(-.25,Math.min(.25,previous.y)):0;
  const velocity=finite(previous?.velocity)?Math.max(-2,Math.min(2,previous.velocity)):0;
  const omega=8,offset=y-target,decay=Math.exp(-omega*dt),term=velocity+omega*offset;
  return {y:target+(offset+term*dt)*decay,velocity:(velocity-omega*term*dt)*decay,
    roll:water&&!reducedMotion?Math.sin(time*1.25)*.045*strength:0,
    pitch:water&&!reducedMotion?Math.sin(time*1.9+.4)*.025*strength:0};
}
return {VERSION,BOARD_DISTANCE,HULL_RADIUS,DECK_HEIGHT,normalize,at,resumeRequired,resumePose,matchesJourney,occupied,boardable,berth,swimmerPosition,swimStep,landingBerth,findBerth,findHomeBerth,floatPose};
});
