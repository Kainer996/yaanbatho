/* Shared village model geometry, merged into two map draws; MapLibre owns frames. */
(function(root){'use strict';
 const ID='burbz-geographic-details',DEM='burbz-geographic-dem',templates=new Map();
 const VS=`#version 300 es
 precision highp float;
 layout(location=0) in vec3 position; layout(location=1) in vec3 normal; layout(location=2) in vec3 color;
 uniform mat4 matrix; uniform float outline; out vec3 shade;
 void main(){float light=dot(normal,normalize(vec3(-.55,.65,1.)));float band=light>.65?1.12:light>.12?.90:.65;
 shade=outline>0.?vec3(.10,.20,.16):mix(vec3(.16,.27,.24),color,band*.86);
 gl_Position=matrix*vec4(position+normal*outline*.07,1.);}`;
 const FS=`#version 300 es
 precision highp float; in vec3 shade; out vec4 outputColor; void main(){outputColor=vec4(shade,1.);}`;
 function geometry(type,seed){
  const key=type+':'+seed;if(templates.has(key))return templates.get(key);
  const T=root.THREE,b=root.BurbzSettlementModels.batch(T);let model;
  if(type==='grass'){
   for(let k=0;k<5;k++){const x=Math.sin(k*8+seed)*1.8,z=Math.cos(k*11+seed)*1.8;
    b.add(new T.ConeGeometry(.24,.8,3),k%2?0x6f894c:0x8d9b59,[x,.38,z]);
    if(k<2){b.cylinder(.035,.035,.6,x,.3,z,0x68784b,[0,0,0],4);b.add(new T.OctahedronGeometry(.13,0),k?0xe4c769:0xdbcbb0,[x,.64,z]);}}
   b.add(new T.IcosahedronGeometry(.35,0),0xaaa38b,[1.6,.14,-1.2],[0,0,0],[1,.5,.8]);model=b.finish();
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
 function create(map,options){
  const state={objects:0,vertices:0,draws:0,builds:0,errors:[]},heights=new Map();let records=[],dirty=true,disposed=false;
  const layer={id:ID,type:'custom',renderingMode:'3d',
   onAdd(map,gl){this.gl=gl;const shader=(type,code)=>{const s=gl.createShader(type);gl.shaderSource(s,code);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)){const error=gl.getShaderInfoLog(s);gl.deleteShader(s);throw Error(error);}return s;};
    let vs,fs;try{vs=shader(gl.VERTEX_SHADER,VS);fs=shader(gl.FRAGMENT_SHADER,FS);this.program=gl.createProgram();gl.attachShader(this.program,vs);gl.attachShader(this.program,fs);gl.linkProgram(this.program);if(!gl.getProgramParameter(this.program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(this.program));
     this.matrix=gl.getUniformLocation(this.program,'matrix');this.outline=gl.getUniformLocation(this.program,'outline');this.vao=gl.createVertexArray();this.buffer=gl.createBuffer();gl.bindVertexArray(this.vao);gl.bindBuffer(gl.ARRAY_BUFFER,this.buffer);
     for(let i=0;i<3;i++){gl.enableVertexAttribArray(i);gl.vertexAttribPointer(i,3,gl.FLOAT,false,36,i*12);}gl.bindVertexArray(null);gl.bindBuffer(gl.ARRAY_BUFFER,null);dirty=true;
    }catch(e){state.errors.push(e.message);this.onRemove(map,gl);}finally{if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);}
   },
   upload(){if(!this.program||disposed)return;const geo=root.BurbzGeographicMap3D,c=map.getCenter();this.origin=geo.mercator(c.lng,c.lat);this.scale=1/(40075016.68557849*Math.cos(c.lat*Math.PI/180));
    const terrain=!!map.getTerrain(),ready=terrain&&map.isSourceLoaded(DEM),chunks=[],bounds=map.getBounds(),marginLat=.0005,marginLon=marginLat/Math.max(.2,Math.cos(c.lat*Math.PI/180));this.anchors=[];let size=0,count=0;
    for(const r of records){
     // Keep a small approach margin; distant markers remain interactive while
     // their detailed building meshes cost no vertices in the current view.
     const nearLon=r.lon+360*Math.round((c.lng-r.lon)/360);
     if(nearLon<bounds.getWest()-marginLon||nearLon>bounds.getEast()+marginLon||r.lat<bounds.getSouth()-marginLat||r.lat>bounds.getNorth()+marginLat)continue;
     let elevation=terrain?(ready?map.queryTerrainElevation([r.lon,r.lat]):null):0;
     if(terrain){if(Number.isFinite(elevation))heights.set(r.id,elevation);else elevation=heights.get(r.id);}if(!Number.isFinite(elevation))continue;
     if(r.type!=='grass')this.anchors.push({...r,elevation});
     const base=geometry(r.type,r.type==='grass'?r.seed%4:r.seed),out=new Float32Array(base.length),xy=geo.mercator(r.lon,r.lat);xy[0]+=Math.round(this.origin[0]-xy[0]);
     const x=(xy[0]-this.origin[0])/this.scale,y=-(xy[1]-this.origin[1])/this.scale,s=r.type==='grass'?1:r.type==='waterfall'?3.5:2.5;
     for(let i=0;i<base.length;i+=9){out[i]=base[i]*s+x;out[i+1]=base[i+1]*s+y;out[i+2]=base[i+2]*s+elevation+.1;for(let k=3;k<9;k++)out[i+k]=base[i+k];}chunks.push(out);size+=out.length;count++;
    }
    const data=new Float32Array(size);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.length;}
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER,this.buffer);this.gl.bufferData(this.gl.ARRAY_BUFFER,data,this.gl.STATIC_DRAW);this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null);
    state.objects=count;state.vertices=size/9;state.builds++;while(heights.size>600)heights.delete(heights.keys().next().value);dirty=false;
   },
   render(gl,args){if(!this.program||!state.vertices||map.getZoom()<13||!options.visible())return;const matrix=args?.defaultProjectionData?.mainMatrix;if(!matrix)return;
    gl.useProgram(this.program);gl.uniformMatrix4fv(this.matrix,false,root.BurbzGeographicMap3D.localMatrix(matrix,this.origin,this.scale));gl.bindVertexArray(this.vao);gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
    for(let pass=0;pass<2;pass++){gl.cullFace(pass?gl.BACK:gl.FRONT);gl.uniform1f(this.outline,pass?0:1);gl.drawArrays(gl.TRIANGLES,0,state.vertices);}gl.bindVertexArray(null);gl.cullFace(gl.BACK);gl.disable(gl.CULL_FACE);gl.depthMask(false);state.draws=2;
   },
   onRemove(map,gl){if(this.vao)gl.deleteVertexArray(this.vao);if(this.buffer)gl.deleteBuffer(this.buffer);if(this.program)gl.deleteProgram(this.program);this.vao=this.buffer=this.program=null;heights.clear();}
  };
  function refresh(){if(disposed||!options.visible()||map.isMoving()||options.interacting?.())return;try{if(!map.getLayer(ID)&&map.isStyleLoaded())map.addLayer(layer);if(dirty&&layer.program){layer.upload();map.triggerRepaint();}}catch(e){state.errors=[e.message];}}
  function source(e){if(e.sourceId===DEM||e.type==='terrain')dirty=true;}
  function movement(){dirty=true;}
  function restored(){if(map.getLayer(ID))map.removeLayer(ID);dirty=true;state.vertices=0;refresh();}
  map.on('idle',refresh);map.on('moveend',movement);map.on('sourcedata',source);map.on('terrain',source);map.on('webglcontextrestored',restored);
  return {state,set(next){records=next.slice(0,200);dirty=true;refresh();},refresh,dispose(){disposed=true;map.off('idle',refresh);map.off('moveend',movement);map.off('sourcedata',source);map.off('terrain',source);map.off('webglcontextrestored',restored);if(map.getLayer(ID))map.removeLayer(ID);heights.clear();}};
 }
 root.BurbzGeographicDetailsScene={create,geometry};
})(globalThis);
