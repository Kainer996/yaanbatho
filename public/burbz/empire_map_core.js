/* Burbz Empire Map Core — pure GeoJSON helpers for captured territory. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzEmpireMapCore = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  const EARTH_RADIUS_M = 6371008.8;
  const DEFAULT_TERRITORY_RADIUS_M = 2200;
  const GOLD = '#f0c767';

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
    return [((lambda2 * 180 / Math.PI + 540) % 360) - 180, phi2 * 180 / Math.PI];
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
        name: String(village.name || 'Captured territory'),
        claimedAt: village.claimedAt || '',
        radiusM: radius,
        color: GOLD
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
        properties: { seed: Number(v.seed) || 0, name: String(v.name || 'Captured village'), claimedAt: v.claimedAt || '' },
        geometry: { type: 'Point', coordinates: [Number(v.lon), Number(v.lat)] }
      }))
    };
  }

  function claimBounds(villages) {
    const claims = validClaims(villages);
    if (!claims.length) return null;
    let west = Infinity, south = Infinity, east = -Infinity, north = -Infinity;
    claims.forEach(v => {
      const lat = Number(v.lat), lon = Number(v.lon);
      west = Math.min(west, lon); south = Math.min(south, lat);
      east = Math.max(east, lon); north = Math.max(north, lat);
    });
    return [[west, south], [east, north]];
  }

  return {
    EARTH_RADIUS_M,
    DEFAULT_TERRITORY_RADIUS_M,
    GOLD,
    validClaim,
    validClaims,
    destination,
    territoryCircle,
    territoryFeatureCollection,
    claimFeatureCollection,
    claimBounds
  };
});
