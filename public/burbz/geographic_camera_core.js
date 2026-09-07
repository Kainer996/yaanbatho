/* Screen-space framing only: no map, DOM, route mutation, or save access. */
(function (root, factory) {
  'use strict';
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.BurbzGeographicCameraCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function rectangle(value) {
    if (!value) return null;
    const left = value.left === undefined ? 0 : value.left;
    const top = value.top === undefined ? 0 : value.top;
    const right = value.right === undefined ? left + value.width : value.right;
    const bottom = value.bottom === undefined ? top + value.height : value.bottom;
    if (![left, top, right, bottom].every(Number.isFinite) || right <= left || bottom <= top) return null;
    return { left, top, right, bottom, width:right - left, height:bottom - top };
  }

  function nonnegative(value, fallback) {
    return Number.isFinite(value) ? Math.max(0, value) : fallback;
  }

  /** All rectangles use the same map-relative CSS-pixel coordinates.
   * Returns the largest rectangle avoiding the padded occluders, or null if
   * none remains. Measure actual card/controls after layout, including themes.
   * Use padding/gap to reserve route stroke and marker extents as appropriate.
   */
  function visibleRect(viewport, options) {
    const outer = rectangle(viewport);
    if (!outer) return null;
    const opts = options || {};
    const rawPadding = opts.padding || 0;
    const padding = typeof rawPadding === 'number'
      ? { left:rawPadding, top:rawPadding, right:rawPadding, bottom:rawPadding }
      : rawPadding;
    const area = rectangle({
      left:outer.left + nonnegative(padding.left, 0),
      top:outer.top + nonnegative(padding.top, 0),
      right:outer.right - nonnegative(padding.right, 0),
      bottom:outer.bottom - nonnegative(padding.bottom, 0)
    });
    if (!area) return null;
    const gap = nonnegative(opts.gap, 0);
    const obstacles = (Array.isArray(opts.occluders) ? opts.occluders : []).map(rectangle).filter(Boolean).map(item => rectangle({
      left:Math.max(area.left, item.left - gap),
      top:Math.max(area.top, item.top - gap),
      right:Math.min(area.right, item.right + gap),
      bottom:Math.min(area.bottom, item.bottom + gap)
    })).filter(Boolean);
    if (!obstacles.length) return area;
    const xs = Array.from(new Set([area.left, area.right].concat(obstacles.flatMap(item => [item.left, item.right])))).sort((a, b) => a - b);
    let best = null, bestArea = 0, bestDistance = Infinity;
    const centerX = (area.left + area.right) / 2, centerY = (area.top + area.bottom) / 2;
    function consider(left, top, right, bottom) {
      const candidate = rectangle({left, top, right, bottom});
      if (!candidate) return;
      const size = candidate.width * candidate.height;
      const distance = Math.hypot((left + right) / 2 - centerX, (top + bottom) / 2 - centerY);
      if (size > bestArea || (size === bestArea && distance < bestDistance)) {
        best = candidate;
        bestArea = size;
        bestDistance = distance;
      }
    }
    // For each pair of obstacle edges, merge blocked vertical intervals.
    // Any maximal empty rectangle has edges on these boundaries.
    for (let leftIndex = 0; leftIndex < xs.length - 1; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < xs.length; rightIndex++) {
        const left = xs[leftIndex], right = xs[rightIndex];
        const blocked = obstacles.filter(item => item.left < right && item.right > left).sort((a, b) => a.top - b.top);
        let top = area.top;
        blocked.forEach(item => {
          if (item.top > top) consider(left, top, right, item.top);
          top = Math.max(top, item.bottom);
        });
        if (top < area.bottom) consider(left, top, right, area.bottom);
      }
    }
    return best;
  }

  /** Inspect every projected vertex, including repeated return-leg points.
   * Invalid projections invalidate the whole result; never drop a vertex to
   * make an incomplete route appear to fit.
   */
  function projectedBounds(points) {
    if (!Array.isArray(points) || !points.length) return null;
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity;
    for (const point of points) {
      const x = Array.isArray(point) ? point[0] : point && point.x;
      const y = Array.isArray(point) ? point[1] : point && point.y;
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x); bottom = Math.max(bottom, y);
    }
    return { left, top, right, bottom, width:right - left, height:bottom - top, count:points.length };
  }

  /** Request one correction, then reproject before requesting the next.
   * - zoom-out: change zoom only, preserving center; projected scale is an
   *   approximation under perspective, so corrections are bounded.
   * - pan: screenShift moves route CONTENT by [dx,dy] CSS pixels. With zero
   *   camera padding, unproject(viewportCenter - screenShift) yields the new
   *   camera center. Reproject afterward because terrain is not a flat plane.
   * The caller owns iteration limits, terrain readiness, current-selection
   * guards, and a lower-pitch fallback if this cannot converge.
   */
  function frameCorrection(points, viewport, options) {
    const area = rectangle(viewport);
    const bounds = projectedBounds(points);
    const base = { zoomDelta:0, screenShift:[0, 0], bounds };
    if (!area) return Object.assign(base, { status:'invalid', reason:'no-visible-area' });
    if (!bounds) return Object.assign(base, { status:'invalid', reason:Array.isArray(points) && !points.length ? 'no-points' : 'invalid-projection' });
    const opts = options || {};
    const tolerance = nonnegative(opts.tolerance, 1);
    if (bounds.left >= area.left - tolerance && bounds.right <= area.right + tolerance &&
        bounds.top >= area.top - tolerance && bounds.bottom <= area.bottom + tolerance) {
      return Object.assign(base, { status:'fit' });
    }
    const ratio = Math.max(bounds.width / (area.width + 2 * tolerance), bounds.height / (area.height + 2 * tolerance));
    if (ratio > 1) {
      const maximum = Math.max(.01, nonnegative(opts.maxZoomOutStep, 1.25));
      const minimum = Math.min(maximum, Math.max(.01, nonnegative(opts.minZoomOutStep, .06)));
      return Object.assign(base, { status:'zoom-out', zoomDelta:-Math.min(maximum, Math.max(minimum, Math.log2(ratio) + .045)) });
    }
    // Centre only axes that overflow. Already visible axes retain their
    // framing, avoiding unnecessary motion on long, narrow walk profiles.
    const dx = bounds.left < area.left - tolerance || bounds.right > area.right + tolerance
      ? (area.left + area.right - bounds.left - bounds.right) / 2 : 0;
    const dy = bounds.top < area.top - tolerance || bounds.bottom > area.bottom + tolerance
      ? (area.top + area.bottom - bounds.top - bounds.bottom) / 2 : 0;
    return Object.assign(base, { status:'pan', screenShift:[dx, dy] });
  }

  return Object.freeze({ visibleRect, projectedBounds, frameCorrection });
});
