/* A single flapping-wing aircraft in the retained world scene. */
(function(root){'use strict';
function model(T,style){
 const group=new T.Group(),materials=[],geometries=[];
 const mat=color=>{const m=new T.MeshLambertMaterial({color});materials.push(m);style(m);return m;};
 const wood=mat(0xb2783d),dark=mat(0x283b39),brass=mat(0xe5bd59),cloth=mat(0xefdaa3),blue=mat(0x368a93);
 function box(parent,size,position,material){const g=new T.BoxGeometry(...size);geometries.push(g);const mesh=new T.Mesh(g,material);mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
 // Twin rounded pontoons, open cockpit and a brass wing linkage. The folded
 // wings remain readable without adding textures or another rendering pass.
 for(const x of [-.62,.62]){
  const g=new T.CapsuleGeometry(.23,1.65,3,6);geometries.push(g);const hull=new T.Mesh(g,blue);
  hull.rotation.x=Math.PI/2;hull.position.set(x,.08,0);hull.castShadow=true;group.add(hull);
 }
 box(group,[1.3,.16,1.6],[0,.34,0],wood);
 box(group,[.75,.16,.75],[0,.5,.2],dark);box(group,[.75,.62,.12],[0,.75,.58],wood);
 box(group,[.14,.8,.14],[0,.85,.75],brass);
 box(group,[1,.09,.09],[0,1.23,.75],dark);
 box(group,[.12,.12,2.4],[0,.48,.5],wood);
 box(group,[1.1,.09,.48],[0,.53,1.6],cloth);box(group,[.09,.6,.5],[0,.83,1.6],blue);
 const wings=[];
 for(const side of [-1,1]){
  const wing=new T.Group();wing.position.set(side*.4,1.13,0);group.add(wing);wings.push({wing,side});
  const g=new T.BufferGeometry();geometries.push(g);
  g.setAttribute('position',new T.Float32BufferAttribute([0,0,-.6,side*2.6,0,-.3,side*2.3,0,.55,0,0,.75],3));
  g.setIndex(side>0?[0,2,1,0,3,2]:[0,1,2,0,2,3]);g.computeVertexNormals();
  const sail=cloth.clone();sail.side=T.DoubleSide;materials.push(sail);style(sail);wing.add(new T.Mesh(g,sail));
  for(let i=0;i<4;i++){const spar=box(wing,[2.3,.05,.045],[side*1.15,.015,-.47+i*.32],brass);spar.rotation.y=side*(i-1.5)*.08;}
 }
 return {group,animate(time,flying){for(const {wing,side} of wings)wing.rotation.z=side*(flying?Math.sin(time*7)*.44:1.1);},dispose(){group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
function attach(s,opts,env){
 const C=root.BurbzFlightCraftCore,G=root.BurbzGeographicWorldCore,T=root.THREE;
 const visual=model(T,env.style),group=visual.group;s.source.scene.add(group);
 let record=C.normalize(opts.craft?.read()),receipt=record&&{...record},aboard=false,onDeck=false,closed=false,lastTime=0,lastProvision=-Infinity,float={};
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
  if(record&&!opts.craft?.shelterIntro?.())return true;
  const home=opts.getHome?.()?.anchor;if(!G.validCoordinate(home))return false;
  const p=env.local(home);if(!p)return false;
  // Repair only an unoccupied starter craft blocking the tutorial doorway.
  // A travelled, airborne or manually parked distant craft keeps its save.
  if(record){const old=local();if(record.phase!=='parked'||aboard||onDeck||!old||Math.abs(old.x-p.x)>3||old.z-p.z<3||old.z-p.z>26)return true;}
  const launchClear=(x,y,z)=>env.parkingClear(x,y,z)&&[1.5,3,4.5,6].every(up=>env.clear(x,y+up,z));
  const place=C.findHomeBerth(p,env.sample,launchClear);
  if(!place)return false;
  return commit(C.at({...env.geo({x:place.x,y:place.height,z:place.z}),yaw:Math.atan2(-(place.x-p.x),-(place.z-p.z))},'parked',place.kind));
 }
 function initialize(){
  provision();
  if(record){const p=local(),near=p&&C.matchesJourney(record,opts.initialPose);
   if(near&&record.phase==='flying'&&s.player.mode==='fly'){aboard=true;Object.assign(s.player,{x:p.x,y:p.y,z:p.z});}
   else if(near&&['boarded','deck'].includes(record.phase)){aboard=record.phase==='boarded';onDeck=!aboard;Object.assign(s.player,{x:p.x,y:p.y,z:p.z,mode:'walk'});}
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
   const berth=C.berth(s.player.x,s.player.z,env.sample,env.parkingClear);
   if(!berth||s.player.y-berth.height>2.1||s.player.y<berth.height){env.message('Descend close to a clear landing place.');return false;}
   Object.assign(s.player,{y:berth.height,mode:'walk'});next=saved('boarded',berth.kind);
  }
  if(!commit(next)){Object.assign(s.player,before);aboard=oldAboard;onDeck=oldDeck;return false;}
  stop();sync();return true;
 }
 function leave(){
  if(closed||s.uiBusy||s.room||!aboard||s.player.mode==='fly')return false;
  const before={...s.player,velocity:{...s.player.velocity}},p=local();
  const bank=C.findBerth(p,env.sample,env.parkingClear,{minRadius:1.8,maxRadius:3.3});
  let next={...record,phase:'parked'};
  if(bank){Object.assign(s.player,{x:bank.x,y:bank.height,z:bank.z,mode:'walk'});}
  else if(record.surface!=='ground'){next.phase='deck';onDeck=true;Object.assign(s.player,{x:p.x,y:p.y,z:p.z,mode:'walk'});}
  else {env.message('The exit is blocked. Move the craft to a clear landing place.');return false;}
  if(!commit(next)){Object.assign(s.player,before);onDeck=false;return false;}
  aboard=false;stop();sync();return true;
 }
 exit.addEventListener('click',leave,{signal:s.abort.signal});
 const flightWorld={height:(x,z)=>env.sample(x,z)?.height??null,allowed:()=>true,
  allowed3(x,y,z){for(const [dx,dz] of [[0,0],[-.65,0],[.65,0],[0,-.85],[0,.85]])if(!env.clear(x+dx,y,z+dz))return false;return true;},maxAGL:400};
 function move(input,dt){
  if(aboard&&s.player.mode==='fly'){G.step(s.player,input,dt,flightWorld,'fly');return true;}
  if(aboard||onDeck){
   const p=local();if(p)Object.assign(s.player,{x:p.x,y:p.y,z:p.z});
   // Turning remains with the original right-stick/keyboard handler. The deck
   // protects a disembarked player over water without adding swimming/drowning.
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
  if(closed)return;if(!record&&time-lastProvision>1){lastProvision=time;provision();}
  const p=aboard?{x:s.player.x,y:s.player.y,z:s.player.z}:local();
  group.visible=!!p&&!s.room&&Math.hypot(p.x-s.player.x,p.z-s.player.z)<140;
  if(p){
   const sample=env.sample(p.x,p.z),flying=aboard&&s.player.mode==='fly';
   const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
   float=C.floatPose(float,flying?'ground':sample?.kind||record.surface,time,time-lastTime,reduced);
   group.position.set(p.x,p.y+float.y,p.z);group.rotation.set(float.pitch,aboard?s.player.yaw:record.yaw,float.roll,'YXZ');
   visual.animate(reduced?0:time,flying);
  }
  lastTime=time;sync();
 }
 return {initialize,control,leave,move,save,sync,update,aboard:()=>aboard,
  marker:()=>{const p=local();return p&&!aboard?{x:p.x,z:p.z}:null;},
  diagnostics:()=>({record:record&&{...record},aboard,onDeck,visible:group.visible,position:{...group.position},float:{...float}}),
  dispose(){closed=true;exit.remove();visual.dispose();}};
}
root.BurbzFlightCraft={attach};
})(globalThis);
