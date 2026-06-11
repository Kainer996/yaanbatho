/**
 * LUMENFORM WORLD v20
 * Builds the spaceman's environment: floor deck, props, lift cable,
 * a scroll-driven lift cage + counterweight, and spinning cogs.
 *
 * Scroll is the machine: scrolling the page turns the cogs, runs the
 * cables, and physically moves the lift cage between floor and header.
 *
 * Exposes window.LumenWorld for the mascot:
 *   floorSurface()  — viewport Y of the floor top (feet line)
 *   headerSurface() — viewport Y of the header red line (feet line)
 *   liftInfo()      — { x, surfaceY, atFloor, atHeader } of the cage deck
 */
(function () {
  'use strict';

  var FLOOR_H = 22;
  var LIFT_W = 64;
  var LIFT_LEFT = 6;
  var DECK_H = 10;          // cage deck plate height
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cogSpinEls = [];      // gear <g> elements that spin with scroll
  var cogAngle = 0;
  var lastScrollY = window.scrollY;
  var liftEl, counterEl, megaGearEl;
  var liftSurfaceY = 0;     // current viewport Y of the cage deck top
  var targetProgress = 0, smoothProgress = 0;

  // ─── GEAR SVG ───────────────────────────────────────────────────────────────
  function buildGearPath(teeth, outerR, innerR) {
    var d = '';
    for (var i = 0; i < teeth; i++) {
      var toothSpan = 0.28;
      var a1 = (i / teeth) * Math.PI * 2 - toothSpan;
      var a2 = (i / teeth) * Math.PI * 2 + toothSpan;
      var ai1 = (i / teeth) * Math.PI * 2 - toothSpan * 0.5 + Math.PI / teeth;
      var ai2 = (i / teeth) * Math.PI * 2 + toothSpan * 0.5 + Math.PI / teeth;
      if (i === 0) d += 'M' + (Math.cos(a1) * outerR).toFixed(2) + ' ' + (Math.sin(a1) * outerR).toFixed(2) + ' ';
      d += 'L' + (Math.cos(a1) * outerR).toFixed(2) + ' ' + (Math.sin(a1) * outerR).toFixed(2) + ' ';
      d += 'L' + (Math.cos(a2) * outerR).toFixed(2) + ' ' + (Math.sin(a2) * outerR).toFixed(2) + ' ';
      d += 'L' + (Math.cos(ai1) * innerR).toFixed(2) + ' ' + (Math.sin(ai1) * innerR).toFixed(2) + ' ';
      d += 'L' + (Math.cos(ai2) * innerR).toFixed(2) + ' ' + (Math.sin(ai2) * innerR).toFixed(2) + ' ';
    }
    return d + 'Z';
  }

  function makeCogSVG(size, opts) {
    opts = opts || {};
    var r = size / 2;
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', (-r) + ' ' + (-r) + ' ' + size + ' ' + size);

    var spin = document.createElementNS(ns, 'g');

    var gear = document.createElementNS(ns, 'path');
    gear.setAttribute('d', buildGearPath(opts.teeth || 10, r * 0.95, r * 0.68));
    gear.setAttribute('fill', opts.fill || '#666');
    gear.setAttribute('stroke', opts.stroke || '#333');
    gear.setAttribute('stroke-width', '1');
    spin.appendChild(gear);

    // spokes
    for (var s = 0; s < 3; s++) {
      var spoke = document.createElementNS(ns, 'rect');
      spoke.setAttribute('x', String(-r * 0.06));
      spoke.setAttribute('y', String(-r * 0.6));
      spoke.setAttribute('width', String(r * 0.12));
      spoke.setAttribute('height', String(r * 1.2));
      spoke.setAttribute('fill', opts.spoke || '#555');
      spoke.setAttribute('transform', 'rotate(' + (s * 60) + ')');
      spin.appendChild(spoke);
    }

    var hub = document.createElementNS(ns, 'circle');
    hub.setAttribute('r', (r * 0.28).toFixed(1));
    hub.setAttribute('fill', opts.hub || '#cc0000');
    hub.setAttribute('stroke', '#880000');
    hub.setAttribute('stroke-width', '1.5');
    spin.appendChild(hub);

    var axle = document.createElementNS(ns, 'circle');
    axle.setAttribute('r', (r * 0.12).toFixed(1));
    axle.setAttribute('fill', '#1a1a1a');
    spin.appendChild(axle);

    svg.appendChild(spin);
    return { svg: svg, spin: spin };
  }

  // ─── GEOMETRY ────────────────────────────────────────────────────────────────
  function floorSurface() {
    return window.innerHeight - FLOOR_H;
  }

  function headerSurface() {
    var h = document.querySelector('header');
    return h ? h.getBoundingClientRect().bottom : 70;
  }

  function scrollProgress() {
    var max = document.documentElement.scrollHeight - window.innerHeight;
    if (max <= 0) return 0;
    return Math.min(1, Math.max(0, window.scrollY / max));
  }

  // ─── BUILD ───────────────────────────────────────────────────────────────────
  function build() {
    var frag = document.createDocumentFragment();

    function div(cls, id, html) {
      var d = document.createElement('div');
      if (cls) d.className = cls;
      if (id) d.id = id;
      if (html) d.innerHTML = html;
      d.setAttribute('aria-hidden', 'true');
      frag.appendChild(d);
      return d;
    }

    // floor + cables
    div(null, 'lf-floor');
    div('lf-cable lf-cable-main');
    div('lf-cable lf-cable-counter');

    // lift cage
    liftEl = div(null, 'lf-lift',
      '<div class="lift-hanger"></div>' +
      '<div class="lift-rail left"></div>' +
      '<div class="lift-rail right"></div>' +
      '<div class="lift-bar"></div>' +
      '<div class="lift-lamp"></div>' +
      '<div class="lift-deck"></div>');

    counterEl = div(null, 'lf-counterweight');

    // props
    div('lf-prop lf-crates', null, '<div class="crate a"></div><div class="crate b"></div><div class="crate c"></div>');
    div('lf-prop lf-baysign', null, 'BAY 01 · <b>LUMENFORM</b> WORKS');
    div('lf-prop lf-vent', null, '<div class="fan"></div>');
    div('lf-prop lf-pipes');
    div('lf-prop lf-beacon');
    div('lf-prop lf-door', null, '<div class="door-glow"></div>');

    document.body.appendChild(frag);

    // cogs driving the main cable: top of cable + floor level
    addCog(26, LIFT_LEFT + LIFT_W / 2 + 15, { top: 2 });
    addCog(26, LIFT_LEFT + LIFT_W / 2 + 15, { bottom: FLOOR_H });
    // small idler cog meshing on the counterweight cable
    addCog(16, 49, { top: 30 });

    // big ambient gear behind content
    megaGearEl = document.createElement('div');
    megaGearEl.id = 'lf-megagear';
    megaGearEl.setAttribute('aria-hidden', 'true');
    var mega = makeCogSVG(340, { teeth: 14, fill: '#f0f0f0', stroke: '#888', spoke: '#aaa', hub: '#cc0000' });
    mega.svg.setAttribute('width', '340');
    mega.svg.setAttribute('height', '340');
    megaGearEl.appendChild(mega.svg);
    cogSpinEls.push({ el: mega.spin, dir: 1, rate: 0.18 });
    document.body.appendChild(megaGearEl);

    placeLift(true);
  }

  function addCog(size, centerX, pin) {
    var wrap = document.createElement('div');
    wrap.className = 'lf-cog';
    wrap.setAttribute('aria-hidden', 'true');
    var css = 'left:' + (centerX - size / 2) + 'px;width:' + size + 'px;height:' + size + 'px;';
    if (pin.top !== undefined) css += 'top:' + pin.top + 'px;';
    if (pin.bottom !== undefined) css += 'bottom:' + pin.bottom + 'px;';
    wrap.style.cssText += css;
    var cog = makeCogSVG(size, {});
    wrap.appendChild(cog.svg);
    cogSpinEls.push({ el: cog.spin, dir: size > 20 ? -1 : 1, rate: 1 });
    document.body.appendChild(wrap);
  }

  // ─── LIFT MOVEMENT ──────────────────────────────────────────────────────────
  // progress 0 (page top) → cage parked at floor; progress 1 → cage at header.
  function placeLift(immediate) {
    targetProgress = scrollProgress();
    if (immediate) smoothProgress = targetProgress;

    var fs = floorSurface();
    var hs = headerSurface();
    var top = fs - (fs - hs) * smoothProgress;   // cage deck-top Y
    liftSurfaceY = top;

    // liftEl is 58px tall with deck at its bottom; deck top = elTop + 58 - DECK_H
    liftEl.style.transform = 'translateY(' + Math.round(top - 58 + DECK_H) + 'px)';

    // counterweight runs the opposite way
    var cwTop = hs + 10 + (fs - hs - 60) * smoothProgress;
    counterEl.style.transform = 'translateY(' + Math.round(cwTop) + 'px)';
  }

  // ─── SCROLL → SPIN ──────────────────────────────────────────────────────────
  function onScroll() {
    var delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    cogAngle += delta * 0.9;
  }

  function frame() {
    targetProgress = scrollProgress();
    smoothProgress += (targetProgress - smoothProgress) * 0.08;
    if (Math.abs(targetProgress - smoothProgress) < 0.0004) smoothProgress = targetProgress;
    placeLift();

    if (!reduceMotion) {
      for (var i = 0; i < cogSpinEls.length; i++) {
        var c = cogSpinEls[i];
        c.el.setAttribute('transform', 'rotate(' + (cogAngle * c.dir * c.rate) + ')');
      }
      var cables = document.querySelectorAll('.lf-cable');
      for (var j = 0; j < cables.length; j++) {
        cables[j].style.backgroundPosition = '0 ' + ((window.scrollY * 0.5) % 14) + 'px';
      }
    }
    requestAnimationFrame(frame);
  }

  // ─── PUBLIC API ─────────────────────────────────────────────────────────────
  window.LumenWorld = {
    FLOOR_H: FLOOR_H,
    floorSurface: floorSurface,
    headerSurface: headerSurface,
    liftInfo: function () {
      return {
        x: LIFT_LEFT + LIFT_W / 2,            // cage centre X
        surfaceY: liftSurfaceY,               // deck top (feet line)
        atFloor: Math.abs(liftSurfaceY - floorSurface()) < 14,
        atHeader: Math.abs(liftSurfaceY - headerSurface()) < 14
      };
    }
  };

  // ─── INIT ───────────────────────────────────────────────────────────────────
  function init() {
    build();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', function () { placeLift(true); });
    requestAnimationFrame(frame);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
