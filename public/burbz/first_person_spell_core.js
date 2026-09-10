/* Bounded swept projectiles. Combat authority belongs to the provided battle adapter. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzFirstPersonSpellCore=api;})(globalThis,function(){
 'use strict';const MAX_PROJECTILES=8,MAX_IMPACTS=16,SPEED=18,TTL=3,RADIUS=.14;
 const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
 function direction(pose){const c=Math.cos(pose.pitch);return{x:-Math.sin(pose.yaw)*c,y:Math.sin(pose.pitch),z:-Math.cos(pose.yaw)*c};}
 function sphereHit(a,b,center,radius){const d={x:b.x-a.x,y:b.y-a.y,z:b.z-a.z},q={x:a.x-center.x,y:a.y-center.y,z:a.z-center.z},aa=d.x*d.x+d.y*d.y+d.z*d.z,bb=q.x*d.x+q.y*d.y+q.z*d.z,cc=q.x*q.x+q.y*q.y+q.z*q.z-radius*radius;if(cc<=0)return 0;if(aa===0)return null;const discriminant=bb*bb-aa*cc;if(discriminant<0)return null;const t=(-bb-Math.sqrt(discriminant))/aa;return t>=0&&t<=1?t:null;}
 const point=(a,b,t)=>({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t});
 function create({targets=()=>[],obstacle=()=>null,impact=()=>{},valid=()=>true}={}){
  const projectiles=[],impacts=[];let serial=0;
  function launch(pose,skill,token){if(projectiles.length>=MAX_PROJECTILES||!skill||![pose.x,pose.y,pose.z,pose.yaw,pose.pitch].every(Number.isFinite))return null;const p={id:++serial,position:{x:pose.x,y:pose.y,z:pose.z},direction:direction(pose),skill:structuredClone(skill),token,age:0};projectiles.push(p);return p;}
  function step(dt){dt=clamp(Number(dt)||0,0,.1);for(let i=projectiles.length-1;i>=0;i--){const p=projectiles[i];if(!valid(p.token)){projectiles.splice(i,1);continue;}const a=p.position,b={x:a.x+p.direction.x*SPEED*dt,y:a.y+p.direction.y*SPEED*dt,z:a.z+p.direction.z*SPEED*dt};let hit=obstacle(a,b,RADIUS),target=null;hit=Number.isFinite(hit)&&hit>=0&&hit<=1?hit:null;
   for(const t of targets().slice(0,32)){if(t.side!=='opponent'||t.fighter?.fainted||!(t.fighter?.hp>0))continue;const h=sphereHit(a,b,t.position,(t.radius||.5)+RADIUS);if(h!==null&&(hit===null||h<hit)){hit=h;target=t;}}
   p.age+=dt;p.position=point(a,b,hit??1);if(hit!==null||p.age>=TTL){projectiles.splice(i,1);if(hit!==null){const fx={id:p.id,position:{...p.position},skill:p.skill,age:0};impacts.push(fx);if(impacts.length>MAX_IMPACTS)impacts.shift();impact({projectile:p,target,position:{...p.position}});}}
  }for(let i=impacts.length-1;i>=0;i--){impacts[i].age+=dt;if(impacts[i].age>.45)impacts.splice(i,1);}}
  return{launch,step,projectiles,impacts,clear(){projectiles.length=impacts.length=0;}};
 }
 // Adapter for EXISTING turn-based battles. No mana, ammo, wall-clock cooldown,
 // new damage formula, faction or reward authority is introduced. Resolution
 // waits for the visible impact and still validates the live acting turn.
 function battleAdapter(B,battle,skillIndex){
  const actor=()=>battle.acting?battle.teams[battle.acting.side]?.[battle.acting.index]:null;
  let pending=null;
  function ready(){const f=actor(),skill=f?.skills[skillIndex];return !pending&&battle.phase==='act'&&battle.acting?.side==='player'&&skill&&B.skillUsable(f,skill);}
  function begin(){if(!ready())return null;const f=actor();pending={fighter:f,turn:battle.turn,skill:f.skills[skillIndex]};return pending;}
  function valid(token){return token&&token===pending&&battle.phase==='act'&&actor()===token.fighter&&battle.turn===token.turn&&token.fighter.skills[skillIndex]===token.skill&&B.skillUsable(token.fighter,token.skill);}
  function resolve(token,targetIndex){if(!valid(token))return {ok:false,events:[]};if(token.skill.kind==='attack'&&!B.attackTargets(battle,token.skill,targetIndex).length)return {ok:false,events:[]};const events=B.resolveAction(battle,{skillIndex,targetIndex,aimed:token.skill.kind==='attack'});pending=null;return {ok:true,events};}
  return{ready,begin,valid,resolve,cancel(){pending=null;}};
 }
 return{create,direction,sphereHit,battleAdapter,MAX_PROJECTILES,MAX_IMPACTS,SPEED,TTL,RADIUS};
});
