/* Shared village model geometry, merged into two map draws; MapLibre owns frames. */
(function(root){'use strict';
 const ID='burbz-geographic-details',DEM='burbz-geographic-dem',templates=new Map();
 const VS=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 position; layout(location=1) in vec3 normal; layout(location=2) in vec3 color;
 uniform mat4 matrix; uniform float outline; uniform float u_sun;uniform float u_warm;uniform vec4 u_lamps[8];out vec3 shade;
 void main(){float light=dot(normal,normalize(vec3(-.55,.65,1.)));float band=light>.65?1.12:light>.12?.90:.65;
 shade=mix(vec3(.16,.27,.24),color,band*.86);vec3 world=position;
      vec3 lit=mix(shade*vec3(.30,.43,.67),shade,u_sun);
      lit+=shade*vec3(.16,.05,-.04)*u_warm;
      if(u_sun<.999)for(int i=0;i<8;i++){vec4 lamp=u_lamps[i];float fall=max(0.,1.-distance(world,lamp.xyz)/max(1.,lamp.w));lit+=vec3(1.,.43,.10)*fall*fall*(1.-u_sun)*.68;}
 shade=outline>0.?mix(vec3(.025,.045,.075),vec3(.10,.20,.16),u_sun):lit;
 gl_Position=matrix*vec4(position+normal*outline*.07,1.);}`;
 const FS=`#version 300 es
 precision highp float; in vec3 shade; out vec4 outputColor;
 // Settlement vertex colours are linear (THREE.Color). MapLibre's custom
 // layer writes display RGB directly, so perform the same output conversion.
 void main(){vec3 c=max(shade,vec3(0.));vec3 display=mix(c*12.92,1.055*pow(c,vec3(1./2.4))-.055,step(vec3(.0031308),c));outputColor=vec4(display,1.);}`;
 function geometry(type,seed){
  const key=type+':'+seed;if(templates.has(key))return templates.get(key);
  const T=root.THREE,b=root.BurbzSettlementModels.batch(T);let model;
  if(type==='foundation'){
   b.box(1,1,1,0,.5,0,0x8b816a);model=b.finish();
  }else if(type==='grass'){
   for(let k=0;k<5;k++){const x=Math.sin(k*8+seed)*1.8,z=Math.cos(k*11+seed)*1.8;
    b.add(new T.ConeGeometry(.24,.8,3),k%2?0x6f894c:0x8d9b59,[x,.38,z]);
    if(k<2){b.cylinder(.035,.035,.6,x,.3,z,0x68784b,[0,0,0],4);b.add(new T.OctahedronGeometry(.13,0),k?0xe4c769:0xdbcbb0,[x,.64,z]);}}
   b.add(new T.IcosahedronGeometry(.35,0),0xaaa38b,[1.6,.14,-1.2],[0,0,0],[1,.5,.8]);model=b.finish();
  }else if(type==='lantern-post'){
   b.box(1.2,.24,1.2,0,.12,0,0x8a8770);
   b.box(.28,3.5,.28,0,1.95,0,0x68462d);b.box(1.6,.22,.24,.55,3.52,0,0x68462d);
   b.cylinder(.055,.055,.5,1.12,3.2,0,0xb89b52,[0,0,0],6);
   b.box(.6,.8,.5,1.12,2.69,0,0xf1c768);
   for(const x of [.79,1.45])for(const z of [-.29,.29])b.box(.075,.95,.075,x,2.69,z,0x53482d);
   b.add(new T.ConeGeometry(.55,.38,4),0x596f61,[1.12,3.3,0],[0,Math.PI/4,0]);
   b.box(.85,.6,.5,0,1.1,.36,0x9a7048);b.box(.55,.075,.025,0,1.22,.63,0x38291d);model=b.finish();
  }else if(type==='trail-shelter'){
   b.box(4.7,.25,3.7,0,.125,0,0x8a8770);
   for(const x of [-2,2])for(const z of [-1.5,1.5])b.box(.22,2.7,.22,x,1.6,z,0x68462d);
   for(const sign of [-1,1]){b.box(2.8,.18,4.2,sign*1.12,3.3,0,0x61795b,[0,0,-sign*.37]);b.box(.14,.35,4.25,sign*2.4,2.88,0,0x493b29);}
   b.box(.18,.24,4.25,0,3.81,0,0x493b29);
   b.box(3.7,.16,.62,0,.9,-1.05,0x9a7048);for(const x of [-1.5,1.5])b.box(.16,.65,.5,x,.55,-1.05,0x68462d);
   b.box(1.5,.12,.85,0,1.25,.25,0x9a7048);for(const x of [-.55,.55])b.box(.14,1,.5,x,.72,.25,0x68462d);
   b.box(.45,.06,.42,.1,1.35,.25,0xe1cf9c);model=b.finish();
  }else if(type==='waterfall'){
   // An illustrated cascade at the mapped fall, not an invented terrain height.
   for(let i=0;i<3;i++){const y=(2-i)*1.35,z=i*1.15;
    b.box(4.6,1.5,2,0,y+.65,z,0x697c73);b.box(3.6,.14,2.15,0,y+1.44,z,0x55969c);
    b.box(3.45,1.55,.13,0,y+.67,z+1.02,0x8bc6c5);
    for(let j=0;j<6;j++)b.box(.075,1.4,.04,-1.5+j*.59,y+.66,z+1.10,0xd3e8d6);
    b.sphere(.6,-1.2+i*.8,y+.08,z+1.15,0xd4e5cc,[1.4,.18,.6]);}
   model=b.finish();
  }else{let h=seed;model=root.BurbzSettlementModels.building(T,type,1,()=>{h=Math.imul(h,1664525)+1013904223|0;return(h>>>0)/4294967296;});}
  model.updateMatrixWorld(true);const data=[];
  model.traverse(mesh=>{if(!mesh.isMesh)return;const g=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry,p=g.attributes.position,n=g.attributes.normal,c=g.attributes.color;
   const normalMatrix=new T.Matrix3().getNormalMatrix(mesh.matrixWorld),v=new T.Vector3(),normal=new T.Vector3();
   for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);normal.fromBufferAttribute(n,i).applyMatrix3(normalMatrix).normalize();data.push(v.x,-v.z,v.y,normal.x,-normal.z,normal.y,c?c.getX(i):.5,c?c.getY(i):.5,c?c.getZ(i):.5);}
   if(g!==mesh.geometry)g.dispose();mesh.geometry.dispose();for(const m of [].concat(mesh.material))m.dispose();
  });
  const result=new Float32Array(data);templates.set(key,result);while(templates.size>48)templates.delete(templates.keys().next().value);return result;
 }
 function footprint(base,scale){
  if(!base.footprint){const b={west:Infinity,east:-Infinity,south:Infinity,north:-Infinity};for(let i=0;i<base.length;i+=9){b.west=Math.min(b.west,base[i]);b.east=Math.max(b.east,base[i]);b.south=Math.min(b.south,base[i+1]);b.north=Math.max(b.north,base[i+1]);}base.footprint=b;}
  return Object.fromEntries(Object.entries(base.footprint).map(([k,v])=>[k,v*scale]));
 }
 function groundProfile(record,box,sample){
  const metreLat=1/111320,metreLon=metreLat/Math.max(.087,Math.cos(record.lat*Math.PI/180));
  const offsets=[[0,0],[box.west,box.south],[box.east,box.south],[box.east,box.north],[box.west,box.north]];
  const points=offsets.map(([x,y])=>[((record.lon+x*metreLon+540)%360)-180,record.lat+y*metreLat]),heights=points.map(sample);
  if(!heights.every(Number.isFinite))return null;
  return{elevation:Math.max(...heights),bottom:Math.min(...heights)-.25,centre:heights[0],samples:heights,points};
 }
 function create(map,options){
  const state={objects:0,vertices:0,draws:0,builds:0,buildMs:[],buildProfiles:[],errors:[]},heights=new Map();let records=[],dirty=true,disposed=false;
  const layer={id:ID,type:'custom',renderingMode:'3d',
   onAdd(map,gl){this.gl=gl;const priorVAO=gl.getParameter(gl.VERTEX_ARRAY_BINDING),priorBuffer=gl.getParameter(gl.ARRAY_BUFFER_BINDING);const shader=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;};
    let vs,fs;try{vs=shader(gl.VERTEX_SHADER,VS);fs=shader(gl.FRAGMENT_SHADER,FS);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
     this.matrix=gl.getUniformLocation(this.program,'matrix');this.outline=gl.getUniformLocation(this.program,'outline');this.sun=gl.getUniformLocation(this.program,'u_sun');this.warm=gl.getUniformLocation(this.program,'u_warm');this.lamps=gl.getUniformLocation(this.program,'u_lamps[0]');this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
     for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12);}gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);dirty=true;
    }catch(e){state.errors.push(e.message);this.onRemove(map,gl);}finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);gl.bindVertexArray(priorVAO);gl.bindBuffer(gl.ARRAY_BUFFER,priorBuffer);}
   },
   upload(){if(!this.program||disposed)return;const stamp=()=>root.performance?.now()??Date.now(),started=stamp();let geometryMs=0,groundMs=0;const geo=root.BurbzGeographicMap3D,c=map.getCenter();this.origin=geo.mercator(c.lng,c.lat);this.scale=1/(40075016.68557849*Math.cos(c.lat*Math.PI/180));
    const terrain=!!map.getTerrain(),ready=terrain&&map.isSourceLoaded(DEM),chunks=[],bounds=map.getBounds(),marginLat=.0005,marginLon=marginLat/Math.max(.2,Math.cos(c.lat*Math.PI/180));this.anchors=[];let size=0,count=0;
    for(const r of records){
     // Keep a small approach margin; distant markers remain interactive while
     // their detailed building meshes cost no vertices in the current view.
     const nearLon=r.lon+360*Math.round((c.lng-r.lon)/360);
     if(nearLon<bounds.getWest()-marginLon||nearLon>bounds.getEast()+marginLon||r.lat<bounds.getSouth()-marginLat||r.lat>bounds.getNorth()+marginLat)continue;
     const solid=!['grass','waterfall'].includes(r.type),s=r.type==='grass'?1:r.type==='waterfall'?3.5:2.5;
     const geometryStart=stamp(),base=geometry(r.type,r.type==='grass'?r.seed%4:r.seed),box=solid?footprint(base,s):null;geometryMs+=stamp()-geometryStart;const groundStart=stamp();
     const heightKey=[r.id,r.lat,r.lon,r.type,r.seed].join(':');
     const cached=heights.get(heightKey);let ground=terrain?(cached&&!cached.dirty?cached:null):{elevation:0,bottom:0,centre:0,samples:[0]};
     if(terrain&&!ground&&ready){if(solid)ground=groundProfile(r,box,p=>map.queryTerrainElevation(p));else{const h=map.queryTerrainElevation([r.lon,r.lat]);if(Number.isFinite(h))ground={elevation:h,bottom:h,centre:h,samples:[h],points:[[r.lon,r.lat]]};}}
     if(terrain){if(ground){ground.dirty=false;heights.set(heightKey,ground);}else ground=cached;}groundMs+=stamp()-groundStart;if(!ground)continue;
     const elevation=ground.elevation;
     if(r.type!=='grass')this.anchors.push({...r,elevation,foundation:solid?{...ground,footprint:box}:null});
     const out=new Float32Array(base.length),xy=geo.mercator(r.lon,r.lat);xy[0]+=Math.round(this.origin[0]-xy[0]);
     const x=(xy[0]-this.origin[0])/this.scale,y=-(xy[1]-this.origin[1])/this.scale;
     for(let i=0;i<base.length;i+=9){out[i]=base[i]*s+x;out[i+1]=base[i+1]*s+y;out[i+2]=base[i+2]*s+elevation+.1;for(let k=3;k<9;k++)out[i+k]=base[i+k];}chunks.push(out);size+=out.length;count++;
     if(solid&&ground.elevation-ground.bottom>.3){const plinth=geometry('foundation',0),foundation=new Float32Array(plinth.length),w=box.east-box.west,d=box.north-box.south,h=elevation+.1-ground.bottom;
      for(let i=0;i<plinth.length;i+=9){foundation[i]=plinth[i]*w+x+(box.west+box.east)/2;foundation[i+1]=plinth[i+1]*d+y+(box.north+box.south)/2;foundation[i+2]=plinth[i+2]*h+ground.bottom;for(let k=3;k<9;k++)foundation[i+k]=plinth[i+k];}chunks.push(foundation);size+=foundation.length;}
    }
    const data=new Float32Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    const uploadStart=stamp(),priorBuffer=this.gl.getParameter(this.gl.ARRAY_BUFFER_BINDING);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,data,this.gl.STATIC_DRAW);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,priorBuffer);
    state.buildProfiles.push({totalMs:stamp()-started,geometryMs,groundMs,uploadMs:stamp()-uploadStart});if(state.buildProfiles.length>16)state.buildProfiles.shift();state.objects=count;state.anchors=this.anchors;state.vertices=size/9;state.builds++;state.buildMs.push((root.performance?.now()??Date.now())-started);if(state.buildMs.length>64)state.buildMs.shift();while(heights.size>600)heights.delete(heights.keys().next().value);dirty=false;options.onUpdate?.();
   },
   render(gl,args){if(!this.program||!state.vertices||map.getZoom()<13||!options.visible())return;const matrix=args?.defaultProjectionData?.mainMatrix;if(!matrix)return;
    const light=root.BurbzGeographicDayNight?.lighting(map,this.origin,this.scale);
    gl.useProgram(this.program);gl.uniform1f(this.sun,light?.sun??1);gl.uniform1f(this.warm,light?.warm??0);gl.uniform4fv(this.lamps,light?.lights||new Float32Array(32));gl.uniformMatrix4fv(this.matrix,false,root.BurbzGeographicMap3D.localMatrix(matrix,this.origin,this.scale));gl.bindVertexArray(this.vao);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
    for(let pass=0;pass<2;pass++){gl.cullFace(pass?gl.BACK:gl.FRONT);gl.uniform1f(this.outline,pass?0:1);gl.drawArrays(gl.TRIANGLES,0,state.vertices);}gl.bindVertexArray(null);gl.cullFace(gl.BACK);gl.disable(gl.CULL_FACE);gl.depthMask(false);state.draws=2;
   },
   onRemove(map,gl){if(this.vao)gl.deleteVertexArray(this.vao);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program);this.vao=this.buffer=this.program=null;heights.clear();state.objects=state.vertices=state.draws=0;state.anchors=[];options.onUpdate?.();}
  };
  function refresh(){if(disposed||!options.visible()||map.isMoving()||options.interacting?.())return;try{if(!map.getLayer(ID)&&map.isStyleLoaded())map.addLayer(layer);if(dirty&&layer.program){layer.upload();map.triggerRepaint();}}catch(e){state.errors=[e.message];}}
  function source(e){if(e.sourceId!==DEM&&e.type!=='terrain')return;dirty=true;
   // Reuse verified footprint samples while turning. A DEM tile event only
   // invalidates ground actually covered by that changed tile; unknown source
   // changes and terrain settings conservatively invalidate the whole cache.
   const c=e.coord?.canonical||e.tile?.tileID?.canonical,n=c&&2**c.z;
   for(const ground of heights.values())if(!c||ground.points.some(p=>{const m=root.BurbzGeographicMap3D.mercator(...p);return Math.floor(m[0]*n)===c.x&&Math.floor(m[1]*n)===c.y;}))ground.dirty=true;
  }
  function movement(){dirty=true;}
  function restored(){if(map.getLayer(ID))map.removeLayer(ID);dirty=true;state.vertices=0;refresh();}
  map.on('idle',refresh);map.on('moveend',movement);map.on('sourcedata',source);map.on('terrain',source);map.on('webglcontextrestored',restored);
  return {state,set(next){records=next.slice(0,200);dirty=true;refresh();},refresh,dispose(){disposed=true;map.off('idle',refresh);map.off('moveend',movement);map.off('sourcedata',source);map.off('terrain',source);map.off('webglcontextrestored',restored);if(map.getLayer(ID))map.removeLayer(ID);heights.clear();}};
 }
 root.BurbzGeographicDetailsScene={create,geometry,footprint,groundProfile};
})(globalThis);
