/* Derive collision from the already built village. Never instantiate a second village. */
(function(root){
  'use strict';
  function create(T,scene,buildings,movers,terrain){
    if(!terrain?.heightAt)throw Error('The village ground is still loading.');
    scene.updateMatrixWorld(true);
    const polygons=[],segments=[],skip=new Set(movers||[]),paid=new Set(buildings);
    const vector=new T.Vector3(),matrix=new T.Matrix4(),instance=new T.Matrix4();
    function polygon(object,fp){
      const points=[[fp.minX,fp.minZ],[fp.maxX,fp.minZ],[fp.maxX,fp.maxZ],[fp.minX,fp.maxZ]].map(([x,z])=>{
        vector.set(x,0,z).applyMatrix4(object.matrixWorld);return{x:vector.x,z:vector.z};
      });polygons.push(points);
    }
    for(const building of buildings){
      const fp=building.userData.footprint;
      if(fp)polygon(building,fp);
      else {const b=new T.Box3().setFromObject(building);polygons.push([{x:b.min.x,z:b.min.z},{x:b.max.x,z:b.min.z},{x:b.max.x,z:b.max.z},{x:b.min.x,z:b.max.z}]);}
    }
    // Intersect stationary scenery at shin/waist height. This also handles
    // instanced trunks and the existing spatial tree batches, without collider
    // meshes, invisible walls across open streets, or per-frame raycasts.
    const vertices=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
    const a=new T.Vector3(),b=new T.Vector3(),n=new T.Vector3();
    function slice(mesh,worldMatrix){
      const geo=mesh.geometry,pos=geo.attributes.position,indices=geo.index;
      if(!pos)return;
      if(!geo.boundingBox)geo.computeBoundingBox();
      const box=geo.boundingBox.clone().applyMatrix4(worldMatrix);
      if(box.max.y<.32||box.max.x<-terrain.radius||box.min.x>terrain.radius||box.max.z<-terrain.radius||box.min.z>terrain.radius)return;
      const count=indices?indices.count:pos.count;
      for(let i=0;i<count;i+=3){
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
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh)return;
      for(let p=mesh;p;p=p.parent)if(skip.has(p)||paid.has(p)||p.userData.sky||p.userData.walkBridge||p.userData.resident||p.userData.npc)return;
      const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
      if(materials.every(m=>!m||m.transparent||m.userData.blob||m.isMeshBasicMaterial))return;
      if(mesh.isInstancedMesh){for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,instance);matrix.multiplyMatrices(mesh.matrixWorld,instance);slice(mesh,matrix);}}
      else slice(mesh,mesh.matrixWorld);
    });
    if(terrain.river){const r=terrain.river,span=r.width+2.2;
      for(const side of [-.73,.73])segments.push([-span/2,span/2].map(d=>({x:r.x+r.ux*d-r.uz*side,z:r.z+r.uz*d+r.ux*side})));
    }
    return root.BurbzVillageWalkCore.createWorld({...terrain,polygons,segments});
  }
  function batch(T,scene,movers){
    const skip=new Set(movers||[]),buckets=new Map(),hidden=[],created=[];
    const cleanup=()=>{hidden.forEach(m=>m.visible=true);created.forEach(m=>{scene.remove(m);m.geometry.dispose();m.material.dispose();});};
    try {
    scene.updateMatrixWorld(true);
    scene.traverseVisible(mesh=>{
      if(!mesh.isMesh||mesh.isInstancedMesh||Array.isArray(mesh.material))return;
      for(let p=mesh;p;p=p.parent)if(skip.has(p)||p.userData.sky||p.userData.resident||p.userData.npc)return;
      const m=mesh.material;
      if(!m||m.transparent||m.map||m.normalMap||m.alphaMap||m.emissiveMap||(!m.isMeshLambertMaterial&&!m.isMeshStandardMaterial))return;
      const pos=mesh.getWorldPosition(new T.Vector3());
      const key=[Math.floor(pos.x/10),Math.floor(pos.z/10),m.type,m.roughness,m.metalness,m.side,m.emissive?.getHex(),m.emissiveIntensity,mesh.castShadow,mesh.receiveShadow].join(':');
      let bucket=buckets.get(key);if(!bucket){bucket={material:m,castShadow:mesh.castShadow,receiveShadow:mesh.receiveShadow,parts:[],sources:[]};buckets.set(key,bucket);}
      bucket.sources.push(mesh);
    });
    for(const bucket of buckets.values()){
      if(bucket.sources.length<3)continue;
      for(const mesh of bucket.sources){
        const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();g.applyMatrix4(mesh.matrixWorld);
        const count=g.attributes.position.count,colors=new Float32Array(count*3),old=g.attributes.color,c=mesh.material.color;
        for(let i=0;i<count;i++){colors[i*3]=c.r*(mesh.material.vertexColors&&old?old.getX(i):1);colors[i*3+1]=c.g*(mesh.material.vertexColors&&old?old.getY(i):1);colors[i*3+2]=c.b*(mesh.material.vertexColors&&old?old.getZ(i):1);}
        g.setAttribute('color',new T.BufferAttribute(colors,3));bucket.parts.push(g);hidden.push(mesh);mesh.visible=false;
      }
      const geo=new T.BufferGeometry();
      for(const field of ['position','normal','color']){
        const data=new Float32Array(bucket.parts.reduce((n,g)=>n+g.attributes[field].array.length,0));let offset=0;
        for(const g of bucket.parts){data.set(g.attributes[field].array,offset);offset+=g.attributes[field].array.length;}
        geo.setAttribute(field,new T.BufferAttribute(data,3));
      }
      geo.computeBoundingSphere();const mat=bucket.material.clone();mat.color.set(0xffffff);mat.vertexColors=true;
      root.BurbzManga?.styleMaterial(mat);
      const mesh=new T.Mesh(geo,mat);mesh.castShadow=bucket.castShadow;mesh.receiveShadow=bucket.receiveShadow;scene.add(mesh);created.push(mesh);bucket.parts.forEach(g=>g.dispose());
    }
    return cleanup;
    } catch(error) { cleanup();for(const bucket of buckets.values())bucket.parts.forEach(g=>g.dispose());throw error; }
  }
  root.BurbzVillageWalkScene={create,batch};
})(typeof globalThis!=='undefined'?globalThis:this);
