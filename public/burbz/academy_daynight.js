/* Burbz Academy day and night — the tree keeps the game's own clock.
 *
 * The Academy screen and the little Academy on Home both follow the same
 * sky as the rest of the game (daylight_core.js): full sun by day, a golden
 * dusk from 17:00, moonlight from 19:00, and a soft dawn from 05:00.
 *
 * How a scene works: the day painting sits on top and fades out as the sun
 * sets. Under it waits a moonlit copy of the same tree with the sky cut away
 * (assets/academy-night-20260925/), and under that a live night sky with
 * stars and a moon. Every house has a lit-up night copy that fades in over
 * its day picture, and warm pools of lamplight glow on the bark around it.
 *
 * This file only sets CSS variables, draws stars and swaps in the night art
 * when the evening comes; the stylesheets do the rest. Night art is fetched
 * only once dusk begins, so daytime players never pay for it.
 *
 * Presentation only: never reads or writes game state.
 */
(function (root, factory) {
  const api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BurbzAcademyDayNight = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  function daylight() {
    return root.BurbzDaylightCore || (typeof module === 'object' && module.exports ? require('./daylight_core.js') : null);
  }

  // Sky colours, top to horizon: deep night, golden dusk, clear day.
  const SKY = {
    night: [[5, 9, 28], [13, 21, 54], [34, 46, 90]],
    dusk: [[40, 42, 104], [150, 86, 132], [250, 162, 96]],
    day: [[92, 160, 228], [128, 190, 238], [196, 226, 246]]
  };

  const clamp01 = n => (n < 0 ? 0 : n > 1 ? 1 : n);
  const round = n => Number(n.toFixed(3));
  const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

  /* The full look of one moment of the day. Pure, so it runs under Node. */
  function gradeForHour(hour) {
    const core = daylight();
    const g = core ? core.daylightGradeForHour(hour) : { phase: 'day', sun: 1, warm: 0 };
    const sun = clamp01(g.sun), warm = clamp01(g.warm), night = 1 - sun;
    const lamps = core && core.lampFactorForHour ? clamp01(core.lampFactorForHour(hour)) : night;
    const sky = SKY.night.map((c, i) => mix(mix(c, SKY.day[i], sun), SKY.dusk[i], warm * 0.85));
    return {
      phase: g.phase,
      sun: round(sun),
      night: round(night),
      warm: round(warm),
      lamps: round(lamps),
      stars: round(Math.pow(night, 1.6)),
      sky: sky.map(c => 'rgb(' + c.join(',') + ')')
    };
  }

  /* Evidence scripts can pin the clock; players get their real local hour. */
  function localHour(date) {
    const forced = root.__burbzForceHour ?? root.__academyAliveForceHour;
    if (Number.isFinite(forced)) return Number(forced);
    const d = date || new Date();
    return d.getHours() + d.getMinutes() / 60;
  }

  // ---- stars -----------------------------------------------------------------

  function seeded(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* A fixed star field for a box: denser at the top, thinning to the horizon. */
  function starField(width, height, seed) {
    const rand = seeded(seed || 7), stars = [];
    const count = Math.min(420, Math.round(width * height / 700));
    for (let i = 0; i < count; i++) {
      const y = Math.pow(rand(), 1.45) * height * 0.82;
      stars.push({
        x: rand() * width,
        y,
        r: rand() < 0.08 ? 1.1 + rand() * 0.7 : 0.35 + rand() * 0.6,
        a: 0.35 + rand() * 0.65,
        tint: rand() < 0.18 ? (rand() < 0.5 ? '255,226,190' : '190,210,255') : '255,255,255',
        twinkle: rand() < 0.16
      });
    }
    return stars;
  }

  function drawStars(canvas, twinkle) {
    const box = canvas.getBoundingClientRect();
    const w = Math.round(box.width), h = Math.round(box.height);
    if (!w || !h) return false;
    const dpr = Math.min(2, root.devicePixelRatio || 1);
    const key = w + 'x' + h + '@' + dpr;
    if (canvas.dataset.drawn === key) return true;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return false;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    for (const s of starField(w, h, 1789)) {
      if (s.twinkle !== twinkle) continue;
      ctx.fillStyle = 'rgba(' + s.tint + ',' + s.a + ')';
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 1) {
        ctx.fillStyle = 'rgba(' + s.tint + ',' + (s.a * 0.18) + ')';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r * 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    canvas.dataset.drawn = key;
    return true;
  }

  const SKY_HTML = '<div class="dn-starlight"><canvas class="dn-stars"></canvas><canvas class="dn-stars dn-twinkle"></canvas>' +
    '<i class="dn-shooting-star"></i></div><i class="dn-moon"></i>';

  // ---- scenes ----------------------------------------------------------------

  const scenes = new Map();
  let timer = 0;
  let resizeObserver = null;

  function wake(el) {
    for (const img of el.querySelectorAll('img[data-night-src]')) {
      img.src = img.dataset.nightSrc;
      img.removeAttribute('data-night-src');
    }
    for (const sky of el.querySelectorAll('[data-dn-sky]')) {
      if (!sky.firstElementChild) sky.innerHTML = SKY_HTML;
      for (const canvas of sky.querySelectorAll('canvas')) {
        // The observer draws once on watch and again whenever the box resizes.
        if (resizeObserver && !canvas.dataset.dnWatched) {
          canvas.dataset.dnWatched = '1';
          resizeObserver.observe(canvas);
        } else {
          drawStars(canvas, canvas.classList.contains('dn-twinkle'));
        }
      }
    }
  }

  function apply(el, grade) {
    const state = scenes.get(el);
    const key = JSON.stringify(grade);
    if (state && state.key === key) {
      if (state.awake) wake(el);
      return;
    }
    const set = (name, value) => el.style.setProperty(name, String(value));
    set('--dn-sun', grade.sun);
    set('--dn-night', grade.night);
    set('--dn-warm', grade.warm);
    set('--dn-lamps', grade.lamps);
    set('--dn-stars', grade.stars);
    set('--dn-sky-top', grade.sky[0]);
    set('--dn-sky-mid', grade.sky[1]);
    set('--dn-sky-low', grade.sky[2]);
    el.dataset.daylight = grade.phase;
    // Dusk until dawn the night art is on hand; by full day none is fetched.
    const awake = grade.night > 0.001 || grade.lamps > 0.001;
    el.classList.toggle('dn-awake', awake);
    if (state) { state.key = key; state.awake = awake; }
    if (awake) wake(el);
  }

  function refresh() {
    if (root.document && root.document.hidden) return;
    const grade = gradeForHour(localHour());
    for (const el of scenes.keys()) {
      if (el.isConnected) apply(el, grade);
    }
  }

  /* Register a scene root. Its CSS variables follow the clock from now on. */
  function attach(el) {
    if (!el || scenes.has(el)) return el ? scenes.get(el) : null;
    const state = { key: '', awake: false, observer: null };
    scenes.set(el, state);
    if (root.MutationObserver) {
      // Re-renders bring new houses and skies; wake them if it is evening.
      state.observer = new MutationObserver(() => { if (state.awake) wake(el); });
      state.observer.observe(el, { childList: true, subtree: true });
    }
    if (!resizeObserver && root.ResizeObserver) {
      resizeObserver = new ResizeObserver(entries => {
        for (const entry of entries) {
          const canvas = entry.target;
          if (canvas.isConnected) drawStars(canvas, canvas.classList.contains('dn-twinkle'));
          else resizeObserver.unobserve(canvas);
        }
      });
    }
    if (!timer && root.setInterval) {
      timer = root.setInterval(refresh, 60000);
      root.document?.addEventListener('visibilitychange', refresh);
    }
    apply(el, gradeForHour(localHour()));
    return state;
  }

  return { SKY, gradeForHour, localHour, starField, attach, refresh };
});
