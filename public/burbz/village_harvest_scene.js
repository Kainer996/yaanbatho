/* Reuse the actual tree geometry. Daily claim state owns the visible stump. */
(function(root){'use strict';
function prepare(T,scene,api){
 if(scene._burbzHarvestView){scene._burbzHarvestView.refresh(api);return scene._burbzHarvestView;}
 scene.updateMatrixWorld(true);
 const nodes=[],point=new T.Vector3(),scale=new T.Vector3(),core=root.BurbzVillageHarvestCore;
 scene.traverse(object=>{
  if(object.userData.natureTree){object.getWorldPosition(point);object.getWorldScale(scale);nodes.push({kind:'wood',x:point.x,y:point.y,z:point.z,radius:(object.userData.harvestRadius||.3)*scale.x,object});}
  for(const anchor of object.userData.harvestNodes||[]){point.set(anchor.x,anchor.y,anchor.z).applyMatrix4(object.matrixWorld);const parts=(object._burbzHarvestSets?.[anchor.family]||[]).map(mesh=>({mesh,index:anchor.index}));nodes.push({...anchor,x:point.x,y:point.y,z:point.z,parts});}
 });
 for(const n of nodes)n.id=core.id(n.kind,n.x,n.z);
 const woods=nodes.filter(n=>n.kind==='wood'),geo=new T.CylinderGeometry(.19,.27,.28,7),mat=new T.MeshLambertMaterial({color:0xc49b65});root.BurbzManga?.styleMaterial(mat);
 const stumps=new T.InstancedMesh(geo,mat,Math.max(1,woods.length));stumps.count=0;stumps.visible=false;stumps.frustumCulled=false;stumps.userData.harvestStumps=true;stumps.castShadow=true;scene.add(stumps);
 const dummy=new T.Object3D(),matrix=new T.Matrix4(),rotation=new T.Matrix4(),before=new T.Matrix4(),after=new T.Matrix4(),vector=new T.Vector3(),axis=new T.Vector3(),saves=new Map();
 let currentApi=api,lastDay=core.day(Date.now()),dayChecked=-Infinity;
 function stump(n,shown){if(n.stumpIndex===undefined){if(!shown)return;n.stumpIndex=stumps.count++;}stumps.visible=stumps.count>0;dummy.position.set(n.x,n.y+.14,n.z);dummy.rotation.set(0,0,0);dummy.scale.setScalar(shown?Math.max(.7,n.radius/.27):0);dummy.updateMatrix();stumps.setMatrixAt(n.stumpIndex,dummy.matrix);stumps.instanceMatrix.needsUpdate=true;}

 function capture(n){if(saves.has(n.id))return saves.get(n.id);const saved={parts:[],object:n.object,visible:n.object?.visible,angle:0,felled:false,falling:false};
  if(n.object){saved.position=n.object.position.clone();saved.quaternion=n.object.quaternion.clone();for(const part of n.object._burbzHarvestParts||[]){const attr=part.mesh.geometry.attributes.position;saved.parts.push({mesh:part.mesh,start:part.start,count:part.count,values:attr.array.slice(part.start*3,(part.start+part.count)*3)});}}
  else for(const part of n.parts||[]){part.mesh.getMatrixAt(part.index,matrix);saved.parts.push({...part,original:matrix.clone()});}
  saves.set(n.id,saved);return saved;
 }
 function pose(n,saved,angle,hidden){
  axis.set(Math.cos(saved.direction||0),0,-Math.sin(saved.direction||0));rotation.makeRotationAxis(axis,angle);before.makeTranslation(-n.x,-n.y,-n.z);after.makeTranslation(n.x,n.y,n.z);matrix.copy(after).multiply(rotation).multiply(before);
  if(saved.object){if(saved.parts.length){for(const p of saved.parts){const attr=p.mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){if(hidden)vector.set(n.x,n.y,n.z);else vector.fromArray(p.values,i*3).applyMatrix4(matrix);attr.setXYZ(p.start+i,vector.x,vector.y,vector.z);}attr.needsUpdate=true;if(hidden)p.mesh.geometry.computeBoundingSphere();}saved.object.visible=!hidden&&saved.visible;}
   else{saved.object.visible=!hidden&&saved.visible;saved.object.quaternion.copy(saved.quaternion);if(!hidden)saved.object.rotateOnWorldAxis(axis,angle);}}
  else for(const p of saved.parts){const transformed=new T.Matrix4();if(hidden)transformed.makeScale(0,0,0);else transformed.copy(matrix).multiply(p.mesh.matrixWorld).multiply(p.original).premultiply(p.mesh.matrixWorld.clone().invert());p.mesh.setMatrixAt(p.index,transformed);p.mesh.instanceMatrix.needsUpdate=true;}
  if(hidden)stump(n,true);scene._burbzHarvestChanged=true;
 }
 function settle(n){const saved=capture(n);saved.felled=true;saved.falling=false;pose(n,saved,0,true);}
 function restore(n,saved){if(saved.object){saved.object.position.copy(saved.position);saved.object.quaternion.copy(saved.quaternion);saved.object.visible=saved.visible;for(const p of saved.parts){p.mesh.geometry.attributes.position.array.set(p.values,p.start*3);p.mesh.geometry.attributes.position.needsUpdate=true;p.mesh.geometry.computeBoundingSphere();}}
  else for(const p of saved.parts){p.mesh.setMatrixAt(p.index,p.original);p.mesh.instanceMatrix.needsUpdate=true;}stump(n,false);saved.felled=false;saved.falling=false;scene._burbzHarvestChanged=true;
 }
 function refresh(nextApi=currentApi){currentApi=nextApi;for(const n of woods){const saved=saves.get(n.id),taken=!currentApi.available(n);if(taken&&!saved?.felled)settle(n);else if(!taken&&saved?.felled)restore(n,saved);}}
 function fell(n,now,player){if(n.kind!=='wood')return;const saved=capture(n);saved.felled=true;saved.started=now;saved.direction=Math.atan2(n.x-player.x,n.z-player.z);saved.falling=!matchMedia('(prefers-reduced-motion: reduce)').matches;if(!saved.falling)settle(n);}
 function update(now){let settled=false;if(now-dayChecked>1000){dayChecked=now;const day=core.day(Date.now());if(day!==lastDay){lastDay=day;refresh();settled=true;}}for(const n of woods){const saved=saves.get(n.id);if(!saved?.falling)continue;const t=Math.min(1,(now-saved.started)/850);pose(n,saved,t*t*Math.PI*.47,t===1);if(t===1){saved.falling=false;settled=true;}}return settled;}
 const view={nodes,refresh,fell,update,diagnostics:()=>({trees:woods.length,felled:woods.filter(n=>saves.get(n.id)?.felled).map(n=>n.id),falling:woods.filter(n=>saves.get(n.id)?.falling).map(n=>n.id)})};scene._burbzHarvestView=view;refresh();return view;
}
root.BurbzVillageHarvestScene={prepare};
})(globalThis);
