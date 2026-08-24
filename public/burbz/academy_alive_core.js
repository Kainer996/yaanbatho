(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurbzAcademyAlive = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // ==========================================================================
  // ACADEMY ALIVE — the living treehouse.
  //
  // There are deliberately NO birds here: no flyers, no distant flocks, no
  // companion sprites perched on the branches. The Academy reads as a place.
  // What is alive is the weather and the buildings — smoke, lamplight,
  // leaves, fireflies and a canopy that sways.
  //
  // Everything here is presentation only: no game state is read or written.
  // The engine is fed through a small adapter (see createAcademyAlive) so the
  // page owns all knowledge of gameState, art caches and screen routing.
  //
  // Anchor coordinates are FRACTIONS of the 112×112 building sprite box, read
  // off the real manga paintings: the Kitchen's chimney stack really is at
  // (0.585, 0.13) of its sprite, the Crowbar's two lanterns really hang at
  // (0.22, 0.47) and (0.69, 0.50). If a sprite is ever repainted, retune here.
  // ==========================================================================

  var ANCHORS = {
    kitchen: [
      { fx: 0.585, fy: 0.125, type: 'smoke', power: 1.25 },
      { fx: 0.44, fy: 0.30, type: 'glow', glow: 'window', r: 24 },
      { fx: 0.70, fy: 0.46, type: 'glow', glow: 'window', r: 22 },
      { fx: 0.46, fy: 0.60, type: 'glow', glow: 'hearth', r: 30 }
    ],
    dorm: [
      { fx: 0.52, fy: 0.14, type: 'smoke', power: 0.35 },
      { fx: 0.565, fy: 0.375, type: 'glow', glow: 'window', r: 24 },
      { fx: 0.245, fy: 0.62, type: 'glow', glow: 'lantern', r: 20 }
    ],
    crowbar: [
      // The crooked stovepipe at the roof's apex vents the pub hearth.
      { fx: 0.44, fy: 0.075, type: 'smoke', power: 0.6 },
      { fx: 0.22, fy: 0.47, type: 'glow', glow: 'lantern', r: 20 },
      { fx: 0.69, fy: 0.50, type: 'glow', glow: 'lantern', r: 20 },
      { fx: 0.50, fy: 0.47, type: 'glow', glow: 'hearth', r: 34 },
      { fx: 0.79, fy: 0.47, type: 'glow', glow: 'sign', r: 26 },
      { fx: 0.50, fy: 0.38, type: 'notes' }
    ],
    hospital: [
      // The ward keeps a stove going for its patients — a thin thread of
      // smoke off the little roof crown.
      { fx: 0.47, fy: 0.09, type: 'smoke', power: 0.4 },
      { fx: 0.43, fy: 0.28, type: 'glow', glow: 'pulse', r: 26 },
      { fx: 0.44, fy: 0.48, type: 'glow', glow: 'window', r: 24 },
      { fx: 0.63, fy: 0.45, type: 'glow', glow: 'window', r: 22 },
      { fx: 0.22, fy: 0.41, type: 'glow', glow: 'lantern', r: 18 },
      { fx: 0.80, fy: 0.44, type: 'glow', glow: 'lantern', r: 16 }
    ],
    observatory: [
      { fx: 0.65, fy: 0.29, type: 'glow', glow: 'cool', r: 22 },
      { fx: 0.30, fy: 0.41, type: 'glow', glow: 'coollantern', r: 18 },
      { fx: 0.56, fy: 0.42, type: 'glow', glow: 'coollantern', r: 20 },
      { fx: 0.50, fy: 0.09, type: 'glow', glow: 'moon', r: 24 },
      { fx: 0.50, fy: 0.16, type: 'twinkle' }
    ],
    workshop: [
      { fx: 0.50, fy: 0.395, type: 'glow', glow: 'window', r: 20 },
      { fx: 0.50, fy: 0.53, type: 'glow', glow: 'window', r: 24 },
      { fx: 0.47, fy: 0.55, type: 'sparks' }
    ],
    nursery: [
      { fx: 0.50, fy: 0.45, type: 'glow', glow: 'breath', r: 34 },
      { fx: 0.72, fy: 0.44, type: 'glow', glow: 'window', r: 18 },
      { fx: 0.51, fy: 0.30, type: 'glow', glow: 'lantern', r: 16 }
    ],
    training: [
      { fx: 0.50, fy: 0.46, type: 'thwack' }
    ],
    // The Barracks currently shares the training-hall painting, so it shares
    // the training-hall anchor sheet until it gets art of its own.
    tavern: [
      { fx: 0.50, fy: 0.46, type: 'thwack' }
    ],
    // The market painting (assets/academy-buildings-manga/market.png): a round
    // attic window over a striped awning, a lantern hung on each side of it,
    // and the goods on the counter catching the stall's own light.
    magpie_market: [
      { fx: 0.555, fy: 0.205, type: 'glow', glow: 'window', r: 18 },
      { fx: 0.355, fy: 0.215, type: 'glow', glow: 'lantern', r: 16 },
      { fx: 0.298, fy: 0.425, type: 'glow', glow: 'lantern', r: 18 },
      { fx: 0.723, fy: 0.425, type: 'glow', glow: 'lantern', r: 18 },
      { fx: 0.812, fy: 0.415, type: 'glow', glow: 'lantern', r: 16 },
      { fx: 0.500, fy: 0.520, type: 'glow', glow: 'hearth', r: 28 }
    ],
    quest_roost: [
      { fx: 0.335, fy: 0.475, type: 'glow', glow: 'lantern', r: 18 },
      { fx: 0.80, fy: 0.46, type: 'glow', glow: 'lantern', r: 20 },
      { fx: 0.52, fy: 0.50, type: 'glow', glow: 'window', r: 24 }
    ],
    // The Library sprite is the hand-drawn SVG (assets/academy-buildings/
    // library.svg), so these fractions are read off its own geometry: the
    // attic rose window, the twin reading windows, the book-arch hearth glow
    // and the eave lantern.
    library: [
      { fx: 0.50, fy: 0.34, type: 'glow', glow: 'window', r: 18 },
      { fx: 0.383, fy: 0.492, type: 'glow', glow: 'window', r: 20 },
      { fx: 0.617, fy: 0.492, type: 'glow', glow: 'window', r: 20 },
      { fx: 0.50, fy: 0.656, type: 'glow', glow: 'hearth', r: 26 },
      { fx: 0.293, fy: 0.52, type: 'glow', glow: 'lantern', r: 16 }
    ]
  };

  // Warm interiors read as candlelight, the Observatory keeps wizard-blue
  // moonlight, the Hospital cross breathes a soft healing green.
  var GLOW_STYLES = {
    // offChance was roughly trebled on 2026-08-06 (the living-tree release):
    // someone visibly moves between rooms every ~15-30s now, so the Academy
    // reads as inhabited rather than merely lit.
    window:      { color: '255,190,107', day: 0.34, night: 1.00, flick: 0.16, offChance: 0.026 },
    lantern:     { color: '255,202,122', day: 0.44, night: 1.00, flick: 0.30, offChance: 0.016 },
    hearth:      { color: '255,154,61',  day: 0.30, night: 0.92, flick: 0.42, offChance: 0.009 },
    sign:        { color: '255,210,122', day: 0.26, night: 0.78, flick: 0.10, offChance: 0.0 },
    cool:        { color: '159,199,255', day: 0.30, night: 0.95, flick: 0.14, offChance: 0.020 },
    coollantern: { color: '190,214,255', day: 0.34, night: 0.95, flick: 0.26, offChance: 0.016 },
    moon:        { color: '214,228,255', day: 0.14, night: 0.85, flick: 0.06, offChance: 0.0 },
    pulse:       { color: '184,255,212', day: 0.34, night: 0.80, flick: 0.0,  offChance: 0.0 },
    breath:      { color: '255,217,160', day: 0.44, night: 0.95, flick: 0.06, offChance: 0.0 }
  };

  var SPRITE_BOX = 112; // px — .treehouse-building-sprite is a 112×112 square

  function isNightHour(h) { return h >= 19.5 || h < 6; }
  // 0 → full daylight, 1 → deep night, with dawn/dusk ramps so the windows
  // fade up as the real evening draws in rather than snapping on.
  function lightBoostFor(h) {
    if (h >= 21 || h < 5) return 1;
    if (h >= 17.5 && h < 21) return (h - 17.5) / 3.5;
    if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
    return 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function() {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  // A slow, breathing breeze in px/s. Every drifting thing (smoke, leaves,
  // fireflies) shares this one wind so the whole scene leans together.
  function windAt(tMs) {
    return Math.sin(tMs * 0.00013) * 10 + Math.sin(tMs * 0.00047 + 1.7) * 4;
  }

  function createAcademyAlive(adapter) {
    if (!adapter || typeof adapter.container !== 'function') return null;

    var st = {
      running: false,
      mounted: false,
      raf: 0,
      lastT: 0,
      clock: 0,            // engine time, ms (pauses with the screen)
      cont: null,
      sky: null, skyCtx: null,
      front: null, frontCtx: null,
      lightEl: null, shadeEl: null,
      w: 0, h: 0, dpr: 1,
      resizeObs: null,
      glows: [],
      emitters: [],
      particles: [],
      fireflies: [],
      butterflies: [],
      perchPts: [],
      nextAnchorScanAt: 0,
      reduced: false,
      night: false
    };

    // Three chimneys smoke now (Kitchen, Crowbar, Hospital), so the ceiling
    // rose with them; still a bounded, phone-safe particle budget.
    var MAX_PARTICLES = 170;

    function reducedMotion() {
      try { return !!(adapter.reducedMotion && adapter.reducedMotion()); } catch (e) { return false; }
    }
    function hourNow() {
      // NB: 0 is a legitimate hour (midnight) — no `|| 12` fallback here, or
      // the scene would flash to noon daylight for the first minute of the day.
      try {
        if (adapter.hourOfDay) {
          var h = Number(adapter.hourOfDay());
          if (Number.isFinite(h)) return h;
        }
      } catch (e) {}
      var d = new Date(); return d.getHours() + d.getMinutes() / 60;
    }
    function screenActive() {
      try { return !adapter.isScreenActive || !!adapter.isScreenActive(); } catch (e) { return true; }
    }

    // ---- mounting ----------------------------------------------------------

    function el(tag, cls, parent) {
      var e = document.createElement(tag);
      e.className = cls;
      e.setAttribute('aria-hidden', 'true');
      parent.appendChild(e);
      return e;
    }

    function mount() {
      var cont = adapter.container();
      if (!cont) return false;
      if (st.mounted && st.cont === cont && st.sky && st.sky.isConnected) return true;
      st.cont = cont;
      // Idempotent: re-entering the screen must not stack duplicate layers.
      ['academy-alive-shade', 'academy-alive-light', 'academy-alive-sky', 'academy-alive-front', 'academy-alive-flyers']
        .forEach(function(cls) {
          var old = cont.querySelector(':scope > .' + cls.split(' ')[0]);
          if (old) old.remove();
        });
      st.shadeEl = el('div', 'academy-alive-shade', cont);
      st.lightEl = el('div', 'academy-alive-light', cont);
      st.sky = el('canvas', 'academy-alive-canvas academy-alive-sky', cont);
      st.front = el('canvas', 'academy-alive-canvas academy-alive-front', cont);
      st.skyCtx = st.sky.getContext('2d');
      st.frontCtx = st.front.getContext('2d');
      resize();
      if (typeof ResizeObserver === 'function') {
        if (st.resizeObs) st.resizeObs.disconnect();
        st.resizeObs = new ResizeObserver(resize);
        st.resizeObs.observe(cont);
      }
      st.mounted = true;
      return true;
    }

    function resize() {
      if (!st.cont || !st.sky) return;
      var w = st.cont.clientWidth, h = st.cont.clientHeight;
      if (!w || !h) return;
      st.w = w; st.h = h;
      st.dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
      [st.sky, st.front].forEach(function(c) {
        c.width = Math.round(w * st.dpr);
        c.height = Math.round(h * st.dpr);
      });
      st.skyCtx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      st.frontCtx.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      buildFoliage();
    }

    // ---- anchors: glows + emitters bolted onto the real building nodes -----

    function scanAnchors(force) {
      if (!st.cont) return;
      var contRect = st.cont.getBoundingClientRect();
      if (!contRect.width) return;
      // Rebuilding ~26 glow divs is not free, so the periodic heal pass skips
      // out when the room nodes haven't moved and our elements still stand.
      var nodes0 = st.cont.querySelectorAll('.treehouse-room-node[data-room]');
      var sig = Math.round(contRect.width) + ':' + Array.prototype.map.call(nodes0, function(n) {
        return n.getAttribute('data-room') + '@' + n.style.left + ',' + n.style.top;
      }).join('|');
      var intact = st.glows.every(function(g) { return g.el.isConnected; });
      if (!force && sig === st.anchorSig && intact && (st.glows.length + st.emitters.length > 0)) {
        rescanPerches(contRect);
        return;
      }
      st.anchorSig = sig;
      // A render just rebuilt the room nodes; carry each light's flicker state
      // across so a window that had gone dark doesn't snap back on. Emitters
      // keep their next-fire time for the same reason.
      var priorGlow = {}, priorEmit = {};
      st.glows.forEach(function(g) {
        priorGlow[g.key] = g;
        if (g.el && g.el.parentNode) g.el.remove();
      });
      st.emitters.forEach(function(em) { priorEmit[em.key] = em; });
      st.glows = [];
      st.emitters = [];
      // Two passes: read every node rect first, then create and append glow
      // divs — interleaving reads with appends forces one layout per node.
      var entries = [];
      Array.prototype.forEach.call(nodes0, function(node) {
        var room = node.getAttribute('data-room');
        if (!ANCHORS[room]) return;
        entries.push({ node: node, room: room, rect: node.getBoundingClientRect() });
      });
      entries.forEach(function(entry) {
        var box = Math.min(entry.rect.width || SPRITE_BOX, SPRITE_BOX);
        ANCHORS[entry.room].forEach(function(a, idx) {
          var key = entry.room + ':' + idx;
          var ax = entry.rect.left - contRect.left + a.fx * box;
          var ay = entry.rect.top - contRect.top + a.fy * box;
          if (a.type === 'glow') {
            var style = GLOW_STYLES[a.glow] || GLOW_STYLES.window;
            // Radii were read off the 112px paintings; the sprites shrank to
            // nestle into the tree, so the glows shrink with them.
            var r = a.r * (box / SPRITE_BOX);
            var d = r * 2;
            var g = document.createElement('div');
            g.className = 'th-alive-glow';
            g.setAttribute('aria-hidden', 'true');
            g.style.width = d + 'px';
            g.style.height = d + 'px';
            g.style.left = (a.fx * box - r) + 'px';
            g.style.top = (a.fy * box - r) + 'px';
            g.style.background = 'radial-gradient(circle, rgba(' + style.color + ',.85) 0%, rgba(' + style.color + ',.28) 42%, rgba(' + style.color + ',0) 70%)';
            entry.node.appendChild(g);
            var prior = priorGlow[key];
            st.glows.push({
              el: g, key: key, kind: a.glow, style: style,
              phase: prior ? prior.phase : Math.random() * 20,
              speed: prior ? prior.speed : 5 + Math.random() * 7,
              lit: prior ? prior.lit : true,
              switchAt: prior ? prior.switchAt : 0,
              cur: prior ? prior.cur : undefined
            });
          } else {
            var priorE = priorEmit[key];
            st.emitters.push({ type: a.type, key: key, room: entry.room, x: ax, y: ay, power: a.power || 1, nextAt: priorE ? priorE.nextAt : st.clock + Math.random() * 2000 });
          }
        });
      });
      rescanPerches(contRect);
    }

    // Perched birds chirp: remember where the little hoppers sit.
    function rescanPerches(contRect) {
      st.perchPts = [];
      var perched = st.cont.querySelectorAll('.treehouse-bird');
      Array.prototype.forEach.call(perched, function(b) {
        var r = b.getBoundingClientRect();
        if (r.width) st.perchPts.push({ x: r.left - contRect.left + r.width / 2, y: r.top - contRect.top });
      });
    }

    // ---- particles ----------------------------------------------------------

    // Pre-rendered soft radial sprites. Building a CanvasGradient per smoke
    // puff and firefly on every frame is the single biggest per-frame cost on
    // a phone; one cached 64px sprite per colour, drawn via drawImage with
    // globalAlpha, is near-free.
    var softSprites = {};
    function softSprite(rgb) {
      var c = softSprites[rgb];
      if (c) return c;
      c = document.createElement('canvas');
      c.width = c.height = 64;
      var g2 = c.getContext('2d');
      var grad = g2.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(' + rgb + ',1)');
      grad.addColorStop(0.4, 'rgba(' + rgb + ',0.35)');
      grad.addColorStop(1, 'rgba(' + rgb + ',0)');
      g2.fillStyle = grad;
      g2.beginPath(); g2.arc(32, 32, 32, 0, 7); g2.fill();
      softSprites[rgb] = c;
      return c;
    }

    function spawnSpark(x, y, magic) {
      st.particles.push({
        kind: 'spark', x: x, y: y,
        vx: (Math.random() - 0.5) * (magic ? 26 : 70),
        vy: magic ? (-6 - Math.random() * 14) : (-40 - Math.random() * 50),
        size: magic ? 1.6 + Math.random() * 1.8 : 1.2 + Math.random() * 1.4,
        hue: magic ? (255 + Math.random() * 60) : (28 + Math.random() * 18),
        magic: !!magic,
        life: 0, max: magic ? 900 + Math.random() * 700 : 500 + Math.random() * 400
      });
    }

    function spawnSmoke(x, y, power) {
      st.particles.push({
        kind: 'smoke', x: x + (Math.random() - 0.5) * 3, y: y,
        vy: -(13 + Math.random() * 8) * (0.7 + power * 0.4),
        r: 2.5 + Math.random() * 1.6 + power,
        grow: 3.2 + Math.random() * 2.4,
        sway: Math.random() * Math.PI * 2,
        alpha: 0.16 + 0.22 * power,
        life: 0, max: 3600 + Math.random() * 1900
      });
    }

    function spawnLeaf() {
      st.particles.push({
        kind: 'leaf', x: st.w * (0.06 + Math.random() * 0.88), y: st.h * (0.02 + Math.random() * 0.3),
        vy: 26 + Math.random() * 14,
        rot: Math.random() * Math.PI * 2, rotV: (Math.random() - 0.5) * 3.4,
        rock: Math.random() * Math.PI * 2,
        size: 4 + Math.random() * 3.5,
        hue: Math.random() < 0.82 ? 92 + Math.random() * 46 : 42 + Math.random() * 12,
        life: 0, max: 9000
      });
    }

    function spawnNote(x, y, tiny) {
      st.particles.push({
        kind: 'note', x: x + (Math.random() - 0.5) * 8, y: y,
        vy: -(14 + Math.random() * 8), sway: Math.random() * Math.PI * 2,
        glyph: ['♪', '♫', '♬'][Math.floor(Math.random() * 3)],
        size: tiny ? 9 : 12,
        life: 0, max: 2600 + Math.random() * 900
      });
    }

    function spawnTwinkle(x, y) {
      st.particles.push({
        kind: 'twinkle',
        x: x + (Math.random() - 0.5) * 46, y: y + (Math.random() - 0.5) * 22 - 8,
        size: 2.2 + Math.random() * 2.6,
        life: 0, max: 1400 + Math.random() * 900
      });
    }

    function spawnThwack(x, y) {
      st.particles.push({ kind: 'ring', x: x, y: y, size: 3, life: 0, max: 460 });
    }

    function updateEmitters() {
      var boost = st.lightBoost;
      st.emitters.forEach(function(em) {
        if (st.clock < em.nextAt || st.particles.length >= MAX_PARTICLES) return;
        if (em.type === 'smoke') {
          spawnSmoke(em.x, em.y, em.power);
          em.nextAt = st.clock + (em.power >= 1 ? 260 : 900) + Math.random() * (em.power >= 1 ? 220 : 750);
        } else if (em.type === 'notes') {
          spawnNote(em.x, em.y, false);
          em.nextAt = st.clock + 2600 + Math.random() * 3800;
        } else if (em.type === 'sparks') {
          var n = 5 + Math.floor(Math.random() * 5);
          for (var i = 0; i < n; i++) spawnSpark(em.x, em.y, false);
          em.nextAt = st.clock + 6000 + Math.random() * 9000;
        } else if (em.type === 'thwack') {
          spawnThwack(em.x, em.y);
          em.nextAt = st.clock + 9000 + Math.random() * 12000;
        } else if (em.type === 'twinkle') {
          if (boost > 0.25) spawnTwinkle(em.x, em.y);
          em.nextAt = st.clock + 1200 + Math.random() * 2600;
        }
      });
    }

    function updateParticles(dt, wind) {
      var s = dt / 1000;
      var out = [];
      for (var i = 0; i < st.particles.length; i++) {
        var p = st.particles[i];
        p.life += dt;
        if (p.life >= p.max) continue;
        if (p.kind === 'smoke') {
          p.sway += s * 0.9;
          p.x += (wind * 0.55 + Math.sin(p.sway) * 4.5) * s;
          p.y += p.vy * s;
          p.vy *= (1 - 0.12 * s);
          p.r += p.grow * s;
        } else if (p.kind === 'leaf') {
          p.rock += s * 2.4;
          p.x += (wind + Math.sin(p.rock) * 22) * s;
          p.y += (p.vy + Math.abs(Math.cos(p.rock)) * 10) * s;
          p.rot += p.rotV * s;
          if (p.y > st.h + 10) continue;
        } else if (p.kind === 'spark') {
          p.x += (p.vx + (p.magic ? wind * 0.4 : 0)) * s;
          p.y += p.vy * s;
          p.vy += (p.magic ? 26 : 150) * s;
        } else if (p.kind === 'note') {
          p.sway += s * 2.6;
          p.x += (Math.sin(p.sway) * 9 + wind * 0.3) * s;
          p.y += p.vy * s;
        }
        out.push(p);
      }
      st.particles = out;
    }

    function drawParticles(ctx) {
      for (var i = 0; i < st.particles.length; i++) {
        var p = st.particles[i];
        var t = p.life / p.max;
        var fade = t < 0.15 ? t / 0.15 : (t > 0.72 ? (1 - t) / 0.28 : 1);
        if (p.kind === 'smoke') {
          ctx.globalAlpha = p.alpha * fade;
          ctx.drawImage(softSprite(st.night ? '198,206,224' : '236,233,226'), p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
          ctx.globalAlpha = 1;
        } else if (p.kind === 'leaf') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = 0.88 * fade;
          ctx.fillStyle = 'hsl(' + p.hue + ',52%,' + (34 + (p.hue < 60 ? 18 : 8)) + '%)';
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.quadraticCurveTo(p.size * 0.85, -p.size * 0.1, 0, p.size);
          ctx.quadraticCurveTo(-p.size * 0.85, -p.size * 0.1, 0, -p.size);
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.25)';
          ctx.lineWidth = 0.6;
          ctx.beginPath(); ctx.moveTo(0, -p.size * 0.8); ctx.lineTo(0, p.size * 0.8); ctx.stroke();
          ctx.restore();
        } else if (p.kind === 'spark') {
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = fade;
          ctx.fillStyle = p.magic
            ? 'hsl(' + p.hue + ',88%,76%)'
            : 'hsl(' + p.hue + ',96%,' + (58 + 20 * (1 - t)) + '%)';
          ctx.beginPath(); ctx.arc(p.x, p.y, p.size * (1 - t * 0.5), 0, 7); ctx.fill();
          ctx.restore();
        } else if (p.kind === 'note') {
          ctx.save();
          ctx.globalAlpha = 0.85 * fade;
          ctx.fillStyle = '#ffe4a8';
          ctx.font = '700 ' + p.size + 'px serif';
          ctx.fillText(p.glyph, p.x, p.y);
          ctx.restore();
        } else if (p.kind === 'twinkle') {
          var a = Math.sin(Math.PI * t);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          ctx.globalAlpha = a * 0.9;
          ctx.strokeStyle = '#cfe4ff';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(p.x - p.size, p.y); ctx.lineTo(p.x + p.size, p.y);
          ctx.moveTo(p.x, p.y - p.size); ctx.lineTo(p.x, p.y + p.size);
          ctx.stroke();
          ctx.restore();
        } else if (p.kind === 'ring') {
          ctx.save();
          ctx.globalAlpha = (1 - t) * 0.55;
          ctx.strokeStyle = '#f5e8c8';
          ctx.lineWidth = 1.4;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3 + t * 14, 0, 7); ctx.stroke();
          ctx.restore();
        }
      }
      ctx.globalAlpha = 1;
    }

    // ---- ambient actors: fireflies, butterflies, distant flocks -------------

    function ensureAmbientActors() {
      var wantFlies = st.lightBoost > 0.35 ? 11 : 0;
      while (st.fireflies.length < wantFlies) {
        st.fireflies.push({
          bx: Math.random() * st.w, by: st.h * (0.25 + Math.random() * 0.6),
          p1: Math.random() * 7, p2: Math.random() * 7, p3: Math.random() * 7,
          pulse: 0.8 + Math.random() * 2.0
        });
      }
      if (wantFlies === 0) st.fireflies.length = 0;
      var wantButter = st.lightBoost < 0.4 ? 2 : 0;
      while (st.butterflies.length < wantButter) {
        st.butterflies.push({
          bx: st.w * (0.2 + Math.random() * 0.6), by: st.h * (0.3 + Math.random() * 0.45),
          p1: Math.random() * 7, p2: Math.random() * 7,
          flap: Math.random() * 7,
          color: Math.random() < 0.5 ? '#f3ede2' : '#f2cf7b'
        });
      }
      if (wantButter === 0) st.butterflies.length = 0;
    }

    function drawFireflies(ctx) {
      var t = st.clock / 1000;
      st.fireflies.forEach(function(fl) {
        var x = fl.bx + Math.sin(t * 0.31 + fl.p1) * 34 + Math.sin(t * 0.83 + fl.p2) * 12;
        var y = fl.by + Math.cos(t * 0.27 + fl.p2) * 22 + Math.sin(t * 0.61 + fl.p3) * 9;
        var a = (0.35 + 0.65 * Math.abs(Math.sin(t / fl.pulse + fl.p3))) * Math.min(1, st.lightBoost * 1.6);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.8 * a;
        ctx.drawImage(softSprite('208,244,140'), x - 9, y - 9, 18, 18);
        ctx.globalAlpha = 1;
        ctx.fillStyle = 'rgba(245,255,214,' + a + ')';
        ctx.beginPath(); ctx.arc(x, y, 1.3, 0, 7); ctx.fill();
        ctx.restore();
      });
    }

    function drawButterflies(ctx) {
      var t = st.clock / 1000;
      st.butterflies.forEach(function(b) {
        var x = b.bx + Math.sin(t * 0.23 + b.p1) * 52 + Math.sin(t * 0.71 + b.p2) * 14;
        var y = b.by + Math.cos(t * 0.31 + b.p2) * 30 + Math.sin(t * 1.13 + b.p1) * 6;
        var flap = Math.abs(Math.sin(t * 7 + b.flap));
        ctx.save();
        ctx.translate(x, y);
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(-2.6 * flap - 0.6, 0, 3.4 * flap + 0.4, 2.4, 0.5, 0, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(2.6 * flap + 0.6, 0, 3.4 * flap + 0.4, 2.4, -0.5, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#3a3630';
        ctx.fillRect(-0.5, -2.2, 1, 4.4);
        ctx.restore();
      });
    }

    // ---- foreground foliage: swaying branches framing the canopy -----------
    // Each cluster (a leafy branch in deep greens) is drawn ONCE into an
    // offscreen canvas, then swung gently around its anchor by the shared
    // wind — so the tree's branches visibly move without repainting leaves.
    var foliage = [];

    function drawFoliageCluster(g, W, H, rng) {
      // A dense leafy tuft: one short stem buried under overlapping leaves —
      // it reads as the tip of a branch dipping into frame, not a whole limb.
      var midY = H * 0.5;
      g.lineCap = 'round';
      g.strokeStyle = '#2c2017';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(2, midY);
      g.quadraticCurveTo(W * 0.5, midY - H * 0.12, W * 0.9, midY + H * 0.06);
      g.stroke();
      var greens = ['#1e3323', '#27452c', '#315636', '#24402a', '#2c4f31'];
      var n = 46 + Math.floor(rng() * 14);
      for (var i = 0; i < n; i++) {
        var tt = 0.1 + rng() * 0.9;
        var u = 1 - tt;
        var lx = u * u * 2 + 2 * u * tt * W * 0.5 + tt * tt * W * 0.9;
        var ly = u * u * midY + 2 * u * tt * (midY - H * 0.12) + tt * tt * (midY + H * 0.06);
        var spread = 10 + tt * 26; // the tuft fans out toward the branch tip
        var s2 = 10 + rng() * 9;
        g.save();
        g.translate(lx + (rng() - 0.5) * spread, ly + (rng() - 0.5) * spread * 1.4);
        g.rotate(rng() * Math.PI * 2);
        g.fillStyle = rng() < 0.12 ? '#3d6b41' : greens[Math.floor(rng() * greens.length)];
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(s2 * 0.5, -s2 * 0.42, s2, 0);
        g.quadraticCurveTo(s2 * 0.5, s2 * 0.42, 0, 0);
        g.fill();
        g.restore();
      }
    }

    function buildFoliage() {
      foliage = [];
      if (!st.w || typeof document === 'undefined') return;
      // Retired 2026-08-06 (living-canopy release): the painted branch layers
      // in index.html (.academy-branches, real cut-out boughs swaying on CSS
      // pivots) took over from these procedural corner tufts — two art styles
      // of foliage on one screen read as clutter. The machinery stays so the
      // tufts can come back with one defs entry if the layers ever go.
      var defs = [];
      defs.forEach(function(d, i) {
        var W = 190, H = 120;
        var c = document.createElement('canvas');
        c.width = W * 2; c.height = H * 2;
        var g = c.getContext('2d');
        g.setTransform(2, 0, 0, 2, 0, 0);
        drawFoliageCluster(g, W, H, mulberry32(101 + i * 977));
        foliage.push({ canvas: c, w: W, h: H, ax: d.ax, ay: d.ay, rot: d.rot, scale: d.scale, phase: d.phase });
      });
    }

    function drawFoliage(ctx) {
      for (var i = 0; i < foliage.length; i++) {
        var f = foliage[i];
        var sway = windAt(st.clock) * 0.0016 + Math.sin(st.clock * 0.00042 + f.phase) * 0.014;
        ctx.save();
        ctx.translate(f.ax, f.ay);
        ctx.rotate(f.rot + sway);
        ctx.globalAlpha = 0.94;
        ctx.drawImage(f.canvas, -12, -f.h * f.scale * 0.5, f.w * f.scale, f.h * f.scale);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }

    // ---- glows --------------------------------------------------------------

    function updateGlows(dt) {
      var t = st.clock / 1000;
      st.glows.forEach(function(g) {
        // Life in the windows: mostly lit, but every light in the Academy
        // sometimes goes out for a few seconds — someone moved to another
        // room. Rolls happen once per switch window (~1.7s average), so the
        // per-roll odds are offChance×5 ≈ one dark spell every 30–90s.
        if (st.clock >= g.switchAt) {
          if (g.lit && Math.random() < g.style.offChance * 5) {
            g.lit = false;
            g.switchAt = st.clock + 1800 + Math.random() * 5200;
          } else {
            g.lit = true;
            g.switchAt = st.clock + 900 + Math.random() * 1600;
          }
        }
        var base = g.style.day + (g.style.night - g.style.day) * st.lightBoost;
        var flick = 1 - g.style.flick * (0.5 + 0.5 * Math.sin(t * g.speed + g.phase) * Math.sin(t * g.speed * 0.37 + g.phase * 2.1));
        if (g.kind === 'pulse') flick = 0.62 + 0.38 * Math.sin(t * 1.6 + g.phase);
        if (g.kind === 'breath') flick = 0.72 + 0.28 * Math.sin(t * 2.1 + g.phase);
        var target = g.lit ? base * flick : 0;
        g.cur = g.cur === undefined ? target : g.cur + (target - g.cur) * Math.min(1, dt / 260);
        // Style writes on blended elements aren't free — skip imperceptible deltas.
        var next = Math.max(0, Math.min(1, g.cur));
        if (g.written === undefined || Math.abs(next - g.written) > 0.012) {
          g.written = next;
          g.el.style.opacity = String(next);
        }
      });
    }

    // ---- main loop -----------------------------------------------------------

    function tick(now) {
      st.raf = 0;
      if (!st.running) return;
      if (typeof document !== 'undefined' && document.hidden) { st.lastT = 0; schedule(); return; }
      if (!screenActive()) { st.lastT = 0; schedule(); return; }
      if (!st.cont || !st.cont.isConnected) { pause(); return; }
      // Ambience needs 60fps at most — on 120Hz displays every other rAF
      // callback is skipped rather than doubling the battery cost.
      if (st.lastT && now - st.lastT < 14) { schedule(); return; }
      var dt = st.lastT ? Math.min(50, now - st.lastT) : 16;
      st.lastT = now;
      st.clock += dt;

      var h = hourNow();
      st.lightBoost = lightBoostFor(h);
      var night = isNightHour(h);
      if (night !== st.night) {
        st.night = night;
        if (st.cont) st.cont.classList.toggle('alive-night', night);
      }
      if (st.clock >= st.nextAnchorScanAt || (st.glows.length && !st.glows[0].el.isConnected)) {
        st.nextAnchorScanAt = st.clock + 4000;
        scanAnchors();
      }

      var wind = windAt(st.clock);
      updateEmitters();
      ensureAmbientActors();
      updateGlows(dt);
      // The canopy sheds the odd leaf; a touch more often when the wind leans.
      if (Math.random() < (0.004 + Math.abs(wind) * 0.0004) * dt / 16 && countKind('leaf') < 7) spawnLeaf();
      // Daylight dust motes drift where the sun breaks through.
      if (st.lightBoost < 0.4 && Math.random() < 0.02 && countKind('mote') < 12) {
        st.particles.push({ kind: 'mote', x: st.w * (0.1 + Math.random() * 0.55), y: st.h * (0.08 + Math.random() * 0.5), vx: 3 + Math.random() * 4, vy: -(1 + Math.random() * 2), size: 0.8 + Math.random() * 1.1, ph: Math.random() * 7, life: 0, max: 6000 + Math.random() * 4000 });
      }
      updateParticles(dt, wind);
      updateMotes(dt);

      // Nothing renders behind the buildings any more; clear the sky canvas
      // once and leave it alone.
      if (st.skyDirty !== false) { st.skyCtx.clearRect(0, 0, st.w, st.h); st.skyDirty = false; }
      st.frontCtx.clearRect(0, 0, st.w, st.h);
      drawMotes(st.frontCtx);
      drawParticles(st.frontCtx);
      drawFireflies(st.frontCtx);
      drawButterflies(st.frontCtx);
      drawFoliage(st.frontCtx);

      schedule();
    }

    function countKind(kind) {
      var n = 0;
      for (var i = 0; i < st.particles.length; i++) if (st.particles[i].kind === kind) n++;
      return n;
    }

    function updateMotes(dt) {
      var s = dt / 1000;
      for (var i = 0; i < st.particles.length; i++) {
        var p = st.particles[i];
        if (p.kind !== 'mote') continue;
        p.x += p.vx * s; p.y += p.vy * s; p.ph += s;
      }
    }

    function drawMotes(ctx) {
      ctx.save();
      for (var i = 0; i < st.particles.length; i++) {
        var p = st.particles[i];
        if (p.kind !== 'mote') continue;
        var t = p.life / p.max;
        var a = Math.sin(Math.PI * t) * (0.25 + 0.3 * Math.abs(Math.sin(p.ph * 2)));
        ctx.globalAlpha = a;
        ctx.fillStyle = '#fff7dc';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
      }
      ctx.restore();
    }

    function schedule() {
      if (st.running && !st.raf) st.raf = requestAnimationFrame(tick);
    }

    // ---- public API ----------------------------------------------------------

    function start() {
      st.reduced = reducedMotion();
      if (!mount()) return;
      scanAnchors();
      if (st.reduced) {
        // Respect prefers-reduced-motion: keep the warm windows (static), skip
        // every moving thing.
        st.running = false;
        var boost = lightBoostFor(hourNow());
        st.glows.forEach(function(g) {
          g.el.style.opacity = String(g.style.day + (g.style.night - g.style.day) * boost);
        });
        if (st.cont) st.cont.classList.toggle('alive-night', isNightHour(hourNow()));
        return;
      }
      if (st.running) return;
      st.running = true;
      st.lastT = 0;
      schedule();
    }

    function pause() {
      st.running = false;
      if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
      st.lastT = 0;
    }

    function stop() {
      pause();
      st.particles = [];
      st.fireflies = [];
      st.butterflies = [];
      if (st.resizeObs) { st.resizeObs.disconnect(); st.resizeObs = null; }
      ['shadeEl', 'lightEl', 'sky', 'front'].forEach(function(k) {
        if (st[k] && st[k].parentNode) st[k].remove();
        st[k] = null;
      });
      st.glows.forEach(function(g) { if (g.el && g.el.parentNode) g.el.remove(); });
      st.glows = [];
      st.emitters = [];
      st.mounted = false;
      if (typeof document !== 'undefined' && onVisibility) {
        document.removeEventListener('visibilitychange', onVisibility);
        onVisibility = null;
      }
    }

    // Buildings moved, were built, or the perched flock re-rendered: re-anchor.
    function refresh() {
      if (!st.mounted) return;
      scanAnchors();
      if (st.reduced) {
        var boost = lightBoostFor(hourNow());
        st.glows.forEach(function(g) {
          g.el.style.opacity = String(g.style.day + (g.style.night - g.style.day) * boost);
        });
      }
    }

    // rAF stops in hidden tabs anyway; this clears lastT so the first visible
    // frame doesn't integrate a giant dt. stop() removes it again.
    var onVisibility = typeof document !== 'undefined' ? function() { st.lastT = 0; } : null;
    if (onVisibility) document.addEventListener('visibilitychange', onVisibility);

    return {
      start: start,
      pause: pause,
      stop: stop,
      refresh: refresh,
      isRunning: function() { return st.running; },
      _state: st
    };
  }

  return {
    ANCHORS: ANCHORS,
    GLOW_STYLES: GLOW_STYLES,
    SPRITE_BOX: SPRITE_BOX,
    isNightHour: isNightHour,
    lightBoostFor: lightBoostFor,
    mulberry32: mulberry32,
    windAt: windAt,
    createAcademyAlive: createAcademyAlive
  };
});
