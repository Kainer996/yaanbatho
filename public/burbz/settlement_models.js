/* Small, batched woodland buildings and humanoid inhabitants. THREE is supplied by the scene. */
(function(root){
  'use strict';
  const COLOURS={wood:0x68462f,trim:0x49352a,stone:0xaca58e,plaster:0xe6d5ac,roof:0x627f77,glass:0xffd28a,soil:0x77533b};
  const primitiveCaches=new WeakMap();
  function primitive(T,key,make){let cache=primitiveCaches.get(T);if(!cache){cache=new Map();primitiveCaches.set(T,cache);}if(cache.has(key))return cache.get(key);const source=make(),geo=source.index?source.toNonIndexed():source;if(geo!==source)source.dispose();geo.deleteAttribute('uv');if(cache.size>=64){const oldest=cache.keys().next().value;cache.get(oldest).dispose();cache.delete(oldest);}cache.set(key,geo);return geo;}
  function batch(T){
    const parts=[],lit=[];
    function add(geo,color,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1],glow=false,shared=false){
      const matrix=new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(...scale));
      let g=geo.index?geo.toNonIndexed():shared?geo.clone():geo;g.applyMatrix4(matrix);
      const c=new T.Color(color),colors=new Float32Array(g.attributes.position.count*3);
      for(let i=0;i<colors.length;i+=3){colors[i]=c.r;colors[i+1]=c.g;colors[i+2]=c.b;}g.setAttribute('color',new T.BufferAttribute(colors,3));
      (glow?lit:parts).push(g);if(g!==geo&&!shared)geo.dispose();return g;
    }
    function box(w,h,d,x,y,z,c,rot=[0,0,0]){add(primitive(T,"box",()=>new T.BoxGeometry(1,1,1)),c,[x,y,z],rot,[w,h,d],false,true);}
    function cylinder(r1,r2,h,x,y,z,c,rot=[0,0,0],segments=10){const base=Math.max(r1,r2)||1,ratio1=r1/base,ratio2=r2/base;add(primitive(T,"cylinder:"+ratio1+":"+ratio2+":"+segments,()=>new T.CylinderGeometry(ratio1,ratio2,1,segments)),c,[x,y,z],rot,[base,h,base],false,true);}
    function sphere(r,x,y,z,c,scale=[1,1,1]){add(primitive(T,"sphere",()=>new T.SphereGeometry(1,8,6)),c,[x,y,z],[0,0,0],scale.map(n=>n*r),false,true);}
    function finish(){const group=new T.Group();for(const [list,glow] of [[parts,false],[lit,true]]){if(!list.length)continue;
      const g=new T.BufferGeometry();for(const field of ['position','normal','color']){const total=list.reduce((n,p)=>n+p.attributes[field].array.length,0),data=new Float32Array(total);let offset=0;for(const p of list){data.set(p.attributes[field].array,offset);offset+=p.attributes[field].array.length;}g.setAttribute(field,new T.BufferAttribute(data,3));}
      const material=glow?new T.MeshBasicMaterial({vertexColors:true}):new T.MeshStandardMaterial({vertexColors:true,roughness:.88,metalness:0});
      const mesh=new T.Mesh(g,material);mesh.castShadow=!glow;mesh.receiveShadow=!glow;group.add(mesh);list.forEach(p=>p.dispose());
    }return group;}
    return {add,box,cylinder,sphere,finish};
  }
  // A rigged batch. Parts are laid out in their rest pose, in model space, and
  // each is bound to a named bone (or eased between two). finish() merges them
  // into ONE skinned mesh: a whole villager or animal costs one draw call, and
  // the animators turn real joints instead of loose blobs.
  // Skinning needs float vertex textures. WebGL2 always has them; a rare
  // WebGL1 phone may not, and then rig() builds rigid jointed pieces instead.
  let skinning=null;
  function skinningSupported(){
    if(skinning!==null)return skinning;
    skinning=true;
    try{
      const doc=root.document;if(!doc||typeof doc.createElement!=='function')return skinning;
      const canvas=doc.createElement('canvas');let gl=canvas.getContext('webgl2');
      if(!gl){gl=canvas.getContext('webgl');skinning=!!gl&&!!gl.getExtension('OES_texture_float')&&gl.getParameter(gl.MAX_VERTEX_TEXTURE_IMAGE_UNITS)>0;}
      gl?.getExtension('WEBGL_lose_context')?.loseContext();
    }catch(error){skinning=true;}
    return skinning;
  }
  function rig(T){
    const bones=[],named={},parts=[],colour=new T.Color();
    function bone(name,parent,at){
      const b=new T.Bone(),p=parent?named[parent]:null;
      if(parent&&!p)throw Error('Unknown parent bone '+parent);
      b.name=name;b.userData.at=at.slice();
      if(p){b.position.set(at[0]-p.userData.at[0],at[1]-p.userData.at[1],at[2]-p.userData.at[2]);p.add(b);}
      else b.position.set(at[0],at[1],at[2]);
      b.userData.boneIndex=bones.length;bones.push(b);named[name]=b;return b;
    }
    // color: a hex/Color, or fn(x,y,z) returning one, to paint patterns in
    // model space. blend: {bone,from,to} eases weight onto a second bone along
    // from→to, so sleeves and trouser legs bend at the joint without a crack.
    function add(geo,color,pos=[0,0,0],rot=[0,0,0],scale=[1,1,1],boneName,blend){
      const b=named[boneName];if(!b)throw Error('Unknown bone '+boneName);
      if(blend&&!named[blend.bone])throw Error('Unknown blend bone '+blend.bone);
      if(!geo.attributes.normal)geo.computeVertexNormals();
      geo.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...pos),new T.Quaternion().setFromEuler(new T.Euler(...rot)),new T.Vector3(...scale)));
      parts.push({geo,color,bone:b.userData.boneIndex,blend:blend&&{...blend,bone:named[blend.bone].userData.boneIndex}});
      return geo;
    }
    const seg=(n,lo)=>Math.max(lo,Math.round(n));
    function sphere(r,pos,color,boneName,scale=[1,1,1],rot=[0,0,0],w=12,h=9){return add(new T.SphereGeometry(r,seg(w,4),seg(h,3)),color,pos,rot,scale,boneName);}
    function box(size,pos,color,boneName,rot=[0,0,0]){return add(new T.BoxGeometry(size[0],size[1],size[2]),color,pos,rot,[1,1,1],boneName);}
    function cylinder(r1,r2,h,pos,color,boneName,rot=[0,0,0],n=10,open=false){return add(new T.CylinderGeometry(r1,r2,h,seg(n,3),1,open),color,pos,rot,[1,1,1],boneName);}
    function cone(r,h,pos,color,boneName,rot=[0,0,0],n=10){return add(new T.ConeGeometry(r,h,seg(n,3)),color,pos,rot,[1,1,1],boneName);}
    function capsule(r,length,pos,color,boneName,rot=[0,0,0],scale=[1,1,1],n=10){return add(new T.CapsuleGeometry(r,length,3,seg(n,4)),color,pos,rot,scale,boneName);}
    function torus(r,tube,pos,color,boneName,rot=[0,0,0],scale=[1,1,1],arc=Math.PI*2){return add(new T.TorusGeometry(r,tube,6,16,arc),color,pos,rot,scale,boneName);}
    // A turned profile [[radius,y],...] around the Y axis: skirts, tunics, bodies.
    function lathe(profile,pos,color,boneName,scale=[1,1,1],rot=[0,0,0],n=14,blend){return add(new T.LatheGeometry(profile.map(([r,y])=>new T.Vector2(Math.max(r,.0001),y)),seg(n,3)),color,pos,rot,scale,boneName,blend);}
    // A tapered rod between two rest-pose points: limbs, shafts, horns.
    function limb(from,to,r1,r2,color,boneName,blend,n=9){
      const a=new T.Vector3(...from),bEnd=new T.Vector3(...to),dir=bEnd.clone().sub(a),len=dir.length();
      const geo=new T.CylinderGeometry(r2,r1,len,seg(n,3),1,false);
      const q=new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),dir.normalize());
      geo.applyMatrix4(new T.Matrix4().compose(a.clone().add(bEnd).multiplyScalar(.5),q,new T.Vector3(1,1,1)));
      const b=named[boneName];if(!b)throw Error('Unknown bone '+boneName);
      parts.push({geo,color,bone:b.userData.boneIndex,blend:blend&&{...blend,bone:named[blend.bone].userData.boneIndex}});
      return geo;
    }
    // A smooth bent tube through rest-pose points: tails, horns, rods, handles.
    function tube(points,radius,color,boneName,n=6,tubular=12){
      const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
      return add(new T.TubeGeometry(curve,seg(tubular,2),radius,seg(n,3),false),color,[0,0,0],[0,0,0],[1,1,1],boneName);
    }
    function finish(options={}){
      let vertices=0,indices=0;
      for(const p of parts){const count=p.geo.attributes.position.count;vertices+=count;indices+=p.geo.index?p.geo.index.count:count;}
      const position=new Float32Array(vertices*3),normal=new Float32Array(vertices*3),color=new Float32Array(vertices*3);
      const skinIndex=new Uint16Array(vertices*4),skinWeight=new Float32Array(vertices*4);
      const index=new (vertices>65535?Uint32Array:Uint16Array)(indices);
      let v=0,i=0;
      for(const p of parts){
        const pos=p.geo.attributes.position,nor=p.geo.attributes.normal,count=pos.count,paint=typeof p.color==='function';
        if(!paint)colour.set(p.color);
        let ax=0,ay=0,az=0,dx=0,dy=0,dz=0,dd=1;
        if(p.blend){[ax,ay,az]=p.blend.from;dx=p.blend.to[0]-ax;dy=p.blend.to[1]-ay;dz=p.blend.to[2]-az;dd=dx*dx+dy*dy+dz*dz||1;}
        for(let k=0;k<count;k++){
          const x=pos.getX(k),y=pos.getY(k),z=pos.getZ(k),o=(v+k)*3,s=(v+k)*4;
          position[o]=x;position[o+1]=y;position[o+2]=z;
          normal[o]=nor.getX(k);normal[o+1]=nor.getY(k);normal[o+2]=nor.getZ(k);
          if(paint)colour.set(p.color(x,y,z));
          color[o]=colour.r;color[o+1]=colour.g;color[o+2]=colour.b;
          let w=0;
          if(p.blend){const t=Math.min(1,Math.max(0,((x-ax)*dx+(y-ay)*dy+(z-az)*dz)/dd));w=t*t*(3-2*t);}
          skinIndex[s]=p.bone;skinIndex[s+1]=p.blend?p.blend.bone:0;skinWeight[s]=1-w;skinWeight[s+1]=w;
        }
        if(p.geo.index){const src=p.geo.index.array;for(let k=0;k<src.length;k++)index[i++]=v+src[k];}
        else for(let k=0;k<count;k++)index[i++]=v+k;
        v+=count;p.geo.dispose();
      }
      const material=new T.MeshStandardMaterial({vertexColors:true,roughness:options.roughness??.86,metalness:0});
      const name=options.name||'rigged-model',under=options.meshUnder?named[options.meshUnder]:null;
      if(options.meshUnder&&(!under||under.parent))throw Error('meshUnder must name a root bone');
      const roots=bones.filter(b=>!b.parent);
      // Rest-pose bounds, padded for swinging limbs, keep culling and taps
      // independent of whatever pose the first frame happens to catch.
      const pad=Array.isArray(options.pad)?options.pad:[options.pad??.18,options.pad??.18,options.pad??.18];
      if(!skinningSupported())return rigid();
      const geo=new T.BufferGeometry();
      geo.setAttribute('position',new T.BufferAttribute(position,3));geo.setAttribute('normal',new T.BufferAttribute(normal,3));
      geo.setAttribute('color',new T.BufferAttribute(color,3));
      geo.setAttribute('skinIndex',new T.Uint16BufferAttribute(skinIndex,4));geo.setAttribute('skinWeight',new T.BufferAttribute(skinWeight,4));
      geo.setIndex(new T.BufferAttribute(index,1));geo.computeBoundingBox();geo.computeBoundingSphere();
      const mesh=new T.SkinnedMesh(geo,material);mesh.name=name;
      let object=mesh;
      // Under a root bone, the mesh sits back at the model origin so its rest
      // geometry binds exactly where it was authored.
      if(under){object=roots.length===1?under:new T.Group();if(object!==under)roots.forEach(b=>object.add(b));under.add(mesh);under.children.unshift(under.children.pop());mesh.position.set(-under.userData.at[0],-under.userData.at[1],-under.userData.at[2]);}
      else roots.forEach(b=>mesh.add(b));
      object.updateMatrixWorld(true);
      const skeleton=new T.Skeleton(bones);mesh.bind(skeleton);
      // The bone texture belongs to this model alone; free it with the mesh.
      geo.addEventListener('dispose',()=>skeleton.dispose());
      mesh.boundingBox=geo.boundingBox.clone().expandByVector(new T.Vector3(...pad));
      mesh.boundingSphere=geo.boundingSphere.clone();mesh.boundingSphere.radius+=Math.max(...pad);
      mesh.castShadow=true;mesh.receiveShadow=true;
      return {mesh,object,roots,bones:named,triangles:indices/3};
      // Devices that cannot skin still get jointed models: every bone carries
      // its own rigid piece of the same merged colours.
      function rigid(){
        const object=under&&roots.length===1?under:new T.Group();
        if(object!==under)roots.forEach(b=>object.add(b));
        const byBone=new Map();
        for(let k=0;k<index.length;k+=3){const b=skinIndex[index[k]*4];if(!byBone.has(b))byBone.set(b,[]);byBone.get(b).push(index[k],index[k+1],index[k+2]);}
        for(const [b,list] of byBone){
          const at=bones[b].userData.at,remap=new Map(),pos=[],nor=[],col=[],idx=[];
          for(const n of list){if(!remap.has(n)){remap.set(n,remap.size);pos.push(position[n*3]-at[0],position[n*3+1]-at[1],position[n*3+2]-at[2]);nor.push(normal[n*3],normal[n*3+1],normal[n*3+2]);col.push(color[n*3],color[n*3+1],color[n*3+2]);}idx.push(remap.get(n));}
          const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);
          const piece=new T.Mesh(g,material);piece.name=name;piece.castShadow=piece.receiveShadow=true;bones[b].add(piece);
          if(bones[b]===under)under.children.unshift(under.children.pop());
        }
        object.updateMatrixWorld(true);
        return {mesh:object,object,roots,bones:named,triangles:indices/3,rigid:true};
      }
    }
    return {bone,add,sphere,box,cylinder,cone,capsule,torus,lathe,limb,tube,finish,bones:named};
  }
  function building(T,id,level,random,palette={}){
    const buildingId=id;id=({lumberhut:'lumberjack_hut',minehut:'miners_hut'})[id]||id;
    const b=batch(T),r=random||(()=>.5),p={...COLOURS},stoneHome=id==='cabin'&&level>=3;
    p.roof=id==='tavern'?0x984f40:id==='chapel'?0x68768a:id==='hut'?0x798c58:palette.roofs?.[0]||p.roof;
    // Keep timber, plaster and stone warm even in night palettes: lighting
    // supplies darkness, rather than multiplying it into every material too.
    p.plaster=[0xe5d4b0,0xd9c5a1,0xe4d9bf][Math.floor(r()*3)];
    const shade=(c,k)=>new T.Color(c).offsetHSL(0,0,k);
    function roof(w,d,y,rise,c=p.roof){
      const half=w/2+.28,angle=Math.atan2(rise,half),slope=Math.hypot(half,rise);
      // Real overhanging gables: two pitched planes with staggered shingles.
      for(const sign of [-1,1]){
        b.box(slope,.13,d+.6,sign*half/2,y+rise/2,0,c,[0,0,-sign*angle]);
        for(let row=0;row<6;row++)for(let col=0;col<5;col++){
          const t=(row+.5)/6,z=-(d+.5)/2+(col+.5)*(d+.5)/5;
          b.box(slope/6+.025,.052,(d+.5)/5-.025,sign*half*t,y+rise*(1-t)+.085,z,shade(c,(r()-.5)*.09),[0,0,-sign*angle]);
        }
        b.box(.11,.15,d+.64,sign*half,y,0,p.trim);
      }
      b.cylinder(.105,.105,d+.68,0,y+rise+.045,0,p.trim,[Math.PI/2,0,0],8);
      // Timber triangle closes both gables under the pitched roof.
      const shape=new T.Shape();shape.moveTo(-w/2,0);shape.lineTo(w/2,0);shape.lineTo(0,rise*.94);shape.closePath();
      b.add(new T.ExtrudeGeometry(shape,{depth:d,bevelEnabled:false}),p.plaster,[0,y,-d/2]);
      for(const z of [-d/2-.025,d/2+.025]){b.box(.10,rise,.10,0,y+rise/2,z,p.trim);}
    }
    function windowAt(x,y,z,w=.48,h=.55){
      b.box(w+.13,h+.13,.10,x,y,z,p.trim);
      b.add(new T.BoxGeometry(w,h,.11),p.glass,[x,y,z+.01],[0,0,0],[1,1,1],true);
      b.box(.035,h,.14,x,y,z+.08,p.trim);b.box(w,.035,.14,x,y,z+.08,p.trim);
      b.box(w+.22,.08,.24,x,y-h/2-.05,z+.05,p.wood);
    }
    function barrel(x,z,scale=1){
      b.cylinder(.21*scale,.19*scale,.5*scale,x,.25*scale+.12,z,p.wood);
      for(const y of [.2,.48])b.cylinder(.216*scale,.216*scale,.035*scale,x,y*scale+.12,z,p.trim);
    }
    function main(w,d,h,opts={}){
      b.box(w+.18,.2,d+.18,0,.1,0,p.stone);
      b.box(w,h,d,0,h/2+.2,0,opts.stone?0xb7b0a0:opts.logs?p.wood:p.plaster);
      if(opts.logs){for(let y=.32;y<h+.16;y+=.22){for(const x of [-w/2,w/2])b.cylinder(.13,.13,d+.18,x,y,0,shade(p.wood,(r()-.5)*.09),[Math.PI/2,0,0],8);for(const z of [-d/2,d/2])b.cylinder(.13,.13,w+.15,0,y,z,p.wood,[0,0,Math.PI/2],8);}}
      else{
        for(const x of [-w/2,w/2])for(const z of [-d/2,d/2])b.box(.14,h+.10,.14,x,h/2+.2,z,p.trim);
        for(const y of [.4,h+.2])b.box(w+.10,.14,d+.10,0,y,0,p.trim);
        if(opts.stone)for(let row=0;row<4;row++)for(let col=0;col<6;col++){const x=-w/2+(col+.5)*w/6;for(const z of [-d/2-.02,d/2+.02])b.box(w/6-.025,.22,.045,x,.55+row*.3,z,shade(p.stone,(r()-.5)*.12));}
      }
      roof(w,d,h+.2,opts.tower?1.55:1.05);
      const doorZ=d/2+.15;
      b.box(.76,1.2,.12,0,.8,doorZ,p.trim);b.box(.59,1.05,.14,0,.75,doorZ+.05,p.wood);
      for(const x of [-.22,-.07,.08,.23])b.box(.015,1,.025,x,.75,doorZ+.135,p.trim);
      b.sphere(.04,.18,.72,doorZ+.16,0xcba659);
      b.box(1.03,.13,.65,0,.08,doorZ+.28,p.stone);
      for(const x of [-w*.31,w*.31])windowAt(x,h*.61+.2,doorZ-.015,w>.3?.49:.3,.55);
      // Front porch + planted window boxes are part of the paid building.
      if(opts.porch){for(const x of [-.7,.7])b.box(.1,1.45,.1,x,.85,doorZ+.72,p.trim);b.box(1.7,.13,1.02,0,1.63,doorZ+.40,p.roof,[.16,0,0]);}
      for(const x of [-w*.31,w*.31]){b.box(.62,.18,.23,x,.75,doorZ+.12,p.wood);for(let i=0;i<3;i++)b.sphere(.09,x+(i-1)*.18,.88,doorZ+.14,[0x859c55,0xc79b62,0xb37987][i]);}
      b.box(.43,.9,.45,-w*.28,h+1.1,-d*.22,p.stone);b.box(.55,.11,.55,-w*.28,h+1.59,-d*.22,p.trim);
      return {x:0,z:doorZ+.18};
    }
    let w=3.1,d=2.6,h=1.75,door;
    if(id==='well'){
      w=d=2.5;
      b.cylinder(.83,.90,.16,0,.08,0,p.stone);
      for(let i=0;i<14;i++){const a=i/14*Math.PI*2;b.box(.23,.76,.14,Math.sin(a)*.63,.50,Math.cos(a)*.63,shade(p.wood,(r()-.5)*.08),[0,a,0]);}
      for(const y of [.23,.79])b.add(new T.TorusGeometry(.65,.035,5,18),p.trim,[0,y,0],[Math.PI/2,0,0]);
      b.cylinder(.51,.51,.02,0,.28,0,0x387b89);
      for(const x of [-.95,.95])b.box(.16,2.0,.17,x,1,0,p.wood);
      b.cylinder(.075,.075,1.95,0,1.35,0,p.trim,[0,0,Math.PI/2]);b.cylinder(.012,.012,.76,.12,.95,0,0xb8a678);
      b.cylinder(.13,.10,.23,.12,.56,0,p.wood);roof(2.1,1.3,2,.72);
      door={x:0,z:1.7};
    }else if(id==='cottages'){
      w=3.6;d=2.85;h=2.15;door=main(w,d,h,{stone:true,porch:true});
    }else{
      if(id==='cabin'){w=level>=2?4.1:3;d=level>=2?3.15:2.7;h=level>=3?2.15:1.75;}
      if(['storehouse','market','entertainment','village_hall'].includes(id)){w=4;d=3.1;h=2.3;}
      if(id==='chapel'){w=3;d=4.1;h=2.8;}
      if(['farm','lumber','lumberjack_hut','miners_hut','quarry','foundry','forge'].includes(id)){w=2.6;d=2.5;h=1.7;}
      door=main(w,d,h,{logs:['cabin','hut','lumberjack_hut','miners_hut'].includes(id)&&!stoneHome,stone:stoneHome||['chapel','foundry','quarry'].includes(id),porch:['tavern','hut','market','village_hall'].includes(id),tower:id==='chapel'});
      if(id==='chapel'){b.box(.8,1.6,.8,-.7,h+1.4,-.6,p.stone);b.add(new T.ConeGeometry(.75,1.2,4),p.roof,[-.7,h+2.65,-.6],[0,Math.PI/4,0]);}
      if(['farm','hut'].includes(id)){
        const x=w/2+.9;b.box(1.2,.12,2.7,x,.06,0,p.soil);
        for(let row=0;row<3;row++)for(let col=0;col<6;col++){const z=-1.1+col*.4;b.cylinder(.018,.025,.45,x-.4+row*.4,.32,z,id==='farm'?0xc4b26a:0x6e904d);b.sphere(.07,x-.4+row*.4,.57,z,id==='farm'?0xe2c97b:0x8f4f75);}
        w+=2.5;
      }
      if(['lumber','lumberjack_hut','storehouse'].includes(id)){
        for(let i=0;i<5;i++)b.cylinder(.14,.14,1.8,-w/2-.4-(i%2)*.24,.18+Math.floor(i/2)*.24,-.1,p.wood,[Math.PI/2,0,0],8);
        w+=1.8;
      }
      if(['quarry','miners_hut','foundry'].includes(id)){
        for(let i=0;i<6;i++)b.add(new T.DodecahedronGeometry(.3+r()*.25),shade(p.stone,(r()-.5)*.18),[-w/2-.55-r()*.6,.2,-1+r()*2]);
        if(id==='foundry'){b.box(.8,2.9,.8,-w/2-.4,1.45,-.75,p.stone);b.add(new T.BoxGeometry(.45,.4,.10),0xffaa4e,[-w/2-.4,.5,-.29],[0,0,0],[1,1,1],true);}w+=2.2;
      }
      if(['market','tavern','entertainment'].includes(id)){barrel(-w/2-.3,.7);barrel(-w/2-.3,.05);w+=.8;}
    }
    const group=b.finish(),bounds=new T.Box3().setFromObject(group);
    const footprint={minX:bounds.min.x,maxX:bounds.max.x,minZ:bounds.min.z,maxZ:bounds.max.z,width:2*Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x)),depth:2*Math.max(Math.abs(bounds.min.z),Math.abs(bounds.max.z))};
    group.userData={buildingModel:buildingId,modelLevel:level,door,footprint,architecture:'woodland-v348'};
    return group;
  }
  function bird(T,resident){
    const g=new T.Group(),b=batch(T),species=resident.species;
    const coat=species==='Blackbird'?0x393c3d:species==='Blue Tit'?0x72999d:species==='Goldfinch'?0xb6a27a:0x89745c;
    const breast=species==='Robin'?0xb66b43:species==='Blue Tit'?0xd6cb76:species==='Blackbird'?0x484746:0xd1bf99;
    b.sphere(.23,0,.53,0,coat,[.82,1.15,1]);b.sphere(.19,0,.53,.13,breast,[.85,1,.7]);
    b.sphere(.16,0,.83,.065,coat);b.add(new T.ConeGeometry(.065,.17,5),0xc49b51,[0,.81,.27],[Math.PI/2,0,0]);
    for(const x of [-.115,.115]){b.sphere(.029,x,.86,.17,0x161a19);b.sphere(.009,x-.004,.87,.19,0xf7efdd);}
    b.box(.13,.055,.4,0,.44,-.26,coat,[.35,0,0]);
    // A neckerchief and satchel mark inhabitants, without human hands/heads.
    b.cylinder(.12,.14,.065,0,.70,.02,0x809872);b.box(.18,.17,.10,.22,.41,-.02,0x926b43);
    const body=b.finish();g.add(body);const wings=[];
    for(const side of [-1,1]){const wing=new T.Mesh(new T.SphereGeometry(.17,7,5),new T.MeshStandardMaterial({color:coat,roughness:1}));wing.scale.set(.35,1,.7);wing.position.set(side*.20,.53,-.01);g.add(wing);wings.push(wing);}
    const legs=[];
    for(const side of [-1,1]){const leg=new T.Group();leg.position.set(side*.10,.3,0);const shin=new T.Mesh(new T.CylinderGeometry(.018,.02,.22,5),new T.MeshStandardMaterial({color:0x9f7547}));shin.position.y=-.11;leg.add(shin);const foot=new T.Mesh(new T.BoxGeometry(.09,.025,.15),shin.material);foot.position.set(0,-.225,.04);leg.add(foot);g.add(leg);legs.push(leg);}
    g.userData={resident,birdRig:{body,wings,legs}};return g;
  }
  function animateBird(g,state,time,motion){
    const rig=g.userData.birdRig;if(!rig)return;
    const stride=state.stride||time*6,moving=state.moving&&motion;
    rig.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(stride+i*Math.PI)*.45:0);
    rig.body.position.y=moving?Math.abs(Math.sin(stride))*.018:Math.sin(time*1.7)*.006*motion;
    rig.wings.forEach((wing,i)=>wing.rotation.z=(i?1:-1)*(moving?.10+Math.sin(stride)*.025:.025));
  }
  // Village folk, storybook cut: soft, rounded villagers about four and a
  // half heads tall. Each is one skinned mesh from rig(), and every look comes
  // from a hash of the person's id, so the baker you met yesterday is the same
  // baker today. The helpers live in their own scope, apart from the buildings.
  const folk=(()=>{
    const PI=Math.PI,TAU=PI*2;
    const clamp=(v,a,b)=>v<a?a:v>b?b:v;
    const smooth=(a,b,v)=>{const t=clamp((v-a)/(b-a),0,1);return t*t*(3-2*t);};

    // ---- Identity and colour ------------------------------------------------
    function hashId(value){let h=2166136261;for(const c of String(value)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
    function random(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
    const pick=(r,list)=>list[Math.floor(r()*list.length)];
    function mix(a,b,t){
      const ar=a>>16&255,ag=a>>8&255,ab=a&255;
      return(Math.round(ar+((b>>16&255)-ar)*t)<<16)|(Math.round(ag+((b>>8&255)-ag)*t)<<8)|Math.round(ab+((b&255)-ab)*t);
    }
    const deepen=(c,k)=>mix(c,0x24160e,k),soften=(c,k)=>mix(c,0xfff4e2,k);

    const SKIN=[0xebc3a0,0xe2b48f,0xd9a67c,0xcb9267,0xb77d53,0x9a6440,0x7b4b2f,0x5c3823];
    const HAIR={black:0x241b17,espresso:0x3d291e,brown:0x5d3b25,chestnut:0x7d4628,auburn:0x93412a,ginger:0xc26e35,honey:0xb08846,flax:0xdcc286,grey:0xa39e97,white:0xe8e3db};
    const DYE={madder:0xa8443a,rose:0xbf6f64,woad:0x46709f,indigo:0x2f4a72,weld:0xd6ad48,moss:0x5a7836,sage:0x8f9f70,linen:0xe7dcc2,oat:0xcfbb95,russet:0x96573a,plum:0x74446b,teal:0x317a75,charcoal:0x4a4542,ochre:0xc28740,walnut:0x5f4432,heather:0x8c7ca2,cream:0xf1e7d1,forest:0x4d6b3a};
    // Everyday cloth comes from the strong natural dyes; heather, rose and sage are a rare treat.
    const MAIN=[DYE.madder,DYE.woad,DYE.moss,DYE.russet,DYE.teal,DYE.weld,DYE.plum,DYE.indigo,DYE.forest];
    const RARE=[DYE.heather,DYE.rose,DYE.sage];
    const HATS=[DYE.walnut,DYE.charcoal,0x7d6a52,deepen(DYE.moss,.3),deepen(DYE.russet,.2),deepen(DYE.woad,.3),deepen(DYE.plum,.15),deepen(DYE.teal,.3),0x8a6a44];
    const SHIRT=[DYE.linen,DYE.linen,DYE.cream,DYE.oat];
    const LEGS=[0x5f4432,0x4a4542,0x34496b,0x6b4a33,0x7d6a52,0x51603c,0x7a3a30];
    const BOOTS=[0x4d3425,0x3c2b21,0x61412a,0x2f2824];
    const LEATHER=0x6e4a2e,STRAP=0x3f2a1c,WOOD=0x8a5f3a,STEEL=0x6f787f,STRAW=0xd9b765,BRASS=0xc9a24a;

    const JOB={farm:'farmer',lumberhut:'woodcutter',lumber:'woodcutter',minehut:'miner',quarry:'miner',tavern:'taverner',well:'waterer',hut:'hunter',chapel:'friar',market:'merchant',foundry:'smith',storehouse:'porter',entertainment:'performer',village_hall:'clerk'};
    const ROLE=new Set(['guard','fisher','bard','elder','child','vendor','builder']);
    const FEMALE={guard:.3,smith:.2,miner:.2,woodcutter:.25,friar:0,porter:.3,builder:.25,hunter:.35};
    const GREYING=new Set(['commoner','clerk','merchant','fisher','waterer']);
    // Hats that come down over the nape and hide a bun completely.
    const COVERS=new Set(['kettle','knit','leather','scarf','hood','jester','flatcap','chaperon','coif','kerchief']);

    // Arm holds, written for the left arm and mirrored on the right: shoulder
    // [x,y,z], elbow bend, forearm twist, wrist. upright keeps a pole plumb;
    // swing is how much of the walk's arm swing is left. A stance is only a way
    // of standing, so those hands let go and swing freely on the move.
    const HOLDS={
      free:{sh:[-.04,0,.06],fore:-.3,swing:1},
      belt:{sh:[.1,0,.25],fore:-1.6,twist:-.8,swing:1,stance:1},
      behind:{sh:[.62,0,.12],fore:-.9,twist:-1.5,swing:1,stance:1},
      hips:{sh:[.55,0,.9],fore:-1.8,twist:-1,swing:1,stance:1},
      spear:{sh:[-.16,0,.16],fore:-1.2,upright:1,swing:.12},
      staff:{sh:[-.42,0,.14],fore:-.45,upright:1,swing:.55},
      pole:{sh:[-.12,0,.14],fore:-1.0,upright:1,swing:.25},
      rod:{sh:[-.3,0,.16],fore:-.95,hand:[.1,0,0],swing:.2},
      shoulder:{sh:[-.3,0,.42],fore:-2.2,hand:[.25,0,0],swing:.06},
      forearm:{sh:[-.1,0,.18],fore:-1.5,twist:-.25,hand:[.1,0,0],swing:.12},
      hang:{sh:[.02,0,.17],fore:-.08,swing:.3},
      raise:{sh:[-.14,0,.14],fore:-1.35,upright:1,swing:.2},
      fret:{sh:[-.18,0,.62],fore:-2.1,twist:-.4,swing:.05},
      strum:{sh:[-.15,0,0],fore:-1.35,twist:-.8,swing:.05},
      clasp:{sh:[-.2,0,.05],fore:-1.35,twist:-1,swing:.08},
      juggle:{sh:[-.22,0,.2],fore:-1.35,hand:[.2,0,0],swing:.15},
      bow:{sh:[-.06,0,.14],fore:-.4,upright:1,swing:.5},
      hammer:{sh:[.02,0,.09],fore:-.4,swing:.7},
      scroll:{sh:[-.35,0,.15],fore:-1.6,twist:-.9,hand:[.3,0,0],swing:.15},
      // Both hands forward on a handcart's grips, elbows soft.
      push:{sh:[-.95,0,.2],fore:-.42,twist:.3,hand:[.35,0,0],swing:.05},
    };
    // A hold as one side's shoulder sees it (the right arm mirrors the left).
    function sided(h,s,stoop){
      const hand=h.hand||[0,0,0];
      return {sx:h.sh[0],sy:h.sh[1]*s,sz:h.sh[2]*s,fore:h.fore,twist:(h.twist||0)*s,hx:h.upright?-(stoop+h.sh[0]+h.fore):hand[0],hy:hand[1]*s,hz:hand[2]*s,swing:h.swing,upright:!!h.upright,stance:!!h.stance};
    }
    const FREE=[sided(HOLDS.free,1,0),sided(HOLDS.free,-1,0)],PUSH=[sided(HOLDS.push,1,0),sided(HOLDS.push,-1,0)];

    // Unit spheres are turned once per mesh size and copied after that, which
    // is far quicker than turning a new one for every eye, thumb and button.
    const SPHERES=new WeakMap();
    function unitSphere(T,w,h){
      let cache=SPHERES.get(T);if(!cache)SPHERES.set(T,cache=new Map());
      let tpl=cache.get(w*64+h);if(!tpl)cache.set(w*64+h,tpl=new T.SphereGeometry(1,w,h));
      const g=new T.BufferGeometry();
      g.setAttribute('position',new T.BufferAttribute(tpl.attributes.position.array.slice(),3));
      g.setAttribute('normal',new T.BufferAttribute(tpl.attributes.normal.array.slice(),3));
      g.setIndex(tpl.index);return g;
    }

    // ---- Who is this? ---------------------------------------------------------
    // Neighbours in one village take turns through the dyes and hat colours,
    // so two near-identical folk rarely stand side by side. The hat turn slips
    // a step every nine folk, so each dye meets every hat colour in time.
    function turnOf(id){const m=/^(.*):resident:(\d+)$/.exec(String(id));return m?hashId(m[1])%997+Number(m[2]):-1;}
    function design(person){
      const r=random(hashId(person.id)),turn=turnOf(person.id);
      const trade=ROLE.has(person.role)?person.role:JOB[person.jobId||person.job]||'commoner';
      const child=trade==='child';
      const elder=trade==='elder'||(!child&&GREYING.has(trade)&&r()<.18);
      const female=r()<(FEMALE[trade]??.5);
      const skinIndex=Math.floor(r()*SKIN.length);
      const L={trade,child,elder,female,skin:SKIN[skinIndex],phase:r()*TAU};
      const pool=skinIndex>4?['black','black','espresso','espresso','brown']:skinIndex>2?['black','espresso','brown','chestnut','auburn','honey']:['espresso','brown','chestnut','auburn','ginger','honey','flax','brown'];
      L.hair=elder?(r()<.55?HAIR.grey:HAIR.white):HAIR[pick(r,pool)];
      L.hairStyle=female?pick(r,child?['braids','bob','pigtails','ponytail']:elder?['bun','bun','braids']:['bun','braids','long','ponytail','bob','bun'])
        :pick(r,child?['crop','fringe','curly','shaggy']:elder?['bald','crop','bald','shaggy']:['crop','fringe','curly','shaggy','crop']);
      L.beard=!female&&!child&&r()<(elder?.8:.45)?pick(r,elder?['long','full','moustache']:['full','short','moustache','goatee','short']):null;
      L.height=child?.78+r()*.06:female?1.18+r()*.06:1.22+r()*.08;
      if(elder)L.height-=.02;
      L.width=child?1:pick(r,[.94,1,1,1.05]);
      L.belly=0;L.stoop=0;
      L.eyes=pick(r,[0x2a1c16,0x2a1c16,0x1f2430,0x33261a]);
      L.main=r()<.1?pick(r,RARE):turn<0?pick(r,MAIN):MAIN[turn*2%MAIN.length];
      L.hatColour=turn<0?pick(r,HATS):HATS[(turn*4+Math.floor(turn/9))%HATS.length];
      L.shirt=pick(r,SHIRT);L.legs=pick(r,LEGS);L.boots=pick(r,BOOTS);
      L.trim=pick(r,MAIN.filter(c=>c!==L.main));L.belt=pick(r,[LEATHER,0x4d3425,0x8a6a44]);L.buckle=pick(r,[BRASS,0x9a9c9e]);
      L.garment=female&&!child&&r()<.8?'dress':'tunic';
      L.hem=L.garment==='dress'?.11:.4;L.sleeve='long';L.hat=null;L.props=[];L.hold={L:'free',R:'free'};L.idle='stand';
      L.hemTrim=r()<.45?L.trim:0;
      outfit(L,r);
      if(L.garment==='robe')L.hem=.05;
      else if(L.garment==='tunic'&&L.hem<.2)L.hem=.4;
      else if(L.garment==='dress'&&!L.child&&L.hem>.2)L.hem=.11;
      // Layers: a linen under-tunic below the hem, a laced kirtle over the chemise, a belt pouch.
      const plain=!L.gambeson&&!L.motley&&!L.leatherApron&&!L.fur;
      if(L.garment==='tunic'&&plain&&!child&&r()<.55)L.underHem=true;
      if(L.garment==='dress'&&plain&&!child&&!elder&&(L.bodice||r()<.55))L.laced=true;
      if(L.garment==='tunic'&&plain&&!L.tabard&&!L.pouch&&r()<.35)L.pouch=true;
      return L;
    }

    function outfit(L,r){
      const f=L.female;
      switch(L.trade){
        case 'guard':
          L.garment='tunic';L.gambeson=true;L.main=pick(r,[DYE.oat,0xbfb08a]);L.shirt=L.main;L.hemTrim=0;
          L.tabard=pick(r,[DYE.madder,DYE.woad,DYE.teal]);L.crest=DYE.weld;L.hem=.38;
          L.legs=pick(r,[DYE.charcoal,DYE.walnut]);L.boots=0x3c2b21;L.hat='kettle';
          L.props=['spear','shield'];L.hold={L:'belt',R:'spear'};L.idle='guard';
          if(L.hairStyle==='long')L.hairStyle='ponytail';break;
        case 'fisher':
          L.garment='tunic';L.main=pick(r,[DYE.teal,DYE.woad,DYE.ochre,DYE.moss]);L.hat='wide';L.hatColour=pick(r,[0xa98a4e,0x7a6a4e,0x5d6d73]);
          L.waders=true;L.sleeve='rolled';L.kerchief=pick(r,[DYE.madder,DYE.weld,DYE.woad]);
          L.props=['rod','creel'];L.hold={L:'free',R:'rod'};L.idle='fish';break;
        case 'bard':
          L.garment='tunic';L.main=pick(r,[DYE.plum,DYE.teal,DYE.madder,DYE.indigo]);L.shirt=pick(r,[DYE.weld,DYE.cream,DYE.rose]);
          L.trim=DYE.weld;L.hemTrim=DYE.weld;L.sleeve='puff';L.legs=pick(r,[DYE.weld,DYE.madder,DYE.charcoal]);L.hem=.42;
          L.hat='beret';L.hatColour=pick(r,[DYE.madder,DYE.teal,DYE.plum,DYE.moss]);
          L.props=['lute'];L.hold={L:'fret',R:'strum'};L.idle='strum';break;
        case 'elder':
          L.main=pick(r,[DYE.walnut,DYE.indigo,DYE.russet,DYE.forest,DYE.plum,DYE.heather]);L.trim=DYE.oat;
          if(f){L.garment='dress';L.hem=.1;L.shawl=pick(r,[DYE.oat,DYE.madder,DYE.sage]);}else{L.garment='tunic';L.hem=.3;}
          L.props=['staff'];L.hold={L:'behind',R:'staff'};L.idle='elder';L.stoop=.2;break;
        case 'child':
          L.garment=f?'dress':'tunic';L.hem=f?.24:.4;L.main=pick(r,[DYE.weld,DYE.madder,DYE.woad,DYE.moss,DYE.madder,DYE.teal,DYE.rose]);
          if(r()<.45){L.props=['pinwheel'];L.hold={L:'free',R:'pole'};}
          L.idle='child';break;
        case 'vendor':
          L.apron=DYE.cream;L.bib=true;L.hat=f?'kerchief':pick(r,['felt',null]);L.hatColour=pick(r,[DYE.madder,DYE.weld,DYE.teal,DYE.walnut]);
          L.props=['basket'];L.hold={L:'forearm',R:'free'};L.idle='vendor';break;
        case 'builder':
          L.garment='tunic';L.main=pick(r,[DYE.oat,DYE.russet,DYE.ochre,DYE.woad]);L.sleeve='rolled';L.hat=pick(r,['coif','flatcap']);L.hatColour=pick(r,[0x5f4432,0x4a4542,0x7d6a52]);
          L.pouch=true;L.jerkin=LEATHER;L.props=['hammer','plank'];L.hold={L:'shoulder',R:'hammer'};L.idle='builder';break;
        case 'farmer':
          L.main=pick(r,[DYE.oat,DYE.moss,DYE.linen,DYE.russet,DYE.ochre]);L.sleeve='rolled';L.hat='straw';L.kerchief=r()<.5?pick(r,[DYE.madder,DYE.woad]):0;
          L.props=['pitchfork'];L.hold={L:pick(r,['free','belt']),R:'pole'};L.idle='farmer';break;
        case 'woodcutter':
          L.garment='tunic';L.main=pick(r,[DYE.madder,DYE.moss,DYE.woad]);L.plaid=true;L.hemTrim=0;L.hat='knit';L.hatColour=pick(r,[DYE.madder,DYE.moss,DYE.teal]);
          L.jerkin=r()<.5?0x5b4030:0;L.props=['axe'];L.hold={L:'free',R:'shoulder'};L.idle='stand';break;
        case 'miner':
          L.garment='tunic';L.main=pick(r,[0x6b6258,0x5a6878,DYE.charcoal]);L.legs=DYE.walnut;L.hat='leather';L.hemTrim=0;L.kerchief=pick(r,[DYE.madder,DYE.weld,DYE.woad]);
          L.props=['pick'];L.hold={L:'free',R:'shoulder'};L.idle='stand';break;
        case 'taverner':
          L.apron=DYE.cream;L.apronLong=true;L.bib=true;L.sleeve='rolled';L.belly=.02;L.width=Math.max(L.width,1.05);
          L.props=['tankard'];L.hold={L:pick(r,['hips','free']),R:'raise'};L.idle='taverner';break;
        case 'waterer':
          // A bucket in each hand balances the load, and reads from across the square.
          L.hat=f?'scarf':pick(r,['felt',null]);L.hatColour=f?pick(r,[DYE.woad,DYE.madder,DYE.weld,DYE.teal]):L.hatColour;
          L.props=['buckets'];L.hold={L:'hang',R:'hang'};L.idle='stand';break;
        case 'hunter':
          L.garment='tunic';L.main=pick(r,[DYE.walnut,DYE.russet,DYE.oat]);L.hat='hood';L.hatColour=pick(r,[DYE.forest,0x3f5a3a,DYE.moss]);L.hemTrim=0;
          L.props=['bow','quiver'];L.hold={L:'bow',R:'free'};L.idle='hunter';break;
        case 'friar':
          L.garment='robe';L.main=pick(r,[0x6b4a33,0x5b5550,0x3e3a3a,0x7a6a58]);L.shirt=L.main;L.hemTrim=0;L.hairStyle=L.elder?'bald':'tonsure';if(L.beard&&L.beard!=='full')L.beard=null;
          L.props=['book'];L.hold={L:'clasp',R:'clasp'};L.idle='friar';break;
        case 'merchant':
          L.garment=f?'dress':'coat';if(!f)L.hem=.28;L.main=pick(r,[DYE.madder,DYE.plum,DYE.teal,DYE.indigo]);L.trim=DYE.weld;L.hemTrim=0;
          L.fur=pick(r,[0xe9dfcc,0x8a6446]);L.belly=f?0:.025;L.hat=f?'coif':'chaperon';L.hatColour=f?DYE.cream:pick(r,[DYE.indigo,DYE.madder,DYE.plum,DYE.charcoal]);
          L.props=['purse','cane'];L.hold={L:'belt',R:'pole'};L.idle='merchant';break;
        case 'smith':
          L.garment='tunic';L.main=pick(r,[DYE.charcoal,0x5a6878,DYE.madder,DYE.indigo]);L.sleeve='rolled';L.width=Math.max(L.width,1.05);L.hemTrim=0;
          L.leatherApron=true;L.headband=r()<.5;L.props=['hammer'];L.hold={L:'free',R:'hammer'};L.idle='smith';break;
        case 'porter':
          L.garment='tunic';L.main=pick(r,[DYE.oat,DYE.russet,DYE.moss,DYE.ochre]);L.hat='flatcap';
          L.sleeve='rolled';L.props=['sack'];L.hold={L:'free',R:'shoulder'};L.idle='stand';break;
        case 'performer':
          L.garment='tunic';L.main=pick(r,[DYE.madder,DYE.woad,DYE.plum]);L.trim=pick(r,[DYE.weld,DYE.cream]);L.motley=true;L.hemTrim=0;
          L.legs=L.trim;L.hat='jester';L.props=['balls'];L.hold={L:'juggle',R:'juggle'};L.idle='juggle';break;
        case 'clerk':
          L.main=pick(r,[DYE.indigo,DYE.charcoal,DYE.plum,DYE.teal]);L.hat=f?'coif':pick(r,['felt',null]);L.hatColour=f?DYE.cream:pick(r,[DYE.charcoal,DYE.indigo,DYE.walnut]);L.specs=true;
          L.props=['scroll','quill'];L.hold={L:'scroll',R:'free'};L.idle='clerk';break;
        default:{
          // Everyday folk: a hat or not, an overlayer or not, and a way of standing.
          L.hat=f?pick(r,[null,null,null,'kerchief','scarf','coif','straw']):pick(r,[null,null,null,'felt','flatcap','straw','hood']);
          if(L.hat==='kerchief'||L.hat==='scarf')L.hatColour=pick(r,[DYE.madder,DYE.woad,DYE.weld,DYE.teal,DYE.cream,DYE.moss]);
          else if(L.hat==='hood')L.hatColour=pick(r,[DYE.forest,DYE.russet,DYE.woad,DYE.plum]);
          else if(L.hat==='coif')L.hatColour=pick(r,[DYE.cream,DYE.linen]);
          const extra=r();
          if(L.garment==='dress'){if(extra<.35)L.bodice=pick(r,[DYE.walnut,DYE.indigo,DYE.moss,DYE.madder,DYE.charcoal].filter(c=>c!==L.main));else if(extra<.6)L.apron=pick(r,[DYE.cream,DYE.linen,DYE.oat]);else if(extra<.72&&!L.hat)L.shawl=pick(r,[DYE.oat,DYE.madder,DYE.moss,DYE.woad]);}
          else if(extra<.3)L.jerkin=pick(r,[LEATHER,0x5b4030,DYE.moss,DYE.indigo,DYE.charcoal]);
          else if(extra<.45&&L.hat!=='hood')L.capelet=pick(r,[DYE.forest,DYE.madder,DYE.woad,DYE.ochre].filter(c=>c!==L.main));
          else if(extra<.62)L.kerchief=pick(r,[DYE.madder,DYE.weld,DYE.cream,DYE.woad]);
          if(r()<.25)L.sleeve='rolled';
          // A capelet sits on the shoulders, so its wearer never folds the arms back through it.
          const pose=pick(r,L.capelet?['free','free','belt']:['free','free','free','belt','behind','hips']);
          L.hold={L:pose,R:pose==='hips'&&r()<.5?'free':pose};
          if(L.elder&&pose==='hips')L.hold={L:'behind',R:'behind'};
        }
      }
    }

    // Body proportions: 4.5 heads for adults, 3.5 for children.
    function frame(L){
      const heads=L.child?3.5:4.5,headH=L.height/heads,hr=headH/2.05,chin=L.height-headH;
      const sy=chin/.965,W=L.width*(L.child?.82:1);
      return {sy,W,hs:hr/.13,hy:chin+hr*.98,hand:L.child?.85:W};
    }

    // Radius of a turned profile at height y (profile runs bottom to top).
    function radiusAt(pts,y){
      if(y<=pts[0][1])return pts[0][0];
      for(let i=1;i<pts.length;i++)if(y<=pts[i][1]){const [r0,y0]=pts[i-1],[r1,y1]=pts[i];return r0+(r1-r0)*(y-y0)/(y1-y0||1);}
      return pts[pts.length-1][0];
    }
    // Extra profile rows every `step`, so stripes and checks have edges to follow.
    function dense(pts,step){
      const out=[pts[0]];
      for(let i=1;i<pts.length;i++){const [r0,y0]=pts[i-1],[r1,y1]=pts[i],n=Math.max(1,Math.round((y1-y0)/step));for(let k=1;k<=n;k++)out.push([r0+(r1-r0)*k/n,y0+(y1-y0)*k/n]);}
      return out;
    }

    // ---- Building one villager ----------------------------------------------
    function make(T,person){
      const L=design(person),P=frame(L),r=rig(T);
      const {W,sy,hs}=P;
      const at=(x,y,z=0)=>[x*W,y*sy,z*W];
      const hd=(x,y,z)=>[x*hs,P.hy+y*hs,z*hs];
      const V=(x,y,z)=>new T.Vector3(x,y,z);
      const eq=(x,y,z)=>new T.Quaternion().setFromEuler(new T.Euler(x,y,z));
      const ball=(rad,pos,color,bone,scale=[1,1,1],rot=[0,0,0],w=12,h=9)=>r.add(unitSphere(T,w,h),color,pos,rot,[scale[0]*rad,scale[1]*rad,scale[2]*rad],bone);
      const long=L.garment==='dress'||L.garment==='robe';
      const skin=L.skin;

      // Skeleton. Body sits at the origin so callers can bob and sway it. Each
      // arm has a swing bone at the shoulder (the walk and gestures) and a hold
      // bone beneath it (how this villager carries their hands).
      const J={chest:at(0,.70),pelvis:at(0,.60),neck:at(0,.935)};
      r.bone('body',null,[0,0,0]);
      r.bone('pelvis','body',J.pelvis);
      r.bone('chest','pelvis',J.chest);
      r.bone('head','chest',J.neck);
      r.bone('skirt','pelvis',at(0,.62));
      r.bone('apron','pelvis',at(0,.64));
      for(const [side,s] of [['L',1],['R',-1]]){
        J[side]={s,shoulder:at(s*.165,.872),elbow:at(s*.2,.662),wrist:at(s*.228,.458),hip:at(s*.085,.52),knee:at(s*.085,.285),ankle:at(s*.085,.075)};
        r.bone('swing'+side,'chest',J[side].shoulder);
        r.bone('arm'+side,'swing'+side,J[side].shoulder);
        r.bone('fore'+side,'arm'+side,J[side].elbow);
        r.bone('hand'+side,'fore'+side,J[side].wrist);
        r.bone('leg'+side,'pelvis',J[side].hip);
        r.bone('shin'+side,'leg'+side,J[side].knee);
        r.bone('foot'+side,'shin'+side,J[side].ankle);
      }

      // The held pose, solved forwards once so props sit where the hands are.
      const turn=(parent,p,rot,order)=>parent.clone().multiply(new T.Matrix4().makeTranslation(p[0],p[1],p[2]))
        .multiply(new T.Matrix4().makeRotationFromEuler(new T.Euler(rot[0],rot[1],rot[2],order||'XYZ')))
        .multiply(new T.Matrix4().makeTranslation(-p[0],-p[1],-p[2]));
      const chestM=turn(new T.Matrix4(),J.chest,[L.stoop,0,0]);
      const holds=[],held={};
      for(const side of ['L','R']){
        const q=sided(HOLDS[L.hold[side]],J[side].s,L.stoop);
        holds.push(q);
        const arm=turn(chestM,J[side].shoulder,[q.sx,q.sy,q.sz]),fore=turn(arm,J[side].elbow,[q.fore,q.twist,0],'YXZ'),hm=turn(fore,J[side].wrist,[q.hx,q.hy,q.hz]);
        const fist=V(J[side].wrist[0],J[side].wrist[1]-.04*P.hand,J[side].wrist[2]).applyMatrix4(hm);
        held[side]={fore,hand:hm,fist,elbow:V(...J[side].elbow).applyMatrix4(arm),wrist:V(...J[side].wrist).applyMatrix4(fore)};
      }
      // Props are modelled in world space at the held pose, then carried back
      // to rest space for the bone they ride on.
      function kit(bone,M){
        const inv=M.clone().invert();
        const put=(g,c)=>{g.applyMatrix4(inv);r.add(g,c,[0,0,0],[0,0,0],[1,1,1],bone);return g;};
        return {
          rod(a,b,r1,r2,c,n=6){const d=b.clone().sub(a),len=d.length(),g=new T.CylinderGeometry(r2,r1,len,n);
            g.applyMatrix4(new T.Matrix4().compose(a.clone().addScaledVector(d,.5),new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()),V(1,1,1)));return put(g,c);},
          shape(g,c,p,q,s){g.applyMatrix4(new T.Matrix4().compose(p,q||new T.Quaternion(),s||V(1,1,1)));return put(g,c);},
          curve(points,radius,c,n=5,segs=8){return put(new T.TubeGeometry(new T.CatmullRomCurve3(points),segs,radius,n,false),c);},
        };
      }
      // An open tapered sleeve between two rest points; its ends hide in the joints.
      function sleeve(a,b,r1,r2,c,bone,blend,n=8){
        const A=V(...a),d=V(...b).sub(A),len=d.length(),g=new T.CylinderGeometry(r2,r1,len,n,1,true);
        g.applyMatrix4(new T.Matrix4().compose(A.addScaledVector(d,.5),new T.Quaternion().setFromUnitVectors(V(0,1,0),d.normalize()),V(1,1,1)));
        return r.add(g,c,[0,0,0],[0,0,0],[1,1,1],bone,blend);
      }
      // A rotation whose local Y runs along y and local Z leans toward z.
      const orient=(y,z)=>{const Y=y.clone().normalize(),Z=z.clone().addScaledVector(Y,-z.dot(Y)).normalize(),X=new T.Vector3().crossVectors(Y,Z);return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(X,Y,Z));};
      // Paints a part in crisp patches: each triangle takes the colour at its
      // centre, so checks, trims and quilting keep clean edges. Triangles of one
      // colour still share their corners.
      function patches(geo,paint,bone,blend,place){
        if(typeof paint!=='function'){if(place)geo.applyMatrix4(place);return r.add(geo,paint,[0,0,0],[0,0,0],[1,1,1],bone,blend);}
        const p=geo.attributes.position.array,n=geo.attributes.normal.array,count=geo.attributes.position.count;
        const index=geo.index?geo.index.array:Array.from({length:count},(_,i)=>i),groups=new Map();
        for(let t=0;t<index.length;t+=3){
          const a=index[t]*3,b=index[t+1]*3,c=index[t+2]*3;
          const colour=paint((p[a]+p[b]+p[c])/3,(p[a+1]+p[b+1]+p[c+1])/3,(p[a+2]+p[b+2]+p[c+2])/3);
          let group=groups.get(colour);if(!group)groups.set(colour,group={map:new Int32Array(count).fill(-1),pos:[],nor:[],tri:[]});
          for(let k=0;k<3;k++){
            const v=index[t+k];
            if(group.map[v]<0){group.map[v]=group.pos.length/3;group.pos.push(p[v*3],p[v*3+1],p[v*3+2]);group.nor.push(n[v*3],n[v*3+1],n[v*3+2]);}
            group.tri.push(group.map[v]);
          }
        }
        for(const [colour,group] of groups){
          const part=new T.BufferGeometry();
          part.setAttribute('position',new T.Float32BufferAttribute(group.pos,3));part.setAttribute('normal',new T.Float32BufferAttribute(group.nor,3));part.setIndex(group.tri);
          if(place)part.applyMatrix4(place);
          r.add(part,colour,[0,0,0],[0,0,0],[1,1,1],bone,blend);
        }
        geo.dispose();
      }
      // A turned profile in body units, already squashed front to back.
      const turned=(pts,depth,n=12,phi=0,arc=TAU)=>{const g=new T.LatheGeometry(pts.map(([a,y])=>new T.Vector2(Math.max(a*W,1e-4),y*sy)),n,phi,arc);g.scale(1,1,depth);return g;};

      // Juggling balls ride their own bones so they can fly between the hands.
      const balls=L.props.includes('balls')?{L:held.L.fist.clone(),R:held.R.fist.clone()}:null;
      if(balls)for(let i=0;i<3;i++)r.bone('ball'+i,'body',[balls.R.x+(balls.L.x-balls.R.x)*i/2,balls.R.y+.12,balls.R.z+.02]);

      const waist={bone:'chest',from:at(0,.63),to:at(0,.76)};
      const skirtBend={bone:'pelvis',from:at(0,.46),to:at(0,.6)};
      const shape=garmentShape();
      legs();torso();overlays();arms();head();hair();beard();hat();props();
      return finish();

      // --- Garment outlines, shared by the cloth and anything worn over it.
      function garmentShape(){
        const b=L.belly,bust=L.female&&!L.child?.01:0,h=L.hem;
        const upper=[[.18+b,.56],[.166+b,.655],[.174+bust,.75],[.176,.82],[.154,.88],[.1,.918],[.05,.938]];
        if(!long){
          const fl=L.garment==='coat'?.225:L.gambeson?.215:.2;
          const outline=[[fl,h],[fl-.012,h+.09],...upper.filter(p=>p[1]>h+.12)];
          let body=L.hemTrim?[outline[0],[fl-.002,h+.035],...outline.slice(1)]:outline;
          if(L.gambeson||L.plaid)body=dense(body,.06);
          return {body,outline,flare:fl,hem:[.06,h+.01]};
        }
        const bodice=[[.15,.56],[.158,.62],[.16,.655],[.174+bust,.75],[.176,.82],[.154,.88],[.1,.918],[.05,.938]];
        const hr=L.garment==='robe'?.25:L.child?.22:.255;
        let skirt=L.child?[[hr,h],[hr-.01,h+.1],[.19,.42],[.172,.54],[.168,.6],[.165,.64],[.1,.665]]
          :[[hr,h],[hr-.012,.14],[.228,.28],[.198,.42],[.176,.54],[.17,.6],[.165,.64],[.1,.665]];
        if(L.hemTrim)skirt=[skirt[0],[hr-.003,h+.04],...skirt.slice(1)];
        return {bodice,outline:bodice,skirt,hem:[.1,h+.01]};
      }

      // --- Legs: trouser or hose, a soft knee, boots with a rounded toe.
      function legs(){
        const fs=(sy+W)/2,bootTop=(L.waders?.3:.16)*sy;
        for(const side of ['L','R']){
          const j=J[side],x=j.hip[0];
          if(!long||L.hem>.2)sleeve([x,j.hip[1]+.05*sy,0],[x,j.knee[1]-.01*sy,0],.07*W,.052*W,L.legs,'leg'+side,{bone:'shin'+side,from:[x,j.knee[1]+.05*sy,0],to:[x,j.knee[1]-.03*sy,0]});
          r.limb([x,j.knee[1]+.015*sy,0],[x,j.ankle[1],0],.052*W,.043*W,(px,py)=>py<bootTop?L.boots:L.legs,'shin'+side,null,8);
          r.cylinder(.056*W,.052*W,.03*sy,[x,bootTop,0],soften(L.boots,.1),'shin'+side,[0,0,0],8,true);
          ball(1,[x,.036*fs,.03*fs],L.boots,'foot'+side,[.047*fs,.04*fs,.088*fs],[0,0,0],6,5);
        }
      }

      // --- Torso: turned profiles that bend at the waist.
      function torso(){
        const main=L.main,depth=.8;
        const cell=L.plaid?plaid(main):L.gambeson?quilt(main):L.motley?(x=>x>0?main:L.trim):null;
        const trimAt=(L.hem+(long?.04:.035))*sy;
        const paint=(x,y,z)=>L.hemTrim&&y<trimAt?L.hemTrim:cell?cell(x,y,z):main;
        if(!long){
          patches(turned([shape.hem,...shape.body],depth),paint,'pelvis',waist);
          // The linen under-tunic peeks out below the hem.
          if(L.underHem){const fl=shape.flare,h=L.hem;r.add(turned([[fl-.016,h-.042],[fl-.006,h-.036],[fl-.01,h+.03]],depth,10),L.shirt,[0,0,0],[0,0,0],[1,1,1],'pelvis');}
        }else{
          const top=L.bodice||main;
          patches(turned(shape.bodice,depth),top,'pelvis',waist);
          patches(turned([shape.hem,...shape.skirt],.86),paint,'skirt',skirtBend);
          if(L.laced)lacing(depth);
        }
        // Belt or sash, buckle, collar.
        const beltR=(radiusAt(shape.outline,.66)+(L.tabard?.02:.007))*W;
        const sash=L.garment==='dress';
        r.add(new T.CylinderGeometry(beltR,beltR,(sash?.045:.036)*sy,12,1,true),L.garment==='robe'?0xcdb68a:sash?(L.bodice?L.main:L.trim):L.belt,at(0,.66),[0,0,0],[1,1,depth],'pelvis',waist);
        if(sash)ball(.026*W,[.1*W,.655*sy,beltR*depth*.8],L.bodice?L.main:L.trim,'pelvis',[1,.8,.6],[0,0,0],6,4);
        else if(L.garment!=='robe')r.box([.04*W,.034*sy,.012],[0,.66*sy,beltR*depth+.004],L.buckle,'pelvis');
        else r.tube([at(.07,.66,.15),at(.085,.56,.2),at(.08,.44,.22)],.008*W,0xcdb68a,'skirt',4,6);
        // The collar shows the linen beneath only when there is linen to show.
        const linen=long||L.underHem||L.sleeve==='puff';
        r.cylinder(.056*W,.066*W,.032*sy,at(0,.94),L.garment==='robe'?L.main:linen?L.shirt:deepen(L.main,.12),'chest',[0,0,0],12,true);
        if(L.pouch){
          r.box([.07*W,.08*sy,.045*W],at(.17,.6,.07),LEATHER,'pelvis',[0,.7,0]);
          r.box([.075*W,.03*sy,.05*W],at(.17,.628,.07),deepen(LEATHER,.25),'pelvis',[0,.7,0]);
        }
      }
      // A kirtle laced up the front over a strip of linen chemise.
      function lacing(depth){
        const lo=.63,hi=.82,zAt=y=>radiusAt(shape.bodice,y)*W*depth,z0=zAt(lo),z1=zAt(hi),tilt=Math.atan2(z1-z0,(hi-lo)*sy);
        r.add(new T.BoxGeometry(.04*W,(hi-lo)*sy,.006),L.shirt,[0,(lo+hi)/2*sy,(z0+z1)/2+.002],[tilt,0,0],[1,1,1],'pelvis',waist);
        for(const y of [.67,.72,.77])r.add(new T.BoxGeometry(.056*W,.009,.006),STRAP,[0,y*sy,zAt(y)+.006],[tilt,0,0],[1,1,1],'pelvis',waist);
      }
      // Which profile row a point sits in, so stripes follow the geometry.
      function row(y){const rows=shape.body;let i=0;while(i<rows.length-1&&y>rows[i+1][1]*sy)i++;return i;}
      function plaid(base){
        const dark=deepen(base,.5),light=soften(base,.15);
        return (x,y,z)=>{const a=row(y)%2===0,b=Math.floor((Math.atan2(x,z)+PI)/(TAU/12))%2===0;return a&&b?dark:a||b?base:light;};
      }
      function quilt(base){const seam=deepen(base,.14);return (x,y)=>row(y)%2?base:seam;}

      // --- Layers over the garment: they follow its outline, a little proud.
      function overlays(){
        const body=shape.outline,out=(pts,from,to,gap=.014)=>pts.filter(([,y])=>y>=from&&y<=to).map(([a,y])=>[a+gap,y]);
        const upper=(from,to,gap)=>[[radiusAt(body,from)+gap,from],...out(body,from+.02,to-.01,gap),[radiusAt(body,to)+gap,to]];
        if(L.tabard){
          const pts=upper(L.hem+.02,.905,.012);
          r.add(turned(pts,.8,5,-.62,1.24),L.tabard,[0,0,0],[0,0,0],[1,1,1],'pelvis',waist);
          ball(.045*W,[0,.77*sy,(radiusAt(body,.77)+.014)*.8*W+.004],L.crest,'chest',[1,1.15,.25],[0,0,0],6,4);
          r.add(turned(pts,.8,5,PI-.62,1.24),L.tabard,[0,0,0],[0,0,0],[1,1,1],'pelvis',waist);
        }
        if(L.jerkin)r.add(turned(upper(Math.max(.48,L.hem+.06),.9,.012),.8,12,.5,TAU-1),L.jerkin,[0,0,0],[0,0,0],[1,1,1],'pelvis',waist);
        if(L.apron){
          if(long){const sk=shape.skirt,pts=[.2,.28,.36,.46,.56,.645].map(y=>[radiusAt(sk,y)+.016,y]);r.add(turned(pts,.86,6,-1,2),L.apron,[0,0,0],[0,0,0],[1,1,1],'skirt',skirtBend);}
          else{const low=L.apronLong?.24:.3,pts=[low,.34,.4,.46,.52,.6,.655].map(y=>[Math.max(radiusAt(body,y),radiusAt(body,L.hem))+.014,y]);r.add(turned(pts,.8,6,-1,2),L.apron,[0,0,0],[0,0,0],[1,1,1],'apron',{bone:'pelvis',from:at(0,.5),to:at(0,.62)});}
          if(L.bib)r.add(turned(upper(.66,.8,.01),.8,4,-.5,1),L.apron,[0,0,0],[0,0,0],[1,1,1],'chest');
        }
        if(L.leatherApron){
          const pts=[.27,.34,.4,.46,.52,.6,.655].map(y=>[Math.max(radiusAt(body,y),radiusAt(body,L.hem))+.016,y]);
          r.add(turned(pts,.8,6,-.95,1.9),LEATHER,[0,0,0],[0,0,0],[1,1,1],'apron',{bone:'pelvis',from:at(0,.5),to:at(0,.62)});
          r.add(turned(upper(.655,.86,.014),.8,4,-.6,1.2),LEATHER,[0,0,0],[0,0,0],[1,1,1],'chest');
        }
        // Shoulder cape, roomy enough that swinging arms stay beneath it, and a hood lying down the back.
        if(L.capelet||L.hat==='hood'){
          const c=L.capelet||L.hatColour;
          r.lathe([[.282,.68],[.278,.75],[.256,.83],[.216,.9],[.14,.95],[.075,.97]].map(([a,y])=>[a*W,y*sy]),[0,0,0],c,'chest',[1,1,.9],[0,0,0],12);
          if(L.capelet)ball(.1*W,at(0,.85,-.2),deepen(c,.08),'chest',[1.3,.5,.3],[-.25,0,0],8,5);
        }
        if(L.shawl)r.lathe([[.215,.74],[.215,.8],[.2,.86],[.15,.915],[.075,.945]].map(([a,y])=>[a*W,y*sy]),[0,0,0],L.shawl,'chest',[1,1,.84],[0,0,0],12);
        if(L.kerchief){
          r.cylinder(.062*W,.072*W,.035*sy,at(0,.935),L.kerchief,'chest',[0,0,0],10,true);
          r.add(new T.ConeGeometry(.045*W,.09*sy,3),L.kerchief,at(0,.885,.105),[PI-.25,0,0],[1,1,.35],'chest');
        }
        if(L.fur){
          r.add(new T.TorusGeometry(.12*W,.042*W,3,12),L.fur,at(0,.905),[PI/2,0,0],[1,.86,1],'chest');
          if(!long)r.add(new T.CylinderGeometry((radiusAt(body,L.hem)+.006)*W,(radiusAt(body,L.hem)+.008)*W,.045*sy,12,1,true),L.fur,at(0,L.hem+.02),[0,0,0],[1,1,.8],'pelvis');
        }
        if(L.garment==='robe')r.add(new T.TorusGeometry(.115*W,.045*W,4,12),L.main,at(0,.9,-.015),[PI/2+.25,0,0],[1,.9,1],'chest');
      }
      // --- Arms: rounded shoulder, sleeve easing into the elbow, mitten hands.
      // Dresses and the bard keep a puffed sleeve; working folk have a trim shoulder.
      function arms(){
        const hsz=P.hand,puff=L.sleeve==='puff'||(L.garment==='dress'&&!L.bodice);
        const knob=(puff?.07:L.gambeson?.06:L.capelet?.048:.052)*W,top=(puff?.054:L.gambeson?.06:.05)*W;
        for(const side of ['L','R']){
          const j=J[side],s=j.s;
          const cloth=L.gambeson||L.garment==='robe'?L.main:L.garment==='dress'?(L.bodice?L.shirt:L.main):L.sleeve==='puff'?L.shirt:L.main;
          const cuffColour=L.garment==='dress'?L.shirt:L.hemTrim||L.trim;
          const bare=L.sleeve==='rolled';
          ball(knob,j.shoulder,cloth,'arm'+side,[1,1,1],[0,0,0],8,4);
          const bend={bone:'fore'+side,from:[j.shoulder[0]*.3+j.elbow[0]*.7,j.shoulder[1]*.3+j.elbow[1]*.7,0],to:[j.elbow[0]*.85+j.wrist[0]*.15,j.elbow[1]*.85+j.wrist[1]*.15,0]};
          sleeve(j.shoulder,j.elbow,top,.046*W,cloth,'arm'+side,bend);
          r.limb(j.elbow,j.wrist,.046*W,.037*W,bare?skin:cloth,'fore'+side,null,8);
          if(bare)r.cylinder(.052*W,.05*W,.035*sy,[j.elbow[0],j.elbow[1]-.012*sy,0],cloth,'fore'+side,[0,0,s*.14],8,true);
          else if(L.garment==='robe')r.cylinder(.05*W,.078*W,.17*sy,[(j.elbow[0]+j.wrist[0])/2+s*.006,(j.elbow[1]+j.wrist[1])/2-.02*sy,0],L.main,'fore'+side,[0,0,s*.14],9,true);
          else r.cylinder(.042*W,.045*W,.03*sy,[j.wrist[0]-s*.002,j.wrist[1]+.012*sy,0],cuffColour,'fore'+side,[0,0,s*.14],8,true);
          ball(.044*hsz,[j.wrist[0],j.wrist[1]-.04*hsz,.004],skin,'hand'+side,[.74,.98,.9],[0,0,0],6,5);
          ball(.017*hsz,[j.wrist[0]-s*.014*hsz,j.wrist[1]-.03*hsz,.03*hsz],skin,'hand'+side,[1,1,1],[0,0,0],5,3);
        }
      }

      // --- Head and face. Features sit on the surface of a 0.13 sphere.
      function head(){
        const depth=(x,y)=>.126*Math.sqrt(Math.max(0,1-(x/.13)**2-(y/.135)**2));
        r.limb(at(0,.88),hd(0,-.095,-.01),.05*hs,.047*hs,skin,'chest',{bone:'head',from:at(0,.915),to:hd(0,-.1,0)},8);
        // A soft shadow of stubble along the jaw, never a dirty chin.
        const blush=mix(skin,0xf0606a,.4),stubble=L.beard==='short'?mix(skin,L.hair,.28):0;
        const face=(x,y,z)=>{
          const u=Math.abs(x)/hs,v=(y-P.hy)/hs,w=z/hs;let c=skin;
          if(stubble)c=mix(c,stubble,smooth(-.05,-.1,v)*smooth(-.06,.02,w));
          const du=u-.07,dv=v+.042,dw=w-.1;
          return mix(c,blush,Math.exp(-(du*du+dv*dv+dw*dw)/.0014)*.7);
        };
        ball(.13*hs,[0,P.hy,0],face,'head',[1,1.04,.97],[0,0,0],14,10);
        const eye=L.child?.024:.021;
        for(const s of [1,-1]){
          const ex=s*.047,ey=-.014;
          ball(.034*hs,hd(s*.128,-.02,-.006),mix(skin,0xd07060,.12),'head',[.45,1,.75],[0,0,0],5,4);
          ball(eye*hs,hd(ex,ey,depth(ex,ey)-.004),L.eyes,'head',[.92,1.22,.55],[0,s*.37,0],6,4);
          ball(.0068*hs,hd(ex+.007,ey+.008,depth(ex+.007,ey+.008)+.004),0xffffff,'head',[1,1,.6],[0,0,0],4,3);
          ball(.024*hs,hd(s*.05,.034,depth(s*.05,.034)+.001),deepen(L.hair,L.elder?0:.25),'head',[1,L.elder?.38:.26,.34],[0,s*.38,-s*.12],6,3);
          if(L.female&&!L.child)r.box([.012*hs,.004*hs,.004*hs],hd(s*.068,ey+.012,depth(.068,ey)-.004),L.eyes,'head',[0,s*.5,s*.5]);
        }
        ball(.021*hs,hd(0,-.04,depth(0,-.04)+.002),mix(skin,blush,.35),'head',[1.1,.85,.85],[0,0,0],6,4);
        const lips=L.beard==='full'||L.beard==='long'?.012:0;
        r.add(new T.TorusGeometry(.016*hs,.0042*hs,3,6,PI),0x74322b,hd(0,-.074,depth(0,-.074)+.001+lips),[.45,0,PI],[1,1,1],'head');
        if(L.specs)for(const s of [1,-1])r.add(new T.TorusGeometry(.03*hs,.0038*hs,3,8),0x5a4632,hd(s*.047,-.014,depth(s*.047,-.014)+.012),[0,s*.3,0],[1,1,1],'head');
        if(L.headband)r.add(new T.TorusGeometry(.137*hs,.012*hs,3,14),DYE.madder,hd(0,.05,-.01),[PI/2-.3,0,0],[1.02,1.02,1],'head');
      }

      // --- Hair: a shell whose hairline is drawn per style (bangs, parts,
      // scalloped locks), then buns, braids and tails on top. The shell thins
      // to lie flush on the scalp at its edge, so no lip or loose strand shows.
      function hair(){
        const c=L.hair,shine=soften(c,.28),style=L.hairStyle;
        const paint=(x,y,z)=>{const v=(y-P.hy)/hs,w=z/hs;return mix(c,shine,Math.exp(-((v-.1)**2)/.0007)*smooth(.02,.1,w)*.55);};
        const toChest={bone:'chest',from:hd(0,-.1,0),to:hd(0,-.24,0)};
        if(style==='tonsure'||style==='bald'){
          r.add(new T.TorusGeometry(.126*hs,.03*hs,4,12,style==='bald'?PI*1.25:TAU),paint,hd(0,.03,-.012),[PI/2-.32,0,style==='bald'?PI*1.375:0],[1.03,1.03,.62],'head');
          return;
        }
        // Hairline as a polar angle from the crown, by direction round the head
        // (a=0 at the face): front, sides, back, lock depth and count, parting, volume.
        const S={crop:[.95,1.5,2.1,.04,5,0,1.045],fringe:[1.12,1.6,2.15,.035,10,0,1.06],shaggy:[1.05,1.7,2.3,.07,5,0,1.075],curly:[.98,1.55,2.15,.05,5,0,1.07],
          bob:[1.12,2.0,2.2,.03,10,0,1.085],bun:[.98,1.66,2.15,.02,5,.26,1.05],braids:[.98,1.66,2.15,.02,5,.26,1.05],pigtails:[1.1,1.64,2.15,.04,5,0,1.06],
          ponytail:[.98,1.62,2.1,.02,5,.26,1.05],long:[1.02,1.8,2.3,.04,5,.26,1.06]}[style];
        // Under a hat the hair lies flat and only its edge shows, so the shell is
        // coarser there (and a touch proud of the scalp, to cover its flat facets).
        const [front,sides,back,lockDepth,count,part]=S,size=L.hat?1.04:S[6],flush=L.hat?1.035:1.012,locks=L.hat?0:lockDepth;
        // Locks scallop the fringe and the nape but fade out over the ears.
        const rim=a=>{const k=Math.cos(a),edge=k>0?sides+(front-sides)*Math.pow(k,1.6):sides+(back-sides)*Math.pow(-k,1.3);
          return edge+locks*(.5-.5*Math.cos(a*count*2))*smooth(.2,.7,Math.abs(k))-part*Math.exp(-a*a/.02);};
        const g=L.hat?new T.SphereGeometry(1,14,4,0,TAU,0,1):new T.SphereGeometry(1,20,6,0,TAU,0,1),pa=g.attributes.position,na=g.attributes.normal;
        for(let i=0;i<pa.count;i++){
          const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i),v=Math.acos(clamp(y,-1,1)),a=Math.atan2(x,z);
          const t=v*rim(a),edge=smooth(.55,1,v),bump=style==='curly'?.05*Math.abs(Math.sin(a*5)*Math.sin(t*6))*(1-edge):0;
          const rad=.13*(size+(flush-size)*edge)*(1+bump+(style==='bob'?.06*smooth(1.2,2,t)*(1-smooth(.85,1,v)):0));
          const nx=Math.sin(t)*Math.sin(a),ny=Math.cos(t),nz=Math.sin(t)*Math.cos(a);
          pa.setXYZ(i,nx*rad*hs,ny*rad*1.04*hs,nz*rad*(.99-.015*edge)*hs);na.setXYZ(i,nx,ny,nz);
        }
        r.add(g,L.hat?c:paint,[0,P.hy,0],[0,0,0],[1,1,1],'head');
        switch(style){
          case 'bun':
            // A high bun on a bare head; under a brim it is pinned low at the nape.
            if(!L.hat){
              ball(.058*hs,hd(0,.09,-.105),paint,'head',[1,.95,1],[0,0,0],8,6);
              r.add(new T.TorusGeometry(.04*hs,.009*hs,3,10),deepen(c,.3),hd(0,.07,-.085),[.9,0,0],[1,1,1],'head');
            }else if(!COVERS.has(L.hat))ball(.042*hs,hd(0,-.05,-.118),c,'head',[1.1,.9,.9],[0,0,0],8,5);
            break;
          case 'ponytail':
            r.add(new T.TorusGeometry(.024*hs,.009*hs,3,8),L.trim,hd(0,.02,-.135),[.3,0,0],[1,1,1],'head');
            r.add(new T.TubeGeometry(new T.CatmullRomCurve3([V(...hd(0,.02,-.13)),V(...hd(0,-.06,-.19)),V(...hd(0,-.2,-.17)),V(...hd(0,-.3,-.13))]),6,.03*hs,4,false),paint,[0,0,0],[0,0,0],[1,1,1],'head',toChest);
            break;
          case 'braids':
            for(const s of [1,-1]){
              r.add(new T.TubeGeometry(new T.CatmullRomCurve3([V(...hd(s*.1,-.02,-.07)),V(...hd(s*.125,-.14,-.02)),V(...hd(s*.115,-.28,.05))]),6,.024*hs,4,false),paint,[0,0,0],[0,0,0],[1,1,1],'head',toChest);
              ball(.02*hs,hd(s*.115,-.3,.052),L.trim,'head',[1,1,1],[0,0,0],5,4);
            }
            break;
          case 'pigtails':
            for(const s of [1,-1])ball(.05*hs,hd(s*.14,-.01,-.04),paint,'head',[1,1.2,1],[0,0,s*.4],6,5);break;
          case 'long':
            r.add(new T.SphereGeometry(.146*hs,10,6,PI*1.5-1.45,2.9,.9,1.75),paint,hd(0,-.07,-.01),[0,0,0],[1.04,1.5,1.02],'head',toChest);break;
        }
      }

      function beard(){
        const c=L.hair,b=L.beard;if(!b||b==='short')return;
        if(b==='full'||b==='long'){
          ball(.1*hs,hd(0,-.085,.04),c,'head',[1.08,.92,.74],[0,0,0],10,6);
          if(b==='long')r.add(unitSphere(T,8,6),c,hd(0,-.19,.055),[.25,0,0],[.95*.085*hs,1.5*.085*hs,.6*.085*hs],'head',{bone:'chest',from:hd(0,-.12,0),to:hd(0,-.28,0)});
        }
        if(b==='goatee')ball(.032*hs,hd(0,-.123,.092),c,'head',[1,1.25,.8],[0,0,0],6,4);
        for(const s of [1,-1])ball(.023*hs,hd(s*.024,-.06,.118+(b==='full'||b==='long'?.006:0)),c,'head',[1.25,.55,.62],[0,0,-s*.38],6,4);
      }

      // --- Hats. Brims are turned under and back over the top, so their faces
      // point outward and felt and straw show real thickness.
      function hat(){
        const k=L.hat;if(!k)return;
        const c=L.hatColour||DYE.linen;
        const lathe=(pts,col,pos,rot,n=14,phi=0,arc=TAU)=>r.add(new T.LatheGeometry(pts.map(([a,y])=>new T.Vector2(a*hs,y*hs)),n,phi,arc),col,hd(pos[0],pos[1],pos[2]),rot,[1,1,1],'head');
        const dome=(theta,tilt,col,rad=.15,sc=[1.03,1.05,1.03],y=.004,n=12)=>r.add(new T.SphereGeometry(rad*hs,n,6,0,TAU,0,theta),col,hd(0,y,-.004),[tilt,0,0],sc,'head');
        const rolled=(col,from)=>(x,y,z)=>Math.hypot(x,z)>from*hs?deepen(col,.22):col;
        switch(k){
          case 'straw':{
            const place=new T.Matrix4().compose(V(...hd(0,.08,0)),eq(-.08,0,0),V(1,1,1)),band=L.trade==='farmer'?DYE.madder:L.hatColour;
            patches(new T.LatheGeometry([[.12,-.016],[.262,-.042],[.25,-.028],[.18,-.012],[.12,.0]].map(([a,y])=>new T.Vector2(a*hs,y*hs)),14),
              (x,y)=>y<-.03*hs?deepen(STRAW,.12):Math.hypot(x,y)<.18*hs?STRAW:soften(STRAW,.1),'head',null,place);
            patches(new T.LatheGeometry([[.125,-.012],[.128,.004],[.124,.03],[.108,.07],[.07,.095],[.0,.102]].map(([a,y])=>new T.Vector2(a*hs,y*hs)),12),
              (x,y)=>y<.03*hs?band:STRAW,'head',null,place);
            break;}
          case 'wide':
            lathe([[.13,-.02],[.24,-.064],[.288,-.09],[.29,-.075],[.24,-.035],[.13,0]],rolled(c,.27),[0,.075,0],[-.12,0,0],14);
            lathe([[.13,-.012],[.134,.03],[.114,.07],[.0,.08]],c,[0,.075,0],[-.12,0,0],12);
            break;
          case 'felt':
            lathe([[.122,-.014],[.2,-.022],[.224,-.01],[.218,.004],[.19,-.002],[.122,.006]],rolled(deepen(c,.06),.205),[0,.07,0],[-.1,0,0],12);
            dome(PI/2,-.1,c,.128,[1,1.05,1],.08,12);
            r.add(new T.CylinderGeometry(.133*hs,.134*hs,.024*hs,12,1,true),L.trim,hd(0,.092,-.012),[-.1,0,0],[1,1,1],'head');
            break;
          case 'kettle':{
            // A medieval kettle hat: a low steel dome, a broad drooping brim,
            // a comb along the crown and a leather strap under the chin.
            const tilt=[-.06,0,0];
            lathe([[.15,0],[.148,.02],[.132,.048],[.102,.071],[.066,.086],[0,.096]],STEEL,[0,.05,0],tilt,12);
            lathe([[.146,-.012],[.272,-.07],[.276,-.058],[.21,-.02],[.146,.004]],deepen(STEEL,.16),[0,.05,0],tilt,12);
            r.add(new T.TorusGeometry(.091*hs,.012*hs,3,6,2.2),soften(STEEL,.1),hd(0,.05,0),[-.06,PI/2,PI/2-1.1],[1,1,.5],'head');
            r.add(new T.TubeGeometry(new T.CatmullRomCurve3([V(...hd(.13,.03,0)),V(...hd(.118,-.07,.03)),V(...hd(.06,-.13,.06)),V(...hd(-.06,-.13,.06)),V(...hd(-.118,-.07,.03)),V(...hd(-.13,.03,0))]),6,.006*hs,3,false),STRAP,[0,0,0],[0,0,0],[1,1,1],'head');
            break;}
          case 'beret':
            ball(.155*hs,hd(.02,.1,-.01),c,'head',[1.05,.42,1.02],[-.15,0,-.18],12,6);
            ball(.06*hs,hd(-.08,.19,-.07),0xf4efe4,'head',[.28,1.6,.5],[.6,0,.5],6,4);
            ball(.04*hs,hd(-.07,.16,-.055),DYE.madder,'head',[.3,1.3,.5],[.4,0,.4],5,4);
            break;
          case 'knit':
            dome(1.75,-.4,c,.15,[1.02,1.12,1.02]);
            r.add(new T.TorusGeometry(.143*hs,.024*hs,3,12),deepen(c,.15),hd(0,.031,-.024),[PI/2-.4,0,0],[1.03,1.03,1.03],'head');
            ball(.035*hs,hd(0,.19,-.03),soften(c,.2),'head',[1,1,1],[0,0,0],6,4);
            break;
          case 'leather':
            dome(1.55,-.35,LEATHER,.148);
            lathe([[.13,-.01],[.182,-.03],[.18,-.02],[.13,0]],deepen(LEATHER,.1),[0,.07,.02],[-.2,0,0],8,-.8,1.6);
            r.cylinder(.012*hs,.012*hs,.04*hs,hd(0,.15,.07),0xf2e6c4,'head',[.4,0,0],5);
            ball(.009*hs,hd(0,.178,.082),0xffc64a,'head',[1,1.6,1],[0,0,0],4,3);
            break;
          case 'scarf':
            dome(1.72,-.62,c,.148,[1.04,1.06,1.05]);
            ball(.035*hs,hd(0,-.02,-.16),deepen(c,.1),'head',[1,1,.8],[0,0,0],6,4);
            ball(.035*hs,hd(.02,-.09,-.155),c,'head',[.6,1.5,.4],[.2,0,.2],5,4);
            break;
          case 'kerchief':
            dome(1.45,-.78,c,.147,[1.04,1.05,1.05]);
            ball(.03*hs,hd(0,-.05,-.15),deepen(c,.1),'head',[1,1,.8],[0,0,0],6,4);
            r.add(new T.ConeGeometry(.05*hs,.1*hs,3),c,hd(0,-.1,-.14),[PI+.3,0,0],[1,1,.35],'head');
            break;
          case 'coif':
            // A close linen cap: a seam over the crown and a rolled edge round the face.
            dome(1.7,-.6,c,.147,[1.04,1.06,1.04]);
            r.add(new T.TorusGeometry(.148*hs,.008*hs,3,12,PI),deepen(c,.12),hd(0,.004,-.004),[-.6,PI/2,0],[1.04,1.06,1.04],'head');
            r.add(new T.TorusGeometry(.147*hs*Math.sin(1.7),.013*hs,3,12),soften(c,.1),V(...hd(0,.004,-.004)).add(V(0,.147*hs*Math.cos(1.7)*1.06,0).applyEuler(new T.Euler(-.6,0,0))).toArray(),[PI/2-.6,0,0],[1.04,1.04,1.06],'head');
            break;
          case 'flatcap':
            dome(1.3,-.3,c,.152,[1.06,.9,1.1],.02);
            lathe([[.12,-.01],[.172,-.03],[.17,-.02],[.12,0]],deepen(c,.12),[0,.075,.03],[-.15,0,0],8,-.8,1.6);
            break;
          case 'hood':
            dome(2.25,-1.0,c,.158,[1.05,1.06,1.06]);
            r.add(new T.ConeGeometry(.06*hs,.18*hs,6),c,hd(0,.02,-.19),[-2.0,0,0],[1,1,1],'head');
            break;
          case 'chaperon':
            r.add(new T.TorusGeometry(.13*hs,.042*hs,4,12),c,hd(0,.085,-.01),[PI/2-.12,0,0],[1.05,1.02,1],'head');
            ball(.13*hs,hd(0,.14,-.02),deepen(c,.08),'head',[1,.6,1],[-.1,0,0],10,5);
            r.add(new T.TubeGeometry(new T.CatmullRomCurve3([V(...hd(.1,.1,-.06)),V(...hd(.17,.0,-.08)),V(...hd(.16,-.16,-.06))]),6,.025*hs,4,false),c,[0,0,0],[0,0,0],[1,1,1],'head',{bone:'chest',from:hd(0,-.04,0),to:hd(0,-.16,0)});
            break;
          case 'jester':{
            dome(1.55,-.4,x=>x>0?L.main:L.trim,.15);
            for(const s of [1,-1]){
              r.add(new T.TubeGeometry(new T.CatmullRomCurve3([V(...hd(s*.06,.13,0)),V(...hd(s*.2,.2,-.02)),V(...hd(s*.28,.08,-.02))]),6,.03*hs,5,false),s>0?L.main:L.trim,[0,0,0],[0,0,0],[1,1,1],'head');
              ball(.024*hs,hd(s*.285,.05,-.02),DYE.weld,'head',[1,1,1],[0,0,0],6,4);
            }
            break;}
        }
      }

      // --- Props, by trade.
      function props(){
        const fl=held.L.fist,fr=held.R.fist;
        for(const p of L.props)switch(p){
          case 'spear':{const k=kit('handR',held.R.hand);k.rod(V(fr.x,.02,fr.z),V(fr.x,1.6,fr.z),.014,.012,WOOD,6);
            k.shape(new T.ConeGeometry(.03,.13,6),0xb8c0c6,V(fr.x,1.67,fr.z));
            k.shape(new T.BoxGeometry(.006,.075,.12),L.tabard,V(fr.x,1.52,fr.z-.07));break;}
          case 'shield':{
            const cy=.74*sy;
            patches(new T.CylinderGeometry(.155*W,.155*W,.03,12).rotateX(PI/2).translate(0,cy,-.2*W),(x,y,z)=>z<-.2*W-.012?((x>0)!==(y>cy)?L.tabard:L.crest):deepen(WOOD,.1),'chest');
            ball(.035*W,at(0,.74,-.22),STEEL,'chest',[1,1,.6],[0,0,0],6,4);break;}
          case 'rod':{const k=kit('handR',held.R.hand),d=V(-.12,.86,.5).normalize();
            const tip=fr.clone().addScaledVector(d,1.1).add(V(0,-.07,0));
            k.curve([fr.clone().addScaledVector(d,-.12),fr.clone().addScaledVector(d,.6),tip],.009,WOOD,4,6);
            k.rod(fr.clone().addScaledVector(d,-.12),fr.clone().addScaledVector(d,.1),.016,.014,0x5a3a26,6);
            // A line thick enough to read as one stroke from across the square.
            k.rod(tip,V(tip.x,.45,tip.z),.005,.005,0xbdb39c,5);
            k.shape(unitSphere(T,6,4),(x,y)=>y>.45?0xd8453a:0xf4efe4,V(tip.x,.45,tip.z),null,V(.022,.022,.022));break;}
          case 'creel':patches(new T.BoxGeometry(.08*W,.1*sy,.13*W,1,3,1).translate(...at(.21,.5,-.02)),(x,y)=>Math.floor(y/sy*60)%2?STRAW:deepen(STRAW,.18),'pelvis');
            r.box([.085*W,.02*sy,.135*W],at(.21,.56,-.02),deepen(STRAW,.25),'pelvis');break;
          case 'lute':{
            // A pear-shaped lute across the belly, its neck up to the fretting hand.
            const k=kit('chest',chestM),centre=fr.clone().add(V(.0,-.02,-.06)),neck=fl.clone().sub(centre).normalize(),q=orient(neck,V(0,0,1));
            const pear=[[0,-.13],[.07,-.12],[.105,-.07],[.11,-.01],[.09,.06],[.05,.12],[.025,.15]];
            k.shape(new T.LatheGeometry(pear.map(([a,y])=>new T.Vector2(a,y)),10,PI/2,PI),0x8e5428,centre,q,V(1,1,.55));
            const rose=centre.clone().addScaledVector(neck,.035);
            k.shape(new T.ShapeGeometry(new T.Shape(pear.map(([a,y])=>new T.Vector2(a,y)).concat(pear.slice().reverse().map(([a,y])=>new T.Vector2(-a,y))))),
              (x,y,z)=>Math.hypot(x-rose.x,y-rose.y,z-rose.z)<.032?0x3a2418:0xe3bb78,centre.clone().addScaledVector(V(0,0,1).applyQuaternion(q),.002),q);
            k.rod(centre.clone().addScaledVector(neck,.14),fl.clone().addScaledVector(neck,.05),.016,.013,0x5e3a20,4);
            k.shape(new T.BoxGeometry(.036,.085,.02),0x4e3020,fl.clone().addScaledVector(neck,.09).add(V(0,0,-.022)),q.clone().multiply(eq(-.55,0,0)));
            k.shape(new T.BoxGeometry(.05,.012,.012),0x3a2418,centre.clone().addScaledVector(neck,-.07).addScaledVector(V(0,0,1).applyQuaternion(q),.008),q);
            break;}
          case 'staff':{const k=kit('handR',held.R.hand),top=V(fr.x,fr.y+.24,fr.z+.01);
            k.curve([V(fr.x+.01,.01,fr.z+.03),V(fr.x-.01,fr.y*.5,fr.z+.01),top],.017,0x7a5a3c,5,8);
            k.shape(unitSphere(T,6,5),0x6a4a30,top,null,V(.03,.03,.03));break;}
          case 'pinwheel':{const k=kit('handR',held.R.hand),top=V(fr.x,fr.y+.3,fr.z+.02);
            k.rod(V(fr.x,fr.y-.06,fr.z),top,.008,.008,0xd8c08a,4);
            [DYE.madder,DYE.weld,DYE.woad,DYE.moss].forEach((c,i)=>k.shape(new T.BoxGeometry(.075,.035,.006),c,top.clone().add(V(Math.cos(i*PI/2)*.036,Math.sin(i*PI/2)*.036,.01)),eq(0,0,i*PI/2+.4)));
            k.shape(unitSphere(T,4,3),DYE.cream,top.clone().add(V(0,0,.018)),null,V(.012,.012,.012));break;}
          case 'basket':{const k=kit('foreL',held.L.fore),c=held.L.elbow.clone().lerp(held.L.wrist,.45).add(V(0,-.13,0));
            k.shape(new T.LatheGeometry([[0,-.05],[.075,-.05],[.095,.035],[.088,.04],[.07,.015]].map(([a,y])=>new T.Vector2(a,y)),10),(x,y)=>Math.floor((y-c.y)*70+5)%2?0xb8894c:0x94693a,c);
            k.shape(new T.TorusGeometry(.085,.008,3,8,PI),0x94693a,c.clone().add(V(0,.02,0)),eq(0,PI/2,0));
            [[.03,.03,0,0xc8413a],[-.035,.035,.02,0xd9a441],[0,.04,-.035,0x9fbf4a]].forEach(([x,y,z,col])=>k.shape(unitSphere(T,5,4),col,c.clone().add(V(x,y,z)),null,V(.035,.035,.035)));break;}
          case 'hammer':{const k=kit('handR',held.R.hand),fwd=V(0,0,1).applyQuaternion(new T.Quaternion().setFromRotationMatrix(held.R.hand)),head=fr.clone().addScaledVector(fwd,.2);
            k.rod(fr.clone().addScaledVector(fwd,-.05),head,.012,.011,WOOD,5);
            k.shape(new T.BoxGeometry(.045,.11,.045),L.trade==='smith'?0x5d6166:0x8a8f94,head,orient(fwd,V(0,1,0)).multiply(eq(PI/2,0,0)));break;}
          case 'plank':{const k=kit('chest',chestM),sh=V(...J.L.shoulder).add(V(.06*W,.06*sy,0)),d=V(fl.x,fl.y,fl.z).sub(sh).setX(0).normalize();
            k.shape(new T.BoxGeometry(.085,.024,.95),(x,y,z)=>y>sh.y+.005?0xc49663:0xa87a4a,sh.clone().addScaledVector(d,.1).add(V(0,0,-.2)),orient(V(0,1,0),d));break;}
          case 'pitchfork':{const k=kit('handR',held.R.hand),top=V(fr.x,fr.y+.55,fr.z);
            k.rod(V(fr.x,.02,fr.z),top,.014,.013,WOOD,5);
            k.rod(top.clone().add(V(-.06,0,0)),top.clone().add(V(.06,0,0)),.008,.008,0x7d8388,4);
            for(const x of [-.055,0,.055])k.rod(top.clone().add(V(x,0,0)),top.clone().add(V(x*1.1,.16,0)),.007,.004,0x8a9096,4);break;}
          case 'axe': case 'pick':{const k=kit('handR',held.R.hand),sh=V(...J.R.shoulder).add(V(0,.07,0)).applyMatrix4(chestM);
            const d=sh.clone().add(V(-.09*W,.16,-.2)).sub(fr).normalize(),end=fr.clone().addScaledVector(d,.56);
            k.rod(fr.clone().addScaledVector(d,-.1),end,.014,.013,WOOD,5);
            // The head points out behind the shoulder so it reads in silhouette.
            const q=orient(d,V(-1,0,-.4)),out=V(0,0,1).applyQuaternion(q),at2=end.clone().addScaledVector(d,-.05);
            if(p==='axe'){k.shape(new T.BoxGeometry(.026,.12,.09),0x8c949a,at2.clone().addScaledVector(out,.05),q);k.shape(new T.BoxGeometry(.03,.16,.03),0xdfe4e7,at2.clone().addScaledVector(out,.1),q);}
            else{k.shape(new T.ConeGeometry(.022,.2,5),0x80878d,at2.clone().addScaledVector(out,.1),q.clone().multiply(eq(PI/2,0,0)));k.shape(new T.ConeGeometry(.022,.14,5),0x80878d,at2.clone().addScaledVector(out,-.07),q.clone().multiply(eq(-PI/2,0,0)));}
            break;}
          case 'tankard':{const k=kit('handR',held.R.hand),c=fr.clone().add(V(.045,.035,.02));
            k.shape(new T.CylinderGeometry(.036,.04,.085,8),(x,y)=>y>c.y+.04?0xf5efdf:0x8e6a44,c);
            k.shape(new T.TorusGeometry(.025,.007,3,6,PI),0x6e4e32,c.clone().add(V(-.036,0,0)),eq(0,0,PI/2));break;}
          case 'buckets':
            for(const side of ['L','R']){const k=kit('hand'+side,held[side].hand),c=held[side].fist.clone().add(V(0,-.15,0));
              k.shape(new T.CylinderGeometry(.078,.064,.12,9),(x,y)=>Math.abs(y-c.y)>.035&&Math.abs(y-c.y)<.048?0x4c4a48:0x9b6c40,c);
              k.shape(new T.CircleGeometry(.072,8),0x6aa6c8,c.clone().add(V(0,.056,0)),eq(-PI/2,0,0));
              k.shape(new T.TorusGeometry(.078,.005,3,6,PI),0x4c4a48,c.clone().add(V(0,.06,0)),eq(0,PI/2,0));}
            break;
          case 'bow':{const k=kit('handL',held.L.hand);
            k.curve([V(fl.x,fl.y+.45,fl.z-.04),V(fl.x,fl.y+.22,fl.z+.03),V(fl.x,fl.y,fl.z+.055),V(fl.x,fl.y-.22,fl.z+.03),V(fl.x,fl.y-.42,fl.z-.04)],.011,0x6e4424,4,10);
            k.rod(V(fl.x,fl.y+.44,fl.z-.04),V(fl.x,fl.y-.41,fl.z-.04),.004,.004,0xd8d0bc,4);break;}
          case 'quiver':
            r.cylinder(.05*W,.042*W,.34*sy,at(-.07,.74,-.18),LEATHER,'chest',[.2,0,.35],8);
            for(const i of [0,1,2])r.cone(.018*W,.06*sy,at(-.14+i*.018,.93,-.2+i*.015),i===1?DYE.madder:DYE.cream,'chest',[.2,0,.35],4);
            break;
          case 'book':{const k=kit('handR',held.R.hand),c=fr.clone().lerp(fl,.5).add(V(0,.03,.03));
            k.shape(new T.BoxGeometry(.13,.17,.035),(x,y,z)=>z>c.z+.015||Math.abs(x-c.x)>.06?0x7a2f28:0xf1e6c8,c,eq(-.25,0,0));break;}
          case 'purse':ball(.045*W,at(-.15,.6,.1),0x8a5a38,'pelvis',[1,1.15,.7],[0,0,0],6,5);r.cylinder(.012*W,.02*W,.03*sy,at(-.15,.655,.1),0x8a5a38,'pelvis',[0,0,0],5);break;
          case 'cane':{const k=kit('handR',held.R.hand);k.rod(V(fr.x,.02,fr.z+.02),V(fr.x,fr.y+.04,fr.z),.011,.011,0x3e2a1f,5);k.shape(unitSphere(T,6,4),BRASS,V(fr.x,fr.y+.05,fr.z),null,V(.022,.022,.022));break;}
          case 'sack':{const sh=V(...J.R.shoulder);
            ball(.17*W,[sh.x-.01,sh.y+.12*sy,-.12*W],(x,y)=>y>sh.y+.25*sy?deepen(0xc6ad7c,.15):0xc6ad7c,'chest',[.9,1.25,.85],[.5,0,-.3],10,6);
            r.cylinder(.03*W,.045*W,.06,[sh.x,sh.y+.02,.08*W],0xb09a6c,'chest',[1.1,0,0],6);break;}
          case 'balls':
            for(let i=0;i<3;i++)ball(.035,[balls.R.x+(balls.L.x-balls.R.x)*i/2,balls.R.y+.12,balls.R.z+.02],[DYE.madder,DYE.weld,DYE.woad][i],'ball'+i,[1,1,1],[0,0,0],6,5);
            break;
          case 'scroll':{const k=kit('handL',held.L.hand),c=fl.clone().add(V(-.05,.02,.03));
            k.rod(c.clone().add(V(-.08,0,0)),c.clone().add(V(.08,0,0)),.02,.02,0xf0e2bf,6);
            k.shape(new T.BoxGeometry(.15,.13,.004),0xf5ecd4,c.clone().add(V(0,-.07,.012)),eq(-.3,0,0));break;}
          case 'quill':r.add(new T.ConeGeometry(.012*hs,.16*hs,4),0xf7f3ea,hd(-.14,.07,-.02),[.2,0,.5],[1,1,.35],'head');break;
        }
      }

      function finish(){
        // The skinned mesh hangs first under the body bone; a small pad above
        // the head keeps the bounds honest for taps and culling.
        const {mesh,object,bones:bn}=r.finish({name:'villager-'+L.trade,roughness:.86,pad:[.35,.05,.35],meshUnder:'body'});
        const g=new T.Group();g.name='villager';g.add(object);
        bn.legL.userData.phase=0;bn.legR.userData.phase=PI;
        bn.foreL.rotation.order=bn.foreR.rotation.order='YXZ';
        const arms=[bn.swingL,bn.swingR],legs=[bn.legL,bn.legR],fores=[bn.foreL,bn.foreR],shins=[bn.shinL,bn.shinR];
        const rig={root:mesh,body:bn.body,head:bn.head,arms,legs,forearms:fores,shins,phase:L.phase,style:'storybook'};
        const gait=L.child?{amp:.5,knee:1.3,arm:.55}:L.elder?{amp:.3,knee:.8,arm:.25}:long?{amp:.32,knee:.8,arm:.36}:{amp:.42,knee:1.0,arm:.4};
        const fs=(sy+W)/2;
        const folk={look:L,holds,gait,thigh:J.L.hip[1]-J.L.knee[1],shank:J.L.knee[1]-J.L.ankle[1],hipX:J.L.hip[0],hipY:J.L.hip[1],pelvisY:J.pelvis[1],W,
          foot:[.036*fs-J.L.ankle[1],.03*fs,.04*fs,.088*fs],cadence:1,juggle:balls,
          b:{body:bn.body,pelvis:bn.pelvis,chest:bn.chest,head:bn.head,skirt:bn.skirt,apron:bn.apron,swings:arms,arms:[bn.armL,bn.armR],fores,hands:[bn.handL,bn.handR],legs,shins,feet:[bn.footL,bn.footR],
            balls:balls?[bn.ball0,bn.ball1,bn.ball2]:null}};
        folk.cadence=.95/cycleLength(folk);
        g.userData={resident:person,humanoidRig:rig,arms,legs,cloak:bn.body,folk};
        // Start in the held pose, so props sit in the hands from the first frame.
        animate(g,{moving:false,activity:'Idle'},0,0);
        return g;
      }
    }

    // ---- Life -----------------------------------------------------------------
    const WORK=/work|hammer/i,PUSHING=/push/i,TRI=Math.asin(.95),LEG=[0,0],NOW=[FREE[0],FREE[1]];
    // Thigh and knee at gait phase p. The thigh sweeps in a rounded triangle,
    // so a planted foot passes back under the hip at an even pace. The knee
    // stays folded to carry the foot clear, straightens as the leg reaches out
    // to land, and gives a little as the weight comes on.
    function gaitLeg(G,p){
      const sp=Math.sin(p),cp=Math.cos(p),pn=Math.atan2(sp,cp),d=(pn+.05)/1.5;
      LEG[0]=-G.amp*Math.asin(.95*sp)/TRI-.16*Math.max(0,cp)**2-.03;
      LEG[1]=(Math.abs(d)<1?G.knee*Math.sqrt(Math.cos(d*PI/2)):0)+(pn>PI/2?.06*Math.sin(2*(pn-PI/2)):0)+.05;
    }
    const ankleAhead=f=>-(f.thigh*Math.sin(LEG[0])+f.shank*Math.sin(LEG[0]+LEG[1]));
    // Ground one gait cycle covers, from how fast a planted foot passes under
    // the hip. The game counts one cycle per .95 of ground, so each villager
    // rescales that by their own legs (children take more, quicker steps).
    function cycleLength(f){gaitLeg(f.gait,PI-.05);const a=ankleAhead(f);gaitLeg(f.gait,PI+.05);return (a-ankleAhead(f))/.1*TAU;}
    // How far below the hip a leg reaches, heel and toe included, with the
    // foot pitched by `pitch` in the world.
    const footDepth=(f,pitch)=>{const c=Math.cos(pitch),s=Math.sin(pitch),o=f.foot;return Math.sqrt((o[2]*c)**2+(o[3]*s)**2)-(o[0]*c-o[1]*s);};
    const reach=(f,th,kn,pitch)=>f.thigh*Math.cos(th)+f.shank*Math.cos(th+kn)+footDepth(f,pitch);
    function animate(g,state,time,motion){
      const f=g.userData.folk;if(!f)return;
      state=state||{};time=time||0;
      const m=motion==null?1:clamp(motion,0,1),b=f.b,L=f.look,H=f.holds,G=f.gait,ph=L.phase,act=state.activity||'';
      const walking=!!state.moving&&m>0,sad=state.mood==='Unhappy',working=WORK.test(act),pushing=PUSHING.test(act);
      const pel=b.pelvis,ch=b.chest,stoop=L.stoop+(sad?.1:0),lean=pushing?.26:0;
      let headX=(sad?.22:0)-lean*.8,headY=0,headZ=0,low=-1;
      if(walking){
        const s=(state.stride!=null?state.stride:time*(state.speed||.9)*TAU/.95)*f.cadence,amp=G.amp*(sad?.8:1),k=amp/.42;
        pel.position.set(0,f.pelvisY,0);
        pel.rotation.set(.02+lean*.3,-.1*Math.sin(s)*k,-.04*Math.cos(s));
        ch.rotation.set(stoop+.05+lean*.7,.17*Math.sin(s)*k*(pushing?.3:1),.045*Math.cos(s));
        for(let i=0;i<2;i++){
          const p=s+(i?PI:0),sp=Math.sin(p),cp=Math.cos(p),side=i?-1:1;
          gaitLeg(G,p);
          // The foot lands heel first, stays flat while it carries weight, then
          // lifts its heel and rolls off the toe.
          // The thigh angle is in the world, so the hip undoes the pelvis tilt.
          const th=LEG[0],kn=LEG[1],pitch=pel.rotation.x-(sp>0?.3*sp*(1-smooth(-.3,.3,-cp)):.4*sp*smooth(-.7,.1,cp));
          b.legs[i].rotation.set(th-pel.rotation.x,0,-pel.rotation.z);
          b.shins[i].rotation.set(kn,0,0);
          b.feet[i].rotation.set(pitch-th-kn,0,0);
          const d=reach(f,th,kn,pitch)-side*f.hipX*Math.sin(pel.rotation.z);
          if(d>low)low=d;
          // Arms counter-swing, the elbow softening more on the way forward.
          const h=pushing?PUSH[i]:H[i].stance?FREE[i]:H[i],sw=h.swing*G.arm*(sad?.5:1);
          b.swings[i].rotation.set(sw*sp,0,0);
          b.arms[i].rotation.set(h.sx,h.sy,h.sz+side*.03*h.swing);
          b.fores[i].rotation.set(h.fore-sw*.6*(.35+.65*Math.max(0,-Math.sin(p-.5))),h.twist,0);
          NOW[i]=h;
        }
        // The pelvis rides the planted foot: high mid-stance, low as the feet change.
        b.body.position.set(0,low-f.hipY,0);
        b.skirt.rotation.set(.25*Math.min(b.legs[0].rotation.x,b.legs[1].rotation.x),-.12*Math.sin(s),.03*Math.cos(s));
        headY=(pushing?0:-.08*Math.sin(s))+.18*Math.sin(time*.37+ph)*m;headX+=.03*Math.cos(2*s)-stoop*.5;
      }else{
        // Breath, a slow weight shift and glances; reduced motion holds a still, even stance.
        const br=Math.sin(time*1.7+ph)*m,sway=Math.sin(time*(L.idle==='child'?1.1:.45)+ph)*m*(L.idle==='guard'?.35:1);
        pel.position.set(-.012*sway*f.W,f.pelvisY,0);
        pel.rotation.set(lean*.3,.05*sway,.03*sway);
        ch.rotation.set(stoop+lean*.7+.014*br+(L.idle==='merchant'?-.04:0),-.04*sway,-.018*sway);
        for(let i=0;i<2;i++){
          // Weight settles on one hip; the other knee softens.
          const side=i?-1:1,relax=Math.max(0,side*sway),kn=.05+.16*relax,th=-.064*relax,fx=.1*relax-(th+kn);
          b.legs[i].rotation.set(th-pel.rotation.x,0,.027*sway-pel.rotation.z);
          b.shins[i].rotation.set(kn,0,0);
          b.feet[i].rotation.set(fx,0,0);
          const d=reach(f,th,kn,th+kn+fx)-side*f.hipX*Math.sin(pel.rotation.z);
          if(d>low)low=d;
          const h=pushing?PUSH[i]:H[i];
          b.swings[i].rotation.set(.02*br*h.swing,0,0);
          b.arms[i].rotation.set(h.sx,h.sy,h.sz+side*.012*br);
          b.fores[i].rotation.set(h.fore,h.twist,0);
          NOW[i]=h;
        }
        b.body.position.set(0,low-f.hipY,0);
        b.skirt.rotation.set(0,.03*sway,0);
        if(m>0){headY=.34*Math.sin(time*.31+ph)*Math.sin(time*.17+ph*1.9)*m;headX+=.05*Math.sin(time*.23+ph)*m;headZ=.04*sway;}
        headX-=stoop*.6;
        if(L.idle==='friar'||L.idle==='clerk')headX+=.16;
      }
      for(let i=0;i<2;i++){
        // Wrists keep poles plumb; otherwise they follow the hold.
        const h=NOW[i],hand=b.hands[i];
        if(h.upright)hand.rotation.set(-(pel.rotation.x+ch.rotation.x+b.swings[i].rotation.x+b.arms[i].rotation.x+b.fores[i].rotation.x),h.hy,h.hz);
        else hand.rotation.set(h.hx,h.hy,h.hz);
      }
      b.head.rotation.set(headX,headY,headZ);
      if(!walking&&!pushing&&m>0)roleIdle(f,b,L,time,m,working);
      b.apron.rotation.set(.6*Math.min(0,b.legs[0].rotation.x,b.legs[1].rotation.x),0,0);
      if(f.juggle)juggle(f,b,time,m);
    }
    // Trade idles layered on the standing pose.
    function roleIdle(f,b,L,time,m,working){
      const ph=L.phase,A=b.swings,F=b.fores;
      switch(L.idle){
        case 'strum':{
          // Strum, sway to the beat and tap a toe.
          const beat=time*(working?4.2:3.2)+ph,k=Math.sin(beat*2)*m;
          F[1].rotation.x+=.24*k;A[1].rotation.x+=.05*k;
          b.chest.rotation.z+=.05*Math.sin(beat)*m;b.pelvis.rotation.z-=.02*Math.sin(beat)*m;
          b.feet[0].rotation.x-=.35*Math.max(0,Math.sin(beat*2))*m;
          b.head.rotation.z+=.12*Math.sin(beat)*m;break;}
        case 'fish':F[1].rotation.x+=.04*Math.sin(time*1.3+ph)*m;break;
        case 'child':{b.body.position.y+=.012*Math.abs(Math.sin(time*3.4+ph))*m;b.head.rotation.z+=.1*Math.sin(time*1.3+ph)*m;for(let i=0;i<2;i++)if(!f.holds[i].upright)A[i].rotation.x+=.22*Math.sin(time*2.2+ph+i*PI)*m;break;}
        case 'vendor':{const c=(time*.2+ph)%1,k=c<.3?Math.sin(c/.3*PI)*m:0;A[1].rotation.x-=1.0*k;A[1].rotation.z-=.25*k;F[1].rotation.x-=.9*k+.25*k*Math.sin(time*9);break;}
        case 'taverner':{const c=(time*.14+ph)%1,k=c<.22?Math.sin(c/.22*PI)*m:0;A[1].rotation.x-=.45*k;F[1].rotation.x-=.55*k;break;}
        case 'builder':case 'smith':if(working)hammer(b,time*.9+ph,m);break;
        case 'juggle':for(let i=0;i<2;i++)F[i].rotation.x+=.14*Math.sin(time*9.6+i*PI)*m;break;
      }
    }
    // A real hammer stroke: a slow lift with the elbow out and the wrist cocked
    // back, a quick fall onto the work, a moment's rest, eyes on the nail. The
    // hammer peaks at shoulder height, out to the side, well clear of the face.
    function hammer(b,t,m){
      const c=t-Math.floor(t),up=c<.5?smooth(0,.5,c):c<.62?1-((c-.5)/.12)**2:0;
      b.swings[1].rotation.x-=(.55+.2*up)*m;
      // The upper arm turns out, so the hammer rises beside the shoulder.
      b.arms[1].rotation.y-=.4*up*m;
      b.arms[1].rotation.z-=.3*up*m;
      b.fores[1].rotation.x-=(.45+.5*up)*m;
      b.hands[1].rotation.x+=(.9-1.1*up)*m;
      b.chest.rotation.x+=(.05-.09*up)*m;
      b.head.rotation.x+=.18*m;
    }
    // A three-ball shower between the two hands. Held still, two balls wait
    // in the right hand and one in the left.
    function juggle(f,b,time,m){
      const J=f.juggle;
      if(m<=0){
        b.balls[0].position.set(J.R.x-.03,J.R.y+.03,J.R.z+.05);
        b.balls[1].position.set(J.R.x+.03,J.R.y+.03,J.R.z+.05);
        b.balls[2].position.set(J.L.x,J.L.y+.03,J.L.z+.05);
        return;
      }
      for(let i=0;i<3;i++){
        const t=(time*1.1+i/3)%1,ball=b.balls[i];
        if(t<.66){const u=t/.66;ball.position.set(J.R.x+(J.L.x-J.R.x)*u,J.R.y+.03+.95*u*(1-u),J.R.z+.05+.06*Math.sin(u*PI));}
        else{const u=(t-.66)/.34;ball.position.set(J.L.x+(J.R.x-J.L.x)*u,J.L.y+.03+.12*u*(1-u),J.L.z+.05);}
      }
    }
    return {make,animate};
  })();
  function resident(T,person){
    return folk.make(T,person);
  }
  function animateResident(g,state,time,motion){
    folk.animate(g,state,time,motion);
  }
  root.BurbzSettlementModels={batch,rig,skinningSupported,setSkinning:on=>{skinning=on===null?null:!!on;},building,bird,animateBird,resident,animateResident};
})(typeof globalThis!=='undefined'?globalThis:this);
