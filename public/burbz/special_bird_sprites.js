/* Short, once-per-tap portraits. No save, reward, care or audio dependencies. */
(function (root) {
  'use strict';
  const VERSION = 'special-card-sprites-20260907';
  const SHEETS = Object.freeze({
    'rook-witch': { file:'rook-witch.webp', scene:'rook-witch-scene.webp', durations:[180,140,140,140,200,140,140,220] },
    'peregrine-falcon': { file:'peregrine-falcon.webp', durations:[180,170,110,160,200,150,110,220] },
    'brandon-lee': { file:'brandon-lee.webp', scene:'brandon-lee-scene.webp', durations:[180,160,140,180,170,160,100,220] },
    'steven-herring-gull': { file:'steven.webp', scene:'steven-scene.webp', durations:[180,150,150,160,180,170,100,220] }
  });
  function keyFor(bird) {
    const keys = [bird?.commonName, bird?.species, bird?.scientificName].map(v => String(v || '').split('(')[0].trim().toLowerCase());
    if (keys.some(v => v === 'rook' || v === 'corvus frugilegus')) return 'rook-witch';
    if (keys.some(v => v === 'peregrine falcon' || v === 'falco peregrinus')) return 'peregrine-falcon';
    if (keys.some(v => v === 'carrion crow' || v === 'corvus corone')) return 'brandon-lee';
    if (keys.some(v => v === 'herring gull' || v === 'european herring gull' || v === 'larus argentatus')) return 'steven-herring-gull';
    return null;
  }
  function frameAt(key, elapsed) {
    const durations = SHEETS[key]?.durations;
    if (!durations || elapsed < 0) return -1;
    for (let i = 0, end = 0; i < durations.length; i++) { end += durations[i]; if (elapsed < end) return i; }
    return -1;
  }
  const api = { VERSION, SHEETS, keyFor, frameAt };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.BurbzSpecialBirdSprites = api;
  if (!root.document) return;
  const doc = root.document, cache = new Map(), bound = new WeakSet();
  const motion = root.matchMedia('(prefers-reduced-motion: reduce)');
  let active = null, sequence = 0, played = 0, lastStop = '';
  function eligible(button) {
    if (!button?.isConnected || doc.hidden || button.disabled || !SHEETS[button.dataset.specialBird]) return false;
    if (button.closest('[inert], [hidden], [aria-hidden="true"], .undiscovered, .locked-card, .bird-card.flipped')) return false;
    const blocking = doc.querySelector('#birdEquipOverlay.show, #birdInfoModal.show');
    if (blocking && !blocking.contains(button)) return false;
    const panel = button.closest('.bird-equip-panel');
    if (panel && panel.id !== 'birdEquipBody') return false;
    const overlay = button.closest('#birdEquipOverlay, #birdInfoModal');
    if (overlay && !overlay.classList.contains('show')) return false;
    if (!button.getClientRects().length || root.getComputedStyle(button).visibility === 'hidden') return false;
    const rect = button.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < root.innerHeight && rect.left < root.innerWidth;
  }
  function stop(reason = 'reset') {
    lastStop = typeof reason === 'string' ? reason : 'pagehide';
    sequence++;
    if (!active) return;
    const old = active; active = null;
    root.cancelAnimationFrame(old.raf); root.clearTimeout(old.timeout);
    old.observer?.disconnect(); old.intersection?.disconnect();
    old.canvas?.remove(); old.host.classList.remove('special-bird-playing'); old.host.style.removeProperty('--special-bird-opacity');
    old.button.removeAttribute('aria-busy');
    old.button.dataset.spriteState = 'idle';
    const hint = old.button.querySelector('.special-bird-hint');
    if (hint) hint.textContent = 'Tap to animate';
    if (!cache.has(old.key)) for (const image of old.images || []) { image.onload = image.onerror = null; image.src = ''; }
  }
  function fail(token) {
    if (active?.token !== token) return;
    const button = active.button; stop();
    // A static fallback remains visible; another deliberate tap may retry.
    button.dataset.spriteState = 'unavailable';
    const hint = button.querySelector('.special-bird-hint');
    if (hint) hint.textContent = 'Tap to retry';
  }
  function start(button) {
    if (!eligible(button)) return false;
    if (motion.matches) { stop(); return false; }
    if (active?.button === button) return true; // merge tap storms, never queue
    stop();
    const host = button.parentElement, key = button.dataset.specialBird, token = ++sequence;
    const state = active = { button, host, key, token, raf:0, timeout:0 };
    button.setAttribute('aria-busy', 'true'); button.dataset.spriteState = 'loading';
    const hint = button.querySelector('.special-bird-hint'); if (hint) hint.textContent = 'Loading…';
    state.observer = new root.MutationObserver(() => { if (active === state && !eligible(button)) stop('inactive-mutation'); });
    state.observer.observe(doc.body, { subtree:true, childList:true, attributes:true, attributeFilter:['class','id','hidden','inert','aria-hidden','style'] });
    if (root.IntersectionObserver) {
      state.intersection = new root.IntersectionObserver(entries => { if (active === state && entries.some(e => !e.isIntersecting)) stop('offscreen'); });
      state.intersection.observe(button);
    }
    state.timeout = root.setTimeout(() => fail(token), 6000);
    const ready = asset => {
      const {image, scene} = asset;
      if (active !== state || !eligible(button) || motion.matches) { if (active === state) stop(); return; }
      if (image.naturalWidth !== 1024 || image.naturalHeight !== 512) { fail(token); return; }
      root.clearTimeout(state.timeout);
      cache.delete(key); cache.set(key, asset);
      while (cache.size > 2) cache.delete(cache.keys().next().value);
      const canvas = state.canvas = doc.createElement('canvas');
      canvas.className = 'special-bird-canvas'; canvas.width = canvas.height = 256; canvas.setAttribute('aria-hidden','true');
      const ctx = canvas.getContext('2d'); if (!ctx) { fail(token); return; }
      host.insertBefore(canvas, button); host.classList.add('special-bird-playing');
      button.dataset.spriteState = 'playing'; if (hint) hint.textContent = 'Playing…'; played++;
      const started = root.performance.now(), duration = SHEETS[key].durations.reduce((a,b) => a+b, 0); let last = -2, lastOpacity = -1;
      const tick = now => {
        if (active !== state) return;
        if (!eligible(button) || motion.matches) { stop('inactive-frame'); return; }
        const elapsed = now - started, frame = frameAt(key, elapsed);
        if (frame < 0) { stop('complete'); return; }
        const opacity = Math.min(1, elapsed/100, Math.max(0,(duration-elapsed)/130));
        if (opacity !== lastOpacity) { host.style.setProperty('--special-bird-opacity', String(opacity)); lastOpacity=opacity; }
        if (frame !== last) {
          ctx.clearRect(0,0,256,256);
          if (scene) ctx.drawImage(scene,0,0,256,256);
          ctx.drawImage(image,(frame % 4)*256,Math.floor(frame/4)*256,256,256,0,0,256,256);
          canvas.dataset.frame = String(frame); last = frame;
        }
        state.raf = root.requestAnimationFrame(tick);
      };
      tick(started);
    };
    if (cache.has(key)) ready(cache.get(key));
    else {
      state.images = [];
      const load = file => new Promise((resolve,reject) => {
        const image = new root.Image(); state.images.push(image); image.decoding='async';
        image.onload=() => { image.onload=image.onerror=null; resolve(image); };
        image.onerror=() => { image.onload=image.onerror=null; reject(new Error('Sprite unavailable')); };
        image.src='/burbz/assets/special-birds/' + file + '?v=' + VERSION;
      });
      Promise.all([load(SHEETS[key].file), SHEETS[key].scene ? load(SHEETS[key].scene) : Promise.resolve(null)])
        .then(([image,scene]) => ready({image,scene})).catch(() => fail(token));
    }
    return true;
  }
  function bind(container) {
    if (!container || bound.has(container)) return;
    bound.add(container);
    let gesture = null, suppressUntil = 0;
    container.addEventListener('pointerdown', e => {
      gesture = {x:e.clientX,y:e.clientY,id:e.pointerId};
    }, {passive:true});
    container.addEventListener('pointermove', e => {
      if (!gesture || gesture.id !== e.pointerId) return;
      if (Math.hypot(e.clientX-gesture.x,e.clientY-gesture.y) > 12) {
        suppressUntil = root.performance.now() + 400; stop();
      }
    }, {passive:true});
    container.addEventListener('pointercancel', () => { if (gesture) suppressUntil = root.performance.now()+400; gesture=null; stop(); }, {passive:true});
    container.addEventListener('pointerup', () => { gesture=null; }, {passive:true});
    container.addEventListener('click', e => {
      const button = e.target.closest?.('button[data-special-bird]');
      if (!button || !container.contains(button)) return;
      e.preventDefault(); e.stopPropagation();
      if (root.performance.now() < suppressUntil) return;
      start(button);
    }, true);
  }
  function init() {
    bind(doc.getElementById('birdGrid'));
    // This capture listener is BELOW the overlay's swipe click guard.
    bind(doc.getElementById('birdEquipTrack'));
    bind(doc.getElementById('birdInfoContent'));
  }
  doc.addEventListener('pointerdown', e => { if (active && !active.host.contains(e.target)) stop(); }, {capture:true,passive:true});
  doc.addEventListener('visibilitychange', () => { if (doc.hidden) stop(); });
  root.addEventListener('pagehide', stop);
  motion.addEventListener?.('change', () => { if (motion.matches) stop(); });
  Object.assign(api, { play:start, stop, bind, status:() => ({ key:active?.key || null, state:active?.button.dataset.spriteState || 'idle', cached:cache.size, played, lastStop }) });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',init,{once:true}); else init();
})(typeof window !== 'undefined' ? window : globalThis);
