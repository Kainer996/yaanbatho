/* Zombie species selection and bounded flock movement. This module never
 * discovers living birds, changes health, grants rewards or writes saves. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzZombieProgressionCore=api;})(globalThis,function(){
'use strict';
const ROSTER=Object.freeze([
 {id:'chickenz',name:'Chickenz',species:'Chicken',aerial:false,speed:2.2,size:1},
 {id:'ravenz',name:'Ravenz',species:'Raven',aerial:true,speed:5.8,size:1,unlock:/raven|crow|rook|jackdaw/},
 {id:'peregrinez',name:'Peregrinez',species:'Peregrine Falcon',aerial:true,speed:8.5,size:.9,unlock:/peregrine|falcon|kestrel|merlin/},
 {id:'eaglez',name:'Eaglez',species:'Eagle',aerial:true,speed:5.4,size:1.3,unlock:/eagle|osprey/},
 {id:'hawkez',name:'Hawkez',species:'Hawk',aerial:true,speed:6.6,size:1.05,unlock:/hawk|buzzard|harrier|kite/},
 {id:'owlez',name:'Owlez',species:'Owl',aerial:true,speed:5,size:1.1,unlock:/owl/}
].map(Object.freeze));
const byId=id=>ROSTER.find(r=>r.id===id)||ROSTER[0];
function eligible(progress={}){
 const names=(Array.isArray(progress.unlockedSpecies)?progress.unlockedSpecies:[]).slice(0,2048).filter(n=>typeof n==='string');
 // The first real Forge upgrade and a discovered/recruited bird jointly unlock
 // its enemy family. There is no invented player-level ladder or fixed order.
 if(!Number.isFinite(progress.gearLevel)||progress.gearLevel<2)return[ROSTER[0]];
 return ROSTER.filter((r,i)=>i===0||names.some(n=>r.unlock.test(n.toLowerCase())));
}
function choose(progress,seed=0){const list=eligible(progress);return list[(Number.isSafeInteger(seed)?Math.abs(seed):0)%list.length];}
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
function flyStep(a,flock,pose,dt,time,env){
 if(!a.aerial)return false;dt=Number.isFinite(dt)?Math.max(0,Math.min(.05,dt)):0;
 const rows=flock.filter(b=>b.aerial&&b.side===a.side&&b.fighter.hp>0).sort((a,b)=>a.id.localeCompare(b.id));
 const slot=Math.max(0,rows.indexOf(a)),kind=byId(a.enemyKind),body=env.body(pose);
 if(!body||!env.dark(a.position,body))return true;
 const terrain=env.ground(a.position.x,a.position.z);if(!Number.isFinite(terrain))return true;
 const orbit=()=>{const angle=time*.6+slot*Math.PI*2/Math.max(1,rows.length),radius=6+slot*.8;
  const x=body.x+Math.cos(angle)*radius,z=body.z+Math.sin(angle)*radius,h=env.ground(x,z);
  return Number.isFinite(h)?{x,y:Math.max(h+4,Math.min(h+60,body.y+3+slot*.55)),z}:null;};
 function move(target,speed){
  if(!target)return false;const d=distance(a.position,target);if(d<.02)return true;
  const travel=Math.min(d,speed*dt),q={x:a.position.x+(target.x-a.position.x)/d*travel,y:a.position.y+(target.y-a.position.y)/d*travel,z:a.position.z+(target.z-a.position.z)/d*travel};
  const h=env.ground(q.x,q.z);
  if(!Number.isFinite(h)||q.y<h+.4||!env.dark(a.position,q)||!env.valid(q)||!env.clear(a.position,q))return false;
  a.heading=Math.atan2(a.position.x-q.x,a.position.z-q.z);a.position=q;a.moving=travel>0;return d<speed*dt+.08;
 }
 if(a.phase==='guard'||a.phase==='pursuit')a.phase='takeoff';
 if(a.phase==='takeoff'){
  if(a.escapeTarget){
   const arrived=move(a.escapeTarget,kind.speed*.5);
   if(arrived||!a.moving)delete a.escapeTarget;
  }else if(move({x:a.position.x,y:Math.max(terrain+4,Math.min(terrain+60,body.y+3)),z:a.position.z},3))a.phase='orbit';
  else if(!a.moving){
   // A tree may overhang a valid ground guard position. Walk/fly sideways
   // beneath its canopy first, retaining that route instead of oscillating.
   const start=Math.atan2(body.z-a.position.z,body.x-a.position.x);
   for(let i=0;i<8;i++){
    const angle=start+i*Math.PI/4,q={x:a.position.x+Math.cos(angle)*3,y:a.position.y,z:a.position.z+Math.sin(angle)*3};
    let clear=true;
    for(let j=1;j<=12;j++){const t=j/12,p={x:a.position.x+(q.x-a.position.x)*t,y:q.y,z:a.position.z+(q.z-a.position.z)*t},h=env.ground(p.x,p.z);
     if(!Number.isFinite(h)||p.y<h+.4||!env.valid(p)||!env.dark(a.position,p)||!env.clear(a.position,p)){clear=false;break;}}
    if(clear){a.escapeTarget=q;move(q,kind.speed*.5);break;}
   }
  }
 }else if(a.phase==='windup'){
  // The marked dive point stays fixed: the player can dodge the warning.
  if(a.attackTime>=.8){a.phase='dive';a.attackTime=0;a.cr=0;a.fighter.mods=(a.fighter.mods||[]).map(m=>({...m,turns:m.turns-1})).filter(m=>m.turns>0);}
 }else if(a.phase==='dive'){
  move(a.diveTarget,kind.speed*1.6);
  if(distance(a.position,body)<1.65&&env.clear(a.position,body)){env.attack(a);a.phase='recover';a.attackTime=0;}
  else if(!a.diveTarget||distance(a.position,a.diveTarget)<.25||a.attackTime>1.4){a.phase='recover';a.attackTime=0;}
 }else if(a.phase==='recover'){
  move(orbit(),kind.speed);if(a.attackTime>1.1){a.phase='orbit';a.attackTime=0;delete a.diveTarget;}
 }else{
  a.phase='orbit';move(orbit(),kind.speed);
  const owner=rows[Math.floor(time/3.2)%Math.max(1,rows.length)],busy=rows.some(b=>b!==a&&['windup','dive'].includes(b.phase));
  if(owner===a&&!busy&&a.cr>=100&&distance(a.position,body)<13&&env.clear(a.position,body)){
   a.phase='windup';a.attackTime=0;a.diveTarget={...body};env.warn(a);
  }
 }
 return true;
}
return {ROSTER,byId,eligible,choose,flyStep};
});
