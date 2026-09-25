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
  // The little folk reuse the pre-v348 hood, tapered cloak, hands and boots.
  // Their appearance is stable by identity; no bird plumage or taxonomy is used.
  function resident(T,person){
    let seed=2166136261;for(const c of String(person.id)){seed^=c.charCodeAt(0);seed=Math.imul(seed,16777619);}seed>>>=0;
    const cloth=[0x6a4a3a,0x3a4a6a,0x4a5a3a,0x5a3a52,0x6a5a34][seed%5];
    const skin=[0xd8b890,0xb88e69,0x926b4e,0xe2c7a6][(seed>>>4)%4],boot=0x3a2e22;
    const g=new T.Group(),torso=batch(T);
    torso.cylinder(.18,.28,.65,0,.56,0,cloth);
    torso.cylinder(.16,.24,.25,0,.82,0,cloth);
    const body=torso.finish();body.name='little-folk-cloak';g.add(body);
    const head=new T.Group(),face=batch(T);head.position.y=1.02;
    face.sphere(.13,0,0,.015,skin);
    face.add(new T.ConeGeometry(.16,.28,8),cloth,[0,.13,-.015]);
    // A small face points along +Z, the same forward axis as the saved routes.
    for(const x of [-.045,.045])face.sphere(.013,x,.014,.132,0x322a22);
    face.sphere(.022,0,-.025,.15,skin);
    head.add(face.finish());head.name='little-folk-head';g.add(head);
    const arms=[],legs=[];
    for(const side of [-1,1]){
      const shoulder=new T.Group(),arm=batch(T);shoulder.position.set(side*.19,.80,0);
      arm.cylinder(.048,.04,.36,0,-.18,0,cloth);arm.sphere(.04,0,-.38,0,skin);
      shoulder.add(arm.finish());shoulder.name='little-folk-arm';g.add(shoulder);arms.push(shoulder);
      const hip=new T.Group(),leg=batch(T);hip.position.set(side*.10,.27,0);
      leg.cylinder(.048,.04,.23,0,-.115,0,boot);leg.sphere(.055,0,-.245,.035,boot,[1,.6,1.35]);
      hip.add(leg.finish());hip.name='little-folk-leg';hip.userData.phase=side>0?0:Math.PI;g.add(hip);legs.push(hip);
    }
    g.userData={resident:person,humanoidRig:{body,head,arms,legs,phase:(seed%100)/10},arms,legs,cloak:body};
    return g;
  }
  function animateResident(g,state,time,motion){
    const rig=g.userData.humanoidRig;if(!rig)return;
    const stride=(state.stride||time*6)*.72,moving=state.moving&&motion;
    rig.legs.forEach((leg,i)=>leg.rotation.x=moving?Math.sin(stride+i*Math.PI)*.38:0);
    rig.arms.forEach((arm,i)=>arm.rotation.x=moving?-Math.sin(stride+i*Math.PI)*.28:Math.sin(time*.7+rig.phase+i)*.035*motion);
    rig.body.position.y=moving?Math.abs(Math.sin(stride))*.008:0;
    rig.head.rotation.y=Math.sin(time*.65+rig.phase)*.14*motion;
    rig.head.rotation.x=state.mood&&state.mood!=='Content'?.24:0;
    rig.body.rotation.z=state.mood==='Unhappy'?Math.sin(time*.7+rig.phase)*.025*motion:0;
  }
  root.BurbzSettlementModels={batch,rig,skinningSupported,setSkinning:on=>{skinning=on===null?null:!!on;},building,bird,animateBird,resident,animateResident};
})(typeof globalThis!=='undefined'?globalThis:this);
