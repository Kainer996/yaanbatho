/* Geographic avatar math. Sensor fixes, rewards and save commits remain with the app. */
(function(root,factory){const api=factory(typeof module==='object'&&module.exports?require('./academy_flight_core.js'):root.BurbzAcademyFlightCore);if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzGeographicWorldCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(flight){
'use strict';
const VERSION=1,EARTH_CIRCUMFERENCE=40075016.68557849,EARTH_RADIUS=EARTH_CIRCUMFERENCE/(2*Math.PI),MAX_LAT=85.0511287798066;
const WALK_SPEED=2.7,FLIGHT_SPEED=18,LIFT_SPEED=6,EYE_WALK=1.38,EYE_FLY=.45,MIN_AGL=.35,MAX_AGL=400,MAX_STEP=.6,REBASE_DISTANCE=1000;
const finite=Number.isFinite,clamp=(n,a,b)=>Math.max(a,Math.min(b,n)),inputValue=n=>finite(n)?clamp(n,-1,1):0;
const wrapLongitude=lon=>((lon+180)%360+360)%360-180;
const wrapYaw=yaw=>Math.atan2(Math.sin(yaw),Math.cos(yaw));
const altitude=v=>v?.altitude!==undefined?v.altitude:v?.alt!==undefined?v.alt:0;
const validCoordinate=v=>!!v&&finite(v.lat)&&finite(v.lon)&&Math.abs(v.lat)<=MAX_LAT&&Math.abs(v.lon)<=180;
const validAltitude=n=>finite(n)&&n>=-12000&&n<=100000;
function normalizeAnchor(raw){
 if(!validCoordinate(raw)||!validAltitude(altitude(raw)))return null;
 return{lat:raw.lat,lon:wrapLongitude(raw.lon),altitude:altitude(raw),heading:finite(raw.heading)?wrapYaw(raw.heading):0};
}
function mercator(v){const phi=v.lat*Math.PI/180;return{x:(v.lon+180)/360,z:(1-Math.log(Math.tan(Math.PI/4+phi/2))/Math.PI)/2};}
function metresPerWorld(anchor){return EARTH_CIRCUMFERENCE*Math.cos(anchor.lat*Math.PI/180);}
// A local metre frame uses +x east, +z south, +y up. Heading is not a projection rotation.
function project(anchor,geo){
 const a=normalizeAnchor(anchor);if(!a||!validCoordinate(geo)||!validAltitude(altitude(geo)))return null;
 const o=mercator(a),g=mercator(geo),scale=metresPerWorld(a);let dx=g.x-o.x;dx-=Math.round(dx);
 return{x:dx*scale,y:altitude(geo)-a.altitude,z:(g.z-o.z)*scale};
}
function unproject(anchor,p){
 const a=normalizeAnchor(anchor);if(!a||!p||![p.x,p.y,p.z].every(finite))return null;
 const o=mercator(a),scale=metresPerWorld(a),northing=o.z+p.z/scale;
 // Never wrap over a pole into another hemisphere. Longitude alone is periodic.
 if(northing< -1e-12||northing>1+1e-12)return null;
 const lat=Math.atan(Math.sinh(Math.PI*(1-2*clamp(northing,0,1))))*180/Math.PI,alt=a.altitude+p.y;
 if(!finite(lat)||Math.abs(lat)>MAX_LAT+1e-10||!validAltitude(alt))return null;
 return{lat:clamp(lat,-MAX_LAT,MAX_LAT),lon:wrapLongitude((o.x+p.x/scale)*360-180),altitude:alt};
}
function distance(a,b){
 if(!validCoordinate(a)||!validCoordinate(b))return Infinity;
 const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=wrapLongitude(b.lon-a.lon)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
 return 2*EARTH_RADIUS*Math.asin(Math.sqrt(clamp(h,0,1)));
}
function bearing(a,b){
 if(!validCoordinate(a)||!validCoordinate(b))return null;
 const rad=Math.PI/180,dlon=wrapLongitude(b.lon-a.lon)*rad,p=a.lat*rad,q=b.lat*rad;
 return(Math.atan2(Math.sin(dlon)*Math.cos(q),Math.cos(p)*Math.sin(q)-Math.sin(p)*Math.cos(q)*Math.cos(dlon))/rad+360)%360;
}
function validatePose(raw){return validCoordinate(raw)&&validAltitude(raw.altitude)&&finite(raw.yaw)&&finite(raw.pitch)&&['walk','fly'].includes(raw.mode);}
function normalizePose(raw,anchor){
 const source=validCoordinate(raw)&&validAltitude(altitude(raw))?raw:normalizeAnchor(anchor);if(!source)return null;
 return{lat:source.lat,lon:wrapLongitude(source.lon),altitude:altitude(source),yaw:finite(source.yaw)?wrapYaw(source.yaw):0,pitch:finite(source.pitch)?clamp(source.pitch,-1.1,1.1):0,mode:source.mode==='fly'?'fly':'walk'};
}
function savedPose(anchor,p){const geo=unproject(anchor,p);return geo?normalizePose({...geo,yaw:p.yaw,pitch:p.pitch,mode:p.mode},anchor):null;}
function rebase(p,oldAnchor,newAnchor){const geo=unproject(oldAnchor,p),local=geo&&project(newAnchor,geo);return local?{...p,...local,velocity:p.velocity?{...p.velocity}:undefined}:null;}
function needsRebase(p){return!!p&&finite(p.x)&&finite(p.z)&&Math.hypot(p.x,p.z)>=REBASE_DISTANCE;}
function reset(p){p.velocity={x:0,y:0,z:0};}
function height(world,x,z){const h=world?.height?.(x,z);return finite(h)?h:null;}
function localPose(p){return!!p&&[p.x,p.y,p.z,p.yaw,p.pitch].every(finite);}
function horizontalAllowed(world,x,z){return !world.allowed||world.allowed(x,z)===true;}
function swept(world,a,b){return !world.clear||world.clear(a,b)===true;}
function ceiling(world){return finite(world.maxAGL)?clamp(world.maxAGL,5,2000):MAX_AGL;}
function takeoff(p,world){
 if(!localPose(p))return{ok:false,ready:false,reason:'invalid-pose'};
 const h=height(world,p.x,p.z);if(h===null){reset(p);return{ok:false,ready:false,reason:'terrain-loading'};}
 if(p.mode==='fly')return{ok:true,ready:true,reason:null};
 if(Math.abs(p.y-h)>MAX_STEP)return{ok:false,ready:true,reason:'not-grounded'};
 const next={...p,y:h+.65};
 if(!horizontalAllowed(world,p.x,p.z)||world.allowed3&&!world.allowed3(next.x,next.y,next.z)||!swept(world,p,next))return{ok:false,ready:true,reason:'blocked'};
 Object.assign(p,{mode:'fly',y:next.y,landed:null});reset(p);return{ok:true,ready:true,reason:null};
}
function land(p,world){
 if(!localPose(p))return{ok:false,ready:false,reason:'invalid-pose'};
 const h=height(world,p.x,p.z);if(h===null){reset(p);return{ok:false,ready:false,reason:'terrain-loading'};}
 if(p.y<h-.01||p.y-h>2.1)return{ok:false,ready:true,reason:'too-high'};
 const next={...p,y:h};
 if(!horizontalAllowed(world,p.x,p.z)||world.landable&&world.landable(p.x,p.z)!==true||!swept(world,p,next))return{ok:false,ready:true,reason:'blocked'};
 Object.assign(p,{mode:'walk',y:h,landed:null});reset(p);return{ok:true,ready:true,reason:null};
}
function step(p,input={},dt=0,world={},mode=p?.mode||'walk'){
 if(!localPose(p))return{ready:false,moved:false,blocked:true,reason:'invalid-pose'};
 const start={x:p.x,y:p.y,z:p.z},h=height(world,p.x,p.z);dt=finite(dt)?clamp(dt,0,.08):0;
 if(h===null){reset(p);return{ready:false,moved:false,blocked:true,reason:'terrain-loading'};}
 if(mode==='fly'?p.y<h+MIN_AGL-.01:Math.abs(p.y-h)>MAX_STEP){reset(p);return{ready:false,moved:false,blocked:true,reason:'terrain-changed'};}
 p.mode=mode==='fly'?'fly':'walk';let blocked=false,unknown=false;
 const deny=()=>{blocked=true;return false;};
 if(p.mode==='fly'){
  if(!flight?.step)return{ready:false,moved:false,blocked:true,reason:'flight-unavailable'};
  // The existing Academy integrator retains its swept .08m substeps and head/height separation.
  const provider={allowed3(x,y,z){const ground=height(world,x,z);if(ground===null){unknown=true;return deny();}if(y<ground+MIN_AGL)return deny();if(y>ground+ceiling(world)&&!(x===p.x&&z===p.z&&y<p.y))return deny();return (!world.allowed3||world.allowed3(x,y,z)===true)||deny();},clear(a,b){return swept(world,a,b)||deny();}};
  p.landed=null;if(!p.velocity||![p.velocity.x,p.velocity.y,p.velocity.z].every(finite))reset(p);
  const control=Object.fromEntries(['forward','side','lift','turn','pitch'].map(key=>[key,inputValue(input[key])]));
  flight.step(p,control,dt,provider,{speed:FLIGHT_SPEED,liftSpeed:LIFT_SPEED,...world.flightOptions});
 }else{
  p.y=h;p.yaw=wrapYaw(p.yaw+inputValue(input.turn)*dt*1.4);p.pitch=clamp(p.pitch+inputValue(input.pitch)*dt,-1.1,1.1);
  const f=inputValue(input.forward),s=inputValue(input.side),scale=WALK_SPEED/Math.max(1,Math.hypot(f,s));
  const vx=(-Math.sin(p.yaw)*f+Math.cos(p.yaw)*s)*scale,vz=(-Math.cos(p.yaw)*f-Math.sin(p.yaw)*s)*scale,n=Math.max(1,Math.ceil(Math.hypot(vx,vz)*dt/.12));
  for(let i=0;i<n;i++)for(const axis of ['x','z']){const delta=(axis==='x'?vx:vz)*dt/n;if(!delta)continue;const next={x:p.x,y:p.y,z:p.z};next[axis]+=delta;const ground=height(world,next.x,next.z);if(ground===null){unknown=true;deny();continue;}next.y=ground;if(Math.abs(next.y-p.y)>MAX_STEP||!horizontalAllowed(world,next.x,next.z)||!swept(world,p,next)){deny();continue;}Object.assign(p,next);}
  p.velocity={x:dt?(p.x-start.x)/dt:0,y:dt?(p.y-start.y)/dt:0,z:dt?(p.z-start.z)/dt:0};
 }
 p.yaw=wrapYaw(p.yaw);if(unknown)reset(p);
 return{ready:!unknown,moved:Math.hypot(p.x-start.x,p.y-start.y,p.z-start.z)>1e-9,blocked,reason:unknown?'terrain-loading':blocked?'blocked':null};
}
return{VERSION,EARTH_CIRCUMFERENCE,MAX_LAT,WALK_SPEED,FLIGHT_SPEED,LIFT_SPEED,EYE_WALK,EYE_FLY,MIN_AGL,MAX_AGL,MAX_STEP,REBASE_DISTANCE,validCoordinate,normalizeAnchor,project,unproject,distance,bearing,validatePose,normalizePose,savedPose,rebase,needsRebase,step,takeoff,land,reset};
});
