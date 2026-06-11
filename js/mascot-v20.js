/**
 * YAAN MASCOT - Space Explorer
 * Walk, grapple, jetpack — OR visitors can control with arrow keys!
 * Click spaceman to toggle player control mode.
 */
(function () {
  'use strict';

  const CFG = {
    charW: 28,
    charH: 40,
    walkSpeed: 68,
    edgePad: 20,
    grappleInterval: [5000, 9000],
    platformWalkTime: [12000, 20000],
    playerSpeed: 160,       // faster when player-controlled
    jetpackThrust: -280,    // upward velocity when holding UP
    gravity: 320,           // gravity pulling back down
    maxFallSpeed: 400,
    quips: [
      "This website is crisp... 🤌",
      "...like the edge of a good lasagna. 🍝",
      "...check out my bangers on the music tab 🎵",
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
      "Who ate all the pies? 🥧",
      "...probably me to be fair 😅",
    ],
    touchQuips: [
      "Ouch! 😣",
      "That tickles! 😂",
      "Hey, space invader! 🚀",
      "Hands off the suit! 🪖",
      "Watch the jetpack! 🔥",
      "Personal space, please! 😤",
      "I felt that through the helmet 😅",
      "Do you mind?! 😂",
      "Hey! I'm trying to walk here! 🚶",
      "Not the face! 😂",
      "You're gonna make me drop my pie 🥧",
    ],
    controlQuips: [
      "You're flying me! 🚀",
      "Use arrow keys! Up = jetpack! 🔥",
      "Wheeeee! 🎮",
      "I'm YOUR spaceman now! 😎",
      "Try the jetpack — press UP! ⬆️",
    ],
    releaseQuips: [
      "Phew, back to autopilot 😅",
      "Thanks for the ride! 🚀",
      "My legs needed a break anyway 😂",
      "That was fun! Click me again anytime 🎮",
    ],
  };

  // ─── STATE ─────────────────────────────────────────────────────────────────
  let mascot, bubble, shadowEl;
  let svgEl, grappleLine, grappleHook;

  let x = 60, y = 0;
  let direction = 1;
  let velX = CFG.walkSpeed;
  let velY = 0;              // vertical velocity for player jetpack
  let state = 'floor-walk';
  let lastTime = null;
  let animId = null;
  let quipIndex = 0;

  let grappleTimer = null;
  let leaveTimer   = null;
  let idleTimer    = null;
  let isGrappling  = false;

  // Player control
  let playerControlled = false;
  let keys = { left: false, right: false, up: false, down: false };
  let controlIndicator = null;

  // ─── PLATFORM Y POSITIONS ─────────────────────────────────────────────────
  function floorY() {
    return window.innerHeight - CFG.charH - 22;
  }

  const BOOT_EXT = 20;
  let _headerTopY = 0;
  function headerY() { return _headerTopY; }
  function measureHeader() {
    const h = document.querySelector('header');
    const hBottom = h ? h.getBoundingClientRect().bottom : 70;
    _headerTopY = hBottom - CFG.charH - BOOT_EXT;
  }

  function floorSurface()  { return floorY()  + CFG.charH; }
  function headerSurface() { return headerY() + CFG.charH; }
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
        <img src="/images/yaan_face_v2.jpg" alt="Yaan" draggable="false" />
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
    document.body.appendChild(mascot);
    document.body.appendChild(bubble);

    // Control indicator (shows when player-controlled)
    controlIndicator = document.createElement('div');
    controlIndicator.id = 'mascot-control-indicator';
    controlIndicator.innerHTML = '🎮 Arrow keys to move · Up = Jetpack · Click spaceman to release';
    controlIndicator.style.cssText = 'position:fixed;bottom:28px;left:50%;transform:translateX(-50%);' +
      'background:rgba(0,0,0,0.85);color:#00d4a0;font-family:"Space Grotesk",system-ui,sans-serif;' +
      'font-size:13px;font-weight:600;padding:10px 24px;border-radius:100px;z-index:10001;' +
      'border:1px solid rgba(0,212,160,0.4);box-shadow:0 4px 20px rgba(0,0,0,0.5);' +
      'pointer-events:none;opacity:0;transition:opacity 0.3s;white-space:nowrap;letter-spacing:0.3px;';
    document.body.appendChild(controlIndicator);

    // Start on floor
    x = 60;
    y = yFromSurface(floorSurface());
    applyPos();

    mascot.addEventListener('click', onMascotClick);
    window.addEventListener('resize', measureHeader);

    // Keyboard listeners
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    setState('floor-walk');
    scheduleGrapple();
    animId = requestAnimationFrame(loop);

    autoQuipTimer = setTimeout(fireQuip, 5000);
  }

  // ─── PLAYER CONTROL MODE ──────────────────────────────────────────────────
  function enablePlayerControl() {
    playerControlled = true;
    keys = { left: false, right: false, up: false, down: false };
    velY = 0;

    // Stop all AI behaviour
    clearTimeout(grappleTimer);
    clearTimeout(leaveTimer);
    clearTimeout(idleTimer);
    clearTimeout(autoQuipTimer);
    isGrappling = false;
    fadeGrapple();

    // If not on floor, start falling
    if (y < floorY()) {
      state = 'player-fly';
      setState('jetpacking');
    } else {
      state = 'player-floor';
      setState('idle');
    }

    // Show indicator
    controlIndicator.style.opacity = '1';

    // Quip
    const q = CFG.controlQuips[Math.floor(Math.random() * CFG.controlQuips.length)];
    showBubble(q);
  }

  function disablePlayerControl() {
    playerControlled = false;
    keys = { left: false, right: false, up: false, down: false };
    velY = 0;

    controlIndicator.style.opacity = '0';

    // Snap to floor if close
    if (y > floorY() - 30) {
      y = floorY();
    }

    // Resume AI
    velX = direction * CFG.walkSpeed;
    if (y >= floorY()) {
      setState('floor-walk');
      state = 'floor-walk';
    } else {
      // In the air — jetpack down
      setState('jetpacking');
      state = 'jetpacking';
    }
    scheduleGrapple();
    scheduleAutoQuip();

    const q = CFG.releaseQuips[Math.floor(Math.random() * CFG.releaseQuips.length)];
    showBubble(q);
  }

  function onKeyDown(e) {
    if (!playerControlled) return;
    switch(e.key) {
      case 'ArrowLeft':  case 'a': keys.left  = true; e.preventDefault(); break;
      case 'ArrowRight': case 'd': keys.right = true; e.preventDefault(); break;
      case 'ArrowUp':    case 'w': keys.up    = true; e.preventDefault(); break;
      case 'ArrowDown':  case 's': keys.down  = true; e.preventDefault(); break;
    }
  }

  function onKeyUp(e) {
    if (!playerControlled) return;
    switch(e.key) {
      case 'ArrowLeft':  case 'a': keys.left  = false; break;
      case 'ArrowRight': case 'd': keys.right = false; break;
      case 'ArrowUp':    case 'w': keys.up    = false; break;
      case 'ArrowDown':  case 's': keys.down  = false; break;
    }
  }

  function tickPlayerControl(dt) {
    const vw = window.innerWidth;
    const minX = CFG.edgePad;
    const maxX = vw - CFG.charW - CFG.edgePad;
    const onFloor = y >= floorY() - 2;

    // Horizontal movement
    let moveX = 0;
    if (keys.left)  { moveX = -CFG.playerSpeed; direction = -1; updateFacing(); }
    if (keys.right) { moveX =  CFG.playerSpeed; direction =  1; updateFacing(); }
    x += moveX * dt;
    x = clamp(x, minX, maxX);

    // Jetpack (UP key)
    if (keys.up) {
      velY = CFG.jetpackThrust;
      // Show jetpack flames
      if (!mascot.classList.contains('state-jetpack')) {
        mascot.classList.remove('state-idle','state-walk','state-jump','state-wave','state-grapple-aim');
        mascot.classList.add('state-jetpack');
      }
    } else {
      // Gravity
      velY += CFG.gravity * dt;
      velY = Math.min(velY, CFG.maxFallSpeed);

      // If on floor and not pressing up, walk or idle
      if (onFloor && velY >= 0) {
        velY = 0;
        y = floorY();
        if (moveX !== 0) {
          if (!mascot.classList.contains('state-walk')) {
            mascot.classList.remove('state-idle','state-jetpack','state-jump','state-wave','state-grapple-aim');
            mascot.classList.add('state-walk');
            if (direction === -1) mascot.classList.add('facing-left');
          }
        } else {
          if (!mascot.classList.contains('state-idle')) {
            mascot.classList.remove('state-walk','state-jetpack','state-jump','state-wave','state-grapple-aim');
            mascot.classList.add('state-idle');
          }
        }
      } else if (!onFloor) {
        // In air without jetpack — still show jetpack (falling)
        if (!mascot.classList.contains('state-jetpack')) {
          mascot.classList.remove('state-idle','state-walk','state-jump','state-wave','state-grapple-aim');
          mascot.classList.add('state-jetpack');
        }
      }
    }

    y += velY * dt;

    // Clamp: don't go above screen or below floor
    y = clamp(y, -CFG.charH * 0.5, floorY());
    if (y >= floorY()) { velY = Math.min(velY, 0); }

    // Walking animation direction sync
    if (moveX !== 0 && onFloor && !keys.up) {
      if (direction === -1) mascot.classList.add('facing-left');
      else mascot.classList.remove('facing-left');
    }

    applyPos();
    updateShadow();
  }

  // ─── LOOP ──────────────────────────────────────────────────────────────────
  function loop(ts) {
    const dt = lastTime ? Math.min((ts - lastTime) / 1000, 0.06) : 0;
    lastTime = ts;

    if (playerControlled) {
      tickPlayerControl(dt);
    } else if (!isGrappling) {
      tick(dt);
    }

    animId = requestAnimationFrame(loop);
  }

  function tick(dt) {
    const vw = window.innerWidth;
    const minX = CFG.edgePad;
    const maxX = vw - CFG.charW - CFG.edgePad;

    if (state === 'floor-walk' || state === 'header-walk') {
      y = state === 'floor-walk' ? floorY() : headerY();
      x += velX * dt;
      if (x >= maxX) { x = maxX; velX = -CFG.walkSpeed; direction = -1; updateFacing(); }
      if (x <= minX) { x = minX; velX =  CFG.walkSpeed; direction =  1; updateFacing(); }
    }

    else if (state === 'jetpacking') {
      y  += 180 * dt;
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
    mascot.classList.remove('state-idle','state-walk','state-jump','state-wave','state-grapple-aim','state-jetpack');
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
    if (playerControlled) return;
    clearTimeout(grappleTimer);
    const delay = CFG.grappleInterval[0] + Math.random() * (CFG.grappleInterval[1] - CFG.grappleInterval[0]);
    grappleTimer = setTimeout(doGrapple, delay);
  }

  function doGrapple() {
    if (playerControlled) return;
    if (isGrappling || state !== 'floor-walk') { scheduleGrapple(); return; }
    isGrappling = true;
    clearTimeout(leaveTimer);
    clearTimeout(idleTimer);

    setState('grapple-aim');
    velX = 0;

    const tx = window.innerWidth / 2;
    const ty = headerY() + CFG.charH + BOOT_EXT;

    setTimeout(() => {
      if (playerControlled) { isGrappling = false; return; }
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
      if (playerControlled) { fadeGrapple(); isGrappling = false; return; }
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
    const targetY = headerY();
    const targetX = clamp(tx - CFG.charW / 2, CFG.edgePad, window.innerWidth - CFG.charW - CFG.edgePad);

    function frame(ts) {
      if (playerControlled) { fadeGrapple(); isGrappling = false; return; }
      const p = ease(Math.min((ts - start) / dur, 1));
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

  // ─── JETPACK (AI) ──────────────────────────────────────────────────────────
  function doJetpack() {
    if (playerControlled) return;
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
    // Toggle player control
    if (playerControlled) {
      disablePlayerControl();
    } else {
      enablePlayerControl();
    }
  }

  let touchQuipIndex = 0;
  function fireTouchQuip() {
    const quip = CFG.touchQuips[Math.floor(Math.random() * CFG.touchQuips.length)];
    showBubble(quip);
    mascot.classList.add('state-wave');
    setTimeout(() => mascot.classList.remove('state-wave'), 1200);
    scheduleAutoQuip();
  }

  const recentQuips = [];

  function pickRandomQuip() {
    const pool = CFG.quips
      .map((q, i) => i)
      .filter(i => !CFG.quips[i].startsWith('...'))
      .filter(i => !recentQuips.includes(i));

    if (pool.length === 0) { recentQuips.length = 0; return pickRandomQuip(); }

    const idx = pool[Math.floor(Math.random() * pool.length)];
    recentQuips.push(idx);
    if (recentQuips.length > 4) recentQuips.shift();
    return idx;
  }

  function fireQuip() {
    if (playerControlled) return;
    const idx = pickRandomQuip();
    const quip = CFG.quips[idx];
    showBubble(quip);
    mascot.classList.add('state-wave');
    setTimeout(() => mascot.classList.remove('state-wave'), 1200);

    const nextQuip = CFG.quips[idx + 1];
    if (nextQuip && nextQuip.startsWith('...')) {
      clearTimeout(autoQuipTimer);
      autoQuipTimer = setTimeout(() => {
        showBubble(nextQuip);
        const nextNext = CFG.quips[idx + 2];
        if (nextNext && nextNext.startsWith('...')) {
          autoQuipTimer = setTimeout(() => {
            showBubble(nextNext);
            scheduleAutoQuip();
          }, 6800);
        } else {
          scheduleAutoQuip();
        }
      }, 6800);
    } else {
      scheduleAutoQuip();
    }
  }

  let autoQuipTimer = null;
  function scheduleAutoQuip() {
    if (playerControlled) return;
    clearTimeout(autoQuipTimer);
    const delay = 24000 + Math.random() * 20000;
    autoQuipTimer = setTimeout(fireQuip, delay);
  }

  let bubbleFollowId = null;

  function updateBubblePos() {
    if (!bubble.classList.contains('visible')) return;

    const atTop = y < window.innerHeight / 2;
    const bubbleW = 220;
    let bLeft = Math.round(x + CFG.charW / 2 - bubbleW / 2);
    bLeft = Math.max(8, Math.min(bLeft, window.innerWidth - bubbleW - 8));
    bubble.style.left  = bLeft + 'px';
    bubble.style.right = 'auto';

    if (atTop) {
      bubble.style.top    = Math.round(y + CFG.charH + 8) + 'px';
      bubble.style.bottom = 'auto';
      bubble.classList.add('tail-top');
      bubble.classList.remove('tail-bottom');
    } else {
      bubble.style.top    = 'auto';
      bubble.style.bottom = Math.round(window.innerHeight - y + 8) + 'px';
      bubble.classList.add('tail-bottom');
      bubble.classList.remove('tail-top');
    }
  }

  function showBubble(text) {
    bubble.textContent = text;
    updateBubblePos();
    bubble.classList.add('visible');

    clearInterval(bubbleFollowId);
    bubbleFollowId = setInterval(updateBubblePos, 16);

    setTimeout(() => {
      bubble.classList.remove('visible');
      clearInterval(bubbleFollowId);
    }, 6000);
  }

  // ─── UTILS ─────────────────────────────────────────────────────────────────
  function ease(t) { return t < 0.5 ? 2*t*t : -1 + (4 - 2*t)*t; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  // ─── START ─────────────────────────────────────────────────────────────────
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(init, 500));
  else setTimeout(init, 500);

})();
