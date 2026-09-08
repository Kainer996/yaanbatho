/* Local-clock moonlight and bounded decorative trail torches. MapLibre owns geography. */
(function(root){'use strict';
 const controllers=new WeakMap(),ID='burbz-trail-torches',GLOW='burbz-trail-glow',DEM='burbz-geographic-dem';
 const VS=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 position;layout(location=1) in vec3 color;layout(location=2) in vec3 effect;
 uniform mat4 matrix;uniform float night;uniform float time;out vec3 tint;out vec3 fx;
 void main(){vec3 p=position;fx=effect;tint=color;
 if(effect.x==1.){float wave=sin(time*5.7+position.x*.31+position.y*.17);p.x+=effect.y*wave*.16;p.z+=effect.y*sin(time*7.+position.y)*.15;}
 if(effect.x==0.)tint=mix(color*vec3(.44,.55,.76),color,1.-night);
 gl_Position=matrix*vec4(p,1.);}`;
 const FS=`#version 300 es
 precision highp float;in vec3 tint;in vec3 fx;uniform float night;uniform float time;out vec4 outputColor;
 void main(){float alpha=1.;if(fx.x==2.){float r=length(fx.yz);if(r>=1.)discard;alpha=pow(1.-r,2.)*.62*night;outputColor=vec4(tint*alpha,alpha);return;}
 if(fx.x==1.){alpha=night;outputColor=vec4(tint*(1.05+.10*sin(time*6.+fx.z))*alpha,alpha);return;}
 outputColor=vec4(tint,1.);}`;
 function torchGeometry(records,geo,map,origin,scale){
  const solid=[],flames=[];
  const vertex=(out,p,c,e)=>out.push(...p,...c,...e),tri=(out,a,b,c,t,e)=>[a,b,c].forEach(p=>vertex(out,p,t,e));
  for(const r of records){const m=geo.mercator(r.lon,r.lat);m[0]+=Math.round(origin[0]-m[0]);const x=(m[0]-origin[0])/scale,y=-(m[1]-origin[1])/scale,z=r.elevation+.15;
   const pole=[.24,.18,.13],metal=[.48,.35,.17];
   function ring(out,z0,z1,r0,r1,color,type){for(let k=0;k<6;k++){const a=k*Math.PI/3,b=(k+1)*Math.PI/3,p=[x+Math.cos(a)*r0,y+Math.sin(a)*r0,z+z0],q=[x+Math.cos(b)*r0,y+Math.sin(b)*r0,z+z0],u=[x+Math.cos(b)*r1,y+Math.sin(b)*r1,z+z1],v=[x+Math.cos(a)*r1,y+Math.sin(a)*r1,z+z1];const c=color.map(n=>n*(.82+(k%3)*.09));tri(out,p,q,u,c,[type,type===1?z1/6:0,r.seed%71]);tri(out,p,u,v,c,[type,type===1?z1/6:0,r.seed%71]);}}
   ring(solid,0,.5,.65,.42,metal,0);ring(solid,.35,4.7,.22,.17,pole,0);ring(solid,4.3,4.85,.43,.82,metal,0);ring(solid,4.85,5,.84,.84,[.30,.24,.17],0);
   ring(flames,4.85,6.65,.70,0,[1,.26,.025],1);ring(flames,4.87,6.15,.48,0,[1,.61,.08],1);ring(flames,4.9,5.75,.27,0,[1,.94,.52],1);

  }
  return {solid:new Float32Array(solid),flames:new Float32Array(flames)};
 }
 function makeLayer(map,state,visible){return {id:ID,type:'custom',renderingMode:'3d',
  onAdd(map,gl){this.gl=gl;const priorVAO=gl.getParameter(gl.VERTEX_ARRAY_BINDING),priorBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);let vs,fs;const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;};
   try{vs=shader(gl.VERTEX_SHADER,VS);fs=shader(gl.FRAGMENT_SHADER,FS);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
    for(const name of ['matrix','night','time'])this[name]=gl.getUniformLocation(this.program,name);this.meshes={};for(const name of ['solid','flames']){const vao=gl.createVertexArray(),buffer=gl.createBuffer();gl.bindVertexArray(vao);gl.bindBuffer(gl.ARRAY_BUFFER,buffer);for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12);}this.meshes[name]={vao,buffer,count:0};}gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);state.webgl='ready';
   }catch(e){state.errors.push(e.message);state.webgl='unavailable';this.onRemove(map,gl);}finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);gl.bindVertexArray(priorVAO);gl.bindBuffer(gl.ARRAY_BUFFER,priorBuffer);}
  },
  upload(records){if(!this.program)return;const geo=root.BurbzGeographicMap3D,c=map.getCenter();this.origin=geo.mercator(c.lng,c.lat);this.scale=1/(40075016.68557849*Math.cos(c.lat*Math.PI/180));const data=torchGeometry(records,geo,map,this.origin,this.scale);state.vertices=0;const priorBuffer=this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING);
   for(const [name,buffer]of Object.entries(data)){const mesh=this.meshes[name];this.gl.bindBuffer(this.gl.ARRAY_BUFFER,mesh.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,buffer,this.gl.STATIC_DRAW);mesh.count=buffer.length/9;state.vertices+=mesh.count;}this.gl.bindBuffer(this.gl.ARRAY_BUFFER,priorBuffer);state.builds++;
  },
  render(gl,args){state.draws=0;if(!this.program||!this.origin||!visible()||map.getZoom()<13)return;const matrix=args?.defaultProjectionData?.mainMatrix;if(!matrix)return;
   gl.useProgram(this.program);gl.uniformMatrix4fv(this.matrix,false,root.BurbzGeographicMap3D.localMatrix(matrix,this.origin,this.scale));gl.uniform1f(this.night,state.night);gl.uniform1f(this.time,state.time);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.disable(gl.CULL_FACE);gl.depthMask(true);gl.disable(gl.BLEND);
   const draw=name=>{const mesh=this.meshes[name];if(mesh.count){gl.bindVertexArray(mesh.vao);gl.drawArrays(gl.TRIANGLES,0,mesh.count);state.draws++;}};draw('solid');gl.depthMask(false);
   if(state.night>.01){gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);draw('flames');}
   gl.bindVertexArray(null);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);state.frames++;
  },
  onRemove(map,gl){if(this.meshes)for(const mesh of Object.values(this.meshes)){gl.deleteVertexArray(mesh.vao);gl.deleteBuffer(mesh.buffer);}if(this.program)gl.deleteProgram(this.program);this.program=null;this.meshes=null;}
 };}
 function attach(map,options={}){
  if(controllers.has(map))return controllers.get(map);
  const C=root.BurbzGeographicDayNightCore,container=map.getContainer(),shell=container.closest('#liveMapShell')||container,abort=new AbortController(),pointers=new Set(),paints=new Map(),heights=new Map(),motion=root.matchMedia?.('(prefers-reduced-motion: reduce)');
  const state={phase:'day',sun:1,warm:0,night:0,time:0,torches:0,records:[],vertices:0,draws:0,builds:0,frames:0,ticks:0,visible:false,webgl:'pending',errors:[]};let timer=null,disposed=false,dirty=true,styleDirty=true,signature='',gradeKey='',observer=null,intersection=null;
  function visible(){return !disposed&&!document.hidden&&container.isConnected!==false&&container.getClientRects().length>0&&(!options.isVisible||options.isVisible());}
  function moving(){return pointers.size>0||map.isMoving();}
  const layer=makeLayer(map,state,visible);
  function fail(error){state.errors.push(String(error.message||error));state.errors=state.errors.slice(-5);}
  function collect(){
   const c=map.getCenter(),b=map.getBounds(),margin=.0004,view={center:[c.lng,c.lat],bounds:[b.getWest()-margin,b.getSouth()-margin,b.getEast()+margin,b.getNorth()+margin]},paths=[];
   view.accept=position=>{const p=map.project(position);return p.x>=-24&&p.y>=-24&&p.x<=container.clientWidth+24&&p.y<=container.clientHeight+24;};
   for(const points of options.getRoutes?.()||[])if(points?.length>1)paths.push({points,priority:2});
   // Nearby ambient lanterns follow provider footways, never invented shortcuts.
   const transportation=map.getStyle()?.layers?.find(l=>l['source-layer']==='transportation');
   if(transportation)try{const seen=new Set();for(const f of map.querySourceFeatures(transportation.source,{sourceLayer:'transportation'})){
    if(!['path','track','footway','pedestrian','steps','bridleway'].includes(f.properties?.class)||['tunnel','bridge'].includes(f.properties?.brunnel))continue;
    const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
    for(const points of lines){const id=C.pathId(points);if(seen.has(id))continue;seen.add(id);paths.push({id,points,priority:0});if(paths.length>=400)break;}if(paths.length>=400)break;
   }}catch(e){fail(e);}
   const near=path=>{const pts=path.points.map(C.point).filter(Boolean);if(!pts.length)return Infinity;let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;for(const p of pts){west=Math.min(west,p[0]);east=Math.max(east,p[0]);south=Math.min(south,p[1]);north=Math.max(north,p[1]);}return C.distance(view.center,[Math.max(west,Math.min(east,c.lng)),Math.max(south,Math.min(north,c.lat))]);};
   paths.forEach(path=>{path.near=near(path);});paths.sort((a,b)=>b.priority-a.priority||a.near-b.near);
   const records=C.samplePaths(paths,view,container.clientWidth<=600?32:48),terrain=!!map.getTerrain(),ready=!terrain||map.isSourceLoaded(DEM),valid=[];
   for(const r of records){let elevation=terrain?(ready?map.queryTerrainElevation([r.lon,r.lat]):null):0;if(Number.isFinite(elevation))heights.set(r.id,elevation);else elevation=heights.get(r.id);if(Number.isFinite(elevation))valid.push({...r,elevation});}
   while(heights.size>240)heights.delete(heights.keys().next().value);
   state.records=valid;state.torches=valid.length;layer.upload(valid);map.getSource(GLOW)?.setData({type:'FeatureCollection',features:valid.map(r=>({type:'Feature',properties:{},geometry:{type:'Point',coordinates:[r.lon,r.lat]}}))});dirty=false;
  }
  function grade(){const date=options.now?.()||new Date();return root.BurbzDaylightCore.daylightGradeForHour(date.getHours()+date.getMinutes()/60+date.getSeconds()/3600);}
  function style(g){
   const key=g.sun+':'+g.warm;if(!styleDirty&&key===gradeKey)return false;gradeKey=key;
   for(const l of map.getStyle()?.layers||[]){if(l.type==='custom'||l.id.startsWith('burbz-trail-'))continue;
    // Quest geometry and gold remain the same; moonlight improves the surroundings.
    const quest=/quest|player-range|habitat-zone/.test(l.id),role=l.type==='symbol'?'label':/water|river|shore/.test(l.id)?'water':/road|highway|transport|street|path|track/.test(l.id)?'road':'ground';
    if(quest)continue;
    const keys=l.type==='background'?['background-color']:l.type==='fill'?['fill-color','fill-outline-color']:l.type==='line'?['line-color']:l.type==='symbol'?['text-color','text-halo-color']:l.type==='hillshade'?['hillshade-highlight-color','hillshade-shadow-color','hillshade-accent-color']:[];
    for(const property of keys){const id=l.id+':'+property;let base=paints.get(id);if(base===undefined){base=map.getPaintProperty(l.id,property);if(base===undefined)continue;paints.set(id,base);}const value=C.expression(base,g,property==='text-halo-color'?'halo':role);map.setPaintProperty(l.id,property,value);}
   }
   if(map.getLayer('burbz-quest-route-glow'))map.setPaintProperty('burbz-quest-route-glow','line-opacity',.32+.20*(1-g.sun));
   shell.dataset.mapPhase=g.phase;shell.style.setProperty('--map-night',String(1-g.sun));shell.style.setProperty('--map-warm',String(g.warm));styleDirty=false;return true;
  }
  function stop(){if(timer)clearTimeout(timer);timer=null;}
  function schedule(){if(timer||!visible())return;const animate=state.night>.01&&state.torches>0&&!motion?.matches&&!moving()&&map.getZoom()>=13;
   timer=setTimeout(()=>{timer=null;if(!visible())return;state.time=motion?.matches?0:performance.now()/1000;state.ticks++;refresh(false);if(animate&&!moving())map.triggerRepaint();schedule();},animate?250:15000);
  }
  function refresh(force=true){if(disposed)return;state.visible=visible();if(!state.visible){stop();return;}if(!map.getLayer(ID)&&!map.isStyleLoaded()){schedule();return;}
   try{if(!map.getSource(GLOW))map.addSource(GLOW,{type:'geojson',data:{type:'FeatureCollection',features:[]}});
    if(!map.getLayer(GLOW))map.addLayer({id:GLOW,type:'circle',source:GLOW,minzoom:13,paint:{'circle-radius':['interpolate',['exponential',2],['zoom'],13,3,18,96,22,1536],'circle-color':'#ffc05c','circle-opacity':0,'circle-blur':.85,'circle-pitch-alignment':'map','circle-pitch-scale':'map'}});
    if(!map.getLayer(ID)){map.addLayer(layer);dirty=true;}
    const count=(map.getStyle()?.layers||[]).length;if(state.layerCount!==count){state.layerCount=count;styleDirty=true;}
    const g=grade();state.phase=g.phase;state.sun=g.sun;state.warm=g.warm;state.night=1-g.sun;const changed=style(g);if(changed)map.setPaintProperty(GLOW,'circle-opacity',.46*state.night);
    const routes=options.getRoutes?.()||[],next=JSON.stringify(routes);if(signature!==next){signature=next;dirty=true;}
    if(dirty&&!moving())collect();if(force||changed)map.triggerRepaint();
   }catch(e){fail(e);}schedule();
  }
  function movement(){dirty=true;stop();refresh();}
  function source(e){if(e.sourceId===DEM||e.type==='terrain'||(e.sourceDataType==='content'&&e.sourceId===map.getStyle()?.layers?.find(l=>l['source-layer']==='transportation')?.source)){dirty=true;}}
  function idle(){if(dirty||styleDirty)refresh(false);else schedule();}
  function styleLoad(){paints.clear();gradeKey='';styleDirty=dirty=true;refresh();}
  function visibility(){if(!visible()){pointers.clear();stop();state.visible=false;}else refresh();}
  function restore(){if(map.getLayer(ID))map.removeLayer(ID);dirty=true;refresh();}
  const listeners=[['moveend',movement],['movestart',stop],['idle',idle],['sourcedata',source],['terrain',source],['style.load',styleLoad],['resize',movement],['webglcontextrestored',restore]];listeners.forEach(([event,fn])=>map.on(event,fn));
  map.getCanvasContainer?.().addEventListener('pointerdown',e=>{pointers.add(e.pointerId);stop();},{passive:true,signal:abort.signal});
  const end=e=>{pointers.delete(e.pointerId);if(!pointers.size)refresh();};for(const event of ['pointerup','pointercancel'])document.addEventListener(event,end,{capture:true,signal:abort.signal});
  document.addEventListener('visibilitychange',visibility,{signal:abort.signal});motion?.addEventListener('change',()=>{state.time=0;stop();refresh();},{signal:abort.signal});
  observer=new MutationObserver(visibility);observer.observe(document.getElementById('screen-map')||container,{attributes:true,attributeFilter:['class','style']});
  if(root.IntersectionObserver){intersection=new IntersectionObserver(visibility);intersection.observe(container);}
  function dispose(){if(disposed)return;disposed=true;stop();abort.abort();observer.disconnect();intersection?.disconnect();listeners.forEach(([e,f])=>map.off(e,f));map.off('remove',dispose);if(map.getLayer(ID))map.removeLayer(ID);if(map.getLayer(GLOW))map.removeLayer(GLOW);if(map.getSource(GLOW))map.removeSource(GLOW);paints.clear();heights.clear();controllers.delete(map);delete shell.dataset.mapPhase;shell.style.removeProperty('--map-night');shell.style.removeProperty('--map-warm');}
  const api={state,refresh,dispose};controllers.set(map,api);map.on('remove',dispose);refresh();return api;
 }
 function lighting(map,origin,scale){const state=controllers.get(map)?.state;if(!state)return null;return {sun:state.sun,warm:state.warm,night:state.night,lights:root.BurbzGeographicDayNightCore.lights(state.records,origin,scale,root.BurbzGeographicMap3D.mercator)};}
 root.BurbzGeographicDayNight={attach,lighting,stateFor:map=>controllers.get(map)?.state,torchGeometry};
})(globalThis);
