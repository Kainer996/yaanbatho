/* Articulated shadow crows. Shared geometry/materials; no renderer or frame owner. */
(function(root){'use strict';
 function create(T){
  const geos=[],mats=[],birds=new Set(),palette={ink:0x222c38,slate:0x465565,blue:0x526477,edge:0x7e8c85,bone:0xd7c9a2,moss:0x697356,beak:0x545b5c};
  const plumage=new T.MeshLambertMaterial({vertexColors:true}),glow=new T.MeshBasicMaterial({color:0xff7963}),dark=new T.MeshBasicMaterial({color:0x261e36}),health=new T.MeshBasicMaterial({color:0xeac45d});mats.push(plumage,glow,dark,health);
  const sphere=new T.SphereGeometry(1,10,7),feather=new T.ConeGeometry(1,2,5),box=new T.BoxGeometry(1,1,1);
  // Batch static feather/bone detail into one draw per animated body part.
  function shape(parts){const pos=[],norm=[],colors=[];for(const [base,color,p,scale,rot=[]]of parts){const g=base.index?base.toNonIndexed():base.clone(),matrix=new T.Matrix4().compose(new T.Vector3(...p),new T.Quaternion().setFromEuler(new T.Euler(rot[0]||0,rot[1]||0,rot[2]||0)),new T.Vector3(...scale));g.applyMatrix4(matrix);pos.push(...g.attributes.position.array);norm.push(...g.attributes.normal.array);const c=new T.Color(color);for(let i=0;i<g.attributes.position.count;i++)colors.push(c.r,c.g,c.b);g.dispose();}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('normal',new T.Float32BufferAttribute(norm,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeBoundingSphere();geos.push(g);return g;}
  const part=(base,color,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>[base,color,[x,y,z],[sx,sy,sz],[rx,ry,rz]];
  const body=shape([part(sphere,palette.ink,0,0,.08,.37,.47,.53,-.32),part(sphere,palette.slate,0,.03,-.22,.28,.4,.28,-.36),part(sphere,palette.edge,-.13,.24,-.4,.12,.12,.035),part(sphere,palette.moss,.22,-.05,-.37,.065,.15,.02),part(box,0x9b87ae,.2,-.03,-.395,.017,.18,.015,0,0,-.25),part(box,palette.ink,.14,-.1,-.41,.018,.16,.02,0,0,.8),...[0,1,2,3].map(i=>part(feather,i%2?palette.slate:palette.blue,(i-1.5)*.13,-.26,-.32,.07,.2,.025,Math.PI,0,(i-1.5)*.13)),part(box,palette.bone,-.34,.21,-.1,.055,.28,.07,0,0,-.4)]);
  const head=shape([part(sphere,palette.slate,0,.04,0,.255,.23,.31),part(sphere,palette.ink,0,.15,.025,.25,.14,.29),part(sphere,palette.bone,-.16,.035,-.19,.095,.11,.06),part(sphere,palette.ink,-.175,.075,-.248,.062,.055,.025),part(sphere,palette.ink,.175,.075,-.248,.062,.055,.025),part(feather,palette.beak,0,-.025,-.4,.11,.3,.09,-Math.PI/2),part(feather,palette.bone,0,-.04,-.66,.035,.07,.035,-2.08),part(box,palette.ink,0,-.048,-.4,.145,.013,.4),part(feather,palette.ink,-.17,.135,-.25,.085,.035,.035,0,0,-.3),part(feather,palette.ink,.17,.135,-.25,.085,.035,.035,0,0,.3),part(feather,palette.blue,.1,.21,.16,.055,.15,.035,1.2,0,-.2),part(feather,palette.ink,-.06,.21,.18,.07,.13,.035,1.35,0,.2)]);
  const eyes=shape([part(sphere,0xffffff,-.18,.075,-.269,.027,.032,.021),part(sphere,0xffffff,.18,.075,-.269,.027,.032,.021)]);
  const wings=[-1,1].map(side=>shape([part(sphere,palette.slate,side*.06,-.13,.02,.16,.34,.26,0,0,side*-.2),...Array.from({length:7},(_,i)=>part(feather,i%3?palette.ink:palette.blue,side*(.07+i*.047),-.24-i*.035,.01+i*.09,.075,.23+(i%3)*.07,.04,Math.PI-.34,0,side*.22)),part(box,palette.bone,side*.13,-.02,-.08,.045,.24,.06,0,0,side*.3)]));
  const feet=[-1,1].map(side=>shape([part(box,palette.beak,0,-.13,.015,.045,.29,.05,.16),part(sphere,palette.bone,0,-.05,.01,.055,.055,.055),...[-1,0,1].map(i=>part(feather,palette.bone,i*.067,-.285,-.095,.026,.15,.025,-Math.PI/2,0,i*.15)),part(feather,palette.ink,0,-.28,.09,.028,.1,.028,Math.PI/2)]));
  const tail=shape(Array.from({length:5},(_,i)=>part(feather,i%2?palette.blue:palette.ink,(i-2)*.11,0,.2,.1,.34-Math.abs(i-2)*.035,.035,Math.PI/2,0,(i-2)*.18)));
  const variants={
   chickenz:{size:1,body:[1.18,.88,1.08],head:[1.05,1,.66],wing:.64,tail:[1.25,1,1.4],detail:shape([
    ...[-.12,0,.12].map(z=>part(sphere,0xd6524a,0,.3,z,.06,.13,.065)),part(sphere,0xb44840,0,-.19,-.26,.065,.12,.06)])},
   ravenz:{size:1,body:[1,1,1],head:[1,1,1],wing:1.1,tail:[.85,1,1.35]},
   peregrinez:{size:.9,body:[.87,1,1.1],head:[1,1,.8],wing:1.55,tail:[.75,1,.9],detail:shape([
    ...[-1,1].flatMap(side=>[part(sphere,0xc3c7b9,side*.2,-.025,-.21,.07,.14,.06),part(box,0x172b39,side*.23,-.04,-.265,.065,.22,.03)])])},
   eaglez:{size:1.3,body:[1.15,1.15,1.1],head:[1.2,1.13,.87],wing:1.65,tail:[1.35,1,1.1],detail:shape([
    part(sphere,0xe0cf98,0,.16,-.02,.26,.16,.3),part(feather,0xd9ae51,0,-.04,-.6,.065,.16,.06,-2.1),...[-1,1].map(side=>part(box,0x4c362d,side*.18,.125,-.27,.13,.04,.035,0,0,side*.2))])},
   hawkez:{size:1.05,body:[1,1.05,1],head:[1,1,.78],wing:1.4,tail:[.8,1,1.3],detail:shape([
    ...[-1,1].flatMap(side=>[part(sphere,0xaab0a0,side*.18,-.03,-.23,.08,.13,.055),part(box,0x443426,side*.22,-.04,-.278,.06,.035,.02),part(box,0x443426,side*.22,-.12,-.25,.055,.025,.02)])])},
   owlez:{size:1.1,body:[1.15,1.12,.95],head:[1.3,1.2,.62],wing:1.5,tail:[1,1,.7],detail:shape([
    ...[-1,1].flatMap(side=>[part(sphere,0xb6ac8e,side*.15,.03,-.26,.145,.17,.045),part(sphere,0x302c27,side*.15,.04,-.303,.075,.08,.02),part(feather,0x545048,side*.18,.29,.03,.07,.2,.05,0,0,side*-.3)]),part(feather,0xd2b673,0,-.05,-.45,.065,.12,.04,-Math.PI/2)])}
  };
  const bar=new T.PlaneGeometry(.8,.045);geos.push(bar);sphere.dispose();feather.dispose();box.dispose();
  const mesh=(g,geo,material=plumage)=>{const m=new T.Mesh(geo,material);g.add(m);return m;};
  function bird(kind='ravenz'){const v=variants[kind]||variants.chickenz,g=new T.Group();g.name=(root.BurbzZombieProgressionCore?.byId(kind).name||kind)+' zombie bird';g.scale.setScalar(v.size);const trunk=mesh(g,body),skull=mesh(trunk,head);skull.position.set(0,.46,-.18);trunk.scale.set(...v.body);skull.scale.set(...v.head);if(v.detail)mesh(skull,v.detail);mesh(skull,eyes,glow);const wing=wings.map((geo,i)=>{const m=mesh(trunk,geo);m.position.set(i? .34:-.34,.16,.08);m.scale.y=v.wing;return m;}),legs=feet.map((geo,i)=>{const m=mesh(g,geo);m.position.set(i?.19:-.19,-.42,.05);return m;}),fan=mesh(trunk,tail);fan.position.set(0,-.12,.43);fan.scale.set(...v.tail);const hp=new T.Group();hp.position.y=1.08;mesh(hp,bar,dark);const fill=mesh(hp,bar,health);fill.position.z=.004;g.add(hp);g.userData={trunk,skull,wing,legs,fan,hp,fill,kind};birds.add(g);return g;}
  function update(g,a,player,reduced=false){const u=g.userData,t=a.age||0,move=a.moving?1:0,wind=a.phase==='windup'?Math.min(1,(a.attackTime||0)/.55):0,strike=a.phase==='strike'?Math.sin(Math.min(1,(a.attackTime||0)/.22)*Math.PI):0;
   g.position.set(a.position.x,a.position.y,a.position.z);g.rotation.y=a.aerial&&Number.isFinite(a.heading)?a.heading:Math.atan2(a.position.x-player.x,a.position.z-player.z)+.22;
   u.trunk.position.y=reduced?0:Math.abs(Math.sin(t*9))*.06*move;u.trunk.position.z=-strike*.42;u.trunk.rotation.x=.12*move-wind*.25+strike*.48;u.trunk.rotation.z=reduced?0:Math.sin(t*4.5)*.04*move;
   u.skull.rotation.x=-wind*.4+strike*.35;u.skull.rotation.z=reduced?0:Math.sin(t*1.7)*.065;u.fan.rotation.x=wind*.25;
   u.wing.forEach((m,i)=>{m.rotation.z=(i?1:-1)*(.3+wind*.9+(a.phase==='strike'?.55:0)+(reduced?0:Math.sin(t*(move?9:2))*.12));});u.legs.forEach((m,i)=>{m.rotation.x=reduced?0:Math.sin(t*9+i*Math.PI)*.5*move;});
   if(a.aerial){u.trunk.position.y=reduced?0:Math.sin(t*3)*.035;u.trunk.rotation.x=a.phase==='dive'?-.5:a.phase==='takeoff'?.25:0;u.trunk.rotation.z=0;
    u.wing.forEach((m,i)=>m.rotation.z=(i?1:-1)*(1.45+(reduced?0:Math.sin(t*(u.kind==='peregrinez'?11:7))*.45)+wind*.25));u.legs.forEach(m=>m.rotation.x=-.75);}
   const fraction=Math.max(0,a.fighter.hp/a.fighter.maxHp);u.hp.visible=a.phase==='windup'||fraction<1||Math.hypot(a.position.x-player.x,a.position.z-player.z)<12;u.hp.rotation.y=player.yaw-g.rotation.y;u.fill.scale.x=fraction;u.fill.position.x=-(1-fraction)*.4;
  }
  function remove(g){g.removeFromParent();birds.delete(g);}
  return{bird,update,remove,dispose(){for(const g of birds)g.removeFromParent();birds.clear();geos.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());},diagnostics:()=>({birds:birds.size,sharedGeometries:geos.length,sharedMaterials:mats.length,drawsPerBird:10})};
 }
 root.BurbzWildernessBirds={create};
})(globalThis);
