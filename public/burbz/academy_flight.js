/* Borrows the Academy's actual scene; one canvas, no second render loop. */
(function(root){'use strict';
function attach(s,input,keys){
 const T=root.THREE,core=root.BurbzAcademyFlightCore,scene=s.source.scene,pads=[],group=new T.Group(),hidden=[];
 scene.updateMatrixWorld(true);
 const solids=[];scene.traverse(o=>{if(o.isSprite){hidden.push([o,o.visible]);o.visible=false;}if(o.isMesh&&!o.material?.transparent&&!o.userData.sky&&o.geometry)solids.push(o);});
 const ray=new T.Raycaster(),origin=new T.Vector3(),direction=new T.Vector3();
 const world={segments:[],radius:35,height:()=>0,spawn:()=>({x:0,y:5,z:16,yaw:0,pitch:0}),allowed:()=>true,
 allowed3:(x,y,z)=>Number.isFinite(x+y+z)&&Math.hypot(x,z)<32&&y>.45&&y<23,
 clear(a,b){direction.set(b.x-a.x,b.y-a.y,b.z-a.z);const len=direction.length();if(!len)return true;direction.divideScalar(len);origin.set(a.x,a.y+.45,a.z);ray.set(origin,direction);ray.near=0;ray.far=len+.16;return !ray.intersectObjects(solids,false).length;}};
 for(const house of s.source.buildings){const id=house.userData.roomId,style=root.BurbzAcademy3D.STYLES[id];if(!style||!s.options.interiors.describe({scope:'academy',buildingId:id}))continue;
  const b=root.BurbzSettlementModels.batch(T),z=style.d/2+1.35;
  for(let i=0;i<6;i++)b.box(1.5,.08,.21,0,.01,z-.62+i*.23,0x997247);
  for(const x of [-.72,.72]){b.box(.08,.52,.08,x,.27,z+.5,0x58412c);b.box(.08,.52,.08,x,.27,z-.55,0x58412c);b.box(.06,.06,1.12,x,.49,z,0xc09a60);}
  b.box(.85,.06,.85,0,.065,z,0x709477);
  const deck=b.finish();deck.position.copy(house.position);deck.quaternion.copy(house.quaternion);deck.scale.copy(house.scale);group.add(deck);
  const p=house.localToWorld(new T.Vector3(0,.13,z));pads.push({scope:'academy',buildingId:id,roomId:id,label:style.label,x:p.x,y:p.y,z:p.z,yaw:house.rotation.y});
 }
 scene.add(group);root.BurbzManga?.styleScene(group);
 s.root.classList.add('af-flight');s.root.setAttribute('aria-label','Fly around the Academy as a bird');
 const controls=document.createElement('div');controls.className='af-controls';controls.innerHTML='<div class="af-lift"><button type="button" data-flight="up" aria-label="Climb vertically">↑</button><button type="button" data-flight="down" aria-label="Descend vertically">↓</button></div><button type="button" class="af-forward" data-flight="forward">Hold to fly</button><div class="af-right"><button type="button" data-flight="left" aria-label="Turn left">↶</button><input type="range" min="-1" max="1" step=".05" value="0" aria-label="Climb or descend" orient="vertical"><button type="button" data-flight="right" aria-label="Turn right">↷</button></div><button type="button" class="af-land" hidden></button><div class="af-status" role="status"></div><span class="af-beak" aria-hidden="true"></span>';
 s.root.append(controls);const held=new Map(),slider=controls.querySelector('input'),button=controls.querySelector('.af-land'),status=controls.querySelector('.af-status');let nearby=null;
 const on=(el,event,fn)=>el.addEventListener(event,fn,{signal:s.abort.signal});
 for(const b of controls.querySelectorAll('[data-flight]')){on(b,'keydown',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();held.set('key:'+b.dataset.flight,b.dataset.flight);}});on(b,'keyup',e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();held.delete('key:'+b.dataset.flight);}});on(b,'blur',()=>held.delete('key:'+b.dataset.flight));on(b,'pointerdown',e=>{e.preventDefault();e.stopPropagation();b.setPointerCapture(e.pointerId);held.set(e.pointerId,b.dataset.flight);});for(const event of ['pointerup','pointercancel','lostpointercapture'])on(b,event,e=>held.delete(e.pointerId));}
 for(const event of ['pointerup','pointercancel','blur'])on(slider,event,()=>slider.value='0');
 on(slider,'keydown',e=>e.stopPropagation());
 function reset(){held.clear();slider.value='0';if(s.player)s.player.velocity={x:0,y:0,z:0};}
 function use(){if(s.room||s.uiBusy||s.failed)return;if(s.player.landed){core.takeoff(s.player);reset();}else if(nearby&&core.land(s.player,nearby,world)){reset();}}
 on(button,'click',use);
 function update(dt){if(s.room){controls.hidden=true;return;}controls.hidden=false;
  const down=k=>[...held.values()].includes(k);core.step(s.player,{turn:-input.side+(down('left')?1:0)-(down('right')?1:0),pitch:input.forward,forward:(down('forward')||keys.has('KeyW')?1:0)-(keys.has('KeyS')?1:0),lift:Number(slider.value)+(down('up')||keys.has('Space')?1:0)-(down('down')||keys.has('ShiftLeft')||keys.has('ShiftRight')?1:0)},dt,world);
  s.root.classList.toggle('af-perched',!!s.player.landed);nearby=core.nearest(s.player,pads);button.hidden=!nearby&&!s.player.landed;button.textContent=s.player.landed?'Take off':nearby?'Land at '+nearby.label+' · F':'';
  const nearest=core.nearest(s.player,pads,100);status.textContent=s.player.landed?'Perched · enter through the door':Math.round(s.player.y)+' m · '+(nearest?nearest.label+' '+Math.round(Math.hypot(s.player.x-nearest.x,s.player.y-nearest.y,s.player.z-nearest.z))+' m':'Academy canopy');
 }
 return {world,pads,update,reset,key(code){if(code==='KeyF'&&!s.room&&!s.player.landed){use();return true;}return false;},dispose(){reset();hidden.forEach(([o,v])=>o.visible=v);group.traverse(o=>{o.geometry?.dispose();for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[])m.dispose();});group.removeFromParent();controls.remove();},diagnostics:()=>({pads,nearby,landed:s.player?.landed})};
}
root.BurbzAcademyFlight={attach};
})(typeof globalThis!=='undefined'?globalThis:this);
