/* Burbz Empire Map Core — pure GeoJSON helpers for captured territory. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzEmpireMapCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const EARTH_RADIUS_M = 6371008.8;
  const DEFAULT_TERRITORY_RADIUS_M = 2200;
  const LIBERATED_GREEN = '#8ee39a';

  function validClaim(v) {
    if (!v || v.lat === null || v.lat === undefined || v.lon === null || v.lon === undefined) return false;
    const lat = Number(v.lat), lon = Number(v.lon);
    return Number.isFinite(lat) && Number.isFinite(lon) && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
  }

  function validClaims(villages) {
    return (Array.isArray(villages) ? villages : []).filter(validClaim);
  }

  function destination(lat, lon, bearingRad, distanceM) {
    const phi1 = Number(lat) * Math.PI / 180;
    const lambda1 = Number(lon) * Math.PI / 180;
    const delta = Math.max(1, Number(distanceM) || DEFAULT_TERRITORY_RADIUS_M) / EARTH_RADIUS_M;
    const sinPhi1 = Math.sin(phi1), cosPhi1 = Math.cos(phi1);
    const sinDelta = Math.sin(delta), cosDelta = Math.cos(delta);
    const phi2 = Math.asin(sinPhi1 * cosDelta + cosPhi1 * sinDelta * Math.cos(bearingRad));
    const lambda2 = lambda1 + Math.atan2(Math.sin(bearingRad) * sinDelta * cosPhi1, cosDelta - sinPhi1 * Math.sin(phi2));
    // Keep this longitude unwrapped around the claim's own longitude. MapLibre
    // accepts longitudes just beyond ±180 and renders the short dateline arc;
    // normalising each point independently would turn a 2.2 km circle into a
    // nearly 360° polygon.
    return [lambda2 * 180 / Math.PI, phi2 * 180 / Math.PI];
  }

  function territoryCircle(village, radiusM, steps) {
    if (!validClaim(village)) return null;
    const count = Math.max(24, Math.min(96, Math.round(Number(steps) || 56)));
    const radius = Math.max(250, Number(radiusM) || DEFAULT_TERRITORY_RADIUS_M);
    const ring = [];
    for (let i = 0; i <= count; i++) ring.push(destination(village.lat, village.lon, (i / count) * Math.PI * 2, radius));
    ring[ring.length - 1] = ring[0].slice();
    return {
      type: 'Feature',
      properties: {
        seed: Number(village.seed) || 0,
        name: String(village.name || 'Liberated territory'),
        claimedAt: village.claimedAt || '',
        radiusM: radius,
        color: LIBERATED_GREEN
      },
      geometry: { type: 'Polygon', coordinates: [ring] }
    };
  }

  function territoryFeatureCollection(villages, radiusM, steps) {
    return { type: 'FeatureCollection', features: validClaims(villages).map(v => territoryCircle(v, radiusM, steps)).filter(Boolean) };
  }

  function claimFeatureCollection(villages) {
    return {
      type: 'FeatureCollection',
      features: validClaims(villages).map(v => ({
        type: 'Feature',
        properties: { seed: Number(v.seed) || 0, name: String(v.name || 'Liberated village'), claimedAt: v.claimedAt || '' },
        geometry: { type: 'Point', coordinates: [Number(v.lon), Number(v.lat)] }
      }))
    };
  }

  function claimBounds(villages) {
    const claims = validClaims(villages);
    if (!claims.length) return null;
    let south = Infinity, north = -Infinity;
    const longitudes = [];
    claims.forEach(v => {
      const lat = Number(v.lat), lon = Number(v.lon);
      longitudes.push(((lon % 360) + 360) % 360);
      south = Math.min(south, lat);
      north = Math.max(north, lat);
    });
    if (longitudes.length === 1) {
      const lon = Number(claims[0].lon);
      return [[lon, south], [lon, north]];
    }
    longitudes.sort((a, b) => a - b);
    let largestGap = -1, gapAfter = 0;
    for (let i = 0; i < longitudes.length; i++) {
      const next = i === longitudes.length - 1 ? longitudes[0] + 360 : longitudes[i + 1];
      const gap = next - longitudes[i];
      if (gap > largestGap) { largestGap = gap; gapAfter = i; }
    }
    let west = longitudes[(gapAfter + 1) % longitudes.length];
    let east = longitudes[gapAfter];
    while (east < west) east += 360;
    if (west > 180) { west -= 360; east -= 360; }
    west = Number(west.toFixed(12));
    east = Number(east.toFixed(12));
    return [[west, south], [east, north]];
  }

  // Permanent daylight only. The atlas's moving scout lantern never enters this
  // authority. Circles are a derived view of saved ownership, not another save.
  // A sphere-space tree bounds hot combat queries independently of map zoom and
  // handles the dateline/poles without duplicating or truncating remote holdings.
  function createTerritoryLight(sources) {
    const rad = Math.PI / 180, dot = (a,b) => a.reduce((n,v,i) => n+v*b[i],0);
    const vector = p => { const lat=Number(p.lat)*rad,lon=Number(p.lon)*rad,c=Math.cos(lat);return [c*Math.cos(lon),c*Math.sin(lon),Math.sin(lat)]; };
    const circles = Object.freeze((Array.isArray(sources)?sources:[]).filter(p=>validClaim(p)&&Number.isFinite(p.radius)&&p.radius>0).map(p=>Object.freeze({...p,lat:Number(p.lat),lon:Number(p.lon)})));
    const rows=circles.map(circle=>{const centre=vector(circle),angle=Math.min(Math.PI,circle.radius/EARTH_RADIUS_M),reach=2*Math.sin(angle/2);return {circle,centre,angle,reach,lo:centre.map(v=>v-reach),hi:centre.map(v=>v+reach)};});
    function tree(items) {
      if(!items.length)return null;
      const lo=[Infinity,Infinity,Infinity],hi=[-Infinity,-Infinity,-Infinity];for(const r of items)for(let i=0;i<3;i++){lo[i]=Math.min(lo[i],r.lo[i]);hi[i]=Math.max(hi[i],r.hi[i]);}
      if(items.length<=8)return {lo,hi,items};
      const axis=[0,1,2].sort((a,b)=>(hi[b]-lo[b])-(hi[a]-lo[a]))[0];items.sort((a,b)=>a.centre[axis]-b.centre[axis]);const mid=items.length>>1;
      return {lo,hi,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};
    }
    const index=tree(rows),overlaps=(node,lo,hi)=>node&&lo.every((v,i)=>v<=node.hi[i]&&hi[i]>=node.lo[i]);
    function search(node,lo,hi,visit) {if(!overlaps(node,lo,hi))return false;if(node.items)return node.items.some(visit);return search(node.left,lo,hi,visit)||search(node.right,lo,hi,visit);}
    const within=(v,r)=>v.reduce((n,x,i)=>n+(x-r.centre[i])**2,0)<=r.reach*r.reach+1e-20;
    function contains(point) {if(!validClaim(point))return false;const v=vector(point);return search(index,v,v,r=>within(v,r));}
    // Earliest contact along a great-circle segment. Altitude never permits a
    // bird or projectile to cross over safe land; light is a vertical refuge.
    function firstHit(a,b) {
      if(!validClaim(a)||!validClaim(b))return 0;
      const av=vector(a),bv=vector(b),chord=Math.hypot(...av.map((v,i)=>v-bv[i])),angle=2*Math.asin(Math.min(1,chord/2));
      if(angle<1e-12)return contains(a)?0:null;
      if(angle>=Math.PI-1e-8)return 0; // No ambiguous antipodal combat path.
      const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],normal=cross(av,bv),norm=Math.hypot(...normal);for(let i=0;i<3;i++)normal[i]/=norm;
      const tangent=cross(normal,av),sag=1-Math.cos(angle/2);
      const lo=av.map((v,i)=>Math.min(v,bv[i])-sag),hi=av.map((v,i)=>Math.max(v,bv[i])+sag);let hit=null;
      search(index,lo,hi,r=>{
        if(within(av,r)){hit=0;return true;}
        const x=dot(r.centre,av),y=dot(r.centre,tangent),length=Math.hypot(x,y),away=dot(r.centre,normal),remaining=Math.sin(r.angle)**2-away*away;
        if(r.angle<Math.PI/2&&remaining<0)return false;
        // sin² avoids subtracting cosines near 1, which misses centimetre-wide
        // tangencies to small camps at Earth scale.
        const offset=r.angle<Math.PI/2?Math.asin(Math.min(1,Math.sqrt(Math.max(0,remaining))/length)):Math.acos(Math.max(-1,Math.min(1,Math.cos(r.angle)/length))),phase=Math.atan2(y,x);
        for(const base of [phase-offset,phase+offset])for(const turn of [-2*Math.PI,0,2*Math.PI]){const theta=base+turn;if(theta>=-1e-12&&theta<=angle+1e-12){const t=Math.max(0,Math.min(1,theta/angle));hit=hit===null?t:Math.min(hit,t);}}
        if(hit===null&&within(bv,r))hit=1;
        return hit===0;
      });return hit;
    }
    return Object.freeze({circles,contains,firstHit});
  }

  return {
    EARTH_RADIUS_M,
    DEFAULT_TERRITORY_RADIUS_M,
    LIBERATED_GREEN,
    validClaim,
    validClaims,
    destination,
    territoryCircle,
    territoryFeatureCollection,
    claimFeatureCollection,
    claimBounds,
    createTerritoryLight
  };
});
