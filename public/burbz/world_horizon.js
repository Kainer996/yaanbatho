/* Alderwing's distant land: real elevation out to the haze at low cost.
 * Two world-aligned grids (16m and 96m) circle the viewer, coloured by the same
 * nature rules as the near ground. A hole leaves the detailed chunks in charge
 * nearby; lakes and the sea reflect the sky. Draws: two meshes, no shadows. */
(function(root){'use strict';
const ZOOM=11,URL='https://tiles.mapterhorn.com/{z}/{x}/{y}.webp',DIM=512;
const LEVELS=[{step:16,cells:64,snap:64},{step:140,cells:64,snap:560}];
function decode(pixels){const out=new Float32Array(DIM*DIM);for(let i=0,j=0;i<out.length;i++,j+=4)out[i]=pixels[j]*256+pixels[j+1]+pixels[j+2]/256-32768;return out;}
function create(T,scene,{origin,merc,style,height,nature,signal}){
 // height(x,z): metres above sea from the detailed map when known, else null.
 // nature(x,z,altitude,slope,water): {ground:[r,g,b],canopy:0..1,wood:[r,g,b]}.
 const own=new Map(),holes=[new T.Vector4(0,0,0,0),new T.Vector4(0,0,0,0)],edges=[new T.Vector4(-1e6,-1e6,1e6,1e6),new T.Vector4(-1e6,-1e6,1e6,1e6)],meshes=[],builds=[null,null],centres=[null,null];
 let closed=false,datum=null,lastTiles='',ready=false,rebuildAll=false,idleUntil=0,near={x0:0,z0:0,x1:0,z1:0};
 const materials=LEVELS.map((level,i)=>{
  const m=new T.MeshLambertMaterial({vertexColors:true});
  const hole={value:holes[i]};
  m.onBeforeCompile=shader=>{shader.uniforms.horizonHole=hole;shader.uniforms.horizonRamp={value:i===0?1:0};shader.uniforms.horizonEdge={value:edges[i]};shader.uniforms.horizonCut={value:i===1?1:0};
   shader.vertexShader='uniform vec4 horizonHole;\nuniform float horizonRamp;\nuniform vec4 horizonEdge;\nattribute float horizonCanopy;\nattribute float horizonWater;\nattribute float horizonCoarse;\nvarying vec3 horizonWorld;\nvarying float horizonWet;\n'+shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vec4 horizonAt=modelMatrix*vec4(transformed,1.0);
 // The fine level bends onto the coarse level's surface at its outer edge.
 float horizonInset=min(min(horizonAt.x-horizonEdge.x,horizonEdge.z-horizonAt.x),min(horizonAt.z-horizonEdge.y,horizonEdge.w-horizonAt.z));
 transformed.y=mix(horizonCoarse,transformed.y,smoothstep(0.0,72.0,horizonInset)*horizonRamp+(1.0-horizonRamp));
 // Woods rise into a canopy away from the detailed ground, never at its edge.
 float horizonOut=max(max(horizonHole.x-horizonAt.x,horizonAt.x-horizonHole.z),max(horizonHole.y-horizonAt.z,horizonAt.z-horizonHole.w));
 transformed.y+=horizonCanopy*mix(1.0,smoothstep(0.0,32.0,horizonOut),horizonRamp);
 horizonWorld=(modelMatrix*vec4(transformed,1.0)).xyz;horizonWet=horizonWater;`);
   shader.fragmentShader='uniform vec4 horizonHole;\nuniform float horizonCut;\nvarying vec3 horizonWorld;\nvarying float horizonWet;\n'+shader.fragmentShader.replace('#include <clipping_planes_fragment>',`#include <clipping_planes_fragment>
 if(horizonCut>.5&&horizonWorld.x>horizonHole.x&&horizonWorld.x<horizonHole.z&&horizonWorld.z>horizonHole.y&&horizonWorld.z<horizonHole.w)discard;`).replace('#include <fog_fragment>',`#ifdef USE_FOG
 // Still water mirrors the sky: brighter the flatter the view across it.
 // Blended in output space, like the fog, so it matches the real horizon.
 if(horizonWet>.5){float glance=1.0-max(normalize(cameraPosition-horizonWorld).y,0.0);float fresnel=.1+.8*pow(glance,5.0);
  gl_FragColor.rgb=mix(gl_FragColor.rgb*.5+fogColor*.18,fogColor*1.03,fresnel);}
 #endif
 #include <fog_fragment>`);};
  m.customProgramCacheKey=()=> 'alderwing-horizon-v1';style(m);return m;});
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
 function indices(i){const level=LEVELS[i],n=level.cells+1,half=level.cells/2,s=level.step,c=centres[i],idx=[],fine=LEVELS[0].cells/2*LEVELS[0].step;
  const inner=i===1?(centres[0]?{x0:centres[0].x-fine,x1:centres[0].x+fine,z0:centres[0].z-fine,z1:centres[0].z+fine}:null):near.x1>near.x0?near:null;
  for(let r=0;r<level.cells;r++)for(let j=0;j<level.cells;j++){if(inner){const x0=c.x+(j-half)*s,z0=c.z+(r-half)*s;if(x0>=inner.x0&&x0+s<=inner.x1&&z0>=inner.z0&&z0+s<=inner.z1)continue;}const a=r*n+j,d=a+n;idx.push(a,d,a+1,a+1,d,d+1);}
  return idx;}
 // The coarse level's own triangulated surface at a point (96m lattice).
 function coarseAt(x,z,fallback){const S=LEVELS[1].step,x0=Math.floor(x/S)*S,z0=Math.floor(z/S)*S,fx=(x-x0)/S,fz=(z-z0)/S,a=farHeight(x0,z0),b=farHeight(x0+S,z0),c=farHeight(x0,z0+S),d=farHeight(x0+S,z0+S);
  return [a,b,c,d].every(v=>v!==null&&Number.isFinite(v))?(fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz)):fallback;}
 // Build a level in slices across frames, then swap it in whole.
 function begin(i,cx,cz){const level=LEVELS[i],n=level.cells+1;builds[i]={cx,cz,row:0,heights:new Float32Array(n*n),known:new Uint8Array(n*n),coarse:new Float32Array(n*n),colors:new Float32Array(n*n*3),canopy:new Float32Array(n*n),water:new Float32Array(n*n),phase:'heights'};}
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
    const look=nature(X(j),Z(r),h,slope,flat);b.colors.set(look.ground,k*3);b.canopy[k]=look.canopy;b.water[k]=look.water?1:0;}
   if(b.row>=total){b.phase='done';break;}if(performance.now()>=until)return false;}
  return b.phase==='done';
 }
 function swap(i){
  const b=builds[i],level=LEVELS[i],n=level.cells+1,half=level.cells/2,s=level.step,position=new Float32Array(n*n*3);
  for(let r=0;r<n;r++)for(let j=0;j<n;j++){const k=r*n+j;position[k*3]=(j-half)*s;position[k*3+1]=b.heights[k]-datum;position[k*3+2]=(r-half)*s;}
  centres[i]={x:b.cx,z:b.cz};
  const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(position,3));g.setAttribute('color',new T.BufferAttribute(b.colors,3));g.setAttribute('horizonCanopy',new T.BufferAttribute(b.canopy,1));g.setAttribute('horizonWater',new T.BufferAttribute(b.water,1));const coarse=new Float32Array(n*n);for(let k=0;k<n*n;k++)coarse[k]=(i===0?b.coarse[k]:b.heights[k])-datum;g.setAttribute('horizonCoarse',new T.BufferAttribute(coarse,1));g.setIndex(indices(i));g.computeVertexNormals();
  g.boundingSphere=new T.Sphere(new T.Vector3(0,0,0),level.cells*s);
  let mesh=meshes[i];if(!mesh){mesh=meshes[i]=new T.Mesh(g,materials[i]);mesh.name='Alderwing horizon '+i;mesh.frustumCulled=false;mesh.renderOrder=5;mesh.matrixAutoUpdate=true;scene.add(mesh);}else{mesh.geometry.dispose();mesh.geometry=g;}
  mesh.position.set(b.cx,0,b.cz);builds[i]=null;
  if(i===0){const w=LEVELS[0].cells/2*LEVELS[0].step;holes[1].set(b.cx-w,b.cz-w,b.cx+w,b.cz+w);edges[0].set(b.cx-w,b.cz-w,b.cx+w,b.cz+w);if(meshes[1])meshes[1].geometry.setIndex(indices(1));}
  ready=!!meshes[0]&&!!meshes[1];
 }
 // Called each frame with the viewer and the square of detailed ground.
 function update(player,square,time){
  if(closed||datum===null)return;
  holes[0].set(square.x0,square.z0,square.x1,square.z1);
  // Re-cut the fine level at once when the detailed square moves or grows.
  if(square.x0!==near.x0||square.x1!==near.x1||square.z0!==near.z0||square.z1!==near.z1){near={x0:square.x0,z0:square.z0,x1:square.x1,z1:square.z1};if(meshes[0]&&centres[0])meshes[0].geometry.setIndex(indices(0));}
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
 function diagnostics(){return{ready,tiles:[...own.values()].map(t=>({x:t.x,y:t.y,loaded:!!t.dem})),levels:meshes.map(m=>m&&{triangles:m.geometry.index.count/3,x:m.position.x,z:m.position.z}),building:builds.map(b=>b&&b.phase),hole:[holes[0].x,holes[0].y,holes[0].z,holes[0].w]};}
 function dispose(){closed=true;for(const m of meshes)if(m){m.removeFromParent();m.geometry.dispose();}for(const m of materials)m.dispose();own.clear();}
 return{update,refresh,setDatum,diagnostics,dispose,get ready(){return ready;},farHeight};
}
root.BurbzWorldHorizon={create,LEVELS,ZOOM};
})(globalThis);
