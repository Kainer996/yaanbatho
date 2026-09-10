/* Map presentation and gathering geometry. Never changes the saved route. */
(function(root,factory){const api=factory();if(typeof module==='object')module.exports=api;root.BurbzMapTrailCore=api;})(globalThis,function(){'use strict';
  const EARTH=6371000,RAD=Math.PI/180,PICKUP_RADIUS_M=185,HALF_WIDTH_M=6;
  const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=85&&Math.abs(p.lon)<=180;
  function distance(a,b){if(!valid(a)||!valid(b))return Infinity;const x=(b.lat-a.lat)*RAD,y=(b.lon-a.lon)*RAD;return 2*EARTH*Math.asin(Math.min(1,Math.sqrt(Math.sin(x/2)**2+Math.cos(a.lat*RAD)*Math.cos(b.lat*RAD)*Math.sin(y/2)**2)));}
  function destination(p,bearing,meters){const d=meters/EARTH,lat=p.lat*RAD,lon=p.lon*RAD,l=Math.asin(Math.sin(lat)*Math.cos(d)+Math.cos(lat)*Math.sin(d)*Math.cos(bearing));return {lat:l/RAD,lon:((lon+Math.atan2(Math.sin(bearing)*Math.sin(d)*Math.cos(lat),Math.cos(d)-Math.sin(lat)*Math.sin(l)))/RAD+540)%360-180};}
  function gathering(p,fix,now=Date.now()){
    if(!valid(fix)||!Number.isFinite(fix.at)||now-fix.at>120000||fix.at>now+10000)return {ready:false,reason:'Waiting for a fresh location fix.'};
    if(!Number.isFinite(fix.accuracy)||fix.accuracy<0||fix.accuracy>60)return {ready:false,reason:'Waiting for GPS accuracy within 60 m.'};
    const d=distance(p,fix);return {ready:d<=PICKUP_RADIUS_M,distance:d,reason:d<=PICKUP_RADIUS_M?'Ready to gather':'Walk inside your yellow circle to gather this item.'};
  }
  function circle(p){const coordinates=[];for(let i=0;i<=120;i++){const q=destination(p,i/120*Math.PI*2,PICKUP_RADIUS_M);coordinates.push([q.lon,q.lat]);}return {type:'Feature',properties:{kind:'scan-range'},geometry:{type:'Polygon',coordinates:[coordinates]}};}
  function corridor(route){
    const points=[];for(const p of route||[]){const q={lat:p?.[0],lon:p?.[1]};if(!valid(q))return [];if(!points.length||distance(q,points[points.length-1])>.01)points.push(q);}if(points.length<2)return [];
    // Vertex joins use local metre coordinates. Bounded mitres avoid spikes at
    // hairpins; retraced out-and-back legs naturally share the same two edges.
    const edges=[[],[]];
    const vector=(a,b,lat)=>{const dx=((b.lon-a.lon+540)%360-180)*RAD*EARTH*Math.cos(lat*RAD),dy=(b.lat-a.lat)*RAD*EARTH,n=Math.hypot(dx,dy);return [dx/n,dy/n];};
    points.forEach((p,i)=>{const a=i?vector(points[i-1],p,p.lat):vector(p,points[i+1],p.lat),b=i<points.length-1?vector(p,points[i+1],p.lat):a;
      let nx=-a[1]-b[1],ny=a[0]+b[0],length=Math.hypot(nx,ny);if(length<.01){nx=-a[1];ny=a[0];length=1;}nx/=length;ny/=length;
      const projection=Math.abs(nx*-a[1]+ny*a[0]),width=Math.min(HALF_WIDTH_M*2,HALF_WIDTH_M/Math.max(.5,projection));
      [-1,1].forEach((side,k)=>{const q=destination(p,Math.atan2(nx*side,ny*side),width);let lon=q.lon;const prev=edges[k].at(-1);if(prev)lon+=360*Math.round((prev[0]-lon)/360);edges[k].push([lon,q.lat]);});
    });
    return edges.map((coordinates,i)=>({type:'Feature',properties:{edge:i?'right':'left',halfWidthM:HALF_WIDTH_M},geometry:{type:'LineString',coordinates}}));
  }
  function buildings(quest,encounters){
    if(!quest||quest.completedAt||quest.routeCertification?.status!=='certified')return [];
    const rows=(encounters||[]).filter(e=>e.kind==='building').map(e=>{const cp=quest.checkpoints?.[e.checkpointIndex];return {id:'encounter:'+quest.id+':'+e.id,type:e.artKey==='lantern-post'?'lantern-post':'trail-shelter',lat:cp?.lat,lon:cp?.lon,seed:hash(e.id),name:e.name};});
    const tav=quest.trailTavern;if(tav)rows.push({id:'tavern:'+quest.id,type:'tavern',lat:tav.lat,lon:tav.lon,seed:hash(quest.id),name:tav.name});
    return rows.filter(valid).slice(0,24);
  }
  function hash(s){let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
  return Object.freeze({PICKUP_RADIUS_M,HALF_WIDTH_M,distance,destination,gathering,circle,corridor,buildings});
});
