/* Geographic forest placement for the real map. These are illustrative trees
 * INSIDE mapped woodland polygons, not surveyed individual tree locations.
 * OpenMapTiles woodland is source-layer landcover / class wood. A landuse
 * feature needs an explicit forest class/tag; green colour, parks, labels,
 * point centroids and generic habitat descriptions are never forest evidence.
 * Pure UMD module: no DOM, network, random clock, saves or source mutation.
 */
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzGeographicForestCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const EARTH_M = 6378137, WORLD_M = Math.PI * 2 * EARTH_M;
  const GRID = 4194304; // 2^22 cells; nested LOD selects existing cell anchors.
  const MAX_LAT = 85.0511287798066;
  const EPS = 1e-13;
  const LIMITS = Object.freeze({ maxTrees:1200, maxFeatures:512, maxVertices:24000,
    maxFeatureVertices:8000, maxPolygons:512, maxRings:512, maxCandidates:24000,
    maxGeometryChecks:1000000, maxPointTests:4000000, maxRouteSegments:2048,
    maxRouteIndexEntries:65536, maxRouteChecks:2000000 });
  const DEFAULTS = Object.freeze({ maxTrees:600, maxFeatures:512, maxVertices:24000,
    maxCandidates:24000, density:1, clearanceM:7, minZoom:13 });

  const finite = v => typeof v === 'number' && Number.isFinite(v);
  const tag = v => typeof v === 'string' ? v.trim().toLowerCase() : '';
  const clamp = (v, low, high) => Math.max(low, Math.min(high, v));
  const wrap = lon => ((lon + 180) % 360 + 360) % 360 - 180;
  const unwrap = (lon, near) => near + wrap(lon - near);
  const validPoint = p => Array.isArray(p) && finite(p[0]) && finite(p[1]) && Math.abs(p[0]) <= 540 && Math.abs(p[1]) <= 90;
  const cross = (a,b,c) => (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
  const same = (a,b) => a[0] === b[0] && a[1] === b[1];
  const mercY = lat => (1-Math.log(Math.tan(Math.PI/4+clamp(lat,-MAX_LAT,MAX_LAT)*Math.PI/360))/Math.PI)/2;
  const latitude = y => Math.atan(Math.sinh(Math.PI*(1-2*y)))*180/Math.PI;

  function isWoodlandFeature(feature) {
    if (!feature || !feature.geometry || !/^(Polygon|MultiPolygon)$/.test(feature.geometry.type)) return false;
    const props = feature.properties || {};
    const layer = tag(feature.sourceLayer || feature['source-layer'] || (feature.layer && feature.layer['source-layer']));
    return (layer === 'landcover' && tag(props.class) === 'wood') ||
      (layer === 'landuse' && (tag(props.class) === 'forest' || tag(props.landuse) === 'forest'));
  }
  function diagnostics(features) {
    return { status:'empty', inputFeatures:features, acceptedFeatures:0, acceptedPolygons:0,
      rejectedFeatures:0, invalidFeatures:0, duplicatePolygons:0, vertices:0,
      geometryChecks:0, pointTests:0, candidates:0, uniqueCandidates:0,
      routeChecks:0, routeExcluded:0, routeSegments:0, routeIndexEntries:0,
      routeIndexBuckets:0, trees:0, budgetLimited:false, limitsHit:[] };
  }
  function limit(d, key) {
    d.budgetLimited = true;
    if (!d.limitsHit.includes(key)) d.limitsHit.push(key);
  }
  function maxOption(options, key, fallback, hard) {
    return finite(options[key]) ? clamp(Math.floor(options[key]),0,hard) : fallback;
  }
  function boundsOf(points) {
    let west=Infinity,south=Infinity,east=-Infinity,north=-Infinity;
    points.forEach(p => {west=Math.min(west,p[0]);east=Math.max(east,p[0]);south=Math.min(south,p[1]);north=Math.max(north,p[1]);});
    return {west,south,east,north};
  }
  function containsBounds(b,p) { return p[0]>=b.west-EPS&&p[0]<=b.east+EPS&&p[1]>=b.south-EPS&&p[1]<=b.north+EPS; }
  function onSegment(p,a,b) {
    return Math.abs(cross(a,b,p))<=EPS && p[0]>=Math.min(a[0],b[0])-EPS && p[0]<=Math.max(a[0],b[0])+EPS && p[1]>=Math.min(a[1],b[1])-EPS && p[1]<=Math.max(a[1],b[1])+EPS;
  }
  function segmentsIntersect(a,b,c,e) {
    const x=cross(a,b,c),y=cross(a,b,e),z=cross(c,e,a),w=cross(c,e,b);
    if (((x>EPS&&y<-EPS)||(x<-EPS&&y>EPS)) && ((z>EPS&&w<-EPS)||(z<-EPS&&w>EPS))) return true;
    return (Math.abs(x)<=EPS&&onSegment(c,a,b)) || (Math.abs(y)<=EPS&&onSegment(e,a,b)) ||
      (Math.abs(z)<=EPS&&onSegment(a,c,e)) || (Math.abs(w)<=EPS&&onSegment(b,c,e));
  }
  // -1 outside, 0 boundary, 1 inside, null when the hard work budget expires.
  function inRing(p, ring, d) {
    let inside=false;
    for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
      if (++d.pointTests>LIMITS.maxPointTests) {limit(d,'point-tests');return null;}
      const a=ring[j],b=ring[i];
      if (onSegment(p,a,b)) return 0;
      if ((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0]) inside=!inside;
    }
    return inside?1:-1;
  }
  function inPolygon(p, polygon, d) {
    if (!containsBounds(polygon.bounds,p)) return false;
    const outside=inRing(p,polygon.rings[0],d);
    if (outside===null) return null;
    if (outside<0) return false;
    for (let i=1;i<polygon.rings.length;i++) {
      if (!containsBounds(polygon.holeBounds[i-1],p)) continue;
      const hole=inRing(p,polygon.rings[i],d);
      if (hole===null) return null;
      if (hole>=0) return false; // Hole boundaries are excluded too.
    }
    return true;
  }
  // Sweep segment bounding boxes so ordinary woodland rings avoid O(V²) work.
  // Crossing/touching nonadjacent edges invalidate the WHOLE source feature.
  function validRingTopology(rings,d) {
    const edges=[];
    rings.forEach((ring,r) => ring.forEach((a,i) => {
      const b=ring[(i+1)%ring.length];
      edges.push({a,b,r,i,n:ring.length,west:Math.min(a[0],b[0]),east:Math.max(a[0],b[0]),south:Math.min(a[1],b[1]),north:Math.max(a[1],b[1])});
    }));
    edges.sort((a,b)=>a.west-b.west||a.south-b.south||a.r-b.r||a.i-b.i);
    let active=[];
    for (const edge of edges) {
      active=active.filter(other=>other.east>=edge.west-EPS);
      for (const other of active) {
        if (++d.geometryChecks>LIMITS.maxGeometryChecks) {limit(d,'geometry-checks');return false;}
        if (other.north<edge.south-EPS||other.south>edge.north+EPS) continue;
        if (other.r===edge.r && (Math.abs(other.i-edge.i)===1||Math.abs(other.i-edge.i)===edge.n-1)) continue;
        if (segmentsIntersect(edge.a,edge.b,other.a,other.b)) return false;
      }
      active.push(edge);
    }
    return true;
  }
  function compileGeometry(geometry, anchor, d, vertexLimit) {
    if (!geometry || !Array.isArray(geometry.coordinates)) return null;
    const input=geometry.type==='Polygon'?[geometry.coordinates]:geometry.type==='MultiPolygon'?geometry.coordinates:null;
    if (!input||!input.length||input.length>LIMITS.maxPolygons) return null;
    let count=0,ringsCount=0;
    for (const polygon of input) {
      if (!Array.isArray(polygon)||!polygon.length) return null;
      ringsCount+=polygon.length;
      if (ringsCount>LIMITS.maxRings) {limit(d,'rings');return null;}
      for (const ring of polygon) {
        if (!Array.isArray(ring)||ring.length<4) return null;
        count+=ring.length;
        if (count>LIMITS.maxFeatureVertices) {limit(d,'feature-vertices');return null;}
      }
    }
    if (d.vertices+count>vertexLimit) {limit(d,'vertices');return null;}
    d.vertices+=count;
    const compiled=[];
    for (const polygon of input) {
      const rings=[];
      for (const raw of polygon) {
        if (!raw.every(validPoint)) return null;
        if (wrap(raw[0][0]-raw[raw.length-1][0])!==0||raw[0][1]!==raw[raw.length-1][1]) return null;
        const ring=[];
        let near=anchor;
        for (let i=0;i<raw.length-1;i++) {
          const p=[unwrap(raw[i][0],near),raw[i][1]];near=p[0];
          if (!ring.length||!same(p,ring[ring.length-1])) ring.push(p);
        }
        if (ring.length>1&&same(ring[0],ring[ring.length-1])) ring.pop();
        if (ring.length<3) return null;
        const box=boundsOf(ring);
        if (box.east-box.west>=180||box.north===box.south) return null;
        const shift=Math.round((anchor-(box.west+box.east)/2)/360)*360;
        if (shift) ring.forEach(p=>{p[0]+=shift;});
        let area=0;
        for(let i=0;i<ring.length;i++) {const a=ring[i],b=ring[(i+1)%ring.length];area+=(a[0]-ring[0][0])*(b[1]-ring[0][1])-(b[0]-ring[0][0])*(a[1]-ring[0][1]);}
        if (Math.abs(area)<1e-14) return null;
        rings.push(ring);
      }
      if (!validRingTopology(rings,d)) return null;
      for (let i=1;i<rings.length;i++) {
        if (inRing(rings[i][0],rings[0],d)!==1) return null;
        for (let j=1;j<i;j++) {
          if (inRing(rings[i][0],rings[j],d)!==-1||inRing(rings[j][0],rings[i],d)!==-1) return null;
        }
      }
      compiled.push({rings,bounds:boundsOf(rings[0]),holeBounds:rings.slice(1).map(boundsOf)});
    }
    return compiled;
  }
  function pointInWoodland(p, geometry) {
    if (!validPoint(p)) return false;
    const d=diagnostics(1),point=[wrap(p[0]),p[1]],polygons=compileGeometry(geometry,point[0],d,LIMITS.maxVertices);
    return !!polygons&&polygons.some(poly=>inPolygon(point,poly,d)===true);
  }
  function viewOf(value) {
    const b=value&&value.bounds;
    if (!Array.isArray(b)||b.length!==4||!b.every(finite)||!finite(value.zoom)||b[1]>=b[3]||b[1]<-90||b[3]>90) return null;
    let span=b[2]-b[0];
    if (Math.abs(span)>=360) span=360;else if(span<0)span+=360;
    if (!(span>0)) return null;
    const west=wrap(b[0]),east=west+span,south=Math.max(-MAX_LAT,b[1]),north=Math.min(MAX_LAT,b[3]);
    if(south>=north)return null;
    const mid=(west+east)/2,center=validPoint(value.center)?[unwrap(value.center[0],mid),value.center[1]]:[mid,(south+north)/2];
    if(center[0]<west||center[0]>east)center[0]=mid;
    center[1]=clamp(center[1],south,north);
    return {west,east,south,north,center,zoom:value.zoom};
  }
  function featureKey(feature) {
    const g=feature&&feature.geometry;
    const base=String(feature&&feature.id||'')+'|'+String(feature&&feature.sourceLayer||'')+'|'+String(g&&g.type||'');
    if(!g||!Array.isArray(g.coordinates))return base;
    const polygons=g.type==='Polygon'?[g.coordinates]:g.coordinates;
    if(polygons.length>LIMITS.maxPolygons)return base+'|oversized';
    let vertices=0,rings=0;
    const pieces=[];
    for(const polygon of polygons){
      if(!Array.isArray(polygon)||(rings+=polygon.length)>LIMITS.maxRings)return base+'|invalid';
      pieces.push('polygon');
      for(const ring of polygon){
        if(!Array.isArray(ring)||(vertices+=ring.length)>LIMITS.maxFeatureVertices)return base+'|oversized';
        pieces.push('ring');
        for(const p of ring){if(!validPoint(p))return base+'|invalid';pieces.push(p[0]+','+p[1]);}
      }
    }
    return base+'|'+pieces.join(';');
  }
  function hash(x,y,salt) {
    let n=Math.imul(x^salt,0x45d9f3b)^Math.imul(y,0x27d4eb2d);
    n=Math.imul(n^(n>>>16),0x45d9f3b);n=Math.imul(n^(n>>>16),0x45d9f3b);
    return (n^(n>>>16))>>>0;
  }
  function priorityLess(a,b) {return a.stride>b.stride||(a.stride===b.stride&&(a.priority<b.priority||(a.priority===b.priority&&(a.x<b.x||(a.x===b.x&&(a.y<b.y||(a.y===b.y&&a.region<b.region)))))));}
  function push(heap,item) {let i=heap.length;heap.push(item);while(i){const p=(i-1)>>1;if(!priorityLess(item,heap[p]))break;heap[i]=heap[p];i=p;}heap[i]=item;}
  function pop(heap) {
    const first=heap[0],last=heap.pop();if(!heap.length)return first;
    let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&priorityLess(heap[c+1],heap[c]))c++;if(!priorityLess(heap[c],last))break;heap[i]=heap[c];i=c;}heap[i]=last;return first;
  }
  function routesOf(segments,view,d,clearance) {
    if (segments==null) segments=[];
    if (!Array.isArray(segments)||segments.length>LIMITS.maxRouteSegments) {limit(d,'route-segments');return null;}
    const degrees=clearance/(EARTH_M*Math.PI/180);
    const minCos=Math.max(0.001,Math.cos(Math.max(Math.abs(view.south),Math.abs(view.north))*Math.PI/180));
    const latStep=64/(EARTH_M*Math.PI/180),lonStep=latStep/minCos;
    const index=new Map(),result={index,latStep,lonStep};
    for(const segment of segments){
      if(!Array.isArray(segment)||segment.length!==2||!validPoint(segment[0])||!validPoint(segment[1]))return null;
      const a=[unwrap(segment[0][0],view.center[0]),segment[0][1]],b=[unwrap(segment[1][0],a[0]),segment[1][1]];
      const route={a,b,bounds:boundsOf([a,b])};d.routeSegments++;
      if(!clearance)continue;
      const box=route.bounds;
      // Only the lookup corridor is clipped to the viewport. Distance checks
      // retain the exact original endpoints, including the full return leg.
      const west=Math.max(view.west,box.west-degrees/minCos),east=Math.min(view.east,box.east+degrees/minCos);
      const south=Math.max(view.south,box.south-degrees),north=Math.min(view.north,box.north+degrees);
      if(west>east||south>north)continue;
      const minX=Math.floor(west/lonStep),maxX=Math.floor(east/lonStep),minY=Math.floor(south/latStep),maxY=Math.floor(north/latStep);
      const entries=(maxX-minX+1)*(maxY-minY+1);
      if(d.routeIndexEntries+entries>LIMITS.maxRouteIndexEntries){limit(d,'route-index');return null;}
      d.routeIndexEntries+=entries;
      for(let x=minX;x<=maxX;x++)for(let y=minY;y<=maxY;y++){
        const key=x+':'+y;if(!index.has(key))index.set(key,[]);index.get(key).push(route);
      }
    }
    d.routeIndexBuckets=index.size;
    return result;
  }
  function nearRoute(point,routes,clearance,d) {
    if(!clearance)return false;
    const degrees=clearance/(EARTH_M*Math.PI/180),cos=Math.max(0.001,Math.cos(point[1]*Math.PI/180));
    const nearby=routes.index.get(Math.floor(point[0]/routes.lonStep)+':'+Math.floor(point[1]/routes.latStep))||[];
    for(const route of nearby){
      if(++d.routeChecks>LIMITS.maxRouteChecks){limit(d,'route-checks');return null;}
      const b=route.bounds;
      if(point[0]<b.west-degrees/cos||point[0]>b.east+degrees/cos||point[1]<b.south-degrees||point[1]>b.north+degrees)continue;
      const a=[(route.a[0]-point[0])*cos,route.a[1]-point[1]],end=[(route.b[0]-point[0])*cos,route.b[1]-point[1]];
      const dx=end[0]-a[0],dy=end[1]-a[1],len=dx*dx+dy*dy;
      const t=len?clamp(-(a[0]*dx+a[1]*dy)/len,0,1):0;
      if(Math.hypot(a[0]+dx*t,a[1]+dy*t)<=degrees)return true;
    }
    return false;
  }

  function placeTrees(input, rawView, options) {
    options=options||{};
    const features=Array.isArray(input)?input:input&&input.type==='FeatureCollection'&&Array.isArray(input.features)?input.features:[];
    const d=diagnostics(features.length),trees=[],answer={trees,diagnostics:d},view=viewOf(rawView);
    if(!view){d.status='invalid-view';return answer;}
    if(view.zoom<DEFAULTS.minZoom){d.status='zoom-hidden';return answer;}
    const maxTrees=maxOption(options,'maxTrees',DEFAULTS.maxTrees,LIMITS.maxTrees);
    const maxFeatures=maxOption(options,'maxFeatures',DEFAULTS.maxFeatures,LIMITS.maxFeatures);
    const maxVertices=maxOption(options,'maxVertices',DEFAULTS.maxVertices,LIMITS.maxVertices);
    const maxCandidates=maxOption(options,'maxCandidates',DEFAULTS.maxCandidates,LIMITS.maxCandidates);
    const density=finite(options.density)?clamp(options.density,0,1):DEFAULTS.density;
    const clearance=finite(options.clearanceM)?clamp(options.clearanceM,0,200):DEFAULTS.clearanceM;
    if(!maxTrees||!density){d.status='disabled';return answer;}
    if(features.length>maxFeatures){limit(d,'features');d.status='feature-limit';return answer;}
    const routes=routesOf(options.routeSegments,view,d,clearance);
    if(!routes){d.status=d.budgetLimited?'route-limit':'invalid-route';return answer;}
    const polygons=[],signatures=new Set();
    // Canonical order removes dependence on the vector source's tile iteration.
    const ordered=features.map(feature=>({feature,key:featureKey(feature)}))
      .sort((a,b)=>a.key<b.key?-1:a.key>b.key?1:0).map(entry=>entry.feature);
    for(const feature of ordered){
      if(!isWoodlandFeature(feature)){d.rejectedFeatures++;continue;}
      const compiled=compileGeometry(feature.geometry,view.center[0],d,maxVertices);
      if(!compiled){d.invalidFeatures++;continue;}
      // Reject a whole multipolygon if the remaining polygon budget cannot fit
      // it; never keep its exterior and silently drop later holes or islands.
      if(polygons.length+compiled.length>LIMITS.maxPolygons){limit(d,'polygons');d.rejectedFeatures++;continue;}
      d.acceptedFeatures++;
      compiled.forEach(polygon=>{
        const key=JSON.stringify(polygon.rings);
        if(signatures.has(key)){d.duplicatePolygons++;return;}
        signatures.add(key);polygons.push(polygon);
      });
    }
    d.acceptedPolygons=polygons.length;
    if(!polygons.length){d.status=d.budgetLimited?'budget-exhausted':'empty';return answer;}
    const stride=2**Math.max(0,17-Math.floor(view.zoom));
    d.lodStride=stride;d.gridSpacingMercatorM=WORLD_M/GRID*stride;
    const regions=[];
    // Coarser anchors are exhausted before finer anchors. This retains every
    // lower-zoom tree even when the shared tree budget caps a denser view.
    for(let level=16;level>=stride;level/=2){
      const cells=GRID/level,cx=(view.center[0]+180)/360*cells,cy=mercY(view.center[1])*cells;
      polygons.forEach(p=>{
        const b=p.bounds,west=Math.max(b.west,view.west),east=Math.min(b.east,view.east),south=Math.max(b.south,view.south),north=Math.min(b.north,view.north);
        if(west>east||south>north)return;
        regions.push({stride:level,cx,cy,minX:Math.floor((west+180)/360*cells)-1,maxX:Math.floor((east+180)/360*cells),minY:Math.max(0,Math.floor(mercY(north)*cells)-1),maxY:Math.min(cells-1,Math.floor(mercY(south)*cells))});
      });
    }
    const heap=[],queued=new Set(),checked=new Set();
    function queue(x,y,region){
      const r=regions[region];if(x<r.minX||x>r.maxX||y<r.minY||y>r.maxY)return;
      const key=region+':'+x+':'+y;if(queued.has(key))return;
      // Heap/visited memory is bounded along with popped candidates.
      if(queued.size>=maxCandidates*4+regions.length){limit(d,'candidate-memory');return;}
      queued.add(key);push(heap,{x,y,region,stride:r.stride,priority:(x+0.5-r.cx)**2+(y+0.5-r.cy)**2});
    }
    regions.forEach((r,i)=>queue(clamp(Math.floor(r.cx),r.minX,r.maxX),clamp(Math.floor(r.cy),r.minY,r.maxY),i));
    while(heap.length&&trees.length<maxTrees&&d.candidates<maxCandidates){
      const cell=pop(heap);d.candidates++;
      queue(cell.x-1,cell.y,cell.region);queue(cell.x+1,cell.y,cell.region);queue(cell.x,cell.y-1,cell.region);queue(cell.x,cell.y+1,cell.region);
      const gx=((cell.x*cell.stride)%GRID+GRID)%GRID,gy=cell.y*cell.stride,id='gf1:'+gx+':'+gy;
      if(checked.has(id))continue;checked.add(id);d.uniqueCandidates++;
      if(hash(gx,gy,19)/4294967296>=density)continue;
      const x=(gx+0.15+hash(gx,gy,71)/4294967296*0.7)/GRID;
      const y=(gy+0.15+hash(gx,gy,113)/4294967296*0.7)/GRID;
      const longitude=wrap(x*360-180),point=[unwrap(longitude,view.center[0]),latitude(y)];
      if(!containsBounds(view,point))continue;
      let woodland=false,exhausted=false;
      for(const polygon of polygons){
        const inside=inPolygon(point,polygon,d);
        if(inside===null){exhausted=true;break;}
        if(inside){woodland=true;break;}
      }
      if(exhausted)break;
      if(!woodland)continue;
      const excluded=nearRoute(point,routes,clearance,d);
      if(excluded===null)break;
      if(excluded){d.routeExcluded++;continue;}
      trees.push({id,longitude,latitude:point[1],size:0.82+hash(gx,gy,173)/4294967296*0.48,variant:hash(gx,gy,251)%4});
    }
    if(heap.length&&trees.length>=maxTrees)limit(d,'trees');
    if(heap.length&&d.candidates>=maxCandidates)limit(d,'candidates');
    d.trees=trees.length;d.status=trees.length?'ready':d.budgetLimited?'budget-exhausted':'empty';
    return answer;
  }

  return { placeTrees, isWoodlandFeature, pointInWoodland, DEFAULTS, LIMITS };
});
