/* Visible supplies and authentic inhabitants, attached only during a room visit. */
(function(root){'use strict';
function attach(s,room,api){
 const T=root.THREE,core=root.BurbzInteriorLifeCore,target=room.target,nav=core.navigation(room.world,room.plan.spawn),group=new T.Group(),actors=new Map(),pickups=[];room.scene.add(group);
 const controls=document.createElement('div');controls.className='il-controls';controls.innerHTML='<button type="button" class="il-use" hidden></button><section class="il-panel" hidden role="dialog" aria-label="Room interaction"><button type="button" class="il-close">Close</button><h2></h2><p></p></section>';s.root.append(controls);
 const useButton=controls.querySelector('.il-use'),panel=controls.querySelector('.il-panel');let nearby=null,last=-Infinity,focus=null,hasRefreshed=false;
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:s.abort.signal});
 function closePanel(){if(panel.hidden)return false;panel.hidden=true;s.uiBusy=false;s.reset();focus?.focus({preventScroll:true});return true;}
 function show(title,body){focus=document.activeElement;s.reset();s.uiBusy=true;panel.hidden=false;panel.querySelector('h2').textContent=title;panel.querySelector('p').textContent=body;panel.querySelector('button').focus({preventScroll:true});}
 on(panel.querySelector('button'),'click',closePanel);
 function disposeObject(o){o.traverse(n=>{n.geometry?.dispose();for(const m of n.material?Array.isArray(n.material)?n.material:[n.material]:[])m.dispose();});o.removeFromParent();}
 const points=nav.spots(core.key(target),14);
 for(const [i,item] of core.finds(target).entries()){const pos=points[i];if(!pos)continue;const b=root.BurbzSettlementModels.batch(T);b.sphere(.19,0,.17,0,0xb59560,[1,.85,.85]);b.cylinder(.065,.12,.12,0,.32,0,0x59412d);b.box(.06,.18,.025,0,.2,.17,0xe6c57d);const mesh=b.finish();mesh.position.set(pos.x,0,pos.z);group.add(mesh);pickups.push({...item,mesh,pos});}
 root.BurbzManga?.styleScene(group);
 function use(){if(!nearby||s.uiBusy||s.failed)return;const item=nearby;
  if(item.person){show(item.person.name,api.talk(target,item.person));return;}
  try{const result=api.collect(target,item.id);if(result){item.mesh.visible=false;show('In your bag',result);}else item.mesh.visible=false;}catch(error){show('Could not save','Your item is still here. '+error.message);}
 }
 on(useButton,'click',use);
 function refresh(time){
  for(const item of pickups)item.mesh.visible=!api.collected(target,item.id);
  const people=api.people(target)||[],present=new Set();
  for(const [personIndex,person] of people.slice(0,12).entries()){present.add(person.id);let a=actors.get(person.id);if(!a){const mesh=person.bird?root.BurbzSettlementModels.bird(T,person):root.BurbzSettlementModels.resident(T,person);mesh.scale.setScalar(person.bird?.8:1);const start=hasRefreshed?room.plan.spawn:points[personIndex+2]||room.plan.spawn;mesh.position.set(start.x,0,start.z);group.add(mesh);root.BurbzManga?.styleScene(mesh);a={person,mesh,pos:{x:start.x,z:start.z},route:[],next:0,cycle:0};actors.set(person.id,a);}a.person=person;a.leaving=false;
   if(!a.route.length&&time>=a.next){const choices=room.plan.props.filter(p=>p.solid);const furniture=choices[(core.hash(person.id)+a.cycle++)%choices.length];const working=/working|training|study|post/i.test(person.activity||'');const spot=working&&furniture?nav.closest({x:furniture.x,z:furniture.z+furniture.d/2+.5}):points[2+(core.hash(person.id)+a.cycle)%Math.max(1,points.length-2)]||room.plan.spawn;a.route=nav.route(a.pos,spot);a.next=time+8+core.hash(person.id)%12;}
  }
  hasRefreshed=true;
  for(const [id,a] of actors)if(!present.has(id)&&!a.leaving){a.leaving=true;a.route=nav.route(a.pos,room.plan.spawn);}
 }
 function update(time){if(time-last>=1){refresh(time);last=time;}let nearestDistance=1.7;nearby=null;
  for(const item of pickups)if(item.mesh.visible){const d=Math.hypot(s.player.x-item.pos.x,s.player.z-item.pos.z);if(d<nearestDistance){nearby=item;nearestDistance=d;}}
  for(const [id,a]of actors){const previous=a.last??time,dt=Math.min(.05,Math.max(0,time-previous));a.last=time;const playerDistance=Math.hypot(s.player.x-a.pos.x,s.player.z-a.pos.z);const blocked=[...actors.values()].some(b=>b!==a&&Math.hypot(b.pos.x-a.pos.x,b.pos.z-a.pos.z)<.42&&String(b.person.id)<String(a.person.id));let moving=false;
   if(a.route.length&&playerDistance>.7&&!blocked&&!s.uiBusy){const next=a.route[0],dx=next.x-a.pos.x,dz=next.z-a.pos.z,d=Math.hypot(dx,dz),step=Math.min(d,dt*.6);if(d<.025)a.route.shift();else{a.pos.x+=dx/d*step;a.pos.z+=dz/d*step;a.mesh.rotation.y=Math.atan2(dx,dz);moving=true;}}
   if(a.leaving&&!a.route.length){disposeObject(a.mesh);actors.delete(id);continue;}
   a.mesh.position.set(a.pos.x,0,a.pos.z);if(playerDistance<1.7&&!moving)a.mesh.rotation.y=Math.atan2(s.player.x-a.pos.x,s.player.z-a.pos.z);
   const state={moving,stride:time*6,mood:a.person.mood||'Content'};root.BurbzSettlementModels[a.person.bird?'animateBird':'animateResident'](a.mesh,state,time,matchMedia('(prefers-reduced-motion: reduce)').matches?0:1);
   if(playerDistance<nearestDistance){nearestDistance=playerDistance;nearby=a;}
  }
  useButton.hidden=!nearby||s.uiBusy;useButton.textContent=nearby?.person?'Talk to '+nearby.person.name+' · E':nearby?'Collect '+nearby.label+' · E':'';
 }
 return{update,closePanel,key(code){if(code==='KeyE'){use();return true;}return false;},diagnostics:()=>({pickups:pickups.map(p=>({id:p.id,...p.pos,visible:p.mesh.visible})),actors:[...actors.values()].map(a=>({id:a.person.id,name:a.person.name,...a.pos,activity:a.person.activity,leaving:a.leaving})),nearby:nearby?.person?.id||nearby?.id}),dispose(){closePanel();disposeObject(group);controls.remove();}};
}
root.BurbzInteriorLife={attach};
})(typeof globalThis!=='undefined'?globalThis:this);
