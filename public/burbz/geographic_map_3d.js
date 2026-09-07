/* Geographic terrain and illustrative woodland. Never owns GPS, quests or saves. */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzGeographicMap3D = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';
  const VERSION = 'geographic-terrain-v1-20260907';
  const DEM_ID = 'burbz-geographic-dem';
  const SHADE_DEM_ID = 'burbz-geographic-shade-dem';
  const FOREST_ID = 'burbz-geographic-forest';
  const SHADE_ID = 'burbz-geographic-hillshade';
  const EARTH = 40075016.68557849;
  const DEM = Object.freeze({
    type:'raster-dem', tiles:['https://tiles.mapterhorn.com/{z}/{x}/{y}.webp'],
    encoding:'terrarium', tileSize:512, minzoom:0, maxzoom:13,
    attribution:'<a href="https://mapterhorn.com/attribution">Elevation © Mapterhorn</a> · <a href="data/geographic-terrain-credits.html">Terrain credits</a>'
  });
  const PROFILES = Object.freeze([
    { trees:180, dpr:1, shade:false }, { trees:360, dpr:1.25, shade:false },
    { trees:650, dpr:1.65, shade:true }, { trees:1000, dpr:2, shade:true }
  ]);
  const controllers = new WeakMap();
  const workerURL = root.document?.currentScript?.src ? new URL('geographic_forest_worker.js?v='+VERSION,root.document.currentScript.src).href : 'geographic_forest_worker.js?v='+VERSION;
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const now = () => root.performance ? root.performance.now() : Date.now();
  function mercator(lon, lat) {
    const phi = clamp(lat, -85.051129, 85.051129) * Math.PI / 180;
    return [(lon + 180) / 360, (1 - Math.log(Math.tan(Math.PI / 4 + phi / 2)) / Math.PI) / 2];
  }
  function pixelRatio(width, height, nativeDpr, tier) {
    return Math.max(.85, Math.min(nativeDpr || 1, PROFILES[tier].dpr,
      Math.sqrt(1400000 / Math.max(1, width * height))));
  }
  function qualityStep(tier, samples) {
    const usable = samples.filter(n => Number.isFinite(n) && n > 0);
    if (usable.length < 48) return { tier, p90:null };
    usable.sort((a,b) => a-b);
    const p90 = usable[Math.floor((usable.length - 1) * .9)];
    return { tier:p90 > 23 ? Math.max(0,tier-1) : tier, p90 };
  }
  function localMatrix(matrix, origin, scale) {
    const out = new Float32Array(16);
    for (let row=0; row<4; row++) {
      out[row] = matrix[row] * scale;
      out[4+row] = matrix[4+row] * -scale;
      out[8+row] = matrix[8+row] * scale;
      out[12+row] = matrix[row]*origin[0] + matrix[4+row]*origin[1] + matrix[12+row];
    }
    return out;
  }
  // Shared, faceted geometry: each triangle has a flat normal. Two instanced
  // meshes, independent of tree count; no scene graph, raster trees or shadows.
  function treeGeometry(kind) {
    const data = [];
    function tri(a,b,c,color) {
      const u=b.map((v,i)=>v-a[i]), v=c.map((x,i)=>x-a[i]);
      let n=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
      const len=Math.hypot(...n); if(len<1e-10)return; n=n.map(x=>x/len);
      [a,b,c].forEach(p=>data.push(...p,...n,...color));
    }
    function rings(cx,cy,levels,sides,color,phase) {
      for(let l=0;l<levels.length-1;l++) for(let k=0;k<sides;k++) {
        const a=phase+k*2*Math.PI/sides,b=phase+(k+1)*2*Math.PI/sides;
        const [z0,r0]=levels[l],[z1,r1]=levels[l+1];
        const p=[cx+Math.cos(a)*r0,cy+Math.sin(a)*r0,z0];
        const q=[cx+Math.cos(b)*r0,cy+Math.sin(b)*r0,z0];
        const r=[cx+Math.cos(b)*r1,cy+Math.sin(b)*r1,z1];
        const s=[cx+Math.cos(a)*r1,cy+Math.sin(a)*r1,z1];
        tri(p,q,r,color); if(r1)tri(p,r,s,color);
      }
    }
    rings(0,0,[[0,.038],[.58,.024],[.64,0]],5,[.38,.29,.16],.2);
    if(kind===1) {
      rings(0,0,[[.18,0],[.24,.34],[.65,0]],7,[.24,.40,.29],.2);
      rings(0,0,[[.38,0],[.42,.28],[.84,0]],7,[.28,.45,.32],.2);
      rings(0,0,[[.61,0],[.65,.20],[1.08,0]],7,[.39,.53,.34],.2);
    } else {
      rings(0,0,[[.33,0],[.42,.29],[.65,.37],[.86,.28],[1.02,0]],7,[.38,.52,.30],.1);
      rings(-.22,.08,[[.34,0],[.47,.23],[.67,.25],[.80,.14],[.87,0]],6,[.44,.57,.34],.35);
      rings(.23,-.03,[[.31,0],[.44,.25],[.64,.26],[.77,.16],[.84,0]],6,[.30,.46,.31],.05);
    }
    return new Float32Array(data);
  }
  const VERTEX = `#version 300 es
    precision highp float;
    layout(location=0) in vec3 a_position;
    layout(location=1) in vec3 a_normal;
    layout(location=2) in vec3 a_color;
    layout(location=3) in vec4 a_instance;
    layout(location=4) in vec2 a_style;
    uniform mat4 u_matrix;
    uniform float u_outline;
    out vec3 v_color;
    void main() {
      float s=sin(a_style.x), c=cos(a_style.x);
      mat3 rotation=mat3(c,s,0.,-s,c,0.,0.,0.,1.);
      vec3 normal=rotation*a_normal;
      vec3 p=rotation*(a_position*a_instance.w);
      p+=normal*u_outline*(.10+a_instance.w*.009);
      float light=dot(normal,normalize(vec3(-.55,.65,1.0)));
      float band=light>.65?1.12:light>.12?.90:.65;
      vec3 shade=mix(vec3(.16,.27,.24),a_color,band*.86);
      v_color=u_outline>0.?vec3(.10,.20,.16):shade*(.92+a_style.y*.15);
      gl_Position=u_matrix*vec4(p+a_instance.xyz,1.);
    }`;
  const FRAGMENT = `#version 300 es
    precision highp float;
    in vec3 v_color;
    out vec4 fragColor;
    void main(){fragColor=vec4(v_color,1.);}`;
  function makeForestLayer(state) {
    function shader(gl, type, source) {
      const s=gl.createShader(type); gl.shaderSource(s,source); gl.compileShader(s);
      if(!gl.getShaderParameter(s,gl.COMPILE_STATUS)) {
        const message=gl.getShaderInfoLog(s); gl.deleteShader(s); throw new Error(message);
      }
      return s;
    }
    return {
      id:FOREST_ID, type:'custom', renderingMode:'3d', meshes:[], count:0,
      onAdd(map,gl) {
        this.gl=gl;
        let vs=null,fs=null;
        try {
          if(!gl.drawArraysInstanced || !gl.createVertexArray) throw new Error('WebGL2 instancing unavailable');
          vs=shader(gl,gl.VERTEX_SHADER,VERTEX);fs=shader(gl,gl.FRAGMENT_SHADER,FRAGMENT);
          this.program=gl.createProgram(); gl.attachShader(this.program,vs); gl.attachShader(this.program,fs);
          gl.linkProgram(this.program); gl.deleteShader(vs); gl.deleteShader(fs);vs=null;fs=null;
          if(!gl.getProgramParameter(this.program,gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(this.program));
          this.matrix=gl.getUniformLocation(this.program,'u_matrix'); this.outline=gl.getUniformLocation(this.program,'u_outline');
          for(let kind=0;kind<2;kind++) {
            const geometry=treeGeometry(kind), vao=gl.createVertexArray(), mesh=gl.createBuffer(), instances=gl.createBuffer();
            gl.bindVertexArray(vao); gl.bindBuffer(gl.ARRAY_BUFFER,mesh); gl.bufferData(gl.ARRAY_BUFFER,geometry,gl.STATIC_DRAW);
            for(let attr=0;attr<3;attr++){gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,3,gl.FLOAT,false,36,attr*12);}
            gl.bindBuffer(gl.ARRAY_BUFFER,instances); gl.bufferData(gl.ARRAY_BUFFER,24,gl.DYNAMIC_DRAW);
            gl.enableVertexAttribArray(3); gl.vertexAttribPointer(3,4,gl.FLOAT,false,24,0); gl.vertexAttribDivisor(3,1);
            gl.enableVertexAttribArray(4); gl.vertexAttribPointer(4,2,gl.FLOAT,false,24,16); gl.vertexAttribDivisor(4,1);
            this.meshes.push({vao,mesh,instances,vertices:geometry.length/9,count:0});
          }
          gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER,null); state.webgl='instanced';
        } catch(e) { state.webgl='unavailable'; state.errors.push(String(e.message||e));
          if(vs)gl.deleteShader(vs);if(fs)gl.deleteShader(fs);
          if(this.program){gl.deleteProgram(this.program);this.program=null;}
        }
      },
      upload(trees,map) {
        if(state.webgl!=='instanced')return;
        this.trees=trees;
        const center=map.getCenter();this.origin=mercator(center.lng,center.lat);
        this.scale=1/(EARTH*Math.cos(center.lat*Math.PI/180));
        const batches=[[],[]]; let missing=0;
        trees.forEach(t=>{
          const xy=mercator(t.longitude,t.latitude);
          // Keep the displayed world copy next to the current map centre.
          xy[0]+=Math.round(this.origin[0]-xy[0]);
          let elevation=state.terrainActive?(map.isSourceLoaded(DEM_ID)?map.queryTerrainElevation([t.longitude,t.latitude]):null):0;
          if(elevation==null || !Number.isFinite(elevation)){missing++;return;}
          const kind=t.variant===1?1:0, hash=String(t.id).split('').reduce((n,c)=>(Math.imul(n,31)+c.charCodeAt(0))|0,7)>>>0;
          batches[kind].push((xy[0]-this.origin[0])/this.scale,-(xy[1]-this.origin[1])/this.scale,
            elevation+.15,14*clamp(Number(t.size)||1,.65,1.6),hash/4294967296*Math.PI*2,(hash%101)/100);
        });
        this.count=0;
        this.meshes.forEach((m,i)=>{m.count=batches[i].length/6;this.count+=m.count;this.gl.bindBuffer(this.gl.ARRAY_BUFFER,m.instances);this.gl.bufferData(this.gl.ARRAY_BUFFER,new Float32Array(batches[i]),this.gl.DYNAMIC_DRAW);});
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER,null);state.trees=this.count;state.elevationPendingTrees=missing;
      },
      render(gl,args) {
        if(!state.visible || !state.enabled || state.webgl!=='instanced' || !this.count || state.zoom<12)return;
        const matrix=args?.defaultProjectionData?.mainMatrix;
        if(!matrix)return;
        gl.useProgram(this.program);gl.uniformMatrix4fv(this.matrix,false,localMatrix(matrix,this.origin,this.scale));
        gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.depthMask(true);gl.disable(gl.BLEND);gl.enable(gl.CULL_FACE);
        // One reversed hull and one cel pass per shared tree mesh: <=4 draws.
        for(let pass=0;pass<2;pass++) {
          gl.cullFace(pass===0?gl.FRONT:gl.BACK);gl.uniform1f(this.outline,pass===0?1:0);
          this.meshes.forEach(m=>{if(m.count){gl.bindVertexArray(m.vao);gl.drawArraysInstanced(gl.TRIANGLES,0,m.vertices,m.count);}});
        }
        gl.bindVertexArray(null);gl.cullFace(gl.BACK);gl.disable(gl.CULL_FACE);gl.depthMask(false);
        state.draws=this.meshes.filter(m=>m.count).length*2;state.renderedFrames++;
        // MapLibre owns invalidation. Static woodland never runs its own RAF.
      },
      onRemove(map,gl) {
        this.meshes.forEach(m=>{gl.deleteVertexArray(m.vao);gl.deleteBuffer(m.mesh);gl.deleteBuffer(m.instances);});
        this.meshes=[]; if(this.program)gl.deleteProgram(this.program); this.program=null;
      }
    };
  }
  function attach(map, options={}) {
    if(!map)return null;
    if(controllers.has(map))return controllers.get(map);
    const doc=options.document||root.document, container=map.getContainer();
    const state={version:VERSION,enabled:true,visible:true,terrainActive:false,terrainReduced:false,elevation:'loading',
      webgl:'pending',trees:0,elevationPendingTrees:0,zoom:map.getZoom(),tier:3,draws:0,
      errors:[],renderedFrames:0,forestBuilds:0,buildMs:0,frameP90:null,pixelRatio:null,placement:null,inspectionPitch:32,fit:null,worker:'idle'};
    let timer=null,disposed=false,layer=null,sourceId=null,control=null,toggle=null,status=null;
    let lastRender=0,lastAdapt=0,frames=[],observer=null,intersection=null,contextLost=false,demErrors=0,performanceViewChange=false,performanceQualityPending=false;
    const listeners=[];
    let pendingFit=null, lastFit=null,resizeRefit=false,fitting=false,cardObserver=null;
    const activePointers=new Set();let lastPointerMove=-Infinity;
    const interacting=()=>map.isMoving()||(activePointers.size>0&&now()-lastPointerMove<400);
    let worker=null,workerFailed=false,job=0,inflight=null,queued=null,deferredPlacement=null;
    function stopPlacement() {
      if(worker){worker.onmessage=null;worker.onerror=null;worker.terminate();}worker=null;inflight=null;queued=null;deferredPlacement=null;job++;state.worker='paused';
    }
    function workerFallback() {
      workerFailed=true;stopPlacement();state.worker='fallback';schedule(200);
    }
    function dispatch(request) {
      if(!worker)return;
      inflight=request;
      try{worker.postMessage(request);}catch(e){workerFallback();}
    }
    function acceptPlacement(result,elapsed) {
      if(disposed||!state.enabled||!state.visible||!layer)return;
      if(interacting()){deferredPlacement={result,elapsed};return;}
      layer.upload(result.trees,map);state.placement=result.diagnostics;state.forestBuilds++;
      state.buildMs=elapsed;map.triggerRepaint();
    }
    function place(features,view,placementOptions) {
      const core=root.BurbzGeographicForestCore;
      if(!core)return;
      if(!worker && !workerFailed && root.Worker)try {
        worker=new root.Worker(workerURL);const instance=worker;state.worker='ready';
        worker.onmessage=event=>{
          if(worker!==instance||disposed)return;
          const message=event.data,completed=inflight;
          if(!completed||message.id!==completed.id)return;
          inflight=null;
          if(message.error){workerFailed=true;state.errors.push(String(message.error));stopPlacement();schedule(200);return;}
          if(message.id===job&&message.result)acceptPlacement(message.result,now()-completed.started);
          if(queued){const next=queued;queued=null;dispatch(next);}
        };
        worker.onerror=()=>{if(worker===instance&&!disposed)workerFallback();};
      }catch(e){workerFailed=true;state.worker='fallback';}
      const request={id:++job,features,view,options:placementOptions,started:now()};
      if(worker){if(inflight)queued=request;else dispatch(request);return;}
      // Worker restrictions must not block the map. The synchronous fallback
      // has a much smaller illustration budget and only runs after interaction.
      state.worker='fallback';
      const result=core.placeTrees(features,view,{...placementOptions,maxTrees:Math.min(180,placementOptions.maxTrees)});
      acceptPlacement(result,now()-request.started);
    }
    function on(name, fn){map.on(name,fn);listeners.push([name,fn]);}
    function visible() {
      return !doc?.hidden && container.isConnected!==false && container.getClientRects().length>0 &&
        (typeof options.isVisible!=='function'||options.isVisible());
    }
    function paintStatus() {
      if(!toggle)return;
      toggle.setAttribute('aria-pressed',String(state.enabled));
      toggle.title=state.enabled?'Switch to a flat map':'Explore real terrain and illustrated woodland';
      toggle.querySelector('span').textContent=state.enabled?(state.terrainReduced?'3D map · light':'3D terrain'):'2D map';
      if(status)status.textContent=!state.enabled?'Flat view':state.elevation==='unavailable'?'Elevation unavailable':
        state.terrainReduced?'Terrain paused · 3D trees':state.elevation==='ready'?'Real terrain · illustrated trees':'Loading terrain';
      if(state.terrainReduced)toggle.title='Terrain mesh paused for smoother movement. Switch to 2D, then back to 3D to retry terrain.';
    }
    function applyQuality() {
      const rect=container.getBoundingClientRect();
      const dpr=pixelRatio(rect.width,rect.height,root.devicePixelRatio||1,state.tier);
      if(typeof map.setPixelRatio==='function' && Math.abs((state.pixelRatio||0)-dpr)>.02){state.pixelRatio=dpr;map.setPixelRatio(dpr);}
      if(map.getLayer(SHADE_ID))map.setLayoutProperty(SHADE_ID,'visibility',state.enabled&&state.visible&&(state.terrainReduced||PROFILES[state.tier].shade)?'visible':'none');
    }
    function syncTerrain() {
      state.zoom=map.getZoom();
      const wanted=state.enabled&&state.visible&&!state.terrainReduced&&state.zoom>=10&&state.elevation!=='unavailable';
      state.terrainActive=map.getTerrain()?.source===DEM_ID;
      if(wanted===state.terrainActive)return;
      if(wanted&&(!map.getSource(DEM_ID)||!map.isStyleLoaded()))return;
      try{state.terrainActive=wanted;map.setTerrain(wanted?{source:DEM_ID,exaggeration:1}:null);
        // Re-anchor existing instances once when elevation is enabled/paused;
        // never leave trees floating while the next worker placement settles.
        if(layer?.trees?.length)layer.upload(layer.trees,map);
      }
      catch(e){state.terrainActive=false;
        if(/Style is not done loading/i.test(String(e.message||e))){schedule(200);return;}
        state.errors.push(String(e.message||e));state.elevation='unavailable';
      }
    }
    function schedule(delay=160) {
      if(disposed||contextLost)return;
      if(timer)return;
      timer=root.setTimeout(()=>{timer=null;refresh();},delay);
    }
    function routeSegments() {
      const segments=[];
      const routes=typeof options.getRoutes==='function'?options.getRoutes():[];
      (routes||[]).forEach(points=>{
        for(let i=1;i<points.length&&segments.length<2049;i++) {
          const p=points[i-1],q=points[i];
          segments.push([Array.isArray(p)?p:[p.lon,p.lat],Array.isArray(q)?q:[q.lon,q.lat]]);
        }
      });
      // Roads are only clearings for illustrative trees, never route authority.
      if(sourceId)try {
        const view=map.getBounds();
        const overlaps=f=>{
          const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
          let west=Infinity,east=-Infinity,south=Infinity,north=-Infinity;
          for(const line of lines)for(const p of line){west=Math.min(west,p[0]);east=Math.max(east,p[0]);south=Math.min(south,p[1]);north=Math.max(north,p[1]);}
          return west<=view.getEast()&&east>=view.getWest()&&south<=view.getNorth()&&north>=view.getSouth();
        };
        const ways=map.querySourceFeatures(sourceId,{sourceLayer:'transportation'}).filter(overlaps).slice(0,100);
        ways.forEach(f=>{
          const lines=f.geometry.type==='LineString'?[f.geometry.coordinates]:f.geometry.type==='MultiLineString'?f.geometry.coordinates:[];
          lines.forEach(line=>{for(let i=1;i<line.length&&segments.length<1900;i++)segments.push([line[i-1],line[i]]);});
        });
      }catch(e){}
      return segments;
    }
    function refresh() {
      if(disposed)return;
      state.visible=visible();state.zoom=map.getZoom();
      syncTerrain();paintStatus();
      if(performanceQualityPending){performanceQualityPending=false;applyQuality();}
      if(performanceViewChange){
        if(state.visible&&!interacting()){performanceViewChange=false;options.onViewChange?.(state.enabled);}
      }
      if(state.visible&&resizeRefit&&lastFit&&!fitting){
        resizeRefit=false;
        if(!lastFit.options.isCurrent||lastFit.options.isCurrent())fitRoute(lastFit.points,lastFit.options);
        else lastFit=null;
      }
      if(state.visible && pendingFit && !fitting && now()<pendingFit.until && pendingFit.refits<2 &&
        (state.elevation==='unavailable'||(state.terrainActive&&map.isSourceLoaded(DEM_ID)))) {
        const pending=pendingFit;
        if(!pending.options.isCurrent||pending.options.isCurrent()) {
          pending.refits++;fitRoute(pending.points,pending.options,true);
        }else pendingFit=null;
      }
      if(!state.enabled||!state.visible||!sourceId||state.zoom<12||!layer)return;
      if(interacting()){schedule(180);return;}
      if(deferredPlacement){const saved=deferredPlacement;deferredPlacement=null;acceptPlacement(saved.result,saved.elapsed);}
      const core=root.BurbzGeographicForestCore;
      if(!core)return;
      const started=now();
      try {
        const features=map.querySourceFeatures(sourceId,{sourceLayer:'landcover',filter:['==','class','wood']});
        const bounded=features.slice(0,256).map(f=>({type:'Feature',sourceLayer:'landcover',properties:f.properties,geometry:f.geometry}));
        const bounds=map.getBounds(),center=map.getCenter();
        place(bounded,{bounds:[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()],center:[center.lng,center.lat],zoom:state.zoom},
          {maxTrees:PROFILES[state.tier].trees,routeSegments:routeSegments(),clearanceM:10});
        state.prepareMs=now()-started;
        if(state.terrainActive&&map.isSourceLoaded(DEM_ID)){state.elevation='ready';paintStatus();}
      }catch(e){state.errors.push(String(e.message||e));state.errors=state.errors.slice(-8);}
    }
    function install() {
      if(disposed||contextLost)return;
      try {
        const style=map.getStyle();
        sourceId=(style.layers||[]).find(l=>l['source-layer']==='landcover')?.source||null;
        if(!map.getSource(DEM_ID))map.addSource(DEM_ID,DEM);
        // Public MapLibre 5.24 terrain LOD: retain the default horizon zoom
        // span, with a smaller detailed region to bound high-pitch tile work.
        map.setSourceTileLodParams?.(9.314,1.5,DEM_ID);
        if(!map.getSource(SHADE_DEM_ID))map.addSource(SHADE_DEM_ID,{...DEM,maxzoom:12});
        const before=(style.layers||[]).find(l=>l.type==='line'||l.type==='symbol')?.id;
        if(!map.getLayer(SHADE_ID))map.addLayer({id:SHADE_ID,type:'hillshade',source:SHADE_DEM_ID,minzoom:10,paint:{
          'hillshade-exaggeration':.26,'hillshade-shadow-color':'#29483c','hillshade-highlight-color':'#eedfb6',
          'hillshade-accent-color':'#6f8465','hillshade-illumination-direction':315,'hillshade-illumination-anchor':'map'
        }},before);
        if(!map.getLayer(FOREST_ID)){layer=makeForestLayer(state);map.addLayer(layer);}
        applyQuality();syncTerrain();schedule(30);
      }catch(e){state.errors.push(String(e.message||e));}
    }
    function setEnabled(value) {
      if(disposed)return;
      if(value&&!state.enabled){state.terrainReduced=false;frames=[];lastRender=0;performanceViewChange=false;performanceQualityPending=false;}
      state.enabled=!!value;syncTerrain();applyQuality();paintStatus();
      if(!state.enabled)stopPlacement();
      state.inspectionPitch=state.enabled?32:0;
      if(typeof options.onViewChange==='function')options.onViewChange(state.enabled);
      schedule(20);map.triggerRepaint();
    }
    function safeRect(fitOptions) {
      const core=root.BurbzGeographicCameraCore, rect=container.getBoundingClientRect();
      if(!core)return null;
      const elements=fitOptions.occluders||Array.from(doc?.querySelectorAll(
        '#mapQuestFocusCard.show, #liveMapShell .map-zoom-controls, #liveMapShell .map-locate-btn, #liveMapShell .map-quest-btn, #liveMapShell .geographic-map-control, #liveMapShell .map-area-birds-panel.collapsed, #liveMapShell .maplibregl-ctrl-attrib')||[]);
      const occluders=elements.filter(e=>e&&e.getClientRects().length).map(e=>{
        const b=e.getBoundingClientRect();return {left:b.left-rect.left,top:b.top-rect.top,right:b.right-rect.left,bottom:b.bottom-rect.top};
      });
      return core.visibleRect({width:rect.width,height:rect.height},{padding:{left:24,right:24,top:26,bottom:24},gap:14,occluders});
    }
    function fitRoute(points, fitOptions={}, terrainRefit=false) {
      if(disposed||fitting||!points?.length||!root.BurbzGeographicCameraCore)return false;
      if(fitOptions.isCurrent&&!fitOptions.isCurrent())return false;
      function failed(reason){state.inspectionPitch=0;state.fit={status:'invalid',reason,points:points.length,pitch:0};return false;}
      const coords=points.map(p=>Array.isArray(p)?p:[p.lon,p.lat]);
      if(coords.some(p=>!Number.isFinite(p[0])||!Number.isFinite(p[1])))return failed('invalid-coordinates');
      const core=root.BurbzGeographicCameraCore, area=safeRect(fitOptions);
      if(!area||area.width<28||area.height<28)return failed('no-visible-area');
      const width=container.clientWidth,height=container.clientHeight;
      const bound=coords.reduce((b,p)=>[Math.min(b[0],p[0]),Math.min(b[1],p[1]),Math.max(b[2],p[0]),Math.max(b[3],p[1])],[Infinity,Infinity,-Infinity,-Infinity]);
      let result=null,iterations=0;
      fitting=true;
      try {
        // MapLibre5.24 cameraForBounds is planar and adds existing padding.
        // First obtain a conservative start, then verify real terrain-projected
        // positions of EVERY vertex with zero persistent camera padding.
        map.setPadding({top:0,right:0,bottom:0,left:0});
        const initial=map.cameraForBounds([[bound[0],bound[1]],[bound[2],bound[3]]],
          {padding:{left:area.left,right:width-area.right,top:area.top,bottom:height-area.bottom},maxZoom:15.8,bearing:0});
        if(!initial)return failed('initial-camera-unavailable');
        for(const pitch of (state.enabled?[32,18,0]:[0])) {
          state.inspectionPitch=pitch;
          map.jumpTo({center:initial.center,zoom:initial.zoom,pitch,bearing:0,padding:{top:0,right:0,bottom:0,left:0}});
          for(let attempt=0;attempt<12;attempt++) {
            iterations++;
            result=core.frameCorrection(coords.map(p=>map.project(p)),area,{tolerance:.75,maxZoomOutStep:.8});
            if(result.status==='fit')break;
            if(result.status==='invalid')break;
            if(result.status==='zoom-out')map.jumpTo({zoom:Math.max(4,map.getZoom()+result.zoomDelta)});
            else {
              const p=map.unproject([width/2-result.screenShift[0],height/2-result.screenShift[1]]);
              map.jumpTo({center:p});
            }
          }
          if(result?.status==='fit')break;
        }
        state.fit={status:result?.status||'invalid',points:coords.length,pitch:state.inspectionPitch,iterations,area,bounds:result?.bounds||null};
        if(!terrainRefit){lastFit={points,options:fitOptions};pendingFit={points,options:fitOptions,refits:0,until:now()+15000};}
        schedule(100);
        return result?.status==='fit';
      }catch(e){state.errors.push(String(e.message||e));return failed('projection-error');}
      finally{fitting=false;}
    }
    if(doc) {
      control=doc.createElement('div');control.className='geographic-map-control';
      control.innerHTML='<button type="button" class="geographic-map-toggle" aria-pressed="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><path d="m2 19 7-13 4 7 3-5 6 11H2Z"/><path d="m6 12 3 2 2-3m2 2 3 2 2-3"/></svg><span>3D terrain</span></button><span class="geographic-map-status">Loading terrain</span>';
      toggle=control.querySelector('button');status=control.querySelector('.geographic-map-status');
      toggle.addEventListener('click',()=>setEnabled(!state.enabled));
      (options.controlsHost||container.parentElement||container).appendChild(control);
      const visibilityChanged=()=>{state.visible=visible();frames=[];lastRender=0;if(!state.visible){activePointers.clear();lastPointerMove=-Infinity;}syncTerrain();applyQuality();if(state.visible)schedule(30);else stopPlacement();};
      doc.addEventListener('visibilitychange',visibilityChanged);listeners.push(['document:visibilitychange',visibilityChanged]);
      if(root.IntersectionObserver){intersection=new root.IntersectionObserver(visibilityChanged);intersection.observe(container);}
      const screen=container.closest('.screen');
      if(screen&&root.MutationObserver){observer=new root.MutationObserver(visibilityChanged);observer.observe(screen,{attributes:true,attributeFilter:['class','hidden']});}
      const card=doc.getElementById?.('mapQuestFocusCard');
      const credit=container.querySelector?.('.maplibregl-ctrl-attrib');
      if((card||credit)&&root.ResizeObserver){cardObserver=new root.ResizeObserver(()=>{resizeRefit=true;schedule(120);});
        if(card)cardObserver.observe(card);if(credit)cardObserver.observe(credit);
      }
    }
    on('style.load',install);
    const cancelPendingFit=e=>{pendingFit=null;activePointers.add(e.pointerId);};
    const endPointer=e=>{activePointers.delete(e.pointerId);if(!activePointers.size){lastRender=0;frames=[];schedule(80);}};
    const mapCanvas=map.getCanvasContainer?.();
    mapCanvas?.addEventListener('pointerdown',cancelPendingFit,{passive:true});
    mapCanvas?.addEventListener('pointerleave',endPointer,{passive:true});
    doc?.addEventListener('pointerup',endPointer,true);doc?.addEventListener('pointercancel',endPointer,true);
    on('move',()=>{if(activePointers.size)lastPointerMove=now();});
    on('moveend',()=>{state.zoom=map.getZoom();syncTerrain();schedule(80);});
    on('resize',()=>{state.visible=visible();applyQuality();resizeRefit=true;schedule(120);});
    on('sourcedata',e=>{if(e.sourceId===sourceId||e.sourceId===DEM_ID||/^burbz-quest/.test(e.sourceId||''))schedule(180);});
    on('error',e=>{
      if(e.sourceId!==DEM_ID)return;
      if(++demErrors<3)return;
      state.elevation='unavailable';state.errors.push(String(e.error?.message||'Terrain unavailable'));
      state.errors=state.errors.slice(-8);
      syncTerrain();paintStatus();schedule(20);
    });
    on('render',()=>{
      const t=now();
      if(!state.visible||!interacting()){lastRender=0;frames=[];return;}
      if(lastRender)frames.push(t-lastRender);lastRender=t;
      if(state.terrainActive&&!state.terrainReduced&&state.elevation==='ready'&&frames.length>=12&&frames.reduce((sum,n)=>sum+n,0)>=2000){
        const sorted=frames.slice().sort((a,b)=>a-b),p90=sorted[Math.floor((sorted.length-1)*.9)];
        if(p90>50){state.terrainReduced=true;state.frameP90=p90;state.tier=Math.min(state.tier,2);
          performanceViewChange=true;performanceQualityPending=true;frames=[];lastAdapt=t;schedule(0);return;}
      }
      if(frames.length>=48&&t-lastAdapt>5000){const q=qualityStep(state.tier,frames);state.frameP90=q.p90;frames=[];lastAdapt=t;
        if(q.tier!==state.tier){state.tier=q.tier;applyQuality();schedule(60);}}
    });
    on('webglcontextlost',()=>{contextLost=true;state.webgl='lost';activePointers.clear();lastPointerMove=-Infinity;frames=[];lastRender=0;if(timer)root.clearTimeout(timer);timer=null;stopPlacement();});
    on('webglcontextrestored',()=>{contextLost=false;state.webgl='pending';if(map.getLayer(FOREST_ID))map.removeLayer(FOREST_ID);install();});
    function dispose(){if(disposed)return;disposed=true;if(timer)root.clearTimeout(timer);
      stopPlacement();
      mapCanvas?.removeEventListener('pointerdown',cancelPendingFit);
      mapCanvas?.removeEventListener('pointerleave',endPointer);
      doc?.removeEventListener('pointerup',endPointer,true);doc?.removeEventListener('pointercancel',endPointer,true);activePointers.clear();
      listeners.forEach(([name,fn])=>name==='document:visibilitychange'?doc.removeEventListener('visibilitychange',fn):map.off(name,fn));
      observer?.disconnect();intersection?.disconnect();cardObserver?.disconnect();control?.remove();
      try{map.setTerrain(null);if(map.getLayer(FOREST_ID))map.removeLayer(FOREST_ID);if(map.getLayer(SHADE_ID))map.removeLayer(SHADE_ID);if(map.getSource(DEM_ID))map.removeSource(DEM_ID);if(map.getSource(SHADE_DEM_ID))map.removeSource(SHADE_DEM_ID);}catch(e){}
      controllers.delete(map);
    }
    const controller=Object.freeze({state,refresh:()=>schedule(0),setEnabled,dispose,fitRoute,
      getPitch:(zoom,inspection)=>state.enabled?(inspection?state.inspectionPitch:state.terrainReduced?44:clamp(48+(zoom-14)*3.4,44,58)):0});
    controllers.set(map,controller);on('remove',dispose);
    state.visible=visible();
    if(map.isStyleLoaded())install();
    return controller;
  }
  return Object.freeze({VERSION,DEM,PROFILES,attach,mercator,pixelRatio,qualityStep,localMatrix,treeGeometry});
});
