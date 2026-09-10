/* Walking encounters. No map/renderer, inventory copy, battle-mode or quest rewards.
 * One battle-readiness unit per second: SPD 40 refills 100 CR in 2.5 seconds.
 * Scroll cooldowns and temporary effects tick once per full readiness beat.
 * A released attack spends CR and cooldown even on a miss; scrolls are durable.
 */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.BurbzWildernessCombatCore=api;})(globalThis,function(){
 'use strict';
 const MAX_ZOMBIES=4,MAX_RECORDS=64,CELL=48,SPLASH_RADIUS=3,MELEE_REACH=2.4;
 const clone=x=>structuredClone(x),clamp=(x,a,b)=>Math.max(a,Math.min(b,Number(x)||0)),distance=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z),hash=s=>{let n=2166136261;for(const c of String(s))n=Math.imul(n^c.charCodeAt(0),16777619);return n>>>0;};
 // Settlement safety for a retained local scene. This reads canonical records;
 // it does not render terrain, change GPS or claim/discover settlements.
 function boundaries({G,origin,anchor,radius=0,ground,lookup}){
  let records=[],centre=null,pending=false,known=false,closed=false,retry=0;
  const geo=(x,z)=>G.unproject(origin,{x,y:0,z});
  function refugeAt(x,z){if(Math.hypot(x,z)<=radius+20)return true;const p=geo(x,z);if(!p)return false;if(anchor&&G.validCoordinate(anchor)&&G.distance(p,anchor)<80)return true;return records.some(r=>G.distance(p,r)<(r.tier==='city'?600:r.tier==='town'?350:180));}
  function safeAt(x,z){const p=geo(x,z);return refugeAt(x,z)||!known||!p||!centre||G.distance(p,centre)>180||!Number.isFinite(ground(x,z));}
  async function refresh(p,time){if(closed||pending||typeof lookup!=='function'||time<retry)return;const at=geo(p.x,p.z);if(!at||known&&centre&&G.distance(at,centre)<80)return;pending=true;const dy=5000/111320,dx=dy/Math.max(.087,Math.cos(at.lat*Math.PI/180));try{const result=await lookup({west:at.lon-dx,east:at.lon+dx,south:Math.max(-G.MAX_LAT,at.lat-dy),north:Math.min(G.MAX_LAT,at.lat+dy),center:at});if(closed)return;if(!Array.isArray(result))throw Error('Unknown settlements');records=result.filter(r=>G.validCoordinate(r)).slice(0,64);centre=at;known=true;}catch(_){known=false;retry=time+5;}finally{pending=false;}}
  return{safeAt,refugeAt,refresh,key:(x,z)=>{const p=geo(x,z);return p?'walk:'+Math.round(p.lat*1e6)+':'+Math.round(p.lon*1e6):'unknown';},inspect:()=>({known,pending,centre,settlements:records.length}),dispose(){closed=true;records=[];}};
 }
 function create({B,L,C,profile={},kit=()=>({}),stored,save=()=>true,safeAt=()=>true,refugeAt=()=>false,ground=()=>null,allowed=()=>false,clear=()=>false,key=(x,z)=>x+':'+z,notice=()=>{}}){
  const initial={version:1,hp:80,barrier:0,mods:[],cr:100,beat:0,cooldowns:{},rngState:hash(profile.name||'keeper'),records:[],potionCrCarry:0,potionUsed:false};
  let state={...initial,...clone(stored||{})},hero,signature='',pending=null,mode='weapon',safe=null,closed=false,saveClock=0,spawnClock=0,serial=0,error='',lastPose=null;
  state.hp=clamp(state.hp,0,10000);state.cr=clamp(state.cr,0,100);state.beat=clamp(state.beat,0,99.999);state.barrier=clamp(state.barrier,0,10000);state.mods=(Array.isArray(state.mods)?state.mods:[]).filter(m=>m&&['atk','mag','def','res','spd','int','cha'].includes(m.stat)&&Number.isFinite(m.pct)&&Number.isFinite(m.turns)).slice(-16).map(m=>({stat:m.stat,pct:clamp(m.pct,-.8,1),turns:Math.max(1,clamp(m.turns,1,4))}));state.potionUsed=state.potionUsed===true;
  state.cooldowns=Object.fromEntries(Object.entries(state.cooldowns||{}).filter(([id])=>L.gearById(id)?.slot==='spell').map(([id,n])=>[id,clamp(n,0,4)]));state.records=(Array.isArray(state.records)?state.records:[]).filter(r=>typeof r.id==='string'&&Number.isFinite(r.hp)).slice(-MAX_RECORDS);
  const actors=[],events=[];
  function sync(){const k=kit(),sig=JSON.stringify(k);if(sig===signature)return;signature=sig;hero=B.buildFighter({id:'@player',commonName:profile.name||'Keeper',species:'Keeper',level:profile.level||1},{gear:L.equipmentBonuses(k.loadout||{},{gearLevel:k.gearLevel})});hero.hp=Math.min(hero.maxHp,state.hp);hero.barrier=Math.min(state.barrier,hero.maxHp);hero.mods=clone(state.mods);hero.fainted=hero.hp<=0;hero.potionCrCarry=state.potionCrCarry||0;state.hp=hero.hp;pending=null;}
  function capture(){state.hp=hero.hp;state.barrier=hero.barrier;state.mods=clone(hero.mods).slice(-16);state.potionCrCarry=hero.potionCrCarry||0;return clone(state);}
  function transaction(fn,extra){const before=capture(),h=clone(hero),a=clone(actors);try{const result=fn();if(save(capture(),extra)===false)throw Error('Could not save');error='';return result??true;}catch(e){state=before;Object.assign(hero,h);actors.splice(0,actors.length,...a);pending=null;error='Combat could not save. Retry when storage is available.';notice(error);return false;}}
  function checkpoint(){return transaction(()=>true);}
  function hostile(p){return !!p&&safeAt(p.x,p.z)===false&&Number.isFinite(ground(p.x,p.z));}
  function skill(){sync();const k=kit().loadout||{};if(mode==='spell')return L.spellSkillFor(k.spell);const item=L.gearById(k.weapon);return item?.slot==='weapon'?{...(item.kind==='wand'?B.SPARK:B.PECK),id:item.id,label:item.label,melee:item.kind!=='wand'}:null;}
  function readiness(){const s=skill(),k=kit().loadout||{};return !!s&&!closed&&!safe&&hero.hp>0&&state.cr>=100&&!(mode==='spell'&&state.cooldowns[k.spell]>0)&&engine.projectiles.length<C.MAX_PROJECTILES;}
  function remember(actor){state.records=state.records.filter(r=>r.id!==actor.id);state.records.push({id:actor.id,hp:actor.fighter.hp});if(state.records.length>MAX_RECORDS)state.records.shift();}
  function targets(){return actors.filter(a=>a.side==='opponent'&&hostile(a.position)&&a.fighter.hp>0);}
  function blockedSegment(a,b){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z)/.16));for(let i=0;i<=n;i++){const t=i/n,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t,z:a.z+(b.z-a.z)*t},h=ground(p.x,p.z);if(!hostile(p)||h===null||p.y<=h+.08||!allowed(p.x,p.z,p.y))return t;}if(!clear(a,b))return 0;return null;}
  function impact({projectile:p,target,position}){if(safe||!hostile(position))return;const hits=[];for(const a of targets()){const primary=a.id===target?.id;if(!primary&&(!p.skill.splash||Math.hypot(a.position.x-position.x,a.position.y-position.y,a.position.z-position.z)>SPLASH_RADIUS))continue;if(!clear(position,a.position))continue;hits.push({fighter:a.fighter,scale:primary?1:p.skill.splash});}
   if(!hits.length)return;let result=[];if(transaction(()=>{result=B.resolveExplorationSkill(state,p.token.attacker,p.skill,hits);for(const a of actors)if(hits.some(h=>h.fighter===a.fighter))remember(a);}))events.push(...result);}
  const engine=C.create({targets,obstacle:blockedSegment,valid:()=>!safe&&!closed,impact});
  function begin(pose){sync();if(pose){safe=!hostile(pose);lastPose=pose;}if(!readiness()){notice(safe?'Settlements are safe.':hero.hp<=0?'Wounded — return to a settlement.':!skill()?'Equip a weapon or spell in your Satchel.':'Attack is recharging.');return false;}pending={mode,id:skill().id};return true;}
  function cancel(){pending=null;}
  function release(pose){sync();safe=!hostile(pose);const s=skill(),k=kit().loadout||{};if(!pending||pending.mode!==mode||pending.id!==s?.id||!readiness()||![pose.x,pose.y,pose.z,pose.yaw,pose.pitch].every(Number.isFinite)){cancel();return false;}pending=null;const token={id:++serial,attacker:clone(hero)};let result=[];
   if(!transaction(()=>{state.cr=clamp(hero.potionCrCarry,0,99.5);state.beat=0;hero.potionCrCarry=0;if(mode==='spell')state.cooldowns[k.spell]=s.cd||0;if(s.kind==='heal')result=B.resolveExplorationSkill(state,hero,s);}))return false;
   events.push({type:'release',skill:s.id},...result);if(engine.impacts.length>=C.MAX_IMPACTS)engine.impacts.shift();
   if(s.kind==='heal'){engine.impacts.push({id:token.id,position:{...pose},skill:s,age:0});return true;}
   if(s.melee){const d=C.direction(pose),b={x:pose.x+d.x*MELEE_REACH,y:pose.y+d.y*MELEE_REACH,z:pose.z+d.z*MELEE_REACH};let hit=blockedSegment(pose,b),target=null;for(const a of targets()){const t=C.sphereHit(pose,b,a.position,a.radius+.25);if(t!==null&&(hit===null||t<hit)){hit=t;target=a;}}const t=hit??1,position={x:pose.x+(b.x-pose.x)*t,y:pose.y+(b.y-pose.y)*t,z:pose.z+(b.z-pose.z)*t};engine.impacts.push({id:token.id,position,skill:s,age:0});if(target)impact({projectile:{skill:s,token},target,position});return true;}
   return !!engine.launch(pose,s,token);
  }
  function canPotion(){sync();return !closed&&state.cr>=100&&!state.potionUsed&&B.canUsePotionEffect(hero,L.potionEffectFor(kit().loadout?.potion));}
  function potion(){sync();const id=kit().loadout?.potion,effect=L.potionEffectFor(id);if(!canPotion())return false;return transaction(()=>{state.potionUsed=true;const count=hero.mods.length;B.applyPotionEffect(hero,effect);hero.mods=hero.mods.map((m,i)=>i<count?m:({...m,turns:Math.max(1,m.turns-1)}));},{potion:id});}
  function spawn(pose){const cx=Math.floor(pose.x/CELL),cz=Math.floor(pose.z/CELL),cells=[];
   for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++){const x=(cx+dx)*CELL,z=(cz+dz)*CELL,base=String(key(x,z)),seed=hash(base);cells.push({base,x:x+8+seed%32,z:z+8+(seed>>>8)%32});}
   cells.sort((a,b)=>distance(a,pose)-distance(b,pose));
   for(const cell of cells)for(let member=0;member<2;member++){if(actors.length>=MAX_ZOMBIES)return;const id=cell.base+':'+member,p={x:cell.x+(member?1.1:-1.1),z:cell.z},d=distance(p,pose);if(d<12||d>65||!hostile(p)||!allowed(p.x,p.z)||actors.some(a=>a.id===id))continue;const receipt=state.records.find(r=>r.id===id);if(receipt?.hp<=0)continue;p.y=ground(p.x,p.z)+.85;const fighter=B.buildFighter({id,commonName:'Zombie Burbz',species:'Crow',hp:80,maxHp:80});fighter.hp=receipt?clamp(receipt.hp,0,80):80;actors.push({id,side:'opponent',position:p,radius:.65,fighter,cr:0,home:{...p},age:0});}
  }
  function step(dt,pose,{paused=false}={}){if(closed)return;sync();dt=clamp(dt,0,.05);lastPose={...pose};const nextSafe=!hostile(pose);if(nextSafe!==safe){safe=nextSafe;cancel();engine.clear();actors.length=0;if(safe&&refugeAt(pose.x,pose.z))transaction(()=>{hero.hp=hero.maxHp;hero.fainted=false;hero.barrier=0;hero.mods=[];});}if(paused){cancel();engine.clear();return;}if(safe)return;
   const rate=Math.max(1,B.effStat(hero,'spd'));state.cr=Math.min(100,state.cr+dt*rate);state.beat+=dt*rate;if(state.beat>=100){state.beat-=100;state.potionUsed=false;for(const id of Object.keys(state.cooldowns))state.cooldowns[id]=Math.max(0,state.cooldowns[id]-1);hero.mods=hero.mods.map(m=>({...m,turns:m.turns-1})).filter(m=>m.turns>0);}
   if(hero.hp<=0){engine.clear();actors.length=0;return;}spawnClock+=dt;if(spawnClock>.75){spawnClock=0;spawn(pose);}
   for(let i=actors.length-1;i>=0;i--){const a=actors[i];if(a.side!=='opponent')continue;if(!hostile(a.position)||a.fighter.hp<=0||distance(a.position,pose)>90){actors.splice(i,1);continue;}a.age+=dt;const d=distance(a.position,pose),speed=Math.max(.5,B.effStat(a.fighter,'spd')/40)*1.3;if(d<32&&d>1.5){const heading=Math.atan2(pose.z-a.position.z,pose.x-a.position.x),hand=hash(a.id)%2?1:-1;for(const angle of [0,hand*.9,-hand*.9]){const q={x:a.position.x+Math.cos(heading+angle)*speed*dt,z:a.position.z+Math.sin(heading+angle)*speed*dt};if(hostile(q)&&allowed(q.x,q.z)&&clear(a.position,{...q,y:ground(q.x,q.z)+.85})){a.position={...q,y:ground(q.x,q.z)+.85};break;}}}
    a.cr+=dt*Math.max(1,B.effStat(a.fighter,'spd'));if(a.cr>=100){a.cr=0;a.fighter.mods=a.fighter.mods.map(m=>({...m,turns:m.turns-1})).filter(m=>m.turns>0);if(d<=1.6&&hostile(pose)&&clear(a.position,pose)){let result=[];if(transaction(()=>{result=B.resolveExplorationSkill(state,a.fighter,B.PECK,[{fighter:hero}], 'opponent');}))events.push(...result);}}
   }
   engine.step(dt);saveClock+=dt;if(saveClock>=2){saveClock=0;checkpoint();}if(events.length>32)events.splice(0,events.length-32);
  }
  function reset(){cancel();engine.clear();if(hero)checkpoint();}
  sync();
  return{begin,release,cancel,potion,canPotion,step,reset,checkpoint,engine,actors,events,setMode(value){if(value==='weapon'||value==='spell'){cancel();mode=value;}},snapshot:()=>capture(),inspect(){sync();return{hero:clone(hero),state:capture(),mode,skill:skill(),ready:readiness(),safe,error,actors:clone(actors),projectiles:clone(engine.projectiles),impacts:clone(engine.impacts)};},dispose(){if(closed)return;reset();closed=true;actors.length=0;},rebase(dx,dz){cancel();engine.clear();for(const a of actors){a.position.x-=dx;a.position.z-=dz;}}};
 }
 return{create,boundaries,MAX_ZOMBIES,MAX_RECORDS,CELL,SPLASH_RADIUS,MELEE_REACH};
});
