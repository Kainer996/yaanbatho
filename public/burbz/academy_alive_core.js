(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.BurbzAcademyAlive = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';

  // ==========================================================================
  // ACADEMY ALIVE — the living treehouse.
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
      { fx: 0.585, fy: 0.125, type: 'smoke', power: 1.0 },
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
      { fx: 0.22, fy: 0.47, type: 'glow', glow: 'lantern', r: 20 },
      { fx: 0.69, fy: 0.50, type: 'glow', glow: 'lantern', r: 20 },
      { fx: 0.50, fy: 0.47, type: 'glow', glow: 'hearth', r: 34 },
      { fx: 0.79, fy: 0.47, type: 'glow', glow: 'sign', r: 26 },
      { fx: 0.50, fy: 0.38, type: 'notes' }
    ],
    hospital: [
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
    quest_roost: [
      { fx: 0.335, fy: 0.475, type: 'glow', glow: 'lantern', r: 18 },
      { fx: 0.80, fy: 0.46, type: 'glow', glow: 'lantern', r: 20 },
      { fx: 0.52, fy: 0.50, type: 'glow', glow: 'window', r: 24 }
    ]
  };

  // Warm interiors read as candlelight, the Observatory keeps wizard-blue
  // moonlight, the Hospital cross breathes a soft healing green.
  var GLOW_STYLES = {
    window:      { color: '255,190,107', day: 0.34, night: 1.00, flick: 0.16, offChance: 0.010 },
    lantern:     { color: '255,202,122', day: 0.44, night: 1.00, flick: 0.30, offChance: 0.006 },
    hearth:      { color: '255,154,61',  day: 0.30, night: 0.92, flick: 0.42, offChance: 0.004 },
    sign:        { color: '255,210,122', day: 0.26, night: 0.78, flick: 0.10, offChance: 0.0 },
    cool:        { color: '159,199,255', day: 0.30, night: 0.95, flick: 0.14, offChance: 0.008 },
    coollantern: { color: '190,214,255', day: 0.34, night: 0.95, flick: 0.26, offChance: 0.006 },
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

  // A slow, breathing breeze in px/s. Every drifting thing (smoke, feathers,
  // leaves, fireflies) shares this one wind so the whole scene leans together.
  function windAt(tMs) {
    return Math.sin(tMs * 0.00013) * 10 + Math.sin(tMs * 0.00047 + 1.7) * 4;
  }

  function cubicAt(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return {
      x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
      y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y
    };
  }

  function cubicTanAt(p0, p1, p2, p3, t) {
    var u = 1 - t;
    return {
      x: 3 * u * u * (p1.x - p0.x) + 6 * u * t * (p2.x - p1.x) + 3 * t * t * (p3.x - p2.x),
      y: 3 * u * u * (p1.y - p0.y) + 6 * u * t * (p2.y - p1.y) + 3 * t * t * (p3.y - p2.y)
    };
  }

  // One smooth swooping leg of flight through the canopy band of the scene.
  // `from` is optional; without it the leg starts just off one side, so birds
  // glide in from beyond the tree instead of popping into existence.
  function makeFlightLeg(w, h, from, rng, forceExit) {
    rng = rng || Math.random;
    var yBand = function() { return h * (0.10 + rng() * 0.58); };
    var start = from || (rng() < 0.5
      ? { x: -60, y: yBand() }
      : { x: w + 60, y: yBand() });
    var end;
    var exit = forceExit ? true : (!from ? false : rng() < 0.4);
    if (exit) end = (start.x < w / 2) ? { x: w + 70, y: yBand() } : { x: -70, y: yBand() };
    else end = { x: w * (0.12 + rng() * 0.76), y: yBand() };
    var midX = (start.x + end.x) / 2;
    var lift = (rng() - 0.5) * h * 0.5;
    var c1 = { x: start.x + (midX - start.x) * (0.4 + rng() * 0.5), y: start.y + lift };
    var c2 = { x: end.x - (end.x - midX) * (0.4 + rng() * 0.5), y: end.y - lift * (0.3 + rng() * 0.7) };
    var dist = Math.abs(end.x - start.x) + Math.abs(end.y - start.y);
    var dur = Math.max(3200, Math.min(12000, dist * (9 + rng() * 7)));
    return { p0: start, p1: c1, p2: c2, p3: end, dur: dur, exit: exit };
  }

  // Which companions take to the air. Deterministic for a given roster+seed so
  // tests can pin it; rotates through the flock over time via the seed.
  function pickFlyers(birds, max, seed) {
    var list = (birds || []).filter(function(b) { return b && b.id; });
    if (list.length <= max) return list.slice();
    var rng = mulberry32((seed >>> 0) || 1);
    var pool = list.slice();
    var picked = [];
    // Merlin, the permanent guide, always earns one of the sky slots.
    var merlinIdx = pool.findIndex(function(b) { return b.magic; });
    if (merlinIdx >= 0) picked.push(pool.splice(merlinIdx, 1)[0]);
    while (picked.length < max && pool.length) {
      picked.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]);
    }
    return picked;
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
      flyerLayer: null,
      lightEl: null, shadeEl: null,
      w: 0, h: 0, dpr: 1,
      resizeObs: null,
      glows: [],
      emitters: [],
      particles: [],
      fireflies: [],
      butterflies: [],
      flockRuns: [],
      flyers: {},          // birdId → flyer
      groundedIds: {},     // birdId → true when its cutout art failed to load
      perchPts: [],
      rosterSeed: 1,
      nextRosterAt: 0,
      nextFlockAt: 3500,
      nextChirpAt: 4000,
      nextAnchorScanAt: 0,
      reduced: false,
      night: false
    };

    var MAX_FLYERS = 5;
    var MAX_PARTICLES = 150;

    function reducedMotion() {
      try { return !!(adapter.reducedMotion && adapter.reducedMotion()); } catch (e) { return false; }
    }
    function hourNow() {
      try { if (adapter.hourOfDay) return Number(adapter.hourOfDay()) || 12; } catch (e) {}
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
      st.flyerLayer = el('div', 'academy-alive-flyers', cont);
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
      st.glows.forEach(function(g) { if (g.el && g.el.parentNode) g.el.remove(); });
      st.glows = [];
      st.emitters = [];
      var nodes = st.cont.querySelectorAll('.treehouse-room-node[data-room]');
      Array.prototype.forEach.call(nodes, function(node) {
        var room = node.getAttribute('data-room');
        var sheet = ANCHORS[room];
        if (!sheet) return;
        var rect = node.getBoundingClientRect();
        var box = Math.min(rect.width || SPRITE_BOX, SPRITE_BOX);
        sheet.forEach(function(a) {
          var ax = rect.left - contRect.left + a.fx * box;
          var ay = rect.top - contRect.top + a.fy * box;
          if (a.type === 'glow') {
            var style = GLOW_STYLES[a.glow] || GLOW_STYLES.window;
            var d = a.r * 2;
            var g = document.createElement('div');
            g.className = 'th-alive-glow';
            g.setAttribute('aria-hidden', 'true');
            g.style.width = d + 'px';
            g.style.height = d + 'px';
            g.style.left = (a.fx * box - a.r) + 'px';
            g.style.top = (a.fy * box - a.r) + 'px';
            g.style.background = 'radial-gradient(circle, rgba(' + style.color + ',.85) 0%, rgba(' + style.color + ',.28) 42%, rgba(' + style.color + ',0) 70%)';
            node.appendChild(g);
            st.glows.push({
              el: g, kind: a.glow, style: style,
              phase: Math.random() * 20, speed: 5 + Math.random() * 7,
              lit: true, switchAt: 0
            });
          } else {
            st.emitters.push({ type: a.type, room: room, x: ax, y: ay, power: a.power || 1, nextAt: st.clock + Math.random() * 2000 });
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

    // ---- flying companions -------------------------------------------------

    function birdRoster() {
      try { return (adapter.presentBirds && adapter.presentBirds()) || []; } catch (e) { return []; }
    }

    function syncFlyers(force) {
      if (st.clock < st.nextRosterAt && !force) return;
      st.nextRosterAt = st.clock + 12000;
      st.rosterSeed = (st.rosterSeed * 1664525 + 1013904223) >>> 0;
      // Only companions with real transparent cutout art take to the air — a
      // 44px fallback glyph reads as a blob in flight, so art-less birds stay
      // on their perches. Birds whose art failed to load are grounded too.
      var flyable = birdRoster().filter(function(b) {
        return b && b.cutoutUrl && !st.groundedIds[b.id];
      });
      var roster = pickFlyers(flyable, MAX_FLYERS, st.rosterSeed);
      var keep = {};
      roster.forEach(function(b) { keep[b.id] = true; });
      // Birds that left the Academy (recruited away, sent questing) glide out
      // on their current leg and are removed once it ends.
      Object.keys(st.flyers).forEach(function(id) {
        if (!keep[id]) st.flyers[id].retiring = true;
      });
      roster.forEach(function(b, i) {
        if (st.flyers[b.id]) { st.flyers[b.id].retiring = false; return; }
        spawnFlyer(b, i);
      });
    }

    function spawnFlyer(bird, i) {
      if (!st.flyerLayer) return;
      var deep = Math.random() < 0.38; // some flights pass behind the buildings
      var elWrap = document.createElement('div');
      elWrap.className = 'alive-flyer' + (deep ? ' behind' : '') + (bird.magic ? ' magic' : '');
      elWrap.setAttribute('aria-hidden', 'true');
      var img = document.createElement('img');
      img.src = bird.cutoutUrl;
      img.alt = '';
      img.draggable = false;
      img.addEventListener('error', function() {
        // Broken art: ground this bird for the session rather than flying a
        // blank box around the canopy.
        st.groundedIds[bird.id] = true;
        removeFlyer(bird.id);
      }, { once: true });
      elWrap.appendChild(img);
      st.flyerLayer.appendChild(elWrap);
      var f = {
        bird: bird, el: elWrap, deep: deep,
        leg: null, legT: 0, restUntil: st.clock + 400 + i * 2600 + Math.random() * 3000,
        flapPhase: Math.random() * 7,
        nextFeatherAt: st.clock + 1500 + Math.random() * 2500,
        x: -200, y: -200, dir: 1,
        retiring: false
      };
      // Park the new flyer beyond the canopy immediately — an untransformed
      // element would sit visible in the container's top-left corner.
      place(f);
      st.flyers[bird.id] = f;
    }

    function removeFlyer(id) {
      var f = st.flyers[id];
      if (!f) return;
      if (f.el && f.el.parentNode) f.el.remove();
      delete st.flyers[id];
    }

    function updateFlyers(dt) {
      Object.keys(st.flyers).forEach(function(id) {
        var f = st.flyers[id];
        if (!f.leg) {
          if (st.clock < f.restUntil) {
            // Between legs a bird flutters on the spot rather than freezing
            // mid-air — hummingbird-style hover, wings still going.
            if (f.x > -100) {
              f.flapPhase += dt * 0.010;
              place(f, Math.sin(f.flapPhase * 2.1) * 3.2, Math.sin(f.flapPhase * 1.1) * 4);
            }
            return;
          }
          if (f.retiring && f.x <= -100) { removeFlyer(id); return; }
          // A retiring bird's next leg must genuinely END off-screen, so its
          // removal happens beyond the canopy instead of popping out mid-air.
          f.leg = makeFlightLeg(st.w, st.h, (f.x > -100 && f.x < st.w + 100) ? { x: f.x, y: f.y } : null, Math.random, f.retiring);
          f.legT = 0;
        }
        f.legT += dt / f.leg.dur;
        if (f.legT >= 1) {
          var wasExit = f.leg.exit;
          f.x = f.leg.p3.x; f.y = f.leg.p3.y;
          f.leg = null;
          if (wasExit || f.retiring) {
            if (f.retiring) { removeFlyer(id); return; }
            // Slipped out beyond the canopy — rest a while, then glide back in.
            f.x = -200; f.restUntil = st.clock + 3000 + Math.random() * 9000;
          } else {
            f.restUntil = st.clock + 600 + Math.random() * 1800; // brief hover between swoops
          }
          place(f);
          return;
        }
        var p = cubicAt(f.leg.p0, f.leg.p1, f.leg.p2, f.leg.p3, f.legT);
        var tan = cubicTanAt(f.leg.p0, f.leg.p1, f.leg.p2, f.leg.p3, f.legT);
        f.x = p.x; f.y = p.y;
        if (Math.abs(tan.x) > 4) f.dir = tan.x >= 0 ? 1 : -1;
        f.flapPhase += dt * 0.012;
        var bob = Math.sin(f.flapPhase * 2.1) * 2.6;
        var bank = Math.max(-18, Math.min(18, (tan.y / (Math.abs(tan.x) + 40)) * 26)) * f.dir;
        var wob = Math.sin(f.flapPhase * 2.1 + 1.2) * 3.5;
        place(f, bob, bank + wob);
        // A wingbeat shakes loose the odd feather; Merlin sheds sparks instead.
        if (st.clock >= f.nextFeatherAt && st.particles.length < MAX_PARTICLES) {
          f.nextFeatherAt = st.clock + (f.bird.magic ? 260 : 1400) + Math.random() * (f.bird.magic ? 420 : 2600);
          if (f.bird.magic) spawnSpark(f.x - f.dir * 12, f.y + 4, true);
          else spawnFeather(f.x, f.y + 6, f.bird.tint);
        }
      });
    }

    function place(f, bob, rot) {
      var s = f.deep ? 0.72 : 1;
      f.el.style.transform = 'translate3d(' + (f.x - 22) + 'px,' + (f.y - 22 + (bob || 0)) + 'px,0)' +
        ' rotate(' + (rot || 0) + 'deg) scale(' + (s * f.dir * -1) + ',' + s + ')';
      // Cutout paintings face left; scaleX is negated so a bird flying right
      // (dir=1) is mirrored to face its own direction of travel.
    }

    // ---- particles ----------------------------------------------------------

    function spawnFeather(x, y, tint) {
      st.particles.push({
        kind: 'feather', x: x, y: y,
        vx: (Math.random() - 0.5) * 8, vy: 6 + Math.random() * 8,
        rot: Math.random() * Math.PI * 2, rock: Math.random() * Math.PI * 2,
        size: 4.5 + Math.random() * 3.5,
        color: (tint && tint[Math.random() < 0.7 ? 0 : 1]) || '#cdb891',
        life: 0, max: 4500 + Math.random() * 2500
      });
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
      for (var i = 0; i < 3; i++) spawnFeather(x + (Math.random() - 0.5) * 10, y, ['#e8dcc0', '#cdb891']);
    }

    function updateEmitters() {
      var boost = st.lightBoost;
      st.emitters.forEach(function(em) {
        if (st.clock < em.nextAt || st.particles.length >= MAX_PARTICLES) return;
        if (em.type === 'smoke') {
          spawnSmoke(em.x, em.y, em.power);
          em.nextAt = st.clock + (em.power >= 1 ? 300 : 1150) + Math.random() * (em.power >= 1 ? 260 : 900);
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
        if (p.kind === 'feather') {
          p.rock += s * 3.1;
          p.x += (p.vx + wind * 0.6 + Math.sin(p.rock) * 18) * s;
          p.y += (p.vy + Math.abs(Math.cos(p.rock)) * 9) * s;
          p.rot = Math.sin(p.rock) * 0.9;
        } else if (p.kind === 'smoke') {
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
        if (p.kind === 'feather') {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.globalAlpha = 0.9 * fade;
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.moveTo(0, -p.size);
          ctx.quadraticCurveTo(p.size * 0.62, -p.size * 0.15, 0, p.size);
          ctx.quadraticCurveTo(-p.size * 0.62, -p.size * 0.15, 0, -p.size);
          ctx.fill();
          ctx.globalAlpha = 0.55 * fade;
          ctx.strokeStyle = 'rgba(255,255,255,.75)';
          ctx.lineWidth = 0.7;
          ctx.beginPath(); ctx.moveTo(0, -p.size * 0.85); ctx.lineTo(0, p.size * 0.85); ctx.stroke();
          ctx.restore();
        } else if (p.kind === 'smoke') {
          var col = st.night ? '198,206,224' : '236,233,226';
          var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
          g.addColorStop(0, 'rgba(' + col + ',' + (p.alpha * fade) + ')');
          g.addColorStop(1, 'rgba(' + col + ',0)');
          ctx.fillStyle = g;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
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
        var g = ctx.createRadialGradient(x, y, 0, x, y, 9);
        g.addColorStop(0, 'rgba(217,247,161,' + (0.8 * a) + ')');
        g.addColorStop(0.35, 'rgba(196,240,120,' + (0.3 * a) + ')');
        g.addColorStop(1, 'rgba(196,240,120,0)');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(x, y, 9, 0, 7); ctx.fill();
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

    function updateFlockRuns(dt) {
      if (st.clock >= st.nextFlockAt && st.flockRuns.length < 2) {
        st.nextFlockAt = st.clock + 20000 + Math.random() * 26000;
        var fromLeft = Math.random() < 0.5;
        var n = 3 + Math.floor(Math.random() * 5);
        var members = [];
        for (var i = 0; i < n; i++) {
          members.push({ ox: -i * 16 - Math.random() * 6, oy: (i % 2 ? 1 : -1) * i * 5 + (Math.random() - 0.5) * 4, ph: Math.random() * 7 });
        }
        st.flockRuns.push({
          x: fromLeft ? -80 : st.w + 80, y: st.h * (0.06 + Math.random() * 0.2),
          vx: (fromLeft ? 1 : -1) * (22 + Math.random() * 16),
          drift: (Math.random() - 0.5) * 4,
          members: members
        });
      }
      st.flockRuns = st.flockRuns.filter(function(fr) {
        fr.x += fr.vx * dt / 1000;
        fr.y += fr.drift * dt / 1000;
        return fr.x > -220 && fr.x < st.w + 220;
      });
    }

    function drawFlockRuns(ctx) {
      var t = st.clock / 1000;
      ctx.save();
      ctx.strokeStyle = st.night ? 'rgba(26,30,40,.75)' : 'rgba(38,44,40,.6)';
      ctx.lineWidth = 1.4;
      ctx.lineCap = 'round';
      st.flockRuns.forEach(function(fr) {
        var dir = fr.vx >= 0 ? 1 : -1;
        fr.members.forEach(function(m) {
          var x = fr.x + m.ox * dir, y = fr.y + m.oy;
          var f = Math.sin(t * 9 + m.ph) * 2.6;
          ctx.beginPath();
          ctx.moveTo(x - 4, y - f);
          ctx.quadraticCurveTo(x, y + 2, x, y);
          ctx.quadraticCurveTo(x, y + 2, x + 4, y - f);
          ctx.stroke();
        });
      });
      ctx.restore();
    }

    // ---- glows --------------------------------------------------------------

    function updateGlows(dt) {
      var t = st.clock / 1000;
      st.glows.forEach(function(g) {
        // Life in the windows: mostly lit, but every light in the Academy
        // sometimes goes out for a few seconds — someone moved to another room.
        if (st.clock >= g.switchAt) {
          if (g.lit && Math.random() < g.style.offChance * 60) {
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
        g.el.style.opacity = String(Math.max(0, Math.min(1, g.cur)));
      });
    }

    // ---- chirps from the perched flock --------------------------------------

    function updateChirps() {
      if (st.clock < st.nextChirpAt || !st.perchPts.length) return;
      st.nextChirpAt = st.clock + 4500 + Math.random() * 6500;
      var p = st.perchPts[Math.floor(Math.random() * st.perchPts.length)];
      if (st.particles.length >= MAX_PARTICLES) return;
      // Perched companions mostly chirp; now and then one preens a feather loose.
      if (Math.random() < 0.3) spawnFeather(p.x, p.y + 10, null);
      else spawnNote(p.x + 6, p.y - 6, true);
    }

    // ---- main loop -----------------------------------------------------------

    function tick(now) {
      st.raf = 0;
      if (!st.running) return;
      if (typeof document !== 'undefined' && document.hidden) { st.lastT = 0; schedule(); return; }
      if (!screenActive()) { st.lastT = 0; schedule(); return; }
      if (!st.cont || !st.cont.isConnected) { pause(); return; }
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
      syncFlyers(false);
      updateFlyers(dt);
      updateEmitters();
      ensureAmbientActors();
      updateFlockRuns(dt);
      updateGlows(dt);
      updateChirps();
      // The canopy sheds the odd leaf; a touch more often when the wind leans.
      if (Math.random() < (0.004 + Math.abs(wind) * 0.0004) * dt / 16 && countKind('leaf') < 7) spawnLeaf();
      // Daylight dust motes drift where the sun breaks through.
      if (st.lightBoost < 0.4 && Math.random() < 0.02 && countKind('mote') < 12) {
        st.particles.push({ kind: 'mote', x: st.w * (0.1 + Math.random() * 0.55), y: st.h * (0.08 + Math.random() * 0.5), vx: 3 + Math.random() * 4, vy: -(1 + Math.random() * 2), size: 0.8 + Math.random() * 1.1, ph: Math.random() * 7, life: 0, max: 6000 + Math.random() * 4000 });
      }
      updateParticles(dt, wind);
      updateMotes(dt);

      // The sky canvas only ever holds distant flocks — skip it entirely on
      // the (majority of) frames when none are crossing.
      if (st.flockRuns.length || st.skyDirty) {
        st.skyCtx.clearRect(0, 0, st.w, st.h);
        drawFlockRuns(st.skyCtx);
        st.skyDirty = st.flockRuns.length > 0;
      }
      st.frontCtx.clearRect(0, 0, st.w, st.h);
      drawMotes(st.frontCtx);
      drawParticles(st.frontCtx);
      drawFireflies(st.frontCtx);
      drawButterflies(st.frontCtx);

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
      syncFlyers(true);
      schedule();
    }

    function pause() {
      st.running = false;
      if (st.raf) { cancelAnimationFrame(st.raf); st.raf = 0; }
      st.lastT = 0;
    }

    function stop() {
      pause();
      Object.keys(st.flyers).forEach(removeFlyer);
      st.particles = [];
      st.fireflies = [];
      st.butterflies = [];
      st.flockRuns = [];
      if (st.resizeObs) { st.resizeObs.disconnect(); st.resizeObs = null; }
      ['shadeEl', 'lightEl', 'sky', 'front', 'flyerLayer'].forEach(function(k) {
        if (st[k] && st[k].parentNode) st[k].remove();
        st[k] = null;
      });
      st.glows.forEach(function(g) { if (g.el && g.el.parentNode) g.el.remove(); });
      st.glows = [];
      st.emitters = [];
      st.mounted = false;
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

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function() {
        // rAF stops in hidden tabs anyway; this clears lastT so the first
        // visible frame doesn't integrate a giant dt.
        st.lastT = 0;
      });
    }

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
    cubicAt: cubicAt,
    cubicTanAt: cubicTanAt,
    makeFlightLeg: makeFlightLeg,
    pickFlyers: pickFlyers,
    createAcademyAlive: createAcademyAlive
  };
});
