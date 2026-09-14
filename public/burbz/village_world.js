/* Extend the borrowed settlement scene. Its canvas, camera, lights, actors,
 * materials, controls and frame owner survive every outdoor boundary crossing.
 * MapLibre is a bounded, offscreen tile decoder, never a second visible view. */
(function(root){'use strict';
const K=()=>root.BurbzVillageWorldCore,C=()=>root.BurbzGeographicWorldCore;
const DEM='continuous-walk-dem',MAX_TILES=32,MAX_FEATURES=384;
const sleep=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function homeActions(s,opts,pose,covered){
 const button=document.createElement('button');button.type='button';button.className='cw-build-home';button.setAttribute('data-walk-action','home');button.textContent='Quest: Build your house';button.hidden=true;s.root.append(button);
 const dialog=document.createElement('dialog');dialog.className='cw-home-dialog';dialog.style.cssText='inset:0;margin:auto;max-width:min(360px,calc(100vw - 28px));max-height:85dvh;overflow:auto;padding:22px;border:1px solid #c9b27b;border-radius:12px;background:#20382c;color:#fff3d1';
 dialog.innerHTML='<h2>Build house here?</h2><p>A cosy cottage costs 25 timber. This exact place will become your permanent home in every view of Alderwing.</p><p class="cw-home-error" role="status"></p><button type="button" data-home-no>No, keep exploring</button> <button type="button" data-home-yes>Yes, build here · 25 timber</button>';s.root.append(dialog);
 for(const b of dialog.querySelectorAll('button'))b.style.cssText='min-height:44px;margin-top:10px;padding:8px';
 let chosen=null,closed=false;
 const error=dialog.querySelector('.cw-home-error'),yes=dialog.querySelector('[data-home-yes]');
 function suitable(){if(s.room||s.player.mode==='fly'||!covered(s.player.x,s.player.z))return false;const h=s.world.height(s.player.x,s.player.z);if(!Number.isFinite(h))return false;for(let x=-4;x<=4;x++)for(let z=-3;z<=4;z++){const px=s.player.x+x,pz=s.player.z+z,y=s.world.height(px,pz);if(!s.world.allowed(px,pz)||!Number.isFinite(y)||Math.abs(y-h)>1)return false;}return true;}
 function finish(){dialog.close();chosen=null;s.uiBusy=false;s.reset();if(!closed)s.root.querySelector('.vw-look')?.focus({preventScroll:true});}
 button.addEventListener('click',()=>{if(s.uiBusy||s.failed)return;const home=opts.getHome?.();if(!home||home.tier!==0)return;chosen={pose:pose(),revision:home.anchor?.revision,player:{x:s.player.x,z:s.player.z}};s.reset();s.uiBusy=true;error.textContent=suitable()?'':'Choose a clear, gently sloping patch with room for the house and its doorway.';yes.disabled=!!error.textContent;dialog.showModal();dialog.querySelector('[data-home-no]').focus();},{signal:s.abort.signal});
 dialog.querySelector('[data-home-no]').addEventListener('click',finish,{signal:s.abort.signal});dialog.addEventListener('cancel',e=>{e.preventDefault();finish();},{signal:s.abort.signal});
 yes.addEventListener('click',async()=>{if(!chosen||yes.disabled)return;if(!suitable()||Math.hypot(s.player.x-chosen.player.x,s.player.z-chosen.player.z)>.01){error.textContent='Your position changed. Close this question and choose the place again.';yes.disabled=true;return;}yes.disabled=true;try{const result=await opts.buildHome?.(chosen.pose,chosen.revision);if(!result?.ok){error.textContent=result?.error||'The house could not be saved. Nothing was spent.';yes.disabled=false;return;}finish();await opts.enterHome?.();}catch(e){error.textContent=e.message;yes.disabled=false;}},{signal:s.abort.signal});
 const welcome=document.createElement('aside');welcome.className='cw-welcome';welcome.hidden=true;welcome.style.cssText='position:absolute;left:14px;top:128px;z-index:6;max-width:min(320px,calc(100vw - 28px));max-height:40dvh;overflow:auto;background:#20382ceb;color:#fff3d1;padding:12px;border:1px solid #c9b27b;border-radius:10px;font-size:14px';welcome.innerHTML='<strong>Merlin</strong><p>Alderwing is an alternate Earth where birds are the dominant species. Take a look around — this world is yours to explore.</p><p>When you’re ready, turn back to the shelter and sit at the desk. I’ll show you how to manage things from Home.</p><button type="button" style="min-height:44px">Keep exploring</button>';s.root.append(welcome);let shown=false;
 welcome.querySelector('button').addEventListener('click',()=>welcome.hidden=true,{signal:s.abort.signal});
 return{update(){const home=opts.getHome?.();button.hidden=!opts.buildHome||!home||home.tier!==0||home.arrival!=='done'||!!s.room||s.player.mode==='fly'||s.uiBusy;if(!shown&&home?.arrival==='outside'&&!s.room){shown=true;welcome.hidden=false;}if(s.uiBusy||s.room)welcome.hidden=true;},dispose(){closed=true;if(dialog.open)dialog.close();button.remove();dialog.remove();welcome.remove();}};
}
async function attach(s,opts){
 const T=root.THREE,k=K(),scene=s.source.scene,origin={lat:opts.record.lat,lon:opts.record.lon,altitude:0},merc=k.mercator(origin);
 const surface=scene.userData.walkSurface,terrain=scene.userData.walkTerrain;
 if(!surface?.ground||!terrain?.heightAt||!C().validCoordinate(origin))throw Error('The settlement landscape is unavailable.');
 const initial=opts.initialPose&&C().project(origin,opts.initialPose);if(initial)Object.assign(s.player,{x:initial.x,z:initial.z,yaw:opts.initialPose.yaw||0,pitch:opts.initialPose.pitch||0,mode:opts.initialPose.mode==='fly'?'fly':'walk'});
 let baseWorld=s.world,datum=null,map=null,closed=false,loaded=false,idle=false,lastStream=-Infinity,lastSave=0,lastCentre=null;
 let lookup=[],waterways=[];const chunks=new Map(),tiles=new Map(),features=new Map(),pending=[],errors=[],sky=[];
 const metrics={created:0,retired:0,maxChunks:0,streamMs:[],transitions:0,loadingFrames:0,loadingMs:0,movingFrames:0,movingMs:0,distance:0};let zone='settlement';
 const initialSky=new Map();for(const object of scene.children)if(object.userData.sky){sky.push(object);initialSky.set(object,object.position.clone());}
 const originalFog=scene.fog?.clone(),originalContinuousFog=scene.userData.continuousFog;
 const skyDriver=opts.sky&&root.BurbzWorldSky?.attach(T,scene,{...opts.sky,palette:scene.userData.nightPalette,renderer:s.source.renderer});
 const groundMaterial=surface.ground.material.clone(),groundVisible=surface.ground.visible;
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
 #endif`);};material.customProgramCacheKey=function(){return key.call(this)+':continuous-horizon-v391';};material.needsUpdate=true;}
 scene.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])styleFog(m);});styleFog(groundMaterial);
 scene.userData.continuousFog=true;if(scene.fog){scene.fog.far=Math.min(104,scene.fog.far);scene.fog.near=Math.min(scene.fog.near,scene.fog.far*.5);}
 const corridors=surface.corridors||[],corridorVisibility=corridors.map(c=>c.object.visible);
 const waterMaterial=(corridors.find(c=>c.kind==='river')?.material||new T.MeshLambertMaterial({color:0x1e3852})).clone(),roadMaterial=(surface.roadMaterial||groundMaterial).clone();styleFog(waterMaterial);styleFog(roadMaterial);
 const rockMaterial=new T.MeshLambertMaterial({color:0x969a8d}),screeMaterial=new T.MeshLambertMaterial({color:0x92968a,vertexColors:true});styleFog(rockMaterial);styleFog(screeMaterial);
 const rockGeometry=new T.DodecahedronGeometry(1,0),waterTime={value:0};
 const cascadeMaterial=new T.MeshLambertMaterial({color:0x65b6bd,emissive:0x102b2e,side:T.DoubleSide,transparent:true,opacity:.9,depthWrite:false});
 cascadeMaterial.onBeforeCompile=shader=>{shader.uniforms.cascadeTime=waterTime;shader.vertexShader='varying vec2 cascadeUV;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\ncascadeUV=uv;');shader.fragmentShader='uniform float cascadeTime; varying vec2 cascadeUV;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 float threads=pow(.5+.5*sin(cascadeUV.x*79.+sin(cascadeUV.y*3.-cascadeTime*2.)),6.);
 float flow=pow(.5+.5*sin(cascadeUV.y*5.-cascadeTime*3.4+cascadeUV.x*9.),8.);
 diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.87,.96,.92),threads*.58+flow*.32);
 diffuseColor.a*=smoothstep(0.,.12,cascadeUV.x)*smoothstep(0.,.12,1.-cascadeUV.x);`);};
 cascadeMaterial.customProgramCacheKey=()=> 'alderwing-cascade-v408';styleFog(cascadeMaterial);
 const foamMaterial=new T.MeshLambertMaterial({color:0xdceee1,emissive:0x172d29,side:T.DoubleSide,transparent:true,opacity:.78,depthWrite:false});styleFog(foamMaterial);
 const shadowLights=[];for(const light of scene.children)if(light.isDirectionalLight&&light.castShadow){const camera=light.shadow.camera;shadowLights.push({light,position:light.position.clone(),target:light.target.position.clone(),camera:{left:camera.left,right:camera.right,top:camera.top,bottom:camera.bottom,near:camera.near,far:camera.far},centre:null});Object.assign(camera,{left:-160,right:160,top:160,bottom:-160,near:1,far:600});camera.updateProjectionMatrix();scene.add(light.target);}
 function shadows(){for(const row of shadowLights){const x=Math.round(s.player.x/32)*32,z=Math.round(s.player.z/32)*32;const epoch=skyDriver?.shadowEpoch();if(row.centre?.x===x&&row.centre?.z===z&&row.epoch===epoch)continue;row.epoch=epoch;row.centre={x,z};const direction=(skyDriver?new T.Vector3().copy(skyDriver.direction()):row.position.clone().sub(row.target)).normalize().multiplyScalar(230);row.light.target.position.set(x,0,z);row.light.position.copy(row.light.target.position).add(direction);row.light.target.updateMatrixWorld();s.source.renderer.shadowMap.needsUpdate=true;}}
 // Reuse the exact authored treeline geometry and its per-part palette.
 const prototypes={pines:[],leafs:[]};scene.traverse(object=>{for(const kind of ['pines','leafs'])if(!prototypes[kind].length&&object._burbzHarvestSets?.[kind]?.length){for(const mesh of object._burbzHarvestSets[kind]){const geometry=mesh.geometry.clone(),material=mesh.material.clone(),color=new T.Color();if(geometry.type==='CylinderGeometry'&&geometry.groups?.[0]){const side=geometry.groups[0];geometry.setDrawRange(side.start,side.count);}mesh.getColorAt?.(0,color);styleFog(material);prototypes[kind].push({geometry,material,color});}}});
 const anchor=opts.anchor||origin,shift=C().project(anchor,origin)||{x:0,z:0};
 const host=document.createElement('div');host.className='cw-tile-provider';host.setAttribute('aria-hidden','true');host.inert=true;
 host.style.cssText='position:absolute;left:-10000px;top:0;width:512px;height:512px;visibility:hidden;pointer-events:none';s.root.append(host);
 const note=document.createElement('div');note.className='vw-hint cw-status';note.setAttribute('role','status');note.style.pointerEvents='none';note.hidden=true;s.root.append(note);
 const credits=document.createElement('small');credits.className='cw-credits';credits.style.cssText='position:absolute;bottom:2px;right:6px;z-index:4;font:9px sans-serif;color:#e9dec5;background:#10231bbd;padding:2px 4px';credits.innerHTML='<a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener" style="color:inherit">© OpenStreetMap</a> · <a href="https://openfreemap.org" target="_blank" rel="noopener" style="color:inherit">OpenFreeMap</a> · <a href="data/geographic-terrain-credits.html" target="_blank" rel="noopener" style="color:inherit">Terrain</a>';s.root.append(credits);
 const actualRadius=surface.radius,maskCache=new Map(),places=new Map(),preparing=new Map();let placeCentre=null,lastPlaces=0,placeChain=Promise.resolve(),placeVersion=0;
 // The starting settlement needs the same retained-distance policy as every
 // destination. Otherwise turning toward it draws its fully fogged buildings
 // from hundreds of metres away, even after its ground has streamed out.
 const overviewHomes=scene.children.filter(o=>o.userData.overheadHome).map(o=>({object:o,visible:o.visible}));overviewHomes.forEach(row=>row.object.visible=false);
 const originalChildren=scene.children.slice(),originGroup=new T.Group();originGroup.name='Retained starting settlement';
 for(const child of originalChildren)if(!child.userData.sky&&!child.isLight&&!shadowLights.some(row=>row.light.target===child))originGroup.add(child);
 scene.add(originGroup);originGroup.updateMatrixWorld(true);
 const originBounds=new T.Box3().setFromObject(originGroup),originReach=Math.max(actualRadius,...[originBounds.min.x,originBounds.max.x].flatMap(x=>[originBounds.min.z,originBounds.max.z].map(z=>Math.hypot(x,z))));
 const animateOrigin=()=>Math.hypot(s.player.x,s.player.z)<originReach+(scene.fog?.far||104)+32;
 let originCull=root.BurbzVillageWalkScene.distanceCull(T,originGroup,s.source.movers);
 const raw=(x,z)=>k.elevation(lookup,merc,x,z);
 function joined(x,z){const d=Math.hypot(x,z);if(d<=actualRadius+64)return k.joinedHeight(x,z,{radius:actualRadius,authored:terrain.heightAt,raw,datum});const h=raw(x,z);if(h===null||datum===null)return null;for(const p of places.values()){const distance=Math.hypot(x-p.x,z-p.z),blend=p.content.blendRadius||p.content.radius+12;if(distance<blend){const t=k.smooth((distance-p.content.radius)/(blend-p.content.radius));return (p.base+(p.content.terrain?.heightAt(x-p.x,z-p.z)||0))*(1-t)+(h-datum)*t;}}return h-datum;}
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
    const content=row.record.kind==='home'?opts.createYard?.(T,home):row.record.kind==='wayside'?await opts.createWayside?.(T,row.record,{signal:pendingPlace.abort.signal,palette:opts.waysidePalette?.(scene.userData.nightPalette)}):await opts.createSettlement?.(T,row.record,{signal:pendingPlace.abort.signal});
    if(!content)return;if(closed||pendingPlace.abort.signal.aborted){content.dispose();return;}
    const radius=content.radius||root.BurbzPlayerHomeCore?.YARD?.ground||28;content.radius=radius;content.blendRadius=content.blendRadius||radius+16;content.group.userData.continuousTerrain=true;content.group.traverse(o=>{for(const m of Array.isArray(o.material)?o.material:[o.material])styleFog(m);});
    const p={...row.p,record:row.record,content,base:row.record.kind==='home'?(joined(row.p.x,row.p.z)??value-datum):value-datum};content.group.position.set(p.x,p.base,p.z);scene.add(content.group);const cull=root.BurbzVillageWalkScene.distanceCull(T,content.group,content.movers);p.cull=cull;const disposeContent=content.dispose;content.dispose=()=>{p.cull.dispose();disposeContent();};places.set(row.record.id,p);placeVersion++;
    // Prepared outside the visible horizon. Rebuild only its future ground so
    // no existing tree can remain inside the real village's buildings.
    for(const chunk of [...chunks.values()])if(distanceToBounds({x0:chunk.x,x1:chunk.x+k.CHUNK,z0:chunk.z,z1:chunk.z+k.CHUNK},p)<content.blendRadius+k.STEP)retire(chunk);
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
 const geo=(x,z)=>C().unproject(origin,{x,y:0,z});
 function message(text){if(note.textContent!==text)note.textContent=text;note.hidden=!text;}
 function masks(kind,x,z){const p=geo(x,z);if(!p)return false;for(const entry of features.values()){if(entry.kind!==kind||x<entry.bounds.x0||x>entry.bounds.x1||z<entry.bounds.z0||z>entry.bounds.z1)continue;let mask=maskCache.get(entry.id);if(!mask){mask=root.BurbzGeographicForestCore.compileMask(entry.geometry,origin.lon);maskCache.set(entry.id,mask);}if(mask([p.lon,p.lat]))return true;}return false;}
 function readFeatures(){if(closed||!loaded)return;const sources=[...new Set((map.getStyle()?.layers||[]).filter(l=>['landcover','landuse','water','waterway','transportation'].includes(l['source-layer'])).map(l=>l.source))];
  for(const source of sources)for(const sourceLayer of ['landcover','landuse','water','waterway','transportation']){let rows=[];try{rows=map.querySourceFeatures(source,{sourceLayer});}catch(_){}
   for(const f of rows.slice(0,256)){const geometry=f.geometry;if(!geometry)continue;const kind=sourceLayer==='waterway'?'stream':sourceLayer==='water'?'water':root.BurbzGeographicForestCore.isWoodlandFeature({geometry,properties:f.properties,sourceLayer})?'wood':sourceLayer==='transportation'?'road':null;if(!kind)continue;
    const text=JSON.stringify(geometry);if(text.length>120000)continue;const id=sourceLayer+':'+String(f.id)+':'+text;if(features.has(id))continue;
    const points=[];(function scan(v){if(!Array.isArray(v))return;if(typeof v[0]==='number'){if(Number.isFinite(v[0])&&Number.isFinite(v[1]))points.push(v);}else for(const p of v)scan(p);})(geometry.coordinates);if(points.length<2||points.length>8000)continue;
    const local=points.map(p=>C().project(origin,{lon:p[0],lat:p[1]})).filter(Boolean);if(!local.length)continue;const bounds={x0:Math.min(...local.map(p=>p.x)),x1:Math.max(...local.map(p=>p.x)),z0:Math.min(...local.map(p=>p.z)),z1:Math.max(...local.map(p=>p.z))};
    const lines=kind==='road'||kind==='stream'?(geometry.type==='LineString'?[geometry.coordinates]:geometry.type==='MultiLineString'?geometry.coordinates:[]).map(line=>line.map(p=>C().project(origin,{lon:p[0],lat:p[1]}))):[];
    features.set(id,{id,kind,geometry,bounds,local,lines,river:f.properties?.class==='river'});
   }
  }
  waterways=[];
  const streams=[...features.values()].filter(e=>e.kind==='stream').sort((a,b)=>distanceToBounds(a.bounds,s.player)-distanceToBounds(b.bounds,s.player));
  for(const entry of streams)for(const line of entry.lines)for(let i=1;i<line.length&&waterways.length<64;i++){
   const a=line[i-1],b=line[i];if(!a||!b)continue;const length=Math.hypot(b.x-a.x,b.z-a.z);if(length<3)continue;
   const x=(a.x+b.x)/2,z=(a.z+b.z)/2;if(corridors.some(c=>c.kind==='river'&&k.corridorContains(c,x,z,4)))continue;
   waterways.push({x,z,ux:(b.x-a.x)/length,uz:(b.z-a.z)/length,width:entry.river?5:2.2,start:length/2-.5,end:length/2,kind:'river',material:waterMaterial});
  }
  // Retain decoded source coverage through tile turnover. Never delete a
  // visible tree because a source tile disappears from querySourceFeatures.
  if(features.size>MAX_FEATURES){const p=s.player,rows=[...features.values()].sort((a,b)=>distanceToBounds(b.bounds,p)-distanceToBounds(a.bounds,p));for(const row of rows){if(features.size<=MAX_FEATURES)break;features.delete(row.id);maskCache.delete(row.id);}}
 }
 function distanceToBounds(b,p){return Math.hypot(Math.max(b.x0-p.x,0,p.x-b.x1),Math.max(b.z0-p.z,0,p.z-b.z1));}
 function road(x,z,pad=0){if(corridors.some(c=>c.kind==='road'&&k.corridorContains(c,x,z,.35+pad)))return true;for(const entry of features.values()){if(entry.kind!=='road'||x<entry.bounds.x0-2-pad||x>entry.bounds.x1+2+pad||z<entry.bounds.z0-2-pad||z>entry.bounds.z1+2+pad)continue;for(const line of entry.lines)for(let i=1;i<line.length;i++)if(root.BurbzVillageWalkCore.distance2(x,z,line[i-1],line[i])<(1.5+pad)**2)return true;}return false;}
 function river(x,z,pad=0){return [...corridors,...waterways].some(c=>c.kind==='river'&&k.corridorContains(c,x,z,.27+pad));}
 function height(x,z){const chunk=chunks.get(k.key(x,z));if(!chunk)return null;const y=k.meshHeight(chunk,chunk.data,x,z);const place=inPlace(x,z);if(place?.content.terrain){const lx=x-place.x,lz=z-place.z,local=place.content.world.height(lx,lz);if(local>place.content.terrain.heightAt(lx,lz)+.08)return Math.max(y,place.base+local);}if(Math.hypot(x,z)<actualRadius&&baseWorld.height(x,z)>terrain.heightAt(x,z)+.08)return Math.max(y,baseWorld.height(x,z));return y;}
 function visibleCoverage(x,z){for(const p of preparing.values())if(Math.hypot(x-p.x,z-p.z)<p.radius+(scene.fog?.far||104)+20)return false;const reach=(scene.fog?.far||104)+10;for(const cell of k.chunks(x,z,Math.ceil(reach/k.CHUNK)+1)){const b={x0:cell.x,x1:cell.x+k.CHUNK,z0:cell.z,z1:cell.z+k.CHUNK};if(distanceToBounds(b,{x,z})<reach&&!chunks.has(cell.id))return false;}return true;}
 function rockBlocked(x,y,z){for(let ix=Math.floor((x-5)/k.CHUNK);ix<=Math.floor((x+5)/k.CHUNK);ix++)for(let iz=Math.floor((z-5)/k.CHUNK);iz<=Math.floor((z+5)/k.CHUNK);iz++)for(const r of chunks.get(ix+','+iz)?.rocks||[])if(k.rockContains(r,x,y,z))return true;return false;}
 function allowed(x,z){if(!Number.isFinite(x+z)||height(x,z)===null)return false;if(!baseWorld.allowedBeyond(x,z))return false;const place=inPlace(x,z);if(place?.content.world?.allowed&&!place.content.world.allowed(x-place.x,z-place.z))return false;if(Math.hypot(x,z)>actualRadius){if(rockBlocked(x,null,z))return false;if(!place&&(river(x,z)||masks('water',x,z)))return false;const ids=new Set();for(const dx of [-.8,.8])for(const dz of [-.8,.8])ids.add(k.key(x+dx,z+dz));for(const id of ids)for(const t of chunks.get(id)?.trees||[])if(Math.hypot(t.x-x,t.z-z)<.27+.24*t.size)return false;}return true;}
 const solidBoxes=s.source.buildings.filter(b=>!b.userData.townGround).map(b=>new T.Box3().setFromObject(b));
 function allowed3(x,y,z,requireCoverage=true){const h=height(x,z);if(h===null||(requireCoverage&&!visibleCoverage(x,z)))return false;for(const b of solidBoxes)if(x>b.min.x-.28&&x<b.max.x+.28&&z>b.min.z-.28&&z<b.max.z+.28&&y<b.max.y+.3&&y>b.min.y-.3)return false;
  if(Math.hypot(x,z)<actualRadius&&y<h+4&&!baseWorld.allowedBeyond(x,z))return false;
  const ids=new Set();for(const dx of [-3,3])for(const dz of [-3,3])ids.add(k.key(x+dx,z+dz));for(const id of ids)for(const t of chunks.get(id)?.trees||[]){if(y<t.y-.3||y>t.y+3.7*t.size)continue;const r=y<t.y+1.2*t.size?.3*t.size:1.12*t.size;if(Math.hypot(x-t.x,z-t.z)<r+.25)return false;}
  if(rockBlocked(x,y,z))return false;
  for(let ix=Math.floor((x-7)/k.CHUNK);ix<=Math.floor((x+7)/k.CHUNK);ix++)for(let iz=Math.floor((z-7)/k.CHUNK);iz<=Math.floor((z+7)/k.CHUNK);iz++)for(const cascade of chunks.get(ix+','+iz)?.cascades||[]){const steps=[0,3,7,10].map(i=>cascade.points[i]);for(let i=1;i<steps.length;i++)if(y<steps[i-1].y+.3&&y>h-.3&&root.BurbzVillageWalkCore.distance2(x,z,steps[i-1],steps[i])<(cascade.width*.6+.3)**2)return false;}

  for(const p of places.values())for(const b of p.content.solids||[])if(Math.abs(x-p.x-b.x)<b.w/2+.28&&Math.abs(z-p.z-b.z)<b.d/2+.28&&y>p.base+b.minY-.3&&y<p.base+b.maxY+.3)return false;return true;
 }
 const world={radius:Infinity,combatAllowed3:(x,y,z)=>allowed3(x,y,z,false),allowed3,maxAGL:400,authoredRadius:baseWorld.radius,height,allowed,allowedBeyond:allowed,spawn:p=>baseWorld.spawn(p),surface:(x,z)=>Math.hypot(x,z)<actualRadius?baseWorld.surface(x,z):road(x,z)?'stone':'ground',get polygons(){return baseWorld.polygons;},get segments(){return baseWorld.segments;}};
 function retire(chunk){chunk.group.removeFromParent();for(const mesh of chunk.group.children){if(!mesh.isInstancedMesh)mesh.geometry.dispose();mesh.dispose?.();}chunks.delete(chunk.id);metrics.retired++;}
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
 function makeChunk(cell){const data=k.groundMesh(cell,joined,actualRadius);if(!data)return false;
  const group=new T.Group();group.position.set(cell.x,0,cell.z);group.userData.continuousTerrain=true;
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));const shades=[];for(let i=0;i<data.positions.length;i+=3){const x=cell.x+data.positions[i],z=cell.z+data.positions[i+2],patch=k.habitat(x,z,shift),grain=k.hash(Math.floor((x+shift.x)/5),Math.floor((z+shift.z)/5),853),v=.68+patch*.33+grain*.13;shades.push(v*(.95+patch*.13),v,v*(.91+grain*.09));}geometry.setAttribute('color',new T.Float32BufferAttribute(shades,3));const faces=[[],[],[],[]];for(let i=0;i<data.indices.length;i+=3){const a=data.indices[i]*3,b=data.indices[i+1]*3,c=data.indices[i+2]*3,x=cell.x+(data.positions[a]+data.positions[b]+data.positions[c])/3,z=cell.z+(data.positions[a+2]+data.positions[b+2]+data.positions[c+2])/3,exterior=Math.hypot(x,z)>actualRadius&&!inPlace(x,z),dx1=data.positions[b]-data.positions[a],dz1=data.positions[b+2]-data.positions[a+2],dy1=data.positions[b+1]-data.positions[a+1],dx2=data.positions[c]-data.positions[a],dz2=data.positions[c+2]-data.positions[a+2],dy2=data.positions[c+1]-data.positions[a+1],slope=Math.hypot(dy1*dz2-dz1*dy2,dx1*dy2-dy1*dx2)/Math.max(.01,Math.abs(dx1*dz2-dz1*dx2)),material=exterior&&masks('water',x,z)?1:exterior&&road(x,z)?2:exterior&&(slope>.62||slope>.22&&k.habitat(x,z,shift)>.58)?3:0;faces[material].push(...data.indices.slice(i,i+3));}geometry.setIndex(faces.flat());let offset=0;faces.forEach((indices,i)=>{geometry.addGroup(offset,indices.length,i);offset+=indices.length;});geometry.computeVertexNormals();geometry.computeBoundingSphere();const ground=new T.Mesh(geometry,[groundMaterial,waterMaterial,roadMaterial,screeMaterial]);ground.receiveShadow=true;group.add(ground);
  const sample=(x,z)=>sceneryHeight(cell,data,x,z);
  const chunk={...cell,data,group,ground,trees:[],rocks:k.rocks(cell,shift,sample,(x,z,pad)=>sceneryExcluded(x,z,pad)||river(x,z,pad)||masks('water',x,z)||[-1,0,1].some(dx=>[-1,0,1].some(dz=>masks('water',x+dx*pad,z+dz*pad)))),cascades:[]};
  for(const row of k.cascades(cell,[...corridors,...waterways],sample,sceneryExcluded)){const meshes=cascadeMesh(row,cell,sample);if(meshes){group.add(...meshes);chunk.cascades.push(row);chunk.rocks.push(...row.bankRocks);}}
  for(const row of k.trees(cell,shift)){const d=Math.hypot(row.x,row.z);if(d<actualRadius+.4||inPlace(row.x,row.z)||!baseWorld.allowedBeyond(row.x,row.z)||road(row.x,row.z)||river(row.x,row.z)||masks('water',row.x,row.z))continue;
   // First-person nature is the same authored game woodland as the village,
   // at the same fixed density. Real DEM, water and roads retain their authority;
   // these illustrative trees do not claim to be surveyed real-world vegetation.
   row.y=k.treeGround(row.x,row.z,row.size,sample);if(row.y===null)continue;
   const patch=k.habitat(row.x,row.z,shift);if(patch>.56&&row.tone<(patch-.56)*2.1)continue;
   if(chunk.rocks.some(r=>Math.hypot(row.x-r.x,row.z-r.z)<Math.max(r.w,r.d)+1.1*row.size))continue;
   row.kind=patch<.4?'leafs':patch>.62?'pines':row.kind;chunk.trees.push(row);
  }
  const dummy=new T.Object3D();for(const kind of ['pines','leafs']){const rows=chunk.trees.filter(t=>t.kind===kind);if(!rows.length)continue;for(const part of prototypes[kind]){const mesh=new T.InstancedMesh(part.geometry,part.material,rows.length);for(let i=0;i<rows.length;i++){const row=rows[i];dummy.position.set(row.x-cell.x,row.y-.06,row.z-cell.z);dummy.rotation.set(0,row.angle,0);dummy.scale.setScalar(row.size);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,part.color.clone().offsetHSL((row.tone-.5)*.03,0,(row.tone-.5)*.05));}mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere?.();mesh.frustumCulled=!!mesh.boundingSphere;mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}}
  const fieldRocks=chunk.rocks.filter(r=>!r.bank);if(fieldRocks.length){const mesh=new T.InstancedMesh(rockGeometry,rockMaterial,fieldRocks.length);fieldRocks.forEach((row,i)=>{dummy.position.set(row.x-cell.x,row.y,row.z-cell.z);dummy.rotation.set(.12,row.angle,.08);dummy.scale.set(row.w,row.h,row.d);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);mesh.setColorAt(i,new T.Color().setHSL(.13+row.tone*.07,.07+row.tone*.1,.65+row.tone*.22));});mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;mesh.computeBoundingSphere();mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);}
  for(const corridor of [...corridors,...waterways])for(const bank of corridor.bankMaterial?[false,true]:[false]){const data=k.ribbonMesh(cell,corridor,(x,z)=>k.meshHeight(cell,chunk.data,x,z),bank);if(!data?.indices.length)continue;const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));geo.setIndex(data.indices);geo.computeVertexNormals();const ribbon=new T.Mesh(geo,bank?corridor.bankMaterial:corridor.material);ribbon.receiveShadow=true;group.add(ribbon);}
  scene.add(group);chunks.set(cell.id,chunk);metrics.created++;metrics.maxChunks=Math.max(metrics.maxChunks,chunks.size);return true;
 }
 function queue(){const wanted=k.chunks(s.player.x,s.player.z),ids=new Set(wanted.map(c=>c.id));pending.length=0;for(const c of wanted)if(!chunks.has(c.id))pending.push(c);for(const c of chunks.values())if(!ids.has(c.id))retire(c);}
 function stream(budget=4){const start=performance.now();let built=0;while(pending.length&&built<2&&performance.now()-start<budget){const c=pending[0];if(!makeChunk(c))break;pending.shift();built++;}metrics.streamMs.push(performance.now()-start);if(metrics.streamMs.length>240)metrics.streamMs.shift();}
 async function createMap(){await opts.loadMap?.();if(closed||s.closed)return;map=new root.maplibregl.Map({container:host,style:opts.style,center:[opts.initialPose?.lon??origin.lon,opts.initialPose?.lat??origin.lat],zoom:14,pitch:0,bearing:0,interactive:false,attributionControl:false,maxTileCacheSize:48,pixelRatio:1,canvasContextAttributes:{antialias:false}});
  map.on('load',()=>{if(closed)return;map.addSource(DEM,root.BurbzGeographicMap3D.DEM);map.setTerrain({source:DEM,exaggeration:1});loaded=true;});
  map.on('sourcedata',e=>{if(closed)return;idle=false;if(e.sourceId===DEM&&e.tile?.dem&&e.coord?.canonical){const c=e.coord.canonical,id=c.z+'/'+c.x+'/'+c.y;if(!tiles.has(id))tiles.set(id,{...c,dem:e.tile.dem});if(tiles.size>MAX_TILES)tiles.delete(tiles.keys().next().value);lookup=[...tiles.values()].sort((a,b)=>b.z-a.z);}});
  map.on('idle',()=>{idle=true;readFeatures();});map.on('error',e=>{errors.push(String(e.error?.message||'Map data unavailable'));if(errors.length>6)errors.shift();});
  const until=performance.now()+25000;while(!closed&&!s.closed&&performance.now()<until){if(loaded&&idle&&raw(0,0)!==null){datum=raw(0,0);refreshPlaces();queue();while(pending.length&&!closed&&!s.closed){const before=pending.length;stream(8);if(before===pending.length)break;await sleep();}if(!pending.length&&visibleCoverage(s.player.x,s.player.z))return;}await sleep();}
  if(!closed&&!s.closed)throw Error('Nearby terrain could not load. Return to the settlement and retry online.');
 }
 function pose(){return datum===null?null:{...C().unproject(origin,{x:s.player.x,y:s.player.y+datum,z:s.player.z}),yaw:s.player.yaw,pitch:s.player.pitch,mode:s.player.mode==='fly'?'fly':'walk'};}
 async function save(){if(closed||s.room||datum===null)return true;try{if(await opts.savePose?.(pose())===false)throw Error("save");return true;}catch(_){message('Your position could not be saved. Please try again before leaving.');return false;}}
 function syncControls(){wing.hidden=!!s.room||s.uiBusy;rise.hidden=descend.hidden=wing.hidden||s.player.mode!=='fly';if(s.room)visit.hidden=true;}
 function update(time){homeUI.update();syncControls();if(closed||s.room)return;skyDriver?.update(time);waterTime.value=matchMedia('(prefers-reduced-motion: reduce)').matches?0:time;shadows();for(const object of sky){const p=initialSky.get(object);object.position.set(p.x+s.player.x,p.y+s.player.y,p.z+s.player.z);}
  const next=safeAt(s.player.x,s.player.z)?'settlement':'wilderness';if(next!==zone){zone=next;metrics.transitions++;}s.root.dataset.walkZone=zone;
  if(time-lastPlaces>.75){lastPlaces=time;refreshPlaces();selectDiscoveries();visitTarget=inPlace(s.player.x,s.player.z)||null;visit.hidden=!visitTarget||visitTarget.record.kind==='wayside'||s.uiBusy||s.player.mode==='fly';visit.textContent=visitTarget?(visitTarget.record.kind==='home'?'Enter '+visitTarget.record.name:(visitTarget.record.owned?'Manage ':'Visit ')+visitTarget.record.name):'';}
  if(time-lastStream>.18){lastStream=time;queue();stream();const p=geo(s.player.x,s.player.z);if(p&&(!lastCentre||C().distance(p,lastCentre)>180)){lastCentre=p;map.jumpTo({center:[p.lon,p.lat],zoom:14,pitch:0});}}
  else stream();
  // Opaque fog already hides this distance. Cull whole retained chunks beyond
  // it, keeping every tree and its density intact when the camera turns back.
  for(const chunk of chunks.values())chunk.group.visible=distanceToBounds({x0:chunk.x,x1:chunk.x+k.CHUNK,z0:chunk.z,z1:chunk.z+k.CHUNK},s.player)<(scene.fog?.far||104)+7;
  // Keep distant prepared settlements cached but outside the render graph.
  // Visibility alone still makes Three traverse their entire matrix trees.
  // Reattach beyond the opaque fog margin, before any geometry is visible.
  originCull.update(time,s.player,scene.fog?.far||104);
  if(animateOrigin()){if(originGroup.parent!==scene){scene.add(originGroup);originGroup.updateMatrixWorld(true);}}else originGroup.removeFromParent();
  for(const p of places.values()){
    const near=Math.hypot(p.x-s.player.x,p.z-s.player.z)<p.content.radius+(scene.fog?.far||104)+32,group=p.content.group;
    if(near){if(group.parent!==scene){scene.add(group);group.updateMatrixWorld(true);}group.visible=true;p.content.update?.(time);p.cull?.update(time,s.player,scene.fog?.far||104);}
    else if(group.parent===scene)group.removeFromParent();
  }
  if(!visibleCoverage(s.player.x,s.player.z))message('Loading the countryside ahead…');else if(!note.textContent.includes('saved'))message('');
  if(time-lastSave>8){lastSave=time;save();}
 }
 function move(input,dt){const before={...s.player},moving=Math.hypot(input.side||0,input.forward||0)>.01,ms=Math.min(.05,Math.max(0,dt||0))*1000;if(moving){metrics.movingFrames++;metrics.movingMs+=ms;}if(!visibleCoverage(s.player.x,s.player.z)){if(moving){metrics.loadingFrames++;metrics.loadingMs+=Math.max(0,dt||0)*1000;}return;}if(s.player.mode==='fly')C().step(s.player,{...input,lift:(input.lift||0)+lift},dt,world,'fly');else root.BurbzVillageWalkCore.move(s.player,input,dt,world);if(!visibleCoverage(s.player.x,s.player.z)){Object.assign(s.player,before);if(moving){metrics.loadingFrames++;metrics.loadingMs+=Math.max(0,dt||0)*1000;}message('Loading the countryside ahead…');}metrics.distance+=Math.hypot(s.player.x-before.x,s.player.z-before.z);}
 function dispose(){if(closed)return;save();closed=true;skyDriver?.dispose();homeUI.dispose();originCull.dispose();for(const child of [...originGroup.children])scene.add(child);originGroup.removeFromParent();overviewHomes.forEach(row=>row.object.visible=row.visible);map?.remove();map=null;for(const c of [...chunks.values()])retire(c);for(const parts of Object.values(prototypes))for(const part of parts){part.geometry.dispose();part.material.dispose();}groundMaterial.dispose();waterMaterial.dispose();roadMaterial.dispose();rockMaterial.dispose();screeMaterial.dispose();rockGeometry.dispose();cascadeMaterial.dispose();foamMaterial.dispose();if(originalContinuousFog===undefined)delete scene.userData.continuousFog;else scene.userData.continuousFog=originalContinuousFog;surface.ground.visible=groundVisible;corridors.forEach((c,i)=>c.object.visible=corridorVisibility[i]);if(originalFog){scene.fog.near=originalFog.near;scene.fog.far=originalFog.far;scene.fog.color.copy(originalFog.color);}for(const row of shadowLights){row.light.position.copy(row.position);row.light.target.position.copy(row.target);Object.assign(row.light.shadow.camera,row.camera);row.light.shadow.camera.updateProjectionMatrix();scene.remove(row.light.target);}s.source.renderer.shadowMap.needsUpdate=true;for(const object of sky)object.position.copy(initialSky.get(object));for(const p of preparing.values())p.abort.abort();preparing.clear();for(const p of places.values())p.content.dispose();places.clear();host.remove();note.remove();credits.remove();visit.remove();wing.remove();rise.remove();descend.remove();for(const [material,old] of fogMaterials){material.onBeforeCompile=old.previous;material.customProgramCacheKey=old.key;material.needsUpdate=true;}fogMaterials.clear();tiles.clear();features.clear();maskCache.clear();pending.length=0;delete s.root.dataset.walkZone;}
 let lift=0,eyeShift=0;const motion={};
 const wing=document.createElement('button'),rise=document.createElement('button'),descend=document.createElement('button');wing.type=rise.type=descend.type='button';wing.textContent='Spread wings';wing.className='cw-wings';wing.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:38px;z-index:6;min-height:44px;background:#203b2b;color:#fff3d1;border:1px solid #c9b27b;border-radius:8px;padding:10px';s.root.append(wing);
 for(const [button,label,value,bottom] of [[rise,'Climb',1,156],[descend,'Descend',-1,104]]){button.textContent=label;button.setAttribute('aria-label',label);button.hidden=true;button.style.cssText='position:absolute;left:50%;transform:translateX(-50%);bottom:'+bottom+'px;z-index:6;min-width:84px;min-height:44px;background:#203b2b;color:#fff3d1;border:1px solid #c9b27b;border-radius:8px';s.root.append(button);button.addEventListener('pointerdown',e=>{if(s.uiBusy)return;e.preventDefault();button.setPointerCapture(e.pointerId);lift=value;},{signal:s.abort.signal});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,()=>lift=0,{signal:s.abort.signal});}
 function toggleFlight(mode){if(s.room||s.uiBusy)return false;const fly=mode?mode==='fly':s.player.mode!=='fly',before=s.player.y,result=fly?C().takeoff(s.player,world):C().land(s.player,world);if(!result.ok){message(result.reason==='too-high'?'Descend close to clear ground before landing.':'Move to clear ground before spreading your wings.');return false;}eyeShift+=before-s.player.y;lift=0;wing.textContent=fly?'Land here':'Spread wings';rise.hidden=descend.hidden=!fly;s.root.querySelector('.vw-title small').textContent=fly?'BIRD FLIGHT':'ON FOOT';return true;}
 wing.addEventListener('click',()=>toggleFlight(),{signal:s.abort.signal});
 const homeUI=homeActions(s,opts,pose,visibleCoverage);
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
 const api={world,buildingFrame,people(target){const p=[...places.values()].find(p=>target.scope==='wayside'?p.record.id===target.placeId:(p.content.buildings||[]).some(b=>Number(b.userData.wardSeed)===Number(target.seed)));return p?.content.people?p.content.people(target):s.source.people?s.source.people(target):s.options.interiors?.people?.(target)||[];},buildings:()=>[...s.source.buildings,...[...places.values()].flatMap(p=>p.content.buildings||[])],get placeVersion(){return placeVersion;},navigation:()=>({origin,pose:pose(),player:s.player,polygons:world.polygons,corridors,features:[...features.values()],places:[{record:opts.record,x:0,z:0,radius:actualRadius},...places.values()].map(p=>({name:p.record.name,x:p.x,z:p.z,radius:p.radius||p.content.radius}))}),update,animateOrigin,move,save,dispose,safeAt,syncControls,toggleFlight,reset(){lift=0;C().reset(s.player);},camera(dt){eyeShift*=Math.exp(-Math.min(.08,dt)*8);const m=s.player.mode==='fly'?root.BurbzAcademyFlightCore.cameraMotion(motion,s.player,dt,matchMedia('(prefers-reduced-motion: reduce)').matches):{bob:0,pitch:0,roll:0};return{...m,bob:m.bob+eyeShift};},replaceBase(next){baseWorld=next;return world;},diagnostics(full=false){return{sky:skyDriver?.diagnostics(),origin,datum,zone,authoredRadius:actualRadius,originReach,pose:pose(),chunks:chunks.size,chunkIds:[...chunks.values()].map(c=>({id:c.id,uuid:c.group.uuid})),pending:pending.length,preparingPlaces:[...preparing.values()].map(p=>({id:p.record.id,failed:!!p.failed})),rocks:[...chunks.values()].reduce((n,c)=>n+c.rocks.length,0),cascades:[...chunks.values()].flatMap(c=>c.cascades.map(r=>({id:r.id,x:r.x,z:r.z,drop:r.drop,top:r.points[0],foot:r.points[r.points.length-1]}))),treeSamples:full?[...chunks.values()].flatMap(c=>c.trees.map(t=>({x:t.x,y:t.y,z:t.z,size:t.size}))):undefined,trees:[...chunks.values()].reduce((n,c)=>n+c.trees.length,0),treeIds:full?[...chunks.values()].flatMap(c=>c.trees.map(t=>t.id)):undefined,tileCount:tiles.size,featureCount:features.size,visibleCoverage:visibleCoverage(s.player.x,s.player.z),errors:errors.slice(),metrics:{...metrics},places:[...places.values()].map(p=>({id:p.record.id,kind:p.record.kind,name:p.record.name,x:p.x,z:p.z,radius:p.content.radius,buildings:p.content.buildings?.filter(b=>b.userData.buildingId).map(b=>({id:b.userData.buildingId,seed:b.userData.wardSeed,x:b.position.x,z:b.position.z,construction:!!b.userData.construction,level:b.userData.modelLevel}))})),corridors:corridors.map(c=>({kind:c.kind,x:c.x,z:c.z,ux:c.ux,uz:c.uz,width:c.width,start:c.start,end:c.end})),record:opts.record};}};
 s.continuity=api;s.abort.signal.addEventListener('abort',dispose,{once:true});
 try{await createMap();if(closed||s.closed){dispose();return null;}if(initial){const y=height(s.player.x,s.player.z);if(y===null)throw Error('Your saved place has not loaded. Please try again.');s.player.y=s.player.mode==='fly'?Math.max(y+1,(opts.initialPose.altitude||0)-datum):y;}surface.ground.visible=false;corridors.forEach(c=>c.object.visible=false);s.world=world;return api;}catch(e){dispose();throw e;}
}
root.BurbzVillageWorld={attach};
})(globalThis);
