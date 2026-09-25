/* Village animals: rigged dogs, cats, hens, roosters, sheep, cattle, goats,
 * pigs and horses, each one skinned mesh from BurbzSettlementModels.rig, plus
 * the small lives that walk them about. THREE is supplied by the caller. */
(function(root){
  'use strict';
  // ---- Bodies: a storybook farmyard -----------------------------------------
  // Round, cosy and characterful: big bright eyes, deep fleeces, plump hens,
  // proper hooves, paws and snouts. Each animal is one skinned mesh from
  // BurbzSettlementModels.rig, and the seed picks its breed and coat from
  // weighted tables, so the same seed always grows the same animal.
  const PI=Math.PI,TURN=PI*2;
  const clamp=(v,a,b)=>v<a?a:v>b?b:v;
  const ease=t=>t*t*(3-2*t);
  const smooth=(a,b,v)=>ease(clamp((v-a)/(b-a),0,1));
  // A soft twitch: mostly zero, with a short bump once per cycle of t.
  const twitch=(t,sharp)=>Math.pow(Math.max(0,Math.sin(t)),sharp);
  // A held glance that changes once per beat b: snap runs 0..1 as the head
  // swings from the last beat's pick to this one's.
  const glance=(b,snap,f)=>Math.sin((b-1)*f)*(1-snap)+Math.sin(b*f)*snap;
  const STILL=Object.freeze({moving:false});

  // ---- Seeds and colour -----------------------------------------------------
  // FNV-1a with a final avalanche, so every bit (and every breed) is in play.
  function hash(text){
    let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}
    h^=h>>>16;h=Math.imul(h,0x7feb352d);h^=h>>>15;h=Math.imul(h,0x846ca68b);h^=h>>>16;return h>>>0;
  }
  function random(seed){let a=seed>>>0;return()=>{a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
  const pick=(rnd,list)=>list[Math.floor(rnd()*list.length)];
  // Common breeds turn up more often: each entry carries its weight w.
  function pickW(rnd,list){let t=rnd()*list.reduce((n,e)=>n+e.w,0);for(const e of list){t-=e.w;if(t<0)return e;}return list[list.length-1];}
  function mix(a,b,t){
    const ar=a>>16&255,ag=a>>8&255,ab=a&255;
    return(Math.round(ar+((b>>16&255)-ar)*t)<<16)|(Math.round(ag+((b>>8&255)-ag)*t)<<8)|Math.round(ab+((b&255)-ab)*t);
  }
  const dark=(c,k)=>mix(c,0x1a110b,k),light=(c,k)=>mix(c,0xfff7ea,k);
  // Smooth 3D mottle in about -1..1: cow patches, dapples, merle and calico.
  const mottle=(x,y,z,f,s)=>(Math.sin(x*f+s)+Math.sin(y*f*1.31+s*2.1)+Math.sin(z*f*1.17+s*3.7)+Math.sin((x+z)*f*.83+s*5.3)+Math.sin((x-y)*f*.71+s*1.3))*.4;
  // A steady scatter in 0..1, fixed to the spot: speckled feathers, shaggy hair.
  const fleck=(x,y,z)=>{const v=Math.sin(x*431.7+y*197.3+z*311.1)*43758.5;return v-Math.floor(v);};

  // ---- Shapes ---------------------------------------------------------------
  // Each animal gets a fresh rig that carries the caller's THREE, so the
  // module never keeps a THREE of its own.
  function begin(T){const r=root.BurbzSettlementModels.rig(T);r.T=T;return r;}
  // A smooth tapered tube along a curve, closed with round caps: bodies,
  // necks, heads, legs, tails, horns, ears. Each radius is r or [up, side];
  // `up` hints which way "up" points across the tube. `bump(t, angle)` can
  // ruffle the surface for wool, manes and shaggy coats.
  function sweep(T,points,radii,o={}){
    const n=o.n||10,m=points.length,seg=o.seg||(m-1)*3;
    const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(p[0],p[1],p[2])),false,'centripetal');
    const rr=radii.map(v=>typeof v==='number'?[v,v]:v);
    const up=new T.Vector3().fromArray(o.up||[0,1,0]).normalize();
    const P=new T.Vector3(),D=new T.Vector3(),N=new T.Vector3(),B=new T.Vector3();
    const e=1-(o.square||0)*.55,round=o.round??.7;
    const rad=(t,k)=>{
      const q=t*(m-1),i=Math.min(m-2,Math.floor(q)),w=q-i;
      const p0=rr[Math.max(0,i-1)][k],p1=rr[i][k],p2=rr[i+1][k],p3=rr[Math.min(m-1,i+2)][k];
      return Math.max(0,.5*(2*p1+(-p0+p2)*w+(2*p0-5*p1+4*p2-p3)*w*w+(-p0+3*p1-3*p2+p3)*w*w*w));
    };
    const rings=seg+1,pos=new Float32Array((rings*n+2)*3),caps=[];let v=0;
    for(let s=0;s<rings;s++){
      const t=s/seg;curve.getPoint(t,P);curve.getTangent(t,D);
      N.copy(up).addScaledVector(D,-up.dot(D));if(N.lengthSq()<1e-6)N.set(D.y,-D.x,0);N.normalize();B.crossVectors(D,N);
      const a=rad(t,0),b=rad(t,1);
      for(let j=0;j<n;j++){
        const ang=j/n*TURN;let c=Math.cos(ang),sn=Math.sin(ang);
        if(e!==1){c=Math.sign(c)*Math.pow(Math.abs(c),e);sn=Math.sign(sn)*Math.pow(Math.abs(sn),e);}
        const k=o.bump?o.bump(t,ang):1;
        pos[v++]=P.x+(N.x*a*c+B.x*b*sn)*k;pos[v++]=P.y+(N.y*a*c+B.y*b*sn)*k;pos[v++]=P.z+(N.z*a*c+B.z*b*sn)*k;
      }
      const sign=s?1:-1;if(s===0||s===seg)caps.push(P.x+D.x*sign*(a+b)/2*round,P.y+D.y*sign*(a+b)/2*round,P.z+D.z*sign*(a+b)/2*round);
    }
    pos.set(caps,v);
    const index=[];
    for(let s=0;s<seg;s++)for(let j=0;j<n;j++){const a=s*n+j,b=s*n+(j+1)%n;index.push(a,b,a+n,b,b+n,a+n);}
    const S=rings*n,E=S+1;
    for(let j=0;j<n;j++)index.push(S,(j+1)%n,j,E,seg*n+j,seg*n+(j+1)%n);
    const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setIndex(index);geo.computeVertexNormals();
    return geo;
  }
  const put=(r,geo,color,bone,blend)=>r.add(geo,color,[0,0,0],[0,0,0],[1,1,1],bone,blend);
  const lerp3=(a,b,t)=>[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
  // A storybook eye set into the head: a glossy iris, an optional pupil and
  // a bright catch-light up and forward. `fwd` is the way the animal faces.
  // An upper lid in the coat colour gives a calm, gentle look; on its own
  // lid bone it can blink.
  function eye(r,bone,c,out,rad,o){
    const T=r.T,n=new T.Vector3(out[0],out[1],out[2]).normalize(),fw=new T.Vector3(o.fwd[0],o.fwd[1],o.fwd[2]);
    const f=fw.addScaledVector(n,-n.dot(fw)).normalize(),u=new T.Vector3().crossVectors(n,f);if(u.y<0)u.negate();
    const at=(k,a,b)=>[c[0]+(n.x*k+u.x*a+f.x*b)*rad,c[1]+(n.y*k+u.y*a+f.y*b)*rad,c[2]+(n.z*k+u.z*a+f.z*b)*rad];
    // Turn each part so its +Z looks out of the eye and its +Y stays up, so
    // both eyes wear their lids on top and slit pupils lie the same way.
    const e=new T.Euler().setFromRotationMatrix(new T.Matrix4().makeBasis(new T.Vector3().crossVectors(u,n),u,n));
    const rot=[e.x,e.y,e.z],[w,h]=o.seg||[7,5];
    if(o.rim)r.sphere(rad*1.16,at(-.12,0,0),o.rim,bone,[1,1,.6],rot,7,4);
    r.sphere(rad,c,o.iris,bone,[1,1,.72],rot,w,h);
    if(o.pupil)r.sphere(rad*.6,at(.46,0,.04),0x0d0806,bone,o.pupil,rot,6,3);
    r.sphere(rad*.28,at(.6,.36,.26),0xffffff,bone,[1,1,.5],rot,4,3);
    if(o.lidBone)r.bone(o.lidBone,bone,c);
    if(o.lid)r.add(new T.SphereGeometry(rad*1.1,w,2,0,TURN,0,PI*o.lid),o.lidColor,c,rot,[1,1,.82],o.lidBone||bone);
  }
  // A flat leaf along a path: ears, feathers, wings. `face` is the way the
  // flat side looks; `inner` paints that side (the inside of an ear).
  function leaf(r,bone,points,widths,thick,face,color,inner,n=6){
    const geo=sweep(r.T,points,widths.map(w=>[thick,w]),{n,seg:points.length,up:face,round:.5});
    let paint=color;
    if(inner!=null){
      const c=points[Math.floor(points.length/2)],fl=Math.hypot(face[0],face[1],face[2]),base=typeof color==='function'?color:()=>color;
      paint=(x,y,z)=>((x-c[0])*face[0]+(y-c[1])*face[1]+(z-c[2])*face[2])/fl>thick*.25?inner:base(x,y,z);
    }
    return put(r,geo,paint,bone);
  }

  // ---- Leg solver -------------------------------------------------------------
  // Two-bone IK in a leg's side plane (forward, up): ik.u and ik.l are the
  // world angles of the upper and lower segments. bend +1 folds the joint
  // forward (a front knee), -1 folds it back (a hock). The one shared answer
  // means a pose allocates nothing.
  const ik={u:0,l:0};
  function solve(dx,dy,a,b,bend){
    const d=clamp(Math.hypot(dx,dy),Math.abs(a-b)+1e-4,a+b-1e-4),t=Math.atan2(dy,dx);
    ik.u=t+bend*Math.acos(clamp((a*a+d*d-b*b)/(2*a*d),-1,1));
    ik.l=ik.u-bend*(PI-Math.acos(clamp((a*a+b*b-d*d)/(2*a*b),-1,1)));
  }
  // Rig a leg as hip → knee → foot bones and remember its rest shape for
  // the solver. alongX: the animal faces +X (else +Z).
  function legBones(r,i,hip,knee,foot,bend,td,alongX){
    const h=r.bone('hip'+i,null,hip),k=r.bone('knee'+i,'hip'+i,knee),f=r.bone('foot'+i,'knee'+i,foot);
    const fw=p=>alongX?p[0]:p[2];
    const a=Math.hypot(fw(knee)-fw(hip),knee[1]-hip[1]),b=Math.hypot(fw(foot)-fw(knee),foot[1]-knee[1]);
    const d0=Math.hypot(fw(foot)-fw(hip),foot[1]-hip[1]);
    h.userData.leg={knee:k,foot:f,a,b,alongX,bend,td,front:bend>0,
      hx:fw(hip),hy:hip[1],fx:fw(foot),fy:foot[1],
      u0:Math.atan2(knee[1]-hip[1],fw(knee)-fw(hip)),l0:Math.atan2(foot[1]-knee[1],fw(foot)-fw(knee)),
      max:Math.min(a+b-1e-3,d0+(a+b-d0)*.3)};
    return h;
  }
  // Plant or swing one leg. cyc is the gait in cycles, w how much gait is on
  // (it eases in and out as the animal starts and stops). Late in the stance
  // the heel lifts and a hoof rolls over its toe, and it stays tipped as the
  // leg starts to fold.
  function stepLeg(h,cyc,w,G,bob,rest){
    const L=h.userData.leg;
    let p=cyc-L.td;p-=Math.floor(p);
    let dx=0,dy=0,sw=0,roll=0;
    if(w>0){
      if(p<G.duty){const s=p/G.duty;dx=G.sweep*(.5-s);if(G.toe)roll=smooth(.78,1,s);}
      else{const k=(p-G.duty)/(1-G.duty);dx=G.sweep*(ease(k)-.5);sw=Math.sin(PI*Math.pow(k,L.front?.75:.9));dy=G.lift*sw;if(G.toe)roll=1-smooth(0,.3,k);}
      dx*=w;dy*=w;sw*=w;roll*=w;
    }
    if(roll)dy+=roll*G.toe;
    // A resting hind hoof tips onto its toe.
    if(rest){dy+=rest*.03;sw=Math.max(sw,rest*.7);}
    const tx=L.fx+dx,ty=L.fy+dy,ox=tx-L.hx;
    let hy=L.hy+bob;const top=ty+Math.sqrt(Math.max(0,L.max*L.max-ox*ox));if(hy>top)hy=top;
    solve(ox,ty-hy,L.a,L.b,L.bend);
    const du=ik.u-L.u0,dl=ik.l-L.l0,foot=-dl*(1-sw)-sw*G.flex*(L.front?1:.7)-roll*.3;
    h.position.y=hy;
    if(L.alongX){h.rotation.z=du;L.knee.rotation.z=dl-du;L.foot.rotation.z=foot;}
    else{h.rotation.x=-du;L.knee.rotation.x=du-dl;L.foot.rotation.x=-foot;}
  }
  // Gait weight eases between standing and walking, so a stop never snaps.
  // A clock that has not moved cannot ease, so then the pose steps straight
  // to where it is heading.
  function gaitWeight(u,moving,time){
    const want=moving?1:0;
    if(u.gaitAt===undefined||!(time>u.gaitAt))u.gait=want;
    else u.gait+=(want-u.gait)*Math.min(1,(time-u.gaitAt)*5);
    u.gaitAt=time;return u.gait;
  }

  // ---- Hoofed legs and bodies -------------------------------------------------
  // Legs are listed left front, right front, left hind, right hind (the
  // animal faces +X, so its left is -Z). The walk is the four-beat lateral
  // sequence LH, LF, RH, RF, a quarter cycle apart.
  const WALK_TD=[.25,.75,0,.5];
  // Each leg: a skin that eases from the body into the leg, the upper leg
  // (forearm or gaskin) easing into the knee, the cannon easing into the
  // fetlock, and a hoof planted flat. Points are [dx, y, radius] from the
  // leg's x; `fet` marks the fetlock in `lower`. n is [upper, lower] sides:
  // round thighs, lean cannons.
  function hoofedLegs(r,spec,paint){
    const T=r.T,legs=[];
    [['front',-1],['front',1],['hind',-1],['hind',1]].forEach(([end,side],i)=>{
      const s=spec[end],x=s.x,z=side*s.z,P=p=>[x+p[0],p[1],z],[nu,nl]=s.n,seg=s.seg||3;
      const up=s.upper.map(P),lo=s.lower.map(P),knee=up[up.length-1],foot=lo[s.fet];
      const h=legBones(r,i,[x,s.hip,z],knee,foot,end==='front'?1:-1,WALK_TD[i],true);
      const [j0,j1]=s.junction,top=[x+j0[0],j0[1],z*j0[2]],bottom=[x+j1[0],j1[1],z];
      put(r,sweep(T,[top,bottom],[j0[3],j1[2]],{n:nu,seg:s.jseg||2,up:[1,0,0],bump:s.bump}),paint,'body',{bone:'hip'+i,from:top,to:lerp3(top,bottom,.8)});
      put(r,sweep(T,up,s.upper.map(p=>p[2]),{n:nu,seg,up:[1,0,0],bump:s.bump}),paint,'hip'+i,{bone:'knee'+i,from:lerp3(up[up.length-2],knee,.5),to:lerp3(knee,lo[1],.15)});
      put(r,sweep(T,lo,s.lower.map(p=>p[2]),{n:nl,seg,up:[1,0,0]}),paint,'knee'+i,{bone:'foot'+i,from:lerp3(lo[s.fet-1],foot,.55),to:lerp3(foot,lo[s.fet+1],.3)});
      const [hr1,hr2,hh,hdx]=s.hoof,hc=s.hoofColor||0x2e2622;
      r.cylinder(hr1,hr2,hh,[x+hdx,hh/2,z],hc,'foot'+i,[0,0,0],s.hoofN||nl);
      if(s.cleft)r.box([hr2*1.1,hh*.85,.005],[x+hdx+hr2*.5,hh*.45,z],dark(hc,.6),'foot'+i);
      legs.push(h);
    });
    return legs;
  }
  // Bones every hoofed animal shares: body, neck, head with its jaw and the
  // muzzle at the nose tip, ears and tail.
  function hoofedBones(r,s){
    r.bone('body',null,s.body);r.bone('neck','body',s.neck);r.bone('head','neck',s.head);
    r.bone('jaw','head',s.jaw);r.bone('muzzle','head',s.muzzle);
    r.bone('earL','head',[s.ear[0],s.ear[1],-s.ear[2]]);r.bone('earR','head',s.ear);
    r.bone('tail','body',s.tail);if(s.tail2)r.bone('tail2','tail',s.tail2);
  }
  const plainEye=(side,fwd,iris,lidColor,lid=.34)=>({fwd,iris,lid,lidColor,lidBone:side<0?'lidL':'lidR'});
  // Graze, look about, flick ears and swish the tail; walk with the lateral
  // four-beat, the body rolling over each stance and the neck nodding.
  function poseHoofed(g,state,time,motion){
    const u=g.userData,R=u.rig,G=R.gait,ph=u.phase||0;
    const w=gaitWeight(u,!!state.moving,time),cyc=(state.stride||0)/TURN,graze=clamp(state.graze||0,0,1)*(1-w);
    const bob=-G.bob*w*(.5+.5*Math.cos(cyc*TURN*2)),idle=motion*(1-w);
    // Now and then a standing horse or cow rests a hind hoof on its toe,
    // and next time it rests the other one.
    const k=time*.13+ph,restLeg=2+(Math.floor(k/TURN)&1);
    const rest=R.restHoof?idle*(1-graze)*clamp(Math.sin(k)*3-1,0,1):0;
    for(let i=0;i<4;i++){const rs=i===restLeg?rest:0;stepLeg(R.legs[i],cyc,w,G,bob-rs*.012,rs);}
    R.body.position.y=R.bodyY+bob+Math.sin(time*1.4+ph)*.0025*idle-rest*.008;
    R.body.rotation.x=G.roll*w*Math.sin(cyc*TURN)+(restLeg===3?rest:-rest)*.025;
    R.body.rotation.z=G.pitch*w*Math.sin(cyc*TURN*2+.8)+graze*G.grazePitch;
    const nod=G.nod*w*Math.sin(cyc*TURN*2+G.nodPhase);
    const look=(Math.sin(time*.29+ph)*.28+Math.sin(time*.83+ph*2)*.05)*idle*(1-graze*.6);
    const bite=graze*Math.max(0,Math.sin(time*7+ph))*motion;
    R.neck.rotation.set(0,look,-G.grazeNeck*graze+nod+Math.sin(time*.7+ph)*.03*idle);
    R.head.rotation.set(Math.sin(time*.5+ph)*.05*idle,look*.3,-G.grazeHead*graze+bite*.03-nod*.4);
    // Grazers tear at the grass; a resting cud-chewer grinds side to side.
    const cud=R.cud?idle*(1-graze)*smooth(-.2,.3,Math.sin(time*.17+ph*1.3)):0;
    R.jaw.rotation.set(0,cud*.08*Math.sin(time*2.6+ph),-(bite*.1+cud*(.035+.03*Math.sin(time*5.2+ph))));
    // A slow, sleepy blink every few seconds. A pig's lid rests folded back
    // under its brow, so it looks gentle, and swings further to close.
    const tuck=R.lidTuck||0,lid=twitch(time*1.6+ph*2.3,300)*(1.25+tuck)*motion-tuck;
    R.lids[0].rotation.x=-lid;R.lids[1].rotation.x=lid;
    for(let i=0;i<2;i++){
      const flick=twitch(time*1.3+ph*3+i*2.1,24);
      R.ears[i].rotation.set((i?1:-1)*(flick*.35+Math.sin(time*.9+i)*.05)*motion,0,flick*.25*motion-graze*.25);
    }
    // Tails hang (horse, cow) or stick out (sheep, goat, pig); swish to suit.
    const swish=Math.sin(time*1.7+ph)*.5+Math.sin(time*.61+ph)*.5;
    if(R.tailHangs){
      R.tail.rotation.set(swish*.28*motion+w*Math.sin(cyc*TURN)*.08,0,.05*w);
      R.tail2.rotation.set(Math.sin(time*1.7+ph-.9)*.3*motion,0,0);
    }else R.tail.rotation.set(0,(swish*.35+twitch(time*2.3+ph,16)*.6)*motion,Math.sin(time*9)*.04*w);
  }

  // ---- Sheep --------------------------------------------------------------------
  const SHEEP=[
    {w:3,breed:'whiteface',wool:0xeee7d6,face:0xe8d6bf,legs:0xdcc8ac,nose:0xc98c8a,inner:0xe0a8a2,topknot:true,name:'a woolly white-faced ewe'},
    {w:2.2,breed:'suffolk',wool:0xe9e1cf,face:0x2e2826,legs:0x2e2826,nose:0x1d1816,inner:0x5a3e3a,droop:true,name:'a black-faced Suffolk ewe'},
    {w:1,breed:'jacob',wool:0xebe4d6,face:0x2a2422,legs:0xe2dace,nose:0x1d1816,inner:0x5a3e3a,spots:0x3e2a20,blaze:true,horns:true,name:'a spotty Jacob sheep'},
    {w:1,breed:'welsh',wool:0x3e332d,face:0x221c1a,legs:0x221c1a,nose:0x171311,inner:0x4a3632,name:'a black Welsh Mountain sheep'},
    {w:.8,breed:'shetland',wool:0x6e4e36,face:0x3a2d27,legs:0x3a2d27,nose:0x201814,inner:0x6a4a40,topknot:true,name:'a brown Shetland sheep'},
    {w:.8,breed:'cream',wool:0xe3d5b6,face:0x9c7450,legs:0x8a6444,nose:0x5a3a2e,inner:0xd0907e,topknot:true,name:'a cream sheep with a toffee face'},
  ];
  function sheep(r,h,rnd){
    const T=r.T,C=pickW(rnd,SHEEP);
    hoofedBones(r,{body:[0,.34,0],neck:[.16,.36,0],head:[.33,.47,0],jaw:[.4,.45,0],muzzle:[.49,.41,0],ear:[.335,.495,.045],tail:[-.25,.4,0]});
    // A Jacob's big dark patches sit on both flanks and the rump.
    const spots=[];
    if(C.spots)for(let i=0;i<7;i++){const a=(i%2?1:-1)*(.7+rnd()*.7),x=-.24+i*.065+rnd()*.03;spots.push([x,.36+Math.cos(a)*.17,Math.sin(a)*.16,.07+rnd()*.03]);}
    const wool=(x,y,z)=>{
      const c=spots.some(([sx,sy,sz,sr])=>(x-sx)**2+(y-sy)**2+(z-sz)**2<sr*sr)?C.spots:C.wool;
      return mix(dark(c,.14),light(c,.1),clamp((y-.2)/.32,0,1));
    };
    // The fleece: a deep woolly barrel, lumpy with curls, that billows into
    // soft clouds along the back.
    const curls=(t,a)=>1+.08*Math.sin(a*6+t*23)*Math.sin(t*29+a*3)+.03*Math.sin(a*11+t*9);
    const fleece=(t,a)=>curls(t,a)+.1*Math.pow(Math.max(0,Math.cos(a)),3)*(.55+.45*Math.sin(t*19+a*2.5))*Math.sin(PI*t);
    put(r,sweep(T,[[-.29,.37,0],[-.22,.365,0],[-.1,.36,0],[.05,.36,0],[.17,.37,0],[.245,.39,0]],[[.08,.075],[.165,.15],[.185,.168],[.185,.168],[.16,.146],[.08,.075]],{n:14,seg:12,bump:fleece}),wool,'body');
    const tufts=C.horns?[[-.12,.51,-.05,.07],[.06,.505,.05,.068]]:[[-.17,.5,-.045,.068],[-.02,.515,.04,.072],[.11,.5,-.03,.066]];
    for(const [x,y,z,s] of tufts)r.sphere(s,[x,y,z],wool,'body',[1,.72,1],[0,0,0],8,5);
    put(r,sweep(T,[[.1,.35,0],[.2,.41,0],[.29,.46,0],[.32,.478,0]],[[.12,.11],[.1,.092],[.075,.068],[.064,.058]],{n:10,seg:4,bump:curls}),wool,'body',{bone:'neck',from:[.13,.37,0],to:[.27,.45,0]});
    // A long gentle face and a soft nose; a Jacob wears a white blaze.
    const face=(x,y,z)=>x>.46&&y<.44?C.nose:C.blaze&&Math.abs(z)<.014&&x>.34&&y>.43?0xe8e0d2:C.face;
    put(r,sweep(T,[[.292,.515,0],[.33,.508,0],[.385,.478,0],[.44,.443,0],[.475,.423,0]],[[.046,.05],[.064,.057],[.053,.047],[.041,.036],[.029,.027]],{n:10,seg:5}),face,'neck',{bone:'head',from:[.3,.5,0],to:[.35,.49,0]});
    r.sphere(.026,[.45,.4,0],C.face,'jaw',[1.1,.5,.95],[0,0,-.5],6,4);
    if(C.topknot)r.sphere(.055,[.33,.54,0],wool,'head',[1,.72,1.05],[0,0,-.25],7,4);
    for(const s of [-1,1]){
      eye(r,'head',[.375,.5,s*.047],[.35,.3,s],.018,plainEye(s,[1,0,0],0x2b1d15,C.face,.36));
      const ear=C.droop?[[.335,.495,s*.045],[.35,.47,s*.085],[.37,.44,s*.11]]:[[.335,.495,s*.045],[.34,.48,s*.088],[.348,.462,s*.13]];
      leaf(r,s<0?'earL':'earR',ear,[.022,.034,.014],.009,C.droop?[.5,.4,s]:[.8,.6,0],C.face,C.inner,4);
      // Jacob rams' horns curl back and round past the cheek.
      if(C.horns)put(r,sweep(T,[[.325,.53,s*.035],[.305,.575,s*.055],[.265,.575,s*.085],[.25,.53,s*.1],[.275,.495,s*.108]],[.017,.015,.012,.008,.003],{n:5,seg:5}),(x,y,z)=>mix(0x3a3029,0x1d1814,clamp((.3-x)*8,0,1)),'head');
    }
    const legs=hoofedLegs(r,{
      front:{x:.14,z:.075,hip:.29,junction:[[0,.33,.7,.045],[0,.2,.04]],upper:[[0,.22,.034],[0,.17,.029],[0,.13,.026]],lower:[[0,.13,.026],[0,.085,.02],[0,.045,.022],[.008,.03,.021]],fet:2,hoof:[.02,.024,.032,.01],hoofColor:0x2e2622,n:[6,6]},
      hind:{x:-.15,z:.08,hip:.3,junction:[[-.01,.34,.7,.055],[.01,.2,.045]],upper:[[.01,.22,.04],[-.005,.18,.031],[-.03,.14,.026]],lower:[[-.03,.14,.026],[-.022,.09,.02],[-.015,.045,.022],[-.007,.03,.021]],fet:2,hoof:[.02,.024,.032,-.005],hoofColor:0x2e2622,n:[6,6]},
    },(x,y,z)=>y>.2?wool(x,y,z):C.legs);
    put(r,sweep(T,[[-.25,.41,0],[-.295,.37,0],[-.31,.32,0]],[.042,.04,.028],{n:6,seg:2,bump:curls}),wool,'tail');
    return {name:C.name,breed:C.breed,legs,reach:.5,barrel:[-.13,.16,.17],gait:{sweep:.5*.62,duty:.62,lift:.045,toe:.012,flex:.9,bob:.008,roll:.035,pitch:.012,nod:.05,nodPhase:.4,grazeNeck:1.38,grazeHead:-.5,grazePitch:-.08},extra:{cud:true}};
  }

  // ---- Goat -----------------------------------------------------------------------
  const GOATS=[
    {w:2,coat:'saanen',base:0xe6ddcc,accent:0xd6c9b2,name:'a white Saanen nanny'},
    {w:1.5,coat:'toggenburg',base:0x6e4c30,accent:0xe8e0d0,name:'a Toggenburg goat'},
    {w:1.2,coat:'alpine',base:0x8e6238,accent:0x241e1c,name:'an Alpine goat'},
    {w:1,coat:'blacktan',base:0x2a2523,accent:0x9a6c40,name:'a black-and-tan goat'},
    {w:1.2,coat:'pied',base:0xe6ddcc,accent:0x5e3820,name:'a patchy pied goat'},
  ];
  function goat(r,h,rnd){
    const T=r.T,C=pickW(rnd,GOATS),coat=C.coat,base=C.base,accent=C.accent;
    const horned=rnd()<.75,beard=coat!=='pied'||rnd()<.5;
    // The head sits forward of its bones by G, long in the face.
    const G=(x,y,z)=>[x+.045,y-.02,z];
    hoofedBones(r,{body:[0,.38,0],neck:[.16,.39,0],head:[.32,.55,0],jaw:G(.36,.54,0),muzzle:G(.43,.505,0),ear:[.32,.58,.038],tail:[-.26,.46,0]});
    const paint=(x,y,z)=>{
      if(coat==='toggenburg'){if(y<.18)return accent;if(x>.27&&y>.52&&Math.abs(Math.abs(z)-.024)<.013)return accent;if(x>.38)return accent;}
      if(coat==='alpine'&&(x<-.12||y<.25||y>.5&&Math.abs(z)<.02&&x<.3))return accent;
      if(coat==='blacktan'&&(y<.25&&x>-.3||x>.37))return accent;
      if(coat==='pied'&&mottle(x,y,z,9,h%97)>.25)return accent;
      return mix(base,dark(base,.16),clamp((.36-y)*3,0,1)*.6);
    };
    put(r,sweep(T,[[-.29,.43,0],[-.23,.425,0],[-.08,.395,0],[.08,.39,0],[.2,.41,0],[.27,.43,0]],[[.05,.05],[.11,.095],[.13,.1],[.135,.1],[.12,.09],[.06,.055]],{n:14,seg:10,square:.1}),paint,'body');
    // Neck slopes forward; the head hangs a little, long in the face.
    put(r,sweep(T,[[.1,.4,0],[.2,.47,0],[.28,.54,0],G(.27,.575,0)],[[.09,.076],[.075,.062],[.06,.05],[.054,.046]],{n:10,seg:4}),paint,'body',{bone:'neck',from:[.14,.42,0],to:[.26,.52,0]});
    const nose=dark(base,.5);
    put(r,sweep(T,[G(.24,.628,0),G(.28,.622,0),G(.335,.585,0),G(.39,.543,0),G(.418,.522,0)],[[.046,.049],[.058,.053],[.047,.041],[.035,.031],[.025,.024]],{n:10,seg:5}),(x,y,z)=>x>.45&&y<.517?nose:paint(x,y,z),'neck',{bone:'head',from:G(.25,.62,0),to:G(.3,.6,0)});
    r.sphere(.02,G(.395,.498,0),(x,y,z)=>coat==='toggenburg'||coat==='blacktan'?accent:paint(x,y,z),'jaw',[1.1,.5,.95],[0,0,-.5],6,4);
    if(beard)put(r,sweep(T,[G(.37,.515,0),G(.375,.478,0),G(.37,.44,0)],[.018,.014,.002],{n:6,seg:3,up:[1,0,0]}),coat==='blacktan'||coat==='alpine'?0x2a2523:light(base,.1),'jaw');
    if(horned)for(const s of [-1,1])
      put(r,sweep(T,[G(.27,.65,s*.024),G(.255,.71,s*.032),G(.215,.745,s*.042),G(.175,.738,s*.05),G(.152,.705,s*.053)],[.02,.016,.012,.008,.003],{n:6,seg:5}),(x,y,z)=>mix(0x8a7c66,0x3e362e,clamp((.3-x)*6,0,1)),'head');
    for(const s of [-1,1]){
      eye(r,'head',G(.305,.6,s*.041),[.3,.3,s],.019,{fwd:[1,0,0],iris:0xc89a3c,pupil:[1.45,.45,.6],lid:.3,lidColor:paint(...G(.305,.615,s*.041)),lidBone:s<0?'lidL':'lidR'});
      leaf(r,s<0?'earL':'earR',[G(.275,.602,s*.038),G(.285,.585,s*.078),G(.298,.555,s*.108),G(.305,.535,s*.115)],[.018,.028,.026,.01],.008,[.7,.5,s*.5],paint,light(base,.12),5);
    }
    const legs=hoofedLegs(r,{
      front:{x:.15,z:.065,hip:.35,junction:[[0,.39,.7,.05],[0,.25,.042]],upper:[[0,.27,.036],[.002,.21,.03],[0,.16,.027]],lower:[[0,.16,.027],[0,.1,.02],[0,.05,.023],[.007,.035,.022]],fet:2,hoof:[.02,.024,.038,.01],hoofColor:0x3a3029,n:[7,6]},
      hind:{x:-.17,z:.07,hip:.36,junction:[[-.01,.4,.7,.065],[.015,.25,.05]],upper:[[.015,.27,.045],[-.005,.21,.032],[-.035,.17,.027]],lower:[[-.035,.17,.027],[-.025,.1,.02],[-.015,.05,.023],[-.008,.035,.022]],fet:2,hoof:[.02,.024,.038,-.005],hoofColor:0x3a3029,n:[7,6]},
    },paint);
    put(r,sweep(T,[[-.26,.47,0],[-.28,.51,0],[-.285,.55,0]],[.02,.016,.004],{n:5,seg:2}),paint,'tail');
    return {name:C.name,breed:coat,legs,reach:.49,barrel:[-.19,.22,.11],gait:{sweep:.5*.62,duty:.62,lift:.05,toe:.012,flex:.9,bob:.009,roll:.025,pitch:.012,nod:.05,nodPhase:.4,grazeNeck:1.55,grazeHead:-.65,grazePitch:-.07},extra:{cud:true}};
  }

  // ---- Pig --------------------------------------------------------------------------
  const PIGS=[
    {w:2,breed:'pink',name:'a pink pig'},
    {w:1.5,breed:'oldspot',name:'a Gloucester Old Spot'},
    {w:1,breed:'tamworth',name:'a ginger Tamworth'},
    {w:1.5,breed:'saddleback',name:'a Saddleback pig'},
    {w:1,breed:'berkshire',name:'a Berkshire pig with white socks'},
  ];
  function pig(r,h,rnd){
    const T=r.T,C=pickW(rnd,PIGS),breed=C.breed;
    const pink=0xeaa596,black=0x2e2727;
    const base={pink,oldspot:pink,tamworth:0x9a5428,saddleback:black,berkshire:black}[breed];
    const lop=breed==='oldspot'||breed==='saddleback';
    const paint=(x,y,z)=>{
      if(breed==='saddleback'&&x>.02&&x<.2)return 0xf0e4da;
      if(breed==='berkshire'&&(y<.07||x>.4))return 0xf0e4da;
      return mix(light(base,.05),dark(base,.12),clamp((.3-y)*2.5,0,1));
    };
    hoofedBones(r,{body:[0,.27,0],neck:[.18,.29,0],head:[.24,.3,0],jaw:[.36,.25,0],muzzle:[.44,.25,0],ear:[.29,.39,.055],tail:[-.25,.33,0]});
    const spine=[[-.26,.29,0],[-.2,.285,0],[-.07,.275,0],[.07,.275,0],[.17,.28,0],[.23,.29,0]],girth=[[.09,.08],[.165,.15],[.185,.165],[.182,.162],[.158,.142],[.1,.09]];
    put(r,sweep(T,spine,girth,{n:16,seg:12}),paint,'body');
    // Old Spots wear crisp round spots, each a thin lens laid on the hide,
    // scattered over the back and both flanks.
    if(breed==='oldspot')for(let i=0;i<9;i++){
      const x=-.17+i*.036+rnd()*.02,j=spine.findIndex(p=>p[0]>x),k=(x-spine[j-1][0])/(spine[j][0]-spine[j-1][0]);
      const at=(v,e)=>v[j-1][e]+(v[j][e]-v[j-1][e])*k,up=at(girth,0),side=at(girth,1);
      const a=(i%2?1:-1)*(.2+rnd()*1.4),ny=Math.cos(a)/up,nz=Math.sin(a)/side,nl=Math.hypot(ny,nz);
      r.add(new T.SphereGeometry(.03+rnd()*.022,6,2),0x3e3432,[x,at(spine,1)+Math.cos(a)*up-ny/nl*.003,Math.sin(a)*side-nz/nl*.003],[Math.atan2(nz,ny),0,0],[1,.3,1],'body');
    }
    put(r,sweep(T,[[.14,.28,0],[.2,.29,0],[.25,.3,0]],[[.145,.13],[.13,.12],[.115,.11]],{n:10,seg:3}),paint,'body',{bone:'neck',from:[.17,.29,0],to:[.24,.3,0]});
    // Round cheeks tapering into the snout, capped by its pink disc.
    put(r,sweep(T,[[.2,.315,0],[.27,.322,0],[.335,.3,0],[.39,.277,0],[.418,.266,0]],[[.11,.11],[.112,.108],[.085,.082],[.062,.06],[.056,.056]],{n:12,seg:7,round:.2}),paint,'head');
    const disc=breed==='berkshire'||breed==='saddleback'?0xd49a92:dark(pink,.1);
    r.cylinder(.054,.057,.024,[.427,.265,0],disc,'head',[0,0,-PI/2],10);
    r.sphere(.034,[.38,.222,0],paint,'jaw',[1.25,.45,1],[0,0,-.3],6,4);
    for(const s of [-1,1]){
      r.sphere(.01,[.44,.268,s*.019],0x5a3230,'head',[.5,1.3,1],[0,0,0],4,3);
      eye(r,'head',[.345,.338,s*.071],[.45,.35,s],.018,{...plainEye(s,[1,0,0],0x2a1c16,paint(.345,.355,s*.071),.32),seg:[6,4]});
      // Lop ears flop over the eyes; a Tamworth's prick ears tip forward.
      const ear=lop?[[.285,.395,s*.052],[.32,.405,s*.07],[.355,.39,s*.08],[.372,.372,s*.078]]:[[.29,.392,s*.055],[.318,.428,s*.072],[.356,.452,s*.084]];
      leaf(r,s<0?'earL':'earR',ear,lop?[.034,.052,.05,.022]:[.038,.042,.012],.009,lop?[.3,.8,s*.5]:[.8,.5,s*.4],paint,lop?null:dark(pink,.14),5);
    }
    const hoof=0x6a5048;
    const legs=hoofedLegs(r,{
      front:{x:.12,z:.085,hip:.2,junction:[[0,.24,.6,.05],[0,.13,.045]],upper:[[0,.14,.045],[0,.115,.04],[0,.09,.036]],lower:[[0,.09,.036],[0,.06,.03],[0,.035,.03],[.006,.026,.029]],fet:2,hoof:[.025,.028,.028,.006],hoofColor:hoof,n:[7,6],seg:2},
      hind:{x:-.13,z:.09,hip:.21,junction:[[-.01,.25,.6,.058],[.01,.13,.05]],upper:[[.01,.14,.05],[-.002,.115,.042],[-.015,.09,.036]],lower:[[-.015,.09,.036],[-.01,.06,.03],[-.005,.035,.03],[.001,.026,.029]],fet:2,hoof:[.025,.028,.028,.001],hoofColor:hoof,n:[7,6],seg:2},
    },paint);
    // A proper corkscrew tail.
    const curl=[];for(let i=0;i<=8;i++){const a=i/8*TURN*1.25;curl.push([-.255-.03*i/8-Math.sin(a)*.018,.33+Math.cos(a)*.018-.01*i/8,Math.sin(a*.5)*.012]);}
    put(r,sweep(T,curl,curl.map((_,i)=>.01-.004*i/8),{n:4,seg:8}),paint,'tail');
    return {name:C.name,breed,legs,reach:.45,barrel:[-.1,.2,.165],
      gait:{sweep:.42*.64,duty:.64,lift:.035,toe:.01,flex:.7,bob:.006,roll:.045,pitch:.01,nod:.035,nodPhase:.4,grazeNeck:.75,grazeHead:.45,grazePitch:-.06},extra:{lidTuck:.6}};
  }

  // ---- Cattle -------------------------------------------------------------------------
  // A long deep barrel on a level topline, a dewlap swinging under the neck.
  const CATTLE=[
    {w:1.3,breed:'friesian',name:'a black-and-white Friesian cow'},
    {w:1.2,breed:'hereford',name:'a red Hereford cow'},
    {w:1,breed:'highland',name:'a shaggy Highland cow'},
    {w:1,breed:'jersey',name:'a doe-eyed Jersey cow'},
  ];
  function cattle(r,h,rnd){
    const T=r.T,C=pickW(rnd,CATTLE),breed=C.breed,hl=breed==='highland',hf=breed==='hereford',fr=breed==='friesian',je=breed==='jersey';
    const base=hl?pick(rnd,[0x6a3218,0x6a3218,0x7a4624,0x8a6a42,0x2e2420]):fr?0x262222:hf?0x6a2a14:0x8c5e36;
    const white=0xf0e8dc;
    // Herefords: white face, crest, brisket, belly and socks; Friesians in
    // bold patches; Jerseys shade darker at the shoulder and haunch.
    const paint=(x,y,z)=>{
      if(fr){if(y<.2||x>.84&&Math.abs(z)<.03)return white;if(x<.6&&mottle(x,y,z,8,h%113)>-.05)return white;return base;}
      if(hf&&(y<.2||y<.45&&Math.abs(z)<.13&&x>-.45||x>.36&&y<.6&&Math.abs(z)<.1||x>.47&&y>.82))return white;
      if(je)return mix(base,dark(base,.4),clamp(Math.abs(x-.05)*2.2-.6,0,1)*(y>.5?.6:.2)+(y<.2?.45:0));
      return mix(light(base,.05),dark(base,.16),clamp((.6-y)*2.2,0,1)*.7);
    };
    hoofedBones(r,{body:[0,.6,0],neck:[.36,.64,0],head:[.68,.74,0],jaw:[.82,.62,0],muzzle:[.91,.58,0],ear:[.685,.775,.085],tail:[-.66,.84,0],tail2:[-.7,.6,0]});
    // Highland coats hang long and shaggy, longest under the belly: every
    // other point of the surface pokes out, so the outline bristles.
    const shag=(seg,n,k)=>hl?(t,a)=>1+k*((Math.round(t*seg)+Math.round(a/TURN*n))%2?.5:-.5)*(.6+.8*fleck(t,a,seg))+k*2.4*Math.pow(Math.max(0,-Math.cos(a)),1.5):null;
    put(r,sweep(T,[[-.62,.71,0],[-.55,.69,0],[-.34,.655,0],[-.05,.625,0],[.2,.625,0],[.38,.635,0],[.49,.63,0]],[[.11,.1],[.2,.19],[.235,.215],[.26,.23],[.25,.215],[.215,.185],[.12,.1]],{n:16,seg:12,square:.12,bump:shag(12,16,.15)}),paint,'body');
    if(!hl){
      // A soft udder tucked between the hind legs.
      r.sphere(.07,[-.33,.41,0],0xe0a89c,'body',[1.1,.7,1],[0,0,0],8,5);
      for(const [x,z] of [[-.36,-.03],[-.36,.03],[-.3,-.03],[-.3,.03]])r.cone(.009,.03,[x,.37,z],0xd8948a,'body',[PI,0,0],4);
    }
    put(r,sweep(T,[[.34,.64,0],[.48,.69,0],[.6,.73,0],[.7,.77,0]],[[.21,.18],[.165,.135],[.13,.105],[.105,.09]],{n:12,seg:8,bump:shag(8,12,.13)}),paint,'body',{bone:'neck',from:[.38,.65,0],to:[.6,.74,0]});
    // The dewlap: a deep soft fold from the throat down to the brisket.
    put(r,sweep(T,[[.42,.47,0],[.53,.505,0],[.63,.575,0],[.7,.64,0]],[[.026,.022],[.042,.024],[.034,.022],[.015,.016]],{n:8,seg:4}),paint,'body',{bone:'neck',from:[.5,.49,0],to:[.64,.59,0]});
    // Broad head and wide wet muzzle; a Jersey's is ringed in pale hair.
    const muzzle=je?0x2e2624:hl?0x3a2a24:hf?0xd8b0a4:0x2e2826;
    const face=(x,y,z)=>{
      if(x>.862&&y<.658)return muzzle;
      if(je&&x>.85&&x<.868&&y<.69)return light(base,.5);
      if(hf&&x>.66)return white;
      if(fr&&x>.7&&Math.abs(z)<.028+(x-.7)*.1&&y>.64)return white;
      return paint(x,y,z);
    };
    put(r,sweep(T,[[.665,.825,0],[.71,.82,0],[.775,.765,0],[.835,.695,0],[.88,.63,0],[.897,.603,0]],[[.075,.1],[.094,.106],[.08,.078],[.066,.06],[.068,.07],[.053,.058]],{n:12,seg:8,square:.18,bump:hl?(t,a)=>1+.08*Math.sin(a*9+t*30)*Math.max(0,.6-t):null}),face,'neck',{bone:'head',from:[.67,.8,0],to:[.725,.775,0]});
    r.sphere(.042,[.868,.57,0],light(muzzle,.08),'jaw',[1.15,.45,1.1],[0,0,-.4],8,5);
    for(const s of [-1,1]){
      r.sphere(.013,[.904,.618,s*.033],0x2a1c1a,'head',[.5,1,1],[0,0,0],5,3);
      eye(r,'head',[.75,.77,s*.082],[.3,.22,s],.027,plainEye(s,[1,0,0],0x2a1a14,hf?white:paint(.75,.79,s*.082),.36));
      leaf(r,s<0?'earL':'earR',[[.685,.775,s*.085],[.68,.768,s*.14],[.675,.752,s*.195]],[.03,.042,.016],.011,[.8,.6,0],hf?base:paint,0xe0b0a0);
      if(hl)put(r,sweep(T,[[.68,.81,s*.06],[.68,.825,s*.16],[.69,.87,s*.26],[.72,.94,s*.31],[.75,.98,s*.32]],[.03,.026,.02,.013,.004],{n:5,seg:6}),(x,y,z)=>mix(0xe0d4b8,0x3a3028,clamp((Math.abs(z)-.22)*9,0,1)),'head');
      else if(!je)put(r,sweep(T,[[.68,.81,s*.06],[.685,.825,s*.1],[.7,.855,s*.12]],[.019,.014,.004],{n:5,seg:3}),0xddcfb0,'head');
    }
    // A Highland's fringe tumbles over its brow in three shaggy locks that
    // half hide its eyes, sun-bleached at the tips.
    if(hl)for(const lz of [-.045,0,.045])
      put(r,sweep(T,[[.7,.925,lz*.5],[.77,.905,lz],[.815,.845,lz*1.25],[.83,.79,lz*1.4]],[[.024,.034],[.03,.04],[.024,.032],[.006,.012]],{n:5,seg:3,bump:shag(3,5,.25)}),
        (x,y,z)=>mix(dark(base,.06),light(base,.2),clamp((x-.74)*9,0,1)),'head');
    const hoof=0x2e2622;
    const legs=hoofedLegs(r,{
      front:{x:.33,z:.125,hip:.58,junction:[[0,.62,.7,.1],[0,.4,.092]],upper:[[0,.42,[.09,.08]],[.004,.33,[.074,.066]],[0,.25,.06]],lower:[[0,.25,.06],[0,.16,.048],[0,.08,.052],[.012,.055,.052]],fet:2,hoof:[.048,.056,.058,.018],hoofColor:hoof,cleft:1,n:[9,7],bump:shag(3,9,.1)},
      hind:{x:-.44,z:.13,hip:.62,junction:[[-.01,.66,.7,.12],[.03,.42,.108]],upper:[[.03,.44,[.105,.09]],[0,.36,[.084,.072]],[-.06,.3,.062],[-.08,.28,.058]],lower:[[-.08,.28,.058],[-.07,.17,.048],[-.06,.08,.052],[-.048,.055,.052]],fet:2,hoof:[.048,.056,.058,-.042],hoofColor:hoof,cleft:1,n:[9,7],bump:shag(3,9,.1)},
    },paint);
    put(r,sweep(T,[[-.66,.84,0],[-.7,.76,0],[-.71,.66,0],[-.71,.59,0]],[.025,.018,.015,.014],{n:6,seg:4}),paint,'tail',{bone:'tail2',from:[-.7,.68,0],to:[-.71,.6,0]});
    put(r,sweep(T,[[-.71,.61,0],[-.71,.5,0],[-.705,.41,0]],[.014,.035,.012],{n:7,seg:4,bump:(t,a)=>1+.15*Math.sin(a*5+t*9)}),hl?light(base,.1):fr||hf?white:dark(base,.4),'tail2');
    return {name:C.name,breed,legs,reach:.95,barrel:[-.4,.4,.23],
      gait:{sweep:.78*.63,duty:.63,lift:.065,toe:.02,flex:.8,bob:.01,roll:.03,pitch:.01,nod:.05,nodPhase:.4,grazeNeck:1.45,grazeHead:-.8,grazePitch:-.06},extra:{tailHangs:true,restHoof:true,cud:true}};
  }

  // ---- Horse ----------------------------------------------------------------------------
  // Coats in deep, earthy values that stay rich under the tone mapping.
  const HORSES=[
    {w:3,breed:'bay',coat:0x5e2f1a,mane:0x1c1512,legs:0x221a16,name:'a bay horse'},
    {w:2,breed:'chestnut',coat:0x7a3c1c,mane:0xb8925e,legs:0x7a3c1c,name:'a chestnut horse with a flaxen mane'},
    {w:1.3,breed:'liver',coat:0x4a2416,mane:0x2c1810,legs:0x3a1c12,name:'a liver chestnut horse'},
    {w:1.2,breed:'grey',coat:0x5f5b56,mane:0xcfc9bf,legs:0x3c3936,grey:true,name:'a dappled grey horse'},
    {w:1.2,breed:'dun',coat:0x735530,mane:0x2a2019,legs:0x2a2019,dun:true,name:'a dun cob with a dark dorsal stripe'},
    {w:1,breed:'black',coat:0x262120,mane:0x171312,legs:0x262120,name:'a black horse'},
  ];
  function horse(r,h,rnd){
    const T=r.T,C=pickW(rnd,HORSES);
    const blaze=pick(rnd,['blaze','star','snip','none','blaze']);
    const socks=[0,1,2,3].map(()=>rnd()<(C.grey?0:.35)?.1+rnd()*.12:0);
    const cob=C.dun||rnd()<.2;
    const coat=(x,y,z)=>{
      if(C.grey&&mottle(x,y,z,26,h%71)>.25&&y>.5)return light(C.coat,.35);
      if(C.dun&&y>.9&&Math.abs(z)<.075&&x<.3)return C.mane;
      return mix(light(C.coat,.06),dark(C.coat,.14),clamp((.8-y)*2.5,0,1)*.6);
    };
    const legPaint=(x,y,z)=>{
      const sock=socks[(z<0?0:1)+(x>0?0:2)];
      if(sock&&y<sock)return 0xefe9de;
      if(y<.4&&C.legs!==C.coat)return C.legs;
      return coat(x,y,z);
    };
    hoofedBones(r,{body:[0,.76,0],neck:[.28,.8,0],head:[.59,1.26,0],jaw:[.7,1.06,0],muzzle:[.81,.975,0],ear:[.57,1.345,.045],tail:[-.51,.9,0],tail2:[-.59,.84,0]});
    put(r,sweep(T,[[-.54,.8,0],[-.48,.805,0],[-.32,.78,0],[-.05,.75,0],[.18,.77,0],[.34,.8,0],[.45,.8,0]],[[.13,.12],[.2,.19],[.222,.205],[.228,.2],[.225,.185],[.2,.16],[.095,.085]],{n:18,seg:12,round:.55}),coat,'body');
    // Neck: deep at the shoulder, arched along the crest.
    put(r,sweep(T,[[.22,.85,0],[.37,.99,0],[.49,1.13,0],[.575,1.235,0]],[[.22,.17],[.17,.125],[.13,.095],[.1,.08]],{n:14,seg:7}),coat,'body',{bone:'neck',from:[.26,.84,0],to:[.45,1.07,0]});
    // Long head: broad jowl, flat face, soft dark muzzle, maybe a blaze.
    const muzzle=dark(C.coat,C.grey?.3:.45);
    const face=(x,y,z)=>{
      if(blaze==='blaze'&&Math.abs(z)<.022&&x>.61)return 0xefe9de;
      if(blaze==='star'&&Math.abs(z)<.024&&x>.61&&x<.66&&y>1.17)return 0xefe9de;
      if(blaze==='snip'&&Math.abs(z)<.02&&x>.75&&y>1.0)return 0xefe9de;
      if(x>.76&&y<1.045)return muzzle;
      return coat(x,y,z);
    };
    put(r,sweep(T,[[.54,1.31,0],[.59,1.28,0],[.655,1.205,0],[.72,1.115,0],[.775,1.04,0],[.8,1.0,0]],[[.065,.07],[.095,.085],[.078,.066],[.06,.054],[.064,.06],[.046,.05]],{n:12,seg:8}),face,'neck',{bone:'head',from:[.55,1.3,0],to:[.61,1.25,0]});
    r.sphere(.034,[.772,.97,0],muzzle,'jaw',[1.2,.5,1.05],[0,0,-.6],6,4);
    for(const s of [-1,1]){
      r.sphere(.013,[.806,1.02,s*.034],0x1c1412,'head',[.6,1.3,.8],[0,0,.5],5,3);
      eye(r,'head',[.64,1.232,s*.07],[.2,.25,s],.026,plainEye(s,[.6,-.8,0],0x2a1a14,coat(.64,1.26,s*.07)));
      put(r,sweep(T,[[.57,1.34,s*.045],[.567,1.39,s*.051],[.574,1.44,s*.054]],[[.02,.026],[.021,.023],[.001,.002]],{n:6,seg:3,up:[1,0,0]}),(x,y,z)=>x>.574&&y<1.41?dark(C.coat,.45):coat(x,y,z),s<0?'earL':'earR');
    }
    // Mane falls along the crest in chunky locks; forelock over the brow.
    const locks=(t,a)=>1+.18*Math.sin(t*40+a*2)*Math.sin(a*3);
    put(r,sweep(T,[[.14,1.0,0],[.26,1.1,.012],[.4,1.21,.018],[.51,1.3,.018],[.565,1.345,.01]],[[.03,.03],[.05,.036],[.05,.035],[.042,.03],[.024,.02]],{n:7,seg:8,bump:locks,up:[-.7,.7,0]}),C.mane,'body',{bone:'neck',from:[.18,1.02,0],to:[.36,1.17,0]});
    put(r,sweep(T,[[.57,1.35,0],[.61,1.325,0],[.64,1.27,0]],[[.02,.034],[.022,.03],[.005,.01]],{n:6,seg:3,up:[1,0,0]}),C.mane,'head');
    // Tail: a full switch that swings from the dock.
    put(r,sweep(T,[[-.5,.9,0],[-.565,.885,0],[-.6,.84,0]],[.034,.042,.055],{n:7,seg:3,bump:locks}),C.mane,'tail');
    put(r,sweep(T,[[-.59,.86,0],[-.615,.72,0],[-.625,.56,0],[-.62,.42,0],[-.61,.34,0]],[[.052,.045],[.075,.055],[.088,.058],[.085,.05],[.05,.03]],{n:8,seg:6,bump:locks,up:[1,0,0],round:.35}),C.mane,'tail2');
    const legs=hoofedLegs(r,{
      front:{x:.3,z:.105,hip:.72,junction:[[0,.76,.75,.085],[0,.56,.075]],upper:[[0,.58,[.078,.068]],[.005,.5,[.068,.058]],[0,.4,[.05,.045]],[0,.335,[.048,.046]]],lower:[[0,.335,.047],[0,.22,.036],[.002,.125,.045],[.018,.08,.042]],fet:2,hoof:[.044,.056,.075,.024],hoofColor:0x2c2420,n:[10,6]},
      hind:{x:-.36,z:.115,hip:.76,junction:[[-.01,.8,.7,.11],[.025,.57,.1]],upper:[[.025,.6,[.1,.085]],[.01,.5,[.08,.068]],[-.05,.43,[.058,.05]],[-.09,.4,[.05,.045]]],lower:[[-.09,.4,.05],[-.08,.27,.036],[-.07,.125,.045],[-.055,.08,.042]],fet:2,hoof:[.044,.056,.075,-.048],hoofColor:0x2c2420,n:[10,6],jseg:3},
    },legPaint);
    // Cobs and duns grow soft feathering over the hoof.
    if(cob)for(const [x,z,i] of [[.3,-.105,0],[.3,.105,1],[-.43,-.115,2],[-.43,.115,3]])
      r.sphere(.05,[x+.008,.075,z],light(C.dun?0x8a7a68:C.mane,.3),'foot'+i,[1,.75,1],[0,0,0],6,3);
    return {name:C.name,breed:C.breed,legs,reach:.87,barrel:[-.34,.3,.2],
      gait:{sweep:.95*.62,duty:.62,lift:.1,toe:.022,flex:1.1,bob:.014,roll:.025,pitch:.012,nod:.07,nodPhase:.9,grazeNeck:1.6,grazeHead:-.9,grazePitch:-.07},extra:{tailHangs:true,restHoof:true}};
  }

  // ---- Dog ---------------------------------------------------------------------------------
  // The game's trot solves each leg by inverse kinematics: hips at .28 swing
  // about Z only, knees .14 below, paws .14 below the knees. We build to that
  // contract and pose the same solver here, so a posed dog matches the game's trot.
  // Legs are shaped in the solver's standing pose and carried back to the
  // straight bind pose, so a standing dog stands like a dog.
  const DOG_HIP=Math.acos(.245/.28),DOG_KNEE=PI-Math.acos(1-.245*.245/.0392);
  // Draw a part in the standing pose across two bones that turn about Z.
  // Each bone maps bind to pose as p = R(ang)(v - c) + d. Every vertex is
  // solved back to the bind pose so that, skinned with the rig's own blend
  // weight, it lands exactly where it was drawn: one seamless leg that
  // stands straight and bends softly at the joint.
  function skinPosed(r,geo,paint,A,B,blend){
    const {from:f,to:t}=blend,dx=t[0]-f[0],dy=t[1]-f[1],dd=dx*dx+dy*dy;
    const weight=(x,y)=>{const k=clamp(((x-f[0])*dx+(y-f[1])*dy)/dd,0,1);return k*k*(3-2*k);};
    const ca=Math.cos(A.ang),sa=Math.sin(A.ang),cb=Math.cos(B.ang),sb=Math.sin(B.ang);
    const ka=[A.d[0]-(ca*A.c[0]-sa*A.c[1]),A.d[1]-(sa*A.c[0]+ca*A.c[1])],kb=[B.d[0]-(cb*B.c[0]-sb*B.c[1]),B.d[1]-(sb*B.c[0]+cb*B.c[1])];
    const out=[0,0];
    const unskin=(px,py,w)=>{
      const C=(1-w)*ca+w*cb,S=(1-w)*sa+w*sb,kx=px-((1-w)*ka[0]+w*kb[0]),ky=py-((1-w)*ka[1]+w*kb[1]),q=C*C+S*S;
      out[0]=(C*kx+S*ky)/q;out[1]=(C*ky-S*kx)/q;
    };
    const pos=geo.attributes.position;
    for(let i=0;i<pos.count;i++){
      const px=pos.getX(i),py=pos.getY(i);let lo=0,hi=1;
      for(let k=0;k<16;k++){const w=(lo+hi)/2;unskin(px,py,w);if(weight(out[0],out[1])>w)lo=w;else hi=w;}
      unskin(px,py,(lo+hi)/2);pos.setXY(i,out[0],out[1]);
    }
    geo.computeVertexNormals();
    const col=typeof paint==='function'?(x,y,z)=>{const w=weight(x,y);return paint((1-w)*(ca*x-sa*y+ka[0])+w*(cb*x-sb*y+kb[0]),(1-w)*(sa*x+ca*y+ka[1])+w*(sb*x+cb*y+kb[1]),z);}:paint;
    return put(r,geo,col,A.bone,{bone:B.bone,from:f,to:t});
  }
  const DOGS=[
    {w:1.6,breed:'collie',base:0x9c5a22,saddle:0x5e3418,white:0xf2ebdf,tan:0x9c5a22,name:'a scruffy sable sheepdog'},
    {w:1.2,breed:'collie',base:0x262120,saddle:0x262120,white:0xf2ebdf,tan:0x262120,name:'a black-and-white sheepdog'},
    {w:1,breed:'collie',base:0x262120,saddle:0x262120,white:0xf2ebdf,tan:0x96542a,name:'a tricolour sheepdog'},
    {w:.8,breed:'collie',base:0x7a8088,saddle:0x7a8088,white:0xf2ebdf,tan:0x96542a,merle:0x2a2624,name:'a blue merle sheepdog'},
    {w:1,breed:'lurcher',base:0xa8804c,mask:0x3a2a20,name:'a fawn lurcher'},
    {w:.8,breed:'lurcher',base:0x8a6a48,stripe:0x3a2c22,white:0xe8dfd0,name:'a brindle lurcher'},
    {w:.7,breed:'lurcher',base:0x5e6066,white:0xe8e2d6,name:'a blue lurcher'},
    {w:.6,breed:'lurcher',base:0x262120,white:0xe8e2d6,name:'a black lurcher'},
    {w:1,breed:'hound',base:0xefe8dc,saddle:0x262120,white:0xefe8dc,tan:0x965a2c,name:'a floppy-eared tricolour hound'},
    {w:.8,breed:'hound',base:0xefe8dc,saddle:0xb88444,white:0xefe8dc,tan:0xb88444,name:'a lemon-and-white hound'},
    {w:.7,breed:'hound',base:0xefe8dc,saddle:0x7e3a1e,white:0xefe8dc,tan:0x7e3a1e,name:'a red-and-white hound'},
  ];
  function dog(r,h,rnd){
    const T=r.T,C=pickW(rnd,DOGS),breed=C.breed,hound=breed==='hound',lurcher=breed==='lurcher',collie=breed==='collie';
    // The lurcher is a lean sighthound: narrow, deep in the chest, long in the face.
    const thin=lurcher?.86:1,snout=hound?.03:lurcher?.034:0;
    r.bone('body',null,[0,.34,0]);r.bone('neck','body',[.19,.41,0]);r.bone('head','neck',[.29,.5,0]);r.bone('jaw','head',[.37,.475,0]);
    const earAt=hound?[.285,.565,.052]:lurcher?[.29,.575,.034]:[.285,.59,.038];
    r.bone('earL','head',[earAt[0],earAt[1],-earAt[2]]);r.bone('earR','head',earAt);
    r.bone('tail','body',[-.27,.4,0]);r.bone('tail2','tail',collie?[-.35,.35,0]:lurcher?[-.33,.33,0]:[-.31,.46,0]);
    // Coat paint: saddle, white blaze, bib, socks and tail tip, tan points
    // and brows. Legs are painted in the standing pose, so socks sit low.
    const brow=(x,y,z)=>Math.hypot(x-.336,y-.577,Math.abs(z)-.034)<.015;
    const paint=(x,y,z)=>{
      const white=C.white;
      if(collie){
        if(y<.075||x>.405||x>.3&&Math.abs(z)<.013&&y>.52||x>.13+(y-.28)*.8&&y<.5&&x<.34&&(x>.2||y<.34)||x<-.395&&y<.3)return white;
        if(C.merle&&mottle(x,y,z,22,h%53)>.4)return C.merle;
        if(C.tan!==C.base&&(x>.33&&y<.53||y<.19||brow(x,y,z)))return C.tan;
        return y>.42&&x<.14&&x>-.3?C.saddle:C.base;
      }
      if(lurcher){
        if(white&&(y<.05||x>.2&&x<.33&&y<.37&&y>.18&&Math.abs(z)<.05))return white;
        if(C.mask&&x>.41)return C.mask;
        // Brindle: a few upright tiger stripes over the body, wide enough for
        // the mesh to hold, and none on the thin legs where they would smudge.
        if(C.stripe&&y>.2&&Math.sin(x*34+Math.sin(y*20+z*9)*.8)>.55)return mix(C.base,C.stripe,.75);
        return mix(C.base,dark(C.base,.25),clamp((.36-y)*3,0,1)*.5);
      }
      if(y<.09||x>.4||Math.abs(z)<.014&&x>.3||x>.14&&y<.4&&y>.2&&x<.32||x<-.37)return white;
      if(x>.25&&y>.44)return brow(x,y,z)?light(C.tan,.3):C.tan;
      if(y>.35&&x>-.3&&x<.14)return C.saddle;
      if(y>.2&&y<.35&&x<-.12)return C.tan;
      return C.base;
    };
    const fluff=(t,a)=>1+.09*Math.sin(a*6+t*19)*Math.sin(t*23+a*2);
    // A deep chest, a tuck at the loin and a rounded rump; the lurcher keeps
    // a long level back over a deeper tuck.
    const body=lurcher
      ?[[[-.3,.393,0],[-.24,.388,0],[-.12,.393,0],[0,.372,0],[.1,.342,0],[.18,.35,0],[.245,.375,0]],[[.037,.034],[.074,.066],[.062,.056],[.086,.066],[.126,.074],[.108,.07],[.055,.046]]]
      :[[[-.3,.39,0],[-.24,.38,0],[-.13,.365,0],[0,.35,0],[.1,.335,0],[.18,.345,0],[.245,.37,0]],[[.04,.038],[.087,.076],[.09,.076],[.102,.081],[.125,.09],[.108,.08],[.055,.05]]];
    put(r,sweep(T,body[0],body[1],{n:12,seg:9,bump:collie?fluff:null}),paint,'body');
    // Neck, with a ruff for the sheepdog.
    put(r,sweep(T,[[.12,.37,0],[.2,.43,0],[.27,.49,0]],collie?[[.105,.092],[.088,.076],[.064,.055]]:[[.08,.07*thin],[.064,.055*thin],[.052,.047*thin]],{n:8,seg:4,bump:collie?(t,a)=>1+.12*Math.sin(a*7+t*11)*(1-t):null}),paint,'body',{bone:'neck',from:[.16,.4,0],to:[.25,.47,0]});
    // Head: domed skull, a clear stop, then the muzzle and a shiny nose.
    put(r,sweep(T,[[.235,.54,0],[.28,.555,0],[.322,.548,0],[.36,lurcher?.53:.523,0],[.4+snout*.5,.505,0],[.44+snout,.493,0],[.46+snout,.49,0]],
      [[.035,.035],[.07,.062*thin],[.072,.064*thin],[.052,.047*thin],[.039,.035*thin],[.031,.028*thin],[.022,.02]],{n:10,seg:6}),paint,'head');
    r.sphere(.02,[.463+snout,.498,0],0x1c1614,'head',[.85,.8,1.15],[0,0,0],6,3);
    // The lower jaw and tongue hang from the jaw bone, so the dog can pant;
    // a dark mouth shows between them. The tongue lies along the lower jaw,
    // hidden while the mouth is shut and pink in it once the dog pants.
    put(r,sweep(T,[[.375,.474,0],[.442+snout,.474,0]],[[.011,.02*thin],[.006,.01]],{n:4,seg:1}),0x4a2226,'head');
    put(r,sweep(T,[[.37,.47,0],[.41+snout*.6,.462,0],[.443+snout,.469,0]],[[.014,.025*thin],[.012,.02*thin],[.008,.013]],{n:5,seg:2}),paint,'jaw');
    put(r,sweep(T,[[.385,.474,0],[.42+snout*.6,.472,0],[.444+snout,.468,0]],[[.005,.013*thin],[.005,.015*thin],[.004,.011]],{n:4,seg:2}),0xd46874,'jaw');
    for(const s of [-1,1]){
      eye(r,'head',[.343,.55,s*.042*thin],[.5,.25,s],.02,{fwd:[1,0,0],iris:0x3a2214});
      const ear=s<0?'earL':'earR',z=s*earAt[2],[ex,ey]=earAt;
      if(hound)leaf(r,ear,[[ex,ey+.005,z],[ex+.005,ey-.025,z+s*.02],[ex+.015,ey-.075,z+s*.026],[ex+.025,ey-.11,z+s*.02]],[.024,.032,.034,.018],.009,[0,0,s],C.tan,dark(C.tan,.2),4);
      // Rose ears fold back along the skull.
      else if(lurcher)leaf(r,ear,[[ex,ey,z],[ex-.02,ey+.014,z+s*.01],[ex-.045,ey+.01,z+s*.014],[ex-.06,ey-.004,z+s*.012]],[.02,.024,.017,.005],.008,[0,1,s*.5],dark(C.base,.2),dark(C.base,.4),4);
      else leaf(r,ear,[[ex,ey-.008,z],[ex+.004,ey+.03,z+s*.01],[ex+.016,ey+.05,z+s*.012],[ex+.036,ey+.042,z+s*.012]],[.031,.027,.017,.006],.01,[1,0,s*.7],C.base===C.white?C.tan:dark(C.base,.15),dark(C.base,.3),4);
    }
    // Tail: the sheepdog's low plume, the hound's high whip, the lurcher's
    // long low sweep that curls up at the tip.
    if(collie)put(r,sweep(T,[[-.265,.41,0],[-.32,.385,0],[-.37,.33,0],[-.4,.28,0],[-.415,.265,0],[-.425,.28,0]],[.028,.04,.045,.036,.022,.01],{n:6,seg:4,bump:fluff}),paint,'tail',{bone:'tail2',from:[-.31,.38,0],to:[-.37,.32,0]});
    else if(hound)put(r,sweep(T,[[-.27,.41,0],[-.315,.44,0],[-.35,.5,0],[-.355,.555,0]],[.02,.016,.011,.004],{n:5,seg:4}),paint,'tail',{bone:'tail2',from:[-.3,.43,0],to:[-.33,.47,0]});
    else put(r,sweep(T,[[-.27,.4,0],[-.315,.36,0],[-.345,.28,0],[-.345,.21,0],[-.325,.18,0]],[.017,.014,.011,.008,.004],{n:5,seg:5}),paint,'tail',{bone:'tail2',from:[-.3,.37,0],to:[-.335,.32,0]});
    // Legs: hip → knee → paw, exactly the lengths the trot solver expects,
    // each drawn as one smooth tube in the standing pose.
    const legs=[];
    [[.16,-.06,0],[.16,.06,1],[-.17,-.064,2],[-.17,.064,3]].forEach(([x,z,i])=>{
      const b=x>0?1:-1,hipA=-b*DOG_HIP,shin=b*(DOG_KNEE-DOG_HIP);
      const hip=r.bone('hip'+i,null,[x,.28,z]),knee=r.bone('knee'+i,'hip'+i,[x,.14,z]);
      // The wrist bone carries nothing; it keeps the paw at knee.children[1],
      // where the game's trot looks for it.
      r.bone('wrist'+i,'knee'+i,[x,.06,z]);const paw=r.bone('paw'+i,'knee'+i,[x,0,z]);
      const kx=x+.14*Math.sin(hipA),ky=.28-.14*Math.cos(hipA);
      const A={bone:'hip'+i,ang:hipA,c:[x,.28],d:[x,.28]},B={bone:'knee'+i,ang:shin,c:[x,.14],d:[kx,ky]};
      // Front: a straight column from shoulder to paw with a soft elbow.
      // Hind: a strong thigh to the stifle, then down to a neat hock.
      const path=b>0?[[x+.012,.37,z],[x+.004,.28,z],[x-.012,.19,z],[x-.006,.12,z],[x-.002,.07,z],[x+.004,.036,z]]
        :[[x-.025,.37,z],[x-.004,.28,z],[x+.035,.2,z],[kx-.006,ky-.01,z],[x-.012,.105,z],[x-.028,.07,z],[x-.01,.036,z]];
      const radii=(b>0?[.046,.043,.04,.03,.026,.026]:[.058,.056,.047,.036,.029,.025,.025]).map(v=>v*thin);
      skinPosed(r,sweep(T,path,radii,{n:b>0?7:8,seg:b>0?5:6,up:[1,0,0]}),paint,A,B,{from:[x,.14+(b>0?.05:.04),z],to:[x,.14-.025,z]});
      // The haunch rides the body and wraps the top of the thigh, so the leg
      // steps out from under it without a crease.
      if(b<0)put(r,sweep(T,[[x-.035,.405,z*.45],[x-.022,.345,z*.8],[x-.006,.275,z]],[[.085*thin,.068*thin],[.075*thin,.067*thin],[.066*thin,.062*thin]],{n:7,seg:2,up:[1,0,0],bump:collie?fluff:null}),paint,'body',{bone:'hip'+i,from:[x-.03,.4,z],to:[x-.01,.3,z]});
      r.sphere(.035*thin,[x+.013,.015-.035,z],(x2,y2,z2)=>paint(x2,.01,z2),'paw'+i,[1.35,.62,1.08],[0,0,0],5,3);
      Object.assign(hip.userData,{knee,paw,phase:(x>0)===(z<0)?0:.5,bend:b});
      legs.push(hip);
    });
    return {name:C.name,breed,legs};
  }
  // The same foot path and leg solver as the game's trot, inlined so
  // nothing is allocated per frame. Paws stay level and flick as they swing.
  function dogLegs(legs,cyc,moving){
    for(let i=0;i<4;i++){
      const hip=legs[i],u=hip.userData;
      let p=cyc+u.phase;p-=Math.floor(p);
      let x=0,y=0,k=0;
      if(moving){if(p<.6)x=.095-p/.6*.19;else{k=(p-.6)/.4;x=-.095+k*.19;y=Math.sin(PI*k)*.085;}}
      y-=.245;
      const d=Math.min(.28-1e-5,Math.max(1e-5,Math.hypot(x,y)));
      const hipA=Math.atan2(x,-y)-u.bend*Math.acos(d/.28),kneeA=u.bend*(PI-Math.acos(1-d*d/.0392));
      hip.rotation.set(0,0,hipA);u.knee.rotation.z=kneeA;
      u.paw.rotation.z=-(hipA+kneeA)-(k>0?Math.sin(PI*k)*(u.bend>0?.9:.5):0);
    }
  }
  function poseDog(g,state,time,motion){
    const rig=g.userData.dogRig,moving=!!state.moving,cyc=moving?(state.stride||0)/TURN:0,ph=rig.phase;
    dogLegs(rig.legs,cyc,moving);
    rig.body.position.y=rig.bodyY+(moving?Math.sin(cyc*PI*4)*.007:Math.sin(time*2.2+ph)*.003*motion);
    rig.neck.rotation.z=moving?Math.sin(cyc*TURN)*.04:Math.sin(time*1.2)*.08*motion;
    rig.neck.rotation.y=Math.sin(time*.8+ph)*.18*motion;
    rig.head.rotation.x=moving?0:Math.sin(time*.45+ph)*.12*motion;
    // A dog at rest pants now and then: jaw open, tongue out, quick breaths.
    const pant=moving?.35:smooth(-.3,.4,Math.sin(time*.23+ph))*motion;
    rig.jaw.rotation.z=-pant*(.2+.07*Math.sin(time*(moving?10:8)+ph));
    for(let i=0;i<2;i++)rig.ears[i].rotation.z=moving?Math.sin(cyc*TURN+i)*.12:twitch(time*1.1+i*2+ph,20)*.3*motion;
    rig.tail.rotation.y=Math.sin(time*(moving?6:3))*.4*motion;
    rig.tail2.rotation.y=Math.sin(time*(moving?6:3)-.8)*.3*motion;
  }

  // ---- Cat --------------------------------------------------------------------------------
  const CATS=[
    {w:1.4,coat:'orange',base:0xc0732e,stripe:0x8a4a1c,name:'a ginger tom'},
    {w:1.3,coat:'tabby',base:0x8c6c48,stripe:0x4a3624,name:'a brown tabby'},
    {w:1,coat:'silver',base:0x828284,stripe:0x2a2a2e,name:'a silver tabby'},
    {w:.9,coat:'grey',base:0x646368,stripe:0x3a3a3e,name:'a grey tabby'},
    {w:1,coat:'tuxedo',base:0x2a2828,name:'a tuxedo cat'},
    {w:1,coat:'calico',base:0xf2ebe0,name:'a calico cat'},
    {w:1,coat:'black',base:0x2a2626,name:'a sleek black cat'},
  ];
  function cat(r,h,rnd){
    const T=r.T,C=pickW(rnd,CATS),coat=C.coat,base=C.base,stripe=C.stripe;
    const eyeCol=pick(rnd,[0x7a9a40,0xb88a30,0x9c9a3c,0x5a8c88]);
    const white=0xf4eee4;
    const bib=(x,y,z)=>z>.035&&y<.2&&y>.03&&Math.abs(x)<.05-(y-.1)*.2;
    // Tabbies get a darker back and a ringed tail; broad shapes only, so
    // the pattern stays clean on a small, low-poly cat.
    const paint=(x,y,z)=>{
      if(coat==='tuxedo'&&(bib(x,y,z)||y<.03||z>.085&&y<.228))return white;
      if(coat==='calico'){const m=mottle(x,y,z,20,h%61);if(m>.4)return 0xc8762e;if(m<-.5)return 0x2e2826;return white;}
      if(stripe&&(bib(x,y,z)||z>.085&&y<.225))return light(base,.45);
      if(stripe&&y<.045&&(x>.02||z<-.07)&&Math.sin((x-z)*62)>.1)return stripe;
      if(stripe&&Math.abs(x)>.04&&y<.2&&Math.sin(y*40+z*16)>.25)return mix(base,stripe,.85);
      if(stripe)return mix(base,stripe,clamp(-z*6+(y>.2?.3:0),0,.75));
      return base;
    };
    r.bone('body',null,[0,.07,-.02]);r.bone('neck','body',[0,.18,.035]);r.bone('head','neck',[0,.225,.05]);
    r.bone('earL','head',[-.035,.28,.048]);r.bone('earR','head',[.035,.28,.048]);
    r.bone('tail','body',[0,.03,-.085]);r.bone('tail1','tail',[.075,.018,-.1]);r.bone('tail2','tail1',[.12,.02,-.02]);
    // Sitting body: broad haunches rising to a neat, fluffy chest.
    put(r,sweep(T,[[0,.04,-.035],[0,.09,-.016],[0,.15,.018],[0,.195,.04]],[[.07,.08],[.076,.084],[.064,.066],[.048,.05]],{n:12,seg:6,up:[0,0,1],round:.35}),paint,'body',{bone:'neck',from:[0,.16,.03],to:[0,.2,.04]});
    for(const s of [-1,1]){
      r.sphere(.056,[s*.052,.055,-.018],paint,'body',[.8,.95,1.3],[0,0,0],8,5);
      r.sphere(.023,[s*.05,.012,.052],paint,'body',[1,.6,1.5],[0,0,0],5,3);
      put(r,sweep(T,[[s*.026,.14,.05],[s*.029,.08,.068],[s*.03,.024,.076]],[.026,.023,.021],{n:6,seg:3,up:[0,0,1]}),paint,'body');
      r.sphere(.024,[s*.03,.012,.084],(x,y,z)=>coat==='tuxedo'?white:paint(x,y,z),'body',[1.05,.62,1.3],[0,0,0],6,4);
    }
    // Head: round skull, fluffy cheeks, whisker pads and a pink nose; a
    // tabby wears the classic stripes on its brow.
    r.sphere(.06,[0,.242,.055],(x,y,z)=>stripe&&y>.262&&z>.07&&Math.abs(x)<.04&&Math.sin(x*150)>.2?stripe:paint(x,y,z),'head',[1.12,.92,.95],[0,0,0],11,8);
    const pad=coat==='black'?0x3a3434:light(base,.45);
    for(const s of [-1,1]){
      r.sphere(.032,[s*.038,.222,.066],paint,'head',[1,.8,.9],[0,0,0],5,4);
      r.sphere(.017,[s*.013,.216,.1],pad,'head',[1,.85,.9],[0,0,0],5,3);
      eye(r,'head',[s*.025,.25,.096],[s*.42,.1,1],.018,{fwd:[0,0,1],iris:eyeCol,pupil:[1,1.3,.6],rim:0x1e1814,seg:[8,6]});
      // Ears are little cones, so they read as triangles from every side.
      r.add(new T.ConeGeometry(.028,.05,5),paint,[s*.043,.3,.045],[-.12,0,-s*.3],[1,1,.55],s<0?'earL':'earR');
      r.add(new T.ConeGeometry(.018,.034,5),0xd8928e,[s*.041,.295,.052],[-.12,0,-s*.3],[1,1,.4],s<0?'earL':'earR');
    }
    r.sphere(.013,[0,.204,.094],pad,'head',[1,.7,.8],[0,0,0],5,3);
    r.sphere(.008,[0,.228,.11],coat==='black'||coat==='tuxedo'?0x3a2c2c:0xd48888,'head',[1.3,.75,.8],[0,0,0],5,3);
    // Tail curls round the paws on the ground.
    put(r,sweep(T,[[0,.035,-.085],[.045,.02,-.105],[.075,.018,-.1],[.105,.018,-.06]],[.021,.02,.019,.018],{n:7,seg:5,up:[0,1,0]}),paint,'tail',{bone:'tail1',from:[.05,.02,-.105],to:[.08,.018,-.095]});
    put(r,sweep(T,[[.085,.018,-.095],[.115,.019,-.04],[.12,.021,.02],[.1,.024,.06]],[.018,.017,.015,.011],{n:7,seg:5,up:[0,1,0]}),paint,'tail1',{bone:'tail2',from:[.117,.019,-.035],to:[.12,.02,.0]});
    return {name:C.name,breed:coat};
  }
  function poseCat(g,state,time,motion){
    const u=g.userData,R=u.rig,ph=u.phase||0;
    const swish=Math.sin(time*1.1+ph)*.6+Math.sin(time*.37+ph*2)*.4;
    R.tail.rotation.set(0,swish*.35*motion,0);
    R.tail1.rotation.set(0,swish*.25*motion,0);
    R.tail2.rotation.set(-twitch(time*1.9+ph,6)*.5*motion,Math.sin(time*2.2+ph)*.3*motion,0);
    R.neck.rotation.set(Math.sin(time*.4+ph)*.06*motion,Math.sin(time*.27+ph)*.45*motion,0);
    R.head.rotation.set(0,0,Math.sin(time*.23+ph*1.7)*.12*motion);
    R.ears[0].rotation.set(0,0,-twitch(time*1.3+ph,30)*.4*motion);
    R.ears[1].rotation.set(0,0,twitch(time*1.1+ph+1,30)*.4*motion);
    R.body.rotation.x=Math.sin(time*1.5+ph)*.012*motion;
  }

  // ---- Hen and rooster ----------------------------------------------------------------------
  const HENS=[
    {w:2,breed:'white',body:0xefe9dc,wing:0xe2d9c6,tail:0xeae2d2,legs:0xe0aa40,name:'a plump white hen'},
    {w:2.5,breed:'russet',body:0xa3572a,wing:0x87451f,tail:0x2c2420,hackle:0xbe7434,legs:0xdca040,name:'a busy russet hen'},
    {w:1.2,breed:'black',body:0x29272c,wing:0x2e3230,tail:0x1e2a26,legs:0x55555a,name:'a glossy black hen'},
    {w:1.2,breed:'sussex',body:0xefe9dc,wing:0xe4dbca,tail:0x2a2624,legs:0xe2c89a,collar:0x3a3532,name:'a Light Sussex hen'},
    {w:1.2,breed:'speckled',body:0x6a3620,wing:0x5a2e1c,tail:0x221c1a,legs:0xe0d2b8,speckle:0xf2ebdf,name:'a speckled hen'},
    {w:1.3,breed:'buff',body:0xc08a40,wing:0xae7836,tail:0x9a6a30,hackle:0xcc9848,legs:0xe8d2a8,name:'a buff Orpington hen'},
  ];
  // Roosters wear a cape of hackle and saddle feathers that stands out from
  // the body, and sickles with a green sheen (or pure white).
  const ROOSTERS=[
    {w:2,breed:'red',body:0x95391c,wing:0x692a16,tail:0x1d2e2a,hackle:0xd88a2a,saddle:0xc0702a,legs:0xdca040,sheen:0x2e6a5a,name:'a red rooster'},
    {w:1.6,breed:'golden',body:0x2a2422,wing:0x8a5a22,tail:0x1d2e2a,hackle:0xdca848,saddle:0xd0943a,legs:0x8a8a86,sheen:0x2e6a5a,name:'a golden rooster'},
    {w:1,breed:'white',body:0xefe9dc,wing:0xe2d9c6,tail:0x1d2622,hackle:0xefe6d4,collar:0x2a2624,saddle:0xe8dcc0,legs:0xe0c890,sheen:0x2e6a5a,name:'a white rooster with a black-laced cape'},
    {w:.9,breed:'black',body:0x221f22,wing:0x2a2a2e,tail:0x1a2622,hackle:0xa65a28,saddle:0x8e4c22,legs:0x55555a,sheen:0x2e6a5a,name:'a black rooster with a copper cape'},
  ];
  function poultry(r,h,rnd,rooster){
    const T=r.T,C=pickW(rnd,rooster?ROOSTERS:HENS);
    const plain=(x,y,z)=>mix(C.body,light(C.body,.12),clamp((.15-y)*6,0,1));
    const paint=C.speckle?(x,y,z)=>fleck(x,y,z)>.78?mix(C.body,C.speckle,.5):plain(x,y,z):plain;
    // The rooster stands taller and prouder on longer legs.
    const lift=rooster?.035:0,Y=y=>y+lift;
    const hy=Y(.285),hz=.095;
    // A Light Sussex and the white rooster wear a cape of black-striped
    // hackle round the base of the neck and over the shoulders: dark
    // streaks laced with the body colour.
    const cape=(x,y,z,base)=>C.collar&&y>Y(.2)&&Math.hypot(x,z-.075)<.075&&fleck(x,y,z)>.35?C.collar:base;
    r.bone('body',null,[0,Y(.12),0]);r.bone('neck','body',[0,Y(.19),.06]);r.bone('head','neck',[0,Y(.27),.09]);
    r.bone('beak','head',[0,hy-.011,hz+.055]);
    r.bone('tail','body',[0,Y(.19),-.09]);
    r.bone('wingL','body',[-.075,Y(.17),.03]);r.bone('wingR','body',[.075,Y(.17),.03]);
    const legs=[];
    for(const [s,i] of [[-1,0],[1,1]]){
      const hip=[s*.034,Y(.1),.008],knee=[s*.036,.058+lift*.5,-.01],foot=[s*.036,.018,.006];
      legs.push(legBones(r,i,hip,knee,foot,-1,i*.5,false));
      // Feathered drumstick, scaly shank, three toes forward and one back.
      r.sphere(.031,[s*.037,Y(.09),-.004],paint,'hip'+i,[.85,1.1,1],[0,0,0],6,4);
      put(r,sweep(T,[knee,lerp3(knee,foot,.5),foot],[.009,.0075,.007],{n:5,seg:2,up:[0,0,1]}),C.legs,'knee'+i);
      for(const [dx,dz] of [[-.022,.03],[0,.038],[.022,.03],[0,-.022]])
        put(r,sweep(T,[[foot[0],.008,foot[2]],[foot[0]+dx,.004,foot[2]+dz]],[.0055,.004],{n:3,seg:1,up:[0,1,0]}),C.legs,'foot'+i);
      if(rooster)r.cone(.005,.018,[s*.037,.05,-.02],C.legs,'knee'+i,[-PI/2+.3,0,0],4);
    }
    // Plump egg of a body: tail end high, breast full and forward.
    const breast=rooster?.012:0;
    put(r,sweep(T,[[0,Y(.205),-.13],[0,Y(.175),-.085],[0,Y(.15),-.02],[0,Y(.152)+breast,.04],[0,Y(.178)+breast*2,.085],[0,Y(.2)+breast*2,.1]],[[.035,.03],[.075,.078],[.09,.092],[.086,.086],[.06,.062],[.03,.03]],{n:12,seg:7}),(x,y,z)=>cape(x,y,z,paint(x,y,z)),'body');
    const hackle=C.hackle||C.body;
    put(r,sweep(T,[[0,Y(.18),.06],[0,Y(.23),.083],[0,Y(.27),.09]],rooster?[[.05,.048],[.04,.038],[.032,.03]]:[[.046,.044],[.036,.034],[.03,.028]],{n:7,seg:4,bump:rooster?(t,a)=>1+.14*Math.max(0,Math.sin(a*9))*t:null}),(x,y,z)=>cape(x,y,z,C.hackle?hackle:paint(x,y,z)),'body',{bone:'neck',from:[0,Y(.19),.06],to:[0,Y(.245),.085]});
    // The rooster's saddle hackles spill over his back towards the tail.
    if(rooster)put(r,sweep(T,[[0,Y(.215),-.005],[0,Y(.225),-.05],[0,Y(.215),-.1],[0,Y(.19),-.125]],[[.024,.05],[.03,.062],[.026,.05],[.01,.02]],{n:7,seg:4,bump:(t,a)=>1+.16*Math.max(0,Math.sin(a*7+t*9))}),C.saddle,'body');
    // Head, beak, comb, wattles and a bright orange eye.
    const crown=rooster||C.hackle?hackle:paint(0,hy,hz);
    r.sphere(.034,[0,hy,hz],(x,y,z)=>y<hy-.018&&z<hz?cape(x,y,z,crown):crown,'head',[.95,1,1.1],[0,0,0],8,6);
    r.cone(.012,.032,[0,hy-.006,hz+.04],0xe2aa44,'head',[PI/2+.3,0,0],6);
    const comb=0xd02e2a;
    const peaks=rooster?[[.028,-.016,.017],[.037,.002,.02],[.04,.02,.019],[.034,.037,.016],[.024,.05,.012]]:[[.028,.004,.012],[.032,.018,.013],[.026,.032,.01]];
    for(const [y,z,s] of peaks)r.sphere(s,[0,hy+y,hz+z-.012],comb,'head',[.45,1,1],[0,0,0],5,3);
    const wattle=rooster?1.6:1;
    for(const s of [-1,1]){
      r.sphere(.01*wattle,[s*.007,hy-.034*Math.sqrt(wattle),hz+.03],comb,'head',[.7,1.4,.9],[0,0,0],5,4);
      r.sphere(.007,[s*.03,hy-.012,hz-.008],rooster?comb:0xefe6d8,'head',[.5,1.1,1],[0,0,0],4,3);
      eye(r,'head',[s*.028,hy+.007,hz+.012],[s,.12,.4],.0105,{fwd:[0,0,1],iris:0xd88a28,pupil:[.55,.55,.6],seg:[6,4]});
    }
    // Wings folded flush along the sides.
    for(const s of [-1,1])
      leaf(r,s<0?'wingL':'wingR',[[s*.07,Y(.18),.045],[s*.088,Y(.165),0],[s*.084,Y(.155),-.06],[s*.058,Y(.165),-.11]],[.028,.046,.04,.012],.013,[s,0,0],
        (x,y,z)=>C.collar&&z<-.095?C.collar:Math.sin(z*90)>.6?dark(C.wing,.18):C.speckle&&fleck(x,y,z)>.78?mix(C.wing,C.speckle,.5):C.wing,null);
    // Tail: a perky fan for hens; long arching sickles for the rooster.
    if(rooster){
      for(const [s,up,len] of [[-.012,1,1],[.012,.9,.95],[-.032,.6,.75],[.032,.6,.75]])
        put(r,sweep(T,[[s*.4,Y(.19),-.085],[s,Y(.25)+.05*up,-.12-.03*len],[s*1.2,Y(.27)+.06*up,-.18-.04*len],[s*1.4,Y(.22)+.04*up,-.24-.05*len],[s*1.5,Y(.15),-.26-.04*len]],[[.005,.015],[.006,.026],[.006,.026],[.005,.02],[.002,.005]],{n:4,seg:6,up:[1,0,0]}),
          (x,y,z)=>mix(C.tail,C.sheen,clamp((y-.25)*6,0,.5)),'tail');
    }else{
      for(const s of [0,-.022,.022])
        leaf(r,'tail',[[s*.5,Y(.19),-.09],[s,Y(.235),-.12],[s*1.3,Y(.275),-.13]],[.03,.034,.012],.012,[s*8,0,-1],C.tail,null);
    }
    return {name:C.name,breed:C.breed,legs};
  }
  function posePoultry(g,state,time,motion){
    const u=g.userData,R=u.rig,ph=u.phase||0,cyc=(state.stride||0)/TURN;
    const w=gaitWeight(u,!!state.moving,time),peck=clamp(state.graze||0,0,1),still=motion*(1-w);
    // To peck, the bird crouches on bent legs and tips right over.
    const crouch=peck*R.crouch;
    for(let i=0;i<2;i++)stepLeg(R.legs[i],cyc,w,R.gait,-crouch,0);
    // The head holds still in space while the body walks on beneath it,
    // then thrusts forward to catch up: once for every step.
    const q=cyc*2-Math.floor(cyc*2),hold=w*.27*(q<.72?.5-q/.72:(q-.72)/.28-.5);
    // At rest it looks about in quick, stepped turns, the way a chicken does:
    // each glance snaps round in a few frames, then holds.
    const beat=time*1.4+ph,b=Math.floor(beat),snap=smooth(0,.12,beat-b);
    const look=glance(b,snap,12.9898)*.7*still*(1-peck),tilt=glance(b,snap,4.1)*.2*still;
    R.body.position.y=R.bodyY-crouch-Math.abs(Math.sin(cyc*TURN))*.006*w+Math.sin(time*2+ph)*.0015*motion;
    R.body.rotation.set(peck*.55+.04*w,0,Math.sin(cyc*TURN)*.08*w);
    R.neck.rotation.set(peck*1.05+hold+Math.sin(time*.9+ph)*.05*still,0,0);
    R.head.rotation.set(-hold-peck*.25,look,tilt);
    R.tail.rotation.set(Math.sin(cyc*TURN*2)*.06*w,Math.sin(time*1.3+ph)*.08*motion,0);
    for(let i=0;i<2;i++)R.wings[i].rotation.set(0,0,(i?1:-1)*(.04*w+twitch(time*.7+ph+i,40)*.3*motion));
  }

  // ---- Duck ----------------------------------------------------------------------------------
  const DUCKS=[
    {w:3,breed:'drake',name:'a mallard drake'},
    {w:3,breed:'mallard',name:'a mallard duck'},
    {w:2,breed:'pekin',name:'a white farmyard duck'},
    {w:1.2,breed:'cayuga',name:'a black Cayuga duck'},
  ];
  function duck(r,h,rnd){
    const T=r.T,C=pickW(rnd,DUCKS),breed=C.breed;
    const drake=breed==='drake',pekin=breed==='pekin',cayuga=breed==='cayuga';
    const body=pekin?0xf2ede0:drake?0xc9c4ba:cayuga?0x1e2022:0x7e5c3e;
    const paint=(x,y,z)=>{
      if(pekin)return mix(0xf4efe4,0xe2dacb,clamp((.09-y)*10,0,1));
      if(cayuga)return mix(0x26292a,0x17191a,clamp((.12-y)*8,0,1));
      if(drake){if(x>.06&&y<.16)return 0x74402e;if(x<-.09)return 0x2a2826;return y>.13?0xa29c92:body;}
      return Math.sin(x*120+Math.sin(z*90)*2)*Math.sin(z*110)>.3?0x644630:body;
    };
    const head=pekin?0xf4efe4:drake?0x266640:cayuga?0x1c3a30:0x86664a;
    r.bone('body',null,[0,.1,0]);r.bone('neck','body',[.085,.14,0]);r.bone('head','neck',[.11,.2,0]);r.bone('tail','body',[-.12,.12,0]);
    r.bone('wingL','body',[.04,.13,-.05]);r.bone('wingR','body',[.04,.13,.05]);
    const legs=[];
    for(const [s,i] of [[-1,0],[1,1]]){
      const hip=[0,.065,s*.03],knee=[-.005,.035,s*.032],foot=[0,.012,s*.034];
      legs.push(legBones(r,i,hip,knee,foot,-1,i*.5,true));
      const leg=cayuga?0x2e2c2a:0xe28a36;
      put(r,sweep(T,[hip,knee,foot],[.008,.007,.006],{n:5,seg:2,up:[1,0,0]}),leg,'hip'+i,{bone:'knee'+i,from:[0,.045,0],to:[0,.03,0]});
      put(r,sweep(T,[[0,.008,s*.034],[.03,.004,s*.034]],[[.003,.022],[.003,.02]],{n:6,seg:2,up:[0,1,0]}),leg,'foot'+i);
    }
    put(r,sweep(T,[[-.15,.14,0],[-.1,.115,0],[0,.1,0],[.07,.105,0],[.115,.125,0]],[[.018,.02],[.052,.06],[.066,.074],[.062,.066],[.03,.034]],{n:12,seg:8}),paint,'body');
    put(r,sweep(T,[[.07,.12,0],[.1,.17,0],[.112,.21,0]],[.036,.03,.028],{n:8,seg:4}),(x,y,z)=>drake&&y>.155&&y<.165?0xf2eee6:y>.16?head:paint(x,y,z),'body',{bone:'neck',from:[.085,.14,0],to:[.105,.19,0]});
    r.sphere(.036,[.12,.225,0],head,'head',[1.2,.95,.92],[0,0,0],9,7);
    put(r,sweep(T,[[.15,.222,0],[.18,.212,0],[.205,.205,0]],[[.011,.02],[.008,.019],[.006,.016]],{n:7,seg:3,round:.4}),pekin?0xeea030:drake?0xc6be48:cayuga?0x2a2c2a:0xc4863a,'head');
    for(const s of [-1,1])eye(r,'head',[.135,.235,s*.03],[.2,.25,s],.01,{fwd:[1,0,0],iris:0x1e1612,seg:[6,5]});
    const speculum=cayuga?0x2a5048:0x3a5aa8;
    for(const s of [-1,1])leaf(r,s<0?'wingL':'wingR',[[.05,.135,s*.06],[-.01,.14,s*.07],[-.07,.135,s*.062],[-.12,.14,s*.035]],[.03,.038,.03,.01],.011,[0,0,s],
      (x,y,z)=>!pekin&&x>-.05&&x<-.01&&y<.135?speculum:pekin?0xe8e2d4:drake?0x948e84:cayuga?0x222426:0x74563a,null);
    put(r,sweep(T,[[-.12,.13,0],[-.16,.15,0],[-.18,.165,0]],[[.012,.03],[.01,.025],[.004,.006]],{n:6,seg:3}),drake?0x2a2826:paint(-.1,.12,0),'tail');
    if(drake)put(r,sweep(T,[[-.15,.15,0],[-.155,.18,0],[-.14,.19,0],[-.132,.18,0]],[.004,.004,.0035,.002],{n:4,seg:5}),0x1a1a1a,'tail');
    return {name:C.name,breed,legs};
  }
  function poseDuck(g,state,time,motion){
    const u=g.userData,R=u.rig,ph=u.phase||0,cyc=(state.stride||0)/TURN;
    const w=gaitWeight(u,!!state.moving,time);
    for(let i=0;i<2;i++)stepLeg(R.legs[i],cyc,w,R.gait,0,0);
    R.body.rotation.set(Math.sin(cyc*TURN)*.1*w,0,Math.sin(time*1.3+ph)*.03*motion);
    R.neck.rotation.set(0,Math.sin(time*.6+ph)*.3*motion,Math.sin(time*2.1+ph)*.05*motion+w*Math.sin(cyc*TURN*2)*.08);
    R.head.rotation.set(0,Math.sin(time*1.4+ph)*.2*motion,0);
    R.tail.rotation.set(0,(Math.sin(time*3+ph)*.2+twitch(time*1.7+ph,12)*.4)*motion,0);
    for(let i=0;i<2;i++)R.wings[i].rotation.set((i?1:-1)*twitch(time*.5+ph+i*2,40)*.25*motion,0,0);
  }

  // ---- Making and posing ---------------------------------------------------------------------
  const HOOFED={sheep,goat,pig,cattle,horse};
  function make(T,kind,seed){
    const h=hash(kind+':'+seed),rnd=random(h),r=begin(T),g=new T.Group(),phase=(h%628)/100;
    g.name='village-'+kind;
    if(kind==='dog'){
      const d=dog(r,h,rnd),f=r.finish({name:'village-dog',pad:.2}),b=f.bones;g.add(f.mesh);
      g.userData.dogRig={body:b.body,bodyY:.34,neck:b.neck,head:b.head,jaw:b.jaw,legs:d.legs,ears:[b.earL,b.earR],tail:b.tail,tail2:b.tail2,phase:0};
      Object.assign(g.userData,{animalKind:'dog',animalName:d.name,breed:d.breed});
      poseDog(g,STILL,0,0);return g;
    }
    if(HOOFED[kind]){
      const s=HOOFED[kind](r,h,rnd),f=r.finish({name:'village-'+kind,pad:.22}),b=f.bones;g.add(f.mesh);
      const R=Object.assign({type:'hoofed',body:b.body,bodyY:b.body.position.y,neck:b.neck,head:b.head,jaw:b.jaw,ears:[b.earL,b.earR],lids:[b.lidL,b.lidR],tail:b.tail,tail2:b.tail2||null,legs:s.legs,gait:s.gait},s.extra);
      // reach: how far nose or tail stands out from the middle, so a pen can
      // keep the whole animal inside its rails. barrel: the body's spine from
      // rump to chest and its girth, so pen-mates keep out of each other.
      Object.assign(g.userData,{rig:R,livestockKind:kind,animalKind:kind,animalName:s.name,breed:s.breed,neck:R.neck,head:R.head,muzzle:b.muzzle,jaw:b.jaw,legs:s.legs,
        knees:s.legs.map(l=>l.userData.leg.knee),ears:R.ears,tail:R.tail,body:R.body,reach:s.reach,barrel:s.barrel,phase,baseRotationY:0});
      poseHoofed(g,STILL,0,0);return g;
    }
    if(kind==='cat'){
      const c=cat(r,h,rnd),f=r.finish({name:'village-cat',pad:.1}),b=f.bones;g.add(f.mesh);
      const R={type:'cat',body:b.body,neck:b.neck,head:b.head,ears:[b.earL,b.earR],tail:b.tail,tail1:b.tail1,tail2:b.tail2};
      Object.assign(g.userData,{rig:R,animalKind:'cat',animalName:c.name,breed:c.breed,tail:b.tail,neck:b.neck,head:b.head,phase});
      poseCat(g,STILL,0,0);return g;
    }
    if(kind==='hen'||kind==='rooster'){
      const rooster=kind==='rooster',c=poultry(r,h,rnd,rooster),f=r.finish({name:'village-'+kind,pad:.12}),b=f.bones;g.add(f.mesh);
      // Each stride covers as much ground as the life layer expects.
      const stride=rooster?.18:.16;
      const R={type:'fowl',body:b.body,bodyY:b.body.position.y,neck:b.neck,head:b.head,tail:b.tail,wings:[b.wingL,b.wingR],legs:c.legs,crouch:rooster?.05:.022,gait:{sweep:stride*.6,duty:.6,lift:rooster?.035:.03,flex:1.2}};
      Object.assign(g.userData,{rig:R,animalKind:kind,fowlKind:kind,animalName:c.name,breed:c.breed,neck:b.neck,head:b.head,beak:b.beak,body:b.body,legs:c.legs,tail:b.tail,phase,baseRot:0});
      posePoultry(g,STILL,0,0);return g;
    }
    if(kind==='duck'){
      const c=duck(r,h,rnd),f=r.finish({name:'village-duck',pad:.1}),b=f.bones;g.add(f.mesh);
      const R={type:'duck',body:b.body,neck:b.neck,head:b.head,tail:b.tail,wings:[b.wingL,b.wingR],legs:c.legs,gait:{sweep:.07,duty:.55,lift:.02,flex:.8}};
      // waterline: the model height a pond sets on its surface.
      Object.assign(g.userData,{rig:R,animalKind:'duck',animalName:c.name,breed:c.breed,neck:b.neck,head:b.head,body:b.body,tail:b.tail,legs:c.legs,phase,waterline:.07});
      poseDuck(g,STILL,0,0);return g;
    }
    throw Error('Unknown animal '+kind);
  }
  // pose(g, kind, {moving, stride, speed, graze}, time, motion): stride is the
  // gait phase in radians; graze is 0..1 head down (the peck, for fowl).
  function pose(g,kind,state,time,motion){
    const u=g.userData;state=state||STILL;motion=motion??1;
    if(u.dogRig)return poseDog(g,state,time,motion);
    const R=u.rig;if(!R)return;
    if(R.type==='hoofed')poseHoofed(g,state,time,motion);
    else if(R.type==='fowl')posePoultry(g,state,time,motion);
    else if(R.type==='cat')poseCat(g,state,time,motion);
    else poseDuck(g,state,time,motion);
  }
  // ---- Life: where the animals go. The pose functions above draw a gait; ----
  // these decide when to walk, graze, peck or turn. Each animal times itself
  // from the scene clock, so a 30 Hz travelling scene and a 120 Hz phone agree.
  const TAU=Math.PI*2;
  const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  const STRIDE={sheep:.5,goat:.5,pig:.42,cattle:.78,horse:.95,hen:.16,rooster:.18};
  // Turn towards a heading at a steady rate; returns how far off it still is.
  function steer(g,yaw,rate,dt){
    const off=wrap(yaw-g.rotation.y),step=Math.max(-rate*dt,Math.min(rate*dt,off));
    g.rotation.y=wrap(g.rotation.y+step);return Math.abs(off-step);
  }
  // Closest distance between two flat segments, AB and CD; 0 when they cross.
  function segments(ax,az,bx,bz,cx,cz,dx,dz){
    const ux=bx-ax,uz=bz-az,vx=dx-cx,vz=dz-cz,wx=ax-cx,wz=az-cz;
    const a=ux*ux+uz*uz,b=ux*vx+uz*vz,c=ux*wx+uz*wz,e=vx*vx+vz*vz,f=vx*wx+vz*wz,den=a*e-b*b;
    let s=den>1e-9?clamp((b*f-c*e)/den,0,1):0,t=(b*s+f)/e;
    if(t<0){t=0;s=clamp(-c/a,0,1);}else if(t>1){t=1;s=clamp((b-c)/a,0,1);}
    const x=wx+ux*s-vx*t,z=wz+uz*s-vz*t;return Math.sqrt(x*x+z*z);
  }
  // Pen-mates keep their bodies apart. Each body is a capsule along its spine
  // (userData.barrel: rump, chest and girth in model units); room() is the
  // clear space between this animal, stood at x, z facing yaw, and its
  // nearest mate. Below zero they touch.
  function room(g,x,z,yaw){
    const A=g.userData.barrel,mates=g.userData.penMates;
    if(!A||!mates)return Infinity;
    const s=g.scale.x,c=Math.cos(yaw)*s,n=-Math.sin(yaw)*s;
    let space=Infinity;
    for(let i=0;i<mates.length;i++){
      const m=mates[i],B=m.userData.barrel;if(m===g||!B)continue;
      const k=m.scale.x,mc=Math.cos(m.rotation.y)*k,mn=-Math.sin(m.rotation.y)*k,mx=m.position.x,mz=m.position.z;
      space=Math.min(space,segments(x+A[0]*c,z+A[0]*n,x+A[1]*c,z+A[1]*n,mx+B[0]*mc,mz+B[0]*mn,mx+B[1]*mc,mz+B[1]*mn)-A[2]*s-B[2]*k);
    }
    return space;
  }
  // Pick the roomiest of a few spots a short amble away, so pen-mates spread
  // out, but never trade a comfy spot for a tighter one.
  function roam(g,L){
    const here=room(g,L.x,L.z,g.rotation.y);let best=-Infinity;
    for(let tries=0;tries<6;tries++){
      const a=Math.random()*TAU,d=.3+Math.random()*.7;
      const tx=clamp(L.x+Math.cos(a)*d,-L.pen.hw,L.pen.hw),tz=clamp(L.z+Math.sin(a)*d,-L.pen.hd,L.pen.hd);
      const space=room(g,tx,tz,Math.atan2(L.z-tz,tx-L.x));
      if(space>best){best=space;L.tx=tx;L.tz=tz;}
    }
    if(best<here&&best<.08){L.tx=L.x;L.tz=L.z;}
  }
  // A new pen shuffles its animals so nobody starts the day standing inside
  // a pen-mate: each crowded one moves to the roomiest spot in its pen,
  // turning a little if that helps. Nothing random, so a village keeps its look.
  function settle(mates){
    for(const g of mates){
      const pen=g.userData.pen;let best=room(g,g.position.x,g.position.z,g.rotation.y);
      if(!pen||best>=.05)continue;
      let bx=g.position.x,bz=g.position.z,by=g.rotation.y;
      for(let i=0;i<=6;i++)for(let j=0;j<=4;j++)for(let k=-1;k<=2;k++){
        const x=(i/3-1)*pen.hw,z=(j/2-1)*pen.hd,yaw=g.rotation.y+k*PI/4,space=room(g,x,z,yaw);
        if(space>best+1e-3){best=space;bx=x;bz=z;by=yaw;}
      }
      g.position.x=bx;g.position.z=bz;g.rotation.y=wrap(by);
    }
  }
  // Pen animals amble between grazing spots inside their own fence, step
  // round to face the way they go, keep out of each other's way, and put
  // their heads right down to the grass while they wait.
  function livestock(g,t,motion){
    const u=g.userData,kind=u.livestockKind;
    if(!u.life){
      const pen=u.pen||{hw:.6,hd:.6};
      g.rotation.y=wrap(g.rotation.y);
      u.life={x:g.position.x,z:g.position.z,tx:g.position.x,tz:g.position.z,wait:1.5+(u.phase||0)%3,walked:(u.phase||0)*.3,graze:0,pen,
        state:{moving:false,stride:0,speed:0,graze:0}};
    }
    const L=u.life,dt=Math.max(0,Math.min(.12,t-(L.at??t)));L.at=t;let moving=false;
    if(motion>0){
      if(L.wait>0){L.wait-=dt;if(L.wait<=0)roam(g,L);}
      else{
        const dx=L.tx-g.position.x,dz=L.tz-g.position.z,dist=Math.hypot(dx,dz);
        if(dist<.03){L.wait=2.5+Math.random()*6;}
        else{
          // The body faces +X, so the heading is atan2(-dz, dx).
          const x=g.position.x,z=g.position.z,y0=g.rotation.y,before=room(g,x,z,y0),off=steer(g,Math.atan2(-dz,dx),1.1,dt);
          const turned=Math.abs(wrap(g.rotation.y-y0)),speed=(kind==='horse'?.16:.1)*g.scale.x,step=off<.2?Math.min(dist,speed*dt):0;
          const nx=x+dx/dist*step,nz=z+dz/dist*step,after=room(g,nx,nz,g.rotation.y);
          if(after<.03&&after<before&&before>=0){
            // A pen-mate is in the way: stop short and think again. One that
            // is already squeezed may shuffle about to get free.
            g.rotation.y=y0;L.wait=.6+Math.random();L.tx=x;L.tz=z;
          }else if(step>0){
            g.position.x=nx;g.position.z=nz;L.walked+=step/g.scale.x;moving=true;
          }else if(turned>0){
            // Turning on the spot, the hooves step round with the body.
            L.walked+=turned*(u.reach||.5)*.45;moving=true;
          }
        }
      }
      L.x=g.position.x;L.z=g.position.z;
      // Heads go down a moment after stopping and lift now and then to look about.
      const want=moving?0:(L.wait>.8&&Math.sin(t*.37+(u.phase||0))>-.55?1:0);
      L.graze+=(want-L.graze)*Math.min(1,dt*1.8);
    }
    const S=L.state;S.moving=moving;S.stride=L.walked/(STRIDE[kind]||.5)*TAU;S.speed=moving?.1:0;S.graze=L.graze;
    pose(g,kind,S,t,motion);
  }
  // Hens strut a small patch of the square: a few quick steps, a look, then a
  // burst of pecks right down at the cobbles. Hens and roosters face +Z.
  function fowl(g,t,motion){
    const u=g.userData,kind=u.fowlKind||'hen';
    if(!u.life)u.life={hx:g.position.x,hz:g.position.z,tx:g.position.x,tz:g.position.z,wait:(u.phase||0)%2,walked:0,peckUntil:0,state:{moving:false,stride:0,speed:0,graze:0}};
    const L=u.life,dt=Math.max(0,Math.min(.12,t-(L.at??t)));L.at=t;let moving=false,graze=0;
    if(motion>0){
      if(L.wait>0){
        L.wait-=dt;
        if(L.peckUntil>0){L.peckUntil-=dt;graze=Math.pow(Math.max(0,Math.sin(t*11+(u.phase||0))),.6);}
        if(L.wait<=0){const a=Math.random()*TAU,d=.25+Math.random()*.55;L.tx=L.hx+Math.cos(a)*d;L.tz=L.hz+Math.sin(a)*d;}
      }else{
        const dx=L.tx-g.position.x,dz=L.tz-g.position.z,dist=Math.hypot(dx,dz);
        if(dist<.02){L.wait=1.2+Math.random()*3;L.peckUntil=Math.random()<.7?.6+Math.random()*1.4:0;}
        else{
          if(steer(g,Math.atan2(dx,dz),5,dt)<.4){
            const step=Math.min(dist,.32*dt);g.position.x+=dx/dist*step;g.position.z+=dz/dist*step;L.walked+=step;moving=true;
          }
        }
      }
    }
    const S=L.state;S.moving=moving;S.stride=L.walked/(STRIDE[kind]||.16)*TAU;S.speed=moving?.32:0;S.graze=graze;
    pose(g,kind,S,t,motion);
  }
  // The cat keeps its perch; the pose gives it a swishing tail and a
  // watchful head. Hens and roosters strut and peck.
  function small(g,t,motion){
    if(g.userData.animalKind==='cat')pose(g,'cat',STILL,t,motion);
    else fowl(g,t,motion);
  }
  root.BurbzVillageAnimals={make,pose,livestock,settle,fowl,small,STRIDE};
})(typeof globalThis!=='undefined'?globalThis:this);
