/* One interaction in the existing walking loop; no renderer or RAF of its own. */
(function(root){'use strict';function attach(s){
 if(!s.options.harvest||s.options.flight)return null;
 const T=root.THREE,core=root.BurbzVillageHarvestCore,api=s.options.harvest,nodes=[],hits=new Map(),point=new T.Vector3();
 s.source.scene.updateMatrixWorld(true);
 s.source.scene.traverse(o=>{
  if(o.userData.natureTree){o.getWorldPosition(point);const scale=o.getWorldScale(new T.Vector3()).x;nodes.push({kind:'wood',x:point.x,y:point.y,z:point.z,radius:(o.userData.harvestRadius||.3)*scale});}
  for(const n of o.userData.harvestNodes||[]){point.set(n.x,n.y,n.z).applyMatrix4(o.matrixWorld);nodes.push({...n,x:point.x,y:point.y,z:point.z});}
 });
 for(const n of nodes)n.id=core.id(n.kind,n.x,n.z);
 const button=document.createElement('button');button.type='button';button.className='vh-use';button.hidden=true;s.root.append(button);
 const status=document.createElement('div');status.className='vh-status';status.setAttribute('role','status');s.root.append(status);
 const geo=new T.BoxGeometry(.09,.07,.06),mat=new T.MeshLambertMaterial({color:0xcda56e}),chips=new T.InstancedMesh(geo,mat,6);chips.visible=false;chips.frustumCulled=false;s.source.scene.add(chips);root.BurbzManga?.styleScene(chips);
 const dummy=new T.Object3D();let nearby=null,last=-Infinity,struck=-Infinity,noticeUntil=0,lastHit=-Infinity,hitPoint=null;
 function select(){if(s.room||s.uiBusy||s.failed||document.hidden)return null;return nodes.filter(n=>core.inReach(s.player,n,s.world)).sort((a,b)=>Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0]||null;}
 function strike(){const n=select();if(!n||!api.available(n)||performance.now()-lastHit<280)return false;lastHit=performance.now();
  let count=(hits.get(n.id)||0)+1;
  if(count>=3){try{const reward=api.collect(n);if(!reward)return false;hits.delete(n.id);status.textContent='+'+reward.quantity+' '+(n.kind==='wood'?'wood':'stone')+' in your stores · More tomorrow';}catch(e){hits.set(n.id,2);status.textContent='Could not save. Your supplies are still here; try again.';noticeUntil=performance.now()+4500;return true;}}
  else{hits.set(n.id,count);status.textContent=(n.kind==='wood'?'Chop':'Chip')+' '+count+' / 3';}
  struck=performance.now();noticeUntil=struck+3000;hitPoint={x:n.x,y:n.y+(n.kind==='wood'?1:.35),z:n.z};mat.color.setHex(n.kind==='wood'?0xcda56e:0xaab8ad);return true;
 }
 button.addEventListener('click',strike,{signal:s.abort.signal});
 function update(time){const now=performance.now();if(s.room||s.uiBusy||s.failed){button.hidden=true;status.hidden=true;chips.visible=false;nearby=null;return;}
  if(time-last>.12){last=time;nearby=select();button.hidden=!nearby;const ready=nearby&&api.available(nearby);button.disabled=!ready;button.textContent=nearby?(ready?(nearby.kind==='wood'?'Chop wood':'Chip stone')+' · E · '+(hits.get(nearby.id)||0)+'/3':'Gathered here · More tomorrow'):'';}
  status.hidden=now>noticeUntil;const dt=(now-struck)/1000;chips.visible=!!hitPoint&&dt<.45&&!matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(chips.visible){for(let i=0;i<6;i++){const angle=i*Math.PI/3;dummy.position.set(hitPoint.x+Math.cos(angle)*dt*1.8,hitPoint.y+dt*(1.4+i*.1)-3*dt*dt,hitPoint.z+Math.sin(angle)*dt*1.8);dummy.rotation.set(dt*5,i,dt*3);dummy.updateMatrix();chips.setMatrixAt(i,dummy.matrix);}chips.instanceMatrix.needsUpdate=true;}
 }
 return{update,key(code){return code==='KeyE'&&!s.uiBusy&&strike();},diagnostics:()=>({nodes: nodes.map(n=>({...n,available:api.available(n)})),nearby:nearby?.id,hits:Object.fromEntries(hits)}),dispose(){button.remove();status.remove();chips.removeFromParent();geo.dispose();mat.dispose();}};
}root.BurbzVillageHarvest={attach};})(globalThis);
