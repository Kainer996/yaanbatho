/**
 * YAAN MASCOT - Space Explorer
 * Two platforms: header bar (top) + floor (bottom)
 * Grapple up, parachute down.
 */
(function () {
  'use strict';

  const CFG = {
    charW: 28,
    charH: 40,
    walkSpeed: 68,
    edgePad: 20,
    grappleInterval: [5000, 9000],
    platformWalkTime: [12000, 20000],  // walk platforms longer so they're visible
    quips: [
      "Houston, we're good 🚀",
      "One small step... 👋",
      "Exploring the site 🛸",
      "Built this myself 😎",
      "MotoGP from space! 🏍️",
      "Hi Addie! 💕",
      "BBC R1 to the moon 🎵",
      "Chifftown: population me 🏙️",
      "Low gravity vibes 🌙",
      "T-minus let's go! ⚡",
    ],
  };

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let mascot, bubble, shadowEl;
  let svgEl, grappleLine, grappleHook;

  // Character position: x = left edge, y = top edge (both in VIEWPORT px)
  let x = 60, y = 0;
  let direction = 1;
  let velX = CFG.walkSpeed;
  let state = 'floor-walk'; // floor-walk | header-walk | grappling | parachuting | idle
  let lastTime = null;
  let animId = null;
  let quipIndex = 0;

  let grappleTimer = null;
  let leaveTimer   = null;
  let idleTimer    = null;
  let isGrappling  = false;

  // ─── PLATFORM Y POSITIONS (character TOP when standing on each platform) ───
  // Floor: character feet rest on top of the 22px floor bar (border-top red line)
  function floorY() {
    return window.innerHeight - CFG.charH - 22;
  }

  // Header: character FEET rest on the header's bottom red line (header::after)
  // The boots/legs extend ~20px beyond the element's logical charH, so we
  // lift the character up by that amount so boots land on the line.
  const BOOT_EXT = 20;
  let _headerTopY = 0;
  function headerY() { return _headerTopY; }
  function measureHeader() {
    const h = document.querySelector('header');
    const hBottom = h ? h.getBoundingClientRect().bottom : 70;
    _headerTopY = hBottom - CFG.charH - BOOT_EXT; // boots ON the red line
  }

  // Compatibility shim — surfaces used in grapple/reel calcs
  function floorSurface()  { return floorY()  + CFG.charH; }
  function headerSurface() { return headerY() + CFG.charH; }

  // Character's feet y = surface y, so character top y = surface - charH
  function yFromSurface(surface) { return surface - CFG.charH; }

  // ─── INIT ───────────────────────────────────────────────────────────────────
  function init() {
    measureHeader();

    // SVG grapple overlay
    svgEl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svgEl.setAttribute('style','position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9998;overflow:visible');
    grappleLine = document.createElementNS('http://www.w3.org/2000/svg','line');
    grappleLine.setAttribute('stroke','#cc0000');
    grappleLine.setAttribute('stroke-width','2.5');
    grappleLine.setAttribute('stroke-dasharray','5,3');
    grappleLine.setAttribute('opacity','0');
    grappleHook = document.createElementNS('http://www.w3.org/2000/svg','circle');
    grappleHook.setAttribute('r','5');
    grappleHook.setAttribute('fill','#cc0000');
    grappleHook.setAttribute('stroke','#880000');
    grappleHook.setAttribute('stroke-width','1.5');
    grappleHook.setAttribute('opacity','0');
    svgEl.appendChild(grappleLine);
    svgEl.appendChild(grappleHook);
    document.body.appendChild(svgEl);

    // Shadow
    shadowEl = document.createElement('div');
    shadowEl.style.cssText = 'position:fixed;width:32px;height:6px;background:rgba(0,0,0,0.2);border-radius:50%;pointer-events:none;z-index:9997;';
    document.body.appendChild(shadowEl);

    // Mascot
    mascot = document.createElement('div');
    mascot.id = 'site-mascot';
    mascot.innerHTML = `
      <div class="mascot-head">
        <img src="/images/yaan_face_sq.png" alt="Yaan" draggable="false" />
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

    // Start on floor
    x = 60;
    y = yFromSurface(floorSurface());
    applyPos();

    mascot.addEventListener('click', onMascotClick);
    window.addEventListener('resize', measureHeader);

    setState('floor-walk');
    scheduleGrapple();
    animId = requestAnimationFrame(loop);
  }

  // ─── LOOP ──────────────────────────────────────────────────────────────────
  function loop(ts) {
    const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.06) : 0;
    lastTime = ts;
    if (!isGrappling) tick(dt);
    animId = requestAnimationFrame(loop);
  }

  function tick(dt) {
    const vw = window.innerWidth;
    const minX = CFG.edgePad;
    const maxX = vw - CFG.charW - CFG.edgePad;

    if (state === 'floor-walk' || state === 'header-walk') {
      // Snap y every frame — no drift possible
      y = state === 'floor-walk' ? floorY() : headerY();
      x += velX * dt;
      if (x >= maxX) { x = maxX; velX = -CFG.walkSpeed; direction = -1; updateFacing(); }
      if (x <= minX) { x = minX; velX =  CFG.walkSpeed; direction =  1; updateFacing(); }
    }

    else if (state === 'jetpacking') {
      y  += 180 * dt; // fast jetpack descent — 3s top-to-bottom not 10s
      x  += velX * dt * 0.3;
      const vw2 = window.innerWidth;
      if (x > vw2 - CFG.charW - CFG.edgePad) { x = vw2 - CFG.charW - CFG.edgePad; velX = -Math.abs(velX); direction = -1; updateFacing(); }
      if (x < CFG.edgePad)                    { x = CFG.edgePad; velX = Math.abs(velX); direction = 1; updateFacing(); }
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
    // With transform-origin: top left, a scaleX(-1) flip anchors to the left edge,
    // making the character appear charW to the LEFT of its CSS left.
    // When facing left, offset by charW so visual left stays at x.
    const cssLeft = direction === -1
      ? Math.round(x + CFG.charW)
      : Math.round(x);
    mascot.style.left   = cssLeft + 'px';
    mascot.style.top    = Math.round(y) + 'px';
    mascot.style.bottom = 'auto';
  }

  function updateShadow() {
    const atFloor = Math.abs(y - floorY()) < 6;
    shadowEl.style.left      = (x + 8) + 'px';
    shadowEl.style.top       = (floorY() + CFG.charH + 2) + 'px';
    shadowEl.style.bottom    = 'auto';
    shadowEl.style.transform = atFloor ? 'scaleX(1)' : 'scaleX(0.4)';
    shadowEl.style.opacity   = atFloor ? '0.25' : '0.08';
  }

  // ─── STATES ────────────────────────────────────────────────────────────────
  function setState(s) {
    state = s;
    mascot.classList.remove('state-idle','state-walk','state-jump','state-wave','state-grapple-aim');
    if (s === 'floor-walk' || s === 'header-walk') mascot.classList.add('state-walk');
    else if (s === 'idle')        mascot.classList.add('state-idle');
    else if (s === 'jetpacking')  mascot.classList.add('state-jetpack');
    else if (s === 'grapple-aim') mascot.classList.add('state-grapple-aim');
  }

  function updateFacing() {
    if (direction === -1) mascot.classList.add('facing-left');
    else mascot.classList.remove('facing-left');
  }

  // ─── GRAPPLE ───────────────────────────────────────────────────────────────
  function scheduleGrapple() {
    clearTimeout(grappleTimer);
    const delay = CFG.grappleInterval[0] + Math.random() * (CFG.grappleInterval[1] - CFG.grappleInterval[0]);
    grappleTimer = setTimeout(doGrapple, delay);
  }

  function doGrapple() {
    if (isGrappling || state !== 'floor-walk') { scheduleGrapple(); return; }
    isGrappling = true;
    clearTimeout(leaveTimer);
    clearTimeout(idleTimer);

    // Aim pose
    setState('grapple-aim');
    velX = 0;

    // Grapple hook fires at the header's bottom red line (feet level when on header)
    const tx = window.innerWidth / 2;
    const ty = headerY() + CFG.charH + BOOT_EXT; // hook catches ON the red line

    setTimeout(() => {
      // Character centre (viewport)
      const cx = x + CFG.charW / 2;
      const cy = y + CFG.charH / 2;
      shootLine(cx, cy, tx, ty, () => {
        reelIn(cx, cy, tx, ty);
      });
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
        setTimeout(() => { grappleHook.setAttribute('r', '5'); }, 80);
        setTimeout(onDone, 180);
      }
    }
    requestAnimationFrame(frame);
  }

  function reelIn(x1, y1, tx, ty) {
    const dur = 500, start = performance.now();
    const startX = x, startY = y;
    // Target: snap to header walking position
    const targetY = headerY();
    const targetX = clamp(tx - CFG.charW / 2, CFG.edgePad, window.innerWidth - CFG.charW - CFG.edgePad);

    function frame(ts) {
      const p = ease(Math.min((ts - start) / dur, 1));
      x = startX + (targetX - startX) * p;
      y = startY + (targetY - startY) * p;

      // Update grapple line origin
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
        const leaveDelay = CFG.platformWalkTime[0] + Math.random() * (CFG.platformWalkTime[1] - CFG.platformWalkTime[0]);
        leaveTimer = setTimeout(doJetpack, leaveDelay);
      }
    }
    requestAnimationFrame(frame);
  }

  function fadeGrapple() {
    let op = 1;
    const id = setInterval(() => {
      op -= 0.15;
      if (op <= 0) {
        grappleLine.setAttribute('opacity','0');
        grappleHook.setAttribute('opacity','0');
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
    for (let i = 0; i < 4; i++) {
      const p = document.createElement('div');
      const a = (i / 4) * Math.PI * 2;
      const bv = window.innerHeight - y - CFG.charH;
      p.style.cssText = `position:fixed;left:${x + CFG.charW/2}px;bottom:${bv}px;width:7px;height:7px;background:rgba(200,220,240,0.7);border-radius:50%;pointer-events:none;z-index:9997;transform:translate(-50%,-50%);transition:all 0.4s ease-out;`;
      document.body.appendChild(p);
      requestAnimationFrame(() => {
        p.style.left   = (x + CFG.charW/2 + Math.cos(a) * 20) + 'px';
        p.style.bottom = (bv + Math.sin(a) * 12 + 8) + 'px';
        p.style.opacity = '0';
        p.style.transform = 'translate(-50%,-50%) scale(2)';
      });
      setTimeout(() => p.remove(), 450);
    }
  }

  // ─── CLICK ─────────────────────────────────────────────────────────────────
  function onMascotClick(e) {
    e.stopPropagation();
    const quip = CFG.quips[quipIndex++ % CFG.quips.length];
    showBubble(quip);
    mascot.classList.add('state-wave');
    setTimeout(() => mascot.classList.remove('state-wave'), 1200);
  }

  function showBubble(text) {
    bubble.textContent = text;
    bubble.classList.add('visible');
    bubble.style.left = x > window.innerWidth - 200 ? 'auto' : '0';
    bubble.style.right = x > window.innerWidth - 200 ? '0' : 'auto';
    setTimeout(() => bubble.classList.remove('visible'), 2800);
  }

  // ─── UTILS ─────────────────────────────────────────────────────────────────
  function ease(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ─── START ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  else setTimeout(init, 500);

})();
