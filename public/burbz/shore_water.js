/* Draw the provider's polygon coverage once per retained terrain chunk.
 * The shader colours existing ground; it cannot alter terrain or collision.
 * Water reflects the real sky: brighter the flatter the view across it,
 * glinting where the sun or moon lies, deeper away from the shore. */
(function(root){'use strict';
const SIZE=128,PAD=2;
function coverage(cell,width,entries,project,exclusions=[]){
 const step=width/(SIZE-2*PAD),x0=cell.x-PAD*step,z0=cell.z-PAD*step,span=SIZE*step;
 const rows=entries.filter(e=>e.kind==='water'&&e.bounds.x1>=x0&&e.bounds.x0<=x0+span&&e.bounds.z1>=z0&&e.bounds.z0<=z0+span);
 if(!rows.length)return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const ctx=canvas.getContext('2d');
 for(const row of rows){const polys=row.geometry.type==='Polygon'?[row.geometry.coordinates]:row.geometry.type==='MultiPolygon'?row.geometry.coordinates:[];
  ctx.fillStyle=/ocean|sea/.test(row.waterClass)?'#ffff00':'#ff0000';
  for(const polygon of polys){ctx.beginPath();for(const ring of polygon){let first=true;for(const v of ring){const p=project(v);if(!p)continue;const x=(p.x-x0)/step,z=(p.z-z0)/step;if(first){ctx.moveTo(x,z);first=false;}else ctx.lineTo(x,z);}ctx.closePath();}ctx.fill('evenodd');}
 }
 ctx.globalCompositeOperation='destination-out';for(const p of exclusions){ctx.beginPath();ctx.arc((p.x-x0)/step,(p.z-z0)/step,p.radius/step,0,Math.PI*2);ctx.fill();}
 const pixels=ctx.getImageData(0,0,SIZE,SIZE).data;let any=false,full=true,sea=pixels[1]===255;
 for(let i=0;i<pixels.length;i+=4){any||=pixels[i+3]>0;if(pixels[i+3]!==255||(pixels[i+1]===255)!==sea)full=false;}
 return any?{canvas,x0,z0,span,step,fullWater:full?(sea?'sea':'freshwater'):null}:null;
}
// Shared sky inputs for every water material: light direction and the colour
// overhead. Owners update the values each frame.
const sky={sun:{value:null},zenith:{value:null}};
function style(material,time,{texture,x0,z0,span,sea=0}={}){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey,T=root.THREE;
 if(!sky.sun.value){sky.sun.value=new T.Vector3(.3,.85,.4).normalize();sky.zenith.value=new T.Color(.45,.62,.85);}
 material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.uniforms.shoreTime=time;shader.uniforms.shoreSun=sky.sun;shader.uniforms.shoreZenith=sky.zenith;
  shader.vertexShader='varying vec3 shoreWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshoreWorld=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader='uniform float shoreTime; uniform vec3 shoreSun; uniform vec3 shoreZenith; varying vec3 shoreWorld;\n'+(texture?'uniform sampler2D shoreMask; uniform vec3 shoreFrame;\n':'')+shader.fragmentShader;
  if(texture){shader.uniforms.shoreMask={value:texture};shader.uniforms.shoreFrame={value:new T.Vector3(x0,z0,span)};}
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 ${texture?`vec2 shoreUv=(shoreWorld.xz-shoreFrame.xy)/shoreFrame.z;vec4 shore=texture2D(shoreMask,shoreUv);
 float shoreOpen=(texture2D(shoreMask,shoreUv+vec2(3.,0.)/shoreFrame.z).a+texture2D(shoreMask,shoreUv-vec2(3.,0.)/shoreFrame.z).a+texture2D(shoreMask,shoreUv+vec2(0.,3.)/shoreFrame.z).a+texture2D(shoreMask,shoreUv-vec2(0.,3.)/shoreFrame.z).a)*.25;`:'vec4 shore=vec4(1.,'+(sea?'1.':'0.')+',0.,1.);float shoreOpen=1.;'}
 float sea=shore.g;
 // Shallows near the bank are lighter and greener; open water is deep.
 vec3 water=mix(mix(vec3(.1,.2,.18),vec3(.07,.2,.23),sea),mix(vec3(.018,.05,.07),vec3(.012,.04,.08),sea),smoothstep(.45,1.,shoreOpen));
 ${texture?'water=mix(vec3(.3,.31,.25),water,smoothstep(.05,.7,shore.a));':''}
 diffuseColor.rgb=mix(diffuseColor.rgb,water,shore.a);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#ifdef USE_FOG
 if(shore.a>.001){
  vec2 p=shoreWorld.xz;float t=shoreTime,swell=mix(.6,1.25,sea);
  vec2 d1=vec2(.8,.6),d2=vec2(-.45,.89),d3=vec2(.13,-.99);
  vec2 slope=d1*cos(dot(p,d1)*.55-t*(1.1+sea*.3))*.085+d2*cos(dot(p,d2)*1.3-t*1.7)*.05+d3*cos(dot(p,d3)*2.9-t*2.5)*.025;
  vec3 n=normalize(vec3(-slope.x*swell,1.,-slope.y*swell)),v=normalize(cameraPosition-shoreWorld),r=reflect(-v,n);
  float fresnel=.02+.98*pow(1.-max(dot(n,v),0.),5.);
  vec3 skyTone=mix(fogColor*.92,shoreZenith,clamp(r.y*2.2,0.,1.));
  // Wave faces tilted away from the viewer catch darker sky; ridges catch light.
  float sparkle=clamp(dot(slope,normalize(v.xz+1e-4))*6.,-1.,1.);
  gl_FragColor.rgb=mix(gl_FragColor.rgb*(1.+sparkle*.12),skyTone*(1.-sparkle*.08),min(.85,fresnel*.8)*shore.a);
  float glint=pow(max(dot(r,shoreSun),0.),140.)*step(0.,shoreSun.y);
  gl_FragColor.rgb+=vec3(1.,.95,.84)*glint*(.55+.35*sea)*shore.a;
  // A soft, moving line of foam where the water meets the land.
  float edge=(1.-smoothstep(.2,.9,shore.a))*smoothstep(.02,.2,shore.a);
  gl_FragColor.rgb=mix(gl_FragColor.rgb,vec3(.9,.94,.93),edge*(.35+.3*sin(p.x*1.9+p.y*1.4+t*2.2))*(.55+sea*.45));
 }
 #endif
 #include <fog_fragment>`);
 };
 material.customProgramCacheKey=function(){return key.call(this)+':shore-water-v462:'+!!texture+':'+sea;};material.needsUpdate=true;
}
root.BurbzShoreWater={coverage,style,sky,SIZE,PAD};
})(globalThis);
