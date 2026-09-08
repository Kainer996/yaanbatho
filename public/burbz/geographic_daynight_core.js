/* Presentation maths only: never changes routes, location, rewards or saves. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BurbzGeographicDayNightCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 const RAD=Math.PI/180,EARTH=6371008.8,SPACING=72,MAX_TORCHES=48;
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 const wrap=lon=>((lon+180)%360+360)%360-180;
 function point(p){const lon=Number(Array.isArray(p)?p[0]:p?.lon),lat=Number(Array.isArray(p)?p[1]:p?.lat);return Number.isFinite(lon)&&Number.isFinite(lat)&&Math.abs(lon)<=180&&Math.abs(lat)<=85?[lon,lat]:null;}
 function distance(a,b){const dy=(b[1]-a[1])*RAD,dx=wrap(b[0]-a[0])*RAD*Math.cos((a[1]+b[1])*.5*RAD);return Math.hypot(dx,dy)*EARTH;}
 function hash(s){let h=2166136261;for(const c of String(s)){h^=c.charCodeAt(0);h=Math.imul(h,16777619);}return h>>>0;}
 function pathId(points){return hash(points.map(p=>p.join(',')).join(';')).toString(36);}
 function inside(p,bounds){if(!bounds)return true;const mid=(bounds[0]+bounds[2])/2,lon=p[0]+360*Math.round((mid-p[0])/360);return lon>=bounds[0]&&lon<=bounds[2]&&p[1]>=bounds[1]&&p[1]<=bounds[3];}
 function samplePaths(paths,view={},limit=MAX_TORCHES){
  const centre=point(view.center)||[0,0],found=new Map();let examined=0;
  for(const path of (paths||[]).slice(0,80)){
   const points=(path.points||[]).slice(0,5000).map(point);if(points.length<2||points.some(p=>!p))continue;
   const key=path.id||pathId(points);let walked=0,next=SPACING*.35;
   for(let i=1;i<points.length&&examined<12000;i++){
    const a=points[i-1],b=points[i],length=distance(a,b);if(length<.05)continue;
    if(length>20000){walked+=length;next=Math.ceil(walked/SPACING)*SPACING+SPACING*.35;continue;}
    while(next<=walked+length&&examined++<12000){
     const t=(next-walked)/length,lon=wrap(a[0]+wrap(b[0]-a[0])*t),lat=a[1]+(b[1]-a[1])*t;
     const rank=Math.round((next-SPACING*.35)/SPACING),sign=rank%2?1:-1;
     const dx=wrap(b[0]-a[0])*RAD*Math.cos(lat*RAD),dy=(b[1]-a[1])*RAD,norm=Math.hypot(dx,dy);
     const offset=3.2*sign,position=[wrap(lon-dy/norm*offset/(EARTH*Math.cos(lat*RAD))/RAD),lat+dx/norm*offset/EARTH/RAD];
     if(inside(position,view.bounds)&&(!view.accept||view.accept(position))){
      const id='torch:'+key+':'+rank,near=distance(centre,position),cell=Math.round(position[0]*1e5)+':'+Math.round(position[1]*1e5);
      const record={id,lon:position[0],lat:position[1],pathId:String(key),distanceAlong:next,priority:path.priority||0,distance:near,seed:hash(id)};
      const old=found.get(cell);if(!old||old.priority<record.priority)found.set(cell,record);
     }
     next+=SPACING;
    }
    walked+=length;
   }
  }
  return [...found.values()].sort((a,b)=>b.priority-a.priority||a.distance-b.distance||a.id.localeCompare(b.id)).slice(0,clamp(Math.floor(limit)||0,0,MAX_TORCHES));
 }
 function color(hex,grade,role='ground'){
  if(typeof hex!=='string'||!/^#[0-9a-f]{6}$/i.test(hex))return hex;
  const n=parseInt(hex.slice(1),16),rgb=[n>>16&255,n>>8&255,n&255],sun=clamp(Number(grade.sun)||0,0,1),warm=clamp(Number(grade.warm)||0,0,1);
  const targets=role==='label'?[191,213,222]:role==='halo'?[14,26,41]:role==='water'?[17,44,67]:role==='road'?[74,90,109]:[23,43,61];
  const keep=role==='label'||role==='halo'?0:role==='water'?.22:.32;
  return '#'+rgb.map((c,i)=>Math.round((targets[i]*(1-keep)+c*keep)*(1-sun)+c*sun+warm*([16,5,-9][i]))).map(n=>clamp(n,0,255).toString(16).padStart(2,'0')).join('');
 }
 function expression(value,grade,role){if(Array.isArray(value))return value.map(v=>expression(v,grade,role));return color(value,grade,role);}
 function lights(records,origin,scale,mercator){const result=new Float32Array(32);records.slice(0,8).forEach((r,i)=>{const xy=mercator(r.lon,r.lat);xy[0]+=Math.round(origin[0]-xy[0]);result.set([(xy[0]-origin[0])/scale,-(xy[1]-origin[1])/scale,r.elevation+5.2,23],i*4);});return result;}
 return {SPACING,MAX_TORCHES,point,distance,hash,pathId,samplePaths,color,expression,lights};
});
