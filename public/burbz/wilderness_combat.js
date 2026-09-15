/* Borrow the host scene and frame. Only bounded enemies/projectiles belong here.
 * world.safeAt must explicitly return false before ANY hostility is permitted.
 */
(function(root){'use strict';
 const FIREBALL='spell_ember_wisp',MAX_FIRE_PARTICLES=384;
 // One reusable GPU draw for every flame, trail, impact and burning enemy.
 // Analytic trails follow actual projectile direction; no emitter timers or
 // per-frame geometry/material allocations survive the host's lifecycle.
 function createFireEffects(T,scene){
  const geometry=new T.BufferGeometry(),positions=new Float32Array(MAX_FIRE_PARTICLES*3),sizes=new Float32Array(MAX_FIRE_PARTICLES),heats=new Float32Array(MAX_FIRE_PARTICLES),alphas=new Float32Array(MAX_FIRE_PARTICLES);
  for(const [name,array,size] of [['position',positions,3],['size',sizes,1],['heat',heats,1],['alpha',alphas,1]])geometry.setAttribute(name,new T.BufferAttribute(array,size).setUsage(T.DynamicDrawUsage));
  const material=new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.NormalBlending,uniforms:{height:{value:800},time:{value:0}},
   vertexShader:'attribute float size; attribute float heat; attribute float alpha; uniform float height; varying float vHeat; varying float vAlpha; void main(){vec4 p=modelViewMatrix*vec4(position,1.);gl_Position=projectionMatrix*p;gl_PointSize=min(110.,size*height/max(.1,-p.z));vHeat=heat;vAlpha=alpha;}',
   fragmentShader:'uniform float time; varying float vHeat; varying float vAlpha; void main(){vec2 q=gl_PointCoord*2.-1.;float angle=atan(q.y,q.x);float r=length(q);float edge=1.+.075*sin(angle*5.+time*7.+vHeat*6.);float glow=pow(max(0.,1.-r/edge),1.5);if(glow<.015)discard;vec3 red=vec3(1.,.05,.005);vec3 gold=vec3(1.,.48,.035);vec3 white=vec3(1.,.97,.72);vec3 color=mix(red,gold,vHeat);color=mix(color,white,pow(max(0.,1.-r*1.4),1.3)*vHeat);gl_FragColor=vec4(color,glow*vAlpha);}' });
  const points=new T.Points(geometry,material);points.name='Fireball flame and embers';points.frustumCulled=false;scene.add(points);let count=0,time=0,held=0,disposed=false;
  function dot(x,y,z,size,heat,alpha){if(count>=MAX_FIRE_PARTICLES)return;const i=count++;positions[i*3]=x;positions[i*3+1]=y;positions[i*3+2]=z;sizes[i]=size;heats[i]=heat;alphas[i]=alpha;}
  function orb(p,r,t,reduced=false){dot(p.x,p.y,p.z,r*4.2,.5,.5);for(let i=0;i<6;i++){const a=(reduced?0:t*3)+i*Math.PI/3;dot(p.x+Math.cos(a)*r*.5,p.y+Math.sin(a*1.3)*r*.6,p.z+Math.sin(a)*r*.5,r*.9,.8,.6);}dot(p.x,p.y,p.z,r*1.2,1,1);}
  function update({projectiles=[],impacts=[],actors=[],charge=null,dt=0,height=800,aspect=1,fov=62,reduced=false}={}){
   if(disposed)return;time+=Math.min(.1,Math.max(0,dt));count=0;material.uniforms.time.value=reduced?0:time;material.uniforms.height.value=height;
   for(const p of projectiles){if(p.skill.id!==FIREBALL)continue;
    const d=p.direction,length=Math.min(2.8,p.age*(p.skill.projectileSpeed||18)),sideX=d.z,sideZ=-d.x;
    for(let i=1;i<=12;i++){const t=i/12,behind=length*t,wave=Math.sin(i*2.4-time*13)*.1*t,up=Math.cos(i*1.8-time*11)*.08*t;
     dot(p.position.x-d.x*behind+sideX*wave,p.position.y-d.y*behind+up,p.position.z-d.z*behind+sideZ*wave,.48*(1-t*.8),1-t*.85,(1-t*.72)*.9);
    }
    orb(p.position,.14,reduced?0:p.age,reduced);
   }
   for(const p of impacts){if(p.skill.id!==FIREBALL)continue;const fade=Math.max(0,1-p.age/.45),r=.12+p.age*4.5;
    dot(p.position.x,p.position.y,p.position.z,r*2.3,.8,fade*.8);
    for(let i=0;i<9;i++){const a=i*2.39996,y=(i/8-.5)*1.5;dot(p.position.x+Math.cos(a)*r,p.position.y+y*r,p.position.z+Math.sin(a)*r,.28+fade*.35,.7,fade);}
   }
   for(const a of actors){if(!a.burn||a.side!=='opponent'||a.fighter.hp<=0)continue;for(let i=0;i<8;i++){const phase=reduced?i/8:(time*1.8+i*.127)%1,angle=i*2.39996;dot(a.position.x+Math.cos(angle)*.3,a.position.y-.35+phase*.85,a.position.z+Math.sin(angle)*.3,.2+phase*.14,1-phase,(1-phase)*.8);}}
   if(charge){held=reduced?1:Math.min(1,held+Math.max(0,dt));const d=root.BurbzFirstPersonSpellCore.direction(charge),r=.05+Math.min(1,held/.65)*.04,view=.82*Math.tan(fov*Math.PI/360),right=view*Math.min(aspect,1.6)*.52,p={x:charge.x+d.x*.82+Math.cos(charge.yaw)*right,y:charge.y+d.y*.82-view*.42,z:charge.z+d.z*.82-Math.sin(charge.yaw)*right};orb(p,r,time,reduced);for(let i=0;i<8;i++){const a=i*Math.PI/4+(reduced?0:time*2.8),spiral=.05+((i/8+(reduced?0:time*.4))%1)*.065;dot(p.x+Math.cos(a)*spiral,p.y+Math.sin(a)*spiral,p.z+.04*Math.cos(a*2),.07,.9,.7);}}
   else held=0;
   geometry.setDrawRange(0,count);for(const attr of Object.values(geometry.attributes))attr.needsUpdate=true;points.visible=count>0;
  }
  function clear(){count=held=0;geometry.setDrawRange(0,0);points.visible=false;}
  clear();return{update,clear,diagnostics:()=>({particles:count,capacity:MAX_FIRE_PARTICLES,draws:count?1:0}),dispose(){if(disposed)return;disposed=true;clear();points.removeFromParent();geometry.dispose();material.dispose();}};
 }

 function attach(s){
  const host=s.root||s.host,scene=s.source?.scene||s.scene,T=root.THREE,adapter=(s.options||s.opts)?.character?.()?.combat;
  if(!host||!scene||!adapter)return null;
  const events=new AbortController(),on=(el,name,fn,opts={})=>el.addEventListener(name,fn,{...opts,signal:events.signal}),group=new T.Group();group.name='Wilderness encounters';scene.add(group);host.classList.add('wc-ready');
  const player=()=>s.player||s.p,world=()=>s.world,pose=()=>({...player(),y:player().y+1.55});
  const uiBlocked=()=>s.closed||s.failed||s.uiBusy||s.busy||s.panel&&!s.panel.hidden||document.hidden;
  const paused=()=>uiBlocked()||s.room||s.options?.room||s.flight;
  const localWorld=s.options?.continuousWorld,ground=(x,z)=>world()?.height?.(x,z)??null;
  const boundary=localWorld&&root.BurbzGeographicWorldCore?root.BurbzWildernessCombatCore.boundaries({G:root.BurbzGeographicWorldCore,origin:localWorld.record,anchor:localWorld.anchor,radius:scene.userData.walkSurface?.radius||world()?.authoredRadius||world()?.radius||0,ground,lookup:adapter.settlementsInBounds}):null;
  let outposts=null;
  const territory=root.BurbzWildernessCombatCore.territoryBoundary({G:root.BurbzGeographicWorldCore,origin:()=>s.origin||localWorld?.record,light:adapter.territoryLight});
  const safeAt=(x,z)=>territory.safeAt(x,z)?true:(s.room||s.options?.room)?true:(world()?.safeAt?world().safeAt(x,z)!==false:boundary?boundary.safeAt(x,z):true);
  const allowed=(x,z,y)=>(world()?.combatAllowed3||world()?.allowed3)&&Number.isFinite(y)?(world().combatAllowed3||world().allowed3)(x,y,z):!!world()?.allowed?.(x,z);
  const clear=(a,b)=>{if(world()?.clear)return !!world().clear(a,b);const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z)/.2));for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;const y=a.y+(b.y-a.y)*t,h=ground(x,z);if(!allowed(x,z,y)||h===null||y<=h+.08)return false;}return true;};
  // Birds share the player's ground collision, so foliage overhead blocks shots,
  // not pursuit or a body peck. Trunks, buildings, water and unknown ground still block.
  const walkClear=(a,b)=>{const n=Math.max(1,Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.2));for(let i=0;i<=n;i++){const t=i/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t,h=ground(x,z);if(!world()?.allowed?.(x,z)||h===null||a.y+(b.y-a.y)*t<=h+.08)return false;}return true;};
  const hud=document.createElement('div');hud.className='wc-hud';hud.innerHTML='<div class="wc-vitals"><span class="wc-zone">Safe territory</span><span class="wc-health"></span><span class="wc-meter"><i></i></span></div><div class="wc-loadout"><button type="button" class="wc-weapon" aria-pressed="true" title="Use equipped weapon (1)">Weapon</button><button type="button" class="wc-spell" aria-pressed="false" title="Use equipped spell (2)">Spell</button><button type="button" class="wc-potion" title="Drink equipped potion (P)" aria-label="Drink equipped potion">♜</button></div><small class="wc-attack-name"></small>';host.append(hud);
  const toast=document.createElement('div');toast.className='wc-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');toast.hidden=true;host.append(toast);let toastUntil=0;
  function notice(text){toast.textContent=text;toast.hidden=false;toastUntil=performance.now()+3800;}
  outposts=root.BurbzEnemyOutposts?.attach(s,{adapter,safeAt,ground,allowed,clear,walkClear,notice});
  const core=root.BurbzWildernessCombatCore.create({B:root.BurbzBattleCore,L:root.BurbzLootCore,C:root.BurbzFirstPersonSpellCore,...adapter,encounter:p=>outposts?.encounter(p),safeAt,safeSegment:territory.firstHit,refugeAt:(x,z)=>!!(s.room||s.options?.room)||world()?.refugeAt?.(x,z)===true||(!world()?.refugeAt&&boundary?boundary.refugeAt(x,z):!world()?.safeAt&&!s.p&&!boundary),ground,allowed,clear,walkClear,key:(x,z)=>world()?.combatKey?.(x,z)||boundary?.key(x,z)||String(s.options?.seed||'unknown')+':'+x+':'+z,notice});
  const audio=root.BurbzCombatAudio,stopCharge=()=>audio?.stop('fireballCharge');
  function cancelCast(){core.cancel();stopCharge();}
  function beginCast(){if(paused()||!core.begin(pose()))return false;if(core.charging()===FIREBALL)audio?.play('fireballCharge',{loop:true,maxPolyphony:1});return true;}
  function releaseCast(p){const fire=core.charging()===FIREBALL;stopCharge();const released=core.release(p);if(released&&fire)audio?.play('fireballCast',{maxPolyphony:2});return released;}
  const controls=root.BurbzFirstPersonCastControls.attach({host,look:s.look||host.querySelector('.vw-look'),signal:events.signal,pose,blocked:uiBlocked,begin:beginCast,cast:releaseCast,cancel:cancelCast,castAimScale:()=>core.charging()===FIREBALL?.5:1,aim:(dx,dy,k)=>{const p=player();p.yaw-=dx*k;p.pitch=Math.max(-1.1,Math.min(1.1,p.pitch-dy*k));s.dirty=true;}});
  const climb=host.querySelector('.cw-wings')&&host.querySelector('button[aria-label="Climb"]'),descend=host.querySelector('.cw-wings')&&host.querySelector('button[aria-label="Descend"]');climb?.classList.add('wc-climb');descend?.classList.add('wc-descend');
  const travel=host.querySelector('.cw-wings'),travelParent=travel?.parentNode,travelNext=travel?.nextSibling;if(travel){const row=document.createElement('div');row.className='wc-travel';row.append(travel);hud.append(row);}
  const weapon=hud.querySelector('.wc-weapon'),spell=hud.querySelector('.wc-spell'),potion=hud.querySelector('.wc-potion');
  function mode(value){controls.reset();core.setMode(value);updateHUD();}
  on(weapon,'click',()=>mode('weapon'));on(spell,'click',()=>mode('spell'));on(potion,'click',()=>{controls.reset();if(!core.potion())notice('That potion cannot be used right now.');updateHUD();});
  on(document,'keydown',e=>{if(paused()||e.repeat||e.ctrlKey||e.altKey||e.metaKey||/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))return;if(e.code==='Digit1'||e.code==='Digit2'){e.preventDefault();mode(e.code==='Digit1'?'weapon':'spell');}if(e.code==='KeyP'){e.preventDefault();potion.click();}},{capture:true});
  const geometry={ball:new T.SphereGeometry(.14,8,6),burst:new T.SphereGeometry(1,12,8),shaft:new T.CylinderGeometry(.018,.018,.85,5),tip:new T.ConeGeometry(.055,.17,4),fletch:new T.PlaneGeometry(.15,.2)},materials={};
  const birdArt=root.BurbzWildernessBirds.create(T),motion=matchMedia('(prefers-reduced-motion: reduce)');
  const zombie=new Map(),shots=new Map(),bursts=new Map(),fireFX=createFireEffects(T,group);let heardImpacts=new Set();
  function syncBirds(){const ids=new Set(core.actors.filter(a=>a.fighter.hp>0).map(a=>a.id));for(const [id,m]of zombie)if(!ids.has(id)){birdArt.remove(m);zombie.delete(id);}for(const a of core.actors){if(a.fighter.hp<=0)continue;let m=zombie.get(a.id);if(!m){m=birdArt.bird(a.enemyKind);group.add(m);zombie.set(a.id,m);}birdArt.update(m,a,player(),motion.matches);}}
  const color=id=>id==='reed_bow'?0xd4bf8e:id==='spell_frost_sigil'?0x9be8f6:id==='spell_tempest_scroll'?0xc6acff:/mending|phoenix/.test(id)?0xb3f1ae:0xffb247;
  function fxmat(id,burst){const name=id+burst;return materials[name]||=(new T.MeshBasicMaterial({color:color(id),transparent:!!burst,opacity:burst?.6:1,depthWrite:!burst,wireframe:!!burst}));}
  const axis=new T.Vector3(0,1,0),heading=new T.Vector3();
  function arrow(){const g=new T.Group(),wood=materials.arrowWood||=(new T.MeshLambertMaterial({color:0xbca177})),metal=materials.arrowTip||=(new T.MeshLambertMaterial({color:0xc8cfca})),feather=materials.arrowFeather||=(new T.MeshLambertMaterial({color:0xe6d9b2,side:T.DoubleSide}));g.add(new T.Mesh(geometry.shaft,wood));const tip=new T.Mesh(geometry.tip,metal);tip.position.y=.48;g.add(tip);for(let i=0;i<2;i++){const f=new T.Mesh(geometry.fletch,feather);f.position.y=-.33;f.rotation.y=i*Math.PI/2;g.add(f);}return g;}
  function syncFX(list,pool,burst){list=list.filter(p=>p.skill.id!==FIREBALL);const ids=new Set(list.map(p=>p.id));for(const [id,m]of pool)if(!ids.has(id)){m.removeFromParent();pool.delete(id);}for(const p of list){let m=pool.get(p.id);if(!m){m=!burst&&p.skill.projectile==='arrow'?arrow():new T.Mesh(burst?geometry.burst:geometry.ball,fxmat(p.skill.id,burst));group.add(m);pool.set(p.id,m);}m.position.set(p.position.x,p.position.y,p.position.z);if(!burst&&p.skill.projectile==='arrow'){const speed=p.skill.projectileSpeed||26;heading.set(p.direction.x*speed,p.direction.y*speed-(p.fall||0),p.direction.z*speed).normalize();m.quaternion.setFromUnitVectors(axis,heading);}if(burst)m.scale.setScalar(.2+p.age*(p.skill.splash?6:2));}}

  let clock=0,elapsed=0,disposed=false,hurtUntil=0,lastUpdate=null;const updateTimes=[];
  function updateHUD(){const d=core.inspect(),k=adapter.kit().loadout,L=root.BurbzLootCore;const foe=d.actors.filter(a=>a.fighter.hp>0).sort((a,b)=>Number(b.phase==='windup')-Number(a.phase==='windup')||Math.hypot(a.position.x-player().x,a.position.z-player().z)-Math.hypot(b.position.x-player().x,b.position.z-player().z))[0];hud.querySelector('.wc-zone').textContent=d.safe?'Safe territory':d.hero.hp<=0?'Wounded · return to safety':foe?(foe.phase==='windup'?(foe.aerial?'Dive incoming · ':'Peck incoming · '):'')+foe.fighter.name:'Wilderness';hud.querySelector('.wc-health').textContent=Math.ceil(d.hero.hp)+' / '+d.hero.maxHp+' HP'+(d.hero.barrier?' +'+d.hero.barrier+' shield':'');hud.querySelector('.wc-meter i').style.width=d.state.cr+'%';weapon.setAttribute('aria-pressed',String(d.mode==='weapon'));spell.setAttribute('aria-pressed',String(d.mode==='spell'));weapon.disabled=!k.weapon;spell.disabled=!k.spell;potion.disabled=!core.canPotion();potion.title=(L.gearById(k.potion)?.label||'Equip a potion')+' (P)';potion.setAttribute('aria-label',potion.title);if(L.gearById(k.potion)?.icon)potion.textContent=L.gearById(k.potion).icon;else potion.innerHTML='<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M9 3h6M10 3v7l-5 8a2 2 0 0 0 2 3h10a2 2 0 0 0 2-3l-5-8V3M8 15h8"/></svg>';const ammo=d.skill?.ammo;const cd=d.mode==='spell'?d.state.cooldowns[k.spell]||0:0;hud.querySelector('.wc-attack-name').textContent=(d.skill?.label||'Equip in Satchel')+(ammo?' · '+(adapter.kit().ammo?.[ammo]||0)+' arrows':'')+(cd?' · '+Math.max(1,Math.ceil((cd*100-d.state.beat)/Math.max(1,root.BurbzBattleCore.effStat(d.hero,'spd'))))+'s':!d.safe?' · hold / release':'');host.querySelector('.fp-cast-stick').setAttribute('aria-label',(d.skill?.label||'Attack')+'. Hold to aim; release to attack. Q or right mouse.');hud.hidden=!!uiBlocked()||!!s.room||!!s.options?.room||!!s.flight;hud.classList.toggle('wc-flying',player()?.mode==='fly');host.classList.toggle('wc-paused',!!uiBlocked());host.classList.toggle('wc-noncombat',!!paused()&&!uiBlocked());}
  function update(dt){if(disposed)return;const started=performance.now(),burnElapsed=lastUpdate===null?0:(started-lastUpdate)/1000;lastUpdate=started;elapsed+=Math.min(.05,dt);boundary?.refresh(player(),elapsed);outposts?.update(dt);if(paused()||!core.charging())controls.cancelCast();controls.update(dt);core.step(dt,pose(),{paused:!!paused(),elapsed:burnElapsed});if(!core.charging())controls.cancelCast();syncBirds();syncFX(core.engine.projectiles,shots,false);syncFX(core.engine.impacts,bursts,true);
   if(paused()){fireFX.clear();stopCharge();heardImpacts.clear();}
   else {fireFX.update({projectiles:core.engine.projectiles,impacts:core.engine.impacts,actors:core.actors,charge:controls.state().casting&&core.charging()===FIREBALL?pose():null,dt,height:host.clientHeight*(s.source?.renderer?.getPixelRatio?.()||Math.min(2,root.devicePixelRatio||1)),aspect:host.clientWidth/Math.max(1,host.clientHeight),fov:s.source?.camera?.fov||62,reduced:motion.matches});const hits=core.engine.impacts.filter(p=>p.skill.id===FIREBALL);for(const hit of hits)if(!heardImpacts.has(hit))audio?.play('fireballImpact',{maxPolyphony:2});heardImpacts=new Set(hits);}
   clock+=dt;if(clock>.15){clock=0;updateHUD();}if(performance.now()>toastUntil)toast.hidden=true;if(core.events.length){const list=core.events.splice(0);const hurt=list.filter(e=>e.type==='damage'&&e.side==='player').reduce((n,e)=>n+e.dmg,0);if(hurt){notice('−'+hurt+' HP · reach lit territory for safety');hurtUntil=performance.now()+450;}else{const dealt=list.filter(e=>e.type==='damage'&&e.side==='opponent');if(dealt.length)notice(dealt.map(e=>(e.status==='burn'?'Burn ':e.splash?'Splash ':'')+e.dmg).join(' · ')+(dealt.some(e=>e.hp<=0)?' · Shadow scattered':''));}}host.classList.toggle('wc-hurt',performance.now()<hurtUntil);s.map?.triggerRepaint();updateTimes.push(performance.now()-started);if(updateTimes.length>180)updateTimes.shift();}
  function reset(){lastUpdate=null;controls.reset();core.reset();fireFX.clear();heardImpacts.clear();for(const name of ['fireballCharge','fireballCast','fireballImpact'])audio?.stop(name);}
  function dispose(){if(disposed)return;disposed=true;reset();fireFX.dispose();controls.dispose();core.dispose();outposts?.dispose();adapter.outposts?.dispose();boundary?.dispose();events.abort();group.removeFromParent();birdArt.dispose();for(const g of Object.values(geometry))g.dispose();for(const m of Object.values(materials))m.dispose();zombie.clear();shots.clear();bursts.clear();climb?.classList.remove('wc-climb');descend?.classList.remove('wc-descend');if(travel?.isConnected&&travelParent?.isConnected)travelParent.insertBefore(travel,travelNext?.parentNode===travelParent?travelNext:null);hud.remove();toast.remove();host.classList.remove('wc-ready','wc-paused','wc-noncombat','wc-hurt');}
  s.abort.signal.addEventListener('abort',dispose,{once:true});updateHUD();
  function rebase(dx,dz){controls.cancelCast();stopCharge();fireFX.clear();heardImpacts.clear();core.rebase(dx,dz);}
  return{update,reset,dispose,isDead:core.isDead,blocked:(x,y,z)=>outposts?.blocked(x,y,z)||false,mapPoints:()=>outposts?.mapPoints()||[],rebase,diagnostics:()=>({...core.inspect(),outposts:outposts?.diagnostics(),boundary:boundary?.inspect(),art:birdArt.diagnostics(),updateMs:updateTimes.slice(),input:controls.state(),fire:fireFX.diagnostics(),meshes:{zombies:zombie.size,shots:shots.size,bursts:bursts.size}})};
 }
 root.BurbzWildernessCombat={attach,createFireEffects,MAX_FIRE_PARTICLES};
})(globalThis);
