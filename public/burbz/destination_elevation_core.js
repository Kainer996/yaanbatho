/* Destination elevation core: Mapterhorn Terrarium512 route sampling for reward
 * quotes. Rendering exaggeration is deliberately ignored; samples are metres.
 */
(function(root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzDestinationElevationCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function(root) {
  'use strict';

  const VERSION = 1;
  const TILE_SIZE = 512;
  const DEFAULT_ZOOM = 13;
  const MAX_WEB_MERCATOR_LAT = 85.05112878;
  const PROVIDER = Object.freeze({
    id: 'mapterhorn-terrarium512',
    name: 'Mapterhorn Terrarium512',
    encoding: 'terrarium',
    units: 'metres',
    tileSize: TILE_SIZE,
    maxzoom: 13,
    attribution: 'Elevation (C) Mapterhorn'
  });

  function point(value) {
    if (value == null) return { lat: NaN, lon: NaN };
    return Array.isArray(value)
      ? { lat: Number(value[0]), lon: Number(value[1]) }
      : { lat: Number(value && value.lat), lon: Number(value && value.lon) };
  }
  function validPoint(value) {
    const p = point(value);
    return Number.isFinite(p.lat) && Number.isFinite(p.lon) && Math.abs(p.lat) <= MAX_WEB_MERCATOR_LAT && Math.abs(p.lon) <= 180;
  }
  function distance(a, b) {
    a = point(a); b = point(b);
    const r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r;
    const dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 12742000 * Math.asin(Math.sqrt(Math.min(1, h)));
  }
  function interpolate(a, b, t) {
    a = point(a); b = point(b);
    return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t };
  }
  function routeLengthM(points) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += distance(points[i - 1], points[i]);
    return total;
  }
  function sampleRoutePoints(points, spacingM) {
    const route = (points || []).map(point).filter(validPoint);
    if (route.length < 2) return [];
    const total = routeLengthM(route);
    const spacing = Math.max(20, Math.min(250, Number(spacingM) || 90));
    const count = Math.max(2, Math.min(160, Math.ceil(total / spacing) + 1));
    const out = [];
    let seg = 1, walkedBefore = 0, segStart = route[0], segEnd = route[1], segLen = distance(segStart, segEnd);
    for (let i = 0; i < count; i++) {
      const target = total * i / (count - 1);
      while (seg < route.length - 1 && walkedBefore + segLen < target) {
        walkedBefore += segLen;
        seg++;
        segStart = route[seg - 1];
        segEnd = route[seg];
        segLen = distance(segStart, segEnd);
      }
      const t = segLen ? Math.max(0, Math.min(1, (target - walkedBefore) / segLen)) : 0;
      out.push(interpolate(segStart, segEnd, t));
    }
    return out;
  }

  function lonLatToTile(lon, lat, z) {
    const n = 2 ** z;
    const clampedLat = Math.max(-MAX_WEB_MERCATOR_LAT, Math.min(MAX_WEB_MERCATOR_LAT, Number(lat)));
    const xFloat = (Number(lon) + 180) / 360 * n;
    const rad = clampedLat * Math.PI / 180;
    const yFloat = (1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2 * n;
    const x = Math.max(0, Math.min(n - 1, Math.floor(xFloat)));
    const y = Math.max(0, Math.min(n - 1, Math.floor(yFloat)));
    return {
      z,
      x,
      y,
      px: Math.max(0, Math.min(TILE_SIZE - 1, Math.floor((xFloat - x) * TILE_SIZE))),
      py: Math.max(0, Math.min(TILE_SIZE - 1, Math.floor((yFloat - y) * TILE_SIZE))),
      url: 'https://tiles.mapterhorn.com/' + z + '/' + x + '/' + y + '.webp'
    };
  }

  function decodeTerrariumPixel(r, g, b) {
    return (Number(r) * 256 + Number(g) + Number(b) / 256) - 32768;
  }
  function encodeTerrariumPixel(elevationM) {
    const value = Math.max(0, Math.min(65535.996, Number(elevationM) + 32768));
    const r = Math.floor(value / 256);
    const g = Math.floor(value - r * 256);
    const b = Math.round((value - Math.floor(value)) * 256);
    return [r, g, Math.max(0, Math.min(255, b)), 255];
  }
  function syntheticTerrariumTile(elevationM, opts) {
    opts = opts || {};
    const fn = typeof elevationM === 'function' ? elevationM : () => Number(elevationM) || 0;
    return {
      width: opts.width || TILE_SIZE,
      height: opts.height || TILE_SIZE,
      getPixel(x, y) { return encodeTerrariumPixel(fn(x, y)); }
    };
  }

  async function browserImageTileLoader(tile, opts) {
    opts = opts || {};
    const fetchFn = opts.fetchFn || (root && typeof root.fetch === 'function' ? root.fetch.bind(root) : null);
    if (!fetchFn) throw new Error('No fetch implementation for DEM tiles');
    const response = await fetchFn(tile.url, { signal: opts.signal });
    if (!response || !response.ok) throw new Error('DEM tile HTTP ' + (response && response.status));
    const blob = await response.blob();
    let bitmap;
    if (root && typeof root.createImageBitmap === 'function') bitmap = await root.createImageBitmap(blob);
    else throw new Error('No WebP image decoder available');
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(bitmap.width, bitmap.height)
      : root.document && root.document.createElement ? root.document.createElement('canvas') : null;
    if (!canvas) throw new Error('No canvas available for DEM decode');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0);
    return {
      width: bitmap.width,
      height: bitmap.height,
      getPixel(x, y) {
        const data = ctx.getImageData(Math.max(0, Math.min(bitmap.width - 1, x)), Math.max(0, Math.min(bitmap.height - 1, y)), 1, 1).data;
        return [data[0], data[1], data[2], data[3]];
      }
    };
  }

  function unavailable(reason, extra) {
    return Object.assign({
      available: false,
      reason: String(reason || 'Elevation unavailable'),
      ascentM: 0,
      descentM: 0,
      minElevationM: null,
      maxElevationM: null,
      samples: [],
      provenance: Object.assign({ provider: PROVIDER.name, status: 'unavailable', units: PROVIDER.units }, PROVIDER)
    }, extra || {});
  }

  async function sampleRouteElevation(points, opts) {
    opts = opts || {};
    const route = (points || []).map(point);
    if (route.length < 2 || route.some(p => !validPoint(p))) return unavailable('Route is outside supported DEM coordinates');
    const samplePoints = sampleRoutePoints(route, opts.spacingM);
    if (samplePoints.length < 2) return unavailable('Route is too short for elevation sampling');
    const z = Math.min(DEFAULT_ZOOM, Math.max(0, Number(opts.zoom) || DEFAULT_ZOOM));
    const loader = opts.tileLoader || browserImageTileLoader;
    const cache = new Map();
    const samples = [];
    try {
      for (const p of samplePoints) {
        if (opts.signal && opts.signal.aborted) return unavailable('Elevation request cancelled');
        const tile = lonLatToTile(p.lon, p.lat, z);
        const key = tile.z + '/' + tile.x + '/' + tile.y;
        if (!cache.has(key)) cache.set(key, Promise.resolve(loader(tile, opts)));
        const image = await cache.get(key);
        if (!image || typeof image.getPixel !== 'function') throw new Error('DEM tile decoder did not return pixels');
        const pixel = image.getPixel(tile.px, tile.py);
        if (!pixel || pixel.length < 3) throw new Error('DEM pixel missing RGB channels');
        const elevationM = decodeTerrariumPixel(pixel[0], pixel[1], pixel[2]);
        if (!Number.isFinite(elevationM)) throw new Error('DEM sample was not finite');
        samples.push({
          lat: p.lat,
          lon: p.lon,
          elevationM: Math.round(elevationM * 100) / 100,
          tile: { z: tile.z, x: tile.x, y: tile.y, px: tile.px, py: tile.py }
        });
      }
    } catch (err) {
      return unavailable(err && err.message || err, { sampleCount: samples.length, expectedSamples: samplePoints.length });
    }
    let ascent = 0, descent = 0;
    for (let i = 1; i < samples.length; i++) {
      const delta = samples[i].elevationM - samples[i - 1].elevationM;
      if (delta > 0.5) ascent += delta;
      else if (delta < -0.5) descent += -delta;
    }
    const elevations = samples.map(s => s.elevationM);
    return {
      available: true,
      reason: null,
      ascentM: Math.round(ascent),
      descentM: Math.round(descent),
      minElevationM: Math.min.apply(null, elevations),
      maxElevationM: Math.max.apply(null, elevations),
      samples,
      provenance: Object.assign({ provider: PROVIDER.name, status: 'measured', units: PROVIDER.units, sampleCount: samples.length, zoom: z }, PROVIDER)
    };
  }

  return {
    VERSION,
    PROVIDER: Object.assign({}, PROVIDER),
    TILE_SIZE,
    DEFAULT_ZOOM,
    decodeTerrariumPixel,
    encodeTerrariumPixel,
    syntheticTerrariumTile,
    lonLatToTile,
    sampleRoutePoints,
    sampleRouteElevation,
    routeLengthM
  };
});
