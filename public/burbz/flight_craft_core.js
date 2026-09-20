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
    ['parked','deck'].includes(craft.phase)&&player.mode==='walk'&&
    geo.distance(craft,player)<=BOARD_DISTANCE&&Math.abs(craft.altitude-player.altitude)<=2.2;
}
// Fixed-size queries keep provisioning and landing bounded. Every hull sample
// must use known, clear terrain of the same surface class; shore edges are not
// permission to half-bury a hull in the bank.
function berth(x,z,sample,clear){
  const centre=sample(x,z);
  if(!centre||!finite(centre.height)||!surfaces.includes(centre.kind))return null;
  let low=centre.height,high=centre.height;
  for(let i=0;i<8;i++){
    const angle=i*Math.PI/4,px=x+Math.cos(angle)*HULL_RADIUS,pz=z+Math.sin(angle)*HULL_RADIUS;
    const row=sample(px,pz);
    if(!row||!finite(row.height)||row.kind!==centre.kind||clear(px,row.height+DECK_HEIGHT,pz)!==true)return null;
    low=Math.min(low,row.height);high=Math.max(high,row.height);
  }
  if(high-low>(centre.kind==='ground'?.45:.2)||clear(x,centre.height+DECK_HEIGHT,z)!==true)return null;
  return {x,z,height:high,kind:centre.kind};
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
return {VERSION,BOARD_DISTANCE,HULL_RADIUS,DECK_HEIGHT,normalize,at,resumeRequired,resumePose,matchesJourney,occupied,boardable,berth,findBerth,findHomeBerth,floatPose};
});
