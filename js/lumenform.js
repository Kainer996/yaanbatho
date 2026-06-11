/* ═══════════════════════════════════════════════════════════════
   LUMENFORM — page engine
   Loader · split type · smooth parallax · scroll reveals ·
   work deck · stills scrub · magnetic UI · custom cursor
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const FINE_POINTER = window.matchMedia('(pointer: fine)').matches;

  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  /* ── Boot loader ─────────────────────────────────────────────── */
  function initLoader() {
    const loader = document.getElementById('lf-loader');
    const fill = document.getElementById('lf-loader-fill');
    const line = document.getElementById('lf-loader-line');
    if (!loader) return;

    const lines = ['calibrating light…', 'oiling the cogs…', 'waking the astronaut…', 'doors opening'];
    let p = 0, li = 0;

    const tick = setInterval(() => {
      p = Math.min(p + 14 + Math.random() * 18, 100);
      if (fill) fill.style.width = p + '%';
      if (line && li < lines.length - 1 && p > (li + 1) * 28) line.textContent = lines[++li];
      if (p >= 100) {
        clearInterval(tick);
        if (line) line.textContent = lines[lines.length - 1];
        setTimeout(() => {
          loader.classList.add('done');
          document.body.classList.add('lf-booted');
          revealHero();
        }, 280);
      }
    }, REDUCED ? 30 : 130);

    // failsafe — never trap anyone behind the loader
    setTimeout(() => {
      clearInterval(tick);
      loader.classList.add('done');
      document.body.classList.add('lf-booted');
      revealHero();
    }, 3200);
  }

  /* ── Hero title: split into letters ──────────────────────────── */
  function splitHeroTitle() {
    const title = document.getElementById('lf-hero-title');
    if (!title) return;
    const text = title.textContent.trim();
    title.textContent = '';
    let i = 0;
    text.split(' ').forEach(word => {
      const w = document.createElement('span');
      w.className = 'lf-word';
      [...word].forEach(ch => {
        const span = document.createElement('span');
        span.className = 'lf-ch';
        span.textContent = ch;
        span.style.transitionDelay = (0.05 + i++ * 0.045) + 's';
        w.appendChild(span);
      });
      title.appendChild(w);
    });
  }

  let heroRevealed = false;
  function revealHero() {
    if (heroRevealed) return;
    heroRevealed = true;
    const title = document.getElementById('lf-hero-title');
    if (title) title.classList.add('in');
    document.querySelectorAll('.lf-hero .lf-reveal').forEach((el, i) => {
      setTimeout(() => el.classList.add('in-view'), 450 + i * 140);
    });
  }

  /* ── Scroll reveals ──────────────────────────────────────────── */
  function initReveals() {
    const targets = document.querySelectorAll('.lf-reveal:not(.lf-hero .lf-reveal), .lf-line');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add('in-view');
          io.unobserve(e.target);
        }
      });
    }, { threshold: 0.2, rootMargin: '0px 0px -60px 0px' });
    targets.forEach(el => io.observe(el));

    // stagger sibling lines
    document.querySelectorAll('.lf-manifesto, .lf-contact-title').forEach(block => {
      block.querySelectorAll('.lf-line > span').forEach((span, i) => {
        span.style.transitionDelay = (i * 0.12) + 's';
      });
    });
  }

  /* ── Smooth parallax + gears + stills scrub (one rAF loop) ───── */
  function initScrollMotion() {
    if (REDUCED) return;

    const plxEls = [...document.querySelectorAll('[data-plx]')].map(el => ({
      el, speed: parseFloat(el.dataset.plx) || -0.15
    }));
    const gearEls = [...document.querySelectorAll('[data-gear]')].map(el => ({
      el, speed: parseFloat(el.dataset.gear) || 0.08,
      base: el.style.transform || ''
    }));
    const stills = document.getElementById('lf-stills-track');
    const stillsSection = stills ? stills.closest('.lf-stills') : null;

    let target = window.scrollY;
    let eased = target;

    function frame() {
      target = window.scrollY;
      eased = lerp(eased, target, 0.085);
      if (Math.abs(eased - target) < 0.05) eased = target;

      const vh = window.innerHeight;

      plxEls.forEach(({ el, speed }) => {
        const r = el.parentElement.getBoundingClientRect();
        // parallax relative to element's journey through the viewport
        const delta = (r.top + r.height / 2) - vh / 2;
        el.style.transform = `translateY(${(-delta * speed).toFixed(1)}px)`;
      });

      gearEls.forEach(({ el, speed, base }) => {
        el.style.transform = `${base} rotate(${(eased * speed).toFixed(2)}deg)`;
      });

      if (stills && stillsSection) {
        const r = stillsSection.getBoundingClientRect();
        const progress = clamp((vh - r.top) / (vh + r.height), 0, 1);
        const overflow = stills.scrollWidth - window.innerWidth;
        if (overflow > 0) {
          stills.style.transform = `translateX(${(-progress * overflow).toFixed(1)}px)`;
        }
      }

      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  /* ── Header state + mobile nav + active link ─────────────────── */
  function initHeader() {
    const header = document.querySelector('.lf-header');
    const burger = document.getElementById('lf-burger');
    const nav = document.getElementById('lf-nav');

    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 40);
    }, { passive: true });

    if (burger && nav) {
      burger.addEventListener('click', () => {
        const open = nav.classList.toggle('open');
        burger.setAttribute('aria-expanded', String(open));
      });
      nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
        nav.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      }));
    }

    // active section highlight
    const links = [...document.querySelectorAll('.lf-nav a[href^="#"]')];
    const sections = links
      .map(a => document.querySelector(a.getAttribute('href')))
      .filter(Boolean);
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        links.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + e.target.id));
      });
    }, { rootMargin: '-35% 0px -55% 0px' });
    sections.forEach(s => io.observe(s));
  }

  /* ── Work deck: dropdown menu (accordion) + hover stage ──────── */
  function initWorkDeck() {
    const list = document.getElementById('lf-work-list');
    const media = document.getElementById('lf-work-stage-media');
    const idxEl = document.getElementById('lf-work-stage-index');
    const metaEl = document.getElementById('lf-work-stage-meta');
    if (!list || !media) return;

    const entries = [...list.querySelectorAll('.lf-work-entry')];
    const total = String(entries.length).padStart(2, '0');
    let current = -1;

    function show(i) {
      if (i === current) return;
      current = i;
      const entry = entries[i];

      let node;
      if (entry.dataset.image) {
        node = document.createElement('img');
        node.src = entry.dataset.image;
        node.alt = '';
      } else {
        node = document.createElement('div');
        node.className = 'lf-stage-icon';
        node.textContent = entry.dataset.icon || '◇';
        const grad = entry.querySelector('[data-grad]');
        if (grad) node.style.background = getComputedStyle(grad).background;
      }
      media.appendChild(node);
      requestAnimationFrame(() => requestAnimationFrame(() => node.classList.add('is-live')));

      while (media.children.length > 2) media.removeChild(media.firstChild);
      if (media.children.length === 2) {
        media.firstChild.classList.remove('is-live');
        const old = media.firstChild;
        setTimeout(() => { if (old.parentNode === media) media.removeChild(old); }, 550);
      }

      if (idxEl) idxEl.textContent = String(i + 1).padStart(2, '0') + ' / ' + total;
      if (metaEl) metaEl.textContent = entry.dataset.meta || '';
    }

    function setOpen(entry, open) {
      entry.classList.toggle('open', open);
      const head = entry.querySelector('.lf-work-head');
      if (head) head.setAttribute('aria-expanded', String(open));
    }

    entries.forEach((entry, i) => {
      const head = entry.querySelector('.lf-work-head');
      if (!head) return;
      head.addEventListener('mouseenter', () => show(i));
      head.addEventListener('focus', () => show(i));
      head.addEventListener('click', () => {
        const wasOpen = entry.classList.contains('open');
        entries.forEach(e => setOpen(e, false));
        if (!wasOpen) {
          setOpen(entry, true);
          show(i);
        }
      });
    });

    show(0);
  }

  /* ── Stat count-up ───────────────────────────────────────────── */
  function initStats() {
    const stats = document.querySelectorAll('.lf-stat-num[data-count]');
    if (!stats.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        io.unobserve(e.target);
        const end = parseInt(e.target.dataset.count, 10);
        const suffix = e.target.dataset.suffix || '';
        if (REDUCED) { e.target.textContent = end + suffix; return; }
        const t0 = performance.now();
        (function step(t) {
          const p = clamp((t - t0) / 1400, 0, 1);
          const v = Math.round(end * (1 - Math.pow(1 - p, 3)));
          e.target.textContent = v + suffix;
          if (p < 1) requestAnimationFrame(step);
        })(t0);
      });
    }, { threshold: 0.6 });
    stats.forEach(s => io.observe(s));
  }

  /* ── Magnetic buttons ────────────────────────────────────────── */
  function initMagnetic() {
    if (!FINE_POINTER || REDUCED) return;
    document.querySelectorAll('[data-magnetic]').forEach(el => {
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.22;
        el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      });
      el.addEventListener('mouseleave', () => { el.style.transform = ''; });
    });
  }

  /* ── Custom cursor ───────────────────────────────────────────── */
  function initCursor() {
    if (!FINE_POINTER || REDUCED) return;

    const ring = document.createElement('div');
    ring.className = 'lf-cursor';
    const dot = document.createElement('div');
    dot.className = 'lf-cursor-dot';
    document.body.append(ring, dot);

    let mx = -100, my = -100, rx = -100, ry = -100;

    document.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.left = mx + 'px';
      dot.style.top = my + 'px';
      ring.classList.add('is-on');
      dot.classList.add('is-on');
    }, { passive: true });

    document.addEventListener('mouseleave', () => {
      ring.classList.remove('is-on');
      dot.classList.remove('is-on');
    });

    (function follow() {
      rx = lerp(rx, mx, 0.16);
      ry = lerp(ry, my, 0.16);
      ring.style.left = rx + 'px';
      ring.style.top = ry + 'px';
      requestAnimationFrame(follow);
    })();

    document.addEventListener('mouseover', (e) => {
      const hot = e.target.closest('a, button, .lf-work-item, #site-mascot, #lf-lift');
      ring.classList.toggle('is-hover', !!hot);
    }, { passive: true });
  }

  /* ── Hail button → talks to the world layer ──────────────────── */
  function initHail() {
    const btn = document.getElementById('lf-hail');
    if (!btn) return;
    btn.addEventListener('click', () => {
      if (window.LumenWorld && window.LumenWorld.hail) {
        window.LumenWorld.hail();
      }
    });
  }

  /* ── Init ────────────────────────────────────────────────────── */
  function init() {
    splitHeroTitle();
    initLoader();
    initReveals();
    initScrollMotion();
    initHeader();
    initWorkDeck();
    initStats();
    initMagnetic();
    initCursor();
    initHail();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
