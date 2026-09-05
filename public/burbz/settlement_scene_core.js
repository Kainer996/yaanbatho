// BURBZ — pure scene policy for the 3D village and town views.
//
// The renderer owns Three.js and the DOM. This core owns the decisions that
// should remain deterministic and cheap to test: device quality, label
// selection, render-loop visibility and reduced-motion scaling.
(function (root) {
  'use strict';

  // Every tier opens sharp: full-rate frames and the same 2x pixel ceiling the
  // scenes shipped with before v281. A phone is not a weak device — only a
  // measured slow device is, and adaptDetail() softens exactly those, live.
  var QUALITY = {
    low: {
      maxDpr: 1.75,
      shadowSize: 1024,
      frameInterval: 0,
      maxAmbientActors: 14,
      maxLabels: 3
    },
    medium: {
      maxDpr: 2,
      shadowSize: 1536,
      frameInterval: 0,
      maxAmbientActors: 24,
      maxLabels: 6
    },
    high: {
      maxDpr: 2,
      shadowSize: 2048,
      frameInterval: 0,
      maxAmbientActors: 40,
      maxLabels: 8
    }
  };

  function finiteNumber(value, fallback) {
    var number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function positiveNumber(value, fallback) {
    var number = finiteNumber(value, fallback);
    return number > 0 ? number : fallback;
  }

  // Device buckets deliberately use broad thresholds. A profile must not
  // oscillate when a browser bar changes the viewport by a few pixels — and a
  // small screen must never be read as a slow chip. The v281 profile bucketed
  // every phone into "low" by its width alone, which blurred the render to
  // 1.25x and capped it at 30fps on hardware that runs the scene at 60 easily.
  // Tier now follows the chip (cores, reported memory); the screen plays no
  // part. Devices the buckets misjudge are corrected live by adaptDetail().
  function qualityProfile(input) {
    input = input || {};
    var width = positiveNumber(input.width, 390);
    var height = positiveNumber(input.height, 700);
    var dpr = Math.max(1, positiveNumber(input.dpr, 1));
    var cores = Math.max(1, Math.floor(positiveNumber(input.hardwareConcurrency, 4)));
    var memory = finiteNumber(input.deviceMemory, 0); // GB; 0 = browser keeps it private
    var reduced = !!input.reducedMotion;
    var shortSide = Math.min(width, height);
    var area = width * height;

    var tier = 'medium';
    if (cores <= 3 || (memory > 0 && memory <= 2)) {
      tier = 'low';
    } else if (cores >= 8 && shortSide >= 700 && area >= 700000) {
      tier = 'high';
    }

    var base = QUALITY[tier];
    return {
      tier: tier,
      maxDpr: base.maxDpr,
      shadowSize: base.shadowSize,
      // Reduced motion removes ambient actors and slows redraws, while keeping
      // crisp static scenery and the tier's useful label capacity.
      frameInterval: reduced ? Math.max(33, base.frameInterval) : base.frameInterval,
      maxAmbientActors: reduced ? 0 : base.maxAmbientActors,
      maxLabels: base.maxLabels
    };
  }

  function numberFrom(source, first, second) {
    if (source && Number.isFinite(Number(source[first]))) return Number(source[first]);
    if (source && second && Number.isFinite(Number(source[second]))) return Number(source[second]);
    return NaN;
  }

  // Candidates may put their rectangle directly on the label or in `rect`.
  // x/y are top-left screen pixels. right/bottom are accepted as an alternative
  // to width/height so callers can pass getBoundingClientRect-like records.
  function candidateRect(candidate) {
    var source = candidate && (candidate.rect || candidate.bounds || candidate);
    if (!source) return null;
    var x = numberFrom(source, 'x', 'left');
    var y = numberFrom(source, 'y', 'top');
    var width = numberFrom(source, 'width');
    var height = numberFrom(source, 'height');
    if (!Number.isFinite(width)) {
      var right = numberFrom(source, 'right');
      if (Number.isFinite(x) && Number.isFinite(right)) width = right - x;
    }
    if (!Number.isFinite(height)) {
      var bottom = numberFrom(source, 'bottom');
      if (Number.isFinite(y) && Number.isFinite(bottom)) height = bottom - y;
    }
    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return null;
    return { left: x, top: y, right: x + width, bottom: y + height };
  }

  function sameId(a, b) {
    return a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);
  }

  function labelIsVisible(candidate) {
    return !!candidate && candidate.hidden !== true && candidate.visible !== false &&
      candidate.offscreen !== true && candidate.behindCamera !== true && candidate.inViewport !== false;
  }

  function insideStage(rect, width, height, padding) {
    return rect.left >= padding && rect.top >= padding &&
      rect.right <= width - padding && rect.bottom <= height - padding;
  }

  function rectanglesCollide(a, b, gap) {
    return !(a.right + gap <= b.left || b.right + gap <= a.left ||
      a.bottom + gap <= b.top || b.bottom + gap <= a.top);
  }

  // Choose a small readable set of screen-space labels. The returned entries
  // are the original candidate objects, in deterministic winning order; the
  // input array and its objects are never mutated.
  function selectSceneLabels(candidates, options) {
    candidates = Array.isArray(candidates) ? candidates : [];
    options = options || {};
    var width = positiveNumber(options.width, 0);
    var height = positiveNumber(options.height, 0);
    if (!width || !height || !candidates.length) return [];
    var padding = Math.max(0, finiteNumber(options.padding, 0));
    var gap = Math.max(0, finiteNumber(options.gap, 0));
    var maxLabels = Number.isFinite(Number(options.maxLabels))
      ? Math.max(0, Math.floor(Number(options.maxLabels)))
      : candidates.length;
    if (!maxLabels) return [];

    var ranked = [];
    candidates.forEach(function (candidate, index) {
      if (!labelIsVisible(candidate)) return;
      var rect = candidateRect(candidate);
      if (!rect || !insideStage(rect, width, height, padding)) return;
      ranked.push({
        candidate: candidate,
        rect: rect,
        index: index,
        selected: sameId(candidate.id, options.selectedId) ? 1 : 0,
        priority: finiteNumber(candidate.priority, 0),
        distance: Math.max(0, finiteNumber(candidate.distance, Infinity))
      });
    });

    ranked.sort(function (a, b) {
      if (a.selected !== b.selected) return b.selected - a.selected;
      if (a.priority !== b.priority) return b.priority - a.priority;
      if (a.distance !== b.distance) return a.distance - b.distance;
      return a.index - b.index;
    });

    var accepted = [];
    for (var i = 0; i < ranked.length && accepted.length < maxLabels; i++) {
      var entry = ranked[i];
      var collision = false;
      for (var j = 0; j < accepted.length; j++) {
        if (rectanglesCollide(entry.rect, accepted[j].rect, gap)) {
          collision = true;
          break;
        }
      }
      if (!collision) accepted.push(entry);
    }
    return accepted.map(function (entry) { return entry.candidate; });
  }

  // Live detail governor. The renderer reports how long its frames actually
  // took; this decides the render resolution. Sharp until the device proves
  // slow, softened only as far as it must be, and sharpened again the moment
  // the load lifts. Pure: same sample in, same decision out.
  var ADAPT_MIN_FRAMES = 24;      // don't judge a stutter, judge a stretch
  var ADAPT_SLOW_MS = 22;         // sustained missed 16.7ms budget → reduce fill cost
  var ADAPT_FAST_MS = 16.9;       // a steady 60Hz stretch can recover detail
  var ADAPT_STEP = 0.25;
  function adaptDetail(state, sample) {
    state = state || {};
    sample = sample || {};
    var minDpr = Math.max(0.75, positiveNumber(state.minDpr, 1));
    var maxDpr = Math.max(minDpr, positiveNumber(state.maxDpr, 2));
    var dpr = Math.min(maxDpr, Math.max(minDpr, positiveNumber(state.dpr, maxDpr)));
    var frames = Math.max(0, Math.floor(finiteNumber(sample.frames, 0)));
    var avg = finiteNumber(sample.avgFrameMs, NaN);
    const sustainedStall = frames >= 8 && avg > 80;
    if ((frames < ADAPT_MIN_FRAMES && !sustainedStall) || !Number.isFinite(avg)) return { dpr: dpr, changed: false };
    if (avg > ADAPT_SLOW_MS && dpr > minDpr) return { dpr: Math.max(minDpr, dpr - ADAPT_STEP), changed: true };
    if (avg < ADAPT_FAST_MS && dpr < maxDpr) return { dpr: Math.min(maxDpr, dpr + ADAPT_STEP), changed: true };
    return { dpr: dpr, changed: false };
  }

  function shouldRunScene(state) {
    state = state || {};
    return !!state.screenActive && !!state.detailsOpen && !!state.inViewport && !state.documentHidden;
  }

  function motionScale(reducedMotion) {
    return reducedMotion ? 0 : 1;
  }

  var api = {
    qualityProfile: qualityProfile,
    adaptDetail: adaptDetail,
    selectSceneLabels: selectSceneLabels,
    shouldRunScene: shouldRunScene,
    motionScale: motionScale
  };
  root.BurbzSettlementSceneCore = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
