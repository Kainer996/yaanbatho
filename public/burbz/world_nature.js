/* Alderwing nature rendering. Every tree, shrub, flower and stone in the open
 * countryside shares one instanced pool per kind and 128m map cell. Trees and
 * boulders never change size: each tree trades its detailed form for a simple
 * one of the same size at its own distance, and far trees end one by one at
 * their own distance, on a round edge that moves with the viewer. Canopy
 * crowns carry the woods on from there to where the distant canopy rises.
 * Far trees ride the ground as it bends onto the distant land. Only shrubs
 * and ground plants still shrink away, where they are a few pixels tall. */
(function(root){'use strict';
const TAU=Math.PI*2;
function kit(T){
 const pos=[],nor=[],col=[],tint=[],idx=[],v=new T.Vector3(),n=new T.Vector3(),normal=new T.Matrix3(),c=new T.Color();
 function add(geo,matrix,paint,tinted=0){
  geo=geo.index?geo:geo;if(!geo.attributes.normal)geo.computeVertexNormals();
  const p=geo.attributes.position,nn=geo.attributes.normal,base=pos.length/3;normal.getNormalMatrix(matrix);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);v.set(x,y,z).applyMatrix4(matrix);n.fromBufferAttribute(nn,i).applyMatrix3(normal).normalize();
   pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);
   const value=typeof paint==='function'?paint(v.x,v.y,v.z,n,i):paint;c.set(value);col.push(c.r,c.g,c.b);tint.push(typeof tinted==='function'?tinted(v.x,v.y,v.z,n,i):tinted);
  }
  const count=geo.index?geo.index.count:p.count;for(let i=0;i<count;i++)idx.push(base+(geo.index?geo.index.getX(i):i));
  geo.dispose();
 }
 function build(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setAttribute('natureTint',new T.Float32BufferAttribute(tint,1));g.setIndex(idx);g.computeBoundingSphere();return g;}
 return{add,build};
}
const M=(T,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(sx,sy,sz));
// A lumpy leaf mass: a jittered icosahedron so crowns never look machined.
function blob(T,seed=1,detail=0,jitter=.16){
 const g=new T.IcosahedronGeometry(1,detail),p=g.attributes.position,keyed=new Map();
 for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(3)+','+p.getY(i).toFixed(3)+','+p.getZ(i).toFixed(3);let k=keyed.get(key);if(k===undefined){k=1+(Math.sin(i*12.9898+seed*78.233)*43758.5453%1)*jitter;keyed.set(key,k);}p.setXYZ(i,p.getX(i)*k,p.getY(i)*k,p.getZ(i)*k);}
 const merged=new T.BufferGeometry();merged.setAttribute('position',p);g.computeVertexNormals();merged.setAttribute('normal',g.attributes.normal);return merged;
}
// The same lumpy crown with its twelve corners shared. Trees and bushes shade
// flat on the GPU, so it looks the same for a fifth of the vertices.
function crown(T,seed=1,jitter=.16){const b=blob(T,seed,0,jitter),p=b.attributes.position,keyed=new Map(),pos=[],idx=[];
 for(let i=0;i<p.count;i++){const key=p.getX(i).toFixed(4)+','+p.getY(i).toFixed(4)+','+p.getZ(i).toFixed(4);let k=keyed.get(key);if(k===undefined){k=pos.length/3;keyed.set(key,k);pos.push(p.getX(i),p.getY(i),p.getZ(i));}idx.push(k);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setIndex(idx);g.computeVertexNormals();return g;}
// An open cone with no wasted slivers at its tip.
function cone(T,r,h,segments){const p=[0,h,0],idx=[];for(let i=0;i<segments;i++){const a=i/segments*Math.PI*2;p.push(Math.sin(a)*r,0,Math.cos(a)*r);}for(let i=0;i<segments;i++)idx.push(0,1+i,1+(i+1)%segments);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;}
function limb(T,a,b,r0,r1,segments=5){
 const from=new T.Vector3(...a),to=new T.Vector3(...b),length=from.distanceTo(to),g=new T.CylinderGeometry(r1,r0,length,segments,1,true);
 g.translate(0,length/2,0);const m=new T.Matrix4().compose(from,new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),to.clone().sub(from).normalize()),new T.Vector3(1,1,1));return{g,m};
}
function blade(T,points,width){
 // A tapering ribbon through the given points, for grass, fronds and reeds.
 const p=[],idx=[];points.forEach((q,i)=>{const w=width*(1-i/(points.length-1))*.5+.002;p.push(q[0]-w,q[1],q[2],q[0]+w,q[1],q[2]);});
 for(let i=0;i<points.length-1;i++){const a=i*2;idx.push(a,a+2,a+1,a+1,a+2,a+3);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const PROTOTYPES={
 pine(T,k){const t=limb(T,[0,0,0],[.12,2.3,0],.19,.13,6);k.add(t.g,t.m,0x5c3d29);const u=limb(T,[.12,2.25,0],[.18,4.7,.05],.13,.06,6);k.add(u.g,u.m,0xb26a3b);
  for(const [x,y,z,sx,sy,sz,s] of [[.15,4.55,0,1.5,.64,1.4,1],[.55,3.9,.3,1.1,.52,1,2],[-.35,4.05,-.35,1.05,.52,1.1,3]])k.add(crown(T,s),M(T,x,y,z,0,s,0,sx,sy,sz),s%2?0x4a6d3c:0x42653a,1);},
 spruce(T,k){const t=limb(T,[0,0,0],[0,1.4,0],.16,.11,6);k.add(t.g,t.m,0x553a28);
  for(const [y,h,r,tone] of [[1.25,2.1,1.35,0x36573a],[2.1,2.1,1.1,0x3a5d3d],[3.3,1.9,.82,0x36573a],[4.35,1.6,.52,0x3f6440]]){const g=new T.ConeGeometry(r,h,7,1,true);g.translate(0,y+h/2,0);k.add(g,M(T),tone,1);}},
 oak(T,k){const t=limb(T,[0,0,0],[0,2.1,0],.32,.22,7);k.add(t.g,t.m,0x5b4632);
  for(const [x,y,z,sx,sy,sz,s,tone] of [[0,3.55,0,1.9,1.35,1.8,1,0x4d6d34],[1.15,3.1,.4,1.3,1,1.25,2,0x557636],[-1,3.2,-.5,1.35,1,1.25,3,0x476630],[-.2,3.3,1,1.25,.9,1.15,5,0x456430]])k.add(crown(T,s,.2),M(T,x,y,z,0,s,0,sx,sy,sz),tone,1);},
 birch(T,k){for(let i=0;i<3;i++){const y0=i*1.75,y1=y0+1.75,l=limb(T,[i*.05,y0,0],[(i+1)*.05,y1,0],.11-i*.02,.1-i*.022,5);k.add(l.g,l.m,i%2?0xe8e4da:0xdcd7cc);if(i<2){const ring=limb(T,[i*.05,y0+.9,0],[i*.05,y0+1,0],.112-i*.02,.11-i*.02,5);k.add(ring.g,ring.m,0x35322e);}}
  for(const [x,y,z,sx,sy,sz,s] of [[.16,4.9,0,.95,1.55,.9,1],[.55,4,.25,.72,1.1,.7,2],[-.3,4.1,-.25,.72,1.1,.72,3]])k.add(crown(T,s,.22),M(T,x,y,z,0,s,0,sx,sy,sz),0x86a04a,1);},
 hawthorn(T,k){const t=limb(T,[0,0,0],[.35,2.1,.14],.15,.1,5);k.add(t.g,t.m,0x4f3d2f);const b=limb(T,[.25,1.5,.1],[-.35,2.2,-.25],.07,.05,5);k.add(b.g,b.m,0x4f3d2f);
  for(const [x,y,z,sx,sy,sz,s] of [[.45,2.75,.15,1.25,.78,1.1,1],[-.3,2.55,-.28,.9,.66,.85,2],[.15,3.05,-.1,.8,.6,.8,3]])k.add(crown(T,s,.2),M(T,x,y,z,0,s,0,sx,sy,sz),0x58703a,1);},
 dead(T,k){const t=limb(T,[0,0,0],[.1,3.9,0],.18,.05,6);k.add(t.g,t.m,0x7b7166);
  for(const [a,b,r] of [[[0,2.3,0],[.95,3.4,.3],.07],[[.05,2.9,0],[-.8,3.75,-.2],.06],[[0,1.7,0],[-.3,2.5,.85],.06],[[.08,3.3,0],[.5,4.1,-.4],.04]]){const l=limb(T,a,b,r,r*.4,4);k.add(l.g,l.m,0x857a6d);}},
 // Distant trees: the same size, outline and colours in a handful of
 // triangles, so the swap from the detailed form is hard to spot.
 pineFar(T,k){const t=new T.CylinderGeometry(.07,.16,4.3,3,1,true);t.translate(.09,2.15,0);k.add(t,M(T),(x,y)=>y>2.1?0xb26a3b:0x5c3d29);k.add(crown(T,1),M(T,.12,4.4,0,0,1,0,1.55,.66,1.45),0x466a3b,1);},
 spruceFar(T,k){const t=new T.CylinderGeometry(.06,.1,1.4,3,1,true);t.translate(0,.7,0);k.add(t,M(T),0x553a28);for(const [y,h,r] of [[1.25,3.05,1.35],[3.3,2.65,.92]]){const c=cone(T,r,h,6);c.translate(0,y,0);k.add(c,M(T),0x39593b,1);}},
 oakFar(T,k){const t=new T.CylinderGeometry(.14,.24,2.4,3,1,true);t.translate(0,1.2,0);k.add(t,M(T),0x5b4632);k.add(crown(T,11,.2),M(T,0,3.45,0,0,.4,0,2.05,1.35,1.95),0x4d6d34,1);},
 birchFar(T,k){const t=new T.CylinderGeometry(.06,.1,3.4,3,1,true);t.translate(0,1.7,0);k.add(t,M(T),0xe0dbd0);k.add(crown(T,13,.22),M(T,.1,4.55,0,0,.3,0,1.08,1.52,1.02),0x86a04a,1);},
 hawthornFar(T,k){const t=new T.CylinderGeometry(.08,.14,2.1,3,1,true);t.translate(.2,1.05,.07);k.add(t,M(T),0x4f3d2f);k.add(crown(T,12,.2),M(T,.25,2.75,0,0,.6,0,1.3,.8,1.15),0x58703a,1);},
 // Canopy crowns: one crown for a few trees, drawn from the distant land's
 // record of each wood. The instance colour gives the wood's own crowns. No
 // trunk: from 100m it is under a pixel wide, and it would cost a quarter.
 crownBroad(T,k){k.add(crown(T,17,.2),M(T,0,3.3,0,0,.7,0,2.7,1.75,2.6),0xffffff,1);},
 crownConifer(T,k){for(const [y,h,r] of [[.9,3.4,2.05],[3.1,2.9,1.4]]){const c=cone(T,r,h,6);c.translate(0,y,0);k.add(c,M(T),0xffffff,1);}},
 deadFar(T,k){const t=new T.CylinderGeometry(.04,.16,3.9,3,1,true);t.translate(.05,1.95,0);k.add(t,M(T),0x7b7166);for(const [a,b] of [[[0,2.3,0],[.95,3.4,.3]],[[.05,2.9,0],[-.8,3.75,-.2]],[[0,1.7,0],[-.3,2.5,.85]]]){const l=limb(T,a,b,.06,.025,3);k.add(l.g,l.m,0x857a6d);}},
 bush(T,k){for(const [x,y,z,sx,sy,sz,s,tone] of [[0,.5,0,1,.64,.92,1,0x4f6a33],[.55,.38,.3,.66,.48,.62,2,0x56733a]])k.add(crown(T,s,.22),M(T,x,y,z,0,s,0,sx,sy,sz),tone,1);},
 gorse(T,k){for(const [x,y,z,sx,sy,sz,s] of [[0,.45,0,.9,.58,.85,1],[.5,.35,.25,.58,.44,.58,2]])k.add(crown(T,s,.26),M(T,x,y,z,0,s,0,sx,sy,sz),0x3e592c,1);
  for(let i=0;i<5;i++){const a=i*2.4,r=.45+(i%3)*.12;k.add(new T.TetrahedronGeometry(.12,0),M(T,Math.cos(a)*r*.8,.5+(i%2)*.18,Math.sin(a)*r*.7),0xe2bb2c);}},
 heather(T,k){for(const [x,y,z,sx,sy,sz,s] of [[0,.14,0,.9,.32,.82,1]])k.add(crown(T,s,.25),M(T,x,y,z,0,s,0,sx,sy,sz),0x5c5c46,1);},
 fern(T,k){for(let i=0;i<5;i++){const a=i/5*TAU+.3,pts=[[0,0,0],[.28,.45,0],[.62,.58,0],[.92,.38,0]];k.add(blade(T,pts,.28),M(T,0,0,0,0,a,0),0x6c8b3b,1);}},
 grass(T,k){for(let i=0;i<5;i++){const a=i/5*TAU+(i%2)*.4,h=.3+(i%3)*.1,lean=.1+(i%2)*.07;k.add(blade(T,[[0,0,0],[lean*.4,h*.55,0],[lean,h,0]],.13),M(T,Math.cos(a)*.07,0,Math.sin(a)*.07,0,a,0),(x,y)=>y<.1?0x5f7f35:0x9ab85a,1);}},
 flowers(T,k){for(let i=0;i<4;i++){const a=i/4*TAU+.4,r=.1+(i%2)*.09,h=.24+(i%3)*.07,x=Math.cos(a)*r,z=Math.sin(a)*r;
  k.add(blade(T,[[0,0,0],[0,h*.6,0],[.02,h,0]],.045),M(T,x,0,z,0,a,0),0x5f8a38);
  const head=new T.CircleGeometry(.075,5);head.rotateX(-Math.PI/2+.35);k.add(head,M(T,x+.02,h+.005,z,0,a,0),0xffffff,1);
  const eye=new T.CircleGeometry(.024,4);eye.rotateX(-Math.PI/2+.35);k.add(eye,M(T,x+.02,h+.012,z,0,a,0),0xf0c030);}},
 reeds(T,k){for(let i=0;i<9;i++){const a=i*2.1,r=.05+(i%3)*.06,h=.85+(i%4)*.17;k.add(blade(T,[[0,0,0],[.03,h*.5,0],[.09*(i%2?1:-1),h,0]],.05),M(T,Math.cos(a)*r,0,Math.sin(a)*r,0,a,0),(x,y)=>y<.3?0x566b35:0x7c8a45,1);}
  for(const [x,z] of [[.05,.02],[-.06,.07]]){const c=new T.CylinderGeometry(.035,.035,.18,5);c.translate(x,1.08,z);k.add(c,M(T),0x5b3d24);}},
 mushroom(T,k){for(const [x,z,s] of [[0,0,1],[.14,.08,.7]]){const stem=new T.CylinderGeometry(.03*s,.04*s,.12*s,4,1,true);stem.translate(x,.06*s,z);k.add(stem,M(T),0xefe8d8);const cap=new T.ConeGeometry(.1*s,.07*s,6,1,true);cap.translate(x,.14*s,z);k.add(cap,M(T),0xb8322a);}},
 boulder(T,k){k.add(blob(T,7,0,.34),M(T,0,.35,0,0,0,0,1,.72,.9),(x,y,z,n)=>n.y>.86?0x77805a:y<.08?0x6f6d66:0x8f8c85,1);},
 stone(T,k){k.add(new T.DodecahedronGeometry(.3,0),M(T,0,.08,0,.2,0,.1,1,.55,.8),0x8e8b84);},
 log(T,k){const g=new T.CylinderGeometry(.22,.24,2.8,8,1,false);k.add(g,M(T,0,.2,0,0,0,Math.PI/2),(x,y,z,n)=>Math.abs(n.x)>.9?0xa3805a:0x5b4735);},
 stump(T,k){const g=new T.CylinderGeometry(.27,.32,.5,8);g.translate(0,.25,0);k.add(g,M(T),(x,y,z,n)=>n.y>.9?0xb89067:0x5b4735);}
};
// How each kind shows, by distance from the viewer's eye. lod 1: a detailed
// tree, nearer than its own swap distance, 28-36m. lod 2: that tree's simple
// form beyond it, out to its own end, 100-124m across the ground. lod 3:
// boulders, to the same end. lod 4: canopy crowns, from their own start
// across that same band out to their own end, 250-300m, where the distant
// canopy has risen. lod 0: shrubs and ground plants shrink away between
// range[0] and range[1], by then only a few pixels tall. Every random
// distance comes from the plant's own place, so a round, ragged edge moves
// with the viewer and plants change one at a time, never a row at once.
// Registration in the world owner matches: every tree and boulder of a built
// chunk, detailed trees within 44m of the eye, shrubs within 100m, ground
// plants within 30m, and canopy crowns in 64m cells out to 340m.
// MORPH: the detailed ground bends onto the distant land between these
// square distances, and far trees and boulders ride it. EDGE: nothing stands
// within 2m of the edge of the detailed ground.
const SWAP=[28,8],END=[100,24],CROWNS=[250,50],MORPH=[84,124],EDGE=2;
const TREE={lod:1,sway:.004,shadow:true,tier:'near'},FAR={lod:2,sway:.004,shadow:true,tier:'big'},CANOPY={lod:4,sway:0,shadow:false,tier:'canopy',flat:true};
const KINDS={pine:TREE,spruce:TREE,oak:TREE,birch:{...TREE,sway:.006},hawthorn:{...TREE,sway:.006},dead:{...TREE,sway:0},
 pineFar:FAR,spruceFar:FAR,oakFar:FAR,birchFar:{...FAR,sway:.006},hawthornFar:{...FAR,sway:.006},deadFar:{...FAR,sway:0},
 crownBroad:CANOPY,crownConifer:CANOPY,
 boulder:{lod:3,sway:0,shadow:true,tier:'big'},bush:{range:[80,100],sway:.02,shadow:true,tier:'shrub',flat:true},gorse:{range:[76,96],sway:.02,shadow:false,tier:'shrub',flat:true},log:{range:[76,96],sway:0,shadow:true,tier:'shrub'},stump:{range:[70,90],sway:0,shadow:false,tier:'shrub'},
 heather:{range:[20,29],sway:0,shadow:false,tier:'small',flat:true},fern:{range:[20,29],sway:.05,shadow:false,tier:'small'},reeds:{range:[20,29],sway:.04,shadow:false,tier:'small'},mushroom:{range:[12,18],sway:0,shadow:false,tier:'small'},stone:{range:[20,29],sway:0,shadow:false,tier:'small'},
 grass:{range:[16,26],sway:.12,shadow:false,tier:'small'},flowers:{range:[18,28],sway:.14,shadow:false,tier:'small'}};
const VERTEX=`#include <begin_vertex>
 vec3 natureOrigin=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;
 // Three fixed random numbers per plant from its place, never from the viewer.
 vec3 natureSeed=fract(floor(natureOrigin.xzx*4.)*vec3(.1031,.1030,.0973));
 natureSeed+=dot(natureSeed,natureSeed.yxz+33.33);natureSeed=fract((natureSeed.xxy+natureSeed.yxx)*natureSeed.zyx);
 // The viewer's eye, not the camera: the sun's shadow camera must see the same shapes.
 vec2 natureOff=natureOrigin.xz-natureEye.xz;
 float natureShow=1.,natureFlat=length(natureOff);
 if(natureMode<.5)natureShow=1.-smoothstep(natureRange.x,natureRange.y,natureFlat);
 else if(natureMode<3.5){
  float natureDistance=distance(natureOrigin,natureEye),natureSwap=${SWAP[0]}.+${SWAP[1]}.*natureSeed.x;
  float natureInset=min(min(natureOrigin.x-natureEdge.x,natureEdge.z-natureOrigin.x),min(natureOrigin.z-natureEdge.y,natureEdge.w-natureOrigin.z));
  // Whole or nothing: a plant is either drawn at its full size or not at all.
  natureShow=natureMode<1.5?step(natureDistance,natureSwap):(natureMode<2.5?step(natureSwap,natureDistance):1.)*step(natureFlat,${END[0]}.+${END[1]}.*natureSeed.y)*step(${EDGE}.,natureInset);
 }
 else natureShow=step(${END[0]}.+${END[1]}.*natureSeed.z,natureFlat)*step(natureFlat,${CROWNS[0]}.+${CROWNS[1]}.*natureSeed.y);
 transformed*=natureShow;
 float natureHeight=max(transformed.y,0.);
 transformed.x+=sin(natureTime*1.6+natureOrigin.x*.37+natureOrigin.z*.21)*natureSway*natureHeight*natureHeight;
 transformed.z+=cos(natureTime*1.3+natureOrigin.x*.23-natureOrigin.z*.31)*natureSway*natureHeight*natureHeight*.6;
 // Far trees and boulders ride the detailed ground as it bends onto the distant land.
 transformed.y+=natureDrop*smoothstep(${MORPH[0]}.,${MORPH[1]}.,max(abs(natureOff.x),abs(natureOff.y)))/max(length(instanceMatrix[1].xyz),.001);`;
function patch(material,uniforms,depth=false){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms);
  shader.vertexShader='uniform float natureTime;\nuniform vec2 natureRange;\nuniform float natureMode;\nuniform float natureSway;\nuniform vec3 natureEye;\nuniform vec4 natureEdge;\nattribute float natureDrop;\n'+(depth?'':'attribute float natureTint;\n')+shader.vertexShader.replace('#include <begin_vertex>',VERTEX);
  // Instance colour tints foliage and flower heads, never trunks or stems.
  if(!depth)shader.vertexShader=shader.vertexShader.replace('#include <color_vertex>',`#if defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR )
 vColor = vec3( 1.0 );
 #endif
 #ifdef USE_COLOR
 vColor *= color;
 #endif
 #ifdef USE_INSTANCING_COLOR
 vColor *= mix( vec3( 1.0 ), instanceColor, natureTint );
 #endif`);};
 material.customProgramCacheKey=function(){return key.call(this)+':alderwing-nature-v4'+(depth?':depth':'');};material.needsUpdate=true;
}
// Instances are pooled per kind and per 128m map cell. Each cell's mesh has a
// fixed bounding sphere, so the renderer skips whole cells outside the view;
// one draw covers every tree of a kind in a visible cell.
const CELL=128;
// edge: the square of detailed ground now shown, as (x0,z0,x1,z1) in metres.
function create(T,scene,{style,time,eye,edge}){
 const kinds=new Map(),pools=new Map(),placed=new Map(),matrix=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),p=new T.Vector3(),sc=new T.Vector3(),zero=new T.Matrix4().makeScale(0,0,0);
 // Shared per kind: geometry, material and shadow material (one shader program).
 function kindOf(kind){
  let k=kinds.get(kind);if(k)return k;
  const spec=KINDS[kind],builder=kit(T);PROTOTYPES[kind](T,builder);const geometry=builder.build();geometry.computeBoundingSphere();
  const uniforms={natureTime:time,natureEye:eye,natureEdge:edge,natureMode:{value:spec.lod||0},natureRange:{value:new T.Vector2(...(spec.range||[1e6,2e6]))},natureSway:{value:spec.sway}};
  const material=new T.MeshLambertMaterial({vertexColors:true,flatShading:spec.lod===1||spec.lod===2||!!spec.flat,side:['grass','fern','flowers','reeds'].includes(kind)?T.DoubleSide:T.FrontSide});patch(material,uniforms);style(material);
  const depth=new T.MeshDepthMaterial({depthPacking:T.RGBADepthPacking});patch(depth,uniforms,true);
  k={kind,spec,geometry,material,depth,reach:geometry.boundingSphere.radius*3.5};kinds.set(kind,k);return k;
 }
 function pool(kind,cx,cz){
  const key=kind+'@'+cx+','+cz;let row=pools.get(key);if(row)return row;const k=kindOf(kind);
  row={key,kind,k,cx,cz,mesh:null,capacity:0,count:0,free:[],owners:new Map(),dirty:false,low:Infinity,high:-1};pools.set(key,row);grow(row,32);return row;
 }
 // Each cell's mesh shares its kind's shape and adds one number per plant:
 // how far the ground under it moves as it bends onto the distant land.
 function release(mesh){mesh.removeFromParent();const g=mesh.geometry;for(const name of Object.keys(g.attributes))if(name!=='natureDrop')g.deleteAttribute(name);g.setIndex(null);g.dispose();mesh.dispose();}
 function grow(row,capacity){
  const k=row.k,g=new T.BufferGeometry();for(const [name,attribute] of Object.entries(k.geometry.attributes))g.setAttribute(name,attribute);g.setIndex(k.geometry.index);
  const drop=new T.InstancedBufferAttribute(new Float32Array(capacity),1);drop.setUsage(T.DynamicDrawUsage);g.setAttribute('natureDrop',drop);
  const mesh=new T.InstancedMesh(g,k.material,capacity);mesh.name='Alderwing '+row.kind;mesh.castShadow=k.spec.shadow;mesh.receiveShadow=true;mesh.customDepthMaterial=k.depth;
  // The cell's own bounds, generous enough for the largest scaled instance.
  mesh.boundingSphere=new T.Sphere(new T.Vector3((row.cx+.5)*CELL,0,(row.cz+.5)*CELL),CELL*.75+k.reach);mesh.frustumCulled=true;
  mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);mesh.instanceColor=new T.InstancedBufferAttribute(new Float32Array(capacity*3).fill(1),3);mesh.instanceColor.setUsage(T.DynamicDrawUsage);
  for(let i=0;i<capacity;i++)mesh.setMatrixAt(i,zero);
  if(row.mesh){mesh.instanceMatrix.array.set(row.mesh.instanceMatrix.array);mesh.instanceColor.array.set(row.mesh.instanceColor.array);drop.array.set(row.mesh.geometry.attributes.natureDrop.array);release(row.mesh);}
  mesh.count=row.count;row.mesh=mesh;row.capacity=capacity;row.dirty=true;row.low=0;row.high=capacity-1;scene.add(mesh);
 }
 // Items: {x,y,z,angle,scale,[sx,sy,sz],[tilt,tiltZ],color:[r,g,b],[drop]} in
 // world metres. drop: the distant land's height less the ground's, here.
 function add(owner,kind,items){
  if(!items.length)return;const groups=new Map(),where=KINDS[kind].lod>=2?(placed.get(kind)||placed.set(kind,new WeakMap()).get(kind)):null;
  for(const item of items){const cx=Math.floor(item.x/CELL),cz=Math.floor(item.z/CELL),key=cx+','+cz;let g=groups.get(key);if(!g)groups.set(key,g={cx,cz,items:[]});g.items.push(item);}
  for(const g of groups.values()){
   const row=pool(kind,g.cx,g.cz),slots=[];
   if(row.count+g.items.length-row.free.length>row.capacity)grow(row,Math.max(row.capacity*2,row.count+g.items.length));
   for(const item of g.items){
    const slot=row.free.length?row.free.pop():row.count++;slots.push(slot);
    e.set(item.tilt||0,item.angle||0,item.tiltZ||0);q.setFromEuler(e);p.set(item.x,item.y,item.z);const s=item.scale||1;sc.set(s*(item.sx||1),s*(item.sy||1),s*(item.sz||1));
    matrix.compose(p,q,sc);row.mesh.setMatrixAt(slot,matrix);const c=item.color||[1,1,1];row.mesh.instanceColor.setXYZ(slot,c[0],c[1],c[2]);row.mesh.geometry.attributes.natureDrop.array[slot]=item.drop||0;where?.set(item,[row.key,slot]);row.low=Math.min(row.low,slot);row.high=Math.max(row.high,slot);
   }
   const list=row.owners.get(owner);if(list)list.push(...slots);else row.owners.set(owner,slots);row.mesh.count=row.count;row.dirty=true;
  }
 }
 function remove(owner){
  for(const [key,row] of pools){const slots=row.owners.get(owner);if(!slots)continue;row.owners.delete(owner);
   // A cell with nothing left gives its buffers back.
   if(!row.owners.size){release(row.mesh);pools.delete(key);continue;}
   for(const slot of slots){row.mesh.setMatrixAt(slot,zero);row.free.push(slot);row.low=Math.min(row.low,slot);row.high=Math.max(row.high,slot);}row.dirty=true;
   // Trim empty slots from the end so the draw only covers live instances.
   row.free.sort((a,b)=>a-b);while(row.free.length&&row.free[row.free.length-1]===row.count-1){row.free.pop();row.count--;}row.mesh.count=row.count;}
 }
 // New drops for plants already pooled, after the distant land changed.
 function redrop(kind,items){const where=placed.get(kind);if(!where)return;for(const item of items){const at=where.get(item),row=at&&pools.get(at[0]);if(!row||row.owners.size===0)continue;row.mesh.geometry.attributes.natureDrop.array[at[1]]=item.drop||0;row.low=Math.min(row.low,at[1]);row.high=Math.max(row.high,at[1]);row.dirty=true;}}
 // Upload only the changed slots, not the whole pool, to spare phone buses.
 function flush(){for(const row of pools.values())if(row.dirty){row.dirty=false;const count=row.high-row.low+1;
  if(count>0){const m=row.mesh.instanceMatrix,c=row.mesh.instanceColor,d=row.mesh.geometry.attributes.natureDrop;m.updateRange.offset=row.low*16;m.updateRange.count=count*16;c.updateRange.offset=row.low*3;c.updateRange.count=count*3;d.updateRange.offset=row.low;d.updateRange.count=count;m.needsUpdate=true;c.needsUpdate=true;d.needsUpdate=true;}
  row.low=Infinity;row.high=-1;}}
 // A cell skips its draw when none of its plants can show: far trees and
 // boulders beyond their end or outside the detailed ground, canopy crowns
 // outside their ring.
 function update(){const e=edge.value,at=eye.value;for(const row of pools.values()){const lod=row.k.spec.lod;if(lod<2)continue;const x0=row.cx*CELL,z0=row.cz*CELL,dx=Math.max(x0-at.x,0,at.x-x0-CELL),dz=Math.max(z0-at.z,0,at.z-z0-CELL),near=Math.hypot(dx,dz),far=Math.hypot(Math.max(Math.abs(at.x-x0),Math.abs(at.x-x0-CELL)),Math.max(Math.abs(at.z-z0),Math.abs(at.z-z0-CELL)));
  row.mesh.visible=lod===4?near<CROWNS[0]+CROWNS[1]&&far>END[0]:near<END[0]+END[1]&&x0+CELL>e.x+EDGE&&x0<e.z-EDGE&&z0+CELL>e.y+EDGE&&z0<e.w-EDGE;}}
 function has(owner){for(const row of pools.values())if(row.owners.has(owner))return true;return false;}
 function diagnostics(){const out={};let instances=0,shown=0;for(const row of pools.values()){const live=row.count-row.free.length,k=out[row.kind]||={live:0,cells:0,triangles:row.k.geometry.index.count/3};k.live+=live;k.cells++;instances+=live;if(row.mesh.visible)shown++;}return{draws:pools.size,shown,instances,kinds:out};}
 function dispose(){for(const row of pools.values())release(row.mesh);pools.clear();for(const k of kinds.values()){k.geometry.dispose();k.material.dispose();k.depth.dispose();}kinds.clear();}
 return{add,remove,redrop,flush,update,has,diagnostics,dispose,kinds:Object.keys(KINDS)};
}
root.BurbzWorldNature={create,KINDS,SWAP,END,CROWNS,MORPH,EDGE,CELL,PROTOTYPES:Object.keys(PROTOTYPES)};
})(globalThis);
