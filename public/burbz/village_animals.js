/* Village animals: rigged dogs, cats, hens, roosters, sheep, cattle, goats,
 * pigs and horses, each one skinned mesh from BurbzSettlementModels.rig, plus
 * the small lives that walk them about. THREE is supplied by the caller. */
(function(root){
  'use strict';
  // Stand-in bodies for wiring tests only; the real art replaces this block.
  function make(T,kind,seed){
    const r=root.BurbzSettlementModels.rig(T),quad=['dog','sheep','cattle','goat','pig','horse'].includes(kind);
    const g=new T.Group();
    if(kind==='dog'){
      r.bone('body',null,[0,.34,0]);r.bone('neck','body',[.34,.46,0]);r.bone('tail','body',[-.36,.44,0]);
      r.sphere(.2,[0,.34,0],0x8a6a42,'body',[1.7,1,1]);r.sphere(.13,[.4,.48,0],0x8a6a42,'neck');r.box([.05,.2,.05],[-.4,.5,0],0x8a6a42,'tail');
      const ears=[];for(const z of [-.07,.07]){ears.push(r.bone('ear'+z,'neck',[.36,.6,z]));r.cone(.04,.12,[.36,.64,z],0x4a4038,'ear'+z);}
      const legs=[];for(const [x,z,i] of [[.2,-.09,0],[.2,.09,1],[-.22,-.1,2],[-.22,.1,3]]){
        const hip=r.bone('hip'+i,null,[x,.28,z]),knee=r.bone('knee'+i,'hip'+i,[x,.14,z]);r.bone('shin'+i,'knee'+i,[x,.07,z]);r.bone('paw'+i,'knee'+i,[x+.014,0,z]);
        r.limb([x,.28,z],[x,.14,z],.034,.027,0x8a6a42,'hip'+i);r.limb([x,.14,z],[x,.02,z],.026,.02,0x8a6a42,'knee'+i);r.sphere(.033,[x+.014,.02,z],0x2e2620,'paw'+i,[1.35,.55,1]);
        hip.userData={knee,phase:(x>0)===(z<0)?0:.5,bend:x>0?1:-1};legs.push(hip);}
      const f=r.finish({name:'village-dog'});g.add(f.mesh);
      g.userData.dogRig={body:f.bones.body,bodyY:.34,neck:f.bones.neck,legs,ears,tail:f.bones.tail,phase:0};
      g.userData.animalName='a scruffy sheepdog';return g;
    }
    r.bone('body',null,[0,quad?.5:.2,0]);r.bone('neck','body',quad?[.4,.6,0]:[0,.28,.1]);r.bone('tail','body',quad?[-.45,.55,0]:[0,.25,-.12]);
    const legs=[];
    if(quad){for(const [x,z,i] of [[.28,-.15,0],[.28,.15,1],[-.28,-.15,2],[-.28,.15,3]]){const h=r.bone('hip'+i,null,[x,.45,z]);h.userData.phase=i*Math.PI/2;r.limb([x,.45,z],[x,0,z],.05,.04,0x3b2a20,'hip'+i);legs.push(h);}
      r.sphere(.32,[0,.5,0],{sheep:0xe0d8c7,cattle:0x765039,goat:0xaaa08b,pig:0xc88778,horse:0x704629}[kind],'body',[1.6,.9,1]);r.sphere(.16,[.55,.7,0],0x3b2a20,'neck');}
    else{r.sphere(kind==='cat'?.12:.13,[0,.18,0],kind==='cat'?0x8a8a92:0xe8e2d0,'body',[1,1,1.3]);r.sphere(.06,[0,.36,.12],0xd8a03a,'neck');}
    r.box([.03,.15,.03],quad?[-.5,.5,0]:[0,.3,-.15],0x3b2a20,'tail');
    const f=r.finish({name:'village-'+kind});g.add(f.mesh);
    Object.assign(g.userData,{neck:f.bones.neck,legs,tail:f.bones.tail,body:f.bones.body,animalName:kind==='cat'?'the village cat':undefined});
    return g;
  }
  function pose(g,kind,state,time,motion){
    const u=g.userData;if(!u.neck)return;
    if(['sheep','cattle','goat','pig','horse'].includes(kind)){u.neck.rotation.z=-.9*(state.graze||0);u.legs.forEach((h,i)=>h.rotation.z=state.moving?Math.sin(state.stride+i*Math.PI/2)*.4:0);}
    else u.neck.rotation.x=(state.graze||0)*1.2;
    if(u.tail)u.tail.rotation.y=Math.sin(time*2)*.3*motion;
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
  // Pen animals amble between grazing spots inside their own fence, turn on
  // the spot before they walk, keep out of each other's way, and put their
  // heads right down to the grass while they wait.
  function livestock(g,t,motion){
    const u=g.userData,kind=u.livestockKind;
    if(!u.life){
      const pen=u.pen||{hw:.6,hd:.6};
      u.life={x:g.position.x,z:g.position.z,tx:g.position.x,tz:g.position.z,wait:1.5+(u.phase||0)%3,walked:(u.phase||0)*.3,graze:0,pen,look:0};
      g.rotation.y=wrap(g.rotation.y);
    }
    const L=u.life,dt=Math.max(0,Math.min(.12,t-(L.at??t)));L.at=t;let moving=false;
    if(motion>0){
      if(L.wait>0){
        L.wait-=dt;
        if(L.wait<=0){
          // Pick a spot a short amble away that no pen-mate is standing on.
          for(let tries=0;tries<6;tries++){
            const a=Math.random()*TAU,d=.35+Math.random()*.7;
            const tx=Math.max(-L.pen.hw,Math.min(L.pen.hw,L.x+Math.cos(a)*d)),tz=Math.max(-L.pen.hd,Math.min(L.pen.hd,L.z+Math.sin(a)*d));
            if((u.penMates||[]).every(m=>m===g||Math.hypot(m.position.x-tx,m.position.z-tz)>.62*(m.scale.x+g.scale.x))){L.tx=tx;L.tz=tz;break;}
          }
        }
      }else{
        const dx=L.tx-g.position.x,dz=L.tz-g.position.z,dist=Math.hypot(dx,dz);
        if(dist<.03){L.wait=2.5+Math.random()*6;}
        else{
          // The body faces +X, so the heading is atan2(-dz, dx).
          const off=steer(g,Math.atan2(-dz,dx),1.1,dt);
          if(off<.5){
            const speed=(kind==='horse'?.16:.1)*g.scale.x,step=Math.min(dist,speed*dt);
            g.position.x+=dx/dist*step;g.position.z+=dz/dist*step;L.walked+=step/g.scale.x;moving=true;
          }
        }
      }
      L.x=g.position.x;L.z=g.position.z;
      // Heads go down a moment after stopping and lift now and then to look about.
      const want=moving?0:(L.wait>.8&&Math.sin(t*.37+(u.phase||0))>-.55?1:0);
      L.graze+=(want-L.graze)*Math.min(1,dt*1.8);
    }
    pose(g,kind,{moving,stride:L.walked/(STRIDE[kind]||.5)*TAU,speed:moving?.1:0,graze:L.graze},t,motion);
  }
  // Hens strut a small patch of the square: a few quick steps, a look, then a
  // burst of pecks right down at the cobbles. Hens and roosters face +Z.
  function fowl(g,t,motion){
    const u=g.userData,kind=u.fowlKind||'hen';
    if(!u.life)u.life={hx:g.position.x,hz:g.position.z,tx:g.position.x,tz:g.position.z,wait:(u.phase||0)%2,walked:0,peck:0,peckUntil:0};
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
    pose(g,kind,{moving,stride:L.walked/(STRIDE[kind]||.16)*TAU,speed:moving?.32:0,graze},t,motion);
  }
  // The cat keeps its perch; the pose gives it a swishing tail and a
  // watchful head. Hens and roosters strut and peck.
  function small(g,t,motion){
    if(g.userData.animalKind==='cat')pose(g,'cat',{moving:false,stride:0,speed:0,graze:0},t,motion);
    else fowl(g,t,motion);
  }
  root.BurbzVillageAnimals={make,pose,livestock,fowl,small,STRIDE};
})(typeof globalThis!=='undefined'?globalThis:this);
