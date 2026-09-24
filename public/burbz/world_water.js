/* Moving water for Alderwing: flowing streams, white water on steep ground,
 * waterfalls with plunge pools, and spray. One stream material is shared by
 * every chunk; spray is one point cloud for the whole view. */
(function(root){'use strict';
function streamMaterial(T,{time,style}){
 const m=new T.MeshLambertMaterial({color:0xffffff});
 m.onBeforeCompile=shader=>{shader.uniforms.streamTime=time;
  shader.vertexShader='attribute vec3 streamFlow;\nvarying vec3 vStreamFlow;\nvarying vec3 vStreamWorld;\n'+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvStreamFlow=streamFlow;\nvStreamWorld=(modelMatrix*vec4(transformed,1.0)).xyz;');
  shader.fragmentShader='uniform float streamTime;\nvarying vec3 vStreamFlow;\nvarying vec3 vStreamWorld;\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 // Water races faster and whiter the steeper the real ground below it.
 float along=vStreamFlow.x,side=vStreamFlow.y,steep=vStreamFlow.z,speed=mix(.7,4.2,steep),t=streamTime*speed;
 float ripple=sin(along*1.4-t*2.1+sin(side*2.7+along*.37)*1.6)*.5+.5;
 float fine=sin(along*4.3-t*3.4+side*5.3+sin(along*.9)*2.)*.5+.5;
 float streak=smoothstep(.55,1.,ripple)*.6+smoothstep(.68,1.,fine)*.4;
 float white=clamp(steep*1.35-.15,0.,1.)*(.62+.38*streak);
 float bank=smoothstep(.72,1.,abs(side))*.45;
 vec3 water=mix(vec3(.045,.11,.13),vec3(.13,.26,.25),.35+.4*streak);
 diffuseColor.rgb=mix(water,vec3(.9,.95,.96),max(white,bank*(.5+.5*fine)));`).replace('#include <fog_fragment>',`#ifdef USE_FOG
 // Calm stretches mirror the sky; white water stays white.
 float glance=1.0-max(normalize(cameraPosition-vStreamWorld).y,0.0);
 gl_FragColor.rgb=mix(gl_FragColor.rgb,fogColor*1.04,(.08+.62*pow(glance,4.0))*(1.0-clamp(vStreamFlow.z*1.4,0.,1.)));
 #endif
 #include <fog_fragment>`);};
 m.customProgramCacheKey=()=> 'alderwing-stream-v1';style(m);return m;
}
function streamMesh(T,data,material){
 if(!data.indices.length)return null;const g=new T.BufferGeometry();
 g.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));g.setAttribute('streamFlow',new T.Float32BufferAttribute(data.flow,3));g.setIndex(data.indices);g.computeVertexNormals();g.computeBoundingSphere();
 const mesh=new T.Mesh(g,material);mesh.receiveShadow=true;mesh.name='Alderwing stream';return mesh;
}
// Soft spray over every plunge pool in view: one draw, drifting and pulsing.
function createSpray(T,scene,{time}){
 const canvas=document.createElement('canvas');canvas.width=canvas.height=64;const x=canvas.getContext('2d'),g=x.createRadialGradient(32,32,2,32,32,31);
 g.addColorStop(0,'rgba(255,255,255,.9)');g.addColorStop(.45,'rgba(240,248,250,.45)');g.addColorStop(1,'rgba(240,248,250,0)');x.fillStyle=g;x.fillRect(0,0,64,64);
 const texture=new T.CanvasTexture(canvas),owners=new Map(),size=new T.Vector2();let geometry=null,points=null,dirty=false;
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,fog:false,uniforms:{sprayMap:{value:texture},sprayTime:time,sprayScale:{value:300},fogColor:{value:new T.Color()},fogNear:{value:1},fogFar:{value:2000}},
  vertexShader:'attribute float spraySize;attribute float sprayPhase;uniform float sprayTime;uniform float sprayScale;varying float vSprayAlpha;varying float vFogDepth;\nvoid main(){float pulse=.5+.5*sin(sprayTime*1.7+sprayPhase);vec3 p=position+vec3(sin(sprayTime*.6+sprayPhase)*.25,pulse*.5,cos(sprayTime*.5+sprayPhase)*.25);vec4 mv=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mv;gl_PointSize=spraySize*(.8+.4*pulse)*sprayScale/max(1.0,-mv.z);vSprayAlpha=.22+.16*(1.0-pulse);vFogDepth=-mv.z;}',
  fragmentShader:'uniform sampler2D sprayMap;uniform vec3 fogColor;uniform float fogNear;uniform float fogFar;varying float vSprayAlpha;varying float vFogDepth;\nvoid main(){vec4 c=texture2D(sprayMap,gl_PointCoord);float fog=smoothstep(fogNear,fogFar,vFogDepth);gl_FragColor=vec4(mix(c.rgb,fogColor,fog),c.a*vSprayAlpha*(1.0-fog));}'});
 function rebuild(){dirty=false;const rows=[...owners.values()].flat();if(points){points.removeFromParent();geometry.dispose();points=null;}if(!rows.length)return;
  geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(rows.flatMap(r=>[r.x,r.y,r.z]),3));geometry.setAttribute('spraySize',new T.Float32BufferAttribute(rows.map(r=>r.size),1));geometry.setAttribute('sprayPhase',new T.Float32BufferAttribute(rows.map(r=>r.phase),1));
  points=new T.Points(geometry,material);points.frustumCulled=false;points.renderOrder=20;points.name='Alderwing spray';scene.add(points);}
 return{set(owner,rows){if(rows?.length)owners.set(owner,rows);else if(!owners.delete(owner))return;dirty=true;},
  update(renderer,fog){if(dirty)rebuild();material.uniforms.sprayScale.value=renderer.getSize(size).y*renderer.getPixelRatio()*.5;if(fog){material.uniforms.fogColor.value.copy(fog.color);material.uniforms.fogNear.value=fog.near;material.uniforms.fogFar.value=fog.far;}},
  count:()=>[...owners.values()].reduce((n,r)=>n+r.length,0),
  dispose(){if(points){points.removeFromParent();geometry.dispose();}material.dispose();texture.dispose();owners.clear();}};
}
root.BurbzWorldWater={streamMaterial,streamMesh,createSpray};
})(globalThis);
