/* First-person bird flight, independent of rendering and saved game state.
 * Flight in miniature: gravity always pulls, wings lift only with airspeed,
 * and every wingbeat pays for height. Stop flapping and the bird glides down
 * gently. Look down to dive and gather speed; pull up to trade that speed for
 * height until the wings stall. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;root.BurbzAcademyFlightCore=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));
// Every figure scales with the cruise speed, so a sparrow in the Academy and
// the great craft over Alderwing feel alike. Gravity adds one cruise speed in
// TIME seconds: 9.8 m/s² for the craft's 18 m/s.
const TIME=1.84,STALL=.5,LOAD=3,TOP=2.2,PARASITE=1/16,INDUCED=1/16,SKID=1,STEER=3.5,TURN=1.1;
// Still wings settle into a glide: the path sits GLIDE below the view at
// cruise speed (the best glide, about 8:1), and SETTLE lower for each cruise
// speed lost, so a slow bird noses down until the air carries it again.
const GLIDE=Math.atan(2*Math.sqrt(PARASITE*INDUCED)),SETTLE=.5,CALM=2;
function settings(options={}){
 const speed=Number.isFinite(options.speed)?clamp(options.speed,.1,80):5.2,climb=Number.isFinite(options.liftSpeed)?clamp(options.liftSpeed,.1,20):3.2;
 // Small birds beat fast; big wings beat slow.
 return {speed,climb,stall:speed*STALL,gravity:speed/TIME,top:speed*TOP,rate:clamp(9.4/Math.sqrt(speed),1.8,5)};
}
function fresh(){return {phase:0,beating:false,lift:0,ahead:0,pulse:0,airspeed:0,stall:0,rest:CALM,grounded:false,mode:'gliding',cruise:5.2,top:5.2*TOP};}
// Taking off starts with one strong downstroke. Keep flapping to stay up.
function launch(p){p.wing={...fresh(),beating:true,lift:1,rest:0,grounded:true,mode:'flapping'};return p.wing;}
// Where the bird wants to go: the way it looks.
function view(yaw,pitch){const c=Math.cos(pitch);return {x:-Math.sin(yaw)*c,y:Math.sin(pitch),z:-Math.cos(yaw)*c};}
function accelerate(p,w,k,c,h){
 const v=p.velocity,V=Math.hypot(v.x,v.y,v.z),x=V/k.speed,g=k.gravity;
 // A hover is slow across the ground, whatever the climb or sink.
 const across=Math.hypot(v.x,v.z),onward=Math.max(0,-Math.sin(p.yaw)*v.x-Math.cos(p.yaw)*v.z),slow=Math.max(0,1-across/k.speed),moving=Math.min(1,onward/k.stall);
 // Only Flap beats the wings. A wingbeat, once begun, finishes: a quick tap
 // still gives one full stroke. Let go and the wings go still.
 const want=c.flap;
 if(!w.beating&&want>.02){w.beating=true;w.phase=0;w.lift=c.flap;w.ahead=c.ahead;}
 let pulse=0;
 if(w.beating){
  // Downstroke pushes, upstroke recovers; π·sin averages to one full effort.
  pulse=Math.PI*Math.max(0,Math.sin(2*Math.PI*w.phase));w.phase+=h*k.rate;
  if(w.phase>=1){if(want>.02){w.phase-=1;w.lift=c.flap;w.ahead=c.ahead;}else{w.beating=false;w.phase=0;w.lift=w.ahead=0;}}
 }
 const flap=Math.max(w.lift,c.flap),ahead=Math.max(w.ahead,c.ahead);w.pulse=pulse*Math.max(flap,ahead);
 w.rest=w.beating?0:(w.rest??CALM)+h;
 // Flapping at speed noses the path up into a climb; still wings trim to a
 // glide below the view. The change eases in, so letting go tips the bird
 // smoothly over into its glide.
 const aim=flap*.25*moving-(w.beating?0:GLIDE+SETTLE*Math.max(0,1-x));
 w.aim=Number.isFinite(w.aim)?w.aim+(aim-w.aim)*(1-Math.exp(-h*3)):aim;
 const d=view(p.yaw,clamp(p.pitch+w.aim,-1.4,1.4));
 // Downstrokes drive the bird forward, and at low speed turn downward to hold
 // it up: a hover. Hovering climbs slowly; it is hard work.
 const thrust=pulse*g*.9*Math.max(ahead,flap*moving)*Math.max(0,1-x/1.25);
 const hover=pulse*g*(1.75*flap+.7*ahead)*slow*clamp(1-v.y/k.climb,0,1.5);
 // A stall is the wing failing a pull-up, not the drop from a hover just left.
 const failing=!w.grounded&&flap<.3&&w.rest>CALM;
 let ax=d.x*thrust,ay=hover-g,az=d.z*thrust,stall=failing?1:0;
 if(V>1e-4*k.speed){
  const ux=v.x/V,uy=v.y/V,uz=v.z/V,along=d.x*ux+d.y*uy+d.z*uz;
  let tx=d.x-along*ux,ty=d.y-along*uy,tz=d.z-along*uz;const tl=Math.hypot(tx,ty,tz);
  if(along<0&&tl>1e-6){tx/=tl;ty/=tl;tz/=tl;}
  // Lift acts across the airflow. It holds the bird up and bends its path
  // toward the view, but only as hard as the airspeed allows: below stall
  // speed it cannot even carry the bird's weight. A hovering bird holds
  // station instead of chasing its view.
  const gy=-g*uy,steer=V*STEER*(1-flap*slow);let lx=gy*ux+steer*tx,ly=g+gy*uy+steer*ty,lz=gy*uz+steer*tz;
  const spread=1-.75*c.tuck,most=g*Math.min(LOAD,(V/k.stall)**2)*spread,need=Math.hypot(lx,ly,lz);
  if(need>most){const s=most/need;lx*=s;ly*=s;lz*=s;}
  stall=failing&&need>most*1.02&&V<k.stall*1.15?clamp((k.stall*1.15-V)/(k.stall*.6),0,1):0;
  // Drag: streamlined air, the extra cost of lift, a skid when the view and
  // the path disagree, and airbrakes. Tucked wings slip through the air.
  const lifted=Math.min(need,most)/g,skid=along>0?1-along*along:1;
  const drag=g*(x*x*(PARASITE*(1-.45*c.tuck)+SKID*skid*spread+.35*c.brake)+INDUCED*lifted*lifted/Math.max(x*x,.01));
  ax+=lx-ux*drag;ay+=ly-uy*drag;az+=lz-uz*drag;
 }
 // A hovering bird holds its place, but only below stall speed: flapping at
 // flying speed climbs on instead of braking to a hover. A grounded bird
 // does not slide far.
 const hold=flap*(1-ahead)*Math.max(0,1-across/k.stall)*1.5+(w.grounded?2.5*(1-.8*ahead):0);
 ax-=v.x*hold;az-=v.z*hold;
 v.x+=ax*h;v.y+=ay*h;v.z+=az*h;
 const top=Math.hypot(v.x,v.y,v.z);if(top>k.top){const s=k.top/top;v.x*=s;v.y*=s;v.z*=s;}
 w.stall+=(stall-w.stall)*(1-Math.exp(-h*6));w.airspeed=Math.hypot(v.x,v.y,v.z);w.cruise=k.speed;w.top=k.top;
 w.mode=w.grounded&&w.airspeed<k.stall*.3&&!w.beating?'grounded':w.beating?(w.airspeed<k.stall*.6?'hovering':'flapping'):w.stall>.35?'stalling':v.y< -.2*w.airspeed&&w.airspeed>k.speed*1.05?'diving':'gliding';
}
function travel(p,w,world,h){
 const v=p.velocity,n=Math.max(1,Math.ceil(Math.hypot(v.x,v.y,v.z)*h/.08));let grounded=false;
 for(let i=0;i<n;i++)for(const axis of ['x','y','z']){const next={x:p.x,y:p.y,z:p.z};next[axis]+=v[axis]*h/n;if(world.allowed3(next.x,next.y,next.z)&&(!world.clear||world.clear(p,next)))p[axis]=next[axis];else{if(axis==='y'&&v.y<0)grounded=true;v[axis]=0;}}
 w.grounded=grounded;
}
function step(p,input,dt,world,options={}){
 dt=clamp(dt,0,.08);if(p.landed)return;
 p.yaw+=clamp(input.turn,-1,1)*dt*1.4;p.pitch=clamp(p.pitch+clamp(input.pitch,-1,1)*dt, -1.1,1.1);
 const k=settings(options),c={ahead:Math.max(0,clamp(input.forward,-1,1)),brake:Math.max(0,-clamp(input.forward,-1,1)),flap:Math.max(0,clamp(input.lift,-1,1)),tuck:Math.max(0,-clamp(input.lift,-1,1))},side=clamp(input.side,-1,1);
 p.velocity=p.velocity||{x:0,y:0,z:0};
 // A flight resumed mid-air, with no wingbeat history, picks up in a glide.
 if(!p.wing||typeof p.wing!=='object'){p.wing=fresh();if(Math.hypot(p.velocity.x,p.velocity.y,p.velocity.z)<.05*k.speed&&world.allowed3(p.x,p.y-1.5,p.z)){p.velocity.x=-Math.sin(p.yaw)*k.speed*.9;p.velocity.z=-Math.cos(p.yaw)*k.speed*.9;}}
 const w=p.wing,n=Math.max(1,Math.ceil(dt*60-1e-6));
 // Birds cannot sidestep: the stick's sideways push banks into a turn.
 for(let i=0;i<n;i++){p.yaw-=side*TURN*dt/n;accelerate(p,w,k,c,dt/n);travel(p,w,world,dt/n);}
}
function nearest(p,pads,radius=2.1){let best=null;for(const pad of pads){const d=Math.hypot(p.x-pad.x,p.y-pad.y,p.z-pad.z);if(d<radius){radius=d;best=pad;}}return best;}
function land(p,pad,world){if(!pad||Math.hypot(p.x-pad.x,p.y-pad.y,p.z-pad.z)>2.1||!world.allowed3(pad.x,pad.y,pad.z)||world.clear&&!world.clear(p,pad))return false;Object.assign(p,{x:pad.x,y:pad.y,z:pad.z,yaw:pad.yaw,pitch:-.04,landed:pad.roomId,velocity:{x:0,y:0,z:0}});return true;}
function takeoff(p){p.landed=null;p.velocity={x:0,y:0,z:0};launch(p);}
// Camera-only wingbeat, stall buffet, bank and rush of speed: collision and
// landing use the unchanged body.
function cameraMotion(m,p,dt,reduced=false){
 dt=clamp(dt,0,.08);const previous=m.yaw??p.yaw,delta=Math.atan2(Math.sin(p.yaw-previous),Math.cos(p.yaw-previous));m.yaw=p.yaw;
 const w=p.wing||{},v=p.velocity||{x:0,y:0,z:0},cruise=w.cruise||5.2,top=w.top||cruise*TOP,airspeed=Math.hypot(v.x,v.y,v.z),speed=clamp(airspeed/cruise,0,1);
 if(p.landed||reduced){m.strength=0;m.bank=0;m.droop=0;m.fov=0;return{bob:0,pitch:0,roll:0,fov:0,mode:p.landed?'perched':'reduced'};}
 const ease=r=>1-Math.exp(-dt*r),beat=w.beating?2*Math.PI*w.phase:0;
 m.strength=(m.strength||0)+((w.beating?1:0)-(m.strength||0))*ease(12);
 m.time=((m.time||0)+dt)%600;
 const turn=dt>0?clamp(delta/dt,-2,2):0,target=clamp(turn*.16*speed,-.24,.24);
 m.bank=(m.bank||0)+(target-(m.bank||0))*ease(7);
 // A stall shudders and the nose drops.
 const stall=clamp(w.stall,0,1),shake=stall*(Math.sin(m.time*37)*.6+Math.sin(m.time*23+1)*.4);
 m.droop=(m.droop||0)+(-.1*stall-(m.droop||0))*ease(4);
 // Speed past cruise widens the view.
 m.fov=(m.fov||0)+(9*clamp((airspeed-cruise)/Math.max(.001,top-cruise),0,1)-(m.fov||0))*ease(3);
 return {bob:-Math.cos(beat)*.045*m.strength,pitch:Math.sin(beat+.6)*.014*m.strength+m.droop+shake*.012,roll:m.bank+shake*.01,fov:m.fov,mode:w.mode||'gliding'};
}
return {step,nearest,land,takeoff,launch,settings,cameraMotion};
});
