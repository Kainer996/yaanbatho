/* Spaceman Mascot v10
 * Two platforms: header bottom-border and above the MUSIC button.
 * Uses position:fixed; style.top to position the character.
 */
(function () {
  'use strict';

  /* ---- Config ---- */
  var CFG = {
    charW: 40,
    charH: 80,
    speed: 0.8,           // px per frame
    faceImg: 'images/logo.png',  // face inside helmet
    idleTime: 2000,       // ms to pause at edges
    jumpDuration: 600,    // ms for platform jump
    fps: 60,
  };

  /* ---- State ---- */
  var el = null;          // DOM element
  var platform = 'bottom'; // 'top' | 'bottom'
  var dir = -1;           // 1 = right, -1 = left
  var x = 0;
  var y = 0;
  var state = 'walk';     // 'walk' | 'idle' | 'jump'
  var idleTimer = null;
  var jumpStart = 0;
  var jumpFromY = 0;
  var jumpToY = 0;
  var raf = null;

  /* ---- Platform Y helpers ---- */

  /**
   * headerY — the Y coordinate where the mascot's feet should touch
   * the header's bottom red border.
   * header is position:sticky top:0, so its bottom edge = header.offsetHeight.
   * Mascot top = headerBottom - charH  (feet at the border)
   * BUT we want feet ON the border, so: top = headerBottom - charH
   */
  function headerY() {
    var hdr = document.querySelector('header');
    if (!hdr) return 0;
    var rect = hdr.getBoundingClientRect();
    // rect.bottom is the Y of the header bottom red border (position:fixed viewport coords)
    // mascot uses position:fixed, so we can use rect.bottom directly
    // style.top = borderY - charH  → feet exactly at the red line
    return rect.bottom - CFG.charH;
  }

  /**
   * floorY — the Y coordinate where the mascot's feet should touch
   * exactly the top of the MUSIC button.
   * The MUSIC button is position:fixed, bottom:24px, right:24px.
   */
  function floorY() {
    var btn = document.querySelector('.btn-music-float');
    if (!btn) return window.innerHeight - 24 - 48 - CFG.charH;
    var rect = btn.getBoundingClientRect();
    // rect.top is the top edge of the music button
    // mascot's feet should be at rect.top → style.top = rect.top - charH
    return rect.top - CFG.charH;
  }

  /* ---- X boundaries ---- */

  function xMin() {
    return 10;
  }

  function xMax() {
    return window.innerWidth - CFG.charW - 10;
  }

  /* Right-side boundary: don't overlap the MUSIC button on bottom platform */
  function xMaxBottom() {
    var btn = document.querySelector('.btn-music-float');
    if (!btn) return xMax();
    var rect = btn.getBoundingClientRect();
    // Stop before overlapping the button (with a small gap)
    return rect.left - CFG.charW - 8;
  }

  /* ---- Build DOM ---- */

  function build() {
    el = document.createElement('div');
    el.id = 'spaceman-mascot';
    el.innerHTML =
      '<div class="mascot-body">' +
        '<div class="mascot-helmet">' +
          '<img class="mascot-face" src="' + CFG.faceImg + '" alt="">' +
        '</div>' +
        '<div class="mascot-arm-left"></div>' +
        '<div class="mascot-arm-right"></div>' +
        '<div class="mascot-suit"></div>' +
        '<div class="mascot-legs">' +
          '<div class="mascot-leg mascot-leg-left"></div>' +
          '<div class="mascot-leg mascot-leg-right"></div>' +
        '</div>' +
        '<div class="mascot-jetpack-flame"></div>' +
      '</div>';
    document.body.appendChild(el);
  }

  /* ---- Position helpers ---- */

  function getTargetY() {
    return platform === 'top' ? headerY() : floorY();
  }

  function getXBound() {
    return platform === 'bottom' ? xMaxBottom() : xMax();
  }

  function applyPosition() {
    el.style.left = Math.round(x) + 'px';
    el.style.top  = Math.round(y) + 'px';
  }

  /* ---- State transitions ---- */

  function startWalk() {
    state = 'walk';
    el.className = 'walking' + (dir < 0 ? ' face-left' : '');
    y = getTargetY();
  }

  function startIdle() {
    state = 'idle';
    el.className = 'idle' + (dir < 0 ? ' face-left' : '');
    idleTimer = setTimeout(function () {
      // Randomly decide: jump to other platform or just walk back
      if (Math.random() < 0.35) {
        startJump();
      } else {
        dir *= -1;
        startWalk();
      }
    }, CFG.idleTime + Math.random() * 1500);
  }

  function startJump() {
    state = 'jump';
    el.className = 'jumping' + (dir < 0 ? ' face-left' : '');
    jumpStart = performance.now();
    jumpFromY = getTargetY();
    platform = platform === 'top' ? 'bottom' : 'top';
    jumpToY = getTargetY();
    dir *= -1; // face the other direction after landing
  }

  /* ---- Main loop ---- */

  function tick() {
    raf = requestAnimationFrame(tick);

    if (state === 'walk') {
      x += CFG.speed * dir;
      y = getTargetY(); // recalculate in case header resized / scroll

      var bound = getXBound();
      if (dir > 0 && x >= bound) {
        x = bound;
        startIdle();
      } else if (dir < 0 && x <= xMin()) {
        x = xMin();
        startIdle();
      }
    } else if (state === 'jump') {
      var elapsed = performance.now() - jumpStart;
      var t = Math.min(elapsed / CFG.jumpDuration, 1);
      // Ease in-out
      var ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      // Parabolic arc in Y
      var arcHeight = 120;
      var arc = -4 * arcHeight * t * (t - 1);
      y = jumpFromY + (jumpToY - jumpFromY) * ease - arc;

      // Horizontal drift during jump
      x += CFG.speed * dir * 0.5;

      if (t >= 1) {
        y = jumpToY;
        startWalk();
      }
    }
    // idle state: no movement, handled by CSS animation

    applyPosition();
  }

  /* ---- Init ---- */

  function init() {
    // Don't run on mobile
    if (window.innerWidth <= 768) return;

    build();

    // Start on bottom platform, walking left from the right side
    platform = 'bottom';
    dir = -1;
    x = getXBound() - 60;
    y = getTargetY();
    applyPosition();

    startWalk();
    tick();
  }

  // Wait for DOM + styles to settle
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 500);
    });
  } else {
    setTimeout(init, 500);
  }

  // Clean up on resize for mobile
  window.addEventListener('resize', function () {
    if (window.innerWidth <= 768) {
      if (el && el.parentNode) el.parentNode.removeChild(el);
      cancelAnimationFrame(raf);
    }
  });
})();
