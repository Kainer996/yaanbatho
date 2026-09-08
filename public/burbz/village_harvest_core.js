/* Finite daily supplies from actual scene objects. The host owns persistence. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzVillageHarvestCore=api;})(globalThis,function(){'use strict';
 const day=now=>new Date(now).toISOString().slice(0,10);
 function id(kind,x,z){return kind+':'+Math.round(x*100)+':'+Math.round(z*100);}
 function available(state,seed,node,now){return !state?.villageHarvest?.[String(seed)]||state.villageHarvest[String(seed)].day!==day(now)||!state.villageHarvest[String(seed)].taken?.[node.id];}
 function claim(state,seed,node,now){if(!node||!['wood','stone'].includes(node.kind)||!available(state,seed,node,now))return null;
  state.villageHarvest||={};const key=String(seed);if(state.villageHarvest[key]?.day!==day(now))state.villageHarvest[key]={day:day(now),taken:{}};
  state.villageHarvest[key].taken[node.id]=true;const reward={resource:node.kind==='wood'?'branches':'stone',quantity:node.kind==='wood'?3:2};
  state.player[reward.resource]=(Number(state.player[reward.resource])||0)+reward.quantity;return reward;
 }
 function inReach(player,node,world){
  if(!player||![player.x,player.y,player.z,player.yaw,node.x,node.y,node.z,node.radius].every(Number.isFinite))return false;
  const dx=node.x-player.x,dz=node.z-player.z,d=Math.hypot(dx,dz),radius=Math.min(.9,Math.max(.2,node.radius));
  if(d>2.1+radius||Math.abs(node.y-player.y)>1.5||d<.01)return false;
  if((-Math.sin(player.yaw)*dx-Math.cos(player.yaw)*dz)/d<.86)return false;
  // Stop at the solid object's surface plus the pedestrian collision radius.
  const end=Math.max(0,d-radius-.3);for(let t=.1;t<end;t+=.1)if(!world.allowed(player.x+dx*t/d,player.z+dz*t/d))return false;
  return true;
 }
 return{day,id,available,claim,inReach};
});
