/* One interaction in the existing walking loop; no renderer or RAF of its own. */
(function(root){'use strict';function attach(s){
 if(!s.options.harvest||s.options.flight)return null;
 const T=root.THREE,core=root.BurbzVillageHarvestCore,api=s.options.harvest,view=root.BurbzVillageHarvestScene.prepare(T,s.source.scene,api),nodes=view.nodes,hits=new Map();
 const button=document.createElement('button');button.type='button';button.className='vh-use';button.hidden=true;s.root.append(button);
 const status=document.createElement('div');status.className='vh-status';status.setAttribute('role','status');s.root.append(status);
 const geo=new T.BoxGeometry(.09,.07,.06),mat=new T.MeshLambertMaterial({color:0xcda56e}),chips=new T.InstancedMesh(geo,mat,6);chips.visible=false;chips.frustumCulled=false;s.source.scene.add(chips);root.BurbzManga?.styleScene(chips);
 const dummy=new T.Object3D();let nearby=null,last=-Infinity,struck=-Infinity,noticeUntil=0,lastHit=-Infinity,hitPoint=null,pendingCollision=false;
 function select(){if(s.room||s.uiBusy||s.failed||document.hidden)return null;let best=null,distance=Infinity;for(const n of nodes){const d=(n.x-s.player.x)**2+(n.z-s.player.z)**2;if(d<distance&&d<10&&core.inReach(s.player,n,s.world)){distance=d;best=n;}}return best;}
 function strike(){const n=select();if(!n||!api.available(n)||performance.now()-lastHit<280)return false;lastHit=performance.now();
  let count=(hits.get(n.id)||0)+1;
  if(count>=3){let reward;
   try{reward=api.collect(n);if(!reward)return false;}
   catch(e){hits.set(n.id,2);status.textContent='Could not save. Your supplies are still here; try again.';noticeUntil=performance.now()+4500;return true;}
   hits.delete(n.id);status.textContent='+'+reward.quantity+' '+(n.kind==='wood'?'timber':'stone')+' in your satchel · '+(n.kind==='wood'?'A fresh tree grows tomorrow':'More tomorrow');
   try{view.fell(n,performance.now(),s.player);if(n.kind==='wood'&&matchMedia('(prefers-reduced-motion: reduce)').matches)rebuildCollision();}
   catch(error){status.textContent='Your '+(n.kind==='wood'?'timber':'stone')+' is saved. Return to the settlement to refresh its scenery.';console.warn('Burbz harvest scenery:',error);}
  }
  else{hits.set(n.id,count);status.textContent=(n.kind==='wood'?'Chop':'Chip')+' '+count+' / 3';}
  struck=performance.now();noticeUntil=struck+3000;hitPoint={x:n.x,y:n.y+(n.kind==='wood'?1:.35),z:n.z};mat.color.setHex(n.kind==='wood'?0xcda56e:0xaab8ad);return true;
 }
 button.addEventListener('click',strike,{signal:s.abort.signal});
 function rebuildCollision(){if(s.room){pendingCollision=true;return;}pendingCollision=false;s.world=root.BurbzVillageWalkScene.create(T,s.source.scene,s.source.buildings,s.source.movers,s.source.scene.userData.walkTerrain);if(!s.world.allowed(s.player.x,s.player.z)){
   const previous={...s.player};let safe=null;
   for(let radius=.35;radius<=3.5&&!safe;radius+=.25)for(let i=0;i<24;i++){const angle=i*Math.PI/12,x=previous.x+Math.sin(angle)*radius,z=previous.z+Math.cos(angle)*radius;if(s.world.allowed(x,z)){safe={x,z};break;}}
   safe||=s.world.spawn(previous);Object.assign(s.player,{x:safe.x,z:safe.z,y:s.world.height(safe.x,safe.z)});
  }s.source.renderer.shadowMap.needsUpdate=true;}
 function update(time){const now=performance.now();if(view.update(now))rebuildCollision();if(pendingCollision&&!s.room)rebuildCollision();if(s.source.scene._burbzHarvestChanged){s.source.renderer.shadowMap.needsUpdate=true;s.source.scene._burbzHarvestChanged=false;}if(s.room||s.uiBusy||s.failed){button.hidden=true;status.hidden=true;chips.visible=false;nearby=null;return;}
  if(time-last>.12){last=time;nearby=select();button.hidden=!nearby;const ready=nearby&&api.available(nearby);button.disabled=!ready;button.textContent=nearby?(ready?(nearby.kind==='wood'?'Chop tree':'Chip stone')+(s.root.classList.contains('vw-touch')?'':' · E')+' · '+(hits.get(nearby.id)||0)+'/3':(nearby.kind==='wood'?'Tree felled · Grows tomorrow':'Gathered here · More tomorrow')):'';}
  status.hidden=now>noticeUntil;const dt=(now-struck)/1000;chips.visible=!!hitPoint&&dt<.45&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(chips.visible){for(let i=0;i<6;i++){const angle=i*Math.PI/3;dummy.position.set(hitPoint.x+Math.cos(angle)*dt*1.8,hitPoint.y+dt*(1.4+i*.1)-3*dt*dt,hitPoint.z+Math.sin(angle)*dt*1.8);dummy.rotation.set(dt*5,i,dt*3);dummy.updateMatrix();chips.setMatrixAt(i,dummy.matrix);}chips.instanceMatrix.needsUpdate=true;}
 }
 return{update,key(code){return code==='KeyE'&&!s.uiBusy&&strike();},diagnostics:()=>({nodes: nodes.map(n=>({id:n.id,kind:n.kind,x:n.x,y:n.y,z:n.z,radius:n.radius,available:api.available(n)})),nearby:nearby?.id,scene:view.diagnostics(),hits:Object.fromEntries(hits)}),dispose(){button.remove();status.remove();chips.removeFromParent();geo.dispose();mat.dispose();}};
}root.BurbzVillageHarvest={attach};})(globalThis);
