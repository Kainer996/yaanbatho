/* Moving water for Alderwing: flowing streams and rivers, white water on
 * steep ground, waterfalls that arc off their lips into churning pools,
 * spray, flecks of foam and leaves drifting past, and the sound of it all.
 * One stream material is shared by every chunk; spray is one draw for the
 * whole view. The water look itself lives in shore_water.js. */
(function(root){'use strict';
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
function streamMaterial(T,{time,style}){
 const W=root.BurbzShoreWater,m=new T.MeshLambertMaterial({color:0xffffff});
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,W.uniforms());if(time)shader.uniforms.shoreTime=time;
  shader.vertexShader='attribute vec3 streamFlow;\nattribute vec4 streamShape;\nvarying vec3 vStreamFlow;\nvarying vec4 vStreamShape;\nvarying vec3 vStreamWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStreamFlow=streamFlow;vStreamShape=streamShape;\nvStreamWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec3 vStreamFlow;\nvarying vec4 vStreamShape;\nvarying vec3 vStreamWorld;\n'+shader.fragmentShader.replace('#include <fog_pars_fragment>','#include <fog_pars_fragment>\n'+W.CHUNK).replace('#include <color_fragment>',`#include <color_fragment>
 float side=vStreamFlow.y,edge=abs(side),steep=clamp(vStreamFlow.z,0.,1.),widthHalf=max(vStreamShape.z,.1),part=vStreamShape.w;
 float pool=step(.5,part)*(1.-step(1.5,part)),rock=step(1.5,part),churn=clamp(steep*1.45-.2,0.,1.)*(1.-rock);
 vec2 flowDir=normalize(vStreamShape.xy+vec2(1e-5,0.)),streamSlope=vec2(0.);
 vec3 streamBody=vec3(.04,.1,.1);float streamFoam=0.;
 #ifdef USE_FOG
 vec2 sp=vStreamWorld.xz;float far=shoreFar(vStreamWorld);
 // The water's edge wanders like a real bank instead of a ruled line.
 if(edge>.8+.19*texture2D(shoreMap,sp/4.7+.13).b)discard;
 // Ripples ride the current: quick on steep ground, slow in pools.
 float speed=mix(mix(.55,2.95,steep),.9,pool);
 vec4 big=shoreTap(sp,flowDir*speed,5.5,1.9,0.),small=shoreTap(sp,flowDir*speed*1.07+vec2(.03,-.02),1.9,1.35,.31);
 streamSlope=(big.rg*.6+small.rg*.4*(1.-far*.7))*mix(.58,1.,churn)*mix(1.,.3,far);
 streamSlope+=shoreDrops(sp)*(1.-churn);
 // White water: rapids churn, foam lines trail moving banks, pools boil.
 float cover=clamp(churn*.88+smoothstep(.6,1.,edge)*(.14+.42*churn)*(1.-pool)+rock*.35,0.,.96);
 streamFoam=smoothstep(1.-cover,1.-cover+.2,big.b*.55+small.b*.45)*step(.001,cover);
 // Clear, peaty water over dark stones: the shallows show them, the middle runs deep.
 float depth=(1.-edge*edge)*clamp(.35+widthHalf*.35,.45,1.);
 vec3 bed=vec3(.13,.115,.08)*(.65+.7*small.b);
 streamBody=mix(mix(bed,vec3(.06,.11,.09),.4),vec3(.018,.05,.055),smoothstep(.15,.8,depth));
 float caustic=texture2D(shoreMap,sp/1.7+shoreTime*vec2(.031,.019)).a*texture2D(shoreMap,sp/2.1-shoreTime*vec2(.024,.033)).a;
 streamBody+=vec3(.42,.46,.36)*caustic*(1.-smoothstep(.2,.75,depth))*(1.-churn)*(1.-far);
 // Under a fall the rock shows dark and wet through a thin sheet of water.
 streamBody=mix(streamBody,vec3(.055,.06,.055),rock*.85);
 #endif
 diffuseColor.rgb=mix(streamBody,vec3(.87,.92,.92),streamFoam);`).replace('#include <fog_fragment>',`#ifdef USE_FOG
 // Narrow becks mirror their banks; open rivers mirror the sky.
 gl_FragColor.rgb=shoreSurface(gl_FragColor.rgb,vStreamWorld,streamSlope,(1.-streamFoam)*mix(.95,.55,churn),clamp(.45/(widthHalf+.45),.04,.4));
 #endif
 #include <fog_fragment>`);};
 m.customProgramCacheKey=()=> 'alderwing-stream-v496';style(m);return m;
}
function streamMesh(T,data,material){
 if(!data.indices.length)return null;const g=new T.BufferGeometry(),count=data.positions.length/3;
 g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('streamFlow',new T.Float32BufferAttribute(data.flow,3));g.setAttribute('streamShape',new T.Float32BufferAttribute(data.shape?.length===count*4?data.shape:new Float32Array(count*4),4));
 g.setIndex(data.indices);g.computeVertexNormals();g.computeBoundingSphere();
 const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;mesh.name='Alderwing stream';return mesh;
}
// A falling sheet: glassy where it bends over the lip, breaking into white
// strands that stretch as the water speeds up, and churning where it lands.
function fallMaterial(T,{time,style}){
 const W=root.BurbzShoreWater,m=new T.MeshLambertMaterial({color:0xffffff,emissive:0x263032,side:T.DoubleSide,transparent:true,depthWrite:false});
 m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,W.uniforms());if(time)shader.uniforms.shoreTime=time;
  shader.vertexShader='attribute vec4 fallFlow;\nvarying vec4 vFall;\nvarying vec3 vFallWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvFall=fallFlow;\nvFallWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='varying vec4 vFall;\nvarying vec3 vFallWorld;\n'+shader.fragmentShader.replace('#include <fog_pars_fragment>','#include <fog_pars_fragment>\n'+W.CHUNK).replace('#include <color_fragment>',`#include <color_fragment>
 float fallGlass=0.;
 #ifdef USE_FOG
 float below=max(vFall.x,0.),across=vFall.y*vFall.w,u=clamp(vFall.z,0.,1.);
 // Seconds this water has been falling: it leaves the lip at 1.3m/s and
 // gathers speed, so its strands stretch longer the further down they are.
 float lag=(sqrt(1.69+17.6*below)-1.3)/8.8-shoreTime;
 vec4 a=texture2D(shoreMap,vec2(across/1.35+.08*sin(lag*2.3),lag*.85)),b=texture2D(shoreMap,vec2(across/.6+.3,lag*1.7+.5));
 float strands=smoothstep(.3,.72,a.b*.6+b.b*.4),sides=1.-smoothstep(.55,1.,abs(vFall.y)),broken=smoothstep(.04,.4,u);
 float alpha=sides*mix(.9,mix(.12,.97,strands),broken);
 alpha=mix(alpha,sides*.9,smoothstep(.88,1.,u));
 vec3 white=mix(vec3(.58,.68,.7),vec3(.94,.97,.98),strands);
 diffuseColor.rgb=mix(vec3(.12,.24,.24),white,smoothstep(.02,.26,u));diffuseColor.a*=alpha;fallGlass=1.-broken;
 #endif`).replace('#include <fog_fragment>',`#ifdef USE_FOG
 gl_FragColor.rgb=shoreSurface(gl_FragColor.rgb,vFallWorld,vec2(0.),fallGlass*.7,.12);
 #endif
 #include <fog_fragment>`);};
 m.customProgramCacheKey=()=> 'alderwing-fall-v496';style(m);return m;
}
function fallMesh(T,curtain,material){
 if(!curtain?.indices?.length)return null;const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(curtain.positions,3));g.setAttribute('fallFlow',new T.Float32BufferAttribute(curtain.flow,4));g.setIndex(curtain.indices);g.computeVertexNormals();g.computeBoundingSphere();
 const mesh=new T.Mesh(g,material);mesh.renderOrder=12;mesh.name='Alderwing waterfall';return mesh;
}
function softDot(size,stops){const canvas=document.createElement('canvas');canvas.width=canvas.height=size;const x=canvas.getContext('2d'),g=x.createRadialGradient(size/2,size/2,1,size/2,size/2,size/2-1);for(const [at,colour] of stops)g.addColorStop(at,colour);x.fillStyle=g;x.fillRect(0,0,size,size);return canvas;}
// Soft spray over every plunge pool in view and droplets thrown up where
// the water lands: two draws, drifting and pulsing on the water clock.
function createSpray(T,scene,{time}){
 const texture=new T.CanvasTexture(softDot(64,[[0,'rgba(255,255,255,.9)'],[.45,'rgba(240,248,250,.45)'],[1,'rgba(240,248,250,0)']]));
 const drop=new T.CanvasTexture(softDot(32,[[0,'rgba(255,255,255,1)'],[.5,'rgba(236,246,250,.7)'],[1,'rgba(236,246,250,0)']]));
 const owners=new Map(),size=new T.Vector2(),fog={fogColor:{value:new T.Color()},fogNear:{value:1},fogFar:{value:2000}};let meshes=[],dirty=false;
 const mistMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{sprayMap:{value:texture},sprayTime:time,sprayScale:{value:300},...fog},
  vertexShader:'attribute float spraySize;attribute float sprayPhase;uniform float sprayTime;uniform float sprayScale;varying float vSprayAlpha;varying float vFogDepth;\nvoid main(){float pulse=.5+.5*sin(sprayTime*1.7+sprayPhase);vec3 p=position+vec3(sin(sprayTime*.6+sprayPhase)*.35,pulse*.7,cos(sprayTime*.5+sprayPhase)*.35);vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=spraySize*(.8+.4*pulse)*sprayScale/max(1.0,-mv.z);vSprayAlpha=.24+.18*(1.0-pulse);vFogDepth=-mv.z;}',
  fragmentShader:'uniform sampler2D sprayMap;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;varying float vSprayAlpha;varying float vFogDepth;\nvoid main(){vec4 c=texture2D(sprayMap,gl_PointCoord);float fog=smoothstep(fogNear,fogFar,vFogDepth);gl_FragColor=vec4(mix(c.rgb,fogColor,fog),c.a*vSprayAlpha*(1.0-fog));}'});
 // Each droplet flies its own arc, over and over: no state kept per frame.
 const dropMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{sprayMap:{value:drop},sprayTime:time,sprayScale:{value:300},...fog},
  vertexShader:'attribute vec3 dropVel;attribute vec2 dropLife;uniform float sprayTime;uniform float sprayScale;varying float vSprayAlpha;varying float vFogDepth;\nvoid main(){float life=.7+dropLife.x*.6,t=fract(sprayTime/life+dropLife.x*7.13)*life;vec3 p=position+vec3(dropVel.x*t,dropVel.y*t-4.9*t*t,dropVel.z*t);vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=max(1.5,dropLife.y*sprayScale/max(1.0,-mv.z));vSprayAlpha=.8*(1.0-t/life)*step(position.y-.02,p.y);vFogDepth=-mv.z;}',
  fragmentShader:'uniform sampler2D sprayMap;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;varying float vSprayAlpha;varying float vFogDepth;\nvoid main(){vec4 c=texture2D(sprayMap,gl_PointCoord);float fog=smoothstep(fogNear,fogFar,vFogDepth);gl_FragColor=vec4(mix(c.rgb,fogColor,fog),c.a*vSprayAlpha*(1.0-fog));}'});
 function points(material,attributes,name,order){const geometry=new T.BufferGeometry();for(const [key,[values,width]] of Object.entries(attributes))geometry.setAttribute(key,new T.Float32BufferAttribute(values,width));const p=new T.Points(geometry,material);p.frustumCulled=false;p.renderOrder=order;p.name=name;scene.add(p);return p;}
 function rebuild(){dirty=false;for(const p of meshes){p.removeFromParent();p.geometry.dispose();}meshes=[];
  const all=[...owners.values()],mist=all.flatMap(r=>r.mist),splash=all.flatMap(r=>r.splash);
  if(mist.length)meshes.push(points(mistMaterial,{position:[mist.flatMap(r=>[r.x,r.y,r.z]),3],spraySize:[mist.map(r=>r.size),1],sprayPhase:[mist.map(r=>r.phase),1]},'Alderwing spray',20));
  if(splash.length)meshes.push(points(dropMaterial,{position:[splash.flatMap(r=>[r.x,r.y,r.z]),3],dropVel:[splash.flatMap(r=>[r.dx*r.speed,r.rise,r.dz*r.speed]),3],dropLife:[splash.flatMap(r=>[r.phase,r.size]),2]},'Alderwing droplets',21));}
 return{set(owner,rows){const mist=Array.isArray(rows)?rows:rows?.mist||[],splash=Array.isArray(rows)?[]:rows?.splash||[];if(mist.length||splash.length)owners.set(owner,{mist,splash});else if(!owners.delete(owner))return;dirty=true;},
  update(renderer,sceneFog){if(dirty)rebuild();const scale=renderer.getSize(size).y*renderer.getPixelRatio()*.5;mistMaterial.uniforms.sprayScale.value=dropMaterial.uniforms.sprayScale.value=scale;if(sceneFog){fog.fogColor.value.copy(sceneFog.color);fog.fogNear.value=sceneFog.near;fog.fogFar.value=sceneFog.far;}},
  count:()=>[...owners.values()].reduce((n,r)=>n+r.mist.length,0),drops:()=>[...owners.values()].reduce((n,r)=>n+r.splash.length,0),
  dispose(){for(const p of meshes){p.removeFromParent();p.geometry.dispose();}meshes=[];mistMaterial.dispose();dropMaterial.dispose();texture.dispose();drop.dispose();owners.clear();}};
}
// Flecks of foam and fallen leaves ride the water near the viewer, so the
// current shows its speed and its way. They lie flat on the surface, turn
// slowly as they go and never cross a waterfall's lip.
function createDrift(T,scene,{style,count=36}){
 const C=root.BurbzWorldWaterCore,rand=(()=>{let s=0x51f3a7;return()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};})();
 const foamCanvas=document.createElement('canvas');foamCanvas.width=foamCanvas.height=64;{const x=foamCanvas.getContext('2d');for(let i=0;i<9;i++){const a=i*2.4,r=6+(i%4)*3,g=x.createRadialGradient(32+Math.cos(a)*r,32+Math.sin(a)*r,1,32+Math.cos(a)*r,32+Math.sin(a)*r,10+(i%3)*3);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(1,'rgba(255,255,255,0)');x.fillStyle=g;x.fillRect(0,0,64,64);}}
 const leafCanvas=document.createElement('canvas');leafCanvas.width=leafCanvas.height=64;{const x=leafCanvas.getContext('2d');x.fillStyle='#fff';x.beginPath();x.moveTo(32,4);x.bezierCurveTo(54,18,52,44,32,60);x.bezierCurveTo(12,44,10,18,32,4);x.fill();x.strokeStyle='rgba(0,0,0,.35)';x.lineWidth=2;x.beginPath();x.moveTo(32,8);x.lineTo(32,58);x.stroke();}
 const geometry=new T.PlaneGeometry(1,1);geometry.rotateX(-Math.PI/2);
 const kinds=[['foam',foamCanvas,0xeef4f2],['leaf',leafCanvas,0xffffff]].map(([name,canvas,colour])=>{const map=new T.CanvasTexture(canvas),material=new T.MeshLambertMaterial({map,color:colour,alphaTest:.35,side:T.DoubleSide});style?.(material);const mesh=new T.InstancedMesh(geometry,material,count);mesh.count=0;mesh.frustumCulled=false;mesh.name='Alderwing drifting '+name;if(name==='leaf')for(let i=0;i<count;i++)mesh.setColorAt(i,new T.Color(1,1,1));scene.add(mesh);return{name,map,material,mesh};});
 const flecks=[],dummy=new T.Object3D(),tint=new T.Color(),LEAVES=[0xb8862b,0xc9a13c,0x8f5a22,0x6d7d2e,0xa5432a];
 function spawn(near,player){const w=near.water;if(!w||w.d>16)return null;const stream=w.stream,start=w.s+(rand()*2-1)*14,p=C.at(stream,start);if(!p||stream.lift[p.i]>0)return null;
  const leaf=rand()<.3;return{stream,s:start,lat:(rand()*2-1)*.6,drift:(rand()-.5)*.08,angle:rand()*6.28,spin:(rand()-.5)*.9,size:leaf?.1+rand()*.06:.08+rand()*.12,leaf,age:0,colour:LEAVES[Math.floor(rand()*LEAVES.length)],pace:.85+rand()*.3};}
 function update(dt,near,player,height){
  dt=Math.min(dt,.1);let live=0;
  while(flecks.length<count&&near?.water&&near.water.d<16){const f=spawn(near,player);if(!f)break;flecks.push(f);}
  for(let i=flecks.length-1;i>=0;i--){const f=flecks[i],p=C.at(f.stream,f.s);
   if(!p||f.s>=f.stream.samples[f.stream.samples.length-1].s||f.stream.lift[p.i]>0||Math.hypot(p.x-player.x,p.z-player.z)>26){f.dying=true;}
   f.age+=dt;if(f.dying)f.fade=(f.fade??1)-dt*2.5;if(f.dying&&f.fade<=0){flecks.splice(i,1);continue;}
   const v=C.speed(p.steep,false,f.stream.kind)*f.pace;f.s+=v*dt;f.lat=clamp(f.lat+f.drift*dt,-.7,.7);f.angle+=f.spin*dt*(.5+v*.4);}
  const counts={foam:0,leaf:0};
  for(const f of flecks){const p=C.at(f.stream,f.s);if(!p)continue;const half=(p.w??f.stream.width)/2*clamp(p.s/3,.35,1)*(1+p.steep*.25);if(half<.2)continue;
   const ax=p.x+p.uz*half,az=p.z-p.ux*half,bx=p.x-p.uz*half,bz=p.z+p.ux*half,ha=height(ax,az),hb=height(bx,bz);if(!Number.isFinite(ha)||!Number.isFinite(hb))continue;
   const t=(f.lat+1)/2,x=ax+(bx-ax)*t,z=az+(bz-az)*t,y=ha+(hb-ha)*t+.1,grow=Math.min(1,f.age*2)*(f.dying?Math.max(0,f.fade):1);
   const kind=kinds[f.leaf?1:0],k=counts[kind.name]++;
   dummy.position.set(x,y,z);dummy.rotation.set(0,f.angle,0);dummy.scale.set(f.size*grow*(f.leaf?.62:1),1,f.size*grow);dummy.updateMatrix();kind.mesh.setMatrixAt(k,dummy.matrix);if(f.leaf)kind.mesh.setColorAt(k,tint.setHex(f.colour));live++;}
  for(const kind of kinds){kind.mesh.count=counts[kind.name];kind.mesh.instanceMatrix.needsUpdate=true;if(kind.mesh.instanceColor)kind.mesh.instanceColor.needsUpdate=true;}
  return live;}
 return{update,count:()=>flecks.length,clear(){flecks.length=0;for(const k of kinds)k.mesh.count=0;},dispose(){for(const k of kinds){k.mesh.removeFromParent();k.mesh.dispose();k.material.dispose();k.map.dispose();}geometry.dispose();flecks.length=0;}};
}
// Running water you can hear: a babbling brook, a broad river and a
// waterfall's roar, each a seamless loop on the calm nature bus. Each
// layer's loudness, place and brightness come from listen() in the core.
const SOUNDS={brook:'assets/audio/water/brook-loop.mp3',river:'assets/audio/water/river-loop.mp3',fall:'assets/audio/water/waterfall-loop.mp3'};
const LEVELS={brook:.62,river:.55,fall:.8},SEAMLESS=new WeakMap();
// Some decoders keep an MP3's silent lead-in and tail. Trim them and fold the
// last quarter second into the first, so the loop never clicks or gaps.
function seamless(ctx,buffer){
 if(SEAMLESS.has(buffer))return SEAMLESS.get(buffer);let out=buffer;
 try{const n=buffer.length,chs=[];for(let c=0;c<buffer.numberOfChannels;c++)chs.push(buffer.getChannelData(c));const loud=i=>chs.some(d=>Math.abs(d[i])>1e-4);
  let a=0,b=n;while(a<n&&!loud(a))a++;while(b>a&&!loud(b-1))b--;const F=Math.min(Math.round(.25*buffer.sampleRate),Math.floor((b-a)/4)),len=b-a-F;
  if(len>buffer.sampleRate){out=ctx.createBuffer(chs.length,len,buffer.sampleRate);chs.forEach((d,c)=>{const o=out.getChannelData(c);o.set(d.subarray(a+F,b));for(let j=0;j<F;j++){const t=j/F*Math.PI/2;o[len-F+j]=d[b-F+j]*Math.cos(t)+d[a+j]*Math.sin(t);}});}}
 catch(_){out=buffer;}
 SEAMLESS.set(buffer,out);return out;
}
function createSound({bus=root.BurbzAudioCore?.sharedBus?.(),allowed=()=>true}={}){
 const ctx=bus?.ctx;if(!ctx||typeof bus.input!=='function')return null;let disposed=false;const layers={};
 try{for(const [name,src] of Object.entries(SOUNDS)){const gain=ctx.createGain(),filter=ctx.createBiquadFilter(),pan=ctx.createStereoPanner?ctx.createStereoPanner():null;gain.gain.value=0;filter.type='lowpass';filter.frequency.value=12000;filter.connect(gain);if(pan){gain.connect(pan);pan.connect(bus.input('nature'));}else gain.connect(bus.input('nature'));layers[name]={src,gain,filter,pan,node:null,loading:false,quiet:0};}}catch(_){return null;}
 function start(layer){if(layer.node||layer.loading)return;layer.loading=true;Promise.resolve(bus.load(layer.src)).then(buffer=>{layer.loading=false;if(disposed||!buffer||layer.node)return;
  try{const node=ctx.createBufferSource();node.buffer=seamless(ctx,buffer);node.loop=true;node.connect(layer.filter);node.start(ctx.currentTime,Math.random()*Math.max(0,node.buffer.duration-.1));layer.node=node;}catch(_){}}).catch(()=>{layer.loading=false;});}
 function stop(layer){if(!layer.node)return;try{layer.node.stop();layer.node.disconnect();}catch(_){}layer.node=null;}
 function update(mix,dt=.1){if(disposed)return;const on=allowed(),t=ctx.currentTime;
  for(const [name,layer] of Object.entries(layers)){const m=mix?.[name]||{level:0,pan:0,cutoff:12000},target=on?clamp(m.level,0,1)*LEVELS[name]:0;
   if(target>.002)start(layer);layer.gain.gain.setTargetAtTime(target,t,target>layer.gain.gain.value?.35:.5);layer.filter.frequency.setTargetAtTime(clamp(m.cutoff||12000,400,16000),t,.3);if(layer.pan)layer.pan.pan.setTargetAtTime(clamp(m.pan||0,-.85,.85),t,.25);
   // A layer silent for a few seconds lets go of its source.
   layer.quiet=target>.002?0:layer.quiet+dt;if(layer.quiet>4)stop(layer);}}
 function dispose(){disposed=true;const t=ctx.currentTime;for(const layer of Object.values(layers)){try{layer.gain.gain.setTargetAtTime(0,t,.2);}catch(_){}setTimeout(()=>{stop(layer);try{layer.gain.disconnect();layer.pan?.disconnect();layer.filter.disconnect();}catch(_){}},900);}}
 return{update,dispose,layers:()=>Object.fromEntries(Object.entries(layers).map(([k,l])=>[k,{playing:!!l.node,gain:l.gain.gain.value}]))};
}
root.BurbzWorldWater={streamMaterial,streamMesh,fallMaterial,fallMesh,createSpray,createDrift,createSound,SOUNDS,LEVELS};
})(globalThis);
