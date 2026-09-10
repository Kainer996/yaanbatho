/* Doors connect existing buildings to disposable indoor scenes on the same canvas. */
(function(root){'use strict';
function attach(s){
 const T=root.THREE,core=root.BurbzBuildingRoomsCore,api=s.options.interiors;
 const doorButton=document.createElement('button');doorButton.className='vr-door';doorButton.type='button';doorButton.hidden=true;
 const service=document.createElement('button');service.className='vr-service';service.type='button';service.hidden=true;s.root.append(doorButton,service);
 let life=null,room=null,outside=null,nearest=null,last=-1;const doors=[];
 function valid(t){return api?.describe(t);}
 if(s.flight)doors.push(...s.flight.pads);
 if(!s.options.room&&!s.flight){s.source.scene.updateMatrixWorld(true);for(const building of s.source.buildings||[]){if(building.userData.construction)continue;building.traverse(model=>{const d=model.userData;if(!d.architecture||!d.door||!d.footprint)return;const target={buildingId:building.userData.buildingId,seed:building.userData.wardSeed??s.options.seed,homeId:d.homeId||''};const info=valid(target);if(!info)return;const scale=model.getWorldScale(new T.Vector3()).z||1;const p=model.localToWorld(new T.Vector3(d.door.x,0,Math.max(d.door.z,d.footprint.maxZ)+.9/scale));const entry=model.localToWorld(new T.Vector3(d.door.x,0,d.door.z));const direction=p.clone().sub(entry).normalize();
let safe=null;for(const forward of [0,.3,.6,.9,1.2,1.5]){for(const side of [0,.3,-.3,.6,-.6,.9,-.9]){const x=p.x+direction.x*forward-direction.z*side,z=p.z+direction.z*forward+direction.x*side;if(s.world.allowed(x,z)){safe={x,z};break;}}if(safe)break;}
if(safe)doors.push({...target,label:info.name,...safe});});}}
 function enter(t){
  if(room||s.player.mode==='fly'||s.uiBusy||s.failed)return false;const info=valid(t);if(!info)return false;
  const next=root.BurbzBuildingRoomsScene.create(T,core.plan(t));
  s.reset();s.discoveries?.closePanel();outside={world:s.world,player:{...s.player},exposure:s.source.renderer.toneMappingExposure};s.source.renderer.toneMappingExposure=1;room=next;room.target={...t};s.room=room;s.continuity?.syncControls();s.world=room.world;s.player=room.world.spawn();life=api?.people?root.BurbzInteriorLife.attach(s,room,api):null;
  s.root.classList.add('vr-inside');s.root.querySelector('.vw-hint').textContent='Left thumb: walk · Drag to look · E interact';s.root.querySelector('.vw-title small').textContent=s.options.flight?'PERCHED INSIDE':'INDOORS';s.root.querySelector('.vw-title strong').textContent=room.plan.name;
  s.root.querySelector('.vw-exit').textContent=s.options.room?'← Building':'← Outside';
  s.root.querySelector('.vw-look').setAttribute('aria-label',room.plan.name+'. WASD walks; drag or arrow keys look.');
  doorButton.hidden=false;doorButton.textContent='Leave through the door';service.hidden=true;last=-1;s.root.querySelector('.vw-look').focus({preventScroll:true});return true;
 }
 function leave(){if(!room||s.options.room)return false;s.reset();life?.dispose();life=null;room.dispose();room=null;s.room=null;s.world=outside.world;s.player=outside.player;s.source.renderer.toneMappingExposure=outside.exposure;outside=null;s.root.classList.remove('vr-inside');s.root.querySelector('.vw-hint').textContent=s.flight?'Left stick: move · Right thumb: look · Slider: height':'Left thumb: walk · Right thumb: look';s.root.querySelector('.vw-title small').textContent=s.flight?'BIRD FLIGHT':'ON FOOT';s.root.querySelector('.vw-title strong').textContent=s.options.name||'Your village';s.root.querySelector('.vw-exit').textContent=s.flight?'← Academy':'← Village';service.hidden=true;doorButton.hidden=true;s.continuity?.syncControls();last=-1;return true;}
 function exit(){root.BurbzVillageWalk.close('exit');}
 function use(){if(s.uiBusy||s.failed)return;if(room){if(Math.hypot(s.player.x-room.plan.exit.x,s.player.z-room.plan.exit.z)<2)exit();}else if(nearest)enter(nearest);}
 doorButton.addEventListener('click',use,{signal:s.abort.signal});service.addEventListener('click',()=>{if(!room||s.failed)return;const t=room.target,action=room.plan.action.kind;root.BurbzVillageWalk.close('building-action');api?.open(t,action);},{signal:s.abort.signal});
 function update(time){life?.update(time);if(time-last<.1)return;last=time;if(room){const p=room.plan;doorButton.hidden=s.uiBusy||Math.hypot(s.player.x-p.exit.x,s.player.z-p.exit.z)>=2;service.hidden=!p.action||Math.hypot(s.player.x-p.action.x,s.player.z-p.action.z)>2.3;service.textContent=p.action?.label||'';return;}
  let distance=2.4;nearest=null;if(s.player.mode==='fly'){doorButton.hidden=true;return;}for(const d of doors){if(s.flight&&s.player.landed!==d.roomId)continue;const dx=d.x-s.player.x,dz=d.z-s.player.z,n=Math.hypot(dx,dz);if(n<distance){let clear=true;for(let k=1;k<=6;k++)if(!s.world.allowed(s.player.x+dx*k/6,s.player.z+dz*k/6)){clear=false;break;}if(clear){nearest=d;distance=n;}}}
  doorButton.hidden=!nearest||s.uiBusy;doorButton.textContent=nearest?'Enter '+nearest.label+' · F':'';
 }
 return{enter,leave,update,closePanel:()=>life?.closePanel(),key(code){if(life?.key(code))return true;if(code==='KeyF'&&!s.uiBusy&&(room||nearest)){use();return true;}return false;},diagnostics:()=>({inside:!!room,life:life?.diagnostics(),plan:room?.plan,doors,nearest}),dispose(){if(outside)s.source.renderer.toneMappingExposure=outside.exposure;life?.dispose();life=null;room?.dispose();room=null;s.room=null;doorButton.remove();service.remove();}};
}
root.BurbzBuildingRooms={attach};
})(typeof globalThis!=='undefined'?globalThis:this);
