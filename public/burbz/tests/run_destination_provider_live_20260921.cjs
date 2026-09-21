'use strict';

const fs = require('node:fs');
const path = require('node:path');
const route = require('../destination_route_core.js');

const OUT = process.argv[2] || process.env.DESTINATION_ROUTE_EVIDENCE || '';
const START = { lat: 51.50684, lon: -0.16490 };
const END = { lat: 51.50788, lon: -0.16246 };

async function labeledFailures() {
  const fake = async (status, body) => route.fetchDestinationRoute(START, END, {
    fetchFn: async () => ({
      ok: status >= 200 && status < 300,
      status,
      headers: { get: () => null },
      text: async () => body
    }),
    endpoints: ['https://example.invalid/overpass'],
    timeoutMs: 1000
  });
  const ctrl = new AbortController();
  ctrl.abort();
  const cases = {
    html: await fake(200, '<html>rate page</html>'),
    rateLimit: await fake(429, 'Too many requests'),
    partial: await fake(200, JSON.stringify({ remark: 'runtime error: partial data', elements: [] })),
    cancel: await route.fetchDestinationRoute(START, END, {
      fetchFn: async () => { throw new Error('should not fetch'); },
      endpoints: ['https://example.invalid/overpass'],
      signal: ctrl.signal
    })
  };
  return Object.fromEntries(Object.entries(cases).map(([name, result]) => [name, result.error && result.error.code]));
}

async function mapterhornProof(points) {
  let chromium;
  try {
    chromium = require('/home/ubuntu/node_modules/playwright').chromium;
  } catch (err) {
    return { ok: false, error: 'playwright unavailable: ' + err.message };
  }
  const browser = await chromium.launch({
    executablePath: '/root/.cache/ms-playwright/chromium-1208/chrome-linux64/chrome',
    headless: true
  });
  try {
    const page = await browser.newPage();
    await page.addScriptTag({ path: path.join(__dirname, '..', 'destination_elevation_core.js') });
    return await page.evaluate(async routePoints => {
      const api = window.BurbzDestinationElevationCore;
      const result = await api.sampleRouteElevation(routePoints, { spacingM: 90, timeoutMs: 12000 });
      return {
        ok: result.available === true,
        available: result.available,
        reason: result.reason,
        ascentM: result.ascentM,
        descentM: result.descentM,
        sampleCount: result.samples.length,
        firstSample: result.samples[0] || null,
        provenance: result.provenance
      };
    }, points);
  } finally {
    await browser.close();
  }
}

(async () => {
  const startedAt = new Date().toISOString();
  const providerResult = await route.fetchDestinationRoute(START, END, {
    endpoints: [
      'https://overpass-api.de/api/interpreter',
      'https://overpass.private.coffee/api/interpreter',
      'https://maps.mail.ru/osm/tools/overpass/api/interpreter'
    ],
    timeoutMs: 20000,
    minRouteM: 25,
    maxEndpointSnapM: 35,
    queryPaddingM: 260
  });
  const failures = await labeledFailures();
  const elevation = providerResult.ok ? await mapterhornProof(providerResult.route.points) : { ok: false, error: 'route provider failed' };
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    selectedEndpoints: { start: START, end: END },
    provider: providerResult.provider || null,
    route: providerResult.ok ? {
      ok: true,
      lengthM: providerResult.route.lengthM,
      pointCount: providerResult.route.points.length,
      wayCount: providerResult.route.routeEvidence.ways.length,
      nodeCount: providerResult.route.routeEvidence.nodes.length,
      segmentCount: providerResult.route.routeEvidence.segments.length,
      fingerprint: providerResult.route.routeFingerprint,
      validation: route.validateDestinationRoute(providerResult.route),
      projections: providerResult.route.projections,
      firstWayIds: providerResult.route.routeEvidence.ways.slice(0, 5).map(w => w.id),
      firstPoints: providerResult.route.points.slice(0, 5)
    } : { ok: false, error: providerResult.error },
    labeledFailures: failures,
    elevation
  };
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (!providerResult.ok) process.exit(2);
  if (!elevation.ok) process.exit(3);
})().catch(err => {
  console.error(err && err.stack || err);
  process.exit(1);
});
