/* Continuous first-person terrain: metres, immutable chunk IDs and DEM sampling.
 * This module does not access GPS, game rewards or persistent state. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzVillageWorldCore=api;})(globalThis,function(){
'use strict';
const CHUNK=32,STEP=2,RINGS=5,TREE_GRID=3.2,EARTH=40075016.68557849;
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function smooth(t){t=clamp(t,0,1);return t*t*(3-2*t);}
function hash(x,z,salt=0){let h=Math.imul(x|0,374761393)^Math.imul(z|0,668265263)^salt;h=Math.imul(h^(h>>>13),1274126177);return((h^(h>>>16))>>>0)/4294967296;}
function key(x,z){return Math.floor(x/CHUNK)+','+Math.floor(z/CHUNK);}
function chunks(x,z,rings=RINGS){const cx=Math.floor(x/CHUNK),cz=Math.floor(z/CHUNK),rows=[];for(let dx=-rings;dx<=rings;dx++)for(let dz=-rings;dz<=rings;dz++)rows.push({id:(cx+dx)+','+(cz+dz),x:(cx+dx)*CHUNK,z:(cz+dz)*CHUNK,d:Math.max(Math.abs(dx),Math.abs(dz))});return rows.sort((a,b)=>a.d-b.d||a.x-b.x||a.z-b.z);}
function mercator(origin){return{x:(origin.lon+180)/360,z:(1-Math.log(Math.tan(Math.PI/4+origin.lat*Math.PI/360))/Math.PI)/2,scale:EARTH*Math.cos(origin.lat*Math.PI/180)};}
function elevation(tiles,origin,x,z){return elevationSample(tiles,origin,x,z)?.h??null;}
// The same, with the zoom of the tile it came from: the most detailed first.
function elevationSample(tiles,origin,x,z){const m=origin.scale?origin:mercator(origin),mx=m.x+x/m.scale,my=m.z+z/m.scale;for(const tile of tiles){const n=2**tile.z,tx=((mx*n)%n+n)%n,ty=my*n;if(Math.floor(tx)!==tile.x||Math.floor(ty)!==tile.y)continue;const d=tile.dem,fx=(tx-tile.x)*d.dim,fy=(ty-tile.y)*d.dim,ix=Math.floor(fx),iy=Math.floor(fy),dx=fx-ix,dy=fy-iy;try{const h=d.get(ix,iy)*(1-dx)*(1-dy)+d.get(ix+1,iy)*dx*(1-dy)+d.get(ix,iy+1)*(1-dx)*dy+d.get(ix+1,iy+1)*dx*dy;if(Number.isFinite(h))return{h,z:tile.z};}catch(_){}}return null;}
function joinedHeight(x,z,{radius,blend=64,authored,raw,datum}){const d=Math.hypot(x,z);if(d<=radius)return authored(x,z);const h=raw(x,z);if(!Number.isFinite(h)||!Number.isFinite(datum))return null;const t=smooth((d-radius)/blend);return authored(x,z)*(1-t)+(h-datum)*t;}
// The home alters only its bounded plot; its terrain and scenery share this
// function. Unknown ground remains unknown even beneath the flat foundation.
function homeHeight(x,z,home,height){if(!Number.isFinite(height))return null;const d=Math.hypot(x-home.x,z-home.z);if(d>=home.blendRadius)return height;const t=smooth((d-home.radius)/(home.blendRadius-home.radius));return home.base*(1-t)+height*t;}
// Sample the same globally aligned two-metre triangles as groundMesh/meshHeight,
// including before those chunks are streamed in. Do not use analytic heights
// for props on a piecewise-planar rendered surface.
function sampleGround(x,z,height){const x0=Math.floor(x/STEP)*STEP,z0=Math.floor(z/STEP)*STEP,fx=(x-x0)/STEP,fz=(z-z0)/STEP,a=height(x0,z0),b=height(x0+STEP,z0),c=height(x0,z0+STEP),d=height(x0+STEP,z0+STEP);if(![a,b,c,d].every(Number.isFinite))return null;return fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz);}
function trees(chunk,shift={x:0,z:0}){const rows=[],size=TREE_GRID;for(let gx=Math.floor((chunk.x+shift.x)/size);gx<=Math.floor((chunk.x+CHUNK+shift.x)/size);gx++)for(let gz=Math.floor((chunk.z+shift.z)/size);gz<=Math.floor((chunk.z+CHUNK+shift.z)/size);gz++){const x=(gx+.15+hash(gx,gz,71)*.7)*size-shift.x,z=(gz+.15+hash(gx,gz,113)*.7)*size-shift.z;if(x<chunk.x||x>=chunk.x+CHUNK||z<chunk.z||z>=chunk.z+CHUNK)continue;rows.push({id:'cw:'+gx+':'+gz,x,z,size:.75+hash(gx,gz,17)*.95,angle:hash(gx,gz,31)*Math.PI*2,kind:hash(gx,gz,47)<.6?'pines':'leafs',tone:hash(gx,gz,61)});}return rows;}
// Sample the whole root footprint, not just the trunk's centre. Missing
// neighbours are not permission to plant on an unverified cliff edge.
function treeGround(x,z,size,height){
 const y=height(x,z);if(!Number.isFinite(y))return null;
 for(const radius of [.45,1.35*size])for(let i=0;i<8;i++){
  const a=i*Math.PI/4,h=height(x+Math.cos(a)*radius,z+Math.sin(a)*radius);
  if(!Number.isFinite(h)||Math.abs(h-y)>radius*.65)return null;
 }
 return y;
}
function habitat(x,z,shift={x:0,z:0}){
 const u=(x+shift.x)/48,v=(z+shift.z)/48,gx=Math.floor(u),gz=Math.floor(v),a=smooth(u-gx),b=smooth(v-gz);
 return (hash(gx,gz,409)*(1-a)+hash(gx+1,gz,409)*a)*(1-b)+(hash(gx,gz+1,409)*(1-a)+hash(gx+1,gz+1,409)*a)*b;
}
function rockContains(rock,x,y,z){
 const dx=x-rock.x,dz=z-rock.z,c=Math.cos(rock.angle||0),s=Math.sin(rock.angle||0),u=c*dx-s*dz,v=s*dx+c*dz;
 return (y===null||y>rock.y-rock.h-.3&&y<rock.y+rock.h+.3)&&Math.hypot(u/(rock.w+.3),v/(rock.d+.3))<1;
}
function rocks(cell,shift,height,excluded){
 const rows=[],grid=11;
 for(let gx=Math.floor((cell.x+shift.x)/grid);gx<=Math.floor((cell.x+CHUNK+shift.x)/grid);gx++)for(let gz=Math.floor((cell.z+shift.z)/grid);gz<=Math.floor((cell.z+CHUNK+shift.z)/grid);gz++){
  const x=(gx+.2+hash(gx,gz,613)*.6)*grid-shift.x,z=(gz+.2+hash(gx,gz,617)*.6)*grid-shift.z;
  if(x<cell.x||x>=cell.x+CHUNK||z<cell.z||z>=cell.z+CHUNK||excluded(x,z,4))continue;
  const y=height(x,z),a=height(x+2,z),b=height(x-2,z),c=height(x,z+2),d=height(x,z-2);
  if(![y,a,b,c,d].every(Number.isFinite))continue;
  const slope=Math.hypot(a-b,c-d)/4,patch=habitat(x,z,shift),r=hash(gx,gz,631);
  if(slope<.3&&patch<.57&&r>.045||slope>=.3&&r>(patch>.52?.66:.16))continue;
  const tall=slope>.55,size=.65+hash(gx,gz,641)*1.4;
  rows.push({id:'rock:'+gx+':'+gz,x,z,y:y-.3*size,w:size*(tall?1.4:1.7),h:size*(tall?2.2:.9),d:size,angle:hash(gx,gz,643)*Math.PI,tone:hash(gx,gz,647)});
 }
 return rows;
}
// Cascades belong to existing watercourses. The sheet follows sampled ground
// downhill; neither the geographic elevations nor flat rivers gain fake drops.
function cascades(cell,corridors,height,excluded){
 const rows=[];
 for(let ci=0;ci<corridors.length;ci++){
  const c=corridors[ci];if(c.kind!=='river')continue;
  const corners=[[cell.x,cell.z],[cell.x+CHUNK,cell.z],[cell.x,cell.z+CHUNK],[cell.x+CHUNK,cell.z+CHUNK]];
  const along=corners.map(([x,z])=>(x-c.x)*c.ux+(z-c.z)*c.uz);
  for(let a=Math.ceil(Math.max(-c.end+6,Math.min(...along))/12)*12;a<=Math.min(c.end-6,Math.max(...along));a+=12){
   const x=c.x+c.ux*a,z=c.z+c.uz*a,width=corridorWidth(c,a)*.88;
   if(x<cell.x||x>=cell.x+CHUNK||z<cell.z||z>=cell.z+CHUNK||width<.65||excluded(x,z,6))continue;
   let points=[];for(let j=-5;j<=5;j++){const px=x+c.ux*j,pz=z+c.uz*j,y=height(px,pz);points.push({x:px,z:pz,y});}
   if(points.some(p=>!Number.isFinite(p.y)))continue;
   if(points[0].y<points[10].y)points.reverse();const drop=points[0].y-points[10].y;
   if(drop<1.35||points.some((p,i)=>i&&p.y>points[i-1].y+.15))continue;
   rows.push({id:'cascade:'+ci+':'+a,x,z,width,drop,points});
  }
 }
 return rows;
}
function groundMesh(chunk,height,radius){const positions=[],uv=[],indices=[],n=CHUNK/STEP;for(let z=0;z<=n;z++)for(let x=0;x<=n;x++){const wx=chunk.x+x*STEP,wz=chunk.z+z*STEP,y=height(wx,wz);if(!Number.isFinite(y))return null;positions.push(x*STEP,y,z*STEP);uv.push(wx/4.6,wz/4.6);}for(let z=0;z<n;z++)for(let x=0;x<n;x++){const wx=chunk.x+(x+.5)*STEP,wz=chunk.z+(z+.5)*STEP;const a=z*(n+1)+x,b=a+1,c=a+n+1,d=c+1;indices.push(a,c,b,b,c,d);}return{positions,uv,indices};}
function meshHeight(chunk,data,x,z){const u=clamp((x-chunk.x)/STEP,0,CHUNK/STEP-1e-9),v=clamp((z-chunk.z)/STEP,0,CHUNK/STEP-1e-9),ix=Math.floor(u),iz=Math.floor(v),fx=u-ix,fz=v-iz,n=CHUNK/STEP+1,a=(iz*n+ix)*3+1,b=a+3,c=a+n*3,d=c+3,h=data.positions;return fx+fz<=1?h[a]+(h[b]-h[a])*fx+(h[c]-h[a])*fz:h[d]+(h[c]-h[d])*(1-fx)+(h[b]-h[d])*(1-fz);}
// Authored lanes and tributaries narrow gradually into the surrounding ground.
// Clip each strip to the same chunk grid so neighbouring meshes share edges.
function corridorWidth(c,along){return c.width*(1-smooth((Math.abs(along)-c.start)/(c.end-c.start)));}
function corridorContains(c,x,z,pad=0){const dx=x-c.x,dz=z-c.z,a=dx*c.ux+dz*c.uz,b=-dx*c.uz+dz*c.ux;return Math.abs(a)<c.end&&Math.abs(b)<corridorWidth(c,a)/2+pad;}
function ribbonMesh(cell,c,height,bank=false){
 const positions=[],uv=[],indices=[];
 function clip(poly,axis,bound,lower){const result=[];for(let i=0;i<poly.length;i++){const a=poly[i],b=poly[(i+1)%poly.length],ai=lower?a[axis]>=bound:a[axis]<=bound,bi=lower?b[axis]>=bound:b[axis]<=bound;if(ai)result.push(a);if(ai!==bi){const t=(bound-a[axis])/(b[axis]-a[axis]);result.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});}}return result;}
 const corners=[[cell.x,cell.z],[cell.x+CHUNK,cell.z],[cell.x,cell.z+CHUNK],[cell.x+CHUNK,cell.z+CHUNK]],alongValues=corners.map(([x,z])=>(x-c.x)*c.ux+(z-c.z)*c.uz),across=corners.map(([x,z])=>-(x-c.x)*c.uz+(z-c.z)*c.ux);
 if(Math.min(...across)>c.width/2+.6||Math.max(...across)<-c.width/2-.6)return{positions,uv,indices};
 const startAlong=Math.max(-Math.ceil(c.end/STEP)*STEP,Math.floor(Math.min(...alongValues)/STEP)*STEP),endAlong=Math.min(Math.ceil(c.end/STEP)*STEP,Math.ceil(Math.max(...alongValues)/STEP)*STEP);
 for(let along=startAlong;along<endAlong;along+=STEP)for(const side of bank?[-1,1]:[0]){
  const point=(a,edge)=>{const width=corridorWidth(c,a),offset=side?side*(width/2+(edge?Math.min(.6,width*.18):0)):edge*width/2;return{x:c.x+c.ux*a-c.uz*offset,z:c.z+c.uz*a+c.ux*offset};};
  let poly=side?[point(along,0),point(along,1),point(along+STEP,1),point(along+STEP,0)]:[point(along,-1),point(along,1),point(along+STEP,1),point(along+STEP,-1)];
  for(const [axis,bound,lower] of [['x',cell.x,true],['x',cell.x+CHUNK,false],['z',cell.z,true],['z',cell.z+CHUNK,false]]){poly=clip(poly,axis,bound,lower);if(poly.length<3)break;}
  if(poly.length<3)continue;
  const start=positions.length/3;for(const v of poly){const y=height(v.x,v.z);if(!Number.isFinite(y))return null;positions.push(v.x-cell.x,y+(bank?.024:.02),v.z-cell.z);uv.push((v.x*c.ux+v.z*c.uz)/(c.kind==='river'?8:2.6),(-v.x*c.uz+v.z*c.ux)/2.6);}
  for(let i=1;i<poly.length-1;i++){const a=poly[0],b=poly[i],d=poly[i+1],up=(b.z-a.z)*(d.x-a.x)-(b.x-a.x)*(d.z-a.z);indices.push(start,start+(up>=0?i:i+1),start+(up>=0?i+1:i));}
 }
 return {positions,uv,indices};
}
// The square of built chunks the detailed ground may show: grown side by side
// from the viewer's chunk while a whole new column or row is built, at most
// `limit` rings out. Metres; null when the viewer's own chunk is not built.
function showTarget(built,cx,cz,limit=RINGS-1){if(!built(cx,cz))return null;
 const column=(x,a,b)=>{for(let z=a;z<=b;z++)if(!built(x,z))return false;return true;},row=(z,a,b)=>{for(let x=a;x<=b;x++)if(!built(x,z))return false;return true;};
 let x0=cx,x1=cx,z0=cz,z1=cz,grown=true;
 while(grown){grown=false;
  if(x1-cx<limit&&column(x1+1,z0,z1)){x1++;grown=true;}if(cx-x0<limit&&column(x0-1,z0,z1)){x0--;grown=true;}
  if(z1-cz<limit&&row(z1+1,x0,x1)){z1++;grown=true;}if(cz-z0<limit&&row(z0-1,x0,x1)){z0--;grown=true;}}
 return{x0:x0*CHUNK,z0:z0*CHUNK,x1:(x1+1)*CHUNK,z1:(z1+1)*CHUNK};}
// Ease the shown square toward its target by at most `most` metres a side.
// Sides that shrink move first, so the square never covers a chunk that
// neither the old nor the new target holds. Returns the chunk-aligned cut.
function easeSquare(shown,target,most){
 if(!target){shown.ready=false;return{x0:0,z0:0,x1:0,z1:0};}
 if(!shown.ready||target.x0>=shown.x1||target.x1<=shown.x0||target.z0>=shown.z1||target.z1<=shown.z0)Object.assign(shown,target,{ready:true});
 else{const move=(from,to)=>from+Math.max(-most,Math.min(most,to-from));
  if(shown.x0<target.x0||shown.x1>target.x1||shown.z0<target.z0||shown.z1>target.z1){if(shown.x0<target.x0)shown.x0=move(shown.x0,target.x0);if(shown.x1>target.x1)shown.x1=move(shown.x1,target.x1);if(shown.z0<target.z0)shown.z0=move(shown.z0,target.z0);if(shown.z1>target.z1)shown.z1=move(shown.z1,target.z1);}
  else for(const side of ['x0','z0','x1','z1'])shown[side]=move(shown[side],target[side]);}
 return{x0:Math.floor(shown.x0/CHUNK)*CHUNK,z0:Math.floor(shown.z0/CHUNK)*CHUNK,x1:Math.ceil(shown.x1/CHUNK)*CHUNK,z1:Math.ceil(shown.z1/CHUNK)*CHUNK};}
// The three corners of the distant land's lattice triangle under a point and
// their weights: the same split as its cells, (x0,z0)-(x0,z0+S)-(x0+S,z0)
// and (x0+S,z0)-(x0,z0+S)-(x0+S,z0+S).
function latticeCorners(x,z,S){const x0=Math.floor(x/S)*S,z0=Math.floor(z/S)*S,fx=(x-x0)/S,fz=(z-z0)/S;
 return fx+fz<=1?[[x0,z0,1-fx-fz],[x0+S,z0,fx],[x0,z0+S,fz]]:[[x0+S,z0+S,fx+fz-1],[x0+S,z0,1-fz],[x0,z0+S,1-fx]];}
// The sun's shadow map centre for a viewer: the nearest point of a 16m grid,
// then moved to a whole number of shadow texels across the light. Shadow
// edges then keep their places when the map is redrawn. d: unit vector from
// the ground toward the light, matching the shadow camera's own axes.
function shadowCentre(x,z,d,texel,step=16){const cx=Math.round(x/step)*step,cz=Math.round(z/step)*step,flat=Math.hypot(d.x,d.z),sx=flat>1e-6?d.z/flat:1,sz=flat>1e-6?-d.x/flat:0;
 const ux=d.y*sz,uy=d.z*sx-d.x*sz,uz=-d.y*sx,u=Math.round((cx*sx+cz*sz)/texel)*texel,v=Math.round((cx*ux+cz*uz)/texel)*texel,w=cx*d.x+cz*d.z;
 return{x:sx*u+ux*v+d.x*w,y:uy*v+d.y*w,z:sz*u+uz*v+d.z*w};}
return{CHUNK,STEP,RINGS,TREE_GRID,smooth,hash,key,chunks,mercator,elevation,elevationSample,joinedHeight,homeHeight,sampleGround,trees,treeGround,habitat,rockContains,rocks,cascades,groundMesh,meshHeight,corridorWidth,corridorContains,ribbonMesh,showTarget,easeSquare,latticeCorners,shadowCentre};
});
