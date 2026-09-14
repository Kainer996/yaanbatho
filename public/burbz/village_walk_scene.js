/* Derive collision from the already built village. Never instantiate a second village. */
(function(root){
  'use strict';
  function finish(steps){let result;do{result=steps.next();}while(!result.done);return result.value;}
  function create(...args){return finish(createSteps(...args));}
  function* createSteps(T,scene,buildings,movers,terrain){
    if(!terrain?.heightAt)throw Error('The village ground is still loading.');
    scene.updateWorldMatrix(true,false);
    for(const child of scene.children){yield 'scene transforms';child.updateMatrixWorld(true);}
    const polygons=[],segments=[],surfaces=[],skip=new Set(movers||[]),paid=new Set(buildings);
    const vector=new T.Vector3(),matrix=new T.Matrix4(),instance=new T.Matrix4();
    for(const building of buildings){yield 'building collision';polygons.push(...buildingPolygons(T,scene,[building]));}
    // Intersect stationary scenery at shin/waist height. This also handles
    // instanced trunks and the existing spatial tree batches, without collider
    // meshes, invisible walls across open streets, or per-frame raycasts.
    const vertices=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
    const a=new T.Vector3(),b=new T.Vector3(),n=new T.Vector3();
    function* slice(mesh,worldMatrix){
      const geo=mesh.geometry,pos=geo.attributes.position,indices=geo.index;
      if(!pos)return;
      if(!geo.boundingBox)geo.computeBoundingBox();
      const box=geo.boundingBox.clone().applyMatrix4(worldMatrix);
      if(box.max.y<.32||box.max.x<-terrain.radius||box.min.x>terrain.radius||box.max.z<-terrain.radius||box.min.z>terrain.radius)return;
      const count=indices?indices.count:pos.count;
      for(let i=0;i<count;i+=3){
        if(i%300===0)yield;
        for(let j=0;j<3;j++)vertices[j].fromBufferAttribute(pos,indices?indices.getX(i+j):i+j).applyMatrix4(worldMatrix);
        a.subVectors(vertices[1],vertices[0]);b.subVectors(vertices[2],vertices[0]);n.crossVectors(a,b).normalize();
        if(Math.abs(n.y)>.8)continue; // turf, roof slopes, paths and flat decals
        const cx=(vertices[0].x+vertices[1].x+vertices[2].x)/3,cz=(vertices[0].z+vertices[1].z+vertices[2].z)/3;
        if(Math.hypot(cx,cz)>terrain.radius+1)continue;
        const plane=terrain.heightAt(cx,cz)+.55,points=[];
        for(let j=0;j<3;j++){
          const p=vertices[j],q=vertices[(j+1)%3];
          if((p.y>plane)===(q.y>plane))continue;
          const k=(plane-p.y)/(q.y-p.y);points.push({x:p.x+(q.x-p.x)*k,z:p.z+(q.z-p.z)*k});
        }
        if(points.length===2&&Math.hypot(points[0].x-points[1].x,points[0].z-points[1].z)>.025)segments.push(points);
      }
    }
    const collisionMeshes=[];scene.traverseVisible(mesh=>collisionMeshes.push(mesh));
    for(const mesh of collisionMeshes){
      yield;
      if(!mesh.isMesh)continue;
      if(mesh.material?.userData?.footstepSurface==='stone'&&!mesh.isInstancedMesh){
        const pos=mesh.geometry.attributes.position,index=mesh.geometry.index,count=index?index.count:pos?.count||0;
        for(let i=0;i<count&&surfaces.length<4096;i+=3){
          const points=[0,1,2].map(j=>{vector.fromBufferAttribute(pos,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld);return{x:vector.x,z:vector.z,y:vector.y};});
          const x=points.reduce((n,p)=>n+p.x,0)/3,z=points.reduce((n,p)=>n+p.z,0)/3;
          if(points.every(p=>Math.abs(p.y-terrain.heightAt(x,z))<.3))surfaces.push(points);
        }
      }
      let excluded=false;for(let p=mesh;p;p=p.parent)if(skip.has(p)||paid.has(p)||p.userData.continuousTerrain||p.userData.sky||p.userData.walkBridge||p.userData.resident||p.userData.npc){excluded=true;break;}if(excluded)continue;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(materials.every(m=>!m||m.transparent||m.userData.blob||m.isMeshBasicMaterial))continue;
      if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);yield* slice(mesh,matrix);}}
      else yield* slice(mesh,mesh.matrixWorld);
    }
    if(terrain.river){const r=terrain.river,span=r.width+2.2;
      for(const side of [-.73,.73])segments.push([-span/2,span/2].map(d=>({x:r.x+r.ux*d-r.uz*side,z:r.z+r.uz*d+r.ux*side})));
    }
    const surfaceAt=(x,z)=>surfaces.some(p=>root.BurbzVillageWalkCore.inside(x,z,p))?'stone':'ground';
    function rebuilt(next){const world=root.BurbzVillageWalkCore.createWorld({...terrain,polygons:next,segments,surfaceAt});world.withBuildings=items=>rebuilt(buildingPolygons(T,scene,items));return world;}
    return rebuilt(polygons);
  }
  // Building changes reuse the terrain/scenery collision already derived for
  // this scene. All shapes stay in the settlement's local frame after travel.
  function buildingPolygons(T,scene,buildings){
    scene.updateWorldMatrix(true,false);const inverse=new T.Matrix4().copy(scene.matrixWorld).invert(),relative=new T.Matrix4(),vector=new T.Vector3(),polygons=[];
    for(const building of buildings){
      if(building.userData.townGround)continue;
      building.updateWorldMatrix(true,true);
      relative.multiplyMatrices(inverse,building.matrixWorld);
      const fp=building.userData.footprint;
      if(fp){polygons.push([[fp.minX,fp.minZ],[fp.maxX,fp.minZ],[fp.maxX,fp.maxZ],[fp.minX,fp.maxZ]].map(([x,z])=>{vector.set(x,0,z).applyMatrix4(relative);return{x:vector.x,z:vector.z};}));}
      else{const box=new T.Box3().setFromObject(building).applyMatrix4(inverse);polygons.push([{x:box.min.x,z:box.min.z},{x:box.max.x,z:box.min.z},{x:box.max.x,z:box.max.z},{x:box.min.x,z:box.max.z}]);}
    }
    return polygons;
  }
  function batch(...args){return finish(batchSteps(...args));}
  function* batchSteps(T,scene,movers,options={}){
    const skip=new Set(movers||[]),buckets=new Map(),hidden=[],created=[];
    let completed=false,committed=false,disposed=false;
    const inherited=options.include||new Set(),sources=new Set(),inverse=new T.Matrix4(),relative=new T.Matrix4();
    const cleanup=()=>{if(disposed)return;disposed=true;if(committed)hidden.forEach(m=>m.visible=true);created.forEach(m=>{m.removeFromParent();m.geometry.dispose();m.material.dispose();});};
    cleanup.sources=sources;
    cleanup.commit=()=>{if(disposed||committed)return false;hidden.forEach(m=>m.visible=false);created.forEach(m=>scene.add(m));committed=true;return true;};
    try {
    scene.updateWorldMatrix(true,false);
    for(const child of scene.children){yield 'scene transforms';child.updateMatrixWorld(true);}
    inverse.copy(scene.matrixWorld).invert();
    scene.traverse(mesh=>{
      if(mesh.userData.walkBatch)return;
      if(!inherited.has(mesh)){for(let p=mesh;p;p=p.parent)if(!p.visible)return;}
      if(!mesh.isMesh||mesh.isInstancedMesh||mesh.userData.harvestBatch||mesh.userData.harvestStumps||Array.isArray(mesh.material))return;
      for(let p=mesh;p;p=p.parent)if(skip.has(p)||p.userData.sky||p.userData.walkCorridor||p.userData.resident||p.userData.npc||p.userData.natureTree)return;
      const m=mesh.material;
      if(!m||m.transparent||m.map||m.normalMap||m.alphaMap||m.emissiveMap||(!m.isMeshLambertMaterial&&!m.isMeshStandardMaterial))return;
      const pos=mesh.getWorldPosition(new T.Vector3()).applyMatrix4(inverse);
      const key=[Math.floor(pos.x/10),Math.floor(pos.z/10),m.type,m.roughness,m.metalness,m.side,m.emissive?.getHex(),m.emissiveIntensity,mesh.castShadow,mesh.receiveShadow].join(':');
      let bucket=buckets.get(key);if(!bucket){bucket={material:m,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,parts:[],sources:[]};buckets.set(key,bucket);}
      bucket.sources.push(mesh);
    });
    for(const bucket of buckets.values()){
      yield;
      if(bucket.sources.length<3)continue;
      for(const mesh of bucket.sources){
        yield;
        const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(relative.multiplyMatrices(inverse,mesh.matrixWorld));
        const count=g.attributes.position.count,colors=new Float32Array(count*3),old=g.attributes.color,c=mesh.material.color;
        for(let i=0;i<count;i++){colors[i*3]=c.r*(mesh.material.vertexColors&&old?old.getX(i):1);colors[i*3+1]=c.g*(mesh.material.vertexColors&&old?old.getY(i):1);colors[i*3+2]=c.b*(mesh.material.vertexColors&&old?old.getZ(i):1);}
        g.setAttribute('color',new T.BufferAttribute(colors,3));bucket.parts.push(g);hidden.push(mesh);sources.add(mesh);
      }
      const geo=new T.BufferGeometry();
      for(const field of ['position','normal','color']){
        const data=new Float32Array(bucket.parts.reduce((n,g)=>n+g.attributes[field].array.length,0));let offset=0;
        for(const g of bucket.parts){data.set(g.attributes[field].array,offset);offset+=g.attributes[field].array.length;}
        geo.setAttribute(field,new T.BufferAttribute(data,3));
      }
      geo.computeBoundingSphere();const mat=bucket.material.clone();mat.color.set(0xffffff);mat.vertexColors=true;
      root.BurbzManga?.styleMaterial(mat);
      const mesh=new T.Mesh(geo,mat);mesh.userData.walkBatch=true;mesh.castShadow=bucket.castShadow;mesh.receiveShadow=bucket.receiveShadow;created.push(mesh);bucket.parts.forEach(g=>g.dispose());bucket.parts.length=0;
    }
    completed=true;if(!options.stage)cleanup.commit();return cleanup;
    } finally { if(!completed){cleanup();for(const bucket of buckets.values())bucket.parts.forEach(g=>g.dispose());} }
  }
  // Stage only changed paid objects. The old batch, terrain and actors remain
  // live until the caller has rechecked proximity and durably saved the ledger.
  function* replacementSteps(T,{scene,world,buildings,movers=[],unbatch,remove,add}){
    const removed=new Set(remove),nextBuildings=buildings.filter(b=>!removed.has(b)).concat(add);
    const staging=new T.Group();staging.name='Prepared building opening';staging.visible=false;scene.add(staging);
    const inherited=new Set(unbatch?.sources||[]);let nextBatch,completed=false,committed=false,disposed=false;
    for(const object of add){staging.add(object);object.traverse(m=>inherited.add(m));}
    const releaseObjects=objects=>{
      const keptGeometry=new Set(),keptMaterial=new Set();scene.traverse(o=>{if(o.geometry)keptGeometry.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])keptMaterial.add(m);});
      const geometries=new Set(),materials=new Set();for(const object of objects)object.traverse(o=>{if(o.geometry&&!keptGeometry.has(o.geometry))geometries.add(o.geometry);for(const m of Array.isArray(o.material)?o.material:o.material?[o.material]:[])if(!keptMaterial.has(m))materials.add(m);});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());
    };
    const cancel=()=>{if(disposed||committed)return;disposed=true;nextBatch?.();staging.removeFromParent();releaseObjects(add);};
    try{
      yield 'replacement collision';
      const nextWorld=world.withBuildings(nextBuildings);
      nextBatch=yield* batchSteps(T,scene,[...movers,...remove],{stage:true,include:inherited});
      const result={world:nextWorld,buildings:nextBuildings,batch:nextBatch,remove,add,cancel,
        clear(x,z){return !disposed&&!committed&&(nextWorld.allowedBeyond||nextWorld.allowed)(x,z);},
        commit(){
          if(disposed||committed)return false;
          unbatch?.();for(const object of remove)object.removeFromParent();
          for(const object of add)scene.add(object);staging.removeFromParent();nextBatch.commit();
          committed=true;releaseObjects(remove);return true;
        }};
      completed=true;return result;
    }finally{if(!completed)cancel();}
  }
  // Fogged objects still cost draw calls. Cull whole actors and spatial static
  // batches only after their entire conservative sphere is behind opaque fog.
  // An outer wrapper preserves the resident routine's own visibility state.
  function distanceCull(T,scene,movers=[]){
    const candidates=new Set(movers),rows=[],point=new T.Vector3(),box=new T.Box3(),sphere=new T.Sphere();
    scene.traverse(o=>{if(o.userData.walkBatch)candidates.add(o);});
    for(const object of candidates){
      if(!object?.parent)continue;let nested=false;for(let p=object.parent;p&&p!==scene;p=p.parent)if(candidates.has(p)){nested=true;break;}if(nested)continue;
      box.setFromObject(object);if(box.isEmpty())continue;box.getBoundingSphere(sphere);
      const center=object.worldToLocal(sphere.center.clone()),radius=sphere.radius;
      const parent=object.parent,wrapper=new T.Group();wrapper.name='Walking visibility';parent.add(wrapper);wrapper.add(object);
      rows.push({object,parent,wrapper,center,radius});
    }
    let last=-Infinity;
    return {update(time,player,far){if(time-last<.2)return;last=time;for(const row of rows){row.object.localToWorld(point.copy(row.center));row.wrapper.visible=Math.hypot(point.x-player.x,point.z-player.z)<far+row.radius+16;}},dispose(){for(const row of rows){row.parent.add(row.object);row.wrapper.removeFromParent();}rows.length=0;}};
  }
  root.BurbzVillageWalkScene={create,batch,createSteps,batchSteps,replacementSteps,distanceCull};
})(typeof globalThis!=='undefined'?globalThis:this);
