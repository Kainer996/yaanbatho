/**
 * YAAN MASCOT v20 — Space Explorer, now a proper resident of the Lumenform works.
 *
 * He walks the floor deck and the header gantry, grapples up, jetpacks down,
 * BOARDS THE LIFT and rides it as you scroll, gets startled when your cursor
 * sneaks up on him, and comments on whichever part of the studio you're viewing.
 *
 * Requires js/world-v20.js (window.LumenWorld) for floor / header / lift geometry.
 */
(function () {
  'use strict';

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var CFG = {
    charW: 28,
    charH: 40,
    walkSpeed: 68,
    edgePad: 20,
    grappleInterval: [7000, 13000],
    platformWalkTime: [12000, 20000],
    liftChance: 0.5,          // odds he goes for the lift instead of grappling
    rideMinTime: 6000,        // stays aboard at least this long
    quips: [
      "You alright, hun? 👋",
      "Welcome to LUMENFORM ✨",
      "This website is crisp... 🤌",
      "...like the edge of a good lasagna. 🍝",
      "Check out my bangers on the music tab 🎵",
      "I'm hungry as usual 🥧",
      "My legs are killing me 😩",
      "It's been at least three minutes since I ate a pie 🥧",
      "My head is too big for this helmet 😅",
      "My helmet is too small for this head 🪖",
      "This jet pack is burning my feet 🔥",
      "Now, was this a website or what? 😎",
      "Houston, we're good 🚀",
      "MotoGP from space! 🏍️",
      "BBC R1 to the moon 🎵",
      "Low gravity vibes 🌙",
      "Hi Addie! 💕",
      "Built this myself 😎",
      "Chifftown: population me 🏙️",
      "T-minus let's go! ⚡",
      "Keep scrolling — it turns the cogs ⚙️",
      "I oil these gears myself, you know 🛢️",
      "Mind the lift on your way down 🛗",
    ],
    rideQuips: [
      "Going up! 🛗",
      "Scroll harder, this lift won't drive itself ⚙️",
      "Best view in the studio from here 👀",
      "Please keep arms inside the cage 🙌",
    ],
    startleQuips: [
      "Oi! Watch the boots 🥾",
      "That tickles 😄",
      "Personal space, hun! 😅",
      "You made me drop my pie 🥧",
    ],
    sectionQuips: {
      hero:         ["That's the cast up there — all ours 🎬", "Lights on. Welcome in ✨"],
      manifesto:    ["We give light a shape. I give pies a home 🥧", "Deep stuff this. I helped write it 📝"],
      work:         ["I helped ship every one of these 🔧", "This section took ages. Worth it 😮‍💨", "Click one! Go on 👆"],
      capabilities: ["We do all this before lunch 🍝", "Machines dream. I supervise 🛠️"],
      sound:        ["Check out my bangers on the music tab 🎵", "Turn it UP 🔊"],
      studio:       ["Best little studio in orbit 🛰️", "Human-built, helmet-tested 🪖"],
      contact:      ["Go on, say hello 📡", "We answer faster than light ⚡"],
    },
  };

  // ─── STATE ─────────────────────────────────────────────────────────────────
  var mascot, bubble, shadowEl;
  var svgEl, grappleLine, grappleHook;

  var x = 60, y = 0;
  var direction = 1;
  var velX = CFG.walkSpeed;
  var state = 'floor-walk'; // floor-walk | header-walk | jetpacking | walk-to-lift | riding | grapple-aim
  var lastTime = null;
  var quipIndex = 0;

  var grappleTimer = null;
  var leaveTimer = null;
  var isGrappling = false;
  var boardedAt = 0;
  var startleCooldownUntil = 0;
  var sectionQuipCooldownUntil = 0;
  var braceTimer = null;
  var lastScrollYForBrace = window.scrollY;
  var autoQuipTimer = null;

  // ─── GEOMETRY (via LumenWorld, with fallbacks) ─────────────────────────────
  var BOOT_EXT = 20;

  function world() { return window.LumenWorld || null; }

  function floorSurface() {
    var w = world();
    return w ? w.floorSurface() : window.innerHeight - 22;
  }
  function headerSurfaceY() {
    var w = world();
    if (w) return w.headerSurface();
    var h = document.querySelector('header');
    return h ? h.getBoundingClientRect().bottom : 70;
  }
  function floorY()  { return floorSurface() - CFG.charH; }
  function headerY() { return headerSurfaceY() - CFG.charH - BOOT_EXT; }
  function liftInfo() {
    var w = world();
    return w ? w.liftInfo() : null;
  }

  // ─── INIT ───────────────────────────────────────────────────────────────────
  function init() {
    var ns = 'http://www.w3.org/2000/svg';
    svgEl = document.createElementNS(ns, 'svg');
    svgEl.setAttribute('style', 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;overflow:visible');
    grappleLine = document.createElementNS(ns, 'line');
    grappleLine.setAttribute('stroke', '#cc0000');
    grappleLine.setAttribute('stroke-width', '2.5');
    grappleLine.setAttribute('stroke-dasharray', '5,3');
    grappleLine.setAttribute('opacity', '0');
    grappleHook = document.createElementNS(ns, 'circle');
    grappleHook.setAttribute('r', '5');
    grappleHook.setAttribute('fill', '#cc0000');
    grappleHook.setAttribute('stroke', '#880000');
    grappleHook.setAttribute('stroke-width', '1.5');
    grappleHook.setAttribute('opacity', '0');
    svgEl.appendChild(grappleLine);
    svgEl.appendChild(grappleHook);
    document.body.appendChild(svgEl);

    shadowEl = document.createElement('div');
    shadowEl.style.cssText = 'position:fixed;width:32px;height:6px;background:rgba(0,0,0,0.2);border-radius:50%;pointer-events:none;z-index:9997;';
    document.body.appendChild(shadowEl);

    mascot = document.createElement('div');
    mascot.id = 'site-mascot';
    mascot.innerHTML =
      '<div class="mascot-head">' +
        '<img src="/images/yaan_face_v2.jpg" alt="" draggable="false" />' +
      '</div>' +
      '<div class="mascot-body">' +
        '<div class="mascot-torso">' +
          '<div class="mascot-arm left"></div>' +
          '<div class="mascot-arm right"></div>' +
        '</div>' +
        '<div class="mascot-waist"></div>' +
        '<div class="mascot-legs">' +
          '<div class="mascot-leg left"></div>' +
          '<div class="mascot-leg right"></div>' +
        '</div>' +
        '<div class="mascot-jetpack">' +
          '<div class="jpack jpack-l"><div class="jflame"></div></div>' +
          '<div class="jpack jpack-r"><div class="jflame"></div></div>' +
        '</div>' +
      '</div>';
    bubble = document.createElement('div');
    bubble.className = 'mascot-bubble';
    mascot.appendChild(bubble);
    document.body.appendChild(mascot);

    x = 80;
    y = floorY();
    applyPos();

    mascot.addEventListener('click', onMascotClick);
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('scroll', onScrollBrace, { passive: true });
    document.addEventListener('lumen:section', onSectionChange);

    setState('floor-walk');
    scheduleGrapple();
    requestAnimationFrame(loop);

    autoQuipTimer = setTimeout(fireQuip, 5000);
  }

  // ─── LOOP ──────────────────────────────────────────────────────────────────
  function loop(ts) {
    var dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.06) : 0;
    lastTime = ts;
    if (!isGrappling) tick(dt);
    requestAnimationFrame(loop);
  }

  function tick(dt) {
    var vw = window.innerWidth;
    var minX = CFG.edgePad;
    var maxX = vw - CFG.charW - CFG.edgePad;

    if (state === 'floor-walk' || state === 'header-walk') {
      y = state === 'floor-walk' ? floorY() : headerY();
      x += velX * dt;
      if (x >= maxX) { x = maxX; velX = -CFG.walkSpeed; direction = -1; updateFacing(); }
      if (x <= minX) { x = minX; velX = CFG.walkSpeed; direction = 1; updateFacing(); }
    }

    else if (state === 'walk-to-lift') {
      var lift = liftInfo();
      if (!lift || !lift.atFloor) {
        // lift left without him — never mind
        velX = direction * CFG.walkSpeed;
        setState('floor-walk');
      } else {
        y = floorY();
        var targetX = lift.x - CFG.charW / 2;
        var dx = targetX - x;
        direction = dx >= 0 ? 1 : -1;
        updateFacing();
        x += Math.sign(dx) * CFG.walkSpeed * dt;
        if (Math.abs(dx) < 3) {
          x = targetX;
          boardedAt = performance.now();
          setState('riding');
          if (Math.random() < 0.7) showBubble(pick(CFG.rideQuips));
        }
      }
    }

    else if (state === 'riding') {
      var l = liftInfo();
      if (!l) { setState('floor-walk'); return; }
      x = l.x - CFG.charW / 2;
      y = l.surfaceY - CFG.charH;

      var aboard = performance.now() - boardedAt;
      if (l.atHeader && aboard > 1200) {
        // step off onto the header gantry
        y = headerY();
        velX = CFG.walkSpeed; direction = 1; updateFacing();
        spawnPuff();
        setState('header-walk');
        scheduleLeaveHeader();
      } else if (l.atFloor && aboard > CFG.rideMinTime) {
        // bored — hop off back onto the floor
        y = floorY();
        velX = CFG.walkSpeed; direction = 1; updateFacing();
        setState('floor-walk');
        scheduleGrapple();
      }
    }

    else if (state === 'jetpacking') {
      y += 180 * dt;
      x += velX * dt * 0.3;
      if (x > maxX) { x = maxX; velX = -Math.abs(velX); direction = -1; updateFacing(); }
      if (x < minX) { x = minX; velX = Math.abs(velX); direction = 1; updateFacing(); }
      if (y >= floorY()) {
        y = floorY();
        spawnPuff();
        velX = direction * CFG.walkSpeed;
        setState('floor-walk');
        scheduleGrapple();
      }
    }

    applyPos();
    updateShadow();
  }

  // ─── POSITION ──────────────────────────────────────────────────────────────
  function applyPos() {
    var cssLeft = direction === -1 ? Math.round(x + CFG.charW) : Math.round(x);
    mascot.style.left = cssLeft + 'px';
    mascot.style.top = Math.round(y) + 'px';
    mascot.style.bottom = 'auto';
  }

  function updateShadow() {
    var atFloor = Math.abs(y - floorY()) < 6;
    shadowEl.style.left = (x + 8) + 'px';
    shadowEl.style.top = (floorY() + CFG.charH + 2) + 'px';
    shadowEl.style.bottom = 'auto';
    shadowEl.style.transform = atFloor ? 'scaleX(1)' : 'scaleX(0.4)';
    shadowEl.style.opacity = atFloor ? '0.25' : '0.08';
  }

  // ─── STATES ────────────────────────────────────────────────────────────────
  function setState(s) {
    state = s;
    mascot.classList.remove('state-idle', 'state-walk', 'state-jump', 'state-wave', 'state-grapple-aim', 'state-jetpack', 'state-ride', 'state-startle');
    if (s === 'floor-walk' || s === 'header-walk' || s === 'walk-to-lift') mascot.classList.add('state-walk');
    else if (s === 'riding') mascot.classList.add('state-ride');
    else if (s === 'jetpacking') mascot.classList.add('state-jetpack');
    else if (s === 'grapple-aim') mascot.classList.add('state-grapple-aim');
    else mascot.classList.add('state-idle');
  }

  function updateFacing() {
    if (direction === -1) mascot.classList.add('facing-left');
    else mascot.classList.remove('facing-left');
  }

  // ─── GETTING UPSTAIRS: lift or grapple ─────────────────────────────────────
  function scheduleGrapple() {
    clearTimeout(grappleTimer);
    var delay = CFG.grappleInterval[0] + Math.random() * (CFG.grappleInterval[1] - CFG.grappleInterval[0]);
    grappleTimer = setTimeout(goUpSomehow, delay);
  }

  function goUpSomehow() {
    if (isGrappling || state !== 'floor-walk') { scheduleGrapple(); return; }
    var lift = liftInfo();
    if (lift && lift.atFloor && Math.random() < CFG.liftChance) {
      setState('walk-to-lift');
    } else {
      doGrapple();
    }
  }

  function scheduleLeaveHeader() {
    clearTimeout(leaveTimer);
    var leaveDelay = CFG.platformWalkTime[0] + Math.random() * (CFG.platformWalkTime[1] - CFG.platformWalkTime[0]);
    leaveTimer = setTimeout(doJetpack, leaveDelay);
  }

  // ─── GRAPPLE ───────────────────────────────────────────────────────────────
  function doGrapple() {
    if (isGrappling || state !== 'floor-walk') { scheduleGrapple(); return; }
    isGrappling = true;
    clearTimeout(leaveTimer);

    setState('grapple-aim');
    velX = 0;

    var tx = window.innerWidth / 2;
    var ty = headerY() + CFG.charH + BOOT_EXT;

    setTimeout(function () {
      var cx = x + CFG.charW / 2;
      var cy = y + CFG.charH / 2;
      shootLine(cx, cy, tx, ty, function () {
        reelIn(tx);
      });
    }, 400);
  }

  function shootLine(x1, y1, x2, y2, onDone) {
    grappleLine.setAttribute('x1', x1); grappleLine.setAttribute('y1', y1);
    grappleLine.setAttribute('x2', x1); grappleLine.setAttribute('y2', y1);
    grappleLine.setAttribute('opacity', '1');
    grappleHook.setAttribute('opacity', '0');

    var dur = 300, start = performance.now();
    function frame(ts) {
      var p = Math.min((ts - start) / dur, 1);
      var cx = x1 + (x2 - x1) * p;
      var cy = y1 + (y2 - y1) * p;
      grappleLine.setAttribute('x2', cx);
      grappleLine.setAttribute('y2', cy);
      grappleHook.setAttribute('cx', cx);
      grappleHook.setAttribute('cy', cy);
      grappleHook.setAttribute('opacity', String(p));
      if (p < 1) requestAnimationFrame(frame);
      else {
        grappleHook.setAttribute('r', '8');
        setTimeout(function () { grappleHook.setAttribute('r', '5'); }, 80);
        setTimeout(onDone, 180);
      }
    }
    requestAnimationFrame(frame);
  }

  function reelIn(tx) {
    var dur = 500, start = performance.now();
    var startX = x, startY = y;
    var targetY = headerY();
    var targetX = clamp(tx - CFG.charW / 2, CFG.edgePad, window.innerWidth - CFG.charW - CFG.edgePad);

    function frame(ts) {
      var p = ease(Math.min((ts - start) / dur, 1));
      x = startX + (targetX - startX) * p;
      y = startY + (targetY - startY) * p;

      grappleLine.setAttribute('x1', x + CFG.charW / 2);
      grappleLine.setAttribute('y1', y + CFG.charH / 2);
      applyPos();

      if (p < 1) {
        requestAnimationFrame(frame);
      } else {
        x = targetX; y = targetY; applyPos();
        spawnPuff();
        fadeGrapple();
        isGrappling = false;
        velX = CFG.walkSpeed; direction = 1; updateFacing();
        setState('header-walk');
        scheduleLeaveHeader();
      }
    }
    requestAnimationFrame(frame);
  }

  function fadeGrapple() {
    var op = 1;
    var id = setInterval(function () {
      op -= 0.15;
      if (op <= 0) {
        grappleLine.setAttribute('opacity', '0');
        grappleHook.setAttribute('opacity', '0');
        clearInterval(id);
      } else {
        grappleLine.setAttribute('opacity', String(op));
        grappleHook.setAttribute('opacity', String(op));
      }
    }, 30);
  }

  // ─── JETPACK ────────────────────────────────────────────────────────────────
  function doJetpack() {
    if (state !== 'header-walk') return;
    velX = direction * CFG.walkSpeed * 0.4;
    setState('jetpacking');
  }

  // ─── LANDING PUFF ──────────────────────────────────────────────────────────
  function spawnPuff() {
    for (var i = 0; i < 4; i++) {
      var p = document.createElement('div');
      var a = (i / 4) * Math.PI * 2;
      var bv = window.innerHeight - y - CFG.charH;
      p.style.cssText = 'position:fixed;left:' + (x + CFG.charW / 2) + 'px;bottom:' + bv + 'px;width:7px;height:7px;background:rgba(200,220,240,0.7);border-radius:50%;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);transition:all 0.4s ease-out;';
      document.body.appendChild(p);
      (function (el, ang, b) {
        requestAnimationFrame(function () {
          el.style.left = (x + CFG.charW / 2 + Math.cos(ang) * 20) + 'px';
          el.style.bottom = (b + Math.sin(ang) * 12 + 8) + 'px';
          el.style.opacity = '0';
          el.style.transform = 'translate(-50%,-50%) scale(2)';
        });
        setTimeout(function () { el.remove(); }, 450);
      })(p, a, bv);
    }
  }

  // ─── INTERACTIONS ──────────────────────────────────────────────────────────
  function onMascotClick(e) {
    e.stopPropagation();
    fireQuip();
  }

  // Cursor proximity: he notices you
  function onPointerMove(e) {
    if (performance.now() < startleCooldownUntil) return;
    if (state !== 'floor-walk' && state !== 'header-walk') return;
    var cx = x + CFG.charW / 2;
    var cy = y + CFG.charH / 2;
    var dist = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (dist < 80) {
      startleCooldownUntil = performance.now() + 8000;
      // face the cursor
      direction = e.clientX >= cx ? 1 : -1;
      updateFacing();
      var prevVel = velX;
      velX = 0;
      mascot.classList.add('state-startle');
      if (Math.random() < 0.45) showBubble(pick(CFG.startleQuips));
      setTimeout(function () {
        mascot.classList.remove('state-startle');
        velX = prevVel === 0 ? direction * CFG.walkSpeed : prevVel;
      }, 1400);
    }
  }

  // Hard scroll → brace
  function onScrollBrace() {
    var delta = Math.abs(window.scrollY - lastScrollYForBrace);
    lastScrollYForBrace = window.scrollY;
    if (delta > 48 && !braceTimer && (state === 'floor-walk' || state === 'header-walk')) {
      mascot.classList.add('state-brace');
      braceTimer = setTimeout(function () {
        mascot.classList.remove('state-brace');
        braceTimer = null;
      }, 380);
    }
  }

  // Section commentary (fired by lumenform.js)
  function onSectionChange(e) {
    var id = e.detail && e.detail.section;
    if (!id || !CFG.sectionQuips[id]) return;
    if (performance.now() < sectionQuipCooldownUntil) return;
    if (Math.random() > 0.5) return;
    sectionQuipCooldownUntil = performance.now() + 14000;
    showBubble(pick(CFG.sectionQuips[id]));
  }

  // ─── QUIPS ─────────────────────────────────────────────────────────────────
  function fireQuip() {
    var idx = quipIndex++ % CFG.quips.length;
    var quip = CFG.quips[idx];
    showBubble(quip);
    mascot.classList.add('state-wave');
    setTimeout(function () { mascot.classList.remove('state-wave'); }, 1200);

    var nextQuip = CFG.quips[quipIndex % CFG.quips.length];
    if (nextQuip && nextQuip.indexOf('...') === 0) {
      clearTimeout(autoQuipTimer);
      autoQuipTimer = setTimeout(function () {
        quipIndex++;
        showBubble(nextQuip);
        scheduleAutoQuip();
      }, 4300);
    } else {
      scheduleAutoQuip();
    }
  }

  function scheduleAutoQuip() {
    clearTimeout(autoQuipTimer);
    var delay = 14000 + Math.random() * 10000;
    autoQuipTimer = setTimeout(fireQuip, delay);
  }

  function showBubble(text) {
    bubble.textContent = text;
    bubble.classList.add('visible');
    bubble.style.left = x > window.innerWidth - 200 ? 'auto' : '0';
    bubble.style.right = x > window.innerWidth - 200 ? '0' : 'auto';
    setTimeout(function () { bubble.classList.remove('visible'); }, 3500);
  }

  // ─── UTILS ─────────────────────────────────────────────────────────────────
  function ease(t) { return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }

  // ─── START ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { setTimeout(init, 500); });
  else setTimeout(init, 500);
})();
