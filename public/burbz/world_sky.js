/* Distant sky directions belong to the shared world, never a settlement origin.
 * Uses the existing local-clock day/night convention, not a GPS solar ephemeris. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.BurbzWorldSky=api;})(typeof globalThis!=='undefined'?globalThis:this,function(root){'use strict';
 const TAU=Math.PI*2;
 function directions(hour){const h=((Number(hour)||0)%24+24)%24,a=(h-6)*TAU/24,q=Math.sin(a),sun={x:Math.cos(a),y:q*.85,z:q*Math.sqrt(1-.85*.85)};return{hour:h,sun,moon:{x:-sun.x,y:-sun.y,z:-sun.z},rotation:(h-12)*TAU/24};}
 function localHour(date=new Date()){return date.getHours()+date.getMinutes()/60+date.getSeconds()/3600+date.getMilliseconds()/3600000;}
 // Remove camera translation and force far depth. Terrain still occludes the
 // sky, while walking, flight and origin changes cannot move its apparent rim.
 const vertex='varying vec3 vDir; void main(){vDir=normalize(position);vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);gl_Position=p.xyww;}';
 // One layer of cloud painted on the dome, as much of the sky as the real
 // weather covers. Thin toward the horizon, drifting with the wind; grey and
 // heavy when it rains. Four octaves of value noise, sky pixels only.
 const CLOUDS=`uniform vec3 top;uniform vec3 mid;uniform vec3 hor;uniform float cover;uniform float gloom;uniform vec2 drift;uniform vec3 lit;uniform vec3 shade;varying vec3 vDir;
 // A sine-free hash and quintic blend: sin() hashes lose precision on phone
 // GPUs and draw straight seams, and a cubic blend shows the lattice grid.
 float skyHash(vec2 p){vec3 q=fract(vec3(p.xyx)*.1031);q+=dot(q,q.yzx+33.33);return fract((q.x+q.y)*q.z);}
 float skyNoise(vec2 p){vec2 i=floor(p),f=p-i;f=f*f*f*(f*(f*6.-15.)+10.);return mix(mix(skyHash(i),skyHash(i+vec2(1.,0.)),f.x),mix(skyHash(i+vec2(0.,1.)),skyHash(i+vec2(1.,1.)),f.x),f.y);}
 // Each octave turns a little, so no two grids line up into a visible edge.
 const mat2 skyTurn=mat2(.8,-.6,.6,.8);
 // Re-normalise per pixel. The dome's triangles interpolate vDir linearly, and
 // unnormalised it paints each triangle as a flat facet with straight edges.
 void main(){vec3 dir=normalize(vDir);float h=dir.y;vec3 c=h>.11?mix(mid,top,smoothstep(.11,.8,h)):mix(hor,mid,smoothstep(-.04,.11,h));
  if(cover>.002&&h>-.02){vec2 p=dir.xz/(max(h,0.)+.18)*1.35+drift;
   vec2 q=skyTurn*p*2.03+vec2(7.1,2.9),r=skyTurn*q*2.02+vec2(3.7,8.3),t=skyTurn*r*2.01+vec2(1.3,5.1);
   float n=skyNoise(p)*.5+skyNoise(q)*.25+skyNoise(r)*.14+skyNoise(t)*.07;
   // Cloud gathers into broad masses with sky between them. Thick cloud is
   // grey underneath and thin cloud glows, so even a shower's sky has shape.
   float mass=skyNoise(skyTurn*p*.33+vec2(4.2,1.7)),m=n+(mass-.5)*.3*cover,edge=mix(.8,.18,pow(cover,1.25)),d=smoothstep(edge-.06,edge+.18,m)*smoothstep(-.02,.1,h),thick=clamp((m-edge)*2.2,0.,1.);
   vec3 cc=mix(lit,shade,clamp(thick*.95+mass*gloom*.5+gloom*.12,0.,1.));cc*=1.+.16*(1.-thick)*cover;
   c=mix(c,mix(cc,hor,1.-smoothstep(0.,.3,h)),d);}
  float noise=fract(sin(dot(gl_FragCoord.xy,vec2(127.1,311.7)))*43758.5453);gl_FragColor=vec4(c+(noise-.5)*.009,1.0);
  #include <colorspace_fragment>
 }`;
 function attach(T,scene,options){
  const hidden=[],materials=[],geometries=[],group=new T.Group();group.name='Distant Alderwing sky';group.userData.sky=true;
  const own=m=>(materials.push(m),m),geometry=g=>(geometries.push(g),g);
  const oldSky=scene.children.filter(o=>o.userData.sky);for(const o of oldSky){hidden.push([o,o.visible]);o.visible=false;}
  const oldBackground=scene.background?.clone(),oldFog=scene.fog?.color.clone(),oldExposure=options.renderer.toneMappingExposure;
  const lights=scene.children.filter(o=>o.isLight),lightState=lights.map(o=>({object:o,color:o.color?.clone(),ground:o.groundColor?.clone(),intensity:o.intensity}));
  const top=new T.Color(),mid=new T.Color(),hor=new T.Color(),lit=new T.Color(),shade=new T.Color(),base={top:new T.Color(),mid:new T.Color(),hor:new T.Color()};
  const cloudy={cover:{value:0},gloom:{value:0},drift:{value:new T.Vector2(0,0)},lit:{value:lit},shade:{value:shade}};
  const dome=new T.Mesh(geometry(new T.SphereGeometry(1,32,20)),own(new T.ShaderMaterial({side:T.BackSide,depthWrite:false,depthTest:true,fog:false,uniforms:{top:{value:top},mid:{value:mid},hor:{value:hor},...cloudy},vertexShader:vertex,fragmentShader:CLOUDS})));
  dome.frustumCulled=false;dome.renderOrder=-1000;group.add(dome);
  const positions=[],sizes=[];let seed=0x41de17;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<460;i++){const y=random()*2-1,a=random()*TAU,r=Math.sqrt(1-y*y);positions.push(r*Math.cos(a),y,r*Math.sin(a));sizes.push(.7+random()*1.1);}
  const starGeo=geometry(new T.BufferGeometry());starGeo.setAttribute('position',new T.Float32BufferAttribute(positions,3));starGeo.setAttribute('pointSize',new T.Float32BufferAttribute(sizes,1));
  const starMat=own(new T.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{rotation:{value:new T.Matrix3()},opacity:{value:0},pixelRatio:{value:1}},vertexShader:'uniform mat3 rotation;uniform float pixelRatio;attribute float pointSize;varying float horizon;void main(){vec3 d=rotation*position;horizon=smoothstep(-.03,.12,d.y);vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*d,1.0);gl_Position=p.xyww;gl_PointSize=pointSize*pixelRatio;}',fragmentShader:'uniform float opacity;varying float horizon;void main(){float r=length(gl_PointCoord-.5);float a=(1.0-smoothstep(.12,.5,r))*opacity*horizon;gl_FragColor=vec4(.78,.85,1.0,a);\n#include <colorspace_fragment>\n}'}));
  const stars=new T.Points(starGeo,starMat);stars.frustumCulled=false;stars.renderOrder=-990;group.add(stars);
  const plane=geometry(new T.PlaneGeometry(2,2));
  function disc(map,angle,tint,glow){const mat=own(new T.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{direction:{value:new T.Vector3()},angle:{value:angle},stretch:{value:new T.Vector2(1,1)},map:{value:map},tint:{value:new T.Color(tint)},opacity:{value:1}},vertexShader:'uniform vec3 direction;uniform float angle;uniform vec2 stretch;varying vec2 vUv;void main(){vUv=uv;vec4 p=projectionMatrix*vec4(mat3(viewMatrix)*direction,1.0);p.xy+=position.xy*angle*stretch*vec2(projectionMatrix[0][0],projectionMatrix[1][1]);gl_Position=p.xyww;}',fragmentShader:'uniform sampler2D map;uniform vec3 tint;uniform float opacity;varying vec2 vUv;void main(){'+(map?'vec4 c=texture2D(map,vUv);':'float r=length(vUv-.5)*2.0;vec4 c=vec4(1.0,1.0,1.0,'+(glow?'exp(-r*r*5.0)*(1.0-smoothstep(.75,1.0,r))':'1.0-smoothstep(.88,1.0,r)')+');')+'gl_FragColor=vec4(c.rgb*tint,c.a*opacity);\n#include <colorspace_fragment>\n}'}));const mesh=new T.Mesh(plane,mat);mesh.frustumCulled=false;mesh.renderOrder=glow?-981:-980;group.add(mesh);return mesh;}
  const sun=disc(null,.0065,0xfff2ce,false),sunGlow=disc(null,.055,0xffdaa0,true),moon=disc(options.moonTexture(),.008,0xffffff,false),moonGlow=disc(null,.038,0xabbfef,true);
  const axis=new T.Vector3(0,Math.sqrt(1-.85*.85),-.85).normalize(),rotation=new T.Matrix4();let lastGrade=-Infinity,current=directions(localHour()),closed=false;
  // The real weather where the player stands: cloud cover 0-1, rain 0-1 and
  // wind 0-1. The first report arrives at once; later ones roll in over
  // about twenty seconds. With no report yet, a few fair-weather clouds.
  const sky={cover:.3,rain:0,wind:.2,known:false,at:null},warm=new T.Color(0xffc27a),grey=new T.Color(),haze=new T.Color();let grade=null,keyBase=0,hemiBase=0,exposureBase=oldExposure;
  const settle=x=>{const t=Math.max(0,Math.min(1,x));return t*t*(3-2*t);};
  function ease(weather,time){const dt=sky.at===null?0:Math.min(1,Math.max(0,time-sky.at));sky.at=time;
   if(weather&&Number.isFinite(weather.cloud)){const cover=Math.max(0,Math.min(1,weather.rain>0?Math.max(weather.cloud,.86):weather.cloud)),rain=Math.max(0,Math.min(1,weather.rain||0));
    if(!sky.known){sky.cover=cover;sky.rain=rain;sky.known=true;}else{const k=1-Math.exp(-dt/7);sky.cover+=(cover-sky.cover)*k;sky.rain+=(rain-sky.rain)*k;}}
   if(weather&&Number.isFinite(weather.wind))sky.wind=weather.wind;
   const d=cloudy.drift.value;d.x=(d.x+dt*(.004+.03*sky.wind))%1024;d.y=(d.y+dt*(.002+.012*sky.wind))%1024;cloudy.cover.value=sky.cover;cloudy.gloom.value=sky.rain;}
  // A closing sky greys the whole sky and the haze, hides the sun and softens
  // the light; rain darkens it further. Blue shows between clouds until the
  // cover is nearly whole. Applied every frame, so it never steps.
  function weatherLight(){if(!grade)return;const day=grade.sun,heavy=Math.max(settle((sky.cover-.68)/.32),sky.rain),clear=(1-settle((sky.cover-.62)/.3))*(1-settle(sky.rain/.3));
   grey.setRGB(.63,.67,.72).multiplyScalar((.2+.8*day)*(1-.32*sky.rain));haze.copy(grey).multiplyScalar(1.08);
   top.copy(base.top).lerp(grey,heavy*.82);mid.copy(base.mid).lerp(grey,heavy*.86);hor.copy(base.hor).lerp(haze,heavy*.8);scene.background?.copy(hor);scene.fog?.color.copy(hor);
   lit.setRGB(.95,.95,.96).multiplyScalar((.16+.84*day)*(1-.2*sky.rain)).lerp(warm,grade.warm*.35);shade.setRGB(.5,.55,.63).multiplyScalar((.14+.86*day)*(1-.5*sky.rain));
   sun.material.uniforms.opacity.value=moon.material.uniforms.opacity.value=clear;sunGlow.material.uniforms.opacity.value=.28*clear;moonGlow.material.uniforms.opacity.value=.18*clear;starMat.uniforms.opacity.value=grade.stars*.85*(1-sky.cover);
   for(const l of lights){if(l.isHemisphereLight)l.intensity=hemiBase*(1+.18*heavy);else if(l.isDirectionalLight&&l.castShadow)l.intensity=keyBase*(1-.58*heavy);}
   options.renderer.toneMappingExposure=exposureBase*(1-.08*sky.rain);}
  function update(time,weather){if(closed)return;current=directions(localHour());for(const o of [sun,sunGlow])o.material.uniforms.direction.value.copy(current.sun);for(const o of [moon,moonGlow])o.material.uniforms.direction.value.copy(current.moon);sun.visible=sunGlow.visible=current.sun.y>-.06;moon.visible=moonGlow.visible=current.moon.y>-.06;rotation.makeRotationAxis(axis,current.rotation);starMat.uniforms.rotation.value.setFromMatrix4(rotation);starMat.uniforms.pixelRatio.value=Math.min(2,options.renderer.getPixelRatio());
   ease(weather,time);
   if(time-lastGrade>=1||!grade){lastGrade=time;grade=options.grade();const cols=options.colors(grade,options.palette);base.top.copy(cols.top);base.mid.copy(cols.mid);base.hor.copy(cols.hor);stars.visible=grade.stars>.002;
    const pal=options.palette,graded=root.BurbzDaylightCore.gradePalette(pal,grade);for(const l of lights){if(l.isHemisphereLight){l.color.set(graded.hemiSky);l.groundColor.set(graded.hemiGround);hemiBase=Math.max(1.45,grade.hemi*.64);}else if(l.isDirectionalLight&&l.castShadow){l.color.set(grade.keyColor).lerp(new T.Color(0xffdca4),grade.sun*.22);keyBase=grade.keyIntensity*1.08;}}
    exposureBase=grade.exposure*.92;}
   weatherLight();
  }
  scene.add(group);update(0);
  return{group,update,direction:()=>current.sun.y>=0?current.sun:current.moon,shadowEpoch:()=>Math.floor(current.hour*60),weather:()=>({cover:sky.cover,rain:sky.rain,wind:sky.wind,known:sky.known}),diagnostics:()=>({hour:current.hour,sun:{...current.sun},moon:{...current.moon},draws:group.children.filter(o=>o.visible).length,translationIndependent:true,weather:{cover:+sky.cover.toFixed(3),rain:+sky.rain.toFixed(3),known:sky.known}}),dispose(){if(closed)return;closed=true;group.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());for(const[o,visible]of hidden)o.visible=visible;for(const old of lightState){if(old.color)old.object.color.copy(old.color);if(old.ground)old.object.groundColor.copy(old.ground);old.object.intensity=old.intensity;}if(oldBackground)scene.background.copy(oldBackground);if(oldFog)scene.fog?.color.copy(oldFog);options.renderer.toneMappingExposure=oldExposure;}};
 }
 return{directions,localHour,attach};
});
