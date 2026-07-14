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
    claimBounds
  };
});
