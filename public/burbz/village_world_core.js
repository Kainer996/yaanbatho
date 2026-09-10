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
function elevation(tiles,origin,x,z){const m=origin.scale?origin:mercator(origin),mx=m.x+x/m.scale,my=m.z+z/m.scale;for(const tile of tiles){const n=2**tile.z,tx=((mx*n)%n+n)%n,ty=my*n;if(Math.floor(tx)!==tile.x||Math.floor(ty)!==tile.y)continue;const d=tile.dem,fx=(tx-tile.x)*d.dim,fy=(ty-tile.y)*d.dim,ix=Math.floor(fx),iy=Math.floor(fy),dx=fx-ix,dy=fy-iy;try{const h=d.get(ix,iy)*(1-dx)*(1-dy)+d.get(ix+1,iy)*dx*(1-dy)+d.get(ix,iy+1)*(1-dx)*dy+d.get(ix+1,iy+1)*dx*dy;if(Number.isFinite(h))return h;}catch(_){}}return null;}
function joinedHeight(x,z,{radius,blend=64,authored,raw,datum}){const d=Math.hypot(x,z);if(d<=radius)return authored(x,z);const h=raw(x,z);if(!Number.isFinite(h)||!Number.isFinite(datum))return null;const t=smooth((d-radius)/blend);return authored(x,z)*(1-t)+(h-datum)*t;}
function trees(chunk,shift={x:0,z:0}){const rows=[],size=TREE_GRID;for(let gx=Math.floor((chunk.x+shift.x)/size);gx<=Math.floor((chunk.x+CHUNK+shift.x)/size);gx++)for(let gz=Math.floor((chunk.z+shift.z)/size);gz<=Math.floor((chunk.z+CHUNK+shift.z)/size);gz++){const x=(gx+.15+hash(gx,gz,71)*.7)*size-shift.x,z=(gz+.15+hash(gx,gz,113)*.7)*size-shift.z;if(x<chunk.x||x>=chunk.x+CHUNK||z<chunk.z||z>=chunk.z+CHUNK)continue;rows.push({id:'cw:'+gx+':'+gz,x,z,size:.75+hash(gx,gz,17)*.95,angle:hash(gx,gz,31)*Math.PI*2,kind:hash(gx,gz,47)<.6?'pines':'leafs',tone:hash(gx,gz,61)});}return rows;}
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
return{CHUNK,STEP,RINGS,TREE_GRID,smooth,hash,key,chunks,mercator,elevation,joinedHeight,trees,groundMesh,meshHeight,corridorWidth,corridorContains,ribbonMesh};
});
