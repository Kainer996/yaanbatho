/* Extend the borrowed settlement scene. Its canvas, camera, lights, actors,
 * materials, controls and frame owner survive every outdoor boundary crossing.
 * MapLibre is a bounded, offscreen tile decoder, never a second visible view. */
(function(root){'use strict';
const K=()=>root.BurbzVillageWorldCore,C=()=>root.BurbzGeographicWorldCore,N=()=>root.BurbzWorldNatureCore;
const DEM='continuous-walk-dem',MAX_TILES=32,MAX_FEATURES=1800,COVER_CELL=64,KEEP={cover:900,water:200,stream:300,road:400},LAYER_LIMIT={landcover:900,landuse:240,water:200,waterway:300,transportation:400},DETAIL=104,HAZE=[140,4300],SHADE=[70,100];
const sleep=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function homeActions(s,opts,pose,covered){
 const button=document.createElement('button');button.type='button';button.className='cw-build-home';button.setAttribute('data-walk-action','home');button.textContent='Quest: Build your house';button.hidden=true;s.root.append(button);
 const dialog=document.createElement('dialog');dialog.className='cw-home-dialog';dialog.style.cssText='inset:0;margin:auto;max-width:min(360px,calc(100vw - 28px));max-height:85dvh;overflow:auto;padding:22px;border:1px solid #c9b27b;border-radius:12px;background:#20382c;color:#fff3d1';
 dialog.innerHTML='<h2>Build house here?</h2><p>A cosy cottage costs 25 timber. This exact place will become your permanent home in every view of Alderwing.</p><p class="cw-home-error" role="status"></p><button type="button" data-home-no>No, keep exploring</button> <button type="button" data-home-yes>Yes, build here · 25 timber</button>';s.root.append(dialog);
 for(const b of dialog.querySelectorAll('button'))b.style.cssText='min-height:44px;margin-top:10px;padding:8px';
 let chosen=null,closed=false;
 const error=dialog.querySelector('.cw-home-error'),yes=dialog.querySelector('[data-home-yes]');
 function suitable(){if(s.room||s.player.mode!=='walk'||!covered(s.player.x,s.player.z))return false;const h=s.world.height(s.player.x,s.player.z);if(!Number.isFinite(h))return false;for(let x=-4;x<=4;x++)for(let z=-3;z<=4;z++){const px=s.player.x+x,pz=s.player.z+z,y=s.world.height(px,pz);if(!s.world.allowed(px,pz)||!Number.isFinite(y)||Math.abs(y-h)>1)return false;}return true;}
 function finish(){dialog.close();chosen=null;s.uiBusy=false;s.reset();if(!closed)s.root.querySelector('.vw-look')?.focus({preventScroll:true});}
 button.addEventListener('click',async()=>{if(s.uiBusy||s.failed)return;const home=opts.getHome?.();if(!home||home.tier!==0)return;chosen={pose:pose(),revision:home.anchor?.revision,player:{x:s.player.x,z:s.player.z}};s.reset();s.uiBusy=true;error.textContent=suitable()?'':'Choose a clear, gently sloping patch with room for the house and its doorway.';yes.disabled=!!error.textContent;dialog.showModal();dialog.querySelector('[data-home-no]').focus();if(!yes.disabled&&opts.checkHome){yes.disabled=true;error.textContent='Checking the house footprint and nearby settlements…';const selection=chosen;try{const result=await opts.checkHome(chosen.pose);if(closed||chosen!==selection)return;error.textContent=result.ok?'':result.error;yes.disabled=!result.ok;}catch(e){if(!closed&&chosen===selection){error.textContent=e.message;yes.disabled=true;}}}},{signal:s.abort.signal});
 dialog.querySelector('[data-home-no]').addEventListener('click',finish,{signal:s.abort.signal});dialog.addEventListener('cancel',e=>{e.preventDefault();finish();},{signal:s.abort.signal});
 yes.addEventListener('click',async()=>{if(!chosen||yes.disabled)return;if(!suitable()||Math.hypot(s.player.x-chosen.player.x,s.player.z-chosen.player.z)>.01){error.textContent='Your position changed. Close this question and choose the place again.';yes.disabled=true;return;}yes.disabled=true;try{const selection=chosen,result=await opts.buildHome?.(selection.pose,selection.revision,()=>!closed&&chosen===selection&&!s.closed);if(closed||chosen!==selection||s.closed)return;if(!result?.ok){error.textContent=result?.error||'The house could not be saved. Nothing was spent.';yes.disabled=false;return;}finish();await opts.enterHome?.();}catch(e){error.textContent=e.message;yes.disabled=false;}},{signal:s.abort.signal});
 const welcome=document.createElement('aside');welcome.className='cw-welcome';welcome.hidden=true;welcome.style.cssText='position:absolute;left:14px;top:128px;z-index:6;max-width:min(320px,calc(100vw - 28px));max-height:40dvh;overflow:auto;background:#20382ceb;color:#fff3d1;padding:12px;border:1px solid #c9b27b;border-radius:10px;font-size:14px';welcome.innerHTML='<strong>Merlin</strong><p>Alderwing is an alternate Earth where birds are the dominant species. Take a look around — this world is yours to explore.</p><p>When you’re ready, turn back to the shelter and sit at the desk. I’ll show you how to manage things from Home.</p><button type="button" style="min-height:44px">Keep exploring</button>';s.root.append(welcome);let shown=false;
 welcome.querySelector('button').addEventListener('click',()=>welcome.hidden=true,{signal:s.abort.signal});
 return{update(){const home=opts.getHome?.();button.hidden=!opts.buildHome||!home||home.tier!==0||home.arrival!=='done'||!!s.room||s.player.mode!=='walk'||s.uiBusy;if(root.BurbzAlderwingIntro?.active()){shown=true;welcome.hidden=true;}if(!shown&&home?.arrival==='outside'&&!s.room){shown=true;welcome.hidden=false;}if(s.uiBusy||s.room)welcome.hidden=true;},dispose(){closed=true;if(dialog.open)dialog.close();button.remove();dialog.remove();welcome.remove();}};
}
async function attach(s,opts){
 const T=root.THREE,k=K(),scene=s.source.scene,origin={lat:opts.record.lat,lon:opts.record.lon,altitude:0},merc=k.mercator(origin);
 const surface=scene.userData.walkSurface,terrain=scene.userData.walkTerrain;
 if(!surface?.ground||!terrain?.heightAt||!C().validCoordinate(origin))throw Error('The settlement landscape is unavailable.');
 const initial=opts.initialPose&&C().project(origin,opts.initialPose);if(initial)Object.assign(s.player,{x:initial.x,z:initial.z,yaw:opts.initialPose.yaw||0,pitch:opts.initialPose.pitch||0,mode:['fly','swim'].includes(opts.initialPose.mode)?opts.initialPose.mode:'walk'});
 let baseWorld=s.world,datum=null,map=null,closed=false,loaded=false,idle=false,lastStream=-Infinity,lastSave=0,lastCentre=null;
 let lookup=[],waterways=[];const chunks=new Map(),tiles=new Map(),features=new Map(),pending=[],stale=new Set(),errors=[],sky=[];
 const metrics={created:0,retired:0,maxChunks:0,streamMs:[],transitions:0,loadingFrames:0,loadingMs:0,movingFrames:0,movingMs:0,distance:0};let zone='settlement',campRuntime=null,craftRuntime=null,lastExplored=null;
 const initialSky=new Map();for(const object of scene.children)if(object.userData.sky){sky.push(object);initialSky.set(object,object.position.clone());}
 const originalFog=scene.fog?.clone(),originalContinuousFog=scene.userData.continuousFog;
 const skyDriver=opts.sky&&root.BurbzWorldSky?.attach(T,scene,{...opts.sky,palette:scene.userData.nightPalette,renderer:s.source.renderer});
 // The ground is matte (roughness 1, no metal), so a diffuse material gives
 // the same look for less work per pixel on every phone.
 const authoredGround=surface.ground.material,groundMaterial=new T.MeshLambertMaterial({map:authoredGround.map||null,normalMap:authoredGround.normalMap||null,normalScale:authoredGround.normalScale?.clone()||new T.Vector2(1,1),color:authoredGround.color?.clone()||new T.Color(1,1,1)}),groundVisible=surface.ground.visible;
 // Horizontal atmospheric distance keeps the same treeline visible on foot
 // and in flight. Altitude must not turn nearby ground into a blank fog sheet.
 const fogMaterials=new Map();
 function styleFog(material){if(!material||material.fog===false||fogMaterials.has(material)||!material.isMeshStandardMaterial&&!material.isMeshLambertMaterial&&!material.isMeshBasicMaterial)return;root.BurbzManga?.styleMaterial(material);const previous=material.onBeforeCompile,key=material.customProgramCacheKey;fogMaterials.set(material,{previous,key});material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>',`#ifdef USE_FOG
 vec4 cwFogWorld=vec4(transformed,1.0);
 #ifdef USE_INSTANCING
 cwFogWorld=instanceMatrix*cwFogWorld;
 #endif
 cwFogWorld=modelMatrix*cwFogWorld;
 vFogDepth=length(cwFogWorld.xz-cameraPosition.xz);
 #endif`);
  // Sun shadows fade out before the far trees end, so no shadow ever appears
  // or moves where trees come and go, and none shimmers in the distance.
  shader.fragmentShader=shader.fragmentShader.replace('#include <lights_fragment_begin>',`#ifdef USE_FOG
 float cwShadowFade=smoothstep(${SHADE[0]}.,${SHADE[1]}.,vFogDepth);
 #else
 float cwShadowFade=0.;
 #endif
`+T.ShaderChunk.lights_fragment_begin.split('vDirectionalShadowCoord[ i ] ) : 1.0;').join('vDirectionalShadowCoord[ i ] )*(1.0-cwShadowFade)+cwShadowFade : 1.0;'));};material.customProgramCacheKey=function(){return key.call(this)+':continuous-horizon-v474';};material.needsUpdate=true;}
 scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])styleFog(m);});styleFog(groundMaterial);
 // Real-world ground colour lives in the vertices. The shared grass map adds
 // luminance detail only, and a second, broader sample breaks up its tiling.
 const seasons=N().season(new Date(),origin.lat),detailUniform={value:.55};let detailRGB=[.5,.56,.36],detailVersion=-1;
 function refreshDetail(){const map=groundMaterial.map,image=map?.image;detailVersion=map?map.version:0;try{if(image?.width){const c=document.createElement('canvas');c.width=c.height=16;const x=c.getContext('2d');x.drawImage(image,0,0,16,16);const d=x.getImageData(0,0,16,16).data;let r=0,g=0,b=0;for(let i=0;i<d.length;i+=4){r+=d[i];g+=d[i+1];b+=d[i+2];}const n=d.length/4*255;detailRGB=[r/n,g/n,b/n];}}catch(_){}detailUniform.value=Math.max(.05,.2126*detailRGB[0]+.7152*detailRGB[1]+.0722*detailRGB[2]);}
 // With distance the ground becomes the distant land, as CDLOD terrain does:
 // its height, canopy, colour and light bend onto the horizon's own surface
 // between MORPH square metres from the eye, always inside the shown square,
 // so the two meet with no crack, seam or step, and nothing pops as the
 // square moves. Its own edge always bends fully, in case it is ever nearer.
 const groundHole={value:new T.Vector4(-1e6,-1e6,1e6,1e6)},MORPH=root.BurbzWorldNature.MORPH;
 function styleGround(material){const previous=material.onBeforeCompile,key=material.customProgramCacheKey;material.vertexColors=true;material.color.setRGB(1,1,1);
  material.onBeforeCompile=function(shader,renderer){previous.call(this,shader,renderer);shader.uniforms.detailLuma=detailUniform;shader.uniforms.groundHole=groundHole;shader.uniforms.groundEye=natureEye;shader.uniforms.groundClock=groundClock;
  shader.vertexShader='attribute vec2 groundFar;\nattribute vec3 groundFarColor;\nattribute vec3 groundFarNormal;\nattribute vec3 groundFarPrev;\nattribute vec3 groundFarPrevColor;\nuniform vec4 groundHole;\nuniform vec3 groundEye;\nuniform float groundClock;\nvarying vec3 groundWorld;\nvarying float groundWood;\nvarying float groundBent;\n'+shader.vertexShader.replace('#include <beginnormal_vertex>',`vec4 groundAt=modelMatrix*vec4(position,1.0);
 float groundInset=min(min(groundAt.x-groundHole.x,groundHole.z-groundAt.x),min(groundAt.z-groundHole.y,groundHole.w-groundAt.z));
 vec2 groundOff=abs(groundAt.xz-groundEye.xz);
 float groundBend=max(1.0-smoothstep(0.0,12.0,groundInset),smoothstep(${MORPH[0]}.,${MORPH[1]}.,max(groundOff.x,groundOff.y)));
 float groundEase=clamp((groundClock-groundFarPrev.z)/${FAR_EASE},0.,1.);vec2 groundFarNow=mix(groundFarPrev.xy,groundFar,groundEase);
 groundWorld=groundAt.xyz;groundWood=clamp(groundFarNow.y/4.6,0.,1.)*groundBend;groundBent=groundBend;
 #ifdef USE_COLOR
 vColor.rgb=mix(vColor.rgb,mix(groundFarPrevColor,groundFarColor,groundEase),groundBend);
 #endif
 #include <beginnormal_vertex>
 objectNormal=normalize(mix(objectNormal,groundFarNormal,groundBend));`).replace('#include <begin_vertex>',`#include <begin_vertex>
 transformed.y=mix(transformed.y,groundFarNow.x,groundBend);`);shader.fragmentShader='uniform float detailLuma;\nvarying vec3 groundWorld;\nvarying float groundWood;\nvarying float groundBent;\n'+(root.BurbzWorldHorizon?.CANOPY||'float canopyCrowns(vec2 p,float far){return 1.0;}')+'\n'+shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 // Where the ground becomes the distant land, its woods wear the same treetops.
 if(groundWood>.01)diffuseColor.rgb*=mix(1.0,canopyCrowns(groundWorld.xz,smoothstep(260.,800.,distance(cameraPosition,groundWorld))),groundWood);`).replace('#include <map_fragment>',`#ifdef USE_MAP
 float groundDetail=dot(texture2D(map,vMapUv).rgb,vec3(.2126,.7152,.0722))/detailLuma;
 float groundBroad=dot(texture2D(map,vMapUv*.137+.31).rgb,vec3(.2126,.7152,.0722))/detailLuma;
 // The grass detail fades as the ground becomes the untextured distant land.
 diffuseColor.rgb*=mix(clamp(groundDetail,.55,1.5)*mix(.84,1.16,clamp(groundBroad*.5,0.,1.)),1.0,groundBent);
 #endif`);};
  material.customProgramCacheKey=function(){return key.call(this)+':alderwing-ground-v4';};material.needsUpdate=true;}
 const settlementGround=new T.Color(surface.palette?.ground??0x6c9a44).multiplyScalar(1.85);
 styleGround(groundMaterial);refreshDetail();
 scene.userData.continuousFog=true;if(scene.fog){scene.fog.far=Math.min(104,scene.fog.far);scene.fog.near=Math.min(scene.fog.near,scene.fog.far*.5);}
 const corridors=surface.corridors||[],corridorVisibility=corridors.map(c=>c.object.visible);
 // Lakes and the sea are opaque, matte surfaces lit like the ground; the
 // shore style supplies their colour, waves, sky reflection and glints.
 const waterMaterial=new T.MeshLambertMaterial({color:0xffffff});styleFog(waterMaterial);
 const rockMaterial=new T.MeshLambertMaterial({color:0x969a8d}),screeMaterial=new T.MeshLambertMaterial({color:0x92968a,vertexColors:true});styleFog(rockMaterial);styleFog(screeMaterial);
 const rockGeometry=new T.DodecahedronGeometry(1,0),waterTime={value:0};
 const seaMaterial=waterMaterial.clone();styleFog(seaMaterial);root.BurbzShoreWater.style(seaMaterial,waterTime,{sea:1});
 root.BurbzShoreWater.style(waterMaterial,waterTime);
 const cascadeMaterial=new T.MeshLambertMaterial({color:0x65b6bd,emissive:0x102b2e,side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false});
 cascadeMaterial.onBeforeCompile=shader=>{shader.uniforms.cascadeTime=waterTime;shader.vertexShader='varying vec2 cascadeUV;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncascadeUV=uv;');shader.fragmentShader='uniform float cascadeTime; varying vec2 cascadeUV;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float threads=pow(.5+.5*sin(cascadeUV.x*79.+sin(cascadeUV.y*3.-cascadeTime*2.)),6.);
 float flow=pow(.5+.5*sin(cascadeUV.y*5.-cascadeTime*3.4+cascadeUV.x*9.),8.);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.87,.96,.92),threads*.58+flow*.32);
 diffuseColor.a*=smoothstep(0.,.12,cascadeUV.x)*smoothstep(0.,.12,1.-cascadeUV.x);`);};
 cascadeMaterial.customProgramCacheKey=()=> 'alderwing-cascade-v408';styleFog(cascadeMaterial);
 const foamMaterial=new T.MeshLambertMaterial({color:0xdceee1,emissive:0x172d29,side:T.DoubleSide,transparent:true,opacity:.78,depthWrite:false});styleFog(foamMaterial);
 const shadowLights=[];for(const light of scene.children)if(light.isDirectionalLight&&light.castShadow){const camera=light.shadow.camera;shadowLights.push({light,position:light.position.clone(),target:light.target.position.clone(),camera:{left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,near:camera.near,far:camera.far},centre:null});Object.assign(camera,{left:-160,right:160,top:160,bottom:-160,near:1,far:600});camera.updateProjectionMatrix();scene.add(light.target);}
 // The sun's shadow map follows the viewer in 16m steps, each a whole number
 // of shadow texels across the light, so every shadow edge keeps its place
 // when the map is redrawn and trees that joined since gain their shadows.
 function shadows(){for(const row of shadowLights){const x=Math.round(s.player.x/16)*16,z=Math.round(s.player.z/16)*16;const epoch=skyDriver?.shadowEpoch();if(row.centre?.x===x&&row.centre?.z===z&&row.epoch===epoch)continue;row.epoch=epoch;row.centre={x,z};
  const direction=(skyDriver?new T.Vector3().copy(skyDriver.direction()):row.position.clone().sub(row.target)).normalize(),camera=row.light.shadow.camera,centre=k.shadowCentre(x,z,direction,(camera.right-camera.left)/row.light.shadow.mapSize.x);
  row.light.target.position.set(centre.x,centre.y,centre.z);row.light.position.copy(row.light.target.position).addScaledVector(direction,230);row.light.target.updateMatrixWorld();s.source.renderer.shadowMap.needsUpdate=true;}}
 // Every tree, shrub, stone and flower shares one instanced pool per kind.
 const natureEye={value:new T.Vector3()},natureEdge={value:new T.Vector4(-1e6,-1e6,1e6,1e6)},nature=root.BurbzWorldNature.create(T,scene,{style:styleFog,time:waterTime,eye:natureEye,edge:natureEdge});let lastNature=-Infinity;
 // Distant land from real elevation fills the view beyond the detailed ground.
 const farWater=N().linear(0x3d5563);
 // Where the map records plenty of land cover within 1.6km, woods are mapped
 // too, so unmapped ground is open country. Where it records little, the
 // authored Alderwing woodland fills the gaps. Read per 256m cell and cached.
 const biasCells=new Map();
 function openBiasAt(x,z){const key=Math.floor(x/256)+','+Math.floor(z/256);let bias=biasCells.get(key);if(bias===undefined){const p={x:(Math.floor(x/256)+.5)*256,z:(Math.floor(z/256)+.5)*256};let mapped=0;for(const e of features.values())if(e.rings&&e.kind!=='water'&&distanceToBounds(e.bounds,p)<1600&&++mapped>=8)break;bias=Math.min(1,mapped/8);if(features.size)biasCells.set(key,bias);}return bias;}
 // It also records each wood's density, its share of conifers and its crown
 // colour, from which the canopy crowns are drawn.
 function farNature(x,z,altitude,slope,flat){
  if(masks('water',x,z)||flat&&altitude>-30)return{ground:farWater,canopy:0,water:true,wood:0,conifer:0,crown:farWater};
  const c=coverAt(x,z),b=N().sample({altitude,slope,cover:c.kind,wet:0,lat:origin.lat,seasons,openBias:openBiasAt(x,z),x:x+shift.x,z:z+shift.z,field:c.field}),wood=Math.min(1,b.trees*1.25),sp=b.species,all=Object.values(sp).reduce((a,v)=>a+v,0);
  // From afar a wood is its crowns in their own shade, mottled crown by crown.
  const colour=N().canopyColor(sp,seasons),shade=.6+.32*N().noise(x+shift.x,z+shift.z,26,271),crown=colour.map(v=>v*shade);return{ground:b.ground.map((v,i)=>v+(crown[i]-v)*wood),canopy:4.6*wood*N().smooth((wood-.3)/.35),water:false,wood:Math.min(1,b.trees*1.6),conifer:all?(sp.pine+sp.spruce)/all:0,crown:colour};}
 const streamMaterial=root.BurbzWorldWater.streamMaterial(T,{time:waterTime,style:styleFog}),spray=root.BurbzWorldWater.createSpray(T,scene,{time:waterTime});
 // The distant land samples the same ground the chunks are built from, so
 // yards and settlements sit on it too; beyond the map, its own elevation.
 const horizon=root.BurbzWorldHorizon?.create(T,scene,{origin,merc,style:styleFog,height:(x,z)=>{const h=datum===null?null:joined(x,z,steadyRaw);return h===null?null:h+datum;},nature:farNature,signal:s.abort.signal,eye:natureEye});let hazeOn=false;
 const anchor=opts.anchor||origin,shift=C().project(anchor,origin)||{x:0,z:0};
 const host=document.createElement('div');host.className='cw-tile-provider';host.setAttribute('aria-hidden','true');host.inert=true;
 host.style.cssText='position:absolute;left:-10000px;top:0;width:512px;height:512px;visibility:hidden;pointer-events:none';s.root.append(host);
 const note=document.createElement('div');note.className='vw-hint cw-status';note.setAttribute('role','status');note.style.pointerEvents='none';note.hidden=true;s.root.append(note);
 const credits=root.BurbzFieldMapUI.mountCredits(s.root,{terrain:true});
 const actualRadius=surface.radius,maskCache=new Map(),places=new Map(),preparing=new Map();let placeCentre=null,lastPlaces=0,placeChain=Promise.resolve(),placeVersion=0;
 // The starting settlement needs the same retained-distance policy as every
 // destination. Otherwise turning toward it draws its fully fogged buildings
 // from hundreds of metres away, even after its ground has streamed out.
 const overviewHomes=scene.children.filter(o=>o.userData.overheadHome).map(o=>({object:o,visible:o.visible}));overviewHomes.forEach(row=>row.object.visible=false);
 const originalChildren=scene.children.slice(),originGroup=new T.Group();originGroup.name='Retained starting settlement';
 for(const child of originalChildren)if(!child.userData.sky&&!child.isLight&&!shadowLights.some(row=>row.light.target===child))originGroup.add(child);
 scene.add(originGroup);originGroup.updateMatrixWorld(true);
 const originBounds=new T.Box3().setFromObject(originGroup),originReach=Math.max(actualRadius,...[originBounds.min.x,originBounds.max.x].flatMap(x=>[originBounds.min.z,originBounds.max.z].map(z=>Math.hypot(x,z))));
 const animateOrigin=()=>Math.hypot(s.player.x,s.player.z)<originReach+DETAIL+32;
 let originCull=root.BurbzVillageWalkScene.distanceCull(T,originGroup,s.source.movers);
 const raw=(x,z)=>k.elevation(lookup,merc,x,z);
 // The distant land keeps the most detailed height it has ever read at each
 // of its points, so a map tile leaving the cache never changes it back.
 const steadyHeights=new Map();
 function steadyRaw(x,z){const key=Math.round(x)+','+Math.round(z),r=k.elevationSample(lookup,merc,x,z);let c=steadyHeights.get(key);if(r&&(!c||r.z>c.z)){c=r;steadyHeights.set(key,c);}return c?c.h:null;}
 function pruneSteady(){if(steadyHeights.size<60000)return;for(const key of steadyHeights.keys()){const [x,z]=key.split(',').map(Number);if(Math.hypot(x-s.player.x,z-s.player.z)>1400)steadyHeights.delete(key);}}
 function unshaped(x,z,rawAt=raw){if(Math.hypot(x,z)<=actualRadius+64)return k.joinedHeight(x,z,{radius:actualRadius,authored:terrain.heightAt,raw:rawAt,datum});const h=rawAt(x,z);return h===null||datum===null?null:h-datum;}
 function joined(x,z,rawAt=raw){
  const home=places.get('home'),d=Math.hypot(x,z);
  if(home&&Math.hypot(x-home.x,z-home.z)<home.content.groundBlendRadius)return k.homeHeight(x,z,{x:home.x,z:home.z,base:home.base,radius:home.content.groundRadius,blendRadius:home.content.groundBlendRadius},unshaped(x,z,rawAt));
  if(d<=actualRadius+64)return k.joinedHeight(x,z,{radius:actualRadius,authored:terrain.heightAt,raw:rawAt,datum});const h=rawAt(x,z);if(h===null||datum===null)return null;
  for(const p of places.values()){if(p.record.kind==='home')continue;const distance=Math.hypot(x-p.x,z-p.z),blend=p.content.blendRadius||p.content.radius+12;if(distance<blend){const t=k.smooth((distance-p.content.radius)/(blend-p.content.radius));return (p.base+(p.content.terrain?.heightAt(x-p.x,z-p.z)||0))*(1-t)+(h-datum)*t;}}return h-datum;
 }
 function shelterGround(x,z){const h=places.get('home');return opts.getHome?.()?.tier===0&&h&&Math.hypot(x-h.x,z-h.z)<12;}

 function refreshPlaces(){if(!opts.records||datum===null)return;const at=C().unproject(origin,{...s.player});if(!at||placeCentre&&C().distance(at,placeCentre)<32)return;placeCentre=idle?at:null;
  const records=opts.records({center:at}).filter(r=>String(r.seed)!==String(opts.record.seed)&&r.id!==opts.record.id);const home=opts.getHome?.();if(opts.anchor&&home&&opts.record.kind!=='home')records.push({...opts.anchor,id:'home',kind:'home',name:root.BurbzPlayerHomeCore.TIERS[home.tier].name});
  const rank=rows=>rows.map(record=>({record,p:C().project(origin,record)})).filter(r=>r.p).map(r=>({...r,d:Math.hypot(r.p.x-s.player.x,r.p.z-s.player.z)})).filter(r=>r.d<750).sort((a,b)=>a.d-b.d);
  const wanted=rank(records).slice(0,6);if(idle&&opts.waysides)wanted.push(...rank(opts.waysides({center:at})).filter(r=>Math.hypot(r.p.x,r.p.z)>actualRadius+64&&!records.some(other=>C().distance(other,r.record)<(other.kind==='home'?100:other.tier==='village'?190:340))).slice(0,2));const ids=new Set(wanted.map(r=>r.record.id));
  for(const [id,p] of places)if(!ids.has(id)&&Math.hypot(p.x-s.player.x,p.z-s.player.z)>850){p.content.dispose();places.delete(id);placeVersion++;}
  for(const [id,p] of preparing)if(!ids.has(id)&&Math.hypot(p.x-s.player.x,p.z-s.player.z)>850){p.abort.abort();preparing.delete(id);}
  for(const row of wanted){if(places.size+preparing.size>=12||places.has(row.record.id)||preparing.has(row.record.id)||row.record.kind!=='home'&&Math.hypot(row.p.x,row.p.z)<actualRadius+6)continue;const value=raw(row.p.x,row.p.z);if(value===null){placeCentre=null;continue;}
   if(row.record.kind==='wayside'){
    const offsets=[-13,-11,-9,-7,-5,-3,-1,0,1,3,5,7,9,11,13];let suitable=true,missing=false;for(const dx of offsets)for(const dz of offsets){const x=row.p.x+dx,z=row.p.z+dz,h=raw(x,z);if(h===null)missing=true;else if(Math.abs(h-value)>2.2||masks('water',x,z)||road(x,z))suitable=false;}
    if(missing){placeCentre=null;continue;}if(!suitable)continue;
   }
   const pendingPlace={...row.p,record:row.record,radius:row.record.kind==='wayside'?24:row.record.kind==='home'?32:row.record.tier==='village'?100:250,abort:new AbortController()};preparing.set(row.record.id,pendingPlace);
   const abort=()=>pendingPlace.abort.abort();s.abort.signal.addEventListener('abort',abort,{once:true});
   placeChain=placeChain.catch(()=>{}).then(async()=>{
    if(closed||pendingPlace.abort.signal.aborted)return;
    const homeBase=row.record.kind==='home'?unshaped(row.p.x,row.p.z):0;
    const profile=row.record.kind==='home'?{...root.BurbzPlayerHomeCore.groundProfile(home),...row.p,base:homeBase}:null;
    // Do not create a flat fallback yard on missing neighbouring DEM samples.
    // Every prop uses the exact triangles used by the retained ground/collision.
    const shaped=(x,z)=>k.homeHeight(x,z,profile,unshaped(x,z));
    if(profile){const reach=Math.max(root.BurbzPlayerHomeCore.YARD.ground,profile.blendRadius)+k.STEP;for(let x=Math.floor((row.p.x-reach)/k.STEP)*k.STEP;x<=row.p.x+reach;x+=k.STEP)for(let z=Math.floor((row.p.z-reach)/k.STEP)*k.STEP;z<=row.p.z+reach;z+=k.STEP)if(!Number.isFinite(shaped(x,z)))return;}
    const groundHeight=(x,z)=>k.sampleGround(row.p.x+x,row.p.z+z,shaped)-homeBase;
    const content=row.record.kind==='home'?opts.createYard?.(T,home,{groundHeight}):row.record.kind==='wayside'?await opts.createWayside?.(T,row.record,{signal:pendingPlace.abort.signal,palette:opts.waysidePalette?.(scene.userData.nightPalette)}):await opts.createSettlement?.(T,row.record,{signal:pendingPlace.abort.signal});
    if(!content)return;if(closed||pendingPlace.abort.signal.aborted){content.dispose();return;}
    const radius=content.radius||root.BurbzPlayerHomeCore?.YARD?.ground||28;content.radius=radius;content.blendRadius=content.blendRadius||radius+16;content.group.userData.continuousTerrain=true;content.group.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])styleFog(m);});
    const p={...row.p,record:row.record,content,base:row.record.kind==='home'?homeBase:value-datum};content.group.position.set(p.x,p.base,p.z);scene.add(content.group);const cull=root.BurbzVillageWalkScene.distanceCull(T,content.group,content.movers);p.cull=cull;const disposeContent=content.dispose;content.dispose=()=>{p.cull.dispose();disposeContent();};places.set(row.record.id,p);placeVersion++;
    // Rebuild the ground it touches, in place: each old chunk stays until its
    // replacement is ready, so no hole opens and no tree stays in a building.
    for(const chunk of [...chunks.values()])if(distanceToBounds({x0:chunk.x,x1:chunk.x+k.CHUNK,z0:chunk.z,z1:chunk.z+k.CHUNK},p)<Math.max(content.radius,content.blendRadius)+k.STEP)stale.add(chunk.id);
    // The distant land takes the new ground too, easing in.
    horizon?.refresh();
    metrics.placeBuilds||=[];metrics.placeBuilds.push({id:row.record.id,buildMs:content.buildMs||0,maxStepMs:content.maxStepMs||0,prepareMs:content.prepareMs||0});if(metrics.placeBuilds.length>20)metrics.placeBuilds.shift();
   }).catch(error=>{if(error.name!=='AbortError'){errors.push('Settlement: '+error.message);pendingPlace.failed=true;pendingPlace.retryAt=performance.now()+5000;}}).finally(()=>{s.abort.signal.removeEventListener('abort',abort);if(!pendingPlace.failed)preparing.delete(row.record.id);placeCentre=null;});
  }
  for(const [id,p] of preparing)if(p.failed&&performance.now()>p.retryAt){preparing.delete(id);placeCentre=null;}
 }
 const originDiscovery={id:opts.record.id||'origin',record:{...opts.record,id:opts.record.id||'origin'},content:{group:originGroup,movers:s.source.movers,discovery:{api:s.source.discovery?.api||s.options.discoveries,world:s.source.discovery?.world||baseWorld,points:s.discoveries?.positions?.()}},x:0,z:0,base:0};let activeDiscovery=originDiscovery.id,activeDiscoveryContent=originDiscovery.content;
 function selectDiscoveries(){if(s.room||s.uiBusy)return;const place=Math.hypot(s.player.x,s.player.z)<actualRadius?originDiscovery:inPlace(s.player.x,s.player.z);if(!place||activeDiscovery===place.record.id&&activeDiscoveryContent===place.content)return;const d=place.content.discovery;if(!d?.api){s.discoveries?.dispose();s.discoveries={update(){},dispose(){},hud(){return null;},closePanel(){return false;}};activeDiscovery=place.record.id;activeDiscoveryContent=place.content;s.root.querySelector('.vw-title strong').textContent=place.record.name;return;}s.discoveries?.dispose();s.discoveries=d.wayside?root.BurbzWildernessPlaces.attach(s,{record:d.wayside,api:d.api,targets:d.targets,frame:{x:place.x,y:place.base,z:place.z}}):root.BurbzVillageDiscoveries.attach(s,{...d,scene:place.content.group,movers:place.content.movers,frame:{x:place.x,y:place.base,z:place.z},preserveHeading:true});activeDiscovery=place.record.id;activeDiscoveryContent=place.content;s.root.querySelector('.vw-title strong').textContent=place.record.name||s.options.name;}
 function safeAt(x,z){if(Math.hypot(x,z)<=actualRadius)return true;for(const p of places.values())if(p.record.kind!=='wayside'&&Math.hypot(x-p.x,z-p.z)<=p.content.radius)return true;return false;}
 function inPlace(x,z){return [...places.values()].find(p=>Math.hypot(x-p.x,z-p.z)<p.content.radius+2);}
 const visit=document.createElement('button');visit.className='vw-interact cw-visit';visit.type='button';visit.hidden=true;visit.style.cssText='position:absolute;right:18px;bottom:150px;z-index:6;min-height:44px;max-width:210px;background:#203b2b;color:#fff3d1;border:1px solid #c9b27b;padding:12px;border-radius:8px';s.root.append(visit);let visitTarget=null;
 visit.addEventListener('click',async()=>{const p=visitTarget;if(!p||s.uiBusy)return;s.uiBusy=true;s.reset?.();try{if(!await save())return;if(p.record.kind==='home')await opts.enterHome?.();else{const saved=pose();root.BurbzVillageWalk.close('world');await opts.enterSettlement?.(p.record,saved);}}finally{if(!s.closed)s.uiBusy=false;}},{signal:s.abort.signal});
 const build=document.createElement('button');build.type='button';build.className='cw-farm-build';build.dataset.walkAction='home-build';build.textContent='Build & decorate';build.title='Farm, garden, furniture and house';build.hidden=true;build.style.cssText='position:absolute;right:18px;bottom:206px;z-index:6;min-height:44px;background:#ead099;color:#203b2b;border:1px solid #c9b27b;padding:12px 20px;border-radius:8px';s.root.append(build);
 build.addEventListener('click',async()=>{const p=places.get('home'),home=opts.getHome?.();if(!p||!home||home.tier<1||s.uiBusy||s.player.mode!=='walk'||Math.hypot(s.player.x-p.x,s.player.z-p.z)>root.BurbzPlayerHomeCore.YARD.walk)return;s.uiBusy=true;s.reset();try{if(!await save())return;await opts.openBuild?.({x:s.player.x-p.x,z:s.player.z-p.z,yaw:s.player.yaw,pitch:s.player.pitch});}finally{if(!s.closed)s.uiBusy=false;}},{signal:s.abort.signal});
 const geo=(x,z)=>C().unproject(origin,{x,y:0,z});
 let feedbackUntil=0;
 function message(text,feedback=false){
  if(feedback)feedbackUntil=text?performance.now()+4000:0;
  else if(performance.now()<feedbackUntil)return;
  if(note.textContent!==text)note.textContent=text;note.hidden=!text;
 }
 // Mapped shapes are indexed in 64m cells. Each polygon keeps its edges in
 // 8m bands in local metres, so a point test touches only a few edges.
 const coverCells=new Map(),coverLarge=new Set(),FIELD_BANDS=8;
 const cellKey=(x,z)=>Math.floor(x/COVER_CELL)+','+Math.floor(z/COVER_CELL);
 const PAD=8,indexed=entry=>!!entry.rings||entry.kind==='road';
 function indexCover(entry){if(!indexed(entry))return;const b=entry.bounds,x0=Math.floor((b.x0-PAD)/COVER_CELL),x1=Math.floor((b.x1+PAD)/COVER_CELL),z0=Math.floor((b.z0-PAD)/COVER_CELL),z1=Math.floor((b.z1+PAD)/COVER_CELL);
  if((x1-x0+1)*(z1-z0+1)>1600){coverLarge.add(entry);return;}
  for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const key=ix+','+iz;let set=coverCells.get(key);if(!set)coverCells.set(key,set=new Set());set.add(entry);}}
 function unindexCover(entry){coverLarge.delete(entry);if(!indexed(entry))return;const b=entry.bounds;for(let ix=Math.floor((b.x0-PAD)/COVER_CELL);ix<=Math.floor((b.x1+PAD)/COVER_CELL);ix++)for(let iz=Math.floor((b.z0-PAD)/COVER_CELL);iz<=Math.floor((b.z1+PAD)/COVER_CELL);iz++){const set=coverCells.get(ix+','+iz);if(set){set.delete(entry);if(!set.size)coverCells.delete(ix+','+iz);}}}
 function bands(entry){if(entry.bands)return entry.bands;const rows=new Map();
  for(const ring of entry.rings)for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(a.z===b.z)continue;for(let band=Math.floor(Math.min(a.z,b.z)/FIELD_BANDS);band<=Math.floor(Math.max(a.z,b.z)/FIELD_BANDS);band++){let list=rows.get(band);if(!list)rows.set(band,list=[]);list.push(a.x,a.z,b.x,b.z);}}
  return entry.bands=rows;}
 function inside(entry,x,z){const b=entry.bounds;if(x<b.x0||x>b.x1||z<b.z0||z>b.z1)return false;const edges=bands(entry).get(Math.floor(z/FIELD_BANDS));if(!edges)return false;let yes=false;
  for(let i=0;i<edges.length;i+=4){const ax=edges[i],az=edges[i+1],bx=edges[i+2],bz=edges[i+3];if((az>z)!==(bz>z)&&x<ax+(z-az)*(bx-ax)/(bz-az))yes=!yes;}return yes;}
 function candidates(x,z){const set=coverCells.get(cellKey(x,z));return coverLarge.size?[...(set||[]),...coverLarge]:set||[];}
 function masks(kind,x,z){for(const entry of candidates(x,z))if(entry.kind===kind&&entry.rings&&inside(entry,x,z))return true;return false;}
 // The strongest mapped cover at a point: a wood in a park is a wood.
 function coverAt(x,z){let best=null,field=0;for(const entry of candidates(x,z)){if(!entry.rings||entry.kind==='water'||best&&N().stronger(entry.kind,best)===best)continue;if(inside(entry,x,z)){best=entry.kind;field=entry.field;}}return{kind:best,field};}
 function craftSurface(x,z){
  const y=height(x,z);if(!Number.isFinite(y))return null;
  if(Math.hypot(x,z)<actualRadius&&baseWorld.surface?.(x,z)==='wood')return{height:y,kind:'ground'};
  if(!shelterGround(x,z)&&(river(x,z)||['water','river'].includes(baseWorld.surface?.(x,z))))return{height:y+.02,kind:'freshwater'};
  if(shelterGround(x,z))return{height:y,kind:'ground'};
  for(const entry of candidates(x,z))if(entry.kind==='water'&&inside(entry,x,z))return{height:y+.02,kind:/ocean|sea/.test(entry.waterClass)?'sea':'freshwater'};
  return{height:y,kind:'ground'};
 }
 function fnv(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619);}return(h>>>0).toString(36);}
 function readFeatures(){if(closed||!loaded)return;const changedWater=[];const sources=[...new Set((map.getStyle()?.layers||[]).filter(l=>['landcover','landuse','water','waterway','transportation'].includes(l['source-layer'])).map(l=>l.source))];
  // Nearest first: dense mapping (thousands of scree scraps) must never
  // crowd out the lake or stream beside the viewer.
  const here=C().unproject(origin,{x:s.player.x,y:0,z:s.player.z}),mx=111320*Math.cos(origin.lat*Math.PI/180),my=110540;
  const reach=f=>{let x0=Infinity,x1=-Infinity,y0=Infinity,y1=-Infinity;(function scan(v){if(!Array.isArray(v))return;if(typeof v[0]==='number'){if(v[0]<x0)x0=v[0];if(v[0]>x1)x1=v[0];if(v[1]<y0)y0=v[1];if(v[1]>y1)y1=v[1];}else for(const p of v)scan(p);})(f.geometry?.coordinates);
   return x0>x1||!here?Infinity:Math.hypot(Math.max(x0-here.lon,0,here.lon-x1)*mx,Math.max(y0-here.lat,0,here.lat-y1)*my);};
  for(const source of sources)for(const sourceLayer of ['landcover','landuse','water','waterway','transportation']){let rows=[];try{rows=map.querySourceFeatures(source,{sourceLayer});}catch(_){}
   if(rows.length>LAYER_LIMIT[sourceLayer])rows=rows.map(f=>({f,d:reach(f)})).sort((a,b)=>a.d-b.d).map(r=>r.f);
   for(const f of rows.slice(0,LAYER_LIMIT[sourceLayer])){const geometry=f.geometry;if(!geometry)continue;const kind=sourceLayer==='waterway'?'stream':sourceLayer==='water'?'water':sourceLayer==='transportation'?'road':N().cover({geometry,properties:f.properties,sourceLayer});if(!kind)continue;
    const text=JSON.stringify(geometry);if(text.length>120000)continue;const id=sourceLayer+':'+String(f.id)+':'+text.length+':'+fnv(text);if(features.has(id))continue;
    const points=[];(function scan(v){if(!Array.isArray(v))return;if(typeof v[0]==='number'){if(Number.isFinite(v[0])&&Number.isFinite(v[1]))points.push(v);}else for(const p of v)scan(p);})(geometry.coordinates);if(points.length<2||points.length>8000)continue;
    const local=points.map(p=>C().project(origin,{lon:p[0],lat:p[1]})).filter(Boolean);if(!local.length)continue;const bounds={x0:Math.min(...local.map(p=>p.x)),x1:Math.max(...local.map(p=>p.x)),z0:Math.min(...local.map(p=>p.z)),z1:Math.max(...local.map(p=>p.z))};
    const lines=kind==='road'||kind==='stream'?(geometry.type==='LineString'?[geometry.coordinates]:geometry.type==='MultiLineString'?geometry.coordinates:[]).map(line=>line.map(p=>C().project(origin,{lon:p[0],lat:p[1]}))):[];
    const rings=kind!=='road'&&kind!=='stream'?(geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:[]).flatMap(poly=>poly.map(ring=>ring.map(p=>C().project(origin,{lon:p[0],lat:p[1]})).filter(Boolean))).filter(r=>r.length>2):null;
    if(kind!=='road')changedWater.push(bounds);
    const entry={id,kind,geometry,bounds,local,lines,rings:rings?.length?rings:null,field:Number(f.id)||points.length,waterClass:[f.properties?.class,f.properties?.subclass].filter(Boolean).join(' '),river:f.properties?.class==='river',roadClass:kind==='road'?String(f.properties?.class||''):null,waterway:kind==='stream'?{kind:String(f.properties?.class||'stream'),tunnel:f.properties?.brunnel==='tunnel',intermittent:!!Number(f.properties?.intermittent)}:null};
    features.set(id,entry);indexCover(entry);
   }
  }
  // New woods change the open-country reading only for chunks built later;
  // existing ground never rebuilds all at once mid-journey.
  if(changedWater.length){biasCells.clear();horizon?.refresh();}
  // Chunks the new shapes touch rebuild in place, one or two a frame.
  for(const chunk of [...chunks.values()])if(changedWater.some(b=>b.x1>=chunk.x-1&&b.x0<=chunk.x+k.CHUNK+1&&b.z1>=chunk.z-1&&b.z0<=chunk.z+k.CHUNK+1))stale.add(chunk.id);
  // Streams collide and float the craft through short corridors, as before;
  // they are drawn as continuous flowing ribbons per chunk.
  waterways=root.BurbzWorldWaterCore.corridors(streamLines().map(r=>({kind:r.waterway.kind,intermittent:r.waterway.intermittent,line:r.line})),160,s.player).filter(c=>!corridors.some(a=>a.kind==='river'&&k.corridorContains(a,c.x,c.z,4)));
  // Retain decoded source coverage through tile turnover. Never delete a
  // visible tree because a source tile disappears from querySourceFeatures.
  // Each kind keeps its own budget, nearest first, so lakes, streams and
  // roads survive beside thousands of small mapped shapes.
  if(features.size>MAX_FEATURES||Object.entries(KEEP).some(([group,limit])=>[...features.values()].filter(e=>featureGroup(e)===group).length>limit)){const p=s.player;
   for(const [group,limit] of Object.entries(KEEP)){const rows=[...features.values()].filter(e=>featureGroup(e)===group);if(rows.length<=limit)continue;rows.sort((a,b)=>distanceToBounds(a.bounds,p)-distanceToBounds(b.bounds,p));for(const row of rows.slice(limit)){features.delete(row.id);unindexCover(row);maskCache.delete(row.id);}}}
 }
 function featureGroup(e){return e.kind==='water'||e.kind==='stream'||e.kind==='road'?e.kind:'cover';}
 function distanceToBounds(b,p){return Math.hypot(Math.max(b.x0-p.x,0,p.x-b.x1),Math.max(b.z0-p.z,0,p.z-b.z1));}
 function road(x,z,pad=0){if(corridors.some(c=>c.kind==='road'&&k.corridorContains(c,x,z,.35+pad)))return true;for(const entry of candidates(x,z)){if(entry.kind!=='road'||x<entry.bounds.x0-2-pad||x>entry.bounds.x1+2+pad||z<entry.bounds.z0-2-pad||z>entry.bounds.z1+2+pad)continue;for(const line of entry.lines)for(let i=1;i<line.length;i++)if(root.BurbzVillageWalkCore.distance2(x,z,line[i-1],line[i])<(1.5+pad)**2)return true;}return false;}
 function river(x,z,pad=0){return [...corridors,...waterways].some(c=>c.kind==='river'&&k.corridorContains(c,x,z,.27+pad));}
 function height(x,z){const chunk=chunks.get(k.key(x,z));if(!chunk)return null;const y=k.meshHeight(chunk,chunk.data,x,z);if(shelterGround(x,z))return y;const place=inPlace(x,z);if(place?.content.terrain){const lx=x-place.x,lz=z-place.z,local=place.content.world.height(lx,lz);if(local>place.content.terrain.heightAt(lx,lz)+.08)return Math.max(y,place.base+local);}if(Math.hypot(x,z)<actualRadius&&baseWorld.height(x,z)>terrain.heightAt(x,z)+.08)return Math.max(y,baseWorld.height(x,z));return y;}
 function visibleCoverage(x,z){for(const p of preparing.values())if(Math.hypot(x-p.x,z-p.z)<p.radius+DETAIL+20)return false;const reach=DETAIL+10;for(const cell of k.chunks(x,z,Math.ceil(reach/k.CHUNK)+1)){const b={x0:cell.x,x1:cell.x+k.CHUNK,z0:cell.z,z1:cell.z+k.CHUNK};if(distanceToBounds(b,{x,z})<reach&&!chunks.has(cell.id))return false;}return true;}
 // Landing requires the local terrain and collision neighbourhood, not every
 // scenery chunk out to the fog horizon. Pending nearby buildings still block.
 function localCoverage(x,z){
  for(const p of preparing.values())if(Math.hypot(x-p.x,z-p.z)<p.radius+4)return false;
  for(const dx of [-8,0,8])for(const dz of [-8,0,8])if(!chunks.has(k.key(x+dx,z+dz)))return false;
  return true;
 }
 function rockBlocked(x,y,z){for(let ix=Math.floor((x-5)/k.CHUNK);ix<=Math.floor((x+5)/k.CHUNK);ix++)for(let iz=Math.floor((z-5)/k.CHUNK);iz<=Math.floor((z+5)/k.CHUNK);iz++)for(const r of chunks.get(ix+','+iz)?.rocks||[])if(k.rockContains(r,x,y,z))return true;return false;}
 function allowed(x,z){if(campRuntime?.blocked(x,null,z)||s.combat?.blocked?.(x,null,z))return false;if(!Number.isFinite(x+z)||height(x,z)===null)return false;if(!shelterGround(x,z)&&!baseWorld.allowedBeyond(x,z))return false;const place=inPlace(x,z);if(place?.content.world?.allowed&&!place.content.world.allowed(x-place.x,z-place.z))return false;if(Math.hypot(x,z)>actualRadius){if(rockBlocked(x,null,z))return false;if(!place&&(river(x,z)||masks('water',x,z)))return false;const ids=new Set();for(const dx of [-.8,.8])for(const dz of [-.8,.8])ids.add(k.key(x+dx,z+dz));for(const id of ids)for(const t of chunks.get(id)?.trees||[])if(Math.hypot(t.x-x,t.z-z)<.27+.24*t.size)return false;}return true;}
 // Scenery slices describe actual trunks/fences at body height. The last two
 // river segments are synthetic bridge rails, not terrain-wide landing rules.
 const physicalGround=root.BurbzVillageWalkCore.createWorld({radius:Infinity,segments:terrain.river?baseWorld.segments.slice(0,-2):baseWorld.segments});
 const solidBoxes=s.source.buildings.filter(b=>!b.userData.townGround).map(b=>new T.Box3().setFromObject(b));
 function allowed3(x,y,z,requireCoverage=true,physicalOnly=false){if(campRuntime?.blocked(x,y,z)||s.combat?.blocked?.(x,y,z))return false;const h=height(x,z);if(h===null||(requireCoverage&&!visibleCoverage(x,z)))return false;for(const b of solidBoxes)if(x>b.min.x-.28&&x<b.max.x+.28&&z>b.min.z-.28&&z<b.max.z+.28&&y<b.max.y+.3&&y>b.min.y-.3)return false;
  if(!shelterGround(x,z)&&Math.hypot(x,z)<actualRadius&&y<h+4&&!baseWorld.allowedBeyond(x,z)&&!physicalOnly)return false;
  if(physicalOnly&&!shelterGround(x,z)&&Math.hypot(x,z)<actualRadius&&y<h+1&&!physicalGround.allowedBeyond(x,z))return false;
  const ids=new Set();for(const dx of [-3,3])for(const dz of [-3,3])ids.add(k.key(x+dx,z+dz));for(const id of ids)for(const t of chunks.get(id)?.trees||[]){if(y<t.y-.3||y>t.y+3.7*t.size)continue;const r=y<t.y+1.2*t.size?.3*t.size:1.12*t.size;if(Math.hypot(x-t.x,z-t.z)<r+.25)return false;}
  if(rockBlocked(x,y,z))return false;
  for(let ix=Math.floor((x-7)/k.CHUNK);ix<=Math.floor((x+7)/k.CHUNK);ix++)for(let iz=Math.floor((z-7)/k.CHUNK);iz<=Math.floor((z+7)/k.CHUNK);iz++)for(const cascade of chunks.get(ix+','+iz)?.cascades||[]){const steps=[0,3,7,10].map(i=>cascade.points[i]);for(let i=1;i<steps.length;i++)if(y<steps[i-1].y+.3&&y>h-.3&&root.BurbzVillageWalkCore.distance2(x,z,steps[i-1],steps[i])<(cascade.width*.6+.3)**2)return false;}

  for(const p of places.values())for(const b of p.content.solids||[])if(Math.abs(x-p.x-b.x)<b.w/2+.28&&Math.abs(z-p.z-b.z)<b.d/2+.28&&y>p.base+b.minY-.3&&y<p.base+b.maxY+.3)return false;return true;
 }
 const world={radius:Infinity,combatAllowed3:(x,y,z)=>allowed3(x,y,z,false),allowed3,maxAGL:400,authoredRadius:baseWorld.radius,height,allowed,allowedBeyond:allowed,spawn:p=>baseWorld.spawn(p),surface:(x,z)=>Math.hypot(x,z)<actualRadius?baseWorld.surface(x,z):road(x,z)?'stone':'ground',get polygons(){return baseWorld.polygons;},get segments(){return baseWorld.segments;}};
 function retire(chunk){stale.delete(chunk.id);nature.remove(chunk.id+':big');nature.remove(chunk.id+':shrubs');nature.remove(chunk.id+':near');spray.set(chunk.id,null);chunk.group.removeFromParent();for(const mesh of chunk.group.children){if(!mesh.isInstancedMesh)mesh.geometry.dispose();mesh.dispose?.();}for(const material of chunk.shoreMaterials||[]){fogMaterials.delete(material);material.dispose();}chunk.shoreTexture?.dispose();chunks.delete(chunk.id);metrics.retired++;}
 function sceneryHeight(cell,data,x,z){if(x>=cell.x&&x<=cell.x+k.CHUNK&&z>=cell.z&&z<=cell.z+k.CHUNK)return k.meshHeight(cell,data,x,z);return joined(x,z);}
 function sceneryExcluded(x,z,pad=0){if(Math.hypot(x,z)<actualRadius+pad+1||inPlace(x,z)||!baseWorld.allowedBeyond(x,z)||road(x,z,pad))return true;for(const p of places.values())if(Math.hypot(x-p.x,z-p.z)<p.content.radius+pad)return true;return false;}
 function cascadeMesh(row,cell,height){
  const positions=[],uv=[],indices=[],foam=[],fi=[];
  const first=row.points[0],last=row.points[row.points.length-1],len=Math.hypot(last.x-first.x,last.z-first.z),ux=(last.x-first.x)/len,uz=(last.z-first.z)/len;
  // Broad rock shelves feed short vertical curtains: each step is supported
  // by a solid lip above the measured stream bed, never a floating water ramp.
  const bed=[],bi=[],sections=[],bankRocks=[],steps=row.points.filter((p,i)=>[0,3,7,10].includes(i));
  function section(p,level,v){const base=positions.length/3;for(const side of [-1,1]){const x=p.x-uz*side*row.width/2,z=p.z+ux*side*row.width/2,y=height(x,z);if(!Number.isFinite(y))return false;positions.push(x-cell.x,Math.max(level,y)+.075,z-cell.z);uv.push((side+1)/2,v);}sections.push(base);return true;}
  for(let i=0;i<steps.length;i++){
   const p=steps[i],previous=steps[Math.max(0,i-1)];
   if(i&&!section(p,previous.y,i*3-.08))return null;
   if(!section(p,p.y,i*3))return null;
   if(!i)continue;
   const a=previous,b=p,base=bed.length/3;
   for(const [point,side,top] of [[a,-1,true],[a,1,true],[b,-1,true],[b,1,true],[b,-1,false],[b,1,false]]){
    const x=point.x-uz*side*row.width*.6,z=point.z+ux*side*row.width*.6,h=height(x,z);if(!Number.isFinite(h))return null;
    bed.push(x-cell.x,(top?Math.max(a.y,h)-.05:h-.2),z-cell.z);
   }
   for(const side of [-1,1]){const x=b.x-uz*side*row.width*.65,z=b.z+ux*side*row.width*.65,h=height(x,z);bankRocks.push({x,z,y:h,high:Math.max(.55,(a.y-h)*.65)});}
   bi.push(base,base+1,base+2,base+1,base+3,base+2,base+2,base+3,base+4,base+3,base+5,base+4);
  }
  for(let i=1;i<sections.length;i++){const a=sections[i-1],b=sections[i];indices.push(a,b,a+1,a+1,b,b+1);}
  // Small foam tongues at successive rocky lips and the foot of each cascade.
  for(const i of [3,7,10])for(let j=0;j<3;j++){
   const p=row.points[i],across=(j-1)*row.width*.25,w=row.width*.16,l=.32+(j%2)*.2,base=foam.length/3;
   for(const [a,b] of [[-w,-l],[w,-l],[-w,l],[w,l]]){const x=p.x-uz*(across+a)+ux*b,z=p.z+ux*(across+a)+uz*b,y=height(x,z);if(!Number.isFinite(y))return null;foam.push(x-cell.x,y+.11,z-cell.z);}
   fi.push(base,base+2,base+1,base+1,base+2,base+3);
  }
  function mesh(pos,idx,material,coords){const g=new T.BufferGeometry();if(material.vertexColors)g.setAttribute('color',new T.Float32BufferAttribute(pos.map(()=>1),3));g.setAttribute('position',new T.Float32BufferAttribute(pos,3));if(coords)g.setAttribute('uv',new T.Float32BufferAttribute(coords,2));g.setIndex(idx);g.computeVertexNormals();return new T.Mesh(g,material);}
  row.bankRocks=bankRocks.map((r,i)=>({id:row.id+':bank:'+i,x:r.x,z:r.z,y:r.y+r.high*.45,w:.7+row.width*.1,h:r.high,d:1.1,angle:i*1.7,bank:true}));const banks=new T.InstancedMesh(rockGeometry,rockMaterial,bankRocks.length),dummy=new T.Object3D();bankRocks.forEach((r,i)=>{dummy.position.set(r.x-cell.x,r.y+r.high*.45,r.z-cell.z);dummy.rotation.set(.18,i*1.7,.15);dummy.scale.set(.7+row.width*.1,r.high,1.1);dummy.updateMatrix();banks.setMatrixAt(i,dummy.matrix);});banks.instanceMatrix.needsUpdate=true;banks.computeBoundingSphere();banks.castShadow=true;banks.receiveShadow=true;return[mesh(bed,bi,screeMaterial),mesh(positions,indices,cascadeMaterial,uv),mesh(foam,fi,foamMaterial),banks];
 }
 // Every mapped, open-air watercourse line, shaped once from the real DEM.
 const streamCache=new Map();
 function streamLines(){const rows=[];for(const e of features.values())if(e.kind==='stream'&&!e.waterway?.tunnel)for(const [i,line] of e.lines.entries())if(line.length>1&&line.every(Boolean))rows.push({id:e.id+'#'+i,waterway:e.waterway,line});return rows;}
 function preparedStreams(cell){const rows=[],pad=12;for(const r of streamLines()){let p=streamCache.get(r.id);if(!p){if(datum===null)continue;p=root.BurbzWorldWaterCore.prepare(r.line,r.waterway.kind,r.waterway.intermittent,(x,z)=>joined(x,z));streamCache.set(r.id,p);}
  const b=p.bounds;if(b.x1<cell.x-pad||b.x0>cell.x+k.CHUNK+pad||b.z1<cell.z-pad||b.z0>cell.z+k.CHUNK+pad)continue;rows.push(p);}
  if(streamCache.size>900)for(const key of [...streamCache.keys()].slice(0,300))streamCache.delete(key);return rows;}
 // Everything a chunk needs to decide its nature, gathered once: nearby
 // cover shapes strongest first, lake/sea shapes, road segments and water
 // corridors. Per-point checks then touch only these short lists.
 function chunkContext(cell){const pad=10,x0=cell.x-pad,x1=cell.x+k.CHUNK+pad,z0=cell.z-pad,z1=cell.z+k.CHUNK+pad,seen=new Set(),covers=[],waters=[],roads=[];
  const take=entry=>{if(seen.has(entry))return;seen.add(entry);const b=entry.bounds;
   if(entry.kind==='road'){const cls=PATHS[entry.roadClass]?entry.roadClass:'minor',w=PATHS[cls][0];if(b.x1<x0-w||b.x0>x1+w||b.z1<z0-w||b.z0>z1+w)return;for(const line of entry.lines)for(let i=1;i<line.length;i++){const a=line[i-1],c=line[i];if(!a||!c||Math.max(a.x,c.x)<x0-w||Math.min(a.x,c.x)>x1+w||Math.max(a.z,c.z)<z0-w||Math.min(a.z,c.z)>z1+w)continue;roads.push({a,c,w,rgb:PATH_RGB[cls]});}return;}
   if(!entry.rings||b.x1<x0||b.x0>x1||b.z1<z0||b.z0>z1)return;(entry.kind==='water'?waters:covers).push(entry);};
  for(let ix=Math.floor((x0-PAD)/COVER_CELL);ix<=Math.floor((x1+PAD)/COVER_CELL);ix++)for(let iz=Math.floor((z0-PAD)/COVER_CELL);iz<=Math.floor((z1+PAD)/COVER_CELL);iz++)for(const entry of coverCells.get(ix+','+iz)||[])take(entry);
  for(const entry of coverLarge)take(entry);
  covers.sort((a,b)=>(N().PRIORITY[b.kind]??-1)-(N().PRIORITY[a.kind]??-1));
  const cx=cell.x+k.CHUNK/2,cz=cell.z+k.CHUNK/2,water=[...corridors,...waterways].filter(c=>c.kind==='river'&&Math.hypot(c.x-cx,c.z-cz)<c.end+c.width+k.CHUNK+10);
  return{covers,waters,roads,water,openBias:openBiasAt(cx,cz)};}
 function coverIn(ctx,x,z){for(const entry of ctx.covers)if(inside(entry,x,z))return entry;return null;}
 function lakeIn(ctx,x,z){for(const entry of ctx.waters)if(inside(entry,x,z))return true;return false;}
 function streamNear(ctx,x,z,pad){for(const c of ctx.water)if(k.corridorContains(c,x,z,pad))return true;return false;}
 function roadNear(ctx,x,z,pad){for(const r of ctx.roads)if(root.BurbzVillageWalkCore.distance2(x,z,r.a,r.c)<(r.w+.75+pad)**2)return true;return false;}
 // What grows at a point: the real cover, height above sea, slope, nearby
 // water and today's season decide ground colour, trees and flowers.
 function natureAt(ctx,x,z,y,slope){const c=coverIn(ctx,x,z),wet=streamNear(ctx,x,z,2.5)||lakeIn(ctx,x+2,z)||lakeIn(ctx,x-2,z)?1:streamNear(ctx,x,z,7)?.5:0;
  return N().sample({altitude:y+datum,slope,cover:c?.kind||null,wet,lat:origin.lat,seasons,openBias:ctx.openBias,x:x+shift.x,z:z+shift.z,field:c?.field||0});}
 function natureAtPoint(ctx,x,z,height){const y=height(x,z);if(!Number.isFinite(y))return null;const e=height(x+1.5,z),w=height(x-1.5,z),n=height(x,z+1.5),so=height(x,z-1.5);return natureAt(ctx,x,z,y,[e,w,n,so].every(Number.isFinite)?Math.hypot(e-w,n-so)/3:0);}
 const TINTED={oak:1,birch:1,hawthorn:1,bush:1};
 function natureColor(kind,b,r){
  if(TINTED[kind])return N().crownTint(kind,seasons,r).map(v=>v*(.9+b*.2));
  if(kind==='flowers')return N().flowerColor(r,seasons);
  const autumn=seasons.autumn,winter=seasons.winter,v=.9+b*.2;
  if(kind==='fern'){const t=Math.min(1,Math.max(0,autumn*1.5-.35))+winter*.8;return[v*(1+.55*t),v*(1-.2*t),v*(1-.55*t)];}
  // Heather flowers purple in late summer, then rusts; its foliage stays dark.
  if(kind==='heather'){const bloom=Math.exp(-Math.pow((seasons.day-228)/22,2)),rust=Math.min(1,autumn*1.2+winter)*(1-bloom);return[v*(1+.28*bloom+.08*rust),v*(1-.2*bloom-.02*rust),v*(1+.34*bloom-.16*rust)];}
  if(kind==='grass'||kind==='reeds'){const t=autumn*.55+winter*.4;return[v*(1+.12*t),v,v*(1-.25*t)];}
  return[v,v,v];}
 // Visual scale per species, and each species' full height at scale one.
 const TREE_SCALE={pine:.74,spruce:.68,oak:.72,birch:.66,hawthorn:.95,dead:.8},TREE_HEIGHT={pine:5.1,spruce:5.9,oak:5.3,birch:6.3,hawthorn:3.9,dead:4.1};
 function settlementColor(){return[settlementGround.r*detailRGB[0],settlementGround.g*detailRGB[1],settlementGround.b*detailRGB[2]];}
 // Paths and roads fade smoothly into the ground by their mapped class, so
 // a narrow footpath never breaks into dots on the 2m grid.
 const PATHS={path:[.75,0xa38f6b],track:[1.2,0x9e9278],service:[1.8,0x8a8680],minor:[2.4,0x77756f],tertiary:[2.8,0x706e69],secondary:[3.2,0x6b6965],primary:[3.6,0x676561],trunk:[4.2,0x64625e],motorway:[5,0x605e5b]};
 const PATH_RGB=Object.fromEntries(Object.entries(PATHS).map(([k,v])=>[k,N().linear(v[1])]));
 function roadShade(ctx,x,z){let best=0,rgb=null;for(const r of ctx.roads){const t=1-K().smooth((Math.sqrt(root.BurbzVillageWalkCore.distance2(x,z,r.a,r.c))-r.w)/1.7);if(t>best){best=t;rgb=r.rgb;}}return rgb?{t:best,rgb}:null;}
 const WET_ROCK=N().linear(0x4a4b46);
 // Ground colour per vertex. Slope comes from the chunk's own 2m grid.
 function groundColors(cell,data,ctx,gully=[]){const colors=new Float32Array(data.positions.length),p=data.positions,home=settlementColor(),n=k.CHUNK/k.STEP+1;
  for(let iz=0;iz<n;iz++)for(let ix=0;ix<n;ix++){const i=(iz*n+ix)*3,x=cell.x+p[i],z=cell.z+p[i+2],d=Math.hypot(x,z);
   let rgb;
   if(d<=actualRadius||inPlace(x,z))rgb=home;
   else{const h=j=>p[j*3+1],row=iz*n,e=h(row+Math.min(n-1,ix+1)),w=h(row+Math.max(0,ix-1)),so=h(Math.max(0,iz-1)*n+ix),no=h(Math.min(n-1,iz+1)*n+ix),slope=Math.hypot((e-w)/((Math.min(n-1,ix+1)-Math.max(0,ix-1))*k.STEP),(no-so)/((Math.min(n-1,iz+1)-Math.max(0,iz-1))*k.STEP));
    rgb=natureAt(ctx,x,z,p[i+1],slope).ground;const r=roadShade(ctx,x,z);if(r)rgb=rgb.map((v,j)=>v+(r.rgb[j]-v)*r.t*.9);
    let wet=0;for(const g of gully){const q=Math.hypot(x-g.x,z-g.z);if(q<g.r)wet=Math.max(wet,(1-q/g.r)*g.t);}if(wet>0)rgb=rgb.map((v,j)=>v+(WET_ROCK[j]-v)*Math.min(1,wet*1.4));
    const t=K().smooth((d-actualRadius)/40);if(t<1)rgb=rgb.map((v,j)=>home[j]*(1-t)+v*t);}
   colors[i]=rgb[0];colors[i+1]=rgb[1];colors[i+2]=rgb[2];}
  return colors;}
 // The distant land's own surface under each vertex, from its 16m lattice:
 // height, canopy, colour and normal, interpolated across the same triangles
 // the horizon draws. Before the distant land exists, the ground's own.
 function farAttributes(geometry,cell){const pos=geometry.attributes.position.array,own=geometry.attributes.color.array,nor=geometry.attributes.normal.array,count=pos.length/3,S=16,lattice=new Map();
  const at=(px,pz)=>{const key=px+','+pz;if(!lattice.has(key))lattice.set(key,horizon?.lattice(px,pz)||null);return lattice.get(key);};
  const far=new Float32Array(count*2),color=new Float32Array(count*3),normal=new Float32Array(count*3);
  for(let i=0;i<count;i++){const [[ax,az,wa],[bx,bz,wb],[cx,cz,wc]]=k.latticeCorners(cell.x+pos[i*3],cell.z+pos[i*3+2],S),a=at(ax,az),b=at(bx,bz),c=at(cx,cz);
   if(a&&b&&c){far[i*2]=a.h*wa+b.h*wb+c.h*wc;far[i*2+1]=a.canopy*wa+b.canopy*wb+c.canopy*wc;
    for(let j=0;j<3;j++){color[i*3+j]=a.color[j]*wa+b.color[j]*wb+c.color[j]*wc;normal[i*3+j]=a.normal[j]*wa+b.normal[j]*wb+c.normal[j]*wc;}}
   else{far[i*2]=pos[i*3+1];for(let j=0;j<3;j++){color[i*3+j]=own[i*3+j];normal[i*3+j]=nor[i*3+j];}}}
  return{far,color,normal};}
 // How far the ground under each far tree and boulder moves as it bends onto
 // the distant land: the distant land's height less the chunk's own, there.
 const farSample={crown:[0,0,0]};
 function drops(chunk){for(const items of Object.values(chunk.big))for(const item of items){const f=horizon?.sampleAt(item.x,item.z,farSample),g=k.meshHeight(chunk,chunk.data,item.x,item.z);item.drop=f&&Number.isFinite(g)?f.h-g:0;}}
 // New map data eases in with the distant land, from what each vertex drew.
 const groundClock={value:0},FAR_EASE=(root.BurbzWorldHorizon?.BLEND||1200)/1000;
 function setFar(geometry,cell){const f=farAttributes(geometry,cell),count=f.far.length/2,now=groundClock.value,was=geometry.attributes.groundFar,wasPrev=geometry.attributes.groundFarPrev,wasColor=geometry.attributes.groundFarColor,wasPrevColor=geometry.attributes.groundFarPrevColor;
  const prev=new Float32Array(count*3),prevColor=new Float32Array(count*3);
  for(let i=0;i<count;i++){if(!was){prev[i*3]=f.far[i*2];prev[i*3+1]=f.far[i*2+1];prevColor.set(f.color.subarray(i*3,i*3+3),i*3);continue;}
   const t=Math.max(0,Math.min(1,(now-wasPrev.array[i*3+2])/FAR_EASE));prev[i*3]=wasPrev.array[i*3]+(was.array[i*2]-wasPrev.array[i*3])*t;prev[i*3+1]=wasPrev.array[i*3+1]+(was.array[i*2+1]-wasPrev.array[i*3+1])*t;prev[i*3+2]=now;
   for(let c=0;c<3;c++)prevColor[i*3+c]=wasPrevColor.array[i*3+c]+(wasColor.array[i*3+c]-wasPrevColor.array[i*3+c])*t;}
  for(const [name,array,size] of [['groundFar',f.far,2],['groundFarColor',f.color,3],['groundFarNormal',f.normal,3],['groundFarPrev',prev,3],['groundFarPrevColor',prevColor,3]]){const old=geometry.attributes[name];if(old&&old.array.length===array.length){old.array.set(array);old.needsUpdate=true;}else geometry.setAttribute(name,new T.BufferAttribute(array,size));}}
 function makeChunk(cell){const t0=performance.now(),mark={};const data=k.groundMesh(cell,joined,actualRadius);if(!data)return false;
  if(groundMaterial.map&&groundMaterial.map.version!==detailVersion)refreshDetail();
  const group=new T.Group();group.position.set(cell.x,0,cell.z);group.userData.continuousTerrain=true;
  const sample=(x,z)=>sceneryHeight(cell,data,x,z),ctx=chunkContext(cell),natureHere=(x,z)=>natureAtPoint(ctx,x,z,sample);
  const excluded=(x,z,pad)=>Math.hypot(x,z)<actualRadius+pad+1||inPlace(x,z)||!baseWorld.allowedBeyond(x,z)||roadNear(ctx,x,z,pad)||corridors.some(c=>c.kind==='road'&&k.corridorContains(c,x,z,.35+pad))||[...places.values()].some(p=>Math.hypot(x-p.x,z-p.z)<p.content.radius+pad);
  const dry=(x,z,pad=0)=>!excluded(x,z,pad)&&!streamNear(ctx,x,z,.27+pad)&&!lakeIn(ctx,x,z);
  mark.mesh=performance.now();const flowing=root.BurbzWorldWaterCore.build(cell,k.CHUNK,preparedStreams(cell),sample);mark.streams=performance.now();
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));geometry.setAttribute('color',new T.BufferAttribute(groundColors(cell,data,ctx,flowing.gully),3));mark.colors=performance.now();geometry.setIndex(data.indices);geometry.computeVertexNormals();geometry.computeBoundingSphere();setFar(geometry,cell);mark.far=performance.now();
  const mask=root.BurbzShoreWater.coverage(cell,k.CHUNK,ctx.waters,v=>C().project(origin,{lon:v[0],lat:v[1]}),[{x:0,z:0,radius:actualRadius},...[...places.values()].map(p=>({x:p.x,z:p.z,radius:p.content.radius+2}))]);
  let shoreTexture=null,shoreMaterials=[],material=groundMaterial;
  if(mask?.fullWater)material=mask.fullWater==='sea'?seaMaterial:waterMaterial;
  else if(mask){shoreTexture=new T.CanvasTexture(mask.canvas);shoreTexture.flipY=false;shoreTexture.generateMipmaps=false;shoreTexture.minFilter=shoreTexture.magFilter=T.LinearFilter;material=groundMaterial.clone();styleFog(material);styleGround(material);root.BurbzShoreWater.style(material,waterTime,{...mask,texture:shoreTexture});shoreMaterials.push(material);}
  const ground=new T.Mesh(geometry,material);ground.receiveShadow=true;group.add(ground);
  const chunk={...cell,data,group,ground,shoreTexture,shoreMaterials,trees:[],rocks:k.rocks(cell,shift,sample,(x,z,pad)=>excluded(x,z,pad)||streamNear(ctx,x,z,.27+pad)||lakeIn(ctx,x,z)||[-1,0,1].some(dx=>[-1,0,1].some(dz=>lakeIn(ctx,x+dx*pad,z+dz*pad)))),cascades:[],big:{},shrubs:{},near:{},small:null,sprayOn:false,natureShrubs:false,nearSig:'',farEpoch:horizon?.epoch};
  for(const row of k.cascades(cell,corridors,sample,sceneryExcluded)){const meshes=cascadeMesh(row,cell,sample);if(meshes){group.add(...meshes);chunk.cascades.push(row);chunk.rocks.push(...row.bankRocks);}}
  mark.mask=performance.now();const put=(list,kind,item)=>(list[kind]||=[]).push(item);
  for(const row of k.trees(cell,shift)){const d=Math.hypot(row.x,row.z);if(d<actualRadius+.4||inPlace(row.x,row.z)||!baseWorld.allowedBeyond(row.x,row.z)||roadNear(ctx,row.x,row.z,0)||streamNear(ctx,row.x,row.z,.27)||lakeIn(ctx,row.x,row.z))continue;
   // Trees follow the real cover and ground: woods where woods are mapped,
   // open fell above the treeline, none on cliffs. Positions stay fixed.
   const b=natureHere(row.x,row.z);if(!b||row.tone>=b.trees)continue;
   row.y=k.treeGround(row.x,row.z,row.size,sample);if(row.y===null)continue;
   if(chunk.rocks.some(r=>Math.hypot(row.x-r.x,row.z-r.z)<Math.max(r.w,r.d)+1.1*row.size))continue;
   const r=N().hash(Math.round(row.x*8),Math.round(row.z*8),977);row.kind=N().pick(b.species,r)||'oak';
   // A narrow size range keeps crowns above head height; collision then
   // follows the drawn tree, so the craft cannot fly through a crown.
   const scale=(.85+row.size*.35)*TREE_SCALE[row.kind];row.size=TREE_HEIGHT[row.kind]*scale/3.7;chunk.trees.push(row);
   // Each tree has a detailed near form and a simple distant one.
   const item={x:row.x,y:row.y-.06,z:row.z,angle:row.angle,scale,color:natureColor(row.kind,row.tone,r),n:chunk.trees.length};put(chunk.near,row.kind,item);put(chunk.big,row.kind+'Far',item);
  }
  for(const [i,b] of flowing.banks.entries()){const row={id:cell.id+':gill:'+i,x:b.x,z:b.z,y:b.y,w:b.size*1.1,h:b.size*.7,d:b.size,angle:b.angle,bank:true};chunk.rocks.push(row);put(chunk.big,'boulder',{x:row.x,y:row.y,z:row.z,angle:row.angle,tilt:.1,tiltZ:.14,scale:1,sx:row.w,sy:row.h,sz:row.d,color:[.9,.9,.9]});}
  // Weathered grey stone, warmer or cooler rock by rock.
  for(const row of chunk.rocks)if(!row.bank){const t=row.tone??.5;put(chunk.big,'boulder',{x:row.x,y:row.y,z:row.z,angle:row.angle,tilt:.12,tiltZ:.08,scale:1,sx:row.w,sy:row.h,sz:row.d,color:[.9+t*.18,.9+t*.14,.88+t*.1]});}
  // Shrubs, logs and stumps on a 4.6m grid; flowers, grasses, ferns, heather,
  // reeds and stones on a 2m grid, prepared only when the viewer comes near.
  mark.trees=performance.now();for(const row of N().scatter(cell,k.CHUNK,4.6,701,shift)){if(!dry(row.x,row.z,.6))continue;const b=natureHere(row.x,row.z);if(!b||row.a>=b.shrubs)continue;
   const kind=N().pick({bush:b.plants.bush+.04,gorse:b.plants.gorse,log:b.plants.log,stump:b.plants.log*.7},row.b);if(!kind)continue;const y=sample(row.x,row.z);if(!Number.isFinite(y))continue;
   put(chunk.shrubs,kind,{x:row.x,y:y-.04,z:row.z,angle:row.c*Math.PI*2,scale:.75+row.d*.6,color:natureColor(kind,row.d,row.c)});}
  chunk.buildSmall=()=>{const small={};let count=0;for(const row of N().scatter(cell,k.CHUNK,2,733,shift)){if(!dry(row.x,row.z,.2))continue;const b=natureHere(row.x,row.z);if(!b||row.a>=b.flora)continue;
   const {grass,flowers,fern,heather,reeds,mushroom,stone}=b.plants,kind=N().pick({grass,flowers,fern,heather,reeds,mushroom,stone},row.b);if(!kind)continue;const y=sample(row.x,row.z);if(!Number.isFinite(y))continue;
   put(small,kind,{x:row.x,y:y-.03,z:row.z,angle:row.c*Math.PI*2,scale:.7+row.d*.65,color:natureColor(kind,row.d,row.c),n:count++});}chunk.small=small;chunk.buildSmall=null;};
  mark.big=performance.now();
  const stream=root.BurbzWorldWater.streamMesh(T,flowing,streamMaterial);if(stream)group.add(stream);chunk.spray=flowing.mist;chunk.streamTriangles=flowing.indices.length/3;
  for(const corridor of corridors)for(const bank of corridor.bankMaterial?[false,true]:[false]){const data=k.ribbonMesh(cell,corridor,(x,z)=>k.meshHeight(cell,chunk.data,x,z),bank);if(!data?.indices.length)continue;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));geo.setIndex(data.indices);geo.computeVertexNormals();const ribbon=new T.Mesh(geo,bank?corridor.bankMaterial:corridor.material);ribbon.receiveShadow=true;group.add(ribbon);}
  drops(chunk);mark.rest=performance.now();const prof=metrics.chunkParts||={};let last=t0;for(const [key,at] of Object.entries(mark)){prof[key]=(prof[key]||0)+(at-last);last=at;}prof.total=(prof.total||0)+(performance.now()-t0);prof.count=(prof.count||0)+1;
  return chunk;
 }
 // A built chunk joins the scene with every tree and boulder in the pools;
 // the pools draw each at its own distance.
 function insert(chunk){scene.add(chunk.group);chunks.set(chunk.id,chunk);for(const [kind,items] of Object.entries(chunk.big))nature.add(chunk.id+':big',kind,items);metrics.created++;metrics.maxChunks=Math.max(metrics.maxChunks,chunks.size);}
 // Every tree and boulder of a built chunk is pooled from the start. Shrubs,
 // detailed trees and ground plants join by distance: shrubs within 100m,
 // detailed trees within 44m of the eye and ground plants within 30m, plant by
 // plant, re-read each visit. Flowers and grasses matter only near the
 // ground: a high flight drops them, and each visit prepares at most one
 // chunk's worth.
 function registerChunk(chunk,eye,low,prepare){const d=distanceToBounds({x0:chunk.x,x1:chunk.x+k.CHUNK,z0:chunk.z,z1:chunk.z+k.CHUNK},s.player);
  if(!chunk.sprayOn&&d<132){chunk.sprayOn=true;spray.set(chunk.id,chunk.spray);}else if(chunk.sprayOn&&d>146){chunk.sprayOn=false;spray.set(chunk.id,null);}
  if(!chunk.natureShrubs&&d<100){chunk.natureShrubs=true;for(const [kind,items] of Object.entries(chunk.shrubs))nature.add(chunk.id+':shrubs',kind,items);}
  else if(chunk.natureShrubs&&d>112){chunk.natureShrubs=false;nature.remove(chunk.id+':shrubs');}
  let sig='';const near={};
  const gather=(source,inside,prefix)=>{for(const [kind,items] of Object.entries(source||{}))for(const it of items)if(inside(it)){(near[kind]||=[]).push(it);sig+=prefix+it.n+',';}};
  if(d<44)gather(chunk.near,it=>Math.hypot(it.x-eye.x,it.y-eye.y,it.z-eye.z)<44,'t');
  if(d<30&&low){if(chunk.buildSmall&&prepare())chunk.buildSmall();gather(chunk.small,it=>Math.hypot(it.x-s.player.x,it.z-s.player.z)<30,'s');}
  if(sig!==chunk.nearSig){nature.remove(chunk.id+':near');for(const [kind,items] of Object.entries(near))nature.add(chunk.id+':near',kind,items);chunk.nearSig=sig;}}
 function lowView(){const ground=height(s.player.x,s.player.z);return s.player.mode!=='fly'||!Number.isFinite(ground)||s.player.y-ground<30;}
 function registerNature(time){if(time-lastNature<.2)return;lastNature=time;let prepared=0;const low=lowView();
  for(const chunk of chunks.values())registerChunk(chunk,natureEye.value,low,()=>!prepared++);}
 // The detailed ground shows inside a square of built chunks, at most four
 // rings out; the fifth ring is built ahead so the square rarely waits. The
 // target grows side by side as whole columns finish. The shown square eases
 // after it, shrinking first, so the ground bends onto the distant land and
 // back smoothly instead of popping. The horizon is cut at the chunk-aligned
 // square around it, where the bent ground already matches the distant land.
 const shown={x0:0,z0:0,x1:0,z1:0,ready:false};let cut={x0:0,z0:0,x1:0,z1:0},shownAt=0;
 function showSquare(time){const C=k.CHUNK,dt=Math.min(.1,Math.max(0,time-shownAt));shownAt=time;
  cut=k.easeSquare(shown,k.showTarget((x,z)=>chunks.has(x+','+z),Math.floor(s.player.x/C),Math.floor(s.player.z/C)),80*dt);return{cut,bend:shown};}
 // When the distant land is rebuilt, the ground's bend onto it follows:
 // edge chunks first, within 3ms a frame.
 function refreshFar(){const epoch=horizon?.epoch;if(epoch===undefined)return;let late=null;for(const c of chunks.values())if(c.farEpoch!==epoch)(late||=[]).push(c);if(!late)return;
  const inset=c=>Math.min(c.x-shown.x0,shown.x1-c.x-k.CHUNK,c.z-shown.z0,shown.z1-c.z-k.CHUNK);late.sort((a,b)=>inset(a)-inset(b));
  const until=performance.now()+3;for(const c of late){setFar(c.ground.geometry,c);drops(c);for(const [kind,items] of Object.entries(c.big))nature.redrop(kind,items);c.farEpoch=epoch;if(performance.now()>until)break;}}
 // Canopy crowns carry each wood on beyond the far trees, out to where the
 // distant canopy rises: one crown for a few trees, on a jittered 6.4m grid
 // fixed in the world, read from the distant land's record of the wood. They
 // stand on its surface, where the ground has already bent onto it. Cells of
 // 64m join 40m before any crown in them can show: missing cells first, then
 // cells whose record changed, nearest first, 1.5-3ms a frame.
 const crownCells=new Map(),crownSample={crown:[0,0,0]},CROWN=64,CROWN_GRID=6.4;let crownEpoch=-1,lastCrowns=-Infinity,crownQueue=[];
 function crowns(time){if(!horizon?.ready||!hazeOn)return;const W=root.BurbzWorldNature;
  if(time-lastCrowns>=.2){lastCrowns=time;const reach=W.CROWNS[0]+W.CROWNS[1]+40,inner=W.END[0]-8,p=s.player,epoch=horizon.epoch,want=new Map();
   if(epoch!==crownEpoch){crownEpoch=epoch;for(const cell of crownCells.values())cell.stale=true;}
   for(let cx=Math.floor((p.x-reach)/CROWN);cx<=Math.floor((p.x+reach)/CROWN);cx++)for(let cz=Math.floor((p.z-reach)/CROWN);cz<=Math.floor((p.z+reach)/CROWN);cz++){const x0=cx*CROWN,z0=cz*CROWN,near=Math.hypot(Math.max(x0-p.x,0,p.x-x0-CROWN),Math.max(z0-p.z,0,p.z-z0-CROWN)),far=Math.hypot(Math.max(Math.abs(p.x-x0),Math.abs(p.x-x0-CROWN)),Math.max(Math.abs(p.z-z0),Math.abs(p.z-z0-CROWN)));if(near<reach&&far>inner)want.set(cx+','+cz,near);}
   for(const key of [...crownCells.keys()])if(!want.has(key)){nature.remove('crown:'+key);crownCells.delete(key);}
   crownQueue=[...want].filter(([key])=>!crownCells.has(key)||crownCells.get(key).stale).map(([key,near])=>[key,near+(crownCells.has(key)?1e4:0)]).sort((a,b)=>a[1]-b[1]).map(([key])=>key);}
  // Missing cells get twice the time, so a new journey's crowns are soon ready.
  const until=performance.now()+(crownQueue.length&&!crownCells.has(crownQueue[0])?3:1.5);while(crownQueue.length&&performance.now()<until)buildCrowns(crownQueue.shift());}
 function buildCrowns(key){const [cx,cz]=key.split(',').map(Number),n=Math.round(CROWN/CROWN_GRID),items={crownBroad:[],crownConifer:[]},H=N().hash;let complete=true;
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){const ix=cx*n+i,iz=cz*n+j,x=(ix+.15+.7*H(ix,iz,463))*CROWN_GRID,z=(iz+.15+.7*H(ix,iz,521))*CROWN_GRID,f=horizon.sampleAt(x,z,crownSample);if(!f){complete=false;continue;}if(H(ix,iz,389)>=f.wood)continue;
   const tone=.9+.2*H(ix,iz,613);items[H(ix,iz,587)<f.conifer?'crownConifer':'crownBroad'].push({x,y:f.h-.08,z,angle:H(ix,iz,647)*Math.PI*2,scale:.85+.3*H(ix,iz,683),color:[f.crown[0]*tone,f.crown[1]*tone,f.crown[2]*tone]});}
  nature.remove('crown:'+key);for(const [kind,list] of Object.entries(items))nature.add('crown:'+key,kind,list);crownCells.set(key,{stale:!complete,count:items.crownBroad.length+items.crownConifer.length});}
 // The real weather where the player stands clouds the sky. Rain thickens the
 // haze, so the far land greys away as it does on a wet day.
 let weatherTime=-Infinity,weatherNow=null;
 function weatherAt(time){if(time-weatherTime>=1){weatherTime=time;const p=pose();if(p)weatherNow=root.BurbzCalmAudio?.weather?.(p.lat,p.lon)||weatherNow;}return weatherNow;}
 function weatherHaze(){if(!hazeOn||!scene.fog)return;const w=skyDriver?.weather?.(),rain=w?.rain||0,grey=w?Math.max(0,Math.min(1,(w.cover-.6)/.4)):0;scene.fog.near=HAZE[0]*(1-.55*rain);scene.fog.far=HAZE[1]*(1-.12*grey-.5*rain);}
 function haze(on){if(on===hazeOn||!scene.fog)return;hazeOn=on;
  if(on){scene.fog.near=HAZE[0];scene.fog.far=HAZE[1];scene.userData.inkFog=[110,520];s.source.camera.far=6500;}
  else{scene.fog.far=Math.min(DETAIL,originalFog?.far??DETAIL);scene.fog.near=Math.min(originalFog?.near??52,scene.fog.far*.5);delete scene.userData.inkFog;s.source.camera.far=650;}
  s.source.camera.updateProjectionMatrix();}
 // Chunks the shown square still covers stay until it has eased past them.
 // New chunks build nearest first to where the viewer will be a second from
 // now, so the ground ahead of a fast flight is ready first.
 const ahead={x:0,z:0};let aheadFrom=null;
 function lead(time){if(aheadFrom&&time>aheadFrom.t){const dt=time-aheadFrom.t,k2=Math.min(1,dt*3);ahead.x+=((s.player.x-aheadFrom.x)/dt-ahead.x)*k2;ahead.z+=((s.player.z-aheadFrom.z)/dt-ahead.z)*k2;}aheadFrom={x:s.player.x,z:s.player.z,t:time};}
 function queue(){const wanted=k.chunks(s.player.x,s.player.z),ids=new Set(wanted.map(c=>c.id));pending.length=0;for(const c of wanted)if(!chunks.has(c.id))pending.push(c);
  const to={x:s.player.x+Math.max(-48,Math.min(48,ahead.x)),z:s.player.z+Math.max(-48,Math.min(48,ahead.z))},C2=k.CHUNK/2,far=c=>Math.max(Math.abs(c.x+C2-to.x),Math.abs(c.z+C2-to.z));pending.sort((a,b)=>far(a)-far(b));
  for(const c of [...chunks.values()])if(!ids.has(c.id)&&!(shown.ready&&c.x<cut.x1&&c.x+k.CHUNK>cut.x0&&c.z<cut.z1&&c.z+k.CHUNK>cut.z0))retire(c);}
 // New chunks first, nearest first. Then chunks whose map data changed are
 // rebuilt in place: the old one stays until its replacement is ready.
 function stream(budget=4){const start=performance.now();let built=0;
  while(pending.length&&built<2&&performance.now()-start<budget){const chunk=makeChunk(pending[0]);if(!chunk)break;pending.shift();insert(chunk);built++;}
  while(!pending.length&&stale.size&&built<2&&performance.now()-start<budget){let best=null,near=Infinity;for(const id of stale){const c=chunks.get(id);if(!c){stale.delete(id);continue;}const d=Math.hypot(c.x+k.CHUNK/2-s.player.x,c.z+k.CHUNK/2-s.player.z);if(d<near){best=c;near=d;}}if(!best)break;
   const chunk=makeChunk({id:best.id,x:best.x,z:best.z,d:best.d});if(!chunk)break;retire(best);insert(chunk);registerChunk(chunk,natureEye.value,lowView(),()=>true);built++;}
  metrics.streamMs.push(performance.now()-start);if(metrics.streamMs.length>240)metrics.streamMs.shift();}
 async function createMap(){await opts.loadMap?.();if(closed||s.closed)return;map=new root.maplibregl.Map({container:host,style:opts.style,center:[opts.initialPose?.lon??origin.lon,opts.initialPose?.lat??origin.lat],zoom:14,pitch:0,bearing:0,interactive:false,attributionControl:false,maxTileCacheSize:48,pixelRatio:1,canvasContextAttributes:{antialias:false}});
  map.on('load',()=>{if(closed)return;map.addSource(DEM,root.BurbzGeographicMap3D.DEM);map.setTerrain({source:DEM,exaggeration:1});loaded=true;});
  map.on('sourcedata',e=>{if(closed)return;idle=false;if(e.sourceId===DEM&&e.tile?.dem&&e.coord?.canonical){const c=e.coord.canonical,id=c.z+'/'+c.x+'/'+c.y;if(!tiles.has(id))tiles.set(id,{...c,dem:e.tile.dem});if(tiles.size>MAX_TILES)tiles.delete(tiles.keys().next().value);lookup=[...tiles.values()].sort((a,b)=>b.z-a.z);}});
  map.on('idle',()=>{idle=true;readFeatures();});map.on('error',e=>{errors.push(String(e.error?.message||'Map data unavailable'));if(errors.length>6)errors.shift();});
  const until=performance.now()+25000;while(!closed&&!s.closed&&performance.now()<until){if(loaded&&idle&&raw(0,0)!==null){datum=raw(0,0);horizon?.setDatum(datum);refreshPlaces();queue();while(pending.length&&!closed&&!s.closed){const before=pending.length;stream(8);if(before===pending.length)break;await sleep();}if(!pending.length&&visibleCoverage(s.player.x,s.player.z))return;}await sleep();}
  if(!closed&&!s.closed)throw Error('Nearby terrain could not load. Return to the settlement and retry online.');
 }
 function pose(){return datum===null?null:{...C().unproject(origin,{x:s.player.x,y:s.player.y+datum,z:s.player.z}),yaw:s.player.yaw,pitch:s.player.pitch,mode:['fly','swim'].includes(s.player.mode)?s.player.mode:'walk'};}
 async function save(){if(closed||s.room||datum===null)return true;try{if(await (craftRuntime?craftRuntime.save():opts.savePose?.(pose()))===false)throw Error("save");return true;}catch(_){message('Your position could not be saved. Please try again before leaving.');return false;}}
 function syncControls(){const craft=craftRuntime?.sync();if(!s.room){const title=s.root.querySelector('.vw-title small'),label=s.player.mode==='swim'?'SWIMMING':s.player.mode==='fly'?'CRAFT FLIGHT':craft?.aboard?'ABOARD CRAFT':'ON FOOT';if(title&&title.textContent!==label)title.textContent=label;}if(craft){wing.textContent=craft.label;wing.setAttribute('aria-disabled',String(!craft.enabled));}wing.hidden=!!s.room||s.uiBusy||!craft?.visible;rise.hidden=descend.hidden=wing.hidden||s.player.mode!=='fly';
  // A stalling craft lights its Flap button: beat the wings, or dive for speed.
  const stalling=!rise.hidden&&s.player.wing?.stall>.5;if(rise.dataset.stall!==String(stalling)){rise.dataset.stall=String(stalling);rise.style.boxShadow=stalling?'0 0 0 3px #e0643f,0 0 14px #e0643f':'';}if(s.room)visit.hidden=true;}
 function update(time){homeUI.update();craftRuntime?.update(time);campRuntime?.update(time);syncControls();const homePlace=places.get('home');build.hidden=closed||!!s.room||s.uiBusy||s.player.mode!=='walk'||!opts.openBuild||!homePlace||opts.getHome?.()?.tier<1||Math.hypot(s.player.x-homePlace.x,s.player.z-homePlace.z)>root.BurbzPlayerHomeCore.YARD.walk;if(closed||s.room)return;skyDriver?.update(time,weatherAt(time));waterTime.value=matchMedia('(prefers-reduced-motion: reduce)').matches?0:time;shadows();natureEye.value.set(s.player.x,s.player.y+1.38,s.player.z);groundClock.value=time;registerNature(time);spray.update(s.source.renderer,scene.fog);
  // Water mirrors the real sky: the sun or moon, and the colour overhead.
  const waterSky=root.BurbzShoreWater.sky;if(skyDriver&&waterSky.sun.value){waterSky.sun.value.copy(skyDriver.direction());const top=skyDriver.group?.children[0]?.material?.uniforms?.top?.value;if(top)waterSky.zenith.value.copy(top);}for(const object of sky){const p=initialSky.get(object);object.position.set(p.x+s.player.x,p.y+s.player.y,p.z+s.player.z);}
  const next=safeAt(s.player.x,s.player.z)?'settlement':'wilderness';if(next!==zone){zone=next;metrics.transitions++;}s.root.dataset.walkZone=zone;
  if(time-lastPlaces>.75){lastPlaces=time;refreshPlaces();selectDiscoveries();visitTarget=inPlace(s.player.x,s.player.z)||null;visit.hidden=!visitTarget||visitTarget.record.kind==='wayside'||s.uiBusy||s.player.mode!=='walk';visit.textContent=visitTarget?(visitTarget.record.kind==='home'?'Enter '+visitTarget.record.name:(visitTarget.record.owned?'Manage ':'Visit ')+visitTarget.record.name):'';}
  lead(time);if(time-lastStream>.18){lastStream=time;queue();stream();pruneSteady();const p=geo(s.player.x,s.player.z);if(p&&(!lastCentre||C().distance(p,lastCentre)>180)){lastCentre=p;map.jumpTo({center:[p.lon,p.lat],zoom:14,pitch:0});}}
  else stream();
  // The shown square and the distant land meet with no seam. Without the
  // distant land, opaque fog hides whole chunks and far trees beyond it.
  const view=showSquare(time);horizon?.update(s.player,view,time);haze(!!horizon?.ready);weatherHaze();
  if(hazeOn){if(shown.ready)groundHole.value.set(shown.x0,shown.z0,shown.x1,shown.z1);else groundHole.value.set(0,0,0,0);natureEdge.value.copy(groundHole.value);}
  else{const r=DETAIL+7;groundHole.value.set(-1e6,-1e6,1e6,1e6);natureEdge.value.set(s.player.x-r,s.player.z-r,s.player.x+r,s.player.z+r);}
  // Every change to the pools this frame reaches the GPU before it draws,
  // so no plant is ever drawn a frame from stale data.
  nature.update();refreshFar();crowns(time);nature.flush();
  for(const chunk of chunks.values())chunk.group.visible=hazeOn?chunk.x>=cut.x0&&chunk.x<cut.x1&&chunk.z>=cut.z0&&chunk.z<cut.z1:distanceToBounds({x0:chunk.x,x1:chunk.x+k.CHUNK,z0:chunk.z,z1:chunk.z+k.CHUNK},s.player)<DETAIL+7;
  // Keep distant prepared settlements cached but outside the render graph.
  // Visibility alone still makes Three traverse their entire matrix trees.
  // Reattach beyond the opaque fog margin, before any geometry is visible.
  originCull.update(time,s.player,DETAIL);
  if(animateOrigin()){if(originGroup.parent!==scene){scene.add(originGroup);originGroup.updateMatrixWorld(true);}}else originGroup.removeFromParent();
  for(const p of places.values()){
    const near=Math.hypot(p.x-s.player.x,p.z-s.player.z)<p.content.radius+DETAIL+32,group=p.content.group;
    if(near){if(group.parent!==scene){scene.add(group);group.updateMatrixWorld(true);}group.visible=true;p.content.update?.(time);p.cull?.update(time,s.player,DETAIL);}
    else if(group.parent===scene)group.removeFromParent();
  }
  if(!visibleCoverage(s.player.x,s.player.z))message('Loading the countryside ahead…');else if(!note.textContent.includes('saved'))message('');
  if(time-lastSave>8){lastSave=time;save();}
 }
 function move(input,dt){const before={...s.player},moving=Math.hypot(input.side||0,input.forward||0)>.01,ms=Math.min(.05,Math.max(0,dt||0))*1000;if(moving){metrics.movingFrames++;metrics.movingMs+=ms;}if(!visibleCoverage(s.player.x,s.player.z)){if(moving){metrics.loadingFrames++;metrics.loadingMs+=Math.max(0,dt||0)*1000;}return;}if(!craftRuntime?.move({...input,lift:(input.lift||0)+lift},dt))root.BurbzVillageWalkCore.move(s.player,input,dt,world);if(!visibleCoverage(s.player.x,s.player.z)){Object.assign(s.player,before);if(moving){metrics.loadingFrames++;metrics.loadingMs+=Math.max(0,dt||0)*1000;}message('Loading the countryside ahead…');}metrics.distance+=Math.hypot(s.player.x-before.x,s.player.z-before.z);if(Math.hypot(s.player.x-before.x,s.player.z-before.z)>0&&(!lastExplored||Math.hypot(s.player.x-lastExplored.x,s.player.z-lastExplored.z)>12)){opts.exploration?.reveal(pose());lastExplored={x:s.player.x,z:s.player.z};}}
 function dispose(){if(closed)return;save();closed=true;craftRuntime?.dispose();campRuntime?.dispose();skyDriver?.dispose();homeUI.dispose();originCull.dispose();for(const child of [...originGroup.children])scene.add(child);originGroup.removeFromParent();overviewHomes.forEach(row=>row.object.visible=row.visible);map?.remove();map=null;for(const c of [...chunks.values()])retire(c);nature.dispose();horizon?.dispose();spray.dispose();streamMaterial.dispose();streamCache.clear();delete scene.userData.inkFog;groundMaterial.dispose();waterMaterial.dispose();seaMaterial.dispose();rockMaterial.dispose();screeMaterial.dispose();rockGeometry.dispose();cascadeMaterial.dispose();foamMaterial.dispose();if(originalContinuousFog===undefined)delete scene.userData.continuousFog;else scene.userData.continuousFog=originalContinuousFog;surface.ground.visible=groundVisible;corridors.forEach((c,i)=>c.object.visible=corridorVisibility[i]);if(originalFog){scene.fog.near=originalFog.near;scene.fog.far=originalFog.far;scene.fog.color.copy(originalFog.color);}for(const row of shadowLights){row.light.position.copy(row.position);row.light.target.position.copy(row.target);Object.assign(row.light.shadow.camera,row.camera);row.light.shadow.camera.updateProjectionMatrix();scene.remove(row.light.target);}s.source.renderer.shadowMap.needsUpdate=true;for(const object of sky)object.position.copy(initialSky.get(object));for(const p of preparing.values())p.abort.abort();preparing.clear();for(const p of places.values())p.content.dispose();places.clear();host.remove();note.remove();credits.dispose();visit.remove();build.remove();wing.remove();rise.remove();descend.remove();for(const [material,old] of fogMaterials){material.onBeforeCompile=old.previous;material.customProgramCacheKey=old.key;material.needsUpdate=true;}fogMaterials.clear();tiles.clear();features.clear();maskCache.clear();pending.length=0;delete s.root.dataset.walkZone;}
 let lift=0,eyeShift=0;const motion={};
 const wing=document.createElement('button'),rise=document.createElement('button'),descend=document.createElement('button');wing.type=rise.type=descend.type='button';wing.textContent='Spread wings';wing.className='cw-wings';wing.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:38px;z-index:6;min-height:44px;background:#203b2b;color:#fff3d1;border:1px solid #c9b27b;border-radius:8px;padding:10px';s.root.append(wing);
 for(const [button,label,value,bottom] of [[rise,'Flap',1,156],[descend,'Dive',-1,104]]){button.textContent=label;button.setAttribute('aria-label',label);button.hidden=true;button.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:'+bottom+'px;z-index:6;min-width:84px;min-height:44px;background:#203b2b;color:#fff3d1;border:1px solid #c9b27b;border-radius:8px';s.root.append(button);button.addEventListener('pointerdown',e=>{if(s.uiBusy)return;e.preventDefault();button.setPointerCapture(e.pointerId);lift=value;},{signal:s.abort.signal});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>lift=0,{signal:s.abort.signal});}
 function toggleFlight(mode){if(!craftRuntime||s.room||s.uiBusy)return false;if(mode==='fly'&&s.player.mode==='fly')return craftRuntime.aboard();if(mode==='walk'&&s.player.mode!=='fly')return true;const before=s.player.y,result=craftRuntime.control();if(result){eyeShift+=before-s.player.y;lift=0;syncControls();s.root.querySelector('.vw-title small').textContent=s.player.mode==='fly'?'CRAFT FLIGHT':craftRuntime.aboard()?'ABOARD CRAFT':'ON FOOT';}return result;}
 wing.addEventListener('click',()=>toggleFlight(),{signal:s.abort.signal});
 const homeUI=homeActions(s,opts,pose,visibleCoverage);
 campRuntime=root.BurbzExploration?.attach(s,opts,{origin,pose,height,covered:visibleCoverage,allowed,water:(x,z)=>river(x,z)||masks('water',x,z),style:styleFog});
 function buildingFrame(object){
  const place=[...places.values()].find(p=>p.content.buildings?.includes(object));
  const source=place?.content||s.source,group=place?source.group:originGroup;
  if(!source.buildings?.includes(object))return null;
  const local=()=>({x:s.player.x-(place?.x||0),z:s.player.z-(place?.z||0)});
  return{scene:group,world:place?source.world:baseWorld,buildings:source.buildings,movers:source.movers,
   unbatch:place||source.batchState?source.batchState?.value:s.unbatch,local,valid:()=>!closed&&(!place||places.get(place.record.id)===place),
   install(change){
    if(place)place.cull.dispose();else originCull.dispose();
    change.commit();source.changed?.(change);source.movers.splice(0,source.movers.length,...source.movers.filter(o=>{for(let p=o;p;p=p.parent)if(p===group)return true;return false;}));source.buildings.splice(0,source.buildings.length,...change.buildings);
    const next=change.world;
    if(place){source.world={...next,allowed:next.allowedBeyond};source.discovery.world=next;source.solids=source.buildings.map(b=>{const box=new T.Box3().setFromObject(b);return{x:(box.min.x+box.max.x)/2-place.x,z:(box.min.z+box.max.z)/2-place.z,w:box.max.x-box.min.x,d:box.max.z-box.min.z,minY:box.min.y-place.base,maxY:box.max.y-place.base};});}
    else{baseWorld=next;if(source.world)source.world=next;solidBoxes.splice(0,solidBoxes.length,...source.buildings.filter(b=>!b.userData.townGround).map(b=>new T.Box3().setFromObject(b)));}
    if(source.batchState)source.batchState.value=change.batch;else s.unbatch=change.batch;
    group.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])styleFog(m);});
    if(place)place.cull=root.BurbzVillageWalkScene.distanceCull(T,group,source.movers);else originCull=root.BurbzVillageWalkScene.distanceCull(T,group,source.movers);
    placeVersion++;s.source.renderer.shadowMap.needsUpdate=true;
   }};
 }
 const api={world,closePanel:()=>campRuntime?.closePanel(),buildingFrame,people(target){const p=[...places.values()].find(p=>target.scope==='wayside'?p.record.id===target.placeId:(p.content.buildings||[]).some(b=>Number(b.userData.wardSeed)===Number(target.seed)));return p?.content.people?p.content.people(target):s.source.people?s.source.people(target):s.options.interiors?.people?.(target)||[];},buildings:()=>[...s.source.buildings,...[...places.values()].flatMap(p=>p.content.buildings||[])],get placeVersion(){return placeVersion;},navigation:()=>({origin,pose:pose(),player:s.player,exploration:opts.exploration?.read(),light:opts.territoryLight?.().circles||[],camps:campRuntime?.markers()||[],craft:craftRuntime?.marker(),polygons:world.polygons,corridors,features:[...features.values()].filter(f=>['water','wood','road','stream'].includes(f.kind)),places:[{record:opts.record,x:0,z:0,radius:actualRadius},...places.values()].map(p=>({name:p.record.name,x:p.x,z:p.z,radius:p.radius||p.content.radius}))}),update,animateOrigin,move,save,dispose,safeAt,syncControls,toggleFlight,craftAboard:()=>craftRuntime?.aboard()===true,canClose:()=>craftRuntime?.save()!==false,reset(){lift=0;if(s.player.mode!=='fly')C().reset(s.player);},camera(dt){eyeShift*=Math.exp(-Math.min(.08,dt)*8);const m=s.player.mode==='fly'?root.BurbzAcademyFlightCore.cameraMotion(motion,s.player,dt,matchMedia('(prefers-reduced-motion: reduce)').matches):{bob:0,pitch:0,roll:0};return{...m,bob:m.bob+eyeShift};},replaceBase(next){baseWorld=next;return world;},diagnostics(full=false){return{craft:craftRuntime?.diagnostics(),camps:campRuntime?.diagnostics(),sky:skyDriver?.diagnostics(),origin,datum,zone,authoredRadius:actualRadius,originReach,pose:pose(),shoreTextures:[...chunks.values()].filter(c=>c.shoreTexture).length,shoreBytes:[...chunks.values()].filter(c=>c.shoreTexture).length*128*128*4,chunks:chunks.size,chunkIds:[...chunks.values()].map(c=>({id:c.id,uuid:c.group.uuid})),pending:pending.length,preparingPlaces:[...preparing.values()].map(p=>({id:p.record.id,failed:!!p.failed})),rocks:[...chunks.values()].reduce((n,c)=>n+c.rocks.length,0),cascades:[...chunks.values()].flatMap(c=>c.cascades.map(r=>({id:r.id,x:r.x,z:r.z,drop:r.drop,top:r.points[0],foot:r.points[r.points.length-1]}))),treeSamples:full?[...chunks.values()].flatMap(c=>c.trees.map(t=>({x:t.x,y:t.y,z:t.z,size:t.size}))):undefined,trees:[...chunks.values()].reduce((n,c)=>n+c.trees.length,0),crowns:{cells:crownCells.size,count:[...crownCells.values()].reduce((n,c)=>n+c.count,0),stale:[...crownCells.values()].filter(c=>c.stale).length},weather:skyDriver?.weather?.(),fog:scene.fog&&[Math.round(scene.fog.near),Math.round(scene.fog.far)],nature:nature.diagnostics(),spray:spray.count(),streams:streamCache.size,featureKinds:full?[...features.values()].reduce((m,e)=>(m[e.kind]=(m[e.kind]||0)+1,m),{}):undefined,waterBounds:full?[...features.values()].filter(e=>e.kind==='water').map(e=>[Math.round(e.bounds.x0),Math.round(e.bounds.z0),Math.round(e.bounds.x1),Math.round(e.bounds.z1),e.waterClass]):undefined,streamTriangles:[...chunks.values()].reduce((n,c)=>n+(c.streamTriangles||0),0),falls:full?[...streamCache.values()].flatMap(p=>p.falls.map(f=>({x:Math.round(f.foot.x),z:Math.round(f.foot.z),topX:Math.round(f.top.x),topZ:Math.round(f.top.z),drop:Math.round(f.drop*10)/10,width:f.width}))):undefined,openBias:openBiasAt(s.player.x,s.player.z),horizon:horizon?.diagnostics(),haze:hazeOn,shown:{...shown},cut:{...cut},stale:stale.size,treeIds:full?[...chunks.values()].flatMap(c=>c.trees.map(t=>t.id)):undefined,tileCount:tiles.size,featureCount:features.size,visibleCoverage:visibleCoverage(s.player.x,s.player.z),errors:errors.slice(),metrics:{...metrics},places:[...places.values()].map(p=>({id:p.record.id,kind:p.record.kind,name:p.record.name,x:p.x,z:p.z,radius:p.content.radius,farmPlots:p.content.farmPlots,buildings:p.content.buildings?.filter(b=>b.userData.buildingId).map(b=>({id:b.userData.buildingId,seed:b.userData.wardSeed,x:b.position.x,z:b.position.z,construction:!!b.userData.construction,level:b.userData.modelLevel}))})),corridors:corridors.map(c=>({kind:c.kind,x:c.x,z:c.z,ux:c.ux,uz:c.uz,width:c.width,start:c.start,end:c.end})),record:opts.record};}};
 s.continuity=api;s.abort.signal.addEventListener('abort',dispose,{once:true});
 try{await createMap();if(closed||s.closed){dispose();return null;}if(initial){const y=height(s.player.x,s.player.z);if(y===null)throw Error('Your saved place has not loaded. Please try again.');s.player.y=s.player.mode==='fly'?Math.max(y+1,(opts.initialPose.altitude||0)-datum):y;}if(opts.safeArrival){let arrival=null;const x=s.player.x,z=s.player.z;for(let ring=0;ring<=8&&!arrival;ring++)for(let i=0;i<(ring?24:1);i++){const px=x+Math.sin(i*Math.PI/12)*ring*.5,pz=z+Math.cos(i*Math.PI/12)*ring*.5,y=height(px,pz);if(Number.isFinite(y)&&visibleCoverage(px,pz)&&allowed(px,pz)&&allowed3(px,y+1,pz)){arrival={x:px,z:pz,y};break;}}if(!arrival)throw Error(opts.homeDoor?'The ground outside your door is blocked. Please try again once it finishes loading.':'Your camp arrival ground is blocked. Return to the map and choose another destination.');Object.assign(s.player,arrival,{mode:'walk',velocity:{x:0,y:0,z:0}});}craftRuntime=root.BurbzFlightCraft.attach(s,opts,{pose,style:styleFog,sample:craftSurface,
  message:text=>message(text,true),clear:(x,y,z)=>allowed3(x,y,z,false,true)&&localCoverage(x,z),
  parkingClear:(x,y,z)=>allowed3(x,y,z,false,true)&&localCoverage(x,z),walkable:allowed,
  local:point=>{const p=C().project(origin,point);return p&&{...p,y:p.y-datum};},
  geo:p=>C().unproject(origin,{...p,y:p.y+datum}),resetLift:()=>{lift=0;}});craftRuntime.initialize();
  opts.exploration?.reveal(pose());lastExplored={x:s.player.x,z:s.player.z};surface.ground.visible=false;corridors.forEach(c=>c.object.visible=false);s.world=world;return api;}catch(e){dispose();throw e;}
}
root.BurbzVillageWorld={attach};
})(globalThis);
