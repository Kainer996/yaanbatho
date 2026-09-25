/* A single flapping-wing aircraft in the retained world scene. */
(function(root){'use strict';
// Every part is baked into a few vertex-coloured meshes: one hull, one cockpit,
// two wing arms and two wing hands. One shared material keeps the craft to a
// handful of draws on phones; no textures or extra passes are needed.
function parts(T){
 const pos=[],nor=[],col=[],idx=[],v=new T.Vector3(),n=new T.Vector3(),normal=new T.Matrix3(),c=new T.Color();
 function add(geo,matrix,paint,mirror=false){
  if(!geo.attributes.normal)geo.computeVertexNormals();
  const p=geo.attributes.position,nn=geo.attributes.normal,base=pos.length/3,m=matrix.clone();
  if(mirror)m.premultiply(new T.Matrix4().makeScale(-1,1,1));
  normal.getNormalMatrix(m);
  for(let i=0;i<p.count;i++){
   const x=p.getX(i),y=p.getY(i),z=p.getZ(i);v.set(x,y,z).applyMatrix4(m);n.fromBufferAttribute(nn,i).applyMatrix3(normal).normalize();
   pos.push(v.x,v.y,v.z);nor.push(n.x,n.y,n.z);
   if(typeof paint==='function')c.set(paint(x,y,z));else c.set(paint);col.push(c.r,c.g,c.b);
  }
  const count=geo.index?geo.index.count:p.count,at=i=>base+(geo.index?geo.index.getX(i):i);
  // A mirror flips the winding; restore it so both sides light alike.
  for(let i=0;i<count;i+=3)if(mirror)idx.push(at(i),at(i+2),at(i+1));else idx.push(at(i),at(i+1),at(i+2));
  geo.dispose();
 }
 function build(){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setIndex(idx);g.computeBoundingSphere();return g;}
 return{add,build};
}
const M=(T,x=0,y=0,z=0,rx=0,ry=0,rz=0,sx=1,sy=1,sz=1)=>new T.Matrix4().compose(new T.Vector3(x,y,z),new T.Quaternion().setFromEuler(new T.Euler(rx,ry,rz)),new T.Vector3(sx,sy,sz));
// A lofted clinker hull: pointed stem, sheer rising to the bow, rounded
// transom. Stations run from bow (-z) to stern (+z); the ring runs from the
// left gunwale, under the keel, to the right gunwale.
const BOW=-1.95,STERN=1.45,STATIONS=28,RING=18;
function beam(t){return .64*Math.pow(Math.sin(Math.min(1,t/.56)*Math.PI/2),.8)*(t>.56?1-.4*Math.pow((t-.56)/.44,2):1);}
function sheer(t){return .9+.24*Math.pow(1-t,2.6)+.05*Math.pow(t,3);}
function keel(t){return .24+.34*Math.pow(1-t,3.2)+.16*Math.pow(t,3);}
function hullGeometry(T){
 const p=[],idx=[];
 for(let i=0;i<=STATIONS;i++){const t=i/STATIONS,z=BOW+(STERN-BOW)*t,w=beam(t),top=sheer(t),bottom=keel(t);
  for(let j=0;j<=RING;j++){const a=-Math.PI/2+Math.PI*j/RING,s=Math.sin(a),cs=Math.abs(Math.cos(a));p.push(w*s*(1+.06*(1-cs)),bottom+(top-bottom)*(1-Math.pow(cs,1.25)),z);}
 }
 for(let i=0;i<STATIONS;i++)for(let j=0;j<RING;j++){const a=i*(RING+1)+j,b=a+RING+1;idx.push(a,b,a+1,a+1,b,b+1);}
 // Close the transom with a fan from its centre.
 const last=STATIONS*(RING+1),centre=p.length/3;p.push(0,(sheer(1)+keel(1))/2,STERN);
 for(let j=0;j<RING;j++)idx.push(centre,last+j+1,last+j);
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
// Planks alternate tone; a brass rub-rail runs under the gunwale and a dark
// keel strip under the hull, so the shape reads from any distance.
function hullPaint(x,y,z){
 const t=(z-BOW)/(STERN-BOW),w=Math.max(.001,beam(Math.max(0,Math.min(1,t)))),top=sheer(Math.max(0,Math.min(1,t)));
 if(top-y<.06)return 0xd9ad4f;
 if(top-y<.13)return 0x2c7c82;
 if(Math.abs(x)<w*.12&&y<keel(Math.max(0,Math.min(1,t)))+.08)return 0x3b2616;
 const band=Math.floor((top-y)/.1);
 return band%2?0x9a5a2c:0xb06a33;
}
function feather(T,length,width,curl=.05){
 // A lanceolate vane with a raised shaft, slightly cupped like a real feather.
 const p=[],idx=[],steps=7;
 for(let i=0;i<=steps;i++){const u=i/steps,w=width*Math.sin(Math.min(1,u*1.15)*Math.PI)*(u<.85?1:1-(u-.85)/.15*.55)*.5+.004,x=u*length,dip=-curl*Math.sin(u*Math.PI);
  p.push(x,dip,-w,x,.012,0,x,dip,w);}
 for(let i=0;i<steps;i++){const a=i*3;idx.push(a,a+3,a+1,a+1,a+3,a+4,a+1,a+4,a+2,a+2,a+4,a+5);}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g;
}
const tip=(base,mid,end)=>x=>x<.45?base:x<.8?mid:end;
function model(T,style){
 const group=new T.Group(),geometries=[],material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});style(material);
 const mesh=(builder,shadow=true)=>{const g=builder.build();geometries.push(g);const m=new T.Mesh(g,material);m.castShadow=shadow;m.receiveShadow=true;return m;};
 // --- Hull, decks, floats, tail fan and figurehead: one draw.
 const hull=parts(T);
 hull.add(hullGeometry(T),M(T),hullPaint);
 const deck=(t0,t1,tone)=>{const p=[],idx=[],n=8;for(let i=0;i<=n;i++){const t=t0+(t1-t0)*i/n,z=BOW+(STERN-BOW)*t,w=beam(t)*.98,y=sheer(t)-.012;for(const s of [-1,-.5,0,.5,1])p.push(s*w,y+(1-s*s)*.035,z);}
  for(let i=0;i<n;i++)for(let j=0;j<4;j++){const a=i*5+j,b=a+5;idx.push(a,a+1,b,a+1,b+1,b);}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();hull.add(g,M(T),(x)=>Math.floor((x+1)*5)%2?tone:0xc98e4e);};
 deck(.015,.4,0xb97a3d);deck(.74,.995,0xb97a3d);
 // Cockpit well: floor, padded seat and backrest.
 hull.add(new T.BoxGeometry(.8,.04,1.05),M(T,0,.4,.1),0x5a3a22);
 hull.add(new T.BoxGeometry(.56,.14,.42),M(T,0,.55,.28),0x7d2f25);
 hull.add(new T.BoxGeometry(.56,.5,.1),M(T,0,.82,.5,-.18),0x7d2f25);
 hull.add(new T.BoxGeometry(.62,.06,.12),M(T,0,1.07,.53,-.18),0xd9ad4f);
 // Coaming: a brass rim around the open cockpit.
 const rim=[];for(let i=0;i<=24;i++){const a=i/24*Math.PI*2,z=.1+Math.sin(a)*.62,t=(z-BOW)/(STERN-BOW);rim.push(new T.Vector3(Math.cos(a)*beam(t)*.93,sheer(t)+.02,z));}
 hull.add(new T.TubeGeometry(new T.CatmullRomCurve3(rim,true),48,.03,5,true),M(T),0xe0b458);
 // Twin floats on brass struts let the craft rest on lakes and the sea.
 const floatProfile=[];for(let i=0;i<=12;i++){const u=i/12;floatProfile.push(new T.Vector2(Math.max(.002,.14*Math.pow(Math.sin(Math.PI*Math.pow(u,.7)),.8)),(u-.5)*2.45));}
 for(const s of [-1,1]){
  hull.add(new T.LatheGeometry(floatProfile,10),M(T,s*.7,.13,-.05,-Math.PI/2),(x,y,z)=>z<-.03?0x1d4f55:0x2c7c82);
  for(const z of [-.7,.6]){const from=new T.Vector3(s*.7,.26,z),to=new T.Vector3(s*.5,.62,z),mid=from.clone().add(to).multiplyScalar(.5),len=from.distanceTo(to);
   hull.add(new T.CylinderGeometry(.025,.025,len,5),new T.Matrix4().compose(mid,new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),to.clone().sub(from).normalize()),new T.Vector3(1,1,1)),0xd9ad4f);}
 }
 // Bird-tail fan at the stern.
 for(let i=0;i<7;i++){const a=(i-3)*.19;hull.add(feather(T,.82-Math.abs(i-3)*.05,.2,.03),M(T,0,sheer(1)-.02,STERN-.08,0,-Math.PI/2+a,.1),tip(0xf1e6c8,0x3a9aa0,0x1f5e66));}
 hull.add(new T.SphereGeometry(.09,8,6),M(T,0,sheer(1)-.02,STERN-.06),0xd9ad4f);
 // Brass bird figurehead on the stem.
 const stemY=sheer(0)+.03;
 hull.add(new T.SphereGeometry(.11,10,8),M(T,0,stemY+.07,BOW+.04),0xe0b458);
 hull.add(new T.ConeGeometry(.045,.2,8),M(T,0,stemY+.05,BOW-.12,-Math.PI/2),0x8a5a1c);
 for(const s of [-1,1])hull.add(new T.SphereGeometry(.022,6,5),M(T,s*.08,stemY+.1,BOW),0x173d42);
 hull.add(feather(T,.28,.12,.01),M(T,0,stemY+.15,BOW+.1,0,Math.PI/2,.9),0xe0b458);
 const body=mesh(hull);group.add(body);
 // --- Cockpit: a low dashboard with three gauges. The pilot keeps only this
 // in first person, set below the sightline so the ground stays in view.
 // Cylinder angles run from +z; ring angles from +x. Both arcs face forward.
 const cockpit=parts(T),dashZ=-.78,dashY=.86,arc=Math.PI*.36;
 cockpit.add(new T.CylinderGeometry(.78,.78,.12,18,1,true,Math.PI-arc/2,arc),M(T,0,dashY-.06,dashZ+.78),0x5e3a1e);
 cockpit.add(new T.RingGeometry(.7,.79,18,1,Math.PI/2-arc/2,arc),M(T,0,dashY,dashZ+.78,-Math.PI/2),0x7a4a26);
 cockpit.add(new T.RingGeometry(.775,.8,18,1,Math.PI/2-arc/2,arc),M(T,0,dashY+.004,dashZ+.78,-Math.PI/2),0xd9ad4f);
 for(const x of [-.15,0,.15]){
  cockpit.add(new T.CircleGeometry(.042,16),M(T,x,dashY+.047,dashZ+.06,-.75),0xf3ead2);
  cockpit.add(new T.TorusGeometry(.045,.008,5,16),M(T,x,dashY+.048,dashZ+.059,-.75),0xd9ad4f);
  cockpit.add(new T.CylinderGeometry(.01,.015,.045,5),M(T,x,dashY+.018,dashZ+.045),0xd9ad4f);
 }
 const dash=new T.Group(),panel=mesh(cockpit,false);dash.add(panel);group.add(dash);
 // Live compass and altimeter needles on the dashboard faces.
 const needleGeo=new T.BoxGeometry(.006,.062,.004);needleGeo.translate(0,.02,0);geometries.push(needleGeo);
 const needleMat=new T.MeshBasicMaterial({color:0x7a1f18});needleMat.userData.craftNeedle=true;
 const needles=[-.15,.15,0].map(x=>{const holder=new T.Group();holder.position.set(x,dashY+.05,dashZ+.063);holder.rotation.x=-.75;const n=new T.Mesh(needleGeo,needleMat);holder.add(n);dash.add(holder);return n;});
 // --- Wings: jointed shoulder and wrist, feathered like a great bird.
 function wing(side){
  const mirror=side<0,shoulder=new T.Group();shoulder.position.set(side*.58,1.02,.12);group.add(shoulder);
  const arm=parts(T),hand=parts(T),span=1.5;
  arm.add(new T.SphereGeometry(.085,8,6),M(T),0xd9ad4f,mirror);
  arm.add(new T.CylinderGeometry(.03,.046,span+.05,7),M(T,span/2,0,-.06,0,0,Math.PI/2),0x8a5226,mirror);
  // Painted like a real wing: teal marginal coverts, a gold bar, then
  // parchment and sand rows. Each band has its own vertices for crisp edges.
  const bands=[[0,.14,0x2f7f86],[.14,.2,0xd9ad4f],[.2,.46,0xe9d9b4],[.46,.6,0xcdb487],[.6,1,0xe4d2aa]],steps=6;
  for(const [a,b,tone] of bands){const mp=[],mi=[];
   for(let i=0;i<=steps;i++){const x=.05+i/steps*(span-.05),chord=.95-.28*i/steps;for(const f of [a,b])mp.push(x,-.03*Math.sin(f*Math.PI),-.04+f*(chord+.04));}
   for(let i=0;i<steps;i++){const q=i*2;mi.push(q,q+2,q+1,q+1,q+2,q+3);}
   const band=new T.BufferGeometry();band.setAttribute('position',new T.Float32BufferAttribute(mp,3));band.setIndex(mi);band.computeVertexNormals();arm.add(band,M(T),tone,mirror);}
  for(const x of [.5,1,1.45])arm.add(new T.BoxGeometry(.035,.03,.8),M(T,x,-.012,.34),0x8a5226,mirror);
  // Covert feathers overlap the arm's trailing edge.
  for(let i=0;i<7;i++){const x=.12+i*.2;arm.add(feather(T,.42,.2,.02),M(T,x,-.02,.72+.02*(i%2),0,-Math.PI/2+.25,0),tip(0xf1e6c8,0xd8c69a,0x3a9aa0),mirror);}
  const armMesh=mesh(arm);shoulder.add(armMesh);
  const wrist=new T.Group();wrist.position.set(side*span,0,0);shoulder.add(wrist);
  hand.add(new T.SphereGeometry(.065,8,6),M(T),0xd9ad4f,mirror);
  hand.add(new T.CylinderGeometry(.022,.03,.45,6),M(T,.22,0,-.05,0,0,Math.PI/2),0x8a5226,mirror);
  // Seven primaries fan from the wrist, the leading one longest.
  for(let i=0;i<7;i++){const a=.1+i*.16,len=1.55-i*.1;hand.add(feather(T,len,.24,.04),M(T,.02+i*.012,-.01*i,.02+i*.07,0,-a,0),tip(0xf1e6c8,0x3a9aa0,0x1f5e66),mirror);}
  const handMesh=mesh(hand);wrist.add(handMesh);
  return{side,shoulder,wrist,meshes:[armMesh,handMesh]};
 }
 const wings=[wing(-1),wing(1)];
 let flap=0,lastTime=0;
 return {group,
  // Parked wings fold back along the hull like a resting bird; in flight they
  // beat with a lagging wrist so the primaries whip through each stroke.
  animate(time,flying,{yaw=0,altitude=0,reduced=false,pitch=0}={}){
   // As the pilot looks down, the dashboard slides down and back out of
   // sight, leaving a clear view of the ground below.
   const dip=Math.max(0,Math.min(1,(-pitch-.3)/.3));dash.position.set(0,-.4*dip,.4*dip);dash.visible=dip<.98;
   const dt=Math.max(0,Math.min(.1,time-lastTime));lastTime=time;flap=reduced?(flying?1:0):flap+((flying?1:0)-flap)*(1-Math.exp(-dt*3));
   const phase=time*5.4,beat=reduced?0:Math.sin(phase+.35*Math.sin(phase)),lag=reduced?0:Math.sin(phase-.9);
   for(const w of wings){
    const s=w.side,f=flap;
    w.shoulder.rotation.set(2.35*(1-f),-s*(1.4*(1-f)+.06*f),s*(f*(.1+.52*beat)+(1-f)*.05),'YXZ');
    w.wrist.rotation.set(0,-s*(.12*(1-f)+.08*f),s*f*.38*lag,'YXZ');
   }
   // Compass to north, altimeter one turn per 40 m, and the local clock's hour.
   const now=new Date();needles[0].rotation.z=-yaw;needles[1].rotation.z=-altitude/40*Math.PI*2;needles[2].rotation.z=-(now.getHours()%12+now.getMinutes()/60)/12*Math.PI*2;
  },
  // First person keeps only the dashboard: wings and hull never block the view.
  view(aboard){body.visible=!aboard;for(const w of wings)for(const m of w.meshes)m.visible=!aboard;},
  state:()=>({hull:body.visible,wings:wings.some(w=>w.meshes.some(m=>m.visible)),dashboard:dash.visible,span:+(wings[1].wrist.getWorldPosition(new T.Vector3()).distanceTo(wings[0].wrist.getWorldPosition(new T.Vector3()))).toFixed(2)}),
  dispose(){group.removeFromParent();geometries.forEach(g=>g.dispose());material.dispose();needleMat.dispose();}};
}
function attach(s,opts,env){
 const C=root.BurbzFlightCraftCore,G=root.BurbzGeographicWorldCore,T=root.THREE;
 const visual=model(T,env.style),group=visual.group;s.source.scene.add(group);
 let record=C.normalize(opts.craft?.read()),receipt=record&&{...record},aboard=false,onDeck=false,closed=false,lastTime=0,lastProvision=-Infinity,float={};
 let homeBerthPending=!!opts.homeDoor;
 const exit=document.createElement('button');exit.type='button';exit.className='cw-craft-exit';exit.textContent='Exit craft';
 exit.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:90px;z-index:6;min-height:44px;background:#203b2b;color:#fff3d1;border:1px solid #c9b27b;border-radius:8px;padding:10px';exit.hidden=true;s.root.append(exit);
 const local=()=>record&&env.local(record);
 const saved=(phase=record?.phase,surface=record?.surface)=>C.at(env.pose(),phase,surface);
 function commit(next,playerPose=env.pose()){
  if(closed||!next||opts.craft?.commit(next,playerPose,receipt)!==true){env.message('Your craft could not be saved. Please try again.');return false;}
  record=next;receipt={...next};return true;
 }
 function stop(){s.auto?.reset();G.reset(s.player);env.resetLift();}
 function provision(){
  if(closed)return false;
  const recoverAtDoor=homeBerthPending&&record;
  if(record&&!recoverAtDoor&&!opts.craft?.shelterIntro?.())return true;
  const home=opts.getHome?.()?.anchor;if(!G.validCoordinate(home))return false;
  const p=env.local(home);if(!p)return false;
  // Repair only an unoccupied starter craft blocking the tutorial doorway.
  // Every explicit home-door return docks here. Ordinary world resumes
  // retain the craft's chosen parking coordinates, including distant ones.
  if(record&&!recoverAtDoor){const old=local();if(record.phase!=='parked'||aboard||onDeck||!old||Math.abs(old.x-p.x)>3||old.z-p.z<3||old.z-p.z>26)return true;}
  const launchClear=(x,y,z)=>env.parkingClear(x,y,z)&&[1.5,3,4.5,6].every(up=>env.clear(x,y+up,z));
  const place=C.findHomeBerth(p,env.sample,launchClear);
  if(!place)return false;
  const parked=commit(C.at({...env.geo({x:place.x,y:place.height,z:place.z}),yaw:Math.atan2(-(place.x-p.x),-(place.z-p.z))},'parked',place.kind));
  if(parked)homeBerthPending=false;
  return parked;
 }
 function initialize(){
  provision();
  if(record){const p=local(),near=!opts.homeDoor&&p&&C.matchesJourney(record,opts.initialPose);
   if(near&&record.phase==='flying'&&s.player.mode==='fly'){aboard=true;Object.assign(s.player,{x:p.x,y:p.y,z:p.z});}
   else if(near&&['boarded','deck'].includes(record.phase)){aboard=true;onDeck=false;Object.assign(s.player,{x:p.x,y:p.y,z:p.z,mode:'walk'});}
   else if(record.phase==='boarded'&&record.surface==='ground')record={...record,phase:'parked'};
  }
  // Old personal-flight poses never grant new flight. Recover onto verified
  // nearby dry ground while retaining the existing saved journey on failure.
  if(s.player.mode==='fly'&&!aboard){
   const ground=C.findBerth(s.player,env.sample,env.parkingClear,{minRadius:0,maxRadius:24});
   if(!ground)throw Error('Return to your home to board your craft. Nearby landing ground has not loaded.');
   Object.assign(s.player,{x:ground.x,y:ground.height,z:ground.z,mode:'walk'});stop();
  }
  update(0);
 }
 function control(){
  if(closed||s.uiBusy||s.room)return false;
  if(!record&&!provision()){env.message('Your craft will be waiting on clear ground near home.');return false;}
  const before={...s.player,velocity:{...s.player.velocity}},oldAboard=aboard,oldDeck=onDeck;
  let next;
  if(!aboard){
   if(!C.boardable(record,env.pose())){env.message('Approach your parked craft to board it.');return false;}
   const p=local(),berth=C.berth(p.x,p.z,env.sample,env.parkingClear);
   if(!berth){env.message('The craft landing area is still loading or blocked.');return false;}
   Object.assign(s.player,{x:p.x,y:berth.height,z:p.z,yaw:record.yaw,mode:'walk'});aboard=true;onDeck=false;next=saved('boarded',berth.kind);
  }else if(s.player.mode!=='fly'){
   const surface=env.sample(s.player.x,s.player.z),result=G.takeoff(s.player,flightWorld);
   if(!result.ok){env.message('The wings need clear space above the craft.');return false;}
   next=saved('flying',surface?.kind||record.surface);
  }else{
   const berth=C.landingBerth(s.player,env.sample,env.parkingClear,env.clear);
   if(!berth){env.message("Can't land here");return false;}
   Object.assign(s.player,{y:berth.height,mode:'walk'});next=saved('boarded',berth.kind);
  }
  if(!commit(next)){Object.assign(s.player,before);aboard=oldAboard;onDeck=oldDeck;return false;}
  homeBerthPending=false;
  stop();env.message('');sync();return true;
 }
 function leave(){
  if(closed||s.uiBusy||s.room||!aboard||s.player.mode==='fly')return false;
  const before={...s.player,velocity:{...s.player.velocity}},p=local();
  // Step off beside the hull. Water is swimmable, including open sea;
  // a nearby bank does not teleport the player out of the water.
  let exitPose=null;
  for(let i=0;i<16&&!exitPose;i++){
   const angle=s.player.yaw+Math.PI/2+i*Math.PI/8;
   exitPose=C.swimmerPosition(p.x+Math.sin(angle)*1.5,p.z+Math.cos(angle)*1.5,p.y,env.sample,env.clear,env.walkable||(()=>true));
  }
  if(!exitPose){env.message('The exit is blocked. Move the craft to a clear landing place.');return false;}
  const next={...record,phase:'parked'};Object.assign(s.player,exitPose);onDeck=false;
  if(!commit(next)){Object.assign(s.player,before);onDeck=false;return false;}
  aboard=false;stop();sync();return true;
 }
 exit.addEventListener('click',leave,{signal:s.abort.signal});
 const flightWorld={height:(x,z)=>env.sample(x,z)?.height??null,allowed:()=>true,
  allowed3(x,y,z){for(const [dx,dz] of [[0,0],[-.65,0],[.65,0],[0,-.85],[0,.85]])if(!env.clear(x+dx,y,z+dz))return false;return true;},maxAGL:400};
 function move(input,dt){
  // The shared flight step keeps its own ±1.1 head range; the pilot's wider
  // look range is owned by the walking view, so retain it across the step.
  if(aboard&&s.player.mode==='fly'){const pitch=s.player.pitch;G.step(s.player,input,dt,flightWorld,'fly');if(s.player.mode==='fly')s.player.pitch=pitch;return true;}
  if(!aboard&&!onDeck&&C.swimStep(s.player,input,dt,env.sample,env.clear,env.walkable||(()=>true)))return true;
  if(aboard||onDeck){
   const p=local();if(p)Object.assign(s.player,{x:p.x,y:p.y,z:p.z});
   // Legacy deck saves remain boardable; new exits always disembark.
   return true;
  }
  return false;
 }
 function save(){
  if(!record)return opts.savePose?.(env.pose())!==false;
  return commit(aboard?saved(s.player.mode==='fly'?'flying':'boarded',record.surface):record);
 }
 function sync(){
  const p=local(),distance=p?Math.hypot(p.x-s.player.x,p.z-s.player.z):Infinity;
  exit.hidden=closed||s.uiBusy||!!s.room||!aboard||s.player.mode==='fly';
  const nearby=C.boardable(record,env.pose());
  return {label:aboard?(s.player.mode==='fly'?'Land craft':'Take off'):'Enter craft',
   visible:aboard||nearby,enabled:aboard||nearby,aboard,onDeck};
 }
 function update(time){
  if(closed)return;if((!record||homeBerthPending)&&time-lastProvision>1){lastProvision=time;provision();}
  const p=aboard?{x:s.player.x,y:s.player.y,z:s.player.z}:local();
  group.visible=!!p&&!s.room&&Math.hypot(p.x-s.player.x,p.z-s.player.z)<140;
  if(p){
   const sample=env.sample(p.x,p.z),flying=aboard&&s.player.mode==='fly';
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   float=C.floatPose(float,flying?'ground':sample?.kind||record.surface,time,time-lastTime,reduced);
   group.position.set(p.x,p.y+float.y,p.z);group.rotation.set(float.pitch,aboard?s.player.yaw:record.yaw,float.roll,'YXZ');
   visual.view(aboard||onDeck);
   visual.animate(time,flying,{reduced,yaw:aboard?s.player.yaw:record.yaw,altitude:flying&&sample?Math.max(0,p.y-sample.height):0,pitch:aboard?s.player.pitch:0});
  }
  lastTime=time;sync();
 }
 return {initialize,control,leave,move,save,sync,update,aboard:()=>aboard,
  marker:()=>{const p=local();return p&&!aboard?{x:p.x,z:p.z}:null;},
  diagnostics:()=>({record:record&&{...record},aboard,onDeck,visible:group.visible,position:{...group.position},float:{...float},view:visual.state()}),
  dispose(){closed=true;exit.remove();visual.dispose();}};
}
root.BurbzFlightCraft={attach,model};
})(globalThis);
