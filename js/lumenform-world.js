/* ═══════════════════════════════════════════════════════════════
   LUMENFORM WORLD — BATHO-01 and the studio machinery   (v20)
   Built on mascot-v19: two platforms (header line + floor deck),
   grapple up, jetpack down — now with a real lift he rides, cogs
   that drive the cable, drag + parachute, and section-aware quips.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const CFG = {
    charW: 28,
    charH: 40,
    bootExt: 20,            // boots render below the logical box
    walkSpeed: 68,
    edgePadLeft: 76,        // stay clear of the lift shaft while walking
    edgePadRight: 20,
    floorH: 24,
    cableX: 32,             // centre of the cable
    liftLeft: 8,
    liftW: 48,
    liftH: 58,
    liftSpeed: 95,          // px/s when carrying a passenger
    travelInterval: [9000, 16000],   // time on a platform before moving on
    quips: [
      "You alright, hun? 👋",
      "Welcome to Lumenform ✨",
      "This website is crisp... 🤌",
      "...like the edge of a good lasagna. 🍝",
      "I keep these cogs oiled myself ⚙️",
      "Check out my bangers on the music tab 🎵",
      "I'm hungry as usual 🥧",
      "My legs are killing me 😩",
      "It's been at least three minutes since I ate a pie 🥧",
      "My head is too big for this helmet 😅",
      "My helmet is too small for this head 🪖",
      "This jet pack is burning my feet 🔥",
      "Now, was this a studio or what? 😎",
      "Houston, we're good 🚀",
      "The lift's faster than the grapple. Don't tell the grapple 🛗",
      "MotoGP from space! 🏍️",
      "Low gravity vibes 🌙",
      "Hi Addie! 💕",
      "Built this place myself 😎",
      "We machine light into worlds. I machine pies into crumbs 🥧",
      "T-minus let's go! ⚡",
    ],
    dropQuips: [
      "Weeee! 🪂",
      "A heads up next time?! 🪂",
      "Standard chute procedure 🪂",
      "I meant to do that 😎",
    ],
    sectionQuips: {
      studio:       "This is where the light gets machined ✨",
      work:         "The Foundry! Mind the sparks 🔥",
      capabilities: "Engine room. Don't touch the red ones ⚙️",
      crew:         "Hey, that's my crew file! Looking good 😎",
      contact:      "Transmission deck — say hi, we read everything 📡",
    },
  };

  // ─── STATE ─────────────────────────────────────────────────────
  let mascot, bubble, shadowEl;
  let svgEl, grappleLine, grappleHook;
  let liftEl, counterweightEl, hudEl;
  const cogs = [];        // { wrap, gear, angle }

  let x = 90, y = 0;
  let direction = 1;
  let velX = CFG.walkSpeed;
  // floor-walk | header-walk | grapple-aim | jetpacking | to-lift |
  // lift-wait | lift-ride | drag | chute | idle
  let state = 'floor-walk';
  let lastTime = null;
  let isGrappling = false;
  let platform = 'floor'; // which platform he's on / heading from

  let travelTimer = null;
  let autoQuipTimer = null;
  let quipIndex = 0;

  // lift
  let liftY = 0;
  let liftTarget = null;   // null → follows scroll
  let liftDest = null;     // 'floor' | 'header' while carrying
  let liftArrive = null;   // callback on arrival

  // drag
  let dragging = false;
  let dragMoved = 0;
  let dragStart = 0;

  // scroll bookkeeping
  let lastScrollY = window.scrollY;
  let braceTimer = null;

  // ─── GEOMETRY ──────────────────────────────────────────────────
  let _headerBottom = 66;
  function measureHeader() {
    const h = document.querySelector('header');
    _headerBottom = h ? h.getBoundingClientRect().bottom : 66;
  }

  function floorY()  { return window.innerHeight - CFG.charH - CFG.floorH; }
  function headerY() { return _headerBottom - CFG.charH - CFG.bootExt; }

  function liftTopY()    { return _headerBottom + 8; }
  function liftBottomY() { return window.innerHeight - CFG.floorH - CFG.liftH; }
  function liftBoardX()  { return CFG.liftLeft + (CFG.liftW - CFG.charW) / 2; }

  // mascot y when standing inside the cage
  function liftRiderY() { return liftY + CFG.liftH - CFG.charH - CFG.bootExt - 2; }

  function minX() { return CFG.edgePadLeft; }
  function maxX() { return window.innerWidth - CFG.charW - CFG.edgePadRight; }

  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
  const ease = t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

  // ─── COG SVG ───────────────────────────────────────────────────
  function buildGearPath(teeth, outerR, innerR) {
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const toothSpan = 0.28;
      const a1 = (i / teeth) * Math.PI * 2 - toothSpan;
      const a2 = (i / teeth) * Math.PI * 2 + toothSpan;
      const ai1 = (i / teeth) * Math.PI * 2 - toothSpan * 0.5 + Math.PI / teeth;
      const ai2 = (i / teeth) * Math.PI * 2 + toothSpan * 0.5 + Math.PI / teeth;
      if (i === 0) d += `M${(Math.cos(a1) * outerR).toFixed(2)} ${(Math.sin(a1) * outerR).toFixed(2)} `;
      d += `L${(Math.cos(a1) * outerR).toFixed(2)} ${(Math.sin(a1) * outerR).toFixed(2)} `;
      d += `L${(Math.cos(a2) * outerR).toFixed(2)} ${(Math.sin(a2) * outerR).toFixed(2)} `;
      d += `L${(Math.cos(ai1) * innerR).toFixed(2)} ${(Math.sin(ai1) * innerR).toFixed(2)} `;
      d += `L${(Math.cos(ai2) * innerR).toFixed(2)} ${(Math.sin(ai2) * innerR).toFixed(2)} `;
    }
    return d + 'Z';
  }

  function makeCog(size, atTop) {
    const r = size / 2;
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('width', size);
    svg.setAttribute('height', size);
    svg.setAttribute('viewBox', `${-r} ${-r} ${size} ${size}`);
    svg.style.cssText = 'display:block;overflow:visible;';

    const gear = document.createElementNS(ns, 'path');
    gear.setAttribute('d', buildGearPath(10, r * 0.95, r * 0.68));
    gear.setAttribute('fill', '#5d5d5d');
    gear.setAttribute('stroke', '#2c2c2c');
    gear.setAttribute('stroke-width', '1');

    const hub = document.createElementNS(ns, 'circle');
    hub.setAttribute('r', (r * 0.28).toFixed(1));
    hub.setAttribute('fill', '#cc0000');
    hub.setAttribute('stroke', '#7a0000');
    hub.setAttribute('stroke-width', '1.5');

    const axle = document.createElementNS(ns, 'circle');
    axle.setAttribute('r', (r * 0.12).toFixed(1));
    axle.setAttribute('fill', '#141414');

    svg.appendChild(gear);
    svg.appendChild(hub);
    svg.appendChild(axle);

    const wrap = document.createElement('div');
    wrap.style.cssText = `position:fixed;left:${CFG.cableX - r}px;width:${size}px;height:${size}px;z-index:8992;pointer-events:none;`;
    wrap.appendChild(svg);
    document.body.appendChild(wrap);

    const cog = { wrap, gear, angle: 0, atTop, r };
    cogs.push(cog);
    positionCog(cog);
    return cog;
  }

  function positionCog(cog) {
    if (cog.atTop) {
      cog.wrap.style.top = (_headerBottom - cog.r) + 'px';
      cog.wrap.style.bottom = 'auto';
    } else {
      cog.wrap.style.bottom = (CFG.floorH - cog.r) + 'px';
      cog.wrap.style.top = 'auto';
    }
  }

  function spinCogs(delta) {
    cogs.forEach(c => {
      c.angle += delta;
      c.gear.setAttribute('transform', `rotate(${c.angle.toFixed(1)})`);
    });
  }

  // ─── BUILD ─────────────────────────────────────────────────────
  function buildWorld() {
    // floor deck
    const floor = document.createElement('div');
    floor.id = 'lf-floor';
    document.body.appendChild(floor);

    // cable
    const cable = document.createElement('div');
    cable.className = 'lf-cable';
    cable.style.left = (CFG.cableX - 2) + 'px';
    document.body.appendChild(cable);

    // counterweight
    counterweightEl = document.createElement('div');
    counterweightEl.id = 'lf-counterweight';
    document.body.appendChild(counterweightEl);

    // lift cage
    liftEl = document.createElement('div');
    liftEl.id = 'lf-lift';
    liftEl.innerHTML =
      '<div class="lf-lift-cabin"></div>' +
      '<span class="lf-lift-lamp"></span>' +
      '<span class="lf-lift-label">LIFT</span>';
    liftEl.title = 'Studio lift — click to call';
    document.body.appendChild(liftEl);
    liftEl.addEventListener('click', onLiftClick);

    // cogs at both ends of the cable
    makeCog(30, true);
    makeCog(30, false);

    // level HUD
    hudEl = document.createElement('div');
    hudEl.id = 'lf-hud';
    hudEl.innerHTML =
      '<span class="lf-hud-level">LVL 00 · SURFACE</span>' +
      '<span class="lf-hud-depth">0m</span>';
    document.body.appendChild(hudEl);

    liftY = liftScrollY();
    applyLift();
  }

  function buildMascot() {
    // grapple overlay
    const ns = 'http://www.w3.org/2000/svg';
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

    // ground shadow
    shadowEl = document.createElement('div');
    shadowEl.style.cssText = 'position:fixed;width:32px;height:6px;background:rgba(0,0,0,0.25);border-radius:50%;pointer-events:none;z-index:9997;';
    document.body.appendChild(shadowEl);

    mascot = document.createElement('div');
    mascot.id = 'site-mascot';
    mascot.innerHTML = `
      <div class="mascot-chute"></div>
      <div class="mascot-head">
        <img src="/images/yaan_face_v2.jpg" alt="" draggable="false" />
      </div>
      <div class="mascot-body">
        <div class="mascot-torso">
          <div class="mascot-arm left"></div>
          <div class="mascot-arm right"></div>
        </div>
        <div class="mascot-waist"></div>
        <div class="mascot-legs">
          <div class="mascot-leg left"></div>
          <div class="mascot-leg right"></div>
        </div>
        <div class="mascot-jetpack">
          <div class="jpack jpack-l"><div class="jflame"></div></div>
          <div class="jpack jpack-r"><div class="jflame"></div></div>
        </div>
      </div>`;
    bubble = document.createElement('div');
    bubble.className = 'mascot-bubble';
    mascot.appendChild(bubble);
    document.body.appendChild(mascot);

    mascot.addEventListener('pointerdown', onPointerDown);
  }

  // ─── POSITION ──────────────────────────────────────────────────
  function applyPos() {
    const cssLeft = direction === -1 ? Math.round(x + CFG.charW) : Math.round(x);
    mascot.style.left = cssLeft + 'px';
    mascot.style.top = Math.round(y) + 'px';
  }

  function updateShadow() {
    const feet = y + CFG.charH + CFG.bootExt;
    const ground = (platform === 'header' && (state === 'header-walk' || state === 'idle'))
      ? _headerBottom
      : window.innerHeight - CFG.floorH + 4;
    const air = clamp((ground - feet) / 240, 0, 1);
    shadowEl.style.left = (x - 2) + 'px';
    shadowEl.style.top = (ground - 4) + 'px';
    shadowEl.style.transform = `scaleX(${(1 - air * 0.6).toFixed(2)})`;
    shadowEl.style.opacity = String(0.28 - air * 0.2);
  }

  function setState(s) {
    state = s;
    mascot.classList.remove(
      'state-idle', 'state-walk', 'state-wave', 'state-grapple-aim',
      'state-jetpack', 'state-lift', 'state-drag', 'state-chute', 'state-brace'
    );
    if (s === 'floor-walk' || s === 'header-walk' || s === 'to-lift') mascot.classList.add('state-walk');
    else if (s === 'idle' || s === 'lift-wait') mascot.classList.add('state-idle');
    else if (s === 'jetpacking') mascot.classList.add('state-jetpack');
    else if (s === 'grapple-aim') mascot.classList.add('state-grapple-aim');
    else if (s === 'lift-ride') mascot.classList.add('state-lift');
    else if (s === 'drag') mascot.classList.add('state-drag');
    else if (s === 'chute') mascot.classList.add('state-chute');
  }

  function updateFacing() {
    mascot.classList.toggle('facing-left', direction === -1);
  }

  function face(dir) {
    direction = dir;
    updateFacing();
  }

  // ─── MAIN LOOP ─────────────────────────────────────────────────
  function loop(ts) {
    const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.06) : 0;
    lastTime = ts;
    tick(dt);
    requestAnimationFrame(loop);
  }

  function tick(dt) {
    // ── lift physics (always runs) ──
    const prevLiftY = liftY;
    if (liftTarget !== null) {
      const d = liftTarget - liftY;
      // an empty cage answers calls faster than it carries passengers
      const speed = state === 'lift-ride' ? CFG.liftSpeed : CFG.liftSpeed * 1.8;
      const step = speed * dt;
      if (Math.abs(d) <= step) {
        liftY = liftTarget;
        liftTarget = null;
        liftEl.classList.remove('is-moving');
        if (liftArrive) { const cb = liftArrive; liftArrive = null; cb(); }
      } else {
        liftY += Math.sign(d) * step;
      }
    } else if (state !== 'lift-ride') {
      // follow the scroll — the page IS the lift shaft
      liftY += (liftScrollY() - liftY) * Math.min(1, dt * 5);
    }
    if (Math.abs(liftY - prevLiftY) > 0.05) spinCogs((liftY - prevLiftY) * 1.4);
    applyLift();

    // ── mascot ──
    if (dragging) { applyPos(); updateShadow(); return; }

    if (state === 'floor-walk' || state === 'header-walk') {
      y = state === 'floor-walk' ? floorY() : headerY();
      x += velX * dt;
      if (x >= maxX()) { x = maxX(); velX = -CFG.walkSpeed; face(-1); }
      if (x <= minX()) { x = minX(); velX = CFG.walkSpeed; face(1); }
    }

    else if (state === 'to-lift') {
      y = platform === 'floor' ? floorY() : headerY();
      const tx = liftBoardX();
      const d = tx - x;
      face(d < 0 ? -1 : 1);
      const step = CFG.walkSpeed * dt;
      if (Math.abs(d) <= step) {
        x = tx;
        callLiftForRide();
      } else {
        x += Math.sign(d) * step;
      }
    }

    else if (state === 'lift-ride') {
      x = liftBoardX();
      y = liftRiderY();
    }

    else if (state === 'jetpacking') {
      y += 180 * dt;
      x += velX * dt * 0.3;
      if (x > maxX()) { x = maxX(); velX = -Math.abs(velX); face(-1); }
      if (x < minX()) { x = minX(); velX = Math.abs(velX); face(1); }
      if (y >= floorY()) {
        y = floorY();
        spawnPuff();
        platform = 'floor';
        velX = direction * CFG.walkSpeed;
        setState('floor-walk');
        scheduleTravel();
      }
    }

    else if (state === 'chute') {
      y += 70 * dt;
      x += Math.sin(performance.now() / 400) * 18 * dt;
      x = clamp(x, 4, window.innerWidth - CFG.charW - 4);
      if (y >= floorY()) {
        y = floorY();
        platform = 'floor';
        spawnPuff();
        showBubble(CFG.dropQuips[Math.floor(Math.random() * CFG.dropQuips.length)]);
        velX = direction * CFG.walkSpeed;
        setState('floor-walk');
        scheduleTravel();
      }
    }

    applyPos();
    updateShadow();
  }

  // ─── LIFT ──────────────────────────────────────────────────────
  function liftScrollY() {
    const doc = document.documentElement;
    const max = Math.max(1, doc.scrollHeight - window.innerHeight);
    const p = clamp(window.scrollY / max, 0, 1);
    return liftTopY() + p * (liftBottomY() - liftTopY());
  }

  function applyLift() {
    liftEl.style.top = Math.round(liftY) + 'px';

    // counterweight mirrors the cage on the guide rail
    const span = liftBottomY() - liftTopY();
    const p = span > 0 ? (liftY - liftTopY()) / span : 0;
    const cwY = liftTopY() + (1 - p) * (span + CFG.liftH - 30);
    counterweightEl.style.top = Math.round(clamp(cwY, liftTopY(), window.innerHeight - CFG.floorH - 30)) + 'px';
  }

  function sendLift(targetY, onArrive) {
    liftTarget = clamp(targetY, liftTopY(), liftBottomY());
    liftArrive = onArrive || null;
    liftEl.classList.add('is-moving');
  }

  function onLiftClick(e) {
    e.stopPropagation();
    // call the lift to the spaceman; he appreciates it
    if (state === 'floor-walk' || state === 'header-walk' || state === 'idle') {
      beginLiftRide();
    }
  }

  function beginLiftRide() {
    if (state === 'lift-ride' || state === 'lift-wait' || isGrappling || dragging) return;
    clearTimeout(travelTimer);
    setState('to-lift');
  }

  function callLiftForRide() {
    setState('lift-wait');
    face(-1); // look at the shaft while waiting
    const boardY = platform === 'floor' ? liftBottomY() : liftTopY();
    sendLift(boardY, () => {
      // step in and ride to the other end
      setState('lift-ride');
      face(1);
      const dest = platform === 'floor' ? 'header' : 'floor';
      liftDest = dest;
      sendLift(dest === 'header' ? liftTopY() : liftBottomY(), () => {
        platform = liftDest;
        liftDest = null;
        x = liftBoardX() + 6;
        y = platform === 'floor' ? floorY() : headerY();
        velX = CFG.walkSpeed;
        face(1);
        spawnPuff();
        setState(platform === 'floor' ? 'floor-walk' : 'header-walk');
        scheduleTravel();
      });
    });
  }

  // ─── TRAVEL SCHEDULER ──────────────────────────────────────────
  function scheduleTravel() {
    clearTimeout(travelTimer);
    const [a, b] = CFG.travelInterval;
    travelTimer = setTimeout(() => {
      if (dragging || isGrappling) { scheduleTravel(); return; }
      if (state === 'floor-walk') {
        Math.random() < 0.5 ? doGrapple() : beginLiftRide();
      } else if (state === 'header-walk') {
        Math.random() < 0.5 ? doJetpack() : beginLiftRide();
      } else {
        scheduleTravel();
      }
    }, a + Math.random() * (b - a));
  }

  // ─── GRAPPLE (from v19) ────────────────────────────────────────
  function doGrapple() {
    if (isGrappling || state !== 'floor-walk') { scheduleTravel(); return; }
    isGrappling = true;
    setState('grapple-aim');
    velX = 0;

    const tx = clamp(window.innerWidth / 2, 200, window.innerWidth - 100);
    const ty = headerY() + CFG.charH + CFG.bootExt;

    setTimeout(() => {
      if (dragging) { isGrappling = false; fadeGrapple(); return; }
      const cx = x + CFG.charW / 2;
      const cy = y + CFG.charH / 2;
      shootLine(cx, cy, tx, ty, () => reelIn(tx));
    }, 400);
  }

  function shootLine(x1, y1, x2, y2, onDone) {
    grappleLine.setAttribute('x1', x1); grappleLine.setAttribute('y1', y1);
    grappleLine.setAttribute('x2', x1); grappleLine.setAttribute('y2', y1);
    grappleLine.setAttribute('opacity', '1');
    grappleHook.setAttribute('opacity', '0');

    const dur = 300, start = performance.now();
    function frame(ts) {
      const p = Math.min((ts - start) / dur, 1);
      const cx = x1 + (x2 - x1) * p;
      const cy = y1 + (y2 - y1) * p;
      grappleLine.setAttribute('x2', cx);
      grappleLine.setAttribute('y2', cy);
      grappleHook.setAttribute('cx', cx);
      grappleHook.setAttribute('cy', cy);
      grappleHook.setAttribute('opacity', String(p));
      if (p < 1) requestAnimationFrame(frame);
      else {
        grappleHook.setAttribute('r', '8');
        setTimeout(() => grappleHook.setAttribute('r', '5'), 80);
        setTimeout(onDone, 180);
      }
    }
    requestAnimationFrame(frame);
  }

  function reelIn(tx) {
    const dur = 500, start = performance.now();
    const startX = x, startY = y;
    const targetY = headerY();
    const targetX = clamp(tx - CFG.charW / 2, minX(), maxX());

    function frame(ts) {
      if (dragging) { fadeGrapple(); isGrappling = false; return; }
      const p = ease(Math.min((ts - start) / dur, 1));
      x = startX + (targetX - startX) * p;
      y = startY + (targetY - startY) * p;
      grappleLine.setAttribute('x1', x + CFG.charW / 2);
      grappleLine.setAttribute('y1', y + CFG.charH / 2);
      applyPos();

      if (p < 1) requestAnimationFrame(frame);
      else {
        x = targetX; y = targetY;
        applyPos();
        spawnPuff();
        fadeGrapple();
        isGrappling = false;
        platform = 'header';
        velX = CFG.walkSpeed;
        face(1);
        setState('header-walk');
        scheduleTravel();
      }
    }
    requestAnimationFrame(frame);
  }

  function fadeGrapple() {
    let op = 1;
    const id = setInterval(() => {
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

  // ─── JETPACK ───────────────────────────────────────────────────
  function doJetpack() {
    if (state !== 'header-walk') { scheduleTravel(); return; }
    velX = direction * CFG.walkSpeed * 0.4;
    setState('jetpacking');
  }

  // ─── LANDING PUFF ──────────────────────────────────────────────
  function spawnPuff() {
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('div');
      const a = (i / 4) * Math.PI * 2;
      const feet = y + CFG.charH + CFG.bootExt;
      p.style.cssText = `position:fixed;left:${x + CFG.charW / 2}px;top:${feet}px;width:7px;height:7px;background:rgba(200,220,240,0.7);border-radius:50%;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);transition:all 0.4s ease-out;`;
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.left = (x + CFG.charW / 2 + Math.cos(a) * 20) + 'px';
        p.style.top = (feet - Math.sin(a) * 12 - 8) + 'px';
        p.style.opacity = '0';
        p.style.transform = 'translate(-50%,-50%) scale(2)';
      });
      setTimeout(() => p.remove(), 450);
    }
  }

  // ─── DRAG & PARACHUTE ──────────────────────────────────────────
  function onPointerDown(e) {
    if (REDUCED) { fireQuip(); return; }
    // mid-transit he can't be grabbed — just chat
    if (isGrappling || state === 'lift-ride' || state === 'lift-wait' ||
        state === 'to-lift' || state === 'jetpacking' || state === 'chute') {
      fireQuip();
      return;
    }
    e.preventDefault();
    dragging = true;
    dragMoved = 0;
    dragStart = performance.now();
    const startCX = e.clientX, startCY = e.clientY;
    clearTimeout(travelTimer);
    try { mascot.setPointerCapture(e.pointerId); } catch (_) {}

    const move = (ev) => {
      dragMoved = Math.max(dragMoved,
        Math.abs(ev.clientX - startCX) + Math.abs(ev.clientY - startCY));
      if (dragMoved > 8 && state !== 'drag') {
        setState('drag');
        showBubble('Oi! Put me down! 😅');
      }
      if (state === 'drag') {
        x = clamp(ev.clientX - CFG.charW / 2, 0, window.innerWidth - CFG.charW);
        y = clamp(ev.clientY - CFG.charH / 2, 0, window.innerHeight - CFG.charH - CFG.bootExt);
        applyPos();
      }
    };

    const up = () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('pointercancel', up);
      dragging = false;

      const wasTap = dragMoved <= 8;
      if (wasTap) {
        // just a click — say something
        if (state === 'drag') setState(platform === 'header' ? 'header-walk' : 'floor-walk');
        fireQuip();
        scheduleTravel();
        return;
      }

      // dropped: near a platform → land, otherwise parachute
      if (Math.abs(y - headerY()) < 30 && state === 'drag') {
        y = headerY();
        platform = 'header';
        spawnPuff();
        setState('header-walk');
        velX = direction * CFG.walkSpeed;
        scheduleTravel();
      } else if (y >= floorY() - 30) {
        y = floorY();
        platform = 'floor';
        spawnPuff();
        setState('floor-walk');
        velX = direction * CFG.walkSpeed;
        scheduleTravel();
      } else {
        setState('chute');
      }
    };

    document.addEventListener('pointermove', move);
    document.addEventListener('pointerup', up);
    document.addEventListener('pointercancel', up);
  }

  // ─── QUIPS ─────────────────────────────────────────────────────
  function fireQuip() {
    const idx = quipIndex++ % CFG.quips.length;
    const quip = CFG.quips[idx];
    showBubble(quip);
    mascot.classList.add('state-wave');
    setTimeout(() => mascot.classList.remove('state-wave'), 1200);

    const next = CFG.quips[quipIndex % CFG.quips.length];
    if (next && next.startsWith('...')) {
      clearTimeout(autoQuipTimer);
      autoQuipTimer = setTimeout(() => {
        quipIndex++;
        showBubble(next);
        scheduleAutoQuip();
      }, 4300);
    } else {
      scheduleAutoQuip();
    }
  }

  function scheduleAutoQuip() {
    clearTimeout(autoQuipTimer);
    autoQuipTimer = setTimeout(fireQuip, 14000 + Math.random() * 12000);
  }

  let bubbleUntil = 0;
  function showBubble(text, force) {
    const now = performance.now();
    if (!force && now < bubbleUntil) return;
    bubbleUntil = now + 3800;
    bubble.textContent = text;
    bubble.classList.add('visible');
    bubble.style.left = x > window.innerWidth - 220 ? 'auto' : '0';
    bubble.style.right = x > window.innerWidth - 220 ? '0' : 'auto';
    clearTimeout(showBubble._t);
    showBubble._t = setTimeout(() => bubble.classList.remove('visible'), 3500);
  }

  // ─── SECTION AWARENESS ─────────────────────────────────────────
  const saidSections = new Set();
  function initSectionQuips() {
    const sections = document.querySelectorAll('[data-level]');
    if (!sections.length) return;
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (!e.isIntersecting) return;
        const id = e.target.id;
        // HUD always updates
        if (hudEl) {
          hudEl.querySelector('.lf-hud-level').textContent =
            'LVL ' + (e.target.dataset.level || '00') + ' · ' + (e.target.dataset.levelName || '');
        }
        // quip once per section, only after the user has scrolled
        if (window.scrollY > 80 && CFG.sectionQuips[id] && !saidSections.has(id)) {
          saidSections.add(id);
          showBubble(CFG.sectionQuips[id]);
        }
      });
    }, { rootMargin: '-40% 0px -40% 0px' });
    sections.forEach(s => io.observe(s));
  }

  // ─── SCROLL: cogs spin, depth gauge, brace ─────────────────────
  function onScroll() {
    const delta = window.scrollY - lastScrollY;
    lastScrollY = window.scrollY;
    spinCogs(-delta * 0.6);

    if (hudEl) {
      hudEl.querySelector('.lf-hud-depth').textContent = Math.round(window.scrollY / 12) + 'm';
    }

    // hard scroll → he braces against the wind
    if (Math.abs(delta) > 130 && (state === 'floor-walk' || state === 'header-walk')) {
      mascot.classList.add('state-brace');
      clearTimeout(braceTimer);
      braceTimer = setTimeout(() => mascot.classList.remove('state-brace'), 350);
    }
  }

  // ─── CURSOR PROXIMITY → wave ───────────────────────────────────
  let lastWave = 0;
  function onMouseMove(e) {
    if (dragging || (state !== 'floor-walk' && state !== 'header-walk')) return;
    const now = performance.now();
    if (now - lastWave < 7000) return;
    const cx = x + CFG.charW / 2;
    const cy = y + CFG.charH / 2;
    const d = Math.hypot(e.clientX - cx, e.clientY - cy);
    if (d < 110) {
      lastWave = now;
      face(e.clientX < cx ? -1 : 1);
      mascot.classList.add('state-wave');
      setTimeout(() => mascot.classList.remove('state-wave'), 1300);
    }
  }

  // ─── PUBLIC API ────────────────────────────────────────────────
  window.LumenWorld = {
    hail() {
      showBubble('You called? 📡', true);
      mascot.classList.add('state-wave');
      setTimeout(() => mascot.classList.remove('state-wave'), 1300);
      // if he's upstairs, send him down to say hello
      if (state === 'header-walk') {
        clearTimeout(travelTimer);
        setTimeout(doJetpack, 800);
      }
    },
    quip: (t) => showBubble(t, true),
  };

  // ─── INIT ──────────────────────────────────────────────────────
  function init() {
    measureHeader();
    buildWorld();
    buildMascot();
    initSectionQuips();

    x = Math.min(120, maxX());
    y = floorY();
    platform = 'floor';
    applyPos();

    if (REDUCED) {
      setState('idle');
      liftY = liftScrollY();
      applyLift();
      return;
    }

    setState('floor-walk');
    scheduleTravel();
    requestAnimationFrame(loop);
    autoQuipTimer = setTimeout(fireQuip, 5000);

    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('resize', () => {
      measureHeader();
      cogs.forEach(positionCog);
      x = clamp(x, 0, maxX());
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 400));
  } else {
    setTimeout(init, 400);
  }
})();
