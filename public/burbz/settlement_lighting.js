/* Painted daylight, cached shadows and bounded contact lighting; no ray tracing. */
(function(root){
  'use strict';
  function batchNature(T,scene){
    const buckets=new Map();let sources=0;
    scene.updateMatrixWorld(true);
    // Only direct, stationary tree parts participate. Perched birds stay in
    // their own animated groups; buildings and every selectable actor stay intact.
    scene.traverse(tree=>{
      if(!tree.userData.natureTree)return;
      for(const mesh of tree.children){
        const m=mesh.material;
        if(!mesh.isMesh||!m||Array.isArray(m)||m.map||m.vertexColors||(!m.isMeshLambertMaterial&&!m.userData.blob))continue;
        const p=mesh.getWorldPosition(new T.Vector3()),key=[Math.floor(p.x/16),Math.floor(p.z/16),m.type,m.opacity,m.side].join(':');
        let bucket=buckets.get(key);if(!bucket){bucket={material:m,parts:[]};buckets.set(key,bucket);}
        const geo=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geo.applyMatrix4(mesh.matrixWorld);
        const colors=new Float32Array(geo.attributes.position.count*3);
        for(let i=0;i<colors.length;i+=3){colors[i]=m.color.r;colors[i+1]=m.color.g;colors[i+2]=m.color.b;}
        geo.setAttribute('color',new T.BufferAttribute(colors,3));bucket.parts.push(geo);mesh.visible=false;sources++;
      }
    });
    for(const bucket of buckets.values()){
      const geo=new T.BufferGeometry();
      for(const field of ['position','normal','color']){const data=new Float32Array(bucket.parts.reduce((n,g)=>n+g.attributes[field].array.length,0));let offset=0;for(const g of bucket.parts){data.set(g.attributes[field].array,offset);offset+=g.attributes[field].array.length;}geo.setAttribute(field,new T.BufferAttribute(data,3));}
      const material=bucket.material.clone();material.color.set(0xffffff);material.vertexColors=true;
      const mesh=new T.Mesh(geo,material);mesh.castShadow=!material.userData.blob;mesh.receiveShadow=!material.userData.blob;scene.add(mesh);bucket.parts.forEach(g=>g.dispose());
    }
    return {sourceMeshes:sources,batches:buckets.size};
  }
  function install(T,options){
    const {scene,renderer,buildings,actors,daylight,keyLight,fillLight,movers=[]}=options;
    const nature=batchNature(T,scene);
    const sun=Number(daylight.sun)||0,hemi=scene.children.find(o=>o.isHemisphereLight);
    if(hemi){hemi.intensity=Math.max(1.45,daylight.hemi*.64);hemi.groundColor.lerp(new T.Color(0x80604c),.25);}
    keyLight.color.lerp(new T.Color(0xffdca4),sun*.22);keyLight.intensity=daylight.keyIntensity*1.08;
    fillLight.color.set(0x9cbbe3);fillLight.intensity=.46+.12*(1-sun);
    renderer.toneMappingExposure=daylight.exposure*.92;
    // The expensive shadow pass contains stationary scenery. Walkers have
    // soft contact marks that move each frame instead of stale cast shadows.
    for(const object of [...actors,...movers])object?.traverse(o=>{if(o.isMesh)o.castShadow=false;});
    const canvas=document.createElement('canvas');canvas.width=canvas.height=64;
    const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(32,32,3,32,32,32);
    gradient.addColorStop(0,'rgba(255,255,255,.95)');gradient.addColorStop(.45,'rgba(255,255,255,.65)');gradient.addColorStop(1,'rgba(255,255,255,0)');ctx.fillStyle=gradient;ctx.fillRect(0,0,64,64);
    const texture=new T.CanvasTexture(canvas),geometry=new T.PlaneGeometry(2,2),dummy=new T.Object3D(),plane=new T.Quaternion().setFromEuler(new T.Euler(-Math.PI/2,0,0)),rotation=new T.Quaternion(),position=new T.Vector3();
    function batch(count,color,opacity){
      if(!count)return null;
      const material=new T.MeshBasicMaterial({map:texture,color,transparent:true,opacity,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,toneMapped:false});material.userData.blob=true;
      const mesh=new T.InstancedMesh(geometry,material,count);mesh.frustumCulled=false;mesh.raycast=()=>{};scene.add(mesh);return mesh;
    }
    function stamp(mesh,index,object,x,z,width,depth,visible=true){
      position.set(x,.077,z);object.localToWorld(position);object.getWorldQuaternion(rotation);dummy.position.copy(position);dummy.quaternion.copy(rotation).multiply(plane);dummy.scale.set(visible?width:0,visible?depth:0,1);dummy.updateMatrix();mesh.setMatrixAt(index,dummy.matrix);
    }
    const paid=[];
    for(const building of buildings){if(building.userData.construction)continue;building.traverse(o=>{if(o.userData.footprint&&paid.length<96)paid.push(o);});}
    const grounding=batch(paid.length,0x241c28,.31);
    paid.forEach((o,i)=>{const f=o.userData.footprint;stamp(grounding,i,o,0,0,f.width*.64,f.depth*.65);});
    if(grounding)grounding.instanceMatrix.needsUpdate=true;
    const doors=paid.filter(o=>o.userData.door).slice(0,64),spill=batch(doors.length,0xffbf65,.22*Math.pow(1-sun,1.3));
    doors.forEach((o,i)=>{const p=o.userData.door;stamp(spill,i,o,p.x,p.z+.35,1.1,.72);});
    if(spill)spill.instanceMatrix.needsUpdate=true;
    const contacts=batch(actors.length,0x211827,.28);
    if(contacts)contacts.instanceMatrix.setUsage(T.DynamicDrawUsage);
    scene.userData.settlementLighting={technique:'cached shadow map and instanced contact light',extraDrawCalls:(grounding?1:0)+(spill?1:0)+(contacts?1:0),contactCount:actors.length,buildingContacts:paid.length,windowPools:doors.length,nature,rayTracing:false};
    scene.userData.updatePeepContacts=()=>{if(!contacts)return;actors.forEach((actor,i)=>stamp(contacts,i,actor,0,0,.28,.22,actor.visible));contacts.instanceMatrix.needsUpdate=true;};
    scene.userData.updatePeepContacts();renderer.shadowMap.needsUpdate=true;
  }
  root.BurbzSettlementLighting={install};
})(typeof window!=='undefined'?window:globalThis);
