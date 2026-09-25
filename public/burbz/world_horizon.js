/* Alderwing's distant land: real elevation out to the haze at low cost.
 * Two world-aligned grids (16m and 140m) circle the viewer, coloured by the
 * same nature rules as the near ground. A hole leaves the detailed chunks in
 * charge nearby; lakes and the sea reflect the sky. Its shape follows the
 * viewer's distance alone, as CDLOD terrain does: the fine grid bends onto
 * the coarse one before its edge, and woods rise into a canopy where the
 * last canopy crowns end. Recentring changes nothing drawn; new map data
 * eases in from what was drawn before. Draws: two meshes, no shadows. */
(function(root){'use strict';
const ZOOM=11,URL='https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',DIM=512,BLEND=1200;
const LEVELS=[{step:16,cells:64,snap:64},{step:140,cells:64,snap:560}];
// Distances from the viewer's eye in metres. The fine grid reaches at least
// 480m in every direction, so it bends onto the coarse grid between MORPH
// (square distance). Woods rise into a canopy between RISE (round distance).
const MORPH=[400,472],RISE=[250,320];
function decode(pixels){const out=new Float32Array(DIM*DIM);for(let i=0,j=0;i<out.length;i++,j+=4)out[i]=pixels[j]*256+pixels[j+1]+pixels[j+2]/256-32768;return out;}
// Treetops seen from afar: a jittered cell of crowns, bright at their middles
// and dark in the gaps between, eased to its average once cells shrink to a
// few pixels. The detailed ground's edge uses the same pattern.
const CANOPY=`float canopyCrowns(vec2 p,float far){
 vec2 q=p/6.5,g=floor(q),f=q-g,s=step(.5,f)*2.-1.;float best=9.0;
 // The four cells toward this point hold its nearest treetop.
 for(int y=0;y<2;y++)for(int x=0;x<2;x++){vec2 c=vec2(float(x),float(y))*s,k=g+c;vec3 h=fract(vec3(k.xyx)*vec3(.1031,.1030,.0973));h+=dot(h,h.yzx+33.33);vec2 j=fract((h.xx+h.yz)*h.zy),d=c+.15+.7*j-f;best=min(best,dot(d,d));}
 return mix(mix(.4,1.06,1.0-smoothstep(.1,.5,best)),.8,far);
}`;
function create(T,scene,{origin,merc,style,height,nature,signal,eye={value:new T.Vector3()}}){
 // height(x,z): metres above sea from the detailed ground when known, else null.
 // nature(x,z,altitude,slope,water): {ground:[r,g,b],canopy:metres,water,
 // wood:0-1,conifer:0-1,crown:[r,g,b]}. eye: the viewer's eye, a uniform.
 const own=new Map(),holes=[new T.Vector4(0,0,0,0),new T.Vector4(0,0,0,0)],edge=new T.Vector4(-1e6,-1e6,1e6,1e6),meshes=[],builds=[null,null],centres=[null,null];
 const blends=[{value:1},{value:1}],blendStart=[0,0],shown=[null,null];
 let closed=false,datum=null,lastTiles='',ready=false,rebuildAll=false,idleUntil=0,near={x0:0,z0:0,x1:0,z1:0},epoch=0,latest=null;const changes=[null,null];
 const materials=LEVELS.map((level,i)=>{
  const m=new T.MeshLambertMaterial({vertexColors:true});
  const hole={value:holes[i]};
  m.onBeforeCompile=shader=>{shader.uniforms.horizonHole=hole;shader.uniforms.horizonFine={value:i===0?1:0};shader.uniforms.horizonEye=eye;shader.uniforms.horizonEdge={value:edge};shader.uniforms.horizonCut={value:i===1?1:0};shader.uniforms.horizonBlend=blends[i];
   shader.vertexShader='uniform vec4 horizonHole;\nuniform float horizonFine;\nuniform vec3 horizonEye;\nuniform vec4 horizonEdge;\nuniform float horizonBlend;\nattribute float horizonCanopy;\nattribute float horizonWater;\nattribute float horizonCoarse;\nattribute vec2 horizonPrev;\nattribute vec3 horizonPrevColor;\nvarying vec3 horizonWorld;\nvarying float horizonWet;\nvarying float horizonWood;\n'+shader.vertexShader.replace('#include <color_vertex>',`#include <color_vertex>
 // New map data eases in from what was drawn before, so nothing pops.
 vColor.rgb=mix(horizonPrevColor,vColor.rgb,horizonBlend);`).replace('#include <begin_vertex>',`#include <begin_vertex>
 vec2 horizonAt=(modelMatrix*vec4(transformed,1.0)).xz,horizonOff=horizonAt-horizonEye.xz;
 float horizonBase=mix(horizonPrev.x,transformed.y,horizonBlend),horizonTop=mix(horizonPrev.y,horizonCanopy,horizonBlend);
 // Distance alone shapes the land: the fine level bends onto the coarse
 // level's surface before its own edge, and woods rise into a canopy where
 // the last canopy crowns end. Moving the grids changes nothing drawn. Should
 // the viewer ever outrun a rebuild, the fine level's own edge bends too.
 float horizonInset=min(min(horizonAt.x-horizonEdge.x,horizonEdge.z-horizonAt.x),min(horizonAt.y-horizonEdge.y,horizonEdge.w-horizonAt.y));
 transformed.y=mix(horizonBase,horizonCoarse,horizonFine*max(smoothstep(${MORPH[0]}.,${MORPH[1]}.,max(abs(horizonOff.x),abs(horizonOff.y))),1.0-smoothstep(0.,32.,horizonInset)));
 transformed.y+=horizonTop*smoothstep(${RISE[0]}.,${RISE[1]}.,length(horizonOff));
 horizonWorld=(modelMatrix*vec4(transformed,1.0)).xyz;horizonWet=horizonWater;horizonWood=clamp(horizonTop/4.6,0.,1.);`);
   shader.fragmentShader='uniform vec4 horizonHole;\nuniform float horizonCut;\nvarying vec3 horizonWorld;\nvarying float horizonWet;\nvarying float horizonWood;\n'+CANOPY+'\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 if(horizonWood>.01)diffuseColor.rgb*=mix(1.0,canopyCrowns(horizonWorld.xz,smoothstep(260.,800.,distance(cameraPosition,horizonWorld))),horizonWood);`).replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 if(horizonCut>.5&&horizonWorld.x>horizonHole.x&&horizonWorld.x<horizonHole.z&&horizonWorld.z>horizonHole.y&&horizonWorld.z<horizonHole.w)discard;`).replace('#include <fog_fragment>',`#ifdef USE_FOG
 // Still water mirrors the sky: brighter the flatter the view across it.
 // Blended in output space, like the fog, so it matches the real horizon.
 if(horizonWet>.5){float glance=1.0-max(normalize(cameraPosition-horizonWorld).y,0.0);float fresnel=.1+.8*pow(glance,5.0);
  gl_FragColor.rgb=mix(gl_FragColor.rgb*.5+fogColor*.18,fogColor*1.03,fresnel);}
 #endif
 #include <fog_fragment>`);};
  m.customProgramCacheKey=()=> 'alderwing-horizon-v4';style(m);return m;});
 function tileKey(x,z){const m=merc,n=2**ZOOM,mx=(m.x+x/m.scale)*n,my=(m.z+z/m.scale)*n;return{tx:Math.floor(mx),ty:Math.floor(my),fx:mx-Math.floor(mx),fy:my-Math.floor(my)};}
 // Fetch the 2x2 block of zoom-11 tiles nearest the viewer: at least 5km of
 // land on every side. The service worker keeps visited tiles for offline.
 function wantTiles(x,z){const t=tileKey(x,z),x0=t.fx<.5?t.tx-1:t.tx,y0=t.fy<.5?t.ty-1:t.ty,rows=[];for(let dx=0;dx<2;dx++)for(let dy=0;dy<2;dy++)rows.push({x:x0+dx,y:y0+dy});return rows;}
 async function load(tile){
  const key=ZOOM+'/'+tile.x+'/'+tile.y;if(own.has(key))return;const row={z:ZOOM,x:tile.x,y:tile.y,dem:null};own.set(key,row);
  try{
   const response=await fetch(URL.replace('{z}',ZOOM).replace('{x}',tile.x).replace('{y}',tile.y),{mode:'cors',signal});if(!response.ok)throw Error('tile');
   const bitmap=await createImageBitmap(await response.blob(),{colorSpaceConversion:'none',premultiplyAlpha:'none'});if(closed){bitmap.close?.();return;}
   const canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(DIM,DIM):Object.assign(document.createElement('canvas'),{width:DIM,height:DIM});
   const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(bitmap,0,0,DIM,DIM);bitmap.close?.();
   const data=decode(ctx.getImageData(0,0,DIM,DIM).data);
   row.dem={dim:DIM,get:(i,j)=>data[Math.max(0,Math.min(DIM-1,j))*DIM+Math.max(0,Math.min(DIM-1,i))]};rebuildAll=true;
  }catch(_){if(!closed)setTimeout(()=>{if(own.get(key)===row&&!row.dem)own.delete(key);},30000);}
 }
 function farHeight(x,z){const near=height(x,z);if(near!==null)return near;const m=merc,n=2**ZOOM,mx=(m.x+x/m.scale)*n,my=(m.z+z/m.scale)*n,tx=Math.floor(mx),ty=Math.floor(my),row=own.get(ZOOM+'/'+(((tx%n)+n)%n)+'/'+ty);
  if(!row?.dem)return null;const fx=(mx-tx)*DIM-.5,fy=(my-ty)*DIM-.5,ix=Math.floor(fx),iy=Math.floor(fy),dx=fx-ix,dy=fy-iy,d=row.dem;
  return d.get(ix,iy)*(1-dx)*(1-dy)+d.get(ix+1,iy)*dx*(1-dy)+d.get(ix,iy+1)*(1-dx)*dy+d.get(ix+1,iy+1)*dx*dy;}
 // Cell triangles for a level. The fine level leaves out every 16m cell of
 // the detailed square (both grids share 16m boundaries), so it draws no
 // hidden ground at all. The coarse level skips cells wholly inside the fine
 // one and its shader discards the thin overlapping ring.
 function indices(i,all=false,centre=centres[i]){const level=LEVELS[i],n=level.cells+1,half=level.cells/2,s=level.step,c=centre,idx=[],fine=LEVELS[0].cells/2*LEVELS[0].step;
  const inner=all?null:i===1?(centres[0]?{x0:centres[0].x-fine,x1:centres[0].x+fine,z0:centres[0].z-fine,z1:centres[0].z+fine}:null):near.x1>near.x0?near:null;
  for(let r=0;r<level.cells;r++)for(let j=0;j<level.cells;j++){if(inner){const x0=c.x+(j-half)*s,z0=c.z+(r-half)*s;if(x0>=inner.x0&&x0+s<=inner.x1&&z0>=inner.z0&&z0+s<=inner.z1)continue;}const a=r*n+j,d=a+n;idx.push(a,d,a+1,a+1,d,d+1);}
  return idx;}
 // The coarse level's own triangulated surface at a point (140m lattice).
 function coarseAt(x,z,fallback){const S=LEVELS[1].step,x0=Math.floor(x/S)*S,z0=Math.floor(z/S)*S,fx=(x-x0)/S,fz=(z-z0)/S,a=farHeight(x0,z0),b=farHeight(x0+S,z0),c=farHeight(x0,z0+S),d=farHeight(x0+S,z0+S);
  return [a,b,c,d].every(v=>v!==null&&Number.isFinite(v))?(fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz)):fallback;}
 // Build a level in slices across frames, then swap it in whole.
 function begin(i,cx,cz){const level=LEVELS[i],n=level.cells+1;builds[i]={cx,cz,row:0,heights:new Float32Array(n*n),known:new Uint8Array(n*n),coarse:new Float32Array(n*n),colors:new Float32Array(n*n*3),canopy:new Float32Array(n*n),water:new Float32Array(n*n),wood:new Float32Array(n*n),conifer:new Float32Array(n*n),crown:new Float32Array(n*n*3),phase:'heights'};}
 // Work advances sample by sample and checks the clock every 16 samples, so
 // even a slow phone never spends more than the budget in one frame.
 function step(i,budget){
  const b=builds[i],level=LEVELS[i],n=level.cells+1,half=level.cells/2,s=level.step,until=performance.now()+budget,total=n*n;
  const X=j=>b.cx+(j-half)*s,Z=j=>b.cz+(j-half)*s;
  while(b.phase==='heights'){for(let q=0;q<16&&b.row<total;q++,b.row++){const r=Math.floor(b.row/n),j=b.row%n,h=farHeight(X(j),Z(r));if(h!==null&&Number.isFinite(h)){b.heights[b.row]=h;b.known[b.row]=1;}}
   if(b.row>=total){b.phase='fill';b.row=0;break;}if(performance.now()>=until)return false;}
  if(b.phase==='fill'){
   // Unknown samples take the mean of known land so the horizon never tears.
   let sum=0,count=0;for(let k=0;k<total;k++)if(b.known[k]){sum+=b.heights[k];count++;}if(!count){builds[i]=null;idleUntil=performance.now()+2000;return false;}const mean=sum/count;for(let k=0;k<total;k++)if(!b.known[k])b.heights[k]=mean;b.phase='colors';
  }
  while(b.phase==='colors'){for(let q=0;q<16&&b.row<total;q++,b.row++){const k=b.row,r=Math.floor(k/n),j=k%n;if(i===0)b.coarse[k]=coarseAt(X(j),Z(r),b.heights[k]);
    const h=b.heights[k],e=b.heights[r*n+Math.min(n-1,j+1)],w=b.heights[r*n+Math.max(0,j-1)],no=b.heights[Math.min(n-1,r+1)*n+j],so=b.heights[Math.max(0,r-1)*n+j];
    // Lakes and the sea are exactly level in the elevation data; land is not.
    // Every one of the eight neighbours must match within a centimetre.
    let flat=!!b.known[k];for(let dr=-1;dr<=1&&flat;dr++)for(let dj=-1;dj<=1;dj++){const rr=r+dr,jj=j+dj;if(rr<0||jj<0||rr>=n||jj>=n||!b.known[rr*n+jj]||Math.abs(b.heights[rr*n+jj]-h)>.01){flat=false;break;}}
    const slope=Math.hypot(e-w,no-so)/(2*s);
    const look=nature(X(j),Z(r),h,slope,flat);b.colors.set(look.ground,k*3);b.canopy[k]=look.canopy;b.water[k]=look.water?1:0;b.wood[k]=look.wood||0;b.conifer[k]=look.conifer||0;if(look.crown)b.crown.set(look.crown,k*3);}
   if(b.row>=total){b.phase='done';break;}if(performance.now()>=until)return false;}
  return b.phase==='done';
 }
 function swap(i){
  const b=builds[i],level=LEVELS[i],n=level.cells+1,half=level.cells/2,s=level.step,position=new Float32Array(n*n*3),w=level.cells/2*level.step;
  for(let r=0;r<n;r++)for(let j=0;j<n;j++){const k=r*n+j;position[k*3]=(j-half)*s;position[k*3+1]=b.heights[k]-datum;position[k*3+2]=(r-half)*s;}
  const coarse=new Float32Array(n*n);for(let k=0;k<n*n;k++)coarse[k]=(i===0?b.coarse[k]:b.heights[k])-datum;
  const view={cx:b.cx,cz:b.cz,heights:b.heights,canopy:b.canopy,colors:b.colors};
  // Where the old grid overlaps, start from exactly what it drew. A grid that
  // only moved holds the same values at the same places, so it needs no ease;
  // new map data eases in.
  const prev=new Float32Array(n*n*2),prevColor=new Float32Array(n*n*3),old=shown[i],t=blends[i].value,change={points:0,height:0,canopy:0,colour:0,x0:Infinity,z0:Infinity,x1:-Infinity,z1:-Infinity};let changed=false;
  for(let r=0;r<n;r++)for(let j=0;j<n;j++){const k=r*n+j,x=b.cx+(j-half)*s,z=b.cz+(r-half)*s;prev[k*2]=b.heights[k]-datum;prev[k*2+1]=b.canopy[k];prevColor.set(b.colors.subarray(k*3,k*3+3),k*3);
   if(!old)continue;const oj=(x-old.cx)/s+half,or=(z-old.cz)/s+half;if(oj<0||or<0||oj>=n||or>=n)continue;const o=or*n+oj,was=old.prev,wasColor=old.prevColor;
   prev[k*2]=was[o*2]+(old.heights[o]-datum-was[o*2])*t;prev[k*2+1]=was[o*2+1]+(old.canopy[o]-was[o*2+1])*t;for(let c=0;c<3;c++)prevColor[k*3+c]=wasColor[o*3+c]+(old.colors[o*3+c]-wasColor[o*3+c])*t;
   const dh=Math.abs(prev[k*2]-position[k*3+1]),dc=Math.abs(prev[k*2+1]-b.canopy[k]),dk=Math.abs(prevColor[k*3]-b.colors[k*3])+Math.abs(prevColor[k*3+1]-b.colors[k*3+1])+Math.abs(prevColor[k*3+2]-b.colors[k*3+2]);
   if(dh>.01||dc>.01||dk>.006){changed=true;change.points++;change.height=Math.max(change.height,dh);change.canopy=Math.max(change.canopy,dc);change.colour=Math.max(change.colour,dk);change.x0=Math.min(change.x0,x);change.z0=Math.min(change.z0,z);change.x1=Math.max(change.x1,x);change.z1=Math.max(change.z1,z);}}
  if(changed)changes[i]={...change,height:+change.height.toFixed(2),canopy:+change.canopy.toFixed(2),colour:+change.colour.toFixed(3)};
  view.prev=prev;view.prevColor=prevColor;shown[i]=view;blends[i].value=changed?0:1;blendStart[i]=performance.now();
  centres[i]={x:b.cx,z:b.cz};
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(position,3));g.setAttribute('color',new T.BufferAttribute(b.colors,3));g.setAttribute('horizonCanopy',new T.BufferAttribute(b.canopy,1));g.setAttribute('horizonWater',new T.BufferAttribute(b.water,1));g.setAttribute('horizonCoarse',new T.BufferAttribute(coarse,1));g.setAttribute('horizonPrev',new T.BufferAttribute(prev,2));g.setAttribute('horizonPrevColor',new T.BufferAttribute(prevColor,3));
  // Normals from the whole grid, so ground uncovered by a smaller hole later
  // is lit like its neighbours; then the cut index.
  g.setIndex(indices(i,true));g.computeVertexNormals();g.setIndex(indices(i));
  g.boundingSphere=new T.Sphere(new T.Vector3(0,0,0),level.cells*s);
  let mesh=meshes[i];if(!mesh){mesh=meshes[i]=new T.Mesh(g,materials[i]);mesh.name='Alderwing horizon '+i;mesh.frustumCulled=false;mesh.renderOrder=5;mesh.matrixAutoUpdate=true;scene.add(mesh);}else{mesh.geometry.dispose();mesh.geometry=g;}
  mesh.position.set(b.cx,0,b.cz);builds[i]=null;
  // The detailed ground and the canopy crowns read the fine level. They
  // follow when it first exists and when new data arrives, easing in with it.
  if(i===0){latest={cx:b.cx,cz:b.cz,n,half,heights:b.heights,colors:b.colors,canopy:b.canopy,normals:g.attributes.normal.array,wood:b.wood,conifer:b.conifer,crown:b.crown};if(!old||changed)epoch++;holes[1].set(b.cx-w,b.cz-w,b.cx+w,b.cz+w);edge.set(b.cx-w,b.cz-w,b.cx+w,b.cz+w);if(meshes[1])meshes[1].geometry.setIndex(indices(1));}
  ready=!!meshes[0]&&!!meshes[1];
 }
 // The fine level's own values at one of its lattice points, exactly as drawn
 // once eased in: the detailed ground's edge bends onto this surface.
 function lattice(x,z){const L=latest;if(!L)return null;const s=LEVELS[0].step,j=Math.round((x-L.cx)/s)+L.half,r=Math.round((z-L.cz)/s)+L.half;if(j<0||r<0||j>=L.n||r>=L.n)return null;const k=r*L.n+j;
  return{h:L.heights[k]-datum,canopy:L.canopy[k],color:[L.colors[k*3],L.colors[k*3+1],L.colors[k*3+2]],normal:[L.normals[k*3],L.normals[k*3+1],L.normals[k*3+2]]};}
 // The fine level's surface at any point, across the same triangles it
 // draws: height, wood, conifer share and crown colour. Null off the grid.
 function sampleAt(x,z,out={crown:[0,0,0]}){const L=latest;if(!L)return null;const s=LEVELS[0].step,gx=(x-L.cx)/s+L.half,gz=(z-L.cz)/s+L.half,j=Math.floor(gx),r=Math.floor(gz),fx=gx-j,fz=gz-r;if(j<0||r<0||j>=L.n-1||r>=L.n-1)return null;
  const a=r*L.n+j,b=a+1,c=a+L.n,d=c+1,[p,q,u,wp,wq,wu]=fx+fz<=1?[a,b,c,1-fx-fz,fx,fz]:[d,b,c,fx+fz-1,1-fz,1-fx],mix=A=>A[p]*wp+A[q]*wq+A[u]*wu;
  out.h=mix(L.heights)-datum;out.canopy=mix(L.canopy);out.wood=mix(L.wood);out.conifer=mix(L.conifer);for(let i=0;i<3;i++)out.crown[i]=L.crown[p*3+i]*wp+L.crown[q*3+i]*wq+L.crown[u*3+i]*wu;return out;}
 // Called each frame with the viewer and the detailed ground: view.cut is the
 // chunk-aligned square it covers, view.bend the square it shows unbent.
 function update(player,view,time){
  if(closed||datum===null)return;
  const cut=view.cut,bend=view.bend;holes[0].set(bend.x0,bend.z0,bend.x1,bend.z1);
  // Re-cut the fine level at once when the detailed square moves or grows.
  if(cut.x0!==near.x0||cut.x1!==near.x1||cut.z0!==near.z0||cut.z1!==near.z1){near={x0:cut.x0,z0:cut.z0,x1:cut.x1,z1:cut.z1};if(meshes[0]&&centres[0])meshes[0].geometry.setIndex(indices(0));}
  for(let i=0;i<LEVELS.length;i++)if(blends[i].value<1)blends[i].value=Math.min(1,(performance.now()-blendStart[i])/BLEND);
  const tiles=wantTiles(player.x,player.z),key=tiles.map(t=>t.x+'/'+t.y).join(';');
  if(key!==lastTiles){lastTiles=key;for(const t of tiles)load(t);for(const k of [...own.keys()])if(!tiles.some(t=>ZOOM+'/'+t.x+'/'+t.y===k))own.delete(k);}
  // With no elevation yet (offline, or tiles still loading), wait quietly.
  if(performance.now()<idleUntil&&!rebuildAll)return;
  for(let i=0;i<LEVELS.length;i++){const level=LEVELS[i],cx=Math.round(player.x/level.snap)*level.snap,cz=Math.round(player.z/level.snap)*level.snap;
   if(!builds[i]&&(!centres[i]||centres[i].x!==cx||centres[i].z!==cz||rebuildAll))begin(i,cx,cz);}
  rebuildAll=false;
  // One level advances per frame inside a few milliseconds.
  const i=builds[0]?0:builds[1]?1:-1;if(i>=0&&step(i,i===0?3:2.5))swap(i);
 }
 function refresh(){rebuildAll=true;}
 function setDatum(value){datum=value;}
 function diagnostics(){return{ready,epoch,blend:blends.map(b=>+b.value.toFixed(2)),tiles:[...own.values()].map(t=>({x:t.x,y:t.y,loaded:!!t.dem})),levels:meshes.map(m=>m&&{triangles:m.geometry.index.count/3,x:m.position.x,z:m.position.z}),building:builds.map(b=>b&&b.phase),hole:[holes[0].x,holes[0].y,holes[0].z,holes[0].w],cut:[near.x0,near.z0,near.x1,near.z1],changes};}
 function dispose(){closed=true;for(const m of meshes)if(m){m.removeFromParent();m.geometry.dispose();}for(const m of materials)m.dispose();own.clear();}
 return{update,refresh,setDatum,diagnostics,dispose,lattice,sampleAt,get ready(){return ready;},get epoch(){return epoch;},farHeight};
}
root.BurbzWorldHorizon={create,LEVELS,ZOOM,BLEND,CANOPY,MORPH,RISE};
})(globalThis);
