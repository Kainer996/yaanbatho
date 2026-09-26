/* Draw the provider's polygon coverage once per retained terrain chunk.
 * The shader colours existing ground; it cannot alter terrain or collision.
 * Water reflects the real sky: brighter the flatter the view across it,
 * glinting where the sun or moon lies, deeper away from the shore. Rivers
 * mapped as areas flow along their mapped centre lines. One water look is
 * shared by streams, lakes, the sea and the distant water, so they meet
 * with no seam. */
(function(root){'use strict';
const SIZE=128,PAD=2,FLOWS=8;
function coverage(cell,width,entries,project,exclusions=[]){
 const step=width/(SIZE-2*PAD),x0=cell.x-PAD*step,z0=cell.z-PAD*step,span=SIZE*step;
 const rows=entries.filter(e=>e.kind==='water'&&e.bounds.x1>=x0&&e.bounds.x0<=x0+span&&e.bounds.z1>=z0&&e.bounds.z0<=z0+span);
 if(!rows.length)return null;
 const canvas=document.createElement('canvas');canvas.width=canvas.height=SIZE;const ctx=canvas.getContext('2d');
 // Red is water, green the sea, blue a river that flows.
 for(const row of rows){const polys=row.geometry.type==='Polygon'?[row.geometry.coordinates]:row.geometry.type==='MultiPolygon'?row.geometry.coordinates:[];
  ctx.fillStyle=/ocean|sea/.test(row.waterClass)?'#ffff00':row.river||/\briver\b/.test(row.waterClass||'')?'#ff00ff':'#ff0000';
  for(const polygon of polys){ctx.beginPath();for(const ring of polygon){let first=true;for(const v of ring){const p=project(v);if(!p)continue;const x=(p.x-x0)/step,z=(p.z-z0)/step;if(first){ctx.moveTo(x,z);first=false;}else ctx.lineTo(x,z);}ctx.closePath();}ctx.fill('evenodd');}
 }
 ctx.globalCompositeOperation='destination-out';for(const p of exclusions){ctx.beginPath();ctx.arc((p.x-x0)/step,(p.z-z0)/step,p.radius/step,0,Math.PI*2);ctx.fill();}
 const pixels=ctx.getImageData(0,0,SIZE,SIZE).data;let any=false,full=true,flowing=false;const sea=pixels[1]===255,river=pixels[2]===255;
 for(let i=0;i<pixels.length;i+=4){any||=pixels[i+3]>0;flowing||=pixels[i+3]>0&&pixels[i+2]>127;if(pixels[i+3]!==255||(pixels[i+1]===255)!==sea||(pixels[i+2]===255)!==river)full=false;}
 return any?{canvas,x0,z0,span,step,flowing,fullWater:full?(sea?'sea':river?'river':'freshwater'):null}:null;
}
// Shared inputs for every water material: light direction, the colour
// overhead, the water clock and the one ripple tile. Owners update the
// values each frame.
const sky={sun:{value:null},zenith:{value:null},time:{value:0},map:{value:null},rain:{value:0}};
function init(){const T=root.THREE;
 if(!sky.sun.value){sky.sun.value=new T.Vector3(.3,.85,.4).normalize();sky.zenith.value=new T.Color(.45,.62,.85);}
 if(!sky.map.value){const made=root.BurbzWorldWaterCore?.texture?.(128)||{size:1,data:new Uint8Array([128,128,128,0])};
  const map=new T.DataTexture(made.data,made.size,made.size,T.RGBAFormat,T.UnsignedByteType);map.wrapS=map.wrapT=T.RepeatWrapping;map.magFilter=T.LinearFilter;map.minFilter=T.LinearMipmapLinearFilter;map.generateMipmaps=made.size>1;map.anisotropy=4;map.needsUpdate=true;sky.map.value=map;}
 return sky;}
function uniforms(){init();return{shoreTime:sky.time,shoreSun:sky.sun,shoreZenith:sky.zenith,shoreMap:sky.map,shoreRain:sky.rain};}
// GLSL shared by every water surface. Include it after fog_pars_fragment.
const CHUNK=`#ifdef USE_FOG
uniform sampler2D shoreMap;uniform float shoreTime;uniform vec3 shoreSun;uniform vec3 shoreZenith;uniform float shoreRain;
// The ripple tile moving with the water: two phases of the flow crossfade,
// so the pattern travels without ever stretching. vel is metres a second.
vec4 shoreTap(vec2 p,vec2 vel,float tile,float cycle,float offset){
 float ph=fract(shoreTime/cycle+offset),pb=fract(ph+.5),w=abs(ph*2.-1.);
 vec4 a=texture2D(shoreMap,(p-vel*(ph*cycle))/tile),b=texture2D(shoreMap,(p-vel*(pb*cycle))/tile+vec2(.37,.61));
 vec4 m=mix(a,b,w);m.rg=(m.rg*2.-1.)/sqrt(w*w+(1.-w)*(1.-w));return m;}
// Near ripples fade into the long, smooth mirror of distant water.
float shoreFar(vec3 world){return smoothstep(30.,190.,distance(cameraPosition.xz,world.xz));}
// Open water: the colour below, the sky mirrored more at low angles and the
// sun or moon glinting. Reflected rays lower than bank (the sine of its
// angle) meet banks and trees, which mirror dark: a beck mostly mirrors its
// banks, a lake its far shore only at the horizon.
vec3 shoreSurface(vec3 base,vec3 world,vec2 slope,float mirror,float bank){
 vec3 n=normalize(vec3(-slope.x,1.,-slope.y)),v=normalize(cameraPosition-world),r=reflect(-v,n);r.y=abs(r.y);
 float fresnel=.02+.98*pow(1.-max(dot(n,v),0.),5.),open=bank>0.?smoothstep(bank*.3,bank*1.6,r.y):1.;
 vec3 skyTone=mix(fogColor*.96,shoreZenith,smoothstep(.02,.6,r.y));
 skyTone=mix(mix(vec3(.05,.07,.045)*(.3+.7*clamp(dot(fogColor,vec3(.3333)),0.,1.)),skyTone,.18),skyTone,open);
 vec3 c=mix(base,skyTone,clamp(fresnel*mirror,0.,1.));
 float sun=max(dot(r,shoreSun),0.)*step(0.,shoreSun.y);
 return c+vec3(1.,.95,.84)*(pow(sun,280.)*1.8+pow(sun,26.)*.07)*mirror*open;}
// In a shower, drops ring the water: each cell of two offset grids holds one
// drop at a time, at its own place and moment, spreading and fading.
vec2 shoreDrops(vec2 p){if(shoreRain<.01)return vec2(0.);vec2 s=vec2(0.);
 for(int k=0;k<2;k++){vec2 q=p/.85+float(k)*.5,cell=floor(q),f=fract(q)-.5;float h=fract(sin(dot(cell,vec2(127.1,311.7))+float(k)*7.)*43758.5453),g=fract(h*97.13);
  float t=fract(shoreTime*.8+h),r=length(f-(vec2(g,fract(h*7.7))-.5)*.5),ring=exp(-pow((r-t*.42)*16.,2.))*(1.-t)*step(h,shoreRain*.85);
  s+=(f-(vec2(g,fract(h*7.7))-.5)*.5)/max(r,1e-3)*ring*.55;}
 return s*(1.-shoreFar(vec3(p.x,0.,p.y))*.9);}
// Still water drifts with a light breeze: two scales, two directions.
vec2 shoreStill(vec3 world){float far=shoreFar(world);vec2 p=world.xz;
 vec2 s=shoreTap(p,vec2(.13,.08),8.,3.1,0.).rg*.6+shoreTap(p,vec2(-.07,.15),2.6,2.2,.4).rg*.4*(1.-far*.7);
 return s*mix(.62,.2,far);}
#endif`;
function style(material,time,{texture,x0,z0,span,sea=0,flows=null,flowSpeed=.8}={}){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey,flowing=!!flows?.length;
 init();
 material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);Object.assign(shader.uniforms,uniforms());shader.uniforms.shoreTime=time||sky.time;
  shader.vertexShader='varying vec3 shoreWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshoreWorld=(modelMatrix*vec4(position,1.0)).xyz;');
  shader.fragmentShader='varying vec3 shoreWorld;\n'+(texture?'uniform sampler2D shoreMask; uniform vec3 shoreFrame;\n':'')+(flowing?`uniform vec4 shoreFlow[${FLOWS}];uniform float shoreFlows;uniform float shoreFlowSpeed;\n`:'')+shader.fragmentShader;
  if(texture){shader.uniforms.shoreMask={value:texture};shader.uniforms.shoreFrame={value:new root.THREE.Vector3(x0,z0,span)};}
  if(flowing){const rows=[];for(let i=0;i<FLOWS;i++){const f=flows[i];rows.push(new root.THREE.Vector4(f?.ax||0,f?.az||0,f?.bx||0,f?.bz||0));}shader.uniforms.shoreFlow={value:rows};shader.uniforms.shoreFlows={value:Math.min(FLOWS,flows.length)};shader.uniforms.shoreFlowSpeed={value:flowSpeed};}
  shader.fragmentShader=shader.fragmentShader.replace('#include <fog_pars_fragment>','#include <fog_pars_fragment>\n'+CHUNK+(flowing?`
 #ifdef USE_FOG
 // A river area flows the way its nearest mapped centre lines run.
 vec2 shoreCurrent(vec2 p){vec2 sum=vec2(0.);float total=0.;
  for(int i=0;i<${FLOWS};i++){if(float(i)>=shoreFlows)break;vec4 s=shoreFlow[i];vec2 ab=s.zw-s.xy;float t=clamp(dot(p-s.xy,ab)/max(dot(ab,ab),1e-4),0.,1.);float d=length(p-s.xy-ab*t),w=1./(d*d+36.);sum+=ab/max(length(ab),1e-4)*w;total+=w;}
  return total>0.?sum/total:vec2(0.);}
 #endif`:''));
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 ${texture?`vec2 shoreUv=(shoreWorld.xz-shoreFrame.xy)/shoreFrame.z;vec4 shore=texture2D(shoreMask,shoreUv);
 float shoreOpen=(texture2D(shoreMask,shoreUv+vec2(3.,0.)/shoreFrame.z).a+texture2D(shoreMask,shoreUv-vec2(3.,0.)/shoreFrame.z).a+texture2D(shoreMask,shoreUv+vec2(0.,3.)/shoreFrame.z).a+texture2D(shoreMask,shoreUv-vec2(0.,3.)/shoreFrame.z).a)*.25;`:'vec4 shore=vec4(1.,'+(sea?'1.':'0.')+','+(flowing?'1.':'0.')+',1.);float shoreOpen=1.;'}
 float sea=shore.g;
 #ifdef USE_FOG
 vec2 shoreSlope=vec2(0.);float shoreFoam=0.;
 if(shore.a>.001){
  float far=shoreFar(shoreWorld);
  ${flowing?`vec2 current=shoreCurrent(shoreWorld.xz)*shoreFlowSpeed*shore.b;`:'vec2 current=vec2(0.);'}
  // Flowing water carries its ripples downstream; still water drifts.
  if(dot(current,current)>1e-4){vec4 a=shoreTap(shoreWorld.xz,current,6.5,2.,0.),b=shoreTap(shoreWorld.xz,current*1.1+vec2(.04,-.03),2.2,1.6,.3);
   shoreSlope=(a.rg*.6+b.rg*.4*(1.-far*.7))*mix(.7,.22,far);shoreFoam=smoothstep(.74,.9,a.b*.6+b.b*.4)*.55*(1.-far);}
  else shoreSlope=shoreStill(shoreWorld);
  shoreSlope+=shoreDrops(shoreWorld.xz);
  // The open sea rolls in long swells under the ripples.
  vec2 sp=shoreWorld.xz,d1=vec2(.8,.6),d2=vec2(-.45,.89);float t=shoreTime;
  shoreSlope+=sea*(d1*cos(dot(sp,d1)*.35-t*1.05)*.07+d2*cos(dot(sp,d2)*.7-t*1.45)*.04)*(1.-far*.6);
  // A soft, broken line of foam laps where the water meets the land.
  float edge=(1.-smoothstep(.2,.9,shore.a))*smoothstep(.02,.2,shore.a),lap=texture2D(shoreMap,sp/3.1+vec2(t*.021,-t*.017)).b;
  shoreFoam=max(shoreFoam,edge*smoothstep(.35,.6,lap+.18*sin(t*1.6+sp.x*.7+sp.y*.5))*(.6+sea*.4));
 }
 #endif
 // Shallows near the bank are lighter and greener; open water is deep.
 vec3 water=mix(mix(vec3(.1,.2,.18),vec3(.07,.2,.23),sea),mix(vec3(.018,.05,.07),vec3(.012,.04,.08),sea),smoothstep(.45,1.,shoreOpen));
 #ifdef USE_FOG
 // Light plays over the shallow bed.
 if(shore.a>.001&&shoreOpen<.99){vec2 cp=shoreWorld.xz;float caustic=texture2D(shoreMap,cp/2.3+shoreTime*vec2(.023,.011)).a*texture2D(shoreMap,cp/2.9-shoreTime*vec2(.017,.021)).a;water+=vec3(.36,.4,.33)*caustic*(1.-smoothstep(.3,.9,shoreOpen))*(1.-shoreFar(shoreWorld));}
 water=mix(water,vec3(.86,.91,.9),shoreFoam);
 #endif
 ${texture?'water=mix(vec3(.3,.31,.25),water,smoothstep(.05,.7,shore.a));':''}
 diffuseColor.rgb=mix(diffuseColor.rgb,water,shore.a);`);
  shader.fragmentShader=shader.fragmentShader.replace('#include <fog_fragment>',`#ifdef USE_FOG
 if(shore.a>.001)gl_FragColor.rgb=mix(gl_FragColor.rgb,shoreSurface(gl_FragColor.rgb,shoreWorld,shoreSlope,(1.-shoreFoam)*.92,0.),shore.a);
 #endif
 #include <fog_fragment>`);
 };
 material.customProgramCacheKey=function(){return key.call(this)+':shore-water-v496:'+!!texture+':'+sea+':'+flowing;};material.needsUpdate=true;
}
root.BurbzShoreWater={coverage,style,sky,init,uniforms,CHUNK,SIZE,PAD,FLOWS};
})(globalThis);
