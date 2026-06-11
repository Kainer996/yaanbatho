/**
 * LUMENFORM — homepage motion engine.
 * Preloader, custom cursor, lerped parallax, scroll reveals, manifesto
 * word-lighting, marquee, magnetic buttons, section tracking (broadcast to
 * the mascot via `lumen:section` CustomEvents), and the mobile menu.
 *
 * No dependencies. Everything degrades gracefully and respects
 * prefers-reduced-motion.
 */
(function () {
  'use strict';

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  // ─── PRELOADER ──────────────────────────────────────────────────────────────
  function initLoader() {
    var loader = document.getElementById('lf-loader');
    if (!loader) return;
    var seen = false;
    try { seen = sessionStorage.getItem('lf-seen') === '1'; } catch (e) { /* private mode */ }

    if (reduceMotion || seen) {
      loader.classList.add('done');
      setTimeout(function () { loader.remove(); }, 600);
      return;
    }
    var letters = loader.querySelectorAll('.loader-word span');
    letters.forEach(function (el, i) { el.style.animationDelay = (i * 0.055) + 's'; });

    window.addEventListener('load', finish);
    var failsafe = setTimeout(finish, 2600);

    function finish() {
      clearTimeout(failsafe);
      setTimeout(function () {
        loader.classList.add('done');
        try { sessionStorage.setItem('lf-seen', '1'); } catch (e) { /* ignore */ }
        setTimeout(function () { loader.remove(); }, 700);
      }, 750);
    }
  }

  // ─── CUSTOM CURSOR ──────────────────────────────────────────────────────────
  function initCursor() {
    if (!finePointer || reduceMotion) return;
    var dot = document.createElement('div');
    dot.id = 'lf-cursor-dot';
    var ring = document.createElement('div');
    ring.id = 'lf-cursor-ring';
    document.body.appendChild(dot);
    document.body.appendChild(ring);

    var mx = -100, my = -100, rx = -100, ry = -100;
    window.addEventListener('pointermove', function (e) {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = 'translate(' + (mx - 3) + 'px,' + (my - 3) + 'px)';
    }, { passive: true });

    (function ringLoop() {
      rx += (mx - rx) * 0.16;
      ry += (my - ry) * 0.16;
      ring.style.transform = 'translate(' + (rx - 17) + 'px,' + (ry - 17) + 'px)';
      requestAnimationFrame(ringLoop);
    })();

    document.addEventListener('pointerover', function (e) {
      if (e.target.closest('a, button, .lf-case, #site-mascot')) document.body.classList.add('lf-cursor-hover');
    });
    document.addEventListener('pointerout', function (e) {
      if (e.target.closest('a, button, .lf-case, #site-mascot')) document.body.classList.remove('lf-cursor-hover');
    });
  }

  // ─── SCROLL CORE (lerped) ───────────────────────────────────────────────────
  var scrollTarget = window.scrollY;
  var scrollSmooth = window.scrollY;
  var parallaxEls = [];
  var progressBar = null;
  var heroTitle = null, heroCast = null, skyFar = null, skyNear = null;

  function initScrollCore() {
    progressBar = document.querySelector('#lf-progress span');
    heroTitle = document.querySelector('.lf-hero .hero-title');
    heroCast = document.querySelector('.lf-hero .hero-cast');
    skyFar = document.querySelector('.lf-hero .hero-skyline.far');
    skyNear = document.querySelector('.lf-hero .hero-skyline.near');

    document.querySelectorAll('[data-depth]').forEach(function (el) {
      parallaxEls.push({ el: el, depth: parseFloat(el.dataset.depth) || 0.2 });
    });

    window.addEventListener('scroll', function () { scrollTarget = window.scrollY; }, { passive: true });
    requestAnimationFrame(frame);
  }

  function frame() {
    scrollSmooth += (scrollTarget - scrollSmooth) * 0.12;
    if (Math.abs(scrollTarget - scrollSmooth) < 0.1) scrollSmooth = scrollTarget;
    var y = scrollSmooth;

    if (progressBar) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progressBar.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, scrollTarget / max) : 0) + ')';
    }

    if (!reduceMotion) {
      // hero layered depth — each layer slides at its own rate
      var vh = window.innerHeight;
      if (y < vh * 1.4) {
        if (heroTitle) heroTitle.style.transform = 'translateY(' + (y * 0.32) + 'px)';
        if (heroCast)  heroCast.style.transform  = 'translateY(' + (y * 0.16) + 'px) scale(' + (1 + y * 0.00006) + ')';
        if (skyFar)    skyFar.style.transform    = 'translateY(' + (y * 0.24) + 'px)';
        if (skyNear)   skyNear.style.transform   = 'translateY(' + (y * 0.08) + 'px)';
      }

      // generic parallax: shift relative to element's viewport position
      for (var i = 0; i < parallaxEls.length; i++) {
        var p = parallaxEls[i];
        var r = p.el.getBoundingClientRect();
        if (r.bottom < -80 || r.top > window.innerHeight + 80) continue;
        var mid = r.top + r.height / 2 - window.innerHeight / 2;
        p.el.style.transform = 'translateY(' + (-mid * p.depth).toFixed(1) + 'px)';
      }
    }

    requestAnimationFrame(frame);
  }

  // ─── REVEALS ────────────────────────────────────────────────────────────────
  function initReveals() {
    var els = document.querySelectorAll('.lf-reveal');
    if (!('IntersectionObserver' in window) || reduceMotion) {
      els.forEach(function (el) { el.classList.add('in'); });
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          en.target.classList.add('in');
          io.unobserve(en.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  // ─── HERO TITLE LETTERS ─────────────────────────────────────────────────────
  function initHeroTitle() {
    var title = document.querySelector('.lf-hero .hero-title');
    if (!title) return;
    var text = title.textContent.trim();
    title.textContent = '';
    title.setAttribute('aria-label', text);
    // LUMEN in white, FORM in red — the form is what we give the light
    var redFrom = text.indexOf('FORM');
    for (var i = 0; i < text.length; i++) {
      var s = document.createElement('span');
      s.className = 'lt' + (redFrom >= 0 && i >= redFrom ? ' red' : '');
      s.setAttribute('aria-hidden', 'true');
      s.textContent = text[i];
      s.style.transitionDelay = (0.85 + i * 0.045) + 's';
      title.appendChild(s);
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { title.classList.add('in'); });
    });
    // after the entrance, drop the per-letter delays so nothing lags later
    setTimeout(function () {
      title.querySelectorAll('.lt').forEach(function (el) { el.style.transitionDelay = '0s'; });
    }, 2400);
  }

  // ─── MANIFESTO WORD LIGHTING ────────────────────────────────────────────────
  function initManifesto() {
    var line = document.querySelector('.manifesto-line');
    if (!line) return;
    var raw = line.textContent.trim().split(/\s+/);
    line.textContent = '';
    line.setAttribute('aria-label', raw.join(' '));
    var spans = raw.map(function (word) {
      var s = document.createElement('span');
      var hot = /^\*\*/.test(word);
      var clean = word.replace(/\*\*/g, '');
      s.className = 'w' + (hot ? ' red' : '');
      s.setAttribute('aria-hidden', 'true');
      s.textContent = clean;
      line.appendChild(s);
      line.appendChild(document.createTextNode(' '));
      return s;
    });

    if (reduceMotion) { spans.forEach(function (s) { s.classList.add('lit'); }); return; }

    var section = line.closest('section') || line;
    function update() {
      var r = section.getBoundingClientRect();
      var vh = window.innerHeight;
      // progress: 0 when section enters, 1 when its middle passes 35% of viewport
      var prog = (vh * 0.85 - r.top) / (r.height + vh * 0.35);
      prog = Math.max(0, Math.min(1.15, prog * 1.35));
      var litCount = Math.floor(prog * spans.length);
      for (var i = 0; i < spans.length; i++) {
        spans[i].classList.toggle('lit', i < litCount);
      }
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ─── MARQUEE ────────────────────────────────────────────────────────────────
  function initMarquee() {
    var track = document.querySelector('.lf-marquee .track');
    if (!track) return;
    var chunk = track.querySelector('.chunk');
    // duplicate until we cover 2x viewport for a seamless loop
    while (track.scrollWidth < window.innerWidth * 2.2) {
      track.appendChild(chunk.cloneNode(true));
    }
    if (reduceMotion) return;
    var pos = 0, base = 0.5;
    (function marqueeLoop() {
      // scrolling adds a kick — the marquee is geared to the page like the cogs
      var v = base + Math.min(3.4, Math.abs(scrollTarget - scrollSmooth) * 0.02);
      pos -= v;
      var w = chunk.offsetWidth;
      if (w > 0 && -pos >= w) pos += w;
      track.style.transform = 'translateX(' + pos.toFixed(1) + 'px)';
      requestAnimationFrame(marqueeLoop);
    })();
  }

  // ─── MAGNETIC BUTTONS ───────────────────────────────────────────────────────
  function initMagnetic() {
    if (!finePointer || reduceMotion) return;
    document.querySelectorAll('.lf-btn').forEach(function (btn) {
      btn.addEventListener('pointermove', function (e) {
        var r = btn.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        btn.style.transform = 'translate(' + (dx * 0.18) + 'px,' + (dy * 0.3) + 'px)';
      });
      btn.addEventListener('pointerleave', function () {
        btn.style.transition = 'transform 0.45s cubic-bezier(0.16, 1, 0.3, 1)';
        btn.style.transform = '';
        setTimeout(function () { btn.style.transition = ''; }, 460);
      });
    });
  }

  // ─── WORK MEDIA PARALLAX + TILT ────────────────────────────────────────────
  function initCaseMedia() {
    if (reduceMotion) return;
    var medias = document.querySelectorAll('.lf-case .case-media .media-inner');
    function update() {
      medias.forEach(function (m) {
        var r = m.parentElement.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return;
        var mid = r.top + r.height / 2 - window.innerHeight / 2;
        m.style.transform = 'translateY(' + (-mid * 0.07).toFixed(1) + 'px)';
      });
    }
    window.addEventListener('scroll', update, { passive: true });
    update();
  }

  // ─── SECTION TRACKING → MASCOT ──────────────────────────────────────────────
  function initSectionTracking() {
    var sections = document.querySelectorAll('[data-lumen-section]');
    if (!sections.length || !('IntersectionObserver' in window)) return;
    var current = null;
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting && en.target.dataset.lumenSection !== current) {
          current = en.target.dataset.lumenSection;
          document.dispatchEvent(new CustomEvent('lumen:section', { detail: { section: current } }));
        }
      });
    }, { threshold: 0.4 });
    sections.forEach(function (s) { io.observe(s); });
  }

  // ─── MOBILE MENU ────────────────────────────────────────────────────────────
  function initMenu() {
    var burger = document.querySelector('.lf-burger');
    var menu = document.getElementById('lf-menu');
    if (!burger || !menu) return;
    burger.addEventListener('click', function () {
      var open = document.body.classList.toggle('lf-menu-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      menu.querySelectorAll('a').forEach(function (a, i) {
        a.style.transitionDelay = open ? (0.08 + i * 0.05) + 's' : '0s';
      });
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () {
        document.body.classList.remove('lf-menu-open');
        burger.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // ─── MISC ───────────────────────────────────────────────────────────────────
  function initMisc() {
    var yearEl = document.getElementById('lf-year');
    if (yearEl) yearEl.textContent = String(new Date().getFullYear());
  }

  // ─── BOOT ───────────────────────────────────────────────────────────────────
  function boot() {
    initLoader();
    initCursor();
    initScrollCore();
    initReveals();
    initHeroTitle();
    initManifesto();
    initMarquee();
    initMagnetic();
    initCaseMedia();
    initSectionTracking();
    initMenu();
    initMisc();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
