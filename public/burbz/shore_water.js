/* Draw the provider's polygon coverage once per retained terrain chunk.
 * The shader colours existing ground; it cannot alter terrain or collision. */
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
 return{canvas,x0,z0,span,step};
}
function style(material,time,{texture,x0,z0,span}={}){
 const previous=material.onBeforeCompile,key=material.customProgramCacheKey;
 material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.uniforms.shoreTime=time;
  shader.vertexShader='varying vec2 shoreWorld;\n'+shader.vertexShader;
  shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nshoreWorld=(modelMatrix*vec4(position,1.0)).xz;');
  shader.fragmentShader='uniform float shoreTime; varying vec2 shoreWorld;\n'+(texture?'uniform sampler2D shoreMask; uniform vec3 shoreFrame;\n':'')+shader.fragmentShader;
  if(texture){shader.uniforms.shoreMask={value:texture};shader.uniforms.shoreFrame={value:new root.THREE.Vector3(x0,z0,span)};}
  shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 ${texture?'vec4 shore=texture2D(shoreMask,(shoreWorld-shoreFrame.xy)/shoreFrame.z);':'vec4 shore=vec4(1.,0.,0.,1.);'}
 float sea=shore.g;
 float wave=sin(shoreWorld.x*.67+shoreWorld.y*.43-shoreTime*(1.05+sea*.4));
 float ripple=sin(shoreWorld.x*1.9-shoreWorld.y*1.4+shoreTime*1.3+wave*.6);
 vec3 water=mix(vec3(.10,.29,.32),vec3(.07,.22,.31),sea);
 water+=vec3(.026,.055,.052)*(wave*.5+ripple*.25);
 float glint=pow(max(0.,ripple),12.)*(.055+sea*.035);
 water+=vec3(.55,.77,.71)*glint;
 ${texture?'water=mix(vec3(.28,.43,.37),water,smoothstep(.05,.9,shore.a));':''}
 diffuseColor.rgb=mix(diffuseColor.rgb,water,shore.a);`);
 };
 material.customProgramCacheKey=function(){return key.call(this)+':shore-water-v418:'+!!texture;};material.needsUpdate=true;
}
root.BurbzShoreWater={coverage,style,SIZE,PAD};
})(globalThis);
