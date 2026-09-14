/* Pure project identity, proximity and one-use assistance rules. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzBuildingWorkCore=api;})(globalThis,function(){'use strict';
 const finite=Number.isFinite;
 function identity(project){if(!project||typeof project.key!=='string'||!project.key||!finite(project.startMs)||!finite(project.endMs)||project.endMs<=project.startMs)return null;return project.key+':'+project.startMs;}
 function near(player,site){
  if(!player||player.mode==='fly'||!site||!site.loaded||site.interior||!['x','y','z'].every(k=>finite(player[k]))||!['x','y','z','radius'].every(k=>finite(site[k]))||site.radius<0)return false;
  return Math.hypot(player.x-site.x,player.z-site.z)<=site.radius+3&&Math.abs(player.y-site.y)<=2.5;
 }
 function assist(project,now){
  if(!identity(project)||!finite(now)||now<project.startMs||now>=project.endMs||project.assistedAt!=null||project.readyToOpenAt!=null)return null;
  const savedMs=Math.floor((project.endMs-project.startMs)*.25);if(savedMs<1)return null;
  return{...project,endMs:Math.max(project.startMs+1,project.endMs-savedMs),assistedAt:now,assistedMs:savedMs};
 }
 return{identity,near,assist};
});
