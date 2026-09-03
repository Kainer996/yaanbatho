// Burbz Building Interior Core — generated-building-interiors-v344-20260902.
//
// The old v341 core drew every room as a programmatic SVG placeholder. The
// governor's fifteen buildings now open onto full, image-model-painted Burbz
// environments. This small pure core owns the roster, safe state clamping and
// deterministic art selection; index.html owns the live state and controls.
(function(root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzBuildingInteriorCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  const INTERIOR_IDS = Object.freeze([
    'cabin', 'hut', 'farm', 'well', 'lumberhut', 'minehut', 'cottages',
    'tavern', 'chapel', 'lumber', 'quarry', 'market', 'storehouse',
    'foundry', 'entertainment'
  ]);

  const ART_ROOT = 'assets/building-interiors-manga/';
  const INTERIOR_ART = Object.freeze(INTERIOR_IDS.reduce(function(paths, id) {
    paths[id] = ART_ROOT + id + '.webp';
    return paths;
  }, Object.create(null)));
  const PLOT_ART = ART_ROOT + 'plot.webp';
  const ART_PATHS = Object.freeze(INTERIOR_IDS.map(function(id) {
    return INTERIOR_ART[id];
  }).concat(PLOT_ART));

  function finiteNumber(value, fallback) {
    const number = Number(value);
    return isFinite(number) ? number : fallback;
  }

  function clamp(value, low, high) {
    return Math.max(low, Math.min(high, value));
  }

  function interiorView(buildingId, facts) {
    const f = facts || {};
    const id = INTERIOR_IDS.indexOf(buildingId) !== -1 ? buildingId : 'plot';
    const maxLevel = Math.max(1, Math.floor(finiteNumber(f.maxLevel, 3)));
    const level = clamp(Math.floor(finiteNumber(f.level, 0)), 0, maxLevel);
    const needed = Math.max(0, Math.floor(finiteNumber(f.workersNeeded, 0)));
    const posted = clamp(Math.floor(finiteNumber(f.workersPosted, 0)), 0, needed);
    const storeFill = clamp(finiteNumber(f.storeFill, 0), 0, 1);
    return {
      id: id,
      level: level,
      maxLevel: maxLevel,
      plot: level <= 0,
      rising: !!f.rising,
      workers: { posted: posted, needed: needed },
      storeFill: storeFill
    };
  }

  function normalizeView(view) {
    return view && view.workers && typeof view.plot === 'boolean'
      ? view
      : interiorView(view && view.id, view);
  }

  function imagePath(view) {
    const v = normalizeView(view);
    return v.plot ? PLOT_ART : (INTERIOR_ART[v.id] || PLOT_ART);
  }

  function escapeAttribute(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // A full-bleed painting plus restrained, state-aware atmosphere. CSS uses
  // the data attributes for level warmth, water/fire glints and construction
  // dust; the real crew and store numbers remain plainly stated below the art.
  function sceneHTML(view, label) {
    const v = normalizeView(view);
    const safeLabel = escapeAttribute(label || 'Building interior');
    const storePercent = Math.round(v.storeFill * 100);
    const classes = [
      'bi-scene-art-wrap',
      'is-' + (v.plot ? 'plot' : v.id),
      'is-level-' + v.level
    ];
    if (v.rising) classes.push('is-rising');
    const construction = v.rising
      ? '<span class="bi-scene-rising" aria-label="Upgrade under construction"></span>'
      : '';
    return '<div class="' + classes.join(' ') + '" data-interior-id="' +
      escapeAttribute(v.id) + '" data-level="' + v.level + '" data-workers="' +
      v.workers.posted + '/' + v.workers.needed + '" data-store-fill="' +
      storePercent + '" style="--bi-store-fill:' + storePercent + '%">' +
      '<img class="bi-scene bi-scene-art" src="' + imagePath(v) + '" alt="' +
      safeLabel + '" width="1448" height="1086" decoding="async">' +
      '<span class="bi-scene-glow" aria-hidden="true"></span>' +
      construction +
      '<span class="bi-scene-vignette" aria-hidden="true"></span>' +
      '</div>';
  }

  return {
    INTERIOR_IDS: INTERIOR_IDS,
    INTERIOR_ART: INTERIOR_ART,
    PLOT_ART: PLOT_ART,
    ART_PATHS: ART_PATHS,
    interiorView: interiorView,
    imagePath: imagePath,
    sceneHTML: sceneHTML
  };
});
